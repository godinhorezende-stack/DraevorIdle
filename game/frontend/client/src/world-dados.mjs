// A tela WORLD — os DADOS e as contas do mapa, sem DOM (a tela e os testes usam as mesmas funções).
//
// Quem decide o que está aberto, concluído ou exigido é o servidor (`systems/campanha.mjs` → `{t:'campanha'}`); aqui só se
// organiza o que chegou: os Atos (dinâmicos, pelo que a campanha traz), onde cada nó fica, que caminhos os ligam e em que estado.
//
// O mapa de um Ato mora num espaço fixo de LARGURA × ALTURA. O editor pode fixar a posição de cada nó (`mundo[id].mapa`);
// onde não fixou, o caminho é desenhado sozinho (serpentina orgânica, a mesma conta sempre: nada pula entre aberturas da tela).

export const LARGURA = 1000;
export const ALTURA = 640;
// Nós pequenos, de mapa de ARPG (dono, 09/10: "os nós estão muito grandes e parecem botões"); o toque usa um alvo invisível maior
// (`desenharNo`), então o tamanho do desenho não atrapalha o dedo.
export const RAIO_DA_FASE = 15;
export const RAIO_DO_BOSS = 21;
const ESPACO = 78;

/** Os tipos de nó que a tela sabe desenhar (o editor oferece estes; `rotulo` é o texto do painel e do balão). */
export const TIPOS_DE_NO = {
  comum: 'Fase comum',
  quest: 'Fase de quest',
  miniboss: 'Miniboss',
  'boss-fase': 'Boss da fase',
  'boss-opcional': 'Boss opcional',
  secreta: 'Área secreta',
  evento: 'Fase com evento',
  cidade: 'Cidade',
  retorno: 'Ponto de retorno',
  especial: 'Área especial',
  desafio: 'Fase de desafio',
  boss: 'Boss do Ato',
};

// ---------------------------------------------------------------- compatibilidade (as contas de antes)

/** As fases em serpentina simples, `colunas` por linha (a lista e os testes antigos). */
export function layoutDoAto(quantidade, colunas) {
  const margem = RAIO_DO_BOSS + 8;
  const pontos = [];
  for (let i = 0; i < quantidade; i++) {
    const linha = Math.floor(i / colunas);
    const coluna = i % colunas;
    const x = margem + (linha % 2 === 0 ? coluna : colunas - 1 - coluna) * ESPACO;
    pontos.push({ x, y: margem + linha * ESPACO });
  }
  const linhas = Math.ceil(quantidade / colunas);
  const ultimo = pontos.at(-1);
  const boss = { x: ultimo.x, y: margem + linhas * ESPACO };
  return { pontos, boss, largura: margem * 2 + (colunas - 1) * ESPACO, altura: boss.y + margem };
}
export const colunasPara = (largura) => Math.max(3, Math.min(6, Math.floor((largura - 40) / ESPACO) + 1));

/** O estado de um nó, em uma palavra (o desenho, o ícone e o texto saem dele). */
export function estadoDoNo(no) {
  if (no.pular) return 'travada';
  if (no.completa || no.vencido) return 'completa';
  if (no.liberada || no.liberado) return 'aberta';
  return 'fechada';
}
export const TEXTO_DO_ESTADO = { completa: 'Concluída', aberta: 'Aberta', fechada: 'Bloqueada', travada: 'Em obras' };

// ---------------------------------------------------------------- os Atos

/**
 * Os Atos da dificuldade escolhida, na ordem, com o que cada aba mostra. `metas` é `campanha.atos` (nome, parte, tema, descricao do
 * editor). Um Ato está ABERTO quando alguma fase dele está liberada (o servidor decide); CONCLUÍDO quando todas as fases e o boss estão feitos.
 */
export function atosDaCampanha(escolhida, metas = {}) {
  const numeros = [...new Set([...escolhida.fases.map((f) => f.ato), ...escolhida.bosses.map((b) => b.ato)])].sort((a, b) => a - b);
  return numeros.map((ato) => {
    const fases = escolhida.fases.filter((f) => f.ato === ato);
    const boss = escolhida.bosses.find((b) => b.ato === ato) ?? null;
    const feitas = fases.filter((f) => f.completa || f.pular).length;
    const meta = metas[String(ato)] ?? {};
    return {
      ato,
      nome: meta.nome || `Ato ${ato}`,
      parte: meta.parte ?? null,
      tema: meta.tema ?? null,
      fundo: meta.fundo?.url || meta.fundo?.arquivo ? meta.fundo : null,
      // A cidade do ato (o nó de partida): `{ nome, posicao, conexoes: [huntId] }` — sem posição, fica à esquerda da primeira fase.
      cidade: meta.cidade ? meta.cidade : null,
      bossMapa: meta.bossMapa && Number.isFinite(meta.bossMapa.x) && Number.isFinite(meta.bossMapa.y) ? meta.bossMapa : null,
      descricao: meta.descricao ?? null,
      fases,
      boss,
      nivelMin: fases[0]?.nivel ?? null,
      nivelMax: fases.at(-1)?.nivel ?? null,
      feitas,
      total: fases.length,
      aberto: fases.some((f) => f.liberada) || !!boss?.liberado,
      concluido: fases.length > 0 && feitas === fases.length && (!boss || boss.vencido),
    };
  });
}

/** As partes da campanha (subtítulo do cabeçalho), na ordem em que aparecem: `['Parte I', ...]`. Vazio se o conteúdo não define. */
export const partesDaCampanha = (atos) => [...new Set(atos.map((a) => a.parte).filter(Boolean))];

/** A fase em que o jogador está agora: a primeira aberta e ainda não concluída (ou a última aberta). */
export const faseDaFronteira = (escolhida) => escolhida.fases.find((f) => f.liberada && !f.completa && !f.pular) ?? escolhida.fases.findLast((f) => f.liberada) ?? escolhida.fases[0];
/**
 * ONDE O PERSONAGEM ESTÁ no mapa da campanha — o nó azul (dono, 10/10: "tem que marcar azul onde o boneco está; agora ele está na cidade").
 * Caçando numa fase: a fase; na sala do boss do ato: o boss; fora da caçada: a CIDADE do ato da última fase em que caçou (`atoDaCidade`,
 * do servidor — sem nenhuma, a do ato da fronteira). Caçando fora da campanha (um mapa do endgame): nenhum nó.
 * `{ tipo: 'fase' | 'boss' | 'cidade', id, ato }` (o `id` do nó na tela) ou null.
 */
export function ondeEstaNoMapa({ huntId = null, escolhida, atoDaCidade = null }) {
  if (huntId) {
    const f = escolhida.fases.find((x) => x.huntId === huntId);
    if (f) return { tipo: 'fase', id: f.huntId, ato: f.ato };
    const b = (escolhida.bosses ?? []).find((x) => x.bossId === huntId);
    return b ? { tipo: 'boss', id: `boss:${b.ato}`, ato: b.ato } : null;
  }
  const ato = atoDaCidade ?? faseDaFronteira(escolhida)?.ato ?? null;
  return ato != null ? { tipo: 'cidade', id: `cidade:${ato}`, ato } : null;
}

// ---------------------------------------------------------------- tipo e posição dos nós

/** O tipo visual de uma fase: o que o editor definiu (`mundo.tipo`) ou o que se deduz do conteúdo (boss/obrigatórios). */
export function tipoDaFase(m = {}) {
  // A fase do editor: o tipo que a Engine marca (o início é uma fase comum com o brilho de "atual"; o resto, o do mapa).
  if (m.grafo) return m.grafo.tipo === 'inicio' ? 'comum' : TIPOS_DE_NO[m.grafo.tipo] ? m.grafo.tipo : 'comum';
  if (m.tipo && TIPOS_DE_NO[m.tipo] && m.tipo !== 'boss') return m.tipo;
  if (m.bossPrincipal) return 'boss-fase';
  const obr = m.obrigatorios ?? [];
  const conhecidos = m.conhecidos ?? [];
  if (obr.some((o) => o.tipo === 'miniboss')) return 'miniboss';
  if (conhecidos.some((o) => o.tipo === 'boss')) return 'boss-opcional';
  if (conhecidos.some((o) => o.tipo === 'miniboss')) return 'miniboss';
  if (conhecidos.some((o) => ['sobrevivencia', 'fenda', 'invasor'].includes(o.tipo))) return 'evento';
  if (obr.length) return 'quest';
  return 'comum';
}

const semente = (n) => {
  let t = (n * 2654435761) >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};
export const aleatorio = semente;

/**
 * Onde cada nó do Ato fica no espaço LARGURA × ALTURA. `fases`: as do Ato; `temBoss`: há um nó de boss ao fim; `mundo`: o conteúdo (posição do editor em
 * `mundo[huntId].mapa`). O caminho padrão é uma serpentina em até 3 linhas com um balanço fixo por Ato (determinístico). Devolve
 * `{ pontos: [{x,y,manual}], boss: {x,y,manual}|null }`.
 */
export function posicoesDoAto(fases, temBoss, mundo = {}, ato = 1, bossManual = null) {
  const total = fases.length + (temBoss ? 1 : 0);
  const linhas = Math.max(1, Math.min(3, Math.ceil(total / 5)));
  const porLinha = Math.ceil(total / linhas);
  const rnd = semente(ato * 7919 + 13);
  const margemX = 110;
  const margemY = 120;
  const gerados = [];
  for (let i = 0; i < total; i++) {
    const linha = Math.floor(i / porLinha);
    const col = i % porLinha;
    const nesta = Math.min(porLinha, total - linha * porLinha);
    const passo = nesta > 1 ? (LARGURA - margemX * 2) / (porLinha - 1) : 0;
    const colunaVisual = linha % 2 === 0 ? col : porLinha - 1 - col;
    const x = margemX + colunaVisual * passo + (rnd() - 0.5) * 26;
    const y = (linhas === 1 ? ALTURA / 2 : margemY + linha * ((ALTURA - margemY * 2) / (linhas - 1))) + (rnd() - 0.5) * 46 + (col % 2 ? 22 : -22);
    gerados.push({ x: Math.round(x), y: Math.round(Math.max(70, Math.min(ALTURA - 70, y))) });
  }
  const dono = (id, g) => {
    const m = mundo[id]?.mapa;
    return m && Number.isFinite(m.x) && Number.isFinite(m.y) ? { x: m.x, y: m.y, manual: true } : { ...g, manual: false };
  };
  const pontos = fases.map((f, i) => dono(f.huntId, gerados[i]));
  // Sem posição própria do boss: ao lado da fase que leva a ele, se ela tem posição do editor (o Ato da Engine) — a mesma regra da vista
  // Mapa da Engine (`lugarDoChefe`). Antes caía na serpentina, longe da fase, com a estrada atravessando o mapa.
  const antes = fases.findIndex((f) => mundo[f.huntId]?.grafo?.aoBoss);
  const doEditor = antes >= 0 && pontos[antes].manual ? { ...lugarDoChefe(pontos[antes]), manual: false } : null;
  return { pontos, boss: temBoss ? (bossManual ? { x: bossManual.x, y: bossManual.y, manual: true } : doEditor ?? { ...gerados[fases.length], manual: false }) : null };
}

/**
 * Onde fica o nó do boss final quando o editor não o posicionou: à direita da fase que leva a ele; sem espaço lá (a fase já encosta na
 * borda), na diagonal logo abaixo (ou acima, perto do chão do mapa) — o nome dos dois não se cobre. `p`: a fase, no espaço do jogo.
 */
export function lugarDoChefe(p) {
  const x = Math.min(LARGURA - 80, p.x + 130);
  if (x - p.x >= 110) return { x, y: p.y };
  return { x: Math.min(LARGURA - 80, p.x + 70), y: p.y + (p.y < ALTURA / 2 ? 100 : -100) };
}

/**
 * Os caminhos do Ato: a cadeia (fase → seguinte), a última fase → boss e as `conexoes` extras do conteúdo. Cada um com origem, destino, tipo
 * e ESTADO: percorrido (os dois lados concluídos), disponível (a origem concluída e o destino aberto) ou bloqueado.
 */
export function conexoesDoAto(fases, boss, mundo = {}) {
  const lista = [];
  const estado = (a, b) => ((a.completa || a.pular) && (b.completa || b.vencido || b.pular) ? 'percorrido' : (a.completa || a.pular) && (b.liberada || b.liberado) ? 'disponivel' : 'bloqueado');
  // Ato do EDITOR (`mundo[id].grafo`): exatamente as ligações da Engine — nada de cadeia implícita — e o boss só da fase que leva a ele.
  if (fases.length && fases.every((f) => mundo[f.huntId]?.grafo)) {
    const porId = new Map(fases.map((f) => [f.huntId, f]));
    for (const f of fases) {
      for (const alvo of mundo[f.huntId].grafo.conexoes ?? []) if (porId.has(alvo)) lista.push({ de: f.huntId, para: alvo, tipo: 'cadeia', estado: estado(f, porId.get(alvo)) });
      if (boss && mundo[f.huntId].grafo.aoBoss) lista.push({ de: f.huntId, para: `boss:${boss.ato}`, tipo: 'boss', estado: estado(f, boss) });
    }
    return lista;
  }
  fases.forEach((f, i) => {
    if (i) lista.push({ de: fases[i - 1].huntId, para: f.huntId, tipo: 'cadeia', estado: estado(fases[i - 1], f) });
  });
  if (boss && fases.length) lista.push({ de: fases.at(-1).huntId, para: `boss:${boss.ato}`, tipo: 'boss', estado: estado(fases.at(-1), boss) });
  const ids = new Set(fases.map((f) => f.huntId));
  const jaTem = (a, b) => lista.some((c) => (c.de === a && c.para === b) || (c.de === b && c.para === a));
  for (const f of fases) {
    for (const alvo of mundo[f.huntId]?.conexoes ?? []) {
      if (!ids.has(alvo) || jaTem(f.huntId, alvo)) continue;
      lista.push({ de: f.huntId, para: alvo, tipo: 'extra', estado: estado(f, fases.find((x) => x.huntId === alvo)) });
    }
  }
  return lista;
}

/** O traçado (SVG `d`) de uma estrada entre dois pontos: uma curva suave, sempre a mesma para o mesmo par. */
export function tracadoDaEstrada(a, b, tipo = 'cadeia') {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const comp = Math.hypot(dx, dy) || 1;
  const lado = (Math.round(a.x * 7 + a.y * 13) % 2 ? 1 : -1) * (tipo === 'extra' ? 0.28 : 0.14);
  const cx = mx + (-dy / comp) * comp * lado;
  const cy = my + (dx / comp) * comp * lado;
  return `M${a.x} ${a.y} Q${Math.round(cx)} ${Math.round(cy)} ${b.x} ${b.y}`;
}
