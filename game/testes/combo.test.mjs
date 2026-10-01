// O combo da fileira de ataque (os 11 slots `attack`): PRIORIDADE pela ordem dos
// slots (pedido do dono, 01/10 — não rodízio), o cooldown global entre execuções
// reais (R.GLOBAL_SPELL_COOLDOWN, 2 s, encurtado pelo Cast Speed) e as regras de
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
const globalDe = (cenario) => Acoes.intervaloGlobal(cenario.e);
/** Sai no 1º tique a partir do global: nunca antes dele, e no máximo um tique (250 ms) depois. */
const noTiqueDoGlobal = (d, g, passo = 250) => assert.ok(d >= g && d < g + passo, `intervalo de ${d} ms (global ${g})`);

/**
 * A regra da prioridade, conferida execução por execução: quando o slot N saiu,
 * TODOS os slots acima dele foram tentados naquele mesmo instante e recusados
 * por um motivo próprio (recarga, mana, alcance, condição) — nenhum foi pulado.
 */
function conferirPrioridade(linhas, execucoes) {
  for (const x of execucoes) {
    const doInstante = linhas.filter((l) => l.relogio === x.relogio && l.slot != null);
    for (let s = 1; s < x.slot; s++) {
      const tentativa = doInstante.find((l) => l.slot === s);
      if (!tentativa) continue; // slot vazio/desligado: não há o que tentar
      assert.equal(tentativa.resultado, 'IGNORADA', `slot ${s} estava disponível e o ${x.slot} saiu antes dele`);
      assert.ok(!['COOLDOWN_GLOBAL', 'COOLDOWN_DO_GRUPO', 'CONJURANDO'].includes(tentativa.motivo), `slot ${s}: ${tentativa.motivo}`);
    }
  }
}

test('o cooldown global é 2 s, centralizado em R.GLOBAL_SPELL_COOLDOWN, e o Cast Speed encurta', () => {
  assert.equal(R.GLOBAL_SPELL_COOLDOWN, 2000);
  assert.equal(Acoes.intervaloGlobalCom(0), 2000);
  assert.equal(Acoes.intervaloGlobalCom(25), 1600);
  assert.equal(Acoes.intervaloGlobalCom(100), 1000);
  assert.equal(Acoes.intervaloGlobalCom(-50), 2000, 'Cast Speed negativo não alonga');
});

test('a primeira magia disponível SEMPRE sai: com o slot 1 pronto a cada global, só ele executa', () => {
  // Buzz: recarga efetiva de 1 s < 2 s do global — está pronta em toda janela.
  const cenario = montar(ONZE);
  const { execucoes, linhas } = rodar(cenario, 30);
  assert.ok(execucoes.length >= 14);
  assert.ok(execucoes.every((x) => x.slot === 1), `saíram: ${[...new Set(execucoes.map((x) => x.slot))]}`);
  for (const d of intervalos(execucoes)) noTiqueDoGlobal(d, globalDe(cenario));
  conferirPrioridade(linhas, execucoes);
  assert.ok(!linhas.some((l) => l.evento?.startsWith('FIM DO CICLO')), 'não há mais ciclo/rodízio');
});

test('slot 1 em recarga: sai o próximo disponível; quando o 1 volta, ele recupera a prioridade', () => {
  // Slot 1: Lightning (4 s efetivos). Slot 2: Buzz (1 s). Slot 3: Energy Strike (1 s).
  const cenario = montar(['spell-lightning', 'spell-buzz', 'spell-energy-strike']);
  const { execucoes, linhas } = rodar(cenario, 40);
  const g = globalDe(cenario);
  assert.equal(execucoes[0].slot, 1, 'começa pelo slot 1');
  assert.equal(execucoes[1].slot, 2, 'slot 1 em recarga: o próximo disponível (2), não o 3');
  assert.equal(execucoes[2].slot, 1, 'o slot 1 voltou: recupera a vez');
  // 4 s de recarga / 2 s de global: 1, 2, 1, 2, ... — o 3 nunca sai (o 2 está sempre pronto antes dele).
  assert.deepEqual(execucoes.slice(0, 10).map((x) => x.slot), [1, 2, 1, 2, 1, 2, 1, 2, 1, 2]);
  assert.ok(!execucoes.some((x) => x.slot === 3));
  for (const d of intervalos(execucoes)) noTiqueDoGlobal(d, g);
  conferirPrioridade(linhas, execucoes);
});

test('com as 11 magias: a prioridade vale em toda execução, nunca duas no mesmo instante, nunca antes do global', () => {
  const cenario = montar(['spell-ultimate-flame-strike', 'spell-strong-flame-strike', 'spell-lightning', ...ONZE.slice(0, 8)]);
  const { execucoes, linhas } = rodar(cenario, 60, { passoMs: 249 });
  const g = globalDe(cenario);
  conferirPrioridade(linhas, execucoes);
  const instantes = execucoes.map((x) => x.relogio);
  assert.equal(new Set(instantes).size, instantes.length, 'duas magias no mesmo instante');
  for (const d of intervalos(execucoes)) assert.ok(d >= g, `intervalo de ${d} ms < ${g}`);
  // Sem laço nem execução duplicada: 60 s / 2 s = 30 janelas — com tique de 249 ms, no máximo isso.
  assert.ok(execucoes.length <= Math.ceil(60000 / g) && execucoes.length >= 25, `${execucoes.length} execuções`);
});

test('a recarga individual de cada skill continua valendo junto com o global', () => {
  const cenario = montar(['spell-ultimate-flame-strike', 'spell-strong-flame-strike', 'spell-lightning', 'spell-buzz']);
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
  // A de 30 s (15 s efetiva) é a do slot 1: sai assim que volta, e no meio tempo é pulada por recarga.
  const ultimate = execucoes.filter((x) => x.skill === 'spell-ultimate-flame-strike');
  assert.ok(ultimate.length >= 4, `ultimate saiu ${ultimate.length}x em 60 s`);
  for (let i = 1; i < ultimate.length; i++) assert.ok(ultimate[i].relogio - ultimate[i - 1].relogio <= recarga['spell-ultimate-flame-strike'] + 2000, 'pronta, ela sai no máximo um global depois');
  const pulada = linhas.find((l) => l.skill === 'spell-ultimate-flame-strike' && l.motivo === 'COOLDOWN');
  assert.ok(pulada?.recargaRestanteMs > 0);
});

test('uma execução recusada não conta: o global mede da última que saiu de verdade', () => {
  const { e, h } = montar(ONZE);
  h.clock = 10_000;
  h.monstros = h.monstros.slice(0, 1);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
  const alvo = h.monstros[0];
  const g = Acoes.intervaloGlobal(e);
  h.ultimoAtaqueEm = 10_000 - (g - 300); // a anterior saiu há (global − 300) ms
  const cedo = Acoes.disparar(e, h, PERSONAGEM, Combo.SLOTS_DO_COMBO[0], alvo);
  assert.equal(cedo.ok, false);
  assert.equal(cedo.motivo, 'COOLDOWN_GLOBAL');
  assert.equal(cedo.faltaMs, 300);
  assert.equal(h.ultimoAtaqueEm, 10_000 - (g - 300), 'a tentativa recusada não mexe no instante da última execução');
  h.clock = 10_300; // exatamente o global depois da anterior
  const certo = Acoes.disparar(e, h, PERSONAGEM, Combo.SLOTS_DO_COMBO[0], alvo);
  assert.equal(certo.ok, true, certo.erro);
  assert.equal(h.ultimoAtaqueEm, 10_300);
});

test('sem mana: as caras são puladas com o motivo, e a prioridade segue entre as baratas', () => {
  // 30 de mana por tique: cabem Energy/Terra/Flame (20), não Lightning (60) nem Ultimate (100).
  const { execucoes, linhas } = rodar(montar(['spell-lightning', 'spell-ultimate-flame-strike', 'spell-energy-strike', 'spell-terra-strike'], { mana: 30 }), 20);
  assert.ok(execucoes.length > 0);
  assert.ok(!execucoes.some((x) => ['spell-lightning', 'spell-ultimate-flame-strike'].includes(x.skill)));
  assert.ok(linhas.some((l) => l.skill === 'spell-lightning' && l.motivo === 'MANA'));
  conferirPrioridade(linhas, execucoes);
});

test('fora de alcance: as de alcance 3 são puladas, as de alcance 7 executam', () => {
  const { execucoes, linhas } = rodar(montar(ONZE, { distancia: 5 }), 20);
  const alcance3 = ['spell-buzz', 'spell-apprentice-s-strike', 'spell-energy-strike', 'spell-terra-strike', 'spell-flame-strike', 'spell-ice-strike', 'spell-death-strike'];
  assert.ok(!execucoes.some((x) => alcance3.includes(x.skill)));
  assert.ok(execucoes.some((x) => x.skill === 'spell-lightning'));
  assert.ok(linhas.some((l) => l.skill === 'spell-buzz' && l.motivo === 'FORA_DE_ALCANCE'));
});

test('slots vazios no meio da fileira não quebram a prioridade', () => {
  const { execucoes, linhas } = rodar(montar([null, 'spell-lightning', null, 'spell-buzz']), 20);
  assert.equal(execucoes[0].slot, 2);
  assert.equal(execucoes[1].slot, 4);
  assert.ok(!execucoes.some((x) => x.slot === 1 || x.slot === 3));
  conferirPrioridade(linhas, execucoes);
});

test('o clique manual também respeita o global (o servidor decide); fora da ordem só se o jogador escolher', () => {
  const { e, h } = montar(ONZE);
  h.monstros = h.monstros.slice(0, 1);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
  h.alvo = h.monstros[0].uid;
  h.clock = 5_000;
  // O clique é a escolha do jogador: o slot 2 pode sair mesmo com o 1 pronto.
  assert.equal(Cacadas.disparoManual(e, PERSONAGEM, Combo.SLOTS_DO_COMBO[1]).ok, true);
  delete h.cooldowns['grupo:attack'];
  h.clock = 5_000 + Acoes.intervaloGlobal(e) - 250;
  const r = Cacadas.disparoManual(e, PERSONAGEM, Combo.SLOTS_DO_COMBO[0]);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'COOLDOWN_GLOBAL');
  // E o automático, no mesmo instante, também espera: uma magia por vez.
  const linhas = [];
  Combo.ouvirCombo((l) => linhas.push(l));
  try {
    assert.deepEqual(Combo.tiqueDoCombo(e, h, PERSONAGEM, h.monstros[0]), []);
  } finally {
    Combo.ouvirCombo(null);
  }
  assert.equal(linhas[0].motivo, 'COOLDOWN_GLOBAL');
  h.clock += 250;
  assert.equal(Cacadas.disparoManual(e, PERSONAGEM, Combo.SLOTS_DO_COMBO[0]).ok, true);
});

test('cura e suporte não esperam o global de ataque (decisão do dono)', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 600 });
  comSkills(e, ['spell-buzz', 'spell-light-healing']);
  assert.ok(Acoes.definir(e, { slot: Combo.SLOTS_DO_COMBO[0], value: { id: 'spell-buzz' } }).ok);
  const slotDeCura = Acoes.PAPEL_DO_SLOT.findIndex((p) => p !== 'attack');
  const r = Acoes.definir(e, { slot: slotDeCura, value: { id: 'spell-light-healing' } });
  assert.ok(r.ok, r.erro);
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const h = e.hunt;
  h.monstros = h.monstros.slice(0, 1);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
  h.clock = 1_000;
  assert.ok(Acoes.disparar(e, h, PERSONAGEM, Combo.SLOTS_DO_COMBO[0], h.monstros[0]).ok);
  e.hp = Math.round(e.maxHp * 0.3);
  const cura = Acoes.disparar(e, h, PERSONAGEM, slotDeCura, null);
  assert.ok(cura.ok, `a cura saiu logo depois do ataque: ${cura.erro}`);
});
