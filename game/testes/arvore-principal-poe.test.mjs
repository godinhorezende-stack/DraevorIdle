// A ÁRVORE PRINCIPAL (dono, 14/10: o próximo bloco do item 4, "Árvore principal"): o Poder Arcano (a Maestria de Varinhas), o Coveiro
// (Profanar e Desenterrar criam cadáveres), o Infestador (o Valor Máximo da Praga) e o Feiticeiro (a reserva das magias suportadas) — e as
// gemas que faltavam para essas linhas valerem: o Infestador e o Feiticeiro, com os números do PoE (RePoE/poedb).
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
const Reserva = await import('../systems/itens-poe/reserva.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { resistido } = await import('../systems/hunt/resistencia.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/**
 * Um personagem do PoE numa caçada com a arma `base` (`af` nela) e as `gemas` (nível 20) encaixadas nela, todas LIGADAS; `naBarra`: as gemas
 * que vão para a barra.
 */
function personagem({ base = 'Wands/Driftwood_Wand', af = {}, gemas = [], naBarra = gemas } = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = peca(base);
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  const n = Math.max(1, gemas.length);
  arma.soquetes = { abertos: n, links: Array(Math.max(0, n - 1)).fill(true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < gemas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  naBarra.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 10_000;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
/** Um bicho da caçada a `dx` casas do personagem (os outros, longe), com vida de sobra. */
function bichoPerto(e, dx = 1) {
  const [b, ...outros] = e.hunt.monstros;
  for (const o of outros) Object.assign(o, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y, z: e.hunt.z, hp: 1e9, maxHp: 1e9, estados: {}, dots: [] });
  return b;
}

test('a ÁRVORE: a árvore principal sem nenhuma linha sem efeito (o Poder Arcano, o Coveiro, o Infestador e o Feiticeiro)', { skip: SEM }, () => {
  const linhas = P.arvore().nos.filter((n) => !n.ascendencia).flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i], nota: o.notas?.[i] ?? '' }))));
  const do19 = linhas.filter((l) => /Poder Arcano ao usar|Portador da Praga|Profanar e Desenterrar|Suportadas por Feiticeiro/.test(l.t));
  assert.equal(do19.length, 13);
  for (const l of do19) assert.equal(l.estado, 'novo', l.t);
  const semEfeito = linhas.filter((l) => ['inerte', 'registrado'].includes(l.estado) && !/^não se aplica ao jogo/.test(l.nota));
  assert.deepEqual(semEfeito.map((l) => l.t), []);
});

test('o PODER ARCANO: "Ataques têm 100% de Poder Arcano ao usar uma varinha" — o Dano Mágico aumentado também no ataque, só com varinha; o dos únicos, no % dele', { skip: SEM }, () => {
  const fisico = (e, tags) => ModsPoe.fichaDoGolpe(ficha(e), tags).danoDoElemento?.physical ?? 0;
  const ataque = ['ataque', 'projetil', 'fisico'];
  const sem = personagem({ af: { spell_dmg: 50 } });
  const com = personagem({ af: { spell_dmg: 50, 'poder_arcano@ataque+comVarinha': 100 } });
  const magico = ficha(com).danoDeMagiaDoPoe;
  assert.equal(magico, 50, 'o Dano Mágico aumentado da varinha do teste');
  assert.equal(fisico(com, ataque) - fisico(sem, ataque), magico, '100% do Dano Mágico aumentado');
  assert.equal(fisico(com, ['magia', 'fisico']) - fisico(sem, ['magia', 'fisico']), 0, 'só nos ataques');
  // (sem varinha, nada)
  const machado = personagem({ base: 'Two_Hand_Axes/Vaal_Axe', af: { spell_dmg: 50, 'poder_arcano@ataque+comVarinha': 100 } });
  const machadoSem = personagem({ base: 'Two_Hand_Axes/Vaal_Axe', af: { spell_dmg: 50 } });
  assert.equal(fisico(machado, ['ataque', 'corpo', 'fisico']) - fisico(machadoSem, ['ataque', 'corpo', 'fisico']), 0);
  // (o dos únicos: "Ataques têm 150% de Poder Arcano", com qualquer arma)
  const unico = personagem({ base: 'Two_Hand_Axes/Vaal_Axe', af: { spell_dmg: 50, 'poder_arcano@ataque': 150 } });
  assert.equal(fisico(unico, ['ataque', 'corpo', 'fisico']) - fisico(machadoSem, ['ataque', 'corpo', 'fisico']), 75);
});

test('o COVEIRO: Profanar cria 5 cadáveres dos monstros da área e Desenterrar 1 Arqueiro de Ossos; até 10 de cada gema (+2 com o nó); os mortos guardam os 10 deles', { skip: SEM }, () => {
  const e = personagem({ gemas: ['Desecrate'] });
  const h = e.hunt;
  const b = bichoPerto(e, 3);
  h.cadaveres = [];
  // (pela barra: a magia no alvo)
  h.clock += 10_000;
  const r = Acoes.disparar(e, h, PERSONAGEM, 0, b, {});
  if (r.conjurando) { h.clock += 3000; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
  const criados = h.cadaveres.filter((c) => c.criadoPor === 'Desecrate');
  assert.equal(criados.length, 5, JSON.stringify(r).slice(0, 200));
  for (const c of criados) assert.ok(Math.abs(c.x - b.x) <= 1 && Math.abs(c.y - b.y) <= 1, 'em volta do alvo');
  assert.ok(criados.every((c) => c.nivel === Math.min(80, h.escala?.nivel ?? e.level)), 'o nível da área, até 80');
  assert.ok(!G.doSlug('Desecrate').motivosNoJogo.some((m) => /cadáver|Corpos Criados/.test(m)), JSON.stringify(G.doSlug('Desecrate').motivosNoJogo));
  // (o teto: 10; o mais velho sai)
  Acoes.criarCadaveres(e, h, 'Desecrate', 20, b);
  Acoes.criarCadaveres(e, h, 'Desecrate', 20, b);
  assert.equal(h.cadaveres.filter((c) => c.criadoPor === 'Desecrate').length, 10);
  // (Desenterrar: um Arqueiro de Ossos, nível 70 no nível 20 da gema; o teto é dele)
  Acoes.criarCadaveres(e, h, 'Unearth', 20, b);
  const arqueiro = h.cadaveres.filter((c) => c.criadoPor === 'Unearth');
  assert.equal(arqueiro.length, 1);
  assert.equal(arqueiro[0].nome, 'Arqueiro de Ossos');
  assert.equal(arqueiro[0].nivel, 70);
  // (o Coveiro: +2)
  e.equipment.weapon.poe.af.cadaveres_max_criados = 2;
  Ficha.invalidar(e);
  Acoes.criarCadaveres(e, h, 'Desecrate', 20, b);
  assert.equal(h.cadaveres.filter((c) => c.criadoPor === 'Desecrate').length, 12);
  // (os mortos: os 10 mais recentes deles, sem tirar os criados)
  h.cadaveres.push(...Array.from({ length: 10 }, (_, i) => ({ key: 'rat', nome: `morto${i}`, x: 1, y: 1 })));
  const morto = h.monstros.find((m) => m !== b);
  morto.hp = 0;
  const { processarMortes } = await_combate;
  processarMortes(e, PERSONAGEM, []);
  assert.equal(h.cadaveres.filter((c) => !c.criadoPor).length, 10);
  assert.ok(!h.cadaveres.some((c) => c.nome === 'morto0'), 'o morto mais velho saiu');
  assert.equal(h.cadaveres.filter((c) => c.criadoPor === 'Desecrate').length, 12);
});
const await_combate = await import('../systems/hunt/combate.mjs');

test('o INFESTADOR: na barra, Incuba (40% do dano esperado de cada Veneno, 20% menos Veneno fora do máximo); no máximo (× "Valor Máximo aumentado") com inimigo perto, Infesta (12% do Valor por segundo como Caos a até 2 casas) até acabar', { skip: SEM }, () => {
  assert.equal(G.doSlug('Plague_Bearer').statusNoJogo, 'parcial');
  assert.equal(G.maxDaPraga(1), 4000);
  assert.equal(G.maxDaPraga(20), 1_000_000);
  const e = personagem({ gemas: ['Plague_Bearer'], af: { praga_max: 20 } });
  const h = e.hunt;
  const b = bichoPerto(e, 2);
  const t0 = h.clock;
  Acoes.tiqueDaPraga(e, h, 250, t0);
  assert.equal(h.praga.modo, 'incubando');
  assert.equal(h.praga.max, 1_200_000, '1.000.000 do nível 20 × 1,2');
  // (a barra não usa: ela alterna sozinha)
  assert.equal(Acoes.disparar(e, h, PERSONAGEM, 0, b, {}).motivo, 'SOZINHA');
  // (o Veneno Incubando: 20% menos, e 40% do total no Valor)
  const afeccoes = AfeccoesPoe.daSoma({ chance_poison: 100 });
  const sem = { ...b, dots: [], estados: {} };
  AfeccoesPoe.aoAcertar(sem, [{ elemento: 'physical', dano: 1000 }], { afeccoes, agora: t0, rng: () => 0.5 });
  const totalSem = sem.dots.find((d) => d.tipo === 'venenoPoe').falta;
  const com = { ...b, dots: [], estados: {} };
  AfeccoesPoe.aoAcertar(com, [{ elemento: 'physical', dano: 1000 }], { afeccoes, agora: t0, rng: () => 0.5, praga: Acoes.pragaDoAcerto(h) });
  const totalCom = com.dots.find((d) => d.tipo === 'venenoPoe').falta;
  assert.ok(Math.abs(totalCom - totalSem * 0.8) < 1e-6, `${totalCom} = 80% de ${totalSem}`);
  assert.ok(Math.abs(h.praga.valor - totalCom * 0.4) < 1e-6);
  // (no máximo: o Veneno sem o "menos"; sem inimigo perto, segue Incubando)
  h.praga.valor = h.praga.max;
  assert.equal(Acoes.pragaDoAcerto(h).menosPct, 0);
  Object.assign(b, { x: h.pos.x + 3 });
  Acoes.tiqueDaPraga(e, h, 250, t0 + 250);
  assert.equal(h.praga.modo, 'incubando', 'ninguém a até 2 casas');
  Object.assign(b, { x: h.pos.x + 2 });
  const longe = h.monstros.find((m) => m !== b);
  Object.assign(longe, { x: h.pos.x + 3, y: h.pos.y, z: h.z, hp: 1e9, maxHp: 1e9 });
  Acoes.tiqueDaPraga(e, h, 250, t0 + 500);
  assert.equal(h.praga.modo, 'infestando');
  assert.equal(h.praga.inicio, 1_200_000);
  const f = ficha(e);
  const eventos = Acoes.tiqueDaPraga(e, h, 250, t0 + 750);
  const porTique = (1_200_000 * 0.12) / 4;
  assert.equal(1e9 - b.hp, Math.round(resistido(h, b, 'chaos', porTique, f)), 'Caos pela resistência, sem os seus modificadores');
  assert.equal(longe.hp, 1e9, 'a 3 casas, não');
  assert.equal(eventos.filter((x) => x.t === 'dmg').length, 1);
  assert.ok(Math.abs(h.praga.valor - (1_200_000 - porTique)) < 1e-6, 'perde o Valor na mesma medida');
  // (acabou: volta a Incubar — 100 / 12 ≈ 8,33 s)
  for (let t = 1; t <= 40; t++) Acoes.tiqueDaPraga(e, h, 250, t0 + 750 + t * 250);
  assert.equal(h.praga.modo, 'incubando');
  assert.equal(h.praga.valor, 0);
  // (o HUD)
  assert.ok(ModsPoe.buffsDoCliente(e).some((c) => c.nome === 'Incubando' && c.contador === 0));
  // (fora da barra: sai)
  e.actions[0] = null;
  Acoes.tiqueDaPraga(e, h, 250, t0 + 20_000);
  assert.equal(h.praga, undefined);
});

test('o FEITICEIRO: liga reservando 20% por magia ligada (÷ a eficácia da maestria); o ataque de varinha ativa as magias ligadas (sem custo, recarga 0,6 s ÷ 1,38); as magias levam 174% do dano da varinha e 20% menos dano', { skip: SEM }, () => {
  assert.equal(G.doSlug('Spellslinger').statusNoJogo, 'funciona');
  assert.deepEqual(G.feiticeiroNoNivel(20), { pct: 174, menos: 20, recuperacao: 38, recargaMs: Math.round(600 / 1.38) });
  assert.equal(G.feiticeiroNoNivel(1).pct, 60);
  assert.equal(G.feiticeiroNoNivel(1).menos, 30);
  const e = personagem({ gemas: ['Spellslinger', 'Fireball', 'Hatred'], naBarra: ['Spellslinger'], af: { eficiencia_reserva_feiticeiro: 25 } });
  const h = e.hunt;
  const ativas = GS.skillsAtivas(e);
  assert.deepEqual(ativas.get('poe-gema:Fireball').feiticeiro, { nivel: 20 });
  assert.equal(ativas.get('poe-gema:Hatred').feiticeiro, undefined, 'a aura (reserva) não');
  assert.equal(ativas.get('poe-gema:Spellslinger').magiasDoFeiticeiro, 1);
  assert.equal(GS.ativadaPor(e, 'poe-gema:Fireball'), 'Feiticeiro', 'a magia ligada só sai pelo gatilho');
  // (a reserva: 20% × 1 magia ÷ 1,25)
  const entry = Acoes.POR_ID_PUBLICO('poe-gema:Spellslinger');
  const pedida = Reserva.pedida(e, entry, GS.efeitoNaSkill(e, entry.id), ficha(e));
  assert.equal(pedida.pct, 20);
  assert.equal(pedida.valor, Math.ceil(10_000 * 0.2 * 0.8));
  // (desligado, o ataque de varinha não ativa nada)
  const b = bichoPerto(e, 2);
  assert.equal(Acoes.ehAtaqueDeVarinha(e), true);
  assert.equal(Acoes.ativarGatilhos(e, h, PERSONAGEM, 'ataqueDeVarinha', { alvo: b }, []), 0);
  // (liga pela barra)
  h.clock += 10_000;
  const r = Acoes.disparar(e, h, PERSONAGEM, 0, b, {});
  assert.ok(r.ok, JSON.stringify(r).slice(0, 200));
  assert.equal(h.buffs['poe-gema:Spellslinger'].reserva.pct, 20);
  const mana = e.mana;
  const eventos = [];
  assert.equal(Acoes.ativarGatilhos(e, h, PERSONAGEM, 'ataqueDeVarinha', { alvo: b }, eventos), 1);
  assert.ok(eventos.some((x) => x.t === 'gatilho' && x.suporte === 'Feiticeiro'));
  assert.equal(e.mana, mana, 'sem custo: virou reserva');
  assert.equal(Acoes.ativarGatilhos(e, h, PERSONAGEM, 'ataqueDeVarinha', { alvo: b }, []), 0, 'na recarga');
  h.clock += Math.round(600 / 1.38);
  assert.equal(Acoes.ativarGatilhos(e, h, PERSONAGEM, 'ataqueDeVarinha', { alvo: b }, []), 1, 'passada a recarga');
  // (o dano: + 174% do dano da varinha × a eficácia, e 20% menos)
  const bola = Acoes.POR_ID_PUBLICO('poe-gema:Fireball');
  const efeito = GS.efeitoNaSkill(e, bola.id);
  const semF = Acoes.danoMostrado(e, bola, { ...efeito, feiticeiro: undefined });
  const comF = Acoes.danoMostrado(e, bola, efeito);
  const varinha = ficha(e).danoDasVarinhas.physical;
  assert.deepEqual(varinha, [5, 9], 'a Varinha de Madeira Balsa');
  const base = G.danoNoNivel('Fireball', 20);
  const fator = semF.max / base.max;
  const eficacia = G.eficaciaNoNivel('Fireball', 20);
  assert.ok(Math.abs(comF.max - (base.max + 9 * 1.74 * eficacia) * fator * 0.8) <= 2, `${comF.max} ~ ${(base.max + 9 * 1.74 * eficacia) * fator * 0.8}`);
  // (sem varinha, o ataque não é de varinha)
  e.equipment.weapon = peca('Two_Hand_Axes/Vaal_Axe');
  Ficha.invalidar(e);
  assert.equal(Acoes.ehAtaqueDeVarinha(e), false);
});

test('o FEITICEIRO na caçada: com ele ligado, o golpe básico de varinha ativa a magia ligada', { skip: SEM }, () => {
  const e = personagem({ gemas: ['Spellslinger', 'Fireball'], naBarra: ['Spellslinger'] });
  const h = e.hunt;
  const b = bichoPerto(e, 2);
  let t = Date.now();
  const eventos = [];
  for (let i = 0; i < 40 && !eventos.some((x) => x.t === 'gatilho'); i++) eventos.push(...Cacadas.tique(e, PERSONAGEM, (t += 250)));
  assert.ok(h.buffs['poe-gema:Spellslinger']?.reserva, 'ligou pela barra');
  const g = eventos.find((x) => x.t === 'gatilho');
  assert.ok(g, JSON.stringify(eventos.map((x) => x.t)).slice(0, 300));
  assert.equal(g.suporte, 'Feiticeiro');
  assert.ok(b.hp < 1e9, 'a magia acertou');
});

test('o INFESTADOR na caçada: o tique liga a Incubação e o Veneno do golpe enche o Valor da Praga', { skip: SEM }, () => {
  const e = personagem({ gemas: ['Plague_Bearer'], af: { chance_poison: 100 } });
  const h = e.hunt;
  bichoPerto(e, 2);
  let t = Date.now();
  for (let i = 0; i < 40 && !(h.praga?.valor > 0); i++) Cacadas.tique(e, PERSONAGEM, (t += 250));
  assert.equal(h.praga?.modo, 'incubando');
  assert.ok(h.praga.valor > 0, 'o Veneno do golpe básico pôs Valor');
});
