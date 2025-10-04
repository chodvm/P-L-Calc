// app/components/MobileHeader.tsx
'use client'
import { useState } from 'react'
import Sidebar from './Sidebar'

export default function MobileHeader() {
  const [open, setOpen] = useState(false)
  return (
    <>
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-50 bg-white border-b">
        <div className="flex items-center gap-3 p-3">
          <button aria-label="Toggle menu" onClick={() => setOpen(!open)} className="rounded-xl border px-3 py-2">☰</button>
          <div className="font-semibold">Have Elite urgent care</div>
        </div>
      </header>

      {/* Mobile sidebar only (hide on md+) */}
      <div className="md:hidden">
        <Sidebar open={open} />
      </div>
    </>
  )
}
