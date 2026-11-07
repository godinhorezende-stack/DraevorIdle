// (06/11, lote 12 das inertes — dono: "Continue resolvendo até dar zero nos itens") a reserva, o Impelir dos Clamores, os cadáveres,
// as Posturas e as regras que ficavam atrás de uma genérica inerte.
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
const GemasE1a = await import('../systems/itens-poe/gemas-e1a.mjs');

test('as regras que ficavam atrás de uma genérica inerte valem (o Verme da Essência, o Desafio do Destino, o Grilhões Temporais)', { skip: SEM }, () => {
  assert.deepEqual(t('Gemas Encaixadas não têm Reserva').efeitos, [{ stat: 'sem_reserva_local', valor: 1 }]);
  assert.deepEqual(t('Suas Habilidades Bênção são Desabilitadas').efeitos, [{ stat: 'bencaos_desabilitadas', valor: 1 }]);
  assert.notEqual(t('Ganha 16% da Vida Não Reservada que Falta antes de ser Acertado por um Inimigo').estado, 'inerte');
  assert.notEqual(t('Amaldiçoa Inimigos com Grilhões Temporais ao Acertar').estado, 'inerte');
  assert.equal(t('Utiliza ambas mãos').estado, 'lembrete');
});

test('a reserva: a Aposta de Ventor (o sinal), o Vivinsect; o Preço Sanguíneo nos monstros perto', { skip: SEM }, () => {
  assert.deepEqual(t('Eficácia da Reserva de Mana das Habilidades reduzida em -11%').efeitos, [{ stat: 'eficiencia_reserva_mana', valor: 11 }]);
  assert.deepEqual(t('Eficácia da Reserva de Mana das Habilidades reduzida em 8%').efeitos, [{ stat: 'eficiencia_reserva_mana', valor: -8 }]);
  assert.deepEqual(t('Gemas Encaixadas têm Eficácia da Reserva reduzida em 20%').efeitos, [{ stat: 'eficiencia_reserva_local', valor: -20 }]);
  const e = personagem(['Monstros Inimigos Próximos têm ao menos 8% de Vida Reservada']);
  const h = e.hunt;
  const [a, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(a, { x: h.pos.x + 1, y: h.pos.y, hp: 1000, maxHp: 1000 });
  ModsPoe.aurasProximas(e, h, ficha(e));
  assert.equal(a.hp, 920);
});

test('o Impelir: "por cada Clamor" (impelidoPor:N), o ataque não Impelido sem dano, o Sinete dos Mortos não gasta a carga', { skip: SEM }, () => {
  assert.deepEqual(t('Habilidades causam 10% mais Dano por cada Clamor as Impelindo').efeitos.map((x) => x.stat), ['mais_dano@impelidoPor:1', 'mais_dano@impelidoPor:2', 'mais_dano@impelidoPor:3']);
  assert.deepEqual(t('Ataques Não Impelidos não causam Dano').efeitos, [{ stat: 'mais_dano@ataqueNaoImpelido', valor: -100 }]);
  assert.deepEqual(t('Habilidades que Impelem um Ataque têm 40% de chance de não contarem tal Ataque').efeitos, [{ stat: 'impelir_nao_conta_chance', valor: 40 }]);
});

test('os cadáveres: o Comando de Kaom (explodem ao usar um Clamor) e o Desejo de Aukuna (os Zumbis contam como cadáver para as Oferendas)', { skip: SEM }, () => {
  const e = personagem(['Cadáveres próximos Explodem quando você usar um Clamor, causando 10% de sua Vida como Dano Físico', 'Seus Zumbis Erguidos contam como Cadáveres']);
  const h = e.hunt;
  const [a, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(a, { x: h.pos.x + 2, y: h.pos.y, hp: 1e6, maxHp: 1e6, estados: {} });
  h.cadaveres = [{ x: h.pos.x + 1, y: h.pos.y, maxHp: 1000 }];
  ModsPoe.evento(e, h, 'usarClamor', ficha(e), { eventos: [] });
  assert.ok(a.hp < 1e6);
  assert.equal(h.cadaveres.length, 0);
  ModsPoe.aurasProximas(e, h, ficha(e));
  h.lacaios = [{ uid: 'z1', gema: 'Raise_Zombie', hp: 100, maxHp: 100, x: h.pos.x + 1, y: h.pos.y }];
  assert.equal(GemasE1a.cadaveresDaOferenda(h).length, 1);
});

test('as Posturas: "enquanto na Postura de Sangue / da Areia" e "se mudou de Postura Recentemente"', { skip: SEM }, () => {
  assert.deepEqual(t('Dano de Projétil aumentado em 41% enquanto na Postura de Sangue').efeitos, [{ stat: 'dmg_inc@projetil+posturaSangue', valor: 41 }]);
  assert.deepEqual(t('Velocidade de Ataque aumentada em 30% caso tenha mudado de Postura Recentemente').efeitos, [{ stat: 'atk_speed@evRecente:mudarPostura', valor: 30 }]);
});
