// Integração do Hot Reload com os módulos REAIS do jogo (cada arquivo de teste é um processo: as pastas de overrides/atos/campanha são temporárias).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aAdaptar, doClassico } from './apoio-migracao.mjs';

const pasta = mkdtempSync(join(tmpdir(), 'hot-int-'));
const OV = join(pasta, 'overrides');
const ATOS = join(pasta, 'atos');
mkdirSync(OV, { recursive: true }); mkdirSync(ATOS, { recursive: true });
process.env.DRAEVOR_OVERRIDES = OV;
const campanhaTmp = join(pasta, 'campanha.json');
copyFileSync(new URL('../gamedata/campanha.json', import.meta.url), campanhaTmp);
after(() => rmSync(pasta, { recursive: true, force: true }));

const { CATALOGO, ITEM_CATALOG } = await import('../systems/dados.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Campanha = await import('../systems/campanha.mjs');
const H = await import('../systems/hot-reload.mjs');
const { criarEstrategias, iniciarHotReload } = await import('../systems/hot-reload-estrategias.mjs');
const S = await import('../admin/overrides-sprites.mjs');
const F = await import('../engine/sprite-folha.mjs');
const E = await import('../engine/sprite-edicao.mjs');
const { decodificarPng, codificarPng } = await import('../engine/png-minimo.mjs');
const { transmitir, ligar } = await import('../systems/avisos-globais.mjs');
S.CAMINHOS.arquivo = join(OV, 'sprites.json'); S.CAMINHOS.versoes = join(OV, '_v', 'sprites'); S.CAMINHOS.pasta = join(OV, 'sprites'); S.CAMINHOS.historico = join(OV, '_v', 'sprites-png');

const quieto = () => {};
const recebidos = [];
ligar(new Map([['jogador', { ws: {}, personagem: 'x', enviarPronto: (t) => recebidos.push(JSON.parse(t)) }]]));
const hr = H.criarHotReload({ estrategias: criarEstrategias({ overrides: OV, atos: ATOS, campanhaArquivo: campanhaTmp }), notificar: transmitir, debounceMs: 10, tentativaMs: 5, log: quieto });
const salvar = (arq, obj) => writeFileSync(join(OV, arq), typeof obj === 'string' ? obj : JSON.stringify(obj));
const recarregar = async (tipo, caminho) => { hr.mudou(caminho, 'engine'); await new Promise((r) => setTimeout(r, 60)); await hr.processar(); return hr.estadoAtual(); };
const ultimo = () => recebidos.at(-1);
const copia = (o) => JSON.parse(JSON.stringify(o));
const TROLL0 = copia(CATALOGO.bestiary.troll);
const ATAQUES0 = copia(Poderes.poderesDe('troll'));
const PRISTINE_ITEM = copia(ITEM_CATALOG['3268']);
const sha = (b) => createHash('sha1').update(b).digest('hex');

test('HI1. MONSTRO: salvar o override atualiza o bestiário, os ataques e o loot SEM reiniciar; os clientes recebem só o monstro alterado; o original (catalog-real.json) não é tocado', async () => {
  const origemAntes = sha(readFileSync(new URL('../gamedata/catalog-real.json', import.meta.url)));
  const idAntes = CATALOGO.bestiary;
  salvar('monstros.json', { ativo: true, monstros: { troll: { hp: 777, name: 'Troll Quente', loot: [{ id: 3031, name: 'gold coin', chance: 1 }], ataques: [{ tipo: 'melee', min: 5, max: 9, intervalo: 2000, chance: 100 }], look: 5 } } });
  const e = await recarregar('monstros', 'overrides/monstros.json');
  assert.equal(e.estado, 'atualizado', e.mensagem);
  assert.equal(CATALOGO.bestiary, idAntes, 'o mesmo objeto do jogo (quem guardou a referência enxerga a mudança)');
  assert.equal(CATALOGO.bestiary.troll.hp, 777);
  assert.equal(CATALOGO.bestiary.troll.name, 'Troll Quente');
  assert.equal(CATALOGO.bestiary.troll.look, 5);
  assert.deepEqual(CATALOGO.bestiary.troll.loot.map((l) => l.id), [3031]);
  assert.deepEqual(Poderes.poderesDe('troll').ataques, [{ tipo: 'melee', min: 5, max: 9, intervalo: 2000, chance: 100 }]);
  assert.deepEqual(Object.keys(ultimo().monstros), ['troll']);
  assert.equal(ultimo().monstros.troll.hp, 777);
  assert.equal(ultimo().tipo, 'monstros');
  assert.equal(ultimo().revisao, 1);
  assert.equal(CATALOGO.bestiary.rotworm.hp, JSON.parse(readFileSync(new URL('../gamedata/catalog-real.json', import.meta.url), 'utf8')).bestiary.rotworm.hp, 'quem não tem override não muda');
  assert.equal(sha(readFileSync(new URL('../gamedata/catalog-real.json', import.meta.url))), origemAntes);
});

test('HI2. MONSTRO: arquivo quebrado e entrada inválida NÃO corrompem — fica a última versão válida, o erro é registrado; corrigir e salvar de novo recarrega', async () => {
  const antes = copia(CATALOGO.bestiary.troll);
  const n = recebidos.length;
  let e = await recarregar('monstros', salvarRuim('{ isso não é json'));
  assert.equal(e.estado, 'erro');
  assert.match(e.mensagem, /não é um JSON válido/);
  assert.deepEqual(copia(CATALOGO.bestiary.troll), antes, 'nada mudou');
  e = await recarregar('monstros', salvarRuim({ ativo: true, monstros: { troll: { hp: -5 }, rotworm: { hp: 123 } } }));
  assert.equal(e.estado, 'erro');
  assert.match(e.mensagem, /troll: .*vida/);
  assert.deepEqual(copia(CATALOGO.bestiary.troll), antes, 'o troll segue válido');
  assert.notEqual(CATALOGO.bestiary.rotworm.hp, 123, 'a entrada boa do MESMO arquivo ruim também não entrou (tudo ou nada)');
  assert.equal(recebidos.length, n, 'nenhum cliente foi avisado');
  assert.equal(hr.estadoAtual().historico[0].resultado, 'erro');
  salvar('monstros.json', { ativo: true, monstros: { troll: { hp: 800 }, rotworm: { hp: 123 } } });
  e = await recarregar('monstros', 'overrides/monstros.json');
  assert.equal(e.erros.length, 0);
  assert.equal(CATALOGO.bestiary.troll.hp, 800);
  assert.equal(CATALOGO.bestiary.troll.name, TROLL0.name, 'o que saiu do override volta ao original');
  assert.deepEqual(Poderes.poderesDe('troll'), ATAQUES0, 'os ataques também voltam');
  assert.equal(CATALOGO.bestiary.rotworm.hp, 123);
});
function salvarRuim(c) { salvar('monstros.json', c); return 'overrides/monstros.json'; }

test('HI3. MONSTRO: variação (base) entra e SAI do bestiário; desligar o override e apagar o arquivo devolvem exatamente o original', async () => {
  salvar('monstros.json', { ativo: true, monstros: { 'troll-quente': { base: 'troll', name: 'Troll Quente', hp: 999, ataques: [{ tipo: 'melee', min: 1, max: 2, intervalo: 2000, chance: 100 }] } } });
  let e = await recarregar('monstros', 'overrides/monstros.json');
  assert.equal(e.estado, 'atualizado', e.mensagem);
  assert.equal(CATALOGO.bestiary['troll-quente'].hp, 999);
  assert.equal(CATALOGO.bestiary['troll-quente'].loot.length, TROLL0.loot.length, 'herda do original da base');
  assert.ok(Poderes.temPoderes({ key: 'troll-quente' }));
  assert.ok(ultimo().monstros['troll-quente']);
  salvar('monstros.json', { ativo: true, monstros: {} });
  e = await recarregar('monstros', 'overrides/monstros.json');
  assert.equal(CATALOGO.bestiary['troll-quente'], undefined, 'a variação saiu');
  assert.equal(ultimo().monstros['troll-quente'], null, 'e o cliente é avisado de que ela sumiu');
  assert.deepEqual(copia(CATALOGO.bestiary.troll), TROLL0, 'o troll voltou a ser idêntico ao original');
  assert.equal(Poderes.temPoderes({ key: 'troll-quente' }), false);
  assert.deepEqual(Poderes.poderesDe('troll'), ATAQUES0);
  salvar('monstros.json', { ativo: false, monstros: { troll: { hp: 1 } } });
  await recarregar('monstros', 'overrides/monstros.json');
  assert.deepEqual(copia(CATALOGO.bestiary.troll), TROLL0, 'camada desligada = original');
});

test('HI4. ITEM: a recarga atualiza o catálogo; remover o override devolve o item original (inclusive o que o boot já tinha calculado); inválido mantém o anterior', async () => {
  salvar('itens.json', { ativo: true, itens: { 3268: { attack: 55, name: 'Machado Quente', buy: 100, sell: 40 } } });
  let e = await recarregar('itens', 'overrides/itens.json');
  assert.equal(e.estado, 'atualizado', e.mensagem);
  assert.deepEqual([ITEM_CATALOG['3268'].attack, ITEM_CATALOG['3268'].name, ITEM_CATALOG['3268'].sell], [55, 'Machado Quente', 40]);
  assert.equal(ultimo().tipo, 'itens');
  assert.equal(ultimo().itens['3268'].attack, 55);
  salvar('itens.json', { ativo: true, itens: { 3268: { attack: -1 } } });
  e = await recarregar('itens', 'overrides/itens.json');
  assert.equal(e.estado, 'erro');
  assert.equal(ITEM_CATALOG['3268'].attack, 55, 'a última versão válida segue');
  salvar('itens.json', { ativo: true, itens: {} });
  e = await recarregar('itens', 'overrides/itens.json');
  assert.deepEqual(copia(ITEM_CATALOG['3268']), PRISTINE_ITEM);
  assert.equal(ultimo().itens['3268'].name, PRISTINE_ITEM.name);
});

const OUTFITS = JSON.parse(readFileSync(new URL('../gamedata/outfits.json', import.meta.url), 'utf8'));
const MONTARIA = String(JSON.parse(readFileSync(new URL('../gamedata/mounts-real.json', import.meta.url), 'utf8')).mounts[0].look);
const folhaOriginal = (look) => decodificarPng(readFileSync(new URL(`../gamedata/sprites/outfits/${look}.png`, import.meta.url)));
const estadoDe = (look) => ({ meta: structuredClone(OUTFITS[look]), quadros: F.desmontar(OUTFITS[look], folhaOriginal(look)) });

test('HI5. SPRITE e FRAMES: salvar na Engine (override) → o servidor valida a imagem e o cadastro, avisa o cliente com hash e meta novos; mudar a quantidade de quadros chega no cadastro; original intacto', async () => {
  const origPng = sha(readFileSync(new URL(`../gamedata/sprites/outfits/${MONTARIA}.png`, import.meta.url)));
  const origJson = sha(readFileSync(new URL('../gamedata/outfits.json', import.meta.url)));
  let e0 = estadoDe(MONTARIA);
  e0 = E.aplicarNaCelula(e0, 1, 0, { z: 0, addon: 0, dir: 2, layer: 0 }, (b) => E.lapis(b, [[3, 3]], [255, 0, 255, 255]));
  e0 = E.duplicarQuadro(e0, 1, 2); // 8 → 9 quadros de caminhada
  const m = F.montar(e0.meta, e0.quadros);
  const r = S.salvar(MONTARIA, { meta: m.meta, png: codificarPng(m.folha).toString('base64') }, 'ausente');
  assert.equal(r.ok, true, r.erros?.join('|'));
  const est = await recarregar('sprites', 'overrides/sprites.json');
  assert.equal(est.estado, 'atualizado', est.mensagem);
  const msg = ultimo();
  assert.equal(msg.tipo, 'sprites');
  assert.deepEqual(msg.ids, [MONTARIA]);
  assert.equal(msg.sprites[MONTARIA].hash, r.hash);
  assert.equal(msg.sprites[MONTARIA].meta.groups[1].frames, OUTFITS[MONTARIA].groups[1].frames + 1, 'os frames da animação foram atualizados');
  assert.equal(msg.sprites[MONTARIA].meta.groups[1].animation.durations.length, msg.sprites[MONTARIA].meta.groups[1].frames);
  assert.equal(msg.ativo, true);
  assert.equal(sha(readFileSync(new URL(`../gamedata/sprites/outfits/${MONTARIA}.png`, import.meta.url))), origPng);
  assert.equal(sha(readFileSync(new URL('../gamedata/outfits.json', import.meta.url))), origJson);
  // salvar de novo igual: o cliente não é incomodado
  const n = recebidos.length;
  await recarregar('sprites', 'overrides/sprites.json');
  assert.equal(recebidos.length, n);
  assert.equal(hr.estadoAtual().historico[0].resultado, 'sem-mudanca');
});

test('HI6. SPRITE inválido: imagem trocada fora da Engine (hash não bate), cadastro incoerente e imagem ausente NÃO são aplicados — o cliente segue com a última versão válida', async () => {
  const n = recebidos.length;
  const reg = JSON.parse(readFileSync(join(OV, 'sprites.json'), 'utf8'));
  const png = join(OV, 'sprites', `${MONTARIA}.png`);
  const bom = readFileSync(png);
  // 1) imagem trocada por outra (mesmo tamanho): o hash do cadastro não bate
  const outra = decodificarPng(bom); outra.data[3] = 0; outra.data[7] = 255; outra.data[4] = 9;
  writeFileSync(png, codificarPng(outra));
  let e = await recarregar('sprites', `overrides/sprites/${MONTARIA}.png`);
  assert.equal(e.estado, 'erro');
  assert.match(e.mensagem, /hash do cadastro/);
  writeFileSync(png, bom);
  // 2) cadastro com o tamanho errado
  const ruim = structuredClone(reg); ruim.sprites[MONTARIA].meta.cw = 32;
  writeFileSync(join(OV, 'sprites.json'), JSON.stringify(ruim));
  e = await recarregar('sprites', 'overrides/sprites.json');
  assert.equal(e.estado, 'erro');
  assert.match(e.mensagem, /não bate com a conta|cadastro pede/);
  // 3) imagem sumiu
  writeFileSync(join(OV, 'sprites.json'), JSON.stringify(reg));
  rmSync(png);
  e = await recarregar('sprites', 'overrides/sprites.json');
  assert.match(e.mensagem, /falta a imagem/);
  assert.equal(recebidos.length, n, 'ninguém foi avisado de nada disso');
  // consertado: volta a funcionar
  writeFileSync(png, bom);
  e = await recarregar('sprites', `overrides/sprites/${MONTARIA}.png`);
  assert.equal(e.erros.length, 0);
});

test('HI7. SPRITE: desligar o override (ou apagá-lo) manda o cliente de volta ao original (null); alterar a imagem ORIGINAL à mão devolve a versão de cache; índice dos desenhos avisa', async () => {
  const rev = S.listar().revisao;
  assert.equal(S.definirAtivo(MONTARIA, false, rev).ok, true);
  await recarregar('sprites', 'overrides/sprites.json');
  assert.equal(ultimo().sprites[MONTARIA], null, 'null = voltar ao original');
  assert.equal(S.definirAtivo(MONTARIA, true, S.listar().revisao).ok, true);
  await recarregar('sprites', 'overrides/sprites.json');
  assert.ok(ultimo().sprites[MONTARIA].hash);
  assert.equal(S.reverter(MONTARIA, S.listar().revisao).ok, true);
  await recarregar('sprites', 'overrides/sprites.json');
  assert.equal(ultimo().sprites[MONTARIA], null);
  hr.mudou(`sprites/outfits/${MONTARIA}.png`, 'arquivo');
  await new Promise((r) => setTimeout(r, 60)); await hr.processar();
  assert.match(ultimo().originais[MONTARIA], /^\d+-\d+$/, 'versão para furar o cache do navegador');
  hr.mudou('outfits.json', 'arquivo');
  await new Promise((r) => setTimeout(r, 60)); await hr.processar();
  assert.equal(ultimo().indice, true);
});

const hunts = Campanha.FASES.filter((f) => f.ato === 2 && !f.pular).slice(0, 6).map((f) => f.huntId);
Campanha._liberarHuntsParaTestes(hunts);
const fase = (id, huntId, extra = {}) => ({ id, nome: id.toUpperCase(), huntId, tipo: 'hunt-normal', nivel: { facil: 20, medio: 120, dievel: 0, dificil: 620 }, ...extra });
const ato5 = (mod = {}) => ({
  id: 'ato-quente', nome: 'Ato Quente', estado: 'publicado', ordem: 5, anterior: 'legado-4', inicio: 'fase-1',
  fases: hunts.map((h, i) => fase(`fase-${i + 1}`, h, { ordem: i + 1, ...(i === 5 ? { obrigatoria: false } : {}) })),
  conexoes: [['fase-1', 'fase-2'], ['fase-2', 'fase-3'], ['fase-2', 'fase-4'], ['fase-3', 'fase-5'], ['fase-4', 'fase-5'], ['fase-1', 'fase-6']].map(([de, para]) => ({ de, para })),
  bossFinal: { bossId: 'ahau', faseAnterior: 'fase-5' },
  ...mod,
});

test('HI8. ACT: um ato novo entra no jogo sem reiniciar, editar o arquivo o SUBSTITUI, um ato inválido mantém o anterior, rascunho/apagar o tiram', { skip: aAdaptar("Hot reload do Ato vale para poe-ato-*; o teste usa um ato do Draevor") }, async () => {
  const arquivo = join(ATOS, 'ato-quente.json');
  const grava = (a) => writeFileSync(arquivo, JSON.stringify(a));
  grava(ato5());
  let e = await recarregar('atos', 'atos/ato-quente.json');
  assert.equal(e.estado, 'atualizado', e.mensagem);
  assert.equal(Campanha.ATOS_DO_EDITOR.get(5).ato.nome, 'Ato Quente');
  assert.deepEqual(ultimo().atos, ['ato-quente']);
  grava(ato5({ nome: 'Ato Renomeado' }));
  e = await recarregar('atos', 'atos/ato-quente.json');
  assert.equal(Campanha.ATOS_DO_EDITOR.get(5).ato.nome, 'Ato Renomeado');
  assert.equal(Campanha.ATOS_DO_EDITOR.size, 1, 'substituiu, não duplicou');
  assert.equal(Campanha.FASES.filter((f) => f.grafo?.atoId === 'ato-quente').length, 6, 'as fases não foram duplicadas');
  // inválido: boss que não existe
  grava(ato5({ nome: 'Quebrado', bossFinal: { bossId: 'nao-existe', faseAnterior: 'fase-5' } }));
  e = await recarregar('atos', 'atos/ato-quente.json');
  assert.equal(e.estado, 'erro');
  assert.match(e.mensagem, /última versão válida/);
  assert.equal(Campanha.ATOS_DO_EDITOR.get(5).ato.nome, 'Ato Renomeado', 'o ato anterior continua no jogo');
  assert.equal(Campanha.FASES.filter((f) => f.grafo?.atoId === 'ato-quente').length, 6);
  // JSON quebrado
  writeFileSync(arquivo, '{ ops');
  e = await recarregar('atos', 'atos/ato-quente.json');
  assert.equal(e.estado, 'erro');
  assert.equal(Campanha.ATOS_DO_EDITOR.get(5).ato.nome, 'Ato Renomeado');
  // rascunho tira do jogo; voltar a publicado põe; apagar o arquivo tira
  grava(ato5({ estado: 'rascunho' }));
  await recarregar('atos', 'atos/ato-quente.json');
  assert.equal(Campanha.ATOS_DO_EDITOR.has(5), false);
  grava(ato5());
  await recarregar('atos', 'atos/ato-quente.json');
  assert.equal(Campanha.ATOS_DO_EDITOR.has(5), true);
  rmSync(arquivo);
  await recarregar('atos', 'atos/ato-quente.json');
  assert.equal(Campanha.ATOS_DO_EDITOR.has(5), false);
  assert.equal(Campanha.FASES.filter((f) => f.grafo).length, 0, 'nenhuma fase órfã');
});

test('HI9. CAMPANHA: níveis das fases e dos bosses recarregam a quente; estrutura diferente (fase a mais) exige reinício e não toca em nada', { skip: doClassico("Níveis das 48 fases/bosses da campanha do Draevor") }, async () => {
  const c = JSON.parse(readFileSync(campanhaTmp, 'utf8'));
  c.fases = c.fases.filter((f) => !hunts.includes(f.huntId)); // este processo já "emprestou" 6 hunts da campanha legada ao ato de teste (HI8)
  const nivel0 = copia(Campanha.FASES[0].nivel);
  c.fases[0].nivel.medio = nivel0.medio + 7;
  c.bosses['1'].nivel.facil += 3;
  writeFileSync(campanhaTmp, JSON.stringify(c));
  let e = await recarregar('campanha', 'campanha.json');
  assert.equal(e.estado, 'atualizado', e.mensagem);
  assert.equal(Campanha.FASES[0].nivel.medio, nivel0.medio + 7);
  assert.equal(Campanha.bossDoAto(1).nivel.facil, c.bosses['1'].nivel.facil);
  assert.deepEqual(ultimo().mudadas.sort(), [c.fases[0].huntId, 'boss-1'].sort());
  c.fases.push({ huntId: 'inexistente', nome: 'x', ato: 4, levelOriginal: 1, nivel: { facil: 1, medio: 1, dificil: 1 } });
  writeFileSync(campanhaTmp, JSON.stringify(c));
  const antes = copia(Campanha.FASES[0].nivel);
  const n = recebidos.length;
  e = await recarregar('campanha', 'campanha.json');
  assert.equal(e.estado, 'reinicio');
  assert.match(e.reinicio.find((r) => r.tipo === 'campanha').motivo, /estrutura da campanha mudou/);
  assert.deepEqual(copia(Campanha.FASES[0].nivel), antes);
  assert.equal(recebidos.length, n);
});

test('HI10. exige reinício (hunts, habilidades, gemas…) é avisado com o sistema afetado; e em produção o Hot Reload é uma casca inerte (sem estratégias e sem monitoramento)', async () => {
  hr.mudou('hunts/troll-cave.json', 'engine');
  hr.mudou('gemas.json', 'arquivo');
  const e = hr.estadoAtual();
  assert.ok(e.reinicio.some((r) => r.tipo === 'hunts' && /instâncias de hunt/.test(r.motivo)));
  assert.ok(e.reinicio.some((r) => r.tipo === 'habilidades' && /estado dos personagens/.test(r.motivo)));
  const prod = iniciarHotReload({ producao: true, log: quieto });
  const p = prod.estadoAtual();
  assert.deepEqual([p.ativo, p.estado, p.recarregaveis.length], [false, 'desativado', 0]);
  assert.equal(prod.mudou('overrides/monstros.json'), null);
  assert.deepEqual((await prod.recarregar('monstros')), { ok: false, erro: 'Hot Reload desligado: ambiente de produção: o Hot Reload nunca roda em produção.' });
  const remoto = iniciarHotReload({ producao: false, env: { DATABASE_URL: 'postgres://u:s@10.1.1.1/jogo' }, log: quieto });
  assert.equal(remoto.estadoAtual().ativo, false);
  assert.match(remoto.estadoAtual().motivoInativo, /compartilhado\/remoto/);
});

test('HI11. PONTA A PONTA: salvar pela ROTA da Engine (guarda de acesso → editor → disco) aciona o Hot Reload sozinho, o jogo muda, o cliente é avisado, e a auditoria registra — sem reiniciar nada', async () => {
  const { createServer } = await import('node:http');
  const A = await import('../admin/acesso.mjs');
  const { criarGuarda } = await import('../admin/acesso-http.mjs');
  const Http = await import('../admin/conteudo-http.mjs');
  const Aud = await import('../admin/auditoria.mjs');
  Aud.CAMINHO.arquivo = join(pasta, 'auditoria.jsonl');
  const vivo = H.criarHotReload({ estrategias: criarEstrategias({ overrides: OV, atos: ATOS, campanhaArquivo: campanhaTmp }), notificar: transmitir, debounceMs: 20, tentativaMs: 5, log: quieto });
  Http.ligarHotReload(vivo);
  const acesso = A.criarAcesso({ config: A.configuracao({ env: { ENGINE_MODO: 'desenvolvimento' }, existe: () => false, arquivoDeAdmins: '/x' }), deps: {} });
  const guarda = criarGuarda(acesso, { aoGravar: ({ rota, corpo }) => vivo.aposGravacao(rota, corpo) });
  const servidor = createServer(async (req, res) => {
    const json = (r, c, b) => { r.statusCode = c; r.setHeader('content-type', 'application/json'); r.end(JSON.stringify(b)); return true; };
    const corpoJson = (r) => new Promise((ok) => { let t = ''; r.on('data', (x) => (t += x)); r.on('end', () => ok((r.corpoAuditado = JSON.parse(t || '{}')))); });
    const caminho = new URL(req.url, 'http://x').pathname;
    if (await guarda(req, res, caminho, { json, corpoJson })) return;
    if (await Http.atender(req, res, caminho, new URL(req.url, 'http://x'), { json, corpoJson })) return;
    json(res, 404, {});
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${servidor.address().port}/api/mapas/_conteudo/`;
  const chama = (metodo, rota, corpo) => fetch(base + rota, { method: metodo, headers: { 'content-type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined }).then((r) => r.json());
  try {
    salvar('monstros.json', { ativo: true, monstros: {} }); // (o HI3 deixou a camada desligada)
    await recarregar('monstros', 'overrides/monstros.json');
    const n = recebidos.length;
    const lista = await chama('GET', 'overrides/monstros?q=troll');
    const salvo = await chama('POST', 'overrides', { acao: 'salvar', key: 'troll', override: { hp: 4321 }, revisao: lista.revisao });
    assert.equal(salvo.ok, true, JSON.stringify(salvo.erros));
    let estado;
    for (let i = 0; i < 40; i++) { estado = await chama('GET', 'hot-reload'); if (estado.historico[0]?.resultado === 'ok') break; await new Promise((r) => setTimeout(r, 50)); }
    assert.equal(estado.historico[0].resultado, 'ok', JSON.stringify(estado.historico[0]));
    assert.equal(estado.historico[0].origem, 'engine', 'veio do evento explícito de salvamento (o fs.watch do mesmo salvamento não recarrega de novo)');
    assert.equal(CATALOGO.bestiary.troll.hp, 4321, 'o jogo já enxerga o novo valor');
    assert.equal(recebidos.length, n + 1);
    assert.equal(recebidos.at(-1).monstros.troll.hp, 4321);
    assert.match(readFileSync(Aud.CAMINHO.arquivo, 'utf8'), /"tipo":"gravacao".*"rota":"overrides"/, 'a gravação ficou na auditoria');
    // reverter pela Engine: o jogo volta ao original
    const rev = (await chama('GET', 'overrides/monstros/troll')).revisao;
    assert.equal((await chama('POST', 'overrides', { acao: 'reverter', key: 'troll', revisao: rev })).ok, true);
    for (let i = 0; i < 40 && CATALOGO.bestiary.troll.hp === 4321; i++) await new Promise((r) => setTimeout(r, 50));
    assert.equal(CATALOGO.bestiary.troll.hp, TROLL0.hp);
    // recarga manual pela rota
    assert.equal((await chama('POST', 'hot-reload/recarregar', { tipo: 'itens' })).ok, true);
  } finally {
    await new Promise((ok) => servidor.close(ok));
    Http.ligarHotReload(null);
  }
});
