// GEMAS DE SKILL, SUPPORTS e SOCKETS — o modelo Path of Exile (pedido do
// dono, 30/09): a skill vem da GEMA ATIVA encaixada num socket de uma peça
// VESTIDA; as SUPPORT GEMS ligadas a ela (sockets vizinhos com link) a
// modificam. Sem gema, sem skill (a Action Bar só mostra o que está encaixado).
//
// Configuração em `gamedata/gemas/` (config, supports, exceções por skill, ids
// estáveis). As "gemas" do Gem Atelier (`systems/gemas.mjs`) são outra coisa.
//
// Onde mora cada coisa (o personagem é um JSON — nada de tabela nova):
//   - a gema solta é um ITEM (id de `ids.json`, um por gema), com a instância
//     `gema: { nivel, xp }` — anda pela mochila, depósito, mercado como item;
//   - a peça ganha `soquetes: { abertos, links: [bool], gemas: [{id, nivel, xp} | null] }`;
//     o MÁXIMO sai do slot (config), para a regra poder mudar sem migrar.
//
// Quem valida é o servidor: encaixar/tirar, a XP, o nível, o efeito na skill.
import { readFileSync } from 'node:fs';
import { ITEM_CATALOG, ACTION_CATALOG, ACTION_CATALOG_ALTO, LEVELS_DAS_CAPTURAS } from '../dados.mjs';
import * as Tags from './tags.mjs';
import * as R from '../regras.mjs';

const ler = (f) => JSON.parse(readFileSync(new URL(`../../gamedata/gemas/${f}.json`, import.meta.url), 'utf8'));
export const CONFIG = ler('config');
export const SUPPORTS = ler('supports').supports;
const EXCECOES = ler('skills').gemas ?? {};
const IDS = ler('ids').ids;

/** As skills que viram gema: magias e runas (poções seguem itens — decisão do dono). */
const ACOES = new Map();
for (const c of [ACTION_CATALOG, ACTION_CATALOG_ALTO]) for (const e of [...(c?.spells ?? []), ...(c?.runes ?? [])]) if (!ACOES.has(e.id)) ACOES.set(e.id, e);
export const ehSkillDeGema = (entry) => entry?.kind === 'spell' || entry?.kind === 'rune';

/** O tempo de conjuração padrão de uma skill (ms), pelo tipo dela. */
function castTimePadrao(e) {
  const c = CONFIG.castTimePadrao;
  if (e.papeis?.[0] === 'attack') return e.kind === 'rune' ? c.runa : c.ataque;
  if (e.heals || e.papeis?.[0] === 'hp') return c.cura;
  return c.suporte;
}

// ---------------------------------------------------------------- definições

/** itemId → definição da gema. */
export const DEFS = new Map();
/** id da ação (magia/runa) → itemId da gema dela. */
export const ITEM_DA_ACAO = new Map();

/**
 * O bônus (em %) do TREINO na skill (decisão do dono, 30/09: o dano base escala
 * pelo level E pelo magic level — melee/distance nas skills físicas): magic
 * level × `porMagicLevel` nas mágicas e curas; nas físicas, skill × `porSkill`:
 * melee de perto, distance de longe (tag `ranged`). Treinado + bônus.
 */
export function bonusDoTreino(estado, def, ficha = null) {
  const D = CONFIG.dano;
  const bonus = ficha?.skillBonus ?? {};
  // Magia de dano físico (decisão do dono, 30/09): de perto, level + MELEE; de longe (tag `ranged`), level + DISTANCE.
  if ((def?.tags ?? []).includes('physical')) {
    const pericia = def.tags.includes('ranged') ? 'distance' : 'melee';
    return ((estado.skills?.[pericia]?.value ?? 0) + (bonus[pericia] ?? 0)) * D.porSkill;
  }
  return ((estado.magic?.value ?? 0) + (bonus.magic ?? 0)) * D.porMagicLevel;
}

const elementoDaSprite = (e) => (e?.heals ? 'healing' : e?.element === 'poison' ? 'earth' : e?.element);
for (const [chave, itemId] of Object.entries(IDS)) {
  if (chave.startsWith('support:')) {
    const id = chave.slice(8);
    const s = SUPPORTS[id];
    if (!s) continue;
    DEFS.set(itemId, { itemId, tipo: 'support', id, nome: s.nome, levelMinimo: s.levelMinimo ?? 1, suporte: s });
    continue;
  }
  const e = ACOES.get(chave);
  if (!e) continue;
  const exc = EXCECOES[chave] ?? {};
  DEFS.set(itemId, {
    itemId,
    tipo: 'ativa',
    id: chave,
    acao: chave,
    nome: e.name,
    tags: Tags.tagsDaAcao(e),
    classeRecomendada: Tags.classeRecomendada(e),
    // Nenhuma trava (decisão do dono): qualquer personagem usa qualquer gema, em qualquer nível.
    // `levelDaMagia`: o level da magia no catálogo — só para o preço na loja.
    levelMinimo: 1,
    levelDaMagia: Math.max(1, e.level ?? 1),
    castTime: exc.castTime ?? castTimePadrao(e),
    progressao: exc.progressao ?? CONFIG.progressaoPadrao,
    // O balanceamento do dano da skill (× no dano; `skills.json`).
    fatorDeDano: exc.fatorDeDano ?? 1,
  });
  ITEM_DA_ACAO.set(chave, itemId);
}

/*
 * As gemas no CATÁLOGO DE ITENS (o cliente desenha e o inventário guarda como
 * qualquer item): nome, a pedra do elemento como figura (`spriteDe`), leve,
 * não empilha (cada uma tem nível e XP).
 */
for (const def of DEFS.values()) {
  const e = def.acao ? ACOES.get(def.acao) : null;
  ITEM_CATALOG[def.itemId] ??= {
    id: def.itemId,
    name: `gema: ${def.nome.toLowerCase()}`,
    weight: 0.1,
    stackable: false,
    type: 'gema',
    rarity: 'comum', // a de verdade é da instância (`raridade`)
    hasSprite: true,
    spriteDe: CONFIG.sprites[def.tipo === 'support' ? 'support' : elementoDaSprite(e)] ?? CONFIG.sprites.outro,
    gemaDef: def.tipo === 'support'
      ? { tipo: 'support', id: def.id, nome: def.nome, requer: def.suporte.requer ?? [], algum: def.suporte.algum ?? [], exclui: def.suporte.exclui ?? [], efeito: def.suporte.efeito, porNivel: def.suporte.porNivel ?? {}, mult: CONFIG.raridades.multiplicador }
      : { tipo: 'ativa', acao: def.acao, nome: def.nome, tags: def.tags, classeRecomendada: def.classeRecomendada, levelMinimo: def.levelMinimo, castTime: def.castTime, progressao: def.progressao, mult: CONFIG.raridades.multiplicador, nivelMaximo: CONFIG.niveis.maximo },
    sell: 0,
  };
}

// A LAPIDADORA: a moeda que sobe a qualidade da gema (empilha; cai de bicho).
const Q = CONFIG.qualidade;
export const LAPIDADORA = Q.lapidadora.itemId;
ITEM_CATALOG[LAPIDADORA] ??= {
  id: LAPIDADORA,
  name: Q.lapidadora.nome,
  weight: 0.1,
  stackable: true,
  type: 'moeda',
  rarity: 'raro',
  hasSprite: true,
  spriteDe: Q.lapidadora.sprite,
  descricao: `Use numa gema de skill: +${Q.lapidadora.ganho[0]}% a +${Q.lapidadora.ganho[1]}% de qualidade (até ${Q.maximo}%).`,
  sell: 0,
};

export const defDaGema = (itemId) => DEFS.get(Number(itemId)) ?? null;
export const ehGema = (id) => DEFS.has(Number(id));

// ---------------------------------------------------------------- níveis e XP

const N = CONFIG.niveis;
/** A XP para sair do nível `nivel`: pelas faixas de `config.niveis` (fácil, normal, difícil). */
export function xpParaSubir(nivel) {
  const n = Math.max(1, Math.floor(nivel));
  const levelDe = (k) => 1 + (k - 1) * N.levelsPorNivel;
  // A exp que o personagem ganha do level do nível n ao do n+1, × a parte da faixa (fácil, normal, difícil).
  const doPersonagem = R.expForLevel(levelDe(n + 1)) - R.expForLevel(levelDe(n));
  const faixa = N.faixas.find((f) => n < f.ate) ?? N.faixas.at(-1);
  return Math.max(1, Math.round(doPersonagem * faixa.parteDaExpDoPersonagem));
}

// ---------------------------------------------------------------- raridade

const RAR = CONFIG.raridades;
/** A raridade válida (o que não for uma delas vira comum). */
export const raridadeDaGema = (r) => (RAR.ordem.includes(r) ? r : 'comum');
/** Quanto a raridade multiplica o bônus da gema (nível da ativa, efeito da support). */
export const multiplicadorDaRaridade = (r) => RAR.multiplicador[raridadeDaGema(r)] ?? 1;
/** Sorteia a raridade de uma gema que cai de bicho (`raridades.pesoNoDrop`). */
export function sortearRaridade(rng = Math.random) {
  const pesos = Object.entries(RAR.pesoNoDrop);
  let sorte = rng() * pesos.reduce((t, [, p]) => t + p, 0);
  for (const [r, p] of pesos) if ((sorte -= p) < 0) return r;
  return 'comum';
}

/** A qualidade válida (0..maximo, inteira). */
export const qualidadeDaGema = (q) => Math.max(0, Math.min(Q.maximo, Math.floor(Number(q) || 0)));

/** Uma gema nova (instância): `{ id, nivel, xp, raridade, qualidade }` — sempre no nível 1. */
export const novaGema = (itemId, raridade = 'comum', qualidade = 0) => ({ id: Number(itemId), nivel: 1, xp: 0, raridade: raridadeDaGema(raridade), qualidade: qualidadeDaGema(qualidade) });

/** O +N ao nível das gemas que a PEÇA dá (o add `gem_level`) — o que leva a gema além do 20. */
export const bonusDeNivelDaPeca = (peca) => (peca?.af ?? []).reduce((t, a) => t + (a.id === 'gem_level' ? Number(a.value) || 0 : 0), 0);

// ---------------------------------------------------------------- sockets

/** O máximo de sockets de uma peça (pelo slot do catálogo; 0 = não tem). */
export const maximoDeSockets = (meta) => CONFIG.sockets.maximo[meta?.slot] ?? 0;

/** Os sockets de uma peça, normalizados ao máximo do slot (sem gravar). */
export function soquetesDe(peca) {
  const max = maximoDeSockets(ITEM_CATALOG[peca?.id]);
  if (!max) return null;
  const s = peca.soquetes ?? {};
  const abertos = Math.max(0, Math.min(max, Math.floor(Number(s.abertos) || 0)));
  const links = Array.from({ length: max - 1 }, (_, i) => !!s.links?.[i]);
  const gemas = Array.from({ length: max }, (_, i) => (i < abertos && s.gemas?.[i] && DEFS.has(Number(s.gemas[i].id)) ? s.gemas[i] : null));
  return { max, abertos, links, gemas };
}

/** Sockets novos, todos abertos e ligados (as peças que já existiam — decisão do dono). */
export function soquetesAbertos(meta) {
  const max = maximoDeSockets(meta);
  return max ? { abertos: max, links: Array(max - 1).fill(true), gemas: Array(max).fill(null) } : null;
}

/**
 * Os sockets de uma peça que CAI (`raridade`, `rng`): quantos abertos pelo peso
 * da raridade (sem passar do máximo do slot) e os links entre vizinhos abertos.
 */
export function sortearSoquetes(meta, raridade, rng = Math.random) {
  const max = maximoDeSockets(meta);
  if (!max) return null;
  const regra = CONFIG.sockets.drop[raridade] ?? CONFIG.sockets.drop.comum;
  const pesos = Object.entries(regra.abertos).map(([n, p]) => [Math.min(max, Number(n)), p]);
  let r = rng() * pesos.reduce((a, [, p]) => a + p, 0);
  let abertos = pesos[pesos.length - 1][0];
  for (const [n, p] of pesos) if ((r -= p) < 0) { abertos = n; break; }
  const links = Array.from({ length: max - 1 }, (_, i) => i + 1 < abertos && rng() < regra.chanceDeLink);
  return { abertos, links, gemas: Array(max).fill(null) };
}

// Os grupos ligados e a compatibilidade por tag: a MESMA regra que a tela usa (engine/sockets-de-gema.mjs).
export { gruposLigados, grupoDoSocket, compativel } from '../../engine/sockets-de-gema.mjs';
import { gruposLigados, compativel } from '../../engine/sockets-de-gema.mjs';

const SLOTS_COM_SOCKET = Object.keys(CONFIG.sockets.maximo);

/**
 * As SKILLS que este personagem tem agora: cada gema ativa encaixada numa peça
 * VESTIDA, com as supports compatíveis do MESMO grupo ligado.
 * `Map(idDaAcao → { acao, itemId, nivel, xp, def, supports: [{ def, nivel }], onde: {slot, indice} })`.
 * A mesma skill em dois sockets: vale a de nível mais alto.
 */
export function skillsAtivas(estado) {
  const saida = new Map();
  for (const slot of SLOTS_COM_SOCKET) {
    const peca = estado?.equipment?.[slot];
    const s = peca && soquetesDe(peca);
    if (!s) continue;
    const bonus = bonusDeNivelDaPeca(peca);
    for (const grupo of gruposLigados(s)) {
      const noGrupo = grupo.map((i) => ({ i, g: s.gemas[i], def: s.gemas[i] && DEFS.get(Number(s.gemas[i].id)) })).filter((x) => x.def);
      const supports = noGrupo.filter((x) => x.def.tipo === 'support');
      for (const x of noGrupo.filter((y) => y.def.tipo === 'ativa')) {
        const anterior = saida.get(x.def.acao);
        if (anterior && anterior.nivel >= x.g.nivel + bonus) continue;
        saida.set(x.def.acao, {
          acao: x.def.acao,
          itemId: x.def.itemId,
          // O nível que VALE: o da gema + o bônus da peça (21+ só assim). `nivelBase`: o da gema.
          nivel: x.g.nivel + bonus,
          nivelBase: x.g.nivel,
          bonusDaPeca: bonus,
          xp: x.g.xp ?? 0,
          raridade: raridadeDaGema(x.g.raridade),
          qualidade: qualidadeDaGema(x.g.qualidade),
          def: x.def,
          supports: supports
            .filter((sp) => compativel(sp.def.suporte, x.def.tags))
            .map((sp) => ({ def: sp.def, nivel: sp.g.nivel + bonus, raridade: raridadeDaGema(sp.g.raridade), qualidade: qualidadeDaGema(sp.g.qualidade) })),
          onde: { slot, indice: x.i },
        });
      }
    }
  }
  return saida;
}

/** Esta skill (magia/runa) está disponível (a gema dela está encaixada numa peça vestida)? */
export const temSkill = (estado, acao) => skillsAtivas(estado).has(acao);

/**
 * O EFEITO combinado da gema numa skill — o nível (a progressão dela) e as
 * supports ligadas: `{ nivel, danoPct, curaPct, castTimePct, custoPct,
 * recargaPct, critChance, critDano, alvosExtras, danoDosExtrasPct, supports: [nomes] }`.
 * Sem a gema: null. É o que o `disparar` aplica — e o balão mostra.
 */
export function efeitoNaSkill(estado, acao, ativas = skillsAtivas(estado)) {
  const a = ativas.get(acao);
  if (!a) return null;
  const e = { nivel: a.nivel, danoPct: 0, curaPct: 0, castTimePct: 0, custoPct: 0, recargaPct: 0, critChance: 0, critDano: 0, alvosExtras: 0, danoDosExtrasPct: 0, supports: [] };
  // O NÍVEL da gema é um bônus a mais (o dano/cura base é o da magia, pelo level e o magic level):
  // `progressao` % por nível acima do 1, × a raridade da gema.
  const acima = (a.nivel - 1) * multiplicadorDaRaridade(a.raridade);
  e.danoPct += (a.def.progressao?.dano ?? 0) * acima;
  e.curaPct += (a.def.progressao?.cura ?? 0) * acima;
  // A qualidade: +danoPorPonto% por 1% (separada do nível e da raridade).
  if (a.def.progressao?.dano) e.danoPct += a.qualidade * Q.danoPorPonto;
  if (a.def.progressao?.cura) e.curaPct += a.qualidade * Q.danoPorPonto;
  e.raridade = a.raridade;
  e.qualidade = a.qualidade;
  e.fatorDeDano = a.def.fatorDeDano ?? 1;
  for (const sp of a.supports) {
    const s = sp.def.suporte;
    const mult = multiplicadorDaRaridade(sp.raridade) * (1 + (sp.qualidade * Q.efeitoPorPonto) / 100);
    for (const [k, v] of Object.entries(s.efeito ?? {})) e[k] = (e[k] ?? 0) + (v + (s.porNivel?.[k] ?? 0) * (sp.nivel - 1)) * mult;
    e.supports.push(sp.def.nome);
  }
  return e;
}

/** O tempo de conjuração (ms) desta skill agora: o da gema × supports ÷ Cast Speed. 0 = instantânea. */
export function tempoDeConjuracao(estado, acao, castSpeedPct = 0, ativas = skillsAtivas(estado)) {
  const a = ativas.get(acao);
  if (!a || !(a.def.castTime > 0)) return 0;
  const e = efeitoNaSkill(estado, acao, ativas);
  return Math.max(0, Math.round((a.def.castTime * (1 + (e.castTimePct ?? 0) / 100)) / (1 + (castSpeedPct ?? 0) / 100)));
}

// ---------------------------------------------------------------- XP

/**
 * A XP de uma morte para TODAS as gemas encaixadas nas peças vestidas: sobe de
 * nível enquanto houver XP, até o `maximo` (sem trava de level — decisão do dono).
 * Devolve `[{ nome, nivel }]` das que subiram (para avisar).
 */
export function ganharXp(estado, exp) {
  const ganho = Math.max(0, Math.round((Number(exp) || 0) * N.parteDaExp));
  if (!ganho) return [];
  const subiram = [];
  for (const slot of SLOTS_COM_SOCKET) {
    const peca = estado?.equipment?.[slot];
    const gemas = peca?.soquetes?.gemas;
    if (!gemas) continue;
    for (const g of gemas) {
      const def = g && DEFS.get(Number(g.id));
      // Por XP a gema para no `maximo` (30); acima, só o add de nível das peças.
      if (!def || g.nivel >= N.maximo) continue;
      g.xp = (g.xp ?? 0) + ganho;
      while (g.nivel < N.maximo && g.xp >= xpParaSubir(g.nivel)) {
        g.xp -= xpParaSubir(g.nivel);
        g.nivel++;
        subiram.push({ nome: def.nome, nivel: g.nivel });
      }
      g.xp = g.nivel >= N.maximo ? 0 : Math.min(g.xp, xpParaSubir(g.nivel));
    }
  }
  return subiram;
}

// ---------------------------------------------------------------- encaixar / tirar

const erro = (e) => ({ ok: false, erro: e });

/**
 * Encaixa a gema da MOCHILA (`de`: índice em `estado.inventory`) no socket
 * `indice` da peça vestida em `slot`. Socket fechado recusa; ocupado troca (a
 * que estava volta para a mochila).
 */
export function encaixar(estado, { de, slot, indice }) {
  const peca = estado.equipment?.[slot];
  if (!peca) return erro('Não há peça nesse slot.');
  const s = soquetesDe(peca);
  if (!s) return erro('Essa peça não tem sockets.');
  // Sem `indice` (a gema arrastada até a peça): o primeiro socket aberto e vazio.
  const i = indice == null ? s.gemas.findIndex((g, k) => !g && k < s.abertos) : Math.floor(Number(indice));
  if (indice == null && i < 0) return erro('Essa peça não tem socket livre.');
  if (!(i >= 0 && i < s.max)) return erro('Socket inexistente.');
  if (i >= s.abertos) return erro('Esse socket está bloqueado.');
  const inv = estado.inventory ?? [];
  const k = Math.floor(Number(de));
  const item = inv[k];
  if (!item || !ehGema(item.id)) return erro('Isso não é uma gema.');
  const nova = novaGemaDoItem(item);
  inv.splice(k, 1);
  const antiga = s.gemas[i];
  s.gemas[i] = nova;
  peca.soquetes = { abertos: s.abertos, links: s.links, gemas: s.gemas };
  if (antiga) inv.push(itemDaGema(antiga));
  return { ok: true };
}

/** Tira a gema do socket `indice` da peça vestida em `slot`, de volta para a mochila. */
export function tirar(estado, { slot, indice }) {
  const peca = estado.equipment?.[slot];
  const s = peca && soquetesDe(peca);
  if (!s) return erro('Essa peça não tem sockets.');
  const i = Math.floor(Number(indice));
  const g = s.gemas[i];
  if (!g) return erro('Não há gema nesse socket.');
  s.gemas[i] = null;
  peca.soquetes = { abertos: s.abertos, links: s.links, gemas: s.gemas };
  (estado.inventory ??= []).push(itemDaGema(g));
  return { ok: true };
}

/** A gema solta (item) ↔ a gema no socket. */
// A raridade mora na instância: `raridade` no item (é o que pinta o balão e a mochila) e na gema do socket.
export const novaGemaDoItem = (item) => ({
  id: Number(item.id),
  nivel: Math.max(1, Number(item.gema?.nivel) || 1),
  xp: Math.max(0, Number(item.gema?.xp) || 0),
  raridade: raridadeDaGema(item.raridade ?? item.gema?.raridade),
  qualidade: qualidadeDaGema(item.gema?.qualidade),
});
export const itemDaGema = (g) => ({ id: Number(g.id), count: 1, raridade: raridadeDaGema(g.raridade), gema: { nivel: g.nivel, xp: g.xp ?? 0, qualidade: qualidadeDaGema(g.qualidade) } });

/**
 * Usa uma LAPIDADORA da mochila numa gema: `{ de }` (índice da gema na mochila)
 * ou `{ slot, indice }` (a gema num socket da peça vestida). +ganho% (sorteio), até o máximo.
 */
export function lapidar(estado, { de, slot, indice }, rng = Math.random) {
  const inv = (estado.inventory ??= []);
  const k = inv.findIndex((p) => Number(p.id) === LAPIDADORA && (p.count ?? 1) > 0);
  if (k < 0) return erro('Você não tem Lapidadora.');
  let alvo = null;
  if (slot != null) {
    const s = soquetesDe(estado.equipment?.[slot]);
    alvo = s?.gemas[Math.floor(Number(indice))] ?? null;
    if (alvo) alvo.qualidade = qualidadeDaGema(alvo.qualidade);
  } else {
    const item = inv[Math.floor(Number(de))];
    if (item && ehGema(item.id)) alvo = (item.gema ??= { nivel: 1, xp: 0 });
  }
  if (!alvo) return erro('Escolha uma gema.');
  const antes = qualidadeDaGema(alvo.qualidade);
  if (antes >= Q.maximo) return erro(`Essa gema já está com ${Q.maximo}% de qualidade.`);
  const [lo, hi] = Q.lapidadora.ganho;
  alvo.qualidade = qualidadeDaGema(antes + lo + Math.floor(rng() * (hi - lo + 1)));
  if ((inv[k].count ?? 1) > 1) inv[k].count -= 1;
  else inv.splice(inv.indexOf(inv[k]), 1);
  return { ok: true, notice: `A gema foi lapidada: ${antes}% → ${alvo.qualidade}% de qualidade.` };
}

/** A Lapidadora que cai de um bicho (ou null): a chance do ato. */
export function sortearLapidadora({ ato = 1, fatorDeChance = 1 } = {}, rng = Math.random) {
  const c = Q.lapidadora.chancePorAto;
  return rng() < (c[String(ato)] ?? c['1'] ?? 0) * fatorDeChance ? { id: LAPIDADORA, count: 1 } : null;
}

// ---------------------------------------------------------------- migração

/*
 * ---- As skills que o personagem já usava viram gemas (decisão do dono) ----
 * Uma vez por personagem: cada magia/runa da barra dele vira a gema dela, no
 * nível que o level dele permite, encaixada nos sockets livres das peças
 * vestidas (arma, armadura, escudo, elmo, pernas, bota, anel, amuleto); a que
 * não couber vai para a mochila. As peças já ganharam todos os sockets abertos
 * e ligados (ver `itens/item.mjs`, versão 5).
 */
const ORDEM_DE_ENCAIXE = ['weapon', 'body', 'shield', 'head', 'legs', 'feet', 'ring', 'neck'];
export function migrarPersonagem(estado) {
  const acoes = [...new Set((estado.actions ?? []).map((a) => a?.id).filter((id) => ITEM_DA_ACAO.has(id)))];
  const jaTem = new Set();
  for (const slot of SLOTS_COM_SOCKET) for (const g of estado.equipment?.[slot]?.soquetes?.gemas ?? []) if (g) jaTem.add(Number(g.id));
  for (const it of estado.inventory ?? []) if (ehGema(it.id)) jaTem.add(Number(it.id));
  let criadas = 0;
  for (const acao of acoes) {
    const itemId = ITEM_DA_ACAO.get(acao);
    if (jaTem.has(itemId)) continue;
    // Sempre no nível 1 (decisão do dono) — o nível 1 é o dano de antes das gemas.
    const gema = novaGema(itemId);
    let encaixou = false;
    for (const slot of ORDEM_DE_ENCAIXE) {
      const peca = estado.equipment?.[slot];
      const s = peca && soquetesDe(peca);
      if (!s) continue;
      const livre = s.gemas.findIndex((g, i) => !g && i < s.abertos);
      if (livre < 0) continue;
      s.gemas[livre] = gema;
      peca.soquetes = { abertos: s.abertos, links: s.links, gemas: s.gemas };
      encaixou = true;
      break;
    }
    if (!encaixou) (estado.inventory ??= []).push(itemDaGema(gema));
    criadas++;
  }
  return criadas;
}

// ---------------------------------------------------------------- vista

/** Os sockets de uma peça para a tela: `{ max, abertos, links, gemas: [{ id, nome, tipo, nivel, xp, xpProximo } | null] }`. */
export function vistaDosSoquetes(peca) {
  const s = soquetesDe(peca);
  if (!s) return null;
  return {
    ...s,
    gemas: s.gemas.map((g) => {
      const def = g && DEFS.get(Number(g.id));
      return def ? { id: g.id, nome: def.nome, tipo: def.tipo, nivel: g.nivel, xp: g.xp ?? 0, xpProximo: g.nivel >= N.maximo ? 0 : xpParaSubir(g.nivel), raridade: raridadeDaGema(g.raridade) } : null;
    }),
  };
}

// ---------------------------------------------------------------- drop

/**
 * A gema que cai de um bicho (ou null): a chance do ato (`config.drop`); uma
 * fração vira support. A ativa sai entre as skills que um personagem no
 * gemas do jogo (sem trava de level — a gema cai no nível 1).
 */
export function sortearDrop({ ato = 1, levelDaFase = 1, fatorDeChance = 1 } = {}, rng = Math.random) {
  const d = CONFIG.drop;
  const chance = (d.chancePorAto[String(ato)] ?? d.chancePorAto['1'] ?? 0) * fatorDeChance;
  if (!(rng() < chance)) return null;
  const supports = [...DEFS.values()].filter((x) => x.tipo === 'support');
  const ativas = [...DEFS.values()].filter((x) => x.tipo === 'ativa' && x.levelMinimo <= Math.max(1, levelDaFase));
  const lista = rng() < d.parteSupport && supports.length ? supports : ativas.length ? ativas : supports;
  const def = lista[Math.floor(rng() * lista.length)];
  const [qlo, qhi] = Q.noDrop;
  return def ? itemDaGema(novaGema(def.itemId, sortearRaridade(rng), qlo + Math.floor(rng() * (qhi - qlo + 1)))) : null;
}

// ---------------------------------------------------------------- loja (Zuma Magehide)

/** O preço de uma gema na loja: ativa pelo level mínimo da skill; support, o preço fixo — × o fator da raridade. */
export const precoNaLoja = (def, raridade = 'comum') =>
  (def.tipo === 'support' ? CONFIG.loja.precoDoSupport : CONFIG.loja.precoBase + CONFIG.loja.precoPorLevel * (def.levelDaMagia ?? 1)) * (CONFIG.loja.precoPorRaridade?.[raridade] ?? 1);

/** As raridades que a loja vende (decisão do dono, 30/09: todas as gemas, só na comum — as outras caem de bicho). */
export const RARIDADES_DA_LOJA = CONFIG.loja.raridades ?? ['comum'];

/**
 * A lista da loja (o formato do balcão de NPC do cliente — `npcFala`, `tipo: 'loja'`):
 * a gema de cada skill (pelo level) e os supports, no nível 1, em cada raridade da loja.
 * `chave` distingue as linhas do mesmo item (a raridade); `id` é o item (a figura).
 */
export function catalogoDaLoja(estado) {
  const tenho = (id, r) => (estado.inventory ?? []).filter((p) => Number(p.id) === id && raridadeDaGema(p.raridade) === r).length;
  const defs = [...DEFS.values()].sort((a, b) => (a.tipo === b.tipo ? a.nome.localeCompare(b.nome) : a.tipo === 'ativa' ? -1 : 1));
  return defs.flatMap((def) =>
    RARIDADES_DA_LOJA.map((r) => ({
      id: def.itemId,
      chave: `${def.itemId}:${r}`,
      raridade: r,
      nome: `Gema: ${def.nome} (${r})${def.tipo === 'support' ? ' · support' : ''}`,
      buy: precoNaLoja(def, r),
      tenho: tenho(def.itemId, r),
    }))
  );
}

/** Comprar `count` gemas (nível 1, na `raridade` pedida) na loja: paga do bolso e depois do banco; vão para a mochila. */
export function comprarNaLoja(estado, { id, count = 1, raridade = 'comum' }) {
  const def = DEFS.get(Number(id));
  if (!def) return { ok: false, erro: 'Ela não vende isso.' };
  if (!RARIDADES_DA_LOJA.includes(raridade)) return { ok: false, erro: 'Ela só vende gemas comuns. As de outras raridades caem dos bichos.' };
  const n = Math.max(1, Math.min(CONFIG.loja.porVez ?? 20, Math.floor(Number(count) || 1)));
  const total = precoNaLoja(def, raridade) * n;
  if ((estado.gold ?? 0) + (estado.bank ?? 0) < total) return { ok: false, erro: 'Ouro insuficiente (bolso + banco).' };
  const doBolso = Math.min(estado.gold ?? 0, total);
  estado.gold = (estado.gold ?? 0) - doBolso;
  estado.bank = (estado.bank ?? 0) - (total - doBolso);
  for (let i = 0; i < n; i++) (estado.inventory ??= []).push(itemDaGema(novaGema(def.itemId, raridade)));
  return { ok: true, notice: `Você comprou ${n}× gema de ${def.nome} (${raridade}).` };
}
