// O PORTAL da gema do PoE (dono, 02/11: "como o PoE" — antes "não se aplica"): o uso (à mão, com os 2,5 s de conjuração da gema) leva você para a
// cidade e a caçada fica guardada (as casas, os monstros vivos, a limpeza, o relógio); a volta pelo portal leva ao MESMO lugar. O portal dura até
// ser usado ou até outra caçada; na party, quem usa vai sozinho e volta para a sala da party; no mapa, não gasta um dos 6 portais do mapa.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const PortalDaGema = await import('../systems/itens-poe/portal-da-gema.mjs');
const Dispositivo = await import('../systems/mapas-dispositivo.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const AREA = 'poe-a1-the-coast';
const todos = (h) => [...h.monstros, ...Object.values(h.outrosAndares ?? {}).flat()];
const vivos = (h) => todos(h).filter((m) => m.hp > 0);
const uids = (lista) => lista.map((m) => m.uid).sort((a, b) => a - b);

/** Um personagem com a gema Portal ligada na arma e no slot 1 da barra, numa caçada (o molde do `gemas-sem-efeito-a2`). */
function montar({ qualidade = 0, huntId = AREA } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'One_Hand_Swords/Rusted_Sword', raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  a.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = [GS.itemDaGema({ id: G.doSlug('Portal').itemId, nivel: 1, xp: 0, raridade: 'comum', qualidade })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug('Portal').acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId, mode: 'auto', strategy: 'nearest' }).ok, 'entrou na caçada');
  e.hunt.clock = 100_000;
  e.hp = e.maxHp = 1e9;
  return e;
}
/** Uma casa andável da área longe da entrada (para conferir que a volta é na casa do portal, não na entrada). */
function casaLonge(h) {
  const g = Cacadas.andarDaGrade(Cacadas.gradeDaHunt({ id: h.huntId }), h.z ?? 0);
  let melhor = null;
  for (const k of g.andavel) {
    const [x, y] = k.split(',').map(Number);
    const d = Math.abs(x - h.pos.x) + Math.abs(y - h.pos.y);
    if (d >= 6 && d <= 20 && !todos(h).some((m) => m.x === x && m.y === y)) { melhor = { x, y }; break; }
  }
  assert.ok(melhor, 'achou uma casa longe da entrada');
  return melhor;
}

test('o Portal: funciona no jogo (sem o "não se aplica"), é de suporte e não tem bloqueio', { skip: SEM }, async () => {
  await import('../systems/itens-poe/jogo.mjs');
  const r = G.doSlug('Portal');
  assert.equal(r.arquetipo, 'portal');
  assert.equal(r.statusNoJogo, 'funciona', r.motivosNoJogo.join(' | '));
  assert.deepEqual(r.motivosNoJogo, []);
  assert.equal(r.naoSeAplica, undefined);
  assert.equal(G.NAO_SE_APLICA.Portal, undefined);
  const e = montar();
  const entry = Acoes.catalogo(e).spells.find((x) => x.id === r.acao);
  assert.ok(entry, 'o Portal está no catálogo de ações');
  assert.ok(!entry.blocked, `sem bloqueio: ${entry.blocked}`);
  assert.deepEqual(entry.papeis, ['suporte'], 'não é ataque (não entra no combo nem é barrado na zona segura)');
});

test('o uso: só à mão; 2,5 s de conjuração (com a qualidade, 60% de Velocidade de Conjuração: 2,5 / 1,6); no fim, a saída pelo portal', { skip: SEM }, () => {
  const e = montar();
  const auto = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, null, {});
  assert.equal(auto.ok, false);
  assert.equal(auto.motivo, 'PORTAL_A_MAO', 'a barra automática não leva ninguém para a cidade');
  // a caçada automática roda com o Portal ligado na barra: ninguém sai
  let relogio = Date.now();
  for (let i = 0; i < 20 && e.hunt; i++) Cacadas.tique(e, PERSONAGEM, (relogio += 250));
  assert.ok(e.hunt && !e.hunt.saidaPeloPortal && e.hunt.conjurando?.id !== G.doSlug('Portal').acao, 'o automático não usa o Portal');

  e.hunt.conjurando = null;
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, null, { manual: true });
  assert.equal(r.ok, true, r.erro);
  assert.equal(r.conjurando, true);
  const c = e.hunt.conjurando;
  assert.equal(c.fim - c.inicio, 2500, 'o Tempo de Conjuração da gema: 2,50 s');
  assert.equal(e.hunt.saidaPeloPortal, undefined, 'conjurando: ainda não saiu');
  e.hunt.clock = c.fim;
  Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM);
  assert.ok(e.hunt.saidaPeloPortal, 'no fim da conjuração, a saída fica marcada (a sessão faz a viagem)');

  const q = montar({ qualidade: 20 });
  assert.equal(Acoes.disparar(q, q.hunt, PERSONAGEM, 0, null, { manual: true }).ok, true);
  assert.equal(q.hunt.conjurando.fim - q.hunt.conjurando.inicio, Math.round(2500 / 1.6), 'a qualidade 20: Velocidade de Conjuração aumentada em 60%');
});

test('a ida e a volta (sozinho): a mesma área, os mesmos monstros vivos, a limpeza, o relógio e a casa do portal; o portal fecha na volta', { skip: SEM }, () => {
  const e = montar();
  const h = e.hunt;
  // mata alguns e anda até longe da entrada
  const mortos = vivos(h).slice(0, 3);
  for (const m of mortos) m.hp = 0;
  const casa = casaLonge(h);
  Object.assign(h.pos, casa);
  h.clock = 777_000;
  const antes = { vivos: uids(vivos(h)), instancia: h.instancia?.id, huntId: h.huntId, sessao: h.sessao };
  assert.ok(antes.instancia, 'a área do PoE tem instância');
  assert.equal(PortalDaGema.guardar(e, { nome: 'A Costa' }).ok, true);
  Cacadas.sair(e, { manterLoop: true });
  assert.equal(e.hunt, null, 'na cidade');
  // o portal vai para o banco com o personagem (JSON puro) e volta
  e.portalDaGema = JSON.parse(JSON.stringify(e.portalDaGema));
  assert.deepEqual(PortalDaGema.paraTela(e), { nome: 'A Costa', huntId: AREA, mapa: false, abertoEm: e.portalDaGema.abertoEm });

  const r = Cacadas.voltarPeloPortalDaGema(e);
  assert.equal(r.ok, true, r.erro);
  assert.equal(e.hunt.huntId, antes.huntId);
  assert.deepEqual(uids(vivos(e.hunt)), antes.vivos, 'os mesmos monstros vivos (os mortos continuam mortos)');
  assert.equal(e.hunt.instancia.id, antes.instancia, 'a mesma instância (a limpeza continua)');
  assert.deepEqual({ x: e.hunt.pos.x, y: e.hunt.pos.y }, casa, 'na casa onde o portal abriu');
  assert.ok(e.hunt.clock >= 777_000, 'o relógio continua de onde parou');
  assert.deepEqual(e.hunt.sessao, JSON.parse(JSON.stringify(antes.sessao)), 'o relatório da caçada continua');
  assert.equal(e.portalDaGema, null, 'usado para voltar, o portal fecha');
  assert.equal(Cacadas.voltarPeloPortalDaGema(e).ok, false);
});

test('o portal dura até abrir OUTRA caçada; no duelo e na sala do chefe pináculo ele não abre', { skip: SEM }, () => {
  const e = montar();
  assert.equal(PortalDaGema.guardar(e).ok, true);
  Cacadas.sair(e, { manterLoop: true });
  assert.ok(e.portalDaGema);
  assert.equal(Cacadas.entrar(e, { huntId: AREA, mode: 'auto', strategy: 'nearest' }).ok, true);
  assert.equal(e.portalDaGema, null, 'outra caçada fecha o portal');
  assert.match(PortalDaGema.motivoParaNaoAbrir({ pvp: { duelo: 1 } }), /duelo/);
  assert.match(PortalDaGema.motivoParaNaoAbrir({ isBoss: true, campanha: null }), /chefe/);
  assert.equal(PortalDaGema.motivoParaNaoAbrir({ isBoss: true, campanha: { bossDoAto: 1 } }), null, 'o chefe do ato: abre (a volta é pelo portal do ato)');
});

test('no MAPA: o Portal não gasta um dos 6 portais do mapa; a volta é ao mapa aberto, com os monstros que ficaram, na casa do portal', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.hp = e.maxHp = 1e9;
  for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = Array.from({ length: 10 }, (_, i) => i + 1);
  Bolsa.garantir(e);
  const peca = Jogo.mapaSorteado(1, { raridade: 'normal' });
  e.inventory.push(peca);
  const m = Dispositivo.mapasCarregados(e).find((x) => x.peca === peca);
  assert.equal(Dispositivo.abrir(e, { onde: m.onde, indice: m.indice, assinatura: m.assinatura, mode: 'auto' }).ok, true, 'abriu o mapa');
  const a = e.mapas.aberto;
  const portais = a.portais;
  for (const x of vivos(e.hunt).slice(0, 4)) x.hp = 0;
  const casa = casaLonge(e.hunt);
  Object.assign(e.hunt.pos, casa);
  const restam = uids(vivos(e.hunt));
  assert.equal(PortalDaGema.guardar(e).ok, true);
  assert.equal(e.portalDaGema.mapaId, a.id);
  Cacadas.sair(e, { manterLoop: true });
  assert.equal(e.mapas.aberto?.id, a.id, 'o mapa continua aberto');
  assert.equal(e.mapas.aberto.portais, portais, 'nenhum portal do mapa gasto');

  const r = Cacadas.voltarPeloPortalDaGema(e);
  assert.equal(r.ok, true, r.erro);
  assert.equal(e.hunt.mapa?.id, a.id, 'de volta ao mesmo mapa');
  assert.equal(e.mapas.aberto.portais, portais, 'a volta também não gasta');
  assert.deepEqual(uids(vivos(e.hunt)), restam, 'os monstros que ficaram');
  assert.deepEqual({ x: e.hunt.pos.x, y: e.hunt.pos.y }, casa, 'na casa do portal');
  assert.equal(e.portalDaGema, null);

  // o mapa que acabou (abandonado) fecha o portal
  assert.equal(PortalDaGema.guardar(e).ok, true);
  Cacadas.sair(e, { manterLoop: true });
  Dispositivo.abandonar(e);
  const r2 = Cacadas.voltarPeloPortalDaGema(e);
  assert.equal(r2.ok, false);
  assert.match(r2.erro, /portal fechou/);
  assert.equal(e.portalDaGema, null);
});

// ---------------------------------------------------------------- a party (as sessões de verdade)

const criadas = [];
after(async () => {
  if (!criadas.length) return;
  const B = await import('../database/banco.mjs');
  const { vivas } = await import('../websocket/sessao.mjs');
  for (const { s, nome, conta } of criadas) {
    s.desconectar();
    vivas.delete(nome);
    await B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(conta);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta);
  }
});

test('na PARTY: quem usa vai sozinho (a sala fica com o outro, que segue puxando) e a volta entra na sala da party, na mesma instância', { skip: SEM }, async () => {
  const B = await import('../database/banco.mjs');
  const { Sessao } = await import('../websocket/sessao.mjs');
  const Party = await import('../systems/party.mjs');
  const R = await import('../systems/regras.mjs');
  const jogador = async (i) => {
    const conta = await B.criarConta({ email: `portal-${randomUUID()}@teste.local`, senha: 'senha-123' });
    const enviados = [];
    const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => enviados.push(JSON.parse(d)) });
    s.conta = { id: conta.id };
    const nome = `Po${i}${randomUUID().replace(/[^a-z]/g, '').slice(0, 6)}`;
    const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
    e.pos = { ...R.POSICAO_INICIAL };
    await s.concluirEntrada({ id: randomUUID(), nome }, e, null, null);
    s.gravadoEm = Infinity;
    criadas.push({ s, nome, conta: conta.id });
    return { s, nome, enviados };
  };
  const lider = await jogador(0);
  const outro = await jogador(1);
  assert.equal(Party.comandoDoGrupo(lider.s, { action: 'convidar', name: outro.nome }).ok, true);
  assert.equal(Party.comandoDoGrupo(outro.s, { action: 'aceitar' }).ok, true);
  lider.s.receber({ t: 'startHunt', huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade: 'facil' });
  assert.ok(lider.s.estado.hunt, 'o líder entrou');
  assert.equal(Party.comandoDaCaca(lider.s, { action: 'invite', name: outro.nome }).ok, true);
  assert.equal(Party.comandoDaCaca(outro.s, { action: 'accept' }).ok, true);
  const instancia = Cacadas.salaDe(lider.s.estado.hunt).instancia?.id;
  assert.ok(instancia, 'a sala tem instância');

  // o líder usa o Portal (o fim da conjuração marca a saída; a sessão faz a viagem)
  lider.s.estado.hunt.saidaPeloPortal = { em: 0 };
  assert.equal(lider.s.entrarNoPortalDaGema(), true);
  assert.equal(lider.s.estado.hunt, null, 'o líder foi para a cidade');
  assert.ok(outro.s.estado.hunt, 'o outro ficou na caçada (cada um entra no portal)');
  assert.equal(Cacadas.salaDe(outro.s.estado.hunt), outro.s.estado.hunt, 'a sala ficou com o outro');
  assert.equal(outro.s.estado.hunt.instancia?.id, instancia, 'na mesma instância');
  assert.equal(lider.s.estado.portalDaGema?.instanciaId, instancia);
  assert.ok(!lider.enviados.some((m) => m.t === 'runReport'), 'sem o relatório de fim de caçada: ela continua na volta');

  // a volta: na sala da party
  lider.s.receber({ t: 'voltarPeloPortal' });
  assert.ok(lider.s.estado.hunt, 'voltou');
  assert.equal(Cacadas.salaDe(lider.s.estado.hunt), outro.s.estado.hunt, 'na sala da party');
  assert.equal(lider.s.estado.portalDaGema, null, 'o portal fechou');
});
