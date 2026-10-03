// A folga da interpolação do passo no cliente (dono, 03/10): com jitter nos pacotes, o boneco não pode parar no meio da caminhada, nem saltar, nem ficar muito atrás.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comecarPasso, duracaoDaInterpolacao, FOLGA_DA_INTERPOLACAO } from '../frontend/client/src/interpolacao.mjs';

const POSICAO = (e, now) => e.fromX + (e.x - e.fromX) * Math.min(1, (now - e.since) / e.duration);

/** O boneco anda `passos` casas; o pacote i deveria chegar em i×250 ms e chega com jitter uniforme de ±`jitter` ms (semente fixa). Devolve as métricas. */
function andar({ passos = 60, jitter = 60, folga = true, moveMs = 250 }) {
  let semente = 12345;
  const rnd = () => { semente = (semente * 1664525 + 1013904223) >>> 0; return semente / 4294967296; };
  const chegadas = Array.from({ length: passos }, (_, i) => Math.max(i === 0 ? 0 : 1, i * 250 + (rnd() * 2 - 1) * jitter)).sort((a, b) => a - b);
  const e = { x: 0, y: 0, fromX: 0, fromY: 0, since: -9999, duration: 1 };
  let parado = 0;
  let maiorSalto = 0;
  let maiorAtraso = 0;
  let k = 0;
  for (let t = 0; t <= chegadas.at(-1) + 400; t++) {
    while (k < chegadas.length && chegadas[k] <= t) {
      const antes = POSICAO(e, t);
      if (k > 0) maiorAtraso = Math.max(maiorAtraso, e.x - antes); // o que faltava desenhar quando o pacote seguinte chegou
      // Como no `track` do mapa: o desenho do passo novo começa de onde o antigo está (`e.x` ainda é o ponto final do passo anterior) e só depois a posição vira a nova.
      if (folga) comecarPasso(e, t, moveMs);
      else { // o desenho antigo: dura exatamente `moveMs`
        const progress = Math.min(1, (t - e.since) / e.duration);
        e.fromX += (e.x - e.fromX) * progress;
        e.since = t;
        e.duration = Math.max(120, moveMs);
      }
      e.x = k + 1;
      maiorSalto = Math.max(maiorSalto, Math.abs(POSICAO(e, t) - antes));
      k++;
    }
    const p = POSICAO(e, t);
    // Parado no meio da caminhada: o desenho chegou ao ponto final do passo, mas ainda vêm passos (o próximo pacote atrasou).
    if (k < chegadas.length && k > 0 && Math.abs(p - e.x) < 1e-9 && t > e.since + 5) parado++;
  }
  return { parado, maiorSalto, maiorAtraso, e };
}

test('a duração do desenho do passo é o tempo do passo com uma folga (e o mínimo de sempre)', () => {
  assert.equal(FOLGA_DA_INTERPOLACAO, 1.25);
  assert.equal(duracaoDaInterpolacao(250), 312.5);
  assert.equal(duracaoDaInterpolacao(50), 120, 'o mínimo vale');
  assert.equal(duracaoDaInterpolacao(undefined), 625, 'sem tempo no pacote, o padrão de 500 ms com folga');
});

test('com jitter de ±60 ms nos pacotes, o boneco para MUITO menos no meio da caminhada que com o desenho antigo, sem saltar e sem ficar longe do servidor', () => {
  const antes = andar({ folga: false });
  const depois = andar({ folga: true });
  console.log(`  [medido] jitter ±60 ms, 60 passos: parado no meio da caminhada ${antes.parado} ms → ${depois.parado} ms; atraso visual máximo ${antes.maiorAtraso.toFixed(2)} → ${depois.maiorAtraso.toFixed(2)} casa`);
  assert.ok(antes.parado > 300, `o desenho antigo deveria travar (parado ${antes.parado} ms)`);
  assert.ok(depois.parado < antes.parado / 5, `parado ${depois.parado} ms contra ${antes.parado} ms antes`);
  assert.ok(depois.maiorSalto < 1e-9, `salto de ${depois.maiorSalto} casas no pacote (deve continuar de onde o desenho está)`);
  assert.ok(depois.maiorAtraso < 0.9, `ficou ${depois.maiorAtraso.toFixed(2)} casa atrás do servidor`);
});

test('sem jitter o desenho é suave e acompanha o servidor de perto; ao parar, chega ao destino dentro da duração', () => {
  const r = andar({ jitter: 0 });
  assert.equal(r.parado, 0);
  assert.ok(r.maiorAtraso < 0.5, `${r.maiorAtraso}`);
  assert.ok(Math.abs(POSICAO(r.e, r.e.since + r.e.duration) - r.e.x) < 1e-9, 'chegou ao fim');
  // Parado de vez: depois de um passo, a posição converge para o destino (nunca fica no meio).
  const e = { x: 5, y: 0, fromX: 4, fromY: 0, since: 0, duration: duracaoDaInterpolacao(250) };
  assert.equal(POSICAO(e, 10_000), 5);
});
