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
            <div className="hidden md:block"><Sidebar open /></div>
            <main className="flex-1 md:ml-64 p-4 md:p-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
