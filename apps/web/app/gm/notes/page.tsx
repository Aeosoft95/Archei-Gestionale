'use client'
import { useEffect, useState } from 'react'

export default function GmNotes() {
  const [txt, setTxt] = useState('')

  useEffect(() => {
    const role = localStorage.getItem('archei:role')
    if (role !== 'gm') window.location.href = '/'
    setTxt(localStorage.getItem('archei:gm:notes') || '')
  }, [])

  function save() {
    localStorage.setItem('archei:gm:notes', txt)
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Note GM</h1>
      <div className="card">
        <textarea
          className="w-full h-64 bg-zinc-900 border border-zinc-800 rounded-xl p-3 outline-none"
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          placeholder="Scrivi note della sessione…"
        />
        <div className="mt-3 flex justify-end">
          <button className="btn" onClick={save}>Salva</button>
        </div>
      </div>
    </main>
  )
}