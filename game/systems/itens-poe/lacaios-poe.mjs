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
export function oQueInvoca(slug, nivelDaGema = 1, efeito = null, af = null) {
  // `af`: a soma do DONO (`ficha.afPoe`) — os mods do PoE dos lacaios e totens (vida, dano, velocidade, dano somado, máximos…).
  const m0 = (k) => Number(af?.[k]) || 0;
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
  // As HABILIDADES próprias (as linhas da gema): velocidade de ataque, crítico, dano adicionado, sangramento; e os bônus do golem ao dono.
  let velAtaquePct = 0;
  let semprecritico = false;
  let critMult = 0;
  let somado = [0, 0];
  let sangrar = 0;
  const afDono = {};
  let porLacaioFisico = null;
  const soma = (k, v) => { afDono[k] = (afDono[k] ?? 0) + v; };
  for (const l of t.linhas) {
    let m;
    if ((m = l.match(/Lacaios? (?:tem|têm) (\d+(?:\.\d+)?) ?% mais Velocidade de Ataque/i))) velAtaquePct += Number(m[1]);
    if (/Acertos dos Lacaios são sempre Golpes Críticos/i.test(l)) semprecritico = true;
    if ((m = l.match(/Lacaios têm \+(\d+) ?% de Multiplicador de Acerto Crítico/i))) critMult += Number(m[1]);
    if ((m = l.match(/Ataques de Lacaios causam (\d+) a (\d+) de Dano Físico adicional/i))) somado = [somado[0] + Number(m[1]), somado[1] + Number(m[2])];
    if ((m = l.match(/Ataques dos Lacaios têm (\d+) ?% de chance de infligir Sangramento/i))) sangrar = Number(m[1]);
    if ((m = l.match(/Lacaios causam (\d+(?:\.\d+)?) ?% menos Dano/i))) maisDano -= Number(m[1]);
    // O GOLEM ao dono (enquanto vive).
    if ((m = l.match(/^Golens aumentam (\d+(?:\.\d+)?) ?% de Dano/i))) soma('dmg_vs_monsters', Number(m[1]));
    if ((m = l.match(/^Golens aumentam (\d+(?:\.\d+)?) ?% de Chance de Crítico/i))) soma('crit_chance_inc', Number(m[1]));
    if ((m = l.match(/^Golens aumentam (\d+(?:\.\d+)?) ?% de Velocidade de Ataque e Conjuração/i))) { soma('atk_speed', Number(m[1])); soma('cast_speed', Number(m[1])); }
    if ((m = l.match(/^Golens concedem \+?(\d+(?:\.\d+)?) de precisão/i))) soma('accuracy', Number(m[1]));
    if ((m = l.match(/^Golens concedem (\d+(?:\.\d+)?) de Vida Regenerada por segundo/i))) soma('life_regen', Number(m[1]));
    if ((m = l.match(/^Golens concedem (\d+(?:\.\d+)?) de regeneração de mana por segundo/i))) soma('mana_regen', Number(m[1]));
    if ((m = l.match(/^Golens concedem \+ ?(\d+(?:\.\d+)?) ?% de resistência a dano de caos/i))) soma('chaos_res', Number(m[1]));
    if ((m = l.match(/^Golens concedem (\d+(?:\.\d+)?) ?% mais defesas/i))) { soma('armour_pct', Number(m[1])); soma('evasion_pct', Number(m[1])); }
    if ((m = l.match(/^Golens concedem (\d+) a (\d+) de Dano Físico adicional para cada Lacaio Não-Golem/i))) porLacaioFisico = [Number(m[1]), Number(m[2])];
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
  // "+N ao número máximo de Zumbis / Espectros" (peças do PoE).
  if (/zumbi/i.test(nome)) maximo += m0('max_zumbis');
  if (/espectro/i.test(`${nome} ${t.nome}`)) maximo += m0('max_espectros');
  // As OFERENDAS (Osso, Carne, Espírito) e a CONVOCAÇÃO não invocam: dão bônus aos lacaios em campo / chamam todos para perto.
  const en = r.gema.en ?? '';
  if (/Offering/i.test(en)) return { tipo: 'oferenda', nome: t.nome, duracaoMs: duracao ?? 4000, bonus: bonusDaOferenda(t.linhas) };
  if (/^Convocation/i.test(en)) return { tipo: 'convocacao', nome: t.nome, curaPct: Number(t.linhas.map((l) => l.match(/Regenera (\d+(?:\.\d+)?) ?% da Vida por segundo/i)).find(Boolean)?.[1] ?? 0) };
  const n = nivel ?? Math.max(1, t.requer);
  const f = forcaDoNivel(n);
  // (+ a "Vida máxima dos Lacaios aumentada" / "Vida do Totem aumentada" e o "Lacaios causam Dano aumentado" das peças do PoE.)
  const vida = Math.max(10, Math.round(f.vida * (1 + maisVida / 100) * (1 + ((efeito?.lacaioVidaPct ?? 0) + m0(totem ? 'totem_life' : 'minion_life')) / 100)));
  const golpe = f.dano * (1 + maisDano / 100) * (1 + ((efeito?.lacaioDanoPct ?? 0) + m0('minion_dmg')) / 100);
  // O dano SOMADO aos lacaios das peças ("Lacaios causam X a Y de Dano de Fogo adicional"): no golpe deles, como o dano adicionado da gema.
  for (const el of ['physical', 'fire', 'ice', 'energy', 'chaos']) somado = [somado[0] + m0(`minion_added_${el}_min`), somado[1] + m0(`minion_added_${el}_max`)];
  velAtaquePct += m0('minion_atk_speed') + (/mag[oa]|mage|espectro|spectre/i.test(`${nome} ${t.nome}`) ? m0('minion_cast_speed') : 0);
  if (duracao) duracao = Math.round(duracao * (1 + (efeito?.duracaoPct ?? 0) / 100));
  const estilo = estiloDoLacaio(`${nome} ${t.nome} ${en}`, r.elemento);
  return {
    estilo, velAtaquePct, critChance: semprecritico ? 100 : 5, critMult: 1.5 + critMult / 100, somado, sangrar: Math.max(sangrar, m0('minion_chance_sangrar')),
    // Os mods do PoE dos lacaios (o tique deles lê): resistências, dano recebido, regeneração, roubo, movimento, multiplicador degenerativo,
    // chances de Cegar/Provocar/Desacelerar/Envenenar/Incendiar.
    poe: af ? {
      res: m0(totem ? 'totem_res' : 'minion_res'), resCaos: m0('minion_chaos_res'), danoRecebidoPct: m0('lacaios_dano_recebido'), regenPct: m0('minion_regen_pct'), regen: m0('minion_regen'),
      roubo: m0('minion_leech'), movimentoPct: m0('minion_move'), dotMulti: m0('minion_dot_multi'),
      chances: { cegar: m0('minion_chance_cegar'), provocar: m0('minion_chance_provocar'), desacelerar: m0('minion_chance_desacelerar'), envenenar: m0('minion_chance_envenenar'), incendiar: m0('minion_chance_incendiar') },
    } : null,
    afDono: Object.keys(afDono).length ? afDono : null, porLacaioFisico, golem: /golem/i.test(`${nome} ${en}`),
    tipo: totem ? 'totem' : 'lacaio', nome: totem ? (/totem/i.test(t.nome) ? t.nome : `Totem de ${t.nome}`) : nome, maximo: Math.max(1, maximo), porUso: Math.max(1, Math.min(porUso, maximo)), duracaoMs: duracao, nivel: n,
    vida, dano: { min: Math.max(1, Math.round(golpe * 0.8)), max: Math.max(1, Math.round(golpe * 1.2)) }, intervaloMs: Math.round(f.tempo * 1000), elemento: r.elemento,
    // O desenho pelo nome do lacaio e o da gema ("Golem" + "Convocar Golem de Chamas").
    desenho: desenhoDe(`${nome} ${t.nome}`, r.elemento, totem),
  };
}

/**
 * O JEITO de atacar de cada tipo de lacaio (o que o PoE dá a ele): de longe (arqueiro, mago, espectro, sentinela, golens de fogo e de
 * relâmpago) ou de perto, o elemento, o projétil e o impacto (números do client), o golpe de ÁREA a cada N acertos (a pancada do zumbi,
 * o golem de pedra, a explosão do golem de chamas), a velocidade e a AURA (os robôs rastejantes resfriam/eletrizam em volta).
 */
const ESTILOS_DE_LACAIO = [
  [/arqueir|archer|ranged arms|blink arrow|mirror arrow|clone/i, { alcance: 5, projetil: 3, impacto: 10, elemento: 'physical' }],
  [/mag[oa]s?\b|mage/i, { alcance: 5, magia: true, elementos: ['fire', 'ice', 'energy'] }],
  [/espectro|spectre/i, { alcance: 5, projetil: 11, impacto: 18, elemento: 'chaos' }],
  [/sentinela|sentinel|relíquia|relic/i, { alcance: 4, projetil: 31, impacto: 40, elemento: 'physical', area: { cada: 4, efeito: 50 } }],
  [/golem.*(chama|flame)|flame golem/i, { alcance: 5, projetil: 4, impacto: 16, elemento: 'fire', area: { cada: 3, efeito: 7 } }],
  [/golem.*(relâmp|lightning)|lightning golem/i, { alcance: 5, projetil: 36, impacto: 176, elemento: 'energy' }],
  [/golem.*(gelo|ice)|ice golem/i, { alcance: 1, impacto: 44, elemento: 'ice', area: { cada: 4, efeito: 42 } }],
  [/golem.*(caos|chaos)|chaos golem/i, { alcance: 1, impacto: 17, elemento: 'chaos', area: { cada: 3, efeito: 21 } }],
  [/golem.*(pedra|stone)|stone golem/i, { alcance: 1, impacto: 10, elemento: 'physical', area: { cada: 3, efeito: 45 } }],
  [/zumbi|zombie/i, { alcance: 1, impacto: 10, elemento: 'physical', area: { cada: 4, efeito: 45 } }],
  [/espírito furioso|raging spirit/i, { alcance: 1, impacto: 16, elemento: 'fire', rapido: 0.6 }],
  [/ceifador|reaper/i, { alcance: 1, impacto: 215, elemento: 'physical' }],
  [/robô|skitterbot/i, { aura: { raio: 2, efeito: 42, pct: 0.15 }, alcance: 0 }],
];
export function estiloDoLacaio(texto, elemento) {
  const e = ESTILOS_DE_LACAIO.find(([re]) => re.test(texto))?.[1];
  return { alcance: 1, impacto: 10, elemento: elemento ?? 'physical', ...(e ?? {}) };
}

/** Os bônus de uma OFERENDA aos lacaios em campo: velocidade de ataque, crítico, bloqueio, regeneração. */
function bonusDaOferenda(linhas) {
  const b = { velAtaquePct: 0, critInc: 0, critMult: 0, bloqueioPct: 0, regenPct: 0 };
  for (const l of linhas) {
    let m;
    if ((m = l.match(/Velocidade de Ataque dos Lacaios em (\d+)/i))) b.velAtaquePct += Number(m[1]);
    if ((m = l.match(/Chance de Golpe Crítico aumentada em (\d+)/i))) b.critInc += Number(m[1]);
    if ((m = l.match(/\+(\d+) ?% de Multiplicador de Golpe Crítico/i))) b.critMult += Number(m[1]);
    if ((m = l.match(/\+(\d+) ?% de Chance de Bloquear o Dano de Ataques/i))) b.bloqueioPct += Number(m[1]);
    if ((m = l.match(/(\d+(?:\.\d+)?) ?% da Vida Regenerada por Segundo/i))) b.regenPct += Number(m[1]);
  }
  return b;
}

export { ehLinhaDeLacaio } from './gemas-poe.mjs';
