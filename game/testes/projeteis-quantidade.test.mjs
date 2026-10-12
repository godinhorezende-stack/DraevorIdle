// A QUANTIDADE de projéteis das skills (dono, 11/10: "Skill configurada para disparar 12 projéteis… existe apenas 1 mob na área…
// apenas 1 projétil é disparado"). A causa estava no motor compartilhado (`skills/golpes-secundarios.resolver`): os projéteis adicionais
// só "existiam" se houvesse um bicho diferente para cada um (`maisPerto(…, alvosExtras)`), e a quantidade BASE da gema ("Dispara 15
// projéteis") nem era lida. Agora a emissão é o total — a base + os adicionais (gema, suportes, peças) — com ou sem bichos, cada projétil
// com a sua trajetória; quem acerta segue a regra de antes (um projétil por bicho; "em sequência", todos podem ir no alvo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as S from '../systems/skills/golpes-secundarios.mjs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const PROJETIL = ['spell', 'projectile', 'single', 'hit'];
const ORIGEM = { x: 50, y: 50 };
/** `n` bichos vivos em volta de quem lança, a até 3 casas (todos no alcance 7). */
const bichos = (n) => Array.from({ length: n }, (_, i) => ({ uid: `m${i}`, x: ORIGEM.x + 1 + (i % 3), y: ORIGEM.y - 1 + Math.floor(i / 3) % 7, hp: 100 }));
function resolver(efeito, n, extra = {}) {
  const vivos = bichos(n);
  const alvo = vivos[0] ?? null;
  return { vivos, alvo, ...S.resolver({ efeito, tags: PROJETIL, origem: ORIGEM, alvo, atingidos: alvo ? [alvo] : [], vivos, alcance: 7, ...extra }) };
}
const comBicho = (r) => r.emitidos.filter((p) => p.bicho);

test('skill de 12 projéteis: emite os 12 com 0, 1, 3, 12 e 15 bichos — sem depender dos alvos e sem duplicar', () => {
  const efeito = { projeteisBase: 12 };
  for (const n of [0, 1, 3, 12, 15]) {
    const r = resolver(efeito, n);
    assert.equal(r.emitidos.length, 12, `${n} bicho(s): 12 projéteis`);
    // Cada projétil sai de quem lança e tem a sua trajetória (os que erram vão até o alcance).
    assert.ok(r.emitidos.every((p) => p.de.x === ORIGEM.x && p.de.y === ORIGEM.y && Number.isFinite(p.para.x) && Number.isFinite(p.para.y)));
    // Quem acerta: um projétil por bicho (até 12), nenhum bicho com dois.
    const acertados = comBicho(r).map((p) => p.bicho.uid);
    assert.equal(acertados.length, Math.min(n, 12), `${n} bicho(s): os que acertam`);
    assert.equal(new Set(acertados).size, acertados.length, 'sem duplicar');
  }
  // 0 bichos: os 12 saem e erram (nenhum golpe).
  const vazio = resolver(efeito, 0);
  assert.equal(vazio.golpes.length, 0);
  assert.equal(new Set(vazio.emitidos.map((p) => `${p.para.x},${p.para.y}`)).size > 1, true, 'em leque, não todos no mesmo ponto');
});

test('os que erram não diminuem a emissão; os modificadores de quantidade somam (suportes, peças, a gema "adicionais")', () => {
  // 1 bicho: 1 acerta, 11 saem e erram — a emissão segue 12.
  const um = resolver({ projeteisBase: 12 }, 1);
  assert.equal(um.emitidos.filter((p) => !p.bicho).length, 11);
  assert.equal(um.golpes.filter((g) => g.tipo === 'projetil').length, 0, 'os extras não acertam o alvo de novo (um projétil por bicho)');
  // A base + os adicionais (o Projéteis Múltiplos Maior: +4).
  assert.equal(resolver({ projeteisBase: 12, alvosExtras: 4 }, 1).emitidos.length, 16);
  // Só os adicionais ("Dispara 12 Projéteis adicionais"): 1 + 12.
  assert.equal(resolver({ alvosExtras: 12 }, 1).emitidos.length, 13);
  // Sem base nem adicionais: 1.
  assert.equal(resolver({}, 3).emitidos.length, 1);
  // Com 3 bichos e +4: os 3 acertam, os outros erram.
  const tres = resolver({ projeteisBase: 12, alvosExtras: 4 }, 3);
  assert.equal(tres.emitidos.length, 16);
  assert.equal(comBicho(tres).length, 3);
});

test('"Dispara Projéteis em sequência" (a Barragem): os que sobram vão no alvo; a perfuração, o ricochete e o retorno seguem por projétil', () => {
  const seq = resolver({ projeteisBase: 6, sequencia: true }, 1);
  assert.equal(seq.emitidos.length, 6);
  assert.equal(comBicho(seq).length, 6, 'todos no único bicho');
  assert.equal(seq.golpes.filter((g) => g.tipo === 'projetil' && g.bicho === seq.alvo).length, 5, 'o principal (já dado) + 5');
  // Com mais bichos, a sequência ainda prefere os outros bichos para os extras (um por bicho) e só o que sobra vai no alvo.
  const seq3 = resolver({ projeteisBase: 6, sequencia: true }, 3);
  assert.equal(comBicho(seq3).length, 6);
  assert.equal(new Set(comBicho(seq3).map((p) => p.bicho.uid)).size, 3);
  // A perfuração: cada projétil extra que acerta atravessa como antes.
  const perfura = resolver({ projeteisBase: 3, perfurar: 1 }, 3);
  assert.equal(perfura.emitidos.length, 3);
  // O retorno: cada projétil que acertou volta e acerta de novo.
  const volta = resolver({ projeteisBase: 3, retornar: 1 }, 3);
  assert.equal(volta.golpes.filter((g) => g.tipo === 'retorno').length, 3);
});

test('a área e a skill sem projétil não mudam: nada de emissão nelas', () => {
  const area = S.resolver({ efeito: { projeteisBase: 22 }, tags: ['spell', 'area', 'projectile', 'hit'], origem: ORIGEM, alvo: null, atingidos: bichos(3), vivos: bichos(3), alcance: 7, area: true });
  assert.equal(area.emitidos.length, 0);
  const sem = S.resolver({ efeito: { alvosExtras: 4 }, tags: ['spell', 'single', 'hit'], origem: ORIGEM, alvo: bichos(1)[0], atingidos: bichos(1), vivos: bichos(3), alcance: 7 });
  assert.equal(sem.emitidos.length, 0);
});

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';

test('a quantidade BASE da gema: "Dispara 15 projéteis" (Lâminas Etéreas), "Dispara 9 Flechas", "em sequência" (Barragem)', { skip: SEM }, async () => {
  const GP = await import('../systems/itens-poe/gemas-poe.mjs');
  if (!GP.doSlug('Ethereal_Knives')) return; // (sem a coleção de gemas nesta máquina)
  assert.equal(GP.alvosNoNivel('Ethereal_Knives', 20).base, 15);
  assert.equal(GP.alvosNoNivel('Split_Arrow', 20).base, 9);
  assert.equal(GP.alvosNoNivel('Barrage', 20).sequencia, true);
  assert.equal(GP.alvosNoNivel('Fireball', 20).base, undefined, 'a Bola de Fogo: 1');
});

test('no disparo de verdade: a gema de 15 projéteis com 1 e com 3 bichos desenha os 15 e acerta 1 e 3', { skip: SEM }, async () => {
  const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
  const Jogo = await import('../systems/itens-poe/jogo.mjs');
  const GP = await import('../systems/itens-poe/gemas-poe.mjs');
  const GS = await import('../systems/skills/gemas.mjs');
  const Gerar = await import('../systems/itens-poe/gerar.mjs');
  const Acoes = await import('../systems/acoes.mjs');
  const Afixos = await import('../systems/afixos.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const Cacadas = await import('../systems/cacadas.mjs');
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
  const g = GP.doSlug('Ethereal_Knives');
  if (!g) return;
  const entry = Acoes.POR_ID_PUBLICO(g.acao);
  const lancar = (n) => {
    const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
    e.classePoe = 'Shadow';
    const arma = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
    arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.equipment = { ...(e.equipment ?? {}), weapon: arma };
    e.inventory = [GS.itemDaGema({ id: g.itemId, nivel: 20, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
    Afixos.sincronizarMaximos(e);
    Ficha.invalidar(e);
    e.mana = e.maxMana = 1e9;
    assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
    const h = e.hunt;
    const molde = h.monstros.find((b) => b.hp > 0);
    h.monstros = Array.from({ length: n }, (_, i) => ({ ...molde, uid: `t${i}`, hp: 1e12, maxHp: 1e12, x: h.pos.x + 1 + i, y: h.pos.y }));
    h.respawns = [];
    e.actions = Array(Acoes.SLOTS).fill(null);
    const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
    e.actions[slot] = { id: g.acao, enabled: true, minMana: 0, minTargets: 1, conditions: [] };
    h.cooldowns = {};
    delete h.conjurando;
    const r = Acoes.disparar(e, h, PERSONAGEM, slot, h.monstros[0]);
    assert.notEqual(r.ok, false, r.erro);
    // (a magia com tempo de conjuração termina na hora — o `concluirConjuracao` devolve os eventos)
    let eventos = r.eventos;
    if (r.conjurando) { h.conjurando.fim = 0; const fim = Acoes.concluirConjuracao(e, h, PERSONAGEM); eventos = Array.isArray(fim) ? fim : fim?.eventos ?? []; }
    const tiros = eventos.filter((ev) => ev.t === 'shot' && ev.id === entry.projetil).length;
    const acertados = new Set(eventos.filter((ev) => ev.t === 'dmg' && ev.foe).map((ev) => ev.uid)).size;
    return { tiros, acertados };
  };
  assert.ok(entry?.projetil != null, 'a skill desenha o projétil');
  assert.deepEqual(lancar(1), { tiros: 15, acertados: 1 }, '1 bicho: os 15 saem, 1 acerta');
  assert.deepEqual(lancar(3), { tiros: 15, acertados: 3 }, '3 bichos: os 15 saem, 3 acertam');
});

// ---- Os TOTENS e os LACAIOS (dono, 11/10: "faça os totens e lacaios também"): o mesmo motor de projéteis do disparo do personagem.
/** Uma bruxa do PoE com a gema (e os suportes LIGADOS a ela) numa varinha, numa caçada do Ato 1 sem bichos. */
async function comGemas(slugs) {
  const { personagemDeTeste } = await import('./apoio.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
  const Jogo = await import('../systems/itens-poe/jogo.mjs');
  const GP = await import('../systems/itens-poe/gemas-poe.mjs');
  const GS = await import('../systems/skills/gemas.mjs');
  const Gerar = await import('../systems/itens-poe/gerar.mjs');
  const Afixos = await import('../systems/afixos.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const Cacadas = await import('../systems/cacadas.mjs');
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
  const defs = slugs.map((s) => GP.doSlug(s) ?? [...GS.DEFS.values()].find((d) => d.tipo === 'support' && d.poe?.slug === s));
  if (defs.some((d) => !d)) return null;
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 70 });
  e.classePoe = 'Witch';
  const arma = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: slugs.length, links: Array(slugs.length - 1).fill(true), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = defs.map((d) => GS.itemDaGema({ id: d.itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < slugs.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  const molde = e.hunt.monstros.find((b) => b.hp > 0);
  e.hunt.monstros = [];
  e.hunt.respawns = [];
  return { e, acao: defs[0].acao, molde, bichos: (n, de) => (e.hunt.monstros = Array.from({ length: n }, (_, i) => ({ ...molde, uid: `t${i}`, hp: 1e12, maxHp: 1e12, x: de.x + 1 + i, y: de.y }))) };
}

test('o TOTEM de projétil (a Balista de Estilhaços: "Dispara 3 Flechas") emite os 3 com 1 e com 3 bichos', { skip: SEM }, async () => {
  const m = await comGemas(['Shrapnel_Ballista']);
  if (!m) return; // (sem a coleção de gemas nesta máquina)
  const { PERSONAGEM } = await import('./apoio.mjs');
  const Cacadas = await import('../systems/cacadas.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const Acoes = await import('../systems/acoes.mjs');
  const entry = Acoes.POR_ID_PUBLICO(m.acao);
  const golpe = (n) => {
    const h = m.e.hunt;
    const totem = { uid: 'tot', tipo: 'totem', acao: m.acao, x: h.pos.x + 1, y: h.pos.y, hp: 100, maxHp: 100, intervaloMs: 1000, elemento: 'physical', dano: { min: 10, max: 20 }, alcanceDeAtaque: 7 };
    const vivos = m.bichos(n, totem);
    const ev = Cacadas.golpeDoTotem(m.e, h, totem, vivos[0], Ficha.combate(m.e), PERSONAGEM, h.clock ?? 0);
    const tiros = ev.filter((x) => x.t === 'shot' && x.id === entry.projetil && x.x === totem.x && x.y === totem.y).length;
    const acertados = new Set(ev.filter((x) => x.t === 'dmg' && x.foe).map((x) => x.uid)).size;
    return { tiros, acertados };
  };
  assert.deepEqual(golpe(1), { tiros: 3, acertados: 1 }, '1 bicho: os 3 saem, 1 acerta');
  assert.deepEqual(golpe(3), { tiros: 3, acertados: 3 }, '3 bichos: os 3 saem, 3 acertam');
});

test('o LACAIO de longe: os suportes de projétil ligados na gema que o invocou (Projéteis Múltiplos Maior no Arqueiro Esqueleto)', { skip: SEM }, async () => {
  const Acoes = await import('../systems/acoes.mjs');
  const com = await comGemas(['Summon_Skeletons_of_Archers', 'Greater_Multiple_Projectiles_Support']);
  if (!com) return;
  const origem = { x: com.e.hunt.pos.x, y: com.e.hunt.pos.y };
  const projeteis = (m, n) => {
    const vivos = m.bichos(n, origem);
    return Acoes.projeteisDoLacaio(m.e, m.acao, { origem, alvo: vivos[0], vivos, alcance: 5 });
  };
  const um = projeteis(com, 1);
  assert.ok(um.emitidos.length > 1, `com o suporte, mais de 1 projétil (${um.emitidos.length})`);
  assert.equal(um.emitidos.filter((p) => p.bicho).length, 1, '1 bicho: 1 acerta, os outros saem e erram');
  const cinco = projeteis(com, 5);
  assert.equal(cinco.emitidos.length, um.emitidos.length, 'a emissão não depende dos bichos');
  assert.equal(new Set(cinco.emitidos.filter((p) => p.bicho).map((p) => p.bicho.uid)).size, Math.min(5, um.emitidos.length));
  // Sem o suporte: só o principal (nada muda para o lacaio de sempre).
  const sem = await comGemas(['Summon_Skeletons_of_Archers']);
  assert.equal(projeteis(sem, 3).emitidos.length, 1);
});
