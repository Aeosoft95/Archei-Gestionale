'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SideNav from '@/components/SideNav'
import BackButton from '@/components/BackButton'
import LogoutButton from '@/components/LogoutButton'
import { SPELLS_DB } from '@/data/spells' // ⬅️ Import del mini-database esterno

// ⬇️⬇️ NUOVI IMPORT per PDF/JSON e frame stampabile
import SheetExportBar from '@/components/SheetExportBar'
import SheetFrame from '@/components/SheetFrame'
// ⬆️⬆️

// ================== Tipi ==================
type Attrs = { FOR:number; DES:number; COS:number; INT:number; SAP:number; CAR:number }

type QualitaCategoria = 'Comune' | 'Buona' | 'Eccellente' | 'Maestrale' | 'Magica' | 'Artefatto'
const QUALITA_BONUS_TEO_WEAPON: Record<QualitaCategoria, number> = {
  Comune: 0, Buona: 2, Eccellente: 4, Maestrale: 6, Magica: 8, Artefatto: 10
}
const QUALITA_DANNO_SEG: Record<QualitaCategoria, number> = {
  Comune: 1, Buona: 2, Eccellente: 3, Maestrale: 4, Magica: 4, Artefatto: 5
}

// bonus d6 extra per armatura dalla qualità (progressione misurata)
const QUALITA_BONUS_D6_ARMOR: Record<QualitaCategoria, number> = {
  Comune: 0, Buona: 1, Eccellente: 2, Maestrale: 3, Magica: 4, Artefatto: 5
}

type AttackBase = 'FOR' | 'DES' | 'ARCANO'

type Weapon = {
  id: string
  name: string
  qualita: QualitaCategoria
  damageSeg?: number
  // NUOVO: quale caratteristica usa questa arma
  attackBase?: AttackBase // default: 'FOR'
  // bonus situazionali rapidi
  bonusReal?: number
  bonusTheo?: number
  // legacy flags
  usesDES?: boolean
  effettoMeccanico?: string
  effettoNarrativo?: string
  durMax?: number
  durVal?: number
  notes?: string
  equipped?: boolean
  collapsed?: boolean
}

type ArmorTipo = 'Leggera' | 'Media' | 'Pesante' | 'Magica'
type Armor = {
  id: string
  name: string
  tipo: ArmorTipo
  qualita: QualitaCategoria
  // editabile, ma usato solo se useOverride === true
  bonusD6: number
  durMax: number
  durVal: number
  penalita?: string
  effettoMagico?: string
  notes?: string
  equipped?: boolean
  collapsed?: boolean
  // NUOVO: se true usa bonusD6 manuale; altrimenti calcolo Tipo+Qualità
  useOverride?: boolean
}

type Ability = {
  id: string
  name: string
  rank: 0|1|2|3|4
  desc?: string
}

// ===== Incantesimi & Preghiere =====
type SpellTier = 'I'|'II'|'III'|'IV'
type SpellKind = 'Incantesimo'|'Preghiera'
type SpellEntry = {
  id: string
  name: string
  kind: SpellKind
  tier: SpellTier
  school?: string
  action?: string
  range?: string
  duration?: string
  foc?: string
  text: string
}
type LearnedSpell = { id: string; refId: string; notes?: string }

type PCData = {
  ident: {
    name: string
    race: string
    clazz: string
    level: number
    background?: string
    portraitUrl?: string
  }
  ap: { total:number; spent:number }
  attrs: Attrs
  skills: { melee:boolean; ranged:boolean; arcana:boolean }
  abilities: Ability[]
  weapons: Weapon[]
  armors: Armor[]
  current: { hp: number; difMod?: number }
  notes?: string
  // AGGIUNTA: incantesimi/preghiere salvati dal PG
  spells?: LearnedSpell[]
}

const EMPTY: PCData = {
  ident: { name: '', race: '', clazz: '', level: 1, portraitUrl: '', background:'' },
  ap: { total: 0, spent: 0 },
  attrs: { FOR: 0, DES: 0, COS: 0, INT: 0, SAP: 0, CAR: 0 },
  skills: { melee: false, ranged: false, arcana: false },
  abilities: [],
  weapons: [],
  armors: [],
  current: { hp: 10, difMod: 0 },
  notes: '',
  spells: [],
}

// ================== Helpers ==================
const uid = () => Math.random().toString(36).slice(2, 9)
const clamp = (n:number, a:number, b:number) => Math.max(a, Math.min(b, n))

function derivedHP(level:number, COS:number) {
  const base = 8 + COS + Math.max(0, (level-1))*2
  return Math.max(1, base)
}

// d6 effettivi dell'armatura in base a tipo + qualità (con cap magica 3–5)
function armorEffectiveD6Auto(tipo: ArmorTipo, qualita: QualitaCategoria) {
  const base =
    tipo === 'Leggera' ? 1 :
    tipo === 'Media'   ? 2 :
    tipo === 'Pesante' ? 3 : 3
  const byQual = QUALITA_BONUS_D6_ARMOR[qualita] || 0
  let eff = base + byQual
  if (tipo === 'Magica') eff = Math.min(5, Math.max(3, eff))
  return Math.max(0, eff)
}

// DIF = 10 + DES + d6 armatura effettivi
function calcDIF(des:number, armorEffD6:number) {
  return 10 + Math.max(0, des) + Math.max(0, armorEffD6)
}

// Pool DIF: 1d6 fino a 10, +1d6 per ogni punto sopra 10. Max 5 reali, resto teorici.
function defenseDiceFromDIF(dif:number){
  const tot = Math.max(1, 1 + Math.max(0, dif - 10))
  const reali = Math.min(tot, 5)
  const teorici = tot - reali
  return { tot, reali, teorici }
}

// ====== ATTACCO ======
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
  else primaryAttrValue = Math.max(attrs.SAP || 0, attrs.INT || 0) // ARCANO

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

function defaultsForArmorType(tipo: ArmorTipo){
  if (tipo==='Leggera')  return { bonusD6:1, durMax:4,  penalita:'', note:'Agile, silenziosa.' }
  if (tipo==='Media')    return { bonusD6:2, durMax:6,  penalita:'-1d6 a tiri furtivi', note:'Standard per avventurieri.' }
  if (tipo==='Pesante')  return { bonusD6:3, durMax:8,  penalita:'-1d6 ai movimenti', note:'Perfetta per tank.' }
  return { bonusD6:3, durMax:8, penalita:'Consuma 1 FOC/Scena', note:'Effetti speciali.' }
}

// ================== Pagina ==================
export default function PlayerSheetPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<PCData>(EMPTY)

  // Stato locale per ricerca incantesimi
  const [spellQuery, setSpellQuery] = useState('')
  const [spellKind, setSpellKind] = useState<'all'|SpellKind>('all')
  const [spellTier, setSpellTier] = useState<'all'|SpellTier>('all')

  // Carica dati
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/player/sheet', { cache: 'no-store' })
        if (res.status === 401) { router.push('/auth/login'); return }
        const js = await res.json()
        if (!alive) return
        const inData: PCData = js.data ?? EMPTY
        inData.weapons = Array.isArray(inData.weapons)
          ? inData.weapons.map(w => ({
              id: w.id || uid(),
              qualita: (w as any).qualita || 'Comune',
              damageSeg: w.damageSeg ?? QUALITA_DANNO_SEG[((w as any).qualita || 'Comune') as QualitaCategoria],
              attackBase: (w as any).attackBase || ((w as any).usesDES ? 'DES' : 'FOR'),
              bonusReal: typeof (w as any).bonusReal === 'number' ? (w as any).bonusReal : 0,
              bonusTheo: typeof (w as any).bonusTheo === 'number' ? (w as any).bonusTheo : 0,
              usesDES: !!(w as any).usesDES, // legacy
              effettoMeccanico: w.effettoMeccanico||'',
              effettoNarrativo: w.effettoNarrativo||'',
              durMax: w.durMax ?? 4,
              durVal: w.durVal ?? 0,
              notes: w.notes || '',
              equipped: !!w.equipped,
              collapsed: w.collapsed ?? true,
              name: w.name || '',
            }))
          : []
        inData.armors = Array.isArray(inData.armors)
          ? inData.armors.map(a => ({
              id: a.id || uid(),
              name: a.name || '',
              tipo: (a as any).tipo || 'Leggera',
              qualita: (a as any).qualita || 'Comune',
              bonusD6: typeof a.bonusD6==='number' ? a.bonusD6 : defaultsForArmorType(((a as any).tipo||'Leggera') as ArmorTipo).bonusD6,
              durMax: typeof a.durMax==='number' ? a.durMax : defaultsForArmorType(((a as any).tipo||'Leggera') as ArmorTipo).durMax,
              durVal: typeof a.durVal==='number' ? a.durVal : 0,
              penalita: a.penalita || defaultsForArmorType(((a as any).tipo||'Leggera') as ArmorTipo).penalita,
              effettoMagico: a.effettoMagico || '',
              notes: a.notes || defaultsForArmorType(((a as any).tipo||'Leggera') as ArmorTipo).note,
              equipped: !!a.equipped,
              collapsed: a.collapsed ?? true,
              useOverride: !!(a as any).useOverride,
            }))
          : []
        inData.abilities = Array.isArray(inData.abilities)
          ? inData.abilities.map(ab => ({ id:ab.id||uid(), name:ab.name||'', rank: clamp((ab.rank??0) as any,0,4) as 0|1|2|3|4, desc: ab.desc||'' }))
          : []
        if (!inData.ap) inData.ap = { total: 0, spent: 0 }
        if (!inData.current) inData.current = { hp: derivedHP(inData.ident.level||1, inData.attrs.COS||0), difMod: 0 }
        if (typeof inData.current.difMod !== 'number') inData.current.difMod = 0
        if (!Array.isArray(inData.spells)) inData.spells = []
        setData(inData)
      } finally {
        setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [router])

  // DERIVATI
  const sugHP = useMemo(() => derivedHP(data.ident.level || 1, data.attrs.COS || 0), [data.ident.level, data.attrs.COS])

  const equippedArmor = data.armors.find(a => a.equipped)

  const effArmorD6 = useMemo(() => {
    if (!equippedArmor) return 0
    return equippedArmor.useOverride
      ? Math.max(0, equippedArmor.bonusD6 || 0)
      : armorEffectiveD6Auto(equippedArmor.tipo, equippedArmor.qualita)
  }, [equippedArmor?.useOverride, equippedArmor?.bonusD6, equippedArmor?.tipo, equippedArmor?.qualita])

  const difCalc = useMemo(() => calcDIF(data.attrs.DES||0, effArmorD6), [data.attrs.DES, effArmorD6])
  const difFinal = (difCalc || 10) + (data.current.difMod||0)
  const difDice = defenseDiceFromDIF(difFinal)

  const equippedWeapons = data.weapons.filter(w => w.equipped)

  // Filtraggio incantesimi/preghiere
  const filteredSpells = useMemo(() => {
    let list = SPELLS_DB as SpellEntry[]
    if (spellKind !== 'all') list = list.filter(s => s.kind === spellKind)
    if (spellTier !== 'all') list = list.filter(s => s.tier === spellTier)
    const q = spellQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.text?.toLowerCase() ?? '').includes(q) ||
        (s.school?.toLowerCase() ?? '').includes(q)
      )
    }
    return list
  }, [spellKind, spellTier, spellQuery])

  async function save() {
    setSaving(true)
    try {
      const payload: PCData = {
        ...data,
        ap: { total: clamp(data.ap.total, 0, 999), spent: clamp(data.ap.spent, 0, 999) },
        attrs: {
          FOR: clamp(data.attrs.FOR,0,15),
          DES: clamp(data.attrs.DES,0,15),
          COS: clamp(data.attrs.COS,0,15),
          INT: clamp(data.attrs.INT,0,15),
          SAP: clamp(data.attrs.SAP,0,15),
          CAR: clamp(data.attrs.CAR,0,15),
        },
        current: {
          hp:  clamp(data.current.hp, 0, 999),
          difMod: clamp(data.current.difMod||0, -20, 50),
        },
        weapons: data.weapons.map(w => ({
          ...w,
          attackBase: (w.attackBase || (w.usesDES ? 'DES' : 'FOR')) as AttackBase,
          bonusReal: clamp(w.bonusReal ?? 0, 0, 50),
          bonusTheo: clamp(w.bonusTheo ?? 0, 0, 50),
          qualita: w.qualita,
          damageSeg: clamp(w.damageSeg ?? QUALITA_DANNO_SEG[w.qualita], 0, 9),
          durMax: clamp(w.durMax ?? 4, 1, 24),
          durVal: clamp(w.durVal ?? 0, 0, w.durMax ?? 24),
        })),
        armors: data.armors.map(a => ({
          ...a,
          bonusD6: clamp(a.bonusD6, 0, 10),
          durMax: clamp(a.durMax, 1, 24),
          durVal: clamp(a.durVal, 0, a.durMax),
          useOverride: !!a.useOverride,
        })),
        abilities: data.abilities.map(ab => ({ ...ab, rank: clamp(ab.rank, 0, 4) as Ability['rank'] })),
        spells: Array.isArray(data.spells) ? data.spells.map(s => ({
          id: s.id || uid(),
          refId: s.refId,
          notes: s.notes || ''
        })) : [],
      }
      const res = await fetch('/api/player/sheet', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 401) { router.push('/auth/login'); return }
      if (!res.ok) throw new Error('save error')
      alert('Scheda salvata ✅')
    } catch {
      alert('Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

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

  // ===== UI =====
  return (
    <div className="flex min-h-screen">
      {/* SideNav */}
      <aside className="bg-zinc-950/60 border-r border-zinc-800 p-4 w-64 hidden md:block">
        <div className="text-xl font-semibold mb-4">Menu</div>
        <SideNav />
      </aside>

      <div className="flex-1">
        {/* Topbar */}
        <div className="border-b border-zinc-800 p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BackButton />
            <div className="text-lg font-semibold">Scheda Personaggio</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/tools/chat" className="btn !bg-zinc-800">↩︎ Chat</Link>
            <button className="btn" onClick={save} disabled={saving}>{saving?'Salvo…':'💾 Salva'}</button>
            <LogoutButton />
          </div>
        </div>

        <main className="max-w-6xl mx-auto p-4 space-y-4">
          {/* ====== NUOVA TOOLBAR: PDF/JSON ====== */}
          <div className="card">
            <SheetExportBar
              getData={()=>data}
              setData={(d:any)=>setData(d)}
              targetSelector="#sheet-print"  // id fornito da SheetFrame
              filename={data?.ident?.name ? `Scheda_${data.ident.name}` : 'scheda-personaggio'}
            />
          </div>

          {/* ====== CONTENUTO STAMPABILE ====== */}
          <SheetFrame>
            {/* Identità + Ritratto + AP */}
            <section className="card">
              <details open>
                <summary className="font-semibold cursor-pointer select-none">Identità & Risorse</summary>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                  <div>
                    <div className="label">Nome</div>
                    <input className="input" value={data.ident.name}
                          onChange={e=>setData(d=>({...d, ident:{...d.ident, name:e.target.value}}))}/>
                  </div>
                  <div>
                    <div className="label">Razza</div>
                    <input className="input" value={data.ident.race}
                          onChange={e=>setData(d=>({...d, ident:{...d.ident, race:e.target.value}}))}/>
                  </div>
                  <div>
                    <div className="label">Classe</div>
                    <input className="input" value={data.ident.clazz}
                          onChange={e=>setData(d=>({...d, ident:{...d.ident, clazz:e.target.value}}))}/>
                  </div>
                  <div>
                    <div className="label">Livello</div>
                    <input className="input text-center" type="number" min={1} value={data.ident.level}
                          onChange={e=>setData(d=>({...d, ident:{...d.ident, level:parseInt(e.target.value||'1')}}))}/>
                    {data.ident.level >= 7 ? (
                      <div className="mt-1 text-green-400 text-sm font-semibold">Evoluzione raggiunta!</div>
                    ) : data.ident.level >= 4 ? (
                      <div className="mt-1 text-amber-400 text-sm font-semibold">Sottoclasse sbloccata!</div>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2 lg:col-span-4">
                    <div className="label">Ritratto PG (URL)</div>
                    <input className="input" placeholder="https://…" value={data.ident.portraitUrl||''}
                          onChange={e=>setData(d=>({...d, ident:{...d.ident, portraitUrl:e.target.value}}))}/>
                    {data.ident.portraitUrl?.trim() && (
                      <div className="mt-2 w-full h-40 rounded-xl overflow-hidden border border-zinc-800">
                        <img src={data.ident.portraitUrl!} alt="" className="w-full h-full object-cover"/>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="label">AP Ottenuti (totali)</div>
                    <input className="input text-center" type="number" value={data.ap.total}
                          onChange={e=>setData(d=>({...d, ap:{...d.ap, total:parseInt(e.target.value||'0')}}))}/>
                  </div>
                  <div>
                    <div className="label">AP Spesi</div>
                    <input className="input text-center" type="number" value={data.ap.spent}
                          onChange={e=>setData(d=>({...d, ap:{...d.ap, spent:parseInt(e.target.value||'0')}}))}/>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-2 flex items-end text-sm text-zinc-400">
                    Disponibili: <span className="ml-1 text-zinc-200 font-semibold">{Math.max(0, (data.ap.total||0) - (data.ap.spent||0))}</span>
                  </div>
                </div>
              </details>
            </section>

            {/* DUE COLONNE */}
            <section className="grid lg:grid-cols-[360px_1fr] gap-4">
              {/* Abilità */}
              <div className="space-y-4">
                <section className="card">
                  <details open>
                    <summary className="font-semibold cursor-pointer select-none">Abilità</summary>
                    <div className="text-xs text-zinc-400 mb-2 mt-2">
                      Ogni abilità può essere migliorata fino a <b>4</b> volte.
                    </div>
                    <button className="btn" onClick={()=>setData(d=>({...d, abilities:[...d.abilities, { id:uid(), name:'', rank:0, desc:'' }]}))}>
                      + Aggiungi abilità
                    </button>
                    <div className="space-y-2 mt-2">
                      {data.abilities.length===0 && <div className="text-sm text-zinc-500">Nessuna abilità aggiunta.</div>}
                      {data.abilities.map(ab=>(
                        <details key={ab.id} className="rounded-xl border border-zinc-800 p-2" open>
                          <summary className="font-semibold cursor-pointer select-none">
                            {ab.name || 'Abilità senza nome'}{ab.rank ? ` — Grado ${ab.rank}` : ''}
                          </summary>
                          <div className="grid md:grid-cols-3 gap-2 mt-2">
                            <div className="md:col-span-2">
                              <div className="label">Nome abilità</div>
                              <input className="input" value={ab.name}
                                onChange={e=>setData(d=>({...d, abilities:d.abilities.map(x=>x.id===ab.id?{...x, name:e.target.value}:x)}))}/>
                            </div>
                            <div>
                              <div className="label">Grado</div>
                              <div className="flex items-center gap-2">
                                <button className="btn !bg-zinc-800" onClick={()=>setData(d=>({...d, abilities:d.abilities.map(x=>x.id===ab.id?{...x, rank: clamp((x.rank-1) as any, 0,4) as any}:x)}))}>−</button>
                                <div className="w-10 text-center">{ab.rank}</div>
                                <button className="btn" onClick={()=>setData(d=>({...d, abilities:d.abilities.map(x=>x.id===ab.id?{...x, rank: clamp((x.rank+1) as any, 0,4) as any}:x)}))}>+</button>
                              </div>
                            </div>
                          </div>
                          <div className="mt-2">
                            <div className="label">Descrizione</div>
                            <textarea className="input min-h-20" placeholder="Cosa fa l'abilità, trigger, limiti…"
                              value={ab.desc||''}
                              onChange={e=>setData(d=>({...d, abilities:d.abilities.map(x=>x.id===ab.id?{...x, desc:e.target.value}:x)}))}/>
                          </div>
                          <div className="mt-2 text-right">
                            <button className="btn !bg-zinc-800" onClick={()=>setData(d=>({...d, abilities:d.abilities.filter(x=>x.id!==ab.id)}))}>Elimina</button>
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                </section>
              </div>

              {/* Colonna destra */}
              <div className="space-y-4">
                {/* Attributi */}
                <section className="card">
                  <details open>
                    <summary className="font-semibold cursor-pointer select-none">Attributi</summary>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
                      {(['FOR','DES','COS','INT','SAP','CAR'] as (keyof Attrs)[]).map(k=>(
                        <div key={k}>
                          <div className="label">{k}</div>
                          <input className="input text-center" type="number" value={data.attrs[k]}
                            onChange={e=>setData(d=>({...d, attrs:{...d.attrs, [k]: parseInt(e.target.value||'0')}}))}/>
                        </div>
                      ))}
                    </div>
                  </details>
                </section>

                {/* Valori Derivati */}
                <section className="card">
                  <details open>
                    <summary className="font-semibold cursor-pointer select-none">Valori derivati</summary>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div>
                        <div className="label">HP (suggerito)</div>
                        <div className="text-xl">{sugHP}</div>
                      </div>
                      <div>
                        <div className="label">DIF (calcolata)</div>
                        <div className="text-xl">{difCalc}</div>
                        <div className="text-xs text-zinc-400 mt-1">
                          = 10 + DES ({data.attrs.DES||0}) + Armatura eff. ({effArmorD6}d6)
                        </div>
                      </div>
                      <div>
                        <div className="label">Mod. DIF manuale</div>
                        <input className="input text-center" type="number"
                          value={data.current.difMod||0}
                          onChange={e=>setData(d=>({...d, current:{...d.current, difMod: parseInt(e.target.value||'0')}}))}/>
                      </div>
                    </div>
                    <div className="rounded-lg border border-zinc-800 p-2 mt-2">
                      <div className="text-sm text-zinc-400">
                        Pool totale difesa: <span className="font-semibold text-zinc-200">{difDice.tot}d6</span>
                      </div>
                      <div className="text-xs text-zinc-500">
                        (split: {difDice.reali} reali / {difDice.teorici} teorici • con DIF finale {difFinal})
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <div className="label">HP (attuali)</div>
                        <input className="input text-center" type="number" value={data.current.hp}
                          onChange={e=>setData(d=>({...d, current:{...d.current, hp: parseInt(e.target.value||'0')}}))}/>
                      </div>
                    </div>
                  </details>
                </section>

                {/* Attacco — Armi */}
<section className="card">
  <details open>
    <summary className="font-semibold cursor-pointer select-none">Attacco — Armi</summary>
    <div className="flex items-center justify-between mt-3">
      <div className="text-sm text-zinc-400">
        Base dall’attributo scelto; la qualità aggiunge solo dadi <b>teorici</b>.
      </div>
      <button className="btn" onClick={()=>setData(d=>({...d, weapons:[...d.weapons, {
        id:uid(), name:'', qualita:'Comune', damageSeg:QUALITA_DANNO_SEG['Comune'],
        attackBase:'FOR', bonusReal:0, bonusTheo:0,
        usesDES:false, effettoMeccanico:'', effettoNarrativo:'',
        durMax:4, durVal:0, notes:'', equipped:false, collapsed:false
      }]}))}>
        + Aggiungi arma
      </button>
    </div>

    <div className="space-y-2 mt-3">
      {data.weapons.length===0 && <div className="text-sm text-zinc-500">Nessuna arma inserita.</div>}
      {data.weapons.map(w=>{
        const p = buildAttackPool({
          attackBase: (w.attackBase || (w.usesDES ? 'DES' : 'FOR')) as AttackBase,
          attrs: data.attrs,
          hasSkillMelee: data.skills.melee,
          hasSkillRanged: data.skills.ranged,
          hasSkillArcana: data.skills.arcana,
          armaBonusTeorico: QUALITA_BONUS_TEO_WEAPON[w.qualita],
          bonusReal: w.bonusReal || 0,
          bonusTheo: w.bonusTheo || 0,
        })

        return (
          <div key={w.id} className="rounded-xl border border-zinc-800">
            {/* Header + Riepilogo collassato */}
            <div className="flex items-center justify-between p-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">
                  {w.name || 'Arma senza nome'} — {w.qualita}
                  {w.collapsed && (
                    <span className="text-xs text-zinc-400 ml-2">
                      • Pool: {p.real}/{p.theo} • Danno: {w.damageSeg ?? QUALITA_DANNO_SEG[w.qualita]} seg
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="label flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!w.equipped}
                    onChange={e=>setData(d=>{
                      const next = d.weapons.map(x=> x.id===w.id ? { ...x, equipped:e.target.checked } : x)
                      const eq = next.filter(x=>x.equipped)
                      if (eq.length > 3) {
                        return { ...d, weapons: d.weapons.map(x=> x.id===w.id ? { ...x, equipped:false } : x) }
                      }
                      return { ...d, weapons: next }
                    })}/>
                  Equip. (max 3)
                </label>
                <button className="btn !bg-zinc-800" onClick={()=>setData(d=>({...d, weapons:d.weapons.filter(x=>x.id!==w.id)}))}>✕</button>
                <button className="btn" onClick={()=>setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{...x, collapsed:!x.collapsed}:x)}))}>
                  {w.collapsed ? '▼' : '▲'}
                </button>
              </div>
            </div>

            {!w.collapsed && (
              <div className="p-3 border-t border-zinc-800 space-y-2">
                <div className="grid md:grid-cols-6 gap-2">
                  <div className="md:col-span-2">
                    <div className="label">Nome arma</div>
                    <input className="input" value={w.name}
                      onChange={e=>setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{...x, name:e.target.value}:x)}))}/>
                  </div>
                  <div>
                    <div className="label">Base (caratteristica)</div>
                    <select className="input" value={w.attackBase || (w.usesDES ? 'DES' : 'FOR')}
                      onChange={e=>setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{...x, attackBase: e.target.value as AttackBase}:x)}))}>
                      {(['FOR','DES','ARCANO'] as AttackBase[]).map(b=> <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="label">Qualità</div>
                    <select className="input" value={w.qualita}
                      onChange={e=>{
                        const q = e.target.value as QualitaCategoria
                        setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{
                          ...x, qualita:q,
                          damageSeg: x.damageSeg ?? QUALITA_DANNO_SEG[q]
                        }:x)}))
                      }}>
                      {(['Comune','Buona','Eccellente','Maestrale','Magica','Artefatto'] as QualitaCategoria[]).map(q=><option key={q} value={q}>{q}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="label">Danno (segmenti)</div>
                    <input className="input text-center" type="number"
                      value={w.damageSeg ?? QUALITA_DANNO_SEG[w.qualita]}
                      onChange={e=>setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{...x, damageSeg:parseInt(e.target.value||'1')}:x)}))}/>
                  </div>
                  <div>
                    <div className="label">Bonus situazionali (reali)</div>
                    <input className="input text-center" type="number" value={w.bonusReal ?? 0}
                      onChange={e=>setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{...x, bonusReal:parseInt(e.target.value||'0')}:x)}))}/>
                  </div>
                  <div>
                    <div className="label">Bonus situazionali (teorici)</div>
                    <input className="input text-center" type="number" value={w.bonusTheo ?? 0}
                      onChange={e=>setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{...x, bonusTheo:parseInt(e.target.value||'0')}:x)}))}/>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-2">
                  <div>
                    <div className="label">Effetto meccanico (uno solo)</div>
                    <input className="input" placeholder="+1d6 in contrattacco, Clock Bruciatura, ecc."
                      value={w.effettoMeccanico||''}
                      onChange={e=>setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{...x, effettoMeccanico:e.target.value}:x)}))}/>
                  </div>
                  <div>
                    <div className="label">Effetto narrativo (opz.)</div>
                    <input className="input" placeholder="Evento o condizione di scena"
                      value={w.effettoNarrativo||''}
                      onChange={e=>setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{...x, effettoNarrativo:e.target.value}:x)}))}/>
                  </div>
                </div>

                <textarea className="input" placeholder="Proprietà/Note"
                  value={w.notes||''}
                  onChange={e=>setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{...x, notes:e.target.value}:x)}))}/>

                <div className="rounded-lg border border-zinc-800 p-2">
                  <div className="text-sm text-zinc-400">Pool attacco</div>
                  <div className="font-semibold">
                    {p.real} reali / {p.theo} teorici — soglia {p.threshold}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>

    {/* Abilità di attacco globali */}
    <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3 mt-3">
      <label className="label flex items-center gap-2">
        <input type="checkbox" checked={data.skills.melee}
              onChange={e=>setData(d=>({...d, skills:{...d.skills, melee:e.target.checked}}))}/>
        Abilità: Mischia
      </label>
      <label className="label flex items-center gap-2">
        <input type="checkbox" checked={data.skills.ranged}
              onChange={e=>setData(d=>({...d, skills:{...d.skills, ranged:e.target.checked}}))}/>
        Abilità: Distanza
      </label>
      <label className="label flex items-center gap-2">
        <input type="checkbox" checked={data.skills.arcana}
              onChange={e=>setData(d=>({...d, skills:{...d.skills, arcana:e.target.checked}}))}/>
        Abilità: Arcanismo
      </label>
    </div>
  </details>
</section>

                
                {/* Difesa — Armature */}
<section className="card">
  <details open>
    <summary className="font-semibold cursor-pointer select-none">Difesa — Armature & Riferimenti</summary>

    <div className="flex items-center justify-between mt-3">
      <div className="text-sm text-zinc-400">Seleziona l'armatura indossata (max 1). Puoi attivare l’override manuale.</div>
      <button className="btn" onClick={()=>setData(d=>({...d, armors:[...d.armors, {
        id:uid(), name:'', tipo:'Leggera', qualita:'Comune',
        ...defaultsForArmorType('Leggera'),
        durVal:0, effettoMagico:'', notes:defaultsForArmorType('Leggera').note,
        equipped:false, collapsed:false, useOverride:false
      }]}))}>
        + Aggiungi armatura
      </button>
    </div>

    <div className="space-y-2 mt-3">
      {data.armors.length===0 && <div className="text-sm text-zinc-500">Nessuna armatura inserita.</div>}
      {data.armors.map(a=>{
        const autoD6 = armorEffectiveD6Auto(a.tipo, a.qualita)
        const effD6 = a.useOverride ? (a.bonusD6||0) : autoD6
        return (
          <div key={a.id} className="rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between p-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">
                  {a.name || 'Armatura senza nome'} — {a.tipo} — {a.qualita}
                  {a.collapsed && (
                    <span className="text-xs text-zinc-400 ml-2">• Durabilità: {a.durVal}/{a.durMax}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="label flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!a.equipped}
                    onChange={e=>setData(d=>{
                      const next = d.armors.map(x => x.id===a.id ? { ...x, equipped:e.target.checked } : { ...x, equipped:false })
                      if (!e.target.checked) return { ...d, armors: d.armors.map(x=> x.id===a.id ? { ...x, equipped:false } : x) }
                      return { ...d, armors: next }
                    })}/>
                  Equip. (max 1)
                </label>
                <button className="btn !bg-zinc-800" onClick={()=>setData(d=>({...d, armors:d.armors.filter(x=>x.id!==a.id)}))}>✕</button>
                <button className="btn" onClick={()=>setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{...x, collapsed:!x.collapsed}:x)}))}>
                  {a.collapsed ? '▼' : '▲'}
                </button>
              </div>
            </div>

            {!a.collapsed && (
              <div className="p-3 border-t border-zinc-800 space-y-2">
                <div className="grid md:grid-cols-4 gap-2">
                  <div>
                    <div className="label">Nome</div>
                    <input className="input" value={a.name}
                      onChange={e=>setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{...x, name:e.target.value}:x)}))}/>
                  </div>
                  <div>
                    <div className="label">Tipo</div>
                    <select className="input" value={a.tipo}
                      onChange={e=>{
                        const t = e.target.value as ArmorTipo
                        const def = defaultsForArmorType(t)
                        setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{
                          ...x, tipo:t,
                          bonusD6: x.bonusD6 || def.bonusD6,
                          durMax: x.durMax || def.durMax,
                          penalita: x.penalita || def.penalita,
                          notes: x.notes || def.note
                        }:x)}))
                      }}>
                      {(['Leggera','Media','Pesante','Magica'] as ArmorTipo[]).map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="label">Qualità</div>
                    <select className="input" value={a.qualita}
                      onChange={e=>setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{...x, qualita: e.target.value as QualitaCategoria}:x)}))}>
                      {(['Comune','Buona','Eccellente','Maestrale','Magica','Artefatto'] as QualitaCategoria[]).map(q=><option key={q} value={q}>{q}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="label">Bonus DIF (d6) — effettivo</div>
                    <input className="input text-center" value={effD6} readOnly />
                    <div className="text-xs text-zinc-500 mt-1">
                      {a.useOverride ? 'In uso: override manuale.' : `Auto: ${autoD6}d6 (Tipo+Qualità)`}
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-2">
                  <div>
                    <div className="label">Durabilità (Clock max)</div>
                    <input className="input text-center" type="number" value={a.durMax}
                      onChange={e=>setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{...x, durMax: parseInt(e.target.value||'4')}:x)}))}/>
                  </div>
                  <div>
                    <div className="label">Durabilità (valore)</div>
                    <input className="input text-center" type="number" value={a.durVal}
                      onChange={e=>setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{...x, durVal: parseInt(e.target.value||'0')}:x)}))}/>
                  </div>
                  <div className="flex items-end">
                    <label className="label flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!a.useOverride}
                        onChange={e=>setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{...x, useOverride:e.target.checked}:x)}))}/>
                      Usa override manuale
                    </label>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-2">
                  <div>
                    <div className="label">Bonus DIF (d6) — manuale</div>
                    <input className="input text-center" type="number" value={a.bonusD6}
                      onChange={e=>setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{...x, bonusD6: parseInt(e.target.value||'0')}:x)}))}
                      disabled={!a.useOverride}/>
                  </div>
                  <div>
                    <div className="label">Penalità</div>
                    <input className="input" value={a.penalita||''}
                      onChange={e=>setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{...x, penalita:e.target.value}:x)}))}/>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-2">
                  <div>
                    <div className="label">Effetto magico (opz.)</div>
                    <input className="input" value={a.effettoMagico||''}
                      onChange={e=>setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{...x, effettoMagico:e.target.value}:x)}))}/>
                  </div>
                  <div>
                    <div className="label">Note</div>
                    <input className="input" value={a.notes||''}
                      onChange={e=>setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{...x, notes:e.target.value}:x)}))}/>
                  </div>
                </div>

                <div className="text-xs text-zinc-400">
                  * La DIF finale è calcolata automaticamente (10 + DES + <b>{a.useOverride ? 'override' : 'Tipo+Qualità'}</b>) + eventuale Mod. manuale.
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  </details>
</section>

                {/* Incantesimi & Preghiere */}
<section className="card">
  <details open>
    <summary className="font-semibold cursor-pointer select-none">Incantesimi & Preghiere</summary>
    <div className="text-sm text-zinc-400 mt-2">
      Cerca e aggiungi rapidamente i tuoi incantesimi.
    </div>

    {/* Barra ricerca */}
    <div className="grid md:grid-cols-4 gap-2 mt-3">
      <div className="md:col-span-2">
        <div className="label">Cerca per nome o testo</div>
        <input
          className="input"
          placeholder="es. Dardo, Benedizione, Purificazione…"
          value={spellQuery}
          onChange={e=>setSpellQuery(e.target.value)}
        />
      </div>
      <div>
        <div className="label">Tipo</div>
        <select className="input" value={spellKind} onChange={e=>setSpellKind(e.target.value as any)}>
          <option value="all">Tutti</option>
          <option value="Incantesimo">Incantesimi</option>
          <option value="Preghiera">Preghiere</option>
        </select>
      </div>
      <div>
        <div className="label">Tier</div>
        <select className="input" value={spellTier} onChange={e=>setSpellTier(e.target.value as any)}>
          <option value="all">Tutti</option>
          <option value="I">I</option>
          <option value="II">II</option>
          <option value="III">III</option>
          <option value="IV">IV</option>
        </select>
      </div>
    </div>

    {/* Risultati — BOX SCROLLABILE */}
    <div className="mt-3">
      <div className="label mb-1">Risultati</div>
      <div className="space-y-2 max-h-72 overflow-auto pr-1">
        {filteredSpells.length === 0 && (
          <div className="text-sm text-zinc-500">Nessun risultato.</div>
        )}
        {filteredSpells.map(s=>{
          const already = (data.spells||[]).some(ls => ls.refId === s.id)
          return (
            <div key={s.id} className="rounded-lg border border-zinc-800 p-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{s.name}</div>
                  <div className="text-xs text-zinc-400">
                    {s.kind} • Tier {s.tier}{s.school ? ` • ${s.school}` : ''}{s.foc ? ` • ${s.foc}` : ''}
                    {s.action ? ` • ${s.action}` : ''}{s.range ? ` • ${s.range}` : ''}{s.duration ? ` • ${s.duration}` : ''}
                  </div>
                </div>
                <button
                  className={`btn ${already?'!bg-zinc-800 cursor-not-allowed':''}`}
                  disabled={already}
                  onClick={()=>setData(d=>({
                    ...d,
                    spells:[...(d.spells||[]), { id: uid(), refId: s.id, notes:'' }]
                  }))}
                >
                  {already ? '✓ Aggiunto' : '+ Aggiungi'}
                </button>
              </div>
              <div className="text-sm mt-1">{s.text}</div>
            </div>
          )
        })}
      </div>
    </div>

    {/* Selezionati — BOX SCROLLABILE */}
    <div className="border-t border-zinc-800 mt-3 pt-3">
      <div className="label mb-1">Selezionati</div>
      {(data.spells||[]).length===0 && <div className="text-sm text-zinc-500">Nessun incantesimo o preghiera selezionato.</div>}
      <div className="space-y-2 max-h-72 overflow-auto pr-1">
        {(data.spells||[]).map(s=>{
          const ref = (SPELLS_DB as any[]).find(x => x.id === s.refId)
          if (!ref) return null
          return (
            <div key={s.id} className="rounded-lg border border-zinc-800 p-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{ref.name}</div>
                  <div className="text-xs text-zinc-400">
                    {ref.kind} • Tier {ref.tier}{ref.school ? ` • ${ref.school}` : ''}{ref.foc ? ` • ${ref.foc}` : ''}
                  </div>
                </div>
                <button className="btn !bg-zinc-800" onClick={()=>setData(d=>({
                  ...d,
                  spells:(d.spells||[]).filter(x=>x.id!==s.id)
                }))}>
                  Rimuovi
                </button>
              </div>
              <div className="label mt-2">Note</div>
              <input
                className="input"
                placeholder="Annotazioni rapide (variante, focus, dominio, ecc.)"
                value={s.notes||''}
                onChange={e=>setData(d=>({
                  ...d,
                  spells:(d.spells||[]).map(x=>x.id===s.id?{...x, notes:e.target.value}:x)
                }))}
              />
            </div>
          )
        })}
      </div>
    </div>
  </details>
</section>

                {/* Background */}
<section className="card">
  <details>
    <summary className="font-semibold cursor-pointer select-none">Background</summary>
    <textarea className="input min-h-24 mt-2"
      value={data.ident.background || ''}
      onChange={e=>setData(d=>({...d, ident:{...d.ident, background:e.target.value}}))}
      placeholder="Origini, storia, motivazioni…"/>
  </details>
</section>

{/* Note */}
<section className="card">
  <details>
    <summary className="font-semibold cursor-pointer select-none">Note del personaggio</summary>
    <textarea className="input min-h-28 mt-2"
      value={data.notes||''}
      onChange={e=>setData(d=>({...d, notes:e.target.value}))}
      placeholder="Appunti, legami, clock personali, ecc."/>
  </details>
</section>

              </div>
            </section>
          </SheetFrame>
          {/* ====== /CONTENUTO STAMPABILE ====== */}
        </main>
      </div>
    </div>
  )
}
