'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseClient'

type Role = 'boss' | 'admin' | 'staff'

export default function Sidebar({ open = true }: { open?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const s = supabaseBrowser()

  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [role, setRole] = useState<Role | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      // 1) Who's signed in?
      const { data: userRes } = await s.auth.getUser()
      const user = userRes?.user ?? null
      if (!user) {
        setLoading(false)
        return
      }

      // 2) Prefer profiles (Option B). Fallback to auth metadata/email prefix.
      let profName: string | null = null
      let profEmail: string | null = null
      const { data: prof } = await s
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single()

      profName = (prof?.full_name ?? null) || null
      profEmail = (prof?.email ?? null) || null

      const meta = (user.user_metadata as any) || {}
      const fallbackName =
        meta.full_name ||
        meta.name ||
        (user.email ? user.email.split('@')[0] : null)

      setDisplayName(profName || fallbackName || null)
      setEmail(profEmail || user.email || null)

      // 3) Role for the first org (your app is single-org today)
      const { data: orgs } = await s.from('orgs').select('id').limit(1)
      const orgId = orgs?.[0]?.id
      if (orgId) {
        const { data: rows } = await s
          .from('user_org_memberships')
          .select('role')
          .eq('org_id', orgId)
          .eq('user_id', user.id)
          .limit(1)
        if (rows && rows.length) setRole(rows[0].role as Role)
      }

      setLoading(false)
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignOut = async () => {
    await s.auth.signOut()
    router.replace('/login')
  }

  const items = [
    { href: '/inventory', label: 'Inventory' },
    { href: '/calculator', label: 'Calculator' },
    { href: '/reports', label: 'Reports' },
    { href: '/settings', label: 'Settings' },
  ]

  return (
    <aside className={`${open ? '' : 'hidden'} md:block h-screen w-64 shrink-0 border-r bg-slate-50`}>
      <div className="flex h-full flex-col">
        <div className="p-4 text-lg font-semibold">Have Elite urgent care</div>

        <nav className="px-2 space-y-1">
          {items.map((it) => {
            const active = pathname?.startsWith(it.href)
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`block rounded-xl px-3 py-2 ${
                  active ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
                }`}
              >
                {it.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer: user info */}
        <div className="mt-auto border-t p-4 text-sm">
          {loading ? (
            <div className="animate-pulse text-slate-500">Loading user…</div>
          ) : email ? (
            <div className="space-y-1">
              <div className="font-medium">{displayName ?? 'Signed in'}</div>
              <div className="text-slate-500 text-xs">{email}</div>
              {role && (
                <div className="mt-2 inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium capitalize">
                  {role}
                </div>
              )}
              <div>
                <button
                  onClick={handleSignOut}
                  className="mt-3 inline-flex items-center rounded-lg border px-3 py-1 text-xs hover:bg-slate-100"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <Link href="/login" className="underline">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </aside>
  )
}
