// Gem Atelier e Fragment Workshop — a regra que o cliente (client/src/gemas.mjs)
// diz morar no servidor.
//
// Do original (views das 5 vocações e o `catalog.gemas`, 2026-09-25; dados em
// `gamedata/gemas.json`, gerado por tools/gerar-gemas.mjs):
// - Abre no level 51 ("O Gem Atelier abre no level 51.").
// - Gemas fechadas são ITENS; `quantas` conta mochila + bolsa de loot (o
//   depósito não — Zoros: 14 na mochila, 5+1 na bolsa, 1 no depósito fora).
// - Revelar custa ouro (125 mil / 1 kk / 6 kk), trocar domínio 125 mil / 250
//   mil / 500 mil; os graus da oficina, ouro + fragmentos (os preços do Tibia).
// - Fragmentos não são itens: são contadores do atelier (Zoros: 11 e 6, nenhum
//   item 46625/46626 em lugar nenhum).
// - Os vessels de cada domínio enchem com a árvore: fração = graus comprados ÷
//   graus do caminho (verde = árvore inteira, vermelho = Muralha, roxo = Fúria,
//   azul = Fôlego); 1 vessel a 20%, 2 a 45%, 3 a 75% (`marcas`). Conferido
//   contra as 4 frações do Zoros, iguais até a última casa.
// - Encaixada, a gema acende o 1º modificador com 1 vessel, o 2º com 2
//   (Regular/Greater) e o supremo com 3 (só Greater) — o texto do cliente.
// - Destruir rende fragmentos na faixa que o cliente mostra (FAIXA).
// - A auto-venda nunca vende gema ("é gema do Gem Atelier") — `ehGema`.
//
// O que o original NÃO mostrou e aqui é escolha (marcado ESTIMADO):
// - quais modificadores saem ao revelar (sorteio igual entre os da vocação,
//   sem repetir na mesma gema) e o domínio (um dos 4, igual);
// - "Trocar domínio" vai para o próximo no sentido horário da roda
//   (verde → vermelho → roxo → azul), como no Tibia;
// - triturar uma gema fechada rende a mesma faixa de destruir uma revelada.
import { readFileSync } from 'node:fs';
import { contarGuardadas, tirarGuardadas } from './inventario.mjs';
import * as Arvore from './arvore.mjs';

const DADOS = JSON.parse(readFileSync(new URL('../gamedata/gemas.json', import.meta.url), 'utf8'));
const QUALIDADES = ['lesser', 'regular', 'greater'];
const GRAUS = ['I', 'II', 'III', 'IV'];
const NOME_DA_VOCACAO = { knight: 'Knight', paladin: 'Paladin', sorcerer: 'Sorcerer', druid: 'Druid', monk: 'Monk' };
const VIA_DO_DOMINIO = { vermelho: 'muralha', roxo: 'furia', azul: 'folego' }; // verde: a árvore inteira
const ORDEM_DA_RODA = ['verde', 'vermelho', 'roxo', 'azul']; // ESTIMADO: sentido horário
/** Fragmentos por gema destruída: [qual, mínimo, máximo] — a faixa que o cliente mostra. */
const FAIXA = { lesser: ['menor', 1, 5], regular: ['menor', 2, 10], greater: ['maior', 1, 5] };
/** Quantos modificadores cada qualidade tem: básicos e supremos. */
const FORMATO = { lesser: [1, 0], regular: [2, 0], greater: [2, 1] };

/** Qualquer gema fechada de qualquer vocação (a auto-venda não vende). */
const ITEM_FECHADO = new Map();
for (const [voc, porQualidade] of Object.entries(DADOS.fechadas)) for (const [q, id] of Object.entries(porQualidade)) ITEM_FECHADO.set(id, { vocacao: voc, qualidade: q });
export const ehGema = (id) => ITEM_FECHADO.has(id);
export const DROP = DADOS.drop;

/**
 * As gemas fechadas que um bicho pode soltar (`catalog.gemas.caca`): qualquer
 * criatura com `expMinima` (1.000) ou mais de exp — a frase da ficha do item
 * no cliente. Boss de sala usa `DROP.boss` (em `vitoriaNoBoss`).
 */
export const dropDoBicho = (bicho) => ((bicho?.exp ?? 0) >= DROP.expMinima && !bicho?.boss ? DROP.caca : []);

const sortear = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const saldo = (estado) => (estado.gold ?? 0) + (estado.bank ?? 0);
function pagar(estado, valor) {
  if (saldo(estado) < valor) return `Faltam ${(valor - saldo(estado)).toLocaleString('pt-BR')} de ouro (bolso + banco).`;
  const doBolso = Math.min(estado.gold ?? 0, valor);
  estado.gold = (estado.gold ?? 0) - doBolso;
  estado.bank = (estado.bank ?? 0) - (valor - doBolso);
  return null;
}

export function garantir(estado) {
  estado.gemas ??= {};
  const g = estado.gemas;
  g.lista ??= [];
  g.ativas ??= { verde: null, vermelho: null, roxo: null, azul: null };
  g.graus ??= {};
  g.fragmentos ??= { menor: 0, maior: 0 };
  g.proximoId ??= 1;
  return g;
}

const vocacaoDe = (estado) => (DADOS.basicos[estado.vocation] ? estado.vocation : 'knight');
const basicos = (estado) => DADOS.basicos[vocacaoDe(estado)];
const supremos = (estado) => DADOS.supremos[vocacaoDe(estado)];
const chave = (tipo, id) => `${tipo}:${id}`;
const acharMod = (estado, tipo, id) => (tipo === 'basico' ? basicos(estado) : supremos(estado)).find((m) => String(m.id) === String(id));
const grauDe = (estado, tipo, id) => garantir(estado).graus[chave(tipo, id)] ?? 0;

const motivo = (estado) => ((estado.level ?? 0) < DADOS.levelMinimo ? `O Gem Atelier abre no level ${DADOS.levelMinimo}.` : null);

// ------------------------------------------------------------------ vessels

/** A fração de cada domínio (graus comprados ÷ graus do caminho) e quantos vessels ela enche. */
export function vessels(estado) {
  const cat = Arvore.catalogoDe(estado);
  const graus = Arvore.garantir(estado).graus;
  const soma = { todas: [0, 0] };
  for (const no of cat?.nos ?? []) {
    const via = no.via ?? '-';
    soma[via] ??= [0, 0];
    const tem = Math.min(graus[no.id] ?? 0, no.graus);
    soma[via][0] += tem;
    soma[via][1] += no.graus;
    soma.todas[0] += tem;
    soma.todas[1] += no.graus;
  }
  const fracao = {};
  const cheios = {};
  for (const dominio of ORDEM_DA_RODA) {
    const [g, t] = soma[VIA_DO_DOMINIO[dominio] ?? 'todas'] ?? [0, 0];
    fracao[dominio] = t ? g / t : 0;
    cheios[dominio] = DADOS.marcas.filter((m) => fracao[dominio] >= m).length;
  }
  return { ...cheios, fracao, nomes: DADOS.nomesDosVessels };
}

// --------------------------------------------------------------- as vistas

function modParaCliente(estado, mod) {
  const grau = grauDe(estado, mod.tipo, mod.id);
  const proximo = grau < 3 ? DADOS.precos.grau[mod.tipo][grau + 1] : null;
  const texto = (partes) => partes.map((p) => p.texto).join(' · ');
  return {
    tipo: mod.tipo,
    id: mod.id,
    icone: mod.icone,
    nome: mod.nome,
    grau,
    grauNome: GRAUS[grau],
    texto: texto(mod.porGrau[grau]),
    partes: mod.porGrau[grau],
    proximoTexto: texto(mod.porGrau[Math.min(3, grau + 1)]),
    proximoPartes: mod.porGrau[Math.min(3, grau + 1)],
    porGrau: mod.porGrau,
    proximo,
  };
}

/** Quantos modificadores da gema estão acesos, pelos vessels do domínio dela. */
function acesos(gema, cheios) {
  const [nb] = FORMATO[gema.qualidade];
  return gema.mods.map((m, i) => (m.tipo === 'supremo' ? cheios >= 3 : i < nb && cheios >= i + 1));
}

function gemaParaCliente(estado, gema, g, vs) {
  const ativa = g.ativas[gema.dominio] === gema.id;
  const luz = acesos(gema, vs[gema.dominio]);
  return {
    id: gema.id,
    qualidade: gema.qualidade,
    dominio: gema.dominio,
    ativa,
    trancada: !!gema.trancada,
    modificadores: gema.mods.map((m, i) => {
      const mod = acharMod(estado, m.tipo, m.id);
      return { ...modParaCliente(estado, mod), aceso: ativa && luz[i] };
    }),
  };
}

const NOME_DO_ELEMENTO = { physical: 'físico', holy: 'sagrado', death: 'morte', fire: 'fogo', earth: 'terra', ice: 'gelo', energy: 'energia' };
const num = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

/** Os efeitos acesos, somados — o que entra na ficha e o balão "Bônus aplicados". */
export function efeitos(estado) {
  const g = garantir(estado);
  const vs = vessels(estado);
  const soma = new Map();
  let modificadores = 0;
  for (const dominio of ORDEM_DA_RODA) {
    const gema = g.lista.find((x) => x.id === g.ativas[dominio]);
    if (!gema) continue;
    const luz = acesos(gema, vs[dominio]);
    gema.mods.forEach((m, i) => {
      if (!luz[i]) return;
      const mod = acharMod(estado, m.tipo, m.id);
      if (!mod) return;
      modificadores++;
      for (const e of mod.efeitos[grauDe(estado, m.tipo, m.id)]) {
        const k = `${e.tipo}:${e.elemento ?? e.magia ?? ''}`;
        const atual = soma.get(k) ?? { ...e, v: 0, segundos: 0, momentum: 0 };
        atual.v += e.v ?? 0;
        atual.segundos += e.segundos ?? 0;
        atual.momentum += e.momentum ?? 0;
        soma.set(k, atual);
      }
    });
  }
  return { lista: [...soma.values()], modificadores };
}

function linhaDoTotal(e) {
  const sinal = (v) => (v >= 0 ? '+' : '') + num(v);
  switch (e.tipo) {
    case 'resistencia': return { rotulo: `Resistência a ${NOME_DO_ELEMENTO[e.elemento] ?? e.elemento}`, valor: `${sinal(e.v)}%`, icone: `el-${e.elemento}` };
    case 'mitigacao': return { rotulo: 'Dano recebido', valor: `-${num(e.v)}%`, icone: 'ficha-defesa' };
    case 'vida': return { rotulo: 'Vida', valor: sinal(e.v), icone: 'bar-hp' };
    case 'mana': return { rotulo: 'Mana', valor: sinal(e.v), icone: 'bar-mana' };
    case 'capacidade': return { rotulo: 'Capacidade', valor: sinal(e.v), icone: 'ficha-capacidade' };
    case 'esquiva': return { rotulo: 'Esquiva', valor: `${sinal(e.v)}%`, icone: 'ficha-bloqueio' };
    case 'critico': return { rotulo: 'Dano crítico', valor: `${sinal(e.v)}%`, icone: 'ficha-critico' };
    case 'lifeLeech': return { rotulo: 'Roubo de vida', valor: `${sinal(e.v)}%`, icone: 'ficha-life-leech' };
    case 'manaLeech': return { rotulo: 'Roubo de mana', valor: `${sinal(e.v)}%`, icone: 'ficha-mana-leech' };
    case 'danoDaMagia': return { rotulo: 'Dano da magia', valor: `${sinal(e.v)}%`, icone: 'ficha-dano', magia: e.magia };
    case 'criticoDaMagia': return { rotulo: 'Dano crítico da magia', valor: `${sinal(e.v)}%`, icone: 'ficha-critico', magia: e.magia };
    case 'curaDaMagia': return { rotulo: 'Cura da magia', valor: `${sinal(e.v)}%`, icone: 'ficha-regen-vida', magia: e.magia };
    case 'recargaDaMagia': return { rotulo: 'Recarga da magia', valor: `-${num(e.segundos)}s`, icone: 'ficha-tempo', magia: e.magia };
    default: return { rotulo: e.tipo, valor: sinal(e.v) };
  }
}

/** A view inteira, no formato que o original manda (`{t:'gemas', view}`). */
export function vista(estado) {
  const g = garantir(estado);
  const voc = vocacaoDe(estado);
  const vs = vessels(estado);
  const tot = efeitos(estado);
  const paraTriturar = [];
  for (const [id, { vocacao, qualidade }] of ITEM_FECHADO) {
    const { limpas, comExtras } = contarGuardadas(estado, id);
    if (limpas + comExtras) paraTriturar.push({ itemId: id, vocacao, qualidade, quantas: limpas + comExtras });
  }
  const conta = (id) => { const c = contarGuardadas(estado, id); return c.limpas + c.comExtras; };
  return {
    level: DADOS.levelMinimo,
    folha: { vocacao: DADOS.vocacoes.indexOf(voc), cores: DADOS.cores, vocacoes: DADOS.vocacoes },
    pode: !motivo(estado),
    motivo: motivo(estado),
    vocacao: voc,
    nomeDaVocacao: NOME_DA_VOCACAO[voc],
    lista: g.lista.map((gema) => gemaParaCliente(estado, gema, g, vs)),
    ativas: { ...g.ativas },
    vessels: vs,
    marcas: DADOS.marcas,
    fragmentos: { ...g.fragmentos },
    totais: { linhas: tot.lista.map(linhaDoTotal), modificadores: tot.modificadores },
    itensDosFragmentos: DADOS.itensDosFragmentos,
    fechadas: Object.fromEntries(QUALIDADES.map((q) => [q, { itemId: DADOS.fechadas[voc][q], quantas: conta(DADOS.fechadas[voc][q]) }])),
    paraTriturar,
    precos: DADOS.precos,
    oficina: { basicos: basicos(estado).map((m) => modParaCliente(estado, m)), supremos: supremos(estado).map((m) => modParaCliente(estado, m)) },
  };
}

// ------------------------------------------------------------------ ações

function revelar(estado, { qualidade }) {
  if (!QUALIDADES.includes(qualidade)) return { ok: false, erro: 'Qualidade inválida.' };
  const g = garantir(estado);
  const item = DADOS.fechadas[vocacaoDe(estado)][qualidade];
  const { limpas, comExtras } = contarGuardadas(estado, item);
  if (!(limpas + comExtras)) return { ok: false, erro: 'Você não tem essa gema fechada na mochila nem na bolsa.' };
  const erro = pagar(estado, DADOS.precos.revelar[qualidade]);
  if (erro) return { ok: false, erro };
  tirarGuardadas(estado, item, 1);
  // ESTIMADO: sorteio igual entre os modificadores da vocação, sem repetir.
  const [nb, ns] = FORMATO[qualidade];
  const tirar = (lista, n) => {
    const copia = [...lista];
    return Array.from({ length: n }, () => copia.splice(Math.floor(Math.random() * copia.length), 1)[0]);
  };
  const mods = [
    ...tirar(basicos(estado), nb).map((m) => ({ tipo: 'basico', id: m.id })),
    ...tirar(supremos(estado), ns).map((m) => ({ tipo: 'supremo', id: m.id })),
  ];
  const gema = { id: g.proximoId++, qualidade, dominio: ORDEM_DA_RODA[Math.floor(Math.random() * 4)], mods, trancada: false };
  g.lista.push(gema);
  return { ok: true, notice: 'Gema revelada.', gemaNova: gema.id };
}

function acharGema(estado, id) {
  return garantir(estado).lista.find((x) => x.id === Number(id)) ?? null;
}

function fragmentosDe(estado, qualidade) {
  const [tipo, min, max] = FAIXA[qualidade];
  const n = sortear(min, max);
  garantir(estado).fragmentos[tipo] += n;
  return { tipo, n };
}

function destruirUma(estado, gema) {
  const g = garantir(estado);
  if (g.ativas[gema.dominio] === gema.id) g.ativas[gema.dominio] = null;
  g.lista = g.lista.filter((x) => x.id !== gema.id);
  return fragmentosDe(estado, gema.qualidade);
}

const textoDosFragmentos = (r) => `${r.menor ? `${r.menor} Lesser Fragment${r.menor === 1 ? '' : 's'}` : ''}${r.menor && r.maior ? ' e ' : ''}${r.maior ? `${r.maior} Greater Fragment${r.maior === 1 ? '' : 's'}` : ''}`;

function destruir(estado, { id }) {
  const gema = acharGema(estado, id);
  if (!gema) return { ok: false, erro: 'Gema não encontrada.' };
  if (gema.trancada) return { ok: false, erro: 'Destranque a gema antes de destruir.' };
  const { tipo, n } = destruirUma(estado, gema);
  return { ok: true, notice: `Gema destruída: +${textoDosFragmentos({ [tipo]: n })}.` };
}

function destruirVarias(estado, { ids }) {
  const gemas = (Array.isArray(ids) ? ids : []).map((id) => acharGema(estado, id)).filter((x) => x && !x.trancada);
  if (!gemas.length) return { ok: false, erro: 'Nenhuma gema para destruir.' };
  const r = { menor: 0, maior: 0 };
  for (const gema of gemas) {
    const { tipo, n } = destruirUma(estado, gema);
    r[tipo] += n;
  }
  return { ok: true, notice: `${gemas.length} gema${gemas.length === 1 ? '' : 's'} destruída${gemas.length === 1 ? '' : 's'}: +${textoDosFragmentos(r)}.` };
}

function triturar(estado, { itemId }) {
  const info = ITEM_FECHADO.get(Number(itemId));
  if (!info) return { ok: false, erro: 'Isso não é uma gema.' };
  const { limpas, comExtras } = contarGuardadas(estado, Number(itemId));
  if (!(limpas + comExtras)) return { ok: false, erro: 'Você não tem essa gema.' };
  const erro = pagar(estado, DADOS.precos.triturar);
  if (erro) return { ok: false, erro };
  tirarGuardadas(estado, Number(itemId), 1);
  const { tipo, n } = fragmentosDe(estado, info.qualidade); // ESTIMADO: a faixa de destruir
  return { ok: true, notice: `Gema triturada: +${textoDosFragmentos({ [tipo]: n })}.` };
}

function trancar(estado, { id }) {
  const gema = acharGema(estado, id);
  if (!gema) return { ok: false, erro: 'Gema não encontrada.' };
  gema.trancada = !gema.trancada;
  return { ok: true };
}

/** Pôr no vessel do domínio dela (tirando a que estava) ou tirar, se já está. */
function encaixar(estado, { id }) {
  const g = garantir(estado);
  const gema = acharGema(estado, id);
  if (!gema) return { ok: false, erro: 'Gema não encontrada.' };
  g.ativas[gema.dominio] = g.ativas[gema.dominio] === gema.id ? null : gema.id;
  sincronizarMaximos(estado);
  return { ok: true };
}

function trocarDominio(estado, { id }) {
  const g = garantir(estado);
  const gema = acharGema(estado, id);
  if (!gema) return { ok: false, erro: 'Gema não encontrada.' };
  if (gema.trancada) return { ok: false, erro: 'Destranque a gema antes de trocar o domínio.' };
  const erro = pagar(estado, DADOS.precos.trocarDominio[gema.qualidade]);
  if (erro) return { ok: false, erro };
  if (g.ativas[gema.dominio] === gema.id) g.ativas[gema.dominio] = null;
  gema.dominio = ORDEM_DA_RODA[(ORDEM_DA_RODA.indexOf(gema.dominio) + 1) % 4];
  sincronizarMaximos(estado);
  return { ok: true, notice: `Domínio trocado para ${gema.dominio}.` };
}

/** Fragment Workshop: sobe o grau do modificador (vale em toda gema que o tem). */
function melhorar(estado, { tipo, modId }) {
  const mod = acharMod(estado, tipo, modId);
  if (!mod) return { ok: false, erro: 'Modificador inválido.' };
  const g = garantir(estado);
  const grau = grauDe(estado, tipo, mod.id);
  if (grau >= 3) return { ok: false, erro: 'Esse modificador já está no grau máximo.' };
  const custo = DADOS.precos.grau[tipo][grau + 1];
  const frag = tipo === 'basico' ? 'menor' : 'maior';
  if (g.fragmentos[frag] < custo.fragmentos) return { ok: false, erro: `Faltam ${custo.fragmentos - g.fragmentos[frag]} ${frag === 'menor' ? 'Lesser' : 'Greater'} Fragments.` };
  const erro = pagar(estado, custo.ouro);
  if (erro) return { ok: false, erro };
  g.fragmentos[frag] -= custo.fragmentos;
  g.graus[chave(tipo, mod.id)] = grau + 1;
  sincronizarMaximos(estado);
  return { ok: true, notice: `${mod.nome}: grau ${GRAUS[grau + 1]}.` };
}

const ACOES = { revelar, destruir, destruirVarias, triturar, trancar, encaixar, trocarDominio, melhorar };

/** `send({t:'gemas', action?, ...})` — sem `action` é só a vista. */
export function comando(estado, m) {
  if (!m.action) return { ok: true };
  const acao = ACOES[m.action];
  if (!acao) return { ok: false, erro: 'Ação desconhecida.' };
  const m1 = motivo(estado);
  if (m1) return { ok: false, erro: m1 };
  return acao(estado, m);
}

// -------------------------------------------------------- efeitos na ficha

/** Os efeitos somados num objeto simples, para a ficha e o combate. */
export function bonus(estado) {
  const b = { resistencia: {}, mitigacao: 0, vida: 0, mana: 0, capacidade: 0, esquiva: 0, critico: 0, lifeLeech: 0, manaLeech: 0, magias: {} };
  for (const e of efeitos(estado).lista) {
    if (e.tipo === 'resistencia') b.resistencia[e.elemento] = (b.resistencia[e.elemento] ?? 0) + e.v;
    else if (e.magia) {
      const m = (b.magias[e.magia] ??= { dano: 0, critico: 0, cura: 0, recargaMs: 0 });
      if (e.tipo === 'danoDaMagia') m.dano += e.v;
      if (e.tipo === 'criticoDaMagia') m.critico += e.v;
      if (e.tipo === 'curaDaMagia') m.cura += e.v;
      if (e.tipo === 'recargaDaMagia') m.recargaMs += e.segundos * 1000;
    } else b[e.tipo] = (b[e.tipo] ?? 0) + e.v;
  }
  return b;
}

/** Vida e mana das gemas sobre `maxHp`/`maxMana` — o mesmo jeito de `Afixos.sincronizarMaximos`. */
export function sincronizarMaximos(estado) {
  const b = bonus(estado);
  const tem = estado.gemasMax ?? { hp: 0, mana: 0 };
  const quer = { hp: Math.round(b.vida), mana: Math.round(b.mana) };
  if (tem.hp === quer.hp && tem.mana === quer.mana) return;
  estado.maxHp = (estado.maxHp ?? 0) + quer.hp - tem.hp;
  estado.maxMana = (estado.maxMana ?? 0) + quer.mana - tem.mana;
  estado.hp = Math.min(estado.hp ?? 0, estado.maxHp);
  estado.mana = Math.min(estado.mana ?? 0, estado.maxMana);
  estado.gemasMax = quer;
}
