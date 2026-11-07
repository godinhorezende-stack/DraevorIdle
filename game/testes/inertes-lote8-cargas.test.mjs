// (06/11, lote 8 das inertes — dono: "Continue resolvendo até dar zero nos itens") as CARGAS DE ÚNICO (`itens-poe/cargas.mjs`): as Brutais, de Aflição e de Absorção
// no lugar de uma das três; as Espirituais, as Divinas (a Divindade) e as do Vazio; e as Almas Devoradas (o máximo e a perda ao usar um Frasco).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Cargas = await import('../systems/itens-poe/cargas.mjs');
const Traduzir = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const t = (texto) => {
  const nums = [];
  const modelo = texto.replace(/-?\d+(?:[.,]\d+)?/g, (m) => { nums.push(Number(m)); return `{${nums.length - 1}}`; });
  return Traduzir.traduzirMod({ modelo, valores: nums });
};
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** O personagem com as LINHAS do PoE na arma (traduzidas como no jogo). */
function personagem(linhas = []) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = peca('Wands/Driftwood_Wand');
  const af = { ...(arma.poe.af ?? {}) };
  for (const l of linhas) for (const x of t(l).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  arma.poe.af = af;
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.maxHp = e.hp = 10_000;
  P.garantir(e);
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const soma = (e) => { Ficha.invalidar(e); return Afixos.soma(e); };
const cargas = (e, tipo) => { const c = e.hunt.cargasPoe?.[tipo]; return c && c.ate > e.hunt.clock ? c.n : 0; };

const ARN = ['Ganha Cargas Brutais ao invés de Cargas de Tolerância', 'Máximo de Cargas Brutais é igual ao Máximo de Cargas de Tolerância', 'Modificadores ao Mínimo de Cargas de Tolerância são aplicados ao Mínimo de Cargas Brutais ao invés'];

test('as Brutais: no lugar das de Tolerância, com o máximo delas; 3% de Dano Triplicado e 10% de Ponto de Atordoamento por carga', { skip: SEM }, () => {
  const e = personagem(ARN);
  const regras = ficha(e).cargas;
  assert.equal(Cargas.maximo(regras, 'brutal'), 3);
  Cargas.ganhar(e, 'tolerancia', regras, 5);
  assert.equal(cargas(e, 'tolerancia'), 0);
  assert.equal(cargas(e, 'brutal'), 3);
  const s = soma(e);
  assert.equal(s.chance_dano_triplo, 9);
  assert.equal(s.ponto_atordoamento_proprio_red, -30);
  // sem a linha do máximo, o máximo é 0
  const sem = personagem(ARN.slice(0, 1));
  assert.equal(Cargas.maximo(ficha(sem).cargas, 'brutal'), 0);
});

test('as de Aflição (no lugar das de Frenesi) e as de Absorção (no lugar das de Poder): o Escudo recuperado do Dano Elemental', { skip: SEM }, () => {
  const e = personagem(['Ganha Cargas de Absorção ao invés de Cargas de Poder', 'Máximo de Cargas de Absorção é igual ao Máximo de Cargas de Poder', 'Ganha Cargas de Aflição ao invés de Cargas de Frenesi', 'Máximo de Cargas de Aflição é igual ao Máximo de Cargas de Frenesi']);
  const regras = ficha(e).cargas;
  Cargas.ganhar(e, 'poder', regras, 2);
  Cargas.ganhar(e, 'frenesi', regras, 1);
  assert.equal(cargas(e, 'absorcao'), 2);
  assert.equal(cargas(e, 'aflicao'), 1);
  const s = soma(e);
  assert.equal(s.recoup_es_elemental, 24);
  assert.equal(s.dano_dot_mais, 8);
  const h = e.hunt;
  h.recuperacoes = [];
  ModsPoe.aoSerAcertado(e, h, null, ficha(e), { dano: 1000, magia: true, tipo: 'fire' });
  const r = h.recuperacoes.find((x) => x.recurso === 'es');
  assert.ok(r && Math.abs(r.porMs * (r.ate - r.desde) - 240) < 1e-6, JSON.stringify(h.recuperacoes));
});

test('as Espirituais: +1 de máximo por Joia Abissal, ganha ao matar e por segundo; o Golpe Brutal tira todas e cada uma perdida recupera Vida', { skip: SEM }, () => {
  const e = personagem(['Recebe uma Carga Espiritual por segundo', 'Perde todas as Cargas Espirituais ao sofrer o Golpe Brutal', 'Recupera 3% de Vida quando perder uma Carga Espiritual', 'Ganhe 5% do Dano Físico como Dano Extra de Cada Elemento por Carga Espiritual']);
  e.equipment.weapon.poe.af.max_espiritual = 3;
  const h = e.hunt;
  for (let i = 0; i < 5; i++) { h.clock += 1000; Cargas.tique(e, ficha(e).cargas); }
  assert.equal(cargas(e, 'espiritual'), 3);
  assert.equal(soma(e).phys_as_extra_fire, 15);
  e.hp = 5000;
  ModsPoe.aoSerAcertado(e, h, null, ficha(e), { dano: 2000, corpoACorpo: true, tipo: 'physical' });
  assert.equal(cargas(e, 'espiritual'), 0);
  assert.equal(e.hp, 5000 + 3 * 300);
});

test('as Divinas: uma ao Acertar, até 10; no máximo, Divindade por 10 s e as cargas saem', { skip: SEM }, () => {
  const e = personagem(['+10 às Cargas Divinas máximas', 'Você ganha Divindade por 10 segundos ao atingir o máximo de Cargas Divinas', 'Perca todas as Cargas Divinas quando ganhar Divindade']);
  const regras = ficha(e).cargas;
  Cargas.ganhar(e, 'divina', regras, 9);
  assert.equal(cargas(e, 'divina'), 9);
  Cargas.ganhar(e, 'divina', regras, 1);
  assert.equal(e.hunt.poeBuffs?.divindade, e.hunt.clock + 10_000);
  assert.equal(cargas(e, 'divina'), 0);
  assert.equal(soma(e).mais_dano_elemental, 50);
});

test('as do Vazio: +5 de máximo e uma por segundo; as Almas Devoradas: o máximo da Ascensão da Alma e a Alma Sedenta', { skip: SEM }, () => {
  const e = personagem(['5 ao Máximo de Cargas do Vazio', 'Recebe uma Carga do Vácuo por segundo', '-40 ao número Máximo de Almas Devoradas', 'Perde todas as Almas Devoradas quando você usar um Frasco']);
  const h = e.hunt;
  for (let i = 0; i < 8; i++) { h.clock += 1000; Cargas.tique(e, ficha(e).cargas); }
  assert.equal(cargas(e, 'vazio'), 5);
  for (let i = 0; i < 9; i++) ModsPoe.almaDoJogador(h, h.clock);
  assert.equal(ModsPoe.almasDoJogador(h, h.clock), 5, '45 − 40');
  ModsPoe.evento(e, h, 'usarFrasco', ficha(e), {});
  assert.equal(ModsPoe.almasDoJogador(h, h.clock), 0);
});
