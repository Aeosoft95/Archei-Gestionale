import './globals.css'
import type { Metadata } from 'next'
import { WSProvider } from '@/components/ws/WSProvider'
import WSSetupModal from '@/components/ws/WSSetupModal'

export const metadata: Metadata = {
  title: 'ARCHEI Companion',
  description: 'GM/Player tools for ARCHEI',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <WSProvider>
          <WSSetupModal />
          {children}
        </WSProvider>
      </body>
    </html>
  )
}
