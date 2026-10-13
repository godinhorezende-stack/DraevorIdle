// A MANA RESERVADA da árvore do PoE (dono, 13/10: "pode seguir com a mana reservada") de ponta a ponta, com os nós REAIS: a Fé Radiante
// (Armadura e Escudo pela mana reservada, em você e nos aliados), o Santuário do Pensamento (Área pela mana não reservada), o Ego Supremo (as
// auras só em você, mais efeito pela reserva, 40% mais reserva) e o Frasco de Vida que sai com a vida não reservada cheia (a regra do PoE) —
// menos com a Mestre Cirurgiã.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Reserva = await import('../systems/itens-poe/reserva.mjs');
const Aliados = await import('../systems/itens-poe/aliados.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Um personagem numa caçada do PoE (`frascos`: bases no cinto). */
function personagem(frascos = []) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Duelist';
  e.equipment = { ...(e.equipment ?? {}), weapon: peca('Two_Hand_Axes/Vaal_Axe') };
  e.inventory = [];
  for (const b of frascos) { e.inventory.push(peca(b)); assert.ok(Frascos.por(e, { pilha: e.inventory.length - 1 }).ok); }
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  P.garantir(e);
  return e;
}
const af = (e) => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };
/** Uma aura de gema ligada reservando `pct`% da mana (o buff que o jogo põe em `hunt.buffs`). */
function aura(e, id, pct, afPoe = {}, fator = 1) {
  (e.hunt.buffs ??= {})[id] = { tipo: 'poe-aura', ate: Reserva.LIGADA_ATE, raio: 2, afPoe, reserva: { recurso: 'mana', pct, fator } };
  Ficha.invalidar(e);
}
function party(dono, aliados, dx = 1) {
  const membros = [{ estado: dono, nome: 'Ana' }, ...aliados.map((a, i) => ({ estado: a, nome: `Amiga${i}` }))];
  aliados.forEach((a, i) => { a.hunt.pos = { ...dono.hunt.pos, x: dono.hunt.pos.x + dx + i }; a.hunt.z = dono.hunt.z; a.hunt.clock = dono.hunt.clock; });
  for (const m of membros) m.estado.hunt.partilha = { ativa: true, bonus: 1, membros, naSala: membros.map((x) => x.estado) };
}
const foto = (e) => { Ficha.invalidar(e); const a = Ficha.combate(e).afPoe; return Aliados.fotografar(e, a, { fortificacao: ModsPoe.fortificacao(e, a) }); };

/** Aloca o nó (principal, maestria, keystone ou ascendência) com um efeito cuja chave casa `re`. */
function alocar(e, re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  let no = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  if (!no) {
    no = arv.nos.find((n) => n.ascendencia && tem(n.efeitos));
    assert.ok(no, `há nó com ${re}`);
    e.classePoe = arv.ascendencias[no.ascendencia].classe;
    P.garantir(e);
    e.passivas.ascendencia = no.ascendencia;
    Comandos.depoisDeMudar(e);
    assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) }).ok);
    Ficha.invalidar(e);
    return;
  }
  const caminho = P.caminhoAte(e, no.id);
  if (caminho.length > 1) assert.equal(Comandos.comando(e, { action: 'alocar', ids: caminho.slice(0, -1) }).feitos, caminho.length - 1);
  assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id }).ok);
  Ficha.invalidar(e);
}

test('a FÉ RADIANTE: Armadura = 25% e Escudo de Energia máximo = 10% da sua Mana Reservada — em você e na amiga perto', { skip: SEM }, () => {
  const ana = personagem();
  alocar(ana, /^aliados:armor_flat%manaReservada:1$/);
  const sem = af(ana);
  aura(ana, 'poe-gema:Determination', 50);
  const reservada = Reserva.reservadas(ana).mana;
  assert.ok(reservada > 0);
  const com = af(ana);
  assert.ok(Math.abs((com.armor_flat ?? 0) - (sem.armor_flat ?? 0) - reservada * 0.25) < 1e-6, 'Armadura +25% da reservada');
  assert.ok(Math.abs((com.energy_shield ?? 0) - (sem.energy_shield ?? 0) - reservada * 0.1) < 1e-6, 'Escudo +10% da reservada');
  const amiga = personagem();
  const dela = af(amiga);
  party(ana, [amiga]);
  foto(ana);
  assert.ok(Math.abs((af(amiga).armor_flat ?? 0) - (dela.armor_flat ?? 0) - reservada * 0.25) < 1e-6, 'na amiga perto também');
});

test('o SANTUÁRIO DO PENSAMENTO: Área +1% por cada 50 de Mana Máxima NÃO reservada, até 100%', { skip: SEM }, () => {
  const e = personagem();
  alocar(e, /^area_inc%manaNaoReservada:50~100$/);
  const area = () => af(e).area_inc ?? 0;
  const santuario = (mana) => Math.min(100, Math.floor(Math.max(0, mana) / 50));
  e.maxMana = 2000;
  const semReserva = area();
  aura(e, 'poe-gema:Determination', 50);
  const livre = e.maxMana - Reserva.reservadas(e).mana;
  assert.equal(livre, 1000);
  assert.equal(semReserva - area(), santuario(2000) - santuario(livre), 'reservar 1000 tira 20% de Área');
  e.hunt.buffs = {};
  e.maxMana = 20_000;
  assert.equal(area() - semReserva, 100 - santuario(2000), 'no máximo, 100%');
});

test('o EGO SUPREMO: "40% mais Reserva de Mana de Habilidades Aura"; "1% mais Efeito de Aura por cada 2% de Mana máxima que Reservarem"; as auras só em você', { skip: SEM }, () => {
  const e = personagem();
  alocar(e, /^reserva_aura_mais$/);
  assert.equal(af(e).reserva_aura_mais, 40);
  assert.equal(af(e).auras_so_em_voce, 1);
  // (o fator da reserva: × 1,4 só nas Auras e só na Mana — o Arauto e a reserva de Vida não mudam)
  const ficha = { afPoe: { reserva_aura_mais: 40 } };
  assert.ok(Math.abs(Reserva.fator(ficha, null, 'mana', 'aura') - 1.4) < 1e-9, '40% mais reserva');
  assert.equal(Reserva.fator(ficha, null, 'mana', 'arauto'), 1);
  assert.equal(Reserva.fator(ficha, null, 'vida', 'aura'), 1);
  // A aura reserva 50% × 1,4 = 70% da mana: 35% mais efeito.
  e.maxMana = 1000;
  aura(e, 'poe-gema:Purity_of_Fire', 50, { fire_res: 10 }, 1.4);
  const comEgo = G.adds(e).fire_res;
  const outra = personagem();
  outra.maxMana = 1000;
  aura(outra, 'poe-gema:Purity_of_Fire', 50, { fire_res: 10 }, 1.4);
  assert.ok(Math.abs(comEgo / G.adds(outra).fire_res - 1.35) < 1e-9, `${comEgo} / ${G.adds(outra).fire_res}`);
  const amiga = personagem();
  party(e, [amiga]);
  assert.equal(G.adds(amiga)?.fire_res ?? 0, 0, '"Auras das suas Habilidades só podem afetar você"');
  party(outra, [amiga]);
  assert.ok((G.adds(amiga)?.fire_res ?? 0) > 0, 'sem o Ego Supremo, a aura vale na amiga');
});

test('o FRASCO DE VIDA: o efeito sai quando a Vida Não Reservada enche (a regra do PoE); com a Mestre Cirurgiã, não', { skip: SEM }, () => {
  const cena = (cirurgia) => {
    const e = personagem(['Life_Flasks/Divine_Life_Flask']);
    if (cirurgia) alocar(e, /^frasco_vida_nao_para$/);
    e.maxHp = 10_000;
    e.hp = 9_800;
    Frascos.cinto(e)[0].poe.usarAbaixoPct = 1;
    assert.ok(Frascos.usar(e, 0));
    for (let t = 0; t < 2000; t += 250) { e.hunt.clock += 250; Frascos.tique(e, [], 'Ana'); }
    return { cheia: e.hp >= e.maxHp, ativo: !!e.hunt.frascosPoe.ativos[0] };
  };
  assert.deepEqual(cena(false), { cheia: true, ativo: false }, 'encheu: o efeito saiu');
  assert.deepEqual(cena(true), { cheia: true, ativo: true }, 'Mestre Cirurgiã: segue');
});

test('o FRASCO DE MANA olha a mana NÃO reservada: com uma aura reservando metade, o efeito sai quando a parte livre enche', { skip: SEM }, () => {
  const e = personagem(['Mana_Flasks/Divine_Mana_Flask']);
  e.maxMana = 1000;
  aura(e, 'poe-gema:Determination', 50);
  e.mana = 100;
  Frascos.cinto(e)[0].poe.usarAbaixoPct = 1;
  assert.ok(Frascos.usar(e, 0));
  for (let t = 0; t < 2000; t += 250) { e.hunt.clock += 250; Frascos.tique(e, [], 'Ana'); Reserva.cortarNoLivre(e); }
  assert.equal(e.mana, 500, 'até a parte livre');
  assert.equal(e.hunt.frascosPoe.ativos[0], undefined, 'e o efeito saiu (antes, com a reserva, ele nunca saía)');
});

test('a ÁRVORE: as 6 linhas da mana reservada têm efeito no balão; a do Feiticeiro diz por que não tem', { skip: SEM }, () => {
  const linhas = P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i], nota: o.notas?.[i] }))));
  for (const re of [/^Concede Armadura igual a/, /^Concede Escudo de Energia máximo igual a/, /Mana Máxima Não Reservada/, /que Reservarem$/, /mais Reserva de Mana de Habilidades Aura$/, /Frascos de Vida não são removidos/]) {
    const achadas = linhas.filter((l) => re.test(l.t));
    assert.ok(achadas.length > 0, `há linha ${re}`);
    for (const l of achadas) assert.ok(['equivalente', 'novo', 'aproximado'].includes(l.estado), `${l.t}: ${l.estado}`);
  }
  const feiticeiro = linhas.find((l) => /Suportadas por Feiticeiro/.test(l.t));
  assert.equal(feiticeiro.estado, 'inerte');
  // (dono, 13/10, "Ajustar a linha": a gema está no catálogo, sem comportamento de combate — a nota do lote 12)
  assert.match(feiticeiro.nota, /Feiticeiro \(Spellslinger\) está no catálogo, mas ainda não tem comportamento de combate/);
});
