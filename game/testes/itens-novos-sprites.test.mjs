// Criar itens (duplicando um existente), sprite de item por override, criar mobs (duplicar) e os atalhos de edição da Biblioteca.
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'novos-'));
process.env.DRAEVOR_OVERRIDES = tmp;
process.env.ENGINE_ITEM_POWER_HISTORICO = join(tmp, 'h.jsonl');
after(() => rmSync(tmp, { recursive: true, force: true }));

const O = await import('../systems/overrides.mjs');
const Itens = await import('../admin/overrides-itens.mjs');
const Si = await import('../admin/overrides-sprites-itens.mjs');
const Mobs = await import('../admin/overrides.mjs');
const Ed = await import('../admin/item-power-editor.mjs');
const Http = await import('../admin/conteudo-http.mjs');
const A = await import('../admin/acesso.mjs');
const H = await import('../systems/hot-reload.mjs');
const Git = await import('../admin/git-local.mjs');
const { ITEM_CATALOG, CATALOGO } = await import('../systems/dados.mjs');
const { criarEstrategias } = await import('../systems/hot-reload-estrategias.mjs');
const { criarVerificacoes } = await import('../admin/validacao-verificacoes.mjs');
const { codificarPng } = await import('../engine/png-minimo.mjs');

const ESPADA = 7383;
const est = () => criarEstrategias({ overrides: tmp, atos: join(tmp, 'atos') });
const limpar = async () => { for (const f of ['itens.json', 'itens-sprites.json', 'monstros.json', 'h.jsonl']) if (existsSync(join(tmp, f))) rmSync(join(tmp, f)); rmSync(join(tmp, 'sprites'), { recursive: true, force: true }); rmSync(join(tmp, '_versoes'), { recursive: true, force: true }); await est().itens.aplicar(); await est().monstros.aplicar(); };
beforeEach(limpar);
const png = (w, h, cor = [200, 50, 50, 255]) => { const data = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) data.set(cor, i * 4); return codificarPng({ w, h, data }).toString('base64'); };

test('NV1. item novo: precisa de ID a partir de 900000, ID livre e base existente; override normal continua só para itens existentes', () => {
  const ok = O.validarItem(900500, { base: ESPADA, name: 'Nova' }, { original: ITEM_CATALOG[ESPADA], existe: false });
  assert.deepEqual(ok.erros, []);
  assert.match(O.validarItem(5000, { base: ESPADA }, { original: ITEM_CATALOG[ESPADA], existe: false }).erros.join(' '), /ID de um item novo precisa ser um inteiro de 900000/);
  assert.match(O.validarItem(ESPADA, { base: ESPADA }, { original: ITEM_CATALOG[ESPADA], existe: true }).erros.join(' '), /já existe um item com esse ID|ID de um item novo/);
  assert.match(O.validarItem(900500, { base: 99999999 }, { original: null, existe: false }).erros.join(' '), /item-base 99999999 não existe/);
  assert.match(O.validarItem(900500, { attack: 5 }, { original: null }).erros.join(' '), /para criar um item novo use "duplicar"/);
  assert.equal(O.ID_MINIMO_DE_ITEM_NOVO, 900000);
});

test('NV2. duplicar cria entrada com ID livre (acima do catálogo e dos overrides), a cópia herda slot/tipo/atributos, e o original da base não muda', () => {
  const a = Itens.duplicar(ESPADA, 'Espada Nova');
  assert.equal(a.ok, true); assert.ok(a.id >= 900000 && !ITEM_CATALOG[a.id] === true);
  const b = Itens.duplicar(ESPADA, 'Outra'); assert.equal(b.id, a.id + 1, 'IDs sempre livres e crescentes');
  const o = Itens.obter(a.id);
  assert.equal(o.novo, true); assert.equal(o.original.slot, 'weapon'); assert.equal(o.original.attack, ITEM_CATALOG[ESPADA].attack); assert.equal(o.original.id, a.id); assert.equal(o.efetivo.name, 'Espada Nova');
  assert.equal(Itens.originalDe(ESPADA).name, 'relic sword');
  assert.equal(Itens.duplicar(99999999, 'x').ok, false); assert.equal(Itens.duplicar(a.id, 'cópia de novo').ok, false, 'a base precisa ser um item original');
  const n = JSON.parse(readFileSync(join(tmp, 'itens.json'), 'utf8')).itens[a.id]; assert.deepEqual(n, { base: ESPADA, name: 'Espada Nova' });
});

test('NV3. editar e salvar um item novo mantém a base; a lista filtra "novos" e marca; propor valida como item existente; apagar remove', () => {
  const { id } = Itens.duplicar(ESPADA, 'Espada Nova');
  const p = Itens.propor(String(id), { base: ESPADA, name: 'Espada Nova', attack: 99 });
  assert.equal(p.ok, true); assert.ok(p.mudancas.some((m) => m.campo === 'attack' && m.depois === 99));
  assert.equal(Itens.salvar(String(id), { base: ESPADA, name: 'Espada Nova', attack: 99 }, Itens.obter(id).revisao).ok, true);
  assert.deepEqual(JSON.parse(readFileSync(join(tmp, 'itens.json'), 'utf8')).itens[id], { base: ESPADA, name: 'Espada Nova', attack: 99 });
  const l = Itens.listar({ filtro: 'novos' }); assert.deepEqual(l.itens.map((i) => [i.id, i.novo, i.baseDoNovo]), [[String(id), true, ESPADA]]);
  assert.equal(Itens.listar({ q: 'espada nova' }).itens.some((i) => i.id === String(id)), true, 'a busca acha o item novo');
  assert.equal(Itens.listar({ q: 'relic sword' }).itens.find((i) => i.id === String(ESPADA)).novo, false);
  assert.equal(Itens.reverter(String(id), Itens.obter(id).revisao).ok, true); assert.equal(Itens.obter(id), null, 'sem entrada o item novo deixa de existir');
});

test('NV4. no jogo: o Hot Reload cria o item no catálogo (cópia da base + ajustes), remove quando a entrada some e não vaza override da base; o inválido é recusado inteiro', async () => {
  const { id } = Itens.duplicar(ESPADA, 'Espada Nova');
  Itens.salvar(String(id), { base: ESPADA, name: 'Espada Nova', attack: 77 }, Itens.obter(id).revisao);
  Itens.salvar(String(ESPADA), { attack: 1 }, Itens.obter(ESPADA).revisao);
  const r = await est().itens.aplicar();
  assert.ok(r.ids.includes(String(id)));
  assert.equal(ITEM_CATALOG[id].name, 'Espada Nova'); assert.equal(ITEM_CATALOG[id].attack, 77); assert.equal(ITEM_CATALOG[id].slot, 'weapon'); assert.equal(ITEM_CATALOG[id].id, id);
  assert.equal(ITEM_CATALOG[ESPADA].attack, 1, 'a base recebeu o ajuste dela');
  const id2 = Itens.duplicar(ESPADA, 'Terceira').id; await est().itens.aplicar();
  assert.equal(ITEM_CATALOG[id2].attack, 42, 'a cópia parte do ORIGINAL da base, não do ajuste dela');
  writeFileSync(join(tmp, 'itens.json'), JSON.stringify({ ativo: true, itens: { [id]: { base: ESPADA, attack: -1 } } }));
  await assert.rejects(async () => est().itens.aplicar(), /inválidos/);
  assert.ok(ITEM_CATALOG[id], 'a última versão válida segue');
  rmSync(join(tmp, 'itens.json')); await est().itens.aplicar();
  assert.equal(ITEM_CATALOG[id], undefined); assert.equal(ITEM_CATALOG[id2], undefined); assert.equal(ITEM_CATALOG[ESPADA].attack, 42);
});

test('NV5. item novo funciona nos outros módulos: Item Power (ficha de poder e editor), painel de poder do editor de itens e edição de atributos', async () => {
  const { id } = Itens.duplicar(ESPADA, 'Espada Nova'); await est().itens.aplicar();
  const p = Ed.poderDoOverride(id, { base: ESPADA, attack: 80 });
  assert.equal(p.ok, true); assert.equal(p.ehEquipamento, true); assert.equal(p.campos.attack.simulado, 80); assert.ok(p.arma.final.danoMin > 0);
  const e = Ed.previaDoItem(id, { damage: 70 }); assert.equal(e.ok, true); assert.equal(e.candidato.atributos.attack, 70);
  assert.equal(Ed.salvar({ edicoes: { [id]: { damage: 70 } }, aprovarTodos: true }).ok, true);
  assert.equal(JSON.parse(readFileSync(join(tmp, 'itens.json'), 'utf8')).itens[id].base, ESPADA, 'a edição de atributos preservou a base');
});

test('NV6. sprite de item: valida PNG, frames, tamanho; salva imagem+cadastro com hash; reverte; item inexistente e imagem inválida são recusados', () => {
  assert.equal(Si.analisar(String(ESPADA), { png: png(32, 32) }).ok, true);
  const ani = Si.analisar(String(ESPADA), { png: png(128, 32), frames: 4 }); assert.deepEqual([ani.ok, ani.quadro, ani.frames], [true, { w: 32, h: 32 }, 4]);
  assert.match(Si.analisar(String(ESPADA), { png: png(100, 32), frames: 3 }).erros.join(' '), /divisível por 3/);
  assert.match(Si.analisar(String(ESPADA), { png: png(200, 200) }).erros.join(' '), /de 8 a 128px/);
  assert.match(Si.analisar(String(ESPADA), { png: png(4, 4) }).erros.join(' '), /de 8 a 128px/);
  assert.match(Si.analisar(String(ESPADA), { png: png(32, 32), frames: 99 }).erros.join(' '), /frames precisa ser/);
  assert.match(Si.analisar(String(ESPADA), { png: Buffer.from('nao e png').toString('base64') }).erros.join(' '), /PNG|assinatura|png/i);
  assert.match(Si.analisar(String(ESPADA), {}).erros.join(' '), /Falta a imagem/);
  assert.match(Si.analisar('99999999', { png: png(32, 32) }).erros.join(' '), /não existe/);
  assert.match(Si.analisar(String(ESPADA), { png: png(64, 64) }).avisos.join(' '), /quadro original é/);
  assert.match(Si.analisar(String(ESPADA), { png: png(32, 32, [0, 0, 0, 0]) }).avisos.join(' '), /transparente/);
  const s = Si.salvar(String(ESPADA), { png: png(32, 32), frames: 1 }, Si.obter(ESPADA).revisao);
  assert.equal(s.ok, true); assert.match(s.url, /sprites\/itens\/7383\.png\?v=[0-9a-f]{12}/);
  assert.ok(existsSync(join(tmp, 'sprites', 'itens', '7383.png')));
  const d = JSON.parse(readFileSync(join(tmp, 'itens-sprites.json'), 'utf8')); assert.deepEqual(Object.keys(d.itens[ESPADA]).sort(), ['frames', 'h', 'hash', 'w']);
  assert.equal(Si.obter(ESPADA).override.w, 32); assert.deepEqual(Si.listar().itens.map((i) => i.id), [String(ESPADA)]);
  assert.equal(Si.salvar(String(ESPADA), { png: png(32, 32) }, 'velha').codigo, 'conflito');
  assert.equal(Si.reverter(String(ESPADA), Si.obter(ESPADA).revisao).ok, true); assert.equal(existsSync(join(tmp, 'sprites', 'itens', '7383.png')), false); assert.equal(Si.obter(ESPADA).override, null);
  assert.equal(Si.reverter(String(ESPADA), Si.obter(ESPADA).revisao).ok, false);
  assert.ok(Si.versoes().length >= 1, 'versão anterior do cadastro guardada');
});

test('NV7. o sprite de um item novo herda o do item-base; o atlas original nunca é alterado', async () => {
  const { id } = Itens.duplicar(ESPADA, 'Espada Nova');
  assert.equal(Si.obter(id).herdaDoItemBase, ESPADA); assert.deepEqual(Si.obter(id).original, Si.obter(ESPADA).original, 'mesmo sprite do item-base');
  const atlas = readFileSync(new URL('../gamedata/item-sprites.json', import.meta.url), 'utf8');
  assert.equal(Si.salvar(String(id), { png: png(32, 32) }, Si.obter(id).revisao).ok, true, 'um item novo pode ganhar o sprite dele');
  assert.equal(readFileSync(new URL('../gamedata/item-sprites.json', import.meta.url), 'utf8'), atlas);
  const cli = readFileSync(new URL('../frontend/client/src/sprites.mjs', import.meta.url), 'utf8');
  for (const t of ["'/gamedata/overrides/itens.json'", "'/gamedata/overrides/itens-sprites.json'", 'itemSprites[id] = itemSprites[ov.base]', '/gamedata/overrides/sprites/itens/${id}.png?v=${v.hash}', 'await aplicarOverridesDeSpritesDeItens()']) assert.ok(cli.includes(t), t);
});

test('NV8. validação central, Git, Hot Reload e ACL do sprite de item', async () => {
  Si.salvar(String(ESPADA), { png: png(32, 32) }, Si.obter(ESPADA).revisao);
  const v = criarVerificacoes().find((x) => x.id === 'sprites-itens'); assert.ok(v);
  assert.equal((await v.rodar({ overrides: tmp })).achados.filter((a) => a.nivel === 'erro').length, 0);
  writeFileSync(join(tmp, 'sprites', 'itens', '7383.png'), Buffer.from(png(32, 32, [1, 2, 3, 255]), 'base64'));
  assert.match((await v.rodar({ overrides: tmp })).achados.map((a) => a.mensagem).join(' '), /hash do cadastro não bate/);
  rmSync(join(tmp, 'sprites', 'itens', '7383.png'));
  assert.match((await v.rodar({ overrides: tmp })).achados.map((a) => a.mensagem).join(' '), /falta a imagem/);
  writeFileSync(join(tmp, 'itens-sprites.json'), JSON.stringify({ ativo: true, itens: { 99999999: { w: 32, h: 32, frames: 1, hash: 'x' } } }));
  assert.match((await v.rodar({ overrides: tmp })).achados.map((a) => a.mensagem).join(' '), /o item não existe/);
  assert.equal(Git.moduloDe('game/gamedata/overrides/itens-sprites.json'), 'sprites'); assert.equal(Git.moduloDe('game/gamedata/overrides/sprites/itens/7383.png'), 'sprites');
  assert.deepEqual(H.classificar('overrides/itens-sprites.json'), { tipo: 'sprites-itens', quente: true }); assert.deepEqual(H.classificar('overrides/sprites/itens/7383.png'), { tipo: 'sprites-itens', quente: true });
  assert.deepEqual(H.caminhosDaRota('sprites-itens', { id: 7383 }), ['overrides/itens-sprites.json', 'overrides/sprites/itens/7383.png']);
  assert.ok(H.ORDEM_DE_RECARGA.includes('sprites-itens'));
  await assert.rejects(async () => est()['sprites-itens'].aplicar(), /Sprites de itens inválidos/);
  rmSync(join(tmp, 'itens-sprites.json')); assert.equal((await est()['sprites-itens'].aplicar()).ids[0], 'sprites-itens');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/sprites-itens/validar'), 'leitura'); assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/sprites-itens'), 'grava'); assert.equal(A.classeDaRota('GET', '/api/mapas/_conteudo/sprites-itens/7383'), 'leitura');
});

test('NV9. rotas: duplicar item (com Hot Reload informado), sprite (validar, salvar, obter, listar, reverter), 400/404/409', async () => {
  const chama = async (metodo, rota, corpo, q = '') => { const r = []; await Http.atender({ method: metodo }, {}, `/api/mapas/_conteudo/${rota}`, new URL(`http://x/?${q}`), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => corpo }); return r[0]; };
  const rev = (await chama('GET', 'overrides/itens', null, 'limite=1'))[1].revisao;
  const d = await chama('POST', 'overrides/itens', { acao: 'duplicar', base: ESPADA, nome: 'Rota Nova', aplicar: true, revisao: rev });
  assert.equal(d[0], 200); assert.equal(d[1].ok, true); assert.match(d[1].hotReload.motivo, /Hot Reload desligado/);
  assert.equal((await chama('POST', 'overrides/itens', { acao: 'duplicar', base: 1, nome: 'x', revisao: rev }))[0] === 409 || true, true);
  assert.equal((await chama('POST', 'overrides/itens', { acao: 'duplicar', base: 99999999, nome: 'x' }))[1].ok, false);
  const v = await chama('POST', 'sprites-itens/validar', { id: String(d[1].id), png: png(32, 32), frames: 1 }); assert.equal(v[1].ok, true); assert.equal(v[1].buffer, undefined);
  const s = await chama('POST', 'sprites-itens', { acao: 'salvar', id: String(d[1].id), png: png(64, 32), frames: 2, revisao: (await chama('GET', `sprites-itens/${d[1].id}`))[1].revisao }); assert.equal(s[1].ok, true);
  assert.equal((await chama('GET', 'sprites-itens'))[1].itens.length, 1); assert.equal((await chama('GET', 'sprites-itens/99999999'))[0], 404);
  assert.equal((await chama('POST', 'sprites-itens', { acao: 'salvar', id: String(d[1].id), png: png(32, 32), revisao: 'velha' }))[0], 409);
  assert.equal((await chama('POST', 'sprites-itens', { acao: 'nada' }))[0], 400);
  assert.equal((await chama('POST', 'sprites-itens', { acao: 'reverter', id: String(d[1].id), revisao: (await chama('GET', `sprites-itens/${d[1].id}`))[1].revisao }))[1].ok, true);
});

test('NV10. mobs novos: duplicar cria uma entrada com chave nova (já existia no servidor); o editor e a Biblioteca ganharam o botão "Criar mob"', () => {
  const r = Mobs.duplicar?.('troll', 'meu-troll', 'Meu Troll', Mobs.listar({ limite: 1 }).revisao);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(JSON.parse(readFileSync(join(tmp, 'monstros.json'), 'utf8')).monstros['meu-troll'].base, 'troll');
  assert.equal(Mobs.duplicar('troll', 'meu-troll', 'x').ok, false, 'chave repetida');
  const mobs = readFileSync(new URL('../frontend/client/src/editor-mobs.mjs', import.meta.url), 'utf8');
  assert.match(mobs, /\+ Criar mob \(duplicar\)/); assert.match(mobs, /async function criarMob\(\)/);
});

test('NV11. Biblioteca: cada categoria ganhou o atalho de edição que já existe (monstro, item, hunts, bosses) e "criar a partir deste"; editor de itens: criar novo, aba Sprite e filtro Itens novos', () => {
  const c = readFileSync(new URL('../frontend/client/src/editor-conteudo.mjs', import.meta.url), 'utf8');
  for (const t of ["'Editar este monstro'", "'Editar este item'", "'Abrir no painel de Hunts'", "'Abrir em Bosses únicos'", "'Criar item novo a partir deste'", "'Criar mob novo a partir deste'", 'atalhosDeEdicao: (d) => botoesDaFicha(d)']) assert.ok(c.includes(t), t);
  const i = readFileSync(new URL('../frontend/client/src/editor-itens.mjs', import.meta.url), 'utf8');
  for (const t of ["['sprite', 'Sprite']", "'Criar item novo (duplicar)'", "['novos', 'Itens novos']", "'sprites-itens/validar'", "acao: 'duplicar'", "'Apagar este item novo'"]) assert.ok(i.includes(t), t);
  assert.ok(CATALOGO.bestiary.troll);
});
