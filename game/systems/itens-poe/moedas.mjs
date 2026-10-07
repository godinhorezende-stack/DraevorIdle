// As MOEDAS EMPILHÁVEIS do PoE no jogo (dono, 07/10: "cadastre todas as moedas empilháveis com suas funcionalidades, utilizando a forja
// refazendo para uso dos itens que têm efeito, e fale quais estão funcionando"). Só com ITENS_POE=1.
//
// As 195 moedas da coleção (`gamedata/itens-poe/moedas-poe.json`, tools/importar-moedas-poe.mjs) entram como itens empilháveis com o
// ícone do PoE. O que cada uma FAZ mora aqui (`EFEITOS`): a peça é a do PoE (`peca.poe`: raridade, prefixos, sufixos, implícitos,
// qualidade...), a moeda muda o `poe` e a peça é REMONTADA (`Jogo.recalcular`). Quem usa é a FORJA do PoE (a bancada: escolhe a peça e a
// moeda, vê o que vai acontecer e aplica — `{t:'moeda', moeda, alvo}`).
//
// `STATUS[slug]`: 'funciona' (faz o que o PoE faz), 'parcial' (faz, com uma simplificação — o motivo diz qual) ou 'nao' (o sistema que
// ela usa não existe no jogo: mapas, Atlas, influências, ligas... — fica cadastrada, sem efeito). Peça CORROMPIDA (o Orbe Vaal) não
// aceita moeda, só as Corroídas (Tainted); peça ESPELHADA (o Espelho de Kalandra) não aceita nenhuma.
import { readFileSync } from 'node:fs';
import { ITEM_CATALOG } from '../dados.mjs';
import * as Catalogo from './catalogo.mjs';
import * as Gerar from './gerar.mjs';
import * as Jogo from './jogo.mjs';
import * as SocketsPoe from './sockets.mjs';
import * as Gemas from '../skills/gemas.mjs';

export const MOEDAS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/moedas-poe.json', import.meta.url), 'utf8')).moedas;
const POR_SLUG = new Map(MOEDAS.map((m) => [m.slug, m]));
const POR_ID = new Map(MOEDAS.map((m) => [m.itemId, m]));
export const moedaDoItem = (id) => POR_ID.get(Number(id)) ?? null;
export const idDa = (slug) => POR_SLUG.get(slug)?.itemId ?? null;
const R = () => Catalogo.REGRAS;
const CAT = () => Catalogo.catalogo();

// ---------------------------------------------------------------- ajudas
const erro = (e) => ({ ok: false, erro: e });
const mods = (p) => [...(p.prefixos ?? []), ...(p.sufixos ?? [])];
const ehUnico = (p) => p.raridade === 'unico';
const ehFrasco = (p) => Jogo.FRASCOS.includes(p.classe);
const ehArma = (p) => !!p.atributos?.dano_fisico;
const ehArmadura = (p) => !!(p.atributos?.armadura || p.atributos?.evasao || p.atributos?.escudo_energia);
const sortear = (lista, rng) => lista[Math.floor(rng() * lista.length)];
/** Põe um mod novo (do lado com vaga). */
function porMod(p, rng, lados) {
  const novo = Gerar.sortearUmMod({ catalogo: CAT(), regras: R(), poe: p, rng, lados });
  if (!novo) return false;
  (p[`${novo.lado}s`] ??= []).push(novo.mod);
  return true;
}
/** Quantos mods pela raridade (`regras.raridades.<r>.quantidade`). */
const quantosPela = (raridade, rng) => Number(Gerar.porPeso(Object.entries(R().raridades[raridade]?.quantidade ?? { 0: 1 }), rng)) || 0;
/** Refaz os mods (mantém os TALHADOS — o Orbe Talhador). */
function refazerMods(p, raridade, rng) {
  const ficam = (lado) => (p[lado] ?? []).filter((m) => m.talhado);
  p.raridade = raridade;
  p.prefixos = ficam('prefixos');
  p.sufixos = ficam('sufixos');
  const alvo = Math.max(quantosPela(raridade, rng), mods(p).length);
  for (let i = mods(p).length; i < alvo; i++) if (!porMod(p, rng)) break;
  if (raridade === 'magico') p.nome = [p.prefixos[0]?.nome, nomeDaBase(p), p.sufixos[0]?.nome].filter(Boolean).join(' ');
  else p.nome = nomeDaBase(p);
}
const nomeDaBase = (p) => Gerar.acharBase(CAT(), p.base)?.base?.nome ?? p.nome;
/** Os valores de um mod de novo, dentro das faixas do tier dele (`tier` outro = troca o tier). */
function rerolarValores(p, m, rng, tier = null) {
  const t = tier ?? Gerar.tierDoMod(CAT(), p, m)?.tier;
  if (!t) return false;
  const novo = Gerar.rolarTexto(t, rng);
  Object.assign(m, { modelo: novo.modelo, valores: novo.valores, texto: novo.texto, ...(tier ? { tier: tier.tier, nome: tier.nome, ilvl: tier.ilvl } : {}) });
  return true;
}
/** O cadastro do único da peça (os mods com as faixas). */
const cadastroDoUnico = (p) => CAT()?.classes?.[p.classe]?.unicos?.find((u) => u.slug === p.unico) ?? null;
/** A qualidade a mais (Amolador, Sucata, Bolha): +5 na normal, +2 na mágica, +1 na rara/única, até 20%. */
function subirQualidade(p) {
  const q = Number(p.qualidade) || 0;
  if (q >= 20) return null;
  const ganho = p.raridade === 'normal' ? 5 : p.raridade === 'magico' ? 2 : 1;
  p.qualidade = Math.min(20, q + ganho);
  return `Qualidade: ${q}% → ${p.qualidade}%.`;
}
/** Uma peça qualquer de uma base que tem único: vira um único sorteado da mesma base. */
function virarUnico(p, rng, mesmaClasse = false) {
  const unicos = (CAT()?.classes?.[p.classe]?.unicos ?? []).filter((u) => (mesmaClasse ? u.slug !== p.unico : u.base === nomeDaBase(p)));
  if (!unicos.length) return null;
  const u = sortear(unicos, rng);
  const base = mesmaClasse ? CAT().classes[p.classe].bases.find((b) => b.nome === u.base) : null;
  const gerada = Gerar.gerarPeca({ catalogo: CAT(), regras: R(), base: base?.id ?? p.base, raridade: 'unico', ilvl: p.ilvl, rng, unico: u.slug });
  if (gerada.erro) return null;
  Object.assign(p, { base: gerada.base, nome: gerada.nome, unico: gerada.unico, raridade: 'unico', atributos: gerada.atributos, implicitos: gerada.implicitos, prefixos: [], sufixos: [], modificadores: gerada.modificadores });
  return gerada.nome;
}

// ---------------------------------------------------------------- os SOCKETS (Cromático, Joalheiro, Fusão e as Corroídas)
function comSockets(peca, fazer) {
  const s = Gemas.soquetesDe(peca);
  if (!s) return erro('Esta peça não tem sockets.');
  return fazer(s);
}

// ---------------------------------------------------------------- os EFEITOS
// Cada um: `(contexto) => { ok, notice } | { ok:false, erro }`. Contexto: `{ estado, peca, p (= peca.poe), alvo, rng, moeda }`.
const so = (cond, msg) => (cond ? null : erro(msg));
const transmutar = ({ p, rng }) =>
  so(p.raridade === 'normal', 'A Orbe da Transmutação só vale em peça Normal.') ?? (refazerMods(p, 'magico', rng), { ok: true, notice: `${p.nome}: agora Mágica.` });
const ampliar = ({ p, rng }) => {
  if (p.raridade !== 'magico') return erro('Só vale em peça Mágica.');
  if (mods(p).length >= 2 || !porMod(p, rng)) return erro('A peça Mágica já tem os dois modificadores.');
  p.nome = [p.prefixos[0]?.nome, nomeDaBase(p), p.sufixos[0]?.nome].filter(Boolean).join(' ');
  return { ok: true, notice: `${p.nome}: ganhou um modificador.` };
};
const alterar = ({ p, rng }) => so(p.raridade === 'magico', 'A Orbe da Alteração só vale em peça Mágica.') ?? (refazerMods(p, 'magico', rng), { ok: true, notice: `${p.nome}: modificadores novos.` });
const regio = ({ p, rng }) => {
  if (p.raridade !== 'magico') return erro('A Orbe Régia só vale em peça Mágica.');
  p.raridade = 'raro';
  porMod(p, rng);
  p.nome = nomeDaBase(p);
  return { ok: true, notice: `${p.nome}: agora Rara, com um modificador a mais.` };
};
const alquimia = ({ p, rng }) => so(p.raridade === 'normal', 'A Orbe da Alquimia só vale em peça Normal.') ?? (refazerMods(p, 'raro', rng), { ok: true, notice: `${p.nome}: agora Rara.` });
const caos = ({ p, rng }) => so(p.raridade === 'raro', 'O Orbe do Caos só vale em peça Rara.') ?? (refazerMods(p, 'raro', rng), { ok: true, notice: `${p.nome}: modificadores novos.` });
const exaltar = ({ p, rng }) => {
  if (p.raridade !== 'raro') return erro('Só vale em peça Rara.');
  if (!porMod(p, rng)) return erro('A peça Rara já tem todos os modificadores (3 prefixos e 3 sufixos).');
  return { ok: true, notice: `${p.nome}: ganhou um modificador.` };
};
const expurgar = ({ p }) => {
  if (!['magico', 'raro'].includes(p.raridade)) return erro('O Orbe do Expurgo vale em peça Mágica ou Rara.');
  const talhados = mods(p).filter((m) => m.talhado);
  p.prefixos = (p.prefixos ?? []).filter((m) => m.talhado);
  p.sufixos = (p.sufixos ?? []).filter((m) => m.talhado);
  if (!talhados.length) p.raridade = 'normal';
  p.nome = nomeDaBase(p);
  return { ok: true, notice: `${p.nome}: os modificadores saíram${talhados.length ? ' (o talhado fica)' : ' — agora Normal'}.` };
};
const anular = ({ p, rng }) => {
  if (!['magico', 'raro'].includes(p.raridade)) return erro('O Orbe da Anulação vale em peça Mágica ou Rara.');
  const podem = mods(p).filter((m) => !m.talhado);
  if (!podem.length) return erro('Não há modificador para tirar.');
  const m = sortear(podem, rng);
  p.prefixos = (p.prefixos ?? []).filter((x) => x !== m);
  p.sufixos = (p.sufixos ?? []).filter((x) => x !== m);
  return { ok: true, notice: `Saiu: ${m.texto}.` };
};
const divino = ({ p, rng }) => {
  if (ehUnico(p)) {
    const u = cadastroDoUnico(p);
    if (!u) return erro('O cadastro deste único não está no catálogo.');
    p.modificadores = u.modificadores.map((m) => ({ tipo: m.tipo, ...Gerar.rolarTexto(m, rng) }));
    return { ok: true, notice: `${p.nome}: os valores foram sorteados de novo.` };
  }
  const ms = mods(p);
  if (!ms.length) return erro('A peça não tem modificadores.');
  for (const m of ms) rerolarValores(p, m, rng);
  return { ok: true, notice: `${p.nome}: os valores dos modificadores foram sorteados de novo.` };
};
const abencoar = ({ p, rng }) => {
  const base = Gerar.acharBase(CAT(), p.base)?.base;
  if (!base?.implicitos?.length) return erro('A base desta peça não tem implícito.');
  // "Modificadores Implícitos Não Podem ser Mudados" (a base): o Orbe Abençoado não vale nela, como no PoE.
  if (Gerar.regrasDaBase(p.implicitos).implicitosFixos) return erro('Os implícitos desta base não podem ser mudados.');
  p.implicitos = base.implicitos.map((t) => Gerar.rolarTexto(t, rng));
  return { ok: true, notice: `Implícito: ${p.implicitos.map((i) => i.texto).join('; ')}.` };
};
const sagrado = ({ p, rng }) => {
  const base = Gerar.acharBase(CAT(), p.base)?.base;
  const def = Object.entries(base?.atributos ?? {}).filter(([k, v]) => ['armadura', 'evasao', 'escudo_energia'].includes(k) && v && typeof v === 'object');
  if (!def.length) return erro('O Orbe Sagrado vale em armadura (defesa da base).');
  for (const [k, v] of def) p.atributos[k] = Gerar.sortearNaFaixa([v.min, v.max], rng);
  return { ok: true, notice: `Defesa da base sorteada de novo.` };
};
const chance = ({ p, rng }) => {
  if (p.raridade !== 'normal') return erro('A Orbe da Chance só vale em peça Normal.');
  const pesos = R().moedas?.chance ?? { unico: 1, raro: 19, magico: 80 };
  const vira = Gerar.porPeso(Object.entries(pesos), rng);
  if (vira === 'unico' && virarUnico(p, rng)) return { ok: true, notice: `Sorte: virou o único ${p.nome}!` };
  refazerMods(p, vira === 'raro' ? 'raro' : 'magico', rng);
  return { ok: true, notice: `${p.nome}: agora ${R().raridades[p.raridade].nome}.` };
};
const amolador = ({ p }) => {
  if (!ehArma(p)) return erro('O Amolador do Ferreiro vale em arma.');
  const t = subirQualidade(p);
  return t ? { ok: true, notice: t } : erro('A arma já está com 20% de qualidade.');
};
const sucata = ({ p }) => {
  if (!ehArmadura(p)) return erro('A Sucata do Armeiro vale em armadura.');
  const t = subirQualidade(p);
  return t ? { ok: true, notice: t } : erro('A armadura já está com 20% de qualidade.');
};
const bolha = ({ p }) => {
  if (!ehFrasco(p)) return erro('A Bolha do Vidreiro vale em frasco.');
  const t = subirQualidade(p);
  return t ? { ok: true, notice: t } : erro('O frasco já está com 20% de qualidade.');
};
const elo = (ctx) => {
  const r = alquimia(ctx);
  if (!r.ok) return erro('A Orbe do Elo só vale em peça Normal.');
  const s = Gemas.soquetesDe(ctx.peca);
  if (s) {
    const n = Math.min(4, s.abertos);
    Gemas.gravarSoquetes(ctx.peca, { ...s, links: s.links.map((l, i) => (i + 1 < n ? true : l)) });
  }
  return { ok: true, notice: `${ctx.p.nome}: agora Rara, com até 4 sockets ligados.` };
};
const talhar = ({ p, rng }) => {
  if (p.raridade !== 'raro' || mods(p).length < 4) return erro('O Orbe Talhador vale em peça Rara com ao menos 4 modificadores.');
  if (mods(p).some((m) => m.talhado)) return erro('A peça já tem um modificador talhado.');
  const m = sortear(mods(p), rng);
  m.talhado = true;
  return { ok: true, notice: `Talhado (não sai mais): ${m.texto}.` };
};
const espelhar = ({ estado, peca, p }) => {
  if (p.espelhado) return erro('Uma peça espelhada não pode ser espelhada de novo.');
  const copia = structuredClone(peca);
  copia.poe.espelhado = true;
  if (copia.soquetes) copia.soquetes.gemas = (copia.soquetes.gemas ?? []).map(() => null);
  (estado.inventory ??= []).push(copia);
  return { ok: true, notice: `Espelho de Kalandra: a cópia espelhada de ${p.nome} está na mochila.` };
};
const ancestral = ({ p, rng }) => {
  if (!ehUnico(p)) return erro('O Orbe Ancestral vale em peça Única.');
  const nome = virarUnico(p, rng, true);
  return nome ? { ok: true, notice: `Virou ${nome}.` } : erro('Não há outro único desta classe de item.');
};
/** O Orbe Vaal: 1/4 nada; 1/4 sockets sorteados de novo (com chance de branco); 1/4 vira Rara com mods novos; 1/4 valores de novo. */
const vaal = (ctx) => {
  const { p, peca, rng } = ctx;
  p.corrompido = true;
  const caso = Math.floor(rng() * 4);
  if (caso === 0) return { ok: true, notice: `${p.nome}: corrompida — nada mais mudou.` };
  if (caso === 1) {
    const s = Gemas.soquetesDe(peca);
    if (s && !s.gemas.some(Boolean)) {
      const cores = SocketsPoe.sortearCores(s.max, ITEM_CATALOG[peca.id]?.poe?.requisitos ?? null, rng).map((c) => (rng() < 0.25 ? 'W' : c));
      Gemas.gravarSoquetes(peca, { ...s, cores });
      return { ok: true, notice: `${p.nome}: corrompida — os sockets mudaram de cor (pode haver branco).` };
    }
    return { ok: true, notice: `${p.nome}: corrompida — nada mais mudou.` };
  }
  if (caso === 2 && !ehUnico(p)) {
    refazerMods(p, 'raro', rng);
    return { ok: true, notice: `${p.nome}: corrompida — virou Rara com modificadores novos.` };
  }
  divino(ctx);
  return { ok: true, notice: `${p.nome}: corrompida — os valores mudaram.` };
};
/** Os fragmentos: 20 (5 no pergaminho) viram 1 orbe (a moeda inteira). */
const juntarLascas = (alvoSlug, quantos = 20) => ({ estado, moeda }) => {
  const tem = (estado.inventory ?? []).filter((x) => Number(x.id) === moeda.itemId).reduce((t, x) => t + (x.count ?? 1), 0);
  if (tem < quantos) return erro(`Junte ${quantos} para formar ${POR_SLUG.get(alvoSlug)?.nome ?? 'a moeda'} (você tem ${tem}).`);
  tirarDaMochila(estado, moeda.itemId, quantos - 1); // a última sai pelo gasto normal
  porNaMochila(estado, idDa(alvoSlug), 1);
  return { ok: true, notice: `${quantos} ${moeda.nome} viraram 1 ${POR_SLUG.get(alvoSlug)?.nome}.`, semAlvo: true };
};
const remorso = ({ estado }) => {
  const pa = (estado.passivas ??= {});
  pa.restituicoes = (pa.restituicoes ?? 0) + 1;
  return { ok: true, notice: `Ponto de restituição: tira 1 nó da árvore de passivas sem pagar (você tem ${pa.restituicoes}).`, semAlvo: true };
};
const lapidario = ({ estado, alvo }) => {
  const g = (estado.inventory ?? [])[alvo?.indice];
  if (!g || !Gemas.ehGema(g.id)) return erro('O Prisma do Lapidário vale numa gema da mochila.');
  g.gema ??= { nivel: 1, xp: 0 };
  const q = Number(g.gema.qualidade) || 0;
  if (q >= 20) return erro('A gema já está com 20% de qualidade.');
  g.gema.qualidade = q + 1;
  return { ok: true, notice: `Qualidade da gema: ${q}% → ${q + 1}%.`, gema: true };
};
/** A Lente do Lapidário: a gema vira outra do mesmo tipo (suporte → suporte; ativa → ativa da mesma cor), mesmo nível e qualidade. */
const lenteDoLapidario = ({ estado, alvo, rng }) => {
  const g = (estado.inventory ?? [])[alvo?.indice];
  const def = g && Gemas.defDaGema(g.id);
  if (!def?.poe) return erro('A Lente do Lapidário vale numa gema do PoE da mochila.');
  const outras = [...Gemas.DEFS.values()].filter((d) => d.poe && d.tipo === def.tipo && d.itemId !== def.itemId && (d.tipo === 'support' || d.poe.cor === def.poe.cor));
  if (!outras.length) return erro('Não há outra gema deste tipo.');
  const nova = sortear(outras, rng);
  g.id = nova.itemId;
  return { ok: true, notice: `${def.nome} virou ${nova.nome}.`, gema: true };
};

// As CORROÍDAS (Tainted): só em peça corrompida.
const soCorrompida = (fazer) => (ctx) => (ctx.p?.corrompido ? fazer(ctx) : erro('As moedas Corroídas só valem em peça corrompida.'));
const tCromatico = soCorrompida(({ peca, rng }) => comSockets(peca, (s) => {
  if (s.gemas.some(Boolean)) return erro('Tire as gemas da peça antes.');
  const cores = s.cores.map((c, i) => (i < s.abertos ? sortear(['R', 'G', 'B', 'W'], rng) : c));
  Gemas.gravarSoquetes(peca, { ...s, cores });
  return { ok: true, notice: 'Cores sorteadas sem pesar o atributo (pode haver branco).' };
}));
const tFusao = soCorrompida(({ peca, rng }) => comSockets(peca, (s) => {
  if (s.abertos < 2) return erro('Precisa de 2 sockets.');
  const i = Math.floor(rng() * (s.abertos - 1));
  const links = [...s.links];
  links[i] = !links[i];
  Gemas.gravarSoquetes(peca, { ...s, links });
  return { ok: true, notice: `Elo ${i + 1}–${i + 2}: ${links[i] ? 'ligado' : 'desligado'}.` };
}));
const tJoalheiro = soCorrompida(({ peca, rng }) => comSockets(peca, (s) => {
  if (s.gemas.some(Boolean)) return erro('Tire as gemas da peça antes.');
  const mais = s.abertos < s.max && (s.abertos <= 1 || rng() < 0.5);
  const abertos = mais ? s.abertos + 1 : s.abertos - 1;
  Gemas.gravarSoquetes(peca, { ...s, abertos, links: s.links.map((l, i) => (i + 1 < abertos ? l : false)) });
  return { ok: true, notice: `Sockets: ${s.abertos} → ${abertos}.` };
}));
const tCaos = soCorrompida((ctx) => {
  if (ctx.p.raridade !== 'raro') return erro('Vale em peça Rara corrompida.');
  if (ctx.rng() < 0.5) {
    refazerMods(ctx.p, 'raro', ctx.rng);
    return { ok: true, notice: 'Modificadores novos.' };
  }
  ctx.p.prefixos = [];
  ctx.p.sufixos = [];
  return { ok: true, notice: 'Todos os modificadores saíram.' };
});
const tExaltado = soCorrompida((ctx) => {
  if (ctx.p.raridade !== 'raro') return erro('Vale em peça Rara corrompida.');
  if (ctx.rng() < 0.5 && porMod(ctx.p, ctx.rng)) return { ok: true, notice: 'Ganhou um modificador.' };
  const r = anular(ctx);
  return r.ok ? r : { ok: true, notice: 'Nada mudou.' };
});
const tMitico = soCorrompida(({ estado, peca, p, rng, alvo }) => {
  if (ehUnico(p)) return erro('Vale em peça corrompida que não é Única.');
  if (rng() < 0.5) {
    const nome = virarUnico(p, rng);
    if (nome) return { ok: true, notice: `Virou o único ${nome}!` };
  }
  destruir(estado, alvo);
  return { ok: true, notice: `${p.nome} foi destruída.`, destruiu: true };
});
const tQualidade = (cond, msg) => soCorrompida(({ p, rng }) => {
  if (!cond(p)) return erro(msg);
  p.qualidade = Math.floor(rng() * 21);
  return { ok: true, notice: `Qualidade sorteada: ${p.qualidade}%.` };
});
const tLagrima = soCorrompida(({ p, rng }) => {
  const ms = mods(p);
  if (!ms.length) return erro('A peça não tem modificadores.');
  for (const m of ms) {
    const t = Gerar.tierDoMod(CAT(), p, m);
    if (!t) continue;
    const i = t.tiers.indexOf(t.tier);
    const j = Math.max(0, Math.min(t.tiers.length - 1, i + (rng() < 0.5 ? -1 : 1)));
    rerolarValores(p, m, rng, t.tiers[j]);
  }
  return { ok: true, notice: 'O tier de cada modificador subiu ou desceu.' };
});
const vaalVolatil = (ctx) => {
  if (ctx.p.corrompido) return erro('A peça já está corrompida.');
  ctx.p.corrompido = true;
  divino(ctx);
  return { ok: true, notice: `${ctx.p.nome}: corrompida — os valores foram sorteados de novo.` };
};
const vaalDjinn = (ctx) => (ehUnico(ctx.p) ? vaal(ctx) : erro('A Orbe Vaal Tocada por Djinn vale em peça Única.'));

/** Os orbes de socket (já existentes, `Gemas.usarOrbeDoPoe`, que gasta o orbe ele mesmo): só na peça vestida. */
const orbeDeSocket = (tipo) => ({ estado, alvo, rng }) => {
  if (alvo?.onde !== 'equipment') return erro('Esta moeda vale numa peça vestida (os sockets).');
  const r = Gemas.usarOrbeDoPoe(estado, { slot: alvo.slot, tipo }, rng);
  return r.ok ? { ...r, jaGastou: true } : r;
};

/** O efeito e o status de cada moeda que faz algo. `alvo`: 'peca' (equipamento do PoE), 'gema', 'nenhum'. `corrompida`: aceita corrompida. */
const FAZ = {
  Orb_of_Transmutation: { f: transmutar }, Orb_of_Augmentation: { f: ampliar }, Orb_of_Alteration: { f: alterar }, Regal_Orb: { f: regio },
  Orb_of_Alchemy: { f: alquimia }, Chaos_Orb: { f: caos }, Exalted_Orb: { f: exaltar }, Orb_of_Scouring: { f: expurgar },
  Orb_of_Annulment: { f: anular }, Divine_Orb: { f: divino }, Blessed_Orb: { f: abencoar }, Sacred_Orb: { f: sagrado },
  Orb_of_Chance: { f: chance }, Blacksmiths_Whetstone: { f: amolador }, Armourers_Scrap: { f: sucata },
  Glassblowers_Bauble: { f: bolha },
  Orb_of_Binding: { f: elo }, Fracturing_Orb: { f: talhar }, Mirror_of_Kalandra: { f: espelhar }, Ancient_Orb: { f: ancestral },
  Vaal_Orb: { f: vaal, parcial: 'o implícito corrompido (vaal) não existe no catálogo: no lugar dele, os valores são sorteados de novo' },
  Volatile_Vaal_Orb: { f: vaalVolatil, parcial: 'sorteia os valores de novo dentro das faixas (sem passar delas) e corrompe' },
  'Djinn-Touched_Vaal_Orb': { f: vaalDjinn, parcial: 'corrompe o único como o Orbe Vaal (sem os efeitos próprios dos Djinn)' },
  Foulborn_Orb_of_Augmentation: { f: ampliar, parcial: 'sem a chance a mais de modificador Natimpuro (não existe no catálogo)' },
  Foulborn_Regal_Orb: { f: regio, parcial: 'sem a chance a mais de modificador Natimpuro (não existe no catálogo)' },
  Foulborn_Exalted_Orb: { f: exaltar, parcial: 'sem a chance a mais de modificador Natimpuro (não existe no catálogo)' },
  Tainted_Chromatic_Orb: { f: tCromatico, corrompida: true }, Tainted_Orb_of_Fusing: { f: tFusao, corrompida: true },
  Tainted_Jewellers_Orb: { f: tJoalheiro, corrompida: true }, Tainted_Chaos_Orb: { f: tCaos, corrompida: true },
  Tainted_Exalted_Orb: { f: tExaltado, corrompida: true }, Tainted_Mythic_Orb: { f: tMitico, corrompida: true },
  Tainted_Armourers_Scrap: { f: tQualidade(ehArmadura, 'Vale em armadura corrompida.'), corrompida: true },
  Tainted_Blacksmiths_Whetstone: { f: tQualidade(ehArma, 'Vale em arma corrompida.'), corrompida: true },
  Tainted_Divine_Teardrop: { f: tLagrima, corrompida: true },
  Chromatic_Orb: { f: orbeDeSocket('cromatico') }, Jewellers_Orb: { f: orbeDeSocket('joalheiro') }, Orb_of_Fusing: { f: orbeDeSocket('fusao') },
  Gemcutters_Prism: { f: lapidario, alvo: 'gema' }, Gemcutters_Lens: { f: lenteDoLapidario, alvo: 'gema' },
  Orb_of_Regret: { f: remorso, alvo: 'nenhum' },
  Transmutation_Shard: { f: juntarLascas('Orb_of_Transmutation'), alvo: 'nenhum' }, Alteration_Shard: { f: juntarLascas('Orb_of_Alteration'), alvo: 'nenhum' },
  Alchemy_Shard: { f: juntarLascas('Orb_of_Alchemy'), alvo: 'nenhum' }, Chaos_Shard: { f: juntarLascas('Chaos_Orb'), alvo: 'nenhum' },
  Regal_Shard: { f: juntarLascas('Regal_Orb'), alvo: 'nenhum' }, Exalted_Shard: { f: juntarLascas('Exalted_Orb'), alvo: 'nenhum' },
  Annulment_Shard: { f: juntarLascas('Orb_of_Annulment'), alvo: 'nenhum' }, Fracturing_Shard: { f: juntarLascas('Fracturing_Orb'), alvo: 'nenhum' },
  Mirror_Shard: { f: juntarLascas('Mirror_of_Kalandra'), alvo: 'nenhum' },
};
for (const [slug, f] of Object.entries(FAZ)) if (!POR_SLUG.has(slug)) delete FAZ[slug];

/** Por que a moeda não faz nada no jogo (o sistema que ela usa). */
function motivoDoNao(m) {
  const s = m.slug;
  const t = `${s} ${m.efeitos.join(' ')}`;
  if (/Scroll_of_Wisdom|Scroll_Fragment/.test(s)) return 'não há itens sem identificar no jogo';
  if (/Portal_Scroll|Rogues_Marker|Silver_Coin/.test(s)) return 'não há portal para a vila/refúgio no jogo';
  if (/Chisel|Scrying|Horizons|Astrolabe|Memory_of|Unmaking|Intention|Telesias|Surveyors|Valdos/.test(s) || /Mapa|Atlas/i.test(t)) return 'mapas e o Atlas não existem no jogo';
  if (/Shaper|Elder|Crusader|Redeemer|Hunter|Warlord|Awakener|Dominance|Conflict|Eldritch|Ember|Ichor/.test(s)) return 'as influências (Criador, Ancião, Conquistadores, Exarca, Devorador) não existem no jogo';
  if (/Veiled|Cyaxan/.test(s)) return 'os modificadores Ocultos não existem no jogo';
  if (/Lifeforce|Wisps|Rancour|Geode|Coinage|Scrap_Metal|Astragali|Burial|Artifact|Sulphur|Message_in_a_Bottle|Bestiary|Coffin|Ritual|Magmatic|Power_Core|Stacked_Deck|Prophecy|Feather|Claw|Red_Packet|Puzzle/.test(s)) return 'é moeda de uma liga do PoE (o sistema dela não existe no jogo)';
  if (/Recombinator|Mist|Kishara|Ducat|Pearls/.test(s)) return 'o sistema dela (recombinar, refletir, ducados) não existe no jogo';
  if (/Enchant|Tempering|Tailoring|Refracting|Enkindling|Instilling|Imprint|Lens/.test(s)) return 'encantamentos e gravações não existem no jogo';
  if (/Coin_of|Enshrouding|Xesht|Remembrance|Unravelling|Corrupt|Tainted_Blessing|Uncarved|Hinekora|Orb_of_Unmaking|Broken_Mirror/.test(s)) return 'o sistema dela (únicos alternativos, fios de memória, gemas corrompidas) não existe no jogo';
  return 'o efeito dela não tem equivalente no jogo ainda';
}

/** O status de cada moeda: `{ status: 'funciona'|'parcial'|'nao', motivo }`. */
export const STATUS = Object.fromEntries(MOEDAS.map((m) => {
  const f = FAZ[m.slug];
  return [m.slug, f ? { status: f.parcial ? 'parcial' : 'funciona', motivo: f.parcial ?? null, alvo: f.alvo ?? 'peca' } : { status: 'nao', motivo: motivoDoNao(m), alvo: null }];
}));

// ---------------------------------------------------------------- o catálogo e o uso
/** Registra as moedas no catálogo de itens (uma vez; só no PoE). Os orbes de socket já estão (`skills/gemas.mjs`) e só ganham o status. */
export function iniciar() {
  if (!Catalogo.ligado()) return 0;
  Gemas.usarLojaDeMoedas(linhasDaLoja);
  let n = 0;
  for (const m of MOEDAS) {
    const st = STATUS[m.slug];
    const descricao = `${m.efeitos.join(' ') || m.nome}${st.status === 'nao' ? ` — sem efeito no jogo: ${st.motivo}.` : st.status === 'parcial' ? ` — no jogo: ${st.motivo}.` : ''}`;
    if (ITEM_CATALOG[m.itemId]) {
      Object.assign(ITEM_CATALOG[m.itemId], { moedaPoe: { slug: m.slug, status: st.status, alvo: st.alvo } });
      continue;
    }
    ITEM_CATALOG[m.itemId] = {
      id: m.itemId, name: m.nome, weight: 0.1, stackable: true, type: 'moeda', rarity: 'raro', hasSprite: true, spriteDe: 9655,
      poeMoeda: { icone: m.icone }, moedaPoe: { slug: m.slug, status: st.status, alvo: st.alvo }, descricao, sell: 0, pilha: m.pilha ?? 20,
    };
    n++;
  }
  return n;
}

function tirarDaMochila(estado, id, n) {
  const inv = (estado.inventory ??= []);
  let falta = n;
  for (let i = inv.length - 1; i >= 0 && falta > 0; i--) {
    if (Number(inv[i].id) !== id) continue;
    const tira = Math.min(falta, inv[i].count ?? 1);
    inv[i].count = (inv[i].count ?? 1) - tira;
    falta -= tira;
    if (inv[i].count <= 0) inv.splice(i, 1);
  }
}
function porNaMochila(estado, id, n) {
  const inv = (estado.inventory ??= []);
  const pilha = inv.find((x) => Number(x.id) === id && (x.count ?? 1) < 100);
  if (pilha) pilha.count = (pilha.count ?? 1) + n;
  else inv.push({ id, count: n });
}
function destruir(estado, alvo) {
  if (alvo.onde === 'equipment') delete estado.equipment[alvo.slot];
  else (estado.inventory ?? []).splice(alvo.indice, 1);
}
/** A peça do alvo: `{ onde:'equipment', slot }` ou `{ onde:'inventory', indice }`. */
function pecaDoAlvo(estado, alvo) {
  if (alvo?.onde === 'equipment') return estado.equipment?.[alvo.slot] ?? null;
  if (alvo?.onde === 'inventory') return (estado.inventory ?? [])[Math.floor(Number(alvo.indice))] ?? null;
  return null;
}

/** `send({t:'moeda', moeda: itemId, alvo})` — usa UMA moeda (a peça muda, e só então a moeda é gasta). */
export function usar(estado, { moeda: idDaMoeda, alvo } = {}, rng = Math.random) {
  if (!Catalogo.ligado()) return erro('As moedas do PoE não estão ligadas.');
  const moeda = moedaDoItem(idDaMoeda);
  if (!moeda) return erro('Isso não é uma moeda do PoE.');
  const tem = (estado.inventory ?? []).some((x) => Number(x.id) === moeda.itemId && (x.count ?? 1) > 0);
  if (!tem) return erro(`Você não tem ${moeda.nome}.`);
  const faz = FAZ[moeda.slug];
  if (!faz) return erro(`${moeda.nome} não tem efeito no jogo: ${STATUS[moeda.slug].motivo}.`);
  let peca = null;
  let p = null;
  if ((faz.alvo ?? 'peca') === 'peca') {
    peca = pecaDoAlvo(estado, alvo);
    p = peca?.poe ?? null;
    if (!p) return erro('Escolha uma peça do PoE (vestida ou na mochila).');
    if (p.espelhado) return erro('Peça espelhada não aceita moeda.');
    if (p.corrompido && !faz.corrompida) return erro('Peça corrompida não aceita esta moeda (só as Corroídas).');
  }
  const antes = peca ? structuredClone(peca) : null;
  const r = faz.f({ estado, peca, p, alvo, rng, moeda });
  if (!r?.ok) {
    if (peca && antes) Object.assign(peca, antes); // nada muda se a moeda não valeu
    return r ?? erro('Nada aconteceu.');
  }
  if (peca && !r.destruiu) Jogo.recalcular(peca);
  if (!r.jaGastou) tirarDaMochila(estado, moeda.itemId, 1);
  return { ok: true, notice: r.notice };
}

// ---------------------------------------------------------------- o DROP e a LOJA (itens-poe/regras.json → `moedas`)
/** As moedas que caem de um bicho (`tipo`: normal, magico, raro, unico, boss): `[{ id, count }]`. */
export function dropDoMonstro(tipo, rng = Math.random, fator = 1) {
  const cfg = R().moedas?.drop;
  if (!Catalogo.ligado() || !cfg) return [];
  const chance = (cfg.chancePorMonstro?.[tipo] ?? cfg.chancePorMonstro?.normal ?? 0) * fator;
  const saida = [];
  let n = chance;
  while (n > 0) {
    if (rng() < Math.min(1, n)) {
      const slug = Gerar.porPeso(Object.entries(cfg.pesos ?? {}).filter(([s]) => POR_SLUG.has(s)), rng);
      if (slug) saida.push({ id: idDa(slug), count: 1 });
    }
    n -= 1;
  }
  return saida;
}
/** As linhas da loja da Zuma (`regras.moedas.loja`: slug → preço em gold). */
export function linhasDaLoja(estado) {
  if (!Catalogo.ligado()) return [];
  const tenho = (id) => (estado.inventory ?? []).filter((p) => Number(p.id) === id).reduce((t, p) => t + (p.count ?? 1), 0);
  return Object.entries(R().moedas?.loja ?? {}).filter(([s]) => POR_SLUG.has(s)).map(([slug, preco]) => {
    const m = POR_SLUG.get(slug);
    return { id: m.itemId, chave: `${m.itemId}:moeda`, categoria: 'orbes', categoriaNome: 'Moedas do PoE', nome: m.nome, buy: preco, tenho: tenho(m.itemId), loja: { disponivel: true, preco }, nomeEn: m.nome, itemId: m.itemId };
  });
}
