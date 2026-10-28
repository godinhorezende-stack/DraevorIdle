// (C3 da rodada 4 das gemas, 28/10 — dono: "quero resolver") Os achados das revisões adversariais da rodada 4 (lotes P4, T1, T2, T3) corrigidos aqui:
//   - o Impedimento de Ganho de Almas vem uma vez só, no uso: o estágio seguinte de uma Vaal canalizada não o renova (antes andava ~250 ms por estágio a recarga de
//     TODAS as Vaal da barra);
//   - com impedimentos sobrepostos, a Vaal recém-usada só carrega no fim do impedimento que vale (antes carregava dentro do impedimento de antes);
//   - os Duplos do Golpe Duplo Vaal não são "Lacaios Danificáveis": não são alvo de Vínculo (antes o Duplo que sumia matava o personagem pelo "o alvo vinculado
//     morreu") nem contam como "lacaio em campo" para as Oferendas;
//   - o "+1 ao Nível das Gemas de Habilidade de Golpes Suportadas" (o Dano Propagado Desperto) vale nas gemas com a tag "Golpear" (antes procurava "Golpe", nunca valia); o
//     de Gelo / Raio / Maldição só nas gemas com a tag;
//   - o "mais/menos Duração" de suportes diferentes multiplica (o Menos Duração com o Sofrimento Veloz), e o "mais" local (`af:`) também, entre suportes e com o da gema;
//   - a explosão da Anomalia Cinética da Chuva Cinética não é projétil (o PoB: KineticRainKineticInstability, baseFlags attack/area/duration): o "menos Dano de Projétil"
//     dos Projéteis Múltiplos não vale nela; e o teto das anomalias é de cada habilidade (as da Chuva e as do Fluxo Cinético não se cortam);
//   - o "Multiplicador de Custo & Reserva" pela coluna "Mana" da tabela (a Transfusão no 20: 320%, não os 430% da faixa estendida);
//   - a troca à mão do Infestador custa a mana da gema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEM, G, GS, SP, Acoes, Ficha, montar, usar, danoEm, golpesEm, perto } from './gemas-t2-apoio.mjs';

const P4 = await import('../systems/itens-poe/gemas-p4.mjs');
const R3c = await import('../systems/itens-poe/gemas-r3c.mjs');
const Vinculos = await import('../systems/itens-poe/vinculos.mjs');

const tagsDe = (slug) => ({ tags: (G.doSlug(slug).gema?.tags ?? G.doSlug(slug).tags ?? []).map((t) => (String(t).startsWith('poe:') ? t : `poe:${t}`)) });
const efPara = (sup, nivel, ativa, q = 0) => SP.efeitoNoNivel(sup, nivel, q, tagsDe(ativa)).efeito;

// ---------------------------------------------------------------- o Impedimento de Ganho de Almas

test('C3 (P4): impedimentos sobrepostos — a Vaal recém-usada só carrega no fim do impedimento que vale (o de antes, se acaba depois)', { skip: SEM }, async () => {
  // (as contas: a Bola de Fogo Vaal em 160 000 impede até 164 000; o Arco Vaal em 161 750, impedimento de 2 s — fim 163 750, dentro do anterior)
  const hunt = { clock: 161_750, poeAlmasImpedidasAte: 164_000 };
  const cds = { arc: { ate: 167_750, total: 6000 }, fb: { ate: 175_000, total: 11_000 } };
  assert.equal(P4.impedirAlmas(hunt, cds, ['arc', 'fb'], 161_750, 2000, 'arc'), 0, 'nada de novo no impedimento');
  assert.equal(cds.arc.ate, 164_000 + 6000, 'o Arco começa a carregar só em 164 000');
  assert.equal(cds.fb.ate, 175_000, 'a Bola de Fogo, que já tinha sido parada, não anda');
  assert.equal(hunt.poeAlmasImpedidasAte, 164_000);
  // (o novo vai além do anterior: a recém-usada anda o impedimento inteiro dela; a outra, só o pedaço novo)
  const h2 = { clock: 1000, poeAlmasImpedidasAte: 3000 };
  const c2 = { a: { ate: 6000, total: 5000 }, b: { ate: 9000, total: 9000 } };
  assert.equal(P4.impedirAlmas(h2, c2, ['a', 'b'], 1000, 4000, 'a'), 2000);
  assert.deepEqual([c2.a.ate, c2.b.ate, h2.poeAlmasImpedidasAte], [10_000, 11_000, 5000]);

  // (de ponta a ponta: a Bola de Fogo Vaal — impedimento 4 s — e, 1,75 s depois, o Arco Vaal — 2 s)
  const { e, b } = await montar(['Vaal_Fireball'], { soltas: ['Vaal_Arc'], arma: 'Wands/Driftwood_Wand' });
  const arc = G.doSlug('Vaal_Arc').acao;
  assert.ok(usar(e, 0, b).r.ok);
  const fimFb = e.hunt.poeAlmasImpedidasAte;
  assert.ok(fimFb > e.hunt.clock);
  e.hunt.clock = fimFb - 2250;
  const u = usar(e, 1, b);
  assert.ok(u.r.ok, JSON.stringify(u.r));
  assert.equal(e.hunt.poeAlmasImpedidasAte, fimFb, 'o do Arco acaba antes: vale o da Bola de Fogo');
  const cd = e.hunt.cooldowns[arc];
  assert.equal(cd.ate - cd.total, fimFb, 'a recarga do Arco começa no fim do impedimento da Bola de Fogo');
});

test('C3 (P4): a Vaal canalizada impede uma vez só — os estágios seguintes não renovam o impedimento nem param de novo a recarga das outras Vaal', { skip: SEM }, async () => {
  const { e, b } = await montar(['Vaal_Blight'], { soltas: ['Vaal_Arc'], arma: 'Wands/Driftwood_Wand' });
  const arc = G.doSlug('Vaal_Arc').acao;
  // (o Arco carregando: a recarga dele anda com o impedimento da Praga)
  assert.ok(usar(e, 1, b).r.ok);
  e.hunt.clock = (e.hunt.poeAlmasImpedidasAte ?? e.hunt.clock) + 10;
  const u0 = usar(e, 0, b);
  assert.ok(u0.r.ok, JSON.stringify(u0.r));
  assert.ok(e.hunt.canalizacao, 'a Praga Vaal canaliza');
  const fim = e.hunt.poeAlmasImpedidasAte;
  const arcAte = e.hunt.cooldowns[arc].ate;
  assert.ok(fim > e.hunt.clock);
  let estagios = 0;
  for (let i = 0; i < 6; i++) {
    const r = usar(e, 0, b).r;
    if (r.ok) estagios++;
    assert.equal(e.hunt.poeAlmasImpedidasAte, fim, `estágio ${i + 1}: o impedimento não anda`);
    assert.equal(e.hunt.cooldowns[arc].ate, arcAte, `estágio ${i + 1}: a recarga do Arco não anda`);
  }
  assert.ok(estagios >= 3, `a canalização seguiu (${estagios} estágios)`);
});

// ---------------------------------------------------------------- os Duplos do Golpe Duplo Vaal

test('C3 (P4): os Duplos do Golpe Duplo Vaal não são Lacaios Danificáveis — não são alvo de Vínculo, nem "lacaio em campo" para a Oferenda', { skip: SEM }, async () => {
  const { e, b } = await montar(['Vaal_Double_Strike'], { soltas: ['Bone_Offering'] });
  assert.ok(usar(e, 0, b).r.ok);
  const acao = G.doSlug('Vaal_Double_Strike').acao;
  const duplos = e.hunt.lacaios.filter((l) => l.p4Duplo === acao);
  assert.equal(duplos.length, 2);
  // ("Habilidades de Vínculo podem focar em Lacaios Danificáveis": o Duplo, intocável, fica fora; um lacaio comum ao lado entra)
  const af = { vinculo_em_lacaios: 1 };
  assert.deepEqual(Vinculos.candidatos(e, e.hunt, af).filter((a) => a.tipo === 'lacaio'), [], 'só Duplos: nenhum lacaio para vincular');
  e.hunt.lacaios.push({ uid: 'zumbi-teste', tipo: 'lacaio', hp: 100, maxHp: 100, x: e.hunt.pos.x, y: e.hunt.pos.y + 1 });
  assert.deepEqual(Vinculos.candidatos(e, e.hunt, af).filter((a) => a.tipo === 'lacaio').map((a) => a.uid), ['zumbi-teste']);
  e.hunt.lacaios.pop();
  // (a Oferenda de Ossos com um cadáver ao lado e só os Duplos em campo: recusa como sem lacaio)
  e.hunt.cadaveres = [{ key: 'c', nome: 'Morto', look: 1, x: b.x, y: b.y, maxHp: 1000 }];
  e.hunt.clock += 1000;
  const r = usar(e, 1, b).r;
  assert.equal(r.motivo, 'SEM_LACAIOS', JSON.stringify(r));
  assert.ok(duplos.every((d) => !d.oferenda));
});

// ---------------------------------------------------------------- o "+1 ao Nível" pela tag

test('C3 (T3/T1): o "+1 ao Nível das Gemas de Golpes" vale nas gemas com a tag Golpear; o de Gelo, Raio e Maldição só nas gemas com a tag', { skip: SEM }, () => {
  assert.equal(efPara('Awakened_Melee_Splash_Support', 5, 'Double_Strike').nivelExtra, 1, 'o Golpe Duplo (Golpear) sobe');
  assert.equal(efPara('Awakened_Melee_Splash_Support', 5, 'Cleave').nivelExtra, undefined, 'a Cutilada não é Golpear');
  for (const [sup, com, sem] of [
    ['Awakened_Added_Cold_Damage_Support', 'Ice_Nova', ['Heavy_Strike', 'Fireball', 'Arc', 'Summon_Raging_Spirit']],
    ['Awakened_Added_Lightning_Damage_Support', 'Arc', ['Heavy_Strike', 'Ice_Nova']],
    ['Awakened_Hextouch_Support', 'Despair', ['Heavy_Strike']],
  ]) {
    assert.equal(efPara(sup, 5, com).nivelExtra, 1, `${sup} em ${com}`);
    for (const a of sem) assert.equal(efPara(sup, 5, a).nivelExtra, undefined, `${sup} em ${a}: sem a tag, nada`);
  }
});

// ---------------------------------------------------------------- o "mais/menos Duração"

test('C3 (T3): o "menos Duração" de suportes diferentes multiplica — a Faísca com o Menos Duração e o Sofrimento Veloz: 0,51 × 0,75', { skip: SEM }, async () => {
  const menos = SP.efeitoNoNivel('Less_Duration_Support', 20, 0, tagsDe('Spark')).efeito.duracaoMaisPct;
  const veloz = SP.efeitoNoNivel('Swift_Affliction_Support', 20, 0, tagsDe('Spark')).efeito.duracaoMaisPct;
  assert.deepEqual([menos, veloz], [-49, -25]);
  const fator = async (slugs) => { const { e } = await montar(slugs, { arma: 'Wands/Driftwood_Wand' }); const id = G.doSlug('Spark').acao; return Acoes.fatorDeDuracao(e, Acoes.POR_ID_PUBLICO(id), GS.efeitoNaSkill(e, id)); };
  const base = await fator(['Spark']);
  const ambos = await fator(['Spark', 'Less_Duration_Support', 'Swift_Affliction_Support']);
  assert.ok(perto(ambos / base, 0.51 * 0.75, 1e-9), `${ambos} / ${base}`);
  // (o "mais" local: o "menos Duração das Afecções Danificadoras" multiplica com o de outro suporte e com o da gema, não soma)
  const { MAIS_LOCAL_QUE_MULTIPLICA } = await import('../systems/itens-poe/suportes-t3.mjs');
  assert.ok(MAIS_LOCAL_QUE_MULTIPLICA.test('af:duracao_afeccoes_dano_mais') && MAIS_LOCAL_QUE_MULTIPLICA.test('af:crit_mais_pct') && !MAIS_LOCAL_QUE_MULTIPLICA.test('af:crit_chance_inc'));
});

// ---------------------------------------------------------------- a Chuva Cinética

test('C3 (T2): a explosão da Anomalia Cinética não é projétil — os Projéteis Múltiplos dão mais anomalias, sem o "menos Dano de Projétil" na explosão', { skip: SEM }, async () => {
  const explosao = async (slugs) => {
    const { e, b } = await montar(slugs, { arma: 'Wands/Driftwood_Wand' });
    usar(e, 0, b);
    const n = (e.hunt.poeR3c?.anomalias ?? []).length;
    const ev = [];
    Acoes.tiqueR3C(e, e.hunt, { nome: 'T' }, ev, e.hunt.clock + 100, () => 0.5);
    return { n, v: golpesEm(ev, b)[0]?.v ?? 0 };
  };
  const sem = await explosao(['Kinetic_Rain']);
  const lmp = await explosao(['Kinetic_Rain', 'Multiple_Projectiles_Support']);
  const gmp = await explosao(['Kinetic_Rain', 'Greater_Multiple_Projectiles_Support']);
  assert.ok(sem.v > 0);
  assert.deepEqual([sem.n, lmp.n, gmp.n], [8, 10, 12], 'mais anomalias com os projéteis a mais');
  assert.ok(perto(lmp.v, sem.v, 0.01), `com os Projéteis Múltiplos: ${lmp.v} ≈ ${sem.v}`);
  assert.ok(perto(gmp.v, sem.v, 0.01), `com os Melhorados: ${gmp.v} ≈ ${sem.v}`);
});

test('C3 (T2): o teto das anomalias é de cada habilidade — as 30 da Chuva Cinética e as 20 do Fluxo Cinético não se cortam', () => {
  const hunt = { clock: 0 };
  for (let i = 0; i < 30; i++) R3c.criarAnomalia(hunt, { acao: 'chuva', c: { x: i, y: 0 }, z: 0, raio: 1, ms: 6000, teto: 30, grupo: 'chuva' }, 0);
  for (let i = 0; i < 25; i++) R3c.criarAnomalia(hunt, { acao: 'fluxo', c: { x: i, y: 5 }, z: 0, raio: 1, ms: 6000, teto: 20 }, 0);
  const an = hunt.poeR3c.anomalias;
  assert.equal(an.filter((a) => a.grupo === 'chuva').length, 30, 'as da Chuva ficam');
  assert.equal(an.filter((a) => !a.grupo).length, 20, 'o Fluxo até 20');
  // (a 31ª da Chuva tira a mais velha da Chuva, não a do Fluxo)
  R3c.criarAnomalia(hunt, { acao: 'chuva', c: { x: 99, y: 0 }, z: 0, raio: 1, ms: 6000, teto: 30, grupo: 'chuva' }, 0);
  const an2 = hunt.poeR3c.anomalias;
  assert.equal(an2.filter((a) => a.grupo === 'chuva').length, 30);
  assert.equal(an2.filter((a) => !a.grupo).length, 20);
  assert.ok(!an2.some((a) => a.grupo === 'chuva' && a.x === 0), 'a mais velha da Chuva saiu');
});

// ---------------------------------------------------------------- o Multiplicador de Custo & Reserva

test('C3 (T3): o "Multiplicador de Custo & Reserva" pela coluna Mana da tabela — a Transfusão 320% no 20 (custo +220%), 270% no 10', { skip: SEM }, () => {
  const mult = (s, n) => { const p = SP.fichaNoNivel(s, n, 0).props.find(([k]) => /^Multiplicador de Custo/.test(k)); return p && `${p[0]}: ${p[1]}`; };
  assert.equal(mult('Transfusion_Support', 20), 'Multiplicador de Custo & Reserva: 320%');
  assert.equal(mult('Transfusion_Support', 10), 'Multiplicador de Custo & Reserva: 270%');
  assert.equal(SP.efeitoNoNivel('Transfusion_Support', 20, 0, tagsDe('Fireball')).efeito.custoPct, 220);
  assert.equal(mult('Awakened_Enlighten_Support', 20), 'Multiplicador de Custo & Reserva: 44%');
  assert.equal(mult('Eclipse_Support', 15), 'Multiplicador de Custo & Reserva: 81%');
  assert.equal(mult('Added_Fire_Damage_Support', 20), 'Multiplicador de Custo & Reserva: 120%', 'sem a coluna, a propriedade fixa');
});

// ---------------------------------------------------------------- o Infestador

test('C3 (P4): a troca à mão do Infestador custa a mana da gema; sem mana, não troca', { skip: SEM }, async () => {
  const { e } = await montar(['Plague_Bearer'], { arma: 'Wands/Driftwood_Wand' });
  const m0 = e.mana;
  assert.ok(usar(e, 0, null).r.ok, 'o primeiro uso: Incubando');
  const custo = m0 - e.mana;
  assert.ok(custo > 0, `custou ${custo}`);
  e.hunt.praga.valor = 1000;
  e.hunt.clock += 1000;
  const m1 = e.mana;
  assert.ok(usar(e, 0, null).r.ok);
  assert.equal(e.hunt.praga.modo, 'infestando');
  assert.equal(m1 - e.mana, custo, 'cada troca paga');
  e.mana = 0;
  e.hunt.clock += 1000;
  assert.equal(usar(e, 0, null).r.motivo, 'MANA');
  assert.equal(e.hunt.praga.modo, 'infestando', 'sem mana, fica');
});
