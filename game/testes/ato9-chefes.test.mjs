// O Ato 9 travava no nível 83 (jogador, 19/10: "a fase 9 e a fase 11 não consegue passar"; "general adus ele toma 1 hit e morre e nem sabe
// da onde tá vindo"). A Refinaria: a Bomba Viva do General Adus batia 5.571–6.809 de Raio (o dano do poedb × o fator das magias do Único),
// o maior golpe da campanha — agora bate o do poedb, só nele. O Núcleo em Putrefação: a Trindade Depravada nascia junto com Doedre,
// Shavronne e Maligaro (a Doedre e a Shavronne coladas) — agora um por vez, a Trindade por último, e as habilidades dos quatro com o dano do
// poedb × 0,85 (dono, 19/10: 9A, 11A e "nerfe um pouco essas fases para não ficar impossível de passar, mas também não pode ficar fácil com build fraca").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE ausente';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Campanha = await import('../systems/campanha.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const Instancia = await import('../systems/hunt/instancia.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Habilidades = await import('../systems/itens-poe/habilidades.mjs');
const Bolsa = await import('../systems/bolsa.mjs');

function naFase(huntId) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 83 });
  e.sistema = 'poe';
  e.campanha = { facil: { completas: Campanha.FASES.map((x) => x.huntId).filter((id) => id !== huntId), bosses: [1, 2, 3, 4, 5, 6, 7, 8] } };
  Bolsa.garantir(e);
  assert.ok(Cacadas.entrar(e, { huntId, mode: 'auto', strategy: 'nearest', dificuldade: 'facil' }).ok);
  return e;
}
const bichos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];
const chefe = (e, slug) => bichos(e).find((m) => m.hp > 0 && Campanha.ehOMonstro(m.key, slug));
const TRES = ['Doedre,_Darksoul', 'Shavronne,_Unbound', 'Maligaro,_The_Broken'];

test('Refinaria: a Bomba Viva do General Adus bate o dano do poedb (3.280–4.009 de Raio); as outras habilidades seguem com o fator', { skip: SEM }, () => {
  const e = naFase('poe-a9-the-refinery');
  const adus = chefe(e, 'General_Adus');
  assert.ok(adus, 'o Adus nasce');
  const bomba = Poderes.poderesDe(adus.key).ataques.find((a) => a.nome === 'LivingBombLightningAdus');
  assert.deepEqual([bomba.elemento, bomba.min, bomba.max], ['energy', 3280, 4009]);
  // O Terremoto (ataque) continua com o fator do Único (o golpe corpo a corpo ÷ o Ataque Padrão do poedb).
  const terremoto = Poderes.poderesDe(adus.key).ataques.find((a) => a.nome === 'Terremoto');
  assert.deepEqual([terremoto.min, terremoto.max], [370, 554]);
  // Só nele: outra magia (a Lança de Energia de Solaris, Ato 8) segue com o fator das magias do Único.
  const [lanca] = Habilidades.convertidas({ dano: 1, habilidades: [{ nome: 'Ataque Padrão', dano: { min: 1, max: 1 } }, { nome: 'SolarisEnergyLance', interno: 'SolarisEnergyLance', tags: ['Spell'], elemento: 'fire', dano: { min: 670, max: 670 } }] });
  assert.equal(lanca.min, 1000, '670 ÷ 0,67');
});

test('Núcleo em Putrefação: as habilidades dos chefes e mini-chefes batem o dano do poedb × 0,85 (a Tormenta Explosiva da Shavronne: 728–1.091 de Raio)', { skip: SEM }, () => {
  const areas = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/campanha-poe.json', import.meta.url), 'utf8')).areas;
  const doNucleo = (slug) => areas['poe-a9-the-rotting-core'].monstros.find((m) => m.slug === slug);
  const tormenta = Habilidades.convertidas(doNucleo('Shavronne,_Unbound')).find((h) => h.nome === 'Tormenta Explosiva');
  assert.deepEqual([tormenta.elemento, tormenta.min, tormenta.max], ['energy', 728, 1091], 'o poedb 856–1.283 × 0,85');
  for (const slug of [...TRES, 'The_Depraved_Trinity', 'Doedres_Torment', 'Eye_Hatchery', 'Stygian_Revenant', 'Maligaros_Muse']) {
    const m = doNucleo(slug);
    assert.ok(m, slug);
    for (const h of Habilidades.convertidas(m)) {
      const p = m.habilidades.find((x) => (x.nome ?? x.interno) === h.nome);
      if (p?.dano) assert.deepEqual([h.min, h.max], [Math.max(1, Math.round(p.dano.min * 0.85)), Math.max(Math.max(1, Math.round(p.dano.min * 0.85)), Math.round(p.dano.max * 0.85))], `${slug}: ${h.nome}`);
    }
  }
  // Os outros chefes seguem com o fator das magias (a Lança de Energia de Solaris, Ato 8).
  const solaris = areas['poe-a8-the-harbour-bridge'].monstros.find((m) => m.slug === 'Solaris,_Eternal_Sun');
  const lanca = Habilidades.convertidas(solaris).find((h) => h.nome === 'SolarisEnergyLance');
  assert.ok(lanca.max > solaris.habilidades.find((x) => x.interno === 'SolarisEnergyLance').dano.max, 'com o fator');
});

test('Núcleo em Putrefação: um chefe por vez — Doedre, Shavronne, Maligaro e a Trindade Depravada por último; matá-la conclui a fase e vence o ato', { skip: SEM }, () => {
  const huntId = 'poe-a9-the-rotting-core';
  const e = naFase(huntId);
  const h = e.hunt;
  assert.ok(chefe(e, 'Doedre,_Darksoul'), 'a Doedre nasce');
  for (const s of ['Shavronne,_Unbound', 'Maligaro,_The_Broken', 'The_Depraved_Trinity']) assert.equal(chefe(e, s), undefined, `${s} não nasce junto`);
  assert.equal(h.instancia.reserva.length, 3);
  // Ela conta na limpeza desde o começo.
  const { total } = Instancia.progresso(h);
  assert.equal(Instancia.pendentes(h), total);
  let t = Date.now();
  h.ultimoTique = t;
  for (const [i, s] of TRES.entries()) {
    assert.ok(chefe(e, s), `${s} está na vez`);
    for (const depois of TRES.slice(i + 1)) assert.equal(chefe(e, depois), undefined, `${depois} ainda espera`);
    Combate.matarMonstro(e, h, PERSONAGEM, chefe(e, s), []);
    e.hp = e.maxHp;
    Cacadas.tique(e, PERSONAGEM, (t += 250));
    assert.equal(!!chefe(e, 'The_Depraved_Trinity'), i === TRES.length - 1, `depois de ${i + 1} dos três`);
  }
  assert.equal(h.instancia.reserva.length, 0);
  assert.equal(h.instancia.status, 'ativa', 'a instância não limpou');
  assert.match(e.avisoDaHunt ?? '', /Trindade Depravada aparece/);
  assert.equal(Campanha.faseCompleta(e, 'facil', huntId), false);
  Combate.matarMonstro(e, h, PERSONAGEM, chefe(e, 'The_Depraved_Trinity'), []);
  assert.equal(Campanha.faseCompleta(e, 'facil', huntId), true);
  assert.ok(e.campanha.facil.bosses.includes(9), 'o Ato 9 vencido');
});

test('Núcleo em Putrefação na caçada offline projetada: a Trindade entra quando a projeção tira os três (a instância não limpa sem ela)', { skip: SEM }, () => {
  const e = naFase('poe-a9-the-rotting-core');
  const h = e.hunt;
  const restam = Instancia.pendentes(h);
  assert.equal(Instancia.tirarAoAcaso(h, restam - 1, () => 0), restam - 1);
  assert.equal(Instancia.pendentes(h), 1);
  assert.equal(h.instancia.reserva.length, 0, 'a Trindade saiu da reserva');
  assert.ok(bichos(e).some((m) => m.hp > 0 && Campanha.ehOMonstro(m.key, 'The_Depraved_Trinity')), 'e é a última viva');
});
