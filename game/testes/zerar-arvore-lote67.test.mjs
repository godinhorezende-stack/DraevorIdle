// LOTE 67 — as RAMIFICADORAS, os NOTÁVEIS (a 2ª parte): 129 → 86 sem efeito. As mecânicas novas: a Exposição com CHANCE ao acertar
// (`exposicao_chance_<el>` — a padrão do PoE, −10%), "<Maldição> pode afetar Inimigos a Prova de Feitiços" (`feitico_afeta_aprova:<gema>`), a
// Resistência a Caos e a regeneração dos TOTENS, "Resfriou um Inimigo Recentemente" (o Resfriamento do acerto marca), "plantou uma Mina ou
// arremessou uma Armadilha Recentemente", "Matado ao menos N Inimigos Recentemente"; e as regras antigas que pegavam "Reserva" e "Grilhões
// Temporais" como inertes deixam passar as que agora têm efeito.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const A = await import('../systems/itens-poe/arvore.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

const efeitos = (linha) => Object.fromEntries(A.traduzirLinha(linha).efeitos.map((e) => [e.add, e.valor]));

test('as linhas: Exposição, maldições à Prova de Feitiços, totens, a reserva de uma gema com "de Reserva", "Grilhões Temporais"', { skip: SEM }, () => {
  assert.deepEqual(efeitos('Habilidades de Fogo têm chance de 25% de aplicar Exposição a Fogo ao Acertar'), { 'exposicao_chance_fogo@fogo': 25 });
  assert.deepEqual(efeitos('Inimigos Próximos têm Exposição a Gelo enquanto você estiver afetado por Arauto Glacial'), { 'aura_proximos:exposicaoGelo@afetadoPor:arauto-glacial': 1 });
  assert.deepEqual(efeitos('Flamabilidade pode afetar Inimigos a Prova de Feitiços'), { 'feitico_afeta_aprova:Flammability': 1 });
  assert.deepEqual(efeitos('Grilhões Temporais pode afetar Inimigos a Prova de Feitiços'), { 'feitico_afeta_aprova:Temporal_Chains': 1 });
  assert.deepEqual(efeitos('Totens ganham +25% de Resistência a Caos'), { totem_res_caos: 25 });
  assert.deepEqual(efeitos('Determinação tem Eficácia de Reserva de Mana aumentada em 50%'), { 'eficiencia_reserva_gema:determinacao': 50 });
  assert.deepEqual(efeitos('+1 de Armadura por cada 10 de Mana Máxima não Reservada'), { 'armor_flat%manaNaoReservada:10': 1 });
  assert.deepEqual(efeitos('Efeito em Área aumentado em 25% caso você tenha Matado ao menos 5 Inimigos Recentemente'), { 'area_inc@matouRecenteMin:5': 25 });
  assert.deepEqual(efeitos('Dano de Caos aumentado em 2% por cada 100 de Mana máxima, máximo de 80%'), { 'chaos_dmg%manaMax:100~80': 2 });
  // a maldição por gema chega à regra da maldição (a mesma do "Seus Feitiços podem afetar…")
  assert.match(readFileSync(new URL('../systems/acoes.mjs', import.meta.url), 'utf8'), /feitico_afeta_aprova:\$\{entry\.poeGema\.slug\}/);
});

test('a EXPOSIÇÃO com chance ao acertar: a da tag do golpe, a padrão do PoE (−10%)', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.sistema = 'poe';
  const hunt = { clock: 1000, monstros: [] };
  const alvo = { uid: 1, hp: 100, maxHp: 100, x: 0, y: 0, estados: {} };
  const ficha = (tags) => ({ afPoe: {}, porTag: [{ stat: 'exposicao_chance_fogo', tags: ['fogo'], valor: 100 }], tagsDoGolpe: tags });
  ModsPoe.aoAcertar(e, hunt, alvo, ficha(['gelo']), { rng: () => 0 });
  assert.ok(!alvo.estados.exposicao?.fire, 'golpe de Gelo: não');
  ModsPoe.aoAcertar(e, hunt, alvo, ficha(['fogo', 'magia']), { rng: () => 0 });
  assert.ok(alvo.estados.exposicao.fire > hunt.clock);
  assert.equal(alvo.estados.exposicaoPct.fire, 10);
});

test('as condições: Resfriou Recentemente (o Resfriamento do acerto), plantou Mina/Armadilha, Matou ao menos N', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.sistema = 'poe';
  e.hunt = { clock: 10_000, pos: { x: 0, y: 0 }, monstros: [], buffs: {}, poeRecente: {} };
  const ficha = { afPoe: {}, eventosPoe: [] };
  assert.ok(!C.condicoesDe(e).has('resfriouRecente'));
  ModsPoe.aoPorAfeccoes(e, e.hunt, { uid: 2, estados: {} }, ficha, ['lento']);
  assert.ok(C.condicoesDe(e).has('resfriouRecente'));
  assert.ok(!C.condicoesDe(e).has('plantouRecente'));
  e.hunt.poeRecente['usou:armadilha'] = 9_500;
  assert.ok(C.condicoesDe(e).has('plantouRecente'));
  e.hunt.poeMortesRecentes = [9000, 9200, 9400, 9600];
  const v = C.condicoesDe(e);
  assert.equal(C.vale(v, 'matouRecenteMin:5'), false);
  e.hunt.poeMortesRecentes.push(9800);
  assert.equal(C.vale(C.condicoesDe(e), 'matouRecenteMin:5'), true);
});

test('o RELATÓRIO: os notáveis sem efeito caem para no máximo 86 (o relatório conta a linha por notável)', { skip: SEM }, async () => {
  const { linhasDasRamificadoras } = await import('../tools/relatorio-arvore-poe.mjs');
  const { grupos } = await linhasDasRamificadoras(Catalogo.catalogo());
  assert.ok(grupos.notavel.sem <= 86, `${grupos.notavel.sem}`);
});
