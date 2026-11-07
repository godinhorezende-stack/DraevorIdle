// (06/11, lote 13b das inertes — dono: "Importar e fazer à mão") as HABILIDADES DE ITEM feitas à mão (`itens-poe/habilidades-de-itens.mjs`):
// o uso (nova, solo, buff) e o contínuo (as auras "quando Equipado"), a Pacificar e as linhas que dependem delas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Cargas = await import('../systems/itens-poe/cargas.mjs');
const Traduzir = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const t = (texto) => {
  const nums = [];
  const modelo = texto.replace(/-?\d+(?:[.,]\d+)?/g, (m) => { nums.push(Number(m)); return `{${nums.length - 1}}`; });
  return Traduzir.traduzirMod({ modelo, valores: nums });
};
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** O personagem com as LINHAS do PoE na arma (traduzidas como no jogo). */
function personagem(linhas = []) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = peca('Wands/Driftwood_Wand');
  const af = { ...(arma.poe.af ?? {}) };
  for (const l of linhas) for (const x of t(l).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  arma.poe.af = af;
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.maxHp = e.hp = 10_000;
  P.garantir(e);
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const soma = (e) => { Ficha.invalidar(e); return Afixos.soma(e); };
const cargas = (e, tipo) => { const c = e.hunt.cargasPoe?.[tipo]; return c && c.ate > e.hunt.clock ? c.n : 0; };

const ARN = ['Ganha Cargas Brutais ao invés de Cargas de Tolerância', 'Máximo de Cargas Brutais é igual ao Máximo de Cargas de Tolerância', 'Modificadores ao Mínimo de Cargas de Tolerância são aplicados ao Mínimo de Cargas Brutais ao invés'];
const HI = await import('../systems/itens-poe/habilidades-de-itens.mjs');
const bicho = (e) => {
  const h = e.hunt;
  const [a, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(a, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {}, dots: [] });
  return a;
};

test('o uso: Consagrar (Solo Sagrado 5 s), Olhar Vazio (−20% de Resistência a Caos 10 s), Olhar Fulgente (nova de Fogo que Cega), a recarga', { skip: SEM }, () => {
  const e = personagem();
  const h = e.hunt;
  const a = bicho(e);
  assert.ok(HI.usar(e, h, 'Consecrate', { id: 'x1', agora: h.clock }).ok);
  assert.equal(h.solosSagrados.length, 1);
  assert.equal(HI.usar(e, h, 'Consecrate', { id: 'x1', agora: h.clock + 100 }).ok, false, 'recarga de 5 s');
  HI.usar(e, h, 'Void_Gaze', { id: 'x2', agora: h.clock });
  assert.equal(ModsPoe.resMenosDasAfeccoes(a, h.clock, 'chaos'), 20);
  const antes = a.hp;
  HI.usar(e, h, 'Blazing_Glare', { id: 'x3', nivel: 20, agora: h.clock, eventos: [] });
  assert.ok(a.hp < antes && a.estados.cego?.ate > h.clock);
});

test('o contínuo: a Aura da Morte queima (Caos por segundo) enquanto a peça a concede', { skip: SEM }, () => {
  const e = personagem(['Ativa Aura da Morte Nível 20 quando Equipado']);
  const h = e.hunt;
  const a = bicho(e);
  ModsPoe.tiqueDosAspectos(e, h, ficha(e), h.clock);
  assert.ok(a.dots.some((d) => d.tipo === 'degenCaos' && d.chave === 'habilidade:Death_Aura'), JSON.stringify(ficha(e).afPoe['concede:aura-da-morte']));
});

test('a Pacificar: com 60% da maldição passados, o amaldiçoado não causa dano', { skip: SEM }, () => {
  const e = personagem();
  const a = bicho(e);
  const agora = e.hunt.clock;
  a.maldicoes = { 'poe:Pacify': { desde: agora - 7000, dur: 10000, ate: agora + 3000 } };
  assert.equal(ModsPoe.doBicho(a, agora).danoFator, 0);
  a.maldicoes['poe:Pacify'].desde = agora - 1000;
  assert.ok(ModsPoe.doBicho(a, agora).danoFator > 0);
});

test('o Perturbar (Insano): "60% mais Chance de Crítico enquanto Insano"; a Gula dos Elementos: imune a Maldições', { skip: SEM }, () => {
  const e = personagem(['60% mais Chance de Golpe Crítico enquanto Insano']);
  const h = e.hunt;
  assert.ok(!(soma(e).crit_mais_pct > 0));
  HI.usar(e, h, 'Unhinge', { id: 'x4', agora: h.clock });
  assert.equal(soma(e).crit_mais_pct, 60);
  HI.usar(e, h, 'Gluttony_of_Elements', { id: 'x5', agora: h.clock });
  assert.equal(soma(e).imune_maldicao, 1);
});

test('as linhas dos únicos que disparam: o Nevoeiro de Guerra na Armadilha, o Olhar Vazio ao usar, o Banquete de Carne a cada 5 s', { skip: SEM }, () => {
  assert.deepEqual(t('Ativa Nevoeiro de Guerra nível 20 quando sua Armadilha é ativada').efeitos, [{ stat: 'ev:armadilha:gatilho:nevoeiro-de-guerra', valor: 20 }]);
  assert.notEqual(t('Ativa Banquete de Carne Nível 15 a cada 5 segundos').estado, 'inerte');
  assert.notEqual(t('Ativa Banquete de Carne Nível 15 a cada 5 segundos').estado, 'registrado');
});
