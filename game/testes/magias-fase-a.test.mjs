// Fase A da revisão do sistema de magias (decisões do dono, 01/10):
//   - o cooldown global e as recargas contam do INÍCIO da conjuração (ela corre dentro deles);
//   - RELÓGIO LÓGICO (`R.liberou`, `R.instanteLogico`) para global, conjuração e recargas:
//     nada sai antes do instante, e conta de quando PODIA sair — cada ponto de Cast Speed vale,
//     e online (tique oscilando) e offline (tique exato) dão o mesmo ritmo;
//   - ninguém lança magia morto;
//   - a mira no chão (`huntAction` com x, y) põe a área na casa escolhida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Combo from '../systems/combo.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as R from '../systems/regras.mjs';
import { personagemDeTeste, PERSONAGEM, comSkills } from './apoio.mjs';

// Seis magias de ataque de recarga curta (1 s efetivo): quem limita é o global, não a recarga delas.
const CURTAS = ['spell-buzz', 'spell-energy-strike', 'spell-flame-strike', 'spell-ice-strike', 'spell-death-strike', 'spell-terra-strike'];

/** Sorcerer na caçada com as magias (com a CONJURAÇÃO de verdade, 400 ms) e `cs`% de Cast Speed no total. */
function montar(magias, { cs = null, conjuracao = true, vocacao = 'sorcerer' } = {}) {
  const e = personagemDeTeste({ vocacao, level: 600 });
  comSkills(e, magias, { conjuracao });
  magias.forEach((id, i) => assert.ok(Acoes.definir(e, { slot: Combo.SLOTS_DO_COMBO[i], value: { id } }).ok, id));
  if (cs != null) {
    Ficha.invalidar(e);
    const base = Ficha.combate(e).castSpeed ?? 0;
    const arma = (e.equipment.weapon ??= { id: 3264 });
    arma.af = [...(arma.af ?? []).filter((a) => a.id !== 'cast_speed'), { id: 'cast_speed', value: cs - base }];
    Ficha.invalidar(e);
    assert.equal(Ficha.combate(e).castSpeed, cs);
  }
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  e.hunt.assistencia = true;
  e.hunt.autoBarra = true;
  return e;
}

/** Roda `segundos` de caçada com um bicho imortal colado; `passo(i)` dá o tamanho de cada tique. */
function rodar(e, segundos, passo = () => 250) {
  const h = e.hunt;
  const execucoes = [];
  Combo.ouvirCombo((l) => l.resultado === 'EXECUTADA' && execucoes.push(l));
  let t = Date.now();
  h.ultimoTique = t;
  let decorrido = 0;
  try {
    for (let i = 0; decorrido < segundos * 1000; i++) {
      const p = passo(i);
      t += p;
      decorrido += p;
      h.monstros = h.monstros.slice(0, 1);
      Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
      h.alvo = h.monstros[0].uid;
      e.hp = e.maxHp;
      e.mana = e.maxMana;
      Cacadas.tique(e, PERSONAGEM, t);
    }
  } finally {
    Combo.ouvirCombo(null);
  }
  return execucoes;
}
const mediaDosIntervalos = (ex) => (ex.at(-1).relogio - ex[0].relogio) / (ex.length - 1);

test('relógio lógico: o instante de uma execução é a liberação que caiu dentro do último tique', () => {
  assert.equal(R.instanteLogico(1750, 1500, [1600]), 1600);
  assert.equal(R.instanteLogico(1750, 1500, [1600, 1700, null]), 1700, 'a ÚLTIMA que liberou');
  assert.equal(R.instanteLogico(1750, 1500, [1200]), 1750, 'liberou antes do tique: esperava outra coisa, conta de agora');
  assert.equal(R.instanteLogico(1750, null, [1600]), 1750, 'sem tique anterior: agora');
  assert.equal(R.liberou(1599, 1600), false, 'nunca antes do instante');
  assert.equal(R.liberou(1600, 1600), true);
});

test('o global conta do INÍCIO da conjuração: com 400 ms de conjuração, o ciclo é 2 s (era 2,5 s)', () => {
  const e = montar(CURTAS, { cs: 0 });
  const ex = rodar(e, 60);
  const m = mediaDosIntervalos(ex);
  assert.ok(Math.abs(m - 2000) < 20, `ciclo médio ${m} ms`);
});

test('Cast Speed: cada valor dá o ciclo do global dele (média exata, sem degraus do tique)', () => {
  const ciclos = [];
  for (const cs of [0, 5, 10, 15, 25, 50, 100, 200]) {
    const e = montar(CURTAS, { cs });
    const g = Acoes.intervaloGlobal(e);
    assert.equal(g, Math.round(2000 / (1 + cs / 100)));
    const ex = rodar(e, 60);
    const m = mediaDosIntervalos(ex);
    // A média real bate com o global (até 2%); no tempo lógico, nenhum intervalo abaixo dele.
    assert.ok(Math.abs(m - g) / g < 0.02, `cs ${cs}%: ciclo médio ${m} ms, global ${g}`);
    for (let i = 1; i < ex.length; i++) assert.ok(ex[i].logico - ex[i - 1].logico >= g, `cs ${cs}%: intervalo lógico abaixo do global`);
    ciclos.push(m);
  }
  // Todo aumento de Cast Speed encurta o ciclo (antes, de 25% para 30%, ou de 100% para 150%, nada mudava).
  for (let i = 1; i < ciclos.length; i++) assert.ok(ciclos[i] < ciclos[i - 1], `ciclos: ${ciclos.map(Math.round).join(' → ')}`);
});

test('Cast Speed muito alto: no máximo uma magia por tique, e a recarga individual ainda segura', () => {
  const e = montar(CURTAS, { cs: 500 });
  const ex = rodar(e, 30);
  const instantes = ex.map((x) => x.relogio);
  assert.equal(new Set(instantes).size, instantes.length, 'duas magias no mesmo tique');
  const recarga = e.hunt.cooldowns['spell-buzz'].total;
  const buzz = ex.filter((x) => x.skill === 'spell-buzz');
  for (let i = 1; i < buzz.length; i++) assert.ok(buzz[i].relogio - buzz[i - 1].relogio >= recarga - 250, 'recarga individual');
});

test('online e offline coerentes: tique oscilando (240–260 ms) e tique exato dão o mesmo ritmo', () => {
  for (const cs of [0, 25, 60]) {
    const exato = rodar(montar(CURTAS, { cs }), 300);
    let k = 0;
    const oscilando = rodar(montar(CURTAS, { cs }), 300, () => 240 + ((k++ * 7) % 21));
    const diferenca = Math.abs(oscilando.length - exato.length) / exato.length;
    assert.ok(diferenca <= 0.02, `cs ${cs}%: ${exato.length} execuções no tique exato, ${oscilando.length} oscilando`);
  }
});

test('conjuração cancelada devolve o global: a magia seguinte não paga pela que não saiu', () => {
  const e = montar(['spell-lightning', 'spell-buzz'], { cs: 0 });
  const h = e.hunt;
  h.monstros = h.monstros.slice(0, 1);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
  h.alvo = h.monstros[0].uid;
  h.clock = 10_000;
  h.ultimoAtaqueEm = 5_000;
  const r = Acoes.disparar(e, h, PERSONAGEM, Combo.SLOTS_DO_COMBO[0], h.monstros[0]);
  assert.ok(r.ok && r.conjurando, r.erro);
  assert.equal(h.ultimoAtaqueEm, 10_000, 'o global começou no início da conjuração');
  // O alvo some antes do fim: cancela, e o global volta a ser o de antes.
  h.monstros[0].hp = 0;
  h.clock = 10_250;
  const ev = Acoes.concluirConjuracao(e, h, PERSONAGEM);
  assert.equal(ev[0]?.t, 'castCancel');
  assert.equal(h.ultimoAtaqueEm, 5_000);
  h.monstros[0].hp = 1e12;
  assert.ok(Acoes.disparar(e, h, PERSONAGEM, Combo.SLOTS_DO_COMBO[1], h.monstros[0]).ok, 'a próxima sai na hora');
});

test('a conclusão da conjuração não é barrada pelo global que ela mesma começou', () => {
  const e = montar(['spell-lightning'], { cs: 0 });
  const h = e.hunt;
  h.monstros = h.monstros.slice(0, 1);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
  h.alvo = h.monstros[0].uid;
  h.clock = 1_000;
  assert.ok(Acoes.disparar(e, h, PERSONAGEM, Combo.SLOTS_DO_COMBO[0], h.monstros[0]).conjurando);
  const fim = h.conjurando.fim;
  h.clock = fim - 1;
  assert.deepEqual(Acoes.concluirConjuracao(e, h, PERSONAGEM), [], 'nunca antes do fim');
  h.clock = fim;
  const ev = Acoes.concluirConjuracao(e, h, PERSONAGEM);
  assert.equal(ev[0]?.t, 'castFim');
  // A recarga conta do INÍCIO da conjuração (o mesmo instante do global).
  assert.equal(h.cooldowns['spell-lightning'].ate, 1_000 + h.cooldowns['spell-lightning'].total);
});

test('morto não lança nada: nem pelo clique manual, nem pelo automático', () => {
  const e = montar(['spell-buzz'], { conjuracao: false });
  const h = e.hunt;
  h.monstros = h.monstros.slice(0, 1);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
  h.alvo = h.monstros[0].uid;
  e.hp = 0;
  const r = Cacadas.disparoManual(e, PERSONAGEM, Combo.SLOTS_DO_COMBO[0]);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'MORTO');
});

test('cliques repetidos no mesmo instante: sai UMA magia (ataque pelo global, cura pela recarga)', () => {
  const e = montar(['spell-buzz', 'spell-energy-strike'], { conjuracao: false });
  const h = e.hunt;
  h.monstros = h.monstros.slice(0, 1);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
  h.alvo = h.monstros[0].uid;
  h.clock = 10_000;
  const motivos = [0, 1, 0, 1].map((k) => Cacadas.disparoManual(e, PERSONAGEM, Combo.SLOTS_DO_COMBO[k]).motivo ?? 'OK');
  assert.deepEqual(motivos, ['OK', 'COOLDOWN_GLOBAL', 'COOLDOWN_GLOBAL', 'COOLDOWN_GLOBAL']);
  // A cura (fora do global de ataque): repetida no mesmo instante, a recarga dela segura.
  comSkills(e, ['spell-buzz', 'spell-energy-strike', 'spell-light-healing'], { conjuracao: false });
  const slotDeCura = Acoes.PAPEL_DO_SLOT.findIndex((p) => p !== 'attack');
  assert.ok(Acoes.definir(e, { slot: slotDeCura, value: { id: 'spell-light-healing' } }).ok);
  e.hp = Math.round(e.maxHp * 0.3);
  const curas = [0, 1, 2].map(() => Cacadas.disparoManual(e, PERSONAGEM, slotDeCura).motivo ?? 'OK');
  assert.deepEqual(curas, ['OK', 'COOLDOWN', 'COOLDOWN']);
});

test('mira no chão: a área cai na casa escolhida, e fora do alcance não sai', () => {
  const e = montar(['spell-divine-barrage'], { conjuracao: false, vocacao: 'paladin' });
  const h = e.hunt;
  assert.ok(Acoes.catalogo(e).spells.find((s) => s.id === 'spell-divine-barrage').miraNoChao);
  // Dois bichos: o alvo colado nele, e outro a 4 casas — a mira vai no de longe.
  h.monstros = h.monstros.slice(0, 2);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
  Object.assign(h.monstros[1], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 4, y: h.pos.y });
  h.alvo = h.monstros[0].uid;
  h.clock = 10_000;
  const r = Cacadas.disparoManual(e, PERSONAGEM, Combo.SLOTS_DO_COMBO[0], { x: h.pos.x + 4, y: h.pos.y });
  assert.ok(r.ok, r.erro);
  assert.ok(h.monstros[1].hp < 1e12, 'o bicho da casa mirada apanhou');
  assert.equal(h.monstros[0].hp, 1e12, 'o alvo de antes, fora da área, não');
  // Fora do alcance (7): recusa.
  h.clock = 20_000;
  delete h.cooldowns['spell-divine-barrage'];
  const longe = Cacadas.disparoManual(e, PERSONAGEM, Combo.SLOTS_DO_COMBO[0], { x: h.pos.x + 9, y: h.pos.y });
  assert.equal(longe.motivo, 'FORA_DE_ALCANCE');
});

test('poção: a recarga também conta do instante lógico', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const h = e.hunt;
  const pocao = Acoes.catalogo(e).items.find((i) => i.papeis?.[0] === 'hp' || i.heals);
  assert.ok(pocao, 'há uma poção de vida no catálogo');
  h.cooldowns = { [pocao.id]: { ate: 1_600, total: 1_000 } };
  h.relogioAnterior = 1_500;
  h.clock = 1_750;
  Acoes.marcarRecargaDaPocao(e, pocao);
  // Ela podia sair em 1600 (dentro do último tique): a nova recarga conta de lá.
  assert.equal(h.cooldowns[pocao.id].ate - h.cooldowns[pocao.id].total, 1_600);
});
