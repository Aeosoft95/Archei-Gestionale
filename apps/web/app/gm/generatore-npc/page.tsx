'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useWS } from '@/components/ws/WSProvider'

/** =========================
 *  Tipi & Costanti
 *  ========================= */
type NpcTipo = 'Minore' | 'Secondario' | 'Maggiore' | 'Iconico/Leggendario'
type Npc = {
  id: string
  nome: string
  ruolo: string
  motivazione: string
  difetto: string
  segreto: string
  tipo: NpcTipo
  pool: number
  clockNome: string
  clockSegmenti: number
  legameSegmenti: number
  tratti?: string[]
  imageUrl?: string
}

const uid = () => Math.random().toString(36).slice(2, 9)
const clamp = (v:number, min:number, max:number) => Math.max(min, Math.min(max, v))

const TRATTI = ['Ambizioso','Corrotto','Leale','Cinico','Idealista','Spezzato']
const MOTIVAZIONI_NASCOSTE = ['Vendetta','Amore','Potere','Fede','Denaro','Conoscenza']

const SUGG: Record<NpcTipo, { pool:number, clockMin:number, clockMax:number }> = {
  'Minore':              { pool: 2, clockMin: 2, clockMax: 4 },
  'Secondario':          { pool: 3, clockMin: 4, clockMax: 6 },
  'Maggiore':            { pool: 4, clockMin: 6, clockMax: 8 },
  'Iconico/Leggendario': { pool: 5, clockMin: 8, clockMax:10 },
}

// per-room localStorage
const keyFor = (base:string, room?:string) => `${base}:${room || 'default'}`
const LS_DRAFT = 'archei:gm:npc:draft'
const LS_LIST  = 'archei:gm:npc:list'

export default function GeneratoreNPCPage(){
  const { config, connected, openSetup, send } = useWS()
  const room = config?.room || 'default'

  // Opzioni invio in chat
  const [sendOpts, setSendOpts] = useState({
    image: true,
    name:  true,
    ruolo: false,
    descrAuto: true,
  })

  // Draft
  const [draft, setDraft] = useState<Npc>(()=>({
    id: uid(),
    nome: '',
    ruolo: '',
    motivazione: '',
    difetto: '',
    segreto: '',
    tipo: 'Secondario',
    pool: SUGG['Secondario'].pool,
    clockNome: 'Evoluzione',
    clockSegmenti: 4,
    legameSegmenti: 0,
    tratti: [],
    imageUrl: '',
  }))

  // Elenco salvati
  const [lista, setLista] = useState<Npc[]>([])

  // Autosave
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleSave = (fn:()=>void) => { if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(fn, 250) }

  // Restore
  useEffect(()=> {
    try {
      const d = JSON.parse(localStorage.getItem(keyFor(LS_DRAFT, room)) || 'null')
      if (d) setDraft(d)
    } catch {}
    try {
      const l = JSON.parse(localStorage.getItem(keyFor(LS_LIST, room)) || '[]')
      if (Array.isArray(l)) setLista(l)
    } catch {}
  }, [room])

  // Persist
  useEffect(()=> { scheduleSave(()=> localStorage.setItem(keyFor(LS_DRAFT, room), JSON.stringify(draft))) }, [draft, room])
  useEffect(()=> { scheduleSave(()=> localStorage.setItem(keyFor(LS_LIST, room), JSON.stringify(lista))) }, [lista, room])

  // Helpers
  function upd<K extends keyof Npc>(key:K, val:Npc[K]){ setDraft(d=>({ ...d, [key]: val })) }
  function updOpt<K extends keyof typeof sendOpts>(k:K, v:boolean){ setSendOpts(s=>({ ...s, [k]: v })) }

  function applyTipo(t:NpcTipo){
    const sug = SUGG[t]
    setDraft(d=>({
      ...d,
      tipo: t,
      pool: sug.pool,
      clockSegmenti: clamp(d.clockSegmenti, sug.clockMin, sug.clockMax)
    }))
  }

  function generaRapido(){
    const tratto1 = TRATTI[Math.floor(Math.random()*TRATTI.length)]
    let tratto2 = TRATTI[Math.floor(Math.random()*TRATTI.length)]
    if (tratto2 === tratto1) tratto2 = TRATTI[(TRATTI.indexOf(tratto2)+1) % TRATTI.length]
    const motiv = MOTIVAZIONI_NASCOSTE[Math.floor(Math.random()*MOTIVAZIONI_NASCOSTE.length)]

    setDraft(d=>({
      ...d,
      nome: d.nome || suggerisciNome(d.tipo),
      ruolo: d.ruolo || suggerisciRuolo(d.tipo),
      motivazione: d.motivazione || motiv,
      difetto: d.difetto || tratto2,
      segreto: d.segreto || 'Nasconde un legame con un Clock del Master',
      tratti: Array.from(new Set([...(d.tratti||[]), tratto1, tratto2])),
    }))
  }

  function suggerisciNome(tipo:NpcTipo){
    const base = {
      'Minore': ['Kara','Borin','Elia','Tamos','Renn','Lysa'],
      'Secondario': ['Ulmir','Saira','Nereth','Garruk','Valen','Mira'],
      'Maggiore': ['Tal’Dar','Iolanthe','Korvus','Seraph','Dulak','Ared'],
      'Iconico/Leggendario': ['Eidolon','Astrael','Nyx','Oraclum','Helion','Vesper']
    }[tipo]
    return base[Math.floor(Math.random()*base.length)]
  }
  function suggerisciRuolo(tipo:NpcTipo){
    const base = {
      'Minore': ['Locandiere','Soldato','Contadino','Messaggero'],
      'Secondario': ['Guida','Rivale','Alleato temporaneo','Informato'],
      'Maggiore': ['Comandante','Mago','Antagonista','Mentore'],
      'Iconico/Leggendario': ['Re','Divinità','Eroe caduto','Avatar di un’idea']
    }[tipo]
    return base[Math.floor(Math.random()*base.length)]
  }

  function salvaInElenco(){
    setLista(list => {
      const exists = list.some(n=>n.id===draft.id)
      return exists ? list.map(n=> n.id===draft.id ? draft : n) : [...list, draft]
    })
  }
  function nuovoDraft(){
    setDraft({
      id: uid(),
      nome: '',
      ruolo: '',
      motivazione: '',
      difetto: '',
      segreto: '',
      tipo: 'Secondario',
      pool: SUGG['Secondario'].pool,
      clockNome: 'Evoluzione',
      clockSegmenti: 4,
      legameSegmenti: 0,
      tratti: [],
      imageUrl: '',
    })
  }
  function elimina(id:string){ setLista(list => list.filter(n=>n.id!==id)) }
  function carica(id:string){ const n = lista.find(x=>x.id===id); if(n) setDraft(n) }

  // Descrizione breve auto
  function descrizioneBreve(n:npcLike){
    const parts:string[] = []
    const nomeruolo = [n.nome || 'PNG', n.ruolo].filter(Boolean).join(', ')
    if (nomeruolo) parts.push(nomeruolo + '.')
    if (n.motivazione) parts.push(`Motivato da ${n.motivazione.toLowerCase()}.`)
    if (n.difetto) parts.push(`Difetto: ${n.difetto.toLowerCase()}.`)
    if (n.tratti && n.tratti.length) parts.push(`Tratti: ${n.tratti.slice(0,2).join(', ')}.`)
    return parts.join(' ')
  }
  type npcLike = Pick<Npc,'nome'|'ruolo'|'motivazione'|'difetto'|'tratti'>

  // Invia in chat secondo opzioni
  function inviaInChat(){
    if (!connected || !config) return
    const righe:string[] = []

    if (sendOpts.image && draft.imageUrl) {
      // La chat mostra testo: includo URL accanto al nome per click rapido
      righe.push(`📷 ${draft.nome || '(NPC)'} — ${draft.imageUrl}`)
    }
    if (sendOpts.name) {
      const head = `🧑‍🎭 ${draft.nome || '(NPC)'}${sendOpts.ruolo ? ` — ${draft.ruolo || 'ruolo n/d'}` : ''} (${draft.tipo})`
      righe.push(head)
    }
    if (sendOpts.descrAuto) {
      const d = descrizioneBreve(draft)
      if (d) righe.push(d)
    }

    // Sempre utile: minimo contesto se non si è selezionato nulla
    if (righe.length === 0) righe.push(`🧑‍🎭 ${draft.nome || '(NPC)'} — ${draft.ruolo || 'ruolo n/d'}`)

    const text = righe.join('\n')
    send({ t:'chat:msg', room: config.room, nick: config.nick, text, ts: Date.now(), channel:'global' })
  }

  // Suggerimento range clock
  const clockRange = useMemo(()=>{
    const s = SUGG[draft.tipo]
    return `${s.clockMin}-${s.clockMax}`
  }, [draft.tipo])

  return (
    <div className="min-h-screen flex flex-col gap-4">
      {/* TOPBAR */}
      <div className="border-b border-zinc-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">ARCHEI — Generatore NPC</div>
          <button className="btn !bg-zinc-800" onClick={openSetup}>WS</button>
          <WsBadge connected={connected}/>
        </div>
        <div className="text-xs text-zinc-500">GM</div>
      </div>

      {/* DUE COLONNE */}
      <div className="grid xl:grid-cols-[1.1fr_1fr] gap-4 flex-1 min-h-0 px-2 sm:px-0">
        {/* EDITOR */}
        <div className="card space-y-4">
          <div className="font-semibold">Scheda PNG</div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="label">Nome</div>
              <input className="input" value={draft.nome} onChange={e=>upd('nome', e.target.value)} placeholder="Es. Ulmir Tal’Dar"/>
            </div>
            <div>
              <div className="label">Ruolo</div>
              <input className="input" value={draft.ruolo} onChange={e=>upd('ruolo', e.target.value)} placeholder="Es. Mercenario esiliato"/>
            </div>

            <div>
              <div className="label">Tipo</div>
              <select className="input" value={draft.tipo} onChange={e=>applyTipo(e.target.value as NpcTipo)}>
                <option>Minore</option>
                <option>Secondario</option>
                <option>Maggiore</option>
                <option>Iconico/Leggendario</option>
              </select>
              <div className="text-xs text-zinc-500 mt-1">Suggerimento clock: {clockRange} segmenti</div>
            </div>
            <div>
              <div className="label">Pool (d6)</div>
              <input className="input" type="number" min={1} max={10} value={draft.pool}
                     onChange={e=>upd('pool', clamp(parseInt(e.target.value||'1'),1,10))}/>
              <div className="text-xs text-zinc-500 mt-1">PNG tirano con successo a 5+</div>
            </div>

            <div className="sm:col-span-2">
              <div className="label">Motivazione</div>
              <input className="input" value={draft.motivazione} onChange={e=>upd('motivazione', e.target.value)} placeholder="Ciò che desidera sopra ogni cosa"/>
            </div>
            <div>
              <div className="label">Difetto</div>
              <input className="input" value={draft.difetto} onChange={e=>upd('difetto', e.target.value)} placeholder="Debolezza/ossessione"/>
            </div>
            <div>
              <div className="label">Segreto</div>
              <input className="input" value={draft.segreto} onChange={e=>upd('segreto', e.target.value)} placeholder="Cosa può scoprire il party"/>
            </div>

            <div>
              <div className="label">Clock personale — Nome</div>
              <input className="input" value={draft.clockNome} onChange={e=>upd('clockNome', e.target.value)} placeholder="Es. Redenzione / Corruzione"/>
            </div>
            <div>
              <div className="label">Clock — Segmenti</div>
              <input className="input" type="number" min={2} max={10}
                     value={draft.clockSegmenti}
                     onChange={e=>upd('clockSegmenti', clamp(parseInt(e.target.value||'2'), 2, 10))}/>
            </div>

            <div>
              <div className="label">Legame iniziale (0–4)</div>
              <input className="input" type="number" min={0} max={4}
                     value={draft.legameSegmenti}
                     onChange={e=>upd('legameSegmenti', clamp(parseInt(e.target.value||'0'), 0, 4))}/>
              <div className="text-xs text-zinc-500 mt-1">Mini-clock relazione (1: diffidenza → 4: lealtà)</div>
            </div>

            <div className="sm:col-span-2">
              <div className="label">Tratti (facoltativo)</div>
              <input className="input" value={(draft.tratti||[]).join(', ')}
                     onChange={e=>upd('tratti', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))}
                     placeholder="Ambizioso, Leale, ..."/>
            </div>

            <div className="sm:col-span-2">
              <div className="label">Immagine (URL)</div>
              <input
                className="input"
                value={draft.imageUrl || ''}
                onChange={e=>upd('imageUrl', e.target.value.trim())}
                placeholder="https://…/ritratto-npc.jpg"
              />
              {draft.imageUrl ? (
                <div className="mt-2">
                  <img
                    src={draft.imageUrl}
                    alt=""
                    className="w-full max-w-xs h-40 object-cover rounded-xl border border-zinc-800"
                    onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.opacity='0.3' }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn" onClick={generaRapido}>🎲 Genera spunti</button>
            <button className="btn" onClick={salvaInElenco}>💾 Salva in elenco</button>
            <button className="btn" onClick={inviaInChat} disabled={!connected}>➡️ Invia in chat</button>
            <button className="btn !bg-zinc-800" onClick={nuovoDraft}>➕ Nuovo</button>
          </div>
        </div>

        {/* ELENCO + OPZIONI INVIO */}
        <div className="space-y-4">
          <div className="card space-y-2">
            <div className="font-semibold">Cosa mostrare in chat</div>
            <label className="label flex items-center gap-2">
              <input type="checkbox" checked={sendOpts.image} onChange={e=>updOpt('image', e.target.checked)} />
              Immagine (URL) + Nome nella stessa riga
            </label>
            <label className="label flex items-center gap-2">
              <input type="checkbox" checked={sendOpts.name} onChange={e=>updOpt('name', e.target.checked)} />
              Nome (e Ruolo se selezionato)
            </label>
            <label className="label flex items-center gap-2 pl-6">
              <input type="checkbox" checked={sendOpts.ruolo} onChange={e=>updOpt('ruolo', e.target.checked)} />
              Aggiungi Ruolo accanto al Nome
            </label>
            <label className="label flex items-center gap-2">
              <input type="checkbox" checked={sendOpts.descrAuto} onChange={e=>updOpt('descrAuto', e.target.checked)} />
              Descrizione breve auto-generata
            </label>
            <div className="text-xs text-zinc-500">
              Nota: la chat mostra testo; il link immagine sarà cliccabile dai player.
            </div>
          </div>

          <div className="card space-y-3">
            <div className="font-semibold">NPC salvati</div>
            {lista.length === 0 ? (
              <div className="text-sm text-zinc-500">Nessun NPC salvato.</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
                {lista.map(n=>(
                  <div key={n.id} className="rounded-xl border border-zinc-800 p-3 flex items-center gap-3">
                    {n.imageUrl ? (
                      <img src={n.imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg border border-zinc-800" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-zinc-800 grid place-items-center text-zinc-500">NPC</div>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{n.nome || '(senza nome)'} <span className="text-xs text-zinc-400">— {n.tipo}</span></div>
                      <div className="text-xs text-zinc-400 truncate">{n.ruolo || 'ruolo n/d'} • {n.pool}d6 • Clock: {n.clockNome || 'Evoluzione'} {n.clockSegmenti} seg.</div>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <button className="btn" onClick={()=>carica(n.id)}>Carica</button>
                      <button className="btn" onClick={()=>{ setDraft(n); inviaInChat() }} disabled={!connected}>Invia</button>
                      <button className="btn !bg-zinc-800" onClick={()=>elimina(n.id)}>✕</button>
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

/** Badge stato WS */
function WsBadge({ connected }:{ connected:boolean }){
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-400">
      <div className={`w-2.5 h-2.5 rounded-full ${connected?'bg-green-500':'bg-zinc-600'}`} />
      {connected? 'online' : 'offline'}
    </div>
  )
}
