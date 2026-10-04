// Atributos-base da arma (estilo Path of Exile adaptado): `engine/arma.mjs` (conta central), qualidade 0–20%, modificadores locais × globais, APS, crítico, DPS físico, requisitos,
// integração com a ficha/engine, tooltip e editor. Defaults = combate de antes (regressão).
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'arma-'));
process.env.DRAEVOR_OVERRIDES = tmp;
process.env.ENGINE_ITEM_POWER_HISTORICO = join(tmp, 'h.jsonl');
after(() => rmSync(tmp, { recursive: true, force: true }));

const A = await import('../engine/arma.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Req = await import('../systems/personagem/requisitos.mjs');
const O = await import('../systems/overrides.mjs');
const Poder = await import('../systems/armas/poder.mjs');
const Item = await import('../systems/itens/item.mjs');
const Gerar = await import('../systems/itens/gerar.mjs');
const IP = await import('../systems/item-power.mjs');
const Ed = await import('../admin/item-power-editor.mjs');
const Itens = await import('../admin/overrides-itens.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { criarEstrategias } = await import('../systems/hot-reload-estrategias.mjs');

const ESPADA = 7383; // relic sword: attack 42, nível 50, sem APS próprio
const estrategia = () => criarEstrategias({ overrides: tmp, atos: join(tmp, 'atos') }).itens;
beforeEach(async () => { if (existsSync(join(tmp, 'itens.json'))) rmSync(join(tmp, 'itens.json')); await estrategia().aplicar(); });
const estado = (vocation, level, equipment, extra = {}) => { const e = { level, xp: 0, vocation, hp: 1, maxHp: 1, mana: 1, maxMana: 1, equipment, inventory: [], ...extra }; try { Afixos.sincronizarMaximos(e); } catch { /* ok */ } Ficha.invalidar(e); return e; };
const peca = (id, extra = {}) => ({ id, count: 1, ...extra });
const BASE = A.baseDaArma({ slot: 'weapon', type: 'claw weapons', attackMin: 30, attackMax: 50, aps: 1.2, critChance: 500, range: 1, minLevel: 70, reqDex: 113, reqInt: 113 });
const perto = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} ≈ ${b}`);

test('AB1. base da arma: dano mín./máx., APS, crítico, alcance, tipo, nível e requisitos, só da base; sem faixa própria vale o attack único e o APS de hoje (0,5)', () => {
  assert.deepEqual([BASE.danoMin, BASE.danoMax, BASE.aps, BASE.critChance, BASE.alcance, BASE.nivel, BASE.tipo], [30, 50, 1.2, 500, 1, 70, 'claw weapons']);
  assert.deepEqual(BASE.requisitos, { str: null, dex: 113, int: 113 });
  const antiga = A.baseDaArma(ITEM_CATALOG[ESPADA]);
  assert.deepEqual([antiga.danoMin, antiga.danoMax, antiga.aps, antiga.temFaixa], [42, 42, 0.5, false], 'attack único; APS = o 1 golpe a cada 2 s de hoje');
  assert.equal(A.baseDaArma(ITEM_CATALOG[3434]), null, 'escudo não é arma'); assert.equal(A.baseDaArma(null), null);
  assert.deepEqual(A.baseDaArma(ITEM_CATALOG[ESPADA], [30, 55]).danoMin, 30, 'a faixa que a peça sorteou substitui o dano do catálogo');
});

test('AB2. qualidade 0%, 10% e 20%: dano mín./máx. e APS × (1 + q/100); crítico, alcance e requisitos NÃO mudam; passa de 20% é limitado; nunca negativa', () => {
  const s0 = A.statsDaArma(BASE); const s10 = A.statsDaArma(BASE, { qualidade: 10 }); const s20 = A.statsDaArma(BASE, { qualidade: 20 });
  assert.deepEqual([s0.danoMin, s0.danoMax, s0.apsFinal], [30, 50, 1.2]);
  perto(s10.danoMin, 33); perto(s10.danoMax, 55); perto(s10.apsFinal, 1.32);
  perto(s20.danoMin, 36); perto(s20.danoMax, 60); perto(s20.apsFinal, 1.44);
  for (const s of [s10, s20]) { assert.equal(s.critChance.final, 500, 'qualidade não altera o crítico'); assert.equal(s.alcance, 1); assert.deepEqual(s.requisitos, BASE.requisitos); assert.equal(s.nivel, 70); }
  assert.equal(A.statsDaArma(BASE, { qualidade: 35 }).qualidade, 20); assert.equal(A.statsDaArma(BASE, { qualidade: -5 }).qualidade, 0); assert.equal(A.statsDaArma(BASE, { qualidade: 'x' }).qualidade, 0);
  perto(s20.ganhoDaQualidade.danoMin, 6); perto(s20.ganhoDaQualidade.aps, 0.24);
});

test('AB3. DPS físico = dano médio × APS final; sem arredondar na conta (só na apresentação); distinto do dano médio por ataque', () => {
  const s = A.statsDaArma(BASE, { qualidade: 20 });
  perto(s.danoMedio, 48); perto(s.dpsFisico, 48 * 1.44); perto(s.dpsFisico, ((s.danoMin + s.danoMax) / 2) * s.apsFinal);
  const impar = A.statsDaArma(A.baseDaArma({ slot: 'weapon', attackMin: 7, attackMax: 11, aps: 1.13 }), { qualidade: 7 });
  assert.notEqual(impar.danoMin, Math.round(impar.danoMin), 'valor interno com precisão total');
  assert.equal(A.formatarDano(impar.danoMin), String(Math.round(impar.danoMin * 10) / 10).replace('.', ','));
  assert.equal(A.formatarAps(1.4400000001), '1,44'); assert.equal(A.formatarCritico(750), '7,5%'); assert.equal(A.formatarDano(null), '—');
});

test('AB4. ordem do dano: base → + adicional LOCAL → × % local → × qualidade (cada etapa visível); interação qualidade × adicional e × % de velocidade local', () => {
  const s = A.statsDaArma(BASE, { qualidade: 10, locais: { addMin: 5, addMax: 9, pctDano: 10, pctVelocidade: 20, pctCritico: 50 } });
  assert.deepEqual(s.dano.base, [30, 50]); assert.deepEqual(s.dano.aposAdicional, [35, 59]);
  perto(s.dano.aposPercentual[0], 38.5); perto(s.dano.aposPercentual[1], 64.9);
  perto(s.danoMin, 35 * 1.1 * 1.1); perto(s.danoMax, 59 * 1.1 * 1.1, 1e-9);
  perto(s.aps.aposLocal, 1.44); perto(s.apsFinal, 1.2 * 1.2 * 1.1);
  perto(s.critChance.final, 750); assert.equal(s.critChance.base, 500, 'crítico local mexe no crítico da arma; qualidade não');
  assert.ok(s.danoMin > A.statsDaArma(BASE, { qualidade: 10 }).danoMin, 'o adicional local entra ANTES da qualidade, que o multiplica');
  perto(A.statsDaArma(BASE, { qualidade: 20, locais: { addMin: 10, addMax: 10 } }).danoMin, 40 * 1.2);
  const neg = A.statsDaArma(BASE, { locais: { pctDano: -200, pctVelocidade: -50 } });
  assert.equal(neg.danoMin, 0, 'percentual local nunca deixa o dano negativo'); perto(neg.apsFinal, 0.6);
  assert.deepEqual(A.locaisValidos({ addMin: -3, addMax: 'x', pctDano: 'y' }), { addMin: 0, addMax: 0, pctDano: 0, pctVelocidade: 0, pctCritico: 0 });
});

test('AB5. velocidade: APS da arma (base × % local × qualidade) → depois os aumentos GLOBAIS e multiplicadores extras; 1000/APS é o intervalo', () => {
  const s = A.statsDaArma(BASE, { qualidade: 20 });
  perto(A.aplicarVelocidadeGlobal(s.apsFinal, 25), 1.44 * 1.25); perto(A.aplicarVelocidadeGlobal(s.apsFinal, 0, 1.1), 1.44 * 1.1); perto(A.aplicarVelocidadeGlobal(s.apsFinal, -150), 0);
  perto(A.intervaloDoAps(2), 500); assert.equal(A.intervaloDoAps(0), null); perto(s.aps.intervaloMs, 1000 / 1.44);
});

test('AB6. validação da base: limites do APS (0,1–5), mín. ≤ máx., inteiros, e campos de arma só em arma', () => {
  assert.deepEqual(A.validarBaseDaArma({ attackMin: 10, attackMax: 20, aps: 1.1, critChance: 500, range: 1, reqStr: 10 }), []);
  assert.match(A.validarBaseDaArma({ aps: 0 }).join(' '), /aps precisa ser um número de 0.1 a 5/);
  assert.match(A.validarBaseDaArma({ aps: 9 }).join(' '), /aps/);
  assert.match(A.validarBaseDaArma({ attackMin: 30, attackMax: 10 }).join(' '), /attackMin não pode ser maior/);
  assert.match(A.validarBaseDaArma({ attackMin: -1 }).join(' '), /attackMin precisa ser um inteiro/);
  assert.match(A.validarBaseDaArma({ reqStr: 1.5 }).join(' '), /reqStr/);
  assert.match(O.validarItem(3434, { aps: 1 }, { original: ITEM_CATALOG[3434] }).erros.join(' '), /só valem para armas/);
  assert.deepEqual(O.validarItem(ESPADA, { attackMin: 40, attackMax: 60, aps: 0.8, critChance: 300, range: 1, reqStr: 20 }, { original: ITEM_CATALOG[ESPADA] }).erros, []);
  assert.deepEqual(O.CAMPOS_DE_ARMA, ['attackMin', 'attackMax', 'aps', 'critChance', 'range', 'reqStr', 'reqDex', 'reqInt']);
});

test('AB7. REGRESSÃO: sem qualidade nem locais a ficha é IDÊNTICA à de antes (dano 24–46 da relic sword, intervalo 2 s) e `ficha.arma` descreve a arma; sem arma, `arma` é null', () => {
  const f = Ficha.combate(estado('knight', 50, { weapon: peca(ESPADA) }));
  assert.deepEqual([f.ataqueMin, f.ataqueMax, f.damage.min, f.damage.max], [42, 42, 24, 46]);
  assert.equal(f.intervaloDoGolpeMs, Math.round(2000 / (1 + f.efeitosDosAtributos.velocidadeDeAtaquePct / 100)), 'intervalo = 2 s com a velocidade global (DEX), como sempre');
  assert.equal(f.arma.qualidade, 0); assert.deepEqual([f.arma.danoMin, f.arma.apsFinal], [42, 0.5]); perto(f.arma.dpsFisico, 21);
  const sem = Ficha.combate(estado('knight', 50, {}));
  assert.equal(sem.arma, null); assert.equal(sem.intervaloDoGolpeMs, Math.round(2000 / (1 + sem.efeitosDosAtributos.velocidadeDeAtaquePct / 100)), 'desequipada: o intervalo base de sempre');
  const sword14 = Ficha.combate(estado('knight', 8, { weapon: peca(3264) })); assert.deepEqual([sword14.damage.min, sword14.damage.max], [6, 13]);
});

test('AB8. qualidade na ENGINE: dano da ficha e intervalo usam o valor final UMA vez (não duplica); equipar/desequipar; troca de arma não herda a qualidade', () => {
  const base = Ficha.combate(estado('knight', 50, { weapon: peca(ESPADA) }));
  const q20 = Ficha.combate(estado('knight', 50, { weapon: peca(ESPADA, { qualidade: 20 }) }));
  assert.equal(q20.ataqueMin, Math.round(42 * 1.2)); assert.equal(q20.ataqueMax, Math.round(42 * 1.2)); // 50
  assert.equal(q20.intervaloDoGolpeMs, Math.round(1000 / (0.5 * 1.2) / (1 + q20.efeitosDosAtributos.velocidadeDeAtaquePct / 100)));
  const manual = Math.max(1, Math.floor(50.4 * 0.0425 * 14 * (1 - 0.3) + 10 * 0 + 10 * 0)); void manual;
  assert.ok(q20.damage.max > base.damage.max && q20.damage.min > base.damage.min);
  const mult = 0.0425 * (10 + 4);
  const mediaEsperada = Math.round(42 * 1.2) * mult + 50 / 5;
  assert.equal(q20.damage.min, Math.max(1, Math.floor(mediaEsperada * 0.7))); assert.equal(q20.damage.max, Math.ceil(mediaEsperada * 1.3));
  assert.notEqual(q20.damage.max, Math.ceil((Math.round(42 * 1.2 * 1.2)) * mult * 1.3), 'a qualidade NÃO foi aplicada duas vezes');
  const duas = Ficha.combate(estado('knight', 50, { weapon: peca(ESPADA, { qualidade: 20 }) })); assert.deepEqual(duas.damage, q20.damage);
  const trocada = Ficha.combate(estado('knight', 50, { weapon: peca(3278) })); assert.equal(trocada.arma.qualidade, 0);
  const desequipada = Ficha.combate(estado('knight', 50, { weapon: null })); assert.equal(desequipada.arma, null);
});

test('AB9. APS próprio da base (override) vira o intervalo da engine (1000/APS), com os aumentos globais DEPOIS e o limite do projeto preservado', async () => {
  writeFileSync(join(tmp, 'itens.json'), JSON.stringify({ ativo: true, itens: { [ESPADA]: { aps: 1.0, critChance: 500, attackMin: 30, attackMax: 50 } } }));
  await estrategia().aplicar();
  const e = estado('knight', 50, { weapon: peca(ESPADA) }); const f = Ficha.combate(e);
  const dexPct = f.efeitosDosAtributos.velocidadeDeAtaquePct;
  assert.equal(f.intervaloDoGolpeMs, Math.round(1000 / (1 + dexPct / 100)), 'APS 1,0 → 1000 ms, e a DEX (global) entra depois');
  assert.equal(f.arma.apsFinal, 1); assert.deepEqual([f.arma.danoMin, f.arma.danoMax], [30, 50]);
  assert.ok(f.critChance >= 0.03 + 0.05 - 1e-9, 'o crítico base da arma soma ao crítico do personagem');
  const q = Ficha.combate(estado('knight', 50, { weapon: peca(ESPADA, { qualidade: 20 }) }));
  assert.equal(q.intervaloDoGolpeMs, Math.round(1000 / 1.2 / (1 + dexPct / 100)));
  const comAdd = Ficha.combate(estado('knight', 50, { weapon: peca(ESPADA, { locais: { pctVelocidade: 50 } }) }));
  assert.equal(comAdd.intervaloDoGolpeMs, Math.round(1000 / 1.5 / (1 + dexPct / 100)));
});

test('AB10. modificadores LOCAIS alteram só os números da arma; os GLOBAIS (afixos de outras peças, phys_add) não entram na base nem recebem a qualidade; crítico local acrescenta, qualidade não', () => {
  const sem = Ficha.combate(estado('knight', 50, { weapon: peca(ESPADA) }));
  const loc = Ficha.combate(estado('knight', 50, { weapon: peca(ESPADA, { locais: { addMin: 10, addMax: 10, pctDano: 10 } }) }));
  assert.equal(loc.ataqueMin, Math.round((42 + 10) * 1.1)); assert.ok(loc.damage.max > sem.damage.max);
  const globalAdd = Ficha.combate(estado('knight', 50, { weapon: peca(ESPADA, { qualidade: 20 }), ring: peca(Object.values(ITEM_CATALOG).find((m) => m.slot === 'ring').id, { af: [{ id: 'phys_add', nivel: 1, value: 10 }] }) }));
  const soQ = Ficha.combate(estado('knight', 50, { weapon: peca(ESPADA, { qualidade: 20 }) }));
  perto(soQ.arma.danoMin, 42 * 1.2); // 50,4 (a conta interna não arredonda)
  assert.equal(globalAdd.arma.danoMin, soQ.arma.danoMin, 'o afixo global não entrou na base da arma');
  const crit = Ficha.combate(estado('knight', 50, { weapon: peca(ESPADA, { qualidade: 20 }) })); assert.equal(crit.critChance, sem.critChance, 'qualidade não muda o crítico');
});

test('AB11. wand/rod: a qualidade só mexe na VELOCIDADE (o dano é o Magic Attack); habilidades e gemas (poder da arma) não mudam com a qualidade', () => {
  const rod = Object.values(ITEM_CATALOG).find((m) => m.type === 'rods' && m.vocations?.includes('druid') && m.minLevel >= 20);
  const a = Ficha.combate(estado('druid', rod.minLevel, { weapon: peca(rod.id) })); const b = Ficha.combate(estado('druid', rod.minLevel, { weapon: peca(rod.id, { qualidade: 20 }) }));
  assert.deepEqual(a.damage, b.damage, 'dano da wand/rod = Magic Attack: a qualidade não o altera');
  assert.ok(b.intervaloDoGolpeMs < a.intervaloDoGolpeMs, 'mas a velocidade sim');
  const pa = Poder.poderEfetivo(estado('druid', 30, { weapon: peca(rod.id) }), 'magic', 'earth'); const pb = Poder.poderEfetivo(estado('druid', 30, { weapon: peca(rod.id, { qualidade: 20 }) }), 'magic', 'earth');
  assert.equal(pa.poder, pb.poder, 'o poder da arma que escala as gemas/habilidades ignora a qualidade');
  const sp = Poder.poderEfetivo(estado('knight', 50, { weapon: peca(ESPADA, { qualidade: 20 }) }), 'melee'); assert.equal(sp.poder, Poder.poderEfetivo(estado('knight', 50, { weapon: peca(ESPADA) }), 'melee').poder);
});

test('AB12. REGRESSÃO das defesas: Armour, Evasion, Energy Shield, Block e escudo NÃO são afetados por qualidade nem locais da arma', () => {
  const equip = { weapon: peca(ESPADA), shield: peca(3434), body: peca(10384) };
  const a = Ficha.combate(estado('knight', 60, equip)); const b = Ficha.combate(estado('knight', 60, { ...equip, weapon: peca(ESPADA, { qualidade: 20, locais: { addMin: 5, pctDano: 20, pctVelocidade: 20 } }) }));
  for (const k of ['armor', 'evasion', 'energyShield', 'blockChance', 'blockChanceMin', 'blockChanceMax', 'defense', 'protection', 'maxHp']) assert.deepEqual(b[k], a[k], k);
});

test('AB13. persistência: qualidade e locais vivem na peça e sobrevivem a salvar/recarregar (JSON); a migração de peças não os remove', () => {
  const original = peca(ESPADA, { qualidade: 17, locais: { addMin: 3, addMax: 6, pctDano: 12 }, af: [], base: { attack: [40, 48] } });
  const recarregada = JSON.parse(JSON.stringify({ equipment: { weapon: original } })).equipment.weapon;
  assert.deepEqual(recarregada, original);
  const e = estado('knight', 50, { weapon: recarregada }); const antes = Ficha.combate(e).arma;
  Item.migrarPecas?.({ equipment: { weapon: recarregada } });
  assert.equal(recarregada.qualidade, 17);
  Ficha.invalidar(e); assert.deepEqual(Ficha.combate(e).arma.locais, antes.locais);
  assert.deepEqual(Ficha.combate(estado('knight', 50, { weapon: original })).arma.dano.base, [40, 48], 'a faixa sorteada no drop é a base');
});

test('AB14. faixa própria no catálogo/drop: attackMin/attackMax viram a base (faixaDoCampo) e o sorteio do drop parte deles; o Item Power lê a faixa', async () => {
  writeFileSync(join(tmp, 'itens.json'), JSON.stringify({ ativo: true, itens: { [ESPADA]: { attackMin: 20, attackMax: 60 } } }));
  await estrategia().aplicar();
  assert.deepEqual(Item.faixaDoCampo({ id: ESPADA }, 'attack'), [20, 60]);
  const f = Ficha.combate(estado('knight', 50, { weapon: peca(ESPADA) })); assert.deepEqual([f.ataqueMin, f.ataqueMax], [20, 60]);
  const base = Gerar.rolarBase(ESPADA, 'comum', () => 0.5);
  assert.ok(base.attack[0] <= base.attack[1] && base.attack[1] <= 60 && base.attack[0] >= 1);
  const a = IP.atributosDoMeta(ITEM_CATALOG[ESPADA]); assert.deepEqual([a.damageMin, a.damageMax], [20, 60]);
  assert.equal(IP.fichaDePoder(ESPADA, IP.EM_USO).atributos.damage, 40, 'Item Power: média de mín. e máx. reais');
});

test('AB15. requisitos de atributo (STR/DEX/INT): explícitos valem como no PoE (TODOS), integram ao equipar e ao tooltip; sem eles, a regra derivada de sempre', async () => {
  const derivado = Req.requisitoDe(ITEM_CATALOG[ESPADA]); assert.equal(derivado?.todos, undefined);
  writeFileSync(join(tmp, 'itens.json'), JSON.stringify({ ativo: true, itens: { [ESPADA]: { reqDex: 113, reqInt: 113 } } }));
  await estrategia().aplicar();
  const r = ITEM_CATALOG[ESPADA].requisito; assert.deepEqual([r.todos, r.porAtributo], [true, { dex: 113, int: 113 }]);
  assert.match(Req.falta(ITEM_CATALOG[ESPADA], { dex: 200, int: 50 }), /Requer 113 DEX, 113 INT/); assert.equal(Req.falta(ITEM_CATALOG[ESPADA], { dex: 113, int: 113 }), null);
  rmSync(join(tmp, 'itens.json')); await estrategia().aplicar();
  assert.equal(ITEM_CATALOG[ESPADA].requisito?.todos, undefined, 'sem override volta o requisito derivado');
});

test('AB16. editor de itens: bloco da arma = base original × editada, qualidade/locais da prévia, valores finais por etapa e o golpe básico REAL da ficha — mesma conta da engine', () => {
  const ov = { attackMin: 30, attackMax: 50, aps: 1.2, critChance: 500, reqDex: 113 };
  const p = Ed.poderDoOverride(ESPADA, ov, undefined, { qualidade: 20, locais: { addMin: 5, addMax: 5 } });
  assert.equal(p.ok, true); const a = p.arma;
  assert.deepEqual(a.base.original && [a.base.original.danoMin, a.base.original.aps], [42, 0.5]); assert.deepEqual([a.base.editada.danoMin, a.base.editada.aps], [30, 1.2]);
  perto(a.final.danoMin, 35 * 1.2); perto(a.final.apsFinal, 1.44); perto(a.final.dpsFisico, ((35 * 1.2 + 55 * 1.2) / 2) * 1.44);
  const e = estado('knight', 50, { weapon: peca(ESPADA, { qualidade: 20, locais: { addMin: 5, addMax: 5 } }) });
  const real = (() => { const g = ITEM_CATALOG[ESPADA]; ITEM_CATALOG[ESPADA] = { ...g, attackMin: 30, attackMax: 50, aps: 1.2, critChance: 500, reqDex: 113 }; try { Ficha.invalidar(e); return Ficha.combate(e); } finally { ITEM_CATALOG[ESPADA] = g; } })();
  assert.equal(a.golpeBasicoReal.danoMin, real.damage.min); assert.equal(a.golpeBasicoReal.danoMax, real.damage.max); assert.equal(a.golpeBasicoReal.intervaloMs, real.intervaloDoGolpeMs);
  assert.match(a.rotulos.final, /NÃO é o dano de habilidade/); assert.match(a.rotulos.real, /sem habilidades/);
  assert.equal(ITEM_CATALOG[ESPADA].aps, undefined, 'a prévia não alterou o catálogo');
  assert.equal(Ed.poderDoOverride(3434, {}).arma, null, 'escudo: sem bloco de arma');
  assert.match(Ed.poderDoOverride(ESPADA, { aps: 9 }).erros.join(' '), /aps/);
  assert.equal(Ed.poderDoOverride(ESPADA, {}, undefined, { qualidade: 99 }).arma.final.qualidade, 20);
  assert.match(Ed.poderDoOverride(3065, {}).arma.nota ?? '', /Magic Attack/);
});

test('AB17. tooltip: o balão da arma usa a conta central (Qualidade, Dano Físico, Ataques por Segundo, Crítico, DPS Físico) e mostra a influência dos locais; requisitos TODOS no balão e no cheque do cliente', () => {
  const t = readFileSync(new URL('../frontend/client/src/tooltip.mjs', import.meta.url), 'utf8');
  assert.match(t, /import \* as Arma from '\/packages\/shared\/src\/arma\.mjs'/);
  for (const r of ["'Qualidade'", "'Dano Físico'", "'Ataques por Segundo'", "'Chance de Crítico'", "'DPS Físico'", 'Arma.statsDaArma(baseDaArma, { qualidade: peca?.qualidade, locais: peca?.locais })', 'meta.requisito.todos', 'req.todos']) assert.ok(t.includes(r), r);
  assert.match(t, /× qualidade \(uma vez\)/); assert.match(t, /Não é o dano de uma habilidade/);
  assert.equal(readFileSync(new URL('../engine/arma.mjs', import.meta.url), 'utf8').includes('import '), false, 'a conta é pura: nenhum import (serve ao servidor e ao cliente)');
});

test('AB18. nenhuma mudança de combate escondida: itens sem os novos campos dão o MESMO dano/intervalo/crítico que a conta antiga para todas as armas do catálogo', () => {
  let n = 0;
  for (const m of Object.values(ITEM_CATALOG)) {
    if (m.slot !== 'weapon' || m.wand || !(m.attack > 0)) continue;
    const f = Ficha.combate(estado('knight', Math.max(1, m.minLevel ?? 1), { weapon: peca(m.id) }));
    const mult = 0.0425 * (f.skillValue + 4); const media = m.attack * mult + Math.floor(Math.max(1, m.minLevel ?? 1) / 5) * 1; // level/5 sem piso na fórmula
    assert.equal(f.intervaloDoGolpeMs, Math.round(2000 / (1 + f.efeitosDosAtributos.velocidadeDeAtaquePct / 100)), `intervalo ${m.name}`);
    assert.equal(f.arma.qualidade, 0); assert.equal(f.arma.apsFinal, 0.5);
    assert.ok(f.damage.max >= f.damage.min); void media; n++;
    if (n > 150) break;
  }
  assert.ok(n > 50);
});
