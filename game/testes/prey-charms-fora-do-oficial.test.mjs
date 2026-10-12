// O PREY e os CHARMS fora do jogo oficial (dono, 12/10: "tire o sistema de prey e charms do front end tbm" — e, escolhido por ele, o
// servidor também no modo PoE). No PoE: nenhum bônus do Prey (dano, defesa, experiência, loot), o relógio parado, os comandos recusados e
// nada no quadro; nenhum charm dispara, sem pontos nem compra, e o bestiário segue contando as mortes; a loja não vende o slot de Prey nem
// os wildcards. Nada do personagem é apagado. A tela não tem mais os painéis, os botões nem os balões. O clássico não muda (os testes dele
// são `prey`, `charms` e `prey-combate`, que rodam pelo irmão `.classico`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { CATALOGO } = await import('../systems/dados.mjs');
const Prey = await import('../systems/prey.mjs');
const Charms = await import('../systems/charms.mjs');
const Loja = await import('../systems/loja.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

test('Prey no oficial: nenhum bônus mesmo com a presa ativa, o relógio parado, o comando recusado, nada no quadro — e nada apagado', { skip: SEM }, () => {
  const e = personagemDeTeste({ level: 100 });
  const key = Object.keys(CATALOGO.bestiary).find((k) => CATALOGO.bestiary[k]?.exp > 0);
  // Três presas ATIVAS na mesma criatura — dano, experiência e loot (o personagem que já tinha antes da regra).
  e.prey = ['damage', 'exp', 'loot'].map((bonus, index) => ({ index, state: 'active', key, bonus, percent: 40, left: 3_600_000, total: 7_200_000, options: [] }));
  const antes = JSON.stringify(e.prey);
  assert.equal(Prey.fatorDeDano(e, key), 1);
  assert.equal(Prey.fatorDeExp(e, key), 1);
  assert.equal(Prey.fatorDeLoot(e, key), 1);
  assert.equal(Prey.fatorDeDefesa(e, key), 1);
  Prey.consumir(e, 60_000);
  assert.deepEqual(Prey.paraCliente(e), {}, 'nada do Prey no quadro do personagem');
  assert.match(Prey.comando(e, { action: 'choose', slot: 0, key }).erro, /não existe no jogo oficial/);
  assert.equal(JSON.stringify(e.prey), antes, 'os slots ficam como estavam (nem o relógio andou)');
});

test('Charms no oficial: nenhum dispara, sem pontos nem compra; o bestiário segue contando, sem o aviso de pontos — e nada apagado', { skip: SEM }, () => {
  const e = personagemDeTeste({ level: 100 });
  const key = Object.keys(CATALOGO.bestiary).find((k) => CATALOGO.bestiary[k]?.toKill > 0 && CATALOGO.bestiary[k]?.charmPoints > 0);
  assert.ok(key, 'há criatura que paga ponto de charm');
  // Todos os charms comprados no máximo e apontados para a criatura (o personagem de antes da regra).
  e.charms = { tiers: Object.fromEntries(Charms.CHARMS.map((c) => [c.id, c.points.length])), alvos: Object.fromEntries(Charms.CHARMS.map((c) => [c.id, key])), gastos: 0 };
  const antes = JSON.stringify(e.charms);
  const hunt = { monstros: [], clock: 0, pos: { x: 0, y: 0 } };
  const bicho = { key, uid: 1, name: 'x', hp: 1000, maxHp: 1000, x: 1, y: 1 };
  const eventos = [];
  const aleatorio = Math.random;
  Math.random = () => 0; // (todo sorteio de charm acertaria)
  try {
    Charms.aoAcertar(e, hunt, bicho, eventos);
    Charms.aoMatar(e, hunt, bicho, eventos);
    assert.equal(Charms.desviou(e, hunt, null, bicho, eventos), false);
    Charms.depoisDeApanhar(e, hunt, bicho, 100, eventos);
    assert.equal(Charms.inverteDreno(e, bicho), false);
  } finally {
    Math.random = aleatorio;
  }
  assert.equal(bicho.hp, 1000, 'nenhum dano de charm');
  assert.equal(bicho.paralisadoAte, undefined, 'nenhuma paralisia');
  assert.deepEqual(eventos, []);
  assert.deepEqual(Charms.criticoExtra(e, key), { chance: 0, dano: 0 });
  assert.deepEqual(Charms.leechExtra(e, key, { lifeLeech: 10, manaLeech: 10 }), { vida: 0, mana: 0 });
  assert.match(Charms.comando(e, { action: 'upgrade', id: Charms.CHARMS[0].id }).erro, /não existem no jogo oficial/);
  assert.deepEqual(Charms.vista(e).list, []);
  assert.deepEqual(Object.keys(Charms.paraCliente(e)), ['bestiary'], 'só o bestiário vai para a tela');
  // O bestiário conta a morte; o aviso de "pontos de charm" não sai.
  e.bestiary = { [key]: CATALOGO.bestiary[key].toKill - 1 };
  const ev = [];
  Charms.contarMorte(e, key, ev);
  assert.equal(e.bestiary[key], CATALOGO.bestiary[key].toKill);
  assert.deepEqual(ev, []);
  assert.equal(JSON.stringify(e.charms), antes, 'os charms comprados ficam guardados');
});

test('Loja no oficial: sem o slot de Prey e sem os wildcards (nem na vitrine, nem na compra)', { skip: SEM }, () => {
  const e = personagemDeTeste({ level: 100 });
  e.coins = 10_000;
  const vitrine = Loja.catalogoDaLoja(e);
  const ids = Object.values(vitrine).filter(Array.isArray).flat().map((x) => x?.id);
  for (const id of ['prey-slot', 'wildcards-5', 'wildcards-25']) {
    assert.ok(!ids.includes(id), `${id} fora da vitrine`);
    const r = Loja.comprar(e, { id });
    assert.equal(r.ok, false, `${id} não se compra`);
  }
  assert.equal(e.coins, 10_000, 'nenhuma coin gasta');
  assert.notEqual(e.preyThirdSlot, true);
});

test('A tela não tem mais o Prey nem os Charms: sem painel, sem botão na barra, sem balão, sem linha na ficha e no HUD', () => {
  const ler = (f) => readFileSync(new URL(`../frontend/client/src/${f}`, import.meta.url), 'utf8');
  const panels = ler('panels.mjs');
  for (const nome of ['openPrey', 'openCharms', 'renderPrey', 'renderCharms', 'resumoDoPreyParaBalao', 'resumoDosCharmsParaBalao']) {
    assert.doesNotMatch(panels, new RegExp(`function ${nome}\\b`), `panels.mjs: ${nome}`);
  }
  const main = ler('main.mjs');
  assert.doesNotMatch(main, /id: 'prey'|id: 'charms'/, 'nenhum botão do Prey ou dos Charms na barra');
  assert.doesNotMatch(main, /openPrey|openCharms|t: 'charms'/, 'main.mjs não abre nem pede os dois');
  assert.doesNotMatch(ler('hud.mjs'), /character\.prey/, 'HUD sem a linha do Prey');
  assert.doesNotMatch(ler('sheet.mjs'), /character\.prey/, 'ficha sem a linha do Prey');
  assert.doesNotMatch(ler('traduz.mjs'), /apelidoDoCharm|textoDoCharm/);
  const css = readFileSync(new URL('../frontend/client/style.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /\.(prey-[\w-]+|charm(-[\w-]+)?)(?![\w-])/, 'nenhuma regra dos painéis no CSS');
});
