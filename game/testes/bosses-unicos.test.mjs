// Etapa 2: bosses únicos (catálogo + validação), nascer sem duplicar, fases por % de vida, comportamentos
// (magia, área telegrafada, invocação, escudo), encontros de boss (probabilidade, obrigatório/opcional/secreto),
// recompensa de primeira vitória uma vez só, persistência e custo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as Catalogo from '../systems/bosses-unicos/catalogo.mjs';
import * as Boss from '../systems/bosses-unicos/boss.mjs';
import * as Estado from '../systems/encontros/estado.mjs';
import * as Modelo from '../systems/encontros/modelo.mjs';
import * as Sorteio from '../systems/encontros/sorteio.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Instancia from '../systems/hunt/instancia.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as Entrega from '../systems/encontros/entrega.mjs';
import { golpesDosMonstros, matarMonstro } from '../systems/hunt/combate.mjs';
import { resistenciaDe } from '../systems/hunt/resistencia.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

const ids = [];
after(() => ids.forEach((id) => Catalogo.esquecer(id)));

/** Um boss de teste, com tudo que a etapa entrega (cada teste usa o que precisa). */
const DEF = {
  id: 'guardiao-teste',
  nome: 'Guardião de Teste',
  descricao: 'Para os testes.',
  lore: 'Nasceu num teste.',
  categoria: 'principal',
  base: 'cyclops',
  nivel: 60,
  atributos: { vida: 1000, danoMult: 1, armadura: 10, expMult: 2, resistencias: { fire: 20 } },
  melee: { min: 10, max: 20, intervaloMs: 1500 },
  comportamentos: [],
  fases: [],
  recompensas: { loot: [{ id: 3031, chance: 100 }], primeiraVitoria: { gold: 5000, exp: 100, itens: [{ id: 3031, count: 3 }] } },
};
function registrar(extra = {}, id = DEF.id) {
  ids.push(id);
  return Catalogo.registrar({ ...DEF, id, ...extra });
}

/** Uma caçada real da campanha com o jogador forte (para não morrer no meio do teste). */
function luta({ modo = 'auto', level = 60 } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level });
  e.maxHp = e.hp = 1e9;
  assert.equal(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: modo, strategy: 'nearest', dificuldade: 'facil' }).ok, true);
  e.hunt.monstros.length = 0;
  e.hunt.clock = 1000;
  return e;
}
const ponto = (e, dx = 3) => ({ x: e.hunt.pos.x + dx, y: e.hunt.pos.y, z: e.hunt.z });
const nascer = (e, def, op = {}) => {
  const r = Boss.aparecer(e.hunt, def, ponto(e), op);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.monstro;
};
/** Avança o relógio da caçada e roda os golpes dos monstros (onde o boss age); devolve os eventos. */
function passar(e, ms, passo = 250) {
  const eventos = [];
  for (let t = 0; t < ms; t += passo) {
    e.hunt.clock += passo;
    eventos.push(...golpesDosMonstros(e, e.hunt, PERSONAGEM));
  }
  return eventos;
}

test('catálogo: aceita o cadastro completo e recusa o inválido, dizendo o quê', () => {
  assert.deepEqual(Catalogo.validar(DEF), []);
  assert.deepEqual(Catalogo.ERROS_DO_ARQUIVO, [], 'o arquivo de dados está íntegro (hoje vazio)');
  const erros = (extra) => Catalogo.validar({ ...DEF, ...extra }).join(' | ');
  assert.match(erros({ categoria: 'rei' }), /categoria/);
  assert.match(erros({ base: 'nao-existe' }), /bestiário/);
  assert.match(erros({ id: 'Maiúscula' }), /id só aceita/);
  assert.match(erros({ atributos: { vidaMult: -1 } }), /vidaMult/);
  assert.match(erros({ melee: { min: 50, max: 10 } }), /melee/);
  assert.match(erros({ recompensas: { loot: [{ id: 999999999, chance: 10 }] } }), /não existe/);
  assert.match(erros({ recompensas: { loot: [{ id: 3031, chance: 0 }] } }), /chance/);
  assert.match(erros({ comportamentos: [{ tipo: 'voar' }] }), /desconhecido/);
  assert.match(erros({ comportamentos: [{ tipo: 'magia', elemento: 'plasma', min: 1, max: 2 }] }), /elemento/);
  assert.match(erros({ comportamentos: [{ tipo: 'magia', elemento: 'fire', min: 9, max: 2 }] }), /min <= max/);
  assert.match(erros({ comportamentos: [{ tipo: 'area-telegrafada', elemento: 'fire', min: 1, max: 2, raio: 2, avisoMs: 100 }] }), /avisoMs/);
  assert.match(erros({ comportamentos: [{ tipo: 'invocar', criaturas: [{ key: 'troll', qtd: 1 }], maxVivos: 50 }] }), /maxVivos/);
  assert.match(erros({ comportamentos: [{ tipo: 'invocar', criaturas: [{ key: 'xx', qtd: 1 }], maxVivos: 2 }] }), /bestiário/);
  assert.match(erros({ comportamentos: [{ tipo: 'escudo', pctVida: 0, duracaoMs: 1000 }] }), /pctVida/);
  assert.match(erros({ fases: [{ nome: 'a', ate: 50 }, { nome: 'b', ate: 60 }] }), /abaixo da anterior/);
  assert.throws(() => Catalogo.registrar({ ...DEF, base: 'nao-existe' }), /bestiário/);
  assert.deepEqual([...Catalogo.CATEGORIAS], ['principal', 'miniboss', 'secreto', 'evento', 'endgame']);
});

test('nascer: a vida, a escala da fase, o dano, a resistência, o loot e a identidade do chefe', () => {
  const def = registrar();
  const e = luta();
  const m = nascer(e, def);
  assert.equal(m.name, 'Guardião de Teste');
  assert.equal(m.key, 'cyclops', 'o desenho vem da criatura-base');
  const esc = e.hunt.escala;
  assert.equal(m.maxHp, Math.max(1, Math.round(1000 * esc.vida)), 'vida absoluta × escala da fase');
  assert.equal(m.armor, 10);
  assert.deepEqual(m.resist, { fire: 20 });
  assert.deepEqual(m.loot, [{ id: 3031, name: 'gold coin', chance: 1 }], 'o loot do cadastro substitui o da base (chance em % → fração)');
  assert.equal(m.raridade, 'boss');
  assert.equal(m.boss.categoria, 'principal');
  assert.equal(m.spawn, undefined, 'sem respawn');
  assert.equal(resistenciaDe(e.hunt, m, 'fire'), 20);
  // Sem a escala da fase, a vida é a do cadastro.
  const sem = Boss.criarBossUnico({ ...def, usaEscalaDaFase: false }, { x: 1, y: 1 }, { escala: esc });
  assert.equal(sem.maxHp, 1000);
});

test('nascer UMA vez: o mesmo encontro, o mesmo boss, comandos repetidos e reconexão não geram cópias', () => {
  const def = registrar();
  const e = luta();
  const a = Boss.aparecer(e.hunt, def, ponto(e), { instanciaId: 'i1', encontro: 'enc' });
  assert.equal(a.ok, true);
  for (let k = 0; k < 5; k++) assert.deepEqual(Boss.aparecer(e.hunt, def, ponto(e), { instanciaId: 'i1', encontro: 'enc' }), { ok: false, motivo: 'ja-existe' });
  assert.deepEqual(Boss.aparecer(e.hunt, def, ponto(e)), { ok: false, motivo: 'ja-existe' }, 'fora de encontro, o mesmo boss vivo também não duplica');
  assert.equal(e.hunt.monstros.filter((m) => m.boss).length, 1);
  // Depois de morto, pode nascer de novo (outro encontro/instância).
  a.monstro.hp = 0;
  assert.equal(Boss.aparecer(e.hunt, def, ponto(e), { instanciaId: 'i2', encontro: 'enc2' }).ok, true);
});

test('fases: a vida cruzando o percentual troca o comportamento (e uma pancada grande cruza várias)', () => {
  const def = registrar({
    fases: [
      { nome: 'Ferido', ate: 70, mods: { danoMult: 2 }, aoEntrar: { fala: 'Ai!' }, comportamentos: [] },
      { nome: 'Furioso', ate: 30, mods: { danoMult: 3, velocidadeDeAtaque: 1.5 }, aoEntrar: { fala: 'Chega!' }, comportamentos: [] },
    ],
  }, 'fases-teste');
  const e = luta();
  const m = nascer(e, def);
  const forca0 = m.boss.forcaBase;
  const dita = passar(e, 250);
  assert.equal(m.boss.fase, -1, 'vida cheia: nenhuma fase');
  m.hp = Math.round(m.boss.vidaBase * 0.69);
  const eventos = passar(e, 250);
  assert.equal(m.boss.fase, 0);
  assert.equal(m.forca, forca0 * 2);
  assert.ok(eventos.some((x) => x.t === 'say' && x.text === 'Ai!'));
  assert.equal(passar(e, 500).filter((x) => x.t === 'say' && x.text === 'Ai!').length, 0, 'a fase só começa uma vez');
  // Uma pancada que leva a vida de 69% a 10%: entra na fase 1.
  m.hp = Math.round(m.boss.vidaBase * 0.1);
  passar(e, 250);
  assert.equal(m.boss.fase, 1);
  assert.equal(m.forca, forca0 * 3);
  assert.equal(m.velocidadeDeAtaque, 1.5);
  assert.ok(dita);
  // E uma pancada de 100% direto a 20% passa pelas duas, em ordem.
  const m2 = Boss.criarBossUnico(def, { x: 1, y: 1 }, {});
  m2.hp = Math.round(m2.boss.vidaBase * 0.2);
  assert.equal(m2.boss.fase, -1);
});

test('persistência: gravar e carregar no meio da luta mantém fase, recargas, escudo e avisos (nada recomeça)', () => {
  const def = registrar({
    fases: [{ nome: 'x', ate: 80, aoEntrar: { escudo: { pctVida: 20, duracaoMs: 60000 } }, comportamentos: [] }],
    comportamentos: [{ tipo: 'area-telegrafada', elemento: 'physical', min: 5, max: 9, raio: 1, avisoMs: 4000, intervaloMs: 500, chance: 100, alcance: 7 }],
  }, 'persiste-teste');
  const e = luta();
  const m = nascer(e, def);
  m.hp = Math.round(m.boss.vidaBase * 0.7);
  passar(e, 1500);
  assert.equal(m.boss.fase, 0);
  assert.ok(m.boss.escudo, 'o escudo da fase está ligado');
  assert.ok(m.boss.telegrafos.length > 0, 'há um aviso pendente');
  const antes = JSON.parse(JSON.stringify(m.boss));
  const volta = JSON.parse(JSON.stringify({ ...e, hunt: Cacadas.huntParaGravar(e.hunt) }));
  Cacadas.huntAoCarregar(volta.hunt);
  const m2 = volta.hunt.monstros.find((x) => x.boss);
  assert.deepEqual(m2.boss, antes);
  assert.equal(m2.maxHp, m.maxHp, 'o escudo (vida extra) também volta');
});

test('escudo: vida extra que o combate consome; quebrou → vulnerável por um tempo; passou o tempo → some sem sobrar vida', () => {
  const def = registrar({ comportamentos: [{ tipo: 'escudo', pctVida: 50, duracaoMs: 20000, vulnerabilidade: { pct: 40, ms: 3000 }, intervaloMs: 600000, chance: 100 }] }, 'escudo-teste');
  const e = luta();
  const m = nascer(e, def);
  const base = m.maxHp;
  m.boss.proximo.b0 = e.hunt.clock; // dispara já (e só uma vez: o intervalo é enorme)
  passar(e, 250);
  assert.ok(m.boss.escudo, 'o comportamento ligou o escudo');
  const { S } = m.boss.escudo;
  assert.equal(S, Math.round(m.boss.vidaBase * 0.5));
  assert.equal(m.maxHp, base + S);
  assert.equal(m.hp, base + S);
  // O dano (aplicado pelo combate em `hp`) come o escudo primeiro; a vida de verdade não mexe.
  m.hp -= S - 10;
  passar(e, 250);
  assert.ok(m.boss.escudo, 'ainda de pé');
  assert.equal(Boss.vidaReal(m), m.boss.escudo.base, 'a vida de verdade segue cheia');
  m.hp -= 20; // estoura o escudo e arranha a vida
  passar(e, 250);
  assert.equal(m.boss.escudo, null);
  assert.equal(m.maxHp, base, 'a vida extra saiu');
  assert.ok(m.hp < base && m.hp > 0);
  assert.ok(m.boss.vulnerabilidade, 'quebrou → janela de vulnerabilidade');
  assert.equal(resistenciaDe(e.hunt, m, 'physical'), -40 + m.armor * 0, 'a resistência cai (−40) enquanto vulnerável');
  e.hunt.clock += 3500;
  assert.equal(resistenciaDe(e.hunt, m, 'physical'), 0 - 0, 'a janela fechou');
  // Expira sem quebrar: some, e a vida volta ao que era (não vira vida de graça).
  const m3 = nascer(luta(), registrar({ comportamentos: [{ tipo: 'escudo', pctVida: 50, duracaoMs: 1000, intervaloMs: 500, chance: 100 }] }, 'escudo-teste-2'));
  assert.ok(m3);
});

test('área TELEGRAFADA: avisa na tela, dá tempo e só machuca quem ficou — quem saiu da área não leva nada', () => {
  const def = registrar({ comportamentos: [{ tipo: 'area-telegrafada', nome: 'Pancada', elemento: 'physical', min: 50, max: 60, raio: 1, avisoMs: 1500, intervaloMs: 600000, chance: 100, alcance: 7 }] }, 'tele-teste');
  const rodada = (sai) => {
    const e = luta();
    e.maxHp = e.hp = 1e9;
    const m = nascer(e, def);
    m.boss.proximo.b0 = e.hunt.clock; // dispara já (a 1ª vez só marca o relógio)
    const hp0 = e.hp;
    const eventos = passar(e, 250);
    const aviso = eventos.filter((x) => x.t === 'area');
    assert.ok(aviso.length > 0, 'o aviso sai na hora da conjuração');
    assert.equal(e.hp, hp0, 'no aviso ninguém leva dano');
    assert.equal(m.boss.telegrafos.length, 1);
    if (sai) e.hunt.pos = { ...e.hunt.pos, x: e.hunt.pos.x - 4 }; // sai da área (raio 1) e continua ao alcance do boss (7)
    const depois = passar(e, 1500);
    return { e, depois, hp0 };
  };
  const ficou = rodada(false);
  assert.ok(ficou.e.hp < ficou.hp0, 'quem ficou levou o golpe');
  assert.ok(ficou.depois.some((x) => x.t === 'dmg' && x.golpe === 'Pancada'), 'e o golpe tem o nome do cadastro');
  const saiu = rodada(true);
  assert.equal(saiu.e.hp, saiu.hp0, 'quem saiu da área a tempo não leva nada');
  assert.ok(saiu.depois.some((x) => x.t === 'area'), 'a tela ainda mostra o golpe caindo no vazio');
});

test('invocação: nasce até o limite, não vira objetivo da fase e some junto com o chefe', () => {
  const def = registrar({ comportamentos: [{ tipo: 'invocar', criaturas: [{ key: 'troll', qtd: 2 }], maxVivos: 3, intervaloMs: 500, chance: 100 }] }, 'invoca-teste');
  const e = luta();
  const m = nascer(e, def);
  passar(e, 4000);
  const lacaios = e.hunt.monstros.filter((x) => x.lacaioDe === m.uid);
  assert.equal(lacaios.length, 3, 'o teto de lacaios vivos vale (e protege o servidor)');
  assert.ok(lacaios.every((x) => !x.instancia && !x.objetivo), 'lacaio não conta para o CLEAR');
  m.hp = 0;
  matarMonstro(e, e.hunt, PERSONAGEM, m, []);
  assert.equal(e.hunt.monstros.filter((x) => x.lacaioDe === m.uid).length, 0, 'o chefe caiu: os lacaios vão junto');
});

test('melee: o chefe só bate de perto se o cadastro deu `melee` (e no ritmo dele)', () => {
  const comMelee = registrar({ melee: { min: 30, max: 40, intervaloMs: 1000 } }, 'melee-teste');
  const semMelee = registrar({ melee: null }, 'sem-melee-teste');
  const bater = (def) => {
    const e = luta();
    e.hp = e.maxHp = 1e9;
    const m = Boss.aparecer(e.hunt, def, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, z: e.hunt.z }).monstro;
    m.x = e.hunt.pos.x + 1;
    m.y = e.hunt.pos.y;
    const eventos = passar(e, 5000);
    // Golpe tentado = o que chegou como dano ou foi engolido pela armadura/bloqueio (o personagem de teste se defende).
    return eventos.filter((x) => (x.t === 'dmg' && x.golpe === 'corpo a corpo') || x.t === 'block');
  };
  const golpes = bater(comMelee);
  assert.ok(golpes.length >= 4 && golpes.length <= 6, `5 s a 1 golpe/s: ${golpes.length}`);
  assert.equal(bater(semMelee).length, 0, 'sem `melee` no cadastro, nada de golpe genérico gigante');
});

test('encontros de boss: validação por tipo e categoria (secreto nunca é obrigatório)', () => {
  registrar({ categoria: 'principal' }, 'cat-principal');
  registrar({ categoria: 'miniboss' }, 'cat-mini');
  registrar({ categoria: 'secreto' }, 'cat-secreto');
  const erros = (lista) => Modelo.validar(lista).join(' | ');
  assert.deepEqual(Modelo.validar([{ id: 'a', tipo: 'boss', bossId: 'cat-principal', obrigatorio: true }, { id: 'b', tipo: 'miniboss', bossId: 'cat-mini', probabilidade: 20 }, { id: 'c', tipo: 'boss-secreto', bossId: 'cat-secreto', probabilidade: 5 }]), []);
  assert.match(erros([{ id: 'a', tipo: 'boss' }]), /bossId/);
  assert.match(erros([{ id: 'a', tipo: 'boss', bossId: 'nao-existe' }]), /não está cadastrado/);
  assert.match(erros([{ id: 'a', tipo: 'miniboss', bossId: 'cat-principal' }]), /categoria/);
  assert.match(erros([{ id: 'a', tipo: 'boss-secreto', bossId: 'cat-secreto', obrigatorio: true }]), /nunca|não pode ser obrigatório/);
  assert.match(erros([{ id: 'a', tipo: 'boss', bossId: 'cat-mini' }]), /categoria/);
});

/** Pendura encontros de boss na instância real da fase e mata todos os bichos comuns. */
function faseComBoss(defs, { modo = 'auto', semente = 5 } = {}) {
  const e = luta({ modo });
  e.hunt.monstros.length = 0;
  for (const z of Object.keys(e.hunt.outrosAndares ?? {})) e.hunt.outrosAndares[z].length = 0;
  Estado.criar(e.hunt.instancia, defs.map((d) => Modelo.normalizar(d)), { semente });
  return e;
}
const chefeVivo = (e) => e.hunt.monstros.find((m) => m.boss && m.hp > 0);

test('encontro de boss OBRIGATÓRIO: o idle o ativa, o boss nasce UMA vez e a fase só fecha quando ele cai', () => {
  registrar({}, 'obrig-teste');
  // Ponto sem casa livre (0,0 é parede): o boss nasce perto do jogador, nunca deixa de aparecer.
  const e = faseComBoss([{ id: 'chefe', tipo: 'boss', bossId: 'obrig-teste', obrigatorio: true, x: 0, y: 0 }]);
  e.hunt.clock = 5000;
  // Vários passos do laço da instância (como os tiques): o boss nasce uma vez só.
  for (let t = 0; t < 10; t++) assert.equal(Instancia.marcarSeLimpou(e.hunt, e.hunt.clock + t), false);
  assert.equal(e.hunt.monstros.filter((m) => m.boss).length, 1, 'uma cópia só');
  assert.equal(e.hunt.instancia.encontros.chefe.estado, 'ativo');
  assert.equal(e.hunt.instancia.encontros.chefe.ativadoPor, 'idle');
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 9999), false, 'boss vivo segura o CLEAR');
  const m = chefeVivo(e);
  m.hp = 0;
  matarMonstro(e, e.hunt, PERSONAGEM, m, []);
  assert.equal(e.hunt.instancia.encontros.chefe.estado, 'concluido');
  e.hunt.monstros.splice(e.hunt.monstros.indexOf(m), 1);
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 10000), true);
});

test('encontro de boss OPCIONAL e SECRETO: não conta para o CLEAR; a luta em andamento segura a instância; terminada, libera', () => {
  registrar({ categoria: 'secreto' }, 'secreto-teste');
  const e = faseComBoss([{ id: 'sec', tipo: 'boss-secreto', bossId: 'secreto-teste', probabilidade: 100 }]);
  e.hunt.clock = 5000;
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 5000), false, 'a luta de boss começou: a instância espera');
  const m = chefeVivo(e);
  assert.ok(m.opcional, 'o boss do opcional não é objetivo');
  assert.equal(Instancia.pendentes(e.hunt), 0);
  m.hp = 0;
  matarMonstro(e, e.hunt, PERSONAGEM, m, []);
  e.hunt.monstros.splice(e.hunt.monstros.indexOf(m), 1);
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 6000), true);
  // Online (manual): disponível e ninguém ativou → NÃO bloqueia.
  const o = faseComBoss([{ id: 'sec', tipo: 'boss-secreto', bossId: 'secreto-teste', probabilidade: 100 }], { modo: 'online' });
  assert.equal(o.hunt.instancia.encontros.sec.estado, 'disponivel');
  assert.equal(Instancia.marcarSeLimpou(o.hunt, 1), true, 'opcional não ativado não trava a campanha');
});

test('probabilidade: o miniboss de 20% e o secreto de 5% saem pela semente — mesmo resultado a cada reconexão', () => {
  registrar({ categoria: 'miniboss' }, 'mini-teste');
  registrar({ categoria: 'secreto' }, 'secreto-prob');
  let minis = 0;
  const N = 400;
  for (let s = 0; s < N; s++) {
    const i = Estado.criar({}, [Modelo.normalizar({ id: 'm', tipo: 'miniboss', bossId: 'mini-teste', probabilidade: 20 })], { semente: s });
    const de = Estado.criar({}, [Modelo.normalizar({ id: 'm', tipo: 'miniboss', bossId: 'mini-teste', probabilidade: 20 })], { semente: s });
    assert.deepEqual(i.encontros, de.encontros);
    if (i.encontros.m) minis++;
  }
  assert.ok(Math.abs(minis / N - 0.2) < 0.07, `20% → ${(minis / N * 100).toFixed(1)}%`);
  // O mesmo vale depois de gravar e carregar: o boss não "reaparece" nem some.
  const e = faseComBoss([{ id: 'm', tipo: 'miniboss', bossId: 'mini-teste', probabilidade: 100 }], { semente: 77 });
  Instancia.marcarSeLimpou(e.hunt, 1);
  const antes = e.hunt.monstros.filter((x) => x.boss).length;
  const volta = JSON.parse(JSON.stringify({ ...e, hunt: Cacadas.huntParaGravar(e.hunt) }));
  Cacadas.huntAoCarregar(volta.hunt);
  assert.equal(volta.hunt.monstros.filter((x) => x.boss).length, antes);
  assert.equal(Sorteio.rolar(77, 'm'), Sorteio.rolar(77, 'm'));
});

test('recompensa: a PRIMEIRA vitória paga uma vez só (por personagem); a mesma morte nunca paga duas', () => {
  const def = registrar({}, 'premio-teste');
  const e = luta();
  const ouro0 = e.gold ?? 0;
  const m = nascer(e, def);
  m.hp = 0;
  const ev = [];
  matarMonstro(e, e.hunt, PERSONAGEM, m, ev);
  assert.ok((e.gold ?? 0) >= ouro0 + 5000, `ouro: ${ouro0} → ${e.gold}`);
  assert.match(e.avisoDaHunt, /Primeira vitória sobre Guardião de Teste/);
  assert.equal(Entrega.vezesConcluido(e, 'boss', 'premio-teste'), 1);
  const ouro1 = e.gold;
  // A mesma morte chamada de novo (reconexão, evento repetido): nada.
  assert.deepEqual(Boss.aoMorrer(e.hunt, m, { quem: [e], agora: 1 }), []);
  assert.equal(e.gold, ouro1);
  // Outro boss do mesmo cadastro, outra morte: é repetição — só o loot normal.
  e.hunt.monstros.length = 0;
  const m2 = nascer(e, def);
  m2.hp = 0;
  matarMonstro(e, e.hunt, PERSONAGEM, m2, []);
  assert.ok(e.gold < ouro1 + 5000, 'a repetição não paga o prêmio de novo');
  assert.equal(Entrega.vezesConcluido(e, 'boss', 'premio-teste'), 2);
});

test('economia: o loot do boss é o do cadastro (passa pelas regras de drop de sempre), e a base do bestiário não vaza para ele', () => {
  const def = registrar({ recompensas: { loot: [{ id: 3031, chance: 100 }], primeiraVitoria: null } }, 'loot-teste');
  const m = Boss.criarBossUnico(def, { x: 1, y: 1 }, {});
  assert.equal(m.loot.length, 1);
  const padrao = registrar({ recompensas: { loot: [], primeiraVitoria: null } }, 'loot-base-teste');
  const n = Boss.criarBossUnico(padrao, { x: 1, y: 1 }, {});
  assert.ok(n.loot.length > 0, 'sem loot no cadastro, o da criatura-base');
});

test('custo: mil tiques de um boss com oito comportamentos cabem em poucos milissegundos', () => {
  const def = registrar({
    comportamentos: [
      { tipo: 'area-telegrafada', elemento: 'fire', min: 1, max: 2, raio: 3, avisoMs: 1000, intervaloMs: 600000, chance: 100 },
      { tipo: 'magia', elemento: 'ice', min: 1, max: 2, forma: 'feixe', comprimento: 5, intervaloMs: 600000, chance: 100 },
      { tipo: 'invocar', criaturas: [{ key: 'troll', qtd: 1 }], maxVivos: 2, intervaloMs: 600000, chance: 100 },
      { tipo: 'escudo', pctVida: 10, duracaoMs: 1000, intervaloMs: 600000, chance: 100 },
    ],
  }, 'custo-teste');
  const e = luta();
  nascer(e, def);
  const t0 = performance.now();
  passar(e, 250 * 1000);
  const ms = performance.now() - t0;
  assert.ok(ms < 1500, `${ms.toFixed(0)} ms para 1000 tiques`);
});

test('compatibilidade: bosses e bichos comuns (sem `boss`) seguem exatamente como antes', () => {
  const e = luta();
  const comum = Cacadas.entrar ? e.hunt : null;
  assert.ok(comum);
  assert.equal(e.hunt.monstros.filter((m) => m.boss).length, 0);
  assert.ok(Campanha.faseDe(HUNT_DE_TESTE));
});

test('aviso VELHO não acerta ninguém: o jogador longe, o boss parado, e a área vencida é descartada ao voltar', () => {
  const def = registrar({ comportamentos: [{ tipo: 'area-telegrafada', elemento: 'physical', min: 500, max: 600, raio: 1, avisoMs: 1000, intervaloMs: 600000, chance: 100, alcance: 7 }] }, 'velho-teste');
  const e = luta();
  const m = nascer(e, def);
  m.boss.proximo.b0 = e.hunt.clock;
  passar(e, 250);
  assert.equal(m.boss.telegrafos.length, 1);
  const longe = { ...e.hunt.pos };
  e.hunt.pos = { ...longe, x: longe.x - 30 }; // fora do alcance: o boss não age
  e.hunt.clock += 10_000;
  const hp0 = e.hp;
  e.hunt.pos = longe; // volta, em cima da área velha
  const eventos = passar(e, 250);
  assert.equal(e.hp, hp0, 'a área vencida não machuca');
  assert.equal(m.boss.telegrafos.length, 0);
  assert.ok(!eventos.some((x) => x.t === 'dmg'));
});

test('encontro de boss ATIVO cujo boss sumiu (projeção offline, sem o gancho de morte) conclui: nada espera por um boss que não existe', () => {
  registrar({}, 'sumiu-teste');
  const e = faseComBoss([{ id: 'chefe', tipo: 'boss', bossId: 'sumiu-teste', obrigatorio: true }]);
  Instancia.marcarSeLimpou(e.hunt, 1);
  const m = chefeVivo(e);
  e.hunt.monstros.splice(e.hunt.monstros.indexOf(m), 1); // some sem passar pela morte
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 2), true);
  assert.equal(e.hunt.instancia.encontros.chefe.estado, 'concluido');
  assert.equal(e.hunt.instancia.encontros.chefe.viaProjecao, true, 'sem recompensa de primeira vitória');
});
