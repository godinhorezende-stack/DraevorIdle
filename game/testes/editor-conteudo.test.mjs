// Etapa 4: o editor de conteúdo (admin/conteudo.mjs + as rotas): a validação é a do jogo + o ponto no mapa; o que
// se grava é só o bloco certo do arquivo; nada grava o que é inválido; nada some se está em uso.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Conteudo from '../admin/conteudo.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import * as Catalogo from '../systems/bosses-unicos/catalogo.mjs';
import * as Modelo from '../systems/encontros/modelo.mjs';
import * as Campanha from '../systems/campanha.mjs';
import { gradeDaHunt, huntOuMapaCustom } from '../systems/hunt/terreno.mjs';
import { andarDaGrade } from '../systems/hunt/andares.mjs';
import { casasAlcancaveis } from '../systems/hunt/instancia.mjs';

// Pasta temporária: o editor nunca toca nos arquivos reais nos testes.
const pasta = mkdtempSync(join(tmpdir(), 'draevor-conteudo-'));
mkdirSync(join(pasta, 'hunts'));
const originais = { ...Conteudo.CAMINHOS };
Conteudo.CAMINHOS.hunts = join(pasta, 'hunts');
Conteudo.CAMINHOS.bosses = join(pasta, 'bosses-unicos.json');
Conteudo.CAMINHOS.fases = join(pasta, 'campanha-conteudo.json');
const REAL = new URL('../gamedata/', import.meta.url);
const FASE = 'troll-cave';
copyFileSync(new URL(`hunts/${FASE}-map.json`, REAL), join(pasta, 'hunts', `${FASE}-map.json`));
writeFileSync(Conteudo.CAMINHOS.bosses, readFileSync(new URL('bosses-unicos.json', REAL)));
const criados = [];
after(() => {
  Object.assign(Conteudo.CAMINHOS, originais);
  for (const id of criados) Catalogo.esquecer(id);
  rmSync(pasta, { recursive: true, force: true });
});

const mapa = () => JSON.parse(readFileSync(join(pasta, 'hunts', `${FASE}-map.json`), 'utf8'));
const BOSS = { id: 'chefe-do-editor', nome: 'Chefe do Editor', categoria: 'principal', base: 'cyclops', atributos: { vidaMult: 3 }, melee: { min: 5, max: 10 }, recompensas: { loot: [{ id: 3031, chance: 50 }], primeiraVitoria: { gold: 100 } } };
const MINI = { ...BOSS, id: 'mini-do-editor', nome: 'Mini', categoria: 'miniboss' };

/** Uma casa andável da fase (e uma andável mas inalcançável, se houver) para os encontros de teste. */
function casas() {
  const grade = gradeDaHunt(huntOuMapaCustom(FASE));
  const g = andarDaGrade(grade, grade.z);
  const alc = casasAlcancaveis(grade).get(grade.z);
  const todas = [...g.andavel].map((k) => k.split(',').map(Number));
  const boa = todas.find(([x, y]) => alc.has(`${x},${y}`));
  const solta = todas.find(([x, y]) => !alc.has(`${x},${y}`));
  const parede = [0, 0];
  return { boa, solta, parede, z: grade.z };
}

test('as fases e a visão geral: 48 fases, nenhum problema nos dados atuais, e as opções para os formulários', () => {
  const a = Conteudo.auditar();
  assert.equal(a.fases.length, 48);
  assert.deepEqual(a.problemas, []);
  assert.equal(a.totais.comEncontros, 0, 'hoje nenhum mapa tem encontros');
  const o = Conteudo.opcoes();
  assert.ok(o.tipos.some((t) => t.id === 'bau-raro' && t.disponivel));
  assert.ok(o.tipos.some((t) => t.id === 'fenda' && !t.disponivel && t.v2), 'a v2 aparece como indisponível');
  assert.ok(o.afixosDeAltar.length >= 20 && !o.afixosDeAltar.some((a) => a.id === 'exp_bonus'));
  assert.deepEqual(o.categoriasDoTipo['boss-secreto'], ['secreto']);
  assert.ok(o.fases.length === 48 && o.limites.rolagensMax >= 1);
  assert.equal(Conteudo.buscarItens('gold coin').some((i) => i.id === 3031), true);
  assert.deepEqual(Conteudo.buscarItens('x'), []);
});

test('bosses: salvar valida (o do jogo), grava só em bosses-unicos.json, vale na hora; excluir recusa o que está em uso', () => {
  criados.push(BOSS.id, MINI.id);
  assert.deepEqual(Conteudo.salvarBoss({ ...BOSS, base: 'nao-existe' }).erros.length > 0, true);
  assert.equal(Conteudo.salvarBoss(BOSS).ok, true);
  assert.equal(Conteudo.salvarBoss(MINI).ok, true);
  const arquivo = JSON.parse(readFileSync(Conteudo.CAMINHOS.bosses, 'utf8'));
  assert.ok(arquivo.bosses[BOSS.id] && arquivo._exemplo, 'o resto do arquivo (a nota e o exemplo) fica');
  assert.equal(Catalogo.bossUnico(BOSS.id).nome, 'Chefe do Editor', 'o cadastro vale na hora');
  assert.equal(Conteudo.listarBosses().find((b) => b.id === BOSS.id).usos.length, 0);
  const aud = Conteudo.auditar().problemas.map((p) => p.mensagem).join(' | ');
  assert.match(aud, /cadastrado mas não usado/, 'incompleto: boss sem encontro aparece como aviso');
});

test('encontros: o ponto precisa ser andável (e alcançável); obrigatório inalcançável é erro, opcional é aviso', () => {
  const { boa, solta, parede, z } = casas();
  const e = (extra) => ({ id: 'e1', tipo: 'boss', bossId: BOSS.id, ...extra });
  const v = (lista) => Conteudo.validarFase(FASE, lista);
  assert.deepEqual(v([e({ x: boa[0], y: boa[1], z })]).erros, []);
  assert.match(v([e({ x: parede[0], y: parede[1], z })]).erros.join(' '), /não é andável/);
  if (solta) {
    assert.match(v([e({ x: solta[0], y: solta[1], z, obrigatorio: true })]).erros.join(' '), /alcançável/);
    const opc = v([{ ...e({ x: solta[0], y: solta[1], z }), tipo: 'miniboss', bossId: MINI.id }]);
    assert.deepEqual(opc.erros, []);
    assert.match(opc.avisos.join(' '), /alcançável/);
  }
  assert.match(v([e({ x: 99999, y: 1 })]).erros.join(' '), /fora da grade/);
  assert.match(v([e({ bossId: 'nao-existe' })]).erros.join(' '), /não está cadastrado/);
  assert.match(v([{ id: 'x', tipo: 'miniboss', bossId: BOSS.id }]).erros.join(' '), /categoria/);
  assert.match(v([e({ ativo: false })]).avisos.join(' '), /desligado/);
});

test('salvar encontros: grava SÓ o bloco `encontros` (o resto do mapa fica idêntico), recusa o inválido sem tocar no arquivo, e lista vazia remove o bloco', () => {
  const { boa, z } = casas();
  const antes = mapa();
  const ok = Conteudo.salvarEncontros(FASE, [{ id: 'chefe', tipo: 'boss', bossId: BOSS.id, obrigatorio: true, x: boa[0], y: boa[1], z }, { id: 'bau', tipo: 'bau-comum', nome: 'Baú', recompensa: { drops: [{ id: 3031, chance: 100 }] } }]);
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.match(ok.reiniciar, /Reinicie/);
  const depois = mapa();
  const { encontros, ...resto } = depois;
  const { encontros: _x, ...restoAntes } = antes;
  assert.deepEqual(resto, restoAntes, 'nada mais do mapa mudou');
  assert.equal(encontros.length, 2);
  assert.deepEqual(Modelo.validar(encontros, { largura: depois.width, altura: depois.height }), [], 'o que o editor grava é o que o jogo aceita');
  // Inválido: nada é gravado.
  const bytes = readFileSync(join(pasta, 'hunts', `${FASE}-map.json`), 'utf8');
  const ruim = Conteudo.salvarEncontros(FASE, [{ id: 'a', tipo: 'bau-comum', recompensa: { drops: [{ id: 3031, chance: 100 }], rolagens: 99 } }]);
  assert.equal(ruim.ok, false);
  assert.match(ruim.erros.join(' '), /rolagens/);
  assert.equal(readFileSync(join(pasta, 'hunts', `${FASE}-map.json`), 'utf8'), bytes, 'arquivo intacto');
  assert.equal(Conteudo.salvarEncontros(FASE, 'nao-e-lista').ok, false);
  // A visão geral e o resumo refletem o salvo.
  const f = Conteudo.carregarFase(FASE);
  assert.equal(f.resumo.obrigatorios, 1);
  assert.equal(f.resumo.bosses.principal, 1);
  assert.equal(f.resumo.baus, 1);
  assert.match(f.condicaoDeConclusao.join(' '), /Eliminar os monstros/);
  assert.match(f.condicaoDeConclusao.join(' '), /boss/);
  assert.equal(Conteudo.listarBosses().find((b) => b.id === BOSS.id).usos[0].encontro, 'chefe');
  // Em uso: não exclui.
  const exc = Conteudo.excluirBoss(BOSS.id);
  assert.equal(exc.ok, false);
  assert.match(exc.erros[0], /usado por/);
  // Vazio remove o bloco.
  assert.equal(Conteudo.salvarEncontros(FASE, []).ok, true);
  assert.equal('encontros' in mapa(), false);
  assert.equal(Conteudo.excluirBoss(MINI.id).ok, true, 'sem uso, exclui');
  assert.equal(Catalogo.bossUnico(MINI.id), null);
});

test('dados da fase (descrição, ambiente, conexões, requisitos): valida e grava em campanha-conteudo.json, sem tocar na campanha', () => {
  const campanhaAntes = readFileSync(new URL('campanha.json', REAL), 'utf8');
  const proxima = Campanha.FASES[1].huntId;
  copyFileSync(new URL(`hunts/${proxima}-map.json`, REAL), join(pasta, 'hunts', `${proxima}-map.json`));
  assert.deepEqual(Conteudo.salvarMeta(FASE, { descricao: 'Uma caverna escura.', ambiente: 'caverna', conexoes: [proxima], requisitos: { levelMin: 8 } }), { ok: true });
  const arq = JSON.parse(readFileSync(Conteudo.CAMINHOS.fases, 'utf8'));
  assert.equal(arq.fases[FASE].ambiente, 'caverna');
  assert.deepEqual(Conteudo.carregarFase(FASE).meta.conexoes, [proxima]);
  assert.deepEqual(Conteudo.carregarFase(proxima).conexoesDeEntrada, [FASE], 'a fase seguinte sabe de onde vem');
  assert.match(Conteudo.salvarMeta(FASE, { conexoes: ['nao-existe'] }).erros.join(' '), /não é uma fase/);
  assert.match(Conteudo.salvarMeta(FASE, { conexoes: [FASE] }).erros.join(' '), /a si mesma/);
  assert.match(Conteudo.salvarMeta(FASE, { requisitos: { levelMin: 0 } }).erros.join(' '), /levelMin/);
  assert.match(Conteudo.salvarMeta(FASE, { descricao: 'x'.repeat(601) }).erros.join(' '), /600/);
  assert.match(Conteudo.salvarMeta('nao-existe', {}).erros.join(' '), /desconhecida/);
  assert.equal(readFileSync(new URL('campanha.json', REAL), 'utf8'), campanhaAntes, 'a campanha não foi tocada');
  assert.deepEqual(Conteudo.salvarMeta(FASE, {}), { ok: true });
  assert.equal(JSON.parse(readFileSync(Conteudo.CAMINHOS.fases, 'utf8')).fases[FASE], undefined, 'meta vazia remove a entrada');
});

test('rotas HTTP: só sob /api/mapas/_conteudo (o prefixo que o nginx tranca), com o corpo validado pelo servidor', async () => {
  const chamar = async (metodo, caminho, corpo) => {
    const resposta = { status: null, corpo: null };
    const res = { writeHead: (s) => (resposta.status = s), end: (t) => (resposta.corpo = t) };
    const json = (r, status, c) => {
      resposta.status = status;
      resposta.corpo = c;
    };
    const url = new URL(caminho, 'http://x');
    const atendeu = await Http.atender({ method: metodo }, res, url.pathname, url, { json, corpoJson: async () => corpo });
    return { atendeu, ...resposta };
  };
  assert.equal((await chamar('GET', '/api/mapas/troll-cave')).atendeu, false, 'rotas de mapa não são do editor de conteúdo');
  assert.equal((await chamar('GET', '/api/conteudo/fases')).atendeu, false, 'fora do prefixo trancado, nada é atendido');
  const fases = await chamar('GET', '/api/mapas/_conteudo/fases');
  assert.equal(fases.status, 200);
  assert.equal(fases.corpo.fases.length, 48);
  assert.equal((await chamar('GET', '/api/mapas/_conteudo/fase/nao-existe')).status, 404);
  const v = await chamar('POST', '/api/mapas/_conteudo/fase/troll-cave/validar', { encontros: [{ id: 'a', tipo: 'bau-comum', recompensa: { drops: [{ id: 3031, chance: 100 }], rolagens: 99 } }] });
  assert.match(v.corpo.erros.join(' '), /rolagens/);
  const bv = await chamar('POST', '/api/mapas/_conteudo/bosses/validar', { id: 'x', nome: 'x', categoria: 'rei', base: 'cyclops' });
  assert.match(bv.corpo.erros.join(' '), /categoria/);
  assert.equal((await chamar('GET', '/api/mapas/_conteudo/itens?q=gold%20coin')).corpo.itens.some((i) => i.id === 3031), true);
  assert.equal((await chamar('DELETE', '/api/mapas/_conteudo/bosses')).status, 404);
  assert.equal(existsSync(Conteudo.CAMINHOS.bosses), true);
});

test('o editor roda sobre o jogo de verdade: encontros salvos pelo editor entram numa instância e funcionam', async () => {
  const { boa, z } = casas();
  assert.equal(Conteudo.salvarEncontros(FASE, [{ id: 'bau', tipo: 'bau-comum', nome: 'Baú do Editor', recompensa: { drops: [{ id: 3031, chance: 100 }] }, x: boa[0], y: boa[1], z }]).ok, true);
  const salvo = mapa();
  const Estado = await import('../systems/encontros/estado.mjs');
  const inst = Estado.criar({}, Modelo.encontrosDoMapa(salvo), { semente: 4 });
  assert.equal(inst.encontros.bau.estado, 'disponivel');
  assert.equal(inst.encontros.bau.nome, 'Baú do Editor');
});

test('o índice do WORLD: salvar encontros o grava em campanha-conteudo.json (boss principal, obrigatórios, todos); salvar dados da fase o preserva; ficar desatualizado vira aviso', () => {
  const { boa, z } = casas();
  criados.push('principal-do-mundo');
  assert.equal(Conteudo.salvarBoss({ ...BOSS, id: 'principal-do-mundo', nome: 'Rei do Mundo' }).ok, true);
  const r = Conteudo.salvarEncontros(FASE, [
    { id: 'rei', tipo: 'boss', nome: 'Rei', bossId: 'principal-do-mundo', obrigatorio: true, x: boa[0], y: boa[1], z },
    { id: 'segredo', tipo: 'bau-comum', nome: 'Baú Secreto', probabilidade: 5, recompensa: { drops: [{ id: 3031, chance: 100 }] } },
  ]);
  assert.equal(r.ok, true, JSON.stringify(r));
  const indice = JSON.parse(readFileSync(Conteudo.CAMINHOS.fases, 'utf8')).fases[FASE].mundo;
  assert.deepEqual(indice.bossPrincipal, { bossId: 'principal-do-mundo', nome: 'Rei do Mundo' });
  assert.deepEqual(indice.obrigatorios, [{ id: 'rei', nome: 'Rei', tipo: 'boss' }]);
  assert.equal(indice.todos.length, 2, 'o índice leva todos, para o servidor dar nome ao que o jogador achar');
  // Salvar os dados da fase não apaga o índice.
  assert.equal(Conteudo.salvarMeta(FASE, { descricao: 'Mundo.' }).ok, true);
  assert.ok(JSON.parse(readFileSync(Conteudo.CAMINHOS.fases, 'utf8')).fases[FASE].mundo, 'o índice continua');
  assert.equal(Conteudo.carregarFase(FASE).meta.mundo, undefined, 'e não aparece como dado editável');
  assert.equal(Conteudo.auditar().problemas.some((p) => /índice da tela WORLD/.test(p.mensagem)), false, 'em dia');
  // O boss foi renomeado: o índice guardou o nome antigo → aviso para salvar de novo.
  assert.equal(Conteudo.salvarBoss({ ...BOSS, id: 'principal-do-mundo', nome: 'Rei Renomeado' }).ok, true);
  assert.equal(Conteudo.auditar().problemas.some((p) => /índice da tela WORLD está desatualizado/.test(p.mensagem)), true);
  // Lista vazia remove o índice (e a entrada, se ficou vazia).
  assert.equal(Conteudo.salvarEncontros(FASE, []).ok, true);
  assert.equal(JSON.parse(readFileSync(Conteudo.CAMINHOS.fases, 'utf8')).fases[FASE].mundo, undefined);
  Conteudo.excluirBoss('principal-do-mundo');
});

test('requisitos "exige": só fases ANTERIORES e abertas (senão fecharia ciclo com a cadeia do ato)', () => {
  const [a, b, c] = Campanha.FASES;
  assert.deepEqual(Conteudo.validarMeta(c.huntId, { requisitos: { exige: [a.huntId] } }), []);
  assert.match(Conteudo.validarMeta(a.huntId, { requisitos: { exige: [c.huntId] } }).join(' '), /vem depois/);
  assert.match(Conteudo.validarMeta(b.huntId, { requisitos: { exige: [b.huntId] } }).join(' '), /vem depois/);
  assert.match(Conteudo.validarMeta(c.huntId, { requisitos: { exige: ['nao-existe'] } }).join(' '), /não é uma fase/);
  const travada = Campanha.FASES.find((f) => f.pular);
  if (travada) assert.match(Conteudo.validarMeta(Campanha.FASES.at(-1).huntId, { requisitos: { exige: [travada.huntId] } }).join(' '), /travada/);
});
