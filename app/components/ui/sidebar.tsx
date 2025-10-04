'use client'

import * as React from 'react'

/** tiny className combiner */
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

/** share open/close state */
type SidebarCtx = { open: boolean; setOpen: (v: boolean) => void }
const SidebarContext = React.createContext<SidebarCtx | null>(null)

export function SidebarProvider({
  children,
  defaultOpen = false,
  style,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
  style?: React.CSSProperties
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  // Close on Escape (mobile)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      <div
        style={style}
        data-sidebar-open={open ? 'true' : 'false'}
        className="relative flex min-h-screen"
      >
        {children}

        {/* mobile overlay */}
        {open && (
          <button
            aria-label="Close sidebar"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-black/30 md:hidden"
          />
        )}
      </div>
    </SidebarContext.Provider>
  )
}

function useSidebar() {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) throw new Error('Sidebar primitives must be used inside <SidebarProvider>')
  return ctx
}

/** the sidebar panel (slides in on mobile, fixed on desktop) */
export function Sidebar({ children }: { children: React.ReactNode }) {
  const { open } = useSidebar()
  return (
    <aside
      data-open={open ? 'true' : 'false'}
      className={cx(
        'fixed inset-y-0 left-0 z-40 w-64 border-r bg-slate-50 transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full',
        'md:static md:translate-x-0 md:block' // always visible on desktop
      )}
    >
      <div className="flex h-full flex-col">{children}</div>
    </aside>
  )
}

/** content wrapper that accounts for the sidebar width on desktop */
export function SidebarInset({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 md:ml-64">{children}</div>
}

/** a tiny toggle button you can drop near titles (mobile only if you want) */
export function SidebarTrigger({ className }: { className?: string }) {
  const { open, setOpen } = useSidebar()
  return (
    <button
      type="button"
      aria-label="Toggle sidebar"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={cx('inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-slate-100', className)}
    >
      <span className="mr-2">☰</span>
      Menu
    </button>
  )
}

/* --- structural helpers to mirror shadcn’s API shape --- */

export function SidebarHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('px-4 py-3 text-base font-semibold', className)}>{children}</div>
}
export function SidebarContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('space-y-3 px-2 py-2', className)}>{children}</div>
}
export function SidebarFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('mt-auto border-t px-3 py-3', className)}>{children}</div>
}

export function SidebarGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>
}
export function SidebarGroupLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500', className)}>{children}</div>
}
export function SidebarGroupContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('px-1', className)}>{children}</div>
}

export function SidebarMenu({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-1">{children}</ul>
}
export function SidebarMenuItem({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>
}
export function SidebarMenuButton({
  children,
  isActive,
  className,
}: {
  children: React.ReactNode
  isActive?: boolean
  className?: string
}) {
  return (
    <div
      className={cx(
        'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2',
        isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-100',
        className
      )}
    >
      {children}
    </div>
  )
}
