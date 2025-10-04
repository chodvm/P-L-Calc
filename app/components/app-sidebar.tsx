'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from './ui/sidebar'

export function AppSidebar() {
  const pathname = usePathname()
  const items = [
    { href: '/inventory', label: 'Inventory' },
    { href: '/calculator', label: 'Calculator' },
    { href: '/reports',   label: 'Reports' },
    { href: '/settings',  label: 'Settings' },
  ]

  return (
    <Sidebar>
      <SidebarHeader>Have Elite urgent care</SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Clinic</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(it => (
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
        <div className="text-xs text-slate-500">Signed in</div>
      </SidebarFooter>
    </Sidebar>
  )
}

// (optional) also keep default export so either import style works
export default AppSidebar
