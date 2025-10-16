'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useWS } from '@/components/ws/WSProvider'

type MonsterType = 'Minore' | 'Standard' | 'Boss' | 'Colossale'
type Elemento =
  | 'Fuoco' | 'Acqua' | 'Fulmine' | 'Terra' | 'Luce' | 'Ombra'

// ⬇️ Clock ora ha anche "value" per tracciare l'avanzamento della fase
type Clock = { id:string; name:string; segments:number; value:number }
type Abilita = { id:string; text:string }

type Mostro = {
  name: string
  img?: string
  tipo: MonsterType
  livello: number
  elemento: Elemento
  hp: number
  dif: number
  danno: number
  pool: number
  soglia: number
  foc: number
  abilita: Abilita[]
  clocks: Clock[]
  noteGM?: string
  descrizionePubblica?: string
}

const ELEM_TABLE: Record<Elemento, { debole:'Fuoco'|'Acqua'|'Fulmine'|'Terra'|'Luce'|'Ombra', resistente:'Fuoco'|'Acqua'|'Fulmine'|'Terra'|'Luce'|'Ombra' }> = {
  Fuoco:   { debole:'Acqua',   resistente:'Fuoco' },
  Acqua:   { debole:'Fulmine', resistente:'Fuoco' },
  Fulmine: { debole:'Terra',   resistente:'Fulmine' },
  Terra:   { debole:'Acqua',   resistente:'Fulmine' },
  Luce:    { debole:'Ombra',   resistente:'Luce' },
  Ombra:   { debole:'Luce',    resistente:'Ombra' },
}

// ===== util calcoli =====
function sogliaPerPool(poolTeorico:number){
  if (poolTeorico <= 0) return 6
  if (poolTeorico <= 5) return 6
  if (poolTeorico <= 9) return 5
  if (poolTeorico <= 19) return 4
  return 3
}
function clamp(n:number, a:number, b:number){ return Math.max(a, Math.min(b, n)) }
function uid(){ return Math.random().toString(36).slice(2,9) }

// chiavi LS namespaced per stanza
const LS_KEY = (room:string) => `archei:gm:monster:${room||'default'}`
const LS_LIST_KEY = (room:string) => `archei:gm:monster:list:${room||'default'}`

export default function GeneratoreMostriPage(){
  const { config, connected, connecting, error, openSetup, send } = useWS()
  const room = config?.room || 'default'

  // stato
  const [name, setName] = useState('')
  const [img, setImg] = useState('')
  const [tipo, setTipo] = useState<MonsterType>('Standard')
  const [livello, setLivello] = useState(5)
  const [elemento, setElemento] = useState<Elemento>('Terra')

  const [hp, setHp] = useState(18)
  const [dif, setDif] = useState(15)
  const [danno, setDanno] = useState(3)
  const [pool, setPool] = useState(7)
  const [soglia, setSoglia] = useState(5)
  const [foc, setFoc] = useState(4)

  const [abilita, setAbilita] = useState<Abilita[]>([])
  const [clocks, setClocks] = useState<Clock[]>([])
  const [noteGM, setNoteGM] = useState('')
  const [descrPubblica, setDescrPubblica] = useState('')

  // archivio mostri salvati (locale per stanza)
  const [saved, setSaved] = useState<Mostro[]>([])
  const [saveName, setSaveName] = useState('') // sovrascrive nome se vuoi salvare con un alias diverso

  // autosave debounce
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleSave = (fn:()=>void) => { if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(fn, 250) }

  // ripristino per stanza (mostro corrente + lista)
  useEffect(()=>{ try{
    const raw = localStorage.getItem(LS_KEY(room))
    if (raw) {
      const m = JSON.parse(raw) as Partial<Mostro>
      if (m.name) setName(m.name)
      if (m.img) setImg(m.img)
      if (m.tipo) setTipo(m.tipo)
      if (typeof m.livello === 'number') setLivello(m.livello)
      if (m.elemento) setElemento(m.elemento)
      if (typeof m.hp === 'number') setHp(m.hp)
      if (typeof m.dif === 'number') setDif(m.dif)
      if (typeof m.danno === 'number') setDanno(m.danno)
      if (typeof m.pool === 'number') setPool(m.pool)
      if (typeof m.soglia === 'number') setSoglia(m.soglia)
      if (typeof m.foc === 'number') setFoc(m.foc)
      if (Array.isArray(m.abilita)) setAbilita(m.abilita.map(a=>({ id:a.id||uid(), text:a.text||'' })))
      if (Array.isArray(m.clocks)) setClocks(m.clocks.map(c=>({
        id: c.id||uid(),
        name: c.name||'Clock',
        segments: clamp(Number(c.segments)||4,1,32),
        value: clamp(Number((c as any).value ?? 0), 0, clamp(Number(c.segments)||4,1,32))
      })))
      if (m.noteGM) setNoteGM(m.noteGM)
      if (m.descrizionePubblica) setDescrPubblica(m.descrizionePubblica)
    }

    const rawList = localStorage.getItem(LS_LIST_KEY(room))
    if (rawList) {
      const arr = JSON.parse(rawList) as Mostro[]
      // normalizza clocks per retrocompatibilità
      const norm = arr.map(mm => ({
        ...mm,
        clocks: (mm.clocks||[]).map(c=>({
          id: c.id||uid(),
          name: c.name||'Clock',
          segments: clamp(Number(c.segments)||4, 1, 32),
          value: clamp(Number((c as any).value ?? 0), 0, clamp(Number(c.segments)||4,1,32))
        }))
      }))
      setSaved(norm)
    }
  }catch{} }, [room])

  // persistenza mostro corrente
  useEffect(()=>{ scheduleSave(()=> persist()) },
    [name,img,tipo,livello,elemento,hp,dif,danno,pool,soglia,foc,abilita,clocks,noteGM,descrPubblica,room]
  )
  function persist(){
    const pack: Mostro = {
      name, img:img||undefined, tipo, livello, elemento,
      hp, dif, danno, pool, soglia, foc,
      abilita, clocks,
      noteGM: noteGM||undefined,
      descrizionePubblica: descrPubblica||undefined,
    }
    localStorage.setItem(LS_KEY(room), JSON.stringify(pack))
  }

  // gestioni archivio
  function saveCurrentToList(){
    const pack: Mostro = {
      name: (saveName.trim() || name || 'Mostro senza nome'),
      img: img || undefined,
      tipo, livello, elemento, hp, dif, danno, pool, soglia, foc,
      abilita: abilita.map(a=>({ ...a })),
      clocks: clocks.map(c=>({ ...c, value: clamp(c.value, 0, c.segments) })),
      noteGM: noteGM || undefined,
      descrizionePubblica: descrPubblica || undefined
    }
    // se esiste già con lo stesso nome, sostituisci
    const next = (() => {
      const idx = saved.findIndex(x => (x.name || '').toLowerCase() === pack.name.toLowerCase())
      if (idx >= 0) {
        const arr = [...saved]
        arr[idx] = pack
        return arr
      }
      return [...saved, pack]
    })()
    setSaved(next)
    localStorage.setItem(LS_LIST_KEY(room), JSON.stringify(next))
    setSaveName('')
  }
  function loadFromList(nm:string){
    const mm = saved.find(x => x.name === nm)
    if (!mm) return
    setName(mm.name||'')
    setImg(mm.img||'')
    setTipo(mm.tipo)
    setLivello(mm.livello)
    setElemento(mm.elemento)
    setHp(mm.hp)
    setDif(mm.dif)
    setDanno(mm.danno)
    setPool(mm.pool)
    setSoglia(mm.soglia)
    setFoc(mm.foc)
    setAbilita((mm.abilita||[]).map(a=>({ id:a.id||uid(), text:a.text||'' })))
    setClocks((mm.clocks||[]).map(c=>({ id:c.id||uid(), name:c.name||'Clock', segments:clamp(Number(c.segments)||4,1,32), value:clamp(Number((c as any).value ?? 0),0, clamp(Number(c.segments)||4,1,32)) })))
    setNoteGM(mm.noteGM||'')
    setDescrPubblica(mm.descrizionePubblica||'')
  }
  function deleteFromList(nm:string){
    const next = saved.filter(x => x.name !== nm)
    setSaved(next)
    localStorage.setItem(LS_LIST_KEY(room), JSON.stringify(next))
  }

  // calcolo automatico da livello
  function calcolaDaLivello(lvl:number, t:MonsterType){
    const L = clamp(lvl, 1, 20)
    const baseHP = 8 + (L*2)
    const baseDIF = 10 + L
    const baseDAN = 1 + Math.floor(L/3)
    const basePOOL = 4 + Math.floor(L/2)
    const baseFOC = 3 + Math.floor(L/4)
    const mod = (t==='Minore' ? 0.85 : t==='Standard' ? 1 : t==='Boss' ? 1.25 : 1.6)

    const HP = Math.ceil(baseHP * mod)
    const DIF = Math.ceil(baseDIF * (t==='Colossale' ? 1.2 : 1))
    const DAN = Math.max(1, Math.round(baseDAN * (t==='Boss'||t==='Colossale' ? 1.2 : 1)))
    const POOL = Math.max(1, Math.round(basePOOL * (t==='Minore' ? 0.9 : t==='Colossale' ? 1.2 : 1)))
    const SOGLIA = sogliaPerPool(POOL)
    const FOCV = Math.max(0, Math.round(baseFOC * (t==='Boss'||t==='Colossale'?1.2:1)))

    setHp(HP); setDif(DIF); setDanno(DAN); setPool(POOL); setSoglia(SOGLIA); setFoc(FOCV)
  }

  // ricalcola se cambiano tipo/livello
  useEffect(()=>{ calcolaDaLivello(livello, tipo) }, [livello, tipo])

  // ws status
  const status = useMemo(() => {
    const color = connecting ? 'bg-yellow-500' : connected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-zinc-600'
    const label = connecting ? 'conn…' : connected ? 'online' : error ? 'errore' : 'offline'
    return <div className="flex items-center gap-2 text-xs text-zinc-400"><div className={`w-2.5 h-2.5 rounded-full ${color}`} />{label}</div>
  }, [connected, connecting, error])

  // helpers abilità
  const addAb = ()=> setAbilita(a=>[...a, { id:uid(), text:'' }])
  const delAb = (id:string)=> setAbilita(a=>a.filter(x=>x.id!==id))
  const updAb = (id:string, text:string)=> setAbilita(a=>a.map(x=>x.id===id?{...x,text}:x))

  // helpers clock
  const addClock = ()=> setClocks(c=>[...c, { id:uid(), name:'Nuova Fase', segments:4, value:0 }])
  const delClock = (id:string)=> setClocks(c=>c.filter(x=>x.id!==id))
  const updClock = (id:string, patch:Partial<Clock>)=> setClocks(c=>c.map(x=>{
    if (x.id!==id) return x
    const seg = clamp(Number(patch.segments ?? x.segments), 1, 32)
    const val = clamp(Number(patch.value ?? x.value), 0, seg)
    return { ...x, ...patch, segments: seg, value: val }
  }))
  const incClock = (id:string, delta:number)=> setClocks(c=>c.map(x=>{
    if (x.id!==id) return x
    const val = clamp(x.value + delta, 0, x.segments)
    return { ...x, value: val }
  }))

  // invio rapido in chat: solo Nome + link ritratto cliccabile
  function sendToChat(){
    if (!config || !name.trim()) return
    const portrait = img?.trim()
    const parts = [`🗡️ Mostro: ${name.trim()}`]
    if (portrait) parts.push(` — 🖼️ Ritratto: ${portrait}`)
    const text = parts.join('')
    send({ t:'chat:msg', room: config.room, nick: config.nick, text, ts: Date.now(), channel:'global' })
  }

  // invio al “Display” come scena breve opzionale (immagine + titolo = nome + descrPubblica)
  function showToDisplay(){
    if (!config) return
    const images = img?.trim() ? [img.trim()] : []
    const title = name.trim() || undefined
    const text = (descrPubblica||'').trim() || undefined
    send({ t:'DISPLAY_SCENE_STATE', room: config.room, title, text, images })
  }

  return (
    <div className="min-h-screen flex flex-col gap-4">
      {/* TOPBAR */}
      <div className="border-b border-zinc-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">ARCHEI — Generatore Mostri</div>
          <button className="btn !bg-zinc-800" onClick={openSetup}>WS</button>
          {status}
        </div>
        <div className="text-xs text-zinc-500">GM</div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        {/* SINISTRA: form */}
        <div className="card space-y-4">
          <div className="font-semibold">Dati Mostro</div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="label">Nome</div>
              <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Es. Troll delle Caverne"/>
            </div>
            <div>
              <div className="label">Ritratto (URL)</div>
              <input className="input" value={img} onChange={e=>setImg(e.target.value)} placeholder="https://…"/>
            </div>

            <div>
              <div className="label">Tipo</div>
              <select className="input" value={tipo} onChange={e=>setTipo(e.target.value as MonsterType)}>
                <option>Minore</option>
                <option>Standard</option>
                <option>Boss</option>
                <option>Colossale</option>
              </select>
            </div>
            <div>
              <div className="label">Livello</div>
              <input className="input" type="number" value={livello} onChange={e=>setLivello(parseInt(e.target.value||'1'))}/>
            </div>

            <div>
              <div className="label">Elemento</div>
              <select className="input" value={elemento} onChange={e=>setElemento(e.target.value as Elemento)}>
                <option>Fuoco</option>
                <option>Acqua</option>
                <option>Fulmine</option>
                <option>Terra</option>
                <option>Luce</option>
                <option>Ombra</option>
              </select>
            </div>
            <div className="text-sm text-zinc-400 flex items-end">
              Debole: <span className="text-zinc-200 ml-1">{ELEM_TABLE[elemento]?.debole || '—'}</span>
              <span className="mx-2">•</span>
              Resistente: <span className="text-zinc-200 ml-1">{ELEM_TABLE[elemento]?.resistente || '—'}</span>
            </div>
          </div>

          {/* Stat con pulsanti +/- per HP e DIF */}
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <div className="label">HP</div>
              <div className="flex gap-2">
                <input className="input" type="number" value={hp} onChange={e=>setHp(parseInt(e.target.value||'0'))}/>
                <div className="flex gap-1">
                  <button className="btn" onClick={()=>setHp(h=>h+1)}>+1</button>
                  <button className="btn !bg-zinc-800" onClick={()=>setHp(h=>Math.max(0,h-1))}>−1</button>
                </div>
              </div>
            </div>
            <div>
              <div className="label">DIF</div>
              <div className="flex gap-2">
                <input className="input" type="number" value={dif} onChange={e=>setDif(parseInt(e.target.value||'0'))}/>
                <div className="flex gap-1">
                  <button className="btn" onClick={()=>setDif(d=>d+1)}>+1</button>
                  <button className="btn !bg-zinc-800" onClick={()=>setDif(d=>Math.max(0,d-1))}>−1</button>
                </div>
              </div>
            </div>
            <div>
              <div className="label">Danno (segmenti)</div>
              <input className="input" type="number" value={danno} onChange={e=>setDanno(parseInt(e.target.value||'0'))}/>
            </div>
            <div>
              <div className="label">Pool teorico</div>
              <input className="input" type="number" value={pool} onChange={e=>{ const p=parseInt(e.target.value||'0'); setPool(p); setSoglia(sogliaPerPool(p)) }}/>
            </div>
            <div>
              <div className="label">Soglia successi</div>
              <input className="input" type="number" value={soglia} onChange={e=>setSoglia(parseInt(e.target.value||'6'))}/>
            </div>
            <div>
              <div className="label">FOC</div>
              <input className="input" type="number" value={foc} onChange={e=>setFoc(parseInt(e.target.value||'0'))}/>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Abilità speciali (1–3)</div>
              <button className="btn" onClick={addAb}>+ Aggiungi</button>
            </div>
            <div className="space-y-2">
              {abilita.length===0 && <div className="text-sm text-zinc-500">Nessuna abilità.</div>}
              {abilita.map(a=>(
                <div key={a.id} className="flex items-center gap-2">
                  <input className="input flex-1" value={a.text} onChange={e=>updAb(a.id, e.target.value)} placeholder="Es. Rigenerazione: recupera 1 segmento/round."/>
                  <button className="btn !bg-zinc-800" onClick={()=>delAb(a.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* Clock con pulsanti +/- per il valore della fase */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Clock / Fasi</div>
              <button className="btn" onClick={addClock}>+ Aggiungi</button>
            </div>
            <div className="grid gap-2">
              {clocks.length===0 && <div className="text-sm text-zinc-500">Nessun clock.</div>}
              {clocks.map(c=>(
                <div key={c.id} className="flex flex-wrap items-center gap-2">
                  <input
                    className="input flex-1"
                    value={c.name}
                    onChange={e=>updClock(c.id,{name:e.target.value})}
                    placeholder="Es. Corpo, Ira, Teste rigenerative…"
                  />
                  <div className="flex items-center gap-2">
                    <div className="label mb-0">Segmenti</div>
                    <input
                      className="input w-24"
                      type="number"
                      value={c.segments}
                      onChange={e=>updClock(c.id,{segments:parseInt(e.target.value||'1')})}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="label mb-0">Valore</div>
                    <input
                      className="input w-24"
                      type="number"
                      value={c.value}
                      onChange={e=>updClock(c.id,{value:parseInt(e.target.value||'0')})}
                    />
                    <div className="flex gap-1">
                      <button className="btn" onClick={()=>incClock(c.id, +1)}>+1</button>
                      <button className="btn !bg-zinc-800" onClick={()=>incClock(c.id, -1)}>−1</button>
                    </div>
                  </div>
                  <button className="btn !bg-zinc-800" onClick={()=>delClock(c.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="label">Descrizione pubblica (facoltativa)</div>
              <textarea className="input min-h-24" value={descrPubblica} onChange={e=>setDescrPubblica(e.target.value)} placeholder="Breve testo da mostrare ai player (nessun segreto)."/>
            </div>
            <div>
              <div className="label">Note GM (privato)</div>
              <textarea className="input min-h-24" value={noteGM} onChange={e=>setNoteGM(e.target.value)} placeholder="Segreti, tattiche, trigger delle fasi…"/>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
            <button className="btn" onClick={()=>calcolaDaLivello(livello, tipo)}>Ricalcola da livello</button>
            <button className="btn" disabled={!connected || !name.trim()} onClick={sendToChat}>Invia in chat (Nome + Ritratto)</button>
            <button className="btn" disabled={!connected} onClick={showToDisplay}>Mostra al Display</button>
          </div>

          {/* Archivio locale */}
          <div className="border-t border-zinc-800 pt-3 space-y-2">
            <div className="font-semibold">Archivio Mostri (locale)</div>
            <div className="flex flex-wrap items-center gap-2">
              <input className="input" placeholder="Nome salvataggio (opzionale)" value={saveName} onChange={e=>setSaveName(e.target.value)} />
              <button className="btn" onClick={saveCurrentToList}>Salva/aggiorna</button>
            </div>
            {saved.length === 0 ? (
              <div className="text-sm text-zinc-500">Nessun mostro salvato.</div>
            ) : (
              <div className="space-y-2">
                {saved.map(m=>(
                  <div key={m.name} className="flex items-center justify-between rounded-xl border border-zinc-800 px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{m.name}</div>
                      <div className="text-xs text-zinc-400">{m.tipo} • Lvl {m.livello} • {m.elemento}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn" onClick={()=>loadFromList(m.name)}>Carica</button>
                      <button className="btn !bg-zinc-800" onClick={()=>deleteFromList(m.name)}>Elimina</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DESTRA: preview */}
        <div className="card space-y-3">
          <div className="font-semibold">Preview</div>

          {img ? (
            <img src={img} alt="" className="w-full h-48 object-cover rounded-xl border border-zinc-800"/>
          ) : (
            <div className="h-48 rounded-xl border border-zinc-800 grid place-content-center text-sm text-zinc-500">
              Nessun ritratto
            </div>
          )}

          <div className="rounded-xl border border-zinc-800 p-3">
            <div className="text-xl font-bold">{name || 'Mostro senza nome'}</div>
            <div className="text-sm text-zinc-400">{tipo} • Livello {livello} • Elemento: {elemento}</div>

            <div className="grid grid-cols-3 gap-2 text-sm mt-3">
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <div className="text-zinc-400 text-xs">HP</div>
                <div className="font-semibold">{hp}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <div className="text-zinc-400 text-xs">DIF</div>
                <div className="font-semibold">{dif}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <div className="text-zinc-400 text-xs">Danno</div>
                <div className="font-semibold">{danno}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <div className="text-zinc-400 text-xs">Pool</div>
                <div className="font-semibold">{pool}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <div className="text-zinc-400 text-xs">Soglia</div>
                <div className="font-semibold">{soglia}+</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <div className="text-zinc-400 text-xs">FOC</div>
                <div className="font-semibold">{foc}</div>
              </div>
            </div>

            {abilita.length>0 && (
              <div className="mt-3">
                <div className="text-sm font-semibold mb-1">Abilità</div>
                <ul className="list-disc list-inside text-sm text-zinc-200 space-y-0.5">
                  {abilita.filter(a=>a.text.trim()).map(a=>(<li key={a.id}>{a.text}</li>))}
                </ul>
              </div>
            )}

            {clocks.length>0 && (
              <div className="mt-3">
                <div className="text-sm font-semibold mb-1">Clock / Fasi</div>
                <div className="space-y-1">
                  {clocks.map(c=>{
                    const pct = Math.min(100, Math.round((c.value/(c.segments||1))*100))
                    return (
                      <div key={c.id}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-300">{c.name}</span>
                          <span className="text-zinc-400">{c.value}/{c.segments}</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{width:`${pct}%`}}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {descrPubblica?.trim() && (
              <div className="mt-3 text-sm text-zinc-200 whitespace-pre-wrap">
                {descrPubblica}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
