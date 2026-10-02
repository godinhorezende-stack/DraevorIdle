// A configuração do sistema de itens: raridades, níveis dos atributos,
// atributos, pools por equipamento e efeitos — tudo em `gamedata/itens/*.json`,
// para balancear sem mexer em código.
//
// Carregada UMA vez, na subida, e VALIDADA: tabela de chance que não soma 100,
// faixa de nível fora de ordem (N1 < N2 < ... < N5) ou atributo que o combate
// não conhece derrubam o boot com a mensagem do problema, em vez de gerar item
// errado em silêncio. Nada aqui consulta banco, rede ou Redis.
import { readFileSync } from 'node:fs';
import { CATALOGO } from '../dados.mjs';

const ler = (arquivo) => JSON.parse(readFileSync(new URL(`../../gamedata/itens/${arquivo}`, import.meta.url), 'utf8'));

export const RARIDADES = ler('raridades.json');
const ARQUIVO_DE_ATRIBUTOS = ler('atributos.json');
/** Os adds que caem (ModifierDefinition): nome, tipo, categoria, peso e a faixa de cada tier (T1 fraco … T5 forte). */
export const ATRIBUTOS = ARQUIVO_DE_ATRIBUTOS.atributos;
/** Os adds de antes da reestruturação (29/09): não caem mais; só a migração v4 lê. */
export const LEGADO = ARQUIVO_DE_ATRIBUTOS.legado ?? {};
export const POOLS = ler('pools.json').pools;
/** Os tiers pelo Item Level, o peso de cada tier e o viés da raridade (`tiers.json`). */
export const TIERS = ler('tiers.json');
export const EFEITOS = ler('efeitos.json');

export const ORDEM = RARIDADES.ordem;
export const DIFICULDADES = ['facil', 'medio', 'dificil'];
export const NIVEL_MAXIMO = 5;

const soma = (lista) => lista.reduce((a, b) => a + Number(b), 0);
const perto100 = (s) => Math.abs(s - 100) < 1e-6;

/** Confere a configuração inteira; devolve a lista de problemas (vazia = ok). */
export function validar() {
  const erros = [];
  for (const [ato, porDif] of Object.entries(RARIDADES.chances)) {
    for (const d of DIFICULDADES) {
      const t = porDif[d];
      if (!t) erros.push(`raridades: falta Ato ${ato} ${d}`);
      else if (!perto100(soma(ORDEM.map((r) => t[r] ?? 0)))) erros.push(`raridades: Ato ${ato} ${d} soma ${soma(Object.values(t))}`);
    }
  }
  for (const r of ORDEM) {
    const q = RARIDADES.raridades[r]?.atributos;
    if (!q) erros.push(`raridades: ${r} sem quantidade de atributos`);
    else if (!perto100(soma(Object.values(q)))) erros.push(`raridades: quantidade de atributos de ${r} soma ${soma(Object.values(q))}`);
  }
  for (const [mob, g] of Object.entries(RARIDADES.mobs?.inclinacao ?? {})) if (!(g >= 1)) erros.push(`raridades: inclinação do mob ${mob} precisa ser >= 1`);
  for (const r of ORDEM) if (!(Number(RARIDADES.mobs?.posicao?.[r]) >= 0)) erros.push(`raridades: posição de ${r} (inclinação do mob) inválida`);
  for (const faixa of TIERS.itemLevel ?? []) {
    if (!faixa.tiers?.length || faixa.tiers.some((t) => !(t >= 1 && t <= NIVEL_MAXIMO))) erros.push(`tiers: faixa até ${faixa.ate} com tiers inválidos`);
  }
  if (TIERS.itemLevel?.at(-1)?.ate != null) erros.push('tiers: a última faixa de Item Level tem de ser a aberta (ate: null)');
  for (let n = 1; n <= NIVEL_MAXIMO; n++) if (!(TIERS.peso?.[String(n)] > 0)) erros.push(`tiers: T${n} sem peso`);
  for (const r of ORDEM) if (!(TIERS.viesDaRaridade?.[r] > 0)) erros.push(`tiers: ${r} sem viés`);
  for (const [id, a] of Object.entries(ATRIBUTOS)) {
    if (!['flat', 'pct'].includes(a.tipo)) erros.push(`atributos: ${id} com tipo "${a.tipo}"`);
    if (!(a.peso > 0)) erros.push(`atributos: ${id} sem peso`);
    let antes = null;
    // Add de valor pela RARIDADE da peça (`valorPorRaridade`): as faixas por tier só informam.
    if (a.valorPorRaridade) {
      for (const [r, v] of Object.entries(a.valorPorRaridade)) if (!ORDEM.includes(r) || !(v > 0)) erros.push(`atributos: ${id} valorPorRaridade ${r} inválido`);
      continue;
    }
    for (let n = 1; n <= NIVEL_MAXIMO; n++) {
      const f = a.niveis[String(n)];
      if (!f || !(f[0] <= f[1])) erros.push(`atributos: ${id} N${n} faixa inválida`);
      else if (antes && (f[0] < antes[0] || f[1] < antes[1] || (f[0] + f[1]) / 2 <= (antes[0] + antes[1]) / 2)) erros.push(`atributos: ${id} N${n} não é melhor que N${n - 1}`);
      antes = f;
    }
  }
  for (const [slot, pool] of Object.entries(POOLS)) {
    for (const id of pool) if (!ATRIBUTOS[id]) erros.push(`pools: ${slot} tem ${id}, que não existe`);
  }
  return erros;
}

const erros = validar();
if (erros.length) throw new Error(`Configuração de itens inválida:\n - ${erros.join('\n - ')}`);

/*
 * A régua de cada atributo passa a ser a NOVA: do mínimo do N1 ao máximo do N5.
 * `CATALOGO.afixos` é o que vai para o cliente (as estrelas e o balão leem dele)
 * e o que a forja usa para "onde o valor cai na régua": trocar aqui mantém os
 * dois lados na mesma conta. O `teto` (a essência vermelha, 130% da régua)
 * segue a mesma regra de antes.
 */
/**
 * A régua de ANTES do sistema de itens (`{id: {min, max}}`) — só para converter
 * as peças que já existiam (`systems/itens/item.mjs`): o valor antigo é lido
 * nela para achar o nível e reescalado para a faixa nova.
 */
export const REGUA_ANTIGA = Object.fromEntries(Object.entries(CATALOGO.afixos ?? {}).map(([id, f]) => [id, { min: f.antigoMin ?? f.min, max: f.antigoMax ?? f.max }]));

CATALOGO.afixos ??= {};
for (const [id, a] of Object.entries(ATRIBUTOS)) {
  // Add novo (STR, DEX, INT, Life...) ainda não tem ficha no catálogo do cliente: nasce aqui.
  const ficha = (CATALOGO.afixos[id] ??= { id, tipo: a.tipo });
  ficha.tipo = a.tipo;
  ficha.categoria = a.categoria;
  ficha.antigoMin ??= ficha.min;
  ficha.antigoMax ??= ficha.max;
  const min = a.niveis['1'][0];
  const max = a.niveis[String(NIVEL_MAXIMO)][1];
  Object.assign(ficha, { nome: a.nome, min, max, teto: min + 1.3 * (max - min), niveis: a.niveis });
}

// Os efeitos (nome, texto e números) vão no catálogo do `hello`: o balão do item monta o texto com eles.
// Achatados (condição + efeito): o texto de cada poder usa os números no primeiro nível ({danoPct}, {vidaAbaixo}...).
const achatar = (grupo) => Object.fromEntries(Object.entries(grupo ?? {}).filter(([k]) => !k.startsWith('_')).map(([id, d]) => [id, { ...d, ...(d.condicao ?? {}), ...(d.efeito ?? {}), ...(d.efeito?.acumuloAoMatar ?? {}) }]));
CATALOGO.efeitosDeItem = { lendario: achatar(EFEITOS.lendario), mitico: achatar(EFEITOS.mitico) };

/** Os tiers que o Item Level libera (`tiers.json`, `itemLevel`). */
export function tiersLiberados(itemLevel) {
  const il = Math.max(1, itemLevel ?? 1);
  return (TIERS.itemLevel.find((f) => f.ate == null || il <= f.ate) ?? TIERS.itemLevel.at(-1)).tiers;
}

/**
 * Sorteia o TIER de um add: entre os liberados pelo Item Level, pelo peso de
 * cada tier × viés^(tier−1) — o viés da raridade (× o do amuleto, se for).
 */
export function sortearTier(itemLevel, raridade, rng = Math.random, { amuleto = false } = {}) {
  const vies = (TIERS.viesDaRaridade[raridade] ?? 1) * (amuleto ? TIERS.viesDoAmuleto ?? 1 : 1);
  const tiers = tiersLiberados(itemLevel);
  const pesos = tiers.map((t) => TIERS.peso[String(t)] * vies ** (t - 1));
  let r = rng() * pesos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < tiers.length; i++) if ((r -= pesos[i]) < 0) return tiers[i];
  return tiers.at(-1);
}

/** O ato do drop (enquanto os atos não existem, sai do level da hunt). */
export function atoDoLevel(level) {
  for (const f of RARIDADES.atoPorLevel) if (f.ate == null || (level ?? 1) <= f.ate) return f.ato;
  return 1;
}

/** A dificuldade `degraus` acima de `d` (o boss usa a de cima), sem passar da última. */
export function dificuldadeAcima(d, degraus) {
  const i = DIFICULDADES.indexOf(d);
  return DIFICULDADES[Math.min(DIFICULDADES.length - 1, Math.max(0, i) + degraus)];
}

/**
 * A tabela de raridade do item para um mob de `raridadeDoMob`: o peso de cada raridade × `inclinacao[mob] ^ posicao[raridade]`,
 * NORMALIZADO para somar 100 (nunca passa de 100%, não importa o tamanho da inclinação). Mob normal (ou sem raridade) = a tabela do estágio.
 * Só a QUALIDADE: a quantidade de itens do mob é o `loot` de `mobs/raridades.json`, e o booster mexe só nela.
 */
export function inclinarTabela(tabela, raridadeDoMob) {
  const g = RARIDADES.mobs?.inclinacao?.[raridadeDoMob] ?? 1;
  if (g === 1) return tabela;
  const pos = RARIDADES.mobs?.posicao ?? {};
  const pesos = Object.fromEntries(ORDEM.map((r) => [r, (tabela[r] ?? 0) * g ** (pos[r] ?? 0)]));
  const total = ORDEM.reduce((s, r) => s + pesos[r], 0);
  return Object.fromEntries(ORDEM.map((r) => [r, (100 * pesos[r]) / total]));
}

/** A raridade mínima do equipamento que cai desta origem (`boss`, `bau`, `guardiao`; `raridades.json` → `minimaPorOrigem`), ou null. */
export const raridadeMinimaDe = (origem) => {
  const r = origem ? RARIDADES.minimaPorOrigem?.[origem] : null;
  return r && ORDEM.includes(r) ? r : null;
};

/** Os nomes para a tela ("Épico", "🟣"). */
export const nomeDaRaridade = (r) => RARIDADES.raridades[r]?.nome ?? r;
