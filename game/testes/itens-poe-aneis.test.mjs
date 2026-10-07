// O SEGUNDO ANEL do PoE (dono, 06/10): com ITENS_POE=1 existe o slot `ring2`, que aceita anel; o clique veste no primeiro anel livre, o
// arrasto escolhe o slot, e os dois anéis somam na ficha. Sem o PoE, nada muda (um anel só).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Equipamento = await import('../systems/itens/equipamento.mjs');
const Inventario = await import('../systems/inventario.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
if (!SEM) Jogo.iniciar(ITEM_CATALOG);

test('dois anéis: o clique veste no primeiro anel livre, o arrasto escolhe, os dois somam na ficha, e tirar devolve cada um', { skip: SEM }, async () => {
  const { personagemDeTeste } = await import('./apoio.mjs');
  assert.ok(Equipamento.SLOTS_DE_EQUIPAMENTO.includes('ring2'));
  const anel = Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Rings/Iron_Ring', raridade: 'normal', ilvl: 10, rng: semente(2) }));
  assert.ok(Equipamento.cabeNoSlot(ITEM_CATALOG[anel.id], 'ring2'));
  assert.ok(!Equipamento.cabeNoSlot(ITEM_CATALOG[anel.id], 'neck'));
  const e = personagemDeTeste({ vocacao: 'knight', level: 30 });
  e.equipment = { ...(e.equipment ?? {}), ring: null, ring2: null };
  e.inventory = [structuredClone(anel), structuredClone(anel), structuredClone(anel)];
  assert.equal(Inventario.equipar(e, { id: anel.id, pilha: 0 }).ok, true);
  assert.equal(Inventario.equipar(e, { id: anel.id, pilha: 0 }).ok, true);
  assert.ok(e.equipment.ring && e.equipment.ring2, 'o segundo clique foi para o segundo anel');
  // Com os dois cheios, o clique troca o primeiro; o arrasto escolhe o slot.
  assert.equal(Inventario.equipar(e, { id: anel.id, pilha: 0, slot: 'ring2' }).ok, true);
  assert.equal(e.inventory.length, 1);
  // Os dois somam (o Anel de Ferro dá dano físico adicional, implícito).
  const um = Object.values(e.equipment.ring.poe.af).reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0);
  assert.ok(um > 0);
  const soma = Afixos.somaDeItens(e);
  for (const [k, v] of Object.entries(e.equipment.ring.poe.af)) if (typeof v === 'number') assert.equal(soma[k] >= v * 2, true, k);
  assert.equal(Inventario.desequipar(e, { slot: 'ring2' }).ok, true);
  assert.equal(e.equipment.ring2, null);
  assert.ok(e.equipment.ring);
  assert.equal(e.inventory.length, 2);
  // Peça que não é anel não entra no segundo anel.
  const elmo = Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Helmets/Iron_Hat', raridade: 'normal', ilvl: 10, rng: semente(3) }));
  e.inventory.push(elmo);
  assert.equal(Inventario.equipar(e, { id: elmo.id, pilha: e.inventory.length - 1, slot: 'ring2' }).ok, false);
});

test('sem capacidade no PoE (dono, 06/10: "não existe cap mais"): o peso não manda nada para o Depósito nem impede pegar loot', { skip: SEM }, async () => {
  const { personagemDeTeste } = await import('./apoio.mjs');
  const Deposito = await import('../systems/deposito.mjs');
  const e = personagemDeTeste({ vocacao: 'knight', level: 1 });
  assert.equal(Afixos.capacidade(e), Infinity);
  const placa = Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Body_Armours/Plate_Vest', raridade: 'normal', ilvl: 10, rng: semente(4) }));
  e.inventory = Array.from({ length: 80 }, () => structuredClone(placa));
  assert.ok(Inventario.pesoDoInventario(e) > 5000);
  assert.deepEqual(Deposito.excessoParaODeposito(e), []);
  assert.equal(e.inventory.length, 80);
  // O peso não conta; o que limita no PoE são as VAGAS da mochila (20 peças não empilháveis — dono, 07/10).
  assert.equal(Inventario.cabeNoPeso(e, placa.id, 1), false, 'mochila com 80 peças: sem vaga');
  e.inventory = [];
  assert.equal(Inventario.cabeNoPeso(e, placa.id, 1), true, 'mochila vazia: cabe, por mais pesada que seja');
});

test('sem perícias no PoE (dono, 06/10: "o personagem não vai ter mais skill de treino"): nada sobe, o dano é o da arma, magia pede só level', { skip: SEM }, async () => {
  const { personagemDeTeste } = await import('./apoio.mjs');
  const Treino = await import('../systems/treino.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const e = personagemDeTeste({ vocacao: 'knight', level: 10 });
  const antes = JSON.stringify([e.skills, e.magic]);
  Treino.treinar(e, 'melee', 100000);
  Treino.treinar(e, 'shielding', 100000);
  Treino.gastarMana(e, 1e7);
  assert.equal(JSON.stringify([e.skills, e.magic]), antes);
  const f = Ficha.combate(e);
  assert.deepEqual([f.damage.min, f.damage.max], [Math.max(1, Math.round(f.ataqueMin)), Math.max(1, Math.round(f.ataqueMax))], 'a ficha mostra a faixa da arma');
});

test('Escudo de Energia do PoE: absorve antes da vida; recarrega 20%/s depois de 2 s sem dano; dano interrompe; os modificadores de recarga', async () => {
  const Defesa = await import('../systems/personagem/defesa.mjs');
  const ficha = { energyShield: 100 };
  const e = { es: 100 };
  assert.equal(Defesa.absorver(e, ficha, 30, null, null), 0, 'o escudo engoliu tudo');
  assert.equal(e.es, 70);
  assert.equal(Defesa.absorver(e, ficha, 90, null, null), 20, 'o que passa do escudo vai para a vida');
  assert.equal(e.es, 0);
  Defesa.recarregar(e, ficha, 1999);
  assert.equal(e.es, 0, 'ainda esperando os 2 s');
  Defesa.recarregar(e, ficha, 1001);
  assert.equal(e.es, 20, '20% do escudo por segundo');
  Defesa.recarregar(e, ficha, 500);
  assert.equal(e.es, 30);
  Defesa.absorver(e, ficha, 5, null, null); // dano no meio da recarga: interrompe
  Defesa.recarregar(e, ficha, 1500);
  assert.equal(e.es, 25, 'interrompida: espera de novo');
  // "Recarga aumentada em 50%" e "Início da Recarga 100% mais rápido".
  const forte = { energyShield: 100, esRecargaPct: 50, esInicioPct: 100 };
  const f = { es: 100 };
  Defesa.absorver(f, forte, 100, null, null);
  assert.equal(Defesa.esperaDaRecarga(forte), 1000);
  Defesa.recarregar(f, forte, 1000 + 1000);
  assert.equal(f.es, 30, '20% × 1,5 = 30% por segundo');
});

test('as mãos no PoE: arma de uma mão nas duas; arco de duas mãos só com aljava; aljava só com arco; nada de dois escudos; o golpe alterna', { skip: SEM }, async () => {
  const { personagemDeTeste } = await import('./apoio.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const peca = (base) => Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: semente(5) }));
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.classePoe = 'Scion';
  e.atributos = undefined;
  e.equipment = { ...(e.equipment ?? {}), weapon: null, shield: null };
  const vestir = (base, slot) => {
    const p = peca(base);
    e.inventory.push(p);
    return Inventario.equipar(e, { id: p.id, pilha: e.inventory.length - 1, ...(slot ? { slot } : {}) });
  };
  const em = (slot) => Jogo.registro().porId.get(e.equipment[slot]?.id) ?? null;
  // Espada + varinha (uma em cada mão): o clique na segunda vai para a mão secundária.
  assert.equal(vestir('One_Hand_Swords/Rusted_Sword').ok, true);
  assert.equal(vestir('Wands/Driftwood_Wand').ok, true);
  assert.deepEqual([em('weapon'), em('shield')], ['One_Hand_Swords/Rusted_Sword', 'Wands/Driftwood_Wand']);
  let f = Ficha.combate(e);
  assert.equal(f.duasArmas, true);
  assert.ok(f.ataqueSecundarioMax > 0);
  assert.ok(f.blockChance >= 0.15, 'empunhar duas armas: +15% de bloqueio');
  // Adaga arrastada para a mão secundária troca a varinha.
  assert.equal(vestir('Daggers/Glass_Shank', 'shield').ok, true);
  assert.equal(em('shield'), 'Daggers/Glass_Shank');
  // Aljava sem arco: recusada.
  assert.match(vestir('Quivers/Two-Point_Arrow_Quiver', 'shield').erro ?? '', /arco/);
  // Arco: tira a arma da mão secundária (duas mãos)...
  const r = vestir('Bows/Crude_Bow');
  assert.equal(r.ok, true);
  assert.equal(em('shield'), null, r.notice);
  // ... e aceita a aljava junto.
  assert.equal(vestir('Quivers/Two-Point_Arrow_Quiver', 'shield').ok, true);
  assert.deepEqual([em('weapon'), em('shield')], ['Bows/Crude_Bow', 'Quivers/Two-Point_Arrow_Quiver']);
  // Escudo com o arco: o arco sai (duas mãos).
  assert.equal(vestir('Shields/Splintered_Tower_Shield', 'shield').ok, true);
  assert.equal(em('weapon'), null);
  // Escudo não vai na mão principal (dois escudos, não).
  const escudo = peca('Shields/Splintered_Tower_Shield');
  e.inventory.push(escudo);
  assert.equal(Inventario.equipar(e, { id: escudo.id, pilha: e.inventory.length - 1, slot: 'weapon' }).ok, false);
  // Espada de uma mão + escudo: convivem; a aljava sai quando entra uma arma de uma mão.
  assert.equal(vestir('One_Hand_Swords/Rusted_Sword').ok, true);
  assert.equal(em('shield'), 'Shields/Splintered_Tower_Shield');
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).duasArmas, undefined, 'espada + escudo: não são duas armas');
});
