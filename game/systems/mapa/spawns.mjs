// OS SPAWNS SÃO DO MAPA.
//
// O dono: "a posição do spawn é uma propriedade do próprio mapa" — nada de
// bicho nascendo numa coordenada qualquer, nem ponto de spawn inventado pelo
// código da hunt. Cada arquivo `gamedata/hunts/<id>-map.json` guarda os seus
// pontos no bloco `spawns`, no mesmo formato que o editor de mapas grava:
//
//   "spawns": [{
//     "id": "s1",                 // único no mapa
//     "x": 20, "y": 13, "z": 7,   // o ponto (z = andar; sem z, o andar do mapa)
//     "raio": 2,                  // até quantas casas do ponto os bichos nascem
//     "quantidade": 2,            // quantos bichos este ponto gera por instância
//     "tipo": "normal",           // normal | elite | miniboss | boss
//     "criaturas": [{ "key": "thanatursus", "peso": 1 }]   // quais, e com que chance
//   }]
//
// Este módulo só LÊ e VALIDA. Quem cria os bichos de uma instância é
// `hunt/instancia.mjs`; quem grava é o editor (`admin/mapas.mjs`) e, uma vez,
// a migração (`admin/migrar-spawns.mjs`).
import * as Raridade from '../mobs/raridade.mjs';
import { CATALOGO } from '../dados.mjs';

export const TIPOS = ['normal', 'elite', 'miniboss', 'boss'];
export const PADRAO = { raio: 2, quantidade: 1, tipo: 'normal' };

/** O spawn completo, com os padrões preenchidos (`null` se não dá para usar). */
export function normalizar(s, zDoMapa, i = 0) {
  if (!s || !Number.isInteger(s.x) || !Number.isInteger(s.y)) return null;
  const criaturas = (Array.isArray(s.criaturas) ? s.criaturas : s.key ? [{ key: s.key, peso: 1 }] : [])
    .filter((c) => c?.key)
    .map((c) => ({ key: c.key, peso: Number(c.peso) > 0 ? Number(c.peso) : 1 }));
  if (!criaturas.length) return null;
  return {
    id: String(s.id ?? `s${i + 1}`),
    x: s.x,
    y: s.y,
    z: Number.isInteger(s.z) ? s.z : zDoMapa,
    raio: Number.isInteger(s.raio) && s.raio >= 0 ? s.raio : PADRAO.raio,
    quantidade: Number.isInteger(s.quantidade) && s.quantidade > 0 ? s.quantidade : PADRAO.quantidade,
    tipo: TIPOS.includes(s.tipo) ? s.tipo : PADRAO.tipo,
    criaturas,
    // A raridade e os modificadores do mob deste ponto (ver `mobs/raridade.mjs`): só o que o mapa configura.
    ...(s.raridade != null ? { raridade: s.raridade } : {}),
    ...(Array.isArray(s.modificadores) && s.modificadores.length ? { modificadores: s.modificadores.map(String) } : {}),
  };
}

/**
 * Os spawns de um mapa, normalizados. O mapa de editor antigo guardava
 * `posicoes` (um bicho por ponto): lido como spawn de quantidade 1, raio 0.
 * `null` quando o mapa não tem spawn nenhum.
 */
export function spawnsDoMapa(mapa) {
  if (!mapa) return null;
  const z = mapa.z ?? 7;
  if (Array.isArray(mapa.spawns)) return mapa.spawns.map((s, i) => normalizar(s, z, i)).filter(Boolean);
  if (Array.isArray(mapa.posicoes) && mapa.posicoes.length) {
    return mapa.posicoes.map((p, i) => normalizar({ ...p, raio: 0, quantidade: 1 }, z, i)).filter(Boolean);
  }
  return null;
}

/** Os erros de uma lista de spawns (vazia = pode gravar). `largura`/`altura` do mapa. */
export function validar(spawns, { largura, altura } = {}) {
  const erros = [];
  const ids = new Set();
  if (!Array.isArray(spawns) || !spawns.length) return ['Marque ao menos um spawn de monstro real antes de salvar.'];
  spawns.forEach((s, i) => {
    const onde = `spawn ${s?.id ?? i + 1}`;
    if (!Number.isInteger(s?.x) || !Number.isInteger(s?.y)) erros.push(`${onde}: posição inválida.`);
    else if (largura && altura && (s.x < 0 || s.y < 0 || s.x >= largura || s.y >= altura)) erros.push(`${onde}: fora da grade.`);
    if (s?.id != null) {
      if (ids.has(String(s.id))) erros.push(`${onde}: id repetido.`);
      ids.add(String(s.id));
    }
    const criaturas = Array.isArray(s?.criaturas) ? s.criaturas : s?.key ? [{ key: s.key }] : [];
    if (!criaturas.length) erros.push(`${onde}: sem criatura.`);
    for (const c of criaturas) if (!CATALOGO.bestiary[c?.key]) erros.push(`${onde}: "${c?.key}" não é um monstro do bestiary real.`);
    if (s?.quantidade != null && !(Number.isInteger(s.quantidade) && s.quantidade > 0)) erros.push(`${onde}: quantidade inválida.`);
    if (s?.raio != null && !(Number.isInteger(s.raio) && s.raio >= 0)) erros.push(`${onde}: raio inválido.`);
    if (s?.tipo != null && !TIPOS.includes(s.tipo)) erros.push(`${onde}: tipo "${s.tipo}" desconhecido.`);
    for (const e of Raridade.errosDoSpawn(s)) erros.push(`${onde}: ${e}.`);
  });
  return erros;
}

/** Sorteia a criatura de um spawn pelos pesos. */
export function sortearCriatura(spawn, rng = Math.random) {
  const soma = spawn.criaturas.reduce((n, c) => n + c.peso, 0);
  let r = rng() * soma;
  for (const c of spawn.criaturas) if ((r -= c.peso) < 0) return c.key;
  return spawn.criaturas[spawn.criaturas.length - 1].key;
}

/** Quantos bichos o mapa gera por instância (a soma das `quantidade`). */
export const totalDoMapa = (spawns) => (spawns ?? []).reduce((n, s) => n + s.quantidade, 0);
