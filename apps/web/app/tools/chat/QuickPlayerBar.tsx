'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useWS } from '@/components/ws/WSProvider'

// ===== Tipi minimi che ci servono (allineati alla scheda) =====
type Attrs = { FOR:number; DES:number; COS:number; INT:number; SAP:number; CAR:number }
type AttackBase = 'FOR' | 'DES' | 'ARCANO'
type QualitaCategoria = 'Comune' | 'Buona' | 'Eccellente' | 'Maestrale' | 'Magica' | 'Artefatto'
type ArmorTipo = 'Leggera' | 'Media' | 'Pesante' | 'Magica'

type Weapon = {
  id: string
  name: string
  qualita: QualitaCategoria
  damageSeg?: number
  attackBase?: AttackBase
  bonusReal?: number
  bonusTheo?: number
  usesDES?: boolean
  notes?: string
  equipped?: boolean
}
type Armor = {
  id: string
  name: string
  tipo: ArmorTipo
  qualita: QualitaCategoria
  bonusD6: number
  durMax: number
  durVal: number
  equipped?: boolean
  useOverride?: boolean
}
type Ability = { id: string; name: string; rank: 0|1|2|3|4; desc?: string }
type PCData = {
  ident: { name:string; race:string; clazz:string; level:number; portraitUrl?:string }
  ap: { total:number; spent:number }
  attrs: Attrs
  skills: { melee:boolean; ranged:boolean; arcana:boolean }
  abilities: Ability[]
  weapons: Weapon[]
  armors: Armor[]
  current: { hp:number; difMod?:number; foc?: number }
  notes?: string
  spells?: any[]
}

// ===== Note rapide =====
type NoteType =
  | 'Missione' | 'Storia' | 'Appunti' | 'Oggetti' | 'Npc' | 'Player'
  | 'Mostri' | 'Eventi' | 'Oggetto Storia' | 'Luoghi' | 'Altro'
type Nota = {
  id: string
  title: string
  type: NoteType
  content: string
  images: string[]
  tags: string[]
  folderId?: string | null
  createdAt: number
  updatedAt: number
}
type StoredNotes = { folders?: { id:string; name:string }[]; notes?: Nota[] }

// ===== Costanti (replica sintetica dalla scheda) =====
const QUALITA_BONUS_TEO_WEAPON: Record<QualitaCategoria, number> = {
  Comune: 0, Buona: 2, Eccellente: 4, Maestrale: 6, Magica: 8, Artefatto: 10
}
const QUALITA_DANNO_SEG: Record<QualitaCategoria, number> = {
  Comune: 1, Buona: 2, Eccellente: 3, Maestrale: 4, Magica: 4, Artefatto: 5
}
const QUALITA_BONUS_D6_ARMOR: Record<QualitaCategoria, number> = {
  Comune: 0, Buona: 1, Eccellente: 2, Maestrale: 3, Magica: 4, Artefatto: 5
}

const clamp = (n:number,a:number,b:number)=>Math.max(a,Math.min(b,n))
const LS_SHEET = 'archei:player:sheet'
const LS_NOTES = (room:string)=> `archei:player:notes:v1:${room||'default'}`

function armorEffectiveD6Auto(tipo: ArmorTipo, qualita: QualitaCategoria) {
  const base = tipo === 'Leggera' ? 1 : tipo === 'Media' ? 2 : tipo === 'Pesante' ? 3 : 3
  const byQual = QUALITA_BONUS_D6_ARMOR[qualita] || 0
  let eff = base + byQual
  if (tipo === 'Magica') eff = Math.min(5, Math.max(3, eff))
  return Math.max(0, eff)
}
function calcDIF(des:number, armorEffD6:number) {
  return 10 + Math.max(0, des) + Math.max(0, armorEffD6)
}
function defenseDiceFromDIF(dif:number){
  const tot = Math.max(1, 1 + Math.max(0, dif - 10))
  const reali = Math.min(tot, 5)
  const teorici = tot - reali
  return { tot, reali, teorici }
}
function diceFromAttribute(attr:number){
  const real = Math.min(Math.max(0, attr), 5)
  const theo = Math.max(0, attr - 5)
  return { real, theo }
}
function buildAttackPool(params: {
  attackBase: AttackBase
  attrs: Attrs
  hasSkillMelee: boolean
  hasSkillRanged: boolean
  hasSkillArcana: boolean
  armaBonusTeorico: number
  bonusReal?: number
  bonusTheo?: number
}) {
  const { attackBase, attrs, hasSkillMelee, hasSkillRanged, hasSkillArcana, armaBonusTeorico, bonusReal=0, bonusTheo=0 } = params
  let primaryAttrValue = 0
  if (attackBase === 'FOR') primaryAttrValue = attrs.FOR || 0
  else if (attackBase === 'DES') primaryAttrValue = attrs.DES || 0
  else primaryAttrValue = Math.max(attrs.SAP || 0, attrs.INT || 0)
  const fromAttr = diceFromAttribute(primaryAttrValue)
  let skillReal = 0
  if (attackBase === 'FOR' && hasSkillMelee) skillReal += 1
  if (attackBase === 'DES' && hasSkillRanged) skillReal += 1
  if (attackBase === 'ARCANO' && hasSkillArcana) skillReal += 1
  const theoFromQuality = Math.max(0, armaBonusTeorico)
  const real = fromAttr.real + skillReal + Math.max(0, bonusReal)
  const theo = fromAttr.theo + theoFromQuality + Math.max(0, bonusTheo)
  const threshold = theo <= 5 ? 6 : theo <= 9 ? 5 : theo <= 19 ? 4 : 3
  return { real, theo, threshold }
}

// FOC suggerito (stesso in scheda): usa il migliore tra SAP e INT
function suggestedFOC(attrs: Attrs){ return Math.max(attrs.SAP||0, attrs.INT||0) }
const uid = ()=> Math.random().toString(36).slice(2,9)
const now = ()=> Date.now()
const preview = (s:string, n=140)=> {
  const t=(s||'').replace(/\s+/g,' ').trim(); return t.length>n? t.slice(0,n)+'…' : t
}

export default function QuickPlayerBar() {
  const { config, connected, send } = useWS()
  const room = config?.room || 'default'
  const [nickUI, setNickUI] = useState<string>(() => {
    try { return localStorage.getItem('archei:nick') || '' } catch { return '' }
  })

  const [data, setData] = useState<PCData | null>(null)
  const [loading, setLoading] = useState(true)

  // ======== SHEET: helper per salvare su LS in modo consistente
  function persistLS(next: PCData){
    try { localStorage.setItem(LS_SHEET, JSON.stringify(next)) } catch {}
  }
  function patchCurrent(patch: Partial<PCData['current']>){
    setData(prev => {
      if (!prev) return prev
      const next: PCData = { ...prev, current: { ...prev.current, ...patch } }
      persistLS(next)
      return next
    })
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/player/sheet', { cache: 'no-store' })
        if (!res.ok) throw new Error('sheet fetch error')
        const js = await res.json()
        if (!alive) return
        let base = js.data as PCData

        // merge con eventuali override locali (hp/difMod/foc) dal localStorage
        try {
          const raw = localStorage.getItem(LS_SHEET)
          if (raw) {
            const ov: PCData = JSON.parse(raw)
            if (ov?.current) {
              base = {
                ...base,
                current: {
                  ...base.current,
                  ...('hp' in (ov.current||{}) ? {hp: ov.current.hp} : {}),
                  ...('difMod' in (ov.current||{}) ? {difMod: ov.current.difMod} : {}),
                  ...('foc' in (ov.current||{}) ? {foc: ov.current.foc} : {}),
                }
              }
            }
          }
        } catch {}

        setData(base)
      } catch {
        setData(null)
      } finally {
        if (alive) setLoading(false)
      }
    })()

    // sync nickname e LS da altre tab
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'archei:nick' && typeof e.newValue === 'string') setNickUI(e.newValue)
      if (e.key === LS_SHEET && e.newValue) {
        try {
          const ov: PCData = JSON.parse(e.newValue)
          if (ov?.current) {
            setData(prev=> prev ? ({ ...prev, current:{ ...prev.current, ...ov.current } }) : prev)
          }
        } catch {}
      }
    }
    window.addEventListener('storage', onStorage)
    return () => { alive = false; window.removeEventListener('storage', onStorage) }
  }, [])

  // ======== SHEET: derived
  const portrait = data?.ident?.portraitUrl || ''
  const name = data?.ident?.name || '—'
  const race = data?.ident?.race || '—'
  const clazz = data?.ident?.clazz || '—'
  const level = data?.ident?.level ?? '—'

  const equippedArmor = useMemo(()=> (data?.armors||[]).find(a=>a.equipped), [data?.armors])
  const effArmorD6 = useMemo(()=>{
    if (!equippedArmor) return 0
    return equippedArmor.useOverride ? Math.max(0, equippedArmor.bonusD6||0) : armorEffectiveD6Auto(equippedArmor.tipo, equippedArmor.qualita)
  }, [equippedArmor])

  const difCalc = useMemo(()=>{
    const des = data?.attrs?.DES || 0
    return calcDIF(des, effArmorD6)
  }, [data?.attrs?.DES, effArmorD6])
  const difFinal = useMemo(()=> (difCalc || 10) + (data?.current?.difMod||0), [difCalc, data?.current?.difMod])
  const difDice = defenseDiceFromDIF(difFinal)

  const equippedWeapons = useMemo(()=> (data?.weapons||[]).filter(w=>w.equipped), [data?.weapons])

  const weaponPools = useMemo(()=>{
    if (!data) return []
    return equippedWeapons.map(w => {
      const base: AttackBase = (w.attackBase || (w.usesDES ? 'DES' : 'FOR')) as AttackBase
      const p = buildAttackPool({
        attackBase: base,
        attrs: data.attrs,
        hasSkillMelee: data.skills.melee,
        hasSkillRanged: data.skills.ranged,
        hasSkillArcana: data.skills.arcana,
        armaBonusTeorico: QUALITA_BONUS_TEO_WEAPON[w.qualita],
        bonusReal: w.bonusReal || 0,
        bonusTheo: w.bonusTheo || 0,
      })
      return {
        id: w.id,
        name: w.name || 'Arma',
        base,
        pool: p,
        damageSeg: typeof w.damageSeg==='number' ? w.damageSeg : QUALITA_DANNO_SEG[w.qualita],
        qualita: w.qualita,
      }
    })
  }, [data, equippedWeapons])

  const hp = data?.current?.hp
  const hpMaxSuggested = useMemo(()=>{
    const lvl = data?.ident?.level || 1
    const cos = data?.attrs?.COS || 0
    const base = 8 + cos + Math.max(0, (lvl-1))*2
    return Math.max(1, base)
  }, [data?.ident?.level, data?.attrs?.COS])

  const focSuggested = data ? suggestedFOC(data.attrs) : null
  const foc = (data?.current?.foc ?? focSuggested ?? null)

  const A = data?.attrs || {FOR:0,DES:0,COS:0,INT:0,SAP:0,CAR:0}
  const currHp = typeof data?.current?.hp === 'number' ? data!.current.hp : 0
  const difMod = typeof data?.current?.difMod === 'number' ? data!.current.difMod : 0

  // ======== NOTE: stato & persistenza (stessa chiave della pagina /player/notes)
  const [notes, setNotes] = useState<Nota[]>([])
  const [q, setQ] = useState('')
  const [qt, setQt] = useState('Nota veloce')
  const [qc, setQc] = useState('')

  // carica note per stanza
  useEffect(()=>{
    try {
      const raw = localStorage.getItem(LS_NOTES(room))
      if (!raw){ setNotes([]); return }
      const js: StoredNotes = JSON.parse(raw)
      setNotes(Array.isArray(js.notes)? js.notes : [])
    } catch { setNotes([]) }
  }, [room])

  function persistNotes(next: Nota[]){
    try {
      const raw = localStorage.getItem(LS_NOTES(room))
      const prev: StoredNotes = raw ? JSON.parse(raw) : {}
      const store: StoredNotes = { folders: prev.folders || [{id:'default', name:'Generale'}], notes: next }
      localStorage.setItem(LS_NOTES(room), JSON.stringify(store))
    } catch {}
  }

  function addQuick(){
    const title = (qt||'').trim() || 'Nota veloce'
    const content = (qc||'').trim()
    if (!content) return
    const n: Nota = {
      id: uid(),
      title,
      type: 'Appunti',
      content,
      images: [],
      tags: [],
      folderId: null,
      createdAt: now(),
      updatedAt: now(),
    }
    const next = [n, ...notes]
    setNotes(next); persistNotes(next); setQc('')
  }

  function deleteNote(id:string){
    const next = notes.filter(n=>n.id!==id)
    setNotes(next); persistNotes(next)
  }

  function sendNoteToChat(n: Nota){
    if(!config) return
    const who = (nickUI && nickUI.trim()) ? nickUI.trim() : (config.nick || 'Player')
    const firstImg = (n.images||[])[0]
    const parts = [
      `📝 Nota: ${n.title} — ${n.type}`,
      n.content?.trim() ? preview(n.content, 500) : '',
      firstImg ? `Immagine: ${firstImg}` : '',
      (n.tags?.length ? `#${n.tags.join(' #')}` : '')
    ].filter(Boolean)
    const text = parts.join('\n')
    send({ t:'chat:msg', room: config.room, nick: who, text, ts: Date.now(), channel:'global' })
  }

  const filteredNotes = useMemo(()=>{
    const ql = q.trim().toLowerCase()
    const list = notes
      .slice()
      .sort((a,b)=> b.updatedAt - a.updatedAt)
      .filter(n => !ql ? true : (
        n.title.toLowerCase().includes(ql) ||
        n.content.toLowerCase().includes(ql) ||
        (n.tags||[]).some(t=>t.toLowerCase().includes(ql))
      ))
    return list.slice(0,5)
  }, [notes, q])

  // ======== RENDER
  if (loading) {
    return (
      <div className="card">
        <div className="text-sm text-zinc-500">Carico dati personaggio…</div>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="card">
        <div className="text-sm text-zinc-500">
          Nessuna scheda trovata. Apri la <a className="text-indigo-400 underline" href="/player/sheet">Scheda Personaggio</a> e salva.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ====== TOOL RAPIDO: SCHEDA ESSENZIALE ====== */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Scheda Personaggio (Essential)</div>
          <a className="btn" href="/player/sheet">Apri scheda</a>
        </div>

        <div className="flex items-start gap-3">
          {/* Ritratto quadrato piccolo */}
          <div className="w-16 h-16 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 shrink-0">
            {portrait ? <img src={portrait} alt="" className="w-full h-full object-cover" /> : null}
          </div>

          {/* Dati principali */}
          <div className="min-w-0 flex-1">
            <div className="font-bold truncate">{name}</div>
            <div className="text-xs text-zinc-400 truncate">{race} • {clazz} • Liv. {level}</div>

            {/* Stat rapide */}
            <div className="grid md:grid-cols-6 grid-cols-3 gap-2 text-sm mt-2">
              {(['FOR','DES','COS','INT','SAP','CAR'] as const).map(k=>(
                <div key={k} className="bg-zinc-900/50 rounded-lg p-2 text-center">
                  <div className="text-zinc-400 text-[11px]">{k}</div>
                  <div className="font-semibold">{(A as any)[k]}</div>
                </div>
              ))}
            </div>

            {/* Vitali */}
            <div className="grid grid-cols-4 gap-2 text-sm mt-2">
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <div className="text-zinc-400 text-[11px]">HP</div>
                <div className="font-semibold">
                  {typeof hp === 'number' ? `${clamp(hp,0,hpMaxSuggested)}/${hpMaxSuggested}` : `—/${hpMaxSuggested}`}
                </div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <div className="text-zinc-400 text-[11px]">DIF</div>
                <div className="font-semibold">{difFinal}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <div className="text-zinc-400 text-[11px]">FOC</div>
                <div className="font-semibold">{typeof foc==='number' ? foc : '—'}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <div className="text-zinc-400 text-[11px]">Pool DIF</div>
                <div className="font-semibold">{difDice.tot}d6 <span className="text-xs text-zinc-400">({difDice.reali}/{difDice.teorici})</span></div>
              </div>
            </div>

            {/* EDIT VELOCE: HP residui + DIF residua */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              {/* HP residui */}
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <div className="text-xs text-zinc-400">HP residui</div>
                <div className="flex items-center gap-3 mt-1">
                  <button className="btn !bg-zinc-800 px-2" onClick={() => patchCurrent({ hp: clamp(currHp - 1, 0, hpMaxSuggested) })}>−</button>
                  <div className="text-sm font-semibold tabular-nums">{clamp(currHp, 0, hpMaxSuggested)}/{hpMaxSuggested}</div>
                  <button className="btn !bg-zinc-800 px-2" onClick={() => patchCurrent({ hp: clamp(currHp + 1, 0, hpMaxSuggested) })}>+</button>
                </div>
              </div>

              {/* DIF residua (modificatore) */}
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <div className="text-xs text-zinc-400">DIF residua</div>
                <div className="flex items-center gap-3 mt-1">
                  <button className="btn !bg-zinc-800 px-2" onClick={() => patchCurrent({ difMod: difMod - 1 })}>−</button>
                  <div className="text-sm tabular-nums">
                    <div className="font-semibold">mod {difMod >= 0 ? `+${difMod}` : difMod}</div>
                    <div className="text-xs text-zinc-500">= {difFinal}</div>
                  </div>
                  <button className="btn !bg-zinc-800 px-2" onClick={() => patchCurrent({ difMod: difMod + 1 })}>+</button>
                </div>
              </div>
            </div>

            {/* Armi equipaggiate */}
            <div className="mt-3">
              <div className="text-xs text-zinc-400 mb-1">Armi equipaggiate</div>
              {weaponPools.length === 0 ? (
                <div className="text-sm text-zinc-500">Nessuna arma equipaggiata.</div>
              ) : (
                <div className="space-y-1">
                  {weaponPools.map(w=>(
                    <div key={w.id} className="rounded-md border border-zinc-800 p-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{w.name}</div>
                          <div className="text-xs text-zinc-500">Base {w.base} • {w.qualita}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-semibold">{w.pool.real}/{w.pool.theo}d6</div>
                          <div className="text-xs text-zinc-400">Soglia {w.pool.threshold} • Danno {w.damageSeg} seg</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ====== TOOL RAPIDO: NOTE ====== */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Note (rapide)</div>
          <div className="flex gap-2">
            <input className="input h-9 w-40" placeholder="Cerca…" value={q} onChange={e=>setQ(e.target.value)}/>
            <Link href="/player/notes" className="btn">Apri note</Link>
          </div>
        </div>

        {/* Composer rapido */}
        <div className="rounded-xl border border-zinc-800 p-3 space-y-2 bg-zinc-900/40">
          <div className="grid grid-cols-3 gap-2">
            <input className="input col-span-1" placeholder="Titolo" value={qt} onChange={e=>setQt(e.target.value)}/>
            <textarea className="input col-span-2 min-h-10" placeholder="Scrivi rapidamente…" value={qc} onChange={e=>setQc(e.target.value)}/>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={addQuick}>+ Aggiungi</button>
            <button
              className="btn !bg-zinc-800"
              onClick={()=>{
                const tmp: Nota = {
                  id: uid(),
                  title: (qt||'').trim() || 'Nota veloce',
                  type: 'Appunti',
                  content: (qc||'').trim(),
                  images: [], tags: [],
                  folderId: null, createdAt: now(), updatedAt: now()
                }
                if (tmp.content) sendNoteToChat(tmp)
              }}
              disabled={!connected || !qc.trim()}
            >
              ↗︎ Invia subito
            </button>
          </div>
        </div>

        {/* Ultime note */}
        <div className="space-y-2">
          {filteredNotes.length===0 ? (
            <div className="text-sm text-zinc-500">Nessuna nota.</div>
          ) : filteredNotes.map(n=>(
            <div key={n.id} className="rounded-xl border border-zinc-800 p-2 text-sm bg-zinc-900/40">
              <div className="flex items-center justify-between">
                <div className="font-semibold truncate">{n.title || 'Senza titolo'}</div>
                <div className="text-[11px] text-zinc-500 ml-2 shrink-0">{new Date(n.updatedAt).toLocaleString()}</div>
              </div>
              <div className="text-xs text-zinc-400 mb-1">{n.type}</div>
              <div className="mb-2 whitespace-pre-wrap break-words">{preview(n.content)}</div>
              <div className="flex gap-2">
                <button className="btn" onClick={()=>sendNoteToChat(n)} disabled={!connected}>Invia in chat</button>
                <Link className="btn !bg-zinc-800" href="/player/notes">Apri</Link>
                <button className="btn !bg-zinc-800" onClick={()=>deleteNote(n.id)}>Elimina</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
