// Veio da coleção do dono (poe-gemas-poedb/engine/src/gemas/compilador.mjs) para o repositório em 08/10/2026: agora é código do jogo — mude aqui.
// Transforma a gema crua (dados do PoEDB) numa "habilidade" executável num nível,
// e avalia o status de implementação (funciona / parcial / não).
// Módulo puro: sem DOM, roda no browser e no Node (relatório).

import { basicosDoNivel, nivelMaximo, propsDoNivel, textosDoNivel } from "./progressao.mjs";
import { interpretar, statsVazios } from "./regras.mjs";
import { ARQUETIPOS, classificar, elementoPrincipal, tiposDaGema } from "./arquetipos.mjs";

const N = String.raw`(-?\d+(?:\.\d+)?)`;

function lerProps(props, st) {
  const nao = [];
  for (const p of props) {
    let m;
    if ((m = p.match(/^Tempo de (?:Conjuração|Uso|Ataque): (.+)/))) {
      st.tempoUso = /Instant/i.test(m[1]) ? 0 : parseFloat(m[1]);
    } else if ((m = p.match(new RegExp(`^Recarga: ${N} seg(?: \\((\\d+) Times\\))?`)))) {
      st.recarga = parseFloat(m[1]);
      st.cargas = m[2] ? parseInt(m[2]) : 1;
    } else if ((m = p.match(new RegExp(`^Chance de Crítico: ${N}`)))) st.criticoBase = parseFloat(m[1]);
    else if ((m = p.match(new RegExp(`^Velocidade de Ataque: ${N}% de base`)))) st.velAtaqueBase = parseFloat(m[1]);
    else if ((m = p.match(new RegExp(`^Velocidade de Projétil: ${N}`)))) st.velProjetil = parseFloat(m[1]);
    else if ((m = p.match(new RegExp(`^(?:Raio|AoE Radius|Aoe Radius|Explosion Radius|[A-Za-z ]*Radius): ${N}`)))) {
      if (st.raioProp == null) st.raioProp = parseFloat(m[1]) / 10;
    } else if ((m = p.match(/^Reserva: (.+)/))) st.reserva = m[1];
    else if ((m = p.match(new RegExp(`^Almas por Utilização: ${N}`)))) st.almas = parseFloat(m[1]);
    else if (/^(Nível|Custo|Eficácia do Dano Adicionado|Dano de Ataque|Impedimento de Ganho de Almas|Pode Armazenar|AoE Length)/.test(p)) {
      /* já coberto pela tabela de níveis ou irrelevante na arena */
    } else nao.push(p);
  }
  return nao;
}

const RAIO_PADRAO = { area: 1.8, nova: 2.4, impacto: 1.8, corpo_a_corpo: 1.6, chuva: 1.2, orbe: 2, aura: 4, maldicao: 2, clamor: 6, arauto: 2, marca: 2.2, canalizacao: 2.5, mina: 2, armadilha: 2 };

export function compilarHabilidade(gema, nivel) {
  const nmax = nivelMaximo(gema);
  nivel = Math.min(Math.max(1, nivel | 0), nmax);
  const linhas = textosDoNivel(gema, nivel);
  const res = interpretar(linhas, statsVazios());
  const st = res.stats;
  const propsNao = lerProps(propsDoNivel(gema, nivel), st);
  Object.assign(st, basicosDoNivel(gema, nivel));
  const tipos = tiposDaGema(gema);
  const arquetipo = classificar(tipos, st);
  const objeto = ["totem", "armadilha", "mina"].includes(arquetipo);
  const carga = objeto ? classificar(tipos, st, true) : arquetipo;
  const ataque = tipos.has("Attack");

  const baseRaio = st.raio ?? st.raioProp ?? RAIO_PADRAO[carga] ?? 1.5;
  st.raioFinal = Math.max(0.4, (baseRaio + st.raioBonus) * Math.sqrt(Math.max(0.2, 1 + st.areaMais / 100)));
  st.critico += st.criticoBase ?? 5;
  if (st.recarga && st.velRecarga) st.recarga = st.recarga / (1 + st.velRecarga / 100);
  // Gemas Vaal gastam almas; na arena não existe ganho de almas, então viram recarga fixa.
  if (st.almas && !st.recarga) st.recarga = 6;

  return {
    slug: gema.slug, nome: gema.nome, en: gema.en, cor: gema.cor, icone: gema.icone, nivel, nivelMax: nmax,
    tipos, tags: gema.tags, arquetipo, carga, ataque, magia: tipos.has("Spell"),
    elemento: elementoPrincipal(tipos, st, gema.tags),
    stats: st,
    linhas: { aplicadas: res.aplicadas, informativas: res.informativas, naoImplementadas: res.naoImplementadas, propsNao },
  };
}

function temEfeito(h) {
  const s = h.stats;
  const buff = s.buff;
  return !!(
    Object.keys(s.dano).length || s.dot.length || h.ataque || Object.keys(s.adicional).length ||
    Object.keys(buff.adicional).length || buff.maisDano || buff.velAtaque || buff.velConj || buff.velMov ||
    Object.keys(buff.resist).length || buff.armadura || buff.evasao || buff.regen || buff.menosDanoRecebido ||
    Object.keys(s.maldicao.resist).length || s.maldicao.danoRecebido || s.maldicao.lentidao || s.maldicao.menosDano ||
    buff.extra.length || buff.critico || buff.escudo || buff.regenMana || buff.absorve || buff.imuneAfeccoes ||
    s.dotPctVida || s.danoRecebidoAcerto || s.lentidaoAcerto || s.cadaver ||
    ["lacaio", "movimento", "clamor", "totem"].includes(h.arquetipo)
  );
}

// Avalia no nível 20 (ou no máximo da gema), que é onde todos os modificadores já existem.
export function avaliarStatus(gema) {
  const h = compilarHabilidade(gema, Math.min(20, nivelMaximo(gema)));
  const motivos = [];
  const notas = [];
  if (h.arquetipo === "generico") motivos.push("nenhum comportamento de combate reconhecido");
  if (!temEfeito(h)) motivos.push("nenhum efeito numérico reconhecido (dano, buff, maldição…)");
  for (const l of h.linhas.naoImplementadas) motivos.push("efeito não simulado: " + l);
  if (h.stats.almas) notas.push("custo em almas Vaal substituído por recarga de " + h.stats.recarga + " s");
  if (h.ataque) notas.push("ataque usa a arma do personagem × efetividade da gema");
  let status;
  if (h.arquetipo === "generico" && !temEfeito(h)) status = "nao";
  else if (motivos.length === 0) status = "funciona";
  else status = "parcial";
  return { slug: gema.slug, nome: gema.nome, status, arquetipo: h.arquetipo, carga: h.carga, arquetipoNome: ARQUETIPOS[h.arquetipo], elemento: h.elemento, motivos, notas, aplicadas: h.linhas.aplicadas.length, total: h.linhas.aplicadas.length + h.linhas.naoImplementadas.length };
}
