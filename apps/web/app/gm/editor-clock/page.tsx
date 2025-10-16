'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useWS, useWSMessages } from '@/components/ws/WSProvider'

type EffectMode = 'none' | 'glow' | 'pulse'
type ThemeKey = 'indigo' | 'teal' | 'rose' | 'amber' | 'violet' | 'emerald' | 'cyan' | 'zinc'

type ClockItem = {
  id: string
  name: string
  value: number
  max: number
  visible: boolean
  nextId?: string | null
  icon?: string
  theme?: ThemeKey
  effect?: EffectMode
  compact?: boolean
}

const LS_CK = 'archei:gm:clocks'
const uid = () => Math.random().toString(36).slice(2, 9)
const clamp = (v:number, min:number, max:number) => Math.max(min, Math.min(max, v))

const THEMES: Record<ThemeKey, { ring: string; track: string; glow: string }> = {
  indigo:  { ring: '#6366f1', track: '#27272a', glow: 'shadow-[0_0_24px_#6366f180]' },
  teal:    { ring: '#14b8a6', track: '#27272a', glow: 'shadow-[0_0_24px_#14b8a680]' },
  rose:    { ring: '#f43f5e', track: '#27272a', glow: 'shadow-[0_0_24px_#f43f5e80]' },
  amber:   { ring: '#f59e0b', track: '#27272a', glow: 'shadow-[0_0_24px_#f59e0b80]' },
  violet:  { ring: '#8b5cf6', track: '#27272a', glow: 'shadow-[0_0_24px_#8b5cf680]' },
  emerald: { ring: '#10b981', track: '#27272a', glow: 'shadow-[0_0_24px_#10b98180]' },
  cyan:    { ring: '#06b6d4', track: '#27272a', glow: 'shadow-[0_0_24px_#06b6d480]' },
  zinc:    { ring: '#a1a1aa', track: '#27272a', glow: 'shadow-[0_0_24px_#a1a1aa80]' },
}

export default function GMClockEditorPage() {
  const { config, connected, connecting, error, openSetup, send } = useWS()

  const [items, setItems] = useState<ClockItem[]>([])
  const [name, setName] = useState('')
  const [val, setVal] = useState(0)
  const [max, setMax] = useState(4)
  const [visible, setVisible] = useState(true)
  const [newNextId, setNewNextId] = useState<string | ''>('')
  const [newIcon, setNewIcon] = useState('🕒')
  const [newTheme, setNewTheme] = useState<ThemeKey>('indigo')
  const [newEffect, setNewEffect] = useState<EffectMode>('none')
  const [newCompact, setNewCompact] = useState(false)

  const [autoPublish, setAutoPublish] = useState(true)
  const [followDisplay, setFollowDisplay] = useState(true)

  const lastPublishAt = useRef(0)
  const lastPublishPayload = useRef<string>('')

  const [lastUpdatedId, setLastUpdatedId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_CK) || '[]') as ClockItem[]
      if (Array.isArray(saved)) {
        setItems(saved.map(n => ({
          visible: true,
          nextId: null,
          icon: '🕒',
          theme: 'indigo',
          effect: 'none',
          compact: false,
          ...n
        })))
      }
    } catch {}
    localStorage.setItem('archei:role', 'gm')
  }, [])
  useEffect(() => { localStorage.setItem(LS_CK, JSON.stringify(items)) }, [items])

  useWSMessages((msg) => {
    if (msg.t === 'DISPLAY_CLOCKS_STATE' && Array.isArray(msg.clocks)) {
      if (!followDisplay) return
      const incomingStr = JSON.stringify(msg.clocks)
      if (Date.now() - lastPublishAt.current < 1500 && incomingStr === lastPublishPayload.current) return
      const incoming = msg.clocks.map((c:any, i:number) => ({
        id: String(c.id || uid()+i),
        name: String(c.name ?? 'Clock'),
        value: Number(c.value ?? 0),
        max: Number(c.max ?? 4),
        visible: true,
        nextId: null,
        icon: '🕒',
        theme: 'indigo',
        effect: 'none',
        compact: false,
      })) as ClockItem[]
      setItems(incoming)
    }
  })

  function visibleFrom(list: ClockItem[]) {
    return list.filter(i => i.visible).map(({ id, name, value, max }) => ({ id, name, value, max }))
  }
  function publishFrom(list?: ClockItem[]) {
    if (!config) return
    const src = list ?? items
    const clocks = visibleFrom(src)
    const payload = { t:'DISPLAY_CLOCKS_STATE', room: config.room, clocks }
    lastPublishPayload.current = JSON.stringify(clocks)
    lastPublishAt.current = Date.now()
    send(payload)
  }
  function onChanged(next?: ClockItem[]) { if (autoPublish) publishFrom(next) }

  // reset solo se concatenato; altrimenti cappo a max
  function propagateChains(list: ClockItem[]): ClockItem[] {
    const next = list.map(x => ({ ...x }))
    const idxById = new Map(next.map((c,i)=>[c.id,i]))
    const touched = new Set<string>()
    let iter = 0
    const MAX_ITERS = next.length * 4 + 10

    function completeAt(i:number){
      const c = next[i]
      if (!c || c.value < c.max) return false
      if (c.nextId && idxById.has(c.nextId)) {
        c.value = 0
        const j = idxById.get(c.nextId)!; next[j].value = clamp(next[j].value + 1, 0, next[j].max)
        touched.add(next[j].id)
        return true
      } else { c.value = c.max; return false }
    }
    let any = true
    while (any && iter++ < MAX_ITERS) {
      any = false
      for (let i=0;i<next.length;i++){
        if (next[i].value >= next[i].max) {
          if (touched.has(next[i].id)) continue
          if (completeAt(i)) any = true
        }
      }
    }
    return next
  }

  function addClock(){
    if (!name.trim()) return
    const it: ClockItem = {
      id: uid(),
      name: name.trim(),
      value: clamp(val,0,max||1),
      max: Math.max(1,max),
      visible,
      nextId: newNextId || null,
      icon: newIcon || '🕒',
      theme: newTheme,
      effect: newEffect,
      compact: newCompact,
    }
    setItems(prev => {
      const base = [...prev, it]
      const chained = propagateChains(base)
      onChanged(chained)
      return chained
    })
    setName(''); setVal(0); setMax(4); setVisible(true)
    setNewNextId(''); setNewIcon('🕒'); setNewTheme('indigo'); setNewEffect('none'); setNewCompact(false)
  }

  function upd(i:number, patch:Partial<ClockItem>){
    setItems(prev => {
      const base = prev.map((c,idx)=> idx===i ? {
        ...c,
        ...patch,
        value: clamp(patch.value ?? c.value, 0, (patch.max ?? c.max)),
        max: Math.max(1, (patch.max ?? c.max)),
        nextId: (patch.nextId === '' ? null : (patch.nextId ?? c.nextId)),
      } : c)
      const chained = propagateChains(base)
      onChanged(chained)
      const id = base[i]?.id; if (id) { setLastUpdatedId(id); setTimeout(()=>setLastUpdatedId(null), 400) }
      return chained
    })
  }

  function del(i:number){
    setItems(prev => {
      const removedId = prev[i]?.id
      const base = prev.filter((_,idx)=> idx!==i).map(c => c.nextId === removedId ? ({...c, nextId:null}) : c)
      const chained = propagateChains(base)
      onChanged(chained)
      return chained
    })
  }
  function dup(i:number){
    setItems(prev => {
      const c = prev[i]
      const copy: ClockItem = { ...c, id: uid(), name: c.name+' (copy)' }
      const base = [...prev.slice(0,i+1), copy, ...prev.slice(i+1)]
      const chained = propagateChains(base)
      onChanged(chained)
      return chained
    })
  }

  function incAll(n:number){
    setItems(prev => {
      const base = prev.map(c=>({...c, value:clamp(c.value+n,0,c.max)}))
      const chained = propagateChains(base)
      onChanged(chained)
      return chained
    })
  }
  function resetAll(){
    setItems(prev => {
      const base = prev.map(c=>({...c, value:0}))
      const chained = propagateChains(base)
      onChanged(chained)
      return chained
    })
  }
  function clearAll(){
    setItems(prev => {
      const base:ClockItem[] = []
      onChanged(base)
      return base
    })
  }
  function sortByProgress(){ setItems(prev => [...prev].sort((a,b)=>(b.value/b.max)-(a.value/a.max))) }

  const status = useMemo(() => {
    const color = connecting ? 'bg-yellow-500' : connected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-zinc-600'
    const label = connecting ? 'conn…' : connected ? 'online' : error ? 'errore' : 'offline'
    return <div className="flex items-center gap-2 text-xs text-zinc-400"><div className={`w-2.5 h-2.5 rounded-full ${color}`} />{label}</div>
  }, [connected, connecting, error])

  const concatOptions = useMemo(() => items.map(c => ({ id: c.id, name: c.name })), [items])

  return (
    <div className="min-h-screen flex flex-col">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col gap-4">
        {/* TOPBAR */}
        <div className="border-b border-zinc-800 p-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-lg font-semibold truncate">ARCHEI — Editor Clock</div>
            <button className="btn !bg-zinc-800 shrink-0" onClick={openSetup}>WS</button>
            {status}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <label className="label flex items-center gap-2">
              <input type="checkbox" checked={autoPublish} onChange={e=>setAutoPublish(e.target.checked)} />
              Auto-publish
            </label>
            <label className="label flex items-center gap-2">
              <input type="checkbox" checked={followDisplay} onChange={e=>setFollowDisplay(e.target.checked)} />
              Segui Display
            </label>
            <span className="text-zinc-500">GM</span>
          </div>
        </div>

        {/* EDITOR */}
        <div className="grid xl:grid-cols-[1fr_1.3fr] gap-4 min-w-0">
          {/* Form nuovo clock */}
          <div className="card space-y-3 min-w-0">
            <div className="font-semibold">Nuovo Clock</div>
            <div className="flex flex-wrap gap-2">
              <input className="input basis-64 grow min-w-0" placeholder="Nome" value={name} onChange={e=>setName(e.target.value)} />
              <input className="input basis-28 grow max-w-[120px]" type="number" placeholder="Max" value={max} onChange={e=>setMax(parseInt(e.target.value||'0'))} />
              <input className="input basis-28 grow max-w-[120px]" type="number" placeholder="Valore" value={val} onChange={e=>setVal(parseInt(e.target.value||'0'))} />
              <label className="label flex items-center gap-2 basis-full sm:basis-auto">
                <input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)} />
                Visibile ai player
              </label>

              <div className="flex items-center gap-2 basis-40">
                <div className="label mb-0">Icona</div>
                <input className="input" value={newIcon} onChange={e=>setNewIcon(e.target.value)} placeholder="🕒" />
              </div>
              <div className="flex items-center gap-2 basis-40">
                <div className="label mb-0">Tema</div>
                <select className="input" value={newTheme} onChange={e=>setNewTheme(e.target.value as ThemeKey)}>
                  {Object.keys(THEMES).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 basis-48">
                <div className="label mb-0">Effetto</div>
                <select className="input" value={newEffect} onChange={e=>setNewEffect(e.target.value as EffectMode)}>
                  <option value="none">nessuno</option>
                  <option value="glow">bagliore</option>
                  <option value="pulse">pulse</option>
                </select>
              </div>

              <div className="flex items-center gap-2 basis-full sm:basis-auto">
                <div className="label mb-0">Concatena a</div>
                <select className="input" value={newNextId} onChange={e=>setNewNextId(e.target.value)}>
                  <option value="">— Nessuno —</option>
                  {concatOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                </select>
              </div>

              <label className="label flex items-center gap-2 basis-full sm:basis-auto">
                <input type="checkbox" checked={newCompact} onChange={e=>setNewCompact(e.target.checked)} />
                Crea in modalità “Solo orologio”
              </label>

              <button className="btn basis-full sm:basis-auto" onClick={addClock} disabled={!connected || !name.trim()}>
                + Crea {autoPublish ? '& Pubblica' : ''}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
              <button className="btn" onClick={()=>incAll(+1)} disabled={!connected}>+1 tutti</button>
              <button className="btn" onClick={()=>incAll(-1)} disabled={!connected}>−1 tutti</button>
              <button className="btn" onClick={resetAll} disabled={!connected}>Reset tutti</button>
              <button className="btn" onClick={sortByProgress}>Ordina per progresso</button>
              <button className="btn" onClick={()=>publishFrom()} disabled={!connected}>Invia a Display</button>
              <button className="btn !bg-zinc-800" onClick={clearAll} disabled={!connected}>Svuota</button>
            </div>
          </div>

          {/* Lista clocks */}
          <div className="card space-y-4 min-w-0">
            <div className="font-semibold">Clocks</div>

            {items.length===0 ? (
              <div className="text-sm text-zinc-500">Nessun clock.</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((c,i)=>{
                  const pct = Math.round((c.value/(c.max||1))*100)
                  const theme = THEMES[c.theme || 'indigo']
                  const bg = `conic-gradient(${theme.ring} ${pct*3.6}deg, ${theme.track} 0deg)`
                  const ringFx =
                    c.effect === 'pulse' && lastUpdatedId === c.id ? 'animate-pulse' :
                    c.effect === 'glow'  && lastUpdatedId === c.id ? theme.glow : ''

                  // COMPATTO
                  if (c.compact) {
                    return (
                      <div key={c.id} className="relative rounded-2xl border border-zinc-800 p-3 min-w-0">
                        <button
                          className="absolute right-2 top-2 text-xs text-zinc-400 hover:text-zinc-200"
                          title="Mostra controlli"
                          onClick={()=>upd(i,{compact:false})}
                        >
                          ✎
                        </button>

                        <div className="mb-3 font-medium truncate">{c.name}</div>
                        <div className="flex items-center justify-center">
                          <div className={`relative w-40 h-40 rounded-full p-1 ${ringFx}`} style={{ backgroundImage: bg }}>
                            <div className="absolute inset-1 rounded-full bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center">
                              <div className="text-4xl leading-none">{c.icon || '🕒'}</div>
                              <div className="mt-1 text-sm font-semibold">{pct}%</div>
                              <div className="text-[10px] text-zinc-400">{c.value}/{c.max}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // COMPLETO
                  return (
                    <div key={c.id} className="rounded-2xl border border-zinc-800 p-3 min-w-0">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-medium truncate">{c.name}</div>
                        <label className="label flex items-center gap-2">
                          <input type="checkbox" checked={!!c.compact} onChange={e=>upd(i,{compact:e.target.checked})}/>
                          Solo orologio
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <input className="input basis-40 grow min-w-0" value={c.name} onChange={e=>upd(i,{name:e.target.value})}/>
                        <input className="input w-20" type="number" value={c.max} onChange={e=>upd(i,{max:Math.max(1,parseInt(e.target.value||'1'))})}/>
                        <input className="input w-20" type="number" value={c.value} onChange={e=>upd(i,{value:parseInt(e.target.value||'0')})}/>
                        <label className="label flex items-center gap-2">
                          <input type="checkbox" checked={c.visible} onChange={e=>upd(i,{visible:e.target.checked})}/>
                          Visibile
                        </label>
                        <div className="flex gap-1 ml-auto">
                          <button className="btn" onClick={()=>upd(i,{value:clamp(c.value-1,0,c.max)})}>−1</button>
                          <button className="btn" onClick={()=>upd(i,{value:clamp(c.value+1,0,c.max)})}>+1</button>
                        </div>
                        <div className="flex gap-1">
                          <button className="btn" onClick={()=>dup(i)}>Duplica</button>
                          <button className="btn !bg-zinc-800" onClick={()=>del(i)}>✕</button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="label mb-0">Icona</div>
                          <input className="input w-20 text-center" value={c.icon || '🕒'} onChange={e=>upd(i,{icon:e.target.value})}/>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="label mb-0">Tema</div>
                          <select className="input" value={c.theme || 'indigo'} onChange={e=>upd(i,{theme: e.target.value as ThemeKey})}>
                            {Object.keys(THEMES).map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="label mb-0">Effetto</div>
                          <select className="input" value={c.effect || 'none'} onChange={e=>upd(i,{effect: e.target.value as EffectMode})}>
                            <option value="none">nessuno</option>
                            <option value="glow">bagliore</option>
                            <option value="pulse">pulse</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="label mb-0">Concatena a</div>
                          <select className="input" value={c.nextId || ''} onChange={e=>upd(i,{ nextId: e.target.value })}>
                            <option value="">— Nessuno —</option>
                            {concatOptions.filter(opt => opt.id !== c.id).map(opt =>
                              <option key={opt.id} value={opt.id}>{opt.name}</option>
                            )}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-center">
                        <div className={`relative w-40 h-40 rounded-full p-1 ${ringFx}`} style={{ backgroundImage: `conic-gradient(${theme.ring} ${pct*3.6}deg, ${theme.track} 0deg)` }}>
                          <div className="absolute inset-1 rounded-full bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center">
                            <div className="text-4xl leading-none">{c.icon || '🕒'}</div>
                            <div className="mt-1 text-sm font-semibold">{pct}%</div>
                            <div className="text-[10px] text-zinc-400">{c.value}/{c.max}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
