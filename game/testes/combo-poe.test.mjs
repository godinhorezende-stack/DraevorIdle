// A ORDEM das habilidades na barra do PoE (dono, 07/10: "a rotação, o limite e a prioridade têm de funcionar com várias skills"):
// no modo PoE os slots são todos 'skill'; as habilidades de ATAQUE da barra formam a fileira do combo (com os modos) e as de suporte
// (aura, arauto, lacaio...) ficam no sustento.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const R = await import('../systems/skills/reforcos.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Combo = await import('../systems/combo.mjs');
if (!SEM) {
  (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
  await G.iniciar({ registrarGema: (g) => (Acoes.registrarAcao(g.entry), GS.registrarAtiva(g)), registrarReforco: R.registrar });
}

const ATAQUES = ['Fireball', 'Freezing_Pulse', 'Spark'];
async function montar(modo, limite = null) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const Cacadas = await import('../systems/cacadas.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const Afixos = await import('../systems/afixos.mjs');
  const { personagemDeTeste } = await import('./apoio.mjs');
  (await import('../systems/itens-poe/campanha.mjs')).iniciar();
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 40 });
  e.classePoe = 'Witch';
  const slugs = [...ATAQUES, 'Clarity'];
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: slugs.length, links: slugs.slice(1).map(() => false), gemas: slugs.map(() => null), cores: slugs.map(() => 'W') };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 10, xp: 0, raridade: 'comum' }));
  slugs.forEach((_, i) => GS.encaixar(e, { de: 0, slot: 'weapon', indice: i }));
  Ficha.invalidar(e); Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  // A aura no slot 1 (o sustento), os três ataques depois.
  e.actions[0] = { id: G.doSlug('Clarity').acao, enabled: true, minMana: 0, conditions: [] };
  ATAQUES.forEach((s, i) => (e.actions[i + 1] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  if (modo) assert.ok(Combo.definirModo(e, { modo, limite }).ok);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  return { e, Cacadas };
}
async function rodar(modo, limite = null, segundos = 40) {
  const { e, Cacadas } = await montar(modo, limite);
  const { PERSONAGEM } = await import('./apoio.mjs');
  const nomes = new Map(ATAQUES.map((s) => [G.doSlug(s).acao, s]));
  const saidas = [];
  Combo.ouvirCombo((l) => l.resultado === 'EXECUTADA' && saidas.push(nomes.get(l.skill) ?? l.skill));
  let t = Date.now();
  try {
    for (let i = 0; i < (segundos * 1000) / 250 && e.hunt; i++) {
      const h = e.hunt;
      if (!h.monstros?.length) break;
      h.monstros = h.monstros.slice(0, 1);
      Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 2, y: h.pos.y });
      h.alvo = h.monstros[0].uid;
      e.hp = e.maxHp; e.mana = 1e6; e.maxMana = 1e6;
      Cacadas.tique(e, PERSONAGEM, (t += 250));
    }
  } finally {
    Combo.ouvirCombo(null);
  }
  return saidas;
}

test('a fileira do combo no PoE são os slots com habilidade de ataque (a aura fica no sustento)', { skip: SEM }, async () => {
  const { e } = await montar(null);
  assert.deepEqual(Combo.slotsDoCombo(e), [1, 2, 3]);
  assert.equal(Combo.ehDoCombo(e, 0), false, 'Clareza: sustento');
});

test('Prioridade: a do primeiro slot de ataque sai sempre que pode', { skip: SEM }, async () => {
  const s = await rodar('prioridade');
  assert.ok(s.length > 10, `${s.length} execuções`);
  assert.ok(s.filter((x) => x === 'Fireball').length / s.length > 0.9, s.join(','));
});

test('Rotação: as três se revezam, uma vez cada, na ordem da barra', { skip: SEM }, async () => {
  const s = await rodar('rotacao');
  assert.ok(s.length > 10, `${s.length} execuções`);
  for (let i = 0; i + 2 < s.length; i += 3) assert.deepEqual(new Set(s.slice(i, i + 3)).size, 3, s.join(','));
  assert.deepEqual(s.slice(0, 3), ATAQUES);
});

test('Limite 2: numa volta de 3, a de cima sai 2 vezes e as outras se revezam nas brechas', { skip: SEM }, async () => {
  const s = await rodar('limite', 2);
  assert.ok(s.length > 10, `${s.length} execuções`);
  for (let i = 0; i + 3 <= s.length; i++) {
    const janela = s.slice(i, i + 3);
    assert.ok(janela.filter((x) => x === 'Fireball').length <= 2, `janela ${janela}`);
  }
  assert.ok(s.includes('Freezing_Pulse') && s.includes('Spark'), s.join(','));
  const fb = s.filter((x) => x === 'Fireball').length / s.length;
  assert.ok(fb > 0.5 && fb < 0.75, `Fireball ${fb}`);
});

test('a barra grande do alto da tela também no CHEFE de uma caçada comum (o único do PoE): no alvo ou o mais perto, até 10 casas', { skip: SEM }, async () => {
  const { e, Cacadas } = await montar(null);
  const h = e.hunt;
  h.monstros = h.monstros.slice(0, 2);
  const [chefe, comum] = h.monstros;
  Object.assign(chefe, { key: 'poe-hillock-1', name: 'Hillock', hp: 500, maxHp: 1000, x: h.pos.x + 30, y: h.pos.y });
  Object.assign(comum, { x: h.pos.x + 1, y: h.pos.y });
  h.alvo = comum.uid;
  assert.equal(Cacadas.snapshotDaHunt(e).boss, null, 'chefe longe e fora do alvo: sem barra');
  chefe.x = h.pos.x + 5;
  const barra = Cacadas.snapshotDaHunt(e).boss;
  assert.deepEqual([barra?.name, barra?.hp, barra?.maxHp], ['Hillock', 500, 1000]);
  chefe.hp = 0;
  assert.equal(Cacadas.snapshotDaHunt(e).boss, null, 'morto: some');
});

test('o interruptor Automático (modo PoE): troca o controle sem sair da caçada; andar com a mão desliga; sem bônus no manual', { skip: SEM }, async () => {
  const { e, Cacadas } = await montar(null);
  const Combate = await import('../systems/hunt/combate.mjs');
  assert.equal(e.hunt.modo, 'auto', '"Entrar" começa no automático');
  assert.equal(Cacadas.definirAutomatico(e, { on: false }).ok, true);
  assert.equal(Cacadas.snapshotDaHunt(e).manual, true);
  assert.equal(Combate.fatorDaCacaOnline(e.hunt), 1, 'sem os +15% no manual');
  Cacadas.definirAutomatico(e, { on: true });
  assert.equal(e.hunt.modo, 'auto');
  // Andar com a tecla no automático: assume o controle.
  Cacadas.andar(e, { dx: 1, dy: 0 });
  assert.equal(e.hunt.modo, 'online');
  Cacadas.definirAutomatico(e, { on: true });
  Cacadas.andarAte(e, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y });
  assert.equal(e.hunt.modo, 'online', 'o clique no chão também');
  assert.equal(Cacadas.definirAutomatico({}, { on: true }).ok, false, 'fora da caçada: nada');
});

test('a barra grande NÃO aparece no monstro que só sorteou a raridade Único (só boss e chefe da fase)', { skip: SEM }, async () => {
  const { e, Cacadas } = await montar(null);
  const h = e.hunt;
  h.monstros = h.monstros.slice(0, 1);
  Object.assign(h.monstros[0], { raridade: 'unico', hp: 500, maxHp: 1000, x: h.pos.x + 1, y: h.pos.y });
  h.alvo = h.monstros[0].uid;
  assert.equal(Cacadas.snapshotDaHunt(e).boss, null);
  h.monstros[0].raridade = 'boss';
  assert.ok(Cacadas.snapshotDaHunt(e).boss, 'o boss continua com a barra');
});

test('manual sem o Ataque automático: o golpe básico bate no alvo CLICADO; sem clique, não escolhe nenhum; tirar o alvo para', { skip: SEM }, async () => {
  const { e, Cacadas } = await montar(null);
  const { PERSONAGEM } = await import('./apoio.mjs');
  e.actions = Array(e.actions.length).fill(null); // só o golpe básico
  Cacadas.definirAutomatico(e, { on: false });
  Cacadas.definirAssistencia(e, { tipo: 'ataque', on: false });
  const h = e.hunt;
  h.monstros = h.monstros.slice(0, 1);
  const bicho = h.monstros[0];
  const rodar = () => {
    let t = Date.now();
    const ev = [];
    for (let i = 0; i < 16; i++) {
      Object.assign(bicho, { hp: 1e9, maxHp: 1e9, x: h.pos.x + 1, y: h.pos.y });
      e.hp = e.maxHp;
      ev.push(...(Cacadas.tique(e, PERSONAGEM, (t += 250)) ?? []));
    }
    return ev.filter((x) => x.t === 'dmg' && x.uid === bicho.uid).length;
  };
  h.alvo = null;
  assert.equal(rodar(), 0, 'sem clique: não ataca nem escolhe alvo');
  assert.equal(Cacadas.snapshotDaHunt(e).targetUid, null);
  assert.ok(Cacadas.definirAlvo(e, { uid: bicho.uid }).ok);
  assert.ok(rodar() > 0, 'clicou: o golpe básico bate');
  assert.equal(Cacadas.snapshotDaHunt(e).alvoClicado, bicho.uid);
  Cacadas.definirAlvo(e, { uid: null });
  assert.equal(rodar(), 0, 'tirou o alvo: para');
});
