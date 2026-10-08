// Os testes nunca gravam nos arquivos do jogo. Quem desvia a gravação para uma pasta temporária (`process.env.DRAEVOR_OVERRIDES = tmp`,
// o histórico, as versões...) tem de fazer isso ANTES de carregar o jogo: os módulos leem o caminho quando carregam, e um `import`
// estático roda antes de qualquer linha do arquivo. (08/10: `import … from './apoio.mjs'` estático — o apoio carrega o jogo inteiro —
// fez o item-power e a progressão gravarem os overrides de teste em gamedata/overrides, que o servidor local lê.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PASTA = fileURLToPath(new URL('.', import.meta.url));
const DESVIOS = ['DRAEVOR_OVERRIDES', 'ENGINE_AUDITORIA', 'ENGINE_VERSOES', 'ENGINE_ITEM_POWER_HISTORICO', 'PARTY_TABELA', 'DRAEVOR_CAMPANHA', 'DRAEVOR_SQLITE'];
// Os ajudantes que podem vir por import estático: não carregam nada que leia esses caminhos (provado no segundo teste).
const LEVES = ['./apoio-migracao.mjs', './apoio-classico.mjs'];

test('quem desvia a gravação para a pasta temporária não carrega o jogo por import estático antes disso', () => {
  const ruins = [];
  for (const f of readdirSync(PASTA).filter((n) => n.endsWith('.mjs'))) {
    const s = readFileSync(PASTA + f, 'utf8');
    if (!new RegExp(`^process\\.env\\.(${DESVIOS.join('|')}) *=`, 'm').test(s)) continue;
    const estaticos = [...s.matchAll(/^import [^;]*? from '([^']+)';/gm)].map((m) => m[1]).filter((de) => !de.startsWith('node:') && !LEVES.includes(de));
    if (estaticos.length) ruins.push(`${f}: ${estaticos.join(', ')}`);
  }
  assert.deepEqual(ruins, [], 'troque por `await import(...)` depois da linha do process.env');
});

test('os ajudantes leves não adiantam a leitura dos caminhos: depois deles, o desvio ainda vale', () => {
  for (const leve of LEVES) {
    const url = new URL(leve, import.meta.url).href;
    const jogo = new URL('../systems/overrides.mjs', import.meta.url).href;
    const codigo = `await import(${JSON.stringify(url)}); process.env.DRAEVOR_OVERRIDES = '/desvio-de-teste'; const O = await import(${JSON.stringify(jogo)}); console.log(O.PASTA); process.exit(0);`;
    const saida = execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { encoding: 'utf8' }).trim().split('\n').at(-1);
    assert.equal(saida, '/desvio-de-teste', leve);
  }
});
