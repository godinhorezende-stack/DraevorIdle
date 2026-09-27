// `game/database/redis.mjs` — cache opcional. Sem `REDIS_URL`, tudo aqui vira
// no-op (é o que os outros 230 testes já provam, rodando sem Redis no ar).
// O de verdade só roda com `REDIS_URL_TESTE` no ambiente (não trava quem não
// tem Redis local — mesmo padrão de `db.test.mjs` com `DATABASE_URL_TESTE`).
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('sem REDIS_URL: obter/guardar/apagar são no-op, ninguém quebra', async () => {
  const original = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  const Cache = await import(`../database/redis.mjs?semredis=${Math.random()}`);
  assert.equal(await Cache.obter('qualquer-coisa'), undefined);
  await Cache.guardar('qualquer-coisa', { a: 1 }); // não deve lançar
  await Cache.apagar('qualquer-coisa'); // não deve lançar
  await Cache.apagarComPrefixo('prefixo:'); // não deve lançar
  if (original) process.env.REDIS_URL = original;
});

test('sem REDIS_URL: obterOuCalcular sempre roda `calcular` (Postgres continua sendo a fonte da verdade)', async () => {
  const original = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  const Cache = await import(`../database/redis.mjs?semredisoc=${Math.random()}`);
  let chamadas = 0;
  const valor = await Cache.obterOuCalcular('x', 60, async () => {
    chamadas++;
    return { veio: 'do-calculo' };
  });
  assert.deepEqual(valor, { veio: 'do-calculo' });
  await Cache.obterOuCalcular('x', 60, async () => {
    chamadas++;
    return { veio: 'do-calculo' };
  });
  assert.equal(chamadas, 2); // sem Redis, NUNCA cacheia de verdade — recalcula toda vez, nunca serve dado velho
  await Cache.invalidar('x'); // não deve lançar
  await Cache.atualizar('x', { a: 1 }, 60); // não deve lançar
  if (original) process.env.REDIS_URL = original;
});

const urlRedis = process.env.REDIS_URL_TESTE;
if (urlRedis) {
  test('[redis] guardar/obter/apagar fazem o CRUD básico', async () => {
    const original = process.env.REDIS_URL;
    process.env.REDIS_URL = urlRedis;
    const Cache = await import(`../database/redis.mjs?comredis=${Math.random()}`);
    const chave = `teste:${Math.random()}`;

    assert.equal(await Cache.obter(chave), undefined);
    await Cache.guardar(chave, { nome: 'a', valor: 1 });
    assert.deepEqual(await Cache.obter(chave), { nome: 'a', valor: 1 });

    await Cache.guardar(chave, null); // um cache de "sabidamente vazio" tem que sobreviver a ida-e-volta
    assert.equal(await Cache.obter(chave), null);

    await Cache.apagar(chave);
    assert.equal(await Cache.obter(chave), undefined);
    await Cache.fechar();
    if (original) process.env.REDIS_URL = original;
    else delete process.env.REDIS_URL;
  });

  test('[redis] obterOuCalcular: miss roda `calcular` e grava; hit devolve do Redis sem rodar de novo', async () => {
    const original = process.env.REDIS_URL;
    process.env.REDIS_URL = urlRedis;
    const Cache = await import(`../database/redis.mjs?ochit=${Math.random()}`);
    const chave = `oc:${Math.random()}`;
    let chamadas = 0;
    const calcular = async () => { chamadas++; return { n: chamadas }; };

    const antes = Cache.estatisticasDoCache();
    const primeiro = await Cache.obterOuCalcular(chave, 60, calcular); // MISS
    const segundo = await Cache.obterOuCalcular(chave, 60, calcular); // HIT
    const depois = Cache.estatisticasDoCache();

    assert.deepEqual(primeiro, { n: 1 });
    assert.deepEqual(segundo, { n: 1 }); // não é { n: 2 } — a 2ª chamada não rodou `calcular`
    assert.equal(chamadas, 1);
    assert.equal(depois.misses, antes.misses + 1);
    assert.equal(depois.hits, antes.hits + 1);

    await Cache.apagar(`cache:${chave}`);
    await Cache.fechar();
    if (original) process.env.REDIS_URL = original;
    else delete process.env.REDIS_URL;
  });

  test('[redis] invalidar/atualizar: depois de invalidar, o próximo obterOuCalcular recalcula; atualizar já deixa o valor novo pronto', async () => {
    const original = process.env.REDIS_URL;
    process.env.REDIS_URL = urlRedis;
    const Cache = await import(`../database/redis.mjs?ocinv=${Math.random()}`);
    const chave = `oc-inv:${Math.random()}`;
    let chamadas = 0;
    const calcular = async () => { chamadas++; return { n: chamadas }; };

    await Cache.obterOuCalcular(chave, 60, calcular); // MISS, grava { n: 1 }
    await Cache.invalidar(chave);
    const depoisDeInvalidar = await Cache.obterOuCalcular(chave, 60, calcular); // MISS de novo
    assert.deepEqual(depoisDeInvalidar, { n: 2 });
    assert.equal(chamadas, 2);

    // Simula "Postgres confirmou, agora atualiza o cache" — sem passar por `calcular`.
    await Cache.atualizar(chave, { n: 'escrito-direto' }, 60);
    assert.deepEqual(await Cache.obter(`cache:${chave}`), { n: 'escrito-direto' });

    await Cache.apagar(`cache:${chave}`);
    await Cache.fechar();
    if (original) process.env.REDIS_URL = original;
    else delete process.env.REDIS_URL;
  });

  test('[redis] Redis indisponível (URL errada): obterOuCalcular ainda funciona, só sem cachear', async () => {
    const original = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://localhost:1'; // porta que ninguém escuta
    const Cache = await import(`../database/redis.mjs?semar=${Math.random()}`);
    let chamadas = 0;
    const calcular = async () => { chamadas++; return { veio: 'do-postgres-mesmo-sem-redis' }; };

    const r1 = await Cache.obterOuCalcular('x', 60, calcular);
    const r2 = await Cache.obterOuCalcular('x', 60, calcular);
    assert.deepEqual(r1, { veio: 'do-postgres-mesmo-sem-redis' });
    assert.deepEqual(r2, { veio: 'do-postgres-mesmo-sem-redis' });
    assert.equal(chamadas, 2); // sem Redis de pé, cada chamada recalcula — nunca quebra, só não cacheia

    if (original) process.env.REDIS_URL = original;
    else delete process.env.REDIS_URL;
  });

  test('[redis] apagarComPrefixo limpa só as chaves do prefixo', async () => {
    const original = process.env.REDIS_URL;
    process.env.REDIS_URL = urlRedis;
    const Cache = await import(`../database/redis.mjs?prefixo=${Math.random()}`);
    const p = `pref-${Math.random()}:`;
    await Cache.guardar(`${p}um`, 1);
    await Cache.guardar(`${p}dois`, 2);
    await Cache.guardar('fora-do-prefixo', 3);

    await Cache.apagarComPrefixo(p);

    assert.equal(await Cache.obter(`${p}um`), undefined);
    assert.equal(await Cache.obter(`${p}dois`), undefined);
    assert.equal(await Cache.obter('fora-do-prefixo'), 3);
    await Cache.apagar('fora-do-prefixo');
    await Cache.fechar();
    if (original) process.env.REDIS_URL = original;
    else delete process.env.REDIS_URL;
  });
} else {
  test('[redis] pulado — sem REDIS_URL_TESTE no ambiente', { skip: true }, () => {});
}
