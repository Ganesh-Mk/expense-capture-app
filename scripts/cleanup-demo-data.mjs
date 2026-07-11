import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1)]
    }),
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const adminEmails = ['admin@expenseflow.test', 'demo.admin@expenseflow.test']
const password = 'password123'

const deleteEmails = [
  'admin@gmail.com',
  'ganesh@gmail.com',
  'ganesh1@gmail.com',
]

const retiredEmailDomain = 'removed.expenseflow.test'

function cleanSeedEmail(email) {
  return email
    .replace('.demo@expenseflow.test', '@expenseflow.test')
    .replace('demo.admin@expenseflow.test', 'admin@expenseflow.test')
}

function client() {
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function signInAny(emails) {
  const userClient = client()

  for (const email of emails) {
    const result = await userClient.auth.signInWithPassword({
      email,
      password,
    })

    if (!result.error) {
      return userClient
    }
  }

  return null
}

async function main() {
  let signInError = null
  for (const email of adminEmails) {
    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    signInError = result.error
    if (!result.error) break
  }

  if (signInError) {
    throw new Error(signInError.message)
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, employee_code')

  if (profileError) {
    throw new Error(profileError.message)
  }

  const toDelete = profiles.filter(
    (profile) =>
      deleteEmails.includes(profile.email?.toLowerCase()) ||
      (profile.email?.toLowerCase() === 'admin@gmail.com' &&
        profile.full_name?.toLowerCase() === 'admin') ||
      (profile.email?.toLowerCase() === 'ganesh@gmail.com' &&
        profile.full_name?.toLowerCase() === 'ganesh koparde') ||
      (profile.email?.toLowerCase() === 'ganesh1@gmail.com'),
  )

  for (const profile of toDelete) {
    const ownerClient = await signInAny([profile.email])

    if (!ownerClient) {
      console.log(`Could not remove ${profile.email}: password is not password123 and profiles are owner-write only`)
      continue
    }

    await ownerClient.from('chat_messages').delete().eq('user_id', profile.id)
    await ownerClient.from('expenses').delete().eq('user_id', profile.id)

    const { error } = await ownerClient.from('profiles').delete().eq('id', profile.id)

    if (error) {
      console.log(`Could not delete own profile ${profile.email}: ${error.message}`)
    } else {
      console.log(`Deleted profile ${profile.email}`)
    }

    await ownerClient.auth.signOut()
  }

  const seededProfiles = profiles.filter((profile) =>
    profile.email?.endsWith('.demo@expenseflow.test') ||
    profile.email === 'demo.admin@expenseflow.test',
  )

  for (const profile of seededProfiles) {
    const nextEmail = cleanSeedEmail(profile.email)
    const nextName = profile.full_name.replace(/\bdemo\b/gi, '').replace(/\s+/g, ' ').trim()
    const ownerClient = await signInAny([profile.email, nextEmail])

    if (!ownerClient) {
      console.log(`Could not update ${profile.email}: unable to sign in as owner`)
      continue
    }

    const { error } = await ownerClient
      .from('profiles')
      .update({
        full_name: nextName || profile.full_name,
        email: nextEmail,
      })
      .eq('id', profile.id)

    if (error) {
      console.log(`Could not update ${profile.email}: ${error.message}`)
    } else {
      console.log(`Updated ${profile.email} -> ${nextEmail}`)
    }

    await ownerClient.auth.signOut()
  }

  console.log(`Matched ${toDelete.length} profiles for deletion`)
  console.log(`Matched ${seededProfiles.length} seeded profiles for cleanup`)

  const { data: remainingProfiles, error: verifyError } = await supabase
    .from('profiles')
    .select('full_name, email, employee_code')
    .order('email')

  if (verifyError) {
    throw new Error(verifyError.message)
  }

  const remainingDemoEmails = remainingProfiles.filter((profile) =>
    profile.email?.toLowerCase().includes('.demo@') ||
    profile.email?.toLowerCase() === 'demo.admin@expenseflow.test',
  )
  const remainingRequestedEmails = remainingProfiles.filter((profile) =>
    deleteEmails.includes(profile.email?.toLowerCase()),
  )

  console.log(`Remaining .demo profile emails: ${remainingDemoEmails.length}`)
  console.log(`Remaining requested profile emails: ${remainingRequestedEmails.length}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
