// (lote A1, dono 19/10) O DESLOCAMENTO das gemas de movimento do PoE: o salto, a investida, o teleporte. Antes o personagem não saía do lugar —
// a gema era o golpe na área a até 7 casas. Aqui ficam os DADOS de cada gema (a distância, onde o dano cai, o chão que ela deixa) e a GEOMETRIA
// (a casa de destino, pela grade do jogador); quem usa é `acoes.dispararSemMarcar` (`planoDoDeslocamento`).
//
// Escala do jogo: 10 unidades do PoE = 1 m; 1 casa = 2 m. A distância é Chebyshev (o quadrado), como o alcance do Salto Impactante e do Avanço
// Flamejante no PoE (o wiki: "o alcance máximo é um quadrado").
//
// As decisões do dono (19/10):
//   - D1: as de ATAQUE (`ate_alvo`) saltam até o alvo quando ele está fora do alcance corpo a corpo e dentro do salto; coladas no alvo, viram golpe
//     no lugar. As de VIAGEM (`viagem`) cobrem distância até o próximo alvo quando ele está a pelo menos a distância do salto (e as que têm dano
//     batem onde pousam).
//   - D2: FUGIR só com a opção do slot "direção: para longe" (`action.direcao === 'longe'`), junto das condições do slot ("vida ≤ X%").
//   - D3: as distâncias abaixo (com fonte, ou a exceção do dono, com a nota); a "Distância de Deslocamento (máxima) aumentada em X%" da gema entra.
//   - D4: passa por cima de bicho, não atravessa parede (o caminho de até N casas existe na grade do jogador, por BFS); não pousa em zona segura
//     nem em casa ocupada.

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const VIZ = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const NOTA_SEM_FONTE = 'exceção do dono (19/10): o PoE não publica a distância — 3 casas (6 m, a referência do Salto Impactante)';
/*
 * As ESCOLHAS SEM FONTE do lote A1, EXCEÇÕES ACEITAS PELO DONO (19/10):
 *   1. o raio do dano do Avanço Flamejante (e o de Retorno) onde pousa: 1 casa (`raioM: 2` — o PoE não publica);
 *   2. o cone de 2,8 m do fim da Investida com Escudo virou o círculo de 1,6 m (`raioDoFimM`);
 *   3. a área das de ataque (`no_alvo`) centrada no ALVO, com o personagem colado nele (o salto mira o ponto do inimigo);
 *   4. a recarga compartilhada das Ilusões com os usos: cada uso gasta um uso de cada Ilusão da barra, pela recarga dela (`acoes.dispararSemMarcar`);
 *   5. a área do Passo Definhante conta só quem está nela no momento do uso (não acompanha você — `acoes.passoDefinhante`).
 */

/**
 * As gemas que DESLOCAM, pelo slug. `metros`: a distância-base; `modo`: `ate_alvo` (até o alvo, colado nele), `viagem` (na direção do alvo ou
 * para longe), `ida_e_volta` (vai, bate e volta), `inimigos` (leva os bichos perto de você). `danoEm`: `no_alvo` (a área centrada no alvo — o
 * salto mira o ponto do inimigo e você fica colado nele), `alvo` (o golpe só no alvo), `caminho` (quem está nas casas do percurso, e o alvo),
 * `caminho_e_alvo` (o percurso + a área no fim), `chegada` (a área onde pousa), `origem_e_chegada` (a área nas duas pontas), `nenhum`.
 * `fuga`: pode ir "para longe" (a opção do slot). `raioM`: o raio da área quando o PoE não o publica na gema.
 */
export const DESLOCAMENTO = Object.freeze({
  Leap_Slam: { modo: 'ate_alvo', metros: 6, danoEm: 'no_alvo', fuga: true, empurra: true, fonte: 'o wiki do PoE: 60 unidades (6 m), alcance quadrado' },
  Leap_Slam_of_Groundbreaking: { modo: 'ate_alvo', metros: 4, danoEm: 'no_alvo', fuga: true, empurra: true, nota: 'exceção do dono (19/10): o PoE só diz "salta por uma curta distância" — 2 casas' },
  Shield_Charge: { modo: 'ate_alvo', metros: 6, danoEm: 'caminho_e_alvo', fuga: true, raioDoFimM: 1.6, maisNaDistanciaMaximaPct: 100, fonte: 'o wiki do PoE: 60 unidades (6 m); o círculo de 1,6 m no fim (o cone de 2,8 m fica no círculo)' },
  Whirling_Blades: { modo: 'ate_alvo', metros: 6, danoEm: 'caminho', fuga: true, nota: NOTA_SEM_FONTE },
  Flicker_Strike: { modo: 'ate_alvo', metros: 6, danoEm: 'alvo', nota: NOTA_SEM_FONTE },
  Flicker_Strike_of_Power: { modo: 'ate_alvo', metros: 6, danoEm: 'alvo', nota: NOTA_SEM_FONTE },
  Vaal_Flicker_Strike: { modo: 'ate_alvo', metros: 6, danoEm: 'alvo', nota: NOTA_SEM_FONTE },
  Ambush: { modo: 'ate_alvo', metros: 6, danoEm: 'nenhum', nota: NOTA_SEM_FONTE },
  Chain_Hook: { modo: 'ate_alvo', metros: 6, danoEm: 'no_alvo', nota: NOTA_SEM_FONTE },
  Consecrated_Path: { modo: 'ate_alvo', metros: 6, danoEm: 'no_alvo', solo: 'sagrado', nota: NOTA_SEM_FONTE },
  Consecrated_Path_of_Endurance: { modo: 'ate_alvo', metros: 6, danoEm: 'no_alvo', solo: 'sagrado', nota: NOTA_SEM_FONTE },
  Dash: { modo: 'viagem', metros: 6, danoEm: 'nenhum', fuga: true, nota: NOTA_SEM_FONTE },
  Quickstep: { modo: 'viagem', metros: 6, danoEm: 'nenhum', fuga: true, paraNoBicho: true, nota: NOTA_SEM_FONTE },
  // (o raio do dano onde pousa não é publicado: 1 casa — a vizinha, como a ponta do feixe do Vínculo Abrasador)
  Flame_Dash: { modo: 'viagem', metros: 6, danoEm: 'chegada', fuga: true, solo: 'ardente', raioM: 2, fonte: 'o wiki do PoE: "o mesmo alcance do Salto Impactante e do Avanço Carregado" (6 m)' },
  Flame_Dash_of_Return: { modo: 'ida_e_volta', metros: 6, danoEm: 'origem_e_chegada', solo: 'ardente', raioM: 2, fonte: 'o wiki do PoE: o alcance do Avanço Flamejante (6 m)' },
  // (o +2% por nível do Piscar Gélido É a linha "Distância de Deslocamento máxima aumentada em (0 — 38)%" — 4,2 m × 1,38 = 5,8 m no 20)
  Frostblink: { modo: 'viagem', metros: 4.2, danoEm: 'origem_e_chegada', fuga: true, fonte: 'o wiki e o poedb: 42 unidades (4,2 m) no nível 1' },
  Frostblink_of_Wintry_Blast: { modo: 'viagem', metros: 4.2, danoEm: 'origem_e_chegada', fuga: true, fonte: 'o wiki e o poedb: 42 unidades (4,2 m)' },
  Lightning_Warp: { modo: 'viagem', metros: 8, danoEm: 'origem_e_chegada', fuga: true, atraso: true, nota: 'exceção do dono (19/10): o PoE diz "um pouco maior que o Salto Impactante" — 4 casas' },
  Vaal_Lightning_Warp: { modo: 'inimigos', metros: 8, danoEm: 'origem_e_chegada', atraso: true, nota: 'exceção do dono (19/10): o PoE não publica a distância — 4 casas' },
});

/** As linhas da gema que este módulo FAZ (saem do "efeito não simulado" no status — `gemas-poe.statusNoJogo`). */
const LINHA_DA_DISTANCIA = /^Distância de Deslocamento (?:máxima )?aumentada em (?:(-?[\d.]+) ?)?%$/i;
const LINHA_DO_ATRASO = /^Duração reduzida em ([\d.]+) ?%$/i;
const LINHA_DA_INVESTIDA = /^([\d.]+) ?% mais Dano com Acertos na Distância Máxima da Investida$/i;
const LINHA_DA_VOLTA = /^Repete 1 vezes$|^Inverte a direção ao Repetir$/i;
const LINHA_DA_RECARGA_POR_INIMIGO = /^Velocidade de Recuperação da Recarga aumentada em ([\d.]+) ?% para cada Inimigo Normal ou Mágico na Área Velocidade de Recuperação da Recarga aumentada em ([\d.]+) ?% para cada Inimigo Raro ou Único na Área$/i;
export function ehLinhaDoDeslocamento(slug, l) {
  const d = DESLOCAMENTO[slug];
  if (!d) return false;
  const t = String(l).replace(/(\d)%/g, '$1 %').replace(/\s+/g, ' ').trim();
  if (LINHA_DA_DISTANCIA.test(t) || LINHA_DA_RECARGA_POR_INIMIGO.test(t)) return true;
  if (d.atraso && LINHA_DO_ATRASO.test(t)) return true;
  if (d.maisNaDistanciaMaximaPct && LINHA_DA_INVESTIDA.test(t)) return true;
  if (d.modo === 'ida_e_volta' && LINHA_DA_VOLTA.test(t)) return true;
  return false;
}

/**
 * O deslocamento da gema no nível, das linhas dela (as do nível e as da qualidade): `{ modo, maxM, danoEm, ... }` ou null (a gema não desloca).
 * `maxM`: os metros-base × (1 + a "Distância de Deslocamento (máxima) aumentada" da gema); `atrasoMenosPct`: o "Duração reduzida em X%" do Teleporte
 * Relampejante (o atraso dele); `recargaPorInimigo`: a do Piscar Gélido ("Velocidade de Recuperação da Recarga aumentada em X% para cada Inimigo …
 * na Área").
 */
export function deslocamentoDasLinhas(slug, linhas = []) {
  const d = DESLOCAMENTO[slug];
  if (!d) return null;
  let distanciaPct = 0;
  let atrasoMenosPct = 0;
  let recargaPorInimigo = null;
  let maisNaDistanciaMaximaPct = 0;
  for (const bruto of linhas) {
    const l = String(bruto).replace(/(\d)%/g, '$1 %').replace(/\s+/g, ' ').trim();
    let m = LINHA_DA_DISTANCIA.exec(l);
    // (a linha sem número é o cabeçalho da coluna da tabela do poedb, repetido: o número é o da linha de cima)
    if (m) { if (m[1] != null) distanciaPct += Number(m[1]) || 0; continue; }
    if (d.atraso && (m = LINHA_DO_ATRASO.exec(l))) { atrasoMenosPct += Number(m[1]) || 0; continue; }
    if ((m = LINHA_DA_RECARGA_POR_INIMIGO.exec(l))) { recargaPorInimigo = { normal: Number(m[1]) || 0, raro: Number(m[2]) || 0 }; continue; }
    if (d.maisNaDistanciaMaximaPct && (m = LINHA_DA_INVESTIDA.exec(l))) maisNaDistanciaMaximaPct = Number(m[1]) || 0;
  }
  return {
    ...d,
    maxM: d.metros * Math.max(0, 1 + distanciaPct / 100),
    distanciaPct,
    atrasoMenosPct: Math.min(100, atrasoMenosPct),
    recargaPorInimigo,
    maisNaDistanciaMaximaPct: d.maisNaDistanciaMaximaPct ? maisNaDistanciaMaximaPct || d.maisNaDistanciaMaximaPct : 0,
  };
}

/** Os metros em casas (÷ 2): a fração é a chance de uma casa a mais (a regra do jogo para as áreas — `ModsPoe.casasPelaArea`). */
export const casasDosMetros = (metros, rng = Math.random) => {
  const c = Math.max(0, Number(metros) || 0) / 2;
  return Math.trunc(c) + (rng() < c % 1 ? 1 : 0);
};

/**
 * As casas que se alcançam de `de` em até `max` passos (8 direções) só por casas andáveis — passando por cima de bicho (D4: o salto e o teleporte
 * não esbarram em monstro), sem atravessar parede. `Map<'x,y', passos>`. Sem `andavel` (sem a grade), todas as casas do quadrado contam.
 */
export function alcancaveis(de, max, andavel = null) {
  const dist = new Map([[`${de.x},${de.y}`, 0]]);
  if (!(max > 0)) return dist;
  const fila = [de];
  for (let i = 0; i < fila.length; i++) {
    const c = fila[i];
    const d = dist.get(`${c.x},${c.y}`);
    if (d >= max) continue;
    for (const [dx, dy] of VIZ) {
      const p = { x: c.x + dx, y: c.y + dy };
      const k = `${p.x},${p.y}`;
      if (dist.has(k) || (andavel && !andavel(p.x, p.y))) continue;
      dist.set(k, d + 1);
      fila.push(p);
    }
  }
  return dist;
}

/** As casas da reta de `a` a `b` (Bresenham), sem `a` e com `b`. */
export function reta(a, b) {
  const r = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 64 && !(x === b.x && y === b.y); i++) {
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    r.push({ x, y });
  }
  return r;
}

const VETOR_DO_DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/**
 * A CASA DE DESTINO do deslocamento (D1, D2, D4): `{ para, caminho, casas, semMover? }` ou `{ erro, motivo }`.
 *  - `pos`, `alvo` (o bicho mirado, ou null), `max` (as casas do salto, já sorteadas), `modo`, `direcao` ('alvo' | 'longe');
 *  - `andavel(x, y)` (a grade do jogador, sem as zonas seguras) e `ocupada(x, y)` (bicho vivo, aliado, lacaio);
 *  - `alcanceCorpo` (o alcance corpo a corpo do personagem), `querDistancia` (a "Distância" da barra), `vivos` (os bichos vivos);
 *  - `manual` (o clique: a viagem sem motivo vai para a frente — o rumo do personagem), `dir` (o rumo: 0 N, 1 L, 2 S, 3 O), `paraNoBicho` (o
 *    Passo Rápido: para no primeiro bicho ou na parede do caminho).
 */
export function escolherDestino({ pos, alvo = null, max, modo, direcao = 'alvo', andavel = null, ocupada = () => false, alcanceCorpo = 1, querDistancia = 1, vivos = [], manual = false, dir = 2, paraNoBicho = false, fuga = false }) {
  if (!(max > 0)) return { erro: 'Distância de deslocamento zero.', motivo: 'SEM_DESLOCAMENTO' };
  // (o que já não sai sem olhar a grade — o alvo longe demais do salto, perto demais para a viagem — volta antes da busca: isto roda a cada tique)
  const dAlvo = alvo ? cheb(pos, alvo) : null;
  if (direcao !== 'longe' || !fuga) {
    if ((modo === 'ate_alvo' || modo === 'ida_e_volta') && alvo && dAlvo > max + 1) return { erro: 'Alvo fora do alcance do salto.', motivo: 'FORA_DE_ALCANCE' };
    if (modo === 'ate_alvo' && alvo && dAlvo <= alcanceCorpo) return { para: { x: pos.x, y: pos.y }, caminho: [], casas: 0, semMover: true };
    if (modo === 'viagem' && !manual && (!alvo || !(dAlvo >= max && dAlvo > querDistancia))) return alvo ? { erro: 'O alvo já está perto.', motivo: 'ALVO_PERTO' } : { erro: 'Sem alvo.', motivo: 'SEM_ALVO' };
  }
  const passos = alcancaveis(pos, max, andavel);
  const livres = [];
  for (const [k, n] of passos) {
    if (n === 0) continue;
    const [x, y] = k.split(',').map(Number);
    if (!ocupada(x, y)) livres.push({ x, y, n });
  }
  const pronto = (para) => ({ para, caminho: reta(pos, para), casas: cheb(pos, para) });
  // (D2) PARA LONGE: a casa que mais afasta do bicho mais perto (a conta do recuo, em N casas). Só quando um bicho colou — na distância da barra
  // ou menos —, e se afastar de fato.
  if (direcao === 'longe' && fuga) {
    const maisPerto = (c) => vivos.reduce((m, b) => Math.min(m, cheb(c, b)), Infinity);
    const agora = maisPerto(pos);
    if (!(agora <= Math.max(1, querDistancia - 1))) return { erro: 'Nenhum bicho perto para fugir.', motivo: 'SEM_BICHO_PERTO' };
    let melhor = null;
    for (const c of livres) {
      const nota = maisPerto(c) * 100 - c.n;
      if (maisPerto(c) > agora && (!melhor || nota > melhor.nota)) melhor = { c, nota };
    }
    if (!melhor) return { erro: 'Sem para onde fugir.', motivo: 'SEM_DESTINO' };
    return { ...pronto({ x: melhor.c.x, y: melhor.c.y }), fuga: true };
  }
  // Para a FRENTE (o clique sem motivo — e a Vaal do Teleporte, que leva os bichos): a casa mais longe no rumo (o do alvo, ou o do personagem).
  const naFrente = () => {
    let ux;
    let uy;
    if (alvo && (alvo.x !== pos.x || alvo.y !== pos.y)) {
      const l = Math.hypot(alvo.x - pos.x, alvo.y - pos.y);
      [ux, uy] = [(alvo.x - pos.x) / l, (alvo.y - pos.y) / l];
    } else [ux, uy] = VETOR_DO_DIR[dir] ?? [0, 1];
    let melhor = null;
    for (const c of livres) {
      const ao = (c.x - pos.x) * ux + (c.y - pos.y) * uy;
      const lado = Math.abs((c.x - pos.x) * uy - (c.y - pos.y) * ux);
      const nota = ao * 10 - lado * 6;
      if (ao > 0 && (!melhor || nota > melhor.nota)) melhor = { c, nota };
    }
    return melhor ? pronto({ x: melhor.c.x, y: melhor.c.y }) : { erro: 'Sem para onde ir.', motivo: 'SEM_DESTINO' };
  };
  if (modo === 'inimigos') return naFrente();
  if (modo === 'ate_alvo' || modo === 'ida_e_volta') {
    if (!alvo) return { erro: 'Sem alvo.', motivo: 'SEM_ALVO' };
    const d = cheb(pos, alvo);
    // (D1) colado no alvo: o golpe no lugar, como no PoE (o Avanço Flamejante de Retorno vai e volta mesmo assim, se houver casa do outro lado)
    const colados = livres.filter((c) => cheb(c, alvo) <= 1).sort((a, b) => a.n - b.n || Math.hypot(a.x - alvo.x, a.y - alvo.y) - Math.hypot(b.x - alvo.x, b.y - alvo.y));
    if (d <= alcanceCorpo) {
      if (modo === 'ida_e_volta' && colados.length) return pronto({ x: colados[0].x, y: colados[0].y });
      return { para: { x: pos.x, y: pos.y }, caminho: [], casas: 0, semMover: true };
    }
    if (!colados.length) return { erro: 'Alvo fora do alcance do salto.', motivo: 'FORA_DE_ALCANCE' };
    return pronto({ x: colados[0].x, y: colados[0].y });
  }
  // VIAGEM (D1): na direção do alvo, quando ele está a pelo menos a distância do salto; pousa na "Distância" da barra dele, sem passar.
  if (!alvo) return manual ? naFrente() : { erro: 'Sem alvo.', motivo: 'SEM_ALVO' };
  const d = cheb(pos, alvo);
  if (!(d >= max && d > querDistancia)) return manual ? naFrente() : { erro: 'O alvo já está perto.', motivo: 'ALVO_PERTO' };
  // (a distância ATÉ O ALVO a pé — a curva da caverna, não a reta: a casa mais perto do alvo pelo caminho)
  const doAlvo = alcancaveis(alvo, d + max + 2, andavel);
  const ate = (c) => doAlvo.get(`${c.x},${c.y}`) ?? Infinity;
  const daqui = ate(pos);
  let melhor = null;
  for (const c of livres) {
    if (cheb(c, alvo) < Math.max(1, querDistancia)) continue;
    // (o mais perto do alvo pelo caminho; no empate, o mais perto em linha reta — a casa de frente, não a diagonal)
    const nota = ate(c) * 100 + Math.hypot(c.x - alvo.x, c.y - alvo.y) * 10 + c.n;
    if (ate(c) < daqui && (!melhor || nota < melhor.nota)) melhor = { c, nota };
  }
  if (!melhor) return manual ? naFrente() : { erro: 'Sem casa mais perto do alvo.', motivo: 'SEM_DESTINO' };
  let para = { x: melhor.c.x, y: melhor.c.y };
  // (o Passo Rápido para no primeiro bicho ou na parede da reta)
  if (paraNoBicho) {
    let ultimo = null;
    for (const c of reta(pos, para)) {
      if ((andavel && !andavel(c.x, c.y)) || vivos.some((b) => b.x === c.x && b.y === c.y) || ocupada(c.x, c.y)) break;
      ultimo = c;
    }
    if (!ultimo) return { erro: 'Um bicho ou a parede logo à frente.', motivo: 'SEM_DESTINO' };
    para = ultimo;
  }
  return pronto(para);
}
