'use client'
import { useState } from 'react'
import { useWS } from '@/components/ws/WSProvider'

type Npc = {
  name: string
  role: string
  look: string
  personality: string
  bonds: string
  goals: string
  imageUrl: string
  locale: string
  description: string
}

export default function NpcGeneratorPage() {
  const { config, connected, openSetup, send } = useWS()

  const [npc, setNpc] = useState<Npc>({
    name: '',
    role: '',
    look: '',
    personality: '',
    bonds: '',
    goals: '',
    imageUrl: '',
    locale: 'italiano',
    description: ''
  })

  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  function upd<K extends keyof Npc>(k: K, v: Npc[K]) {
    setNpc(prev => ({ ...prev, [k]: v }))
  }

  async function generateWithAI() {
    try {
      setGenError(null)
      setGenLoading(true)

      const res = await fetch('/api/npc-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: npc.name,
          role: npc.role,
          look: npc.look,
          personality: npc.personality,
          bonds: npc.bonds || undefined,
          goals: npc.goals || undefined,
          locale: npc.locale || 'italiano',
          maxTokens: 220
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(()=>({error:'Errore'}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      upd('description', (data.description || '').trim())
    } catch (e: any) {
      setGenError(e?.message || 'Errore durante la generazione')
    } finally {
      setGenLoading(false)
    }
  }

  function sendToChat() {
    if (!config || !connected) return
    const parts: string[] = []

    if (npc.name) parts.push(`**${npc.name}**`)
    if (npc.role) parts.push(`_${npc.role}_`)
    if (npc.description) parts.push(npc.description)
    if (npc.imageUrl) parts.push(`🖌️Ritratto: ${npc.imageUrl}`) // link cliccabile in chat

    const text = parts.filter(Boolean).join('\n')
    send({
      t: 'chat:msg',
      room: config.room,
      nick: config.nick || 'GM',
      text,
      ts: Date.now(),
      channel: 'global'
    })
  }

  return (
    <div className="min-h-screen flex flex-col gap-4">
      {/* TOPBAR */}
      <div className="border-b border-zinc-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">ARCHEI — Generatore NPC</div>
          <button className="btn !bg-zinc-800" onClick={openSetup}>WS</button>
          <span className={`text-xs ${connected ? 'text-green-400' : 'text-zinc-400'}`}>
            {connected ? 'WS online' : 'WS offline'}
          </span>
        </div>
        <div className="text-xs text-zinc-500">GM</div>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4 px-3 pb-6">
        {/* Form */}
        <div className="card space-y-3">
          <div className="font-semibold">Dati PNG</div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <div className="label">Nome</div>
              <input className="input" value={npc.name} onChange={e=>upd('name', e.target.value)} placeholder="Es. Ser Kaelen" />
            </div>
            <div>
              <div className="label">Ruolo</div>
              <input className="input" value={npc.role} onChange={e=>upd('role', e.target.value)} placeholder="Es. Capitano delle guardie" />
            </div>
            <div className="sm:col-span-2">
              <div className="label">Aspetto</div>
              <input className="input" value={npc.look} onChange={e=>upd('look', e.target.value)} placeholder="Segni particolari, stile, voce…" />
            </div>
            <div className="sm:col-span-2">
              <div className="label">Personalità</div>
              <input className="input" value={npc.personality} onChange={e=>upd('personality', e.target.value)} placeholder="Tratti caratteriali (niente segreti)" />
            </div>
            <div>
              <div className="label">Legami (facoltativo)</div>
              <input className="input" value={npc.bonds} onChange={e=>upd('bonds', e.target.value)} placeholder="Alleati, relazioni pubbliche" />
            </div>
            <div>
              <div className="label">Obiettivi (facoltativo)</div>
              <input className="input" value={npc.goals} onChange={e=>upd('goals', e.target.value)} placeholder="Intenti dichiarati" />
            </div>
            <div>
              <div className="label">Lingua/tono</div>
              <input className="input" value={npc.locale} onChange={e=>upd('locale', e.target.value)} placeholder="italiano, tono colloquiale…" />
            </div>
            <div>
              <div className="label">Ritratto (URL)</div>
              <input className="input" value={npc.imageUrl} onChange={e=>upd('imageUrl', e.target.value)} placeholder="https://…" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn" onClick={generateWithAI} disabled={genLoading}>
              {genLoading ? 'Generazione…' : 'Genera descrizione con IA'}
            </button>
            <button className="btn" onClick={sendToChat} disabled={!connected}>
              Invia in chat
            </button>
          </div>

          {genError && <div className="text-sm text-rose-400">Errore: {genError}</div>}

          <div className="border-t border-zinc-800 pt-3 space-y-2">
            <div className="label">Descrizione</div>
            <textarea
              className="input min-h-32"
              value={npc.description}
              onChange={e=>upd('description', e.target.value)}
              placeholder="Qui compare il testo generato dall'IA (puoi modificarlo prima di inviare)."
            />
          </div>
        </div>

        {/* Anteprima invio in chat */}
        <div className="card space-y-3">
          <div className="font-semibold">Anteprima messaggio chat</div>
          <div className="space-y-2 text-sm">
            <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
              {npc.name && <div className="font-bold">{npc.name}</div>}
              {npc.role && <div className="italic text-zinc-300">{npc.role}</div>}
              {npc.description && <div className="mt-2 whitespace-pre-wrap">{npc.description}</div>}
              {npc.imageUrl && (
                <div className="mt-2">
                  <a className="text-teal-400 underline" href={npc.imageUrl} target="_blank" rel="noreferrer">🖌️Ritratto</a>
                </div>
              )}
            </div>
          </div>

          {/* Mini preview immagine */}
          {npc.imageUrl && (
            <div className="mt-2">
              <img
                src={npc.imageUrl}
                alt="ritratto"
                className="w-full max-w-xs aspect-square object-cover rounded-xl border border-zinc-800"
                onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
