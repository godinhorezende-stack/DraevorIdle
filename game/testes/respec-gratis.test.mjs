// O RESPEC de graça no jogo oficial (dono, 09/10: "liberar a árvore, o respec de graça total, e tirar nó também de graça"): tirar um nó e o
// respec completo não custam ouro, não gastam os pontos do Orbe do Remorso nem o respec grátis da migração, e valem também durante a
// caçada (como no PoE, que deixa refazer passivas em qualquer lugar). O Draevor clássico segue cobrando por nó (testes/passivas.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';

/** Um personagem com alguns nós alocados no caminho do início até um nó pequeno, com ouro, restituições e o respec da migração. */
function comNos() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.sistema = 'poe';
  P.garantir(e);
  const alvo = P.arvore().nos.filter((n) => n.tipo === 'small').map((n) => ({ n, c: P.caminhoAte(e, n.id) })).filter((x) => x.c?.length >= 2).sort((a, b) => a.c.length - b.c.length)[0];
  assert.ok(alvo, 'um nó pequeno alcançável');
  for (const id of alvo.c) assert.ok(P.alocar(e, id).ok, `alocou ${id}`);
  e.gold = 12345;
  e.bank = 678;
  e.passivas.restituicoes = 2;
  e.passivas.respecsGratis = 1;
  return { e, caminho: alvo.c };
}
const intacto = (e) => [e.gold, e.bank, e.passivas.restituicoes, e.passivas.respecsGratis];

test('tirar um nó: de graça, sem gastar ouro, restituição nem o respec da migração — e a tela diz "grátis"', { skip: SEM }, () => {
  assert.equal(P.regrasDoRespec().gratis, true);
  const { e, caminho } = comNos();
  const ultimo = caminho.at(-1);
  const plano = P.planoDeRespec(e, { ids: [ultimo] });
  assert.equal(plano.ok, true, plano.erro);
  assert.equal(plano.preco, 0);
  assert.equal(plano.semCusto, true);
  assert.equal(plano.restituicoes, 0);
  const antes = intacto(e);
  const r = P.respec(e, { ids: [ultimo] });
  assert.equal(r.ok, true, r.erro);
  assert.ok(!e.passivas.alocados.includes(ultimo), 'o nó saiu');
  assert.deepEqual(intacto(e), antes, 'nada foi gasto');
  const v = P.vista(e);
  assert.equal(v.respecGratis, true, 'a tela mostra "Tirar (grátis)"');
  assert.equal(v.precoPorNo, 0);
});

test('respec completo: de graça (o respec da migração continua guardado) e também durante a caçada', { skip: SEM }, () => {
  const { e } = comNos();
  const antes = intacto(e);
  // na caçada (`emCacada`): liberado, como no PoE
  assert.equal(P.vista(e, true).podeTirar, true);
  const r = Comandos.comando(e, { action: 'respec', tudo: true }, true);
  assert.notEqual(r.ok, false, r.erro);
  assert.deepEqual(e.passivas.alocados, [P.inicioDe(e), P.inicioDaAscendencia(e)].filter(Boolean).filter((x) => e.passivas.alocados.includes(x)), 'só o início ficou');
  assert.deepEqual(intacto(e), antes, 'nada foi gasto');
});
