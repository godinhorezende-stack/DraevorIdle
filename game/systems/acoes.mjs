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
import * as QuemFeriu from './hunt/quem-feriu.mjs';
import * as Mecanicas from './mobs/mecanicas.mjs';
import * as Gemas from './skills/gemas.mjs';
import * as Tags from './skills/tags.mjs';
import * as ModsPoe from './itens-poe/mods-poe.mjs';
import { valor as valorPoe, slugDoNome, NO_ACERTO } from './itens-poe/condicoes-poe.mjs';
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
import * as Plantadas from './itens-poe/armas-plantadas.mjs';
import * as Runas from './itens-poe/runas-vinculadas.mjs';
import * as Vinculos from './itens-poe/vinculos.mjs';
import * as Aco from './itens-poe/convocar-o-aco.mjs';
import * as Mercenarios from './itens-poe/mercenarios.mjs';
import * as CargasDoPoe from './itens-poe/cargas.mjs';
import * as Ficha from './ficha.mjs';
import { temHabilidade, efeitos as efeitosDaArvore, arvore as arvoreDasPassivas } from './passivas/arvore.mjs';
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
import * as Protecao from './protecao.mjs';
import * as FrascosPoe from './itens-poe/frascos.mjs';
import { daSala } from './hunt/instancia.mjs';
import * as Encontros from './encontros/estado.mjs';

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
/**
 * (lote 54) O ATAQUE COM O ESCUDO — a mão secundária do PoE com escudo: as gemas que atacam com o dano base da mão secundária ("Dano Físico Base
 * como a Mão Secundária" — Esmagar Escudos, Investida de Escudo, Arremesso Espectral de Escudo…); a tag `ataqueDeEscudo` (a Fúria Fulminante).
 */
const ATAQUE_DE_ESCUDO = new Map();
const ehAtaqueDeEscudo = (slug, gema) => {
  if (!ATAQUE_DE_ESCUDO.has(slug)) ATAQUE_DE_ESCUDO.set(slug, (gema?.mods ?? []).some((m) => /de Dano .*Base (?:cmo a|como a|da) Mão Secund/.test(m)));
  return ATAQUE_DE_ESCUDO.get(slug);
};
export function tagsPoeDaSkill(entry) {
  const gema = entry?.poeGema ? GemasPoe.doSlug(entry.poeGema.slug)?.gema : null;
  const daGema = gema?.tags ?? null;
  // (11/10: as gemas de Estandarte não trazem a tag — "Habilidades de Estandarte têm Duração/Área de Efeito aumentada")
  if (daGema) {
    const t = ModsPoe.tagsDoPoe(daGema);
    // (lote 55, o Olho do Vigia: "Habilidades Não Canalizadoras" — a tag `naoCanalizar` nas que não são de Canalização)
    return [...t, ...(/_Banner$/.test(entry.poeGema.slug) ? ['estandarte'] : []), ...(ehAtaqueDeEscudo(entry.poeGema.slug, gema) ? ['ataqueDeEscudo'] : []), ...(t.includes('canalizar') ? [] : ['naoCanalizar']), 'habilidade'];
  }
  const t = new Set(Tags.tagsDaAcao(entry).map((x) => DRAEVOR_PARA_POE[x]).filter(Boolean));
  if (t.has('corpo') || (t.has('fisico') && t.has('projetil') && !t.has('magia'))) t.add('ataque');
  if (t.has('fogo') || t.has('gelo') || t.has('raio')) t.add('elemental');
  return [...t, 'habilidade'];
}

/**
 * (PoE, 11/10) "X% de chance de abrir Baús próximos quando você Conjurar uma Magia": cada BAÚ da sala (encontro `bau-*` disponível, no seu
 * andar) a até `RAIO_DOS_BAUS` casas abre com a chance como se você o abrisse (`Encontros.ativar`: a chave, a armadilha e os guardiões valem igual).
 */
export const RAIO_DOS_BAUS = 4;
export function abrirBausAoConjurar(estado, hunt, personagem, chance, rng = Math.random) {
  if (!(chance > 0) || !hunt?.pos) return 0;
  const inst = daSala(hunt);
  let abertos = 0;
  for (const e of Object.values(inst?.encontros ?? {})) {
    if (!String(e.tipo).startsWith('bau') || e.estado !== 'disponivel' || e.x == null || (e.z != null && e.z !== hunt.z)) continue;
    if (Math.max(Math.abs(hunt.pos.x - e.x), Math.abs(hunt.pos.y - e.y)) > RAIO_DOS_BAUS || !(rng() * 100 < chance)) continue;
    if (Encontros.ativar(inst, e.id, { quem: personagem?.nome ?? null, agora: (hunt.anfitriao ?? hunt).clock ?? 0, hunt, estado, personagem }).ok) abertos++;
  }
  return abertos;
}

/**
 * (lote 46) O RAIO do Clamor em casas: `base` (os metros da gema ÷ 2) × √ da "Área de Efeito aumentada" e de cada "mais" — a geral e a das tags
 * da gema ("Habilidades de Clamor têm Efeito em Área aumentado em X%" — `area_inc@clamor`); a fração, a chance de uma casa a mais.
 */
export function raioDoClamor(estado, entry, base, rng = Math.random) {
  const f = Ficha.combate(estado);
  const tags = ModsPoe.somaPorTags(f, tagsPoeDaSkill(entry));
  const fator = ModsPoe.fatorDaArea(ModsPoe.valor(f, 'area_inc') + (tags.area_inc ?? 0), ModsPoe.valor(f, 'area_mais') + (tags.area_mais ?? 0));
  return base + ModsPoe.casasPelaArea(base, fator, rng);
}

/**
 * (PoE, 11/10) O RAIO da aura em casas: o da gema (`GemasPoe.buffNoNivel`) × √(1 + a "Área de Efeito aumentada" — a geral e a das tags dela,
 * "Efeito em Área de Habilidades de Aura aumentado"). É até onde ela vale nos companheiros de grupo (`GemasPoe.adds`).
 */
export function raioDaAuraDe(estado, entry, base, mais = 1) {
  const f = Ficha.combate(estado);
  const tags = ModsPoe.somaPorTags(f, tagsPoeDaSkill(entry));
  // (13/10: + o "X% mais Área de Efeito" — `area_mais`, multiplica)
  const maisArea = Math.max(0, 1 + (ModsPoe.valor(f, 'area_mais') + (tags.area_mais ?? 0)) / 100);
  return Math.max(1, Math.round(base * Math.sqrt(Math.max(0.1, 1 + (ModsPoe.valor(f, 'area_inc') + (tags.area_inc ?? 0)) / 100) * Math.max(0.1, mais) * maisArea)));
}

/**
 * (PoE, 11/10) Os SUPORTES no acerto: a CRUELDADE ("Acertos de Habilidades Suportadas concedem Crueldade" — o buff por N s, com o "Efeito da
 * Crueldade concedido aumentado" do suporte); a LÂMINA NOTURNA ("concedem Elusivo no Golpe Crítico", com o efeito do suporte e o da árvore —
 * "Habilidades Suportadas por Lâmina Noturna têm Efeito do Elusivo aumentado"); o GOLPE IMPIEDOSO (o atordoamento base dele; "Acertos
 * Impiedosos Intimidam Inimigos por N segundos").
 */
export const ELUSIVO_DA_LAMINA_S = 4;
function efeitosDosSuportesNoAcerto(estado, hunt, bicho, ficha, efeito, { crit = false, impiedoso = false, agora = hunt?.clock ?? 0, eventos = [] } = {}) {
  const saida = { atordoou: false };
  if (!efeito || !itensPoeLigado()) return saida;
  const efeitoDeBuff = (hunt.poeEfeitoDeBuff ??= {});
  if (efeito.crueldade > 0) {
    const tinha = ModsPoe.buffAtivo(estado, 'crueldade');
    ModsPoe.ganharBuff(hunt, 'crueldade', ((efeito.crueldadeMs ?? 4000) / 1000) * Math.max(0.1, 1 + (efeito.duracaoPct ?? 0) / 100), agora);
    efeitoDeBuff.crueldade = efeito.crueldadeEfeitoPct ?? 0;
    if (!tinha) Ficha.invalidar(estado);
  }
  // (lote 33: o Elusivo não se ganha de novo enquanto há um; o efeito da Lâmina Noturna entra no efeito inicial dele — `ModsPoe.ganharBuff`)
  if (crit && efeito.elusivoNoCritico > 0 && !ModsPoe.buffAtivo(estado, 'elusivo')) {
    ModsPoe.ganharBuff(hunt, 'elusivo', ELUSIVO_DA_LAMINA_S, agora, { efeitoExtra: (efeito.elusivoEfeitoPct ?? 0) + ModsPoe.valor(ficha, 'lamina_elusivo_efeito') });
    Ficha.invalidar(estado);
  }
  if (impiedoso && bicho.hp > 0) {
    const ms = Math.round((efeito.impiedosoAtordoamentoMs ?? 0) * Math.max(0.1, 1 + ModsPoe.valor(ficha, 'stun_duration') / 100));
    if (ms > 0 && Estados.atordoar(bicho, ms, agora, !!hunt.isBoss)) { saida.atordoou = true; eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'atordoado' }); }
    const intimida = ModsPoe.valor(ficha, 'impiedoso_intimida_s');
    if (intimida > 0) (bicho.estados ??= {}).intimidado = { ate: Math.max(bicho.estados?.intimidado?.ate ?? 0, agora + intimida * 1000) };
  }
  return saida;
}
/**
 * (PoE, o Mestre Destilador) "Concede bônus para Habilidades Não Canalizadoras usadas por você consumindo 3 Cargas de um Frasco de cada um dos
 * seguintes tipos, se possível": Diamante ("Chance de Golpe Crítico aumentado em X%"), Bismuto ("Penetra X% das Resistências Elementais"),
 * Ametista ("X% do Dano Físico como Dano Extra de Caos"). Devolve a ficha deste uso.
 */
const FRASCOS_DO_DESTILADOR = { Diamond_Flask: 'destilador_diamante_crit', Bismuth_Flask: 'destilador_bismuto_pen', Amethyst_Flask: 'destilador_ametista_caos' };
export function doDestilador(estado, ficha, entry) {
  if (!itensPoeLigado() || !ficha?.afPoe || tagsPoeDaSkill(entry).includes('canalizar')) return ficha;
  const bonus = {};
  for (const p of FrascosPoe.cinto(estado)) {
    const base = String(p?.poe?.base ?? '').split('/').pop();
    const stat = FRASCOS_DO_DESTILADOR[base];
    if (!stat || bonus[stat] != null || !(ModsPoe.valor(ficha, stat) > 0)) continue;
    // ("consumindo N Cargas" — a linha de cabeçalho do nó, `destilador_consome`)
    const consome = Math.max(1, Math.round(ModsPoe.valor(ficha, 'destilador_consome') || 3));
    const cargas = FrascosPoe.cargasDe(p);
    if (cargas < consome) continue;
    p.poe.cargas = cargas - consome;
    bonus[stat] = ModsPoe.valor(ficha, stat);
  }
  if (!Object.keys(bonus).length) return ficha;
  const f = { ...ficha, afPoe: { ...ficha.afPoe } };
  if (bonus.destilador_diamante_crit && f.critPontos != null) f.critChance = Math.min(f.critTeto ?? 1, f.critPontos * (1 + ((f.critInc ?? 0) + bonus.destilador_diamante_crit) / 100) * (f.critMais ?? 1));
  if (bonus.destilador_bismuto_pen) f.penetracao = { ...(f.penetracao ?? {}), elemental: (Number(f.penetracao?.elemental) || 0) + bonus.destilador_bismuto_pen };
  if (bonus.destilador_ametista_caos) f.afPoe.phys_as_extra_chaos = (Number(f.afPoe.phys_as_extra_chaos) || 0) + bonus.destilador_ametista_caos;
  return f;
}

/**
 * (PoE, o Assassino — Mortífero) "Ativa Marca do Assassino nível N ao causar golpe crítico com ataques contra um inimigo raro ou único e você não
 * tem uma marca": a gema da Marca no nível N, como se você a lançasse, marca o alvo (`Reforcos.marcar`).
 */
function marcaDoAssassino(estado, hunt, bicho, ficha, agora = hunt?.clock ?? 0) {
  const nivel = Math.round(ModsPoe.valor(ficha, 'marca_assassino_ao_critico'));
  if (!(nivel > 0) || !itensPoeLigado() || !(bicho?.hp > 0) || !(['raro', 'unico'].includes(bicho.raridade) || bicho.boss)) return;
  if ((hunt.monstros ?? []).some((m) => m.hp > 0 && ModsPoe.marcaNoBicho(m, agora))) return;
  const gema = GemasPoe.doSlug('Assassins_Mark');
  const entryDaMarca = gema ? POR_ID_PUBLICO(gema.acao) : null;
  const buff = gema ? BUFFS[gema.acao] : null;
  if (!entryDaMarca || !buff) return;
  const doPoe = GemasPoe.buffNoNivel('Assassins_Mark', nivel);
  (hunt.buffs ??= {})[gema.acao] = { ate: agora + doPoe.dur, desde: agora, tipo: buff.tipo, fator: 1, efeitosPoe: efeitosDaMaldicao(doPoe.efeitos, { nivel }, estado, entryDaMarca), afPoe: doPoe.af };
  Reforcos.marcar(hunt, bicho, agora);
}

/**
 * (PoE, o Libertar) Os SELOS de uma magia: um a cada N ms desde a última conjuração, até o máximo (+ "+N ao número máximo de Selos"); gasta todos.
 * (lote 73, o Cersidor de Selos: `freqPct` — "frequência de ganho de Selo aumentada em X%": o intervalo ÷ (1 + X%).)
 */
export function selosAgora(hunt, id, efeito, extra = 0, agora = hunt?.clock ?? 0, freqPct = 0) {
  const s = ((hunt.poeSelos ??= {})[id] ??= { desde: agora });
  const max = Math.max(0, Math.round((efeito.selosMax ?? 0) + extra));
  // (o tempo × a frequência, ÷ o intervalo: sem a divisão do intervalo, que perdia um Selo nos múltiplos exatos — 2000 ÷ (800 ÷ 1,2))
  const n = Math.min(max, Math.floor((Math.max(0, agora - s.desde) * Math.max(0.1, 1 + freqPct / 100)) / Math.max(1, efeito.seloIntervaloMs) + 1e-9));
  s.desde = agora;
  return n;
}
/**
 * (PoE, o Intensificar) A INTENSIDADE de uma magia agora: a que tinha, menos 1 a cada N ms andando ("perdem 1 de Intensidade a cada 0.5 segundos
 * enquanto se movendo" — andou depois da última conjuração: o tempo desde ela conta como andando).
 */
export function intensidadeAgora(hunt, id, efeito, agora = hunt?.clock ?? 0, af = null) {
  const i = hunt.poeIntensidade?.[id];
  if (!i) return 0;
  const andou = hunt.poeRecente?.moveu != null && hunt.poeRecente.moveu > i.em;
  const perde = andou && efeito.intensidadePerdaMs > 0 ? Math.floor((agora - i.em) / efeito.intensidadePerdaMs) : 0;
  // (lote 53) o MODO ALFA — "Magias que ganharam Intensidade Recentemente ganham 1 de Intensidade a cada 0.5 Segundos" (o ganho também é ganhar:
  // não para) — e o MODO NADIR — "… perdem 1 de Intensidade a cada 0.5 Segundos" (nos 4 s do Recentemente depois do último ganho). O teto, o
  // da gema (+ "+N à Intensidade máxima").
  const v = (k) => Number(af?.[k]) || 0;
  const ganha = v('intensidade_ganho_s') > 0 ? Math.floor((agora - i.em) / (v('intensidade_ganho_s') * 1000)) * (v('intensidade_ganho_n') || 1) : 0;
  const nadir = v('intensidade_perda_s') > 0 ? Math.floor(Math.min(agora - i.em, ModsPoe.RECENTE_MS) / (v('intensidade_perda_s') * 1000)) * (v('intensidade_perda_n') || 1) : 0;
  const teto = Math.max(0, Math.round((efeito.intensidadeMax ?? 0) + v('intensidade_max_extra')));
  // (o saldo e depois o teto: ganhar 1 e perder 1 a cada 0,5 s andando se anulam, como no PoE)
  return Math.max(0, Math.min(Math.max(teto, i.n), i.n + ganha - perde - nadir));
}
export function ganharIntensidade(hunt, id, efeito, extra = 0, agora = hunt?.clock ?? 0, af = null) {
  const n = intensidadeAgora(hunt, id, efeito, agora, af);
  (hunt.poeIntensidade ??= {})[id] = { n: Math.min(Math.max(0, Math.round((efeito.intensidadeMax ?? 0) + extra)), n + 1), em: agora };
}
/** (lote 53, o Modo Alfa / Nadir) "Magias têm Chance de Golpe Crítico reduzida/aumentada em X% por Intensidade": o "aumentado" de crítico da magia. */
export function comCriticoDaIntensidade(ficha, intensidade) {
  const pct = ModsPoe.valor(ficha, 'crit_inc_magia_por_intensidade');
  if (!(intensidade > 0) || !pct || !ficha?.critMagiaPoe) return ficha;
  return { ...ficha, critMagiaPoe: { ...ficha.critMagiaPoe, aumentada: ficha.critMagiaPoe.aumentada + pct * intensidade } };
}

/** PoE: a "Duração do Efeito de Habilidades" das peças (com condição: "Habilidades de Armadilha…", o anel do lado certo), em %. */
export function duracaoDasPecas(estado, entry) {
  const f = Ficha.combate(estado);
  return ModsPoe.valor(f, 'duracao_habilidades') + (ModsPoe.somaPorTags(f, tagsPoeDaSkill(entry)).duracao_habilidades ?? 0);
}
/**
 * (13/10) O FATOR da duração de uma habilidade: (1 + o aumentado da gema e das peças) × (1 + "X% mais/menos Duração do Efeito de
 * Habilidades" — `duracao_mais`, que multiplica, como no PoE; antes entrava somado ao aumentado).
 */
export function fatorDeDuracao(estado, entry, efeitoDaGema) {
  const f = Ficha.combate(estado);
  const mais = ModsPoe.valor(f, 'duracao_mais') + (ModsPoe.somaPorTags(f, tagsPoeDaSkill(entry)).duracao_mais ?? 0);
  return Math.max(0.1, 1 + ((efeitoDaGema?.duracaoPct ?? 0) + duracaoDasPecas(estado, entry)) / 100) * Math.max(0, 1 + mais / 100);
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
/*
 * ---- DUAS ARMAS na gema de ATAQUE (PoE) ----
 * Como no PoE e como o golpe básico (`hunt/combate.mjs`): o ataque ALTERNA entre a mão principal e a secundária, cada uso com o dano da
 * SUA arma, no mesmo revezamento do golpe básico (`hunt.golpeDaSecundaria`); a velocidade já é a média dos dois tempos
 * (`Ficha.intervaloDoGolpeMs`). A gema que acerta com AS DUAS ("Causa 60 % do Dano combinando cada Arma" — Cutilada; 75% nas Lâminas
 * Giratórias; o Ataque Combinado, "o dano de ambas em um ataque") soma as duas faixas nessa %. Antes a gema usava sempre a mão principal.
 * O CRÍTICO segue a mão (`Ficha.fichaDaMao`): o uso da secundária rola o crítico da arma dela; o que combina as duas, a média dos dois
 * pesada pelo dano de cada mão.
 * `hunt`: o uso de verdade (alterna); sem ele (o balão), a mão principal. `{ arma, ficha }` — a faixa e a ficha deste uso; null: a da
 * ficha (uma arma, magia ou fora do PoE).
 */
function maoDaGemaDeAtaque(entry, ficha, hunt = null) {
  if (!entry.poeGema?.ataque || !ficha?.duasArmas) return null;
  const secundaria = { min: Math.max(1, Math.round(ficha.ataqueSecundarioMin ?? 0)), max: Math.max(1, Math.round(ficha.ataqueSecundarioMax ?? 0)) };
  const combinada = GemasPoe.danoComAsDuasArmas(entry.poeGema.slug);
  if (combinada != null) {
    const pesos = [(ficha.damage.min + ficha.damage.max) / 2, (secundaria.min + secundaria.max) / 2];
    return { arma: { min: ((ficha.damage.min + secundaria.min) * combinada) / 100, max: ((ficha.damage.max + secundaria.max) * combinada) / 100 }, ficha: Ficha.fichaDaMao(ficha, 'ambas', pesos) };
  }
  if (!hunt) return null;
  return (hunt.golpeDaSecundaria = !hunt.golpeDaSecundaria) ? { arma: secundaria, ficha: Ficha.fichaDaMao(ficha, 'secundaria') } : null;
}

function contaDoDano(estado, entry, efeitoDaGema, fichaBase = Ficha.combate(estado), armaDoUso = null, { ativada = false, custaVida = false, maisDano = 0 } = {}) {
  // PoE: a ficha DESTA habilidade — os mods condicionais pelas tags dela ("Dano em Área", "Chance de Crítico com Habilidades de Fogo"…) e os
  // sorteios do uso (dano dobrado, ignorar a redução física) — `itens-poe/mods-poe.mjs`. Sem o PoE, a mesma ficha. (+ a habilidade ATIVADA por
  // um gatilho — os suportes, as peças, os únicos — leva a tag `ativada`: "Magias ativadas envenenam ao atingir".)
  const tagsDoUso = tagsPoeDaSkill(entry);
  // (+ a tag `custaVida` — a habilidade paga com Vida: "Dano Físico com Habilidades que Custam Vida aumentado em X%")
  const tagsDoGolpe = [...tagsDoUso, ...(ativada && !tagsDoUso.includes('ativada') ? ['ativada'] : []), ...(custaVida ? ['custaVida'] : [])];
  fichaBase = ModsPoe.fichaDoGolpe(fichaBase, tagsDoGolpe, { estado });
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
  // A faixa da ARMA deste uso (duas armas: a da mão da vez, ou as duas combinadas — `maoDaGemaDeAtaque`).
  const armaDoGolpe0 = armaDoUso ?? fichaBase.damage ?? { min: 1, max: 1 };
  // (PoE: "X% mais Dano Físico Máximo de Ataques" — o máximo da arma no golpe de ataque.)
  const maisNoMaximo = ModsPoe.valor(fichaBase, 'fisico_max_mais');
  const armaDoGolpe = maisNoMaximo ? { ...armaDoGolpe0, max: armaDoGolpe0.max * Math.max(0, 1 + maisNoMaximo / 100) } : armaDoGolpe0;
  const doNivel = daGemaPoe
    ? daGemaPoe.ataque
      ? { min: armaDoGolpe.min * GemasPoe.eficaciaNoNivel(daGemaPoe.slug, nivelPoe), max: armaDoGolpe.max * GemasPoe.eficaciaNoNivel(daGemaPoe.slug, nivelPoe) }
      : GemasPoe.danoNoNivel(daGemaPoe.slug, nivelPoe)
    : danoNoLevel(entry, ehAtaque ? estado.level : nivelDoDano(estado, entry, defDaGema));
  const identidade = ehAtaque && !daGemaPoe ? Poder.poderEfetivo(estado, Gemas.habilidadeDeEscala(defDaGema), entry.element).identidade : 1;
  const escala = fichaBase.danoDeEscala ?? fichaBase.damage;
  const fatorDaFicha = ehAtaque && !daGemaPoe ? (((escala.min + escala.max) / 2) / Poder.danoNormalDeReferencia(estado.level)) * identidade : 1;
  // Sistema de itens do PoE (Fase 1; sem peças do PoE nada disto muda):
  //  - um ATAQUE do PoE = golpe físico de perto ou de longe (tags physical + melee/ranged, como o Brutal Strike): o dano somado a
  //    ataques de TODOS os elementos ("Adiciona X a Y de Dano de Fogo a Ataques") entra na faixa, como no golpe da arma;
  //  - uma MAGIA (o resto das skills com tag spell): o dano somado a magias do mesmo elemento dela entra na faixa antes dos aumentos,
  //    e a chance de crítico é a de magia (`critChanceMagia`). Dano somado de outro elemento não entra (a magia tem um elemento só) — só na
  //    skill que não é gema do PoE: na gema (abaixo, lote 32), o adicionado às magias de todo tipo entra, × a eficácia do dano adicionado.
  const tagsDaSkill = Tags.tagsDaAcao(entry);
  // A gema do PoE diz o que é (tipo "Attack" ou "Spell" no poedb); as outras skills, pelas tags.
  const ehAtaqueDoPoe = !entry.heals && (daGemaPoe ? !!daGemaPoe.ataque : tagsDaSkill.includes('physical') && (tagsDaSkill.includes('melee') || tagsDaSkill.includes('ranged')));
  const ehMagia = !entry.heals && !ehAtaqueDoPoe && (daGemaPoe ? true : tagsDaSkill.includes('spell'));
  const [somadoMin, somadoMax] = ehAtaqueDoPoe
    ? Object.values(fichaBase.danoSomado ?? {}).reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0])
    : ehMagia ? fichaBase.danoSomadoMagia?.[entry.element] ?? [0, 0] : [0, 0];
  // O dano ADICIONADO dos suportes do PoE ("têm 10 a 15 de Dano de Gelo adicional") × a eficácia do dano adicionado da gema.
  // (S002, lote 47: a eficácia da MAGIA é a do PoB por nível — `GemasPoe.eficaciaDoAdicionado`; antes, 1 em todas)
  const eficacia = daGemaPoe ? (daGemaPoe.ataque ? 1 : GemasPoe.eficaciaDoAdicionado(daGemaPoe.slug, nivelPoe)) : 1;
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
      const doFisico = ModsPoe.extrasDoFisico(fichaBase, [armaDoGolpe.min, armaDoGolpe.max]);
      for (const [el, [a, b]] of Object.entries(doFisico.extras)) extras[el] = [(extras[el]?.[0] ?? 0) + a, (extras[el]?.[1] ?? 0) + b];
      const fConv = 1 - doFisico.convertidoPct / 100;
      for (const [el, v] of Object.entries(GemasPoe.partesDoAtaque(daGemaPoe.slug, nivelPoe, { min: armaDoGolpe.min * fConv, max: armaDoGolpe.max * fConv }, extras))) somar(el, v);
    } else {
      const daMagia = GemasPoe.partesDaMagia(daGemaPoe.slug, nivelPoe);
      for (const [el, v] of Object.entries(daMagia)) somar(el, v);
      // (lote 32, P071: o dano ADICIONADO às magias das peças e do Mago de Batalha — de todo tipo, não só dos elementos da magia ("Adiciona X a Y de
      // Dano de Fogo às Magias" vale numa magia de Gelo), × a eficácia do dano adicionado, como o dos suportes)
      for (const [el, v] of Object.entries(fichaBase.danoSomadoMagia ?? {})) somar(el, v, eficacia);
      for (const [el, v] of Object.entries(doSuporte)) somar(el, v, eficacia);
      // (14/10, o Feiticeiro: "Dano Mágico Adicional igual a X% do Dano da Varinha Equipada" — cada elemento da varinha, × a eficácia do dano
      // adicionado, como o dos suportes)
      if (efeitoDaGema?.feiticeiro) {
        const f = GemasPoe.feiticeiroNoNivel(efeitoDaGema.feiticeiro.nivel);
        for (const [el, [a, b]] of Object.entries(fichaBase.danoDasVarinhas ?? {})) somar(el, [(a * f.pct) / 100, (b * f.pct) / 100], eficacia);
      }
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
  // (a chance trocada não é a Sortuda da ficha — `critSortudo` sai: o sorteio do golpe rola duas vezes, `Ficha.rolarCritico`)
  if (ehMagia && fichaBase.critChanceMagia != null && fichaBase.critChanceMagia !== fichaBase.critChance) ficha = { ...ficha, critChance: fichaBase.critChanceMagia, critSortudo: false };
  // A magia do PoE: a chance-base é a da GEMA no nível (+ os "+% de chance" fixos) × os "aumentada" (geral e de magias), como no PoE.
  if (ehMagia && daGemaPoe && fichaBase.critMagiaPoe) {
    // (+ "Chance de Golpe Crítico Mágico de Magias é igual ao da sua Arma Principal": a base é o crítico da arma — `ficha.arma`.)
    const daArma = ModsPoe.valor(fichaBase, 'critico_magia_da_arma') > 0 && fichaBase.arma?.critChance ? (Number(fichaBase.arma.critChance.final) || 0) / 10000 : null;
    const daGema = daArma ?? GemasPoe.criticoBaseNoNivel(daGemaPoe.slug, nivelPoe) ?? 0;
    const cm = fichaBase.critMagiaPoe;
    ficha = { ...ficha, critChance: Math.min(1, Math.max(0, (daGema + cm.fixa) * (1 + cm.aumentada / 100) * (cm.mais ?? 1))), critBaseDaGema: daGema, critSortudo: false };
  }
  // (A proficiência de arma saiu — dono, 06/10: o "% da perícia como dano" e o crítico de runa dela não existem mais.)
  const daPericia = 0;
  // O treino em %: magic level (mágicas), melee (físicas de perto), distance (físicas de longe).
  const doTreino = defDaGema ? Gemas.bonusDoTreino(estado, defDaGema, fichaBase) : fichaBase.skillBonus?.magic ?? 0;
  // A gema: o crítico das supports soma na chance/dano; o nível e as supports multiplicam o dano.
  if (efeitoDaGema?.critChance || efeitoDaGema?.critDano) ficha = { ...ficha, critChance: ficha.critChance + (efeitoDaGema.critChance ?? 0) / 100, critMultiplier: ficha.critMultiplier + (efeitoDaGema.critDano ?? 0) / 100 };
  // (14/10, o Feiticeiro: "Habilidades Suportadas causam X% menos Dano com Acertos e Afecções")
  const menosDoFeiticeiro = efeitoDaGema?.feiticeiro && daGemaPoe ? Math.max(0, 1 - GemasPoe.feiticeiroNoNivel(efeitoDaGema.feiticeiro.nivel).menos / 100) : 1;
  // (14/10, as Miragens Suspensas: "Habilidades usadas por Miragens Suspensas causam X% menos Dano" — `maisDano` do gatilho)
  const fatorDaGema = (1 + (efeitoDaGema?.danoPct ?? 0) / 100) * (efeitoDaGema?.fatorDeDano ?? 1) * menosDoFeiticeiro * Math.max(0, 1 + (Number(maisDano) || 0) / 100);
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
  const doElemento = (ficha.danoDoElemento?.[entry.element] ?? 0) - (daGemaPoe && entry.element === 'physical' && !Ficha.forcaNoGolpe(ficha, tags) ? ficha.danoFisicoDaForca ?? 0 : 0);
  const afinidade = entry.poeGema ? 0 : Ficha.afinidadePara(ficha, tags).pct;
  const mult = (1 + ((ficha.danoDeMagia ?? 0) + (ehMagia ? ficha.danoDeMagiaDoPoe ?? 0 : 0) + doElemento + (daGema?.dano ?? 0) + treino + doReforco + afinidade) / 100) * sintonia;
  // O multiplicador de CADA elemento da gema do PoE: o mesmo `mult`, trocando o "aumentado" do elemento da skill pelo da parte.
  const doElementoDe = (el) => (ficha.danoDoElemento?.[el] ?? 0) - (el === 'physical' && !Ficha.forcaNoGolpe(ficha, tags) ? ficha.danoFisicoDaForca ?? 0 : 0);
  if (partes) for (const p of partes) p.mult = mult + ((doElementoDe(p.elemento) - doElemento) / 100) * sintonia;
  // (13/10, a Sobrecarga Elemental: "Habilidades que causaram um Golpe Crítico nos últimos 8 segundos causam 40% mais Dano Elemental" — a parte
  // de Fogo, Gelo e Raio desta habilidade, se ela critou há pouco; + 14/10, o "X% mais Dano Elemental" do Liberto: `ModsPoe.fatorDoDanoElemental`.)
  if (partes) for (const p of partes) p.mult *= ModsPoe.fatorDoDanoElemental(ficha, hunt, entry.id, p.elemento);
  // (`sobrecarga`, à parte do `mult` — que é a base do "aumentado" por projétil: o golpe sem partes e o balão multiplicam por ele)
  const sobrecarga = ModsPoe.fatorDoDanoElemental(ficha, hunt, entry.id, entry.element);
  // "X% mais Dano por cada tipo de Afecção Elemental no Inimigo" (Acerto Elemental do Espectro).
  const porAfeccao = daGemaPoe ? GemasPoe.extrasDoAtaque(daGemaPoe.slug, nivelPoe, efeitoDaGema?.qualidade ?? 0).porAfeccao : 0;
  // (lote 31, P043: o multiplicador da parte Física e a eficácia do dano adicionado — o Físico adicional por Empalamento, alvo a alvo)
  const multFisico = (mult + ((doElementoDe('physical') - doElemento) / 100) * sintonia) * ModsPoe.fatorDoDanoElemental(ficha, hunt, entry.id, 'physical');
  return { min, max, daPericia, mult, sobrecarga, fatorDaGema, ficha, partes, porAfeccao, ehMagia, sintonia, multFisico, eficacia };
}

/**
 * (14/10) O GUARDIAN — os lacaios das ascendências que não são gemas: o SENTINELA DO RESPLENDOR (a Cruzada Radiante: "Concede a Habilidade
 * Convocar Sentinela do Resplendor Nível 20" — sai sozinho, como o jogo usa as habilidades sozinho; volta 0,75 s depois de morrer — o tempo de
 * conjuração; segue você, ataca corpo a corpo e queima os inimigos a até 2 casas — 20% da vida dele por segundo, como Fogo —; "20% do Dano dos
 * Acertos é sofrido na vida do seu Sentinela antes da sua" — `arvore.danoRecebido`) e a RELÍQUIA ELEMENTAL (a Cruzada Implacável: a chance a
 * cada ocasião pendente — `ModsPoe.notarParaReliquia` —, recarga de 0,3 s; um elemento ao acaso, a aura dele — a Cólera, o Ódio ou a Ira nível
 * 20 — por 5 s; a do mesmo elemento só renova; explode ao morrer — `cacadas`). A vida e o golpe (lote 44, dono: "Aplicar o PoB"): os do PoE
 * no nível do dono (até 85) — a tabela de aliados × o multiplicador do Sentinela (12 de vida, 20 × 3 de golpe a cada 2,96 s) e das Relíquias
 * (4 de vida, 60% dela em escudo de energia), com a armadura e as resistências do PoB (`LacaiosPoe.forcaDoPob`) —, com a "Vida/Dano dos
 * Lacaios" dele.
 */
const GUARDIAN = Object.freeze({ sentinelaNome: 'Sentinela do Resplendor', sentinelaVoltaMs: 750, queimaPctPorS: 20, reliquiaDoPob: { fire: 'GuardianRelicFire', ice: 'GuardianRelicCold', energy: 'GuardianRelicLightning' }, auraDaReliquia: { fire: 'Anger', ice: 'Hatred', energy: 'Wrath' }, nomeDaReliquia: { fire: 'Relíquia de Fogo', ice: 'Relíquia de Gelo', energy: 'Relíquia de Raio' } });
function lacaioDoGuardian(estado, hunt, agora, af, nome, elemento, extra) {
  const nivel = Math.min(85, Math.max(1, estado.level ?? 1));
  // (lote 44, dono: "Aplicar o PoB") `extra.pob`: o tipo do lacaio no Path of Building — a vida, o golpe e o tempo de ataque da tabela de
  // aliados × o multiplicador dele, e as defesas de base (`LacaiosPoe.forcaDoPob`); sem ele, a força de um monstro comum do nível.
  const { pob: idDoPob, ...resto } = extra ?? {};
  const f0 = LacaiosPoe.forcaDoNivel(nivel);
  const p = idDoPob ? LacaiosPoe.forcaDoPob(idDoPob, nivel) : null;
  const f = p ? { vida: p.vida, dano: p.dano ?? f0.dano, tempo: p.tempo ?? f0.tempo } : f0;
  const spread = p?.spread ?? 0.2;
  const vida = Math.max(10, Math.round(f.vida * (1 + (Number(af?.minion_life) || 0) / 100)));
  const golpe = f.dano * (1 + (Number(af?.minion_dmg) || 0) / 100);
  const desenho = LacaiosPoe.desenhoDe(nome, elemento, false);
  const es = p?.es > 0 ? Math.round(p.es) : 0;
  return {
    uid: `lacaio:${Date.now().toString(36)}${(seqDeLacaio++).toString(36)}`, gema: null, acao: null, tipo: 'lacaio', nome, nivel,
    x: hunt.pos.x, y: hunt.pos.y, dir: hunt.pos.dir ?? 2, look: desenho.look, lookItem: desenho.lookItem ?? 0, colors: desenho.colors,
    hp: vida, maxHp: vida, dano: { min: Math.max(1, Math.round(golpe * (1 - spread))), max: Math.max(1, Math.round(golpe * (1 + spread))) }, elemento, intervaloMs: Math.round(f.tempo * 1000),
    ate: null, duracaoMs: null, perto: 2, alcance: 0, alcanceDeAtaque: 1, proximoGolpe: agora + 400, proximoPassoEm: 0,
    estilo: null, velAtaquePct: 0, critChance: 5, critMult: 1.5, somado: [0, 0], afDono: null, porLacaioFisico: null, golem: false, acertos: 0,
    poe: p ? LacaiosPoe.poeDeBase(p) : null, ...(es ? { es, maxEs: es } : {}), ...(p ? { pob: idDoPob } : {}), ...(p?.imune ? { intocavel: true } : {}),
    ...resto,
  };
}
/** (`agora`: o relógio dos lacaios — `hunt.ultimoTique`, o do tique da caçada.) */
export function tiqueDoGuardian(estado, hunt, agora = hunt?.ultimoTique ?? Date.now(), rng = Math.random) {
  if (!itensPoeLigado() || !hunt?.pos) return;
  const af = Ficha.combate(estado).afPoe ?? {};
  hunt.lacaios ??= [];
  // O Sentinela: com o nó, sempre um; sem o nó, sai.
  const sentinela = hunt.lacaios.find((l) => l.sentinela && l.hp > 0);
  if (Number(af.sentinela_do_resplendor) > 0) {
    if (!sentinela) {
      hunt.poeSentinelaVoltaEm ??= agora + GUARDIAN.sentinelaVoltaMs;
      if (agora >= hunt.poeSentinelaVoltaEm) {
        hunt.lacaios.push(lacaioDoGuardian(estado, hunt, agora, af, GUARDIAN.sentinelaNome, 'physical', { sentinela: true, pob: 'GuardianSentinel' }));
        delete hunt.poeSentinelaVoltaEm;
      }
    }
  } else if (sentinela) sentinela.hp = 0;
  // A Relíquia: a chance a cada ocasião pendente (na recarga, a ocasião se perde).
  const pendentes = hunt.poeReliquiaPendente ?? 0;
  delete hunt.poeReliquiaPendente;
  const chance = Number(af.reliquia_elemental) || 0;
  for (let i = 0; i < pendentes && chance > 0; i++) {
    if (agora < (hunt.poeReliquiaRecargaAte ?? 0) || !(rng() * 100 < chance)) continue;
    hunt.poeReliquiaRecargaAte = agora + ModsPoe.RELIQUIA.recargaMs;
    const elemento = ['fire', 'ice', 'energy'][Math.floor(rng() * 3)];
    const mesma = hunt.lacaios.find((l) => l.reliquia === elemento && l.hp > 0 && l.ate > agora);
    if (mesma) { mesma.ate = agora + ModsPoe.RELIQUIA.duracaoMs; continue; }
    const auraAf = { ...(GemasPoe.buffNoNivel(GUARDIAN.auraDaReliquia[elemento], 20)?.af ?? {}) };
    hunt.lacaios.push(lacaioDoGuardian(estado, hunt, agora, af, GUARDIAN.nomeDaReliquia[elemento], elemento, { reliquia: elemento, auraAf, semAtaque: true, ate: agora + ModsPoe.RELIQUIA.duracaoMs, duracaoMs: ModsPoe.RELIQUIA.duracaoMs, pob: GUARDIAN.reliquiaDoPob[elemento] }));
    Ficha.invalidar(estado);
  }
}
/** A queima do Sentinela (20% da vida dele por segundo, como Fogo, nos inimigos a até 2 casas) num tique de `ms`. */
export function queimaDoSentinela(hunt, l, ficha, ms, eventos = []) {
  const dano = (l.maxHp * GUARDIAN.queimaPctPorS) / 100 * (ms / 1000);
  for (const b of hunt.monstros ?? []) {
    if (!(b.hp > 0) || b.dummy || Math.max(Math.abs(b.x - l.x), Math.abs(b.y - l.y)) > 2) continue;
    const v = Math.round(resistido(hunt, b, 'fire', dano, ficha));
    if (!(v > 0)) continue;
    b.hp -= v;
    QuemFeriu.carimbar(b, QuemFeriu.LACAIO); // (lote 31, S001: o Sentinela é lacaio)
    eventos.push({ t: 'dmg', uid: b.uid, x: b.x, y: b.y, v, foe: true, lacaio: true, alvo: b.name, color: COR_DO_ELEMENTO.fire ?? '#ff9900' });
  }
  return eventos;
}
/** A explosão da Relíquia ao morrer (ou acabar): 100% da vida dela como dano do elemento, nos inimigos a até 2 casas. */
export function explosaoDaReliquia(hunt, l, ficha, eventos = []) {
  for (const b of hunt.monstros ?? []) {
    if (!(b.hp > 0) || b.dummy || Math.max(Math.abs(b.x - l.x), Math.abs(b.y - l.y)) > 2) continue;
    const v = Math.round(resistido(hunt, b, l.reliquia, l.maxHp, ficha));
    if (!(v > 0)) continue;
    b.hp -= v;
    QuemFeriu.carimbar(b, QuemFeriu.LACAIO); // (a Relíquia é lacaio)
    eventos.push({ t: 'dmg', uid: b.uid, x: b.x, y: b.y, v, foe: true, lacaio: true, alvo: b.name, color: COR_DO_ELEMENTO[l.reliquia] ?? '#ff0000' });
  }
  return eventos;
}

// ---------------------------------------------------------------- (14/10) o RELIQUARIAN (e os únicos que dão as mesmas habilidades)

/**
 * A RAJADA VULCÂNICA (Molten Burst — o Ngamahu's Flame, nível 16 com 20% de chance; as Chamas de Ngamahu do Reliquarian, nível 20): no
 * acerto corpo a corpo, a chance do nível (20% no 16 … 100% no 20), recarga de 0,15 s; lança 4 projéteis (1 + 3 adicionais) do ponto do
 * impacto, que caem nos inimigos em volta (a até 3 casas) e causam dano de ataque em área (a casa e as vizinhas): o golpe da arma × o Dano de
 * Ataque do nível (170% … 200%), 60% do Físico convertido em Fogo, com os seus "aumentados" e a resistência de cada um. (Lote 45: cada acerto
 * rola o CRÍTICO do ataque — a chance e o multiplicador da ficha do golpe, com a Sorte/o Azar e o "sempre"/"nunca" crítico das linhas do PoE —;
 * a área da queda (a casa e as vizinhas) cresce com a "Área de Efeito aumentada/mais", como toda área — `ModsPoe.casasPelaArea`.)
 */
export const RAJADA = Object.freeze({ recargaMs: 150, projeteis: 4, raio: 3, raioDaQueda: 1, conversaoFogoPct: 60 });
const doNivelDaRajada = (nivel) => { const n = Math.max(16, Math.min(20, Number(nivel) || 20)); return { chance: 20 + (n - 16) * 20, danoPct: 170 + (n - 16) * 7.5 }; };
export function rajadaVulcanica(estado, hunt, alvo, eventos = [], rng = Math.random) {
  if (!itensPoeLigado() || !hunt || !alvo) return 0;
  const fichaBase = Ficha.combate(estado);
  const nivel = Number(fichaBase.afPoe?.rajada_vulcanica) || 0;
  if (!(nivel > 0)) return 0;
  const agora = hunt.clock ?? 0;
  if (agora < (hunt.poeRajadaAte ?? 0)) return 0;
  const { chance, danoPct } = doNivelDaRajada(nivel);
  if (!(rng() * 100 < chance)) return 0;
  hunt.poeRajadaAte = agora + RAJADA.recargaMs;
  const ficha = ModsPoe.fichaDoGolpe(fichaBase, ['ataque', 'projetil', 'area', 'fogo', 'fisico'], { alvo, estado });
  const media = ((ficha.ataqueMin ?? 0) + (ficha.ataqueMax ?? 0)) / 2;
  const bruto = (media * danoPct) / 100;
  const fogo = (bruto * RAJADA.conversaoFogoPct) / 100;
  const fisico = bruto - fogo;
  const aum = (el) => Math.max(0, 1 + (ficha.danoDoElemento?.[el] ?? 0) / 100) * (ficha.fatorDasCargas ?? 1);
  const perto = (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && Math.max(Math.abs(m.x - alvo.x), Math.abs(m.y - alvo.y)) <= RAJADA.raio);
  // (lote 45) a área da queda: 1 casa em volta × √ da "Área de Efeito aumentada" e de cada "mais" (a geral e a das tags do golpe)
  const tags = ModsPoe.somaPorTags(fichaBase, ['ataque', 'projetil', 'area', 'fogo', 'fisico']);
  const fatorDaArea = ModsPoe.fatorDaArea(ModsPoe.valor(fichaBase, 'area_inc') + (tags.area_inc ?? 0), ModsPoe.valor(fichaBase, 'area_mais') + (tags.area_mais ?? 0));
  // (lote 45) o CRÍTICO do ataque em cada acerto (no PoE, cada inimigo acertado rola o seu)
  const nunca = ModsPoe.valor(ficha, 'nunca_critico') > 0;
  const sempre = !nunca && ModsPoe.valor(ficha, 'critico_sempre') > 0;
  const chanceDeCritico = Math.min(ficha.critTeto ?? 1, Math.max(0, ficha.critChance ?? 0));
  const critou = () => !nunca && (sempre || ModsPoe.sorteado(chanceDeCritico, ficha.critSortudo ? 0 : ModsPoe.valor(ficha, 'critico_sortudo'), ModsPoe.valor(ficha, 'critico_azarado'), rng, ModsPoe.valor(ficha, 'sorte_tres_jogadas') > 0));
  let total = 0;
  for (let i = 0; i < RAJADA.projeteis; i++) {
    const onde = perto.length ? perto[Math.floor(rng() * perto.length)] : alvo;
    const raio = RAJADA.raioDaQueda + ModsPoe.casasPelaArea(RAJADA.raioDaQueda, fatorDaArea, rng);
    eventos.push({ t: 'shot', id: 4, x: alvo.x, y: alvo.y, tx: onde.x, ty: onde.y });
    for (const m of hunt.monstros ?? []) {
      if (!(m.hp > 0) || m.dummy || Math.max(Math.abs(m.x - onde.x), Math.abs(m.y - onde.y)) > raio) continue;
      const crit = critou();
      const v = Math.round((resistido(hunt, m, 'physical', fisico * aum('physical'), ficha) + resistido(hunt, m, 'fire', fogo * aum('fire'), ficha)) * (crit ? ficha.critMultiplier ?? 1.5 : 1));
      if (!(v > 0)) continue;
      m.hp -= v;
      QuemFeriu.carimbar(m, QuemFeriu.VOCE, ['ataque', 'projetil', 'area', 'fogo', 'fisico']); // (lote 31, S001/P025)
      total += v;
      eventos.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v, foe: true, crit, alvo: m.name, color: COR_DO_ELEMENTO.fire ?? '#ff9000' });
    }
  }
  return total;
}

/**
 * ERGUER ARANHAS (Raise Spiders — a Presa de Arakaali, o único e o nó do Reliquarian): ao matar (a chance da linha; recarga de 2 s), duas
 * aranhas espectrais de cada cadáver perto (a até 4 casas — o cadáver é consumido), até 20, por 30 s; imunes a dano, atacam corpo a corpo e
 * envenenam (o Golpe da Víbora — lote 44: o veneno de 30% do golpe por segundo por 4 s, sem os seus modificadores; o golpe pelo PoB); cada aranha dá 2% de Velocidade de Ataque e
 * 15% de Dano com Veneno (`ModsPoe.adds`). Os abates pendentes: `hunt.poeAbatesParaAranhas` (`mods-poe.evento`).
 */
// (lote 44, P065: o PoB — o golpe da aranha é o da tabela de aliados × 1,76, a cada 0,96 s; o Golpe da Víbora envenena sempre, com o veneno na
// duração da habilidade: 4 s — 30% do golpe por segundo)
export const ARANHAS = Object.freeze({ recargaMs: 2000, porCadaver: 2, maximo: 20, duracaoMs: 30000, raio: 4, nome: 'Aranha Espectral', venenoPctPorS: 30, venenoMs: 4000 });
export function tiqueDasAranhas(estado, hunt, agora = hunt?.ultimoTique ?? Date.now(), rng = Math.random) {
  if (!itensPoeLigado() || !hunt?.pos) return;
  const pendentes = hunt.poeAbatesParaAranhas ?? 0;
  delete hunt.poeAbatesParaAranhas;
  const af = Ficha.combate(estado).afPoe ?? {};
  // (a chance: a da linha — "N% de chance de Ativar Erguer Aranhas" do único; o nó do Reliquarian, sempre)
  const chance = Number(af.erguer_aranhas_chance) || 0;
  if (!(pendentes > 0) || !(chance > 0) || agora < (hunt.poeAranhasAte ?? 0) || !(rng() * 100 < chance)) return;
  hunt.lacaios ??= [];
  const vivas = hunt.lacaios.filter((l) => l.aranha && l.hp > 0);
  const cadaveres = (hunt.cadaveres ?? []).filter((c) => Math.max(Math.abs(c.x - hunt.pos.x), Math.abs(c.y - hunt.pos.y)) <= ARANHAS.raio);
  if (!cadaveres.length) return;
  hunt.poeAranhasAte = agora + ARANHAS.recargaMs;
  const usados = new Set();
  let novas = 0;
  for (const c of cadaveres) {
    if (vivas.length + novas >= ARANHAS.maximo) break;
    usados.add(c);
    for (let i = 0; i < ARANHAS.porCadaver && vivas.length + novas < ARANHAS.maximo; i++, novas++) {
      hunt.lacaios.push(lacaioDoGuardian(estado, hunt, agora, af, ARANHAS.nome, 'physical', { aranha: true, intocavel: true, envenenar: 100, ate: agora + ARANHAS.duracaoMs, duracaoMs: ARANHAS.duracaoMs, x: c.x, y: c.y, pob: 'SpiderMinion' }));
    }
  }
  hunt.cadaveres = (hunt.cadaveres ?? []).filter((c) => !usados.has(c));
  if (novas) Ficha.invalidar(estado);
}

/**
 * SUSPENDER NO TEMPO (as Areias do Tempo, nível 20; o nó do Reliquarian, nível 1): ao conjurar uma magia (não instantânea, não canalizada,
 * não de lacaio, não Vaal; recarga de 0,1 s), uma Miragem Suspensa (5 s) com a magia; na terceira, todas soltam a magia que as criou, no
 * alvo dela ou no inimigo mais perto, com "X% menos Dano" (50% no nível 1 … 20% no 20), sem custo. Devolve os eventos.
 */
export const MIRAGENS = Object.freeze({ duracaoMs: 5000, recargaMs: 100, quantas: 3 });
export const menosDaMiragem = (nivel) => 50 - ((Math.max(1, Math.min(20, Number(nivel) || 1)) - 1) * 30) / 19;
export function suspenderNoTempo(estado, hunt, personagem, entry, alvo, agora = hunt?.clock ?? 0) {
  const eventos = [];
  const nivel = Number(Ficha.combate(estado).afPoe?.suspender_no_tempo) || 0;
  if (!itensPoeLigado() || !(nivel > 0) || agora < (hunt.poeMiragemAte ?? 0)) return eventos;
  hunt.poeMiragemAte = agora + MIRAGENS.recargaMs;
  const lista = (hunt.miragens ?? []).filter((x) => x.ate > agora);
  lista.push({ acao: entry.id, alvo: alvo?.uid ?? null, ate: agora + MIRAGENS.duracaoMs });
  eventos.push({ t: 'fx', id: 13, x: hunt.pos.x, y: hunt.pos.y });
  if (lista.length < MIRAGENS.quantas) { hunt.miragens = lista; return eventos; }
  delete hunt.miragens;
  const menos = menosDaMiragem(nivel);
  for (const x of lista) {
    const vivo = hunt.monstros.find((b) => b.uid === x.alvo && b.hp > 0) ?? hunt.monstros.filter((b) => b.hp > 0).sort((a, b) => distanciaChebyshev(hunt.pos, a) - distanciaChebyshev(hunt.pos, b))[0] ?? null;
    if (!vivo) continue;
    const r = dispararSemMarcar(estado, hunt, personagem, null, vivo, { gatilho: { acao: { id: x.acao, enabled: true, minMana: 0, minTargets: 1, conditions: [] }, semCusto: true, ignorarRecarga: true, maisDano: -menos } });
    if (r.ok) eventos.push({ t: 'gatilho', quem: personagem?.nome, suporte: 'Miragem Suspensa', skill: POR_ID.get(x.acao)?.name ?? x.acao }, ...(r.eventos ?? []));
  }
  return eventos;
}

/**
 * O GRANDE EMISSÁRIO DAS DIREÇÕES (The Shattered Divinity; a Divindade Despedaçada do Reliquarian — "Concede a Habilidade"): sai sozinho (o jogo
 * usa as habilidades sozinho) — o lacaio imortal (máx 1) que segue você; a cada 6 s (a recarga da habilidade) lança em você um buff de 6 s com um
 * ao acaso: +2 Projéteis, +2 Ricochetes, Perfuram +2 alvos, ou Difundem e Difundem de novo — ou todos (1 em 5). O PoE não publica a frequência
 * nem a duração do buff: aproximado, com a nota.
 */
export const EMISSARIO = Object.freeze({ nome: 'Grande Emissário das Direções', periodoMs: 6000, duracaoS: 6, buffs: ['emissarioProjeteis', 'emissarioRicochetes', 'emissarioPerfuracao', 'emissarioDifusao', 'emissarioTodos'] });
export function tiqueDoEmissario(estado, hunt, agora = hunt?.clock ?? 0, rng = Math.random) {
  if (!itensPoeLigado() || !hunt?.pos) return;
  const af = Ficha.combate(estado).afPoe ?? {};
  hunt.lacaios ??= [];
  const vivo = hunt.lacaios.find((l) => l.emissario && l.hp > 0);
  if (!(Number(af.emissario_direcoes) > 0)) { if (vivo) vivo.hp = 0; return; }
  if (!vivo) hunt.lacaios.push(lacaioDoGuardian(estado, hunt, hunt.ultimoTique ?? Date.now(), af, EMISSARIO.nome, 'physical', { emissario: true, intocavel: true, semAtaque: true }));
  if (agora < (hunt.poeEmissarioEm ?? 0)) return;
  hunt.poeEmissarioEm = agora + EMISSARIO.periodoMs;
  for (const b of EMISSARIO.buffs) if (hunt.poeBuffs?.[b]) delete hunt.poeBuffs[b];
  ModsPoe.ganharBuff(hunt, EMISSARIO.buffs[Math.floor(rng() * EMISSARIO.buffs.length)], EMISSARIO.duracaoS, agora);
}

/**
 * O CONVOCAR FANTASMA (o suporte): "X% de chance de Convocar um Fantasma quando Habilidades Suportadas … causam um Golpe Fatal", "… Acertarem um
 * Inimigo Raro ou Único", "Máximo de N Fantasmas", "Fantasmas duram 15 segundos" (`efeito.fantasma*` — `suportes-poe`). O Fantasma: um lacaio que
 * dispara uma magia física de projétil (o golpe de um monstro comum do seu nível); o mais velho sai no máximo. ("Cada Fantasma Convocado concede
 * a Você Poder Fantasmal" — `ModsPoe.adds`.)
 */
export const FANTASMA = Object.freeze({ nome: 'Fantasma', alcance: 4 });
export function convocarFantasmas(estado, hunt, efeitoDaGema, atingidos, rng = Math.random) {
  if (!itensPoeLigado() || !hunt?.pos || !efeitoDaGema) return 0;
  const aoMatar = Number(efeitoDaGema.fantasmaAoMatarPct) || 0;
  const noRaro = Number(efeitoDaGema.fantasmaRaroPct) || 0;
  if (!(aoMatar > 0 || noRaro > 0)) return 0;
  let n = 0;
  for (const b of atingidos ?? []) {
    if (!b) continue;
    if (b.hp <= 0 && aoMatar > 0 && rng() * 100 < aoMatar) n++;
    if ((['raro', 'unico'].includes(b.raridade ?? b.raridadePoe) || b.boss) && noRaro > 0 && rng() * 100 < noRaro) n++;
  }
  if (!n) return 0;
  const agora = hunt.ultimoTique ?? Date.now();
  const af = Ficha.combate(estado).afPoe ?? {};
  const duracaoMs = Number(efeitoDaGema.fantasmaDuracaoMs) || 15000;
  const maximo = Math.max(1, Number(efeitoDaGema.fantasmaMax) || 5);
  hunt.lacaios ??= [];
  for (let i = 0; i < n; i++) {
    const vivos = hunt.lacaios.filter((l) => l.fantasma && l.hp > 0 && !(l.ate && agora >= l.ate));
    if (vivos.length >= maximo) vivos.sort((a, b) => a.ate - b.ate)[0].hp = 0;
    // (lote 44, P064: o Poder Fantasmal de cada Fantasma é o do nível do Suporte: Convocar Fantasma — a tabela do PoB)
    hunt.lacaios.push(lacaioDoGuardian(estado, hunt, agora, af, FANTASMA.nome, 'physical', { fantasma: true, ate: agora + duracaoMs, duracaoMs, alcanceDeAtaque: FANTASMA.alcance, estilo: { magia: true, elementos: ['physical'] }, pob: 'SummonedPhantasm', poderFantasmal: LacaiosPoe.poderFantasmalNoNivel(Number(efeitoDaGema.fantasmaNivel) || 20) }));
  }
  Ficha.invalidar(estado);
  return n;
}

/**
 * (16/10, lote 37 — a decisão do dono "Mercenário completo", P005/P057–P060) O MERCENÁRIO do Luminary: contratado por ouro na tela dele
 * (`itens-poe/mercenarios.mjs` — até 3, um ao seu lado; o nível preso no da contratação; o equipamento dele), segue você e usa as GEMAS do
 * arquétipo, alternando-as: o dano de cada uma é a conta do jogo para a gema (`danoMostrado`) com a FICHA dele (o nível, a classe e as peças —
 * e o "aumentado" dos seus nós somado ao das peças dele) e os suportes fixos, × "+8% mais Dano para cada item único equipado por ele"; o
 * tempo é o de uso da gema; o alcance, o dela. Morto, só volta revivido por ouro (o PoE). (O guarda-costas, o "recupera como vida", o provocar e
 * as auras: `arvore.danoRecebido`, `cacadas.tiqueDosLacaios`.)
 */
export const MERCENARIO = Object.freeze({ desenho: 'Mercenário', maisPorUnico: 8 });
/** Quantos únicos o mercenário ATIVO tem equipados (só entram nos tipos de peça que os nós liberam — `Mercenarios.faltaParaVestir`). */
export const unicosDoMercenario = (estado) => Mercenarios.unicosEquipados(Mercenarios.ativo(estado));
/**
 * A FICHA de combate do mercenário `merc`: a vida máxima (a ficha dele) e cada habilidade — o dano (a conta da gema com a ficha e os suportes
 * dele, × o "mais" por único), o tempo de uso, o alcance, o elemento, se é magia e o projétil do desenho.
 */
/**
 * (lote 39) O EFEITO de cada gema do mercenário: a ficha dele, os suportes fixos e as PEÇAS dele (a Área de Efeito, os projéteis a mais —
 * `comOsAlvosDaGema` com o estado dele). Em cache pela versão do mercenário e os seus nós (a ficha não é refeita a cada golpe).
 */
const EFEITOS_DO_MERCENARIO = new Map();
function efeitosDoMercenario(merc, af) {
  const chave = `${merc.id}:${merc.v ?? 0}:${Number(af.mercenario_dano_inc) || 0}:${Number(af.mercenario_vida_inc) || 0}:${Number(af.mercenario_auras_inc) || 0}`;
  let x = EFEITOS_DO_MERCENARIO.get(chave);
  if (!x) {
    const m = Mercenarios.estadoDoMercenario(merc, af);
    const ativas = Mercenarios.ativasDoMercenario(merc);
    const porAcao = new Map();
    for (const h of Mercenarios.habilidades(merc)) {
      const entry = POR_ID.get(h.acao);
      if (entry && ativas.has(entry.id)) porAcao.set(entry.id, comOsAlvosDaGema(entry, Gemas.efeitoNaSkill(m, entry.id, ativas), m));
    }
    x = { m, porAcao };
    if (EFEITOS_DO_MERCENARIO.size > 300) EFEITOS_DO_MERCENARIO.clear();
    EFEITOS_DO_MERCENARIO.set(chave, x);
  }
  return x;
}
export function fichaDoMercenario(estado, merc, af = Ficha.combate(estado).afPoe ?? {}) {
  const { m, porAcao } = efeitosDoMercenario(merc, af);
  const f = Ficha.combate(m);
  const mais = 1 + ((Number(af.mercenario_dano_por_unico) || 0) * Mercenarios.unicosEquipados(merc)) / 100;
  const habilidades = [];
  for (const h of Mercenarios.habilidades(merc)) {
    const entry = POR_ID.get(h.acao);
    if (!entry || !porAcao.has(entry.id)) continue;
    const efeito = porAcao.get(entry.id);
    const d = danoMostrado(m, entry, efeito);
    const t = temposDaGemaPoe(m, entry, { nivel: h.nivel }, f, { doJogador: false });
    habilidades.push({
      acao: entry.id, gema: h.gema, nome: entry.name, nivel: h.nivel, suportes: efeito?.supports ?? [],
      dano: { min: Math.max(1, Math.round(d.min * mais)), max: Math.max(1, Math.round(d.max * mais)) },
      usoMs: Math.max(250, Math.round(t.uso ?? t.conjuracaoMs ?? 1000)), alcance: Math.max(1, entry.range || 1), elemento: entry.element ?? 'physical',
      magia: !entry.poeGema?.ataque, projetil: entry.projetil || 0,
    });
  }
  const aura = Mercenarios.auraDoMercenario(merc, af);
  return { vida: m.maxHp, habilidades, aura: aura ? { gema: aura.gema, nome: aura.nome, nivel: aura.nivel, fator: aura.fator } : null };
}
/** O mercenário passa a usar a habilidade `i` (a vez dela): o golpe, o tempo, o alcance e o desenho do lacaio. */
function usarHabilidadeDoMercenario(l, i) {
  const n = l.habilidades?.length ?? 0;
  if (!n) return;
  l.habilidade = ((i % n) + n) % n;
  const h = l.habilidades[l.habilidade];
  l.dano = h.dano;
  l.intervaloMs = h.usoMs;
  l.alcanceDeAtaque = h.alcance;
  l.elemento = h.elemento;
  l.estilo = h.magia ? { magia: true, elementos: [h.elemento], ...(h.projetil ? { projetil: h.projetil } : {}) } : { elemento: h.elemento, ...(h.projetil ? { projetil: h.projetil } : {}) };
}
/**
 * (lote 39) Os OUTROS atingidos pelo golpe do mercenário com a gema da vez (o alvo o lacaio já acerta): a ÁREA da forma — no alvo, ou em volta
 * dele, virada para o alvo — esticada pela Área de Efeito dele (`ModsPoe.casasPelaArea`, `Areas.escalarForma`); os SALTOS da cadeia (o Arco);
 * e os PROJÉTEIS a mais, a perfuração, a difusão e os ricochetes pelo mesmo motor do seu disparo (`Secundarios.resolver`). `{ golpes,
 * eventos, emitidos, explosoes }`, ou null.
 */
export function alvosDoGolpeDoMercenario(estado, l, alvo, vivos, rng = Math.random) {
  const h = l?.habilidades?.[l.habilidade ?? 0];
  const entry = h ? POR_ID.get(h.acao) : null;
  const merc = entry ? Mercenarios.contratado(estado, l.mercId) : null;
  if (!merc || !alvo) return null;
  const efeito = efeitosDoMercenario(merc, Ficha.combate(estado).afPoe ?? {}).porAcao.get(entry.id);
  if (!efeito) return null;
  const origem = { x: l.x, y: l.y };
  if (entry.forma) {
    const noAlvo = entry.miraNoChao || entry.alvoNoCentro;
    const raio = Areas.raioDaForma(entry.forma);
    const n = ModsPoe.casasPelaArea(raio, ModsPoe.fatorDaArea(efeito.areaIncPct ?? 0, efeito.areaMaisPct ?? 0), rng);
    const casas = Areas.daForma(n ? Areas.escalarForma(entry.forma, raio + n) : entry.forma, noAlvo ? alvo : origem, !noAlvo && direcional(entry) ? ordemDosLados(origem, alvo)[0] : null);
    const golpes = Areas.dentro(casas, vivos).filter((b) => b !== alvo).map((b) => ({ bicho: b, pct: 100, tipo: 'area' }));
    return { golpes, eventos: entry.efeito ? [{ t: 'area', id: entry.efeito, x: origem.x, y: origem.y, casas: Areas.paraTela(casas, origem) }] : [], emitidos: [], explosoes: [] };
  }
  if (entry.cadeia) {
    const atingidos = saltosDaCadeia(alvo, vivos, efeito.cadeiaPoe ? { ...entry.cadeia, targets: 1 + efeito.cadeiaPoe.saltos, distance: alcanceDoRicochete(DISTANCIA_DA_CADEIA_POE(), efeito, rng) } : entry.cadeia);
    return { golpes: atingidos.slice(1).map((b, i) => ({ bicho: b, pct: 100, tipo: 'cadeia', de: atingidos[i] })), eventos: [], emitidos: [], explosoes: [] };
  }
  const tags = Tags.tagsDaAcao(entry);
  if (!tags.includes('projectile')) return null;
  const r = Secundarios.resolver({ efeito, tags, origem, alvo, atingidos: [alvo], vivos, alcance: entry.range || ALCANCE_PADRAO, rng });
  return { golpes: r.golpes, eventos: [], emitidos: r.emitidos, explosoes: r.explosoes };
}
/** Depois de cada golpe do mercenário: a próxima gema do arquétipo (ele alterna as habilidades). */
export function depoisDoGolpeDoMercenario(l) {
  if (l?.mercenario && (l.habilidades?.length ?? 0) > 1) usarHabilidadeDoMercenario(l, (l.habilidade ?? 0) + 1);
}
export function tiqueDoMercenario(estado, hunt, agora = hunt?.ultimoTique ?? Date.now()) {
  if (!itensPoeLigado() || !hunt?.pos) return;
  const af = Ficha.combate(estado).afPoe ?? {};
  hunt.lacaios ??= [];
  const merc = Mercenarios.liberado(af) ? Mercenarios.ativo(estado) : null;
  const quer = merc && !merc.morto ? merc : null;
  // (o que não é mais o ativo — deixado, despedido, o nó tirado — sai da caçada sem contar como morte)
  const antes = hunt.lacaios.length;
  hunt.lacaios = hunt.lacaios.filter((l) => !(l.mercenario && l.hp > 0 && (!quer || l.mercId !== quer.id)));
  if (hunt.lacaios.length !== antes) Ficha.invalidar(estado);
  if (!quer) return;
  // (lote 39, P060) a AURA dele em você: a ficha (`afDono`, como a dos golens) e os efeitos (os reforços — `Reforcos.ativos`); uma vez cada — com a
  // mesma aura sua ligada, vale a sua.
  const aura = Mercenarios.auraDoMercenario(quer, af);
  const suaIgual = aura ? hunt.buffs?.[aura.acao]?.ate > (hunt.clock ?? 0) : false;
  const chave = `${quer.id}:${quer.v ?? 0}:${Number(af.mercenario_dano_inc) || 0}:${Number(af.mercenario_vida_inc) || 0}:${Number(af.mercenario_dano_por_unico) || 0}:${Number(af.mercenario_auras_inc) || 0}:${suaIgual ? 1 : 0}`;
  const vivo = hunt.lacaios.find((l) => l.mercenario && l.hp > 0);
  if (vivo?.chaveDaFicha === chave) return;
  const naAura = (l) => {
    l.afDono = aura && !suaIgual && Object.keys(aura.af).length ? aura.af : null;
    l.auraEfeitos = aura && !suaIgual && aura.efeitos.length ? { id: aura.acao, efeitos: aura.efeitos, fator: aura.fator } : null;
    Ficha.invalidar(estado);
  };
  const ficha = fichaDoMercenario(estado, quer, af);
  if (!ficha.habilidades.length) return;
  if (vivo) {
    // (trocou de peça, os seus nós mudaram: a vida máxima e as habilidades novas, na mesma proporção de vida)
    if (vivo.maxHp !== ficha.vida) { vivo.hp = Math.max(1, Math.round((vivo.hp * ficha.vida) / vivo.maxHp)); vivo.maxHp = ficha.vida; }
    vivo.habilidades = ficha.habilidades;
    vivo.chaveDaFicha = chave;
    usarHabilidadeDoMercenario(vivo, vivo.habilidade ?? 0);
    naAura(vivo);
    return;
  }
  const l = lacaioDoGuardian(estado, hunt, agora, af, MERCENARIO.desenho, ficha.habilidades[0].elemento, { mercenario: true, mercId: quer.id, nivel: quer.nivel, hp: ficha.vida, maxHp: ficha.vida, habilidades: ficha.habilidades, habilidade: 0, chaveDaFicha: chave });
  l.nome = quer.nome;
  usarHabilidadeDoMercenario(l, 0);
  naAura(l);
  hunt.lacaios.push(l);
}
/** O mercenário morreu na caçada: só volta revivido por ouro (`Mercenarios.morreu`; a tela dele). */
export function mercenarioMorreu(estado, l) {
  Mercenarios.morreu(estado, l?.mercId);
}

/**
 * (14/10) As ÉGIDES (`ModsPoe.absorverNaEgide`): quais valem e o máximo de cada, e a volta ao valor cheio (10 s sem dano do tipo dela — o
 * `aegis_recharge_delay_ms` das Égides do PoE; lote 44: a da Primitiva, 5 s — o PoB e o poedb). A PRIMITIVA (o Bastião dos Elementos do Elementalist: "Ativa
 * Égide Primitiva Nível 20 quando Alocado", "pode sofrer 75 de Dano Elemental por Notável alocado" — o texto em inglês do PoE: "per Allocated
 * Notable Passive Skill", os Notáveis da árvore e da ascendência) toma Fogo, Gelo e Raio; "Outras Habilidades de Égides são Desabilitadas"
 * desliga as dos únicos ("Ativa Égide de Fogo/Gelo/Relampejante/Elemental/Física nível 20 quando equipado": 1000 do tipo dela — a Elemental,
 * 50 no nível 1 a 1000 no 20 — RePoE).
 */
const EGIDES_DE_UNICO = {
  fogo: { stat: 'egide_fogo', tipos: ['fire'] }, gelo: { stat: 'egide_gelo', tipos: ['ice'] }, raio: { stat: 'egide_raio', tipos: ['energy'] },
  elemental: { stat: 'egide_elemental', tipos: ['fire', 'ice', 'energy'] }, fisica: { stat: 'egide_fisica', tipos: ['physical'] },
};
const valorDaEgideDeUnico = (nome, nivel) => (nome === 'elemental' ? Math.round(50 + ((Math.max(1, Math.min(20, nivel)) - 1) * (1000 - 50)) / 19) : 1000);
export function notaveisAlocados(estado) {
  const porId = arvoreDasPassivas()?.porId;
  return porId ? (estado?.passivas?.alocados ?? []).filter((id) => porId.get(id)?.tipo === 'notable').length : 0;
}
export function tiqueDasEgides(estado, hunt, agora = hunt?.clock ?? 0) {
  if (!itensPoeLigado() || !hunt) return;
  const af = Ficha.combate(estado).afPoe ?? {};
  const valem = {};
  if (Number(af.egide_primitiva) > 0) valem.primitiva = { tipos: ['fire', 'ice', 'energy'], max: (Number(af.egide_primitiva_por_notavel) || 0) * notaveisAlocados(estado) };
  if (!(Number(af.egides_desabilitadas) > 0)) for (const [nome, { stat, tipos }] of Object.entries(EGIDES_DE_UNICO)) if (Number(af[stat]) > 0) valem[nome] = { tipos, max: valorDaEgideDeUnico(nome, Number(af[stat])) };
  const atuais = hunt.egides ?? {};
  for (const nome of Object.keys(atuais)) if (!valem[nome]) { delete atuais[nome]; hunt.poeFichaMudou = true; }
  for (const [nome, v] of Object.entries(valem)) {
    const e = (atuais[nome] ??= { tipos: v.tipos, valor: v.max, max: v.max, ultimoDano: -Infinity });
    e.tipos = v.tipos;
    e.max = v.max;
    if (e.valor > e.max) e.valor = e.max;
    if (e.valor < e.max && agora - e.ultimoDano >= (nome === 'primitiva' ? ModsPoe.EGIDE.recargaPrimitivaMs : ModsPoe.EGIDE.recargaMs)) {
      if (!(e.valor > 0)) hunt.poeFichaMudou = true;
      e.valor = e.max;
    }
  }
  if (Object.keys(atuais).length) hunt.egides = atuais;
  else delete hunt.egides;
}

/**
 * (14/10) Os ROBÔS ATIVADORES (o Crime Perfeito do Saboteur: "Ativa Convocar Robôs Ativadores Nível 20 quando Alocado" — o PoE: dois robôs
 * que seguem você e não tomam dano; "Suas Magias Ativadas são Ativadas duas vezes, uma de cada robô; a ativação a mais ignora as Recargas"):
 * os dois lacaios (sem ataque, intocáveis) e a ativação dobrada (`ativarGatilhos`, o "Ativa X" das peças). (Lote 44, P066: as duas saem do
 * LUGAR de cada robô — `doLugarDoRobo`; sem o robô vivo, do seu.)
 */
export const ROBOS = Object.freeze({ nome: 'Robô Ativador', quantos: 2 });
export function tiqueDosRobos(estado, hunt, agora = hunt?.ultimoTique ?? Date.now()) {
  if (!itensPoeLigado() || !hunt?.pos) return;
  const af = Ficha.combate(estado).afPoe ?? {};
  hunt.lacaios ??= [];
  const vivos = hunt.lacaios.filter((l) => l.robo && l.hp > 0);
  if (!(Number(af.robos_ativadores) > 0)) { for (const l of vivos) l.hp = 0; return; }
  for (let i = vivos.length; i < ROBOS.quantos; i++) hunt.lacaios.push(lacaioDoGuardian(estado, hunt, agora, af, ROBOS.nome, 'energy', { robo: true, semAtaque: true, intocavel: true }));
}
const comRobos = (estado) => itensPoeLigado() && Number(Ficha.combate(estado).afPoe?.robos_ativadores) > 0;
/**
 * (lote 51, o Calafrio da Corrupção — dono: "Traduzir para a recarga") "X% de chance de ganhar uma Alma Vaal adicional por Inimigo
 * Estilhaçado": na chance, a recarga de cada habilidade Vaal na barra anda UMA alma — o total da recarga ÷ as "Almas por Utilização" da gema.
 */
ModsPoe.definirAoEstilhacar((estado, hunt, ficha, rng) => {
  const chance = ModsPoe.valor(ficha, 'alma_vaal_ao_estilhacar');
  if (!(chance > 0) || !(rng() * 100 < chance)) return;
  const agora = hunt.clock ?? 0;
  for (const a of estado.actions ?? []) {
    const entry = a?.id ? POR_ID.get(a.id) : null;
    const cd = entry?.poeGema && hunt.cooldowns?.[a.id];
    if (!cd || cd.ate <= agora || !tagsPoeDaSkill(entry).includes('vaal')) continue;
    const almas = Number(GemasPoe.compilada(entry.poeGema.slug, Gemas.efeitoNaSkill(estado, a.id)?.nivel ?? 1)?.stats?.almas) || 0;
    if (almas > 0) cd.ate = Math.max(agora, cd.ate - (cd.total ?? 0) / almas);
  }
});
/** (lote 44, P066) O disparo `fn` do lugar do `i`-ésimo Robô Ativador vivo: a sua posição (`hunt.pos`, a origem do disparo) trocada só nele. */
export function doLugarDoRobo(hunt, i, fn) {
  const robo = (hunt?.lacaios ?? []).filter((l) => l.robo && l.hp > 0)[i];
  if (!robo || !hunt.pos) return fn();
  const pos = hunt.pos;
  hunt.pos = { ...pos, x: robo.x, y: robo.y };
  try { return fn(); } finally { hunt.pos = pos; }
}

/**
 * (14/10, a árvore principal) O INFESTADOR do PoE (Plague Bearer — `GemasPoe.PRAGA`): com a gema encaixada e na barra (ligada), ele sai
 * sozinho (o jogo usa as habilidades sozinho). INCUBANDO, cada Veneno que você inflige põe 40% do Dano Esperado dele no Valor da Praga (até o
 * Valor Máximo do nível, × "Portador da Praga têm Valor Máximo da Praga aumentado" — `praga_max`) e causa 20% menos dano fora do máximo
 * (`pragaDoAcerto`, nas afecções); no máximo, com um inimigo a até 2 casas, passa a INFESTAR: Caos por segundo igual a 12% do Valor do começo
 * (+0,2% por qualidade) nos inimigos a até 2 casas — sem os seus modificadores de dano, pela resistência a Caos deles —, perdendo o Valor na
 * mesma medida; acabou, volta a Incubar. A troca respeita a recarga de 0,5 s. Devolve os eventos.
 */
export const ACAO_DA_PRAGA = 'poe-gema:Plague_Bearer';
export function tiqueDaPraga(estado, hunt, ms = 250, agora = hunt?.clock ?? 0) {
  const eventos = [];
  if (!itensPoeLigado() || !hunt?.pos) return eventos;
  const gema = Gemas.skillsAtivas(estado).get(ACAO_DA_PRAGA);
  const naBarra = (estado.actions ?? []).some((a) => a?.id === ACAO_DA_PRAGA && a.enabled !== false);
  if (!gema || !naBarra) {
    if (hunt.praga) { delete hunt.praga; hunt.poeFichaMudou = true; }
    return eventos;
  }
  const ficha = Ficha.combate(estado);
  const p = (hunt.praga ??= { modo: 'incubando', valor: 0, recargaAte: 0 });
  p.max = GemasPoe.maxDaPraga(gema.nivel) * Math.max(0, 1 + ModsPoe.valor(ficha, 'praga_max') / 100);
  p.valor = Math.min(p.valor, p.max);
  const perto = (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && (m.z ?? hunt.z ?? 0) === (hunt.z ?? 0) && Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) <= GemasPoe.PRAGA.raio);
  if (p.modo === 'incubando') {
    if (p.valor > 0 && p.valor >= p.max && perto.length && agora >= (p.recargaAte ?? 0)) {
      Object.assign(p, { modo: 'infestando', inicio: p.valor, recargaAte: agora + GemasPoe.PRAGA.recargaMs, porSegundoPct: GemasPoe.PRAGA.porSegundoPct + (gema.qualidade ?? 0) * GemasPoe.PRAGA.qualidadePorPonto });
      eventos.push({ t: 'fx', id: 17, x: hunt.pos.x, y: hunt.pos.y });
    }
    return eventos;
  }
  const dano = Math.min(p.valor, ((p.inicio * p.porSegundoPct) / 100) * (ms / 1000));
  // (lote 32, P039 — o Vínculo Ancestral: "Você não pode causar Dano com Habilidades por si só" — a Infestação é a habilidade; o Valor cai igual)
  const semDano = ModsPoe.valor(ficha, 'sem_dano_proprio') > 0;
  for (const m of semDano ? [] : perto) {
    const v = Math.round(resistido(hunt, m, 'chaos', dano, ficha));
    if (!(v > 0)) continue;
    m.hp -= v;
    QuemFeriu.carimbar(m, QuemFeriu.VOCE); // (lote 31: a Infestação não é acerto)
    eventos.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v, foe: true, alvo: m.name, color: COR_DO_ELEMENTO.chaos ?? '#9900cc' });
  }
  p.valor -= dano;
  if (!(p.valor > 0.001)) Object.assign(p, { modo: 'incubando', valor: 0, recargaAte: agora + GemasPoe.PRAGA.recargaMs });
  return eventos;
}
/** O Infestador no acerto (as afecções): Incubando, `{ menosPct, somar(total) }` — os 20% menos fora do máximo e os 40% de cada Veneno. */
export function pragaDoAcerto(hunt) {
  const p = hunt?.praga;
  if (!p || p.modo !== 'incubando') return null;
  return {
    menosPct: p.valor >= p.max ? 0 : GemasPoe.PRAGA.menosVenenoPct,
    somar: (total) => { if (total > 0) p.valor = Math.min(p.max ?? Infinity, p.valor + (total * GemasPoe.PRAGA.ganhoPct) / 100); },
  };
}

/**
 * (14/10, o Coveiro) Os CADÁVERES criados pela gema (Profanar, Desenterrar — `GemasPoe.cadaveresDaGema`), no lugar do alvo — Profanar: os
 * monstros da área, em volta dele; Desenterrar: o Arqueiro de Ossos onde o projétil cai (o desenho do esqueleto). Até o "Máximo de N Cadáveres
 * permitidos" da gema (+ "Profanar e Desenterrar têm +N de número Máximo de cadáveres permitidos" — `cadaveres_max_criados`): os mais velhos
 * dela saem. Os criados não contam nos 10 mortos que a caçada guarda (`hunt/combate`). Devolve quantos criou.
 */
export function criarCadaveres(estado, hunt, slug, nivelDaGema = 1, onde = hunt?.pos, rng = Math.random) {
  const d = GemasPoe.cadaveresDaGema(slug, nivelDaGema);
  if (!d || !hunt || !onde) return 0;
  const maximo = d.maximo + ModsPoe.valor(Ficha.combate(estado), 'cadaveres_max_criados');
  const nivelDaArea = hunt.escala?.nivel ?? estado.level ?? 1;
  const nivel = d.nivel ?? Math.min(d.nivelMax ?? nivelDaArea, nivelDaArea);
  const daArea = (hunt.monstros ?? []).filter((m) => !m.dummy && !m.boss);
  const lista = [...(hunt.cadaveres ?? [])];
  for (let i = 0; i < d.n; i++) {
    const base = d.arqueiro || !daArea.length ? null : daArea[Math.floor(rng() * daArea.length)];
    const desenho = base ? { look: base.look, lookItem: base.lookItem ?? 0, colors: base.colors ?? null } : LacaiosPoe.desenhoDe('Arqueiro de Ossos', 'physical', false);
    const x = onde.x + (i ? Math.floor(rng() * 3) - 1 : 0);
    const y = onde.y + (i ? Math.floor(rng() * 3) - 1 : 0);
    lista.push({ key: base?.key ?? 'skeleton', nome: base?.name ?? 'Arqueiro de Ossos', look: desenho.look, lookItem: desenho.lookItem ?? 0, colors: desenho.colors ?? null, x, y, nivel, criadoPor: slug, criadoEm: hunt.clock ?? 0 });
  }
  const dela = lista.filter((c) => c.criadoPor === slug);
  const sai = new Set(dela.slice(0, Math.max(0, dela.length - maximo)));
  hunt.cadaveres = lista.filter((c) => !sai.has(c));
  return d.n;
}

/**
 * A maldição pega no acerto (`Reforcos.marcar`) e os eventos do PoE: "quando você Amaldiçoar um Inimigo sem Maldições" e (13/10) o mesmo com uma
 * maldição que não é aura (a Maestria de Maldições: "Inimigos Não Amaldiçoados que você inflija Maldições não Auras são Cegados").
 */
function amaldicoouAgora(estado, hunt, bicho, ficha, agora, eventos, personagem) {
  const m = Reforcos.marcar(hunt, bicho, agora);
  if (m.amaldicoouSemMaldicao) ModsPoe.evento(estado, hunt, 'amaldicoarSemMaldicao', ficha, { alvo: bicho, eventos, personagem });
  if (m.semMaldicaoNaoAura) ModsPoe.evento(estado, hunt, 'amaldicoarSemMaldicaoNaoAura', ficha, { alvo: bicho, eventos, personagem });
}

/** O dano que a skill causa agora, por acerto (sem crítico nem resistência): o que o balão mostra. */
export function danoMostrado(estado, entry, efeitoDaGema = Gemas.ehSkillDeGema(entry) ? Gemas.efeitoNaSkill(estado, entry.id) : null) {
  // (Duas armas: a gema que combina as armas mostra as duas juntas; a que alterna, a mão principal.)
  const ficha = Ficha.combate(estado);
  const mao = maoDaGemaDeAtaque(entry, ficha);
  const c = contaDoDano(estado, entry, efeitoDaGema, mao?.ficha ?? ficha, mao?.arma ?? null);
  const f = c.mult * c.fatorDaGema * c.sobrecarga;
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
/**
 * (14/10) "Alcance do Ricochete aumentado em X%": a distância do salto × (1 + X%), a fração como chance de uma casa a mais (como a área), para a
 * média bater.
 */
/** (lote 40, P022 — dono: "Ricochete pelo PoE 2") O salto das CADEIAS das gemas do PoE (o Arco, o Golpe Estático): 4 m — 2 casas (`ricochetePoe`). */
const DISTANCIA_DA_CADEIA_POE = () => Gemas.CONFIG.golpesSecundarios?.ricochetePoe?.outros ?? 2;
export function alcanceDoRicochete(base = 1, efeito = null, rng = Math.random) {
  const pct = Number(efeito?.alcanceRicochetePct) || 0;
  if (!pct) return base;
  const bruto = base * Math.max(0, 1 + pct / 100);
  return Math.floor(bruto) + (rng() < bruto % 1 ? 1 : 0);
}
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

/**
 * (lote 73, o Mal Inabalável) "Habilidades de Caos ignoram interrupções de Atordoamentos": só atordoado (não congelado), a conjuração de uma
 * habilidade de Caos segue — o tique não a perde (`cacadas.tique`) e ela sai no fim (`disparar` com `concluir`).
 */
export function conjuracaoSegueNoAtordoamento(estado, hunt) {
  if (!hunt?.conjurando) return false;
  const presos = Controle.ativosNoJogador(hunt);
  if (!presos.includes('atordoado') || presos.includes('congelado')) return false;
  if (!(ModsPoe.valor(Ficha.combate(estado), 'caos_ignora_interrupcao') > 0)) return false;
  const entry = POR_ID.get(hunt.conjurando.id);
  return !!entry && tagsPoeDaSkill(entry).includes('caos');
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
    const efeito = Gemas.efeitoNaSkill(estado, entry.id, ativas);
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
      efeito,
      // (A gema do PoE: a conjuração de verdade, a mesma que o `disparar` conjura — `temposDaGemaPoe`.)
      castTime: entry.poeGema ? temposDaGemaPoe(estado, entry, efeito, ficha).conjuracaoMs : Gemas.tempoDeConjuracao(estado, entry.id, ficha.castSpeed, ativas),
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
  const so = itensPoeLigado() ? auraPermitida(Ficha.combate(estado)) : null;
  return Reserva.desligarAsQueSairam(hunt, (id) => (estado.actions ?? []).some((a) => a?.id === id && a.enabled !== false) && ativas.has(id) && !auraDesabilitada(POR_ID.get(id), so));
}
/**
 * (lote 56, a Visão Sublime) "Habilidades de Aura diferentes de <Aura> são Desabilitadas": as auras permitidas pela ficha (`aura_unica:<o nome da
 * gema>` — o conjunto dos nomes), ou null sem a linha. A aura de gema fora dele não liga (`disparar`) e a ligada sai no tique
 * (`desligarAurasForaDaBarra`).
 */
export function auraPermitida(ficha) {
  const so = Object.entries(ficha?.afPoe ?? {}).filter(([k, v]) => k.startsWith('aura_unica:') && v > 0).map(([k]) => k.slice('aura_unica:'.length));
  return so.length ? new Set(so) : null;
}
const auraDesabilitada = (entry, so) => !!so && !!entry?.poeGema && GemasPoe.doSlug(entry.poeGema.slug)?.gema?.tipos?.includes('Aura') && !so.has(ModsPoe.slugDoNome(GemasPoe.doSlug(entry.poeGema.slug)?.gema?.nome ?? ''));

/**
 * As marcas da maldição com o "X% menos Efeito de Maldições Suportadas" da Blasfêmia (`efeitoMaldicaoPct`) e (09/10) o EFEITO das maldições
 * das peças: "Efeito das suas Maldições aumentado em X%" (`efeito_maldicao`) e o de UMA maldição ("Efeito da Maldição Flamabilidade
 * aumentado": `efeito_maldicao_gema:<gema>`) — os implícitos eldritch, influências e únicos. O resto como está.
 */
// O nível das gemas pela árvore ("+2 ao Nível de todas as Gemas de Habilidade Maldição"): o leitor que `skills/gemas` usa.
Gemas.definirLeitorDaArvore((e) => efeitosDaArvore(e)?.adds ?? null);
// (ciclo 7) E o do EFEITO DOS BUFFS das gemas ("Efeito dos Buffs de Arauto em você aumentado", "Habilidades de Vínculo têm Efeito do Buff
// aumentado"): antes só as peças vestidas contavam — a árvore não.
GemasPoe.definirLeitorDaArvore((e) => efeitosDaArvore(e)?.adds ?? null);
/** A duração "infinita" dos Feitiços do Mestre dos Feitiços (a marca dura até o monstro morrer ou outra maldição a substituir). */
export const DURACAO_INFINITA_MS = 1e12;
export function efeitosDaMaldicao(efeitos, efeitoDaGema, estado = null, entry = null) {
  const f = estado && itensPoeLigado() ? Ficha.combate(estado) : null;
  const nome = entry?.poeGema?.slug ? GemasPoe.doSlug(entry.poeGema.slug)?.gema?.nome : null;
  // (ciclo 7: + "Efeito das suas Marcas aumentado em X%" — só nas gemas com a tag Marca)
  const ehMarca = (GemasPoe.doSlug(entry?.poeGema?.slug)?.gema?.tags ?? []).includes('Marca');
  const dasPecas = f ? valorPoe(f, 'efeito_maldicao') + (nome ? valorPoe(f, `efeito_maldicao_gema:${slugDoNome(nome)}`) : 0) + (ehMarca ? valorPoe(f, 'efeito_marca') : 0) : 0;
  const pct = (Number(efeitoDaGema?.efeitoMaldicaoPct) || 0) + dasPecas;
  // (09/10, auditoria de dependências) "Duração da Maldição aumentada em X%" (a árvore, as peças): a marca da maldição dura mais no monstro.
  const duracao = f ? valorPoe(f, 'duracao_maldicao') : 0;
  // "X% menos Efeito das suas Maldições" e "Seus Feitiços têm Duração infinita" (Mestre dos Feitiços — só os Feitiços, as maldições Hex).
  const menos = f ? valorPoe(f, 'efeito_maldicao_menos') : 0;
  const tagsDaGema = GemasPoe.doSlug(entry?.poeGema?.slug)?.gema?.tags ?? [];
  const ehFeitico = tagsDaGema.includes('Feitiço');
  const infinita = !!f && ehFeitico && valorPoe(f, 'feitico_duracao_infinita') > 0;
  const fatorPct = Math.max(0, 1 + pct / 100) * Math.max(0, 1 - menos / 100);
  const saida = efeitos.map((e) => (/^marca/.test(e.efeito) && typeof e.pct === 'number'
    ? { ...e, pct: e.pct * fatorPct, ...(e.durMarca && (duracao || infinita) ? { durMarca: infinita ? DURACAO_INFINITA_MS : Math.round(e.durMarca * Math.max(0, 1 + duracao / 100)) } : {}) }
    : e));
  // As REGRAS da maldição no monstro (`Reforcos.marcar`): o limite ("Você pode aplicar uma Maldição adicional"), o "Efeito aumentado se Y% da
  // Duração expirou" (`efeito_maldicao_expirou:<Y>`) e o "Inimigos Amaldiçoados por você são Desacelerados" — da ficha de quem conjurou.
  if (!f || entry?.poeGema?.arquetipo !== 'maldicao') return saida;
  const expirou = Object.entries(f.afPoe ?? {}).map(([k, v]) => { const m = /^efeito_maldicao_expirou:(\d+)$/.exec(k); return m && Number(v) ? { apos: Number(m[1]) / 100, pct: Number(v) } : null; }).filter(Boolean);
  const desacelera = valorPoe(f, 'maldicao_desacelera');
  // (11/10, os únicos:) "Inimigos Amaldiçoados por você ficam Lentos se Y% da Duração da Maldição expirou" (`maldicao_lento_expirou:<Y>` = a
  // lentidão) e "…sofrem Dano aumentado em X% se Y% da Duração da Maldição expirou" (`maldicao_dano_expirou:<Y>` = X).
  const depoisDe = (prefixo) => Object.entries(f.afPoe ?? {}).map(([k, v]) => { const m = new RegExp(`^${prefixo}:(\\d+)$`).exec(k); return m && Number(v) ? { apos: Number(m[1]) / 100, pct: Number(v) } : null; }).filter(Boolean)[0] ?? null;
  const lentoApos = depoisDe('maldicao_lento_expirou');
  const danoApos = depoisDe('maldicao_dano_expirou');
  // (a MARCA — "Marca do Senhor da Guerra", "Marca do Atirador"… — tem o limite próprio de 1, fora o das outras maldições, como no PoE)
  const marca = tagsDaGema.includes('Marca');
  // (+ à prova de maldições: o Feitiço não pega, salvo "Seus Feitiços podem afetar Inimigos a Prova de Maldições"; "têm Regeneração de Vida
  // reduzida", "não podem Recuperar Escudo de Energia" e "Mortos por você são destruídos" — `Reforcos.marcar` guarda na maldição do monstro.)
  const regenMenos = valorPoe(f, 'amaldicoado_regen_menos');
  // (ciclo 7) As regras da árvore no INIMIGO MARCADO (só a Marca): "não podem Regenerar Vida", "não podem causar Golpes Críticos", "tem
  // Precisão reduzida em X%", "sofre Dano aumentado em X%", "Inimigos próximos do seu Inimigo Marcado são Cegados" e "Sua Marca se transfere
  // para outro Inimigo quando o Inimigo Marcado morrer" — `Reforcos.marcar` guarda na Marca; `condicoes-poe` lê no monstro.
  const daMarca = marca ? Object.fromEntries([['semRegen', 'marcado_sem_regen'], ['semCritico', 'marcado_sem_critico'], ['precisaoMenos', 'marcado_precisao_menos'], ['danoSofrido', 'marcado_dano_sofrido'], ['cegaProximos', 'marcado_cega_proximos'], ['transfere', 'marca_transfere']].map(([k, a]) => [k, valorPoe(f, a)]).filter(([, v]) => v)) : {};
  return [...saida, {
    efeito: 'maldicaoRegras', limite: marca ? 1 : 1 + Math.max(0, valorPoe(f, 'maldicoes_adicionais')), nome: GemasPoe.doSlug(entry.poeGema.slug)?.gema?.nome ?? null,
    ...(marca ? { marca: true } : {}), ...(ehFeitico ? { feitico: true } : {}), ...(valorPoe(f, 'feitico_afeta_aprova') > 0 || valorPoe(f, `feitico_afeta_aprova:${entry.poeGema.slug}`) > 0 ? { afetaAProva: true } : {}),
    ...(expirou.length ? { expirou } : {}), ...(desacelera ? { desacelera } : {}), ...(regenMenos ? { regenMenos } : {}), ...(lentoApos ? { lentoApos } : {}), ...(danoApos ? { danoApos } : {}),
    ...(valorPoe(f, 'amaldicoado_sem_recarga_es') > 0 ? { semRecargaEs: true } : {}), ...(valorPoe(f, 'amaldicoado_destruido') > 0 ? { destruir: true } : {}),
    ...(Object.keys(daMarca).length ? { daMarca } : {}),
  }];
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
/**
 * Os PROJÉTEIS do golpe de um TOTEM (dono, 11/10: "faça os totens e lacaios também"): o mesmo motor do disparo do personagem
 * (`Secundarios.resolver`) — a emissão do total e quem leva cada projétil a mais (o principal o chamador já deu), com a perfuração, a
 * bifurcação, o ricochete, o retorno e a explosão. O totem usa a skill da gema dele inteira: a base ("Dispara 6 projéteis"), os suportes
 * ligados nela e as peças (`comOsAlvosDaGema`). A skill de área do totem fica como a do personagem (sem emissão). Sem projétil: null.
 */
export function projeteisDoTotem(estado, entry, { origem, alvo, vivos }) {
  if (!entry) return null;
  const tags = Tags.tagsDaAcao(entry);
  if (!tags.includes('projectile')) return null;
  const efeito = comOsAlvosDaGema(entry, Gemas.ehSkillDeGema(entry) ? Gemas.efeitoNaSkill(estado, entry.id) : null, estado);
  if (!efeito) return null;
  // (lote 50, a Chuva de Farpas: "Totens atiram N Projéteis adicionais" — `totem_projeteis_extra`, no tiro do totem)
  const doTotemExtra = estado && itensPoeLigado() ? Math.round(ModsPoe.valor(Ficha.combate(estado), 'totem_projeteis_extra')) : 0;
  if (doTotemExtra > 0) efeito.alvosExtras = (efeito.alvosExtras ?? 0) + doTotemExtra;
  // (PoE, 12/10) A Balista de Cerco do Aço: "Ataque do Totem consome até 1 dos Fragmentos de Aço" — os SEUS (`itens-poe/convocar-o-aco.mjs`);
  // "Se não tiver Fragmentos de Aço, só Dispara 1 Projétil".
  const doAco = entry.poeGema && estado?.hunt && itensPoeLigado() ? doAcoDaGema(entry.poeGema.slug, efeito.nivel ?? 1) : null;
  if (doAco?.doTotem) {
    const ficha = Ficha.combate(estado);
    const gastos = Aco.consumir(estado.hunt, ficha, doAco.consome + consumoExtraDoAco(ficha, entry), estado.hunt.clock ?? 0);
    Object.assign(efeito, Aco.projeteisNoUso(doAco, gastos, { base: efeito.projeteisBase ?? 1, extras: efeito.alvosExtras ?? 0, divisao: efeito.divisao ?? 0 }));
  }
  const area = !!entry.forma;
  return Secundarios.resolver({ efeito, tags, origem, alvo: area ? null : alvo, atingidos: [alvo], vivos, alcance: entry.range || ALCANCE_PADRAO, area, andavel: ModsPoe.gradeDoCombate(estado?.hunt)?.andavel ?? null });
}
/** (PoE, 12/10) O que a gema de Aço diz (`Aco.daGema`) por slug e nível — as linhas do nível não mudam (cache). null: não gasta fragmentos. */
const DO_ACO = new Map();
function doAcoDaGema(slug, nivel = 1) {
  const k = `${slug}@${nivel}`;
  if (!DO_ACO.has(k)) DO_ACO.set(k, Aco.daGema(GemasPoe.textosDaGema(slug, nivel).linhas));
  return DO_ACO.get(k);
}
/** ("Ataques que Disparam Projéteis Consomem até N Fragmentos de Aço adicionais" — o Verme de Aço.) */
const consumoExtraDoAco = (ficha, entry) => (entry.poeGema?.ataque && tagsPoeDaSkill(entry).includes('projetil') ? Math.max(0, Math.floor(ModsPoe.valor(ficha, 'aco_consome_extra'))) : 0);
/**
 * (PoE, 12/10) Os FRAGMENTOS DE AÇO no uso da gema de Aço do personagem (`itens-poe/convocar-o-aco.mjs`): gasta até o "Consome até N" (+ o
 * do Verme de Aço), muda os projéteis do uso (`efeitoDaGema`, a cópia deste uso) e dá a Proteção de Aço do Aço Estraçalhador da Munição.
 * Devolve `{ d, gastos }` (o "mais Dano por Fragmento consumido" vale em cada acerto) ou null.
 */
function fragmentosNoUso(estado, hunt, entry, efeitoDaGema, agora) {
  if (!entry.poeGema || !efeitoDaGema || !itensPoeLigado()) return null;
  const d = doAcoDaGema(entry.poeGema.slug, efeitoDaGema.nivel ?? 1);
  if (!d || d.doTotem) return null;
  const ficha = Ficha.combate(estado);
  const antes = Aco.aco(hunt).fragmentos;
  const gastos = Aco.consumir(hunt, ficha, d.consome + consumoExtraDoAco(ficha, entry), agora);
  Object.assign(efeitoDaGema, Aco.projeteisNoUso(d, gastos, { base: efeitoDaGema.projeteisBase ?? 1, extras: efeitoDaGema.alvosExtras ?? 0, divisao: efeitoDaGema.divisao ?? 0 }));
  if (d.protecao) {
    const duracaoMs = Math.round((GemasPoe.compilada(entry.poeGema.slug, efeitoDaGema.nivel ?? 1)?.stats?.duracao ?? 0) * 1000 * fatorDeDuracao(estado, entry, efeitoDaGema));
    if (Aco.ganharProtecao(hunt, d, antes, duracaoMs, agora)) Ficha.invalidar(estado);
  }
  return { d, gastos };
}
/**
 * Os PROJÉTEIS do golpe de longe de um LACAIO (o arqueiro, o mago, o espectro): os suportes de projétil ligados na gema que o invocou —
 * como no PoE, o Projéteis Múltiplos Maior no Erguer Espectro vale nos projéteis dos espectros. As peças do personagem não entram (são
 * dele, não dos lacaios). Sem gema ou sem suporte de projétil: só o principal (o chamador já deu). Devolve o do `Secundarios.resolver`.
 */
export function projeteisDoLacaio(estado, acaoDaGema, { origem, alvo, vivos, alcance }) {
  const entry = POR_ID.get(acaoDaGema);
  if (!entry || !Gemas.ehSkillDeGema(entry)) return null;
  const efeito = Gemas.efeitoNaSkill(estado, entry.id);
  if (!efeito) return null;
  return Secundarios.resolver({ efeito, tags: ['projectile', 'single', 'hit'], origem, alvo, atingidos: [alvo], vivos, alcance });
}

const FATOR_DA_RECARGA_DE_ATAQUE = 0.5;
const recargaDe = (entry, ms) => (entry.papeis?.[0] === 'attack' ? Math.round(ms * FATOR_DA_RECARGA_DE_ATAQUE) : ms);

/**
 * Os ALVOS da gema do PoE no nível dela (`GemasPoe.alvosNoNivel`) somados ao efeito dos suportes: projéteis adicionais e a divisão do
 * feixe (`alvosExtras`), perfuração, difusão, ricochetes do projétil (`encadear`) — e, na magia de CADEIA (o Arco), os saltos da cadeia
 * (`cadeiaPoe`: os da gema + os do suporte de corrente, com o "% mais dano por ricochete restante"), que não passam também pelos
 * golpes secundários (senão saltaria duas vezes).
 */
export function comOsAlvosDaGema(entry, efeito, estado = null) {
  if (!entry.poeGema || entry.poeGema.buff || !efeito) return efeito;
  const a = GemasPoe.alvosNoNivel(entry.poeGema.slug, efeito.nivel ?? 1);
  const e = { ...efeito };
  // PoE: os das PEÇAS — "Habilidades disparam N Projéteis adicionais", "Ataques com Arco disparam N Flechas adicionais", "Gemas Encaixadas
  // atiram N Projéteis adicionais" (a peça da gema), "Projéteis Perfuram N Alvos" e a "Área de Efeito aumentada" (lote 36: o "aumentado" e o
  // "mais" em %, com os dos suportes; o raio da forma cresce × √ no uso — `ModsPoe.casasPelaArea`) — `itens-poe/mods-poe.mjs`.
  const dasPecas = estado ? ModsPoe.alvosDasPecas(estado, Ficha.combate(estado), entry, tagsPoeDaSkill(entry), Gemas.skillsAtivas(estado).get(entry.id)?.onde?.slot ?? null) : null;
  e.alvosExtras = (e.alvosExtras ?? 0) + a.projeteis + a.divide + (dasPecas?.projeteis ?? 0);
  // (12/10) A divisão da gema (o Aço Violento: "Projéteis se Partem na direção de N alvos") — o "Se você não tiver Fragmentos de Aço,
  // Projéteis contam como se já tivessem se Partido" a tira (`fragmentosNoUso`); e o "Habilidades Disparam N Projéteis adicionais por S
  // segundos após você consumir um total de T Fragmentos de Aço" (o Verme de Aço — `itens-poe/convocar-o-aco.mjs`).
  if (a.divide) e.divisao = a.divide;
  if (estado?.hunt?.aco) e.alvosExtras += Aco.projeteisDoBonus(estado.hunt, Ficha.combate(estado));
  // (11/10) A quantidade BASE de projéteis da gema ("Dispara 15 projéteis") e "em sequência": a emissão em `Secundarios.resolver`.
  if ((a.base ?? 0) > 1) e.projeteisBase = a.base;
  if (a.sequencia) e.sequencia = true;
  // (09/10, a maestria da árvore) "Habilidades de Golpe Não Vaal focam em N Inimigo próximo adicional": a gema de Golpear (não Vaal).
  const gemaDoGolpe = GemasPoe.doSlug(entry.poeGema.slug)?.gema;
  if (estado && gemaDoGolpe?.tags?.includes('Golpear') && !gemaDoGolpe.tags.includes('Vaal')) e.alvosExtras += Math.max(0, Math.round(ModsPoe.valor(Ficha.combate(estado), 'golpe_alvos_extra')));
  // (A Fúria Ancestral do Berserker — "Habilidades de Golpe também miram no local anterior que foram Usadas" — é o local de verdade desde o lote
  // 41, P047: `disparar`, `hunt.golpeAnterior`.)
  // (14/10, as linhas que "não se aplicavam" — os projéteis: o Alcance do Ricochete, "N% de chance de Retornarem a você", "de Ricochetear ao
  // colidirem com o terreno", "disparados em direções aleatórias" e "Barragens de Projéteis não se propagam" — `Secundarios.resolver`)
  if (estado) {
    const fichaDoAlvo = Ficha.combate(estado);
    e.alcanceRicochetePct = ModsPoe.valor(fichaDoAlvo, 'alcance_ricochete_inc');
    // (lote 40) a gema do PoE: o ricochete do projétil salta os 6 m do PoE 2 (`Secundarios.resolver`)
    e.ricochetePoe = true;
    e.retornarChance = ModsPoe.valor(fichaDoAlvo, 'proj_retornar_chance');
    e.ricocheteTerrenoChance = ModsPoe.valor(fichaDoAlvo, 'proj_ricochete_terreno_chance');
    if (ModsPoe.valor(fichaDoAlvo, 'proj_direcoes_aleatorias') > 0) e.direcoesAleatorias = true;
    if (ModsPoe.valor(fichaDoAlvo, 'barragem_nao_propaga') > 0) e.semPropagar = true;
  }
  e.perfurar = Math.max(e.perfurar ?? 0, a.perfurar) + (dasPecas?.perfurar ?? 0);
  if (dasPecas?.areaInc) e.areaIncPct = (e.areaIncPct ?? 0) + dasPecas.areaInc;
  if (dasPecas?.areaMais) e.areaMaisPct = ((1 + (e.areaMaisPct ?? 0) / 100) * Math.max(0, 1 + dasPecas.areaMais / 100) - 1) * 100;
  // "Habilidades Ricocheteiam +N vezes": os ricochetes do projétil (os saltos da cadeia, na magia de cadeia).
  if (dasPecas?.ricochetes) e.encadear = (e.encadear ?? 0) + dasPecas.ricochetes;
  e.bifurcar = Math.max(e.bifurcar ?? 0, a.bifurcar) + (dasPecas?.bifurcar ?? 0);
  // (13/10) "Projéteis têm X% de chance de receber um Projétil adicional quando Difundindo" (`Secundarios.resolver`).
  if (estado) e.bifurcarExtraChance = ModsPoe.valor(Ficha.combate(estado), 'proj_difusao_extra_chance');
  // (14/10, o Grande Emissário das Direções: "Projéteis Difundem e Difundem de novo" — os filhos da difusão difundem mais N vezes)
  if (estado && e.bifurcar > 0) e.bifurcarDeNovo = Math.max(0, Math.floor(ModsPoe.valor(Ficha.combate(estado), 'bifurcar_de_novo')));
  if (entry.cadeia) {
    e.cadeiaPoe = { saltos: a.saltos + (e.encadear ?? 0), pct: a.pctPorRestante };
    e.encadear = 0;
  } else e.encadear = (e.encadear ?? 0) + a.saltos;
  // ("Projéteis param ao colidir com um alvo": sem perfurar, difundir nem ricochetear.)
  if (dasPecas?.param) {
    e.perfurar = 0;
    e.bifurcar = 0;
    e.bifurcarDeNovo = 0;
    e.encadear = 0;
    if (e.cadeiaPoe) e.cadeiaPoe = { ...e.cadeiaPoe, saltos: 0 };
  }
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
/**
 * (13/10, o Suserano do Primordial) "Golens Convocados são Reconvocados 4 segundos após serem Mortos": os da fila (`hunt.golensAReconvocar` —
 * `cacadas.tiqueDosLacaios` põe na morte) que já deram o tempo voltam, se a gema ainda está encaixada — a invocação de sempre (o máximo vale),
 * sem custo nem recarga. Devolve os eventos.
 */
export function reconvocarGolens(estado, hunt, agora) {
  const eventos = [];
  const fila = hunt.golensAReconvocar ?? [];
  hunt.golensAReconvocar = fila.filter((x) => x.ate > agora);
  for (const x of fila) {
    if (x.ate > agora) continue;
    const entry = POR_ID.get(x.acao);
    if (!entry?.poeGema?.lacaio || !Gemas.skillsAtivas(estado).has(entry.id)) continue;
    eventos.push(...invocarLacaios(hunt, entry, Gemas.efeitoNaSkill(estado, entry.id), null, estado));
  }
  return eventos;
}
function invocarLacaios(hunt, entry, efeito, alvo, estado = null) {
  const slug = entry.poeGema.slug;
  // (PoE: "usou uma Habilidade de Lacaio Recentemente".)
  ModsPoe.marcar(hunt, 'usouLacaio');
  const q = LacaiosPoe.oQueInvoca(slug, efeito?.nivel ?? 1, efeito, estado ? Ficha.combate(estado)?.afPoe ?? null : null);
  // (a restrição de uma peça — "Você não pode ter Lacaios não-Golens": o de outro tipo não vem)
  if (!q || q.proibido) return [];
  const agora = hunt.ultimoTique ?? Date.now();
  const eventos = [];
  hunt.lacaios ??= [];
  // A OFERENDA: o bônus em todos os lacaios em campo, pela duração dela.
  if (q.tipo === 'oferenda') {
    for (const l of hunt.lacaios) if (l.hp > 0 && l.tipo === 'lacaio') { l.oferenda = { ...q.bonus, ate: agora + q.duracaoMs }; eventos.push({ t: 'fx', id: 13, uid: l.uid, x: l.x, y: l.y, sk: entry.id }); }
    // (PoE, o Necromante: "Suas Habilidades de Oferenda também afetam você" — `condicoes-poe.adds`, com o "redução do Efeito em você".)
    if (estado && ModsPoe.valor(Ficha.combate(estado), 'oferenda_em_voce') > 0) { hunt.oferendaEmVoce = { ...q.bonus, ate: (hunt.clock ?? agora) + q.duracaoMs }; Ficha.invalidar(estado); }
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
  // (ciclo 7) "Habilidades que invocam um Totem têm X% de chance de invocar dois em vez de um".
  const porUso = q.tipo === 'totem' && estado && Math.random() * 100 < ModsPoe.valor(Ficha.combate(estado), 'totem_dois_chance') ? Math.max(q.porUso, 2) : q.porUso;
  const fichaDoTotem = q.tipo === 'totem' && estado ? Ficha.combate(estado) : null;
  const lugar = lugarDoTotem(hunt, fichaDoTotem ? alvo : null, ModsPoe.valor(fichaDoTotem, 'totem_alcance_posicionamento'));
  for (let i = 0; i < porUso; i++) {
    const l = {
      uid: `lacaio:${Date.now().toString(36)}${(seqDeLacaio++).toString(36)}`, gema: slug, acao: entry.id, tipo: q.tipo, nome: q.nome, nivel: q.nivel, desde: agora,
      x: lugar.x, y: lugar.y, dir: hunt.pos.dir ?? 2, look: q.desenho.look, lookItem: q.desenho.lookItem ?? 0, colors: q.desenho.colors,
      hp: q.vida, maxHp: q.vida, dano: q.dano, elemento: q.elemento ?? 'physical', intervaloMs: q.intervaloMs, ate: q.duracaoMs ? agora + q.duracaoMs : null, duracaoMs: q.duracaoMs ?? null,
      // (a conversão do dano Físico do golpe e o "só causa dano de X" — `LacaiosPoe.oQueInvoca`)
      ...(q.conversao ? { conversao: q.conversao, soDano: q.soDano ?? null } : {}),
      // A IA do familiar (`cacadas`): perto do dono, batendo no alvo; o totem não anda e usa a skill a até `alcanceDeAtaque` casas.
      perto: 2, alcance: 0, alcanceDeAtaque: q.tipo === 'totem' ? Math.max(3, entry.range || 6) : Math.max(1, q.estilo?.alcance ?? 1), proximoGolpe: agora + 400, proximoPassoEm: 0,
      // As HABILIDADES próprias (`LacaiosPoe.oQueInvoca`): o jeito de atacar, a velocidade, o crítico, o dano adicionado, o sangramento e o
      // bônus do golem ao dono (enquanto ele vive — `GemasPoe.adds`).
      estilo: q.estilo ?? null, velAtaquePct: q.velAtaquePct ?? 0, critChance: q.critChance ?? 5, ...(q.critChanceBase != null ? { critChanceBase: q.critChanceBase } : {}), critMult: q.critMult ?? 1.5, somado: q.somado ?? [0, 0], sangrar: q.sangrar ?? 0,
      afDono: q.afDono ?? null, porLacaioFisico: q.porLacaioFisico ?? null, golem: !!q.golem, acertos: 0, poe: q.poe ?? null,
      // (lote 44) o lacaio que no PoE não pode sofrer dano (o PoB) e o tipo dele no PoB
      ...(q.intocavel ? { intocavel: true } : {}), ...(q.pob ? { pob: q.pob } : {}),
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
    // (ciclo 7) os mods da árvore no lacaio recém-invocado: o Escudo de Energia ("ganham X% da Vida Máxima como Escudo de Energia").
    LacaiosPoe.aplicarNoLacaio(l);
    hunt.lacaios.push(l);
    eventos.push({ t: 'fx', id: 11, uid: l.uid, x: l.x, y: l.y, sk: entry.id });
    if (fichaDoTotem) eventos.push(...aoConvocarTotem(estado, hunt, l, fichaDoTotem, agora));
  }
  // Passou do máximo da gema: os mais velhos saem.
  const desta = hunt.lacaios.filter((l) => l.gema === slug);
  for (const velho of desta.slice(0, Math.max(0, desta.length - q.maximo))) velho.hp = 0;
  // O golem dá bônus ao dono: a ficha muda.
  if (q.afDono || q.porLacaioFisico) hunt.lacaiosMudaramAFicha = true;
  return eventos;
}

/**
 * (lote 70 — dono, 17/10: "Alcance do totem em casas") Onde o TOTEM nasce: com "Alcance do Posicionamento de Totens aumentado em X%", na
 * direção do alvo, a até X% da distância até ele (casa a casa, só nas andáveis, nunca na casa do alvo); sem o mod (ou sem alvo), na sua casa.
 */
export function lugarDoTotem(hunt, alvo, pct) {
  const p = { x: hunt.pos.x, y: hunt.pos.y };
  if (!alvo || !(pct > 0)) return p;
  const andavel = ModsPoe.gradeDoCombate(hunt)?.andavel ?? null;
  const passos = Math.round((Math.max(Math.abs(alvo.x - p.x), Math.abs(alvo.y - p.y)) * pct) / 100);
  for (let k = 0; k < passos; k++) {
    const prox = { x: p.x + Math.sign(alvo.x - p.x), y: p.y + Math.sign(alvo.y - p.y) };
    if ((prox.x === alvo.x && prox.y === alvo.y) || (andavel && !andavel.has(`${prox.x},${prox.y}`))) break;
    Object.assign(p, prox);
  }
  return p;
}
/** Ao CONVOCAR um totem (`l`, já na caçada): o que os mods fazem nos inimigos perto dele (a até 3 casas) e o evento. Devolve os eventos. */
export function aoConvocarTotem(estado, hunt, l, ficha, agora) {
  const eventos = [];
  const perto = (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && Math.max(Math.abs(m.x - l.x), Math.abs(m.y - l.y)) <= 3);
  // (ciclo 7) "Totens Provocam Inimigos ao redor deles por N segundo quando Convocados".
  const provoca = ModsPoe.valor(ficha, 'totem_provoca_s');
  if (provoca > 0) for (const m of perto) {
    (m.estados ??= {}).provocado = { ate: agora + provoca * 1000, por: l.nome, deLacaio: true };
    eventos.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: 'provocado' });
  }
  // (lote 70) "Totens Desaceleram Inimigos próximos deles quando Convocados": a Lentidão do PoE — o lembrete do catálogo, "reduz a velocidade de
  // movimento em 30% por 4 segundos" (`NO_ACERTO.desacelerar`, a mesma das Magias que Desaceleram).
  if (ModsPoe.valor(ficha, 'totem_desacelera_ao_convocar') > 0) for (const m of perto) {
    const e = (m.estados ??= {});
    const { duracaoMs, lentidaoPct } = NO_ACERTO.desacelerar;
    e.desacelerado = { ate: Math.max(e.desacelerado?.ate ?? 0, agora + duracaoMs), regenMenosPct: ModsPoe.valor(ficha, 'desacelerados_regen_red') };
    e.lento = e.lento?.ate > agora ? { ate: Math.max(e.lento.ate, agora + duracaoMs), pct: Math.max(e.lento.pct, lentidaoPct) } : { ate: agora + duracaoMs, pct: lentidaoPct };
    eventos.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: 'lento' });
  }
  // (lote 70) o evento "ao Convocar um Totem" ("Ganhe Fúria Arcana ao Convocar um Totem" — `ev:convocarTotem:buff:furiaArcana`): um por totem.
  ModsPoe.evento(estado, hunt, 'convocarTotem', ficha, { eventos, totem: l });
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
/**
 * ---- UMA AÇÃO POR VEZ no modo PoE (09/10) ----
 * Um relógio só (`hunt.cooldowns[GRUPO_DO_POE]`, no relógio da CAÇADA) para tudo o que o personagem faz: cada gema do PoE o ocupa pelo
 * tempo de uso dela, e o GOLPE BÁSICO (o ataque padrão do PoE) também, pelo intervalo dele (marcado com `basico: true` — `cacadas.tique`).
 * No tique, a barra decide primeiro e o básico só sai com o relógio livre (é o "enchimento" de quando nenhuma gema pode sair); a gema
 * automática espera o golpe básico terminar. O CLIQUE do jogador (`manual`) não espera o básico: interrompe o resto do golpe.
 * No duelo da arena, o golpe no ADVERSÁRIO também (`adversario: true` — `Arena.antesDoTique`), e ele vem antes da barra: mirar no
 * adversário é o comando do jogador.
 */
export const GRUPO_DO_POE = 'grupo:poe';

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
 *    de ataque) ÷ a velocidade da gema ("X% de base"). É o tempo até a próxima skill (um uso por vez; mais curto que o tique, sai mais
 *    de uma vez nele — `cacadas.tique`); instantânea: 0,25 s (um tique).
 *  - `recarga`: só a da gema no PoE ("Recarga: N seg"), com a recuperação de recarga e os suportes; 0 = sem recarga.
 *  - `conjuracaoMs`: a conjuração da magia (a mesma conta do `uso`, sem o piso do tique; 0 = instantânea ou ataque) — é ela que o `disparar`
 *    conjura, e a magia sai quando o relógio comum libera.
 * Os "aumentada" dos suportes (Ataques Acelerados, a qualidade do Conjuração Acelerada) SOMAM com os aumentos da ficha; os "mais/menos"
 * multiplicam (`castTimePct`). A LENTIDÃO do personagem (resfriado, Lentidão — menos velocidade de ação) segura o ataque e a magia como segura
 * o golpe básico (`cacadas.tique`); a recarga não. `doJogador: false` (o totem usa a gema do dono): sem a lentidão do personagem.
 */
/**
 * A velocidade de ataque "aumentada" CONDICIONAL dos suportes do PoE, no estado de agora: o Momentum ("N% por Momentum" × o Momentum
 * acumulado — `ModsPoe.ganharMomentum`) e a Fúria ("N% enquanto você tiver ao menos M de Fúria": `velAtaquePct@furia:M`). Antes o da Fúria
 * valia sempre e o Momentum não fazia nada (o suporte ficava travado como "sem sistema" por citar a canalização).
 */
function velocidadeCondicional(estado, efeito) {
  if (!efeito) return 0;
  let pct = (Number(efeito.velAtaquePorMomentumPct) || 0) * ModsPoe.momentumAtual(estado);
  for (const [k, v] of Object.entries(efeito)) {
    const m = k.match(/^velAtaquePct@furia:(\d+)$/);
    if (m && ModsPoe.furiaAtual(estado) >= Number(m[1])) pct += Number(v) || 0;
  }
  return pct;
}
/** A gema instantânea (sem tempo de uso: 0 de conjuração, ou "Utilizar Habilidades Suportadas é Instantâneo") ocupa um tique. */
const USO_DA_INSTANTANEA_MS = 250;
export function temposDaGemaPoe(estado, entry, efeitoDaGema = Gemas.efeitoNaSkill(estado, entry.id), ficha = Ficha.combate(estado), { doJogador = true } = {}) {
  const t = GemasPoe.temposNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1);
  const suportes = 1 + (efeitoDaGema?.castTimePct ?? 0) / 100;
  const ataque = !!entry.poeGema.ataque;
  // PoE: a velocidade de conjuração / a recuperação de recarga "com Habilidades de Fogo", "de Movimento", "do Totem"… (pelas tags da gema).
  const porTag = ModsPoe.somaPorTags(ficha, tagsPoeDaSkill(entry));
  const castSpeed = (ficha.castSpeed ?? 0) + (porTag.cast_speed_tag ?? 0) + (efeitoDaGema?.velConjuracaoPct ?? 0);
  // O ataque: o intervalo da ficha (`1000 / APS` ÷ (1 + aumentos globais)) com os aumentos da gema somados aos globais.
  const global = ficha.velocidadeDeAtaque ?? 0;
  // (ciclo 7) + a velocidade de ataque "com Habilidades de X" (`atk_speed@<tag>` — Retaliação, Movimento…): antes não entrava em lugar nenhum.
  const daGema = (efeitoDaGema?.velAtaquePct ?? 0) + (doJogador ? velocidadeCondicional(estado, efeitoDaGema) : 0) + (porTag.atk_speed ?? 0);
  const intervalo = ((ficha.intervaloDoGolpeMs ?? 2000) * Math.max(0.1, 1 + global / 100)) / Math.max(0.1, 1 + (global + daGema) / 100);
  const lentidao = doJogador ? Controle.fatorDeLentidao(estado.hunt) : 1;
  // (lote 34, P008: o CLAMOR não é ataque nem magia — a Velocidade de Conjuração não vale nele; o tempo de uso dele encurta pela "Velocidade dos
  // Clamores aumentada", `velocidade_clamor`)
  const ehClamor = entry.poeGema.arquetipo === 'clamor';
  const velocidadeDoUso = ehClamor ? ModsPoe.valor(ficha, 'velocidade_clamor') + (porTag.velocidade_clamor ?? 0) : castSpeed;
  const bruto = (ataque ? (intervalo / (t.velAtaqueBase / 100)) * suportes : (t.conjuracaoMs * suportes) / (1 + Math.max(0, velocidadeDoUso) / 100)) * lentidao;
  // (ciclo 7) + a "Recuperação da Recarga" de UMA gema ("Convocação tem Recuperação da Recarga aumentada"): `recarga_gema:<slug>` — vale também
  // nas versões transfiguradas (o slug começa igual: Blink_Arrow → Blink_Arrow_of_Prismatic_Clones).
  // (+ lote 74, o Reduzir: "Convocação de Runas tem Recuperação da Recarga aumentada em X% por Runa, até Y%" — as suas Runas em campo agora)
  const porRuna = Runas.ehConvocarRunas(entry) ? ModsPoe.valor(ficha, 'convocar_runas_recarga_por_runa') : 0;
  const daConvocacao = porRuna > 0 ? Math.min(ModsPoe.valor(ficha, 'convocar_runas_recarga_max') || Infinity, porRuna * Runas.ativas(estado?.hunt).length) : 0;
  const daGemaNomeada = daConvocacao + Object.entries(ficha.afPoe ?? {}).reduce((n, [k, v]) => (k.startsWith('recarga_gema:') && typeof v === 'number' && entry.poeGema.slug.startsWith(k.slice('recarga_gema:'.length)) ? n + v : n), 0);
  // (PoE, os únicos: "A Recarga de Habilidades Clamor é de N segundos" — a base do clamor no lugar da da gema; a recuperação vale por cima.)
  const clamorFixo = entry.poeGema.arquetipo === 'clamor' ? ModsPoe.valor(ficha, 'recarga_clamor_fixa') : 0;
  // (+ "Projéteis Mágicos Encaixados têm +N segundos de Recarga" — a recarga a mais da peça, na base; + ciclo 7, lote G: "Habilidades de Postura
  // têm +N segundos de Recarga" — `recarga_extra_s@postura`.)
  const recargaBase = Math.max(0, (clamorFixo > 0 ? clamorFixo * 1000 : t.recargaMs ?? 0) + (efeitoDaGema?.recargaExtraMs ?? 0) + 1000 * (porTag.recarga_extra_s ?? 0));
  // ("Clamores não instantâneos ignoram o tempo de recarga ao serem utilizados": o clamor com tempo de uso sai sem recarga.)
  const clamorSemRecarga = entry.poeGema.arquetipo === 'clamor' && (t.conjuracaoMs ?? 0) > 0 && ModsPoe.valor(ficha, 'clamor_sem_recarga') > 0;
  const recarga = recargaBase > 0 && !clamorSemRecarga ? Math.round((recargaBase / Math.max(0.1, 1 + ((ficha.recuperacaoDeRecarga ?? 0) + (porTag.cooldown_recovery ?? 0) + daGemaNomeada) / 100)) * (1 + (efeitoDaGema?.recargaPct ?? 0) / 100)) : 0;
  // (O piso de 250 ms é só da INSTANTÂNEA, um tique; o resto vai até `R.INTERVALO_MINIMO_DA_ACAO_MS` — mais de uma ação cabe num tique.)
  const uso = bruto > 0 ? Math.max(R.INTERVALO_MINIMO_DA_ACAO_MS, Math.round(bruto)) : USO_DA_INSTANTANEA_MS;
  // (+ "Habilidades de Clamor Encaixadas têm +N Usos de Recarga" — os usos a mais da peça, `efeitoDaGema.usosExtra`; + 12/10, a árvore:
  // "Habilidades que Arremessam Armadilhas têm +1 Uso de Recarga" — `usos_recarga@armadilha`.)
  const usosExtra = (efeitoDaGema?.usosExtra ?? 0) + (porTag.usos_recarga ?? 0);
  const cargas = usosExtra ? Math.max(1, t.cargas ?? 1) + usosExtra : t.cargas;
  return { uso, recarga, ataque, conjuracaoMs: ataque ? 0 : Math.round(bruto), conjuracaoBaseMs: t.conjuracaoMs, velAtaqueBase: t.velAtaqueBase, cargas };
}

/** O cooldown global com `castSpeed`% de Cast Speed: a base (`R.GLOBAL_SPELL_COOLDOWN`) encurtada por ele (decisão do dono). */
export const intervaloGlobalCom = (castSpeed = 0) => Math.round(R.GLOBAL_SPELL_COOLDOWN / (1 + Math.max(0, castSpeed ?? 0) / 100));
/** O cooldown global de AGORA para este personagem. */
export const intervaloGlobal = (estado) => intervaloGlobalCom(Ficha.combate(estado).castSpeed);

export function disparar(estado, hunt, personagem, slot, alvo, opcoes) {
  // Congelado ou atordoado (controle de boss/elite, `combate/controle.mjs`): nada sai. (lote 73: salvo a conjuração de Caos que segue no
  // atordoamento — o Mal Inabalável, `conjuracaoSegueNoAtordoamento` — quando chega ao fim.)
  if (!Controle.podeAgir(hunt, hunt?.clock ?? 0) && !(opcoes?.concluir && conjuracaoSegueNoAtordoamento(estado, hunt))) return { ok: false, erro: 'Você está paralisado.', motivo: 'CONTROLE' };
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

function dispararSemMarcar(estado, hunt, personagem, slot, alvo, { concluir = false, mira = null, gatilho = null, manual = false, plantada = null } = {}) {
  // Morto não lança nada (o clique manual chegava aqui entre o golpe e o fim da caçada).
  if ((estado.hp ?? 0) <= 0) return { ok: false, erro: 'Você está morto.', motivo: 'MORTO' };
  // (PoE, 12/10) `plantada`: a ARMADILHA que um inimigo ativou / a MINA detonada (`itens-poe/armas-plantadas.mjs`) — a habilidade da gema sai
  // DO LUGAR dela, sem custo, recarga, conjuração nem as condições do slot (tudo isso foi do arremesso, como no PoE). Sem inimigo, nada.
  if (plantada) {
    if (!alvo) return { ok: true, eventos: [] };
    gatilho = { acao: { id: plantada.acao }, semCusto: true, plantada: true };
  }
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
  // Numa Safe Zone o jogador não ataca (`protecao.mjs`): a cura, o buff e a poção saem; a magia de ataque, não.
  if (entry.papeis?.[0] === 'attack' && Protecao.imune(hunt)) return { ok: false, erro: 'Numa zona segura não se ataca.', motivo: 'ZONA_SEGURA' };
  // A magia ligada a um suporte de gatilho só sai pelo gatilho (como no PoE: não se conjura à mão).
  if (!gatilho && entry.poeGema && Gemas.ativadaPor(estado, entry.id)) return { ok: false, erro: `Ativada por ${Gemas.ativadaPor(estado, entry.id)}.`, motivo: 'ATIVADA_POR_GATILHO' };
  // A habilidade que um ÚNICO ativa ("Ativa X quando…"): só sai pelo evento, como no PoE.
  if (!gatilho && entry.poeGema && Gemas.skillsAtivas(estado).get(entry.id)?.ativadaPorItem) return { ok: false, erro: 'Ativada pelo item.', motivo: 'ATIVADA_POR_GATILHO' };
  // (14/10) O Infestador alterna sozinho, ligado na barra (`tiqueDaPraga`).
  if (entry.poeGema?.arquetipo === 'praga') return { ok: false, erro: 'O Infestador alterna sozinho entre Incubando e Infestando.', motivo: 'SOZINHA' };

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
  // (a ativação a mais dos Robôs Ativadores ignora a recarga — `gatilho.ignorarRecarga`)
  if (!plantada && !gatilho?.ignorarRecarga && cd && !R.liberou(agora, cd.ate)) return { ok: false, erro: 'Ainda recarregando.', motivo: 'COOLDOWN', faltaMs: cd.ate - agora };
  // (PoE, 11/10) A RETALIAÇÃO só se usa na janela: depois de bloquear um acerto (ou de um Acerto Selvagem) — `ModsPoe.abrirRetaliacao`.
  const gatilhoDaRetaliacao = !gatilho && entry.poeGema ? GemasPoe.gatilhoDeRetaliacao(entry.poeGema.slug) : null;
  if (gatilhoDaRetaliacao && !concluir && !ModsPoe.retaliacaoUsavel(hunt, gatilhoDaRetaliacao, entry.poeGema.slug, hunt.clock ?? 0)) {
    return { ok: false, erro: gatilhoDaRetaliacao === 'selvagem' ? 'Só depois de sofrer um Acerto Selvagem (Retaliação).' : 'Só depois de bloquear um acerto (Retaliação).', motivo: 'RETALIACAO' };
  }
  const grupo = `grupo:${entry.group ?? entry.kind}`;
  // Magias: recarga do grupo (attack/healing/support). Poções: uma recarga só
  // para todas, como no Tibia (vida e mana não saem no mesmo instante). Runa
  // de ATAQUE divide a recarga do grupo com as magias de ataque, como no Tibia:
  // antes ela saía junto, em paralelo, e as três runas de uma barra de knight
  // davam 215 golpes cada em 10 min por cima das magias (sem captura de runa no
  // original para conferir — é a regra do Tibia). Runa de cura continua livre.
  const grupoDeAtaque = entry.kind === 'rune' && entry.papeis?.[0] === 'attack' ? 'grupo:attack' : null;
  // Gema do PoE: uma ação por vez entre TODAS as skills (ataque, magia, aura...) e o golpe básico — um relógio só (`GRUPO_DO_POE`).
  const grupoQueConta = entry.poeGema ? GRUPO_DO_POE : grupoDeAtaque ?? (entry.kind !== 'rune' ? grupo : null);
  // (O clique do jogador interrompe o golpe básico em andamento; a barra automática espera ele terminar. A conjuração que o clique começou
  // por cima do golpe também não é barrada por ele no fim — conjurando, o básico não sai, e o golpe que segura o grupo é o interrompido.)
  const interrompeOBasico = (manual || concluir) && cds[grupoQueConta]?.basico;
  if (!gatilho && !interrompeOBasico && grupoQueConta && cds[grupoQueConta] && !R.liberou(agora, cds[grupoQueConta].ate)) {
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
  // (PoE, a Lâmina Noturna: "Habilidades Suportadas só podem ser usadas com Garras e Adagas".)
  if (efeitoDaGema?.soGarraAdaga && !/^(Claws|Daggers|Rune_Daggers)$/.test(String(estado.equipment?.weapon?.poe?.classe ?? ''))) return { ok: false, erro: 'Só com Garras e Adagas (Lâmina Noturna).', motivo: 'ARMA' };
  // (PoE, o Intensificar: a INTENSIDADE desta magia agora — "perdem 1 de Intensidade a cada N segundos enquanto se movendo"; ela vale nesta
  // conjuração — mais dano em área, menos área — e a conjuração ganha 1, até o máximo — `ganharIntensidade`, depois do uso.)
  const intensidade = efeitoDaGema?.intensidadeMax > 0 ? intensidadeAgora(hunt, entry.id, efeitoDaGema, hunt.clock ?? 0, Ficha.combate(estado).afPoe) : 0;
  // (lote 46, o Punho de Guerra: "Ataques com a Habilidade Suportada são Maximizados Ancestralmente, não mais que uma vez a cada N segundos") este
  // ataque é o MAXIMIZADO? — só nele o "X% mais Dano com Acertos e Afecções" e a "Área de Efeito aumentada" dos Impactos; as repetições, não.
  const maximizado = efeitoDaGema?.maximizadoMs > 0 && !!entry.poeGema?.ataque && (hunt.clock ?? 0) >= (hunt.poeMaximizadoAte?.[entry.id] ?? -Infinity);
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
  // (+ "Habilidades de maldição com aura reservam vida em vez de mana": a maldição em aura — a Blasfêmia.)
  const reservaEmVida = !!efeitoDaGema?.custoEmVida || temHabilidade(estado, 'magiaSanguinea') || ModsPoe.valor(fichaDoCusto, 'keystone_magia_sanguinea') > 0 || (Reserva.ehMaldicaoEmAura(entry, efeitoDaGema) && ModsPoe.valor(fichaDoCusto, 'maldicao_aura_reserva_vida') > 0);
  const reserva = Reserva.pedida(estado, entry, efeitoDaGema, fichaDoCusto, reservaEmVida);
  // (lote 56, a Visão Sublime: "Habilidades de Aura diferentes de <Aura> são Desabilitadas")
  if (itensPoeLigado() && auraDesabilitada(entry, auraPermitida(fichaDoCusto))) return { ok: false, erro: `${entry.name} está Desabilitada (Visão Sublime).`, motivo: 'AURA_DESABILITADA' };
  if (reserva && !Reserva.cabe(estado, entry.id, reserva)) {
    return { ok: false, erro: `Sem ${reserva.recurso} livre para reservar: ${entry.name} reserva ${reserva.valor}.`, motivo: 'RESERVA' };
  }
  // (A MINA do PoE reserva mana enquanto está armada — no jogo, a reserva dela é o custo de cada uma: a Eficácia da Reserva de mana, a geral
  // e a "das Habilidades que arremessam Minas" o reduzem.)
  const eficaciaDaMina = entry.poeGema?.arquetipo === 'mina' ? ModsPoe.valor(fichaDoCusto, 'eficiencia_reserva') + ModsPoe.valor(fichaDoCusto, 'eficiencia_reserva_mana') + ModsPoe.valor(fichaDoCusto, 'eficiencia_reserva_minas') : 0;
  // (ciclo 7, lote E: a eficiência e o "não custam mana" por TAG da habilidade — "Eficiência de custo de mana de magias aumentada",
  // "…de habilidades de Retaliação", "Habilidades de marca não custam mana".)
  const doCustoPorTag = entry.poeGema ? ModsPoe.somaPorTags(fichaDoCusto, tagsPoeDaSkill(entry)) : {};
  // (o Vínculo não paga ao conjurar: custa por segundo, enquanto vincula — `tiqueDosVinculos`)
  const custoDeMana = entry.kind === 'item' || gatilho?.semCusto || reserva || Vinculos.ehVinculo(entry) || (doCustoPorTag.sem_custo_mana ?? 0) > 0 ? 0 : Math.max(0, Math.round((custoDaSkill(entry, efeitoDaGema) * (1 + (fichaDoCusto.custoDeMana ?? 0)) * (1 + (efeitoDaGema?.custoPct ?? 0) / 100) * Math.max(0, 1 + (ModsPoe.valor(fichaDoCusto, 'custo_mana_inc') + (doCustoPorTag.custo_mana_inc ?? 0)) / 100) * Math.max(0, 1 + (doCustoPorTag.custo_mana_mais ?? 0) / 100)) / Math.max(0.1, 1 + (ModsPoe.valor(fichaDoCusto, 'eficiencia_custo_mana') + (doCustoPorTag.eficiencia_custo_mana ?? 0)) / 100) / Math.max(0.1, 1 + eficaciaDaMina / 100) + ModsPoe.valor(fichaDoCusto, 'custo_mana_fixo') + (doCustoPorTag.custo_mana_fixo ?? 0)));
  // Life Cost (support): o custo sai da VIDA, e não da mana (sem deixar o personagem a menos de 1).
  // Magia Sanguínea (keystone do PoE): as habilidades custam Vida em vez de Mana.
  const pagaComVida = (!!efeitoDaGema?.custoEmVida || temHabilidade(estado, 'magiaSanguinea') || ModsPoe.valor(Ficha.combate(estado), 'keystone_magia_sanguinea') > 0) && custoDeMana > 0;
  if (pagaComVida && (estado.hp ?? 0) <= custoDeMana) return { ok: false, erro: 'Sem vida para pagar.', motivo: 'VIDA' };
  // (09/10, as maestrias da árvore:) "Habilidades (de Ataque) custam Vida ao invés de X% do seu Custo de Mana": essa parte sai da vida.
  const parteEmVida = pagaComVida || !custoDeMana ? 0 : Math.round((custoDeMana * Math.min(100, Math.max(0, ModsPoe.valor(fichaDoCusto, 'custo_em_vida_pct')))) / 100);
  if (parteEmVida && (estado.hp ?? 0) <= parteEmVida) return { ok: false, erro: 'Sem vida para pagar.', motivo: 'VIDA' };
  // (PoE, os únicos: "Habilidades custam escudo de energia em vez de mana ou vida" — `custo_em_es`; "Habilidades ganham Custo Base de Vida /
  // de Escudo de Energia igual a X% do Custo de Mana" — o custo a mais, além do de mana.)
  const pagaComEscudo = !pagaComVida && custoDeMana > 0 && ModsPoe.valor(fichaDoCusto, 'custo_em_es') > 0;
  if (pagaComEscudo && (estado.es ?? 0) < custoDeMana) return { ok: false, erro: 'Sem escudo de energia para pagar.', motivo: 'ESCUDO' };
  const vidaAMais = custoDeMana > 0 ? Math.round((custoDeMana * ModsPoe.valor(fichaDoCusto, 'custo_vida_extra_pct')) / 100) : 0;
  const escudoAMais = custoDeMana > 0 ? Math.round((custoDeMana * ModsPoe.valor(fichaDoCusto, 'custo_es_extra_pct')) / 100) : 0;
  if (vidaAMais && (estado.hp ?? 0) <= vidaAMais) return { ok: false, erro: 'Sem vida para pagar.', motivo: 'VIDA' };
  if (escudoAMais && (estado.es ?? 0) < escudoAMais) return { ok: false, erro: 'Sem escudo de energia para pagar.', motivo: 'ESCUDO' };
  // (PoE: com "Gaste Escudo de Energia antes da Mana" na peça da gema, o escudo cobre parte do custo.)
  const slotDaGema = Gemas.ehSkillDeGema(entry) ? Gemas.skillsAtivas(estado).get(entry.id)?.onde?.slot ?? null : null;
  const escudoNoCusto = ModsPoe.escudoParaOCusto(estado, slotDaGema, Ficha.combate(estado));
  // ("Mana Insuficiente não impede seus Ataques Corpo a Corpo".)
  const semManaPode = ModsPoe.valor(fichaDoCusto, 'ataque_sem_mana') > 0 && tagsPoeDaSkill(entry).includes('corpo');
  if (!pagaComVida && !pagaComEscudo && custoDeMana - parteEmVida > 0 && !semManaPode && (estado.mana ?? 0) + escudoNoCusto < custoDeMana - parteEmVida) return { ok: false, erro: 'Sem mana.', motivo: 'MANA' };
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
  // (lote 36) Onde a forma caiu (o centro e o lado) e a área deste uso com a Área de Efeito — a Repetição Final a refaz com o "aumentado" dela.
  let formaNoUso = null;
  let areaNoUso = null;
  // (lote 42, P067) "Projéteis são disparados em direções aleatórias": o projétil de alvo único não vai no alvo — todos saem em direções sorteadas
  // (`Secundarios.resolver`); o golpe direto e o tiro desenhado no alvo não saem.
  const projeteisAleatorios = () => !!efeitoDaGema?.direcoesAleatorias && !casas && Tags.tagsDaAcao(entry).includes('projectile');
  let virarPara = null;
  // (PoE, 12/10) A gema que PLANTA (Armadilha, Mina): o uso joga a armadilha/mina no lugar mirado; a habilidade sai quando ela ativa.
  const tipoPlantado = Plantadas.tipoDaGema(entry);
  if (ataque) {
    const centradoNoAlvo = entry.miraNoChao || entry.alvoNoCentro;
    if (plantada) {
      // A Armadilha ativada / a Mina detonada / a Runa Ativada: a área em volta DELA (sem alcance — ela está lá); a de alvo único, em quem a
      // ativou (com a cadeia da gema).
      if (entry.forma) {
        casas = casasDaForma(entry, plantada.x, plantada.y);
        formaNoUso = { x: plantada.x, y: plantada.y, dir: null };
      } else if (!(alvo.hp > 0)) atingidos = [];
      else atingidos = entry.cadeia ? saltosDaCadeia(alvo, vivos, efeitoDaGema?.cadeiaPoe ? { ...entry.cadeia, targets: 1 + efeitoDaGema.cadeiaPoe.saltos, distance: alcanceDoRicochete(DISTANCIA_DA_CADEIA_POE(), efeitoDaGema) } : entry.cadeia) : [alvo];
    } else if (!entry.forma) {
      if (!alvo) return { ok: false, erro: 'Sem alvo.', motivo: 'SEM_ALVO' };
      // Sem `range` próprio é golpe de corpo a corpo (Brutal Strike, Tiger Clash...). (lote 35 — P001: com o alcance corpo a corpo em metros — o
      // da arma + os "+X metros ao Alcance de Golpes Corpo a Corpo", `Ficha.alcanceCorpoExtra` —, como o golpe básico)
      const corpoDaGemaNoAlvo = itensPoeLigado() && (!entry.range || (entry.poeGema && tagsPoeDaSkill(entry).includes('corpo')));
      const alcanceDoGolpe = (entry.range || 1) + (corpoDaGemaNoAlvo ? Ficha.combate(estado).alcanceCorpoExtra ?? 0 : 0);
      if (distanciaChebyshev(hunt.pos, alvo) > alcanceDoGolpe) return { ok: false, erro: 'Alvo fora de alcance.', motivo: 'FORA_DE_ALCANCE' };
      atingidos = [alvo];
      // CADEIA (tag `chain`: Forked Thorns, Forked Glacier, Chained Penance...): do alvo, salta para o
      // bicho vivo mais perto a até `cadeia.distance` sqm do último atingido, até `cadeia.targets` alvos.
      // A cadeia da gema do PoE: 1 + os ricochetes DO NÍVEL dela (+ os do suporte de corrente); a distância do salto é a da magia-molde.
      if (entry.cadeia) atingidos = saltosDaCadeia(alvo, vivos, efeitoDaGema?.cadeiaPoe ? { ...entry.cadeia, targets: 1 + efeitoDaGema.cadeiaPoe.saltos, distance: alcanceDoRicochete(DISTANCIA_DA_CADEIA_POE(), efeitoDaGema) } : entry.cadeia);
    } else if (centradoNoAlvo && entry.miraNoChao && mira) {
      // A casa que o jogador escolheu na mira (`huntAction` com x, y): a área cai lá, com ou sem alvo.
      if (distanciaChebyshev(hunt.pos, mira) > (entry.range || ALCANCE_PADRAO)) return { ok: false, erro: 'Fora de alcance.', motivo: 'FORA_DE_ALCANCE' };
      casas = casasDaForma(entry, mira.x, mira.y);
      formaNoUso = { x: mira.x, y: mira.y, dir: null };
    } else if (centradoNoAlvo) {
      if (!alvo) return { ok: false, erro: 'Sem alvo.', motivo: 'SEM_ALVO' };
      if (distanciaChebyshev(hunt.pos, alvo) > (entry.range || ALCANCE_PADRAO)) return { ok: false, erro: 'Alvo fora de alcance.', motivo: 'FORA_DE_ALCANCE' };
      casas = casasDaForma(entry, alvo.x, alvo.y);
      formaNoUso = { x: alvo.x, y: alvo.y, dir: null };
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
      formaNoUso = { x, y, dir: melhor.dir };
    }
    // A ÁREA DE EFEITO (lote 36, P002 — a decisão do dono "Toda área em metros"): o raio da forma × √(1 + o "aumentado") × √ de cada
    // "mais/menos" — o das peças e da ficha, o dos suportes do PoE (Área de Efeito Aumentada, Efeito Concentrado…), a Intensidade ("X% menos
    // Efeito em Área por Intensidade", um "menos" só: X × a Intensidade) e a Runa ("Runas têm Área de Efeito aumentada em X% caso Y% da
    // Duração do Vínculo tenha expirado" — `plantada.areaPct`, do tique); a fração vira chance de uma casa (`ModsPoe.casasPelaArea`), e a
    // FORMA estica (ou encolhe) até o raio novo em volta do centro (`Areas.escalarForma` — o losango segue losango). (+ os suportes do
    // Draevor, no modo clássico: `areaExtra` casas em volta, `Areas.mudar`.)
    if (casas && formaNoUso) {
      const base = casas;
      const raio = Areas.raioDaForma(entry.forma);
      const inc = (efeitoDaGema?.areaIncPct ?? 0) + (plantada?.areaPct ?? 0) + (maximizado ? efeitoDaGema.maximizadoAreaIncPct ?? 0 : 0);
      const mais = [efeitoDaGema?.areaMaisPct ?? 0, intensidade > 0 ? -intensidade * (efeitoDaGema.intensidadeMenosAreaPct ?? 0) : 0];
      const legado = Math.round(efeitoDaGema?.areaExtra ?? 0);
      areaNoUso = (incExtra = 0) => {
        const n = ModsPoe.casasPelaArea(raio, ModsPoe.fatorDaArea(inc + incExtra, ...mais));
        const cs = n ? Areas.daForma(Areas.escalarForma(entry.forma, raio + n), formaNoUso, formaNoUso.dir) : base;
        return legado ? Areas.mudar(cs, legado) : cs;
      };
      casas = areaNoUso();
    }
    // Quem está nas casas da área: por índice de casa (sem varrer área × bichos).
    if (casas) atingidos = Areas.dentro(casas, vivos);
  }
  /*
   * ---- A faixa de criaturas do slot ("Mínimo" e "Máximo de criaturas") ----
   * Na magia de área conta quem a área PEGA; na de alvo único (e na cadeia), quem
   * está a até `RAIO_DA_FAIXA` sqm — o que a tela diz. Máximo 0 = sem teto.
   */
  if (ataque && !plantada) {
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
  // (PoE, os únicos: "Habilidades de Movimento que não sejam Avanço são Desabilitadas".)
  if (entry.poeGema && (GemasPoe.doSlug(entry.poeGema.slug)?.gema?.tags ?? []).includes('Movimento') && !/^Dash$/i.test(GemasPoe.doSlug(entry.poeGema.slug)?.gema?.en ?? '') && ModsPoe.valor(Ficha.combate(estado), 'movimento_so_avanco') > 0) {
    return { ok: false, erro: 'Só o Avanço pode ser usado (um item equipado desabilita as outras de movimento).', motivo: 'MOVIMENTO_DESABILITADO' };
  }
  // (PoE, os únicos: "Suas Magias são desabilitadas" — o Couro de Gruthkul: a gema com a tag Magia não sai, nem aura nem lacaio.)
  if (entry.poeGema && (GemasPoe.doSlug(entry.poeGema.slug)?.gema?.tags ?? []).includes('Magia') && ModsPoe.valor(Ficha.combate(estado), 'magias_desabilitadas') > 0) {
    return { ok: false, erro: 'Suas magias estão desabilitadas (um item equipado).', motivo: 'MAGIAS_DESABILITADAS' };
  }
  // Suporte: não relança enquanto o efeito dele ainda está ligado.
  const buff = BUFFS[entry.id];
  if (buff && !R.jaPode(agora, hunt.buffs?.[entry.id]?.ate)) return { ok: false, erro: 'Ainda está ativo.', motivo: 'EFEITO_ATIVO' };
  // (PoE, 11/10) O ESTANDARTE se planta consumindo o Valor: sem Valor, não sai; no automático, só com o Valor no máximo (o clique planta com o que
  // tiver) — `ModsPoe.plantarEstandarte`.
  if (buff && entry.poeGema && /_Banner$/.test(entry.poeGema.slug) && itensPoeLigado()) {
    const v = Math.floor(ModsPoe.valorAtual(hunt));
    const max = ModsPoe.valorMaximo(Ficha.combate(estado).afPoe);
    if (v < 1 || (!manual && v < max)) return { ok: false, erro: v < 1 ? 'Sem Valor para plantar o Estandarte.' : `Juntando Valor para o Estandarte (${v}/${max}).`, motivo: 'SEM_VALOR' };
  }
  // A skill que desliga um reforço (dados: `cancelamentos`) só sai com ele ligado.
  const cancela = Reforcos.CANCELA[entry.id];
  if (cancela && !temBuff(hunt, cancela)) return { ok: false, erro: 'Não há o que cancelar.', motivo: cancela === 'shield' ? 'SEM_ESCUDO' : 'SEM_REFORCO' };
  // (PoE, 12/10) As RUNAS: com todas em campo (3 — `itens-poe/runas-vinculadas.mjs`) e nenhuma acabando, o automático não conjura outra (ela
  // tiraria a mais velha, ainda Ativando); o clique conjura.
  if (Runas.ehRuna(entry) && !manual && !gatilho && !concluir && Runas.cheias(hunt, Ficha.combate(estado))) {
    return { ok: false, erro: `Já estão todas as Runas em campo (${Runas.ativas(hunt).length}/${Runas.maximo(Ficha.combate(estado))}).`, motivo: 'RUNAS_COMPLETAS' };
  }
  // (lote 74) a Convocar Runas sem Runa em campo: o automático não a gasta (o clique usa).
  if (Runas.ehConvocarRunas(entry) && !manual && !gatilho && !concluir && !Runas.ativas(hunt).length) {
    return { ok: false, erro: 'Nenhuma Runa em campo para convocar.', motivo: 'SEM_RUNAS' };
  }
  // (PoE, 12/10) o VÍNCULO (`itens-poe/vinculos.mjs`): com o da gema ainda ligado (e não acabando), não relança; sem aliado para focar, não sai.
  if (Vinculos.ehVinculo(entry)) {
    const ligado = Vinculos.vinculos(hunt).find((lk) => lk.acao === entry.id);
    if (ligado && ligado.ate - agora > 1000) return { ok: false, erro: 'Ainda está ativo.', motivo: 'EFEITO_ATIVO' };
    if (!Vinculos.candidatos(estado, hunt, Ficha.combate(estado).afPoe).length) return { ok: false, erro: 'Nenhum aliado para vincular (a party na sala, ou um lacaio com o nó da árvore).', motivo: 'SEM_ALIADO' };
  }
  // LACAIOS do PoE: com todos em campo (e sem duração para renovar), a gema não sai — o auto não fica relançando à toa.
  if (entry.poeGema?.lacaio) {
    // (com a soma do DONO — a mesma da invocação, `invocarLacaios`: "+1 ao número máximo de Zumbis" da árvore e das peças sobe o máximo; sem ela
    // o máximo daqui era o da gema e a gema era recusada antes de invocar o extra — auditoria de dependências, 09/10)
    const q = LacaiosPoe.oQueInvoca(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema, Ficha.combate(estado)?.afPoe ?? null);
    const desta = (hunt.lacaios ?? []).filter((l) => l.gema === entry.poeGema.slug && l.hp > 0);
    // Com todos em campo, só relança quando o mais velho está para acabar (a duração): senão o novo trocaria o velho sem parar.
    const agoraL = hunt.ultimoTique ?? Date.now();
    const venceLogo = desta.some((l) => l.ate && l.ate - agoraL < 1000);
    if (q?.proibido) return { ok: false, erro: q.proibido, motivo: 'LACAIO_PROIBIDO' };
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
    // A gema do PoE conjura pela conta dos tempos dela (`temposDaGemaPoe`: os suportes, a velocidade por tag e a lentidão do personagem) — a
    // magia sai quando o relógio comum libera, nem antes nem depois.
    const castMs = entry.poeGema ? temposDaGemaPoe(estado, entry, efeitoDaGema).conjuracaoMs : Gemas.tempoDeConjuracao(estado, entry.id, Ficha.combate(estado).castSpeed);
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
  // (lote 72) "se você Gastou Vida Recentemente": o Custo pago em Vida (inteiro, em parte ou a Vida a mais).
  if (vidaAMais || pagaComVida || parteEmVida) ModsPoe.marcar(hunt, 'gastouVida');
  if (vidaAMais) estado.hp = Math.max(1, (estado.hp ?? 0) - vidaAMais);
  if (escudoAMais) estado.es = Math.max(0, (estado.es ?? 0) - escudoAMais);
  if (pagaComVida) estado.hp = Math.max(1, (estado.hp ?? 0) - custoDeMana);
  else if (pagaComEscudo) estado.es = Math.max(0, (estado.es ?? 0) - custoDeMana);
  else if (custoDeMana) {
    if (parteEmVida) estado.hp = Math.max(1, (estado.hp ?? 0) - parteEmVida);
    // PoE: "Gaste Escudo de Energia antes da Mana para os Custos de Habilidades Encaixadas" (a gema na peça que tem o mod).
    const doEscudo = Math.min(custoDeMana - parteEmVida, escudoNoCusto);
    if (doEscudo > 0) estado.es = Math.max(0, (estado.es ?? 0) - doEscudo);
    const manaGasta = Math.max(0, Math.min(estado.mana ?? 0, custoDeMana - parteEmVida - doEscudo));
    estado.mana = Math.max(0, (estado.mana ?? 0) - (custoDeMana - parteEmVida - doEscudo));
    // PoE: "ao Gastar Mana" — os "após Gastar um total de N de Mana" e o "por cada N de Mana total Gasta Recentemente" (`hunt.poeManaGasta`).
    if (manaGasta > 0) {
      hunt.poeManaGasta = [...(hunt.poeManaGasta ?? []).filter((x) => (hunt.clock ?? 0) - x.t <= ModsPoe.RECENTE_MS), { t: hunt.clock ?? 0, n: manaGasta }].slice(-40);
      ModsPoe.marcar(hunt, 'gastouMana');
      ModsPoe.evento(estado, hunt, 'gastarMana', Ficha.combate(estado), { personagem, quantidade: manaGasta, eventos: [] });
    }
    // PoE: "X% de chance de, quando pagar o Custo de uma Habilidade, ganhar a mesma quantidade de Mana".
    if (Math.random() * 100 < ModsPoe.valor(Ficha.combate(estado), 'chance_devolver_custo')) estado.mana = Math.min(estado.maxMana ?? estado.mana, estado.mana + custoDeMana);
    Treino.gastarMana(estado, custoDeMana);
    // O Ocultista (cargas do PoE): Carga de Poder a cada N de mana gasta.
    const regrasDasCargas = Ficha.combate(estado).cargas;
    if (regrasDasCargas && CargasPoe.aoGastarMana(estado, regrasDasCargas, custoDeMana).length) Ficha.invalidar(estado);
  }

  const eventos = [];
  // (PoE, 12/10) A gema de Aço gasta os Fragmentos de Aço agora (pagou o custo e vai sair): os projéteis deste uso e a Proteção de Aço.
  const doAco = plantada ? null : fragmentosNoUso(estado, hunt, entry, efeitoDaGema, agora);
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
    // (11/10: o RAIO da aura em casas, × √ do "Efeito em Área de Habilidades de Aura aumentado" de quem lança — os companheiros a esse raio
    // também a recebem: `GemasPoe.adds`.)
    // (11/10) O ESTANDARTE: plantar consome o Valor — a aura fica no chão, onde você está, maior e mais forte pelo Valor consumido
    // (`ModsPoe.plantarEstandarte`; o efeito multiplica os efeitos do nível — `fator` — e os atributos — `GemasPoe.adds`).
    const plantado = doPoe?.porValor ? ModsPoe.plantarEstandarte(estado, hunt, Ficha.combate(estado), doPoe.porValor, agora) : null;
    const raioDaAura = plantado ? raioDaAuraDe(estado, entry, (doPoe.raioM ?? 2) / 2, 1 + plantado.areaMais / 100) : doPoe?.raio ? raioDaAuraDe(estado, entry, doPoe.raio) : null;
    // (PoE, a Mobilização: "Seus Clamores não concedem Buffs ou Cargas a Você" — o Clamor provoca e Impele, mas o buff dele não fica em você;
    // "X% mais Duração dos Clamores" — a provocação dura mais.)
    const fichaDoClamor = buff.tipo === 'poe-clamor' && itensPoeLigado() ? Ficha.combate(estado) : null;
    const clamorSemBuff = !!fichaDoClamor && ModsPoe.valor(fichaDoClamor, 'clamor_sem_buff_em_voce') > 0;
    const duracaoDoClamor = doPoe ? Math.round(doPoe.dur * Math.max(0.1, 1 + (fichaDoClamor ? ModsPoe.valor(fichaDoClamor, 'clamor_duracao_mais') : 0) / 100)) : 0;
    // (lote 32, P042: o Clamor que sai sem outro Buff de Clamor ativo começa a contagem "para cada segundo que você for afetado por um Buff de Clamor")
    if (!clamorSemBuff && buff.tipo === 'poe-clamor' && !ModsPoe.sobBuffDeClamor(hunt, agora)) hunt.poeSobClamorDesde = agora;
    if (!clamorSemBuff) (hunt.buffs ??= {})[entry.id] = doPoe
      ? { ate: reserva ? Reserva.LIGADA_ATE : agora + Math.round(doPoe.dur * fatorDeDuracao(estado, entry, efeitoDaGema)), desde: agora, tipo: buff.tipo, fator: plantado ? 1 + plantado.efeitoMais / 100 : 1, ...(raioDaAura ? { raio: raioDaAura } : {}), efeitosPoe: efeitosDaMaldicao(doPoe.efeitos, efeitoDaGema, estado, entry), afPoe: doPoe.af,
        ...(plantado ? { estandarte: { x: hunt.pos.x, y: hunt.pos.y, z: hunt.z ?? 0, valor: plantado.valor, efeitoMais: plantado.efeitoMais } } : {}),
        ...(reserva ? { reserva: { recurso: reserva.recurso, ...(reserva.pct ? { pct: reserva.pct } : { fixo: reserva.fixo }), fator: reserva.fator } } : {}) }
      : { ate: agora + duracao, tipo: buff.tipo, fator, ...(buff.mult ? { mult: Reforcos.velocidadeEscalada(buff.mult, fator) } : {}) };
    if (doPoe) Ficha.invalidar(estado);
    // A parte reservada sai da mana (ou da vida) atual na hora.
    if (reserva) Reserva.cortarNoLivre(estado);
    // A provocação: os bichos por perto vêm atacar você (o grito do PoE traz o `provocar` nos efeitos do nível).
    if (buff.tipo === 'desafio') Reforcos.provocar(hunt, buff, distanciaChebyshev);
    // (lote 46) o raio do Clamor: o da gema em casas × √ da "Área de Efeito aumentada/mais" (a geral e a dos Clamores — `area_inc@clamor`)
    if (doPoe?.efeitos.some((e) => e.efeito === 'provocar')) Reforcos.provocar(hunt, { efeitos: doPoe.efeitos.map((e) => (e.efeito === 'provocar' ? { ...e, raio: raioDoClamor(estado, entry, e.raio) } : e)), dur: duracaoDoClamor }, distanciaChebyshev);
    // (lote 72, a Palavra Sagrada) "Seus clamores infligem Chama Santificada": nos inimigos no raio do Clamor.
    const doClamor = doPoe?.efeitos.find((e) => e.efeito === 'provocar');
    const afDoClamor = doClamor ? Ficha.combate(estado).afPoe : null;
    if (doClamor && ModsPoe.valor({ afPoe: afDoClamor }, 'clamor_chama_santificada') > 0) {
      const raio = raioDoClamor(estado, entry, doClamor.raio);
      for (const m of hunt.monstros ?? []) if (m.hp > 0 && !m.dummy && distanciaChebyshev(hunt.pos, m) <= raio) ModsPoe.porChamaSantificada(hunt, m, afDoClamor, hunt.clock ?? 0, { doClamor: true });
    }
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

  // (PoE, 12/10) o VÍNCULO: foca o aliado (e os a mais) e liga o buff nele (`criarVinculo`).
  if (!ataque && Vinculos.ehVinculo(entry)) eventos.push(...criarVinculo(estado, hunt, entry, action, efeitoDaGema, agora));
  if (!ataque) {
    // Cura: poção usa `heal`/`mana` ([min,max]); magia/runa de cura usa `damage`.
    // A cura da magia/runa: a MESMA conta do balão (`contaDaCura`) — base pelo level, perícia,
    // Cura de magia, supremo da gema, magic level em %, nível/raridade/qualidade da gema, Potent Healing.
    const conta = entry.heals && entry.kind !== 'item' ? contaDaCura(estado, entry, efeitoDaGema) : null;
    const hp = entry.kind === 'item' ? entry.heal : conta ? [conta.min, conta.max] : null;
    const mp = entry.kind === 'item' ? entry.mana : null;
    if (entry.efeito) eventos.push({ t: 'fx', id: entry.efeito, uid: 'player', x, y });
    // (lote 74 — dono, 17/10: "Implementar a gema") a CONVOCAR RUNAS: sai em você (sem alvo nem área); as suas Runas vêm até você e são Ativadas
    // (`convocarRunas`).
    if (Runas.ehConvocarRunas(entry) && !plantada) eventos.push(...convocarRunas(estado, hunt, personagem, efeitoDaGema, agora));
    if (hp) {
      // Poção: o número dela. Magia: × a conta, e a árvore (Graça, Fonte viva) por cima, no momento.
      const curaBruta = entry.kind === 'item' ? sortear(hp[0], hp[1]) : Arvore.aoCurarComMagia(estado, Math.round((sortear(hp[0], hp[1]) + conta.pericia) * conta.mult));
      // "Toda cura que você recebe vale X% a mais" (Shared Conservation).
      const cura = Math.round(curaBruta * (1 + Reforcos.bonus(hunt, 'curaRecebida') / 100));
      const quem = curado.estado;
      // (PoE, o Pacto Vaal de quem recebe: "Não pode Recuperar Vida fora o Dreno" — a cura não enche a vida dele.)
      if (!(itensPoeLigado() && ModsPoe.vidaSoPeloDreno(Ficha.combate(quem)?.afPoe))) quem.hp = Math.min(quem.maxHp ?? quem.hp, (quem.hp ?? 0) + cura);
      if (quem === estado) eventos.push({ t: 'heal', uid: 'player', quem: personagem?.nome, x, y, v: cura, color: '#00ff66' });
      else eventos.push({ t: 'heal', uid: `aliado:${curado.nome}`, quem: curado.nome, x: quem.hunt?.pos?.x ?? x, y: quem.hunt?.pos?.y ?? y, v: cura, color: '#00ff66' });
    }
    if (mp) {
      const cura = sortear(mp[0], mp[1]);
      estado.mana = Math.min(estado.maxMana ?? estado.mana, (estado.mana ?? 0) + cura);
      eventos.push({ t: 'heal', uid: 'player', quem: personagem?.nome, x, y, v: cura, color: '#4fc3ff' });
    }
  } else if (tipoPlantado && !plantada) {
    // (PoE, 12/10) O ARREMESSO da Armadilha/Mina: planta no lugar mirado (o alvo) e já vê as plantadas — com o alvo em cima, a Armadilha
    // ativa na hora; com inimigo perto e você parado, a Mina detona (a sequência). O resto fica plantado até ativar ou acabar a duração.
    const lugar = mira && entry.miraNoChao ? mira : alvo ? { x: alvo.x, y: alvo.y } : { x, y };
    eventos.push(...plantarArmas(estado, hunt, personagem, slot, entry, action, lugar, efeitoDaGema, agora));
  } else if (Runas.ehRuna(entry) && !plantada) {
    // (PoE, 12/10) A RUNA: conjurada no lugar mirado, vincula ao alvo e é Ativada na hora — e depois a cada N segundos, enquanto vinculada
    // (`tiqueDasRunas`).
    const lugar = mira && entry.miraNoChao ? mira : alvo ? { x: alvo.x, y: alvo.y } : { x, y };
    // (lote 74: o custo pago e em quê — a Convocar Runas cobra 20% dele no mesmo recurso)
    const custo = { valor: custoDeMana, em: pagaComVida ? 'vida' : pagaComEscudo ? 'es' : 'mana', parteEmVidaPct: !pagaComVida && !pagaComEscudo && custoDeMana > 0 ? Math.round((100 * parteEmVida) / custoDeMana) : 0 };
    eventos.push(...conjurarRuna(estado, hunt, personagem, slot, entry, action, lugar, alvo, efeitoDaGema, agora, custo));
  } else {
    if (entry.words) eventos.push({ t: 'say', uid: 'player', quem: personagem?.nome, text: entry.words, x, y, color: '#f36500' });
    // (PoE: "Velocidade do Projétil aumentada" — o projétil voa mais rápido na tela.)
    const velDoTiro = 1 + ModsPoe.valor(Ficha.combate(estado), 'projectile_speed') / 100;
    if (entry.projetil && alvo && !projeteisAleatorios()) eventos.push({ t: 'shot', id: entry.projetil, x, y, tx: alvo.x, ty: alvo.y, ...(velDoTiro !== 1 ? { vel: velDoTiro } : {}) });
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
    // (Duas armas: este uso é da mão da vez — ou das duas, na gema que as combina —, com o dano e o crítico dela: `maoDaGemaDeAtaque`.)
    // (PoE, o Mestre Destilador: as habilidades não canalizadas consomem 3 Cargas de um Frasco de Diamante / Bismuto / Ametista, se puderem —
    // e ganham o bônus de cada um — `doDestilador`.)
    // (lote 53: + o crítico por Intensidade do Modo Alfa / Nadir)
    const fichaDaGema = comCriticoDaIntensidade(doDestilador(estado, Ficha.combate(estado), entry), intensidade);
    const mao = maoDaGemaDeAtaque(entry, fichaDaGema, hunt);
    const { min, max, daPericia, mult, sobrecarga, fatorDaGema, ficha, partes, porAfeccao, ehMagia: ehMagiaDaConta, sintonia, multFisico, eficacia: eficaciaDoAdicionado } = contaDoDano(estado, entry, efeitoDaGema, mao?.ficha ?? fichaDaGema, mao?.arma ?? null, { ativada: !!gatilho && !plantada, custaVida: pagaComVida || parteEmVida > 0, maisDano: gatilho?.maisDano ?? 0 });
    // (PoE, a Impiedade: "Cada terceiro Ataque com Ataques Corpo a Corpo Suportados causa um Golpe Impiedoso" — este uso é o terceiro?)
    const impiedosoCada = Math.round(efeitoDaGema?.impiedosoCada ?? 0);
    let impiedoso = false;
    if (impiedosoCada > 0 && tagsPoeDaSkill(entry).includes('corpo')) {
      const c = (hunt.poeImpiedosos ??= {});
      c[entry.id] = (c[entry.id] ?? 0) + 1;
      impiedoso = c[entry.id] % impiedosoCada === 0;
    }
    // (o Libertar: o golpe que Ocorre Novamente por um Selo causa menos dano — `reocorrendo`; a Intensidade: mais dano em área)
    let reocorrendo = false;
    const maisDaIntensidade = intensidade > 0 && tagsPoeDaSkill(entry).includes('area') ? 1 + (intensidade * (efeitoDaGema.intensidadeMaisDanoPct ?? 0)) / 100 : 1;
    // (lote 46, o Punho de Guerra: o "mais Dano" da Pancada Maximizada — só no primeiro ataque do uso, não nas repetições)
    let noMaximizado = maximizado;
    const maisDoMaximizado = () => (noMaximizado ? Math.max(0, 1 + (efeitoDaGema.maximizadoMaisDanoPct ?? 0) / 100) : 1);
    // (PoE, 12/10, o Aço Estraçalhador da Munição) "Projéteis causam até X% mais Dano com Acertos por Fragmento de Aço consumido no início de
    // seu movimento, reduzido este bônus na medida em que viajam adiante": pela distância de você ao bicho (`Aco.fatorDoDano`).
    const fatorDoAco = (bicho) => (doAco?.d.maisDanoPct ? Aco.fatorDoDano(doAco.d, doAco.gastos, Math.max(Math.abs(bicho.x - x), Math.abs(bicho.y - y))) : 1);
    // (PoE, 11/10: "Cada quarta Habilidade de Retaliação que você usar sempre será um Golpe Crítico" — este uso é o quarto?)
    const retaliacaoCritica = !!gatilhoDaRetaliacao && ModsPoe.valor(ficha, 'retaliacao_quarta_critica') > 0 && ((hunt.retaliacaoUsos ?? 0) + 1) % 4 === 0;
    let total = 0;
    // (PoE: o dano nos monstros com "Vida Não Pode ser Drenada" — fora do dreno de vida, `Ficha.aplicarLeech`.)
    let totalSemDreno = 0;
    let totalSemDrenoEs = 0;
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
    // (o dano que veio de crítico: "X% do Dano de Golpes Críticos é Drenado como Vida" — `Ficha.aplicarLeech`)
    let danoCritico = 0;
    // (13/10, o dano FÍSICO dos acertos, depois da redução: "X% do Dano de Ataques Físicos é Drenado como Vida" — `Ficha.aplicarLeech`)
    let danoFisico = 0;
    // (a REPETIÇÃO final da magia — o Eco: "Habilidades Mágicas sempre causam Golpes Críticos na Repetição final", "…não podem causar Golpes
    // Críticos exceto na Repetição final"; sem repetição, o lançamento é o final)
    let naRepeticaoFinal = true;
    let fatorDoAtaque = 100; // 100% no ataque normal; o do 2º golpe do ataque duplo vem de `combate/limites.json`
    let danoVezesMaldicoes = 0;
    const sorteDoGolpe = {
      sempre: new Set(ModsPoe.valor(ficha, 'elemental_sortudo') > 0 ? ['fire', 'ice', 'energy'] : []),
      naoCritico: new Set(ModsPoe.valor(ficha, 'raio_nao_critico_sortudo') > 0 ? ['energy'] : []),
    };
    // (PoE, o Vínculo Ancestral: "Você não pode causar Dano com Habilidades por si só" — o acerto das gemas do personagem não fere, nem o dano
    // degenerativo delas; os totens e os lacaios, sim — eles têm o golpe deles, `cacadas.tiqueDosLacaios`.)
    const semDanoProprio = itensPoeLigado() && !!entry.poeGema && !entry.poeGema.lacaio && ModsPoe.valor(ficha, 'sem_dano_proprio') > 0;
    /*
     * (13/10) O PROJÉTIL neste acerto (`golpe`: o que `Secundarios.resolver` marcou — `atravessados`, `ricochetes`): "Projéteis causam Dano
     * aumentado em X% com Acertos e Afecções para cada Inimigo Atravessado / para cada vez que Ricochetearam" e a DISTÂNCIA até o bicho (o
     * Tiro Longo, a Animosidade Adjacente, o Tiro Distante — `ModsPoe.projetilNoAlvo`; a ficha da habilidade é montada sem alvo). O
     * "aumentado" soma aos outros aumentos do golpe (o `mult` da conta); o "mais" multiplica. (Por distância: a conta é a mesma — cache.)
     */
    const tagsDaSkill = tagsPoeDaSkill(entry);
    const deProjetil = itensPoeLigado() && tagsDaSkill.includes('projetil');
    const porDistancia = new Map();
    const fatorDoProjetil = (bicho, golpe) => {
      if (!deProjetil) return 1;
      const d = Math.max(Math.abs(bicho.x - x), Math.abs(bicho.y - y));
      if (!porDistancia.has(d)) porDistancia.set(d, ModsPoe.projetilNoAlvo(ficha, tagsDaSkill, bicho, estado));
      const noAlvo = porDistancia.get(d);
      // (lote 73, o Acompanhamento: "… aumentado em X% por cada propagação restante, até Y%" — os ricochetes que faltam; o acerto direto tem todos)
      const restantes = golpe ? golpe.restantes ?? 0 : Math.max(0, Math.round(Number(efeitoDaGema?.encadear) || 0));
      const porRestante = restantes > 0 ? Math.min(ModsPoe.valor(ficha, 'proj_inc_por_ricochete_restante_max') || Infinity, restantes * ModsPoe.valor(ficha, 'proj_inc_por_ricochete_restante')) : 0;
      const inc = noAlvo.incPct + (golpe?.atravessados ?? 0) * ModsPoe.valor(ficha, 'proj_inc_por_atravessado') + (golpe?.ricochetes ?? 0) * ModsPoe.valor(ficha, 'proj_inc_por_ricochete') + porRestante;
      return (inc && mult > 0 ? (mult + (inc / 100) * (sintonia ?? 1)) / mult : 1) * noAlvo.mais;
    };
    // (lote 33, P045 — o Impacto: "Causa até X% mais Dano Corpo a Corpo aos Inimigos, baseado na proximidade": o golpe corpo a corpo da gema,
    // alvo a alvo — a ficha da habilidade é montada sem alvo; `ModsPoe.maisPelaProximidade`, a rampa do PoB)
    const corpoDaGema = itensPoeLigado() && tagsDaSkill.includes('corpo');
    const fatorDaProximidade = (bicho) => (corpoDaGema ? ModsPoe.maisPelaProximidade(ficha, tagsDaSkill, bicho, estado) : 1);
    const acertar = (bicho, pct = 100, fonte = null, golpe = null) => {
      // O golpe da gema do PoE com MAIS DE UM elemento (ou de outro elemento que o da skill): cada parte com o "aumentado", a marca de
      // vulnerável e a resistência do elemento dela; o golpe leva o elemento da maior parte (a cor, o registro, as mecânicas do mob).
      const fator = (semDanoProprio ? 0 : 1) * (impiedoso ? 1 + (efeitoDaGema.impiedosoMaisDanoPct ?? 0) / 100 : 1) * (reocorrendo ? Math.max(0, 1 - (efeitoDaGema.selosMenosDanoPct ?? 0) / 100) : 1) * maisDaIntensidade * maisDoMaximizado() * fatorDoAco(bicho) * fatorDoProjetil(bicho, golpe) * fatorDaProximidade(bicho) * (fatorDaGema * (1 + ((porAfeccao ?? 0) * GemasPoe.afeccoesElementaisEm(bicho, agora)) / 100) * pct * fatorDoAtaque) / 10000;
      // (O dano SORTUDO do PoE — rola duas vezes e fica o maior: "Dano Elemental com Acertos é Sortudo enquanto você estiver Eletrizado" em
      // todo golpe — `sorteDoGolpe.sempre`; "Dano de Raio com Golpes Não-Críticos é Sortudo" só no não crítico — `sorteDoGolpe.naoCritico`.)
      const rolarParte = (p) => (p.min + Math.random() * (p.max - p.min) + daPericia * p.frac) * fator * p.mult * Reforcos.vulnerabilidade(bicho, p.elemento, agora);
      // (o Sabotador: "Dano com Acertos é Azarado" — rola duas vezes e fica o menor; com o Sortudo junto, os dois se anulam)
      const azarado = ModsPoe.valor(ficha, 'dano_acertos_azarado') > 0;
      // (lote 31: a Sorte e o Azar juntos se anulam — UM sorteio, como no PoE; antes, com os dois, ficava o Sortudo. Os mesmos sorteios de antes.)
      const pedacos = partes ? partes.map((p) => {
        const sempre = sorteDoGolpe.sempre.has(p.elemento);
        const soNaoCritico = !sempre && sorteDoGolpe.naoCritico.has(p.elemento);
        const r1 = rolarParte(p);
        const r2 = azarado || sempre || soNaoCritico ? rolarParte(p) : r1;
        const dano = sempre ? (azarado ? r1 : Math.max(r1, r2)) : azarado ? Math.min(r1, r2) : r1;
        if (!sempre && !soNaoCritico) return { elemento: p.elemento, dano };
        return { elemento: p.elemento, dano, naoCritico: sempre ? dano : azarado ? r1 : Math.max(r1, r2) };
      }) : null;
      // (lote 31, P043 — o Mestre do Metal: o Físico adicional pelos Empalamentos DESTE alvo entra na parte Física do golpe: a eficácia do dano
      // adicionado, o "aumentado" do Físico e os "mais" do golpe; o crítico e a defesa do alvo vêm depois, com o resto)
      const doEmpalar = pedacos ? ModsPoe.fisicoPorEmpalamento(ficha, bicho, agora) : null;
      if (doEmpalar) {
        const v = (doEmpalar[0] + Math.random() * (doEmpalar[1] - doEmpalar[0])) * (eficaciaDoAdicionado ?? 1) * fator * (multFisico ?? mult) * Reforcos.vulnerabilidade(bicho, 'physical', agora);
        const fisico = pedacos.find((p) => p.elemento === 'physical');
        if (fisico) fisico.dano += v;
        else pedacos.push({ elemento: 'physical', dano: v });
      }
      const tipo = pedacos ? pedacos.reduce((a, b) => (b.dano > a.dano ? b : a)).elemento : entry.element ?? 'physical';
      const rolagem = sorteDoGolpe.sempre.has(tipo) || sorteDoGolpe.naoCritico.has(tipo) ? [sortear(min, max), sortear(min, max)] : azarado ? [Math.min(sortear(min, max), sortear(min, max))] : [sortear(min, max)];
      const bruto = pedacos ? pedacos.reduce((t, p) => t + p.dano, 0) : ((sorteDoGolpe.sempre.has(tipo) ? Math.max(...rolagem) : rolagem[0]) + daPericia) * fator * mult * sobrecarga * Reforcos.vulnerabilidade(bicho, tipo, agora);
      const brutoNaoCritico = pedacos ? null : (Math.max(...rolagem) + daPericia) * fator * mult * sobrecarga * Reforcos.vulnerabilidade(bicho, tipo, agora);
      // Gema de DANO CONTÍNUO (Ignite, Envenom, Inflict Wound...): o dano dela é o TOTAL de um efeito ao longo do tempo (`combate/dot.mjs`),
      // não um golpe — sem acerto, sem crítico, e a resistência passa em cada pulso.
      const tipoDoDot = entry.overTime ? Dot.tipoDaFonte(entry.overTime.type) : null;
      if (tipoDoDot) {
        amaldicoouAgora(estado, hunt, bicho, ficha, agora, eventos, personagem);
        const doDot = Dot.aplicar(bicho, { tipo: tipoDoDot, total: bruto, origem: { fonte: 'gema', habilidade: entry.id } }, agora);
        if (doDot) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: doDot });
        registrarGolpe(() => ({ origem: 'gema-dot', habilidade: entry.id, alvo: bicho.name, tipo, dot: tipoDoDot, totalDoEfeito: Math.round(bruto), aplicou: !!doDot }));
        return;
      }
      // O bicho BLOQUEIA o golpe (só quem tem bloqueio configurado — `mobs/atributos.mjs`): sem dano nem estados.
      // ("Monstros não podem Bloquear seus Ataques" — as maestrias da árvore: só nos ataques.)
      // ("Chance de Inimigos Bloquearem Ataques com Espada reduzida em X%" — `inimigos_bloqueio_red@comEspada`: só nos ataques.)
      const ehAtaque = entry.poeGema ? !!entry.poeGema.ataque : true;
      if (!(ModsPoe.valor(ficha, 'inimigos_nao_bloqueiam') > 0 && ehAtaque) && AtributosDoMob.bloqueou(bicho, Math.random, ehAtaque ? Math.max(0, 1 - ModsPoe.valor(ficha, 'inimigos_bloqueio_red') / 100) : 1)) {
        eventos.push({ t: 'block', uid: bicho.uid, x: bicho.x, y: bicho.y, color: '#999999', bloqueado: true });
        return;
      }
      // (13/10, a Presa Sombria: "Projéteis que Ricochetearam ganham X% de Dano Não-Caótico como Dano de Caos extra" — pela resistência a Caos)
      const caosDoRicochete = deProjetil && golpe?.ricochetes > 0 ? ModsPoe.valor(ficha, 'proj_ricochete_caos_extra') : 0;
      const naoCaotico = caosDoRicochete > 0 ? (pedacos ? pedacos.filter((p) => p.elemento !== 'chaos').reduce((t, p) => t + p.dano, 0) : tipo !== 'chaos' ? bruto : 0) : 0;
      // (14/10, a Chama Santificada: o ATAQUE de um aliado no bicho com Chamas que não são dele ganha X% do Físico como Fogo extra — pela
      // resistência a Fogo — e as tira; quem pôs conta a remoção — `ModsPoe.consumirChamas`)
      const chamaPct = ehAtaque && itensPoeLigado() ? ModsPoe.consumirChamas(estado, bicho, ModsPoe.idDaChama(hunt), agora) : 0;
      const fisicoDaChama = chamaPct > 0 ? (pedacos ? pedacos.filter((p) => p.elemento === 'physical').reduce((t, p) => t + p.dano, 0) : tipo === 'physical' ? bruto : 0) : 0;
      const fogoDaChama = fisicoDaChama > 0 ? resistido(hunt, bicho, 'fire', (fisicoDaChama * chamaPct) / 100, ficha) : 0;
      const base = (pedacos ? Math.round(pedacos.reduce((t, p) => t + resistido(hunt, bicho, p.elemento, p.dano, ficha), 0)) : resistido(hunt, bicho, tipo, bruto, ficha)) + (naoCaotico > 0 ? resistido(hunt, bicho, 'chaos', (naoCaotico * caosDoRicochete) / 100, ficha) : 0) + fogoDaChama;
      // (a maldição amaldiçoa no acerto; "Recupera X% de Vida quando você Amaldiçoar um Inimigo sem Maldições")
      amaldicoouAgora(estado, hunt, bicho, ficha, agora, eventos, personagem);
      const sempreNaFinal = ehMagiaDaConta && naRepeticaoFinal && ModsPoe.valor(ficha, 'critico_repeticao_final') > 0;
      const semForaDaFinal = ehMagiaDaConta && !naRepeticaoFinal && ModsPoe.valor(ficha, 'sem_critico_fora_da_final') > 0;
      // (+ a quarta Retaliação: sempre crítica)
      // (a Lâmina Noturna: "+X% de Chance de Golpe Crítico enquanto Elusivo"; "Elusivo … concede +X% de Multiplicador de Golpes Críticos para
      // Habilidades Suportadas por Lâmina Noturna" — o do suporte e o da árvore)
      // (lote 33: o "Elusivo também concede +X% de Multiplicador" é do EFEITO do Elusivo — cai com ele, `ModsPoe.efeitoDoElusivo`; o "+X% de Chance
      // enquanto Elusivo" é uma condição, inteiro)
      const efeitoElusivo = hunt.poeElusivo ? ModsPoe.efeitoDoElusivo(hunt, agora) / 100 : 1;
      const fichaDoCritico = (efeitoDaGema?.critElusivo || efeitoDaGema?.critMultElusivo) && ModsPoe.buffAtivo(estado, 'elusivo')
        ? { ...ficha, critChance: Math.min(1, (ficha.critChance ?? 0) + (efeitoDaGema.critElusivo ?? 0) / 100), critMultiplier: (ficha.critMultiplier ?? 1.5) + (((efeitoDaGema.critMultElusivo ?? 0) + ModsPoe.valor(ficha, 'lamina_crit_mult_elusivo')) * efeitoElusivo) / 100 }
        : ficha;
      const rolado = Ficha.rolarCritico(estado, base, bicho, eventos, sempreNaFinal || retaliacaoCritica ? { ...fichaDoCritico, critChance: 1, critChanceMagia: 1 } : semForaDaFinal ? { ...fichaDoCritico, critChance: 0 } : fichaDoCritico);
      // PoE: "Golpes Críticos de Ataques ignoram a Resistência Elemental dos Monstros" — no crítico, a parte elemental sem a resistência positiva.
      if (rolado.crit && base > 0 && ModsPoe.valor(ficha, 'critico_ignora_res') > 0) {
        const semRes = pedacos ? pedacos.reduce((t, p) => t + (['fire', 'ice', 'energy'].includes(p.elemento) ? Math.max(p.dano, resistido(hunt, bicho, p.elemento, p.dano, ficha)) : resistido(hunt, bicho, p.elemento, p.dano, ficha)), 0) : (['fire', 'ice', 'energy'].includes(tipo) ? Math.max(bruto, base) : base);
        rolado.dano = Math.round((rolado.dano * semRes) / base);
      }
      // (o Inquisidor: "Acertos Não Críticos penetram X% das Resistências Elementais do Inimigo" — o golpe não crítico, na proporção da parte
      // elemental com a penetração a mais)
      // (lote 55, o Olho do Vigia: + "Acertos Críticos Penetram X% da Resistência Elemental Inimiga" — o golpe crítico, `pen_critico`)
      const penNaoCritico = ModsPoe.valor(ficha, rolado.crit ? 'pen_critico' : 'pen_nao_critico');
      if (base > 0 && penNaoCritico > 0) {
        const comPen = { ...ficha, penetracao: { ...(ficha.penetracao ?? {}), elemental: (Number(ficha.penetracao?.elemental) || 0) + penNaoCritico } };
        const comMais = pedacos ? pedacos.reduce((t, p) => t + resistido(hunt, bicho, p.elemento, p.dano, ['fire', 'ice', 'energy'].includes(p.elemento) ? comPen : ficha), 0) : resistido(hunt, bicho, tipo, bruto, ['fire', 'ice', 'energy'].includes(tipo) ? comPen : ficha);
        if (comMais > base) rolado.dano = Math.round((rolado.dano * comMais) / base);
      }
      // (o golpe NÃO crítico com a parte de Raio sortuda: o mesmo golpe, na proporção do dano rolado duas vezes)
      if (!rolado.crit && base > 0 && (pedacos ? pedacos.some((p) => p.naoCritico != null && sorteDoGolpe.naoCritico.has(p.elemento)) : sorteDoGolpe.naoCritico.has(tipo))) {
        const sortudo = pedacos ? Math.round(pedacos.reduce((t, p) => t + resistido(hunt, bicho, p.elemento, sorteDoGolpe.naoCritico.has(p.elemento) ? p.naoCritico ?? p.dano : p.dano, ficha), 0)) : resistido(hunt, bicho, tipo, brutoNaoCritico, ficha);
        if (sortudo > base) rolado.dano = Math.round((rolado.dano * sortudo) / base);
      }
      const { dano, crit, onslaught, chance } = rolado;
      if (crit) { houveCritico = true; danoCritico += dano; }
      // (os suportes no acerto: a Crueldade — "Acertos de Habilidades Suportadas concedem Crueldade"; a Lâmina Noturna — "concedem Elusivo no
      // Golpe Crítico"; o Golpe Impiedoso — o atordoamento base dele e, da árvore, "Acertos Impiedosos Intimidam Inimigos por N segundos")
      const doSuporte = dano > 0 ? efeitosDosSuportesNoAcerto(estado, hunt, bicho, ficha, efeitoDaGema, { crit, impiedoso, agora, eventos }) : null;
      // (o Assassino — Mortífero: o crítico de ataque num Raro/Único sem Marca nenhuma ativa a Marca do Assassino)
      if (crit && entry.poeGema?.ataque) marcaDoAssassino(estado, hunt, bicho, ficha, agora);
      bicho.hp -= dano;
      // (lote 31, S001/P025: o acerto é seu — as tags do golpe, para o "ao Matar Corpo a Corpo")
      QuemFeriu.carimbar(bicho, QuemFeriu.VOCE, ficha.tagsDoGolpe ?? tagsPoeDaSkill(entry));
      ModsPoe.poupar(ficha, hunt, bicho, { agora });
      // ("X% do Dano Mágico é Drenado como Escudo de Energia para cada Maldição no Inimigo": o dano × as maldições do alvo.)
      if (dano > 0 && ehMagiaDaConta) danoVezesMaldicoes += dano * ModsPoe.maldicoesNoAlvo(bicho, agora);
      // O registro do golpe (desligado em produção: nem monta o objeto).
      registrarGolpe(() => ({
        origem: 'gema', habilidade: entry.id, alvo: bicho.name, tipo, danoAntesDaResistencia: Math.round(bruto), resistenciaDoAlvo: resistenciaDe(hunt, bicho, tipo),
        penetracao: Limites.penetracaoDe(ficha.penetracao, tipo), resistenciaEfetiva: resistenciaEfetivaDe(hunt, bicho, tipo, ficha), danoAposResistencia: base,
        chanceCritica: chance, critico: crit, danoFinal: dano, vidaRestante: Math.max(0, bicho.hp),
        detalhe: { min, max, daPericia, multiplicador: mult, fatorDaGema, porcentagemDoGolpe: pct, fatorDoAtaque, ataqueDuplo: fatorDoAtaque !== 100, ...(pedacos ? { porElemento: Object.fromEntries(pedacos.map((p) => [p.elemento, Math.round(p.dano)])) } : {}) },
      }));
      total += dano;
      if (bicho.semDreno) totalSemDreno += dano;
      if (Mecanicas.semDrenoDeEs(bicho)) totalSemDrenoEs += dano;
      danos.push({ bicho, dano });
      // As mecânicas do mob que reagem ao dano (Endurecido, Espelhado — `mobs/mecanicas.mjs`); os espinhos do Raro do mapa só no corpo a corpo.
      Mecanicas.aoReceberDano(estado, hunt, personagem, bicho, dano, tipo, eventos, { corpoACorpo: Tags.tagsDaAcao(entry).includes('melee') });
      // `fonte`: de que efeito veio (explosão, perfuração, bifurcação, encadeamento, retorno, projétil extra).
      // (A gema só de dano degenerativo — Flecha Cáustica, Contagiar… — não mostra um "0": o dano dela vem nos pulsos.)
      if (dano > 0 || !(entry.poeGema && GemasPoe.degenerativoNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1))) {
        eventos.push({ t: 'dmg', uid: bicho.uid, x: bicho.x, y: bicho.y, v: dano, foe: true, crit, onslaught, spell: entry.name, alvo: bicho.name, color: pedacos ? COR_DO_ELEMENTO[tipo] ?? cor : cor, ...(fonte ? { fonte } : {}) });
      }
      // Os estados das supports (Ignite, Freeze, Slow, Stun) no bicho atingido.
      // (PoE, 14/10: a chance de Congelar dos suportes — "têm X% de chance de Congelar" — vai para a conta do PoE, nas afecções abaixo: a
      // duração pelo dano de Gelo; o resto dos estados do suporte segue aqui.)
      const congelarDoSuporte = ficha.afeccoes && efeitoDaGema?.congelarChance > 0 ? efeitoDaGema.congelarChance : 0;
      const postosDaGema = Estados.aplicar(bicho, congelarDoSuporte ? { ...efeitoDaGema, congelarChance: 0 } : efeitoDaGema, dano, agora, Math.random, !!hunt.isBoss, bruto);
      for (const st of postosDaGema) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: st });
      // Os efeitos de acerto do PoE (atordoamento, Mutilar, Cegar, Desacelerar, Empalar, Empurrar, Provocar, Fúria — `itens-poe/mods-poe.mjs`).
      const fisicoDoAcerto = pedacos ? pedacos.filter((p) => p.elemento === 'physical').reduce((t, p) => t + p.dano, 0) : tipo === 'physical' ? bruto : 0;
      if (fisicoDoAcerto > 0 && base > 0) danoFisico += dano * Math.min(1, resistido(hunt, bicho, 'physical', fisicoDoAcerto, ficha) / base);
      // (a gema do PoE soma as chances dela que não são afecção — o empalamento — `GemasPoe.fichaComAsChancesDaGema`)
      const fichaDoAcerto = entry.poeGema ? GemasPoe.fichaComAsChancesDaGema(ficha, entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : ficha;
      // (lote 31, P034: a parte de Fogo do acerto, na proporção do dano final — como o físico acima; + o Fogo da Chama Santificada)
      const fogoBruto = pedacos ? pedacos.filter((p) => p.elemento === 'fire').reduce((t, p) => t + p.dano, 0) : tipo === 'fire' ? bruto : 0;
      const fogoDoAcerto = base > 0 && (fogoBruto > 0 || fogoDaChama > 0) ? dano * Math.min(1, ((fogoBruto > 0 ? resistido(hunt, bicho, 'fire', fogoBruto, ficha) : 0) + fogoDaChama) / base) : 0;
      const doAcerto = ModsPoe.aoAcertar(estado, hunt, bicho, fichaDoAcerto, { dano, fisico: fisicoDoAcerto, fogo: fogoDoAcerto, crit, eventos, agora, personagem, mover: (b) => ModsPoe.empurrar(hunt, b), elementos: pedacos ? pedacos.map((p) => p.elemento) : [tipo], habilidade: entry.id });
      // O suporte Fúria: "Ganhe 3 de Fúria no Acerto com Ataques" (cada acerto do ataque suportado, como o "Fúria com Acertos" das peças).
      if (efeitoDaGema?.furiaNoAcerto > 0 && entry.poeGema?.ataque) ModsPoe.ganharFuria(hunt, efeitoDaGema.furiaNoAcerto, agora);
      // As afecções do PoE (só com ITENS_POE=1): o acerto entra com o elemento da skill; habilidade de ataque (golpe físico de perto/longe) é ataque.
      // As cargas do PoE no acerto da skill (crítico, não crítico, atordoou, Inimigo Único).
      // ("Acertos Corpo a Corpo contam como Mortes com Fúria" — o Rampage.)
      if (ModsPoe.valor(ficha, 'rampage_acerto_corpo') > 0 && Tags.tagsDaAcao(entry).includes('melee') && ModsPoe.contarRampage(estado, hunt, ficha, agora)) Ficha.invalidar(estado);
      if (CargasPoe.reageAoAcerto(ficha.cargas)) {
        const corpoACorpo = Tags.tagsDaAcao(entry).includes('melee');
        if (CargasPoe.aoAcertar(estado, ficha.cargas, bicho, { crit, corpoACorpo, atordoou: postosDaGema.includes('atordoado') || doAcerto.atordoou }).length) Ficha.invalidar(estado);
      }
      // (09/10) O DANO DEGENERATIVO da gema do PoE no alvo acertado: dano por segundo × a duração da habilidade, com o Multiplicador de Dano
      // Degenerativo (o geral e o do elemento), o "Dano Degenerativo aumentado", o aumentado do elemento e os suportes da gema (`fatorDaGema`).
      // A resistência do alvo vale em cada pulso; não rola crítico. Uma instância por gema: a mesma habilidade não acumula com ela mesma.
      // (O Vínculo Ancestral: sem dano por si só — `semDanoProprio`.)
      if (entry.poeGema && !semDanoProprio) {
        const dg = GemasPoe.degenerativoNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1);
        const a = ficha.afeccoes ?? AfeccoesPoe.daSoma(ficha.afPoe ?? {});
        const MULTI = { fire: a.multiplicadorFogo, ice: a.multiplicadorGelo, energy: a.multiplicadorRaio, chaos: a.multiplicadorCaos, physical: a.multiplicadorFisico };
        for (const p of dg?.partes ?? []) {
          const tipoDegen = GemasPoe.DEGEN_DO_ELEMENTO[p.elemento];
          // (lote 65: + o "Dano Degenerativo aumentado" do elemento — "Dano de Caos Degenerativo aumentado")
          const total = p.dps * (dg.duracaoMs / 1000) * fatorDaGema * (1 + ((a.multiplicador ?? 0) + (MULTI[p.elemento] ?? 0)) / 100) * (1 + ((a.danoAumentado ?? 0) + (ficha.danoDoElemento?.[p.elemento] ?? 0) + (a.danoDegenDoElemento?.[p.elemento] ?? 0)) / 100) * Math.max(0, 1 + (a.dotMais ?? 0) / 100);
          const posto = Dot.aplicar(bicho, { tipo: tipoDegen, total, duracaoMs: dg.duracaoMs, chave: entry.poeGema.slug, origem: { fonte: 'gema', habilidade: entry.id } }, agora);
          if (posto) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: posto });
        }
      }
      if (ficha.afeccoes) {
        const tagsDoAcerto = Tags.tagsDaAcao(entry);
        const ataque = entry.poeGema ? !!entry.poeGema.ataque : tagsDoAcerto.includes('physical') && (tagsDoAcerto.includes('melee') || tagsDoAcerto.includes('ranged'));
        // A gema do PoE soma as chances dela (incendiar, congelar, eletrizar, envenenar, sangrar) no nível em que está.
        const afeccoes = entry.poeGema ? GemasPoe.afeccoesComAGema(ficha.afeccoes, entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : ficha.afeccoes;
        // (o Golpe Impiedoso: "X% mais Dano com Afecções causadas por Acertos Corpo a Corpo")
        const maisNaAfeccao = impiedoso ? 1 + (efeitoDaGema.impiedosoMaisAfeccaoPct ?? 0) / 100 : 1;
        const partesDaAfeccao = (pedacos ?? [{ elemento: tipo, dano: bruto }]).map((p) => (maisNaAfeccao !== 1 ? { ...p, dano: p.dano * maisNaAfeccao } : p));
        // (PoE, a Força Concussiva: "Incêndios de Acertos Corpo a Corpo Atordoantes causam X% mais Dano" — o acerto corpo a corpo que atordoou: pelo
        // suporte, pelo Golpe Impiedoso ou pelo atordoamento do PoE)
        const atordoouAgora = postosDaGema.includes('atordoado') || !!doAcerto?.atordoou || !!doSuporte?.atordoou;
        const incendioAtordoante = atordoouAgora && tagsPoeDaSkill(entry).includes('corpo') ? ModsPoe.valor(ficha, 'incendio_atordoante_mais') : 0;
        const comIncendio = incendioAtordoante ? { ...afeccoes, incendioMais: (afeccoes.incendioMais ?? 0) + incendioAtordoante } : afeccoes;
        const afeccoesDoAcerto = congelarDoSuporte ? { ...comIncendio, chance: { ...(comIncendio.chance ?? {}), congelamento: (comIncendio.chance?.congelamento ?? 0) + congelarDoSuporte } } : comIncendio;
        // (a Sobrecarga Elemental: "Afecções nunca contam como sendo de um Golpe Crítico")
        const postos = AfeccoesPoe.aoAcertar(bicho, partesDaAfeccao, { afeccoes: afeccoesDoAcerto, praga: pragaDoAcerto(hunt), crit: crit && !ficha.sobrecargaElemental, ataque, agora, salaDeBoss: !!hunt.isBoss, aoPor: ModsPoe.refletorDeAfeccoes(hunt, ficha) });
        for (const st of postos) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: st });
        // (14/10, o Avatar da Selva: a Fúria Liberta pelas Afecções Elementais que o acerto pôs)
        ModsPoe.ganharFuriaLiberta(estado, hunt, ficha.afPoe, postos, agora);
        ModsPoe.aoPorAfeccoes(estado, hunt, bicho, ficha, postos, { eventos, personagem });
        // (lote 73, a Cutilada Perigosa: o Sangramento das afecções do PoE ou o da gema de suporte — `postosDaGema`)
        ModsPoe.empalamentoComSangramento(bicho, ficha, postos.includes('sangrando') || postosDaGema.includes('sangrando'));
      }
    };
    /*
     * ---- O ATAQUE (o golpe principal + os secundários das supports) e o ATAQUE DUPLO ----
     * `segundo`: o ataque EXTRA (chance `ficha.ataqueDuplo`, no máximo UM por uso — ele nunca rola o duplo de novo). Repete o ataque inteiro, com
     * a precisão, o crítico, a resistência e os estados de cada alvo, mas não gasta mana nem recarga, e o roubo de vida/mana e as habilidades da
     * árvore (depois da magia) contam só do primeiro.
     */
    const propagaGolpe = ModsPoe.valor(ficha, 'golpe_corpo_propaga') > 0 && tagsPoeDaSkill(entry).includes('golpe') && tagsPoeDaSkill(entry).includes('corpo');
    // (lote 46, o Propagar Dano — Melee Splash: "Habilidades Suportadas Propagam Dano aos alvos próximos", com "X% menos Dano Propagado" e "X% mais
    // Efeito em Área da Propagação de Dano") a Habilidade de Golpe corpo a corpo propaga em volta de cada atingido: 1 casa (o raio do Dano
    // Propagado — a decisão do dono do lote 34) × √ da área da Propagação e da habilidade (a fração, a chance de uma casa a mais).
    const propagaDoSuporte = (efeitoDaGema?.propagar ?? 0) > 0 && tagsPoeDaSkill(entry).includes('golpe') && tagsPoeDaSkill(entry).includes('corpo');
    // (lote 41, P047 — a Fúria Ancestral: "Habilidades de Golpe também miram no local anterior que foram Usadas") a Habilidade de Golpe acerta
    // também quem está no local do uso anterior dela (a casa do alvo de antes, `hunt.golpeAnterior` — o mais perto de lá, a até 1 casa).
    const ehGolpe = !!entry.poeGema && tagsPoeDaSkill(entry).includes('golpe');
    const localAnterior = ehGolpe && ModsPoe.valor(ficha, 'golpe_local_anterior') > 0 && hunt.golpeAnterior && (hunt.golpeAnterior.z ?? 0) === (hunt.z ?? 0) ? hunt.golpeAnterior : null;
    const atacar = (segundo) => {
      // "X% mais Dano por cada Ricochete restante" (Arco): o 1º atingido tem todos os ricochetes pela frente; cada salto gasta um.
      const cp = efeitoDaGema?.cadeiaPoe;
      if (!projeteisAleatorios()) atingidos.forEach((bicho, i) => { if (!segundo || bicho.hp > 0) acertar(bicho, cp?.pct ? 100 * (1 + (cp.pct * Math.max(0, cp.saltos - i)) / 100) : 100); });
      // (PoE, a Fúria Tribal: "Habilidades de Golpe Corpo a Corpo causam Dano Propagado aos alvos ao redor" — os vivos a 1 casa de cada atingido.)
      if (propagaGolpe || propagaDoSuporte) {
        const ja = new Set(atingidos);
        const pct = propagaDoSuporte ? Math.max(0, 100 + (efeitoDaGema.propagaMaisPct ?? 0)) : 100;
        const raio = propagaDoSuporte ? 1 + ModsPoe.casasPelaArea(1, ModsPoe.fatorDaArea(efeitoDaGema.areaIncPct ?? 0, efeitoDaGema.areaMaisPct ?? 0, efeitoDaGema.propagaAreaMaisPct ?? 0)) : 1;
        for (const b of atingidos) for (const m of vivos) if (m.hp > 0 && !ja.has(m) && Math.max(Math.abs(m.x - b.x), Math.abs(m.y - b.y)) <= raio) { ja.add(m); acertar(m, pct, 'propagado'); }
      }
      if (localAnterior && !segundo) {
        const ja = new Set(atingidos);
        const longe = (m) => Math.max(Math.abs(m.x - localAnterior.x), Math.abs(m.y - localAnterior.y));
        const la = vivos.filter((m) => m.hp > 0 && !ja.has(m) && longe(m) <= 1).sort((a, b) => longe(a) - longe(b))[0];
        if (la) acertar(la, 100, 'localAnterior');
      }
      /*
       * ---- Os golpes SECUNDÁRIOS das supports, combinados em cadeia ----
       * Quem leva, com quantos %, de onde e de que tipo vem de `Secundarios.resolver`
       * (projéteis extras, perfuração, bifurcação, encadeamento, retorno — e a explosão
       * em CADA impacto, 3×3 em volta dele). Aqui só se aplica, um acerto por vez, na
       * ordem: quem morreu no meio do caminho não leva o resto.
       */
      const { golpes, explosoes, emitidos } = Secundarios.resolver({
        efeito: efeitoDaGema,
        tags: Tags.tagsDaAcao(entry),
        origem: { x, y },
        alvo: casas ? null : alvo,
        atingidos,
        vivos,
        alcance: entry.range || ALCANCE_PADRAO,
        area: !!casas,
        // (lote 42, P053: o terreno do andar — o projétil que erra pode bater nele e ricochetear)
        andavel: ModsPoe.gradeDoCombate(hunt)?.andavel ?? null,
      });
      // A EMISSÃO na tela: cada projétil do total da skill sai de quem lança (o principal já saiu, acima) — o que acerta e o que erra,
      // mesmo que o bicho dele morra antes. (Nas direções aleatórias, todos — o principal não saiu no alvo.)
      if (entry.projetil) for (const p of emitidos.slice(alvo && !casas && !projeteisAleatorios() ? 1 : 0)) eventos.push({ t: 'shot', id: entry.projetil, x: p.de.x, y: p.de.y, tx: p.para.x, ty: p.para.y });
      // A explosão na tela: UM evento por detonação (o cliente desenha o quadrado inteiro).
      for (const ex of explosoes) eventos.push({ t: 'explosao', id: entry.efeito || EFEITO_DA_EXPLOSAO, x: ex.x, y: ex.y, lado: ex.lado });
      for (const s of golpes) {
        if (s.bicho.hp <= 0) continue;
        // (o 1º voo de cada projétil já foi desenhado na emissão; aqui, os saltos: perfuração, bifurcação, encadeamento, retorno)
        if (s.tipo !== 'explosao' && s.tipo !== 'projetil' && entry.projetil) eventos.push({ t: 'shot', id: entry.projetil, x: s.de.x, y: s.de.y, tx: s.bicho.x, ty: s.bicho.y });
        acertar(s.bicho, s.pct, s.tipo, s);
      }
    };
    // (+ "Ataques executados por você se repetem mais N vezes": os ataques usados pelo personagem — não os ativados por gatilho.)
    // (+ 14/10, o Altar Ecoante: "Habilidades se Repetem 1 Vezes mais" — todas as usadas, não as ativadas por gatilho)
    const repeticoes = Math.min(3, (efeitoDaGema?.repeticoes ?? 0) + (entry.poeGema?.ataque && !gatilho ? ModsPoe.valor(ficha, 'repeticoes_ataque_proprio') : 0) + (!gatilho ? ModsPoe.valor(ficha, 'repeticoes_extra') : 0));
    naRepeticaoFinal = repeticoes === 0;
    atacar(false);
    // (lote 46, o Punho de Guerra: a Maximização vale só neste primeiro ataque — a próxima, daqui a N s)
    if (maximizado) { noMaximizado = false; (hunt.poeMaximizadoAte ??= {})[entry.id] = (hunt.clock ?? 0) + efeitoDaGema.maximizadoMs; }
    // REPETIÇÕES dos suportes do PoE (Eco de Magia, Golpe Múltiplo): a skill sai de novo na hora, nos vivos (sem gastar de novo).
    for (let r = 0; r < repeticoes; r++) {
      if (!atingidos.some((b) => b.hp > 0)) break;
      naRepeticaoFinal = r === repeticoes - 1;
      // (PoE: "Repetição Final das Magias têm Efeito em Área aumentado em X%" — lote 36, P002: o X soma no "aumentado" da área da última
      // repetição, e o raio da forma cresce × √ como o resto da área.)
      const areaFinal = naRepeticaoFinal && areaNoUso && ehMagiaDaConta ? ModsPoe.valor(ficha, 'repeticao_final_area') : 0;
      // (lote 46: a repetição não é Maximizada — sem a área dos Impactos Maximizados)
      const semMaximizado = maximizado && areaNoUso ? efeitoDaGema.maximizadoAreaIncPct ?? 0 : 0;
      if (areaFinal > 0 || semMaximizado > 0) atingidos = Areas.dentro(areaNoUso(areaFinal - semMaximizado), vivos.filter((b) => b.hp > 0));
      atacar(true);
    }
    // (PoE, o Libertar: "Magias Suportadas são Liberadas quando conjuradas, e seus efeitos Ocorrem Novamente para cada Selo perdido" — os Selos
    // juntados desde a última conjuração, com menos dano: `selosAgora`.)
    // (lote 73, o Cersidor de Selos: "Habilidades Suportadas por Liberar têm frequência de ganho de Selo aumentada em X%")
    const selos = efeitoDaGema?.seloIntervaloMs > 0 ? selosAgora(hunt, entry.id, efeitoDaGema, ModsPoe.valor(ficha, 'selos_max_extra'), hunt.clock ?? 0, ModsPoe.valor(ficha, 'selo_frequencia_inc')) : 0;
    for (let r = 0; r < selos; r++) {
      if (!atingidos.some((b) => b.hp > 0)) break;
      reocorrendo = true;
      atacar(true);
    }
    reocorrendo = false;
    if (efeitoDaGema?.intensidadeMax > 0) ganharIntensidade(hunt, entry.id, efeitoDaGema, ModsPoe.valor(ficha, 'intensidade_max_extra'), hunt.clock ?? 0, ficha.afPoe);
    const totalDoPrimeiro = total;
    const criticoDoPrimeiro = danoCritico;
    const fisicoDoPrimeiro = danoFisico;
    const danosDoPrimeiro = danos.slice();
    if (Math.random() < (ficha.ataqueDuplo ?? 0)) {
      fatorDoAtaque = Limites.LIMITES.ataqueDuplo.danoDoSegundoGolpePct;
      atacar(true);
      fatorDoAtaque = 100;
      total = totalDoPrimeiro;
      danoCritico = criticoDoPrimeiro;
      danoFisico = fisicoDoPrimeiro;
      danos.length = 0;
      danos.push(...danosDoPrimeiro);
    }
    // Cataclismo, Arco voltaico, Inverno sem fim, Raiz venenosa (ver `Arvore.depoisDaMagia`).
    if (entry.kind === 'spell') total += Arvore.depoisDaMagia(estado, hunt, entry.element, danos, eventos, cor);
    // (lote 41, P047) o local deste uso da Habilidade de Golpe: o próximo uso mira aqui também.
    if (ehGolpe && atingidos[0]) hunt.golpeAnterior = { x: atingidos[0].x, y: atingidos[0].y, z: hunt.z ?? 0 };
    // (lote 41, P032) a ÁREA FRIA das gemas do PoE que a criam (o Solo Gelado do Piscar Gélido, a área da Geada Rastejante e do Golpe Frio, o
    // Vórtice): no chão — no alvo, ou onde a forma caiu —, pela duração da gema (`ModsPoe.criarAreaFria`).
    const fria = entry.poeGema ? ModsPoe.AREAS_FRIAS.porGema[entry.poeGema.slug] : null;
    if (fria) {
      const c = fria.noAlvo && alvo ? alvo : formaNoUso ?? hunt.pos;
      const segundos = (GemasPoe.compilada(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1)?.stats?.duracao ?? 4) * fatorDeDuracao(estado, entry, efeitoDaGema);
      ModsPoe.criarAreaFria(hunt, { x: c.x, y: c.y, raioM: fria.raioM, segundos });
    }
    // (No PoE as magias não roubam: só os ataques — `Ficha.aplicarLeech`.)
    Ficha.aplicarLeech(estado, total, eventos, personagem?.nome, { x, y }, ficha, null, { ataque: !ehMagiaDaConta, danoCritico, danoFisico, danoVezesMaldicoes, semDrenoDeVida: Math.min(total, totalSemDreno), semDrenoDeEs: Math.min(total, totalSemDrenoEs) });
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
      // (14/10, o Feiticeiro: "quando você disparar projéteis de um Ataque de Varinha não Ativado")
      if (ehAtaqueDeVarinha(estado, entry)) ativarGatilhos(estado, hunt, personagem, 'ataqueDeVarinha', { acao: entry.id, alvo: vivoAinda ?? alvo }, eventos);
      const corpoACorpo = Gemas.defDaGema(Gemas.ITEM_DA_ACAO.get(entry.id))?.tags?.includes('poe:Corpo a Corpo');
      if (corpoACorpo && atingidos.some((b) => b.hp <= 0)) ativarGatilhos(estado, hunt, personagem, 'abate', { acao: entry.id, alvo: vivoAinda }, eventos);
      // (14/10, a Rajada Vulcânica: "ao atingir corpo a corpo")
      if (corpoACorpo && atingidos.length) rajadaVulcanica(estado, hunt, atingidos[0], eventos);
    }
    // (14/10, o Convocar Fantasma: o golpe fatal e o acerto no Raro/Único das habilidades suportadas)
    if (efeitoDaGema && atingidos.length) convocarFantasmas(estado, hunt, efeitoDaGema, atingidos);
  }

  // Gemas: "-Ns recarga de <magia>" (supremo), sem passar de zero.
  // "Cooldown Recovery" (add): a recarga própria anda mais rápido.
  const fichaDaRecarga = Ficha.combate(estado);
  // + o Cooldown Recovery da gema (support).
  const tempoPoe = entry.poeGema ? temposDaGemaPoe(estado, entry, efeitoDaGema, fichaDaRecarga) : null;
  const recarga = tempoPoe ? tempoPoe.recarga : Math.max(0, Math.round(((recargaDe(entry, entry.cooldown ?? 1000) - (fichaDaRecarga.magiasDasGemas?.[action.id]?.recargaMs ?? 0)) / (1 + (fichaDaRecarga.recuperacaoDeRecarga ?? 0) / 100)) * (1 + (efeitoDaGema?.recargaPct ?? 0) / 100)));
  // Tudo a partir do instante LÓGICO (`inicio`), não do tique em que saiu. (A Armadilha/Mina plantada que ativa não mexe na recarga: ela
  // foi do arremesso.)
  // (lote 51, o Reino de Atziri — dono, 16/10: "Traduzir para a recarga": as Almas Vaal do PoE são a recarga das Vaal no jogo) "Habilidades
  // Vaal tem X% de chance de ganharem as Almas consumidas novamente quando usadas" = a Vaal usada não entra em recarga, na chance.
  const vaalDeGraca = !plantada && recarga > 0 && entry.poeGema && tagsPoeDaSkill(entry).includes('vaal') && Math.random() * 100 < ModsPoe.valor(fichaDaRecarga, 'vaal_almas_de_volta_chance');
  if (!plantada && !vaalDeGraca) cds[action.id] = { ate: inicio + recarga, total: recarga };
  // (14/10, o Coveiro) Profanar e Desenterrar criam os cadáveres deles no alvo (`criarCadaveres`).
  if (entry.poeGema && GemasPoe.cadaveresDaGema(entry.poeGema.slug, 1)) criarCadaveres(estado, hunt, entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, alvo ?? hunt.pos);
  // PoE: os eventos "ao usar uma Habilidade" dos únicos (e os "recentemente": usou Movimento, Vaal, Clamor) — a ativada por gatilho não conta.
  if (!gatilho && entry.poeGema) {
    const tagsPoe = tagsPoeDaSkill(entry);
    const fichaDoUso = Ficha.combate(estado);
    ModsPoe.marcar(hunt, 'usouHabilidade');
    // (o Deadeye: "Ganha 1 de Força dos Ventos ao usar uma Habilidade")
    ModsPoe.ganharForcaDosVentos(hunt, fichaDoUso, hunt.clock ?? 0);
    // (ciclo 7) O uso por TAG — "se você usou uma Habilidade de Retaliação Recentemente", "conjurou uma Magia de Runa/Marca Recentemente" — e
    // QUAIS gemas de cada tag ("por cada Habilidade de Retaliação diferente que você tenha usado nos últimos N segundos").
    ModsPoe.marcarUsoPorTag(hunt, tagsPoe, entry.poeGema.slug, inicio);
    // (lote 55, o Equilíbrio do Terror: "se você conjurou <Maldição> nos últimos 10 segundos" — `nosUltimos:10:usou:gema:<nome>`)
    ModsPoe.marcar(hunt, `usou:gema:${ModsPoe.slugDoNome(GemasPoe.doSlug(entry.poeGema.slug)?.gema?.nome ?? entry.poeGema.slug)}`, inicio);
    // (a Retaliação usada: gasta o uso na janela — `ModsPoe.usarRetaliacao`)
    if (gatilhoDaRetaliacao) ModsPoe.usarRetaliacao(hunt, gatilhoDaRetaliacao, entry.poeGema.slug, fichaDoUso.afPoe, hunt.clock ?? 0);
    // ("X% de chance de abrir Baús próximos quando você Conjurar uma Magia" — `abrirBausAoConjurar`)
    if (tagsPoe.includes('magia')) abrirBausAoConjurar(estado, hunt, personagem, ModsPoe.valor(fichaDoUso, 'abrir_bau_ao_conjurar'));
    // (ciclo 7, lote G) IMPELIR: o Clamor Impele os próximos N ataques (os da gema, + "Clamores Impelem 1 Ataque adicional", "têm X% de chance
    // de Impelir N Ataques adicionais", "Impelem duas vezes mais Ataques"); o ataque usado gasta um (a tag `impelido` do golpe).
    if (tagsPoe.includes('clamor')) {
      let n = GemasPoe.impelidosDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1);
      if (n > 0) {
        n += ModsPoe.valor(fichaDoUso, 'clamor_impele_extra');
        for (const [k, x] of Object.entries(fichaDoUso.afPoe ?? {})) if (k.startsWith('clamor_impele_chance:') && Math.random() * 100 < x) n += Number(k.slice('clamor_impele_chance:'.length)) || 0;
        if (ModsPoe.valor(fichaDoUso, 'clamor_impele_dobro') > 0) n *= 2;
        hunt.impelidos = { n: Math.max(hunt.impelidos?.ate > inicio ? hunt.impelidos.n : 0, n), ate: inicio + 20000 };
      }
    } else if (tagsPoe.includes('ataque') && hunt.impelidos?.n > 0 && !(tagsPoe.includes('movimento') && ModsPoe.valor(fichaDoUso, 'clamor_nao_impele_movimento') > 0)) hunt.impelidos.n--;
    const ctxDoUso = { alvo, eventos, personagem, tags: tagsPoe };
    ModsPoe.evento(estado, hunt, 'usarHabilidade', fichaDoUso, ctxDoUso);
    ModsPoe.evento(estado, hunt, tagsPoe.includes('ataque') ? 'usarAtaque' : 'usarMagia', fichaDoUso, ctxDoUso);
    // ("se você usou uma Habilidade de Fogo Recentemente"; "por cada Magia Não Instantânea que você tenha Conjurado Recentemente".)
    if (tagsPoe.includes('fogo')) ModsPoe.marcar(hunt, 'usouFogo');
    // (14/10, a Infusão Espiritual: "enquanto canaliza uma magia" — `ModsPoe.tiqueDaInfusao`)
    if (tagsPoe.includes('canalizar') && tagsPoe.includes('magia')) ModsPoe.marcar(hunt, 'canalizouMagia');
    // (lote 42, P074) a CANALIZAÇÃO CONTÍNUA: a mesma habilidade de Canalização usada de novo em seguida continua o canalizar (até o fim deste
    // uso); outra habilidade interrompe (`ModsPoe.canalizandoAgora`). A folga de um tique entre um uso e o outro.
    const canal = hunt.canalizacao;
    if (tagsPoe.includes('canalizar')) {
      const continua = canal && canal.acao === entry.id && inicio <= canal.ate + 250;
      hunt.canalizacao = { acao: entry.id, desde: continua ? canal.desde : inicio, ate: inicio + Math.max(250, Math.round(tempoPoe?.uso ?? tempoPoe?.conjuracaoMs ?? 500)), magia: tagsPoe.includes('magia') };
    } else if (canal && canal.ate > inicio) canal.ate = inicio;
    // (14/10, Suspender no Tempo: a magia não instantânea, não canalizada, não de lacaio, não Vaal cria uma Miragem Suspensa)
    if (tagsPoe.includes('magia') && !tagsPoe.some((t) => ['canalizar', 'lacaio', 'vaal'].includes(t)) && (tempoPoe?.conjuracaoMs ?? 0) > 0) eventos.push(...suspenderNoTempo(estado, hunt, personagem, entry, alvo, hunt.clock ?? 0));
    if (tagsPoe.includes('magia') && (tempoPoe?.conjuracaoMs ?? 0) > 0) hunt.poeMagiasRecentes = [...(hunt.poeMagiasRecentes ?? []).filter((t) => (hunt.clock ?? 0) - t <= ModsPoe.RECENTE_MS), hunt.clock ?? 0].slice(-20);
    // (o `armadilha` — a armadilha ativada no alvo — sai abaixo, com o arquétipo; o `mina` do ciclo 7 é o uso da gema de Mina.)
    for (const [tag, rec, ev] of [['movimento', 'usouMovimento', 'usarMovimento'], ['vaal', 'usouVaal', 'usarVaal'], ['clamor', 'clamou', 'usarClamor'], ['maldicao', null, 'conjurarMaldicao'], ['guarda', null, 'usarGuarda'], ['mina', null, 'mina']]) {
      if (!tagsPoe.includes(tag)) continue;
      if (rec) ModsPoe.marcar(hunt, rec);
      ModsPoe.evento(estado, hunt, ev, fichaDoUso, ctxDoUso);
    }
    if (/^Dash$|Avanço$/i.test(GemasPoe.doSlug(entry.poeGema.slug)?.gema?.en ?? '')) ModsPoe.marcar(hunt, 'usouAvanco');
    // ARMADILHA e MINA (o arquétipo da gema): "ao Jogar uma Armadilha" é o uso; "quando sua Armadilha for ativada por um Inimigo" e a mina
    // detonada são o acerto — no jogo a armadilha e a mina disparam na hora, no alvo (antes o evento `armadilha` nunca acontecia).
    // (12/10: com as Armadilhas e Minas PLANTADAS, o "ativada por um Inimigo" e o "Detonar" saem quando ela ativa — `plantada`, abaixo.)
    const arquetipo = entry.poeGema.arquetipo;
    const primeiro = atingidos.find(Boolean) ?? null;
    if (arquetipo === 'armadilha') {
      ModsPoe.evento(estado, hunt, 'lancarArmadilha', fichaDoUso, ctxDoUso);
      if (primeiro && !tipoPlantado) ModsPoe.evento(estado, hunt, 'armadilha', fichaDoUso, { ...ctxDoUso, alvo: primeiro });
    }
    if (arquetipo === 'mina' && primeiro && !tipoPlantado) {
      ModsPoe.marcar(hunt, 'detonouMina');
      ModsPoe.evento(estado, hunt, 'detonarMina', fichaDoUso, { ...ctxDoUso, alvo: primeiro });
    }
  }
  // (PoE, 12/10) A Armadilha ATIVADA por um inimigo / a Mina DETONADA (`plantada`): "quando sua Armadilha for ativada por um Inimigo", "ao
  // Detonar uma Mina" e o "Detonou uma Mina Recentemente" — com quem ela acertou.
  if (plantada && entry.poeGema) {
    const primeiro = atingidos.find(Boolean) ?? null;
    const fichaDaPlantada = Ficha.combate(estado);
    const ctx = { alvo: primeiro, eventos, personagem, tags: tagsPoeDaSkill(entry) };
    if (plantada.tipo === 'armadilha' && primeiro) ModsPoe.evento(estado, hunt, 'armadilha', fichaDaPlantada, ctx);
    // (lote 34, P023: a detonação conta — "por cada Mina Detonada Recentemente")
    if (plantada.tipo === 'mina') ModsPoe.marcarMinaDetonada(hunt, hunt.clock ?? 0);
    if (plantada.tipo === 'mina' && primeiro) {
      ModsPoe.marcar(hunt, 'detonouMina');
      ModsPoe.evento(estado, hunt, 'detonarMina', fichaDaPlantada, ctx);
    }
  }
  // Recarga com CARGAS (PoE: "Recarga: 3,5 s (3 usos)" — o Avanço Flamejante): gasta uma por uso e elas voltam uma de cada vez; só trava
  // quando todas estão recarregando (até a primeira voltar).
  if (!plantada && tempoPoe?.cargas > 1 && recarga) {
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
  // O suporte Momentum: +1 de Momentum a cada uso (DEPOIS do tempo deste uso, que já contou o Momentum de antes); no máximo, perde tudo e
  // ganha Rapidez — a ficha muda (a velocidade de movimento).
  if (!gatilho && entry.poeGema && efeitoDaGema?.momentumPorUso > 0 && ModsPoe.ganharMomentum(hunt, efeitoDaGema, inicio)) Ficha.invalidar(estado);
  if (entry.kind === 'item') cds[grupo] = { ate: inicio + RECARGA_DA_POCAO_MS, total: RECARGA_DA_POCAO_MS };
  // (Gema do PoE: o golpe básico espera o tempo de uso dela pelo `GRUPO_DO_POE` acima, no relógio da caçada — `cacadas.tique`. Antes era
  // `hunt.proximoGolpeEm`, que é do relógio de PAREDE do tique: o `inicio` + uso, pequeno, nunca passava dele e o básico não esperava nada.)
  // Skill de ataque instantânea: o global conta deste instante. (A conjurada já marcou no início.)
  if (deAtaque && !concluir && !gatilho) hunt.ultimoAtaqueEm = inicio;
  if (entry.desafio) (hunt.desafiosEm ??= {})[entry.id] = agora;
  marcarDaSkill(eventos, entry, hunt, alvo, { conjurada: concluir || !!plantada, de: plantada });
  return { ok: true, eventos };
}

/**
 * (PoE, 12/10) O ARREMESSO da Armadilha/Mina (`itens-poe/armas-plantadas.mjs`): planta no lugar mirado — + as armadilhas a mais do "X% de
 * chance de arremessar até N Armadilhas adicionais", em volta —, com a duração da gema ("Armadilha/Mina dura N segundos") e o tempo de
 * detonação da Mina, e já processa as plantadas (`tiqueDasPlantadas`). Devolve os eventos.
 */
function plantarArmas(estado, hunt, personagem, slot, entry, action, lugar, efeitoDaGema, agora) {
  const tipo = Plantadas.tipoDaGema(entry);
  const ficha = Ficha.combate(estado);
  const slug = entry.poeGema.slug;
  const dur = Plantadas.duracaoMs(ficha, tipo, GemasPoe.compilada(slug, efeitoDaGema?.nivel ?? 1)?.stats?.duracaoObjeto ?? null);
  const detonacaoMs = tipo === 'mina' ? Plantadas.detonacaoDaGema(GemasPoe.doSlug(slug)?.gema?.mods ?? []) : null;
  const eventos = [];
  // ("Minas Desaceleram Inimigos próximos delas por N segundos quando são Plantadas" — os a até 3 casas da Mina.)
  const lentidao = tipo === 'mina' ? Plantadas.segundosDaLentidaoAoPlantar(ficha) : 0;
  for (const c of Plantadas.casasDoArremesso(lugar.x, lugar.y, Plantadas.extrasDoArremesso(ficha, tipo))) {
    const p = Plantadas.plantar(hunt, ficha, { tipo, acao: action.id, slot, x: c.x, y: c.y, z: hunt.z ?? 0, duracaoMs: dur, detonacaoMs, agora });
    if (lentidao > 0) for (const b of Plantadas.inimigosPerto(hunt, p, Plantadas.PADRAO.mina.raioDosProximos)) {
      ModsPoe.porNoAlvo(b, 'lento', agora + lentidao * 1000);
      eventos.push({ t: 'estado', uid: b.uid, x: b.x, y: b.y, estado: 'lento' });
    }
  }
  return tiqueDasPlantadas(estado, hunt, personagem, eventos, agora);
}

/**
 * (PoE, 12/10) A FOTO de quem vincula (`itens-poe/vinculos.mjs` é puro): a vida, o bloqueio e o crítico (o "igual a sua"), o Efeito do Buff
 * dos Vínculos, as cargas (para "Alvos Vinculados compartilham Cargas…") e as linhas da árvore de quem vincula; e a velocidade dos jogadores
 * vinculados ("Sua Velocidade de Movimento é igual a maior…").
 */
function fotoDoVinculo(estado, hunt, ficha, lk) {
  const v = (k) => ModsPoe.valor(ficha, k);
  lk.foto = {
    vidaMax: estado.maxHp ?? 0, bloqueioPct: Math.round((ficha.blockChance ?? 0) * 1000) / 10, critPct: Math.round((ficha.critChance ?? 0) * 1000) / 10,
    efeitoPct: v('efeito_buff_gema:vinculo'), porMetadePct: v('vinculo_efeito_por_metade'), mov2: v('vinculos2_move_speed'), defesas4: v('vinculos4_defesas'),
    velocidadeIgual: v('velocidade_igual_vinculados') > 0, maldicoesEmVoce: v('maldicoes_em_voce_vinculo') > 0, feixe: v('feixe_sem_afeccao') > 0,
    ...(v('vinculo_compartilha_cargas') > 0 && ficha.cargas ? { cargas: CargasDoPoe.adds(estado, ficha.cargas) ?? {} } : {}),
  };
  if (lk.foto.velocidadeIgual) lk.velocidadeDosAlvos = Math.max(0, ...lk.alvos.filter((a) => a.tipo === 'jogador').map((a) => { const quem = Vinculos.resolver(hunt, a); return quem ? Ficha.combate(quem).speed ?? 0 : 0; }));
}

/** (PoE, 12/10) O VÍNCULO conjurado: os alvos (o mais perto; os a mais sorteados), a duração, o custo por segundo e a foto. Devolve os eventos. */
function criarVinculo(estado, hunt, entry, action, efeitoDaGema, agora) {
  const ficha = Ficha.combate(estado);
  const slug = entry.poeGema.slug;
  const nivel = efeitoDaGema?.nivel ?? 1;
  const props = Vinculos.daGema(GemasPoe.textosDaGema(slug, nivel).linhas);
  const perto = (a) => { const p = Vinculos.posicao(a, Vinculos.resolver(hunt, a)); return p ? Math.max(Math.abs(p.x - hunt.pos.x), Math.abs(p.y - hunt.pos.y)) : Infinity; };
  const cand = Vinculos.candidatos(estado, hunt, ficha.afPoe).sort((a, b) => perto(a) - perto(b));
  if (!cand.length) return [];
  const resto = cand.slice(1).sort(() => Math.random() - 0.5);
  const alvos = [cand[0], ...resto.slice(0, Vinculos.quantosVincula(ficha.afPoe) - 1)];
  // (14/10, o Juramento de Fidelidade do Luminary: "Habilidades de conexão têm duração de fixação infinita" — o Vínculo não acaba pelo tempo)
  const duracaoMs = ModsPoe.valor(ficha, 'vinculo_duracao_infinita') > 0 ? DURACAO_INFINITA_MS : Math.round(props.duracaoMs * fatorDeDuracao(estado, entry, efeitoDaGema));
  const lk = Vinculos.criar(hunt, { acao: entry.id, slug, nome: entry.name, props, alvos, duracaoMs, custoPorSegundo: GemasPoe.custoNoNivel(slug, nivel), agora });
  fotoDoVinculo(estado, hunt, ficha, lk);
  return alvos.map((a) => { const p = Vinculos.posicao(a, Vinculos.resolver(hunt, a)); return p ? { t: 'fx', id: 13, x: p.x, y: p.y } : null; }).filter(Boolean);
}

/**
 * (PoE, 12/10) O tique dos VÍNCULOS: a foto de quem vincula, o custo por segundo, a duração, a quebra fora do alcance e a MORTE do alvo ("Se o
 * alvo morrer enquanto vinculado, você também morrerá"); "Inimigos próximos dos seus alvos Vinculados têm Exposição a Fogo, Gelo e Raio".
 */
export function tiqueDosVinculos(estado, hunt, personagem, eventos = [], agora = hunt?.clock ?? 0) {
  if (!hunt?.vinculos?.length || !itensPoeLigado()) return eventos;
  const ficha = Ficha.combate(estado);
  for (const lk of hunt.vinculos) fotoDoVinculo(estado, hunt, ficha, lk);
  const { morreu } = Vinculos.tique(estado, hunt, ficha.afPoe, agora);
  if (morreu && (estado.hp ?? 0) > 0) {
    estado.hp = 0;
    eventos.push({ t: 'say', uid: 'player', quem: personagem?.nome, text: 'O alvo vinculado morreu.', x: hunt.pos?.x, y: hunt.pos?.y, color: '#ff5b4f' });
  }
  if (ModsPoe.valor(ficha, 'vinculo_exposicao_proximos') > 0) {
    for (const lk of hunt.vinculos ?? []) for (const a of lk.alvos) {
      const p = Vinculos.posicao(a, Vinculos.resolver(hunt, a));
      if (!p) continue;
      for (const m of hunt.monstros ?? []) {
        if (!(m.hp > 0) || m.dummy || Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) > Vinculos.PADRAO.raioDosProximos) continue;
        for (const e of ['exposicaoFogo', 'exposicaoGelo', 'exposicaoRaio']) ModsPoe.porNoAlvo(m, e, agora + Vinculos.PADRAO.exposicaoMs);
      }
    }
  }
  return eventos;
}

/**
 * (PoE, 12/10) O personagem tem o CONVOCAR O AÇO? "Toda habilidade de Aço concede o Convocar o Aço" (a gema encaixada com o tipo Steel) e o
 * "Concede Chamado do Aço" (o Verme de Aço). `{ consumo }` — o maior "Consome até N Fragmentos de Aço" das gemas encaixadas (+ o do Verme de
 * Aço), para o uso automático saber quando recarregar — ou null.
 */
function convocarOAcoDe(estado, ficha) {
  let concede = ModsPoe.valor(ficha, 'concede_convocar_aco') > 0;
  let consumo = 0;
  for (const [id, s] of Gemas.skillsAtivas(estado)) {
    const entry = POR_ID.get(id);
    if (!entry?.poeGema) continue;
    if ((GemasPoe.doSlug(entry.poeGema.slug)?.gema?.tipos ?? []).includes('Steel')) concede = true;
    const d = doAcoDaGema(entry.poeGema.slug, s.nivel ?? 1);
    if (d) consumo = Math.max(consumo, d.consome + consumoExtraDoAco(ficha, entry));
  }
  return concede ? { consumo } : null;
}

/** (PoE, 12/10) O tique dos FRAGMENTOS DE AÇO (`itens-poe/convocar-o-aco.mjs`): a recarga e o fim das Proteções de Aço. */
export function tiqueDoAco(estado, hunt, personagem, eventos = [], agora = hunt?.clock ?? 0) {
  if (!hunt?.aco || !itensPoeLigado()) return eventos;
  if (Aco.tique(hunt, Ficha.combate(estado), agora)) Ficha.invalidar(estado);
  return eventos;
}

/**
 * (PoE, 12/10) O CONVOCAR O AÇO, automático (o jogo é idle — `Aco.quer`): com o relógio de ação livre, em combate, chama os empalamentos dos
 * inimigos vivos e dos cadáveres em volta, reflete o Dano Físico em volta de cada um (pela Redução de Dano Físico do bicho, como o
 * empalamento solto — `mods-poe.aoAcertar`), ganha os fragmentos e liga a recarga. Ocupa o relógio de ação pelo tempo de uso (0,5 s ÷ a
 * "Velocidade de Uso"). Devolve os eventos.
 */
export function convocarOAco(estado, hunt, personagem, agora = hunt?.clock ?? 0) {
  if (!itensPoeLigado() || !hunt?.pos || (estado.hp ?? 0) <= 0 || hunt.conjurando || Protecao.imune(hunt)) return [];
  // (o relógio de ação primeiro: ocupado quase sempre, e é a conta mais barata — a das gemas encaixadas vem depois)
  const cds = (hunt.cooldowns ??= {});
  if (cds[GRUPO_DO_POE] && !R.liberou(agora, cds[GRUPO_DO_POE].ate)) return [];
  const ficha = Ficha.combate(estado);
  const meu = convocarOAcoDe(estado, ficha);
  if (!meu) return [];
  const centro = { x: hunt.pos.x, y: hunt.pos.y };
  const raio = Aco.raioDaChamada(ficha);
  const perto = (a, b, r) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= r;
  if (!hunt.monstros.some((m) => m.hp > 0 && perto(m, centro, raio))) return [];
  if (!Aco.quer(hunt, ficha, { consumo: meu.consumo, centro, raio, agora })) return [];
  const uso = Aco.usoMs(ficha);
  cds[GRUPO_DO_POE] = { ate: agora + uso, total: uso };
  const { reflexos } = Aco.chamar(hunt, ficha, centro, raio, agora);
  const eventos = [{ t: 'fx', id: 13, uid: 'player', x: centro.x, y: centro.y }];
  const raioDoReflexo = Aco.raioDoReflexo(ficha);
  // (lote 32, P039: o Vínculo Ancestral — o reflexo é o dano da habilidade; os empalamentos são chamados igual)
  const semDano = ModsPoe.valor(ficha, 'sem_dano_proprio') > 0;
  for (const r of reflexos) {
    eventos.push({ t: 'explosao', id: 6, x: r.x, y: r.y, lado: 1 + 2 * raioDoReflexo });
    for (const m of semDano ? [] : hunt.monstros) {
      if (!(m.hp > 0) || !perto(m, r, raioDoReflexo)) continue;
      const d = Math.max(1, Math.round(resistido(hunt, m, 'physical', r.dano, null, { armadura: false })));
      m.hp -= d;
      QuemFeriu.carimbar(m, QuemFeriu.VOCE, ['ataque', 'fisico']); // (lote 31)
      eventos.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v: d, foe: true, alvo: m.name, color: '#b0b0b0', refletido: true });
    }
  }
  return eventos;
}

/**
 * (PoE, 12/10) A RUNA conjurada (`itens-poe/runas-vinculadas.mjs`): o que a gema diz (a ativação, as durações, a troca de alvo), o intervalo
 * ÷ a Velocidade de Conjuração (a da ficha, a "com Habilidades de Runas" e a da gema — "Aumentos e Reduções à Velocidade de Conjuração também
 * se aplicam à frequência de Ativação"), as durações × a Duração de Habilidades; vincula ao alvo e já processa as Runas. Devolve os eventos.
 */
export function conjurarRuna(estado, hunt, personagem, slot, entry, action, lugar, alvo, efeitoDaGema, agora, custo = null) {
  const ficha = Ficha.combate(estado);
  const props = Runas.daGema(GemasPoe.textosDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1).linhas);
  const castSpeed = (ficha.castSpeed ?? 0) + (ModsPoe.somaPorTags(ficha, tagsPoeDaSkill(entry)).cast_speed_tag ?? 0) + (efeitoDaGema?.velConjuracaoPct ?? 0);
  const fatorDaDuracao = fatorDeDuracao(estado, entry, efeitoDaGema);
  const conjurar = () => Runas.vincular(hunt, ficha, Runas.conjurar(hunt, ficha, { acao: action.id, slot, x: lugar.x, y: lugar.y, z: hunt.z ?? 0, props, intervaloMs: props.intervaloMs / Math.max(0.1, 1 + castSpeed / 100), fatorDaDuracao, agora, custo }), agora, { preferido: alvo });
  conjurar();
  // (lote 73, o Notável) "Habilidades que criam Runas têm X% de chance de criarem uma Runa adicional": a outra no mesmo lugar (ela procura o
  // inimigo dela — o alvo já tem a vaga ocupada).
  if (Math.random() * 100 < ModsPoe.valor(ficha, 'runa_adicional_chance')) conjurar();
  return tiqueDasRunas(estado, hunt, personagem, [], agora);
}

/**
 * (lote 74 — dono, 17/10: "Implementar a gema") A CONVOCAR RUNAS (Brand Recall do PoE): todas as suas Runas vêm até você, soltas, com o
 * Alcance de Vínculo aumentado da gema ("Runas recebem Alcance de Vínculo aumentado em X%", pelo nível) + o do Reduzir ("Convocação de Runas
 * concede alcance do Vínculo de Runas aumentado em X% para Runas convocadas") até se vincularem de novo; e cada uma vinculada é ATIVADA no
 * inimigo dela, pagando 20% do custo de mana dela ("Gasta 20% do Custo da Runa" — a wiki do PoE, 3.11: "spends 20% of each recalled brand's
 * mana cost to activate them"; sem a mana, aquela não ativa). A duração não se renova. Devolve os eventos.
 */
export function convocarRunas(estado, hunt, personagem, efeitoDaGema, agora = hunt?.clock ?? 0) {
  const eventos = [];
  if (!hunt?.runas?.length || !hunt.pos) return eventos;
  const ficha = Ficha.combate(estado);
  const linhas = (GemasPoe.textosDaGema('Brand_Recall', efeitoDaGema?.nivel ?? 1)?.linhas ?? []).join('\n');
  const daGema = Number(/Alcance de Vínculo aumentado em (\d+)\s*%/.exec(linhas)?.[1]) || 0;
  const pctDoCusto = Number(/Gasta (\d+)\s*% do Custo da Runa/.exec(linhas)?.[1]) || 20;
  const alcancePct = daGema + ModsPoe.valor(ficha, 'convocar_runas_alcance');
  const porUid = new Map((hunt.monstros ?? []).map((b) => [b.uid, b]));
  for (const r of [...hunt.runas]) {
    const alvo = r.alvo != null ? porUid.get(r.alvo) : null;
    // A parte do custo, no recurso em que a Runa foi paga (Vida — a Magia Sanguínea —, Escudo de Energia, ou Mana com a parte em Vida); só
    // depois que a Ativação saiu.
    const total = Math.round(((r.custo ?? 0) * pctDoCusto) / 100);
    const emVida = r.custoEm === 'vida' ? total : r.custoEm === 'mana' ? Math.round((total * (r.parteEmVidaPct ?? 0)) / 100) : 0;
    const emEs = r.custoEm === 'es' ? total : 0;
    const emMana = total - emVida - emEs;
    const pode = (estado.hp ?? 0) > emVida && (estado.es ?? 0) >= emEs && (estado.mana ?? 0) >= emMana;
    if (alvo?.hp > 0 && (estado.hp ?? 0) > 0 && pode) {
      const res = dispararSemMarcar(estado, hunt, personagem, r.slot, alvo, { plantada: { tipo: 'runa', id: r.id, acao: r.acao, slot: r.slot, x: alvo.x, y: alvo.y, z: r.z, areaPct: Runas.areaTardiaPct(ficha, r) } });
      if (res?.ok) {
        eventos.push(...(res.eventos ?? []));
        if (emVida) estado.hp = Math.max(1, (estado.hp ?? 0) - emVida);
        if (emEs) estado.es = Math.max(0, (estado.es ?? 0) - emEs);
        if (emMana > 0) {
          estado.mana = Math.max(0, (estado.mana ?? 0) - emMana);
          // (a mana gasta conta como no Custo: "por cada N de Mana Gasta Recentemente", "ao Gastar Mana")
          hunt.poeManaGasta = [...(hunt.poeManaGasta ?? []).filter((x) => (hunt.clock ?? 0) - x.t <= ModsPoe.RECENTE_MS), { t: hunt.clock ?? 0, n: emMana }].slice(-40);
          ModsPoe.marcar(hunt, 'gastouMana');
          ModsPoe.evento(estado, hunt, 'gastarMana', ficha, { personagem, quantidade: emMana, eventos: [] });
          Treino.gastarMana(estado, emMana);
        }
        if (emVida) ModsPoe.marcar(hunt, 'gastouVida');
      }
    }
    Runas.convocar(r, hunt.pos, agora, alcancePct, hunt.z ?? 0);
  }
  Runas.marcarNosInimigos(hunt);
  return eventos;
}

/**
 * (PoE, 12/10) O tique das RUNAS (`itens-poe/runas-vinculadas.mjs`): as vinculadas são Ativadas a cada N segundos no lugar do inimigo
 * (`dispararSemMarcar` com `plantada`); as que acabam vinculadas devolvem a mana do "Recupera X% de Mana quando uma Runa expira enquanto
 * Vinculada". Devolve os eventos.
 */
export function tiqueDasRunas(estado, hunt, personagem, eventos = [], agora = hunt?.clock ?? 0) {
  if (!hunt?.runas?.length || !itensPoeLigado()) return eventos;
  const ficha = Ficha.combate(estado);
  const { ativar, expiradas } = Runas.tique(hunt, ficha, agora);
  for (const { r, alvo, areaPct } of ativar) {
    if ((estado.hp ?? 0) <= 0) break;
    const res = dispararSemMarcar(estado, hunt, personagem, r.slot, alvo, { plantada: { tipo: 'runa', id: r.id, acao: r.acao, slot: r.slot, x: alvo.x, y: alvo.y, z: r.z, areaPct } });
    if (res?.ok) eventos.push(...(res.eventos ?? []));
  }
  const mana = ModsPoe.valor(ficha, 'mana_runa_expira_vinculada');
  if (mana > 0) for (const x of expiradas) if (x.vinculada && !x.destruida) estado.mana = Math.min(estado.maxMana ?? 0, (estado.mana ?? 0) + Math.round(((estado.maxMana ?? 0) * mana) / 100));
  return eventos;
}

/**
 * (PoE, 12/10) O tique das ARMADILHAS e MINAS plantadas (`itens-poe/armas-plantadas.mjs`): as Armadilhas com inimigo no raio de ativação
 * ativam (e as próximas, com "Quando suas Armadilhas Ativarem, suas Armadilhas próximas também Ativam"); as Minas detonam na sequência.
 * Cada uma sai do lugar dela (`dispararSemMarcar` com `plantada`). Devolve os eventos.
 */
export function tiqueDasPlantadas(estado, hunt, personagem, eventos = [], agora = hunt?.clock ?? 0) {
  if (!hunt?.plantadas?.length || !itensPoeLigado()) return eventos;
  const ficha = Ficha.combate(estado);
  for (const { p, alvo } of [...Plantadas.armadilhasQueAtivam(hunt, ficha, agora), ...Plantadas.minasQueDetonam(hunt, ficha, agora)]) {
    if ((estado.hp ?? 0) <= 0) break;
    Plantadas.tirar(hunt, p);
    const r = dispararSemMarcar(estado, hunt, personagem, p.slot, alvo, { plantada: p });
    if (r?.ok) eventos.push(...(r.eventos ?? []));
    // ("X% de Chance das Armadilhas Ativarem uma vez adicional", "Minas têm uma chance de X% de serem Detonadas uma Vez Adicional": a
    // habilidade sai mais uma vez do mesmo lugar, no inimigo mais perto que sobrou.)
    if (r?.ok && Plantadas.ativaDeNovo(ficha, p.tipo) && (estado.hp ?? 0) > 0) {
      const outro = alvo?.hp > 0 ? alvo : Plantadas.inimigoPerto(hunt, p, p.tipo === 'mina' ? Plantadas.PADRAO.mina.raioDeDetonacao : Plantadas.PADRAO.armadilha.raioDasProximas);
      const de = dispararSemMarcar(estado, hunt, personagem, p.slot, outro, { plantada: p });
      if (de?.ok) eventos.push(...(de.eventos ?? []));
    }
  }
  return eventos;
}

/**
 * ---- O VISUAL da skill (Arena de Efeitos — `systems/efeitos-visuais.mjs`) ----
 * Cada evento de DESENHO que a skill gerou (projétil, efeito, área, dano) leva o id dela (`sk`): o cliente desenha com o visual
 * configurado para a skill (sem configuração, o de sempre). E o LANÇAMENTO vira um evento (`skill`, SKILL_CAST) na frente — a skill
 * conjurada já o teve no `cast`. Os eventos de outra skill no meio (a magia ativada por gatilho) ficam com o `sk` dela.
 */
const EVENTOS_DE_DESENHO = new Set(['shot', 'fx', 'explosao', 'area', 'dmg']);
function marcarDaSkill(eventos, entry, hunt, alvo, { conjurada = false, de = null } = {}) {
  if (!entry.poeGema && !Gemas.ehSkillDeGema(entry)) return;
  for (const ev of eventos) if (EVENTOS_DE_DESENHO.has(ev.t) && ev.sk === undefined && !(ev.t === 'dmg' && !ev.foe)) ev.sk = entry.id;
  // A conjurada já desenhou o lançamento no `cast`: o evento vai só com a posição (o impacto "ao chegar o projétil" conta dela).
  // (`de`: a Armadilha/Mina plantada — a habilidade sai do lugar dela.)
  eventos.unshift({ t: 'skill', sk: entry.id, uid: 'player', x: de ? de.x : hunt.pos.x, y: de ? de.y : hunt.pos.y, ...(alvo ? { tx: alvo.x, ty: alvo.y, alvo: alvo.uid } : {}), ...(conjurada ? { semLancamento: true } : {}) });
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
    // O ataque que dispara tem de estar no MESMO grupo (o dano recebido não tem ataque). (14/10: o Feiticeiro — qualquer ataque de varinha,
    // com ele LIGADO: a reserva dele.)
    if (acao && !g.feiticeiro && !g.ataques.includes(acao)) continue;
    if (g.feiticeiro && !(hunt.buffs?.[g.feiticeiro]?.ate > agora)) continue;
    const chave = `gatilho:${g.chave}`;
    if (cds[chave] && !R.liberou(agora, cds[chave].ate)) continue;
    let saiu = false;
    for (const magia of g.magias) {
      // O alvo do ataque, se ainda vive; senão o bicho vivo mais perto (o do crítico pode ter morrido no golpe).
      const alvoDaMagia = alvo && alvo.hp > 0 ? alvo : hunt.monstros.filter((b) => b.hp > 0).sort((a, b) => distanciaChebyshev(hunt.pos, a) - distanciaChebyshev(hunt.pos, b))[0] ?? null;
      // (as magias do Feiticeiro não custam: o custo delas virou a reserva dele)
      const robos = comRobos(estado);
      const disparo = () => dispararSemMarcar(estado, hunt, personagem, null, alvoDaMagia, { gatilho: { acao: { id: magia, enabled: true, minMana: 0, minTargets: 1, conditions: [] }, ...(g.feiticeiro ? { semCusto: true } : {}) } });
      const r = robos ? doLugarDoRobo(hunt, 0, disparo) : disparo();
      if (!r.ok) continue;
      saiu = true;
      n++;
      eventos.push({ t: 'gatilho', quem: personagem?.nome, suporte: g.nome, skill: POR_ID.get(magia)?.name ?? magia }, ...(r.eventos ?? []));
      // (os Robôs Ativadores: a mesma magia de novo, ignorando a recarga)
      if (robos) {
        const alvo2 = alvoDaMagia && alvoDaMagia.hp > 0 ? alvoDaMagia : hunt.monstros.filter((b) => b.hp > 0).sort((a, b) => distanciaChebyshev(hunt.pos, a) - distanciaChebyshev(hunt.pos, b))[0] ?? null;
        const r2 = doLugarDoRobo(hunt, 1, () => dispararSemMarcar(estado, hunt, personagem, null, alvo2, { gatilho: { acao: { id: magia, enabled: true, minMana: 0, minTargets: 1, conditions: [] }, ignorarRecarga: true, ...(g.feiticeiro ? { semCusto: true } : {}) } }));
        if (r2.ok) { n++; eventos.push({ t: 'gatilho', quem: personagem?.nome, suporte: ROBOS.nome, skill: POR_ID.get(magia)?.name ?? magia }, ...(r2.eventos ?? [])); }
      }
    }
    // (o Feiticeiro: 0,6 s ÷ a "Recuperação da Recarga" do nível dele)
    const recargaMs = g.feiticeiro ? GemasPoe.feiticeiroNoNivel(g.nivel).recargaMs : g.gatilho.recargaMs;
    if (saiu && recargaMs) cds[chave] = { ate: agora + recargaMs, total: recargaMs };
  }
  return n;
}

/** (14/10, o Feiticeiro) O ataque de VARINHA que dispara projéteis: a gema de Ataque com Projétil (ou o golpe básico, sem `entry`) de varinha. */
export function ehAtaqueDeVarinha(estado, entry = null) {
  if (estado?.equipment?.weapon?.poe?.classe !== 'Wands') return false;
  if (!entry) return true;
  return !!entry.poeGema?.ataque && tagsPoeDaSkill(entry).includes('projetil');
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
  const robos = comRobos(estado);
  const disparo = () => dispararSemMarcar(estado, hunt, personagem, null, alvoDaMagia, { gatilho: { acao: { id: def.acao, enabled: true, minMana: 0, minTargets: 1, conditions: [] }, semCusto: true } });
  const r = robos ? doLugarDoRobo(hunt, 0, disparo) : disparo();
  if (!r.ok) return;
  cds[chave] = { ate: agora + 250, total: 250 };
  eventos.push({ t: 'gatilho', quem: personagem?.nome, suporte: 'Item único', skill: def.nome }, ...(r.eventos ?? []));
  // (14/10, os Robôs Ativadores: de novo, ignorando a recarga)
  if (robos) {
    const r2 = doLugarDoRobo(hunt, 1, () => dispararSemMarcar(estado, hunt, personagem, null, alvoDaMagia?.hp > 0 ? alvoDaMagia : null, { gatilho: { acao: { id: def.acao, enabled: true, minMana: 0, minTargets: 1, conditions: [] }, semCusto: true, ignorarRecarga: true } }));
    if (r2.ok) eventos.push({ t: 'gatilho', quem: personagem?.nome, suporte: ROBOS.nome, skill: def.nome }, ...(r2.eventos ?? []));
  }
});

/**
 * Os GATILHOS das PEÇAS (dono, 11/10: os únicos): "Ativa uma Magia Encaixada quando você Atacar com esta Arma, com Recarga de 0,25 segundo"
 * — `gatilho_local:<evento>:<filtro>` no `poe.af` da peça vestida (o valor é a recarga, em segundos). No evento (`mods-poe.evento`), as gemas
 * encaixadas NA PRÓPRIA peça que passam no filtro (`Gemas.encaixadasNaPeca`) saem no alvo do evento ou no bicho mais perto — sem custo só
 * com "Magias … não têm Custo se Ativadas" (`gatilho_sem_custo`). O disparo de dentro de um disparo não dispara de novo (o acerto da magia
 * ativada não a reativa).
 */
const GATILHO_LOCAL = /^gatilho_local:(\w+):(\w+)$/;
let disparandoDaPeca = false;
ModsPoe.definirGatilhosDeItem((estado, hunt, nome, ficha, ctx) => {
  if (disparandoDaPeca || !estado?.equipment) return;
  let conds = null;
  for (const [slot, peca] of Object.entries(estado.equipment)) {
    const af = slot !== 'backpack' ? peca?.poe?.af : null;
    if (!af) continue;
    for (const [k, v] of Object.entries(af)) {
      if (!k.startsWith('gatilho_local:')) continue;
      const { stat, conds: c } = ModsPoe.partir(k);
      const m = GATILHO_LOCAL.exec(stat);
      if (!m || m[1] !== nome) continue;
      if (c.length) {
        conds ??= ModsPoe.condicoesDe(estado, ficha?.afPoe);
        if (!c.every((x) => (ModsPoe.ehCondDeEstado(x) ? ModsPoe.vale(conds, x) : !!ctx.tagsAlvo?.has(x)))) continue;
      }
      // ("X% de ativar Magias Encaixadas quando você Gastar ao menos N de Mana em um Custo Direto…" — a Sede de Kitava: o mínimo de mana
      // gasta e a chance, da própria peça.)
      if (Number(af.gatilho_mana_min_local) > 0 && !((ctx.quantidade ?? 0) >= Number(af.gatilho_mana_min_local))) continue;
      if (Number(af.gatilho_chance_local) > 0 && Math.random() * 100 >= Number(af.gatilho_chance_local)) continue;
      const agora = ctx.agora ?? hunt.clock ?? 0;
      const cds = (hunt.cooldowns ??= {});
      const chave = `gatilho-peca:${slot}:${stat}`;
      if (cds[chave] && !R.liberou(agora, cds[chave].ate)) continue;
      const magias = Gemas.encaixadasNaPeca(peca, m[2]);
      if (!magias.length) continue;
      const alvo = ctx.alvo && ctx.alvo.hp > 0 ? ctx.alvo : hunt.monstros.filter((b) => b.hp > 0).sort((a, b) => distanciaChebyshev(hunt.pos, a) - distanciaChebyshev(hunt.pos, b))[0] ?? null;
      let saiu = false;
      disparandoDaPeca = true;
      try {
        for (const magia of magias) {
          const r = dispararSemMarcar(estado, hunt, ctx.personagem ?? null, null, alvo, { gatilho: { acao: { id: magia, enabled: true, minMana: 0, minTargets: 1, conditions: [] }, semCusto: Number(af.gatilho_sem_custo) > 0 } });
          if (!r.ok) continue;
          saiu = true;
          ctx.eventos?.push({ t: 'gatilho', quem: ctx.personagem?.nome, suporte: peca.poe?.nome ?? 'Item', skill: POR_ID.get(magia)?.name ?? magia }, ...(r.eventos ?? []));
        }
      } finally {
        disparandoDaPeca = false;
      }
      if (saiu) {
        const ms = Math.max(250, Math.round(Number(af.gatilho_recarga_local ?? v) * 1000));
        cds[chave] = { ate: agora + ms, total: ms };
      }
    }
  }
});

/**
 * A MALDIÇÃO que um ÚNICO põe num evento ("Amaldiçoa Inimigos com Vulnerabilidade ao Bloquear" — `mods-poe.evento`, ação `maldicao`): a
 * gema pelo nome, os efeitos dela no nível do item (`GemasPoe.buffNoNivel`), no monstro (`Reforcos.amaldicoar`).
 */
ModsPoe.definirMaldicao((hunt, alvo, nome, nivel, semLimite, agora) => {
  const def = Gemas.ativaPeloNome(nome);
  if (!def?.poe?.slug) return;
  const b = GemasPoe.buffNoNivel(def.poe.slug, nivel);
  if (b?.efeitos?.length) Reforcos.amaldicoar(alvo, def.acao, b.efeitos, { agora, dur: b.dur || 6000, ignorarLimite: semLimite, hunt });
});
// (lote 32, P038) A maldição sua que pegou: as Forças Profanadas renovam o Resfriamento e a Eletrização do inimigo (a ficha da caçada).
Reforcos.definirAoAmaldicoar((hunt, bicho, agora) => ModsPoe.aoAmaldicoar(ModsPoe.fichaDa(hunt), bicho, agora));

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
