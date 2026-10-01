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
//   armadura → `armor`;  resistência → `resist` (somada em `resistenciaDe`)
//   passo    → `velocidade` (em `passoDoBicho`);  golpe → `velocidadeDeAtaque`
//   regeneração → `regen` (% da vida por segundo, no tique dos estados)
//   elite/boss → `elite`/`chefe` (os adds "Damage vs Elite/Boss" do jogador)
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
  const t = { vidaPct: 0, danoPct: 0, armaduraPct: 0, velocidadePct: 0, velocidadeDeAtaquePct: 0, regenPct: 0, resist: {} };
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
  if (st.armaduraPct) m.armor = Math.round((m.armor ?? 0) * (1 + st.armaduraPct / 100));
  if (st.velocidadePct) m.velocidade = 1 + st.velocidadePct / 100;
  if (st.velocidadeDeAtaquePct) m.velocidadeDeAtaque = 1 + st.velocidadeDeAtaquePct / 100;
  if (st.regenPct) m.regen = st.regenPct;
  if (Object.keys(st.resist).length) m.resist = st.resist;
  if (r.elite) m.elite = true;
  if (r.boss) m.chefe = true;
  return m;
}

/** As mecânicas do mob (lidas dos dados dos modificadores dele). */
export const mecanicasDe = (m) => (m?.mods ?? []).flatMap((id) => (MODIFICADORES[id]?.mecanicas ?? []).map((x) => ({ ...x, modificador: id })));

/** O que vai para a tela junto com o mob: a raridade e os NOMES dos modificadores. */
export function paraCliente(m) {
  if (!m?.raridade) return {};
  return { raridade: m.raridade, ...(m.mods?.length ? { mods: m.mods.map((id) => MODIFICADORES[id]?.nome ?? id) } : {}) };
}

/** A configuração de cores que o cliente usa para pintar o nome (vai no welcome). */
export const coresParaCliente = () => Object.fromEntries(Object.entries(CONFIG.raridades).map(([id, r]) => [id, { nome: r.nome, cor: r.cor }]));
