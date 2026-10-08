// A fase que conclui por um MONSTRO precisa ter esse monstro (dono, 08/10: "um player não consegue completar essa fase: limpou a fase toda
// mas não matou esse chefe, e não completa"). O Kraityn não nascia na Ponte Quebrada (só os batedores e os escravos dele): os spawns do
// mapa não o traziam, e "Matar o chefe" nunca concluía. Eram 5 fases de chefe e 3 de item de missão assim; e o Telhado da Catedral pedia o
// Kitava — o chefe do PRÓPRIO Ato 5, que só existe na sala dele, aberta pelo portal que essa fase abriria ao concluir (o ato travava).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE ausente';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Campanha = await import('../systems/campanha.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const Bolsa = await import('../systems/bolsa.mjs');

/** Um personagem com a campanha toda aberta (todas as fases feitas e os chefes de ato vencidos), caçando em `huntId`. */
function naFase(huntId) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.sistema = 'poe';
  e.campanha = { facil: { completas: Campanha.FASES.map((x) => x.huntId).filter((id) => id !== huntId), bosses: Array.from({ length: 12 }, (_, i) => i + 1) } };
  Bolsa.garantir(e);
  const r = Cacadas.entrar(e, { huntId, mode: 'auto', strategy: 'nearest', dificuldade: 'facil' });
  assert.ok(r.ok, `${huntId}: ${r.erro}`);
  return e;
}
const bichos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];

test('toda fase que conclui por um monstro (matar o chefe, item de missão) tem esse monstro na instância', { skip: SEM }, () => {
  let comAlvo = 0;
  for (const f of Campanha.FASES) {
    const c = Campanha.conclusaoDa(f.huntId);
    if (!['matar-chefe', 'item-de-missao'].includes(c.tipo) || !c.monstro) continue;
    comAlvo++;
    const e = naFase(f.huntId);
    assert.ok(bichos(e).some((m) => Campanha.ehOMonstro(m.key, c.monstro)), `Ato ${f.ato} ${f.nome}: ${c.nome ?? c.monstro} nasce`);
  }
  assert.ok(comAlvo >= 30, `${comAlvo} fases com alvo`);
});

test('Ponte Quebrada: o Kraityn nasce no fundo da área, conta como objetivo, e matá-lo conclui a fase', { skip: SEM }, () => {
  const huntId = 'poe-a2-the-broken-bridge';
  const e = naFase(huntId);
  const kraityn = bichos(e).find((m) => Campanha.ehOMonstro(m.key, 'Kraityn,_Scarbearer'));
  assert.ok(kraityn, 'nasceu');
  assert.equal(kraityn.objetivo, 1, 'conta na limpeza');
  assert.equal(kraityn.instancia, e.hunt.instancia.id);
  assert.equal(Campanha.faseCompleta(e, 'facil', huntId), false);
  // O mais longe da entrada (o fundo da área): pelo menos tão longe quanto a metade dos outros.
  const d = (m) => Math.max(Math.abs(m.x - e.hunt.pos.x), Math.abs(m.y - e.hunt.pos.y));
  const outros = bichos(e).filter((m) => m !== kraityn).map(d).sort((a, b) => a - b);
  assert.ok(d(kraityn) >= outros[Math.floor(outros.length / 2)], 'no fundo da área');
  Combate.matarMonstro(e, e.hunt, PERSONAGEM, kraityn, []);
  assert.equal(Campanha.faseCompleta(e, 'facil', huntId), true, 'matar o Kraityn conclui');
});

test('Lago Seco: o Voll nasce, solta o item da missão e a fase conclui', { skip: SEM }, () => {
  const huntId = 'poe-a4-the-dried-lake';
  const c = Campanha.conclusaoDa(huntId);
  assert.equal(c.tipo, 'item-de-missao');
  const e = naFase(huntId);
  const voll = bichos(e).find((m) => Campanha.ehOMonstro(m.key, c.monstro));
  assert.ok(voll, 'nasceu');
  Combate.matarMonstro(e, e.hunt, PERSONAGEM, voll, []);
  assert.equal(Campanha.faseCompleta(e, 'facil', huntId), true);
  assert.ok([...(e.pouch ?? []), ...(e.inventory ?? [])].some((p) => Number(p.id) === Number(c.item)), 'o item da missão veio');
});

test('Telhado da Catedral: o Kitava (o chefe do Ato 5) nasce na fase; matá-lo conclui a fase e vence o ato — o Ato 6 abre, sem a sala', { skip: SEM }, () => {
  const huntId = 'poe-a5-the-cathedral-rooftop';
  const c = Campanha.conclusaoDa(huntId);
  assert.equal(c.tipo, 'matar-chefe', 'continua "Matar o chefe" (dono, 08/10: "mantenha matar o chefe")');
  assert.equal(Campanha.atoDoChefeNaFase(huntId), 5);
  assert.equal(Campanha.atoDoChefeNaFase('poe-a2-the-broken-bridge'), null, 'o Kraityn não é chefe de ato');
  // Os atos 1 a 4 vencidos e o Ato 5 feito até o Telhado.
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.sistema = 'poe';
  e.campanha = { facil: { completas: Campanha.FASES.filter((f) => f.ato <= 5 && f.huntId !== huntId).map((f) => f.huntId), bosses: [1, 2, 3, 4] } };
  Bolsa.garantir(e);
  assert.ok(Cacadas.entrar(e, { huntId, mode: 'auto', strategy: 'nearest', dificuldade: 'facil' }).ok);
  const kitava = bichos(e).find((m) => Campanha.ehOMonstro(m.key, c.monstro));
  assert.ok(kitava, 'o Kitava nasce no Telhado');
  const primeiraDoAto6 = Campanha.FASES.find((f) => f.ato === 6);
  assert.equal(Campanha.faseLiberada(e, 'facil', primeiraDoAto6.huntId), false, 'antes: o Ato 6 fechado');
  Combate.matarMonstro(e, e.hunt, PERSONAGEM, kitava, []);
  assert.equal(Campanha.faseCompleta(e, 'facil', huntId), true, 'a fase conclui');
  assert.equal(Campanha.bossVencido(e, 'facil', 5), true, 'e o chefe do Ato 5 conta como vencido');
  assert.equal(Campanha.faseLiberada(e, 'facil', primeiraDoAto6.huntId), true, 'o Ato 6 abre');
  assert.match(e.avisoDaHunt ?? '', /concluíd/);
  assert.equal(Campanha.abrirPortalDoBoss(e.hunt, [e]), null, 'o portal da sala do chefe não abre (ele já foi enfrentado)');
});
