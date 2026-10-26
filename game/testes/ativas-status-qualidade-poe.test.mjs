// O STATUS E A QUALIDADE DAS ATIVAS, AS MALDIÇÕES, AS AURAS E AS CHAVES DO COMPILADOR SEM LEITOR (lote G18b, 17/10): o status no jogo passa a ser
// avaliado com a qualidade 20 (as linhas da qualidade que o jogo não faz entram nos motivos); o raio da qualidade SOMA no do nível (antes o
// sobrescrevia: a Bola de Fogo com qualidade 20 ficava com 0,3 m); as chances da gema com a qualidade; as maldições dão as chances e as durações
// das afecções nos acertos contra o amaldiçoado; o Enfraquecer é menor no Raro e no Único; as auras com a flag do PoB (a Malevolência só no
// degenerativo; a Precisão "aumentada", não pontos); o Golpe de Misericórdia; o atordoamento local; o "menos Dano sofrido" de um tipo (o Chamado
// Imortal: o Caos nunca); o tempo de ataque extra; os vizinhos da Flecha Relampejante.
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
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Registro = await import('../systems/combate/registro.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const Vinculos = await import('../systems/itens-poe/vinculos.mjs');

const sorte = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } };
const perto = (a, b, tol = 0.02) => Math.abs(a / b - 1) < tol;

async function montar(arma, grupos, { qualidade = 0 } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const todas = grupos.flat();
  const links = grupos.flatMap((g) => g.map((_, i) => i < g.length - 1)).slice(0, todas.length - 1);
  a.soquetes = { abertos: todas.length, links, gemas: Array(todas.length).fill(null), cores: Array(todas.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = todas.map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 20, xp: 0, raridade: 'comum', ...(qualidade && G.doSlug(s) ? { qualidade } : {}) }));
  for (let i = 0; i < todas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  grupos.forEach((g, i) => { e.actions[i] = { id: G.doSlug(g[0]).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(sorte(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} });
  return { e, b, resto };
}
function usar({ e, b }, v, slot = 0) {
  Registro.definirNivel(2);
  Registro.limparRegistro();
  try {
    const eventos = [];
    sorte(v, () => {
      const r = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, b, { manual: true });
      assert.ok(r.ok, r.erro);
      eventos.push(...(r.eventos ?? []));
      if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])); }
    });
    return { golpes: Registro.ultimosGolpes(300).filter((g) => g.origem === 'gema'), eventos, dots: b.dots ?? [] };
  } finally { Registro.definirNivel(0); }
}
const totalDo = (dots, tipo) => dots.filter((d) => d.tipo === tipo).reduce((t, d) => t + (d.falta ?? 0), 0);

test('G18b: o raio da qualidade SOMA no do nível (a Bola de Fogo 1,8 → 2,1 m com qualidade 20; com qualidade 1, o arredondado dá 0 a mais)', { skip: SEM }, () => {
  assert.equal(G.areaNoNivel('Fireball', 20, 0).raioM, 1.8);
  assert.ok(Math.abs(G.areaNoNivel('Fireball', 20, 20).raioM - 2.1) < 1e-9);
  assert.equal(G.areaNoNivel('Fireball', 20, 1).raioM, 1.8);
  assert.ok(Math.abs(G.areaNoNivel('Ice_Nova', 20, 20).raioM - 3.3) < 1e-9);
});

test('G18b: o status com a qualidade 20 lista as linhas da qualidade que o jogo não faz; as feitas (o Vínculo, as Marcas) seguem "funciona"', { skip: SEM }, () => {
  // (aval do dono, 26/10 — lote G-A: o "Duração de Maldições aumentada em 20 %" da qualidade do Enfraquecer passou a valer — a duração da maldição no monstro,
  // 11,8 s × 1,2 = 14,16 s —, e o Enfraquecer ficou completo; antes a linha estava aqui como exemplo de qualidade não feita)
  assert.equal(G.doSlug('Enfeeble').statusNoJogo, 'funciona', G.doSlug('Enfeeble').motivosNoJogo.join(' | '));
  for (const s of ['Flame_Link', 'Armageddon_Brand', 'Penance_Brand', 'Burning_Arrow', 'Double_Strike', 'Fireball']) assert.equal(G.doSlug(s).statusNoJogo, 'funciona', `${s}: ${G.doSlug(s).motivosNoJogo.join(' | ')}`);
  // (a qualidade das Marcas — "Causa +10 % mais Dano com Acertos contra o Inimigo Vinculado" — soma; a do Vínculo — "+1,5 segundos à duração base")
  assert.equal(G.contraOVinculado('Armageddon_Brand', 20, 20), G.contraOVinculado('Armageddon_Brand', 20, 0) + 10);
  const d = (q) => Vinculos.daGema([...G.textosDaGema('Flame_Link', 20).linhas, ...G.linhasDaQualidadeDe('Flame_Link', q)]).duracaoMs;
  assert.equal(d(20) - d(0), 1500);
  // (a Flecha Ardente: o "20 % mais Dano com Incêndio" da qualidade é só do Incêndio)
  assert.equal(G.maisNasAfeccoesDaGema('Burning_Arrow', 20, 20).maisIncendioPct, 20);
});

test('G18b: as chances da gema com a qualidade (o Golpe Selvagem: 20% de Congelar, Eletrizar e Incendiar na qualidade 20)', { skip: SEM }, () => {
  const base = AfeccoesPoe.daSoma({});
  assert.deepEqual([G.afeccoesComAGema(base, 'Wild_Strike', 20, 20).chance.incendio, G.afeccoesComAGema(base, 'Wild_Strike', 20, 20).chance.congelamento, G.afeccoesComAGema(base, 'Wild_Strike', 20, 20).chance.eletrizacao], [20, 20, 20]);
  assert.equal(G.afeccoesComAGema(base, 'Wild_Strike', 20, 0).chance.incendio, 0);
});

test('G18b: as auras com a flag do PoB — a Malevolência só no degenerativo, a Ira só no Raio das magias, a Precisão "aumentada"', { skip: SEM }, () => {
  const mal = G.buffNoNivel('Malevolence', 20);
  assert.equal(mal.af.dano_dot_mais, 20);
  assert.ok(!mal.efeitos.some((x) => x.efeito === 'dano'), 'a Malevolência não dá mais "dano" geral');
  assert.equal(G.buffNoNivel('Precision', 20).af.crit_chance_inc, 58);
  assert.equal(G.buffNoNivel('Zealotry', 20).af['mais_dano_acerto@magia'], 15);
  assert.equal(G.buffNoNivel('Wrath', 20).af['mais_dano_raio@magia'], 21);
});

test('G18b: a Malevolência no jogo — o Incêndio da Bola de Fogo ×1,20 e o acerto igual', { skip: SEM }, async () => {
  const bola = async (comAura) => {
    const m = await montar('Wands/Driftwood_Wand', [['Fireball'], ['Malevolence']]);
    if (comAura) usar(m, 0.99, 1);
    m.e.hunt.clock += 1000;
    m.b.dots = [];
    const u = usar(m, 0.01, 0);
    return { acerto: u.golpes.reduce((t, g) => t + g.danoAntesDaResistencia, 0), incendio: totalDo(u.dots, 'queimadura') };
  };
  const sem = await bola(false);
  const com = await bola(true);
  assert.ok(perto(com.acerto, sem.acerto), `o acerto: ${com.acerto} / ${sem.acerto}`);
  assert.ok(perto(com.incendio / sem.incendio, 1.2), `o Incêndio: ${com.incendio} / ${sem.incendio}`);
});

test('G18b: a Inflamabilidade no alvo — a Bola de Fogo sem crítico incendeia com 25% (a gema) + 25% (a maldição)', { skip: SEM }, async () => {
  const contra = G.buffNoNivel('Flammability', 20).efeitos.find((x) => x.efeito === 'maldicaoContra');
  assert.equal(contra.golpe.chance_ignite, 25);
  const incendeia = async (amaldicoado) => {
    const m = await montar('Wands/Driftwood_Wand', [['Fireball']]);
    if (amaldicoado) m.b.maldicoes = { flam: { ate: 1e12, efeitos: [], contra: { golpe: contra.golpe, morte: {}, fator: 1 } } };
    // (o sorteio em 0,4: sem crítico; 40 < 50 incendeia, 40 > 25 não)
    return totalDo(usar(m, 0.4).dots, 'queimadura') > 0;
  };
  assert.equal(await incendeia(false), false, 'sem a maldição, 25% não bastam');
  assert.equal(await incendeia(true), true, 'com a maldição, 50%');
});

test('G18b: o Enfraquecer — o monstro normal causa ×0,71, o Raro e o chefe ×0,82', { skip: SEM }, () => {
  const ef = G.buffNoNivel('Enfeeble', 20).efeitos.find((x) => x.efeito === 'marcaEnfraquece');
  assert.deepEqual([ef.pct, ef.pctRaro], [29, 18]);
  const marca = { enfraquecido: { ate: 1e9, pct: ef.pct, pctRaro: ef.pctRaro } };
  assert.ok(perto(Reforcos.forcaDoBicho({ forca: 1, marcas: marca }, 0), 0.71, 1e-6));
  assert.ok(perto(Reforcos.forcaDoBicho({ forca: 1, marcas: marca, raridade: 'raro' }, 0), 0.82, 1e-6));
  assert.ok(perto(Reforcos.forcaDoBicho({ forca: 1, marcas: marca, boss: true }, 0), 0.82, 1e-6));
});

test('G18b: o Chamado Imortal — 35% menos Físico e 34% menos Elemental sofridos; o Caos igual (antes 84% menos em tudo)', { skip: SEM }, () => {
  const af = G.buffNoNivel('Immortal_Call', 20).af;
  const ficha = { afPoe: af, porTag: [] };
  assert.ok(perto(ModsPoe.fatorDoDanoRecebido(ficha, 'physical'), 0.65, 1e-6));
  assert.ok(perto(ModsPoe.fatorDoDanoRecebido(ficha, 'fire'), 0.66, 1e-6));
  assert.ok(perto(ModsPoe.fatorDoDanoRecebido(ficha, 'chaos'), 1, 1e-6));
});

test('G18b: as linhas locais — o Golpe de Misericórdia, o atordoamento, o crítico da Concocção — e o tempo de ataque extra', { skip: SEM }, () => {
  assert.equal(G.linhasLocaisNoNivel('Power_Siphon', 20).af.culling, 1);
  assert.equal(G.linhasLocaisNoNivel('Heavy_Strike', 20).af.enemy_stun_threshold_red, 25);
  assert.equal(G.linhasLocaisNoNivel('Vaal_Ground_Slam', 20).af.stun_duration, 200);
  assert.equal(G.linhasLocaisNoNivel('Explosive_Concoction', 20).af.crit_chance, 6);
  assert.deepEqual([G.temposNoNivel('Leap_Slam', 20).tempoExtraMs, G.temposNoNivel('Vaal_Cleave', 20).tempoExtraMs], [550, 800]);
});

test('G18b: o Golpe de Misericórdia do Sifão de Poder — o alvo comum a menos de 10% da vida morre no acerto', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', [['Power_Siphon']]);
  Object.assign(m.b, { maxHp: 1e9, hp: 0.09e9 });
  usar(m, 0.99);
  assert.ok(m.b.hp <= 0, `a vida: ${m.b.hp}`);
  const v = await montar('Wands/Driftwood_Wand', [['Power_Siphon']]);
  Object.assign(v.b, { maxHp: 1e9, hp: 0.5e9 });
  usar(v, 0.99);
  assert.ok(v.b.hp > 0, 'a 50% da vida, vive');
});

test('G18b: a Flecha Relampejante acerta até 3 vizinhos a 1 casa do alvo (o 4º não)', { skip: SEM }, async () => {
  const m = await montar('Bows/Crude_Bow', [['Lightning_Arrow']]);
  const viz = m.resto.slice(0, 4);
  viz.forEach((x, i) => Object.assign(x, { x: m.b.x + [1, 1, 1, 0][i], y: m.b.y + [-1, 0, 1, 1][i], hp: 1e12, maxHp: 1e12, resist: {}, dots: [], estados: {} }));
  const u = usar(m, 0.99);
  const acertados = new Set(u.golpes.map((g) => g.alvo));
  const vizinhosAcertados = viz.filter((x) => u.golpes.some((g) => g.alvo === x.name && g.danoFinal > 0));
  assert.ok(acertados.has(m.b.name), 'o alvo');
  assert.equal(vizinhosAcertados.length, 3, `os vizinhos: ${vizinhosAcertados.length}`);
});

test('G18b: a Vulnerabilidade e o Orgulho só no Físico; o Orgulho sobe de 19% a 39% em 4 s na aura', { skip: SEM }, () => {
  const vul = G.buffNoNivel('Vulnerability', 20).efeitos.filter((x) => x.efeito === 'marcaVulneravel');
  assert.deepEqual(vul.map((x) => x.tipos), [['physical']]);
  const orgulho = G.doSlug('Pride');
  const hunt = { clock: 0, buffs: { [orgulho.acao]: { ate: Number.MAX_SAFE_INTEGER, fator: 1, efeitosPoe: G.buffNoNivel('Pride', 20).efeitos } } };
  const b = { uid: 1, key: 'rat', x: 0, y: 0, hp: 100, maxHp: 100 };
  const fis = [];
  for (const t of [0, 2000, 4000, 6000]) { Reforcos.marcar(hunt, b, t); fis.push(Reforcos.vulnerabilidade(b, 'physical', t)); }
  assert.ok(perto(fis[0], 1.19, 1e-6) && perto(fis[1], 1.29, 1e-6) && perto(fis[2], 1.39, 1e-6) && perto(fis[3], 1.39, 1e-6), `${fis}`);
  assert.ok(perto(Reforcos.vulnerabilidade(b, 'fire', 6000), 1, 1e-6), 'o Fogo não');
});
