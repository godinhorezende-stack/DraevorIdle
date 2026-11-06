// (06/11, lote 7 das inertes — dono: "Continue resolvendo até dar zero nos itens") os ASPECTOS do Gato, da Ave, do Caranguejo e da Aranha (`itens-poe/aspectos.mjs`):
// a habilidade sai sozinha e fica ligada (25% da Mana reservada); os números, o PoB e o poedb.
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
const Aspectos = await import('../systems/itens-poe/aspectos.mjs');
const Reserva = await import('../systems/itens-poe/reserva.mjs');
const Traduzir = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const t = (texto) => {
  const nums = [];
  const modelo = texto.replace(/-?\d+(?:[.,]\d+)?/g, (m) => { nums.push(Number(m)); return `{${nums.length - 1}}`; });
  return Traduzir.traduzirMod({ modelo, valores: nums });
};
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
function personagem(af = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = peca('Wands/Driftwood_Wand');
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  // (a ficha à mão da caçada, como no tique — `cacadas`)
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const soma = (e) => { Ficha.invalidar(e); return Afixos.soma(e); };
const tique = (e, ms) => { e.hunt.clock += ms; ModsPoe.tiqueDosAspectos(e, e.hunt, ficha(e), null, e.hunt.clock); };

test('as 43 linhas dos Aspectos têm regra (nenhuma inerte)', { skip: SEM }, () => {
  for (const [texto, stat] of [
    ['Concede a Habilidade Aspecto do Gato Nível 20', 'aspecto_gato'],
    ['Concede a Habilidade Aspecto do Caranguejo Nível 20', 'aspecto_caranguejo'],
    ['Você possui Trespassar enquanto possuir Furtividade Felina', 'sempre:trespassar@buff:furtividadeFelina'],
    ['+3% de Chance de Bloquear o Dano de Ataques enquanto possuir ao menos 5 Barreiras de Caranguejo', 'block@barreirasMin:5'],
    ['Adiciona 10 a 13 de Dano de Caos para cada Teia de Aranha no Inimigo', 'added_chaos_dmg_min%teiasNoAlvo'],
    ['Ativa Clamor Intimidador Nível 20 quando você perder Furtividade Felina', 'ev:perderFurtividadeFelina:gatilho:Clamor Intimidador'],
  ]) {
    const m = t(texto);
    assert.notEqual(m.estado, 'inerte', texto);
    assert.notEqual(m.estado, 'registrado', texto);
    assert.equal(m.efeitos[0].stat, stat, texto);
  }
});

test('o GATO: Furtividade Felina 4 s, depois Agilidade Felina 6 s, em sequência; reserva 25% da Mana (sem Reserva com a Pele de Farrul)', { skip: SEM }, () => {
  const e = personagem({ aspecto_gato: 20 });
  const h = e.hunt;
  const antes = soma(e);
  tique(e, 0);
  assert.ok(h.poeBuffs.furtividadeFelina > h.clock);
  let s = soma(e);
  assert.equal((s.crit_chance_inc ?? 0) - (antes.crit_chance_inc ?? 0), 100);
  assert.equal((s.evitar_dano_fisico_acerto ?? 0) - (antes.evitar_dano_fisico_acerto ?? 0), 15);
  tique(e, 4000);
  assert.ok(!(h.poeBuffs.furtividadeFelina > h.clock), 'a Furtividade acabou');
  assert.ok(h.poeBuffs.agilidadeFelina >= h.clock + 6000 - 1);
  s = soma(e);
  assert.equal((s.atk_speed ?? 0) - (antes.atk_speed ?? 0), 10);
  tique(e, 6000);
  assert.ok(h.poeBuffs.furtividadeFelina > h.clock, 'de novo a Furtividade');
  // a reserva
  e.maxMana = 1000;
  assert.equal(Reserva.reservadas(e).mana, 250);
  e.equipment.weapon.poe.af.aspecto_gato_sem_reserva = 1;
  ficha(e);
  assert.equal(Reserva.reservadas(e).mana, 0);
});

test('"ao ganhar Furtividade Felina": Cargas de Poder e Frenesi no máximo; +2 s de Furtividade', { skip: SEM }, () => {
  const e = personagem({ aspecto_gato: 20, furtividade_felina_s: 2, 'ev:ganharFurtividadeFelina:cargaMax:poder': 100, 'ev:ganharFurtividadeFelina:cargaMax:frenesi': 100 });
  tique(e, 0);
  const h = e.hunt;
  assert.equal(h.poeBuffs.furtividadeFelina, h.clock + 6000);
  const c = h.cargasPoe ?? {};
  assert.ok((c.poder?.n ?? 0) > 0 && (c.frenesi?.n ?? 0) > 0, JSON.stringify(c));
});

test('a AVE: Poder da Ave (10% de Dano Dobrado) e Voo da Ave (10% de Movimento); o efeito aumentado em 100% dobra', { skip: SEM }, () => {
  const e = personagem({ aspecto_ave: 20, 'efeito_buff:poderDaAve': 100, 'efeito_buff:vooDaAve': 100 });
  const antes = soma(e);
  tique(e, 0);
  assert.equal((soma(e).chance_dano_dobrado ?? 0) - (antes.chance_dano_dobrado ?? 0), 20);
  tique(e, 4000);
  assert.equal((soma(e).move_speed ?? 0) - (antes.move_speed ?? 0), 20);
});

test('o CARANGUEJO: uma Barreira a cada 0,5 s até 10 (+5); 2% de Redução Física cada; o Dano Físico de um Acerto tira todas (ou só N)', { skip: SEM }, () => {
  const e = personagem({ aspecto_caranguejo: 20, barreiras_max: 5, 'block@barreirasMin:10': 5 });
  const h = e.hunt;
  const antes = soma(e);
  tique(e, 0);
  for (let i = 0; i < 20; i++) tique(e, 500);
  assert.equal(Aspectos.barreiras(h), 15);
  const s = soma(e);
  assert.equal((s.phys_res ?? 0) - (antes.phys_res ?? 0), 30);
  assert.equal((s.block ?? 0) - (antes.block ?? 0), 5);
  ModsPoe.aoSerAcertado(e, h, null, ficha(e), { dano: 10, corpoACorpo: true, tipo: 'physical' });
  assert.equal(Aspectos.barreiras(h), 0);
  e.equipment.weapon.poe.af.barreiras_perde_so = 6;
  for (let i = 0; i < 20; i++) tique(e, 500);
  ModsPoe.aoSerAcertado(e, h, null, ficha(e), { dano: 10, corpoACorpo: true, tipo: 'physical' });
  assert.equal(Aspectos.barreiras(h), 9);
  ModsPoe.aoSerAcertado(e, h, null, ficha(e), { dano: 10, tipo: 'fire', magia: true });
  assert.equal(Aspectos.barreiras(h), 9, 'o dano de Fogo não tira');
});

test('a ARANHA: Teias nos de perto (até 3, 6 s), 5% de Dano sofrido cada, Tolhe; a Mortalha: -10% de Resistências e 10% menos Dano deles', { skip: SEM }, () => {
  const e = personagem({ aspecto_aranha: 20, teias_dano_menos: 10, teias_res_menos: -10 });
  const h = e.hunt;
  const [a, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(a, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {} });
  for (let i = 0; i < 5; i++) tique(e, 1000);
  assert.equal(Aspectos.teiasNoAlvo(a, h.clock), 3);
  assert.ok(a.estados.tolhido?.ate > h.clock);
  assert.equal(ModsPoe.resMenosDasAfeccoes(a, h.clock, 'fire'), 10);
  assert.ok(ModsPoe.tagsDoAlvo(a, h.clock).includes('alvoTeias:3'));
  assert.ok(Math.abs(ModsPoe.doBicho(a, h.clock).danoFator - 0.9) < 1e-9);
  assert.ok(Math.abs(ModsPoe.fatorRecebidoPeloBicho(a, 'chaos', null, h.clock) - 1.15) < 1e-9);
  // longe, nada
  assert.equal(Aspectos.teiasNoAlvo(outros[0], h.clock), 0);
});

test('sem a peça, o Aspecto desliga (buffs, Barreiras e a reserva saem)', { skip: SEM }, () => {
  const e = personagem({ aspecto_caranguejo: 20, aspecto_gato: 20 });
  tique(e, 0);
  tique(e, 1000);
  e.equipment.weapon.poe.af = {};
  tique(e, 100);
  assert.equal(e.hunt.barreiras, undefined);
  assert.ok(!(e.hunt.poeBuffs.furtividadeFelina > e.hunt.clock));
  e.maxMana = 1000;
  assert.equal(Reserva.reservadas(e).mana, 0);
});
