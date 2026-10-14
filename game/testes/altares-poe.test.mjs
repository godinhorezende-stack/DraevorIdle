// OS ALTARES DO PoE (dono, 14/10: "Altares e Geada", e "Todos os 13 agora"): os buffs dos Santuários do PoE (poedb, 3.29) — os 13 do sorteio
// (Aceleração, Brutal, Congelante Maior, Diamante, Ecoante, Sombrio, Impenetrável, Massivo, Reabastecimento, Resistência, Carregado,
// Eletrizante Maior, Esquelético Maior) —, a Harmonia do Propósito (um altar ao acaso a cada 10 s, por 20 s), o Gritos dos Dessecados (o Altar
// Impenetrável sem frascos ativos) e o efeito e a duração dos buffs de altar das peças.
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
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Um personagem do PoE numa caçada, com `af` na varinha. */
function personagem(af = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = peca('Wands/Driftwood_Wand');
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
const soma = (e) => { Ficha.invalidar(e); return Afixos.soma(e); };
const linha = (re) => P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i], nota: o.notas?.[i] ?? null, efeitos: o.efeitos })))).find((l) => re.test(l.t));

test('os BUFFS de altar dão os números do PoE; "Efeito dos Buffs de Altares em você aumentado" multiplica', { skip: SEM }, () => {
  const e = personagem();
  const antes = soma(e);
  ModsPoe.ganharBuff(e.hunt, 'altarImpenetravel', 20);
  const com = soma(e);
  for (const k of ['evasion_pct', 'es_pct', 'armour_pct']) assert.equal((com[k] ?? 0) - (antes[k] ?? 0), 100, k);
  const r = personagem({ efeito_altar: 50 });
  const r0 = soma(r);
  ModsPoe.ganharBuff(r.hunt, 'altarResistencia', 20);
  const r1 = soma(r);
  assert.equal((r1.fire_res ?? 0) - (r0.fire_res ?? 0), 75, '+50% × 1,5');
  assert.equal((r1.chaos_res_max ?? 0) - (r0.chaos_res_max ?? 0), 15, '+10% de todas as máximas × 1,5');
  // (o nível das gemas que os Maiores disparam não aumenta com o efeito)
  ModsPoe.ganharBuff(r.hunt, 'altarCongelanteMaior', 20);
  const r2 = soma(r);
  assert.equal(r2['periodico:2:gatilho:nova-glacial'], 20);
  assert.equal((r2.phys_as_extra_ice ?? 0) - (r1.phys_as_extra_ice ?? 0), 45);
});

test('o ALTAR MASSIVO dá Vida (a caçada refaz a vida máxima quando os altares mudam); o DIAMANTE, todo acerto crítico; o ECOANTE, uma repetição', { skip: SEM }, () => {
  const e = personagem();
  const vida = e.maxHp;
  ModsPoe.ganharBuff(e.hunt, 'altarMassivo', 20);
  Cacadas.tique(e, null, e.hunt.clock + 250);
  assert.ok(e.maxHp > vida * 1.2, `${vida} → ${e.maxHp}`);
  const d = personagem();
  ModsPoe.ganharBuff(d.hunt, 'altarDiamante', 20);
  const f = (() => { Ficha.invalidar(d); return Ficha.combate(d); })();
  const alvo = { uid: 1, key: 'rat', x: 1, y: 1, hp: 100, maxHp: 100 };
  for (let i = 0; i < 20; i++) assert.equal(Ficha.rolarCritico(d, 10, alvo, [], { ...f, critChance: 0 }).crit, true);
  assert.equal(Ficha.rolarCritico(d, 10, alvo, [], { ...f, critChance: 0, afPoe: { ...f.afPoe, nunca_critico: 1 } }).crit, false, 'o "nunca crítico" vence');
  ModsPoe.ganharBuff(d.hunt, 'altarEcoante', 20);
  assert.equal(soma(d).repeticoes_extra, 1);
});

test('a HARMONIA DO PROPÓSITO: um dos 13 altares ao acaso a cada 10 s, por 20 s (× a Duração dos Efeitos de Altares)', { skip: SEM }, () => {
  const l = linha(/^Ganha um buff de altar aleatório a cada 10 segundos$/);
  assert.equal(l.estado, 'aproximado');
  assert.match(l.nota, /Nova Glacial/);
  assert.ok(l.efeitos.some((x) => x.add === 'altar_aleatorio:10' && x.valor === 20));
  assert.equal(ModsPoe.ALTARES_DO_SORTEIO.length, 13);
  const e = personagem({ 'altar_aleatorio:10': 20, duracao_altar: 50 });
  const f = (() => { Ficha.invalidar(e); return Ficha.combate(e); })();
  const t0 = e.hunt.clock;
  ModsPoe.aurasProximas(e, e.hunt, f, t0);
  assert.deepEqual(Object.keys(e.hunt.poeBuffs ?? {}).filter((k) => k.startsWith('altar')), [], 'o primeiro, depois de 10 s');
  ModsPoe.aurasProximas(e, e.hunt, f, t0 + 10_000);
  const ganhos = Object.entries(e.hunt.poeBuffs ?? {}).filter(([k]) => k.startsWith('altar'));
  assert.equal(ganhos.length, 1);
  assert.ok(ModsPoe.ALTARES_DO_SORTEIO.includes(ganhos[0][0]), ganhos[0][0]);
  assert.equal(ganhos[0][1], t0 + 10_000 + 30_000, '20 s × 1,5');
});

test('o GRITOS DOS DESSECADOS: o Altar Impenetrável enquanto nenhum frasco está ativo; os Altares Menores do Erro Crasso', { skip: SEM }, () => {
  const l = linha(/^Você tem o bônus do Altar Impenetrável/);
  assert.equal(l.estado, 'novo');
  const e = personagem({ 'sempre:altarImpenetravel@semFrasco': 1 });
  const sem = soma(e);
  e.hunt.frascosPoe = { ativos: { 1: { ate: e.hunt.clock + 5000, recurso: 'vida' } } };
  const com = soma(e);
  assert.equal((sem.evasion_pct ?? 0) - (com.evasion_pct ?? 0), 100, 'com um frasco ativo, sai');
  const m = personagem({ 'sempre:altarMassivoMenor': 1, 'sempre:altarBrutalMenor': 1 });
  const s = soma(m);
  assert.ok(s.area_inc >= 20 && s.chance_empurrar >= 100 && s.stun_duration >= 20);
});

test('os MAIORES disparam as gemas a cada 2 s no bicho mais perto (a Nova Glacial do Congelante)', { skip: SEM }, () => {
  const e = personagem();
  const h = e.hunt;
  ModsPoe.ganharBuff(h, 'altarCongelanteMaior', 20);
  const f = (() => { Ficha.invalidar(e); return Ficha.combate(e); })();
  const bicho = h.monstros.find((m) => m.hp > 0);
  assert.ok(bicho, 'há um bicho');
  Object.assign(bicho, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9 });
  for (const m of h.monstros) if (m !== bicho) m.hp = 0;
  const t0 = h.clock;
  ModsPoe.aurasProximas(e, h, f, t0);
  ModsPoe.aurasProximas(e, h, f, t0 + 2000);
  assert.ok(bicho.hp < 1e9, 'a Nova acertou o bicho');
  assert.ok((h.poeEventosDoTempo ?? []).some((x) => x.t === 'gatilho' && /Nova Glacial/.test(x.skill ?? '')), JSON.stringify((h.poeEventosDoTempo ?? []).slice(0, 3)));
});
