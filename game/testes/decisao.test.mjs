// V2 / área secreta e escolta: encontros que pedem a DECISÃO do líder (idle 'escolha': só opcionais, o idle não decide).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Modelo from '../systems/encontros/modelo.mjs';
import * as Estado from '../systems/encontros/estado.mjs';
import * as Tipos from '../systems/encontros/tipos.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Instancia from '../systems/hunt/instancia.mjs';
import { matarMonstro } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';
import { Sessao } from '../websocket/sessao.mjs';

const OURO = { id: 3031, chance: 100 };
const SEC = { id: 'sala', tipo: 'area-secreta', nome: 'Sala Oculta', descricao: 'Uma passagem.', ocupantes: { criaturas: [{ key: 'troll', qtd: 2 }] }, recompensa: { drops: [OURO], moedasMedia: 300, primeiraConclusao: { gold: 3000 } }, condicao: { tipo: 'monstros-limpos' } };
const ESC = { id: 'viagem', tipo: 'escolta', nome: 'Escolta do Viajante', protegido: { nome: 'Viajante', vida: 100, desgastePorSegundo: 10 }, ondas: [{ criaturas: [{ key: 'troll', qtd: 2 }] }, { criaturas: [{ key: 'troll', qtd: 2 }] }], pausaMs: 1000, recompensa: { drops: [OURO], moedasMedia: 200, primeiraConclusao: { gold: 2000 } } };
const erros = (l) => Modelo.validar(l).join(' | ');

function luta({ modo = 'online' } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.maxHp = e.hp = 1e9;
  assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: modo, strategy: 'nearest', dificuldade: 'facil' }).ok, true);
  e.hunt.monstros.length = 0;
  e.hunt.clock = 1000;
  return e;
}
const com = (e, defs) => (Estado.criar(e.hunt.instancia, defs.map((d) => Modelo.normalizar({ x: e.hunt.pos.x, y: e.hunt.pos.y, ...d })), { semente: 3 }), e);
const passo = (e, agora) => Instancia.marcarSeLimpou(e.hunt, agora, { estado: e, personagem: PERSONAGEM });
const enc = (e, id) => e.hunt.instancia.encontros[id];
const doEnc = (e, id) => e.hunt.monstros.filter((m) => m.encontro === id && m.hp > 0);
const matar = (e, id) => { for (const m of doEnc(e, id)) { m.hp = 0; matarMonstro(e, e.hunt, PERSONAGEM, m, []); } };
const ativar = (e, id, agora = 2000) => Estado.ativar(e.hunt.instancia, id, { quem: 'a', agora, hunt: e.hunt, estado: e, personagem: PERSONAGEM });

test('validação: pedem decisão (só opcionais), posição para decidir, protegido válido', () => {
  assert.deepEqual(Modelo.validar([SEC, ESC].map((d) => ({ ...d, x: 3, y: 3 }))), []);
  assert.match(erros([{ ...SEC, x: 3, y: 3, obrigatorio: true }]), /só pode ser opcional/);
  assert.match(erros([{ ...ESC, x: 3, y: 3, obrigatorio: true }]), /só pode ser opcional/);
  assert.match(erros([SEC]), /precisa de posição/);
  assert.match(erros([ESC]), /precisa de posição/);
  assert.match(erros([{ ...ESC, x: 3, y: 3, protegido: undefined }]), /precisa de "protegido"/);
  assert.match(erros([{ ...ESC, x: 3, y: 3, protegido: { nome: 'a', vida: 5 } }]), /protegido\.vida/);
  assert.match(erros([{ ...SEC, x: 3, y: 3, ocupantes: undefined }]), /precisa de "ocupantes"/);
  assert.equal(Tipos.tipoDe('area-secreta').decisaoDoLider, true);
  assert.equal(Tipos.tipoDe('escolta').decisaoDoLider, true);
});

test('o idle não decide: na Caça Automática a área secreta e a escolta ficam disponíveis (e a fase fecha sem elas)', () => {
  const e = com(luta({ modo: 'auto' }), [SEC, ESC]);
  for (let t = 0; t < 10; t++) passo(e, 2000 + t * 100);
  assert.notEqual(enc(e, 'sala').estado, 'ativo');
  assert.notEqual(enc(e, 'viagem').estado, 'ativo');
  assert.equal(e.hunt.instancia.status, 'limpa');
});

test('área secreta: a decisão de entrar faz os ocupantes nascerem; limpar paga uma vez', () => {
  const e = com(luta(), [{ ...SEC, condicao: { tipo: 'sempre' } }]);
  Estado.avaliar(e.hunt.instancia, { agora: 2000, hunt: e.hunt, estado: e, personagem: PERSONAGEM });
  assert.equal(enc(e, 'sala').estado, 'disponivel');
  const v = Instancia.encontrosVisiveis(e.hunt.instancia).find((x) => x.id === 'sala');
  assert.equal(v.decisao, true);
  assert.equal(v.descricao, 'Uma passagem.');
  assert.equal(ativar(e, 'sala').ok, true);
  assert.equal(doEnc(e, 'sala').length, 2);
  const g = e.gold ?? 0;
  matar(e, 'sala');
  passo(e, 3000);
  assert.equal(enc(e, 'sala').estado, 'concluido');
  assert.ok(e.gold >= g + 3000);
});

test('recusar descarta o encontro (não volta) e não paga nada', () => {
  const e = com(luta(), [SEC]);
  passo(e, 2000);
  passo(e, 2100);
  assert.equal(Estado.recusar(e.hunt.instancia, 'sala', { agora: 2200, quem: 'a' }).ok, true);
  assert.equal(enc(e, 'sala').estado, 'expirado');
  assert.equal(enc(e, 'sala').recusadoPor, 'a');
  assert.equal(ativar(e, 'sala').ok, false);
  assert.equal(Estado.recusar(e.hunt.instancia, 'sala').ok, false, 'já decidido');
});

test('escolta: as emboscadas desgastam o protegido; vencer todas as ondas conclui e paga', () => {
  const e = com(luta(), [ESC]);
  ativar(e, 'viagem', 1000);
  assert.equal(enc(e, 'viagem').escolta.vida, 100);
  assert.equal(doEnc(e, 'viagem').length, 2);
  passo(e, 2000); // 1 s com 2 emboscadores: -20
  assert.ok(Math.abs(enc(e, 'viagem').escolta.vida - 80) < 1, String(enc(e, 'viagem').escolta.vida));
  matar(e, 'viagem');
  passo(e, 2100);
  passo(e, 3200);
  assert.equal(doEnc(e, 'viagem').length, 2, 'segunda emboscada');
  const g = e.gold ?? 0;
  matar(e, 'viagem');
  passo(e, 3300);
  assert.equal(enc(e, 'viagem').estado, 'concluido');
  assert.ok(e.gold >= g + 2000);
});

test('escolta: o protegido cai (vida zerada) → falha, as sobras saem, o que as ondas pagaram fica', () => {
  const e = com(luta(), [{ ...ESC, protegido: { nome: 'Viajante', vida: 20, desgastePorSegundo: 10 } }]);
  ativar(e, 'viagem', 1000);
  passo(e, 2000);
  passo(e, 2200);
  assert.equal(enc(e, 'viagem').estado, 'falhou');
  assert.equal(doEnc(e, 'viagem').length, 0);
  assert.equal(e.hunt.instancia.status === 'limpa' || passo(e, 5000) === true || e.hunt.instancia.status === 'limpa', true);
});

test('persistência: a vida do protegido grava e volta', () => {
  const e = com(luta(), [ESC]);
  ativar(e, 'viagem', 1000);
  passo(e, 2000);
  const volta = JSON.parse(JSON.stringify({ ...e, hunt: Cacadas.huntParaGravar(e.hunt) }));
  Cacadas.huntAoCarregar(volta.hunt);
  assert.deepEqual(volta.hunt.instancia.encontros.viagem.escolta, e.hunt.instancia.encontros.viagem.escolta);
});

test('sessão: "decidir" — sozinho, quem joga é o decisor: aceitar abre, recusar descarta, e o que não pede decisão é recusado', () => {
  const e = com(luta(), [{ ...SEC, condicao: { tipo: 'sempre' } }, { id: 'bau', tipo: 'bau-comum', nome: 'B', recompensa: { drops: [OURO] } }, { ...ESC, id: 'v2' }]);
  Estado.avaliar(e.hunt.instancia, { agora: 2000, hunt: e.hunt, estado: e, personagem: PERSONAGEM });
  const enviadas = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => enviadas.push(JSON.parse(d)) });
  s.estado = e;
  s.personagem = PERSONAGEM;
  s.decidirEncontro({ id: 'bau', aceitar: false });
  assert.ok(enviadas.some((m) => /não pede decisão/.test(JSON.stringify(m))));
  assert.notEqual(enc(e, 'bau').estado, 'expirado');
  s.decidirEncontro({ id: 'v2', aceitar: false });
  assert.equal(enc(e, 'v2').estado, 'expirado');
  assert.equal(enc(e, 'v2').recusadoPor, PERSONAGEM.nome);
  s.decidirEncontro({ id: 'sala', aceitar: true });
  assert.equal(enc(e, 'sala').estado, 'ativo');
  assert.equal(doEnc(e, 'sala').length, 2);
});
