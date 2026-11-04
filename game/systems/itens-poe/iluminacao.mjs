// O RAIO DE ILUMINAÇÃO do PoE (lote "luz", dono 02/11: "escuridão em volta" — "tem que estar tudo 100%"). Só no modo PoE (ITENS_POE=1).
//
// No PoE o personagem carrega uma luz: fora do raio dela a tela escurece. Aqui:
//   - o STAT: `light_radius` — a soma dos "X% de aumento/redução do Raio de Iluminação" (peças, árvore, ascendências, maestrias, frascos
//     "durante o Efeito", sementes, implícitos). O PoB soma tudo em `LightRadiusInc` (ModParser: "light radius" → `LightRadius`, INC);
//   - o RAIO na tela: a base (`LUZ.baseCasas`) × (1 + aumentado) × o quanto de VIDA você tem (o PoE encolhe a luz com a vida que falta;
//     "Campo de Visão é baseado no Escudo de Energia em vez de na Vida" — o stat do PoE `light_radius_scales_with_energy_shield` — troca a vida
//     pelo Escudo de Energia) × a CEGUEIRA em você ("Cegueira não afeta seu Campo de Visão" tira essa parte). O cliente desenha a escuridão
//     (`frontend/client/src/iluminacao.mjs`);
//   - o que DEPENDE da luz (o PoB: `LightRadiusAppliesToDamage`, `…ToAreaOfEffect` a 50%, `…ToAccuracy`, o Eclipse Solaris "por 1% de Raio de
//     Iluminação aumentado") vale pela escala `stat:light_radius` da tradução (`condicoes-poe.fatorDaEscala`); a Glória Dourada do Luminary
//     ("Aumentos e reduções de campo de visão também se aplicam ao efeito dos seus bônus de habilidade de conexão no seu mercenário") entra na
//     foto do Vínculo (`luzNoMercenarioPct` — `vinculos.doLacaio`);
//   - o TAMANHO ("Tamanho do Personagem aumentado em X%", "Tamanho do Zumbi", "Tamanho dos Golens", o "base actor scale +%" dos modificadores
//     de monstro): no PoE só muda o desenho — o cliente desenha na escala.
// Puro: não importa a ficha nem os dados (quem chama passa o `af`).

/**
 * Os números da luz. `baseCasas`: o raio da luz sem nada (casas de 2 m) — o PoE não publica a base em metros (o PoB não calcula o raio), então
 * é a do jogo: a meia altura da tela (13 casas de altura). `pisoDaVidaPct`: o quanto da luz fica com a vida no fim. `cegueiraMenosPct`: o
 * quanto a Cegueira em você tira do raio. `minimoCasas`/`maximoCasas`: os limites do desenho.
 */
export const LUZ = Object.freeze({ baseCasas: 6, pisoDaVidaPct: 50, cegueiraMenosPct: 50, minimoCasas: 1.5, maximoCasas: 14, reducaoMaximaPct: 90 });
/** Os limites do tamanho no desenho (×). */
export const TAMANHO = Object.freeze({ minimo: 0.5, maximo: 2 });

const n = (af, k) => Number(af?.[k]) || 0;
const arred = (x, casas = 2) => Math.round(x * 10 ** casas) / 10 ** casas;

/** O "aumentado" do Raio de Iluminação (a soma; o reduzido entra negativo), com o piso do PoE de −90%. */
export const aumentoDaLuz = (af) => Math.max(-LUZ.reducaoMaximaPct, n(af, 'light_radius'));

/** A fração do recurso que dá a luz: a vida (ou o Escudo de Energia, com "Campo de Visão é baseado no Escudo de Energia"). 0..1. */
export function fracaoDaLuz(estado, af) {
  if (n(af, 'luz_pelo_escudo') > 0) {
    // (03/11) `estado.es === null` é o Escudo CHEIO (`Defesa.esAtual` — a arena zera assim, `arena.nivelarParaODuelo`), não vazio; sem o máximo ainda
    // (`maxEsPoe` só chega no primeiro tique do PoE — `condicoes-poe`), também cheia: sem o dado, a luz não cai no piso. Com o máximo 0 (sem Escudo
    // nenhum), o piso, como no PoE
    if (estado?.es == null || estado?.maxEsPoe == null) return 1;
    const max = Number(estado.maxEsPoe) || 0;
    return max > 0 ? Math.max(0, Math.min(1, (Number(estado.es) || 0) / max)) : 0;
  }
  const max = Number(estado?.maxHp) || 0;
  return max > 0 ? Math.max(0, Math.min(1, (Number(estado?.hp) || 0) / max)) : 1;
}

/** Você está Cego agora? (o monstro que cega — `monstros-no-jogador.cegar`). */
export const cegoAgora = (hunt) => !!hunt && (hunt.debuffsDoJogador?.cego?.ate ?? 0) > (hunt.clock ?? 0);

/** O raio da luz em CASAS agora (com a vida, a cegueira e o aumentado). */
export function raioDaLuz(estado, af, hunt = estado?.hunt) {
  const piso = LUZ.pisoDaVidaPct / 100;
  const daVida = piso + (1 - piso) * fracaoDaLuz(estado, af);
  const daCegueira = cegoAgora(hunt) && !(n(af, 'cegueira_sem_luz') > 0) ? 1 - LUZ.cegueiraMenosPct / 100 : 1;
  const r = LUZ.baseCasas * (1 + aumentoDaLuz(af) / 100) * daVida * daCegueira;
  return arred(Math.max(LUZ.minimoCasas, Math.min(LUZ.maximoCasas, r)), 1);
}

const escala = (pct) => arred(Math.max(TAMANHO.minimo, Math.min(TAMANHO.maximo, 1 + (Number(pct) || 0) / 100)));
/** O tamanho do personagem no desenho (×): "Tamanho do Personagem aumentado em X%". */
export const tamanhoDoPersonagem = (af) => escala(n(af, 'tamanho_personagem'));
/** O tamanho de um lacaio seu no desenho (×): "Tamanho do Zumbi aumentado em X%", "X% de redução do Tamanho dos Golens" (pelo nome). */
export function tamanhoDoLacaio(af, l) {
  const nome = `${l?.nome ?? ''} ${l?.name ?? ''}`;
  let pct = 0;
  if (/zumbi|zombie/i.test(nome)) pct += n(af, 'tamanho_zumbi');
  if (/golem/i.test(nome)) pct += n(af, 'tamanho_golem');
  return escala(pct);
}

/** `{ id → % }` do "base actor scale +%" de cada modificador de monstro do PoE (`modificadores-monstro.json` → statsPoe). */
const ESCALA_DO_MOD = new WeakMap();
function escalasDosMods(dados) {
  if (!dados) return null;
  let m = ESCALA_DO_MOD.get(dados);
  if (m) return m;
  m = new Map();
  for (const mod of dados.mods ?? []) {
    const s = (mod.statsPoe ?? []).find((x) => x.stat === 'base actor scale +%');
    if (s) m.set(mod.id, Number(s.min) || 0);
  }
  ESCALA_DO_MOD.set(dados, m);
  return m;
}
/** O tamanho de um monstro no desenho (×): a soma do "Tamanho do Personagem aumentado" dos modificadores do PoE dele (`m.mods`: `poe:<id>`). */
export function tamanhoDoMonstro(m, dados) {
  const tab = escalasDosMods(dados);
  if (!tab || !m?.mods?.length) return 1;
  let pct = 0;
  for (const id of m.mods) pct += tab.get(String(id).replace(/^poe:/, '')) ?? 0;
  return escala(pct);
}

/**
 * O que a tela da caçada recebe (`snapshotDaHunt.luz`): o raio agora (casas), a base, o aumentado, a fração da vida/escudo e o tamanho do
 * personagem. null fora do modo PoE (quem chama confere).
 */
export function paraCliente(estado, af, hunt = estado?.hunt) {
  return {
    raio: raioDaLuz(estado, af, hunt),
    base: LUZ.baseCasas,
    aumento: aumentoDaLuz(af),
    tamanho: tamanhoDoPersonagem(af),
    ...(cegoAgora(hunt) && !(n(af, 'cegueira_sem_luz') > 0) ? { cego: true } : {}),
  };
}

/**
 * (a Glória Dourada do Luminary) o "aumentado" do Raio de Iluminação que entra no Efeito dos seus Vínculos no MERCENÁRIO (a foto do Vínculo).
 * 0 sem o nó.
 */
export const luzNoMercenarioPct = (af) => (n(af, 'luz_no_vinculo_mercenario') > 0 ? aumentoDaLuz(af) : 0);
