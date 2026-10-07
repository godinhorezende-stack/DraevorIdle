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
import { darPeca, cabeNaMochila, erroDeEspaco } from '../inventario.mjs';
import { camposDaPeca } from '../itens/item.mjs';
import * as Dot from '../combate/dot.mjs';

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
  [/^Velocidade de Recuperação aumentada em \{\d+\}%$/, (p, v) => (p.velocidadePct += v)],
  [/^Velocidade de Recuperação reduzida em \{\d+\}%$/, (p, v) => (p.velocidadePct -= v)],
  [/^Quantidade Recuperada aumentada em \{\d+\}%$/, (p, v) => (p.quantidadePct += v)],
  [/^Quantidade Recuperada reduzida em \{\d+\}%$/, (p, v) => (p.quantidadePct -= v)],
  [/^(Vida|Mana) Recuperada aumentada em \{\d+\}%$/, (p, v) => (p.quantidadePct += v)],
  [/^(Vida|Mana) Recuperada reduzida em \{\d+\}%$/, (p, v) => (p.quantidadePct -= v)],
  [/^Recuperação Instantânea$/, (p) => (p.instantaneo = true)],
  [/^Recuperação de Cargas aumentada em \{\d+\}%$/, (p, v) => (p.recargaPct += v)],
  [/^Recuperação de Cargas reduzida em \{\d+\}%$/, (p, v) => (p.recargaPct -= v)],
  [/^\+\{\d+\} ao Máximo de Cargas$/, (p, v) => (p.cargasMaximas += v)],
  [/^Cargas reduzidas em \{\d+\}% por uso$/, (p, v) => (p.custoPct -= v)],
  [/^Cargas aumentadas em \{\d+\}% por uso$/, (p, v) => (p.custoPct += v)],
  [/^Duração aumentada em \{\d+\}%$/, (p, v) => (p.duracaoPct += v)],
  [/^Duração reduzida em \{\d+\}%$/, (p, v) => (p.duracaoPct -= v)],
  [/^\{\d+\}% menos Duração$/, (p, v) => (p.duracaoMenos *= 1 - v / 100)],
  [/^\{\d+\}% mais Duração$/, (p, v) => (p.duracaoMenos *= 1 + v / 100)],
  [/^Efeito aumentado em \{\d+\}%$/, (p, v) => (p.efeitoPct += v)],
  [/^Efeito reduzido em \{\d+\}%$/, (p, v) => (p.efeitoPct -= v)],
  [/^\{\d+\}% mais Recuperação se usado enquanto em Vida Baixa$/, (p, v) => (p.maisNaVidaBaixaPct += v)],
  [/^Recupera um adicional de \{\d+\}% da Quantidade de Recuperação do Frasco em \{\d+\} segundos se usado enquanto não estiver em Vida Cheia$/, (p, v) => (p.quantidadePct += v)],
  // (07/10 — "colocando igual no PoE": os que ficavam só registrados.)
  [/^\{\d+\}% da Recuperação aplicada Instantaneamente$/, (p, v) => (p.instantaneoPct += v)],
  [/^Recuperação Instantânea quando em Vida Baixa$/, (p) => (p.instantaneoNaVidaBaixa = true)],
  [/^Recuperação de Mana ocorre instantaneamente no término do Efeito$/, (p) => (p.instantaneoNoFim = true)],
  [/^Efeito não é removido quando a Mana Não Reservada Encher$/, (p) => (p.naoParaNoCheio = true)],
  [/^Efeito não se Acumula$/, (p) => (p.naoAcumula = true)],
  [/^Efeito é removido quando Acertado por um Jogador$/, (p) => (p.saiNoPvp = true)],
  [/^Retira \{\d+\}% de (?:Vida|Mana) Recuperada da (Mana|Vida) quando utilizado$/, (p, v) => (p.custoDaOutraPct += v)],
  [/^Repassa \{\d+\}% da Recuperação de Vida para Lacaios$/, (p, v) => (p.lacaiosPct += v)],
  [/^\{\d+\}% de chance de ganhar uma Carga de Frasco ao causar um Golpe Crítico$/, (p, v) => (p.cargaNoCriticoPct += v)],
  [/^Ganhe \{\d+\} Cargas a[io] ser Acertado por um Inimigo$/, (p, v) => (p.cargasAoSerAcertado += v)],
  [/^Remove Maldições ao usar$/, (p) => (p.aoUsar.removerMaldicao = true)],
  [/^Remove todos os Incêndios quando usado$/, (p) => (p.aoUsar.removerIncendio = true)],
  [/^Concede Imunidade a (Desaceleração|Mutilação|Sangramento|Sangue Corrompido|Eletrização|Resfriamento|Congelamento|Incêndio|Envenenamento) por \{\d+\} segundos se usado enquanto .+$/, (p, v, m) => p.aoUsar.imunidades.push({ afeccao: IMUNIDADE[m[1]], ms: v * 1000 })],
  [/^Desacelera Inimigos próximos com Velocidade de Movimento reduzida em \{\d+\}% se usado enquanto não estiver em (?:Vida|Mana) Cheia$/, (p, v) => (p.aoUsar.desacelerarPct = v)],
  [/^Provoca Inimigos próximos ao usar$/, (p) => (p.aoUsar.provocar = true)],
  [/^Cria Solo Congelado ao Utilizar$/, (p) => (p.aoUsar.solo = 'congelado')],
  [/^Cria uma Nuvem de Fumaça ao ser Utilizado$/, (p) => (p.aoUsar.fumaca = true)],
  [/^Cria Solo Sagrado ao ser Utilizado$/, (p) => (p.aoUsar.solo = 'sagrado')],

];
const DURANTE = / durante o (Efeito|efeito do Frasco)$/;
/** "Concede Imunidade a X … se usado enquanto X": a afecção do PoE → o efeito do jogo que ela tira (e de que fica imune). */
const IMUNIDADE = { Desaceleração: 'lento', Mutilação: 'lento', Sangramento: 'sangramento', 'Sangue Corrompido': 'sangramento', Eletrização: 'eletrizacao', Resfriamento: 'resfriamento', Congelamento: 'congelamento', Incêndio: 'incendio', Envenenamento: 'veneno' };
/** Os mods do PERSONAGEM que mexem nos frascos ("Recuperação de Vida do Frasco aumentada", "Duração do efeito do Frasco"…): quem lê é a ficha. */
// (`var` + declaração de função: a ficha registra o leitor enquanto os módulos ainda carregam — o ciclo ficha ↔ frascos.)
// eslint-disable-next-line no-var
var leitorDoPersonagem;
export function definirLeitor(fn) { leitorDoPersonagem = fn; }
const doPersonagem = (estado) => (estado && leitorDoPersonagem ? leitorDoPersonagem(estado) ?? {} : {});

/**
 * Os parâmetros de um frasco (a base + os mods): `{ tipo, recurso, quantidade, ms, instantaneo, cargasPorUso, cargasMaximas, duracaoMs,
 * efeitoPct, recargaPct, durante: { af }, linhas: [{ texto, estado }] }`. As linhas que não casam com nada ficam `registrado`.
 */
export function parametros(peca, afDoPersonagem = null) {
  const poe = peca?.poe ?? {};
  const a = poe.atributos ?? {};
  const tipo = TIPO_DA_CLASSE[poe.classe] ?? null;
  const p = { velocidadePct: 0, quantidadePct: 0, instantaneo: false, recargaPct: 0, cargasMaximas: Number(a.cargas_maximas) || 0, custoPct: 0, duracaoPct: 0, duracaoMenos: 1, efeitoPct: 0, maisNaVidaBaixaPct: 0,
    instantaneoPct: 0, instantaneoNaVidaBaixa: false, instantaneoNoFim: false, naoParaNoCheio: false, naoAcumula: false, saiNoPvp: false, custoDaOutraPct: 0, lacaiosPct: 0, cargaNoCriticoPct: 0, cargasAoSerAcertado: 0,
    aoUsar: { imunidades: [] } };
  // Os mods do PERSONAGEM (cinto, anéis…): recuperação de vida/mana dos frascos, duração e efeito dos de Utilidade, cargas usadas.
  const pp = afDoPersonagem ?? {};
  const n = (k) => Number(pp[k]) || 0;
  p.quantidadePct += tipo === 'vida' ? n('frasco_vida_rec') : tipo === 'mana' ? n('frasco_mana_rec') : 0;
  if (tipo === 'utilidade') { p.duracaoPct += n('frasco_duracao'); p.efeitoPct += n('frasco_efeito'); }
  p.custoPct -= n('frasco_cargas_usadas_red');
  // ("Frascos de Vida usados enquanto em Vida Baixa aplicam sua Recuperação Instantaneamente", o mesmo da Mana em Mana Baixa.)
  if (tipo && n(`frasco_instantaneo_baixa:${tipo}`) > 0) p.instantaneoNaVidaBaixa = true;
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
        regra[1](p, nums[0] ?? 0, parte.match(regra[0]));
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
      // "Restaura Proteção ao usar": a Proteção (Ward) não existe no jogo — o balão explica. O resto passa pela tradução (o que ela marca
      // como inerte, como na peça).
      const tr = traduzirParte(parte, mod.valores ?? []);
      linhas.push({ texto, estado: /Restaura Proteção/.test(parte) || tr.estado === 'inerte' ? 'inerte' : 'registrado' });
    }
    const minhas = linhas.slice(antes);
    estadosPorMod.push(minhas.every((l) => l.estado === 'efeito') ? 'equivalente' : minhas.some((l) => l.estado === 'efeito') ? 'aproximado' : minhas.every((l) => l.estado === 'inerte') ? 'inerte' : 'registrado');
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
    instantaneoPct: Math.min(100, p.instantaneoPct), instantaneoNaVidaBaixa: p.instantaneoNaVidaBaixa, instantaneoNoFim: p.instantaneoNoFim, naoParaNoCheio: p.naoParaNoCheio,
    naoAcumula: p.naoAcumula, saiNoPvp: p.saiNoPvp, custoDaOutraPct: p.custoDaOutraPct, lacaiosPct: p.lacaiosPct, cargaNoCriticoPct: p.cargaNoCriticoPct, cargasAoSerAcertado: p.cargasAoSerAcertado, aoUsar: p.aoUsar,
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
  if (!cabeNaMochila(estado, peca.id, 1)) return { ok: false, erro: erroDeEspaco(estado, peca.id, 1) };
  c[v] = null;
  darPeca(estado, peca);
  if (estado.hunt?.frascosPoe) delete estado.hunt.frascosPoe.ativos?.[v];
  return { ok: true, notice: `${peca.poe?.nome ?? 'Frasco'} de volta à mochila.` };
}

/**
 * Troca a ORDEM no cinto (dono, 07/10: "arrastar no inventário a ordem dos flasks"): o frasco da vaga `de` vai para `para` e o de lá (ou a
 * vaga vazia) vem para `de`. As cargas e a regra de uso vão junto (moram na peça); o efeito ativo na caçada também troca de vaga.
 */
export function mover(estado, { de, para }) {
  const c = cinto(estado);
  const a = Number(de);
  const b = Number(para);
  if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < c.length && b < c.length)) return { ok: false, erro: 'Vaga do cinto inválida.' };
  if (!c[a]) return { ok: false, erro: 'Essa vaga do cinto está vazia.' };
  if (a === b) return { ok: true };
  [c[a], c[b]] = [c[b] ?? null, c[a]];
  const ativos = estado.hunt?.frascosPoe?.ativos;
  if (ativos) {
    const [xa, xb] = [ativos[a], ativos[b]];
    if (xb === undefined) delete ativos[a]; else ativos[a] = xb;
    if (xa === undefined) delete ativos[b]; else ativos[b] = xa;
  }
  return { ok: true };
}

// ---------------------------------------------------------------- na caçada

const estadoDaCacada = (hunt) => (hunt.frascosPoe ??= { ativos: {} });

/** Usa o frasco da vaga `v` agora (gasta as cargas e liga o efeito). Devolve true se usou. */
export function usar(estado, v, eventos = null, quem = null) {
  const hunt = estado.hunt;
  const peca = cinto(estado)[v];
  if (!hunt || !peca) return false;
  const afp = doPersonagem(estado);
  // "Não pode usar Frascos no Quinto Espaço" (o cinto do PoE); "Não pode usar frascos de vida/mana"; "Frascos não são aplicados em Você".
  if (v === 4 && Number(afp.sem_quinto_frasco) > 0) return false;
  if (Number(afp[`sem_frasco:${TIPO_DA_CLASSE[peca.poe?.classe]}`]) > 0 || Number(afp.frascos_nao_aplicam) > 0) return false;
  const par = parametros(peca, afp);
  const cargas = cargasDe(peca, par);
  if (cargas < par.cargasPorUso) return false;
  const st = estadoDaCacada(hunt);
  const agora = hunt.clock ?? 0;
  if (st.ativos[v]?.ate > agora) return false;
  peca.poe.cargas = cargas - par.cargasPorUso;
  aoUsarOFrasco(estado, par, eventos, quem);
  if (par.tipo === 'utilidade') {
    st.ativos[v] = { ate: agora + par.duracaoMs, af: par.af, nome: peca.poe.nome, ...(par.saiNoPvp ? { saiNoPvp: true } : {}) };
    return true;
  }
  // Vida/Mana: na vida baixa (abaixo de 50%), o "mais Recuperação se usado enquanto em Vida Baixa" (o de mana olha a Mana Baixa).
  const vidaBaixa = par.recurso === 'mana' && Number(afp['frasco_instantaneo_baixa:mana']) > 0 ? (estado.mana ?? 0) <= (estado.maxMana ?? 1) * 0.5 : (estado.hp ?? 0) < (estado.maxHp ?? 1) * 0.5;
  const total = par.quantidade * (vidaBaixa ? 1 + par.maisNaVidaBaixaPct / 100 : 1);
  const extras = { custoDaOutraPct: par.custoDaOutraPct, lacaiosPct: par.lacaiosPct };
  // "Recuperação Instantânea" (ou "quando em Vida Baixa", na vida baixa): tudo na hora.
  if (par.instantaneo || (par.instantaneoNaVidaBaixa && vidaBaixa)) {
    recuperar(estado, par.recurso, total, eventos, quem, extras);
    st.ativos[v] = { ate: agora + 250, recurso: par.recurso, nome: peca.poe.nome };
    return true;
  }
  // "X% da Recuperação aplicada Instantaneamente": essa parte na hora, o resto ao longo do tempo.
  const naHora = (total * (par.instantaneoPct ?? 0)) / 100;
  if (naHora > 0) recuperar(estado, par.recurso, naHora, eventos, quem, extras);
  const resto = total - naHora;
  // "Recuperação de Mana ocorre instantaneamente no término do Efeito": nada ao longo do tempo, tudo no fim.
  if (par.instantaneoNoFim) st.ativos[v] = { ate: agora + par.ms, recurso: par.recurso, nome: peca.poe.nome, noFim: resto, extras };
  else st.ativos[v] = { ate: agora + par.ms, de: agora, ultimo: agora, porMs: resto / par.ms, recurso: par.recurso, nome: peca.poe.nome, extras, ...(par.naoParaNoCheio ? { naoParaNoCheio: true } : {}) };
  return true;
}

/** O que o frasco faz AO SER USADO (PoE): tirar Maldições/Incêndios, as imunidades "se usado enquanto…", desacelerar/provocar em volta e os solos. */
const RAIO_DO_FRASCO = 3;
const SOLO_MS = 5000;
function aoUsarOFrasco(estado, par, eventos, quem) {
  const hunt = estado.hunt;
  const u = par.aoUsar ?? {};
  const agora = hunt.clock ?? 0;
  if (u.removerMaldicao) Dot.removerDoJogador(hunt, 'maldicao');
  if (u.removerIncendio) Dot.removerDoJogador(hunt, 'queimadura');
  for (const im of u.imunidades ?? []) {
    // Só "se usado enquanto" afetado: tira o efeito e fica imune pelo tempo.
    const tipos = { sangramento: ['sangramento'], incendio: ['queimadura'], veneno: ['veneno', 'venenoPoe'], eletrizacao: ['choque'], resfriamento: ['gelo'] }[im.afeccao] ?? [];
    const temDot = tipos.some((t) => (hunt.efeitosDoJogador?.dots ?? []).some((d) => d.tipo === t && d.falta > 0));
    const c = hunt.controle ?? {};
    const temControle = (im.afeccao === 'congelamento' && c.congelado?.ate > agora) || ((im.afeccao === 'lento' || im.afeccao === 'resfriamento') && c.lento?.ate > agora);
    if (!temDot && !temControle) continue;
    for (const t of tipos) Dot.removerDoJogador(hunt, t);
    if (im.afeccao === 'congelamento') delete c.congelado;
    if (im.afeccao === 'lento' || im.afeccao === 'resfriamento') delete c.lento;
    (hunt.imunidadesPoe ??= {})[im.afeccao] = Math.max(hunt.imunidadesPoe[im.afeccao] ?? 0, agora + im.ms);
  }
  const perto = (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) <= RAIO_DO_FRASCO);
  const ev = (m, st) => eventos?.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: st });
  for (const m of perto) {
    const e = (m.estados ??= {});
    const lento = (pct, ms) => { e.lento = e.lento && e.lento.ate > agora ? { ate: Math.max(e.lento.ate, agora + ms), pct: Math.max(e.lento.pct, pct) } : { ate: agora + ms, pct }; ev(m, 'lento'); };
    if (u.desacelerarPct) lento(u.desacelerarPct, par.ms || 4000);
    // Solo Congelado: resfria quem está em cima (10% de lentidão, o Resfriamento base do PoE).
    if (u.solo === 'congelado') lento(10, SOLO_MS);
    if (u.provocar) { e.provocado = { ate: agora + 3000 }; ev(m, 'provocado'); }
    // Nuvem de Fumaça: Cega quem está em volta.
    if (u.fumaca) { e.cego = { ate: agora + 4000 }; ev(m, 'cego'); }
  }
  // Solo Sagrado: regenera 6% da vida por segundo enquanto o personagem está nele.
  if (u.solo === 'sagrado') (hunt.frascosPoe.extras ??= []).push({ ate: agora + SOLO_MS, af: { life_regen_max_pct: 6 }, nome: 'Solo Sagrado' });
}

function recuperar(estado, recurso, valor, eventos, quem, extras = null) {
  const [campo, maximo, cor] = recurso === 'mana' ? ['mana', 'maxMana', '#4fc3ff'] : ['hp', 'maxHp', '#00ff66'];
  const ganho = Math.min(Math.max(0, valor), Math.max(0, (estado[maximo] ?? 0) - (estado[campo] ?? 0)));
  // "Repassa X% da Recuperação de Vida para Lacaios" (o que o frasco recupera, mesmo com a vida cheia).
  if (extras?.lacaiosPct > 0 && recurso !== 'mana') for (const l of estado.hunt?.lacaios ?? []) if (l.hp > 0) l.hp = Math.min(l.maxHp, l.hp + (valor * extras.lacaiosPct) / 100);
  if (!(ganho > 0)) return 0;
  estado[campo] = (estado[campo] ?? 0) + ganho;
  // "Retira X% de Vida Recuperada da Mana" (e o contrário): a outra barra paga.
  if (extras?.custoDaOutraPct > 0) {
    const outra = recurso === 'mana' ? 'hp' : 'mana';
    estado[outra] = Math.max(outra === 'hp' ? 1 : 0, (estado[outra] ?? 0) - (ganho * extras.custoDaOutraPct) / 100);
  }
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
      if (ate > a.ultimo) recuperar(estado, a.recurso, a.porMs * (ate - a.ultimo), eventos, quem, a.extras);
      a.ultimo = ate;
      // PoE: o frasco de MANA para quando a mana enche (o "Efeito não é removido quando a Mana Não Reservada Encher" segue).
      if (a.recurso === 'mana' && !a.naoParaNoCheio && (estado.mana ?? 0) >= (estado.maxMana ?? 0)) a.ate = Math.min(a.ate, agora);
    }
    if (a.ate <= agora) {
      if (a.noFim > 0) recuperar(estado, a.recurso, a.noFim, eventos, quem, a.extras);
      if (a.af) mudou = true;
      delete st.ativos[v];
    }
  }
  if (st.extras?.length) {
    const antes = st.extras.length;
    st.extras = st.extras.filter((x) => x.ate > agora);
    if (st.extras.length !== antes) mudou = true;
  }
  // As CARGAS dos frascos pelo tempo e pelos acontecimentos (PoE): "Frascos Utilitários ganham N Cargas a cada S segundos" (personagem),
  // "X% de chance de ganhar uma Carga de Frasco ao causar um Golpe Crítico" e "Ganhe N Cargas ao ser Acertado" (o frasco).
  const afp = doPersonagem(estado);
  // (+ "Frascos de Vida/Mana ganham N Cargas a cada S segundos", "Em vida baixa, frascos de vida ganham…" — `frasco_regen_n:<tipo>`.)
  const regens = [['utilidade', Number(afp.frasco_util_regen_n) || 0, Number(afp.frasco_util_regen_s) || 0], ...['vida', 'mana', 'utilidade', 'todos'].map((t) => [t, Number(afp[`frasco_regen_n:${t}`]) || 0, Number(afp[`frasco_regen_s:${t}`]) || 0])];
  for (const [tipoR, quantas, cadaS] of regens) {
    if (!(cadaS > 0 && quantas > 0)) continue;
    const chave = `proximaRegen:${tipoR}:${cadaS}`;
    st[chave] ??= agora + cadaS * 1000;
    while (agora >= st[chave]) {
      st[chave] += cadaS * 1000;
      for (const p of c) if (p && (tipoR === 'todos' || TIPO_DA_CLASSE[p.poe?.classe] === tipoR)) { const par = parametros(p, afp); p.poe.cargas = Math.min(par.cargasMaximas, cargasDe(p, par) + quantas); }
    }
  }
  const criticos = hunt.poeCriticosParaFrascos ?? 0;
  const acertos = hunt.poeAcertosParaFrascos ?? 0;
  if (criticos || acertos) {
    for (const p of c) {
      if (!p) continue;
      const par = parametros(p, afp);
      let ganho = acertos * par.cargasAoSerAcertado;
      for (let k = 0; k < criticos; k++) if (par.cargaNoCriticoPct > 0 && Math.random() * 100 < par.cargaNoCriticoPct) ganho++;
      if (ganho > 0) p.poe.cargas = Math.min(par.cargasMaximas, cargasDe(p, par) + ganho);
    }
    hunt.poeCriticosParaFrascos = 0;
    hunt.poeAcertosParaFrascos = 0;
  }
  if (estado.hp <= 0) return mudou;
  // O uso automático.
  const emCombate = (hunt.monstros ?? []).some((m) => m.hp > 0);
  const recuperando = (r) => Object.values(st.ativos).some((a) => a.recurso === r && a.ate > agora);
  for (let v = 0; v < c.length; v++) {
    const p = c[v];
    if (!p || st.ativos[v]?.ate > agora || (v === 4 && Number(afp.sem_quinto_frasco) > 0)) continue;
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

/** Enche todos os frascos do cinto (a cidade). */
export function encherNaCidade(estado) {
  for (const p of cinto(estado)) if (p?.poe) p.poe.cargas = parametros(p).cargasMaximas;
}

/** Matou um monstro: cargas para todos os frascos do cinto, pela raridade dele (× a Recuperação de Cargas de cada frasco). */
export function aoMatar(estado, tipoDoMonstro = 'normal') {
  if (!ligado()) return;
  const base = Number(F().cargasPorMorte?.[tipoDoMonstro] ?? F().cargasPorMorte?.normal ?? 1) || 0;
  // (+ a "Recarga de Frasco recebida aumentada" do personagem.)
  const afp = doPersonagem(estado);
  const doPersonagemPct = Number(afp.frasco_cargas_recebidas) || 0;
  for (const p of cinto(estado)) {
    if (!p) continue;
    const par = parametros(p, afp);
    p.poe.cargas = Math.min(par.cargasMaximas, cargasDe(p, par) + base * Math.max(0, 1 + (par.recargaPct + doPersonagemPct) / 100));
  }
}

/** PoE: o personagem foi acertado por OUTRO JOGADOR (o duelo): os frascos com "Efeito é removido quando Acertado por um Jogador" acabam. */
export function aoSerAcertadoPorJogador(estado) {
  const st = estado?.hunt?.frascosPoe;
  if (!st) return false;
  let mudou = false;
  for (const [v, a] of Object.entries(st.ativos)) if (a.saiNoPvp) { delete st.ativos[v]; mudou = true; }
  return mudou;
}

/** Os atributos dos frascos de Utilidade ativos agora (somados em `Afixos.soma`). null: nenhum. */
export function adds(estado) {
  const st = estado?.hunt?.frascosPoe;
  if (!st) return null;
  const agora = estado.hunt.clock ?? 0;
  const total = {};
  for (const a of [...Object.values(st.ativos), ...(st.extras ?? [])]) if (a.af && a.ate > agora) for (const [k, v] of Object.entries(a.af)) total[k] = (total[k] ?? 0) + v;
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
  // Na cidade (fora da caçada) os frascos estão sempre cheios (dono, 07/10: "voltando para a cidade recupera na hora a carga").
  if (!estado.hunt) encherNaCidade(estado);
  const agora = estado.hunt?.clock ?? 0;
  const ativos = estado.hunt?.frascosPoe?.ativos ?? {};
  return cinto(estado).map((p, v) => {
    if (!p) return null;
    const par = parametros(p, doPersonagem(estado));
    const regra = regraDe(p);
    return { peca: p, cargas: Math.floor(cargasDe(p, par)), cargasMaximas: par.cargasMaximas, cargasPorUso: par.cargasPorUso, tipo: par.tipo, ativoAte: ativos[v]?.ate > agora ? ativos[v].ate - agora : 0, regra: { abaixoPct: regra.abaixoPct, emCombate: regra.emCombate } };
  });
}
