// O MERCENÁRIO COMPLETO do PoE (dono, 16/10 — a decisão de 15/10 "Mercenário completo"; P005, P057–P060 da auditoria da árvore). Como nos
// Mercenários de Trarthus (3.26): com o nó do Luminary "Você pode contratar um mercenário de forma permanente", abre a contratação — candidatos
// sorteados (arquétipo, nível e equipamento), pagos em OURO; até 3 contratados e um ao seu lado. O nível dele fica PRESO no da contratação (o
// PoE); ele equipa a peça com 70% do nível dela e só nos atributos do arquétipo (um atributo: as peças que o têm; dois: só as feitas deles;
// as armas do arquétipo); ÚNICOS só nos tipos de peça que os nós "Seu mercenário pode equipar … únicos" liberam. As peças que ele trouxe se
// perdem quando outra entra no lugar (o PoE: "não podem ser devolvidas ao Mercenário"); as que você der voltam para a sua mochila. As
// HABILIDADES são as gemas fixas do arquétipo, com os suportes (não se trocam, não custam mana). Morto, só volta pagando ouro (o PoE).
//
// Aqui: os dados (`estado.mercenarios` — JSON), os comandos da tela e a FICHA do mercenário (um estado à parte, com o nível, a classe do
// arquétipo e o equipamento dele, pela mesma `Ficha` do personagem). O combate (o lacaio que segue você e usa as gemas) é do `acoes.mjs`
// (`tiqueDoMercenario`).
import { readFileSync } from 'node:fs';
import { ITEM_CATALOG } from '../dados.mjs';
import * as Catalogo from './catalogo.mjs';
import { gerarPeca } from './gerar.mjs';
import * as Jogo from './jogo.mjs';
import * as GemasPoe from './gemas-poe.mjs';
import * as SuportesPoe from './suportes-poe.mjs';
import * as Gemas from '../skills/gemas.mjs';
import * as Ficha from '../ficha.mjs';
import * as Afixos from '../afixos.mjs';
import * as R from '../regras.mjs';
import * as Equipamento from '../itens/equipamento.mjs';
import * as Inventario from '../inventario.mjs';

/**
 * Os números do sistema. O PoE não publica o preço (na 3.26 era uma aposta de ouro): o jogo cobra por nível, como os outros preços dele (o
 * respec, 2000 por nó × nível) — dono decide os valores.
 */
export const CONFIG = Object.freeze({
  /** "um máximo de três Mercenários recrutados" (o PoE). */
  maximo: 3,
  candidatos: 3,
  /** Candidatos novos a cada hora (no PoE, um em cada área). */
  renovarMs: 60 * 60 * 1000,
  ouroPorNivelContratar: 1000,
  ouroPorNivelReviver: 250,
  /** "Podem equipar a peça se cumprirem 70% do requisito de nível dela" (o PoE). */
  fracaoDoNivel: 0.7,
});

/** Os 10 encaixes do mercenário (os do personagem, sem a mochila e a munição; `legs` é o cinto). */
export const SLOTS = ['weapon', 'shield', 'head', 'body', 'gloves', 'feet', 'legs', 'neck', 'ring', 'ring2'];
/** A classe de peça de cada encaixe (a arma e a mão secundária vêm do arquétipo). */
const CLASSE_DO_SLOT = { head: 'Helmets', body: 'Body_Armours', gloves: 'Gloves', feet: 'Boots', legs: 'Belts', neck: 'Amulets', ring: 'Rings', ring2: 'Rings' };
/** Os nós do Luminary que liberam os ÚNICOS em cada encaixe ("Seu mercenário pode equipar … únicos"). */
export const UNICOS_DO_SLOT = {
  neck: 'mercenario_equipa_amuleto', legs: 'mercenario_equipa_cinto', feet: 'mercenario_equipa_botas', gloves: 'mercenario_equipa_luvas',
  head: 'mercenario_equipa_elmo', ring: 'mercenario_equipa_anel', ring2: 'mercenario_equipa_anel', weapon: 'mercenario_equipa_armas', shield: 'mercenario_equipa_armas',
};

/**
 * Os ARQUÉTIPOS: a classe do PoE (os atributos de partida), os atributos das peças que ele usa, as armas, a mão secundária e as HABILIDADES — as
 * gemas fixas, cada uma com dois suportes (as que funcionam no jogo).
 */
export const ARQUETIPOS = Object.freeze({
  espadachim: { nome: 'Espadachim', classePoe: 'Duelist', vocacao: 'monk', atributos: ['str', 'dex'], armas: ['One_Hand_Swords', 'Thrusting_One_Hand_Swords', 'Two_Hand_Swords'], secundaria: 'Shields',
    habilidades: [{ gema: 'Double_Strike', suportes: ['Melee_Physical_Damage_Support', 'Faster_Attacks_Support'] }, { gema: 'Cleave', suportes: ['Melee_Physical_Damage_Support', 'Brutality_Support'] }] },
  barbaro: { nome: 'Bárbaro', classePoe: 'Marauder', vocacao: 'knight', atributos: ['str'], armas: ['Two_Hand_Maces', 'Two_Hand_Axes', 'One_Hand_Maces', 'One_Hand_Axes'], secundaria: 'Shields',
    habilidades: [{ gema: 'Ground_Slam', suportes: ['Melee_Physical_Damage_Support', 'Brutality_Support'] }, { gema: 'Molten_Strike', suportes: ['Elemental_Damage_with_Attacks_Support', 'Faster_Attacks_Support'] }] },
  arqueiro: { nome: 'Arqueiro', classePoe: 'Ranger', vocacao: 'paladin', atributos: ['dex'], armas: ['Bows'], secundaria: 'Quivers',
    habilidades: [{ gema: 'Split_Arrow', suportes: ['Vicious_Projectiles_Support', 'Faster_Attacks_Support'] }, { gema: 'Lightning_Arrow', suportes: ['Elemental_Damage_with_Attacks_Support', 'Faster_Attacks_Support'] }] },
  piromante: { nome: 'Piromante', classePoe: 'Witch', vocacao: 'sorcerer', atributos: ['int'], armas: ['Wands'], secundaria: 'Shields',
    habilidades: [{ gema: 'Fireball', suportes: ['Added_Fire_Damage_Support', 'Controlled_Destruction_Support'] }, { gema: 'Firestorm', suportes: ['Fire_Penetration_Support', 'Controlled_Destruction_Support'] }] },
  criomante: { nome: 'Criomante', classePoe: 'Witch', vocacao: 'sorcerer', atributos: ['int'], armas: ['Wands'], secundaria: 'Shields',
    habilidades: [{ gema: 'Frostbolt', suportes: ['Added_Cold_Damage_Support', 'Controlled_Destruction_Support'] }, { gema: 'Ice_Nova', suportes: ['Cold_Penetration_Support', 'Controlled_Destruction_Support'] }] },
  eletromante: { nome: 'Eletromante', classePoe: 'Templar', vocacao: 'druid', atributos: ['str', 'int'], armas: ['Sceptres', 'Staves'], secundaria: 'Shields',
    habilidades: [{ gema: 'Spark', suportes: ['Controlled_Destruction_Support', 'Faster_Casting_Support'] }, { gema: 'Arc', suportes: ['Controlled_Destruction_Support', 'Added_Lightning_Damage_Support'] }] },
});
const NOMES = ['Arvel', 'Brenna', 'Caius', 'Dara', 'Elric', 'Fenna', 'Gisla', 'Hakon', 'Iselda', 'Jorund', 'Kaira', 'Lothar', 'Mira', 'Nyle', 'Orla', 'Petra', 'Rurik', 'Sabine', 'Tavin', 'Ulla', 'Varek', 'Wren', 'Yorra', 'Zoltan'];

/**
 * O "pool" de atributos de cada base (o catálogo do PoE) que o arquétipo pode usar: com UM atributo, as peças que o têm (as dele e as híbridas
 * com ele); com dois, só as feitas deles (cada um e o par); com três, todas. As sem requisito (`*`) servem a todos.
 */
export function poolServe(pool, atributos) {
  if (!pool || pool === '*' || pool === 'null') return true;
  const da = String(pool).split('_');
  if (atributos.length >= 3) return true;
  if (atributos.length === 1) return da.includes(atributos[0]);
  return da.every((a) => atributos.includes(a));
}

// ---------------------------------------------------------------- os dados

/** A parte do estado (cria vazia). */
export function dados(estado) {
  const d = (estado.mercenarios ??= {});
  d.candidatos ??= [];
  d.contratados ??= [];
  if (d.ativo === undefined) d.ativo = null;
  return d;
}
export const liberado = (af) => Number(af?.mercenario) > 0;
/**
 * (dono, 16/10: "1ª contratação grátis") Na PRIMEIRA ENTRADA depois do Mercenário completo: cria a parte do estado; quem já tinha o nó do
 * mercenário (o Sangue Nobre — antes, o mercenário saía sozinho com ele) contrata o primeiro de graça. Quem pegar o nó depois paga desde o
 * primeiro. Devolve se criou.
 */
export function migrar(estado, afDoDono = {}) {
  if (!Catalogo.ligado() || estado.mercenarios) return false;
  dados(estado);
  if (liberado(afDoDono)) estado.mercenarios.primeiraGratis = true;
  return true;
}
/** O preço de contratar `c` agora (0 na primeira grátis). */
const precoDe = (estado, c) => (estado.mercenarios?.primeiraGratis ? 0 : custoDeContratar(c.nivel));
export const custoDeContratar = (nivel) => Math.round(CONFIG.ouroPorNivelContratar * Math.max(1, nivel));
export const custoDeReviver = (nivel) => Math.round(CONFIG.ouroPorNivelReviver * Math.max(1, nivel));
/** O mercenário ATIVO (o que segue você), ou null — vivo ou morto (quem chama confere). */
export function ativo(estado) {
  const d = estado?.mercenarios;
  return d?.ativo ? d.contratados?.find((m) => m.id === d.ativo) ?? null : null;
}

/** As gemas do poedb por nível ("RequerNível"): o nível da gema que o mercenário do nível `nivel` usa (até 20). */
let NIVEIS = null;
function tabelaDeNiveis() {
  if (!NIVEIS) {
    try { NIVEIS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/gemas-niveis-poedb.json', import.meta.url), 'utf8')).niveis ?? {}; } catch { NIVEIS = {}; }
  }
  return NIVEIS;
}
export function nivelDaGema(slug, nivel) {
  const t = tabelaDeNiveis()[slug];
  const col = t?.colunas?.indexOf('RequerNível') ?? -1;
  if (!t || col < 0) return Math.max(1, Math.min(20, Math.floor(nivel / 3.5)));
  let melhor = 1;
  for (const l of t.linhas ?? []) {
    const n = Number(l[0]);
    const req = Number(String(l[col]).replace(/\D/g, ''));
    if (n <= 20 && Number.isFinite(req) && req <= nivel) melhor = Math.max(melhor, n);
  }
  return melhor;
}

// ---------------------------------------------------------------- o sorteio

let seq = 0;
const novoId = () => `merc${Date.now().toString(36)}${(seq++).toString(36)}`;
const escolher = (lista, rng) => lista[Math.floor(rng() * lista.length) % lista.length];

/** As bases do catálogo de `classe` que o mercenário do `nivel` e dos `atributos` usa — as 3 de nível mais alto que ele já veste. */
function basesPara(classe, nivel, atributos) {
  const bases = Catalogo.catalogo()?.classes?.[classe]?.bases ?? [];
  return bases
    .filter((b) => (b.requisitos?.nivel ?? 0) <= nivel && poolServe(b.pool, atributos))
    .sort((a, b) => (b.requisitos?.nivel ?? 0) - (a.requisitos?.nivel ?? 0))
    .slice(0, 3);
}
function pecaSorteada(classe, nivel, atributos, rng) {
  const bases = basesPara(classe, nivel, atributos);
  if (!bases.length) return null;
  const base = escolher(bases, rng);
  const p = gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: base.id, raridade: rng() < 0.5 ? 'magico' : 'raro', ilvl: nivel, rng });
  if (!p || p.erro) return null;
  const item = Jogo.pecaDoJogo(p);
  return item?.id ? item : null;
}
/** Um CANDIDATO: o arquétipo, o nome, o nível (o seu agora) e o equipamento (mágico ou raro, das bases do nível dele). */
export function candidato(nivel, rng = Math.random) {
  const chave = escolher(Object.keys(ARQUETIPOS), rng);
  const a = ARQUETIPOS[chave];
  const equipment = {};
  const arma = pecaSorteada(escolher(a.armas, rng), nivel, a.atributos, rng);
  if (arma) equipment.weapon = arma;
  const duasMaos = !!ITEM_CATALOG[arma?.id]?.twoHanded;
  if (a.secundaria === 'Quivers' || !duasMaos) {
    const sec = pecaSorteada(a.secundaria, nivel, a.atributos, rng);
    if (sec) equipment.shield = sec;
  }
  for (const [slot, classe] of Object.entries(CLASSE_DO_SLOT)) {
    const p = pecaSorteada(classe, nivel, a.atributos, rng);
    if (p) equipment[slot] = p;
  }
  return { id: novoId(), nome: escolher(NOMES, rng), arquetipo: chave, nivel: Math.max(1, Math.round(nivel)), equipment, doJogador: {}, morto: false, v: 0 };
}
/** Os candidatos de agora: renova a cada hora (ou se faltam), no seu nível. */
export function candidatos(estado, agora = Date.now(), rng = Math.random) {
  const d = dados(estado);
  if (!d.candidatos.length || !(agora - (d.candidatosEm ?? 0) < CONFIG.renovarMs)) {
    d.candidatos = Array.from({ length: CONFIG.candidatos }, () => candidato(estado.level ?? 1, rng));
    d.candidatosEm = agora;
  }
  return d.candidatos;
}

// ---------------------------------------------------------------- a ficha

/**
 * O ESTADO do mercenário para a `Ficha` (o mesmo cálculo do personagem): o nível, a classe e a vocação do arquétipo, o equipamento dele e — como
 * uma peça a mais — o "aumentado" que os SEUS nós dão a ele ("Seu mercenário e os lacaios dele têm a vida máxima aumentada / causam dano
 * aumentado": somam com os das peças dele, como no PoE).
 */
export function estadoDoMercenario(merc, afDoDono = {}) {
  const a = ARQUETIPOS[merc.arquetipo] ?? ARQUETIPOS.espadachim;
  const base = R.statsBase(a.vocacao, merc.nivel);
  const doDono = { dmg_inc: Number(afDoDono.mercenario_dano_inc) || 0, life_inc: Number(afDoDono.mercenario_vida_inc) || 0 };
  const m = {
    sistema: 'poe', classePoe: a.classePoe, vocation: a.vocacao, level: merc.nivel, maxHp: base.maxHp, hp: base.maxHp, maxMana: base.maxMana, mana: base.maxMana,
    equipment: { ...merc.equipment, ...(doDono.dmg_inc || doDono.life_inc ? { doDono: { poe: { af: doDono } } } : {}) }, inventory: [],
  };
  Ficha.invalidar(m);
  Afixos.sincronizarMaximos(m);
  m.hp = m.maxHp;
  return m;
}
/** As HABILIDADES do mercenário: cada gema do arquétipo no nível que o nível dele permite, com os suportes (o mesmo nível). */
export function habilidades(merc) {
  const a = ARQUETIPOS[merc.arquetipo] ?? ARQUETIPOS.espadachim;
  return a.habilidades.map((h) => {
    const g = GemasPoe.doSlug(h.gema);
    if (!g) return null;
    const nivel = nivelDaGema(h.gema, merc.nivel);
    const suportes = h.suportes.filter((s) => SuportesPoe.doSlug(s)?.itemId).map((s) => ({ slug: s, itemId: SuportesPoe.doSlug(s).itemId, nivel: nivelDaGema(s, merc.nivel) }));
    return { gema: h.gema, acao: g.acao, itemId: g.itemId, nivel, suportes };
  }).filter(Boolean);
}
/** O mapa das gemas ativas do mercenário (o formato de `Gemas.skillsAtivas`) para o `efeitoNaSkill` — a gema e os suportes, sem encaixe. */
export function ativasDoMercenario(merc) {
  const mapa = new Map();
  for (const h of habilidades(merc)) {
    const def = Gemas.DEFS.get(h.itemId);
    if (!def) continue;
    const supports = h.suportes.map((s) => ({ def: Gemas.DEFS.get(s.itemId), nivel: s.nivel, raridade: 'comum', qualidade: 0 })).filter((s) => s.def);
    mapa.set(h.acao, { nivel: h.nivel, raridade: 'comum', qualidade: 0, def, supports, onde: null });
  }
  return mapa;
}
/** Quantos ÚNICOS o mercenário tem equipados (o "+8% mais Dano para cada item único equipado por ele"). */
export const unicosEquipados = (merc) => Object.values(merc?.equipment ?? {}).filter((p) => p?.poe?.raridade === 'unico').length;

// ---------------------------------------------------------------- os comandos

/** Paga `valor` do bolso e, se faltar, do banco (o mesmo do respec). Devolve o erro, ou null. */
function pagar(estado, valor) {
  const total = (estado.gold ?? 0) + (estado.bank ?? 0);
  if (total < valor) return `Faltam ${(valor - total).toLocaleString('pt-BR')} de ouro (bolso + banco).`;
  const doBolso = Math.min(estado.gold ?? 0, valor);
  estado.gold = (estado.gold ?? 0) - doBolso;
  estado.bank = (estado.bank ?? 0) - (valor - doBolso);
  return null;
}
const doContratado = (estado, id) => dados(estado).contratados.find((m) => m.id === id) ?? null;
const mudou = (merc) => { merc.v = (merc.v ?? 0) + 1; };

/** O que o mercenário pede para vestir `peca` (o `meta` do catálogo) — a frase do que falta, ou null. */
export function faltaParaVestir(merc, meta, peca, slot, afDoDono = {}) {
  const a = ARQUETIPOS[merc.arquetipo] ?? ARQUETIPOS.espadachim;
  const nivel = Math.ceil(Inventario.nivelExigido(meta, peca) * CONFIG.fracaoDoNivel);
  if (nivel > merc.nivel) return `${merc.nome} precisa do nível ${nivel} (70% do da peça) — está no ${merc.nivel}.`;
  const classe = peca?.poe?.classe ?? meta?.poe?.classe;
  const base = Catalogo.catalogo()?.classes?.[classe]?.bases?.find((b) => b.id === (peca?.poe?.base ?? meta?.poe?.base));
  if (base && !poolServe(base.pool, a.atributos)) return `${merc.nome} (${a.nome}) não usa peças desses atributos.`;
  if (slot === 'weapon' && !a.armas.includes(classe)) return `${merc.nome} (${a.nome}) não usa essa arma.`;
  if (slot === 'shield' && classe !== a.secundaria && !(a.armas.includes(classe) && !meta?.twoHanded)) return `${merc.nome} (${a.nome}) não usa isso na outra mão.`;
  if (peca?.poe?.raridade === 'unico' && !(Number(afDoDono[UNICOS_DO_SLOT[slot]]) > 0)) return 'O mercenário só equipa únicos nos tipos de peça que os nós do Luminary liberam.';
  return null;
}

/** Tira a peça do `slot` do mercenário: a SUA volta para a mochila; a que ele trouxe se perde (o PoE). */
function soltar(estado, merc, slot) {
  const p = merc.equipment[slot];
  if (!p) return;
  if (merc.doJogador?.[slot]) Inventario.darPeca(estado, p);
  delete merc.equipment[slot];
  delete merc.doJogador[slot];
}

/**
 * Os comandos da tela (`{ t: 'mercenario', action, ... }`): `contratar` (id do candidato), `levar` / `deixar`, `despedir`, `equipar` (o id do
 * mercenário, `item` e `pilha` da mochila, `slot` opcional), `tirar` (id, slot), `reviver`. `{ ok, notice? }` ou `{ ok: false, erro }`.
 */
export function comando(estado, m, afDoDono = Ficha.combate(estado).afPoe ?? {}, agora = Date.now()) {
  if (!Catalogo.ligado()) return { ok: false, erro: 'Os mercenários são do sistema do PoE.' };
  const d = dados(estado);
  const acao = m?.action;
  if (acao === 'contratar') {
    if (!liberado(afDoDono)) return { ok: false, erro: 'Contratar mercenários pede o nó "Você pode contratar um mercenário de forma permanente" (Luminary).' };
    if (d.contratados.length >= CONFIG.maximo) return { ok: false, erro: `Você já tem ${CONFIG.maximo} mercenários (o máximo): despeça um antes.` };
    const i = d.candidatos.findIndex((c) => c.id === m.id);
    if (i < 0) return { ok: false, erro: 'Esse candidato já não está disponível.' };
    const c = d.candidatos[i];
    const erro = pagar(estado, precoDe(estado, c));
    if (erro) return { ok: false, erro };
    delete d.primeiraGratis;
    d.candidatos.splice(i, 1);
    d.contratados.push(c);
    if (!d.ativo) d.ativo = c.id;
    return { ok: true, notice: `${c.nome} (${ARQUETIPOS[c.arquetipo]?.nome}, nível ${c.nivel}) foi contratado.` };
  }
  if (acao === 'deixar') { d.ativo = null; return { ok: true }; }
  const merc = doContratado(estado, m?.id);
  if (!merc) return { ok: false, erro: 'Esse mercenário não está com você.' };
  if (acao === 'levar') { d.ativo = merc.id; return { ok: true, notice: merc.morto ? `${merc.nome} está morto: reviva-o para ele lutar.` : null }; }
  if (acao === 'reviver') {
    if (!merc.morto) return { ok: false, erro: `${merc.nome} está vivo.` };
    const erro = pagar(estado, custoDeReviver(merc.nivel));
    if (erro) return { ok: false, erro };
    merc.morto = false;
    mudou(merc);
    return { ok: true, notice: `${merc.nome} voltou.` };
  }
  if (acao === 'despedir') {
    // As peças que você deu voltam todas para a mochila (antes, a conferência do espaço — nada se perde).
    const suas = SLOTS.filter((s) => merc.doJogador?.[s] && merc.equipment[s]);
    if (Inventario.pecasNaMochila(estado) + suas.length > Inventario.vagasDaMochila(estado)) return { ok: false, erro: `As ${suas.length} peças que você deu a ${merc.nome} não cabem na mochila.` };
    for (const s of suas) soltar(estado, merc, s);
    d.contratados = d.contratados.filter((x) => x !== merc);
    if (d.ativo === merc.id) d.ativo = null;
    return { ok: true, notice: `${merc.nome} foi embora.` };
  }
  if (acao === 'tirar') {
    const slot = String(m.slot ?? '');
    if (!merc.equipment[slot]) return { ok: false, erro: 'Não há nada aí.' };
    if (!merc.doJogador?.[slot]) return { ok: false, erro: 'Essa peça é dele: só sai quando outra entra no lugar.' };
    if (!Inventario.cabeNaMochila(estado, merc.equipment[slot].id, 1)) return { ok: false, erro: Inventario.erroDeEspaco(estado, merc.equipment[slot].id, 1) };
    soltar(estado, merc, slot);
    mudou(merc);
    return { ok: true };
  }
  if (acao === 'equipar') {
    const id = Number(m.item);
    const mochila = estado.inventory ?? [];
    let i = Number.isInteger(Number(m.pilha)) && mochila[Number(m.pilha)]?.id === id ? Number(m.pilha) : mochila.findIndex((p) => p?.id === id);
    if (i < 0) return { ok: false, erro: 'Essa peça não está na mochila.' };
    const peca = mochila[i];
    const meta = ITEM_CATALOG[id];
    if (!peca?.poe || !meta) return { ok: false, erro: 'O mercenário só equipa peças do PoE.' };
    const mEstado = { equipment: merc.equipment };
    const destino = m.slot && SLOTS.includes(m.slot) ? m.slot : Equipamento.slotDaArmaNoClique(mEstado, meta) ?? Equipamento.slotDoClique(mEstado, meta);
    if (!SLOTS.includes(destino)) return { ok: false, erro: Equipamento.ERRO_DE_SLOT };
    const valida = Equipamento.validarEquipar(mEstado, meta, destino, () => faltaParaVestir(merc, meta, peca, destino, afDoDono));
    if (!valida.ok) return valida;
    const outra = Equipamento.outraMaoQueSai({ equipment: { ...merc.equipment, [destino]: null } }, meta, destino);
    // (as SUAS peças que saem voltam para a mochila: a que sai da mochila abre uma vaga; a outra mão pode pedir mais uma)
    const voltam = [destino, outra].filter((s) => s && merc.doJogador?.[s] && merc.equipment[s]).length;
    if (Inventario.pecasNaMochila(estado) - 1 + voltam > Inventario.vagasDaMochila(estado)) return { ok: false, erro: 'Não há espaço na mochila para as peças que voltam.' };
    mochila.splice(i, 1);
    soltar(estado, merc, destino);
    if (outra) soltar(estado, merc, outra);
    merc.equipment[destino] = { ...peca, count: 1 };
    merc.doJogador[destino] = true;
    mudou(merc);
    return { ok: true };
  }
  return { ok: false, erro: 'Ação de mercenário desconhecida.' };
}

/** O mercenário ATIVO morreu (na caçada): só volta revivido por ouro (o PoE). */
export function morreu(estado, mercId) {
  const merc = doContratado(estado, mercId);
  if (merc && !merc.morto) { merc.morto = true; mudou(merc); }
}

/**
 * O que a TELA mostra (`{ t: 'mercenarios' }`): se a contratação está liberada, o ouro, os candidatos (com o preço) e os contratados (com o
 * preço de reviver), cada um com o equipamento (as peças inteiras, para o balão), quais são suas, e a ficha de combate — `fichaDe(merc)` dá
 * `{ vida, habilidades }` (o `Acoes.fichaDoMercenario`, que tem a conta das gemas).
 */
export function paraCliente(estado, afDoDono, fichaDe, agora = Date.now()) {
  const d = dados(estado);
  const lib = liberado(afDoDono);
  const resumo = (merc) => {
    const a = ARQUETIPOS[merc.arquetipo] ?? ARQUETIPOS.espadachim;
    let ficha = null;
    try { ficha = fichaDe(merc); } catch { ficha = null; }
    return {
      id: merc.id, nome: merc.nome, arquetipo: merc.arquetipo, arquetipoNome: a.nome, classePoe: a.classePoe, atributos: a.atributos, armas: a.armas, secundaria: a.secundaria,
      nivel: merc.nivel, morto: !!merc.morto, equipment: merc.equipment, doJogador: merc.doJogador ?? {}, ficha,
    };
  };
  return {
    t: 'mercenarios', liberado: lib, maximo: CONFIG.maximo, ativo: d.ativo ?? null, ouro: estado.gold ?? 0, banco: estado.bank ?? 0,
    candidatos: lib ? candidatos(estado, agora).map((c) => ({ ...resumo(c), custo: precoDe(estado, c) })) : [],
    primeiraGratis: !!d.primeiraGratis,
    renovaEm: lib ? (d.candidatosEm ?? agora) + CONFIG.renovarMs : null,
    contratados: d.contratados.map((m) => ({ ...resumo(m), custoReviver: custoDeReviver(m.nivel) })),
    unicosLiberados: SLOTS.filter((s) => Number(afDoDono?.[UNICOS_DO_SLOT[s]]) > 0),
    fracaoDoNivel: CONFIG.fracaoDoNivel,
  };
}
