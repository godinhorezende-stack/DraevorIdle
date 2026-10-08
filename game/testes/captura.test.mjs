// V2 / aprisionado e invasor: lutas com propósito, reaproveitando guardiões e bosses únicos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Modelo from '../systems/encontros/modelo.mjs';
import * as Estado from '../systems/encontros/estado.mjs';
import * as Eco from '../systems/encontros/economia.mjs';
import * as Entrega from '../systems/encontros/entrega.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Instancia from '../systems/hunt/instancia.mjs';
import { matarMonstro } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

const OURO = { id: 3031, chance: 100 };
const APR = { id: 'cela', tipo: 'aprisionado', nome: 'Cela do Ferreiro', prisioneiro: { nome: 'Ferreiro' }, captores: { criaturas: [{ key: 'troll', qtd: 3 }] }, recompensa: { drops: [OURO], moedasMedia: 300, primeiraConclusao: { gold: 4000 } }, bencao: { efeitos: [{ afixo: 'phys_dmg', valor: 5 }], duracaoMs: 60000 } };
const INV = { id: 'ataque', tipo: 'invasor', nome: 'Ataque Orc', invasores: { criaturas: [{ key: 'troll', qtd: 2 }], raridade: 'raro' }, recompensa: { drops: [OURO], moedasMedia: 200 }, condicao: { tipo: 'monstros-limpos' } };
const erros = (l) => Modelo.validar(l).join(' | ');

function luta({ modo = 'online' } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.maxHp = e.hp = 1e9;
  assert.equal(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: modo, strategy: 'nearest', dificuldade: 'facil' }).ok, true);
  e.hunt.monstros.length = 0;
  for (const z of Object.keys(e.hunt.outrosAndares ?? {})) e.hunt.outrosAndares[z].length = 0;
  e.hunt.clock = 1000;
  return e;
}
const com = (e, defs) => (Estado.criar(e.hunt.instancia, defs.map((d) => Modelo.normalizar(d)), { semente: 3 }), e);
const passo = (e, agora) => Instancia.marcarSeLimpou(e.hunt, agora, { estado: e, personagem: PERSONAGEM });
const enc = (e, id) => e.hunt.instancia.encontros[id];
const alvos = (e, id) => e.hunt.monstros.filter((m) => m.encontro === id && m.hp > 0);
const matar = (e, id) => { for (const m of alvos(e, id)) { m.hp = 0; matarMonstro(e, e.hunt, PERSONAGEM, m, []); } };
const ativar = (e, id, agora = 2000) => Estado.ativar(e.hunt.instancia, id, { quem: 'a', agora, hunt: e.hunt, estado: e, personagem: PERSONAGEM });

test('validação: aprisionado/invasor precisam de quem luta, boss existente, e invasor não tem posição', () => {
  assert.deepEqual(Modelo.validar([APR, INV]), []);
  assert.match(erros([{ ...APR, captores: undefined }]), /precisa de "captores"/);
  assert.match(erros([{ ...INV, invasores: undefined }]), /precisa de "invasores"/);
  assert.match(erros([{ ...APR, captores: { criaturas: [{ key: 'xx', qtd: 1 }] } }]), /bestiário/);
  assert.match(erros([{ ...APR, captores: undefined, bossId: 'nao-existe' }]), /não está cadastrado/);
  assert.match(erros([{ ...INV, x: 1, y: 1 }]), /não tem posição/);
  assert.match(erros([{ ...INV, prisioneiro: { nome: 'a' } }]), /só "aprisionado"/);
  assert.match(erros([{ ...APR, bencao: { efeitos: [{ afixo: 'phys_dmg', valor: 5 }], duracaoMs: 99999999 } }]), /duracaoMs/);
});

test('aprisionado: interagir faz os captores nascerem; o último cair liberta, paga e abençoa — uma vez só', () => {
  const e = com(luta(), [APR]);
  const ouro0 = e.gold ?? 0;
  assert.equal(enc(e, 'cela').estado, 'disponivel');
  assert.equal(ativar(e, 'cela').ok, true);
  assert.equal(alvos(e, 'cela').length, 3);
  assert.equal(ativar(e, 'cela').ok, false, 'repetir não duplica');
  for (let t = 0; t < 5; t++) passo(e, 2100 + t);
  assert.equal(alvos(e, 'cela').length, 3);
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 2200, { estado: e, personagem: PERSONAGEM }), false, 'em andamento segura o CLEAR');
  matar(e, 'cela');
  passo(e, 3000);
  assert.equal(enc(e, 'cela').estado, 'concluido');
  assert.ok(e.gold >= ouro0 + 4000, 'recompensa + primeira conclusão');
  assert.ok(Object.keys(e.hunt.efeitosDeAltar ?? {}).length > 0, 'bênção do libertado');
  const g = e.gold;
  for (let t = 0; t < 5; t++) passo(e, 4000 + t);
  assert.equal(e.gold, g);
  assert.equal(Entrega.vezesConcluido(e, HUNT_DE_TESTE, 'cela'), 1);
});

test('invasor: chega sozinho (mesmo no modo manual) quando a condição libera; vencer paga; não precisa de interação', () => {
  const e = com(luta(), [INV]);
  assert.equal(enc(e, 'ataque').estado, 'dormindo');
  passo(e, 2000); // monstros-limpos
  passo(e, 2100);
  assert.equal(enc(e, 'ataque').estado, 'ativo', 'chegou sozinho');
  assert.equal(alvos(e, 'ataque').length, 2);
  assert.ok(alvos(e, 'ataque').every((m) => m.invasor && m.raridade === 'raro'));
  const g = e.gold ?? 0;
  matar(e, 'ataque');
  passo(e, 3000);
  assert.equal(enc(e, 'ataque').estado, 'concluido');
  assert.ok(e.gold > g);
  assert.equal(e.hunt.instancia.status, 'limpa');
});

test('invasor obrigatório trava o CLEAR até ser repelido; idle (auto) resolve ambos sem travar', () => {
  const e = com(luta({ modo: 'auto' }), [{ ...INV, obrigatorio: true }, APR]);
  let agora = 2000;
  for (let i = 0; i < 60 && e.hunt.instancia.status === 'ativa'; i++) {
    passo(e, agora);
    matar(e, 'ataque');
    matar(e, 'cela');
    agora += 500;
  }
  assert.equal(enc(e, 'ataque').estado, 'concluido');
  assert.equal(enc(e, 'cela').estado, 'concluido');
  assert.equal(e.hunt.instancia.status, 'limpa');
});

test('persistência e projeção offline: em andamento ao gravar continua; instância zerada expira', () => {
  const e = com(luta(), [APR]);
  ativar(e, 'cela');
  const volta = JSON.parse(JSON.stringify({ ...e, hunt: Cacadas.huntParaGravar(e.hunt) }));
  Cacadas.huntAoCarregar(volta.hunt);
  assert.equal(volta.hunt.instancia.encontros.cela.estado, 'ativo');
  Estado.resolverNaProjecao(e.hunt.instancia, { agora: 9000 });
  assert.equal(enc(e, 'cela').estado, 'expirado');
});

test('economia: os captores e invasores (bichos que dropam) entram na conta', () => {
  const sem = Eco.valorDeUmEncontro(Modelo.normalizar({ ...APR, captores: undefined, bossId: undefined }), null);
  const com3 = Eco.valorDeUmEncontro(Modelo.normalizar(APR), null);
  assert.ok(com3 > sem);
  assert.ok(Eco.valorDeUmEncontro(Modelo.normalizar(INV), null) > 0);
});
