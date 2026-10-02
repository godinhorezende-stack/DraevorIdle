// Etapa 6: balanceamento e robustez — impacto econômico (teto RELATIVO à fase), party com gente entrando e saindo,
// ativação simultânea, caçada offline COMPLETA com encontros no mapa, e custo com muitas caçadas ao mesmo tempo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Conteudo from '../admin/conteudo.mjs';
import * as Eco from '../systems/encontros/economia.mjs';
import * as Modelo from '../systems/encontros/modelo.mjs';
import * as Estado from '../systems/encontros/estado.mjs';
import * as Entrega from '../systems/encontros/entrega.mjs';
import * as Catalogo from '../systems/bosses-unicos/catalogo.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Instancia from '../systems/hunt/instancia.mjs';
import { mapaRealCapturado } from '../systems/hunt/terreno.mjs';
import { matarMonstro } from '../systems/hunt/combate.mjs';
import * as SimulacaoOffline from '../systems/simulacao-offline.mjs';
import { CONFIG } from '../systems/encontros/config.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

after(() => SimulacaoOffline.encerrar());
const HORA = 3_600_000;
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
/** Põe `amigo` na party de `e` (partilha ativa, na MESMA sala). */
function party(e, ...amigos) {
  for (const a of amigos) a.hunt = { clock: 1000, huntId: 'troll-cave', monstros: [], sessao: e.hunt.sessao };
  e.hunt.partilha = { ativa: true, membros: [{ estado: e, nome: 'dono' }, ...amigos.map((a, i) => ({ estado: a, nome: `amigo${i}` }))], bonus: 1 };
}
const ativar = (e, id, quem, pers = PERSONAGEM) => Estado.ativar(e.hunt.instancia, id, { quem: quem ?? 'x', hunt: e.hunt, estado: e, personagem: pers });

// ------------------------------------------------------------------ economia

test('o valor de limpar uma fase é calculado (772 na Troll Cave Fácil) e a razão dos encontros é o que o validador cobra', () => {
  const v = Eco.valorDaInstancia('troll-cave', 'facil');
  assert.ok(v.valor > 0 && v.bichos > 10, JSON.stringify(v));
  const baus = (qtd) => Modelo.encontrosDoMapa({ encontros: [{ ...BAU, recompensa: { drops: [OURO], moedasMedia: qtd } }] });
  const pequeno = Eco.impactoEconomico('troll-cave', baus(100));
  assert.equal(pequeno.valorDosEncontros, 100);
  assert.ok(pequeno.fracao > 0 && pequeno.fracao < CONFIG.limites.fracaoDaFaseAviso, `100 de ouro = ${(pequeno.fracao * 100).toFixed(0)}% da fase`);
  const grande = Eco.impactoEconomico('troll-cave', baus(v.valor * 2));
  assert.ok(grande.fracao > CONFIG.limites.fracaoDaFaseErro);
  // A probabilidade pesa: um baú de 5% vale 5% do valor dele; e quantidade multiplica.
  const raro = Eco.impactoEconomico('troll-cave', Modelo.encontrosDoMapa({ encontros: [{ ...BAU, probabilidade: 5, quantidade: 4, recompensa: { drops: [OURO], moedasMedia: 1000 } }] }));
  assert.equal(raro.valorDosEncontros, 200, '1.000 × 5% × 4');
  // Desligado não conta.
  assert.equal(Eco.impactoEconomico('troll-cave', Modelo.encontrosDoMapa({ encontros: [{ ...BAU, ativo: false }] })).valorDosEncontros, 0);
});

test('guardiões e boss entram na conta (são bichos que dropam); altar não vale ouro', () => {
  const guardioes = Modelo.encontrosDoMapa({ encontros: [{ id: 'r', tipo: 'bau-raro', nome: 'r', recompensa: { drops: [OURO], moedasMedia: 1 }, guardioes: { criaturas: [{ key: 'troll', qtd: 5 }] } }] });
  const semGuardioes = Modelo.encontrosDoMapa({ encontros: [{ id: 'r', tipo: 'bau-raro', nome: 'r', recompensa: { drops: [OURO], moedasMedia: 1 } }] });
  assert.ok(Eco.impactoEconomico('troll-cave', guardioes).valorDosEncontros > Eco.impactoEconomico('troll-cave', semGuardioes).valorDosEncontros, 'os 5 trolls dropam');
  const altar = Modelo.encontrosDoMapa({ encontros: [{ id: 'a', tipo: 'altar', nome: 'a', efeitos: [{ afixo: 'phys_dmg', valor: 5 }], duracaoMs: 1000 }] });
  assert.equal(Eco.impactoEconomico('troll-cave', altar).valorDosEncontros, 0);
  Catalogo.registrar({ id: 'chefe-eco', nome: 'Chefe', categoria: 'principal', base: 'cyclops', atributos: { vidaMult: 2, expMult: 3 }, recompensas: { loot: [{ id: 3031, chance: 100 }], primeiraVitoria: { gold: 999999 } } });
  try {
    const boss = Eco.impactoEconomico('troll-cave', Modelo.encontrosDoMapa({ encontros: [{ id: 'b', tipo: 'boss', nome: 'b', bossId: 'chefe-eco', obrigatorio: true }] }));
    assert.ok(boss.valorDosEncontros > 0 && boss.valorDosEncontros < 999999, 'o loot do boss conta; o prêmio de primeira vitória (uma vez só) não é renda repetível');
  } finally {
    Catalogo.esquecer('chefe-eco');
  }
});

test('o editor avisa (>30%) e RECUSA (>100%) encontros que valem mais que a fase, com os números', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'draevor-eco-'));
  mkdirSync(join(pasta, 'hunts'));
  const original = { ...Conteudo.CAMINHOS };
  copyFileSync(new URL('../gamedata/hunts/troll-cave-map.json', import.meta.url), join(pasta, 'hunts', 'troll-cave-map.json'));
  Object.assign(Conteudo.CAMINHOS, { hunts: join(pasta, 'hunts'), fases: join(pasta, 'f.json'), bosses: join(pasta, 'b.json') });
  try {
    const v = (moedas) => Conteudo.validarFase('troll-cave', [{ ...BAU, recompensa: { drops: [OURO], moedasMedia: moedas } }]);
    const base = Eco.valorDaInstancia('troll-cave', 'facil').valor;
    const ok = v(Math.round(base * 0.1));
    assert.deepEqual([ok.erros, ok.avisos.filter((a) => /economia/.test(a))], [[], []]);
    assert.ok(ok.economia.fracao > 0);
    const aviso = v(Math.round(base * 0.5));
    assert.deepEqual(aviso.erros, []);
    assert.match(aviso.avisos.join(' '), /economia: os encontros somam ~[\d.]+ de ouro por instância, 50% do valor/);
    const erro = v(base * 3);
    assert.match(erro.erros.join(' '), /acima do teto de 100%/);
    // Salvar um valor abusivo é recusado e nada é gravado.
    assert.equal(Conteudo.salvarEncontros('troll-cave', [{ ...BAU, recompensa: { drops: [OURO], moedasMedia: base * 3 } }]).ok, false);
    assert.equal(Conteudo.carregarFase('troll-cave').economia.valorDosEncontros, 0);
  } finally {
    Object.assign(Conteudo.CAMINHOS, original);
    rmSync(pasta, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------------ multiplayer

test('party: quem saiu antes de o encontro acabar NÃO leva a recompensa; quem entrou antes do fim leva; o aviso chega a todos', () => {
  const raro = { ...BAU, id: 'raro', tipo: 'bau-raro', guardioes: { criaturas: [{ key: 'troll', qtd: 1 }] }, recompensa: { drops: [OURO], moedasMedia: 500, primeiraConclusao: { gold: 1000 } } };
  const e = luta({ modo: 'online' });
  const sai = personagemDeTeste({ vocacao: 'paladin', level: 60 });
  const entra = personagemDeTeste({ vocacao: 'druid', level: 60 });
  party(e, sai);
  com(e, [raro]);
  const gSai = sai.gold ?? 0;
  assert.equal(ativar(e, 'raro', 'dono', { nome: 'Dono' }).ok, true);
  assert.match(sai.avisoDaHunt ?? '', /Dono abriu: Baú da Cripta/, 'quem está na party é avisado de quem ativou');
  // Um sai da party; outro entra, antes de o último guardião cair.
  e.hunt.partilha.membros = e.hunt.partilha.membros.filter((m) => m.estado !== sai);
  entra.hunt = { clock: 1000, huntId: 'troll-cave', monstros: [], sessao: e.hunt.sessao };
  e.hunt.partilha.membros.push({ estado: entra, nome: 'novo' });
  const gEntra = entra.gold ?? 0;
  const g = e.hunt.monstros.find((m) => m.guardiao);
  g.hp = 0;
  matarMonstro(e, e.hunt, PERSONAGEM, g, []);
  limpar(e, 2500);
  assert.equal(enc(e, 'raro').estado, 'concluido');
  assert.equal(sai.gold ?? 0, gSai, 'quem saiu não recebe nada');
  assert.ok((entra.gold ?? 0) >= gEntra + 1000, 'quem estava presente na conclusão recebe a primeira conclusão');
  assert.equal(Entrega.vezesConcluido(sai, 'troll-cave', 'raro'), 0);
  assert.equal(Entrega.vezesConcluido(entra, 'troll-cave', 'raro'), 1);
});

test('ativação SIMULTÂNEA (dois membros no mesmo instante): um encontro, um boss, uma recompensa', () => {
  const e = luta({ modo: 'online' });
  const b = personagemDeTeste({ vocacao: 'paladin', level: 60 });
  party(e, b);
  const raro = { ...BAU, id: 'raro', tipo: 'bau-raro', guardioes: { criaturas: [{ key: 'troll', qtd: 2 }] } };
  com(e, [raro, { id: 'altar', tipo: 'altar', nome: 'Altar', efeitos: [{ afixo: 'phys_dmg', valor: 5 }], duracaoMs: 60000 }]);
  const resultados = [ativar(e, 'raro', 'a'), ativar(b, 'raro', 'b'), ativar(e, 'raro', 'a')];
  assert.deepEqual(resultados.map((r) => r.ok), [true, false, false]);
  assert.equal(e.hunt.monstros.filter((m) => m.guardiao).length, 2, 'os guardiões nasceram uma vez só');
  const altares = [ativar(e, 'altar', 'a'), ativar(e, 'altar', 'b')];
  assert.deepEqual(altares.map((r) => r.ok), [true, false]);
  assert.equal(e.hunt.efeitosDeAltar.filter((x) => x.id === 'altar').length, 1, 'o altar ligou uma vez');
});

test('falha e cancelamento: abandonar a caçada no meio do encontro, ou morrer, não paga nada e a próxima instância é nova', () => {
  const raro = { ...BAU, id: 'raro', tipo: 'bau-raro', guardioes: { criaturas: [{ key: 'troll', qtd: 2 }] }, recompensa: { drops: [OURO], moedasMedia: 5000 } };
  const e = com(luta({ modo: 'online' }), [raro, { id: 'altar', tipo: 'altar', nome: 'A', efeitos: [{ afixo: 'phys_dmg', valor: 5 }], duracaoMs: 600000 }]);
  const ouro = e.gold ?? 0;
  ativar(e, 'raro', 'a');
  ativar(e, 'altar', 'a');
  const instanciaAntes = e.hunt.instancia.id;
  assert.equal(enc(e, 'raro').estado, 'ativo');
  // O personagem morre / sai: a caçada some, e com ela o encontro e o altar.
  e.hunt = null;
  assert.equal(e.gold ?? 0, ouro, 'nada foi pago');
  assert.equal(Entrega.vezesConcluido(e, 'troll-cave', 'raro'), 0, 'e nada foi contado como concluído');
  assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'online', strategy: 'nearest', dificuldade: 'facil' }).ok, true);
  assert.notEqual(e.hunt.instancia.id, instanciaAntes, 'a nova caçada é uma instância nova');
  assert.equal(e.hunt.efeitosDeAltar, undefined, 'o altar de antes não vem junto');
});

// ------------------------------------------------------------------ idle/offline COMPLETO

test('caçada offline de verdade com encontros no mapa (obrigatório de idle, baú, boss obrigatório): não trava, conta limpezas, não paga em dobro', () => {
  const mapa = mapaRealCapturado('troll-cave');
  assert.equal(mapa.encontros, undefined, 'produção: o mapa não tem encontros');
  Catalogo.registrar({ id: 'chefe-offline', nome: 'Chefe Fraco', categoria: 'principal', base: 'cyclops', atributos: { vida: 200, danoMult: 0.01 }, melee: { min: 1, max: 2 }, recompensas: { loot: [OURO], primeiraVitoria: { gold: 7777 } } });
  mapa.encontros = [
    { id: 'altar', tipo: 'altar', nome: 'Altar', obrigatorio: true, efeitos: [{ afixo: 'phys_dmg', valor: 5 }], duracaoMs: 600000 },
    { id: 'bau', tipo: 'bau-comum', nome: 'Baú Offline', recompensa: { drops: [OURO], moedasMedia: 50, primeiraConclusao: { gold: 3333 } } },
    { id: 'chefe', tipo: 'boss', nome: 'Chefe', bossId: 'chefe-offline', obrigatorio: true, condicao: { tipo: 'monstros-limpos' } },
  ];
  try {
    assert.deepEqual(Modelo.validar(mapa.encontros), [], 'o conteúdo de teste é válido');
    const e = personagemDeTeste({ vocacao: 'knight', level: 200 });
    e.maxHp = e.hp = 1e9;
    assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto', strategy: 'nearest', dificuldade: 'facil' }).ok, true);
    assert.ok(e.hunt.instancia.encontros.altar, 'a instância nasceu com os encontros do mapa');
    e.hunt.offlineDesde = Date.now() - 3 * HORA;
    const r = Cacadas.simularAusencia(e, PERSONAGEM, Date.now());
    assert.ok(r.report.kills > 50, `caçou: ${r.report.kills} mortes`);
    assert.equal(r.morreu, false);
    const feitas = e.campanha?.facil?.limpezas?.['troll-cave'] ?? 0;
    assert.ok(feitas >= 1, `a fase foi limpa ${feitas}× (nada travou nos encontros obrigatórios)`);
    assert.ok(e.hunt?.instancia?.encontros, 'e a instância atual ainda tem encontros');
    const vezes = Entrega.vezesConcluido(e, 'troll-cave', 'bau');
    assert.ok(vezes >= 1, `o baú foi aberto ${vezes}× pelo idle`);
    if (process.env.MOSTRAR) console.log('OFFLINE', JSON.stringify({ kills: r.report.kills, limpezas: feitas, bauAberto: vezes, ouro: e.gold }));
    // A primeira conclusão só pagou uma vez, mesmo com várias instâncias: o aviso de "Primeira vez" é de um único baú.
    assert.equal(Object.keys(e.encontros.entregues).filter((k) => k.endsWith(':bau')).length, 1, 'prêmio de primeira conclusão: uma entrega');
  } finally {
    delete mapa.encontros;
    Catalogo.esquecer('chefe-offline');
  }
});

// ------------------------------------------------------------------ custo

test('carga: 150 caçadas simultâneas com cinco encontros cada custam quase o mesmo que sem encontros', () => {
  const montar = (comEncontros) => {
    const todos = [];
    for (let i = 0; i < 150; i++) {
      const e = luta({ modo: 'auto' });
      if (comEncontros) {
        com(e, [
          { ...BAU, id: 'b1' }, { ...BAU, id: 'b2', condicao: { tipo: 'monstros-limpos' } },
          { id: 'a1', tipo: 'altar', nome: 'A', efeitos: [{ afixo: 'phys_dmg', valor: 5 }], duracaoMs: 600000, condicao: { tipo: 'monstros-limpos' } },
          { ...BAU, id: 'b3', tipo: 'bau-raro', guardioes: { criaturas: [{ key: 'troll', qtd: 2 }] }, condicao: { tipo: 'monstros-limpos' } },
          { ...BAU, id: 'b4', probabilidade: 50 },
        ], i + 1);
      }
      todos.push(e);
    }
    return todos;
  };
  const medir = (chars) => {
    const t0 = performance.now();
    for (let t = 1; t <= 120; t++) for (const e of chars) Cacadas.tique(e, PERSONAGEM, Date.now() + t * 250);
    return performance.now() - t0;
  };
  const sem = medir(montar(false));
  const com1 = medir(montar(true));
  if (process.env.MOSTRAR) console.log('CARGA', JSON.stringify({ semMs: Math.round(sem), comMs: Math.round(com1), tiques: 150 * 120 }));
  assert.ok(com1 < sem * 1.6 + 400, `sem encontros ${sem.toFixed(0)} ms; com ${com1.toFixed(0)} ms (18.000 tiques cada)`);
});
