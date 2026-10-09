// As GEMAS no ritmo do PoE (auditoria da velocidade de ataque, 09/10 — o dono pediu as correções 2, 3 e 4), numa caçada de verdade
// (`Cacadas.entrar` + `Cacadas.tique` de 250 ms, alvo imortal colado), medindo o instante lógico de cada uso no relógio comum
// (`Acoes.GRUPO_DO_POE`):
//  2. a LENTIDÃO do personagem (resfriado, Lentidão) segura a gema de ataque e a magia como segura o golpe básico — antes só o básico;
//  3. o "aumentada" dos suportes (Ataques Acelerados) SOMA com os aumentos globais; o "mais/menos" segue multiplicando — antes multiplicava;
//  4. DUAS ARMAS: a gema de ataque alterna as mãos (cada uso com a sua arma) e a Cutilada combina 60% das duas — antes, só a principal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const GP = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Registro = await import('../systems/combate/registro.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

const VELOCIDADE = 'Velocidade de Ataque aumentada em {0}%';
const CONJURACAO = 'Velocidade de Conjuração aumentada em {0}%';
/** A peça do PoE da base (normal), ou só com estes sufixos (mágica), refeita pelo caminho das moedas. */
function peca(base, mods = null) {
  const p = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: mods ? 'magico' : 'normal', ilvl: 1, rng: () => 0.5 }));
  if (!mods) return p;
  p.poe.prefixos = [];
  p.poe.sufixos = mods.map(({ modelo, valor }) => ({ modelo, valores: [valor], texto: modelo.replace('{0}', valor) }));
  return Jogo.recalcular(p);
}
/** Um personagem do PoE com a arma (e a segunda arma/anel) e a gema ativa — com os suportes ligados — na arma e no slot 1 da barra. */
function montar({ classe = 'Duelist', arma, segunda = null, anel = null, gema, suportes = [], nivel = 10 }) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), { classePoe: classe });
  e.equipment = { ...e.equipment, weapon: arma };
  if (segunda) e.equipment.shield = segunda;
  else delete e.equipment.shield;
  if (anel) e.equipment.ring = anel;
  const n = 1 + suportes.length;
  arma.soquetes = { abertos: n, links: Array(n - 1).fill(true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.inventory = [gema, ...suportes].map((s) => GS.itemDaGema({ id: (GP.doSlug(s) ?? SP.doSlug(s)).itemId, nivel, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GP.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return e;
}
const entryDe = (slug) => Acoes.POR_ID_PUBLICO(GP.doSlug(slug).acao);
const LENTO = (e) => { e.hunt.controle = { ...(e.hunt.controle ?? {}), lento: { pct: 30, ate: (e.hunt.clock ?? 0) + 1e9 } }; };

/**
 * `segundos` de caçada (depois de 3 s) contra um alvo imortal colado. Devolve os usos da gema `slug` (o início lógico de cada um, no relógio da
 * caçada), os `cast` (a conjuração mostrada) e o intervalo médio entre usos.
 */
function cacar(e, slug, { segundos = 20, antes = null } = {}) {
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  const acao = GP.doSlug(slug).acao;
  let t = Date.now();
  const comeco = t + 3000;
  const usos = [];
  const casts = [];
  let ultimo = null;
  while (t < comeco + segundos * 1000) {
    const h = e.hunt;
    h.monstros = h.monstros.slice(0, 1);
    Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
    h.alvo = h.monstros[0].uid;
    Object.assign(e, { hp: e.maxHp, mana: 1e6, maxMana: 1e6 });
    antes?.(e);
    const eventos = Cacadas.tique(e, PERSONAGEM, (t += 250)) ?? [];
    for (const ev of eventos) if (ev.t === 'cast' && ev.sk === acao && t > comeco) casts.push(ev.ms);
    const g = h.cooldowns?.[Acoes.GRUPO_DO_POE];
    if (g && g !== ultimo) {
      ultimo = g;
      if (t > comeco && !g.basico) usos.push(g.ate - g.total);
    }
  }
  assert.ok(usos.length >= 5, `${slug}: ${usos.length} usos`);
  return { usos, casts, mediaMs: (usos.at(-1) - usos[0]) / (usos.length - 1), difs: usos.slice(1).map((x, i) => x - usos[i]) };
}

test('2. LENTO 30%: a gema de ataque e a magia ficam lentas como o golpe básico (antes só o básico); o totem e a estimativa não', { skip: SEM }, () => {
  // A Cutilada (80% da velocidade da arma) com a Rusted Sword (1,55): 645 / 0,80 = 806 ms; lento 30%: ÷ 0,70.
  const semLentidao = cacar(montar({ arma: peca('One_Hand_Swords/Rusted_Sword'), gema: 'Cleave' }), 'Cleave');
  assert.equal(Math.round(semLentidao.mediaMs), 806);
  const e = montar({ arma: peca('One_Hand_Swords/Rusted_Sword'), gema: 'Cleave' });
  const lenta = cacar(e, 'Cleave', { antes: LENTO });
  const esperado = Math.round(((1000 / 1.55) / 0.8) / 0.7);
  assert.ok(lenta.difs.every((d) => Math.abs(d - esperado) <= 1), `Cutilada lenta: ${lenta.difs.join(', ')} (esperado ${esperado}; antes 806)`);
  assert.equal(Acoes.temposDaGemaPoe(e, entryDe('Cleave')).uso, Math.round(Ficha.combate(e).intervaloDoGolpeMs / 0.8 / 0.7), 'o balão mostra o tempo lento');
  // O totem (a gema do dono) e a estimativa de DPS não levam a lentidão do personagem.
  assert.equal(Acoes.temposDaGemaPoe(e, entryDe('Cleave'), undefined, undefined, { doJogador: false }).uso, 806);
  const totem = { uid: 't', acao: GP.doSlug('Cleave').acao, tipo: 'totem', x: 0, y: 0, hp: 100, maxHp: 100, dano: { min: 1, max: 1 }, elemento: 'physical', intervaloMs: 1000, proximoGolpe: 0 };
  Cacadas.golpeDoTotem(e, e.hunt, totem, e.hunt.monstros[0], Ficha.combate(e), PERSONAGEM, 0);
  assert.equal(totem.proximoGolpe, 806, 'o golpe do totem não fica lento com o dono');
  // A magia: a Bola de Fogo (0,75 s) conjura e libera em 750 / 0,70.
  const m = montar({ classe: 'Witch', arma: peca('Wands/Driftwood_Wand'), gema: 'Fireball' });
  const fogo = cacar(m, 'Fireball', { antes: LENTO });
  const conj = Math.round(750 / 0.7);
  assert.ok(fogo.difs.every((d) => Math.abs(d - conj) <= 1), `Bola de Fogo lenta: ${fogo.difs.join(', ')} (esperado ${conj}; antes 750)`);
  assert.ok(fogo.casts.length && fogo.casts.every((ms) => ms === conj), `a conjuração mostrada: ${[...new Set(fogo.casts)].join(', ')}`);
});

test('3. o "aumentada" do suporte SOMA com a velocidade global (Ataques Acelerados, Conjuração Acelerada); o "mais" segue multiplicando', { skip: SEM }, () => {
  const daCutilada = (e) => Acoes.temposDaGemaPoe(e, entryDe('Cleave')).uso;
  // Ataques Acelerados nv 10: "31% de Velocidade de Ataque aumentada". Sem nada global: 1000 / (1,55 × 0,80 × 1,31).
  const so = montar({ arma: peca('One_Hand_Swords/Rusted_Sword'), gema: 'Cleave', suportes: ['Faster_Attacks_Support'] });
  const efeito = GS.efeitoNaSkill(so, GP.doSlug('Cleave').acao);
  assert.equal(efeito.velAtaquePct, 31, 'o suporte dá 31% aumentada (não vira tempo de uso)');
  assert.equal(efeito.castTimePct ?? 0, 0);
  assert.ok(Math.abs(daCutilada(so) - 1000 / (1.55 * 0.8 * 1.31)) <= 1, `${daCutilada(so)}`);
  // Com +40% global no anel: 1000 / (1,55 × 0,80 × (1 + 0,40 + 0,31)) = 472 — antes 1,40 × 1,31 = 440.
  const anel = peca('Rings/Iron_Ring', [{ modelo: VELOCIDADE, valor: 40 }]);
  const comAnel = montar({ arma: peca('One_Hand_Swords/Rusted_Sword'), anel, gema: 'Cleave', suportes: ['Faster_Attacks_Support'] });
  assert.equal(Ficha.combate(comAnel).velocidadeDeAtaque, 40);
  const esperado = 1000 / (1.55 * 0.8 * 1.71);
  assert.ok(Math.abs(daCutilada(comAnel) - esperado) <= 1, `Cutilada: ${daCutilada(comAnel)} ms (PoE ${esperado.toFixed(1)}; antes 440)`);
  const medido = cacar(comAnel, 'Cleave');
  assert.ok(medido.difs.every((d) => d === daCutilada(comAnel)), `na caçada: ${[...new Set(medido.difs)].join(', ')}`);
  // A magia: Conjuração Acelerada (o "aumentada" dela) + 25% de Velocidade de Conjuração no anel, na Bola de Fogo — somam.
  const fogo = montar({ classe: 'Witch', arma: peca('Wands/Driftwood_Wand'), anel: peca('Rings/Iron_Ring', [{ modelo: CONJURACAO, valor: 25 }]), gema: 'Fireball', suportes: ['Faster_Casting_Support'] });
  const conj = GS.efeitoNaSkill(fogo, GP.doSlug('Fireball').acao).velConjuracaoPct;
  assert.ok(conj > 0, 'Conjuração Acelerada dá velocidade de conjuração aumentada');
  const usoFogo = Acoes.temposDaGemaPoe(fogo, entryDe('Fireball')).uso;
  assert.ok(Math.abs(usoFogo - 750 / (1 + (25 + conj) / 100)) <= 1, `Bola de Fogo: ${usoFogo} ms (750 / (1 + ${25 + conj}%))`);
  assert.ok(cacar(fogo, 'Fireball').casts.every((ms) => ms === usoFogo), 'a conjuração na caçada é a do balão');
  // O "mais" (Ataques Múltiplos: "N% mais Velocidade de Ataque Corpo a Corpo") continua multiplicando por cima da global.
  const multi = montar({ arma: peca('One_Hand_Swords/Rusted_Sword'), anel: peca('Rings/Iron_Ring', [{ modelo: VELOCIDADE, valor: 40 }]), gema: 'Cleave', suportes: ['Multistrike_Support'] });
  const mais = Number(SP.textosDoNivel(SP.doSlug('Multistrike_Support').suporte, 10).mods.join(' ').match(/(\d+)% mais Velocidade de Ataque Corpo a Corpo/)[1]);
  assert.ok(Math.abs(daCutilada(multi) - 1000 / (1.55 * 1.4 * 0.8 * (1 + mais / 100))) <= 1, `Cutilada com Ataques Múltiplos (${mais}% mais): ${daCutilada(multi)}`);
});

test('4. DUAS ARMAS: a gema de ataque alterna as mãos (cada uso com o dano da sua arma); a Cutilada combina 60% das duas armas', { skip: SEM }, () => {
  const principal = () => peca('One_Hand_Swords/Rusted_Sword'); // 4–9
  const forte = () => peca('Thrusting_One_Hand_Swords/Battered_Foil'); // 11–20
  /** A faixa-base de cada uso da gema (o registro do golpe, nível 2), na ordem. */
  const faixas = (e, slug) => {
    const antes = Registro.nivelDoRegistro();
    Registro.definirNivel(2);
    Registro.limparRegistro();
    try {
      cacar(e, slug, { segundos: 10 });
      const acao = GP.doSlug(slug).acao;
      return Registro.ultimosGolpes(400).filter((g) => g.origem === 'gema' && g.habilidade === acao).map((g) => `${g.detalhe.min}–${g.detalhe.max}`);
    } finally {
      Registro.limparRegistro();
      Registro.definirNivel(antes);
    }
  };
  // A Pancada alterna: com a Rusted Sword na principal e a Battered Foil na secundária, os usos se revezam entre a faixa de cada arma sozinha.
  const soPrincipal = new Set(faixas(montar({ arma: principal(), gema: 'Heavy_Strike' }), 'Heavy_Strike'));
  const soForte = new Set(faixas(montar({ arma: forte(), gema: 'Heavy_Strike' }), 'Heavy_Strike'));
  assert.equal(soPrincipal.size, 1);
  assert.equal(soForte.size, 1);
  const [p] = soPrincipal;
  const [s] = soForte;
  assert.notEqual(p, s);
  const dupla = faixas(montar({ arma: principal(), segunda: forte(), gema: 'Heavy_Strike' }), 'Heavy_Strike');
  assert.ok(dupla.length >= 6, `${dupla.length} usos`);
  assert.deepEqual(new Set(dupla), new Set([p, s]), `as duas mãos aparecem: ${dupla.join(' · ')}`);
  assert.ok(dupla.every((f, i) => i === 0 || f !== dupla[i - 1]), `alterna a cada uso: ${dupla.join(' · ')} (antes: sempre ${p})`);
  // O balão de uma gema que alterna mostra a mão principal.
  assert.deepEqual(Acoes.danoMostrado(montar({ arma: principal(), segunda: forte(), gema: 'Heavy_Strike' }), entryDe('Heavy_Strike')), Acoes.danoMostrado(montar({ arma: principal(), gema: 'Heavy_Strike' }), entryDe('Heavy_Strike')));
  // A Cutilada: "Quando em Dupla Empunhadura, Causa 60 % do Dano combinando cada Arma" — 60% de (principal + secundária), em todo uso.
  assert.equal(GP.danoComAsDuasArmas('Cleave'), 60);
  assert.equal(GP.danoComAsDuasArmas('Whirling_Blades'), 75);
  assert.equal(GP.danoComAsDuasArmas('Dual_Strike'), 100);
  assert.equal(GP.danoComAsDuasArmas('Heavy_Strike'), null);
  const base = (f) => f.split('–').map(Number);
  const [a] = new Set(faixas(montar({ arma: principal(), gema: 'Cleave' }), 'Cleave'));
  const [b] = new Set(faixas(montar({ arma: forte(), gema: 'Cleave' }), 'Cleave'));
  const cutiladas = new Set(faixas(montar({ arma: principal(), segunda: forte(), gema: 'Cleave' }), 'Cleave'));
  assert.equal(cutiladas.size, 1, `a Cutilada não alterna: ${[...cutiladas].join(' · ')}`);
  const [c] = cutiladas;
  for (const i of [0, 1]) assert.ok(Math.abs(base(c)[i] - 0.6 * (base(a)[i] + base(b)[i])) <= 1, `Cutilada com as duas: ${c} ≈ 60% de (${a}) + (${b}); antes ${a}`);
});
