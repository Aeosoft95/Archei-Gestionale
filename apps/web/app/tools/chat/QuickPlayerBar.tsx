'use client'

import { useEffect, useMemo, useState } from 'react'

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

export default function QuickPlayerBar() {
  const [data, setData] = useState<PCData | null>(null)
  const [loading, setLoading] = useState(true)

  // helper per salvare su LS in modo consistente
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

    // se cambia LS da un’altra tab, allinea
    function onStorage(e: StorageEvent){
      if (e.key !== LS_SHEET || !e.newValue) return
      try {
        const ov: PCData = JSON.parse(e.newValue)
        if (ov?.current) {
          setData(prev=>{
            if (!prev) return prev
            return {
              ...prev,
              current: { ...prev.current, ...ov.current }
            }
          })
        }
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => { alive = false; window.removeEventListener('storage', onStorage) }
  }, [])

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
        <div className="text-sm text-zinc-500">Nessuna scheda trovata. Apri la <a className="text-indigo-400 underline" href="/player/sheet">Scheda Personaggio</a> e salva.</div>
      </div>
    )
  }

  const A = data.attrs

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Scheda Personaggio (Essential)</div>
        <a className="btn" href="/player/sheet">Apri scheda</a>
      </div>

      <div className="flex items-start gap-3">
        {/* Ritratto quadrato piccolo */}
        <div className="w-16 h-16 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 shrink-0">
          {portrait ? (
            <img src={portrait} alt="" className="w-full h-full object-cover" />
          ) : null}
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

          {/* === EDIT VELOCE: HP residui + DIF residua === */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {/* HP residui */}
            <div className="bg-zinc-900/50 rounded-lg p-2">
              <div className="text-xs text-zinc-400">HP residui</div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  className="btn !bg-zinc-800 px-2"
                  onClick={()=>{
                    const curr = typeof data.current?.hp === 'number' ? data.current.hp : 0
                    patchCurrent({ hp: clamp(curr-1, 0, hpMaxSuggested) })
                  }}
                >−</button>
                <input
                  type="number"
                  className="input !h-8"
                  value={typeof data.current?.hp === 'number' ? data.current.hp : 0}
                  onChange={(e)=>{
                    const v = parseInt(e.target.value || '0', 10)
                    patchCurrent({ hp: clamp(isNaN(v)?0:v, 0, hpMaxSuggested) })
                  }}
                />
                <span className="text-xs text-zinc-500">/ {hpMaxSuggested}</span>
                <button
                  className="btn !bg-zinc-800 px-2"
                  onClick={()=>{
                    const curr = typeof data.current?.hp === 'number' ? data.current.hp : 0
                    patchCurrent({ hp: clamp(curr+1, 0, hpMaxSuggested) })
                  }}
                >+</button>
              </div>
            </div>

            {/* DIF residua (modificatore) */}
            <div className="bg-zinc-900/50 rounded-lg p-2">
              <div className="text-xs text-zinc-400">DIF residua</div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  className="btn !bg-zinc-800 px-2"
                  onClick={()=>{
                    const curr = typeof data.current?.difMod === 'number' ? data.current.difMod! : 0
                    patchCurrent({ difMod: curr - 1 })
                  }}
                >−</button>
                <input
                  type="number"
                  className="input !h-8"
                  value={typeof data.current?.difMod === 'number' ? data.current.difMod! : 0}
                  onChange={(e)=>{
                    const v = parseInt(e.target.value || '0', 10)
                    patchCurrent({ difMod: isNaN(v) ? 0 : v })
                  }}
                />
                <span className="text-xs text-zinc-500">= {difFinal}</span>
                <button
                  className="btn !bg-zinc-800 px-2"
                  onClick={()=>{
                    const curr = typeof data.current?.difMod === 'number' ? data.current.difMod! : 0
                    patchCurrent({ difMod: curr + 1 })
                  }}
                >+</button>
              </div>
            </div>
          </div>
          {/* === /EDIT VELOCE === */}

          {/* Armi equipaggiate: pool + danni brevi */}
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
  )
}
