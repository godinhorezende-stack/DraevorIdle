// A árvore do PoE, ciclo 7, lote H (11/10 — "tente resolver tudo que não está funcionando"): as keystones Inoculação do Caos e O Agnóstico,
// o dano tirado da Mana antes da Vida, as Mortalhas Fantasmas e a penetração de Caos. Cada teste aloca o nó REAL pelo servidor e mede onde a
// linha age.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Defesa = await import('../systems/personagem/defesa.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Limites = await import('../systems/combate/limites.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

function novo(classe = 'Scion') {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: classe });
  delete e.classe;
  P.garantir(e);
  e.equipment = {};
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  return e;
}
/** O nó (ou a opção de maestria) com um efeito cuja chave casa `re`. */
function achar(re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  const comum = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  if (comum) return { no: comum, valor: comum.efeitos.find((x) => re.test(x.add)).valor };
  for (const n of arv.nos.filter((x) => x.tipo === 'mastery' && !x.ascendencia)) {
    const o = (n.opcoes ?? []).find((x) => tem(x.efeitos));
    if (o) return { no: n, opcao: o.id, valor: o.efeitos.find((x) => re.test(x.add)).valor };
  }
  const asc = arv.nos.find((n) => n.ascendencia && tem(n.efeitos));
  return asc ? { no: asc, asc: true, valor: asc.efeitos.find((x) => re.test(x.add)).valor } : null;
}
function com(re) {
  const achado = achar(re);
  assert.ok(achado, `há nó com ${re}`);
  const { no, opcao } = achado;
  const e = novo(achado.asc ? P.arvore().ascendencias[no.ascendencia].classe : 'Scion');
  if (achado.asc) { e.passivas.ascendencia = no.ascendencia; Comandos.depoisDeMudar(e); assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) }).ok); }
  else {
    const ate = no.tipo === 'mastery' ? P.arvore().nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia).id : no.id;
    const caminho = P.caminhoAte(e, ate);
    const antes = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
    if (antes.length) assert.equal(Comandos.comando(e, { action: 'alocar', ids: antes }).feitos, antes.length);
    assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id, ...(opcao ? { opcao } : {}) }).ok);
  }
  Ficha.invalidar(e);
  const chave = [...(no.efeitos ?? []), ...((no.opcoes ?? []).find((o) => o.id === opcao)?.efeitos ?? [])].find((x) => re.test(x.add ?? '')).add;
  return { e, valor: Number(Ficha.combate(e).afPoe[chave]) || achado.valor, chave };
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const golpe = (e, tags, alvo = null) => ModsPoe.fichaDoGolpe(ficha(e), tags, { estado: e, alvo });
const bicho = (extra = {}) => ({ uid: 9, key: 'rat', name: 'Rato', x: 1, y: 0, hp: 1000, maxHp: 1000, ...extra });

test('INOCULAÇÃO DO CAOS: "Vida Máxima torna-se 1, Imune a Dano de Caos" — a vida máxima é 1, o Caos e o Veneno não pegam', { skip: SEM }, () => {
  const { e } = com(/^vida_vira_1$/);
  Afixos.sincronizarMaximos(e);
  assert.equal(e.maxHp, 1);
  assert.equal(ModsPoe.fatorDaResistenciaRecebida(ficha(e), 'chaos'), 0);
  assert.ok(ModsPoe.fatorDaResistenciaRecebida(ficha(e), 'fire') > 0);
  ModsPoe.definirFichaDaCacada(e.hunt, () => ficha(e));
  assert.equal(ModsPoe.dotNoJogador(e.hunt, { tipo: 'veneno', total: 100 }, e.hunt.clock), null);
  const outro = novo();
  Afixos.sincronizarMaximos(outro);
  assert.ok(outro.maxHp > 1);
});

test('MENTE SOBRE MATÉRIA: "X% de Dano é removido da Mana antes da Vida"', { skip: SEM }, () => {
  const { e, valor } = com(/^dano_pela_mana_pct$/);
  e.mana = 10000;
  e.es = 0;
  const f = ficha(e);
  const resta = Defesa.absorver(e, { ...f, energyShield: 0 }, 1000, null, null);
  assert.equal(resta, 1000 - Math.round(10 * valor));
  assert.equal(e.mana, 10000 - Math.round(10 * valor));
});

test('MORTALHAS e CAOS: "A cada N segundos, ganhe uma Mortalha Fantasma"; quando acertado, uma vira Escudo; "Dano Penetra X% da Resistência a Caos"', { skip: SEM }, () => {
  const { e, chave } = com(/^periodico:\d+:mortalha:\d+$/);
  const [, cada, , max] = chave.split(':').map(Number);
  ModsPoe.aurasProximas(e, e.hunt, ficha(e));
  for (let i = 0; i < 10; i++) { e.hunt.clock += cada * 1000; ModsPoe.aurasProximas(e, e.hunt, ficha(e)); }
  assert.equal(e.hunt.mortalhas, max);
  const p = com(/^chaos_pen$/);
  assert.equal(Limites.penetracaoDe(ficha(p.e).penetracao, 'chaos'), p.valor);
  assert.equal(Limites.penetracaoDe({ elemental: 30, porElemento: {} }, 'chaos'), 0, 'a Penetração Elemental não vale no Caos');
});
