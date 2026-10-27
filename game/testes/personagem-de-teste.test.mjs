// O PERSONAGEM DE TESTE (dono, 27/10: "ADM GODINES no lv máximo, não entra no ranking e não pode morrer — chega a 0 de vida e não morre,
// mas toma dano para testar as coisas; tudo liberado, todos os atos completados e uns 5 mapas de cada no baú").
// - com a marca `testador`, o golpe letal (corpo a corpo, magia/mecânica, dano contínuo) deixa a vida no piso (1) — o dano aparece, sem
//   `fatal` e sem `death`; na sessão ele segue na caçada; na caçada offline, não morre;
// - o ranking (o do jogo, o do site e a exp do dia) não o lista — nem pelo banco nem ao vivo;
// - a ferramenta `admin/personagem-de-teste.mjs` mexe só no alvo, guarda o backup, recusa online e é idempotente.
import { PASTA } from './apoio-banco-temporario.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as B from '../database/banco.mjs';
import { Sessao } from '../websocket/sessao.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Poderes from '../systems/poderes.mjs';
import * as Dot from '../systems/combate/dot.mjs';
import * as Mecanicas from '../systems/mobs/mecanicas.mjs';
import * as R from '../systems/regras.mjs';
import * as Ranking from '../systems/ranking.mjs';
import * as Site from '../systems/site.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as Mapas from '../systems/itens-poe/mapas.mjs';
import * as Dispositivo from '../systems/mapas-dispositivo.mjs';
import { contraAtaque } from '../systems/hunt/combate.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import * as Testador from '../systems/personagem/testador.mjs';
import * as Ferramenta from '../admin/personagem-de-teste.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';

const NOME = 'Testador Imortal';

function sessaoNaCacada({ testador = true } = {}) {
  const enviados = [];
  const s = new Sessao({ readyState: 1, send: (texto) => enviados.push(JSON.parse(texto)) });
  s.conta = { id: 'teste-do-testador' };
  s.personagem = { id: 0, nome: NOME };
  s.estado = personagemDeTeste({ vocacao: 'knight', level: 50 });
  if (testador) s.estado.testador = true;
  s.estado.pos = { ...R.POSICAO_INICIAL };
  const r = Cacadas.entrar(s.estado, { huntId: HUNT_DE_TESTE, mode: 'auto' });
  assert.ok(r.ok, r.erro);
  s.segurarNaEntrada = () => false;
  return { s, enviados };
}

const noPersonagem = (e) => e.t === 'dmg' && !e.foe && !e.lacaio && e.uid === 'player' && e.quem === NOME && e.v > 0;

test('o piso: só o personagem com a marca; abaixo dele, `segurarVida` devolve ao piso', () => {
  assert.equal(Testador.pisoDaVida({ testador: true }), 1);
  assert.equal(Testador.pisoDaVida({}), 0);
  assert.equal(Testador.pisoDaVida({ testador: 'sim' }), 0, 'só `true` vale');
  const e = { testador: true, hp: -30 };
  assert.equal(Testador.segurarVida(e), true);
  assert.equal(e.hp, Testador.VIDA_MINIMA);
  const outro = { hp: 0 };
  assert.equal(Testador.segurarVida(outro), false);
  assert.equal(outro.hp, 0, 'o personagem comum continua morrendo');
});

test('golpe corpo a corpo letal no testador: o dano aparece, a vida fica no piso, sem a marca de golpe fatal', () => {
  const { s } = sessaoNaCacada();
  const e = s.estado;
  const bicho = Object.assign(criarMonstro({ key: e.hunt.monstros[0]?.key ?? 'troll', x: e.hunt.pos.x + 1, y: e.hunt.pos.y }, null), { attack: 1e6 });
  let acertou = 0;
  for (let i = 0; i < 200; i++) {
    e.hp = 1;
    e.es = 0;
    const eventos = [];
    contraAtaque(e, e.hunt, s.personagem, bicho, eventos);
    assert.equal(e.hp, Testador.VIDA_MINIMA, 'a vida passou do piso');
    const golpes = eventos.filter(noPersonagem);
    acertou += golpes.length;
    assert.ok(golpes.every((g) => !g.fatal), 'golpe marcado como fatal no testador');
  }
  assert.ok(acertou > 0, 'nenhum golpe acertou (o teste não provou nada)');
});

test('magia / mecânica letal (`aplicarNoJogador`) no testador: o número aparece e a vida fica no piso', () => {
  const { s } = sessaoNaCacada();
  const e = s.estado;
  e.hp = 10;
  e.es = 0;
  const eventos = [];
  const dano = Poderes.danoDeElementoNoJogador(e, e.hunt, s.personagem, { name: 'General Adus', key: 'general-adus', uid: 'adus' }, 1e7, 'energy', eventos, 'Bomba Viva', Ficha.combate(e), false);
  assert.ok(dano > 0, 'o dano chegou');
  assert.equal(e.hp, Testador.VIDA_MINIMA);
  const ev = eventos.find(noPersonagem);
  assert.ok(ev && ev.v > 0, 'o número do golpe');
  assert.equal(ev.fatal, undefined);
});

test('dano contínuo letal no testador: pulsa, tira vida e para no piso (vivo)', () => {
  const { s } = sessaoNaCacada();
  const e = s.estado;
  const h = e.hunt;
  e.hp = Math.min(e.maxHp, 500);
  e.es = 0;
  h.clock = h.clock ?? 0;
  Dot.aplicarNoJogador(h, { tipo: 'queimadura', total: 1e9, origem: { fonte: 'mob', mob: 'Fogaréu', uid: 'f1' } }, h.clock);
  const eventos = [];
  for (let i = 0; i < 20; i++) {
    h.clock += 500;
    Mecanicas.tique(e, h, s.personagem, eventos);
  }
  assert.ok(eventos.some(noPersonagem), 'o dano contínuo não pulsou');
  assert.equal(e.hp, Testador.VIDA_MINIMA);
});

test('na sessão: com a vida no fio a cada tique, o testador apanha e segue na caçada — nunca o `death`', async () => {
  const { s, enviados } = sessaoNaCacada();
  const original = Date.now;
  let agora = original();
  Date.now = () => agora;
  let golpes = 0;
  try {
    for (let i = 0; i < 1200; i++) {
      s.estado.hp = Math.min(s.estado.hp, 1);
      s.estado.es = 0;
      agora += 250;
      await s.tique();
      assert.ok(s.estado.hunt, `saiu da caçada no tique ${i}`);
      assert.ok(s.estado.hp >= Testador.VIDA_MINIMA, 'a vida zerou');
    }
  } finally {
    Date.now = original;
  }
  for (const m of enviados) golpes += (m.events ?? []).filter(noPersonagem).length;
  assert.equal(enviados.filter((m) => m.t === 'death').length, 0, 'o testador morreu');
  assert.ok(golpes > 0, 'nenhum golpe chegou nele (o teste não provou nada)');
  assert.equal(Ficha.totais(s.estado).deaths ?? 0, 0);
});

test('a morte barrada na sessão: a vida que zerou por qualquer caminho volta ao piso antes da conferência da morte', async () => {
  const { s, enviados } = sessaoNaCacada();
  // (a vida zerada "por fora" — um caminho de dano que não passou pelo piso)
  s.estado.hp = 0;
  await s.tique();
  assert.equal(enviados.filter((m) => m.t === 'death').length, 0);
  assert.ok(s.estado.hunt);
  assert.ok(s.estado.hp >= Testador.VIDA_MINIMA);
});

test('a caçada offline: o testador com 1 de vida máxima não morre; o mesmo personagem sem a marca morre', () => {
  const rodar = (testador) => {
    const e = personagemDeTeste({ vocacao: 'knight', level: 8 });
    if (testador) e.testador = true;
    const r = Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' });
    assert.ok(r.ok, r.erro);
    // Frágil de propósito: qualquer golpe zera a vida de quem não tem a marca.
    e.maxHp = 1;
    e.hp = 1;
    e.equipment = {};
    const agora = Date.now();
    e.hunt.offlineDesde = agora - 20 * 60_000;
    return { e, a: Cacadas.simularAusencia(e, { id: 0, nome: NOME }, agora) };
  };
  const comum = rodar(false);
  assert.ok(comum.a?.morreu, 'o personagem comum devia morrer (o teste não provaria nada)');
  const t = rodar(true);
  assert.ok(t.a, 'sem ausência simulada');
  assert.equal(t.a.morreu, false, 'o testador morreu na caçada offline');
  assert.ok(t.e.hunt, 'o testador saiu da caçada');
  assert.ok(t.e.hp >= Testador.VIDA_MINIMA);
});

// ---------------------------------------------------------------- o ranking e a ferramenta (SQLite temporário, sem DATABASE_URL)

let contaId = null;
async function conta() {
  contaId ??= (await B.criarConta({ email: `testador-${Date.now()}@teste.local`, senha: 'segredo123' })).id;
  return contaId;
}
const criar = async (nome, estado) => B.criarPersonagem({ conta: await conta(), nome, vocacao: estado.vocation, sexo: 'male', estadoInicial: estado });
const estadoDoBanco = async (nome) => (await B.banco.prepare('SELECT estado FROM personagens WHERE nome = ?').get(nome)).estado;

test('o ranking não lista o testador: nem pelo banco (jogo e site, exp do dia), nem ao vivo', async () => {
  const dia = Math.floor((Date.now() - 3 * 3_600_000) / 864e5);
  const forte = personagemDeTeste({ level: 90 });
  forte.testador = true;
  forte.expDoDia = { dia, xp: 0, level: 1 };
  const comum = personagemDeTeste({ level: 20 });
  comum.expDoDia = { dia, xp: 0, level: 1 };
  await criar('Ranking Testador', forte);
  await criar('Ranking Comum', comum);
  Ranking.ligar(new Map());
  const exp = await Ranking.topo('exp');
  assert.ok(exp.some((l) => l.name === 'Ranking Comum'), 'o comum devia estar no ranking');
  assert.ok(!exp.some((l) => l.name === 'Ranking Testador'), 'o testador apareceu no ranking de exp');
  assert.ok(!(await Ranking.topo('level')).some((l) => l.name === 'Ranking Testador'), 'o testador apareceu no ranking de level');
  const st = await Site.status('level');
  assert.ok(!st.highscore.some((l) => l.name === 'Ranking Testador'), 'o testador apareceu no highscore do site');
  assert.ok(!st.expHoje.some((l) => l.name === 'Ranking Testador'), 'o testador apareceu na exp de hoje');
  assert.ok(st.expHoje.some((l) => l.name === 'Ranking Comum'));
  assert.ok(st.maiorLevel < 90, 'o maior level do site veio do testador');
  // Ao vivo (online): o valor da sessão também não entra.
  const vivo = personagemDeTeste({ level: 95 });
  vivo.testador = true;
  Ranking.ligar(new Map([['Ranking Ao Vivo', { personagem: { nome: 'Ranking Ao Vivo' }, estado: vivo }], ['Ranking Testador', { personagem: { nome: 'Ranking Testador' }, estado: forte }]]));
  try {
    const aoVivo = await Ranking.topo('exp');
    assert.ok(!aoVivo.some((l) => l.name === 'Ranking Ao Vivo' || l.name === 'Ranking Testador'), 'o testador online apareceu no ranking');
  } finally {
    Ranking.ligar(new Map());
  }
});

test('a ferramenta: só mostra sem --gravar; com --gravar muda só o alvo (backup salvo), e a segunda vez não muda nada', async () => {
  const alvoAntes = personagemDeTeste({ level: 12, campanha: {} });
  alvoAntes.gold = 1234;
  // Já tem 2 mapas T1 e 10 Orbes do Caos: só o que falta entra.
  const { mapaSorteado } = await import('../systems/itens-poe/jogo.mjs');
  const MoedasPoe = await import('../systems/itens-poe/moedas.mjs');
  const caos = MoedasPoe.idDa('Chaos_Orb');
  alvoAntes.inventory = [...(alvoAntes.inventory ?? []), mapaSorteado(1, { raridade: 'normal', rng: () => 0.5 }), mapaSorteado(1, { raridade: 'normal', rng: () => 0.5 }), { id: caos, count: 10 }];
  await criar('ADM GODINES', alvoAntes);
  await criar('ADM GODINES 2', personagemDeTeste({ level: 12, campanha: {} }));
  const outroAntes = await estadoDoBanco('ADM GODINES 2');
  const textoAntes = await estadoDoBanco('ADM GODINES');

  const mostra = await Ferramenta.executar({ nome: 'ADM GODINES', pastaDeBackup: PASTA });
  assert.ok(mostra.ok, mostra.erro);
  assert.equal(mostra.gravou, false);
  assert.equal(await estadoDoBanco('ADM GODINES'), textoAntes, 'sem --gravar, nada muda');

  const errado = await Ferramenta.executar({ nome: 'adm godines', gravar: true, pastaDeBackup: PASTA });
  assert.equal(errado.ok, false, 'o nome tem de ser exato');
  assert.equal((await Ferramenta.executar({ nome: 'Ninguem Assim', gravar: true, pastaDeBackup: PASTA })).ok, false);

  const r = await Ferramenta.executar({ nome: 'ADM GODINES', gravar: true, pastaDeBackup: PASTA });
  assert.ok(r.ok, r.erro);
  assert.equal(r.gravou, true);
  assert.ok(existsSync(r.backup), 'o backup');
  assert.equal(JSON.stringify(JSON.parse(readFileSync(r.backup, 'utf8')).estado), textoAntes, 'o backup tem o estado antigo inteiro');
  assert.equal(await estadoDoBanco('ADM GODINES 2'), outroAntes, 'outro personagem mudou');

  const e = JSON.parse(await estadoDoBanco('ADM GODINES'));
  assert.equal(e.testador, true);
  assert.equal(e.level, R.levelMaximo());
  assert.equal(e.xp, R.expForLevel(R.levelMaximo()));
  assert.equal(e.hp, e.maxHp);
  for (const dif of Campanha.dificuldadesDoJogo()) {
    for (const f of Campanha.FASES) assert.ok(Campanha.faseCompleta(e, dif, f.huntId), `fase ${f.huntId} incompleta`);
    for (const ato of Campanha.ATOS_DO_EDITOR.keys()) assert.ok(Campanha.bossVencido(e, dif, ato), `chefe do ato ${ato}`);
  }
  assert.ok(Dispositivo.liberado(e), 'o Dispositivo de Mapas (Atlas) aberto');
  const pecas = [...(e.inventory ?? []), ...(e.pouch ?? []), ...e.deposito.flatMap((c) => c.itens)];
  for (const { tier } of Mapas.TIERS) assert.equal(pecas.filter((p) => Mapas.ehMapa(p) && Mapas.tierDaPeca(p) === tier).length, Ferramenta.MAPAS_POR_TIER, `mapas do tier ${tier}`);
  for (const m of Ferramenta.moedasAlvo()) {
    assert.equal(pecas.filter((p) => Number(p.id) === m.itemId).reduce((t, p) => t + (p.count ?? 1), 0), Ferramenta.MOEDAS_DE_CADA, m.slug);
  }
  assert.ok(e.gold >= Ferramenta.OURO_ALVO);
  assert.ok(e.testadorPreparado?.em);

  // A segunda vez: nada a mudar, nada gravado, o estado idêntico.
  const depois = await estadoDoBanco('ADM GODINES');
  const de_novo = await Ferramenta.executar({ nome: 'ADM GODINES', gravar: true, pastaDeBackup: PASTA });
  assert.ok(de_novo.ok, de_novo.erro);
  assert.equal(de_novo.mudou, false);
  assert.equal(de_novo.gravou, false);
  assert.equal(await estadoDoBanco('ADM GODINES'), depois, 'a segunda vez mudou o estado');

  // E o backup volta tudo.
  const volta = await Ferramenta.restaurar({ arquivo: r.backup, gravar: true, pastaDeBackup: PASTA });
  assert.ok(volta.ok, volta.erro);
  assert.equal(JSON.stringify(JSON.parse(await estadoDoBanco('ADM GODINES'))), textoAntes, 'o restaurar não voltou o estado');
});

test('a ferramenta recusa gravar com o personagem online (gravado pelo servidor há pouco)', async () => {
  const p = await criar('ADM ONLINE', personagemDeTeste({ level: 12, campanha: {} }));
  await B.banco.prepare('UPDATE personagens SET visto_em = ? WHERE id = ?').run(Date.now() - 10_000, p.id);
  const antes = await estadoDoBanco('ADM ONLINE');
  const r = await Ferramenta.executar({ nome: 'ADM ONLINE', gravar: true, pastaDeBackup: join(PASTA, 'online') });
  assert.equal(r.ok, false);
  assert.match(r.erro, /ONLINE/);
  assert.equal(await estadoDoBanco('ADM ONLINE'), antes);
  assert.equal(existsSync(join(PASTA, 'online')), false, 'nem o backup');
});

// ---------------------------------------------------------------- (revisão) os outros danos em você e a vitrine da capa

test('o Ritual Proibido letal no testador: o dano aparece, a vida fica no piso, sem `fatal`; o personagem comum ainda morre', async () => {
  const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
  if (!Catalogo.ligado()) return; // (só no modo PoE)
  const Acoes = await import('../systems/acoes.mjs');
  const GS = await import('../systems/skills/gemas.mjs');
  const G = await import('../systems/itens-poe/gemas-poe.mjs');
  const Afixos = await import('../systems/afixos.mjs');
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const travado = (fn) => { const antes = Math.random; Math.random = () => 0.5; try { return fn(); } finally { Math.random = antes; } };
  const rodar = (testador) => {
    const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
    if (testador) e.testador = true;
    const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
    arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.equipment = { ...e.equipment, weapon: arma };
    delete e.equipment.shield;
    e.inventory = [GS.itemDaGema({ id: G.doSlug('Forbidden_Rite').itemId, nivel: 20, xp: 0, raridade: 'comum', qualidade: 0 })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
    e.actions = Array(Acoes.SLOTS).fill(null);
    e.actions[0] = { id: G.doSlug('Forbidden_Rite').acao, enabled: true, minMana: 0, conditions: [] };
    Afixos.sincronizarMaximos(e);
    Ficha.invalidar(e);
    assert.ok(travado(() => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
    e.hunt.clock = 100_000;
    e.mana = e.maxMana = 1e7;
    const [b, ...resto] = e.hunt.monstros;
    for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
    Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, armaduraPct: -100, dots: [] });
    e.maxHp = 1000;
    e.hp = 50;
    e.es = 0;
    Ficha.invalidar(e);
    const personagem = { id: 0, nome: NOME };
    const eventos = travado(() => {
      const r = Acoes.disparar(e, e.hunt, personagem, 0, b, { manual: true });
      assert.ok(r.ok, r.erro);
      const ev = [...(r.eventos ?? r.events ?? [])];
      if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; ev.push(...(Acoes.concluirConjuracao(e, e.hunt, personagem) ?? [])); }
      return ev;
    });
    return { e, eventos };
  };
  const comum = rodar(false);
  assert.equal(comum.e.hp, 0, 'o personagem comum devia morrer pelo Ritual (o teste não provaria nada)');
  const t = rodar(true);
  assert.equal(t.e.hp, Testador.VIDA_MINIMA, 'o Ritual passou do piso no testador');
  const doRitual = t.eventos.filter((x) => x?.t === 'dmg' && x.golpe === 'Ritual Proibido');
  assert.ok(doRitual.length > 0, 'o número do Ritual não apareceu');
  assert.ok(doRitual.every((x) => !x.fatal && x.v > 0), 'o Ritual saiu com `fatal` no testador');
  assert.ok(comum.eventos.some((x) => x?.t === 'dmg' && x.golpe === 'Ritual Proibido' && x.fatal), 'no comum, o golpe letal segue `fatal`');
});

test('o Sangue Petrificado e a reserva da Dissolução: o testador fica no piso; o comum zera, como antes', async () => {
  const A2 = await import('../systems/itens-poe/gemas-a2.mjs');
  const CondicoesPoe = await import('../systems/itens-poe/condicoes-poe.mjs');
  // o Sangue Petrificado: 1000 de Vida a perder em 1 s
  for (const testador of [false, true]) {
    const e = { hp: 100, maxHp: 1000, ...(testador ? { testador: true } : {}) };
    const hunt = { a2: { sangue: [{ de: 0, ate: 1000, porMs: 1, resto: 0 }] } };
    A2.tiqueDoSangue(e, hunt, 1000);
    assert.equal(e.hp, testador ? Testador.VIDA_MINIMA : 0, `Sangue (testador: ${testador})`);
  }
  // a reserva da Dissolução maior que a Vida máxima
  for (const testador of [false, true]) {
    const e = { hp: 100, maxHp: 100, ...(testador ? { testador: true } : {}) };
    const hunt = { dissolucao: { reservado: 500, ultimo: 0 } };
    CondicoesPoe.tiqueDaDissolucao(e, hunt, { afPoe: { dissolucao_reserva_s: 10 } }, 1000);
    assert.equal(e.hp, testador ? Testador.VIDA_MINIMA : 0, `Dissolução (testador: ${testador})`);
  }
});

test('a vitrine da capa do site não recebe os drops do testador (o comum entra)', async () => {
  const DropsDoSite = await import('../systems/drops-do-site.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const base = Number(Object.keys(ITEM_CATALOG).find((k) => ITEM_CATALOG[k].poe)) || 34109;
  const contar = async (quem) => Number((await B.banco.prepare('SELECT COUNT(*) AS n FROM site_drops WHERE dados LIKE ?').get(`%"quem":"${quem}"%`)).n);
  DropsDoSite.gravarNosTestes(true);
  try {
    const unico = { id: base, count: 1, poe: { raridade: 'unico', nome: 'Único da Vitrine' } };
    await DropsDoSite.anotarDropPoe({ quem: 'Vitrine Testador', onde: 'A Costa', bicho: 'Hillock', peca: unico, estado: { testador: true } });
    await DropsDoSite.anotarDrop({ quem: 'Vitrine Testador', onde: 'Teste', bicho: 'Bicho', id: 34109, estado: { testador: true } });
    await DropsDoSite.anotarBag({ quem: 'Vitrine Testador', bag: 34109, entre: 3, id: 3081, estado: { testador: true } });
    assert.equal(await contar('Vitrine Testador'), 0, 'o drop do testador foi para a vitrine');
    await DropsDoSite.anotarDropPoe({ quem: 'Vitrine Comum', onde: 'A Costa', bicho: 'Hillock', peca: unico, estado: {} });
    assert.equal(await contar('Vitrine Comum'), 1, 'o drop do personagem comum devia entrar (o teste não provaria nada)');
  } finally {
    DropsDoSite.gravarNosTestes(false);
  }
});

test('a ferramenta recusa gravar logo depois do login da conta (a tabela `sessoes`), mesmo sem gravação recente; o aviso vai no topo', async () => {
  const p = await criar('ADM LOGOU', personagemDeTeste({ level: 12, campanha: {} }));
  await B.banco.prepare('UPDATE personagens SET visto_em = ? WHERE id = ?').run(Date.now() - 3_600_000, p.id);
  await B.abrirSessao(await conta());
  const antes = await estadoDoBanco('ADM LOGOU');
  const r = await Ferramenta.executar({ nome: 'ADM LOGOU', gravar: true, pastaDeBackup: join(PASTA, 'logou') });
  assert.equal(r.ok, false);
  assert.match(r.erro, /login/);
  assert.equal(r.linhas[0], Ferramenta.AVISO_ONLINE, 'o aviso de deslogar e esperar 2 minutos no topo');
  assert.equal(await estadoDoBanco('ADM LOGOU'), antes);
  assert.equal(existsSync(join(PASTA, 'logou')), false, 'nem o backup');
  // o login antigo (mais de 2 minutos) não segura
  assert.equal(Ferramenta.motivoOnline({ nome: 'X', visto_em: 0 }, Date.now(), { loginEm: Date.now() - 3 * 60_000 }), null);
});
