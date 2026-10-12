// Os MODIFICADORES DE MONSTRO E DE MAPA ligados (dono, 12/10: "ligar os modificadores" — o que a árvore de passivas combate) de ponta a
// ponta: o monstro do PoE com o modificador (ou com o que o mapa pôs nele) acerta você → o efeito em você (Cegueira, Mutilação, Empalamento,
// Exposição, Sangue Corrompido, a afecção inerente do Golpe Crítico), no monstro (o dreno de vida, as cargas) ou o dano de volta (os
// espinhos dos Raros); e o nó REAL da árvore, alocado pelo servidor, que impede ou reduz cada um.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const ModsMonstro = await import('../systems/itens-poe/modificadores-monstro.mjs');
const Mecanicas = await import('../systems/mobs/mecanicas.mjs');
const BuffsDeMob = await import('../systems/mobs/buffs.mjs');
const AtributosDoMob = await import('../systems/mobs/atributos.mjs');
const NoJogador = await import('../systems/itens-poe/monstros-no-jogador.mjs');
const MapasAreas = await import('../systems/itens-poe/mapas-areas.mjs');
const Mapas = await import('../systems/itens-poe/mapas.mjs');
const Validacao = await import('../systems/itens-poe/mapas-validacao.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Poderes = await import('../systems/poderes.mjs');
const { criarMonstro } = await import('../systems/hunt/monstros.mjs');
const { contraAtaque } = await import('../systems/hunt/combate.mjs');
const { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } = await import('./apoio.mjs');
if (!SEM) ModsMonstro.iniciar();

function novo(classe = 'Scion') {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: classe });
  delete e.classe;
  P.garantir(e);
  e.equipment = {};
  e.maxHp = e.hp = 10000;
  return e;
}
/** O nó (ou a opção de maestria) com um efeito cuja chave casa `re`: a principal primeiro, depois as maestrias. */
function achar(re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  const comum = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  if (comum) return { no: comum };
  for (const n of arv.nos.filter((x) => x.tipo === 'mastery' && !x.ascendencia)) {
    const o = (n.opcoes ?? []).find((x) => tem(x.efeitos));
    if (o) return { no: n, opcao: o.id };
  }
  return null;
}
/** Aloca o caminho até o nó (até o notável que abre a maestria) e o próprio nó (com a opção). */
function alocar(e, re) {
  const achado = achar(re);
  if (!achado) return naAscendencia(e, re);
  assert.ok(achado, `há nó na árvore com ${re}`);
  const { no, opcao } = achado;
  const ate = no.tipo === 'mastery' ? P.arvore().nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia).id : no.id;
  const caminho = P.caminhoAte(e, ate);
  const antes = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
  if (antes.length) assert.equal(Comandos.comando(e, { action: 'alocar', ids: antes }).feitos, antes.length);
  const r = Comandos.comando(e, { action: 'alocar', id: no.id, ...(opcao ? { opcao } : {}) });
  assert.ok(r.ok, JSON.stringify(r));
  Ficha.invalidar(e);
}
/** O nó só existe numa ASCENDÊNCIA: o personagem vira a classe dela, entra nela e aloca o caminho até o nó. */
function naAscendencia(e, re) {
  const no = P.arvore().nos.find((n) => n.ascendencia && (n.efeitos ?? []).some((x) => re.test(x.add ?? '')));
  assert.ok(no, `há nó na árvore (ou numa ascendência) com ${re}`);
  e.classePoe = P.arvore().ascendencias[no.ascendencia].classe;
  P.garantir(e);
  e.passivas.ascendencia = no.ascendencia;
  Comandos.depoisDeMudar(e);
  assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) }).ok);
  Ficha.invalidar(e);
}
/** A caçada de teste do personagem, com a ficha dele (a que os efeitos em você leem). */
function cacada(e, monstros = []) {
  e.hunt = { clock: 10_000, pos: { x: 0, y: 0 }, monstros, efeitosDoJogador: { hp: 1, dots: [] } };
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  Ficha.invalidar(e);
  return e.hunt;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const monstro = (extra = {}) => ({ uid: 7, key: 'rat', name: 'Rato', x: 1, y: 0, hp: 5000, maxHp: 5000, ...extra });
/** O monstro com os modificadores do PoE (`ids` sem o prefixo). */
const comMods = (ids, extra = {}) => monstro({ raridade: 'raro', mods: ids.map((id) => ModsMonstro.PREFIXO + id), ...extra });
const acertar = (e, m, opcoes = {}) => { const eventos = []; Mecanicas.aoAcertarJogador(e, e.hunt, { nome: e.nome }, m, { dano: 500, bruto: 1000, partes: { physical: 500 }, brutas: { physical: 1000 }, eventos, rng: () => 0, ...opcoes }); return eventos; };

test('CEGUEIRA: o modificador "Cegante" cega no acerto (20% menos Precisão e Evasão × o Efeito do Cegamento +100% = 40%); "Não pode ser Cegado" e "100% de chance de Evitar Cegueira" (os nós reais) impedem', { skip: SEM }, () => {
  const e = novo();
  const antes = ficha(e);
  cacada(e);
  const ev = acertar(e, comMods(['MonsterModApplyBlind']));
  assert.ok(ev.some((x) => x.estado === 'cego'));
  const depois = ficha(e);
  assert.ok(Math.abs(depois.accuracy - Math.round(antes.accuracy * 0.6)) <= 1, `${antes.accuracy} → ${depois.accuracy}`);
  assert.ok(Math.abs(depois.evasion - Math.round(antes.evasion * 0.6)) <= 1, `${antes.evasion} → ${depois.evasion}`);
  e.hunt.clock += NoJogador.NUMEROS.cegueira.duracaoMs + 1;
  assert.equal(ficha(e).accuracy, antes.accuracy, 'acaba em 4 s');
  for (const re of [/^imune_cegueira$/, /^evitar_cegueira$/]) {
    const p = novo();
    alocar(p, re);
    cacada(p);
    assert.ok(!acertar(p, comMods(['MonsterModApplyBlind'])).some((x) => x.estado === 'cego'), String(re));
    assert.equal(NoJogador.ativosEmVoce(p.hunt).cego, false);
  }
});

test('MUTILAR (o mapa "Monstros Mutilam com Ataques"): o golpe mutila (30% menos Velocidade de Movimento), a magia não; "Você não pode ser Mutilado" impede', { skip: SEM }, () => {
  const ef = {};
  for (const e of Mapas.DADOS.classe.paginas.alto.sufixos.find((m) => m.familia === 'MapMonstersMaimOnHit').efeitos) Mapas.somar(ef, e, []);
  const m = MapasAreas.aplicarEfeitos(monstro(), ef.monstros);
  assert.deepEqual(m.noAcerto, { mutilar: 100 });
  const e = novo();
  const antes = ficha(e).speed;
  cacada(e);
  acertar(e, m, { ataque: false });
  assert.equal(ficha(e).speed, antes, 'a magia não mutila');
  acertar(e, m);
  assert.ok(ficha(e).speed < antes, 'o golpe mutila');
  assert.equal(NoJogador.ativosEmVoce(e.hunt).mutilado, true);
  const p = novo();
  alocar(p, /^imune_mutilar$/);
  cacada(p);
  acertar(p, m);
  assert.equal(NoJogador.ativosEmVoce(p.hunt).mutilado, false);
});

test('EMPALAR (o mapa "Ataques dos Monstros têm 60% de chance de Empalar"): guarda 10% do Físico do acerto; os 5 acertos seguintes causam o guardado de novo; "Não pode ser Empalado" e "30% de chance de Evitar ser Empalado"', { skip: SEM }, () => {
  const linha = Mapas.DADOS.classe.paginas.alto.prefixos.find((m) => m.familia === 'MapMonstersImpaleOnHit');
  const ef = {};
  for (const x of linha.efeitos) Mapas.somar(ef, x, [60]);
  const m = MapasAreas.aplicarEfeitos(monstro(), ef.monstros);
  assert.equal(m.noAcerto.empalar, 60);
  const e = novo();
  cacada(e);
  acertar(e, m, { partes: { physical: 1000 } });
  assert.equal(NoJogador.empalamentosEmVoce(e.hunt), 1);
  const semEmpalar = monstro();
  const perdas = [];
  for (let i = 0; i < 6; i++) {
    const antes = e.hp;
    acertar(e, semEmpalar);
    perdas.push(antes - e.hp);
  }
  assert.ok(perdas.slice(0, 5).every((x) => x > 0 && x <= 100), `os 5 acertos soltam até 100 cada: ${perdas}`);
  assert.equal(perdas[5], 0, 'o sexto não tem mais nada');
  assert.equal(NoJogador.empalamentosEmVoce(e.hunt), 0);
  for (const re of [/^imune_empalar$/, /^evitar_empalar$/]) {
    const p = novo();
    alocar(p, re);
    cacada(p);
    // (a chance de evitar: 30% — o sorteio 0 evita)
    acertar(p, m, { partes: { physical: 1000 } });
    assert.equal(NoJogador.empalamentosEmVoce(p.hunt), 0, String(re));
  }
});

test('EXPOSIÇÃO: "Inflige Exposição a Fogo ao Acertar, aplicando −25%" tira 25 da resistência a Fogo por 4 s; "Efeito de Exposições em você reduzido em 50%" deixa 12,5', { skip: SEM }, () => {
  const e = novo();
  const res = (x) => Afixos.soma(x).fire_res ?? 0;
  const antes = res(e);
  cacada(e);
  acertar(e, comMods(['MonsterModExtraFireDamage']));
  assert.equal(res(e), antes - 25);
  e.hunt.clock += NoJogador.NUMEROS.exposicao.duracaoMs + 1;
  assert.equal(res(e), antes, 'acaba');
  const p = novo();
  alocar(p, /^efeito_exposicao_proprio$/);
  const antesP = res(p);
  cacada(p);
  acertar(p, comMods(['MonsterModExtraFireDamage']));
  assert.equal(res(p), antesP - 12.5);
});

test('SANGUE CORROMPIDO: o modificador põe o dano Físico contínuo em você (acumula até 10, 4 s); "Não pode ser afetado por Sangue Corrompido" impede; a Habilidade de Guarda o remove', { skip: SEM }, () => {
  const e = novo();
  cacada(e);
  const m = comMods(['MonsterModCorruptedBlood']);
  for (let i = 0; i < 12; i++) acertar(e, m);
  const dots = e.hunt.efeitosDoJogador.dots.filter((d) => d.tipo === 'sangueCorrompido');
  assert.equal(dots.length, 10, 'até 10 acúmulos');
  // 120% da média por minuto, por acúmulo, em 4 s: 1000 × 1,2 ÷ 60 × 4 = 80 cada
  assert.ok(dots.every((d) => Math.abs(d.falta - 80) < 1e-9), String(dots.map((d) => d.falta)));
  const hp = e.hp;
  e.hunt.clock += 1000;
  Mecanicas.tique(e, e.hunt, { nome: e.nome }, []);
  assert.ok(e.hp < hp, 'o pulso fere');
  const p = novo();
  alocar(p, /^imune_sangue_corrompido$/);
  cacada(p);
  acertar(p, m);
  assert.equal(p.hunt.efeitosDoJogador.dots.filter((d) => d.tipo === 'sangueCorrompido').length, 0);
  const g = novo();
  alocar(g, /^ev:usarGuarda:removerAfeccao:sangueCorrompido$/);
  cacada(g);
  acertar(g, m);
  assert.equal(g.hunt.efeitosDoJogador.dots.filter((d) => d.tipo === 'sangueCorrompido').length, 1);
  ModsPoe.evento(g, g.hunt, 'usarGuarda', ficha(g), { eventos: [], personagem: { nome: g.nome } });
  assert.equal((g.hunt.efeitosDoJogador.dots ?? []).filter((d) => d.tipo === 'sangueCorrompido').length, 0, 'a Guarda remove');
});

test('DRENO do monstro: "100% do Dano é Drenado como Vida" — a vida volta ao longo do tempo (2%/s da vida dele × 600%); "Inimigos Não Podem Drenar Vida De Você" impede; o mapa "Impossível Drenar dos Monstros" liga o semDreno', { skip: SEM }, () => {
  const e = novo();
  const m = comMods(['MonsterModDamageLeechedAsLife'], { hp: 1000 });
  cacada(e, [m]);
  acertar(e, m, { dano: 500 });
  assert.equal(m.drenoPoe.length, 1);
  e.hunt.clock += 100;
  Mecanicas.tique(e, e.hunt, { nome: e.nome }, []);
  // 5000 × 2% × (1 + 500%) = 600/s → 60 em 0,1 s
  assert.ok(Math.abs(m.hp - 1060) < 1e-6, String(m.hp));
  e.hunt.clock += 2000;
  Mecanicas.tique(e, e.hunt, { nome: e.nome }, []);
  assert.ok(Math.abs(m.hp - 1500) < 1e-6, 'drena os 500 e para');
  assert.equal(m.drenoPoe, undefined);
  const p = novo();
  alocar(p, /^inimigos_nao_drenam_vida$/);
  const m2 = comMods(['MonsterModDamageLeechedAsLife'], { hp: 1000 });
  cacada(p, [m2]);
  acertar(p, m2, { dano: 500 });
  assert.equal(m2.drenoPoe, undefined);
  const ef = {};
  for (const x of Mapas.DADOS.classe.paginas.alto.sufixos.find((l) => l.familia === 'MapMonsterLifeLeechImmunity').efeitos) Mapas.somar(ef, x, []);
  assert.equal(MapasAreas.aplicarEfeitos(monstro(), ef.monstros).semDreno, true);
});

test('o VAMPÍRICO (dono, 12/10: "igual no PoE"): sorteia; drena 100% do dano; "Dano enquanto Drenando Vida aumentado em 25%" só enquanto drena; "Inimigos Não Podem Drenar Escudo de Energia De Você" tira o seu dreno de Escudo nele', { skip: SEM }, () => {
  const mod = ModsMonstro.DADOS.mods.find((m) => m.id === 'MonsterArchnemesisVampiric');
  assert.equal(mod.estado, 'efeito', 'as 6 linhas valem');
  assert.ok(ModsMonstro.elegivel(mod, 'raro', 80) > 0 && ModsMonstro.elegivel(mod, 'magico', 80) > 0);
  const e = novo();
  const m = comMods(['MonsterArchnemesisVampiric'], { hp: 1000 });
  cacada(e, [m]);
  assert.equal(BuffsDeMob.soma(m, e.hunt.clock, 'danoPct'), 0, 'sem drenar, sem o dano a mais');
  acertar(e, m, { dano: 300 });
  assert.equal(BuffsDeMob.soma(m, e.hunt.clock, 'danoPct'), 25, 'drenando: +25%');
  e.hunt.clock += 5000;
  Mecanicas.tique(e, e.hunt, { nome: e.nome }, []);
  assert.equal(m.drenoPoe, undefined, 'o dreno acabou');
  assert.equal(BuffsDeMob.soma(m, e.hunt.clock, 'danoPct'), 0, 'o dano a mais sai junto');
  assert.equal(Mecanicas.semDrenoDeEs(m), true);
  assert.equal(Mecanicas.semDrenoDeEs(monstro()), false);
  // o seu dreno de Escudo de Energia: nada do dano no Vampírico
  const f = { ...ficha(e), energyShield: 1000, afPoe: { ...ficha(e).afPoe, es_leech: 10 } };
  e.hunt.roubos = [];
  Ficha.aplicarLeech(e, 1000, [], 'x', null, f, null, { semDrenoDeEs: 1000 });
  assert.equal(e.hunt.roubos.filter((r) => r.recurso === 'es').length, 0);
  Ficha.aplicarLeech(e, 1000, [], 'x', null, f, null, { semDrenoDeEs: 0 });
  assert.ok(e.hunt.roubos.filter((r) => r.recurso === 'es').length > 0, 'num monstro comum, drena');
});

test('CARGAS do monstro: Frenesi no acerto (até 3, +4% de velocidade de ataque e de dano cada), Tolerância por segundo se acertado recentemente, Poder do mapa (+50% de chance de crítico cada); "Monstros Inimigos não podem ganhar Cargas" impede', { skip: SEM }, () => {
  const e = novo();
  const m = comMods(['MonsterModFrenzyChargeGain']);
  cacada(e, [m]);
  for (let i = 0; i < 5; i++) acertar(e, m);
  const agora = e.hunt.clock;
  assert.equal(Mecanicas.cargasDe(m, agora).frenesi, 3);
  assert.equal(BuffsDeMob.soma(m, agora, 'velocidadeDeAtaquePct'), 12);
  assert.equal(BuffsDeMob.soma(m, agora, 'danoPct'), 12);
  assert.equal(Mecanicas.cargasDe(m, agora + 10_001).frenesi, 0, 'acabam juntas em 10 s');
  // Tolerância: só depois de ser acertado (há até 4 s), uma por segundo.
  const t = comMods(['MonsterModEnduranceChargeGain']);
  cacada(e, [t]);
  Mecanicas.tique(e, e.hunt, { nome: e.nome }, []);
  assert.equal(Mecanicas.cargasDe(t, e.hunt.clock).tolerancia, 0, 'sem ser acertado, nada');
  Mecanicas.aoReceberDano(e, e.hunt, { nome: e.nome }, t, 100, 'physical', []);
  Mecanicas.tique(e, e.hunt, { nome: e.nome }, []);
  e.hunt.clock += 1000;
  Mecanicas.tique(e, e.hunt, { nome: e.nome }, []);
  assert.equal(Mecanicas.cargasDe(t, e.hunt.clock).tolerancia, 2);
  // Poder (o mapa "Monstros ganham uma Carga de Poder ao Acertar"): a chance de crítico do monstro em você sobe.
  const ef = {};
  for (const x of Mapas.DADOS.classe.paginas.alto.sufixos.find((l) => l.familia === 'MapMonstersPowerChargeOnHit').efeitos) Mapas.somar(ef, x, []);
  const pm = MapasAreas.aplicarEfeitos(monstro(), ef.monstros);
  acertar(e, pm);
  assert.equal(ModsPoe.doBicho(pm, e.hunt.clock).criticoFator, 1.5);
  const p = novo();
  alocar(p, /^inimigos_sem_cargas$/);
  const m2 = comMods(['MonsterModFrenzyChargeGain']);
  cacada(p, [m2]);
  acertar(p, m2);
  assert.equal(Mecanicas.cargasDe(m2, p.hunt.clock).frenesi, 0);
});

test('ESPINHOS dos Raros do mapa (800 Físico): o seu acerto corpo a corpo num Raro devolve o dano; à distância ou num Comum, não; "Não pode sofrer Dano Físico Refletido" zera e "Evita +60% do dano físico refletido" corta 60%', { skip: SEM }, () => {
  const linha = Mapas.DADOS.classe.paginas.alto.prefixos.find((m) => m.familia === 'MapMonsterPhysicalReflection');
  const ef = {};
  for (const x of linha.efeitos) Mapas.somar(ef, x, [800]);
  const raro = MapasAreas.aplicarEfeitos(monstro({ raridade: 'raro' }), ef.monstros);
  const comum = MapasAreas.aplicarEfeitos(monstro(), ef.monstros);
  assert.deepEqual(raro.espinhos, { physical: 800 });
  const perda = (e, m, corpoACorpo) => { e.hp = e.maxHp; Mecanicas.aoReceberDano(e, e.hunt, { nome: e.nome }, m, 100, 'physical', [], { corpoACorpo }); return e.maxHp - e.hp; };
  const e = novo();
  cacada(e);
  const cheio = perda(e, raro, true);
  assert.ok(cheio > 0, 'corpo a corpo no Raro: o dano volta');
  assert.equal(perda(e, raro, false), 0, 'à distância, não');
  assert.equal(perda(e, comum, true), 0, 'num Comum, não');
  const imune = novo();
  alocar(imune, /^imune_reflexo_fisico$/);
  cacada(imune);
  assert.equal(perda(imune, raro, true), 0);
  const evita = novo();
  alocar(evita, /^reflexo_fisico_evitado$/);
  cacada(evita);
  const corta = perda(evita, raro, true);
  assert.ok(corta > 0 && Math.abs(corta - cheio * 0.4) <= 2, `${cheio} → ${corta}`);
});

test('a AFECÇÃO INERENTE do Golpe Crítico do monstro: Fogo incendeia, Gelo congela (0,06 s por 1% da vida), Raio eletriza (Dano recebido aumentado); "Golpes Críticos contra você não infligem Afecções Elementais de forma Inerente" tira as três', { skip: SEM }, () => {
  const golpe = { critico: true, partes: { physical: 0, fire: 500, ice: 2000, energy: 1000 }, brutas: { fire: 600, ice: 2400, energy: 1200 } };
  const e = novo();
  cacada(e);
  const ev = acertar(e, monstro(), golpe);
  const queimadura = e.hunt.efeitosDoJogador.dots.find((d) => d.tipo === 'queimadura');
  assert.ok(queimadura, 'incendeia');
  assert.equal(e.hunt.controle?.congelado?.ms, 1200, 'congela: 2000 de 10000 de vida = 20% → 1,2 s');
  const pct = NoJogador.ativosEmVoce(e.hunt).eletrizado;
  assert.ok(Math.abs(pct - Math.round(50 * 0.1 ** 0.4 * 10) / 10) < 1e-9, String(pct));
  assert.equal(Afixos.soma(e).dano_recebido_inc ?? 0, pct, 'Eletrizado: dano recebido aumentado');
  assert.ok(ev.some((x) => x.estado === 'eletrizado'));
  // sem crítico, nada
  const s = novo();
  cacada(s);
  acertar(s, monstro(), { ...golpe, critico: false });
  assert.equal(s.hunt.efeitosDoJogador.dots.length, 0);
  assert.equal(s.hunt.controle, undefined);
  const p = novo();
  alocar(p, /^critico_recebido_sem_afeccao$/);
  cacada(p);
  acertar(p, monstro(), golpe);
  assert.equal(p.hunt.efeitosDoJogador.dots.length, 0);
  assert.equal(p.hunt.controle?.congelado, undefined);
  assert.equal(NoJogador.ativosEmVoce(p.hunt).eletrizado, 0);
});

test('BLOQUEIO do monstro contra Espada: "Chance de Inimigos Bloquearem Ataques com Espada reduzida em 50%" vale só empunhando uma Espada; o bloqueio do bicho cai à metade', { skip: SEM }, () => {
  const e = novo();
  alocar(e, /^inimigos_bloqueio_red@comEspada$/);
  assert.equal(ModsPoe.valor(ficha(e), 'inimigos_bloqueio_red'), 0, 'sem Espada, nada');
  e.equipment.weapon = { id: 3357, count: 1, poe: { classe: 'One_Hand_Swords', base: 'One_Hand_Swords/X', af: {}, prefixos: [], sufixos: [], implicitos: [] } };
  assert.equal(ModsPoe.valor(ficha(e), 'inimigos_bloqueio_red'), 50);
  const m = monstro({ bloqueio: 40 });
  const b = AtributosDoMob.bloqueioDe(m);
  assert.equal(AtributosDoMob.bloqueou(m, () => b * 0.75), true, 'sem o nó, 0,75 × a chance bloqueia');
  assert.equal(AtributosDoMob.bloqueou(m, () => b * 0.75, 0.5), false, 'com a metade, não');
});

test('os mapas: as famílias ligadas validam (Cegar, Mutilar, Empalar, as três cargas, os espinhos, "Impossível Drenar") e saem da lista do que não existe', { skip: SEM }, () => {
  const ligadas = ['MapMonstersBlindOnHit', 'MapMonstersMaimOnHit', 'MapMonstersImpaleOnHit', 'MapMonstersEnduranceChargeOnHit', 'MapMonstersFrenzyChargeOnHit', 'MapMonstersPowerChargeOnHit', 'MapMonsterPhysicalReflection', 'MapMonsterElementalReflection', 'MapMonsterLifeLeechImmunity'];
  const todas = Object.values(Mapas.DADOS.classe.paginas).flatMap((p) => [...p.prefixos, ...p.sufixos]);
  for (const f of ligadas) {
    const linhas = todas.filter((m) => m.familia === f);
    assert.ok(linhas.length > 0, f);
    for (const l of linhas) for (const x of l.efeitos) {
      const valores = l.tiers[0].faixas.map(([, max]) => max);
      assert.ok(Validacao.validarEfeito(x, valores).ok, `${f}: ${JSON.stringify(Validacao.validarEfeito(x, valores))}`);
      assert.deepEqual(Validacao.conferirTexto(l.tiers[0].modelo, l.tiers[0].faixas, l.efeitos), [], f);
    }
    assert.ok(!Mapas.DADOS.naoImplementados.some((n) => n.familia === f), `${f} fora de naoImplementados`);
  }
});

test('a ÁRVORE: as linhas que os modificadores ligados combatem têm efeito no balão (não são mais "nenhum monstro do jogo faz isso")', { skip: SEM }, () => {
  const textos = [/^Não pode ser Cegado$/, /Evitar Cegueira$/, /^Você não pode ser Mutilado$/, /^Não pode ser Empalado$/, /Evitar ser Empalado$/, /^Efeito de Exposições em você reduzido/, /^Não pode ser afetado por Sangue Corrompido$/,
    /^remove Sangue Corrompido ao usar uma Habilidade de Guarda$/, /^Inimigos Não Podem Drenar Vida De Você$/, /^Monstros Inimigos não podem ganhar Cargas/, /^Golpes Críticos contra você não infligem Afecções Elementais de forma Inerente$/,
    /^Evita \+\d+% do dano (físico |elemental )?refletido$/, /^Não pode sofrer Dano (Físico|Elemental) Refletido$/, /^Dano não pode ser Refletido$/, /^Chance de Inimigos Bloquearem Ataques com Espada/];
  const arv = P.arvore();
  const linhas = arv.nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i] }))));
  for (const re of textos) {
    const achadas = linhas.filter((l) => re.test(l.t));
    assert.ok(achadas.length > 0, `há linha ${re}`);
    for (const l of achadas) assert.ok(['equivalente', 'novo', 'aproximado'].includes(l.estado), `${l.t}: ${l.estado}`);
  }
});

/** Uma caçada de verdade (a de teste) com um troll colado em você — o golpe dele passa pelo caminho inteiro do jogo. */
function cenaDeCombate(doMonstro = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.equipment = {};
  e.maxHp = e.hp = 1e6;
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  const m = Object.assign(criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null), doMonstro);
  h.monstros.splice(0, h.monstros.length, m);
  return { e, h, m };
}
const comSorte = (valor, fn) => {
  const original = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = original; }
};

test('de ponta a ponta: o GOLPE do monstro (contraAtaque) com o modificador Cegante cega você; o do mapa com Mutilar e Empalar mutila e empala', { skip: SEM }, () => {
  const a = cenaDeCombate({ raridade: 'raro', mods: [ModsMonstro.PREFIXO + 'MonsterModApplyBlind'] });
  comSorte(0.5, () => contraAtaque(a.e, a.h, PERSONAGEM, a.m, []));
  assert.equal(NoJogador.ativosEmVoce(a.h).cego, true);
  const b = cenaDeCombate({ noAcerto: { mutilar: 100, empalar: 100 } });
  comSorte(0.5, () => contraAtaque(b.e, b.h, PERSONAGEM, b.m, []));
  assert.equal(NoJogador.ativosEmVoce(b.h).mutilado, true);
  assert.equal(NoJogador.ativosEmVoce(b.h).empalamentos, 1);
});

test('de ponta a ponta: a MAGIA do monstro (dispararMagia) expõe com o modificador e não mutila (Mutilar é só dos Ataques)', { skip: SEM }, () => {
  const { e, h, m } = cenaDeCombate({ raridade: 'raro', mods: [ModsMonstro.PREFIXO + 'MonsterModExtraColdDamage'], noAcerto: { mutilar: 100 } });
  const magia = { min: 100, max: 100, elemento: 'ice' };
  comSorte(0.5, () => Poderes.dispararMagia({ estado: e, hunt: h, personagem: PERSONAGEM, bicho: m, eventos: [], agora: h.clock, ficha: ficha(e), temEscudo: false }, magia));
  assert.deepEqual(NoJogador.ativosEmVoce(h).exposicao, { ice: 25 });
  assert.equal(NoJogador.ativosEmVoce(h).mutilado, false);
});
