// Os MODS CONDICIONAIS do PoE (sistema de itens do PoE — só com ITENS_POE=1; dono, 07/10: "vários efeitos das armas não estão
// funcionando… n é só arma mas tbm equipamentos… colocando igual no PoE").
//
// Um mod do PoE muitas vezes vale só numa situação: "Dano Corpo a Corpo aumentado", "Velocidade de Ataque segurando um Escudo",
// "Chance de Crítico com Habilidades de Fogo", "Velocidade de Movimento se você Matou Recentemente", "Espaço esquerdo de anel: …".
// A tradução (`gamedata/itens-poe/traducao.json`) grava esses mods como `atributo@cond1+cond2` (ex.: `dmg_inc@corpo`,
// `atk_speed@comEscudo`, `crit_chance_inc@fogo`). Há dois tipos de condição:
//   - de ESTADO (o que o personagem empunha, o que aconteceu há pouco, o anel em que a peça está): resolvidas na SOMA dos atributos
//     (`resolver`, chamado no fim de `Afixos.soma`) — valendo, o número entra no atributo de sempre (`atk_speed`, `block`…);
//   - do GOLPE (as tags da habilidade: ataque, magia, corpo a corpo, projétil, área, fogo…; e o alvo com Vida Baixa): resolvidas em cada
//     acerto (`fichaDoGolpe`), que devolve a ficha daquele golpe com o "aumentado", o crítico, a penetração e as afecções dele.
import { ligado } from './catalogo.mjs';

/** "Recentemente" no PoE: nos últimos 4 segundos. */
export const RECENTE_MS = 4000;
/** "Vida Baixa" no PoE: 50% da vida máxima ou menos. */
export const VIDA_BAIXA = 0.5;
/** A janela em que o personagem conta como "movendo-se" depois do último passo. */
const MOVENDO_MS = 600;

/**
 * Separa `stat%escala@a+b` em `{ stat, escala, conds: ['a','b'] }`. A ESCALA é o "por X" do PoE (`life%nivel` = "+N de Vida por Nível",
 * `atk_speed%atr:dex:10` = "a cada 10 de Destreza", `dmg_inc%carga:frenesi` = "por Carga de Frenesi") — `escalar`.
 */
export function partir(chave) {
  const k = String(chave);
  const i = k.indexOf('@');
  const esq = i < 0 ? k : k.slice(0, i);
  const conds = i < 0 ? [] : k.slice(i + 1).split('+').filter(Boolean);
  const j = esq.indexOf('%');
  return { stat: j < 0 ? esq : esq.slice(0, j), escala: j < 0 ? null : esq.slice(j + 1), conds };
}
export const ehCondicional = (chave) => String(chave).includes('@') || String(chave).includes('%');

// ---------------------------------------------------------------- as condições

/** As classes de arma do PoE → a condição "com <arma>". */
const COND_DA_CLASSE = {
  Bows: 'comArco', Wands: 'comVarinha', Daggers: 'comAdaga', Rune_Daggers: 'comAdaga', Claws: 'comGarra',
  One_Hand_Swords: 'comEspada', Thrusting_One_Hand_Swords: 'comEspada', Two_Hand_Swords: 'comEspada',
  One_Hand_Axes: 'comMachado', Two_Hand_Axes: 'comMachado', One_Hand_Maces: 'comMaca', Two_Hand_Maces: 'comMaca', Sceptres: 'comCetro',
  Staves: 'comCajado', Warstaves: 'comCajado',
};
const DUAS_MAOS = new Set(['Bows', 'Two_Hand_Swords', 'Two_Hand_Axes', 'Two_Hand_Maces', 'Staves', 'Warstaves']);
const A_DISTANCIA = new Set(['Bows', 'Wands']);
/** As condições de ESTADO conhecidas (as outras são tags do golpe). `elusivo` e `soloSagrado` ainda não existem no jogo: nunca valem. */
export const CONDICOES_DE_ESTADO = new Set([
  ...new Set(Object.values(COND_DA_CLASSE)), 'umaMao', 'duasMaos', 'armaCorpo', 'comEscudo', 'duasArmas',
  'matouRecente', 'naoMatouRecente', 'criticoRecente', 'naoCriticoRecente', 'acertadoRecente', 'semDanoRecente', 'movendo', 'vidaBaixa',
  'lacaioMorreuRecente', 'usouLacaioRecente', 'elusivo', 'soloSagrado', 'vidaCheia',
  // (07/10, os únicos:) mana, escudo, afecções em você, frasco, roubo, parado, mão secundária, e os "recentemente" dos acontecimentos.
  'manaBaixa', 'naoManaBaixa', 'escudoCheio', 'semEscudo', 'ardendo', 'naoArdendo', 'congeladoProprio', 'eletrizadoProprio', 'resfriadoProprio',
  'sangrandoProprio', 'envenenadoProprio', 'amaldicoadoProprio', 'semAfeccaoElemental', 'duranteFrasco', 'semFrasco', 'drenando', 'parado',
  'maoSecundariaVazia', 'desarmado', 'naoVidaBaixa', 'naoAcertadoRecente', 'bloqueouRecente', 'naoBloqueouRecente', 'atordoouRecente',
  'congelouRecente', 'incendiouRecente', 'eletrizouRecente', 'usouMovimentoRecente', 'usouVaalRecente', 'clamouRecente', 'acertouRecente',
  'ganhouPoderRecente', 'naoGanhouPoderRecente', 'naoGanhouFrenesiRecente', 'naoPerdeuPoderRecente', 'consumiuCadaverRecente',
  'gastouManaRecente', 'usouHabilidadeRecente', 'mudouPosturaRecente', 'recargaEsIniciouRecente', 'naoCritRecente', 'naoCriticouRecente',
  'naoMatouRecente2', 'usouRubiRecente', 'usouSafiraRecente', 'usouTopazioRecente', 'usouAmetistaRecente', 'naoConjurouAvancoRecente', 'conjurouAvancoRecente',
]);
/** As condições de estado com PARÂMETRO: `atrMin:str:200` (ao menos 200 de Força), `atrMaior:dex:int`, `buff:agressividade`,
 * `semCargas:frenesi`, `comCargas:poder`, `cargasMax:tolerancia`, `furiaMin:N`, `lacaio:bestial`. */
const COND_COM_PARAMETRO = /^(atrMin|atrMaior|buff|semCargas|comCargas|cargasMax|furiaMin|lacaio|escudoMin|resMin):/;
export const ehCondDeEstado = (c) => CONDICOES_DE_ESTADO.has(c) || COND_COM_PARAMETRO.test(c);
/** As tags de GOLPE conhecidas (as do poedb em português viram estas — `tagsDoPoe`). */
export const TAGS_DE_GOLPE = new Set([
  'ataque', 'magia', 'corpo', 'projetil', 'area', 'fogo', 'gelo', 'raio', 'fisico', 'caos', 'elemental', 'arco', 'totem', 'armadilha',
  'mina', 'lacaio', 'arauto', 'vaal', 'movimento', 'clamor', 'aura', 'maldicao', 'alvoVidaBaixa', 'dot', 'habilidade', 'suporte',
  // O ALVO do golpe (o estado dele naquele acerto): Resfriado, Congelado, Eletrizado, Cego, Sangrando, Envenenado, Incendiado, Amaldiçoado,
  // Lento, Mutilado, Provocado, a raridade, a vida cheia; e o golpe de perto ("em Curto Alcance"), na mão principal/secundária.
  'alvoResfriado', 'alvoCongelado', 'alvoEletrizado', 'alvoCego', 'alvoSangrando', 'alvoEnvenenado', 'alvoIncendiado', 'alvoAmaldicoado',
  'alvoLento', 'alvoMutilado', 'alvoProvocado', 'alvoRaro', 'alvoUnico', 'alvoMagico', 'alvoVidaCheia', 'alvoPerto', 'canalizar', 'retaliacao',
  'golpe', 'pancada', 'nova', 'runa', 'marca', 'feitico', 'vinculo', 'ativada', 'desarmadoGolpe', 'naoCritico',
]);
/** As condições que dependem do ANEL em que a peça está (resolvidas peça a peça em `Afixos.somaDeItens`). */
export const CONDICOES_DE_ANEL = { anelEsquerdo: 'ring', anelDireito: 'ring2' };

const classeDe = (peca) => peca?.poe?.classe ?? null;
const recente = (quando, agora) => quando != null && agora - quando <= RECENTE_MS;

/** As condições de estado que VALEM agora para o personagem (um Set). `total`: a soma (para os máximos de cargas e os atributos). */
export function condicoesDe(estado, total = null, principais = null) {
  const v = new Set();
  v.parametros = { estado, total, principais };
  const arma = classeDe(estado?.equipment?.weapon);
  const outra = classeDe(estado?.equipment?.shield);
  if (arma && COND_DA_CLASSE[arma]) v.add(COND_DA_CLASSE[arma]);
  if (arma) v.add(DUAS_MAOS.has(arma) ? 'duasMaos' : 'umaMao');
  if (arma && !A_DISTANCIA.has(arma)) v.add('armaCorpo');
  if (outra === 'Shields') v.add('comEscudo');
  if (outra && COND_DA_CLASSE[outra]) v.add('duasArmas');
  // ("Conta como Dupla Empunhadura", "Conta como todos Tipos de Armas Corpo a Corpo de Uma Mão".)
  const pecas = Object.values(estado?.equipment ?? {});
  if (pecas.some((p) => Number(p?.poe?.af?.conta_duas_armas) > 0)) v.add('duasArmas');
  if (pecas.some((p) => Number(p?.poe?.af?.conta_todas_armas_uma_mao) > 0)) for (const c of ['comEspada', 'comMachado', 'comMaca', 'comAdaga', 'comGarra', 'comCetro', 'umaMao', 'armaCorpo']) v.add(c);
  const h = estado?.hunt;
  const r = h?.poeRecente ?? {};
  const agora = h?.clock ?? 0;
  if (h) {
    v.add(recente(r.matou, agora) ? 'matouRecente' : 'naoMatouRecente');
    v.add(recente(r.critico, agora) ? 'criticoRecente' : 'naoCriticoRecente');
    if (recente(r.acertado, agora)) v.add('acertadoRecente');
    if (!recente(r.dano, agora)) v.add('semDanoRecente');
    if (r.moveu != null && agora - r.moveu <= MOVENDO_MS) v.add('movendo');
    // (Vida Cheia: a vida no máximo.)
    if (recente(r.lacaioMorreu, agora)) v.add('lacaioMorreuRecente');
    if (recente(r.usouLacaio, agora)) v.add('usouLacaioRecente');
  } else {
    v.add('naoMatouRecente').add('naoCriticoRecente').add('semDanoRecente');
  }
  if ((estado?.maxHp ?? 0) > 0 && (estado.hp ?? 0) <= VIDA_BAIXA * estado.maxHp) v.add('vidaBaixa');
  else v.add('naoVidaBaixa');
  if ((estado?.maxHp ?? 0) > 0 && (estado.hp ?? 0) >= estado.maxHp) v.add('vidaCheia');
  if ((estado?.maxMana ?? 0) > 0 && (estado.mana ?? 0) <= VIDA_BAIXA * estado.maxMana) v.add('manaBaixa');
  else v.add('naoManaBaixa');
  if (!(estado?.es > 0)) v.add('semEscudo');
  if (estado?.es > 0 && estado.esCheio) v.add('escudoCheio');
  if (!arma) v.add('desarmado');
  if (!estado?.equipment?.shield) v.add('maoSecundariaVazia');
  if (h) {
    const dots = h.efeitosDoJogador?.dots ?? [];
    const temDot = (...t) => dots.some((d) => t.includes(d.tipo) && d.falta > 0);
    if (temDot('queimadura')) v.add('ardendo'); else v.add('naoArdendo');
    if (temDot('sangramento')) v.add('sangrandoProprio');
    if (temDot('veneno', 'venenoPoe')) v.add('envenenadoProprio');
    if (temDot('maldicao')) v.add('amaldicoadoProprio');
    if (temDot('choque')) v.add('eletrizadoProprio');
    const c = h.controle ?? {};
    if (c.congelado?.ate > agora) v.add('congeladoProprio');
    if (c.lento?.ate > agora) v.add('resfriadoProprio');
    if (!v.has('ardendo') && !v.has('congeladoProprio') && !v.has('eletrizadoProprio') && !v.has('resfriadoProprio')) v.add('semAfeccaoElemental');
    const frascos = Object.values(h.frascosPoe?.ativos ?? {}).some((a) => a.ate > agora);
    v.add(frascos ? 'duranteFrasco' : 'semFrasco');
    if ((h.roubos ?? []).some((x) => x.restante > 0)) v.add('drenando');
    if (!v.has('movendo')) v.add('parado');
    if (!recente(r.acertado, agora)) v.add('naoAcertadoRecente');
    if (!recente(r.critico, agora)) v.add('naoCritRecente');
    for (const [k, cond] of Object.entries(RECENTES)) if (recente(r[k], agora)) v.add(cond);
    if (!recente(r.bloqueou, agora)) v.add('naoBloqueouRecente');
    if (!recente(r.ganhouPoder, agora)) v.add('naoGanhouPoderRecente');
    if (!recente(r.ganhouFrenesi, agora)) v.add('naoGanhouFrenesiRecente');
    if (!recente(r.perdeuPoder, agora)) v.add('naoPerdeuPoderRecente');
    if (!recente(r.usouAvanco, agora)) v.add('naoConjurouAvancoRecente');
  } else v.add('parado').add('semFrasco').add('naoAcertadoRecente').add('naoBloqueouRecente').add('naoGanhouPoderRecente').add('naoGanhouFrenesiRecente').add('naoPerdeuPoderRecente').add('naoConjurouAvancoRecente').add('naoCritRecente').add('naoArdendo').add('semAfeccaoElemental');
  return v;
}
/** Os acontecimentos "recentes" (o que `marcar` grava) → a condição. */
const RECENTES = {
  bloqueou: 'bloqueouRecente', atordoou: 'atordoouRecente', congelou: 'congelouRecente', incendiou: 'incendiouRecente', eletrizou: 'eletrizouRecente',
  usouMovimento: 'usouMovimentoRecente', usouVaal: 'usouVaalRecente', clamou: 'clamouRecente', acertou: 'acertouRecente', ganhouPoder: 'ganhouPoderRecente',
  consumiuCadaver: 'consumiuCadaverRecente', gastouMana: 'gastouManaRecente', usouHabilidade: 'usouHabilidadeRecente', recargaEs: 'recargaEsIniciouRecente',
  usouRubi: 'usouRubiRecente', usouSafira: 'usouSafiraRecente', usouTopazio: 'usouTopazioRecente', usouAmetista: 'usouAmetistaRecente', usouAvanco: 'conjurouAvancoRecente',
};
/** Uma condição vale? (as com parâmetro leem o estado, a soma e os atributos guardados no Set). */
export function vale(conds, c) {
  if (conds.has(c)) return true;
  const m = COND_COM_PARAMETRO.exec(c);
  if (!m) return false;
  const { estado, total, principais } = conds.parametros ?? {};
  const [, tipo, ...resto] = c.split(':');
  const h = estado?.hunt;
  const agora = h?.clock ?? 0;
  const cargas = (t) => { const x = h?.cargasPoe?.[t]; return x && x.ate > agora ? x.n | 0 : 0; };
  const maxCargas = (t) => 3 + (Number(total?.[`max_${t}`]) || 0);
  switch (tipo) {
    case 'atrMin': return (principais?.[resto[0]] ?? 0) >= Number(resto[1]);
    case 'atrMaior': return (principais?.[resto[0]] ?? 0) > (principais?.[resto[1]] ?? 0);
    case 'buff': return buffAtivo(estado, resto[0], total);
    case 'semCargas': return cargas(resto[0]) === 0;
    case 'comCargas': return cargas(resto[0]) > 0;
    case 'cargasMax': return cargas(resto[0]) >= maxCargas(resto[0]);
    case 'furiaMin': return (h?.furia?.n ?? 0) >= Number(resto[0]);
    case 'lacaio': return (h?.lacaios ?? []).some((l) => l.hp > 0 && (resto[0] === 'qualquer' || new RegExp(resto[0], 'i').test(l.nome ?? '')));
    case 'escudoMin': return (estado?.maxEsPoe ?? 0) >= Number(resto[0]);
    default: return false;
  }
}

/** Marca um acontecimento "recente" na caçada (`matou`, `critico`, `acertado`, `dano`, `moveu`, `lacaioMorreu`, `usouLacaio`). */
export function marcar(hunt, oque, agora = hunt?.clock ?? 0) {
  if (!hunt || !ligado()) return;
  (hunt.poeRecente ??= {})[oque] = agora;
}

// ---------------------------------------------------------------- a soma

/**
 * Resolve os atributos condicionais de ESTADO na soma (`total`, mexe nele): `atk_speed@comEscudo` com escudo entra em `atk_speed`.
 * Os que têm alguma tag de GOLPE ficam (o `fichaDoGolpe` resolve em cada acerto). Devolve `total`.
 */
export function resolver(estado, total, principais = null) {
  if (!ligado() || !total) return total;
  let conds = null;
  for (const [k, v] of Object.entries(total)) {
    if (!ehCondicional(k) || typeof v !== 'number') continue;
    const { stat, escala, conds: c } = partir(k);
    if (c.some((x) => !ehCondDeEstado(x))) continue;
    // A escala que depende da FICHA (precisão, armadura, evasão, escudo, bloqueio): a segunda passada da ficha (`escalasDaFicha`).
    if (escala && ESCALAS_DA_FICHA.test(escala)) continue;
    conds ??= condicoesDe(estado, total, principais);
    if (!c.every((x) => vale(conds, x))) continue;
    const m = escala ? fatorDaEscala(estado, total, principais, escala) : 1;
    if (m) total[stat] = (total[stat] ?? 0) + v * m;
  }
  return total;
}

/** As escalas que só a ficha sabe (a segunda passada). */
export const ESCALAS_DA_FICHA = /^(precisao|armadura|evasao|esMax|bloqueio|bloqueioMagico|armaduraEscudo|evasaoEscudo|esEscudo):/;

/**
 * O fator de uma ESCALA ("por X"): `nivel`, `atr:dex:10` (a cada 10 de Destreza), `carga:frenesi`, `cargaMax:poder`, `furia`, `furia:5`,
 * `vidaMax:N`, `manaMax:N`, `encaixe:R` (sockets vermelhos no equipamento), `encaixeVazio:G`, `itemCorrompido`, `itemNaoCorrompido`,
 * `itemUnico`, `lacaio` (vivos), `lacaio:zumbi`, `venenoEmVoce`, `afeccaoEmVoce`, `atributoMenor:N`, `atributos:N`, `mana:N`.
 */
export function fatorDaEscala(estado, total, principais, escala) {
  const [tipo, a, b] = escala.split(':');
  const h = estado?.hunt;
  const agora = h?.clock ?? 0;
  const cada = (valor, n) => Math.floor(Math.max(0, valor) / Math.max(1, Number(n) || 1));
  const eq = Object.entries(estado?.equipment ?? {}).filter(([slot, p]) => p && slot !== 'backpack');
  switch (tipo) {
    case 'nivel': return a ? cada(estado?.level ?? 1, a) : estado?.level ?? 1;
    case 'atr': return cada(principais?.[a] ?? 0, b);
    case 'atributoMenor': return cada(Math.min(principais?.str ?? 0, principais?.dex ?? 0, principais?.int ?? 0), a);
    case 'atributos': return cada((principais?.str ?? 0) + (principais?.dex ?? 0) + (principais?.int ?? 0), a);
    case 'carga': { const x = h?.cargasPoe?.[a]; return x && x.ate > agora ? x.n | 0 : 0; }
    case 'cargaMax': return 3 + (Number(total?.[`max_${a}`]) || 0);
    case 'furia': return a ? cada(h?.furia?.n ?? 0, a) : h?.furia?.n ?? 0;
    case 'vidaMax': return cada(estado?.maxHp ?? 0, a);
    case 'manaMax': return cada(estado?.maxMana ?? 0, a);
    case 'encaixe': return eq.reduce((n, [, p]) => n + (p.soquetes?.cores ?? []).slice(0, p.soquetes?.abertos ?? 0).filter((c) => c === a).length, 0);
    case 'encaixeVazio': return eq.reduce((n, [, p]) => n + (p.soquetes?.cores ?? []).slice(0, p.soquetes?.abertos ?? 0).filter((c, i) => c === a && !p.soquetes?.gemas?.[i]).length, 0);
    case 'itemCorrompido': return eq.filter(([, p]) => p.poe?.corrompido).length;
    case 'itemNaoCorrompido': return eq.filter(([, p]) => !p.poe?.corrompido).length;
    case 'itemUnico': return eq.filter(([, p]) => p.poe?.raridade === 'unico').length;
    case 'lacaio': return (h?.lacaios ?? []).filter((l) => l.hp > 0 && (!a || new RegExp(a, 'i').test(l.nome ?? ''))).length;
    case 'venenoEmVoce': return Math.min(Number(b) || Infinity, (h?.efeitosDoJogador?.dots ?? []).filter((d) => /veneno/i.test(d.tipo) && d.falta > 0).length);
    case 'afeccaoEmVoce': return new Set((h?.efeitosDoJogador?.dots ?? []).filter((d) => d.falta > 0).map((d) => d.tipo)).size + ['congelado', 'lento', 'atordoado'].filter((k) => h?.controle?.[k]?.ate > agora).length;
    case 'mana': return cada(estado?.maxMana ?? 0, a);
    case 'matouRecente': return Math.min(Number(b) || Infinity, (h?.poeMortesRecentes ?? []).filter((t) => agora - t <= RECENTE_MS).length);
    default: return 0;
  }
}

/** A segunda passada da ficha: as escalas que dependem dela (precisão, armadura, evasão, escudo, bloqueio). `{ stat: valor }` a somar. */
export function escalasDaFicha(estado, total, ficha) {
  if (!ligado() || !total || !ficha) return null;
  const saida = {};
  let conds = null;
  for (const [k, v] of Object.entries(total)) {
    if (typeof v !== 'number' || !String(k).includes('%')) continue;
    const { stat, escala, conds: c } = partir(k);
    if (!escala || !ESCALAS_DA_FICHA.test(escala) || c.some((x) => !ehCondDeEstado(x))) continue;
    conds ??= condicoesDe(estado, total);
    if (!c.every((x) => vale(conds, x))) continue;
    const [tipo, n] = escala.split(':');
    const base = { precisao: ficha.accuracy, armadura: ficha.armor, evasao: ficha.evasion, esMax: ficha.energyShield, bloqueio: (ficha.blockChance ?? 0) * 100, bloqueioMagico: (ficha.bloqueioDeMagia ?? 0) * 100 }[tipo] ?? 0;
    const m = Math.floor(Math.max(0, base) / Math.max(1, Number(n) || 1));
    if (m) saida[stat] = (saida[stat] ?? 0) + v * m;
  }
  return Object.keys(saida).length ? saida : null;
}

// ---------------------------------------------------------------- os BUFFS nomeados do PoE

/**
 * Os buffs com nome do PoE (os números são os do lembrete do próprio catálogo): enquanto ativos, somam estes atributos (`adds`).
 * Ganha-se por evento (`ev:<evento>:buff:<nome>` = segundos — `mods-poe.evento`) ou sempre (`sempre:<nome>@cond`).
 */
export const BUFFS = {
  agressividade: { nome: 'Agressividade', af: { atk_speed: 20, cast_speed: 20, move_speed: 20 } },
  adrenalina: { nome: 'Adrenalina', af: { dmg_inc: 100, atk_speed: 25, cast_speed: 25, move_speed: 25, phys_res: 10 } },
  poderProfano: { nome: 'Poder Profano', af: { phys_as_extra_chaos: 100 } },
  poderCaotico: { nome: 'Poder Caótico', af: { phys_as_extra_chaos: 30 } },
  furiaArcana: { nome: 'Fúria Arcana', af: { cast_speed: 10, mana_regen_pct: 30, spell_dmg: 10 } },
  elusivo: { nome: 'Elusivo', af: { avoid_damage: 15, move_speed: 30 } },
  trespassar: { nome: 'Trespassar', af: {} },
  fortificado: { nome: 'Fortificado', af: { dmg_reduction: 20 } },
  divindade: { nome: 'Divindade', af: { fire_dmg: 50, ice_dmg: 50, energy_dmg: 50, dmg_reduction: 10 } },
  furtividadeFelina: { nome: 'Furtividade Felina', af: { crit_chance_inc: 50 } },
  agilidadeDoGato: { nome: 'Agilidade do Gato', af: { avoid_damage: 10, move_speed: 10 } },
  vooDaAve: { nome: 'Vôo da Ave', af: { move_speed: 20 } },
  poderDaAve: { nome: 'Poder da Ave', af: { atk_speed: 10, cast_speed: 10 } },
  avatarDoFogo: { nome: 'Avatar do Fogo', af: { phys_conv_fire: 50 } },
  sobrecargaElemental: { nome: 'Sobrecarga Elemental', af: { fire_dmg: 40, ice_dmg: 40, energy_dmg: 40 } },
  tecnicaResoluta: { nome: 'Técnica Resoluta', af: { nunca_erra: 1 } },
  juramentoDoZelote: { nome: 'Juramento do Zelote', af: {} },
  pactoVaal: { nome: 'Pacto Vaal', af: { life_leech: 2 } },
  agoniaPerfeita: { nome: 'Agonia Perfeita', af: { dot_multi: 30 } },
  presencaEnlouquecedora: { nome: 'Presença Enlouquecedora', af: { dmg_inc: 10 } },
  presencaDoCriador: { nome: 'Presença do Criador', af: { dmg_inc: 10 } },
  fervorSacrificial: { nome: 'Fervor Sacrificial', af: {} },
  vossoAbraco: { nome: 'Vosso Abraço', af: { fire_dmg: 50, dmg_inc: 25 } },
  intangivel: { nome: 'Intangibilidade', af: {} },
  devoradorDeAlmas: { nome: 'Devorador de Almas', af: { atk_speed: 10, cast_speed: 10 } },
  ultimoSuspiro: { nome: 'Último Suspiro', af: {} },
  danCaCarmesim: { nome: 'Dança Carmesim', af: {} },
  confluxo: { nome: 'Confluxo Elemental', af: { chance_ignite: 100, chance_freeze: 100, chance_shock: 100 } },
  altarMenor: { nome: 'Altar Menor', af: { dmg_inc: 10 } },
};
/** O buff está ativo? (ganho por evento, ou "sempre" pela soma). */
export function buffAtivo(estado, nome, total = null) {
  const h = estado?.hunt;
  if (h?.poeBuffs?.[nome] > (h?.clock ?? 0)) return true;
  return Number(total?.[`sempre:${nome}`]) > 0;
}
/** Ganha um buff por `segundos` (renova para o maior). */
export function ganharBuff(hunt, nome, segundos, agora = hunt?.clock ?? 0) {
  if (!hunt || !BUFFS[nome] || !(segundos > 0)) return;
  const b = (hunt.poeBuffs ??= {});
  b[nome] = Math.max(b[nome] ?? 0, agora + segundos * 1000);
}
/** O que os buffs ativos somam (`Afixos.soma`): `{ stat: valor }` ou null. "+X% Efeito da Agressividade" multiplica a dela. */
export function adds(estado, total = null) {
  if (!ligado()) return null;
  const saida = {};
  for (const [nome, b] of Object.entries(BUFFS)) {
    if (!buffAtivo(estado, nome, total)) continue;
    const efeito = 1 + (Number(total?.[`efeito_buff:${nome}`]) || 0) / 100;
    for (const [k, v] of Object.entries(b.af)) saida[k] = (saida[k] ?? 0) + v * efeito;
  }
  return Object.keys(saida).length ? saida : null;
}
/** Os buffs ativos para a tela (cartões da caçada). */
export function buffsParaTela(estado) {
  const h = estado?.hunt;
  if (!h?.poeBuffs) return [];
  const agora = h.clock ?? 0;
  return Object.entries(h.poeBuffs).filter(([, ate]) => ate > agora).map(([k, ate]) => ({ icone: null, nome: BUFFS[k]?.nome ?? k, resta: ate - agora, tipo: 'buffPoe' }));
}

/**
 * Os condicionais de GOLPE que sobram na soma (já com as condições de estado conferidas): `[{ stat, tags: [...], valor }]`. A ficha guarda
 * isto (`ficha.porTag`) para cada acerto escolher os seus.
 */
export function porTag(estado, total, principais = null) {
  if (!ligado() || !total) return [];
  const saida = [];
  let conds = null;
  for (const [k, v] of Object.entries(total)) {
    if (!ehCondicional(k) || typeof v !== 'number' || !v || String(k).startsWith('ev:')) continue;
    const { stat, escala, conds: c } = partir(k);
    const tags = c.filter((x) => !ehCondDeEstado(x));
    if (!tags.length) continue;
    if (escala && ESCALAS_DA_FICHA.test(escala)) continue;
    conds ??= condicoesDe(estado, total, principais);
    if (!c.filter((x) => ehCondDeEstado(x)).every((x) => vale(conds, x))) continue;
    const m = escala ? fatorDaEscala(estado, total, principais, escala) : 1;
    if (m) saida.push({ stat, tags, valor: v * m });
  }
  return saida;
}

/**
 * Os mods de EVENTO da soma (`ev:<evento>:<ação>[:<parâmetro>]@conds`): `[{ evento, acao, param, conds, valor }]`. As condições são
 * conferidas na hora do evento (com o alvo dele) — `mods-poe.evento`.
 */
export function eventosDa(total) {
  if (!ligado() || !total) return [];
  const saida = [];
  for (const [k, v] of Object.entries(total)) {
    if (!String(k).startsWith('ev:') || typeof v !== 'number' || !v) continue;
    const { stat, conds } = partir(k);
    const [, evento, acao, ...param] = stat.split(':');
    saida.push({ evento, acao, param: param.join(':'), conds, valor: v });
  }
  return saida;
}

// ---------------------------------------------------------------- o golpe

/** As tags do poedb (em português) → as tags de golpe daqui. */
const TAG_DO_POE = {
  Ataque: 'ataque', Magia: 'magia', 'Corpo a Corpo': 'corpo', Projétil: 'projetil', Área: 'area', Fogo: 'fogo', Gelo: 'gelo', Raio: 'raio',
  Físico: 'fisico', Caos: 'caos', Arco: 'arco', Totem: 'totem', Armadilha: 'armadilha', Mina: 'mina', Lacaio: 'lacaio', Arauto: 'arauto',
  Vaal: 'vaal', Movimento: 'movimento', Clamor: 'clamor', Aura: 'aura', Maldição: 'maldicao',
};
/** As tags de golpe de uma lista de tags do poedb (`['Ataque','Projétil','Arco']` → `['ataque','projetil','arco']`), + `elemental`. */
export function tagsDoPoe(lista = []) {
  const t = new Set();
  for (const x of lista) {
    const k = TAG_DO_POE[String(x).replace(/^poe:/, '')];
    if (k) t.add(k);
  }
  if (t.has('fogo') || t.has('gelo') || t.has('raio')) t.add('elemental');
  return [...t];
}
/** As tags do golpe básico: ataque + corpo a corpo (ou projétil, de longe) + físico (+ arco). */
export function tagsDoGolpeBasico(estado, categoria) {
  const arma = classeDe(estado?.equipment?.weapon);
  const longe = categoria === 'distancia' || categoria === 'magica' || A_DISTANCIA.has(arma);
  const t = ['ataque', longe ? 'projetil' : 'corpo', 'fisico'];
  if (arma === 'Bows') t.push('arco');
  return t;
}

/** A soma dos condicionais de golpe da ficha que valem para estas tags: `{ stat: valor }`. */
export function somaPorTags(ficha, tags) {
  const tem = new Set(tags);
  const s = {};
  for (const x of ficha?.porTag ?? []) if (x.tags.every((t) => tem.has(t))) s[x.stat] = (s[x.stat] ?? 0) + x.valor;
  return s;
}

const ELEMENTO_DA_TAG = { fogo: 'fire', gelo: 'ice', raio: 'energy', fisico: 'physical', caos: 'chaos' };

/**
 * A FICHA DE UM GOLPE: a ficha do personagem com o que vale só para estas tags (e este alvo) — o "Dano aumentado" (entra em cada elemento
 * de `danoDoElemento`, a soma aditiva do PoE), o crítico (chance × os "aumentada", multiplicador), a penetração e as afecções. Sem nada
 * condicional, a MESMA ficha volta (nada muda).
 */
export function fichaDoGolpe(ficha, tags = [], { alvo = null, estado = null, rng = Math.random } = {}) {
  if (!ligado() || !ficha?.afPoe) return ficha;
  const agora = estado?.hunt?.clock ?? 0;
  const t = new Set([...tags, ...tagsDoAlvo(alvo, agora)]);
  if (alvo && alvo.maxHp > 0 && alvo.hp <= VIDA_BAIXA * alvo.maxHp) t.add('alvoVidaBaixa');
  if (alvo && estado?.hunt?.pos && Math.max(Math.abs(alvo.x - estado.hunt.pos.x), Math.abs(alvo.y - estado.hunt.pos.y)) <= 2) t.add('alvoPerto');
  const s = somaPorTags(ficha, [...t]);
  // A Fúria do PoE: +1% de Dano de Ataque aumentado por Fúria ("Fúria concede Dano Mágico ao invés": nas magias).
  const furiaNaMagia = (Number(ficha.afPoe.furia_magica) || 0) > 0;
  const furia = (furiaNaMagia ? t.has('magia') : t.has('ataque')) ? furiaAtual(estado) : 0;
  // (O "Dano aumentado" sem condição já está em `danoDoElemento` da ficha; aqui só o condicional e a Fúria.)
  const danoGeral = (s.dmg_inc ?? 0) + furia;
  const critInc = s.crit_chance_inc ?? 0;
  const critMult = s.crit_dmg ?? 0;
  const pen = s.elem_pen ?? 0;
  const temAfeccao = Object.keys(s).some((k) => /^(chance_|dot_|ailment_|poison_|bleed_|ignite_|duracao_|efeito_|envenena|pode:)/.test(k));
  // Os sorteios do golpe: "Dano Dobrado"/"Triplicado" e "ignorar a Redução de Dano Físico" (a chance sem condição + a do golpe).
  const chance = (k) => (Number(ficha.afPoe[k]) || 0) + (s[k] ?? 0);
  const triplo = chance('chance_dano_triplo') > 0 && rng() * 100 < chance('chance_dano_triplo');
  const dobro = !triplo && chance('chance_dano_dobrado') > 0 && rng() * 100 < chance('chance_dano_dobrado');
  const ignora = chance('ignora_reducao_fisica') > 0 && rng() * 100 < chance('ignora_reducao_fisica');
  const f = { ...ficha };
  f.tagsDoGolpe = [...t];
  // "X% mais/menos Dano" (com condição): multiplica o golpe inteiro (o mesmo fator das cargas, em `Ficha.rolarCritico`).
  const mais = (s.mais_dano ?? 0) + (Number(ficha.afPoe.mais_dano) || 0);
  const fator = (triplo ? 3 : dobro ? 2 : 1) * Math.max(0, 1 + mais / 100);
  if (fator !== 1) f.fatorDasCargas = (ficha.fatorDasCargas ?? 1) * fator;
  if (ignora) f.ignoraReducaoFisica = true;
  // O "aumentado" de UM elemento com condição ("Dano de Gelo aumentado com Habilidades de Ataque"), a penetração de um elemento, o dano
  // somado com condição ("contra Inimigos Resfriados") e o roubo com condição ("contra Inimigos Eletrizados").
  const doElemento = { physical: (s.phys_dmg ?? 0), fire: s.fire_dmg ?? 0, ice: s.ice_dmg ?? 0, energy: s.energy_dmg ?? 0, chaos: s.chaos_dmg ?? 0 };
  const temElemento = Object.values(doElemento).some(Boolean);
  if (danoGeral || temElemento) f.danoDoElemento = Object.fromEntries(Object.entries({ physical: 0, fire: 0, ice: 0, energy: 0, chaos: 0, ...(ficha.danoDoElemento ?? {}) }).map(([el, v]) => [el, v + danoGeral + (doElemento[el] ?? 0)]));
  const somado = {};
  for (const el of ['fire', 'ice', 'energy', 'chaos', 'physical']) {
    const a = s[`added_${el}_dmg_min`] ?? 0;
    const b = s[`added_${el}_dmg_max`] ?? 0;
    if (a || b) somado[el] = [a, b];
  }
  if (Object.keys(somado).length) {
    const novo = { ...(ficha.danoSomado ?? {}) };
    for (const [el, [a, b]] of Object.entries(somado)) novo[el] = [(novo[el]?.[0] ?? 0) + a, (novo[el]?.[1] ?? 0) + b];
    f.danoSomado = novo;
    const novoM = { ...(ficha.danoSomadoMagia ?? {}) };
    for (const el of ['fire', 'ice', 'energy', 'chaos', 'physical']) { const a = s[`spell_added_${el}_dmg_min`] ?? 0; const b = s[`spell_added_${el}_dmg_max`] ?? 0; if (a || b) novoM[el] = [(novoM[el]?.[0] ?? 0) + a, (novoM[el]?.[1] ?? 0) + b]; }
    f.danoSomadoMagia = novoM;
  }
  if (s.life_leech) f.lifeLeech = (ficha.lifeLeech ?? 0) + s.life_leech / 100;
  if (s.mana_leech) f.manaLeech = (ficha.manaLeech ?? 0) + s.mana_leech / 100;
  // "Nunca causa Acertos Críticos" / "Não pode Causar Golpes Críticos com Ataques".
  if ((s.nunca_critico ?? 0) > 0) { f.critChance = 0; f.critMagiaPoe = ficha.critMagiaPoe ? { fixa: -100, aumentada: 0 } : null; f.critChanceMagia = 0; return finalizar(f, ficha, s, temAfeccao); }
  if (critInc && ficha.critPontos != null) {
    const teto = ficha.critTeto ?? 1;
    f.critChance = Math.min(teto, Math.max(0, ficha.critPontos * (1 + ((ficha.critInc ?? 0) + critInc) / 100) * (ficha.critMais ?? 1)));
    if (ficha.critMagiaPoe) f.critMagiaPoe = { ...ficha.critMagiaPoe, aumentada: ficha.critMagiaPoe.aumentada + critInc };
    if (ficha.critChanceMagia != null) f.critChanceMagia = Math.min(teto, Math.max(0, ficha.critPontos * (1 + ((ficha.critInc ?? 0) + (ficha.critIncMagia ?? 0) + critInc) / 100) * (ficha.critMais ?? 1)));
  }
  if (s.crit_chance) f.critChance = Math.min(ficha.critTeto ?? 1, (f.critChance ?? 0) + s.crit_chance / 100);
  if (critMult) f.critMultiplier = (ficha.critMultiplier ?? 1.5) + critMult / 100;
  const penPorElemento = { fire: s.fire_pen ?? 0, ice: s.ice_pen ?? 0, energy: s.energy_pen ?? 0 };
  if (pen || s.phys_pen || Object.values(penPorElemento).some(Boolean)) {
    const p = ficha.penetracao ?? { fisica: 0, elemental: 0, porElemento: {} };
    const pe = { ...(p.porElemento ?? {}) };
    for (const [el, v] of Object.entries(penPorElemento)) if (v) pe[el] = (pe[el] ?? 0) + v;
    f.penetracao = { ...p, elemental: Math.min(100, (p.elemental ?? 0) + pen), fisica: Math.min(100, (p.fisica ?? 0) + (s.phys_pen ?? 0)), porElemento: pe };
  }
  return finalizar(f, ficha, s, temAfeccao);
}
function finalizar(f, ficha, s, temAfeccao) {
  if (temAfeccao && ficha.recalcularAfeccoes) f.afeccoes = ficha.recalcularAfeccoes({ ...ficha.afPoe, ...somarSobre(ficha.afPoe, s) });
  return f;
}

/** As tags do ALVO num acerto/evento (o que as condições `alvo*` leem): os estados dele agora e a raridade. */
export function tagsDoAlvo(alvo, agora) {
  const t = [];
  if (!alvo) return t;
  const e = alvo.estados ?? {};
  const at = (x) => !!x && x.ate > agora;
  if (at(e.lento)) t.push('alvoResfriado', 'alvoLento');
  if (at(e.congelado)) t.push('alvoCongelado');
  if (at(e.chocado)) t.push('alvoEletrizado');
  if (at(e.cego)) t.push('alvoCego');
  if (at(e.mutilado)) t.push('alvoMutilado');
  if (at(e.provocado)) t.push('alvoProvocado');
  const dots = alvo.dots ?? [];
  const dot = (...k) => dots.some((d) => k.includes(d.tipo) && d.falta > 0);
  if (dot('sangramento')) t.push('alvoSangrando');
  if (dot('veneno', 'venenoPoe')) t.push('alvoEnvenenado');
  if (dot('queimadura')) t.push('alvoIncendiado');
  if (dot('maldicao') || at(e.amaldicoado)) t.push('alvoAmaldicoado');
  const rar = alvo.raridade ?? alvo.raridadePoe;
  if (rar === 'raro') t.push('alvoRaro');
  if (rar === 'unico' || alvo.boss || alvo.chefe) t.push('alvoUnico');
  if (rar === 'magico') t.push('alvoMagico');
  if (alvo.maxHp > 0 && alvo.hp >= alvo.maxHp) t.push('alvoVidaCheia');
  return t;
}
const somarSobre = (base, s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, (base[k] ?? 0) + v]));

/** O elemento de uma tag (`'fogo'` → `'fire'`). */
export const elementoDaTag = (tag) => ELEMENTO_DA_TAG[tag] ?? null;

// ---------------------------------------------------------------- a Fúria

/** Fúria do PoE: até 30; +1% de Dano de Ataque aumentado por Fúria; perde 1 a cada 0,5 s sem ganhar Fúria há 2 s. */
export const FURIA = { maximo: 30, perdaMs: 500, esperaMs: 2000 };
export function furiaAtual(estado) {
  const f = estado?.hunt?.furia;
  return f ? Math.max(0, Math.min(FURIA.maximo, f.n | 0)) : 0;
}
export function ganharFuria(hunt, n, agora = hunt?.clock ?? 0) {
  if (!hunt || !(n > 0)) return;
  const f = (hunt.furia ??= { n: 0, ganhou: agora, perdeu: agora });
  f.n = Math.min(FURIA.maximo, (f.n | 0) + n);
  f.ganhou = agora;
  f.perdeu = agora;
}
/** O tique da Fúria (a caçada chama): sem ganhar há `esperaMs`, perde 1 a cada `perdaMs`. */
export function tiqueDaFuria(hunt, agora = hunt?.clock ?? 0) {
  const f = hunt?.furia;
  if (!f || !(f.n > 0)) return;
  if (agora - f.ganhou < FURIA.esperaMs) { f.perdeu = agora; return; }
  while (f.n > 0 && agora - f.perdeu >= FURIA.perdaMs) { f.n--; f.perdeu += FURIA.perdaMs; }
}

/** A chave de um atributo da peça vestida em `slot`, resolvendo a condição de ANEL: no anel certo, sem a condição; no outro, null. */
export function doAnel(chave, slot) {
  const { stat, escala, conds } = partir(chave);
  const deAnel = conds.filter((c) => CONDICOES_DE_ANEL[c]);
  if (!deAnel.length) return chave;
  if (!deAnel.every((c) => CONDICOES_DE_ANEL[c] === slot)) return null;
  const resto = conds.filter((c) => !CONDICOES_DE_ANEL[c]);
  const base = escala ? `${stat}%${escala}` : stat;
  return resto.length ? `${base}@${resto.join('+')}` : base;
}

/** O nome de uma gema como chave (`Toque de Doryani` → `toque-de-doryani`): o que "Concede a Habilidade X" grava. */
export const slugDoNome = (nome) => String(nome ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------------------------------------------------------------- os atributos DINÂMICOS (validação da tradução)

/** Os eventos que `mods-poe.evento` dispara e as ações que ele sabe fazer. */
export const EVENTOS = new Set(['matar', 'critico', 'bloquear', 'serAcertado', 'serAcertadoCritico', 'atordoar', 'incendiar', 'congelar', 'eletrizar', 'envenenar',
  'acertar', 'usarHabilidade', 'usarMagia', 'usarAtaque', 'usarMovimento', 'usarVaal', 'usarClamor', 'usarFrasco', 'usarFrascoMana', 'suprimir', 'perderTolerancia',
  'maxPoder', 'maxFrenesi', 'maxTolerancia', 'tempo', 'provocar', 'golpeDeMisericordia', 'vidaBaixa', 'equipado', 'perderPoder', 'conjurarMaldicao', 'gastarMana', 'armadilha', 'morrer']);
export const ACOES = new Set(['vidaFaltaPct', 'perdeMana', 'perdeUmaCarga', 'refletir', 'vida', 'vidaPct', 'mana', 'manaPct', 'es', 'esPct', 'carga', 'cargaMax', 'perdeCargas', 'cargaAleatoria', 'buff', 'alvo', 'proximos',
  'dano', 'danoPctVida', 'furia', 'frasco', 'recargaEs', 'explodir', 'gatilho', 'espalhar', 'roubarCargas', 'maldicao', 'soloSagrado', 'fumaca', 'removerAfeccao', 'perdeVidaPct', 'perdeEsPct', 'perdeManaPct']);
/** Os prefixos de atributo montados pelo nome (`sempre:<buff>`, `efeito_buff:<buff>`, `concede:<gema>`, `suporte_local:<gema>`). */
/**
 * Quem sabe se uma gema existe pelo NOME ("Concede a Habilidade X", "Suportadas por X"): as gemas do PoE carregam depois e `skills/gemas.mjs`
 * registra aqui (neste módulo puro, para a tradução não importar as gemas — o que fecharia um ciclo de imports). `undefined` = não se sabe ainda.
 */
// eslint-disable-next-line no-var
var conhecePelaGema;
export function definirGemasConhecidas(fn) { conhecePelaGema = fn; }
export function gemaConhecida(slug) { return conhecePelaGema ? conhecePelaGema(slug) : undefined; }
const DINAMICOS = /^(sempre|efeito_buff|concede|suporte_local|keystone):[\w-]+$/;
/** As FAMÍLIAS de atributo com parâmetro que o código monta pelo nome (o parâmetro tem de ser um dos que ele conhece). */
const ELS_P = '(physical|fire|ice|energy|chaos)';
const TIPOS_DE_LACAIO = '(zumbi|espectro|golem|esqueleto|totem|espirito|fantasma|reliquia|sagrado|arma|aranha|qualquer)';
const PARAMETRICOS = [
  new RegExp(`^pode:(incendio|congelamento|resfriamento|eletrizacao|veneno|sangramento):${ELS_P}$`), // itens-poe/afeccoes.daSoma
  new RegExp(`^nao_pode:(incendio|congelamento|resfriamento|eletrizacao|veneno|sangramento)(:${ELS_P})?$`), // itens-poe/afeccoes.daSoma
  new RegExp(`^(max_lacaio|max_lacaio_pct|lacaio_dano|lacaio_mais_dano|lacaio_vida|lacaio_vida_fixa|lacaio_mov|lacaio_duracao|lacaio_degen|lacaio_vel_ataque):${TIPOS_DE_LACAIO}$`), // lacaios-poe.oQueInvoca
  /^res_fixa(_tem)?:(fire|ice|energy|chaos)$/, // ficha (resistência fixa)
  /^frasco_regen_[ns]:(vida|mana|utilidade|todos)$/, /^frasco_instantaneo_baixa:(vida|mana)$/, /^sem_frasco:(vida|mana|utilidade)$/, // itens-poe/frascos
  /^aura_proximos:(cego|mutilado|intimidado|debilitado|cinzas|causticado|fragilizado|exaurido|lento|provocado|resfriado|exposicaoFogo|exposicaoGelo|exposicaoRaio|amaldicoado|definhado)$/, // mods-poe.aurasProximas
  /^efeito_buff_gema:(aura|clamor|arauto|lacaio|todos)$/, // itens-poe/gemas-poe (reforços das gemas)
  new RegExp(`^sem_dano:(${ELS_P.slice(1, -1)}|elemental|naocaos|naoelemental|naofisico)$`), new RegExp(`^so_dano:${ELS_P}$`), // transformarPartes
];
/** O atributo dinâmico tem efeito (sabe-se o que fazer com ele)? */
export function dinamicoValido(stat) {
  if (String(stat).startsWith('ev:')) {
    const [, evento, acao] = stat.split(':');
    return EVENTOS.has(evento) && ACOES.has(acao);
  }
  const m = /^(sempre|efeito_buff):(\w+)$/.exec(stat);
  if (m) return !!BUFFS[m[2]];
  return DINAMICOS.test(stat) || PARAMETRICOS.some((re) => re.test(stat));
}
/** A escala é conhecida? */
export const escalaValida = (e) => !e || /^(nivel|atr|atributoMenor|atributos|carga|cargaMax|furia|vidaMax|manaMax|encaixe|encaixeVazio|itemCorrompido|itemNaoCorrompido|itemUnico|lacaio|venenoEmVoce|afeccaoEmVoce|mana|matouRecente)(:|$)/.test(e) || ESCALAS_DA_FICHA.test(e);

/** Os números base do PoE dos efeitos de acerto. */
export const NO_ACERTO = {
  // Atordoamento: chance = 200 × dano ÷ limiar (a vida máxima do alvo, − o "Ponto de Atordoamento reduzido"); abaixo de 15%, nada.
  atordoamento: { fator: 200, minimoPct: 15, duracaoMs: 350 },
  mutilar: { duracaoMs: 4000, lentidaoPct: 30 },
  cegar: { duracaoMs: 4000, precisaoMenosPct: 20 },
  desacelerar: { duracaoMs: 4000, lentidaoPct: 30 },
  provocar: { duracaoMs: 3000, danoMenosPct: 10 },
  // Empalar: guarda 10% do dano Físico do acerto; os próximos 5 acertos no alvo causam o guardado de novo; até 5 empalamentos, 8 s.
  empalar: { pctDoFisico: 10, acertos: 5, maximo: 5, duracaoMs: 8000 },
};
/** A recuperação do dano sofrido (Recoup do PoE) acontece em 4 s. */
export const RECUPERACAO_MS = 4000;

// ---------------------------------------------------------------- ler um mod

/** O valor de um atributo do PoE na soma do personagem (`ficha.afPoe`: já com as condições de estado), + o condicional do golpe. */
export function valor(ficha, stat) {
  const base = Number(ficha?.afPoe?.[stat]) || 0;
  if (!ficha?.tagsDoGolpe) return base;
  return base + (somaPorTags(ficha, ficha.tagsDoGolpe)[stat] ?? 0);
}
export const ativo = (s, agora) => !!s && s.ate > agora;

// ---------------------------------------------------------------- no ACERTO do personagem

/** O "X% de chance de causar Dano Dobrado" de um golpe: 2 ou 1. */
export const fatorDeDanoDobrado = (ficha, rng = Math.random) => (ligado() && rng() * 100 < valor(ficha, 'chance_dano_dobrado') ? 2 : 1);

/** O golpe ignora a redução de dano Físico do alvo? (a chance do "Acertos … ignoram a Redução de Dano Físico"). */
export const ignoraReducaoFisica = (ficha, rng = Math.random) => ligado() && rng() * 100 < valor(ficha, 'ignora_reducao_fisica');

/**
 * As partes de dano EXTRA de um ataque a partir do Físico dele: "Ganha X% do Dano Físico como Dano de Caos/Fogo extra" e "X% do Dano Físico
 * … é Convertido para um Elemento Aleatório". `fisico`: `[min, max]` (ou um número). Devolve `{ extras: { elemento: [min, max] },
 * convertidoPct }` — o convertido sai do Físico (quem chama tira) e entra no elemento sorteado.
 */
export function extrasDoFisico(ficha, fisico, rng = Math.random) {
  const [a, b] = Array.isArray(fisico) ? fisico : [fisico, fisico];
  const extras = {};
  const somar = (el, pct) => { if (pct > 0) { const x = extras[el] ?? [0, 0]; extras[el] = [x[0] + (a * pct) / 100, x[1] + (b * pct) / 100]; } };
  somar('chaos', valor(ficha, 'phys_as_extra_chaos'));
  somar('fire', valor(ficha, 'phys_as_extra_fire'));
  somar('ice', valor(ficha, 'phys_as_extra_ice'));
  somar('energy', valor(ficha, 'phys_as_extra_energy'));
  // "Ganha X% do Dano Físico como Dano Extra de um Elemento aleatório": um elemento sorteado a cada golpe.
  if (valor(ficha, 'phys_as_extra_random') > 0) somar(['fire', 'ice', 'energy'][Math.floor(rng() * 3)], valor(ficha, 'phys_as_extra_random'));
  // As CONVERSÕES ("X% do Dano Físico Convertido em Dano de Fogo", e a de elemento aleatório): no máximo 100% do Físico, como no PoE.
  let conv = 0;
  const converter = (el, pct) => { const p = Math.max(0, Math.min(100 - conv, pct)); if (p > 0) { somar(el, p); conv += p; } };
  for (const el of ['fire', 'ice', 'energy', 'chaos']) converter(el, valor(ficha, `phys_conv_${el}`));
  if (valor(ficha, 'phys_conv_random') > 0) converter(['fire', 'ice', 'energy'][Math.floor(rng() * 3)], valor(ficha, 'phys_conv_random'));
  return { extras, convertidoPct: conv };
}

// ---------------------------------------------------------------- quando o personagem é ACERTADO

/** O personagem BLOQUEOU o golpe de `bicho`: "Inflige Causticar/Enfraquecer/Exaurir em Inimigos ao Bloquear seu Dano". */
export const AO_BLOQUEAR = { duracaoMs: 4000, causticar: 10, enfraquecer: 6, exaurir: 10 };
export function aoBloquear(hunt, bicho, ficha, { agora = hunt?.clock ?? 0, eventos = [] } = {}) {
  if (!ligado() || !bicho || !ficha?.afPoe) return eventos;
  const e = (bicho.estados ??= {});
  const ate = agora + AO_BLOQUEAR.duracaoMs;
  // Causticar: −10% de resistências elementais; Enfraquecer (Fragilizar): +6% de chance de crítico contra; Exaurir (Exaurido): 10% menos dano.
  if (valor(ficha, 'bloqueio_causticar') > 0) { e.causticado = { ate, pct: AO_BLOQUEAR.causticar }; eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'causticado' }); }
  if (valor(ficha, 'bloqueio_enfraquecer') > 0) { e.fragilizado = { ate, pct: AO_BLOQUEAR.enfraquecer }; eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'fragilizado' }); }
  if (valor(ficha, 'bloqueio_exaurir') > 0) { e.exaurido = { ate, pct: AO_BLOQUEAR.exaurir }; eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'exaurido' }); }
  return eventos;
}

/** O que os estados do PoE no BICHO mudam no golpe dele: `{ danoFator, precisaoFator, criticoFator }` (Cego, Exaurido, Provocado). */
export function doBicho(bicho, agora, { contraOutro = false } = {}) {
  const e = bicho?.estados ?? {};
  let danoFator = 1;
  let precisaoFator = 1;
  let criticoFator = 1;
  if (ativo(e.exaurido, agora)) danoFator *= 1 - e.exaurido.pct / 100;
  if (contraOutro && ativo(e.provocado, agora)) danoFator *= 1 - NO_ACERTO.provocar.danoMenosPct / 100;
  if (ativo(e.cego, agora)) {
    precisaoFator *= 1 - NO_ACERTO.cegar.precisaoMenosPct / 100;
    criticoFator *= 1 - (e.cego.criticoMenosPct ?? 0) / 100;
    // "Inimigos Cegados por você têm Esconjuro": causam 10% menos dano.
    if (e.cego.esconjuro) danoFator *= 0.9;
  }
  if (ativo(e.debilitado, agora)) danoFator *= 0.9;
  return { danoFator, precisaoFator, criticoFator };
}
/** A resistência elemental a menos do bicho Causticado (pontos), e a chance de crítico a mais contra ele Fragilizado (pontos de %). */
export const causticado = (bicho, agora) => (ativo(bicho?.estados?.causticado, agora) ? bicho.estados.causticado.pct : 0);
/** O Equilíbrio Elemental no bicho: +25 nos elementos que o acertaram, −50 nos outros (0 sem ele ou fora dos elementais). */
export function equilibrio(bicho, agora, tipo) {
  const q = bicho?.estados?.equilibrio;
  if (!ativo(q, agora) || !['fire', 'ice', 'energy'].includes(tipo)) return 0;
  return q.atingidos.includes(tipo) ? 25 : -50;
}
export const fragilizado = (bicho, agora) => (ativo(bicho?.estados?.fragilizado, agora) ? bicho.estados.fragilizado.pct : 0);

// ---------------------------------------------------------------- o tique da caçada

/**
 * Um tique (a caçada chama, `ms` de tempo): a Fúria, o "movendo-se", a recuperação do dano sofrido (Recoup) e a regeneração do Escudo de
 * Energia ("N de Escudo de Energia Regenerado por segundo"). `ficha`: a do personagem.
 */
export function tique(estado, hunt, ficha, ms, agora = hunt?.clock ?? 0) {
  if (!ligado() || !hunt) return;
  tiqueDaFuria(hunt, agora);
  const pos = hunt.pos ? `${hunt.pos.x},${hunt.pos.y}` : null;
  if (pos && hunt.poeUltimaPos && pos !== hunt.poeUltimaPos) marcar(hunt, 'moveu', agora);
  hunt.poeUltimaPos = pos;
  if (hunt.recuperacoes?.length && (estado.hp ?? 0) > 0) {
    for (const r of hunt.recuperacoes) {
      const fim = Math.min(agora, r.ate);
      const de = r.ultimo ?? r.ate - RECUPERACAO_MS;
      const quanto = Math.max(0, fim - Math.max(de, agora - ms)) * r.porMs;
      r.ultimo = fim;
      r.resto = (r.resto ?? 0) + quanto;
      const inteiro = Math.floor(r.resto);
      if (inteiro > 0) {
        r.resto -= inteiro;
        if (r.recurso === 'hp') estado.hp = Math.min(estado.maxHp ?? 0, (estado.hp ?? 0) + inteiro);
        else estado.mana = Math.min(estado.maxMana ?? 0, (estado.mana ?? 0) + inteiro);
      }
    }
    hunt.recuperacoes = hunt.recuperacoes.filter((r) => r.ate > agora);
  }
  const esMax = Math.max(0, Math.round(ficha?.energyShield ?? 0));
  estado.esCheio = esMax > 0 && (estado.es ?? 0) >= esMax;
  estado.maxEsPoe = esMax;
  // A perda por segundo dos únicos ("Perde N de Vida por segundo", "Perde X% de Mana por Segundo", "se você foi Acertado Recentemente"…).
  const s = ms / 1000;
  const perde = (campo, max, quanto) => { if (quanto > 0 && (estado.hp ?? 0) > 0) estado[campo] = Math.max(campo === 'hp' ? 1 : 0, (estado[campo] ?? 0) - quanto * s); };
  perde('hp', estado.maxHp, valor(ficha, 'perde_vida_s') + ((estado.maxHp ?? 0) * valor(ficha, 'perde_vida_pct_s')) / 100);
  perde('mana', estado.maxMana, ((estado.maxMana ?? 0) * valor(ficha, 'perde_mana_pct_s')) / 100);
  perde('es', esMax, (esMax * valor(ficha, 'perde_es_pct_s')) / 100);
  const esRegen = valor(ficha, 'es_regen') + (esMax * valor(ficha, 'es_regen_pct')) / 100;
  if (esRegen > 0 && esMax > 0 && (estado.es ?? 0) < esMax) {
    hunt.poeEsResto = (hunt.poeEsResto ?? 0) + (esRegen * ms) / 1000;
    const inteiro = Math.floor(hunt.poeEsResto);
    if (inteiro > 0) {
      hunt.poeEsResto -= inteiro;
      estado.es = Math.min(esMax, (estado.es ?? 0) + inteiro);
    }
  }
}

/**
 * Os alvos dos projéteis a MAIS / da perfuração de um golpe de longe: os `n` bichos vivos mais perto do `alvo` (sem ele), a até `alcance`
 * casas do personagem.
 */
export function alvosDosProjeteisExtras(hunt, alvo, n, alcance) {
  if (!ligado() || !(n > 0) || !hunt?.pos || !alvo) return [];
  const d = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  return (hunt.monstros ?? [])
    .filter((m) => m !== alvo && m.hp > 0 && !m.dummy && d(hunt.pos, m) <= alcance)
    .sort((a, b) => d(alvo, a) - d(alvo, b))
    .slice(0, Math.floor(n));
}

/** A grade do andar de cada caçada (fora do estado salvo: a caçada registra a cada tique — `cacadas.tique`). */
const GRADES = new WeakMap();
export const definirGradeDoCombate = (hunt, fn) => { if (hunt) GRADES.set(hunt, fn); };

/**
 * O EMPURRÃO do PoE ("chance de Empurrar Inimigos ao acertar"): o bicho vai UMA casa para longe do personagem, se ela é andável e livre.
 * Devolve true se moveu.
 */
export function empurrar(hunt, bicho) {
  if (!hunt?.pos || !bicho || bicho.boss || bicho.dummy) return false;
  const dx = Math.sign(bicho.x - hunt.pos.x);
  const dy = Math.sign(bicho.y - hunt.pos.y);
  if (!dx && !dy) return false;
  const para = { x: bicho.x + dx, y: bicho.y + dy };
  const grade = GRADES.get(hunt)?.() ?? null;
  if (grade?.andavel && !grade.andavel.has(`${para.x},${para.y}`)) return false;
  if (hunt.monstros.some((m) => m !== bicho && m.hp > 0 && m.x === para.x && m.y === para.y)) return false;
  bicho.x = para.x;
  bicho.y = para.y;
  return true;
}


/** O Escudo de Energia que pode pagar o custo de uma habilidade cuja gema está na peça do `slot` ("Gaste Escudo de Energia antes da Mana…"). */
export function escudoParaOCusto(estado, slot, ficha) {
  // (+ a "Bateria Anciã": o escudo paga o custo de TODAS as habilidades.)
  const global = Number(ficha?.afPoe?.['keystone:bateriaAnciã']) > 0 || Number(ficha?.afPoe?.bateria_ancia) > 0;
  if (!ligado() || !(global || (slot && Number(estado?.equipment?.[slot]?.poe?.af?.custo_do_escudo_local) > 0))) return 0;
  return Math.max(0, Math.min(estado.es ?? 0, Math.round(ficha?.energyShield ?? 0)));
}

/**
 * Os projéteis a mais, a perfuração e a área a mais que as PEÇAS dão a uma gema (com as tags `tags`, encaixada na peça do `slot`):
 * `{ projeteis, perfurar, area }` (área em casas de raio: +1 a cada 25%, a fração como chance).
 */
export function alvosDasPecas(estado, ficha, entry, tags, slot, rng = Math.random) {
  if (!ligado() || !ficha?.afPoe) return null;
  const s = somaPorTags(ficha, tags);
  const base = (k) => (Number(ficha.afPoe[k]) || 0) + (s[k] ?? 0);
  const local = estado?.equipment?.[slot]?.poe?.af ?? {};
  const t = new Set(tags);
  const localPorTag = (stat) => Object.entries(local).reduce((n, [k, v]) => { const p = partir(k); return n + (p.stat === stat && typeof v === 'number' && p.conds.every((c) => t.has(c)) ? v : 0); }, 0);
  const projetil = t.has('projetil');
  const projeteis = projetil ? base('extra_projectiles') + (Number(local.extra_projectiles_local) || 0) : 0;
  const perfurar = projetil ? base('perfurar') : 0;
  const ricochetes = projetil || t.has('magia') ? base('ricochetes') : 0;
  const areaPct = t.has('area') ? base('area_inc') + localPorTag('area_inc_local') : 0;
  const casas = areaPct / 25;
  const area = Math.trunc(casas) + (rng() < Math.abs(casas % 1) ? Math.sign(casas) : 0);
  return { projeteis: Math.floor(projeteis), perfurar: Math.floor(perfurar), area, ricochetes: Math.floor(ricochetes) };
}

// ---------------------------------------------------------------- o que o personagem RECEBE

/** A ficha do personagem de cada caçada (fora do estado salvo: a caçada registra a cada tique). */
const FICHAS_DA_CACADA = new WeakMap();
export const definirFichaDaCacada = (hunt, fn) => { if (hunt) FICHAS_DA_CACADA.set(hunt, fn); };
export const fichaDa = (hunt) => FICHAS_DA_CACADA.get(hunt)?.() ?? null;

/** O controle do motor (`combate/controle.mjs`) → a afecção do PoE. */
const AFECCAO_DO_CONTROLE = { congelado: { nome: 'congelamento', elemental: true }, lento: { nome: 'resfriamento', elemental: true }, atordoado: { nome: 'atordoamento' } };

/**
 * O CONTROLE de um monstro no personagem (`Controle.tentar`), pelos mods do PoE: evitar (Congelamento, Resfriamento, Atordoamento, Afecções
 * Elementais), imunidade, a duração em você ("Duração do Congelamento em você reduzida", das Afecções), a "Recuperação de Atordoamentos"
 * (encurta o atordoamento) e o efeito do Resfriamento em você (a lentidão). `{ evitou, duracaoFator, pctFator, chanceFator }`.
 */
export function controleNoJogador(ficha, efeito, rng = Math.random, hunt = null) {
  const a = AFECCAO_DO_CONTROLE[efeito];
  if (!ligado() || !ficha?.afPoe || !a) return { evitou: false, duracaoFator: 1, pctFator: 1, chanceFator: 1 };
  const v = (k) => Number(ficha.afPoe[k]) || 0;
  // (+ a imunidade por tempo dos frascos: "Concede Imunidade a Congelamento por N segundos se usado enquanto Congelado".)
  const imunePorTempo = (hunt?.imunidadesPoe?.[a.nome] ?? 0) > (hunt?.clock ?? 0) || (efeito === 'lento' && (hunt?.imunidadesPoe?.lento ?? 0) > (hunt?.clock ?? 0));
  if (v(`imune_${a.nome}`) > 0 || imunePorTempo) return { evitou: true, duracaoFator: 0, pctFator: 0, chanceFator: 0 };
  const evitar = v(`evitar_${a.nome}`) + (a.elemental ? v('avoid_elem_ailments') : 0);
  if (evitar > 0 && rng() * 100 < evitar) return { evitou: true, duracaoFator: 0, pctFator: 0, chanceFator: 1 };
  let duracaoFator = Math.max(0.1, 1 + (v(`duracao_${a.nome}_propria`) + v('duracao_afeccoes_propria') + (a.elemental ? v('duracao_afeccoes_elementais_propria') : 0)) / 100);
  if (efeito === 'atordoado') duracaoFator /= Math.max(0.1, 1 + v('stun_recovery') / 100);
  const pctFator = efeito === 'lento' ? Math.max(0, 1 + v('efeito_resfriamento_proprio') / 100) : 1;
  // "Ponto de Atordoamento reduzido": mais fácil de ser atordoado.
  const chanceFator = efeito === 'atordoado' ? 1 / Math.max(0.1, 1 - v('ponto_atordoamento_proprio_red') / 100) : 1;
  return { evitou: false, duracaoFator, pctFator, chanceFator };
}

/**
 * O fator do dano de `elemento` que passa pelas resistências do personagem, com as CONVERSÕES do dano recebido ("X% do Dano de Fogo dos
 * Acertos recebido como Dano de Gelo": essa parte passa pela resistência a Gelo). `protecao`: a da ficha (%). Sem conversão: 1 − res.
 */
export function fatorDaResistenciaRecebida(ficha, elemento, protecao = ficha?.protection ?? {}) {
  const res = (el) => Math.min(100, protecao[el] ?? 0);
  if (!ligado() || !ficha?.afPoe || !['fire', 'ice', 'energy', 'physical', 'chaos'].includes(elemento)) return 1 - res(elemento) / 100;
  let resto = 1;
  let fator = 0;
  const v = (k) => Number(ficha.afPoe[k]) || 0;
  // (+ os "Elemental … sofrido como Físico/Caos" valem para cada elemento.)
  const elemental = ['fire', 'ice', 'energy'].includes(elemento);
  for (const outro of ['fire', 'ice', 'energy', 'physical', 'chaos']) {
    if (outro === elemento) continue;
    const pct = v(`recebe_${elemento}_como_${outro}`) + (elemental ? v(`recebe_elemental_como_${outro}`) : 0);
    const parte = Math.min(resto, pct / 100);
    if (parte > 0) { fator += parte * (1 - res(outro) / 100); resto -= parte; }
  }
  return (fator + resto * (1 - res(elemento) / 100)) * fatorDoDanoRecebido(ficha, elemento);
}
/** "Recebe X% de Dano Físico como Dano Extra de um Elemento aleatório": o dano EXTRA (já resistido) a partir do Físico bruto. */
export function extraDoFisicoRecebido(ficha, fisico, rng = Math.random) {
  const pct = ligado() ? Number(ficha?.afPoe?.fisico_recebido_como_elemento) || 0 : 0;
  if (!(pct > 0) || !(fisico > 0)) return 0;
  const el = ['fire', 'ice', 'energy'][Math.floor(rng() * 3)];
  return (fisico * pct) / 100 * fatorDaResistenciaRecebida(ficha, el);
}
/** O crítico do monstro no personagem: a chance × o Cego, e o dano extra × (1 − "Dano Extra recebido de Acertos Críticos reduzido"). */
export function criticoDoBicho(base, bicho, ficha, agora, rng = Math.random) {
  if (!ligado()) return null;
  const { criticoFator } = doBicho(bicho, agora);
  const red = Number(ficha?.afPoe?.crit_dmg_taken_red) || 0;
  if (criticoFator === 1 && !red) return null;
  if (!(base.chance > 0) || !(rng() < base.chance * criticoFator)) return { critico: false, fator: 1 };
  return { critico: true, fator: 1 + (base.fator - 1) * Math.max(0, 1 - red / 100) };
}

// ---------------------------------------------------------------- o dano RECEBIDO (os únicos)

/**
 * O fator do dano que o personagem RECEBE de um tipo (`physical`, `fire`, `ice`, `energy`, `chaos`) e de um golpe (ataque/magia):
 * "Dano recebido aumentado em X%", "Dano Físico/Elemental/de Fogo… recebido aumentado", "Dano Mágico sofrido aumentado", e os "X% menos
 * Dano sofrido" (multiplicam). As condições de estado já entraram na soma.
 */
export function fatorDoDanoRecebido(ficha, elemento, { magia = false } = {}) {
  if (!ligado() || !ficha?.afPoe) return 1;
  const v = (k) => Number(ficha.afPoe[k]) || 0;
  const elemental = ['fire', 'ice', 'energy'].includes(elemento);
  const inc = v('dano_recebido_inc') + v(`dano_${elemento}_recebido_inc`) + (elemental ? v('dano_elemental_recebido_inc') : 0) + (magia ? v('dano_magico_recebido_inc') : 0);
  // (O Físico do golpe corpo a corpo passa por aqui também: o "Dano Físico recebido aumentado".)
  return Math.max(0, (1 + inc / 100) * (1 + v('dano_recebido_mais') / 100));
}
/** O dano FIXO a menos (ou a mais) por golpe: "-25 de Dano Físico sofrido dos Acertos de Ataques", "+N de Dano de Fogo sofrido quando acertado". */
export function fixoRecebido(ficha, elemento, { ataque = false } = {}) {
  if (!ligado() || !ficha?.afPoe) return 0;
  const v = (k) => Number(ficha.afPoe[k]) || 0;
  return v(`${elemento}_sofrido_acerto`) + (ataque ? v(`${elemento}_sofrido_ataque`) : 0);
}
/** O Caos atravessa o Escudo de Energia (regra do PoE), a menos que um único diga que não. */
export const caosAtravessaOEscudo = (ficha) => ligado() && !((Number(ficha?.afPoe?.caos_nao_atravessa_escudo) || 0) > 0);

// ---------------------------------------------------------------- as PARTES do dano (conversões, ganhos extras, máscara)

const ELS = ['physical', 'fire', 'ice', 'energy', 'chaos'];
/**
 * As partes de dano de um golpe (`{ elemento: [min, max] }`) com os mods do PoE dos únicos: as CONVERSÕES entre elementos ("X% do Dano de
 * Fogo Convertido em Dano de Caos", "Todo o Dano Elemental é Convertido para Dano de Caos"), os GANHOS extras ("Ganha X% de Dano Elemental
 * como Dano Extra de Caos", "X% do Dano de Gelo como Fogo extra") e a MÁSCARA ("Não Causa Dano Elemental", "Causa Somente Dano de Raio").
 * O Físico da arma já passou pelas conversões dele (`extrasDoFisico`). Devolve outro objeto.
 */
export function transformarPartes(ficha, partes) {
  if (!ligado() || !ficha?.afPoe || !partes) return partes;
  const v = (k) => valor(ficha, k);
  const p = Object.fromEntries(ELS.map((el) => [el, [...(partes[el] ?? [0, 0])]]));
  const mover = (de, para, pct) => {
    const f = Math.max(0, Math.min(100, pct)) / 100;
    if (!f) return;
    for (const i of [0, 1]) { const x = p[de][i] * f; p[de][i] -= x; p[para][i] += x; }
  };
  for (const de of ['fire', 'ice', 'energy']) {
    mover(de, 'chaos', v(`conv_${de}_chaos`) + v('conv_elemental_chaos'));
    for (const para of ['fire', 'ice', 'energy']) if (para !== de) mover(de, para, v(`conv_${de}_${para}`));
  }
  const antes = Object.fromEntries(ELS.map((el) => [el, [...p[el]]]));
  for (const de of ['fire', 'ice', 'energy']) { ganharDe(antes, p, de, 'chaos', v('elem_as_extra_chaos')); for (const para of ['fire', 'ice', 'energy']) if (para !== de) ganharDe(antes, p, de, para, v(`${de}_as_extra_${para}`)); }
  for (const de of ['physical', 'fire', 'ice', 'energy']) ganharDe(antes, p, de, 'chaos', v('naocaos_as_extra_chaos'));
  // A máscara.
  const so = ELS.find((el) => v(`so_dano:${el}`) > 0);
  for (const el of ELS) {
    const sem = v(`sem_dano:${el}`) > 0 || (v('sem_dano:elemental') > 0 && ['fire', 'ice', 'energy'].includes(el)) || (v('sem_dano:naocaos') > 0 && el !== 'chaos') || (so && el !== so) || (v('sem_dano:naoelemental') > 0 && !['fire', 'ice', 'energy'].includes(el)) || (v('sem_dano:naofisico') > 0 && el !== 'physical');
    if (sem) p[el] = [0, 0];
  }
  return Object.fromEntries(Object.entries(p).filter(([, [a, b]]) => a > 0 || b > 0));
  function ganharDe(base, alvo, de, para, pct) { const f = pct / 100; if (f > 0) for (const i of [0, 1]) alvo[para][i] += base[de][i] * f; }
}
/** O Físico do golpe sai (a máscara) — "Não causa Dano Físico", "Causa Somente Dano de Raio"… */
export function semFisico(ficha) {
  if (!ligado() || !ficha?.afPoe) return false;
  const v = (k) => valor(ficha, k);
  const so = ELS.find((el) => v(`so_dano:${el}`) > 0);
  return v('sem_dano:physical') > 0 || v('sem_dano:naocaos') > 0 || v('sem_dano:naoelemental') > 0 || (so && so !== 'physical');
}

/**
 * O dano a MAIS que o bicho recebe pelos estados do PoE: Coberto em Cinzas (+20% de Fogo), Intimidado (+10% de dano de Ataque), Definhado
 * (+6% de Caos por acúmulo, até 15), Eletrizado já está em `Ficha.rolarCritico`. `ficha`: a do golpe (as tags dizem se é ataque).
 */
export function fatorRecebidoPeloBicho(alvo, tipo, ficha, agora) {
  const e = alvo?.estados;
  if (!ligado() || !e) return 1;
  let f = 1;
  if (tipo === 'fire' && ativo(e.cinzas, agora)) f *= 1.2;
  if (ativo(e.intimidado, agora) && (ficha?.tagsDoGolpe ?? []).includes('ataque')) f *= 1.1;
  if (tipo === 'chaos' && ativo(e.definhado, agora)) f *= 1 + 0.06 * Math.min(15, e.definhado.n ?? 1);
  return f;
}
/** A resistência a menos do bicho Exposto (−10% no elemento), além do Causticar. */
export const exposicao = (alvo, agora, tipo) => ((alvo?.estados?.exposicao?.[tipo] ?? 0) > agora ? 10 : 0);
