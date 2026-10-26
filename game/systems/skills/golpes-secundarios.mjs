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
//
// (lote A3 — EXCEÇÕES DO DONO, 19/10: as escolhas sem fonte do lote, aceitas pelo dono)
//   1. a Hélice Espectral só atravessa (a descrição: "causando dano aos inimigos em seu caminho") — não retorna;
//   2. o salto no solo (o Magma Rolante, o Vaal Golpe Fundido) é o quadrado de 1 casa de raio (o PoB: 1,4 + 0,4 m ≈ 1 casa);
//   3. os projéteis da divisão têm o dano inteiro, buscam alvo no alcance da habilidade a partir do ponto atingido e os que sobram saem em leque
//      de π/8;
//   4. as origens laterais da Saraivada (Volley) ficam a 1 casa por ponto, alternando os lados;
//   5. na Nova de Flechas o principal é o que cai no alvo, e os outros não acertam um bicho já acertado no uso (projéteis simultâneos do PoE);
//   6. a Fuzilaria Cinética: o "+8% dano" é "mais", somado aos +4% da qualidade (12% por projétil anterior);
//   7. a Mina Locus arredonda o "30% menos Projéteis" para baixo;
//   8. as rebatidas não contam como Ricochete para os modificadores "por Ricochete";
//   9. na volta que atravessa, cada bicho leva o golpe uma vez.
//
// (lote A3c, dono 19/10: "Fazer como o PoE") a ÁREA NO IMPACTO dos projéteis com raio-base no PoB (`areaNoImpacto` — a Bola de Fogo, o Magma
// Rolante, o Aço Divisor, a Fuzilaria Cinética…): todo impacto do projétil que acerta (o principal e os extras, a perfuração, a divisão, a difusão,
// o ricochete, a rebatida e o retorno) é um acerto em ÁREA — quem está no quadrado do raio em volta do atingido leva um acerto com o mesmo % do
// projétil; o atingido leva um só (o do projétil É o da área); o mesmo bicho não leva duas vezes do MESMO projétil na ida (quem a área pegou sai
// dos alvos dele: não é atravessado nem ricocheteado depois), e a volta é outra passada (acerta de novo, como o retorno do PoE). Os saltos no solo
// do Magma (exceção 2) já são áreas: não somam outra.
import { CONFIG } from './gemas.mjs';
import * as Areas from '../../engine/areas.mjs';
import * as GemasPR3 from '../itens-poe/gemas-pr3.mjs';

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
/**
 * (lote PR3, dono 21/10) As EXPLOSÕES da Explosão Cinética num impacto (`kin`: `{ n, pct, raio, raioSec }` em casas, de `cineticaDoUso`): a do ponto e as `n`
 * adicionais em pontos sorteados no quadrado do raio secundário (`GemasPR3.pontoDaExplosao`), cada uma o quadrado do raio, pegando todos dentro (o atingido também —
 * a exceção 5 do lote); o % de cada uma: o do impacto × o do "menos Dano em Área". Devolve false quando bateu no teto (`max`).
 */
function explosoesCineticas({ ponto, z, kin, porCasa, pctDoImpacto, rng, golpes, explosoes, conta, max, andavel = null }) {
  const pct = (pctDoImpacto * kin.pct) / 100;
  const raio = Math.max(0, Math.round(kin.raio ?? 0));
  // (dono, 21/10) com o terreno do andar, a explosão a mais só cai numa casa andável com a linha livre até o ponto do impacto (não dentro nem atrás da parede)
  const anda = (c) => andavel.has(`${c.x},${c.y}`);
  const pode = andavel ? (c) => anda(c) && Areas.reta(ponto, c, Math.max(Math.abs(c.x - ponto.x), Math.abs(c.y - ponto.y))).every(anda) : null;
  for (let i = 0; i <= Math.max(0, Math.round(kin.n ?? 0)); i++) {
    if (conta.n >= max) return false;
    conta.n++;
    const c0 = i === 0 ? { x: ponto.x, y: ponto.y } : GemasPR3.pontoDaExplosao(ponto, Math.max(0, Math.round(kin.raioSec ?? 0)), rng, pode);
    explosoes.push({ ...c0, lado: 2 * raio + 1, cinetica: true });
    for (const c of Areas.quadrado(c0, raio)) {
      const b = porCasa.get(Areas.chave(c));
      if (b && b.hp > 0 && (b.z ?? 0) === z) golpes.push({ bicho: b, pct, de: c0, tipo: 'explosao', cinetica: true });
    }
  }
  return true;
}

/*
 * (lote PR3, dono 21/10) O resolvedor do uso com o que vem DEPOIS dele: as explosões da Explosão Cinética no fim do voo dos projéteis que erram (a exceção 5 do lote
 * PR3 — as dos impactos saem no `impacto`) e o "X% menos Dano nos acertos após o primeiro em cada Inimigo" do Aço Perfurador (`GemasPR3.menosAposOPrimeiro`: o
 * golpe direto conta como o primeiro).
 */
export function resolver(args) {
  const r = resolverDoUso(args);
  const { efeito, tags, origem, vivos = [], area = false, rng = Math.random, cinetica = null, atingidos = [], andavel = null, alcance } = args;
  const t = new Set(tags ?? []);
  if (cinetica && efeito && t.has('projectile') && !area) {
    const porCasa = new Map(vivos.filter((b) => b.hp > 0).map((b) => [`${b.x},${b.y}`, b]));
    // (revisão do PR3, 21/10) o teto conta EXPLOSÕES (a unidade de `explosoesCineticas` e do `explosoesCineticasPorUso`): começa pelas dos impactos, não pelos golpes
    const conta = { n: r.explosoes.filter((e) => e.cinetica).length };
    const max = G().limites?.explosoesCineticasPorUso ?? 90;
    // (revisão do PR3, 21/10) onde o voo PARA: o projétil que erra e bate no TERRENO no caminho explode ali ("pequenas explosões em volta do ponto de impacto" —
    // bater no terreno é o impacto), não no fim do alcance; o mesmo critério de `terrenoNaReta`
    const fimDoVoo = (p) => {
      if (!andavel) return p.para;
      const reta = casasDaReta(p.de ?? origem, p.para, alcance);
      const i = reta.findIndex((c) => !andavel.has(`${c.x},${c.y}`));
      const de = p.de ?? origem;
      return i < 0 ? p.para : i > 0 ? { x: reta[i - 1].x, y: reta[i - 1].y } : { x: de.x, y: de.y };
    };
    for (const p of r.emitidos) {
      if (p.bicho || !p.para) continue;
      const pct = p.tipo === 'direto' ? 100 : (Number(efeito.danoDosExtrasPct) || 100);
      if (!explosoesCineticas({ ponto: fimDoVoo(p), z: origem?.z ?? 0, kin: cinetica, porCasa, pctDoImpacto: pct, rng, golpes: r.golpes, explosoes: r.explosoes, conta, max, andavel })) { r.cortado = true; break; }
    }
  }
  if (efeito?.lanca?.menosPct > 0) GemasPR3.menosAposOPrimeiro(r.golpes, efeito.lanca.menosPct, atingidos);
  return r;
}

function resolverDoUso({ efeito, tags, origem, alvo, atingidos = [], vivos, alcance, area = false, rumo = null, rng = Math.random, andavel = null, areaNoImpacto = null, cinetica = null, divisaoNoAlvo = null }) {
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
  // (lote A3c) a área no impacto: o raio em casas (já sorteado no uso — `Acoes.disparar`) e o teto de áreas por uso
  const raioNoImpacto = areaNoImpacto && t.has('projectile') && !area ? Math.max(0, Math.round(Number(areaNoImpacto.raio) || 0)) : null;
  const maxAreas = cfg.limites?.areasNoImpactoPorUso ?? 60;
  let nAreas = 0;
  // (lote PR3) as explosões da Explosão Cinética (`cinetica`, já em casas — `Acoes.cineticaDoUso`)
  const kin = cinetica && t.has('projectile') && !area ? cinetica : null;
  const contaCinetica = { n: 0 };
  /**
   * (lote A3c) A ÁREA do impacto do projétil `p` em `centro` (o bicho atingido): os vivos do andar dele no quadrado do raio, fora o próprio e os
   * que este projétil já acertou nesta passada (`ja`: os alvos da ida, ou os da volta); cada um leva um acerto com o % do impacto e o que o
   * projétil já fez (`meta`). `tipo`: o do impacto (o golpe da área sai como 'impacto', com `doImpacto` = ele; o direto, null).
   */
  const areaDoImpacto = (centro, pct, tipo, meta, ja) => {
    if (raioNoImpacto == null || !ja) return;
    if (areaNoImpacto.soNosExtras && tipo === 'direto') return;
    if (nAreas >= maxAreas) {
      r.cortado = true;
      return;
    }
    nAreas++;
    const ponto = { x: centro.x, y: centro.y };
    explosoes.push({ ...ponto, lado: 2 * raioNoImpacto + 1, impacto: true });
    const z = centro.z ?? 0;
    for (const c of Areas.quadrado(ponto, raioNoImpacto)) {
      const b = porCasa.get(Areas.chave(c));
      if (!b || b === centro || !(b.hp > 0) || (b.z ?? 0) !== z || ja.has(b)) continue;
      ja.add(b);
      golpes.push({ bicho: b, pct, de: ponto, tipo: 'impacto', doImpacto: tipo === 'direto' ? null : tipo, ...(meta ?? {}) });
    }
  };

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
  // (lote A3c: + `ja` — os que este projétil já acertou na passada; com ele, o impacto é em área — `areaDoImpacto`)
  const impacto = (bicho, pct, de, tipo, direto, meta = null, ja = null) => {
    if (!direto) {
      if (impactos >= maxImpactos) {
        r.cortado = true;
        return false;
      }
      impactos++;
      golpes.push({ bicho, pct, de, tipo, ...(meta ?? {}) });
    }
    explodir(bicho, pct);
    areaDoImpacto(bicho, pct, tipo, meta, ja);
    // (lote PR3) as explosões da Explosão Cinética em todo impacto que acerta
    if (kin && !explosoesCineticas({ ponto: bicho, z: bicho.z ?? 0, kin, porCasa, pctDoImpacto: pct, rng, golpes, explosoes, conta: contaCinetica, max: cfg.limites?.explosoesCineticasPorUso ?? 90, andavel })) r.cortado = true;
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
  // (17/10, lote G18) o Chicote da Naja: "X% mais Dano com Acertos e Afecções por Ricochete restante" — cada impacto do projétil × (1 + X% × os
  // ricochetes que ainda faltam; o PoB: PerStat ChainRemaining)
  const porRestante = Number(efeito.pctPorRicocheteRestante) || 0;
  const doRestante = (n) => (porRestante ? 1 + (porRestante * Math.max(0, n ?? 0)) / 100 : 1);
  // (lote A3, dono 19/10) o salto do ricochete (a gema do PoE: 3 casas — `ricochetePoe`), o mesmo nas rebatidas e na divisão no terreno
  const distanciaDoSalto = () => {
    const salto = (efeito.ricochetePoe ? cfg.ricochetePoe?.projetil ?? 3 : cfg.distanciaDoEncadeamento ?? 4) * Math.max(0, 1 + (Number(efeito.alcanceRicochetePct) || 0) / 100);
    return Math.floor(salto) + (rng() < salto % 1 ? 1 : 0);
  };
  // (lote A3) o PONTO a `alcance` casas de `de`, no ângulo `a` (os projéteis que erram, a divisão sem alvo, o círculo, as origens laterais)
  const noAngulo = (de, a, dist = alcance) => ({ x: Math.round(de.x + Math.cos(a) * dist), y: Math.round(de.y + Math.sin(a) * dist) });
  const anguloDe = (de, para) => (para.x === de.x && para.y === de.y ? anguloDoRumo : Math.atan2(para.y - de.y, para.x - de.x));
  /** O primeiro bicho vivo na reta de `de` a `fim` (até `alcance` casas), fora de `fora`. */
  const primeiroNaReta = (de, fim, fora) => casasDaReta(de, fim, alcance).map((c) => porCasa.get(`${c.x},${c.y}`)).find((b) => b && b.hp > 0 && !fora.has(b)) ?? null;
  /**
   * (lote A3, dono 19/10 — D5: "o projétil se divide a partir do alvo atingido em N projéteis para os mais próximos", como no PoE) A DIVISÃO: de
   * `ponto`, `n` projéteis inteiros para os `n` bichos vivos mais perto dele (no alcance da habilidade), fora dos que o projétil já acertou; os que
   * sobram sem bicho saem em leque e erram (a emissão não diminui com quem não está lá — dono, 11/10). Um projétil se divide uma vez; os filhos não
   * se dividem de novo.
   */
  const dividir = (p, ponto, pct) => {
    const n = Math.max(0, Math.round(p.dividir || 0));
    p.dividir = 0;
    if (!n) return;
    const de = { x: ponto.x, y: ponto.y };
    const alvos = maisPerto(vivosNoInicio, de, alcance, n, p.acertados);
    for (const b of alvos) voar({ de, pct, perfurar: p.perfurar, bifurcar: p.bifurcar, deNovo: p.deNovo, encadear: p.encadear, volta: false, dividir: 0, acertados: new Set(p.acertados), perfurados: p.perfurados, ricocheteou: p.ricocheteou, ordem: p.ordem }, b, 'divisao');
    const rumoDaDivisao = anguloDe(origem, de);
    for (let k = alvos.length; k < n; k++) emitidos.push({ de, para: noAngulo(de, rumoDaDivisao + (k - (n - 1) / 2) * (Math.PI / 8)), bicho: null, tipo: 'divisao' });
  };
  /**
   * (lote PR1, dono 20/10) as ESTILHAS do Arremesso de Escudo Espectral (`efeito.estilhas`: `{ n, pct }`): a cada colisão do escudo com um inimigo, N projéteis
   * saem dele em direções sorteadas, cada um com o % das estilhas ("50% menos Dano": 50), perfurando todos; o inimigo em que o escudo colidiu não leva a dele
   * (exceção 1 do lote). Elas não ricocheteiam, não difundem e não voltam (atravessam todos — no PoE o atravessar vem antes).
   */
  const soltarEstilhas = (ponto) => {
    const n = Math.max(0, Math.round(Number(efeito.estilhas?.n) || 0));
    const pct = Number(efeito.estilhas?.pct) || 0;
    for (let k = 0; k < n; k++) {
      const de = { x: ponto.x, y: ponto.y };
      const fim = noAngulo(de, rng() * 2 * Math.PI);
      const fora = new Set([ponto]);
      const bicho = primeiroNaReta(de, fim, fora);
      emitidos.push({ de, para: bicho ? { x: bicho.x, y: bicho.y } : fim, bicho, tipo: 'estilha' });
      if (bicho && pct > 0) voar({ perfurar: 99, bifurcar: 0, deNovo: 0, encadear: 0, volta: false, dividir: 0, rebatidas: 0, soNaVolta: false, ordem: ordens++, de, pct, acertados: fora }, bicho, 'estilha');
    }
  };
  /** Um projétil: sai de `de` com `pct`% e acerta `primeiro`; daí segue as supports. */
  const voar = (projetil, primeiro, tipo, direto = false) => {
    const p = { acertados: new Set(), ida: [], perfurados: 0, ricocheteou: 0, ...projetil };
    let atual = primeiro;
    let pct = p.pct * doRestante(p.encadear);
    let de = p.de;
    let reta = casasDaReta(p.de, primeiro, alcance + 2);
    let tipoAtual = tipo;
    let eDireto = direto;
    let ultimo = primeiro;
    // (revisão do A3) o projétil que se DIFUNDIU acaba ali: não rebate nem retorna (os filhos seguem)
    let difundiu = false;
    const atravessaTodos = (p.perfurar ?? 0) >= 99;
    // (lote A3: + `ordem` — o índice do projétil no uso, para o "por projétil disparado anteriormente em sequência")
    const meta = () => ({ atravessados: p.perfurados, ricochetes: p.ricocheteou, restantes: Math.max(0, p.encadear ?? 0), ordem: p.ordem ?? 0 });
    while (atual) {
      // (lote A3, D3: o Arremesso Espectral da Materialização "só acerta e causa dano enquanto retorna" — a ida só marca quem está no caminho)
      // (lote A3c: o impacto em área — os que ela pega entram nos acertados deste projétil)
      if (!p.soNaVolta && !impacto(atual, pct, de, tipoAtual, eDireto, meta(), p.acertados)) return;
      p.acertados.add(atual);
      p.ida.push(atual);
      ultimo = atual;
      eDireto = false;
      de = atual;
      // (lote PR1) as ESTILHAS do Arremesso de Escudo Espectral: a cada colisão do escudo com um inimigo
      if (p.estilhas) soltarEstilhas(atual);
      // (lote A3, D5) a DIVISÃO no primeiro acerto (o projétil segue o caminho dele)
      if (p.dividir > 0) dividir(p, atual, p.pct);
      // (lote G-C, dono 25/10) a Marca do Atirador: "Projéteis que Acertarem Inimigos Amaldiçoados se Dividem na direção de N alvos adicionais" — o projétil que acerta
      // o marcado se divide (uma vez; os filhos da divisão não se dividem de novo — `divisaoNoAlvo`, de `acoes`)
      else if (divisaoNoAlvo && tipoAtual !== 'divisao' && !p.dividiuNaMarca) {
        const n = Math.max(0, Math.round(Number(divisaoNoAlvo(atual)) || 0));
        if (n > 0) { p.dividiuNaMarca = true; p.dividir = n; dividir(p, atual, p.pct); }
      }
      // (revisão do PR3, 21/10 — o PoB, act_int.lua IceSpear: `PierceChance` 100 na skillPart 1, "First Form") a 1ª forma da Lança Gélida atravessa: o acerto a
      // menos de `perfuraNaPrimeiraForma` casas de quem lançou (a 2ª forma começa ali — `GemasPR3.SEGUNDA_FORMA`) atravessa sem gastar a perfuração dos suportes;
      // da 2ª forma em diante, só a dos suportes (a D10 do A3)
      // (dono, 21/10: + a da Divisão — os projéteis da divisão já são a 2ª forma)
      const primeiraForma = efeito.perfuraNaPrimeiraForma > 0 && tipo !== 'divisao' && !!origem && cheb(origem, atual) < efeito.perfuraNaPrimeiraForma;
      // Pierce: o próximo bicho na MESMA reta, adiante deste.
      if (p.perfurar > 0 || primeiraForma) {
        const daqui = reta.findIndex((c) => c.x === atual.x && c.y === atual.y);
        const adiante = daqui >= 0 ? reta.slice(daqui + 1) : [];
        const proximo = adiante.map((c) => porCasa.get(`${c.x},${c.y}`)).find((b) => b && !p.acertados.has(b));
        if (proximo) {
          if (!primeiraForma) p.perfurar--;
          // (revisão do A3: na Materialização a ida não acerta — não atravessa ninguém; a contagem é a da volta)
          if (!p.soNaVolta) p.perfurados++;
          atual = proximo;
          pct = ((p.pct * pctDe('danoDaPerfuracaoPct')) / 100) * doRestante(p.encadear);
          tipoAtual = 'perfuracao';
          continue;
        }
      }
      // Fork: se divide em N (uma vez por projétil); os filhos seguem sozinhos e este acaba.
      // (revisão do A3: com perfurar ≥ 99 — "atravessa todos" — não difunde: no PoE o atravessar tem prioridade)
      if (p.bifurcar > 0 && !atravessaTodos && !primeiraForma) {
        const pctDoFilho = (p.pct * pctDe('danoDaBifurcacaoPct')) / 100;
        // (13/10) "Projéteis têm X% de chance de receber um Projétil adicional quando Difundindo": um filho a mais. Os filhos levam o que o
        // projétil já atravessou e ricocheteou.
        const filhos = p.bifurcar + (efeito.bifurcarExtraChance > 0 && rng() * 100 < efeito.bifurcarExtraChance ? 1 : 0);
        for (const b of maisPerto(vivosNoInicio, atual, cfg.distanciaDaBifurcacao ?? 4, filhos, p.acertados)) {
          voar({ de: atual, pct: pctDoFilho, perfurar: p.perfurar, bifurcar: (p.deNovo ?? 0) > 0 ? 2 : 0, deNovo: Math.max(0, (p.deNovo ?? 0) - 1), encadear: p.encadear, volta: false, acertados: new Set(p.acertados), perfurados: p.perfurados, ricocheteou: p.ricocheteou, ordem: p.ordem }, b, 'bifurcacao');
        }
        difundiu = true;
        break;
      }
      /*
       * (lote A3, dono 19/10 — D6) o SALTO NO SOLO (o Magma Rolante, o Vaal Golpe Fundido: "Projéteis podem Ricochetear ao atingir o solo / não
       * mudam de direção ao Ricochetear"): cada ricochete é uma área a cada 3 casas, na MESMA reta do projétil — o quadrado de `raioDoSaltoNoSolo`
       * casas (1: o raio do PoB do Magma, 1,4 + 0,4 m) em volta do ponto, pegando todos dentro (cada salto é um acerto à parte, como no PoE).
       */
      if (p.encadear > 0 && efeito.saltoNoSolo) {
        const dx = atual.x - p.de.x;
        const dy = atual.y - p.de.y;
        const passos = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
        // (revisão do A3: o rumo principal só quando o projétil não tem rumo próprio — dx e dy zero; um eixo zero é uma reta naquele eixo)
        const parado = !dx && !dy;
        const ux = parado ? Math.cos(anguloDoRumo) : dx / passos;
        const uy = parado ? Math.sin(anguloDoRumo) : dy / passos;
        const raioDoSalto = Math.max(0, Math.round(cfg.raioDoSaltoNoSolo ?? 1));
        // (lote PR2, dono 20/10) o Composto Venenoso Saltador: "Ricocheteiam para direções aleatórias" — cada salto sai do anterior, 3 casas num rumo sorteado
        let ponto = { x: atual.x, y: atual.y };
        for (let i = 1; p.encadear > 0; i++) {
          p.encadear--;
          p.ricocheteou++;
          const rumo = efeito.saltoAleatorio ? rng() * 2 * Math.PI : null;
          const centro = rumo != null ? { x: Math.round(ponto.x + Math.cos(rumo) * 3), y: Math.round(ponto.y + Math.sin(rumo) * 3) } : { x: Math.round(atual.x + ux * 3 * i), y: Math.round(atual.y + uy * 3 * i) };
          ponto = centro;
          explosoes.push({ ...centro, lado: 2 * raioDoSalto + 1 });
          const pctDoSalto = ((p.pct * pctDe('danoDoEncadeamentoPct')) / 100) * doRestante(p.encadear);
          for (const c of Areas.quadrado(centro, raioDoSalto)) {
            const b = porCasa.get(Areas.chave(c));
            if (b && b.hp > 0 && !impacto(b, pctDoSalto, centro, 'encadeamento', false, meta())) return;
          }
        }
        break;
      }
      // Chain: salta para o mais perto (a nova reta é a do salto).
      if (p.encadear > 0) {
        // (14/10: × o "Alcance do Ricochete aumentado", a fração como chance; lote 40: a gema do PoE salta 6 m — 3 casas —, o do PoE 2, pela
        // decisão do dono — `ricochetePoe`)
        const [proximo] = maisPerto(vivosNoInicio, atual, distanciaDoSalto(), 1, p.acertados);
        if (proximo) {
          p.encadear--;
          p.ricocheteou++;
          reta = casasDaReta(atual, proximo, alcance + 2);
          atual = proximo;
          pct = ((p.pct * pctDe('danoDoEncadeamentoPct')) / 100) * doRestante(p.encadear);
          tipoAtual = 'encadeamento';
          continue;
        }
      }
      break;
    }
    if (difundiu) return;
    /*
     * (lote A3, dono 19/10 — D6) as REBATIDAS, com o dano inteiro do projétil (não é Ricochete: não conta para os "por Ricochete"):
     * - a Vaal Flecha Relampejante ("mudam de direção N vezes … podem Acertar alvos cada vez"): do último acerto, salta para o bicho vivo mais perto
     *   que o projétil ainda não acertou, a até a distância do ricochete (3 casas); sem bicho perto, as que sobram se perdem;
     * - a Hélice Espectral ("Rebate até N vezes" — revisão do A3, a decisão do dono: "ricochete no terreno, 100%"; a descrição: "quicando caso
     *   colida com paredes"): só rebate em PAREDE — segue a reta do último acerto até o terreno (a grade do andar, `andavel`) e, batendo, salta
     *   para o bicho vivo mais perto da batida (a distância do ricochete); a reta seguinte é a da batida até ele. Sem parede, não rebate.
     */
    if (p.rebatidas > 0 && !p.soNaVolta) {
      let ponto = ultimo;
      let vindoDe = p.de;
      for (let r = p.rebatidas; r > 0; r--) {
        let de = ponto;
        if (efeito.rebatidasNoTerreno) {
          const adiante = { x: ponto.x + (ponto.x - vindoDe.x), y: ponto.y + (ponto.y - vindoDe.y) };
          const parede = adiante.x === ponto.x && adiante.y === ponto.y ? null : terrenoNaReta(ponto, adiante);
          if (!parede) break;
          de = parede;
        }
        const [b] = maisPerto(vivosNoInicio, de, distanciaDoSalto(), 1, p.acertados);
        if (!b) break;
        vindoDe = de;
        if (!impacto(b, p.pct, de, 'rebatida', false, meta(), p.acertados)) return;
        p.acertados.add(b);
        p.ida.push(b);
        ponto = b;
        ultimo = b;
      }
    }
    // Returning: na volta, acerta de novo cada um que pegou na ida — uma vez cada, do último ao primeiro.
    // (lote A3, dono 19/10 — D4: "o retorno que Atravessa todos os Alvos acerta todos os vivos no caminho de volta, com o % da volta" — a reta do
    // último acerto até quem lançou, `voltaAtravessa`, além dos da ida)
    if (p.volta) {
      const pctDaVolta = ((p.pct * pctDe('danoDoRetornoPct')) / 100) * doRestante(p.encadear);
      const naVolta = [...p.ida].reverse();
      if (efeito.voltaAtravessa && ultimo) {
        const ja = new Set(naVolta);
        for (const c of casasDaReta(ultimo, origem, cheb(ultimo, origem))) {
          const b = porCasa.get(`${c.x},${c.y}`);
          if (b && b.hp > 0 && !ja.has(b)) { ja.add(b); naVolta.push(b); }
        }
      }
      // (revisão do A3: na Materialização — a ida não acertou ninguém — os atravessados contam os da própria volta: 0 no primeiro, 1 no segundo…)
      let naVoltaAtravessados = 0;
      // (lote A3c: a volta é outra passada — a área no impacto de cada retorno; quem uma área da volta já pegou não leva o retorno de novo)
      const daVolta = raioNoImpacto == null ? null : new Set();
      for (const b of naVolta) {
        if (daVolta?.has(b)) continue;
        daVolta?.add(b);
        const m = p.soNaVolta ? { ...meta(), atravessados: naVoltaAtravessados++ } : meta();
        if (!impacto(b, pctDaVolta, b, 'retorno', false, m, daVolta)) return;
      }
    }
  };

  // (14/10: `deNovo` — "Difundem e Difundem de novo": os filhos difundem outra vez, em 2)
  // (14/10, por projétil: "N% de chance de Retornarem a você" — a volta. O "Ricochetear ao colidirem com o terreno" é a batida de verdade desde o
  // lote 42 — `naParede`.)
  // (lote A3: + a divisão, as rebatidas e o "só na volta")
  let ordens = 0;
  const base = () => ({
    perfurar: efeito.perfurar || 0, bifurcar: efeito.bifurcar || 0, deNovo: efeito.bifurcar > 0 ? efeito.bifurcarDeNovo || 0 : 0,
    encadear: efeito.encadear || 0,
    volta: efeito.retornar > 0 || (efeito.retornarChance > 0 && rng() * 100 < efeito.retornarChance),
    dividir: efeito.divisao || 0, rebatidas: efeito.rebatidas || 0, soNaVolta: !!efeito.soNaVolta, ordem: ordens++,
    // (lote PR1, revisão: o escudo do Arremesso de Escudo Espectral solta as estilhas a cada colisão com um inimigo — em TODO voo dele: o principal, o das
    // direções aleatórias e o ricochete no terreno)
    estilhas: !!efeito.estilhas,
  });
  /** (lote A3) Onde a reta de `de` a `para` bate no TERRENO (a casa antes da que não se anda), ou null. */
  const terrenoNaReta = (de, para) => {
    if (!andavel) return null;
    const reta = casasDaReta(de, para, alcance);
    const i = reta.findIndex((c) => !andavel.has(`${c.x},${c.y}`));
    return i < 0 ? null : i > 0 ? { x: reta[i - 1].x, y: reta[i - 1].y } : { x: de.x, y: de.y };
  };
  /**
   * (lote 42, P053 — dono: "Fazer todos") "Projéteis têm X% de chance de conseguirem Ricochetear ao colidirem com o terreno": o projétil que não
   * acerta ninguém voa até o alcance; se no caminho há TERRENO (uma casa que não se anda — a grade do andar, `andavel`), ele bate ali e, na
   * chance, ricocheteia — salta para o inimigo vivo mais perto do ponto da batida, até a distância do ricochete (o dano do encadeamento).
   * (lote 84, dono: "Seguir o PoE") a batida no terreno É um ricochete: só com ricochete sobrando ("chance to be able to Chain"), e gasta um.
   * (lote A3, dono 19/10 — D5) o projétil que erra também se DIVIDE: "podem se Dividir ao acertar o terreno" (na batida) e "podem se Dividir sem
   * acertar um alvo" (no fim do voo, se não bateu antes).
   */
  const naParede = (para, pct, de = origem) => {
    const parede = terrenoNaReta(de, para);
    if ((efeito.divisao || 0) > 0 && (efeito.dividirNoTerreno || efeito.dividirSemAcertar)) {
      const ponto = parede && efeito.dividirNoTerreno ? parede : efeito.dividirSemAcertar ? (parede ?? para) : null;
      if (ponto) dividir({ dividir: efeito.divisao, acertados: new Set(), perfurar: efeito.perfurar || 0, bifurcar: 0, deNovo: 0, encadear: efeito.encadear || 0, perfurados: 0, ricocheteou: 0, ordem: 0 }, ponto, pct);
    }
    if (!parede || !(efeito.ricocheteTerrenoChance > 0) || !((efeito.encadear || 0) >= 1)) return;
    if (!(rng() * 100 < efeito.ricocheteTerrenoChance)) return;
    const [b] = maisPerto(vivosNoInicio, parede, distanciaDoSalto(), 1, new Set());
    if (b) voar({ ...base(), encadear: (efeito.encadear || 0) - 1, de: parede, pct: (pct * pctDe('danoDoEncadeamentoPct')) / 100, ricocheteou: 1 }, b, 'encadeamento');
  };
  /**
   * (lote 42, P067 — dono: "Fazer todos") "Projéteis são disparados em direções aleatórias": TODOS os projéteis — o principal também (o
   * `disparar` não dá o golpe direto) — saem em direções sorteadas; cada um voa em linha reta até o alcance e acerta o primeiro inimigo do
   * caminho (daí segue as supports); o que não acha ninguém pode bater no terreno (`naParede`).
   */
  // (lote A3b, dono 19/10: + `efeito.angulos` — o ângulo de cada projétil, em radianos (a espiral da Bola de Fogo Vaal, do Rasgalma, do Arremesso Espectral Vaal,
  // os fragmentos do Olho Invernal, o leque dos capturados da Espiral Venenosa — `Acoes.tiqueDosObjetos`); o ângulo null é o sorteado)
  if ((efeito.direcoesAleatorias || efeito.angulos?.length) && deProjetil) {
    for (let k = 0; k < total; k++) {
      const angulo = Number.isFinite(efeito.angulos?.[k]) ? efeito.angulos[k] : rng() * 2 * Math.PI;
      const fim = noAngulo(origem, angulo);
      // (lote B3, dono 21/10: `efeito.acertaNaOrigem` — o projétil que nasce DENTRO de um inimigo o acerta primeiro, como no PoE: as flechas do Tiro Tornado da Nuvem
      // Explosiva saem de onde a carregada caiu)
      const naOrigem = efeito.acertaNaOrigem ? porCasa.get(`${origem.x},${origem.y}`) : null;
      const bicho = (naOrigem?.hp > 0 ? naOrigem : null) ?? primeiroNaReta(origem, fim, new Set());
      const pct = k ? pctDe('danoDosExtrasPct') : 100;
      emitidos.push({ de: { x: origem.x, y: origem.y }, para: bicho ? { x: bicho.x, y: bicho.y } : fim, bicho, tipo: 'projetil' });
      if (bicho) voar({ ...base(), de: origem, pct }, bicho, 'projetil');
      else naParede(fim, pct);
    }
    return r;
  }
  /*
   * (lote PR3, dono 21/10) o TIRO TORNADO: cada tiro atravessa todos até o local mirado (o alvo; o que erra, o fim do voo — a exceção 1) e lá solta os N
   * projéteis SECUNDÁRIOS (`efeito.tornado.n`), cada um num rumo sorteado na sua fatia do círculo (`GemasPR3.anguloDoSecundario` — D2 do dono, a exceção 3),
   * até o alcance; cada secundário acerta o primeiro vivo do caminho (não o alvo do tiro, onde nasce — a exceção 2) e segue os modificadores do projétil
   * (perfurar, difundir, ricochetear, retornar). Os projéteis adicionais são mais tiros (o PoB: ProjectileCount × os secundários), nos mais perto de você.
   */
  if (efeito.tornado && deProjetil && alvo) {
    const n = Math.max(0, Math.round(Number(efeito.tornado.n) || 0));
    const soltar = (ponto, pct) => {
      const de = { x: ponto.x, y: ponto.y };
      const a0 = anguloDe(origem, de);
      for (let k = 0; k < n; k++) {
        const fim = noAngulo(de, GemasPR3.anguloDoSecundario(k, n, a0, rng));
        const bicho = primeiroNaReta(de, fim, new Set());
        emitidos.push({ de, para: bicho ? { x: bicho.x, y: bicho.y } : fim, bicho, tipo: 'secundario' });
        if (bicho) voar({ ...base(), de, pct }, bicho, 'secundario');
        else naParede(fim, pct, de);
      }
    };
    const tiro = (destino, bicho, k) => {
      const direto = k === 0;
      const pct = direto ? 100 : pctDe('danoDosExtrasPct');
      emitidos.push({ de: { x: origem.x, y: origem.y }, para: { x: destino.x, y: destino.y }, bicho: bicho ?? null, tipo: direto ? 'direto' : 'projetil' });
      const ja = new Set();
      for (const c of casasDaReta(origem, destino, cheb(origem, destino))) {
        const b = porCasa.get(Areas.chave(c));
        if (!b || !(b.hp > 0) || b === bicho || ja.has(b)) continue;
        ja.add(b);
        if (!impacto(b, (pct * pctDe('danoDaPerfuracaoPct')) / 100, origem, 'perfuracao', false)) return;
      }
      if (bicho && !impacto(bicho, pct, origem, direto ? 'direto' : 'projetil', direto)) return;
      soltar(destino, pct);
    };
    tiro(alvo, alvo, 0);
    for (const b of atingidos) if (b !== alvo) impacto(b, 100, origem, 'direto', true);
    const fora = new Set([alvo, ...atingidos]);
    const extras = total - 1;
    const com = extras > 0 ? maisPerto(vivosNoInicio, origem, alcance, extras, fora) : [];
    com.forEach((b, i) => { fora.add(b); tiro(b, b, i + 1); });
    for (let k = com.length + 1; k <= extras; k++) tiro(pontoDoProjetil(k), null, k);
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
  // (lote PR1: o escudo do Arremesso de Escudo Espectral solta as estilhas a cada colisão)
  voar({ ...base(), de: origem, pct: 100 }, alvo, 'direto', true);
  // Outros golpes principais da skill (a cadeia da própria magia): impactos.
  for (const b of atingidos) if (b !== alvo) impacto(b, 100, origem, 'direto', true);
  const fora = new Set([alvo, ...atingidos]);
  /*
   * (lote A3, dono 19/10 — F7) "Dispara Projéteis extras em até N Inimigos ao redor" (o Rito Proibido) e "Dispara Projéteis em cada inimigo
   * Próximo" (a Vaal Sifão de Poder): um projétil inteiro em cada inimigo vivo no alcance, os mais perto de você, até N — só os que existem.
   */
  if (efeito.aoRedor > 0) {
    for (const b of maisPerto(vivosNoInicio, origem, alcance, Math.round(efeito.aoRedor), fora)) {
      fora.add(b);
      emitidos.push({ de: { x: origem.x, y: origem.y }, para: { x: b.x, y: b.y }, bicho: b, tipo: 'projetil' });
      voar({ ...base(), de: origem, pct: 100 }, b, 'projetil');
    }
  }
  /*
   * (revisão do A3) a Saraivada de Projéteis (Barrage_of_Volley_Fire): "O primeiro e último disparo da sequência dispara N Projéteis adicionais
   * simultâneos" — os N do primeiro e os N do último saem em LEQUE para os OUTROS inimigos (os mais perto de você, sem repetir o alvo nem entre
   * si); os que não acham bicho saem e erram. No PoB a linha não entra no ProjectileCount (act_dex.lua:1129): num alvo único ficam os 4 da sequência.
   */
  if (efeito.simultaneos > 0) {
    const n = 2 * Math.round(efeito.simultaneos);
    const com = maisPerto(vivosNoInicio, origem, alcance, n, fora);
    for (const b of com) {
      fora.add(b);
      emitidos.push({ de: { x: origem.x, y: origem.y }, para: { x: b.x, y: b.y }, bicho: b, tipo: 'projetil' });
      voar({ ...base(), de: origem, pct: pctDe('danoDosExtrasPct') }, b, 'projetil');
    }
    for (let k = com.length; k < n; k++) emitidos.push({ de: { x: origem.x, y: origem.y }, para: noAngulo(origem, anguloDoRumo + (k - (n - 1) / 2) * (Math.PI / 8)), bicho: null, tipo: 'projetil' });
  }
  const extras = total - 1;
  /*
   * (lote A3, dono 19/10 — D7) a GEOMETRIA da emissão:
   * - a Nova de Flechas e a Nuvem ("disparam uma Flecha Carregada no ar … Disparam de onde a Flecha Carregada cair" + "Disparam Projéteis em um
   *   círculo"): os outros projéteis saem do PONTO DO ALVO, em círculo (os ângulos 2πk/N), cada um em linha reta até o alcance — acerta o primeiro
   *   vivo do caminho que nenhum outro projétil do uso acertou; o principal é o que cai no alvo. Só o círculo (sem a Flecha Carregada): de você;
   * - a Saraivada ("também disparam Projéteis de até N pontos de cada lado seu"): cada projétil a mais sai de um ponto ao LADO de você, na
   *   perpendicular do rumo — um de cada lado, alternando, a 1, 2… casas, até N — e voa paralelo ao principal, acertando o primeiro vivo da reta.
   */
  if (extras > 0 && efeito.emCirculo) {
    const centro = efeito.doPontoDoAlvo ? { x: alvo.x, y: alvo.y } : { x: origem.x, y: origem.y };
    const a0 = anguloDe(origem, alvo);
    for (let k = 1; k <= extras; k++) {
      const fim = noAngulo(centro, a0 + (2 * Math.PI * k) / total);
      const bicho = primeiroNaReta(centro, fim, fora);
      emitidos.push({ de: centro, para: bicho ? { x: bicho.x, y: bicho.y } : fim, bicho, tipo: 'projetil' });
      if (bicho) { fora.add(bicho); voar({ ...base(), de: centro, pct: pctDe('danoDosExtrasPct') }, bicho, 'projetil'); }
      else naParede(fim, pctDe('danoDosExtrasPct'), centro);
    }
    return r;
  }
  if (extras > 0 && efeito.origensLaterais > 0) {
    const n = Math.max(1, Math.round(efeito.origensLaterais));
    const a0 = anguloDe(origem, alvo);
    const px = -Math.sin(a0);
    const py = Math.cos(a0);
    for (let k = 1; k <= extras; k++) {
      const j = Math.min(n, Math.ceil(k / 2));
      const lado = k % 2 ? 1 : -1;
      const de = { x: Math.round(origem.x + px * j * lado), y: Math.round(origem.y + py * j * lado) };
      const fim = noAngulo(de, a0);
      const bicho = primeiroNaReta(de, fim, fora);
      emitidos.push({ de, para: bicho ? { x: bicho.x, y: bicho.y } : fim, bicho, tipo: 'projetil' });
      if (bicho) { fora.add(bicho); voar({ ...base(), de, pct: pctDe('danoDosExtrasPct') }, bicho, 'projetil'); }
      else naParede(fim, pctDe('danoDosExtrasPct'), de);
    }
    return r;
  }
  /*
   * (lote PR3, dono 21/10 — D4) o AÇO PERFURADOR: "aiming at enemies in front of or close to it" — os projéteis miram o alvo e os vizinhos dele (a até
   * `lanca.raio` casas, os mais perto primeiro), em rodízio (a exceção 7): o 1º no alvo (o golpe direto), o 2º no vizinho mais perto… e de volta ao alvo. O
   * "menos Dano após o primeiro acerto em cada inimigo" sai no fim (`resolver`).
   */
  if (extras > 0 && efeito.lanca) {
    const roda = [alvo, ...maisPerto(vivosNoInicio, alvo, Math.max(0, Math.round(efeito.lanca.raio ?? 1)), 99, new Set([alvo]))];
    for (let k = 1; k <= extras; k++) {
      const b = roda[k % roda.length];
      emitir(b, 'projetil', k);
      voar({ ...base(), de: origem, pct: pctDe('danoDosExtrasPct') }, b, 'projetil');
    }
    return r;
  }
  // Os extras (o total menos o principal): os bichos mais perto de quem lança (fora o alvo), cada um um projétil inteiro; os que sobram
  // sem bicho saem e erram — ou, "em sequência", vão no alvo.
  if (extras > 0) {
    // (14/10) "Barragens de Projéteis não se propagam": a barragem (em sequência) vai toda no alvo; "Projéteis são disparados em direções
    // aleatórias": os extras vão em bichos sorteados no alcance (não nos mais perto)
    const todosNoAlvo = efeito.sequencia && efeito.semPropagar;
    const noAlcance = (vivosNoInicio ?? []).filter((b) => b.hp > 0 && !fora.has(b) && cheb(origem, b) <= alcance);
    const sorteados = () => { const l = [...noAlcance]; const saida = []; while (l.length && saida.length < extras) saida.push(l.splice(Math.floor(rng() * l.length), 1)[0]); return saida; };
    const comBicho = todosNoAlvo ? [] : efeito.direcoesAleatorias ? sorteados() : maisPerto(vivosNoInicio, origem, alcance, extras, fora);
    comBicho.forEach((b, i) => { emitir(b, 'projetil', i + 1); voar({ ...base(), de: origem, pct: pctDe('danoDosExtrasPct') }, b, 'projetil'); });
    for (let k = comBicho.length + 1; k <= extras; k++) {
      // (revisão do A3: + a Fuzilaria Cinética — `extrasNoAlvo`: "tentarão atingir inimigos diferentes", mas os que não acham outro vão no alvo,
      // cada um com a sua ordem, como o PoB conta — ProjectileCount, act_int.lua:11016)
      if ((efeito.sequencia || efeito.extrasNoAlvo) && alvo.hp > 0) {
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
