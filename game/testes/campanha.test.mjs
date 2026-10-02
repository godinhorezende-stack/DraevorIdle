// A campanha (systems/campanha.mjs): 48 fases em 4 atos, jogadas em Fácil ->
// Médio -> Difícil; completar = LIMPAR uma instância da fase (sem respawn —
// ver hunt/instancia.mjs); boss no fim de cada ato; a força dos bichos escala
// para a faixa de level da dificuldade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Campanha from '../systems/campanha.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { spawnsDaHunt } from '../systems/hunt/terreno.mjs';
import { contextoDoDrop } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const F = Campanha.FASES;
const novo = (level = 8) => personagemDeTeste({ level, campanha: {} });
/** Completa as fases [de, ate) numa dificuldade: uma limpeza de instância em cada. */
function completar(e, dif, de, ate) {
  for (let i = de; i < ate; i++) {
    const f = F[i];
    if (f.pular) continue;
    Campanha.limpou(e, { campanha: { huntId: f.huntId, dificuldade: dif, ato: f.ato } });
  }
}

test('configuração: 48 fases, 4 atos de 12, e o level alvo sobe dentro de cada faixa', () => {
  assert.equal(F.length, 48);
  assert.equal(Campanha.ATOS, 4);
  for (let i = 0; i < 48; i++) assert.equal(F[i].ato, Math.floor(i / 12) + 1);
  for (const dif of Campanha.DIFICULDADES) {
    const [lo, hi] = Campanha.CAMPANHA.dificuldades[dif].faixa;
    assert.equal(F[0].nivel[dif], lo);
    assert.equal(F[47].nivel[dif], hi);
    for (let i = 1; i < 48; i++) {
      assert.ok(F[i].nivel[dif] >= F[i - 1].nivel[dif], `${dif}: fase ${i + 1} não desce de level`);
    }
  }
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

test('limpar a instância completa a fase e libera a seguinte (com o "Hunt Clear!" na tela)', () => {
  const e = novo();
  assert.equal(Cacadas.entrar(e, { huntId: F[0].huntId, mode: 'auto' }).ok, true);
  assert.ok(e.hunt.instancia && e.hunt.instancia.status === 'ativa');
  assert.equal(Campanha.faseLiberada(e, 'facil', F[1].huntId), false);
  // Todos menos um mortos: ainda não.
  const vivos = () => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares).flat()];
  for (const m of vivos().slice(1)) m.hp = 0;
  Cacadas.tique(e, PERSONAGEM, Date.now() + 250);
  assert.equal(e.hunt.instancia.status, 'ativa');
  assert.equal(Campanha.faseCompleta(e, 'facil', F[0].huntId), false);
  // O último: CLEAR, fase completa, a seguinte liberada.
  for (const m of vivos()) m.hp = 0;
  Cacadas.tique(e, PERSONAGEM, Date.now() + 500);
  assert.equal(e.hunt.instancia.status, 'limpa');
  assert.match(e.avisoDaHunt, /Hunt Clear! Fase completa: Troll Cave \(Normal\). Liberou Amazon Camp/);
  assert.equal(Campanha.faseLiberada(e, 'facil', F[1].huntId), true);
  assert.equal(Campanha.faseAtual(e, e.hunt).completa, true);
});

test('sem respawn; depois da pausa do "Hunt Clear!", uma instância NOVA (outro id, bichos sorteados de novo)', () => {
  const e = novo();
  assert.equal(Cacadas.entrar(e, { huntId: F[0].huntId, mode: 'auto' }).ok, true);
  const primeira = e.hunt.instancia;
  const uidsAntes = new Set(e.hunt.monstros.map((m) => m.uid));
  // Matar um não agenda respawn.
  e.hunt.monstros[0].hp = 0;
  let t = Date.now();
  e.hunt.ultimoTique = t;
  Cacadas.tique(e, PERSONAGEM, (t += 250));
  assert.equal(e.hunt.respawns.length, 0, 'nada na fila de respawn');
  for (const m of [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares).flat()]) m.hp = 0;
  Cacadas.tique(e, PERSONAGEM, (t += 250));
  assert.equal(e.hunt.instancia.status, 'limpa');
  for (let i = 0; i < 16; i++) Cacadas.tique(e, PERSONAGEM, (t += 250));
  const segunda = e.hunt.instancia;
  assert.notEqual(segunda.id, primeira.id);
  assert.equal(segunda.status, 'ativa');
  assert.ok(e.hunt.monstros.every((m) => !uidsAntes.has(m.uid)), 'bichos novos');
  // Repetir limpo conta a limpeza, sem "completar" de novo.
  for (const m of [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares).flat()]) m.hp = 0;
  Cacadas.tique(e, PERSONAGEM, (t += 250));
  assert.match(e.avisoDaHunt, /Hunt Clear! Troll Cave \(Normal\) limpa/);
  assert.equal(e.campanha.facil.limpezas[F[0].huntId], 2);
});

test('a instância nasce dos SPAWNS DO MAPA, igual em toda dificuldade, e o progresso é o % limpo', () => {
  const tam = (dif) => {
    const e = personagemDeTeste({ level: 2000 });
    assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto', dificuldade: dif }).ok, true);
    return e;
  };
  const e = tam('facil');
  const spawns = spawnsDaHunt('troll-cave');
  const doMapa = spawns.reduce((n, s) => n + s.quantidade, 0);
  assert.equal(e.hunt.instancia.objetivos.total, doMapa, 'um objetivo por bicho que o mapa define');
  assert.equal(tam('dificil').hunt.instancia.objetivos.total, doMapa);
  // Cada bicho está no raio do spawn dele e leva o id da instância.
  const porId = new Map(spawns.map((s) => [s.id, s]));
  for (const m of [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares).flat()]) {
    const s = porId.get(m.spawnId);
    assert.ok(s, 'bicho sem spawn do mapa');
    assert.ok(Math.max(Math.abs(m.x - s.x), Math.abs(m.y - s.y)) <= s.raio, `${m.name} fora do raio do ${s.id}`);
    assert.ok(s.criaturas.some((c) => c.key === m.key));
    assert.equal(m.instancia, e.hunt.instancia.id);
  }
  // Metade morta = 50%.
  const todos = [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares).flat()];
  for (const m of todos.slice(0, doMapa / 2)) m.hp = 0;
  assert.equal(Cacadas.snapshotDaHunt(e).instancia.percentual, 50);
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
  assert.match(Campanha.venceuBoss(e, 'facil', 1), /Ato 1 concluído no Normal! O Ato 2 está liberado/);
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
  // E a Warzone 2 do Fácil (alvo 92) fica mais FRACA que a original (550).
  const e = personagemDeTeste({ level: 2000 });
  assert.equal(Cacadas.entrar(e, { huntId: 'warzone-2', mode: 'auto', dificuldade: 'facil' }).ok, true);
  assert.ok(e.hunt.escala.vida < 1 && e.hunt.escala.dano < 1);
});


test('o loot da fase usa o ato e a dificuldade dela, e o Item Level é o level alvo da fase', () => {
  const e = personagemDeTeste({ level: 2000 });
  assert.equal(Cacadas.entrar(e, { huntId: F[30].huntId, mode: 'auto', dificuldade: 'dificil' }).ok, true);
  assert.deepEqual(contextoDoDrop(e.hunt), { ato: 3, dificuldade: 'dificil', itemLevel: e.hunt.escala.nivel });
  assert.equal(e.hunt.escala.nivel, F[30].nivel.dificil);
});

test('caçada offline: limpa a instância (conta para a fase) e fica em loop mesmo com "Seguir"', () => {
  const e = novo(60);
  e.settings = { aoCompletarFase: 'seguir' };
  e.stamina = 2520;
  assert.equal(Cacadas.entrar(e, { huntId: F[0].huntId, mode: 'auto' }).ok, true);
  e.hunt.offlineDesde = Date.now() - 3 * 3_600_000;
  Cacadas.simularAusencia(e, PERSONAGEM, Date.now());
  assert.equal(Campanha.faseCompleta(e, 'facil', F[0].huntId), true, `limpezas: ${JSON.stringify(e.campanha.facil.limpezas)}`);
  // Offline sempre na mesma hunt: a projeção não troca de fase (o Avançar é só no tique online).
  assert.equal(e.hunt.huntId, F[0].huntId);
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
  assert.equal(snap.instancia.total, e.hunt.instancia.objetivos.total);
  assert.equal(snap.instancia.percentual, 0);
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

test('caçada de antes da instância: fase liberada entra de novo como instância; fechada termina com aviso', () => {
  // De antes da campanha (sem `campanha` nem `instancia`), fase liberada: vira a fase, já como instância.
  const e = novo(20);
  assert.equal(Cacadas.entrar(e, { huntId: F[0].huntId, mode: 'auto' }).ok, true);
  delete e.hunt.campanha;
  delete e.hunt.escala;
  delete e.hunt.instancia;
  assert.equal(Cacadas.adotarNaCampanha(e), null);
  assert.deepEqual(e.hunt.campanha, { huntId: F[0].huntId, dificuldade: 'facil', ato: 1 });
  assert.ok(e.hunt.escala);
  assert.equal(e.hunt.instancia?.status, 'ativa');
  assert.equal(Cacadas.snapshotDaHunt(e).fase.nome, 'Troll Cave');
  // De depois da campanha e antes das instâncias (tem `campanha`, não tem `instancia`): mesma dificuldade.
  const m = personagemDeTeste({ level: 2000 });
  assert.equal(Cacadas.entrar(m, { huntId: F[3].huntId, mode: 'auto', dificuldade: 'medio' }).ok, true);
  delete m.hunt.instancia;
  assert.equal(Cacadas.adotarNaCampanha(m), null);
  assert.equal(m.hunt.campanha.dificuldade, 'medio');
  assert.equal(m.hunt.instancia?.status, 'ativa');
  // Fechada (fase 6 sem progresso): a caçada termina e o aviso explica.
  const f = personagemDeTeste({ level: 200 });
  assert.equal(Cacadas.entrar(f, { huntId: F[5].huntId, mode: 'auto' }).ok, true);
  delete f.hunt.campanha;
  delete f.hunt.instancia;
  f.campanha = {};
  assert.match(Cacadas.adotarNaCampanha(f), /A campanha chegou.*Complete a fase anterior/);
  assert.equal(f.hunt, null);
  // Já é instância: não mexe.
  const g = novo(20);
  assert.equal(Cacadas.entrar(g, { huntId: F[0].huntId, mode: 'auto' }).ok, true);
  const antes = g.hunt.instancia.id;
  assert.equal(Cacadas.adotarNaCampanha(g), null);
  assert.equal(g.hunt.instancia.id, antes);
});


test('"Ficar na fase" (padrão) fica em loop; "Avançar sozinho" vai para a próxima com a fase completa', () => {
  const e = novo(20);
  assert.equal(Cacadas.entrar(e, { huntId: F[0].huntId, mode: 'auto' }).ok, true);
  assert.equal(Campanha.aoCompletar(e), 'repetir');
  assert.equal(Cacadas.faseParaSeguir(e), null, 'incompleta: fica');
  Campanha.limpou(e, e.hunt);
  assert.equal(Cacadas.faseParaSeguir(e), null, 'repetir: fica em loop');
  assert.match(Cacadas.snapshotDaHunt(e).fase.aoCompletar, /repetir/);

  // Já numa fase COMPLETA, ligar o "Avançar" leva para a próxima na hora.
  assert.equal(Cacadas.definirAoCompletarFase(e, { value: 'seguir' }).ok, true);
  assert.equal(Cacadas.definirAoCompletarFase(e, { value: 'x' }).ok, false);
  assert.deepEqual(Cacadas.faseParaSeguir(e), { huntId: F[1].huntId, dificuldade: 'facil', nome: F[1].nome });
  const snap = Cacadas.snapshotDaHunt(e).fase;
  assert.equal(snap.aoCompletar, 'seguir');
  assert.equal(snap.fimDoAto, false);
});

test('"Seguir" no fim do ato não entra no boss; e pula a hunt quebrada/travada', () => {
  const e = novo(20);
  e.settings = { aoCompletarFase: 'seguir' };
  completar(e, 'facil', 0, 11);
  assert.equal(Campanha.proximaParaSeguir(e, 'facil', F[10].huntId).huntId, F[11].huntId);
  completar(e, 'facil', 11, 12);
  assert.equal(Campanha.proximaParaSeguir(e, 'facil', F[11].huntId), null, 'depois da 12ª vem o boss: fica');
  const quebrada = F.findIndex((f) => f.pular);
  if (quebrada > 0 && F[quebrada + 1]?.ato === F[quebrada - 1].ato) {
    const g = novo(20);
    for (let a = 1; a < F[quebrada].ato; a++) { completar(g, 'facil', (a - 1) * 12, a * 12); Campanha.venceuBoss(g, 'facil', a); }
    completar(g, 'facil', (F[quebrada].ato - 1) * 12, quebrada + 1);
    // A próxima é a primeira do ato que NÃO é travada; se o resto do ato inteiro é travado, fica onde está.
    const seguinte = F.slice(quebrada + 1).find((f) => f.ato === F[quebrada].ato && !f.pular);
    const vem = Campanha.proximaParaSeguir(g, 'facil', F[quebrada - 1].huntId);
    assert.equal(vem?.huntId ?? null, seguinte?.huntId ?? null);
  }
});

test('fase travada (pular): ninguém entra — nem pelo servidor —, e ela conta como completa', () => {
  const travadas = ['dark-thais'];
  for (const id of travadas) {
    assert.equal(F.find((f) => f.huntId === id).pular, true, id);
    const e = novo(2000);
    for (const dif of ['facil']) {
      assert.equal(Campanha.faseLiberada(e, dif, id), false, `${id}: não liberada`);
      assert.equal(Campanha.faseCompleta(e, dif, id), true, `${id}: conta como completa`);
    }
    const r = Cacadas.entrar(personagemDeTeste({ level: 2000 }), { huntId: id, mode: 'auto', dificuldade: 'facil' });
    assert.equal(r.ok, false, `${id}: o servidor recusa a entrada`);
    assert.match(r.erro, /travada/, `${id}: o motivo diz que está travada`);
  }
});

test('Infernatil Seal, Jaded Roots e Walking Pillar têm mapa (replicado de outro) e abrem com os bichos DELAS', async () => {
  const { REPLICAS } = await import('../../tools/replicar-mapa-com-mobs.mjs');
  const { CATALOGO } = await import('../systems/dados.mjs');
  for (const [id, doador] of Object.entries(REPLICAS)) {
    assert.ok(!F.find((f) => f.huntId === id).pular, `${id} não está mais travada`);
    const e = personagemDeTeste({ level: 2000 });
    const r = Cacadas.entrar(e, { huntId: id, mode: 'auto', dificuldade: 'facil' });
    assert.equal(r.ok, true, `${id}: ${r.erro ?? 'entra'}`);
    const dela = new Set(CATALOGO.hunts.find((h) => h.id === id).creatures.map((c) => c.key));
    assert.ok(e.hunt.monstros.length > 0, `${id}: tem bichos`);
    for (const m of e.hunt.monstros) assert.ok(dela.has(m.key), `${id}: ${m.key} é da hunt (e não do doador ${doador})`);
  }
});

test('replicar(): o terreno do doador, os spawns (posição/quantidade) dele, e SÓ as criaturas do alvo', async () => {
  const { replicar } = await import('../../tools/replicar-mapa-com-mobs.mjs');
  const { readFileSync } = await import('node:fs');
  const { CATALOGO } = await import('../systems/dados.mjs');
  const doador = JSON.parse(readFileSync(new URL('../gamedata/hunts/feru-way-map.json', import.meta.url), 'utf8'));
  const mapa = replicar('infernatil-seal', 'feru-way');
  assert.deepEqual(mapa.blocked, doador.blocked, 'o terreno é o do doador');
  assert.equal(mapa.spawns.length, doador.spawns.length);
  const dela = new Set(CATALOGO.hunts.find((h) => h.id === 'infernatil-seal').creatures.map((c) => c.key));
  mapa.spawns.forEach((s, i) => {
    assert.deepEqual([s.x, s.y, s.z, s.raio, s.quantidade], [doador.spawns[i].x, doador.spawns[i].y, doador.spawns[i].z, doador.spawns[i].raio, doador.spawns[i].quantidade]);
    assert.ok(dela.has(s.criaturas[0].key));
  });
  assert.equal(new Set(mapa.spawns.map((s) => s.criaturas[0].key)).size, dela.size, 'todas as criaturas aparecem');
});

test('a fase depois de uma travada NÃO abre de graça: exige a última fase de verdade antes dela', () => {
  const dark = F.findIndex((f) => f.huntId === 'dark-thais');
  const seguinte = F[dark + 1]; // Infernatil Seal
  const e = novo(2000);
  assert.equal(Campanha.faseLiberada(e, 'facil', seguinte.huntId), false, 'sem progresso nenhum: fechada');
  assert.equal(Campanha.faseExigida(Campanha.faseDe(seguinte.huntId)).huntId, F[dark - 1].huntId, 'exige a Warzone 2, e não a travada');
  // Completa o jogo até a Warzone 2 (com os bosses dos atos de trás): abre.
  const g = novo(2000);
  for (let a = 1; a < seguinte.ato; a++) { completar(g, 'facil', (a - 1) * 12, a * 12); Campanha.venceuBoss(g, 'facil', a); }
  completar(g, 'facil', (seguinte.ato - 1) * 12, dark);
  assert.equal(Campanha.faseLiberada(g, 'facil', seguinte.huntId), true);
  // Sem nada feito, a primeira do ato que falta é a que o aviso pede.
  const primeiraDoAto = F.find((f) => f.ato === seguinte.ato && !f.pular);
  assert.match(Campanha.motivoParaNaoEntrar(e, 'facil', seguinte.huntId), new RegExp(primeiraDoAto.nome));
});

test('fase "completa" por carona (party) sem a anterior NÃO abre as seguintes: a liberação olha a cadeia inteira do ato', () => {
  const e = novo(2000);
  completar(e, 'facil', 0, 5); // fases 1-5 completas
  // A 7 e a 8 saem "completas" (limpeza dividida na party) — a 6 continua por fazer.
  Campanha.limpou(e, { campanha: { huntId: F[6].huntId, dificuldade: 'facil', ato: 1 } });
  Campanha.limpou(e, { campanha: { huntId: F[7].huntId, dificuldade: 'facil', ato: 1 } });
  assert.equal(Campanha.faseCompleta(e, 'facil', F[6].huntId), true);
  assert.equal(Campanha.faseLiberada(e, 'facil', F[5].huntId), true, 'a 6 está aberta');
  assert.equal(Campanha.faseLiberada(e, 'facil', F[6].huntId), false, 'a 7 fica fechada');
  assert.equal(Campanha.faseLiberada(e, 'facil', F[7].huntId), false, 'a 8 fica fechada');
  assert.equal(Campanha.faseLiberada(e, 'facil', F[8].huntId), false, 'e a 9 também');
  assert.match(Campanha.motivoParaNaoEntrar(e, 'facil', F[8].huntId), new RegExp(F[5].nome));
  // Fez a 6: tudo abre de uma vez (as duas por carona já contam).
  Campanha.limpou(e, { campanha: { huntId: F[5].huntId, dificuldade: 'facil', ato: 1 } });
  assert.equal(Campanha.faseLiberada(e, 'facil', F[8].huntId), true);
});
