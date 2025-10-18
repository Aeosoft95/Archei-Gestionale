// /apps/web/src/data/quick.ts
// Costruisce lo "snapshot rapido" da mostrare nella chat del player.
// NON dipende dalla UI della scheda e non la modifica.

export type QuickWeaponPool = {
  id: string;
  name: string;
  qualita: string;
  damageSeg: number;
  pool: { real: number; theo: number; threshold: number };
};

export type QuickPlayerInfo = {
  name: string;
  race: string;
  clazz: string;
  level: number;
  hp: number;
  dif: number;
  foc: number; // letto se presente, altrimenti 0
  difPool: { tot: number; reali: number; teorici: number };
  equippedWeapons: QuickWeaponPool[];
  portraitUrl?: string;
};

// ================== Calcoli (allineati alla scheda) ==================
type QualitaCategoria = 'Comune'|'Buona'|'Eccellente'|'Maestrale'|'Magica'|'Artefatto';
type ArmorTipo = 'Leggera'|'Media'|'Pesante'|'Magica';
type AttackBase = 'FOR'|'DES'|'ARCANO';

const QUALITA_BONUS_TEO_WEAPON: Record<QualitaCategoria, number> = {
  Comune: 0, Buona: 2, Eccellente: 4, Maestrale: 6, Magica: 8, Artefatto: 10,
};

const QUALITA_DANNO_SEG: Record<QualitaCategoria, number> = {
  Comune: 1, Buona: 2, Eccellente: 3, Maestrale: 4, Magica: 4, Artefatto: 5,
};

// d6 effettivi armatura = base tipo + qualità (cap per Magica 3–5)
function armorEffectiveD6Auto(tipo: ArmorTipo, qualita: QualitaCategoria) {
  const base = tipo === 'Leggera' ? 1 : tipo === 'Media' ? 2 : tipo === 'Pesante' ? 3 : 3;
  const byQual = { Comune:0, Buona:1, Eccellente:2, Maestrale:3, Magica:4, Artefatto:5 }[qualita] || 0;
  let eff = base + byQual;
  if (tipo === 'Magica') eff = Math.min(5, Math.max(3, eff));
  return Math.max(0, eff);
}

function calcDIF(des:number, armorEffD6:number) {
  return 10 + Math.max(0, des) + Math.max(0, armorEffD6);
}
function defenseDiceFromDIF(dif:number){
  const tot = Math.max(1, 1 + Math.max(0, dif - 10));
  const reali = Math.min(tot, 5);
  const teorici = tot - reali;
  return { tot, reali, teorici };
}

function diceFromAttribute(attr:number){
  const real = Math.min(Math.max(0, attr), 5);
  const theo = Math.max(0, attr - 5);
  return { real, theo };
}

function buildAttackPool(params: {
  attackBase: AttackBase;
  attrs: { FOR:number; DES:number; INT:number; SAP:number };
  hasSkillMelee: boolean;
  hasSkillRanged: boolean;
  hasSkillArcana: boolean;
  armaBonusTeorico: number;
  bonusReal?: number;
  bonusTheo?: number;
}) {
  const { attackBase, attrs, hasSkillMelee, hasSkillRanged, hasSkillArcana, armaBonusTeorico, bonusReal=0, bonusTheo=0 } = params;

  const primaryAttrValue =
    attackBase === 'FOR' ? (attrs.FOR||0) :
    attackBase === 'DES' ? (attrs.DES||0) :
    Math.max(attrs.SAP||0, attrs.INT||0);

  const fromAttr = diceFromAttribute(primaryAttrValue);

  let skillReal = 0;
  if (attackBase === 'FOR' && hasSkillMelee)  skillReal += 1;
  if (attackBase === 'DES' && hasSkillRanged) skillReal += 1;
  if (attackBase === 'ARCANO' && hasSkillArcana) skillReal += 1;

  const real = fromAttr.real + skillReal + Math.max(0, bonusReal);
  const theo = fromAttr.theo + Math.max(0, armaBonusTeorico) + Math.max(0, bonusTheo);

  const threshold = theo <= 5 ? 6 : theo <= 9 ? 5 : theo <= 19 ? 4 : 3;
  return { real, theo, threshold };
}

// ================== Builder principale ==================
export function computeQuickInfo(data: any): QuickPlayerInfo {
  const ident = data?.ident ?? {};
  const attrs = data?.attrs ?? {};
  const skills = data?.skills ?? {};
  const current = data?.current ?? {};
  const armors = Array.isArray(data?.armors) ? data.armors : [];
  const weapons = Array.isArray(data?.weapons) ? data.weapons : [];

  const equippedArmor = armors.find((a:any)=>a?.equipped);
  const effArmorD6 = equippedArmor
    ? (equippedArmor.useOverride ? Math.max(0, equippedArmor.bonusD6||0)
       : armorEffectiveD6Auto(
          (equippedArmor.tipo||'Leggera') as ArmorTipo,
          (equippedArmor.qualita||'Comune') as QualitaCategoria))
    : 0;

  const difCalc = calcDIF(attrs.DES||0, effArmorD6);
  const difFinal = (difCalc||10) + (current.difMod||0);
  const difPool = defenseDiceFromDIF(difFinal);

  const equippedWeapons: QuickWeaponPool[] = weapons
    .filter((w:any)=>w?.equipped)
    .slice(0, 3)
    .map((w:any)=> {
      const qualita = (w.qualita||'Comune') as QualitaCategoria;
      const attackBase = (w.attackBase || (w.usesDES ? 'DES' : 'FOR')) as AttackBase;
      const armaBonusTeorico = QUALITA_BONUS_TEO_WEAPON[qualita] ?? 0;
      const pool = buildAttackPool({
        attackBase,
        attrs: { FOR: attrs.FOR||0, DES: attrs.DES||0, INT: attrs.INT||0, SAP: attrs.SAP||0 },
        hasSkillMelee: !!skills.melee,
        hasSkillRanged: !!skills.ranged,
        hasSkillArcana: !!skills.arcana,
        armaBonusTeorico,
        bonusReal: w.bonusReal||0,
        bonusTheo: w.bonusTheo||0,
      });
      const damageSeg = typeof w.damageSeg === 'number' ? w.damageSeg : (QUALITA_DANNO_SEG[qualita] ?? 1);
      return {
        id: String(w.id||w.name||Math.random()),
        name: String(w.name||'Arma'),
        qualita,
        damageSeg,
        pool,
      };
    });

  return {
    name: String(ident.name||''),
    race: String(ident.race||''),
    clazz: String(ident.clazz||''),
    level: Number(ident.level||1),
    hp: Number(current.hp||0),
    dif: Number(difFinal||10),
    foc: Number((current as any).foc ?? 0), // se la tua scheda non ha FOC, rimane 0
    difPool,
    equippedWeapons,
    portraitUrl: ident.portraitUrl ? String(ident.portraitUrl) : undefined,
  };
}
