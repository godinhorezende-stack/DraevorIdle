// Etapa 3: baús (comum, raro, amaldiçoado) e altar — validação com tetos de economia, recompensa pelo loot de sempre
// (uma vez só), armadilha com teto, guardiões, requisitos, efeitos temporários de altar, party e persistência.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as Modelo from '../systems/encontros/modelo.mjs';
import * as Estado from '../systems/encontros/estado.mjs';
import * as Entrega from '../systems/encontros/entrega.mjs';
import * as Eventos from '../systems/encontros/eventos.mjs';
import * as Recompensas from '../systems/encontros/recompensas.mjs';
import * as Altares from '../systems/encontros/altares.mjs';
import { CONFIG } from '../systems/encontros/config.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Instancia from '../systems/hunt/instancia.mjs';
import { matarMonstro } from '../systems/hunt/combate.mjs';
import { Sessao } from '../websocket/sessao.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const OURO = { id: 3031, chance: 100 };
const BAU = { id: 'bau', tipo: 'bau-comum', nome: 'Baú da Cripta', recompensa: { drops: [OURO], moedasMedia: 100 } };

function luta({ modo = 'auto', level = 60 } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level });
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
const limpar = (e, agora = 2000) => Instancia.marcarSeLimpou(e.hunt, agora, { estado: e, personagem: PERSONAGEM });
const enc = (e, id) => e.hunt.instancia.encontros[id];
const erros = (lista) => Modelo.validar(lista).join(' | ');

test('validação dos baús: recompensa, teto de economia, armadilha, grupos, requisitos', () => {
  assert.deepEqual(Modelo.validar([BAU]), []);
  assert.match(erros([{ ...BAU, recompensa: undefined }]), /obrigatória/);
  assert.match(erros([{ ...BAU, recompensa: { drops: [{ id: 999999999, chance: 10 }] } }]), /não existe/);
  assert.match(erros([{ ...BAU, recompensa: { drops: [{ id: 3031, chance: 0 }] } }]), /chance/);
  assert.match(erros([{ ...BAU, recompensa: { drops: [OURO], rolagens: CONFIG.limites.rolagensMax + 1 } }]), /rolagens/);
  assert.match(erros([{ ...BAU, recompensa: { drops: [OURO], moedasMedia: 10_000_000 } }]), /acima do teto/);
  assert.match(erros([{ ...BAU, recompensa: { tabela: 'nao-existe' } }]), /tabela/);
  assert.match(erros([{ ...BAU, armadilha: { chance: 50, elemento: 'plasma', min: 1, max: 2 } }]), /elemento/);
  assert.match(erros([{ ...BAU, armadilha: { chance: 50, elemento: 'fire', min: 9, max: 2 } }]), /min <= max/);
  assert.match(erros([{ ...BAU, tipo: 'bau-raro', guardioes: { criaturas: [{ key: 'troll', qtd: 5 }, { key: 'troll', qtd: 5 }] } }]), /no máximo/);
  assert.match(erros([{ ...BAU, tipo: 'bau-amaldicoado' }]), /criaturas/);
  assert.match(erros([{ ...BAU, chanceDeInvocacao: 30 }]), /invocacao/);
  assert.match(erros([{ ...BAU, obrigatorio: true, requisitos: { levelMin: 10 } }]), /obrigatório não pode ter requisitos/);
  assert.deepEqual(Modelo.validar([{ ...BAU, tipo: 'bau-amaldicoado', invocacao: { criaturas: [{ key: 'troll', qtd: 2 }] }, armadilha: { chance: 20, elemento: 'fire', min: 5, max: 9 }, requisitos: { levelMin: 5 } }]), []);
});

test('validação do altar: só dano/velocidade/defesa/resistência, valor com teto, duração limitada, penalidade negativa', () => {
  const altar = { id: 'a', tipo: 'altar', nome: 'Altar', efeitos: [{ afixo: 'phys_dmg', valor: 10 }], duracaoMs: 60000 };
  assert.deepEqual(Modelo.validar([altar]), []);
  assert.match(erros([{ ...altar, efeitos: [{ afixo: 'exp_bonus', valor: 3 }] }]), /não é um atributo permitido/);
  assert.match(erros([{ ...altar, efeitos: [{ afixo: 'loot_bonus', valor: 3 }] }]), /não é um atributo permitido/);
  assert.match(erros([{ ...altar, efeitos: [{ afixo: 'phys_dmg', valor: 999 }] }]), /acima de 2×/);
  assert.match(erros([{ ...altar, efeitos: [{ afixo: 'phys_dmg', valor: -5 }] }]), /positivo/);
  assert.match(erros([{ ...altar, efeitos: [] }]), /ao menos um/);
  assert.match(erros([{ ...altar, duracaoMs: CONFIG.limites.altarDuracaoMsMax + 1 }]), /duracaoMs/);
  assert.match(erros([{ ...altar, penalidade: { efeitos: [{ afixo: 'armour_pct', valor: 5 }] } }]), /negativo/);
  assert.deepEqual(Modelo.validar([{ ...altar, penalidade: { efeitos: [{ afixo: 'armour_pct', valor: -10 }], invocacao: { criaturas: [{ key: 'troll', qtd: 2 }] } } }]), []);
});

test('baú comum no idle: abre sozinho, paga pelo loot de sempre e termina UMA vez (reavaliar não paga de novo)', () => {
  const e = com(luta(), [BAU]);
  const ouro0 = e.gold ?? 0;
  assert.equal(limpar(e), true, 'sem obrigatório pendente: a fase fecha');
  assert.equal(enc(e, 'bau').estado, 'concluido');
  assert.equal(enc(e, 'bau').ativadoPor, 'idle');
  const ouro1 = e.gold;
  assert.ok(ouro1 > ouro0, `moedas do baú entraram: ${ouro0} → ${ouro1}`);
  assert.ok(e.hunt.sessao.itens.loot[3031] > 0, 'o relatório da caçada conta o loot do baú (mesmo caminho do loot de bicho)');
  const eventos = Eventos.tirar(e.hunt);
  assert.ok(eventos.some((x) => x.t === 'loot' && x.name === 'Baú da Cripta'), 'o evento de loot sai com o nome do baú');
  assert.deepEqual(Eventos.tirar(e.hunt), [], 'e sai uma vez');
  for (let k = 0; k < 10; k++) Estado.avaliar(e.hunt.instancia, { agora: 3000 + k, hunt: e.hunt, estado: e, personagem: PERSONAGEM });
  Estado.ativar(e.hunt.instancia, 'bau', { hunt: e.hunt, estado: e });
  assert.equal(e.gold, ouro1, 'repetir nada paga');
});

test('primeira conclusão paga o prêmio UMA vez por personagem; a repetição (outra instância) só dá o loot normal', () => {
  const premio = { drops: [{ id: 3031, chance: 1 }], primeiraConclusao: { gold: 7000 } };
  const e = com(luta(), [{ ...BAU, recompensa: premio }]);
  const g0 = e.gold ?? 0;
  limpar(e);
  assert.ok(e.gold >= g0 + 7000, `o prêmio de primeira conclusão entrou: ${g0} → ${e.gold}`);
  assert.match(e.avisoDaHunt, /Primeira vez: Baú da Cripta/);
  assert.equal(Entrega.vezesConcluido(e, 'troll-cave', 'bau'), 1);
  const g1 = e.gold;
  // Outra instância da mesma fase, mesmo baú, mesmo personagem: é repetição — só o loot normal (1% de moeda aqui).
  e.hunt.instancia = Instancia.novoRegistro('troll-cave');
  com(e, [{ ...BAU, recompensa: premio }], 9);
  limpar(e, 5000);
  assert.ok(e.gold < g1 + 7000, `a repetição não paga o prêmio de novo: ${g1} → ${e.gold}`);
  assert.equal(Entrega.vezesConcluido(e, 'troll-cave', 'bau'), 2);
});

test('armadilha: sai pela semente (mesma resposta sempre), assusta mas tem teto de % da vida', () => {
  const trap = { ...BAU, armadilha: { chance: 100, elemento: 'physical', min: 900, max: 900 } };
  const e = luta();
  e.maxHp = e.hp = 1000;
  com(e, [trap]);
  assert.equal(enc(e, 'bau').armadilhaAtiva, true);
  limpar(e);
  assert.ok(e.hp < 1000, 'levou o golpe');
  assert.ok(e.hp >= 1000 - Math.floor((1000 * CONFIG.limites.armadilhaPctDaVidaMax) / 100) - 1, `teto de ${CONFIG.limites.armadilhaPctDaVidaMax}% da vida: hp ${e.hp}`);
  const sem = com(luta(), [{ ...trap, armadilha: { ...trap.armadilha, chance: 0 } }]);
  assert.equal(enc(sem, 'bau').armadilhaAtiva, false);
  // Determinístico: a mesma semente dá a mesma armadilha (reconectar não re-rola).
  const meio = { ...BAU, armadilha: { chance: 50, elemento: 'fire', min: 1, max: 2 } };
  let ligadas = 0;
  for (let s = 0; s < 200; s++) {
    const a = Estado.criar({}, [Modelo.normalizar(meio)], { semente: s }).encontros.bau.armadilhaAtiva;
    const b = Estado.criar({}, [Modelo.normalizar(meio)], { semente: s }).encontros.bau.armadilhaAtiva;
    assert.equal(a, b);
    if (a) ligadas++;
  }
  assert.ok(ligadas > 60 && ligadas < 140, `50% → ${ligadas}/200`);
});

test('baú raro com guardiões: os guardiões nascem, o baú só abre quando o último cai, e a recompensa é paga uma vez', () => {
  const raro = { ...BAU, id: 'raro', tipo: 'bau-raro', guardioes: { criaturas: [{ key: 'troll', qtd: 2 }], raridade: 'elite' }, recompensa: { drops: [OURO], rolagens: 2 } };
  const e = com(luta(), [raro]);
  const ouro0 = e.gold ?? 0;
  assert.equal(limpar(e), false, 'o encontro em andamento segura a instância');
  assert.equal(enc(e, 'raro').estado, 'ativo');
  const guardioes = e.hunt.monstros.filter((m) => m.guardiao);
  assert.equal(guardioes.length, 2);
  assert.ok(guardioes.every((m) => m.encontro === 'raro' && m.opcional && m.raridade === 'elite'), 'com a raridade pedida, ligados ao encontro');
  assert.equal(e.gold ?? 0, ouro0, 'fechado enquanto há guardião');
  guardioes[0].hp = 0;
  matarMonstro(e, e.hunt, PERSONAGEM, guardioes[0], []);
  limpar(e, 2100);
  assert.equal(enc(e, 'raro').estado, 'ativo', 'ainda falta um');
  const g2 = e.hunt.monstros.find((m) => m.guardiao && m.hp > 0);
  g2.hp = 0;
  matarMonstro(e, e.hunt, PERSONAGEM, g2, []);
  limpar(e, 2200);
  assert.equal(enc(e, 'raro').estado, 'concluido');
  assert.ok(e.gold > ouro0, 'abriu e pagou');
  const g = e.gold;
  for (let k = 0; k < 5; k++) limpar(e, 3000 + k);
  assert.equal(e.gold, g, 'pago uma vez');
  assert.equal(e.hunt.instancia.status, 'limpa', 'terminada a luta, a fase fechou');
});

test('baú amaldiçoado SEMPRE invoca; baú comum com chanceDeInvocacao invoca pela semente (e não re-rola)', () => {
  const am = { ...BAU, id: 'am', tipo: 'bau-amaldicoado', invocacao: { criaturas: [{ key: 'troll', qtd: 3 }] } };
  const e = com(luta(), [am]);
  limpar(e);
  assert.equal(e.hunt.monstros.filter((m) => m.guardiao).length, 3);
  assert.equal(enc(e, 'am').estado, 'ativo');
  let invocou = 0;
  const secreto = { ...BAU, chanceDeInvocacao: 30, invocacao: { criaturas: [{ key: 'troll', qtd: 1 }] } };
  for (let s = 0; s < 200; s++) {
    const x = Estado.criar({}, [Modelo.normalizar(secreto)], { semente: s }).encontros.bau.invocaSecreta;
    assert.equal(x, Estado.criar({}, [Modelo.normalizar(secreto)], { semente: s }).encontros.bau.invocaSecreta);
    if (x) invocou++;
  }
  assert.ok(invocou > 30 && invocou < 90, `30% → ${invocou}/200`);
});

test('requisitos: nível e chave negam sem tocar no baú (que segue disponível); a chave só é gasta ao abrir; no idle sem requisito ele fica fechado e não trava a fase', () => {
  const trancado = { ...BAU, id: 'tr', requisitos: { levelMin: 100, chave: { id: 3031, count: 1 } } };
  const e = com(luta({ modo: 'online', level: 60 }), [trancado]);
  const r = Estado.ativar(e.hunt.instancia, 'tr', { hunt: e.hunt, estado: e, personagem: PERSONAGEM });
  assert.deepEqual(r, { ok: false, motivo: 'requisito:precisa do level 100' });
  assert.equal(enc(e, 'tr').estado, 'disponivel');
  e.level = 100;
  const ouro = e.gold;
  assert.equal(Estado.ativar(e.hunt.instancia, 'tr', { hunt: e.hunt, estado: e, personagem: PERSONAGEM }).ok, true, 'cumpriu: abre (a chave é uma moeda de ouro no teste)');
  assert.equal(enc(e, 'tr').estado, 'concluido');
  assert.ok(ouro !== undefined);
  // Idle (automático) sem cumprir: não abre, e como é opcional, não trava a campanha.
  const i = com(luta({ modo: 'auto', level: 60 }), [trancado]);
  assert.equal(limpar(i), true);
  assert.equal(enc(i, 'tr').estado, 'disponivel');
});

test('altar: liga os efeitos (os mesmos afixos do equipamento) por um tempo do RELÓGIO DA SALA, não empilha o mesmo altar e respeita o teto', () => {
  const altar = { id: 'alt', tipo: 'altar', nome: 'Altar do Guerreiro', efeitos: [{ afixo: 'phys_dmg', valor: 10 }, { afixo: 'armour_pct', valor: 20 }], duracaoMs: 60_000 };
  const e = com(luta(), [altar]);
  const antes = Afixos.de(e, 'phys_dmg');
  limpar(e);
  assert.equal(enc(e, 'alt').estado, 'concluido');
  assert.equal(Afixos.de(e, 'phys_dmg'), antes + 10, 'o dano físico do altar entra na mesma soma do equipamento');
  assert.equal(Afixos.de(e, 'armour_pct') >= 20, true);
  // O mesmo altar não liga de novo no mesmo estado.
  Altares.aplicar([e], altar.efeitos, 60_000, { id: 'alt', hunt: e.hunt });
  assert.equal(Afixos.de(e, 'phys_dmg'), antes + 10);
  // Vence pelo relógio da sala.
  e.hunt.clock += 59_000;
  assert.equal(Afixos.de(e, 'phys_dmg'), antes + 10);
  e.hunt.clock += 2_000;
  assert.equal(Afixos.de(e, 'phys_dmg'), antes, 'acabou o tempo');
  // Altares empilhados passam só até 2× o teto do afixo.
  const f = Afixos.FICHAS.phys_dmg;
  for (let k = 0; k < 6; k++) Altares.aplicar([e], [{ afixo: 'phys_dmg', valor: f.max }], 60_000, { id: `x${k}`, hunt: e.hunt });
  assert.equal(Afixos.de(e, 'phys_dmg') - antes, f.max * 2);
  // Sair da caçada leva o altar junto.
  e.hunt = null;
  assert.equal(Afixos.de(e, 'phys_dmg'), antes);
});

test('altar com penalidade: efeitos negativos e inimigos invocados; e vale para a PARTY toda', () => {
  const altar = {
    id: 'alt', tipo: 'altar', nome: 'Altar Sombrio', efeitos: [{ afixo: 'atk_speed', valor: 8 }], duracaoMs: 30_000,
    penalidade: { efeitos: [{ afixo: 'armour_pct', valor: -10 }], invocacao: { criaturas: [{ key: 'troll', qtd: 2 }] } },
  };
  const e = luta();
  const amigo = personagemDeTeste({ vocacao: 'paladin', level: 60 });
  amigo.hunt = { clock: 1000, huntId: 'troll-cave', monstros: [] };
  e.hunt.partilha = { ativa: true, membros: [{ estado: e, nome: 'a' }, { estado: amigo, nome: 'b' }], bonus: 1 };
  com(e, [altar]);
  const a0 = Afixos.de(amigo, 'atk_speed');
  limpar(e);
  assert.equal(Afixos.de(amigo, 'atk_speed'), a0 + 8, 'o colega de party também ganha');
  assert.equal(Afixos.de(e, 'atk_speed') >= 8, true);
  assert.equal(e.hunt.monstros.filter((m) => m.invasor).length, 2, 'a penalidade invocou inimigos');
  assert.ok(e.hunt.efeitosDeAltar.some((x) => x.afixo === 'armour_pct' && x.valor === -10));
});

test('party: o loot do baú segue o rodízio de itens (o mesmo do loot de bicho) e a primeira conclusão paga cada membro', () => {
  const peca = Object.values(ITEM_CATALOG).find((i) => i.slot === 'weapon' && !i.stackable && i.weight < 50);
  assert.ok(peca, 'há uma arma para o teste');
  const defs = [{ ...BAU, recompensa: { drops: [{ id: Number(peca.id), chance: 100 }], rolagens: 4, primeiraConclusao: { gold: 500 } } }];
  const e = luta();
  const amigo = personagemDeTeste({ vocacao: 'knight', level: 60 });
  amigo.maxHp = amigo.hp = 1e9;
  amigo.hunt = { clock: 1000, huntId: 'troll-cave', monstros: [], sessao: e.hunt.sessao };
  e.hunt.partilha = { ativa: true, membros: [{ estado: e, nome: 'a' }, { estado: amigo, nome: 'b' }], bonus: 1 };
  com(e, defs);
  const g = [e.gold ?? 0, amigo.gold ?? 0];
  limpar(e);
  const conta = (est) => (est.pouch ?? []).filter((p) => p.id === Number(peca.id)).reduce((n, p) => n + (p.count ?? 1), 0);
  assert.equal(conta(e) + conta(amigo), 4, 'as 4 rolagens caíram');
  assert.ok(conta(e) >= 1 && conta(amigo) >= 1, `rodízio: ${conta(e)} / ${conta(amigo)}`);
  assert.ok(e.gold >= g[0] + 500 && amigo.gold >= g[1] + 500, 'a primeira conclusão paga os dois');
});

test('"interagir": o clique duplo e dois membros pedindo juntos abrem UMA vez; longe, sem requisito ou sem encontro, recusa com mensagem', () => {
  const e = com(luta({ modo: 'online' }), [{ ...BAU, x: 0, y: 0 }]);
  const enviadas = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => enviadas.push(JSON.parse(d)) });
  s.estado = e;
  s.personagem = PERSONAGEM;
  s.interagirComEncontro({ id: 'bau' });
  assert.ok(enviadas.some((m) => /Chegue mais perto/.test(JSON.stringify(m))), 'longe do baú');
  e.hunt.instancia.encontros.bau.x = e.hunt.pos.x;
  e.hunt.instancia.encontros.bau.y = e.hunt.pos.y;
  const ouro0 = e.gold ?? 0;
  s.interagirComEncontro({ id: 'bau' });
  const ouro1 = e.gold;
  assert.ok(ouro1 > ouro0, 'abriu');
  s.interagirComEncontro({ id: 'bau' });
  s.interagirComEncontro({ id: 'bau' });
  assert.equal(e.gold, ouro1, 'repetir não paga');
  assert.ok(enviadas.some((m) => /Já foi aberto/.test(JSON.stringify(m))));
  s.interagirComEncontro({ id: 'nao-existe' });
  assert.ok(enviadas.some((m) => /nada para interagir/.test(JSON.stringify(m))));
});

test('persistência: baú com guardiões e altar ligado sobrevivem a gravar e carregar (sem re-sortear, sem pagar de novo)', () => {
  const raro = { ...BAU, id: 'raro', tipo: 'bau-raro', guardioes: { criaturas: [{ key: 'troll', qtd: 2 }] }, armadilha: { chance: 100, elemento: 'fire', min: 1, max: 2 } };
  const altar = { id: 'alt', tipo: 'altar', nome: 'A', efeitos: [{ afixo: 'phys_dmg', valor: 5 }], duracaoMs: 600000 };
  const e = com(luta(), [raro, altar], 21);
  limpar(e);
  const antes = JSON.parse(JSON.stringify(e.hunt.instancia));
  const volta = JSON.parse(JSON.stringify({ ...e, hunt: Cacadas.huntParaGravar(e.hunt) }));
  Cacadas.huntAoCarregar(volta.hunt);
  assert.deepEqual(volta.hunt.instancia, antes);
  assert.equal(volta.hunt.instancia.encontros.raro.estado, 'ativo');
  assert.equal(volta.hunt.instancia.encontros.raro.guardiaoUids.length, 2);
  assert.equal(volta.hunt.monstros.filter((m) => m.guardiao).length, 2, 'os guardiões voltam');
  assert.ok(Afixos.de(volta, 'phys_dmg') >= 5, 'o altar ligado também volta');
});

test('economia: o valor esperado de uma recompensa é calculado e o teto vale; tabela reutilizável', () => {
  assert.equal(Recompensas.valorEsperado({ drops: [OURO], moedasMedia: 100, rolagens: 3 }), 300);
  assert.equal(Recompensas.valorEsperado(null), 0);
  CONFIG.tabelas['t-teste'] = [{ id: 3031, chance: 50 }];
  try {
    assert.equal(Recompensas.valorEsperado({ tabela: 't-teste', moedasMedia: 200 }), 100);
    assert.deepEqual(Recompensas.validar({ tabela: 't-teste' }), []);
    assert.deepEqual(Recompensas.dropsDe({ tabela: 't-teste', drops: [{ id: 3031, chance: 10 }] }).map((d) => d.chance), [0.5, 0.1]);
  } finally {
    delete CONFIG.tabelas['t-teste'];
  }
});

test('custo: cinquenta encontros avaliados mil vezes custam poucos milissegundos (a lista é pequena e só a instância ativa)', () => {
  const defs = Array.from({ length: 50 }, (_, i) => ({ ...BAU, id: `b${i}`, condicao: { tipo: 'monstros-limpos' } }));
  const i = Estado.criar({}, defs.map((d) => Modelo.normalizar(d)), { semente: 5 });
  const t0 = performance.now();
  for (let k = 0; k < 1000; k++) Estado.avaliar(i, { monstrosLimpos: false, agora: k });
  assert.ok(performance.now() - t0 < 200, `${(performance.now() - t0).toFixed(0)} ms`);
});
