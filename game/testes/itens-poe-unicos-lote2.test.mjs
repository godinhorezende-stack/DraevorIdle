// (06/11, dono: "continue o lote 2") Os ANÉIS únicos: das 88 linhas sem efeito, as que o jogo já sabe fazer ganham a regra (o Salteador rouba as
// cargas, Nimis faz os Projéteis retornarem, a Lanterna de Lori, o Sinete de Grattus, a Devastação Polar por espaço de anel, a Brasa Desperta,
// a Réplica da Danação de Doedre, a Revelação de Shavronne, o Lamento de Sibila, o Estratagema de Malachai pela cor da gema…); o Coração Negro
// faz Fugir (o estado novo `fugindo` no alvo — o Raro, o Único e o chefe não fogem).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
await import('../systems/dados.mjs');
if (!SEM) await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

function anel(slug) {
  const c = Catalogo.catalogo().classes.Rings;
  const u = c.unicos.find((x) => x.slug === slug);
  const b = c.bases.find((x) => x.nome === u.base);
  return Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: b.id, raridade: 'unico', ilvl: 84, rng: semente(5), unico: slug }), Catalogo.REGRAS, semente(6));
}
const semEfeito = (p) => [...(p.poe.implicitos ?? []), ...(p.poe.prefixos ?? []), ...(p.poe.sufixos ?? []), ...(p.poe.modificadores ?? [])].filter((m, k) => p.poe.estados[k] === 'registrado').map((m) => m.texto);

test('os anéis que ficaram sem nenhuma linha "sem efeito"', { skip: SEM }, () => {
  for (const slug of ['The_Highwayman', 'Nimis', 'Loris_Lantern', 'Grattus_Signet', 'Polaric_Devastation', 'Emberwake', 'Replica_Doedres_Damning', 'Shavronnes_Revelation', 'Sibyls_Lament', 'Blackheart']) {
    assert.deepEqual(semEfeito(anel(slug)), [], slug);
  }
});

test('os efeitos: o Salteador rouba as cargas ao acertar, Nimis retorna os Projéteis, a Réplica da Danação tira uma Maldição, Malachai pela gema', { skip: SEM }, () => {
  assert.equal(anel('The_Highwayman').poe.af['ev:acertar:roubarCargas'], 100);
  assert.equal(anel('Nimis').poe.af.proj_retornar_chance, 100);
  assert.equal(anel('Replica_Doedres_Damning').poe.af.maldicoes_adicionais, -1);
  const m = anel('Malachais_Artifice').poe.af;
  assert.ok(Object.keys(m).some((k) => k.startsWith('fire_res%gemaLocal:R~')), 'a Resistência a Fogo com a Gema Vermelha');
  assert.ok(Object.keys(m).some((k) => k.startsWith('ice_res%gemaLocal:G~')), 'a de Gelo com a Verde');
  assert.ok(Object.keys(m).some((k) => k.startsWith('energy_res%gemaLocal:B~')), 'a de Raio com a Azul');
  const p = anel('Polaric_Devastation').poe.af;
  assert.ok(Object.keys(p).some((k) => /^ev:incendiar:alvo:cinzas:\d+@anelEsquerdo$/.test(k)));
  assert.ok(Object.keys(p).some((k) => /^ev:congelar:alvo:cobertoGelo:\d+@anelDireito$/.test(k)));
});

test('o estado novo "fugindo" (o Coração Negro): o comum foge; o Raro, o Único e o chefe não', () => {
  const comum = { hp: 10, raridade: 'normal', estados: {} };
  const raro = { hp: 10, raridade: 'raro', estados: {} };
  const chefe = { hp: 10, boss: { id: 'x' }, estados: {} };
  ModsPoe.porNoAlvo(comum, 'fugindo', 2000, 0);
  ModsPoe.porNoAlvo(raro, 'fugindo', 2000, 0);
  ModsPoe.porNoAlvo(chefe, 'fugindo', 2000, 0);
  assert.equal(comum.estados.fugindo?.ate, 2000);
  assert.equal(raro.estados.fugindo, undefined);
  assert.equal(chefe.estados.fugindo, undefined);
});
