// O CICLO DO PORTAL de viagem (dono, 10/10: "Portal aberto por 3 segundos e fechamento animado por 3 segundos; barra de progresso
// sincronizada; fade suave do portal e do personagem; nenhum efeito visual permanece após a remoção do portal") — a conta pura que o mapa
// (`map.mjs`) desenha, e a regra de quando a tela abre o portal (`main.mjs`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CICLO_PADRAO, duracao, quadroDoCiclo, chaveDaCena, abrePortal, ABRINDO_MS, PASSO_NO_PORTAL_MS } from '../frontend/client/src/portal-ciclo.mjs';
import * as Protecao from '../systems/protecao.mjs';

const perto = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);
// Os tempos do ciclo (dono, 10/10: primeiro 3 s aberto + 3 s fechando; depois "saída e chegada algo com 3 s cada"): os testes leem da
// configuração, para a regra valer com qualquer tempo.
const A = CICLO_PADRAO.abertoMs;
const F = CICLO_PADRAO.fechamentoMs;

test('a SAÍDA em 3 s (aberto + fechando): as fases, a barra (sincronizada, 1 → 0 em cada fase) e o fim', () => {
  assert.deepEqual({ ...CICLO_PADRAO }, { abertoMs: 1500, fechamentoMs: 1500 });
  assert.equal(duracao(), 3000, 'saída e chegada com 3 s cada');
  assert.deepEqual(CICLO_PADRAO, { ...Protecao.config().portal }, 'o mesmo ciclo que o servidor manda no welcome');
  const em = (t) => quadroDoCiclo(t);
  assert.equal(em(0).fase, 'aberto');
  perto(em(0).barra, 1, 'a barra começa cheia');
  perto(em(A / 2).barra, 0.5, 'na metade da abertura, metade');
  assert.equal(em(A - 1).fase, 'aberto');
  assert.equal(em(A).fase, 'fechando');
  perto(em(A).barra, 1, 'o fechamento começa com a barra cheia (na cor dele)');
  perto(em(A + F / 2).barra, 0.5, 'na metade do fechamento, metade');
  assert.equal(em(A + F - 1).fase, 'fechando');
  assert.equal(em(A + F).fase, 'fim');
});

test('o FADE: o portal acende ao abrir, fica inteiro aberto, e no fechamento some (e encolhe) junto com o personagem — que some primeiro', () => {
  const em = (t) => quadroDoCiclo(t);
  perto(em(0).portal.alpha, 0, 'nasce apagado');
  assert.ok(em(ABRINDO_MS / 2).portal.alpha > 0 && em(ABRINDO_MS / 2).portal.alpha < 1, 'acendendo');
  perto(em(ABRINDO_MS).portal.alpha, 1, 'aceso');
  // (Aceso e antes do passo para dentro: o personagem parado ao lado, olhando.)
  const aberto = (ABRINDO_MS + (A - PASSO_NO_PORTAL_MS)) / 2;
  perto(em(aberto).portal.escala, 1, 'inteiro');
  perto(em(aberto).personagem.alpha, 1, 'o personagem inteiro com o portal aberto');
  perto(em(A).portal.alpha, 1, 'o fechamento começa do portal inteiro');
  // Suave: o alpha e a escala só descem durante o fechamento, sem pulos.
  let antes = em(A);
  for (let t = A + 50; t <= A + F; t += 50) {
    const q = em(t);
    assert.ok(q.portal.alpha <= antes.portal.alpha + 1e-9 && q.personagem.alpha <= antes.personagem.alpha + 1e-9, `desce em ${t}`);
    assert.ok(antes.portal.alpha - q.portal.alpha < 0.06, `sem pulo em ${t}`);
    assert.ok(q.personagem.alpha <= q.portal.alpha + 1e-9, `o personagem é puxado antes do portal sumir (${t})`);
    antes = q;
  }
  assert.ok(em(A + F / 2).portal.escala < 1 && em(A + F / 2).personagem.escala < 1, 'encolhem para dentro');
  // No fim, nada fica na tela.
  const fim = em(A + F);
  assert.deepEqual([fim.portal.alpha, fim.personagem.alpha, fim.barra, fim.energia], [0, 0, 0, 0]);
  assert.deepEqual(em(60_000), fim, 'e continua sem nada');
});

test('a energia pulsa (0..1) e o ciclo segue a configuração (`gamedata/protecao.json` → `portal`)', () => {
  const pulsos = [0, 105, 210, 315, 420].map((t) => quadroDoCiclo(t).energia);
  assert.ok(Math.min(...pulsos) < 0.2 && Math.max(...pulsos) > 0.8, `pulsa: ${pulsos.map((p) => p.toFixed(2)).join(' ')}`);
  for (const p of pulsos) assert.ok(p >= 0 && p <= 1);
  const curto = { abertoMs: 1000, fechamentoMs: 500 };
  assert.equal(duracao(curto), 1500);
  assert.equal(quadroDoCiclo(999, curto).fase, 'aberto');
  assert.equal(quadroDoCiclo(1000, curto).fase, 'fechando');
  perto(quadroDoCiclo(1250, curto).barra, 0.5, 'a barra no ritmo do fechamento curto');
  assert.equal(quadroDoCiclo(1500, curto).fase, 'fim');
});

test('a CENA na tela: cada entrada de caçada (instância, sala) é uma; a cidade pelo id e pelo teletransporte', () => {
  assert.equal(chaveDaCena({ hunt: { mapId: 'a1', entrada: 'x1' } }), 'h:x1');
  assert.equal(chaveDaCena({ hunt: { mapId: 'a1' } }), 'h:a1', 'servidor antigo, sem entrada: o mapa');
  assert.notEqual(chaveDaCena({ hunt: { mapId: 'a1', entrada: 'x1' } }), chaveDaCena({ hunt: { mapId: 'a1', entrada: 'x2' } }), 'a instância nova no mesmo mapa é outra cena');
  assert.equal(chaveDaCena({ city: { player: { x: 1, y: 1 }, cidade: { id: 'poe-a1' } } }), 'c:poe-a1:0');
  assert.equal(chaveDaCena({ city: { player: { x: 1, y: 1, teleporte: 2 }, cidade: { id: 'poe-a2' } } }), 'c:poe-a2:2');
  assert.equal(chaveDaCena({ city: { player: { x: 1, y: 1 } } }), 'c:city:0', 'o clássico: a cidade única');
  assert.equal(chaveDaCena({}), null);
});

test('o portal de saída abre só numa VIAGEM: com cena antes, cena diferente e o personagem vivo', () => {
  assert.equal(abrePortal({ antes: 'c:city:0', depois: 'h:x1' }), true, 'da cidade para a caçada');
  assert.equal(abrePortal({ antes: 'h:x1', depois: 'h:x2' }), true, 'para a instância nova');
  assert.equal(abrePortal({ antes: 'h:x1', depois: 'c:city:0' }), true, 'de volta à cidade');
  assert.equal(abrePortal({ antes: 'c:poe-a1:0', depois: 'c:poe-a2:1' }), true, 'para outra cidade');
  assert.equal(abrePortal({ antes: null, depois: 'h:x1' }), false, 'entrar no jogo / reconexão: sem cena de onde sair');
  assert.equal(abrePortal({ antes: 'h:x1', depois: 'h:x1' }), false, 'a mesma cena');
  assert.equal(abrePortal({ antes: 'h:x1', depois: 'c:city:0', morreu: true }), false, 'morrer não é viajar');
  assert.equal(abrePortal({ antes: 'c:city:0', depois: 'h:duelo', pvp: true }), false, 'o duelo da Arena (sem proteção de entrada, com a largada dele) entra direto');
});

test('a CHEGADA em 3 s: ele vai aparecendo no portal (com a barra), anda 1 casa até o lugar dele, e em 1 s o portal some sozinho', async () => {
  const { CHEGADA_PADRAO, duracaoDaChegada, prontoNaChegada, quadroDaChegada } = await import('../frontend/client/src/portal-ciclo.mjs');
  assert.deepEqual({ ...CHEGADA_PADRAO }, { surgindoMs: 1500, passoMs: PASSO_NO_PORTAL_MS, fechamentoMs: 1000 });
  assert.deepEqual(CHEGADA_PADRAO, { ...Protecao.chegada() }, 'o mesmo ciclo que o servidor manda no welcome');
  const S = CHEGADA_PADRAO.surgindoMs;
  const P = CHEGADA_PADRAO.passoMs;
  const C = CHEGADA_PADRAO.fechamentoMs;
  assert.equal(duracaoDaChegada(), 3000, 'saída e chegada com 3 s cada');
  assert.equal(prontoNaChegada(), S + P, 'a tela confirma quando ele já está no lugar');
  const em = (t) => quadroDaChegada(t);
  assert.equal(em(0).fase, 'surgindo');
  perto(em(0).personagem.alpha, 0, 'ele começa invisível, dentro do portal');
  assert.equal(em(0).passo, 0);
  perto(em(S / 2).barra, 0.5, 'a barra conta o surgimento');
  let antes = em(0);
  for (let t = 50; t <= S; t += 50) {
    const q = em(t);
    assert.ok(q.personagem.alpha >= antes.personagem.alpha - 1e-9 && q.personagem.alpha - antes.personagem.alpha < 0.06, `surge suave em ${t}`);
    antes = q;
  }
  assert.ok(em(S - 1).personagem.alpha > 0.99, 'inteiro no fim do surgimento');
  assert.equal(em(S - 1).passo, 0, 'surge parado, no portal');
  // O passo: do portal para a casa dele, com a passada.
  assert.equal(em(S).fase, 'saindo');
  perto(em(S + P / 2).passo, 0.5, 'no meio da casa');
  assert.equal(em(S + P / 2).andando, true);
  assert.equal(em(S + P / 2).barra, 0);
  perto(em(S + P / 2).portal.alpha, 1, 'o portal segue aberto enquanto ele sai');
  // Depois que ele andou: em 1 s o portal some, sozinho; ele fica (passo 1, inteiro).
  assert.equal(C, 1000, '"em 1 s ele some"');
  const fechando = em(S + P + C / 2);
  assert.equal(fechando.fase, 'fechando');
  assert.deepEqual([fechando.passo, fechando.andando, fechando.personagem.alpha], [1, false, 1]);
  assert.ok(fechando.portal.alpha < 1 && fechando.portal.escala < 1, 'o portal some (e encolhe)');
  const fim = em(S + P + C);
  assert.deepEqual([fim.fase, fim.portal.alpha, fim.personagem.alpha, fim.barra, fim.passo], ['fim', 0, 1, 0, 1], 'no fim: nada do portal fica; o boneco, no lugar dele');
  assert.equal(quadroDaChegada(1000, { surgindoMs: 1000, passoMs: 200, fechamentoMs: 500 }).fase, 'saindo', 'segue a configuração');
});

test('a SAÍDA com o portal ao lado: olhando para ele durante a abertura, ENTRA no fim dela e some no fechamento', async () => {
  const P = PASSO_NO_PORTAL_MS;
  const em = (t) => quadroDoCiclo(t);
  assert.deepEqual([em(0).passo, em(0).andando], [0, false], 'ao lado do portal, parado');
  assert.ok(A - P >= ABRINDO_MS, 'o portal termina de abrir antes de ele entrar');
  assert.equal(em(A - P - 1).passo, 0, 'parado até o portal estar todo aberto');
  perto(em(A - P / 2).passo, 0.5, 'entrando');
  assert.equal(em(A - P / 2).andando, true);
  perto(em(A - P / 2).personagem.alpha, 1, 'entra inteiro');
  perto(em(A - P / 2).portal.alpha, 1, 'com o portal todo aberto');
  assert.deepEqual([em(A).passo, em(A).andando], [1, false], 'dentro do portal quando a abertura acaba');
  assert.ok(em(A + F / 2).personagem.alpha < 1 && em(A + F / 2).passo === 1, 'e vai sumindo lá dentro');
  assert.equal(em(A + F).passo, 1);
});

test('a CASA do portal: ao lado dele — na saída à frente (para onde está virado), na chegada a um lado; sem casa livre, a própria', async () => {
  const { casaDoPortal, ordemDaSaida, ORDEM_DA_CHEGADA, direcaoDoPasso } = await import('../frontend/client/src/portal-ciclo.mjs');
  const tudoLivre = () => true;
  const p = { x: 10, y: 10 };
  assert.deepEqual(casaDoPortal(p, ordemDaSaida(0), tudoLivre), { x: 10, y: 9 }, 'virado para o norte: o portal ao norte');
  assert.deepEqual(casaDoPortal(p, ordemDaSaida(1), tudoLivre), { x: 11, y: 10 }, 'virado para o leste: a leste');
  assert.deepEqual(casaDoPortal(p, ORDEM_DA_CHEGADA, tudoLivre), { x: 9, y: 10 }, 'na chegada, ao lado (oeste)');
  // A frente bloqueada: a próxima livre.
  const semNorte = (x, y) => !(x === 10 && y === 9);
  assert.deepEqual(casaDoPortal(p, ordemDaSaida(0), semNorte), { x: 11, y: 10 });
  assert.deepEqual(casaDoPortal(p, ORDEM_DA_CHEGADA, (x) => x !== 9), { x: 11, y: 10 }, 'o outro lado');
  assert.deepEqual(casaDoPortal(p, ORDEM_DA_CHEGADA, () => false), { x: 10, y: 10 }, 'cercado: o portal sob ele, como antes');
  // Para onde ele olha/anda.
  assert.equal(direcaoDoPasso(p, { x: 10, y: 9 }), 0);
  assert.equal(direcaoDoPasso({ x: 9, y: 10 }, p), 1, 'saindo do portal a oeste, anda para o leste');
  assert.equal(direcaoDoPasso(p, p, 3), 3, 'sem passo, a direção de antes');
  assert.deepEqual(ordemDaSaida(undefined), [2, 1, 3, 0], 'sem direção: o sul primeiro');
});

test('o LOOP da fase no MESMO mapa: entrada nova recomeça a cena (o boneco aparece na entrada, sem ser puxado pela instância de antes)', async () => {
  // Dono, 10/10: "na hunt, quando está na fase e completa 100% e está em loop, fica arrastando para o começo de forma não natural".
  const { entradaNova } = await import('../frontend/client/src/portal-ciclo.mjs');
  assert.equal(entradaNova('inst-1', 'inst-2'), true, 'a instância nova do loop');
  assert.equal(entradaNova('inst-1', 'inst-1'), false, 'a mesma instância: segue andando normal');
  assert.equal(entradaNova(undefined, 'inst-1'), false, 'a primeira entrada (quem recomeça é a troca de mapa)');
  assert.equal(entradaNova('inst-1', undefined), false, 'a cidade e o servidor antigo não têm entrada');
  // O mapa usa a regra no retrato e recomeça as criaturas (como na troca de mapa e de andar).
  const { readFileSync } = await import('node:fs');
  const fonte = readFileSync(new URL('../frontend/client/src/map.mjs', import.meta.url), 'utf8');
  const trecho = fonte.slice(fonte.indexOf('if (entradaNova(this.entrada, payload.entrada)) {'));
  assert.ok(trecho.length > 0 && /this\.entities\.clear\(\);/.test(trecho.slice(0, 200)), 'entrada nova → as criaturas recomeçam');
});

test('a cortina "Carregando" leva o NOME do mapa: a fase, a caçada ou a cidade do ato (sem a frase "só um instante")', async () => {
  // Dono, 10/10: "não precisa colocar 'só um instante, o mapa está chegando'; coloque 'carregando' e o nome do mapa que está carregando".
  const { nomeDaCena } = await import('../frontend/client/src/portal-ciclo.mjs');
  assert.equal(nomeDaCena({ hunt: { fase: { nome: 'A Costa' }, session: { hunts: ['poe-a1-the-coast'] } } }), 'A Costa', 'a fase da campanha');
  assert.equal(nomeDaCena({ hunt: { session: { hunts: ['Mapa T1', 'Mapa T2'] } } }), 'Mapa T2', 'fora da campanha: a caçada de agora no analisador');
  assert.equal(nomeDaCena({ city: { cidade: { id: 'poe-a2', nome: 'Acampamento da Floresta', ato: 2 } } }), 'Ato 2 · Acampamento da Floresta');
  assert.equal(nomeDaCena({ city: { cidade: { id: 'city', nome: 'Draevor', ato: null } } }), 'Draevor', 'o clássico: a cidade única');
  assert.equal(nomeDaCena({}), '');
  // A tela: título "Carregando", sem frase de espera.
  const { readFileSync } = await import('node:fs');
  const main = readFileSync(new URL('../frontend/client/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /carregando: 'Carregando',/);
  assert.match(main, /carregando: '',/);
  assert.doesNotMatch(main, /'só um instante — o mapa está chegando'/, 'a frase da tela saiu');
});

test('os portais de viagem do SERVIDOR que são da minha viagem não são desenhados (a tela anima a dela); os dos outros e o do chefe, sim', async () => {
  // Dono, 10/10: "quando chego de tp na hunt, em vez de sumir, aparece outro tp do lado e some"; "no fim do loop aparece em 2 locais".
  const { meuPortalDeViagem, PORTAL_DE_VIAGEM } = await import('../frontend/client/src/portal-ciclo.mjs');
  const portal = (extra) => ({ t: 'portal', x: 5, y: 5, ms: 1300, asset: PORTAL_DE_VIAGEM, ...extra });
  const minhas = ['inst-nova', 'inst-velha'];
  assert.equal(meuPortalDeViagem(portal({ chegada: true, entrada: 'inst-nova' }), minhas), true, 'a minha chegada');
  assert.equal(meuPortalDeViagem(portal({ entrada: 'inst-velha' }), minhas), true, 'o portal sob mim antes da troca de instância');
  assert.equal(meuPortalDeViagem(portal({ chegada: true, proprio: true }), []), true, 'a viagem entre cidades');
  assert.equal(meuPortalDeViagem(portal({ chegada: true, entrada: 'inst-do-amigo' }), minhas), false, 'o do colega da party aparece');
  assert.equal(meuPortalDeViagem(portal({ chegada: true }), minhas), false, 'sem dono (servidor antigo): aparece');
  assert.equal(meuPortalDeViagem({ t: 'portal', x: 5, y: 5, asset: 'fabrica-portal-do-chefe', entrada: 'inst-nova' }, minhas), false, 'o portal do chefe não é de viagem');
  assert.equal(meuPortalDeViagem({ t: 'dmg', entrada: 'inst-nova' }, minhas), false);
});
