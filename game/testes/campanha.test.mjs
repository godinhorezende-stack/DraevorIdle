// A campanha (systems/campanha.mjs): 48 fases em 4 atos, jogadas em Fácil ->
// Médio -> Difícil; completar = matar X bichos na fase; boss no fim de cada
// ato; a força dos bichos escala para a faixa de level da dificuldade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Campanha from '../systems/campanha.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { contextoDoDrop } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const F = Campanha.FASES;
const novo = (level = 8) => personagemDeTeste({ level, campanha: {} });
/** Completa as fases [de, ate) numa dificuldade, pela contagem de mortes. */
function completar(e, dif, de, ate) {
  for (let i = de; i < ate; i++) {
    const f = F[i];
    if (f.pular) continue;
    Campanha.contarKills(e, { campanha: { huntId: f.huntId, dificuldade: dif, ato: f.ato } }, f.kills[dif]);
  }
}

test('configuração: 48 fases, 4 atos de 12, X cresce e o level alvo sobe dentro de cada faixa', () => {
  assert.equal(F.length, 48);
  assert.equal(Campanha.ATOS, 4);
  for (let i = 0; i < 48; i++) assert.equal(F[i].ato, Math.floor(i / 12) + 1);
  for (const dif of Campanha.DIFICULDADES) {
    const [lo, hi] = Campanha.CAMPANHA.dificuldades[dif].faixa;
    assert.equal(F[0].nivel[dif], lo);
    assert.equal(F[47].nivel[dif], hi);
    for (let i = 1; i < 48; i++) {
      assert.ok(F[i].nivel[dif] >= F[i - 1].nivel[dif], `${dif}: fase ${i + 1} não desce de level`);
      assert.ok(F[i].kills[dif] >= F[i - 1].kills[dif], `${dif}: fase ${i + 1} não pede menos`);
    }
  }
  assert.ok(F[0].kills.medio === F[0].kills.facil * 2 && F[0].kills.dificil === F[0].kills.facil * 3);
});

test('começa na fase 1 do Fácil: só ela abre; Médio e Difícil fechados', () => {
  const e = novo();
  assert.equal(Campanha.faseLiberada(e, 'facil', F[0].huntId), true);
  assert.equal(Campanha.faseLiberada(e, 'facil', F[1].huntId), false);
  assert.equal(Campanha.dificuldadeLiberada(e, 'medio'), false);
  assert.equal(Campanha.faseLiberada(e, 'medio', F[0].huntId), false);
  assert.match(Cacadas.entrar(e, { huntId: F[1].huntId, mode: 'auto' }).erro, /Complete a fase anterior \(Troll Cave\)/);
  // Só o progresso conta: um level 1500 sem progresso também não entra.
  assert.match(Cacadas.entrar(novo(1500), { huntId: F[5].huntId, mode: 'auto' }).erro, /Complete a fase anterior/);
  assert.equal(Cacadas.entrar(e, { huntId: F[0].huntId, mode: 'auto' }).ok, true);
});

test('matar X na fase completa ela e libera a seguinte (com o aviso na tela)', () => {
  const e = novo();
  assert.equal(Cacadas.entrar(e, { huntId: F[0].huntId, mode: 'auto' }).ok, true);
  const x = F[0].kills.facil;
  Campanha.contarKills(e, e.hunt, x - 1);
  assert.equal(Campanha.faseLiberada(e, 'facil', F[1].huntId), false);
  assert.equal(Campanha.faseAtual(e, e.hunt).kills, x - 1);
  const aviso = Campanha.contarKills(e, e.hunt, 1);
  assert.match(aviso, /Fase completa: Troll Cave \(Fácil\)! Liberou Amazon Camp/);
  assert.equal(Campanha.faseLiberada(e, 'facil', F[1].huntId), true);
  assert.equal(Campanha.faseAtual(e, e.hunt).completa, true);
  // Depois de completa, não conta mais (e não passa do X).
  Campanha.contarKills(e, e.hunt, 50);
  assert.equal(Campanha.faseAtual(e, e.hunt).kills, x);
});

test('fim do ato: o boss abre com as 12 fases; a 1ª vitória libera o ato seguinte', () => {
  const e = novo();
  completar(e, 'facil', 0, 11);
  assert.equal(Campanha.bossLiberado(e, 'facil', 1), false, 'falta a 12ª fase');
  completar(e, 'facil', 11, 12);
  assert.equal(Campanha.bossLiberado(e, 'facil', 1), true);
  assert.equal(Campanha.faseLiberada(e, 'facil', F[12].huntId), false, 'o Ato 2 espera o boss');
  assert.match(Campanha.motivoParaNaoEntrar(e, 'facil', F[12].huntId), /Derrote o boss do Ato 1/);
  const boss = Campanha.bossDoAto(1);
  // A primeira tentativa: sem level, sem task e sem recarga.
  const r = Cacadas.entrar(e, { huntId: boss.bossId, mode: 'auto', dificuldade: 'facil', campanha: true });
  assert.equal(r.ok, true, r.erro);
  assert.equal(e.hunt.campanha.bossDoAto, 1);
  assert.match(Campanha.venceuBoss(e, 'facil', 1), /Ato 1 concluído no Fácil! O Ato 2 está liberado/);
  assert.equal(Campanha.faseLiberada(e, 'facil', F[12].huntId), true);
});

test('boss de ato fechado: não entra sem as 12 fases', () => {
  const e = novo();
  const r = Cacadas.entrar(e, { huntId: Campanha.bossDoAto(1).bossId, mode: 'auto', dificuldade: 'facil', campanha: true });
  assert.equal(r.ok, false);
  assert.match(r.erro, /Complete as 12 fases do Ato 1/);
});

test('terminou o Fácil (boss do Ato 4): abre o Médio; as hunts quebradas contam sozinhas', () => {
  const e = novo();
  for (let ato = 1; ato <= 4; ato++) {
    completar(e, 'facil', (ato - 1) * 12, ato * 12);
    Campanha.venceuBoss(e, 'facil', ato);
  }
  assert.equal(Campanha.dificuldadeLiberada(e, 'medio'), true);
  assert.equal(Campanha.faseLiberada(e, 'medio', F[0].huntId), true);
  assert.equal(Campanha.dificuldadeLiberada(e, 'dificil'), false);
  for (const f of F.filter((x) => x.pular)) assert.equal(Campanha.faseCompleta(e, 'medio', f.huntId), true, `${f.nome} se pula`);
});

test('a força dos bichos: a mesma Troll Cave é fraca no Fácil e muito forte no Difícil', () => {
  const pegar = (dif) => {
    const e = personagemDeTeste({ level: 2000 });
    assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto', dificuldade: dif }).ok, true);
    const m = e.hunt.monstros[0];
    return { hp: m.maxHp, exp: m.exp, forca: m.forca, escala: e.hunt.escala };
  };
  const [f, m, d] = ['facil', 'medio', 'dificil'].map(pegar);
  assert.ok(f.hp < m.hp && m.hp < d.hp, `vida: ${f.hp} < ${m.hp} < ${d.hp}`);
  assert.ok(f.exp < m.exp && m.exp < d.exp);
  assert.ok(f.forca < m.forca && m.forca < d.forca);
  // E a Walking Pillar do Fácil (alvo 100) fica mais FRACA que a original (1200).
  const e = personagemDeTeste({ level: 2000 });
  assert.equal(Cacadas.entrar(e, { huntId: 'walking-pillar', mode: 'auto', dificuldade: 'facil' }).ok, true);
  assert.ok(e.hunt.escala.vida < 1 && e.hunt.escala.dano < 1);
});

test('bicho que renasce volta com a força da fase', () => {
  const e = personagemDeTeste({ level: 2000 });
  assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto', dificuldade: 'dificil' }).ok, true);
  const m = e.hunt.monstros[0];
  const vida = m.maxHp;
  const [x, y] = [m.x, m.y];
  e.hunt.monstros.splice(0, 1);
  e.hunt.respawns = [{ ...m.spawn, x, y, volta: 0 }];
  e.hunt.pos = { x: x + 5, y: y + 5, dir: 2 };
  Cacadas.tique(e, PERSONAGEM, Date.now() + 250);
  const volta = e.hunt.monstros.find((b) => b.x === x && b.y === y);
  assert.ok(volta, 'renasceu');
  assert.equal(volta.maxHp, vida);
});

test('o loot da fase usa o ato e a dificuldade dela', () => {
  const e = personagemDeTeste({ level: 2000 });
  assert.equal(Cacadas.entrar(e, { huntId: F[30].huntId, mode: 'auto', dificuldade: 'dificil' }).ok, true);
  assert.deepEqual(contextoDoDrop(e.hunt), { ato: 3, dificuldade: 'dificil' });
});

test('caçada offline projetada: as mortes contam para a fase', () => {
  const e = novo(60);
  e.stamina = 2520;
  assert.equal(Cacadas.entrar(e, { huntId: F[0].huntId, mode: 'auto' }).ok, true);
  e.hunt.offlineDesde = Date.now() - 3 * 3_600_000;
  Cacadas.simularAusencia(e, PERSONAGEM, Date.now());
  assert.equal(Campanha.faseCompleta(e, 'facil', F[0].huntId), true, `kills: ${JSON.stringify(e.campanha.facil.kills)}`);
});

test('a tela: a campanha inteira por dificuldade e a fase atual no quadro da caçada', () => {
  const e = novo();
  const c = Campanha.paraCliente(e);
  assert.deepEqual(c.dificuldades.map((d) => [d.id, d.liberada]), [['facil', true], ['medio', false], ['dificil', false]]);
  assert.equal(c.dificuldades[0].fases.length, 48);
  assert.equal(c.dificuldades[0].bosses.length, 4);
  assert.equal(Cacadas.entrar(e, { huntId: F[0].huntId, mode: 'auto' }).ok, true);
  const snap = Cacadas.snapshotDaHunt(e);
  assert.equal(snap.fase.nome, 'Troll Cave');
  assert.equal(snap.fase.precisa, F[0].kills.facil);
});

test('nenhuma magia de bicho sai a cada tique (Werehyaenna North vinha com intervalo 2 = segundos)', async () => {
  const { readFileSync } = await import('node:fs');
  for (const [arq, chave] of [['monstro-poderes.json', 'monstros'], ['boss-poderes.json', 'bosses']]) {
    const dados = JSON.parse(readFileSync(new URL(`../gamedata/${arq}`, import.meta.url), 'utf8'))[chave];
    for (const [id, m] of Object.entries(dados)) {
      for (const a of [...(m.ataques ?? []), ...(m.curas ?? [])]) assert.ok(a.intervalo >= 500, `${arq}: ${id} com intervalo ${a.intervalo} ms`);
    }
  }
});

test('caçada de antes da campanha: fase liberada vira a fase; fechada termina com aviso', () => {
  // Liberada (Troll Cave, fase 1): ganha a fase, a força dela e a barra.
  const e = novo(20);
  assert.equal(Cacadas.entrar(e, { huntId: F[0].huntId, mode: 'auto' }).ok, true);
  delete e.hunt.campanha;
  delete e.hunt.escala;
  assert.equal(Cacadas.adotarNaCampanha(e), null);
  assert.deepEqual(e.hunt.campanha, { huntId: F[0].huntId, dificuldade: 'facil', ato: 1 });
  assert.ok(e.hunt.escala);
  assert.equal(Cacadas.snapshotDaHunt(e).fase.nome, 'Troll Cave');
  // Fechada (fase 6 sem progresso): a caçada termina e o aviso explica.
  const f = personagemDeTeste({ level: 200 });
  assert.equal(Cacadas.entrar(f, { huntId: F[5].huntId, mode: 'auto' }).ok, true);
  delete f.hunt.campanha;
  f.campanha = {};
  assert.match(Cacadas.adotarNaCampanha(f), /A campanha chegou.*Complete a fase anterior/);
  assert.equal(f.hunt, null);
  // Caçada da campanha, ou que não é fase: não mexe.
  const g = novo(20);
  assert.equal(Cacadas.entrar(g, { huntId: F[0].huntId, mode: 'auto' }).ok, true);
  const antes = JSON.stringify(g.hunt.campanha);
  assert.equal(Cacadas.adotarNaCampanha(g), null);
  assert.equal(JSON.stringify(g.hunt.campanha), antes);
});
