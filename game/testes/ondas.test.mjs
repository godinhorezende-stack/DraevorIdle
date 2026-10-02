// V2 / ondas: sobrevivência e fenda — o motor de ondas (dificuldade crescente, pausa, recompensa por desempenho, limite de tempo),
// sem duplicar ondas, com persistência, party e o idle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Modelo from '../systems/encontros/modelo.mjs';
import * as Estado from '../systems/encontros/estado.mjs';
import * as Ondas from '../systems/encontros/ondas.mjs';
import * as Eco from '../systems/encontros/economia.mjs';
import * as Entrega from '../systems/encontros/entrega.mjs';
import { CONFIG } from '../systems/encontros/config.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Instancia from '../systems/hunt/instancia.mjs';
import { matarMonstro } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const OURO = { id: 3031, chance: 100 };
const SOBREV = { id: 'ondas', tipo: 'sobrevivencia', nome: 'Cerco de Trolls', ondas: [{ criaturas: [{ key: 'troll', qtd: 2 }] }, { criaturas: [{ key: 'troll', qtd: 3 }] }, { criaturas: [{ key: 'troll', qtd: 4 }], raridade: 'elite' }], pausaMs: 2000, recompensa: { drops: [OURO], porOnda: true, moedasMedia: 200, primeiraConclusao: { gold: 5000 } } };
const FENDA = { id: 'fenda', tipo: 'fenda', nome: 'Fenda Instável', ondas: [{ criaturas: [{ key: 'troll', qtd: 2 }] }, { criaturas: [{ key: 'troll', qtd: 2 }] }, { criaturas: [{ key: 'troll', qtd: 2 }] }], pausaMs: 1000, limiteMs: 60_000, recompensa: { drops: [OURO], porOnda: true, moedasMedia: 100 } };
const erros = (lista) => Modelo.validar(lista).join(' | ');

function luta({ modo = 'online' } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.maxHp = e.hp = 1e9;
  assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: modo, strategy: 'nearest', dificuldade: 'facil' }).ok, true);
  e.hunt.monstros.length = 0;
  for (const z of Object.keys(e.hunt.outrosAndares ?? {})) e.hunt.outrosAndares[z].length = 0;
  e.hunt.clock = 1000;
  return e;
}
const com = (e, defs, semente = 3) => {
  Estado.criar(e.hunt.instancia, defs.map((d) => Modelo.normalizar(d)), { semente });
  return e;
};
const passo = (e, agora) => Instancia.marcarSeLimpou(e.hunt, agora, { estado: e, personagem: PERSONAGEM });
const enc = (e, id) => e.hunt.instancia.encontros[id];
const daOnda = (e) => e.hunt.monstros.filter((m) => m.onda && m.hp > 0);
const matarOnda = (e) => {
  for (const m of daOnda(e)) {
    m.hp = 0;
    matarMonstro(e, e.hunt, PERSONAGEM, m, []);
  }
};
const iniciar = (e, id, agora = 2000) => Estado.ativar(e.hunt.instancia, id, { quem: 'a', agora, hunt: e.hunt, estado: e, personagem: PERSONAGEM });

test('validação: ondas, teto de monstros, fenda com limite de tempo (e nunca obrigatória), sobrevivência sem limite', () => {
  assert.deepEqual(Modelo.validar([SOBREV, FENDA]), []);
  assert.match(erros([{ ...SOBREV, ondas: undefined }]), /precisa de "ondas"/);
  assert.match(erros([{ ...SOBREV, ondas: Array(CONFIG.limites.ondasMax + 1).fill({ criaturas: [{ key: 'troll', qtd: 1 }] }) }]), /no máximo \d+ ondas/);
  assert.match(erros([{ ...SOBREV, ondas: [{ criaturas: [{ key: 'troll', qtd: 8 }, { key: 'troll', qtd: 8 }] }] }]), /por onda \(limite do servidor\)/);
  assert.match(erros([{ ...SOBREV, ondas: [{ criaturas: [{ key: 'nao-existe', qtd: 1 }] }] }]), /bestiário/);
  assert.match(erros([{ ...SOBREV, ondas: [{ criaturas: [{ key: 'troll', qtd: 1 }], raridade: 'lendaria' }] }]), /raridade/);
  assert.match(erros([{ ...SOBREV, ondas: [{ criaturas: [{ key: 'troll', qtd: 1 }], modificadores: ['voador'] }] }]), /modificador/);
  assert.match(erros([{ ...SOBREV, pausaMs: 999999 }]), /pausaMs/);
  assert.match(erros([{ ...FENDA, limiteMs: undefined }]), /precisa de limiteMs/);
  assert.match(erros([{ ...FENDA, limiteMs: 1000 }]), /precisa de limiteMs/);
  assert.match(erros([{ ...FENDA, obrigatorio: true }]), /não pode ser obrigatória/);
  assert.match(erros([{ ...SOBREV, limiteMs: 60000 }]), /só a fenda tem limite/);
  assert.match(erros([{ ...SOBREV, recompensa: { drops: [OURO], rolagens: 5, porOnda: true } , ondas: Array(10).fill({ criaturas: [{ key: 'troll', qtd: 1 }] }) }]), /rolagens × ondas/);
  // O obrigatório de sobrevivência é aceito (não tem relógio para perder).
  assert.deepEqual(Modelo.validar([{ ...SOBREV, obrigatorio: true }]), []);
});

test('ondas crescentes: a quantidade sobe a cada onda, respeitando o teto de monstros por onda', () => {
  const o = Ondas.ondasCrescentes({ criaturas: [{ key: 'troll', qtd: 2 }, { key: 'orc', qtd: 1 }], ondas: 6, fator: 1.5, raridade: 'elite' });
  const totais = o.map(Ondas.monstrosDaOnda);
  assert.equal(o.length, 6);
  assert.ok(totais[0] < totais[2] && totais[2] <= totais[5], `crescente: ${totais}`);
  assert.ok(totais.every((n) => n <= CONFIG.limites.ondaMaxMonstros), `teto: ${totais}`);
  assert.equal(o[0].raridade, undefined);
  assert.equal(o.at(-1).raridade, 'elite', 'as últimas ondas vêm com raridade');
});

test('sobrevivência (manual): onda por onda, pausa entre elas, recompensa por onda e a conclusão paga a primeira vez UMA vez', () => {
  const e = com(luta(), [SOBREV]);
  const ouro0 = e.gold ?? 0;
  assert.equal(enc(e, 'ondas').estado, 'disponivel');
  assert.equal(iniciar(e, 'ondas').ok, true);
  assert.equal(daOnda(e).length, 2, 'a onda 1 nasceu');
  assert.ok(daOnda(e).every((m) => m.encontro === 'ondas' && m.opcional), 'ligados ao encontro e fora da conta do CLEAR');
  // Repetir o comando não gera outra onda.
  assert.equal(iniciar(e, 'ondas').ok, false);
  for (let t = 0; t < 20; t++) passo(e, 2100 + t * 10);
  assert.equal(daOnda(e).length, 2, 'avaliar várias vezes não duplica a onda');
  // Vence a onda 1: pausa antes da 2.
  matarOnda(e);
  passo(e, 2500);
  assert.equal(daOnda(e).length, 0, 'ainda na pausa');
  assert.ok((e.gold ?? 0) > ouro0, 'a onda 1 pagou');
  const ouro1 = e.gold;
  passo(e, 4600);
  assert.equal(daOnda(e).length, 3, 'passada a pausa, a onda 2 (3 monstros)');
  matarOnda(e);
  passo(e, 4700);
  passo(e, 6800);
  assert.equal(daOnda(e).length, 4, 'onda 3 (4 monstros)');
  assert.ok(daOnda(e).every((m) => m.raridade === 'elite'), 'a última vem elite');
  assert.ok(e.gold > ouro1, 'a onda 2 pagou');
  assert.equal(enc(e, 'ondas').estado, 'ativo');
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 6900, { estado: e, personagem: PERSONAGEM }), false, 'em andamento: segura o CLEAR');
  const antes = e.gold;
  matarOnda(e);
  passo(e, 7000);
  assert.equal(enc(e, 'ondas').estado, 'concluido');
  assert.ok(e.gold >= antes + 5000, 'a última onda + a primeira conclusão (5.000)');
  const depois = e.gold;
  for (let t = 0; t < 10; t++) passo(e, 8000 + t);
  assert.equal(e.gold, depois, 'concluído: nada paga de novo');
  assert.equal(Entrega.vezesConcluido(e, 'troll-cave', 'ondas'), 1);
  assert.equal(e.hunt.instancia.status, 'limpa', 'sem encontro em andamento, a fase fecha');
});

test('sobrevivência no IDLE (Caça Automática): o idle inicia sozinho e as ondas rodam até o fim — nunca trava a fase', () => {
  const e = com(luta({ modo: 'auto' }), [SOBREV]);
  let agora = 2000;
  for (let i = 0; i < 80 && e.hunt.instancia.status === 'ativa'; i++) {
    passo(e, agora);
    matarOnda(e); // o combate de sempre vence cada onda
    agora += 500;
  }
  assert.equal(enc(e, 'ondas').estado, 'concluido');
  assert.equal(enc(e, 'ondas').ativadoPor, 'idle');
  assert.equal(e.hunt.instancia.status, 'limpa');
});

test('fenda: o relógio fecha a passagem, remove o que sobrou, mantém o que as ondas vencidas pagaram — e o CLEAR da fase não fica preso', () => {
  const e = com(luta(), [FENDA]);
  const ouro0 = e.gold ?? 0;
  iniciar(e, 'fenda', 1000);
  assert.equal(enc(e, 'fenda').onda.limiteEm, 61_000);
  matarOnda(e);
  passo(e, 1100);
  assert.ok(e.gold > ouro0, 'a onda 1 pagou');
  const pago = e.gold;
  passo(e, 2200);
  assert.equal(daOnda(e).length, 2, 'a onda 2 nasceu');
  // O tempo estoura com a onda 2 em campo.
  passo(e, 61_000);
  assert.equal(enc(e, 'fenda').estado, 'falhou');
  assert.equal(daOnda(e).length, 0, 'a fenda se fechou: o que sobrou saiu da sala');
  assert.equal(e.gold, pago, 'o que já tinha pago fica; nada a mais');
  assert.equal(Entrega.vezesConcluido(e, 'troll-cave', 'fenda'), 0, 'e não conta como concluída');
  passo(e, 62_000);
  assert.equal(e.hunt.instancia.status, 'limpa', 'a fase fecha');
});

test('a fenda vencida dentro do tempo conclui; e libera quem depende dela (a "passagem")', () => {
  const passagem = { id: 'tesouro', tipo: 'bau-comum', nome: 'Câmara Aberta', condicao: { tipo: 'apos-encontro', encontro: 'fenda' }, recompensa: { drops: [OURO], moedasMedia: 50 } };
  const e = com(luta(), [FENDA, passagem]);
  assert.equal(enc(e, 'tesouro').estado, 'dormindo');
  iniciar(e, 'fenda', 1000);
  for (let k = 0; k < 3; k++) {
    matarOnda(e);
    passo(e, 1100 + k * 2000);
    passo(e, 2300 + k * 2000);
  }
  passo(e, 6000);
  passo(e, 6100);
  assert.equal(enc(e, 'fenda').estado, 'concluido');
  assert.equal(enc(e, 'tesouro').estado, 'disponivel', 'a passagem abriu');
});

test('persistência: gravar e carregar no meio de uma onda mantém o estado, e a próxima onda nasce uma vez só', () => {
  const e = com(luta(), [SOBREV]);
  iniciar(e, 'ondas', 1000);
  matarOnda(e);
  passo(e, 1100); // onda 1 vencida; pausa
  const volta = JSON.parse(JSON.stringify({ ...e, hunt: Cacadas.huntParaGravar(e.hunt) }));
  Cacadas.huntAoCarregar(volta.hunt);
  assert.deepEqual(volta.hunt.instancia.encontros.ondas.onda, e.hunt.instancia.encontros.ondas.onda);
  Instancia.marcarSeLimpou(volta.hunt, 3500, { estado: volta, personagem: PERSONAGEM });
  Instancia.marcarSeLimpou(volta.hunt, 3600, { estado: volta, personagem: PERSONAGEM });
  assert.equal(volta.hunt.monstros.filter((m) => m.onda && m.hp > 0).length, 3, 'a onda 2 nasceu, uma vez, depois de carregar');
});

test('party: cada onda paga o loot a quem está na luta NAQUELE momento (o que sai antes não leva as ondas seguintes)', () => {
  const e = luta();
  const amigo = personagemDeTeste({ vocacao: 'paladin', level: 60 });
  amigo.maxHp = amigo.hp = 1e9;
  amigo.hunt = { clock: 1000, huntId: 'troll-cave', monstros: [], sessao: e.hunt.sessao };
  e.hunt.partilha = { ativa: true, membros: [{ estado: e, nome: 'a' }, { estado: amigo, nome: 'b' }], bonus: 1 };
  com(e, [{ ...SOBREV, recompensa: { drops: [OURO], porOnda: true, moedasMedia: 1000 } }]);
  iniciar(e, 'ondas', 1000);
  const g = [e.gold ?? 0, amigo.gold ?? 0];
  matarOnda(e);
  passo(e, 1100);
  assert.ok(e.gold > g[0] && amigo.gold > g[1], 'a onda 1 pagou os dois (ouro dividido em partes iguais)');
  e.hunt.partilha.membros = e.hunt.partilha.membros.filter((m) => m.estado !== amigo);
  const g2 = [e.gold, amigo.gold];
  passo(e, 3300);
  matarOnda(e);
  passo(e, 3400);
  assert.ok(e.gold > g2[0], 'quem ficou segue recebendo');
  assert.equal(amigo.gold, g2[1], 'quem saiu não recebe as ondas seguintes');
});

test('projeção offline: ondas em andamento ao zerar a instância expiram sem pagar (a regra de sempre dos encontros)', () => {
  const e = com(luta(), [SOBREV]);
  iniciar(e, 'ondas', 1000);
  Estado.resolverNaProjecao(e.hunt.instancia, { agora: 2000 });
  assert.equal(enc(e, 'ondas').estado, 'expirado');
});

test('economia: as ondas (bichos que dropam) e a recompensa por onda entram na conta do impacto, e o editor cobra o teto', () => {
  const um = Eco.impactoEconomico('troll-cave', Modelo.encontrosDoMapa({ encontros: [{ ...SOBREV, ondas: [SOBREV.ondas[0]], recompensa: { drops: [OURO], porOnda: true, moedasMedia: 100 } }] }));
  const tres = Eco.impactoEconomico('troll-cave', Modelo.encontrosDoMapa({ encontros: [SOBREV] }));
  assert.ok(tres.valorDosEncontros > um.valorDosEncontros * 2, `3 ondas valem bem mais que 1: ${um.valorDosEncontros} → ${tres.valorDosEncontros}`);
  const porOnda = Eco.valorDeUmEncontro(Modelo.normalizar(SOBREV), null);
  const sem = Eco.valorDeUmEncontro(Modelo.normalizar({ ...SOBREV, recompensa: { ...SOBREV.recompensa, porOnda: false } }), null);
  assert.ok(porOnda > sem, 'por onda paga a tabela a cada onda');
});

test('custo: dez ondas de dez monstros num encontro, mil passos, ficam baratos', () => {
  const grande = { ...SOBREV, ondas: Array.from({ length: 10 }, () => ({ criaturas: [{ key: 'troll', qtd: 5 }, { key: 'orc', qtd: 5 }] })) };
  const e = com(luta(), [grande]);
  iniciar(e, 'ondas', 1000);
  const t0 = performance.now();
  for (let k = 0; k < 1000; k++) {
    passo(e, 1000 + k * 250);
    if (k % 4 === 0) matarOnda(e);
  }
  assert.ok(performance.now() - t0 < 1500, `${(performance.now() - t0).toFixed(0)} ms`);
  assert.ok(e.hunt.monstros.filter((m) => m.onda && m.hp > 0).length <= CONFIG.limites.ondaMaxMonstros, 'nunca passa do teto de uma onda em campo');
});
