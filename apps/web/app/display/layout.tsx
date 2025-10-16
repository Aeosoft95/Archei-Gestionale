'use client'
import BackBar from '@/components/BackBar'

export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <BackBar title="Display (locale)" />
      <div className="p-4">{children}</div>
    </div>
  )
}
