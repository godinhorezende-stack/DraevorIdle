// Os VÍNCULOS do PoE (as Link skills: Vínculo Flamejante, Protetor, D'Alma, Destrutivo, Vampírico e Intuitivo — dono, 12/10: "Criar igual ao
// PoE"). Só no modo PoE. Este módulo é puro (não importa a ficha): o que depende da ficha de quem vincula (a vida, o bloqueio, o crítico, as
// cargas, a velocidade dos alvos) entra como FOTO (`foto`), tirada por quem chama (`acoes.tiqueDosVinculos`, a cada tique).
//
//   - a gema foca um JOGADOR aliado (da party, na mesma sala, a até 10 casas) — com "Habilidades de Vínculo podem focar em Lacaios
//     Danificáveis", também um lacaio seu; "Máximo de 1 Vínculo de qualquer fonte por alvo"; "Habilidades de Vínculo têm 1 alvo aleatório
//     adicional";
//   - dura a "Duração base é de N segundos" da gema (× a Duração de Habilidades); custa o "Custo: N Mana por segundo" a cada segundo (sem mana,
//     o Vínculo acaba);
//   - quebra se o alvo ficar fora do alcance (ou da sala) por 4 s ("Vínculos demoram duas vezes mais para quebrar": 8 s);
//   - "Se o alvo morrer enquanto vinculado, você também morrerá" (a gema);
//   - os efeitos no alvo, × o Efeito do Buff dos Vínculos: o Fogo adicional (+ 5% da sua vida), a Chance de Bloquear igual à sua e a vida ao
//     bloquear, o "sofre X% menos Dano" e os 30% do dano no seu Escudo de Energia, o Multiplicador de Crítico e a chance de crítico igual à sua,
//     o seu Dreno de Vida recuperando o alvo; e os da árvore (as cargas, a velocidade, a Exposição perto dos alvos, os feixes…).
import { ligado } from './catalogo.mjs';

export const PADRAO = { alcance: 10, quebraMs: 4000, raioDosProximos: 3, exposicaoMs: 500 };

const v = (af, k) => Number(af?.[k]) || 0;
const distancia = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const num = (s) => parseFloat(String(s).replace(',', '.'));

/** A gema é de Vínculo? (o arquétipo `vinculo` do compilador), só no modo PoE. */
export const ehVinculo = (entry) => ligado() && entry?.poeGema?.arquetipo === 'vinculo';

/** O que a gema faz no alvo (as linhas do nível): `{ duracaoMs, efeitos, naoFeitas }`. */
export function daGema(linhas = []) {
  const ef = {};
  const naoFeitas = [];
  let duracaoMs = 8000;
  for (const l0 of linhas) {
    const l = String(l0);
    let m;
    if ((m = /^Duração base é de (\d+(?:[.,]\d+)?) segundos?/i.exec(l))) duracaoMs = Math.round(num(m[1]) * 1000);
    else if ((m = /^Alvo Vinculado ganha (\d+(?:[.,]\d+)?) a (\d+(?:[.,]\d+)?) de Dano de Fogo Adicional/i.exec(l))) { ef.fogoMin = num(m[1]); ef.fogoMax = num(m[2]); }
    else if ((m = /^Alvo Vinculado ganha Dano de Fogo Adicional igual a (\d+(?:[.,]\d+)?) ?% da sua Vida Máxima/i.exec(l))) ef.fogoVidaPct = num(m[1]);
    else if ((m = /^Alvo do Vínculo Recupera (\d+(?:[.,]\d+)?) de Vida ao Bloquear/i.exec(l))) ef.vidaAoBloquear = num(m[1]);
    else if (/Chance de Bloquear o Dano de Ataques do alvo Vinculado é igual a sua/i.test(l)) ef.bloqueioIgual = true;
    else if ((m = /^Alvo do Vínculo sofre (\d+(?:[.,]\d+)?) ?% menos Dano/i.exec(l))) ef.menosDano = num(m[1]);
    else if ((m = /^(\d+(?:[.,]\d+)?) ?% do Dano de Acertos contra o alvo é sofrido no seu Escudo de Energia antes do dele/i.exec(l))) ef.escudoPct = num(m[1]);
    else if ((m = /^Alvo Vinculado tem \+(\d+(?:[.,]\d+)?) ?% de Multiplicador de Golpes Críticos/i.exec(l))) ef.critMult = num(m[1]);
    else if (/Chance de Golpe Crítico da Mão Primária do alvo Vinculado é igual a sua/i.test(l)) ef.critIgual = true;
    else if (/Efeitos do Dreno de Vida aplicam Recuperação ao Alvo Vinculado ao invés/i.test(l)) ef.drenoNoAlvo = true;
    else if ((m = /^Buff concede \+(\d+(?:[.,]\d+)?) ?% ao Máximo total de Recuperação de Vida por segundo do Dreno/i.exec(l))) ef.tetoDoDreno = num(m[1]);
    else if (/^Vínculos se quebram se o alvo deixar o alcance/i.test(l)) { /* a regra geral (`tique`) */ }
    else naoFeitas.push(l);
  }
  return { duracaoMs, efeitos: ef, naoFeitas };
}

/** Os Vínculos que você mantém agora. */
export const vinculos = (hunt) => hunt?.vinculos ?? [];
/** Quantos alvos vinculados você tem agora (de todas as gemas). */
export const quantosAlvos = (hunt) => vinculos(hunt).reduce((n, lk) => n + (lk.alvos?.length ?? 0), 0);
/** A chave de um alvo (`jogador:<nome>` / `lacaio:<uid>`). */
export const chave = (a) => `${a.tipo}:${a.tipo === 'jogador' ? a.nome : a.uid}`;
/** O seu nome na party (pela partilha da caçada), ou null. */
export const nomeNaParty = (estado) => estado?.hunt?.partilha?.membros?.find((m) => m.estado === estado)?.nome ?? null;
/** Quanto tempo o alvo fica fora do alcance antes de quebrar. */
export const quebraMs = (af) => PADRAO.quebraMs * (v(af, 'vinculo_quebra_dobro') > 0 ? 2 : 1);

/** O alvo de verdade: o estado do jogador (pela partilha) ou o lacaio. */
export function resolver(hunt, a) {
  if (a.tipo === 'jogador') return hunt?.partilha?.membros?.find((m) => m.nome === a.nome && m.estado?.hunt)?.estado ?? null;
  return (hunt?.lacaios ?? []).find((l) => l.uid === a.uid && l.hp > 0) ?? null;
}
/** A posição do alvo (o jogador na caçada dele; o lacaio). */
export const posicao = (a, quem) => (a.tipo === 'jogador' ? (quem?.hunt?.pos ? { x: quem.hunt.pos.x, y: quem.hunt.pos.y, z: quem.hunt.z ?? 0 } : null) : quem ? { x: quem.x, y: quem.y, z: quem.z ?? null } : null);

/** As chaves dos alvos já vinculados por alguém na sala (você e os companheiros) — "Máximo de 1 Vínculo de qualquer fonte por alvo". */
export function jaVinculados(estado, hunt) {
  const s = new Set();
  const donos = [estado, ...(hunt?.partilha?.naSala ?? []).filter((o) => o && o !== estado)];
  for (const d of donos) for (const lk of vinculos(d?.hunt)) for (const a of lk.alvos ?? []) s.add(a.tipo === 'lacaio' ? `${a.tipo}:${a.uid}` : chave(a));
  return s;
}

/**
 * Os alvos que a gema pode focar agora: os jogadores aliados da party na sala, vivos, a até 10 casas; com "Habilidades de Vínculo podem
 * focar em Lacaios Danificáveis" (`af`), os seus lacaios vivos. Sem os que já têm um Vínculo.
 */
export function candidatos(estado, hunt, af) {
  if (!hunt?.pos) return [];
  const ja = jaVinculados(estado, hunt);
  const perto = (p) => p && distancia(p, hunt.pos) <= PADRAO.alcance && (p.z == null || p.z === (hunt.z ?? 0));
  const lista = [];
  for (const m of hunt.partilha?.membros ?? []) {
    if (!m?.estado || m.estado === estado || !(m.estado.hp > 0) || !m.estado.hunt) continue;
    const a = { tipo: 'jogador', nome: m.nome };
    if (!ja.has(chave(a)) && perto(posicao(a, m.estado))) lista.push(a);
  }
  // (14/10: o mercenário do Luminary é um aliado — os Vínculos o pegam sem o nó dos lacaios)
  for (const l of hunt.lacaios ?? []) {
    if (!(v(af, 'vinculo_em_lacaios') > 0) && !l.mercenario) continue;
    const a = { tipo: 'lacaio', uid: l.uid, ...(l.mercenario ? { mercenario: true } : {}) };
    if (l.hp > 0 && !ja.has(chave(a)) && perto({ x: l.x, y: l.y })) lista.push(a);
  }
  return lista;
}

/** Quantos alvos a gema vincula (1 + "Habilidades de Vínculo têm N alvo aleatório adicional"). */
export const quantosVincula = (af) => 1 + Math.max(0, Math.round(v(af, 'vinculo_alvos_extra')));

/**
 * Cria o Vínculo da gema (troca o da mesma gema, se havia): os alvos (o primeiro é o escolhido; os a mais, sorteados entre os outros
 * candidatos), a duração, o custo por segundo e os efeitos. Devolve o Vínculo.
 */
export function criar(hunt, { acao, slug, nome, props, alvos, duracaoMs, custoPorSegundo, agora = hunt?.clock ?? 0 }) {
  const lk = { acao, slug, nome, desde: agora, ate: agora + duracaoMs, custoPorSegundo, proximoCusto: agora + 1000, efeitos: props.efeitos, alvos: alvos.map((a) => ({ ...a, foraMs: 0 })), em: agora };
  hunt.vinculos = [...vinculos(hunt).filter((x) => x.acao !== acao), lk];
  return lk;
}

/**
 * O fator do Efeito do Buff do Vínculo agora (a foto: o "Efeito do Buff aumentado" de quem vincula) + "Efeito do Buff dos seus Vínculos
 * aumentado em X% para cada 50% de Duração do Vínculo que tenha Expirado".
 */
export function fatorDoEfeito(lk, agora) {
  const f = lk.foto ?? {};
  const fracao = (agora - lk.desde) / Math.max(1, lk.ate - lk.desde);
  return Math.max(0, 1 + ((f.efeitoPct ?? 0) + (f.porMetadePct ?? 0) * Math.floor(Math.min(1, fracao) * 2)) / 100);
}

/** Os atributos que UM Vínculo dá ao alvo JOGADOR agora (a foto de quem vinculou e os efeitos da gema, × o Efeito do Buff). */
export function addsDoVinculo(lk, agora) {
  const e = lk.efeitos ?? {};
  const f = lk.foto ?? {};
  const x = fatorDoEfeito(lk, agora);
  const s = {};
  const somar = (k, n) => { if (n) s[k] = (s[k] ?? 0) + n; };
  if (e.fogoMin || e.fogoVidaPct) {
    const daVida = ((f.vidaMax ?? 0) * (e.fogoVidaPct ?? 0)) / 100;
    somar('added_fire_dmg_min', ((e.fogoMin ?? 0) + daVida) * x);
    somar('added_fire_dmg_max', ((e.fogoMax ?? 0) + daVida) * x);
  }
  if (e.vidaAoBloquear) somar('ev:bloquear:vida', e.vidaAoBloquear * x);
  if (e.bloqueioIgual && f.bloqueioPct > 0) { s.bloqueio_igual_pct = f.bloqueioPct; s.bloqueio_teto_igual_pct = f.bloqueioTetoPct ?? f.bloqueioPct; }
  if (e.menosDano) somar('dano_recebido_mais', -e.menosDano * x);
  if (e.critMult) somar('crit_dmg', e.critMult * x);
  if (e.critIgual && f.critPct > 0) s.crit_igual_pct = f.critPct;
  if (e.tetoDoDreno) somar('roubo_teto_vida_inc', e.tetoDoDreno * x);
  // ("Alvos Vinculados compartilham Cargas de Tolerância, Frenesi e Poder com você" — as cargas de quem vinculou, na foto.)
  for (const [k, n] of Object.entries(f.cargas ?? {})) somar(k, n);
  return s;
}

/**
 * O que os VÍNCULOS somam na sua ficha (`Afixos.soma`): os dos companheiros que vincularam VOCÊ (os efeitos do Vínculo) e os seus, de quem
 * vincula ("Velocidade de Movimento aumentada em X% enquanto você tiver ao menos dois alvos Vinculados", "Defesas aumentadas em X% enquanto
 * … quatro", "Sua Velocidade de Movimento é igual a maior … entre os Jogadores Vinculados" — a foto do dono).
 */
export function addsDosVinculos(estado) {
  if (!ligado()) return null;
  const hunt = estado?.hunt;
  if (!hunt) return null;
  const agora = hunt.clock ?? 0;
  const s = {};
  const somar = (o) => { for (const [k, n] of Object.entries(o ?? {})) s[k] = typeof n === 'number' && k !== 'bloqueio_igual_pct' && k !== 'bloqueio_teto_igual_pct' && k !== 'crit_igual_pct' ? (s[k] ?? 0) + n : Math.max(s[k] ?? 0, n); };
  const eu = nomeNaParty(estado);
  if (eu) {
    for (const outro of hunt.partilha?.naSala ?? []) {
      if (!outro || outro === estado) continue;
      for (const lk of vinculos(outro.hunt)) if (lk.ate > (outro.hunt.clock ?? agora) && (lk.alvos ?? []).some((a) => a.tipo === 'jogador' && a.nome === eu)) somar(addsDoVinculo(lk, outro.hunt.clock ?? agora));
    }
  }
  const meus = vinculos(hunt).filter((lk) => lk.ate > agora);
  const n = meus.reduce((t, lk) => t + lk.alvos.length, 0);
  const foto = meus.find((lk) => lk.foto)?.foto ?? {};
  if (n >= 2 && foto.mov2 > 0) s.move_speed = (s.move_speed ?? 0) + foto.mov2;
  if (n >= 4 && foto.defesas4 > 0) for (const k of ['armour_pct', 'evasion_pct', 'es_pct']) s[k] = (s[k] ?? 0) + foto.defesas4;
  if (foto.velocidadeIgual) {
    const vel = Math.max(0, ...meus.map((lk) => lk.velocidadeDosAlvos ?? 0));
    if (vel > 0) s.velocidade_igual_vinculado = vel;
  }
  return Object.keys(s).length ? s : null;
}

/**
 * Os efeitos dos seus Vínculos num LACAIO seu ("Habilidades de Vínculo podem focar em Lacaios Danificáveis"), × o Efeito do Buff: `{ fogo:
 * [min, max], menosDano, escudoPct, critMult, critPct, bloqueioPct, vidaAoBloquear }` — ou null sem Vínculo nele.
 */
export function doLacaio(hunt, l, agora = hunt?.clock ?? 0) {
  if (!ligado() || !l?.uid) return null;
  let r = null;
  for (const lk of vinculos(hunt)) {
    if (!(lk.ate > agora) || !(lk.alvos ?? []).some((a) => a.tipo === 'lacaio' && a.uid === l.uid)) continue;
    const e = lk.efeitos ?? {};
    const f = lk.foto ?? {};
    const x = fatorDoEfeito(lk, agora);
    r ??= { fogo: [0, 0], menosDano: 0, escudoPct: 0, critMult: 0, critPct: 0, bloqueioPct: 0, vidaAoBloquear: 0 };
    const daVida = ((f.vidaMax ?? 0) * (e.fogoVidaPct ?? 0)) / 100;
    if (e.fogoMin || e.fogoVidaPct) { r.fogo[0] += ((e.fogoMin ?? 0) + daVida) * x; r.fogo[1] += ((e.fogoMax ?? 0) + daVida) * x; }
    r.menosDano += (e.menosDano ?? 0) * x;
    r.escudoPct = Math.max(r.escudoPct, e.escudoPct ?? 0);
    r.critMult += (e.critMult ?? 0) * x;
    if (e.critIgual) r.critPct = Math.max(r.critPct, f.critPct ?? 0);
    if (e.bloqueioIgual) r.bloqueioPct = Math.max(r.bloqueioPct, f.bloqueioPct ?? 0);
    r.vidaAoBloquear += (e.vidaAoBloquear ?? 0) * x;
  }
  return r;
}

/** O Vínculo D'Alma que alguém mantém em VOCÊ: `{ dono, pct }` (os X% do dano de acertos vão para o Escudo de Energia do dono), ou null. */
export function escudoDeQuemVincula(estado) {
  const hunt = estado?.hunt;
  const eu = nomeNaParty(estado);
  if (!eu || !ligado()) return null;
  for (const outro of hunt?.partilha?.naSala ?? []) {
    if (!outro || outro === estado) continue;
    for (const lk of vinculos(outro.hunt)) if (lk.efeitos?.escudoPct > 0 && lk.ate > (outro.hunt.clock ?? 0) && (lk.alvos ?? []).some((a) => a.tipo === 'jogador' && a.nome === eu)) return { dono: outro, pct: lk.efeitos.escudoPct };
  }
  return null;
}

/**
 * O DANO de um acerto em você com o Vínculo D'Alma: os X% vão primeiro para o Escudo de Energia de quem vincula (até o que ele tem). Devolve o
 * dano que sobra para você.
 */
export function desviarParaOEscudo(estado, dano) {
  if (!(dano > 0)) return dano;
  const s = escudoDeQuemVincula(estado);
  if (!s || !((s.dono.es ?? 0) > 0)) return dano;
  const parte = Math.min(s.dono.es, Math.round((dano * s.pct) / 100));
  s.dono.es -= parte;
  return dano - parte;
}

/** O Vínculo Vampírico que VOCÊ mantém: o alvo que recebe a recuperação do seu Dreno de Vida (o estado do jogador ou o lacaio), ou null. */
export function alvoDoDreno(estado) {
  const hunt = estado?.hunt;
  if (!ligado()) return null;
  for (const lk of vinculos(hunt)) {
    if (!lk.efeitos?.drenoNoAlvo || !(lk.ate > (hunt.clock ?? 0))) continue;
    for (const a of lk.alvos ?? []) {
      const quem = resolver(hunt, a);
      if (quem) return { tipo: a.tipo, quem };
    }
  }
  return null;
}

/** "Maldições são infligidas em Você ao invés dos alvos Vinculados": a caçada de quem vincula este jogador (com a linha), ou null. */
export function quemRecebeAMaldicao(hunt) {
  if (!ligado()) return null;
  const eu = hunt?.partilha?.membros?.find((m) => m.estado?.hunt === hunt)?.nome;
  if (!eu) return null;
  for (const outro of hunt.partilha?.naSala ?? []) {
    if (!outro?.hunt || outro.hunt === hunt) continue;
    for (const lk of vinculos(outro.hunt)) if (lk.foto?.maldicoesEmVoce && lk.ate > (outro.hunt.clock ?? 0) && (lk.alvos ?? []).some((a) => a.tipo === 'jogador' && a.nome === eu)) return outro.hunt;
  }
  return null;
}

/** As casas do feixe entre dois pontos (a reta, de casa em casa). */
export function casasDoFeixe(a, b) {
  const casas = [];
  const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  for (let i = 1; i < n; i++) casas.push({ x: Math.round(a.x + ((b.x - a.x) * i) / n), y: Math.round(a.y + ((b.y - a.y) * i) / n) });
  return casas;
}

/**
 * "Inimigos em seus Feixes de Vínculo não podem aplicar Afecções Elementais": o monstro está no feixe de um Vínculo (seu ou de um
 * companheiro na sala) cujo dono tem a linha? (o feixe vai de quem vincula ao alvo)
 */
export function noFeixe(hunt, monstro) {
  if (!ligado() || !monstro || !hunt) return false;
  const donos = [{ h: hunt }, ...(hunt.partilha?.naSala ?? []).filter((o) => o?.hunt && o.hunt !== hunt).map((o) => ({ h: o.hunt }))];
  for (const { h } of donos) {
    for (const lk of vinculos(h)) {
      if (!lk.foto?.feixe || !(lk.ate > (h.clock ?? 0)) || !h.pos) continue;
      for (const a of lk.alvos ?? []) {
        const p = posicao(a, resolver(h, a));
        if (p && casasDoFeixe(h.pos, p).some((c) => c.x === monstro.x && c.y === monstro.y)) return true;
      }
    }
  }
  return false;
}

/**
 * Um tique dos seus Vínculos: o custo por segundo (sem mana, acaba), a duração, a quebra fora do alcance e a MORTE do alvo. `fotoDe(lk)`:
 * a foto atual (quem chama). Devolve `{ morreu, quebrados }` — `morreu`: um alvo vinculado morreu ("você também morrerá").
 */
export function tique(estado, hunt, af, agora = hunt?.clock ?? 0) {
  const quebrados = [];
  let morreu = false;
  if (!hunt?.vinculos?.length) return { morreu, quebrados };
  const limite = quebraMs(af);
  for (const lk of [...hunt.vinculos]) {
    const dt = Math.max(0, agora - (lk.em ?? agora));
    lk.em = agora;
    if (lk.ate <= agora) { quebrados.push({ lk, motivo: 'duracao' }); continue; }
    while (lk.proximoCusto <= agora) {
      if ((estado.mana ?? 0) < lk.custoPorSegundo) { quebrados.push({ lk, motivo: 'mana' }); break; }
      estado.mana -= lk.custoPorSegundo;
      lk.proximoCusto += 1000;
    }
    if (quebrados.some((q) => q.lk === lk)) continue;
    for (const a of [...lk.alvos]) {
      const quem = resolver(hunt, a);
      // O alvo morreu vinculado: "Se o alvo morrer enquanto vinculado, você também morrerá" (o jogador: pelo nome na party, mesmo que a morte
      // já o tenha tirado da caçada; o lacaio: ainda na lista sem vida, ou sumiu depois de ter estado vivo).
      const membro = a.tipo === 'jogador' ? hunt.partilha?.membros?.find((m) => m.nome === a.nome) : null;
      const morto = a.tipo === 'jogador' ? !!membro && !(membro.estado?.hp > 0) : !quem && (hunt.lacaios ?? []).some((l) => l.uid === a.uid);
      // (14/10, o Juramento de Fidelidade do Luminary: "Se o seu mercenário conectado morrer, o dono da conexão não morrerá")
      if (morto || (a.tipo === 'lacaio' && !quem && a.vivo)) { if (!(a.mercenario && v(af, 'mercenario_sem_morte_junto') > 0)) morreu = true; lk.alvos = lk.alvos.filter((x) => x !== a); continue; }
      const p = posicao(a, quem);
      const fora = !p || !hunt.pos || distancia(p, hunt.pos) > PADRAO.alcance || (p.z != null && p.z !== (hunt.z ?? 0));
      a.foraMs = fora ? (a.foraMs ?? 0) + dt : 0;
      if (a.tipo === 'lacaio' && quem) a.vivo = true;
      if (a.foraMs >= limite) lk.alvos = lk.alvos.filter((x) => x !== a);
    }
    if (!lk.alvos.length) quebrados.push({ lk, motivo: 'alvo' });
  }
  const fora = new Set(quebrados.map((q) => q.lk));
  hunt.vinculos = hunt.vinculos.filter((lk) => !fora.has(lk));
  return { morreu, quebrados };
}
