// (07/11, lote 14 das inertes — dono: "Seguir as influências e a recarga") as ALMAS VAAL na recarga das Vaal (a Forja do Ódio, o Pastor das Almas, o Corpo e Espírito,
// a Prevenção do Ganho de Almas reduzida), as RESTRIÇÕES de equipamento (o Portador da Chuva, o Tormento do Ladrão), o Toque de Kalandra e as habilidades "quando Equipado"
// que andam com você (o Passo da Morte, o Andarilho Cadavérico).
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
const Afixos = await import('../systems/afixos.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Condicoes = await import('../systems/itens-poe/condicoes-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const Inventario = await import('../systems/inventario.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
const anel = (af) => ({ id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id), count: 1, af: [], poe: { af } });

/** A Bruxa com a Bola de Fogo Vaal na varinha (nível 10: 30 Almas, 6 s de recarga), na Costa, com um alvo ao lado; `af` no anel. */
function comVaal(af) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 60 }), { classePoe: 'Witch' });
  const arma = peca('Wands/Driftwood_Wand');
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma, ring: anel(af) };
  e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug('Vaal_Fireball').itemId, nivel: 10, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GemasPoe.doSlug('Vaal_Fireball').acao, enabled: true, minMana: 0, conditions: [] };
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  Object.assign(e, { mana: 1e6, maxMana: 1e6 });
  const h = e.hunt;
  h.clock = 100_000;
  h.monstros = h.monstros.filter((m) => !m.dummy).slice(0, 1);
  Object.assign(h.monstros[0], { x: h.pos.x + 1, y: h.pos.y, hp: 1e12, maxHp: 1e12 });
  ModsPoe.definirFichaDaCacada(h, () => Ficha.combate(e));
  const usar = () => {
    const r = Acoes.disparar(e, h, PERSONAGEM, 0, h.monstros[0], { manual: true });
    assert.equal(r.ok, true, r.erro);
    if (h.conjurando) { h.clock = h.conjurando.fim; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
  };
  return { e, h, usar, id: e.actions[0].id };
}

test('as linhas do lote saem com efeito (não inertes)', { skip: SEM }, () => {
  for (const [m, v] of [
    ['Custo de Fúria de Habilidades reduzido em {0}%', [15]],
    ['Habilidades de Ataque Vaal que você Usar manualmente Custam Fúria ao invés de exigirem Almas'],
    ['Você não pode ganhar Fúria durante a Anulação do Ganho de Almas'],
    ['Pastor das Almas'],
    ['Duração da Prevenção do Ganho de Almas reduzida em {0}%', [30]],
    ['Matar concede uma Alma Vaal adicional caso você tenha se Enfurecido Recentemente'],
    ['Não Pode utilizar Peitoral'],
    ['Não Pode usar outros Anéis'],
    ['Reflete o anel aposto'],
    ['Gemas Encaixadas são Suportadas por Furor Nível {0}', [30]],
    ['Concede a Habilidade Convocar Golem de Pedra Nível {0}', [12]],
    ['Ativa o Passo da Morte nível {0} quando Equipada', [20]],
    ['Ativa Andarilho Cadavérico Nível {0} quando Equipado', [20]],
  ]) {
    const r = tr(m, v ?? []);
    assert.ok(!['inerte', 'registrado'].includes(r.estado), `${m}: ${r.estado} ${r.nota ?? ''}`);
  }
  assert.deepEqual(tr('Duração da Prevenção do Ganho de Almas reduzida em {0}%', [30]).efeitos, [{ stat: 'impedimento_almas_duracao_inc', valor: -30 }]);
});

test('o PASTOR DAS ALMAS: a recarga da Vaal × 0,2 (6 s → 1,2 s) e × (1 + as Vaal usadas nos últimos 8 s)', { skip: SEM }, () => {
  const sem = comVaal({});
  sem.usar();
  assert.equal(sem.h.cooldowns[sem.id].total, 6000);
  const { h, usar, id } = comVaal({ pastor_das_almas: 1 });
  usar();
  assert.equal(h.cooldowns[id].total, 1200);
  h.clock = Math.max(h.clock, h.cooldowns[id].ate, h.cooldowns[Acoes.GRUPO_DO_POE]?.ate ?? 0) + 1;
  usar();
  assert.equal(h.cooldowns[id].total, 2400, 'a segunda Vaal em 8 s custa o dobro');
});

test('a PREVENÇÃO DO GANHO DE ALMAS reduzida (o Acordo de Yaomac): o impedimento da Vaal usada encurta', { skip: SEM }, () => {
  const sem = comVaal({});
  sem.usar();
  const com = comVaal({ impedimento_almas_duracao_inc: -50 });
  com.usar();
  const ms = (x) => x.h.poeAlmasImpedidasAte - 100_000;
  assert.ok(ms(sem) > 0);
  assert.ok(Math.abs(ms(com) - ms(sem) / 2) <= Math.max(50, ms(sem) * 0.05), `${ms(com)} × ${ms(sem)}`);
});

test('o CORPO E ESPÍRITO: Matar, Enfurecido nos últimos 4 s, anda uma alma da recarga (6 s ÷ 30 = 0,2 s); sem Enfurecer, não', { skip: SEM }, () => {
  const linha = tr('Matar concede uma Alma Vaal adicional caso você tenha se Enfurecido Recentemente').efeitos[0];
  const { e, h, usar, id } = comVaal({ [linha.stat]: Number(linha.valor) });
  usar();
  delete h.poeAlmasImpedidasAte;
  const antes = h.cooldowns[id].ate;
  ModsPoe.evento(e, h, 'matar', Ficha.combate(e), { alvo: { uid: 'y', hp: 0, estados: {} }, rng: () => 0 });
  assert.equal(h.cooldowns[id].ate, antes, 'sem Enfurecer');
  Condicoes.marcar(h, 'enfureceu', h.clock);
  ModsPoe.evento(e, h, 'matar', Ficha.combate(e), { alvo: { uid: 'z', hp: 0, estados: {} }, rng: () => 0 });
  assert.equal(h.cooldowns[id].ate, antes - 200);
});

test('a FORJA DO ÓDIO: sem ganhar Fúria durante a Anulação do Ganho de Almas; o ataque Vaal à mão com Fúria bastante a gasta e não entra em recarga', { skip: SEM }, () => {
  const { e, h, usar, id } = comVaal({ sem_furia_no_impedimento: 1 });
  usar();
  assert.ok(h.poeAlmasImpedidasAte > h.clock);
  Condicoes.ganharFuria(h, 5, h.clock);
  assert.equal(h.furia?.n ?? 0, 0, 'no impedimento, sem Fúria');
  h.clock = h.poeAlmasImpedidasAte + 1;
  Condicoes.ganharFuria(h, 5, h.clock);
  assert.equal(h.furia.n, 5);
  // (a Bola de Fogo Vaal é magia: a Forja vale só nos ataques Vaal — ela segue entrando em recarga)
  const f = comVaal({ vaal_ataque_custa_furia: 1 });
  f.h.furia = { n: 30, ganhou: f.h.clock, perdeu: f.h.clock };
  f.usar();
  assert.equal(f.h.furia.n, 30);
  assert.equal(f.h.cooldowns[f.id].total, 6000);
  assert.ok(e && id);
});

test('as RESTRIÇÕES de equipamento: o Portador da Chuva tira o Peitoral; o Tormento do Ladrão, o outro anel (nos dois sentidos)', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  const semPeitoral = { poe: { af: { sem_peitoral: 1 } } };
  const peitoral = { poe: { af: {} } };
  e.equipment = { ...e.equipment, body: null, boots: semPeitoral, ring: null, ring2: null };
  assert.match(Inventario.restricaoDoPoe(e, peitoral, 'body') ?? '', /Peitoral/);
  e.equipment.boots = null;
  e.equipment.body = peitoral;
  assert.match(Inventario.restricaoDoPoe(e, semPeitoral, 'boots') ?? '', /Peitoral/);
  e.equipment.body = null;
  assert.equal(Inventario.restricaoDoPoe(e, semPeitoral, 'boots'), null);
  const ladrao = { poe: { af: { so_este_anel: 1 } } };
  e.equipment.ring = ladrao;
  assert.match(Inventario.restricaoDoPoe(e, anel({}), 'ring2') ?? '', /anel/);
  e.equipment.ring = anel({});
  assert.match(Inventario.restricaoDoPoe(e, ladrao, 'ring2') ?? '', /anel/);
  assert.equal(Inventario.restricaoDoPoe(e, ladrao, 'ring'), null, 'no lugar do mesmo anel, pode');
});

test('o TOQUE DE KALANDRA: os atributos do anel do outro lado contam de novo; dois Kalandras não se refletem', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.sistema = 'poe';
  const caos = () => { Ficha.invalidar(e); return Afixos.soma(e).chaos_res ?? 0; };
  e.equipment = { ...e.equipment, ring: anel({}), ring2: anel({ chaos_res: 20 }) };
  const so = caos();
  e.equipment.ring = anel({ reflete_anel: 1 });
  assert.equal(caos(), so + 20, 'o anel do outro lado conta duas vezes');
  e.equipment.ring2 = anel({ reflete_anel: 1 });
  assert.equal(caos(), so - 20, 'dois Kalandras: nada a refletir');
});

test('o PASSO DA MORTE (andando, o cadáver a 1 casa explode) e o ANDARILHO CADAVÉRICO (andando, deixa um cadáver, até 10)', { skip: SEM }, () => {
  const { e, h } = comVaal({ 'concede:passo-da-morte': 20, 'concede:andarilho-cadaverico': 20 });
  const ficha = () => { Ficha.invalidar(e); return Ficha.combate(e); };
  ModsPoe.tiqueDosAspectos(e, h, ficha(), h.clock);
  assert.equal((h.cadaveres ?? []).length, 0, 'parado, nada');
  for (let i = 1; i <= 12; i++) {
    h.pos = { x: h.pos.x + (i % 2 ? 2 : -2), y: h.pos.y };
    h.clock += 300;
    ModsPoe.tiqueDosAspectos(e, h, ficha(), h.clock);
  }
  const meus = (h.cadaveres ?? []).filter((c) => c.criadoPor === 'Corpse_Walk');
  assert.ok(meus.length > 0 && meus.length <= 10, String(meus.length));
  const alvo = h.monstros[0];
  alvo.hp = alvo.maxHp = 1e6;
  h.cadaveres = [{ key: 'corpo', nome: 'Cadáver', x: h.pos.x + 2, y: h.pos.y, z: h.z ?? 0, maxHp: 10_000 }];
  Object.assign(alvo, { x: h.pos.x + 2, y: h.pos.y + 1 });
  h.pos = { x: h.pos.x + 1, y: h.pos.y };
  h.clock += 300;
  ModsPoe.tiqueDosAspectos(e, h, ficha(), h.clock);
  assert.ok(!h.cadaveres.some((c) => c.maxHp === 10_000), 'o cadáver ao lado explodiu');
  assert.ok(alvo.hp < 1e6, 'e feriu o monstro perto dele');
});
