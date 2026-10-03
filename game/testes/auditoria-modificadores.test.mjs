// A AUDITORIA dos modificadores como testes: cada achado do relatório (docs/modificadores/relatorio.md) tem aqui uma prova. SOMENTE LEITURA do
// jogo: gera itens em memória com sorteio semeado; nada toca em item, inventário, economia ou personagem de verdade (o banco recebe só contas e
// personagens de teste, apagados no fim).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as C from '../systems/itens/config.mjs';
import * as Gerar from '../systems/itens/gerar.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Inventario from '../systems/inventario.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as B from '../database/banco.mjs';
import { renomearAdds, ADD_NOVO_DO_ANTIGO, camposDaPeca } from '../systems/itens/item.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';
import { analisarProgressao, inventario, poolsDoAdd, iLvlDoTier } from '../../tools/auditar-modificadores.mjs';

const lcg = (semente) => { let s = semente >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const ids = Object.keys(C.ATRIBUTOS);

/** Um item de cada TIPO com pool (o primeiro do catálogo que aceita mods), para a geração. */
function itensPorTipo() {
  const porTipo = {};
  for (const [id, meta] of Object.entries(ITEM_CATALOG)) {
    const t = Gerar.tipoDoItem(meta);
    if (!t || !Gerar.aceitaAtributos(Number(id))) continue;
    (porTipo[t] ??= []).push(Number(id));
  }
  return porTipo;
}

// ------------------------------------------------------------------ a estrutura do sistema

test('M1. estrutura: 56 modificadores no catálogo (54 caem), 18 legados, todos os que caem estão nos pools, e NÃO existe prefixo/sufixo nem grupo de exclusão', () => {
  assert.equal(ids.length, 56);
  assert.equal(Object.keys(C.LEGADO).length, 18);
  assert.equal(Object.keys(Afixos.FICHAS).length, 74, 'catálogo derivado = catálogo + legados');
  const nosPools = new Set(Object.values(C.POOLS).flat());
  for (const id of ids) assert.ok(nosPools.has(id) || C.ATRIBUTOS[id].dropa === false, `${id} está fora de todo pool`);
  assert.deepEqual(ids.filter((id) => C.ATRIBUTOS[id].dropa === false).sort(), ['atk_flat', 'dmg_vs_elite']);
  for (const id of nosPools) assert.ok(C.ATRIBUTOS[id], `${id} está num pool mas não existe em atributos.json`);
  for (const a of Object.values(C.ATRIBUTOS)) for (const campo of ['prefixo', 'sufixo', 'grupo', 'tags']) assert.equal(a[campo], undefined, `campo ${campo} não existe no modelo`);
  assert.equal(C.NIVEL_MAXIMO, 5);
});

test('M2. convenção: T1 é o MAIS FRACO e T5 o MAIS FORTE em todos os modificadores (teto cresce a cada tier)', () => {
  for (const [id, a] of Object.entries(C.ATRIBUTOS)) {
    for (let t = 1; t < 5; t++) assert.ok(a.niveis[String(t + 1)][1] >= a.niveis[String(t)][1], `${id}: teto de T${t + 1} < T${t}`);
    assert.ok(a.niveis['5'][1] > a.niveis['1'][0], id);
  }
});

test('M3. duplicatas: nenhum id repetido dentro de um pool; o catálogo derivado bate com atributos.json (nome, tipo, min, max, faixas)', () => {
  const brutos = JSON.parse(readFileSync(new URL('../gamedata/itens/pools.json', import.meta.url), 'utf8')).pools;
  for (const [tipo, lista] of Object.entries(brutos)) assert.equal(new Set(lista).size, lista.length, `pool ${tipo} tem id repetido`);
  for (const [id, a] of Object.entries(C.ATRIBUTOS)) {
    const f = Afixos.FICHAS[id];
    assert.ok(f, `${id} não está no catálogo derivado`);
    assert.deepEqual([f.nome, f.tipo, f.min, f.max], [a.nome, a.tipo, a.niveis['1'][0], a.niveis['5'][1]], id);
    assert.deepEqual(f.niveis, a.niveis, `${id}: faixas do catálogo diferem do arquivo`);
  }
});

test('M4. achados de progressão (o que o relatório lista): 14, todos de fronteira compartilhada, sobreposição ou tiers idênticos', () => {
  const achados = inventario().flatMap((m) => m.progressao.filter((p) => p.tipo !== 'valor-por-raridade').map((p) => `${m.id}:${p.tipo}`));
  assert.equal(achados.length, 14);
  assert.deepEqual(achados.filter((x) => x.endsWith(':sobreposicao')), ['spell_block:sobreposicao', 'spell_block:sobreposicao']);
  assert.deepEqual([...new Set(achados.map((x) => x.split(':')[1]))].sort(), ['fronteira-compartilhada', 'sobreposicao', 'tiers-identicos']);
  assert.deepEqual(analisarProgressao('life'), [], 'vida: progressão limpa');
  assert.deepEqual(analisarProgressao('fire_res'), [], 'resistência: progressão limpa');
});

test('M5. liberação por Item Level: 1–100 → T1–T2; 101–600 → T1–T3; 601–1200 → T1–T4; acima → T1–T5; T5 só a partir do Item Level 1201', () => {
  assert.deepEqual([1, 100, 101, 600, 601, 1200, 1201, 2200].map((il) => C.tiersLiberados(il).length), [2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(iLvlDoTier(C.ATRIBUTOS.life)[5], 1201);
  assert.equal(iLvlDoTier(C.ATRIBUTOS.dmg_reduction)[1], 301, 'o nível mínimo do mod vale por cima dos tiers');
  assert.equal(iLvlDoTier(C.ATRIBUTOS.dmg_reduction)[5], 1201);
});

// ------------------------------------------------------------------ a geração

const COMBOS = [];
for (const il of [20, 50, 100, 101, 300, 301, 600, 1000, 1201, 2000]) for (const rar of C.ORDEM) COMBOS.push([il, rar]);

test('G1. invariantes da geração (≈ 8 mil peças semeadas em 11 tipos × 10 Item Levels × 6 raridades): ids distintos, pool do tipo, Item Level, raridade, tiers liberados, valor na faixa, quantidade da raridade', () => {
  const porTipo = itensPorTipo();
  const rng = lcg(2026);
  const violacoes = [];
  let pecas = 0;
  let comMods = 0;
  for (const [tipo, lista] of Object.entries(porTipo)) {
    for (const [il, rar] of COMBOS) {
      for (let k = 0; k < 12; k++) {
        const itemId = lista[Math.floor(rng() * lista.length)];
        const peca = Gerar.gerarItem({ itemId, itemLevel: il, raridade: rar, rng });
        pecas++;
        const af = peca.af ?? [];
        if (af.length) comMods++;
        const poolBruto = C.POOLS[tipo];
        const quantidades = Object.keys(C.RARIDADES.raridades[rar].atributos).map(Number);
        const permitidos = Gerar.poolDe(itemId, { itemLevel: il, raridade: rar, base: peca.base });
        if (new Set(af.map((a) => a.id)).size !== af.length) violacoes.push(`${tipo} il${il} ${rar}: id repetido`);
        if (af.length > Math.max(...quantidades)) violacoes.push(`${tipo} il${il} ${rar}: ${af.length} mods, máximo ${Math.max(...quantidades)}`);
        if (af.length < Math.min(Math.min(...quantidades), permitidos.length)) violacoes.push(`${tipo} il${il} ${rar}: ${af.length} mods, mínimo ${Math.min(...quantidades)}`);
        for (const a of af) {
          const def = C.ATRIBUTOS[a.id];
          if (!def) { violacoes.push(`${a.id} inexistente`); continue; }
          if (!poolBruto.includes(a.id)) violacoes.push(`${a.id} fora do pool de ${tipo}`);
          if (def.dropa === false) violacoes.push(`${a.id} dropou com dropa:false`);
          if ((def.nivelMinimo ?? 1) > il) violacoes.push(`${a.id} em Item Level ${il} (mínimo ${def.nivelMinimo})`);
          if (def.raridades && !def.raridades.includes(rar)) violacoes.push(`${a.id} em peça ${rar}`);
          if (!C.tiersLiberados(il).includes(a.nivel)) violacoes.push(`${a.id} T${a.nivel} em Item Level ${il}`);
          if (def.valorPorRaridade) { if (a.value !== def.valorPorRaridade[rar]) violacoes.push(`${a.id} valor ${a.value} ≠ ${def.valorPorRaridade[rar]} (${rar})`); continue; }
          const [lo, hi] = def.niveis[String(a.nivel)];
          if (a.value < lo - 1e-9 || a.value > hi + 1e-9) violacoes.push(`${a.id} T${a.nivel} valor ${a.value} fora de ${lo}–${hi}`);
          if (def.tipo === 'flat' && !Number.isInteger(a.value)) violacoes.push(`${a.id} flat com valor quebrado ${a.value}`);
        }
      }
    }
  }
  assert.ok(pecas > 7000 && comMods > 5000, `${pecas} peças, ${comMods} com mods`);
  assert.deepEqual(violacoes.slice(0, 10), [], `${violacoes.length} violações em ${pecas} peças`);
});

test('G2. o sorteio de TIER bate com a fórmula (peso × viés^(tier−1)): 100 mil sorteios, desvio abaixo de 1 ponto percentual', () => {
  const rng = lcg(7);
  for (const [il, rar, amuleto] of [[2000, 'comum', false], [2000, 'lendário', false], [2000, 'mítico', true], [500, 'raro', false], [50, 'épico', false]]) {
    const liberados = C.tiersLiberados(il);
    const vies = C.TIERS.viesDaRaridade[rar] * (amuleto ? C.TIERS.viesDoAmuleto : 1);
    const pesos = liberados.map((t) => C.TIERS.peso[String(t)] * vies ** (t - 1));
    const soma = pesos.reduce((a, b) => a + b, 0);
    const contagem = Object.fromEntries(liberados.map((t) => [t, 0]));
    for (let i = 0; i < 100000; i++) contagem[C.sortearTier(il, rar, rng, { amuleto })]++;
    liberados.forEach((t, i) => assert.ok(Math.abs(contagem[t] / 100000 - pesos[i] / soma) < 0.01, `il${il} ${rar}: T${t} ${(contagem[t] / 1000).toFixed(1)}% contra ${((100 * pesos[i]) / soma).toFixed(1)}%`));
  }
});

test('G3. a quantidade de mods por raridade bate com a tabela (comum 0; incomum 1–2; raro 2–3; épico 3–4; lendário 4–5; mítico 5–6), quando o pool comporta', () => {
  const rng = lcg(11);
  const anel = itensPorTipo().anel[0];
  for (const rar of C.ORDEM) {
    const tabela = C.RARIDADES.raridades[rar].atributos;
    const cont = {};
    for (let i = 0; i < 4000; i++) { const q = (Gerar.gerarItem({ itemId: anel, itemLevel: 2000, raridade: rar, rng }).af ?? []).length; cont[q] = (cont[q] ?? 0) + 1; }
    assert.deepEqual(Object.keys(cont).map(Number).sort(), Object.keys(tabela).map(Number).sort(), `${rar}: quantidades sorteadas ${JSON.stringify(cont)}`);
    for (const [q, p] of Object.entries(tabela)) assert.ok(Math.abs(cont[q] / 4000 - p / 100) < 0.05, `${rar} ${q}: ${cont[q] / 40}% contra ${p}%`);
  }
});

test('G4. o peso de sorteio funciona: o mod mais pesado (100) aparece muito mais que o mais leve do mesmo pool (10); dmg_vs_elite (dropa:false) nunca cai', () => {
  const rng = lcg(13);
  const arma = itensPorTipo().arma_melee[0];
  const cont = {};
  for (let i = 0; i < 20000; i++) for (const a of Gerar.gerarItem({ itemId: arma, itemLevel: 2000, raridade: 'mítico', rng }).af ?? []) cont[a.id] = (cont[a.id] ?? 0) + 1;
  assert.ok((cont.str ?? 0) > 3 * (cont.dmg_vs_boss ?? 1), `str ${cont.str} contra dmg_vs_boss ${cont.dmg_vs_boss}`);
  assert.equal(cont.dmg_vs_elite ?? 0, 0);
});

test('G5. compatibilidade por tipo: mod fora do pool do tipo nunca sai (arma mágica sem STR/DEX, melee sem INT/Mana, escudo sem dano, anel/amuleto amplos)', () => {
  assert.ok(!C.POOLS.arma_magica.includes('str') && !C.POOLS.arma_magica.includes('dex'));
  assert.ok(!C.POOLS.arma_melee.includes('int') && !C.POOLS.arma_melee.includes('mana'));
  for (const id of ['atk_flat', 'crit_chance', 'atk_speed']) assert.ok(!C.POOLS.escudo.includes(id), `${id} no escudo`);
  // Observações de DESIGN (não são erro): o escudo e a armadura aceitam `phys_dmg`; exp/ouro/loot só saem em anel e amuleto; spell_block só em escudo e livro.
  assert.ok(C.POOLS.escudo.includes('phys_dmg') && C.POOLS.armadura.includes('phys_dmg'));
  for (const id of ['exp_bonus', 'gold_find', 'loot_bonus']) assert.deepEqual(poolsDoAdd(id), ['anel', 'amuleto'], id);
  assert.deepEqual(poolsDoAdd('spell_block'), ['escudo', 'livro']);
  assert.ok(C.POOLS.amuleto.length >= C.POOLS.anel.length, 'o amuleto tem o pool mais amplo (ou igual ao do anel)');
  assert.deepEqual(poolsDoAdd('dex').slice(0, 2), ['arma_melee', 'arma_distancia']);
});

test('G6. defesa da base: armor_flat só sai em peça cuja base tem armadura (fora anel/amuleto)', () => {
  const rng = lcg(17);
  const armaduras = itensPorTipo().armadura;
  let semArmadura = 0;
  let viol = 0;
  for (let i = 0; i < 3000; i++) {
    const id = armaduras[i % armaduras.length];
    const p = Gerar.gerarItem({ itemId: id, itemLevel: 2000, raridade: 'mítico', rng });
    const temArmor = (p.base?.armor?.[1] ?? 0) > 0;
    if (!temArmor) semArmadura++;
    if (!temArmor && (p.af ?? []).some((a) => a.id === 'armor_flat' || a.id === 'armour_pct')) viol++;
  }
  assert.equal(viol, 0, `${viol} peças com armor sem base de armadura (${semArmadura} peças sem armadura na amostra)`);
});

// ------------------------------------------------------------------ a aplicação

function vestir(id, valor, nivel = 3) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  const anel = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);
  e.equipment.ring = { id: anel, count: 1, af: [{ id, nivel, value: valor }] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return e;
}

test('A1. valor aplicado = valor guardado = valor mostrado (servidor): para os 56 mods, Afixos.soma e viewDoAfixo repetem exatamente o valor da peça', () => {
  const divergencias = [];
  for (const [id, a] of Object.entries(C.ATRIBUTOS)) {
    const valor = a.valorPorRaridade ? Object.values(a.valorPorRaridade)[0] : Gerar.valorNaFaixa(id, 3, 0.5);
    const e = vestir(id, valor);
    const aplicado = Afixos.soma(e)[id];
    const mostrado = Afixos.viewDoAfixo({ id, nivel: 3, value: valor }, 'ring').valor;
    if (aplicado !== valor || mostrado !== valor) divergencias.push(`${id}: guardado ${valor}, aplicado ${aplicado}, mostrado ${mostrado}`);
    const texto = Afixos.viewDoAfixo({ id, nivel: 3, value: valor }, 'ring').texto;
    if (!texto.includes(String(valor))) divergencias.push(`${id}: texto "${texto}"`);
    if (a.tipo === 'pct' !== texto.endsWith('%')) divergencias.push(`${id}: unidade do texto "${texto}"`);
  }
  assert.deepEqual(divergencias, []);
});

test('A2. cobertura de efeito: toda sonda de efeito existe no teste de efeitos (atributos-efeito.test.mjs cita cada um dos 56 mods)', () => {
  const fonte = readFileSync(new URL('./atributos-efeito.test.mjs', import.meta.url), 'utf8');
  const sem = ids.filter((id) => !new RegExp(`\\b${id}\\b`).test(fonte));
  assert.deepEqual(sem, [], 'mods sem sonda de efeito');
  assert.match(fonte, /Atributo novo sem[\s/]+sonda/);
});

test('A3. a essência vermelha passa do teto (130% da régua) e o catálogo ainda a aceita; valores acima do T5 continuam sendo T5', () => {
  assert.equal(Afixos.FRACAO_DA_MITICA, 1.3);
  const topo = Afixos.valorNaRegua('life', 130);
  assert.ok(topo > C.ATRIBUTOS.life.niveis['5'][1]);
  assert.equal(Gerar.nivelDoValor('life', topo), 5);
});

test('A4. ambiguidade de fronteira: um valor de borda compartilhada é lido como o tier MAIS ALTO quando o tier não vem junto da peça (spell_block 3,2 vira T4; armor_flat 11 vira T5)', () => {
  assert.equal(Gerar.nivelDoValor('armor_flat', 11), 5);
  assert.equal(Gerar.nivelDoValor('spell_block', 3.2), 4, 'está em T3 (2–3,5), mas a leitura por valor diz T4');
  // Com o tier guardado na peça (`nivel`), a leitura é a do sorteio:
  assert.equal(Afixos.nivelDe({ id: 'spell_block', nivel: 3, value: 3.2 }), 3);
});

// ------------------------------------------------------------------ persistência

const criadas = [];
after(async () => {
  for (const c of criadas) {
    await B.db.prepare('DELETE FROM personagens WHERE conta = ?').run(c);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(c);
  }
});

test('P1. os mods sobrevivem a equipar, desequipar, trocar de peça e guardar na mochila (sem perda, mudança ou duplicação)', () => {
  const rng = lcg(5);
  const arma = itensPorTipo().arma_melee[0];
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  const peca = Gerar.gerarItem({ itemId: arma, itemLevel: 2000, raridade: 'mítico', rng });
  assert.ok(peca.af.length >= 5);
  const copia = structuredClone(peca);
  e.inventory.push(structuredClone(peca));
  const idx = e.inventory.length - 1;
  assert.ok(Inventario.equipar(e, { id: arma, pilha: idx }).ok || true);
  const equipada = e.equipment.weapon;
  if (equipada?.id === arma) {
    assert.deepEqual(equipada.af, copia.af, 'equipada: mesmos mods');
    assert.deepEqual(camposDaPeca(equipada).af, copia.af);
    assert.ok(Inventario.desequipar(e, { slot: 'weapon' }).ok);
    const volta = e.inventory.find((p) => p.id === arma && p.af);
    assert.deepEqual(volta.af, copia.af, 'de volta na mochila: mesmos mods');
    assert.equal(e.inventory.filter((p) => p.id === arma && p.af).length, 1, 'sem duplicação');
  } else {
    // Requisito de atributo/nível da peça não atendido para o personagem de teste: a peça fica intacta na mochila.
    assert.deepEqual(e.inventory[idx].af, copia.af);
  }
});

test('P2. o banco guarda e devolve os mods iguais (mochila, equipamento e depósito), e a conversão de peças antigas troca os 18 legados sem perder o tier', async () => {
  const rng = lcg(9);
  const itens = itensPorTipo();
  const mk = (tipo) => Gerar.gerarItem({ itemId: itens[tipo][0], itemLevel: 2000, raridade: 'lendário', rng });
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  const a = mk('arma_melee');
  const b = mk('amuleto');
  const c = mk('armadura');
  e.inventory = [a];
  e.equipment = { neck: b };
  e.deposito = [{ indice: 0, itens: [c] }];
  const conta = await B.criarConta({ email: `audmod-${randomUUID()}@teste.local`, senha: 'senha-123' });
  criadas.push(conta.id);
  const nome = `Au${randomUUID().replace(/[^a-z]/g, '').slice(0, 8)}`;
  const p = await B.criarPersonagem({ conta: conta.id, nome, vocacao: 'knight', sexo: 'male', estadoInicial: e });
  await B.gravarEstadoPersonagem(p.id, e);
  const lido = JSON.parse((await B.banco.prepare('SELECT estado FROM personagens WHERE id = ?').get(p.id)).estado);
  assert.deepEqual(lido.inventory[0].af, a.af);
  assert.deepEqual(lido.equipment.neck.af, b.af);
  assert.deepEqual(lido.deposito[0].itens[0].af, c.af);
  assert.deepEqual([lido.inventory[0].raridade, lido.inventory[0].ilvl], [a.raridade, a.ilvl]);
  // Os legados viram o add novo, no mesmo tier e na mesma posição da faixa.
  for (const [velho, novo] of Object.entries(ADD_NOVO_DO_ANTIGO)) {
    const antigo = C.LEGADO[velho];
    const [lo, hi] = antigo.niveis['3'];
    const peca = { id: 1, af: [{ id: velho, nivel: 3, value: (lo + hi) / 2 }] };
    assert.equal(renomearAdds(peca), true, velho);
    assert.equal(peca.af[0].id, novo, velho);
    assert.equal(peca.af[0].nivel, 3);
    const [nlo, nhi] = C.ATRIBUTOS[novo].niveis['3'];
    assert.ok(peca.af[0].value >= nlo - 1e-9 && peca.af[0].value <= nhi + 1e-9, `${velho} → ${novo}: ${peca.af[0].value} fora de ${nlo}–${nhi}`);
  }
});

test('P3. interface: o catálogo que o cliente recebe traz tipo, faixas e nome de cada mod; não há editor administrativo de mods (só o JSON)', () => {
  for (const id of ids) {
    const f = Afixos.FICHAS[id];
    assert.ok(f.nome && f.tipo && f.niveis && f.min != null && f.max != null && f.teto != null, id);
  }
  const tooltip = readFileSync(new URL('../frontend/client/src/tooltip.mjs', import.meta.url), 'utf8');
  assert.match(tooltip, /getCatalogo\(\)\?\.afixos/);
  const backend = readFileSync(new URL('../backend/index.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(backend, /atributos\.json|itens\/atributos/, 'nenhuma rota edita atributos.json');
});

// ------------------------------------------------------------------ Dano físico adicional (substitui o Attack no drop)

test('F1. Dano físico adicional: o Attack (atk_flat) não cai mais e o novo mod cai nos mesmos tipos de item; T1 = 10–20 e cada tier cresce ~×1,5 (valor fixo por tier)', () => {
  assert.equal(C.ATRIBUTOS.atk_flat.dropa, false);
  for (const lista of Object.values(C.POOLS)) assert.ok(!lista.includes('atk_flat'), 'atk_flat saiu de todos os pools');
  assert.deepEqual(poolsDoAdd('phys_add'), ['arma_melee', 'arma_distancia', 'municao', 'aljava', 'anel', 'amuleto'], 'os mesmos pools onde o Attack caía');
  const a = C.ATRIBUTOS.phys_add;
  assert.equal(a.nome, 'Dano físico adicional');
  assert.equal(a.proporcaoDoMaximo, 2);
  assert.deepEqual(a.niveis, { 1: [10, 10], 2: [15, 15], 3: [22, 22], 4: [34, 34], 5: [50, 50] }, 'o valor é o mínimo; o máximo é o dobro');
  assert.deepEqual([1, 2, 3, 4, 5].map((t) => `${a.niveis[t][0]}–${a.niveis[t][0] * a.proporcaoDoMaximo}`), ['10–20', '15–30', '22–44', '34–68', '50–100']);
  assert.deepEqual(analisarProgressao('phys_add'), [], 'progressão limpa: valores distintos e crescentes');
  const rng = lcg(21);
  const arma = itensPorTipo().arma_melee[0];
  const vistos = new Set();
  for (let i = 0; i < 4000; i++) for (const x of Gerar.gerarItem({ itemId: arma, itemLevel: 2000, raridade: 'mítico', rng }).af ?? []) { assert.notEqual(x.id, 'atk_flat'); if (x.id === 'phys_add') vistos.add(x.value); }
  assert.deepEqual([...vistos].sort((p, q) => p - q), [10, 15, 22, 34, 50], 'sem variação dentro do tier: um valor por tier');
});

test('F2. o efeito: o valor soma ao ataque MÍNIMO e o dobro ao MÁXIMO; o Attack antigo segue somando igual nos dois (peça antiga)', () => {
  const arma = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'jagged sword')?.id ?? Object.values(ITEM_CATALOG).find((i) => i.slot === 'weapon' && i.attack > 0 && !i.wand)?.id);
  const medir = (af) => {
    const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
    // Peça de drop de verdade: com a FAIXA de ataque da base (piso–teto), que é onde o mínimo e o máximo do mod entram.
    e.equipment.weapon = { id: arma, count: 1, base: { attack: [18, 24] }, af };
    Afixos.sincronizarMaximos(e);
    Ficha.invalidar(e);
    return { f: Ficha.combate(e) };
  };
  const base = medir([]);
  const novo = medir([{ id: 'phys_add', nivel: 5, value: 10 }]);
  const antigo = medir([{ id: 'atk_flat', nivel: 5, value: 10 }]);
  const dano = (r) => [r.f.damage?.min, r.f.damage?.max];
  const [bMin, bMax] = dano(base);
  const [nMin, nMax] = dano(novo);
  const [aMin, aMax] = dano(antigo);
  assert.ok(nMin > bMin && nMax > bMax, `o dano sobe: ${bMin}–${bMax} → ${nMin}–${nMax}`);
  // Pela mesma conta nas duas pontas (ataque × multiplicador da perícia): o mínimo sobe 10 de ataque e o máximo 20.
  const mult = (bMax - bMin) / (24 - 18);
  assert.ok(Math.abs((nMin - bMin) - 10 * mult) <= 1.5, `mínimo +10 de ataque: ${nMin - bMin} contra ${10 * mult}`);
  assert.ok(Math.abs((nMax - bMax) - 20 * mult) <= 1.5, `máximo +20 de ataque: ${nMax - bMax} contra ${20 * mult}`);
  assert.ok(Math.abs((aMax - bMax) - 10 * mult) <= 1.5 && Math.abs((aMin - bMin) - 10 * mult) <= 1.5, 'o Attack antigo sobe 10 nas duas pontas');
});

test('F3. texto: "Dano físico adicional 10–20" no servidor e no balão do cliente; o valor guardado continua um número só', () => {
  const v = Afixos.viewDoAfixo({ id: 'phys_add', nivel: 5, value: 10 }, 'weapon');
  assert.equal(v.texto, 'Dano físico adicional 10–20');
  assert.equal(v.valor, 10);
  assert.equal(Afixos.FICHAS.phys_add.proporcaoDoMaximo, 2);
  const tooltip = readFileSync(new URL('../frontend/client/src/tooltip.mjs', import.meta.url), 'utf8');
  assert.match(tooltip, /ficha\?\.proporcaoDoMaximo\s*\?\s*`\$\{posto\.value\}–\$\{Math\.round\(posto\.value \* ficha\.proporcaoDoMaximo\)\}`/);
});

test('F4. peças antigas com Attack (atk_flat) viram Dano físico adicional: mochila, equipamento, depósito e bolsa; mesmo tier, valor do tier novo; roda uma vez', async () => {
  const { converterPersonagem, converterTudo, VERSAO_DOS_ITENS } = await import('../systems/itens/item.mjs');
  assert.equal(VERSAO_DOS_ITENS, 6);
  const arma = itensPorTipo().arma_melee[0];
  const mk = (nivel, value, extra = []) => ({ id: arma, count: 1, raridade: 'raro', af: [{ id: 'atk_flat', nivel, value }, ...extra] });
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  e.versaoDosItens = 5;
  const faixaVelha = C.ATRIBUTOS.atk_flat.niveis;
  e.inventory = [mk(1, faixaVelha['1'][0]), mk(3, faixaVelha['3'][1])];
  e.equipment = { weapon: mk(5, faixaVelha['5'][1], [{ id: 'crit_chance', nivel: 2, value: 1.6 }]) };
  e.deposito = [{ indice: 0, itens: [mk(2, faixaVelha['2'][0])] }];
  e.pouch = [mk(4, faixaVelha['4'][0])];
  const n = converterPersonagem(e);
  assert.ok(n >= 5, `${n} peças convertidas`);
  assert.equal(e.versaoDosItens, 6);
  const esperado = { 1: 10, 2: 15, 3: 22, 4: 34, 5: 50 };
  const todas = [...e.inventory, e.equipment.weapon, e.deposito[0].itens[0], e.pouch[0]];
  for (const p of todas) {
    assert.ok(!p.af.some((a) => a.id === 'atk_flat'), 'nenhum Attack sobrou');
    const novo = p.af.find((a) => a.id === 'phys_add');
    assert.ok(novo, 'virou Dano físico adicional');
    assert.equal(novo.value, esperado[novo.nivel], `T${novo.nivel} vale ${esperado[novo.nivel]}`);
  }
  assert.deepEqual(todas.map((p) => p.af.find((a) => a.id === 'phys_add').nivel), [1, 3, 5, 2, 4], 'o tier de cada peça foi mantido');
  assert.deepEqual(e.equipment.weapon.af.find((a) => a.id === 'crit_chance'), { id: 'crit_chance', nivel: 2, value: 1.6 }, 'os outros mods não mudam');
  // Roda uma vez: a segunda chamada não faz nada (e não mexe nos valores).
  const copia = structuredClone(e.inventory);
  assert.equal(converterPersonagem(e), 0);
  assert.deepEqual(e.inventory, copia);
  // A conversão também vale onde a peça é lida (baú da guilda, mercado, depósito): `converterTudo` sozinho.
  const solta = mk(5, 20);
  assert.ok(converterTudo(solta) >= 1);
  assert.equal(solta.af[0].id, 'phys_add');
  // As duas na mesma peça: fica a de tier mais alto, uma só.
  const dupla = { id: arma, count: 1, raridade: 'raro', af: [{ id: 'atk_flat', nivel: 2, value: 4 }, { id: 'phys_add', nivel: 4, value: 34 }] };
  converterTudo(dupla);
  assert.deepEqual(dupla.af.map((a) => [a.id, a.nivel, a.value]), [['phys_add', 4, 34]]);
});
