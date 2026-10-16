// OS LACAIOS da árvore do PoE (dono, 13/10: "pode seguir com os lacaios") de ponta a ponta, com os nós REAIS: a Égide Necromântica ("Todos os
// bônus do Escudo equipado se aplicam aos seus Lacaios e não a você"), o golem que volta ("Golens Convocados são Reconvocados 4 segundos após
// serem Mortos" — o Suserano do Primordial) e a resistência a Fogo/Gelo/Raio dos lacaios, que era guardada e nunca lida no golpe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Um personagem com uma Varinha (uma mão) e um Escudo de Torre Cedro com `afEscudo`; `gemas` encaixadas na varinha e na barra. */
function personagem({ afEscudo = {}, gemas = [] } = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const varinha = peca('Wands/Driftwood_Wand');
  varinha.soquetes = { abertos: Math.max(1, gemas.length), links: [], gemas: Array(Math.max(1, gemas.length)).fill(null), cores: Array(Math.max(1, gemas.length)).fill('W') };
  const escudo = peca('Shields/Cedar_Tower_Shield');
  escudo.poe.af = { ...(escudo.poe.af ?? {}), ...afEscudo };
  e.equipment = { ...(e.equipment ?? {}), weapon: varinha, shield: escudo };
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 1, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < gemas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  gemas.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 100_000;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  return e;
}
const af = (e) => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };

/** Aloca o nó (principal, keystone ou ascendência) com um efeito cuja chave casa `re`. */
function alocar(e, re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  let no = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  if (!no) {
    no = arv.nos.find((n) => n.ascendencia && tem(n.efeitos));
    assert.ok(no, `há nó com ${re}`);
    e.classePoe = arv.ascendencias[no.ascendencia].classe;
    P.garantir(e);
    e.passivas.ascendencia = no.ascendencia;
    Comandos.depoisDeMudar(e);
    assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) }).ok);
    Ficha.invalidar(e);
    return;
  }
  const caminho = P.caminhoAte(e, no.id);
  if (caminho.length > 1) assert.equal(Comandos.comando(e, { action: 'alocar', ids: caminho.slice(0, -1) }).feitos, caminho.length - 1);
  assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id }).ok);
  Ficha.invalidar(e);
}

test('a ÉGIDE NECROMÂNTICA: o bloqueio, as resistências, a vida % e o dano do escudo saem de você e vão para os lacaios; a armadura da base sai de você', { skip: SEM }, () => {
  const afEscudo = { fire_res: 30, chaos_res: 20, life_inc: 10, dmg_inc: 25 };
  const comum = personagem({ afEscudo });
  const com = personagem({ afEscudo });
  alocar(com, /^egide_necromantica$/);
  // (o mesmo caminho na árvore, sem o escudo: o que a árvore dá em cada atributo)
  const semEscudo = personagem({ afEscudo });
  alocar(semEscudo, /^egide_necromantica$/);
  delete semEscudo.equipment.shield;
  const a = af(com);
  const base = af(semEscudo);
  assert.ok(comum.equipment.shield.poe.af.block > 0, 'o escudo tem bloqueio (o da base)');
  for (const k of ['block', 'fire_res', 'chaos_res', 'life_inc', 'dmg_inc']) assert.ok(Math.abs((a[k] ?? 0) - (base[k] ?? 0)) < 1e-9, `${k}: o do escudo saiu de você`);
  assert.ok(Math.abs((a.minion_block ?? 0) - (base.minion_block ?? 0) - comum.equipment.shield.poe.af.block) < 1e-9, 'o bloqueio do escudo nos lacaios');
  assert.equal((a.minion_fire_res ?? 0) - (base.minion_fire_res ?? 0), 30);
  assert.equal((a.minion_chaos_res ?? 0) - (base.minion_chaos_res ?? 0), 20);
  assert.equal((a.minion_life ?? 0) - (base.minion_life ?? 0), 10);
  assert.equal((a.minion_dmg ?? 0) - (base.minion_dmg ?? 0), 25);
  Ficha.invalidar(com);
  Ficha.invalidar(semEscudo);
  assert.equal(Ficha.combate(com).armor, Ficha.combate(semEscudo).armor, 'a armadura da base do escudo também sai de você');
  // (o lacaio invocado com a ficha do dono: o bloqueio e a resistência a Fogo do escudo)
  const q = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, a);
  const q0 = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, base);
  assert.ok(q.poe.bloqueio - q0.poe.bloqueio > 20);
  assert.equal(q.poe.resFogo - q0.poe.resFogo, 30);
  // (sem a keystone, o escudo é seu)
  assert.ok((af(comum).fire_res ?? 0) >= 30);
});

test('a resistência de UM elemento do lacaio ("Lacaios têm +X% de Resistência a Fogo") vale no golpe que ele leva — antes era guardada e nunca lida', { skip: SEM }, () => {
  const l = { poe: { res: 10, resFogo: 30, resGelo: 0, resRaio: 5 } };
  assert.equal(Cacadas.resDoLacaio(l, 'fire'), 40);
  assert.equal(Cacadas.resDoLacaio(l, 'ice'), 10);
  assert.equal(Cacadas.resDoLacaio(l, 'energy'), 15);
  assert.equal(Cacadas.resDoLacaio(l, 'fire', { res: 20 }), 60, '+ as auras de aliado');
  const q = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, { minion_energy_res: 25 });
  // (lote 44: + os 40% de base do Zumbi no PoB)
  assert.equal(q.poe.resRaio - LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, {}).poe.resRaio, 25);
});

test('o SUSERANO DO PRIMORDIAL: o golem morto volta sozinho em 4 s (se a gema segue encaixada)', { skip: SEM }, () => {
  const e = personagem({ gemas: ['Summon_Stone_Golem'] });
  alocar(e, /^golem_reconvoca_s$/);
  assert.equal(af(e).golem_reconvoca_s, 4);
  const [b, ...outros] = e.hunt.monstros;
  for (const o of outros) Object.assign(o, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 3, y: e.hunt.pos.y, hp: 1e9, maxHp: 1e9 });
  e.hunt.clock += 10_000;
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, {});
  if (r.conjurando) { e.hunt.clock += 3000; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
  const golem = e.hunt.lacaios.find((l) => l.golem);
  assert.ok(golem, 'o golem foi invocado');
  golem.hp = 0;
  let t = Date.now();
  Cacadas.tique(e, PERSONAGEM, (t += 250));
  assert.equal(e.hunt.golensAReconvocar?.length, 1, 'na fila para voltar');
  const quando = e.hunt.golensAReconvocar[0].ate;
  assert.equal(e.hunt.lacaios.filter((l) => l.golem && l.hp > 0).length, 0);
  // (o tique da caçada compara com o relógio dela: chega a hora — a invocação de sempre)
  const eventos = Acoes.reconvocarGolens(e, e.hunt, quando);
  assert.ok(eventos.length, 'voltou');
  assert.equal(e.hunt.lacaios.filter((l) => l.golem && l.hp > 0).length, 1);
  assert.equal(e.hunt.golensAReconvocar.length, 0);
});

test('a ÁRVORE: as duas linhas dos lacaios têm efeito no balão', { skip: SEM }, () => {
  const linhas = P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i] }))));
  for (const re of [/bônus do Escudo equipado se aplicam aos seus Lacaios/, /Reconvocados 4 segundos após serem Mortos/]) {
    const achadas = linhas.filter((l) => re.test(l.t));
    assert.ok(achadas.length > 0, `há linha ${re}`);
    for (const l of achadas) assert.ok(['equivalente', 'novo', 'aproximado'].includes(l.estado), `${l.t}: ${l.estado}`);
  }
});
