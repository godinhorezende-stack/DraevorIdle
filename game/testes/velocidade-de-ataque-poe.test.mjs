// O GOLPE BÁSICO no modo PoE (09/10: "o intervalo do golpe básico é 2000 ms para qualquer arma do PoE"): o intervalo BASE vem dos Ataques por
// Segundo da base da arma no catálogo do PoE (Rusted Sword 1,55 → 1000/1,55 ms), × a Velocidade de Ataque LOCAL da peça (o sufixo da arma),
// e os aumentos GLOBAIS seguem por cima, como no PoE. Conferido também numa caçada de verdade (`Cacadas.entrar` + `Cacadas.tique`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const FichaPoe = await import('../systems/personagem/ficha-poe.mjs');
const Registro = await import('../systems/combate/registro.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) Jogo.iniciar(ITEM_CATALOG);

/** Os Ataques por Segundo da base no catálogo do PoE (a fonte da verdade). */
const apsDaBase = (id) => Catalogo.catalogo().classes[id.split('/')[0]].bases.find((b) => b.id === id).atributos.ataques_por_segundo;
const peca = (base, raridade = 'normal') => Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl: 1, rng: () => 0.5 }));
/** A peça SÓ com estes mods (os sorteados saem; o implícito fica), refeita pelo caminho das moedas (`recalcular`). */
function comMods(p, mods) {
  p.poe.prefixos = [];
  p.poe.sufixos = [];
  for (const { lado = 'sufixos', modelo, valor } of mods) p.poe[lado].push({ modelo, valores: [valor], texto: modelo.replace('{0}', valor) });
  return Jogo.recalcular(p);
}
const VELOCIDADE = 'Velocidade de Ataque aumentada em {0}%';
/** Um Duelista do PoE (ou outra `classe`) com esta arma (e, se pedir, a segunda arma na outra mão e um anel). */
function duelista({ arma, segunda = null, anel = null, level = 40, classe = 'Duelist' }) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level }), { classePoe: classe });
  e.equipment = { ...e.equipment, weapon: typeof arma === 'string' ? peca(arma) : arma };
  if (!arma) delete e.equipment.weapon;
  if (segunda) e.equipment.shield = typeof segunda === 'string' ? peca(segunda) : segunda;
  else delete e.equipment.shield;
  if (anel) e.equipment.ring = anel;
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return e;
}

test('a ficha: o intervalo base do golpe é 1000 / os Ataques por Segundo da base da arma do PoE (não mais 2 s para toda arma)', { skip: SEM }, () => {
  const e = duelista({ arma: 'One_Hand_Swords/Rusted_Sword' });
  assert.equal(apsDaBase('One_Hand_Swords/Rusted_Sword'), 1.55);
  const f = Ficha.combate(e);
  assert.equal(f.velocidadeDeAtaque, 0, 'sem aumento global nenhum');
  assert.equal(f.intervaloDoGolpeMs, Math.round(1000 / 1.55), 'Rusted Sword: 645 ms');
  assert.equal(f.intervaloDoGolpeMs, 645);
  // As armas lentas: o machado e a maça de duas mãos mais lentos do catálogo.
  for (const [base, ms] of [['Two_Hand_Axes/Karui_Chopper', 952], ['Two_Hand_Maces/Karui_Maul', 1000], ['Bows/Crude_Bow', 714], ['Wands/Driftwood_Wand', 667]]) {
    const g = Ficha.combate(duelista({ arma: base }));
    assert.equal(g.intervaloDoGolpeMs, Math.round(1000 / apsDaBase(base)), base);
    assert.equal(g.intervaloDoGolpeMs, ms, base);
  }
  // O catálogo virtual leva o APS da base (é ele que a conta da arma lê) e a peça não inventa velocidade.
  assert.equal(ITEM_CATALOG[Jogo.idDaBase('One_Hand_Swords/Rusted_Sword')].aps, 1.55);
  assert.equal(f.arma.aps.base, 1.55);
});

test('desarmado no PoE: 1,2 ataques por segundo (833 ms), e a velocidade global por cima', { skip: SEM }, () => {
  const f = Ficha.combate(duelista({ arma: null }));
  assert.equal(f.arma, null);
  assert.equal(Ficha.APS_DESARMADO_POE, 1.2);
  assert.equal(f.intervaloDoGolpeMs, Math.round(1000 / 1.2), 'antes: 2000 ms');
  const anel = comMods(peca('Rings/Iron_Ring', 'magico'), [{ modelo: VELOCIDADE, valor: 20 }]);
  assert.equal(Ficha.combate(duelista({ arma: null, anel })).intervaloDoGolpeMs, Math.round(1000 / (1.2 * 1.2)));
  const linha = FichaPoe.montar(duelista({ arma: null }), f).secoes.find((s) => s.id === 'ataque').linhas.find((l) => l.rotulo === 'Ataques por segundo');
  assert.equal(linha.valor, '1,2');
  assert.deepEqual(linha.fontes.map((x) => [x.fonte, x.valor]), [['Desarmado', 1.2]]);
});

test('o SOCO no PoE: a faixa de dano físico da classe (2–8 no Marauder, 2–6 no Duelist, 2–5 na Witch…) e 0% de crítico', { skip: SEM }, () => {
  for (const [classe, max] of [['Marauder', 8], ['Duelist', 6], ['Templar', 6], ['Scion', 6], ['Ranger', 5], ['Witch', 5], ['Shadow', 5]]) {
    const f = Ficha.combate(duelista({ arma: null, classe }));
    assert.deepEqual([f.ataqueMin, f.ataqueMax, f.damage.min, f.damage.max], [2, max, 2, max], `${classe}: antes era 10–10`);
    assert.equal(f.critChance, 0, `${classe}: o soco não tem crítico de base`);
  }
});

test('o soco numa caçada de verdade: cada golpe básico do Marauder sorteia 2–8 (× o dano físico aumentado), nunca mais o 10 fixo', { skip: SEM }, () => {
  const e = duelista({ arma: null, classe: 'Marauder', level: 60 });
  const fisico = 1 + Ficha.combate(e).danoDoElemento.physical / 100;
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  const antes = Registro.nivelDoRegistro();
  Registro.definirNivel(1);
  Registro.limparRegistro();
  try {
    let t = Date.now();
    for (let i = 0; i < 240; i++) {
      const h = e.hunt;
      h.monstros = h.monstros.slice(0, 1);
      Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
      h.alvo = h.monstros[0].uid;
      e.hp = e.maxHp;
      Cacadas.tique(e, PERSONAGEM, (t += 250));
    }
    const golpes = Registro.ultimosGolpes(200).filter((g) => g.origem === 'golpe-basico').map((g) => g.danoAntesDaResistencia);
    assert.ok(golpes.length > 30, `${golpes.length} golpes básicos`);
    const possiveis = new Set([2, 3, 4, 5, 6, 7, 8].map((k) => Math.round(k * fisico)));
    assert.ok(golpes.every((d) => possiveis.has(d)), `fora da faixa 2–8 × ${fisico}: ${golpes.filter((d) => !possiveis.has(d)).join(', ')}`);
    assert.ok(new Set(golpes).size >= 5, `a faixa inteira aparece: ${[...new Set(golpes)].sort((a, b) => a - b).join(', ')}`);
  } finally {
    Registro.limparRegistro();
    Registro.definirNivel(antes);
  }
});

test('a Velocidade de Ataque da ARMA é LOCAL (multiplica o APS dela) e a das outras peças segue GLOBAL, como no PoE', { skip: SEM }, () => {
  const arma = comMods(peca('One_Hand_Swords/Rusted_Sword', 'magico'), [{ modelo: VELOCIDADE, valor: 10 }]);
  assert.equal(arma.poe.af.atk_speed_local, 10);
  assert.equal(arma.poe.af.atk_speed, undefined, 'não soma mais na velocidade global');
  assert.equal(arma.poe.estados.at(-1), 'equivalente', 'a linha da arma é a mesma conta do PoE');
  const f = Ficha.combate(duelista({ arma }));
  assert.equal(f.velocidadeDeAtaque, 0);
  assert.equal(f.intervaloDoGolpeMs, Math.round(1000 / (1.55 * 1.1)), '1,55 × 1,10 = 1,705 ataques/s');
  // + 20% GLOBAL num anel: multiplica por cima do APS local (não soma com os 10% da arma: seria 1,55 × 1,30).
  const anel = comMods(peca('Rings/Iron_Ring', 'magico'), [{ modelo: VELOCIDADE, valor: 20 }]);
  assert.equal(anel.poe.af.atk_speed, 20, 'no anel a velocidade é global');
  assert.equal(anel.poe.af.atk_speed_local, undefined);
  const g = Ficha.combate(duelista({ arma, anel }));
  assert.equal(g.velocidadeDeAtaque, 20);
  assert.equal(g.intervaloDoGolpeMs, Math.round(1000 / (1.55 * 1.1 * 1.2)));
  // "reduzida" na arma: local e negativa. Com condição ("se você causou um Golpe Crítico Recentemente"): global, como no PoE.
  const lenta = comMods(peca('One_Hand_Swords/Rusted_Sword', 'magico'), [{ modelo: 'Velocidade de Ataque reduzida em {0}%', valor: 20 }]);
  assert.equal(lenta.poe.af.atk_speed_local, -20);
  assert.equal(Ficha.combate(duelista({ arma: lenta })).intervaloDoGolpeMs, Math.round(1000 / (1.55 * 0.8)));
  const condicional = comMods(peca('One_Hand_Swords/Rusted_Sword', 'magico'), [{ modelo: 'Velocidade de Ataque aumentada em {0}% se você causou um Golpe Crítico Recentemente', valor: 10 }]);
  assert.equal(condicional.poe.af.atk_speed_local, undefined);
  assert.equal(condicional.poe.af['atk_speed@criticoRecente'], 10);
});

test('a peça antiga (velocidade da arma ainda global) é refeita na entrada: vira local', { skip: SEM }, () => {
  const arma = comMods(peca('One_Hand_Swords/Rusted_Sword', 'magico'), [{ modelo: VELOCIDADE, valor: 15 }]);
  arma.poe.tv = 6;
  arma.poe.af = { ...arma.poe.af, atk_speed: 15 };
  delete arma.poe.af.atk_speed_local;
  const e = duelista({ arma });
  assert.equal(Jogo.refazerPecasAntigas(e), 1);
  assert.deepEqual([arma.poe.af.atk_speed, arma.poe.af.atk_speed_local, arma.poe.tv], [undefined, 15, Jogo.VERSAO_DA_TRADUCAO]);
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).intervaloDoGolpeMs, Math.round(1000 / (1.55 * 1.15)));
});

test('duas armas: o golpe alterna e cada um leva o tempo da sua arma — a média dos dois intervalos, 10% mais rápido', { skip: SEM }, () => {
  const f = Ficha.combate(duelista({ arma: 'One_Hand_Swords/Rusted_Sword', segunda: 'One_Hand_Maces/Driftwood_Club' }));
  assert.equal(f.duasArmas, true);
  assert.equal(apsDaBase('One_Hand_Maces/Driftwood_Club'), 1.45);
  assert.equal(f.intervaloDoGolpeMs, Math.round((1000 / 1.55 + 1000 / 1.45) / 2 / 1.1));
  // A velocidade local da SEGUNDA arma vale só para ela.
  const rapida = comMods(peca('One_Hand_Maces/Driftwood_Club', 'magico'), [{ modelo: VELOCIDADE, valor: 25 }]);
  const g = Ficha.combate(duelista({ arma: 'One_Hand_Swords/Rusted_Sword', segunda: rapida }));
  assert.equal(g.intervaloDoGolpeMs, Math.round((1000 / 1.55 + 1000 / (1.45 * 1.25)) / 2 / 1.1));
});

test('a tela do personagem (PoE): "Ataques por segundo" com a base da arma e a velocidade local nas fontes', { skip: SEM }, () => {
  const arma = comMods(peca('One_Hand_Swords/Rusted_Sword', 'magico'), [{ modelo: VELOCIDADE, valor: 10 }]);
  const e = duelista({ arma });
  const linha = FichaPoe.montar(e, Ficha.combate(e)).secoes.find((s) => s.id === 'ataque').linhas.find((l) => l.rotulo === 'Ataques por segundo');
  assert.equal(linha.valor, (1000 / Math.round(1000 / (1.55 * 1.1))).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
  assert.deepEqual(linha.fontes.map((x) => [x.fonte, x.valor]), [['Base da arma', 1.55], ['Velocidade de Ataque local da arma', 10]]);
});

/**
 * Uma caçada de VERDADE (a Costa): o bicho mais perto vira imortal e fica colado, e os golpes básicos de 60 s de tique são contados.
 * Devolve `{ golpes, mediaMs }` — a média do primeiro ao último golpe. `passo`: o tique (250 ms, ou irregular como online).
 */
function golpesEm60s(arma, passo = () => 250) {
  const e = duelista({ arma, level: 60 });
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  let t = Date.now();
  const instantes = [];
  // Os 5 primeiros segundos são de aquecimento (chegar no bicho); contam os golpes dos 60 s seguintes.
  const inicio = t + 5000;
  const alcance = Math.min(1, Ficha.combate(e).attackRange ?? 1);
  while (t < inicio + 60_000) {
    const h = e.hunt;
    h.monstros = h.monstros.slice(0, 1);
    Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + alcance, y: h.pos.y });
    h.alvo = h.monstros[0].uid;
    e.hp = e.maxHp;
    const antes = h.proximoGolpeEm;
    Cacadas.tique(e, PERSONAGEM, (t += passo()));
    if (h.proximoGolpeEm !== antes && t >= inicio) instantes.push(t);
  }
  return { golpes: instantes.length, mediaMs: (instantes.at(-1) - instantes[0]) / (instantes.length - 1) };
}

test('numa caçada de verdade (tique de 250 ms) os golpes básicos saem no ritmo do APS da arma, sem o tique arredondar', { skip: SEM }, () => {
  // 60 s ÷ 645 ms = 93 golpes (antes: 30, a cada 2 s). Contando do tique em que saiu, o passo de 250 ms arredondava 645 ms para 750 (80 golpes).
  for (const [base, ms] of [['One_Hand_Swords/Rusted_Sword', 645], ['Bows/Crude_Bow', 714], ['Two_Hand_Maces/Karui_Maul', 1000], [null, 833]]) {
    const { golpes, mediaMs } = golpesEm60s(base);
    assert.ok(Math.abs(golpes - 60_000 / ms) <= 1, `${base}: ${golpes} golpes em 60 s (${ms} ms cada)`);
    // A média só erra pelo tique da ponta (até 250 ms) dividido pelos golpes.
    assert.ok(Math.abs(mediaMs - ms) <= 250 / (golpes - 1) + 1, `${base}: ${mediaMs.toFixed(1)} ms de média, a ficha diz ${ms}`);
  }
  // Online o tique oscila (200 a 300 ms): o ritmo médio continua o da arma.
  let s = 7;
  const irregular = () => 200 + ((s = (s * 16807) % 2147483647) % 101);
  const { golpes, mediaMs } = golpesEm60s('One_Hand_Swords/Rusted_Sword', irregular);
  assert.ok(Math.abs(golpes - 60_000 / 645) <= 1.5 && Math.abs(mediaMs - 645) <= 300 / (golpes - 1) + 1, `${golpes} golpes, ${mediaMs.toFixed(1)} ms de média com o tique irregular`);
});
