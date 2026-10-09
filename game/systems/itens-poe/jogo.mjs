// O sistema de itens do PoE DENTRO do jogo local (Fase 1, incremento 3c — só com ITENS_POE=1; em produção nunca liga).
//
//   1. `iniciar(ITEM_CATALOG)`: as bases do PoE entram no catálogo como itens VIRTUAIS (ids a partir de 7.000.000), com slot, perícia
//      e duas mãos — o catálogo inteiro já vai ao cliente no `welcome`, então inventário, equipamento e balão as conhecem sem rota nova.
//   2. `pecaDoJogo(peca)`: a peça gerada (gerar.mjs) vira peça do jogo — a BASE em `peca.base` (dano da arma, armadura, evasão, escudo
//      de energia, que a ficha já lê por peça) e o resto em `peca.poe` (raridade, mods, nome, ícone e o `af` traduzido, que
//      `Afixos.somaDeItens` soma). Os valores entram como estão (decisão do dono, 04/10).
//   3. `entregar(nome, peca)`: dá a peça a um personagem ONLINE (a engine local usa para testar jogando).
// Classes sem slot no Draevor (frascos, joias, talismãs, varas de pesca) não entram — ficam listadas em `naoEquipaveis`.
import * as Catalogo from './catalogo.mjs';
import { definirLeitorDeBase } from './condicoes-poe.mjs';
import { traduzirPeca } from './traduzir.mjs';
import { gerarPeca } from './gerar.mjs';
import { darPeca } from '../inventario.mjs';
import * as DropsPorMonstro from './drops-por-monstro.mjs';
import * as SocketsPoe from './sockets.mjs';
import * as Frascos from './frascos.mjs';

export const PRIMEIRO_ID = 7_000_000;

/**
 * Classe do PoE → como o Draevor equipa. CINTOS vão no slot de PERNAS e as LUVAS ganham o slot próprio `gloves` (decisões do dono, 05/10).
 * Arco e varinha: arma de distância SEM munição (como a lança/estrela do Draevor). Aljava: o "shield" com `quiver`, como a do Draevor.
 */
// `peso`: o PESO da peça em oz, a mediana dos itens do Draevor do mesmo slot/tipo (antes era 50 para tudo — um anel do PoE pesava mais que uma
// maça, e poucas peças estouravam a capacidade: o excesso ia para o Depósito e a peça "sumia" da mochila).
export const CLASSES_DO_JOGO = {
  Body_Armours: { slot: 'body', tipo: 'armors', peso: 71 },
  Helmets: { slot: 'head', tipo: 'helmets', peso: 21 },
  Boots: { slot: 'feet', tipo: 'boots', peso: 13 },
  Gloves: { slot: 'gloves', tipo: 'gloves', peso: 13 },
  Belts: { slot: 'legs', tipo: 'legs', peso: 18 },
  Shields: { slot: 'shield', tipo: 'shields', peso: 41 },
  Quivers: { slot: 'shield', tipo: 'quivers', quiver: true, peso: 18 },
  Rings: { slot: 'ring', tipo: 'rings', peso: 0.9 },
  Amulets: { slot: 'neck', tipo: 'amulets', peso: 5 },
  One_Hand_Swords: { slot: 'weapon', tipo: 'sword weapons', skill: 'sword', peso: 50 },
  Thrusting_One_Hand_Swords: { slot: 'weapon', tipo: 'sword weapons', skill: 'sword', peso: 40 },
  Two_Hand_Swords: { slot: 'weapon', tipo: 'sword weapons', skill: 'sword', twoHanded: true, peso: 81 },
  One_Hand_Axes: { slot: 'weapon', tipo: 'axe weapons', skill: 'axe', peso: 61 },
  Two_Hand_Axes: { slot: 'weapon', tipo: 'axe weapons', skill: 'axe', twoHanded: true, peso: 72 },
  One_Hand_Maces: { slot: 'weapon', tipo: 'club weapons', skill: 'club', peso: 65 },
  Two_Hand_Maces: { slot: 'weapon', tipo: 'club weapons', skill: 'club', twoHanded: true, peso: 85 },
  Sceptres: { slot: 'weapon', tipo: 'club weapons', skill: 'club', peso: 27 },
  Staves: { slot: 'weapon', tipo: 'club weapons', skill: 'club', twoHanded: true, peso: 47 },
  Warstaves: { slot: 'weapon', tipo: 'club weapons', skill: 'club', twoHanded: true, peso: 69 },
  Claws: { slot: 'weapon', tipo: 'sword weapons', skill: 'sword', peso: 30 },
  Daggers: { slot: 'weapon', tipo: 'sword weapons', skill: 'sword', peso: 20 },
  Rune_Daggers: { slot: 'weapon', tipo: 'sword weapons', skill: 'sword', peso: 20 },
  // Arcos e Varinhas: 12 m no PoE (o limite padrão dos projéteis) — o mesmo alcance em casas para os dois. A varinha atira um projétil
  // MÁGICO (dono, 07/10: "o efeito do ataque básico da varinha está como flecha"), não flecha.
  Bows: { slot: 'weapon', tipo: 'distance weapons', skill: 'distance', twoHanded: true, range: 6, alcanceMetros: 12, peso: 47 },
  Wands: { slot: 'weapon', tipo: 'distance weapons', skill: 'distance', range: 6, alcanceMetros: 12, shoot: 'energy', peso: 27 },
};

const REG = { porBase: new Map(), porId: new Map(), naoEquipaveis: [] };
/** As classes de frasco que entram no jogo (o cinto de frascos — `itens-poe/frascos.mjs`). As Tinturas ainda não. */
export const FRASCOS = ['Life_Flasks', 'Mana_Flasks', 'Utility_Flasks'];
export const registro = () => REG;
/** O id virtual da base (`Classe/Slug`), ou null. */
export const idDaBase = (base) => REG.porBase.get(base) ?? null;
/** A base (`Classe/Slug`) de um id virtual do PoE, ou null. */
export const baseDoId = (id) => REG.porId.get(Number(id)) ?? null;

const media = (v) => (v && typeof v === 'object' ? Math.round((v.min + v.max) / 2) : Number(v) || 0);
/** `{ requisitos: { str, dex, int } }` só com o que a base pede (vazio se não pede atributo). */
const requisitosDaBase = (b) => {
  const r = b.requisitos ?? {};
  const pede = Object.fromEntries([['str', r.forca], ['dex', r.destreza], ['int', r.inteligencia]].filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]));
  return Object.keys(pede).length ? { requisitos: pede } : {};
};

/** Registra as bases equipáveis do catálogo do PoE em `ITEM_CATALOG` (uma vez). Devolve o registro. Sem o sistema ligado, não faz nada. */
export function iniciar(itemCatalog) {
  const cat = Catalogo.catalogo();
  if (!cat || REG.porBase.size) return REG;
  REG.catalogo = itemCatalog;
  let n = PRIMEIRO_ID;
  for (const c of Object.values(cat.classes).sort((a, b) => a.id.localeCompare(b.id))) {
    const regra = CLASSES_DO_JOGO[c.id];
    if (!regra) {
      REG.naoEquipaveis.push(c.id);
      continue;
    }
    for (const b of c.bases) {
      const id = n++;
      const a = b.atributos ?? {};
      itemCatalog[id] = {
        id, name: b.nome, type: regra.tipo, slot: regra.slot, weight: regra.peso ?? 20, hasSprite: false, rarity: 'comum', stackable: false,
        ...(b.requisitos?.nivel ? { minLevel: b.requisitos.nivel } : {}),
        ...(regra.skill ? { skill: regra.skill, attack: media(a.dano_fisico) } : {}),
        // Os ATAQUES POR SEGUNDO da base (1,55 na Rusted Sword) no campo que a conta da arma lê (`engine/arma.baseDaArma`): o intervalo BASE do golpe
        // básico e das habilidades de ataque é 1000 / APS, como no PoE. Sem ele valia o padrão do Draevor (0,5 = 2 s) para toda arma do PoE.
        ...(regra.skill && Number(a.ataques_por_segundo) > 0 ? { aps: Number(a.ataques_por_segundo) } : {}),
        // A chance de crítico da BASE da arma (ex.: 5%) no campo que a ficha já soma por peça (`critChance`, em centésimos de %); o
        // "Chance de Crítico aumentada" dos mods multiplica por cima (ficha.critChance), como no PoE.
        ...(regra.skill && a.chance_critico_pct ? { critChance: Math.round(Number(a.chance_critico_pct) * 100) } : {}),
        ...(regra.twoHanded ? { twoHanded: true } : {}),
        ...(regra.range ? { range: regra.range } : {}),
        ...(regra.shoot ? { shoot: regra.shoot } : {}),
        ...(regra.quiver ? { quiver: true } : {}),
        ...(a.armadura ? { armor: media(a.armadura) } : {}),
        // Marca de item do PoE: o cliente desenha o ícone da coleção e o balão próprio; o servidor acha a base.
        // Os requisitos de atributo da base, como no PoE (todos valem: `personagem/requisitos.falta`, incremento 4d).
        poe: { base: b.id, classe: c.id, icone: b.icone ?? null, ...requisitosDaBase(b) },
      };
      REG.porBase.set(b.id, id);
      REG.porId.set(id, b.id);
    }
  }
  // Os FRASCOS (Vida, Mana, Utilidade — `itens-poe/frascos.mjs`): itens sem slot de equipamento, que vão para o CINTO de frascos. Entram
  // DEPOIS das bases equipáveis, para os ids das peças que já existiam não mudarem. Os "Royale" (do modo Battle Royale do PoE) ficam de fora.
  for (const classe of FRASCOS) {
    const c = cat.classes[classe];
    if (!c) continue;
    REG.naoEquipaveis.splice(REG.naoEquipaveis.indexOf(classe) >>> 0, REG.naoEquipaveis.includes(classe) ? 1 : 0);
    for (const b of c.bases) {
      if (b.slug?.startsWith('Royale_')) continue;
      const id = n++;
      itemCatalog[id] = {
        id, name: b.nome, type: 'flasks', weight: 3, hasSprite: false, rarity: 'comum', stackable: false, frasco: true,
        ...(b.requisitos?.nivel ? { minLevel: b.requisitos.nivel } : {}),
        poe: { base: b.id, classe: c.id, icone: b.icone ?? null },
      };
      REG.porBase.set(b.id, id);
      REG.porId.set(id, b.id);
    }
  }
  // Os itens de missão (Acts do PoE: o item que o monstro alvo solta) entram junto.
  DropsPorMonstro.registrarItens(itemCatalog);
  return REG;
}

/** O que a BASE dá como atributo do Draevor (o bloqueio do escudo, a velocidade de movimento), somado ao `af` dos mods. */
function afDaBase(atributos, dosMods = {}) {
  const af = {};
  // (O "Chance de Bloquear aumentada em X%" do escudo é LOCAL no PoE: aumenta o bloqueio da própria base.)
  if (atributos?.chance_bloqueio_pct) af.block = Number(atributos.chance_bloqueio_pct) * (1 + (Number(dosMods.block_inc) || 0) / 100);
  if (atributos?.velocidade_movimento_pct) af.move_speed = Number(atributos.velocidade_movimento_pct);
  return af;
}

/*
 * A VELOCIDADE DE ATAQUE LOCAL da arma (PoE): na ARMA, "Velocidade de Ataque aumentada/reduzida em X%" sem condição é LOCAL — multiplica os
 * Ataques por Segundo da própria arma (1,55 × 1,10 = 1,71), em vez de somar aos aumentos globais. Sai de `atk_speed` (global) para
 * `atk_speed_local`, que a ficha aplica na base da arma (`ArmaMod.statsDaArma`). Com condição ("se você Matou Recentemente", "com Espadas") e a
 * "Velocidade de Ataque e Conjuração" seguem globais, como no PoE. A linha só de velocidade local fica 'equivalente' (a mesma conta do PoE).
 */
const VELOCIDADE_LOCAL = /^Velocidade de Ataque (?:aumentada|reduzida) em \{\d+\}%$/;
function separarVelocidadeLocal(classe, t, af) {
  if (CLASSES_DO_JOGO[classe]?.slot !== 'weapon') return;
  let local = 0;
  for (const l of t.linhas) {
    const locais = l.partes.filter((p) => VELOCIDADE_LOCAL.test(p.parte) && p.efeitos.length === 1 && p.efeitos[0].stat === 'atk_speed');
    for (const p of locais) local += p.efeitos[0].valor;
    if (locais.length && locais.length === l.partes.length) l.estado = 'equivalente';
  }
  if (!local) return;
  const global = Math.round(((af.atk_speed ?? 0) - local) * 100) / 100;
  if (global) af.atk_speed = global;
  else delete af.atk_speed;
  af.atk_speed_local = Math.round(((af.atk_speed_local ?? 0) + local) * 100) / 100;
}

/**
 * A peça do JOGO a partir da peça gerada (`gerarPeca`). `{ id, count: 1, base, poe }` — sem `raridade`/`af` do Draevor (a peça do PoE
 * não passa pelas regras de raridade e de afixos do Draevor: forja, essência e o resto não a reconhecem).
 */
export function pecaDoJogo(gerada, regras = Catalogo.REGRAS, rng = Math.random) {
  if (!gerada || gerada.erro) return null;
  const id = idDaBase(gerada.base);
  if (!id) return null;
  // O alcance da base em metros (o PoE traz nas armas corpo a corpo: 1 a 1,4 m); arco e varinha: 12 m.
  const alcanceMetros = CLASSES_DO_JOGO[gerada.classe]?.alcanceMetros;
  if (alcanceMetros && gerada.atributos && gerada.atributos.alcance_metros == null) gerada.atributos = { ...gerada.atributos, alcance_metros: alcanceMetros };
  const a = gerada.atributos ?? {};
  const t = traduzirPeca(gerada);
  const af = { ...t.af };
  // ("Sem Dano Físico": a arma única não tem o dano físico da base.)
  const base = {
    ...(a.dano_fisico && typeof a.dano_fisico === 'object' ? { attack: af.arma_sem_fisico > 0 ? [0, 0] : [a.dano_fisico.min, a.dano_fisico.max] } : {}),
    ...(a.armadura ? { armor: [a.armadura, a.armadura] } : {}),
    ...(a.evasao ? { evasion: [a.evasao, a.evasao] } : {}),
    ...(a.escudo_energia ? { es: [a.escudo_energia, a.escudo_energia] } : {}),
  };
  for (const [k, v] of Object.entries(afDaBase(a, af))) af[k] = (af[k] ?? 0) + v;
  separarVelocidadeLocal(gerada.classe, t, af);
  const R = regras.raridades[gerada.raridade] ?? {};
  // Frasco: não dá atributo ao personagem (só enquanto o efeito dura, pelo cinto — `frascos.mjs`); o balão leva o resumo com os mods aplicados.
  if (FRASCOS.includes(gerada.classe)) {
    const poe = { base: gerada.base, classe: gerada.classe, raridade: gerada.raridade, raridadeNome: R.nome ?? gerada.raridade, cor: R.cor ?? null, ilvl: gerada.ilvl, nome: gerada.nome, ...(gerada.unico ? { unico: gerada.unico } : {}),
      atributos: a, implicitos: gerada.implicitos ?? [], prefixos: gerada.prefixos ?? [], sufixos: gerada.sufixos ?? [], modificadores: gerada.modificadores ?? [] };
    const par = Frascos.parametros({ poe });
    return { id, count: 1, poe: { ...poe, estados: par.estadosPorMod, af: {}, frasco: Frascos.resumo({ poe }), tv: VERSAO_DA_TRADUCAO } };
  }
  // Os sockets (regra do dono: pela classe e pelo item level, quantidade e links ao acaso — `itens-poe/sockets.mjs`).
  // As cores pesam pelo requisito de atributo da base (`ITEM_CATALOG[id].poe.requisitos`).
  // "Possui N Encaixes" (o implícito de algumas bases: anel/amuleto/cinto Desmontado, aljava Ornamentada): o número de sockets é esse.
  const fixos = Math.round(Number(af.encaixes_fixos) || 0);
  const sorteados = af.sem_encaixes ? null : fixos > 0 ? { abertos: fixos, links: Array.from({ length: fixos - 1 }, () => false), gemas: Array(fixos).fill(null), cores: SocketsPoe.sortearCores(fixos, REG.catalogo?.[id]?.poe?.requisitos ?? null, rng) } : SocketsPoe.sortear(gerada.classe, gerada.ilvl, rng, REG.catalogo?.[id]?.poe?.requisitos ?? null);
  // "Somente Encaixes Brancos": todas as cores brancas (aceitam qualquer gema).
  // "[Six Linked]" / "local six linked sockets": o máximo da classe, todos ligados.
  const maxDaClasse = SocketsPoe.maximo(gerada.classe, gerada.ilvl) || 6;
  const ligados = af.encaixes_ligados > 0 ? { abertos: maxDaClasse, links: Array.from({ length: maxDaClasse - 1 }, () => true), gemas: Array(maxDaClasse).fill(null), cores: SocketsPoe.sortearCores(maxDaClasse, REG.catalogo?.[id]?.poe?.requisitos ?? null, rng) } : sorteados;
  const soquetes = ligados && af.encaixes_brancos ? { ...ligados, cores: ligados.cores.map(() => 'W') } : ligados;
  return {
    id, count: 1,
    ...(Object.keys(base).length ? { base } : {}),
    ...(soquetes ? { soquetes } : {}),
    poe: {
      base: gerada.base, classe: gerada.classe, raridade: gerada.raridade, raridadeNome: R.nome ?? gerada.raridade, cor: R.cor ?? null,
      ilvl: gerada.ilvl, nome: gerada.nome, ...(gerada.unico ? { unico: gerada.unico } : {}),
      atributos: a, implicitos: gerada.implicitos ?? [], prefixos: gerada.prefixos ?? [], sufixos: gerada.sufixos ?? [], modificadores: gerada.modificadores ?? [],
      estados: t.linhas.map((l) => l.estado), notas: notasDe(t), af, tv: VERSAO_DA_TRADUCAO,
    },
  };
}

/**
 * A VERSÃO da tradução dos mods (`traducao.json` + `atributos-novos.json`): sobe quando uma regra nova muda o `af` ou os estados das peças.
 * A peça de uma versão antiga é refeita na entrada (`refazerPecasAntigas`) — mods, valores, sockets e gemas ficam como estão.
 */
// (6 — 09/10: as regras da árvore × poedb, lotes 3 a 5, também mudam mods de itens: defesa de uma peça, condições de arma, exposição…)
// (7 — 09/10: a "Velocidade de Ataque aumentada" da arma passa a ser LOCAL, `atk_speed_local` — `separarVelocidadeLocal`.)
// (8 — 09/10: "X% menos Velocidade de Ataque" (o Legado do Guerreiro) multiplica — `atk_speed_mais`, não mais somado como "reduzida".)
export const VERSAO_DA_TRADUCAO = 8;
/** A nota de cada linha da peça (só a das "inertes": por que a mecânica não existe no jogo), na ordem dos mods. */
const notasDe = (t) => t.linhas.map((l) => (l.estado === 'inerte' ? l.partes.find((x) => x.nota)?.nota ?? null : null));

/**
 * Refaz o `af` e os estados das peças do PoE do personagem que foram traduzidas numa versão antiga (dono, 07/10: os mods "registrados"
 * passaram a ter efeito). Anda por TODO lugar onde mora peça (equipamento, mochila, bolsas, depósito, cinto de frascos). Devolve quantas.
 */
export function refazerPecasAntigas(estado) {
  if (!Catalogo.ligado() || !estado) return 0;
  let n = 0;
  const visto = new Set();
  const andar = (x, fundo = 0) => {
    if (!x || typeof x !== 'object' || visto.has(x) || fundo > 8) return;
    visto.add(x);
    if (x.poe?.base && (x.poe.tv ?? 1) < VERSAO_DA_TRADUCAO) {
      recalcular(x);
      x.poe.tv = VERSAO_DA_TRADUCAO;
      n++;
      return;
    }
    for (const v of Array.isArray(x) ? x : Object.values(x)) if (v && typeof v === 'object') andar(v, fundo + 1);
  };
  for (const [k, v] of Object.entries(estado)) if (!['hunt', 'derived', 'bestiary', 'quests', 'totals', 'progress'].includes(k)) andar(v);
  return n;
}

/**
 * REMONTA a peça do jogo a partir do `peca.poe` mudado (as moedas — `moedas.mjs`): os atributos do Draevor (`poe.af`, os estados das
 * linhas), o dano/defesa da base e o nome/cor da raridade. A QUALIDADE (`poe.qualidade`, o Amolador e a Sucata) aumenta o dano físico da
 * arma e a defesa da armadura em qualidade%, como no PoE. Sockets, gemas e o resto da peça ficam como estão.
 */
export function recalcular(peca, regras = Catalogo.REGRAS) {
  const p = peca?.poe;
  if (!p) return peca;
  const a = p.atributos ?? {};
  const fq = 1 + (Number(p.qualidade) || 0) / 100;
  const R = regras.raridades[p.raridade] ?? {};
  p.raridadeNome = R.nome ?? p.raridade;
  p.cor = R.cor ?? null;
  // "Superior" (poedb › Quality): a peça Normal com qualidade leva o prefixo no nome; sem qualidade (ou com raridade), o nome limpo.
  const nomeLimpo = String(p.nome ?? '').replace(/^Superior /, '');
  p.nome = p.raridade === 'normal' && (Number(p.qualidade) || 0) > 0 ? `Superior ${nomeLimpo}` : nomeLimpo;
  if (FRASCOS.includes(p.classe)) {
    const par = Frascos.parametros({ poe: p });
    p.estados = par.estadosPorMod;
    p.af = {};
    p.frasco = Frascos.resumo({ poe: p });
    p.tv = VERSAO_DA_TRADUCAO;
    return peca;
  }
  const mult = ([x, y]) => [Math.round(x * fq), Math.round(y * fq)];
  const base = {
    ...(a.dano_fisico && typeof a.dano_fisico === 'object' ? { attack: mult([a.dano_fisico.min, a.dano_fisico.max]) } : {}),
    ...(a.armadura ? { armor: mult([a.armadura, a.armadura]) } : {}),
    ...(a.evasao ? { evasion: mult([a.evasao, a.evasao]) } : {}),
    ...(a.escudo_energia ? { es: mult([a.escudo_energia, a.escudo_energia]) } : {}),
  };
  if (Object.keys(base).length) peca.base = base;
  else delete peca.base;
  const t = traduzirPeca(p);
  const af = { ...t.af };
  for (const [k, v] of Object.entries(afDaBase(a, af))) af[k] = (af[k] ?? 0) + v;
  separarVelocidadeLocal(p.classe, t, af);
  p.af = af;
  p.notas = notasDe(t);
  // A versão da tradução com que `af`/`estados` foram feitos (a entrada no jogo refaz as peças de versões antigas — `refazerPecasAntigas`).
  p.tv = VERSAO_DA_TRADUCAO;
  p.estados = t.linhas.map((l) => l.estado);
  return peca;
}

/**
 * A QUALIDADE no drop (dono, 07/10; poedb › Quality): parte das armas, armaduras e frascos cai "Superior", com 1 a `maximo`% de qualidade
 * (`regras.drop.qualidade.chance` por peça); o resto cai com 0%. A peça é remontada com a qualidade (dano/defesa/recuperação e o nome).
 */
export function qualidadeDoDrop(peca, rng = Math.random, regras = Catalogo.REGRAS) {
  const q = regras.drop?.qualidade;
  const p = peca?.poe;
  if (!p || !q?.chance) return peca;
  const temBase = !!(p.atributos?.dano_fisico || p.atributos?.armadura || p.atributos?.evasao || p.atributos?.escudo_energia) || FRASCOS.includes(p.classe);
  if (!temBase || rng() >= q.chance) return peca;
  p.qualidade = 1 + Math.floor(rng() * Math.max(1, q.maximo ?? 20));
  return recalcular(peca, regras);
}

// ---------------------------------------------------------------- entregar a um personagem online (a engine local)

let vivas = new Map();
/** As sessões vivas (o mesmo `Map` que a troca e a party recebem). */
export function ligar(mapa) {
  vivas = mapa;
}
export const online = () => [...vivas.values()].map((s) => s.personagem?.nome).filter(Boolean).sort();

/** Dá a peça (já do jogo) ao personagem online `nome` e atualiza a tela dele. */
export function entregar(nome, peca) {
  if (!Catalogo.ligado()) return { ok: false, erro: 'Sistema de itens do PoE desligado.' };
  const s = [...vivas.values()].find((x) => x.personagem?.nome?.toLowerCase() === String(nome ?? '').toLowerCase());
  if (!s?.estado) return { ok: false, erro: `"${nome}" não está online neste servidor.` };
  if (!peca) return { ok: false, erro: 'Peça inválida.' };
  darPeca(s.estado, peca);
  s.enviar?.({ t: 'notice', notice: `Recebeu ${peca.poe?.nome ?? 'uma peça do PoE'} (engine local).` });
  // Pelo `aplicar` da sessão: a regra de capacidade roda NA HORA (o excesso vai para o Depósito, com o aviso) — antes só rodava na próxima
  // ação (equipar...), e a peça parecia sumir.
  if (s.aplicar) s.aplicar({ ok: true });
  else s.mandarEstado?.();
  return { ok: true, nome: s.personagem.nome };
}

// ---------------------------------------------------------------- o drop nas caçadas

/**
 * QUANTAS peças do PoE caem do bicho (a regra do PoE que o dono trouxe, 05/10): quantidade = chanceBase × (1 + bônus de quantidade da
 * raridade do bicho) × (1 + modificadores de quantidade do jogador/mapa). Abaixo de 1 é a chance de 1 peça; de 1 para cima, a parte
 * inteira é garantida e o excedente rola mais uma. `tipo`: a raridade do bicho no Draevor (normal, modificado, raro, elite, unico, boss —
 * ver `hunt/escalonamento.tipoDoBicho`). `fatorDoJogador`: o (1 + modificadores) — na caçada, os mesmos fatores do loot do Draevor.
 */
export function quantidadeDoDrop(tipo, regras = Catalogo.REGRAS, fatorDoJogador = 1) {
  const D = regras.drop;
  const bonus = Number(D?.bonusDeQuantidade?.[tipo] ?? D?.bonusDeQuantidade?.normal ?? 0) || 0;
  return Math.max(0, Number(D?.chanceBase) || 0) * (1 + bonus) * Math.max(0, Number(fatorDoJogador) || 0);
}
export function quantasPecas(tipo, rng = Math.random, regras = Catalogo.REGRAS, fatorDoJogador = 1) {
  const q = quantidadeDoDrop(tipo, regras, fatorDoJogador);
  return Math.floor(q) + (rng() < q - Math.floor(q) ? 1 : 0);
}

/** A faixa de ouro `[min, max]` de um level (`regras.ouro.tabela`: `[level, min, max]`, interpolada entre dois levels da tabela). */
export function faixaDeOuro(nivel, regras = Catalogo.REGRAS) {
  const t = regras?.ouro?.tabela ?? [];
  if (!t.length) return [0, 0];
  const n = Math.max(1, Number(nivel) || 1);
  if (n <= t[0][0]) return [t[0][1], t[0][2]];
  const fim = t[t.length - 1];
  if (n >= fim[0]) return [fim[1], fim[2]];
  const i = t.findIndex(([lv]) => lv > n);
  const [a, b] = [t[i - 1], t[i]];
  const f = (n - a[0]) / (b[0] - a[0]);
  return [Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)];
}

/** O multiplicador de ouro da raridade do bicho: o de `ouro.porRaridade`, senão (1 + bônus de quantidade do drop). */
export function multiplicadorDeOuro(tipo, regras = Catalogo.REGRAS) {
  const proprio = Number(regras?.ouro?.porRaridade?.[tipo]);
  if (Number.isFinite(proprio) && proprio >= 0) return proprio;
  return 1 + (Number(regras?.drop?.bonusDeQuantidade?.[tipo] ?? 0) || 0);
}

/** O ouro que o monstro do PoE solta (aleatório na faixa do level × raridade × `achado`, o Gold Find). 0 sem o sistema ligado. */
export function ouroDoMonstro(nivel, tipo, rng = Math.random, regras = Catalogo.REGRAS, achado = 1) {
  if (!regras?.ouro) return 0;
  const [min, max] = faixaDeOuro(nivel, regras);
  const base = min + Math.floor(rng() * (max - min + 1));
  return Math.max(0, Math.round(base * multiplicadorDeOuro(tipo, regras) * Math.max(0, Number(achado) || 0)));
}

/**
 * Uma peça do PoE sorteada para o Item Level do bicho (= o level dele, até `ilvlMaximo`): a raridade pelos pesos do dono, a base entre as
 * equipáveis cujo nível exigido cabe no Item Level; o Único só sai de base que tem único. Null sem o sistema ligado ou sem pesos.
 */
/**
 * O BAÚ DE NÍVEL 1 (a recompensa do level 1 — dono, 07/10: "um baú aleatório de itens lv 1 comum"): UMA peça equipável sorteada entre as
 * bases que pedem nível 1, Normal (comum), Item Level 1. Sem frascos (os dois iniciais já vêm no cinto) e sem as bases do Battle Royale.
 */
export function pecaDoBauInicial(rng = Math.random, regras = Catalogo.REGRAS) {
  const cat = Catalogo.catalogo();
  if (!cat) return null;
  const candidatas = [];
  for (const baseId of REG.porBase.keys()) {
    const [classe] = baseId.split('/');
    if (FRASCOS.includes(classe)) continue;
    const b = cat.classes[classe]?.bases.find((x) => x.id === baseId);
    if (!b || (b.requisitos?.nivel ?? 1) > 1 || b.slug?.startsWith('Royale_') || b.slug === 'Energy_Blade') continue;
    if (!podeCairComo(cat.classes[classe], b, 'normal')) continue;
    candidatas.push(baseId);
  }
  if (!candidatas.length) return null;
  const base = candidatas[Math.floor(rng() * candidatas.length)];
  return pecaDoJogo(gerarPeca({ catalogo: cat, regras, base, raridade: 'normal', ilvl: 1, rng }), regras, rng);
}

/**
 * Uma peça do PoE que cai de um bicho do nível `nivelDoBicho`: a raridade (com a "Raridade de Itens encontrados" do personagem), a base, os
 * mods e a qualidade. `baseFixa` (`Classe/Slug`): a peça é DESSA base (a projeção da caçada offline repõe as bases que caíram na parte
 * simulada); um Único sorteado numa base sem Único do PoE vira Raro.
 */
/**
 * A base SEM pool de mods não cai Normal, Mágica nem Rara — só como Único, se tiver um (regra do PoE): as Golden (no PoE só existem como
 * recompensa, ex.: as do Demigod) e as Rúnicas/Ward (da Expedição; a coleção não traz o pool delas). Antes caíam Raras sem nenhum mod.
 */
export const podeCairComo = (classe, base, raridade) => !!base?.pool || (raridade === 'unico' && !!classe?.unicos?.some((u) => u.base === base?.nome));

export function pecaSorteada(nivelDoBicho, rng = Math.random, regras = Catalogo.REGRAS, raridadeAumentada = 0, baseFixa = null) {
  const cat = Catalogo.catalogo();
  const D = regras.drop;
  if (!cat || !D) return null;
  // PoE: a "Raridade de Itens encontrados aumentada" do personagem multiplica a chance de Mágico, Raro e Único (a Normal fica).
  const fatorDeRaridade = Math.max(0, 1 + (Number(raridadeAumentada) || 0) / 100);
  const pesos = Object.entries(D.raridades ?? {}).filter(([r, p]) => p > 0 && regras.raridades[r]).map(([r, p]) => [r, r === 'normal' ? p : p * fatorDeRaridade]);
  const total = pesos.reduce((n, [, p]) => n + p, 0);
  if (!(total > 0)) return null;
  let sorte = rng() * total;
  let raridade = pesos.find(([, p]) => (sorte -= p) < 0)?.[0] ?? pesos[pesos.length - 1][0];
  const ilvl = Math.max(1, Math.min(D.ilvlMaximo ?? 100, Math.round(Number(nivelDoBicho) || 1)));
  if (baseFixa) {
    const [classe] = baseFixa.split('/');
    const c = cat.classes[classe];
    const b = c?.bases.find((x) => x.id === baseFixa);
    if (!b) return null;
    if (raridade === 'unico' && !c.unicos.some((u) => u.base === b.nome)) raridade = 'raro';
    if (!podeCairComo(c, b, raridade)) return null;
    const r = raridade === 'raro' && FRASCOS.includes(classe) ? 'magico' : raridade;
    return qualidadeDoDrop(pecaDoJogo(gerarPeca({ catalogo: cat, regras, base: baseFixa, raridade: r, ilvl, rng }), regras, rng), rng, regras);
  }
  const candidatas = [];
  for (const baseId of REG.porBase.keys()) {
    const [classe] = baseId.split('/');
    const c = cat.classes[classe];
    const b = c?.bases.find((x) => x.id === baseId);
    if (!b || (b.requisitos?.nivel ?? 1) > ilvl) continue;
    // As bases "Royale" são do modo Battle Royale do PoE: ficam no catálogo (os ids não mudam), mas não caem. A "Lâmina de Energia" também
    // não: no PoE ela é a arma que a habilidade Lâmina de Energia cria.
    if (b.slug?.startsWith('Royale_') || b.slug === 'Energy_Blade') continue;
    if (raridade === 'unico' && !c.unicos.some((u) => u.base === b.nome)) continue;
    if (!podeCairComo(c, b, raridade)) continue;
    candidatas.push(baseId);
  }
  if (!candidatas.length) return null;
  const base = candidatas[Math.floor(rng() * candidatas.length)];
  // Frasco não é Raro no PoE (só Normal, Mágico e Único): o Raro sorteado vira Mágico.
  const r = raridade === 'raro' && FRASCOS.includes(base.split('/')[0]) ? 'magico' : raridade;
  return qualidadeDoDrop(pecaDoJogo(gerarPeca({ catalogo: cat, regras, base, raridade: r, ilvl, rng }), regras, rng), rng, regras);
}

/** As peças do PoE que caem do bicho morto (lista, talvez vazia). Só com o sistema ligado. */
export function dropsDoMonstro(nivelDoBicho, tipo = 'normal', rng = Math.random, regras = Catalogo.REGRAS, fatorDoJogador = 1, raridadeAumentada = 0) {
  if (!Catalogo.catalogo() || !regras.drop) return [];
  const n = quantasPecas(tipo, rng, regras, fatorDoJogador);
  const pecas = [];
  for (let i = 0; i < n; i++) {
    const p = pecaSorteada(nivelDoBicho, rng, regras, raridadeAumentada);
    if (p) pecas.push(p);
  }
  return pecas;
}

// ---------------------------------------------------------------- o começo do personagem (como no PoE)

/** A arma com que cada classe do PoE começa (a base da coleção). Decisão do dono (05/10): nível 1 e só a arma da classe. */
export const ARMA_INICIAL = {
  Marauder: 'One_Hand_Maces/Driftwood_Club',
  Ranger: 'Bows/Crude_Bow',
  Witch: 'Wands/Driftwood_Wand',
  Duelist: 'One_Hand_Swords/Rusted_Sword',
  Templar: 'Sceptres/Driftwood_Sceptre',
  Shadow: 'Daggers/Glass_Shank',
  Scion: 'One_Hand_Swords/Rusted_Sword',
};

/** A peça da arma inicial da classe (Normal, Item Level 1), ou null (sistema desligado, base que não existe). */
/** O FRASCO DE VIDA inicial (dono, 07/10: "todo personagem já começa com um flask de vida mínimo" — vem pela Recompensa do level 1). Marcado
 * `inicial`: pede level 3 no PoE, mas o cinto aceita (ver `frascos.mjs` → `por`). */
export const BASE_DO_FRASCO_INICIAL = 'Life_Flasks/Small_Life_Flask';
export function frascoInicial(regras = Catalogo.REGRAS) {
  const cat = Catalogo.catalogo();
  if (!cat) return null;
  const peca = pecaDoJogo(gerarPeca({ catalogo: cat, regras, base: BASE_DO_FRASCO_INICIAL, raridade: 'normal', ilvl: 1, rng: () => 0.5 }), regras, () => 0.5);
  if (peca?.poe) peca.poe.inicial = true;
  return peca;
}

export function armaInicial(slugDaClasse, regras = Catalogo.REGRAS) {
  const cat = Catalogo.catalogo();
  const base = ARMA_INICIAL[slugDaClasse] ?? ARMA_INICIAL.Scion;
  if (!cat) return null;
  return pecaDoJogo(gerarPeca({ catalogo: cat, regras, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }), regras, () => 0.5);
}

// (09/10) As defesas da BASE de uma peça do PoE (as condições "se o Elmo, Peitoral, Luvas e Botas tiverem Evasão/Armadura"): o catálogo.
const DEFESAS_DA_BASE = new Map();
definirLeitorDeBase((poe) => {
  if (!poe?.base) return null;
  if (!DEFESAS_DA_BASE.has(poe.base)) {
    const [classe] = String(poe.base).split('/');
    const b = Catalogo.catalogo()?.classes?.[classe]?.bases?.find((x) => x.id === poe.base);
    const v = (k) => Number(b?.atributos?.[k]?.max ?? b?.atributos?.[k]) || 0;
    DEFESAS_DA_BASE.set(poe.base, b ? { armadura: v('armadura'), evasao: v('evasao'), escudo: v('escudo_energia') } : null);
  }
  return DEFESAS_DA_BASE.get(poe.base);
});
