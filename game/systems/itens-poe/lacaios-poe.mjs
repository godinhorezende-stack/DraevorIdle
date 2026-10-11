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
import * as Controle from '../combate/controle.mjs';
import { slugDoNome } from './condicoes-poe.mjs';

const BESTIARY = CATALOGO.bestiary;
/** As palavras de cada tipo de lacaio nos mods das peças (`max_lacaio:golem`, `lacaio_dano:espirito`…). */
const PALAVRA_DO_TIPO = { zumbi: /zumbi|zombie/i, espectro: /espectro|spectre/i, golem: /golem/i, esqueleto: /esqueleto|skeleton/i, totem: /totem/i,
  espirito: /espírito furioso|raging spirit/i, fantasma: /fantasma|phantasm/i, reliquia: /relíquia|relic/i, sagrado: /espírito sagrado|holy/i, arma: /arma animada|animate/i, aranha: /aranha|spider/i,
  // (ciclo 7) os clones da Flecha Ilusória / Flecha Espelhada ("Duração do Arqueiro Ilusório aumentada").
  arqueiro: /arqueir|clone|mirror arrow|blink arrow|flecha (?:ilusória|espelhada)/i, balista: /balista|ballista/i, qualquer: /./ };

// ---- a força de base por nível (a mediana dos monstros comuns da campanha) ----
// PREGUIÇOSA (calculada no primeiro uso e guardada): calcular na carga do módulo lia `CAMPANHA` enquanto `monstros.mjs` ainda carregava,
// quando a cadeia de imports começava por `itens-poe/campanha.mjs` (campanha → monstros → … → lacaios-poe → monstros):
// "ReferenceError: Cannot access 'CAMPANHA' before initialization". Sem áreas ainda (campanha não carregada), não guarda.
let pontosGuardados = null;
function pontos() {
  if (pontosGuardados) return pontosGuardados;
  const calculados = calcularPontos();
  if (calculados.length) pontosGuardados = calculados;
  return calculados;
}
function calcularPontos() {
  const por = new Map();
  for (const a of Object.values(CAMPANHA.areas ?? {})) for (const m of a.monstros ?? []) {
    if (m.unico || !(m.vida > 0) || !(m.nivel > 0)) continue;
    if (!por.has(m.nivel)) por.set(m.nivel, []);
    por.get(m.nivel).push(m);
  }
  const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  return [...por.entries()].sort((a, b) => a[0] - b[0]).map(([n, ms]) => ({ n, vida: med(ms.map((m) => m.vida)), dano: med(ms.map((m) => m.dano ?? 1)), tempo: med(ms.map((m) => m.tempoAtaque ?? 1.2)) }));
}
/** A vida, o dano por golpe e o tempo de ataque (s) de um monstro comum do nível `n` (interpolado entre os da campanha). */
export function forcaDoNivel(n) {
  const PONTOS = pontos();
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
  // "+N ao número máximo de Zumbis / Espectros / Golens / Esqueletos / Totens…" (peças do PoE): `max_lacaio:<palavra>`.
  if (/zumbi/i.test(nome)) maximo += m0('max_zumbis');
  if (/espectro/i.test(`${nome} ${t.nome}`)) maximo += m0('max_espectros');
  const texto = `${nome} ${t.nome} ${r.gema?.en ?? ''}`;
  const porTipo = (campo) => Object.entries(af ?? {}).reduce((n, [k, v]) => { const m = new RegExp(`^${campo}:(\\w+)$`).exec(k); return n + (m && typeof v === 'number' && PALAVRA_DO_TIPO[m[1]]?.test(totem && m[1] === 'totem' ? 'totem' : texto) ? v : 0); }, 0);
  maximo += porTipo('max_lacaio');
  // (11/10, os únicos:) o máximo de UMA gema de totem ("Balista Estilhaçante tem +1 ao número máximo de Totens Convocados por cada 25 de
  // Força" — `max_totem_gema:<nome>`) e o teto por tipo ("Você não pode ter mais de N totens invocados do mesmo tipo").
  if (totem) {
    maximo += m0(`max_totem_gema:${slugDoNome(t.nome)}`);
    if (m0('max_totem_mesmo_tipo') > 0) maximo = Math.min(maximo, m0('max_totem_mesmo_tipo'));
  }
  // "Número máximo de Zumbis Erguidos reduzido em X%" (o % do máximo).
  maximo = Math.max(1, Math.round(maximo * (1 + porTipo('max_lacaio_pct') / 100)));
  // As OFERENDAS (Osso, Carne, Espírito) e a CONVOCAÇÃO não invocam: dão bônus aos lacaios em campo / chamam todos para perto.
  const en = r.gema.en ?? '';
  if (/Offering/i.test(en)) return { tipo: 'oferenda', nome: t.nome, duracaoMs: duracao ?? 4000, bonus: bonusDaOferenda(t.linhas) };
  if (/^Convocation/i.test(en)) return { tipo: 'convocacao', nome: t.nome, curaPct: Number(t.linhas.map((l) => l.match(/Regenera (\d+(?:\.\d+)?) ?% da Vida por segundo/i)).find(Boolean)?.[1] ?? 0) };
  const n = nivel ?? Math.max(1, t.requer);
  const f = forcaDoNivel(n);
  // (+ a "Vida máxima dos Lacaios aumentada" / "Vida do Totem aumentada" e o "Lacaios causam Dano aumentado" das peças do PoE.)
  // (+ os do TIPO de lacaio: "Golens possuem X% menos Vida", "Espíritos Furiosos Convocados causam Dano aumentado", "Zumbis têm X% da Vida
  // máxima aumentada", "Zumbis causam X% mais Dano Físico", "+N de Vida máxima" dos Zumbis…)
  // (ciclo 7: + o "Lacaios tem X% mais Vida Máxima" da árvore — `lacaio_vida_mais:<tipo>`, multiplica.)
  const vida = Math.max(10, Math.round((f.vida + porTipo('lacaio_vida_fixa')) * (1 + maisVida / 100) * (1 + ((efeito?.lacaioVidaPct ?? 0) + m0(totem ? 'totem_life' : 'minion_life') + porTipo('lacaio_vida')) / 100) * Math.max(0, 1 + porTipo('lacaio_vida_mais') / 100)));
  // ("Lacaios ganham X% do Dano Físico / Elemental como Dano de Caos/Fogo Extra" — dono, 11/10: os únicos: o extra entra no golpe do lacaio
  // do tipo certo — o físico no lacaio físico, o elemental no de Fogo/Gelo/Raio —, sem a resistência do outro elemento.)
  const fisico = (r.elemento ?? 'physical') === 'physical';
  const extra = 1 + (fisico ? m0('minion_phys_as_extra') : ['fire', 'ice', 'energy'].includes(r.elemento) ? m0('minion_elem_as_extra') : 0) / 100;
  const golpe = f.dano * (1 + maisDano / 100) * (1 + ((efeito?.lacaioDanoPct ?? 0) + m0('minion_dmg') + porTipo('lacaio_dano')) / 100) * Math.max(0, 1 + porTipo('lacaio_mais_dano') / 100) * extra;
  // O dano SOMADO aos lacaios das peças ("Lacaios causam X a Y de Dano de Fogo adicional"): no golpe deles, como o dano adicionado da gema.
  for (const el of ['physical', 'fire', 'ice', 'energy', 'chaos']) somado = [somado[0] + m0(`minion_added_${el}_min`), somado[1] + m0(`minion_added_${el}_max`)];
  // (+ o do TIPO: "Golens têm X a Y de Dano Físico de Ataques Adicional".)
  somado = [somado[0] + porTipo('lacaio_somado_min'), somado[1] + porTipo('lacaio_somado_max')];
  velAtaquePct += m0('minion_atk_speed') + (/mag[oa]|mage|espectro|spectre/i.test(`${nome} ${t.nome}`) ? m0('minion_cast_speed') : 0);
  if (duracao) duracao = Math.round(duracao * (1 + ((efeito?.duracaoPct ?? 0) + porTipo('lacaio_duracao') + m0('minion_duracao')) / 100));
  velAtaquePct += porTipo('lacaio_vel_ataque');
  // (ciclo 7, lote F) "Magias Conjuradas por Totens têm X% de Velocidade de Conjuração aumentada" (o totem de uma gema de Magia).
  if (totem && (r.gema?.tags ?? []).includes('Magia')) velAtaquePct += m0('totem_vel_magia');
  const estilo = estiloDoLacaio(`${nome} ${t.nome} ${en}`, r.elemento);
  // A CONVERSÃO do dano Físico do golpe (dono, 11/10: os únicos): "Lacaios convertem X% do Dano Físico para Dano de Gelo" (por Encaixe da cor,
  // com a escala), e o AVATAR DO FOGO de um tipo ("Zumbis Erguidos têm Avatar do Fogo": 50% do Físico vira Fogo e o resto não causa dano).
  // `soDano`: só esse elemento causa dano ("Lacaios não causam Dano Não-Gélido").
  const conversao = { fire: m0('minion_conv_fire') + (porTipo('lacaio_so_fogo') > 0 ? 50 : 0) + porTipo('lacaio_conv_fogo'), ice: m0('minion_conv_ice'), energy: m0('minion_conv_energy'), chaos: m0('minion_conv_chaos') };
  const soDano = m0('minion_so_gelo') > 0 ? 'ice' : porTipo('lacaio_so_fogo') > 0 ? 'fire' : null;
  // A RESTRIÇÃO das peças ("Você não pode ter Lacaios não-Golens / Não-Espectrais", "…que não sejam animados"): o lacaio de outro tipo não vem.
  const permitidos = Object.entries(af ?? {}).filter(([k, v]) => /^so_lacaio:\w+$/.test(k) && v > 0).map(([k]) => k.split(':')[1]);
  const proibido = !totem && permitidos.length && !permitidos.some((tp) => PALAVRA_DO_TIPO[tp]?.test(texto)) ? `Um item equipado não deixa ter este lacaio (só: ${permitidos.join(', ')}).` : null;
  return {
    estilo, velAtaquePct, critChance: (semprecritico ? 100 : 5) * (1 + m0('minion_crit_inc') / 100), critChanceBase: semprecritico ? 100 : 5, critMult: 1.5 + critMult / 100, somado, sangrar: Math.max(sangrar, m0('minion_chance_sangrar')),
    ...(Object.values(conversao).some((v) => v > 0) || soDano ? { conversao, soDano } : {}),
    ...(proibido ? { proibido } : {}),
    // Os mods do PoE dos lacaios (o tique deles lê): resistências, dano recebido, regeneração, roubo, movimento, multiplicador degenerativo,
    // chances de Cegar/Provocar/Desacelerar/Envenenar/Incendiar.
    poe: af ? {
      res: m0(totem ? 'totem_res' : 'minion_res'), resCaos: m0('minion_chaos_res'), danoRecebidoPct: m0('lacaios_dano_recebido'), regenPct: m0('minion_regen_pct'), regen: m0('minion_regen'),
      roubo: m0('minion_leech'), movimentoPct: m0('minion_move') + porTipo('lacaio_mov'), dotMulti: m0('minion_dot_multi'), degenPct: porTipo('lacaio_degen'),
      bloqueio: m0('minion_block'), resFogo: m0('minion_fire_res'), resGelo: m0('minion_ice_res'),
      chances: { cegar: m0('minion_chance_cegar'), provocar: m0('minion_chance_provocar'), desacelerar: m0('minion_chance_desacelerar'), envenenar: m0('minion_chance_envenenar'), incendiar: m0('minion_chance_incendiar') + porTipo('lacaio_incendiar'),
        definhar: m0('minion_chance_definhar'), cinzas: porTipo('lacaio_cinzas') },
      // (11/10, os únicos:) a vida recuperada ao bloquear e ao matar um envenenado; a duração renovada no acerto em Raro/Único; o dano drenado
      // como vida para o DONO; a explosão do inimigo morto pelo acerto dele (% da vida do morto).
      vidaAoBloquear: m0('minion_vida_ao_bloquear'), vidaAoMatarEnvenenado: m0('minion_vida_ao_matar_envenenado'), renova: porTipo('lacaio_renova'),
      drenoDono: porTipo('lacaio_dreno_dono'), explodir: porTipo('lacaio_explodir'),
      // (ciclo 7, a árvore) o crítico, a área, a recarga, o bloqueio mágico, a redução física, o escudo, o máximo das resistências, a
      // recuperação, os buffs ao matar, o dano dobrado, ignorar a redução física, a penetração nos amaldiçoados, a vida na morte de outro
      // lacaio, o dreno para o dono — `aplicarNoLacaio`, `golpeDoLacaio`, `danoNoLacaio`, `aoMatarDoLacaio`.
      critInc: m0('minion_crit_inc'), critMult: m0('minion_crit_mult'), areaPct: m0('minion_area'), recargaPct: m0('minion_cdr'),
      bloqueioMagico: m0('minion_spell_block'), reducaoFisica: m0('minion_phys_red') + (totem ? m0('totem_phys_red') : 0), esDaVidaPct: m0('minion_es_da_vida'), resMax: m0('minion_res_max'),
      recuperacaoPct: m0('minion_recuperacao'), vidaNaMorteDeLacaioPct: m0('minion_vida_na_morte_lacaio'),
      danoDobrado: m0('minion_dano_dobrado'), ignoraReducaoFisica: m0('minion_ignora_reducao_fisica'), penAmaldicoados: m0('minion_pen_amaldicoados'),
      drenoParaODono: m0('minion_dreno_dono'), poderProfano: m0('minion_poder_profano'), explodeVidaBaixaPct: m0('minion_explode_vida_baixa'),
      imuneElemental: porTipo('lacaio_imune_elemental') > 0,
      // (11/10) "A Velocidade de Ação dos Totens não pode ser modificada para abaixo do valor base" (`controleNoLacaio`).
      semLentidao: totem && m0('totem_sem_lentidao') > 0,
      aoMatar: { poderProfano: [m0('minion_poder_profano_ao_matar'), m0('minion_poder_profano_s') || 4], agressividade: [m0('minion_agressividade_ao_matar'), m0('minion_agressividade_s') || 4] },
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

// ---------------------------------------------------------------- (ciclo 7) os mods da árvore no combate do lacaio
// Os números do PoE: Poder Profano = 100% do Dano Físico como Caos extra (`BUFFS.poderProfano`); Agressividade = 20% de Velocidade de Ataque.
const AGRESSIVIDADE_PCT = 20;
/** O lacaio recém-invocado com os mods do dono: o Escudo de Energia ("ganham X% da Vida Máxima como Escudo de Energia"). */
export function aplicarNoLacaio(l) {
  const p = l?.poe;
  if (!p?.esDaVidaPct) return l;
  l.maxEs = Math.round((l.maxHp * p.esDaVidaPct) / 100);
  l.es = l.maxEs;
  return l;
}
/** Um buff do lacaio (Poder Profano, Agressividade) ativo agora? */
export const buffDoLacaio = (l, nome, agora) => (nome === 'poderProfano' && (l?.poe?.poderProfano ?? 0) > 0) || (l?.buffs?.[nome] ?? 0) > agora;
/** A velocidade de ataque a mais do lacaio agora (%): a Agressividade. */
export const velocidadeDoLacaio = (l, agora) => (buffDoLacaio(l, 'agressividade', agora) ? AGRESSIVIDADE_PCT : 0);
/**
 * (11/10) A LENTIDÃO nos lacaios e totens: o golpe de um Elite/Chefe pode deixá-los lentos, como faz com você (`combate/controle.json`: a chance
 * e o peso da lentidão de cada classe, a lentidão e a duração do jogador). "A Velocidade de Ação dos Totens não pode ser modificada para abaixo
 * do valor base": o totem não fica lento (`poe.semLentidao`). Devolve true se pôs.
 */
export function controleNoLacaio(l, bicho, hunt, agora, rng = Math.random) {
  if (!l || l.poe?.semLentidao) return false;
  const classe = Controle.classeDoMob(bicho, !!hunt?.isBoss);
  const cfg = classe ? Controle.CONFIG.mobs[classe] : null;
  const pesos = cfg?.efeitos ?? {};
  const total = Object.values(pesos).reduce((n, p) => n + p, 0);
  if (!(pesos.lento > 0) || !(rng() * 100 < (cfg.chance * pesos.lento) / total)) return false;
  const ate = agora + Controle.CONFIG.jogador.duracaoMs.lento;
  l.lento = { ate: Math.max(l.lento?.ate ?? 0, ate), pct: Math.min(Controle.CONFIG.jogador.lentidaoMaxima, cfg.lentidaoPct ?? 30) };
  return true;
}
/** Quanto o lacaio LENTO demora a mais no golpe (1 = normal). */
export const fatorDeLentidao = (l, agora) => (l?.lento?.ate > agora && !l.poe?.semLentidao ? 1 / (1 - l.lento.pct / 100) : 1);
/** A chance de crítico (%) e o multiplicador do golpe do lacaio, com os da árvore ("Lacaios têm Chance de Acerto Crítico aumentada", "+X% de Multiplicador"). */
export function criticoDoLacaio(l, oferenda = null) {
  const p = l?.poe ?? {};
  // (a "Chance de Crítico dos Lacaios aumentada" sobre a BASE — `critChanceBase`, a chance sem ela; `critChance` já a traz: `oQueInvoca`)
  const chance = Math.min(100, (l?.critChanceBase ?? l?.critChance ?? 5) * (1 + ((oferenda?.critInc ?? 0) + (p.critInc ?? 0)) / 100));
  const mult = (l?.critMult ?? 1.5) + ((oferenda?.critMult ?? 0) + (p.critMult ?? 0)) / 100;
  return { chance, mult };
}
/**
 * O golpe do lacaio no `alvo` com os mods do dono: o fator (dano dobrado), a ficha para a resistência (ignora a Redução de Dano Físico,
 * penetra as resistências elementais do amaldiçoado) e o Caos extra do Poder Profano. `{ fator, ficha, caosExtra }`.
 */
export function golpeDoLacaio(l, alvo, fichaDoDono, tipo, agora, rng = Math.random) {
  const p = l?.poe ?? {};
  let ficha = fichaDoDono;
  if (tipo === 'physical' && p.ignoraReducaoFisica > 0 && rng() * 100 < p.ignoraReducaoFisica) ficha = { ...ficha, ignoraReducaoFisica: true };
  const amaldicoado = Object.values(alvo?.maldicoes ?? {}).some((m) => (m?.ate ?? 0) > agora) || (alvo?.estados?.amaldicoado?.ate ?? 0) > agora;
  if (amaldicoado && p.penAmaldicoados > 0 && ['fire', 'ice', 'energy'].includes(tipo)) {
    const pen = ficha?.penetracao ?? { fisica: 0, elemental: 0, porElemento: {} };
    ficha = { ...ficha, penetracao: { ...pen, elemental: Math.min(100, (pen.elemental ?? 0) + p.penAmaldicoados) } };
  }
  const fator = p.danoDobrado > 0 && rng() * 100 < p.danoDobrado ? 2 : 1;
  const caosExtra = tipo === 'physical' && buffDoLacaio(l, 'poderProfano', agora) ? 1 : 0;
  return { fator, ficha, caosExtra };
}
/** A área do golpe em área do lacaio, em casas de raio: 1 + a cada 25% de "Efeito em Área" (a fração como chance), como a das gemas. */
export function raioDaAreaDoLacaio(l, rng = Math.random) {
  const casas = 1 + (l?.poe?.areaPct ?? 0) / 25;
  return Math.max(1, Math.trunc(casas) + (rng() < Math.abs(casas % 1) ? 1 : 0));
}
/** O intervalo de uma magia/habilidade do lacaio com a "Recuperação da Recarga" dele. */
export const recargaDoLacaio = (l, ms) => Math.round(ms / Math.max(0.1, 1 + (l?.poe?.recargaPct ?? 0) / 100));
/** A recuperação de vida do lacaio (regeneração, roubo): × (1 + recuperação%) — "Lacaios têm Recuperação de Vida reduzida em X%". */
export const recuperacaoDoLacaio = (l, quanto) => quanto * Math.max(0, 1 + (l?.poe?.recuperacaoPct ?? 0) / 100);
/** Cura o lacaio (com a recuperação dele). */
export function curarLacaio(l, quanto) {
  if (!(quanto > 0) || !(l?.hp > 0)) return;
  l.hp = Math.min(l.maxHp, l.hp + recuperacaoDoLacaio(l, quanto));
}
/**
 * O dano que um bicho causa no lacaio, com as defesas da árvore: o bloqueio mágico (a parte das magias do bicho), a Redução de Dano Físico
 * (na parte física), o máximo das resistências elementais (`resMax`) e o escudo antes da vida. `fisico`: a parte física do golpe;
 * `porElemento`: `[{ elemento, valor }]` as outras partes já sem resistência; `magia`: o golpe é de magia. Devolve `{ dano, bloqueou }`.
 */
export function danoNoLacaio(l, { fisico = 0, outros = 0, magia = false, rng = Math.random } = {}) {
  const p = l?.poe ?? {};
  if (magia && p.bloqueioMagico > 0 && rng() * 100 < p.bloqueioMagico) {
    if (p.vidaAoBloquear > 0) curarLacaio(l, (l.maxHp * p.vidaAoBloquear) / 100);
    return { dano: 0, bloqueou: true };
  }
  const red = Math.min(90, Math.max(0, p.reducaoFisica ?? 0));
  let dano = fisico * (1 - red / 100) + outros;
  if (l.es > 0) {
    const absorvido = Math.min(l.es, dano);
    l.es -= absorvido;
    dano -= absorvido;
  }
  l.esEspera = 2000;
  return { dano, bloqueou: false };
}
/** O teto da resistência elemental do lacaio (75 + "X% de máximo de todas as Resistências Elementais"). */
export const tetoDaResDoLacaio = (l) => Math.min(90, 75 + (l?.poe?.resMax ?? 0));
/** O escudo do lacaio recarrega (20%/s, depois de 2 s sem dano — a regra do escudo dos monstros do PoE). `ms`: o tique. */
export function recarregarEscudoDoLacaio(l, ms) {
  if (!(l?.maxEs > 0)) return;
  if ((l.esEspera ?? 0) > 0) { l.esEspera -= ms; return; }
  l.es = Math.min(l.maxEs, (l.es ?? 0) + (l.maxEs * 0.2 * ms) / 1000);
}
/**
 * A INSTABILIDADE DO LACAIO (a keystone): o lacaio em Vida Baixa (metade ou menos) explode — X% da vida máxima dele como Dano de Fogo nos
 * bichos a até 1 casa — e morre. Devolve os bichos atingidos `[{ m, dano }]` (o dano antes da resistência; quem chama resiste e mostra).
 */
export function explosaoDoLacaio(l, monstros = []) {
  const pct = l?.poe?.explodeVidaBaixaPct ?? 0;
  if (!(pct > 0) || !(l.hp > 0) || l.hp > l.maxHp * 0.5) return null;
  const dano = (l.maxHp * pct) / 100;
  l.hp = 0;
  return monstros.filter((m) => m.hp > 0 && !m.dummy && Math.max(Math.abs(m.x - l.x), Math.abs(m.y - l.y)) <= 1).map((m) => ({ m, dano }));
}
/** O lacaio matou um bicho: os buffs ao matar ("X% de chance de ganhar Poder Profano / Agressividade por N segundos ao Matar"). */
export function aoMatarDoLacaio(l, agora, rng = Math.random) {
  const a = l?.poe?.aoMatar;
  if (!a) return;
  for (const [nome, [chance, seg]] of Object.entries(a)) if (chance > 0 && rng() * 100 < chance) (l.buffs ??= {})[nome] = Math.max(l.buffs[nome] ?? 0, agora + seg * 1000);
}
/** Um lacaio morreu: os outros recuperam X% da vida ("Lacaios Recuperam X% de Vida na Morte de Lacaios"). */
export function naMorteDeUmLacaio(vivos) {
  for (const l of vivos) if (l.poe?.vidaNaMorteDeLacaioPct > 0) curarLacaio(l, (l.maxHp * l.poe.vidaNaMorteDeLacaioPct) / 100);
}
