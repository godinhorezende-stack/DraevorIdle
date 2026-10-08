// O balão do top 5 da capa (`ligarBalao`, client/site/top5.mjs): parar o mouse numa linha abre o inventário da pessoa; sair da linha fecha
// com um respiro de 180 ms (para dar tempo de levar o mouse até o balão). Descendo DIRETO de uma linha para a vizinha, o respiro da primeira
// fechava o balão da segunda — uma linha sim, uma não (dono, 08/10: "coloco o mouse em cima e não aparece os equipamentos"; reproduzido
// no site de produção num Chromium sem tela). Aqui roda a função de verdade, extraída do arquivo, com um relógio de mentira.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const TOP5 = readFileSync(new URL('../frontend/client/site/top5.mjs', import.meta.url), 'utf8');
const FONTE = TOP5.match(/function ligarBalao\(li, entrada\) \{[\s\S]*?\n\}/)?.[0];

/** A capa de mentira: as linhas, o relógio e o balão (aberto com o nome de quem, ou null). */
function capa() {
  let agora = 0;
  let proximo = 0;
  const relogio = new Map();
  const setTimeout = (fn, ms) => { relogio.set(++proximo, { fn, quando: agora + ms }); return proximo; };
  const clearTimeout = (id) => relogio.delete(id);
  const andar = (ms) => {
    const ate = agora + ms;
    for (;;) {
      const [id, t] = [...relogio.entries()].sort((a, b) => a[1].quando - b[1].quando)[0] ?? [];
      if (!t || t.quando > ate) break;
      relogio.delete(id);
      agora = t.quando;
      t.fn();
    }
    agora = ate;
  };
  const tela = { aberto: null, mouseNoBalao: false };
  // O `mostrarInventario` de verdade busca a ficha (aqui, 50 ms) e só abre se o mouse ainda está na linha; o `esconderInventario` é o de verdade.
  const ligarBalao = new Function('setTimeout', 'clearTimeout', 'location', 'tela', `
    const balao = { matches: () => tela.mouseNoBalao };
    let linhaAtual = null;
    let espera = null;
    let fechando = null;
    function mostrarInventario(li, entrada) { setTimeout(() => { if (linhaAtual === li && li.isConnected) tela.aberto = entrada.name; }, 50); }
    function esconderInventario() { clearTimeout(espera); clearTimeout(fechando); linhaAtual = null; tela.aberto = null; }
    ${FONTE}
    return ligarBalao;`)(setTimeout, clearTimeout, {}, tela);
  const linha = (name) => {
    const ouvintes = {};
    const li = { isConnected: true, addEventListener: (tipo, fn) => { ouvintes[tipo] = fn; } };
    ligarBalao(li, { name });
    return { entrar: () => ouvintes.pointerenter({ pointerType: 'mouse' }), sair: () => ouvintes.pointerleave({ pointerType: 'mouse' }) };
  };
  return { linha, andar, tela };
}

test('descendo de uma linha direto para a vizinha, o balão abre com a pessoa da linha nova (e fica)', () => {
  assert.ok(FONTE, 'achei o ligarBalao no top5.mjs');
  const { linha, andar, tela } = capa();
  const [poker, semsombra, puguii] = ['Poker', 'Semsombra', 'Puguii'].map(linha);
  poker.entrar();
  andar(500);
  assert.equal(tela.aberto, 'Poker');
  // O mouse cruza a borda: sai de uma e entra na outra no mesmo instante.
  poker.sair();
  semsombra.entrar();
  andar(500);
  assert.equal(tela.aberto, 'Semsombra', 'o respiro da linha de cima fechava o balão da de baixo');
  semsombra.sair();
  puguii.entrar();
  andar(500);
  assert.equal(tela.aberto, 'Puguii');
});

test('sair da linha para o vazio fecha depois do respiro; para dentro do balão, ele fica aberto', () => {
  const { linha, andar, tela } = capa();
  const poker = linha('Poker');
  poker.entrar();
  andar(500);
  poker.sair();
  andar(100);
  assert.equal(tela.aberto, 'Poker', 'durante o respiro o balão ainda está lá');
  andar(200);
  assert.equal(tela.aberto, null, 'passado o respiro, fecha');

  poker.entrar();
  andar(500);
  poker.sair();
  tela.mouseNoBalao = true; // chegou no balão (para passar nas peças)
  andar(500);
  assert.equal(tela.aberto, 'Poker');
});
