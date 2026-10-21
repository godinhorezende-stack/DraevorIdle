// Os ESTADOS que as supports põem nos bichos atingidos (etapa 4 do plano, 30/09):
// QUEIMANDO / ENVENENADO / SANGRANDO (Ignite, Poison, Bleed: dano ao longo do tempo — o motor deles é `combate/dot.mjs`), CONGELADO (Freeze: não anda nem ataca),
// LENTO (Slow: anda e ataca mais devagar), ATORDOADO (Stun: não anda nem ataca).
// Genérico e por dados: as chances e os % vêm das supports ligadas
// (`Gemas.efeitoNaSkill`), as durações e as regras de controle de `config.estados`. Cada estado
// mora no bicho (`m.estados`), com o instante em que acaba.
//
// REGRAS (auditoria de 02/10, decididas pelo dono):
//  - QUEIMANDO: UMA por bicho, vale a de MAIOR dano (reaplicar mais forte substitui; mais fraca é ignorada). O relógio dos pulsos NÃO
//    reinicia ao reaplicar — antes, com acertos a menos de 1 s um do outro, o pulso nunca chegava e a queimação não dava dano nenhum.
//  - CONGELAR e ATORDOAR: não renovam enquanto ativos e, quando acabam, o bicho fica imune aos dois por `controle.imunidade` (3 s):
//    não dá para prender o bicho. Boss é imune; elite leva metade da duração.
//  - LENTIDÃO: vale a maior (não a última); boss leva metade do %; elite metade da duração.
import { CONFIG } from './gemas.mjs';
import * as R from '../regras.mjs';
import * as Dot from '../combate/dot.mjs';
import { CONFIG as ATRIBUTOS } from '../personagem/atributos.mjs';
import { regrasDasMaldicoes } from './reforcos.mjs';

const E = () => CONFIG.estados ?? {};
const ativo = (s, agora) => !!s && s.ate > agora;

/** Boss único, boss de sala ou mob de raridade chefe. `salaDeBoss`: a caçada é de boss (todos os bichos dela). */
export const ehChefe = (m, salaDeBoss = false) => !!(m?.boss || m?.chefe || salaDeBoss);
const ehElite = (m) => !!m?.elite;

/** A duração (ms) de um estado de controle neste bicho: a da config × a regra de elite. */
/** A resistência do BICHO a controle (`m.resistControle`, em %, do bestiário/modificadores): encurta a duração; 100% = imune. */
const resistenciaDoBichoAControle = (m) => Math.max(0, Math.min(100, Number(m?.resistControle) || 0));
const duracaoNo = (m, base) => Math.round(base * (ehElite(m) ? E().elite?.duracao ?? 1 : 1) * (1 - resistenciaDoBichoAControle(m) / 100));

/**
 * Depois de um acerto (`dano` do `tipo`) com o efeito da gema: sorteia e põe os estados.
 * Queimar guarda o total que falta (o % do acerto) e sai em pulsos (`tique`).
 * Devolve os nomes dos estados postos (para o evento na tela). `salaDeBoss`: a caçada é uma sala de boss.
 */
export function aplicar(bicho, efeito, dano, agora, rng = Math.random, salaDeBoss = false, baseDoDot = dano) {
  if (!efeito || !(dano > 0) || bicho.hp <= 0) return [];
  const postos = [];
  const cfg = E();
  const estados = (bicho.estados ??= {});
  const chefe = ehChefe(bicho, salaDeBoss);

  // Os efeitos de DANO AO LONGO DO TEMPO (`combate/dot.mjs`): o % do acerto (antes da resistência e do crítico — o pulso passa pela
  // resistência do bicho, e o dano contínuo não rola crítico) que o efeito paga, na duração do tipo.
  const dot = (chance, pct, tipo) => {
    if (!(chance > 0) || !(rng() * 100 < chance)) return;
    const estado = Dot.aplicar(bicho, { tipo, total: (baseDoDot * (pct ?? 0)) / 100, origem: { fonte: 'suporte' } }, agora);
    if (estado) postos.push(estado);
  };
  dot(efeito.igniteChance, efeito.ignitePct, 'queimadura');
  dot(efeito.venenoChance, efeito.venenoPct, 'veneno');
  dot(efeito.sangramentoChance, efeito.sangramentoPct, 'sangramento');

  // Congelar e atordoar dividem a MESMA imunidade (um depois do outro seria controle quase contínuo).
  const preso = ativo(estados.congelado, agora) || ativo(estados.atordoado, agora) || agora < (estados.controleImuneAte ?? 0);
  const podeControlar = !preso && !(chefe && (cfg.chefe?.controle ?? 1) <= 0) && resistenciaDoBichoAControle(bicho) < 100;
  // (PoE: "Inimigos que você Congelar continuam Congelados por ao menos N segundos" — `minimoMs`; "Inimigos Ficam Resfriados ao Descongelarem"
  // — `extra.resfriarAoSair`, que o tique cobra quando o Congelamento acaba.)
  const prender = (nome, base, minimoMs = 0, extra = null) => {
    const dur = Math.max(duracaoNo(bicho, base), minimoMs);
    estados[nome] = { ate: agora + dur, ...(extra ?? {}) };
    if (nome === 'congelado') delete estados.geada;
    estados.controleImuneAte = agora + dur + (cfg.controle?.imunidade ?? 0);
    postos.push(nome);
  };
  // (`congelarDuracaoPct`: a "Duração do Congelamento em Inimigos aumentada" do PoE.)
  // (PoE, 14/10: `congelarMs` — a duração já pela conta do PoE, o dano de Gelo do acerto e a Duração aumentada — `itens-poe/afeccoes`; congelar
  // tira as Geadas do alvo.)
  if (podeControlar && efeito.congelarChance > 0 && rng() * 100 < efeito.congelarChance) prender('congelado', efeito.congelarMs > 0 ? efeito.congelarMs : (cfg.congelado?.duracao ?? 1500) * (1 + (efeito.congelarDuracaoPct ?? 0) / 100), efeito.congelarMinimoMs ?? 0, efeito.resfriarAoDescongelar > 0 ? { resfriarAoSair: efeito.resfriarAoDescongelar } : null);
  // (`imuneAtordoamento`: o mapa do endgame com "Monstros não podem ser Atordoados".)
  else if (podeControlar && !bicho.imuneAtordoamento && efeito.atordoarChance > 0 && rng() * 100 < efeito.atordoarChance) prender('atordoado', cfg.atordoado?.duracao ?? 1500);

  if (efeito.lentidaoPct > 0) {
    const maximo = cfg.lento?.maximo ?? 40;
    const pct = Math.min(maximo, efeito.lentidaoPct) * (chefe ? cfg.chefe?.lento ?? 1 : 1);
    if (pct > 0) {
      // (`lentidaoDuracaoPct`: a "Duração do Resfriamento em Inimigos aumentada" do PoE.)
      const ate = agora + duracaoNo(bicho, (cfg.lento?.duracao ?? 3000) * (1 + (efeito.lentidaoDuracaoPct ?? 0) / 100));
      const l = estados.lento;
      // Vale a MAIOR lentidão (não a última) e nunca encurta o que já corre.
      // (`dur`: a duração cheia do que vale — as Forças Profanadas a renovam ao amaldiçoar, `ModsPoe.renovarFrioEChoque`)
      estados.lento = ativo(l, agora) ? { ate: Math.max(l.ate, ate), pct: Math.max(l.pct, pct), dur: ate >= l.ate ? ate - agora : l.dur } : { ate, pct, dur: ate - agora };
      postos.push('lento');
    }
  }
  return postos;
}

/**
 * O ATORDOAMENTO do PoE num acerto do jogador (`itens-poe/mods-poe.mjs → atordoar`): as mesmas regras de controle do Draevor (chefe,
 * imunidade depois, resistência do bicho). `duracaoMs` já vem pronta. Devolve true se atordoou.
 */
export function atordoar(bicho, duracaoMs, agora, salaDeBoss = false) {
  if (!bicho || bicho.hp <= 0 || !(duracaoMs > 0) || bicho.imuneAtordoamento) return false;
  const cfg = E();
  const estados = (bicho.estados ??= {});
  const preso = ativo(estados.congelado, agora) || ativo(estados.atordoado, agora) || agora < (estados.controleImuneAte ?? 0);
  if (preso || (ehChefe(bicho, salaDeBoss) && (cfg.chefe?.controle ?? 1) <= 0) || resistenciaDoBichoAControle(bicho) >= 100) return false;
  const dur = duracaoNo(bicho, duracaoMs);
  estados.atordoado = { ate: agora + dur };
  estados.controleImuneAte = agora + dur + (cfg.controle?.imunidade ?? 0);
  return true;
}

/**
 * (lote C4, dono 21/10) O TOLHIMENTO do PoE (Hinder): um estado próprio, `tolhido` — só a VELOCIDADE DE MOVIMENTO (o passo; o ataque não muda), sem o teto da
 * lentidão (`lento.maximo`) e sem a metade do chefe. Um por vez, vale o mais forte ("A creature can only be affected by one Hinder at a time; … only the strongest
 * Hinder takes effect" — o poedb).
 * (revisão do C4, 21/10) vale a INSTÂNCIA mais forte inteira — o % e a duração DELA: cada Tolhimento guarda a sua duração (`lista`, só com mais de um), e o que vale a
 * cada momento é o de maior % ainda ativo (o fraco segue depois que o forte acaba, até o fim dele; antes, o maior % ficava até o maior fim). `ate` é o fim do último
 * (o estado está ativo enquanto algum está); `pct`, o do mais forte quando foi posto (o passo usa `fatorDeTolhimento`, que olha a `lista`).
 * `regenMenosPct`: o "Inimigos Desacelerados por você têm Regeneração de Vida reduzida em X%" de quem Tolheu, na instância (vale enquanto ela está ativa —
 * `regenMenosDoTolhimento`, no `tique`).
 * Devolve true se pôs (ou reforçou).
 */
export function tolher(bicho, pct, duracaoMs, agora, regenMenosPct = 0) {
  if (!bicho || !(bicho.hp > 0) || !(pct > 0) || !(duracaoMs > 0)) return false;
  const estados = (bicho.estados ??= {});
  const novo = { ate: agora + Math.round(duracaoMs), pct, ...(regenMenosPct > 0 ? { regenMenosPct } : {}) };
  const todos = [...instanciasDoTolhimento(estados.tolhido, agora), novo];
  // fica a que ainda pode valer: sai a que outra cobre (% e fim maiores ou iguais, e a redução da Regeneração também; entre iguais, fica a mais nova)
  const cobre = (j, i) => j.pct >= i.pct && j.ate >= i.ate && (j.regenMenosPct ?? 0) >= (i.regenMenosPct ?? 0);
  const lista = todos.filter((i, k) => !todos.some((j, l) => l !== k && cobre(j, i) && (!cobre(i, j) || l > k))).sort((x, y) => y.pct - x.pct || y.ate - x.ate);
  estados.tolhido = lista.length > 1 ? { ate: Math.max(...lista.map((i) => i.ate)), pct: lista[0].pct, lista } : { ...lista[0] };
  return true;
}
/** As instâncias ATIVAS do Tolhimento `t` (a `lista`, ou ele mesmo). */
function instanciasDoTolhimento(t, agora) {
  if (!ativo(t, agora)) return [];
  return (t.lista ?? [t]).filter((i) => i.ate > agora).map(({ ate, pct, regenMenosPct }) => ({ ate, pct, ...(regenMenosPct > 0 ? { regenMenosPct } : {}) }));
}
/** O % do Tolhimento que vale agora: o da instância mais forte ainda ativa (0 sem nenhuma). */
export const pctDoTolhimento = (m, agora) => Math.max(0, ...instanciasDoTolhimento(m?.estados?.tolhido, agora).map((i) => i.pct ?? 0));
/** O "Inimigos Desacelerados por você têm Regeneração de Vida reduzida em X%" que vale agora: o maior das instâncias ativas. */
export const regenMenosDoTolhimento = (m, agora) => Math.max(0, ...instanciasDoTolhimento(m?.estados?.tolhido, agora).map((i) => i.regenMenosPct ?? 0));
/** Quanto o passo do bicho Tolhido demora a mais (1 = normal): 1 / (1 − %), até 90%. */
export function fatorDeTolhimento(m, agora) {
  const pct = pctDoTolhimento(m, agora);
  return pct > 0 ? 1 / Math.max(0.1, 1 - pct / 100) : 1;
}

/** Os estados ATIVOS do bicho agora (o cliente mostra um ícone de cada): `['congelado', 'lento', 'queimando']`. */
export function ativosDe(m, agora) {
  const e = m?.estados ?? {};
  // (lote C4: + o `tolhido` — o Tolhimento, só de movimento)
  const lista = [...['congelado', 'atordoado', 'lento', 'tolhido'].filter((n) => ativo(e[n], agora)), ...Dot.ativosDe(m, agora)];
  // A Eletrização do PoE (`itens-poe/afeccoes.mjs`: o bicho recebe mais dano) usa o ícone de eletrizado.
  if (ativo(e.chocado, agora) && !lista.includes('eletrizado')) lista.push('eletrizado');
  return lista;
}

/** O bicho pode andar/atacar agora? (congelado e atordoado não). */
export const podeAgir = (m, agora) => !ativo(m?.estados?.congelado, agora) && !ativo(m?.estados?.atordoado, agora);
/** (lote A2) O bicho FUGINDO (a Chance de Fugir, o Pacifismo — `Acoes.fugir`): não ataca e se afasta de você (`hunt/monstros.moverMonstros`). */
export const fugindo = (m, agora) => ativo(m?.estados?.fugindo, agora);

/** Quanto o bicho LENTO demora a mais (1 = normal): passo e intervalo do golpe × isto. */
export function fatorDeLentidao(m, agora) {
  const s = m?.estados?.lento;
  return ativo(s, agora) ? 1 / (1 - s.pct / 100) : 1;
}

/*
 * ---- O ESCUDO DE ENERGIA do monstro (PoE: "Ganhe X% de Vida Máxima como Escudo de Energia Máximo Extra" — `mobs/raridade.aplicar`) ----
 * A barra do monstro (`hp`/`maxHp`) é vida + escudo, e o escudo fica POR CIMA. Quem tira vida do monstro (golpe, magia, lacaio, dano
 * contínuo) só mexe no `hp`; a conta de quanto saiu do escudo é feita aqui, a cada tique, pelo que o `hp` caiu desde o último (`m.esPoe =
 * { fracao, atual, ultimoHp, ultimoDano }` — o máximo é a `fracao` da barra; a vida é o `hp` menos o escudo). O escudo RECARREGA como o do
 * jogador no PoE: depois de 2 s sem dano (÷ "Início da Recarga X% mais rápido" — `atrasoMenosPct`), 33% do máximo por segundo
 * (`RECARGA_POR_SEGUNDO_POE` de `gamedata/atributos-principais.json` — o PoB; lote 84).
 */
/** O escudo do monstro agora: `{ max, atual, vida, vidaMax }` (null sem escudo). */
export function escudoDoMonstro(m) {
  const es = m?.esPoe;
  if (!es) return null;
  const max = Math.round((m.maxHp ?? 0) * es.fracao);
  const atual = Math.max(0, Math.min(max, es.atual ?? max));
  return { max, atual, vida: Math.max(0, (m.hp ?? 0) - atual), vidaMax: Math.max(0, (m.maxHp ?? 0) - max) };
}
function acertarEscudo(m, agora) {
  const es = m.esPoe;
  const { max, atual } = escudoDoMonstro(m);
  es.atual = atual;
  const caiu = (es.ultimoHp ?? m.hp) - m.hp;
  // o dano sai do escudo primeiro (a vida é o resto da barra)
  if (caiu > 0) {
    es.atual -= Math.min(es.atual, caiu);
    es.ultimoDano = agora;
  }
  // (a cura que entrou por fora é vida: não passa da vida máxima)
  m.hp = Math.min(m.hp, (m.maxHp ?? 0) - max + es.atual);
  es.ultimoHp = m.hp;
}
function recarregarEscudo(m, agora, bloqueada) {
  const es = m.esPoe;
  const desde = es.ultimoTique ?? agora;
  es.ultimoTique = agora;
  const { max } = escudoDoMonstro(m);
  // (cheio ou sem poder recarregar: a sobra fracionária some — senão ela se acumula e a próxima recarga sai inteira de uma vez)
  if (bloqueada || (es.atual ?? max) >= max) { es.resto = 0; return; }
  const cfg = ATRIBUTOS.energyShield ?? {};
  const espera = (cfg.ATRASO_MS_POE ?? 2000) / Math.max(0.1, 1 + (es.atrasoMenosPct ?? 0) / 100);
  if (es.ultimoDano != null && agora - es.ultimoDano < espera) return;
  const ms = Math.max(0, agora - Math.max(desde, es.ultimoDano != null ? es.ultimoDano + espera : desde));
  es.resto = (es.resto ?? 0) + (max * (cfg.RECARGA_POR_SEGUNDO_POE ?? cfg.RECARGA_POR_SEGUNDO ?? 0.33) * ms) / 1000;
  const ganho = Math.min(Math.floor(es.resto), max - es.atual);
  if (!(ganho > 0)) return;
  es.resto = es.atual + ganho >= max ? 0 : es.resto - ganho;
  es.atual += ganho;
  m.hp += ganho;
  es.ultimoHp = m.hp;
}

/**
 * Um tique da caçada: a regeneração dos modificadores e os pulsos de dano ao longo do tempo
 * (`combate/dot.mjs`). Quem cair é recolhido depois por `processarMortes`. Devolve o dano total dos pulsos.
 */
/** A duração base do Resfriamento do PoE (o "ao Descongelarem"). */
const RESFRIAMENTO_AO_DESCONGELAR_MS = 2000;
export function tique(hunt, eventos, agora) {
  let total = 0;
  for (const m of hunt?.monstros ?? []) {
    const est = m.estados;
    if (est && m.hp > 0) {
      // "Inimigos Ficam Resfriados ao Descongelarem": o Congelamento acabou — o Resfriamento entra (a maior lentidão vale).
      const c = est.congelado;
      if (c?.resfriarAoSair > 0 && c.ate <= agora) {
        const pct = Math.min(E().lento?.maximo ?? 40, c.resfriarAoSair);
        est.lento = ativo(est.lento, agora) ? { ...est.lento, pct: Math.max(est.lento.pct, pct), ate: Math.max(est.lento.ate, c.ate + RESFRIAMENTO_AO_DESCONGELAR_MS) } : { ate: c.ate + RESFRIAMENTO_AO_DESCONGELAR_MS, pct };
        delete c.resfriarAoSair;
        eventos?.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: 'lento' });
      }
      // O tempo Congelado/Resfriado por você (o "permanentemente Dano aumentado por cada segundo" — `condicoes-poe.fatorRecebidoPeloBicho`).
      const p = est.permanente;
      if (p) {
        const passou = Math.max(0, agora - (p.ultimo ?? agora));
        p.ultimo = agora;
        if (p.congelado > 0 && ativo(est.congelado, agora)) p.msCongelado = (p.msCongelado ?? 0) + passou;
        if (p.resfriado > 0 && ativo(est.lento, agora)) p.msResfriado = (p.msResfriado ?? 0) + passou;
      }
    }
    // O escudo de energia do PoE: o dano que entrou desde o último tique sai primeiro do escudo (`escudoDoMonstro`).
    if (m.esPoe && m.hp > 0) acertarEscudo(m, agora);
    // As regras das maldições do PoE no monstro ("Inimigos Amaldiçoados por você têm Regeneração de Vida reduzida em X%"/"não podem Recuperar
    // Escudo de Energia" — `Reforcos.marcar` guarda na maldição as da ficha de quem conjurou).
    const maldicoes = m.maldicoes ? regrasDasMaldicoes(m, agora) : null;
    // A REGENERAÇÃO do modificador (`regen`: % da vida por segundo — ver `mobs/raridade.mjs`).
    // (A próxima regeneração gravada no relógio de parede — antes de 09/10 este tique recebia ele — volta para o relógio da caçada.)
    if (m.proximaRegen > agora + 60_000) m.proximaRegen = agora;
    const es = escudoDoMonstro(m);
    const vidaMax = es ? es.vidaMax : m.maxHp;
    const vidaAgora = es ? es.vida : m.hp;
    if (m.regen && m.hp > 0 && vidaAgora < vidaMax && R.jaPode(agora, m.proximaRegen)) {
      // As REDUÇÕES da Regeneração de Vida do monstro, em pontos (revisão do B1 — a regra do PoE: o "reduzida" é LifeRegen INC no PoB, e os aumentados e reduzidos
      // SOMAM num fator só, 1 − Σ; antes cada fonte multiplicava, como um "menos"):
      //   - "Inimigos Desacelerados por você têm Regeneração de Vida reduzida em X%";
      //   - (ciclo 7, lote E) "Inimigos Próximos têm Regeneração de Vida reduzida em X%" — a aura do personagem, `mods-poe.aurasProximas`;
      //   - (lote B1) o debuff da gema — a Bomba Congelante, "Regeneração de Vida reduzida em 75%", pela duração secundária;
      //   - as das maldições ("Inimigos Amaldiçoados por você têm Regeneração de Vida reduzida em X%").
      // (revisão do C4, 21/10: o "Desacelerados por você" vale em todo Tolhimento seu — o `regenMenosPct` do `tolhido`, `tolher`; o maior dos dois, sem contar duas vezes)
      const reduzido = Math.max(ativo(m.estados?.desacelerado, agora) ? m.estados.desacelerado.regenMenosPct ?? 0 : 0, regenMenosDoTolhimento(m, agora)) + (ativo(m.estados?.regenMenosAura, agora) ? m.estados.regenMenosAura.pct ?? 0 : 0)
        + (ativo(m.estados?.regenMenosDebuff, agora) ? m.estados.regenMenosDebuff.pct ?? 0 : 0) + (maldicoes?.regenMenos ?? 0);
      // (lote 69: "Inimigos Envenenados por você não podem Regenerar Vida" — enquanto o veneno dura)
      const envenenado = m.estados?.semRegenEnvenenado && (m.dots ?? []).some((d) => (d.tipo === 'veneno' || d.tipo === 'venenoPoe') && d.falta > 0);
      const fator = envenenado ? 0 : Math.max(0, 1 - reduzido / 100);
      const ganho = Math.max(fator > 0 ? 1 : 0, Math.round((vidaMax * m.regen * fator) / 100));
      // (com escudo, a regeneração é da VIDA: não passa da vida máxima, e o escudo fica como está)
      m.hp = es ? Math.min(vidaMax, vidaAgora + ganho) + es.atual : Math.min(m.maxHp, m.hp + ganho);
      if (es) m.esPoe.ultimoHp = m.hp;
      m.proximaRegen = agora + 1000;
    }
    if (m.esPoe && m.hp > 0) recarregarEscudo(m, agora, !!maldicoes?.semRecargaEs);
  }
  // Os pulsos de dano ao longo do tempo (queimadura, veneno, sangramento...).
  total += Dot.tique(hunt, eventos, agora);
  return total;
}
