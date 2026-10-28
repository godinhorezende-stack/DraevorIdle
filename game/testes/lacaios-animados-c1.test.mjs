// RODADA 4 DAS GEMAS, LOTE C1 (28/10 — o dono: "quero resolver") — os LACAIOS ANIMADOS e o ESPECTRO pelo PoB:
//   - a Arma Animada (Animar Arma, a Vaal, a dos Braços Distantes) e o Guardião Animado (Animar Guardião, o do Castigo): o item animado é uma BASE Normal do nível que a
//     gema anima ("Pode usar Itens que exigem até o Nível N"); a arma dá o dano Físico e o tempo de ataque, a Armadura de Corpo dá as defesas, e o lacaio usa as
//     habilidades do PoB (`itens-poe/lacaios-animados.mjs`). As 5 saem da limitação do idle;
//   - o Espectro: as magias do monstro erguido sobem do nível dele para o do Espectro pela eficácia do PoB (statInterpolation 3, o incremental 0,04), não pela tabela de
//     dano de monstro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG, CATALOGO } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const H = await import('../systems/itens-poe/lacaios-habilidades.mjs');
const A = await import('../systems/itens-poe/lacaios-animados.mjs');
const Terreno = await import('../systems/hunt/terreno.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const invocar = (slug, nivel = 20, qualidade = 0) => LacaiosPoe.oQueInvoca(slug, nivel, { nivel, qualidade }, {});
const ANIMAR = ['Animate_Weapon', 'Vaal_Animate_Weapon', 'Animate_Weapon_of_Ranged_Arms', 'Animate_Guardian', 'Animate_Guardian_of_Smiting'];
const bases = (classes) => classes.flatMap((c) => Catalogo.catalogo().classes[c].bases.map((b) => ({ ...b, classe: c }))).filter((b) => Number.isFinite(b.requisitos?.nivel));
const media = (f) => (f ? (f.min + f.max) / 2 : 0);

test('C1 — status: as 5 gemas de Animar seguem o PoB (o item animado é uma base Normal) e saem da limitação do idle', { skip: SEM }, () => {
  const st = G.statusNoJogo();
  for (const s of ANIMAR) {
    assert.ok(H.segueOPob(s), s);
    assert.deepEqual(st[s].motivos, [], s);
    assert.equal(st[s].status, 'funciona', s);
  }
  // a Auto-reflexão segue com a SUA arma
  assert.equal(H.configDaGema('Animate_Weapon_of_Self_Reflection').arma, 'sua');
  assert.equal(A.usaBase('Animate_Weapon_of_Self_Reflection'), false);
});

test('C1 — a ARMA ANIMADA: a base Normal de arma corpo a corpo de maior DPS Físico de base até o nível da gema; o golpe é o dano Físico e o tempo dela', { skip: SEM }, () => {
  // o limite: "Pode usar Itens que exigem até o Nível N" (o PoB: animate_item_maximum_level_requirement)
  const linhas = G.textosDaGema('Animate_Weapon', 20).linhas;
  assert.equal(A.limiteDeNivel(linhas), 100);
  const limite1 = A.limiteDeNivel(G.textosDaGema('Animate_Weapon', 1).linhas);
  assert.ok(limite1 > 0 && limite1 < 100, String(limite1));
  const q = invocar('Animate_Weapon');
  const arma = q.itemAnimado;
  assert.equal(arma.tipo, 'arma');
  assert.ok(A.CLASSES_CORPO.includes(arma.classe), arma.classe);
  // (decisão do dono 28/10) a conta da escolha: o maior DPS Físico de base entre TODAS as corpo a corpo com requisito ≤ 100 (sem preferir o requisito mais alto)
  const corpo = bases(A.CLASSES_CORPO).filter((b) => b.atributos?.dano_fisico?.max > 0 && b.atributos?.ataques_por_segundo > 0 && b.requisitos.nivel <= 100);
  const dps = (b) => media(b.atributos.dano_fisico) * b.atributos.ataques_por_segundo;
  const melhorDps = Math.max(...corpo.map(dps));
  assert.ok(perto(media(arma) * arma.aps, melhorDps), `${arma.nome}: ${media(arma) * arma.aps} contra ${melhorDps}`);
  assert.ok(corpo.every((b) => dps(b) <= melhorDps * (1 + 1e-9)), 'nenhuma base que cabe tem DPS maior');
  // o golpe: a faixa da base × o "aumentado/mais" do lacaio (o fator da invocação); o tempo: 1 ÷ os ataques por segundo dela
  const f = q.poe.fatorDoDano;
  const golpe = media(arma) * f;
  const spread = (arma.max - arma.min) / (arma.max + arma.min);
  assert.deepEqual(q.dano, { min: Math.max(1, Math.round(golpe * (1 - spread))), max: Math.max(1, Math.round(golpe * (1 + spread))) });
  assert.equal(q.intervaloMs, Math.round(1000 / arma.aps));
  assert.equal(q.habPob.principal[0].tempoMs, Math.round(1000 / arma.aps));
  assert.deepEqual([q.estilo.alcance, q.habPob.principal[0].corpo], [1, true]);
  // a gema de nível 1: a base até o limite dela
  const q1 = invocar('Animate_Weapon', 1);
  assert.ok(q1.itemAnimado.nivel <= limite1, `${q1.itemAnimado.nome} ${q1.itemAnimado.nivel} ≤ ${limite1}`);
  // (aval do dono 28/10) a Vaal: o limite do PoB (animate_item_maximum_level_requirement) — 100 no nível 20, como a comum; o 40 da linha é o requisito mínimo da Vaal
  const vaal = invocar('Vaal_Animate_Weapon');
  assert.equal(A.limiteDeNivel(G.textosDaGema('Vaal_Animate_Weapon', 20).linhas), 100);
  assert.ok(vaal.itemAnimado.nivel <= 100 && A.CLASSES_CORPO.includes(vaal.itemAnimado.classe), JSON.stringify(vaal.itemAnimado));
  assert.deepEqual([vaal.itemAnimado.id, vaal.itemAnimado.nivel], [arma.id, arma.nivel], 'a mesma base da comum no 20');
});

test('C1 — a ARMA ANIMADA DOS BRAÇOS DISTANTES: a base é um arco; o lacaio ataca de longe (5 casas) com a flecha', { skip: SEM }, () => {
  const q = invocar('Animate_Weapon_of_Ranged_Arms');
  assert.equal(q.itemAnimado.classe, 'Bows');
  assert.equal(q.itemAnimado.distancia, true);
  const p = q.habPob.principal[0];
  assert.deepEqual([p.projetil, p.corpo, p.alcance], [true, false, 5]);
  assert.deepEqual([q.estilo.alcance, q.estilo.projetil], [5, 3]);
  assert.equal(q.intervaloMs, Math.round(1000 / q.itemAnimado.aps));
});

test('C1 — o GUARDIÃO ANIMADO: as defesas da Armadura de Corpo base (somadas às do PoB) e o golpe desarmado do PoB (2 a 6, 1 s); o do Castigo usa o Castigo (325%, 50% em Raio, 2,1 m)', { skip: SEM }, () => {
  const q = invocar('Animate_Guardian');
  const corpo = q.itemAnimado;
  assert.equal(corpo.tipo, 'armadura');
  const todas = bases(['Body_Armours']).filter((b) => b.requisitos.nivel <= 100);
  assert.equal(corpo.nivel, Math.max(...todas.map((b) => b.requisitos.nivel)));
  const base = todas.find((b) => b.id === corpo.id);
  assert.deepEqual([corpo.armadura, corpo.evasao, corpo.es], [media(base.atributos.armadura), media(base.atributos.evasao), media(base.atributos.escudo_energia)]);
  // a armadura: a do PoB (a tabela de armadura × 0,5 no nível do lacaio) + a da base; a evasão e o escudo, os da base
  const pob = LacaiosPoe.forcaDoPob('AnimatedArmour', q.nivel);
  assert.ok(perto(q.poe.armadura, pob.armadura + corpo.armadura));
  assert.ok(perto(q.poe.evasao, pob.evasao + corpo.evasao));
  assert.ok(perto(q.poe.esFixo, pob.es + corpo.es));
  // o golpe: 2 a 6 (média 4, ±50%) × o "aumentado/mais" do lacaio; 1 s
  const golpe = 4 * q.poe.fatorDoDano;
  assert.deepEqual(q.dano, { min: Math.max(1, Math.round(golpe * 0.5)), max: Math.max(1, Math.round(golpe * 1.5)) });
  assert.equal(q.intervaloMs, 1000);
  // o do Castigo
  const c = invocar('Animate_Guardian_of_Smiting');
  const smite = c.habPob.principal[0];
  assert.deepEqual([smite.id, smite.mult, smite.conversao, smite.area, smite.raioM], ['AnimateGuardianSmite', 3.25, { energy: 50 }, true, 2.1]);
  assert.equal(c.itemAnimado.id, corpo.id);
});

/** Uma Bruxa numa caçada de verdade com a gema na varinha; o alvo a 2 casas de você, sem resistência. */
function cacadaComGema(gema) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { sistema: 'poe', classePoe: 'Witch' });
  const p = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  p.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: p };
  delete e.equipment.shield;
  e.inventory = [GS.itemDaGema({ id: G.doSlug(gema).itemId, nivel: 20, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  Object.assign(e, { mana: 1e6, maxMana: 1e6, hp: 1e6, maxHp: 1e6 });
  const h = e.hunt;
  h.clock = 10000;
  h.monstros = h.monstros.slice(0, 1);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 2, y: h.pos.y, estados: {}, dots: [], resist: { fire: 0, ice: 0, energy: 0, chaos: 0 } });
  h.lacaios = [];
  h.cadaveres = [];
  return { e, h, alvo: h.monstros[0] };
}

test('C1 — no jogo: a Arma Animada e o Guardião invocados pelo uso da gema batem no alvo com o golpe do item animado', { skip: SEM }, () => {
  for (const gema of ['Animate_Weapon', 'Animate_Weapon_of_Ranged_Arms', 'Animate_Guardian']) {
    const c = cacadaComGema(gema);
    const u = Acoes.disparar(c.e, c.h, PERSONAGEM, 0, c.alvo, { manual: true });
    if (u.ok && c.h.conjurando) { c.h.clock = c.h.conjurando.fim; Acoes.concluirConjuracao(c.e, c.h, PERSONAGEM); }
    const l = c.h.lacaios.find((x) => x.gema === gema && x.hp > 0);
    assert.ok(l, `${gema}: invocou (${u.motivo ?? u.erro ?? ''})`);
    assert.equal(l.itemAnimado?.id, invocar(gema).itemAnimado.id, gema);
    const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(c.h.huntId)), c.h.z);
    const parede = Date.now();
    const r = Math.random;
    Math.random = () => 0.3;
    const ev = [];
    try { for (let i = 1; i <= 12; i++) { c.h.clock += 250; ev.push(...Cacadas.tiqueDosLacaios(c.e, c.h, PERSONAGEM, grade, parede + 250 * i)); } } finally { Math.random = r; }
    const golpes = ev.filter((x) => x.t === 'dmg' && x.uid === c.alvo.uid && x.foe && x.lacaio);
    assert.ok(golpes.length > 0, `${gema}: bateu`);
    // (o golpe na faixa do item: sem armadura e sem resistência no alvo, o dano do golpe padrão fica entre o mínimo e o máximo do lacaio, com o crítico do lacaio)
    assert.ok(golpes.every((x) => x.v >= 1 && x.v <= l.dano.max * (l.critMult ?? 1.5) * 1.6), `${gema}: ${golpes.map((x) => x.v)} (${l.dano.min}–${l.dano.max})`);
  }
});

test('C1 — o ESPECTRO: as magias do monstro erguido sobem do nível dele para o do Espectro pela eficácia do PoB (statInterpolation 3, incremental 0,04)', { skip: SEM }, () => {
  const ef = (n) => (3.885209 + 0.360246 * (n - 1)) * 1.04 ** (n - 1);
  assert.equal(H.INCREMENTAL_DAS_MAGIAS_DO_ESPECTRO, 0.04);
  assert.ok(perto(H.fatorDasMagiasDoEspectro(10, 40), ef(40) / ef(10)));
  assert.ok(perto(H.fatorDasMagiasDoEspectro(40, 40), 1));
  const T = H.DADOS.tabelas;
  const r = H.espectroPeloPob({ nivel: 10, dano: T.danoMonstro[9] * 2, tempoAtaque: 1.5 }, T.vidaMonstro[9] * 3, 40);
  assert.ok(perto(r.fatorDasMagias, ef(40) / ef(10)));
  // (não é mais a razão da tabela de dano de monstro)
  assert.ok(Math.abs(r.fatorDasMagias - T.danoMonstro[39] / T.danoMonstro[9]) > 0.01);
  // na invocação: o fator das magias do Espectro é o da eficácia × o "aumentado/mais" dele
  const c = cacadaComGema('Raise_Spectre');
  const chave = Object.keys(CATALOGO.bestiary).find((k) => CATALOGO.bestiary[k]?.poe?.dano > 0 && (CATALOGO.bestiary[k]?.poe?.nivel ?? 0) >= 5);
  const b = CATALOGO.bestiary[chave];
  c.h.cadaveres = [{ key: chave, nome: b.name, look: b.look, x: c.alvo.x, y: c.alvo.y, maxHp: b.hp }];
  const u = Acoes.disparar(c.e, c.h, PERSONAGEM, 0, c.alvo, { manual: true });
  if (u.ok && c.h.conjurando) { c.h.clock = c.h.conjurando.fim; Acoes.concluirConjuracao(c.e, c.h, PERSONAGEM); }
  const esp = c.h.lacaios.find((l) => l.espectro);
  assert.ok(esp, `ergueu: ${u.motivo ?? u.erro ?? ''}`);
  const f = esp.poe?.fatorDoDano ?? 1;
  assert.ok(perto(esp.espectro.fator, H.fatorDasMagiasDoEspectro(b.poe.nivel, esp.nivel) * f), `${esp.espectro.fator} ≈ ${H.fatorDasMagiasDoEspectro(b.poe.nivel, esp.nivel) * f}`);
});
