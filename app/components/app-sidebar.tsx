'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from './ui/sidebar'
import { supabaseBrowser } from '../../lib/supabaseClient' // ⬅️ relative path from app/components

type Role = 'boss' | 'admin' | 'staff'

export function AppSidebar() {
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
      const { data: userRes } = await s.auth.getUser()
      const user = userRes?.user ?? null
      if (!user) { setLoading(false); return }

      // profiles table: id(uuid) PK = auth.users.id, full_name, email (Option B you created)
      const { data: prof } = await s.from('profiles').select('full_name,email').eq('id', user.id).maybeSingle()
      setDisplayName(prof?.full_name || user.email?.split('@')[0] || 'User')
      setEmail(prof?.email || user.email || null)

      // first org role (single-org)
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
    { href: '/reports',   label: 'Reports' },
    { href: '/settings',  label: 'Settings' },
  ]

  return (
    <Sidebar>
      <SidebarHeader>Have Elite Urgent Care</SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Clinic</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.href}>
                  <Link href={it.href}>
                    <SidebarMenuButton isActive={pathname?.startsWith(it.href)}>
                      <span>{it.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {loading ? (
          <div className="animate-pulse text-xs text-slate-500">Loading user…</div>
        ) : email ? (
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{displayName}</div>
              <div className="truncate text-xs text-slate-500">{email}</div>
              {role && (
                <div className="mt-1 inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium capitalize">
                  {role}
                </div>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="ml-auto inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/login" className="text-sm underline">Sign in</Link>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
