// O boss de fim de ato sem recarga e o PORTAL que se abre ao concluir a última fase: acesso ilimitado, validado no servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Campanha from '../systems/campanha.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Bosses from '../systems/bosses.mjs';
import * as Bau from '../systems/bau.mjs';
import { CATALOGO } from '../systems/dados.mjs';
import { vitoriaNoBoss } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';
import { aAdaptar, doClassico } from './apoio-migracao.mjs';

const F = Campanha.FASES;
const HORA = 3_600_000;
const BOSSES_DE_ATO = Object.values(Campanha.CAMPANHA.bosses).map((b) => b.bossId);
/** Completa as fases do `ato` (menos a última jogável, se `menosAUltima`). */
function completarAto(e, dif, ato, { menosAUltima = true } = {}) {
  const ultima = Campanha.ultimaFaseDoAto(ato);
  const p = (e.campanha[dif] ??= { limpezas: {}, completas: [], bosses: [] });
  for (const f of F.filter((x) => x.ato === ato)) if (!(menosAUltima && f.huntId === ultima.huntId)) if (!p.completas.includes(f.huntId)) p.completas.push(f.huntId);
}
const novo = (level = 300) => personagemDeTeste({ level, campanha: {} });
const vivos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];
/** Mata tudo o que há e deixa o tique rodar, até a instância ficar CLEAR (encontros da fase podem trazer guardiões novos no meio). */
function limpar(e) {
  for (let i = 0; i < 12 && e.hunt?.instancia?.status !== 'limpa'; i++) {
    for (const m of vivos(e)) m.hp = 0;
    Cacadas.tique(e, PERSONAGEM, Date.now() + 500 * (i + 1));
  }
}
/** Um personagem com o ato 1 completo menos a última fase, dentro dela. */
function naUltimaFase(dif = 'facil') {
  const e = novo();
  completarAto(e, dif, 1);
  const ultima = Campanha.ultimaFaseDoAto(1);
  const r = Cacadas.entrar(e, { huntId: ultima.huntId, mode: 'auto', dificuldade: dif });
  assert.equal(r.ok, true, r.erro);
  return { e, ultima };
}

test('B1. o catálogo: os 4 bosses de fim de ato saem SEM recarga (cooldownHours 0, semEspera); os outros bosses mantêm a recarga real', { skip: doClassico("Boss de fim de ato do Draevor (4 bosses, portal após as 12 fases, recarga); no PoE o chefe do ato está na área e conclui a missão") }, () => {
  assert.equal(BOSSES_DE_ATO.length, 4);
  for (const id of BOSSES_DE_ATO) {
    const b = CATALOGO.bosses.find((x) => x.id === id);
    assert.equal(b.cooldownHours, 0, id);
    assert.equal(b.semEspera, true, id);
    assert.equal(Campanha.ehBossDeAto(id), true);
  }
  assert.equal(CATALOGO.bosses.find((x) => x.id === 'ahau').cooldownHours, 12, 'boss comum: recarga de sempre');
  assert.equal(CATALOGO.bosses.find((x) => x.id === 'ferumbras-mortal-shell').cooldownHours, 48);
  assert.equal(Campanha.ehBossDeAto('ahau'), false);
});

test('B2. recarga antiga (72 h do The Primal Menace, 12 h dos outros) não bloqueia; limparRecargasDeAto zera só o carimbo dos bosses de ato', { skip: doClassico("Boss de fim de ato do Draevor (4 bosses, portal após as 12 fases, recarga); no PoE o chefe do ato está na área e conclui a missão") }, () => {
  const e = novo(1500);
  const agora = Date.now();
  e.bossCooldownsAte = { 'the-primal-menace': agora + 72 * HORA, 'urmahlullu-the-immaculate': agora + 12 * HORA, ahau: agora + 12 * HORA };
  e.campanha = { facil: { limpezas: {}, completas: [], bosses: [] } };
  // Antes de limpar: a entrada pela lista de bosses (sem campanha) já passa — boss de ato não tem recarga.
  const r = Cacadas.entrar(e, { huntId: 'urmahlullu-the-immaculate', mode: 'auto' });
  assert.equal(r.ok, true, r.erro);
  e.hunt = null;
  assert.equal(Bosses.limparRecargasDeAto(e), 2);
  assert.equal(e.bossCooldownsAte['the-primal-menace'], 0);
  assert.equal(e.bossCooldownsAte['urmahlullu-the-immaculate'], 0);
  assert.ok(e.bossCooldownsAte.ahau > agora, 'a recarga de um boss comum fica');
  // O boss comum segue bloqueado.
  assert.match(Cacadas.entrar(e, { huntId: 'ahau', mode: 'auto' }).erro, /ainda não voltou/);
});

test('B3. tentativas ilimitadas: entrar, sair, morrer e entrar de novo, dez vezes seguidas, sem nenhuma espera gravada', { skip: doClassico("Boss de fim de ato do Draevor (4 bosses, portal após as 12 fases, recarga); no PoE o chefe do ato está na área e conclui a missão") }, () => {
  const e = novo(300);
  completarAto(e, 'facil', 1, { menosAUltima: false });
  for (let i = 0; i < 10; i++) {
    const r = Cacadas.entrar(e, { huntId: 'urmahlullu-the-immaculate', mode: 'auto', dificuldade: 'facil', campanha: true, viaPortal: true });
    assert.equal(r.ok, true, `tentativa ${i + 1}: ${r.erro}`);
    assert.equal(e.hunt.isBoss, true);
    assert.equal(e.hunt.campanha.bossDoAto, 1);
    assert.equal((e.bossCooldownsAte ?? {})['urmahlullu-the-immaculate'] ?? 0, 0, 'nenhuma espera começa na entrada');
    e.hunt = null; // morreu / saiu
  }
  // E depois da vitória registrada também.
  Cacadas.entrar(e, { huntId: 'urmahlullu-the-immaculate', mode: 'auto', dificuldade: 'facil', campanha: true, viaPortal: true });
  const boss = e.hunt.monstros.find((m) => m.hp > 0) ?? e.hunt.monstros[0];
  vitoriaNoBoss(e, e.hunt, boss, PERSONAGEM);
  assert.deepEqual(e.campanha.facil.bosses, [1]);
  e.hunt = null;
  assert.equal(Cacadas.entrar(e, { huntId: 'urmahlullu-the-immaculate', mode: 'auto', dificuldade: 'facil', campanha: true, viaPortal: true }).ok, true, 'depois de vencer, entra de novo na hora');
});

test('B4. o boss de ato sem as fases completas continua fechado (a recarga saiu, a progressão não)', { skip: doClassico("Boss de fim de ato do Draevor (4 bosses, portal após as 12 fases, recarga); no PoE o chefe do ato está na área e conclui a missão") }, () => {
  const e = novo(300);
  const r = Cacadas.entrar(e, { huntId: 'urmahlullu-the-immaculate', mode: 'auto', dificuldade: 'facil', campanha: true, viaPortal: true });
  assert.equal(r.ok, false);
  assert.match(r.erro, /Complete as 12 fases do Ato 1/);
});

test('P1. o portal NÃO aparece antes de concluir a última fase, e entrar nele é recusado', () => {
  const { e } = naUltimaFase();
  assert.equal(e.hunt.portalDoBoss, undefined);
  assert.equal(Cacadas.snapshotDaHunt(e).portalDoBoss, null);
  assert.equal(Cacadas.snapshotDaHunt(e).instancia.encontros?.some((x) => x.tipo === 'portal') ?? false, false);
  const r = Cacadas.entrarNoPortalDoBoss(e);
  assert.equal(r.ok, false);
  assert.match(r.erro, /portal do boss não está aberto/);
  assert.equal(e.hunt.isBoss, false, 'continua na fase');
});

test('P2. concluir a última fase abre o portal (uma vez, com o boss do ato), avisa na tela e o cliente recebe o marcador e o botão', { skip: doClassico("Boss de fim de ato do Draevor (4 bosses, portal após as 12 fases, recarga); no PoE o chefe do ato está na área e conclui a missão") }, () => {
  const { e } = naUltimaFase();
  limpar(e);
  assert.equal(e.hunt.instancia.status, 'limpa');
  const portal = e.hunt.portalDoBoss;
  assert.ok(portal, 'o portal abriu');
  assert.deepEqual([portal.bossId, portal.ato, portal.dificuldade], ['urmahlullu-the-immaculate', 1, 'facil']);
  // O aviso da limpeza ("portal do boss … sem espera") pode ser SUBSTITUÍDO no mesmo tique por um prêmio de "primeira vitória" de um encontro sorteado
  // da fase (`pagarPremio` troca o aviso da tela): o jogador vê um ou outro. O que não varia é o portal aberto e a mensagem do servidor para a limpeza.
  assert.match(e.avisoDaHunt, /portal do boss.*sem espera|Primeira vitória sobre/is);
  const snap = Cacadas.snapshotDaHunt(e);
  assert.deepEqual([snap.portalDoBoss.nome, snap.portalDoBoss.ato], ['Urmahlullu the Immaculate', 1]);
  const marcador = snap.instancia.encontros.find((x) => x.tipo === 'portal');
  assert.deepEqual([marcador.id, marcador.estado, marcador.x, marcador.y], ['portal-do-boss', 'disponivel', portal.x, portal.y]);
  // Sem duplicar: abrir de novo (outro clear, a mesma fase) devolve o MESMO portal.
  assert.equal(Campanha.abrirPortalDoBoss(e.hunt, [e]), portal);
  limpar(e);
  assert.equal(e.hunt.portalDoBoss, portal);
});

test('P3. instância nova (reinício) fecha o portal: a limpeza antiga não vale; só o portal aberto passa pela gravação', () => {
  const { e } = naUltimaFase();
  limpar(e);
  const portal = structuredClone(e.hunt.portalDoBoss);
  const gravado = JSON.parse(JSON.stringify({ ...e, hunt: Cacadas.huntParaGravar(e.hunt) }));
  Cacadas.huntAoCarregar(gravado.hunt);
  assert.deepEqual(gravado.hunt.portalDoBoss, portal, 'a gravação leva o portal aberto');
  assert.equal(Cacadas.novaInstancia(e), true, 'a fase repete (instância nova)');
  assert.equal(e.hunt.portalDoBoss, null, 'limpeza nova: o portal da execução anterior fechou');
  assert.equal(Cacadas.entrarNoPortalDoBoss(e).ok, false);
  assert.equal(Cacadas.snapshotDaHunt(e).portalDoBoss, null);
});

test('P4. entrar no portal leva à arena do boss (sem a recarga), e um segundo pedido igual é recusado (idempotente)', { skip: doClassico("Boss de fim de ato do Draevor (4 bosses, portal após as 12 fases, recarga); no PoE o chefe do ato está na área e conclui a missão") }, () => {
  const { e } = naUltimaFase();
  limpar(e);
  let saiu = 0;
  const r = Cacadas.entrarNoPortalDoBoss(e, { antes: () => saiu++ });
  assert.equal(r.ok, true, r.erro);
  assert.equal(saiu, 1, 'o repasse da sala roda uma vez, depois de validar');
  assert.equal(e.hunt.isBoss, true);
  assert.equal(e.hunt.bossId, 'urmahlullu-the-immaculate');
  assert.equal(e.hunt.campanha.bossDoAto, 1);
  assert.equal(e.hunt.portalDoBoss, undefined, 'a arena é outro ambiente (sem os bichos nem o portal da fase)');
  assert.ok(e.hunt.monstros.some((m) => m.name.toLowerCase().includes('urmahlullu')) || e.hunt.monstros.length >= 1, 'o boss está na arena');
  // Requisição repetida (clique duplo): já está na arena, nada acontece de novo.
  const outra = Cacadas.entrarNoPortalDoBoss(e, { antes: () => saiu++ });
  assert.equal(outra.ok, false);
  assert.equal(saiu, 1);
  assert.equal(e.hunt.isBoss, true);
});

test('P5. fase já completa e boss já vencido NÃO dão portal: entrar na última fase de novo exige limpar de novo; sem espera', () => {
  const { e, ultima } = naUltimaFase();
  limpar(e);
  assert.equal(Cacadas.entrarNoPortalDoBoss(e).ok, true);
  e.hunt = null;
  assert.equal((e.bossCooldownsAte ?? {})['urmahlullu-the-immaculate'] ?? 0, 0);
  for (let i = 0; i < 3; i++) {
    assert.equal(Cacadas.entrar(e, { huntId: ultima.huntId, mode: 'auto', dificuldade: 'facil' }).ok, true);
    assert.equal(e.hunt.portalDoBoss, undefined, 'fase completa + boss vencido: sem portal ao entrar');
    assert.equal(Cacadas.entrarNoPortalDoBoss(e).ok, false);
    assert.equal(Cacadas.snapshotDaHunt(e).portalDoBoss, null);
    limpar(e);
    assert.ok(e.hunt.portalDoBoss, 'limpou de novo: novo portal');
    assert.equal(Cacadas.entrarNoPortalDoBoss(e).ok, true, `tentativa ${i + 1}`);
    e.hunt = null;
  }
});

test('N1. startHunt direto no boss de ato (cartão/atalho/cliente) é recusado: só o portal da limpeza atual leva à arena', { skip: doClassico("Boss de fim de ato do Draevor (4 bosses, portal após as 12 fases, recarga); no PoE o chefe do ato está na área e conclui a missão") }, () => {
  const e = novo();
  completarAto(e, 'facil', 1, { menosAUltima: false });
  const r = Cacadas.entrar(e, { huntId: 'urmahlullu-the-immaculate', mode: 'auto', dificuldade: 'facil', campanha: true });
  assert.equal(r.ok, false);
  assert.match(r.erro, /Limpe a última hunt/);
});

test('N2. limpar só parte dos bichos não abre o portal; o mesmo evento de morte repetido não adianta a limpeza', () => {
  const { e } = naUltimaFase();
  const todos = vivos(e);
  for (const m of todos.slice(0, Math.max(1, todos.length - 1))) m.hp = 0;
  Cacadas.tique(e, PERSONAGEM, Date.now() + 500);
  Cacadas.tique(e, PERSONAGEM, Date.now() + 1000);
  assert.notEqual(e.hunt.instancia.status, 'limpa');
  assert.equal(e.hunt.portalDoBoss, undefined);
  assert.equal(Cacadas.entrarNoPortalDoBoss(e).ok, false);
  limpar(e);
  const antes = e.campanha.facil.limpezas[Campanha.ultimaFaseDoAto(1).huntId];
  for (let i = 0; i < 3; i++) Cacadas.tique(e, PERSONAGEM, Date.now() + 5000 + i * 500);
  assert.equal(e.campanha.facil.limpezas[Campanha.ultimaFaseDoAto(1).huntId], antes, 'limpar conta uma vez');
  assert.ok(e.hunt.portalDoBoss);
});

test('N3. sair antes de limpar não deixa portal; a instância espera o portal aberto por um tempo antes de recomeçar', () => {
  const { e } = naUltimaFase();
  e.hunt = null;
  assert.equal(Cacadas.snapshotDaHunt(e), null);
  const { e: f } = naUltimaFase();
  limpar(f);
  assert.ok(f.hunt.portalDoBoss);
  Cacadas.tique(f, PERSONAGEM, Date.now() + 20_000);
  assert.ok(f.hunt.portalDoBoss, 'passou a pausa do Clear e o portal continua (dá tempo de entrar)');
});

test('N4. todos os atos: a última jogável antes do boss é a que abre o portal; as outras não', () => {
  for (const ato of [1, 2, 3, 4]) {
    const ultima = Campanha.ultimaFaseDoAto(ato);
    assert.ok(ultima && !ultima.pular);
    assert.equal(Campanha.ehUltimaFaseDoAto(ultima.huntId), true);
    const outras = F.filter((f) => f.ato === ato && f.huntId !== ultima.huntId);
    assert.ok(outras.every((f) => !Campanha.ehUltimaFaseDoAto(f.huntId)));
  }
});

test('N5. Caça Automática: a sessão entra sozinha no portal uma vez; falha não vira laço; manual (online) não entra sozinho', async () => {
  const { readFileSync } = await import('node:fs');
  const sessao = readFileSync(new URL('../websocket/sessao.mjs', import.meta.url), 'utf8');
  assert.match(sessao, /entrarAutomaticoNoPortal\(\) \{/);
  assert.match(sessao, /hunt\.modo !== 'auto'/);
  assert.match(sessao, /hunt\.tentouEntrarNoPortal === portal\.abertoEm/);
  const { e } = naUltimaFase();
  limpar(e);
  const portal = Cacadas.portalParaCliente(e, e.hunt);
  assert.ok(portal && portal.abertoEm, 'o servidor expõe o portal com o carimbo de abertura');
  const { e: novato } = naUltimaFase();
  limpar(novato);
  novato.campanha.facil.completas.pop();
  assert.equal(Cacadas.portalParaCliente(novato, novato.hunt), null, 'sem requisito: nada de entrada automática');
});

test('P6. só abre na ÚLTIMA fase do ato (fases de antes não abrem portal), e a validação é do servidor (cliente não força)', { skip: doClassico("Boss de fim de ato do Draevor (4 bosses, portal após as 12 fases, recarga); no PoE o chefe do ato está na área e conclui a missão") }, () => {
  const e = novo();
  completarAto(e, 'facil', 1, { menosAUltima: true });
  const anterior = F.filter((f) => f.ato === 1 && !f.pular).at(-2);
  Cacadas.entrar(e, { huntId: anterior.huntId, mode: 'auto', dificuldade: 'facil' });
  limpar(e);
  assert.equal(e.hunt.portalDoBoss, undefined, 'penúltima fase: sem portal');
  // O cliente inventa um portal na hunt: o servidor não confia (a fase não é a última do ato).
  e.hunt.portalDoBoss = { ato: 1, dificuldade: 'facil', bossId: 'urmahlullu-the-immaculate', nome: 'X', x: 0, y: 0, z: 0 };
  assert.equal(Cacadas.entrarNoPortalDoBoss(e).ok, false);
  assert.equal(Cacadas.snapshotDaHunt(e).portalDoBoss === null || Cacadas.snapshotDaHunt(e).portalDoBoss.ato === 1, true);
  // Portal real, mas ato incompleto para quem pede: recusa.
  const { e: f } = naUltimaFase();
  limpar(f);
  f.campanha.facil.completas = f.campanha.facil.completas.filter((h) => h !== anterior.huntId);
  assert.equal(Cacadas.entrarNoPortalDoBoss(f).ok, false);
  assert.equal(Cacadas.snapshotDaHunt(f).portalDoBoss, null, 'quem não está liberado nem vê o botão');
});

test('P7. party: o portal vive na sala do dono; cada integrante entra por conta própria, só se ELE tem o ato liberado; ninguém é levado junto', { skip: doClassico("Boss de fim de ato do Draevor (4 bosses, portal após as 12 fases, recarga); no PoE o chefe do ato está na área e conclui a missão") }, () => {
  const dono = novo();
  completarAto(dono, 'facil', 1);
  const ultima = Campanha.ultimaFaseDoAto(1);
  assert.equal(Cacadas.entrar(dono, { huntId: ultima.huntId, mode: 'auto', dificuldade: 'facil' }).ok, true);
  const amigo = novo();
  completarAto(amigo, 'facil', 1); // também liberado
  const novato = novo(); // sem progresso: entra na sala (na party qualquer um entra), mas não no boss
  for (const m of [amigo, novato]) assert.equal(Cacadas.entrarNaSala(m, dono.hunt, []).ok !== false, true);
  // A limpeza conta para todos da sala (a partilha da party): amigo fecha a última fase; o novato só ganha essa fase (faltam as outras 11).
  Object.defineProperty(dono.hunt, 'partilha', { value: { ativa: true, membros: [{ estado: dono, nome: 'dono' }, { estado: amigo, nome: 'amigo' }, { estado: novato, nome: 'novato' }] }, configurable: true, writable: true });
  limpar(dono);
  assert.ok(dono.hunt.portalDoBoss);
  assert.ok(Cacadas.snapshotDaHunt(amigo).portalDoBoss, 'o integrante liberado vê o portal da sala do dono');
  assert.equal(Cacadas.snapshotDaHunt(novato).portalDoBoss, null, 'quem não tem o ato liberado não vê');
  assert.equal(Cacadas.entrarNoPortalDoBoss(novato).ok, false);
  const r = Cacadas.entrarNoPortalDoBoss(amigo);
  assert.equal(r.ok, true, r.erro);
  assert.equal(amigo.hunt.isBoss, true);
  assert.equal(dono.hunt.isBoss, false, 'o dono (e quem mais estiver na sala) continua onde estava');
  assert.equal(novato.hunt.isBoss, false);
  assert.ok(dono.hunt.portalDoBoss, 'o portal segue aberto para os outros');
});

test('V1. a vitória no boss é registrada UMA vez por luta: evento repetido não paga outra sacola nem outra conclusão; outra luta paga a sua', { skip: aAdaptar("Idempotência da vitória no boss (evento repetido não paga de novo) vale para os chefes do PoE (pináculos na arena)") }, () => {
  const e = novo(300);
  completarAto(e, 'facil', 1, { menosAUltima: false });
  Cacadas.entrar(e, { huntId: 'urmahlullu-the-immaculate', mode: 'auto', dificuldade: 'facil', campanha: true, viaPortal: true });
  const alvo = e.hunt.monstros[0];
  const sacolas0 = (e.rewards ?? []).length;
  vitoriaNoBoss(e, e.hunt, alvo, PERSONAGEM);
  const sacolas1 = (Bau.garantir(e) && e.rewards).length;
  for (let i = 0; i < 4; i++) vitoriaNoBoss(e, e.hunt, alvo, PERSONAGEM);
  assert.equal(e.rewards.length, sacolas1, 'os eventos repetidos não pagam de novo');
  assert.ok(sacolas1 >= sacolas0);
  assert.deepEqual(e.campanha.facil.bosses, [1]);
  // Outra luta (nova entrada): vitória registrada de novo (farm), sem duplicar a conclusão do ato.
  e.hunt = null;
  Cacadas.entrar(e, { huntId: 'urmahlullu-the-immaculate', mode: 'auto', dificuldade: 'facil', campanha: true, viaPortal: true });
  vitoriaNoBoss(e, e.hunt, e.hunt.monstros[0], PERSONAGEM);
  assert.ok(e.rewards.length >= sacolas1);
  assert.deepEqual(e.campanha.facil.bosses, [1], 'o ato conta como concluído uma vez só');
});

test('U1. cliente: o botão do portal, o marcador roxo, o texto "sem espera" e nenhum cronômetro para boss de ato; o servidor entende portalDoBoss', async () => {
  const { readFileSync } = await import('node:fs');
  const ler = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');
  const main = ler('frontend/client/src/main.mjs');
  assert.match(main, /function atualizarBotaoDoPortal\(\)/);
  assert.match(main, /send\(\{ t: 'portalDoBoss' \}\)/);
  assert.match(main, /state\.hunt\?\.portalDoBoss/);
  assert.match(ler('frontend/client/src/encontros-na-tela.mjs'), /e\.tipo === 'portal'/);
  assert.match(ler('frontend/client/src/panels.mjs'), /hunt\.semEspera\s*\?\s*'Sem espera: este é o boss de fim de ato/);
  assert.match(ler('frontend/client/style.css'), /\.btn-portal-do-boss/);
  const sessao = ler('websocket/sessao.mjs');
  assert.match(sessao, /case 'portalDoBoss':\s*return this\.entrarNoPortalDoBoss\(\)/);
  assert.match(sessao, /String\(m\?\.id\) === 'portal-do-boss'/);
  assert.match(sessao, /Bosses\.limparRecargasDeAto\(this\.estado\)/, 'a recarga antiga é zerada no login');
});

test('U2. cliente: o boss final mora dentro do cartão da última fase (nunca um 13º cartão), sem texto de recarga', async () => {
  const { readFileSync } = await import('node:fs');
  const ler = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');
  const panels = ler('frontend/client/src/panels.mjs');
  assert.match(panels, /i === fases\.length - 1 \? escolhida\.bosses\.find\(\(x\) => x\.ato === ato\)/);
  assert.match(panels, /card\.append\(secaoDoBossDoAto\(/);
  assert.doesNotMatch(panels, /campanha-boss\$\{b\.liberado/, 'sem cartão separado para o boss');
  assert.doesNotMatch(panels, /com a recarga dele/);
  assert.doesNotMatch(ler('frontend/client/src/world.mjs'), /com a recarga dele/);
  assert.match(ler('frontend/client/style.css'), /\.campanha-boss-secao/);
});
