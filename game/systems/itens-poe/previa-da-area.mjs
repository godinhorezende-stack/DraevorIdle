// A PRÉVIA de uma área do PoE na janela da hunt (dono, 06/10: "nessa parte aparece os valores reais do PoE que foi utilizado e nomes, sempre
// do mod, itens e suas chances"). Só leitura, montada dos MESMOS dados que o jogo usa na hora da morte — nada é escrito à mão aqui:
//   monstros   — os da área (campanha do PoE + ajustes da Engine), com os status do PoE (vida, dano, tempo de ataque, armadura, evasão,
//                escudo de energia, resistências, experiência) e a tabela de drop própria de cada um (item de missão...);
//   raridade   — a chance de o monstro nascer Mágico/Raro, quantos modificadores, a exp e os ocultos (vida/dano) de cada raridade;
//   mods       — os modificadores de monstro que podem sair no nível da área, com o nome, o texto e a chance de cada um (pelo peso);
//   drop       — quantas peças por monstro (pela raridade), a raridade da peça, o Item Level, a chance de cada categoria de item, o ouro.
import { REGRAS } from './catalogo.mjs';
import * as Monstros from './monstros.mjs';
import * as ModsDeMonstro from './modificadores-monstro.mjs';
import * as DropsPorMonstro from './drops-por-monstro.mjs';
import * as Jogo from './jogo.mjs';
import { catalogo } from './catalogo.mjs';
import { ITEM_CATALOG } from '../dados.mjs';

const C = Monstros.CAMPANHA;
const pct = (v) => Math.round(v * 10000) / 100; // fração → % com 2 casas
const CATEGORIA_DO_GRUPO = {
  Armas_de_Uma_Mao: 'Armas de uma mão', Armas_de_Duas_Maos: 'Armas de duas mãos', Armadura: 'Armaduras', Armas_Secundarias: 'Escudos e aljavas',
  Acessorios: 'Anéis, amuletos e cintos', Frascos: 'Frascos',
};

/** A chance (fração) de cada modificador sair numa raridade do PoE, no nível dado: o peso dele sobre a soma dos elegíveis. */
function modsDaRaridade(raridadePoe, nivel) {
  const lista = ModsDeMonstro.DADOS.mods.map((m) => [m, ModsDeMonstro.elegivel(m, raridadePoe, nivel)]).filter(([, p]) => p > 0);
  const total = lista.reduce((t, [, p]) => t + p, 0);
  return lista.map(([m, p]) => ({ id: m.id, nome: m.nome, nomeEn: m.nomeEn, linhas: m.linhas, nivel: m.nivel, chance: pct(p / total), estado: m.estado })).sort((a, b) => b.chance - a.chance);
}

/** As categorias de item que podem cair no Item Level dado, com a chance de cada uma (o sorteio escolhe a base ao acaso entre as elegíveis). */
function categorias(ilvl) {
  const cat = catalogo();
  if (!cat) return [];
  const porCategoria = new Map();
  let total = 0;
  for (const baseId of Jogo.registro().porBase.keys()) {
    const [classe] = baseId.split('/');
    const c = cat.classes[classe];
    const b = c?.bases.find((x) => x.id === baseId);
    if (!b || (b.requisitos?.nivel ?? 1) > ilvl) continue;
    const nome = CATEGORIA_DO_GRUPO[c.grupo] ?? c.grupo;
    const atual = porCategoria.get(nome) ?? { categoria: nome, bases: 0, exemplos: [] };
    atual.bases++;
    if (atual.exemplos.length < 4 && !atual.exemplos.includes(b.nome)) atual.exemplos.push(b.nome);
    porCategoria.set(nome, atual);
    total++;
  }
  return [...porCategoria.values()].map((x) => ({ ...x, chance: pct(x.bases / Math.max(1, total)) })).sort((a, b) => b.chance - a.chance);
}

/** A prévia da área `id` (null se não é uma área do PoE). */
export function previaDaArea(id) {
  const a = C.areas[id];
  if (!a || a.cidade) return null;
  const nivel = a.nivel ?? Math.max(1, ...a.monstros.map((m) => m.nivel ?? 1));
  const D = REGRAS.drop ?? {};
  const pesos = Object.entries(D.raridades ?? {}).filter(([r, p]) => typeof p === 'number' && p > 0 && REGRAS.raridades[r]);
  const somaPesos = pesos.reduce((t, [, p]) => t + p, 0);
  const ilvl = Math.max(1, Math.min(D.ilvlMaximo ?? 100, nivel));
  const [ouroMin, ouroMax] = Jogo.faixaDeOuro(nivel);
  const O = ModsDeMonstro.DADOS;
  return {
    id, nome: a.nome, ato: a.ato, nivel,
    monstros: a.monstros.map((m) => {
      const key = Monstros.chaveDe(m);
      return {
        key, slug: m.slug, nome: m.nome, nivel: m.nivel, unico: !!m.unico,
        vida: m.vida, dano: m.dano, tempoAtaque: m.tempoAtaque, armadura: m.armadura ?? 0, evasao: m.evasao ?? 0, escudoDeEnergia: m.escudoDeEnergia ?? 0,
        resistencias: m.resistencias ?? {}, experiencia: m.experiencia,
        habilidades: (m.habilidades ?? []).map((h) => h.nome),
        drops: DropsPorMonstro.tabelaDe(key).map((d) => ({ id: Number(d.id), nome: ITEM_CATALOG[d.id]?.name ?? `item ${d.id}`, chance: Number(d.chance), missao: !!d.missao })),
      };
    }),
    raridade: {
      sorteio: Object.fromEntries(Object.entries(O.sorteioDaRaridade ?? {}).map(([r, c]) => [r, pct(c)])),
      quantos: O.quantos,
      exp: O.expPorRaridade ?? {},
      ocultos: Object.fromEntries(Object.entries(O.ocultos ?? {}).map(([r, o]) => [r, { vida: pct(o.vidaMais), dano: pct(o.danoMais), velocidadeDeAtaque: o.velocidadeDeAtaquePct, movimento: o.velocidadePct }])),
    },
    mods: { magico: modsDaRaridade('magico', nivel), raro: modsDaRaridade('raro', nivel) },
    drop: {
      ilvl,
      // Quantas peças (em média) cada monstro solta, pela raridade dele: chanceBase × (1 + bônus) — acima de 100% é mais de uma peça.
      pecasPorMonstro: Object.fromEntries(['normal', 'modificado', 'raro', 'unico'].map((r) => [r, pct(Jogo.quantidadeDoDrop(r))])),
      raridadeDaPeca: pesos.map(([r, p]) => ({ raridade: r, nome: REGRAS.raridades[r].nome, cor: REGRAS.raridades[r].cor, chance: pct(p / somaPesos) })),
      categorias: categorias(ilvl),
      ouro: { min: ouroMin, max: ouroMax, porRaridade: Object.fromEntries(['normal', 'modificado', 'raro', 'unico'].map((r) => [r, Jogo.multiplicadorDeOuro(r)])) },
    },
  };
}
