// (06/11, dono: "continue até dar 0 linhas sem efeito") As ARMADURAS únicas — de corpo, luvas, elmos, escudos e botas: as linhas sem efeito ganham a regra
// e, quando o jogo não tinha a mecânica, ela entra (a Corrosão, os Totens Espectrais, o Escudo de Energia dos lacaios pela Resistência a Caos, a
// Tolerância do grupo, a Causticação, as Vinhas nos inimigos, o Atordoamento pela Mana, a Violência de Kiloava, o Sofrimento Compartilhado…). As que o
// jogo não tem (os lacaios Bestiais, a Efígie de Doedre, o Rebento da Escuridão, a Forma Sombria, os Emissários que faltam…) ficam inertes, com a nota.
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
const Cargas = await import('../systems/itens-poe/cargas.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

function unico(classe, slug) {
  const c = Catalogo.catalogo().classes[classe];
  const u = c.unicos.find((x) => x.slug === slug);
  const b = c.bases.find((x) => x.nome === u.base);
  return Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: b.id, raridade: 'unico', ilvl: 84, rng: semente(5), unico: slug }), Catalogo.REGRAS, semente(6));
}
const semEfeito = (p) => [...(p.poe.implicitos ?? []), ...(p.poe.prefixos ?? []), ...(p.poe.sufixos ?? []), ...(p.poe.modificadores ?? [])].filter((m, k) => p.poe.estados[k] === 'registrado').map((m) => m.texto);

test('nenhuma armadura única (corpo, luvas, elmo, escudo, botas) fica com linha "sem efeito"', { skip: SEM }, () => {
  const ruins = [];
  for (const classe of ['Body_Armours', 'Gloves', 'Helmets', 'Shields', 'Boots']) {
    for (const u of Catalogo.catalogo().classes[classe].unicos) for (const t of semEfeito(unico(classe, u.slug))) ruins.push(`${u.nome}: ${t}`);
  }
  assert.deepEqual(ruins, []);
});

test('a Corrosão (o Banquete Sem Fim): as pilhas somam e tiram Armadura e Evasão do monstro enquanto duram', () => {
  const m = { uid: 1, hp: 10, x: 1, y: 0, estados: {} };
  ModsPoe.porNoAlvo(m, 'corroido', 4000, 0);
  ModsPoe.porNoAlvo(m, 'corroido', 5000, 1000);
  assert.equal(m.estados.corroido.n, 2);
  const hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [m] };
  ModsPoe.aurasProximas({ actions: [] }, hunt, { afPoe: { x: 1 } }, 1000);
  assert.equal(m.corrosaoArmadura, 2 * ModsPoe.CORROSAO.armadura);
  assert.equal(m.corrosaoEvasao, 2 * ModsPoe.CORROSAO.evasao);
  ModsPoe.aurasProximas({ actions: [] }, hunt, { afPoe: { x: 1 } }, 6000);
  assert.equal(m.corrosaoArmadura, undefined);
});

test('a Investida de Ambu: o máximo de Tolerância do grupo; a Causticação aumentada; a Kiloava em 90%', () => {
  assert.equal(Cargas.maximo({ tolerancia_max_do_grupo: 6 }, 'tolerancia'), 6);
  assert.equal(Cargas.maximo({ max_tolerancia: 4, tolerancia_max_do_grupo: 6 }, 'tolerancia'), 7);
  assert.equal(Cond.fatorNaoDano({ efeito_causticacao: 40 }, 'causticado'), 1.4);
  assert.equal(Cond.fatorNaoDano({ efeito_causticacao: 40 }, 'fragilizado'), 1);
  const f = Cond.fatorDaResistenciaRecebida({ afPoe: { res_elemental_90_chance: 100 }, protection: { fire: 20 } }, 'fire');
  assert.ok(Math.abs(f - 0.1) < 1e-9, `com a resistência em 90%: ${f}`);
});

test('o Ponto de Atordoamento pela Mana (o Avanço Celeste): com 500% da Mana maior que a Vida, a chance de ser atordoado cai', () => {
  const estado = { maxHp: 100, maxMana: 100 };
  const sem = Cond.controleNoJogador({ afPoe: { x: 1 }, energyShield: 0 }, 'atordoado', () => 0.99, null, { estado });
  const com = Cond.controleNoJogador({ afPoe: { mana_no_ponto_atordoamento_pct: 500 }, energyShield: 0 }, 'atordoado', () => 0.99, null, { estado });
  assert.ok(Math.abs(com.chanceFator - sem.chanceFator / 5) < 1e-9);
});

test('o Forjador da Carne: o lacaio troca Vida por Escudo de Energia pela Resistência a Caos', () => {
  const l = LacaiosPoe.aplicarNoLacaio({ maxHp: 1000, hp: 1000, poe: { esPorResCaosPct: 2, resCaos: 25 } });
  assert.equal(l.maxHp, 500);
  assert.equal(l.maxEs, 500);
});

test('as Minas a mais (o Fechamento das Cortinas) e o Sofrimento Compartilhado (a Doação de Leper)', () => {
  assert.equal(Plantadas.extrasDoArremesso({ afPoe: { minas_extras: 1 } }, 'mina', () => 0.99), 1);
  const alvo = { uid: 1, hp: 50, x: 1, y: 0, estados: {} };
  const hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [alvo], debuffsDoJogador: { eletrizado: { ate: 2000, pct: 20 } } };
  const af = { 'ev:acertar:sofrimentoCompartilhado': 100 };
  ModsPoe.evento({ hp: 10, maxHp: 10 }, hunt, 'acertar', { afPoe: af, eventosPoe: Cond.eventosDa(af) }, { alvo, agora: 0 });
  assert.equal(alvo.estados.chocado?.pct, 20);
  assert.equal(hunt.debuffsDoJogador.eletrizado, undefined, 'a Eletrização saiu de você');
});

test('as Vinhas nos inimigos parados (o Destino Inextricável): a cada 0,5 s, e a tag de 3 Vinhas', () => {
  const m = { uid: 1, hp: 10, x: 1, y: 0, estados: {} };
  const hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [m] };
  const ficha = { afPoe: { vinhas_nos_proximos_s: 0.5 } };
  ModsPoe.aurasProximas({ actions: [] }, hunt, ficha, 0);
  ModsPoe.aurasProximas({ actions: [] }, hunt, ficha, 1600);
  assert.equal(m.estados.vinhas.n, 3);
  assert.ok(Cond.tagsDoAlvo(m, 1600).includes('alvoVinhas3'));
});
