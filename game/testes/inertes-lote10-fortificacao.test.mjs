// (06/11, lote 10 das inertes — dono: "Continue resolvendo até dar zero nos itens") a FORTIFICAÇÃO (o jogo a tem desde o lote D; a regra genérica "não existe"
// escondia as linhas): por Fortificação, no máximo, o Dom de Willow, o Distintivo da Irmandade e o suporte Fortificar encaixado.
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
const fortificar = (e, n) => ModsPoe.ganharFortificacao(e.hunt, n, ficha(e).afPoe, e.hunt.clock);

test('por Fortificação e no máximo: Velocidade de Ataque, Supressão; Velocidade no máximo; Agressividade enquanto Fortificado', { skip: SEM }, () => {
  const e = personagem(['Velocidade de Ataque aumentada em 1% por Fortificação', '+4% de chance de Suprimir Dano Mágico por Fortificação', 'Velocidade de Ataque e Conjuração aumentada em 18% enquanto no máximo de Fortificações', 'Você tem Agressividade enquanto Fortificado']);
  const antes = soma(e);
  fortificar(e, 10);
  let s = soma(e);
  assert.equal((s.atk_speed ?? 0) - (antes.atk_speed ?? 0), 10 + 20, '10 por Fortificação + a Agressividade (20)');
  assert.equal((s.spell_suppression ?? 0) - (antes.spell_suppression ?? 0), 40);
  fortificar(e, 20);
  s = soma(e);
  assert.equal((s.cast_speed ?? 0) - (antes.cast_speed ?? 0), 18 + 20, 'no máximo (20): +18% de Conjuração, e a Agressividade');
});

test('o Dom de Willow tira o menos dano inerente; o Distintivo da Irmandade: +1 máximo por Tolerância e a chance de perder uma', { skip: SEM }, () => {
  const e = personagem(['Você não sofre menos dano de forma inerente por ter Fortificação', '+1 ao máximo de Fortificações por Carga de Tolerância', '100% de chance de perder uma Carga de Tolerância ao ganhar Fortificação']);
  Cargas.ganhar(e, 'tolerancia', ficha(e).cargas, 3);
  assert.equal(ModsPoe.maxFortificacao(ficha(e).afPoe), 23);
  fortificar(e, 5);
  assert.equal(soma(e).fortificacao_menos_dano, undefined);
  assert.equal(cargas(e, 'tolerancia'), 2);
});

test('"Gemas Encaixadas são Suportadas por Fortificar" sai da regra genérica: é o suporte encaixado', { skip: SEM }, () => {
  assert.deepEqual(t('Gemas Encaixadas são Suportadas por Fortificar nível 12').efeitos, [{ stat: 'suporte_local:fortificar', valor: 12 }]);
});
