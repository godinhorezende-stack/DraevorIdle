// O combo da fileira de ataque (os 11 slots `attack`): rodízio, intervalo
// mínimo entre execuções reais (R.COMBO_SKILL_INTERVAL_MS) e as regras de
// sempre (recarga individual, recarga do grupo, mana, alvo, alcance).
// Ver `game/systems/combo.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Combo from '../systems/combo.mjs';
import * as R from '../systems/regras.mjs';
import { personagemDeTeste, PERSONAGEM, comSkills } from './apoio.mjs';

// Onze magias de ataque DIFERENTES do sorcerer, todas de alvo único.
// Recarga do catálogo: 7 de 2 s, 3 de 8 s e 1 de 30 s (o efetivo é a metade).
const ONZE = [
  'spell-buzz', 'spell-apprentice-s-strike', 'spell-energy-strike', 'spell-terra-strike',
  'spell-flame-strike', 'spell-ice-strike', 'spell-death-strike', 'spell-lightning',
  'spell-strong-flame-strike', 'spell-strong-energy-strike', 'spell-ultimate-flame-strike',
];

function montar(magias, { distancia = 1, mana = 1e9 } = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 600 });
  // As skills vêm das gemas encaixadas (modelo Path of Exile).
  comSkills(e, magias.filter(Boolean));
  magias.forEach((id, i) => {
    if (!id) return;
    const r = Acoes.definir(e, { slot: Combo.SLOTS_DO_COMBO[i], value: { id } });
    assert.ok(r.ok, `${id}: ${r.erro}`);
  });
  const r = Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' });
  assert.ok(r.ok !== false, r.erro);
  e.hunt.assistencia = true;
  e.hunt.autoBarra = true;
  return { e, h: e.hunt, distancia, mana };
}

/**
 * Roda `segundos` de caçada com um bicho imortal a `distancia` casas (alvo
 * sempre válido), e devolve as linhas do log do combo e as execuções reais.
 * `passoMs` é o tamanho do tique (o servidor anda de ~250 em ~250, às vezes 249).
 */
function rodar(cenario, segundos, { passoMs = 250, aCadaTique = null } = {}) {
  const { e, h } = cenario;
  const linhas = [];
  Combo.ouvirCombo((l) => linhas.push(l));
  let t = Date.now();
  h.ultimoTique = t;
  try {
    for (let i = 0; i < (segundos * 1000) / passoMs; i++) {
      t += passoMs;
      h.monstros = h.monstros.slice(0, 1);
      const m = h.monstros[0];
      m.hp = m.maxHp = 1e12;
      m.x = h.pos.x + cenario.distancia;
      m.y = h.pos.y;
      h.alvo = m.uid;
      e.hp = e.maxHp;
      if (cenario.mana != null) {
        e.maxMana = Math.max(e.maxMana, cenario.mana);
        e.mana = cenario.mana;
      }
      aCadaTique?.(h, e);
      Cacadas.tique(e, PERSONAGEM, t);
    }
  } finally {
    Combo.ouvirCombo(null);
  }
  return { linhas, execucoes: linhas.filter((l) => l.resultado === 'EXECUTADA') };
}

const intervalos = (execucoes) => execucoes.slice(1).map((x, i) => x.relogio - execucoes[i].relogio);

test('os 11 slots de ataque executam em rodízio, 1 → 11 e de volta ao 1', () => {
  const { execucoes, linhas } = rodar(montar(ONZE), 30);
  const porSlot = Array(11).fill(0);
  for (const x of execucoes) porSlot[x.slot - 1]++;
  for (let s = 0; s < 11; s++) assert.ok(porSlot[s] > 0, `slot ${s + 1} nunca executou (${porSlot.join(' ')})`);
  // O primeiro ciclo sai inteiro e em ordem.
  assert.deepEqual(execucoes.slice(0, 11).map((x) => x.slot), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(execucoes[11].slot, 1, 'depois do slot 11 o combo volta ao 1');
  assert.ok(linhas.some((l) => l.evento?.startsWith('FIM DO CICLO')));
  // Nunca duas no mesmo instante, nunca abaixo do intervalo do combo.
  for (const d of intervalos(execucoes)) assert.ok(d >= R.COMBO_SKILL_INTERVAL_MS, `intervalo de ${d} ms`);
});

test('antes da correção, só o começo da fileira saía (a varredura recomeçava do slot 0)', () => {
  // Guarda do defeito: 30 s com as 11 magias precisam de pelo menos 2 ciclos.
  const { execucoes } = rodar(montar(ONZE), 30);
  assert.ok(new Set(execucoes.map((x) => x.slot)).size === 11);
  assert.ok(execucoes.filter((x) => x.slot === 1).length < execucoes.length / 2);
});

test('a recarga individual de cada skill continua valendo (o intervalo do combo não a substitui)', () => {
  const cenario = montar(ONZE);
  const { execucoes, linhas } = rodar(cenario, 60);
  const recarga = Object.fromEntries(Object.entries(cenario.h.cooldowns).filter(([k]) => !k.startsWith('grupo:')).map(([id, cd]) => [id, cd.total]));
  const ultimaDe = {};
  for (const x of execucoes) {
    if (ultimaDe[x.skill] != null) {
      // A folga de meio tique de `R.jaPode` é da regra de recarga que já existia.
      assert.ok(x.relogio - ultimaDe[x.skill] >= recarga[x.skill] - R.FOLGA_DO_TIQUE, `${x.skill} relançada em ${x.relogio - ultimaDe[x.skill]} ms (recarga ${recarga[x.skill]})`);
    }
    ultimaDe[x.skill] = x.relogio;
  }
  // A de 30 s (15 s efetiva) é pulada por recarga, com o tempo que falta no log.
  const pulada = linhas.find((l) => l.skill === 'spell-ultimate-flame-strike' && l.motivo === 'COOLDOWN');
  assert.ok(pulada, 'a skill em recarga aparece no log como IGNORADA por COOLDOWN');
  assert.ok(pulada.recargaRestanteMs > 0);
  assert.equal(pulada.resultado, 'IGNORADA');
});

test('com recargas curtas, médias e longas o combo segue girando e nenhuma sai antes da hora', () => {
  // Curta (1 s efetivo), média (4 s) e longa (15 s): só três slots preenchidos.
  const cenario = montar(['spell-buzz', 'spell-lightning', 'spell-ultimate-flame-strike']);
  const { execucoes } = rodar(cenario, 40);
  const vezes = (id) => execucoes.filter((x) => x.skill === id).map((x) => x.relogio);
  const [curta, media, longa] = ['spell-buzz', 'spell-lightning', 'spell-ultimate-flame-strike'].map(vezes);
  assert.ok(curta.length > media.length && media.length > longa.length, `${curta.length}/${media.length}/${longa.length}`);
  for (const [lista, ms] of [[media, 4000], [longa, 15000]]) {
    for (let i = 1; i < lista.length; i++) assert.ok(lista[i] - lista[i - 1] >= ms - R.FOLGA_DO_TIQUE);
  }
  for (const d of intervalos(execucoes)) assert.ok(d >= R.COMBO_SKILL_INTERVAL_MS);
});

test('o intervalo mínimo entre execuções reais vale mesmo sem a recarga do grupo, e mesmo com tique de 249 ms', () => {
  // Tirando a recarga do grupo a cada tique, sobra só o intervalo do combo:
  // é ele que tem de segurar a cadência — nunca abaixo de 500 ms.
  const { execucoes } = rodar(montar(ONZE), 20, { passoMs: 249, aCadaTique: (h) => delete h.cooldowns['grupo:attack'] });
  const ds = intervalos(execucoes);
  assert.ok(ds.length > 20);
  for (const d of ds) assert.ok(d >= R.COMBO_SKILL_INTERVAL_MS, `intervalo de ${d} ms`);
  // E não é o tique que segura: com passos de 249 ms, 2 tiques = 498 < 500, então sai no 3º.
  assert.ok(Math.min(...ds) < 1000);
});

test('uma execução recusada não conta como execução: o intervalo mede da última que saiu de verdade', () => {
  const { e, h } = montar(ONZE);
  h.clock = 10_000;
  h.monstros = h.monstros.slice(0, 1);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
  const alvo = h.monstros[0];
  h.ultimoAtaqueEm = 9_700; // a anterior saiu há 300 ms
  const cedo = Acoes.disparar(e, h, PERSONAGEM, Combo.SLOTS_DO_COMBO[0], alvo);
  assert.equal(cedo.ok, false);
  assert.equal(cedo.motivo, 'INTERVALO_DO_COMBO');
  assert.equal(h.ultimoAtaqueEm, 9_700, 'a tentativa recusada não mexe no instante da última execução');
  h.clock = 10_200; // 500 ms depois da anterior
  const certo = Acoes.disparar(e, h, PERSONAGEM, Combo.SLOTS_DO_COMBO[0], alvo);
  assert.equal(certo.ok, true, certo.erro);
  assert.equal(h.ultimoAtaqueEm, 10_200);
});

test('sem mana: as caras são puladas com o motivo e as baratas seguem no rodízio', () => {
  // 30 de mana por tique: cabem Energy/Terra/Flame (20), não Lightning (60) nem Ultimate (100).
  const { execucoes, linhas } = rodar(montar(ONZE, { mana: 30 }), 20);
  assert.ok(execucoes.length > 0);
  assert.ok(!execucoes.some((x) => ['spell-lightning', 'spell-strong-flame-strike', 'spell-strong-energy-strike', 'spell-ultimate-flame-strike'].includes(x.skill)));
  assert.ok(linhas.some((l) => l.skill === 'spell-lightning' && l.motivo === 'MANA'));
});

test('fora de alcance: as de alcance 3 são puladas, as de alcance 7 executam', () => {
  const { execucoes, linhas } = rodar(montar(ONZE, { distancia: 5 }), 20);
  const alcance3 = ['spell-buzz', 'spell-apprentice-s-strike', 'spell-energy-strike', 'spell-terra-strike', 'spell-flame-strike', 'spell-ice-strike', 'spell-death-strike'];
  assert.ok(!execucoes.some((x) => alcance3.includes(x.skill)));
  assert.ok(execucoes.some((x) => x.skill === 'spell-lightning'));
  assert.ok(linhas.some((l) => l.skill === 'spell-buzz' && l.motivo === 'FORA_DE_ALCANCE'));
});

test('um slot vazio no meio da fileira não quebra o rodízio', () => {
  const magias = [...ONZE];
  magias[3] = null;
  magias[7] = null;
  const { execucoes } = rodar(montar(magias), 20);
  const slots = new Set(execucoes.map((x) => x.slot));
  for (const s of [1, 2, 3, 5, 6, 7, 9, 10, 11]) assert.ok(slots.has(s), `slot ${s}`);
  assert.ok(!slots.has(4) && !slots.has(8));
});

test('o clique manual também respeita o intervalo do combo', () => {
  const { e, h } = montar(ONZE);
  h.monstros = h.monstros.slice(0, 1);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
  h.alvo = h.monstros[0].uid;
  h.clock = 5_000;
  assert.equal(Cacadas.disparoManual(e, PERSONAGEM, Combo.SLOTS_DO_COMBO[0]).ok, true);
  delete h.cooldowns['grupo:attack'];
  h.clock = 5_200;
  const r = Cacadas.disparoManual(e, PERSONAGEM, Combo.SLOTS_DO_COMBO[1]);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'INTERVALO_DO_COMBO');
});
