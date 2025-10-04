import './globals.css'
import { Providers } from './providers'
import Sidebar from './components/Sidebar'
import MobileHeader from './components/MobileHeader'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="md:flex min-h-screen">
            <MobileHeader />
            {/* Desktop sidebar */}
            <div className="hidden md:block w-64 shrink-0">
              <Sidebar open />
            </div>
            <main className="flex-1 p-4 md:p-8">
              <div className="mx-auto w-full max-w-5xl">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
