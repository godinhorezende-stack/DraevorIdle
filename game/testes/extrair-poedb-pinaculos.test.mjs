// O extrator dos chefes pináculo do poedb (tools/extrair-poedb-pinaculos.mjs) — com HTML SINTÉTICO no formato da página (o conteúdo
// do poedb fica só na referência local, fora do git).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chefesDaLista, lerChefe } from '../tools/extrair-poedb-pinaculos.mjs';

const LISTA = `<div id="PinnacleAtlasBossMonster" class="tab-pane fade show active"><table><tr><th>Name</th></tr>
<tr><td><a data-hover="x" href="/us/The_Boss">The Boss</a></td><td></td></tr>
<tr><td><a data-hover="y" href="/us/Sirus%2C_Awakener">Sirus, Awakener</a></td><td></td></tr></table></div>
<div id="Outra" class="tab-pane fade"></div>`;

const CHEFE = `<div id="TheBossUnique" class="tab-pane fade show active"><div class="row"><div class="col"><div class="d-flex"><a href="Anel"><img src="https://cdn.x/Art/2DItems/Rings/Anel.webp" /></a>
<div><a class="UniqueItem" href="/us/Anel_Do_Teste"><span class="uniqueName">Anel do Teste</span> <span class="uniqueTypeLine">Gold Ring</span></a></div>
<div class="requirements">Requires Level <span class="colourDefault">68</span>, 100 Str</div>
<div class="implicitMod"><span class='mod-value'>(6<span class="ndash">—</span>15)</span>% increased Rarity of Items found</div><div class="separator"></div>
<div class="explicitMod"><span class='mod-value'>+(40<span class="ndash">—</span>60)</span>% to Fire Resistance</div>
<div class="explicitMod"><span class="item_description">(nota do item)</span></div></div></div></div></div>
<div id="TheBossTheBoss" class="tab-pane fade"><div class="newItemPopup"><span class="lc">The Boss</span><div class="implicitMod">Pinnacle Atlas Boss</div><div class="implicitMod"><span class="secondary">monster dropped item rarity +% [15000]</span><br><span class="secondary">monster no drops or experience [1]</span></div></div>
<span data-tabname="The Boss <small>TheBoss</small>" data-category="MonsterVarieties"></span><table class='table'><tr><th>Area<td><a href="/us/Arena">Arena</a><tr><th>Tags<td>Caster, <i>human</i></table>
<div class="col"><div class="border p-2 d-flex justify-content-between"><div><i class="fas fa-shield-alt"></i>Life</div><div>1755%</div></div></div>
<div class="col"><div class="border p-2 d-flex justify-content-between"><div><i class="fas fa-shield-alt"></i>Resistance</div><div><span><img src="https://cdn.x/IconEnemyResistanceFireStrong.webp" alt="a" height="24" /><span class="enemyStrong">50</span>%</span> <span><img src="https://cdn.x/IconEnemyResistanceChaos.webp" alt="b" height="24" />30%</span></div></div></div></div>`;

test('a lista de chefes pináculo sai da aba certa, com o link decodificado', () => {
  assert.deepEqual(chefesDaLista(LISTA), [{ pagina: 'The_Boss', nome: 'The Boss' }, { pagina: 'Sirus,_Awakener', nome: 'Sirus, Awakener' }]);
});

test('o chefe: Únicos exclusivos (implícito × explícito, requisitos, nota) e variantes (vida, resistências, parâmetros do drop)', () => {
  const { unicos, variantes } = lerChefe(CHEFE);
  assert.equal(unicos.length, 1);
  const u = unicos[0];
  assert.deepEqual([u.slug, u.nome, u.base, u.requisitos.nivel, u.requisitos.forca], ['Anel_Do_Teste', 'Anel do Teste', 'Gold Ring', 68, 100]);
  assert.deepEqual(u.implicitos, ['(6—15)% increased Rarity of Items found']);
  assert.deepEqual(u.explicitos, ['+(40—60)% to Fire Resistance']);
  assert.deepEqual(u.notas, ['(nota do item)']);
  assert.equal(variantes.length, 1);
  const v = variantes[0];
  assert.deepEqual([v.id, v.nome, v.area, v.atributos.Life], ['TheBoss', 'The Boss', 'Arena', '1755%']);
  assert.deepEqual(v.tags, ['Caster', 'human']);
  assert.deepEqual(v.resistencias, { fire: 50, chaos: 30 });
  assert.deepEqual(v.drop, { raridadePct: 15000, quantidadePct: null, semDrop: true });
});
