import { auth } from '@/lib/auth'

type AdminUserCandidate = {
  role?: string | null
  email?: string | null
} | null | undefined

export function checkAdminAccess(user: AdminUserCandidate): boolean {
  if (!user) {
    return false
  }

  if (user.role === 'ADMIN') {
    return true
  }

  const adminEmails = process.env.ADMIN_EMAILS?.split(',') ?? []
  return !!user.email && adminEmails.includes(user.email)
}

export async function getCurrentUser() {
  const session = await auth()
  return session?.user ?? null
}

export async function requireAdminAccess() {
  const user = await getCurrentUser()

  if (!checkAdminAccess(user)) {
    throw new Error('Admin access required')
  }

  return user
}
