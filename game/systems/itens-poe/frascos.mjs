// Os FRASCOS do PoE (sistema de itens do PoE — só com ITENS_POE=1): de Vida, de Mana e de Utilidade, com os atributos da base, os
// modificadores (prefixos/sufixos) e os únicos do catálogo importado.
//
//   O CINTO: 5 vagas (`estado.frascos`), fora do equipamento — o frasco vai da mochila para o cinto e volta (`por`/`tirar`).
//   CARGAS: cada frasco guarda as dele (`peca.poe.cargas`); usar gasta `cargasPorUso`; matar dá cargas a TODOS os frascos do cinto pela
//           raridade do monstro (`regras.frascos.cargasPorMorte`, × a Recuperação de Cargas do frasco). Entrar numa caçada enche todos
//           (no PoE eles enchem na cidade).
//   USO: automático na caçada (é um jogo idle): o de Vida com a vida abaixo de `vidaAbaixoPct`, o de Mana com a mana abaixo de
//        `manaAbaixoPct`, os de Utilidade sempre que há monstro vivo e o efeito acabou. Um frasco não é usado de novo enquanto o efeito
//        dele dura.
//   EFEITO: Vida/Mana recuperam `quantidade` ao longo de `segundos` (ou na hora, com "Recuperação Instantânea"); Utilidade dá o efeito
//           da base (`regras.frascos.utilidade`: o Rubi +50% de resistência a fogo...) e as linhas "... durante o Efeito" dos mods, como
//           atributos somados na ficha enquanto dura (`adds`, juntado em `Afixos.soma`).
// O que o Draevor ainda não tem (imunidades a sangramento/congelamento, lentidão em inimigos, solo consagrado...) fica REGISTRADO: aparece
// no frasco, mas não faz nada ainda (`parametros(...).registrados`).
import { ligado, REGRAS } from './catalogo.mjs';
import { traduzirParte } from './traduzir.mjs';
import { ITEM_CATALOG } from '../dados.mjs';
import { darPeca } from '../inventario.mjs';
import { camposDaPeca } from '../itens/item.mjs';

export const CLASSES = ['Life_Flasks', 'Mana_Flasks', 'Utility_Flasks'];
const TIPO_DA_CLASSE = { Life_Flasks: 'vida', Mana_Flasks: 'mana', Utility_Flasks: 'utilidade' };
const F = () => REGRAS.frascos ?? {};
export const VAGAS = () => F().vagas ?? 5;

/** É um frasco do PoE (a peça do jogo ou o item do catálogo)? */
export const ehFrasco = (p) => CLASSES.includes(p?.poe?.classe ?? ITEM_CATALOG[p?.id]?.poe?.classe);

/** O cinto do personagem: sempre `VAGAS()` posições (null = vaga livre). */
export function cinto(estado) {
  const c = (estado.frascos ??= []);
  while (c.length < VAGAS()) c.push(null);
  return c;
}

// ---------------------------------------------------------------- os números de um frasco

/** O texto de um mod com os valores no lugar de `{n}`. */
const preencher = (modelo, valores) => String(modelo ?? '').replace(/\{(\d+)\}/g, (_, i) => String(valores?.[Number(i)] ?? '?'));

/** As regras das linhas que mexem no FRASCO (e não no personagem). `p` = os parâmetros sendo montados; `v` = o número da linha. */
const REGRAS_DO_FRASCO = [
  [/^Velocidade de Recuperação aumentada em \{0\}%$/, (p, v) => (p.velocidadePct += v)],
  [/^Velocidade de Recuperação reduzida em \{(\d)\}%$/, (p, v) => (p.velocidadePct -= v)],
  [/^Quantidade Recuperada aumentada em \{(\d)\}%$/, (p, v) => (p.quantidadePct += v)],
  [/^Quantidade Recuperada reduzida em \{(\d)\}%$/, (p, v) => (p.quantidadePct -= v)],
  [/^(Vida|Mana) Recuperada aumentada em \{(\d)\}%$/, (p, v) => (p.quantidadePct += v)],
  [/^(Vida|Mana) Recuperada reduzida em \{(\d)\}%$/, (p, v) => (p.quantidadePct -= v)],
  [/^Recuperação Instantânea$/, (p) => (p.instantaneo = true)],
  [/^Recuperação de Cargas aumentada em \{(\d)\}%$/, (p, v) => (p.recargaPct += v)],
  [/^Recuperação de Cargas reduzida em \{(\d)\}%$/, (p, v) => (p.recargaPct -= v)],
  [/^\+\{(\d)\} ao Máximo de Cargas$/, (p, v) => (p.cargasMaximas += v)],
  [/^Cargas reduzidas em \{(\d)\}% por uso$/, (p, v) => (p.custoPct -= v)],
  [/^Cargas aumentadas em \{(\d)\}% por uso$/, (p, v) => (p.custoPct += v)],
  [/^Duração aumentada em \{(\d)\}%$/, (p, v) => (p.duracaoPct += v)],
  [/^Duração reduzida em \{(\d)\}%$/, (p, v) => (p.duracaoPct -= v)],
  [/^\{(\d)\}% menos Duração$/, (p, v) => (p.duracaoMenos *= 1 - v / 100)],
  [/^\{(\d)\}% mais Duração$/, (p, v) => (p.duracaoMenos *= 1 + v / 100)],
  [/^Efeito aumentado em \{(\d)\}%$/, (p, v) => (p.efeitoPct += v)],
  [/^Efeito reduzido em \{(\d)\}%$/, (p, v) => (p.efeitoPct -= v)],
  [/^\{(\d)\}% mais Recuperação se usado enquanto em Vida Baixa$/, (p, v) => (p.maisNaVidaBaixaPct += v)],
  [/^Recupera um adicional de \{(\d)\}% da Quantidade de Recuperação do Frasco em \{(\d)\} segundos se usado enquanto não estiver em Vida Cheia$/, (p, v) => (p.quantidadePct += v)],
];
const DURANTE = / durante o (Efeito|efeito do Frasco)$/;

/**
 * Os parâmetros de um frasco (a base + os mods): `{ tipo, recurso, quantidade, ms, instantaneo, cargasPorUso, cargasMaximas, duracaoMs,
 * efeitoPct, recargaPct, durante: { af }, linhas: [{ texto, estado }] }`. As linhas que não casam com nada ficam `registrado`.
 */
export function parametros(peca) {
  const poe = peca?.poe ?? {};
  const a = poe.atributos ?? {};
  const tipo = TIPO_DA_CLASSE[poe.classe] ?? null;
  const p = { velocidadePct: 0, quantidadePct: 0, instantaneo: false, recargaPct: 0, cargasMaximas: Number(a.cargas_maximas) || 0, custoPct: 0, duracaoPct: 0, duracaoMenos: 1, efeitoPct: 0, maisNaVidaBaixaPct: 0 };
  const durante = {};
  const linhas = [];
  // A QUALIDADE do frasco (a Bolha do Vidreiro — poedb › Quality): vida/mana recuperada +qualidade%; no frasco de Utilidade, a duração +qualidade%.
  const qualidade = Math.max(0, Math.min(30, Number(poe.qualidade) || 0));
  if (qualidade) {
    if (tipo === 'utilidade') p.duracaoPct += qualidade;
    else p.quantidadePct += qualidade;
    linhas.push({ texto: `Qualidade: +${qualidade}% (${tipo === 'utilidade' ? 'duração' : 'recuperação'})`, estado: 'efeito' });
  }
  // O estado de cada MOD (o balão marca por mod, na ordem implícitos, prefixos, sufixos, mods do único): o pior das partes.
  const estadosPorMod = [];
  for (const mod of [...(poe.implicitos ?? []), ...(poe.prefixos ?? []), ...(poe.sufixos ?? []), ...(poe.modificadores ?? [])]) {
    const antes = linhas.length;
    for (const parte of String(mod.modelo ?? mod.texto ?? '').split(' / ')) {
      const nums = [...parte.matchAll(/\{(\d+)\}/g)].map((m) => Number(mod.valores?.[Number(m[1])]));
      const regra = REGRAS_DO_FRASCO.find(([re]) => re.test(parte));
      const texto = preencher(parte, mod.valores);
      if (regra) {
        regra[1](p, nums[0] ?? 0);
        linhas.push({ texto, estado: 'efeito' });
        continue;
      }
      if (DURANTE.test(parte)) {
        const t = traduzirParte(parte.replace(DURANTE, ''), mod.valores ?? []);
        const vale = t.estado !== 'registrado';
        if (vale) for (const e of t.efeitos) if (typeof e.valor === 'number') durante[e.stat] = (durante[e.stat] ?? 0) + e.valor;
        linhas.push({ texto, estado: vale ? 'efeito' : 'registrado' });
        continue;
      }
      linhas.push({ texto, estado: 'registrado' });
    }
    const minhas = linhas.slice(antes);
    estadosPorMod.push(minhas.every((l) => l.estado === 'efeito') ? 'equivalente' : minhas.some((l) => l.estado === 'efeito') ? 'aproximado' : 'registrado');
  }
  // O efeito da BASE do frasco de Utilidade (o Rubi, o Mercúrio...): `regras.frascos.utilidade[slug]`.
  const slug = String(poe.base ?? '').split('/')[1];
  const daBase = tipo === 'utilidade' ? F().utilidade?.[slug] : null;
  const fatorDoEfeito = Math.max(0, 1 + p.efeitoPct / 100);
  const af = {};
  for (const [k, v] of Object.entries(daBase?.af ?? {})) af[k] = Math.round(v * fatorDoEfeito * 100) / 100;
  for (const [k, v] of Object.entries(durante)) af[k] = Math.round(((af[k] ?? 0) + v * fatorDoEfeito) * 100) / 100;
  const rec = a.recupera ?? null;
  const ms = rec ? Math.max(100, Math.round((Number(rec.segundos) * 1000) / Math.max(0.1, 1 + p.velocidadePct / 100))) : 0;
  return {
    tipo,
    recurso: rec?.recurso === 'mana' ? 'mana' : rec ? 'vida' : null,
    quantidade: rec ? Math.round(Number(rec.quantidade) * Math.max(0, 1 + p.quantidadePct / 100)) : 0,
    ms,
    instantaneo: p.instantaneo,
    maisNaVidaBaixaPct: p.maisNaVidaBaixaPct,
    cargasPorUso: Math.max(1, Math.round((Number(a.cargas_por_uso) || 1) * Math.max(0, 1 + p.custoPct / 100))),
    cargasMaximas: Math.max(1, p.cargasMaximas),
    duracaoMs: a.duracao_segundos ? Math.round(Number(a.duracao_segundos) * 1000 * Math.max(0, 1 + p.duracaoPct / 100) * p.duracaoMenos) : 0,
    recargaPct: p.recargaPct,
    efeitoPct: p.efeitoPct,
    af,
    efeitoDaBase: daBase?.texto ?? null,
    linhas,
    estadosPorMod,
  };
}

/** O resumo para o balão (com os mods já aplicados): recupera, cargas, duração, o efeito da base e os atributos enquanto dura. */
export function resumo(peca) {
  const par = parametros(peca);
  return {
    tipo: par.tipo, recurso: par.recurso, quantidade: par.quantidade, segundos: par.ms / 1000, instantaneo: par.instantaneo,
    cargasPorUso: par.cargasPorUso, cargasMaximas: par.cargasMaximas, duracao: par.duracaoMs / 1000, efeitoDaBase: par.efeitoDaBase, af: par.af,
  };
}

/** As cargas atuais de um frasco (começa cheio). */
export const cargasDe = (peca, par = parametros(peca)) => Math.max(0, Math.min(par.cargasMaximas, peca?.poe?.cargas ?? par.cargasMaximas));

// ---------------------------------------------------------------- o cinto: pôr e tirar

/** Põe o frasco da mochila (`pilha`: índice; `vaga`: a posição no cinto, ou a primeira livre). O que estava na vaga volta à mochila. */
export function por(estado, { pilha, vaga = null }) {
  if (!ligado()) return { ok: false, erro: 'Frascos do PoE desligados.' };
  const inv = estado.inventory ?? [];
  const i = Number(pilha);
  const peca = inv[i];
  if (!peca || !ehFrasco(peca)) return { ok: false, erro: 'Isso não é um frasco.' };
  // O frasco inicial (a Recompensa do level 1) pede level 3 no PoE, mas é de todo exilado desde o começo: o cinto aceita.
  const minimo = peca.poe?.inicial ? 0 : ITEM_CATALOG[peca.id]?.minLevel ?? 0;
  if (minimo > (estado.level ?? 0)) return { ok: false, erro: `Precisa do level ${minimo}.` };
  const c = cinto(estado);
  const v = vaga == null ? c.findIndex((x) => !x) : Number(vaga);
  if (!(v >= 0 && v < c.length)) return { ok: false, erro: 'O cinto de frascos está cheio: tire um antes.' };
  inv.splice(i, 1);
  const antes = c[v];
  c[v] = { id: peca.id, count: 1, ...structuredClone(camposDaPeca(peca)) };
  if (antes) darPeca(estado, antes);
  return { ok: true, notice: `${peca.poe?.nome ?? 'Frasco'} no cinto (vaga ${v + 1}).` };
}

/** Tira o frasco da vaga `vaga` do cinto, de volta para a mochila. */
export function tirar(estado, { vaga }) {
  const c = cinto(estado);
  const v = Number(vaga);
  const peca = c[v];
  if (!peca) return { ok: false, erro: 'Essa vaga do cinto está vazia.' };
  c[v] = null;
  darPeca(estado, peca);
  if (estado.hunt?.frascosPoe) delete estado.hunt.frascosPoe.ativos?.[v];
  return { ok: true, notice: `${peca.poe?.nome ?? 'Frasco'} de volta à mochila.` };
}

// ---------------------------------------------------------------- na caçada

const estadoDaCacada = (hunt) => (hunt.frascosPoe ??= { ativos: {} });

/** Usa o frasco da vaga `v` agora (gasta as cargas e liga o efeito). Devolve true se usou. */
export function usar(estado, v, eventos = null, quem = null) {
  const hunt = estado.hunt;
  const peca = cinto(estado)[v];
  if (!hunt || !peca) return false;
  const par = parametros(peca);
  const cargas = cargasDe(peca, par);
  if (cargas < par.cargasPorUso) return false;
  const st = estadoDaCacada(hunt);
  const agora = hunt.clock ?? 0;
  if (st.ativos[v]?.ate > agora) return false;
  peca.poe.cargas = cargas - par.cargasPorUso;
  if (par.tipo === 'utilidade') {
    st.ativos[v] = { ate: agora + par.duracaoMs, af: par.af, nome: peca.poe.nome };
    return true;
  }
  // Vida/Mana: na vida baixa (abaixo de 50%), o "mais Recuperação se usado enquanto em Vida Baixa".
  const vidaBaixa = (estado.hp ?? 0) < (estado.maxHp ?? 1) * 0.5;
  const total = par.quantidade * (vidaBaixa ? 1 + par.maisNaVidaBaixaPct / 100 : 1);
  if (par.instantaneo) {
    recuperar(estado, par.recurso, total, eventos, quem);
    st.ativos[v] = { ate: agora + 250, recurso: par.recurso, nome: peca.poe.nome };
    return true;
  }
  st.ativos[v] = { ate: agora + par.ms, de: agora, ultimo: agora, porMs: total / par.ms, recurso: par.recurso, nome: peca.poe.nome };
  return true;
}

function recuperar(estado, recurso, valor, eventos, quem) {
  const [campo, maximo, cor] = recurso === 'mana' ? ['mana', 'maxMana', '#4fc3ff'] : ['hp', 'maxHp', '#00ff66'];
  const ganho = Math.min(Math.max(0, valor), Math.max(0, (estado[maximo] ?? 0) - (estado[campo] ?? 0)));
  if (!(ganho > 0)) return 0;
  estado[campo] = (estado[campo] ?? 0) + ganho;
  const pos = estado.hunt?.pos;
  if (eventos && ganho >= 1) eventos.push({ t: 'heal', uid: 'player', quem, x: pos?.x, y: pos?.y, v: Math.round(ganho), color: cor, frasco: true });
  return ganho;
}

/**
 * Um tique da caçada: enche o cinto ao entrar, recupera vida/mana dos frascos ativos, vence os de Utilidade e usa os frascos sozinho
 * (`usoAutomatico`). Devolve true se o conjunto de efeitos de Utilidade mudou (quem chama refaz a ficha).
 */
export function tique(estado, eventos = null, quem = null) {
  const hunt = estado.hunt;
  if (!ligado() || !hunt) return false;
  const c = cinto(estado);
  if (!c.some(Boolean)) return false;
  const st = estadoDaCacada(hunt);
  const agora = hunt.clock ?? 0;
  // Entrou na caçada: todos cheios (no PoE, a cidade enche os frascos).
  if (!st.cheios) {
    for (const p of c) if (p) p.poe.cargas = parametros(p).cargasMaximas;
    st.cheios = true;
  }
  let mudou = false;
  // A recuperação ao longo do tempo e o vencimento.
  for (const [v, a] of Object.entries(st.ativos)) {
    if (a.porMs) {
      const ate = Math.min(agora, a.ate);
      if (ate > a.ultimo) recuperar(estado, a.recurso, a.porMs * (ate - a.ultimo), eventos, quem);
      a.ultimo = ate;
    }
    if (a.ate <= agora) {
      if (a.af) mudou = true;
      delete st.ativos[v];
    }
  }
  if (estado.hp <= 0) return mudou;
  // O uso automático.
  const emCombate = (hunt.monstros ?? []).some((m) => m.hp > 0);
  const recuperando = (r) => Object.values(st.ativos).some((a) => a.recurso === r && a.ate > agora);
  for (let v = 0; v < c.length; v++) {
    const p = c[v];
    if (!p || st.ativos[v]?.ate > agora) continue;
    const tipo = TIPO_DA_CLASSE[p.poe?.classe];
    // A regra de CADA frasco (dono, 07/10: configurada clicando nele na barra): vida/mana abaixo de X%; utilidade em combate.
    const r = regraDe(p);
    const precisa = tipo === 'vida' ? (estado.hp ?? 0) < (estado.maxHp ?? 0) * (r.abaixoPct / 100) : tipo === 'mana' ? (estado.mana ?? 0) < (estado.maxMana ?? 0) * (r.abaixoPct / 100) : false;
    const quer = tipo === 'utilidade' ? emCombate && r.emCombate : precisa && !recuperando(tipo === 'mana' ? 'mana' : 'vida');
    if (quer && usar(estado, v, eventos, quem) && tipo === 'utilidade') mudou = true;
  }
  return mudou;
}

// ---------------------------------------------------------------- a regra de uso de cada frasco (dono, 07/10)

/** A regra de uso do frasco: `abaixoPct` (vida/mana abaixo de X% usa) ou `emCombate` (utilidade); o padrão vem de `regras.frascos.usoAutomatico`. */
export function regraDe(peca) {
  const U = F().usoAutomatico ?? {};
  const tipo = TIPO_DA_CLASSE[peca?.poe?.classe];
  const padrao = tipo === 'mana' ? U.manaAbaixoPct ?? 30 : U.vidaAbaixoPct ?? 50;
  const pct = Number(peca?.poe?.usarAbaixoPct);
  return { tipo, abaixoPct: Number.isFinite(pct) && pct >= 1 && pct <= 100 ? Math.round(pct) : padrao, emCombate: peca?.poe?.usarEmCombate !== false && U.utilidadeEmCombate !== false };
}

/** `send({t:'frasco', action:'configurar', vaga, abaixoPct | emCombate})`: a regra do frasco da vaga. */
export function configurar(estado, { vaga, abaixoPct, emCombate } = {}) {
  const peca = cinto(estado)[Number(vaga)];
  if (!peca) return { ok: false, erro: 'Essa vaga do cinto está vazia.' };
  const tipo = TIPO_DA_CLASSE[peca.poe?.classe];
  if (tipo === 'utilidade') {
    if (typeof emCombate !== 'boolean') return { ok: false, erro: 'O frasco de Utilidade só tem a regra "usar em combate".' };
    peca.poe.usarEmCombate = emCombate;
    return { ok: true, notice: `${peca.poe.nome}: ${emCombate ? 'usa sozinho em combate' : 'só na tecla'}.` };
  }
  const pct = Math.round(Number(abaixoPct));
  if (!(pct >= 1 && pct <= 100)) return { ok: false, erro: 'A porcentagem vai de 1 a 100.' };
  peca.poe.usarAbaixoPct = pct;
  return { ok: true, notice: `${peca.poe.nome}: usa quando a ${tipo} estiver abaixo de ${pct}%.` };
}

/** Matou um monstro: cargas para todos os frascos do cinto, pela raridade dele (× a Recuperação de Cargas de cada frasco). */
export function aoMatar(estado, tipoDoMonstro = 'normal') {
  if (!ligado()) return;
  const base = Number(F().cargasPorMorte?.[tipoDoMonstro] ?? F().cargasPorMorte?.normal ?? 1) || 0;
  for (const p of cinto(estado)) {
    if (!p) continue;
    const par = parametros(p);
    p.poe.cargas = Math.min(par.cargasMaximas, cargasDe(p, par) + base * Math.max(0, 1 + par.recargaPct / 100));
  }
}

/** Os atributos dos frascos de Utilidade ativos agora (somados em `Afixos.soma`). null: nenhum. */
export function adds(estado) {
  const st = estado?.hunt?.frascosPoe;
  if (!st) return null;
  const agora = estado.hunt.clock ?? 0;
  const total = {};
  for (const a of Object.values(st.ativos)) if (a.af && a.ate > agora) for (const [k, v] of Object.entries(a.af)) total[k] = (total[k] ?? 0) + v;
  return Object.keys(total).length ? total : null;
}

/** Os frascos ativos como cartões de buff da caçada. */
export function buffs(estado) {
  const st = estado?.hunt?.frascosPoe;
  if (!st) return [];
  const agora = estado.hunt.clock ?? 0;
  return Object.entries(st.ativos).filter(([, a]) => a.ate > agora && (a.af || a.porMs)).map(([v, a]) => ({ icone: null, nome: a.nome, resta: a.ate - agora, tipo: 'frascoPoe', vaga: Number(v) }));
}

/** O cinto para a tela: cada vaga com o frasco (a peça), as cargas, o custo e se está ativo. */
export function paraCliente(estado) {
  if (!ligado()) return null;
  const agora = estado.hunt?.clock ?? 0;
  const ativos = estado.hunt?.frascosPoe?.ativos ?? {};
  return cinto(estado).map((p, v) => {
    if (!p) return null;
    const par = parametros(p);
    const regra = regraDe(p);
    return { peca: p, cargas: Math.floor(cargasDe(p, par)), cargasMaximas: par.cargasMaximas, cargasPorUso: par.cargasPorUso, tipo: par.tipo, ativoAte: ativos[v]?.ate > agora ? ativos[v].ate - agora : 0, regra: { abaixoPct: regra.abaixoPct, emCombate: regra.emCombate } };
  });
}
