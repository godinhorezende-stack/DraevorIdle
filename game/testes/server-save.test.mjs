// O Server Save (`systems/server-save.mjs`): agenda, avisos, a rotina, e — o principal — que o offline farm não é tocado.
// Banco real de teste (SQLite), relógio simulado, sessões falsas. Cada teste limpa o que criou.
import './apoio-banco-proprio.mjs'; // teste de carga: um SQLite só dele (ver o arquivo) — antes de qualquer módulo do jogo
import { test, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as SS from '../systems/server-save.mjs';
import { validarConfig, MENSAGENS, SERVER_SAVE } from '../systems/server-save-config.mjs';
import { proximoSlot } from '../systems/server-save-horario.mjs';
import * as Manutencao from '../systems/modo-de-manutencao.mjs';
import * as Consolidacao from '../systems/consolidacao-offline.mjs';
import * as SimulacaoOffline from '../systems/simulacao-offline.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as B from '../database/banco.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';
import { aAdaptar } from './apoio-migracao.mjs';

after(() => SimulacaoOffline.encerrar());

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;
const CFG = { timezone: 'America/Sao_Paulo', horaLocal: '05:00' };
const quieto = () => {};
// Outros arquivos de teste (em outros processos) usam o mesmo banco: só enxergo e apago os MEUS ciclos.
const MEU = [SS.PROCESSO_ID, 'outro-processo', 'caiu'];
const limparCiclos = () => B.banco.prepare(`DELETE FROM server_save_ciclos WHERE lider IN (${MEU.map(() => '?').join(',')})`).run(...MEU);
const ciclos = async (n = 10) => (await SS.ultimosCiclos(50)).filter((c) => MEU.includes(c.lider)).slice(0, n);

function relogioFalso(inicio) {
  let agora = inicio;
  let seq = 0;
  const timers = new Map();
  return {
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { em: agora + ms, fn }); return { id, unref() {} }; },
    clearTimeout: (t) => timers.delete(t?.id),
    agora: () => agora,
    cederLaco: () => Promise.resolve(),
    get pendentes() { return timers.size; },
    async avancar(ms) {
      const fim = agora + ms;
      for (;;) {
        const p = [...timers.entries()].filter(([, t]) => t.em <= fim).sort((a, b) => a[1].em - b[1].em)[0];
        if (!p) break;
        timers.delete(p[0]);
        agora = p[1].em;
        p[1].fn();
        for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
        // Espera a rotina de verdade terminar — por TEMPO, não por voltas do laço: com o banco ocupado (outros arquivos da suíte), 20.000
        // voltas não bastavam, o ciclo ficava "executando" e o teste seguinte não via o "concluído" (A4: sem "Último ciclo concluído"; A6: `ultimo` nulo).
        for (const ate = Date.now() + 15_000; SS.situacao()?.rodando && Date.now() < ate; ) await new Promise((r) => setTimeout(r, 1));
      }
      agora = fim;
    },
  };
}
// 2026-10-01 00:00 em São Paulo (UTC-3) = 03:00 UTC. O save é 05:00 SP = 08:00 UTC.
const T0 = Date.UTC(2026, 9, 1, 3, 0, 0);
const SLOT1 = Date.UTC(2026, 9, 1, 8, 0, 0);

const sessaoFalsa = (opcoes = {}) => ({ personagem: { id: 1 }, estado: {}, gravacoes: 0, async gravarAgora() { if (opcoes.falha) throw new Error('disco cheio'); this.gravacoes++; }, enviarPronto() {} });
const mensagens = () => { const lista = []; return { lista, anunciar: (t) => { lista.push(t); return 1; } }; };
const limpar = [];
afterEach(async () => {
  SS.parar();
  Manutencao.definir(false);
  SS.ligar(new Map());
  for (const f of limpar.splice(0)) await f();
  await limparCiclos();
});

async function ausente({ saida = Date.now() - 2 * HORA, nome = null, extra = {} } = {}) {
  const c = await B.criarConta({ email: `ss-${randomUUID()}@teste.local`, senha: 'senha-123' });
  const e = personagemDeTeste({ vocacao: 'knight', level: 200 });
  assert.equal(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto', strategy: 'nearest' }).ok, true);
  e.hunt.offlineDesde = saida;
  const p = await B.criarPersonagem({ conta: c.id, nome: nome ?? `Ss${randomUUID().replace(/[^a-z]/g, '').slice(0, 9)}`, vocacao: 'knight', sexo: 'male', estadoInicial: { ...e, ...extra, hunt: Cacadas.huntParaGravar(e.hunt) } });
  limpar.push(() => B.excluirPersonagem(p.id));
  return { id: p.id, nome: p.nome, conta: c.id, xpAntes: e.xp };
}
const linha = (id) => B.banco.prepare('SELECT id, conta, nome, vocacao, estado, caca_offline_desde AS desde, caca_offline_ate AS ate FROM personagens WHERE id = ?').get(id);

// ------------------------------------------------------------------ horário e config

test('H1. 05:00 em São Paulo é 08:00 UTC; depois do horário o próximo é o dia seguinte; é sempre estritamente depois', () => {
  assert.equal(proximoSlot(T0, CFG), SLOT1);
  assert.equal(proximoSlot(SLOT1 - 1, CFG), SLOT1);
  assert.equal(proximoSlot(SLOT1, CFG), SLOT1 + DIA, 'no instante exato, o próximo é o de amanhã (não repete o ciclo)');
  assert.equal(proximoSlot(SLOT1 + 3 * HORA, CFG), SLOT1 + DIA);
});

test('H2. o fuso manda: o mesmo "05:00" em outro fuso cai em outro instante, e o horário de verão é respeitado', () => {
  assert.equal(proximoSlot(T0, { timezone: 'UTC', horaLocal: '05:00' }), Date.UTC(2026, 9, 1, 5, 0, 0));
  // Nova York em outubro: UTC-4 (verão); em dezembro: UTC-5.
  assert.equal(proximoSlot(Date.UTC(2026, 9, 1, 0, 0), { timezone: 'America/New_York', horaLocal: '05:00' }), Date.UTC(2026, 9, 1, 9, 0));
  assert.equal(proximoSlot(Date.UTC(2026, 11, 1, 0, 0), { timezone: 'America/New_York', horaLocal: '05:00' }), Date.UTC(2026, 11, 1, 10, 0));
  // O dia da virada do horário de verão (8/11/2026 em NY): 05:00 local já é UTC-5.
  assert.equal(proximoSlot(Date.UTC(2026, 10, 8, 0, 0), { timezone: 'America/New_York', horaLocal: '05:00' }), Date.UTC(2026, 10, 8, 10, 0));
});

test('C1. configuração: padrão, valores inválidos voltam ao padrão com erro, intervalo múltiplo de 24, enabled:false', () => {
  assert.deepEqual({ ...SERVER_SAVE, warningsMinutes: [...SERVER_SAVE.warningsMinutes] }, { enabled: true, intervalHours: 24, timezone: 'America/Sao_Paulo', horaLocal: '05:00', warningsMinutes: [5, 1], maintenanceMode: false, batchSize: 100 });
  assert.equal(validarConfig({}, {}).erros.length, 0);
  const ruim = validarConfig({ intervalHours: 10, timezone: 'Marte/Olimpo', horaLocal: '25:99', warningsMinutes: [0], batchSize: 0 }, {});
  assert.equal(ruim.erros.length, 5);
  assert.equal(ruim.config.intervalHours, 24);
  assert.equal(ruim.config.timezone, 'America/Sao_Paulo');
  assert.equal(validarConfig({ intervalHours: 48, horaLocal: '4:30' }, {}).config.horaLocal, '04:30');
  assert.equal(validarConfig({}, { SERVER_SAVE_ENABLED: 'false' }).config.enabled, false);
  assert.equal(validarConfig({}, {}).config.maintenanceMode, false, 'a manutenção nasce desligada');
});

test('C2. as mensagens são exatamente as pedidas', () => {
  assert.equal(MENSAGENS.aviso5, '[SERVER SAVE] O salvamento diário do servidor acontecerá em 5 minutos. Seu offline farm será preservado.');
  assert.equal(MENSAGENS.aviso1, '[SERVER SAVE] O Server Save começará em 1 minuto. Seu progresso de offline farm será preservado.');
  assert.equal(MENSAGENS.inicio, '[SERVER SAVE] Iniciando rotina de salvamento do mundo.');
  assert.equal(MENSAGENS.concluido, '[SERVER SAVE] Salvamento concluído com sucesso!');
  assert.equal(MENSAGENS.falha, '[SERVER SAVE] Ocorreu uma falha durante o salvamento. O servidor continuará funcionando enquanto a situação é verificada.');
});

// ------------------------------------------------------------------ agenda

test('A1. iniciar NÃO executa save na hora; agenda o próximo horário previsível e loga', async () => {
  const rel = relogioFalso(T0);
  const m = mensagens();
  const linhas = [];
  await SS.iniciar({ relogio: rel, logger: (l) => linhas.push(l), anunciar: m.anunciar });
  assert.equal(m.lista.length, 0);
  assert.equal(SS.situacao().slot, SLOT1);
  assert.ok(linhas.some((l) => l.includes('Sistema iniciado')) && linhas.some((l) => l.includes('Próximo Server Save: 2026-10-01T08:00:00.000Z')));
  assert.equal((await ciclos()).length, 0);
});

test('A2. avisos em 5 e 1 minuto antes, depois "iniciando", e "concluído" só depois da rotina — nessa ordem, uma vez cada', async () => {
  const rel = relogioFalso(T0);
  const m = mensagens();
  await SS.iniciar({ relogio: rel, logger: quieto, anunciar: m.anunciar });
  await rel.avancar(SLOT1 - T0 - 5 * MIN - 1);
  assert.equal(m.lista.length, 0);
  await rel.avancar(1);
  assert.deepEqual(m.lista, [MENSAGENS.aviso5]);
  await rel.avancar(4 * MIN);
  assert.deepEqual(m.lista, [MENSAGENS.aviso5, MENSAGENS.aviso1]);
  await rel.avancar(MIN);
  assert.deepEqual(m.lista, [MENSAGENS.aviso5, MENSAGENS.aviso1, MENSAGENS.inicio, MENSAGENS.concluido]);
  const lista = await ciclos();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].estado, 'concluido');
  assert.equal(Number(lista[0].slot), SLOT1);
});

test('A3. roda todo dia, sem duplicar: 3 dias = 3 ciclos, 3 avisos de cada, e um timer vivo por vez', async () => {
  const rel = relogioFalso(T0);
  const m = mensagens();
  await SS.iniciar({ relogio: rel, logger: quieto, anunciar: m.anunciar });
  await rel.avancar(3 * DIA);
  assert.equal(m.lista.filter((t) => t === MENSAGENS.concluido).length, 3);
  assert.equal(m.lista.filter((t) => t === MENSAGENS.aviso5).length, 3);
  assert.equal(m.lista.filter((t) => t === MENSAGENS.aviso1).length, 3);
  assert.deepEqual((await ciclos(5)).map((c) => Number(c.slot)).reverse(), [SLOT1, SLOT1 + DIA, SLOT1 + 2 * DIA]);
  assert.equal(SS.situacao().timersAtivos, 3, 'dois avisos + a rotina do próximo ciclo, só');
});

test('A4. reiniciar o servidor não dispara save nem recupera ciclo perdido; o próximo horário é calculado do agora', async () => {
  const rel = relogioFalso(T0);
  const m = mensagens();
  await SS.iniciar({ relogio: rel, logger: quieto, anunciar: m.anunciar });
  await rel.avancar(SLOT1 - T0 + 2 * MIN); // o ciclo 1 rodou
  SS.parar();
  // O servidor ficou fora o dia inteiro e volta DEPOIS do horário do ciclo 2.
  const volta = relogioFalso(SLOT1 + DIA + 2 * HORA);
  const m2 = mensagens();
  const linhas = [];
  await SS.iniciar({ relogio: volta, logger: (l) => linhas.push(l), anunciar: m2.anunciar });
  assert.equal(m2.lista.length, 0, 'não executa nada na subida');
  assert.equal(SS.situacao().slot, SLOT1 + 2 * DIA, 'o ciclo perdido não é recuperado: o próximo é o de depois de amanhã');
  assert.ok(linhas.some((l) => l.includes('Último ciclo concluído: 2026-10-01T08:00:00.000Z')), linhas.join('\n'));
  assert.equal((await ciclos()).length, 1);
});

test('A5. subir a 30 s do horário: só o aviso de 1 min que já passou NÃO sai atrasado, e o save roda uma vez', async () => {
  const rel = relogioFalso(SLOT1 - 30_000);
  const m = mensagens();
  await SS.iniciar({ relogio: rel, logger: quieto, anunciar: m.anunciar });
  await rel.avancar(2 * MIN);
  assert.deepEqual(m.lista, [MENSAGENS.inicio, MENSAGENS.concluido]);
});

test('A6. dois processos no mesmo banco: só um conduz a verificação (o ciclo é reivindicado uma vez); o outro só grava os seus jogadores', async () => {
  const rel = relogioFalso(T0);
  await B.banco.prepare("INSERT INTO server_save_ciclos (slot, estado, lider, iniciado_em) VALUES (?, 'executando', 'outro-processo', ?)").run(SLOT1, T0);
  const m = mensagens();
  const mapa = new Map([['a', sessaoFalsa()]]);
  SS.ligar(mapa);
  await SS.iniciar({ relogio: rel, logger: quieto, anunciar: m.anunciar });
  // `iniciar` marca "executando" antigos como interrompidos; reabre o do outro processo para simular um ciclo vivo dele.
  await B.banco.prepare("UPDATE server_save_ciclos SET estado = 'executando' WHERE slot = ?").run(SLOT1);
  await rel.avancar(SLOT1 - T0 + MIN);
  const r = SS.situacao().ultimo;
  assert.equal(r.lider, false);
  assert.equal(r.offline, undefined, 'quem não lidera não varre o banco');
  assert.equal(mapa.get('a').gravacoes, 1, 'mas grava os jogadores do próprio processo');
  assert.equal(m.lista.at(-1), MENSAGENS.concluido);
});

test('A7. execução manual (admin) roda já, sem mexer na agenda; segunda ao mesmo tempo é recusada; desativado não liga nada', async () => {
  const rel = relogioFalso(T0);
  const m = mensagens();
  await SS.iniciar({ relogio: rel, logger: quieto, anunciar: m.anunciar });
  const slotAntes = SS.situacao().slot;
  const [a, b] = await Promise.all([SS.executarAgora(), SS.executarAgora()]);
  assert.equal([a, b].filter((r) => r.ok).length, 1);
  assert.match([a, b].find((r) => !r.ok).erro, /andamento/);
  assert.equal(SS.situacao().slot, slotAntes);
  assert.equal((await ciclos())[0].estado, 'concluido-manual');
  SS.parar();
  const relDesligado = relogioFalso(T0);
  const r = await SS.iniciar({ config: { enabled: false }, relogio: relDesligado, logger: quieto });
  assert.equal(r.desativado, true);
  assert.equal(relDesligado.pendentes, 0);
});

test('A8. parar() cancela todos os timers; ciclo que ficou "executando" de um processo que caiu vira "interrompido"', async () => {
  await B.banco.prepare("INSERT INTO server_save_ciclos (slot, estado, lider, iniciado_em) VALUES (?, 'executando', 'caiu', ?)").run(T0 - DIA, T0 - DIA);
  const rel = relogioFalso(T0);
  const linhas = [];
  await SS.iniciar({ relogio: rel, logger: (l) => linhas.push(l), anunciar: mensagens().anunciar });
  assert.equal((await B.banco.prepare('SELECT estado FROM server_save_ciclos WHERE slot = ?').get(T0 - DIA)).estado, 'interrompido');
  assert.ok(linhas.some((l) => l.includes('interrompidos')));
  assert.ok(rel.pendentes > 0);
  SS.parar();
  assert.equal(rel.pendentes, 0);
  const m = mensagens();
  await rel.avancar(2 * DIA);
  assert.equal(m.lista.length, 0);
});

// ------------------------------------------------------------------ o offline farm

test('F1. a rotina NÃO escreve no estado de quem caça offline: o JSON fica byte a byte igual (hunt, offlineDesde, xp, tudo)', async () => {
  const quem = [await ausente({ saida: Date.now() - 3 * HORA }), await ausente({ saida: Date.now() - 20 * MIN }), await ausente({ saida: Date.now() - 11 * HORA })];
  const antes = await Promise.all(quem.map((q) => linha(q.id)));
  const rel = relogioFalso(T0);
  await SS.iniciar({ relogio: rel, logger: quieto, anunciar: mensagens().anunciar });
  const r = await SS.executarAgora();
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.offline.ausentes >= 3);
  const depois = await Promise.all(quem.map((q) => linha(q.id)));
  for (let i = 0; i < quem.length; i++) {
    assert.equal(depois[i].estado, antes[i].estado, 'o estado do ausente não pode mudar');
    assert.equal(JSON.parse(depois[i].estado).hunt.offlineDesde, JSON.parse(antes[i].estado).hunt.offlineDesde);
    assert.equal(Number(depois[i].desde), Number(antes[i].desde));
    assert.equal(Number(depois[i].ate), Number(antes[i].ate));
  }
});

test('F2. o tempo e o limite de 12 h valem exatamente: a coluna "até" é saída + 12 h (ou o fim da stamina), antes e depois do save', async () => {
  const saida = Date.now() - 5 * HORA;
  const q = await ausente({ saida });
  const antes = await linha(q.id);
  assert.equal(Number(antes.ate), Math.min(saida + 12 * HORA, saida + 1e9)); // stamina cheia: o teto de 12 h manda
  await SS.iniciar({ relogio: relogioFalso(T0), logger: quieto, anunciar: mensagens().anunciar });
  await SS.executarAgora();
  assert.equal(Number((await linha(q.id)).ate), saida + 12 * HORA);
});

test('F3. coluna-índice divergente do JSON é consertada (é derivada dele) sem tocar no estado; ela voltava a esconder o ausente da consolidação', async () => {
  const q = await ausente({ saida: Date.now() - 3 * HORA });
  const antes = await linha(q.id);
  await B.banco.prepare('UPDATE personagens SET caca_offline_desde = NULL, caca_offline_ate = NULL WHERE id = ?').run(q.id);
  await SS.iniciar({ relogio: relogioFalso(T0), logger: quieto, anunciar: mensagens().anunciar });
  const r = await SS.executarAgora();
  assert.ok(r.offline.colunasCorrigidas >= 1);
  const depois = await linha(q.id);
  assert.equal(depois.estado, antes.estado);
  assert.equal(Number(depois.desde), Number(antes.desde));
  assert.equal(Number(depois.ate), Number(antes.ate));
});

test('F4. anomalias (offlineDesde no futuro, JSON ilegível) são RELATADAS e nunca alteradas', async () => {
  const futuro = await ausente({ saida: Date.now() + 3 * HORA });
  const antes = await linha(futuro.id);
  const ruim = await ausente({ saida: Date.now() - HORA });
  await B.banco.prepare('UPDATE personagens SET estado = ? WHERE id = ?').run('{nao-e-json', ruim.id);
  await SS.iniciar({ relogio: relogioFalso(T0), logger: quieto, anunciar: mensagens().anunciar });
  const r = await SS.executarAgora();
  assert.ok(r.offline.anomalias.some((a) => a.id === futuro.id && a.tipo === 'offlineDesde-no-futuro'));
  assert.ok(r.offline.anomalias.some((a) => a.id === ruim.id && a.tipo === 'json-ilegivel'));
  assert.equal((await linha(futuro.id)).estado, antes.estado);
  assert.equal((await linha(ruim.id)).estado, '{nao-e-json');
});

test('F5. recompensas pendentes (créditos) não são perdidas nem duplicadas pelo save', async () => {
  const nome = `Cred${randomUUID().slice(0, 6)}`;
  await B.banco.prepare("INSERT INTO creditos (personagem, gold, coins, itens) VALUES (?, 500, 3, '[]')").run(nome);
  limpar.push(() => B.banco.prepare('DELETE FROM creditos WHERE personagem = ?').run(nome));
  const antes = await B.banco.prepare('SELECT COUNT(*) AS n FROM creditos').get();
  await SS.iniciar({ relogio: relogioFalso(T0), logger: quieto, anunciar: mensagens().anunciar });
  const r = await SS.executarAgora();
  const depois = await B.banco.prepare('SELECT COUNT(*) AS n FROM creditos').get();
  assert.equal(Number(depois.n), Number(antes.n));
  assert.equal(r.recompensasPendentes, Number(antes.n));
  assert.equal(Number((await B.banco.prepare('SELECT gold FROM creditos WHERE personagem = ?').get(nome)).gold), 500);
});

test('F6. a caçada offline segue correndo depois do save: a consolidação avança uma vez, e repetir o mesmo instante não processa de novo', { skip: aAdaptar("Consolidação offline na hunt do Draevor com personagem legado") }, async () => {
  const q = await ausente({ saida: Date.now() - 2 * HORA });
  await SS.iniciar({ relogio: relogioFalso(T0), logger: quieto, anunciar: mensagens().anunciar });
  await SS.executarAgora();
  const agora = Date.now();
  assert.equal(await Consolidacao.consolidarUm(await linha(q.id), agora), 'gravado');
  const apos = JSON.parse((await linha(q.id)).estado);
  assert.ok(apos.xp > q.xpAntes, 'a caçada rendeu depois do save');
  assert.ok(apos.hunt.offlineDesde > agora - 2 * HORA, 'o ponto de referência avançou, não zerou');
  // O MESMO período não conta duas vezes.
  const xp1 = apos.xp;
  assert.equal(await Consolidacao.consolidarUm(await linha(q.id), agora), 'nada');
  assert.equal(JSON.parse((await linha(q.id)).estado).xp, xp1);
});

test('F7. o retorno do jogador DURANTE o save não conflita: a consolidação concorrente grava, o save não, e o XP não duplica', { skip: aAdaptar("Consolidação offline na hunt do Draevor com personagem legado") }, async () => {
  const q = await ausente({ saida: Date.now() - 2 * HORA });
  await SS.iniciar({ relogio: relogioFalso(T0), logger: quieto, anunciar: mensagens().anunciar });
  const [save, cons] = await Promise.all([SS.executarAgora(), Consolidacao.consolidarUm(await linha(q.id), Date.now())]);
  assert.equal(save.ok, true);
  assert.equal(cons, 'gravado');
  const e = JSON.parse((await linha(q.id)).estado);
  assert.ok(e.xp > q.xpAntes);
  const depois = await SS.executarAgora();
  assert.equal(depois.ok, true);
  assert.equal(JSON.parse((await linha(q.id)).estado).xp, e.xp, 'um segundo save não mexe no XP');
});

test('F8. o Server Save não cancela a caçada de quem está conectado: grava com `gravarAgora` (o mesmo autosave) e não toca no estado vivo', async () => {
  const vivo = sessaoFalsa();
  vivo.estado = { hunt: { huntId: HUNT_DE_TESTE }, xp: 123 };
  const copia = JSON.stringify(vivo.estado);
  SS.ligar(new Map([['v', vivo]]));
  await SS.iniciar({ relogio: relogioFalso(T0), logger: quieto, anunciar: mensagens().anunciar });
  const r = await SS.executarAgora();
  assert.equal(r.gravados, 1);
  assert.equal(vivo.gravacoes, 1);
  assert.equal(JSON.stringify(vivo.estado), copia);
});

// ------------------------------------------------------------------ falhas

test('R1. falha ao gravar um jogador: a mensagem de falha sai, o "concluído" NÃO, o ciclo fica "falhou" e a agenda segue', async () => {
  SS.ligar(new Map([['a', sessaoFalsa({ falha: true }), ], ['b', sessaoFalsa()]]));
  const rel = relogioFalso(T0);
  const m = mensagens();
  await SS.iniciar({ relogio: rel, logger: quieto, anunciar: m.anunciar });
  await rel.avancar(SLOT1 - T0 + MIN);
  assert.ok(m.lista.includes(MENSAGENS.falha));
  assert.ok(!m.lista.includes(MENSAGENS.concluido));
  assert.equal((await ciclos())[0].estado, 'falhou');
  assert.equal(SS.situacao().slot, SLOT1 + DIA, 'o relógio segue para o próximo dia');
  assert.equal(SS.situacao().rodando, false);
});

test('R2. falha de conexão com o banco no meio: não lança, avisa a falha, o jogo (laço) segue, e o próximo ciclo acontece', async () => {
  const rel = relogioFalso(T0);
  const m = mensagens();
  await SS.iniciar({ relogio: rel, logger: quieto, anunciar: m.anunciar });
  const original = B.banco.prepare;
  B.banco.prepare = (sql) => { if (String(sql).includes('server_save_ciclos')) throw new Error('ECONNREFUSED (simulado)'); return original.call(B.banco, sql); };
  let r;
  try {
    r = await SS.executarAgora();
  } finally {
    B.banco.prepare = original;
  }
  assert.equal(r.ok, false);
  assert.match(r.erro, /ECONNREFUSED/);
  assert.equal(m.lista.at(-1), MENSAGENS.falha);
  assert.equal((await SS.executarAgora()).ok, true, 'com o banco de volta, a próxima rotina funciona');
});

test('R3. o mesmo ciclo nunca roda duas vezes (mesmo slot repetido é recusado), nem no banco', async () => {
  await SS.iniciar({ relogio: relogioFalso(T0), logger: quieto, anunciar: mensagens().anunciar });
  assert.equal((await SS.executar({ slot: SLOT1 })).ok, true);
  const de_novo = await SS.executar({ slot: SLOT1 });
  assert.equal(de_novo.ok, false);
  assert.match(de_novo.erro, /já foi executado/);
});

test('R4. reinicialização logo depois do save: o estado dos ausentes continua idêntico e o ciclo concluído é lembrado', async () => {
  const q = await ausente({ saida: Date.now() - 4 * HORA });
  const antes = await linha(q.id);
  const rel = relogioFalso(T0);
  await SS.iniciar({ relogio: rel, logger: quieto, anunciar: mensagens().anunciar });
  await rel.avancar(SLOT1 - T0 + MIN);
  SS.parar();
  const rel2 = relogioFalso(SLOT1 + 5 * MIN);
  const m = mensagens();
  await SS.iniciar({ relogio: rel2, logger: quieto, anunciar: m.anunciar });
  await rel2.avancar(2 * HORA);
  assert.equal(m.lista.length, 0, 'nada roda de novo: o próximo ciclo é amanhã');
  assert.equal((await linha(q.id)).estado, antes.estado);
});

// ------------------------------------------------------------------ manutenção

test('M1. o modo de manutenção nasce desligado, bloqueia só quando ligado, e o save diário nunca o liga', async () => {
  assert.equal(Manutencao.bloqueada(), false);
  const rel = relogioFalso(T0);
  await SS.iniciar({ relogio: rel, logger: quieto, anunciar: mensagens().anunciar });
  await rel.avancar(2 * DIA);
  assert.equal(Manutencao.bloqueada(), false);
  Manutencao.definir(true);
  assert.equal(Manutencao.bloqueada(), true);
  assert.match(Manutencao.mensagemDeBloqueio(), /offline continua correndo/);
});

test('M2. drenar grava e solta cada sessão (a caçada fica correndo offline), e só roda com a manutenção ligada', async () => {
  const mapa = new Map([['a', sessaoFalsa()], ['b', sessaoFalsa()]]);
  const soltas = [];
  for (const [k, s] of mapa) s.soltarPersonagem = async () => soltas.push(k);
  await assert.rejects(() => Manutencao.drenar(mapa), /não está ligada/);
  Manutencao.definir(true);
  assert.deepEqual(await Manutencao.drenar(mapa), { gravadas: 2, erros: 0 });
  assert.deepEqual(soltas, ['a', 'b']);
  assert.equal(mapa.get('a').gravacoes, 1);
});

// ------------------------------------------------------------------ desempenho

test('P1. muitos ausentes (1500), muitos conectados (400) e escritas simultâneas: o laço não trava e nada é alterado', async () => {
  const c = await B.criarConta({ email: `ss-perf-${randomUUID()}@teste.local`, senha: 'senha-123' });
  const base = personagemDeTeste({ vocacao: 'knight', level: 100 });
  Cacadas.entrar(base, { huntId: HUNT_DE_TESTE, mode: 'auto', strategy: 'nearest' });
  const ids = [];
  const saida = Date.now() - 3 * HORA;
  for (let i = 0; i < 600; i++) {
    base.hunt.offlineDesde = saida - i * 1000;
    const p = await B.criarPersonagem({ conta: c.id, nome: `Pf${i}${randomUUID().replace(/[^a-z]/g, '').slice(0, 7)}`, vocacao: 'knight', sexo: 'male', estadoInicial: { ...base, hunt: Cacadas.huntParaGravar(base.hunt) } });
    ids.push(p.id);
  }
  limpar.push(async () => { for (const id of ids) await B.excluirPersonagem(id); });
  const antes = new Map((await B.banco.prepare('SELECT id, estado FROM personagens WHERE id >= ? AND id <= ?').all(Math.min(...ids), Math.max(...ids))).map((l) => [l.id, l.estado]));
  const mapa = new Map(Array.from({ length: 200 }, (_, i) => [`j${i}`, { ...sessaoFalsa(), gravarAgora: async () => { await new Promise((r) => setTimeout(r, 1)); } }]));
  SS.ligar(mapa);
  await SS.iniciar({ relogio: relogioFalso(T0), logger: quieto, anunciar: mensagens().anunciar });
  // Escritas simultâneas de outros sistemas durante a rotina.
  const barulho = (async () => { for (let i = 0; i < 200; i++) await B.banco.prepare('SELECT COUNT(*) AS n FROM personagens').get(); })();
  const t0 = performance.now();
  const r = await SS.executarAgora();
  await barulho;
  const ms = performance.now() - t0;
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.offline.ausentes >= 600);
  assert.equal(r.gravados, 200);
  console.log(`      [P1] ${ms.toFixed(0)}ms no total, laço parou no máximo ${r.atrasoMaximoDoLacoMs}ms, ${r.offline.ausentes} ausentes verificados`);
  assert.ok(r.atrasoMaximoDoLacoMs < 250, `o laço parou ${r.atrasoMaximoDoLacoMs}ms`);
  const depois = new Map((await B.banco.prepare('SELECT id, estado FROM personagens WHERE id >= ? AND id <= ?').all(Math.min(...ids), Math.max(...ids))).map((l) => [l.id, l.estado]));
  for (const id of ids) assert.equal(depois.get(id), antes.get(id));
});

test('P2. muitas recompensas pendentes (5000 créditos): a contagem é uma consulta só e nada é apagado', async () => {
  const nome = `CredPerf${randomUUID().slice(0, 6)}`;
  for (let i = 0; i < 5000; i++) await B.banco.prepare("INSERT INTO creditos (personagem, gold, coins, itens) VALUES (?, 1, 0, '[]')").run(nome);
  limpar.push(() => B.banco.prepare('DELETE FROM creditos WHERE personagem = ?').run(nome));
  const t0 = performance.now();
  const n = await SS.contarPendentes();
  assert.ok(n >= 5000);
  assert.ok(performance.now() - t0 < 500);
  assert.equal(Number((await B.banco.prepare('SELECT COUNT(*) AS n FROM creditos WHERE personagem = ?').get(nome)).n), 5000);
});
