'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SideNav from '@/components/SideNav'
import LogoutButton from '@/components/LogoutButton'
import BackButton from '@/components/BackButton'
import AppHeaderMini from '@/components/AppHeaderMini' // ⬅️ nuovo header minimale (Utente/Ruolo + Indietro/Logout)

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
        {/* barra superiore: rimpiazzata con il nuovo header minimale */}
        <AppHeaderMini />

        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
