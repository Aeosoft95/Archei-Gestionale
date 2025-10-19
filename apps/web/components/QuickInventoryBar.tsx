'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useWS } from '@/components/ws/WSProvider'

// ===== tipi =====
export type InvItem = {
  id: string
  name: string
  qty: number
  weight?: number
  equipped?: boolean
  notes?: string
  tags?: string[]
}
export type InventoryData = {
  coins: number
  items: InvItem[]
  capacity?: number // opzionale (per calcolare sovraccarico)
}

// ===== utils =====
const uid = () => Math.random().toString(36).slice(2, 9)
const clamp = (n:number,a:number,b:number)=>Math.max(a,Math.min(b,n))
const LS_KEY = 'archei:player:inventory'

// fallback locale (se API non presenti)
async function loadLocal(): Promise<InventoryData> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { coins: 0, items: [] }
    const js = JSON.parse(raw)
    // harden
    return {
      coins: typeof js.coins==='number' ? js.coins : 0,
      items: Array.isArray(js.items) ? js.items : [],
      capacity: typeof js.capacity==='number' ? js.capacity : undefined,
    }
  } catch { return { coins: 0, items: [] } }
}
async function saveLocal(data: InventoryData) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch {}
}

export default function QuickInventoryBar() {
  const { config, connected, send } = useWS()

  // nick (per eventuale invio messaggi in chat)
  const [nickUI, setNickUI] = useState<string>(() => {
    try { return localStorage.getItem('archei:nick') || '' } catch { return '' }
  })
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'archei:nick' && typeof e.newValue === 'string') setNickUI(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // dato inventario
  const [inv, setInv] = useState<InventoryData>({ coins: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')

  // ====== LOAD ======
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        // prova API ufficiale
        const res = await fetch('/api/player/inventory', { cache:'no-store' })
        if (res.ok) {
          const js = await res.json()
          if (!alive) return
          setInv({
            coins: js?.data?.coins ?? 0,
            items: Array.isArray(js?.data?.items) ? js.data.items : [],
            capacity: js?.data?.capacity,
          })
          // sync locale
          saveLocal(js?.data ?? { coins:0, items:[] })
          return
        }
      } catch {}
      // fallback locale
      const local = await loadLocal()
      if (!alive) return
      setInv(local)
    })().finally(()=> alive && setLoading(false))
    return () => { alive = false }
  }, [])

  // ====== SAVE ======
  async function persist(next: InventoryData) {
    setSaving(true)
    setInv(next)
    saveLocal(next)
    try {
      const res = await fetch('/api/player/inventory', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error('save fail')
    } catch {
      // ok, rimane in localStorage
    } finally {
      setSaving(false)
    }
  }

  // ====== azioni rapide ======
  function addCoins(delta:number) {
    const next = { ...inv, coins: clamp((inv.coins||0)+delta, 0, 1_000_000) }
    persist(next)
  }
  function toggleEquip(id:string) {
    const next = {
      ...inv,
      items: inv.items.map(it => it.id===id ? { ...it, equipped: !it.equipped } : it)
    }
    persist(next)
  }
  function incQty(id:string, d:number) {
    const next = {
      ...inv,
      items: inv.items.map(it => it.id===id ? { ...it, qty: clamp((it.qty||0)+d,0,999) } : it)
    }
    persist(next)
  }
  function quickAdd() {
    const name = prompt('Nome oggetto?')
    if (!name) return
    const next: InventoryData = {
      ...inv,
      items: [...inv.items, { id:uid(), name, qty:1 }]
    }
    persist(next)
  }
  function removeItem(id:string) {
    if (!confirm('Rimuovere questo oggetto?')) return
    const next = { ...inv, items: inv.items.filter(x=>x.id!==id) }
    persist(next)
  }

  // invio in chat (opzionale)
  function sendToChat(text:string) {
    if (!config || !connected) return
    const who = (nickUI && nickUI.trim()) ? nickUI.trim() : (config.nick || 'Player')
    send?.({ t:'chat:msg', room: config.room, nick: who, text, ts: Date.now(), channel: 'global' })
  }

  // ====== view ======
  const itemsFiltered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    let list = inv.items
    if (q) list = list.filter(it => (it.name||'').toLowerCase().includes(q) || (it.tags||[]).some(t => t.toLowerCase().includes(q)))
    // mostra equipaggiati in alto
    return list.slice().sort((a,b)=> Number(!!b.equipped)-Number(!!a.equipped))
  }, [inv.items, filter])

  const top = itemsFiltered.slice(0, 5)
  const moreCount = Math.max(0, itemsFiltered.length - top.length)

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Inventario</div>
        <div className="flex items-center gap-2">
          <input
            className="input w-36"
            placeholder="Filtra oggetti…"
            value={filter}
            onChange={e=>setFilter(e.target.value)}
          />
          <Link href="/player/inventory" className="btn !bg-zinc-800">Apri inventario</Link>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-500">Carico inventario…</div>
      ) : (
        <>
          {/* monete */}
          <div className="rounded-xl border border-zinc-800 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-400">Monete</div>
              <div className="flex items-center gap-2">
                <button className="btn !bg-zinc-800" onClick={()=>addCoins(-10)}>-10</button>
                <button className="btn !bg-zinc-800" onClick={()=>addCoins(-1)}>-1</button>
                <div className="font-semibold min-w-10 text-center">{inv.coins ?? 0}</div>
                <button className="btn !bg-zinc-800" onClick={()=>addCoins(1)}>+1</button>
                <button className="btn !bg-zinc-800" onClick={()=>addCoins(10)}>+10</button>
              </div>
            </div>
          </div>

          {/* azioni veloci */}
          <div className="flex items-center gap-2">
            <button className="btn" onClick={quickAdd}>+ Aggiungi oggetto</button>
            <button className="btn !bg-zinc-800" onClick={()=>sendToChat(`🧰 Inventario: ${inv.items.length} oggetti, monete: ${inv.coins||0}`)} disabled={!connected}>
              Invia riepilogo in chat
            </button>
          </div>

          {/* elenco breve */}
          <div className="rounded-xl border border-zinc-800 p-2">
            {top.length===0 ? (
              <div className="text-sm text-zinc-500">Nessun oggetto.</div>
            ) : (
              <div className="space-y-2">
                {top.map(it=>(
                  <div key={it.id} className="rounded-md border border-zinc-800 p-2 bg-zinc-900/40">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {it.equipped ? '🗡️ ' : ''}{it.name}
                        </div>
                        {it.notes ? <div className="text-xs text-zinc-500 truncate">{it.notes}</div> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="btn !bg-zinc-800" title="−1" onClick={()=>incQty(it.id, -1)}>−</button>
                        <div className="w-8 text-center">{it.qty ?? 1}</div>
                        <button className="btn" title="+1" onClick={()=>incQty(it.id, +1)}>+</button>
                        <button className="btn" title={it.equipped?'Togli':'Equipaggia'} onClick={()=>toggleEquip(it.id)}>
                          {it.equipped ? '✓' : '•'}
                        </button>
                        <button className="btn !bg-zinc-800" title="Elimina" onClick={()=>removeItem(it.id)}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
                {moreCount>0 && (
                  <div className="text-xs text-zinc-500">…e altri {moreCount}. Apri l’inventario per vedere tutto.</div>
                )}
              </div>
            )}
          </div>

          <div className="text-xs text-zinc-500">
            {saving ? 'Salvataggio…' : 'Pronto.'}
          </div>
        </>
      )}
    </div>
  )
}
