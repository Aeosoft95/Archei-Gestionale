// /apps/web/src/data/spells.ts

export type SpellTier = 'I' | 'II' | 'III' | 'IV';
export type SpellKind = 'Incantesimo' | 'Preghiera';

export type SpellEntry = {
  id: string;
  name: string;
  kind: SpellKind;
  tier: SpellTier;
  school?: string;
  action?: string;
  range?: string;
  duration?: string;
  foc?: string;
  text: string;
};

export const SPELLS_DB: SpellEntry[] = [
  // =========================================================
  //                     PREGHIER E / BENEDIZIONI
  // =========================================================

  // —— Ordine I — Fede del Principiante (Tier I)
  {
    id: 'pr-luce-interiore',
    name: 'Luce Interiore',
    kind: 'Preghiera',
    tier: 'I',
    action: 'Rito breve',
    range: 'Personale (raggio 3 m)',
    duration: '1 turno',
    foc: 'FOC 1',
    text: 'Illumina 3 m e rimuove paura minore. Il fedele emana luce spirituale che dissipa il buio morale.'
  },
  {
    id: 'pr-benedizione-lieve',
    name: 'Benedizione Lieve',
    kind: 'Preghiera',
    tier: 'I',
    action: 'Rito breve',
    range: '6 m',
    duration: '1 turno',
    foc: 'FOC 1',
    text: '+1 dado teorico a un alleato per una prova. La grazia rinvigorisce il compagno.'
  },
  {
    id: 'pr-sussurro-del-perdono',
    name: 'Sussurro del Perdono',
    kind: 'Preghiera',
    tier: 'I',
    action: 'Rito breve',
    range: 'Contatto',
    duration: 'Immediata',
    foc: 'FOC 1',
    text: 'Rimuove una maledizione lieve o un senso di colpa. Il fedele infonde pace in chi ha errato.'
  },
  {
    id: 'pr-preghiera-di-calma',
    name: 'Preghiera di Calma',
    kind: 'Preghiera',
    tier: 'I',
    action: 'Rito breve',
    range: '6 m',
    duration: '1 scena',
    foc: 'FOC 1',
    text: 'Annulla un effetto di panico o follia temporanea. La fede stabilizza mente e cuore.'
  },
  {
    id: 'pr-respiro-della-speranza',
    name: 'Respiro della Speranza',
    kind: 'Preghiera',
    tier: 'I',
    action: 'Rito breve',
    range: '6 m',
    duration: 'Immediata',
    foc: 'FOC 1',
    text: 'Cura 1 HP a un alleato morente. Il respiro del fedele riaccende la vita per pochi istanti.'
  },
  {
    id: 'pr-scudo-umile',
    name: 'Scudo Umile',
    kind: 'Preghiera',
    tier: 'I',
    action: 'Rito breve',
    range: '6 m',
    duration: '2 turni',
    foc: 'FOC 1',
    text: '+1 DIF al fedele o a un compagno vicino. La protezione non è di acciaio, ma di fede.'
  },
  {
    id: 'pr-mano-della-misericordia',
    name: 'Mano della Misericordia',
    kind: 'Preghiera',
    tier: 'I',
    action: 'Rito breve',
    range: 'Contatto',
    duration: 'Immediata',
    foc: 'FOC 1',
    text: 'Stabilizza un alleato morente (non può agire per 1 turno). Un tocco di pietà ferma il sangue.'
  },
  {
    id: 'pr-candela-del-perdono',
    name: 'Candela del Perdono',
    kind: 'Preghiera',
    tier: 'I',
    action: 'Rito breve',
    range: '6 m',
    duration: '1 scena',
    foc: 'FOC 1',
    text: 'Dissipa una piccola aura oscura o un influsso mentale. La luce della preghiera allontana le tenebre.'
  },
  {
    id: 'pr-eco-della-fede',
    name: 'Eco della Fede',
    kind: 'Preghiera',
    tier: 'I',
    action: 'Rito breve',
    range: '6 m',
    duration: 'Immediata',
    foc: 'FOC 1',
    text: 'Riattiva un Clock di Fede alleato (1 segmento). Le preghiere si rafforzano tra loro.'
  },
  {
    id: 'pr-anima-serena',
    name: 'Anima Serena',
    kind: 'Preghiera',
    tier: 'I',
    action: 'Rito breve',
    range: 'Personale',
    duration: '1 scena',
    foc: 'FOC 1',
    text: 'Vantaggio narrativo in Diplomazia o Empatia. La calma dell’animo diventa contagiosa.'
  },

  // —— Ordine II — Fede dei Convinti (Tier II)
  {
    id: 'pr-scudo-fedele',
    name: 'Scudo Fedele',
    kind: 'Preghiera',
    tier: 'II',
    action: 'Rito breve',
    range: '3 m (aura)',
    duration: '2 turni',
    foc: 'FOC 2',
    text: '+1 DIF a tutti gli alleati entro 3 m. Un campo di energia sacra circonda i fedeli.'
  },
  {
    id: 'pr-preghiera-della-speranza',
    name: 'Preghiera della Speranza',
    kind: 'Preghiera',
    tier: 'II',
    action: 'Rito breve',
    range: '6 m',
    duration: '1 scena',
    foc: 'FOC 2',
    text: 'Tutti gli alleati recuperano 1 HP. La speranza diventa forza condivisa.'
  },
  {
    id: 'pr-mano-del-sollievo',
    name: 'Mano del Sollievo',
    kind: 'Preghiera',
    tier: 'II',
    action: 'Rito breve',
    range: '6 m',
    duration: '1 scena',
    foc: 'FOC 2',
    text: 'Cura 1 segmento e rimuove un veleno o malattia. L’energia della fede ripulisce le impurità.'
  },
  {
    id: 'pr-canto-della-purezza',
    name: 'Canto della Purezza',
    kind: 'Preghiera',
    tier: 'II',
    action: 'Rito breve',
    range: '6 m',
    duration: '1 scena',
    foc: 'FOC 2',
    text: 'Rimuove maledizioni minori e riduce Clock di Corruzione di 3 segmenti. L’aria vibra di purezza.'
  },
  {
    id: 'pr-giuramento-di-luce',
    name: 'Giuramento di Luce',
    kind: 'Preghiera',
    tier: 'II',
    action: 'Rito breve',
    range: 'Personale',
    duration: '2 turni',
    foc: 'FOC 2',
    text: 'Finché attivo, ogni attacco del fedele infligge +½ segmento sacro.'
  },
  {
    id: 'pr-lacrima-dell-alba',
    name: 'Lacrima dell’Alba',
    kind: 'Preghiera',
    tier: 'II',
    action: 'Rito breve',
    range: '12 m',
    duration: 'Immediata',
    foc: 'FOC 2',
    text: 'Dissipa oscurità magiche o nebbie maledette. La luce dell’alba infrange il velo oscuro.'
  },
  {
    id: 'pr-cuore-protettivo',
    name: 'Cuore Protettivo',
    kind: 'Preghiera',
    tier: 'II',
    action: 'Rito breve',
    range: '6 m',
    duration: '1 scena',
    foc: 'FOC 2',
    text: 'Un alleato è immune a paura e charme per 1 scena. Il fedele infonde coraggio nel cuore altrui.'
  },
  {
    id: 'pr-anima-benedetta',
    name: 'Anima Benedetta',
    kind: 'Preghiera',
    tier: 'II',
    action: 'Rito breve',
    range: '6 m',
    duration: '1 scena',
    foc: 'FOC 2',
    text: '+1 FOC a un alleato o al fedele.'
  },
  {
    id: 'pr-preghiera-del-ritorno',
    name: 'Preghiera del Ritorno',
    kind: 'Preghiera',
    tier: 'II',
    action: 'Rito (rapido)',
    range: '1 m',
    duration: '1 scena',
    foc: 'FOC 2',
    text: 'Riporta in vita un alleato morto entro 1 scena dalla morte con metà HP e 0 FOC.'
  },
  {
    id: 'pr-coraggio-della-compagnia',
    name: 'Coraggio della Compagnia',
    kind: 'Preghiera',
    tier: 'II',
    action: 'Rito breve',
    range: '6 m',
    duration: '1 scena',
    foc: 'FOC 2',
    text: '+1 dado teorico al prossimo test di gruppo di tutti gli alleati. L’unione crea forza collettiva.'
  },

  // —— Ordine III — Fede dei Benedetti (Tier III)
  {
    id: 'pr-risanamento-sacro',
    name: 'Risanamento Sacro',
    kind: 'Preghiera',
    tier: 'III',
    action: 'Invocazione',
    range: '6 m',
    duration: 'Immediata',
    foc: 'FOC 3',
    text: 'Tutti gli alleati recuperano 2 HP e 1 FOC. Un’ondata di grazia attraversa la scena.'
  },
  {
    id: 'pr-grazia-divina',
    name: 'Grazia Divina',
    kind: 'Preghiera',
    tier: 'III',
    action: 'Invocazione',
    range: '6 m',
    duration: '1 scena',
    foc: 'FOC 3',
    text: '+1 dado teorico a tutti gli alleati per l’intera scena.'
  },
  {
    id: 'pr-giudizio-di-luce',
    name: 'Giudizio di Luce',
    kind: 'Preghiera',
    tier: 'III',
    action: 'Invocazione',
    range: '12 m',
    duration: 'Immediata',
    foc: 'FOC 3',
    text: 'Infligge 3 segmenti di danno sacro ai nemici corrotti. La volontà divina punisce i profani.'
  },
  {
    id: 'pr-ritorno-supremo',
    name: 'Preghiera del Ritorno Supremo',
    kind: 'Preghiera',
    tier: 'III',
    action: 'Rituale (1 minuto)',
    range: 'Contatto',
    duration: 'Immediata',
    foc: 'FOC 3',
    text: 'Riporta in vita un alleato morto entro 24 ore. Consuma 4 segmenti del Clock di Fede e 2 FOC.'
  },
  {
    id: 'pr-santuario-vivente',
    name: 'Santuario Vivente',
    kind: 'Preghiera',
    tier: 'III',
    action: 'Invocazione',
    range: '4 m (area)',
    duration: '3 turni',
    foc: 'FOC 3',
    text: 'Crea un’area immune da magie oscure e maledizioni.'
  },
  {
    id: 'pr-cuore-radioso',
    name: 'Cuore Radioso',
    kind: 'Preghiera',
    tier: 'III',
    action: 'Invocazione',
    range: 'Personale',
    duration: '3 turni',
    foc: 'FOC 3',
    text: '+1 DIF e rigeneri 1 HP a turno per 3 turni.'
  },
  {
    id: 'pr-mano-del-giudizio',
    name: 'Mano del Giudizio',
    kind: 'Preghiera',
    tier: 'III',
    action: 'Invocazione',
    range: 'Personale',
    duration: '1 turno',
    foc: 'FOC 3',
    text: 'Il prossimo attacco infligge danni doppi contro nemici corrotti.'
  },
  {
    id: 'pr-promessa-dell-eternita',
    name: 'Promessa dell’Eternità',
    kind: 'Preghiera',
    tier: 'III',
    action: 'Invocazione',
    range: '6 m',
    duration: '1 scena',
    foc: 'FOC 3',
    text: 'Tutte le Benedizioni attive nel gruppo durano il doppio.'
  },
  {
    id: 'pr-corona-del-martire',
    name: 'Corona del Martire',
    kind: 'Preghiera',
    tier: 'III',
    action: 'Reazione',
    range: '6 m',
    duration: 'Immediata',
    foc: 'FOC 3',
    text: 'Il fedele può morire per salvare un alleato, trasferendo tutti i suoi HP.'
  },
  {
    id: 'pr-fede-infrangibile',
    name: 'Fede Infrangibile',
    kind: 'Preghiera',
    tier: 'III',
    action: 'Invocazione',
    range: 'Personale',
    duration: '1 scena',
    foc: 'FOC 3',
    text: 'Immunità temporanea a paura, corruzione e charme.'
  },

  // —— Ordine IV — Fede dei Santi (Tier IV)
  {
    id: 'pr-ascensione',
    name: 'Ascensione',
    kind: 'Preghiera',
    tier: 'IV',
    action: 'Invocazione',
    range: '6 m',
    duration: '1 turno',
    foc: 'FOC 4–5',
    text: 'Il fedele e 1 alleato diventano incorporei per 1 turno, ignorando danni fisici.'
  },
  {
    id: 'pr-ritorno-eterno',
    name: 'Preghiera del Ritorno Eterno',
    kind: 'Preghiera',
    tier: 'IV',
    action: 'Rituale (1 ora)',
    range: 'Contatto',
    duration: 'Immediata',
    foc: 'FOC 4–5',
    text: 'Riporta in vita un alleato morto in qualsiasi momento. Prezzo: −3 FOC permanenti o −1 livello.'
  },
  {
    id: 'pr-raggio-degli-archei',
    name: 'Raggio degli Archei',
    kind: 'Preghiera',
    tier: 'IV',
    action: 'Invocazione',
    range: '5 m (area)',
    duration: 'Immediata',
    foc: 'FOC 4–5',
    text: 'Area 5 m: infligge 4 segmenti ai nemici oscuri e cura 2 HP agli alleati.'
  },
  {
    id: 'pr-sigillo-della-pace',
    name: 'Sigillo della Pace',
    kind: 'Preghiera',
    tier: 'IV',
    action: 'Invocazione',
    range: '10 m (aura)',
    duration: '1 scena',
    foc: 'FOC 4–5',
    text: 'Blocca ogni combattimento entro 10 m per 1 scena (nessuno può attaccare).'
  },
  {
    id: 'pr-giuramento-d-eta',
    name: 'Giuramento d’Eternità',
    kind: 'Preghiera',
    tier: 'IV',
    action: 'Invocazione',
    range: '6 m',
    duration: 'Sessione',
    foc: 'FOC 4–5',
    text: 'Tutti gli alleati ottengono +1 dado teorico per il resto della sessione.'
  },
  {
    id: 'pr-voce-dei-cieli',
    name: 'Voce dei Cieli',
    kind: 'Preghiera',
    tier: 'IV',
    action: 'Rituale (breve)',
    range: 'Personale',
    duration: '1 scena',
    foc: 'FOC 4–5',
    text: 'Il fedele parla con gli Archei, ottenendo una visione o verità.'
  },
  {
    id: 'pr-purificazione-totale',
    name: 'Purificazione Totale',
    kind: 'Preghiera',
    tier: 'IV',
    action: 'Invocazione',
    range: 'Scena',
    duration: 'Immediata',
    foc: 'FOC 4–5',
    text: 'Rimuove tutte le maledizioni e i Clock di Corruzione nella scena.'
  },
  {
    id: 'pr-cuore-della-rinascita',
    name: 'Cuore della Rinascita',
    kind: 'Preghiera',
    tier: 'IV',
    action: 'Invocazione',
    range: '6 m',
    duration: 'Immediata',
    foc: 'FOC 4–5',
    text: 'Tutti gli alleati recuperano 3 HP e 2 FOC.'
  },
  {
    id: 'pr-scudo-dell-era-nuova',
    name: 'Scudo dell’Era Nuova',
    kind: 'Preghiera',
    tier: 'IV',
    action: 'Invocazione',
    range: '6 m (aura)',
    duration: '1 scena',
    foc: 'FOC 4–5',
    text: 'Nessun alleato può morire per 1 scena.'
  },
  {
    id: 'pr-miracolo-vivente',
    name: 'Miracolo Vivente',
    kind: 'Preghiera',
    tier: 'IV',
    action: 'Invocazione',
    range: '6 m',
    duration: '1 scena',
    foc: 'FOC 4–5',
    text: 'Scegli un effetto di Tier inferiore e amplificalo al doppio dell’intensità.'
  },

  // =========================================================
  //                           INCANTESIMI
  // =========================================================

  // —— Tier I — Incantesimi Minori (FOC 1)
  {
    id: 'sp-dardo-energetico',
    name: 'Dardo Energetico',
    kind: 'Incantesimo',
    tier: 'I',
    school: 'Evocazione',
    action: '1 azione',
    range: '10 m',
    duration: 'Immediata',
    foc: 'FOC 1',
    text: 'Un raggio astrale colpisce un bersaglio visibile, infliggendo 1 segmento. Le superfici sfrigolano di luce azzurra.'
  },
  {
    id: 'sp-scudo-di-luce',
    name: 'Scudo di Luce',
    kind: 'Incantesimo',
    tier: 'I',
    school: 'Abiurazione',
    action: '1 azione',
    range: '6 m',
    duration: '1 turno',
    foc: 'FOC 1',
    text: '+1 DIF a te o un alleato; quando svanisce, un bagliore acceca brevemente i nemici.'
  },
  {
    id: 'sp-nebbia-coprente',
    name: 'Nebbia Coprente',
    kind: 'Incantesimo',
    tier: 'I',
    school: 'Conjuring Naturale',
    action: '1 azione',
    range: '9 m',
    duration: '2 turni',
    foc: 'FOC 1',
    text: 'Una foschia densa in area 3 m fornisce copertura leggera; le sagome si deformano come ombre vive.'
  },
  {
    id: 'sp-benedizione-lieve',
    name: 'Benedizione Lieve',
    kind: 'Incantesimo',
    tier: 'I',
    school: 'Invocazione Spirituale',
    action: '1 azione',
    range: '6 m',
    duration: '1 turno',
    foc: 'FOC 1',
    text: 'Un alleato ottiene +1 dado teorico alla prossima prova o attacco.'
  },
  {
    id: 'sp-mano-psichica',
    name: 'Mano Psichica',
    kind: 'Incantesimo',
    tier: 'I',
    school: 'Telecinesi Mentale',
    action: '1 azione',
    range: '12 m',
    duration: '1 turno',
    foc: 'FOC 1',
    text: 'Una mano invisibile muove o spinge piccoli oggetti; porta/chiavi/oggetti leggeri possono essere manipolati a distanza.'
  },
  {
    id: 'sp-cura-minore',
    name: 'Cura Minore',
    kind: 'Incantesimo',
    tier: 'I',
    school: 'Invocazione Spirituale',
    action: '1 azione',
    range: '6 m',
    duration: 'Immediata',
    foc: 'FOC 1',
    text: 'Ripristina 1 HP o ½ segmento di danno con imposizione delle mani.'
  },
  {
    id: 'sp-sussurro-ipnotico',
    name: 'Sussurro Ipnotico',
    kind: 'Incantesimo',
    tier: 'I',
    school: 'Illusione Mentale',
    action: '1 azione',
    range: '9 m',
    duration: '1 turno',
    foc: 'FOC 1',
    text: 'Il bersaglio perde la reazione nel turno successivo a causa di un sussurro che ne disarma la volontà.'
  },
  {
    id: 'sp-radici-vorticanti',
    name: 'Radici Vorticanti',
    kind: 'Incantesimo',
    tier: 'I',
    school: 'Evocazione Naturale',
    action: '1 azione',
    range: '9 m',
    duration: '2 turni',
    foc: 'FOC 1',
    text: 'Radici torcenti rallentano di 2 m e creano terreno difficile.'
  },
  {
    id: 'sp-sigillo-protettivo',
    name: 'Sigillo Protettivo',
    kind: 'Incantesimo',
    tier: 'I',
    school: 'Abiurazione',
    action: 'Reazione',
    range: '6 m',
    duration: 'Immediata',
    foc: 'FOC 1',
    text: 'Riduce il danno di un colpo di ½ segmento. Le rune si dissolvono con un crepitio.'
  },
  {
    id: 'sp-doppio-passo',
    name: 'Doppio Passo',
    kind: 'Incantesimo',
    tier: 'I',
    school: 'Traslocazione Mentale',
    action: '1 azione',
    range: 'Personale',
    duration: 'Immediata',
    foc: 'FOC 1',
    text: 'Teletrasporto di ~2 m lasciando una scia di scintille astrali.'
  },

  // —— Tier II — Incantesimi Maggiori (FOC 2)
  {
    id: 'sp-fulmine-arcuato',
    name: 'Fulmine Arcuato',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Evocazione Energetica',
    action: '1 azione',
    range: '12 m',
    duration: 'Immediata',
    foc: 'FOC 2',
    text: 'Scarica che infligge 2 segmenti al bersaglio primario e ½ segmento a un secondario adiacente.'
  },
  {
    id: 'sp-catena-mentale',
    name: 'Catena Mentale',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Vincolo Psichico',
    action: '1 azione',
    range: '9 m',
    duration: '2 turni',
    foc: 'FOC 2',
    text: 'Colleghi due menti nemiche: il dolore di uno riecheggia nell’altro per metà del danno subito.'
  },
  {
    id: 'sp-scudo-di-fede',
    name: 'Scudo di Fede',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Abiurazione Spirituale',
    action: '1 azione',
    range: '6 m',
    duration: '2 turni',
    foc: 'FOC 2',
    text: 'Tre alleati ottengono +1 DIF grazie a un’aura di preghiere incandescenti.'
  },
  {
    id: 'sp-tempesta-di-schegge',
    name: 'Tempesta di Schegge',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Evocazione Naturale',
    action: '1 azione',
    range: '12 m',
    duration: 'Immediata',
    foc: 'FOC 2',
    text: 'Frammenti di pietra e corteccia colpiscono area 3 m: 1½ segmenti e terreno difficile.'
  },
  {
    id: 'sp-cura-superiore',
    name: 'Cura Superiore',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Invocazione Spirituale',
    action: '1 azione',
    range: '6 m',
    duration: 'Immediata',
    foc: 'FOC 2',
    text: 'Guarisce 2 segmenti o rianima un alleato a 1 HP se morente.'
  },
  {
    id: 'sp-mente-a-lama',
    name: 'Mente a Lama',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Evocazione Mentale',
    action: '1 azione',
    range: '9 m',
    duration: '2 turni',
    foc: 'FOC 2',
    text: 'Infligge 1 segmento e impone −1 dado teorico ai test di concentrazione del bersaglio.'
  },
  {
    id: 'sp-vite-rampanti',
    name: 'Vite Rampanti',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Evocazione Naturale',
    action: '1 azione',
    range: '9 m',
    duration: '1 turno',
    foc: 'FOC 2',
    text: 'Un nemico viene immobilizzato da radici spesse come corde.'
  },
  {
    id: 'sp-resurrezione-immediata',
    name: 'Resurrezione Immediata',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Invocazione Spirituale',
    action: '1 azione',
    range: '1 m',
    duration: 'Immediata',
    foc: 'FOC 2',
    text: 'Richiami l’anima di un alleato morto entro 1 scena: torna a 1 HP e 0 FOC (spossatezza sacra).'
  },
  {
    id: 'sp-raggio-prismatico',
    name: 'Raggio Prismatico',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Evocazione Energetica',
    action: '1 azione',
    range: '9 m',
    duration: 'Immediata',
    foc: 'FOC 2',
    text: 'Infligge 2 segmenti o, a scelta, abbaglia o rallenta il bersaglio di 2 m.'
  },
  {
    id: 'sp-benedizione-della-compagnia',
    name: 'Benedizione della Compagnia',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Invocazione Spirituale',
    action: '1 azione',
    range: '6 m',
    duration: '1 turno',
    foc: 'FOC 2',
    text: '+1 dado teorico al prossimo test di gruppo di tutti gli alleati.'
  },
  {
    id: 'sp-maschera-di-volti',
    name: 'Maschera di Volti',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Illusione Mentale',
    action: '1 azione',
    range: 'Personale',
    duration: '1 scena',
    foc: 'FOC 2',
    text: 'Assumi altre sembianze; chi osserva deve superare una prova per scoprire l’inganno.'
  },
  {
    id: 'sp-risonanza-annullante',
    name: 'Risonanza Annullante',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Abiurazione Energetica',
    action: '1 azione',
    range: '12 m',
    duration: 'Immediata',
    foc: 'FOC 2',
    text: 'Dissolvi un effetto magico di pari Tier o inferiore nel raggio.'
  },
  {
    id: 'sp-guardia-della-selva',
    name: 'Guardia della Selva',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Evocazione Naturale',
    action: '1 azione',
    range: '6 m',
    duration: '2 turni',
    foc: 'FOC 2',
    text: 'Liane reattive: quando un nemico entra nell’area, subisce ½ segmento.'
  },
  {
    id: 'sp-lacrima-dell-alba',
    name: 'Lacrima dell’Alba',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Invocazione Spirituale',
    action: '1 azione',
    range: '12 m',
    duration: 'Immediata',
    foc: 'FOC 2',
    text: 'Dissipa oscurità o nebbie magiche, rivelando ciò che si cela.'
  },
  {
    id: 'sp-coraggio-della-compagnia',
    name: 'Coraggio della Compagnia',
    kind: 'Incantesimo',
    tier: 'II',
    school: 'Invocazione Spirituale',
    action: '1 azione',
    range: '6 m',
    duration: '1 turno',
    foc: 'FOC 2',
    text: 'I compagni vicini ignorano paura e penalità morali per 1 turno.'
  },

  // —— Tier III — Incantesimi Superiori (FOC 3)
  {
    id: 'sp-esplosione-astrale',
    name: 'Esplosione Astrale',
    kind: 'Incantesimo',
    tier: 'III',
    school: 'Evocazione Energetica',
    action: '1 azione',
    range: '12 m',
    duration: 'Immediata',
    foc: 'FOC 3',
    text: 'Globo di potere esplode: 3 segmenti in raggio 3 m; rimangono rune incandescenti.'
  },
  {
    id: 'sp-dominio-delle-emozioni',
    name: 'Dominio delle Emozioni',
    kind: 'Incantesimo',
    tier: 'III',
    school: 'Influenza Mentale',
    action: '1 azione',
    range: '9 m',
    duration: '2 turni',
    foc: 'FOC 3',
    text: 'Controlli le emozioni di 2 bersagli: paura, calma o furia.'
  },
  {
    id: 'sp-aegis-sacra',
    name: 'Aegis Sacra',
    kind: 'Incantesimo',
    tier: 'III',
    school: 'Abiurazione Spirituale',
    action: 'Reazione',
    range: '6 m',
    duration: '1 turno',
    foc: 'FOC 3',
    text: 'Un alleato diventa immune ai danni fino al tuo prossimo turno.'
  },
  {
    id: 'sp-sogno-reale',
    name: 'Sogno Reale',
    kind: 'Incantesimo',
    tier: 'III',
    school: 'Illusione Mentale',
    action: '1 azione',
    range: '12 m',
    duration: '3 turni',
    foc: 'FOC 3',
    text: 'Illusione collettiva che altera la percezione; tutti i Clock mentali nell’area avanzano di +1 segmento.'
  },
  {
    id: 'sp-rinascita-della-foresta',
    name: 'Rinascita della Foresta',
    kind: 'Incantesimo',
    tier: 'III',
    school: 'Evocazione Naturale',
    action: '1 azione',
    range: '12 m',
    duration: 'Immediata',
    foc: 'FOC 3',
    text: 'Radici e pollini curativi ripristinano 1 segmento a tutti gli alleati e dissolvono maledizioni lievi.'
  },
  {
    id: 'sp-tempesta-di-spine',
    name: 'Tempesta di Spine',
    kind: 'Incantesimo',
    tier: 'III',
    school: 'Evocazione Naturale',
    action: '1 azione',
    range: '9 m',
    duration: '3 turni',
    foc: 'FOC 3',
    text: 'Pioggia di spine: 2 segmenti e rallenta i nemici nell’area.'
  },
  {
    id: 'sp-preghiera-della-vita',
    name: 'Preghiera della Vita',
    kind: 'Incantesimo',
    tier: 'III',
    school: 'Invocazione Spirituale',
    action: '1 azione',
    range: '6 m',
    duration: '1 turno',
    foc: 'FOC 3',
    text: 'Ogni alleato guarisce 1 segmento e ottiene +1 DIF per 1 turno.'
  },
  {
    id: 'sp-gabbia-eterea',
    name: 'Gabbia Eterea',
    kind: 'Incantesimo',
    tier: 'III',
    school: 'Abiurazione Energetica',
    action: '1 azione',
    range: '9 m',
    duration: '2 turni',
    foc: 'FOC 3',
    text: 'Prigione traslucida blocca un nemico; può tentare di spezzarla con una prova di Forza.'
  },
  {
    id: 'sp-resurrezione-rituale',
    name: 'Resurrezione Rituale',
    kind: 'Incantesimo',
    tier: 'III',
    school: 'Invocazione Spirituale',
    action: '1 minuto (rituale)',
    range: 'Contatto',
    duration: 'Immediata',
    foc: 'FOC 3',
    text: 'Rianimi un alleato morto entro 24 ore. Torna con 2 HP ma −1 FOC massimo per 1 scena.'
  },
  {
    id: 'sp-silenzio-perfetto',
    name: 'Silenzio Perfetto',
    kind: 'Incantesimo',
    tier: 'III',
    school: 'Abiurazione Mentale',
    action: '1 azione',
    range: '9 m',
    duration: '2 turni',
    foc: 'FOC 3',
    text: 'Cupola di 4 m in cui suono e magia verbale cessano d’esistere.'
  },

  // —— Tier IV — Incantesimi Epici (FOC 4–5)
  {
    id: 'sp-tempesta-astrale',
    name: 'Tempesta Astrale',
    kind: 'Incantesimo',
    tier: 'IV',
    school: 'Evocazione Energetica',
    action: '1 azione',
    range: '15 m',
    duration: 'Immediata',
    foc: 'FOC 4–5',
    text: 'Turbine di energia cosmica: 4 segmenti in area 5 m; annienta barriere magiche.'
  },
  {
    id: 'sp-dominio-totale',
    name: 'Dominio Totale',
    kind: 'Incantesimo',
    tier: 'IV',
    school: 'Influenza Mentale',
    action: '1 azione',
    range: '9 m',
    duration: '1 turno',
    foc: 'FOC 4–5',
    text: 'Controllo completo di un nemico costringendolo a un’azione a tua scelta; poi subisce 1 segmento mentale.'
  },
  {
    id: 'sp-purificazione-totale',
    name: 'Purificazione Totale',
    kind: 'Incantesimo',
    tier: 'IV',
    school: 'Invocazione Spirituale',
    action: '1 azione',
    range: '12 m',
    duration: 'Immediata',
    foc: 'FOC 4–5',
    text: 'Elimina tutte le maledizioni e i Clock di Corruzione nella scena, lasciando un silenzio irreale.'
  },
  {
    id: 'sp-resurrezione-eterna',
    name: 'Resurrezione Eterna',
    kind: 'Incantesimo',
    tier: 'IV',
    school: 'Invocazione Spirituale',
    action: '1 ora (rituale)',
    range: 'Contatto',
    duration: 'Immediata',
    foc: 'FOC 4–5',
    text: 'Richiami un’anima da oltre il tempo. Prezzo: −3 FOC massimi permanenti o −1 livello.'
  },
  {
    id: 'sp-rinascita-primordiale',
    name: 'Rinascita Primordiale',
    kind: 'Incantesimo',
    tier: 'IV',
    school: 'Evocazione Naturale',
    action: '1 azione',
    range: '12 m',
    duration: '3 turni',
    foc: 'FOC 4–5',
    text: 'Tutti gli alleati recuperano 2 HP; un’aura verde riduce di 1 segmento ogni danno subito per 3 turni.'
  }
];
