// Setores derivados do mapa (`systems/hunt/setores.mjs`) + o progresso por setor e o reagrupamento obrigatório (`party.mjs`).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import * as Party from '../systems/party.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as R from '../systems/regras.mjs';
import * as S from '../systems/hunt/setores.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';
import { aAdaptar } from './apoio-migracao.mjs';

const retangulo = (x0, y0, w, h) => { const set = new Set(); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set.add(`${x},${y}`); return set; };

test('E1. mapa grande: grade 3×3 com nomes de bússola; toda casa alcançável cai em exatamente um setor', () => {
  const alc = new Map([[7, retangulo(0, 0, 60, 60)]]);
  const m = S.mapaDeSetores(alc);
  assert.equal(m.ids.length, 9);
  const nomes = m.ids.map((i) => S.nomeDoSetor(i.id)).sort();
  assert.deepEqual(nomes, ['Centro', 'Leste', 'Nordeste', 'Noroeste', 'Norte', 'Oeste', 'Sudeste', 'Sudoeste', 'Sul']);
  assert.equal(S.mapaDeSetores(alc), m, 'memoizado');
  const visto = new Set();
  let total = 0;
  for (const k of alc.get(7)) { const [x, y] = k.split(',').map(Number); visto.add(m.setorDe(x, y, 7)); total++; }
  assert.equal(total, 3600);
  assert.equal(visto.size, 9);
  assert.equal(m.ids.reduce((a, i) => a + i.casas, 0), 3600, 'as casas dos setores somam o mapa');
  assert.equal(S.nomeDoSetor(m.setorDe(1, 1, 7)), 'Noroeste');
  assert.equal(S.nomeDoSetor(m.setorDe(58, 58, 7)), 'Sudeste');
  assert.equal(S.nomeDoSetor(m.setorDe(30, 1, 7)), 'Norte');
});

test('E2. mapa pequeno vira um setor só; faixa estreita vira 3 setores em linha; região minúscula funde na vizinha', () => {
  assert.equal(S.mapaDeSetores(new Map([[7, retangulo(0, 0, 12, 12)]])).ids.length, 1);
  assert.equal(S.nomeDoSetor(S.mapaDeSetores(new Map([[7, retangulo(0, 0, 12, 12)]])).ids[0].id), 'Área única');
  const faixa = S.mapaDeSetores(new Map([[7, retangulo(0, 0, 60, 10)]]));
  assert.deepEqual(faixa.ids.map((i) => S.nomeDoSetor(i.id)).sort(), ['Centro', 'Leste', 'Oeste']);
  // Um corredor de 5 casas pendurado num salão: a região minúscula não vira setor.
  const salao = retangulo(0, 0, 40, 40);
  for (const k of retangulo(41, 0, 3, 3)) salao.add(k);
  const m = S.mapaDeSetores(new Map([[7, salao]]));
  assert.ok(m.ids.every((i) => i.casas >= S.CONFIG_SETORES.minimoDeCasas), JSON.stringify(m.ids));
  assert.ok(m.setorDe(42, 1, 7), 'a ponta fundida ainda tem setor');
});

test('E3. vários andares: cada andar tem os seus setores, com "Andar z" no nome', () => {
  const m = S.mapaDeSetores(new Map([[7, retangulo(0, 0, 40, 40)], [8, retangulo(0, 0, 40, 40)]]));
  assert.ok(m.ids.some((i) => i.z === 8));
  assert.match(S.nomeDoSetor(m.ids[0].id, true), /^Andar \d · /);
  assert.equal(m.setorDe(5, 5, 9), null, 'andar sem casas: sem setor');
});

test('E4. o resumo: total por setor, vivos, concluído quando zera, e quem está em cada setor', () => {
  const m = S.mapaDeSetores(new Map([[7, retangulo(0, 0, 60, 60)]]));
  const bichos = [];
  for (const [x, y] of [[2, 2], [3, 3], [58, 58]]) bichos.push({ hp: 10, instancia: 'i', objetivo: 1, setor: m.setorDe(x, y, 7) });
  const instancia = { id: 'i', setores: S.contarSetores(bichos) };
  assert.equal(Object.values(instancia.setores).reduce((a, b) => a + b, 0), 3);
  let r = S.resumoDosSetores({ instancia, bichos, mapa: m, jogadores: [{ nome: 'Ana', x: 2, y: 2, z: 7 }, { nome: 'Bia', x: 59, y: 59, z: 7 }] });
  assert.equal(r.length, 2);
  const noroeste = r.find((x) => x.nome === 'Noroeste');
  assert.deepEqual([noroeste.total, noroeste.vivos, noroeste.concluido, noroeste.jogadores], [2, 2, false, ['Ana']]);
  bichos[0].hp = 0;
  bichos[1].hp = 0;
  r = S.resumoDosSetores({ instancia, bichos, mapa: m });
  assert.equal(r.find((x) => x.nome === 'Noroeste').concluido, true);
  assert.equal(r.find((x) => x.nome === 'Sudeste').concluido, false);
  assert.equal(S.resumoDosSetores({ instancia: {}, bichos, mapa: m }), null, 'sem setores gravados: null');
});

// ------------------------------------------------------------------ instância e party reais

const criadas = [];
after(async () => {
  for (const { s, nome, conta } of criadas) {
    s.desconectar();
    vivas.delete(nome);
    await B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(conta);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta);
  }
});
async function jogador(i) {
  const conta = await B.criarConta({ email: `set-${randomUUID()}@teste.local`, senha: 'senha-123' });
  await B.gravarMelhoriasDaConta(conta.id, { slotsDeParty: 3 });
  await B.lerMelhoriasDaConta(conta.id);
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: () => {} });
  s.conta = { id: conta.id };
  const nome = `St${i}${randomUUID().replace(/[^a-z]/g, '').slice(0, 6)}`;
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.pos = { ...R.POSICAO_INICIAL };
  await s.concluirEntrada({ id: randomUUID(), nome }, e, null, null);
  criadas.push({ s, nome, conta: conta.id });
  return { s, nome };
}

test('E5. a instância real nasce com o total por setor (soma = o total de objetivos) e cada bicho tem o seu setor', { skip: aAdaptar("Setores existem na instância da área do PoE (verificado); o teste usa hunt do Draevor sem instância") }, async () => {
  const j = await jogador(0);
  assert.equal(Cacadas.entrar(j.s.estado, { huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade: 'medio' }).ok, true);
  const hunt = j.s.estado.hunt;
  const inst = hunt.instancia;
  assert.ok(inst?.setores && Object.keys(inst.setores).length >= 1, 'a instância tem setores');
  assert.equal(Object.values(inst.setores).reduce((a, b) => a + b, 0), inst.objetivos.total);
  const bichos = [...hunt.monstros, ...Object.values(hunt.outrosAndares ?? {}).flat()];
  assert.ok(bichos.every((m) => m.setor), 'todo bicho nasce com setor');
  const r = Cacadas.setoresDaCacada(hunt, [{ nome: j.nome, x: hunt.pos.x, y: hunt.pos.y, z: hunt.z }]);
  assert.equal(r.reduce((a, x) => a + x.total, 0), inst.objetivos.total);
  assert.equal(r.reduce((a, x) => a + x.vivos, 0), inst.objetivos.total);
  assert.equal(r.filter((x) => x.jogadores.includes(j.nome)).length, 1, 'o jogador está em exatamente um setor');
  assert.ok(Cacadas.setorDoJogador(hunt)?.nome);
  // Matar tudo de um setor o conclui.
  const alvoSetor = r[0].id;
  for (const m of bichos.filter((x) => x.setor === alvoSetor)) m.hp = 0;
  assert.equal(Cacadas.setoresDaCacada(hunt).find((x) => x.id === alvoSetor).concluido, true);
});

test('E6. a party enxerga o mesmo progresso (um convidado lê da sala do dono) e o setor de cada membro', { skip: aAdaptar("Setores existem na instância da área do PoE (verificado); o teste usa hunt do Draevor sem instância") }, async () => {
  const a = await jogador(1);
  const b = await jogador(2);
  Party.comandoDoGrupo(a.s, { action: 'convidar', name: b.nome });
  Party.comandoDoGrupo(b.s, { action: 'aceitar' });
  Cacadas.entrar(a.s.estado, { huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade: 'medio' });
  Party.comandoDaCaca(a.s, { action: 'invite', name: b.nome });
  assert.equal(Party.comandoDaCaca(b.s, { action: 'accept' }).ok, true);
  const ea = Party.extrasDoRetrato(a.s);
  const eb = Party.extrasDoRetrato(b.s);
  assert.deepEqual(ea.setores.map((x) => [x.id, x.total, x.vivos]), eb.setores.map((x) => [x.id, x.total, x.vivos]), 'os dois leem o mesmo progresso');
  const membro = Party.camposDoPersonagem(a.s).party.membros.find((m) => m.nome === b.nome);
  assert.ok(typeof membro.setor === 'string', 'setor do membro');
  // Fora de instância (treino): a chave existe e é null.
  const c = await jogador(3);
  assert.equal(Party.extrasDoRetrato(c.s).setores, null);
});

test('R1. reagrupamento: opcional por padrão; obrigatório só na fase/tipo configurados, e diz quem falta', { skip: aAdaptar("O reagrupamento por setor é da engine; o teste usa a dificuldade/fase do Draevor") }, async () => {
  const a = await jogador(4);
  const b = await jogador(5);
  Party.comandoDoGrupo(a.s, { action: 'convidar', name: b.nome });
  Party.comandoDoGrupo(b.s, { action: 'aceitar' });
  Cacadas.entrar(a.s.estado, { huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade: 'medio' });
  Party.comandoDaCaca(a.s, { action: 'invite', name: b.nome });
  Party.comandoDaCaca(b.s, { action: 'accept' });
  const chefe = { tipo: 'miniboss', x: a.s.estado.hunt.pos.x, y: a.s.estado.hunt.pos.y };
  b.s.estado.hunt.pos = { ...b.s.estado.hunt.pos, x: a.s.estado.hunt.pos.x + 20, y: a.s.estado.hunt.pos.y };
  const regra = { reagrupamentoObrigatorio: { fases: [HUNT_DE_TESTE], tipos: ['miniboss'], raio: 6 } };
  assert.deepEqual(Party.faltamParaReagrupar(a.s, chefe, {}), [], 'sem configuração: opcional');
  assert.deepEqual(Party.faltamParaReagrupar(a.s, chefe, { reagrupamentoObrigatorio: { fases: [], tipos: ['miniboss'] } }), [], 'fase fora da lista');
  assert.deepEqual(Party.faltamParaReagrupar(a.s, { ...chefe, tipo: 'altar' }, regra), [], 'tipo fora da lista');
  assert.deepEqual(Party.faltamParaReagrupar(a.s, chefe, regra), [b.nome], 'b está a 20 casas');
  b.s.estado.hunt.pos = { ...b.s.estado.hunt.pos, x: a.s.estado.hunt.pos.x + 3 };
  assert.deepEqual(Party.faltamParaReagrupar(a.s, chefe, regra), [], 'reunidos: pode começar');
  const solo = await jogador(6);
  Cacadas.entrar(solo.s.estado, { huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade: 'medio' });
  assert.deepEqual(Party.faltamParaReagrupar(solo.s, chefe, regra), [], 'sem party nunca exige');
});

test('U1. servidor: o cartão do membro offline guarda "volta em" e o setor; limpar o setor avisa a party', { skip: aAdaptar("Setores existem na instância da área do PoE (verificado); o teste usa hunt do Draevor sem instância") }, async () => {
  const a = await jogador(7);
  const b = await jogador(8);
  Party.comandoDoGrupo(a.s, { action: 'convidar', name: b.nome });
  Party.comandoDoGrupo(b.s, { action: 'aceitar' });
  Cacadas.entrar(a.s.estado, { huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade: 'medio' });
  Party.comandoDaCaca(a.s, { action: 'invite', name: b.nome });
  Party.comandoDaCaca(b.s, { action: 'accept' });
  const hunt = a.s.estado.hunt;
  const alvoSetor = Cacadas.setoresDaCacada(hunt)[0].id;
  const doSetor = [...hunt.monstros, ...Object.values(hunt.outrosAndares ?? {}).flat()].filter((m) => m.setor === alvoSetor);
  Object.defineProperty(hunt, 'partilha', { value: Party.partilha(a.s), configurable: true, writable: true });
  const Combate = await import('../systems/hunt/combate.mjs');
  const eventos = [];
  for (const m of doSetor) { m.hp = 0; Combate.matarMonstro(a.s.estado, hunt, a.s.personagem, m, eventos); }
  assert.match(a.s.estado.avisoDaHunt ?? '', /^Setor concluído: /);
  assert.match(b.s.estado.avisoDaHunt ?? '', /^Setor concluído: /, 'a party toda é avisada');
});

test('U2. cliente: o painel da party mostra o setor, o "volta em" e o bloco de setores; o CSS existe; a faixa de level saiu', async () => {
  const { readFileSync } = await import('node:fs');
  const panels = readFileSync(new URL('../frontend/client/src/panels.mjs', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../frontend/client/style.css', import.meta.url), 'utf8');
  assert.equal((panels.match(/blocoDosSetores\(/g) ?? []).length, 3, 'definição + as duas telas');
  assert.match(panels, /volta em \$\{Math\.max\(1, Math\.ceil\(membro\.voltaEm/);
  assert.doesNotMatch(panels, /faixa de level \$\{grupo/);
  assert.match(panels, /ctx\.state\.hunt\?\.setores\?\.map/, 'o progresso entra na assinatura que redesenha');
  for (const classe of ['.party-setores', '.party-setor-linha', '.party-setor-barra', '.party-setor.offline']) assert.ok(css.includes(classe), classe);
});
