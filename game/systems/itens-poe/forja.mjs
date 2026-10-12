// A FORJA do PoE (dono, 12/10: "reformulação completa da Forja" — modelo compacto do UNDECEMBER, estética do PoE 1): as CATEGORIAS
// (os encaixes, a raridade, os modificadores, a influência, a corrupção… — `engine/forja-poe.mjs` → `GRUPOS`), o RESULTADO DESEJADO das que têm
// um (sockets, cores, links, atributos, raridade) e a REPETIÇÃO controlada pelo servidor.
//
// Não há motor novo: cada tentativa é UMA moeda pelo mesmo caminho do `{t:'moeda'}` (`MoedasPoe.usar` — valida a peça, sorteia, gasta a
// moeda só se a peça mudou, remonta a peça). Aqui moram só o que a tela precisa para configurar (`opcoes`), a validação do desejo (nada
// impossível: cor demais para os sockets, link maior que os sockets, mod que a base ou o item level não dão, raridade que a moeda não
// alcança) e a repetição em LOTES (`repetir`): no máximo `LOTE` tentativas por mensagem, com id e passo (a mensagem repetida não faz
// nada duas vezes), a peça seguida pela identidade (a mochila mudar de ordem no meio não troca a peça) e as paradas: chegou, limite,
// sem material, a peça não aceita mais, cancelado, erro.
import { ITEM_CATALOG } from '../dados.mjs';
import * as Catalogo from './catalogo.mjs';
import * as Gerar from './gerar.mjs';
import * as MoedasPoe from './moedas.mjs';
import * as Chances from './forja-chances.mjs';
import * as Gemas from '../skills/gemas.mjs';
import * as Regras from '../../engine/forja-poe.mjs';

/** Tentativas por mensagem (o resto vem na próxima: a tela mostra o progresso e o servidor não fica preso num laço longo). */
export const LOTE = 25;
/** O maior limite de tentativas que a tela pode pedir. */
export const LIMITE_MAXIMO = 5000;
/** Quantos resultados recentes a resposta leva. */
const HISTORICO = 8;

const erro = (e) => ({ ok: false, erro: e });

// ---------------------------------------------------------------- as moedas (a categoria e o "repete" moram em `moedas.mjs`, no catálogo)
export const categoriaDa = MoedasPoe.categoriaDaMoeda;
export const REPETE = MoedasPoe.REPETE;
/** As de Atributos que sorteiam os MODS de novo (o desejo de mods vale nelas) e a raridade que cada uma pede. */
const PEDE_RARIDADE = { Orb_of_Alteration: 'magico', Chaos_Orb: 'raro', Veiled_Chaos_Orb: 'raro' };
const SORTEIAM_MODS = new Set([...Object.keys(PEDE_RARIDADE), 'Divine_Orb']);
/** As moedas SEM sorteio: o ensaio numa cópia já é o resultado (a prévia exata). */
const PREVIA_EXATA = new Set([
  'Blacksmiths_Whetstone', 'Armourers_Scrap', 'Glassblowers_Bauble', 'Orb_of_Scouring', 'Orb_of_Regret', 'Gemcutters_Prism',
  ...MoedasPoe.MOEDAS_DA_CATEGORIA.lascas,
]);
/**
 * A barra de materiais mostra o que o jogador TEM e, zeradas, só as moedas principais de cada categoria (para ele saber o que precisa):
 * sem isso a de Atributos listava umas quarenta moedas apagadas.
 */
const PRINCIPAIS = new Set([
  'Jewellers_Orb', 'Chromatic_Orb', 'Orb_of_Fusing', 'Orb_of_Alteration', 'Orb_of_Augmentation', 'Chaos_Orb', 'Exalted_Orb', 'Orb_of_Annulment',
  'Divine_Orb', 'Orb_of_Transmutation', 'Orb_of_Alchemy', 'Regal_Orb', 'Orb_of_Scouring', 'Orb_of_Chance', 'Vaal_Orb',
]);
const QUE_FAZEM_BRANCO = new Set(['Tainted_Chromatic_Orb']);
const PEDEM_SEM_GEMA = new Set(['Jewellers_Orb', 'Chromatic_Orb', 'Tainted_Jewellers_Orb', 'Tainted_Chromatic_Orb']);

// ---------------------------------------------------------------- a peça e o material
// (a mochila E o baú — o depósito do personagem; dono, 12/10: "forja pode pegar materiais do baú também")
const quantas = (estado, id) => MoedasPoe.quantasTem(estado, id);
/** A peça do alvo (`{ onde:'equipment', slot }` | `{ onde:'inventory', indice }`), só se for do PoE. */
function pecaDo(estado, alvo) {
  const peca = alvo?.onde === 'equipment' ? estado.equipment?.[alvo.slot] : alvo?.onde === 'inventory' ? (estado.inventory ?? [])[Math.floor(Number(alvo.indice))] : null;
  return peca?.poe ? peca : null;
}
/** A gema da mochila do alvo (o Prisma e a Lente do Lapidário), ou null. */
function gemaDo(estado, alvo) {
  const g = alvo?.onde === 'inventory' ? (estado.inventory ?? [])[Math.floor(Number(alvo.indice))] : null;
  return g && Gemas.ehGema(g.id) ? g : null;
}
/** Acha a MESMA peça (identidade) onde ela estiver agora; devolve o alvo novo ou null (a peça saiu). */
function localizar(estado, ref, alvo) {
  const ali = alvo?.onde === 'equipment' ? estado.equipment?.[alvo.slot] : alvo?.onde === 'inventory' ? (estado.inventory ?? [])[Math.floor(Number(alvo.indice))] : null;
  if (ali === ref) return alvo;
  const i = (estado.inventory ?? []).indexOf(ref);
  if (i >= 0) return { onde: 'inventory', indice: i };
  for (const [slot, p] of Object.entries(estado.equipment ?? {})) if (p === ref) return { onde: 'equipment', slot };
  return null;
}
const slugDo = (id) => MoedasPoe.moedaDoItem(id)?.slug ?? null;
const temUnicoNaBase = (p) => {
  const base = Gerar.acharBase(Catalogo.catalogo(), p.base)?.base;
  return (Catalogo.catalogo()?.classes?.[p.classe]?.unicos ?? []).some((u) => u.base === base?.nome);
};
const inalteravel = (peca) => Number(peca?.poe?.af?.encaixes_inalteraveis) > 0;

/** Os sockets da peça para a tela e a conta: `{ max, abertos, links, cores, comGema, inalteravel }` ou null. */
function socketsDa(peca) {
  const s = Gemas.soquetesDe(peca);
  if (!s) return null;
  return { max: s.max, abertos: s.abertos, links: s.links, cores: s.cores ?? [], comGema: s.gemas.some(Boolean), inalteravel: inalteravel(peca) };
}

// ---------------------------------------------------------------- a RARIDADE: o que cada moeda faz
/** As raridades que a moeda pode deixar nesta peça (a regra de cada uma em `moedas.mjs`), ou `{ erro }` quando ela não vale aqui. */
export function resultadosDeRaridade(slug, p) {
  const talhado = [...(p.prefixos ?? []), ...(p.sufixos ?? [])].some((m) => m.talhado);
  const regra = {
    Orb_of_Transmutation: ['normal', ['magico']], Orb_of_Alchemy: ['normal', ['raro']], Orb_of_Binding: ['normal', ['raro']],
    Regal_Orb: ['magico', ['raro']], Foulborn_Regal_Orb: ['magico', ['raro']],
    Orb_of_Chance: ['normal', ['magico', 'raro', ...(temUnicoNaBase(p) ? ['unico'] : [])]],
  }[slug];
  if (slug === 'Orb_of_Scouring') return ['magico', 'raro'].includes(p.raridade) ? { para: talhado ? [p.raridade] : ['normal'] } : { erro: 'O Orbe do Expurgo vale em peça Mágica ou Rara.' };
  if (!regra) return { erro: 'Esta moeda não muda a raridade.' };
  const [pede, para] = regra;
  return p.raridade === pede ? { para } : { erro: `Vale em peça ${Catalogo.REGRAS.raridades[pede]?.nome ?? pede}.` };
}

// ---------------------------------------------------------------- os MODIFICADORES possíveis (Atributos)
/** As famílias de mods da base desta peça que o item level dela alcança, com os tiers possíveis (T1 é o melhor). */
function familiasDa(p) {
  const achado = Gerar.acharBase(Catalogo.catalogo(), p.base);
  const pool = achado && Gerar.poolDa(achado.classe, achado.base);
  if (!pool) return [];
  const rb = Gerar.regrasDaBase(p.implicitos);
  const ilvl = Math.max(1, Number(p.ilvl) || 1);
  const saida = [];
  for (const lado of ['prefixos', 'sufixos']) {
    for (const g of pool[lado] ?? []) {
      if (!Gerar.permitidoNaBase(g, rb)) continue;
      const tiers = g.tiers.filter((t) => (t.ilvl ?? 1) <= ilvl && (t.peso ?? 0) > 0);
      if (!tiers.length) continue;
      const pct = rb.magnitude.todos + rb.magnitude[g.lado];
      saida.push({
        familia: g.familia, lado: g.lado, tags: g.tags ?? [],
        texto: String(tiers[0].modelo ?? '').replace(/\{\d+\}/g, '#'),
        tiers: tiers.map((t) => ({ tier: t.tier, nome: t.nome, ilvl: t.ilvl, texto: t.texto, umValor: (t.faixas ?? []).length === 1, max: (t.faixas ?? []).length === 1 ? Math.round(Number(t.faixas[0][1]) * (1 + pct / 100) * 100) / 100 : null })),
      });
    }
  }
  return saida;
}
/** As vagas de prefixo e sufixo na raridade `r` (com as regras da base). */
function vagas(p, r) {
  const R = Catalogo.REGRAS.raridades[r] ?? {};
  const rb = Gerar.regrasDaBase(p.implicitos);
  return { prefixo: Math.max(0, (R.maxPrefixos ?? 0) + rb.prefixos), sufixo: Math.max(0, (R.maxSufixos ?? 0) + rb.sufixos) };
}

// ---------------------------------------------------------------- a VALIDAÇÃO do desejo
/**
 * O desejo `d` da categoria vale para esta peça com esta moeda? Devolve `{ ok: true, desejo }` (o desejo limpo, só os campos da categoria)
 * ou `{ erro }`. Nada impossível passa: o servidor não gasta material atrás de um resultado que a regra do jogo não dá.
 */
export function validarDesejo(peca, slug, categoria, d) {
  const p = peca.poe;
  const inteiro = (x) => (Number.isInteger(Number(x)) ? Number(x) : NaN);
  if (!d || typeof d !== 'object') return erro('Configure o resultado desejado.');
  if (['sockets', 'cores', 'links'].includes(categoria)) {
    const s = socketsDa(peca);
    if (!s) return erro('Esta peça não tem sockets.');
    if (s.inalteravel) return erro('Os sockets desta peça não podem ser modificados.');
    if (categoria === 'sockets') {
      const n = inteiro(d.abertos);
      if (!(n >= 1 && n <= s.max)) return erro(`Esta peça aceita de 1 a ${s.max} sockets.`);
      return { ok: true, desejo: { abertos: n } };
    }
    if (categoria === 'cores') {
      const c = Object.fromEntries(Regras.CORES.map((k) => [k, inteiro(d[k] ?? 0)]));
      if (Regras.CORES.some((k) => !(c[k] >= 0))) return erro('As cores pedidas precisam ser números inteiros.');
      const soma = Regras.CORES.reduce((t, k) => t + c[k], 0);
      if (!soma) return erro('Escolha pelo menos uma cor.');
      if (soma > s.abertos) return erro(`São ${soma} cores para ${s.abertos} socket${s.abertos === 1 ? '' : 's'}: não cabe.`);
      if (c.W > 0 && !QUE_FAZEM_BRANCO.has(slug)) return erro('O Orbe Cromático não faz socket branco (só o Cromático Corroído).');
      return { ok: true, desejo: c };
    }
    const k = inteiro(d.ligados);
    if (s.abertos < 2) return erro('Precisa de pelo menos 2 sockets para ligar.');
    if (!(k >= 2 && k <= s.abertos)) return erro(`Com ${s.abertos} sockets, o link vai de 2 a ${s.abertos}.`);
    return { ok: true, desejo: { ligados: k } };
  }
  if (categoria === 'raridade') {
    const lista = [...new Set(Array.isArray(d.raridades) ? d.raridades : [])].filter((r) => Catalogo.REGRAS.raridades[r]);
    if (!lista.length) return erro('Escolha a raridade desejada.');
    const r = resultadosDeRaridade(slug, p);
    if (r.erro) return erro(r.erro);
    if (!lista.some((x) => r.para.includes(x))) return erro(`Esta moeda não deixa a peça ${lista.map((x) => Catalogo.REGRAS.raridades[x].nome).join(' ou ')}.`);
    return { ok: true, desejo: { raridades: lista } };
  }
  if (categoria === 'atributos') {
    const mods = Array.isArray(d.mods) ? d.mods : [];
    if (!mods.length || mods.length > 6) return erro('Escolha de 1 a 6 modificadores.');
    const familias = new Map(familiasDa(p).map((f) => [f.familia, f]));
    if (!SORTEIAM_MODS.has(slug)) return erro('Esta moeda não sorteia os modificadores de novo: use uma tentativa por vez.');
    const raridade = PEDE_RARIDADE[slug] ?? p.raridade;
    const limpos = [];
    const porLado = { prefixo: 0, sufixo: 0 };
    for (const m of mods) {
      const f = familias.get(m?.familia);
      if (!f) return erro('Um dos modificadores pedidos não sai nesta peça (a base ou o item level não dão).');
      if (limpos.some((x) => x.familia === f.familia)) return erro('O mesmo modificador foi pedido duas vezes.');
      const tierMax = m.tierMax == null ? null : inteiro(m.tierMax);
      if (tierMax != null && !(tierMax >= 1)) return erro('O tier pedido precisa ser um número (T1 é o melhor).');
      const tiers = f.tiers.filter((t) => tierMax == null || t.tier <= tierMax);
      if (!tiers.length) return erro(`${f.texto}: o tier T${tierMax} ou melhor pede item level ${Math.min(...f.tiers.map((t) => t.ilvl))}+ (a peça é ${p.ilvl}).`);
      let minimo = m.minimo == null || m.minimo === '' ? null : Number(m.minimo);
      if (minimo != null) {
        if (!Number.isFinite(minimo)) return erro('O valor mínimo precisa ser um número.');
        if (!tiers.every((t) => t.umValor)) return erro(`${f.texto}: o valor mínimo só vale em modificador de um valor só.`);
        const teto = Math.max(...tiers.map((t) => t.max));
        if (minimo > teto) return erro(`${f.texto}: o valor vai no máximo até ${teto} nesta peça.`);
      }
      if (slug === 'Divine_Orb') {
        const na = [...(p.prefixos ?? []), ...(p.sufixos ?? [])].find((x) => x.familia === f.familia);
        if (!na) return erro('O Orbe Divino só sorteia os valores: escolha um modificador que já está na peça.');
        if (tierMax != null && Number(na.tier) > tierMax) return erro('O Orbe Divino não muda o tier do modificador.');
      }
      porLado[f.lado]++;
      limpos.push({ familia: f.familia, ...(tierMax != null ? { tierMax } : {}), ...(minimo != null ? { minimo } : {}) });
    }
    const modo = d.modo === 'algum' ? 'algum' : 'todos';
    if (modo === 'todos') {
      const v = vagas(p, raridade);
      if (porLado.prefixo > v.prefixo || porLado.sufixo > v.sufixo) return erro(`Numa peça ${Catalogo.REGRAS.raridades[raridade].nome} cabem ${v.prefixo} prefixo(s) e ${v.sufixo} sufixo(s).`);
    }
    return { ok: true, desejo: { mods: limpos, modo } };
  }
  return erro('Esta categoria não tem resultado desejado.');
}

/** A moeda vale nesta peça agora? O motivo de não valer (o mesmo texto que a tentativa daria), ou null. */
function motivoDaMoeda(estado, peca, slug, categoria) {
  const p = peca.poe;
  if (MoedasPoe.STATUS[slug]?.status === 'nao') return `Sem efeito no jogo: ${MoedasPoe.STATUS[slug].motivo}.`;
  if (p.espelhado) return 'Peça espelhada não aceita moeda.';
  const corroida = /^Tainted_/.test(slug);
  if (p.corrompido && !corroida) return 'Peça corrompida não aceita esta moeda (só as Corroídas).';
  if (!p.corrompido && corroida) return 'As moedas Corroídas valem só em peça corrompida.';
  if (['sockets', 'cores', 'links'].includes(categoria)) {
    const s = socketsDa(peca);
    if (!s) return 'Esta peça não tem sockets.';
    if (s.inalteravel) return 'Os sockets desta peça não podem ser modificados.';
    if (PEDEM_SEM_GEMA.has(slug) && s.comGema) return 'Tire as gemas desta peça antes (vista a peça e use o Gem Atelier).';
    if (slug === 'Jewellers_Orb' && s.abertos >= s.max) return `A peça já está no máximo (${s.max} sockets).`;
    if (categoria === 'links' && s.abertos < 2) return 'Precisa de pelo menos 2 sockets para ligar.';
    if (slug === 'Orb_of_Fusing' && s.links.slice(0, s.abertos - 1).every(Boolean)) return 'A peça já está toda ligada.';
    if (categoria === 'cores' && s.abertos < 1) return 'A peça não tem sockets abertos.';
  }
  if (categoria === 'raridade') {
    const r = resultadosDeRaridade(slug, p);
    if (r.erro) return r.erro;
  }
  if (PEDE_RARIDADE[slug] && p.raridade !== PEDE_RARIDADE[slug]) return `Vale em peça ${Catalogo.REGRAS.raridades[PEDE_RARIDADE[slug]].nome}.`;
  if (quantas(estado, MoedasPoe.idDa(slug)) < 1) return 'Você não tem esta moeda.';
  return null;
}

/**
 * O ENSAIO: a moeda aplicada numa CÓPIA da mochila e do equipamento (o mesmo `MoedasPoe.usar` da forja de verdade). Diz se ela vale aqui
 * — com a mensagem do próprio motor quando não vale — e, nas moedas sem sorteio, o resultado exato. Nada do personagem muda.
 */
function ensaio(estado, slug, alvo) {
  const copia = {
    inventory: structuredClone(estado.inventory ?? []), equipment: structuredClone(estado.equipment ?? {}), passivas: structuredClone(estado.passivas ?? {}),
    deposito: structuredClone(estado.deposito ?? []), // (a moeda pode estar no baú)
  };
  const r = MoedasPoe.usar(copia, { moeda: MoedasPoe.idDa(slug), ...(alvo ? { alvo } : {}) }, () => 0.5);
  return r.ok ? { ok: true, notice: r.notice ?? null } : { ok: false, erro: r.erro };
}
/** Por que o material não vale agora (ou null) e, sem sorteio, o resultado exato. */
function situacao(estado, alvo, peca, slug, categoria) {
  const st = MoedasPoe.STATUS[slug];
  if (st?.status === 'nao') return { motivo: `Sem efeito no jogo: ${st.motivo}.` };
  if (quantas(estado, MoedasPoe.idDa(slug)) < 1) return { motivo: 'Você não tem esta moeda.' };
  const antes = peca ? motivoDaMoeda(estado, peca, slug, categoria) : null;
  if (antes) return { motivo: antes };
  const e = ensaio(estado, slug, (st?.alvo ?? 'peca') === 'nenhum' ? null : alvo);
  if (!e.ok) return { motivo: e.erro };
  return { motivo: null, ...(PREVIA_EXATA.has(slug) && e.notice ? { previa: e.notice } : {}) };
}

// ---------------------------------------------------------------- a ESTIMATIVA
function estimativa(estado, peca, slug, categoria, desejo, reiniciar = false) {
  if (!desejo) return null;
  const p = peca.poe;
  const tem = quantas(estado, MoedasPoe.idDa(slug));
  const s = socketsDa(peca);
  const q = Number(p.qualidade) || 0;
  const req = ITEM_CATALOG[peca.id]?.poe?.requisitos ?? null;
  if (categoria === 'sockets') {
    if (slug === 'Jewellers_Orb') return Chances.joalheiro({ abertos: s.abertos, max: s.max, alvo: desejo.abertos, qualidade: q, tem });
    if (slug === 'Tainted_Jewellers_Orb') return Chances.joalheiroCorroido({ abertos: s.abertos, max: s.max, alvo: desejo.abertos, tem });
  }
  if (categoria === 'links' && slug === 'Orb_of_Fusing') return Chances.fusao({ abertos: s.abertos, alvo: desejo.ligados, qualidade: q, tem });
  if (categoria === 'cores') {
    if (slug === 'Chromatic_Orb') return Chances.cromatico({ atual: s.cores.slice(0, s.abertos), requisitos: req, desejo, tem });
    if (slug === 'Tainted_Chromatic_Orb') return Chances.cromaticoCorroido({ abertos: s.abertos, desejo, tem });
  }
  if (categoria === 'raridade' && slug === 'Orb_of_Chance') {
    return Chances.chance({ pesos: Catalogo.REGRAS.moedas?.chance ?? { magico: 80, raro: 19, unico: 1 }, temUnico: temUnicoNaBase(p), desejo: desejo.raridades, tem, expurgos: reiniciar ? quantas(estado, MoedasPoe.idDa('Orb_of_Scouring')) : null });
  }
  return { semEstimativa: categoria === 'atributos' ? 'o sorteio dos modificadores depende do pool, dos pesos, das vagas e das regras da base: a Forja não estima' : 'não há uma conta exata para esta moeda' };
}

// ---------------------------------------------------------------- `opcoes` (só leitura)
/** O que a tela precisa para configurar: a peça, as moedas da categoria, a raridade, os mods possíveis, a validação e a estimativa. */
export function opcoes(estado, m = {}) {
  const pedido = Number(m.pedido) || 0;
  const categoria = Regras.CATEGORIAS.includes(m.categoria) ? m.categoria : 'sockets';
  const peca = pecaDo(estado, m.alvo);
  const alvo = m.alvo ?? null;
  // (a barra: o que o jogador tem e, zeradas, as principais; "Sem efeito no jogo" só mostra as que ele tem)
  const materiais = MoedasPoe.MOEDAS.filter((x) => categoriaDa(x.slug) === categoria)
    .map((x) => ({ x, tem: quantas(estado, x.itemId) }))
    .filter(({ x, tem }) => tem > 0 || (PRINCIPAIS.has(x.slug) && categoria !== 'semEfeito'))
    .map(({ x, tem }) => ({
      id: x.itemId, slug: x.slug, nome: ITEM_CATALOG[x.itemId]?.name ?? x.nome, tem, noBau: MoedasPoe.ondeTem(estado, x.itemId).bau,
      repete: REPETE.has(x.slug) && Regras.COM_DESEJO.has(categoria),
      status: MoedasPoe.STATUS[x.slug]?.status ?? 'nao', ...situacao(estado, alvo, peca, x.slug, categoria),
    }));
  if (!peca) return { pedido, categoria, alvo: m.alvo ?? null, peca: null, materiais };
  const p = peca.poe;
  const slug = slugDo(m.moeda);
  const saida = {
    pedido, categoria, alvo: m.alvo, materiais,
    peca: { sockets: socketsDa(peca), raridade: p.raridade, tipo: Regras.tipoDaPeca(p), temUnico: temUnicoNaBase(p) },
    raridades: Object.entries(Catalogo.REGRAS.raridades).map(([id, r]) => ({ id, nome: r.nome, cor: r.cor })),
  };
  if (categoria === 'raridade') saida.transicoes = materiais.map((x) => ({ slug: x.slug, id: x.id, ...resultadosDeRaridade(x.slug, p) }));
  if (categoria === 'atributos') saida.familias = familiasDa(p);
  if (slug && categoriaDa(slug) === categoria && m.desejo) {
    const v = validarDesejo(peca, slug, categoria, m.desejo);
    saida.validacao = v.ok ? { ok: true } : { ok: false, erro: v.erro };
    if (v.ok) saida.estimativa = estimativa(estado, peca, slug, categoria, v.desejo, !!m.reiniciar && slug === 'Orb_of_Chance');
  }
  return saida;
}

// ---------------------------------------------------------------- `repetir` (a forja de verdade)
const resposta = (g, extra = {}) => ({
  id: g.id, passo: g.passo, feitas: g.feitas, total: Number.isFinite(g.total) ? g.total : null,
  gastos: Object.entries(g.gastos).map(([id, n]) => ({ id: Number(id), n })), historico: g.historico.slice(-HISTORICO),
  ultimo: g.historico.at(-1) ?? null, alvo: g.alvo, ...extra,
});
const fim = (g, motivo, mensagem) => {
  g.fim = true;
  g.ultima = resposta(g, { fim: true, motivo, mensagem, atingiu: motivo === 'atingiu' || motivo === 'jaEsta' });
  return g.ultima;
};

/**
 * Uma mensagem `{t:'forjaRepetir'}`: `{ id, passo, moeda, alvo, categoria, desejo, modo: 'uma'|'limite'|'ate', limite, reiniciar }`.
 * `guardado`: a repetição em andamento desta sessão (ou null). Devolve `{ guardado, resposta, mudou }` — `mudou`: alguma tentativa
 * mexeu no personagem (a sessão manda o estado e grava).
 */
export function repetir(estado, guardado, m = {}, rng = Math.random) {
  if (!Catalogo.ligado()) return { guardado, resposta: { fim: true, motivo: 'erro', mensagem: 'A Forja do PoE não está ligada.' }, mudou: false };
  const id = typeof m.id === 'string' && m.id.length <= 64 ? m.id : null;
  const passo = Math.floor(Number(m.passo));
  if (!id || !(passo >= 0)) return { guardado, resposta: { fim: true, motivo: 'erro', mensagem: 'Pedido da Forja inválido.' }, mudou: false };
  // A MESMA mensagem de novo (clique duplo, reenvio): não faz nada, devolve o que já foi.
  if (guardado?.id === id && passo <= guardado.passo) return { guardado, resposta: { ...guardado.ultima, duplicada: true }, mudou: false };
  let g = guardado;
  if (passo === 0) {
    // Uma repetição nova toma o lugar da anterior (a anterior não anda mais: o passo dela não bate).
    const r = comecar(estado, id, m);
    if (r.erro) return { guardado: null, resposta: { id, passo, fim: true, motivo: 'erro', mensagem: r.erro, feitas: 0, gastos: [] }, mudou: false };
    g = r.g;
    if (g.fim) return { guardado: g, resposta: g.ultima, mudou: false };
  } else {
    if (!g || g.id !== id || g.fim) return { guardado, resposta: { id, passo, fim: true, motivo: 'encerrada', mensagem: 'Esta repetição já terminou.' }, mudou: false };
    if (passo !== g.passo + 1) return { guardado: g, resposta: fim(g, 'erro', 'Pedido fora de ordem: a repetição parou.'), mudou: false };
    g.passo = passo;
  }
  let mudou = false;
  for (let n = 0; n < LOTE; n++) {
    if (g.feitas >= g.total) {
      fim(g, g.desejo ? 'limite' : 'feito', g.desejo ? `Limite de ${g.feitas} tentativa${g.feitas === 1 ? '' : 's'} sem chegar ao resultado.` : null);
      break;
    }
    // (a moeda sem alvo — lascas, Remorso — não segue peça nenhuma)
    const alvo = g.semAlvo ? null : localizar(estado, g.ref, g.alvo);
    if (!g.semAlvo && !alvo) {
      fim(g, 'saiu', 'A peça saiu da Forja (foi vendida, trocada, guardada ou destruída).');
      break;
    }
    g.alvo = alvo;
    if (quantas(estado, g.moedaId) < 1) {
      fim(g, 'semMaterial', `Acabou: você não tem mais ${g.nomeDaMoeda}.`);
      break;
    }
    const antes = quantas(estado, g.moedaId);
    const r = MoedasPoe.usar(estado, { moeda: g.moedaId, ...(alvo ? { alvo } : {}) }, rng);
    if (!r.ok) {
      fim(g, 'naoPode', r.erro);
      break;
    }
    mudou = true;
    g.feitas++;
    g.gastos[g.moedaId] = (g.gastos[g.moedaId] ?? 0) + (antes - quantas(estado, g.moedaId));
    g.historico.push(r.notice ?? 'A peça mudou.');
    if (g.historico.length > HISTORICO) g.historico.shift();
    const agora = g.semAlvo ? null : localizar(estado, g.ref, alvo);
    if (!g.semAlvo && !agora) {
      fim(g, 'saiu', r.notice ?? 'A peça saiu da Forja.');
      break;
    }
    g.alvo = agora;
    if (g.desejo && chegou(g)) {
      fim(g, 'atingiu', 'Resultado desejado alcançado!');
      break;
    }
    // A Chance com o Expurgo: não saiu o que queria e a peça deixou de ser Normal → o Expurgo a devolve a Normal para a próxima.
    if (g.reiniciar && g.feitas < g.total && g.ref.poe.raridade !== 'normal') {
      const exp = MoedasPoe.idDa('Orb_of_Scouring');
      if (quantas(estado, exp) < 1) {
        fim(g, 'semMaterial', 'Acabou o Orbe do Expurgo para voltar a peça a Normal.');
        break;
      }
      const e = MoedasPoe.usar(estado, { moeda: exp, alvo: g.alvo }, rng);
      if (!e.ok) {
        fim(g, 'naoPode', e.erro);
        break;
      }
      g.gastos[exp] = (g.gastos[exp] ?? 0) + 1;
    }
  }
  if (!g.fim) g.ultima = resposta(g, { fim: false, continua: true, atingiu: false });
  return { guardado: g, resposta: g.ultima, mudou };
}
const chegou = (g) => Regras.atingiu(g.categoria, g.desejo, { s: Gemas.soquetesDe(g.ref), p: g.ref.poe });

const repeticao = (id, extra) => ({ id, passo: 0, feitas: 0, gastos: {}, historico: [], fim: false, ultima: null, desejo: null, total: 1, reiniciar: false, ...extra });

/** Valida o pedido novo e monta a repetição; ou `{ erro }`. */
function comecar(estado, id, m) {
  const slug = slugDo(m.moeda);
  if (!slug) return erro('Escolha o material (uma moeda do PoE).');
  const categoria = categoriaDa(slug);
  if (m.categoria && m.categoria !== categoria) return erro('Este material não é desta categoria.');
  const st = MoedasPoe.STATUS[slug];
  if (st?.status === 'nao') return erro(`Sem efeito no jogo: ${st.motivo}.`);
  const moedaId = MoedasPoe.idDa(slug);
  const base = { moedaId, slug, nomeDaMoeda: ITEM_CATALOG[moedaId]?.name ?? slug, categoria };
  // A moeda que não mexe numa peça do PoE (a gema do Prisma e da Lente; as lascas e o Remorso, sem alvo): uma tentativa, pelo mesmo `usar`.
  if ((st?.alvo ?? 'peca') !== 'peca') {
    if ((m.modo ?? 'uma') !== 'uma') return erro('Este material é de uma tentativa por vez.');
    if (quantas(estado, moedaId) < 1) return erro('Você não tem esta moeda.');
    if (st.alvo === 'gema') {
      const gema = gemaDo(estado, m.alvo);
      if (!gema) return erro('Escolha uma gema da mochila.');
      return { g: repeticao(id, { ...base, alvo: m.alvo, ref: gema }) };
    }
    return { g: repeticao(id, { ...base, alvo: null, ref: null, semAlvo: true }) };
  }
  const peca = pecaDo(estado, m.alvo);
  if (!peca) return erro('Escolha uma peça do PoE (vestida ou na mochila).');
  const motivo = motivoDaMoeda(estado, peca, slug, categoria);
  if (motivo) return erro(motivo);
  const modo = ['uma', 'limite', 'ate'].includes(m.modo) ? m.modo : 'uma';
  let total = 1;
  if (modo !== 'uma') {
    if (!REPETE.has(slug) || !Regras.COM_DESEJO.has(categoria)) return erro('Este material é de uma tentativa por vez (ele soma ou tira, não sorteia de novo).');
    if (modo === 'limite') {
      total = Math.floor(Number(m.limite));
      if (!(total >= 1 && total <= LIMITE_MAXIMO)) return erro(`O limite vai de 1 a ${LIMITE_MAXIMO} tentativas.`);
    } else total = Infinity;
  }
  let desejo = null;
  if (m.desejo != null || modo !== 'uma') {
    const v = validarDesejo(peca, slug, categoria, m.desejo);
    if (!v.ok) return erro(v.erro);
    desejo = v.desejo;
  }
  const reiniciar = !!m.reiniciar && slug === 'Orb_of_Chance' && modo !== 'uma';
  const g = repeticao(id, { ...base, alvo: m.alvo, ref: peca, desejo, total, reiniciar });
  if (desejo && chegou(g)) fim(g, 'jaEsta', 'A peça já está como você quer: nada foi gasto.');
  return { g };
}

/** `{t:'forjaCancelar', id}`: a repetição para (o lote que já rodou fica). */
export function cancelar(guardado, id) {
  if (!guardado || guardado.id !== id || guardado.fim) return { guardado, resposta: { id, fim: true, motivo: 'encerrada', mensagem: 'Nada em andamento.' } };
  return { guardado, resposta: fim(guardado, 'cancelado', `Cancelado depois de ${guardado.feitas} tentativa${guardado.feitas === 1 ? '' : 's'}.`) };
}
