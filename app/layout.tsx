import type { Metadata } from 'next'
import './globals.css'

import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'

export const metadata: Metadata = { title: 'Have Elite urgent care' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            {/* Optional tiny toggle on mobile; remove this block if you truly want none */}
            <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
              <SidebarTrigger />
            </header>

            <div className="mx-auto w-full max-w-5xl p-4 md:p-8">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  )
}
