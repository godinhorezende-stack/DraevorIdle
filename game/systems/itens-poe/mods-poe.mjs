// Os efeitos do PoE que mexem nos ESTADOS dos bichos e no dano contínuo (o atordoamento, Mutilar, Cegar, Empalar…; o que o personagem
// recebe). O resto (condições, soma, ficha do golpe, leitura dos mods) mora em `condicoes-poe.mjs` — sem dependências pesadas, para os
// módulos de base (afixos, gemas, tradução, resistência) poderem usar sem ciclo de importação. Este módulo reexporta tudo de lá.
import { ligado } from './catalogo.mjs';
import * as Estados from '../skills/estados.mjs';
import * as Dot from '../combate/dot.mjs';
import { marcaNoBicho, RAIO_DA_PRESENCA, criarSoloSagrado, ganharValor, posturaDe, valor, marcar, ganharFuria, ativo, fichaDa, NO_ACERTO, RECUPERACAO_MS, AO_BLOQUEAR, condicoesDe, vale, ehCondDeEstado, ganharBuff, tagsDoAlvo, vidaSoPeloDreno, transferirMarca, ganharFortificacao } from './condicoes-poe.mjs';
export * from './condicoes-poe.mjs';



/**
 * O que um ACERTO do personagem faz além do dano (sistema do PoE): o atordoamento, Mutilar, Cegar, Desacelerar, Empurrar, Provocar,
 * Empalar (e solta os empalamentos do alvo), a Fúria e o Escudo de Energia por acerto. `ficha`: a do golpe (`fichaDoGolpe`, com as tags).
 * `dano`: o total do acerto; `fisico`: a parte Física. Devolve `{ atordoou, extra }` — `extra`: o dano dos empalamentos soltos (já tirado).
 */
export function aoAcertar(estado, hunt, alvo, ficha, { dano = 0, fisico = 0, crit = false, eventos = null, agora = hunt?.clock ?? 0, rng = Math.random, mover = null, elementos = [], personagem = null } = {}) {
  const saida = { atordoou: false, extra: 0 };
  if (!ligado() || !alvo || alvo.dummy || !ficha?.afPoe) return saida;
  // (ciclo 7, lote D) O que o golpe FEZ entra nas tags dele: o Crítico (`X@critico`) e, depois do sorteio do atordoamento, o Atordoou
  // (`X@golpeAtordoou`) — "Acertos Críticos possuem Golpe de Misericórdia", "Acertos Corpo a Corpo que Atordoam têm X% de chance de Fortificar".
  let fichaR = crit ? { ...ficha, tagsDoGolpe: [...(ficha.tagsDoGolpe ?? []), 'critico'] } : ficha;
  const v = (k) => valor(fichaR, k);
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
  // (lote D) A FORTIFICAÇÃO ("Acertos Corpo a Corpo Fortificam", "X% de chance de Fortificar"): pelo tamanho do acerto — vale também no
  // acerto que matou (`condicoes-poe.ganharFortificacao`).
  const fortificar = (chance) => {
    if (!hunt || !sorte(chance)) return;
    const pct = alvo.maxHp > 0 ? (100 * Math.max(0, dano)) / alvo.maxHp : 1;
    ganharFortificacao(hunt, Math.max(1, Math.floor(pct)) * Math.max(0, 1 + v('fortificacao_ganho_inc') / 100), ficha.afPoe, agora);
  };
  fortificar(v('chance_fortificar'));
  // (lote G) O VALOR (com um Estandarte ligado): o acerto corpo a corpo que mata, ou num Raro ou Único — `ganharValor` (uma vez a cada 0,5 s).
  if (tags.has('corpo') && (alvo.hp <= 0 || /raro|unico/.test(alvo.raridade ?? '') || alvo.boss)) ganharValor(hunt, 1, ficha.afPoe, agora);
  if (alvo.hp <= 0) return saida;
  // ATORDOAMENTO (o do PoE: pelo tamanho do acerto em relação à vida do alvo).
  // (+ "Acertos Atordoam como se causassem X% mais Dano de Fogo Corpo a Corpo": o acerto corpo a corpo com Fogo conta X% a mais.)
  const limiar = Math.max(1, (alvo.maxHp ?? alvo.hp) * Math.max(0.05, 1 - v('enemy_stun_threshold_red') / 100));
  const comoFogo = tags.has('corpo') && elementos.includes('fire') ? v('atordoar_como_fogo_mais') : 0;
  const chanceAtordoar = (NO_ACERTO.atordoamento.fator * dano * (1 + comoFogo / 100)) / limiar;
  if (chanceAtordoar >= NO_ACERTO.atordoamento.minimoPct && rng() * 100 < Math.min(100, chanceAtordoar)) {
    // (+ "X% mais Duração de Atordoamentos com Armas de Duas Mãos": multiplica.)
    let dur = NO_ACERTO.atordoamento.duracaoMs * (1 + v('stun_duration') / 100) * Math.max(0, 1 + v('stun_duration_mais') / 100);
    if (rng() * 100 < v('chance_dobrar_atordoamento')) dur *= 2;
    if (Estados.atordoar(alvo, Math.round(dur), agora, salaDeBoss)) {
      saida.atordoou = true;
      ev('atordoado');
      fichaR = { ...fichaR, tagsDoGolpe: [...(fichaR.tagsDoGolpe ?? []), 'golpeAtordoou'] };
      // ("Acertos Corpo a Corpo que Atordoam têm X% de chance de Fortificar": só a parte que depende de ter atordoado.)
      fortificar(v('chance_fortificar') - valor({ ...fichaR, tagsDoGolpe: fichaR.tagsDoGolpe.filter((t) => t !== 'golpeAtordoou') }, 'chance_fortificar'));
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
    // (+ lote D: "Duração da Cegueira aumentada")
    e.cego = { ate: agora + Math.round(NO_ACERTO.cegar.duracaoMs * Math.max(0.1, 1 + v('duracao_cegueira') / 100)), criticoMenosPct: v('cegados_critico_red'), ...(v('cegos_esconjuro') > 0 ? { esconjuro: true } : {}), ...(v('efeito_cegueira') ? { efeito: Math.max(0, 1 + v('efeito_cegueira') / 100) } : {}) };
    ev('cego');
  }
  if (tags.has('magia') && sorte(v('chance_desacelerar'))) {
    e.desacelerado = { ate: agora + NO_ACERTO.desacelerar.duracaoMs, regenMenosPct: v('desacelerados_regen_red') };
    lentidao(NO_ACERTO.desacelerar.lentidaoPct, NO_ACERTO.desacelerar.duracaoMs);
    ev('lento');
  }
  if (sorte(v('chance_provocar'))) {
    // (+ lote D: "Duração da Provocação aumentada")
    e.provocado = { ate: agora + Math.round(NO_ACERTO.provocar.duracaoMs * Math.max(0.1, 1 + v('duracao_provocacao') / 100)), por: estado?.nome ?? null };
    ev('provocado');
  }
  // (lote D) ESMAGAR (o PoE: o Esmagado tem 15% menos Redução de Dano Físico — `hunt/resistencia`): "Esmaga Inimigos ao acertar com Maças e
  // Cetros" (4 s) e "Esmaga Inimigos por N segundos quando você Acertá-los enquanto estiverem em Vida Cheia" (`esmagar_s`).
  if (v('esmagar_s') > 0 || sorte(v('chance_esmagar'))) {
    e.esmagado = { ate: Math.max(e.esmagado?.ate ?? 0, agora + 1000 * (v('esmagar_s') || 4)) };
    ev('esmagado');
  }
  // (lote E) As MINAS: "Cada Mina aplica Dano sofrido aumentado / Dano causado reduzido em X% aos Inimigos próximos a ela, até Y%" — no jogo a
  // Mina detona no alvo: cada acerto de Mina soma X no alvo, até Y, por 4 s (`mina_fragiliza:<Y>` / `mina_enfraquece:<Y>` = X).
  if (tags.has('mina')) {
    for (const [k, x] of Object.entries(ficha.afPoe)) {
      const mm = /^mina_(fragiliza|enfraquece):(\d+)$/.exec(k);
      if (!mm || !(x > 0)) continue;
      const campo = mm[1] === 'fragiliza' ? 'minaFragil' : 'minaFraco';
      const antes = ativo(e[campo], agora) ? e[campo].pct : 0;
      // (+ "Efeito de Auras das Minas aumentado em X%")
      e[campo] = { ate: agora + 4000, pct: Math.min(Number(mm[2]), antes + x * Math.max(0, 1 + v('efeito_aura_mina') / 100)) };
    }
  }
  // "Seus Acertos Intimidam permanentemente Inimigos com Vida Cheia" (a tag `alvoVidaCheia` do golpe).
  if (v('intimidar_permanente') > 0) e.intimidado = { ate: agora + 3600 * 1000 };
  if (sorte(v('chance_empurrar')) && typeof mover === 'function' && mover(alvo)) ev('empurrado');
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
    marcar(hunt, 'infligiuExposicao', agora);
  }
  // O EMPALAMENTO: o efeito (+ "em Inimigos não Empalados"), os acertos ("duram por N Acerto adicional"), a duração, os "N Empalamentos
  // adicionais" e o espalhar ("também Empalam outros Inimigos próximos deles" — O Empalador), com o "Por N segundos … não podem ser Empalados
  // novamente".
  if (fisico > 0 && sorte(v('chance_empalar'))) {
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
      marcar(hunt, 'empalou', agora);
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
  const furia = v('furia_por_acerto');
  if (furia > 0) ganharFuria(hunt, furia, agora);
  // Escudo de Energia por acerto ("Ganha N de Escudo de Energia por Inimigo Acertado com Ataques").
  const es = tags.has('ataque') ? v('es_on_hit') : 0;
  if (es > 0 && estado) estado.es = Math.min(Math.max(0, Math.round(ficha.energyShield ?? 0)), (estado.es ?? 0) + es);
  // GOLPE DE MISERICÓRDIA (Culling Strike): o alvo com 10% da vida ou menos (5% se Raro ou Único) morre. Com condição: "Acertos Críticos
  // possuem Golpe de Misericórdia", "contra Inimigos Amaldiçoados/Incendiados/Congelados", "Ataques com Arcos têm Golpe Abatedor".
  // (as tags `critico` e `golpeAtordoou` já estão em `fichaR`: "Acertos Críticos possuem…", "Acertos que Atordoarem os Inimigos possuem…")
  const comCulling = v('culling') + v('culling_limiar');
  if (comCulling > 0 && alvo.hp > 0 && !alvo.dummy && alvo.maxHp > 0) {
    // (+ lote F: "Mata Inimigos que possuem X% ou menos de Vida quando Acertado por suas Habilidades" — o limiar maior vale.)
    const limiar = Math.max(/raro|unico/.test(alvo.raridade ?? alvo.raridadePoe ?? '') || alvo.boss || alvo.chefe ? 0.05 : 0.1, v('culling_limiar') / 100);
    if (alvo.hp <= alvo.maxHp * limiar) {
      alvo.hp = 0;
      eventos?.push({ t: 'estado', uid: alvo.uid, x: alvo.x, y: alvo.y, estado: 'misericordia' });
      evento(estado, hunt, 'golpeDeMisericordia', ficha, { alvo, eventos, personagem, agora });
    }
  }
  // Os EVENTOS dos únicos: no acerto, no crítico e ao atordoar (com o alvo e as tags do golpe).
  marcar(hunt, 'acertou', agora);
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
  // "Recupera X% de Vida ao Incendiar um Inimigo não Incendiado" (`afeccoes.aoAcertar` marca o alvo que não queimava).
  if (alvo?.estados?.incendiadoNovo) {
    delete alvo.estados.incendiadoNovo;
    evento(estado, hunt, 'incendiarNovo', ficha, { alvo, eventos, personagem });
  }
  // "Eletrizações infligidas por você se espalham para outros Inimigos dentro de N metros" (1 casa = 2 m): a mesma Eletrização nos de perto.
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
  const v = (k) => valor(ficha, k);
  marcar(hunt, 'acertado', agora);
  if (dano > 0) marcar(hunt, 'dano', agora);
  // (lote D) "Acertado por um Ataque Recentemente" (o golpe dos monstros que não é magia).
  if (corpoACorpo) marcar(hunt, 'acertadoAtaque', agora);
  // O ATORDOAMENTO que este golpe pôs (`combate/controle.tentar` grava `desde`): as reações "quando Atordoado".
  const at = hunt.controle?.atordoado;
  if (at && at.desde === agora && !at.reagiu) {
    at.reagiu = true;
    aoSerAtordoado(estado, hunt, bicho, ficha, { dano, duracaoMs: at.ms ?? 0, agora, eventos });
  }
  // (lote H) "Quando Acertado, perca uma Mortalha Fantasma para Recuperar Escudo de Energia igual a X% da sua Evasão".
  const daMortalha = v('mortalha_es_da_evasao');
  if (daMortalha > 0 && (hunt.mortalhas ?? 0) > 0) {
    hunt.mortalhas--;
    const esMax = Math.max(0, Math.round(ficha.energyShield ?? 0));
    estado.es = Math.min(esMax, (estado.es ?? 0) + Math.round(((ficha.evasion ?? 0) * daMortalha) / 100));
  }
  // "quando você sofrer Dano Físico de um Acerto Inimigo" (`ev:sofrerFisico:…`).
  if (tipo === 'physical' && dano > 0) evento(estado, hunt, 'sofrerFisico', ficha, { alvo: bicho, eventos, agora });
  // (Os frascos com "Ganhe N Cargas ao ser Acertado" — `frascos.tique`.)
  hunt.poeAcertosParaFrascos = (hunt.poeAcertosParaFrascos ?? 0) + 1;
  evento(estado, hunt, 'serAcertado', ficha, { alvo: bicho, eventos, agora });
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
    // (+ lote E: "Efeitos de Recuperação de Vida ocorrem durante 3 segundos ao invés" — `recuperacao_vida_s`.)
    const ms = (recurso === 'hp' && v('recuperacao_vida_s') > 0 ? v('recuperacao_vida_s') * 1000 : RECUPERACAO_MS) / Math.max(0.1, 1 + v(rapidez) / 100);
    if (pct > 0 && dano > 0) (hunt.recuperacoes ??= []).push({ recurso, porMs: (dano * pct) / 100 / ms, desde: agora, ate: agora + ms });
  }
  if (bicho && bicho.hp > 0 && rng() * 100 < v('congelar_agressor')) {
    const dur = Math.round(1000 * (v('congelar_agressor_s') || 1));
    if (congelar(bicho, dur, agora, !!hunt.isBoss)) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'congelado' });
  }
  return eventos;
}

/**
 * (ciclo 7, lote D) O personagem foi ATORDOADO por um golpe: o "recentemente" (e o "enquanto Conjurando"), o evento `serAtordoado`
 * ("Regenera X% de Vida durante 1 segundo quando Atordoado", "X% de chance de causar um Acerto Atordoador aos Monstros Próximos"), a
 * Adrenalina pela duração ("Ganha Adrenalina quando Atordoado, por 1 segundo por cada 100ms de Duração do Atordoamento") e a vida do golpe
 * ("X% do Dano sofrido de Acertos Atordoadores é Recuperado como Vida").
 */
export function aoSerAtordoado(estado, hunt, bicho, ficha, { dano = 0, duracaoMs = 0, agora = hunt?.clock ?? 0, eventos = [] } = {}) {
  if (!ligado() || !hunt || !ficha?.afPoe) return;
  marcar(hunt, 'atordoado', agora);
  if (condicoesDe(estado, ficha.afPoe).has('conjurando')) marcar(hunt, 'atordoadoConjurando', agora);
  for (const [k, x] of Object.entries(ficha.afPoe)) {
    const m = /^adrenalina_por_atordoamento:(\d+)$/.exec(k);
    if (m && x > 0 && duracaoMs > 0) ganharBuff(hunt, 'adrenalina', (x * duracaoMs) / Number(m[1]), agora);
  }
  const pct = valor(ficha, 'vida_do_acerto_atordoador');
  if (pct > 0 && dano > 0 && (estado.hp ?? 0) > 0 && !vidaSoPeloDreno(ficha.afPoe)) estado.hp = Math.min(estado.maxHp ?? 0, (estado.hp ?? 0) + Math.round((dano * pct) / 100));
  evento(estado, hunt, 'serAtordoado', ficha, { alvo: bicho, eventos, agora });
}

/**
 * (ciclo 7, lote F) O PODER do Clamor (PoE: cada inimigo perto vale 1, Mágico 2, Raro 10, Único 20): os de até 6 casas, com o "mínimo de N de
 * Poder", o "Poder total contado aumentado" e o "poder infinito" (conta como 1000).
 */
export function poderDoClamor(hunt, ficha) {
  const v = (k) => valor(ficha, k);
  if (v('clamor_poder_infinito') > 0) return 1000;
  const p = hunt?.pos;
  let poder = 0;
  for (const m of hunt?.monstros ?? []) {
    if (!p || !(m.hp > 0) || m.dummy || Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) > 6) continue;
    poder += m.boss || m.raridade === 'unico' || m.raridade === 'boss' ? 20 : m.raridade === 'raro' ? 10 : m.raridade === 'magico' ? 2 : 1;
  }
  return Math.max(v('clamor_poder_minimo'), poder * Math.max(0, 1 + v('clamor_poder_inc') / 100));
}

/**
 * (ciclo 7, lote E) "X% do Dano de Acertos é sofrido na Vida do seu Totem mais próximo antes da sua": a parte do `dano` que o totem vivo mais
 * perto leva (no máximo a vida dele). Devolve o que saiu de você.
 */
export function parteNoTotem(hunt, ficha, dano, eventos = null) {
  const pct = ligado() ? valor(ficha, 'dano_no_totem_pct') : 0;
  if (!(pct > 0) || !(dano > 0) || !hunt?.pos) return 0;
  const d = (l) => Math.max(Math.abs(l.x - hunt.pos.x), Math.abs(l.y - hunt.pos.y));
  const totem = (hunt.lacaios ?? []).filter((l) => l.tipo === 'totem' && l.hp > 0).sort((a, b) => d(a) - d(b))[0];
  if (!totem) return 0;
  const parte = Math.min(totem.hp, Math.round((dano * Math.min(100, pct)) / 100));
  if (!(parte > 0)) return 0;
  totem.hp -= parte;
  eventos?.push({ t: 'dmg', uid: totem.uid, x: totem.x, y: totem.y, v: parte, foe: false, alvo: totem.nome });
  return parte;
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
export function dotNoJogador(hunt, ef, agora, rng = Math.random) {
  const ficha = ligado() ? fichaDa(hunt) : null;
  const a = ficha?.afPoe ? AFECCAO_DO_DOT[ef.tipo] : null;
  if (!a) return Dot.aplicarNoJogador(hunt, ef, agora);
  const v = (k) => Number(ficha.afPoe[k]) || 0;
  if (v(`imune_${a.nome}`) > 0 || (hunt.imunidadesPoe?.[a.nome] ?? 0) > agora) return null;
  // (ciclo 7, lote H: a Inoculação do Caos — o Veneno é dano de Caos.)
  if (v('imune_caos') > 0 && (ef.tipo === 'veneno' || ef.tipo === 'venenoPoe')) return null;
  // "Afecções Danificadoras/Não Danificadoras Não Podem ser infligidas em você enquanto você já tiver uma" (a maestria de Afecções).
  if (a.danifica != null && v(a.danifica ? 'afeccao_dano_unica' : 'afeccao_controle_unica') > 0 && jaTemAfeccao(hunt, a.danifica, agora)) return null;
  // "Inimigos Sangrando não infligem Sangramento em você", "Inimigos Incendiados não podem te Incendiar": o monstro que bate tem a afecção.
  const quem = ef.origem?.uid != null ? (hunt.monstros ?? []).find((m) => m.uid === ef.origem.uid) : null;
  if (quem && ((ef.tipo === 'sangramento' && v('sem_sangramento_de_sangrando') > 0) || (ef.tipo === 'queimadura' && v('sem_incendio_de_incendiado') > 0)) && (quem.dots ?? []).some((d) => d.tipo === ef.tipo && d.falta > 0)) return null;
  const evitar = v(`evitar_${a.nome}`) + (a.elemental ? v('avoid_elem_ailments') : 0);
  if (evitar > 0 && rng() * 100 < evitar) return null;
  // (+ "X% mais Duração de Afecções em você" — multiplica.)
  const dur = Math.max(0.1, 1 + (v(`duracao_${a.nome}_propria`) + v('duracao_afeccoes_propria') + (a.elemental ? v('duracao_afeccoes_elementais_propria') : 0)) / 100) * Math.max(0, 1 + v('duracao_afeccoes_propria_mais') / 100);
  const efeito = Math.max(0, 1 + v(`efeito_${a.nome}_proprio`) / 100);
  const base = Dot.CONFIG.tipos[ef.tipo]?.duracaoMs ?? 4000;
  return Dot.aplicarNoJogador(hunt, { ...ef, total: ef.total * dur * efeito, duracaoMs: Math.round((ef.duracaoMs ?? base) * dur) }, agora);
}


// ---------------------------------------------------------------- os EVENTOS dos únicos

/** O disparo de uma habilidade ATIVADA por item ("Ativa X Nível N quando…"): quem registra é `acoes.mjs` (evita o ciclo de importação). */
// eslint-disable-next-line no-var
var disparoDeGatilho;
export function definirDisparo(fn) { disparoDeGatilho = fn; }
/** O ganho de cargas (`cargas.mjs`): registrado pela ficha (o máximo depende da soma). */
// eslint-disable-next-line no-var
var leitorDeCargas;
export function definirCargas(fn) { leitorDeCargas = fn; }
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
  intimidado: (e, ate) => (e.intimidado = { ate }), debilitado: (e, ate) => { e.debilitado = { ate }; e.lento = { ate, pct: Math.max(e.lento?.pct ?? 0, 20) }; },
  cinzas: (e, ate) => { e.cinzas = { ate }; e.lento = { ate, pct: Math.max(e.lento?.pct ?? 0, 20) }; }, causticado: (e, ate) => (e.causticado = { ate, pct: 10 }),
  fragilizado: (e, ate) => (e.fragilizado = { ate, pct: 6 }), exaurido: (e, ate) => (e.exaurido = { ate, pct: 10 }), lento: (e, ate) => (e.lento = { ate, pct: Math.max(e.lento?.pct ?? 0, 30) }),
  provocado: (e, ate) => (e.provocado = { ate }), resfriado: (e, ate) => (e.lento = { ate, pct: Math.max(e.lento?.pct ?? 0, 10) }),
  // (ciclo 7) O Debilitado tira 10% do dano no `doBicho` — antes também o punha Exaurido (mais 10%): 19% em vez dos 10% do PoE.
  // Coberto de Gelo (PoE): +20% de dano de Gelo recebido e 50% menos chance de crítico (`condicoes-poe`).
  cobertoGelo: (e, ate) => (e.cobertoGelo = { ate }),
  exposicaoFogo: (e, ate) => (e.exposicao = { ...(e.exposicao ?? {}), fire: ate }), exposicaoGelo: (e, ate) => (e.exposicao = { ...(e.exposicao ?? {}), ice: ate }),
  exposicaoRaio: (e, ate) => (e.exposicao = { ...(e.exposicao ?? {}), energy: ate }), amaldicoado: (e, ate) => (e.amaldicoado = { ate }),
  definhado: (e, ate) => (e.definhado = { ate, n: Math.min(15, (e.definhado?.ate > 0 ? e.definhado.n : 0) + 1) }),
  // (lote D) Esmagado: 15% menos Redução de Dano Físico (`hunt/resistencia`).
  esmagado: (e, ate) => (e.esmagado = { ate: Math.max(e.esmagado?.ate ?? 0, ate) }),
};
const SEGUNDOS_PADRAO = 4;

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

export function evento(estado, hunt, nome, ficha, ctx = {}) {
  if (!ligado() || !hunt) return;
  const agora = ctx.agora ?? hunt.clock ?? 0;
  // (ciclo 7, lote D) Todo evento marca o "recentemente" dele (`evRecente:<evento>` — "se você Suprimiu Dano Mágico Recentemente"); matar
  // um Congelado é ESTILHAÇAR ("se você Estilhaçou um Inimigo Recentemente").
  marcar(hunt, `ev:${nome}`, agora);
  // (lote F) e a lista dos últimos de cada um ("por cada Veneno que você tenha infligido Recentemente": a escala `usos:ev.envenenar`)
  const ultimos = ((hunt.poeUsosRecentes ??= {})[`ev.${nome}`] ??= []);
  ultimos.push(agora);
  while (ultimos.length && (ultimos[0] < agora - 20000 || ultimos.length > 60)) ultimos.shift();
  if (nome === 'matar' && ctx.alvo?.estados?.congelado?.ate > agora) marcar(hunt, 'estilhacou', agora);
  const lista = ficha?.eventosPoe;
  if (!lista?.length) return;
  const rng = ctx.rng ?? Math.random;
  const alvo = ctx.alvo ?? null;
  const tagsAlvo = new Set([...tagsDoAlvo(alvo, agora), ...(ctx.tags ?? [])]);
  let conds = null;
  for (const ev of lista) {
    if (ev.evento !== nome) continue;
    if (ev.conds.length) {
      conds ??= condicoesDe(estado, ficha.afPoe);
      if (!ev.conds.every((c) => (ehCondDeEstado(c) ? vale(conds, c) : tagsAlvo.has(c)))) continue;
    }
    aplicarAcao(estado, hunt, ev, ficha, { ...ctx, alvo, agora, rng });
  }
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
      } else if (ev.param === 'sangramento') {
        Dot.removerDoJogador(hunt, 'sangramento');
      } else if (ev.param === 'danificadoras') {
        // (lote G) as Afecções Danificadoras: Incêndio, Sangramento e Veneno
        for (const t of ['queimadura', 'sangramento', 'veneno', 'venenoPoe']) Dot.removerDoJogador(hunt, t);
      } else if (ev.param === 'lento') {
        if (hunt.controle) delete hunt.controle.lento;
      } else if (ev.param === 'todas') {
        // (lote F) "Remove maldições e afecções de você a cada 4 segundos": os danos contínuos, o controle elemental e as maldições dos monstros.
        if (hunt.efeitosDoJogador?.dots) hunt.efeitosDoJogador.dots = [];
        if (hunt.controle) { delete hunt.controle.congelado; delete hunt.controle.lento; }
        hunt.maldicoesNoJogador = {};
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
    // (lote D) `regenPct:<hp|mana|es>:<segundos>` = X% do máximo recuperado durante N segundos ("Regenera 10% de Vida durante 1 segundo
    // quando Atordoado"); `fortificacao` = ganha N Fortificações; `atordoarProximos` = a CHANCE de um Acerto Atordoador nos de perto (3 casas).
    case 'regenPct': {
      const [recurso, seg] = String(ev.param).split(':');
      const max = recurso === 'es' ? esMax : recurso === 'mana' ? estado.maxMana ?? 0 : estado.maxHp ?? 0;
      const ms = Math.max(100, (Number(seg) || 1) * 1000);
      if (max > 0 && v > 0) (hunt.recuperacoes ??= []).push({ recurso: recurso === 'es' || recurso === 'mana' ? recurso : 'hp', porMs: (max * v) / 100 / ms, desde: agora, ate: agora + ms });
      return;
    }
    case 'fortificacao': ganharFortificacao(hunt, v, ficha?.afPoe, agora); return;
    // (lote G) `soloSagrado:<segundos>` = a CHANCE de criar Solo Sagrado onde você está; `valor` = ganha N de Valor (com um Estandarte ligado).
    case 'soloSagrado': if (sorte(v)) criarSoloSagrado(hunt, Number(ev.param) || 4, agora); return;
    case 'valor': ganharValor(hunt, v, ficha?.afPoe, agora, { semIntervalo: true }); return;
    // (lote H) `mortalha:<máximo>` = ganha N Mortalhas Fantasmas (a keystone Mortalhas Fantasmas — `aoSerAcertado` gasta uma).
    case 'mortalha': hunt.mortalhas = Math.min(Number(ev.param) || 3, (hunt.mortalhas ?? 0) + v); return;
    // (lote F) `vidaChance:<N>` = a CHANCE de ganhar N de Vida ("15% de chance de ganhar 200 de Vida ao Acertar com Ataques"); no morto, X% da
    // Vida por Definhamento / por Veneno nele ("Recupera 1% de Vida por Debuff de Definhamento em cada Inimigo que você Matar").
    case 'vidaChance': if (sorte(v)) curar('hp', estado.maxHp ?? 0, Number(ev.param) || 0); return;
    case 'vidaPorDefinhamento': { const d = alvo?.estados?.definhado; const n = d && d.ate > agora ? d.n ?? 1 : 0; if (n) curar('hp', estado.maxHp ?? 0, ((estado.maxHp ?? 0) * v * n) / 100); return; }
    case 'vidaPorVeneno': { const n = (alvo?.dots ?? []).filter((d) => (d.tipo === 'veneno' || d.tipo === 'venenoPoe') && d.falta > 0).length; if (n) curar('hp', estado.maxHp ?? 0, ((estado.maxHp ?? 0) * v * n) / 100); return; }
    // `furiaPorPoder:<cada>:<máximo>` = N: N de Fúria por cada `<cada>` de Poder do Clamor, até `<máximo>` (`poderDoClamor`).
    case 'furiaPorPoder': { const [cada, max] = String(ev.param).split(':').map(Number); const p = poderDoClamor(hunt, ficha); if (cada > 0) ganharFuria(hunt, Math.min(max || Infinity, Math.floor(p / cada) * v), agora); return; }
    // (lote F) `congelarProximos:<segundos>` = a CHANCE de Congelar os de perto (3 casas) que não estão Congelados.
    case 'congelarProximos': {
      if (!hunt.pos) return;
      const ms = Math.round((Number(ev.param) || 1) * 1000);
      for (const m of hunt.monstros ?? []) {
        if (m.hp <= 0 || m.dummy || m.estados?.congelado?.ate > agora || Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) > 3 || !sorte(v)) continue;
        if (congelar(m, ms, agora, !!hunt.isBoss)) eventos?.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: 'congelado' });
      }
      return;
    }
    // `regenDaDefesa:<hp|es>:<evasao|armaduraEvasao>:<segundos>` = X% da defesa recuperado durante N segundos ("A cada 4 segundos, Regenere
    // Escudo de Energia igual a 1% da Evasão durante 1 segundo").
    case 'regenDaDefesa': {
      const [recurso, deQue, seg] = String(ev.param).split(':');
      const base = deQue === 'armaduraEvasao' ? (ficha?.armor ?? 0) + (ficha?.evasion ?? 0) : deQue === 'armadura' ? ficha?.armor ?? 0 : ficha?.evasion ?? 0;
      const ms = Math.max(100, (Number(seg) || 1) * 1000);
      if (base > 0 && v > 0) (hunt.recuperacoes ??= []).push({ recurso: recurso === 'es' ? 'es' : 'hp', porMs: (base * v) / 100 / ms, desde: agora, ate: agora + ms });
      return;
    }
    // (lote F) `stat:<atributo>:<segundos>` = o valor somado ao atributo por N segundos ("Ganha Velocidade de Ataque aumentada em 20% por 4
    // segundos quando Matar um Inimigo Raro ou Único"; "A cada 10 s, ganhe X% do Dano Físico como Dano Extra de Fogo por 4 s"). O maior vale.
    case 'stat': {
      const [stat, seg] = String(ev.param).split(':');
      if (!stat || !(Number(seg) > 0)) return;
      const b = (hunt.poeBonusPorTempo ??= {});
      const atual = b[stat]?.ate > agora ? b[stat] : null;
      b[stat] = { valor: Math.max(atual?.valor ?? 0, v), ate: Math.max(atual?.ate ?? 0, agora + Number(seg) * 1000) };
      return;
    }
    // (lote E) `consumirCadaver:<hp|mana|es>` = X% do máximo: consome o cadáver mais perto (a até 6 casas — `hunt.cadaveres`, os últimos
    // mortos) — "A cada 3 segundos, Consome um Cadáver próximo para Recuperar 10% de Vida". Marca o "Consumiu um cadáver Recentemente".
    case 'consumirCadaver': {
      const p = hunt.pos;
      const lista = hunt.cadaveres ?? [];
      const d = (c) => Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y));
      const i = p ? lista.reduce((melhor, c, j) => (d(c) <= 6 && (melhor < 0 || d(c) < d(lista[melhor])) ? j : melhor), -1) : -1;
      if (i < 0) return;
      lista.splice(i, 1);
      marcar(hunt, 'consumiuCadaver', agora);
      ((hunt.poeUsosRecentes ??= {}).cadaver ??= []).push(agora);
      evento(estado, hunt, 'consumirCadaver', ficha, { agora, eventos });
      const recurso = ev.param === 'es' ? 'es' : ev.param === 'mana' ? 'mana' : 'hp';
      const max = recurso === 'es' ? esMax : recurso === 'mana' ? estado.maxMana ?? 0 : estado.maxHp ?? 0;
      curar(recurso, max, (max * v) / 100);
      return;
    }
    // `vidaDaRegen:<por>` = N: recupera N de Vida por cada `<por>` de Vida Regenerada por segundo ("A cada 4 segundos, Recupere 1 de vida por
    // cada 0.1 Vida Recuperada por segundo da Regeneração").
    case 'vidaDaRegen': { const r = ficha?.regenPoe?.vidaPorSegundo ?? 0; const por = Number(ev.param) || 1; if (r > 0) curar('hp', estado.maxHp ?? 0, (r / por) * v); return; }
    case 'atordoarProximos': {
      if (!hunt.pos || !sorte(v)) return;
      const dur = Math.round(NO_ACERTO.atordoamento.duracaoMs * (1 + valor(ficha, 'stun_duration') / 100));
      for (const m of hunt.monstros ?? []) {
        if (m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) > 3) continue;
        if (Estados.atordoar(m, dur, agora, !!hunt.isBoss)) eventos?.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: 'atordoado' });
      }
      return;
    }
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
      // O morto explode: X% da vida máxima dele em quem está em volta (1 casa).
      if (!alvo || !hunt.pos) return;
      const dano = Math.max(1, Math.round(((alvo.maxHp ?? 0) * v) / 100));
      for (const m of hunt.monstros ?? []) {
        if (m === alvo || m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - alvo.x), Math.abs(m.y - alvo.y)) > 1) continue;
        m.hp -= dano;
        eventos?.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v: dano, foe: true, alvo: m.name, color: '#ff9000' });
      }
      eventos?.push({ t: 'explosao', id: 6, x: alvo.x, y: alvo.y, lado: 3 });
      return;
    }
    case 'espalhar': {
      // "Quando você Matar um Inimigo Incendiado/Eletrizado, uma afecção equivalente é infligida em um Inimigo próximo".
      if (!alvo) return;
      const perto = (hunt.monstros ?? []).filter((m) => m !== alvo && m.hp > 0 && !m.dummy).sort((a, b) => Math.max(Math.abs(a.x - alvo.x), Math.abs(a.y - alvo.y)) - Math.max(Math.abs(b.x - alvo.x), Math.abs(b.y - alvo.y)))[0];
      if (!perto) return;
      if (ev.param === 'incendio') for (const d of (alvo.dots ?? []).filter((x) => x.tipo === 'queimadura' && x.falta > 0)) Dot.aplicar(perto, { tipo: 'queimadura', total: d.falta, origem: { fonte: 'poe' } }, agora);
      if (ev.param === 'eletrizacao' && alvo.estados?.chocado?.ate > agora) (perto.estados ??= {}).chocado = { ...alvo.estados.chocado };
      // (lote F) "Ao matar um inimigo envenenado … os inimigos em um raio de N metro também ficam envenenados" (os venenos do morto, em quem está a 1 casa).
      if (ev.param === 'veneno') {
        const venenos = (alvo.dots ?? []).filter((x) => (x.tipo === 'veneno' || x.tipo === 'venenoPoe') && x.falta > 0);
        for (const m2 of hunt.monstros ?? []) {
          if (m2 === alvo || m2.hp <= 0 || m2.dummy || Math.max(Math.abs(m2.x - alvo.x), Math.abs(m2.y - alvo.y)) > 1) continue;
          for (const d of venenos) Dot.aplicar(m2, { tipo: d.tipo, total: d.falta, origem: { fonte: 'poe' } }, agora);
        }
      }
      // "Congelamentos/Eletrizações infligidos por você se espalham para outros Inimigos dentro de N metros" (N = o valor; 1 casa = 2 m).
      if (ev.param === 'congelamentoRaio' || ev.param === 'eletrizacaoRaio') {
        const casas = Math.max(1, Math.floor(v / 2));
        const chave = ev.param === 'congelamentoRaio' ? 'congelado' : 'chocado';
        if (!(alvo.estados?.[chave]?.ate > agora)) return;
        for (const m of hunt.monstros ?? []) if (m !== alvo && m.hp > 0 && !m.dummy && Math.max(Math.abs(m.x - alvo.x), Math.abs(m.y - alvo.y)) <= casas) (m.estados ??= {})[chave] = { ...alvo.estados[chave] };
      }
      return;
    }
    // `gatilho:<gema>[:chance]` = o NÍVEL da habilidade ativada.
    // (ciclo 7) "Sua Marca se transfere para outro Inimigo quando o Inimigo Marcado morrer" (o evento `matar`, no morto).
    case 'transferirMarca': { const novo = transferirMarca(hunt, alvo, agora); if (novo) eventos?.push({ t: 'estado', uid: novo.uid, x: novo.x, y: novo.y, estado: 'marcado' }); return; }
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
  // (ciclo 7, lote G) A POSTURA mudou (o buff da gema Sangue e Areia ligou ou acabou): o "mudou de Postura Recentemente" e o evento.
  const postura = posturaDe(hunt, agora);
  if (hunt.poePostura && hunt.poePostura !== postura) {
    marcar(hunt, 'mudouPostura', agora);
    evento(estado, hunt, 'mudarPostura', ficha, { agora });
  }
  hunt.poePostura = postura;
  // (lote G) "Solo Sagrado criado por você aplica Dano sofrido aumentado em X% aos Inimigos" (quem está sobre ele) e "Inimigos próximos ao seu
  // Estandarte sofrem Dano aumentado em X%" (`aura_dano_sofrido` — o Estandarte é uma aura em você).
  const doSolo = valor(ficha, 'solo_sagrado_fragiliza');
  const daAura = valor(ficha, 'aura_dano_sofrido');
  if (doSolo > 0 || daAura > 0) {
    for (const m of hunt.monstros ?? []) {
      if (!(m.hp > 0) || m.dummy) continue;
      if (doSolo > 0 && (hunt.solosSagrados ?? []).some((s) => s.ate > agora && Math.max(Math.abs(s.x - m.x), Math.abs(s.y - m.y)) <= s.raio)) (m.estados ??= {}).soloFragil = { ate: agora + 1000, pct: doSolo };
      if (daAura > 0 && hunt.pos && Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) <= 3) (m.estados ??= {}).auraFragil = { ate: agora + 1000, pct: daAura };
    }
  }
  // "Efeitos do Solo Sagrado criado por você Perduram por N segundos": quem está sobre ele leva o efeito por mais N s.
  const perdura = valor(ficha, 'solo_sagrado_perdura_s');
  if (perdura > 0 && hunt.pos && (hunt.solosSagrados ?? []).some((s) => s.ate > agora && Math.max(Math.abs(s.x - hunt.pos.x), Math.abs(s.y - hunt.pos.y)) <= s.raio)) hunt.poeSoloAte = agora + perdura * 1000;
  // (ciclo 7, lote D) Os PERIÓDICOS: "A cada N segundos, Regenera X% de Vida durante um segundo" — `periodico:<N>:<ação>[:<parâmetro>]` = o
  // valor da ação, rodada a cada N segundos (a primeira, N segundos depois de entrar).
  for (const [k, x] of Object.entries(ficha.afPoe)) {
    if (!k.startsWith('periodico:') || !(x > 0)) continue;
    const [, cada, acao, ...param] = k.split(':');
    const p = (hunt.poePeriodicos ??= {});
    p[k] ??= agora;
    if (agora - p[k] < Number(cada) * 1000) continue;
    p[k] = agora;
    aplicarAcao(estado, hunt, { evento: 'tempo', acao, param: param.join(':'), conds: [], valor: x }, ficha, { alvo: null, agora, rng: Math.random, eventos: null });
  }
  // (lote E) "Inimigos Próximos têm Regeneração de Vida reduzida em X%" (a até 3 casas; `skills/estados` lê `regenMenosAura`).
  const regenMenos = valor(ficha, 'aura_regen_menos');
  const danoMenos = valor(ficha, 'aura_dano_menos');
  if ((regenMenos > 0 || danoMenos > 0) && hunt.pos) {
    for (const m of hunt.monstros ?? []) {
      if (!(m.hp > 0) || m.dummy || Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) > 3) continue;
      if (regenMenos > 0) (m.estados ??= {}).regenMenosAura = { ate: agora + 1000, pct: Math.min(100, regenMenos) };
      if (danoMenos > 0) (m.estados ??= {}).auraFraco = { ate: agora + 1000, pct: Math.min(100, danoMenos) };
    }
  }
  // (lote F) "Inimigos Próximos possuem −X% de Resistência a Gelo/Caos" (`aura_res_menos:<tipo>`), "Inimigos próximos Sofrem X% de Dano
  // Elemental aumentado" (`aura_elem_fragil`) e "Velocidade de Ação dos Monstros Inimigos Próximos é no máximo de X% do valor base"
  // (`aura_acao_maxima` — a lentidão que falta até X%).
  const resMenos = Object.entries(ficha.afPoe).filter(([k, x]) => k.startsWith('aura_res_menos:') && x).map(([k, x]) => [k.slice('aura_res_menos:'.length), Math.abs(x)]);
  const elemFragil = valor(ficha, 'aura_elem_fragil');
  const acaoMax = valor(ficha, 'aura_acao_maxima');
  if ((resMenos.length || elemFragil > 0 || acaoMax > 0) && hunt.pos) {
    for (const m of hunt.monstros ?? []) {
      if (!(m.hp > 0) || m.dummy || Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) > 3) continue;
      const e = (m.estados ??= {});
      if (resMenos.length) e.auraRes = { ate: agora + 1000, pct: Object.fromEntries(resMenos) };
      if (elemFragil > 0) e.auraElemFragil = { ate: agora + 1000, pct: elemFragil };
      if (acaoMax > 0 && acaoMax < 100) e.lento = { ate: Math.max(e.lento?.ate ?? 0, agora + 1000), pct: Math.max(e.lento?.ate > agora ? e.lento.pct : 0, 100 - acaoMax) };
    }
  }
  // (lote F) O tempo que cada Raro/Único passou na sua Presença (`mais_dano_presenca` — `fichaDoGolpe`): soma o tempo do tique.
  if (Object.keys(ficha.afPoe).some((k) => k.startsWith('mais_dano_presenca:')) && hunt.pos) {
    const ms = Math.max(0, agora - (hunt.poeUltimoTiqueDaPresenca ?? agora));
    for (const m of hunt.monstros ?? []) {
      if (!(m.hp > 0) || m.dummy || !(m.raridade === 'raro' || m.raridade === 'unico' || m.boss) || Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) > RAIO_DA_PRESENCA) continue;
      (m.estados ??= {}).presencaMs = (m.estados.presencaMs ?? 0) + ms;
    }
  }
  hunt.poeUltimoTiqueDaPresenca = agora;
  // (lote H) "X% menos Dano sofrido dos outros Inimigos próximos do Inimigo Marcado" (a até 2 casas da sua Marca — `condicoes-poe.doBicho`).
  if (valor(ficha, 'menos_dano_perto_do_marcado') > 0) {
    const marcados = (hunt.monstros ?? []).filter((m) => m.hp > 0 && marcaNoBicho(m, agora));
    for (const m of hunt.monstros ?? []) if (m.hp > 0 && !marcaNoBicho(m, agora) && marcados.some((x) => Math.max(Math.abs(x.x - m.x), Math.abs(x.y - m.y)) <= 2)) (m.estados ??= {}).pertoDoMarcado = { ate: agora + 1000 };
  }
  // "Cada Totem aplica Dano aumentado em X% sofrido pelos Inimigos próximos a ele" (a até 3 casas de cada totem; soma por totem).
  const porTotem = valor(ficha, 'totem_fragiliza');
  if (porTotem > 0) {
    const totens = (hunt.lacaios ?? []).filter((l) => l.tipo === 'totem' && l.hp > 0);
    for (const m of hunt.monstros ?? []) {
      if (!(m.hp > 0) || m.dummy) continue;
      const n = totens.filter((t) => Math.max(Math.abs(m.x - t.x), Math.abs(m.y - t.y)) <= 3).length;
      if (n) (m.estados ??= {}).totemFragil = { ate: agora + 1000, pct: n * porTotem };
    }
  }
  const auras = Object.entries(ficha.afPoe).filter(([k, x]) => k.startsWith('aura_proximos:') && x > 0).map(([k]) => k.slice('aura_proximos:'.length));
  if (!auras.length) return;
  for (const m of hunt.monstros ?? []) {
    if (m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) > 3) continue;
    const e = (m.estados ??= {});
    for (const a of auras) ESTADOS_NO_ALVO[a]?.(e, agora + 1000);
  }
}
