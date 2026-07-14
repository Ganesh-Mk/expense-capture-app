import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";
import {
  Loader2,
  Upload,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  ReceiptText,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { ExpenseCategory } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface FormData {
  category_id: string;
  amount: string;
  description: string;
  expense_date: string;
  merchant_name: string;
  location: string;
}

interface ValidationResult {
  valid: boolean;
  status: "pending" | "flagged" | "rejected";
  violations: string[];
  rule?: {
    daily_limit: number;
    per_expense_limit: number;
    daily_spent: number;
    daily_remaining: number;
  };
}

export default function NewExpensePage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof FormData, string>>
  >({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const validateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { register, handleSubmit, control, watch } = useForm<FormData>({
    defaultValues: { expense_date: format(new Date(), "yyyy-MM-dd") },
  });

  const watchAmount = watch("amount");
  const watchCategory = watch("category_id");
  const watchDate = watch("expense_date");

  useEffect(() => {
    supabase
      .from("expense_categories")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  useEffect(() => {
    setValidation(null);
    if (!watchAmount || !watchCategory || !watchDate || !user || !profile)
      return;
    const amount = parseFloat(watchAmount);
    if (isNaN(amount) || amount <= 0) return;
    if (validateTimeout.current) clearTimeout(validateTimeout.current);
    validateTimeout.current = setTimeout(() => {
      runValidation(amount, watchCategory, watchDate);
    }, 600);
    return () => {
      if (validateTimeout.current) clearTimeout(validateTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchAmount, watchCategory, watchDate]);

  async function runValidation(
    amount: number,
    categoryId: string,
    date: string,
  ): Promise<ValidationResult | null> {
    if (!user || !profile) return null;
    setValidating(true);
    try {
      const { data, error, response } = await supabase.functions.invoke<ValidationResult>('validate-expense', {
        body: {
          user_id: user.id,
          category_id: categoryId,
          amount,
          expense_date: date,
          grade: profile.grade,
        },
      });

      if (error) {
        let errorMessage = "Unable to validate expense policy";
        try {
          if (response) {
            const errBody = await response.json();
            if (errBody && errBody.error) {
              errorMessage = errBody.error;
            }
          }
        } catch {
          errorMessage = error.message || errorMessage;
        }
        throw new Error(errorMessage);
      }

      setValidation(data);
      return data;
    } catch (err) {
      setApiError((err as Error).message);
      return null;
    } finally {
      setValidating(false);
    }
  }

  function validateForm(data: FormData): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!data.category_id) errs.category_id = "Select a category";
    const amt = parseFloat(data.amount);
    if (!data.amount || isNaN(amt) || amt <= 0)
      errs.amount = "Amount must be greater than 0";
    if (amt > 999999) errs.amount = "Amount too large";
    if (!data.description || data.description.length < 3)
      errs.description = "Provide a brief description";
    if (!data.expense_date) errs.expense_date = "Select a date";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setApiError("Receipt file must be under 5 MB");
      return;
    }
    setReceiptFile(file);
    if (file.type.startsWith("image/")) {
      setReceiptPreview(URL.createObjectURL(file));
    } else {
      setReceiptPreview(null);
    }
  }

  async function onSubmit(data: FormData) {
    if (!validateForm(data)) return;
    if (!user) return;
    const currentValidation = await runValidation(
      parseFloat(data.amount),
      data.category_id,
      data.expense_date,
    );

    if (!currentValidation) {
      setApiError("Expense policy could not be checked. Please try again.");
      return;
    }

    if (currentValidation.status === "rejected") {
      setApiError(
        "This expense exceeds your allowed limits and cannot be submitted.",
      );
      return;
    }

    setSubmitting(true);
    setApiError(null);

    try {
      let receiptUrl: string | null = null;
      let receiptFilename: string | null = null;

      if (receiptFile) {
        const ext = receiptFile.name.split(".").pop();
        const path = `receipts/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("expense-receipts")
          .upload(path, receiptFile, { upsert: false });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("expense-receipts")
          .getPublicUrl(path);
        receiptUrl = urlData.publicUrl;
        receiptFilename = receiptFile.name;
      }

      const { error } = await supabase.from("expenses").insert({
        user_id: user.id,
        category_id: data.category_id,
        amount: parseFloat(data.amount),
        description: data.description,
        expense_date: data.expense_date,
        merchant_name: data.merchant_name || null,
        location: data.location || null,
        status: currentValidation.status,
        receipt_url: receiptUrl,
        receipt_filename: receiptFilename,
        is_from_chat: false,
      });

      if (error) throw error;
      navigate("/expenses");
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl p-4 md:p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg border bg-muted">
          <ReceiptText className="size-4 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-base font-semibold">Submit Expense</h1>
          <p className="text-xs text-muted-foreground">
            Grade {profile?.grade} · {profile?.department}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-sm">Expense Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 px-5 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category_id" className="text-xs font-medium">
                Category *
              </Label>
              <Controller
                name="category_id"
                control={control}
                render={({ field }) => (
                  <NativeSelect
                    id="category_id"
                    aria-invalid={!!fieldErrors.category_id}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  >
                    <option value="" disabled>
                      Select a category…
                    </option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              />
              {fieldErrors.category_id && (
                <p className="text-xs text-destructive">
                  {fieldErrors.category_id}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amount" className="text-xs font-medium">
                  Amount (₹) *
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-7"
                    aria-invalid={!!fieldErrors.amount}
                    {...register("amount")}
                  />
                </div>
                {fieldErrors.amount && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.amount}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="expense_date" className="text-xs font-medium">
                  Date *
                </Label>
                <Input
                  id="expense_date"
                  type="date"
                  aria-invalid={!!fieldErrors.expense_date}
                  {...register("expense_date")}
                />
                {fieldErrors.expense_date && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.expense_date}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description" className="text-xs font-medium">
                Description *
              </Label>
              <Textarea
                id="description"
                placeholder="Brief description of the expense…"
                rows={2}
                className="resize-none"
                aria-invalid={!!fieldErrors.description}
                {...register("description")}
              />
              {fieldErrors.description && (
                <p className="text-xs text-destructive">
                  {fieldErrors.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="merchant_name" className="text-xs font-medium">
                  Merchant / Vendor
                </Label>
                <Input
                  id="merchant_name"
                  placeholder="e.g. Swiggy, OYO"
                  {...register("merchant_name")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="location" className="text-xs font-medium">
                  Location
                </Label>
                <Input
                  id="location"
                  placeholder="e.g. Mumbai, Delhi"
                  {...register("location")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Validation feedback */}
        {(validating || validation) && (
          <div className="flex flex-col gap-2">
            {validating && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Checking policy rules…
              </div>
            )}
            {!validating && validation && (
              <>
                {validation.rule && (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        label: "Daily limit",
                        value: `₹${validation.rule.daily_limit.toFixed(0)}`,
                      },
                      {
                        label: "Spent today",
                        value: `₹${validation.rule.daily_spent.toFixed(0)}`,
                      },
                      {
                        label: "Remaining",
                        value: `₹${validation.rule.daily_remaining.toFixed(0)}`,
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-md border bg-muted/30 px-3 py-2 text-center"
                      >
                        <p className="text-[10px] text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="text-sm font-semibold">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {validation.status === "rejected" && (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertTitle className="text-xs font-semibold">
                      Expense rejected
                    </AlertTitle>
                    <AlertDescription className="text-xs">
                      <ul className="mt-1 space-y-0.5">
                        {validation.violations.map((v, i) => (
                          <li key={i}>• {v}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {validation.status === "flagged" && (
                  <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
                    <AlertTriangle className="size-4 text-amber-600" />
                    <AlertTitle className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                      Flagged for review
                    </AlertTitle>
                    <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
                      <ul className="mt-1 space-y-0.5">
                        {validation.violations.map((v, i) => (
                          <li key={i}>• {v}</li>
                        ))}
                      </ul>
                      <p className="mt-1">
                        The expense will be submitted but requires manager
                        approval.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                {validation.status === "pending" && validation.valid && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    Within policy limits — expense can be submitted
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Receipt Upload */}
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-sm">Receipt</CardTitle>
            <CardDescription className="text-xs">
              Upload an image or PDF (max 5 MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 py-4">
            {receiptFile ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {receiptPreview ? (
                    <img
                      src={receiptPreview}
                      alt="Receipt"
                      className="size-10 rounded object-cover border"
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded border bg-muted">
                      <ReceiptText className="size-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {receiptFile.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(receiptFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setReceiptFile(null);
                    setReceiptPreview(null);
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed py-6 transition-colors",
                  "text-muted-foreground hover:border-primary/50 hover:bg-muted/40",
                )}
              >
                <Upload className="size-5" />
                <span className="text-xs">Click to upload receipt</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </CardContent>
        </Card>

        {apiError && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{apiError}</AlertDescription>
          </Alert>
        )}

        <Separator />

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              submitting || validating || validation?.status === "rejected"
            }
            className="flex-1"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {!submitting && validation?.status === "flagged" && (
              <Badge variant="outline" className="mr-1 text-[10px]">
                Flagged
              </Badge>
            )}
            {submitting ? "Submitting…" : "Submit Expense"}
          </Button>
        </div>

        <div className="flex items-start gap-1.5 rounded-md bg-muted/50 px-3 py-2">
          <Info className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground">
            Expenses are validated against Grade {profile?.grade} policies.
            Flagged expenses require manager approval.
          </p>
        </div>
      </form>
    </div>
  );
}
