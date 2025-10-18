'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SideNav from '@/components/SideNav'
import BackButton from '@/components/BackButton'
import LogoutButton from '@/components/LogoutButton'
import {
  derivedStats,
  buildAttackPool,
  buildDefensePool,
  type Attrs,
  clamp,
} from '@/components/pc/CharacterCalculators'

// ====== Tipi ======
type Weapon = {
  id: string
  name: string
  qualityTheoBonus: number   // bonus teorico da qualità (0..4 tipicamente)
  damage: number             // danno base arma (segmenti) – per riferimento
  usesDES?: boolean          // usa DES al posto di FOR
  notes?: string
  equipped?: boolean         // max 3 equipaggiate
}
type Armor = {
  id: string
  type: string
  bonus: number              // bonus armatura al DIF
  notes?: string
  equipped?: boolean         // max 1 equipaggiata
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
  attrs: Attrs
  // abilità (semplici flag per attacco)
  skills: { melee: boolean; ranged: boolean; arcana: boolean }
  // LISTE
  weapons: Weapon[]
  armors: Armor[]

  // stato “attuale” modificabile dal player
  current: {
    hp: number
    armorBonus: number // bonus armatura attuale (consuma/danneggia/penalità)
  }

  // note libere
  notes?: string
}

const EMPTY: PCData = {
  ident: { name: '', race: '', clazz: '', level: 1, background: '', portraitUrl: '' },
  attrs: { FOR: 0, DES: 0, COS: 0, INT: 0, SAP: 0, CAR: 0 },
  skills: { melee: false, ranged: false, arcana: false },
  weapons: [],
  armors: [],
  current: { hp: 10, armorBonus: 0 },
  notes: '',
}

// ====== Helpers ======
const uid = () => Math.random().toString(36).slice(2, 9)
const centerNum = 'text-center' // classe per centrare i numeri

export default function PlayerSheetPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<PCData>(EMPTY)

  // Carica dati via API; se 401 → login
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/player/sheet', { cache: 'no-store' })
        if (res.status === 401) {
          router.push('/auth/login')
          return
        }
        if (!res.ok) throw new Error('fetch error')
        const js = await res.json()
        if (!alive) return

        // normalizza liste
        const inData: PCData = js.data ?? EMPTY
        inData.weapons = Array.isArray(inData.weapons) ? inData.weapons.map(w => ({ id: w.id || uid(), ...w })) : []
        inData.armors = Array.isArray(inData.armors) ? inData.armors.map(a => ({ id: a.id || uid(), ...a })) : []
        if (!inData.current) inData.current = { hp: 10, armorBonus: 0 }

        setData(inData)
      } catch {
        // opzionale: toast error
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [router])

  // Derivati: DIF include il bonus totale armatura equip + eventuale “armorBonus” attuale
  const equippedArmor = useMemo(() => data.armors.find(a => a.equipped) || null, [data.armors])
  const totalArmorBonus = (equippedArmor?.bonus || 0) + (data.current?.armorBonus || 0)

  const { HP: baseHP, DIF: baseDIF, FOC } = useMemo(() => {
    return derivedStats(data.ident.level || 1, data.attrs, totalArmorBonus)
  }, [data.ident.level, data.attrs, totalArmorBonus])

  // HP attuali: se non settati usa base
  const currentHP = data.current?.hp ?? baseHP

  // Difesa: calcolo pool per il valore attuale di DIF
  const quickDefense = buildDefensePool({ DIF: baseDIF, focSpent: false })
  const quickDefenseFOC = buildDefensePool({ DIF: baseDIF, focSpent: true })

  // Attacco: helper per calcolare pool arma
  function calcAttackForWeapon(w: Weapon) {
    const primary = w.usesDES ? (data.attrs.DES || 0) : (data.attrs.FOR || 0)
    const hasSkill = w.usesDES ? (data.skills.ranged || data.skills.melee) : data.skills.melee
    return {
      noFOC: buildAttackPool({
        primaryAttr: primary,
        hasSkill,
        weaponTheoBonus: w.qualityTheoBonus || 0,
        focSpent: false,
      }),
      yesFOC: buildAttackPool({
        primaryAttr: primary,
        hasSkill,
        weaponTheoBonus: w.qualityTheoBonus || 0,
        focSpent: true,
      }),
    }
  }

  async function save() {
    setSaving(true)
    try {
      const attrs: Attrs = {
        FOR: clamp(data.attrs.FOR, 0, 15),
        DES: clamp(data.attrs.DES, 0, 15),
        COS: clamp(data.attrs.COS, 0, 15),
        INT: clamp(data.attrs.INT, 0, 15),
        SAP: clamp(data.attrs.SAP, 0, 15),
        CAR: clamp(data.attrs.CAR, 0, 15),
      }

      // mantieni max 3 armi equipaggiate, max 1 armatura equip
      const equippedWeapons = data.weapons.filter(w => w.equipped)
      if (equippedWeapons.length > 3) {
        // dis-equipaggiamo gli extra (oltre i primi 3)
        const toUnequip = new Set(equippedWeapons.slice(3).map(w => w.id))
        data.weapons = data.weapons.map(w => (toUnequip.has(w.id) ? { ...w, equipped: false } : w))
      }
      const alreadyEquippedArmor = data.armors.filter(a => a.equipped)
      if (alreadyEquippedArmor.length > 1) {
        const toUnequip = new Set(alreadyEquippedArmor.slice(1).map(a => a.id))
        data.armors = data.armors.map(a => (toUnequip.has(a.id) ? { ...a, equipped: false } : a))
      }

      const payload: PCData = {
        ...data,
        attrs,
        current: {
          hp: clamp(currentHP, 0, 999),
          armorBonus: clamp(data.current?.armorBonus || 0, -50, 50),
        },
      }

      const res = await fetch('/api/player/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 401) {
        router.push('/auth/login')
        return
      }
      if (!res.ok) throw new Error('save error')
      alert('Scheda salvata ✅')
    } catch {
      alert('Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  // UI helpers
  const equippedWeapons = data.weapons.filter(w => w.equipped)
  const equipWeaponsCount = equippedWeapons.length
  const canEquipMoreWeapons = equipWeaponsCount < 3

  const armorEquippedCount = data.armors.filter(a => a.equipped).length
  const canEquipArmor = armorEquippedCount < 1

  if (loading) {
    return (
      <div className="flex">
        {/* SideBar */}
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
      {/* SideNav a sinistra */}
      <aside className="bg-zinc-950/60 border-r border-zinc-800 p-4 w-64 hidden md:block">
        <div className="text-xl font-semibold mb-4">Menu</div>
        <SideNav />
      </aside>

      <div className="flex-1">
        {/* Topbar minimale coerente con app */}
        <div className="border-b border-zinc-800 p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BackButton />
            <div className="text-lg font-semibold">Scheda Personaggio</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/tools/chat" className="btn !bg-zinc-800">↩︎ Chat</Link>
            <button className="btn" onClick={save} disabled={saving}>
              {saving ? 'Salvo…' : '💾 Salva'}
            </button>
            <LogoutButton />
          </div>
        </div>

        <main className="max-w-6xl mx-auto p-4 space-y-4">
          {/* Identità */}
          <section className="card grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <div className="label">Nome</div>
              <input
                className="input"
                value={data.ident.name}
                onChange={e => setData(d => ({ ...d, ident: { ...d.ident, name: e.target.value } }))}
              />
            </div>
            <div>
              <div className="label">Razza</div>
              <input
                className="input"
                value={data.ident.race}
                onChange={e => setData(d => ({ ...d, ident: { ...d.ident, race: e.target.value } }))}
              />
            </div>
            <div>
              <div className="label">Classe</div>
              <input
                className="input"
                value={data.ident.clazz}
                onChange={e => setData(d => ({ ...d, ident: { ...d.ident, clazz: e.target.value } }))}
              />
            </div>
            <div>
              <div className="label">Livello</div>
              <input
                className={`input ${centerNum}`}
                type="number"
                min={1}
                value={data.ident.level}
                onChange={e =>
                  setData(d => ({
                    ...d,
                    ident: { ...d.ident, level: parseInt(e.target.value || '1') },
                  }))
                }
              />
              {data.ident.level >= 7 && (
                <div className="mt-1 text-green-400 text-sm font-semibold">Evoluzione raggiunta!</div>
              )}
            </div>

            {/* Ritratto PG (solo se L7+) */}
            {data.ident.level >= 7 && (
              <div className="sm:col-span-2 lg:col-span-4">
                <div className="label">Ritratto PG (URL)</div>
                <input
                  className="input"
                  placeholder="https://…"
                  value={data.ident.portraitUrl || ''}
                  onChange={e => setData(d => ({ ...d, ident: { ...d.ident, portraitUrl: e.target.value } }))}
                />
                {data.ident.portraitUrl?.trim() && (
                  <div className="mt-2 w-full h-40 rounded-xl overflow-hidden border border-zinc-800">
                    <img
                      src={data.ident.portraitUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Attributi + Derivate */}
          <section className="grid lg:grid-cols-[1fr_430px] gap-4">
            {/* Attributi */}
            <div className="card">
              <div className="font-semibold mb-3">Attributi</div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {(['FOR', 'DES', 'COS', 'INT', 'SAP', 'CAR'] as (keyof Attrs)[]).map((k) => (
                  <div key={k}>
                    <div className="label">{k}</div>
                    <input
                      className={`input ${centerNum}`}
                      type="number"
                      value={data.attrs[k]}
                      onChange={e =>
                        setData(d => ({
                          ...d,
                          attrs: { ...d.attrs, [k]: parseInt(e.target.value || '0') },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Valori Derivati + controllo stato attuale */}
            <div className="card space-y-3">
              <div className="font-semibold">Valori derivati</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="label">HP (base)</div>
                  <div className="text-xl">{baseHP}</div>
                </div>
                <div>
                  <div className="label">DIF (attuale)</div>
                  <div className="text-xl">{baseDIF}</div>
                  <div className="text-xs text-zinc-400 mt-1">
                    Pool difesa: {quickDefense.real} reali / {quickDefense.theo} teorici — soglia {quickDefense.threshold}
                  </div>
                </div>
                <div>
                  <div className="label">FOC</div>
                  <div className="text-xl">{FOC}</div>
                </div>
              </div>

              {/* Box controlli attuali */}
              <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-3">
                <div>
                  <div className="label">HP attuali (modificabili)</div>
                  <input
                    className={`input ${centerNum}`}
                    type="number"
                    value={currentHP}
                    onChange={e =>
                      setData(d => ({
                        ...d,
                        current: { ...d.current, hp: parseInt(e.target.value || '0') },
                      }))
                    }
                  />
                </div>
                <div>
                  <div className="label">Bonus armatura attuale (Δ)</div>
                  <input
                    className={`input ${centerNum}`}
                    type="number"
                    value={data.current?.armorBonus || 0}
                    onChange={e =>
                      setData(d => ({
                        ...d,
                        current: { ...d.current, armorBonus: parseInt(e.target.value || '0') },
                      }))
                    }
                  />
                  <div className="text-xs text-zinc-400 mt-1">
                    Influenza il DIF: bonus equip + questo valore.
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Attacco — Armi */}
          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Attacco — Armi</div>
              <button
                className="btn"
                onClick={() =>
                  setData(d => ({
                    ...d,
                    weapons: [
                      ...d.weapons,
                      { id: uid(), name: '', qualityTheoBonus: 0, damage: 1, usesDES: false, notes: '', equipped: false },
                    ],
                  }))
                }
              >
                + Aggiungi arma
              </button>
            </div>

            <div className="space-y-3">
              {data.weapons.length === 0 && (
                <div className="text-sm text-zinc-500">Nessuna arma inserita.</div>
              )}
              {data.weapons.map((w) => {
                const pools = calcAttackForWeapon(w)
                return (
                  <div key={w.id} className="rounded-xl border border-zinc-800 p-3 space-y-2">
                    <div className="grid md:grid-cols-5 gap-2">
                      <input
                        className="input md:col-span-2"
                        placeholder="Nome arma"
                        value={w.name}
                        onChange={e =>
                          setData(d => ({
                            ...d,
                            weapons: d.weapons.map(x => (x.id === w.id ? { ...x, name: e.target.value } : x)),
                          }))
                        }
                      />
                      <input
                        className={`input ${centerNum}`}
                        type="number"
                        min={0}
                        max={4}
                        placeholder="Qualità (0-4)"
                        value={w.qualityTheoBonus}
                        onChange={e =>
                          setData(d => ({
                            ...d,
                            weapons: d.weapons.map(x =>
                              x.id === w.id ? { ...x, qualityTheoBonus: parseInt(e.target.value || '0') } : x
                            ),
                          }))
                        }
                      />
                      <input
                        className={`input ${centerNum}`}
                        type="number"
                        min={1}
                        placeholder="Danno"
                        value={w.damage}
                        onChange={e =>
                          setData(d => ({
                            ...d,
                            weapons: d.weapons.map(x =>
                              x.id === w.id ? { ...x, damage: parseInt(e.target.value || '1') } : x
                            ),
                          }))
                        }
                      />
                      <label className="label flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!w.usesDES}
                          onChange={e =>
                            setData(d => ({
                              ...d,
                              weapons: d.weapons.map(x =>
                                x.id === w.id ? { ...x, usesDES: e.target.checked } : x
                              ),
                            }))
                          }
                        />
                        Usa DES
                      </label>
                    </div>

                    <textarea
                      className="input"
                      placeholder="Note/incantesimi legati, proprietà, ecc."
                      value={w.notes || ''}
                      onChange={e =>
                        setData(d => ({
                          ...d,
                          weapons: d.weapons.map(x => (x.id === w.id ? { ...x, notes: e.target.value } : x)),
                        }))
                      }
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

                    <div className="flex items-center justify-between">
                      <label className="label flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!w.equipped}
                          onChange={e =>
                            setData(d => {
                              const next = d.weapons.map(x =>
                                x.id === w.id ? { ...x, equipped: e.target.checked } : x
                              )
                              // applica limite di 3
                              const eq = next.filter(x => x.equipped)
                              if (eq.length > 3) {
                                // disabilita questa spunta se superiamo il limite
                                return { ...d, weapons: d.weapons.map(x => (x.id === w.id ? { ...x, equipped: false } : x)) }
                              }
                              return { ...d, weapons: next }
                            })
                          }
                        />
                        Equipaggiata (max 3)
                      </label>

                      <button
                        className="btn !bg-zinc-800"
                        onClick={() =>
                          setData(d => ({
                            ...d,
                            weapons: d.weapons.filter(x => x.id !== w.id),
                          }))
                        }
                      >
                        ✕ Rimuovi
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Abilità di attacco globali */}
            <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3">
              <label className="label flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={data.skills.melee}
                  onChange={e => setData(d => ({ ...d, skills: { ...d.skills, melee: e.target.checked } }))}
                />
                Abilità: Armi da mischia
              </label>
              <label className="label flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={data.skills.ranged}
                  onChange={e => setData(d => ({ ...d, skills: { ...d.skills, ranged: e.target.checked } }))}
                />
                Abilità: Distanza
              </label>
              <label className="label flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={data.skills.arcana}
                  onChange={e => setData(d => ({ ...d, skills: { ...d.skills, arcana: e.target.checked } }))}
                />
                Abilità: Arcanismo
              </label>
            </div>

            <div className="text-xs text-zinc-400">
              * Se un’arma usa DES, come attributo di attacco si userà DES invece di FOR. Il calcolo dei d6 segue le
              regole del manuale (pool reali/teorici & soglia).
            </div>
          </section>

          {/* Difesa — Armature e Riferimenti */}
          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Difesa — Armature & Riferimenti</div>
              <button
                className="btn"
                onClick={() =>
                  setData(d => ({
                    ...d,
                    armors: [...d.armors, { id: uid(), type: '', bonus: 0, notes: '', equipped: false }],
                  }))
                }
              >
                + Aggiungi armatura
              </button>
            </div>

            <div className="space-y-3">
              {data.armors.length === 0 && <div className="text-sm text-zinc-500">Nessuna armatura inserita.</div>}
              {data.armors.map(a => (
                <div key={a.id} className="rounded-xl border border-zinc-800 p-3 space-y-2">
                  <div className="grid md:grid-cols-3 gap-2">
                    <input
                      className="input"
                      placeholder="Tipo (leggera/media/pesante/magica…)"
                      value={a.type}
                      onChange={e =>
                        setData(d => ({
                          ...d,
                          armors: d.armors.map(x => (x.id === a.id ? { ...x, type: e.target.value } : x)),
                        }))
                      }
                    />
                    <input
                      className={`input ${centerNum}`}
                      type="number"
                      placeholder="Bonus"
                      value={a.bonus}
                      onChange={e =>
                        setData(d => ({
                          ...d,
                          armors: d.armors.map(x => (x.id === a.id ? { ...x, bonus: parseInt(e.target.value || '0') } : x)),
                        }))
                      }
                    />
                    <label className="label flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!a.equipped}
                        onChange={e =>
                          setData(d => {
                            // Consentire una sola armatura equip (max 1)
                            const next = d.armors.map(x =>
                              x.id === a.id ? { ...x, equipped: e.target.checked } : { ...x, equipped: false }
                            )
                            if (!e.target.checked) {
                              // se si deseleziona l'ultima, tutto a false
                              return { ...d, armors: d.armors.map(x => (x.id === a.id ? { ...x, equipped: false } : x)) }
                            }
                            return { ...d, armors: next }
                          })
                        }
                      />
                      Equipaggiata (max 1)
                    </label>
                  </div>
                  <textarea
                    className="input"
                    placeholder="Note/penalità, speciali, ecc."
                    value={a.notes || ''}
                    onChange={e =>
                      setData(d => ({
                        ...d,
                        armors: d.armors.map(x => (x.id === a.id ? { ...x, notes: e.target.value } : x)),
                      }))
                    }
                  />
                  <div className="flex justify-end">
                    <button
                      className="btn !bg-zinc-800"
                      onClick={() => setData(d => ({ ...d, armors: d.armors.filter(x => x.id !== a.id) }))}
                    >
                      ✕ Rimuovi
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Riepilogo difesa rapido */}
            <div className="grid sm:grid-cols-2 gap-2 border-t border-zinc-800 pt-3">
              <div className="rounded-xl border border-zinc-800 p-3">
                <div className="text-sm text-zinc-400 mb-1">Difesa (senza FOC)</div>
                <div className="text-lg font-semibold">
                  {quickDefense.real} reali / {quickDefense.theo} teorici — soglia {quickDefense.threshold}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 p-3">
                <div className="text-sm text-zinc-400 mb-1">Difesa (con FOC)</div>
                <div className="text-lg font-semibold">
                  {quickDefenseFOC.real} reali / {quickDefenseFOC.theo} teorici — soglia {quickDefenseFOC.threshold}
                </div>
              </div>
            </div>
          </section>

          {/* Incantesimi & Preghiere (placeholder) */}
          <section className="card">
            <div className="font-semibold mb-2">Incantesimi & Preghiere</div>
            <div className="text-sm text-zinc-400">
              Qui inseriremo il tool di ricerca/aggiunta rapida con tutto il catalogo dal manuale. Per ora, usa le note
              dell’arma o del personaggio per tenerne traccia.
            </div>
          </section>

          {/* Background (spostato) */}
          <section className="card">
            <div className="font-semibold mb-2">Background</div>
            <textarea
              className="input min-h-24"
              value={data.ident.background || ''}
              onChange={e => setData(d => ({ ...d, ident: { ...d.ident, background: e.target.value } }))}
              placeholder="Origini, storia, motivazioni…"
            />
          </section>

          {/* Note libere */}
          <section className="card">
            <div className="font-semibold mb-2">Note del personaggio</div>
            <textarea
              className="input min-h-28"
              value={data.notes || ''}
              onChange={e => setData(d => ({ ...d, notes: e.target.value }))}
              placeholder="Appunti, legami, clock personali, ecc."
            />
          </section>
        </main>
      </div>
    </div>
  )
}
