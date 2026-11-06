// (06/11, lote 9 das inertes — dono: "Continue resolvendo até dar zero nos itens") os efeitos EM ALIADOS dos únicos: "Aliados Próximos <efeito>" sem você (`so_aliados:`),
// as cargas e a vida dadas aos companheiros, o "ao Morrer", os frascos nos aliados e nos vinculados, as auras da Mão de Phrecia e as Afecções do Devorador de Pecados.
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
const J = await import('../systems/itens-poe/jogo.mjs');
const Aliados = await import('../systems/itens-poe/aliados.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Testador = await import('../systems/personagem/testador.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const Traduzir = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const t = (texto) => {
  const nums = [];
  const modelo = texto.replace(/-?\d+(?:[.,]\d+)?/g, (m) => { nums.push(Number(m)); return `{${nums.length - 1}}`; });
  return Traduzir.traduzirMod({ modelo, valores: nums });
};
function personagem(linhas = []) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Duelist';
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  const af = { ...(arma.poe.af ?? {}) };
  for (const l of linhas) for (const x of t(l).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  arma.poe.af = af;
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.maxHp = e.hp = 10_000;
  P.garantir(e);
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  return e;
}
function party(dono, aliados, dx = 2) {
  const membros = [{ estado: dono, nome: 'Ana' }, ...aliados.map((a, i) => ({ estado: a, nome: `Amiga${i}` }))];
  const naSala = membros.map((m) => m.estado);
  aliados.forEach((a, i) => { a.hunt.pos = { ...dono.hunt.pos, x: dono.hunt.pos.x + dx + i }; a.hunt.z = dono.hunt.z; a.hunt.clock = dono.hunt.clock; });
  for (const m of membros) m.estado.hunt.partilha = { ativa: true, bonus: 1, membros, naSala };
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const foto = (e) => Aliados.fotografar(e, ficha(e).afPoe, {});

test('"Aliados Próximos <efeito>" vale nos companheiros perto, e não em você (o Regicriador, a Respiração Moribunda)', { skip: SEM }, () => {
  const dono = personagem(['Aliados Próximos possuem +50% de Multiplicador de Acerto Crítico', 'Aliados próximos ganham um aumento de 18% de Dano']);
  const amiga = personagem();
  const base = { crit: ficha(amiga).afPoe.crit_dmg ?? 0, dano: ficha(amiga).afPoe.dmg_inc ?? 0, critDono: ficha(dono).afPoe.crit_dmg ?? 0 };
  party(dono, [amiga]);
  foto(dono);
  assert.equal((ficha(amiga).afPoe.crit_dmg ?? 0) - base.crit, 50);
  assert.equal((ficha(amiga).afPoe.dmg_inc ?? 0) - base.dano, 18);
  assert.equal(ficha(dono).afPoe.crit_dmg ?? 0, base.critDono, 'em você não');
  party(dono, [amiga], 9);
  assert.equal((ficha(amiga).afPoe.dmg_inc ?? 0) - base.dano, 0, 'longe (9 casas), não');
});

test('cargas e vida aos aliados: a Bondade de Victario ao Matar; os Grilhões e as Lentes de Maligaro ao Morrer', { skip: SEM }, () => {
  const dono = personagem(['10% de chance de conceder uma Carga de Poder para Aliados ao Matar', 'Você concede 4 Cargas de Frenesi para Aliados ao Morrer', 'Aliados próximos Recuperam 1% de sua Vida Máxima quando você Morre']);
  const amiga = personagem();
  party(dono, [amiga]);
  const h = dono.hunt;
  for (let i = 0; i < 60; i++) ModsPoe.evento(dono, h, 'matar', ficha(dono), { rng: () => 0.05 });
  assert.equal(amiga.hunt.cargasPoe?.poder?.n, 3);
  amiga.hp = 5000;
  dono.hp = 0;
  ModsPoe.aoSerAcertado(dono, h, null, ficha(dono), { dano: 100, corpoACorpo: true, tipo: 'physical' });
  assert.equal(amiga.hunt.cargasPoe?.frenesi?.n, 3, 'até o máximo (3)');
  assert.equal(amiga.hp, 5100);
});

test('o Vínculo D\'alma: os alvos vinculados não podem morrer por 2 s depois da sua morte', { skip: SEM }, () => {
  const dono = personagem(['Alvos Vinculados Não Podem Morrer por 2 segundos após a sua Morte']);
  const amiga = personagem();
  party(dono, [amiga]);
  dono.hunt.vinculos = [{ acao: 'x', ate: dono.hunt.clock + 10_000, alvos: [{ tipo: 'jogador', nome: 'Amiga0' }] }];
  dono.hp = 0;
  ModsPoe.aoSerAcertado(dono, dono.hunt, null, ficha(dono), { dano: 100, corpoACorpo: true, tipo: 'physical' });
  assert.ok(Testador.naoMorre(amiga));
  amiga.hp = -50;
  assert.ok(Testador.segurarVida(amiga));
  assert.equal(amiga.hp, 1);
  amiga.hunt.clock += 2001;
  assert.ok(!Testador.naoMorre(amiga));
});

test('os frascos: a Drogaria (a Vida do frasco vai aos aliados) e o Voo de Victario (o Mercúrio também neles)', { skip: SEM }, () => {
  const dono = personagem(['100% da Recuperação de Vida dos Frascos é aplicada aos Aliados próximos ao invés de Você', 'Frascos de Mercúrio que você Usar também se aplicam aos Aliados próximos']);
  const amiga = personagem();
  party(dono, [amiga]);
  const vida = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Life_Flasks/Divine_Life_Flask', raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const mercurio = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Utility_Flasks/Quicksilver_Flask', raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  Frascos.cinto(dono)[0] = vida;
  Frascos.cinto(dono)[1] = mercurio;
  vida.poe.cargas = mercurio.poe.cargas = 100;
  dono.hp = amiga.hp = 1000;
  assert.ok(Frascos.usar(dono, 1, []));
  assert.ok((ficha(amiga).afPoe.move_speed ?? 0) >= 40, 'o Mercúrio na aliada');
  assert.ok(Frascos.usar(dono, 0, []));
  // (a recuperação ao longo do tempo, no tique do cinto: em você, nada)
  dono.hunt.clock += 10_000;
  Frascos.tique(dono, []);
  assert.equal(dono.hp, 1000, 'você não recupera');
  assert.ok(amiga.hp > 1000, 'a aliada, sim');
});

test('a Mão de Phrecia: as auras só nos vinculados (de qualquer distância) e +31% de Efeito com um Alvo Vinculado; o Devorador de Pecados', { skip: SEM }, () => {
  const dono = personagem(['Auras Não-Maldição das suas Habilidades só se aplicam a você e aos Alvos Vinculados', 'Efeito de Auras Não-Maldição das suas Habilidades aumentado em 31% enquanto você tiver um Alvo Vinculado', 'Inimigos inflingem Afecções Elementais em você ao invés de Aliados próximos']);
  const amiga = personagem();
  party(dono, [amiga], 8);
  dono.hunt.buffs = { 'poe-gema:odio': { tipo: 'poe-aura', ate: dono.hunt.clock + 60_000, raio: 2, afPoe: { phys_as_extra_ice: 10 } } };
  assert.ok(!((ficha(amiga).afPoe.phys_as_extra_ice ?? 0) > 0), 'sem Vínculo, nada');
  dono.hunt.vinculos = [{ acao: 'x', ate: dono.hunt.clock + 10_000, alvos: [{ tipo: 'jogador', nome: 'Amiga0' }] }];
  assert.ok((ficha(amiga).afPoe.phys_as_extra_ice ?? 0) > 0, 'vinculada, de 8 casas');
  assert.equal(ficha(dono).afPoe['efeito_buff_gema:aura'], 31);
  party(dono, [amiga], 2);
  foto(dono);
  assert.equal(ficha(amiga).afPoe.imune_congelamento, 1);
});
