// O CATÁLOGO dos bosses únicos: a definição de cada boss (dados), a validação e o registro.
//
// Um boss único NÃO é um monstro comum com atributos aumentados: tem id próprio, categoria, lore, atributos,
// melee, comportamentos e FASES DE COMBATE (a vida cruzando um percentual troca o que ele faz). Mas ele reaproveita
// o que o jogo já tem — o desenho/sprite, o loot e o nome vêm de uma criatura-BASE do bestiário (`base`), a luta
// roda no mesmo combate (`hunt.monstros`), as magias passam pela MESMA esquiva/proteção/escudo (`poderes.dispararMagia`).
//
// As CATEGORIAS são classificação de conteúdo, não sistemas de combate diferentes:
//   principal (campanha, pode ser obrigatório) · miniboss · secreto · evento · endgame.
// QUANDO e COM QUE CHANCE ele aparece não é do boss: é do ENCONTRO (`encontros/`: tipos `boss`, `miniboss`,
// `boss-secreto`, com probabilidade sorteada UMA vez por instância e condições).
//
// Comportamentos (v1): `magia`, `area-telegrafada` (aviso antes do dano), `invocar` (lacaios), `escudo`
// (vida extra temporária + janela de vulnerabilidade). Investida e zona perigosa ficam para a v2.
import { readFileSync } from 'node:fs';
import { BESTIARY } from '../hunt/monstros.mjs';
import { ITEM_CATALOG } from '../dados.mjs';

export const CATEGORIAS = ['principal', 'miniboss', 'secreto', 'evento', 'endgame'];
export const TIPOS_DE_COMPORTAMENTO = ['magia', 'area-telegrafada', 'invocar', 'escudo'];
// `chaos`: o elemento Caos do sistema de itens do PoE (decisão do dono, 04/10) — as resistências dos chefes pináculo.
const ELEMENTOS = ['physical', 'fire', 'ice', 'earth', 'energy', 'death', 'holy', 'lifedrain', 'manadrain', 'drown', 'chaos'];
/** Tetos que protegem o servidor (entidades e eventos por tique). */
export const LIMITES = { comportamentosPorFase: 8, fases: 6, maxVivosDeLacaios: 10, avisoMs: [500, 10_000], raio: 8 };

const DEFS = new Map();

const ok = (v) => Number.isFinite(Number(v));
const pos = (v) => ok(v) && Number(v) > 0;

function normalizarComportamento(c) {
  if (!c || typeof c !== 'object') return null;
  const o = { ...c, tipo: String(c.tipo ?? ''), intervaloMs: Number(c.intervaloMs ?? 5000), chance: c.chance == null ? 100 : Number(c.chance) };
  if (o.tipo === 'invocar') o.criaturas = (c.criaturas ?? []).map((x) => ({ key: String(x.key), qtd: Number(x.qtd ?? 1) }));
  return o;
}

/** A definição completa, com os padrões preenchidos. Não valida (`validar` faz isso). */
export function normalizar(d) {
  if (!d || typeof d !== 'object') return null;
  const comps = (l) => (Array.isArray(l) ? l.map(normalizarComportamento).filter(Boolean) : []);
  return {
    id: String(d.id ?? ''),
    nome: String(d.nome ?? d.id ?? ''),
    descricao: d.descricao != null ? String(d.descricao) : '',
    lore: d.lore != null ? String(d.lore) : '',
    categoria: String(d.categoria ?? ''),
    base: String(d.base ?? ''),
    nivel: d.nivel != null ? Number(d.nivel) : null,
    atributos: { ...(d.atributos ?? {}) },
    melee: d.melee ? { min: Number(d.melee.min), max: Number(d.melee.max), intervaloMs: Number(d.melee.intervaloMs ?? 2000) } : null,
    usaPoderesDoBase: d.usaPoderesDoBase === true,
    // Padrão: o chefe vai na escala da fase (vida/dano/exp) como todo bicho da campanha.
    usaEscalaDaFase: d.usaEscalaDaFase !== false,
    comportamentos: comps(d.comportamentos),
    fases: (Array.isArray(d.fases) ? d.fases : []).map((f) => ({
      nome: String(f?.nome ?? ''),
      ate: Number(f?.ate),
      mods: { ...(f?.mods ?? {}) },
      aoEntrar: { ...(f?.aoEntrar ?? {}) },
      comportamentos: comps(f?.comportamentos),
    })),
    recompensas: { loot: d.recompensas?.loot ?? [], primeiraVitoria: d.recompensas?.primeiraVitoria ?? null },
  };
}

function errosDoComportamento(c, onde, erros) {
  if (!TIPOS_DE_COMPORTAMENTO.includes(c.tipo)) return void erros.push(`${onde}: comportamento "${c.tipo}" desconhecido.`);
  if (!(c.intervaloMs >= 500)) erros.push(`${onde}: intervaloMs mínimo é 500.`);
  if (!(c.chance >= 0 && c.chance <= 100)) erros.push(`${onde}: chance entre 0 e 100.`);
  const ataque = () => {
    if (!ELEMENTOS.includes(c.elemento)) erros.push(`${onde}: elemento "${c.elemento}" desconhecido.`);
    if (!(ok(c.min) && ok(c.max) && Number(c.min) >= 0 && Number(c.min) <= Number(c.max))) erros.push(`${onde}: dano precisa de min >= 0 e min <= max.`);
  };
  if (c.tipo === 'magia') {
    ataque();
    if (c.forma != null && !['alvo', 'area', 'feixe'].includes(c.forma)) erros.push(`${onde}: forma "${c.forma}" desconhecida.`);
    if (c.raio != null && !(Number(c.raio) >= 0 && Number(c.raio) <= LIMITES.raio)) erros.push(`${onde}: raio de 0 a ${LIMITES.raio}.`);
  }
  if (c.tipo === 'area-telegrafada') {
    ataque();
    if (!(Number(c.avisoMs) >= LIMITES.avisoMs[0] && Number(c.avisoMs) <= LIMITES.avisoMs[1])) erros.push(`${onde}: avisoMs de ${LIMITES.avisoMs[0]} a ${LIMITES.avisoMs[1]} (tem de dar tempo de ver e de sair).`);
    if (!(Number(c.raio) >= 0 && Number(c.raio) <= LIMITES.raio)) erros.push(`${onde}: raio de 0 a ${LIMITES.raio}.`);
  }
  if (c.tipo === 'invocar') {
    if (!c.criaturas?.length) erros.push(`${onde}: invocar precisa de criaturas.`);
    for (const x of c.criaturas ?? []) {
      if (!BESTIARY[x.key]) erros.push(`${onde}: "${x.key}" não é um monstro do bestiário.`);
      if (!(Number.isInteger(x.qtd) && x.qtd >= 1 && x.qtd <= 5)) erros.push(`${onde}: qtd de 1 a 5 por invocação.`);
    }
    if (!(Number.isInteger(c.maxVivos) && c.maxVivos >= 1 && c.maxVivos <= LIMITES.maxVivosDeLacaios)) erros.push(`${onde}: maxVivos de 1 a ${LIMITES.maxVivosDeLacaios} (limite do servidor).`);
  }
  if (c.tipo === 'escudo') {
    if (!(pos(c.pctVida) && Number(c.pctVida) <= 100)) erros.push(`${onde}: pctVida de 1 a 100.`);
    if (!pos(c.duracaoMs)) erros.push(`${onde}: duracaoMs precisa ser positivo.`);
    if (c.vulnerabilidade && !(pos(c.vulnerabilidade.pct) && pos(c.vulnerabilidade.ms))) erros.push(`${onde}: vulnerabilidade precisa de pct e ms positivos.`);
  }
}

/** Os erros de uma definição (vazia = pode registrar). */
export function validar(bruto) {
  const d = normalizar(bruto);
  const erros = [];
  if (!d?.id) return ['boss sem id.'];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(d.id)) erros.push(`${d.id}: id só aceita minúsculas, números e hífen.`);
  if (!d.nome) erros.push(`${d.id}: sem nome.`);
  if (!CATEGORIAS.includes(d.categoria)) erros.push(`${d.id}: categoria "${d.categoria}" desconhecida (${CATEGORIAS.join(', ')}).`);
  if (!BESTIARY[d.base]) erros.push(`${d.id}: base "${d.base}" não é um monstro do bestiário (o desenho e o loot vêm dela).`);
  const a = d.atributos;
  for (const k of ['vida', 'vidaMult', 'danoMult', 'expMult']) if (a[k] != null && !(Number(a[k]) > 0)) erros.push(`${d.id}: atributos.${k} precisa ser positivo.`);
  if (a.armadura != null && !(Number(a.armadura) >= 0)) erros.push(`${d.id}: atributos.armadura inválida.`);
  for (const [el, v] of Object.entries(a.resistencias ?? {})) if (!ELEMENTOS.includes(el) || !ok(v)) erros.push(`${d.id}: resistência "${el}" inválida.`);
  if (d.melee && !(ok(d.melee.min) && ok(d.melee.max) && d.melee.min >= 0 && d.melee.min <= d.melee.max)) erros.push(`${d.id}: melee precisa de min >= 0 e min <= max.`);
  if (d.comportamentos.length > LIMITES.comportamentosPorFase) erros.push(`${d.id}: no máximo ${LIMITES.comportamentosPorFase} comportamentos por fase.`);
  d.comportamentos.forEach((c, i) => errosDoComportamento(c, `${d.id}.comportamentos[${i}]`, erros));
  if (d.fases.length > LIMITES.fases) erros.push(`${d.id}: no máximo ${LIMITES.fases} fases.`);
  let anterior = 100;
  d.fases.forEach((f, i) => {
    const onde = `${d.id}.fases[${i}]`;
    if (!(f.ate > 0 && f.ate < anterior)) erros.push(`${onde}: "ate" (% de vida) precisa ficar entre 0 e ${anterior} (as fases vão da vida cheia para a vazia, cada uma abaixo da anterior).`);
    anterior = f.ate;
    if (f.comportamentos.length > LIMITES.comportamentosPorFase) erros.push(`${onde}: no máximo ${LIMITES.comportamentosPorFase} comportamentos.`);
    f.comportamentos.forEach((c, j) => errosDoComportamento(c, `${onde}.comportamentos[${j}]`, erros));
    if (f.mods.danoMult != null && !(Number(f.mods.danoMult) > 0)) erros.push(`${onde}: mods.danoMult inválido.`);
    if (f.aoEntrar.escudo) errosDoComportamento({ tipo: 'escudo', intervaloMs: 500, chance: 100, ...f.aoEntrar.escudo }, `${onde}.aoEntrar.escudo`, erros);
    if (f.aoEntrar.invocar) errosDoComportamento({ tipo: 'invocar', intervaloMs: 500, chance: 100, maxVivos: 1, ...f.aoEntrar.invocar }, `${onde}.aoEntrar.invocar`, erros);
  });
  for (const drop of d.recompensas.loot) {
    if (!ITEM_CATALOG[drop?.id]) erros.push(`${d.id}: item ${drop?.id} do loot não existe no catálogo.`);
    if (!(Number(drop?.chance) > 0 && Number(drop.chance) <= 100)) erros.push(`${d.id}: chance do item ${drop?.id} entre 0 e 100 (%).`);
  }
  const pv = d.recompensas.primeiraVitoria;
  if (pv) {
    for (const it of pv.itens ?? []) if (!ITEM_CATALOG[it?.id] || !(Number(it.count) >= 1)) erros.push(`${d.id}: item ${it?.id} da primeira vitória inválido.`);
    if (pv.gold != null && !(Number(pv.gold) >= 0)) erros.push(`${d.id}: gold da primeira vitória inválido.`);
  }
  return erros;
}

/** Registra um boss (lança se a definição é inválida: conteúdo errado não entra no jogo). */
export function registrar(bruto) {
  const erros = validar(bruto);
  if (erros.length) throw new Error(erros.join(' '));
  const d = normalizar(bruto);
  DEFS.set(d.id, d);
  return d;
}

export const bossUnico = (id) => DEFS.get(id) ?? null;
export const todos = () => [...DEFS.values()];
/** Só os testes: tira um boss registrado. */
export const esquecer = (id) => DEFS.delete(id);

// O arquivo de dados (vazio hoje): cada definição é validada ao carregar.
const ARQUIVO = JSON.parse(readFileSync(new URL('../../gamedata/bosses-unicos.json', import.meta.url), 'utf8'));
export const ERROS_DO_ARQUIVO = [];
for (const d of Object.values(ARQUIVO.bosses ?? {})) {
  const erros = validar(d);
  if (erros.length) ERROS_DO_ARQUIVO.push(...erros);
  else DEFS.set(String(d.id), normalizar(d));
}
