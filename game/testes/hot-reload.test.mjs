import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as H from '../systems/hot-reload.mjs';
import { criarAcesso, classeDaRota } from '../admin/acesso.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import { transmitir, ligar } from '../systems/avisos-globais.mjs';

const pasta = mkdtempSync(join(tmpdir(), 'hot-'));
after(() => rmSync(pasta, { recursive: true, force: true }));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const quieto = () => {};

test('HR1. classificar: o que recarrega a quente, o que exige reinício (com o motivo) e o que é ignorado (temporários, backups, versões, estado de operação)', () => {
  assert.deepEqual(H.classificar('overrides/monstros.json'), { tipo: 'monstros', quente: true });
  assert.deepEqual(H.classificar('overrides\\itens.json'), { tipo: 'itens', quente: true }, 'separador do Windows');
  assert.deepEqual(H.classificar('overrides/sprites.json'), { tipo: 'sprites', quente: true });
  assert.deepEqual(H.classificar('overrides/sprites/368.png'), { tipo: 'sprites', quente: true, id: '368' });
  assert.deepEqual(H.classificar('sprites/outfits/128.png'), { tipo: 'sprites', quente: true, id: '128', original: true });
  assert.deepEqual(H.classificar('outfits.json'), { tipo: 'sprites', quente: true, indice: true });
  assert.deepEqual(H.classificar('atos/ato-cinco.json'), { tipo: 'atos', quente: true, id: 'ato-cinco' });
  assert.deepEqual(H.classificar('campanha.json'), { tipo: 'campanha', quente: true });
  for (const [c, tipo] of [['hunts/troll-cave.json', 'hunts'], ['encontros/x.json', 'encontros'], ['bosses-unicos.json', 'encontros'], ['skills/a.json', 'habilidades'], ['gemas.json', 'habilidades'], ['action-catalog.json', 'habilidades'], ['item-catalog.json', 'catalogo-de-itens'], ['catalog-real.json', 'catalogo-original'], ['sprites/items/x.png', 'atlas'], ['item-sprites.json', 'atlas'], ['whatever.json', 'outros']]) {
    const r = H.classificar(c);
    assert.equal(r.quente, false, c);
    assert.equal(r.tipo, tipo, c);
    assert.ok(r.motivo.length > 20 && r.rotulo, `${c}: tem rótulo e motivo`);
  }
  for (const c of ['overrides/_versoes/monstros/1.json', 'overrides/monstros.json~', '.monstros.json.swp', 'overrides/itens.json.tmp', 'atos/x.json.bak', 'node_modules/x/y.json', 'engine.json', 'modo-beta.json', 'novidades.json', 'sprites/hunts/mapa.png', 'database/dados/engine-auditoria.jsonl', 'LEIAME.md', '', 'overrides/outro.json', '.#lock', '4913']) assert.equal(H.classificar(c), null, `ignorar: ${c}`);
});

test('HR2. isolamento: nunca em produção, com HOT_RELOAD=0, ENGINE_MODO=producao ou banco compartilhado/remoto; liga no desenvolvimento e com banco local', () => {
  assert.equal(H.podeAtivar({ producao: true }).ativo, false);
  assert.match(H.podeAtivar({ producao: true }).motivo, /produção/);
  assert.equal(H.podeAtivar({ env: { HOT_RELOAD: '0' } }).ativo, false);
  assert.equal(H.podeAtivar({ env: { ENGINE_MODO: 'producao' } }).ativo, false);
  assert.match(H.podeAtivar({ env: { DATABASE_URL: 'postgres://u:s@10.0.0.5:5432/jogo' } }).motivo, /compartilhado\/remoto/);
  assert.match(H.podeAtivar({ env: { DATABASE_URL: 'postgres://u:s@db.exemplo.com/jogo' } }).motivo, /db\.exemplo\.com/);
  assert.equal(H.podeAtivar({ env: {} }).ativo, true);
  assert.equal(H.podeAtivar({ env: { DATABASE_URL: 'postgres://u:s@localhost:5432/jogo' } }).ativo, true);
  assert.equal(H.podeAtivar({ env: { DATABASE_URL: 'postgres://u:s@127.0.0.1/jogo' } }).ativo, true);
  // desligado = inerte: nada é classificado, agendado nem notificado
  const avisos = [];
  const hr = H.criarHotReload({ estrategias: { monstros: { aplicar: () => avisos.push('rodou') } }, ativo: false, motivoInativo: 'produção', log: quieto });
  assert.equal(hr.mudou('overrides/monstros.json'), null);
  assert.deepEqual(hr.aposGravacao('overrides', {}), []);
  assert.equal(hr.estadoAtual().estado, 'desativado');
  assert.match(hr.estadoAtual().mensagem, /desligado: produção/);
  assert.equal(avisos.length, 0);
});

test('HR3. caminhosDaRota: o evento explícito de salvamento da Engine aponta os arquivos certos', () => {
  assert.deepEqual(H.caminhosDaRota('overrides'), ['overrides/monstros.json']);
  assert.deepEqual(H.caminhosDaRota('/api/mapas/_conteudo/overrides/itens'), ['overrides/itens.json']);
  assert.deepEqual(H.caminhosDaRota('overrides/sprites', { look: '368' }), ['overrides/sprites.json', 'overrides/sprites/368.png']);
  assert.deepEqual(H.caminhosDaRota('overrides/sprites', { look: '../x' }), ['overrides/sprites.json']);
  assert.deepEqual(H.caminhosDaRota('campanha/validar'), ['campanha.json']);
  assert.deepEqual(H.caminhosDaRota('atos-editor/ato-cinco/restaurar'), ['atos/ato-cinco.json']);
  assert.deepEqual(H.caminhosDaRota('atos-editor', { id: 'ato-cinco' }), ['atos/ato-cinco.json']);
  assert.deepEqual(H.caminhosDaRota('atos-editor', { id: '../../etc' }), []);
  assert.deepEqual(H.caminhosDaRota('fase/troll-cave/encontros'), ['encontros.json']);
  assert.deepEqual(H.caminhosDaRota('bosses'), ['bosses-unicos.json']);
  assert.deepEqual(H.caminhosDaRota('operacao/beta'), []);
});

function montar(extra = {}) {
  const chamadas = [];
  const avisos = [];
  let conteudo = 'v1';
  const estrategias = {
    monstros: {
      assinatura: () => conteudo,
      aplicar: async (info) => { chamadas.push(['monstros', info.caminhos, info.ids, info.forcar]); if (conteudo === 'ruim') throw new Error('hp inválido'); return { ids: ['troll'], resumo: '1 monstro', payload: { monstros: { troll: { hp: 1 } } } }; },
    },
    itens: { assinatura: () => 'i', aplicar: async () => { chamadas.push(['itens']); return { ids: ['3268'], resumo: '1 item' }; } },
    sprites: { aplicar: async () => ({ reinicio: 'a estrutura mudou' }) },
    ...extra,
  };
  const hr = H.criarHotReload({ estrategias, notificar: (m) => { avisos.push(m); return 3; }, debounceMs: 20, tentativaMs: 5, log: quieto });
  return { hr, chamadas, avisos, mudarConteudo: (c) => { conteudo = c; } };
}

test('HR4. debounce: vários salvamentos seguidos viram UMA recarga; explícito + arquivo do mesmo salvamento não recarrega duas vezes (assinatura); sem mudança real = "sem-mudanca"', async () => {
  const { hr, chamadas, avisos, mudarConteudo } = montar();
  hr.mudou('overrides/monstros.json', 'engine'); hr.mudou('overrides/monstros.json', 'arquivo'); hr.mudou('overrides\\monstros.json', 'arquivo');
  assert.equal(hr.estadoAtual().estado, 'pendente');
  assert.match(hr.estadoAtual().mensagem, /aguardando recarga/);
  await espera(120);
  await hr.processar();
  assert.equal(chamadas.length, 1, 'uma recarga só');
  assert.equal(avisos.length, 1);
  assert.deepEqual([avisos[0].t, avisos[0].tipo, avisos[0].ids, avisos[0].revisao], ['contentUpdate', 'monstros', ['troll'], 1]);
  assert.deepEqual(avisos[0].monstros, { troll: { hp: 1 } });
  assert.equal(hr.estadoAtual().estado, 'atualizado');
  assert.match(hr.estadoAtual().historico[0].mensagem, /3 cliente\(s\) avisado\(s\)/);
  // o mesmo conteúdo outra vez (o fs.watch do mesmo salvamento): não recarrega
  hr.mudou('overrides/monstros.json', 'arquivo');
  await espera(80); await hr.processar();
  assert.equal(chamadas.length, 1);
  assert.equal(hr.estadoAtual().historico[0].resultado, 'sem-mudanca');
  assert.equal(avisos.length, 1, 'e ninguém é avisado à toa');
  // conteúdo novo: recarrega de novo e a revisão sobe
  mudarConteudo('v2');
  hr.mudou('overrides/monstros.json', 'engine');
  await espera(80); await hr.processar();
  assert.equal(chamadas.length, 2);
  assert.equal(avisos[1].revisao, 2);
});

test('HR5. erro: a recarga falha → fica a última versão válida (nada notificado), o erro vai para o histórico e para o estado; salvar de novo corrigido recarrega e limpa o erro', async () => {
  const { hr, chamadas, avisos, mudarConteudo } = montar();
  mudarConteudo('ruim');
  hr.mudou('overrides/monstros.json', 'engine');
  await espera(150); await hr.processar();
  const e = hr.estadoAtual();
  assert.equal(e.estado, 'erro');
  assert.match(e.mensagem, /Monstros: hp inválido/);
  assert.equal(avisos.length, 0, 'ninguém é avisado de uma recarga que falhou');
  assert.equal(e.erros[0].tipo, 'monstros');
  assert.equal(e.historico[0].resultado, 'erro');
  assert.match(e.historico[0].mensagem, /última versão válida/);
  assert.equal(chamadas.length, 2, 'tentou duas vezes (um salvamento pela metade se resolve sozinho)');
  mudarConteudo('v3');
  hr.mudou('overrides/monstros.json', 'engine');
  await espera(100); await hr.processar();
  assert.equal(hr.estadoAtual().erros.length, 0);
  assert.equal(avisos.length, 1);
  assert.equal(hr.estadoAtual().estado, 'atualizado');
});

test('HR6. exige reinício: tipos sem estratégia quente e estratégia que devolve { reinicio } viram aviso claro, sem recarregar nada e sem notificar', async () => {
  const { hr, avisos } = montar();
  hr.mudou('hunts/troll-cave.json', 'arquivo');
  hr.mudou('skills/magia.json', 'engine');
  let e = hr.estadoAtual();
  assert.equal(e.estado, 'reinicio');
  assert.deepEqual(e.reinicio.map((r) => r.tipo).sort(), ['habilidades', 'hunts']);
  assert.ok(e.reinicio[0].motivo.length > 20);
  assert.equal(hr.estadoAtual().historico.filter((h) => h.resultado === 'reinicio').length, 2);
  hr.mudou('hunts/outra.json', 'arquivo');
  assert.equal(hr.estadoAtual().historico.filter((h) => h.resultado === 'reinicio').length, 2, 'o mesmo sistema não repete o aviso');
  hr.mudou('overrides/sprites.json', 'engine');
  await espera(80); await hr.processar();
  e = hr.estadoAtual();
  assert.ok(e.reinicio.some((r) => r.tipo === 'sprites' && /estrutura mudou/.test(r.motivo)));
  assert.equal(avisos.length, 0);
});

test('HR7. a fila é serial e na ordem (itens antes de monstros); recarga manual ignora a assinatura; desconhecido é recusado', async () => {
  const ordem = [];
  const { hr, avisos } = montar({
    itens: { assinatura: () => 'i', aplicar: async () => { ordem.push('itens-ini'); await espera(30); ordem.push('itens-fim'); return { ids: ['1'], resumo: 'x' }; } },
    monstros: { assinatura: () => 'm', aplicar: async () => { ordem.push('monstros'); return { ids: ['troll'], resumo: 'y' }; } },
  });
  hr.mudou('overrides/monstros.json'); hr.mudou('overrides/itens.json');
  await espera(100); await hr.processar();
  assert.deepEqual(ordem, ['itens-ini', 'itens-fim', 'monstros'], 'itens primeiro, e sem sobreposição');
  hr.mudou('overrides/monstros.json');
  await espera(60); await hr.processar();
  assert.equal(ordem.length, 3, 'mesma assinatura: não rodou');
  const r = await hr.recarregar('monstros');
  assert.equal(r.ok, true);
  assert.equal(ordem.length, 4, 'manual força');
  assert.equal(avisos.at(-1).tipo, 'monstros');
  const ruim = await hr.recarregar('hunts');
  assert.equal(ruim.ok, false);
  assert.match(ruim.erro, /Recurso desconhecido/);
});

test('HR8. monitoramento de arquivos de verdade (fs.watch): salvar um override é detectado; temporários e _versoes são ignorados; vigiar não segura o processo', async () => {
  const raiz = join(pasta, 'gamedata');
  mkdirSync(join(raiz, 'overrides', '_versoes'), { recursive: true });
  const { hr, chamadas } = montar();
  const desligar = hr.vigiar(raiz, [{ dir: 'overrides', recursivo: true }]);
  await espera(50);
  writeFileSync(join(raiz, 'overrides', 'monstros.json~'), 'x');
  writeFileSync(join(raiz, 'overrides', 'monstros.json.tmp'), 'x');
  writeFileSync(join(raiz, 'overrides', '_versoes', '1.json'), 'x');
  await espera(150);
  assert.equal(hr.estadoAtual().pendentes.length, 0, 'nada disso entra');
  writeFileSync(join(raiz, 'overrides', 'monstros.json'), '{"ativo":true}');
  for (let i = 0; i < 40 && !chamadas.length; i++) await espera(50);
  await hr.processar();
  assert.equal(chamadas.length, 1, 'o salvamento foi detectado e recarregado');
  assert.ok(chamadas[0][1].includes('overrides/monstros.json'));
  desligar();
});

test('HR9. notificar os clientes: transmitir leva a mensagem a todas as sessões conectadas (um JSON só) e conta quantas', () => {
  const recebidos = [];
  const sessao = (nome, ws) => ({ ws, personagem: nome, enviarPronto: (t) => recebidos.push([nome, JSON.parse(t)]) });
  ligar(new Map([['a', sessao('a', {})], ['b', sessao('b', {})], ['sem-ws', { enviarPronto: () => recebidos.push(['x']) }]]));
  const n = transmitir({ t: 'contentUpdate', tipo: 'monstros', ids: ['troll'], revisao: 7 });
  assert.equal(n, 2);
  assert.deepEqual(recebidos.map(([nome]) => nome), ['a', 'b']);
  assert.deepEqual(recebidos[0][1], { t: 'contentUpdate', tipo: 'monstros', ids: ['troll'], revisao: 7 });
});

test('HR10. rotas da Engine: estado (leitura), recarregar à mão (grava: bloqueado em produção) e "desligado" quando o Hot Reload não existe', async () => {
  const chama = async (metodo, rota, corpo) => { const r = []; await Http.atender({ method: metodo }, {}, `/api/mapas/_conteudo/${rota}`, new URL('http://x/'), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => corpo }); return r[0]; };
  Http.ligarHotReload(null);
  assert.equal((await chama('GET', 'hot-reload'))[1].ativo, false);
  assert.equal((await chama('POST', 'hot-reload/recarregar', { tipo: 'monstros' }))[0], 409);
  const { hr } = montar();
  Http.ligarHotReload(hr);
  const estado = (await chama('GET', 'hot-reload'))[1];
  assert.equal(estado.ativo, true);
  assert.deepEqual(estado.recarregaveis.map((r) => r.tipo).sort(), ['itens', 'monstros', 'sprites']);
  const r = await chama('POST', 'hot-reload/recarregar', { tipo: 'monstros' });
  assert.equal(r[0], 200);
  assert.equal(r[1].ok, true);
  assert.equal((await chama('POST', 'hot-reload/recarregar', { tipo: 'xyz' }))[1].ok, false);
  Http.ligarHotReload(null);
  assert.equal(classeDaRota('GET', '/api/mapas/_conteudo/hot-reload'), 'leitura');
  assert.equal(classeDaRota('POST', '/api/mapas/_conteudo/hot-reload/recarregar'), 'grava', 'em produção (gravação desligada) isto é recusado antes de chegar aqui');
  const prod = criarAcesso({ config: { producao: true, exigeLogin: true, grava: false, admins: ['a@x.com'] }, deps: {} });
  assert.equal(prod.config.grava, false);
});

test('HR11. a fiação do servidor: o Hot Reload nasce desligado em produção, o salvamento explícito da Engine o aciona, e os caminhos do monitoramento não incluem as pastas gigantes', () => {
  const idx = readFileSync(new URL('../backend/index.mjs', import.meta.url), 'utf8');
  assert.match(idx, /iniciarHotReload\(\{ producao: acessoDaEngine\.config\.producao \}\)/);
  assert.match(idx, /aoGravar: \(\{ rota, corpo \}\) => hotReload\.aposGravacao\(rota, corpo\)/);
  assert.match(idx, /ligarHotReloadDaEngine\(hotReload\)/);
  const guarda = readFileSync(new URL('../admin/acesso-http.mjs', import.meta.url), 'utf8');
  assert.match(guarda, /if \(ok && classe === 'grava'\) \{ try \{ aoGravar\?\./, 'só grava com sucesso e nunca derruba a resposta');
  const dirs = H.DIRETORIOS_VIGIADOS.map((d) => d.dir);
  assert.ok(!dirs.includes('sprites/hunts') && !dirs.includes('hunts-imagens'));
  assert.deepEqual(H.DIRETORIOS_VIGIADOS.filter((d) => d.recursivo).map((d) => d.dir), ['overrides'], 'só os overrides (pequenos) são vigiados em profundidade');
});

test('HR12. a Engine tem o indicador (barra do topo, só consulta, não aparece em produção) e o painel com histórico e recarga manual; o cliente do jogo trata contentUpdate', () => {
  const ler = (a) => readFileSync(new URL(`../frontend/${a}`, import.meta.url), 'utf8');
  assert.match(ler('editor-conteudo.html'), /<span id="eng-hot" class="eng-hot"><\/span>/);
  const conteudo = ler('client/src/editor-conteudo.mjs');
  assert.match(conteudo, /^criarIndicadorDeHotReload\(\{ base: BASE, alvo: document\.getElementById\('eng-hot'\) \}\);/m, 'como instrução do módulo (não dentro de um callback)');
  const ind = ler('client/src/editor-hot-reload.mjs');
  for (const estado of ['Ativo', 'Recarregando', 'Atualizado', 'Erro', 'Reiniciar']) assert.ok(ind.includes(`'${estado}'`) || ind.includes(`${estado}:`) || ind.includes(estado), estado);
  assert.match(ind, /hot-reload\/recarregar/);
  assert.match(ind, /\/produção\/\.test\(est\.motivoInativo/, 'oculto em produção');
  assert.match(ind, /Próprio `fetch`/, 'não usa o api() que descarta respostas atrasadas');
  assert.match(ler('client/editor-tema.css'), /\.eng-hot-painel/);
  assert.match(ler('client/src/main.mjs'), /case 'contentUpdate':/);
  assert.match(ler('client/src/sprites.mjs'), /export async function atualizarSpritesDoJogo/);
});
