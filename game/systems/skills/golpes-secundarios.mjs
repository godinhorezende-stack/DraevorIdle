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
import * as Areas from '../../engine/areas.mjs';

const G = () => CONFIG.golpesSecundarios ?? {};
const cheb = Areas.distancia;

// A geometria (reta, aumentar/concentrar área, o quadrado da explosão) é a compartilhada: `engine/areas.mjs`.
/** As casas de uma reta de `de` na direção de `para`, até `alcance` casas de `de` (sem `de`). */
export const casasDaReta = Areas.reta;
/** A área aumentada (`n` > 0) ou concentrada (`n` < 0) — ver `Areas.mudar`. */
export const mudarArea = Areas.mudar;

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
 *
 * ---- A EMISSÃO (dono, 11/10: "A skill deve disparar os 12 projéteis, independentemente da quantidade de mobs") ----
 * A skill de projétil (sem área) SEMPRE emite o seu total: a quantidade BASE da gema ("Dispara 15 projéteis" — `projeteisBase`, 1 sem ela)
 * + os adicionais (`alvosExtras`: a gema, os suportes, as peças). Cada um sai de quem lança com a sua trajetória (`emitidos`: de, para,
 * o bicho que acerta ou null). Quem acerta continua a regra de antes — o principal no alvo, cada extra num bicho DIFERENTE, o mais perto
 * (o PoE: projéteis do mesmo uso não acertam o mesmo inimigo) —, e os que sobram sem bicho saem assim mesmo e erram (até o alcance, em
 * leque). Na gema que "Dispara Projéteis em sequência" (`sequencia`, a Barragem) os que sobram vão no alvo, como no PoE. Sem alvo nenhum
 * (0 bichos), os projéteis saem todos e erram. A emissão não diminui com quem erra nem com quem morre no meio.
 */
export function resolver({ efeito, tags, origem, alvo, atingidos = [], vivos, alcance, area = false, rumo = null, rng = Math.random, andavel = null }) {
  const golpes = [];
  const explosoes = [];
  const emitidos = [];
  const r = { golpes, explosoes, emitidos, cortado: false };
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
      // O quadrado da explosão: a MESMA conta que a tela usa para desenhá-la (`Areas.casasDoEvento`).
      for (const c of Areas.quadrado(ponto, raio)) {
        const b = porCasa.get(Areas.chave(c));
        if (b) golpes.push({ bicho: b, pct, de: ponto, tipo: 'explosao' });
      }
    }
  };
  /**
   * Um impacto: o golpe (o direto já foi dado pelo `disparar`) e a explosão. `false` = bateu no teto. (13/10) `meta`: o que o PROJÉTIL já fez
   * antes deste acerto — `atravessados` (os inimigos que ele Perfurou) e `ricochetes` (as vezes que Ricocheteou): "Projéteis causam Dano
   * aumentado para cada Inimigo Atravessado / para cada vez que Ricochetearam" (`acoes`).
   */
  const impacto = (bicho, pct, de, tipo, direto, meta = null) => {
    if (!direto) {
      if (impactos >= maxImpactos) {
        r.cortado = true;
        return false;
      }
      impactos++;
      golpes.push({ bicho, pct, de, tipo, ...(meta ?? {}) });
    }
    explodir(bicho, pct);
    return true;
  };

  // A EMISSÃO: o total de projéteis da skill e a trajetória de cada um (o que erra vai até o alcance, em leque em volta do rumo).
  const deProjetil = t.has('projectile') && !area;
  const total = deProjetil ? Math.max(1, Math.round(Number(efeito.projeteisBase) || 1)) + Math.max(0, Math.round(Number(efeito.alvosExtras) || 0)) : 0;
  const mira = alvo ?? rumo ?? { x: origem.x, y: origem.y + 1 };
  // (lote 42: o rumo exato para leste é o ângulo 0 — antes o `|| π/2` o trocava pelo sul, e o leque dos que erram saía para o lado errado;
  // o sul só quando a mira é a própria casa de quem lança)
  const anguloDoRumo = mira.x === origem.x && mira.y === origem.y ? Math.PI / 2 : Math.atan2(mira.y - origem.y, mira.x - origem.x);
  const passo = total > 1 ? Math.min(Math.PI / 8, (2 * Math.PI) / total) : 0;
  const pontoDoProjetil = (k) => {
    const a = anguloDoRumo + (k - (total - 1) / 2) * passo;
    return { x: Math.round(origem.x + Math.cos(a) * alcance), y: Math.round(origem.y + Math.sin(a) * alcance) };
  };
  const emitir = (bicho, tipo, k) => emitidos.push({ de: { x: origem.x, y: origem.y }, para: bicho ? { x: bicho.x, y: bicho.y } : pontoDoProjetil(k), bicho: bicho ?? null, tipo });


  const pctDe = (k) => efeito[k] || 100;
  /** Um projétil: sai de `de` com `pct`% e acerta `primeiro`; daí segue as supports. */
  const voar = (projetil, primeiro, tipo, direto = false) => {
    const p = { acertados: new Set(), ida: [], perfurados: 0, ricocheteou: 0, ...projetil };
    let atual = primeiro;
    let pct = p.pct;
    let de = p.de;
    let reta = casasDaReta(p.de, primeiro, alcance + 2);
    let tipoAtual = tipo;
    let eDireto = direto;
    while (atual) {
      if (!impacto(atual, pct, de, tipoAtual, eDireto, { atravessados: p.perfurados, ricochetes: p.ricocheteou })) return;
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
          p.perfurados++;
          atual = proximo;
          pct = (p.pct * pctDe('danoDaPerfuracaoPct')) / 100;
          tipoAtual = 'perfuracao';
          continue;
        }
      }
      // Fork: se divide em N (uma vez por projétil); os filhos seguem sozinhos e este acaba.
      if (p.bifurcar > 0) {
        const pctDoFilho = (p.pct * pctDe('danoDaBifurcacaoPct')) / 100;
        // (13/10) "Projéteis têm X% de chance de receber um Projétil adicional quando Difundindo": um filho a mais. Os filhos levam o que o
        // projétil já atravessou e ricocheteou.
        const filhos = p.bifurcar + (efeito.bifurcarExtraChance > 0 && rng() * 100 < efeito.bifurcarExtraChance ? 1 : 0);
        for (const b of maisPerto(vivosNoInicio, atual, cfg.distanciaDaBifurcacao ?? 4, filhos, p.acertados)) {
          voar({ de: atual, pct: pctDoFilho, perfurar: p.perfurar, bifurcar: (p.deNovo ?? 0) > 0 ? 2 : 0, deNovo: Math.max(0, (p.deNovo ?? 0) - 1), encadear: p.encadear, volta: false, acertados: new Set(p.acertados), perfurados: p.perfurados, ricocheteou: p.ricocheteou }, b, 'bifurcacao');
        }
        break;
      }
      // Chain: salta para o mais perto (a nova reta é a do salto).
      if (p.encadear > 0) {
        // (14/10: × o "Alcance do Ricochete aumentado", a fração como chance; lote 40: a gema do PoE salta 6 m — 3 casas —, o do PoE 2, pela
        // decisão do dono — `ricochetePoe`)
        const salto = (efeito.ricochetePoe ? cfg.ricochetePoe?.projetil ?? 3 : cfg.distanciaDoEncadeamento ?? 4) * Math.max(0, 1 + (Number(efeito.alcanceRicochetePct) || 0) / 100);
        const [proximo] = maisPerto(vivosNoInicio, atual, Math.floor(salto) + (rng() < salto % 1 ? 1 : 0), 1, p.acertados);
        if (proximo) {
          p.encadear--;
          p.ricocheteou++;
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
      for (const b of [...p.ida].reverse()) if (!impacto(b, pctDaVolta, b, 'retorno', false, { atravessados: p.perfurados, ricochetes: p.ricocheteou })) return;
    }
  };

  // (14/10: `deNovo` — "Difundem e Difundem de novo": os filhos difundem outra vez, em 2)
  // (14/10, por projétil: "N% de chance de Retornarem a você" — a volta. O "Ricochetear ao colidirem com o terreno" é a batida de verdade desde o
  // lote 42 — `naParede`.)
  const base = () => ({
    perfurar: efeito.perfurar || 0, bifurcar: efeito.bifurcar || 0, deNovo: efeito.bifurcar > 0 ? efeito.bifurcarDeNovo || 0 : 0,
    encadear: efeito.encadear || 0,
    volta: efeito.retornar > 0 || (efeito.retornarChance > 0 && rng() * 100 < efeito.retornarChance),
  });
  /**
   * (lote 42, P053 — dono: "Fazer todos") "Projéteis têm X% de chance de conseguirem Ricochetear ao colidirem com o terreno": o projétil que não
   * acerta ninguém voa até o alcance; se no caminho há TERRENO (uma casa que não se anda — a grade do andar, `andavel`), ele bate ali e, na
   * chance, ricocheteia — salta para o inimigo vivo mais perto do ponto da batida, até a distância do ricochete (o dano do encadeamento).
   */
  const naParede = (para, pct) => {
    if (!andavel || !(efeito.ricocheteTerrenoChance > 0)) return;
    const reta = casasDaReta(origem, para, alcance);
    const i = reta.findIndex((c) => !andavel.has(`${c.x},${c.y}`));
    if (i < 0 || !(rng() * 100 < efeito.ricocheteTerrenoChance)) return;
    const ponto = i > 0 ? { x: reta[i - 1].x, y: reta[i - 1].y } : { x: origem.x, y: origem.y };
    const salto = (efeito.ricochetePoe ? cfg.ricochetePoe?.projetil ?? 3 : cfg.distanciaDoEncadeamento ?? 4) * Math.max(0, 1 + (Number(efeito.alcanceRicochetePct) || 0) / 100);
    const [b] = maisPerto(vivosNoInicio, ponto, Math.floor(salto) + (rng() < salto % 1 ? 1 : 0), 1, new Set());
    if (b) voar({ ...base(), de: ponto, pct: (pct * pctDe('danoDoEncadeamentoPct')) / 100, ricocheteou: 1 }, b, 'encadeamento');
  };
  /**
   * (lote 42, P067 — dono: "Fazer todos") "Projéteis são disparados em direções aleatórias": TODOS os projéteis — o principal também (o
   * `disparar` não dá o golpe direto) — saem em direções sorteadas; cada um voa em linha reta até o alcance e acerta o primeiro inimigo do
   * caminho (daí segue as supports); o que não acha ninguém pode bater no terreno (`naParede`).
   */
  if (efeito.direcoesAleatorias && deProjetil) {
    for (let k = 0; k < total; k++) {
      const angulo = rng() * 2 * Math.PI;
      const fim = { x: Math.round(origem.x + Math.cos(angulo) * alcance), y: Math.round(origem.y + Math.sin(angulo) * alcance) };
      const bicho = casasDaReta(origem, fim, alcance).map((c) => porCasa.get(`${c.x},${c.y}`)).find((b) => b && b.hp > 0) ?? null;
      const pct = k ? pctDe('danoDosExtrasPct') : 100;
      emitidos.push({ de: { x: origem.x, y: origem.y }, para: bicho ? { x: bicho.x, y: bicho.y } : fim, bicho, tipo: 'projetil' });
      if (bicho) voar({ ...base(), de: origem, pct }, bicho, 'projetil');
      else naParede(fim, pct);
    }
    return r;
  }
  if (!(t.has('projectile') && alvo)) {
    // Sem projétil (alvo único, cadeia da magia, corpo a corpo com Impact): cada golpe principal é um impacto.
    for (const b of atingidos) impacto(b, 100, origem, 'direto', true);
    // (a skill de projétil SEM alvo: os projéteis saem todos, e erram — e podem bater no terreno, `naParede`)
    for (let k = 0; k < total; k++) {
      emitir(null, 'projetil', k);
      naParede(pontoDoProjetil(k), 100);
    }
    return r;
  }
  // O principal: o golpe direto no alvo (já dado) e o que vem dele.
  emitir(alvo, 'direto', 0);
  voar({ ...base(), de: origem, pct: 100 }, alvo, 'direto', true);
  // Outros golpes principais da skill (a cadeia da própria magia): impactos.
  for (const b of atingidos) if (b !== alvo) impacto(b, 100, origem, 'direto', true);
  // Os extras (o total menos o principal): os bichos mais perto de quem lança (fora o alvo), cada um um projétil inteiro; os que sobram
  // sem bicho saem e erram — ou, "em sequência", vão no alvo.
  const extras = total - 1;
  if (extras > 0) {
    const fora = new Set([alvo, ...atingidos]);
    // (14/10) "Barragens de Projéteis não se propagam": a barragem (em sequência) vai toda no alvo; "Projéteis são disparados em direções
    // aleatórias": os extras vão em bichos sorteados no alcance (não nos mais perto)
    const todosNoAlvo = efeito.sequencia && efeito.semPropagar;
    const noAlcance = (vivosNoInicio ?? []).filter((b) => b.hp > 0 && !fora.has(b) && cheb(origem, b) <= alcance);
    const sorteados = () => { const l = [...noAlcance]; const saida = []; while (l.length && saida.length < extras) saida.push(l.splice(Math.floor(rng() * l.length), 1)[0]); return saida; };
    const comBicho = todosNoAlvo ? [] : efeito.direcoesAleatorias ? sorteados() : maisPerto(vivosNoInicio, origem, alcance, extras, fora);
    comBicho.forEach((b, i) => { emitir(b, 'projetil', i + 1); voar({ ...base(), de: origem, pct: pctDe('danoDosExtrasPct') }, b, 'projetil'); });
    for (let k = comBicho.length + 1; k <= extras; k++) {
      if (efeito.sequencia && alvo.hp > 0) {
        emitir(alvo, 'projetil', k);
        voar({ ...base(), de: origem, pct: pctDe('danoDosExtrasPct') }, alvo, 'projetil');
      } else {
        emitir(null, 'projetil', k);
        naParede(pontoDoProjetil(k), pctDe('danoDosExtrasPct'));
      }
    }
  }
  return r;
}

/** Compatibilidade: só a lista dos golpes de `resolver`. */
export const secundarios = (args) => resolver(args).golpes;
