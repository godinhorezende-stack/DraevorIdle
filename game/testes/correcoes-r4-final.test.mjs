// (rodada 4 das gemas, etapa final — 28/10) Os achados das conferências C1–C3 corrigidos pela regra do PoE ou do PoB:
//   - o limite da Animar Arma Vaal: 9 no nível 1, 44 no 10 e 100 no 20, como a comum (o PoB, VaalAnimateWeapon: animate_item_maximum_level_requirement; o 40 da linha
//     embaralhada do poedb é o vaal_animate_weapon_minimum_level_requirement);
//   - a Legião Congelada: o SEU uso é a magia do PoB (castTime 0,7 pela Velocidade de Conjuração); cada Estátua acerta depois do tempo de um Arrastão — o seu ataque
//     com a arma ÷ os 70% dele;
//   - a troca à mão do Infestador pela regra do custo (`fatorDoCustoDeMana`) e pelo recurso (a Magia Sanguínea paga com a Vida; o "não custa Mana" zera);
//   - o raio do Flagelo Celestial com a qualidade em décimos de metro (+0,01 m por ponto);
//   - o Pacto de Ghorr parcial, com o motivo (o PoB faz mais do que o jogo; falta fonte para o Destruir Carne);
//   - a Bomba Congelante plantada por armadilha também espera a explosão;
//   - o Flagelo do Lycia só gasta o raio que cai num inimigo;
//   - o "mais" local multiplicando entre suportes e com o da gema; a Tentação Vaal com o canalizar que continua;
//   - o impedimento na Vaal que saiu pela carga que pula a recarga; a Chuva de Flechas da Artilharia com outro sorteio; o cone do Aço Estraçalhador da Munição.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEM, G, GS, Acoes, Ficha, montar, usar, danoEm, golpesEm, perto, travado } from './gemas-t2-apoio.mjs';

const A = await import('../systems/itens-poe/lacaios-animados.mjs');
const C2 = await import('../systems/itens-poe/gemas-r4c2.mjs');
const T1 = await import('../systems/itens-poe/gemas-t1.mjs');
const P4 = await import('../systems/itens-poe/gemas-p4.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { PERSONAGEM } = await import('./apoio.mjs');

const VARINHA = 'Wands/Driftwood_Wand';
/** O tique dos objetos até `ms` depois, de `passo` em `passo` ms (com o sorteio `v`). */
function andar(e, ms, passo = 50, v = 0.5) {
  const ev = [];
  travado(v, () => { for (let t = 0; t < ms; t += passo) { e.hunt.clock += passo; Acoes.tiqueDosObjetos(e, e.hunt, PERSONAGEM, ev, e.hunt.clock); } });
  return ev;
}
/** Põe os monstros `ms` nas casas `[dx, dy]` relativas a você (imortais, sem estados). */
function posicionar(e, ms, casas) {
  ms.forEach((m, i) => Object.assign(m, { x: e.hunt.pos.x + casas[i][0], y: e.hunt.pos.y + casas[i][1], hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} }));
}
/** Um anel com os atributos `af` (o caminho das peças do PoE). */
function anel(e, af) {
  e.equipment.ring = { id: 0, count: 1, af: [], poe: { af } };
  Ficha.invalidar(e);
}

// ---------------------------------------------------------------- a Animar Arma Vaal

test('R4 final: o limite da Animar Arma Vaal é o da comum — 9 no 1, 44 no 10, 100 no 20 (o PoB); a Vaal 20 anima uma base acima do 40', { skip: SEM }, () => {
  const lim = (s, n) => A.limiteDeNivel(G.textosDaGema(s, n).linhas);
  assert.deepEqual([1, 10, 20].map((n) => lim('Vaal_Animate_Weapon', n)), [9, 44, 100]);
  assert.deepEqual([1, 10, 20].map((n) => lim('Animate_Weapon', n)), [9, 44, 100]);
  const vaal = (n) => A.animadoDaGema('Vaal_Animate_Weapon', G.textosDaGema('Vaal_Animate_Weapon', n).linhas);
  const comum = (n) => A.animadoDaGema('Animate_Weapon', G.textosDaGema('Animate_Weapon', n).linhas);
  assert.ok(vaal(20).arma.nivel > 40 && vaal(20).arma.nivel <= 100, JSON.stringify(vaal(20).arma));
  assert.deepEqual(vaal(20).arma, comum(20).arma, 'a mesma base da comum');
  assert.ok(vaal(1)?.arma && vaal(1).arma.nivel <= 9, 'a Vaal 1 acha base (antes lia 1 e caía no dano da tabela)');
  assert.ok(vaal(10).arma.nivel <= 44 && vaal(10).arma.nivel > 6);
});

// ---------------------------------------------------------------- a Legião Congelada

test('R4 final: a Legião Congelada — o uso é a magia de 0,7 s do PoB; cada Estátua acerta depois de um Arrastão (o ataque da arma ÷ 0,7)', { skip: SEM }, async () => {
  const t = G.temposNoNivel('Frozen_Legion', 20);
  assert.deepEqual([t.usoComoMagia, t.conjuracaoMs, t.velArrastao], [true, 700, 70]);
  const { e, b } = await montar(['Frozen_Legion'], { arma: 'Two_Hand_Maces/Driftwood_Maul' });
  const id = G.doSlug('Frozen_Legion').acao;
  const entry = Acoes.POR_ID_PUBLICO(id);
  const f = Ficha.combate(e);
  const uso = Acoes.temposDaGemaPoe(e, entry, GS.efeitoNaSkill(e, id)).uso;
  assert.ok(Math.abs(uso - 700 / (1 + (f.castSpeed ?? 0) / 100)) <= 2, `o uso ${uso} ms (a conjuração, não o ataque da arma: ${f.intervaloDoGolpeMs} ms)`);
  const atraso = T1.atrasoDoArrastaoMs(f.intervaloDoGolpeMs);
  assert.equal(atraso, Math.round(f.intervaloDoGolpeMs / 0.7));
  const u = usar(e, 0, b);
  assert.ok(u.r.ok, JSON.stringify(u.r));
  const estatuas = (e.hunt.poeObjetos ?? []).filter((o) => o.tipo === 'estatuas');
  assert.equal(estatuas.length, 6);
  assert.ok(estatuas.every((o) => o.proxima - e.hunt.clock === atraso), `${estatuas.map((o) => o.proxima - e.hunt.clock)} ≠ ${atraso}`);
  assert.equal(golpesEm(andar(e, atraso - 50, 50), b).length, 0, 'antes do Arrastão, nada');
  assert.equal(golpesEm(andar(e, 100, 50), b).length, 6, 'as 6 Estátuas acertam');
});

// ---------------------------------------------------------------- o Infestador

test('R4 final: a troca à mão do Infestador pela regra do custo — a Magia Sanguínea paga com a Vida; o "não custa Mana" zera', { skip: SEM }, async () => {
  const { e } = await montar(['Plague_Bearer'], { arma: VARINHA });
  anel(e, { keystone_magia_sanguinea: 1 });
  assert.ok(ModsPoe.valor(Ficha.combate(e), 'keystone_magia_sanguinea') > 0);
  e.mana = 0;
  const hp0 = e.hp;
  const u = usar(e, 0, null);
  assert.ok(u.r.ok, JSON.stringify(u.r));
  assert.ok(e.hp < hp0, `a Vida pagou: ${hp0} → ${e.hp}`);
  assert.equal(e.mana, 0, 'a mana não entra');
  const { e: e2 } = await montar(['Plague_Bearer'], { arma: VARINHA });
  anel(e2, { sem_custo_mana: 1 });
  e2.mana = 0;
  assert.ok(usar(e2, 0, null).r.ok, 'sem custo: troca sem mana');
  e2.hunt.praga.valor = 1000;
  e2.hunt.clock += 1000;
  assert.ok(usar(e2, 0, null).r.ok);
  assert.equal(e2.hunt.praga.modo, 'infestando');
});

// ---------------------------------------------------------------- o Pacto de Lycia

test('R4 final: o Flagelo Celestial — o raio com a qualidade em décimos de metro (1,2 m → 1,4 m no q20); só o raio que cai num inimigo conta', { skip: SEM }, async () => {
  assert.ok(perto(C2.raioDoFlageloM(0), 1.2, 1e-9) && perto(C2.raioDoFlageloM(20), 1.4, 1e-9), String(C2.raioDoFlageloM(20)));
  const { e, b, resto } = await montar(['Pact_of_Lycia'], { arma: VARINHA, soltas: ['Incinerate'], qualidade: 20 });
  assert.ok(usar(e, 0, b).r.ok);
  e.hunt.clock += 5000;
  assert.ok(usar(e, 1, b).r.ok);
  const flagelo = (e.hunt.poeObjetos ?? []).find((o) => o.tipo === 'flageloLycia');
  assert.ok(flagelo, 'o Flagelo no canalizar fortalecido');
  assert.ok(perto(flagelo.raioM, 1.4, 1e-9), String(flagelo.raioM));
  // (canalizando, sem inimigo a até 7 m: o raio não sai e não gasta)
  posicionar(e, [b, ...resto], [[40, 0], ...resto.map((_, i) => [50 + i, 10])]);
  e.hunt.canalizacao.ate = e.hunt.clock + 60_000;
  const antes = flagelo.feitos;
  andar(e, 1000, 50);
  assert.equal(flagelo.feitos, antes, 'sem inimigo, nenhum gasto');
  assert.ok(flagelo.ate > e.hunt.clock, 'segue no canalizar');
  // (o inimigo volta: o raio cai e conta)
  posicionar(e, [b], [[1, 0]]);
  const ev = andar(e, 300, 50);
  assert.equal(flagelo.feitos, antes + 1);
  assert.ok(danoEm(ev, b) > 0);
  // (parado e sem inimigo perto: o Flagelo acaba, os que faltavam não caem)
  posicionar(e, [b], [[40, 0]]);
  e.hunt.canalizacao.ate = e.hunt.clock - 1000;
  andar(e, 200, 50);
  assert.ok(flagelo.ate <= e.hunt.clock && flagelo.feitos < 10, JSON.stringify({ feitos: flagelo.feitos, ate: flagelo.ate, clock: e.hunt.clock }));
});

// ---------------------------------------------------------------- o Pacto de Ghorr

test('R4 final: o Pacto de Ghorr fica parcial com o motivo (o PoB: o uso não fere, fortalece 3 magias degenerativas, a Fome de Ghorr) — decisão do dono', { skip: SEM }, () => {
  const r = G.REGISTRO.get('Pact_of_Ghorr');
  assert.equal(r.statusNoJogo, 'parcial');
  assert.ok(r.motivosNoJogo.some((m) => /o Pacto \(o PoB: o uso não causa dano; fortalece as próximas 3 magias degenerativas/.test(m) && /decisão do dono/.test(m)), r.motivosNoJogo.join(' | '));
});

// ---------------------------------------------------------------- a Bomba Congelante plantada

test('R4 final: a Bomba Congelante por armadilha também explode depois da duração (2 s) — o cristal no alvo da armadilha', { skip: SEM }, async () => {
  const { e, b } = await montar(['Frost_Bomb', 'Trap_Support'], { arma: VARINHA });
  // (o alvo colado: a armadilha arremessada já é ativada por ele no uso)
  const u = usar(e, 0, b);
  assert.ok(u.r.ok, JSON.stringify(u.r));
  const ev = [...u.ev];
  for (let i = 0; i < 4 && !(e.hunt.poeObjetos ?? []).some((o) => o.tipo === 'explosaoDivina'); i++) {
    e.hunt.clock += 100;
    ev.push(...travado(0.5, () => [...Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [])]));
  }
  const cristal = (e.hunt.poeObjetos ?? []).find((o) => o.tipo === 'explosaoDivina');
  assert.ok(cristal, 'a armadilha ativou e deixou o cristal');
  assert.equal(danoEm(ev, b), 0, 'a ativação da armadilha não fere na hora');
  assert.equal(cristal.proxima - e.hunt.clock, 2000);
  assert.equal(danoEm(andar(e, 1900, 100), b), 0, 'antes da duração, nada');
  assert.ok(danoEm(andar(e, 200, 100), b) > 0, 'a explosão');
  assert.equal(b.estados.exposicaoPct?.ice, 15, 'a Exposição na explosão');
});

// ---------------------------------------------------------------- o "mais" local e a Tentação Vaal

test('R4 final: o "mais/menos" local multiplica — entre suportes (o Destruição Controlada e o Desperto: 0,2 × 0,2) e com o da gema (o Golpe Duplo em Vida Cheia)', { skip: SEM }, async () => {
  const { e } = await montar(['Fireball', 'Controlled_Destruction_Support', 'Awakened_Controlled_Destruction_Support'], { arma: VARINHA });
  const ef = GS.efeitoNaSkill(e, G.doSlug('Fireball').acao);
  assert.ok(perto(ef['af:crit_mais_pct'], (0.2 * 0.2 - 1) * 100, 1e-9), `${ef['af:crit_mais_pct']} (a soma daria −160)`);
  // (com o da gema: o Golpe Duplo — "100% mais Chance de Acerto Crítico contra Inimigos em Vida Cheia" — e um suporte de −25% na mesma condição: 2 × 0,75 = 1,5)
  const { e: e2 } = await montar(['Dual_Strike'], { arma: 'One_Hand_Swords/Rusted_Sword' });
  const daGema = G.linhasLocaisNoNivel('Dual_Strike', 20, 0).af['crit_mais_pct@alvoVidaCheia'];
  assert.equal(daGema, 100);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Dual_Strike').acao);
  const base = GS.efeitoNaSkill(e2, entry.id);
  const f = Acoes.comAsLinhasDaGema(e2, Ficha.combate(e2), entry, { ...base, 'af:crit_mais_pct@alvoVidaCheia': -25 });
  const linha = (f.porTag ?? []).filter((x) => x.stat === 'crit_mais_pct' && x.tags.includes('alvoVidaCheia'));
  assert.deepEqual(linha.map((x) => x.valor), [50], 'multiplica (a soma daria 75)');
});

test('R4 final: a Tentação Vaal põe o degenerativo uma vez só — o estágio seguinte da Vaal canalizada (o canalizar que continua) não renova', { skip: SEM }, async () => {
  const { e, b } = await montar(['Vaal_Blight', 'Vaal_Temptation_Support'], { arma: VARINHA });
  const u0 = usar(e, 0, b);
  assert.ok(u0.r.ok, JSON.stringify(u0.r));
  assert.ok(e.hunt.canalizacao, 'a Praga Vaal canaliza');
  const dots = () => (e.hunt.efeitosDoJogador?.dots ?? []).filter((x) => x.chave === 'tentacaoVaal');
  assert.equal(dots().length, 1, 'o dano da Tentação no uso');
  const { desde, ate } = dots()[0];
  let estagios = 0;
  for (let i = 0; i < 5; i++) {
    e.hunt.clock += 100;
    if (usar(e, 0, b).r.ok) estagios++;
  }
  assert.ok(estagios >= 3, `a canalização seguiu (${estagios} estágios)`);
  assert.equal(dots().length, 1, 'um degenerativo só');
  assert.deepEqual([dots()[0].desde, dots()[0].ate], [desde, ate], 'não renovou');
});

// ---------------------------------------------------------------- o impedimento, a Artilharia e o Aço da Munição

test('R4 final: o impedimento — a Vaal que saiu pela carga que pula a recarga (a recarga não começou agora) anda só o pedaço novo', () => {
  // (a recarga de "a" começou em −1000 (ate − total), não no uso em 1000: o impedimento anterior até 3000 já a parou; o novo vai até 5000 — anda 2000, não 4000)
  const hunt = { clock: 1000, poeAlmasImpedidasAte: 3000 };
  const cds = { a: { ate: 5000, total: 6000 }, b: { ate: 9000, total: 9000 } };
  assert.equal(P4.impedirAlmas(hunt, cds, ['a', 'b'], 1000, 4000, 'a'), 2000);
  assert.deepEqual([cds.a.ate, cds.b.ate, hunt.poeAlmasImpedidasAte], [7000, 11_000, 5000]);
});

test('R4 final: a Chuva de Flechas da Artilharia — com o sorteio abaixo da fração (1 m = 0,5 casa), cada flecha pega a casa vizinha: o alvo e o da 1ª casa levam 11', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Rain_of_Arrows_of_Artillery'], { arma: 'Bows/Crude_Bow' });
  const [perto1, fora] = resto;
  posicionar(e, [b, perto1, fora], [[4, 0], [1, 0], [2, 3]]);
  const { r, ev } = usar(e, 0, b, 0.1);
  assert.ok(r.ok, JSON.stringify(r));
  // (as 22 flechas nas casas 1 a 4: 6, 5, 6, 5 — com raio 1, o da casa 4 leva as da 3 e da 4 (6 + 5); o da casa 1, as da 1 e da 2 (6 + 5))
  assert.equal(golpesEm(ev, b).length, 11);
  assert.equal(golpesEm(ev, perto1).length, 11);
  assert.equal(golpesEm(ev, fora).length, 0, 'a 3 casas da linha, fora');
});

test('R4 final: o Aço Estraçalhador da Munição também despedaça no cone à frente do acertado', { skip: SEM }, async () => {
  assert.ok(C2.temConeDoAco('Shattering_Steel_of_Ammunition'));
  const { e, b, resto } = await montar(['Shattering_Steel_of_Ammunition']);
  const [atras, lado] = resto;
  posicionar(e, [b, atras, lado], [[2, 0], [3, 0], [2, 4]]);
  const { r, ev } = usar(e, 0, b, 0.5);
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(golpesEm(ev, atras).length >= 1, 'o de trás leva o cone');
  assert.ok(ev.some((x) => x.t === 'area'), 'o cone na tela');
});
