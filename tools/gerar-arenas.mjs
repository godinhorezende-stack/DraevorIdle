// Gera as salas da Arena x1: `assets_raw/gamedata/hunts/<arena>-map.json` e
// `assets_raw/gamedata/arenas.json`.
//
// Do original (`api-mapeada/captura-guilda-arena-0926/arena-zoros.json`): as
// arenas (id, nome, level, blurb) e os bichos de cada uma, com a quantidade.
//
// O MAPA das salas o original só manda para quem está num duelo de verdade — e
// a conta do dono não tem outro personagem de level 500 para desafiar. Enquanto
// isso, cada arena usa uma sala real já capturada, do mesmo tema (a arte, as
// paredes e o chão dela), com os bichos DA ARENA espalhados nela e um ponto de
// partida para cada lado do duelo. No dia em que o mapa real for capturado,
// basta trocar `BASE` e rodar de novo.
//
// Uso: node tools/gerar-arenas.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
const ler = (p) => JSON.parse(readFileSync(new URL(p, raiz), 'utf8'));

const BASE = {
  // A do Magma Bubble (fogo) foi a primeira escolha, mas fora da sala de boss a lava
  // não se anda: sobravam 236 casas para 186 bichos. A da Sphinx Issavi (level 450) cabe.
  'arena-livraria-de-fogo': 'sphinx-issavi',
  'arena-skeletinho': 'the-sandking', // areia e tumba
};

const arenas = ler('api-mapeada/captura-guilda-arena-0926/arena-zoros.json').view.arenas;
const { gradeDaHunt, huntOuMapaCustom } = await import(new URL('server/sistemas/hunt/terreno.mjs', raiz));

// Sorteio com semente: o mesmo mapa a cada geração.
let semente = 20260926;
const sorte = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);

const saida = [];
for (const a of arenas) {
  const base = BASE[a.id];
  if (!base) throw new Error(`sem sala base para ${a.id}`);
  const mapa = ler(`assets_raw/gamedata/hunts/${base}-map.json`);
  delete mapa.route;
  mapa.custom = true;
  mapa.posicoes = [];
  const arquivo = new URL(`assets_raw/gamedata/hunts/${a.id}-map.json`, raiz);
  writeFileSync(arquivo, JSON.stringify(mapa));

  // As casas andáveis de verdade (a grade do servidor: parede e líquido de fora).
  const grade = gradeDaHunt(huntOuMapaCustom(a.id));
  // Só a MAIOR ilha da sala (as casas que se alcançam andando): lados e bichos nela.
  const vizinhos = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const visto = new Set();
  let casas = [];
  for (const k of grade.andavel) {
    if (visto.has(k)) continue;
    const ilha = [];
    visto.add(k);
    for (const fila = [k.split(',').map(Number)]; fila.length; ) {
      const [x, y] = fila.shift();
      ilha.push([x, y]);
      for (const [dx, dy] of vizinhos) {
        const c = `${x + dx},${y + dy}`;
        if (grade.andavel.has(c) && !visto.has(c)) { visto.add(c); fila.push([x + dx, y + dy]); }
      }
    }
    if (ilha.length > casas.length) casas = ilha;
  }
  // Os dois lados: as duas casas andáveis mais distantes no eixo mais longo.
  const largo = grade.maxX - grade.minX >= grade.maxY - grade.minY;
  casas.sort((p, q) => (largo ? p[0] - q[0] || p[1] - q[1] : p[1] - q[1] || p[0] - q[0]));
  const lados = [casas[Math.floor(casas.length * 0.08)], casas[Math.floor(casas.length * 0.92)]].map(([x, y]) => ({ x, y }));
  // Os bichos: a mais de 8 casas de cada partida — fora do alcance das magias deles (7).
  const livres = casas.filter(([x, y]) => lados.every((l) => Math.max(Math.abs(l.x - x), Math.abs(l.y - y)) > 8));
  for (let i = livres.length - 1; i > 0; i--) {
    const j = Math.floor(sorte() * (i + 1));
    [livres[i], livres[j]] = [livres[j], livres[i]];
  }
  let k = 0;
  for (const b of a.bichos) for (let n = 0; n < b.quantos && k < livres.length; n++, k++) mapa.posicoes.push({ key: b.key, x: livres[k][0], y: livres[k][1], z: mapa.z ?? 7 });
  writeFileSync(arquivo, JSON.stringify(mapa));
  saida.push({ ...a, base, lados, z: mapa.z ?? 7 });
  console.log(a.id, '← sala', base, '| casas', casas.length, '| bichos', mapa.posicoes.length, '| lados', JSON.stringify(lados));
}
writeFileSync(new URL('assets_raw/gamedata/arenas.json', raiz), JSON.stringify({ fonte: 'original (arena-zoros.json); mapa: sala real do mesmo tema até o mapa da arena ser capturado', arenas: saida }));
