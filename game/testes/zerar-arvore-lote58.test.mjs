// LOTE 58 — a FÉ MILITANTE (a Atemporal dos Templários): "[Two random mods of devotion]" vira 2 das 16 linhas de devoção do poedb
// (`linhas-sorteadas.json`), "<efeito> por cada 10 de Devoção" — a escala `devocao:N` (a Devoção total da ficha).
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
const T = await import('../systems/itens-poe/traduzir.mjs');
const { modificadoresDoUnico } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const anel = (af) => ({ id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id), count: 1, af: [], poe: { af } });
const semente = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test('a FÉ MILITANTE: as 16 linhas de devoção do pool; a peça sai com 2, distintas', { skip: SEM }, () => {
  const u = Catalogo.catalogo().classes.Jewels.unicos.find((x) => x.slug === 'Militant_Faith');
  assert.equal(u.linhasSorteadas.linhas.length, 16);
  for (const l of u.linhasSorteadas.linhas) {
    const t = tr(l.modelo, l.faixas.map((f) => f[0]));
    assert.ok(t.estado !== 'registrado', l.modelo);
    if (t.estado === 'inerte') assert.match(t.partes[0].nota, /^não se aplica ao jogo/);
  }
  for (let s = 1; s <= 10; s++) {
    const sorteadas = modificadoresDoUnico(u, semente(s)).filter((m) => m.sorteada);
    assert.equal(sorteadas.length, 2);
    assert.notEqual(sorteadas[0].modelo, sorteadas[1].modelo);
  }
});

test('"POR CADA 10 DE DEVOÇÃO": a escala da Devoção total — 25 de Devoção dão 2 vezes', { skip: SEM }, () => {
  // (o efeito de sempre, com a escala: o Dano Elemental vira os três elementos)
  assert.deepEqual(tr('Dano Elemental aumentado em {0}% por cada {1} de Devoção', [4, 10]).efeitos, tr('Dano Elemental aumentado em {0}%', [4]).efeitos.map((x) => ({ ...x, stat: `${x.stat}%devocao:10` })));
  assert.deepEqual(tr('Habilidades Canalizadas causam Dano aumentado em {0}% por cada {1} de Devoção', [4, 10]).efeitos, [{ stat: 'dmg_inc%devocao:10@canalizar', valor: 4 }]);
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.equipment = { ...e.equipment, ring: anel({ devocao: 25, 'mana_regen%devocao:10': 0.6 }) };
  Ficha.invalidar(e);
  const com = Ficha.combate(e).afPoe.mana_regen ?? 0;
  e.equipment.ring = anel({ devocao: 25 });
  Ficha.invalidar(e);
  const sem = Ficha.combate(e).afPoe.mana_regen ?? 0;
  assert.ok(Math.abs(com - sem - 1.2) < 1e-9, `${com} − ${sem}`);
});
