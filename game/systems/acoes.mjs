// Barra de ação: magias, runas e poções que o personagem usa numa hunt —
// tanto sozinho (Barra automática) quanto por clique/tecla (`huntAction`).
// Mesmo contrato `{ok, erro?}` de `inventario.mjs`/`loja.mjs`; nunca fala
// com a rede.
//
// ---- O que é REAL aqui, e o que é aproximado ----
//
// O catálogo inteiro é o REAL, capturado ao vivo (`send({t:'actions'})` no
// site original, 2026-09-23 — `gamedata/action-catalog.json`, cópia de
// `api-mapeada/servidor/actionCatalog.json`): 114 magias das 5 vocações, 18
// runas, 12 poções, com palavras, level, magic level, mana, cooldown, grupo,
// elemento, formato da área (`forma`), efeito/projétil, alcance e os 22
// slots com os papéis reais (5 vida, 2 mana, velocidade, 3 suporte, 11
// ataque). Os textos de `blocked` são os mesmos que o original manda.
//
// Aproximado: o `damage` de cada entrada veio JÁ CALCULADO para quem pediu —
// o servidor original não manda a fórmula. Com a mesma captura em dois knights
// (level 90 e 343) o dano vira uma reta por level (`danoNoLevel`): exata nos
// dois pontos medidos, estimada fora deles. Magic level não entra (os dois são
// knights), então magia de mago em mago sai subestimada. Magias de suporte/
// velocidade gastam mana, cooldown e mostram o efeito, mas ainda não aplicam
// buff nenhum, e `overTime` (dano contínuo) não é aplicado.
import * as Mecanicas from './mobs/mecanicas.mjs';
import * as Gemas from './skills/gemas.mjs';
import * as Tags from './skills/tags.mjs';
import * as ModsPoe from './itens-poe/mods-poe.mjs';
import { valor as valorPoe, slugDoNome } from './itens-poe/condicoes-poe.mjs';
import { resistido, resistenciaDe, resistenciaEfetivaDe } from './hunt/resistencia.mjs';
import { registrarGolpe } from './combate/registro.mjs';
import * as Dot from './combate/dot.mjs';
import * as Controle from './combate/controle.mjs';
import * as AtributosDoMob from './mobs/atributos.mjs';
import { ACTION_CATALOG, ACTION_CATALOG_ALTO, LEVELS_DAS_CAPTURAS, ITEM_CATALOG, CHARACTER_TEMPLATE } from './dados.mjs';
import { removerItem } from './inventario.mjs';
import * as Treino from './treino.mjs';
import * as R from './regras.mjs';
import { ligado as itensPoeLigado } from './itens-poe/catalogo.mjs';
import * as LacaiosPoe from './itens-poe/lacaios-poe.mjs';
import * as Poderes from './poderes.mjs';
import * as GemasPoe from './itens-poe/gemas-poe.mjs';
import * as Reserva from './itens-poe/reserva.mjs';
import * as Ficha from './ficha.mjs';
import { temHabilidade } from './passivas/arvore.mjs';
import * as AfeccoesPoe from './itens-poe/afeccoes.mjs';
import * as Summon from './summon.mjs';
import * as Arvore from './arvore.mjs';
import * as Reforcos from './skills/reforcos.mjs';
import * as Areas from '../engine/areas.mjs';
import * as Secundarios from './skills/golpes-secundarios.mjs';
import * as Estados from './skills/estados.mjs';
import * as Poder from './armas/poder.mjs';
import * as Limites from './combate/limites.mjs';
import * as CargasPoe from './itens-poe/cargas.mjs';

// A BARRA DO PoE (dono, 07/10: "frascos 1 a 5 e mais 8 que podem ser ataques, auras, suporte e etc"): com o PoE ligado a barra tem
// 8 slots de HABILIDADE numa fileira só (qualquer gema cabe em qualquer um — não há mais os ofícios vida/mana/velocidade/suporte/ataque
// das poções do Draevor) e, antes deles, as 5 vagas do cinto de frascos nas teclas 1 a 5 (os frascos não são ações: ver `itens-poe/frascos.mjs`).
// Sem o PoE, a barra de sempre: 22 slots em duas fileiras, com os ofícios do catálogo.
const BARRA_DO_POE = itensPoeLigado();
export const SLOTS = BARRA_DO_POE ? 8 : ACTION_CATALOG.slots;
export const SLOTS_POR_FILEIRA = BARRA_DO_POE ? 8 : ACTION_CATALOG.slotsPorFileira;
export const PAPEL_DO_SLOT = BARRA_DO_POE ? Array(SLOTS).fill('skill') : ACTION_CATALOG.papelDoSlot;
export const PAPEIS = BARRA_DO_POE ? { skill: { icone: 'el-fire', nome: 'habilidade', dica: 'qualquer gema: ataque, aura, buff, invocação, maldição...' } } : ACTION_CATALOG.papeis;
/** As vagas do cinto de frascos que a barra desenha antes das habilidades (0 sem o PoE) e as teclas delas (reservadas: nenhuma habilidade as usa). */
export const FRASCOS_NA_BARRA = BARRA_DO_POE ? 5 : 0;
export const TECLAS_DOS_FRASCOS = BARRA_DO_POE ? ['1', '2', '3', '4', '5'] : [];
/** As teclas de fábrica dos slots: no PoE, letras livres (W/A/S/D andam); sem o PoE, o molde do personagem (1-9, 0, -). */
export const TECLAS_PADRAO = BARRA_DO_POE ? ['q', 'e', 'r', 't', 'f', 'g', 'c', 'v'] : [...CHARACTER_TEMPLATE.hotkeys];
/** A ação cabe neste slot? O slot de habilidade do PoE aceita qualquer ofício. */
const cabeNoSlot = (entry, slot) => PAPEL_DO_SLOT[slot] === 'skill' || (entry.papeis ?? []).includes(PAPEL_DO_SLOT[slot]);

/**
 * Deixa a barra do personagem do tamanho de AGORA (ao entrar): quem vem da barra de 22 com as poções do Draevor fica com as ações que
 * tinha, compactadas nos primeiros slots (as que não cabem saem), e as teclas de fábrica do PoE. Devolve se mudou algo.
 */
export function ajustarBarra(estado) {
  let mudou = false;
  const ajustar = (dono) => {
    const acoes = Array.isArray(dono.actions) ? dono.actions : [];
    const teclas = Array.isArray(dono.hotkeys) ? dono.hotkeys : [];
    if (acoes.length === SLOTS && teclas.length === SLOTS) return;
    const cheias = acoes.filter(Boolean).slice(0, SLOTS);
    dono.actions = [...cheias, ...Array(SLOTS - cheias.length).fill(null)];
    dono.hotkeys = BARRA_DO_POE ? [...TECLAS_PADRAO] : [...teclas.slice(0, SLOTS), ...Array(Math.max(0, SLOTS - teclas.length)).fill(null)];
    mudou = true;
  };
  ajustar(estado);
  for (const p of estado.actionPresets ?? []) ajustar(p);
  return mudou;
}

const ENTRADAS = [...ACTION_CATALOG.spells, ...ACTION_CATALOG.runes, ...ACTION_CATALOG.items];
const POR_ID = new Map(ENTRADAS.map((e) => [e.id, e]));
/** Registra uma ação criada depois da carga do catálogo (as magias das gemas do PoE — `itens-poe/gemas-poe.mjs`). */
export function registrarAcao(entry) {
  POR_ID.set(entry.id, entry);
}
const ALTO_POR_ID = new Map([...ACTION_CATALOG_ALTO.spells, ...ACTION_CATALOG_ALTO.runes].map((e) => [e.id, e]));

/** O custo de mana DO CATÁLOGO da skill, com o balanceamento da gema (`fatorDeCusto` em `skills.json`); o resto (afixos, suportes) multiplica por cima. */
const custoDoCatalogo = (entry) => Math.round((entry.mana ?? 0) * (Gemas.defDaGema(Gemas.ITEM_DA_ACAO.get(entry.id))?.fatorDeCusto ?? 1));
/** O custo de mana desta skill para quem lança: a gema do PoE custa o do nível dela (a tabela do PoE); as outras, o do catálogo. */
// (A aura do PoE que RESERVA não tem custo: ela tranca a mana enquanto está ligada — `itens-poe/reserva.mjs`.)
// (E a maldição com a Blasfêmia, que vira aura e reserva.)
const custoDaSkill = (entry, efeitoDaGema) => (entry.poeGema
  ? entry.poeGema.buff && (Reserva.daGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) || Reserva.ehMaldicaoEmAura(entry, efeitoDaGema)) ? 0 : GemasPoe.custoNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1)
  : custoDoCatalogo(entry));

/**
 * As tags de golpe do PoE desta skill (`itens-poe/mods-poe.mjs`): as do poedb da gema do PoE (Ataque, Magia, Área, Projétil, Fogo…) + `habilidade`;
 * as outras skills, pelas tags do Draevor.
 */
const DRAEVOR_PARA_POE = { spell: 'magia', melee: 'corpo', ranged: 'projetil', projectile: 'projetil', area: 'area', wave: 'area', fire: 'fogo', ice: 'gelo', energy: 'raio', physical: 'fisico', summon: 'lacaio' };
export function tagsPoeDaSkill(entry) {
  const daGema = entry?.poeGema ? GemasPoe.doSlug(entry.poeGema.slug)?.gema?.tags : null;
  if (daGema) return [...ModsPoe.tagsDoPoe(daGema), 'habilidade'];
  const t = new Set(Tags.tagsDaAcao(entry).map((x) => DRAEVOR_PARA_POE[x]).filter(Boolean));
  if (t.has('corpo') || (t.has('fisico') && t.has('projetil') && !t.has('magia'))) t.add('ataque');
  if (t.has('fogo') || t.has('gelo') || t.has('raio')) t.add('elemental');
  return [...t, 'habilidade'];
}

/** PoE: a "Duração do Efeito de Habilidades" das peças (com condição: "Habilidades de Armadilha…", o anel do lado certo), em %. */
function duracaoDasPecas(estado, entry) {
  const f = Ficha.combate(estado);
  return ModsPoe.valor(f, 'duracao_habilidades') + (ModsPoe.somaPorTags(f, tagsPoeDaSkill(entry)).duracao_habilidades ?? 0);
}

/** O `{min,max}` da entrada no level dado — reta entre as duas capturas reais. */
function danoNoLevel(entry, level) {
  const baixo = entry.damage;
  const alto = ALTO_POR_ID.get(entry.id)?.damage;
  if (!baixo) return { min: 0, max: 0 };
  if (!alto) return { min: baixo.min, max: baixo.max };
  const [l1, l2] = LEVELS_DAS_CAPTURAS;
  const reta = (a, b) => Math.max(1, Math.round(a + ((b - a) * ((level ?? l1) - l1)) / (l2 - l1)));
  const min = reta(baixo.min, alto.min);
  return { min, max: Math.max(min, reta(baixo.max, alto.max)) };
}

/** O "nível" que o catálogo usa para o dano base: o equivalente ao poder da arma nas gemas de ataque; o level do personagem no resto (item, cura). */
function nivelDoDano(estado, entry, defDaGema) {
  if (!defDaGema || entry.heals || !Gemas.ehSkillDeGema(entry)) return estado.level;
  return Poder.poderEfetivo(estado, Gemas.habilidadeDeEscala(defDaGema), entry.element).nivelEquivalente;
}

/**
 * ---- O DANO de uma skill, numa conta só (o `disparar` e o balão usam esta) ----
 * Base da magia pelo level + a perícia; × (afinidade, magic level ou skill em %,
 * dano de magia/elemento dos afixos e da árvore, supremo da gema); × o bônus da
 * gema (nível, raridade, qualidade, supports) e o `fatorDeDano`. Sem o crítico
 * e sem a resistência do alvo (são do golpe, sorteados em cada acerto).
 * Devolve também a ficha com o crítico das supports (o que o golpe rola).
 */
function contaDoDano(estado, entry, efeitoDaGema, fichaBase = Ficha.combate(estado)) {
  // PoE: a ficha DESTA habilidade — os mods condicionais pelas tags dela ("Dano em Área", "Chance de Crítico com Habilidades de Fogo"…) e os
  // sorteios do uso (dano dobrado, ignorar a redução física) — `itens-poe/mods-poe.mjs`. Sem o PoE, a mesma ficha.
  fichaBase = ModsPoe.fichaDoGolpe(fichaBase, tagsPoeDaSkill(entry), { estado });
  const defDaGema = Gemas.defDaGema(Gemas.ITEM_DA_ACAO.get(entry.id));
  // O dano base da gema de ATAQUE cresce pela ARMA (poder × afinidade → "nível equivalente"); o level do personagem não soma mais (`armas/poder.mjs`).
  /*
   * A BASE da gema de ataque (dono, 02/10): a magia escala pelo DANO NORMAL da ficha — com qualquer arma (física ou wand/rod, em que o Magic
   * Attack já é o ataque desse dano). O dano de hoje da magia no level do personagem × (dano normal médio ÷ o de referência no level);
   * wand/rod mantêm a identidade (+% do rod e do elemento afim) nas magias mágicas. Sem penalidade de compatibilidade entre arma e habilidade.
   */
  const ehAtaque = !entry.heals && Gemas.ehSkillDeGema(entry) && entry.kind !== 'item' && !!defDaGema;
  // A GEMA DO PoE (`itens-poe/gemas-poe.mjs`): o dano-base é o do NÍVEL da gema — numa magia, o dano do PoE; num ataque, o golpe da arma
  // (a faixa da ficha) × a eficácia da gema ("Dano de Ataque X% de base"). Sem a régua do level do Draevor; o resto (ficha, suportes,
  // reforços) multiplica por cima, como em toda skill.
  const daGemaPoe = entry.poeGema && !entry.poeGema.buff ? entry.poeGema : null;
  const nivelPoe = efeitoDaGema?.nivel ?? 1;
  const doNivel = daGemaPoe
    ? daGemaPoe.ataque
      ? { min: (fichaBase.damage?.min ?? 1) * GemasPoe.eficaciaNoNivel(daGemaPoe.slug, nivelPoe), max: (fichaBase.damage?.max ?? 1) * GemasPoe.eficaciaNoNivel(daGemaPoe.slug, nivelPoe) }
      : GemasPoe.danoNoNivel(daGemaPoe.slug, nivelPoe)
    : danoNoLevel(entry, ehAtaque ? estado.level : nivelDoDano(estado, entry, defDaGema));
  const identidade = ehAtaque && !daGemaPoe ? Poder.poderEfetivo(estado, Gemas.habilidadeDeEscala(defDaGema), entry.element).identidade : 1;
  const escala = fichaBase.danoDeEscala ?? fichaBase.damage;
  const fatorDaFicha = ehAtaque && !daGemaPoe ? (((escala.min + escala.max) / 2) / Poder.danoNormalDeReferencia(estado.level)) * identidade : 1;
  // Sistema de itens do PoE (Fase 1; sem peças do PoE nada disto muda):
  //  - um ATAQUE do PoE = golpe físico de perto ou de longe (tags physical + melee/ranged, como o Brutal Strike): o dano somado a
  //    ataques de TODOS os elementos ("Adiciona X a Y de Dano de Fogo a Ataques") entra na faixa, como no golpe da arma;
  //  - uma MAGIA (o resto das skills com tag spell): o dano somado a magias do mesmo elemento dela entra na faixa antes dos aumentos,
  //    e a chance de crítico é a de magia (`critChanceMagia`). Dano somado de outro elemento não entra (a magia tem um elemento só).
  const tagsDaSkill = Tags.tagsDaAcao(entry);
  // A gema do PoE diz o que é (tipo "Attack" ou "Spell" no poedb); as outras skills, pelas tags.
  const ehAtaqueDoPoe = !entry.heals && (daGemaPoe ? !!daGemaPoe.ataque : tagsDaSkill.includes('physical') && (tagsDaSkill.includes('melee') || tagsDaSkill.includes('ranged')));
  const ehMagia = !entry.heals && !ehAtaqueDoPoe && (daGemaPoe ? true : tagsDaSkill.includes('spell'));
  const [somadoMin, somadoMax] = ehAtaqueDoPoe
    ? Object.values(fichaBase.danoSomado ?? {}).reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0])
    : ehMagia ? fichaBase.danoSomadoMagia?.[entry.element] ?? [0, 0] : [0, 0];
  // O dano ADICIONADO dos suportes do PoE ("têm 10 a 15 de Dano de Gelo adicional") × a eficácia do dano adicionado da gema.
  const eficacia = daGemaPoe ? (daGemaPoe.ataque ? 1 : GemasPoe.eficaciaNoNivel(daGemaPoe.slug, nivelPoe)) : 1;
  const doSuporteMin = (efeitoDaGema?.somadoMin ?? 0) * eficacia;
  const doSuporteMax = (efeitoDaGema?.somadoMax ?? 0) * eficacia;
  /*
   * A gema do PoE separa o dano por ELEMENTO (dono, 06/10: "Acerto Elemental do Espectro: fogo, gelo e raio"), como a Arena de Gemas: o
   * ATAQUE é o físico da arma × a eficácia + o adicional da gema × a eficácia + o adicionado das peças e dos suportes (cada um no elemento
   * dele), com a conversão de físico da gema e o "Não causa Dano não-Elemental"; a MAGIA é o dano de cada elemento dela + o adicionado a
   * magias das peças (do mesmo elemento) e dos suportes (× a eficácia). Cada parte passa pelo "aumentado" e pela resistência do elemento
   * dela no acerto (`acertar`), e cada uma sorteia a faixa dela. A faixa (`min`/`max`) é a soma das partes (o que o balão mostra).
   */
  let porElemento = null;
  if (daGemaPoe) {
    porElemento = {};
    const somar = (el, [a, b], m = 1) => { if (!(a > 0 || b > 0)) return; const x = porElemento[el] ?? [0, 0]; porElemento[el] = [x[0] + a * m, x[1] + b * m]; };
    const doSuporte = {};
    for (const k of Object.keys(efeitoDaGema ?? {})) { const m = k.match(/^somadoMin:(\w+)$/); if (m) doSuporte[m[1]] = [efeitoDaGema[k], efeitoDaGema[`somadoMax:${m[1]}`] ?? efeitoDaGema[k]]; }
    if (daGemaPoe.ataque) {
      const extras = { ...(fichaBase.danoSomado ?? {}) };
      for (const [el, [a, b]] of Object.entries(doSuporte)) extras[el] = [(extras[el]?.[0] ?? 0) + a, (extras[el]?.[1] ?? 0) + b];
      // PoE: o Físico da arma como Caos/Fogo extra, e o convertido para um elemento aleatório (sai do Físico).
      const armaDoGolpe = fichaBase.damage ?? { min: 1, max: 1 };
      const doFisico = ModsPoe.extrasDoFisico(fichaBase, [armaDoGolpe.min, armaDoGolpe.max]);
      for (const [el, [a, b]] of Object.entries(doFisico.extras)) extras[el] = [(extras[el]?.[0] ?? 0) + a, (extras[el]?.[1] ?? 0) + b];
      const fConv = 1 - doFisico.convertidoPct / 100;
      for (const [el, v] of Object.entries(GemasPoe.partesDoAtaque(daGemaPoe.slug, nivelPoe, { min: armaDoGolpe.min * fConv, max: armaDoGolpe.max * fConv }, extras))) somar(el, v);
    } else {
      const daMagia = GemasPoe.partesDaMagia(daGemaPoe.slug, nivelPoe);
      for (const [el, v] of Object.entries(daMagia)) somar(el, v);
      for (const el of Object.keys(daMagia)) somar(el, fichaBase.danoSomadoMagia?.[el] ?? [0, 0]);
      for (const [el, v] of Object.entries(doSuporte)) somar(el, v, eficacia);
    }
    // PoE (únicos): as conversões entre elementos, os ganhos extras e a máscara de dano ("Não Causa Dano Elemental"…).
    porElemento = ModsPoe.transformarPartes(fichaBase, porElemento);
    if (!porElemento || !Object.keys(porElemento).length) porElemento = null;
  }
  const somaDe = (i) => Object.values(porElemento).reduce((t, v) => t + v[i], 0);
  const min = porElemento ? Math.max(1, Math.round(somaDe(0))) : Math.max(1, Math.round(doNivel.min * fatorDaFicha + somadoMin + doSuporteMin));
  const max = porElemento ? Math.max(min, Math.round(somaDe(1))) : Math.max(min, Math.round(doNivel.max * fatorDaFicha + somadoMax + doSuporteMax));
  const mediaTotal = porElemento ? (somaDe(0) + somaDe(1)) / 2 : 0;
  const partes = porElemento && mediaTotal > 0 ? Object.entries(porElemento).map(([el, [a, b]]) => ({ elemento: el, min: a, max: b, frac: (a + b) / 2 / mediaTotal })) : null;
  // Gemas do Atelier: "+X% dano de <magia>" e "+X% dano crítico de <magia>" (supremos).
  const daGema = fichaBase.magiasDasGemas?.[entry.id];
  let ficha = daGema?.critico ? { ...fichaBase, critMultiplier: fichaBase.critMultiplier + daGema.critico / 100 } : fichaBase;
  if (ehMagia && fichaBase.critChanceMagia != null && fichaBase.critChanceMagia !== fichaBase.critChance) ficha = { ...ficha, critChance: fichaBase.critChanceMagia };
  // A magia do PoE: a chance-base é a da GEMA no nível (+ os "+% de chance" fixos) × os "aumentada" (geral e de magias), como no PoE.
  if (ehMagia && daGemaPoe && fichaBase.critMagiaPoe) {
    const daGema = GemasPoe.criticoBaseNoNivel(daGemaPoe.slug, nivelPoe) ?? 0;
    const cm = fichaBase.critMagiaPoe;
    ficha = { ...ficha, critChance: Math.min(1, Math.max(0, (daGema + cm.fixa) * (1 + cm.aumentada / 100) * (cm.mais ?? 1))), critBaseDaGema: daGema };
  }
  // (A proficiência de arma saiu — dono, 06/10: o "% da perícia como dano" e o crítico de runa dela não existem mais.)
  const daPericia = 0;
  // O treino em %: magic level (mágicas), melee (físicas de perto), distance (físicas de longe).
  const doTreino = defDaGema ? Gemas.bonusDoTreino(estado, defDaGema, fichaBase) : fichaBase.skillBonus?.magic ?? 0;
  // A gema: o crítico das supports soma na chance/dano; o nível e as supports multiplicam o dano.
  if (efeitoDaGema?.critChance || efeitoDaGema?.critDano) ficha = { ...ficha, critChance: ficha.critChance + (efeitoDaGema.critChance ?? 0) / 100, critMultiplier: ficha.critMultiplier + (efeitoDaGema.critDano ?? 0) / 100 };
  const fatorDaGema = (1 + (efeitoDaGema?.danoPct ?? 0) / 100) * (efeitoDaGema?.fatorDeDano ?? 1);
  // Os REFORÇOS ligados (posturas, raiva...): dano, crítico e treino nas skills com as tags deles.
  const tags = Tags.tagsDaAcao(entry);
  const hunt = estado.hunt;
  const doReforco = Reforcos.bonus(hunt, 'dano', tags);
  const critDoReforco = Reforcos.bonus(hunt, 'critChance', tags);
  const critDanoDoReforco = Reforcos.bonus(hunt, 'critDano', tags);
  if (critDoReforco || critDanoDoReforco) ficha = { ...ficha, critChance: ficha.critChance + critDoReforco / 100, critMultiplier: ficha.critMultiplier + critDanoDoReforco / 100 };
  const treino = doTreino * (1 + Reforcos.bonus(hunt, 'treino', tags) / 100) + (defDaGema ? Reforcos.treinoDeOutraPericia(estado, hunt, tags) * Gemas.CONFIG.dano.porMagicLevel : 0);
  // Sintonia da Dor (keystone do PoE): 30% mais dano mágico com a vida baixa (50% ou menos).
  const sintonia = ehMagia && (estado.hp ?? 0) <= 0.5 * (estado.maxHp ?? 0) && temHabilidade(estado, 'sintoniaDaDor') ? 1.3 : 1;
  // Gema do PoE (dono, 06/10: "o dano de fogo não aumenta pelo ataque físico" — como no PoE): cada skill só soma o "aumentado" do PRÓPRIO
  // tipo de dano; a afinidade de classe do Draevor não existe no PoE; e a Força só dá dano físico ao CORPO A CORPO.
  const doElemento = (ficha.danoDoElemento?.[entry.element] ?? 0) - (daGemaPoe && entry.element === 'physical' && !tags.includes('melee') ? ficha.danoFisicoDaForca ?? 0 : 0);
  const afinidade = entry.poeGema ? 0 : Ficha.afinidadePara(ficha, tags).pct;
  const mult = (1 + ((ficha.danoDeMagia ?? 0) + (ehMagia ? ficha.danoDeMagiaDoPoe ?? 0 : 0) + doElemento + (daGema?.dano ?? 0) + treino + doReforco + afinidade) / 100) * sintonia;
  // O multiplicador de CADA elemento da gema do PoE: o mesmo `mult`, trocando o "aumentado" do elemento da skill pelo da parte.
  const doElementoDe = (el) => (ficha.danoDoElemento?.[el] ?? 0) - (el === 'physical' && !tags.includes('melee') ? ficha.danoFisicoDaForca ?? 0 : 0);
  if (partes) for (const p of partes) p.mult = mult + ((doElementoDe(p.elemento) - doElemento) / 100) * sintonia;
  // "X% mais Dano por cada tipo de Afecção Elemental no Inimigo" (Acerto Elemental do Espectro).
  const porAfeccao = daGemaPoe ? GemasPoe.extrasDoAtaque(daGemaPoe.slug, nivelPoe, efeitoDaGema?.qualidade ?? 0).porAfeccao : 0;
  return { min, max, daPericia, mult, fatorDaGema, ficha, partes, porAfeccao, ehMagia };
}

/** O dano que a skill causa agora, por acerto (sem crítico nem resistência): o que o balão mostra. */
export function danoMostrado(estado, entry, efeitoDaGema = Gemas.ehSkillDeGema(entry) ? Gemas.efeitoNaSkill(estado, entry.id) : null) {
  const c = contaDoDano(estado, entry, efeitoDaGema);
  const f = c.mult * c.fatorDaGema;
  return { min: Math.round((c.min + c.daPericia) * f), max: Math.round((c.max + c.daPericia) * f) };
}

/**
 * ---- A CURA de uma skill de cura, numa conta só (o `disparar` e o balão) ----
 * Base pelo level + a perícia; × (Cura de magia dos afixos, supremo da gema,
 * magic level em %, nível/raridade/qualidade da gema e Potent Healing).
 * (A árvore — Graça, Fonte viva — entra depois, no `disparar`: depende do momento.)
 */
function contaDaCura(estado, entry, efeitoDaGema) {
  const { min, max } = danoNoLevel(entry, estado.level);
  const f = Ficha.combate(estado);
  const def = Gemas.defDaGema(Gemas.ITEM_DA_ACAO.get(entry.id));
  const pericia = 0; // a proficiência de arma (que dava "% da perícia como cura") saiu
  const tags = Tags.tagsDaAcao(entry);
  // O treino (ML) × os reforços de treino + o ML que vem de outra perícia (Divine Defiance).
  const doTreino = (def ? Gemas.bonusDoTreino(estado, def, f) : f.skillBonus?.magic ?? 0) * (1 + Reforcos.bonus(estado.hunt, 'treino', tags) / 100) + (def ? Reforcos.treinoDeOutraPericia(estado, estado.hunt, tags) * Gemas.CONFIG.dano.porMagicLevel : 0);
  const mult = (1 + ((f.curaDeMagia ?? 0) + (f.magiasDasGemas?.[entry.id]?.cura ?? 0) + doTreino + (efeitoDaGema?.curaPct ?? 0)) / 100) * (def?.fatorDeCura ?? 1);
  return { min, max, pericia, mult };
}

/** A cura que a skill faz agora (sem a árvore do momento): o que o balão mostra. */
export function curaMostrada(estado, entry, efeitoDaGema = Gemas.ehSkillDeGema(entry) ? Gemas.efeitoNaSkill(estado, entry.id) : null) {
  const c = contaDaCura(estado, entry, efeitoDaGema);
  return { min: Math.round((c.min + c.pericia) * c.mult), max: Math.round((c.max + c.pericia) * c.mult) };
}

/**
 * Os alvos de uma magia de CADEIA: começa no `alvo` e salta, a cada vez, para o bicho
 * vivo ainda não atingido mais perto do ÚLTIMO atingido, a até `distance` sqm, até
 * `targets` alvos (o alvo conta). Sem ninguém ao alcance do salto, a cadeia para.
 */
function saltosDaCadeia(alvo, vivos, { targets = 1, distance = 1 } = {}) {
  const atingidos = [alvo];
  const livres = vivos.filter((b) => b !== alvo);
  while (atingidos.length < targets && livres.length) {
    const ultimo = atingidos.at(-1);
    let k = -1;
    let perto = Infinity;
    livres.forEach((b, i) => {
      const d = distanciaChebyshev(ultimo, b);
      if (d <= distance && d < perto) {
        perto = d;
        k = i;
      }
    });
    if (k < 0) break;
    atingidos.push(livres.splice(k, 1)[0]);
  }
  return atingidos;
}

// Alcance de runa/magia sem `range` próprio (runas vêm com 7 do original).
const ALCANCE_PADRAO = 7;
// O efeito na tela da explosão das supports (Explosion, Impact) quando a skill não tem o dela (o `explosionhit` do client).
const EFEITO_DA_EXPLOSAO = 6;
const distanciaChebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/*
 * Exportado: `cacadas.mjs::round()` usa a MESMA tabela para o golpe básico de
 * wand/rod (o elemento vem do item, não de uma magia daqui) — uma cor por
 * elemento, um lugar só, em vez de duas tabelas que um dia vão discordar.
 */
export const COR_DO_ELEMENTO = {
  death: '#8f24c9', fire: '#ff9000', ice: '#4fc3ff', physical: '#ff0000',
  energy: '#c832ff', earth: '#7a5c2e', holy: '#ffe066',
};

/*
 * Por que ESTE personagem não pode usar a entrada, ou null.
 *
 * Nada bloqueia por classe (modelo Path of Exile, decisão do dono): a vocação
 * do catálogo virou a CLASSE RECOMENDADA (`Tags.classeRecomendada`). Ficam o
 * level e o magic level — o magic level baixo de um knight já é o limite
 * natural das magias fortes de sorcerer.
 */
function bloqueio(entry, estado) {
  // Magia e runa vêm da GEMA encaixada numa peça vestida (modelo Path of Exile): sem ela, sem skill.
  if (Gemas.ehSkillDeGema(entry) && !Gemas.temSkill(estado, entry.id)) return 'sem a gema';
  // Gema do PoE sem equivalente no jogo (lacaio, totem...): o motivo (`itens-poe/gemas-poe.mjs`).
  if (entry.poeGema?.bloqueio) return entry.poeGema.bloqueio;
  // A skill de gema não tem level nem magic level próprios (decisão do dono): quem pede level é o NÍVEL da gema.
  if (Gemas.ehSkillDeGema(entry)) return null;
  if ((entry.level ?? 0) > (estado.level ?? 0)) return `requer level ${entry.level}`;
  const ml = estado.magic?.value ?? 0;
  // No PoE não há magic level (nem perícia nenhuma): a magia pede só o level.
  if (!itensPoeLigado() && (entry.magicLevel ?? 0) > ml) return `requer magic level ${entry.magicLevel}`;
  return null;
}

/**
 * ---- O fim da CONJURAÇÃO (chamado a cada tique da caçada) ----
 * Chegou a hora: a skill sai (o `disparar` de novo, com `concluir`, revalidando
 * alvo, alcance, mana). Antes disso, cancela se o alvo morreu/sumiu, se o slot
 * mudou ou se o personagem caiu. Devolve os eventos.
 */
export function concluirConjuracao(estado, hunt, personagem) {
  const c = hunt?.conjurando;
  if (!c) return [];
  const alvo = c.alvo != null ? hunt.monstros.find((b) => b.uid === c.alvo && b.hp > 0) ?? null : null;
  const cancelar = (motivo) => {
    hunt.conjurando = null;
    // O cooldown global começou no INÍCIO da conjuração: se ela não saiu (alvo morreu,
    // barra mudou...), ele volta a ser o de antes — a magia seguinte não paga por esta.
    if ('globalAntes' in c) hunt.ultimoAtaqueEm = c.globalAntes;
    return [{ t: 'castCancel', uid: 'player', quem: personagem?.nome, motivo }];
  };
  if ((estado.hp ?? 0) <= 0) return cancelar('morreu');
  if (estado.actions?.[c.slot]?.id !== c.id) return cancelar('a barra mudou');
  if (c.alvo != null && !alvo) return cancelar('o alvo sumiu');
  // Relógio lógico (`R.liberou`): nunca antes do fim; e a magia conta a partir do `fim`, não do tique.
  if (!R.liberou(hunt.clock ?? 0, c.fim)) return [];
  const r = disparar(estado, hunt, personagem, c.slot, alvo, { concluir: true, mira: c.mira ?? null });
  hunt.conjurando = null;
  if (!r.ok) return cancelar(r.erro ?? 'não saiu');
  return [{ t: 'castFim', uid: 'player', quem: personagem?.nome }, ...(r.eventos ?? [])];
}

/** A origem do dano base de uma gema de ataque, para o balão: a família da arma e de onde sai a base (o dano normal da ficha, ou o Magic Attack da wand/rod). */
function armaDoDano(estado, entry) {
  const def = Gemas.defDaGema(Gemas.ITEM_DA_ACAO.get(entry.id));
  const p = Poder.poderEfetivo(estado, Gemas.habilidadeDeEscala(def), entry.element);
  const normal = Ficha.combate(estado).damage;
  return { familia: p.familia, poder: Math.round(p.poder), pelaFicha: true, danoNormal: { min: normal.min, max: normal.max } };
}

/** `send({t:'actions'})` — o catálogo inteiro, como o original: cada entrada com seu `blocked`. */
export function catalogo(estado) {
  const ficha = Ficha.combate(estado);
  const global = intervaloGlobal(estado);
  const ativas = Gemas.skillsAtivas(estado);
  // A gema da skill (nível, XP, supports ligadas, o efeito somado e o tempo de conjuração) — o balão mostra.
  const daGema = (entry) => {
    const a = ativas.get(entry.id);
    if (!a) return null;
    return {
      itemId: a.itemId,
      nivel: a.nivel,
      xp: a.xp,
      xpProximo: Gemas.xpProximoDaGema(a.def, a.nivelBase ?? a.nivel, estado.level),
      // A gema do PoE espera o level do personagem para o próximo nível (o `RequerNível` da tabela dela).
      levelDoProximo: Gemas.levelDoNivel(a.def, (a.nivelBase ?? a.nivel) + 1),
      esperaLevel: (estado.level ?? 1) < Gemas.levelDoNivel(a.def, (a.nivelBase ?? a.nivel) + 1),
      raridade: a.raridade,
      multiplicador: Gemas.multiplicadorDaRaridade(a.raridade),
      supports: a.supports.map((sp) => ({ nome: sp.def.nome, nomePt: sp.def.nomePt ?? sp.def.nome, nivel: sp.nivel })),
      efeito: Gemas.efeitoNaSkill(estado, entry.id, ativas),
      castTime: Gemas.tempoDeConjuracao(estado, entry.id, ficha.castSpeed, ativas),
    };
  };
  const comBloqueio = (entry) => ({
    ...entry,
    ...(Gemas.ehSkillDeGema(entry) ? { gema: daGema(entry) } : {}),
    // O tooltip do BUFF (reforço): o que faz, com os números desta gema, a duração e quem é afetado (`Reforcos.descrever`).
    // A gema do PoE: a ficha dela no nível (o balão e o "Configurar ação" mostram como no PoE, no lugar da ficha do Draevor).
    // A magia ligada a um suporte de gatilho (só sai pelo gatilho).
    ...(entry.poeGema && Gemas.ativadaPor(estado, entry.id) ? { ativadaPor: Gemas.ativadaPor(estado, entry.id) } : {}),
    ...(entry.poeGema ? { poeFicha: GemasPoe.fichaNoNivel(entry.poeGema.slug, daGema(entry)?.nivel ?? 1, daGema(entry)?.efeito?.qualidade ?? 0) } : {}),
    ...(Reforcos.REFORCOS[entry.id] ? { reforco: Reforcos.descrever(entry.id, daGema(entry)?.efeito ?? null) } : {}),
    // As tags (o que as especializações leem), a classe recomendada (não é trava) e a
    // afinidade DESTE personagem nesta skill — a mesma conta do `disparar` (`Ficha.afinidadePara`).
    tags: Tags.tagsDaAcao(entry),
    classeRecomendada: Tags.classeRecomendada(entry),
    afinidade: entry.poeGema ? { pct: 0, fontes: [] } : Ficha.afinidadePara(ficha, Tags.tagsDaAcao(entry)),
    // O dano/cura que ela faz AGORA (a mesma conta do `disparar`): base, treino, afinidade, gema, afixos.
    ...(entry.damage ? { damage: { ...entry.damage, ...(entry.kind === 'item' ? danoNoLevel(entry, estado.level) : entry.heals ? curaMostrada(estado, entry) : danoMostrado(estado, entry)) } } : {}),
    // Para a tooltip da gema: o dano/cura SEM o bônus da gema (nível, raridade, qualidade, supports) e a skill que escala — igual com a gema solta ou equipada.
    ...(Gemas.ehSkillDeGema(entry) && entry.damage && entry.kind !== 'item' ? { danoBase: entry.heals ? curaMostrada(estado, entry, null) : danoMostrado(estado, entry, null), escalaCom: Gemas.habilidadeDeEscala(Gemas.defDaGema(Gemas.ITEM_DA_ACAO.get(entry.id))) } : {}),
    // A ARMA como fonte do dano (só gema de ataque): a família dela, a afinidade com esta habilidade e o poder efetivo — o balão mostra o que a fórmula usa.
    ...(Gemas.ehSkillDeGema(entry) && entry.damage && !entry.heals ? { armaDoDano: armaDoDano(estado, entry) } : {}),
    // Skill de gema: sem level nem magic level exigidos (qualquer um usa qualquer gema). `levelDaMagia`: o de antes, só informativo.
    ...(Gemas.ehSkillDeGema(entry) ? { level: 1, magicLevel: 0, levelDaMagia: entry.level ?? 1 } : {}),
    // A recarga que o servidor aplica de verdade (`recargaDe`: ataque na
    // metade), não a crua do catálogo — senão o tooltip diz 2 s e sai a cada 1 s.
    ...(entry.kind !== 'item' && (entry.mana || entry.poeGema) ? { mana: custoDaSkill(entry, daGema(entry)?.efeito ?? null) } : {}),
    // Gema do PoE: os tempos do PoE com a ficha (`temposDaGemaPoe`) — o balão mostra o tempo de uso e a recarga de verdade.
    ...(entry.poeGema ? (() => { const t = temposDaGemaPoe(estado, entry, daGema(entry)?.efeito ?? null, ficha); return { cooldown: t.recarga, groupCooldown: t.uso, tempoPoe: t }; })() : {}),
    ...(entry.cooldown && !entry.poeGema ? { cooldown: recargaDe(entry, entry.cooldown) } : {}),
    // Ataque: o intervalo até a próxima magia de ataque é o cooldown global (com o Cast Speed), quando ele é maior.
    ...(entry.groupCooldown && !entry.poeGema ? { groupCooldown: entry.papeis?.[0] === 'attack' ? Math.max(recargaDe(entry, entry.groupCooldown), global) : recargaDe(entry, entry.groupCooldown) } : {}),
    blocked: bloqueio(entry, estado),
  });
  // Com as gemas do PoE ligadas, as magias que vão para a tela são só as das gemas do PoE ENCAIXADAS (são 562: mandar todas, com o dano
  // calculado, a cada pedido seria pesado — e a barra só mostra o que está encaixado). As do Draevor saem de cena no modo PoE.
  const soAsDoPoe = GemasPoe.ligadas();
  const vale = (e) => !soAsDoPoe || (e.poeGema ? ativas.has(e.id) : !Gemas.ehSkillDeGema(e));
  return {
    spells: ACTION_CATALOG.spells.filter(vale).map(comBloqueio),
    runes: ACTION_CATALOG.runes.filter(vale).map(comBloqueio),
    items: ACTION_CATALOG.items.map(comBloqueio),
    // O poder das armas: o fator da raridade (o balão multiplica o poder base do item) e a matriz de afinidade.
    poderDasArmas: { raridade: Poder.CONFIG.raridade, afinidade: Poder.CONFIG.afinidade },
    slots: SLOTS,
    slotsPorFileira: SLOTS_POR_FILEIRA,
    papeis: PAPEIS,
    papelDoSlot: PAPEL_DO_SLOT,
    // A barra do PoE: as vagas do cinto de frascos desenhadas antes das habilidades, nas teclas 1 a 5.
    frascos: FRASCOS_NA_BARRA,
    teclasDosFrascos: TECLAS_DOS_FRASCOS,
  };
}

/** `send({t:'actions', action:'set', slot, value})` — `value:null` esvazia o slot. */
export function definir(estado, { slot, value }) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS) return { ok: false, erro: 'Slot inválido.' };
  if (value == null) {
    (estado.actions ??= Array(SLOTS).fill(null))[slot] = null;
    return { ok: true };
  }
  const entry = POR_ID.get(value.id);
  if (!entry) return { ok: false, erro: 'Essa ação não existe.' };
  if (!cabeNoSlot(entry, slot)) return { ok: false, erro: `Esse slot só aceita ${PAPEIS[PAPEL_DO_SLOT[slot]].nome}.` };
  const motivo = bloqueio(entry, estado);
  if (motivo) return { ok: false, erro: `Não dá: ${motivo}.` };
  (estado.actions ??= Array(SLOTS).fill(null))[slot] = { id: entry.id, kind: entry.kind, ...configDoSlot(value) };
  return { ok: true };
}

const faixa = (v, min, max, padrao) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : padrao;
};
const texto = (v, max = 32) => String(v ?? '').trim().slice(0, max);
export const MAXIMO_DE_CONDICOES = 8;

/**
 * Uma condição do slot (e das regras de uso), limpa: o mesmo formato que a tela
 * grava, com os números como número e dentro da faixa. `null` se não é uma condição.
 */
export function sanearCondicao(c) {
  const r = sanearCondicaoSemSentido(c);
  // "Usar quando" (padrão) ou "Não usar quando" (`nao: true`).
  if (r && c.nao === true) r.nao = true;
  return r;
}
function sanearCondicaoSemSentido(c) {
  if (!c || typeof c !== 'object') return null;
  const kind = c.kind ?? 'stat';
  const op = (padrao) => (COMPARADORES.includes(c.op) ? c.op : padrao);
  if (kind === 'boss') return { kind, op: c.op === 'nao' ? 'nao' : 'sim' };
  if (kind === 'perto') {
    const r = { kind, op: op('gte'), value: faixa(c.value, 0, 25, 1) };
    if (r.op === 'entre') r.value2 = faixa(c.value2, 0, 25, r.value);
    return r;
  }
  if (kind === 'nome') return { kind, op: c.op === 'diferente' ? 'diferente' : 'igual', names: (Array.isArray(c.names) ? c.names : []).map((n) => texto(n, 40)).filter(Boolean).slice(0, 20) };
  if (kind !== 'stat') return null;
  const r = {
    kind,
    who: c.who === 'target' ? 'target' : 'self',
    stat: c.stat === 'mana' ? 'mana' : 'hp',
    op: op('lte'),
    value: Math.max(0, Number(c.value) || 0),
    percent: c.percent === true,
  };
  if (r.op === 'entre') r.value2 = Math.max(0, Number(c.value2 ?? c.value) || 0);
  return r;
}
const condicoes = (lista) => (Array.isArray(lista) ? lista : []).map(sanearCondicao).filter(Boolean).slice(0, MAXIMO_DE_CONDICOES);

/**
 * TUDO o que o "Configurar ação" grava no slot, limpo — cada campo da tela vale
 * no servidor (relato de jogador, 30/09: os de curar amigo, desafio, familiar e
 * escudo eram jogados fora aqui, e a mana mínima e o máximo de criaturas eram
 * gravados mas ninguém lia). Campo desconhecido não entra.
 */
function configDoSlot(v) {
  return {
    enabled: v.enabled !== false,
    minMana: faixa(v.minMana, 0, 100, 0),
    minTargets: faixa(v.minTargets, 1, MAX_ALVOS_DO_SLOT, 1),
    maxTargets: faixa(v.maxTargets, 0, MAX_ALVOS_DO_SLOT, 0),
    conditions: condicoes(v.conditions),
    // Curar amigo (exura sio e as runas de cura em outro): quem, e a partir de quanto de vida dele.
    curarQuem: ['eu', 'ferido', 'nome'].includes(v.curarQuem) ? v.curarQuem : 'eu',
    curarNome: texto(v.curarNome),
    curarAte: faixa(v.curarAte, 1, 100, 100),
    // Desafio (exeta res): por quem chamar, com quantos bichos em cima dele, e de quanto em quanto.
    desafiarQuem: ['perto', 'qualquer', 'nome'].includes(v.desafiarQuem) ? v.desafiarQuem : 'perto',
    desafiarNome: texto(v.desafiarNome),
    desafiarMinimo: faixa(v.desafiarMinimo, 1, 12, 1),
    desafiarCada: faixa(v.desafiarCada, 0, 600, 0),
    // As distâncias do familiar (lidas em `Summon.invocar`).
    summonPerto: faixa(v.summonPerto, 1, 5, 3),
    summonAlcance: faixa(v.summonAlcance, 1, 7, 3),
    // Utamo vita: quando o escudo sai sozinho (`tirarEscudoSePreciso`). Exana vita: só com o utamo pronto.
    tirarQuando: condicoes(v.tirarQuando),
    soComUtamoPronto: v.soComUtamoPronto === true,
  };
}

/**
 * ---- A barra segue as GEMAS encaixadas (decisão do dono, 30/09) ----
 * Equipamento → sockets → gemas → skills ativas → barra: a skill cuja gema
 * saiu (tirada do socket, peça desvestida) sai do slot; a gema nova encaixada
 * entra sozinha no primeiro slot livre do papel dela (ataque, cura, suporte...).
 * Poções e itens não são de gema: ficam como estão. Devolve se mudou algo.
 */
export function sincronizarBarraComGemas(estado) {
  const ativas = Gemas.skillsAtivas(estado);
  const acoes = (estado.actions ??= Array(SLOTS).fill(null));
  // A configuração da skill que saiu (condições, alvos, mana mínima) fica GUARDADA pelo id,
  // com o slot onde estava — e volta igual quando a gema volta (decisão do dono, 30/09).
  const guardadas = (estado.barraGuardada ??= {});
  let mudou = false;
  for (let slot = 0; slot < acoes.length; slot++) {
    const id = acoes[slot]?.id;
    if (id && Gemas.ITEM_DA_ACAO.has(id) && !ativas.has(id)) {
      guardadas[id] = { slot, action: acoes[slot] };
      acoes[slot] = null;
      mudou = true;
    }
  }
  const naBarra = new Set(acoes.filter(Boolean).map((a) => a.id));
  for (const id of ativas.keys()) {
    const entry = POR_ID.get(id);
    if (!entry || naBarra.has(id)) continue;
    const guardada = guardadas[id];
    // O slot de antes, se ainda está livre e é do papel dela; senão, o primeiro livre do papel.
    const antes = guardada && !acoes[guardada.slot] && cabeNoSlot(entry, guardada.slot) ? guardada.slot : -1;
    const slot = antes >= 0 ? antes : acoes.findIndex((a, i) => !a && cabeNoSlot(entry, i));
    if (slot >= 0 && definir(estado, { slot, value: guardada?.action ?? { id } }).ok) {
      delete guardadas[id];
      naBarra.add(id);
      mudou = true;
    }
  }
  return mudou;
}

/** `send({t:'actions', action:'key', slot, key})` — `key:null` tira a tecla. */
export function trocarTecla(estado, { slot, key }) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS) return { ok: false, erro: 'Slot inválido.' };
  if (key && TECLAS_DOS_FRASCOS.includes(String(key).toLowerCase())) return { ok: false, erro: `As teclas ${TECLAS_DOS_FRASCOS[0]} a ${TECLAS_DOS_FRASCOS.at(-1)} são dos frascos.` };
  (estado.hotkeys ??= Array(SLOTS).fill(null))[slot] = key ? String(key).toLowerCase() : null;
  return { ok: true };
}

/** `send({t:'actions', action:'swap', from, to})` — troca os dois slots (ação e tecla). */
export function trocar(estado, { from, to }) {
  if (![from, to].every((i) => Number.isInteger(i) && i >= 0 && i < SLOTS)) return { ok: false, erro: 'Slot inválido.' };
  const acoes = (estado.actions ??= Array(SLOTS).fill(null));
  const teclas = (estado.hotkeys ??= Array(SLOTS).fill(null));
  [acoes[from], acoes[to]] = [acoes[to], acoes[from]];
  [teclas[from], teclas[to]] = [teclas[to], teclas[from]];
  return { ok: true };
}

/** `send({t:'actionPreset', action:'save', name})` — guarda os slots+teclas atuais com um nome. */
export function salvarPreset(estado, { name }) {
  const nome = String(name ?? '').trim().slice(0, 24);
  if (!nome) return { ok: false, erro: 'Dê um nome ao conjunto.' };
  const presets = (estado.actionPresets ??= []);
  const existente = presets.find((p) => p.name === nome);
  const novo = { name: nome, actions: structuredClone(estado.actions ?? []), hotkeys: structuredClone(estado.hotkeys ?? []) };
  novo.slots = novo.actions.filter(Boolean).length;
  if (existente) Object.assign(existente, novo);
  else presets.push(novo);
  return { ok: true };
}

/** `send({t:'actionPreset', action:'apply', name})`. */
export function aplicarPreset(estado, { name }) {
  const preset = (estado.actionPresets ?? []).find((p) => p.name === name);
  if (!preset) return { ok: false, erro: 'Conjunto não existe mais.' };
  estado.actions = structuredClone(preset.actions);
  estado.hotkeys = structuredClone(preset.hotkeys);
  return { ok: true };
}

/** `send({t:'actionPreset', action:'delete', name})`. */
export function apagarPreset(estado, { name }) {
  estado.actionPresets = (estado.actionPresets ?? []).filter((p) => p.name !== name);
  return { ok: true };
}

/** O raio de "bichos por perto" — o mesmo das magias de suporte (`SEM_BICHO_POR_PERTO`). */
export const RAIO_DE_PERTO = 8;
/** O teto do "Mínimo/Máximo de criaturas" do slot (o `MAX_ALVOS` da tela). */
export const MAX_ALVOS_DO_SLOT = 25;
/** Na magia de ALVO ÚNICO, a faixa de criaturas conta quem está a até isto (a nota da tela: "a até 4 sqm"). */
export const RAIO_DA_FAIXA = 4;

/**
 * Uma condição do slot bate com o estado atual?
 *  - `kind:'stat'` (vida/mana, sua ou do alvo);
 *  - `kind:'nome'` (o nome da criatura mirada);
 *  - `kind:'perto'` (quantas criaturas vivas estão a até `RAIO_DE_PERTO` sqm — "inimigos ≥ 3 → área");
 *  - `kind:'boss'` (a hunt é a sala de um boss: `op:'sim'|'nao'`).
 * As duas últimas olham a hunt; sem ela (fora de caçada) não batem.
 */
function condicaoBate(condition, estado, alvo, hunt) {
  const bate = condicaoBateCrua(condition, estado, alvo, hunt);
  // "Não usar quando": a mesma condição, ao contrário.
  return condition.nao ? !bate : bate;
}

/** Os comparadores da tela: <, ≤, =, ≥, > e "entre" (`value`..`value2`, em qualquer ordem). */
export const COMPARADORES = ['lt', 'lte', 'eq', 'gte', 'gt', 'entre'];
function compara(op, v, a, b) {
  if (op === 'lt') return v < a;
  if (op === 'eq') return v === a;
  if (op === 'gte') return v >= a;
  if (op === 'gt') return v > a;
  if (op === 'entre') return v >= Math.min(a, b ?? a) && v <= Math.max(a, b ?? a);
  return v <= a;
}

function condicaoBateCrua(condition, estado, alvo, hunt) {
  if (condition.kind === 'nome') {
    if (!alvo) return false;
    const nome = String(alvo.name ?? '').toLowerCase();
    const bate = (condition.names ?? []).some((n) => String(n).toLowerCase() === nome);
    return condition.op === 'diferente' ? !bate : bate;
  }
  if (condition.kind === 'perto') {
    if (!hunt?.pos) return false;
    const n = (hunt.monstros ?? []).filter((b) => b.hp > 0 && distanciaChebyshev(hunt.pos, b) <= RAIO_DE_PERTO).length;
    return compara(condition.op ?? 'gte', n, Number(condition.value) || 0, Number(condition.value2) || 0);
  }
  if (condition.kind === 'boss') {
    if (!hunt) return false;
    return condition.op === 'nao' ? !hunt.isBoss : !!hunt.isBoss;
  }
  const sujeito = condition.who === 'target' ? alvo : estado;
  if (!sujeito) return false;
  // Bicho não tem mana: "Alvo · Mana" não bate (antes: "≤ X" batia sempre, com a mana lida como 0).
  if (condition.stat === 'mana' && !(sujeito.maxMana > 0)) return false;
  const atual = condition.stat === 'mana' ? sujeito.mana : sujeito.hp;
  const maximo = condition.stat === 'mana' ? sujeito.maxMana : sujeito.maxHp;
  // Em %, o número inteiro (é o que a tela mostra): "igual a 50%" bate de 49,5% a 50,49%.
  const valor = condition.percent ? Math.round((100 * (atual ?? 0)) / Math.max(1, maximo ?? 1)) : (atual ?? 0);
  return compara(condition.op ?? 'lte', valor, Number(condition.value) || 0, Number(condition.value2) || 0);
}

/** Cada condição da lista, agora: `[true, false, ...]` (o ✔/✖ do editor e do balão do slot). */
export const condicoesAgora = (lista, estado, alvo, hunt) => (lista ?? []).map((c) => condicaoBate(c, estado, alvo, hunt));

export function condicoesDoSlotBatem(action, estado, alvo, hunt = null) {
  return (action.conditions ?? []).every((c) => condicaoBate(c, estado, alvo, hunt));
}

/** Falta vida/mana suficiente para esta cura não ser jogada fora? */
function precisaDeCura(entry, estado, quem = estado) {
  const faltaHp = (quem.maxHp ?? 0) - (quem.hp ?? 0);
  const faltaMana = (quem.maxMana ?? 0) - (quem.mana ?? 0);
  const hp = entry.kind === 'item' ? entry.heal : entry.heals ? [danoNoLevel(entry, estado.level).min] : null;
  const mana = entry.kind === 'item' ? entry.mana : null;
  if (hp && faltaHp >= hp[0]) return true;
  if (mana && faltaMana >= mana[0]) return true;
  // Suporte/velocidade (haste, buffs) não "curam": deixa passar.
  return !hp && !mana;
}

/*
 * ---- Magia de suporte: dura, e só volta quando acaba ----
 *
 * No original a magia de suporte fica LIGADA por um tempo — o card com o
 * relógio acima da barra (`hunt.buffs`, `renderBuffsDaMagia` no hud.mjs) — e a
 * barra só lança de novo quando esse tempo acaba E a recarga já passou. O
 * catálogo real não traz a duração (só o comentário do client: "o magic
 * shield dura mais de três minutos"); estas são as durações do Tibia. `tipo`
 * é o que o client lê: 'shield' (o escudo na vida) e 'speed' (com `mult`, a
 * corrida na ficha).
 */
// A tabela vem dos DADOS (gamedata/gemas/reforcos.json): duração, tipo, velocidade e os efeitos de cada reforço.
const BUFFS = Reforcos.REFORCOS;

/** Os buffs ativos agora, no formato do client (`{icone, nome, resta, tipo, mult}`). */
export function buffsAtivos(hunt, estado = null) {
  const agora = hunt.clock ?? 0;
  const lista = [];
  for (const [id, b] of Object.entries(hunt.buffs ?? {})) {
    if (b.ate <= agora) continue;
    const entry = POR_ID.get(id);
    // `sk`: a skill do buff — o visual CONTÍNUO dela (a aura ligada) é desenhado no personagem enquanto dura (efeitos-visuais).
    // A aura que reserva não tem relógio: o cartão mostra quanto ela reserva (`reserva`).
    const reserva = b.reserva && estado ? { recurso: b.reserva.recurso, valor: Reserva.valor(estado, b.reserva), ...(b.reserva.pct ? { pct: b.reserva.pct } : {}) } : null;
    // (09/10) A aura/arauto/guarda do PoE: o ícone da HABILIDADE (o mesmo da barra).
    lista.push({ icone: entry?.icon ?? null, ...(entry?.poeGema?.iconeHabilidade ? { iconeHabilidade: entry.poeGema.iconeHabilidade } : {}), nome: entry?.name ?? id, resta: reserva ? 0 : b.ate - agora, tipo: b.tipo, sk: id, ...(b.mult ? { mult: b.mult } : {}), ...(reserva ? { reserva } : {}) });
  }
  return lista.sort((a, b) => (a.reserva ? 1 : 0) - (b.reserva ? 1 : 0) || a.resta - b.resta);
}

/**
 * A aura que reserva (`itens-poe/reserva.mjs`) fica ligada enquanto a gema estiver na barra, ligada no slot e encaixada: saiu de um dos
 * três, desliga (e a mana reservada volta a ser livre). Devolve true se alguma desligou (quem chama refaz a ficha).
 */
export function desligarAurasForaDaBarra(estado, hunt) {
  if (!Object.values(hunt?.buffs ?? {}).some((b) => b?.reserva)) return false;
  const ativas = Gemas.skillsAtivas(estado);
  return Reserva.desligarAsQueSairam(hunt, (id) => (estado.actions ?? []).some((a) => a?.id === id && a.enabled !== false) && ativas.has(id));
}

/**
 * As marcas da maldição com o "X% menos Efeito de Maldições Suportadas" da Blasfêmia (`efeitoMaldicaoPct`) e (09/10) o EFEITO das maldições
 * das peças: "Efeito das suas Maldições aumentado em X%" (`efeito_maldicao`) e o de UMA maldição ("Efeito da Maldição Flamabilidade
 * aumentado": `efeito_maldicao_gema:<gema>`) — os implícitos eldritch, influências e únicos. O resto como está.
 */
export function efeitosDaMaldicao(efeitos, efeitoDaGema, estado = null, entry = null) {
  const f = estado && itensPoeLigado() ? Ficha.combate(estado) : null;
  const nome = entry?.poeGema?.slug ? GemasPoe.doSlug(entry.poeGema.slug)?.gema?.nome : null;
  const dasPecas = f ? valorPoe(f, 'efeito_maldicao') + (nome ? valorPoe(f, `efeito_maldicao_gema:${slugDoNome(nome)}`) : 0) : 0;
  const pct = (Number(efeitoDaGema?.efeitoMaldicaoPct) || 0) + dasPecas;
  if (!pct) return efeitos;
  return efeitos.map((e) => (/^marca/.test(e.efeito) && typeof e.pct === 'number' ? { ...e, pct: e.pct * Math.max(0, 1 + pct / 100) } : e));
}

/** Um buff deste tipo está ligado? (o escudo, por exemplo — ver `contraAtaque`). */
export function temBuff(hunt, tipo) {
  const agora = hunt?.clock ?? 0;
  return Object.values(hunt?.buffs ?? {}).some((b) => b.tipo === tipo && b.ate > agora);
}

const sortear = (min, max) => min + Math.floor(Math.random() * Math.max(1, max - min + 1));

/*
 * ---- A recarga das magias de ataque no original: a METADE da do catálogo ----
 *
 * Medido nas duas capturas do Zoros (knight, Winter Dream Court, 5 min,
 * `captura-monstros-0924`): ele lança uma magia de ataque por segundo (mediana
 * 1,02 s entre elas) e relança cada uma na metade da recarga do catálogo —
 * Annihilation 30 s → 14,8 s; Groundshaker 8 s → 3,3 s; Fierce Berserk
 * 6 s → 2,8 s; Shield Bash 4 s → 2,0 s. O golpe básico continua a cada 2 s,
 * igual aqui: não é o relógio da caçada que anda em dobro, são as magias de
 * ataque. E ele não tem bônus de recarga nenhum (derived, árvore, gemas).
 *
 * Aqui a recarga do grupo era 2 s: só saía uma magia a cada 2 s, e da sexta
 * magia da barra para baixo nenhuma chegava a sair ("teste os slots de magia
 * de ataque ... verificando se todas estão sendo utilizadas").
 */
const FATOR_DA_RECARGA_DE_ATAQUE = 0.5;
const recargaDe = (entry, ms) => (entry.papeis?.[0] === 'attack' ? Math.round(ms * FATOR_DA_RECARGA_DE_ATAQUE) : ms);

/**
 * Os ALVOS da gema do PoE no nível dela (`GemasPoe.alvosNoNivel`) somados ao efeito dos suportes: projéteis adicionais e a divisão do
 * feixe (`alvosExtras`), perfuração, difusão, ricochetes do projétil (`encadear`) — e, na magia de CADEIA (o Arco), os saltos da cadeia
 * (`cadeiaPoe`: os da gema + os do suporte de corrente, com o "% mais dano por ricochete restante"), que não passam também pelos
 * golpes secundários (senão saltaria duas vezes).
 */
function comOsAlvosDaGema(entry, efeito, estado = null) {
  if (!entry.poeGema || entry.poeGema.buff || !efeito) return efeito;
  const a = GemasPoe.alvosNoNivel(entry.poeGema.slug, efeito.nivel ?? 1);
  const e = { ...efeito };
  // PoE: os das PEÇAS — "Habilidades disparam N Projéteis adicionais", "Ataques com Arco disparam N Flechas adicionais", "Gemas Encaixadas
  // atiram N Projéteis adicionais" (a peça da gema), "Projéteis Perfuram N Alvos" e a "Área de Efeito aumentada" (+1 casa a cada 25%; a
  // fração vira chance, para a média bater) — `itens-poe/mods-poe.mjs`.
  const dasPecas = estado ? ModsPoe.alvosDasPecas(estado, Ficha.combate(estado), entry, tagsPoeDaSkill(entry), Gemas.skillsAtivas(estado).get(entry.id)?.onde?.slot ?? null) : null;
  e.alvosExtras = (e.alvosExtras ?? 0) + a.projeteis + a.divide + (dasPecas?.projeteis ?? 0);
  e.perfurar = Math.max(e.perfurar ?? 0, a.perfurar) + (dasPecas?.perfurar ?? 0);
  if (dasPecas?.area) e.areaExtra = (e.areaExtra ?? 0) + dasPecas.area;
  // "Habilidades Ricocheteiam +N vezes": os ricochetes do projétil (os saltos da cadeia, na magia de cadeia).
  if (dasPecas?.ricochetes) e.encadear = (e.encadear ?? 0) + dasPecas.ricochetes;
  e.bifurcar = Math.max(e.bifurcar ?? 0, a.bifurcar);
  if (entry.cadeia) {
    e.cadeiaPoe = { saltos: a.saltos + (e.encadear ?? 0), pct: a.pctPorRestante };
    e.encadear = 0;
  } else e.encadear = (e.encadear ?? 0) + a.saltos;
  return e;
}

/** O personagem olha para `para` (0 norte, 1 leste, 2 sul, 3 oeste — o eixo de maior distância), se não está na mesma casa. */
export function virarParaOAlvo(hunt, para) {
  if (!hunt?.pos || !para || (para.x === hunt.pos.x && para.y === hunt.pos.y)) return;
  const dx = para.x - hunt.pos.x;
  const dy = para.y - hunt.pos.y;
  hunt.pos.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
}

/** A entrada do catálogo de ações pelo id (o totem do PoE usa a skill da gema dele). */
export const POR_ID_PUBLICO = (id) => POR_ID.get(id) ?? null;

/**
 * Invoca os LACAIOS (ou o TOTEM) de uma gema do PoE (`LacaiosPoe.oQueInvoca`: quantos por uso, o máximo, a duração, a força pelo nível
 * e os suportes): nascem na casa do dono (o primeiro passo deles sai para uma casa livre — `cacadas.tiqueDosLacaios`); passou do
 * máximo da gema, o mais velho sai. O totem fica parado e usa a skill da gema. Devolve os eventos (o efeito de invocação em cada um).
 */
let seqDeLacaio = 0;
function invocarLacaios(hunt, entry, efeito, alvo, estado = null) {
  const slug = entry.poeGema.slug;
  // (PoE: "usou uma Habilidade de Lacaio Recentemente".)
  ModsPoe.marcar(hunt, 'usouLacaio');
  const q = LacaiosPoe.oQueInvoca(slug, efeito?.nivel ?? 1, efeito, estado ? Ficha.combate(estado)?.afPoe ?? null : null);
  if (!q) return [];
  const agora = hunt.ultimoTique ?? Date.now();
  const eventos = [];
  hunt.lacaios ??= [];
  // A OFERENDA: o bônus em todos os lacaios em campo, pela duração dela.
  if (q.tipo === 'oferenda') {
    for (const l of hunt.lacaios) if (l.hp > 0 && l.tipo === 'lacaio') { l.oferenda = { ...q.bonus, ate: agora + q.duracaoMs }; eventos.push({ t: 'fx', id: 13, uid: l.uid, x: l.x, y: l.y, sk: entry.id }); }
    return eventos;
  }
  // A CONVOCAÇÃO: todos os lacaios para perto do dono (na casa dele: o próximo passo os espalha) e a cura.
  if (q.tipo === 'convocacao') {
    for (const l of hunt.lacaios) if (l.hp > 0 && l.tipo === 'lacaio') {
      l.x = hunt.pos.x;
      l.y = hunt.pos.y;
      l.hp = Math.min(l.maxHp, l.hp + l.maxHp * (q.curaPct / 100) * 4);
      eventos.push({ t: 'fx', id: 11, uid: l.uid, x: l.x, y: l.y, sk: entry.id });
    }
    return eventos;
  }
  for (let i = 0; i < q.porUso; i++) {
    const l = {
      uid: `lacaio:${Date.now().toString(36)}${(seqDeLacaio++).toString(36)}`, gema: slug, acao: entry.id, tipo: q.tipo, nome: q.nome, nivel: q.nivel,
      x: hunt.pos.x, y: hunt.pos.y, dir: hunt.pos.dir ?? 2, look: q.desenho.look, lookItem: q.desenho.lookItem ?? 0, colors: q.desenho.colors,
      hp: q.vida, maxHp: q.vida, dano: q.dano, elemento: q.elemento ?? 'physical', intervaloMs: q.intervaloMs, ate: q.duracaoMs ? agora + q.duracaoMs : null,
      // A IA do familiar (`cacadas`): perto do dono, batendo no alvo; o totem não anda e usa a skill a até `alcanceDeAtaque` casas.
      perto: 2, alcance: 0, alcanceDeAtaque: q.tipo === 'totem' ? Math.max(3, entry.range || 6) : Math.max(1, q.estilo?.alcance ?? 1), proximoGolpe: agora + 400, proximoPassoEm: 0,
      // As HABILIDADES próprias (`LacaiosPoe.oQueInvoca`): o jeito de atacar, a velocidade, o crítico, o dano adicionado, o sangramento e o
      // bônus do golem ao dono (enquanto ele vive — `GemasPoe.adds`).
      estilo: q.estilo ?? null, velAtaquePct: q.velAtaquePct ?? 0, critChance: q.critChance ?? 5, critMult: q.critMult ?? 1.5, somado: q.somado ?? [0, 0], sangrar: q.sangrar ?? 0,
      afDono: q.afDono ?? null, porLacaioFisico: q.porLacaioFisico ?? null, golem: !!q.golem, acertos: 0, poe: q.poe ?? null,
      ...(q.tipo === 'totem' && alvo ? { mira: { x: alvo.x, y: alvo.y } } : {}),
    };
    // O ESPECTRO (Erguer Espectro do PoE): ergue o ÚLTIMO CADÁVER da caçada (o tipo do bicho que morreu por último e que tem magias),
    // ou, sem cadáver, um bicho da área. Fica com o desenho e o nome dele e usa as MAGIAS dele (`cacadas.tiqueDosLacaios`).
    if (/spectre/i.test(GemasPoe.doSlug(slug)?.gema?.en ?? '')) {
      const temMagia = (k) => (Poderes.poderesDe(k)?.ataques ?? []).some((a) => a.tipo === 'magia');
      const corpo = [...(hunt.cadaveres ?? [])].reverse().find((c) => temMagia(c.key)) ?? hunt.monstros.find((m) => m.hp > 0 && temMagia(m.key)) ?? (hunt.cadaveres ?? []).at(-1) ?? hunt.monstros.find((m) => m.hp > 0 && !m.dummy) ?? null;
      if (corpo) {
        const p = Poderes.poderesDe(corpo.key);
        const maior = Math.max(1, ...(p?.ataques ?? []).map((a) => Math.max(a.min ?? 0, a.max ?? 0)));
        Object.assign(l, { look: corpo.look, lookItem: corpo.lookItem ?? 0, colors: corpo.colors ?? null, nome: `Espectro de ${corpo.nome ?? corpo.name}`,
          // As magias do monstro com o dano na força do espectro (o maior golpe dele vira 1,5× o golpe de um lacaio do nível).
          espectro: { key: corpo.key, fator: (l.dano.max * 1.5) / maior }, proximoPoder: {} });
      }
    }
    hunt.lacaios.push(l);
    eventos.push({ t: 'fx', id: 11, uid: l.uid, x: l.x, y: l.y, sk: entry.id });
  }
  // Passou do máximo da gema: os mais velhos saem.
  const desta = hunt.lacaios.filter((l) => l.gema === slug);
  for (const velho of desta.slice(0, Math.max(0, desta.length - q.maximo))) velho.hp = 0;
  // O golem dá bônus ao dono: a ficha muda.
  if (q.afDono || q.porLacaioFisico) hunt.lacaiosMudaramAFicha = true;
  return eventos;
}

/** As casas que a `forma` real da magia pega, centradas em (cx, cy). */
/*
 * Onda, feixe e varredura vêm na `forma` olhando para o NORTE (só casas com
 * y <= 0 — ver `AREA_WAVE6` da Front Sweep: [[-1,-1],[0,-1],[1,-1]]). Girar
 * para `dir` (0 norte, 1 leste, 2 sul, 3 oeste, o `dir` do personagem).
 */
// (A geometria é a compartilhada — `engine/areas.mjs`, a mesma que a tela usa.)
const direcional = (entry) => Areas.direcional(entry.forma);
const casasDaForma = (entry, cx, cy, dir = null) => Areas.daForma(entry.forma, { x: cx, y: cy }, dir);

/** Os 4 lados, começando pelo que aponta para o alvo (eixo dominante). */
function ordemDosLados(pos, alvo) {
  if (!alvo) return [0, 1, 2, 3];
  const dx = alvo.x - pos.x;
  const dy = alvo.y - pos.y;
  const primeiro = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
  return [primeiro, ...[0, 1, 2, 3].filter((d) => d !== primeiro)];
}

/*
 * ---- A poção, pela barra OU pela mochila: as mesmas regras ----
 *
 * A barra (`disparar`) sempre conferiu level e vocação, a recarga e se a
 * poção não seria jogada fora. O uso pela mochila (botão direito / toque longo,
 * `Inventario.usar`) tinha uma cópia própria que só olhava a vocação: um
 * knight level 100 bebia a supreme health potion (level 200), a mesma poção
 * saía duas vezes no mesmo instante (somando com a da barra, na caçada) e era
 * gasta com a vida cheia. Agora a mochila passa por aqui, com as funções que a
 * barra já usa.
 *
 * Recarga: 1 s da própria poção e 1 s para TODAS as poções (vida e mana não
 * saem no mesmo instante, como no Tibia) — os valores que `disparar` já
 * aplicava. Ela mora no relógio da caçada; fora dela não há recarga (a barra
 * também só funciona caçando).
 */
export const RECARGA_DA_POCAO_MS = 1000;
const GRUPO_DAS_POCOES = 'grupo:item';

/** Dá para beber `entry` (uma poção do catálogo) agora? `{ok}` ou `{ok:false, erro, motivo}`. */
export function podeBeberPocao(estado, entry) {
  const motivo = bloqueio(entry, estado);
  if (motivo) return { ok: false, erro: `Não dá: ${motivo}.`, motivo: 'BLOQUEADA' };
  const hunt = estado.hunt;
  if (hunt) {
    const agora = hunt.clock ?? 0;
    for (const chave of [entry.id, GRUPO_DAS_POCOES]) {
      const cd = hunt.cooldowns?.[chave];
      if (cd && !R.liberou(agora, cd.ate)) return { ok: false, erro: 'Ainda recarregando.', motivo: chave === entry.id ? 'COOLDOWN' : 'COOLDOWN_DO_GRUPO', faltaMs: cd.ate - agora };
    }
  }
  if (!precisaDeCura(entry, estado)) return { ok: false, erro: 'Não precisa agora.', motivo: 'NAO_PRECISA' };
  return { ok: true };
}

/** Bebeu: liga a recarga da poção e a de todas as poções (só na caçada). */
export function marcarRecargaDaPocao(estado, entry) {
  const hunt = estado.hunt;
  if (!hunt) return;
  const cds = (hunt.cooldowns ??= {});
  // Relógio lógico: conta do instante em que ela PODIA sair (se caiu dentro do último tique).
  const agora = R.instanteLogico(hunt.clock ?? 0, hunt.relogioAnterior, [cds[entry.id]?.ate, cds[GRUPO_DAS_POCOES]?.ate]);
  const propria = recargaDe(entry, entry.cooldown ?? RECARGA_DA_POCAO_MS);
  cds[entry.id] = { ate: agora + propria, total: propria };
  cds[GRUPO_DAS_POCOES] = { ate: agora + RECARGA_DA_POCAO_MS, total: RECARGA_DA_POCAO_MS };
}

/**
 * Dispara UM slot — do loop automático (`cacadas.mjs::tique`) ou de um
 * `huntAction` manual. `alvo`/`hunt` vêm de quem chamou (evita import
 * circular com `cacadas.mjs`, que já sabe escolher o alvo com `alvoAtual`).
 * Devolve `{ok, erro?}` e, em caso de sucesso, `eventos` (mesmo formato de
 * `round()`) e `alvo` (se o golpe foi nele — quem chamou decide matar ou não).
 */
/**
 * Os TEMPOS de uma gema do PoE agora, como no PoE (sem o cooldown global nem a "metade da recarga" do Draevor):
 *  - `uso`: magia = o tempo de conjuração × os suportes ÷ a velocidade de conjuração; ataque = o intervalo do golpe da arma (APS, velocidade
 *    de ataque) ÷ a velocidade da gema ("X% de base"). É o tempo até a próxima skill (um uso por vez); instantânea: 0,25 s (um tique).
 *  - `recarga`: só a da gema no PoE ("Recarga: N seg"), com a recuperação de recarga e os suportes; 0 = sem recarga.
 */
export function temposDaGemaPoe(estado, entry, efeitoDaGema = Gemas.efeitoNaSkill(estado, entry.id), ficha = Ficha.combate(estado)) {
  const t = GemasPoe.temposNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1);
  const suportes = 1 + (efeitoDaGema?.castTimePct ?? 0) / 100;
  const ataque = !!entry.poeGema.ataque;
  // PoE: a velocidade de conjuração / a recuperação de recarga "com Habilidades de Fogo", "de Movimento", "do Totem"… (pelas tags da gema).
  const porTag = ModsPoe.somaPorTags(ficha, tagsPoeDaSkill(entry));
  const castSpeed = (ficha.castSpeed ?? 0) + (porTag.cast_speed_tag ?? 0);
  const bruto = ataque ? ((ficha.intervaloDoGolpeMs ?? 2000) / (t.velAtaqueBase / 100)) * suportes : (t.conjuracaoMs * suportes) / (1 + Math.max(0, castSpeed) / 100);
  const recarga = t.recargaMs ? Math.round((t.recargaMs / Math.max(0.1, 1 + ((ficha.recuperacaoDeRecarga ?? 0) + (porTag.cooldown_recovery ?? 0)) / 100)) * (1 + (efeitoDaGema?.recargaPct ?? 0) / 100)) : 0;
  return { uso: Math.max(250, Math.round(bruto)), recarga, ataque, conjuracaoBaseMs: t.conjuracaoMs, velAtaqueBase: t.velAtaqueBase, cargas: t.cargas };
}

/** O cooldown global com `castSpeed`% de Cast Speed: a base (`R.GLOBAL_SPELL_COOLDOWN`) encurtada por ele (decisão do dono). */
export const intervaloGlobalCom = (castSpeed = 0) => Math.round(R.GLOBAL_SPELL_COOLDOWN / (1 + Math.max(0, castSpeed ?? 0) / 100));
/** O cooldown global de AGORA para este personagem. */
export const intervaloGlobal = (estado) => intervaloGlobalCom(Ficha.combate(estado).castSpeed);

export function disparar(estado, hunt, personagem, slot, alvo, opcoes) {
  // Congelado ou atordoado (controle de boss/elite, `combate/controle.mjs`): nada sai.
  if (!Controle.podeAgir(hunt, hunt?.clock ?? 0)) return { ok: false, erro: 'Você está paralisado.', motivo: 'CONTROLE' };
  const r = dispararSemMarcar(estado, hunt, personagem, slot, alvo, opcoes);
  marcarParado(hunt, slot, r);
  return r;
}

/*
 * ---- POR QUE o slot não saiu (o "parado: ..." do balão) ----
 * Relato: o jogador não tinha como saber qual regra segurava a magia. Cada
 * tentativa que falha grava o motivo em `hunt.parados[slot]` (vai para a tela
 * pela `visaoDaHunt`); a que sai apaga. Recarga, intervalo do combo e
 * conjuração não contam: o leque do slot já mostra isso.
 */
const MOTIVOS_DE_RELOGIO = new Set(['COOLDOWN', 'COOLDOWN_DO_GRUPO', 'COOLDOWN_GLOBAL', 'CONJURANDO', 'VAZIO']);
export function marcarParado(hunt, slot, resultado) {
  if (!hunt) return;
  const p = (hunt.parados ??= {});
  if (resultado?.ok || MOTIVOS_DE_RELOGIO.has(resultado?.motivo)) delete p[slot];
  else p[slot] = { motivo: resultado?.motivo ?? null, texto: resultado?.erro ?? '', em: hunt.clock ?? 0 };
}
/** O resultado de "condição não bate", dizendo QUAL (a 1ª que não bate, contando de 1). */
export function falhaDaCondicao(action, estado, alvo, hunt) {
  const i = condicoesAgora(action.conditions, estado, alvo, hunt).indexOf(false);
  return { ok: false, erro: `A condição ${i + 1} não bate.`, motivo: 'CONDICAO', condicao: i };
}
/** Os motivos de agora para a tela (só os recentes: um motivo velho não segura nada). */
export function paradosParaCliente(hunt) {
  const agora = hunt.clock ?? 0;
  return Object.fromEntries(Object.entries(hunt.parados ?? {}).filter(([, p]) => agora - (p.em ?? 0) <= 3000).map(([slot, p]) => [slot, { motivo: p.motivo, texto: p.texto }]));
}
/** O ✔/✖ de cada condição de cada slot, agora (`{slot: {conditions, tirarQuando}}`). */
export function condicoesParaCliente(estado, hunt, alvo) {
  const r = {};
  (estado.actions ?? []).forEach((a, slot) => {
    if (!a?.conditions?.length && !a?.tirarQuando?.length) return;
    r[slot] = { conditions: condicoesAgora(a.conditions, estado, alvo, hunt), tirarQuando: condicoesAgora(a.tirarQuando, estado, alvo, hunt) };
  });
  return r;
}

function dispararSemMarcar(estado, hunt, personagem, slot, alvo, { concluir = false, mira = null, gatilho = null } = {}) {
  // Morto não lança nada (o clique manual chegava aqui entre o golpe e o fim da caçada).
  if ((estado.hp ?? 0) <= 0) return { ok: false, erro: 'Você está morto.', motivo: 'MORTO' };
  // Conjurando outra skill: nada mais sai até ela terminar (ou cancelar) — ver `concluirConjuracao`.
  if (hunt.conjurando && !concluir && !gatilho) return { ok: false, erro: 'Conjurando.', motivo: 'CONJURANDO' };
  // `gatilho`: a magia ATIVADA por um suporte de gatilho do PoE (`ativarGatilhos`) — instantânea, fora da barra, sem o relógio de uso
  // (uma ação por vez) nem as condições do slot; respeita a recarga própria e paga o custo.
  const action = gatilho ? gatilho.acao : estado.actions?.[slot];
  if (!action?.id) return { ok: false, erro: 'Esse slot está vazio.', motivo: 'VAZIO' };
  if (action.enabled === false) return { ok: false, erro: 'Esse slot está desligado.', motivo: 'DESLIGADA' };
  const entry = POR_ID.get(action.id);
  if (!entry) return { ok: false, erro: 'Ação desconhecida.', motivo: 'DESCONHECIDA' };
  // Defesa em profundidade: `definir()` já recusa vocação/level errados ao
  // configurar o slot, mas um arranjo salvo (`actionPresets`) antes de um
  // level up, por exemplo, não passa por ali de novo.
  if (bloqueio(entry, estado)) return { ok: false, erro: 'Você não pode mais usar isso.', motivo: 'BLOQUEADA' };
  // A magia ligada a um suporte de gatilho só sai pelo gatilho (como no PoE: não se conjura à mão).
  if (!gatilho && entry.poeGema && Gemas.ativadaPor(estado, entry.id)) return { ok: false, erro: `Ativada por ${Gemas.ativadaPor(estado, entry.id)}.`, motivo: 'ATIVADA_POR_GATILHO' };
  // A habilidade que um ÚNICO ativa ("Ativa X quando…"): só sai pelo evento, como no PoE.
  if (!gatilho && entry.poeGema && Gemas.skillsAtivas(estado).get(entry.id)?.ativadaPorItem) return { ok: false, erro: 'Ativada pelo item.', motivo: 'ATIVADA_POR_GATILHO' };

  const agora = hunt.clock ?? 0;
  const cds = (hunt.cooldowns ??= {});
  const cd = cds[action.id];
  /*
   * ---- O cooldown global (R.GLOBAL_SPELL_COOLDOWN) ----
   *
   * Entre o INÍCIO da última skill de ataque e o desta, no mínimo o cooldown
   * global (`hunt.ultimoAtaqueEm`, gravado quando ela começou: a conjuração
   * corre DENTRO do global — antes ela somava, e "2 s" eram 2,5 s). Vale para o
   * loop automático e para o clique/tecla, que passam os dois por aqui: o
   * servidor é quem decide, e uma magia por vez. Relógio lógico (`R.liberou`,
   * `R.instanteLogico`): nunca antes do instante, e contado de quando podia sair.
   * A conclusão de uma conjuração (`concluir`) não confere de novo: o global
   * dela começou no início.
   */
  const deAtaque = entry.papeis?.[0] === 'attack';
  const global = intervaloGlobal(estado);
  // A gema do PoE não tem o cooldown global do Draevor: o tempo de uso dela (conjuração/ataque) é o que segura a próxima.
  const globalLibera = deAtaque && !entry.poeGema && hunt.ultimoAtaqueEm != null ? hunt.ultimoAtaqueEm + global : null;
  if (!concluir && globalLibera != null && !R.liberou(agora, globalLibera)) {
    return { ok: false, erro: 'Aguarde o cooldown global.', motivo: 'COOLDOWN_GLOBAL', faltaMs: globalLibera - agora };
  }
  if (cd && !R.liberou(agora, cd.ate)) return { ok: false, erro: 'Ainda recarregando.', motivo: 'COOLDOWN', faltaMs: cd.ate - agora };
  const grupo = `grupo:${entry.group ?? entry.kind}`;
  // Magias: recarga do grupo (attack/healing/support). Poções: uma recarga só
  // para todas, como no Tibia (vida e mana não saem no mesmo instante). Runa
  // de ATAQUE divide a recarga do grupo com as magias de ataque, como no Tibia:
  // antes ela saía junto, em paralelo, e as três runas de uma barra de knight
  // davam 215 golpes cada em 10 min por cima das magias (sem captura de runa no
  // original para conferir — é a regra do Tibia). Runa de cura continua livre.
  const grupoDeAtaque = entry.kind === 'rune' && entry.papeis?.[0] === 'attack' ? 'grupo:attack' : null;
  // Gema do PoE: uma ação por vez entre TODAS as skills (ataque, magia, aura...) — um relógio só, o tempo de uso da última.
  const grupoQueConta = entry.poeGema ? 'grupo:poe' : grupoDeAtaque ?? (entry.kind !== 'rune' ? grupo : null);
  if (!gatilho && grupoQueConta && cds[grupoQueConta] && !R.liberou(agora, cds[grupoQueConta].ate)) {
    return { ok: false, erro: 'Ainda recarregando.', motivo: 'COOLDOWN_DO_GRUPO', faltaMs: cds[grupoQueConta].ate - agora };
  }
  // O instante LÓGICO desta execução: o de quando ela podia sair, se caiu dentro do último tique
  // (`R.instanteLogico`) — é dele que o global, a recarga e o grupo contam. Numa conjuração, o
  // INÍCIO dela (critério único: global e recargas contam do mesmo instante — "recarga de 5 s" são
  // 5 s de um lançamento ao outro; contando do fim, uma de 4 s com 400 ms de conjuração virava 6 s).
  const inicio = concluir
    ? Math.min(agora, hunt.conjurando?.inicio ?? agora)
    : R.instanteLogico(agora, hunt.relogioAnterior, [globalLibera, cd?.ate, grupoQueConta ? cds[grupoQueConta]?.ate : null]);
  // A gema da skill: o nível dela e as supports ligadas (`skills/gemas.mjs`) — custo, dano, crítico, alvos, cura, recarga.
  const efeitoDaGema = comOsAlvosDaGema(entry, Gemas.ehSkillDeGema(entry) ? Gemas.efeitoNaSkill(estado, entry.id) : null, estado);
  // "Custo de mana das magias" da árvore (−1,8% = mais barata) e o Mana Efficiency da gema.
  // (PoE: ÷ a "Eficiência de custo de mana" das peças.)
  // (A habilidade ativada por um ÚNICO não tem custo, como no PoE.)
  // (PoE: × "Custo de Mana das Habilidades aumentado/reduzido" e + "N ao Custo de Mana Total" dos únicos.)
  const fichaDoCusto = Ficha.combate(estado);
  /*
   * ---- A aura do PoE que RESERVA (dono, 08/10 — `itens-poe/reserva.mjs`) ----
   * Não custa: LIGA, trancando a % da mana máxima (ou o valor fixo) enquanto estiver na barra — se couber na parte livre. Com o suporte
   * que reserva Vida ou o Magia Sanguínea, a reserva sai da vida.
   */
  const reservaEmVida = !!efeitoDaGema?.custoEmVida || temHabilidade(estado, 'magiaSanguinea') || ModsPoe.valor(fichaDoCusto, 'keystone_magia_sanguinea') > 0;
  const reserva = Reserva.pedida(estado, entry, efeitoDaGema, fichaDoCusto, reservaEmVida);
  if (reserva && !Reserva.cabe(estado, entry.id, reserva)) {
    return { ok: false, erro: `Sem ${reserva.recurso} livre para reservar: ${entry.name} reserva ${reserva.valor}.`, motivo: 'RESERVA' };
  }
  // (A MINA do PoE reserva mana enquanto está armada — no jogo, a reserva dela é o custo de cada uma: a Eficácia da Reserva de mana, a geral
  // e a "das Habilidades que arremessam Minas" o reduzem.)
  const eficaciaDaMina = entry.poeGema?.arquetipo === 'mina' ? ModsPoe.valor(fichaDoCusto, 'eficiencia_reserva') + ModsPoe.valor(fichaDoCusto, 'eficiencia_reserva_mana') + ModsPoe.valor(fichaDoCusto, 'eficiencia_reserva_minas') : 0;
  const custoDeMana = entry.kind === 'item' || gatilho?.semCusto || reserva ? 0 : Math.max(0, Math.round((custoDaSkill(entry, efeitoDaGema) * (1 + (fichaDoCusto.custoDeMana ?? 0)) * (1 + (efeitoDaGema?.custoPct ?? 0) / 100) * Math.max(0, 1 + ModsPoe.valor(fichaDoCusto, 'custo_mana_inc') / 100)) / Math.max(0.1, 1 + ModsPoe.valor(fichaDoCusto, 'eficiencia_custo_mana') / 100) / Math.max(0.1, 1 + eficaciaDaMina / 100) + ModsPoe.valor(fichaDoCusto, 'custo_mana_fixo')));
  // Life Cost (support): o custo sai da VIDA, e não da mana (sem deixar o personagem a menos de 1).
  // Magia Sanguínea (keystone do PoE): as habilidades custam Vida em vez de Mana.
  const pagaComVida = (!!efeitoDaGema?.custoEmVida || temHabilidade(estado, 'magiaSanguinea') || ModsPoe.valor(Ficha.combate(estado), 'keystone_magia_sanguinea') > 0) && custoDeMana > 0;
  if (pagaComVida && (estado.hp ?? 0) <= custoDeMana) return { ok: false, erro: 'Sem vida para pagar.', motivo: 'VIDA' };
  // (09/10, as maestrias da árvore:) "Habilidades (de Ataque) custam Vida ao invés de X% do seu Custo de Mana": essa parte sai da vida.
  const parteEmVida = pagaComVida || !custoDeMana ? 0 : Math.round((custoDeMana * Math.min(100, Math.max(0, ModsPoe.valor(fichaDoCusto, 'custo_em_vida_pct')))) / 100);
  if (parteEmVida && (estado.hp ?? 0) <= parteEmVida) return { ok: false, erro: 'Sem vida para pagar.', motivo: 'VIDA' };
  // (PoE: com "Gaste Escudo de Energia antes da Mana" na peça da gema, o escudo cobre parte do custo.)
  const slotDaGema = Gemas.ehSkillDeGema(entry) ? Gemas.skillsAtivas(estado).get(entry.id)?.onde?.slot ?? null : null;
  const escudoNoCusto = ModsPoe.escudoParaOCusto(estado, slotDaGema, Ficha.combate(estado));
  // ("Mana Insuficiente não impede seus Ataques Corpo a Corpo".)
  const semManaPode = ModsPoe.valor(fichaDoCusto, 'ataque_sem_mana') > 0 && tagsPoeDaSkill(entry).includes('corpo');
  if (!pagaComVida && custoDeMana - parteEmVida > 0 && !semManaPode && (estado.mana ?? 0) + escudoNoCusto < custoDeMana - parteEmVida) return { ok: false, erro: 'Sem mana.', motivo: 'MANA' };
  // "Mana mínima (%)" do slot: abaixo dela a skill espera (guarda a mana para a cura).
  if (action.minMana > 0 && entry.kind !== 'item' && (100 * (estado.mana ?? 0)) / Math.max(1, estado.maxMana ?? 1) < action.minMana) {
    return { ok: false, erro: 'Abaixo da mana mínima do slot.', motivo: 'MANA_MINIMA' };
  }

  const papel = entry.papeis[0];
  const ataque = papel === 'attack';
  const vivos = hunt.monstros.filter((b) => b.hp > 0);
  const x = hunt.pos.x;
  const y = hunt.pos.y;

  /*
   * ---- Onde a magia de ataque pega, ANTES de gastar nada ----
   *
   * "as skills não estão acertando os mobs e tá espamando sem parar — o certo
   * é só quando tiver mob no alcance". Duas causas: (1) onda/feixe/varredura
   * (`AREA_WAVE*`, `AREA_BEAM*`, `AREA_SQUAREWAVE*`, a Front Sweep...) vêm no
   * catálogo desenhadas olhando para o NORTE e eram usadas sem girar — batiam
   * no chão vazio atrás do personagem; (2) área em volta dele saía mesmo sem
   * bicho nenhum dentro. Agora a área é calculada primeiro (girada para o lado
   * com mais bichos, começando pelo do alvo) e a magia só sai se pegar pelo
   * menos `minTargets` (1 por padrão, o "Bichos por perto" do slot).
   */
  let atingidos = [];
  let casas = null;
  let virarPara = null;
  if (ataque) {
    const centradoNoAlvo = entry.miraNoChao || entry.alvoNoCentro;
    if (!entry.forma) {
      if (!alvo) return { ok: false, erro: 'Sem alvo.', motivo: 'SEM_ALVO' };
      // Sem `range` próprio é golpe de corpo a corpo (Brutal Strike, Tiger Clash...).
      if (distanciaChebyshev(hunt.pos, alvo) > (entry.range || 1)) return { ok: false, erro: 'Alvo fora de alcance.', motivo: 'FORA_DE_ALCANCE' };
      atingidos = [alvo];
      // CADEIA (tag `chain`: Forked Thorns, Forked Glacier, Chained Penance...): do alvo, salta para o
      // bicho vivo mais perto a até `cadeia.distance` sqm do último atingido, até `cadeia.targets` alvos.
      // A cadeia da gema do PoE: 1 + os ricochetes DO NÍVEL dela (+ os do suporte de corrente); a distância do salto é a da magia-molde.
      if (entry.cadeia) atingidos = saltosDaCadeia(alvo, vivos, efeitoDaGema?.cadeiaPoe ? { ...entry.cadeia, targets: 1 + efeitoDaGema.cadeiaPoe.saltos } : entry.cadeia);
    } else if (centradoNoAlvo && entry.miraNoChao && mira) {
      // A casa que o jogador escolheu na mira (`huntAction` com x, y): a área cai lá, com ou sem alvo.
      if (distanciaChebyshev(hunt.pos, mira) > (entry.range || ALCANCE_PADRAO)) return { ok: false, erro: 'Fora de alcance.', motivo: 'FORA_DE_ALCANCE' };
      casas = casasDaForma(entry, mira.x, mira.y);
    } else if (centradoNoAlvo) {
      if (!alvo) return { ok: false, erro: 'Sem alvo.', motivo: 'SEM_ALVO' };
      if (distanciaChebyshev(hunt.pos, alvo) > (entry.range || ALCANCE_PADRAO)) return { ok: false, erro: 'Alvo fora de alcance.', motivo: 'FORA_DE_ALCANCE' };
      casas = casasDaForma(entry, alvo.x, alvo.y);
    } else {
      const lados = direcional(entry) ? ordemDosLados(hunt.pos, alvo) : [null];
      let melhor = null;
      for (const dir of lados) {
        const cs = casasDaForma(entry, x, y, dir);
        const n = Areas.dentro(cs, vivos).length;
        if (!melhor || n > melhor.n) melhor = { dir, cs, n };
      }
      casas = melhor.cs;
      virarPara = melhor.dir;
    }
    // Area of Effect / Concentrated Effect (supports): a área cresce ou encolhe `areaExtra` casas.
    if (casas && efeitoDaGema?.areaExtra) casas = Areas.mudar(casas, Math.round(efeitoDaGema.areaExtra));
    // Quem está nas casas da área: por índice de casa (sem varrer área × bichos).
    if (casas) atingidos = Areas.dentro(casas, vivos);
  }
  /*
   * ---- A faixa de criaturas do slot ("Mínimo" e "Máximo de criaturas") ----
   * Na magia de área conta quem a área PEGA; na de alvo único (e na cadeia), quem
   * está a até `RAIO_DA_FAIXA` sqm — o que a tela diz. Máximo 0 = sem teto.
   */
  if (ataque) {
    // (O próprio alvo sempre conta: a magia de 7 sqm no bicho a 6 não some da faixa.)
    const n = casas ? atingidos.length : new Set([...atingidos, ...vivos.filter((b) => distanciaChebyshev(hunt.pos, b) <= RAIO_DA_FAIXA)]).size;
    if (n < Math.max(1, Number(action.minTargets) || 1)) {
      return casas ? { ok: false, erro: 'Nenhum bicho na área.', motivo: 'SEM_BICHO_NA_AREA' } : { ok: false, erro: 'Poucas criaturas para o mínimo do slot.', motivo: 'POUCAS_CRIATURAS' };
    }
    if (action.maxTargets > 0 && n > action.maxTargets) return { ok: false, erro: 'Criaturas demais para o máximo do slot.', motivo: 'CRIATURAS_DEMAIS' };
  } else if (!entry.heals && entry.kind === 'spell' && !vivos.some((b) => distanciaChebyshev(hunt.pos, b) <= 8)) {
    // Suporte/velocidade (haste, buffs): só com bicho por perto, senão era mana jogada fora sem parar.
    return { ok: false, erro: 'Nenhum bicho por perto.', motivo: 'SEM_BICHO_POR_PERTO' };
  }
  // Suporte: não relança enquanto o efeito dele ainda está ligado.
  const buff = BUFFS[entry.id];
  if (buff && !R.jaPode(agora, hunt.buffs?.[entry.id]?.ate)) return { ok: false, erro: 'Ainda está ativo.', motivo: 'EFEITO_ATIVO' };
  // A skill que desliga um reforço (dados: `cancelamentos`) só sai com ele ligado.
  const cancela = Reforcos.CANCELA[entry.id];
  if (cancela && !temBuff(hunt, cancela)) return { ok: false, erro: 'Não há o que cancelar.', motivo: cancela === 'shield' ? 'SEM_ESCUDO' : 'SEM_REFORCO' };
  // LACAIOS do PoE: com todos em campo (e sem duração para renovar), a gema não sai — o auto não fica relançando à toa.
  if (entry.poeGema?.lacaio) {
    const q = LacaiosPoe.oQueInvoca(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema);
    const desta = (hunt.lacaios ?? []).filter((l) => l.gema === entry.poeGema.slug && l.hp > 0);
    // Com todos em campo, só relança quando o mais velho está para acabar (a duração): senão o novo trocaria o velho sem parar.
    const agoraL = hunt.ultimoTique ?? Date.now();
    const venceLogo = desta.some((l) => l.ate && l.ate - agoraL < 1000);
    if (q && q.maximo && desta.length >= q.maximo && !venceLogo) return { ok: false, erro: `Já estão todos em campo (${desta.length}/${q.maximo}).`, motivo: 'LACAIOS_COMPLETOS' };
    // A Oferenda e a Convocação agem nos lacaios que estão em campo: sem nenhum, não saem.
    if (q && (q.tipo === 'oferenda' || q.tipo === 'convocacao') && !(hunt.lacaios ?? []).some((l) => l.hp > 0 && l.tipo === 'lacaio')) return { ok: false, erro: 'Nenhum lacaio em campo.', motivo: 'SEM_LACAIOS' };
  }
  // Magia de familiar: só sem um em campo e fora da recarga dele (ver `summon.mjs`).
  if (entry.summon) {
    const pode = Summon.podeInvocar(estado, hunt, hunt.ultimoTique ?? Date.now());
    if (!pode.ok) return { motivo: 'FAMILIAR', ...pode };
  }
  // Curar amigo (exura sio, runas de cura em outro): em QUEM a cura cai — "Curar" do slot.
  let curado = { estado, nome: null };
  if (entry.curaOutro && (action.curarQuem ?? 'eu') !== 'eu') {
    curado = quemCurar(estado, hunt, action);
    if (!curado) return { ok: false, erro: 'Ninguém para curar.', motivo: 'NINGUEM_PARA_CURAR' };
  }
  // Desafio (exeta res): "Quando chamar" e "No máximo uma vez a cada (s)".
  if (entry.desafio) {
    const d = podeDesafiar(estado, hunt, action, agora);
    if (!d.ok) return d;
  }
  // Utamo vita com "Tirar o escudo quando" batendo: não põe de volta o que o tique acabou de tirar.
  if (buff?.tipo === 'shield' && action.tirarQuando?.length && condicoesDoSlotBatem({ conditions: action.tirarQuando }, estado, alvo, hunt)) {
    return { ok: false, erro: 'A regra de tirar o escudo está batendo.', motivo: 'TIRAR_ESCUDO' };
  }
  // Exana vita com "Só tirar se o utamo vita já puder voltar": espera a recarga de quem põe o escudo.
  if (cancela && action.soComUtamoPronto) {
    const quemPoe = Object.keys(BUFFS).filter((id) => BUFFS[id]?.tipo === cancela);
    if (quemPoe.some((id) => cds[id] && !R.liberou(agora, cds[id].ate))) return { ok: false, erro: 'O escudo ainda não pode voltar.', motivo: 'ESCUDO_RECARREGANDO' };
  }
  if (!gatilho && !condicoesDoSlotBatem(action, estado, alvo, hunt)) return falhaDaCondicao(action, estado, alvo, hunt);
  // Cura sem condição configurada não é desperdiçada: só sai se faltar pelo
  // menos a cura MÍNIMA dela (o slot novo nasce com `conditions: []` no client,
  // e sem isto a poção de vida saía a cada recarga com a vida cheia).
  if (!gatilho && !ataque && !(action.conditions ?? []).length && !precisaDeCura(entry, estado, curado.estado)) {
    return { ok: false, erro: 'Não precisa agora.', motivo: 'NAO_PRECISA' };
  }

  /*
   * ---- CONJURAÇÃO (Cast Time da gema, decisão do dono: conjuração de verdade) ----
   * Tudo validado: a skill começa a conjurar e só sai no fim (`concluirConjuracao`,
   * no tique), revalidando alvo, alcance e mana. Nada é gasto ainda; durante a
   * conjuração o personagem não bate, não anda e não lança outra coisa.
   */
  if (!concluir && !gatilho && Gemas.ehSkillDeGema(entry)) {
    const castMs = Gemas.tempoDeConjuracao(estado, entry.id, Ficha.combate(estado).castSpeed);
    if (castMs > 0) {
      // Conjurando, já olha para onde a skill vai sair.
      virarParaOAlvo(hunt, mira && entry.miraNoChao ? mira : alvo);
      // Skill que não é de ataque (invocação, aura, buff) não depende do alvo: ele morrer no meio não cancela a conjuração.
      hunt.conjurando = { slot, id: entry.id, alvo: !ataque || (mira && entry.miraNoChao) ? null : alvo?.uid ?? null, inicio, fim: inicio + castMs, ...(mira && entry.miraNoChao ? { mira } : {}) };
      // O global começa AQUI (a conjuração corre dentro dele); se ela for cancelada, volta o de antes.
      if (deAtaque) {
        hunt.conjurando.globalAntes = hunt.ultimoAtaqueEm ?? null;
        hunt.ultimoAtaqueEm = inicio;
      }
      // `sk`: o id da skill — o VISUAL dela (efeitos-visuais) desenha o lançamento no começo da conjuração.
      return { ok: true, conjurando: true, eventos: [{ t: 'cast', uid: 'player', quem: personagem?.nome, skill: entry.name, ms: castMs, sk: entry.id, x: hunt.pos.x, y: hunt.pos.y }] };
    }
  }

  /*
   * ---- Poção e runa: da mochila, ou compradas na hora ----
   *
   * No original a barra não precisa de estoque: o relatório real mostra
   * "Gasto: 503" poções e "Suprimentos: -79.474 gold" — 503 x 158, o `cost` da
   * great mana potion no catálogo. Ela é paga com o ouro do bolso no momento
   * de usar. Aqui: se tiver na mochila, usa a da mochila (de graça); senão,
   * paga o `cost` do bolso; sem ouro, não sai.
   */
  // (A runa virou gema — decisão do dono: não gasta mais item nem ouro; só a poção.)
  if (entry.kind === 'item') {
    const preco = entry.cost ?? ITEM_CATALOG[entry.itemId]?.buy ?? 0;
    const daMochila = removerItem(estado, entry.itemId, 1);
    if (!daMochila) {
      if (!preco || (estado.gold ?? 0) < preco) return { ok: false, erro: `Sem ${entry.name} e sem ouro para comprar.`, motivo: 'SEM_SUPRIMENTO' };
      estado.gold -= preco;
    }
    // Conta no relatório da caçada (grupo "Gasto" e a linha "Suprimentos").
    const sessao = hunt.sessao;
    if (sessao) {
      sessao.itens.gastos[entry.itemId] = (sessao.itens.gastos[entry.itemId] ?? 0) + 1;
      sessao.supplies += preco;
    }
  }
  if (pagaComVida) estado.hp = Math.max(1, (estado.hp ?? 0) - custoDeMana);
  else if (custoDeMana) {
    if (parteEmVida) estado.hp = Math.max(1, (estado.hp ?? 0) - parteEmVida);
    // PoE: "Gaste Escudo de Energia antes da Mana para os Custos de Habilidades Encaixadas" (a gema na peça que tem o mod).
    const doEscudo = Math.min(custoDeMana - parteEmVida, escudoNoCusto);
    if (doEscudo > 0) estado.es = Math.max(0, (estado.es ?? 0) - doEscudo);
    estado.mana = Math.max(0, (estado.mana ?? 0) - (custoDeMana - parteEmVida - doEscudo));
    // PoE: "X% de chance de, quando pagar o Custo de uma Habilidade, ganhar a mesma quantidade de Mana".
    if (Math.random() * 100 < ModsPoe.valor(Ficha.combate(estado), 'chance_devolver_custo')) estado.mana = Math.min(estado.maxMana ?? estado.mana, estado.mana + custoDeMana);
    Treino.gastarMana(estado, custoDeMana);
    // O Ocultista (cargas do PoE): Carga de Poder a cada N de mana gasta.
    const regrasDasCargas = Ficha.combate(estado).cargas;
    if (regrasDasCargas && CargasPoe.aoGastarMana(estado, regrasDasCargas, custoDeMana).length) Ficha.invalidar(estado);
  }

  const eventos = [];
  // Vira para ONDE a skill vai (dono, 06/10: "o boneco vira para onde lança a magia?"): a onda/feixe já escolheu o lado (`virarPara`);
  // o resto olha para a casa mirada ou para o alvo.
  if (virarPara != null) hunt.pos.dir = virarPara;
  else virarParaOAlvo(hunt, mira && entry.miraNoChao ? mira : alvo);
  if (buff) {
    // Uma velocidade só por vez (a mais nova vale), como no Tibia.
    if (buff.tipo === 'speed') for (const [id, b] of Object.entries(hunt.buffs ?? {})) if (b.tipo === 'speed') delete hunt.buffs[id];
    // O nível, a raridade e a qualidade da gema escalam o efeito (`Reforcos.fatorDaGema`); a duração não muda.
    const fator = Reforcos.fatorDaGema(efeitoDaGema);
    // Skill Duration (support): +% na duração do reforço.
    const duracao = Math.round(buff.dur * (1 + (efeitoDaGema?.duracaoPct ?? 0) / 100));
    // A gema do PoE: os efeitos e os atributos do NÍVEL dela (`GemasPoe.buffNoNivel`) ficam no buff; a ficha é refeita (atributos novos).
    const doPoe = entry.poeGema?.buff ? GemasPoe.buffNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : null;
    // (A aura que reserva fica LIGADA — sem expirar — e guarda a reserva dela: o recurso, a % ou o fixo, e o fator dos suportes/eficácia.)
    (hunt.buffs ??= {})[entry.id] = doPoe
      ? { ate: reserva ? Reserva.LIGADA_ATE : agora + Math.round(doPoe.dur * (1 + ((efeitoDaGema?.duracaoPct ?? 0) + duracaoDasPecas(estado, entry)) / 100)), tipo: buff.tipo, fator: 1, efeitosPoe: efeitosDaMaldicao(doPoe.efeitos, efeitoDaGema, estado, entry), afPoe: doPoe.af,
        ...(reserva ? { reserva: { recurso: reserva.recurso, ...(reserva.pct ? { pct: reserva.pct } : { fixo: reserva.fixo }), fator: reserva.fator } } : {}) }
      : { ate: agora + duracao, tipo: buff.tipo, fator, ...(buff.mult ? { mult: Reforcos.velocidadeEscalada(buff.mult, fator) } : {}) };
    if (doPoe) Ficha.invalidar(estado);
    // A parte reservada sai da mana (ou da vida) atual na hora.
    if (reserva) Reserva.cortarNoLivre(estado);
    // A provocação: os bichos por perto vêm atacar você (o grito do PoE traz o `provocar` nos efeitos do nível).
    if (buff.tipo === 'desafio') Reforcos.provocar(hunt, buff, distanciaChebyshev);
    if (doPoe?.efeitos.some((e) => e.efeito === 'provocar')) Reforcos.provocar(hunt, { efeitos: doPoe.efeitos }, distanciaChebyshev);
    if (entry.words) eventos.push({ t: 'say', uid: 'player', quem: personagem?.nome, text: entry.words, x: hunt.pos.x, y: hunt.pos.y, color: '#f36500' });
  }
  if (cancela) {
    for (const [id, b] of Object.entries(hunt.buffs ?? {})) if (b.tipo === cancela) delete hunt.buffs[id];
  }
  if (entry.poeGema?.lacaio) eventos.push(...invocarLacaios(hunt, entry, efeitoDaGema, alvo, estado));
  if (entry.summon) {
    Summon.invocar(estado, hunt, action, hunt.ultimoTique ?? Date.now());
    if (entry.words) eventos.push({ t: 'say', uid: 'player', quem: personagem?.nome, text: entry.words, x: hunt.pos.x, y: hunt.pos.y, color: '#f36500' });
  }

  if (!ataque) {
    // Cura: poção usa `heal`/`mana` ([min,max]); magia/runa de cura usa `damage`.
    // A cura da magia/runa: a MESMA conta do balão (`contaDaCura`) — base pelo level, perícia,
    // Cura de magia, supremo da gema, magic level em %, nível/raridade/qualidade da gema, Potent Healing.
    const conta = entry.heals && entry.kind !== 'item' ? contaDaCura(estado, entry, efeitoDaGema) : null;
    const hp = entry.kind === 'item' ? entry.heal : conta ? [conta.min, conta.max] : null;
    const mp = entry.kind === 'item' ? entry.mana : null;
    if (entry.efeito) eventos.push({ t: 'fx', id: entry.efeito, uid: 'player', x, y });
    if (hp) {
      // Poção: o número dela. Magia: × a conta, e a árvore (Graça, Fonte viva) por cima, no momento.
      const curaBruta = entry.kind === 'item' ? sortear(hp[0], hp[1]) : Arvore.aoCurarComMagia(estado, Math.round((sortear(hp[0], hp[1]) + conta.pericia) * conta.mult));
      // "Toda cura que você recebe vale X% a mais" (Shared Conservation).
      const cura = Math.round(curaBruta * (1 + Reforcos.bonus(hunt, 'curaRecebida') / 100));
      const quem = curado.estado;
      quem.hp = Math.min(quem.maxHp ?? quem.hp, (quem.hp ?? 0) + cura);
      if (quem === estado) eventos.push({ t: 'heal', uid: 'player', quem: personagem?.nome, x, y, v: cura, color: '#00ff66' });
      else eventos.push({ t: 'heal', uid: `aliado:${curado.nome}`, quem: curado.nome, x: quem.hunt?.pos?.x ?? x, y: quem.hunt?.pos?.y ?? y, v: cura, color: '#00ff66' });
    }
    if (mp) {
      const cura = sortear(mp[0], mp[1]);
      estado.mana = Math.min(estado.maxMana ?? estado.mana, (estado.mana ?? 0) + cura);
      eventos.push({ t: 'heal', uid: 'player', quem: personagem?.nome, x, y, v: cura, color: '#4fc3ff' });
    }
  } else {
    if (entry.words) eventos.push({ t: 'say', uid: 'player', quem: personagem?.nome, text: entry.words, x, y, color: '#f36500' });
    // (PoE: "Velocidade do Projétil aumentada" — o projétil voa mais rápido na tela.)
    const velDoTiro = 1 + ModsPoe.valor(Ficha.combate(estado), 'projectile_speed') / 100;
    if (entry.projetil && alvo) eventos.push({ t: 'shot', id: entry.projetil, x, y, tx: alvo.x, ty: alvo.y, ...(velDoTiro !== 1 ? { vel: velDoTiro } : {}) });
    const cor = COR_DO_ELEMENTO[entry.element] ?? COR_DO_ELEMENTO.physical;
    // A área vai para a tela num evento SÓ, com as MESMAS casas que causam dano (o cliente
    // desenha cada uma). Antes era um `fx` por casa — e a tela, que guardava os 60 últimos,
    // perdia o começo das áreas grandes (a parte de CIMA da Rage of the Skies, 85 casas).
    if (casas && entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x, y, casas: Areas.paraTela(casas, { x, y }) });
    else if (entry.efeito) eventos.push({ t: 'fx', id: entry.efeito, uid: alvo.uid, x: alvo.x, y: alvo.y });
    // A cadeia: o salto de um bicho para o outro (o projétil, se a magia tem) e o efeito em cada um.
    if (entry.cadeia) {
      for (let i = 1; i < atingidos.length; i++) {
        const de = atingidos[i - 1];
        const para = atingidos[i];
        if (entry.projetil) eventos.push({ t: 'shot', id: entry.projetil, x: de.x, y: de.y, tx: para.x, ty: para.y });
        if (entry.efeito) eventos.push({ t: 'fx', id: entry.efeito, uid: para.uid, x: para.x, y: para.y });
      }
    }
    // A conta do dano, a MESMA do balão (`contaDoDano`): base pelo level + treino em % + gema + afixos.
    const { min, max, daPericia, mult, fatorDaGema, ficha, partes, porAfeccao, ehMagia: ehMagiaDaConta } = contaDoDano(estado, entry, efeitoDaGema);
    let total = 0;
    const danos = [];
    /*
     * UM acerto num bicho, com `pct`% do golpe — o golpe principal (100%) e os
     * secundários (projéteis extras, perfuração, bifurcação, encadeamento,
     * retorno, explosão) passam todos por aqui: cada um rola o crítico dele, com
     * a resistência do bicho ao elemento, a marca de vulnerável (Aura of Exposed
     * Weakness) e as marcas das auras. O leech sai uma vez, do dano somado.
     * ("Dano de magia" e "Dano de <elemento>" dos afixos e da árvore, o treino,
     * a afinidade da classe e a gema já estão no `mult`/`fatorDaGema`.)
     */
    // O ataque do PoE que acertou crítico / matou de perto: o que os suportes de gatilho escutam (`ativarGatilhos`).
    let houveCritico = false;
    let fatorDoAtaque = 100; // 100% no ataque normal; o do 2º golpe do ataque duplo vem de `combate/limites.json`
    const acertar = (bicho, pct = 100, fonte = null) => {
      // O golpe da gema do PoE com MAIS DE UM elemento (ou de outro elemento que o da skill): cada parte com o "aumentado", a marca de
      // vulnerável e a resistência do elemento dela; o golpe leva o elemento da maior parte (a cor, o registro, as mecânicas do mob).
      const fator = (fatorDaGema * (1 + ((porAfeccao ?? 0) * GemasPoe.afeccoesElementaisEm(bicho, agora)) / 100) * pct * fatorDoAtaque) / 10000;
      const pedacos = partes ? partes.map((p) => ({ elemento: p.elemento, dano: (p.min + Math.random() * (p.max - p.min) + daPericia * p.frac) * fator * p.mult * Reforcos.vulnerabilidade(bicho, p.elemento, agora) })) : null;
      const tipo = pedacos ? pedacos.reduce((a, b) => (b.dano > a.dano ? b : a)).elemento : entry.element ?? 'physical';
      const bruto = pedacos ? pedacos.reduce((t, p) => t + p.dano, 0) : (sortear(min, max) + daPericia) * fator * mult * Reforcos.vulnerabilidade(bicho, tipo, agora);
      // Gema de DANO CONTÍNUO (Ignite, Envenom, Inflict Wound...): o dano dela é o TOTAL de um efeito ao longo do tempo (`combate/dot.mjs`),
      // não um golpe — sem acerto, sem crítico, e a resistência passa em cada pulso.
      const tipoDoDot = entry.overTime ? Dot.tipoDaFonte(entry.overTime.type) : null;
      if (tipoDoDot) {
        Reforcos.marcar(hunt, bicho, agora);
        const estado = Dot.aplicar(bicho, { tipo: tipoDoDot, total: bruto, origem: { fonte: 'gema', habilidade: entry.id } }, agora);
        if (estado) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado });
        registrarGolpe(() => ({ origem: 'gema-dot', habilidade: entry.id, alvo: bicho.name, tipo, dot: tipoDoDot, totalDoEfeito: Math.round(bruto), aplicou: !!estado }));
        return;
      }
      // O bicho BLOQUEIA o golpe (só quem tem bloqueio configurado — `mobs/atributos.mjs`): sem dano nem estados.
      // ("Monstros não podem Bloquear seus Ataques" — as maestrias da árvore: só nos ataques.)
      if (!(ModsPoe.valor(ficha, 'inimigos_nao_bloqueiam') > 0 && (entry.poeGema ? !!entry.poeGema.ataque : true)) && AtributosDoMob.bloqueou(bicho)) {
        eventos.push({ t: 'block', uid: bicho.uid, x: bicho.x, y: bicho.y, color: '#999999', bloqueado: true });
        return;
      }
      const base = pedacos ? Math.round(pedacos.reduce((t, p) => t + resistido(hunt, bicho, p.elemento, p.dano, ficha), 0)) : resistido(hunt, bicho, tipo, bruto, ficha);
      Reforcos.marcar(hunt, bicho, agora);
      const rolado = Ficha.rolarCritico(estado, base, bicho, eventos, ficha);
      // PoE: "Golpes Críticos de Ataques ignoram a Resistência Elemental dos Monstros" — no crítico, a parte elemental sem a resistência positiva.
      if (rolado.crit && base > 0 && ModsPoe.valor(ficha, 'critico_ignora_res') > 0) {
        const semRes = pedacos ? pedacos.reduce((t, p) => t + (['fire', 'ice', 'energy'].includes(p.elemento) ? Math.max(p.dano, resistido(hunt, bicho, p.elemento, p.dano, ficha)) : resistido(hunt, bicho, p.elemento, p.dano, ficha)), 0) : (['fire', 'ice', 'energy'].includes(tipo) ? Math.max(bruto, base) : base);
        rolado.dano = Math.round((rolado.dano * semRes) / base);
      }
      const { dano, crit, onslaught, chance } = rolado;
      if (crit) houveCritico = true;
      bicho.hp -= dano;
      // O registro do golpe (desligado em produção: nem monta o objeto).
      registrarGolpe(() => ({
        origem: 'gema', habilidade: entry.id, alvo: bicho.name, tipo, danoAntesDaResistencia: Math.round(bruto), resistenciaDoAlvo: resistenciaDe(hunt, bicho, tipo),
        penetracao: Limites.penetracaoDe(ficha.penetracao, tipo), resistenciaEfetiva: resistenciaEfetivaDe(hunt, bicho, tipo, ficha), danoAposResistencia: base,
        chanceCritica: chance, critico: crit, danoFinal: dano, vidaRestante: Math.max(0, bicho.hp),
        detalhe: { min, max, daPericia, multiplicador: mult, fatorDaGema, porcentagemDoGolpe: pct, fatorDoAtaque, ataqueDuplo: fatorDoAtaque !== 100, ...(pedacos ? { porElemento: Object.fromEntries(pedacos.map((p) => [p.elemento, Math.round(p.dano)])) } : {}) },
      }));
      total += dano;
      danos.push({ bicho, dano });
      // As mecânicas do mob que reagem ao dano (Endurecido, Espelhado — `mobs/mecanicas.mjs`).
      Mecanicas.aoReceberDano(estado, hunt, personagem, bicho, dano, tipo, eventos);
      // `fonte`: de que efeito veio (explosão, perfuração, bifurcação, encadeamento, retorno, projétil extra).
      // (A gema só de dano degenerativo — Flecha Cáustica, Contagiar… — não mostra um "0": o dano dela vem nos pulsos.)
      if (dano > 0 || !(entry.poeGema && GemasPoe.degenerativoNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1))) {
        eventos.push({ t: 'dmg', uid: bicho.uid, x: bicho.x, y: bicho.y, v: dano, foe: true, crit, onslaught, spell: entry.name, alvo: bicho.name, color: pedacos ? COR_DO_ELEMENTO[tipo] ?? cor : cor, ...(fonte ? { fonte } : {}) });
      }
      // Os estados das supports (Ignite, Freeze, Slow, Stun) no bicho atingido.
      const postosDaGema = Estados.aplicar(bicho, efeitoDaGema, dano, agora, Math.random, !!hunt.isBoss, bruto);
      for (const st of postosDaGema) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: st });
      // Os efeitos de acerto do PoE (atordoamento, Mutilar, Cegar, Desacelerar, Empalar, Empurrar, Provocar, Fúria — `itens-poe/mods-poe.mjs`).
      const fisicoDoAcerto = pedacos ? pedacos.filter((p) => p.elemento === 'physical').reduce((t, p) => t + p.dano, 0) : tipo === 'physical' ? bruto : 0;
      const doAcerto = ModsPoe.aoAcertar(estado, hunt, bicho, ficha, { dano, fisico: fisicoDoAcerto, crit, eventos, agora, personagem, mover: (b) => ModsPoe.empurrar(hunt, b), elementos: pedacos ? pedacos.map((p) => p.elemento) : [tipo] });
      // As afecções do PoE (só com ITENS_POE=1): o acerto entra com o elemento da skill; habilidade de ataque (golpe físico de perto/longe) é ataque.
      // As cargas do PoE no acerto da skill (crítico, não crítico, atordoou, Inimigo Único).
      if (CargasPoe.reageAoAcerto(ficha.cargas)) {
        const corpoACorpo = Tags.tagsDaAcao(entry).includes('melee');
        if (CargasPoe.aoAcertar(estado, ficha.cargas, bicho, { crit, corpoACorpo, atordoou: postosDaGema.includes('atordoado') || doAcerto.atordoou }).length) Ficha.invalidar(estado);
      }
      // (09/10) O DANO DEGENERATIVO da gema do PoE no alvo acertado: dano por segundo × a duração da habilidade, com o Multiplicador de Dano
      // Degenerativo (o geral e o do elemento), o "Dano Degenerativo aumentado", o aumentado do elemento e os suportes da gema (`fatorDaGema`).
      // A resistência do alvo vale em cada pulso; não rola crítico. Uma instância por gema: a mesma habilidade não acumula com ela mesma.
      if (entry.poeGema) {
        const dg = GemasPoe.degenerativoNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1);
        const a = ficha.afeccoes ?? AfeccoesPoe.daSoma(ficha.afPoe ?? {});
        const MULTI = { fire: a.multiplicadorFogo, ice: a.multiplicadorGelo, energy: a.multiplicadorRaio, chaos: a.multiplicadorCaos, physical: a.multiplicadorFisico };
        for (const p of dg?.partes ?? []) {
          const tipoDegen = GemasPoe.DEGEN_DO_ELEMENTO[p.elemento];
          const total = p.dps * (dg.duracaoMs / 1000) * fatorDaGema * (1 + ((a.multiplicador ?? 0) + (MULTI[p.elemento] ?? 0)) / 100) * (1 + ((a.danoAumentado ?? 0) + (ficha.danoDoElemento?.[p.elemento] ?? 0)) / 100);
          const posto = Dot.aplicar(bicho, { tipo: tipoDegen, total, duracaoMs: dg.duracaoMs, chave: entry.poeGema.slug, origem: { fonte: 'gema', habilidade: entry.id } }, agora);
          if (posto) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: posto });
        }
      }
      if (ficha.afeccoes) {
        const tagsDoAcerto = Tags.tagsDaAcao(entry);
        const ataque = entry.poeGema ? !!entry.poeGema.ataque : tagsDoAcerto.includes('physical') && (tagsDoAcerto.includes('melee') || tagsDoAcerto.includes('ranged'));
        // A gema do PoE soma as chances dela (incendiar, congelar, eletrizar, envenenar, sangrar) no nível em que está.
        const afeccoes = entry.poeGema ? GemasPoe.afeccoesComAGema(ficha.afeccoes, entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : ficha.afeccoes;
        const postos = AfeccoesPoe.aoAcertar(bicho, pedacos ?? [{ elemento: tipo, dano: bruto }], { afeccoes, crit, ataque, agora, salaDeBoss: !!hunt.isBoss });
        for (const st of postos) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: st });
        ModsPoe.aoPorAfeccoes(estado, hunt, bicho, ficha, postos, { eventos, personagem });
      }
    };
    /*
     * ---- O ATAQUE (o golpe principal + os secundários das supports) e o ATAQUE DUPLO ----
     * `segundo`: o ataque EXTRA (chance `ficha.ataqueDuplo`, no máximo UM por uso — ele nunca rola o duplo de novo). Repete o ataque inteiro, com
     * a precisão, o crítico, a resistência e os estados de cada alvo, mas não gasta mana nem recarga, e o roubo de vida/mana e as habilidades da
     * árvore (depois da magia) contam só do primeiro.
     */
    const atacar = (segundo) => {
      // "X% mais Dano por cada Ricochete restante" (Arco): o 1º atingido tem todos os ricochetes pela frente; cada salto gasta um.
      const cp = efeitoDaGema?.cadeiaPoe;
      atingidos.forEach((bicho, i) => { if (!segundo || bicho.hp > 0) acertar(bicho, cp?.pct ? 100 * (1 + (cp.pct * Math.max(0, cp.saltos - i)) / 100) : 100); });
      /*
       * ---- Os golpes SECUNDÁRIOS das supports, combinados em cadeia ----
       * Quem leva, com quantos %, de onde e de que tipo vem de `Secundarios.resolver`
       * (projéteis extras, perfuração, bifurcação, encadeamento, retorno — e a explosão
       * em CADA impacto, 3×3 em volta dele). Aqui só se aplica, um acerto por vez, na
       * ordem: quem morreu no meio do caminho não leva o resto.
       */
      const { golpes, explosoes } = Secundarios.resolver({
        efeito: efeitoDaGema,
        tags: Tags.tagsDaAcao(entry),
        origem: { x, y },
        alvo: casas ? null : alvo,
        atingidos,
        vivos,
        alcance: entry.range || ALCANCE_PADRAO,
      });
      // A explosão na tela: UM evento por detonação (o cliente desenha o quadrado inteiro).
      for (const ex of explosoes) eventos.push({ t: 'explosao', id: entry.efeito || EFEITO_DA_EXPLOSAO, x: ex.x, y: ex.y, lado: ex.lado });
      for (const s of golpes) {
        if (s.bicho.hp <= 0) continue;
        if (s.tipo !== 'explosao' && entry.projetil) eventos.push({ t: 'shot', id: entry.projetil, x: s.de.x, y: s.de.y, tx: s.bicho.x, ty: s.bicho.y });
        acertar(s.bicho, s.pct, s.tipo);
      }
    };
    atacar(false);
    // REPETIÇÕES dos suportes do PoE (Eco de Magia, Golpe Múltiplo): a skill sai de novo na hora, nos vivos (sem gastar de novo).
    for (let r = 0; r < Math.min(3, efeitoDaGema?.repeticoes ?? 0); r++) if (atingidos.some((b) => b.hp > 0)) atacar(true);
    const totalDoPrimeiro = total;
    const danosDoPrimeiro = danos.slice();
    if (Math.random() < (ficha.ataqueDuplo ?? 0)) {
      fatorDoAtaque = Limites.LIMITES.ataqueDuplo.danoDoSegundoGolpePct;
      atacar(true);
      fatorDoAtaque = 100;
      total = totalDoPrimeiro;
      danos.length = 0;
      danos.push(...danosDoPrimeiro);
    }
    // Cataclismo, Arco voltaico, Inverno sem fim, Raiz venenosa (ver `Arvore.depoisDaMagia`).
    if (entry.kind === 'spell') total += Arvore.depoisDaMagia(estado, hunt, entry.element, danos, eventos, cor);
    // (No PoE as magias não roubam: só os ataques — `Ficha.aplicarLeech`.)
    Ficha.aplicarLeech(estado, total, eventos, personagem?.nome, { x, y }, ficha, null, { ataque: !ehMagiaDaConta });
    // Life Leech / Mana Leech (supports): % do dano desta skill volta em vida/mana.
    const vidaDoLeech = Math.round((total * (efeitoDaGema?.leechVidaPct ?? 0)) / 100);
    const manaDoLeech = Math.round((total * (efeitoDaGema?.leechManaPct ?? 0)) / 100);
    if (vidaDoLeech > 0) {
      estado.hp = Math.min(estado.maxHp ?? estado.hp, (estado.hp ?? 0) + vidaDoLeech);
      eventos.push({ t: 'heal', uid: 'player', quem: personagem?.nome, x, y, v: vidaDoLeech, color: '#00ff66' });
    }
    if (manaDoLeech > 0) {
      estado.mana = Math.min(estado.maxMana ?? estado.mana, (estado.mana ?? 0) + manaDoLeech);
      eventos.push({ t: 'heal', uid: 'player', quem: personagem?.nome, x, y, v: manaDoLeech, color: '#4fc3ff' });
    }
    // Os SUPORTES DE GATILHO do PoE: o ATAQUE que acertou crítico ("Conjurar no Acerto Crítico") ou que matou de perto ("Conjurar ao
    // Abater Corpo a Corpo") ativa as magias ligadas no mesmo grupo de sockets.
    if (entry.poeGema?.ataque && !gatilho) {
      const vivoAinda = atingidos.find((b) => b.hp > 0) ?? null;
      if (houveCritico) ativarGatilhos(estado, hunt, personagem, 'critico', { acao: entry.id, alvo: vivoAinda }, eventos);
      const corpoACorpo = Gemas.defDaGema(Gemas.ITEM_DA_ACAO.get(entry.id))?.tags?.includes('poe:Corpo a Corpo');
      if (corpoACorpo && atingidos.some((b) => b.hp <= 0)) ativarGatilhos(estado, hunt, personagem, 'abate', { acao: entry.id, alvo: vivoAinda }, eventos);
    }
  }

  // Gemas: "-Ns recarga de <magia>" (supremo), sem passar de zero.
  // "Cooldown Recovery" (add): a recarga própria anda mais rápido.
  const fichaDaRecarga = Ficha.combate(estado);
  // + o Cooldown Recovery da gema (support).
  const tempoPoe = entry.poeGema ? temposDaGemaPoe(estado, entry, efeitoDaGema, fichaDaRecarga) : null;
  const recarga = tempoPoe ? tempoPoe.recarga : Math.max(0, Math.round(((recargaDe(entry, entry.cooldown ?? 1000) - (fichaDaRecarga.magiasDasGemas?.[action.id]?.recargaMs ?? 0)) / (1 + (fichaDaRecarga.recuperacaoDeRecarga ?? 0) / 100)) * (1 + (efeitoDaGema?.recargaPct ?? 0) / 100)));
  // Tudo a partir do instante LÓGICO (`inicio`), não do tique em que saiu.
  cds[action.id] = { ate: inicio + recarga, total: recarga };
  // PoE: os eventos "ao usar uma Habilidade" dos únicos (e os "recentemente": usou Movimento, Vaal, Clamor) — a ativada por gatilho não conta.
  if (!gatilho && entry.poeGema) {
    const tagsPoe = tagsPoeDaSkill(entry);
    const fichaDoUso = Ficha.combate(estado);
    ModsPoe.marcar(hunt, 'usouHabilidade');
    const ctxDoUso = { alvo, eventos, personagem, tags: tagsPoe };
    ModsPoe.evento(estado, hunt, 'usarHabilidade', fichaDoUso, ctxDoUso);
    ModsPoe.evento(estado, hunt, tagsPoe.includes('ataque') ? 'usarAtaque' : 'usarMagia', fichaDoUso, ctxDoUso);
    for (const [tag, rec, ev] of [['movimento', 'usouMovimento', 'usarMovimento'], ['vaal', 'usouVaal', 'usarVaal'], ['clamor', 'clamou', 'usarClamor'], ['maldicao', null, 'conjurarMaldicao']]) {
      if (!tagsPoe.includes(tag)) continue;
      if (rec) ModsPoe.marcar(hunt, rec);
      ModsPoe.evento(estado, hunt, ev, fichaDoUso, ctxDoUso);
    }
    if (/^Dash$|Avanço$/i.test(GemasPoe.doSlug(entry.poeGema.slug)?.gema?.en ?? '')) ModsPoe.marcar(hunt, 'usouAvanco');
  }
  // Recarga com CARGAS (PoE: "Recarga: 3,5 s (3 usos)" — o Avanço Flamejante): gasta uma por uso e elas voltam uma de cada vez; só trava
  // quando todas estão recarregando (até a primeira voltar).
  if (tempoPoe?.cargas > 1 && recarga) {
    const fila = ((hunt.cargasPoe ??= {})[action.id] ?? []).filter((t) => t > inicio);
    fila.push(Math.max(inicio, fila.at(-1) ?? inicio) + recarga);
    hunt.cargasPoe[action.id] = fila;
    cds[action.id] = fila.length >= tempoPoe.cargas ? { ate: fila[0], total: recarga } : { ate: inicio, total: 0 };
  }
  // O familiar: o slot mostra a espera dele (17 min no nível 0, 2 min no 100).
  if (entry.summon) cds[action.id] = { ate: inicio + Summon.recarga(estado), total: Summon.recarga(estado) };
  if (!gatilho && (entry.kind === 'spell' || grupoDeAtaque)) {
    // "Cast Speed" (add): encurta o intervalo entre magias (a recarga do grupo).
    const doGrupo = tempoPoe ? tempoPoe.uso : Math.round(recargaDe(entry, entry.groupCooldown ?? (grupoDeAtaque ? 2000 : 0)) / (entry.kind === 'spell' ? 1 + (fichaDaRecarga.castSpeed ?? 0) / 100 : 1));
    cds[grupoQueConta] = { ate: inicio + doGrupo, total: doGrupo };
  }
  if (entry.kind === 'item') cds[grupo] = { ate: inicio + RECARGA_DA_POCAO_MS, total: RECARGA_DA_POCAO_MS };
  // Gema do PoE: uma ação por vez, como no PoE — o golpe básico espera o tempo de uso dela.
  if (tempoPoe && !gatilho) hunt.proximoGolpeEm = Math.max(hunt.proximoGolpeEm ?? 0, inicio + tempoPoe.uso);
  // Skill de ataque instantânea: o global conta deste instante. (A conjurada já marcou no início.)
  if (deAtaque && !concluir && !gatilho) hunt.ultimoAtaqueEm = inicio;
  if (entry.desafio) (hunt.desafiosEm ??= {})[entry.id] = agora;
  marcarDaSkill(eventos, entry, hunt, alvo, { conjurada: concluir });
  return { ok: true, eventos };
}

/**
 * ---- O VISUAL da skill (Arena de Efeitos — `systems/efeitos-visuais.mjs`) ----
 * Cada evento de DESENHO que a skill gerou (projétil, efeito, área, dano) leva o id dela (`sk`): o cliente desenha com o visual
 * configurado para a skill (sem configuração, o de sempre). E o LANÇAMENTO vira um evento (`skill`, SKILL_CAST) na frente — a skill
 * conjurada já o teve no `cast`. Os eventos de outra skill no meio (a magia ativada por gatilho) ficam com o `sk` dela.
 */
const EVENTOS_DE_DESENHO = new Set(['shot', 'fx', 'explosao', 'area', 'dmg']);
function marcarDaSkill(eventos, entry, hunt, alvo, { conjurada = false } = {}) {
  if (!entry.poeGema && !Gemas.ehSkillDeGema(entry)) return;
  for (const ev of eventos) if (EVENTOS_DE_DESENHO.has(ev.t) && ev.sk === undefined && !(ev.t === 'dmg' && !ev.foe)) ev.sk = entry.id;
  // A conjurada já desenhou o lançamento no `cast`: o evento vai só com a posição (o impacto "ao chegar o projétil" conta dela).
  eventos.unshift({ t: 'skill', sk: entry.id, uid: 'player', x: hunt.pos.x, y: hunt.pos.y, ...(alvo ? { tx: alvo.x, ty: alvo.y, alvo: alvo.uid } : {}), ...(conjurada ? { semLancamento: true } : {}) });
}

/**
 * ---- Os SUPORTES DE GATILHO do PoE (dono, 06/10: "faça isso" — as magias ativadas) ----
 * Cada grupo de sockets ligados com um suporte de gatilho (`Gemas.gruposComGatilho`): quando o `evento` acontece (o ataque do grupo acerta
 * crítico, mata de perto, ou o personagem acumula o dano do limiar), as MAGIAS do grupo saem na hora — instantâneas, sem o relógio de uso,
 * pagando o custo e respeitando a recarga própria — e o gatilho entra na recarga dele (0,15 s na "Conjurar no Acerto Crítico").
 * Os eventos das magias entram nos do ataque. Devolve quantas saíram.
 */
export function ativarGatilhos(estado, hunt, personagem, evento, { acao = null, alvo = null } = {}, eventos = []) {
  const cds = (hunt.cooldowns ??= {});
  const agora = hunt.clock ?? 0;
  let n = 0;
  for (const g of Gemas.gruposComGatilho(estado)) {
    if (g.gatilho.quando !== evento) continue;
    // O ataque que dispara tem de estar no MESMO grupo (o dano recebido não tem ataque).
    if (acao && !g.ataques.includes(acao)) continue;
    const chave = `gatilho:${g.chave}`;
    if (cds[chave] && !R.liberou(agora, cds[chave].ate)) continue;
    let saiu = false;
    for (const magia of g.magias) {
      // O alvo do ataque, se ainda vive; senão o bicho vivo mais perto (o do crítico pode ter morrido no golpe).
      const alvoDaMagia = alvo && alvo.hp > 0 ? alvo : hunt.monstros.filter((b) => b.hp > 0).sort((a, b) => distanciaChebyshev(hunt.pos, a) - distanciaChebyshev(hunt.pos, b))[0] ?? null;
      const r = dispararSemMarcar(estado, hunt, personagem, null, alvoDaMagia, { gatilho: { acao: { id: magia, enabled: true, minMana: 0, minTargets: 1, conditions: [] } } });
      if (!r.ok) continue;
      saiu = true;
      n++;
      eventos.push({ t: 'gatilho', quem: personagem?.nome, suporte: g.nome, skill: POR_ID.get(magia)?.name ?? magia }, ...(r.eventos ?? []));
    }
    if (saiu && g.gatilho.recargaMs) cds[chave] = { ate: agora + g.gatilho.recargaMs, total: g.gatilho.recargaMs };
  }
  return n;
}

/**
 * A habilidade que um ÚNICO ativa num evento ("Ativa Disparo Elétrico Nível 20 quando você causar um Golpe Crítico" — `mods-poe.evento`):
 * a gema pelo nome (ela já está entre as ativas do personagem, marcada `ativadaPorItem`), no alvo do evento ou no bicho mais perto, sem custo.
 * Uma por evento a cada 0,25 s (o PoE tem a recarga interna das ativadas).
 */
ModsPoe.definirDisparo((estado, hunt, personagem, nome, nivel, alvo, eventos = []) => {
  const def = Gemas.ativaPeloNome(nome);
  if (!def || !hunt) return;
  const agora = hunt.clock ?? 0;
  const cds = (hunt.cooldowns ??= {});
  const chave = `gatilho-item:${def.acao}`;
  if (cds[chave] && !R.liberou(agora, cds[chave].ate)) return;
  const alvoDaMagia = alvo && alvo.hp > 0 ? alvo : hunt.monstros.filter((b) => b.hp > 0).sort((a, b) => distanciaChebyshev(hunt.pos, a) - distanciaChebyshev(hunt.pos, b))[0] ?? null;
  const r = dispararSemMarcar(estado, hunt, personagem, null, alvoDaMagia, { gatilho: { acao: { id: def.acao, enabled: true, minMana: 0, minTargets: 1, conditions: [] }, semCusto: true } });
  if (!r.ok) return;
  cds[chave] = { ate: agora + 250, total: 250 };
  eventos.push({ t: 'gatilho', quem: personagem?.nome, suporte: 'Item único', skill: def.nome }, ...(r.eventos ?? []));
});

/**
 * O DANO RECEBIDO pelo personagem ("Conjurar ao Receber Dano"): soma no grupo e, passando do limiar do nível do suporte, ativa as magias
 * dele e zera a conta. Quem chama: o golpe do bicho no personagem (`hunt/combate.mjs`).
 */
export function aoReceberDano(estado, hunt, personagem, dano, eventos = []) {
  if (!(dano > 0) || !hunt) return 0;
  let n = 0;
  for (const g of Gemas.gruposComGatilho(estado)) {
    if (g.gatilho.quando !== 'danoRecebido' || !g.magias.length) continue;
    const contas = (hunt.danoParaGatilho ??= {});
    contas[g.chave] = (contas[g.chave] ?? 0) + dano;
    if (contas[g.chave] < (g.gatilho.limiar ?? Infinity)) continue;
    const saiu = ativarGatilhos(estado, hunt, personagem, 'danoRecebido', {}, eventos);
    if (saiu) contas[g.chave] = 0;
    n += saiu;
  }
  return n;
}

const fracaoDeVida = (e) => (e?.hp ?? 0) / Math.max(1, e?.maxHp ?? 1);
/** Os da caçada em grupo (`hunt.partilha.membros`, vivo) — sozinho, só eu. */
const membrosDaSala = (estado, hunt) => hunt?.partilha?.membros?.length ? hunt.partilha.membros : [{ estado, nome: estado.name ?? null }];

/**
 * Em quem a cura do slot cai: "o mais ferido" (a menor fração de vida da sala,
 * você incluído) ou "pelo nome" — sempre só com a vida em até `curarAte`%.
 * `null` se ninguém está na faixa (ou o nome não está na caçada).
 */
function quemCurar(estado, hunt, action) {
  const ate = (action.curarAte ?? 100) / 100;
  let lista = membrosDaSala(estado, hunt).filter((m) => m.estado && (m.estado.hp ?? 0) > 0 && fracaoDeVida(m.estado) <= ate && fracaoDeVida(m.estado) < 1);
  if (action.curarQuem === 'nome') {
    const nome = String(action.curarNome ?? '').trim().toLowerCase();
    lista = lista.filter((m) => String(m.nome ?? m.estado.name ?? '').toLowerCase() === nome);
  }
  if (!lista.length) return null;
  return lista.reduce((a, b) => (fracaoDeVida(b.estado) < fracaoDeVida(a.estado) ? b : a));
}

/**
 * O "Quando chamar" do desafio: sempre que houver bicho no alcance (padrão), ou
 * só quando alguém da party — ou um nome — tiver pelo menos `desafiarMinimo`
 * bichos colados nele (é para tirar bicho dos outros). E "No máximo uma vez a
 * cada N s", além da recarga da magia.
 */
function podeDesafiar(estado, hunt, action, agora) {
  const cada = (action.desafiarCada ?? 0) * 1000;
  const ultimo = hunt.desafiosEm?.[action.id];
  if (cada > 0 && ultimo != null && agora - ultimo < cada) return { ok: false, erro: 'Esperando o intervalo do desafio.', motivo: 'DESAFIO_ESPERA' };
  const quem = action.desafiarQuem ?? 'perto';
  if (quem === 'perto') return { ok: true };
  const nome = String(action.desafiarNome ?? '').trim().toLowerCase();
  const outros = membrosDaSala(estado, hunt).filter((m) => m.estado !== estado && m.estado?.hunt?.pos && (quem !== 'nome' || String(m.nome ?? '').toLowerCase() === nome));
  const minimo = Math.max(1, action.desafiarMinimo ?? 1);
  const vivos = (hunt.monstros ?? []).filter((b) => b.hp > 0 && !b.dummy);
  const apanhando = outros.some((m) => vivos.filter((b) => distanciaChebyshev(m.estado.hunt.pos, b) <= 1).length >= minimo);
  return apanhando ? { ok: true } : { ok: false, erro: 'Ninguém apanhando.', motivo: 'NINGUEM_APANHANDO' };
}

/**
 * "Tirar o escudo quando" (no slot do utamo vita): com o escudo de pé e as
 * condições dessa lista batendo, o exana vita sai sozinho — o escudo cai e o
 * dano volta para a vida. Chamado a cada tique da caçada (`cacadas.autoDisparo`).
 */
export function tirarEscudoSePreciso(estado, hunt, personagem, alvo) {
  if (!temBuff(hunt, 'shield')) return [];
  const regra = (estado.actions ?? []).find(
    (a) => a?.tirarQuando?.length && a.enabled !== false && BUFFS[a.id]?.tipo === 'shield' && condicoesDoSlotBatem({ conditions: a.tirarQuando }, estado, alvo, hunt)
  );
  if (!regra) return [];
  for (const [id, b] of Object.entries(hunt.buffs ?? {})) if (b.tipo === 'shield') delete hunt.buffs[id];
  const quemTira = POR_ID.get(Object.keys(Reforcos.CANCELA).find((id) => Reforcos.CANCELA[id] === 'shield'));
  return [{ t: 'say', uid: 'player', quem: personagem?.nome, text: quemTira?.words ?? 'exana vita', x: hunt.pos.x, y: hunt.pos.y, color: '#f36500' }];
}
