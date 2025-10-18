// Calcoli base ARCHEI – v1
// Formula derivate (dal manuale):
// HP = 8 + FOR + (2 × livello)
// DIF = 10 + DES + bonusArmatura
// FOC = 3 + max(SAP, INT) + floor(livello / 3)
//
// Pool e soglia:
// - Massimo 5 dadi reali. I dadi "teorici" determinano la soglia:
//   1–5 -> 6+ | 6–9 -> 5+ | 10–19 -> 4+ | 20+ -> 3+
//
// Difesa:
// - Ogni punto di DIF oltre 10 concede +1d6 teorico al difensore.

export type Attrs = { FOR: number; DES: number; COS: number; INT: number; SAP: number; CAR: number }

export function clamp(n:number, min:number, max:number){ return Math.max(min, Math.min(max, n)) }

export function derivedStats(level:number, attrs:Attrs, armorBonus=0){
  const HP  = 8 + (attrs.FOR||0) + (2 * (level||0))
  const DIF = 10 + (attrs.DES||0) + (armorBonus||0)
  const FOC = 3 + Math.max(attrs.SAP||0, attrs.INT||0) + Math.floor((level||0)/3)
  return { HP, DIF, FOC }
}

export function thresholdFromTheo(theo:number){
  if (theo >= 20) return '3+'
  if (theo >= 10) return '4+'
  if (theo >= 6)  return '5+'
  return '6+'
}

// Attacco: base 1 dado sempre; aggiungi attributo primario, abilità, arma (teorici), FOC speso (reale +1)
export function buildAttackPool(opts:{
  primaryAttr:number,        // FOR o DES
  hasSkill:boolean,          // abilità pertinente
  weaponTheoBonus:number,    // qualità arma: 0..+4 teorici (es. Eccellente +2)
  focSpent:boolean           // se spende 1 FOC: +1 dado reale (non oltre 5)
}){
  const theo = 1 + (opts.primaryAttr||0) + (opts.hasSkill?1:0) + (opts.weaponTheoBonus||0)
  const realBase = Math.min(5, 1 + (opts.primaryAttr||0) + (opts.hasSkill?1:0)) // realistico: FOC aggiunge 1 reale
  let real = realBase + (opts.focSpent?1:0)
  real = Math.min(5, real)
  return { theo, real, threshold: thresholdFromTheo(theo) }
}

// Difesa: 1 dado base + (DIF-10) teorici; FOC speso aggiunge +1 reale
export function buildDefensePool(opts:{
  DIF:number,
  focSpent:boolean
}){
  const extraTheo = Math.max(0, (opts.DIF||0) - 10)
  const theo = 1 + extraTheo
  const real = Math.min(5, 1 + (opts.focSpent?1:0))
  return { theo, real, threshold: thresholdFromTheo(theo) }
}
