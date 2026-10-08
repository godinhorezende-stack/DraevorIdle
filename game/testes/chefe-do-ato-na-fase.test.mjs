// O CHEFE DO ATO sai de um PORTAL na última fase, na mesma instância (dono, 08/10: "queria que abrisse o portal com o boss na fase: ele não
// direciona para outra instância — aparece o boss na fase quando limpa tudo"; "antes de nascer abre esse portal e ele sai dele; quando ele
// sai, fecha o portal — respeitando a regra da fase, no Ato 1 é a limpeza para abrir"). No Draevor clássico continua a sala do boss.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Campanha = await import('../systems/campanha.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const Instancia = await import('../systems/hunt/instancia.mjs');

const ULTIMA = () => Campanha.ultimaFaseDoAto(1).huntId; // a Caverna da Ira
const vivos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()].filter((m) => m.hp > 0);

/** Um personagem com os atos de antes vencidos e o ato da fase `huntId` feito menos ela, caçando nela. */
function naFase(huntId) {
  const ato = Campanha.faseDe(huntId).ato;
  const e = personagemDeTeste({ vocacao: 'knight', level: ato === 1 ? 30 : 90 });
  e.hp = e.maxHp = 1e9;
  e.sistema = 'poe';
  const completas = Campanha.FASES.filter((f) => f.ato <= ato && f.huntId !== huntId).map((f) => f.huntId);
  e.campanha = { facil: { completas, bosses: Array.from({ length: ato - 1 }, (_, i) => i + 1) } };
  Bolsa.garantir(e);
  const r = Cacadas.entrar(e, { huntId, mode: 'auto', strategy: 'nearest', dificuldade: 'facil' });
  assert.ok(r.ok, r.erro);
  return e;
}
/** A caçada anda `ms` (tiques de 250 ms) e devolve os eventos. */
function andar(e, ms, relogio) {
  const eventos = [];
  for (let t = 0; t < ms && e.hunt; t += 250) eventos.push(...(Cacadas.tique(e, PERSONAGEM, (relogio.agora += 250)) ?? []));
  return eventos;
}
/** Mata tudo o que há (menos o chefe do ato) até a instância ficar limpa. */
function limpar(e, relogio) {
  const eventos = [];
  for (let i = 0; i < 40 && e.hunt.instancia.status !== 'limpa'; i++) {
    for (const m of vivos(e)) if (!m.chefeDoAto) m.hp = 0;
    eventos.push(...andar(e, 250, relogio));
  }
  assert.equal(e.hunt.instancia.status, 'limpa', 'a instância limpou');
  return eventos;
}

test('Ato 1: limpar a última fase abre o PORTAL na instância (sem sala); o chefe sai dele, e a instância espera ele morrer', { skip: SEM }, () => {
  assert.equal(Campanha.chefeDoAtoNaFase(), true);
  const e = naFase(ULTIMA());
  const relogio = { agora: Date.now() };
  const idDaInstancia = e.hunt.instancia.id;
  const eventos = limpar(e, relogio);
  const portal = e.hunt.instancia.chefeDoAto;
  assert.ok(portal, 'o portal abriu');
  assert.equal(portal.ato, 1);
  assert.equal(e.hunt.portalDoBoss ?? null, null, 'nada de portal para a sala do boss');
  assert.ok(eventos.some((ev) => ev.t === 'portal' && ev.x === portal.x && ev.y === portal.y && ev.asset === 'fabrica-portal-do-chefe'), 'o vórtice na tela');
  assert.match(e.avisoDaHunt ?? '', /portal se abre/);
  // Ainda não saiu: o portal fica aberto um instante.
  assert.ok(!vivos(e).some((m) => m.chefeDoAto), 'o chefe ainda não saiu');
  // Tique a tique até ele sair (o portal fica aberto ~1,5 s): ele nasce na casa do portal.
  let chefe = null;
  for (let i = 0; i < 12 && !chefe; i++) {
    andar(e, 250, relogio);
    chefe = vivos(e).find((m) => m.chefeDoAto === 1) ?? null;
  }
  assert.ok(chefe, 'o chefe saiu do portal');
  assert.ok((e.hunt.clock ?? 0) >= portal.saiEm, 'depois do portal aberto');
  assert.deepEqual([chefe.x, chefe.y], [portal.x, portal.y], 'na casa do portal');
  assert.ok(chefe.boss, 'é o boss único do ato (a mesma ficha da sala do boss)');
  assert.ok(Campanha.bossDoAto(1).nome.startsWith(chefe.name), `${chefe.name} — ${Campanha.bossDoAto(1).nome}`);
  // Enquanto ele vive, a instância não é trocada (a pausa do "Hunt Clear!" passa e nada muda).
  andar(e, 15_000, relogio);
  assert.equal(e.hunt.instancia.id, idDaInstancia, 'a mesma instância');
  assert.ok(vivos(e).some((m) => m.uid === chefe.uid), 'o chefe continua lá');
  // Matá-lo vence o Ato 1: o Ato 2 abre. E a caçada continua (não volta para a cidade como a sala do boss).
  const proxima = Campanha.FASES.find((f) => f.ato === 2).huntId;
  assert.equal(Campanha.faseLiberada(e, 'facil', proxima), false);
  const sacolas = (e.rewards ?? []).length;
  chefe.hp = 0;
  andar(e, 500, relogio);
  assert.equal(Campanha.bossVencido(e, 'facil', 1), true, 'o chefe do Ato 1 vencido');
  assert.equal(Campanha.faseLiberada(e, 'facil', proxima), true, 'o Ato 2 abriu');
  assert.ok((e.rewards ?? []).length > sacolas, 'a sacola do chefe');
  assert.ok(e.hunt, 'a caçada segue');
  assert.equal(e.hunt.instancia.chefeDoAto.vencido, true);
  // Morto o chefe, a próxima instância vem (e o portal não se repete nesta).
  andar(e, 15_000, relogio);
  assert.notEqual(e.hunt.instancia.id, idDaInstancia, 'instância nova depois da vitória');
});

test('a party na sala também vence o ato quando o chefe morre, e cada um leva a sua sacola do chefe', { skip: SEM }, () => {
  const a = naFase(ULTIMA());
  const b = naFase(ULTIMA());
  assert.notEqual(Cacadas.entrarNaSala(b, a.hunt, []).ok, false);
  Object.defineProperty(a.hunt, 'partilha', { value: { ativa: true, bonus: 1, membros: [{ estado: a, nome: 'a' }, { estado: b, nome: 'b' }], naSala: [a, b] }, configurable: true, writable: true });
  const relogio = { agora: Date.now() };
  limpar(a, relogio);
  andar(a, 2000, relogio);
  const chefe = vivos(a).find((m) => m.chefeDoAto === 1);
  assert.ok(chefe, 'o chefe saiu do portal');
  const sacolas = [a, b].map((e) => (e.rewards ?? []).length);
  chefe.hp = 0;
  andar(a, 500, relogio);
  assert.equal(Campanha.bossVencido(a, 'facil', 1), true, 'quem matou');
  assert.equal(Campanha.bossVencido(b, 'facil', 1), true, 'e o outro da party na sala');
  // Na sala do boss cada um lutava e levava a sua sacola: na fase também (cada uma sorteada com o loot de quem leva).
  assert.ok((a.rewards ?? []).length > sacolas[0], 'a sacola de quem matou');
  assert.ok((b.rewards ?? []).length > sacolas[1], 'e a do outro da party');
  assert.notEqual(a.rewards.at(-1), b.rewards.at(-1), 'cada um a sua');
});

test('fase do meio do ato não abre portal (no Ato 1 a regra é limpar a última — a única fase obrigatória)', { skip: SEM }, () => {
  assert.deepEqual(Campanha.ATOS_DO_EDITOR.get(1).ato.fases.filter((x) => x.obrigatoria).map((x) => x.huntId), [ULTIMA()]);
  const meio = Campanha.FASES.find((f) => f.ato === 1 && f.huntId !== ULTIMA() && Campanha.conclusaoDa(f.huntId).tipo === 'limpar-hunt');
  const e = naFase(meio.huntId);
  limpar(e, { agora: Date.now() });
  assert.equal(e.hunt.instancia.chefeDoAto ?? null, null, 'fase do meio: nada');
  // E sem o chefe pendente, a instância segue o ciclo de sempre (a próxima vem depois da pausa).
  assert.equal(Cacadas.chefeDoAtoPendente(e.hunt), false);
  assert.equal(Instancia.horaDaProxima(e.hunt, e.hunt.clock + 60_000), true);
});

test('refazer a última fase com o ato já vencido: ao entrar, nada; limpar só parte não abre; limpar tudo abre o portal de novo (sem espera), uma vez', { skip: SEM }, () => {
  const e = naFase(ULTIMA());
  const relogio = { agora: Date.now() };
  limpar(e, relogio);
  andar(e, 2000, relogio);
  vivos(e).find((m) => m.chefeDoAto === 1).hp = 0;
  andar(e, 500, relogio);
  assert.equal(Campanha.bossVencido(e, 'facil', 1), true);
  for (let i = 0; i < 2; i++) {
    e.hunt = null;
    assert.equal(Cacadas.entrar(e, { huntId: ULTIMA(), mode: 'auto', strategy: 'nearest', dificuldade: 'facil' }).ok, true);
    assert.equal(e.hunt.instancia.chefeDoAto ?? null, null, 'ao entrar: nada de portal');
    // Só parte dos bichos: a instância não limpa e o portal não abre.
    const todos = vivos(e);
    for (const m of todos.slice(0, Math.max(1, todos.length - 1))) m.hp = 0;
    andar(e, 500, relogio);
    assert.notEqual(e.hunt.instancia.status, 'limpa');
    assert.equal(e.hunt.instancia.chefeDoAto ?? null, null, 'limpeza parcial: nada');
    limpar(e, relogio);
    const portal = e.hunt.instancia.chefeDoAto;
    assert.ok(portal, `limpou de novo: o portal abre de novo (vez ${i + 1})`);
    const limpezas = e.campanha.facil.limpezas?.[ULTIMA()];
    andar(e, 750, relogio);
    assert.equal(e.hunt.instancia.chefeDoAto, portal, 'um portal só por instância');
    assert.equal(e.campanha.facil.limpezas?.[ULTIMA()], limpezas, 'a limpeza conta uma vez');
    assert.equal((e.bossCooldownsAte ?? {})[Campanha.bossDoAto(1).bossId] ?? 0, 0, 'sem espera');
  }
});

test('sair antes de limpar não deixa portal; não há sala para entrar (nem pela Caça Automática): o chefe vem para a fase', { skip: SEM }, () => {
  const e = naFase(ULTIMA());
  e.hunt = null;
  assert.equal(Cacadas.snapshotDaHunt(e), null);
  const f = naFase(ULTIMA());
  limpar(f, { agora: Date.now() });
  assert.ok(f.hunt.instancia.chefeDoAto);
  assert.equal(Cacadas.portalParaCliente(f, f.hunt), null, 'nada de entrada automática na sala');
  const r = Cacadas.entrarNoPortalDoBoss(f);
  assert.equal(r.ok, false);
  assert.equal(f.hunt.isBoss, false, 'continua na fase');
});

test('a gravação leva o chefe vivo e o portal: depois do reinício a instância continua esperando ele morrer', { skip: SEM }, () => {
  const e = naFase(ULTIMA());
  const relogio = { agora: Date.now() };
  limpar(e, relogio);
  andar(e, 2000, relogio);
  const chefe = vivos(e).find((m) => m.chefeDoAto === 1);
  assert.ok(chefe);
  const gravada = Cacadas.huntAoCarregar(JSON.parse(JSON.stringify(Cacadas.huntParaGravar(e.hunt))));
  const volta = gravada.monstros.find((m) => m.uid === chefe.uid);
  assert.ok(volta, 'o chefe volta com a caçada');
  assert.equal(volta.chefeDoAto, 1);
  assert.equal(gravada.instancia.chefeDoAto.uid, chefe.uid);
  assert.equal(Cacadas.chefeDoAtoPendente(gravada), true);
});

/*
 * TODOS os atos (dono, 08/10: "teste em todos os atos para ver se está funcionando o boss final do ato"), cada um pela regra da sua última
 * fase: limpar (Atos 1, 2, 3, 4, 6, 7 e 10) → o portal abre no "Hunt Clear!"; matar um chefe que não é o do ato (Ato 8: a Lunaris) → o
 * portal abre na morte dele, sem limpar o resto; a fase pede o PRÓPRIO chefe do ato (Ato 5: Kitava; Ato 9: a Trindade) → ele já está
 * na fase, sem portal (a regra de antes: "Kitava na fase encerra o ato"). Em todos, matar o chefe vence o ato e abre o seguinte.
 */
const ATOS = [...new Set(Campanha.FASES.map((f) => f.ato))].sort((a, b) => a - b);
const primeiraDoAto = (ato) => Campanha.FASES.find((f) => f.ato === ato && !f.pular)?.huntId ?? null;
/** Matar o chefe vence o ato `ato` e abre o primeiro do seguinte (se há seguinte); a caçada segue. */
function venceOAto(e, ato, chefe, relogio) {
  const seguinte = ATOS.includes(ato + 1) ? primeiraDoAto(ato + 1) : null;
  if (seguinte) assert.equal(Campanha.faseLiberada(e, 'facil', seguinte), false, `Ato ${ato + 1} ainda fechado`);
  assert.equal(Campanha.bossVencido(e, 'facil', ato), false);
  chefe.hp = 0;
  andar(e, 500, relogio);
  assert.equal(Campanha.bossVencido(e, 'facil', ato), true, `o chefe do Ato ${ato} vencido`);
  if (seguinte) assert.equal(Campanha.faseLiberada(e, 'facil', seguinte), true, `o Ato ${ato + 1} abriu`);
  assert.ok(e.hunt && !e.hunt.isBoss, 'a caçada segue na fase (sem sala do boss)');
}
/** O portal aberto: o chefe sai dele (na casa do portal), é o boss único do ato. */
function chefeQueSaiu(e, ato, relogio) {
  const portal = e.hunt.instancia.chefeDoAto;
  assert.ok(portal, `Ato ${ato}: o portal abriu`);
  assert.equal(portal.ato, ato);
  assert.equal(portal.bossId, Campanha.bossDoAto(ato).bossId);
  assert.equal(e.hunt.portalDoBoss ?? null, null, 'nada de sala do boss');
  let chefe = null;
  for (let i = 0; i < 12 && !chefe; i++) {
    andar(e, 250, relogio);
    chefe = vivos(e).find((m) => m.chefeDoAto === ato) ?? null;
  }
  assert.ok(chefe, `Ato ${ato}: o chefe saiu do portal`);
  assert.deepEqual([chefe.x, chefe.y], [portal.x, portal.y], 'na casa do portal');
  assert.ok(chefe.boss, 'o boss único do ato');
  return chefe;
}

for (const ato of ATOS) {
  const ultima = () => Campanha.ultimaFaseDoAto(ato).huntId;
  const conc = () => Campanha.conclusaoDa(ultima());
  test(`Ato ${ato}: o chefe final do ato pela regra da última fase`, { skip: SEM }, () => {
    const relogio = { agora: Date.now() };
    const e = naFase(ultima());
    assert.equal(e.hunt.instancia.chefeDoAto ?? null, null, 'ao entrar: nada');
    // O cartão do chefe diz a regra deste ato (limpar, matar o chefe da fase, ou ele já está na fase).
    const cartao = Campanha.comoOChefeAparece(ato);
    assert.equal(!!cartao.semPortal, !!Campanha.atoDoChefeNaFase(ultima()), cartao.comoAparece);
    assert.match(cartao.comoAparece, cartao.semPortal ? /vence o ato/ : conc().tipo === 'matar-chefe' ? /^Mate .+ um portal se abre/ : /^Limpe a fase .+ um portal se abre/);
    if (Campanha.atoDoChefeNaFase(ultima())) {
      // A fase pede o próprio chefe do ato: ele nasce com a fase; o portal não abre (nem limpando).
      const chefe = vivos(e).find((m) => Campanha.ehOMonstro(m.key, conc().monstro));
      assert.ok(chefe, `Ato ${ato}: ${conc().nome} está na fase`);
      venceOAto(e, ato, chefe, relogio);
      limpar(e, relogio);
      andar(e, 2000, relogio);
      assert.equal(e.hunt.instancia.chefeDoAto ?? null, null, 'sem portal: o chefe do ato já era o da fase');
    } else if (conc().tipo === 'matar-chefe') {
      // A regra é matar o chefe da fase: a morte dele abre o portal, sem limpar o resto.
      const alvo = vivos(e).find((m) => Campanha.ehOMonstro(m.key, conc().monstro));
      assert.ok(alvo, `Ato ${ato}: ${conc().nome} está na fase`);
      alvo.hp = 0;
      andar(e, 500, relogio);
      assert.notEqual(e.hunt.instancia.status, 'limpa', 'o resto da fase ainda vivo');
      venceOAto(e, ato, chefeQueSaiu(e, ato, relogio), relogio);
    } else {
      assert.equal(conc().tipo, 'limpar-hunt');
      // Só parte: nada. Limpar tudo: o portal.
      const todos = vivos(e);
      for (const m of todos.slice(0, Math.max(1, todos.length - 1))) m.hp = 0;
      andar(e, 500, relogio);
      assert.equal(e.hunt.instancia.chefeDoAto ?? null, null, 'limpeza parcial: nada');
      limpar(e, relogio);
      venceOAto(e, ato, chefeQueSaiu(e, ato, relogio), relogio);
    }
  });
}
