// Os LACAIOS e os TOTENS das gemas do PoE (dono, 06/10: "sistema de lacaios do PoE" — as 58 gemas de invocação e os 21 totens estavam
// bloqueados porque o jogo não tinha lacaios). O que cada gema invoca, NO NÍVEL dela, sai das linhas da gema (poedb):
//   - "Máximo de (3 — 6) Zumbis Evocados", "Máximo de Espíritos Furiosos Convocados: 20" → o máximo em campo;
//   - "Convoca 2 Guerreiros Esqueleto" → quantos por uso (1 se não diz);
//   - "Duração base é de 20 segundos" / "Totem dura 8 segundos" → a duração (sem: ficam até morrer);
//   - "Lacaios têm X% mais Vida Máxima", "Lacaio causa X% mais Dano" → por cima da força de base;
//   - "Espectros Erguidos são de Nível N" → o nível do lacaio (sem: o nível que a gema pede — o "RequerNível" do nível dela);
//   - "+N ao número máximo de Totens" → mais totens.
// A FORÇA de base de um lacaio do nível N é a de um monstro COMUM do PoE desse nível (a mediana da campanha: `campanha-poe.json`), e o
// desenho vem do nome (zumbi, esqueleto, espírito, golem...). O TOTEM fica parado onde nasce e usa a própria skill da gema, com o dano
// dela (a conta do jogo) e o visual dela.
import { CATALOGO } from '../dados.mjs';
import * as GemasPoe from './gemas-poe.mjs';
import { CAMPANHA, desenhoPeloNome } from './monstros.mjs';

const BESTIARY = CATALOGO.bestiary;

// ---- a força de base por nível (a mediana dos monstros comuns da campanha) ----
const PONTOS = (() => {
  const por = new Map();
  for (const a of Object.values(CAMPANHA.areas ?? {})) for (const m of a.monstros ?? []) {
    if (m.unico || !(m.vida > 0) || !(m.nivel > 0)) continue;
    if (!por.has(m.nivel)) por.set(m.nivel, []);
    por.get(m.nivel).push(m);
  }
  const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  return [...por.entries()].sort((a, b) => a[0] - b[0]).map(([n, ms]) => ({ n, vida: med(ms.map((m) => m.vida)), dano: med(ms.map((m) => m.dano ?? 1)), tempo: med(ms.map((m) => m.tempoAtaque ?? 1.2)) }));
})();
/** A vida, o dano por golpe e o tempo de ataque (s) de um monstro comum do nível `n` (interpolado entre os da campanha). */
export function forcaDoNivel(n) {
  if (!PONTOS.length) return { vida: 50 + n * 30, dano: 4 + n * 2, tempo: 1.2 };
  if (n <= PONTOS[0].n) return { ...PONTOS[0] };
  for (let i = 1; i < PONTOS.length; i++) {
    const a = PONTOS[i - 1];
    const b = PONTOS[i];
    if (n <= b.n) {
      const f = (n - a.n) / Math.max(1, b.n - a.n);
      return { n, vida: a.vida + (b.vida - a.vida) * f, dano: a.dano + (b.dano - a.dano) * f, tempo: a.tempo + (b.tempo - a.tempo) * f };
    }
  }
  const u = PONTOS.at(-1);
  // Acima da campanha: cresce como no fim dela (~6% por nível).
  const k = 1.06 ** (n - u.n);
  return { n, vida: u.vida * k, dano: u.dano * k, tempo: u.tempo };
}

// ---- o desenho do lacaio, pelo nome ----
const DESENHO_POR_PALAVRA = [
  [/zumbi/i, 'zombie'], [/esqueleto/i, 'skeleton-warrior'], [/espectro/i, 'spectre'], [/fantasma|espírito/i, 'ghost'], [/golem.*(chama|fogo)/i, 'fire-elemental'],
  [/golem.*(gelo|geada)/i, 'ice-golem'], [/golem.*(relâmp|raio)/i, 'energy-elemental'], [/golem.*(caos)/i, 'lich'], [/golem/i, 'stone-golem'], [/guardi/i, 'gargoyle'],
  [/sentinela/i, 'banshee'], [/totem/i, 'minotaur-totem'], [/arma|lâmina|armas animadas/i, 'demon-skeleton'], [/aranha/i, 'giant-spider'], [/corvo|abutre/i, 'gargoyle'],
];
const DESENHO_DO_ELEMENTO = { fire: 'fire-elemental', ice: 'ice-golem', energy: 'energy-elemental', chaos: 'lich', physical: 'skeleton' };
function desenhoDe(nome, elemento, totem) {
  // O golem é do elemento da gema (Golem de Chamas: o elemental de fogo; de Gelo: o golem de gelo); o de pedra é o físico.
  const golem = /golem/i.test(nome) ? (elemento && elemento !== 'physical' ? DESENHO_DO_ELEMENTO[elemento] : 'stone-golem') : null;
  const k = (totem ? 'minotaur-totem' : null) ?? golem ?? DESENHO_POR_PALAVRA.find(([re]) => re.test(nome))?.[1] ?? desenhoPeloNome(nome) ?? DESENHO_DO_ELEMENTO[elemento] ?? 'skeleton';
  const b = BESTIARY[k] ?? BESTIARY.skeleton ?? Object.values(BESTIARY)[0];
  return { look: b.look, colors: b.colors ?? null, lookItem: b.lookItem ?? 0 };
}
/** "Zumbis Evocados" → "Zumbi"; "Espíritos Furiosos" → "Espírito Furioso". */
const singular = (t) => String(t).trim().split(/\s+/).map((p) => (/ões$|ãos$/i.test(p) ? p.replace(/(ões|ãos)$/i, 'ão') : /ns$/i.test(p) ? p.replace(/ns$/i, 'm') : /ais$/i.test(p) ? p.replace(/ais$/i, 'al') : /eis$/i.test(p) ? p.replace(/eis$/i, 'el') : p.replace(/s$/i, ''))).join(' ');

/**
 * O que a gema invoca no `nivel`: `{ tipo: 'lacaio'|'totem', nome, maximo, porUso, duracaoMs, nivel, vida, dano: {min,max}, intervaloMs, desenho }`.
 * `efeito` (o dos suportes ligados): `lacaioVidaPct`, `lacaioDanoPct`, `totensExtras`, `duracaoPct`.
 */
export function oQueInvoca(slug, nivelDaGema = 1, efeito = null) {
  const r = GemasPoe.doSlug(slug);
  if (!r) return null;
  const t = GemasPoe.textosDaGema(slug, nivelDaGema);
  const totem = r.arquetipo === 'totem' || t.linhas.some((l) => /Invoca um Totem/i.test(l));
  let nome = totem ? 'Totem' : 'Lacaio';
  let maximo = totem ? 1 : 1;
  let porUso = 1;
  let duracao = null;
  let maisVida = 0;
  let maisDano = 0;
  let nivel = null;
  for (const l of t.linhas) {
    let m;
    if ((m = l.match(/^Máximo de (\d+) (.+?) (?:Evocad|Convocad|Erguid|Invocad|Animad)/i))) { maximo = Number(m[1]); nome = singular(m[2]); }
    else if ((m = l.match(/^Máximo de (.+?) (?:Evocad|Convocad|Erguid|Invocad)\S*: (\d+)/i))) { maximo = Number(m[2]); nome = singular(m[1]); }
    else if ((m = l.match(/^\+(\d+) ao número máximo de Totens/i))) maximo += Number(m[1]);
    else if ((m = l.match(/^Convoca (\d+) (.+)$/i))) { porUso = Number(m[1]); if (nome === 'Lacaio') nome = singular(m[2]); }
    else if ((m = l.match(/^(?:Duração base é de|Totem dura) (\d+(?:\.\d+)?) segundos?/i))) duracao = Number(m[1]) * 1000;
    else if ((m = l.match(/Lacaios? têm (\d+(?:\.\d+)?) ?% mais Vida/i))) maisVida += Number(m[1]);
    else if ((m = l.match(/Lacaios? causam? (\d+(?:\.\d+)?) ?% mais Dano/i))) maisDano += Number(m[1]);
    else if ((m = l.match(/são de Nível (\d+)/i))) nivel = Number(m[1]);
  }
  if (totem) maximo += efeito?.totensExtras ?? 0;
  const n = nivel ?? Math.max(1, t.requer);
  const f = forcaDoNivel(n);
  const vida = Math.max(10, Math.round(f.vida * (1 + maisVida / 100) * (1 + (efeito?.lacaioVidaPct ?? 0) / 100)));
  const golpe = f.dano * (1 + maisDano / 100) * (1 + (efeito?.lacaioDanoPct ?? 0) / 100);
  if (duracao) duracao = Math.round(duracao * (1 + (efeito?.duracaoPct ?? 0) / 100));
  return {
    tipo: totem ? 'totem' : 'lacaio', nome: totem ? (/totem/i.test(t.nome) ? t.nome : `Totem de ${t.nome}`) : nome, maximo: Math.max(1, maximo), porUso: Math.max(1, Math.min(porUso, maximo)), duracaoMs: duracao, nivel: n,
    vida, dano: { min: Math.max(1, Math.round(golpe * 0.8)), max: Math.max(1, Math.round(golpe * 1.2)) }, intervaloMs: Math.round(f.tempo * 1000), elemento: r.elemento,
    // O desenho pelo nome do lacaio e o da gema ("Golem" + "Convocar Golem de Chamas").
    desenho: desenhoDe(`${nome} ${t.nome}`, r.elemento, totem),
  };
}

export { ehLinhaDeLacaio } from './gemas-poe.mjs';
