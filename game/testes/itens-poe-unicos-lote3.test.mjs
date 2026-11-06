// (06/11, dono: "continue até dar 0 linhas sem efeito") Os CINTOS únicos: as 53 linhas sem efeito ganham a regra e, quando o jogo não tinha a
// mecânica, ela entra — a Vulnerabilidade da própria peça (os Covardes), a aura de dano contínuo (o Fim da Fome), o Dreno como Caos (A Ânsia), o
// Destino Certo, as Armadilhas da Explosão Solar, o Sangue Mágico, a Oferenda de cada tipo, o Robô Calcinante, o Caçador de Cabeças e a Réplica nos
// Mágicos (a tag `alvoMagico` passa a sair no monstro Mágico do jogo, `modificado`). As que o jogo não tem (a Concentração, o frasco nos lacaios, a
// Dádiva dos Pactos, o Emissário do Tempo) ficam inertes, com a nota.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
await import('../systems/dados.mjs');
if (!SEM) await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Cond = await import('../systems/itens-poe/condicoes-poe.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const GemasE1a = await import('../systems/itens-poe/gemas-e1a.mjs');
const GemasE2a = await import('../systems/itens-poe/gemas-e2a.mjs');
const NoJogador = await import('../systems/itens-poe/monstros-no-jogador.mjs');
const ModsDeMonstro = await import('../systems/itens-poe/modificadores-monstro.mjs');
const Aprendizado = await import('../systems/itens-poe/aprendizado-inspirado.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

function unico(classe, slug) {
  const c = Catalogo.catalogo().classes[classe];
  const u = c.unicos.find((x) => x.slug === slug);
  const b = c.bases.find((x) => x.nome === u.base);
  return Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: b.id, raridade: 'unico', ilvl: 84, rng: semente(5), unico: slug }), Catalogo.REGRAS, semente(6));
}
const semEfeito = (p) => [...(p.poe.implicitos ?? []), ...(p.poe.prefixos ?? []), ...(p.poe.sufixos ?? []), ...(p.poe.modificadores ?? [])].filter((m, k) => p.poe.estados[k] === 'registrado').map((m) => m.texto);

test('nenhum cinto único fica com linha "sem efeito"', { skip: SEM }, () => {
  const ruins = [];
  for (const u of Catalogo.catalogo().classes.Belts.unicos) {
    const p = unico('Belts', u.slug);
    for (const t of semEfeito(p)) ruins.push(`${u.nome}: ${t}`);
  }
  assert.deepEqual(ruins, []);
});

test('a Vulnerabilidade da peça (os Covardes): soma em você, conta como Amaldiçoado e a Vida Cheia; imune, nada', { skip: SEM }, () => {
  const af = unico('Belts', 'Cowards_Chains').poe.af;
  assert.equal(af['maldicao_propria:vulnerabilidade'], 1);
  assert.equal(af.vida_cheia_vulneravel, 1);
  const estado = { hp: 10, maxHp: 100, hunt: { clock: 0 } };
  assert.equal(Cond.addsDasMaldicoesNoJogador(estado, { 'maldicao_propria:vulnerabilidade': 1 })?.dano_physical_recebido_inc, 20);
  assert.equal(Cond.addsDasMaldicoesNoJogador(estado, { 'maldicao_propria:vulnerabilidade': 1, imune_vulnerabilidade: 1 }), null);
  const c = Cond.condicoesDe(estado, { 'maldicao_propria:vulnerabilidade': 1, vida_cheia_vulneravel: 1 });
  assert.ok(Cond.vale(c, 'amaldicoadoProprio'));
  assert.ok(Cond.vale(c, 'vidaCheia'), 'com 10% da vida, conta como Vida Cheia');
});

test('a aura de Caos (o Fim da Fome) nos de perto; o Eletrizado converte Físico em Raio (o Aperto Pirotécnico)', () => {
  const perto = { uid: 1, hp: 100, maxHp: 100, x: 1, y: 0, estados: { chocado: { ate: 5000, pct: 10 } } };
  const longe = { uid: 2, hp: 100, maxHp: 100, x: 9, y: 0, estados: {} };
  const hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [perto, longe] };
  ModsPoe.aurasProximas({ actions: [] }, hunt, { afPoe: { 'aura_degen:chaos': 50, eletrizados_fisico_em_raio: 10 } }, 0);
  assert.equal(perto.dots?.length, 1);
  assert.equal(perto.dots[0].tipo, 'degenCaos');
  assert.equal(longe.dots, undefined);
  assert.equal(perto.estados.fisicoEmRaio?.pct, 10);
  assert.equal(longe.estados.fisicoEmRaio, undefined);
});

test('o Destino Certo: a cada 5 s, um dos seis efeitos por 5 s', () => {
  const hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [] };
  ModsPoe.aurasProximas({ actions: [] }, hunt, { afPoe: { destino_certo: 5 } }, 0);
  const t = Object.values(hunt.poeTemporarios ?? {});
  assert.equal(t.length, 1);
  assert.ok(['critico_sempre', 'recebe_sempre_critico', 'ataques_nao_acertam', 'ataques_sempre_acertam', 'dano_acertos_sortudo', 'dano_recebido_sortudo'].includes(t[0].stat));
  assert.equal(t[0].ate, 5000);
  ModsPoe.aurasProximas({ actions: [] }, hunt, { afPoe: { destino_certo: 5 } }, 2000);
  assert.equal(Object.values(hunt.poeTemporarios).length, 1, 'não sorteia antes dos 5 s');
});

test('"Acertos contra você são sempre Golpes Críticos": o monstro sem chance de crítico também critica', () => {
  const r = Cond.criticoDoBicho({ chance: 0, fator: 1.5 }, { estados: {} }, { afPoe: { recebe_sempre_critico: 1 } }, 0, () => 0.99);
  assert.equal(r.critico, true);
  assert.equal(r.fator, 1.5);
});

test('a Explosão Solar: o inimigo não ativa a Armadilha', () => {
  const hunt = { clock: 0, plantadas: [{ id: 'a', tipo: 'armadilha', x: 0, y: 0, ate: 9000 }], monstros: [{ hp: 10, x: 0, y: 0 }] };
  assert.equal(Plantadas.armadilhasQueAtivam(hunt, { afPoe: {} }, 0).length, 1);
  assert.equal(Plantadas.armadilhasQueAtivam(hunt, { afPoe: { armadilhas_sem_ativacao: 1 } }, 0).length, 0);
});

test('a Oferenda de cada tipo soma no lacaio; os Robôs: o Calcinante é o terceiro, com o Escaldante', () => {
  const l = { oferendas: { Flesh_Offering: { ate: 5000, velMovPct: 20 }, Bone_Offering: { ate: 3000, bloqueio: 15 } } };
  const o = GemasE1a.oferendaAtiva(l, 0);
  assert.equal(o.velMovPct, 20);
  assert.equal(o.bloqueio, 15);
  assert.equal(o.ate, 5000);
  assert.equal(GemasE1a.oferendaAtiva(l, 4000).bloqueio, undefined, 'a Óssea já acabou');
  const robos = { raioM: 3, resfriarPct: 10, eletrizarPct: 15, calcinante: true, efeitoMaisPct: 50 };
  assert.equal(GemasE2a.roboDaInvocacao(robos, 2).auraNaoDano.tipo, 'causticar');
  assert.equal(GemasE2a.roboDaInvocacao(robos, 2).auraNaoDano.pct, GemasE2a.ESCALDANTE_DO_ROBO_PCT * 1.5);
  assert.equal(GemasE2a.roboDaInvocacao(robos, 0).auraNaoDano.pct, 15, 'o Resfriante com o mais 50%');
});

test('a Repreensão de Maligaro: a Eletrização vem para você; o Mágico do jogo (`modificado`) tem a tag alvoMagico', () => {
  const hunt = { clock: 0 };
  assert.equal(NoJogador.eletrizarComPct(hunt, { afPoe: {} }, 20), 20);
  assert.equal(hunt.debuffsDoJogador.eletrizado.pct, 20);
  assert.ok(Cond.tagsDoAlvo({ raridade: 'modificado', estados: {} }, 0).includes('alvoMagico'));
});

test('o Caçador de Cabeças (o Raro) e a Réplica (o Mágico, na chance) dão os Modificadores do morto', { skip: SEM }, () => {
  const id = ModsDeMonstro.DADOS.mods.map((m) => `poe:${m.id}`).find((k) => Aprendizado.efeitosNoJogador(k).length);
  assert.ok(id, 'um modificador de monstro com equivalente em você');
  const raro = { raridade: 'raro', mods: [id] };
  const magico = { raridade: 'modificado', mods: [id] };
  assert.deepEqual(ModsPoe.aprenderDoRaro({}, { clock: 0 }, { afPoe: { cacador_raro_s: 60 } }, raro, 0, () => 0.5), [id]);
  assert.deepEqual(ModsPoe.aprenderDoRaro({}, { clock: 0 }, { afPoe: { cacador_magico_chance: 20, cacador_magico_s: 60 } }, magico, 0, () => 0.5), [], 'fora da chance');
  const hunt = { clock: 0 };
  assert.deepEqual(ModsPoe.aprenderDoRaro({}, hunt, { afPoe: { cacador_magico_chance: 20, cacador_magico_s: 60 } }, magico, 0, () => 0.1), [id]);
  assert.ok(Object.values(hunt.poeTemporarios).every((x) => x.ate === 60000));
});
