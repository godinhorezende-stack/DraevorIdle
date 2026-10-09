// A COBERTURA dos modificadores da árvore do PoE, medida na ficha EFETIVA (auditoria da árvore, 09/10): para cada atributo de
// `cobertura-arvore.mjs` → MEDIDAS, um nó REAL da árvore que tem só esse efeito é alocado pelo servidor (o caminho antes, o nó por último) e o
// número da ficha (a vida máxima, a armadura sobre a peça, o golpe…) muda exatamente o que o nó diz. O inventário da auditoria marca
// "validado por teste" o que está aqui.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Especializacoes = await import('../systems/personagem/especializacoes.mjs');
const { MEDIDAS } = await import('./cobertura-arvore.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

const chaveDo = (ef) => ef.add ?? (ef.stat ? `stat:${ef.stat}` : `tag:${ef.tag}`);
const valorDo = (ef) => ef.valor ?? ef.pct ?? ef.dano;
/** Um nó (ou opção de maestria) cujo ÚNICO efeito é `chave`: a principal primeiro, depois as maestrias, depois as ascendências. */
function noCom(chave) {
  const so = (efs) => efs?.length && efs.every((x) => chaveDo(x) === chave);
  const arv = P.arvore();
  const comum = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && n.tipo !== 'keystone' && so(n.efeitos));
  if (comum) return { no: comum, efeitos: comum.efeitos };
  for (const n of arv.nos.filter((x) => x.tipo === 'mastery')) {
    const o = n.opcoes.find((x) => so(x.efeitos));
    if (o) return { no: n, opcao: o.id, efeitos: o.efeitos };
  }
  const asc = arv.nos.find((n) => n.ascendencia && so(n.efeitos));
  return asc ? { no: asc, efeitos: asc.efeitos } : null;
}
function contexto(e) {
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  const af = Afixos.soma(e);
  const esp = Especializacoes.efeitos(e);
  const pct = (...chaves) => chaves.reduce((s, k) => s + (k.startsWith('stat:') ? esp.stats[k.slice(5)] ?? 0 : k.startsWith('atr:') ? f.efeitosDosAtributos?.[k.slice(4)] ?? 0 : Number(af[k]) || 0), 0);
  return { e, f, af, pct, golpe: (tags) => ModsPoe.fichaDoGolpe(f, tags, { estado: e }) };
}

for (const [chave, m] of Object.entries(MEDIDAS)) {
  test(`cobertura: "${chave}" — um nó real da árvore muda a ficha efetiva exatamente o que diz`, { skip: SEM }, () => {
    const achado = noCom(chave);
    assert.ok(achado, `há um nó só com "${chave}"`);
    const { no, opcao, efeitos } = achado;
    const classe = no.ascendencia ? P.arvore().ascendencias[no.ascendencia].classe : 'Scion';
    const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 95 }), { sistema: 'poe', classePoe: classe });
    delete e.classe;
    P.garantir(e);
    if (no.ascendencia) e.passivas.ascendencia = no.ascendencia;
    m.preparar?.(e);
    Comandos.depoisDeMudar(e);
    // o caminho até o nó (ou até o notável que abre a maestria), sem ele
    const ate = no.tipo === 'mastery' ? P.arvore().nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia).id : no.id;
    const caminho = P.caminhoAte(e, ate);
    const antesDoNo = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
    if (antesDoNo.length) assert.ok(Comandos.comando(e, { action: 'alocar', ids: antesDoNo }).feitos === antesDoNo.length);
    const ctx = contexto(e);
    const antes = m.medir(ctx);
    const r = Comandos.comando(e, { action: 'alocar', id: no.id, ...(opcao ? { opcao } : {}) });
    assert.ok(r.ok, JSON.stringify(r));
    const depois = m.medir(contexto(e));
    const valor = efeitos.reduce((s, x) => s + valorDo(x), 0);
    const esperado = m.esperado(antes, valor, ctx);
    assert.ok(Math.abs(depois - esperado) <= (m.tolerancia ?? 1e-9), `${no.id} ${no.nome}${opcao ? ` (opção ${opcao})` : ''}: ${antes} → ${depois}, esperado ${esperado} (+${valor})`);
  });
}
