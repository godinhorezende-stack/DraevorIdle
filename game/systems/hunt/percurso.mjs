// Andar no laço da Caça Automática: waypoint da vez, retomar depois da briga, contar as voltas.
// Parte de `cacadas.mjs` (dividido em 2026-09-25); a fachada continua lá.
import { huntOuMapaCustom, gradeDaHunt } from './terreno.mjs';
import { noAndar, andarDaGrade } from './andares.mjs';
import { proximoPassoAte, distancia, VIZINHANCA_8 } from './caminho.mjs';
import { trocarDeAndar } from './monstros.mjs';

/**
 * O monstro vivo mais próximo que ainda não está perseguindo (fora do
 * `ALCANCE_DE_PERCEPCAO`) — para onde o passo automático anda enquanto está
 * "lurando" (juntando a leva, ver `atualizarLure`), puxando um de cada vez em
 * vez de brigar com o primeiro que aparece.
 */
/**
 * O `run` do `state`: em que waypoint do laço ele está. O client usa `passo`,
 * `passos` e `temRota` (o balão do botão, "waypoint N de M"). Sem percurso, nada.
 */
export function runParaCliente(estado) {
  const hunt = estado.hunt;
  const pontos = hunt?.percurso && gradeDaHunt(huntOuMapaCustom(hunt.huntId)).percurso;
  if (!pontos) return null;
  return { passo: hunt.percurso.passo, passos: pontos.length, temRota: true, voltas: hunt.percurso.voltas ?? 0 };
}

/**
 * O waypoint mais perto de `pos`, olhando `janela` waypoints para a frente a
 * partir de `de` — só os do andar `z` (o de outro andar pode estar "a 2 casas"
 * no x,y e a uma escada inteira de distância).
 */
export function waypointMaisPerto(pontos, pos, de = 0, janela = pontos.length, z = null) {
  let melhor = de;
  let menor = Infinity;
  for (let k = 0; k < Math.min(janela, pontos.length); k++) {
    const i = (de + k) % pontos.length;
    if (z != null && !noAndar(pontos[i], z)) continue;
    const d = distancia(pos, pontos[i]);
    if (d < menor) {
      menor = d;
      melhor = i;
    }
  }
  return melhor;
}

/** Quantos waypoints para a frente ele procura onde retomar o laço depois de uma briga. */
export const JANELA_PARA_RETOMAR = 40;
/** Mais longe que isto do waypoint da vez, ele se desviou (foi brigar) e retoma pelo mais perto à frente. */
export const DESVIO_DO_PERCURSO = 3;

/** Uma volta completa no percurso: conta na caçada e no personagem (`huntLaps`, o que o client mostra). */
export function completarVolta(estado, hunt, passos) {
  // Só conta a volta que foi ANDADA: pular waypoints sem caminho até o fim da
  // lista não é dar a volta (era o que dava centenas de "voltas" parado).
  const p = hunt.percurso;
  const andou = p.andou ?? 0;
  p.andou = 0;
  if (andou < Math.min(passos / 2, 20)) return;
  p.voltas = (p.voltas ?? 0) + 1;
  const voltas = (estado.huntLaps ??= {});
  voltas[hunt.huntId] = (voltas[hunt.huntId] ?? 0) + 1;
}

/**
 * O próximo passo no laço, quando não há bicho à vista. Chegou no waypoint, o
 * próximo; passou do último, volta ao primeiro e conta uma volta. Longe do
 * waypoint da vez (foi brigar), retoma pelo mais perto dos próximos
 * `JANELA_PARA_RETOMAR` — para a frente, nunca voltando o que já andou.
 * Waypoint sem caminho agora (um bicho parado em cima, um pedaço do andar
 * separado): pula para o seguinte.
 */
export function passoNoPercurso(estado, hunt, grade, casasDeBicho, evitar = null) {
  const pontos = grade.percurso;
  const p = hunt.percurso;
  const n = pontos.length;
  const avancar = () => {
    p.passo = (p.passo + 1) % n;
    if (p.passo === 0) completarVolta(estado, hunt, n);
  };
  // Retoma pelo mais perto só depois de uma BRIGA (`desviou`, posto por
  // `tique` quando há alvo): fora disso ele segue os waypoints em ordem. Sem
  // essa condição, num laço curto a janela dava a volta inteira e devolvia o
  // waypoint que ele acabara de pular por falta de caminho — vai-e-vem parado.
  /*
   * Waypoint da vez noutro andar: o de antes dele é a escada (a rota gravada
   * pisa nela e aparece do outro lado). Ele anda até a escada; em cima dela,
   * muda de andar e segue do waypoint onde a rota chega.
   */
  const aqui = (c) => hunt.pos.x === c.x && hunt.pos.y === c.y;
  const escadaDa = (i) => pontos[(i - 1 + n) % n];
  const metaDoAndar = () => (noAndar(pontos[p.passo], hunt.z) ? pontos[p.passo] : escadaDa(p.passo));
  if (p.desviou && distancia(hunt.pos, metaDoAndar()) > DESVIO_DO_PERCURSO) {
    const retoma = waypointMaisPerto(pontos, hunt.pos, p.passo, Math.min(JANELA_PARA_RETOMAR, n - 1), hunt.z);
    if (retoma < p.passo) completarVolta(estado, hunt, n); // retomou já na volta seguinte
    p.passo = retoma;
  }
  p.desviou = false;
  if (noAndar(pontos[p.passo], hunt.z) && aqui(pontos[p.passo])) avancar();
  let meta = pontos[p.passo];
  if (!noAndar(meta, hunt.z)) {
    const escada = escadaDa(p.passo);
    if (!noAndar(escada, hunt.z) || aqui(escada)) {
      // Na caçada em grupo quem troca de andar é o dono; o convidado espera ser levado.
      if (!trocarDeAndar(hunt, meta)) return null;
      p.andou = (p.andou ?? 0) + 1;
      avancar();
      return null;
    }
    meta = escada;
  }
  const ocupada = (c) => casasDeBicho.has(`${c.x},${c.y}`);
  /*
   * `evitar` (a casa de onde ele acabou de sair, com a leva colada — ver o laço
   * em `tique`): primeiro um caminho que NÃO volte por ela, contornando os
   * bichos (reto, depois na diagonal). Só sem nenhum vale o de sempre — e aí
   * quem chama encerra a juntada. Tudo numa chamada só: o `avancar()` logo
   * abaixo não pode rodar duas vezes por uma tentativa que não deu.
   */
  let destino = null;
  if (evitar) {
    const k = `${evitar.x},${evitar.y}`;
    const semVoltar = new Set(casasDeBicho).add(k);
    destino = proximoPassoAte(grade, hunt.pos, meta, (c) => ocupada(c) || `${c.x},${c.y}` === k, semVoltar);
  }
  destino ??= proximoPassoAte(grade, hunt.pos, meta, ocupada, casasDeBicho);
  if (destino) p.andou = (p.andou ?? 0) + 1;
  else avancar();
  return destino;
}

/*
 * ---- O andar vazio: vai direto ao andar que tem bicho ----
 *
 * (10/11, dono: "um player reclamou que o personagem fica um tempo andando perdido sem completar a fase" — Caminhos Fluviais, sobre o Amazon Camp de 7
 * andares) Sem bicho que ele alcance no andar dele, o passo seguia o laço inteiro da rota: medido, 50 s rodando o andar 7 vazio com 38 bichos no andar 8,
 * e secas de até 77 s sem matar nada. Agora, na instância, ele planeja pelas TROCAS DE ANDAR da rota (o waypoint antes de uma troca é a escada; o
 * seguinte, onde se chega): o caminho mais curto (Dijkstra, em casas) da posição dele até a chegada de uma escada num PEDAÇO de andar que tem bicho
 * vivo — pedaço, porque um andar pode ter partes que não se ligam a pé (o andar 6 do Amazon Camp: um bolso visitado pela rota, sem saída para o resto).
 * Põe o waypoint da vez na chegada da PRIMEIRA escada desse caminho: `passoNoPercurso` anda até ela e troca de andar; no andar seguinte, planeja de novo.
 * Devolve `true` quando apontou para uma escada.
 */
export function irAoAndarComBichos(hunt, grade, gradeCompleta, idDaInstancia) {
  const pontos = grade.percurso;
  const p = hunt.percurso;
  if (!pontos || !p || idDaInstancia == null) return false;
  const vivo = (m) => m.hp > 0 && m.instancia === idDaInstancia && (m.semCaminhoAte ?? 0) <= (hunt.clock ?? 0);
  const bichosDo = (z) => (z === hunt.z ? hunt.monstros : hunt.outrosAndares?.[z] ?? []).filter(vivo);
  const andares = new Set(Object.keys(hunt.outrosAndares ?? {}).map(Number).filter((z) => (hunt.outrosAndares[z] ?? []).some(vivo)));
  if (!andares.size) return false;
  const pedaco = pedacosDosAndares(gradeCompleta);
  const meu = pedaco(hunt.z, hunt.pos);
  if (meu == null) return false;
  // Os pedaços com bicho (a casa dele ou uma vizinha, que a casa do bicho às vezes não é andável).
  const comBicho = new Set();
  for (const z of [hunt.z, ...andares]) for (const m of bichosDo(z)) { const c = pedaco(z, m); if (c != null) comBicho.add(`${z}:${c}`); }
  comBicho.delete(`${hunt.z}:${meu}`);
  if (!comBicho.size) return false;
  const chave = `${hunt.z}:${meu}|${[...comBicho].sort().join(',')}`;
  let i = p.atalho?.chave === chave ? p.atalho.i : null;
  if (i == null) {
    i = primeiraEscada(pontos, pedaco, { z: hunt.z, pos: hunt.pos, pedaco: meu }, comBicho);
    if (i == null) return false;
    p.atalho = { chave, i };
  }
  p.passo = (i + 1) % pontos.length;
  p.desviou = false;
  return true;
}

/** As trocas de andar da rota: `{ i, de, para, escada, chegada }` (a escada é o waypoint `i`; a chegada, o seguinte). */
function trocasDaRota(pontos) {
  const n = pontos.length;
  const trocas = [];
  for (let i = 0; i < n; i++) {
    const a = pontos[i];
    const b = pontos[(i + 1) % n];
    if (a.z != null && b.z != null && a.z !== b.z) trocas.push({ i, de: a.z, para: b.z, escada: a, chegada: b });
  }
  return trocas;
}

/** Dijkstra pelas escadas, da `origem` até a chegada num pedaço de `destinos` (`"z:pedaço"`): o índice da primeira escada, ou null. */
function primeiraEscada(pontos, pedaco, origem, destinos) {
  const trocas = trocasDaRota(pontos);
  const custo = new Map();
  const primeira = new Map();
  const abertos = [];
  const alcancaveis = (z, pos, c) => trocas.filter((t) => t.de === z && pedaco(z, t.escada) === c).map((t) => [t, distancia(pos, t.escada) + 1]);
  for (const [t, d] of alcancaveis(origem.z, origem.pos, origem.pedaco)) if (d < (custo.get(t.i) ?? Infinity)) { custo.set(t.i, d); primeira.set(t.i, t.i); abertos.push(t); }
  const feitos = new Set();
  while (abertos.length) {
    abertos.sort((a, b) => custo.get(a.i) - custo.get(b.i));
    const t = abertos.shift();
    if (feitos.has(t.i)) continue;
    feitos.add(t.i);
    const c = pedaco(t.para, t.chegada);
    if (c == null) continue;
    if (destinos.has(`${t.para}:${c}`)) return primeira.get(t.i);
    for (const [u, d] of alcancaveis(t.para, t.chegada, c)) {
      const novo = custo.get(t.i) + d;
      if (!feitos.has(u.i) && novo < (custo.get(u.i) ?? Infinity)) { custo.set(u.i, novo); primeira.set(u.i, primeira.get(t.i)); abertos.push(u); }
    }
  }
  return null;
}

/*
 * Os PEDAÇOS de cada andar: as partes andáveis que se ligam a pé (8 vizinhas), numeradas uma vez por mapa e guardadas na grade (não enumerável — o
 * mapa não muda). Devolve `pedaco(z, casa)`: o número do pedaço da casa (ou de uma vizinha andável), ou null.
 */
function pedacosDosAndares(gradeCompleta) {
  if (!gradeCompleta.pedacos) Object.defineProperty(gradeCompleta, 'pedacos', { value: new Map(), enumerable: false });
  const porAndar = gradeCompleta.pedacos;
  const doAndar = (z) => {
    if (porAndar.has(z)) return porAndar.get(z);
    const g = andarDaGrade(gradeCompleta, z);
    const rotulo = new Map();
    let n = 0;
    for (const k of g.andavel) {
      if (rotulo.has(k)) continue;
      rotulo.set(k, n);
      const fila = [k];
      while (fila.length) {
        const [x, y] = fila.pop().split(',').map(Number);
        for (const [dx, dy] of VIZINHANCA_8) {
          const v = `${x + dx},${y + dy}`;
          if (g.andavel.has(v) && !rotulo.has(v)) { rotulo.set(v, n); fila.push(v); }
        }
      }
      n++;
    }
    porAndar.set(z, rotulo);
    return rotulo;
  };
  return (z, c) => {
    const r = doAndar(z);
    const aqui = r.get(`${c.x},${c.y}`);
    if (aqui != null) return aqui;
    for (const [dx, dy] of VIZINHANCA_8) { const v = r.get(`${c.x + dx},${c.y + dy}`); if (v != null) return v; }
    return null;
  };
}
