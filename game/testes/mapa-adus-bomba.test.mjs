// O General Adus nos MAPAS (o chefe do T7, nível 74 — o mapa o leva do nível 63 por e^(0,0519 × 11) = × 1,77, as habilidades junto): a Bomba
// Viva ia a 5.805–7.095 de Raio, o maior golpe elemental até o T15, e matava com um golpe. O dono (27/10): nos mapas ela sai × 0,6
// (`mapas.json → instancia.fatorDasHabilidades`) — 3.483–4.257 no T7; a campanha (o Ato 9) fica como está (3.280–4.009, o dano do poedb).
// E a regra do PoE: o Terremoto dele é um ATAQUE (Slam), não uma magia — a Evasão e o Bloqueio de Ataque valem nele (não o de Magia), e o
// Supercarregado converte 50% do dano físico em Raio (poedb).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Poderes = await import('../systems/poderes.mjs');
const MapasAreas = await import('../systems/itens-poe/mapas-areas.mjs');
const Mapas = await import('../systems/itens-poe/mapas.mjs');
const Habilidades = await import('../systems/itens-poe/habilidades.mjs');
const { criarMonstro } = await import('../systems/hunt/monstros.mjs');

const campanha = () => JSON.parse(readFileSync(new URL('../gamedata/itens-poe/campanha-poe.json', import.meta.url), 'utf8'));
/** O General Adus da campanha (o do Ato 9, nível 63). */
const adusDaCampanha = () => Object.values(campanha().areas).flatMap((a) => a.monstros ?? []).find((m) => m.slug === 'General_Adus');
const tiersDoAdus = () => (Mapas.DADOS.instancia?.porTier ?? []).filter((t) => t.chefe === 'General_Adus').map((t) => Number(t.tier));

test('mapas: a Bomba Viva do General Adus × 0,6 em todo tier em que ele é o chefe (3.483–4.257 de Raio no T7); a campanha fica 3.280–4.009', { skip: SEM }, () => {
  MapasAreas.iniciar();
  assert.deepEqual(tiersDoAdus(), [7], 'o Adus é o chefe só do T7');
  for (const tier of tiersDoAdus()) {
    const bomba = Poderes.poderesDe(MapasAreas.chefeDoTier(tier)).ataques.find((a) => a.nome === 'LivingBombLightningAdus');
    assert.ok(bomba, `T${tier}: a Bomba Viva`);
    if (tier === 7) assert.deepEqual([bomba.elemento, bomba.min, bomba.max], ['energy', 3483, 4257], 'T7: 5.805–7.095 × 0,6');
  }
  // O fator é só da Bomba: o Terremoto do mapa continua com o crescimento por nível inteiro.
  const terremoto = Poderes.poderesDe(MapasAreas.chefeDoTier(7)).ataques.find((a) => a.nome === 'Terremoto');
  assert.deepEqual([terremoto.min, terremoto.max], [655, 981]);
  // A campanha: o dano do poedb no nível 63, sem o × 0,6.
  const [bombaDaCampanha] = Habilidades.convertidas(adusDaCampanha()).filter((h) => h.nome === 'LivingBombLightningAdus');
  assert.deepEqual([bombaDaCampanha.elemento, bombaDaCampanha.min, bombaDaCampanha.max], ['energy', 3280, 4009]);
});

test('o Terremoto do Adus é um ATAQUE do PoE (Slam): a tag Attack e a Melee, e o Supercarregado converte 50% do físico em Raio', { skip: SEM }, () => {
  const terremoto = Habilidades.convertidas(adusDaCampanha()).find((h) => h.nome === 'Terremoto');
  assert.equal(terremoto.ataque, true);
  assert.equal(terremoto.corpoACorpo, true);
  assert.deepEqual(terremoto.convertePct, { energy: 50 });
  const doMapa = Poderes.poderesDe(MapasAreas.chefeDoTier(7)).ataques.find((a) => a.nome === 'Terremoto');
  assert.equal(doMapa.ataque, true);
  assert.deepEqual(doMapa.convertePct, { energy: 50 });
  // A Bomba é magia: sem a marca de ataque.
  assert.ok(!Poderes.poderesDe(MapasAreas.chefeDoTier(7)).ataques.find((a) => a.nome === 'LivingBombLightningAdus').ataque);
});

function cena() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.equipment = {};
  e.maxHp = e.hp = 1e6;
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  const m = criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null);
  h.monstros.splice(0, h.monstros.length, m);
  return { e, h, m };
}
const comSorte = (valor, fn) => {
  const original = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = original; }
};
const disparar = ({ e, h, m }, ficha, a) => {
  const eventos = [];
  const dano = Poderes.dispararMagia({ estado: e, hunt: h, personagem: PERSONAGEM, bicho: m, eventos, agora: h.clock, ficha, temEscudo: false }, a);
  return { dano, bloqueou: eventos.some((x) => x.t === 'block' && !x.esquiva), esquivou: eventos.some((x) => x.t === 'block' && x.esquiva) };
};

test('dispararMagia: no ATAQUE do PoE vale o Bloqueio de Ataque (não o de Magia) e a Evasão; na magia, o contrário', { skip: SEM }, () => {
  const c = cena();
  const base = { ...Ficha.combate(c.e), esquiva: 0, evitarDano: 0, esquivaMagica: 0, evasion: 0, supressaoDeMagia: 0 };
  const ataque = { tipo: 'magia', elemento: 'physical', min: 100, max: 100, forma: 'alvo', ataque: true };
  const magia = { tipo: 'magia', elemento: 'physical', min: 100, max: 100, forma: 'alvo' };
  const soAtaque = { ...base, blockChance: 0.5, blockChanceMin: 0.5, blockChanceMax: 0.5, bloqueioDeMagia: 0 };
  const soMagia = { ...base, blockChance: 0, blockChanceMin: 0, blockChanceMax: 0, bloqueioDeMagia: 0.5 };
  assert.equal(comSorte(0.01, () => disparar(c, soAtaque, ataque)).bloqueou, true, 'o ataque: o Bloqueio de Ataque');
  assert.equal(comSorte(0.01, () => disparar(c, soMagia, ataque)).bloqueou, false, 'o ataque: o Bloqueio de Magia não');
  assert.equal(comSorte(0.01, () => disparar(c, soMagia, magia)).bloqueou, true, 'a magia: o Bloqueio de Magia');
  assert.equal(comSorte(0.01, () => disparar(c, soAtaque, magia)).bloqueou, false, 'a magia: o Bloqueio de Ataque não');
  // A Evasão: muita Evasão esquiva do ataque quase sempre (o teto de 95%, com a entropia), nunca da magia.
  const evasiva = { ...base, evasion: 1e7, blockChance: 0, blockChanceMin: 0, blockChanceMax: 0, bloqueioDeMagia: 0 };
  let doAtaque = 0;
  let daMagia = 0;
  for (let i = 0; i < 20; i++) {
    if (disparar(c, evasiva, ataque).esquivou) doAtaque++;
    if (disparar(c, evasiva, magia).esquivou) daMagia++;
  }
  assert.ok(doAtaque >= 15, `o ataque esquivado ${doAtaque} de 20`);
  assert.equal(daMagia, 0);
  // A Supressão de Feitiço não vale no ataque: com 100% de supressão, o ataque bate o dano todo e a magia, metade.
  const supressora = { ...base, blockChance: 0, blockChanceMin: 0, blockChanceMax: 0, bloqueioDeMagia: 0, supressaoDeMagia: 1 };
  const noAtaque = comSorte(0.5, () => disparar(c, supressora, { ...ataque, elemento: 'fire' })).dano;
  const naMagia = comSorte(0.5, () => disparar(c, supressora, { ...magia, elemento: 'fire' })).dano;
  assert.ok(noAtaque > 0 && Math.abs(naMagia - noAtaque / 2) <= 1, `ataque ${noAtaque}, magia ${naMagia}`);
});

test('dispararMagia: a conversão do físico (50% em Raio) — a parte convertida leva a resistência a Raio, a física a armadura', { skip: SEM }, () => {
  const c = cena();
  const base = { ...Ficha.combate(c.e), esquiva: 0, evitarDano: 0, esquivaMagica: 0, evasion: 0, supressaoDeMagia: 0, blockChance: 0, blockChanceMin: 0, blockChanceMax: 0, bloqueioDeMagia: 0, armor: 0 };
  base.protection = { ...(base.protection ?? {}), physical: 0, energy: 60 };
  const golpe = { tipo: 'magia', elemento: 'physical', min: 1000, max: 1000, forma: 'alvo', ataque: true };
  const fisico = comSorte(0.5, () => disparar(c, base, golpe)).dano;
  const convertido = comSorte(0.5, () => disparar(c, base, { ...golpe, convertePct: { energy: 50 } })).dano;
  // Sem armadura: o físico inteiro passa; metade em Raio passa × (1 − 60% de resistência a Raio).
  const resRaio = 1 - (comSorte(0.5, () => disparar(c, base, { ...golpe, elemento: 'energy' })).dano / 1000);
  assert.ok(Math.abs(resRaio - 0.6) < 0.01, `a resistência a Raio: ${resRaio}`);
  assert.equal(fisico, 1000);
  assert.ok(Math.abs(convertido - 700) <= 2, `500 físico + 500 × 40% de Raio = 700 (veio ${convertido})`);
});
