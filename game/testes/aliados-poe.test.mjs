// "VOCÊ E ALIADOS" do PoE (dono, 13/10: "pode seguir com os aliados de verdade") de ponta a ponta: a aura do nó vale em você, nos companheiros
// da party na sala a até 3 casas (a mesma aura de duas pessoas: a maior) e nos seus lacaios; "Auras das suas Habilidades concedem" por aura
// ligada; a Fortificação igual do Campeão; "aliado por perto"; a Ichimonji nas auras — com os nós REAIS da árvore.
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
const Aliados = await import('../systems/itens-poe/aliados.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const { resistido } = await import('../systems/hunt/resistencia.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

/** Um personagem com um Machado Vaal numa caçada do PoE (`af`: atributos no machado). */
function personagem(af = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Duelist';
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  P.garantir(e);
  return e;
}
/** A party: `dono` e os `aliados` na mesma sala, a `dx` casas dele (um a mais por aliado). */
function party(dono, aliados, dx = 2) {
  const membros = [{ estado: dono, nome: 'Ana' }, ...aliados.map((a, i) => ({ estado: a, nome: `Amiga${i}` }))];
  const naSala = membros.map((m) => m.estado);
  aliados.forEach((a, i) => { a.hunt.pos = { ...dono.hunt.pos, x: dono.hunt.pos.x + dx + i }; a.hunt.z = dono.hunt.z; a.hunt.clock = dono.hunt.clock; });
  for (const m of membros) m.estado.hunt.partilha = { ativa: true, bonus: 1, membros, naSala };
}
const af = (e) => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };
/** A foto de quem dá (o tique faz — aqui, na mão). */
const foto = (e) => { Ficha.invalidar(e); const a = Ficha.combate(e).afPoe; return Aliados.fotografar(e, a, { fortificacao: ModsPoe.fortificacao(e, a) }); };
/** Uma aura de gema ligada (o buff que o jogo põe em `hunt.buffs`), com raio em casas. */
const aura = (e, id, raio = 2) => { (e.hunt.buffs ??= {})[id] = { tipo: 'poe-aura', ate: e.hunt.clock + 60_000, raio, afPoe: {} }; };

/** Aloca o nó (principal, maestria ou ascendência) com um efeito cuja chave casa `re` (a ascendência: a primeira que tem). */
function alocar(e, re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  let no = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  let opcao = null;
  if (!no) for (const n of arv.nos.filter((x) => x.tipo === 'mastery' && !x.ascendencia)) { const o = (n.opcoes ?? []).find((x) => tem(x.efeitos)); if (o) { no = n; opcao = o.id; break; } }
  if (!no) {
    no = arv.nos.find((n) => n.ascendencia && tem(n.efeitos));
    assert.ok(no, `há nó com ${re}`);
    e.classePoe = arv.ascendencias[no.ascendencia].classe;
    P.garantir(e);
    e.passivas.ascendencia = no.ascendencia;
    Comandos.depoisDeMudar(e);
    assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) }).ok);
    Ficha.invalidar(e);
    return no;
  }
  const ate = no.tipo === 'mastery' ? arv.nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia).id : no.id;
  const caminho = P.caminhoAte(e, ate);
  const antes = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
  if (antes.length) assert.equal(Comandos.comando(e, { action: 'alocar', ids: antes }).feitos, antes.length);
  assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id, ...(opcao ? { opcao } : {}) }).ok);
  Ficha.invalidar(e);
  return no;
}

test('"Você e Aliados próximos causam Dano aumentado em 30%" (Comandante das Trevas): em você, no companheiro a até 3 casas — e não a 4; com o mesmo nó nos dois, vale a maior (não soma)', { skip: SEM }, () => {
  const ana = personagem();
  alocar(ana, /^aliados:dmg_inc$/);
  const sem = personagem();
  const base = af(sem).dmg_inc ?? 0;
  const amiga = personagem();
  party(ana, [amiga], 3);
  assert.ok((af(ana).dmg_inc ?? 0) >= 30, 'em você');
  foto(ana);
  assert.equal((af(amiga).dmg_inc ?? 0) - base, 30, 'no companheiro a 3 casas');
  amiga.hunt.pos = { ...amiga.hunt.pos, x: ana.hunt.pos.x + 4 };
  assert.equal((af(amiga).dmg_inc ?? 0) - base, 0, 'a 4 casas, não');
  const outra = personagem();
  alocar(outra, /^aliados:dmg_inc$/);
  party(ana, [outra], 1);
  foto(ana);
  const proprio = af(outra).dmg_inc;
  const soDaAura = af(outra)['aliados:dmg_inc'];
  assert.equal(soDaAura, 30);
  foto(outra);
  // (a aura dela vale 30 nela; a da Ana também 30: fica 30, não 60)
  const semAna = personagem();
  alocar(semAna, /^aliados:dmg_inc$/);
  assert.equal(proprio, af(semAna).dmg_inc, 'o mesmo valor que sem a Ana');
});

test('a CONDIÇÃO é de quem dá: "Caso tenha sido Atacado Recentemente, você e Aliados possuem +X% de Chance de Bloquear o Dano de Ataques"', { skip: SEM }, () => {
  const ana = personagem();
  alocar(ana, /^aliados:block@acertadoAtaqueRecente$/);
  const valor = Object.entries(af(ana)).find(([k]) => k === 'aliados:block')?.[1] ?? 0;
  assert.equal(valor, 0, 'sem ter sido atacada, nada');
  const amiga = personagem();
  party(ana, [amiga], 1);
  const antes = af(amiga).block ?? 0;
  ModsPoe.marcar(ana.hunt, 'acertadoAtaque');
  foto(ana);
  const bonus = af(ana)['aliados:block'];
  assert.ok(bonus === 10 || bonus === 25, `${bonus}`);
  assert.equal((af(amiga).block ?? 0) - antes, bonus, 'a amiga perto ganha enquanto a Ana foi atacada há pouco');
});

test('"Auras das suas Habilidades concedem 3% de aumento das Velocidades de Ataque e Conjuração para você e Aliados": por aura ligada; no companheiro, só as auras que o alcançam', { skip: SEM }, () => {
  const ana = personagem();
  alocar(ana, /^aura_concede_vel$/);
  const x = af(ana).aura_concede_vel;
  assert.ok(x === 2 || x === 3, `${x}`);
  const antes = af(ana).atk_speed ?? 0;
  aura(ana, 'poe-gema:Hatred', 2);
  aura(ana, 'poe-gema:Grace', 4);
  assert.equal((af(ana).atk_speed ?? 0) - antes, 2 * x, 'duas auras');
  const amiga = personagem();
  party(ana, [amiga], 3);
  const dela = af(amiga);
  foto(ana);
  assert.equal((af(amiga).atk_speed ?? 0) - (dela.atk_speed ?? 0), x, 'a 3 casas, só a aura de raio 4');
  assert.equal((af(amiga).cast_speed ?? 0) - (dela.cast_speed ?? 0), x);
});

test('a Fortificação igual do Campeão ("Aliados Próximos contam como tendo Fortificação igual a sua"): no companheiro perto e nos seus lacaios', { skip: SEM }, () => {
  const ana = personagem();
  alocar(ana, /^aliados_fortificacao$/);
  ana.hunt.fortificacao = { n: 12, ate: ana.hunt.clock + 6000 };
  const amiga = personagem();
  party(ana, [amiga], 2);
  assert.equal(ModsPoe.fortificacao(amiga), 0);
  foto(ana);
  // (a da Ana com a ficha dela: os 12, ou o máximo, se o caminho da Campeã já dá "Você atingiu sua fortificação máxima")
  const daAna = ModsPoe.fortificacao(ana, af(ana));
  assert.ok(daAna >= 12, `${daAna}`);
  assert.equal(ModsPoe.fortificacao(amiga), daAna);
  const noLacaio = Aliados.doLacaio(ana, af(ana), daAna);
  assert.equal(noLacaio.fortificacao, daAna);
});

test('nos LACAIOS ("Aliados" inclui os lacaios): o dano soma ao aumentado do lacaio, o bloqueio de ataque e de magia, as resistências', { skip: SEM }, () => {
  const ana = personagem({ 'aliados:dmg_inc': 30, 'aliados:block': 10, 'aliados:spell_block': 20, 'aliados:fire_res': 30, 'aliados:ice_res': 30, 'aliados:energy_res': 30 });
  const x = Aliados.doLacaio(ana, af(ana), 0);
  assert.deepEqual([x.danoIncPct, x.bloqueio, x.bloqueioMagico, x.res], [30, 10, 20, 30]);
  const l = { uid: 'l1', x: 0, y: 0, hp: 100, maxHp: 100, poe: { bloqueio: 5, bloqueioMagico: 0 } };
  const eventos = [];
  assert.equal(Cacadas.lacaioBloqueia(l, null, eventos, () => 0.14, null, x.bloqueio), true, '5 + 10 = 15%');
  assert.equal(Cacadas.lacaioBloqueia(l, null, eventos, () => 0.16, null, x.bloqueio), false);
  assert.equal(LacaiosPoe.danoNoLacaio(l, { fisico: 50, magia: true, rng: () => 0.19, bloqueioMagicoExtra: x.bloqueioMagico }).bloqueou, true, 'bloqueio mágico 20%');
});

test('o Mestre do Metal: "+1000 de Armadura caso tenha Empalado Recentemente" e "6 a 12 de Dano Físico adicional para cada Empalar no Inimigo" — na amiga perto', { skip: SEM }, () => {
  const ana = personagem();
  alocar(ana, /^aliados:armor_flat@empalouRecente$/);
  const amiga = personagem();
  party(ana, [amiga], 1);
  const armadura = af(amiga).armor_flat ?? 0;
  ModsPoe.marcar(ana.hunt, 'empalou');
  foto(ana);
  assert.equal((af(amiga).armor_flat ?? 0) - armadura, 1000);
  assert.deepEqual([af(amiga).empalar_fisico_add_min, af(amiga).empalar_fisico_add_max], [6, 12]);
  const [b] = amiga.hunt.monstros;
  Object.assign(b, { hp: 1e9, maxHp: 1e9, estados: { empalado: [0, 1, 2].map(() => ({ valor: 0, acertos: 1, ate: amiga.hunt.clock + 5000 })) } });
  const r = ModsPoe.aoAcertar(amiga, amiga.hunt, b, Ficha.combate(amiga), { dano: 1, fisico: 0, rng: () => 0 });
  assert.equal(r.extra, Math.max(1, Math.round(resistido(amiga.hunt, b, 'physical', 3 * 6, null, { armadura: false }))), '3 Empalamentos × 6');
});

test('os cadáveres de quem dá (Gula por Essências, Portador da Infestação) e o Vento Favorável (Ventania) — na amiga perto', { skip: SEM }, () => {
  const ana = personagem();
  alocar(ana, /^aliados:mais_dano@cadaverPerto$/);
  const amiga = personagem();
  party(ana, [amiga], 1);
  foto(ana);
  assert.equal(af(amiga)['mais_dano'] ?? 0, 0, 'sem cadáver perto da Ana');
  ana.hunt.cadaveres = [{ key: 'x', x: ana.hunt.pos.x + 1, y: ana.hunt.pos.y }];
  foto(ana);
  assert.equal(af(amiga).mais_dano, 10);
  const vento = personagem();
  alocar(vento, /^aliados:sempre:ventoFavoravel$/);
  const outra = personagem();
  party(vento, [outra], 2);
  foto(vento);
  assert.equal(af(outra)['sempre:ventoFavoravel'], 1);
});

test('"se você tiver pelo menos 1 aliado por perto" (Glória do Comando): um companheiro da party a até 3 casas conta (antes, só lacaio)', { skip: SEM }, () => {
  const ana = personagem();
  alocar(ana, /^accuracy_inc@aliadosPerto:1$/);
  const sozinha = af(ana).accuracy_inc ?? 0;
  const amiga = personagem();
  party(ana, [amiga], 3);
  assert.equal((af(ana).accuracy_inc ?? 0) - sozinha, 40);
  amiga.hunt.pos = { ...amiga.hunt.pos, x: ana.hunt.pos.x + 5 };
  assert.equal((af(ana).accuracy_inc ?? 0) - sozinha, 0);
});

test('a Ichimonji: "Buffs de Auras Aliadas não afetam você" e "Os Buffs das Suas Auras não afetam aliados" — nas auras de gema e nas do nó', { skip: SEM }, () => {
  const ana = personagem({ 'aliados:dmg_inc': 30 });
  ana.hunt.buffs = { 'poe-gema:Anger': { tipo: 'poe-aura', ate: ana.hunt.clock + 60_000, raio: 4, afPoe: { added_fire_dmg_min: 10 } } };
  const amiga = personagem();
  party(ana, [amiga], 1);
  foto(ana);
  assert.ok((af(amiga).added_fire_dmg_min ?? 0) >= 10 && (af(amiga).dmg_inc ?? 0) >= 30, 'sem a espada, as duas valem');
  const comEspada = personagem({ auras_aliadas_nao_afetam: 1 });
  party(ana, [comEspada], 1);
  foto(ana);
  assert.equal(af(comEspada).added_fire_dmg_min ?? 0, 0);
  assert.equal(af(comEspada)['aliados:dmg_inc'] ?? 0, 0);
  const egoista = personagem({ 'aliados:dmg_inc': 30, auras_so_em_voce: 1 });
  egoista.hunt.buffs = { 'poe-gema:Anger': { tipo: 'poe-aura', ate: egoista.hunt.clock + 60_000, raio: 4, afPoe: { added_fire_dmg_min: 10 } } };
  const outra = personagem();
  const base = af(outra).dmg_inc ?? 0;
  party(egoista, [outra], 1);
  foto(egoista);
  assert.equal(af(outra).added_fire_dmg_min ?? 0, 0, 'a aura de gema da dona da espada não vale na amiga');
  assert.equal((af(outra).dmg_inc ?? 0) - base, 0, 'nem a do nó');
});

test('a ÁRVORE: as linhas de aliado com efeito no balão (sobram a Chama Santificada, a Relíquia Elemental e as da Mana Reservada)', { skip: SEM }, () => {
  const linhas = P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i] }))));
  const achadas = linhas.filter((l) => /[Aa]liad/.test(l.t) && !/^\(/.test(l.t) && !/Chamas Santificadas|Relíquia Elemental|Mana Reservada/.test(l.t));
  assert.ok(achadas.length >= 20, `${achadas.length}`);
  for (const l of achadas) assert.ok(['equivalente', 'novo', 'aproximado'].includes(l.estado), `${l.t}: ${l.estado}`);
});
