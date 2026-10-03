// AUDITORIA DOS MODIFICADORES (adds/"atributos" dos itens): lê a configuração REAL do jogo (`gamedata/itens/*.json` via `config.mjs`, e o
// catálogo derivado `FICHAS`) e gera o inventário em `docs/modificadores/`. SOMENTE LEITURA: não altera valor, item, banco nem economia.
//   node tools/auditar-modificadores.mjs            # escreve docs/modificadores/*.md e inventario.json
//   node tools/auditar-modificadores.mjs --stdout   # só imprime o resumo
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ATRIBUTOS, LEGADO, POOLS, TIERS, RARIDADES, ORDEM } from '../game/systems/itens/config.mjs';
import { FICHAS } from '../game/systems/afixos.mjs';
import { ITEM_CATALOG } from '../game/systems/dados.mjs';
import * as Gerar from '../game/systems/itens/gerar.mjs';

const RAIZ = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(RAIZ, '..', 'docs', 'modificadores');

export const CATEGORIAS = { atributo: 'Atributos principais', ofensivo: 'Ofensivos', defensivo: 'Defensivos', resistencia: 'Resistências', vida: 'Regeneração e recuperação', utilidade: 'Utilitários', avancado: 'Avançados (nível alto)' };
/** Os tipos de equipamento com pool, agrupados nas categorias que a auditoria pede. */
export const GRUPOS = { Armas: ['arma_melee', 'arma_distancia', 'arma_magica', 'municao'], Escudos: ['escudo', 'livro', 'aljava'], Armaduras: ['armadura', 'bota'], Anéis: ['anel'], Amuletos: ['amuleto'] };
const unidade = (a) => (a.tipo === 'pct' ? '%' : '');
const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000).replace('.', ','));
const faixa = (a, t) => { const [lo, hi] = a.niveis[String(t)]; return lo === hi ? `${fmt(lo)}${unidade(a)}` : `${fmt(lo)}–${fmt(hi)}${unidade(a)}`; };

/** Em quais tipos de equipamento cada add está no pool (a fonte da compatibilidade). */
export function poolsDoAdd(id) {
  return Object.entries(POOLS).filter(([, lista]) => lista.includes(id)).map(([tipo]) => tipo);
}

/** A progressão de um add: sobreposição, lacuna, tiers idênticos, ordem. Devolve a lista de achados (texto) — vazia se coerente. */
export function analisarProgressao(id, a = ATRIBUTOS[id]) {
  const achados = [];
  const n = a.niveis;
  for (let t = 1; t <= 5; t++) {
    const [lo, hi] = n[String(t)];
    if (lo > hi) achados.push({ tipo: 'faixa-invertida', texto: `T${t} tem mínimo (${lo}) maior que o máximo (${hi})` });
    if (t < 5) {
      const [lo2, hi2] = n[String(t + 1)];
      if (lo2 < hi) achados.push({ tipo: 'sobreposicao', texto: `T${t + 1} começa em ${lo2}, abaixo do teto de T${t} (${hi})` });
      else if (lo2 === hi) achados.push({ tipo: 'fronteira-compartilhada', texto: `o teto de T${t} (${hi}) é igual ao mínimo de T${t + 1}: o valor ${hi} cabe nos dois` });
      if (lo2 === lo && hi2 === hi) achados.push({ tipo: 'tiers-identicos', texto: `T${t} e T${t + 1} têm a mesma faixa (${lo}–${hi})` });
      if (hi2 < hi) achados.push({ tipo: 'regressao', texto: `o teto de T${t + 1} (${hi2}) é menor que o de T${t} (${hi})` });
    }
  }
  if (a.valorPorRaridade) achados.push({ tipo: 'valor-por-raridade', texto: `o valor sorteado vem da RARIDADE (${JSON.stringify(a.valorPorRaridade)}), não do tier: as faixas por tier só informam` });
  return achados;
}

/** Os tiers que o Item Level libera (a regra de `tiers.json`), e o menor Item Level em que cada tier é possível para este add. */
export function iLvlDoTier(a) {
  const faixas = TIERS.itemLevel;
  const saida = {};
  let anterior = 0;
  for (const f of faixas) {
    const de = anterior + 1;
    for (const t of f.tiers) saida[t] ??= Math.max(de, a.nivelMinimo ?? 1);
    anterior = f.ate ?? anterior;
  }
  return saida;
}

export function inventario() {
  return Object.entries(ATRIBUTOS).map(([id, a]) => {
    const pools = poolsDoAdd(id);
    return {
      id,
      nome: a.nome,
      tipo: a.tipo,
      unidade: unidade(a) || 'número',
      categoria: a.categoria,
      prefixoOuSufixo: 'não existe (o sistema não tem prefixo/sufixo)',
      peso: a.peso,
      nivelMinimoDoItem: a.nivelMinimo ?? 1,
      raridades: a.raridades ?? ORDEM,
      dropa: a.dropa !== false,
      valorPorRaridade: a.valorPorRaridade ?? null,
      niveis: a.niveis,
      tiersLiberadosPorItemLevel: iLvlDoTier(a),
      pools,
      progressao: analisarProgressao(id, a),
      origem: 'gamedata/itens/atributos.json',
      estado: a.dropa === false ? 'cadastrado e DESLIGADO do drop (dropa:false)' : !pools.length ? 'cadastrado e FORA de todo pool (nunca cai)' : 'ativo',
    };
  });
}

function tabelaDeTiers(lista) {
  const linhas = ['| Modificador (id) | Un. | T1 | T2 | T3 | T4 | T5 | Item Level mín. | Peso | Raridades |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const m of lista) {
    const a = ATRIBUTOS[m.id];
    linhas.push(`| ${m.nome} (\`${m.id}\`) | ${m.unidade} | ${[1, 2, 3, 4, 5].map((t) => faixa(a, t)).join(' | ')} | ${m.nivelMinimoDoItem} | ${m.peso} | ${m.raridades.length === 6 ? 'todas' : m.raridades.join(', ')} |`);
  }
  return linhas.join('\n');
}

function escreverTudo() {
  mkdirSync(SAIDA, { recursive: true });
  const inv = inventario();
  const porCategoria = Object.fromEntries(Object.keys(CATEGORIAS).map((c) => [c, inv.filter((m) => m.categoria === c)]));
  const arquivos = [];
  const salvar = (nome, texto) => { writeFileSync(join(SAIDA, nome), texto); arquivos.push(nome); };

  // ---- uma página por categoria ----
  let n = 1;
  for (const [cat, titulo] of Object.entries(CATEGORIAS)) {
    const lista = porCategoria[cat];
    if (!lista.length) continue;
    const nome = `0${n++}-${cat}.md`;
    const corpo = [`# ${titulo} (${lista.length} modificadores)`, '', '> **Convenção do Draevor: T1 é o MAIS FRACO e T5 o MAIS FORTE** (o contrário do Path of Exile). Origem: `gamedata/itens/atributos.json`. Não existe prefixo/sufixo.', '', tabelaDeTiers(lista), '', '## Detalhe por modificador', ''];
    for (const m of lista) {
      corpo.push(`### ${m.nome} — \`${m.id}\``, `- Estado: ${m.estado}`, `- Tipo de valor: ${m.tipo === 'pct' ? 'percentual (%)' : 'número fixo'}; Item Level mínimo para sair: ${m.nivelMinimoDoItem}; peso de sorteio: ${m.peso}.`, `- Pools (equipamentos onde pode sair): ${m.pools.join(', ') || '— nenhum —'}.`, `- Tier liberado a partir do Item Level: ${Object.entries(m.tiersLiberadosPorItemLevel).map(([t, il]) => `T${t}≥${il}`).join(', ')}.`);
      if (m.valorPorRaridade) corpo.push(`- Valor fixo por raridade: ${JSON.stringify(m.valorPorRaridade)}.`);
      for (const p of m.progressao) corpo.push(`- ⚠ ${p.tipo}: ${p.texto}`);
      corpo.push('');
    }
    salvar(nome, corpo.join('\n'));
  }

  // ---- legado ----
  const leg = Object.entries(LEGADO);
  salvar('08-legado.md', ['# Modificadores LEGADOS (não caem mais)', '', 'Vêm de `atributos.json > legado`. Peças antigas que os trazem são convertidas ao carregar (`renomearAdds`, em `systems/itens/item.mjs`, tabela `ADD_NOVO_DO_ANTIGO`). Estão no catálogo derivado `FICHAS` (73 = 55 ativos + 18 legados) só para a conversão e a tela de peças antigas.', '', '| Legado | Tipo | T1 | T2 | T3 | T4 | T5 | Vira |', '|---|---|---:|---:|---:|---:|---:|---|', ...leg.map(([id, a]) => `| ${a.nome} (\`${id}\`) | ${a.tipo} | ${[1, 2, 3, 4, 5].map((t) => faixa({ ...a }, t)).join(' | ')} | \`${({ skill_melee: 'str', skill_fist: 'str', skill_club: 'str', skill_sword: 'str', skill_axe: 'str', skill_distance: 'dex', skill_magic: 'int', skill_shielding: 'block', hp_max: 'life', mana_max: 'mana', hp_regen: 'life_regen', speed: 'move_speed', protect_all: 'phys_res', weapon_atk_pct: 'phys_dmg', onslaught: 'crit_dmg', spell_heal: 'int', spell_dmg: 'int', capacity: 'str' })[id] ?? '?'}\` |`)].join('\n'));

  // ---- compatibilidade ----
  const tipos = Object.keys(POOLS);
  const comp = ['# Compatibilidade modificador × equipamento', '', 'Controlada **só por código + dados**: o tipo do item (`tipoDoItem`, em `gerar.mjs`, pelo slot/skill/flags do catálogo) escolhe o pool de `pools.json`; depois `poolDe` filtra por `dropa`, Item Level mínimo, raridade e, fora anel/amuleto, os adds de defesa que a base da peça não tem (`DEFESA_DO_ADD`). Não há tags nem grupos no banco.', '', `Tipos de item com pool: ${tipos.map((t) => `\`${t}\``).join(', ')}.`, '', '| Modificador | Armas (melee/dist/mágica/munição) | Escudos (escudo/livro/aljava) | Armaduras (armadura/bota) | Anéis | Amuletos |', '|---|---|---|---|---|---|'];
  const marca = (m, lista) => { const t = lista.filter((x) => m.pools.includes(x)); return t.length === lista.length ? 'todos' : t.length ? t.join(', ') : '—'; };
  for (const m of inv) comp.push(`| ${m.nome} (\`${m.id}\`) | ${marca(m, GRUPOS.Armas)} | ${marca(m, GRUPOS.Escudos)} | ${marca(m, GRUPOS.Armaduras)} | ${marca(m, GRUPOS.Anéis)} | ${marca(m, GRUPOS.Amuletos)} |`);
  comp.push('', '## Regras de defesa da base', 'Só saem `armor_flat`/`armour_pct` se a base da peça tem armadura, `evasion`/`evasion_pct` se tem evasão, `energy_shield`/`es_pct` se tem Energy Shield (anel e amuleto são livres). Equipamentos sem pool (mochila, itens que empilham) não recebem mod.');
  salvar('09-compatibilidade.md', comp.join('\n'));

  // ---- progressão dos tiers ----
  const prog = ['# Progressão dos tiers e liberação por Item Level', '', '## Quais tiers cada Item Level libera (`tiers.json`)', '', '| Item Level | Tiers possíveis |', '|---|---|', ...TIERS.itemLevel.map((f, i, l) => `| ${(l[i - 1]?.ate ?? 0) + 1}–${f.ate ?? '∞'} | ${f.tiers.map((t) => `T${t}`).join(', ')} |`), '', `Peso de cada tier: ${Object.entries(TIERS.peso).map(([t, p]) => `T${t}=${p}`).join(', ')}. Viés da raridade (multiplica o peso de cada tier por viés^(tier−1)): ${Object.entries(TIERS.viesDaRaridade).map(([r, v]) => `${r}=${v}`).join(', ')}; amuleto ×${TIERS.viesDoAmuleto}; boss +${TIERS.bonusDoBoss * 100}% no Item Level.`, '', '## Quantos mods cada raridade tem (`raridades.json`)', '', '| Raridade | Quantidade de mods (chance %) |', '|---|---|', ...ORDEM.map((r) => `| ${r} | ${Object.entries(RARIDADES.raridades[r].atributos).map(([q, p]) => `${q} (${p}%)`).join(', ')} |`), '', '## Achados de progressão', ''];
  for (const m of inv) for (const p of m.progressao.filter((x) => x.tipo !== 'valor-por-raridade')) prog.push(`- \`${m.id}\` — **${p.tipo}**: ${p.texto}`);
  salvar('10-progressao-dos-tiers.md', prog.join('\n'));

  // ---- índice ----
  const indice = ['# Modificadores do Draevor — inventário da auditoria', '', `Gerado por \`tools/auditar-modificadores.mjs\` a partir da configuração real (${inv.length} modificadores ativos no catálogo, ${leg.length} legados). Relatório e achados: [relatorio.md](relatorio.md). Comparação com o PoE 1: [poe1.md](poe1.md). Dados completos: [inventario.json](inventario.json).`, '', '> **T1 = mais fraco, T5 = mais forte.** Não há prefixo/sufixo nem grupos de exclusão: um item recebe N mods distintos de um pool (N pela raridade).', '', ...arquivos.map((a) => `- [${a}](${a})`), ''];
  writeFileSync(join(SAIDA, 'README.md'), indice.join('\n'));
  writeFileSync(join(SAIDA, 'inventario.json'), `${JSON.stringify({ geradoDe: 'gamedata/itens/*.json', modificadores: inv, legado: LEGADO }, null, 1)}\n`);
  return { inv, arquivos };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const inv = inventario();
  const problemas = inv.flatMap((m) => m.progressao.filter((p) => p.tipo !== 'valor-por-raridade').map((p) => `${m.id}: ${p.tipo} — ${p.texto}`));
  if (process.argv.includes('--stdout')) {
    console.log(`${inv.length} modificadores; ${problemas.length} achados de progressão`);
    for (const p of problemas) console.log(`  ${p}`);
  } else {
    const r = escreverTudo();
    console.log(`escrito em docs/modificadores/: ${r.arquivos.length} arquivos + README.md + inventario.json`);
    console.log(`${problemas.length} achados de progressão`);
  }
}
void FICHAS;
void ITEM_CATALOG;
void Gerar;
