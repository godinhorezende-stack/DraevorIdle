// Auditoria dos preços de venda ao NPC × tabelas de loot (01/10). Só LÊ o catálogo e o bestiário e
// escreve o relatório — não muda preço, chance nem raridade.
//
// Uso (da raiz do repositório):  node tools/auditar-precos-e-loot.mjs > docs/auditoria-precos-e-loot.md
import { ITEM_CATALOG, CATALOGO } from '../game/systems/dados.mjs';
import { BESTIARY } from '../game/systems/hunt/monstros.mjs';
import { precoNpc, valorEsperado } from '../game/systems/hunt/rentabilidade.mjs';
import { VALOR_DA_MOEDA } from '../game/systems/inventario.mjs';

const ALTAS = new Set(['épico', 'lendário', 'mítico']);
const SLOTS = new Set(['weapon', 'head', 'body', 'legs', 'feet', 'shield', 'neck', 'ring', 'backpack', 'ammo']);
const pct = (c) => `${(c * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`;
const n = (v) => Math.round(v).toLocaleString('pt-BR');

/** De onde vem o `sell` do item (ver `itens/preco-de-venda.mjs`). */
function origem(m) {
  if (!m) return 'sem cadastro';
  if (!(Number(m.sell) > 0)) return 'sem preço (NPC não compra)';
  if (!m.sellCalculado) return 'catálogo capturado';
  if (Number(m.buy) > 0) return 'calculado: compra × 0,25';
  if (SLOTS.has(m.slot) && !m.stackable) return 'calculado: curva por level';
  return 'calculado: fixo de lixo (1)';
}

// Bicho -> hunts onde ele aparece (pela lista de criaturas do catálogo).
const huntsDoBicho = new Map();
for (const h of CATALOGO.hunts ?? []) for (const c of h.creatures ?? []) {
  const lista = huntsDoBicho.get(c.key) ?? [];
  lista.push(h.name ?? h.id);
  huntsDoBicho.set(c.key, lista);
}

// Item -> onde cai.
const porItem = new Map();
for (const [chave, b] of Object.entries(BESTIARY)) {
  for (const l of b.loot ?? []) {
    if (VALOR_DA_MOEDA[l.id] != null) continue;
    const e = porItem.get(l.id) ?? { id: l.id, menor: 1, maior: 0, bichos: [], hunts: new Set() };
    e.menor = Math.min(e.menor, l.chance);
    e.maior = Math.max(e.maior, l.chance);
    e.bichos.push(chave);
    for (const h of huntsDoBicho.get(chave) ?? []) e.hunts.add(h);
    porItem.set(l.id, e);
  }
}

const linhas = [];
const out = (s = '') => linhas.push(s);
const total = porItem.size;
const contagem = {};
for (const e of porItem.values()) {
  const o = origem(ITEM_CATALOG[e.id]);
  contagem[o] = (contagem[o] ?? 0) + 1;
}

out('# Auditoria — preços de venda ao NPC × loot dos monstros');
out('');
out(`Gerado por \`tools/auditar-precos-e-loot.mjs\` (só leitura). Preço = \`precoNpc\` (\`sell\` × \`quickSellRate\` = ${CATALOGO.quickSellRate ?? 1}), a mesma regra da venda e do Analisador.`);
out('');
out(`## 1. De onde vem o preço dos ${n(total)} itens que caem dos bichos`);
out('');
out('| Origem do preço | Itens |');
out('|---|---|');
for (const [o, c] of Object.entries(contagem).sort((a, b) => b[1] - a[1])) out(`| ${o} | ${n(c)} |`);
out('');
out('Não há preço "padrão de 1 gold por erro": item sem `sell` vale 0 (o NPC não compra) em toda conta. O 1 gold vem de duas fontes, as duas DE PROPÓSITO: o `sell: 1` do catálogo capturado do servidor original e a regra do dono (30/09) para loot comum sem preço nenhum (lixo, produto de bicho, comida...). A raridade não muda o preço, também por decisão do dono.');
out('');

const suspeitos = [...porItem.values()]
  .map((e) => ({ ...e, m: ITEM_CATALOG[e.id] }))
  .filter((e) => e.m && ALTAS.has(e.m.rarity) && precoNpc(e.id) <= 1 && e.menor < 0.01)
  .sort((a, b) => a.menor - b.menor);
out(`## 2. Raridade de catálogo alta (épico/lendário/mítico), chance < 1% e venda ≤ 1 gold — ${suspeitos.length} itens`);
out('');
out('O "Problema 1" relatado. Candidatos a REVISÃO ECONÔMICA (nada foi mudado):');
out('');
out('| Item | id | Raridade | Venda | Origem do preço | Menor chance | Bichos | Hunts (até 3) |');
out('|---|---|---|---|---|---|---|---|');
for (const e of suspeitos) {
  out(`| ${e.m.name} | ${e.id} | ${e.m.rarity} | ${precoNpc(e.id)} | ${origem(e.m)} | ${pct(e.menor)} | ${e.bichos.length} | ${[...e.hunts].slice(0, 3).join(', ') || '—'} |`);
}
out('');

const altosSemPreco = [...porItem.values()]
  .map((e) => ({ ...e, m: ITEM_CATALOG[e.id] }))
  .filter((e) => e.m && ALTAS.has(e.m.rarity) && precoNpc(e.id) === 0)
  .sort((a, b) => a.menor - b.menor);
out(`## 3. Raridade alta que o NPC não compra (venda 0) — ${altosSemPreco.length} itens`);
out('');
out('Moedas, fichas, bolsas, itens de quest/montaria ficam sem venda por regra; os demais podem merecer preço:');
out('');
out('| Item | id | Raridade | Tipo | Menor chance |');
out('|---|---|---|---|---|');
for (const e of altosSemPreco.slice(0, 60)) out(`| ${e.m.name} | ${e.id} | ${e.m.rarity} | ${e.m.type ?? '—'} | ${pct(e.menor)} |`);
if (altosSemPreco.length > 60) out(`| … mais ${altosSemPreco.length - 60} | | | | |`);
out('');

out('## 4. Valor esperado por morte, por hunt (chances-base, sem bônus de loot)');
out('');
out('Ouro das moedas + itens pelo preço do NPC, por bicho morto (média dos bichos da hunt). Serve para comparar hunts entre si, não é promessa de lucro.');
out('');
out('| Hunt | Bichos | Ouro/morte | Itens/morte | Item que mais pesa |');
out('|---|---|---|---|---|');
const porHunt = [];
for (const h of CATALOGO.hunts ?? []) {
  const chaves = (h.creatures ?? []).map((c) => c.key).filter((k) => BESTIARY[k]);
  if (!chaves.length) continue;
  const r = valorEsperado(Object.fromEntries(chaves.map((k) => [k, 1])), BESTIARY);
  porHunt.push({ h, chaves, gold: r.gold / chaves.length, valor: r.valor / chaves.length, top: r.itens[0] });
}
porHunt.sort((a, b) => b.gold + b.valor - (a.gold + a.valor));
for (const x of porHunt) {
  const top = x.top ? `${ITEM_CATALOG[x.top.id]?.name ?? x.top.id} (${n(x.top.total / x.chaves.length)})` : '—';
  out(`| ${x.h.name ?? x.h.id} | ${x.chaves.length} | ${n(x.gold)} | ${n(x.valor)} | ${top} |`);
}
out('');
const semCadastro = [...porItem.values()].filter((e) => !ITEM_CATALOG[e.id]).sort((a, b) => b.bichos.length - a.bichos.length);
out(`## 5. Ids de loot SEM cadastro no catálogo — ${semCadastro.length}`);
out('');
out('Erro de dados: o bestiário manda dropar um id que o catálogo de itens não tem (sem nome, sem sprite, sem preço). A entrada SEM id nenhum ("rotten feather", "ritual tooth") passou a ser ignorada no combate (01/10: virava item fantasma na bolsa); as de id numérico sem cadastro ainda entram na bolsa como item sem nome que não vende (vale 0). Precisa decidir: cadastrar o item ou tirar o drop.');
out('');
out('| id | Nome no bestiário | Menor chance | Bichos | Hunts (até 3) |');
out('|---|---|---|---|---|');
const nomeNoBestiario = (id) => { for (const b of Object.values(BESTIARY)) for (const l of b.loot ?? []) if (l.id === id && l.name) return l.name; return '—'; };
for (const e of semCadastro.slice(0, 40)) out(`| ${e.id ?? 'SEM ID (ignorado)'} | ${nomeNoBestiario(e.id)} | ${pct(e.menor)} | ${e.bichos.length} | ${[...e.hunts].slice(0, 3).join(', ') || '—'} |`);
if (semCadastro.length > 40) out(`| … mais ${semCadastro.length - 40} | | | | |`);
out('');
out('## 6. Raridade do catálogo × raridade do drop');
out('');
out('Equipamento (peça que não empilha): a raridade que vale é a SORTEADA no drop (`itens/gerar.mjs`); a do catálogo é ignorada (`raridadeDaPeca`). Os demais itens usam a do catálogo, e ela não mexe no preço. Não é erro de cadastro: é a regra.');
console.log(linhas.join('\n'));
