'use client'

import { useEffect, useMemo, useState } from 'react'
import { useWS } from '@/components/ws/WSProvider'

type Tier = 'minore' | 'medio' | 'importante' | 'leggendario'
type Gender = 'maschio' | 'femmina'

type NPC = {
  id: string
  portrait?: string
  name: string
  role: string
  gender: Gender
  personality: string
  motivation: string
  flaw: string
  secret: string
  pool: number   // d6
  clock: number  // segmenti
  tier: Tier
}

const TRAITS = ['Ambizioso','Corrotto','Leale','Cinico','Idealista','Spezzato']
const MOTIVATIONS = ['Vendetta','Amore','Potere','Fede','Denaro','Conoscenza']

const TIER_DEFAULTS: Record<Tier, { pool:number, clockMin:number, clockMax:number }> = {
  minore:       { pool: 2, clockMin: 2, clockMax: 4 },
  medio:        { pool: 3, clockMin: 4, clockMax: 6 },
  importante:   { pool: 4, clockMin: 6, clockMax: 8 },
  leggendario:  { pool: 5, clockMin: 8, clockMax: 10 },
}

const uid = () => Math.random().toString(36).slice(2,9)
const clamp = (v:number, a:number, b:number)=>Math.max(a, Math.min(b, v))

// ----- NAMES: generiamo 6000 nomi (3000 M + 3000 F) e salviamo in LS -----
type NamePools = { male: string[]; female: string[] }
const LS_NAMES = 'archei:names:v1'

/** PRNG deterministico (mulberry32) per avere una lista stabile tra le sessioni */
function seedRng(seed:number){
  let t = seed >>> 0
  return function(){
    t += 0x6D2B79F5
    let r = Math.imul(t ^ t >>> 15, 1 | t)
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r)
    return ((r ^ r >>> 14) >>> 0) / 4294967296
  }
}

function buildNamePools(): NamePools {
  // Prova a leggere da localStorage (se già generati)
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LS_NAMES)
    if (raw) {
      try { return JSON.parse(raw) as NamePools } catch {}
    }
  }

  // Sillabe maschili / femminili (miste, ma con “tendenza” stilistica)
  const startsCommon = ['Ar','Bel','Cal','Da','El','Fa','Gal','Har','Is','Ja','Ka','Lor','Mar','Nor','Or','Pal','Quel','Ra','Sol','Tor','Ul','Vor','Wil','Xan','Yor','Zan','Ald','Bar','Cor','Dor','Edr','Fen','Gor','Hal','Ish','Jor','Keld','Lys','Mor','Ner','Odr','Pyr','Quor','Ryn','Seth','Tyr','Ulf','Val','Wren','Xor','Yen','Zor']
  const startsF = ['Ara','Bri','Cae','Dae','Ela','Fae','Gwen','Hela','Ila','Jae','Kira','Lia','Mira','Nae','Olia','Phae','Qira','Rhea','Sera','Thia','Una','Vala','Wila','Xana','Yara','Zia','Alia','Corin','Elin','Fiora','Gala','Hira','Isla','Juna','Kyra','Luna','Meira','Nora','Ona','Pela','Rina','Syna','Tala','Vara','Wera','Xila','Yna','Zara']
  const middles = ['a','e','i','o','u','ae','ia','io','ea','ai','ar','er','ir','or','ur','yl','yn','an','en','in','on','un','ara','ira','ora','ura','iel','iel','ion','ean','ean','is','os','us']
  const endsCommon = ['dor','rian','mir','thor','las','ric','ran','mon','dil','drim','gar','grim','gorn','var','vor','vin','dane','thur','wen','wyn','lith','gale','driel','dren','nor','thur','dan','den','len','lor','mar','mir','nan','nar','non','ron','ros','rias','lius','tius','rius','thus','this','el','eth','ion','iel','is','as','or','ar']
  const endsF = ['wen','wyn','lith','mira','lia','nys','rien','riel','neth','lune','delle','selle','veth','belle','thys','this','elle','ellea','anna','aira','iara','eira','lyra','lina','sira','thea','melle','risa','rose','vyn','re','ria']

  function makeName(rng:()=>number, gender: Gender){
    const s = gender === 'femmina' ? (rng() < 0.6 ? startsF : startsCommon) : startsCommon
    const e = gender === 'femmina' ? (rng() < 0.7 ? endsF : endsCommon) : endsCommon
    const start = s[Math.floor(rng()*s.length)]
    const midCount = rng() < 0.8 ? 1 : 2
    let core = ''
    for (let i=0;i<midCount;i++){
      core += middles[Math.floor(rng()*middles.length)]
    }
    const end = e[Math.floor(rng()*e.length)]
    // piccole probabilità di apostrofi o doppie per “flavour”
    let name = start + core + end
    if (rng() < 0.06) name = name.replace(/([aeiou])([rlnmst])/i, "$1'$2")
    if (rng() < 0.04) name = name.replace(/([rlmn])([aeiou])$/i, "$1$1$2")
    // Capitalizzazione corretta
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  const rng = seedRng(421337) // seed fisso per risultati stabili
  const maleSet = new Set<string>()
  const femaleSet = new Set<string>()
  while (maleSet.size < 3000) maleSet.add(makeName(rng, 'maschio'))
  while (femaleSet.size < 3000) femaleSet.add(makeName(rng, 'femmina'))

  const pools: NamePools = { male: [...maleSet], female: [...femaleSet] }

  if (typeof window !== 'undefined') {
    localStorage.setItem(LS_NAMES, JSON.stringify(pools))
  }
  return pools
}

// localStorage namespaced per stanza
const keyFor = (room?: string) => `archei:gm:npcs:${room || 'default'}`

export default function GmNpcGeneratorPage(){
  const { config, connected, openSetup, error, connecting, send } = useWS()
  const room = config?.room || 'default'

  // ----- name pools (memo una volta) -----
  const namePools = useMemo(() => buildNamePools(), [])
  const [maleIdx, setMaleIdx] = useState(0)
  const [femaleIdx, setFemaleIdx] = useState(0)

  // editor state
  const [portrait, setPortrait] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [gender, setGender] = useState<Gender>('maschio')
  const [personality, setPersonality] = useState('')
  const [motivation, setMotivation] = useState('')
  const [flaw, setFlaw] = useState('')
  const [secret, setSecret] = useState('')
  const [pool, setPool] = useState(3)
  const [clock, setClock] = useState(4)
  const [tier, setTier] = useState<Tier>('medio')

  // elenco salvati
  const [saved, setSaved] = useState<NPC[]>([])

  // status WS
  const status = useMemo(()=>{
    const color = connecting ? 'bg-yellow-500' : connected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-zinc-600'
    const label = connecting ? 'conn…' : connected ? 'online' : (error ? 'errore' : 'offline')
    return <div className="flex items-center gap-2 text-xs text-zinc-400">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />{label}
    </div>
  },[connected,connecting,error])

  // load per stanza
  useEffect(()=>{ 
    try{
      const arr = JSON.parse(localStorage.getItem(keyFor(room)) || '[]')
      if (Array.isArray(arr)) setSaved(arr)
    }catch{}
    localStorage.setItem('archei:role','gm')
  },[room])

  // save helper
  const persist = (list:NPC[]) => { 
    setSaved(list)
    localStorage.setItem(keyFor(room), JSON.stringify(list))
  }

  // quando cambia tier, autopropone pool/clock minimi consigliati
  useEffect(()=>{
    const d = TIER_DEFAULTS[tier]
    setPool(d.pool)
    setClock(d.clockMin)
  },[tier])

  // generator semplice + nome dal pool per genere
  function pick<T>(arr:T[]):T { return arr[Math.floor(Math.random()*arr.length)] }
  function randInt(a:number,b:number){ return Math.floor(a + Math.random()*(b-a+1)) }

  function nextName(g: Gender){
    if (g === 'maschio') {
      const n = namePools.male[maleIdx % namePools.male.length]
      setMaleIdx(i => (i+1) % namePools.male.length)
      return n
    } else {
      const n = namePools.female[femaleIdx % namePools.female.length]
      setFemaleIdx(i => (i+1) % namePools.female.length)
      return n
    }
  }

  function quickGenerate(){
    const d = TIER_DEFAULTS[tier]
    if (!name.trim()) setName(nextName(gender))
    if (!role.trim()) setRole('Guida')
    if (!personality.trim()) setPersonality(pick(TRAITS))
    if (!motivation.trim()) setMotivation(pick(MOTIVATIONS))
    if (!flaw.trim()) setFlaw(pick(['Arroganza','Paura','Tradimento','Ossessione','Invidia','Impulsività']))
    if (!secret.trim()) setSecret(pick([
      'Debito col criminale locale',
      'Legame di sangue con un avversario',
      'Ha visto qualcosa che non doveva',
      'Protegge un oggetto proibito',
      'Identità falsa'
    ]))
    setPool(d.pool)
    setClock(randInt(d.clockMin, d.clockMax))
  }

  function resetForm(){
    setPortrait(''); setName(''); setRole(''); setPersonality(''); setMotivation(''); setFlaw(''); setSecret('')
    setTier('medio'); setPool(3); setClock(4); setGender('maschio')
  }

  function saveNPC(){
    if (!name.trim()) return
    const npc:NPC = {
      id: uid(),
      portrait: portrait.trim() || undefined,
      name: name.trim(),
      role: role.trim() || 'PNG',
      gender,
      personality: personality.trim() || '—',
      motivation: motivation.trim() || '—',
      flaw: flaw.trim() || '—',
      secret: secret.trim() || '—',
      pool: clamp(pool,2,6),
      clock: clamp(clock,2,12),
      tier,
    }
    persist([npc, ...saved])
    resetForm()
  }

  function loadNPC(n:NPC){
    setPortrait(n.portrait || '')
    setName(n.name)
    setRole(n.role)
    setGender(n.gender || 'maschio')
    setPersonality(n.personality)
    setMotivation(n.motivation)
    setFlaw(n.flaw)
    setSecret(n.secret)
    setPool(n.pool)
    setClock(n.clock)
    setTier(n.tier)
  }

  function dupNPC(n:NPC){
    const copy: NPC = { ...n, id: uid(), name: n.name + ' (copy)' }
    persist([copy, ...saved])
  }

  function delNPC(id:string){
    persist(saved.filter(s => s.id !== id))
  }

  // Invia in chat: SOLO Nome + link immagine (per ora)
  function sendToChat(n:NPC){
    if (!config) return
    const portraitLine = n.portrait ? ` — Ritratto: ${n.portrait}` : ''
    send({ t:'chat:msg', room: config.room, nick: config.nick, text:`NPC: ${n.name}${portraitLine}`, ts:Date.now(), channel:'global' })
  }

  return (
    <div className="min-h-screen flex flex-col gap-4">
      {/* TOPBAR */}
      <div className="border-b border-zinc-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">ARCHEI — Generatore NPC</div>
          <button className="btn !bg-zinc-800" onClick={openSetup}>WS</button>
          {status}
        </div>
        <div className="text-xs text-zinc-500">GM</div>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4 px-4">
        {/* EDITOR */}
        <div className="card space-y-3">
          <div className="font-semibold">Crea / Modifica</div>

          {/* Ritratto */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <div className="label">URL Ritratto (opz.)</div>
              <input className="input" placeholder="https://..." value={portrait} onChange={e=>setPortrait(e.target.value)} />
            </div>
            <div className="flex items-end">
              <div className="w-full rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40 aspect-[4/3] flex items-center justify-center">
                {portrait
                  ? <img src={portrait} alt="" className="w-full h-full object-cover" />
                  : <div className="text-xs text-zinc-500">Anteprima</div>}
              </div>
            </div>
          </div>

          {/* Nome / Ruolo / Sesso */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <div className="label">Nome</div>
              <div className="flex gap-2">
                <input className="input flex-1" value={name} onChange={e=>setName(e.target.value)} placeholder="Es. Ulmir Tal’Dar" />
                <button className="btn" onClick={()=>setName(nextName(gender))}>🎲 Nome</button>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                Pool nomi — M: {namePools.male.length} • F: {namePools.female.length}
              </div>
            </div>
            <div>
              <div className="label">Sesso</div>
              <select className="input" value={gender} onChange={e=>setGender(e.target.value as Gender)}>
                <option value="maschio">Maschio</option>
                <option value="femmina">Femmina</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="label">Ruolo</div>
              <input className="input" value={role} onChange={e=>setRole(e.target.value)} placeholder="Es. Mercante, Capitano…" />
            </div>
            <div>
              <div className="label">Personalità</div>
              <input className="input" value={personality} onChange={e=>setPersonality(e.target.value)} placeholder="Es. Leale, Cinico…" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="label">Motivazione</div>
              <input className="input" value={motivation} onChange={e=>setMotivation(e.target.value)} placeholder="Es. Vendetta, Potere…" />
            </div>
            <div>
              <div className="label">Difetto</div>
              <input className="input" value={flaw} onChange={e=>setFlaw(e.target.value)} placeholder="Es. Ossessione, Invidia…" />
            </div>
          </div>

          <div>
            <div className="label">Segreto (solo GM)</div>
            <input className="input" value={secret} onChange={e=>setSecret(e.target.value)} placeholder="Solo per te (GM)" />
          </div>

          {/* Tier / Pool / Clock */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <div className="label">Tier</div>
              <select className="input" value={tier} onChange={e=>setTier(e.target.value as Tier)}>
                <option value="minore">Minore</option>
                <option value="medio">Medio</option>
                <option value="importante">Importante</option>
                <option value="leggendario">Leggendario</option>
              </select>
            </div>
            <div>
              <div className="label">Pool (d6)</div>
              <input className="input" type="number" min={1} max={10} value={pool} onChange={e=>setPool(parseInt(e.target.value||'0'))}/>
            </div>
            <div>
              <div className="label">Clock personale (segmenti)</div>
              <input className="input" type="number" min={2} max={12} value={clock} onChange={e=>setClock(parseInt(e.target.value||'0'))}/>
            </div>
          </div>

          {/* Azioni */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn" onClick={quickGenerate}>🎲 Genera spunti</button>
            <button className="btn" onClick={saveNPC} disabled={!name.trim()}>💾 Salva NPC</button>
            <button className="btn !bg-zinc-800" onClick={resetForm}>Svuota</button>
          </div>
        </div>

        {/* LISTA SALVATI */}
        <div className="card space-y-3">
          <div className="font-semibold">NPC salvati ({saved.length})</div>

          {saved.length === 0 ? (
            <div className="text-sm text-zinc-500">Nessun NPC salvato.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {saved.map(n => (
                <div key={n.id} className="rounded-xl border border-zinc-800 p-3 bg-zinc-900/40 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-12 rounded-md overflow-hidden bg-zinc-800 flex items-center justify-center shrink-0">
                      {n.portrait ? <img src={n.portrait} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-zinc-400">—</span>}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{n.name}</div>
                      <div className="text-xs text-zinc-400 truncate">
                        {n.role} • {n.gender === 'maschio' ? '♂' : '♀'} • Pool {n.pool}d6 • Clock {n.clock}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-400 line-clamp-3">
                    {n.personality} — {n.motivation} — Difetto: {n.flaw}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button className="btn" onClick={()=>sendToChat(n)} disabled={!connected}>Invia in chat</button>
                    <button className="btn" onClick={()=>loadNPC(n)}>Carica</button>
                    <button className="btn" onClick={()=>dupNPC(n)}>Duplica</button>
                    <button className="btn !bg-zinc-800" onClick={()=>delNPC(n.id)}>Elimina</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
