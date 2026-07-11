import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import {
  Send, Loader2, Bot, CheckCircle2,
  Paperclip, X
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import type { ChatMessage, ExpenseCategory } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

// Simple NLP: extract amount + category from free text
function parseExpenseFromText(text: string, categories: ExpenseCategory[]): {
  amount: number | null
  category: ExpenseCategory | null
  description: string
  date: string
} {
  const amountMatch = text.match(/(?:rs\.?|₹|inr)?\s*(\d+(?:[,\d]*)?(?:\.\d{1,2})?)/i)
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null

  const lower = text.toLowerCase()
  let matchedCat: ExpenseCategory | null = null
  const keywords: Record<string, string[]> = {
    'Food & Dining': ['food', 'lunch', 'dinner', 'breakfast', 'meal', 'restaurant', 'cafe', 'eat', 'swiggy', 'zomato', 'pizza', 'burger'],
    'Travel': ['travel', 'cab', 'taxi', 'uber', 'ola', 'bus', 'train', 'flight', 'auto', 'fuel', 'petrol'],
    'Accommodation': ['hotel', 'stay', 'accommodation', 'lodging', 'oyo', 'room', 'lodge'],
    'Communication': ['phone', 'internet', 'mobile', 'recharge', 'broadband', 'courier', 'postage'],
    'Office Supplies': ['office', 'stationery', 'pen', 'paper', 'printer', 'supplies'],
    'Medical': ['medical', 'doctor', 'hospital', 'medicine', 'pharmacy', 'health'],
    'Training': ['training', 'course', 'book', 'seminar', 'workshop', 'certification'],
    'Entertainment': ['entertainment', 'client', 'event', 'team outing', 'movie'],
  }
  for (const [catName, words] of Object.entries(keywords)) {
    if (words.some(w => lower.includes(w))) {
      matchedCat = categories.find(c => c.name === catName) ?? null
      if (matchedCat) break
    }
  }

  return {
    amount,
    category: matchedCat,
    description: text.length > 100 ? text.slice(0, 100) : text,
    date: format(new Date(), 'yyyy-MM-dd'),
  }
}

type ValidationResult = {
  status: 'pending' | 'flagged' | 'rejected'
  violations: string[]
}

function buildBotReply(
  parsed: ReturnType<typeof parseExpenseFromText>,
  created: boolean,
  validation: ValidationResult | null,
): string {
  if (created && parsed.amount && parsed.category) {
    const statusText =
      validation?.status === 'flagged'
        ? 'flagged for manager review'
        : 'pending approval'

    return `✓ Expense recorded!\n\n**₹${parsed.amount.toLocaleString('en-IN')}** for **${parsed.category.name}** on ${format(new Date(), 'dd MMM yyyy')}.\n\nThe expense is now ${statusText}. You can view it in My Expenses.`
  }
  if (validation?.status === 'rejected') {
    return `This expense exceeds your allowed limits and cannot be submitted.\n\n${validation.violations.join('\n')}`
  }
  if (!parsed.amount && !parsed.category) {
    return `I couldn't detect an expense in your message. Try something like:\n\n• "Paid ₹450 for lunch at Swiggy"\n• "₹1200 hotel stay in Mumbai"\n• "Cab ride ₹280 to office"`
  }
  if (!parsed.amount) {
    return `I found a ${parsed.category?.name ?? 'expense'} but couldn't detect the amount. Please include the amount, e.g. "₹450 for ${parsed.category?.name?.toLowerCase() ?? 'this'}".`
  }
  if (!parsed.category) {
    return `I detected ₹${parsed.amount} but couldn't identify the category. Please mention what it was for, e.g. "₹${parsed.amount} for lunch" or "₹${parsed.amount} cab ride".`
  }
  return `Couldn't record the expense. Please try again or use the expense form.`
}

export default function ChatPage() {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('expense_categories').select('*').order('name')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  const fetchMessages = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`chat:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as ChatMessage])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function sendWelcome() {
    if (!user) return
    const welcome: ChatMessage = {
      id: 'welcome',
      user_id: user.id,
      role: 'assistant',
      content: `Hi ${profile?.full_name?.split(' ')[0] ?? 'there'}! 👋 I'm your expense assistant.\n\nYou can:\n• Tell me about an expense (e.g. "Paid ₹450 for lunch")\n• Upload a receipt and I'll create the expense for you\n• Ask about your spending limits\n\nHow can I help you today?`,
      message_type: 'system',
      parsed_expense_id: null,
      metadata: null,
      created_at: new Date().toISOString(),
    }
    setMessages([welcome])
  }

  useEffect(() => {
    if (!loading && messages.length === 0) sendWelcome()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  async function validateExpense(
    amount: number,
    categoryId: string,
    date: string,
  ): Promise<ValidationResult | null> {
    if (!user || !profile) return null

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-expense`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            category_id: categoryId,
            amount,
            expense_date: date,
            grade: profile.grade,
          }),
        },
      )

      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }

  async function handleSend() {
    if ((!input.trim() && !receiptFile) || !user || !profile) return
    setSending(true)

    const userContent = input.trim() || `📎 Uploaded receipt: ${receiptFile?.name}`

    // Save user message
    const { data: userMsg } = await supabase.from('chat_messages').insert({
      user_id: user.id,
      role: 'user',
      content: userContent,
      message_type: receiptFile ? 'receipt_upload' : 'text',
    }).select().maybeSingle()

    if (userMsg) setMessages(prev => [...prev, userMsg])
    setInput('')
    setReceiptFile(null)

    // Parse intent
    const parsed = parseExpenseFromText(userContent, categories)
    let created = false
    let expenseId: string | null = null
    let validation: ValidationResult | null = null

    if (parsed.amount && parsed.category) {
      validation = await validateExpense(parsed.amount, parsed.category.id, parsed.date)

      // Attempt to create expense
      if (validation && validation.status !== 'rejected') {
        const { data: expense } = await supabase.from('expenses').insert({
          user_id: user.id,
          category_id: parsed.category.id,
          amount: parsed.amount,
          description: parsed.description,
          expense_date: parsed.date,
          is_from_chat: true,
          status: validation.status,
        }).select().maybeSingle()

        if (expense) {
          created = true
          expenseId = expense.id
        }
      }
    }

    // Bot reply
    const botContent = buildBotReply(parsed, created, validation)
    const { data: botMsg } = await supabase.from('chat_messages').insert({
      user_id: user.id,
      role: 'assistant',
      content: botContent,
      message_type: created ? 'expense_parsed' : 'text',
      parsed_expense_id: expenseId,
    }).select().maybeSingle()

    if (botMsg) setMessages(prev => [...prev, botMsg])
    setSending(false)
  }

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium">Expense Assistant</p>
          <p className="text-xs text-muted-foreground">AI-powered expense filing & support</p>
        </div>
        <div className="ml-auto">
          <Badge variant="outline" className="text-[10px]">
            <span className="mr-1 size-1.5 rounded-full bg-emerald-500 inline-block" />
            Online
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex items-end gap-2',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <Avatar size="sm" className="shrink-0 mb-0.5">
                  <AvatarFallback className="text-[10px]">
                    {msg.role === 'user'
                      ? (profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U')
                      : <Bot className="size-3" />}
                  </AvatarFallback>
                </Avatar>
                <div className={cn('max-w-[75%] flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
                  <div
                    className={cn(
                      'rounded-2xl px-3 py-2 text-xs leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    )}
                  >
                    {msg.content.split('\n').map((line, i) => {
                      const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      return (
                        <p
                          key={i}
                          className={line.startsWith('•') ? 'ml-2' : ''}
                          dangerouslySetInnerHTML={{ __html: bold }}
                        />
                      )
                    })}
                  </div>
                  {msg.message_type === 'expense_parsed' && msg.parsed_expense_id && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <CheckCircle2 className="size-2.5 text-emerald-500" />
                      Expense created
                    </Badge>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(msg.created_at), 'HH:mm')}
                  </p>
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex items-end gap-2">
              <Avatar size="sm" className="shrink-0">
                <AvatarFallback><Bot className="size-3" /></AvatarFallback>
              </Avatar>
              <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2">
                <div className="flex items-center gap-1">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick hints */}
      {messages.length <= 1 && (
        <div className="border-t px-4 py-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              'Paid ₹450 for lunch',
              '₹1200 hotel stay',
              'Cab ₹280 to airport',
              'Office supplies ₹600',
            ].map(hint => (
              <button
                key={hint}
                onClick={() => setInput(hint)}
                className="shrink-0 rounded-full border px-3 py-1 text-xs hover:bg-accent transition-colors"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Receipt preview */}
      {receiptFile && (
        <div className="border-t px-4 py-2 flex items-center gap-2">
          <Paperclip className="size-3.5 text-muted-foreground" />
          <span className="text-xs truncate flex-1">{receiptFile.name}</span>
          <Button variant="ghost" size="icon-xs" onClick={() => setReceiptFile(null)}>
            <X className="size-3" />
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) { setReceiptFile(f); setInput(`Receipt for: `) }
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => fileRef.current?.click()}
            title="Attach receipt"
          >
            <Paperclip className="size-4" />
          </Button>
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="e.g. Paid ₹450 for lunch at Swiggy…"
            className="flex-1 text-sm"
            disabled={sending}
          />
          <Button
            size="icon-sm"
            onClick={handleSend}
            disabled={(!input.trim() && !receiptFile) || sending}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
