// O CONVOCAR O AÇO do PoE (Call of Steel — dono, 12/10: "pode seguir com convocar o aço") e os FRAGMENTOS DE AÇO.
//
// No PoE, "toda habilidade de Aço concede o Convocar o Aço" (as gemas com o tipo Steel: Aço Perfurador, Aço Violento da Munição, Aço
// Estraçalhador da Munição; e o "Concede Chamado do Aço" do Verme de Aço). Ele "chama os empalamentos dos inimigos, vivos ou mortos, numa área
// grande em volta de você para ganhar Fragmentos de Aço", "reflete Dano Físico em volta de cada inimigo igual ao Dano dos Empalamentos
// removidos multiplicado pela quantidade de Acertos que restavam", "concede 1 Fragmento de Aço por Empalamento removido" e "concede 4
// Fragmentos de Aço a cada 0,5 segundo" — "continua concedendo fragmentos com o tempo até você chegar ao máximo ou gastá-los". "Você pode ter
// até 12 Fragmentos de Aço por vez." Tempo de uso 0,5 s (Path of Building: castTime 0.5); é do tipo Recarga: a recarga dos fragmentos
// acelera com a Recuperação de Recarga.
//
// Aqui tudo é dado puro do personagem na caçada (`hunt.aco`, JSON): os fragmentos, a recarga, os consumidos (o "após consumir um total de N
// Fragmentos") e as Proteções de Aço. Quem usa o Convocar o Aço e gasta os fragmentos é `acoes.mjs` (`convocarOAco`, `fragmentosNoUso`).

import { fatorDaArea, casasPelaArea } from './condicoes-poe.mjs';

export const PADRAO = Object.freeze({
  /** "Você pode ter até 12 Fragmentos de Aço por vez" (poedb, notas da 3.12; Path of Building limita em 12). */
  maximo: 12,
  /** "Concede 4 Fragmentos de Aço a cada 0,5 segundo" (call_of_steel_reload_amount 4, call_of_steel_reload_time 500). */
  recarga: Object.freeze({ quantidade: 4, ms: 500 }),
  /** O tempo de uso (castTime 0.5): "Convocar o Aço tem Velocidade de Uso aumentada" o encurta. */
  usoMs: 500,
  /** "numa área grande em volta de você" — em casas (o PoE não publica o raio; 1 casa = 2 m). */
  raioDaChamada: 6,
  /** "numa área menor em volta de cada inimigo" — em casas. */
  raioDoReflexo: 1,
  /** O uso automático: chama com pelo menos tantos Empalamentos ao alcance (os de um cadáver sempre valem — senão se perdem). */
  empalamentosParaChamar: 5,
  /** A Proteção de Aço do Aço Estraçalhador da Munição: "se você tiver ao menos 2 Fragmentos", "máximo de 6", "+8% de Chance de Bloquear". */
  protecao: Object.freeze({ minimo: 2, maximo: 6, bloqueioPct: 8 }),
});

const LINHAS = [
  [/Consome até (\d+) Fragmentos de Aço/i, (m, d) => { d.consome = Number(m[1]); }],
  [/^Ataque do Totem consome até (\d+) dos Fragmentos de Aço/i, (m, d) => { d.consome = Number(m[1]); d.doTotem = true; }],
  [/^Dispara ([\d.]+) ?% mais Projéteis por Fragmento de Aço consumido/i, (m, d) => { d.maisProjeteisPct = Number(m[1]); }],
  [/^Se não tiver Fragmentos de Aço, só Dispara 1 Projétil/i, (m, d) => { d.semFragmentoUmProjetil = true; }],
  [/^Se você não tiver Fragmentos de Aço, Projéteis contam como se já tivessem se Partido/i, (m, d) => { d.semFragmentoSemDivisao = true; }],
  [/^Projéteis causam até ([\d.]+) ?% mais Dano com Acertos por Fragmento de Aço consumido/i, (m, d) => { d.maisDanoPct = Number(m[1]); }],
  [/^Ganha uma Proteção de Aço se você tiver ao menos (\d+) Fragmentos de Aço, máximo de (\d+).*\+?([\d.]+) ?% de Chance de Bloquear/i, (m, d) => { d.protecao = { minimo: Number(m[1]), maximo: Number(m[2]), bloqueioPct: Number(m[3]) }; }],
];
/** As linhas de gema que este módulo faz (para o status da gema no jogo — `gemas-poe.avaliarNoJogo`). */
export const ehLinhaDoAco = (linha) => LINHAS.some(([re]) => re.test(String(linha)));

/**
 * O que a gema de Aço diz, pelas linhas do nível: `{ consome, doTotem, maisProjeteisPct, semFragmentoUmProjetil, semFragmentoSemDivisao,
 * maisDanoPct, protecao }`. Sem "Consome até N Fragmentos de Aço": null (a gema não gasta fragmentos).
 */
export function daGema(linhas = []) {
  const d = { consome: 0, doTotem: false, maisProjeteisPct: 0, semFragmentoUmProjetil: false, semFragmentoSemDivisao: false, maisDanoPct: 0, protecao: null };
  for (const l of linhas) for (const [re, fazer] of LINHAS) { const m = re.exec(String(l)); if (m) fazer(m, d); }
  return d.consome > 0 ? d : null;
}

const n = (ficha, k) => Number(ficha?.afPoe?.[k]) || 0;
/** O registro da caçada (criado na primeira vez). */
export function aco(hunt) {
  return (hunt.aco ??= { fragmentos: 0, recarregando: false, proxima: null, consumidos: 0, bonusAte: 0, protecoes: [] });
}
/** O máximo de Fragmentos: 12 + "Chamado do Aço tem +N ao máximo de Fragmentos de Aço". */
export const maximo = (ficha) => Math.max(0, PADRAO.maximo + Math.floor(n(ficha, 'fragmentos_aco_max')));
/** O intervalo da recarga (4 a cada 0,5 s) ÷ a Recuperação de Recarga (o Convocar o Aço é do tipo Recarga). */
export const intervaloMs = (ficha) => Math.max(50, Math.round(PADRAO.recarga.ms / Math.max(0.1, 1 + (Number(ficha?.recuperacaoDeRecarga) || 0) / 100)));
/** O tempo de uso: 0,5 s ÷ "Convocar o Aço tem Velocidade de Uso aumentada em X%". */
export const usoMs = (ficha) => Math.max(100, Math.round(PADRAO.usoMs / Math.max(0.1, 1 + n(ficha, 'aco_uso_inc') / 100)));
/** O fator da Área de Efeito: (1 + o aumentado + `extra`) × o "X% mais Área de Efeito" (`area_mais`) — `condicoes-poe.fatorDaArea`. */
const fator = (ficha, extra = 0) => fatorDaArea(n(ficha, 'area_inc') + extra, n(ficha, 'area_mais'));
/** O raio da chamada (a "área grande"), com a Área de Efeito do personagem: × √ o fator, a fração como chance (lote 36, "Toda área em metros"). */
export const raioDaChamada = (ficha, rng = Math.random) => Math.max(1, PADRAO.raioDaChamada + casasPelaArea(PADRAO.raioDaChamada, fator(ficha), rng));
/** O raio do reflexo em volta de cada inimigo, com a Área de Efeito e "Convocar o Aço causa Dano Refletido com Área de Efeito aumentada". */
export const raioDoReflexo = (ficha, rng = Math.random) => Math.max(0, PADRAO.raioDoReflexo + casasPelaArea(PADRAO.raioDoReflexo, fator(ficha, n(ficha, 'aco_area_inc')), rng));

/**
 * O tique: a RECARGA (4 fragmentos a cada intervalo, até o máximo — aí para) e o fim das Proteções de Aço. Devolve se algo mudou (as
 * Proteções valem na ficha: o chamador a refaz).
 */
export function tique(hunt, ficha, agora = hunt?.clock ?? 0) {
  if (!hunt?.aco) return false;
  const a = hunt.aco;
  const max = maximo(ficha);
  if (a.fragmentos > max) a.fragmentos = max;
  if (a.recarregando) {
    const passo = intervaloMs(ficha);
    a.proxima ??= agora + passo;
    while (a.recarregando && agora >= a.proxima) {
      a.fragmentos = Math.min(max, a.fragmentos + PADRAO.recarga.quantidade);
      a.proxima += passo;
      if (a.fragmentos >= max) { a.recarregando = false; a.proxima = null; }
    }
  }
  const antes = a.protecoes.length;
  a.protecoes = a.protecoes.filter((ate) => ate > agora);
  return a.protecoes.length !== antes;
}

/**
 * GASTA até `ate` fragmentos (a gema de Aço no uso). Gastar PARA a recarga ("até você chegar ao máximo ou gastá-los"). Conta o total consumido
 * para o "Habilidades Disparam N Projéteis adicionais por S segundos após você consumir um total de T Fragmentos de Aço" (o Verme de Aço).
 * Devolve quantos gastou.
 */
export function consumir(hunt, ficha, ate, agora = hunt?.clock ?? 0) {
  const a = aco(hunt);
  const gasto = Math.max(0, Math.min(a.fragmentos, Math.floor(ate)));
  if (!gasto) return 0;
  a.fragmentos -= gasto;
  a.recarregando = false;
  a.proxima = null;
  const total = n(ficha, 'aco_proj_extra_total');
  if (total > 0 && n(ficha, 'aco_proj_extra') > 0) {
    a.consumidos += gasto;
    if (a.consumidos >= total) {
      a.consumidos %= total;
      a.bonusAte = agora + Math.round(Math.max(0, n(ficha, 'aco_proj_extra_s')) * 1000);
    }
  }
  return gasto;
}
/** Os projéteis a mais do "…por S segundos após você consumir um total de T Fragmentos de Aço", agora (0 fora da janela). */
export const projeteisDoBonus = (hunt, ficha, agora = hunt?.clock ?? 0) => ((hunt?.aco?.bonusAte ?? 0) > agora ? Math.max(0, Math.floor(n(ficha, 'aco_proj_extra'))) : 0);

/**
 * Os PROJÉTEIS do uso com `gastos` fragmentos: o "X% mais Projéteis por Fragmento de Aço consumido" (sobre o total — base + adicionais —, até
 * o "Consome até N" da gema, como o Path of Building limita), o "Se não tiver Fragmentos de Aço, só Dispara 1 Projétil" (sem os adicionais) e o
 * "Projéteis contam como se já tivessem se Partido" (sem a divisão). Devolve `{ projeteisBase, alvosExtras, divisao }`.
 */
// (lote A3, dono 19/10 — D5: a divisão não é mais projétil a mais saindo de você — é o `divisao` do `Secundarios.resolver`, do alvo atingido —: o
// "contam como se já tivessem se Partido" a zera, e ela volta aqui junto)
export function projeteisNoUso(d, gastos, { base = 1, extras = 0, divisao = 0 } = {}) {
  if (!d) return { projeteisBase: base, alvosExtras: extras, divisao };
  if (!gastos && d.semFragmentoUmProjetil) return { projeteisBase: 1, alvosExtras: 0, divisao };
  const e = extras;
  const div = !gastos && d.semFragmentoSemDivisao ? 0 : divisao;
  if (gastos && d.maisProjeteisPct > 0) {
    const total = Math.round((base + e) * (1 + (d.maisProjeteisPct * Math.min(gastos, d.consome)) / 100));
    return { projeteisBase: Math.max(1, total - e), alvosExtras: e, divisao: div };
  }
  return { projeteisBase: base, alvosExtras: e, divisao: div };
}

/**
 * O "até X% mais Dano com Acertos por Fragmento de Aço consumido no início de seu movimento, reduzido este bônus na medida em que viajam
 * adiante" (o Aço Estraçalhador da Munição): o Path of Building rampa de 10 a 70 unidades (cheio até 1 m, nada a partir de 7 m). Em casas
 * (1 casa = 2 m = 20 unidades). Devolve o fator (1 = sem bônus).
 */
export function fatorDoDano(d, gastos, casas) {
  if (!d?.maisDanoPct || !gastos) return 1;
  const unidades = Math.max(0, casas) * 20;
  const rampa = Math.max(0, Math.min(1, (70 - unidades) / 60));
  return 1 + (d.maisDanoPct * gastos * rampa) / 100;
}

/** A Proteção de Aço: "Ganha uma Proteção de Aço se você tiver ao menos 2 Fragmentos" (antes de gastar), até o máximo; cada uma dura a gema. */
export function ganharProtecao(hunt, d, fragmentosAntes, duracaoMs, agora = hunt?.clock ?? 0) {
  if (!d?.protecao || fragmentosAntes < d.protecao.minimo || !(duracaoMs > 0)) return false;
  const a = aco(hunt);
  a.protecoes = [...a.protecoes.filter((ate) => ate > agora), agora + duracaoMs].sort((x, y) => x - y).slice(-d.protecao.maximo);
  a.bloqueioPorProtecao = d.protecao.bloqueioPct;
  return true;
}
/** O que as Proteções de Aço dão na ficha (`afixos.soma`): "+8% de Chance de Bloquear o Dano de Ataques de Projéteis" cada. */
export function addsDoAco(hunt) {
  const a = hunt?.aco;
  if (!a?.protecoes?.length) return null;
  const agora = hunt.clock ?? 0;
  const ativas = a.protecoes.filter((ate) => ate > agora).length;
  return ativas ? { bloqueio_projetil: ativas * (a.bloqueioPorProtecao ?? PADRAO.protecao.bloqueioPct) } : null;
}

const ativos = (lista, agora) => (Array.isArray(lista) ? lista.filter((x) => x.ate > agora && x.acertos > 0) : []);
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/**
 * Os EMPALAMENTOS ao alcance da chamada: nos monstros vivos e nos cadáveres (`hunt.cadaveres`, que guardam os do morto), a até `raio` casas
 * de `centro` — menos os de quem ainda está no "Por N segundos após você Empalar Inimigos … Chamado do Aço não pode remover Empalamentos deles"
 * (O Empalador: `empalarBloqueadoAte`). `[{ alvo, morto, x, y, empalamentos }]`.
 */
export function chamaveis(hunt, centro, raio, agora = hunt?.clock ?? 0) {
  const saida = [];
  for (const m of hunt?.monstros ?? []) {
    if (!(m.hp > 0) || dist(m, centro) > raio) continue;
    if ((m.estados?.empalarBloqueadoAte ?? 0) > agora) continue;
    const e = ativos(m.estados?.empalado, agora);
    if (e.length) saida.push({ alvo: m, morto: false, x: m.x, y: m.y, empalamentos: e });
  }
  for (const c of hunt?.cadaveres ?? []) {
    if (dist(c, centro) > raio || (c.empalarBloqueadoAte ?? 0) > agora) continue;
    const e = ativos(c.empalado, agora);
    if (e.length) saida.push({ alvo: c, morto: true, x: c.x, y: c.y, empalamentos: e });
  }
  return saida;
}
/** Quantos empalamentos a chamada pegaria agora (e quantos deles em cadáveres). */
export function contarChamaveis(hunt, centro, raio, agora = hunt?.clock ?? 0) {
  let total = 0;
  let mortos = 0;
  for (const c of chamaveis(hunt, centro, raio, agora)) {
    total += c.empalamentos.length;
    if (c.morto) mortos += c.empalamentos.length;
  }
  return { total, mortos };
}

/**
 * O uso automático (o jogo é idle — como o "Detonar" das Minas): chama quando há empalamentos que valem a pena (os de um cadáver, que senão
 * se perdem, ou pelo menos `empalamentosParaChamar`) ou quando os fragmentos não pagam o próximo uso da gema de Aço (`consumo`) e a recarga
 * está parada.
 */
export function quer(hunt, ficha, { consumo = 0, centro, raio, agora = hunt?.clock ?? 0 } = {}) {
  const a = aco(hunt);
  const { total, mortos } = contarChamaveis(hunt, centro, raio, agora);
  if (mortos > 0 || total >= PADRAO.empalamentosParaChamar) return true;
  return !a.recarregando && a.fragmentos < Math.min(maximo(ficha), Math.max(1, consumo));
}

/**
 * A CHAMADA: tira os empalamentos ao alcance (vivos e mortos) e devolve, para cada inimigo que os tinha, o dano refletido em volta dele —
 * "igual ao Dano dos Empalamentos removidos multiplicado pela quantidade de Acertos que restavam", × "Convocar o Aço causa Dano Refletido
 * aumentado em X%"; +1 fragmento por empalamento (até o máximo) e LIGA a recarga. `{ reflexos: [{ x, y, dano, de }], empalamentos }`.
 */
export function chamar(hunt, ficha, centro, raio, agora = hunt?.clock ?? 0) {
  const a = aco(hunt);
  const reflexos = [];
  let empalamentos = 0;
  const mais = Math.max(0, 1 + n(ficha, 'aco_refletido_inc') / 100);
  for (const c of chamaveis(hunt, centro, raio, agora)) {
    const bruto = c.empalamentos.reduce((t, x) => t + x.valor * x.acertos, 0);
    empalamentos += c.empalamentos.length;
    if (c.morto) c.alvo.empalado = [];
    else c.alvo.estados.empalado = [];
    if (bruto > 0) reflexos.push({ x: c.x, y: c.y, dano: bruto * mais, de: c.morto ? null : c.alvo.uid });
  }
  a.fragmentos = Math.min(maximo(ficha), a.fragmentos + empalamentos);
  if (a.fragmentos < maximo(ficha)) {
    a.recarregando = true;
    a.proxima = agora + intervaloMs(ficha);
  } else {
    a.recarregando = false;
    a.proxima = null;
  }
  return { reflexos, empalamentos };
}
