// (08/11 — o dono: "CONTINUE") as APROXIMADAS dos únicos, lote A5: "com esta Arma" vale só nos ataques DAQUELA arma — a mão do slot onde ela está
// (`jogo.separarDestaArma` → `estaArma`, que `condicoes-poe.doAnel` troca por `maoPrincipal`/`maoSecundaria`). Antes valia em todo ataque (ou em todo golpe).
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
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}
const INCENDIO = 'Incêndios infligidos com esta Arma causam {0}% mais Dano';
function adaga(mods) {
  const g = gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Daggers/Glass_Shank', raridade: 'normal', ilvl: 84, rng: () => 0.5 });
  g.raridade = 'magico';
  g.prefixos = mods.map(([modelo, v]) => ({ texto: modelo.replace('{0}', v), modelo, valores: [v] }));
  return J.pecaDoJogo(g);
}

test('a peça: o efeito "com esta Arma" sai com a condição estaArma, e a linha fica equivalente', { skip: SEM }, () => {
  const p = adaga([[INCENDIO, 50]]);
  assert.deepEqual(p.poe.af, { ...Object.fromEntries(Object.entries(p.poe.af).filter(([k]) => !k.startsWith('incendio_mais'))), 'incendio_mais@estaArma': 50 });
  assert.equal(p.poe.estados.at(-1), 'equivalente');
});

test('a soma: na Mão Principal vira maoPrincipal; na Secundária, maoSecundaria; fora das mãos, nada', () => {
  assert.equal(ModsPoe.doAnel('incendio_mais@estaArma', 'weapon'), 'incendio_mais@maoPrincipal');
  assert.equal(ModsPoe.doAnel('phys_as_extra_gelo_ou_raio@ataque+estaArma', 'shield'), 'phys_as_extra_gelo_ou_raio@ataque+maoSecundaria');
  assert.equal(ModsPoe.doAnel('incendio_mais@estaArma', 'ring'), null);
});

test('no golpe: o ataque da mão dela tem o efeito; a magia e a outra mão, não', { skip: SEM }, () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { sistema: 'poe', classePoe: 'Shadow' });
  e.equipment = { ...e.equipment, weapon: adaga([[INCENDIO, 50]]) };
  Ficha.invalidar(e);
  const ficha = Ficha.combate(e);
  assert.equal(Number(ficha.afPoe.incendio_mais) || 0, 0, 'não é global');
  const golpe = (tags, mao) => ModsPoe.fichaDoGolpe(mao ? { ...ficha, mao } : ficha, tags, { estado: e });
  assert.equal(ModsPoe.valor(golpe(['ataque', 'corpo']), 'incendio_mais'), 50, 'o ataque com a adaga');
  assert.equal(ModsPoe.valor(golpe(['magia']), 'incendio_mais'), 0, 'a magia');
  assert.equal(ModsPoe.valor(golpe(['ataque', 'corpo'], 'secundaria'), 'incendio_mais'), 0, 'o ataque da outra mão');
});
