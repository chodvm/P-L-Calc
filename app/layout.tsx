import type { Metadata } from 'next'
import './globals.css'

import { AppSidebar } from './components/app-sidebar'         // or '@/components/app-sidebar' if you moved it
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar' // official shadcn import

export const metadata: Metadata = { title: 'Have Elite urgent care' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            {/* tiny toggle on mobile; optional */}
            <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
              <SidebarTrigger />
            </header>

            {/* single, centered container */}
            <main className="mx-auto w-full max-w-6xl px-4 md:px-8 py-6">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  )
}
