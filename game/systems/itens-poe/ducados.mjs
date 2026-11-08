// A CRIAÇÃO COM A OMNICHAMA do PoE: os DUCADOS do Soberano (liga Deepwater) e a INTANGIBILIDADE (08/11, balão 0 sem efeito — o dono: "Ducados +
// Intangibilidade", 10% por criação; pelo Cutelo do Capitão Temido: "Pode ser criado com Omnichama como se fosse raro / Não pode ganhar
// Intangibilidade").
//
// O poedb (Intangibility): "Ao criar com Omnichama, muitas criações conferem Intangibilidade ao item final em uma porcentagem específica. Ao
// realizar criações subsequentes com Omnichama, existe a chance de Vesper criar apenas uma cópia fantasmagórica do item; essa probabilidade é
// equivalente à Intangibilidade do item que está sendo modificado." Aqui:
//   - a criação vale em peça RARA (o Único só com "Pode ser criado com Omnichama como se fosse raro" — `omnichama_como_raro`);
//   - antes de criar, a chance = a Intangibilidade da peça de sair só a CÓPIA FANTASMAGÓRICA: o Ducado é gasto e a peça não muda;
//   - criou, a peça ganha `regras.ducados.intangibilidadePct` de Intangibilidade (até 100%), fora a que "Não pode ganhar Intangibilidade";
//   - o Ducado de Tzamoto: metade das vezes zera a Intangibilidade, metade destrói a peça (como no PoE, "Remove aleatoriamente toda a
//     Intangibilidade de um item ou o destrói"); o do Metamorfo vira outro Ducado; os demais, cada um o que o poedb diz.
import * as Catalogo from './catalogo.mjs';

const erro = (e) => ({ ok: false, erro: e });
const CFG = () => Catalogo.REGRAS?.ducados ?? {};
const sortear = (lista, rng) => lista[Math.floor(rng() * lista.length)];
/** A peça aceita a criação com a Omnichama? (Rara, ou o Único que é criado "como se fosse raro") */
export const aceita = (p) => p?.raridade === 'raro' || (p?.raridade === 'unico' && Number(p.af?.omnichama_como_raro) > 0);
/** A Intangibilidade da peça (0 a 100). */
export const intangibilidade = (p) => Math.max(0, Math.min(100, Number(p?.intangibilidade) || 0));

/**
 * Envolve a criação `fazer` de um Ducado: a peça aceita, a cópia fantasmagórica pela Intangibilidade e a Intangibilidade ganha. `fazer` recebe o
 * contexto da moeda e devolve `{ ok, notice }` ou o erro.
 */
export function comOmnichama(fazer, { soRara = true } = {}) {
  return (ctx) => {
    const { p, rng } = ctx;
    if (soRara && !aceita(p)) return erro('A criação com a Omnichama vale em peça Rara.');
    if (rng() * 100 < intangibilidade(p)) return { ok: true, notice: `Vesper criou só uma cópia fantasmagórica: ${p.nome} não mudou (Intangibilidade ${intangibilidade(p)}%).` };
    const r = fazer(ctx);
    if (!r?.ok) return r;
    if (!(Number(p.af?.sem_intangibilidade) > 0) && !r.destruiu) p.intangibilidade = Math.min(100, intangibilidade(p) + (Number(CFG().intangibilidadePct) || 10));
    return r;
  };
}

/** Ducado de Merrick: uma Joia Abissal Rara ganha um modificador a mais (mesmo cheia — `porModSemVaga`) e é corrompida. */
export const merrick = (porModSemVaga) => ({ p, rng }) => {
  if (p.classe !== 'Abyss_Jewels') return erro('O Ducado de Merrick vale em Joia Abissal Rara.');
  if (!porModSemVaga(p, rng)) return erro('Não há modificador possível nesta joia.');
  p.corrompido = true;
  return { ok: true, notice: `${p.nome}: ganhou um modificador e foi corrompida.` };
};
/** Ducado de Cyaxan: refaz os modificadores da peça Rara (o modificador Infame do PoE não está na coleção: sai sem ele). */
export const cyaxan = (refazer) => ({ p, rng }) => {
  refazer(p, 'raro', rng);
  return { ok: true, notice: `${p.nome}: modificadores novos.` };
};
const ATRIBUTOS = ['Força', 'Destreza', 'Inteligência'];
const DE_UM_ATRIBUTO = /^\+\{0\} (?:de|à|a) (Força|Destreza|Inteligência)$/;
/** Ducado do Cavalheiro: um modificador de UM atributo passa a dar outro atributo. */
export const cavalheiro = ({ p, rng }) => {
  const lista = [...(p.prefixos ?? []), ...(p.sufixos ?? [])].filter((m) => DE_UM_ATRIBUTO.test(m.modelo ?? ''));
  if (!lista.length) return erro('A peça não tem modificador de um só atributo (Força, Destreza ou Inteligência).');
  const m = sortear(lista, rng);
  const antes = DE_UM_ATRIBUTO.exec(m.modelo)[1];
  const novo = sortear(ATRIBUTOS.filter((a) => a !== antes), rng);
  m.modelo = m.modelo.replace(antes, novo);
  m.texto = m.texto.replace(antes, novo);
  return { ok: true, notice: `${p.nome}: ${antes} virou ${novo}.` };
};
/** Ducado da Mãe da Podridão: um Cinto Raro ganha um modificador de armadilhas ou minas (o da Essência — o pool próprio da liga não está no poedb). */
export const maeDaPodridao = (doPool) => ({ p, rng }) => {
  if (p.classe !== 'Belts') return erro('O Ducado da Mãe da Podridão vale em Cinto Raro.');
  const novo = doPool(p, 'essence', rng, { filtro: (t) => /Armadilh|Mina/.test(t.texto ?? ''), ignorarVagas: true });
  if (!novo) return erro('Não há modificador de armadilhas ou minas para este cinto.');
  (p[`${novo.lado}s`] ??= []).push(novo.mod);
  return { ok: true, notice: `${p.nome}: ${novo.mod.texto}.` };
};
/**
 * Ducado de Kishara: "Divide um item em várias formas fantasmagóricas, cada uma retendo um único modificador aleatório" — cada modificador
 * explícito vira uma cópia da peça com só ele, Intangível (100%: a próxima criação com a Omnichama vira cópia). Devolve as peças novas em `copias`.
 */
export const kishara = ({ p }) => {
  const lista = [...(p.prefixos ?? []), ...(p.sufixos ?? [])];
  if (lista.length < 2) return erro('A peça precisa de ao menos dois modificadores para se dividir.');
  const copias = [];
  for (const m of lista) {
    const c = structuredClone(p);
    c.prefixos = (p.prefixos ?? []).includes(m) ? [structuredClone(m)] : [];
    c.sufixos = (p.sufixos ?? []).includes(m) ? [structuredClone(m)] : [];
    c.intangibilidade = 100;
    copias.push(c);
  }
  return { ok: true, copias, notice: `${p.nome} se dividiu em ${copias.length} formas fantasmagóricas.` };
};

/** Os Ducados que viram outro (o Metamorfo): os que o Metamorfo pode virar. */
export const DUCADOS = Object.freeze(['Merricks_Ducat', 'Cyaxans_Ducat', 'The_Genteels_Ducat', 'Kisharas_Ducat', 'Rotmothers_Ducat', 'Brinehooks_Ducat', 'Katakohis_Ducat', 'Tzamotos_Ducat', 'Ukatoas_Ducat', 'Telesias_Ducat']);
