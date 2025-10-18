'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SideNav from '@/components/SideNav'
import BackButton from '@/components/BackButton'
import LogoutButton from '@/components/LogoutButton'

// ================== Tipi ==================
type Attrs = { FOR:number; DES:number; COS:number; INT:number; SAP:number; CAR:number }

type Weapon = {
  id: string
  name: string
  quality: 0|1|2|3|4|5|6|7|8|9|10  // qualità a livelli (menu a tendina)
  damage: number                    // segmenti (solo riferimento)
  usesDES?: boolean                 // usa DES al posto di FOR
  notes?: string
  equipped?: boolean                // max 3
  collapsed?: boolean               // UI: tendina
}

type Armor = {
  id: string
  name: string
  quality: 0|1|2|3|4|5|6|7|8|9|10  // qualità a livelli (menu a tendina)
  bonus: number                     // bonus DIF base dell’armatura
  notes?: string
  equipped?: boolean                // max 1
  collapsed?: boolean               // UI: tendina
}

type Ability = {
  id: string
  name: string
  rank: 0|1|2|3|4                   // aggiornabile fino a 4
}

type PCData = {
  ident: {
    name: string
    race: string
    clazz: string
    level: number
    background?: string
    portraitUrl?: string
  }
  ap: { total:number; spent:number }     // AP ottenuti / spesi
  attrs: Attrs
  skills: { melee:boolean; ranged:boolean; arcana:boolean } // comodo per attacchi
  abilities: Ability[]                    // colonna Abilità (rank fino a 4)
  weapons: Weapon[]
  armors: Armor[]

  current: {
    hp: number
    dif: number                           // DIF attuale (EDITABILE, NON si somma all’armatura)
  }

  notes?: string
}

const EMPTY: PCData = {
  ident: { name: '', race: '', clazz: '', level: 1, portraitUrl: '', background:'' },
  ap: { total: 0, spent: 0 },
  attrs: { FOR: 0, DES: 0, COS: 0, INT: 0, SAP: 0, CAR: 0 },
  skills: { melee: false, ranged: false, arcana: false },
  abilities: [],
  weapons: [],
  armors: [],
  current: { hp: 10, dif: 10 },
  notes: '',
}

// ================== Helpers ==================
const uid = () => Math.random().toString(36).slice(2, 9)
const clamp = (n:number, a:number, b:number) => Math.max(a, Math.min(b, n))

// Derivati “base” (usati come suggerimento iniziale, ma i campi attuali sono editabili)
function derivedHP(level:number, COS:number) {
  // esempio semplice: 8 + COS + (level-1)*2 (placeholder, può essere raffinato col manuale)
  const base = 8 + COS + Math.max(0, (level-1))*2
  return Math.max(1, base)
}
function suggestedDIF(level:number, DES:number) {
  // esempio semplice: 10 + DES + floor(level/2) (placeholder per suggerimento)
  return 10 + DES + Math.floor(level/2)
}

// Pool DIF totale (mostrato come numero unico):
// - Base 10 deve contare come 1 dado, non come 10 → usiamo ceil(DIF/10), min 1
function defensePoolFromDIF(dif:number) {
  return Math.max(1, Math.ceil(dif / 10))
}

// Attacco: formula pool reale/teorico + soglia (placeholder coerente con richiesta)
// Requisito richiesto: fino a qualità 5 aumentano SOLO i dadi reali; oltre 5 vanno sui teorici
// NB: Qui qualità = “livello qualità arma” (0..10)
function buildAttackPool(params: {
  primaryAttr:number
  hasSkill:boolean
  quality:number
  focSpent:boolean
}) {
  const { primaryAttr, hasSkill, quality, focSpent } = params
  // base teorico/real determinato da attributo + skill (placeholder semplice)
  let theo = Math.max(1, Math.floor(primaryAttr / 2)) + (hasSkill ? 1 : 0)
  let real = Math.max(1, Math.floor(primaryAttr / 3)) + (hasSkill ? 1 : 0)

  // qualità: fino a 5 → real; sopra 5 → teorici
  const q = clamp(quality, 0, 10)
  const addReal = Math.min(q, 5)
  const addTheo = Math.max(0, q - 5)
  real += addReal
  theo += addTheo

  if (focSpent) {
    // con FOC aggiungiamo 1 reale (placeholder semplice)
    real += 1
  }

  const threshold = theo <= 5 ? 6 : theo <= 9 ? 5 : theo <= 19 ? 4 : 3
  return { real, theo, threshold }
}

// ================== Pagina ==================
export default function PlayerSheetPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<PCData>(EMPTY)

  // Carica dati (se 401 → login)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/player/sheet', { cache: 'no-store' })
        if (res.status === 401) {
          router.push('/auth/login')
          return
        }
        const js = await res.json()
        if (!alive) return
        const inData: PCData = js.data ?? EMPTY
        // normalizza liste
        inData.weapons = Array.isArray(inData.weapons) ? inData.weapons.map(w => ({ id: w.id || uid(), collapsed:true, ...w })) : []
        inData.armors  = Array.isArray(inData.armors)  ? inData.armors.map(a => ({ id: a.id || uid(), collapsed:true, ...a }))  : []
        inData.abilities = Array.isArray(inData.abilities) ? inData.abilities.map(a => ({ id:a.id || uid(), rank: clamp(a.rank ?? 0,0,4), name: a.name||'' })) : []
        if (!inData.ap) inData.ap = { total: 0, spent: 0 }
        if (!inData.current) inData.current = { hp: derivedHP(inData.ident.level||1, inData.attrs.COS||0), dif: suggestedDIF(inData.ident.level||1, inData.attrs.DES||0) }
        setData(inData)
      } catch {
        // ignore
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [router])

  // Suggerimenti derivati (non vincolanti)
  const sugHP  = useMemo(() => derivedHP(data.ident.level || 1, data.attrs.COS || 0), [data.ident.level, data.attrs.COS])
  const sugDIF = useMemo(() => suggestedDIF(data.ident.level || 1, data.attrs.DES || 0), [data.ident.level, data.attrs.DES])

  // Pool totale difesa: SOLO dal campo DIF attuale (NON sommare armatura)
  const totalDefensePool = useMemo(() => defensePoolFromDIF(data.current?.dif || 10), [data.current?.dif])

  // Armi equipaggiate (max 3)
  const equippedWeapons = data.weapons.filter(w => w.equipped)
  const canEquipMoreWeapons = equippedWeapons.length < 3

  // Armatura equipaggiata (max 1)
  const equippedArmorCount = data.armors.filter(a => a.equipped).length
  const canEquipArmor = equippedArmorCount < 1

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
          dif: clamp(data.current.dif, 1, 999),
        },
        weapons: data.weapons.map(w => ({
          ...w,
          quality: clamp(w.quality, 0, 10) as Weapon['quality'],
          damage: clamp(w.damage, 0, 99),
        })),
        armors: data.armors.map(a => ({
          ...a,
          quality: clamp(a.quality, 0, 10) as Armor['quality'],
          bonus: clamp(a.bonus, 0, 99),
        })),
        abilities: data.abilities.map(ab => ({
          ...ab, rank: clamp(ab.rank, 0, 4) as Ability['rank']
        })),
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
          {/* Identità + Ritratto + AP */}
          <section className="card grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

            {/* Ritratto: SEMPRE visibile da subito */}
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

            {/* AP Ottenuti / Spesi */}
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
          </section>

          {/* DUE COLONNE: Abilità | (Attributi + Derivati + Attacco + Armature) */}
          <section className="grid lg:grid-cols-[360px_1fr] gap-4">
            {/* Colonna Abilità */}
            <div className="space-y-4">
              <div className="card space-y-2">
                <div className="font-semibold">Abilità</div>
                <div className="text-xs text-zinc-400 mb-1">
                  Ogni abilità può essere migliorata fino a <b>4</b> volte. Gli sblocchi per livello saranno collegati al manuale (placeholder).
                </div>
                <button
                  className="btn"
                  onClick={()=>setData(d=>({...d, abilities:[...d.abilities, { id:uid(), name:'', rank:0 }]}))}
                >
                  + Aggiungi abilità
                </button>
                <div className="space-y-2 mt-2">
                  {data.abilities.length===0 && <div className="text-sm text-zinc-500">Nessuna abilità aggiunta.</div>}
                  {data.abilities.map(ab=>(
                    <div key={ab.id} className="rounded-xl border border-zinc-800 p-2">
                      <input
                        className="input"
                        placeholder="Nome abilità"
                        value={ab.name}
                        onChange={e=>setData(d=>({...d, abilities:d.abilities.map(x=>x.id===ab.id?{...x, name:e.target.value}:x)}))}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <div className="label">Grado</div>
                        <div className="flex items-center gap-2">
                          <button className="btn !bg-zinc-800" onClick={()=>setData(d=>({...d, abilities:d.abilities.map(x=>x.id===ab.id?{...x, rank: clamp((x.rank-1) as any, 0,4) as any}:x)}))}>−</button>
                          <div className="w-10 text-center">{ab.rank}</div>
                          <button className="btn" onClick={()=>setData(d=>({...d, abilities:d.abilities.map(x=>x.id===ab.id?{...x, rank: clamp((x.rank+1) as any, 0,4) as any}:x)}))}>+</button>
                        </div>
                        <button className="btn !bg-zinc-800" onClick={()=>setData(d=>({...d, abilities:d.abilities.filter(x=>x.id!==ab.id)}))}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Colonna destra */}
            <div className="space-y-4">
              {/* Attributi */}
              <div className="card">
                <div className="font-semibold mb-3">Attributi</div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {(['FOR','DES','COS','INT','SAP','CAR'] as (keyof Attrs)[]).map(k=>(
                    <div key={k}>
                      <div className="label">{k}</div>
                      <input className="input text-center" type="number" value={data.attrs[k]}
                             onChange={e=>setData(d=>({...d, attrs:{...d.attrs, [k]: parseInt(e.target.value||'0')}}))}/>
                    </div>
                  ))}
                </div>
              </div>

              {/* Valori Derivati + Stato attuale */}
              <div className="card space-y-3">
                <div className="font-semibold">Valori derivati</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="label">HP (suggerito)</div>
                    <div className="text-xl">{sugHP}</div>
                  </div>
                  <div>
                    <div className="label">DIF (attuale)</div>
                    <input
                      className="input text-center"
                      type="number"
                      value={data.current.dif}
                      onChange={e=>setData(d=>({...d, current:{...d.current, dif: parseInt(e.target.value||'10')}}))}
                    />
                    <div className="text-xs text-zinc-400 mt-1">
                      Pool totale difesa: <span className="text-zinc-200 font-semibold">{totalDefensePool}</span>
                    </div>
                  </div>
                  <div>
                    <div className="label">HP (attuali)</div>
                    <input
                      className="input text-center"
                      type="number"
                      value={data.current.hp}
                      onChange={e=>setData(d=>({...d, current:{...d.current, hp: parseInt(e.target.value||'0')}}))}
                    />
                  </div>
                </div>
              </div>

              {/* Attacco — Armi (collassabili) */}
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Attacco — Armi</div>
                  <button
                    className="btn"
                    onClick={()=>setData(d=>({...d, weapons:[...d.weapons, { id:uid(), name:'', quality:0, damage:1, usesDES:false, notes:'', equipped:false, collapsed:false }]}))}
                  >
                    + Aggiungi arma
                  </button>
                </div>

                <div className="space-y-2">
                  {data.weapons.length===0 && <div className="text-sm text-zinc-500">Nessuna arma inserita.</div>}
                  {data.weapons.map(w=>{
                    const primary = w.usesDES ? (data.attrs.DES||0) : (data.attrs.FOR||0)
                    const hasSkill = w.usesDES ? (data.skills.ranged||data.skills.melee) : data.skills.melee
                    const pools = {
                      noFOC: buildAttackPool({ primaryAttr:primary, hasSkill, quality:w.quality, focSpent:false }),
                      yesFOC: buildAttackPool({ primaryAttr:primary, hasSkill, quality:w.quality, focSpent:true  }),
                    }
                    return (
                      <div key={w.id} className="rounded-xl border border-zinc-800">
                        <div className="flex items-center justify-between p-2">
                          <div className="font-semibold truncate">{w.name || 'Arma senza nome'}</div>
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
                                })}
                              />
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
                            {/* Etichette sopra ai riquadri */}
                            <div className="grid md:grid-cols-5 gap-2">
                              <div>
                                <div className="label">Nome arma</div>
                                <input className="input"
                                       value={w.name}
                                       onChange={e=>setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{...x, name:e.target.value}:x)}))}
                                />
                              </div>
                              <div>
                                <div className="label">Qualità</div>
                                <select className="input"
                                        value={w.quality}
                                        onChange={e=>setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{...x, quality: parseInt(e.target.value) as any}:x)}))}
                                >
                                  {[...Array(11)].map((_,i)=><option key={i} value={i}>{i}</option>)}
                                </select>
                              </div>
                              <div>
                                <div className="label">Danno (segmenti)</div>
                                <input className="input text-center" type="number" value={w.damage}
                                       onChange={e=>setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{...x, damage:parseInt(e.target.value||'1')}:x)}))}
                                />
                              </div>
                              <div className="flex items-end">
                                <label className="label flex items-center gap-2">
                                  <input type="checkbox" checked={!!w.usesDES}
                                         onChange={e=>setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{...x, usesDES:e.target.checked}:x)}))}
                                  />
                                  Usa DES
                                </label>
                              </div>
                            </div>

                            <textarea className="input" placeholder="Proprietà/Note"
                                      value={w.notes||''}
                                      onChange={e=>setData(d=>({...d, weapons:d.weapons.map(x=>x.id===w.id?{...x, notes:e.target.value}:x)}))}
                            />

                            <div className="grid sm:grid-cols-2 gap-2">
                              <div className="rounded-lg border border-zinc-800 p-2">
                                <div className="text-sm text-zinc-400">Attacco (senza FOC)</div>
                                <div className="font-semibold">
                                  {pools.noFOC.real} reali / {pools.noFOC.theo} teorici — soglia {pools.noFOC.threshold}
                                </div>
                              </div>
                              <div className="rounded-lg border border-zinc-800 p-2">
                                <div className="text-sm text-zinc-400">Attacco (con FOC)</div>
                                <div className="font-semibold">
                                  {pools.yesFOC.real} reali / {pools.yesFOC.theo} teorici — soglia {pools.yesFOC.threshold}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Abilità di attacco globali */}
                <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3">
                  <label className="label flex items-center gap-2">
                    <input type="checkbox" checked={data.skills.melee}
                           onChange={e=>setData(d=>({...d, skills:{...d.skills, melee:e.target.checked}}))}/>
                    Abilità: Miscia
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
              </div>

              {/* Difesa — Armature (collassabili, simile alle armi) */}
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Difesa — Armature & Riferimenti</div>
                  <button
                    className="btn"
                    onClick={()=>setData(d=>({...d, armors:[...d.armors, { id:uid(), name:'', quality:0, bonus:0, notes:'', equipped:false, collapsed:false }]}))}
                  >
                    + Aggiungi armatura
                  </button>
                </div>

                <div className="space-y-2">
                  {data.armors.length===0 && <div className="text-sm text-zinc-500">Nessuna armatura inserita.</div>}
                  {data.armors.map(a=>(
                    <div key={a.id} className="rounded-xl border border-zinc-800">
                      <div className="flex items-center justify-between p-2">
                        <div className="font-semibold truncate">{a.name || 'Armatura senza nome'}</div>
                        <div className="flex items-center gap-2">
                          <label className="label flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!a.equipped}
                              onChange={e=>setData(d=>{
                                const next = d.armors.map(x => x.id===a.id ? { ...x, equipped:e.target.checked } : { ...x, equipped:false })
                                if (!e.target.checked) {
                                  return { ...d, armors: d.armors.map(x=> x.id===a.id ? { ...x, equipped:false } : x) }
                                }
                                if (d.armors.filter(x=>x.equipped).length > 1) {
                                  // forza una sola equip
                                  return { ...d, armors: next.map((x,i)=> i===next.findIndex(z=>z.id===a.id) ? {...x, equipped:true} : {...x, equipped:false}) }
                                }
                                return { ...d, armors: next }
                              })}
                            />
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
                          <div className="grid md:grid-cols-3 gap-2">
                            <div>
                              <div className="label">Nome</div>
                              <input className="input" value={a.name}
                                     onChange={e=>setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{...x, name:e.target.value}:x)}))}/>
                            </div>
                            <div>
                              <div className="label">Qualità</div>
                              <select className="input" value={a.quality}
                                      onChange={e=>setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{...x, quality: parseInt(e.target.value) as any}:x)}))}>
                                {[...Array(11)].map((_,i)=><option key={i} value={i}>{i}</option>)}
                              </select>
                            </div>
                            <div>
                              <div className="label">Bonus DIF (base armatura)</div>
                              <input className="input text-center" type="number" value={a.bonus}
                                     onChange={e=>setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{...x, bonus: parseInt(e.target.value||'0')}:x)}))}/>
                            </div>
                          </div>
                          <textarea className="input" placeholder="Note/penalità, speciali…"
                                    value={a.notes||''}
                                    onChange={e=>setData(d=>({...d, armors:d.armors.map(x=>x.id===a.id?{...x, notes:e.target.value}:x)}))}
                          />
                          <div className="text-xs text-zinc-400">
                            * Il campo <b>DIF (attuale)</b> sopra è indipendente e NON somma automaticamente l’armatura.
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Incantesimi & Preghiere (placeholder) */}
              <div className="card">
                <div className="font-semibold mb-2">Incantesimi & Preghiere</div>
                <div className="text-sm text-zinc-400">
                  Qui inseriremo il tool di ricerca/aggiunta rapida con tutto il catalogo dal manuale. (Prossimo step)
                </div>
              </div>

              {/* Background */}
              <div className="card">
                <div className="font-semibold mb-2">Background</div>
                <textarea className="input min-h-24"
                          value={data.ident.background || ''}
                          onChange={e=>setData(d=>({...d, ident:{...d.ident, background:e.target.value}}))}
                          placeholder="Origini, storia, motivazioni…"/>
              </div>

              {/* Note */}
              <div className="card">
                <div className="font-semibold mb-2">Note del personaggio</div>
                <textarea className="input min-h-28"
                          value={data.notes||''}
                          onChange={e=>setData(d=>({...d, notes:e.target.value}))}
                          placeholder="Appunti, legami, clock personali, ecc."/>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
