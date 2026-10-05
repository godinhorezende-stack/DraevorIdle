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

/** Os COMPORTAMENTOS de boss único (chefe de ato): `invocavel` = as chaves de bestiário que a invocação usa. */
export function comportamentos(monstro, invocavel = []) {
  return convertidas(monstro).flatMap((c) => {
    if (c.tipo === 'magia') return [{ tipo: 'magia', nome: c.nome, elemento: c.elemento, min: c.min, max: c.max, forma: c.forma, raio: c.raio, intervaloMs: c.intervaloMs, chance: 100, alcance: 7 }];
    if (c.tipo === 'area') return [{ tipo: 'area-telegrafada', nome: c.nome, elemento: c.elemento, min: c.min, max: c.max, raio: c.raio, avisoMs: c.avisoMs, intervaloMs: c.intervaloMs, chance: 100 }];
    if (c.tipo === 'invocar' && invocavel.length) return [{ tipo: 'invocar', nome: c.nome, criaturas: [{ key: invocavel[0], qtd: 2 }], maxVivos: 4, intervaloMs: c.intervaloMs, chance: 100 }];
    return [];
  });
}

/** Os PODERES de magia de um monstro comum/único (o formato dos poderes dos bichos — `poderes.mjs`): magias e áreas, no alcance. */
export function poderes(monstro) {
  return convertidas(monstro, 4).flatMap((c) => {
    if (c.tipo === 'invocar') return [];
    const area = c.tipo === 'area' || c.forma === 'area';
    return [{ tipo: 'magia', elemento: c.elemento, min: c.min, max: c.max, intervalo: c.intervaloMs, chance: 100, forma: area ? 'area' : c.forma === 'feixe' ? 'feixe' : 'alvo', raio: area ? c.raio : 0, comprimento: c.forma === 'feixe' ? 5 : 0, espalha: 0, alcance: area && c.tipo === 'area' ? 2 : 6, noAlvo: c.tipo === 'area', efeito: null, nome: c.nome }];
  });
}
