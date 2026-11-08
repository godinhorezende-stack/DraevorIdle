// OS VISUAIS E SONS DAS PEÇAS ÚNICAS (08/11, balão 0 sem efeito — o dono: "Fazer o visual"). As linhas do PoE que só mudam a tela ("Pegadas de Mercúrio",
// "Sanguinolência Extra", a arte das Cargas de Frenesi, o sussurro de gelo ao matar um Raro…) chegam no retrato do jogador como `visuais`
// (`cacadas.visuaisDoJogador`: os `visual:<nome>` do af). Aqui ficam o desenho e o som; `map.mjs` chama nos pontos dele:
//   passo   — o boneco andou uma casa: deixa a pegada na casa de onde saiu;
//   abate   — o evento `kill` (com a raridade): o sangue a mais e os sons;
//   chao    — as pegadas de uma casa, pintadas antes das criaturas dela;
//   antes   — as asas da Entropia, atrás do boneco;
//   depois  — o sangue, por cima de tudo, e a Insanidade (a tela que tremula).
// Os sons são sintetizados (WebAudio, sem arquivo) e respeitam a chave "Sons" dos gráficos.
import { graficoLigado } from './graficos.mjs';

const TILE = 32;
const VIDA_DA_PEGADA = 6000;
const MAX_PEGADAS = 60;
/** A cor e o desenho de cada pegada. */
const PEGADAS = {
  sangue: { cor: '#8e0f12', brilho: null },
  necro: { cor: '#5bd16b', brilho: '#9cff9e' },
  cascos: { cor: '#ff7a1a', brilho: '#ffd36b', casco: true },
  nevoa: { cor: '#c9d6e3', brilho: null, nevoa: true },
  celeste: { cor: '#8fd8ff', brilho: '#ffffff' },
  mercurio: { cor: '#c7ccd6', brilho: '#ffffff' },
};

export function criarVisuais() {
  const pegadas = [];
  const sangue = [];
  let insanidade = null;
  let audio = null;

  const tem = (entity, nome) => !!entity?.visuais?.includes(nome);
  const pegadaDe = (entity) => entity?.visuais?.find((v) => v.startsWith('pegadas:'))?.slice(8) ?? null;

  function contexto() {
    if (!graficoLigado('sons')) return null;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      return audio;
    } catch {
      return null;
    }
  }
  /** Um tom com envelope (o som é todo sintetizado). */
  function tom(ac, { freq, tipo = 'sine', dur = 0.6, vol = 0.08, atraso = 0, deslizarPara = null }) {
    const t0 = ac.currentTime + atraso;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, t0);
    if (deslizarPara) osc.frequency.exponentialRampToValueAtTime(deslizarPara, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
  /** O sussurro de gelo (o Gelo Sussurrante): um ruído filtrado que desce, com um brilho agudo. */
  function sussurroDeGelo() {
    const ac = contexto();
    if (!ac) return;
    const dur = 1.1;
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
    const dados = buf.getChannelData(0);
    for (let i = 0; i < dados.length; i++) dados[i] = (Math.random() * 2 - 1) * (1 - i / dados.length);
    const fonte = ac.createBufferSource();
    fonte.buffer = buf;
    const filtro = ac.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.Q.value = 6;
    filtro.frequency.setValueAtTime(3200, ac.currentTime);
    filtro.frequency.exponentialRampToValueAtTime(900, ac.currentTime + dur);
    const g = ac.createGain();
    g.gain.value = 0.12;
    fonte.connect(filtro).connect(g).connect(ac.destination);
    fonte.start();
    tom(ac, { freq: 2637, dur: 0.5, vol: 0.03, atraso: 0.05 });
    tom(ac, { freq: 3136, dur: 0.45, vol: 0.02, atraso: 0.18 });
  }
  /** A voz da Deusa (o Oni-Goroshi): um acorde de vozes que sobe. */
  function vozDaDeusa() {
    const ac = contexto();
    if (!ac) return;
    for (const [f, a] of [[440, 0], [554.37, 0.08], [659.25, 0.16], [880, 0.24]]) tom(ac, { freq: f, tipo: 'triangle', dur: 1.4, vol: 0.05, atraso: a });
  }

  return {
    /** O boneco andou de (deX, deY) para a casa dele: a pegada fica onde ele estava. */
    passo(entity, deX, deY, now) {
      const tipo = pegadaDe(entity);
      if (!tipo || !PEGADAS[tipo]) return;
      const [dx, dy] = [Math.sign(entity.x - deX), Math.sign(entity.y - deY)];
      pegadas.push({ x: deX, y: deY, dx, dy, tipo, nasceu: now, lado: (pegadas.length % 2) ? 1 : -1 });
      if (pegadas.length > MAX_PEGADAS) pegadas.shift();
    },
    /** O evento `kill` (com a raridade): o sangue a mais e os sons de quem tem a peça. */
    abate(eu, event, now) {
      if (!eu) return;
      if (tem(eu, 'sangue')) {
        const n = 18;
        for (let i = 0; i < n; i++) {
          const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
          const vel = 30 + Math.random() * 60;
          sangue.push({ x: event.x * TILE + TILE / 2, y: event.y * TILE + TILE / 2, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 30, nasceu: now, r: 1.5 + Math.random() * 2.5 });
        }
        if (sangue.length > 400) sangue.splice(0, sangue.length - 400);
      }
      const raro = ['raro', 'unico', 'elite', 'boss'].includes(event.raridade) || event.chefe;
      if (raro && tem(eu, 'som_gelo')) sussurroDeGelo();
      if ((event.raridade === 'unico' || event.raridade === 'boss' || event.chefe) && tem(eu, 'som_deusa')) vozDaDeusa();
    },
    /** As casas com pegada viva (o mapa marca as linhas para pintar por casa). */
    casas(now) {
      return pegadas.filter((p) => now - p.nasceu < VIDA_DA_PEGADA).map((p) => p.y * 4096 + p.x);
    },
    /** As pegadas da casa (x, y), antes das criaturas dela. */
    chao(ctx, x, y, camera, now) {
      for (const p of pegadas) {
        if (p.x !== x || p.y !== y) continue;
        const idade = now - p.nasceu;
        if (idade >= VIDA_DA_PEGADA) continue;
        const estilo = PEGADAS[p.tipo];
        const alfa = 0.75 * (1 - idade / VIDA_DA_PEGADA);
        const cx = x * TILE - camera.x + TILE / 2;
        const cy = y * TILE - camera.y + TILE / 2;
        const ang = Math.atan2(p.dy, p.dx) + Math.PI / 2;
        ctx.save();
        ctx.globalAlpha = alfa;
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        for (const lado of [-1, 1]) {
          const ox = lado * 5;
          const oy = lado * p.lado * 3;
          if (estilo.nevoa) {
            ctx.fillStyle = estilo.cor;
            ctx.globalAlpha = alfa * 0.5;
            ctx.beginPath();
            ctx.arc(ox, oy, 6 + (idade / VIDA_DA_PEGADA) * 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = alfa;
            continue;
          }
          if (estilo.brilho) {
            ctx.shadowColor = estilo.brilho;
            ctx.shadowBlur = 6;
          }
          ctx.fillStyle = estilo.cor;
          ctx.beginPath();
          if (estilo.casco) {
            ctx.arc(ox, oy, 4, Math.PI * 0.15, Math.PI * 1.85);
          } else {
            ctx.ellipse(ox, oy, 2.6, 4.5, 0, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        ctx.restore();
      }
    },
    /** As asas da Entropia, atrás do boneco (`px`, `py`: o canto da casa na tela). */
    antes(ctx, entity, px, py, now) {
      if (!tem(entity, 'asas')) return;
      const bate = Math.sin(now / 260) * 0.18;
      const cx = px + TILE / 2;
      const cy = py + TILE * 0.45;
      ctx.save();
      ctx.globalAlpha *= 0.85;
      for (const lado of [-1, 1]) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(lado, 1);
        ctx.rotate(-0.35 - bate);
        const grad = ctx.createLinearGradient(0, 0, 22, -14);
        grad.addColorStop(0, '#2b0f3a');
        grad.addColorStop(1, '#7c3cff');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(10, -22, 24, -16);
        ctx.quadraticCurveTo(18, -8, 22, -2);
        ctx.quadraticCurveTo(12, -4, 14, 4);
        ctx.quadraticCurveTo(6, 2, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    },
    /** O sangue (por cima das criaturas) e a Insanidade (a tela). `eu`: o boneco do jogador. */
    depois(ctx, eu, camera, now, largura, altura) {
      for (let i = sangue.length - 1; i >= 0; i--) {
        const g = sangue[i];
        const t = (now - g.nasceu) / 1000;
        if (t > 1.6) {
          sangue.splice(i, 1);
          continue;
        }
        const voo = Math.min(t, 0.45);
        const x = g.x + g.vx * voo - camera.x;
        const y = g.y + g.vy * voo + 120 * voo * voo - camera.y;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t / 1.6);
        ctx.fillStyle = '#7a0a0c';
        ctx.beginPath();
        ctx.arc(x, y, g.r * (t > 0.45 ? 1.4 : 1), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (!tem(eu, 'insanidade')) {
        insanidade = null;
        return;
      }
      // (a Insanidade: de tempos em tempos, uns segundos com a cor desviada e uma onda leve na tela)
      if (!insanidade || now > insanidade.ate + insanidade.pausa) insanidade = { de: now, ate: now + 2500 + Math.random() * 2000, pausa: 8000 + Math.random() * 12000, matiz: Math.random() * 360 };
      if (now > insanidade.ate) return;
      const f = Math.sin(((now - insanidade.de) / (insanidade.ate - insanidade.de)) * Math.PI);
      ctx.save();
      ctx.globalAlpha = 0.12 * f;
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = `hsl(${(insanidade.matiz + now / 20) % 360}, 80%, 50%)`;
      ctx.fillRect(0, 0, largura, altura);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.06 * f;
      ctx.fillStyle = '#2a0033';
      for (let y = 0; y < altura; y += 6) ctx.fillRect(Math.sin(now / 180 + y / 30) * 6, y, largura, 2);
      ctx.restore();
    },
    /** Ainda há o que animar (o mapa não pode pular o quadro). */
    animando(eu, now) {
      return sangue.length > 0 || pegadas.some((p) => now - p.nasceu < VIDA_DA_PEGADA) || tem(eu, 'insanidade') || tem(eu, 'asas');
    },
  };
}
