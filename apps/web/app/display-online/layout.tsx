'use client'
import BackBar from '@/components/BackBar'

export default function DisplayOnlineLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <BackBar title="Display (online)" />
      <div className="p-4">{children}</div>
    </div>
  )
}
