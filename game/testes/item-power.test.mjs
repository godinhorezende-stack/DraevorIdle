// Item Power Base: fórmula, normalização, curva, classificação, comparação, relatórios, overrides, Hot Reload, validação central, rotas e análises de distribuição (com o catálogo real).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'ipw-'));
process.env.DRAEVOR_OVERRIDES = tmp; // overrides DESTE processo ficam na pasta temporária (nunca os do dono)
after(() => rmSync(tmp, { recursive: true, force: true }));

const IP = await import('../systems/item-power.mjs');
const P = await import('../systems/progressao.mjs');
const Adm = await import('../admin/overrides-item-power.mjs');
const An = await import('../admin/item-power-analise.mjs');
const Http = await import('../admin/conteudo-http.mjs');
const A = await import('../admin/acesso.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { criarEstrategias } = await import('../systems/hot-reload-estrategias.mjs');
const { criarVerificacoes } = await import('../admin/validacao-verificacoes.mjs');

const copia = (o) => JSON.parse(JSON.stringify(o));
const cfg = () => copia(IP.EM_USO);
const reset = () => { if (existsSync(join(tmp, 'item-power.json'))) rmSync(join(tmp, 'item-power.json')); IP.aplicar(null); };
const equip = Object.values(ITEM_CATALOG).filter((m) => IP.SLOTS.includes(m.slot) && !m.stackable);
const espada = ITEM_CATALOG[7383]; // relic sword (level 50)
const armadura = ITEM_CATALOG[10384]; // Zaoan armor (level 50)
const escudo = ITEM_CATALOG[3434]; // vampire shield

test('IPW1. fórmula de fábrica: pesos 1 / 1,5 / 0,8 / 0,8 / 0,8, normalização neutra e a versão da fórmula — sem atributos que não existem', () => {
  const c = IP.EM_USO;
  assert.deepEqual(c.pesos, { damage: 1, block: 1.5, armour: 0.8, evasion: 0.8, energyShield: 0.8 });
  assert.deepEqual([c.normalizacao.damage, c.normalizacao.block, c.normalizacao.armour, c.normalizacao.evasion, c.normalizacao.energyShield], [1, 1, 1, 1, 1]);
  assert.equal(c.versaoDaFormula, 1);
  assert.deepEqual(IP.ATRIBUTOS, ['damage', 'block', 'armour', 'evasion', 'energyShield']);
  assert.deepEqual(IP.validarConfiguracao(c).erros, []);
});

test('IPW2. dano médio = (mín + máx) / 2; a soma é ponderada e cada atributo tem o seu detalhamento em pontos', () => {
  const c = cfg();
  const r = IP.calcular({ damageMin: 10, damageMax: 20, block: 10, armour: 5, evasion: 5, energyShield: 5 }, c);
  assert.equal(r.damage, 15);
  assert.equal(r.contribuicao.damage.pontos, 15);
  assert.equal(r.contribuicao.block.pontos, 15); // 10 × 1,5
  assert.equal(r.contribuicao.armour.pontos, 4); assert.equal(r.contribuicao.evasion.pontos, 4); assert.equal(r.contribuicao.energyShield.pontos, 4);
  assert.equal(r.ip, 15 + 15 + 4 + 4 + 4);
  c.pesos = { damage: 2, block: 0, armour: 1, evasion: 0, energyShield: 0 };
  assert.equal(IP.calcular({ damageMin: 10, damageMax: 20, block: 99, armour: 7 }, c).ip, 30 + 7, 'os pesos mandam; peso zero anula');
});

test('IPW3. normalização: o fator converte a unidade do atributo antes do peso; o Block do escudo vale cheio, o da arma metade, os outros slots nada', () => {
  const c = cfg();
  c.normalizacao.block = 0.5;
  assert.equal(IP.calcular({ block: 40 }, c).contribuicao.block.pontos, 40 * 0.5 * 1.5);
  c.normalizacao.block = 1;
  assert.equal(IP.blockDoItem(30, 'shield', c), 30);
  assert.equal(IP.blockDoItem(30, 'weapon', c), 15);
  assert.equal(IP.blockDoItem(30, 'body', c), 0);
  c.normalizacao.blockDaArma = 1;
  assert.equal(IP.blockDoItem(30, 'weapon', c), 30, 'a metade é configurável');
  const cajado = { wand: { min: 40, max: 60 } };
  assert.equal(IP.calcular({ cajado: cajado.wand }, cfg()).ip, 0, 'o dano do cajado legado não entra por padrão (a ficha do jogo não usa)');
  const c2 = cfg(); c2.normalizacao.danoDoCajado = 1;
  assert.equal(IP.calcular({ cajado: cajado.wand }, c2).ip, 50);
});

test('IPW4. itens sem atributos, com zeros ou com valores inválidos: IP 0 e nunca NaN; negativos são recusados na simulação', () => {
  const c = cfg();
  assert.equal(IP.calcular({}, c).ip, 0);
  assert.equal(IP.calcular({ damageMin: 0, damageMax: 0, armour: 0 }, c).ip, 0);
  assert.equal(IP.calcular({ damageMin: -5, damageMax: 'x', armour: NaN }, c).ip, 0, 'negativo/NaN contam 0 na conta');
  assert.match(IP.validarAtributos({ armour: -1 }).join(' '), /não pode ser negativo/);
  assert.match(IP.validarAtributos({ damageMin: 9, damageMax: 3 }).join(' '), /maior que damageMax/);
  assert.match(IP.validarAtributos({ evasion: 'abc' }).join(' '), /precisa ser um número/);
  assert.deepEqual(IP.validarAtributos({ damageMin: 1, damageMax: 2, armour: 0 }), []);
  assert.equal(IP.atributosBase(99999999), null);
  assert.equal(IP.atributosBase(3031), null, 'moeda não é equipamento');
  const ring = equip.find((m) => m.slot === 'ring');
  assert.equal(IP.fichaDePoder(ring.id, c).situacao === 'sem-poder' || IP.fichaDePoder(ring.id, c).ip >= 0, true);
});

test('IPW5. os atributos vêm do catálogo REAL pelo mesmo caminho da ficha (defesa dividida por tipo da base) e o catálogo original não é alterado', () => {
  const antes = JSON.stringify([espada, armadura, escudo]);
  const a = IP.atributosBase(7383);
  assert.deepEqual([a.damageMin, a.damageMax], [espada.attack, espada.attack], 'o catálogo guarda um valor só: mín = máx');
  const arm = IP.atributosBase(10384);
  assert.ok(arm.armour + arm.evasion + arm.energyShield > 0, 'a armadura rende alguma defesa por tipo');
  assert.equal(IP.atributosBase(3434).defesa, escudo.defense);
  const f = IP.fichaDePoder(3434, cfg());
  assert.equal(f.contribuicao.block.valor, escudo.defense);
  assert.equal(f.atributos.block, escudo.defense);
  const w = IP.fichaDePoder(7383, cfg());
  assert.equal(w.contribuicao.block.valor, espada.defense / 2, 'a arma conta a metade da defesa');
  assert.equal(w.contribuicao.damage.valor, espada.attack);
  IP.fichasDoCatalogo(cfg());
  assert.equal(JSON.stringify([espada, armadura, escudo]), antes, 'calcular não muda o catálogo');
});

test('IPW6. curva: interpolação linear entre pontos, valor das pontas fora do intervalo, categoria própria e padrão como reserva', () => {
  const pts = [{ level: 10, ip: 100 }, { level: 20, ip: 200 }, { level: 120, ip: 400 }];
  assert.equal(IP.esperadoNoLevel(pts, 15), 150);
  assert.equal(IP.esperadoNoLevel(pts, 70), 300);
  assert.equal(IP.esperadoNoLevel(pts, 1), 100); assert.equal(IP.esperadoNoLevel(pts, 999), 400);
  assert.equal(IP.esperadoNoLevel(pts, 20), 200);
  assert.equal(IP.esperadoNoLevel([], 5), null);
  const c = cfg();
  c.curva.categorias.body = [{ level: 1, ip: 10 }, { level: 11, ip: 20 }];
  assert.equal(IP.esperado(c, 'body', 6), 15, 'a categoria própria');
  delete c.curva.categorias.legs;
  assert.deepEqual(IP.pontosDaCurva(c, 'legs'), IP.pontosDaCurva(c, 'qualquer'), 'sem curva própria vale o padrão');
  const am = IP.amostrarCurva(c, 'body', { ate: 1000, passo: 100 });
  assert.equal(am[0].level, 1); assert.equal(am.at(-1).level, 1000);
  assert.equal(P.nivelMaximo(), 1000, 'a curva cobre 1 a 1000');
});

test('IPW7. a curva é INDEPENDENTE da fórmula: mudar os pesos não mexe nos pontos, e a progressão não é obrigatoriamente linear; saltos e quedas são detectados', () => {
  const c = cfg();
  const antes = JSON.stringify(c.curva);
  c.pesos.damage = 5;
  assert.equal(JSON.stringify(c.curva), antes);
  const irregular = [{ level: 1, ip: 10 }, { level: 100, ip: 20 }, { level: 200, ip: 30 }, { level: 300, ip: 40 }, { level: 400, ip: 500 }, { level: 500, ip: 20 }];
  const s = IP.saltosDaCurva(irregular, { saltoAbruptoFator: 3 });
  assert.deepEqual(s.map((x) => [x.tipo, x.de]), [['salto', 300], ['queda', 400]]);
  assert.deepEqual(IP.saltosDaCurva([{ level: 1, ip: 10 }, { level: 100, ip: 20 }, { level: 200, ip: 30 }]), []);
});

test('IPW8. classificação: abaixo / adequado / acima / muito acima pelos limites (configuráveis); sem level, sem poder e sem referência são situações à parte', () => {
  const c = cfg(); // -25% / +25% / +75%
  assert.deepEqual([-0.3, -0.25, 0, 0.25, 0.26, 0.75, 0.76].map((d) => IP.classeDaDiferenca(d, c)), ['abaixo', 'adequado', 'adequado', 'adequado', 'acima', 'acima', 'muito-acima']);
  c.classificacao = { abaixoDe: -0.1, acimaDe: 0.1, muitoAcimaDe: 0.2 };
  assert.equal(IP.classeDaDiferenca(0.15, c), 'acima'); assert.equal(IP.classeDaDiferenca(0.5, c), 'muito-acima');
  const f = IP.fichaDePoder(7383, cfg());
  assert.equal(f.minLevel, 50); assert.equal(f.levelRecomendado, 50);
  assert.equal(f.esperado, IP.esperado(cfg(), 'weapon', 50));
  assert.equal(f.diferenca, Math.round((f.ip - f.esperado) * 1000) / 1000);
  assert.equal(f.diferencaPct, Math.round(((f.ip - f.esperado) / f.esperado) * 10000) / 10000);
  assert.equal(f.situacao, IP.classeDaDiferenca(f.diferencaPct, cfg()));
  assert.ok(f.raridade && f.categoria && Array.isArray(f.vocations));
  const semLevel = equip.find((m) => !(m.minLevel > 0) && IP.fichaDePoder(m.id, cfg()).ip > 0);
  assert.equal(IP.fichaDePoder(semLevel.id, cfg()).situacao, 'sem-level');
  const anel = equip.find((m) => m.slot === 'ring' && IP.atributosBase(m.id) && IP.fichaDePoder(m.id, cfg()).ip === 0);
  assert.equal(IP.fichaDePoder(anel.id, cfg()).situacao, 'sem-poder');
});

test('IPW9. item acima/abaixo da curva: com o catálogo real, a classificação acompanha a curva (subir a curva rebaixa o item, descer a curva o promove)', () => {
  const base = IP.fichaDePoder(7383, cfg());
  const c = cfg();
  c.curva.categorias.weapon = c.curva.categorias.weapon.map((p) => ({ ...p, ip: p.ip * 3 }));
  assert.equal(IP.fichaDePoder(7383, c).situacao, 'abaixo');
  const c2 = cfg();
  c2.curva.categorias.weapon = c2.curva.categorias.weapon.map((p) => ({ ...p, ip: p.ip / 4 }));
  assert.equal(IP.fichaDePoder(7383, c2).situacao, 'muito-acima');
  assert.equal(IP.fichaDePoder(7383, cfg()).situacao, base.situacao);
  const todas = IP.fichasDoCatalogo(cfg(), { incluirCraft: false });
  assert.ok(todas.length > 1000 && todas.every((f) => f && IP.SLOTS.includes(f.slot) && Number.isFinite(f.ip)), 'todo equipamento cadastrado tem IP');
  const r = IP.resumoPorCategoria(todas);
  assert.equal(r.length, 8); assert.equal(r.reduce((n, x) => n + x.total, 0), todas.length);
});

test('IPW10. comparação: IP, atributos, diferença absoluta e % contra o primeiro, e o atributo que mais explica a diferença', () => {
  const r = IP.compararItens([3434, 7383, 10384], cfg());
  assert.equal(r.ok, true); assert.equal(r.itens.length, 3); assert.equal(r.referencia, 3434);
  const [ref, esp] = r.itens;
  assert.equal(ref.contraReferencia.diferenca, 0);
  assert.equal(esp.contraReferencia.diferenca, Math.round((esp.ip - ref.ip) * 1000) / 1000);
  assert.equal(esp.contraReferencia.diferencaPct, Math.round(((esp.ip - ref.ip) / ref.ip) * 10000) / 10000);
  assert.equal(esp.contraReferencia.maiorContribuinte, 'damage', 'a espada se diferencia do escudo pelo dano');
  assert.equal(r.itens[2].contraReferencia.porAtributo.length, 5);
  assert.equal(IP.compararItens([3434], cfg()).ok, false);
  assert.equal(IP.compararItens([3434, 99999999], cfg()).ok, false, 'item inválido sai da comparação');
  assert.match(r.aviso, /não é DPS/);
});

test('IPW11. lacunas de poder entre itens da mesma faixa, por slot e Ato', () => {
  const fichas = [{ slot: 'body', ip: 10, minLevel: 10, id: 1, nome: 'a' }, { slot: 'body', ip: 50, minLevel: 20, id: 2, nome: 'b' }, { slot: 'body', ip: 55, minLevel: 30, id: 3, nome: 'c' }, { slot: 'body', ip: 400, minLevel: 150, id: 4, nome: 'd' }];
  const l = IP.lacunasDePoder(fichas, [{ ato: 1, de: 1, ate: 100 }, { ato: 2, de: 101, ate: 200 }], { lacunaFator: 2 });
  assert.deepEqual(l.map((x) => [x.ato, x.de.id, x.ate.id, x.razao]), [[1, 1, 2, 5]]);
});

test('IPW12. validação da configuração: limites dos pesos, normalização, classificação, curva (≥ 2 pontos, levels únicos 1–1000, IP ≥ 0), alertas e regras', () => {
  const v = (mut) => { const c = cfg(); mut(c); return IP.validarConfiguracao(c).erros.join(' | '); };
  assert.equal(v(() => {}), '');
  assert.match(v((c) => { c.pesos.damage = -1; }), /peso de Damage/);
  assert.match(v((c) => { c.pesos.block = 101; }), /peso de Block/);
  assert.match(v((c) => { c.pesos.armour = 'x'; }), /peso de Armour/);
  assert.match(v((c) => { c.pesos = { damage: 0, block: 0, armour: 0, evasion: 0, energyShield: 0 }; }), /ao menos um peso/);
  assert.match(v((c) => { c.normalizacao.evasion = -1; }), /normalização de Evasion/);
  assert.match(v((c) => { c.normalizacao.blockDaArma = 'a'; }), /blockDaArma/);
  assert.match(v((c) => { c.versaoDaFormula = 0; }), /versaoDaFormula/);
  assert.match(v((c) => { c.classificacao.abaixoDe = 0.1; }), /abaixoDe < 0/);
  assert.match(v((c) => { c.curva.padrao = [{ level: 1, ip: 1 }]; }), /ao menos 2 pontos/);
  assert.match(v((c) => { c.curva.padrao = [{ level: 1, ip: 1 }, { level: 1001, ip: 2 }]; }), /1 a 1000/);
  assert.match(v((c) => { c.curva.padrao = [{ level: 5, ip: 1 }, { level: 5, ip: 2 }]; }), /duas vezes/);
  assert.match(v((c) => { c.curva.padrao = [{ level: 1, ip: -3 }, { level: 9, ip: 2 }]; }), /IP do level 1/);
  assert.match(v((c) => { c.curva.categorias.helmet = [{ level: 1, ip: 1 }, { level: 2, ip: 2 }]; }), /categoria "helmet" não existe/);
  assert.match(v((c) => { c.alertas.lacunaFator = 1; }), /lacunaFator/);
  assert.match(v((c) => { c.alertas.itemMuitoAbaixoPct = 0.2; }), /itemMuitoAbaixoPct/);
  assert.match(v((c) => { c.regras = [{ id: 'A' }]; }), /ID precisa/);
  assert.match(v((c) => { c.regras = [{ id: 'r1', levelMin: 50, levelMax: 10 }]; }), /levelMin maior/);
  assert.match(v((c) => { c.regras = [{ id: 'r1', ipMin: 9, ipMax: 3 }]; }), /ipMin maior/);
  assert.match(v((c) => { c.regras = [{ id: 'r1', chance: 2 }]; }), /chance/);
  assert.match(v((c) => { c.regras = [{ id: 'r1' }, { id: 'r1' }]; }), /ID repetido/);
});

test('IPW13. override: só o diferente é gravado; a fábrica nunca muda; salvar → versão anterior no histórico → conflito → restaurar → reverter', () => {
  reset();
  const fabrica = readFileSync(new URL('../gamedata/item-power.json', import.meta.url), 'utf8');
  const ef = Adm.obter().efetiva;
  const ov = { ativo: true, versaoDaFormula: 2, pesos: { ...ef.pesos, damage: 1.2 }, curva: { padrao: ef.curva.padrao, categorias: { ...ef.curva.categorias, body: [{ level: 1, ip: 10 }, { level: 1000, ip: 900 }] } } };
  const p = Adm.propor(ov);
  assert.equal(p.ok, true, JSON.stringify(p.erros));
  assert.deepEqual(p.override.pesos, { damage: 1.2 }, 'só o peso alterado');
  assert.deepEqual(Object.keys(p.override.curva.categorias), ['body'], 'só a curva alterada');
  assert.equal(p.impacto.versaoAntes, 1); assert.equal(p.impacto.versaoDepois, 2);
  assert.ok(p.impacto.mudaramDeSituacao > 0, 'o impacto mostra quem muda de situação');
  assert.equal(existsSync(join(tmp, 'item-power.json')), false, 'a prévia não grava');
  let rev = Adm.obter().revisao;
  assert.equal(Adm.salvar(ov, rev).ok, true);
  const gravado = JSON.parse(readFileSync(join(tmp, 'item-power.json'), 'utf8'));
  assert.equal(gravado.versaoDaFormula, 2); assert.deepEqual(gravado.pesos, { damage: 1.2 });
  assert.equal(readFileSync(new URL('../gamedata/item-power.json', import.meta.url), 'utf8'), fabrica, 'a fábrica não mudou');
  IP.aplicar(gravado);
  assert.equal(IP.EM_USO.pesos.damage, 1.2); assert.equal(IP.EM_USO.pesos.block, 1.5, 'o resto segue a fábrica');
  rev = Adm.obter().revisao;
  assert.equal(Adm.salvar({ ...ov, versaoDaFormula: 3 }, rev).ok, true);
  assert.ok(Adm.versoes().length >= 1, 'versão anterior guardada');
  assert.equal(Adm.salvar(ov, rev).ok, false, 'revisão velha = conflito');
  assert.equal(Adm.restaurar(Adm.versoes().at(-1), Adm.obter().revisao).ok, true);
  assert.equal(JSON.parse(readFileSync(join(tmp, 'item-power.json'), 'utf8')).versaoDaFormula, 2);
  assert.equal(Adm.reverter(Adm.obter().revisao).ok, true);
  IP.aplicar(Adm.lerOverride());
  assert.equal(IP.EM_USO.pesos.damage, 1, 'revertido: voltou à fábrica');
  reset();
});

test('IPW14. salvar recusa configuração inválida e campo desconhecido; recalcular com outros pesos não altera dado de item', () => {
  reset();
  const ruim = Adm.salvar({ ativo: true, pesos: { damage: -2 } }, Adm.obter().revisao);
  assert.equal(ruim.ok, false); assert.match(ruim.erros.join(' '), /peso de Damage/);
  assert.equal(existsSync(join(tmp, 'item-power.json')), false);
  assert.match(Adm.propor({ ativo: true, dps: 3 }).erros.join(' '), /"dps" não existe/);
  const antes = JSON.stringify(ITEM_CATALOG[7383]);
  const s = Adm.simular({ config: { ativo: true, pesos: { ...IP.EM_USO.pesos, damage: 3 } }, itemId: 7383 });
  assert.equal(s.ok, true); assert.ok(s.ip > IP.fichaDePoder(7383, cfg()).ip, 'peso maior = IP maior');
  assert.equal(JSON.stringify(ITEM_CATALOG[7383]), antes);
  assert.equal(IP.EM_USO.pesos.damage, 1, 'e a configuração em uso não mudou');
});

test('IPW15. simulação: editar atributos temporariamente recalcula IP, esperado e situação sem gravar; negativos e slot inválido são recusados', () => {
  const s = Adm.simular({ itemId: 7383, atributos: { damageMin: 100, damageMax: 140 } });
  assert.equal(s.ok, true);
  assert.equal(s.contribuicao.damage.valor, 120);
  assert.equal(s.level, 50); assert.equal(s.esperado, IP.esperado(cfg(), 'weapon', 50));
  assert.equal(s.situacao, 'muito-acima');
  assert.match(s.aviso, /nada foi gravado/);
  const livre = Adm.simular({ atributos: { armour: 10, evasion: 10 }, slot: 'body', level: 100 });
  assert.equal(livre.ip, 16); assert.equal(livre.esperado, IP.esperado(cfg(), 'body', 100));
  assert.equal(Adm.simular({ itemId: 7383, atributos: { armour: -5 } }).ok, false);
  assert.equal(Adm.simular({ atributos: {}, slot: 'mao' }).ok, false);
  assert.equal(Adm.simular({ itemId: 99999999 }).ok, false);
  assert.equal(Adm.simular({ atributos: {}, slot: 'body' }).situacao, 'sem-poder');
});

test('IPW16. lista de itens: filtros por categoria, level, raridade, classe e situação; ordem e paginação; detalhamento por atributo', () => {
  const l = Adm.listarItens({ slot: 'body', nivelMin: 100, nivelMax: 300, limite: 200 });
  assert.ok(l.total > 0 && l.itens.every((i) => i.slot === 'body' && i.minLevel >= 100 && i.minLevel <= 300));
  assert.ok(l.itens.every((i, k) => k === 0 || i.minLevel >= l.itens[k - 1].minLevel), 'ordenado por level');
  const kn = Adm.listarItens({ classe: 'knight', slot: 'weapon', limite: 200 });
  assert.ok(kn.itens.every((i) => !i.vocations.length || i.vocations.includes('knight')));
  const r = Adm.listarItens({ raridade: 'épico', limite: 50 });
  assert.ok(r.itens.every((i) => i.raridade === 'épico'));
  const ip = Adm.listarItens({ ordem: 'ip', limite: 5 }).itens;
  assert.ok(ip[0].ip >= ip[4].ip);
  const s = Adm.listarItens({ situacao: 'sem-level', limite: 10 });
  assert.ok(s.itens.every((i) => i.situacao === 'sem-level'));
  assert.ok(Adm.listarItens({ q: 'relic sword' }).itens.some((i) => i.id === 7383));
  assert.equal(Adm.listarItens({ q: '7383' }).itens[0].id, 7383, 'por ID');
  assert.notDeepEqual(Adm.listarItens({ slot: 'weapon', limite: 10, pagina: 1 }).itens.map((i) => i.id), Adm.listarItens({ slot: 'weapon', limite: 10, pagina: 0 }).itens.map((i) => i.id));
  const d = Adm.itemDetalhado(7383);
  assert.deepEqual(Object.keys(d.contribuicao), IP.ATRIBUTOS);
  assert.equal(Adm.itemDetalhado(1), null);
  const c = Adm.curva('weapon');
  assert.equal(c.ok, true); assert.ok(c.itens.length > 50 && c.amostra.length > 90 && Array.isArray(c.saltos));
  assert.equal(Adm.curva('mao').ok, false);
});

test('IPW17. presentes de marco: 5 classes × 50/100, IP por peça e por slot, total do conjunto (média por slot e melhor escolha) e desequilíbrios entre classes', () => {
  const m = An.presentesDeMarco();
  assert.equal(m.linhas.length, 10);
  assert.deepEqual([...new Set(m.linhas.map((l) => l.classe))].sort(), ['druid', 'knight', 'monk', 'paladin', 'sorcerer']);
  assert.deepEqual([...new Set(m.linhas.map((l) => l.level))].sort((a, b) => a - b), [50, 100]);
  for (const l of m.linhas) {
    assert.ok(l.pecas.every((p) => p.valido && p.slot), `${l.classe}${l.level}: peças válidas`);
    assert.equal(l.totalMedio, Math.round(l.slots.reduce((n, s) => n + s.ipMedio, 0) * 1000) / 1000);
    assert.ok(l.totalMaximo >= l.totalMedio);
  }
  const k50 = m.linhas.find((l) => l.classe === 'knight' && l.level === 50);
  assert.equal(k50.slots.find((s) => s.slot === 'weapon').opcoes, 3, 'o baú tem 3 armas possíveis');
  assert.ok(k50.slotsSemPeca.includes('ring'));
  assert.ok(m.linhas.every((l) => typeof l.desvioDaMediaPct === 'number'));
  assert.ok(m.desequilibrios.every((d) => Math.abs(d.desvioPct) > IP.EM_USO.classificacao.acimaDe));
  assert.match(m.aviso, /funções diferentes/);
});

test('IPW18. distribuição: análise de hunt, onde um item cai, alertas (muito acima/abaixo, level acima da hunt, muitas hunts, lacunas) — sem tocar em chance de drop', () => {
  const chancesAntes = JSON.stringify(Object.values(ITEM_CATALOG).map((m) => m.dropChance));
  const bestiarioAntes = JSON.stringify(Object.values((await_cat()).bestiary).map((b) => b.loot));
  const h = An.analisarHunt('troll-cave');
  assert.equal(h.level, 8); assert.ok(h.itens.length > 0);
  assert.ok(h.itens.every((i) => i.chance > 0 && i.monstros.length && ['abaixo', 'adequado', 'acima', 'muito-acima', 'sem-poder', 'sem-referencia'].includes(i.situacao)));
  assert.equal(An.analisarHunt('nao-existe'), null);
  const onde = An.ondeCai(3268);
  assert.ok(onde.some((x) => x.hunt === 'troll-cave' && x.monstros.includes('troll')));
  const al = An.alertasDeDistribuicao('facil');
  assert.ok(al.total > 0 && al.alertas.every((a) => a.mensagem));
  for (const t of Object.keys(al.porTipo)) assert.ok(['item-muito-acima', 'item-muito-abaixo', 'level-acima-da-hunt', 'item-em-muitas-hunts', 'lacuna-de-poder'].includes(t), t);
  const c = cfg(); c.alertas.huntsDemais = 1000; c.alertas.itemMuitoAbaixoPct = -0.99999;
  assert.ok(!('item-em-muitas-hunts' in An.alertasDeDistribuicao('facil', c).porTipo), 'os limites vêm da configuração');
  assert.equal(JSON.stringify(Object.values(ITEM_CATALOG).map((m) => m.dropChance)), chancesAntes);
  assert.equal(JSON.stringify(Object.values((await_cat()).bestiary).map((b) => b.loot)), bestiarioAntes, 'nenhuma chance foi alterada');
  assert.match(al.aviso, /sem a sua aprovação/);
});
function await_cat() { return globalThis.__cat; }
globalThis.__cat = (await import('../systems/dados.mjs')).CATALOGO;

test('IPW19. regras de distribuição: candidatos que cabem na faixa (level, IP, raridade, slot) e drops dos monstros listados que FOGEM da regra; a dificuldade entra na chance', () => {
  const r = An.avaliarRegra({ id: 'teste', levelMin: 1, levelMax: 60, ipMin: 0, ipMax: 100, slots: ['weapon'], hunts: ['troll-cave'] });
  assert.ok(r.candidatos > 0 && r.exemplos.every((e) => e.slot === 'weapon' && e.minLevel <= 60 && e.ip <= 100));
  const rigida = An.avaliarRegra({ id: 'rigida', levelMin: 500, levelMax: 600, slots: ['weapon'], hunts: ['troll-cave'] });
  assert.ok(rigida.foraDaRegra > 0, 'o que o Troll Cave dropa hoje não cabe numa regra de level 500+');
  assert.ok(rigida.fuga.every((f) => f.origem === 'troll-cave' && f.tipoDeOrigem === 'hunt'));
  const boss = An.avaliarRegra({ id: 'boss', ipMin: 1e9, chefes: ['troll'] });
  assert.ok(boss.foraDaRegra > 0 && boss.fuga[0].tipoDeOrigem === 'chefe');
  const vazia = An.avaliarRegra({ id: 'vazia' });
  assert.ok(vazia.candidatos > 1000 && vazia.foraDaRegra === 0);
  assert.match(r.aviso, /não altera drop/);
  // a chance respeita o fator de drop da dificuldade (neutro de fábrica)
  const c = P.comConfiguracao({ ...copia({ progressao: P.EM_USO.progressao, dificuldades: P.EM_USO.dificuldades, loot: P.EM_USO.loot }), loot: { ...copia(P.EM_USO.loot), dificil: { ...copia(P.EM_USO.loot.dificil), chanceDeDrop: 2 } } }, () => An.ondeCai(3268, 'dificil'));
  const n = An.ondeCai(3268, 'facil').find((x) => x.hunt === 'troll-cave').chance;
  assert.equal(c.find((x) => x.hunt === 'troll-cave').chance, Math.round(n * 2 * 1e6) / 1e6);
});

test('IPW20. Hot Reload: a estratégia "item-power" aplica sem reiniciar, mantém a última versão válida se o arquivo for inválido e volta à fábrica quando o override some', async () => {
  reset();
  const est = criarEstrategias({ overrides: tmp, atos: join(tmp, 'atos') })['item-power'];
  writeFileSync(join(tmp, 'item-power.json'), JSON.stringify({ ativo: true, versaoDaFormula: 7, pesos: { damage: 2 } }));
  assert.deepEqual((await est.aplicar()).ids, ['item-power']);
  assert.equal(IP.EM_USO.versaoDaFormula, 7); assert.equal(IP.EM_USO.pesos.damage, 2);
  writeFileSync(join(tmp, 'item-power.json'), JSON.stringify({ ativo: true, pesos: { damage: -9 } }));
  await assert.rejects(async () => est.aplicar(), /Overrides de item power inválidos/);
  assert.equal(IP.EM_USO.pesos.damage, 2, 'a última versão válida segue');
  writeFileSync(join(tmp, 'item-power.json'), '{ quebrado');
  await assert.rejects(async () => est.aplicar(), /não é um JSON válido/);
  rmSync(join(tmp, 'item-power.json'));
  await est.aplicar();
  assert.equal(IP.EM_USO.pesos.damage, 1); assert.equal(IP.EM_USO.versaoDaFormula, 1);
  const H = await import('../systems/hot-reload.mjs');
  assert.deepEqual(H.classificar('overrides/item-power.json'), { tipo: 'item-power', quente: true });
  assert.equal(H.classificar('item-power.json').quente, false);
  assert.deepEqual(H.caminhosDaRota('item-power'), ['overrides/item-power.json']);
  assert.ok(H.ORDEM_DE_RECARGA.includes('item-power'));
});

test('IPW21. validação centralizada, Git e versões: a verificação "item-power" passa limpa, reprova override inválido e o módulo é reconhecido', async () => {
  const v = criarVerificacoes().find((x) => x.id === 'item-power');
  assert.ok(v);
  assert.equal((await v.rodar({ overrides: join(tmp, 'vazio') })).achados.filter((a) => a.nivel === 'erro').length, 0);
  writeFileSync(join(tmp, 'item-power.json'), JSON.stringify({ ativo: true, pesos: { damage: -1 }, curva: { padrao: [{ level: 1, ip: 1 }] } }));
  const erros = (await v.rodar({ overrides: tmp })).achados.filter((a) => a.nivel === 'erro').map((a) => a.mensagem).join(' | ');
  assert.match(erros, /peso de Damage/); assert.match(erros, /ao menos 2 pontos/);
  rmSync(join(tmp, 'item-power.json'));
  const Git = await import('../admin/git-local.mjs');
  assert.equal(Git.moduloDe('game/gamedata/overrides/item-power.json'), 'item-power');
  const Val = await import('../admin/validacao.mjs');
  assert.deepEqual(Val.TESTES_POR_MODULO['item-power'], ['item-power', 'hot-reload-conteudo']);
});

test('IPW22. rotas: consulta, lista, detalhe, curva, marcos, alertas, prévia, simulação, comparação e regra só LEEM; salvar é "grava"; ação inválida = 400; conflito = 409', async () => {
  reset();
  const chama = async (metodo, rota, corpo, q = '') => { const r = []; await Http.atender({ method: metodo }, {}, `/api/mapas/_conteudo/${rota}`, new URL(`http://x/?${q}`), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => corpo }); return r[0]; };
  const g = await chama('GET', 'item-power');
  assert.equal(g[0], 200); assert.equal(g[1].efetiva.versaoDaFormula, 1); assert.equal(g[1].resumo.length, 8); assert.match(g[1].aviso, /Não é DPS/);
  assert.ok((await chama('GET', 'item-power/itens', null, 'slot=body&limite=5'))[1].itens.length === 5);
  const it = await chama('GET', 'item-power/item/7383');
  assert.equal(it[0], 200); assert.ok(it[1].ondeCai); assert.equal((await chama('GET', 'item-power/item/1'))[0], 404);
  assert.equal((await chama('GET', 'item-power/curva/body'))[0], 200); assert.equal((await chama('GET', 'item-power/curva/xx'))[0], 404);
  assert.equal((await chama('GET', 'item-power/marcos'))[1].linhas.length, 10);
  assert.ok((await chama('GET', 'item-power/alertas', null, 'dif=medio&limite=5'))[1].alertas.length <= 5);
  assert.equal((await chama('GET', 'item-power/hunt/troll-cave'))[0], 200); assert.equal((await chama('GET', 'item-power/hunt/xx'))[0], 404);
  assert.equal((await chama('POST', 'item-power/validar', { override: { ativo: true, pesos: { damage: 1.1 } } }))[1].ok, true);
  assert.equal((await chama('POST', 'item-power/simular', { itemId: 7383, atributos: { armour: -1 } }))[0], 400);
  assert.equal((await chama('POST', 'item-power/simular', { itemId: 7383 }))[0], 200);
  assert.equal((await chama('POST', 'item-power/comparar', { ids: [3434, 7383] }))[0], 200); assert.equal((await chama('POST', 'item-power/comparar', { ids: [3434] }))[0], 400);
  assert.equal((await chama('POST', 'item-power/regra', { regra: { id: 'x', slots: ['body'] } }))[0], 200);
  assert.equal(A.classeDaRota('GET', '/api/mapas/_conteudo/item-power'), 'leitura');
  for (const r of ['validar', 'simular', 'comparar', 'regra']) assert.equal(A.classeDaRota('POST', `/api/mapas/_conteudo/item-power/${r}`), 'leitura', r);
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/item-power'), 'grava');
  assert.equal((await chama('POST', 'item-power', { acao: 'nada' }))[0], 400);
  const s = await chama('POST', 'item-power', { acao: 'salvar', override: { ativo: true, pesos: { damage: 1.1 } }, revisao: g[1].revisao });
  assert.equal(s[0], 200);
  assert.equal((await chama('POST', 'item-power', { acao: 'salvar', override: { ativo: true }, revisao: g[1].revisao }))[0], 409);
  reset();
});
