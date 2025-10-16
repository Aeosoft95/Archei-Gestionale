'use client'
import { useEffect } from 'react'

export default function GmNpc() {
  useEffect(() => {
    const role = localStorage.getItem('archei:role')
    if (role !== 'gm') window.location.href = '/'
  }, [])
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Generatore NPC</h1>
      <div className="card">Placeholder contenuti.</div>
    </main>
  )
}
