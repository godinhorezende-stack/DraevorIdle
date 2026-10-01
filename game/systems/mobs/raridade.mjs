// A RARIDADE e os MODIFICADORES dos mobs (pedido do dono, 01/10).
//
// O mob da instância = o do bestiário (`criarMonstro`) × a escala da
// dificuldade (`Campanha.aplicarEscala`) × a RARIDADE × os MODIFICADORES. Tudo
// entra nos MESMOS campos que o combate já lê — não há um segundo sistema de
// dano para mob modificado:
//   vida     → `maxHp`/`hp`
//   dano     → `forca` (o `Reforcos.forcaDoBicho` de todo golpe e magia do mob)
//   exp      → `exp` (e `expMult`, para o level do mob não subir com a raridade)
//   loot     → `lootMult` (× a chance de cada drop, em `matarMonstro`)
//   resistência → `resist` (somada em `resistenciaDe`; a armadura do mob não entra em conta nenhuma do dano)
//   passo    → `velocidade` (em `passoDoBicho`);  golpe → `velocidadeDeAtaque`
//   regeneração → `regen` (% da vida por segundo, no tique dos estados)
//   elite/boss → `elite`/`chefe` (os adds "Damage vs Elite/Boss" do jogador)
//   level    → `levelExtra` (somado ao level do mob: Accuracy/Evasion e o Lv da tela)
// As MECÂNICAS (ao morrer explode, gera mobs...) ficam nos dados do
// modificador: o mob guarda só os ids (`mods`), e `mecanicas.mjs` as lê na hora.
//
// Decisão do dono: NADA é sorteado — a raridade e os modificadores vêm do
// SPAWN do mapa (`raridade`, `modificadores`; o `tipo` de antes vira raridade).
import { readFileSync } from 'node:fs';

const ler = (arq) => JSON.parse(readFileSync(new URL(`../../gamedata/mobs/${arq}`, import.meta.url), 'utf8'));
export const CONFIG = ler('raridades.json');
export const MODIFICADORES = ler('modificadores.json').modificadores;
export const RARIDADES = Object.keys(CONFIG.raridades);

/** A raridade e os modificadores que um SPAWN do mapa dá (`{ raridade, modificadores }`). */
export function doSpawn(s) {
  let raridade = RARIDADES.includes(s?.raridade) ? s.raridade : (CONFIG.tipoDoSpawn[s?.tipo] ?? 'normal');
  const pedidos = [...new Set(Array.isArray(s?.modificadores) ? s.modificadores : [])].filter((id) => MODIFICADORES[id]);
  // Mob normal com modificador vira "modificado" (o nome muda de cor: esse é diferente).
  if (raridade === 'normal' && pedidos.length) raridade = CONFIG.modificadoSemRaridade;
  const max = CONFIG.raridades[raridade]?.maxModificadores ?? 0;
  return { raridade, modificadores: pedidos.slice(0, max) };
}

/** Os erros da raridade/modificadores de um spawn (para o editor de mapas e a validação dos spawns). */
export function errosDoSpawn(s) {
  const erros = [];
  if (s?.raridade != null && !RARIDADES.includes(s.raridade)) erros.push(`raridade desconhecida: ${s.raridade}`);
  for (const id of s?.modificadores ?? []) if (!MODIFICADORES[id]) erros.push(`modificador desconhecido: ${id}`);
  const { raridade, modificadores } = doSpawn(s);
  if ((s?.modificadores?.length ?? 0) > modificadores.length && (s.modificadores ?? []).every((id) => MODIFICADORES[id])) {
    erros.push(`a raridade ${raridade} aceita até ${CONFIG.raridades[raridade].maxModificadores} modificadores`);
  }
  return erros;
}

/** A soma dos stats dos modificadores. */
export function statsDos(ids) {
  const t = { vidaPct: 0, danoPct: 0, velocidadePct: 0, velocidadeDeAtaquePct: 0, regenPct: 0, resist: {} };
  for (const id of ids ?? []) {
    const s = MODIFICADORES[id]?.stats ?? {};
    for (const k of Object.keys(t)) if (k !== 'resist' && Number.isFinite(s[k])) t[k] += s[k];
    for (const [el, v] of Object.entries(s.resist ?? {})) t.resist[el] = (t.resist[el] ?? 0) + v;
  }
  return t;
}

/**
 * Aplica a raridade e os modificadores no mob da instância (muta e devolve).
 * Mob normal sem modificador não ganha campo nenhum (o banco não cresce à toa).
 */
export function aplicar(m, { raridade = 'normal', modificadores = [] } = {}) {
  if (!m) return m;
  const r = CONFIG.raridades[raridade] ?? CONFIG.raridades.normal;
  const mods = modificadores.filter((id) => MODIFICADORES[id]);
  if (raridade === 'normal' && !mods.length) return m;
  const st = statsDos(mods);
  m.raridade = raridade;
  if (mods.length) m.mods = mods;
  m.maxHp = Math.max(1, Math.round((m.maxHp ?? m.hp) * r.vida * (1 + st.vidaPct / 100)));
  m.hp = m.maxHp;
  const forca = (m.forca ?? 1) * r.dano * (1 + st.danoPct / 100);
  if (forca !== 1) m.forca = forca;
  if (r.exp !== 1) {
    m.exp = Math.max(0, Math.round((m.exp ?? 0) * r.exp));
    m.expMult = r.exp;
  }
  if (r.loot !== 1) m.lootMult = r.loot;
  if (st.velocidadePct) m.velocidade = 1 + st.velocidadePct / 100;
  if (st.velocidadeDeAtaquePct) m.velocidadeDeAtaque = 1 + st.velocidadeDeAtaquePct / 100;
  if (st.regenPct) m.regen = st.regenPct;
  if (Object.keys(st.resist).length) m.resist = st.resist;
  if (r.elite) m.elite = true;
  if (r.boss) m.chefe = true;
  // Levels a mais (somados em `Atributos.levelDoBicho`: valem na Accuracy/Evasion e no Lv da tela).
  if (r.levelExtra) m.levelExtra = r.levelExtra;
  return m;
}

/** As mecânicas do mob (lidas dos dados dos modificadores dele). */
export const mecanicasDe = (m) => (m?.mods ?? []).flatMap((id) => (MODIFICADORES[id]?.mecanicas ?? []).map((x) => ({ ...x, modificador: id })));

/** O que vai para a tela junto com o mob: a raridade e os NOMES dos modificadores. */
export function paraCliente(m) {
  if (!m?.raridade) return {};
  return {
    raridade: m.raridade,
    ...(m.mods?.length ? { mods: m.mods.map((id) => MODIFICADORES[id]?.nome ?? id) } : {}),
    // Os levels a mais da raridade (o balão mostra "Lv 20 (8 +12)").
    ...(m.levelExtra ? { lvExtra: m.levelExtra } : {}),
  };
}

/** A configuração de cores que o cliente usa para pintar o nome (vai no welcome). */
export const coresParaCliente = () => Object.fromEntries(Object.entries(CONFIG.raridades).map(([id, r]) => [id, { nome: r.nome, cor: r.cor, resumo: resumoDaRaridade(r) }]));

/** "vida ×2 · dano ×1,3 · exp ×3 · loot ×2" — o que a raridade muda (para o tooltip do mob). */
function resumoDaRaridade(r) {
  const x = (v) => `×${String(Math.round(v * 100) / 100).replace('.', ',')}`;
  const partes = [['vida', r.vida], ['dano', r.dano], ['exp', r.exp], ['loot', r.loot]].filter(([, v]) => Number.isFinite(v) && v !== 1).map(([k, v]) => `${k} ${x(v)}`);
  if (r.levelExtra) partes.push(`Lv +${r.levelExtra}`);
  return partes.join(' · ');
}

// ---- O TEXTO de cada modificador (fase 3): gerado dos MESMOS dados que o motor usa ----
// Nada escrito à mão por modificador: mudou o número no JSON, mudou o texto. O
// tooltip do mob no jogo e o editor de mapas mostram estas frases.
const NOME_DO_ELEMENTO = { physical: 'físico', fire: 'fogo', ice: 'gelo', energy: 'energia', earth: 'terra', holy: 'sagrado', death: 'morte' };
const pct = (v) => `${v > 0 ? '+' : ''}${String(v).replace('.', ',')}%`;
const seg = (ms) => `${String((ms ?? 0) / 1000).replace('.', ',')} s`;
const casas = (n) => `${n} ${n === 1 ? 'casa' : 'casas'}`;

function textoDaResistencia(resist) {
  const pares = Object.entries(resist ?? {});
  if (!pares.length) return null;
  const valores = new Set(pares.map(([, v]) => v));
  if (pares.length >= 7 && valores.size === 1) return `${pct(pares[0][1])} de resistência a tudo`;
  return pares.map(([el, v]) => `${pct(v)} de resistência a ${NOME_DO_ELEMENTO[el] ?? el}`).join(', ');
}

function textoDosStats(s = {}) {
  const partes = [];
  if (s.vidaPct) partes.push(`${pct(s.vidaPct)} de vida`);
  if (s.danoPct) partes.push(`${pct(s.danoPct)} de dano`);
  if (s.velocidadePct) partes.push(`${pct(s.velocidadePct)} de velocidade`);
  if (s.velocidadeDeAtaquePct) partes.push(`${pct(s.velocidadeDeAtaquePct)} de velocidade de ataque`);
  if (s.regenPct) partes.push(`regenera ${String(s.regenPct).replace('.', ',')}% da vida por segundo`);
  const r = textoDaResistencia(s.resist);
  if (r) partes.push(r);
  return partes;
}

function textoDaMecanica(m) {
  const el = NOME_DO_ELEMENTO[m.elemento] ?? m.elemento;
  const ganho = [m.danoPct && `${pct(m.danoPct)} de dano`, m.velocidadeDeAtaquePct && `${pct(m.velocidadeDeAtaquePct)} de velocidade de ataque`, textoDaResistencia(m.resist)].filter(Boolean).join(' e ');
  switch (`${m.gatilho}:${m.efeito}`) {
    case 'aoMorrer:explosao':
      return `Ao morrer, explode: ${m.danoPctDaVida}% da vida dele em dano de ${el} a até ${casas(m.raio ?? 1)}`;
    case 'aoMorrer:gerar':
      return `Ao morrer, gera ${m.quantidade ?? 1} ${m.mesmaCriatura === false ? 'criaturas' : 'cópias menores'} (${m.vidaPct ?? 50}% da vida), que contam na limpeza`;
    case 'vidaBaixa:enrage':
      return `Com ${m.limitePct ?? 30}% de vida ou menos, se enfurece: ${ganho} até morrer`;
    case 'aliadoMorreu:buff':
      return `Quando um aliado morre a até ${casas(m.raio ?? 4)}: ${ganho} por ${seg(m.duracaoMs)}`;
    case 'aoReceberDano:buff':
      return `Cada dano recebido dá ${ganho} por ${seg(m.duracaoMs)}${m.acumulaAte > 1 ? ` (acumula até ${m.acumulaAte}×)` : ''}`;
    case 'aoReceberDano:refletir':
      return `Devolve ${m.pct ?? 10}% do dano ${(m.tipos ?? []).map((t) => NOME_DO_ELEMENTO[t] ?? t).join('/')} recebido`;
    case 'aoAtacar:debuff':
      return `${m.chance ?? 100}% de chance no golpe de deixar ${m.danoPctDoGolpe ?? 30}% do dano em ${el} ao longo de ${seg(m.duracaoMs)}`;
    case 'aura:areaDeDano':
      return `Aura: ${String(m.danoPctDaVida).replace('.', ',')}% da vida dele em dano de ${el} a cada ${seg(m.intervaloMs ?? 1000)}, a até ${casas(m.raio ?? 1)}`;
    default:
      return null;
  }
}

/** A descrição de um modificador (as frases dos stats e das mecânicas). */
export function descricaoDe(id) {
  const m = MODIFICADORES[id];
  if (!m) return '';
  const stats = textoDosStats(m.stats);
  const linhas = [...(stats.length ? [stats.join(', ')] : []), ...(m.mecanicas ?? []).map(textoDaMecanica).filter(Boolean)];
  return linhas.map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join('. ');
}

/** O texto dos modificadores para a tela, pelo NOME (o que o mob leva no quadro). */
export const modificadoresParaCliente = () => Object.fromEntries(Object.values(MODIFICADORES).map((m, i) => [m.nome, descricaoDe(Object.keys(MODIFICADORES)[i])]));

/** O que o editor de mapas precisa: raridades (cor, teto de modificadores) e modificadores (id, nome, descrição). */
export const opcoesParaEditor = () => ({
  raridades: Object.entries(CONFIG.raridades).map(([id, r]) => ({ id, nome: r.nome, cor: r.cor, maxModificadores: r.maxModificadores ?? 0 })),
  modificadores: Object.entries(MODIFICADORES).map(([id, m]) => ({ id, nome: m.nome, descricao: descricaoDe(id) })),
  // O `tipo` antigo do spawn (elite, miniboss...) vira raridade: o editor mostra o mesmo que o jogo faz.
  tipoDoSpawn: CONFIG.tipoDoSpawn,
});
