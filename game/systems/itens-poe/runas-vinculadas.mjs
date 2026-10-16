// As RUNAS (as Brands do PoE: Runa Tempestuosa, do Armagedom, da Penitência, da Maré Invernal) PRESAS AO INIMIGO (dono, 12/10: "Runas e
// Vínculos presos ao alvo"). Só no modo PoE.
//
// Antes a Runa disparava na hora, no alvo. Agora ela fica: `hunt.runas` (JSON puro, relógio da caçada) — a regra do PoE:
//   - conjurada, a Runa se VINCULA ao inimigo (o alvo; a até 3 casas — × "Alcance do Vínculo de Runas aumentado") e é Ativada na hora e
//     depois a cada "É Ativado a cada N segundos enquanto Vinculado" da gema (÷ a Velocidade de Conjuração — "Aumentos e Reduções à
//     Velocidade de Conjuração também se aplicam à frequência de Ativação"), sempre no lugar do inimigo (a habilidade sai de lá —
//     `acoes.dispararSemMarcar` com `plantada`);
//   - vinculada por até "Pode ser Vinculada por uma Duração total de N segundos" (5 s); o inimigo morre: ela SOLTA e procura outro no
//     alcance, e solta conta até "Pode ser Desvinculada por uma Duração total de N segundos" (6 s) — as duas × a Duração de Habilidades;
//   - até 3 Runas ativas no total, de todas as gemas ("Você pode Conjurar N Runas Adicionais" — a mais velha sai); 1 Runa vinculada por
//     inimigo ("Você pode ter uma Marca adicional Vinculada à um Inimigo"; a Runa da Maré Invernal: "Pode ter 1 Runas adicionais Vinculadas");
//   - "Vincula a um novo Inimigo após ser Ativada, não mais que uma vez a cada N segundos" (a da gema e a da árvore) e "É Ativado uma vez
//     quando Vinculada, então é Destruída".
import { ligado } from './catalogo.mjs';

export const PADRAO = { maximo: 3, porInimigo: 1, alcance: 3, vinculadaMs: 5000, soltaMs: 6000, intervaloMs: 1000 };

const v = (ficha, k) => Number(ficha?.afPoe?.[k]) || 0;
const distancia = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const segundos = (s) => Math.round(parseFloat(String(s).replace(',', '.')) * 1000);

/** A gema é uma Runa (Brand) do PoE? (o arquétipo `marca` do compilador), só no modo PoE. */
export const ehRuna = (entry) => ligado() && entry?.poeGema?.arquetipo === 'marca';

/** O que a gema diz da Runa (as linhas do nível): a ativação, as durações, a troca de alvo e o vínculo a mais por inimigo. */
export function daGema(linhas = []) {
  const t = linhas.map(String);
  const achar = (re) => t.map((l) => re.exec(l)).find(Boolean);
  const cada = achar(/É Ativado a cada (\d+(?:[.,]\d+)?)?\s*segundos?/i);
  const vinculada = achar(/Pode ser Vinculada por uma Duração total de (\d+(?:[.,]\d+)?) segundos?/i);
  const solta = achar(/Pode ser Desvinculada por uma Duração total de (\d+(?:[.,]\d+)?) segundos?/i);
  const troca = achar(/Vincula a um novo Inimigo após ser Ativada, não mais que uma vez a cada (\d+(?:[.,]\d+)?) segundos?/i);
  const mais = achar(/Pode ter (\d+) Runas? adiciona(?:l|is) Vinculadas? a um Inimigo/i);
  return {
    intervaloMs: cada ? (cada[1] ? segundos(cada[1]) : 1000) : PADRAO.intervaloMs,
    unica: t.some((l) => /É Ativado uma vez quando Vinculada, então é Destruída/i.test(l)),
    vinculadaMs: vinculada ? segundos(vinculada[1]) : PADRAO.vinculadaMs,
    soltaMs: solta ? segundos(solta[1]) : PADRAO.soltaMs,
    trocaMs: troca ? segundos(troca[1]) : null,
    porInimigoExtra: mais ? Number(mais[1]) : 0,
  };
}

/** Quantas Runas cabem ativas de uma vez (todas as gemas juntas). */
export const maximo = (ficha) => PADRAO.maximo + v(ficha, 'runas_extras');
/** O alcance do vínculo (casas). */
export const alcance = (ficha) => Math.max(1, Math.round(PADRAO.alcance * Math.max(0.1, 1 + v(ficha, 'alcance_vinculo_runas') / 100)));
/** Quantas Runas podem estar vinculadas a um mesmo inimigo (desta Runa). */
export const porInimigo = (ficha, r) => PADRAO.porInimigo + v(ficha, 'runas_por_inimigo_extra') + (r?.porInimigoExtra ?? 0);

/** As Runas ativas agora. */
export const ativas = (hunt) => hunt?.runas ?? [];
/** Quantas Runas suas estão vinculadas ao inimigo `uid`. */
export const vinculadasA = (hunt, uid) => ativas(hunt).filter((r) => r.alvo === uid).length;

/** O que falta da Runa (ms): vinculada, o que resta da duração vinculada; solta, o da solta. */
export const resta = (r) => (r.alvo != null ? r.vinculadaMs - r.vinculadaPassou : r.soltaMs - r.soltaPassou);

/** As Runas estão todas em campo e nenhuma acaba em 1 s? (o automático não conjura outra à toa) */
export const cheias = (hunt, ficha) => ativas(hunt).length >= maximo(ficha) && ativas(hunt).every((r) => resta(r) > 1000);

/**
 * Conjura uma Runa no lugar (`x`, `y`) — com a gema (`props`: `daGema`), o intervalo já com a velocidade de conjuração (`intervaloMs`) e
 * as durações com a Duração de Habilidades (`fatorDaDuracao`). Passou do máximo: a mais velha sai. Devolve a Runa (solta: o tique a vincula).
 */
export function conjurar(hunt, ficha, { acao, slot, x, y, z = hunt?.z ?? 0, props, intervaloMs, fatorDaDuracao = 1, agora = hunt?.clock ?? 0 }) {
  const lista = [...ativas(hunt)];
  while (lista.length >= maximo(ficha)) lista.shift();
  hunt.runasN = (hunt.runasN ?? 0) + 1;
  const r = {
    id: `runa-${hunt.runasN}`, acao, slot, x, y, z, desde: agora, em: agora, alvo: null,
    intervaloMs: Math.max(50, Math.round(intervaloMs ?? props.intervaloMs)), unica: !!props.unica,
    vinculadaMs: Math.round(props.vinculadaMs * fatorDaDuracao), soltaMs: Math.round(props.soltaMs * fatorDaDuracao), vinculadaPassou: 0, soltaPassou: 0,
    ...(props.trocaMs != null ? { trocaMs: props.trocaMs } : {}), ...(props.porInimigoExtra ? { porInimigoExtra: props.porInimigoExtra } : {}),
  };
  lista.push(r);
  hunt.runas = lista;
  return r;
}

/** Vincula a Runa ao inimigo vivo mais perto no alcance que ainda tem vaga (`fora`: um uid para pular — a troca de alvo). */
export function vincular(hunt, ficha, r, agora = hunt?.clock ?? 0, { preferido = null, fora = null } = {}) {
  const raio = alcance(ficha);
  const cabe = (b) => b && b.hp > 0 && !b.dummy && b.uid !== fora && !(b.z != null && r.z != null && b.z !== r.z) && distancia(b, r) <= raio && vinculadasA(hunt, b.uid) < porInimigo(ficha, r);
  let alvo = cabe(preferido) ? preferido : null;
  if (!alvo) {
    let melhor = Infinity;
    for (const b of hunt.monstros ?? []) if (cabe(b) && distancia(b, r) < melhor) { melhor = distancia(b, r); alvo = b; }
  }
  if (!alvo) return null;
  Object.assign(r, { alvo: alvo.uid, x: alvo.x, y: alvo.y, proxima: agora });
  return alvo;
}

/**
 * Um tique das Runas: vinculadas seguem o inimigo e contam a duração vinculada; o inimigo morreu, soltam e procuram outro; soltas contam a
 * duração solta. Devolve `{ ativar: [{ r, alvo, areaPct }], expiradas: [{ r, vinculada }] }` — as que são Ativadas agora (no lugar do
 * inimigo; `areaPct`: o "aumentado" do "Runas têm Área de Efeito aumentada em X% caso Y% da Duração do Vínculo tenha expirado" — lote 36: o
 * raio cresce × √ com o resto da Área de Efeito, no `disparar`) e as que
 * acabaram (`vinculada`: acabou vinculada — "Recupera X% de Mana quando uma Runa expira enquanto Vinculada").
 */
export function tique(hunt, ficha, agora = hunt?.clock ?? 0) {
  const ativar = [];
  const expiradas = [];
  if (!hunt?.runas?.length) return { ativar, expiradas };
  const porUid = new Map((hunt.monstros ?? []).map((b) => [b.uid, b]));
  const freqPct = v(ficha, 'runa_frequencia_tardia_pct');
  const freqApos = v(ficha, 'runa_frequencia_tardia_apos') || 75;
  const areaPct = v(ficha, 'runa_area_tardia_pct');
  const areaApos = v(ficha, 'runa_area_tardia_apos') || 50;
  const trocaDaArvore = v(ficha, 'runas_trocam_alvo_s');
  for (const r of [...hunt.runas]) {
    const dt = Math.max(0, agora - (r.em ?? agora));
    r.em = agora;
    let alvo = r.alvo != null ? porUid.get(r.alvo) : null;
    if (r.alvo != null && !(alvo?.hp > 0)) { r.alvo = null; alvo = null; }
    if (alvo) {
      r.x = alvo.x;
      r.y = alvo.y;
      r.vinculadaPassou += dt;
      if (r.vinculadaPassou >= r.vinculadaMs) { expiradas.push({ r, vinculada: true }); continue; }
    } else {
      r.soltaPassou += dt;
      if (r.soltaPassou >= r.soltaMs) { expiradas.push({ r, vinculada: false }); continue; }
      alvo = vincular(hunt, ficha, r, agora);
      if (!alvo) continue;
    }
    if (agora < (r.proxima ?? agora)) continue;
    const fracao = r.vinculadaPassou / Math.max(1, r.vinculadaMs);
    ativar.push({ r, alvo, areaPct: areaPct > 0 && fracao >= areaApos / 100 ? areaPct : 0 });
    // ("Runas têm 100% mais Frequência de Ativação se 75% da Duração de Vínculo houver expirado": o intervalo ÷ 2.)
    const mais = freqPct > 0 && fracao >= freqApos / 100 ? 1 + freqPct / 100 : 1;
    r.proxima = agora + Math.round(r.intervaloMs / mais);
    if (r.unica) { expiradas.push({ r, vinculada: true, destruida: true }); continue; }
    // A troca de alvo: o da gema (Runa Tempestuosa da Indecisão) ou o da árvore ("Runas se Vinculam a um novo Inimigo cada vez que se Ativam").
    const trocaMs = r.trocaMs ?? (trocaDaArvore > 0 ? trocaDaArvore * 1000 : null);
    if (trocaMs != null && agora - (r.trocouEm ?? -Infinity) >= trocaMs) {
      const antes = r.alvo;
      r.alvo = null;
      if (vincular(hunt, ficha, r, agora, { fora: antes })) { r.trocouEm = agora; r.proxima = agora + Math.round(r.intervaloMs / mais); }
      else Object.assign(r, { alvo: antes });
    }
  }
  const fora = new Set(expiradas.map((x) => x.r));
  hunt.runas = hunt.runas.filter((r) => !fora.has(r));
  marcarNosInimigos(hunt);
  return { ativar, expiradas };
}

/** Quantas Runas suas estão vinculadas a cada inimigo (`m.runasVinculadas` — "Inimigos sofrem Dano aumentado em X% para cada uma…"). */
export function marcarNosInimigos(hunt) {
  const n = new Map();
  for (const r of ativas(hunt)) if (r.alvo != null) n.set(r.alvo, (n.get(r.alvo) ?? 0) + 1);
  for (const b of hunt.monstros ?? []) {
    if (n.has(b.uid)) b.runasVinculadas = n.get(b.uid);
    else if (b.runasVinculadas) delete b.runasVinculadas;
  }
}
