// O nameplate do jogador (`frontend/client/src/nameplate-do-jogador.mjs`): a conta do layout (centralizado, escala, corte
// do nome, fora da tela) e o CACHE (nada é repintado quando só a vida muda). O desenho em si usa um canvas de mentira
// que só registra as chamadas — o resultado visual conferi à parte (ver o relatório).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NAMEPLATE, NameplateDoJogador, calcularLayout, cortarNome, dentroDaTela, escalaDoNameplate, fracao } from '../frontend/client/src/nameplate-do-jogador.mjs';

function canvasDeMentira() {
  const chamadas = [];
  const ctx = new Proxy({}, {
    get(alvo, nome) {
      if (nome in alvo) return alvo[nome];
      if (nome === 'measureText') return (t) => ({ width: String(t).length * 7 });
      if (nome === 'createLinearGradient' || nome === 'createRadialGradient') return () => ({ addColorStop() {} });
      return (...args) => { chamadas.push([nome, ...args]); };
    },
    set(alvo, nome, valor) { alvo[nome] = valor; return true; },
  });
  return { getContext: () => ctx, chamadas, width: 1, height: 1 };
}
const novo = (extra = {}) => new NameplateDoJogador({ criarTela: () => canvasDeMentira(), ...extra });
const nitido = (v) => Math.round(v * 2) / 2;
const dados = (extra = {}) => ({ nome: 'Draevor', nivel: 85, hp: 80, maxHp: 100, mana: 50, maxMana: 100, propria: true, cx: 200, topoDaCasa: 120, escala: 1, ...extra });
const opcoes = { telaL: 400, telaA: 300, nitido, ratio: 2 };

test('N1. a escala: o telefone é menor; o zoom do mapa mexe pouco; sai em degraus (poucas chaves de cache)', () => {
  assert.equal(escalaDoNameplate({ zoom: 1, telefone: false }), 1);
  assert.equal(escalaDoNameplate({ zoom: 1, telefone: true }), 0.8);
  assert.ok(escalaDoNameplate({ zoom: 2 }) > 1 && escalaDoNameplate({ zoom: 2 }) <= NAMEPLATE.zoom.maximo + 0.05);
  assert.ok(escalaDoNameplate({ zoom: 10 }) <= NAMEPLATE.zoom.maximo + 0.05, 'o zoom não explode o nameplate');
  const degraus = new Set();
  for (let z = 1; z <= 3; z += 0.01) degraus.add(escalaDoNameplate({ zoom: z }));
  assert.ok(degraus.size <= 6, `${degraus.size} escalas diferentes`);
});

test('N2. o conjunto é centralizado no boneco e acima da cabeça; a esfera fica à esquerda do nome e na altura do meio', () => {
  const c = calcularLayout({ cx: 200, topoDaCasa: 120, larguraDoNome: 50 });
  assert.ok(Math.abs((c.esq + c.dir) / 2 - 200) < 1e-9, 'centralizado');
  assert.equal(c.base, 120 - NAMEPLATE.distanciaVertical, 'a base fica acima do alto da casa');
  assert.ok(c.base < 120 && c.topo < c.base);
  assert.ok(c.colunaX > c.esferaX + c.D, 'o nome fica à direita da esfera');
  assert.ok(Math.abs(c.esferaCY - (c.topo + c.altura / 2)) < 1e-9);
  assert.ok(c.vidaTopo > c.nomeTopo && c.manaTopo > c.vidaTopo, 'nome, depois a vida, depois a mana');
});

test('N3. a mana só ocupa lugar quando existe; sem barras a coluna é só o nome; escala multiplica tudo', () => {
  const com = calcularLayout({ cx: 0, topoDaCasa: 0, larguraDoNome: 40, comMana: true });
  const sem = calcularLayout({ cx: 0, topoDaCasa: 0, larguraDoNome: 40, comMana: false });
  assert.ok(com.manaH > 0 && sem.manaH === 0);
  assert.ok(sem.vidaH > 0);
  const nada = calcularLayout({ cx: 0, topoDaCasa: 0, larguraDoNome: 40, comMana: false, comBarras: false });
  assert.equal(nada.vidaH + nada.manaH, 0);
  const meia = calcularLayout({ cx: 0, topoDaCasa: 0, larguraDoNome: 20, escala: 0.5 });
  const cheia = calcularLayout({ cx: 0, topoDaCasa: 0, larguraDoNome: 40, escala: 1 });
  assert.ok(Math.abs(meia.D * 2 - cheia.D) < 1e-9);
});

test('N4. nome longo é cortado com reticências dentro do limite; nome curto não muda', () => {
  const medir = (t) => t.length * 7;
  assert.equal(cortarNome('Ana', medir, 84), 'Ana');
  const longo = cortarNome('Lord Aelthorion of Eastmarch the Third', medir, 84);
  assert.ok(longo.endsWith('…') && medir(longo) <= 84, longo);
  assert.equal(cortarNome('', medir, 84), '');
});

test('N5. a fração da barra: sem máximo não há barra; limita entre 0 e 1', () => {
  assert.equal(fracao(50, 100), 0.5);
  assert.equal(fracao(150, 100), 1);
  assert.equal(fracao(-3, 100), 0);
  assert.equal(fracao(10, 0), null);
  assert.equal(fracao(10, undefined), null);
});

test('N6. fora da tela não desenha nada (culling) e devolve null; dentro, desenha e devolve a caixa', () => {
  const np = novo();
  const ctx = canvasDeMentira().getContext();
  const fora = np.desenhar(ctx, dados({ cx: -500 }), opcoes);
  assert.equal(fora, null);
  assert.equal(np.pintadas, 0, 'quem está fora da tela nem ganha placa no cache');
  assert.equal(dentroDaTela({ esq: 0, dir: 10, topo: 0, base: 10 }, 400, 300), true);
  assert.equal(dentroDaTela({ esq: 500, dir: 600, topo: 0, base: 10 }, 400, 300), false);
  assert.equal(dentroDaTela({ esq: 0, dir: 10, topo: -100, base: -50 }, 400, 300), false);
  const caixa = np.desenhar(ctx, dados(), opcoes);
  assert.ok(caixa && Math.abs((caixa.esq + caixa.dir) / 2 - 200) < 1e-9);
});

test('N7. por quadro são só drawImage (a placa e os dois preenchimentos); vida e mana mudando NÃO repintam nada', () => {
  const np = novo();
  const tela = canvasDeMentira();
  const ctx = tela.getContext();
  np.desenhar(ctx, dados(), opcoes);
  const pintadas = np.pintadas;
  const antes = tela.chamadas.length;
  for (let hp = 100; hp >= 0; hp -= 5) np.desenhar(ctx, dados({ hp, mana: hp / 2 }), opcoes);
  assert.equal(np.pintadas, pintadas, 'a vida e a mana não pintam placa nem enchimento de novo');
  const novas = tela.chamadas.slice(antes);
  assert.ok(novas.every(([nome]) => nome === 'drawImage'), `só drawImage por quadro, vi: ${[...new Set(novas.map((c) => c[0]))]}`);
  assert.ok(novas.length <= 21 * 3, 'no máximo placa + vida + mana por quadro');
});

test('N8. subir de nível gera UMA placa nova; o mesmo nível não repinta; nome e escala também entram na chave', () => {
  const np = novo();
  const ctx = canvasDeMentira().getContext();
  np.desenhar(ctx, dados(), opcoes);
  const base = np.pintadas;
  np.desenhar(ctx, dados(), opcoes);
  assert.equal(np.pintadas, base);
  np.desenhar(ctx, dados({ nivel: 86 }), opcoes);
  assert.equal(np.pintadas, base + 1, 'o 86 pintou uma placa só (os enchimentos já existiam)');
  np.desenhar(ctx, dados({ escala: 0.8 }), opcoes);
  assert.ok(np.pintadas > base + 1, 'outra escala, outra placa');
});

test('N9. a barra de preenchimento escala com a fração e some em 0; sem maxHp não há barras; sem mana não há barra de mana', () => {
  const np = novo();
  const tela = canvasDeMentira();
  const ctx = tela.getContext();
  const larguras = (extra) => { const a = tela.chamadas.length; np.desenhar(ctx, dados(extra), opcoes); return tela.chamadas.slice(a).filter(([n]) => n === 'drawImage'); };
  assert.equal(larguras({}).length, 3);
  assert.equal(larguras({ hp: 0, mana: 0 }).length, 1, 'zerados: só a placa');
  assert.equal(larguras({ maxHp: null, maxMana: null }).length, 1, 'sem máximos: sem barras');
  assert.equal(larguras({ maxMana: 0 }).length, 2, 'sem mana: placa e vida');
  const meia = larguras({ hp: 50, mana: 0 })[1];
  const cheia = larguras({ hp: 100, mana: 0 })[1];
  assert.ok(meia[8] < cheia[8], 'a vida pela metade desenha menos largura');
  assert.ok(Math.abs(meia[8] / cheia[8] - 0.5) < 0.05);
});

test('N10. o cache tem teto: milhares de nomes/níveis diferentes não crescem a memória sem fim', () => {
  const np = novo();
  const ctx = canvasDeMentira().getContext();
  for (let i = 0; i < 1000; i++) np.desenhar(ctx, dados({ nome: `Jogador${i}`, nivel: i }), opcoes);
  assert.ok(np.placas.size <= NAMEPLATE.tetoDoCache);
  assert.ok(np.enchimentos.size <= NAMEPLATE.tetoDoCache);
});

test('N11. desempenho: 300 jogadores por quadro cabem folgados (só drawImage de telas já prontas)', () => {
  const np = novo();
  const ctx = canvasDeMentira().getContext();
  for (let i = 0; i < 300; i++) np.desenhar(ctx, dados({ nome: `J${i % 40}`, nivel: 50 + (i % 5), cx: (i * 13) % 400 }), opcoes);
  const t0 = performance.now();
  for (let q = 0; q < 60; q++) for (let i = 0; i < 300; i++) np.desenhar(ctx, dados({ nome: `J${i % 40}`, nivel: 50 + (i % 5), cx: (i * 13) % 400, hp: (q * 7 + i) % 100 }), opcoes);
  const porQuadro = (performance.now() - t0) / 60;
  console.log(`      [N11] ${porQuadro.toFixed(2)} ms por quadro com 300 nameplates (canvas de mentira: custo do JS, não do desenho)`);
  assert.ok(porQuadro < 8, `${porQuadro}ms`);
});

test('N12. integração: o mapa manda a GENTE para o nameplate novo e deixa criatura, NPC e familiar no desenho de sempre', () => {
  const fonte = readFileSync(new URL('../frontend/client/src/map.mjs', import.meta.url), 'utf8');
  assert.match(fonte, /drawNameplate\(entity, cx, py\) \{\s*if \(this\.ehJogador\(entity\)\) return this\.drawNameplateDoJogador/);
  assert.match(fonte, /ehJogador\(entity\) \{\s*return entity\.isPlayer \|\| !!entity\.aliado \|\| \(entity\.isOther && !entity\.npc && !entity\.summon\)/);
  // O próprio jogador carrega nível e mana para a esfera e a barra azul; os outros não recebem mana (privado).
  assert.match(fonte, /level: character\.level,\s*mana: character\.mana,\s*maxMana: character\.derived\.maxMana/);
  // Só UMA marca de cargo e UM escudo de party: as do desenho antigo saíram.
  assert.equal(fonte.match(/this\.drawEscudoDaParty\(/g).length, 1);
  assert.equal(fonte.match(/this\.drawMarcaDoJogador\(/g).length, 1);
});
