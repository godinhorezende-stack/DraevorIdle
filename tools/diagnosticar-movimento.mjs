// O DIAGNÓSTICO do movimento na linha de comando (dono, 03/10): roda o personagem num mapa desenhado com bichos que PERSEGUEM de verdade e mede o kite —
// quantos tiques ele andou, a maior pausa, as buscas de caminho, o custo por tique e a RAZÃO de cada decisão (`MOV_DIAG`, `game/systems/hunt/diagnostico.mjs`).
//   node tools/diagnosticar-movimento.mjs [aberto|varios|corredor] [--tiques 240] [--distancia 4]
process.env.MOV_DIAG = '1';
const Cacadas = await import('../game/systems/cacadas.mjs');
const R = await import('../game/systems/regras.mjs');
const { gradesCacheadas } = await import('../game/systems/hunt/terreno.mjs');
const Caminho = await import('../game/systems/hunt/caminho.mjs');
const { criarMonstro } = await import('../game/systems/hunt/monstros.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('../game/testes/apoio.mjs');
const Diag = await import('../game/systems/hunt/diagnostico.mjs');
const assert = (await import('node:assert/strict')).default;

let proximaGrade = 0;

/**
 * Uma grade a partir de um desenho: `.` chão, `#` parede, `P` o personagem,
 * `M` o alvo (e `m` outros bichos) — as três letras são chão também.
 */
function desenho(linhas) {
  const andavel = new Set();
  const achados = { P: null, M: null, m: [] };
  linhas.forEach((linha, y) =>
    [...linha].forEach((c, x) => {
      if (c !== '#') andavel.add(`${x},${y}`);
      if (c === 'P') achados.P = { x, y };
      if (c === 'M') achados.M = { x, y };
      if (c === 'm') achados.m.push({ x, y });
    }),
  );
  const id = `teste-progresso-${++proximaGrade}`;
  const grade = { z: 7, minX: 0, maxX: linhas[0].length - 1, minY: 0, maxY: linhas.length - 1, andavel };
  /*
   * Contador de buscas: toda BFS (`bfsDistancias`) lê `grade.numerica` logo de
   * cara. Um getter aqui conta quantas buscas o tique fez nesta grade.
   */
  const numerica = Caminho.gradeNumerica({ ...grade });
  const buscas = { n: 0 };
  Object.defineProperty(grade, 'numerica', {
    get() {
      buscas.n++;
      return numerica;
    },
  });
  gradesCacheadas.set(id, grade);
  return { id, grade, buscas, ...achados };
}


let uid = 900000;

const args = process.argv.slice(2);
const opt = (n, p) => { const i = args.indexOf(`--${n}`); return i >= 0 ? Number(args[i + 1]) : p; };
const nome = args.find((a) => !a.startsWith('--') && Number.isNaN(Number(a))) ?? 'aberto';
const aberto = Array.from({ length: 21 }, (_, y) => (y === 10 ? '.'.repeat(5) + 'P' + '.'.repeat(54) : '.'.repeat(60)));
const CENARIOS = {
  aberto: { linhas: aberto, mobs: [[12, 10]] },
  varios: { linhas: aberto, mobs: [[12, 10], [12, 6], [12, 14], [15, 8]] },
  corredor: { linhas: ['#'.repeat(60), '.'.repeat(5) + 'P' + '.'.repeat(54), '#'.repeat(60)], mobs: [[12, 1]] },
};
const C = CENARIOS[nome];
if (!C) { console.error(`cenário desconhecido: ${nome} (aberto, varios, corredor)`); process.exit(1); }
let semente = 7;
Math.random = () => { semente = (semente * 1664525 + 1013904223) >>> 0; return semente / 4294967296; };
const g = desenho(C.linhas);
const e = personagemDeTeste({ vocacao: 'sorcerer', level: 300 });
e.settings.distance = opt('distancia', 4);
e.maxHp = e.hp = 1e12;
Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto', strategy: 'nearest' });
const h = e.hunt;
const ms = C.mobs.map(([x, y]) => { const m = criarMonstro({ key: 'troll', x, y }, null); Object.assign(m, { hp: 1e12, maxHp: 1e12, forca: 0, perseguindo: true, resist: {} }); delete m.spawn; return m; });
Object.assign(h, { huntId: g.id, z: 7, pos: { ...g.P, dir: 2 }, percurso: null, respawns: [], outrosAndares: {}, monstros: ms });
let agora = 1e9;
h.ultimoTique = agora;
const N = opt('tiques', 240);
let moveu = 0, pausa = 0, maiorPausa = 0;
const trilha = [];
const buscas0 = g.buscas.n;
const t0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) {
  agora += R.PASSO_MS;
  e.hp = e.maxHp = 1e12;
  const antes = `${h.pos.x},${h.pos.y}`;
  Cacadas.tique(e, PERSONAGEM, agora);
  const mexeu = antes !== `${h.pos.x},${h.pos.y}`;
  if (mexeu) { moveu++; pausa = 0; } else { pausa++; maiorPausa = Math.max(maiorPausa, pausa); }
  trilha.push(mexeu ? '>' : '.');
  if (h.pos.x > g.grade.maxX - 3) h.pos.x = 5;
}
const ms_ = Number(process.hrtime.bigint() - t0) / 1e6;
console.log(`${nome}: andou em ${moveu}/${N} tiques (${(100 * moveu / N).toFixed(0)}%) | maior pausa ${maiorPausa} tiques (${(maiorPausa * R.PASSO_MS / 1000).toFixed(1)} s) | buscas ${g.buscas.n - buscas0} | ${(ms_ / N).toFixed(3)} ms por tique`);
console.log(trilha.join('').match(/.{1,80}/g).join('\n'));
console.log('decisões e custos:', JSON.stringify(Diag.resumo(h), null, 1));
