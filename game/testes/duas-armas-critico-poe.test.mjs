// O CRÍTICO de cada mão no modo PoE (auditoria da velocidade de ataque, 09/10 — "faça o crítico da segunda arma"): como no PoE, cada golpe
// rola o crítico da arma que o deu — a chance BASE dela × o "Chance de Crítico aumentada" LOCAL dela —, com os aumentos globais por cima.
// Antes a ficha tirava o crítico da segunda arma e todo golpe rolava o da principal; e o "aumentada" da arma era global (valia nas duas
// mãos e até nas magias). Numa caçada de verdade (`Cacadas.entrar` + `Cacadas.tique`), lendo a chance de cada golpe no registro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const GP = await import('../systems/itens-poe/gemas-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const FichaPoe = await import('../systems/personagem/ficha-poe.mjs');
const Registro = await import('../systems/combate/registro.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

const CRITICO = 'Chance de Crítico aumentada em {0}%';
const GLOBAL = 'Chance Global de Crítico aumentada em {0}%';
const PRINCIPAL = 'One_Hand_Swords/Rusted_Sword'; // 5% de crítico, 4–9
const SECUNDARIA = 'Claws/Nailed_Fist'; // 7,3% de crítico, 4–11 (o implícito dela não mexe no crítico)
/** A peça do PoE da base (normal), ou só com estes sufixos (mágica), refeita pelo caminho das moedas. */
function peca(base, mods = null) {
  const p = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: mods ? 'magico' : 'normal', ilvl: 1, rng: () => 0.5 }));
  if (!mods) return p;
  p.poe.prefixos = [];
  p.poe.sufixos = mods.map(({ modelo, valor }) => ({ modelo, valores: [valor], texto: modelo.replace('{0}', valor) }));
  return Jogo.recalcular(p);
}
/** Um Duelista do PoE com a arma (e a segunda arma e o anel) e, se pedir, a gema de ataque na arma e no slot 1 da barra. */
function montar({ arma, segunda = null, anel = null, gema = null }) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), { classePoe: 'Duelist' });
  e.equipment = { ...e.equipment, weapon: arma };
  if (segunda) e.equipment.shield = segunda;
  else delete e.equipment.shield;
  if (anel) e.equipment.ring = anel;
  e.actions = Array(Acoes.SLOTS).fill(null);
  if (gema) {
    arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.inventory = [GS.itemDaGema({ id: GP.doSlug(gema).itemId, nivel: 10, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
    e.actions[0] = { id: GP.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  }
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return e;
}
/** As chances de crítico de cada golpe (`origem`: 'golpe-basico' ou 'gema') em `segundos` de caçada contra um alvo imortal colado. */
function chances(e, origem, segundos = 12) {
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  const antes = Registro.nivelDoRegistro();
  Registro.definirNivel(1);
  Registro.limparRegistro();
  try {
    let t = Date.now();
    for (let i = 0; i < segundos * 4; i++) {
      const h = e.hunt;
      h.monstros = h.monstros.slice(0, 1);
      Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
      h.alvo = h.monstros[0].uid;
      Object.assign(e, { hp: e.maxHp, mana: 1e6, maxMana: 1e6 });
      Cacadas.tique(e, PERSONAGEM, (t += 250));
    }
    return Registro.ultimosGolpes(200).filter((g) => g.origem === origem).map((g) => Math.round(g.chanceCritica * 10000) / 100);
  } finally {
    Registro.limparRegistro();
    Registro.definirNivel(antes);
  }
}
const r2 = (v) => Math.round(v * 10000) / 100;

test('o "Chance de Crítico aumentada" da ARMA é LOCAL (multiplica o crítico base dela) — no anel segue global; e não vale mais nas magias', { skip: SEM }, () => {
  const arma = peca(PRINCIPAL, [{ modelo: CRITICO, valor: 50 }]);
  assert.equal(arma.poe.af.crit_chance_local, 50);
  assert.equal(arma.poe.af.crit_chance_inc, undefined, 'não soma mais no aumentado global');
  assert.equal(arma.poe.estados.at(-1), 'equivalente');
  const f = Ficha.combate(montar({ arma }));
  assert.equal(r2(f.critChance), 7.5, '5% × 1,50');
  assert.equal(f.critMagiaPoe.aumentada, 0, 'o crítico local da arma não aumenta o das magias');
  const anel = peca('Rings/Iron_Ring', [{ modelo: CRITICO, valor: 50 }]);
  assert.equal(anel.poe.af.crit_chance_inc, 50, 'no anel a mesma linha é global');
  assert.equal(anel.poe.af.crit_chance_local, undefined);
  assert.equal(r2(Ficha.combate(montar({ arma: peca(PRINCIPAL), anel })).critChance), 7.5);
  // A peça salva antes (o "aumentada" da arma em `crit_chance_inc`) é refeita na entrada.
  const velha = peca(PRINCIPAL, [{ modelo: CRITICO, valor: 50 }]);
  velha.poe.tv = 8;
  velha.poe.af = { ...velha.poe.af, crit_chance_inc: 50 };
  delete velha.poe.af.crit_chance_local;
  const e = montar({ arma: velha });
  assert.equal(Jogo.refazerPecasAntigas(e), 1);
  assert.deepEqual([velha.poe.af.crit_chance_inc, velha.poe.af.crit_chance_local, velha.poe.tv], [undefined, 50, Jogo.VERSAO_DA_TRADUCAO]);
});

test('duas armas: cada mão tem o crítico da SUA arma (base × local), com a global por cima — a ficha e a tela', { skip: SEM }, () => {
  // A principal 5% sem mod; a secundária 7,3% com +100% local; um anel com +50% global.
  const e = montar({ arma: peca(PRINCIPAL), segunda: peca(SECUNDARIA, [{ modelo: CRITICO, valor: 100 }]), anel: peca('Rings/Iron_Ring', [{ modelo: GLOBAL, valor: 50 }]) });
  const f = Ficha.combate(e);
  assert.equal(f.duasArmas, true);
  assert.equal(r2(f.critChance), 7.5, 'a principal: 5% × 1,50 (o local da secundária não entra — antes, 5% × 3,50 = 17,5%)');
  assert.equal(r2(f.critChanceSecundaria), 21.9, 'a secundária: 7,3% × 2 (local) × 1,50 (global)');
  const tela = FichaPoe.montar(e, f).secoes.find((s) => s.id === 'ataque').linhas;
  assert.ok(tela.some((l) => l.rotulo === 'Chance de crítico (mão secundária)' && l.valor === '21,9%'), `a tela mostra o crítico da mão secundária: ${tela.find((l) => /secundária/.test(l.rotulo))?.valor}`);
  // O implícito GLOBAL de uma adaga ("Chance Global de Crítico aumentada") vale nas duas mãos, como no PoE.
  const adaga = Ficha.combate(montar({ arma: peca(PRINCIPAL), segunda: peca('Daggers/Glass_Shank') }));
  assert.ok(adaga.critInc > 0, 'a Glass Shank tem crítico global no implícito');
  assert.equal(r2(adaga.critChance), r2(0.05 * (1 + adaga.critInc / 100)), 'a principal ganha o global da adaga');
  assert.equal(r2(adaga.critChanceSecundaria), r2(0.08 * (1 + adaga.critInc / 100)), 'e a adaga rola os 8% dela');
  // Uma arma só: sem a linha e sem os campos da secundária.
  assert.equal(Ficha.combate(montar({ arma: peca(PRINCIPAL) })).critChanceSecundaria, undefined);
});

test('duas armas na caçada: o golpe básico e a gema que alterna rolam o crítico da mão da vez; a Cutilada, a média pesada pelo dano', { skip: SEM }, () => {
  // (O golpe que ERRA também usa a mão dele — como no PoE, a mão é escolhida no começo do golpe —, mas não entra no registro: os acertos
  // que não podem ser evadidos deixam o revezamento inteiro à vista.)
  const duas = (gema) => montar({ arma: peca(PRINCIPAL), segunda: peca(SECUNDARIA), anel: peca('Rings/Iron_Ring', [{ modelo: 'Acertos não podem ser Evadidos', valor: 0 }]), gema });
  // O golpe básico: 5% e 7,3% se revezando (antes, todos com 5%).
  const basico = chances(duas(null), 'golpe-basico');
  assert.ok(basico.length >= 10, `${basico.length} golpes`);
  assert.deepEqual(new Set(basico), new Set([5, 7.3]), `as duas mãos: ${basico.join(' · ')}`);
  assert.ok(basico.every((c, i) => i === 0 || c !== basico[i - 1]), `alterna a cada golpe: ${basico.join(' · ')}`);
  // A Pancada (uma gema que alterna): o mesmo revezamento.
  const pancada = chances(duas('Heavy_Strike'), 'gema');
  assert.ok(pancada.length >= 6, `${pancada.length} usos`);
  assert.deepEqual(new Set(pancada), new Set([5, 7.3]), `a Pancada: ${pancada.join(' · ')}`);
  assert.ok(pancada.every((c, i) => i === 0 || c !== pancada[i - 1]));
  // A Cutilada (as duas armas juntas): a média dos dois críticos pesada pelo dano médio de cada mão — (6,5 × 5% + 7,5 × 7,3%) / 14.
  const f = Ficha.combate(duas('Cleave'));
  const [m, s] = [(f.damage.min + f.damage.max) / 2, (Math.round(f.ataqueSecundarioMin) + Math.round(f.ataqueSecundarioMax)) / 2];
  const esperado = Math.round(((m * 5 + s * 7.3) / (m + s)) * 100) / 100;
  const cutilada = new Set(chances(duas('Cleave'), 'gema'));
  assert.equal(cutilada.size, 1, `a Cutilada não alterna: ${[...cutilada].join(' · ')}`);
  assert.ok(Math.abs([...cutilada][0] - esperado) <= 0.01, `Cutilada: ${[...cutilada][0]}% (esperado ${esperado}%)`);
});
