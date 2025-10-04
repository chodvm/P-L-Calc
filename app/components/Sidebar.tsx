'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/inventory', label: 'Inventory' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
]

export default function Sidebar({ open }: { open?: boolean }) {
  const pathname = usePathname()
  return (
    <aside className={`fixed z-40 top-0 left-0 h-full w-64 bg-slate-50 border-r border-slate-200 p-4 transform transition-transform duration-200 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} md:static md:block`}>
      <div className="text-lg font-semibold mb-6">Have Elite urgent care</div>
      <nav className="flex flex-col gap-2">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={`rounded-xl px-3 py-2 ${pathname === it.href ? 'bg-slate-900 text-white' : 'hover:bg-slate-200'}`}>
            {it.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
