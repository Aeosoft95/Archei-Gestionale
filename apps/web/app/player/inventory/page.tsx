'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import SideNav from '@/components/SideNav'
import BackButton from '@/components/BackButton'
import LogoutButton from '@/components/LogoutButton'
import type { InventoryData, InvItem } from '@/components/QuickInventoryBar'

const uid = () => Math.random().toString(36).slice(2,9)
const clamp = (n:number,a:number,b:number)=>Math.max(a,Math.min(b,n))
const LS_KEY = 'archei:player:inventory'

async function loadLocal(): Promise<InventoryData> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { coins: 0, items: [] }
    const js = JSON.parse(raw)
    return { coins: js.coins||0, items: Array.isArray(js.items)?js.items:[], capacity: js.capacity }
  } catch { return { coins:0, items:[] } }
}
async function saveLocal(d:InventoryData){ try{ localStorage.setItem(LS_KEY, JSON.stringify(d)) }catch{} }

export default function InventoryPage(){
  const [data,setData] = useState<InventoryData>({ coins:0, items:[], capacity: undefined })
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [q,setQ] = useState('')

  useEffect(()=>{
    let alive = true
    ;(async ()=>{
      try{
        const res = await fetch('/api/player/inventory', { cache:'no-store' })
        if (res.ok){
          const js = await res.json()
          if (!alive) return
          setData({ coins: js?.data?.coins??0, items: Array.isArray(js?.data?.items)?js.data.items:[], capacity: js?.data?.capacity })
          saveLocal(js?.data ?? { coins:0, items:[] })
          return
        }
      }catch{}
      const local = await loadLocal()
      if (!alive) return
      setData(local)
    })().finally(()=> alive && setLoading(false))
    return ()=>{ alive=false }
  },[])

  async function persist(next:InventoryData){
    setSaving(true); setData(next); saveLocal(next)
    try{
      const res = await fetch('/api/player/inventory', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(next)
      })
      if (!res.ok) throw new Error('save error')
      alert('Inventario salvato ✅')
    }catch{ /* resta in locale */ }
    finally{ setSaving(false) }
  }

  function addItem(){
    const name = prompt('Nome oggetto?')
    if (!name) return
    persist({ ...data, items: [...data.items, { id:uid(), name, qty:1 }] })
  }
  function updateItem(id:string, patch:Partial<InvItem>){
    persist({ ...data, items: data.items.map(it=> it.id===id ? { ...it, ...patch } : it) })
  }
  function removeItem(id:string){
    if (!confirm('Rimuovere questo oggetto?')) return
    persist({ ...data, items: data.items.filter(x=>x.id!==id) })
  }

  const filtered = useMemo(()=>{
    const s=q.trim().toLowerCase()
    if (!s) return data.items
    return data.items.filter(it =>
      (it.name||'').toLowerCase().includes(s) ||
      (it.notes||'').toLowerCase().includes(s) ||
      (it.tags||[]).some(t=>t.toLowerCase().includes(s))
    )
  },[q,data.items])

  const totalWeight = useMemo(()=> (data.items||[]).reduce((acc,it)=> acc + (it.weight||0)*(it.qty||1), 0), [data.items])
  const overload = data.capacity ? Math.max(0, totalWeight - data.capacity) : 0

  if (loading) {
    return (
      <div className="flex">
        <aside className="bg-zinc-950/60 border-r border-zinc-800 p-4 w-64 hidden md:block">
          <div className="text-xl font-semibold mb-4">Menu</div>
          <SideNav />
        </aside>
        <main className="flex-1 p-6">Caricamento…</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <aside className="bg-zinc-950/60 border-r border-zinc-800 p-4 w-64 hidden md:block">
        <div className="text-xl font-semibold mb-4">Menu</div>
        <SideNav />
      </aside>
      <div className="flex-1">
        <div className="border-b border-zinc-800 p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BackButton />
            <div className="text-lg font-semibold">Inventario</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/tools/chat" className="btn !bg-zinc-800">↩︎ Chat</Link>
            <button className="btn" onClick={()=>persist(data)} disabled={saving}>{saving?'Salvo…':'💾 Salva'}</button>
            <LogoutButton />
          </div>
        </div>

        <main className="max-w-5xl mx-auto p-4 space-y-4">
          {/* barra superiore */}
          <div className="card">
            <div className="grid md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <div className="label">Cerca</div>
                <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="nome, tag, note…" />
              </div>
              <div>
                <div className="label">Keran</div>
                <div className="flex items-center gap-2">
                  <button className="btn !bg-zinc-800" onClick={()=>persist({...data, coins: clamp((data.coins||0)-10,0,1_000_000)})}>-10</button>
                  <button className="btn !bg-zinc-800" onClick={()=>persist({...data, coins: clamp((data.coins||0)-1,0,1_000_000)})}>-1</button>
                  <input className="input text-center w-24" type="number" value={data.coins||0}
                         onChange={e=>persist({...data, coins: clamp(parseInt(e.target.value||'0'),0,1_000_000)})}/>
                  <button className="btn !bg-zinc-800" onClick={()=>persist({...data, coins: clamp((data.coins||0)+1,0,1_000_000)})}>+1</button>
                  <button className="btn !bg-zinc-800" onClick={()=>persist({...data, coins: clamp((data.coins||0)+10,0,1_000_000)})}>+10</button>
                </div>
              </div>
              <div>
                <div className="label">Capacità (peso max, opz.)</div>
                <input className="input text-center" type="number" value={data.capacity ?? ''}
                       placeholder="—"
                       onChange={e=>persist({...data, capacity: e.target.value==='' ? undefined : clamp(parseInt(e.target.value||'0'),0,9999) })}/>
                <div className="text-xs text-zinc-500 mt-1">
                  Peso: <b>{totalWeight.toFixed(1)}</b>{data.capacity? <> / {data.capacity} {overload>0 && <span className="text-amber-400">(+{overload.toFixed(1)})</span>}</> : null}
                </div>
              </div>
            </div>
          </div>

          {/* elenco oggetti */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Oggetti</div>
              <button className="btn" onClick={addItem}>+ Aggiungi</button>
            </div>
            {filtered.length===0 ? (
              <div className="text-sm text-zinc-500">Nessun oggetto.</div>
            ) : (
              <div className="space-y-2">
                {filtered.map(it=>(
                  <div key={it.id} className="rounded-xl border border-zinc-800 p-2">
                    <div className="grid md:grid-cols-6 gap-2 items-start">
                      <div className="md:col-span-2">
                        <div className="label">Nome</div>
                        <input className="input" value={it.name} onChange={e=>updateItem(it.id, { name:e.target.value })}/>
                      </div>
                      <div>
                        <div className="label">Quantità</div>
                        <input className="input text-center" type="number" value={it.qty||1}
                               onChange={e=>updateItem(it.id, { qty: clamp(parseInt(e.target.value||'1'),0,999) })}/>
                      </div>
                      <div>
                        <div className="label">Peso (per unità)</div>
                        <input className="input text-center" type="number" step="0.1" value={it.weight ?? 0}
                               onChange={e=>updateItem(it.id, { weight: Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : 0 })}/>
                      </div>
                      <div className="flex items-end">
                        <label className="label flex items-center gap-2">
                          <input type="checkbox" checked={!!it.equipped} onChange={e=>updateItem(it.id, { equipped:e.target.checked })}/>
                          Equipaggiato
                        </label>
                      </div>
                      <div className="flex items-end justify-end gap-2">
                        <button className="btn !bg-zinc-800" onClick={()=>removeItem(it.id)}>Elimina</button>
                      </div>
                      <div className="md:col-span-6">
                        <div className="label">Note / Tag</div>
                        <input className="input" value={it.notes||''}
                               onChange={e=>updateItem(it.id, { notes:e.target.value })} placeholder="#pozione #consumabile …"/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
