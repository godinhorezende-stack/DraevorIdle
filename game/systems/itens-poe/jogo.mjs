// O sistema de itens do PoE DENTRO do jogo local (Fase 1, incremento 3c — só com ITENS_POE=1; em produção nunca liga).
//
//   1. `iniciar(ITEM_CATALOG)`: as bases do PoE entram no catálogo como itens VIRTUAIS (ids a partir de 7.000.000), com slot, perícia
//      e duas mãos — o catálogo inteiro já vai ao cliente no `welcome`, então inventário, equipamento e balão as conhecem sem rota nova.
//   2. `pecaDoJogo(peca)`: a peça gerada (gerar.mjs) vira peça do jogo — a BASE em `peca.base` (dano da arma, armadura, evasão, escudo
//      de energia, que a ficha já lê por peça) e o resto em `peca.poe` (raridade, mods, nome, ícone e o `af` traduzido, que
//      `Afixos.somaDeItens` soma). Os valores entram como estão (decisão do dono, 04/10).
//   3. `entregar(nome, peca)`: dá a peça a um personagem ONLINE (a engine local usa para testar jogando).
// Classes sem slot no Draevor (cintos, frascos, joias, talismãs, varas de pesca) não entram — ficam listadas em `naoEquipaveis`.
import * as Catalogo from './catalogo.mjs';
import { traduzirPeca } from './traduzir.mjs';
import { gerarPeca } from './gerar.mjs';
import { darPeca } from '../inventario.mjs';

export const PRIMEIRO_ID = 7_000_000;

/**
 * Classe do PoE → como o Draevor equipa. Luvas vão no slot de PERNAS (o Draevor troca luvas por pernas — `gemas/config.json`, sockets).
 * Arco e varinha: arma de distância SEM munição (como a lança/estrela do Draevor). Aljava: o "shield" com `quiver`, como a do Draevor.
 */
export const CLASSES_DO_JOGO = {
  Body_Armours: { slot: 'body', tipo: 'armors' },
  Helmets: { slot: 'head', tipo: 'helmets' },
  Boots: { slot: 'feet', tipo: 'boots' },
  Gloves: { slot: 'legs', tipo: 'legs' },
  Shields: { slot: 'shield', tipo: 'shields' },
  Quivers: { slot: 'shield', tipo: 'quivers', quiver: true },
  Rings: { slot: 'ring', tipo: 'rings' },
  Amulets: { slot: 'neck', tipo: 'amulets' },
  One_Hand_Swords: { slot: 'weapon', tipo: 'sword weapons', skill: 'sword' },
  Thrusting_One_Hand_Swords: { slot: 'weapon', tipo: 'sword weapons', skill: 'sword' },
  Two_Hand_Swords: { slot: 'weapon', tipo: 'sword weapons', skill: 'sword', twoHanded: true },
  One_Hand_Axes: { slot: 'weapon', tipo: 'axe weapons', skill: 'axe' },
  Two_Hand_Axes: { slot: 'weapon', tipo: 'axe weapons', skill: 'axe', twoHanded: true },
  One_Hand_Maces: { slot: 'weapon', tipo: 'club weapons', skill: 'club' },
  Two_Hand_Maces: { slot: 'weapon', tipo: 'club weapons', skill: 'club', twoHanded: true },
  Sceptres: { slot: 'weapon', tipo: 'club weapons', skill: 'club' },
  Staves: { slot: 'weapon', tipo: 'club weapons', skill: 'club', twoHanded: true },
  Warstaves: { slot: 'weapon', tipo: 'club weapons', skill: 'club', twoHanded: true },
  Claws: { slot: 'weapon', tipo: 'sword weapons', skill: 'sword' },
  Daggers: { slot: 'weapon', tipo: 'sword weapons', skill: 'sword' },
  Rune_Daggers: { slot: 'weapon', tipo: 'sword weapons', skill: 'sword' },
  Bows: { slot: 'weapon', tipo: 'distance weapons', skill: 'distance', twoHanded: true, range: 6 },
  Wands: { slot: 'weapon', tipo: 'distance weapons', skill: 'distance', range: 5 },
};

const REG = { porBase: new Map(), porId: new Map(), naoEquipaveis: [] };
export const registro = () => REG;
/** O id virtual da base (`Classe/Slug`), ou null. */
export const idDaBase = (base) => REG.porBase.get(base) ?? null;

const media = (v) => (v && typeof v === 'object' ? Math.round((v.min + v.max) / 2) : Number(v) || 0);

/** Registra as bases equipáveis do catálogo do PoE em `ITEM_CATALOG` (uma vez). Devolve o registro. Sem o sistema ligado, não faz nada. */
export function iniciar(itemCatalog) {
  const cat = Catalogo.catalogo();
  if (!cat || REG.porBase.size) return REG;
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
        id, name: b.nome, type: regra.tipo, slot: regra.slot, weight: 50, hasSprite: false, rarity: 'comum', stackable: false,
        ...(b.requisitos?.nivel ? { minLevel: b.requisitos.nivel } : {}),
        ...(regra.skill ? { skill: regra.skill, attack: media(a.dano_fisico) } : {}),
        ...(regra.twoHanded ? { twoHanded: true } : {}),
        ...(regra.range ? { range: regra.range } : {}),
        ...(regra.quiver ? { quiver: true } : {}),
        ...(a.armadura ? { armor: media(a.armadura) } : {}),
        // Marca de item do PoE: o cliente desenha o ícone da coleção e o balão próprio; o servidor acha a base.
        poe: { base: b.id, classe: c.id, icone: b.icone ?? null },
      };
      REG.porBase.set(b.id, id);
      REG.porId.set(id, b.id);
    }
  }
  return REG;
}

/** O que a BASE dá como atributo do Draevor (o bloqueio do escudo, a velocidade de movimento), somado ao `af` dos mods. */
function afDaBase(atributos) {
  const af = {};
  if (atributos?.chance_bloqueio_pct) af.block = Number(atributos.chance_bloqueio_pct);
  if (atributos?.velocidade_movimento_pct) af.move_speed = Number(atributos.velocidade_movimento_pct);
  return af;
}

/**
 * A peça do JOGO a partir da peça gerada (`gerarPeca`). `{ id, count: 1, base, poe }` — sem `raridade`/`af` do Draevor (a peça do PoE
 * não passa pelas regras de raridade e de afixos do Draevor: forja, essência e o resto não a reconhecem).
 */
export function pecaDoJogo(gerada, regras = Catalogo.REGRAS) {
  if (!gerada || gerada.erro) return null;
  const id = idDaBase(gerada.base);
  if (!id) return null;
  const a = gerada.atributos ?? {};
  const base = {
    ...(a.dano_fisico && typeof a.dano_fisico === 'object' ? { attack: [a.dano_fisico.min, a.dano_fisico.max] } : {}),
    ...(a.armadura ? { armor: [a.armadura, a.armadura] } : {}),
    ...(a.evasao ? { evasion: [a.evasao, a.evasao] } : {}),
    ...(a.escudo_energia ? { es: [a.escudo_energia, a.escudo_energia] } : {}),
  };
  const t = traduzirPeca(gerada);
  const af = { ...t.af };
  for (const [k, v] of Object.entries(afDaBase(a))) af[k] = (af[k] ?? 0) + v;
  const R = regras.raridades[gerada.raridade] ?? {};
  return {
    id, count: 1,
    ...(Object.keys(base).length ? { base } : {}),
    poe: {
      base: gerada.base, classe: gerada.classe, raridade: gerada.raridade, raridadeNome: R.nome ?? gerada.raridade, cor: R.cor ?? null,
      ilvl: gerada.ilvl, nome: gerada.nome, ...(gerada.unico ? { unico: gerada.unico } : {}),
      atributos: a, implicitos: gerada.implicitos ?? [], prefixos: gerada.prefixos ?? [], sufixos: gerada.sufixos ?? [], modificadores: gerada.modificadores ?? [],
      estados: t.linhas.map((l) => l.estado), af,
    },
  };
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
  s.mandarEstado?.();
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

/**
 * Uma peça do PoE sorteada para o Item Level do bicho (= o level dele, até `ilvlMaximo`): a raridade pelos pesos do dono, a base entre as
 * equipáveis cujo nível exigido cabe no Item Level; o Único só sai de base que tem único. Null sem o sistema ligado ou sem pesos.
 */
export function pecaSorteada(nivelDoBicho, rng = Math.random, regras = Catalogo.REGRAS) {
  const cat = Catalogo.catalogo();
  const D = regras.drop;
  if (!cat || !D) return null;
  const pesos = Object.entries(D.raridades ?? {}).filter(([r, p]) => p > 0 && regras.raridades[r]);
  const total = pesos.reduce((n, [, p]) => n + p, 0);
  if (!(total > 0)) return null;
  let sorte = rng() * total;
  const raridade = pesos.find(([, p]) => (sorte -= p) < 0)?.[0] ?? pesos[pesos.length - 1][0];
  const ilvl = Math.max(1, Math.min(D.ilvlMaximo ?? 100, Math.round(Number(nivelDoBicho) || 1)));
  const candidatas = [];
  for (const baseId of REG.porBase.keys()) {
    const [classe] = baseId.split('/');
    const c = cat.classes[classe];
    const b = c?.bases.find((x) => x.id === baseId);
    if (!b || (b.requisitos?.nivel ?? 1) > ilvl) continue;
    if (raridade === 'unico' && !c.unicos.some((u) => u.base === b.nome)) continue;
    candidatas.push(baseId);
  }
  if (!candidatas.length) return null;
  const base = candidatas[Math.floor(rng() * candidatas.length)];
  return pecaDoJogo(gerarPeca({ catalogo: cat, regras, base, raridade, ilvl, rng }), regras);
}

/** As peças do PoE que caem do bicho morto (lista, talvez vazia). Só com o sistema ligado. */
export function dropsDoMonstro(nivelDoBicho, tipo = 'normal', rng = Math.random, regras = Catalogo.REGRAS, fatorDoJogador = 1) {
  if (!Catalogo.catalogo() || !regras.drop) return [];
  const n = quantasPecas(tipo, rng, regras, fatorDoJogador);
  const pecas = [];
  for (let i = 0; i < n; i++) {
    const p = pecaSorteada(nivelDoBicho, rng, regras);
    if (p) pecas.push(p);
  }
  return pecas;
}
