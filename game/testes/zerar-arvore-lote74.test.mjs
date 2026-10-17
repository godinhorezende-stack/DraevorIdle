// LOTE 74 — a gema CONVOCAR RUNAS (Brand Recall do PoE — dono, 17/10: "Implementar a gema") e o notável Reduzir das Ramificadoras: 3 → 1 sem
// efeito. A gema traz as suas Runas até você, soltas, com o Alcance de Vínculo dela (25–45% pelo nível) até se vincularem de novo, e Ativa as
// vinculadas pagando 20% do custo de cada uma (a wiki do PoE, 3.11); a duração não se renova; o automático não a gasta sem Runa. O Reduzir:
// +20% de alcance às convocadas e +4% de Recuperação da Recarga por Runa em campo, até 40%.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const A = await import('../systems/itens-poe/arvore.mjs');
const Runas = await import('../systems/itens-poe/runas-vinculadas.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) J.iniciar(ITEM_CATALOG);

const efeitos = (linha) => Object.fromEntries(A.traduzirLinha(linha).efeitos.map((e) => [e.add, e.valor]));
const anel = (af) => ({ id: 3357, count: 1, poe: { classe: 'Rings', base: 'Rings/X', af, prefixos: [], sufixos: [], implicitos: [] } });
/** Uma Bruxa do PoE com a Runa Tempestuosa (barra 0) e a Convocar Runas (barra 1), um anel com `af`, numa caçada do PoE. */
function bruxa(af = {}) {
  const gemas = ['Storm_Brand', 'Brand_Recall'];
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 60 }), { sistema: 'poe', classePoe: 'Witch' });
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: 2, links: [false], gemas: [null, null], cores: ['W', 'W'] };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma, ring: anel(af) };
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 1, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < 2; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  gemas.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  return e;
}
/** Os bichos da caçada: os primeiros nas casas dadas (com muita vida), os outros longe. */
function bichosEm(e, ...casas) {
  e.hunt.monstros.forEach((b, i) => {
    if (i < casas.length) Object.assign(b, { x: e.hunt.pos.x + casas[i][0], y: e.hunt.pos.y + casas[i][1], hp: 1e9, maxHp: 1e9 });
    else Object.assign(b, { x: e.hunt.pos.x + 80, y: e.hunt.pos.y + 80 });
  });
  return e.hunt.monstros.slice(0, casas.length);
}
function usar(e, slot, alvo, manual = true) {
  e.hunt.clock += 10_000;
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo, { manual });
  if (!r.ok || !r.conjurando) return r;
  e.hunt.clock += 3000;
  return { ok: true, eventos: Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) };
}
const danoEm = (eventos, b) => (eventos ?? []).filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + x.v, 0);

test('as linhas do Reduzir', { skip: SEM }, () => {
  assert.deepEqual(efeitos('Convocação de Runas concede alcance do Vínculo de Runas aumentado em 20% para Runas convocadas'), { convocar_runas_alcance: 20 });
  const t = A.traduzirLinha('Convocação de Runas tem Recuperação da Recarga aumentada em 4%, máximo de 40%');
  assert.deepEqual(Object.fromEntries(t.efeitos.map((e) => [e.add, e.valor])), { convocar_runas_recarga_por_runa: 4, convocar_runas_recarga_max: 40 });
  assert.match(t.nota, /por Runa/);
});

test('a CONVOCAR RUNAS: a Runa vem até você, solta, com o alcance da gema; a vinculada é Ativada pagando 20% do custo; a duração não se renova', { skip: SEM }, () => {
  const e = bruxa();
  const [b] = bichosEm(e, [2, 0]);
  assert.ok(usar(e, 0, b).ok);
  const [r] = Runas.ativas(e.hunt);
  assert.equal(r.alvo, b.uid);
  assert.ok(r.custo > 0, 'a Runa guarda o custo pago');
  const passou = r.vinculadaPassou;
  const mana = e.mana;
  const res = usar(e, 1, null);
  assert.ok(res.ok, res.erro);
  assert.ok(danoEm(res.eventos, b) > 0, 'a Runa vinculada foi Ativada');
  assert.equal(Runas.ativas(e.hunt).length, 1, 'a gema não cria Runa');
  assert.deepEqual([r.alvo, r.x, r.y], [null, e.hunt.pos.x, e.hunt.pos.y], 'veio até você, solta');
  assert.equal(r.convocadaPct, 25, 'o Alcance de Vínculo da gema no nível 1');
  assert.ok(e.mana <= mana - Math.round(r.custo * 0.2), 'pagou 20% do custo da Runa (e o da Convocar)');
  assert.equal(r.vinculadaPassou, passou, 'a duração não se renova');
});

test('a Convocar Runas sai em você: sem alvo, sem mira no chão, sem o papel de ataque', { skip: SEM }, () => {
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Brand_Recall').acao);
  assert.ok(!entry.miraNoChao && !entry.forma, 'sem a mira e sem a forma de área');
  assert.deepEqual(entry.papeis, ['suporte']);
  const e = bruxa();
  const [b] = bichosEm(e, [2, 0]);
  assert.ok(usar(e, 0, b).ok);
  // sem alvo, com o bicho a 8 casas (fora dos 7 do molde de área que ela tinha; a regra das magias de suporte — "algum bicho a até 8" — vale)
  Object.assign(b, { x: e.hunt.pos.x + 8, y: e.hunt.pos.y });
  const r = usar(e, 1, null);
  assert.ok(r.ok, r.erro);
  assert.deepEqual([Runas.ativas(e.hunt)[0].x, Runas.ativas(e.hunt)[0].y], [e.hunt.pos.x, e.hunt.pos.y]);
});

test('os 20% saem no RECURSO em que a Runa foi paga (Vida, Escudo de Energia, Mana com parte em Vida), depois da Ativação', { skip: SEM }, () => {
  const cobrado = (custo, extra = {}) => {
    const e = bruxa();
    const [b] = bichosEm(e, [2, 0]);
    Object.assign(e, { hp: 1000, maxHp: 1000, mana: 1000, maxMana: 1000, es: 1000 }, extra);
    const f = Ficha.combate(e);
    Runas.vincular(e.hunt, f, Runas.conjurar(e.hunt, f, { acao: e.actions[0].id, slot: 0, x: b.x, y: b.y, props: Runas.daGema([]), agora: e.hunt.clock, custo }), e.hunt.clock, { preferido: b });
    const antes = { hp: e.hp, mana: e.mana, es: e.es };
    const ev = Acoes.convocarRunas(e, e.hunt, PERSONAGEM, { nivel: 1 }, e.hunt.clock);
    return { hp: antes.hp - e.hp, mana: antes.mana - e.mana, es: antes.es - e.es, ativou: danoEm(ev, b) > 0 };
  };
  assert.deepEqual(cobrado({ valor: 100, em: 'mana' }), { hp: 0, mana: 20, es: 0, ativou: true });
  assert.deepEqual(cobrado({ valor: 100, em: 'vida' }), { hp: 20, mana: 0, es: 0, ativou: true }, 'a Magia Sanguínea: em Vida');
  assert.deepEqual(cobrado({ valor: 100, em: 'es' }), { hp: 0, mana: 0, es: 20, ativou: true });
  assert.deepEqual(cobrado({ valor: 100, em: 'mana', parteEmVidaPct: 50 }), { hp: 10, mana: 10, es: 0, ativou: true });
  assert.deepEqual(cobrado({ valor: 100, em: 'mana' }, { mana: 5 }), { hp: 0, mana: 0, es: 0, ativou: false }, 'sem a mana: não ativa, não cobra');
});

test('a Ativação pela Convocar Runas leva a Área tardia da Runa (como a do tique)', { skip: SEM }, () => {
  const ficha = { afPoe: { runa_area_tardia_pct: 50, runa_area_tardia_apos: 50 } };
  assert.equal(Runas.areaTardiaPct(ficha, { vinculadaPassou: 3000, vinculadaMs: 5000 }), 50);
  assert.equal(Runas.areaTardiaPct(ficha, { vinculadaPassou: 2000, vinculadaMs: 5000 }), 0);
  assert.equal(Runas.areaTardiaPct({ afPoe: {} }, { vinculadaPassou: 5000, vinculadaMs: 5000 }), 0);
});

test('a Runa CONVOCADA alcança mais até se vincular de novo; vinculada, o bônus sai', { skip: SEM }, () => {
  const ficha = { afPoe: {} };
  const r = { x: 0, y: 0, alvo: null, desde: 0, soltaDesde: 0 };
  const hunt = { monstros: [{ uid: 9, hp: 10, maxHp: 10, x: 4, y: 0 }], runas: [r] };
  assert.equal(Runas.vincular(hunt, ficha, r, 0), null, 'sem a convocação: 3 casas, o bicho a 4 não');
  Runas.convocar(r, { x: 0, y: 0 }, 0, 25);
  assert.equal(r.convocadaPct, 25);
  assert.equal(Runas.vincular(hunt, ficha, r, 0)?.uid, 9, 'convocada (+25%): 3 × 1,25 → 4 casas');
  assert.equal(r.convocadaPct, undefined, 'vinculada: o bônus sai');
});

test('o alcance da convocada com o Reduzir: a gema (25%) + os 20%', { skip: SEM }, () => {
  const e = bruxa({ convocar_runas_alcance: 20 });
  const [b] = bichosEm(e, [2, 0]);
  assert.ok(usar(e, 0, b).ok);
  const [r] = Runas.ativas(e.hunt);
  assert.ok(usar(e, 1, b).ok);
  assert.equal(r.convocadaPct, 45, '25 da gema + 20 do Reduzir');
});

test('o AUTOMÁTICO: sem Runa em campo, não gasta a Convocar Runas; com todas em campo, ela ainda sai (não é "Runas completas")', { skip: SEM }, () => {
  const e = bruxa();
  const [b, c, d] = bichosEm(e, [2, 0], [0, 2], [-2, 0]);
  const sem = usar(e, 1, b, false);
  assert.equal(sem.ok, false);
  assert.equal(sem.motivo, 'SEM_RUNAS');
  // as 3 Runas em campo, novas (o máximo — `Runas.cheias`)
  e.hunt.clock += 10_000;
  const f = Ficha.combate(e);
  for (const x of [b, c, d]) Runas.vincular(e.hunt, f, Runas.conjurar(e.hunt, f, { acao: e.actions[0].id, slot: 0, x: x.x, y: x.y, props: Runas.daGema([]), agora: e.hunt.clock }), e.hunt.clock, { preferido: x });
  assert.ok(Runas.cheias(e.hunt, f));
  const com = Acoes.disparar(e, e.hunt, PERSONAGEM, 1, b, { manual: false });
  assert.ok(com.ok, com.erro);
});

test('a RECARGA da Convocar Runas com o Reduzir: +4% de Recuperação por Runa em campo, até 40%', { skip: SEM }, () => {
  const e = bruxa({ convocar_runas_recarga_por_runa: 4, convocar_runas_recarga_max: 40 });
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Brand_Recall').acao);
  const recarga = () => Acoes.temposDaGemaPoe(e, entry, { nivel: 1 }, Ficha.combate(e)).recarga;
  const sem = recarga();
  e.hunt.runas = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(recarga(), Math.round(sem / 1.12), '3 Runas: +12%');
  e.hunt.runas = Array.from({ length: 15 }, (_, i) => ({ id: `r${i}` }));
  assert.equal(recarga(), Math.round(sem / 1.4), 'até 40%');
});

test('a gema Convocar Runas funciona no jogo (a auditoria das gemas)', { skip: SEM }, () => {
  assert.equal(G.doSlug('Brand_Recall').statusNoJogo, 'funciona');
});

test('o RELATÓRIO: os notáveis sem efeito caem para no máximo 1', { skip: SEM }, async () => {
  const { linhasDasRamificadoras } = await import('../tools/relatorio-arvore-poe.mjs');
  const { grupos } = await linhasDasRamificadoras(Catalogo.catalogo());
  assert.ok(grupos.notavel.sem <= 1, `${grupos.notavel.sem}`);
});
