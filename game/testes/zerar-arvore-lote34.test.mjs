// ZERAR A ÁRVORE — LOTE 34 (dono, 16/10: "ok, siga"; a auditoria em docs/arvore-poe-auditoria.md): P008 a Velocidade dos Clamores (o tempo
// de uso do Clamor encurta por ela, e a Velocidade de Conjuração não vale nele — o Clamor não é ataque nem magia); P010/P011 a aura da Mina
// PLANTADA (cada Mina soma nos inimigos a até 35 unidades, 3,5 m, até o teto; o "Efeito de Auras das Minas" aumenta a de cada uma, não o teto;
// o "reduzido" é o dano que o inimigo CAUSA); P023 "por cada Mina Detonada Recentemente, até 100%/40%" pela detonação de verdade; e a ficha
// refeita quando essas contagens mudam.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
function personagem(af = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  const arma = peca('One_Hand_Axes/Rusted_Hatchet');
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  delete e.equipment.shield;
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  P.garantir(e);
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const traduzir = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const bicho = (x, extra = {}) => ({ uid: `b${x}`, x, y: 0, hp: 1e6, maxHp: 1e6, estados: {}, ...extra });

test('as linhas do lote 34 com efeito', { skip: SEM }, () => {
  const linhas = [
    ['Velocidade dos Clamores aumentada em {0}%', [15], 'velocidade_clamor'],
    ['Cada Mina aplica Dano sofrido aumentado em {0}% aos Inimigos próximos a ela, até {1}%', [2, 10], 'mina_fragiliza:10'],
    ['Cada Mina aplica Dano sofrido reduzido em {0}% aos Inimigos próximos a ela, até {1}%', [2, 10], 'mina_enfraquece:10'],
    ['Chance de Golpe Crítico aumentada em {0}% por cada Mina Detonada', [10], 'crit_chance_inc%usos:minaDetonada:4:10'],
    ['+{0}% de Multiplicador de Golpes Críticos para cada Mina Detonada', [4], 'crit_dmg%usos:minaDetonada:4:10'],
  ];
  for (const [modelo, v, stat] of linhas) {
    const t = traduzir(modelo, v);
    assert.equal(t.estado, 'novo', modelo);
    assert.equal(t.efeitos[0].stat, stat, modelo);
  }
});

test('P008 — a Velocidade dos Clamores encurta o tempo de uso do Clamor; a Velocidade de Conjuração não vale nele (nem a "com Clamores")', { skip: SEM }, () => {
  const gema = GemasPoe.doSlug('Enduring_Cry');
  if (!gema) return; // (sem a coleção de gemas nesta máquina)
  const entry = Acoes.POR_ID_PUBLICO(gema.acao);
  const uso = (af) => { const e = personagem(af); return Acoes.temposDaGemaPoe(e, entry, { nivel: 10 }, ficha(e), { doJogador: false }).conjuracaoMs; };
  const base = uso({});
  // (17/10, lote G2 — o dono: "Corrigir e ajustar o P008") os 0,8 s da gema ÷ (1 + a "Velocidade de Clamor aumentada em X%" DA GEMA — 18% no
  // nível 10; antes o compilador a lia como recuperação da recarga)
  const t = GemasPoe.temposNoNivel('Enduring_Cry', 10);
  assert.equal(t.velClamor, 18);
  assert.equal(base, Math.round(t.conjuracaoMs / (1 + t.velClamor / 100)), 'os 0,8 s da gema ÷ 1,18');
  assert.equal(uso({ cast_speed: 100 }), base, 'a conjuração não acelera o Clamor');
  assert.equal(uso({ velocidade_clamor: 100 }), Math.round(t.conjuracaoMs / (1 + (100 + t.velClamor) / 100)), '+100% de Velocidade dos Clamores soma com os 18% da gema');
  // (uma magia continua pela conjuração)
  const magia = GemasPoe.doSlug('Fireball');
  if (magia) {
    const m = Acoes.POR_ID_PUBLICO(magia.acao);
    const t = (af) => { const e = personagem(af); return Acoes.temposDaGemaPoe(e, m, { nivel: 10 }, ficha(e), { doJogador: false }).conjuracaoMs; };
    assert.ok(t({ cast_speed: 100 }) < t({}));
    assert.equal(t({ velocidade_clamor: 100 }), t({}));
  }
});

test('P010/P011 — a aura da Mina PLANTADA: cada uma soma nos inimigos a até 35 unidades (1 casa), até o teto; o efeito de aura aumenta a de cada Mina', { skip: SEM }, () => {
  const e = personagem({ 'mina_fragiliza:10': 2, 'mina_enfraquece:10': 2 });
  const h = e.hunt;
  const perto = bicho(1);
  const longe = bicho(2);
  h.monstros = [perto, longe];
  const plantar = (x) => Plantadas.plantar(h, ficha(e), { tipo: 'mina', acao: 'x', slot: 0, x, y: 0, duracaoMs: 5000, agora: h.clock });
  plantar(0);
  ModsPoe.auraDasMinas(h, ficha(e));
  assert.equal(perto.estados.minaFragil.pct, 2, 'a 1 casa (20 unidades)');
  assert.equal(longe.estados.minaFragil, undefined, 'a 2 casas (40 unidades): fora');
  assert.equal(perto.estados.minaFraco.pct, 2);
  plantar(0);
  ModsPoe.auraDasMinas(h, ficha(e));
  assert.equal(perto.estados.minaFragil.pct, 4, 'duas Minas');
  // o dano que o inimigo causa e o que ele sofre
  assert.ok(Math.abs(C.doBicho(perto, h.clock).danoFator - 0.96) < 1e-9);
  assert.ok(Math.abs(C.fatorRecebidoPeloBicho(perto, 'physical', { afPoe: {} }, h.clock) - 1.04) < 1e-9);
  // o "Efeito de Auras das Minas": 2 × 1,5 por Mina; com 5 Minas, 15 — no teto de 10
  const a = personagem({ 'mina_fragiliza:10': 2, efeito_aura_mina: 50 });
  const alvo = bicho(1);
  a.hunt.monstros = [alvo];
  for (let i = 0; i < 5; i++) Plantadas.plantar(a.hunt, ficha(a), { tipo: 'mina', acao: 'x', slot: 0, x: 0, y: 0, duracaoMs: 5000, agora: a.hunt.clock });
  ModsPoe.auraDasMinas(a.hunt, ficha(a));
  assert.equal(alvo.estados.minaFragil.pct, 10);
  a.hunt.plantadas = a.hunt.plantadas.slice(0, 1);
  ModsPoe.auraDasMinas(a.hunt, ficha(a));
  assert.equal(alvo.estados.minaFragil.pct, 3);
  // sem Mina plantada, a aura acaba com o tique
  a.hunt.plantadas = [];
  a.hunt.clock += 1000;
  ModsPoe.auraDasMinas(a.hunt, ficha(a));
  assert.equal(C.ativo(alvo.estados.minaFragil, a.hunt.clock), false);
});

test('P023 — "por cada Mina Detonada Recentemente, até 100%" (e "até 40%"): a detonação conta, nos últimos 4 s, até 10 Minas; a ficha é refeita', { skip: SEM }, () => {
  const e = personagem({ 'crit_chance_inc%usos:minaDetonada:4:10': 10 });
  const h = e.hunt;
  const t0 = h.clock;
  for (let i = 0; i < 3; i++) C.marcarMinaDetonada(h, t0);
  assert.equal(C.fatorDaEscala(e, ficha(e).afPoe, null, 'usos:minaDetonada:4:10'), 3);
  for (let i = 0; i < 12; i++) C.marcarMinaDetonada(h, t0);
  assert.equal(C.fatorDaEscala(e, ficha(e).afPoe, null, 'usos:minaDetonada:4:10'), 10, 'até 10 (os 100%)');
  h.clock = t0 + 4500;
  assert.equal(C.fatorDaEscala(e, ficha(e).afPoe, null, 'usos:minaDetonada:4:10'), 0, 'mais de 4 s');
  // a ficha é refeita quando a contagem muda (a escala está na ficha)
  h.clock = t0 + 20000;
  C.tique(e, h, ficha(e), 250);
  C.tique(e, h, ficha(e), 250);
  delete h.poeFichaMudou;
  C.tique(e, h, ficha(e), 250);
  assert.equal(h.poeFichaMudou, undefined, 'nada mudou');
  C.marcarMinaDetonada(h, h.clock);
  C.tique(e, h, ficha(e), 250);
  assert.equal(h.poeFichaMudou, true, 'uma Mina detonou');
});
