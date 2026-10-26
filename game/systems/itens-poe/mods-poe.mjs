// Os efeitos do PoE que mexem nos ESTADOS dos bichos e no dano contínuo (o atordoamento, Mutilar, Cegar, Empalar…; o que o personagem
// recebe). O resto (condições, soma, ficha do golpe, leitura dos mods) mora em `condicoes-poe.mjs` — sem dependências pesadas, para os
// módulos de base (afixos, gemas, tradução, resistência) poderem usar sem ciclo de importação. Este módulo reexporta tudo de lá.
import * as QuemFeriu from '../hunt/quem-feriu.mjs';
import { ligado } from './catalogo.mjs';
import * as Estados from '../skills/estados.mjs';
import * as Dot from '../combate/dot.mjs';
import { RETALIACAO, abrirRetaliacao, valorAtual, valorMaximo, estandartePlantado, marcaNoBicho, RAIO_DA_PRESENCA, criarSoloSagrado, ganharValor, posturaDe, valor, marcar, ganharFuria, ativo, fichaDa, imunidadeApos, comTeto, fatorDaEscala, NO_ACERTO, RECUPERACAO_MS, AO_BLOQUEAR, condicoesDe, vale, ehCondDeEstado, ganharBuff, tagsDoAlvo, somaPorTags as somaPorTagsDe, vidaSoPeloDreno, transferirMarca, ganharFortificacao, RAMPAGE, empurrar, marcarCriticoDaHabilidade, ALTARES_DO_SORTEIO, perderCasca, porChamaSantificada, notarParaReliquia, fatorDosDebuffs, reservadoAgora, renovarFrioEChoque, fatorNaoDano, AFECCOES_NAO_DANO, DISTANCIA_DO_PROJETIL, almaParaOsLacaios, criarSoloProfano, SOLO_PROFANO, maldicoesNoAlvo, porExposicao } from './condicoes-poe.mjs';
import * as Plantadas from './armas-plantadas.mjs';
// (lotes G-A e G-C, dono 25/10: as Marcas no acerto — as Cargas, as Cargas de Frasco — e a Punição em quem acerta você)
import * as GemasGAC from './gemas-gac.mjs';
import { porLento } from './gemas-gbd.mjs';
export * from './condicoes-poe.mjs';



/**
 * O que um ACERTO do personagem faz além do dano (sistema do PoE): o atordoamento, Mutilar, Cegar, Desacelerar, Empurrar, Provocar,
 * Empalar (e solta os empalamentos do alvo), a Fúria e o Escudo de Energia por acerto. `ficha`: a do golpe (`fichaDoGolpe`, com as tags).
 * `dano`: o total do acerto; `fisico`: a parte Física. Devolve `{ atordoou, extra }` — `extra`: o dano dos empalamentos soltos (já tirado).
 */
export function aoAcertar(estado, hunt, alvo, ficha, { dano = 0, fisico = 0, fogo = 0, crit = false, eventos = null, agora = hunt?.clock ?? 0, rng = Math.random, mover = null, elementos = [], personagem = null, habilidade = 'golpe', deTotem = false } = {}) {
  const saida = { atordoou: false, extra: 0 };
  if (!ligado() || !alvo || alvo.dummy || !ficha?.afPoe) return saida;
  // (18/10, lote G20a) `deTotem`: o acerto do TOTEM usando a sua habilidade (`acoes.usarComoTotem`). O que ele faz no INIMIGO vale (o atordoamento, o
  // Mutilar, o Cegar, o Empurrar, o Empalar, a Exposição, o Golpe de Misericórdia — a skill do totem é a sua, com os seus modificadores); o que daria
  // algo a VOCÊ não (o dreno do excedente, a Fortificação, a Convergência, o Valor, a Fúria, o escudo no acerto, os "Acertou/Criticou/Empalou
  // Recentemente" e os eventos "ao Acertar" — o PoB só marca HitRecently quando a habilidade não é de totem: CalcPerform.lua:264).
  const seu = !deTotem;
  // (lote C2, dono 20/10 — D2.7) a Corrente com Gancho de Trarthus: o acerto seu num inimigo acorrentado (`hunt.poeCorrentes`) dá a Fúria da corrente
  const daCorrente = seu && hunt ? (hunt.poeCorrentes ?? []).find((c) => c.uid === alvo.uid)?.furia ?? 0 : 0;
  if (daCorrente > 0) ganharFuria(hunt, daCorrente, agora);
  // (lote G-A, dono 25/10) as MARCAS no acerto seu: "Inimigos Amaldiçoados têm X% de chance de concederem uma Carga de Y quando Acertados" (o Senhor da Guerra, o
  // Assassino, o Caçador — a qualidade) e a Alquimista: "Ganha 1 Cargas de Frasco quando você Acertar um Inimigo Amaldiçoado, não mais que uma vez a cada 3 segundos"
  if (seu && hunt && alvo.maldicoes) {
    const doMarcado = GemasGAC.noAcertoDoAmaldicoado(hunt, alvo, agora, rng);
    for (const t of doMarcado.cargas) leitorDeCargas?.(estado, 'ganhar', t);
    if (doMarcado.frascos > 0) cargasDeFrasco?.(estado, doMarcado.frascos);
  }
  // (ciclo 7, lote D) O que o golpe FEZ entra nas tags dele: o Crítico (`X@critico`) e, depois do sorteio do atordoamento, o Atordoou
  // (`X@golpeAtordoou`) — "Acertos Críticos possuem Golpe de Misericórdia", "Acertos Corpo a Corpo que Atordoam têm X% de chance de Fortificar".
  let fichaR = crit ? { ...ficha, tagsDoGolpe: [...(ficha.tagsDoGolpe ?? []), 'critico'] } : ficha;
  const v = (k) => valor(fichaR, k);
  const tags = new Set(ficha.tagsDoGolpe ?? []);
  // (lote 73) o Empalamento DESTE acerto (a Cutilada Perigosa o reforça se o acerto também Sangrar — `aoPorAfeccoes`)
  if (alvo.estados?.empalamentoDoAcerto) delete alvo.estados.empalamentoDoAcerto;
  // (lote 72, o Rítmo de Combate) "caso você tenha Acertado com sua Arma da Mão Principal/Secundária Recentemente": o acerto de ATAQUE com arma
  // — a mão da ficha do golpe (`Ficha.fichaDaMao`: `mao`; a que acerta com as duas, as duas); sem duas armas, a principal.
  if (tags.has('ataque') && estado?.equipment?.weapon) {
    if (ficha.mao !== 'secundaria') marcar(hunt, 'acertouMaoPrincipal', agora);
    if (ficha.mao === 'secundaria' || ficha.mao === 'ambas') marcar(hunt, 'acertouMaoSecundaria', agora);
  }
  // (14/10, o Guardian: a Chama Santificada no acerto corpo a corpo — o Marechal da Divindade; o Raro ou Único acertado é ocasião da Relíquia
  // Elemental — a Cruzada Implacável)
  if (seu && tags.has('corpo')) porChamaSantificada(hunt, alvo, ficha.afPoe, agora);
  if (['raro', 'unico'].includes(alvo.raridade ?? alvo.raridadePoe) || alvo.boss) notarParaReliquia(estado, hunt, agora);
  // (12/10, as Tinturas: os acertos de ATAQUE desde o último tique — "quando você Acertar um Inimigo com uma Arma Corpo a Corpo";
  // `frascos.tique` → `tinturas.tique`, que confere a arma)
  if (seu && hunt && tags.has('ataque')) hunt.tinturaAcertos = (hunt.tinturaAcertos ?? 0) + 1;
  const salaDeBoss = !!hunt?.isBoss;
  const ev = (estado2) => eventos?.push({ t: 'estado', uid: alvo.uid, x: alvo.x, y: alvo.y, estado: estado2 });
  const sorte = (pct) => pct > 0 && rng() * 100 < pct;
  // "X% do Dano Excedente é Drenado como Vida" (o Apetite Insaciável do Carrasco): o acerto que MATOU — a vida que faltava ao monstro era
  // menos que o dano — drena o que sobrou ("Dano Excedente é qualquer Dano de um Acerto que exceda a Vida restante do Inimigo").
  const excedente = alvo.hp <= 0 && alvo.hp + dano > 0 ? Math.min(dano, -alvo.hp) : 0;
  // (lote 81) o excesso do golpe fatal fica no morto (a queima do Arauto das Cinzas — `combate.matarMonstro`)
  if (excedente > 0) alvo.poeExcedente = excedente;
  if (seu && excedente > 0 && v('roubo_excedente') > 0) drenoDaFicha?.(estado, { vida: (excedente * v('roubo_excedente')) / 100 }, ficha, eventos, personagem?.nome ?? null, hunt?.pos ?? null);
  if (crit && seu) {
    marcar(hunt, 'critico', agora);
    // (a Sobrecarga Elemental: o crítico DESTA habilidade — `habilidade`, o id da ação; o golpe básico é `golpe`)
    marcarCriticoDaHabilidade(hunt, habilidade, agora);
    // (Os frascos com "chance de ganhar uma Carga de Frasco ao causar um Golpe Crítico" — `frascos.tique`.)
    if (hunt) hunt.poeCriticosParaFrascos = (hunt.poeCriticosParaFrascos ?? 0) + 1;
  }
  const e = (alvo.estados ??= {});
  // (13/10, o Mestre do Metal: "Você e Aliados próximos causam de 6 a 12 de Dano Físico adicional para cada Empalar no Inimigo" — lote 31,
  // P043: entra no GOLPE como dano Físico adicional, antes dos aumentos e do crítico — `condicoes-poe.fisicoPorEmpalamento`, no golpe básico
  // e na gema; não mais aqui, depois do acerto.)
  // Os EMPALAMENTOS do alvo: cada acerto solta o guardado — passando pela Redução de Dano Físico do alvo (a resistência física e a redução
  // de dano do monstro — `reducaoFisica`, registrada pela caçada), salvo "Dano de Empalamento … ignoram a Redução de Dano Físico Inimiga".
  // ("X% de chance de, ao Acertar um Inimigo, todos os Empalamentos no Inimigo durarem por um Acerto adicional": este acerto não gasta.)
  if (Array.isArray(e.empalado) && e.empalado.length && alvo.hp > 0) {
    let total = 0;
    // (cada empalamento × os acertos que ele tinha, contando este — o "multiplicam … pela quantidade de Acertos que restavam", abaixo)
    let multiplicado = 0;
    const segura = sorte(v('empalar_acerto_extra_chance'));
    for (const x of e.empalado) if (x.ate > agora && x.acertos > 0) { total += x.valor; multiplicado += x.valor * x.acertos; if (!segura) x.acertos--; }
    e.empalado = e.empalado.filter((x) => x.ate > agora && x.acertos > 0);
    // ("X% de chance de, ao Acertar, remover todos os Empalamentos do Inimigo"; 12/10, a mesma opção da maestria: "Empalamentos removidos desta
    // forma multiplicam seu Dano Refletido para este Acerto pela quantidade de Acertos que restavam".)
    // (a redução física não sorteia: tirar antes dela não muda a ordem dos sorteios)
    if (sorte(v('empalar_remover_chance'))) {
      e.empalado = [];
      if (v('empalar_removidos_multiplicam') > 0) total = multiplicado;
    }
    if (total > 0 && reducaoFisica && !(v('empalar_ignora_reducao') > 0)) total = reducaoFisica(hunt, alvo, total);
    if (total > 0) {
      const d = Math.max(1, Math.round(total));
      alvo.hp -= d;
      saida.extra += d;
      eventos?.push({ t: 'dmg', uid: alvo.uid, x: alvo.x, y: alvo.y, v: d, foe: true, alvo: alvo.name, color: '#b0b0b0', empalamento: true });
    }
  }
  // (lote A5, dono 20/10 — D4) o GOLPE FINAL do Golpe Duplo do Empalamento ("Golpes Finais fazem com que os Empalamentos em Inimigos Reflitam o Dano aos
  // Inimigos ao redor" — o PoB não faz a conta, act_dex.lua:5602): os Empalamentos ativos do morto — cada um × os acertos que ainda tinha — vão aos
  // inimigos a até 1 casa dele (o raio do Dano Propagado, a decisão do dono do lote 34), pela Redução de Dano Físico de cada um; é de quem golpeou
  // (revisão do A5: também quando quem mata é o Golpe de Misericórdia, abaixo — `refletirEmpalamentos` de novo, depois do culling)
  const refletirEmpalamentos = () => {
    if (alvo.hp <= 0 && v('empalar_reflete_ao_matar') > 0 && Array.isArray(e.empalado) && e.empalado.length) {
      const guardado = e.empalado.filter((x) => x.ate > agora && x.acertos > 0).reduce((t, x) => t + x.valor * x.acertos, 0);
      e.empalado = [];
      if (guardado > 0) {
        for (const m of hunt?.monstros ?? []) {
          if (m === alvo || m.hp <= 0 || m.dummy || (m.z ?? 0) !== (alvo.z ?? 0) || Math.max(Math.abs(m.x - alvo.x), Math.abs(m.y - alvo.y)) > RAIO_DO_EMPALAR_REFLETIDO) continue;
          const bruto = reducaoFisica && !(v('empalar_ignora_reducao') > 0) ? reducaoFisica(hunt, m, guardado) : guardado;
          if (!(bruto > 0)) continue;
          const d = Math.max(1, Math.round(bruto));
          m.hp -= d;
          QuemFeriu.carimbar(m, seu ? QuemFeriu.VOCE : QuemFeriu.TOTEM);
          eventos?.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v: d, foe: true, alvo: m.name, color: '#b0b0b0', empalamento: true, refletido: true });
        }
      }
    }
  };
  refletirEmpalamentos();
  // (lote D) A FORTIFICAÇÃO ("Acertos Corpo a Corpo Fortificam", "X% de chance de Fortificar"): pelo tamanho do acerto — vale também no
  // acerto que matou (`condicoes-poe.ganharFortificacao`).
  const fortificar = (chance) => {
    if (!hunt || !seu || !sorte(chance)) return;
    const pct = alvo.maxHp > 0 ? (100 * Math.max(0, dano)) / alvo.maxHp : 1;
    // (lote A5, dono 20/10: a duração pela ficha do golpe — a da soma + a do uso, e a base da Golpe Vigilante)
    ganharFortificacao(hunt, Math.max(1, Math.floor(pct)) * Math.max(0, 1 + v('fortificacao_ganho_inc') / 100), ficha.afPoe, agora, { incPct: v('fortificacao_duracao_inc'), baseS: v('fortificacao_base_s') });
  };
  fortificar(v('chance_fortificar'));
  // (11/10, o Elementalista) "Ganha Convergência ao Acertar um Inimigo Único, não mais do que uma vez a cada N segundos" (4 s — o lembrete).
  const convCada = v('convergencia_cada_s');
  if (seu && convCada > 0 && hunt && (alvo.raridade === 'unico' || alvo.boss) && agora - (hunt.poeConvergenciaEm ?? -Infinity) >= convCada * 1000) {
    hunt.poeConvergenciaEm = agora;
    ganharBuff(hunt, 'convergencia', 4, agora);
  }
  // (lote G) O VALOR (com um Estandarte ligado): o acerto corpo a corpo que mata, ou num Raro ou Único — `ganharValor` (uma vez a cada 0,5 s).
  if (seu && tags.has('corpo') && (alvo.hp <= 0 || /raro|unico/.test(alvo.raridade ?? '') || alvo.boss)) ganharValor(hunt, 1, ficha.afPoe, agora);
  if (alvo.hp <= 0) return saida;
  // ATORDOAMENTO (o do PoE: pelo tamanho do acerto em relação à vida do alvo).
  // (+ "Acertos Atordoam como se causassem X% mais Dano de Fogo Corpo a Corpo": a parte de FOGO do acerto corpo a corpo — `fogo`, depois da
  // resistência, como o `dano` — conta X% a mais. Lote 31, P034: antes, o golpe inteiro com Fogo.)
  const limiar = Math.max(1, (alvo.maxHp ?? alvo.hp) * Math.max(0.05, 1 - v('enemy_stun_threshold_red') / 100));
  const comoFogo = tags.has('corpo') && fogo > 0 ? (Math.min(fogo, dano) * v('atordoar_como_fogo_mais')) / 100 : 0;
  const chanceAtordoar = (NO_ACERTO.atordoamento.fator * (dano + comoFogo)) / limiar;
  if (chanceAtordoar >= NO_ACERTO.atordoamento.minimoPct && rng() * 100 < Math.min(100, chanceAtordoar)) {
    // (+ "X% mais Duração de Atordoamentos com Armas de Duas Mãos": multiplica.)
    let dur = NO_ACERTO.atordoamento.duracaoMs * (1 + v('stun_duration') / 100) * Math.max(0, 1 + v('stun_duration_mais') / 100);
    if (rng() * 100 < v('chance_dobrar_atordoamento')) dur *= 2;
    if (Estados.atordoar(alvo, Math.round(dur), agora, salaDeBoss)) {
      saida.atordoou = true;
      // (17/10, lote G6) "Inimigos Amaldiçoados concedem N de Fúria quando Atordoados" (a Marca do Senhor da Guerra — `contra.atordoar` da maldição)
      if (seu) for (const m of Object.values(alvo.maldicoes ?? {})) if (m?.contra?.atordoar?.furia > 0 && m.ate > agora) ganharFuria(hunt, m.contra.atordoar.furia, agora);
      ev('atordoado');
      fichaR = { ...fichaR, tagsDoGolpe: [...(fichaR.tagsDoGolpe ?? []), 'golpeAtordoou'] };
      // ("Acertos Corpo a Corpo que Atordoam têm X% de chance de Fortificar": só a parte que depende de ter atordoado.)
      fortificar(v('chance_fortificar') - valor({ ...fichaR, tagsDoGolpe: fichaR.tagsDoGolpe.filter((t) => t !== 'golpeAtordoou') }, 'chance_fortificar'));
    }
  }
  const lentidao = (pct, ms) => {
    porLento(e, agora + ms, pct, agora);
  };
  if (sorte(v('chance_mutilar'))) {
    e.mutilado = { ate: agora + NO_ACERTO.mutilar.duracaoMs };
    // (lote B1, dono 20/10: × o "X% de aumento do Efeito de Mutilação" — a Chuva de Flechas Vaal, 150%: 30% × 2,5 = 75%)
    lentidao(NO_ACERTO.mutilar.lentidaoPct * Math.max(0, 1 + v('efeito_mutilacao') / 100), NO_ACERTO.mutilar.duracaoMs);
    ev('mutilado');
  }
  if (sorte(v('chance_cegar'))) {
    // (+ lote D: "Duração da Cegueira aumentada")
    e.cego = { ate: agora + Math.round(NO_ACERTO.cegar.duracaoMs * Math.max(0.1, 1 + v('duracao_cegueira') / 100)), criticoMenosPct: v('cegados_critico_red'), ...(v('cegos_esconjuro') > 0 ? { esconjuro: true } : {}), ...(v('efeito_cegueira') ? { efeito: Math.max(0, 1 + v('efeito_cegueira') / 100) } : {}) };
    ev('cego');
  }
  if (tags.has('magia') && sorte(v('chance_desacelerar'))) {
    e.desacelerado = { ate: agora + NO_ACERTO.desacelerar.duracaoMs, regenMenosPct: v('desacelerados_regen_red') };
    // (lote C4, dono 21/10: o "Desacelerar" das magias é o Tolhimento do PoE — "Hinder reduces movement speed by 30% for 4 seconds": o estado próprio `tolhido`, só
    // de movimento, sem teto, vale o mais forte — `Estados.tolher`; antes, o `lento`)
    // (revisão do C4, 21/10: + a Regeneração de Vida reduzida no próprio Tolhimento — `Estados.tolher`; o `desacelerado` acima segue, e o maior dos dois vale)
    if (Estados.tolher(alvo, NO_ACERTO.desacelerar.lentidaoPct, NO_ACERTO.desacelerar.duracaoMs, agora, v('desacelerados_regen_red'))) ev('tolhido');
  }
  if (sorte(v('chance_provocar'))) {
    // (+ "Duração da Provocação aumentada em X%".)
    e.provocado = { ate: agora + Math.round(NO_ACERTO.provocar.duracaoMs * Math.max(0.1, 1 + v('duracao_provocacao') / 100)), por: estado?.nome ?? null };
    ev('provocado');
  }
  // (lote D) ESMAGAR (o PoE: o Esmagado tem 15% menos Redução de Dano Físico — `hunt/resistencia`): "Esmaga Inimigos ao acertar com Maças e
  // Cetros" (4 s) e "Esmaga Inimigos por N segundos quando você Acertá-los enquanto estiverem em Vida Cheia" (`esmagar_s`).
  if (v('esmagar_s') > 0 || sorte(v('chance_esmagar'))) {
    e.esmagado = { ate: Math.max(e.esmagado?.ate ?? 0, agora + 1000 * (v('esmagar_s') || 4)) };
    ev('esmagado');
  }
  // (As MINAS — "Cada Mina aplica Dano sofrido aumentado / Dano causado reduzido em X% aos Inimigos próximos a ela, até Y%": lote 34, a aura da
  // Mina PLANTADA, no tique — `auraDasMinas`; não mais a soma no alvo de cada acerto de Mina.)
  // (11/10) AGRAVAR o Sangramento do alvo: "X% de chance de Agravar o Sangramento em alvos que você Acertar com Ataques / Golpear com um Crítico /
  // Atordoar / Acertar com Ataques Impelidos" (`chance_agravar` com a tag) e "Acertos de Ataques Agravam qualquer Sangramento mais antigos que N
  // segundos" (`agravar_sangramento_apos_s@ataque`) — `combate/dot.agravar`.
  if (alvo.dots?.length) {
    if (sorte(v('chance_agravar'))) Dot.agravar(alvo, agora);
    const apos = v('agravar_sangramento_apos_s');
    if (apos > 0) Dot.agravar(alvo, agora, apos * 1000);
  }
  // (As Forças Profanadas — "Redefine a duração de esfriamentos e eletrificações em inimigos amaldiçoados por você": lote 32, P038, AO
  // AMALDIÇOAR, com a duração cheia de cada um — `aoAmaldicoar`; não mais a cada acerto, com 2 s.)
  // "Seus Acertos Intimidam permanentemente Inimigos com Vida Cheia" (a tag `alvoVidaCheia` do golpe).
  if (v('intimidar_permanente') > 0) e.intimidado = { ate: agora + 3600 * 1000 };
  if (sorte(v('chance_empurrar')) && typeof mover === 'function' && mover(alvo)) {
    ev('empurrado');
    // ("X% de chance de ganhar uma Carga de Poder se Empurrar um Inimigo com Dano Corpo a Corpo": o evento `empurrar`, com as tags do golpe.)
    if (seu) evento(estado, hunt, 'empurrar', ficha, { alvo, eventos, personagem, agora, tags: [...tags] });
    // (11/10) "Distância do Empurrão aumentada em X%": cada 100% é uma casa a mais; o resto, a chance de mais uma.
    const aMais = Math.max(0, v('distancia_empurrao'));
    const casas = Math.floor(aMais / 100) + (rng() * 100 < aMais % 100 ? 1 : 0);
    for (let i = 0; i < casas && mover(alvo); i++);
  }
  // (09/10) INTIMIDAR (o alvo sofre 10% mais dano de Ataques) e INERVAR (10% mais dano de Magias) — "X% de chance de Intimidar Inimigos por N
  // segundos no Acerto" (N: `intimidar_s`/`inervar_s`; sem ele, 4 s, o padrão do PoE).
  if (sorte(v('chance_intimidar'))) { e.intimidado = { ate: agora + 1000 * (v('intimidar_s') || 4) }; ev('intimidado'); }
  if (sorte(v('chance_inervar'))) { e.inervado = { ate: agora + 1000 * (v('inervar_s') || 4) }; ev('inervado'); }
  // A EXPOSIÇÃO no acerto ("Inflige Exposição a Fogo ao Acertar, aplicando −X% de Resistência a Fogo"): −X na resistência do alvo por 4 s
  // (`condicoes-poe.exposicao`, lida em `hunt/resistencia`). Como no PoE, só a mais forte de cada elemento vale.
  // (lote 67, as Ramificadoras: "Habilidades de Fogo têm chance de 25% de aplicar Exposição a Fogo ao Acertar" — `exposicao_chance_<el>`, a
  // Exposição padrão do PoE: −10%)
  for (const [el, k, extra, comChance] of [['fire', 'exposicao_acerto_fogo', 'exposicao_extra_fogo', 'exposicao_chance_fogo'], ['ice', 'exposicao_acerto_gelo', 'exposicao_extra_gelo', 'exposicao_chance_gelo'], ['energy', 'exposicao_acerto_raio', 'exposicao_extra_raio', 'exposicao_chance_raio']]) {
    // (+ "Exposição a Fogo infligida por você aplica X% extra de Resistência a Fogo" — a maestria da árvore.)
    const base = Math.abs(v(k)) || (sorte(v(comChance)) ? 10 : 0);
    const pct = base + (base ? Math.abs(v(extra)) : 0);
    if (!pct) continue;
    // (lote A5, dono 20/10 — D10: pela função única, `porExposicao`)
    porExposicao(alvo, el, pct, 4000, agora);
    if (seu) marcar(hunt, 'infligiuExposicao', agora);
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
      const efeitoInc = v('efeito_empalamento') + (naoEmpalado ? v('efeito_empalamento_nao_empalado') : 0);
      const valor2 = (fisico * NO_ACERTO.empalar.pctDoFisico * (1 + efeitoInc / 100)) / 100;
      const acertos = NO_ACERTO.empalar.acertos + Math.max(0, Math.floor(v('empalar_acertos_extra')));
      const ate = agora + Math.round(NO_ACERTO.empalar.duracaoMs * Math.max(0.1, 1 + v('duracao_empalamento') / 100));
      const novos = [];
      for (let k = 0; k <= Math.max(0, Math.floor(v('empalamentos_extras'))); k++) novos.push({ valor: valor2, acertos, ate });
      lista.push(...novos);
      if (m === alvo) em.empalamentoDoAcerto = { novos, efeitoInc };
      if (lista.length > NO_ACERTO.empalar.maximo) lista.splice(0, lista.length - NO_ACERTO.empalar.maximo);
      if (v('empalar_bloqueio_s') > 0) em.empalarBloqueadoAte = agora + v('empalar_bloqueio_s') * 1000;
      if (seu) marcar(hunt, 'empalou', agora);
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
    // (lote 33, P009: × o "Efeito de Afecções Não-Danificadoras")
    const f = fatorNaoDano(ficha.afPoe);
    e.causticado = { ate, pct: AO_BLOQUEAR.causticar * f };
    e.fragilizado = { ate, pct: AO_BLOQUEAR.enfraquecer * f };
    e.exaurido = { ate, pct: AO_BLOQUEAR.exaurir * f };
  }
  // A Fúria ("Ganhe N de Fúria com Acertos Corpo a Corpo").
  // ("X% de chance de que se você fosse ganhar Fúria ao Acertar, você ganha até o seu máximo de fúria ao invés".)
  const furia = v('furia_por_acerto');
  if (seu && furia > 0) ganharFuria(hunt, sorte(v('furia_max_ao_acertar_chance')) ? 9999 : furia, agora);
  // Escudo de Energia por acerto ("Ganha N de Escudo de Energia por Inimigo Acertado com Ataques").
  const es = tags.has('ataque') ? v('es_on_hit') : 0;
  if (seu && es > 0 && estado) estado.es = Math.min(Math.max(0, Math.round(ficha.energyShield ?? 0)), (estado.es ?? 0) + es);
  // GOLPE DE MISERICÓRDIA (Culling Strike): o alvo com 10% da vida ou menos (5% se Raro ou Único) morre. Com condição: "Acertos Críticos
  // possuem Golpe de Misericórdia", "contra Inimigos Amaldiçoados/Incendiados/Congelados", "Ataques com Arcos têm Golpe Abatedor".
  // (as tags `critico` e `golpeAtordoou` já estão em `fichaR`: "Acertos Críticos possuem…", "Acertos que Atordoarem os Inimigos possuem…")
  // (lote A5, dono 20/10: + o Abater o Fraco — "Mata inimigos de raridade normal e mágica com X% de vida ou menos" — `culling_normal_magico`: só no Normal
  // e no Mágico; o elite conta como Raro, `mecanicas`)
  const raroOuUnico = /raro|unico/.test(alvo.raridade ?? alvo.raridadePoe ?? '') || alvo.boss || alvo.chefe;
  const doFraco = raroOuUnico || /elite/.test(alvo.raridade ?? '') ? 0 : v('culling_normal_magico');
  const comCulling = v('culling') + v('culling_limiar') + doFraco;
  if (comCulling > 0 && alvo.hp > 0 && !alvo.dummy && alvo.maxHp > 0) {
    // (+ lote F: "Mata Inimigos que possuem X% ou menos de Vida quando Acertado por suas Habilidades" — o limiar maior vale.)
    const limiar = Math.max(v('culling') + v('culling_limiar') > 0 ? (raroOuUnico ? 0.05 : 0.1) : 0, v('culling_limiar') / 100, doFraco / 100);
    if (alvo.hp <= alvo.maxHp * limiar) {
      alvo.hp = 0;
      eventos?.push({ t: 'estado', uid: alvo.uid, x: alvo.x, y: alvo.y, estado: 'misericordia' });
      refletirEmpalamentos();
      if (seu) evento(estado, hunt, 'golpeDeMisericordia', ficha, { alvo, eventos, personagem, agora });
    }
  }
  if (!seu) return saida;
  // Os EVENTOS dos únicos: no acerto, no crítico e ao atordoar (com o alvo e as tags do golpe).
  marcar(hunt, 'acertou', agora);
  // ("se você Acertou um Inimigo Único Recentemente")
  if (/unico/.test(alvo?.raridade ?? alvo?.raridadePoe ?? '') || alvo?.boss || alvo?.chefe) marcar(hunt, 'acertouUnico', agora);
  if (saida.atordoou) marcar(hunt, 'atordoou', agora);
  const ctx = { alvo, eventos, personagem, agora, tags: [...tags, ...(crit ? [] : ['naoCritico'])] };
  evento(estado, hunt, 'acertar', ficha, ctx);
  if (crit) evento(estado, hunt, 'critico', ficha, ctx);
  // (lote 68) o crítico de uma habilidade de Arauto: "caso você tenha causado um Golpe Crítico com uma Habilidade Arauto Recentemente"
  // (`nosUltimos:4:critico:arauto`)
  if (crit && tags.has('arauto')) marcar(hunt, 'critico:arauto', agora);
  if (saida.atordoou) evento(estado, hunt, 'atordoar', ficha, ctx);
  return saida;
}

/** As afecções que um acerto PÔS no alvo (`queimando`, `congelado`, `eletrizado`, `envenenado`…) → os eventos e os "recentemente". */
// (lote 67: + o Resfriamento — o estado `lento` que o acerto pôs —: "caso você tenha Resfriado um Inimigo Recentemente")
const EVENTO_DA_AFECCAO = { queimando: ['incendiar', 'incendiou'], congelado: ['congelar', 'congelou'], eletrizado: ['eletrizar', 'eletrizou'], envenenado: ['envenenar', null], lento: ['resfriar', 'resfriou'] };
/**
 * (lote 73, a Cutilada Perigosa) "Efeito dos Empalamentos infligidos por Acertos que também infligem Sangramento aumentado em X%": o acerto que
 * Empalou (`empalamentoDoAcerto`, de `aoAcertar`) e Sangrou — por qualquer fonte: as afecções do PoE ou a gema de suporte (`Estados.aplicar`);
 * quem chama confere as duas, depois de todas as afecções do acerto. O X soma aos outros "Efeito do Empalamento aumentado" daquele
 * empalamento. Sempre tira a marca do acerto.
 */
export function empalamentoComSangramento(alvo, ficha, sangrou) {
  const doAcerto = alvo?.estados?.empalamentoDoAcerto;
  if (!doAcerto) return;
  delete alvo.estados.empalamentoDoAcerto;
  const comSangue = valor(ficha, 'efeito_empalamento_com_sangramento');
  if (!sangrou || !(comSangue > 0)) return;
  const fator = (1 + (doAcerto.efeitoInc + comSangue) / 100) / Math.max(0.01, 1 + doAcerto.efeitoInc / 100);
  for (const x of doAcerto.novos) x.valor *= fator;
}
export function aoPorAfeccoes(estado, hunt, alvo, ficha, postos = [], { eventos = null, personagem = null, deTotem = false } = {}) {
  if (!ligado() || !postos?.length) return;
  // (lote 81, o Segredo da Tormenta: "Arauto Trovejante também cria uma tempestade quando você Eletrizar um Inimigo" — `acoes.tiqueDaTempestade` abre;
  // a Eletrização do totem não é sua)
  if (hunt && !deTotem && postos.includes('eletrizado') && valor(ficha, 'arauto_tempestade_ao_eletrizar') > 0) hunt.poeEletrizouParaTempestade = hunt.clock ?? 0;
  // (lote G20a: a afecção que o TOTEM pôs — o espalhar e a lentidão da Eletrização valem no inimigo; os "Incendiou/Congelou Recentemente", os eventos, o
  // reflexo e a vida ao incendiar são seus)
  for (const p of deTotem ? [] : new Set(postos)) {
    const [ev, rec] = EVENTO_DA_AFECCAO[p] ?? [];
    if (!ev) continue;
    if (rec) marcar(hunt, rec);
    evento(estado, hunt, ev, ficha, { alvo, eventos, personagem });
  }
  // ("Incêndios que você causar são refletidos para você", "Afecções Elementais infligidas por você são Refletidas à você": o Incêndio volta
  // com o mesmo dano e o tempo que falta; o Congelamento, pelo tempo dele — aproximado: a Eletrização e o Resfriamento não voltam.)
  const agoraR = hunt?.clock ?? 0;
  const refleteTudo = valor(ficha, 'afeccoes_elementais_refletidas') > 0;
  if (!deTotem && alvo && (refleteTudo || valor(ficha, 'incendio_refletido') > 0) && new Set(postos).has('queimando')) {
    const d = (alvo.dots ?? []).filter((x) => x.tipo === 'queimadura' && x.falta > 0).sort((x, y) => y.ate - x.ate)[0];
    if (d) dotNoJogador(hunt, { tipo: 'queimadura', total: d.falta, duracaoMs: Math.max(500, d.ate - agoraR), origem: { fonte: 'reflexo' } }, agoraR);
  }
  if (!deTotem && alvo && refleteTudo && new Set(postos).has('congelado') && alvo.estados?.congelado?.ate > agoraR) {
    const c = (hunt.controle ??= {});
    if (!((c.imuneAte ?? 0) > agoraR) && !(Number(ficha?.afPoe?.imune_congelamento) > 0)) c.congelado = { ate: Math.max(c.congelado?.ate ?? 0, alvo.estados.congelado.ate) };
  }
  // "Recupera X% de Vida ao Incendiar um Inimigo não Incendiado" (`afeccoes.aoAcertar` marca o alvo que não queimava).
  if (alvo?.estados?.incendiadoNovo) {
    delete alvo.estados.incendiadoNovo;
    if (!deTotem) evento(estado, hunt, 'incendiarNovo', ficha, { alvo, eventos, personagem });
  }
  // "Eletrizações infligidas por você se espalham para outros Inimigos dentro de N metros" (1 casa = 2 m): a mesma Eletrização nos de perto.
  // ("Velocidade de Movimento dos Inimigos Eletrizados por você reduzida em X%": a Eletrização posta também deixa Lento.)
  const lentoDaEletrizacao = valor(ficha, 'eletrizados_lentos');
  if (lentoDaEletrizacao > 0 && postos.includes('eletrizado') && alvo?.estados?.chocado) {
    const e = alvo.estados;
    porLento(e, e.chocado.ate, lentoDaEletrizacao, hunt?.clock ?? 0);
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

/**
 * (lote 32, P046 — o Berserker: "Ganha 3% da vida não reservada faltante antes de ser atingido por um inimigo para cada Desafio") O acerto do
 * inimigo vai entrar (passou da esquiva e do bloqueio): ANTES do dano, ganha X% × o Desafio da Vida NÃO RESERVADA que falta. Quem chama é o
 * golpe do monstro e a magia dele (`hunt/combate`, `poderes`). Devolve a vida ganha.
 */
export function antesDeSerAcertado(estado, hunt, ficha, agora = hunt?.clock ?? 0) {
  if (!ligado() || !hunt || !ficha?.afPoe) return 0;
  const pct = valor(ficha, 'desafio_cura_faltante_pct');
  const d = hunt.desafio;
  if (!(pct > 0) || !(d?.ate > agora) || !(d.n > 0) || !((estado.hp ?? 0) > 0) || vidaSoPeloDreno(ficha.afPoe)) return 0;
  const naoReservada = Math.max(0, (estado.maxHp ?? 0) - reservadoAgora(estado, 'vida', ficha.afPoe));
  const faltava = Math.max(0, naoReservada - estado.hp);
  const ganho = Math.min(faltava, Math.round((faltava * pct * d.n) / 100));
  if (ganho > 0) estado.hp += ganho;
  return ganho;
}
/**
 * (lote 32, P038) Uma maldição sua PEGOU no inimigo agora (`Reforcos.marcar` → `amaldicoou`, `Reforcos.amaldicoar`): as Forças Profanadas
 * ("Redefine a duração de esfriamentos e eletrificações em inimigos amaldiçoados por você") renovam o Resfriamento e a Eletrização dele.
 */
export function aoAmaldicoar(ficha, bicho, agora) {
  if (!ligado() || !bicho || !(valor(ficha, 'renova_frio_choque_amaldicoado') > 0)) return;
  renovarFrioEChoque(bicho, agora);
}

/** O "X% do Dano de <elemento> sofrido é Recuperado como Vida" de cada elemento de golpe. */
const RECOUP_DO_ELEMENTO = { physical: 'recoup_life_phys', fire: 'recoup_life_fire', ice: 'recoup_life_ice', energy: 'recoup_life_energy', chaos: 'recoup_life_chaos' };
export function aoSerAcertado(estado, hunt, bicho, ficha, { dano = 0, corpoACorpo = false, ataque = false, magia = false, tipo = null, agora = hunt?.clock ?? 0, rng = Math.random, eventos = [] } = {}) {
  if (!ligado() || !hunt || !ficha?.afPoe) return eventos;
  const v = (k) => valor(ficha, k);
  marcar(hunt, 'acertado', agora);
  // (lote G-C, dono 25/10) a Punição: "Inimigos Amaldiçoados são Debilitados por N Segundos quando Acertarem" (o Debilitado do jogo — `ESTADOS_NO_ALVO.debilitado`)
  const debilitarMs = bicho ? GemasGAC.debilitarAoAcertar(bicho, agora) : 0;
  if (debilitarMs > 0) {
    const e = (bicho.estados ??= {});
    if (!((e.debilitado?.ate ?? 0) >= agora + debilitarMs)) ESTADOS_NO_ALVO.debilitado(e, agora + debilitarMs, agora);
  }
  if (dano > 0) marcar(hunt, 'dano', agora);
  // (lote D) "Acertado por um Ataque Recentemente" (o golpe dos monstros que não é magia — 14/10: o projétil de ataque também, `ataque`).
  if (corpoACorpo || ataque) marcar(hunt, 'acertadoAtaque', agora);
  // (14/10, o Warden: a Pele de Árvore perde 1 Casca no Ataque inimigo que acerta; a Lição das Estações, N no Dano Mágico)
  if (corpoACorpo || ataque) perderCasca(hunt, 1, agora);
  if (magia) perderCasca(hunt, v('casca_perde_magia'), agora);
  // O ATORDOAMENTO que este golpe pôs (`combate/controle.tentar` grava `desde`): as reações "quando Atordoado".
  const at = hunt.controle?.atordoado;
  if (at && at.desde === agora && !at.reagiu) {
    at.reagiu = true;
    aoSerAtordoado(estado, hunt, bicho, ficha, { dano, duracaoMs: at.ms ?? 0, agora, eventos });
  }
  // (11/10, o Berserker) O DESAFIO: "Ganha Desafio por 10 segundos ao perder Vida para um Acerto Inimigo, não mais do que uma vez a cada 0.3
  // segundos"; "Perde todo o Desafio quando chegar a 10 de Desafio". (A cura por Desafio é ANTES do acerto — `antesDeSerAcertado`, lote 32.)
  const ganhaDesafio = v('desafio_ao_perder_vida');
  if (ganhaDesafio > 0 && dano > 0) {
    const d = (hunt.desafio ??= { n: 0, ate: 0, ultimo: -Infinity });
    if (!(d.ate > agora)) d.n = 0;
    if (agora - d.ultimo >= 300) {
      d.ultimo = agora;
      d.n += 1;
      d.ate = agora + 10000;
      const perdeEm = v('desafio_perde_em');
      if (perdeEm > 0 && d.n >= perdeEm) d.n = 0;
    }
  }
  // (11/10, o Deadeye) "Perde toda a sua Força dos Ventos ao Acertar" (no PoE: quando Acertado).
  if (v('forca_ventos_perde_ao_ser_acertado') > 0) delete hunt.forcaDosVentos;
  // (11/10) A RETALIAÇÃO: o Acerto Selvagem ("Um Acerto que remove ao menos 15% da Vida Máxima") abre a janela das que dependem dele; "Habilidades
  // de Retaliação Nocivas se tornam Utilizáveis a cada sexto Acerto dos Inimigos" (o Arsenal da Vingança) abre a das que causam dano (as do
  // bloqueio — o Clamor Vingativo, do Acerto Selvagem, não causa dano) a cada N acertos.
  if (dano > 0 && (estado.maxHp ?? 0) > 0 && dano >= (estado.maxHp * RETALIACAO.selvagemPct) / 100) {
    abrirRetaliacao(hunt, 'selvagem', ficha.afPoe, agora);
    // (lote 73) "caso você tenha sofrido um Acerto Selvagem Recentemente"
    marcar(hunt, 'sofreuSelvagem', agora);
  }
  const aCada = v('retaliacao_a_cada_acertos');
  if (aCada > 0) {
    hunt.poeAcertosSofridos = (hunt.poeAcertosSofridos ?? 0) + 1;
    if (hunt.poeAcertosSofridos % Math.max(1, Math.round(aCada)) === 0) abrirRetaliacao(hunt, 'bloquear', ficha.afPoe, agora);
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
 * perto leva (no máximo a vida dele). Devolve o que saiu de você. (No golpe recebido, quem faz esta conta é o `Arvore.danoRecebido` — a mesma
 * regra, que veio com os únicos; esta fica para medir a linha da árvore sem montar um golpe.)
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
/** A chance A MAIS de o monstro pôr a afecção do `tipo` (o do motor) em você ("+X% de chance de ser Eletrizado / Envenenado"). */
export function chanceExtraDeSer(ficha, tipo) {
  const a = AFECCAO_DO_DOT[tipo];
  return a ? valor(ficha, `chance_ser_${a.nome}`) : 0;
}
export function dotNoJogador(hunt, ef, agora, rng = Math.random) {
  const ficha = ligado() ? fichaDa(hunt) : null;
  const a = ficha?.afPoe ? AFECCAO_DO_DOT[ef.tipo] : null;
  // (12/10) O Sangue Corrompido dos monstros não é afecção: só "Não pode ser afetado por Sangue Corrompido" o impede.
  if (ef.tipo === 'sangueCorrompido' && Number(ficha?.afPoe?.imune_sangue_corrompido) > 0) return null;
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
  // ("Inimigos Amaldiçoados não podem infligir Afecções Elementais em Você": o monstro amaldiçoado por você.)
  if (a.elemental && quem && v('amaldicoados_sem_afeccao_elemental') > 0 && Object.values(quem.maldicoes ?? {}).some((m) => m && m.ate > agora)) return null;
  // (+ "Dano Degenerativo de Caos sofrido reduzido em X%": o veneno em você.)
  const caos = a.nome === 'veneno' ? Math.max(0, 1 - v('dot_caos_sofrido_red') / 100) : 1;
  // (+ "X% mais Duração de Afecções em você" — multiplica.)
  // (lote 30: + "Debuffs em você expiram X% mais rápido" — `fatorDosDebuffs`)
  const dur = Math.max(0.1, 1 + (v(`duracao_${a.nome}_propria`) + v('duracao_afeccoes_propria') + (a.elemental ? v('duracao_afeccoes_elementais_propria') : 0)) / 100) * Math.max(0, 1 + v('duracao_afeccoes_propria_mais') / 100) * fatorDosDebuffs(ficha?.afPoe);
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


/**
 * (lote 53) A REGRA DE OURO: "Sangramentos que você infligir são Refletidos para você"; "Envenenamento inflingido por você é Refletido à você
 * caso tenha menos de 100 Envenenamentos em você" — o mesmo dano contínuo (o total e a duração do que você pôs) também em você, pelo
 * `dotNoJogador` (os seus Evitar, Imunidades e Durações valem, como em qualquer afecção em você). Null sem a linha: o `aoPor` de
 * `afeccoes.aoAcertar` não roda.
 */
export function refletorDeAfeccoes(hunt, ficha) {
  const sangramento = valor(ficha, 'reflete_sangramento') > 0;
  const venenosAte = valor(ficha, 'reflete_veneno_ate');
  if (!hunt || (!sangramento && !(venenosAte > 0))) return null;
  return (tipo, total, duracaoMs, agora = hunt.clock ?? 0) => {
    const veneno = tipo === 'veneno' || tipo === 'venenoPoe';
    if (!(tipo === 'sangramento' && sangramento) && !(veneno && venenosAte > 0)) return;
    if (veneno && (hunt.efeitosDoJogador?.dots ?? []).filter((d) => (d.tipo === 'veneno' || d.tipo === 'venenoPoe') && d.falta > 0).length >= venenosAte) return;
    dotNoJogador(hunt, { tipo, total, duracaoMs, origem: { fonte: 'refletido' } }, agora);
  };
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
/** (lote G-A) As Cargas de Frasco ganhas por fora do abate (a Marca do Alquimista): quem registra é `acoes.mjs` (`FrascosPoe.ganharCargas`). */
// eslint-disable-next-line no-var
var cargasDeFrasco;
export function definirCargasDeFrasco(fn) { cargasDeFrasco = fn; }

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
/** (lote A5, dono 20/10 — D4) O raio do Empalamento refletido no golpe final (o Golpe Duplo do Empalamento): 1 casa, como o Dano Propagado. */
export const RAIO_DO_EMPALAR_REFLETIDO = 1;
// A Redução de Dano Físico do monstro no empalamento solto (`hunt/resistencia.resistido`, sem a armadura): quem registra é a caçada — este
// módulo não importa a resistência (o ciclo de imports).
// eslint-disable-next-line no-var
var reducaoFisica;
export function definirReducaoFisica(fn) { reducaoFisica = fn; }
/** (lote 72) Quantos Definhar o bicho tem agora (o `definhado` acumula até 15). */
const definhadosNoAlvo = (alvo, agora) => (ativo(alvo?.estados?.definhado, agora) ? alvo.estados.definhado.n ?? 1 : 0);
const ESTADOS_NO_ALVO = {
  // (revisão G, 26/10: a lentidão de cada estado pelo `porLento` — vale a mais forte enquanto dura, sem uma fonte apagar, encurtar ou herdar o `pct` da outra; `agora`, o
  // relógio de quem põe)
  cego: (e, ate) => (e.cego = { ate }), mutilado: (e, ate, agora) => { e.mutilado = { ate }; porLento(e, ate, 30, agora); },
  intimidado: (e, ate) => (e.intimidado = { ate }), debilitado: (e, ate, agora) => { e.debilitado = { ate }; porLento(e, ate, 20, agora); },
  cinzas: (e, ate, agora) => { e.cinzas = { ate }; porLento(e, ate, 20, agora); }, causticado: (e, ate) => (e.causticado = { ate, pct: 10 }),
  fragilizado: (e, ate) => (e.fragilizado = { ate, pct: 6 }), exaurido: (e, ate) => (e.exaurido = { ate, pct: 10 }), lento: (e, ate, agora) => porLento(e, ate, 30, agora),
  provocado: (e, ate) => (e.provocado = { ate }), resfriado: (e, ate, agora) => porLento(e, ate, 10, agora),
  // (lote 57) Inervado (PoE: "Unnerve" — 10% mais dano de Magias recebido: `condicoes-poe`), "Inimigos próximos são enervados" (o Limitado pelo Destino)
  inervado: (e, ate) => (e.inervado = { ate: Math.max(e.inervado?.ate ?? 0, ate) }),
  // (14/10) Eletrizado sem acerto (o Pacto Cadavérico): 15% mais dano recebido — não troca uma Eletrização mais forte
  eletrizado: (e, ate) => (e.chocado = { ate: Math.max(e.chocado?.ate ?? 0, ate), pct: Math.max(e.chocado?.ate > ate - 1000 ? e.chocado.pct ?? 0 : 0, 15) }),
  // (ciclo 7) O Debilitado tira 10% do dano no `doBicho` — antes também o punha Exaurido (mais 10%): 19% em vez dos 10% do PoE.
  // Coberto de Gelo (PoE): +20% de dano de Gelo recebido e 50% menos chance de crítico (`condicoes-poe`).
  cobertoGelo: (e, ate) => (e.cobertoGelo = { ate }),
  exposicaoFogo: (e, ate) => (e.exposicao = { ...(e.exposicao ?? {}), fire: ate }), exposicaoGelo: (e, ate) => (e.exposicao = { ...(e.exposicao ?? {}), ice: ate }),
  exposicaoRaio: (e, ate) => (e.exposicao = { ...(e.exposicao ?? {}), energy: ate }), amaldicoado: (e, ate) => (e.amaldicoado = { ate }),
  definhado: (e, ate) => (e.definhado = { ate, n: Math.min(15, (e.definhado?.ate > 0 ? e.definhado.n : 0) + 1) }),
  // (lote D) Esmagado: 15% menos Redução de Dano Físico (`hunt/resistencia`).
  esmagado: (e, ate) => (e.esmagado = { ate: Math.max(e.esmagado?.ate ?? 0, ate) }),
  // (a aura "Inimigos Próximos não podem causar Acertos Críticos" — `condicoes-poe.criticoDoBicho`)
  semCritico: (e, ate) => (e.semCritico = { ate }),
  // Excomungado (PoE): o inimigo não causa dano de Caos (`condicoes-poe.semCaos`).
  excomungado: (e, ate) => (e.excomungado = { ate }),
};
const SEGUNDOS_PADRAO = 4;
/** Põe um estado do PoE (`cego`, `cinzas`, `definhado`…) no alvo até `ate` — o mesmo das auras e dos eventos (o dos lacaios usa). */
export const porNoAlvo = (alvo, nome, ate, agora) => ESTADOS_NO_ALVO[nome]?.((alvo.estados ??= {}), ate, agora);
/**
 * (11/10) Põe o estado com os mods do personagem: o DEFINHAMENTO — "Definhamentos infligidos por você expiram X% mais lentamente" (a duração ÷
 * (1 − X%)) e "X% de chance de, quando você infligir Definhamento, infligir até um máximo de 15 Debuffs de Definhamento ao invés".
 */
function porComMods(fazer, nome, e, ate, agora, ficha, rng) {
  // (lote 33, P009) Causticar, Fragilizar e Exaurir: × o "Efeito de Afecções Não-Danificadoras" (o número fixo do jogo é o de base)
  if (AFECCOES_NAO_DANO.has(nome)) {
    fazer(e, ate, agora);
    if (e[nome]?.pct) e[nome].pct *= fatorNaoDano(ficha?.afPoe);
    return;
  }
  if (nome !== 'definhado') return fazer(e, ate, agora);
  const lento = Math.min(90, Math.max(0, valor(ficha, 'definhamento_expira_lento')));
  fazer(e, agora + Math.round((ate - agora) / (1 - lento / 100)));
  if (e.definhado && rng() * 100 < valor(ficha, 'definhamento_maximo_chance')) e.definhado.n = 15;
  // (lote 28) "Inimigos Definhados por você têm −X% de todas as Resistências" (as Joias Abissais): o X fica no bicho enquanto Definhado.
  const menos = Math.abs(Math.min(0, valor(ficha, 'res_definhados')));
  if (menos > 0) e.resMenosDefinhado = Math.max(e.resMenosDefinhado ?? 0, menos);
}
/** (lote A1) Põe o estado no alvo com os mods do personagem (`porComMods`) — o Definhar do Passo Definhante (`acoes.passoDefinhante`). */
export const porNoAlvoComMods = (alvo, nome, ate, agora, ficha, rng = Math.random) => (ESTADOS_NO_ALVO[nome] ? porComMods(ESTADOS_NO_ALVO[nome], nome, (alvo.estados ??= {}), ate, agora, ficha, rng) : undefined);
// (lote 31, P044) O dano da EXPLOSÃO em cada vizinho, pela defesa dele (`hunt/resistencia.resistido`): quem registra é a caçada (o ciclo de imports).
// eslint-disable-next-line no-var
var danoDaExplosao;
export function definirDanoDaExplosao(fn) { danoDaExplosao = fn; }
/** Os tipos de dano das explosões ("como Dano de Fogo/Físico/de Caos/de Raio") e a cor do número. */
const COR_DA_EXPLOSAO = { fire: '#ff9000', physical: '#d9d9d9', chaos: '#b45cff', energy: '#7fd4ff', ice: '#9fe8ff' };
/**
 * O morto EXPLODE: `pct`% da vida máxima dele em quem está em volta (1 casa) — o "Explodem ao morrer" (o do personagem e o dos lacaios). (15/10,
 * lote 31 — P044: o dano é do `tipo` da linha e passa pela defesa de cada atingido; é de `quem` explodiu — o abate de um vizinho pela explosão
 * do seu morto é seu, o da explosão do Zumbi é do lacaio — `hunt/quem-feriu`; não é acerto de ataque nem de magia.)
 */
export function explodirMorto(hunt, alvo, pct, eventos, { tipo = 'fire', quem = QuemFeriu.VOCE } = {}) {
  const bruto = Math.max(1, Math.round(((alvo.maxHp ?? 0) * pct) / 100));
  for (const m of hunt.monstros ?? []) {
    if (m === alvo || m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - alvo.x), Math.abs(m.y - alvo.y)) > 1) continue;
    const dano = danoDaExplosao ? danoDaExplosao(hunt, m, tipo, bruto) : bruto;
    m.hp -= dano;
    QuemFeriu.carimbar(m, quem);
    eventos?.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v: dano, foe: true, alvo: m.name, color: COR_DA_EXPLOSAO[tipo] ?? '#ff9000' });
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
  // (13/10) o de Vida ("Remove uma Afecção não Elemental aleatória quando você usar um Frasco de Vida" — a Maestria de Frascos)
  if (classe === 'Life_Flasks') evento(estado, hunt, 'usarFrascoVida', ficha, ctx);
}

/** Os GATILHOS das peças ("Ativa uma Magia Encaixada quando você Atacar com esta Arma"): quem registra é `acoes.mjs` (o disparo das gemas). */
// eslint-disable-next-line no-var
var gatilhosDeItem;
export function definirGatilhosDeItem(fn) { gatilhosDeItem = fn; }
/** (lote 51) O estilhaço de um inimigo (`acoes`: o Calafrio da Corrupção — a recarga das Vaal anda uma Alma). (`var`, como o de cima: o ciclo
 * de importação chama o `definir` antes deste módulo terminar.) */
// eslint-disable-next-line no-var
var aoEstilhacar;
export function definirAoEstilhacar(fn) { aoEstilhacar = fn; }
/** (lote 51) O que cada modificador de monstro do PoE faria em você (`id` → `[{stat, valor}]` — quem registra é `aprendizado-inspirado.mjs`). */
// eslint-disable-next-line no-var
var efeitosDoModDeMonstro;
export function definirEfeitosDoModDeMonstro(fn) { efeitosDoModDeMonstro = fn; }
/**
 * (lote 51) O APRENDIZADO INSPIRADO: "Com 4 Notáveis Alocados no Raio, Ao Matar um monstro Raro, você recebe 1 de seus Modificadores por 20
 * segundos" (com os notáveis no raio, a árvore põe `aprendizado_inspirado_n`/`_s` — `passivas/arvore.raiosDasJoias`). Decisão do dono (16/10):
 * o sorteio é só entre os modificadores do Raro que têm um equivalente em você; o mesmo modificador renova o tempo (não acumula). Os efeitos
 * ficam em `hunt.poeTemporarios` (`adds`). Devolve os ids ganhos.
 */
export function aprenderDoRaro(estado, hunt, ficha, alvo, agora = hunt?.clock ?? 0, rng = Math.random) {
  const n = Math.floor(valor(ficha, 'aprendizado_inspirado_n'));
  const s = valor(ficha, 'aprendizado_inspirado_s');
  if (!hunt || !(n > 0) || !(s > 0) || !efeitosDoModDeMonstro || !['raro', 'elite'].includes(alvo?.raridade)) return [];
  const pool = (alvo.mods ?? []).filter((id) => efeitosDoModDeMonstro(id).length);
  const ganhos = [];
  while (ganhos.length < n && pool.length) ganhos.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  const t = (hunt.poeTemporarios ??= {});
  for (const id of ganhos) efeitosDoModDeMonstro(id).forEach((ef, i) => { t[`aprendizado:${id}:${i}`] = { stat: ef.stat, valor: ef.valor, ate: agora + s * 1000 }; });
  if (ganhos.length) hunt.poeFichaMudou = true;
  return ganhos;
}
/**
 * (lote 52) A DESGRAÇA DAS BRUXAS: "Quando você Matar um Inimigo Amaldiçoado com um Feitiço Não-Aura, fique imune a Maldições pelo resto da
 * Duração do Feitiço" — a imunidade por tempo (`hunt.imunidadesPoe.maldicao`, que `amaldicoarJogador` e a soma das maldições em você leem) até o
 * fim do Feitiço mais longo no morto (não a Marca, não o da aura).
 */
export function desgracaDasBruxas(hunt, ficha, alvo, agora = hunt?.clock ?? 0) {
  if (!hunt || !(valor(ficha, 'imune_maldicao_ao_matar_amaldicoado') > 0)) return 0;
  const ate = Math.max(0, ...Object.values(alvo?.maldicoes ?? {}).filter((m) => m && m.ate > agora && !m.marca && !m.aura).map((m) => m.ate));
  if (!(ate > agora)) return 0;
  const im = (hunt.imunidadesPoe ??= {});
  im.maldicao = Math.max(im.maldicao ?? 0, ate);
  hunt.poeFichaMudou = true;
  return im.maldicao;
}
/**
 * (13/10) As AFECÇÕES que podem estar em você (as do PoE — o Atordoamento e os danos contínuos que não são afecção, não): `tem` e `tirar` de
 * cada uma. O Veneno do Draevor e o do PoE são o mesmo Envenenamento.
 */
const dotAtivo = (hunt, tipos) => (hunt?.efeitosDoJogador?.dots ?? []).some((d) => tipos.includes(d.tipo) && d.falta > 0);
// (tira as pilhas dos tipos — a lista fica, vazia, como quando se tirava a mais antiga)
const tirarDot = (hunt, tipos) => { const ef = hunt?.efeitosDoJogador; if (ef?.dots) ef.dots = ef.dots.filter((d) => !tipos.includes(d.tipo)); };
export const AFECCOES_NO_JOGADOR = [
  { nome: 'incendio', elemental: true, tem: (h) => dotAtivo(h, ['queimadura']), tirar: (h) => tirarDot(h, ['queimadura']) },
  { nome: 'sangramento', elemental: false, tem: (h) => dotAtivo(h, ['sangramento']), tirar: (h) => tirarDot(h, ['sangramento']) },
  { nome: 'veneno', elemental: false, tem: (h) => dotAtivo(h, ['veneno', 'venenoPoe']), tirar: (h) => tirarDot(h, ['veneno', 'venenoPoe']) },
  { nome: 'congelamento', elemental: true, tem: (h, agora) => (h?.controle?.congelado?.ate ?? 0) > agora, tirar: (h) => { delete h.controle.congelado; } },
  { nome: 'resfriamento', elemental: true, tem: (h, agora) => (h?.controle?.lento?.ate ?? 0) > agora, tirar: (h) => { delete h.controle.lento; } },
  { nome: 'eletrizacao', elemental: true, tem: (h, agora) => (h?.debuffsDoJogador?.eletrizado?.ate ?? 0) > agora || dotAtivo(h, ['choque']), tirar: (h) => { if (h.debuffsDoJogador) delete h.debuffsDoJogador.eletrizado; tirarDot(h, ['choque']); } },
];
export function evento(estado, hunt, nome, ficha, ctx = {}) {
  if (!ligado() || !hunt) return;
  const lista = ficha?.eventosPoe ?? [];
  const agora = ctx.agora ?? hunt.clock ?? 0;
  // (ciclo 7, lote D) Todo evento marca o "recentemente" dele (`evRecente:<evento>` — "se você Suprimiu Dano Mágico Recentemente"); matar
  // um Congelado é ESTILHAÇAR ("se você Estilhaçou um Inimigo Recentemente").
  marcar(hunt, `ev:${nome}`, agora);
  // (lote F) e a lista dos últimos de cada um ("por cada Veneno que você tenha infligido Recentemente": a escala `usos:ev.envenenar`)
  const ultimos = ((hunt.poeUsosRecentes ??= {})[`ev.${nome}`] ??= []);
  ultimos.push(agora);
  while (ultimos.length && (ultimos[0] < agora - 20000 || ultimos.length > 60)) ultimos.shift();
  if (nome === 'matar' && ctx.alvo?.estados?.congelado?.ate > agora) {
    marcar(hunt, 'estilhacou', agora);
    aoEstilhacar?.(estado, hunt, ficha, ctx.rng ?? Math.random, { alvo: ctx.alvo, eventos: ctx.eventos, personagem: ctx.personagem });
  }
  // (14/10, a Cruzada Implacável: o abate — seu ou do seu lacaio — é ocasião da Relíquia Elemental, sua e dos companheiros perto; lote 31: o
  // do lacaio e o do totem são os eventos deles — "quando você ou um Aliado próximo Matar")
  if (nome === 'matar' || nome === 'matarLacaio' || nome === 'matarTotem') notarParaReliquia(estado, hunt, agora);
  // (14/10, Erguer Aranhas: o abate pendente — `acoes.tiqueDasAranhas`)
  if (nome === 'matar' && hunt) hunt.poeAbatesParaAranhas = (hunt.poeAbatesParaAranhas ?? 0) + 1;
  const rng = ctx.rng ?? Math.random;
  const alvo = ctx.alvo ?? null;
  if (nome === 'matar' && alvo) {
    // (lote 71) "se você Matou um Inimigo Amaldiçoado Recentemente"
    if (maldicoesNoAlvo(alvo, agora) > 0) marcar(hunt, 'matouAmaldicoado', agora);
    aprenderDoRaro(estado, hunt, ficha, alvo, agora, rng);
    desgracaDasBruxas(hunt, ficha, alvo, agora);
  }
  // (lote 54, a Fome Eterna: a morte de qualquer inimigo dá a alma aos lacaios com o Devorador de Almas perto)
  if (nome === 'inimigoMorrer' && alvo) almaParaOsLacaios(hunt.lacaios, alvo, agora);
  const tagsAlvo = new Set([...tagsDoAlvo(alvo, agora), ...(ctx.tags ?? [])]);
  let conds = null;
  for (const ev of lista) {
    if (ev.evento !== nome) continue;
    if (ev.conds.length) {
      conds ??= condicoesDe(estado, ficha.afPoe);
      // (+ "afetado por MENOS de N Venenos" — `alvoMenosVenenos:N`: o alvo não tem a tag `alvoVenenos:N`.)
      // (+ lote 72: "se houver N ou menos Debuffs de Definhar no Inimigo" — `alvoDefinhadosAte:N`.)
      if (!ev.conds.every((c) => (ehCondDeEstado(c) ? vale(conds, c) : /^alvoMenosVenenos:\d+$/.test(c) ? !tagsAlvo.has(`alvoVenenos:${c.split(':')[1]}`) : /^alvoDefinhadosAte:\d+$/.test(c) ? definhadosNoAlvo(alvo, agora) <= Number(c.split(':')[1]) : tagsAlvo.has(c)))) continue;
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
    case 'transferirMarca': { const novo = transferirMarca(hunt, alvo, agora); if (novo) eventos?.push({ t: 'estado', uid: novo.uid, x: novo.x, y: novo.y, estado: 'marcado' }); return; }
    case 'transferirMaldicoes': {
      if (!alvo?.maldicoes) return;
      const marca = false;
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
    // (lote 72, a Mentalidade da Multidão) `cargaAleatoriaPorPoder` = X: X% de chance POR PODER do Clamor (até 100%) de uma carga aleatória.
    case 'cargaAleatoriaPorPoder': if (sorte(Math.min(100, v * poderDoClamor(hunt, ficha)))) leitorDeCargas?.(estado, 'ganhar', ['frenesi', 'poder', 'tolerancia'][Math.floor(rng() * 3)], 1); return;
    // (lote 72, o Chamado Alarmante) `statTempPorPoder:<stat>:<segundos>:<cada>:<máximo>` = X: X do atributo por cada `<cada>` de Poder do
    // Clamor, até `<máximo>`, por N segundos (renova; não soma ao que já está).
    case 'statTempPorPoder': {
      const [stat, seg, cada, max] = String(ev.param).split(':');
      const quanto = Number(cada) > 0 ? Math.min(Number(max) || Infinity, Math.floor(poderDoClamor(hunt, ficha) / Number(cada)) * v) : 0;
      if (!(quanto > 0)) return;
      const t = (hunt.poeTemporarios ??= {});
      const ate = agora + (Number(seg) || 1) * 1000;
      t[stat] = t[stat] && t[stat].ate > agora ? { stat, valor: Math.max(t[stat].valor, quanto), ate: Math.max(t[stat].ate, ate) } : { stat, valor: quanto, ate };
      hunt.poeFichaMudou = true;
      return;
    }
    case 'roubarCargas': if (sorte(v)) for (const t of ['frenesi', 'poder', 'tolerancia']) leitorDeCargas?.(estado, 'ganhar', t, 1); return;
    case 'buff': return ganhar(ev.param, v);
    // `buffChance:<buff>:<segundos>` = a CHANCE (%) de ganhar o buff por N segundos ("X% de chance de ganhar Agressividade por 4 segundos ao Matar").
    case 'buffChance': { const [buff, seg] = String(ev.param).split(':'); if (sorte(v)) ganhar(buff, Number(seg) || SEGUNDOS_PADRAO); return; }
    case 'furia': return ganharFuria(hunt, v, agora);
    // (13/10) `frasco:vida` = só os Frascos de Vida ("Frascos de Vida ganham N quando você Suprimir"); `frasco:vida:<s>` = no máximo uma vez a cada
    // s segundos ("Frascos de Vida ganham uma Carga quando você acertar um Inimigo, não mais que uma vez por segundo" — a Medicina de Campo).
    case 'frasco': {
      const [so, cadaS] = String(ev.param ?? '').split(':');
      if (Number(cadaS) > 0) {
        const intervalos = (hunt.poeIntervalos ??= {});
        if (agora - (intervalos[`frasco:${ev.param}`] ?? -Infinity) < Number(cadaS) * 1000) return;
        intervalos[`frasco:${ev.param}`] = agora;
      }
      for (const p of estado.frascos ?? []) if (p?.poe && (so !== 'vida' || p.poe.classe === 'Life_Flasks')) p.poe.cargas = (p.poe.cargas ?? 0) + v;
      return;
    }
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
      } else if (ev.param === 'sangueCorrompido') {
        // (12/10) "remove Sangue Corrompido ao usar uma Habilidade de Guarda"
        Dot.removerDoJogador(hunt, 'sangueCorrompido');
      } else if (ev.param === 'danificadoras') {
        // (lote G) as Afecções Danificadoras: Incêndio, Sangramento e Veneno
        for (const t of ['queimadura', 'sangramento', 'veneno', 'venenoPoe']) Dot.removerDoJogador(hunt, t);
      } else if (ev.param === 'lento') {
        if (hunt.controle) delete hunt.controle.lento;
      } else if (ev.param === 'naoElemental' || ev.param === 'aleatoria') {
        // (13/10) UMA afecção aleatória (a de todas as pilhas do tipo, como no PoE): `naoElemental` — o Sangramento ou o Veneno (a Maestria de
        // Frascos); `aleatoria` — qualquer uma, as elementais também: o Incêndio, o Congelamento, o Resfriamento e a Eletrização (a Maestria de
        // Estandartes).
        const tem = AFECCOES_NO_JOGADOR.filter((a) => (ev.param === 'aleatoria' || !a.elemental) && a.tem(hunt, agora));
        if (tem.length) tem[Math.floor(rng() * tem.length)].tirar(hunt);
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
      porComMods(fazer, nomeDoEstado, (alvo.estados ??= {}), agora + (Number(seg) || SEGUNDOS_PADRAO) * 1000, agora, ficha, rng);
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
        porComMods(fazer, nomeDoEstado, (m.estados ??= {}), agora + (Number(seg) || SEGUNDOS_PADRAO) * 1000, agora, ficha, rng);
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
    // (lote 57) `soloProfano:<segundos>` = a CHANCE de criar Solo Profano onde você está (a Doutrina Racional, no Golpe Crítico).
    case 'soloProfano': if (sorte(v)) criarSoloProfano(hunt, Number(ev.param) || SOLO_PROFANO.duracaoS, agora); return;
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
      // (lote 80, o Discípulo de Kitava: `vidaMana` — um cadáver só recupera Vida e Mana)
      const recursos = ev.param === 'vidaMana' ? ['hp', 'mana'] : [ev.param === 'es' ? 'es' : ev.param === 'mana' ? 'mana' : 'hp'];
      for (const recurso of recursos) {
        const max = recurso === 'es' ? esMax : recurso === 'mana' ? estado.maxMana ?? 0 : estado.maxHp ?? 0;
        curar(recurso, max, (max * v) / 100);
      }
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
    // `explodirChance:<pct da vida>[:<tipo>]` = a CHANCE (%) de o morto explodir ("Inimigos Queimando mortos por você têm X% de chance de
    // Explodirem, causando um décimo de sua Vida máxima como Dano de Fogo"); o tipo do dano (lote 31 — sem ele, Fogo).
    case 'explodirChance': {
      if (!sorte(v)) return;
      const [pct, tipo] = String(ev.param ?? '').split(':');
      return aplicarAcao(estado, hunt, { ...ev, acao: 'explodir', valor: Number(pct) || 10, param: tipo ?? '' }, ficha, ctx);
    }
    case 'explodir': {
      if (!alvo || !hunt.pos) return;
      explodirMorto(hunt, alvo, v, eventos, { tipo: ev.param || 'fire' });
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
    // (ciclo 7) "Sua Marca se transfere para outro Inimigo quando o Inimigo Marcado morrer" (o evento `matar`, no morto).
    case 'gatilho': { const [gema, chance] = String(ev.param).split(':'); if (disparoDeGatilho && sorte(Number(chance) || 100)) disparoDeGatilho(estado, hunt, ctx.personagem, gema, v, alvo, eventos); return; }
    default: return;
  }
}

/**
 * As AURAS dos únicos em quem está perto (a até 3 casas): "Inimigos Próximos são Cegados / Resfriados / Causticados / Intimidados / Lentos /
 * Cobertos em Cinzas" — `aura_proximos:<estado>`. A caçada chama a cada tique; o estado dura 1 s e é renovado enquanto o bicho está perto.
 */
/**
 * (11/10) PLANTAR o Estandarte (o PoE atual: "consome todo o Valor para plantar um Estandarte com uma aura. A aura será maior e mais poderosa
 * quanto mais Valor for consumido"): zera o Valor e devolve `{ valor, efeitoMais, areaMais }` (o "X% mais Efeito de Aura / Área de Efeito por
 * Valor consumido" da gema — `porValor`). Os gatilhos de plantar: "Recupera X% da Vida por cada N de Valor consumido"
 * (`estandarte_vida_por_valor:<N>`), "Remove uma Afecção aleatória de você quando você consumir ao menos N de Valor"
 * (`estandarte_remove_afeccao_min`) e "Ganhe N Cargas de Frenesi/Tolerância ao consumir o Valor máximo" (`estandarte_cargas_cheio:<tipo>`).
 */
export function plantarEstandarte(estado, hunt, ficha, porValor = {}, agora = hunt?.clock ?? 0, rng = Math.random) {
  const v = Math.floor(valorAtual(hunt));
  const cheio = v > 0 && v >= valorMaximo(ficha?.afPoe);
  if (hunt?.valor) hunt.valor.n = 0;
  if (ligado() && ficha?.afPoe && v > 0) {
    const acao = (a, x, param = '') => aplicarAcao(estado, hunt, { evento: 'plantarEstandarte', acao: a, param, conds: [], valor: x }, ficha, { alvo: null, agora, rng, eventos: null });
    for (const [k, x] of Object.entries(ficha.afPoe)) {
      if (!(x > 0)) continue;
      const vida = /^estandarte_vida_por_valor:(\d+)$/.exec(k);
      if (vida) acao('vidaPct', x * Math.floor(v / Math.max(1, Number(vida[1]))));
      const cargas = /^estandarte_cargas_cheio:(frenesi|tolerancia|poder)$/.exec(k);
      if (cargas && cheio) for (let i = 0; i < x; i++) acao('carga', 100, cargas[1]);
    }
    const min = valor(ficha, 'estandarte_remove_afeccao_min');
    // (13/10: uma afecção aleatória, qualquer uma — antes, o dano contínuo mais antigo)
    if (min > 0 && v >= min) acao('removerAfeccao', 100, 'aleatoria');
  }
  return { valor: v, efeitoMais: (Number(porValor?.efeito) || 0) * v, areaMais: (Number(porValor?.area) || 0) * v };
}

/**
 * (lote 34 — P010/P011) A AURA DAS MINAS PLANTADAS ("Cada Mina aplica Dano sofrido aumentado em X% aos Inimigos próximos a ela, até Y%" e "…
 * Dano CAUSADO reduzido…" — `mina_fragiliza:<Y>` / `mina_enfraquece:<Y>` = X): enquanto plantada, cada Mina soma X × (1 + "Efeito de Auras das
 * Minas") nos inimigos a até 35 unidades dela (3,5 m, o raio base das auras de Mina no PoE — 1 casa), até Y — o efeito aumenta o de cada Mina,
 * não o teto. O estado dura o tique (renovado enquanto a Mina está lá).
 */
export const AURA_DA_MINA_UNIDADES = 35;
export function auraDasMinas(hunt, ficha, agora = hunt?.clock ?? 0) {
  const porCampo = {};
  for (const [k, x] of Object.entries(ficha?.afPoe ?? {})) {
    const mm = /^mina_(fragiliza|enfraquece):(\d+)$/.exec(k);
    if (!mm || !(x > 0)) continue;
    const c = (porCampo[mm[1] === 'fragiliza' ? 'minaFragil' : 'minaFraco'] ??= { porMina: 0, teto: 0 });
    c.porMina += x * Math.max(0, 1 + valor(ficha, 'efeito_aura_mina') / 100);
    c.teto = Math.max(c.teto, Number(mm[2]));
  }
  if (!Object.keys(porCampo).length) return;
  const minas = Plantadas.plantadas(hunt, 'mina', agora);
  if (!minas.length) return;
  for (const b of hunt.monstros ?? []) {
    if (!(b.hp > 0) || b.dummy) continue;
    const n = minas.filter((p) => !(b.z != null && p.z != null && b.z !== p.z) && Math.max(Math.abs(b.x - p.x), Math.abs(b.y - p.y)) * DISTANCIA_DO_PROJETIL.unidadesPorCasa <= AURA_DA_MINA_UNIDADES).length;
    if (!n) continue;
    for (const [campo, c] of Object.entries(porCampo)) (b.estados ??= {})[campo] = { ate: agora + 500, pct: Math.min(c.teto, c.porMina * n) };
  }
}
export function aurasProximas(estado, hunt, ficha, agora = hunt?.clock ?? 0) {
  if (!ligado() || !hunt?.pos || !ficha?.afPoe) return;
  auraDasMinas(hunt, ficha, agora);
  // (11/10) O VALOR se ganha "enquanto você tem uma habilidade de Estandarte" (na barra — `condicoes-poe.ganharValor`).
  hunt.poeTemEstandarte = (estado.actions ?? []).some((a) => /_Banner$/.test(String(a?.id ?? '')));
  // (11/10) O ESTANDARTE PLANTADO: sair da área dele o encerra ("termina antes se você sair da aura"); "Bônus do seu estandarte permanecem por N
  // segundos após você sair da área" o segura N s; "Quando você deixar a Área do seu Estandarte, recupere X% do Valor consumido para tal Estandarte".
  for (const b of Object.values(hunt.buffs ?? {})) {
    const p = b?.estandarte;
    if (!p || !(b.ate > agora) || p.saiu != null) continue;
    const fora = (hunt.z ?? 0) !== (p.z ?? 0) || Math.max(Math.abs(hunt.pos.x - p.x), Math.abs(hunt.pos.y - p.y)) > (b.raio ?? 1);
    if (!fora) continue;
    p.saiu = agora;
    b.ate = Math.min(b.ate, agora + 1000 * Math.max(0, valor(ficha, 'estandarte_fica_s')));
    const volta = valor(ficha, 'estandarte_sair_recupera_valor_pct');
    if (volta > 0 && p.valor > 0) { const v = (hunt.valor ??= { n: 0, ultimo: -Infinity }); v.n = Math.min(valorMaximo(ficha.afPoe), v.n + (p.valor * volta) / 100); }
  }
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
  // Estandarte sofrem Dano aumentado em X%" (`aura_dano_sofrido` — 11/10: em volta do Estandarte PLANTADO, no raio dele).
  const doSolo = valor(ficha, 'solo_sagrado_fragiliza');
  const daAura = valor(ficha, 'aura_dano_sofrido');
  const plantado = estandartePlantado(hunt, agora);
  const centroDoEstandarte = plantado?.estandarte ? { x: plantado.estandarte.x, y: plantado.estandarte.y, raio: plantado.raio ?? 1 } : hunt.pos ? { x: hunt.pos.x, y: hunt.pos.y, raio: 3 } : null;
  if (doSolo > 0 || daAura > 0) {
    for (const m of hunt.monstros ?? []) {
      if (!(m.hp > 0) || m.dummy) continue;
      if (doSolo > 0 && (hunt.solosSagrados ?? []).some((s) => s.ate > agora && Math.max(Math.abs(s.x - m.x), Math.abs(s.y - m.y)) <= s.raio)) (m.estados ??= {}).soloFragil = { ate: agora + 1000, pct: doSolo };
      if (daAura > 0 && centroDoEstandarte && Math.max(Math.abs(m.x - centroDoEstandarte.x), Math.abs(m.y - centroDoEstandarte.y)) <= centroDoEstandarte.raio) (m.estados ??= {}).auraFragil = { ate: agora + 1000, pct: daAura };
    }
  }
  // (lote 57) o SOLO PROFANO: o inimigo sobre ele fica marcado — 1 s (o tique renova) e, com "Efeitos do Solo Profano criados por você Perduram
  // por N segundos", N s a mais depois de sair
  if ((hunt.solosProfanos ?? []).some((s) => s.ate > agora)) {
    const fica = 1000 + valor(ficha, 'solo_profano_perdura_s') * 1000;
    for (const m of hunt.monstros ?? []) {
      if (!(m.hp > 0) || m.dummy || !hunt.solosProfanos.some((s) => s.ate > agora && Math.max(Math.abs(s.x - m.x), Math.abs(s.y - m.y)) <= s.raio)) continue;
      (m.estados ??= {}).soloProfano = { ate: Math.max(m.estados.soloProfano?.ate ?? 0, agora + fica) };
    }
  }
  // "Efeitos do Solo Sagrado criado por você Perduram por N segundos": quem está sobre ele leva o efeito por mais N s.
  const perdura = valor(ficha, 'solo_sagrado_perdura_s');
  if (perdura > 0 && hunt.pos && (hunt.solosSagrados ?? []).some((s) => s.ate > agora && Math.max(Math.abs(s.x - hunt.pos.x), Math.abs(s.y - hunt.pos.y)) <= s.raio)) hunt.poeSoloAte = agora + perdura * 1000;
  // (ciclo 7, lote D) Os PERIÓDICOS: "A cada N segundos, Regenera X% de Vida durante um segundo" — `periodico:<N>:<ação>[:<parâmetro>]` = o
  // valor da ação, rodada a cada N segundos (a primeira, N segundos depois de entrar).
  for (const [k, x] of Object.entries(ficha.afPoe)) {
    if (!k.startsWith('periodico:') || !(x > 0)) continue;
    const [, cadaDe, acao, ...param] = k.split(':');
    // (lote 30, P029: `periodico:<N>d<atraso>:…` — o "consecutivamente" da Parada Cardíaca: a segunda parte começa <atraso> s depois da primeira)
    const [cada, atraso] = cadaDe.split('d').map(Number);
    const p = (hunt.poePeriodicos ??= {});
    p[k] ??= agora + (atraso || 0) * 1000;
    if (agora - p[k] < cada * 1000) continue;
    p[k] = agora;
    // (14/10) `periodico:<N>:gatilho:<gema>` — a gema disparada a cada N segundos (as Novas e os Esqueletos dos altares Maiores): no bicho vivo
    // mais perto (a até 6 casas); os eventos dela saem no tique (`hunt.poeEventosDoTempo` — `cacadas.tique`).
    if (acao === 'gatilho') {
      const perto = hunt.pos ? (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) <= 6) : [];
      if (!perto.length) continue;
      const alvo = perto.sort((a, b) => Math.max(Math.abs(a.x - hunt.pos.x), Math.abs(a.y - hunt.pos.y)) - Math.max(Math.abs(b.x - hunt.pos.x), Math.abs(b.y - hunt.pos.y)))[0];
      aplicarAcao(estado, hunt, { evento: 'tempo', acao, param: param.join(':'), conds: [], valor: x }, ficha, { alvo, agora, rng: Math.random, eventos: (hunt.poeEventosDoTempo ??= []) });
      continue;
    }
    aplicarAcao(estado, hunt, { evento: 'tempo', acao, param: param.join(':'), conds: [], valor: x }, ficha, { alvo: null, agora, rng: Math.random, eventos: null });
  }
  // (11/10, as ascendências) As AURAS nos inimigos próximos (a até 3 casas), que o golpe e a magia deles leem: "Inimigos Próximos tem -X% de
  // Multiplicador de Acerto Crítico" (`critMultMenos` — `condicoes-poe.criticoDoBicho`), "Inimigos próximos causam X% menos Dano Elemental"
  // (`elemMenos`), "Inimigos Próximos Convertem X% de seu Dano Físico para Fogo" (`fisicoEmFogo`) e "Inimigos Próximos têm Recuperação da
  // Recarga reduzido em X%" (`recargaMenos` — `poderes`). E "Inimigos Incendiados por você têm X% do Dano Físico causado por eles convertido
  // para Fogo" (o Incendiado, perto ou não).
  const critMultMenos = Math.abs(valor(ficha, 'aura_crit_mult_menos'));
  const elemMenos = valor(ficha, 'aura_dano_elem_menos');
  const emFogoPerto = valor(ficha, 'aura_fisico_em_fogo');
  const emFogoIncendiado = valor(ficha, 'incendiados_fisico_em_fogo');
  const recargaMenos = valor(ficha, 'aura_recarga_menos');
  if ((critMultMenos > 0 || elemMenos > 0 || emFogoPerto > 0 || emFogoIncendiado > 0 || recargaMenos > 0) && hunt.pos) {
    for (const m of hunt.monstros ?? []) {
      if (!(m.hp > 0) || m.dummy) continue;
      const e = (m.estados ??= {});
      const perto = Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) <= 3;
      if (perto && critMultMenos > 0) e.critMultMenos = { ate: agora + 1000, pct: critMultMenos };
      if (perto && elemMenos > 0) e.elemMenos = { ate: agora + 1000, pct: Math.min(100, elemMenos) };
      if (perto && recargaMenos > 0) e.recargaMenos = { ate: agora + 1000, pct: Math.min(90, recargaMenos) };
      const incendiado = emFogoIncendiado > 0 && (m.dots ?? []).some((d) => d.tipo === 'queimadura' && d.falta > 0);
      const emFogo = (perto ? emFogoPerto : 0) + (incendiado ? emFogoIncendiado : 0);
      if (emFogo > 0) e.fisicoEmFogo = { ate: agora + 1000, pct: Math.min(100, emFogo) };
    }
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
      if (acaoMax > 0 && acaoMax < 100) porLento(e, agora + 1000, 100 - acaoMax, agora);
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
  // (14/10) O ALTAR ALEATÓRIO a cada N segundos (a Harmonia do Propósito: "Ganha um buff de altar aleatório a cada 10 segundos" — o valor é a
  // duração base, 20 s, × "Duração dos Efeitos de Altares em você aumentada"): um dos 13 do sorteio do PoE (`ALTARES_DO_SORTEIO`).
  for (const [k, dur] of Object.entries(ficha.afPoe)) {
    const p = /^altar_aleatorio:(\d+)$/.exec(k);
    if (!p || !(dur > 0)) continue;
    const prox = (hunt.poePeriodicos ??= {});
    prox[k] ??= agora + Number(p[1]) * 1000;
    if (agora < prox[k]) continue;
    ganharBuff(hunt, ALTARES_DO_SORTEIO[Math.floor(Math.random() * ALTARES_DO_SORTEIO.length)], dur * Math.max(0, 1 + valor(ficha, 'duracao_altar') / 100), agora);
    prox[k] = agora + Number(p[1]) * 1000;
  }
  // O buff a cada N segundos ("Você ganha Sobrecarga Elemental por 8 segundos a cada 16 segundos").
  for (const [k, dur] of Object.entries(ficha.afPoe)) {
    const p = /^buff_periodico:(\w+):(\d+)$/.exec(k);
    if (!p || !(dur > 0)) continue;
    const prox = (hunt.poePeriodicos ??= {});
    if (agora < (prox[k] ?? 0)) continue;
    ganharBuff(hunt, p[1], dur, agora);
    prox[k] = agora + Number(p[2]) * 1000;
  }
  // (14/10, o Pacto Cadavérico do Necromancer: "Inimigos próximos a cadáveres Criados por você Recentemente são Resfriados e Eletrizados" — os
  // cadáveres de Profanar e Desenterrar dos últimos 4 s; os inimigos a até 3 casas de um deles, por 1 s, renovados)
  if (Number(ficha.afPoe.pacto_cadaverico) > 0) {
    const recentes = (hunt.cadaveres ?? []).filter((c) => c.criadoPor && agora - (c.criadoEm ?? -Infinity) <= 4000);
    if (recentes.length) {
      for (const m of hunt.monstros ?? []) {
        if (!(m.hp > 0) || m.dummy || !recentes.some((c) => Math.max(Math.abs(m.x - c.x), Math.abs(m.y - c.y)) <= 3)) continue;
        const e = (m.estados ??= {});
        ESTADOS_NO_ALVO.resfriado(e, agora + 1000, agora);
        ESTADOS_NO_ALVO.eletrizado(e, agora + 1000);
      }
    }
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
    for (const a of auras) {
      ESTADOS_NO_ALVO[a]?.(e, agora + 1000, agora);
      // (lote 33, P009: a aura "Inimigos Próximos são Causticados" — × o "Efeito de Afecções Não-Danificadoras")
      if (AFECCOES_NAO_DANO.has(a) && e[a]?.pct) e[a].pct *= fatorNaoDano(ficha.afPoe);
    }
    if (lento) porLento(e, agora + 1000, lento, agora);
    if (Object.keys(res).length) e.resAura = { ...res, ate: agora + 1000 };
    if (Object.keys(igual).length) e.resIgual = { ...igual, ate: agora + 1000 };
  }
}
