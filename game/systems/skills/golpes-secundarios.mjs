// Os GOLPES SECUNDÁRIOS de uma skill — o motor de PROJÉTIL e de ÁREA (etapa 3 do plano,
// 30/09). Genérico, por TAG e pelos efeitos somados das supports ligadas
// (`Gemas.efeitoNaSkill`): nada aqui sabe o nome de uma skill.
//
//   projétil (tag projectile):  alvosExtras (mais projéteis), perfurar (atravessa em linha),
//                               bifurcar (se divide no alvo), encadear (salta de bicho em bicho),
//                               retornar (volta e acerta de novo);
//   golpe (tag hit):            explosaoPct / segundaExplosaoPct (explosão em volta do alvo);
//   área (area/wave/line):      areaExtra (+N casas de raio; negativo concentra).
//
// Só geometria: devolve QUEM leva o golpe e com quantos % dele; o `disparar`
// (acoes.mjs) é quem calcula o dano (crítico, resistência, marcas), um acerto por vez.
import { CONFIG } from './gemas.mjs';

const G = () => CONFIG.golpesSecundarios ?? {};
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** As casas de uma reta de `de` na direção de `para`, até `alcance` casas de `de` (Bresenham, sem `de`). */
export function casasDaReta(de, para, alcance) {
  const dx = para.x - de.x;
  const dy = para.y - de.y;
  const passos = Math.max(Math.abs(dx), Math.abs(dy));
  if (!passos) return [];
  const casas = [];
  for (let i = 1; i <= alcance; i++) casas.push({ x: Math.round(de.x + (dx * i) / passos), y: Math.round(de.y + (dy * i) / passos) });
  return casas;
}

/**
 * A área aumentada (`n` > 0: toda casa a até `n` de uma casa da área entra) ou
 * concentrada (`n` < 0: tira a borda `|n|` vezes, sem sumir com tudo).
 */
export function mudarArea(casas, n) {
  if (!n || !casas?.length) return casas;
  const chave = (c) => `${c.x},${c.y}`;
  let conjunto = new Map(casas.map((c) => [chave(c), c]));
  if (n > 0) {
    for (const c of casas) {
      for (let dx = -n; dx <= n; dx++) for (let dy = -n; dy <= n; dy++) {
        const k = `${c.x + dx},${c.y + dy}`;
        if (!conjunto.has(k)) conjunto.set(k, { x: c.x + dx, y: c.y + dy });
      }
    }
    return [...conjunto.values()];
  }
  for (let vez = 0; vez < -n; vez++) {
    const miolo = [...conjunto.values()].filter((c) => {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (!conjunto.has(`${c.x + dx},${c.y + dy}`)) return false;
      return true;
    });
    if (!miolo.length) break; // concentrar não apaga a área inteira
    conjunto = new Map(miolo.map((c) => [chave(c), c]));
  }
  return [...conjunto.values()];
}

/** Os `n` bichos vivos mais perto de `ponto`, a até `distancia`, fora de `fora`. */
function maisPerto(vivos, ponto, distancia, n, fora) {
  return vivos
    .filter((b) => b.hp > 0 && !fora.has(b) && cheb(ponto, b) <= distancia)
    .sort((a, b) => cheb(ponto, a) - cheb(ponto, b))
    .slice(0, n);
}

/**
 * Os golpes secundários de UM uso da skill. `efeito`: o da gema (supports somadas);
 * `tags`: as da skill; `origem`: quem lança; `alvo`: o mirado; `atingidos`: quem o golpe
 * principal pegou; `alcance`: o da skill.
 * Devolve `[{ bicho, pct, de, tipo }]` — `de` é de onde o golpe vem (o salto, a explosão),
 * `tipo` 'projetil' | 'explosao' | 'retorno'.
 */
export function secundarios({ efeito, tags, origem, alvo, atingidos, vivos, alcance }) {
  const saida = [];
  if (!efeito) return saida;
  const t = new Set(tags ?? []);
  const ja = new Set(atingidos);
  const projetil = t.has('projectile') && alvo;

  if (projetil) {
    // Mais projéteis: os bichos mais perto de quem lança, ao alcance, fora dos já atingidos.
    if (efeito.alvosExtras > 0) {
      for (const b of maisPerto(vivos, origem, alcance, efeito.alvosExtras, ja)) {
        saida.push({ bicho: b, pct: efeito.danoDosExtrasPct || 100, de: origem, tipo: 'projetil' });
        ja.add(b);
      }
    }
    // Perfurar: o projétil atravessa o alvo e segue na mesma reta.
    if (efeito.perfurar > 0) {
      const reta = casasDaReta(origem, alvo, alcance + 2);
      const alem = reta.filter((c) => cheb(origem, c) > cheb(origem, alvo));
      let n = 0;
      for (const c of alem) {
        if (n >= efeito.perfurar) break;
        const b = vivos.find((m) => m.hp > 0 && m.x === c.x && m.y === c.y && !ja.has(m));
        if (!b) continue;
        saida.push({ bicho: b, pct: efeito.danoDaPerfuracaoPct || 100, de: alvo, tipo: 'projetil' });
        ja.add(b);
        n++;
      }
    }
    // Bifurcar: no alvo, o projétil se divide em N, para os bichos mais perto dele.
    if (efeito.bifurcar > 0) {
      for (const b of maisPerto(vivos, alvo, G().distanciaDaBifurcacao ?? 4, efeito.bifurcar, ja)) {
        saida.push({ bicho: b, pct: efeito.danoDaBifurcacaoPct || 100, de: alvo, tipo: 'projetil' });
        ja.add(b);
      }
    }
    // Encadear: do alvo, salta para o mais perto do ÚLTIMO atingido, N vezes.
    if (efeito.encadear > 0) {
      let ultimo = alvo;
      for (let i = 0; i < efeito.encadear; i++) {
        const [b] = maisPerto(vivos, ultimo, G().distanciaDoEncadeamento ?? 4, 1, ja);
        if (!b) break;
        saida.push({ bicho: b, pct: efeito.danoDoEncadeamentoPct || 100, de: ultimo, tipo: 'projetil' });
        ja.add(b);
        ultimo = b;
      }
    }
  }

  // Explosão (e a segunda): em volta de cada bicho que o golpe PRINCIPAL pegou, os outros por perto.
  if (t.has('hit')) {
    const raio = G().raioDaExplosao ?? 1;
    for (const pct of [efeito.explosaoPct, efeito.segundaExplosaoPct]) {
      if (!(pct > 0)) continue;
      for (const centro of atingidos) {
        for (const b of vivos) {
          if (b === centro || b.hp <= 0 || cheb(centro, b) > raio) continue;
          saida.push({ bicho: b, pct, de: centro, tipo: 'explosao' });
        }
      }
    }
  }

  // Retornar: o projétil volta e acerta de novo quem pegou na ida (o principal e os extras).
  if (projetil && efeito.retornar > 0) {
    const naIda = [...atingidos, ...saida.filter((s) => s.tipo === 'projetil').map((s) => s.bicho)];
    for (const b of naIda) if (b.hp > 0) saida.push({ bicho: b, pct: efeito.danoDoRetornoPct || 100, de: b, tipo: 'retorno' });
  }
  return saida;
}
