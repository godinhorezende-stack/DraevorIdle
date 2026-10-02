// Etapa 1 dos encontros: modelo, sorteio por instância (com semente), estados, idempotência, objetivos da fase
// (obrigatório trava o CLEAR, opcional não), idle/offline e persistência. Tipos de teste registrados aqui —
// os tipos reais chegam nas etapas 2 e 3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Modelo from '../systems/encontros/modelo.mjs';
import * as Sorteio from '../systems/encontros/sorteio.mjs';
import * as Estado from '../systems/encontros/estado.mjs';
import * as Entrega from '../systems/encontros/entrega.mjs';
import { registrarTipo, TIPOS } from '../systems/encontros/tipos.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Instancia from '../systems/hunt/instancia.mjs';
import * as Campanha from '../systems/campanha.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

// Um tipo de teste que o idle resolve sozinho, e um que é decisão do jogador (só opcional).
registrarTipo('t-auto', { idle: 'auto', resolverNoIdle: ({ instancia, encontro, agora }) => Estado.concluir(instancia, encontro.id, { agora }) });
registrarTipo('t-escolha', { idle: 'escolha' });
registrarTipo('t-combate', { idle: 'combate' });

const def = (o) => Modelo.normalizar({ id: 'e1', tipo: 't-auto', ...o });

test('validação: o que é aceito e o que é recusado (com mensagem)', () => {
  assert.deepEqual(Modelo.validar([{ id: 'a', tipo: 't-auto' }, { id: 'b', tipo: 't-combate', probabilidade: 20, condicao: { tipo: 'monstros-limpos' } }]), []);
  const erros = (lista, g) => Modelo.validar(lista, g).join(' | ');
  assert.match(erros([{ id: 'a', tipo: 'nao-existe' }]), /desconhecido/);
  assert.match(erros([{ id: 'a', tipo: 'fenda' }]), /ainda não está disponível/);
  assert.deepEqual(Modelo.validar([{ id: 'a', tipo: 'fenda', ativo: false }]), [], 'desligado pode ficar em obra');
  assert.match(erros([{ id: 'a', tipo: 't-auto', probabilidade: 120 }]), /entre 0 e 100/);
  assert.match(erros([{ id: 'a', tipo: 't-auto', quantidade: 0 }]), /quantidade/);
  assert.match(erros([{ id: 'a', tipo: 't-auto' }, { id: 'a', tipo: 't-auto' }]), /id repetido/);
  assert.match(erros([{ id: 'a', tipo: 't-auto', x: 99, y: 1 }], { largura: 10, altura: 10 }), /fora da grade/);
  assert.match(erros([{ id: 'a', tipo: 't-auto', condicao: { tipo: 'chuva' } }]), /condição/);
  assert.match(erros([{ id: 'a', tipo: 't-auto', condicao: { tipo: 'apos-encontro', encontro: 'zzz' } }]), /não existe/);
  assert.match(erros([{ id: 'a', tipo: 't-auto', condicao: { tipo: 'apos-encontro', encontro: 'b' } }, { id: 'b', tipo: 't-auto', condicao: { tipo: 'apos-encontro', encontro: 'a' } }]), /circular/);
  // Obrigatório: 100%, sem expirar, sem decisão do jogador, uma vez, e sem depender de quem pode não aparecer.
  assert.match(erros([{ id: 'a', tipo: 't-auto', obrigatorio: true, probabilidade: 50 }]), /probabilidade 100/);
  assert.match(erros([{ id: 'a', tipo: 't-auto', obrigatorio: true, expiraMs: 1000 }]), /não expira/);
  assert.match(erros([{ id: 'a', tipo: 't-escolha', obrigatorio: true }]), /só pode ser opcional/);
  assert.match(erros([{ id: 'a', tipo: 't-auto', obrigatorio: true, quantidade: 2 }]), /uma vez só/);
  assert.match(erros([{ id: 'a', tipo: 't-auto', probabilidade: 30 }, { id: 'b', tipo: 't-auto', obrigatorio: true, condicao: { tipo: 'apos-encontro', encontro: 'a' } }]), /pode não existir/);
});

test('os tipos planejados ainda NÃO são utilizáveis em mapa (conteúdo pela metade nunca chega a uma instância)', () => {
  // Os de boss chegaram na etapa 2 e os baús/altar na 3; só a v2 segue fora.
  for (const [nome, t] of Object.entries(TIPOS)) if (!nome.startsWith('t-') && !['boss', 'miniboss', 'boss-secreto', 'bau-comum', 'bau-raro', 'bau-amaldicoado', 'altar'].includes(nome)) assert.equal(t.implementado, false, nome);
  assert.throws(() => registrarTipo('t-sem-gancho', { idle: 'auto' }), /resolverNoIdle/);
});

test('sorteio: determinístico pela semente, 100% sempre, 0% nunca, e a proporção bate com a probabilidade', () => {
  assert.equal(Sorteio.rolar(123, 'x'), Sorteio.rolar(123, 'x'));
  assert.notEqual(Sorteio.rolar(123, 'x'), Sorteio.rolar(124, 'x'));
  let sempre = 0, nunca = 0, vinte = 0;
  const N = 20000;
  for (let s = 0; s < N; s++) {
    if (Sorteio.aparece(s, 'a', 100)) sempre++;
    if (Sorteio.aparece(s, 'a', 0)) nunca++;
    if (Sorteio.aparece(s, 'miniboss', 20)) vinte++;
  }
  assert.equal(sempre, N);
  assert.equal(nunca, 0);
  assert.ok(Math.abs(vinte / N - 0.2) < 0.01, `20% → ${(vinte / N * 100).toFixed(2)}%`);
  // Cada encontro tem o seu sorteio: o de um não depende da existência do outro.
  for (let s = 0; s < 200; s++) assert.equal(Sorteio.aparece(s, 'secreto', 5), Sorteio.aparece(s, 'secreto', 5));
});

test('o sorteio vale UMA vez por instância: criar de novo com a semente dá o mesmo; gravar e carregar não re-rola', () => {
  const defs = [def({ id: 'mini', probabilidade: 20 }), def({ id: 'segredo', probabilidade: 5 }), def({ id: 'baus', quantidade: 5, probabilidade: 50 })];
  for (let semente = 1; semente < 50; semente++) {
    const a = Estado.criar({}, defs, { semente });
    const b = Estado.criar({}, defs, { semente });
    assert.deepEqual(a, b, `semente ${semente}`);
    const volta = JSON.parse(JSON.stringify(a)); // o banco
    assert.deepEqual(volta.encontros, a.encontros);
    assert.deepEqual(volta.ausentes, a.ausentes);
  }
  // A quantidade expande em slots independentes (baus#1..#5), cada um sorteado à parte.
  const i = Estado.criar({}, [def({ id: 'baus', quantidade: 5, probabilidade: 50 })], { semente: 7 });
  assert.equal(Object.keys(i.encontros).length + i.ausentes.length, 5);
  assert.ok(Object.keys(i.encontros).every((k) => k.startsWith('baus#')));
});

test('desligado (ativo:false) nunca entra; sem definições, a instância fica como era', () => {
  const i = Estado.criar({}, [def({ ativo: false })], { semente: 1 });
  assert.deepEqual(i.encontros, {});
  assert.equal(Estado.obrigatoriosPendentes(i), 0);
  assert.deepEqual(Estado.criar({ objetivos: { total: 3 } }, [], { semente: 1 }).objetivos, { total: 3 });
});

test('estados: ativar uma vez só (clique duplo/dois jogadores), concluir uma vez só, transições inválidas negadas', () => {
  const i = Estado.criar({}, [def({ id: 'b' })], { semente: 1 });
  assert.equal(i.encontros.b.estado, 'disponivel');
  assert.deepEqual(Estado.concluir(i, 'b'), { ok: false, motivo: 'indisponivel:disponivel' }, 'não conclui sem ativar');
  assert.equal(Estado.ativar(i, 'b', { quem: 'ana' }).ok, true);
  assert.deepEqual(Estado.ativar(i, 'b', { quem: 'beto' }), { ok: false, motivo: 'ja-ativo' }, 'o segundo comando não faz nada');
  assert.equal(i.encontros.b.ativadoPor, 'ana');
  assert.equal(Estado.concluir(i, 'b').ok, true);
  assert.deepEqual(Estado.concluir(i, 'b'), { ok: false, motivo: 'ja-concluido' });
  assert.deepEqual(Estado.ativar(i, 'b'), { ok: false, motivo: 'ja-concluido' });
  assert.deepEqual(Estado.ativar(i, 'nao-existe'), { ok: false, motivo: 'nao-existe' });
});

test('falha e cancelamento: o obrigatório volta a poder ser tentado; o opcional termina; cancelar não conta tentativa', () => {
  const i = Estado.criar({}, [def({ id: 'obr', obrigatorio: true }), def({ id: 'opc' })], { semente: 1 });
  Estado.ativar(i, 'obr');
  assert.equal(Estado.falhar(i, 'obr').terminou, false);
  assert.deepEqual([i.encontros.obr.estado, i.encontros.obr.tentativas], ['disponivel', 1]);
  Estado.ativar(i, 'obr');
  Estado.cancelar(i, 'obr');
  assert.deepEqual([i.encontros.obr.estado, i.encontros.obr.tentativas], ['disponivel', 1], 'cancelar não gasta tentativa');
  Estado.ativar(i, 'opc');
  assert.equal(Estado.falhar(i, 'opc').terminou, true);
  assert.equal(i.encontros.opc.estado, 'falhou');
  assert.deepEqual(Estado.ativar(i, 'opc'), { ok: false, motivo: 'indisponivel:falhou' }, 'terminal');
  assert.equal(Estado.obrigatoriosPendentes(i), 1);
});

test('condições: monstros-limpos e apos-encontro liberam na hora certa; quem depende de um que não saiu não existe', () => {
  const defs = [
    def({ id: 'a' }),
    def({ id: 'b', condicao: { tipo: 'apos-encontro', encontro: 'a' } }),
    def({ id: 'c', condicao: { tipo: 'monstros-limpos' } }),
  ];
  const i = Estado.criar({}, defs, { semente: 3 });
  assert.deepEqual(['a', 'b', 'c'].map((k) => i.encontros[k].estado), ['disponivel', 'dormindo', 'dormindo']);
  Estado.avaliar(i, { monstrosLimpos: false });
  assert.equal(i.encontros.c.estado, 'dormindo');
  Estado.avaliar(i, { monstrosLimpos: true });
  assert.equal(i.encontros.c.estado, 'disponivel');
  assert.equal(i.encontros.b.estado, 'dormindo', 'b espera o a');
  Estado.ativar(i, 'a');
  Estado.concluir(i, 'a');
  Estado.avaliar(i, {});
  assert.equal(i.encontros.b.estado, 'disponivel');
  // O a não saiu (0%): o b, que depende dele, também não existe nesta instância.
  const j = Estado.criar({}, [def({ id: 'a', probabilidade: 0 }), def({ id: 'b', condicao: { tipo: 'apos-encontro', encontro: 'a' } })], { semente: 3 });
  assert.deepEqual(j.encontros, {});
  assert.deepEqual(j.ausentes.sort(), ['a', 'b']);
});

test('expiração: opcional disponível sem ninguém expira; ativo não; obrigatório nunca', () => {
  const i = Estado.criar({}, [def({ id: 'op', expiraMs: 1000 }), def({ id: 'ativo', expiraMs: 1000 })], { semente: 1, agora: 100 });
  Estado.ativar(i, 'ativo', { agora: 200 });
  Estado.avaliar(i, { agora: 1099 });
  assert.equal(i.encontros.op.estado, 'disponivel');
  Estado.avaliar(i, { agora: 1100 });
  assert.equal(i.encontros.op.estado, 'expirado');
  assert.equal(i.encontros.ativo.estado, 'ativo');
  const o = Estado.criar({}, [{ ...def({ id: 'o', obrigatorio: true }), expiraMs: 10 }], { semente: 1, agora: 0 });
  Estado.avaliar(o, { agora: 99999 });
  assert.equal(o.encontros.o.estado, 'disponivel', 'obrigatório não expira');
});

test('recompensa única: a mesma entrega pedida várias vezes (reconexão, dois membros) vale UMA; primeira conclusão ≠ repetição', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  assert.equal(Entrega.reivindicar(e, 'inst-1', 'bau').ok, true);
  for (let k = 0; k < 5; k++) assert.deepEqual(Entrega.reivindicar(e, 'inst-1', 'bau'), { ok: false, motivo: 'ja-entregue' });
  assert.equal(Entrega.reivindicar(e, 'inst-2', 'bau').ok, true, 'outra instância, outra recompensa');
  assert.equal(Entrega.registrarConclusao(e, 'troll-cave', 'bau').primeira, true);
  assert.equal(Entrega.registrarConclusao(e, 'troll-cave', 'bau').primeira, false);
  assert.equal(Entrega.vezesConcluido(e, 'troll-cave', 'bau'), 2);
  const depois = JSON.parse(JSON.stringify(e));
  assert.deepEqual(Entrega.reivindicar(depois, 'inst-1', 'bau'), { ok: false, motivo: 'ja-entregue' }, 'sobrevive a gravar e carregar');
  for (let k = 0; k < 400; k++) Entrega.reivindicar(e, `i${k}`, 'x', k);
  assert.ok(Object.keys(e.encontros.entregues).length <= 300, 'o registro não cresce sem limite');
});

/** Uma caçada real da campanha, com os encontros pendurados na instância e todos os bichos mortos. */
function fase(defs, { modo = 'auto' } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  const r = Cacadas.entrar(e, { huntId: 'troll-cave', mode: modo, strategy: 'nearest', dificuldade: 'facil' });
  assert.equal(r.ok, true);
  assert.ok(e.hunt.instancia, 'a fase tem instância');
  Estado.criar(e.hunt.instancia, defs.map((d) => Modelo.normalizar(d)), { semente: 11 });
  return e;
}
const matarTodos = (e) => {
  e.hunt.monstros.length = 0;
  for (const z of Object.keys(e.hunt.outrosAndares ?? {})) e.hunt.outrosAndares[z].length = 0;
};

test('fase: encontro OBRIGATÓRIO trava o CLEAR mesmo com os bichos mortos; concluído, libera (e só uma vez)', () => {
  const e = fase([{ id: 'guardiao', tipo: 't-combate', obrigatorio: true }], { modo: 'online' });
  matarTodos(e);
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 1000), false, 'bichos mortos, mas falta o obrigatório');
  assert.equal(e.hunt.instancia.status, 'ativa');
  Estado.ativar(e.hunt.instancia, 'guardiao');
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 1100), false, 'ativo ainda não é concluído');
  Estado.concluir(e.hunt.instancia, 'guardiao');
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 1200), true);
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 1300), false, 'o CLEAR conta uma vez');
});

test('fase: encontro OPCIONAL (baú, boss secreto...) nunca bloqueia a conclusão', () => {
  const e = fase([{ id: 'segredo', tipo: 't-combate', probabilidade: 100 }, { id: 'bau', tipo: 't-escolha' }], { modo: 'online' });
  matarTodos(e);
  assert.equal(Estado.obrigatoriosPendentes(e.hunt.instancia), 0);
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 1000), true);
});

test('idle: na Caça Automática o idle ativa e resolve sozinho — um obrigatório nunca deixa o personagem preso', () => {
  const e = fase([{ id: 'altar', tipo: 't-auto', obrigatorio: true }, { id: 'esperaA', tipo: 't-auto', obrigatorio: true, condicao: { tipo: 'monstros-limpos' } }]);
  matarTodos(e);
  // Passo 1: libera o que espera os bichos, ativa e resolve (o `t-auto` conclui no idle).
  const limpou = Instancia.marcarSeLimpou(e.hunt, 1000);
  const resumo = Estado.resumo(e.hunt.instancia);
  assert.ok(limpou || resumo.obrigatoriosPendentes === 0, JSON.stringify(resumo));
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 1100) || e.hunt.instancia.status === 'limpa', true);
  assert.equal(e.hunt.instancia.encontros.altar.estado, 'concluido');
  assert.equal(e.hunt.instancia.encontros.esperaA.estado, 'concluido');
  assert.equal(e.hunt.instancia.encontros.altar.ativadoPor, 'idle');
});

test('idle: decisão do jogador não é ativada pelo idle; opcional expira, e obrigatório desse tipo nem é aceito pelo validador', () => {
  const e = fase([{ id: 'decide', tipo: 't-escolha', expiraMs: 500 }]);
  matarTodos(e);
  Instancia.marcarSeLimpou(e.hunt, 0);
  assert.equal(e.hunt.instancia.encontros.decide.estado, 'disponivel');
  Instancia.marcarSeLimpou(e.hunt, 400);
  assert.equal(e.hunt.instancia.encontros.decide.estado, 'disponivel');
  const j = fase([{ id: 'decide', tipo: 't-escolha', expiraMs: 500 }, { id: 'x', tipo: 't-auto' }]);
  Estado.avaliar(j.hunt.instancia, { agora: 10_000 });
  assert.equal(j.hunt.instancia.encontros.decide.estado, 'expirado');
});

test('offline projetado: instância zerada resolve os pendentes (obrigatórios sem recompensa, opcionais expiram)', () => {
  const i = Estado.criar({}, [def({ id: 'o', obrigatorio: true }), def({ id: 'p' })], { semente: 2 });
  assert.equal(Estado.resolverNaProjecao(i, { agora: 5 }), 2);
  assert.deepEqual([i.encontros.o.estado, i.encontros.o.viaProjecao, i.encontros.p.estado], ['concluido', true, 'expirado']);
  assert.equal(Estado.obrigatoriosPendentes(i), 0);
});

test('persistência: a caçada com a instância e os encontros sobrevive a gravar e carregar, sem re-sortear', () => {
  const e = fase([{ id: 'mini', tipo: 't-combate', probabilidade: 50 }, { id: 'a', tipo: 't-auto' }], { modo: 'online' });
  Estado.ativar(e.hunt.instancia, 'a');
  const antes = JSON.parse(JSON.stringify(e.hunt.instancia));
  const volta = JSON.parse(JSON.stringify({ ...e, hunt: Cacadas.huntParaGravar(e.hunt) }));
  Cacadas.huntAoCarregar(volta.hunt);
  assert.deepEqual(volta.hunt.instancia, antes);
  assert.equal(volta.hunt.instancia.encontros.a.estado, 'ativo');
  assert.equal(volta.hunt.instancia.semente, 11);
});

test('integridade: todo mapa do jogo que declara `encontros` passa na validação (hoje nenhum declara)', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const pasta = new URL('../gamedata/hunts/', import.meta.url);
  let comEncontros = 0;
  for (const nome of readdirSync(pasta).filter((n) => n.endsWith('-map.json'))) {
    const mapa = JSON.parse(readFileSync(new URL(nome, pasta), 'utf8'));
    if (!mapa.encontros) continue;
    comEncontros++;
    assert.deepEqual(Modelo.validar(mapa.encontros, { largura: mapa.width, altura: mapa.height }), [], nome);
  }
  assert.equal(comEncontros, 0, 'produção segue sem encontros até as etapas 2 e 3');
});

test('compatibilidade: a campanha sem encontros se comporta como sempre (CLEAR só pelos bichos)', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto', strategy: 'nearest', dificuldade: 'facil' }).ok, true);
  assert.equal(e.hunt.instancia.encontros, undefined, 'mapa sem bloco encontros: nada é criado');
  matarTodos(e);
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 1), true);
  assert.ok(Campanha.faseDe('troll-cave'));
  assert.ok(PERSONAGEM);
});
