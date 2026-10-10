// Os MAPAS do endgame no DRAEVOR CLÁSSICO (DRAEVOR_CLASSICO=1, a transição): eles são só do jogo oficial — o clássico não ganha classe de
// mapa, hunt de mapa, dispositivo nem a aba na tela. Sai junto com o modo clássico.
import './apoio-classico.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const Dispositivo = await import('../systems/mapas-dispositivo.mjs');
const MapasAreas = await import('../systems/itens-poe/mapas-areas.mjs');
const Mapas = await import('../systems/itens-poe/mapas.mjs');
const { CATALOGO, ITEM_CATALOG } = await import('../systems/dados.mjs');

test('no clássico não há mapas: nem a classe, nem as hunts, nem o dispositivo (e a tela não recebe a aba)', () => {
  assert.equal(Catalogo.ligado(), false);
  assert.equal(Catalogo.catalogo(), null, 'sem o catálogo do PoE (onde a classe dos mapas entra)');
  assert.deepEqual(MapasAreas.iniciar(), { tiers: 0, problemas: [] });
  assert.ok(!CATALOGO.hunts.some((h) => h.poeMapa), 'nenhuma hunt de mapa');
  assert.ok(!ITEM_CATALOG[7_700_001], 'nenhum item de mapa');
  assert.equal(Dispositivo.paraTela({}), null, 'a campanha vai sem `mapas`');
  assert.equal(Dispositivo.liberado({ campanha: {} }), false);
  assert.match(Dispositivo.abrir({ inventory: [] }, {}).erro, /jogo oficial/);
  assert.equal(Mapas.addsNoJogador({ hunt: { mapa: { efeitos: { jogador: { fire_res_max: -10 } } } } }).fire_res_max, -10, 'o efeito só existe com um mapa (que o clássico nunca abre)');
});
