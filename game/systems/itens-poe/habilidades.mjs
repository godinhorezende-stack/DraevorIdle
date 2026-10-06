// As HABILIDADES dos chefes do PoE como comportamentos do Draevor (sistema de itens do PoE — só com ITENS_POE=1).
//
// Os dados vêm do poedb (`tools/extrair-poedb-atos.mjs` → `campanha-poe.json`: `habilidades` de cada chefe, com o dano NO NÍVEL da área,
// o elemento das magias, o tempo e a recarga). Conversão:
//   magia com dano (tags Spell, ou elemento na linha "Causa X a Y de Dano de <Elemento>") → `magia` (no jogador; em área com a tag Area,
//     em linha se for laser/lança/raio);
//   ataque de impacto em área (Slam, Leap, Mortar, Upheaval, Flood, Smash, Nova…) → `area-telegrafada` (a área avisa antes do golpe);
//   invocação (Summon, Animate, Spawn, Minion) → `invocar` (os monstros comuns da área);
//   movimento sem dano (Teleport, Dash, Backflip, Emerge…) e o ataque padrão (é o corpo a corpo) → ficam de fora.
// O DANO: o do poedb no nível não inclui o multiplicador do monstro nem o bônus de Único (o próprio site avisa); vale a mesma proporção
// entre o golpe corpo a corpo do chefe (já com tudo) e o "Ataque Padrão" dele — nas magias sem o "33% menos dano de ataque" do Único.
// O RITMO: a recarga do PoE; sem recarga, 3× o tempo de uso (no mínimo 4 s), para o chefe alternar com o corpo a corpo.

const ELEMENTOS = new Set(['physical', 'fire', 'ice', 'energy', 'chaos']);
const MOVIMENTO = /teleport|dash|backflip|emerge|jump(?!slam)|leapback|charge(?!d)|blink|flicker|warp|phase/i;
const IMPACTO = /slam|leap|mortar|upheaval|flood|smash|quake|nova|stomp|groundpound|eruption|explo|burst|pound|cleave|whirl|spin/i;
const INVOCACAO = /summon|animate|spawn|minion|raise|totem|statue/i;
const FEIXE = /laser|lance|beam|ray|tendril|lightningsoul/i;

/** O fator de dano das habilidades: o golpe corpo a corpo do chefe ÷ o "Ataque Padrão" dele no poedb (1 sem ataque padrão). */
export function fatorDeDano(monstro) {
  const padrao = (monstro.habilidades ?? []).find((h) => /^Ataque Padrão$|^Melee$/i.test(h.nome ?? '') || h.interno === 'Melee');
  const media = padrao?.dano ? (padrao.dano.min + padrao.dano.max) / 2 : 0;
  return media > 0 && monstro.dano > 0 ? monstro.dano / media : 1;
}

/** Uma habilidade convertida: `{ tipo: 'magia'|'area'|'invocar', ... }` ou null (fica de fora). */
export function converter(h, fator = 1) {
  const nome = `${h.interno ?? ''} ${h.nome ?? ''}`;
  if (/^Ataque Padrão$/i.test(h.nome ?? '') || h.interno === 'Melee') return null;
  const tags = (h.tags ?? []).map((t) => t.toLowerCase());
  if (INVOCACAO.test(nome) && !h.dano) return { tipo: 'invocar', nome: h.nome ?? h.interno, intervaloMs: Math.max(8000, (h.recarga ?? 12) * 1000) };
  if (!h.dano || (MOVIMENTO.test(nome) && !IMPACTO.test(nome))) return null;
  const magia = tags.includes('spell') || !!h.elemento;
  const f = magia ? fator / 0.67 : fator; // as magias não levam o "33% menos dano de ataque" do Único
  const min = Math.max(1, Math.round(h.dano.min * f));
  const max = Math.max(min, Math.round(h.dano.max * f));
  const elemento = ELEMENTOS.has(h.elemento) ? h.elemento : 'physical';
  const intervaloMs = Math.max(4000, Math.round((h.recarga ?? (h.tempo ?? 1.5) * 3) * 1000));
  const emArea = tags.includes('area') || IMPACTO.test(nome);
  if (!magia && emArea) return { tipo: 'area', nome: h.nome ?? h.interno, elemento, min, max, raio: /flood|upheaval|quake|nova/i.test(nome) ? 3 : 2, avisoMs: 1200, intervaloMs };
  if (!magia && !emArea) return null; // ataque de alvo único: o corpo a corpo já representa
  return { tipo: 'magia', nome: h.nome ?? h.interno, elemento, min, max, forma: FEIXE.test(nome) ? 'feixe' : emArea ? 'area' : 'alvo', raio: emArea ? 2 : 0, intervaloMs };
}

/** As habilidades convertidas de um chefe (até `maximo`, sem repetir o mesmo dano/elemento). */
export function convertidas(monstro, maximo = 6) {
  const fator = fatorDeDano(monstro);
  const vistas = new Set();
  const lista = [];
  for (const h of monstro.habilidades ?? []) {
    const c = converter(h, fator);
    if (!c) continue;
    const chave = `${c.tipo}:${c.elemento ?? ''}:${c.min ?? ''}:${c.max ?? ''}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    lista.push(c);
    if (lista.length >= maximo) break;
  }
  return lista;
}

// ---- O AJUSTE da Engine (aba Mobs → Ataques e efeitos), por monstro (slug): `{ basico: { efeito }, habilidades: { [nome]: { ativo, elemento, forma, raio,
// comprimento, intervaloMs, efeito, tiro, fatorDano } }, novas: [{ nome, elemento, forma, raio, comprimento, intervaloMs, efeito, tiro, pctDoGolpe }] }`.
// O dano continua o do PoE no nível de cada área (× `fatorDano`); a habilidade NOVA bate `pctDoGolpe`% do golpe do monstro naquele nível (±20%).
export const ELEMENTOS_DO_AJUSTE = ['physical', 'fire', 'ice', 'energy', 'chaos'];
export const FORMAS = ['alvo', 'area', 'feixe'];
const CAMPOS_VISUAIS = ['elemento', 'forma', 'raio', 'comprimento', 'intervaloMs', 'efeito', 'tiro'];
/** As habilidades convertidas com o ajuste aplicado (as desligadas saem; as novas entram). */
export function comAjuste(monstro, ajuste, maximo = 6) {
  const lista = convertidas(monstro, maximo).flatMap((c) => {
    const a = ajuste?.habilidades?.[c.nome];
    if (!a) return [c];
    if (a.ativo === false) return [];
    const f = Number(a.fatorDano ?? 1);
    const novo = { ...c, ...Object.fromEntries(CAMPOS_VISUAIS.filter((k) => a[k] != null).map((k) => [k, a[k]])) };
    if (c.min != null) Object.assign(novo, { min: Math.max(1, Math.round(c.min * f)), max: Math.max(1, Math.round(c.max * f)) });
    if (novo.tipo !== 'invocar' && novo.forma === 'feixe' && !novo.comprimento) novo.comprimento = 5;
    return [{ ...novo, ajustada: true }];
  });
  for (const n of ajuste?.novas ?? []) {
    const base = (Number(monstro.dano) || 1) * (Number(n.pctDoGolpe ?? 100) / 100);
    lista.push({ tipo: n.forma === 'area' && n.noAlvo ? 'area' : 'magia', nome: n.nome || 'Habilidade nova', elemento: n.elemento ?? 'physical', min: Math.max(1, Math.round(base * 0.8)), max: Math.max(1, Math.round(base * 1.2)), forma: n.forma ?? 'alvo', raio: Number(n.raio ?? 0), comprimento: Number(n.comprimento ?? (n.forma === 'feixe' ? 5 : 0)), intervaloMs: Number(n.intervaloMs ?? 6000), avisoMs: 1200, ...(n.efeito != null ? { efeito: n.efeito } : {}), ...(n.tiro != null ? { tiro: n.tiro } : {}), nova: true });
  }
  return lista;
}

/** Valida um ajuste de ataques. `{ ok, ajuste?, erros? }` (o ajuste limpo). */
export function validarAjuste(aj) {
  const erros = [];
  const inteiroOuNada = (v, min, max, rot) => {
    if (v == null || v === '') return undefined;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) erros.push(`${rot}: inteiro de ${min} a ${max}.`);
    return n;
  };
  const visuais = (x, onde) => {
    const o = {};
    if (x.elemento != null) { if (!ELEMENTOS_DO_AJUSTE.includes(x.elemento)) erros.push(`${onde}: elemento "${x.elemento}" desconhecido.`); o.elemento = x.elemento; }
    if (x.forma != null) { if (!FORMAS.includes(x.forma)) erros.push(`${onde}: forma "${x.forma}" desconhecida.`); o.forma = x.forma; }
    for (const [k, mn, mx] of [['raio', 0, 8], ['comprimento', 0, 10], ['efeito', 1, 999], ['tiro', 1, 999]]) { const v = inteiroOuNada(x[k], mn, mx, `${onde}: ${k}`); if (v !== undefined) o[k] = v; }
    const ms = inteiroOuNada(x.intervaloMs, 500, 60000, `${onde}: intervalo (ms)`);
    if (ms !== undefined) o.intervaloMs = ms;
    return o;
  };
  const saida = {};
  const ef = inteiroOuNada(aj?.basico?.efeito, 1, 999, 'Golpe básico: efeito');
  if (ef !== undefined) saida.basico = { efeito: ef };
  const habs = {};
  for (const [nome, x] of Object.entries(aj?.habilidades ?? {})) {
    const o = visuais(x ?? {}, `"${nome}"`);
    if (x?.ativo === false) o.ativo = false;
    if (x?.fatorDano != null) { const f = Number(x.fatorDano); if (!(f > 0 && f <= 10)) erros.push(`"${nome}": força de 0,01× a 10×.`); else o.fatorDano = f; }
    if (Object.keys(o).length) habs[nome] = o;
  }
  if (Object.keys(habs).length) saida.habilidades = habs;
  const novas = (aj?.novas ?? []).map((n, i) => {
    const o = { nome: String(n?.nome ?? `Habilidade ${i + 1}`).slice(0, 40), ...visuais(n ?? {}, `Nova ${i + 1}`) };
    const pct = Number(n?.pctDoGolpe ?? 100);
    if (!(pct >= 1 && pct <= 1000)) erros.push(`Nova ${i + 1}: força de 1% a 1000% do golpe.`);
    o.pctDoGolpe = pct;
    if (n?.noAlvo) o.noAlvo = true;
    return o;
  });
  if (novas.length) saida.novas = novas;
  return erros.length ? { ok: false, erros } : { ok: true, ajuste: saida };
}

/** Os COMPORTAMENTOS de boss único (chefe de ato): `invocavel` = as chaves de bestiário que a invocação usa. `ajuste`: o da aba Mobs (ataques e efeitos). */
export function comportamentos(monstro, invocavel = [], ajuste = null) {
  return comAjuste(monstro, ajuste).flatMap((c) => {
    const visual = { ...(c.efeito != null ? { efeito: c.efeito } : {}), ...(c.tiro != null ? { tiro: c.tiro } : {}) };
    if (c.tipo === 'magia') return [{ tipo: 'magia', nome: c.nome, elemento: c.elemento, min: c.min, max: c.max, forma: c.forma, raio: c.raio, ...(c.comprimento ? { comprimento: c.comprimento } : {}), intervaloMs: c.intervaloMs, chance: 100, alcance: 7, ...visual }];
    if (c.tipo === 'area') return [{ tipo: 'area-telegrafada', nome: c.nome, elemento: c.elemento, min: c.min, max: c.max, raio: c.raio, avisoMs: c.avisoMs ?? 1200, intervaloMs: c.intervaloMs, chance: 100, ...visual }];
    if (c.tipo === 'invocar' && invocavel.length) return [{ tipo: 'invocar', nome: c.nome, criaturas: [{ key: invocavel[0], qtd: 2 }], maxVivos: 4, intervaloMs: c.intervaloMs, chance: 100 }];
    return [];
  });
}

/** Os PODERES de magia de um monstro comum/único (o formato dos poderes dos bichos — `poderes.mjs`): magias e áreas, no alcance. `ajuste`: o da aba Mobs. */
export function poderes(monstro, ajuste = null) {
  return comAjuste(monstro, ajuste, 4).flatMap((c) => {
    if (c.tipo === 'invocar') return [];
    const area = c.tipo === 'area' || c.forma === 'area';
    const feixe = c.forma === 'feixe';
    return [{ tipo: 'magia', elemento: c.elemento, min: c.min, max: c.max, intervalo: c.intervaloMs, chance: 100, forma: area ? 'area' : feixe ? 'feixe' : 'alvo', raio: area ? c.raio : 0, comprimento: feixe ? c.comprimento || 5 : 0, espalha: 0, alcance: area && c.tipo === 'area' ? 2 : 6, noAlvo: c.tipo === 'area', efeito: c.efeito ?? null, ...(c.tiro != null ? { tiro: c.tiro } : {}), nome: c.nome }];
  });
}
