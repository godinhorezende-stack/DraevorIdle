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
// Os efeitos se combinam em cadeia — ver `resolver`.
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

/*
 * ---- O RESOLVEDOR de um uso da skill (pedido do dono, 01/10) ----
 *
 * Os efeitos se COMBINAM em cadeia, cada projétil por conta própria:
 *
 *   1. O golpe principal (`atingidos`, que o `disparar` já acertou) é um IMPACTO.
 *   2. Skill de projétil: o principal sai de quem lança para o alvo; os EXTRAS
 *      (Multiple/Greater/Extra Projectile) para os bichos mais perto de quem lança
 *      (decisão do dono: sem trajetória em leque) — cada um é um projétil inteiro.
 *   3. A cada impacto, o projétil segue nesta ordem (a do Path of Exile):
 *        Pierce  → atravessa e segue na MESMA reta (se há bicho adiante);
 *        Fork    → se divide em N para os bichos mais perto (uma vez por projétil);
 *        Chain   → salta para o bicho mais perto;
 *        fim     → e, com Returning, volta acertando de novo cada um que pegou
 *                  na ida (uma vez cada).
 *      Um projétil nunca acerta o mesmo bicho duas vezes na ida.
 *   4. TODO impacto (direto, perfuração, bifurcação, encadeamento, retorno) EXPLODE
 *      com Explosion: um quadrado de `explosao.lado` casas (3 = 3×3) centrado no bicho
 *      do impacto, pegando TODOS dentro — inclusive ele (decisões do dono). Explosões
 *      sobrepostas acumulam. Explosão não gera explosão.
 *
 * O % de cada golpe é do dano da skill: o projétil carrega o dele (principal 100%,
 * extra `danoDosExtrasPct`, filho de Fork `danoDaBifurcacaoPct` do pai...), cada
 * perfuração/salto/retorno é o % da support × o do projétil, e a explosão é o
 * `explosaoPct` × o % do impacto que a gerou. Tetos por uso (`limites`): impactos
 * secundários e explosões — passou, para (e devolve `cortado`).
 *
 * Só geometria e contas de %: devolve QUEM leva, com quantos %, de ONDE e de que
 * TIPO, e as explosões (para a tela). Quem calcula o dano é o `disparar`
 * (acoes.mjs), um acerto por vez — o mesmo caminho do golpe principal.
 */
export function resolver({ efeito, tags, origem, alvo, atingidos = [], vivos, alcance }) {
  const golpes = [];
  const explosoes = [];
  const r = { golpes, explosoes, cortado: false };
  if (!efeito) return r;
  const t = new Set(tags ?? []);
  const cfg = G();
  const lado = Math.max(1, Math.round(cfg.explosao?.lado ?? 2 * (cfg.raioDaExplosao ?? 1) + 1));
  const raio = Math.floor(lado / 2);
  const maxImpactos = cfg.limites?.impactosPorUso ?? 60;
  const maxExplosoes = cfg.limites?.explosoesPorUso ?? 30;
  // Os vivos no começo do uso, por casa: a busca da área e da reta é por casa, sem varrer todos.
  const vivosNoInicio = vivos.filter((b) => b.hp > 0);
  const porCasa = new Map(vivosNoInicio.map((b) => [`${b.x},${b.y}`, b]));
  const pctsDaExplosao = t.has('hit') ? [efeito.explosaoPct, efeito.segundaExplosaoPct].filter((p) => p > 0) : [];
  let impactos = 0;
  let nExplosoes = 0;

  const explodir = (centro, pctDoImpacto) => {
    for (const pctDaExplosao of pctsDaExplosao) {
      if (nExplosoes >= maxExplosoes) {
        r.cortado = true;
        return;
      }
      nExplosoes++;
      const ponto = { x: centro.x, y: centro.y };
      explosoes.push({ ...ponto, lado });
      const pct = (pctDaExplosao * pctDoImpacto) / 100;
      for (let dx = -raio; dx <= raio; dx++) {
        for (let dy = -raio; dy <= raio; dy++) {
          const b = porCasa.get(`${ponto.x + dx},${ponto.y + dy}`);
          if (b) golpes.push({ bicho: b, pct, de: ponto, tipo: 'explosao' });
        }
      }
    }
  };
  /** Um impacto: o golpe (o direto já foi dado pelo `disparar`) e a explosão. `false` = bateu no teto. */
  const impacto = (bicho, pct, de, tipo, direto) => {
    if (!direto) {
      if (impactos >= maxImpactos) {
        r.cortado = true;
        return false;
      }
      impactos++;
      golpes.push({ bicho, pct, de, tipo });
    }
    explodir(bicho, pct);
    return true;
  };

  if (!(t.has('projectile') && alvo)) {
    // Sem projétil (alvo único, cadeia da magia, corpo a corpo com Impact): cada golpe principal é um impacto.
    for (const b of atingidos) impacto(b, 100, origem, 'direto', true);
    return r;
  }

  const pctDe = (k) => efeito[k] || 100;
  /** Um projétil: sai de `de` com `pct`% e acerta `primeiro`; daí segue as supports. */
  const voar = (projetil, primeiro, tipo, direto = false) => {
    const p = { acertados: new Set(), ida: [], ...projetil };
    let atual = primeiro;
    let pct = p.pct;
    let de = p.de;
    let reta = casasDaReta(p.de, primeiro, alcance + 2);
    let tipoAtual = tipo;
    let eDireto = direto;
    while (atual) {
      if (!impacto(atual, pct, de, tipoAtual, eDireto)) return;
      p.acertados.add(atual);
      p.ida.push(atual);
      eDireto = false;
      de = atual;
      // Pierce: o próximo bicho na MESMA reta, adiante deste.
      if (p.perfurar > 0) {
        const daqui = reta.findIndex((c) => c.x === atual.x && c.y === atual.y);
        const adiante = daqui >= 0 ? reta.slice(daqui + 1) : [];
        const proximo = adiante.map((c) => porCasa.get(`${c.x},${c.y}`)).find((b) => b && !p.acertados.has(b));
        if (proximo) {
          p.perfurar--;
          atual = proximo;
          pct = (p.pct * pctDe('danoDaPerfuracaoPct')) / 100;
          tipoAtual = 'perfuracao';
          continue;
        }
      }
      // Fork: se divide em N (uma vez por projétil); os filhos seguem sozinhos e este acaba.
      if (p.bifurcar > 0) {
        const pctDoFilho = (p.pct * pctDe('danoDaBifurcacaoPct')) / 100;
        for (const b of maisPerto(vivosNoInicio, atual, cfg.distanciaDaBifurcacao ?? 4, p.bifurcar, p.acertados)) {
          voar({ de: atual, pct: pctDoFilho, perfurar: p.perfurar, bifurcar: 0, encadear: p.encadear, volta: false, acertados: new Set(p.acertados) }, b, 'bifurcacao');
        }
        break;
      }
      // Chain: salta para o mais perto (a nova reta é a do salto).
      if (p.encadear > 0) {
        const [proximo] = maisPerto(vivosNoInicio, atual, cfg.distanciaDoEncadeamento ?? 4, 1, p.acertados);
        if (proximo) {
          p.encadear--;
          reta = casasDaReta(atual, proximo, alcance + 2);
          atual = proximo;
          pct = (p.pct * pctDe('danoDoEncadeamentoPct')) / 100;
          tipoAtual = 'encadeamento';
          continue;
        }
      }
      break;
    }
    // Returning: na volta, acerta de novo cada um que pegou na ida — uma vez cada, do último ao primeiro.
    if (p.volta) {
      const pctDaVolta = (p.pct * pctDe('danoDoRetornoPct')) / 100;
      for (const b of [...p.ida].reverse()) if (!impacto(b, pctDaVolta, b, 'retorno', false)) return;
    }
  };

  const base = { perfurar: efeito.perfurar || 0, bifurcar: efeito.bifurcar || 0, encadear: efeito.encadear || 0, volta: efeito.retornar > 0 };
  // O principal: o golpe direto no alvo (já dado) e o que vem dele.
  voar({ ...base, de: origem, pct: 100 }, alvo, 'direto', true);
  // Outros golpes principais da skill (a cadeia da própria magia): impactos.
  for (const b of atingidos) if (b !== alvo) impacto(b, 100, origem, 'direto', true);
  // Os extras: os bichos mais perto de quem lança (fora o alvo), cada um um projétil inteiro.
  if (efeito.alvosExtras > 0) {
    const fora = new Set([alvo, ...atingidos]);
    for (const b of maisPerto(vivosNoInicio, origem, alcance, efeito.alvosExtras, fora)) voar({ ...base, de: origem, pct: pctDe('danoDosExtrasPct') }, b, 'projetil');
  }
  return r;
}

/** Compatibilidade: só a lista dos golpes de `resolver`. */
export const secundarios = (args) => resolver(args).golpes;
