'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Boxes, Calculator, BarChart3, Settings, ChevronDown } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabaseClient'

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

      const { data: prof } = await s.from('profiles').select('full_name, email').eq('id', user.id).single()
      const meta = (user.user_metadata as any) || {}
      setDisplayName(prof?.full_name || meta.full_name || meta.name || (user.email ? user.email.split('@')[0] : null))
      setEmail(prof?.email || user.email || null)

      const { data: orgs } = await s.from('orgs').select('id').limit(1)
      const orgId = orgs?.[0]?.id
      if (orgId) {
        const { data: rows } = await s
          .from('user_org_memberships')
          .select('role')
          .eq('org_id', orgId)
          .eq('user_id', user.id)
          .limit(1)
        if (rows?.length) setRole(rows[0].role as Role)
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignOut = async () => { await s.auth.signOut(); router.replace('/login') }

  const clinic = [
    { href: '/inventory', label: 'Inventory', icon: Boxes },
    { href: '/calculator', label: 'Calculator', icon: Calculator },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
  ]
  const admin = [{ href: '/settings', label: 'Settings', icon: Settings }]

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3 text-base font-semibold">
        Have Elite urgent care
      </SidebarHeader>

      <SidebarContent>
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="w-full">
                Clinic
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {clinic.map(it => (
                    <SidebarMenuItem key={it.href}>
                      <SidebarMenuButton asChild isActive={pathname?.startsWith(it.href)}>
                        <Link href={it.href}>
                          <it.icon />
                          <span>{it.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="w-full">
                Admin
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {admin.map(it => (
                    <SidebarMenuItem key={it.href}>
                      <SidebarMenuButton asChild isActive={pathname?.startsWith(it.href)}>
                        <Link href={it.href}>
                          <it.icon />
                          <span>{it.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <Separator className="mb-3" />
        {loading ? (
          <div className="animate-pulse text-xs text-muted-foreground">Loading user…</div>
        ) : email ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{(displayName ?? email).slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{displayName ?? 'Signed in'}</div>
              <div className="truncate text-xs text-muted-foreground">{email}</div>
              {role && (
                <div className="mt-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize">
                  {role}
                </div>
              )}
            </div>
            <div className="ml-auto">
              <Button variant="outline" size="xs" onClick={handleSignOut}>Sign out</Button>
            </div>
          </div>
        ) : (
          <Link href="/login" className="text-sm underline">Sign in</Link>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
