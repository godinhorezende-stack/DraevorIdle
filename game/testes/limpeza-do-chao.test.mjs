// A limpeza automática do chão (`systems/limpeza-do-chao.mjs`): ciclo, aviso, remoção em lotes, o que NÃO pode sumir,
// duplicidade, erro e desligamento — com relógio simulado (nada espera uma hora de verdade).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as Limpeza from '../systems/limpeza-do-chao.mjs';
import { validarConfig, groundCleanupConfig, MENSAGEM_DO_AVISO } from '../systems/limpeza-do-chao-config.mjs';
import * as Inventario from '../systems/inventario.mjs';
import { personagemDeTeste } from './apoio.mjs';

/** Relógio simulado: `avancar(ms)` dispara os timers vencidos, em ordem, e espera os lotes assíncronos. */
function relogioFalso() {
  let agora = 0;
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
        const proximo = [...timers.entries()].filter(([, t]) => t.em <= fim).sort((a, b) => a[1].em - b[1].em)[0];
        if (!proximo) break;
        timers.delete(proximo[0]);
        agora = proximo[1].em;
        proximo[1].fn();
        for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); // deixa a limpeza (promessas) terminar
      }
      agora = fim;
    },
  };
}
const MIN = 60_000;
const sessaoFalsa = () => { const recebidas = []; return { personagem: {}, enviarPronto: (t) => recebidas.push(JSON.parse(t)), recebidas }; };
const zerarChao = () => Inventario.limparPilhasDoChao(Inventario.fotoDoChao());
const encher = (pilhas, porPilha = 1) => {
  const dono = personagemDeTeste();
  for (let i = 0; i < pilhas; i++) for (let k = 0; k < porPilha; k++) {
    dono.inventory = [{ id: 3031, count: 1 }]; // gold coin: sempre cabe
    assert.ok(Inventario.largar(dono, { id: 3031, count: 1, x: 5 + (i % 200), y: 5 + Math.floor(i / 200) }).ok);
  }
};
const quieto = () => {};

afterEach(() => { Limpeza.parar(); zerarChao(); Limpeza.ligar(new Map()); });

test('L1. inicia sozinho com o padrão: 60 min, aviso de 60 s, lote 500, e loga o início e a próxima limpeza', () => {
  const linhas = [];
  const rel = relogioFalso();
  assert.deepEqual({ ...groundCleanupConfig }, { enabled: true, intervalMinutes: 60, warningSeconds: 60, batchSize: 500 });
  Limpeza.iniciar({ relogio: rel, logger: (l) => linhas.push(l) });
  assert.equal(Limpeza.situacao().timerAtivo, true);
  assert.ok(linhas.some((l) => l.startsWith('[GROUND-CLEANUP] Sistema iniciado')));
  assert.ok(linhas.some((l) => l === '[GROUND-CLEANUP] Próxima limpeza em 60 minutos'));
});

test('L2. o aviso sai aos 59 min (1 minuto antes) e a limpeza aos 60 min — nem antes', async () => {
  const rel = relogioFalso();
  const s = sessaoFalsa();
  Limpeza.ligar(new Map([['a', s]]));
  encher(3);
  Limpeza.iniciar({ relogio: rel, logger: quieto });
  await rel.avancar(59 * MIN - 1);
  assert.equal(s.recebidas.length, 0, 'ainda não avisou');
  assert.equal(Inventario.contarPecasNoChao(), 3);
  await rel.avancar(1);
  assert.equal(s.recebidas.length, 1, 'avisou aos 59 min');
  assert.deepEqual({ t: s.recebidas[0].t, texto: s.recebidas[0].texto }, { t: 'avisoGlobal', texto: MENSAGEM_DO_AVISO });
  assert.equal(Inventario.contarPecasNoChao(), 3, 'o chão ainda está lá durante o minuto de aviso');
  await rel.avancar(MIN - 1);
  assert.equal(Inventario.contarPecasNoChao(), 3);
  await rel.avancar(1);
  assert.equal(Inventario.contarPecasNoChao(), 0, 'aos 60 min o chão foi limpo');
});

test('L3. a mensagem é exatamente a pedida e vai só para quem está jogando (sessão sem personagem não recebe)', () => {
  assert.equal(MENSAGEM_DO_AVISO, '[SISTEMA] A limpeza do mundo acontecerá em 1 minuto! Recolha os itens que estão no chão, pois todos serão removidos.');
  const a = sessaoFalsa();
  const sem = { personagem: null, enviarPronto: () => assert.fail('não pode receber') };
  Limpeza.ligar(new Map([['a', a], ['b', sem]]));
  assert.equal(Limpeza.avisoGlobal('oi'), 1);
});

test('L4. depois da limpeza começa outro ciclo de 60 min (avisos e limpezas se repetem, sem duplicar)', async () => {
  const rel = relogioFalso();
  const s = sessaoFalsa();
  Limpeza.ligar(new Map([['a', s]]));
  Limpeza.iniciar({ relogio: rel, logger: quieto });
  await rel.avancar(3 * 60 * MIN);
  assert.equal(s.recebidas.length, 3, 'um aviso por ciclo');
  assert.equal(Limpeza.situacao().execucoes.length, 3, 'uma limpeza por ciclo');
  assert.equal(rel.pendentes, 1, 'só um timer vivo');
});

test('L5. remove TODO item do chão, em várias casas, e loga encontrados/removidos/tempo', async () => {
  const linhas = [];
  const rel = relogioFalso();
  encher(40, 3); // 120 peças em 40 casas
  assert.equal(Inventario.contarPecasNoChao(), 120);
  Limpeza.iniciar({ relogio: rel, logger: (l) => linhas.push(l) });
  await rel.avancar(60 * MIN);
  assert.equal(Inventario.contarPecasNoChao(), 0);
  assert.equal(Inventario.chaoParaCliente().length, 0, 'o snapshot que vai para os clientes já sai vazio');
  for (const quer of ['Aviso global enviado', 'Limpeza iniciada', '120 itens encontrados, 120 itens removidos', 'Limpeza concluída em']) {
    assert.ok(linhas.some((l) => l.includes(quer)), `faltou o log: ${quer}\n${linhas.join('\n')}`);
  }
  assert.equal(Limpeza.situacao().execucoes[0].removidos, 120);
});

test('L6. preserva inventário, equipamento, bolsa, depósito e banco: só o chão some', async () => {
  const rel = relogioFalso();
  const e = personagemDeTeste();
  e.inventory = [{ id: 3031, count: 7 }];
  e.pouch = [{ id: 3031, count: 2 }];
  e.deposito = [{ indice: 0, itens: [{ id: 3031, count: 9 }] }];
  e.bauDaConta = { indice: 99, itens: [{ id: 3031, count: 5 }] };
  e.equipment = { ...(e.equipment ?? {}), ring: { id: 3031, count: 1 } };
  e.banco = { saldo: 12345 };
  const antes = JSON.stringify([e.inventory, e.pouch, e.deposito, e.bauDaConta, e.equipment, e.banco]);
  encher(10);
  Limpeza.iniciar({ relogio: rel, logger: quieto });
  await rel.avancar(60 * MIN);
  assert.equal(Inventario.contarPecasNoChao(), 0);
  assert.equal(JSON.stringify([e.inventory, e.pouch, e.deposito, e.bauDaConta, e.equipment, e.banco]), antes);
});

test('L7. a limpeza em lotes confere cada pilha: quem pegou o item no meio não perde nada, e o que foi pego não é contado como removido', async () => {
  encher(10);
  const foto = Inventario.fotoDoChao();
  // Entre a foto e a limpeza, alguém pega a pilha da casa 5,5 e outro largou uma nova no lugar.
  const [chave, pilha] = foto[0];
  const [x, y] = chave.split(',').map(Number);
  const jogador = personagemDeTeste();
  jogador.pos = { x, y, z: 7 };
  assert.ok(Inventario.pegar(jogador, { x, y }).ok);
  jogador.inventory = [{ id: 3031, count: 1 }];
  Inventario.largar(jogador, { id: 3031, count: 1, x, y });
  const r = Inventario.limparPilhasDoChao(foto);
  assert.equal(r.pecas, 9, 'a pilha trocada não é a da foto: fica para o próximo ciclo');
  assert.equal(Inventario.contarPecasNoChao(), 1);
  assert.notEqual(pilha, undefined);
});

test('L8. muitos itens: lotes de batchSize, cedendo o laço entre eles, e rápido', async () => {
  encher(5000);
  let cedidas = 0;
  const t0 = performance.now();
  const r = await Limpeza.varrer({ batchSize: 500, cederLaco: async () => { cedidas++; } });
  assert.equal(r.removidos, 5000);
  assert.equal(cedidas, 9, '10 lotes = 9 cedidas');
  assert.ok(performance.now() - t0 < 1000, `${performance.now() - t0}ms`);
  assert.equal(Inventario.contarPecasNoChao(), 0);
});

test('L9. iniciar duas vezes não cria dois timers nem dois ciclos', async () => {
  const rel = relogioFalso();
  const s = sessaoFalsa();
  Limpeza.ligar(new Map([['a', s]]));
  Limpeza.iniciar({ relogio: rel, logger: quieto });
  const outra = Limpeza.iniciar({ relogio: rel, logger: quieto });
  assert.equal(outra.jaIniciado, true);
  assert.equal(rel.pendentes, 1);
  await rel.avancar(60 * MIN);
  assert.equal(s.recebidas.length, 1);
  assert.equal(Limpeza.situacao().execucoes.length, 1);
});

test('L10. erro na limpeza é registrado, não derruba o servidor e o relógio segue para o próximo ciclo', async () => {
  const linhas = [];
  const rel = relogioFalso();
  Limpeza.iniciar({ relogio: { ...rel, cederLaco: () => Promise.reject(new Error('falha de teste')) }, logger: (l) => linhas.push(l) });
  encher(1200); // mais de um lote: o `cederLaco` quebra
  await rel.avancar(60 * MIN);
  assert.ok(linhas.some((l) => l.includes('ERRO') && l.includes('falha de teste')), linhas.join('\n'));
  assert.equal(Limpeza.situacao().limpando, false, 'a trava de "limpando" foi solta');
  assert.equal(rel.pendentes, 1, 'o próximo ciclo foi agendado');
});

test('L11. parar() cancela os timers (nenhum aviso/limpeza depois) e dá para religar', async () => {
  const rel = relogioFalso();
  const s = sessaoFalsa();
  Limpeza.ligar(new Map([['a', s]]));
  encher(2);
  Limpeza.iniciar({ relogio: rel, logger: quieto });
  Limpeza.parar();
  assert.equal(rel.pendentes, 0);
  assert.equal(Limpeza.situacao(), null);
  await rel.avancar(5 * 60 * MIN);
  assert.equal(s.recebidas.length, 0);
  assert.equal(Inventario.contarPecasNoChao(), 2);
  Limpeza.iniciar({ relogio: rel, logger: quieto });
  await rel.avancar(60 * MIN);
  assert.equal(s.recebidas.length, 1);
  assert.equal(Inventario.contarPecasNoChao(), 0);
});

test('L12. parar() no meio do aviso não deixa a limpeza rodar', async () => {
  const rel = relogioFalso();
  encher(2);
  Limpeza.iniciar({ relogio: rel, logger: quieto });
  await rel.avancar(59 * MIN + 30_000);
  Limpeza.parar();
  await rel.avancar(10 * MIN);
  assert.equal(Inventario.contarPecasNoChao(), 2);
});

test('L13. configuração: valores novos valem; inválidos voltam ao padrão com erro; enabled:false não liga nada', async () => {
  const ok = validarConfig({ intervalMinutes: 30, warningSeconds: 10, batchSize: 50 }, {});
  assert.deepEqual(ok.config, { enabled: true, intervalMinutes: 30, warningSeconds: 10, batchSize: 50 });
  assert.equal(ok.erros.length, 0);
  const ruim = validarConfig({ intervalMinutes: -5, warningSeconds: 'abc', batchSize: 0 }, {});
  assert.deepEqual(ruim.config, { ...groundCleanupConfig });
  assert.equal(ruim.erros.length, 3);
  const naoCabe = validarConfig({ intervalMinutes: 1, warningSeconds: 120 }, {});
  assert.equal(naoCabe.config.intervalMinutes, 60);
  const env = validarConfig({}, { GROUND_CLEANUP_INTERVAL_MINUTES: '15', GROUND_CLEANUP_ENABLED: 'false' });
  assert.equal(env.config.intervalMinutes, 15);
  assert.equal(env.config.enabled, false);
  const rel = relogioFalso();
  const r = Limpeza.iniciar({ config: { enabled: false }, relogio: rel, logger: quieto });
  assert.equal(r.desativado, true);
  assert.equal(rel.pendentes, 0);
});

test('L14. o intervalo e o aviso configurados mandam no relógio (10 min, aviso de 30 s)', async () => {
  const rel = relogioFalso();
  const s = sessaoFalsa();
  Limpeza.ligar(new Map([['a', s]]));
  encher(1);
  Limpeza.iniciar({ config: { intervalMinutes: 10, warningSeconds: 30 }, relogio: rel, logger: quieto });
  await rel.avancar(10 * MIN - 30_000);
  assert.equal(s.recebidas.length, 1);
  assert.equal(Inventario.contarPecasNoChao(), 1);
  await rel.avancar(30_000);
  assert.equal(Inventario.contarPecasNoChao(), 0);
});

test('L15. a limpeza some com o item do chão do que o cliente vê: o snapshot da praça fica sem `chao`', async () => {
  encher(4);
  assert.equal(Inventario.chaoParaCliente().length, 4);
  await Limpeza.varrer({});
  assert.deepEqual(Inventario.chaoParaCliente(), []);
});

test('L16. uma fonte de chão extra (outra região) entra na mesma varredura, e todas são limpas', async () => {
  const extra = [['k1', [{ id: 1 }, { id: 2 }]], ['k2', [{ id: 3 }]]];
  const fonte = { nome: 'aventura', foto: () => extra, limpar: (lote) => ({ pecas: lote.reduce((s, [, p]) => s + p.length, 0) }) };
  encher(3);
  const praca = { nome: 'praça', foto: () => Inventario.fotoDoChao(), limpar: (l) => Inventario.limparPilhasDoChao(l) };
  const r = await Limpeza.varrer({ fontes: [praca, fonte], batchSize: 1 });
  assert.equal(r.encontrados, 6);
  assert.equal(r.removidos, 6);
});
