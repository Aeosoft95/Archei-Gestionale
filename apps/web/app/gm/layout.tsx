'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SideNav from '@/components/SideNav'
import LogoutButton from '@/components/LogoutButton'
import BackButton from '@/components/BackButton'

export default function GmLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const role = localStorage.getItem('archei:role')
    if (role !== 'gm') window.location.href = '/'
  }, [])

  return (
    <div className="flex min-h-screen">
      <aside className={`bg-zinc-950/60 border-r border-zinc-800 p-4 w-64 ${open ? '' : 'hidden md:block'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-xl font-semibold">Menu</div>
          <button className="btn !bg-zinc-800" onClick={() => setOpen(!open)}>☰</button>
        </div>
        <SideNav />
      </aside>

      <div className="flex-1">
        {/* barra superiore */}
        <div className="border-b border-zinc-800 p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button className="btn !bg-zinc-800 md:hidden" onClick={() => setOpen(!open)}>☰</button>
            <div className="text-zinc-300">ARCHEI Companion — GM</div>

            <div className="hidden sm:flex items-center gap-2 ml-3">
              <Link href="/display" className="btn !bg-zinc-700">Display</Link>
              <Link href="/display-online" className="btn !bg-zinc-700">Online</Link>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BackButton />
            <LogoutButton />
          </div>
        </div>

        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
