// Os efeitos do PoE que mexem nos ESTADOS dos bichos e no dano contínuo (o atordoamento, Mutilar, Cegar, Empalar…; o que o personagem
// recebe). O resto (condições, soma, ficha do golpe, leitura dos mods) mora em `condicoes-poe.mjs` — sem dependências pesadas, para os
// módulos de base (afixos, gemas, tradução, resistência) poderem usar sem ciclo de importação. Este módulo reexporta tudo de lá.
import { ligado } from './catalogo.mjs';
import * as Estados from '../skills/estados.mjs';
import * as Dot from '../combate/dot.mjs';
import { valor, marcar, ganharFuria, ativo, fichaDa, imunidadeApos, comTeto, fatorDaEscala, NO_ACERTO, RECUPERACAO_MS, AO_BLOQUEAR, condicoesDe, vale, ehCondDeEstado, ganharBuff, tagsDoAlvo, somaPorTags as somaPorTagsDe, vidaSoPeloDreno, RAMPAGE, empurrar } from './condicoes-poe.mjs';
export * from './condicoes-poe.mjs';



/**
 * O que um ACERTO do personagem faz além do dano (sistema do PoE): o atordoamento, Mutilar, Cegar, Desacelerar, Empurrar, Provocar,
 * Empalar (e solta os empalamentos do alvo), a Fúria e o Escudo de Energia por acerto. `ficha`: a do golpe (`fichaDoGolpe`, com as tags).
 * `dano`: o total do acerto; `fisico`: a parte Física. Devolve `{ atordoou, extra }` — `extra`: o dano dos empalamentos soltos (já tirado).
 */
export function aoAcertar(estado, hunt, alvo, ficha, { dano = 0, fisico = 0, crit = false, eventos = null, agora = hunt?.clock ?? 0, rng = Math.random, mover = null, elementos = [], personagem = null } = {}) {
  const saida = { atordoou: false, extra: 0 };
  if (!ligado() || !alvo || alvo.dummy || !ficha?.afPoe) return saida;
  const v = (k) => valor(ficha, k);
  const tags = new Set(ficha.tagsDoGolpe ?? []);
  const salaDeBoss = !!hunt?.isBoss;
  const ev = (estado2) => eventos?.push({ t: 'estado', uid: alvo.uid, x: alvo.x, y: alvo.y, estado: estado2 });
  const sorte = (pct) => pct > 0 && rng() * 100 < pct;
  // "X% do Dano Excedente é Drenado como Vida" (o Apetite Insaciável do Carrasco): o acerto que MATOU — a vida que faltava ao monstro era
  // menos que o dano — drena o que sobrou ("Dano Excedente é qualquer Dano de um Acerto que exceda a Vida restante do Inimigo").
  const excedente = alvo.hp <= 0 && alvo.hp + dano > 0 ? Math.min(dano, -alvo.hp) : 0;
  if (excedente > 0 && v('roubo_excedente') > 0) drenoDaFicha?.(estado, { vida: (excedente * v('roubo_excedente')) / 100 }, ficha, eventos, personagem?.nome ?? null, hunt?.pos ?? null);
  if (crit) {
    marcar(hunt, 'critico', agora);
    // (Os frascos com "chance de ganhar uma Carga de Frasco ao causar um Golpe Crítico" — `frascos.tique`.)
    if (hunt) hunt.poeCriticosParaFrascos = (hunt.poeCriticosParaFrascos ?? 0) + 1;
  }
  const e = (alvo.estados ??= {});
  // Os EMPALAMENTOS do alvo: cada acerto solta o guardado — passando pela Redução de Dano Físico do alvo (a resistência física e a redução
  // de dano do monstro — `reducaoFisica`, registrada pela caçada), salvo "Dano de Empalamento … ignoram a Redução de Dano Físico Inimiga".
  // ("X% de chance de, ao Acertar um Inimigo, todos os Empalamentos no Inimigo durarem por um Acerto adicional": este acerto não gasta.)
  if (Array.isArray(e.empalado) && e.empalado.length && alvo.hp > 0) {
    let total = 0;
    const segura = sorte(v('empalar_acerto_extra_chance'));
    for (const x of e.empalado) if (x.ate > agora && x.acertos > 0) { total += x.valor; if (!segura) x.acertos--; }
    e.empalado = e.empalado.filter((x) => x.ate > agora && x.acertos > 0);
    if (total > 0 && reducaoFisica && !(v('empalar_ignora_reducao') > 0)) total = reducaoFisica(hunt, alvo, total);
    // ("X% de chance de, ao Acertar, remover todos os Empalamentos do Inimigo")
    if (sorte(v('empalar_remover_chance'))) e.empalado = [];
    if (total > 0) {
      const d = Math.max(1, Math.round(total));
      alvo.hp -= d;
      saida.extra = d;
      eventos?.push({ t: 'dmg', uid: alvo.uid, x: alvo.x, y: alvo.y, v: d, foe: true, alvo: alvo.name, color: '#b0b0b0', empalamento: true });
    }
  }
  if (alvo.hp <= 0) return saida;
  // ATORDOAMENTO (o do PoE: pelo tamanho do acerto em relação à vida do alvo).
  const limiar = Math.max(1, (alvo.maxHp ?? alvo.hp) * Math.max(0.05, 1 - v('enemy_stun_threshold_red') / 100));
  const chanceAtordoar = (NO_ACERTO.atordoamento.fator * dano) / limiar;
  if (chanceAtordoar >= NO_ACERTO.atordoamento.minimoPct && rng() * 100 < Math.min(100, chanceAtordoar)) {
    let dur = NO_ACERTO.atordoamento.duracaoMs * (1 + v('stun_duration') / 100);
    if (rng() * 100 < v('chance_dobrar_atordoamento')) dur *= 2;
    if (Estados.atordoar(alvo, Math.round(dur), agora, salaDeBoss)) {
      saida.atordoou = true;
      ev('atordoado');
    }
  }
  const lentidao = (pct, ms) => {
    const l = e.lento;
    const ate = agora + ms;
    e.lento = ativo(l, agora) ? { ate: Math.max(l.ate, ate), pct: Math.max(l.pct, pct) } : { ate, pct };
  };
  if (sorte(v('chance_mutilar'))) {
    e.mutilado = { ate: agora + NO_ACERTO.mutilar.duracaoMs };
    lentidao(NO_ACERTO.mutilar.lentidaoPct, NO_ACERTO.mutilar.duracaoMs);
    ev('mutilado');
  }
  if (sorte(v('chance_cegar'))) {
    e.cego = { ate: agora + NO_ACERTO.cegar.duracaoMs, criticoMenosPct: v('cegados_critico_red'), ...(v('cegos_esconjuro') > 0 ? { esconjuro: true } : {}), ...(v('efeito_cegueira') ? { efeito: Math.max(0, 1 + v('efeito_cegueira') / 100) } : {}) };
    ev('cego');
  }
  if (tags.has('magia') && sorte(v('chance_desacelerar'))) {
    e.desacelerado = { ate: agora + NO_ACERTO.desacelerar.duracaoMs, regenMenosPct: v('desacelerados_regen_red') };
    lentidao(NO_ACERTO.desacelerar.lentidaoPct, NO_ACERTO.desacelerar.duracaoMs);
    ev('lento');
  }
  if (sorte(v('chance_provocar'))) {
    // (+ "Duração da Provocação aumentada em X%".)
    e.provocado = { ate: agora + Math.round(NO_ACERTO.provocar.duracaoMs * Math.max(0.1, 1 + v('duracao_provocacao') / 100)), por: estado?.nome ?? null };
    ev('provocado');
  }
  if (sorte(v('chance_empurrar')) && typeof mover === 'function' && mover(alvo)) {
    ev('empurrado');
    // ("X% de chance de ganhar uma Carga de Poder se Empurrar um Inimigo com Dano Corpo a Corpo": o evento `empurrar`, com as tags do golpe.)
    evento(estado, hunt, 'empurrar', ficha, { alvo, eventos, personagem, agora, tags: [...tags] });
  }
  // (09/10) INTIMIDAR (o alvo sofre 10% mais dano de Ataques) e INERVAR (10% mais dano de Magias) — "X% de chance de Intimidar Inimigos por N
  // segundos no Acerto" (N: `intimidar_s`/`inervar_s`; sem ele, 4 s, o padrão do PoE).
  if (sorte(v('chance_intimidar'))) { e.intimidado = { ate: agora + 1000 * (v('intimidar_s') || 4) }; ev('intimidado'); }
  if (sorte(v('chance_inervar'))) { e.inervado = { ate: agora + 1000 * (v('inervar_s') || 4) }; ev('inervado'); }
  // A EXPOSIÇÃO no acerto ("Inflige Exposição a Fogo ao Acertar, aplicando −X% de Resistência a Fogo"): −X na resistência do alvo por 4 s
  // (`condicoes-poe.exposicao`, lida em `hunt/resistencia`). Como no PoE, só a mais forte de cada elemento vale.
  for (const [el, k, extra] of [['fire', 'exposicao_acerto_fogo', 'exposicao_extra_fogo'], ['ice', 'exposicao_acerto_gelo', 'exposicao_extra_gelo'], ['energy', 'exposicao_acerto_raio', 'exposicao_extra_raio']]) {
    // (+ "Exposição a Fogo infligida por você aplica X% extra de Resistência a Fogo" — a maestria da árvore.)
    const pct = Math.abs(v(k)) + (v(k) ? Math.abs(v(extra)) : 0);
    if (!pct) continue;
    const ainda = (e.exposicao?.[el] ?? 0) > agora;
    e.exposicao = { ...(e.exposicao ?? {}), [el]: agora + 4000 };
    e.exposicaoPct = { ...(e.exposicaoPct ?? {}), [el]: ainda ? Math.max(e.exposicaoPct?.[el] ?? 10, pct) : pct };
  }
  // O EMPALAMENTO: o efeito (+ "em Inimigos não Empalados"), os acertos ("duram por N Acerto adicional"), a duração, os "N Empalamentos
  // adicionais" e o espalhar ("também Empalam outros Inimigos próximos deles" — O Empalador), com o "Por N segundos … não podem ser Empalados
  // novamente".
  // (+ "Golpes Críticos com Magias infligem Empalamento": `chance_empalar@critico+magia` — só no crítico.)
  if (fisico > 0 && sorte(v('chance_empalar') + (crit ? somaPorTagsDe(ficha, [...tags, 'critico']).chance_empalar ?? 0 : 0))) {
    const empalar = (m) => {
      const em = (m.estados ??= {});
      if ((em.empalarBloqueadoAte ?? 0) > agora) return false;
      const lista = (em.empalado ??= []);
      const naoEmpalado = !lista.some((x) => x.ate > agora && x.acertos > 0);
      const valor2 = (fisico * NO_ACERTO.empalar.pctDoFisico * (1 + (v('efeito_empalamento') + (naoEmpalado ? v('efeito_empalamento_nao_empalado') : 0)) / 100)) / 100;
      const acertos = NO_ACERTO.empalar.acertos + Math.max(0, Math.floor(v('empalar_acertos_extra')));
      const ate = agora + Math.round(NO_ACERTO.empalar.duracaoMs * Math.max(0.1, 1 + v('duracao_empalamento') / 100));
      for (let k = 0; k <= Math.max(0, Math.floor(v('empalamentos_extras'))); k++) lista.push({ valor: valor2, acertos, ate });
      if (lista.length > NO_ACERTO.empalar.maximo) lista.splice(0, lista.length - NO_ACERTO.empalar.maximo);
      if (v('empalar_bloqueio_s') > 0) em.empalarBloqueadoAte = agora + v('empalar_bloqueio_s') * 1000;
      return true;
    };
    if (empalar(alvo)) ev('empalado');
    if (v('empalar_espalha') > 0) {
      for (const m of hunt?.monstros ?? []) {
        if (m === alvo || m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - alvo.x), Math.abs(m.y - alvo.y)) > RAIO_DO_EMPALAR_ESPALHADO) continue;
        if (empalar(m)) eventos?.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: 'empalado' });
      }
    }
  }
  // EQUILÍBRIO ELEMENTAL (a keystone da árvore, o PoE atual): o acerto com dano elemental TIRA a Exposição daqueles elementos e INFLIGE
  // Exposição aos outros (−25% de resistência, "Exposições infligidas desta forma aplicam −25%"), por 4 s — o mesmo sistema de Exposição acima.
  const elementosDoAcerto = [...new Set(elementos)].filter((el) => ['fire', 'ice', 'energy'].includes(el));
  if (v('equilibrio_exposicao') > 0 && elementosDoAcerto.length) {
    const pctEq = Math.abs(v('equilibrio_exposicao_pct')) || 25;
    e.exposicao = { ...(e.exposicao ?? {}) };
    e.exposicaoPct = { ...(e.exposicaoPct ?? {}) };
    for (const el of ['fire', 'ice', 'energy']) {
      if (elementosDoAcerto.includes(el)) { delete e.exposicao[el]; delete e.exposicaoPct[el]; continue; }
      const ainda = (e.exposicao[el] ?? 0) > agora;
      e.exposicao[el] = agora + 4000;
      e.exposicaoPct[el] = ainda ? Math.max(e.exposicaoPct[el] ?? 10, pctEq) : pctEq;
    }
  }
  // EQUILÍBRIO ELEMENTAL (keystone da peça, a regra antiga): o alvo acertado por dano elemental fica com +25% de resistência a esses elementos e −50% aos
  // outros, por 5 s (vale para os próximos acertos).
  const elementaisDoAcerto = [...new Set(elementos)].filter((el) => ['fire', 'ice', 'energy'].includes(el));
  if (v('keystone_equilibrio') > 0 && elementaisDoAcerto.length) e.equilibrio = { ate: agora + 5000, atingidos: elementaisDoAcerto };
  // SEGREDOS DO SOFRIMENTO (keystone da peça): o crítico inflige Causticar, Fragilizar e Exaurir.
  if (crit && v('keystone_sofrimento') > 0) {
    const ate = agora + AO_BLOQUEAR.duracaoMs;
    e.causticado = { ate, pct: AO_BLOQUEAR.causticar };
    e.fragilizado = { ate, pct: AO_BLOQUEAR.enfraquecer };
    e.exaurido = { ate, pct: AO_BLOQUEAR.exaurir };
  }
  // A Fúria ("Ganhe N de Fúria com Acertos Corpo a Corpo").
  // ("X% de chance de que se você fosse ganhar Fúria ao Acertar, você ganha até o seu máximo de fúria ao invés".)
  const furia = v('furia_por_acerto');
  if (furia > 0) ganharFuria(hunt, sorte(v('furia_max_ao_acertar_chance')) ? 9999 : furia, agora);
  // Escudo de Energia por acerto ("Ganha N de Escudo de Energia por Inimigo Acertado com Ataques").
  const es = tags.has('ataque') ? v('es_on_hit') : 0;
  if (es > 0 && estado) estado.es = Math.min(Math.max(0, Math.round(ficha.energyShield ?? 0)), (estado.es ?? 0) + es);
  // GOLPE DE MISERICÓRDIA (Culling Strike): o alvo com 10% da vida ou menos (5% se Raro ou Único) morre. Com condição: "Acertos Críticos
  // possuem Golpe de Misericórdia", "contra Inimigos Amaldiçoados/Incendiados/Congelados", "Ataques com Arcos têm Golpe Abatedor".
  const comCulling = v('culling') + (crit ? somaPorTagsDe(ficha, [...tags, 'critico']).culling ?? 0 : 0);
  if (comCulling > 0 && alvo.hp > 0 && !alvo.dummy && alvo.maxHp > 0) {
    const limiar = /raro|unico/.test(alvo.raridade ?? alvo.raridadePoe ?? '') || alvo.boss || alvo.chefe ? 0.05 : 0.1;
    if (alvo.hp <= alvo.maxHp * limiar) {
      alvo.hp = 0;
      eventos?.push({ t: 'estado', uid: alvo.uid, x: alvo.x, y: alvo.y, estado: 'misericordia' });
      evento(estado, hunt, 'golpeDeMisericordia', ficha, { alvo, eventos, personagem, agora });
    }
  }
  // Os EVENTOS dos únicos: no acerto, no crítico e ao atordoar (com o alvo e as tags do golpe).
  marcar(hunt, 'acertou', agora);
  // ("se você Acertou um Inimigo Único Recentemente")
  if (/unico/.test(alvo?.raridade ?? alvo?.raridadePoe ?? '') || alvo?.boss || alvo?.chefe) marcar(hunt, 'acertouUnico', agora);
  if (saida.atordoou) marcar(hunt, 'atordoou', agora);
  const ctx = { alvo, eventos, personagem, agora, tags: [...tags, ...(crit ? [] : ['naoCritico'])] };
  evento(estado, hunt, 'acertar', ficha, ctx);
  if (crit) evento(estado, hunt, 'critico', ficha, ctx);
  if (saida.atordoou) evento(estado, hunt, 'atordoar', ficha, ctx);
  return saida;
}

/** As afecções que um acerto PÔS no alvo (`queimando`, `congelado`, `eletrizado`, `envenenado`…) → os eventos e os "recentemente". */
const EVENTO_DA_AFECCAO = { queimando: ['incendiar', 'incendiou'], congelado: ['congelar', 'congelou'], eletrizado: ['eletrizar', 'eletrizou'], envenenado: ['envenenar', null] };
export function aoPorAfeccoes(estado, hunt, alvo, ficha, postos = [], { eventos = null, personagem = null } = {}) {
  if (!ligado() || !postos?.length) return;
  for (const p of new Set(postos)) {
    const [ev, rec] = EVENTO_DA_AFECCAO[p] ?? [];
    if (!ev) continue;
    if (rec) marcar(hunt, rec);
    evento(estado, hunt, ev, ficha, { alvo, eventos, personagem });
  }
  // ("Incêndios que você causar são refletidos para você", "Afecções Elementais infligidas por você são Refletidas à você": o Incêndio volta
  // com o mesmo dano e o tempo que falta; o Congelamento, pelo tempo dele — aproximado: a Eletrização e o Resfriamento não voltam.)
  const agoraR = hunt?.clock ?? 0;
  const refleteTudo = valor(ficha, 'afeccoes_elementais_refletidas') > 0;
  if (alvo && (refleteTudo || valor(ficha, 'incendio_refletido') > 0) && new Set(postos).has('queimando')) {
    const d = (alvo.dots ?? []).filter((x) => x.tipo === 'queimadura' && x.falta > 0).sort((x, y) => y.ate - x.ate)[0];
    if (d) dotNoJogador(hunt, { tipo: 'queimadura', total: d.falta, duracaoMs: Math.max(500, d.ate - agoraR), origem: { fonte: 'reflexo' } }, agoraR);
  }
  if (alvo && refleteTudo && new Set(postos).has('congelado') && alvo.estados?.congelado?.ate > agoraR) {
    const c = (hunt.controle ??= {});
    if (!((c.imuneAte ?? 0) > agoraR) && !(Number(ficha?.afPoe?.imune_congelamento) > 0)) c.congelado = { ate: Math.max(c.congelado?.ate ?? 0, alvo.estados.congelado.ate) };
  }
  // "Recupera X% de Vida ao Incendiar um Inimigo não Incendiado" (`afeccoes.aoAcertar` marca o alvo que não queimava).
  if (alvo?.estados?.incendiadoNovo) {
    delete alvo.estados.incendiadoNovo;
    evento(estado, hunt, 'incendiarNovo', ficha, { alvo, eventos, personagem });
  }
  // "Eletrizações infligidas por você se espalham para outros Inimigos dentro de N metros" (1 casa = 2 m): a mesma Eletrização nos de perto.
  // ("Velocidade de Movimento dos Inimigos Eletrizados por você reduzida em X%": a Eletrização posta também deixa Lento.)
  const lentoDaEletrizacao = valor(ficha, 'eletrizados_lentos');
  if (lentoDaEletrizacao > 0 && postos.includes('eletrizado') && alvo?.estados?.chocado) {
    const e = alvo.estados;
    e.lento = { ate: Math.max(e.lento?.ate ?? 0, e.chocado.ate), pct: Math.max(e.lento?.ate > (hunt?.clock ?? 0) ? e.lento.pct ?? 0 : 0, lentoDaEletrizacao) };
  }
  const metros = valor(ficha, 'eletrizacao_espalha_m');
  const s = alvo?.estados?.chocado;
  if (metros > 0 && postos.includes('eletrizado') && s) {
    const casas = Math.max(1, Math.round(metros / 2));
    for (const m of hunt?.monstros ?? []) {
      if (m === alvo || m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - alvo.x), Math.abs(m.y - alvo.y)) > casas) continue;
      const atual = m.estados?.chocado;
      if (atual && atual.ate > (hunt.clock ?? 0) && atual.pct >= s.pct) continue;
      (m.estados ??= {}).chocado = { ate: s.ate, pct: s.pct };
      eventos?.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: 'eletrizado' });
    }
  }
}


/**
 * O personagem levou um acerto de `bicho` (`dano`: o que passou de vida/escudo; `corpoACorpo`: o golpe de perto). O "acertado/dano
 * recentemente", o Reflexo de dano físico aos agressores corpo a corpo, o "Dano sofrido é Recuperado como Vida/Mana" (em 4 s, como o
 * Recoup do PoE) e o "chance de Congelar Inimigos quando te Acertarem". Devolve os eventos.
 */

/** O "X% do Dano de <elemento> sofrido é Recuperado como Vida" de cada elemento de golpe. */
const RECOUP_DO_ELEMENTO = { physical: 'recoup_life_phys', fire: 'recoup_life_fire', ice: 'recoup_life_ice', energy: 'recoup_life_energy', chaos: 'recoup_life_chaos' };
export function aoSerAcertado(estado, hunt, bicho, ficha, { dano = 0, corpoACorpo = false, tipo = null, agora = hunt?.clock ?? 0, rng = Math.random, eventos = [] } = {}) {
  if (!ligado() || !hunt || !ficha?.afPoe) return eventos;
  marcar(hunt, 'acertado', agora);
  if (dano > 0) marcar(hunt, 'dano', agora);
  // (Os frascos com "Ganhe N Cargas ao ser Acertado" — `frascos.tique`.)
  hunt.poeAcertosParaFrascos = (hunt.poeAcertosParaFrascos ?? 0) + 1;
  const v = (k) => valor(ficha, k);
  evento(estado, hunt, 'serAcertado', ficha, { alvo: bicho, eventos, agora });
  // ("X% de chance de ser infligido com Sangramento quando Acertado por um Ataque", "X% de chance dos Acertos Mágicos contra você infligirem
  // Veneno": a afecção em você, do dano que passou — o sangramento a 70% por segundo, o veneno a 30%, na duração base de cada um, como no PoE.)
  const emVoce = (tipo, pctPorSegundo) => {
    const posto = dotNoJogador(hunt, { tipo, total: (dano * pctPorSegundo * (Dot.CONFIG.tipos[tipo]?.duracaoMs ?? 4000)) / 1000, origem: { fonte: 'proprio' } }, agora, rng);
    if (posto) eventos.push({ t: 'estado', uid: 'player', x: hunt.pos?.x, y: hunt.pos?.y, estado: posto });
  };
  if (dano > 0 && corpoACorpo && v('sangrar_ao_ser_atacado') > 0 && rng() * 100 < v('sangrar_ao_ser_atacado')) emVoce('sangramento', 0.7);
  if (dano > 0 && !corpoACorpo && v('veneno_ao_ser_magia') > 0 && rng() * 100 < v('veneno_ao_ser_magia')) emVoce('venenoPoe', 0.3);
  // (+ os Reflexos elementais e de Caos dos únicos, e o "X% do Dano Físico Corpo a Corpo recebido é refletido aos Agressores".)
  const reflete = corpoACorpo ? v('reflect_phys_melee') + v('reflect_fire_melee') + v('reflect_ice_melee') + v('reflect_energy_melee') + v('reflect_chaos_melee') + (dano * v('reflete_fisico_pct')) / 100 : 0;
  if (reflete > 0 && bicho && bicho.hp > 0 && !bicho.dummy) {
    const d = Math.max(1, Math.round(reflete));
    bicho.hp -= d;
    eventos.push({ t: 'dmg', uid: bicho.uid, x: bicho.x, y: bicho.y, v: d, foe: true, alvo: bicho.name, color: '#c0c0c0', reflexo: true });
  }
  // (09/10) + a do ELEMENTO do golpe ("X% do Dano de Fogo sofrido é Recuperado como Vida": `recoup_life_<elemento>`) e a VELOCIDADE DE
  // RECUPERAÇÃO de Vida/Mana ("Velocidade de Recuperação de Vida aumentada": o mesmo total, em menos tempo).
  const doElemento = RECOUP_DO_ELEMENTO[tipo] ?? null;
  for (const [recurso, k, rapidez] of [['hp', 'recoup_life', 'recuperacao_vida_inc'], ['mana', 'recoup_mana', 'recuperacao_mana_inc']]) {
    const pct = v(k) + (doElemento && recurso === 'hp' ? v(doElemento) : 0);
    const ms = RECUPERACAO_MS / Math.max(0.1, 1 + v(rapidez) / 100);
    if (pct > 0 && dano > 0) (hunt.recuperacoes ??= []).push({ recurso, porMs: (dano * pct) / 100 / ms, ate: agora + ms });
  }
  if (bicho && bicho.hp > 0 && rng() * 100 < v('congelar_agressor')) {
    const dur = Math.round(1000 * (v('congelar_agressor_s') || 1));
    if (congelar(bicho, dur, agora, !!hunt.isBoss)) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'congelado' });
  }
  return eventos;
}

function congelar(bicho, dur, agora, salaDeBoss) {
  const e = (bicho.estados ??= {});
  if (Estados.atordoar(bicho, dur, agora, salaDeBoss)) {
    // Mesmas regras de controle; o estado posto é o Congelamento (o atordoar acabou de pôr o atordoado: vira congelado).
    e.congelado = e.atordoado;
    delete e.atordoado;
    return true;
  }
  return false;
}


/** O tipo de dano contínuo do motor (`combate/dot.json`) → a afecção do PoE e se é Elemental. */
// (`danifica`: Afecção Danificadora — Incêndio, Sangramento, Veneno — ou Não Danificadora — Eletrização, Resfriamento; a Maldição não é afecção)
const AFECCAO_DO_DOT = {
  queimadura: { nome: 'incendio', elemental: true, danifica: true }, choque: { nome: 'eletrizacao', elemental: true, danifica: false }, gelo: { nome: 'resfriamento', elemental: true, danifica: false },
  veneno: { nome: 'veneno', danifica: true }, venenoPoe: { nome: 'veneno', danifica: true }, sangramento: { nome: 'sangramento', danifica: true }, maldicao: { nome: 'maldicao' },
};
/** Você já tem uma Afecção Danificadora (`danifica`) ou Não Danificadora (o Congelamento e o Resfriamento do controle contam)? */
export function jaTemAfeccao(hunt, danifica, agora = hunt?.clock ?? 0) {
  if ((hunt?.efeitosDoJogador?.dots ?? []).some((d) => d.falta > 0 && AFECCAO_DO_DOT[d.tipo]?.danifica === danifica)) return true;
  const c = hunt?.controle ?? {};
  return !danifica && ((c.congelado?.ate ?? 0) > agora || (c.lento?.ate ?? 0) > agora);
}

/**
 * O dano contínuo de um monstro NO PERSONAGEM, pelos mods do PoE: "X% de chance de Evitar ser Incendiado" (e Afecções Elementais),
 * "Imunidade a …", "Duração do … em você reduzida" (a mesma dor por segundo, por mais ou menos tempo) e o efeito das Maldições/Eletrização/
 * Resfriamento em você. Devolve o estado posto (ou null). Sem o PoE, igual a `Dot.aplicarNoJogador`.
 */
/** A chance A MAIS de o monstro pôr a afecção do `tipo` (o do motor) em você ("+X% de chance de ser Eletrizado / Envenenado"). */
export function chanceExtraDeSer(ficha, tipo) {
  const a = AFECCAO_DO_DOT[tipo];
  return a ? valor(ficha, `chance_ser_${a.nome}`) : 0;
}
export function dotNoJogador(hunt, ef, agora, rng = Math.random) {
  const ficha = ligado() ? fichaDa(hunt) : null;
  const a = ficha?.afPoe ? AFECCAO_DO_DOT[ef.tipo] : null;
  if (!a) return Dot.aplicarNoJogador(hunt, ef, agora);
  const v = (k) => Number(ficha.afPoe[k]) || 0;
  if (v(`imune_${a.nome}`) > 0 || (hunt.imunidadesPoe?.[a.nome] ?? 0) > agora) return null;
  // "Afecções Danificadoras/Não Danificadoras Não Podem ser infligidas em você enquanto você já tiver uma" (a maestria de Afecções).
  if (a.danifica != null && v(a.danifica ? 'afeccao_dano_unica' : 'afeccao_controle_unica') > 0 && jaTemAfeccao(hunt, a.danifica, agora)) return null;
  // "Inimigos Sangrando não infligem Sangramento em você", "Inimigos Incendiados não podem te Incendiar": o monstro que bate tem a afecção.
  const quem = ef.origem?.uid != null ? (hunt.monstros ?? []).find((m) => m.uid === ef.origem.uid) : null;
  if (quem && ((ef.tipo === 'sangramento' && v('sem_sangramento_de_sangrando') > 0) || (ef.tipo === 'queimadura' && v('sem_incendio_de_incendiado') > 0)) && (quem.dots ?? []).some((d) => d.tipo === ef.tipo && d.falta > 0)) return null;
  const evitar = v(`evitar_${a.nome}`) + (a.elemental ? v('avoid_elem_ailments') : 0);
  if (evitar > 0 && rng() * 100 < evitar) return null;
  // ("Inimigos Amaldiçoados não podem infligir Afecções Elementais em Você": o monstro amaldiçoado por você.)
  if (a.elemental && quem && v('amaldicoados_sem_afeccao_elemental') > 0 && Object.values(quem.maldicoes ?? {}).some((m) => m && m.ate > agora)) return null;
  // (+ "Dano Degenerativo de Caos sofrido reduzido em X%": o veneno em você.)
  const caos = a.nome === 'veneno' ? Math.max(0, 1 - v('dot_caos_sofrido_red') / 100) : 1;
  // (+ "X% mais Duração de Afecções em você" — multiplica.)
  const dur = Math.max(0.1, 1 + (v(`duracao_${a.nome}_propria`) + v('duracao_afeccoes_propria') + (a.elemental ? v('duracao_afeccoes_elementais_propria') : 0)) / 100) * Math.max(0, 1 + v('duracao_afeccoes_propria_mais') / 100);
  const efeito = Math.max(0, 1 + v(`efeito_${a.nome}_proprio`) / 100);
  const base = Dot.CONFIG.tipos[ef.tipo]?.duracaoMs ?? 4000;
  const posto = Dot.aplicarNoJogador(hunt, { ...ef, total: ef.total * dur * efeito * caos, duracaoMs: Math.round((ef.duracaoMs ?? base) * dur) }, agora);
  if (posto) imunidadeApos(hunt, ficha, a.nome, agora);
  // ("Reflete Eletrizações aplicadas em você para todos Inimigos Próximos".)
  if (posto && a.nome === 'eletrizacao' && v('reflete_eletrizacao') > 0 && hunt.pos) {
    for (const m of hunt.monstros ?? []) {
      if (m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) > 3) continue;
      (m.estados ??= {}).chocado = { ate: agora + (ef.duracaoMs ?? base), pct: Math.max(m.estados.chocado?.ate > agora ? m.estados.chocado.pct ?? 0 : 0, 15) };
    }
  }
  return posto;
}


// ---------------------------------------------------------------- os EVENTOS dos únicos

/** O disparo de uma habilidade ATIVADA por item ("Ativa X Nível N quando…"): quem registra é `acoes.mjs` (evita o ciclo de importação). */
// eslint-disable-next-line no-var
var disparoDeGatilho;
export function definirDisparo(fn) { disparoDeGatilho = fn; }
/** A MALDIÇÃO posta por item ("Amaldiçoa Inimigos com Vulnerabilidade ao Bloquear"): quem registra é `acoes.mjs` (as gemas e os reforços). */
// eslint-disable-next-line no-var
var maldicaoDeItem;
export function definirMaldicao(fn) { maldicaoDeItem = fn; }
/** O ganho de cargas (`cargas.mjs`): registrado pela ficha (o máximo depende da soma). */
// eslint-disable-next-line no-var
var leitorDeCargas;
export function definirCargas(fn) { leitorDeCargas = fn; }

/**
 * "Seus Acertos só podem Matar Inimigos Congelados" (`so_mata_congelados`) e "Acertos de Lacaios só podem Matar Inimigos Incendiados"
 * (`lacaio_so_mata_incendiados`): o acerto que zeraria a vida de quem não está assim o deixa com 1. Quem não pode ser congelado no jogo (os
 * chefes — `Estados.ehChefe` — e quem tem resistência a controle de 100%) morre normalmente: no PoE eles congelam, aqui não.
 */
export function poupar(ficha, hunt, bicho, { lacaio = false, agora = hunt?.clock ?? 0 } = {}) {
  if (!ligado() || !bicho || bicho.hp > 0 || bicho.dummy) return;
  if (lacaio) {
    if (valor(ficha, 'lacaio_so_mata_incendiados') > 0 && !tagsDoAlvo(bicho, agora).includes('alvoIncendiado')) bicho.hp = 1;
    return;
  }
  if (!(valor(ficha, 'so_mata_congelados') > 0) || tagsDoAlvo(bicho, agora).includes('alvoCongelado')) return;
  if (Estados.ehChefe(bicho, !!hunt?.isBoss) || (Number(bicho.resistControle) || 0) >= 100) return;
  bicho.hp = 1;
}

/**
 * Um abate na keystone FÚRIA (o Rampage do PoE 1) — ou um acerto corpo a corpo, com "Acertos Corpo a Corpo contam como Mortes com Fúria":
 * soma 1 ao contador (até 1000), que zera se passar 5 s sem matar (`tique`). A cada 20: +2% de Dano e +1% de Velocidade de Movimento (as
 * escalas `%rampage:20` da tradução); "Recebe uma Carga de Frenesi a cada N Mortes com Fúria". Devolve true quando a ficha precisa ser
 * refeita (o primeiro e a cada 5 — os "a cada 15/20/25 Mortes" dos únicos).
 */
export function contarRampage(estado, hunt, ficha, agora = hunt?.clock ?? 0) {
  if (!hunt || !(valor(ficha, 'rampage') > 0)) return false;
  const r = hunt.rampage && hunt.rampage.ate > agora ? hunt.rampage : { n: 0 };
  const n = Math.min(RAMPAGE.maximo, r.n + 1);
  hunt.rampage = { n, ate: agora + RAMPAGE.esperaMs };
  const cada = valor(ficha, 'rampage_frenesi_cada');
  if (cada > 0 && n % cada === 0) leitorDeCargas?.(estado, 'ganhar', 'frenesi');
  // ("na Fúria" / "quando Enfurecido": as FAIXAS do contador — 15, 30, 45, 70… abates — disparam o evento `rampage`.)
  if (n !== r.n && RAMPAGE.faixas.includes(n)) { marcar(hunt, 'enfureceu', agora); evento(estado, hunt, 'rampage', ficha, {}); }
  return n !== r.n && (n === 1 || n % 5 === 0);
}
// O dreno do PoE (`Ficha.drenarPoe` — registrado pela ficha: este módulo não a importa).
// eslint-disable-next-line no-var
var drenoDaFicha;
export function definirDreno(fn) { drenoDaFicha = fn; }

/** Os estados que um evento põe no ALVO (`ev:<evento>:alvo:<estado>` = segundos ou chance). */
/** O raio do "também Empalam outros Inimigos próximos deles" (O Empalador), em casas. */
const RAIO_DO_EMPALAR_ESPALHADO = 2;
// A Redução de Dano Físico do monstro no empalamento solto (`hunt/resistencia.resistido`, sem a armadura): quem registra é a caçada — este
// módulo não importa a resistência (o ciclo de imports).
// eslint-disable-next-line no-var
var reducaoFisica;
export function definirReducaoFisica(fn) { reducaoFisica = fn; }
const ESTADOS_NO_ALVO = {
  cego: (e, ate) => (e.cego = { ate }), mutilado: (e, ate) => { e.mutilado = { ate }; e.lento = { ate, pct: Math.max(e.lento?.pct ?? 0, 30) }; },
  intimidado: (e, ate) => (e.intimidado = { ate }), debilitado: (e, ate) => { e.debilitado = { ate }; e.exaurido = { ate, pct: 10 }; e.lento = { ate, pct: Math.max(e.lento?.pct ?? 0, 20) }; },
  cinzas: (e, ate) => { e.cinzas = { ate }; e.lento = { ate, pct: Math.max(e.lento?.pct ?? 0, 20) }; }, causticado: (e, ate) => (e.causticado = { ate, pct: 10 }),
  fragilizado: (e, ate) => (e.fragilizado = { ate, pct: 6 }), exaurido: (e, ate) => (e.exaurido = { ate, pct: 10 }), lento: (e, ate) => (e.lento = { ate, pct: Math.max(e.lento?.pct ?? 0, 30) }),
  provocado: (e, ate) => (e.provocado = { ate }), resfriado: (e, ate) => (e.lento = { ate, pct: Math.max(e.lento?.pct ?? 0, 10) }),
  // Coberto de Gelo (PoE): +20% de dano de Gelo recebido e 50% menos chance de crítico (`condicoes-poe`).
  cobertoGelo: (e, ate) => (e.cobertoGelo = { ate }),
  exposicaoFogo: (e, ate) => (e.exposicao = { ...(e.exposicao ?? {}), fire: ate }), exposicaoGelo: (e, ate) => (e.exposicao = { ...(e.exposicao ?? {}), ice: ate }),
  exposicaoRaio: (e, ate) => (e.exposicao = { ...(e.exposicao ?? {}), energy: ate }), amaldicoado: (e, ate) => (e.amaldicoado = { ate }),
  definhado: (e, ate) => (e.definhado = { ate, n: Math.min(15, (e.definhado?.ate > 0 ? e.definhado.n : 0) + 1) }),
  // (a aura "Inimigos Próximos não podem causar Acertos Críticos" — `condicoes-poe.criticoDoBicho`)
  semCritico: (e, ate) => (e.semCritico = { ate }),
  // Excomungado (PoE): o inimigo não causa dano de Caos (`condicoes-poe.semCaos`).
  excomungado: (e, ate) => (e.excomungado = { ate }),
};
const SEGUNDOS_PADRAO = 4;
/** Põe um estado do PoE (`cego`, `cinzas`, `definhado`…) no alvo até `ate` — o mesmo das auras e dos eventos (o dos lacaios usa). */
export const porNoAlvo = (alvo, nome, ate) => ESTADOS_NO_ALVO[nome]?.((alvo.estados ??= {}), ate);
/** O morto EXPLODE: `pct`% da vida máxima dele em quem está em volta (1 casa) — o "Explodem ao morrer" (o do personagem e o dos lacaios). */
export function explodirMorto(hunt, alvo, pct, eventos) {
  const dano = Math.max(1, Math.round(((alvo.maxHp ?? 0) * pct) / 100));
  for (const m of hunt.monstros ?? []) {
    if (m === alvo || m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - alvo.x), Math.abs(m.y - alvo.y)) > 1) continue;
    m.hp -= dano;
    eventos?.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v: dano, foe: true, alvo: m.name, color: '#ff9000' });
  }
  eventos?.push({ t: 'explosao', id: 6, x: alvo.x, y: alvo.y, lado: 3 });
}

/**
 * Um EVENTO do PoE aconteceu (`matar`, `critico`, `bloquear`, `serAcertado`…): roda os mods `ev:<evento>:<ação>` da ficha cujas condições
 * valem (as de estado e as do alvo). `ctx`: `{ alvo, eventos, personagem, rng, agora }`. Ações: vida/mana/escudo (fixo ou %), cargas,
 * buffs, estados no alvo e em volta, dano em você, Fúria, cargas de frasco, recarga do escudo, explosão do morto, habilidade ativada.
 */
/**
 * Os eventos de USAR UM FRASCO ("Recupera 4% de Vida ao usar um Frasco", "Remove uma Afecção Elemental aleatória ao usar um Frasco de
 * Mana" — a Maestria de Frascos e os mods das peças): `usarFrasco` em qualquer frasco e `usarFrascoMana` no de mana. Quem chama é quem usou
 * o frasco (a sessão, `{t:'frasco', action:'usar'}`), depois de `Frascos.usar` dar certo — antes ninguém disparava (auditoria, 09/10).
 */
export function eventosDoFrasco(estado, classe, ficha, ctx = {}) {
  const hunt = estado?.hunt;
  if (!hunt) return;
  evento(estado, hunt, 'usarFrasco', ficha, ctx);
  if (classe === 'Mana_Flasks') evento(estado, hunt, 'usarFrascoMana', ficha, ctx);
}

/** Os GATILHOS das peças ("Ativa uma Magia Encaixada quando você Atacar com esta Arma"): quem registra é `acoes.mjs` (o disparo das gemas). */
// eslint-disable-next-line no-var
var gatilhosDeItem;
export function definirGatilhosDeItem(fn) { gatilhosDeItem = fn; }
export function evento(estado, hunt, nome, ficha, ctx = {}) {
  if (!ligado() || !hunt) return;
  const lista = ficha?.eventosPoe ?? [];
  const agora = ctx.agora ?? hunt.clock ?? 0;
  const rng = ctx.rng ?? Math.random;
  const alvo = ctx.alvo ?? null;
  const tagsAlvo = new Set([...tagsDoAlvo(alvo, agora), ...(ctx.tags ?? [])]);
  let conds = null;
  for (const ev of lista) {
    if (ev.evento !== nome) continue;
    if (ev.conds.length) {
      conds ??= condicoesDe(estado, ficha.afPoe);
      // (+ "afetado por MENOS de N Venenos" — `alvoMenosVenenos:N`: o alvo não tem a tag `alvoVenenos:N`.)
      if (!ev.conds.every((c) => (ehCondDeEstado(c) ? vale(conds, c) : /^alvoMenosVenenos:\d+$/.test(c) ? !tagsAlvo.has(`alvoVenenos:${c.split(':')[1]}`) : tagsAlvo.has(c)))) continue;
    }
    // (o evento com ESCALA: o valor × o fator agora — "por Carga de Frenesi", com o teto)
    const acao = ev.escala ? { ...ev, valor: comTeto(ev.valor, fatorDaEscala(estado, ficha.afPoe, null, ev.escala), ev.teto) } : ev;
    if (acao.valor) aplicarAcao(estado, hunt, acao, ficha, { ...ctx, alvo, agora, rng });
  }
  // (+ os gatilhos das peças no mesmo evento — `acoes.mjs`.)
  gatilhosDeItem?.(estado, hunt, nome, ficha, { ...ctx, alvo, agora, tagsAlvo });
}

function aplicarAcao(estado, hunt, ev, ficha, ctx) {
  const { alvo, agora, rng, eventos } = ctx;
  const v = ev.valor;
  // Vida, mana e escudo são INTEIROS: as ações em % ("Recupera 3% do Escudo de Energia ao Matar" com 76 de escudo = 2,28) entram pela parte
  // inteira e a fração fica guardada para a próxima (como a regeneração e a recarga do escudo) — a cura pequena não some e o dano não sai a
  // mais. Antes a fração ia direto no estado: escudo 52,28, e o golpe que o atravessava passava 17,72 para a vida (09/10).
  const inteiro = (campo, quanto) => {
    const r = (hunt.poeRestoDosEventos ??= { hp: 0, mana: 0, es: 0 });
    r[campo] += quanto;
    const n = Math.trunc(r[campo]);
    r[campo] -= n;
    return n;
  };
  // (o Pacto Vaal — "Não pode Recuperar Vida fora o Dreno": a vida dos eventos não enche)
  const curar = (campo, max, quanto) => { if (quanto > 0 && (estado.hp ?? 0) > 0 && !(campo === 'hp' && vidaSoPeloDreno(ficha?.afPoe))) estado[campo] = Math.min(max, (estado[campo] ?? 0) + inteiro(campo, quanto)); };
  const perder = (campo, min, quanto) => { estado[campo] = Math.max(min, (estado[campo] ?? 0) + inteiro(campo, -quanto)); };
  const esMax = Math.max(0, Math.round(ficha?.energyShield ?? 0));
  const sorte = (pct) => pct >= 100 || rng() * 100 < pct;
  // (ganhar a ADRENALINA dispara "ao ganhar Adrenalina" — "Recupera 25% de Vida ao ganhar Adrenalina", o Campeão; sem disparar de dentro dele)
  const ganhar = (buff, seg) => {
    ganharBuff(hunt, buff, seg, agora);
    if (buff === 'adrenalina' && ev.evento !== 'ganharAdrenalina') evento(estado, hunt, 'ganharAdrenalina', ficha, { ...ctx, alvo: null });
  };
  switch (ev.acao) {
    case 'vida': return curar('hp', estado.maxHp ?? 0, v);
    case 'vidaPct': return curar('hp', estado.maxHp ?? 0, ((estado.maxHp ?? 0) * v) / 100);
    // `vidaPctChance:<pct>` / `manaPctChance:<pct>` = a CHANCE (%) de recuperar pct% ("10% de chance de Recuperar toda a Vida ao Matar").
    case 'vidaPctChance': if (sorte(v)) curar('hp', estado.maxHp ?? 0, ((estado.maxHp ?? 0) * (Number(ev.param) || 0)) / 100); return;
    case 'manaPctChance': if (sorte(v)) curar('mana', estado.maxMana ?? 0, ((estado.maxMana ?? 0) * (Number(ev.param) || 0)) / 100); return;
    case 'mana': return curar('mana', estado.maxMana ?? 0, v);
    case 'manaPct': return curar('mana', estado.maxMana ?? 0, ((estado.maxMana ?? 0) * v) / 100);
    case 'es': return curar('es', esMax, v);
    case 'esPct': return curar('es', esMax, (esMax * v) / 100);
    case 'perdeVidaPct': return perder('hp', 1, ((estado.maxHp ?? 0) * v) / 100);
    // ("Perde N de Vida para cada Inimigo acertado por seus Ataques": a perda não mata — fica em 1.)
    case 'perdeVida': return perder('hp', 1, v);
    // ("Feitiços se Transferem para todos os Inimigos dentro de N metros quando o Inimigo Enfeitiçado morrer" — as maldições (não as marcas) do
    // morto passam aos de perto, com o tempo que faltava; "Sua Marca se transfere para outro Inimigo quando o Inimigo Marcado morrer" — para o
    // vivo mais perto.)
    case 'transferirMaldicoes':
    case 'transferirMarca': {
      if (!alvo?.maldicoes) return;
      const marca = ev.acao === 'transferirMarca';
      const passar = Object.entries(alvo.maldicoes).filter(([, m]) => m && m.ate > agora && !!m.marca === marca);
      if (!passar.length) return;
      const casas = Math.max(1, Math.round((Number(ev.param) || 2) / 2));
      const vivos = (hunt.monstros ?? []).filter((m) => m !== alvo && m.hp > 0 && !m.dummy).map((m) => ({ m, d: Math.max(Math.abs(m.x - alvo.x), Math.abs(m.y - alvo.y)) }));
      const destinos = marca ? vivos.sort((a, b) => a.d - b.d).slice(0, 1) : vivos.filter((x) => x.d <= casas);
      for (const { m } of destinos) for (const [id, mal] of passar) (m.maldicoes ??= {})[id] = { ...mal };
      return;
    }
    // O bônus TEMPORÁRIO com valor: "Velocidade de Movimento aumentada em X% por N segundos ao Jogar uma Armadilha" = `statTemp:<atributo>:<s>`
    // (renova; o maior vale); "+X% de Chance de Crítico por N segundos quando você Gastar um total de M de Mana" = `statTempPorMana:<atributo>:
    // <s>:<M>` (a mana gasta acumula até M); "Ganha N de Fúria após Gastar um total de M de Mana" = `furiaPorMana:<M>`.
    case 'statTemp':
    case 'statTempPorMana':
    case 'furiaPorMana': {
      const [p1, p2, p3] = String(ev.param).split(':');
      const porMana = ev.acao !== 'statTemp';
      if (porMana) {
        const limite = Number(ev.acao === 'furiaPorMana' ? p1 : p3) || 0;
        if (!(limite > 0)) return;
        const acc = (hunt.poeManaAcumulada ??= {});
        const k = `${ev.acao}:${ev.param}`;
        acc[k] = (acc[k] ?? 0) + (Number(ctx.quantidade) || 0);
        if (acc[k] < limite) return;
        acc[k] %= limite;
      }
      if (ev.acao === 'furiaPorMana') return ganharFuria(hunt, v, agora);
      const t = (hunt.poeTemporarios ??= {});
      const ate = agora + (Number(p2) || 1) * 1000;
      t[p1] = t[p1] && t[p1].ate > agora ? { stat: p1, valor: Math.max(t[p1].valor, v), ate: Math.max(t[p1].ate, ate) } : { stat: p1, valor: v, ate };
      return;
    }
    // ("Você recebe N de Dano de Caos por segundo durante S segundos ao Matar": `degenEmVoce:<tipo do motor>:<segundos>`.)
    // ("Inflige Decaimento em Inimigos que Amaldiçoar…, causando N de Dano de Caos por Segundo por S Segundos": `degenNoAlvo:<tipo>:<s>`.)
    case 'degenNoAlvo': {
      const [tipo, seg] = String(ev.param).split(':');
      const s = Number(seg) || 1;
      if (alvo && alvo.hp > 0) Dot.aplicar(alvo, { tipo, total: v * s, duracaoMs: s * 1000, origem: { fonte: 'poe' } }, agora);
      return;
    }
    // ("Suas Habilidades causam X% da Mana Gasta no Custo de Mana Direto da Habilidade como Dano Físico": a vida perdida, sem matar.)
    case 'danoPorMana': return perder('hp', 1, ((Number(ctx.quantidade) || 0) * v) / 100);
    // ("Clamores Empurram e Interrompem Inimigos em uma pequena Área": a CHANCE de empurrar quem está a até 2 casas.)
    case 'empurrarProximos': {
      if (!hunt.pos || !sorte(v)) return;
      for (const m of [...(hunt.monstros ?? [])].sort((x, y) => Math.max(Math.abs(y.x - hunt.pos.x), Math.abs(y.y - hunt.pos.y)) - Math.max(Math.abs(x.x - hunt.pos.x), Math.abs(x.y - hunt.pos.y)))) {
        if (m.hp > 0 && !m.dummy && Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) <= 2) empurrar(hunt, m);
      }
      return;
    }
    case 'degenEmVoce': {
      const [tipo, seg] = String(ev.param).split(':');
      const s = Number(seg) || 1;
      dotNoJogador(hunt, { tipo, total: v * s, duracaoMs: s * 1000, origem: { fonte: 'proprio' } }, agora, rng);
      return;
    }
    // ("Recupera Escudo de Energia igual a X% da Armadura quando você Bloquear".)
    case 'esDaArmadura': return curar('es', esMax, ((Number(ficha?.armor) || 0) * v) / 100);
    // ("Sacrifica X% de Vida para receber a mesma quantidade em Escudo de Energia ao Conjurar uma Magia": a vida não mata — fica em 1.)
    case 'vidaParaEs': {
      const antes = estado.hp ?? 0;
      perder('hp', 1, ((estado.maxHp ?? 0) * v) / 100);
      return curar('es', esMax, antes - (estado.hp ?? 0));
    }
    case 'perdeEsPct': return perder('es', 0, (esMax * v) / 100);
    case 'perdeManaPct': return perder('mana', 0, ((estado.maxMana ?? 0) * v) / 100);
    case 'carga': if (sorte(v)) leitorDeCargas?.(estado, 'ganhar', ev.param, 1); return;
    case 'cargaMax': if (sorte(v)) leitorDeCargas?.(estado, 'max', ev.param); return;
    case 'perdeCargas': if (sorte(v)) leitorDeCargas?.(estado, 'perder', ev.param); return;
    case 'cargaAleatoria': if (sorte(v)) leitorDeCargas?.(estado, 'ganhar', ['frenesi', 'poder', 'tolerancia'][Math.floor(rng() * 3)], 1); return;
    case 'roubarCargas': if (sorte(v)) for (const t of ['frenesi', 'poder', 'tolerancia']) leitorDeCargas?.(estado, 'ganhar', t, 1); return;
    case 'buff': return ganhar(ev.param, v);
    // `buffChance:<buff>:<segundos>` = a CHANCE (%) de ganhar o buff por N segundos ("X% de chance de ganhar Agressividade por 4 segundos ao Matar").
    case 'buffChance': { const [buff, seg] = String(ev.param).split(':'); if (sorte(v)) ganhar(buff, Number(seg) || SEGUNDOS_PADRAO); return; }
    case 'furia': return ganharFuria(hunt, v, agora);
    case 'frasco': { for (const p of estado.frascos ?? []) if (p?.poe) p.poe.cargas = (p.poe.cargas ?? 0) + v; return; }
    // "X% de chance de ganhar uma Carga de Frasco ao causar um Golpe Crítico": a CHANCE de cada frasco do cinto ganhar uma carga.
    case 'frascoChance': { if (sorte(v)) for (const p of estado.frascos ?? []) if (p?.poe) p.poe.cargas = (p.poe.cargas ?? 0) + 1; return; }
    case 'recargaEs': if (sorte(v)) estado.esEspera = 0; return;
    // `removerAfeccao:elementais` ("Remove Afecções Elementais quando você Conjurar uma Magia Maldição"): o Incêndio, a Eletrização, o
    // Resfriamento e o Congelamento em você; sem parâmetro, a afecção mais antiga.
    case 'removerAfeccao': if (sorte(v)) {
      if (ev.param === 'elementais') {
        for (const t of ['queimadura', 'choque', 'gelo']) Dot.removerDoJogador(hunt, t);
        if (hunt.controle) { delete hunt.controle.congelado; delete hunt.controle.lento; }
      } else { const d = hunt.efeitosDoJogador?.dots; if (d?.length) d.shift(); }
    } return;
    case 'alvo': {
      // `alvo:<estado>[:segundos]` = a CHANCE (%) de pôr o estado no alvo (100 = sempre).
      if (!alvo || alvo.hp <= 0) return;
      const [nomeDoEstado, seg] = String(ev.param).split(':');
      const fazer = ESTADOS_NO_ALVO[nomeDoEstado];
      if (!fazer || !sorte(v)) return;
      fazer((alvo.estados ??= {}), agora + (Number(seg) || SEGUNDOS_PADRAO) * 1000);
      eventos?.push({ t: 'estado', uid: alvo.uid, x: alvo.x, y: alvo.y, estado: nomeDoEstado });
      return;
    }
    case 'proximos': {
      // `proximos:<estado>[:segundos]` = a chance de pôr o estado em quem está a até 3 casas.
      const [nomeDoEstado, seg] = String(ev.param).split(':');
      const fazer = ESTADOS_NO_ALVO[nomeDoEstado];
      if (!fazer || !hunt.pos || !sorte(v)) return;
      for (const m of hunt.monstros ?? []) {
        if (m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) > 3) continue;
        fazer((m.estados ??= {}), agora + (Number(seg) || SEGUNDOS_PADRAO) * 1000);
      }
      return;
    }
    // `fumaca` = a CHANCE de criar uma Nuvem de Fumaça: no PoE ela Cega quem está dentro — como o frasco, os a até 3 casas, por 4 s.
    case 'fumaca': return aplicarAcao(estado, hunt, { ...ev, acao: 'proximos', param: 'cego:4' }, ficha, ctx);
    case 'dano': return perder('hp', 0, v);
    case 'vidaFaltaPct': return curar('hp', estado.maxHp ?? 0, (((estado.maxHp ?? 0) - (estado.hp ?? 0)) * v) / 100);
    case 'perdeMana': return perder('mana', 0, v);
    case 'perdeUmaCarga': { if (!sorte(v)) return; const c = hunt.cargasPoe?.[ev.param]; if (c?.n > 0) { c.n--; if (!c.n) delete hunt.cargasPoe[ev.param]; } return; }
    case 'refletir': {
      // "Reflete N a M de Dano Físico para Atacantes ao Bloquear": o dano no alvo do evento.
      if (!alvo || alvo.hp <= 0 || alvo.dummy) return;
      const d = Math.max(1, Math.round(v));
      alvo.hp -= d;
      eventos?.push({ t: 'dmg', uid: alvo.uid, x: alvo.x, y: alvo.y, v: d, foe: true, alvo: alvo.name, color: '#c0c0c0', reflexo: true });
      return;
    }
    case 'danoPctVida': return perder('hp', 0, ((estado.maxHp ?? 0) * v) / 100);
    // `explodirChance:<pct da vida>` = a CHANCE (%) de o morto explodir ("Inimigos Queimando mortos por você têm X% de chance de Explodirem").
    case 'explodirChance': if (!sorte(v)) return; return aplicarAcao(estado, hunt, { ...ev, acao: 'explodir', valor: Number(ev.param) || 10 }, ficha, ctx);
    case 'explodir': {
      if (!alvo || !hunt.pos) return;
      explodirMorto(hunt, alvo, v, eventos);
      return;
    }
    case 'espalhar': {
      // "Quando você Matar um Inimigo Incendiado/Eletrizado, uma afecção equivalente é infligida em um Inimigo próximo".
      if (!alvo) return;
      const perto = (hunt.monstros ?? []).filter((m) => m !== alvo && m.hp > 0 && !m.dummy).sort((a, b) => Math.max(Math.abs(a.x - alvo.x), Math.abs(a.y - alvo.y)) - Math.max(Math.abs(b.x - alvo.x), Math.abs(b.y - alvo.y)))[0];
      if (!perto) return;
      if (ev.param === 'incendio') for (const d of (alvo.dots ?? []).filter((x) => x.tipo === 'queimadura' && x.falta > 0)) Dot.aplicar(perto, { tipo: 'queimadura', total: d.falta, origem: { fonte: 'poe' } }, agora);
      if (ev.param === 'eletrizacao' && alvo.estados?.chocado?.ate > agora) (perto.estados ??= {}).chocado = { ...alvo.estados.chocado };
      // "Congelamentos/Eletrizações infligidos por você se espalham para outros Inimigos dentro de N metros" (N = o valor; 1 casa = 2 m).
      // ("Incêndios infligidos por você se espalham para outros Inimigos dentro de N metros": os Incêndios do alvo nos de perto.)
      if (ev.param === 'incendioRaio') {
        const casas = Math.max(1, Math.floor(v / 2));
        const queimando = (alvo.dots ?? []).filter((x) => x.tipo === 'queimadura' && x.falta > 0);
        for (const m of hunt.monstros ?? []) if (m !== alvo && m.hp > 0 && !m.dummy && Math.max(Math.abs(m.x - alvo.x), Math.abs(m.y - alvo.y)) <= casas) for (const d of queimando) Dot.aplicar(m, { tipo: 'queimadura', total: d.falta, origem: { fonte: 'poe' } }, agora);
        return;
      }
      if (ev.param === 'congelamentoRaio' || ev.param === 'eletrizacaoRaio') {
        const casas = Math.max(1, Math.floor(v / 2));
        const chave = ev.param === 'congelamentoRaio' ? 'congelado' : 'chocado';
        if (!(alvo.estados?.[chave]?.ate > agora)) return;
        for (const m of hunt.monstros ?? []) if (m !== alvo && m.hp > 0 && !m.dummy && Math.max(Math.abs(m.x - alvo.x), Math.abs(m.y - alvo.y)) <= casas) (m.estados ??= {})[chave] = { ...alvo.estados[chave] };
      }
      return;
    }
    // `maldicao:<gema>:<nível>[:semLimite]` = a CHANCE (%) de amaldiçoar o alvo com a maldição da gema naquele nível ("ignorando o Limite de
    // Maldições" = `semLimite`).
    case 'maldicao': {
      const [gema, nivel, semLimite] = String(ev.param).split(':');
      if (maldicaoDeItem && alvo && alvo.hp > 0 && sorte(v)) maldicaoDeItem(hunt, alvo, gema, Number(nivel) || 10, semLimite === 'semLimite', agora);
      return;
    }
    // `gatilho:<gema>[:chance]` = o NÍVEL da habilidade ativada.
    case 'gatilho': { const [gema, chance] = String(ev.param).split(':'); if (disparoDeGatilho && sorte(Number(chance) || 100)) disparoDeGatilho(estado, hunt, ctx.personagem, gema, v, alvo, eventos); return; }
    default: return;
  }
}

/**
 * As AURAS dos únicos em quem está perto (a até 3 casas): "Inimigos Próximos são Cegados / Resfriados / Causticados / Intimidados / Lentos /
 * Cobertos em Cinzas" — `aura_proximos:<estado>`. A caçada chama a cada tique; o estado dura 1 s e é renovado enquanto o bicho está perto.
 */
export function aurasProximas(estado, hunt, ficha, agora = hunt?.clock ?? 0) {
  if (!ligado() || !hunt?.pos || !ficha?.afPoe) return;
  // O evento "ao atingir Vida Baixa" (cruzou os 50% para baixo).
  const baixa = (estado.maxHp ?? 0) > 0 && (estado.hp ?? 0) > 0 && estado.hp <= estado.maxHp * 0.5;
  if (baixa && !hunt.poeVidaBaixa) evento(estado, hunt, 'vidaBaixa', ficha, { agora });
  hunt.poeVidaBaixa = baixa;
  // O buff a cada N segundos ("Você ganha Sobrecarga Elemental por 8 segundos a cada 16 segundos").
  for (const [k, dur] of Object.entries(ficha.afPoe)) {
    const p = /^buff_periodico:(\w+):(\d+)$/.exec(k);
    if (!p || !(dur > 0)) continue;
    const prox = (hunt.poePeriodicos ??= {});
    if (agora < (prox[k] ?? 0)) continue;
    ganharBuff(hunt, p[1], dur, agora);
    prox[k] = agora + Number(p[2]) * 1000;
  }
  const auras = Object.entries(ficha.afPoe).filter(([k, x]) => k.startsWith('aura_proximos:') && x > 0).map(([k]) => k.slice('aura_proximos:'.length));
  // (as auras com VALOR: a lentidão de X%, as resistências dos de perto, a de um elemento igual à sua)
  const lento = Number(ficha.afPoe.aura_proximos_lento) || 0;
  const res = {};
  for (const el of ['fire', 'ice', 'energy', 'chaos']) {
    const v = (Number(ficha.afPoe[`aura_proximos_res:${el}`]) || 0) + (Number(ficha.afPoe['aura_proximos_res:todas']) || 0);
    if (v) res[el] = v;
  }
  const igual = Object.fromEntries(['fire', 'ice', 'energy', 'chaos'].filter((el) => Number(ficha.afPoe[`aura_proximos_res_igual:${el}`]) > 0).map((el) => [el, ficha.protection?.[el] ?? 0]));
  if (!auras.length && !lento && !Object.keys(res).length && !Object.keys(igual).length) return;
  for (const m of hunt.monstros ?? []) {
    if (m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) > 3) continue;
    const e = (m.estados ??= {});
    for (const a of auras) ESTADOS_NO_ALVO[a]?.(e, agora + 1000);
    if (lento) e.lento = { ate: Math.max(e.lento?.ate ?? 0, agora + 1000), pct: Math.max(e.lento?.ate > agora ? e.lento.pct ?? 0 : 0, lento) };
    if (Object.keys(res).length) e.resAura = { ...res, ate: agora + 1000 };
    if (Object.keys(igual).length) e.resIgual = { ...igual, ate: agora + 1000 };
  }
}
