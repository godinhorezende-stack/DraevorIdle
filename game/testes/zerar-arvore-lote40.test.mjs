// ZERAR A ÁRVORE — LOTE 40 (dono, 16/10: as decisões sobre os parciais restantes): P003/P033/P014 "Manter e registrar" (os raios que o PoE
// não publica — os baús "próximos" a até 4 casas, os "Inimigos Próximos" a até 2 casas, a Furtividade ÷ (1 + X%) — viram exceções
// registradas) e P022 "Ricochete pelo PoE 2" (o salto do ricochete das gemas do PoE: 6 m — 3 casas — no projétil e 4 m — 2 casas — nas outras
// cadeias, × o "Alcance do Ricochete aumentado" em metros).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Acoes = await import('../systems/acoes.mjs');
const M = await import('../systems/itens-poe/mercenarios.mjs');
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

test('os raios que o PoE não publica viram exceções registradas (P003, P033, P014); o Alcance do Ricochete com efeito', { skip: SEM }, () => {
  const linha = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
  for (const [modelo, v] of [['{0}% de chance de abrir Baús próximos quando você Conjurar uma Magia', [25]], ['+{0} metros ao Alcance de Golpes Corpo a Corpo enquanto com ao menos {1} Inimigos Próximos', [0.4, 5]], ['Furtividade aumentada em {0}% caso você tenha Acertado com uma Garra Recentemente', [50]]]) {
    const t = linha(modelo, v);
    assert.equal(t.estado, 'equivalente', modelo);
    assert.match(t.partes[0].nota, /exceção do dono \(16\/10/, modelo);
  }
  const r = linha('Alcance do Ricochete aumentado em {0}%', [15]);
  assert.equal(r.estado, 'novo');
  assert.match(r.partes[0].nota, /PoE 2/);
});

const vivos = (passo, n = 3) => Array.from({ length: n }, (_, i) => ({ uid: `b${i}`, x: 10 + passo * (i + 1), y: 10, hp: 100 }));

test('P022 — o RICOCHETE do projétil da gema do PoE salta 6 m (3 casas); com +50% de alcance, 4,5 casas (a fração como chance)', { skip: SEM }, () => {
  const tiro = (passo, efeito, rng = () => 0.99) => {
    const bs = vivos(passo);
    const r = Secundarios.resolver({ efeito: { encadear: 1, ...efeito }, tags: ['projectile', 'single', 'hit'], origem: { x: 10, y: 10 }, alvo: bs[0], atingidos: [bs[0]], vivos: bs, alcance: 20, rng });
    return r.golpes.filter((g) => g.tipo === 'encadeamento').length;
  };
  assert.equal(tiro(3, { ricochetePoe: true }), 1, 'a 3 casas: salta');
  assert.equal(tiro(4, { ricochetePoe: true }), 0, 'a 4 casas: não (antes, 4 casas)');
  assert.equal(tiro(4, {}), 1, 'fora do PoE (o motor do Draevor): os 4 de sempre');
  assert.equal(tiro(4, { ricochetePoe: true, alcanceRicochetePct: 50 }, () => 0.99), 1, '+50%: 4,5 casas');
  assert.equal(tiro(5, { ricochetePoe: true, alcanceRicochetePct: 50 }, () => 0.4), 1, 'a fração 0,5 vira a chance da quinta');
  assert.equal(tiro(5, { ricochetePoe: true, alcanceRicochetePct: 50 }, () => 0.6), 0);
});

test('P022 — a CADEIA das magias do PoE (o Arco) salta 4 m (2 casas)', { skip: SEM }, () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 50 }), { sistema: 'poe', classePoe: 'Scion' });
  P.garantir(e);
  Ficha.invalidar(e);
  const merc = { ...M.candidato(50, () => 0.5), arquetipo: 'eletromante', equipment: {}, doJogador: {} };
  M.dados(e).contratados = [merc];
  M.dados(e).ativo = merc.id;
  const f = Acoes.fichaDoMercenario(e, merc, {});
  const l = { mercenario: true, mercId: merc.id, x: 10, y: 10, habilidades: f.habilidades, habilidade: 1 };
  assert.equal(f.habilidades[1].gema, 'Arc');
  const saltos = (passo) => { const bs = vivos(passo, 4); return Acoes.alvosDoGolpeDoMercenario(e, l, bs[0], bs, () => 0.99).golpes.length; };
  assert.equal(saltos(2), 3, 'a 2 casas uns dos outros: salta por todos');
  assert.equal(saltos(3), 0, 'a 3 casas: não salta (antes, a magia-molde saltava 5)');
});
