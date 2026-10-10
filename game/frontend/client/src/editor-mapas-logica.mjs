// A LÓGICA do editor de mapas da Engine (aba "Mapas" de /editor/conteudo), sem DOM: tudo o que o `/editor` antigo fazia com a grade, os spawns,
// a raridade e os modificadores, em funções puras que os testes exercitam (cada uma marca a função F# da auditoria que ela preserva —
// docs/editor-de-mapas-auditoria.md). As regras de VERDADE continuam no servidor (`admin/mapas.mjs`, `systems/mapa/spawns.mjs`,
// `systems/mobs/raridade.mjs`): aqui só se organiza a edição; nada de regra nova de jogo.

export const TILE = 32;
export const ID_VALIDO = /^[a-z0-9-]{3,40}$/;
export const LIMITES = { lado: [5, 300], raio: [0, 10], quantidade: [1, 20] };
export const FERRAMENTAS = ['spawn', 'apagarSpawn', 'pincel', 'parede', 'segura', 'apagarSegura'];
/** As ferramentas das SAFE ZONES (`systems/protecao.mjs`): valem em qualquer mapa, o real inclusive (não mexem no chão). */
export const FERRAMENTAS_DE_ZONA = new Set(['segura', 'apagarSegura']);

/** F4: mapa real = atlas próprio (não o da cidade) ou mais de um andar → só os spawns se editam. */
export const ehMapaReal = (mapa, cidade) => !!mapa && (mapa.atlas !== cidade?.atlas || (mapa.levels?.length ?? 1) > 1);

/** F1: um mapa NOVO nasce todo BLOQUEADO e sem chão — o dono "cava" o andável, como numa sala na rocha. */
export function novoMapa(largura, altura, cidade, piso) {
  const n = largura * altura;
  const stacks = Array.from({ length: n }, () => [piso]);
  const blocked = new Array(n).fill(1);
  return { width: largura, height: altura, atlas: cidade.atlas, cell: cidade.cell, palette: cidade.palette, levels: [7], z: 7, floors: { 7: { stacks, blocked } }, stacks, blocked, spawns: [] };
}

/** F1: os limites de tamanho (a mesma régua do servidor). */
export function tamanhoValido(largura, altura) {
  const [min, max] = LIMITES.lado;
  return Number.isInteger(largura) && Number.isInteger(altura) && largura >= min && largura <= max && altura >= min && altura <= max;
}

/** F10: a grade `{stacks, blocked}` do andar `z` (o andar principal usa os campos de cima). */
export function gradeDe(mapa, z) {
  const f = mapa.floors?.[z] ?? {};
  if (z === mapa.z) return { stacks: f.stacks ?? mapa.stacks, blocked: f.blocked ?? mapa.blocked };
  return { stacks: f.stacks ?? [], blocked: f.blocked ?? [] };
}
export const zDoSpawn = (s, mapa) => (Number.isInteger(s.z) ? s.z : mapa.z);
export const keyDoSpawn = (s) => s.criaturas?.[0]?.key ?? s.key;

/** F7: os spawns de um mapa aberto — o bloco `spawns` ou, do formato antigo, `posicoes` (um bicho por ponto, quantidade 1, raio 0). */
export function spawnsDoMapaAberto(mapa) {
  if (Array.isArray(mapa.spawns)) return structuredClone(mapa.spawns);
  const z = mapa.z ?? 7;
  return (mapa.posicoes ?? []).map((p, i) => ({ id: `s${i + 1}`, x: p.x, y: p.y, z, raio: 0, quantidade: 1, tipo: 'normal', criaturas: [{ key: p.key, peso: 1 }] }));
}

/** F17: a casa sob o ponteiro (coordenadas relativas ao canvas), ou `null` fora do mapa. */
export function casaDoPonteiro(dx, dy, escala, largura, altura) {
  const t = TILE * escala;
  const x = Math.floor(dx / t);
  const y = Math.floor(dy / t);
  return x < 0 || y < 0 || x >= largura || y >= altura ? null : { x, y };
}

/** F17: o texto da barra de status para uma casa (com " · zona segura" na casa segura). */
export function textoDaCasa(mapa, z, casa, spawns, nomeDe, seguras = null) {
  const i = casa.y * mapa.width + casa.x;
  const { stacks, blocked } = gradeDe(mapa, z);
  const s = spawns.find((x) => x.x === casa.x && x.y === casa.y && zDoSpawn(x, mapa) === z);
  const zona = ehCasaSegura(seguras, z, casa.x, casa.y) ? ' · zona segura' : '';
  return `x ${casa.x}, y ${casa.y}, andar ${z} · ${!stacks[i]?.length ? 'vazio' : blocked[i] ? 'bloqueado' : 'andável'}${zona}${s ? ` · spawn ${s.id}: ${nomeDe(keyDoSpawn(s))}` : ''}`;
}

/*
 * ---- As SAFE ZONES no editor (dono, 10/10 — `systems/protecao.mjs`) ----
 * Casas marcadas por andar: lá o jogador não ataca nem apanha, e nenhum bicho nasce, pisa ou persegue. No editor elas são um `Map` de
 * andar → `Set` de "x,y" (pintar e apagar com o pincel, casa a casa ou arrastando); no arquivo, `{ "<andar>": [[x, y], ...] }`.
 */
export function segurasDoMapaAberto(mapa) {
  const porAndar = new Map();
  for (const [z, lista] of Object.entries(mapa?.seguras ?? {})) if (Array.isArray(lista)) porAndar.set(Number(z), new Set(lista.map(([x, y]) => `${x},${y}`)));
  return porAndar;
}
export const ehCasaSegura = (seguras, z, x, y) => !!seguras?.get(z)?.has(`${x},${y}`);

/** Marca (`segura`) ou desmarca (`apagarSegura`) uma casa dentro do mapa. Devolve se mudou. */
export function pintarSegura(seguras, mapa, z, x, y, ferramenta) {
  if (!FERRAMENTAS_DE_ZONA.has(ferramenta) || x < 0 || y < 0 || x >= mapa.width || y >= mapa.height) return false;
  const k = `${x},${y}`;
  if (ferramenta === 'segura') {
    if (!seguras.has(z)) seguras.set(z, new Set());
    if (seguras.get(z).has(k)) return false;
    seguras.get(z).add(k);
    return true;
  }
  if (!seguras.get(z)?.delete(k)) return false;
  if (!seguras.get(z).size) seguras.delete(z);
  return true;
}

/** As casas seguras no formato do arquivo (ordenadas; sem andar vazio), ou null sem nenhuma. */
export function segurasParaSalvar(seguras) {
  const saida = {};
  for (const [z, casas] of [...(seguras ?? new Map())].sort((a, b) => a[0] - b[0])) {
    if (!casas.size) continue;
    saida[z] = [...casas].map((k) => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  }
  return Object.keys(saida).length ? saida : null;
}

/** Quantas casas seguras no andar e no mapa (a contagem do painel). */
export const contagemDeSeguras = (seguras, z) => ({ andar: seguras?.get(z)?.size ?? 0, total: [...(seguras?.values() ?? [])].reduce((n, s) => n + s.size, 0) });

/** F21/F22: pinta uma casa (pincel = andável com o piso; parede = bloqueado). Mapa real não pinta. Devolve se mudou. */
export function pintarCasa(mapa, z, x, y, ferramenta, piso, real) {
  if (real || (ferramenta !== 'pincel' && ferramenta !== 'parede')) return false;
  const i = y * mapa.width + x;
  const { stacks, blocked } = gradeDe(mapa, z);
  const bloqueado = ferramenta === 'parede' ? 1 : 0;
  if (blocked[i] === bloqueado && stacks[i]?.length === 1 && stacks[i][0] === piso) return false;
  blocked[i] = bloqueado;
  stacks[i] = [piso];
  return true;
}

/** F19: o que impede marcar um spawn aqui (`null` = pode). */
export function motivoParaNaoMarcar(mapa, z, x, y, bicho) {
  if (!bicho) return 'Escolha uma criatura na lista primeiro.';
  const i = y * mapa.width + x;
  const { stacks, blocked } = gradeDe(mapa, z);
  if (!stacks[i]?.length || blocked[i]) return 'O spawn precisa ficar numa casa andável deste andar.';
  return null;
}

/** F33: o próximo id de spawn livre (`s1, s2…`, sem repetir). */
export function novoId(spawns) {
  const usados = new Set(spawns.map((s) => s.id));
  let n = spawns.length + 1;
  while (usados.has(`s${n}`)) n++;
  return `s${n}`;
}

/** F28/F32: os campos de raridade de um spawn — nada quando é normal sem modificador (o arquivo não cresce à toa). Normal + modificador = modificado. */
export function comRaridade(o) {
  const mods = (o.modificadores ?? []).slice();
  const raridade = (o.raridade ?? 'normal') === 'normal' && mods.length ? 'modificado' : o.raridade ?? 'normal';
  return raridade === 'normal' ? {} : { raridade, ...(mods.length ? { modificadores: mods } : {}) };
}

/** F28: o teto de modificadores de uma raridade. */
export const tetoDe = (raridades, id) => raridades.find((r) => r.id === id)?.maxModificadores ?? 0;

/** F19: o spawn novo (a criatura escolhida + as propriedades "do próximo"). */
export function novoSpawn({ id, x, y, z, proximo, bicho }) {
  return { id, x, y, z, raio: proximo.raio, quantidade: proximo.quantidade, tipo: 'normal', criaturas: [{ key: bicho.key, peso: 1 }], ...comRaridade(proximo) };
}

/** F27: raio (0–10) e quantidade (1–20) com os limites do servidor. */
export const limitarRaio = (v) => Math.max(LIMITES.raio[0], Math.min(LIMITES.raio[1], Math.round(Number(v) || 0)));
export const limitarQuantidade = (v) => Math.max(LIMITES.quantidade[0], Math.min(LIMITES.quantidade[1], Math.round(Number(v) || 1)));

/**
 * F28/F29/F32: grava a raridade e os modificadores no alvo (um spawn ou o "próximo"), cortando no teto da raridade. Voltar a normal um spawn cujo
 * `tipo` antigo dá raridade (elite…) escreve "normal" com todas as letras. Devolve o alvo.
 */
export function aplicarRaridade(alvo, ehProximo, raridade, mods, { raridades, tipoDoSpawn }) {
  const teto = tetoDe(raridades, raridade === 'normal' && mods.length ? 'modificado' : raridade);
  const editado = { raridade, modificadores: mods.slice(0, teto || 0) };
  if (ehProximo) return Object.assign(alvo, editado);
  delete alvo.raridade;
  delete alvo.modificadores;
  Object.assign(alvo, comRaridade(editado));
  if (!alvo.raridade && (tipoDoSpawn?.[alvo.tipo] ?? 'normal') !== 'normal') alvo.raridade = 'normal';
  return alvo;
}

/** F29: um modificador pode entrar? Travado pelo teto, pelas raridades permitidas ou pelas incompatibilidades — com o motivo. */
export function estadoDoModificador(m, mods, raridade, { raridades, modificadores }) {
  const marcado = mods.includes(m.id);
  const efetiva = raridade === 'normal' && mods.length ? 'modificado' : raridade;
  const teto = tetoDe(raridades, raridade === 'normal' ? 'modificado' : raridade);
  const fora = !!m.raridades && !m.raridades.includes(efetiva);
  const incompativel = mods.some((id) => m.incompativeis?.includes(id) || modificadores.find((x) => x.id === id)?.incompativeis?.includes(m.id));
  const nomeDe = (r) => raridades.find((x) => x.id === r)?.nome ?? r;
  let motivo = null;
  if (!marcado && fora) motivo = `Só entra em: ${m.raridades.map(nomeDe).join(', ')}`;
  else if (!marcado && incompativel) motivo = 'Não combina com um modificador já escolhido';
  else if (!marcado && mods.length >= teto) motivo = 'Teto de modificadores desta raridade';
  return { marcado, travado: !marcado && (mods.length >= teto || fora || incompativel), motivo, teto };
}

/** F25: as criaturas da lista — "deste mapa/hunt" primeiro, o resto só por busca (nome ou key, até 60). */
export function gruposDeBichos(bestiario, { filtro, daqui }) {
  const f = (filtro ?? '').trim().toLowerCase();
  const casa = (b) => !f || b.name.toLowerCase().includes(f) || b.key.includes(f);
  return [
    { titulo: 'Deste mapa / hunt', bichos: bestiario.filter((b) => daqui.has(b.key) && casa(b)) },
    { titulo: f ? 'Bestiário' : 'Bestiário (busque pelo nome)', bichos: f ? bestiario.filter((b) => !daqui.has(b.key) && casa(b)).slice(0, 60) : [] },
  ];
}

/** F31: contagem por andar (para o select de andares) e o texto "n de m no mapa". */
export function spawnsPorAndar(spawns, mapa) {
  return (mapa.levels ?? [mapa.z]).map((z) => ({ z, entrada: z === mapa.z, spawns: spawns.filter((s) => zDoSpawn(s, mapa) === z).length }));
}

/**
 * F5/F6/F8: o corpo do POST de salvar — mapa do editor grava tudo; mapa real só os spawns (e exige o mesmo id aberto). As Safe Zones vão
 * nos dois quando o editor as passa (`seguras`, o `Map` do editor → o formato do arquivo, ou null sem nenhuma, que apaga); sem o campo, o
 * servidor deixa as do arquivo como estão.
 */
export function corpoDeSalvar({ id, mapa, spawns, real, idAberto, seguras }) {
  if (!id) return { erro: 'Escreva um id (ex.: minha-caverna).' };
  if (!ID_VALIDO.test(id)) return { erro: 'Id inválido — só letras minúsculas, números e hífen (3 a 40).' };
  if (real && id !== idAberto) return { erro: 'Mapa real: salve com o mesmo id que foi aberto.' };
  const { stacks, blocked } = gradeDe(mapa, 7);
  const zonas = seguras !== undefined ? { seguras: segurasParaSalvar(seguras) } : {};
  return { corpo: real ? { id, soSpawns: true, spawns, ...zonas } : { id, width: mapa.width, height: mapa.height, blocked, stacks, spawns, ...zonas } };
}
export const mensagemDeSalvo = (id, real, n) => (real ? `Spawns de "${id}" salvos (${n}).` : `Salvo — já dá pra jogar com startHunt "${id}".`);

/** NOVO (lacuna da auditoria): quantos bichos por raridade o mapa tem, para a faixa de distribuição. */
export function distribuicaoDeRaridade(spawns, raridadeDe) {
  const c = {};
  let total = 0;
  for (const s of spawns) {
    const r = raridadeDe(s);
    c[r] = (c[r] ?? 0) + (s.quantidade ?? 1);
    total += s.quantidade ?? 1;
  }
  return { total, porRaridade: c };
}

/**
 * NOVO (lacuna da auditoria): desfazer/refazer. Guarda fotos (JSON) do que se edita — spawns e a grade do andar principal; limitado a `max`.
 * `foto()` devolve o estado atual; `restaurar(foto)` o devolve. Uma edição = `registrar()` ANTES de mudar.
 */
export function criarHistorico({ foto, restaurar, max = 100 }) {
  const passado = [];
  let futuro = [];
  return {
    registrar() {
      passado.push(JSON.stringify(foto()));
      if (passado.length > max) passado.shift();
      futuro = [];
    },
    desfazer() {
      if (!passado.length) return false;
      futuro.push(JSON.stringify(foto()));
      restaurar(JSON.parse(passado.pop()));
      return true;
    },
    refazer() {
      if (!futuro.length) return false;
      passado.push(JSON.stringify(foto()));
      restaurar(JSON.parse(futuro.pop()));
      return true;
    },
    limpar() {
      passado.length = 0;
      futuro = [];
    },
    estado: () => ({ podeDesfazer: passado.length > 0, podeRefazer: futuro.length > 0 }),
  };
}
