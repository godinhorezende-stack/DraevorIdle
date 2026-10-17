// LOTE 57 — as últimas únicas de joia SORTEADAS (J31): o Solo Profano da Doutrina Racional (dono, 16/10: "Implementar como o Sagrado" — 8 s no
// chão, raio de 1 casa; os inimigos sobre ele, e por N s depois de sair com o "Perduram", levam +100% de chance de crítico e +10% de efeito de
// maldição) e o Limitado pelo Destino (1 linha de cada número de itens — 2, 4 e 6 — das 54 do poedb: "se N Itens do <Influência> estiverem
// equipados", as peças vestidas com a influência), com os "mais" de mana, atributos, velocidade de movimento e recarga.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const Gemas = await import('../systems/skills/gemas.mjs');
const Atributos = await import('../systems/personagem/atributos.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca, modificadoresDoUnico } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const anel = (af, influencias = null) => ({ id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id), count: 1, af: [], poe: { af, ...(influencias ? { influencias } : {}) } });
const semente = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const unica = (slug) => Catalogo.catalogo().classes.Jewels.unicos.find((u) => u.slug === slug);

test('o SOLO PROFANO: criado no Golpe Crítico (se a Inteligência for o maior Atributo); o inimigo sobre ele leva +100% de crítico e +10% de maldição', { skip: SEM }, () => {
  assert.deepEqual(tr('{0}% de chance de criar Solo Profano no Golpe Crítico se a Inteligência for seu maior Atributo', [25]).efeitos, [{ stat: 'ev:critico:soloProfano:8@maiorAtributo:int', valor: 25 }]);
  assert.deepEqual(tr('Efeitos do Solo Profano criados por você Perduram por {0} segundos', [4]).efeitos, [{ stat: 'solo_profano_perdura_s', valor: 4 }]);
  const hunt = { clock: 10_000, pos: { x: 5, y: 5 } };
  ModsPoe.criarSoloProfano(hunt, 8, 10_000);
  assert.equal(hunt.solosProfanos[0].ate, 18_000, 'no chão por 8 s');
  const perto = { uid: 'a', hp: 100, maxHp: 100, x: 6, y: 5 };
  const longe = { uid: 'b', hp: 100, maxHp: 100, x: 9, y: 5 };
  hunt.monstros = [perto, longe];
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.equipment = { ...e.equipment, ring: anel({ solo_profano_perdura_s: 4 }) };
  e.hunt = hunt;
  Ficha.invalidar(e);
  const ficha = Ficha.combate(e);
  ModsPoe.aurasProximas(e, hunt, ficha, 10_000);
  assert.ok(ModsPoe.noSoloProfano(perto, 10_000));
  assert.ok(!ModsPoe.noSoloProfano(longe, 10_000), 'fora do raio de 1 casa');
  assert.equal(perto.estados.soloProfano.ate, 10_000 + 1000 + 4000, 'perdura 4 s depois de sair');
  // o crítico do golpe nele: +100% de "aumentado" (a ficha com 5% de base e 50% de aumentado)
  const comCritico = { ...ficha, critPontos: 0.05, critChance: 0.075, critInc: 50, critMais: 1, critTeto: 1, critSortudo: false };
  assert.ok(Math.abs(ModsPoe.fichaDoGolpe(comCritico, ['ataque'], { alvo: perto, estado: e }).critChance - 0.05 * (1 + 150 / 100)) < 1e-9);
  assert.equal(ModsPoe.fichaDoGolpe(comCritico, ['ataque'], { alvo: longe, estado: e }).critChance, 0.075, 'fora do solo: o de sempre');
  // a maldição nele: +10% de efeito
  for (const m of [perto, longe]) m.maldicoes = { vuln: { ate: 99_000, desde: 0, dur: 99_000, efeitos: [{ tipo: 'vulneravel', pct: 20, tipos: ['physical'] }] } };
  assert.ok(Math.abs(Reforcos.vulnerabilidade(perto, 'physical', 10_000) - 1.22) < 1e-9);
  assert.ok(Math.abs(Reforcos.vulnerabilidade(longe, 'physical', 10_000) - 1.2) < 1e-9);
});

test('o LIMITADO PELO DESTINO: as 3 marcações sorteiam 1 linha cada, do número de itens delas (2, 4 e 6); as 54 traduzem', { skip: SEM }, () => {
  const u = unica('Bound_By_Destiny');
  assert.equal(u.linhasSorteadas.linhas.length, 54);
  for (const l of u.linhasSorteadas.linhas) assert.ok(['novo', 'equivalente', 'aproximado'].includes(tr(l.modelo, l.faixas.map((f) => f[0])).estado), l.modelo);
  for (let s = 1; s <= 10; s++) {
    const sorteadas = modificadoresDoUnico(u, semente(s)).filter((m) => m.sorteada);
    assert.equal(sorteadas.length, 3);
    const numeros = sorteadas.map((m) => Number(/se (?:tiver )?(\d+) itens/i.exec(m.texto)?.[1])).sort();
    assert.deepEqual(numeros, [2, 4, 6], sorteadas.map((m) => m.texto).join(' | '));
  }
  const g = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: Catalogo.catalogo().classes.Jewels.bases.find((b) => b.nome === u.base).id, raridade: 'unico', ilvl: 84, rng: semente(3), unico: 'Bound_By_Destiny' }));
  assert.equal(g.poe.modificadores.filter((m) => m.sorteada).length, 3);
});

test('"SE N ITENS DO <Influência> ESTIVEREM EQUIPADOS": as peças vestidas com a influência; e os "mais" de Vida, Mana, Força e Movimento', { skip: SEM }, () => {
  assert.deepEqual(tr('Mais {0}% de vida máxima se {1} Itens do Ancião estiverem equipados', [10, 2]).efeitos, [{ stat: 'life_more@itensInfluencia:elder:2', valor: 10 }]);
  assert.deepEqual(tr('Projéteis perfuram {0} alvos adicionais se {1} itens de caçador estiverem equipados', [2, 2]).efeitos, [{ stat: 'perfurar@itensInfluencia:hunter:2', valor: 2 }]);
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.equipment = { ...e.equipment, ring: anel({ 'mana_more@itensInfluencia:elder:2': 10 }, ['elder']) };
  Ficha.invalidar(e);
  assert.ok(!(Ficha.combate(e).afPoe.mana_more > 0), 'com 1 item do Ancião, não');
  e.equipment.ring2 = anel({}, ['elder']);
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).afPoe.mana_more, 10, 'com 2, sim');
  // a Força "mais": multiplica à parte do "aumentado" — (base + somado) × (1 + aumentado) × (1 + mais)
  const f = personagemDeTeste({ vocacao: 'knight', level: 60 });
  const sem = Atributos.principais(f, { str: 20, str_inc: 50 }).str;
  const com = Atributos.principais(f, { str: 20, str_inc: 50, str_mais: 10 }).str;
  assert.equal(com, Math.round(sem * 1.1));
});

test('o "+1 ao nível de todas as gemas de suporte NÃO EXCEPCIONAIS": o Maximizar (Excepcional) não sobe; os outros suportes, sim', { skip: SEM }, () => {
  const estado = { equipment: { neck: { poe: { af: { 'gem_level@suporte+naoExcepcional': 1 } } } } };
  const suportes = [...Gemas.DEFS.values()].filter((d) => d.tipo === 'support' && d.poe);
  const maximizar = suportes.find((d) => d.nome === 'Maximizar');
  const comum = suportes.find((d) => !(d.tags ?? []).includes('Excepcional') && d.nome !== 'Maximizar');
  assert.ok(maximizar && comum);
  assert.equal(Gemas.extrasDaGemaPoe(estado, null, maximizar).nivel, 0);
  assert.equal(Gemas.extrasDaGemaPoe(estado, null, comum).nivel, 1);
});

test('"Inimigos próximos são enervados": o Inervado (10% mais dano de Magias) nos de perto', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.equipment = { ...e.equipment, ring: anel({ 'aura_proximos:inervado': 1 }) };
  const perto = { uid: 'p', hp: 100, maxHp: 100, x: 1, y: 0 };
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [perto] };
  Ficha.invalidar(e);
  ModsPoe.aurasProximas(e, e.hunt, Ficha.combate(e), 1000);
  assert.ok(perto.estados?.inervado?.ate > 1000);
});
