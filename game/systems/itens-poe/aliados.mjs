// "VOCÊ E ALIADOS" do PoE (dono, 13/10: "pode seguir com os aliados de verdade"). Igual ao PoE 3.29 (o Path of Building trata assim):
//
//   "Você e Aliados (próximos) <efeito>" é uma AURA do próprio nó/item (`ExtraAura`): vale em você e nos aliados perto — os companheiros da
//     party na mesma sala e os seus lacaios. A mesma aura vinda de duas pessoas não acumula: vale a maior. No jogo a chave é `aliados:<stat>`
//     (a condição é a de quem dá: "Caso tenha Empalado um Inimigo Recentemente…" vale enquanto ELE empalou há pouco — o `resolver` da ficha
//     dele já resolve).
//   "Auras das suas Habilidades concedem X% … para você e Aliados" (`addToAura`) vai DENTRO de cada aura de gema ligada: em você, X por aura;
//     no aliado, X por aura sua que o alcança (o raio da aura).
//   "Aliados Próximos contam como tendo Fortificação igual a sua" (o Campeão): o aliado perto usa a sua Fortificação, se for maior.
//   A Ichimonji: "Os Buffs das Suas Auras não afetam aliados", "Buffs de Auras Aliadas não afetam você".
//
// O que um personagem dá aos outros vai como FOTO no tique (`hunt.aliados`, JSON — da ficha dele): a soma da ficha de quem recebe só lê a foto
// (sem ficha cruzada), como os Vínculos.

export const PREFIXO = 'aliados:';
/** (13/10, o Inspirador) "Você e Aliados próximos dos seus Estandartes": `aliados_estandarte:<stat>` — os aliados na área do Estandarte plantado. */
export const PREFIXO_DO_ESTANDARTE = 'aliados_estandarte:';
export const PADRAO = Object.freeze({
  /** "Aliados próximos": a até 3 casas de quem dá (a mesma distância dos "próximos" do jogo — Vínculos, Minas). */
  raio: 3,
});

const n = (af, k) => Number(af?.[k]) || 0;
/** As auras de gema do PoE ligadas agora (`hunt.buffs`, tipo `poe-aura`). */
export function aurasLigadas(hunt, agora = hunt?.clock ?? 0) {
  return Object.entries(hunt?.buffs ?? {}).filter(([, b]) => b?.tipo === 'poe-aura' && b.ate > agora);
}
const distancia = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/** Os companheiros da party na mesma sala e no mesmo andar, com a distância até você. */
function companheiros(estado) {
  const hunt = estado?.hunt;
  if (!hunt?.pos) return [];
  return (hunt.partilha?.naSala ?? []).filter((o) => o && o !== estado && o.hunt?.pos && (o.hunt.z ?? 0) === (hunt.z ?? 0)).map((o) => ({ o, longe: distancia(o.hunt.pos, hunt.pos) }));
}

/**
 * A FOTO do que o personagem dá aos aliados (no tique, com a ficha dele — `afPoe`): as auras "Você e Aliados" (`aliados:<stat>`, sem o
 * prefixo), o "Auras das suas Habilidades concedem" (`porAura`), a Fortificação igual (o Campeão) e se as auras dele não afetam aliados (a
 * Ichimonji). Grava em `hunt.aliados`.
 */
export function fotografar(estado, afPoe, { fortificacao = 0 } = {}) {
  const hunt = estado?.hunt;
  if (!hunt) return null;
  const af = {};
  for (const [k, v] of Object.entries(afPoe ?? {})) if (k.startsWith(PREFIXO) && typeof v === 'number' && v) af[k.slice(PREFIXO.length)] = v;
  hunt.aliados = {
    af,
    raio: PADRAO.raio,
    porAura: n(afPoe, 'aura_concede_vel'),
    // (a Fortificação de quem empresta, com a ficha dele — "Você atingiu sua fortificação máxima" conta: `condicoes-poe.fortificacao`)
    fortificacao: n(afPoe, 'aliados_fortificacao') > 0 ? Math.max(0, fortificacao) : 0,
    aurasSoSuas: n(afPoe, 'auras_so_em_voce') > 0,
    estandarte: doEstandarte(hunt, afPoe),
  };
  return hunt.aliados;
}

/** O Estandarte plantado de quem dá (posição, andar, raio) e o que ele dá aos aliados na área (`aliados_estandarte:<stat>`), ou null. */
function doEstandarte(hunt, afPoe) {
  const af = {};
  for (const [k, v] of Object.entries(afPoe ?? {})) if (k.startsWith(PREFIXO_DO_ESTANDARTE) && typeof v === 'number' && v) af[k.slice(PREFIXO_DO_ESTANDARTE.length)] = v;
  if (!Object.keys(af).length) return null;
  const agora = hunt.clock ?? 0;
  const b = Object.values(hunt.buffs ?? {}).find((x) => x?.estandarte && x.ate > agora);
  return b ? { x: b.estandarte.x, y: b.estandarte.y, z: b.estandarte.z ?? 0, raio: b.raio ?? 1, af } : null;
}

/**
 * Aplica, na soma da ficha (`resolvido`, depois das condições), o que vem das auras "Você e Aliados" — a sua e as dos companheiros perto, a
 * maior de cada atributo — e o "Auras das suas Habilidades concedem X% de Velocidades de Ataque e Conjuração" (a sua, por aura ligada; a dos
 * companheiros, por aura deles que alcança você). Muda `resolvido`.
 */
export function aplicar(estado, resolvido) {
  const hunt = estado?.hunt;
  const agora = hunt?.clock ?? 0;
  const maior = {};
  const naoRecebe = n(resolvido, 'auras_aliadas_nao_afetam') > 0;
  for (const [k, v] of Object.entries(resolvido)) if (k.startsWith(PREFIXO) && typeof v === 'number' && v) maior[k.slice(PREFIXO.length)] = v;
  // A Velocidade das auras: a sua, por aura ligada.
  let velocidade = n(resolvido, 'aura_concede_vel') * aurasLigadas(hunt, agora).length;
  if (!naoRecebe) {
    const minhas = new Set(aurasLigadas(hunt, agora).map(([id]) => id));
    for (const { o, longe } of companheiros(estado)) {
      // (lote G-D, dono 25/10) o buff do CLAMOR DE REUNIÃO do companheiro (o Dano de Ataque Adicional pela arma dele — `Acoes.clamorGBD`): com você no raio do Clamor, enquanto dura
      const reu = o.hunt.poeReuniao;
      if (reu && reu.ate > (o.hunt.clock ?? agora) && (hunt?.z ?? 0) === (reu.z ?? 0) && longe <= (reu.raio ?? 0)) for (const [k, v] of Object.entries(reu.af ?? {})) if (Math.abs(v) > Math.abs(maior[k] ?? 0)) maior[k] = v;
      const foto = o.hunt.aliados;
      if (!foto || foto.aurasSoSuas) continue;
      if (longe <= (foto.raio ?? PADRAO.raio)) for (const [k, v] of Object.entries(foto.af ?? {})) if (Math.abs(v) > Math.abs(maior[k] ?? 0)) maior[k] = v;
      // (13/10, o Inspirador: você na área do Estandarte plantado do companheiro)
      const e = foto.estandarte;
      if (e && hunt?.pos && (hunt.z ?? 0) === e.z && distancia(hunt.pos, e) <= e.raio) for (const [k, v] of Object.entries(e.af)) if (Math.abs(v) > Math.abs(maior[k] ?? 0)) maior[k] = v;
      // (cada aura uma vez: a sua, se você também tem a mesma — como em `gemas-poe.adds`)
      if (foto.porAura > 0) for (const [id, b] of aurasLigadas(o.hunt, o.hunt.clock ?? agora)) if (!minhas.has(id) && b.raio > 0 && longe <= b.raio) velocidade += foto.porAura;
    }
  }
  for (const [k, v] of Object.entries(maior)) resolvido[k] = (resolvido[k] ?? 0) + v;
  if (velocidade) {
    resolvido.atk_speed = (resolvido.atk_speed ?? 0) + velocidade;
    resolvido.cast_speed = (resolvido.cast_speed ?? 0) + velocidade;
  }
  return resolvido;
}

/**
 * A Fortificação que os companheiros perto emprestam ("Aliados Próximos contam como tendo Fortificação igual a sua"): a maior das deles, de
 * quem tem o nó (a foto do tique — sem ficha).
 */
export function fortificacaoDosAliados(estado) {
  let maior = 0;
  for (const { o, longe } of companheiros(estado)) {
    const foto = o.hunt.aliados;
    if (foto?.fortificacao > 0 && longe <= (foto.raio ?? PADRAO.raio)) maior = Math.max(maior, foto.fortificacao);
  }
  return maior;
}

/**
 * O que as SUAS auras de aliado dão a um LACAIO seu (`afPoe`: a sua ficha; no PoE, "Aliados" inclui os lacaios): o dano aumentado e o "mais",
 * o bloqueio de ataque e de magia, as resistências elementais, a velocidade das auras e a sua Fortificação ("Aliados Próximos contam como
 * tendo Fortificação igual a sua"). `{ danoIncPct, maisDanoPct, bloqueio, bloqueioMagico, res, velPct, fortificacao }` ou null.
 */
export function doLacaio(estado, afPoe, fortificacao = 0) {
  const a = (k) => n(afPoe, `${PREFIXO}${k}`);
  const res = Math.min(a('fire_res'), a('ice_res'), a('energy_res'));
  const velPct = n(afPoe, 'aura_concede_vel') * aurasLigadas(estado?.hunt).length;
  const fort = n(afPoe, 'aliados_fortificacao') > 0 ? fortificacao : 0;
  const x = { danoIncPct: a('dmg_inc'), maisDanoPct: a('mais_dano'), bloqueio: a('block'), bloqueioMagico: a('spell_block'), res, velPct, fortificacao: fort };
  return Object.values(x).some((v) => v) ? x : null;
}
