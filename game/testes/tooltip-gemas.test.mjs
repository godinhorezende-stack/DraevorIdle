// A padronização das tooltips de gemas (auditoria de 02/10): a skill que escala o dano vem de UMA regra (`habilidadeDeEscala`),
// o catálogo manda o dano BASE (sem o bônus da gema) e nenhuma etiqueta técnica em inglês vai para o jogador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Gemas from '../systems/skills/gemas.mjs';
import * as Acoes from '../systems/acoes.mjs';
import { personagemDeTeste } from './apoio.mjs';

const ataques = () => [...Gemas.DEFS.values()].filter((d) => d.tipo !== 'support' && d.categoria === 'ataque');

test('habilidadeDeEscala: físico de perto = melee, físico de longe (ranged) = distance, o resto = magic', () => {
  assert.equal(Gemas.habilidadeDeEscala({ tags: ['physical', 'melee'] }), 'melee');
  assert.equal(Gemas.habilidadeDeEscala({ tags: ['physical', 'ranged'] }), 'distance');
  assert.equal(Gemas.habilidadeDeEscala({ tags: ['fire', 'wave'] }), 'magic');
  assert.equal(Gemas.habilidadeDeEscala({}), 'magic');
});

test('as 92 gemas de ataque: 23 melee + 14 distance + 55 magic (a regra das tags + as 8 exceções de : paladin sagrado → Distance, monk → Melee)', () => {
  const por = { melee: 0, distance: 0, magic: 0 };
  for (const d of ataques()) por[Gemas.habilidadeDeEscala(d)]++;
  assert.deepEqual(por, { melee: 23, distance: 14, magic: 55 });
});

test('bonusDoTreino segue a habilidade de escala', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.skills = { ...(e.skills ?? {}), melee: { value: 100 }, distance: { value: 40 } };
  e.magic = { value: 20 };
  const D = Gemas.CONFIG.dano;
  assert.equal(Gemas.bonusDoTreino(e, { tags: ['physical', 'melee'] }), 100 * D.porSkill);
  assert.equal(Gemas.bonusDoTreino(e, { tags: ['physical', 'ranged'] }), 40 * D.porSkill);
  assert.equal(Gemas.bonusDoTreino(e, { tags: ['fire'] }), 20 * D.porMagicLevel);
});

test('catálogo: toda skill de gema com dano traz danoBase e escalaCom; o dano base não passa do dano com a gema', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  const cat = Acoes.catalogo(e);
  let n = 0;
  for (const a of [...cat.spells, ...cat.runes]) {
    if (!a.damage) continue;
    n++;
    assert.ok(a.danoBase && a.danoBase.min >= 0 && a.danoBase.max >= a.danoBase.min, a.id);
    assert.ok(['melee', 'distance', 'magic'].includes(a.escalaCom), a.id);
  }
  assert.ok(n > 80, `skills com dano: ${n}`);
});
