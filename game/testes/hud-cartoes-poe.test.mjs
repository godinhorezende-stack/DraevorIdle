// OS CARTÕES DO HUD dos buffs do PoE por nome (dono, 14/10: "Corrigir os cartões", depois da conferência no navegador): o cartão sem ícone (a
// Casca, as Direções, a Égide, a Infusão, a Praga, os altares…) mostra a SIGLA do nome acima do número — antes, só o número; e o balão de cada
// Égide diz o tipo dela (antes, "elemental" em todas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');

test('a SIGLA do cartão sem ícone: a primeira palavra do nome, até 5 letras (o `hud.mjs` do cliente)', () => {
  // (o cliente não carrega no Node — caminhos do navegador: a função, do arquivo)
  const fonte = readFileSync(new URL('../frontend/client/src/hud.mjs', import.meta.url), 'utf8');
  const m = /^export const siglaDoBuff = (.+);$/m.exec(fonte);
  assert.ok(m, 'a função está no hud.mjs');
  const siglaDoBuff = (0, eval)(m[1]);
  assert.equal(siglaDoBuff('Casca'), 'Casca');
  assert.equal(siglaDoBuff('Égide de Fogo'), 'Égide');
  assert.equal(siglaDoBuff('Direções: Todos'), 'Dire.');
  assert.equal(siglaDoBuff('Infusão Espiritual'), 'Infu.');
  assert.equal(siglaDoBuff('Altar Massivo'), 'Altar');
  assert.equal(siglaDoBuff(''), '');
  // (e o cartão sem ícone nem carga ganha a sigla)
  assert.match(fonte, /sigla\.className = 'hud-sigla'/);
  assert.match(readFileSync(new URL('../frontend/client/style.css', import.meta.url), 'utf8'), /\.hud-sigla \{/);
});

test('o BALÃO de cada Égide diz o tipo dela (Fogo, Gelo, Raio, Físico; a Primitiva e a Elemental, Fogo, Gelo e Raio)', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 80 });
  e.sistema = 'poe';
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const tipos = { fogo: ['fire'], gelo: ['ice'], raio: ['energy'], fisica: ['physical'], elemental: ['fire', 'ice', 'energy'], primitiva: ['fire', 'ice', 'energy'] };
  e.hunt.egides = Object.fromEntries(Object.entries(tipos).map(([k, t]) => [k, { tipos: t, valor: 500, max: 1000, ultimoDano: -Infinity }]));
  const balao = Object.fromEntries(ModsPoe.buffsDoCliente(e).filter((c) => c.tipo === 'egide').map((c) => [c.nome, c.dica]));
  assert.match(balao['Égide de Fogo'], /toma o dano de Fogo dos acertos/);
  assert.match(balao['Égide de Gelo'], /toma o dano de Gelo dos acertos/);
  assert.match(balao['Égide Relampejante'], /toma o dano de Raio dos acertos/);
  assert.match(balao['Égide Física'], /toma o dano Físico dos acertos/);
  assert.match(balao['Égide Elemental'], /de Fogo, Gelo e Raio/);
  assert.match(balao['Égide Primitiva'], /de Fogo, Gelo e Raio/);
  for (const d of Object.values(balao)) assert.doesNotMatch(d, /dano elemental/);
});

// (16/10) O ELUSIVO (o do lote 33, que perde 20 pontos de efeito por segundo): o cartão mostra o efeito de agora em %, no lugar do relógio;
// o tempo fica no balão. Os outros buffs por nome seguem com o relógio.
test('o cartão do ELUSIVO mostra o efeito de agora em % (cai 20 pontos por segundo); o balão diz o tempo', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 80 });
  e.sistema = 'poe';
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  const h = e.hunt;
  const t0 = h.clock;
  ModsPoe.ganharBuff(h, 'elusivo', 4, t0, { efeitoExtra: 50 });
  const cartao = (buff) => ModsPoe.buffsDoCliente(e).find((c) => c.buff === buff);
  assert.equal(cartao('elusivo').efeito, 150, '100% + 50% do efeito aumentado');
  h.clock = t0 + 2500;
  assert.equal(cartao('elusivo').efeito, 100, '2,5 s depois: 50 pontos a menos');
  assert.match(cartao('elusivo').dica, /^Elusivo: 100% de efeito, 5s restantes \(perde 20 pontos por segundo/);
  ModsPoe.ganharBuff(h, 'adrenalina', 3, h.clock);
  assert.equal(cartao('adrenalina').efeito, undefined);
  h.clock = t0 + 7500;
  assert.equal(cartao('elusivo'), undefined, 'em 0% ele sai');
  // (o hud.mjs: o % no lugar do relógio, sem piscar no fim, e o balão é a `dica`)
  const fonte = readFileSync(new URL('../frontend/client/src/hud.mjs', import.meta.url), 'utf8');
  assert.match(fonte, /buff\.efeito != null \? `\$\{buff\.efeito\}%`/);
  assert.match(fonte, /const semRelogio = .*buff\.efeito != null/);
  assert.match(fonte, /buff\.efeito != null \? buff\.dica \?\?/);
});
