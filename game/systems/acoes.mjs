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
import { salaDe } from './hunt/sala.mjs';
import * as Controle from './combate/controle.mjs';
import * as AtributosDoMob from './mobs/atributos.mjs';
import * as Defesa from './personagem/defesa.mjs';
import { ACTION_CATALOG, ACTION_CATALOG_ALTO, LEVELS_DAS_CAPTURAS, ITEM_CATALOG, CHARACTER_TEMPLATE, CATALOGO } from './dados.mjs';
import { removerItem } from './inventario.mjs';
import * as Treino from './treino.mjs';
import * as R from './regras.mjs';
import { ligado as itensPoeLigado } from './itens-poe/catalogo.mjs';
import * as LacaiosPoe from './itens-poe/lacaios-poe.mjs';
// (lote E1a, 26/10: os cadáveres das Oferendas e a Sentinela a mais do Golpe Dominador — `gemas-e1a.mjs`)
import * as GemasE1a from './itens-poe/gemas-e1a.mjs';
import * as Virulencia from './itens-poe/virulencia.mjs';
import * as Poderes from './poderes.mjs';
import * as GemasPoe from './itens-poe/gemas-poe.mjs';
import * as LinhasDasGemas from './itens-poe/linhas-das-gemas.mjs';
import { defesaDaPecaVestida } from './itens-poe/condicoes-poe.mjs';
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
// (lote A1, dono 19/10: o DESLOCAMENTO das gemas de movimento — a grade do jogador, os aliados na casa e o Solo Sagrado da chegada)
import * as Deslocamento from './itens-poe/deslocamento.mjs';
import { gradeDaHunt, huntOuMapaCustom } from './hunt/terreno.mjs';
import { andarDaGrade } from './hunt/andares.mjs';
import { aliadosPorCasa } from './hunt/aliados.mjs';
import { casaLivrePerto, proximoPassoAte } from './hunt/caminho.mjs';
import { criarSoloSagrado, porExposicao } from './itens-poe/condicoes-poe.mjs';
import * as Encontros from './encontros/estado.mjs';
import * as GemasA2 from './itens-poe/gemas-a2.mjs';
import * as GemasA4 from './itens-poe/gemas-a4.mjs';
import * as GemasA3b from './itens-poe/gemas-a3b.mjs';
// (lote A1b, dono 19/10: a Investida Carregada e o resto das gemas de movimento — os dados e as contas puras)
import * as GemasA1b from './itens-poe/movimento-a1b.mjs';
import * as GemasA5 from './itens-poe/gemas-a5.mjs';
import * as GemasB1 from './itens-poe/gemas-b1.mjs';
import * as GemasPR1 from './itens-poe/gemas-pr1.mjs';
import * as GemasPR2 from './itens-poe/gemas-pr2.mjs';
import * as GemasPR3 from './itens-poe/gemas-pr3.mjs';
import * as GemasPR4 from './itens-poe/gemas-pr4.mjs';
import * as GemasC1 from './itens-poe/gemas-c1.mjs';
// (lote C2, dono 20/10: os contadores próprios e as cargas consumidas das gemas de corpo a corpo, impacto e canalização)
import * as GemasC2 from './itens-poe/gemas-c2.mjs';
// (lote C3, dono 25/10: a postura e os objetos no tempo das gemas de corpo a corpo, impacto e canalização)
import * as GemasC3 from './itens-poe/gemas-c3.mjs';
// (lote C4, dono 21/10: os debuffs canalizados e as afecções específicas — a Praga, o Definhar, o Golpe Pestilento, a Víbora da Mamba)
import * as GemasC4 from './itens-poe/gemas-c4.mjs';
// (lote B2, dono 20/10: as gemas de contadores próprios, chão e espalhar — as Cargas Sangrentas, o Golpe Infernal, a Febre, o Contágio, a Ruína…)
import * as GemasB2 from './itens-poe/gemas-b2.mjs';
import * as GemasB3 from './itens-poe/gemas-b3.mjs';
// (lote B4, dono 25/10: os feixes e os objetos que reagem — `itens-poe/gemas-b4.mjs`)
import * as GemasB4 from './itens-poe/gemas-b4.mjs';
// (lotes G-B e G-D, dono 25/10: as guardas, a Energia da Penitência, os feixes da Tempestuosa, o Arcanista, o Fogo Justo, o Pacto de K'Tash, os Clamores Infernal e
// de Reunião e o Escudo Tempestuoso)
import * as GemasGBD from './itens-poe/gemas-gbd.mjs';
// (lotes G-A e G-C, dono 25/10: as maldições, as marcas e os clamores)
import * as GemasGAC from './itens-poe/gemas-gac.mjs';
// (lote E1b, 26/10: as Armadilhas, as Minas e as auras do lote — itens-poe/gemas-e1b.mjs)
import * as GemasE1b from './itens-poe/gemas-e1b.mjs';
// (lote E2B, 26/10: as Armadilhas que pedem mecânica nova, o Fogo Justo base — itens-poe/gemas-e2b.mjs)
import * as GemasE2b from './itens-poe/gemas-e2b.mjs';
import { JANELA } from '../websocket/quadro.mjs';
import * as ItensPoeJogo from './itens-poe/jogo.mjs';

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
const custoDaSkill = (entry, efeitoDaGema, estado = null) => (entry.poeGema
  ? entry.poeGema.buff && (Reserva.daGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) || Reserva.ehMaldicaoEmAura(entry, efeitoDaGema)) ? 0 : GemasPoe.custoNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) + custoBaseDoSuporte(estado, efeitoDaGema)
  : custoDoCatalogo(entry));
/**
 * (lote S1, 26/10) O custo de Mana BASE a mais dos suportes (o Arquimago: "custo de mana base equivalente a 5% do mana máximo não reservado"; o Mago do Gelo: "…do mana
 * máximo reservado" — o PoB: ManaCostBase BASE pelo PercentStat ManaUnreserved/ManaReserved): soma ao custo da gema antes dos multiplicadores. Sem o estado, 0.
 */
function custoBaseDoSuporte(estado, ef) {
  if (!estado || !ef || !(ef.custoBaseManaNaoReservadaPct > 0 || ef.custoBaseManaReservadaPct > 0)) return 0;
  const af = Ficha.combate(estado).afPoe ?? {};
  return ((ef.custoBaseManaNaoReservadaPct ?? 0) * ModsPoe.fatorDaEscala(estado, af, null, 'manaNaoReservada:1') + (ef.custoBaseManaReservadaPct ?? 0) * ModsPoe.fatorDaEscala(estado, af, null, 'manaReservada:1')) / 100;
}

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
  // (lote G20b: a habilidade que um suporte tornou TOTEM — o uso do totem, a colocação — ganha a tag: "Dano do Totem aumentado" vale nela)
  const doTotem = !!entry.poeGema?.doTotem || entry.poeGema?.lacaio === 'totem';
  if (daGema) {
    const t = ModsPoe.tagsDoPoe(daGema);
    // (lote 55, o Olho do Vigia: "Habilidades Não Canalizadoras" — a tag `naoCanalizar` nas que não são de Canalização)
    // (revisão do C1: + `naoImpelivel` — as que o PoB marca NeverExertable: não gastam nem recebem o Impelido do Clamor e da Emboscada, `GemasC1.NAO_IMPELIVEL`)
    return [...new Set([...t, ...(GemasC1.naoImpelivel(entry.poeGema.slug) ? ['naoImpelivel'] : []), ...(/_Banner$/.test(entry.poeGema.slug) ? ['estandarte'] : []), ...(ehAtaqueDeEscudo(entry.poeGema.slug, gema) ? ['ataqueDeEscudo'] : []), ...(t.includes('canalizar') ? [] : ['naoCanalizar']), ...(doTotem ? ['totem'] : []), 'habilidade'])];
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
export function raioDaAuraDe(estado, entry, base, mais = 1, incExtra = 0) {
  const f = Ficha.combate(estado);
  const tags = ModsPoe.somaPorTags(f, tagsPoeDaSkill(entry));
  // (13/10: + o "X% mais Área de Efeito" — `area_mais`, multiplica; 17/10, lote G14: + `incExtra`, a do suporte — a Generosidade)
  const maisArea = Math.max(0, 1 + (ModsPoe.valor(f, 'area_mais') + (tags.area_mais ?? 0)) / 100);
  return Math.max(1, Math.round(base * Math.sqrt(Math.max(0.1, 1 + (ModsPoe.valor(f, 'area_inc') + (tags.area_inc ?? 0) + incExtra) / 100) * Math.max(0.1, mais) * maisArea)));
}

/**
 * (PoE, 11/10) Os SUPORTES no acerto: a CRUELDADE ("Acertos de Habilidades Suportadas concedem Crueldade" — o buff por N s, com o "Efeito da
 * Crueldade concedido aumentado" do suporte); a LÂMINA NOTURNA ("concedem Elusivo no Golpe Crítico", com o efeito do suporte e o da árvore —
 * "Habilidades Suportadas por Lâmina Noturna têm Efeito do Elusivo aumentado"); o GOLPE IMPIEDOSO (o atordoamento base dele; "Acertos
 * Impiedosos Intimidam Inimigos por N segundos").
 */
export const ELUSIVO_DA_LAMINA_S = 4;
function efeitosDosSuportesNoAcerto(estado, hunt, bicho, ficha, efeito, { crit = false, impiedoso = false, agora = hunt?.clock ?? 0, eventos = [], doTotem = false } = {}) {
  const saida = { atordoou: false };
  if (!efeito || !itensPoeLigado()) return saida;
  const efeitoDeBuff = (hunt.poeEfeitoDeBuff ??= {});
  // (lote G20a: a Crueldade e o Elusivo vão para quem acerta — no acerto do totem, o totem: você não os ganha)
  if (efeito.crueldade > 0 && !doTotem) {
    const tinha = ModsPoe.buffAtivo(estado, 'crueldade');
    ModsPoe.ganharBuff(hunt, 'crueldade', ((efeito.crueldadeMs ?? 4000) / 1000) * Math.max(0.1, 1 + (efeito.duracaoPct ?? 0) / 100), agora);
    efeitoDeBuff.crueldade = efeito.crueldadeEfeitoPct ?? 0;
    if (!tinha) Ficha.invalidar(estado);
  }
  // (lote 33: o Elusivo não se ganha de novo enquanto há um; o efeito da Lâmina Noturna entra no efeito inicial dele — `ModsPoe.ganharBuff`)
  if (crit && efeito.elusivoNoCritico > 0 && !doTotem && !ModsPoe.buffAtivo(estado, 'elusivo')) {
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
  // (lote B4, dono 25/10 — D-B4.6) a Lança Crepitante: "ou imediatamente ao teleportar" — o teleporte depois da última conjuração zera
  if (efeito.intensidadeTeleporte && (hunt.teleportes ?? 0) > (i.teleportes ?? 0)) return 0;
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
  (hunt.poeIntensidade ??= {})[id] = { n: Math.min(Math.max(0, Math.round((efeito.intensidadeMax ?? 0) + extra)), n + 1), em: agora, ...(efeito.intensidadeTeleporte ? { teleportes: hunt.teleportes ?? 0 } : {}) };
}
/** (lote 53, o Modo Alfa / Nadir) "Magias têm Chance de Golpe Crítico reduzida/aumentada em X% por Intensidade": o "aumentado" de crítico da magia. */
export function comCriticoDaIntensidade(ficha, intensidade) {
  const pct = ModsPoe.valor(ficha, 'crit_inc_magia_por_intensidade');
  if (!(intensidade > 0) || !pct || !ficha?.critMagiaPoe) return ficha;
  return { ...ficha, critMagiaPoe: { ...ficha.critMagiaPoe, aumentada: ficha.critMagiaPoe.aumentada + pct * intensidade } };
}

/** PoE: a "Duração do Efeito de Habilidades" das peças (com condição: "Habilidades de Armadilha…", o anel do lado certo), em %. */
export function duracaoDasPecas(estado, entry) {
  // (17/10: + a "Duração do Efeito de Habilidades aumentada" da própria gema — a da qualidade — `comAsLinhasDaGema`)
  const f = comAsLinhasDaGema(estado, Ficha.combate(estado), entry);
  return ModsPoe.valor(f, 'duracao_habilidades') + (ModsPoe.somaPorTags(f, tagsPoeDaSkill(entry)).duracao_habilidades ?? 0);
}
/**
 * (13/10) O FATOR da duração de uma habilidade: (1 + o aumentado da gema e das peças) × (1 + "X% mais/menos Duração do Efeito de
 * Habilidades" — `duracao_mais`, que multiplica, como no PoE; antes entrava somado ao aumentado).
 */
// (lote A1b, dono 19/10: `incExtra` — o "aumentado" a mais deste uso, somado aos outros: a Corrida de Fase, "100% de aumento da Duração da Habilidade por
// Carga de Frenesi removida")
export function fatorDeDuracao(estado, entry, efeitoDaGema, incExtra = 0) {
  const f = Ficha.combate(estado);
  const mais = ModsPoe.valor(f, 'duracao_mais') + (ModsPoe.somaPorTags(f, tagsPoeDaSkill(entry)).duracao_mais ?? 0);
  // (lote S1: + o "X% menos Duração" MAIS dos suportes — a Runa Repentina, `duracaoMaisPct`)
  return Math.max(0.1, 1 + ((efeitoDaGema?.duracaoPct ?? 0) + duracaoDasPecas(estado, entry) + incExtra) / 100) * Math.max(0, 1 + mais / 100) * Math.max(0, 1 + (efeitoDaGema?.duracaoMaisPct ?? 0) / 100);
}

/**
 * (lote C2, dono 20/10 — D2.1) O DANO DO TRAUMATISMO em você ("Sofre X de Dano Físico por Traumatismo quando você ganhar Traumatismo"): Físico que não é acerto — sem
 * a Armadura e sem os efeitos de "ser acertado" —, com a redução do Físico recebido da ficha (`fatorDaResistenciaRecebida`) e o Escudo de Energia na frente (salvo o
 * "Dano Físico sofrido ignora o Escudo de Energia"). Pode matar, como no PoE. Devolve o dano na Vida.
 */
function danoDoTraumatismo(estado, hunt, personagem, valor, eventos) {
  if (!(valor > 0) || (estado.hp ?? 0) <= 0 || Protecao.imune(hunt)) return 0;
  const ficha = Ficha.combate(estado);
  const base = { uid: 'player', quem: personagem?.nome, x: hunt.pos.x, y: hunt.pos.y, foe: false, de: 'Traumatismo', golpe: 'Traumatismo' };
  let dano = Math.round(valor * ModsPoe.fatorDaResistenciaRecebida(ficha, 'physical'));
  if (ModsPoe.valor(ficha, 'fisico_ignora_escudo') > 0) Defesa.reiniciarEspera(estado, ficha);
  else dano = Defesa.absorver(estado, ficha, dano, eventos, base);
  if (!(dano > 0)) return 0;
  estado.hp = Math.max(0, (estado.hp ?? 0) - dano);
  eventos.push({ t: 'dmg', ...base, v: dano, color: COR_DO_ELEMENTO.physical ?? '#ff0000' });
  return dano;
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

/**
 * (17/10) A ficha deste USO com as LINHAS LOCAIS da gema do PoE no nível e na qualidade dela — "200% de Poder Arcano", "X% mais Velocidade de
 * Ataque por Carga de Frenesi", a qualidade ("(0 — 20)% de chance de causar Dano Dobrado")… — como condicionais do golpe (`ficha.porTag`):
 * `itens-poe/linhas-das-gemas.mjs`. A mesma ficha fora do PoE, nos buffs e sem linhas.
 */
export function comAsLinhasDaGema(estado, ficha, entry, efeito = undefined) {
  if (!entry?.poeGema || entry.poeGema.buff || !ficha?.afPoe) return ficha;
  const e = efeito === undefined ? Gemas.efeitoNaSkill(estado, entry.id) : efeito;
  const nivel = e?.nivel ?? 1;
  const q = e?.qualidade ?? 0;
  let { af: daGema } = GemasPoe.linhasLocaisNoNivel(entry.poeGema.slug, nivel, q);
  // (lote PR1, revisão: o dano ADICIONAL da própria gema igual a X% da Vida/Mana máxima é dano adicionado da gema — o PoB o multiplica pela Eficácia do Dano
  // Adicionado dela: o Sifão de Poder do Arquimago, damageEffectiveness 0,6 em todo nível (act_int.lua:14219); a Flecha Ardente do Vigor não tem — 1. A linha
  // continua com o número do poedb (`linhasLocaisNoNivel`); o × eficácia é do uso)
  // (revisão do lote da eficácia, 20/10: num ATAQUE o `contaDoDano` já multiplica todo o adicionado — o da gema também — pela eficácia; aqui só fora dos
  // ataques, senão o Raio do Sifão do Arquimago saía × 0,6 × 0,6)
  const efDaGema = entry.poeGema.ataque ? 1 : GemasPoe.eficaciaNoNivel(entry.poeGema.slug, nivel);
  if (efDaGema !== 1) {
    const chaves = Object.keys(daGema).filter((x) => /^added_\w+?_dmg_(?:min|max)%(?:vidaMax|manaMax):1$/.test(x));
    if (chaves.length) { daGema = { ...daGema }; for (const x of chaves) daGema[x] *= efDaGema; }
  }
  // (17/10, lote G3: + as linhas dos SUPORTES que são modificador local do uso — `af:<atributo>` no efeito, de `suportes-poe.efeitoNoNivel`)
  let af = daGema;
  const doSuporte = Object.entries(e ?? {}).filter(([k, v]) => k.startsWith('af:') && typeof v === 'number' && v);
  if (doSuporte.length) {
    af = { ...daGema };
    for (const [k, v] of doSuporte) af[k.slice(3)] = (af[k.slice(3)] ?? 0) + v;
  }
  // (lote A3, dono 19/10 — D1: "o dano com Arcos por habilidade, só o aumentada") "Aumentos e Reduções à Velocidade de Projéteis também se aplicam ao
  // Dano com Arcos" (`dmg_inc%stat:projectile_speed@arco` na soma): a da ficha já vale pela escala; a do USO — a da gema e a dos suportes — entra aqui,
  // o mesmo atributo × o "aumentada" local (o "mais" não entra)
  const velLocal = velocidadeDoProjetil(null, entry, e).localIncPct;
  if (velLocal) {
    for (const [k, v] of Object.entries(ficha.afPoe)) {
      const m = /^([a-z_]+)%stat:projectile_speed((?:@[^%~]+)?)$/.exec(k);
      if (!m || typeof v !== 'number' || !v) continue;
      if (af === daGema) af = { ...daGema };
      af[`${m[1]}${m[2]}`] = (af[`${m[1]}${m[2]}`] ?? 0) + v * velLocal;
    }
  }
  const marca = `${entry.poeGema.slug}@${nivel}@${q}${doSuporte.length ? `|${doSuporte.map(([k, v]) => `${k}=${v}`).join(',')}` : ''}`;
  return LinhasDasGemas.fichaComAsLinhas(estado, ficha, af, marca);
}

/**
 * (lote A5, dono 20/10) O ALCANCE CORPO A CORPO deste uso: o `alcance_corpo_m` da soma + o das linhas da gema e dos suportes ("+2.1 metros ao Alcance de
 * Golpes Corpo a Corpo" — as Lâminas Gélidas; o Decapitar), pela ficha do uso (`comAsLinhasDaGema`, a tag `habilidade` e as da gema). `metrosExtra`:
 * os metros a mais; `casas`: as casas a mais do golpe, como a ficha (`Ficha.alcanceCorpoExtra` — os metros da arma + os a mais, a cada 2 m uma casa).
 */
export function alcanceCorpoDoUso(estado, entry, efeito = undefined) {
  const base = Ficha.combate(estado);
  const f = comAsLinhasDaGema(estado, base, entry, efeito);
  const metrosExtra = ModsPoe.valor(f, 'alcance_corpo_m') + (f !== base && f?.porTag ? ModsPoe.somaPorTags(f, tagsPoeDaSkill(entry)).alcance_corpo_m ?? 0 : 0);
  const casas = itensPoeLigado() ? Math.floor(Ficha.alcanceCorpoEmMetros(estado.equipment?.weapon ?? null, { alcance_corpo_m: metrosExtra }) / 2) : base.alcanceCorpoExtra ?? 0;
  return { metrosExtra, casas };
}

/**
 * (lote A5, dono 20/10 — D7) O dano das ARMAS como Dano Mágico adicional deste uso: a Lâmina Mágica (o suporte — `laminaMagicaPct`; só as armas corpo a corpo
 * de uma mão) e a Detonação da Adaga (a gema — só as adagas). `{ elemento: [min, max] }` (antes da eficácia): o físico de cada arma (a base com os locais e a
 * qualidade — `Ficha.armasEquipadas`) e o elemental somado da própria peça, × o X%; com duas armas que valem, 60% de cada.
 */
const UMA_MAO_CORPO = /^(One_Hand_Axes|One_Hand_Maces|One_Hand_Swords|Thrusting_One_Hand_Swords|Claws|Daggers|Rune_Daggers|Sceptres)$/;
const ADAGAS = /^(Daggers|Rune_Daggers)$/;
export function danoDeArmaNaMagia(estado, entry, efeito) {
  if (!itensPoeLigado() || !entry?.poeGema || entry.poeGema.ataque) return {};
  const armas = Ficha.armasEquipadas(estado);
  const principal = armas.find((a) => a.slot === 'weapon') ?? null;
  const secundaria = armas.find((a) => a.slot === 'shield') ?? null;
  const saida = {};
  const somarArma = (a, f) => {
    const add = (el, x, y) => { if (x > 0 || y > 0) saida[el] = [(saida[el]?.[0] ?? 0) + x, (saida[el]?.[1] ?? 0) + y]; };
    add('physical', a.min * f, a.max * f);
    const af = estado.equipment?.[a.slot]?.poe?.af ?? {};
    for (const el of ['fire', 'ice', 'energy', 'chaos']) add(el, (Number(af[`added_${el}_dmg_min`]) || 0) * f, (Number(af[`added_${el}_dmg_max`]) || 0) * f);
  };
  // (revisão do A5 — como o PoB, CalcOffence.lua:566-579) a Lâmina Mágica exige a mão PRINCIPAL corpo a corpo de uma mão; com uma arma na secundária (de qualquer
  // tipo), 60% de cada, somando as duas
  if (efeito?.laminaMagicaPct > 0 && principal && UMA_MAO_CORPO.test(principal.classe) && !principal.duasMaos) {
    const f = (efeito.laminaMagicaPct / 100) * (secundaria ? 0.6 : 1);
    somarArma(principal, f);
    if (secundaria) somarArma(secundaria, f);
  }
  // a Detonação da Adaga: só as adagas equipadas; com duas, X% de cada (o texto: 60% — o PoB, CalcOffence.lua:898-905, usa 50%)
  const ada = GemasPoe.detonacaoDaAdagaDaGema(entry.poeGema.slug, efeito?.nivel ?? 1);
  if (ada?.pct > 0) {
    const adagas = [principal, secundaria].filter((a) => a && ADAGAS.test(a.classe));
    for (const a of adagas) somarArma(a, (ada.pct / 100) * (adagas.length > 1 ? ada.comDuasPct / 100 : 1));
  }
  return saida;
}

/** (lote A5, dono 20/10) Os atributos LOCAIS deste uso — as linhas da gema no nível e na qualidade + os `af:` dos suportes —, sem os da soma. */
export function afLocalDoUso(entry, efeito) {
  if (!entry?.poeGema) return {};
  const af = { ...GemasPoe.linhasLocaisNoNivel(entry.poeGema.slug, efeito?.nivel ?? 1, efeito?.qualidade ?? 0).af };
  for (const [k, v] of Object.entries(efeito ?? {})) if (k.startsWith('af:') && typeof v === 'number' && v) af[k.slice(3)] = (af[k.slice(3)] ?? 0) + v;
  return af;
}

/** (17/10, lote G17) O "mais Dano <tipo> degenerativo" dos suportes pelo elemento da parte do degenerativo da gema. */
const MAIS_DOT_DO_ELEMENTO = { fire: 'maisDotFogoPct', ice: 'maisDotGeloPct', energy: 'maisDotRaioPct', chaos: 'maisDotCaosPct', physical: 'maisDotFisicoPct' };

// (lote A5c: `elementoSorteado` — o elemento da conversão "em Fogo, Gelo ou Raio" já sorteado para o objeto do uso: o Tornado da Turbulência Elemental)
// (revisão do C1: `semCorpo` — o acerto que NÃO é corpo a corpo de uma gema corpo a corpo: a parte "Area Hit" do Castigo do Julgamento Divino, melee = false no PoB —
// sem a tag `corpo` nos mods condicionais e sem a Força no Físico corpo a corpo)
function contaDoDano(estado, entry, efeitoDaGema, fichaBase = Ficha.combate(estado), armaDoUso = null, { ativada = false, custaVida = false, maisDano = 0, critMais = 0, elementoSorteado = null, semCorpo = false } = {}) {
  fichaBase = comAsLinhasDaGema(estado, fichaBase, entry, efeitoDaGema);
  // PoE: a ficha DESTA habilidade — os mods condicionais pelas tags dela ("Dano em Área", "Chance de Crítico com Habilidades de Fogo"…) e os
  // sorteios do uso (dano dobrado, ignorar a redução física) — `itens-poe/mods-poe.mjs`. Sem o PoE, a mesma ficha. (+ a habilidade ATIVADA por
  // um gatilho — os suportes, as peças, os únicos — leva a tag `ativada`: "Magias ativadas envenenam ao atingir".)
  const tagsDoUso = tagsPoeDaSkill(entry);
  // (+ a tag `custaVida` — a habilidade paga com Vida: "Dano Físico com Habilidades que Custam Vida aumentado em X%")
  const tagsDoGolpe = [...tagsDoUso, ...(ativada && !tagsDoUso.includes('ativada') ? ['ativada'] : []), ...(custaVida ? ['custaVida'] : [])].filter((t) => !semCorpo || t !== 'corpo');
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
  // (17/10, lote G4) As GEMAS DE ESCUDO: a "arma" é o escudo — a base da mão secundária da gema ("X a Y de Dano Físico Base como a Mão
  // Secundária", de Fogo/Gelo nas transfiguradas) — `GemasPoe.escudoDaGema`.
  const escudoDaGema = daGemaPoe?.ataque ? GemasPoe.escudoDaGema(daGemaPoe.slug, nivelPoe) : null;
  // (revisão: a arma da ficha já é a Lâmina — `Ficha.combate`, `laminaNaFicha`: a base sem dano Físico e o Raio como dano adicionado aos ataques. Na
  // gema de ATAQUE o Raio da Lâmina é o golpe da arma — × a eficácia da gema, como a base de qualquer arma no PoE —, e sai do adicionado abaixo)
  const golpeDaLamina = daGemaPoe?.ataque && !escudoDaGema?.base ? laminaDeEnergia(estado, fichaBase) : null;
  const armaDoGolpe0 = golpeDaLamina ?? (escudoDaGema?.base ? { min: escudoDaGema.base.min, max: escudoDaGema.base.max, elemento: escudoDaGema.base.elemento } : armaDoUso ?? fichaBase.damage ?? { min: 1, max: 1 });
  // (PoE: "X% mais Dano Físico Máximo de Ataques" — o máximo da arma no golpe de ataque.)
  const maisNoMaximo = (armaDoGolpe0.elemento ?? 'physical') === 'physical' ? ModsPoe.valor(fichaBase, 'fisico_max_mais') : 0;
  const armaDoGolpe1 = maisNoMaximo ? { ...armaDoGolpe0, max: armaDoGolpe0.max * Math.max(0, 1 + maisNoMaximo / 100) } : armaDoGolpe0;
  // (lote PR4, dono 25/10) o "X% menos Dano Base" do golpe (a explosão da Flecha Explosiva — o baseMultiplier 0,5 do PoB): só a base da arma; o adicionado, não
  const fatorDaBase = Math.max(0, (Number(efeitoDaGema?.basePctDoAtaque) || 100) / 100);
  const armaDoGolpe = fatorDaBase !== 1 ? { ...armaDoGolpe1, min: armaDoGolpe1.min * fatorDaBase, max: armaDoGolpe1.max * fatorDaBase } : armaDoGolpe1;
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
  // (dono, 20/10: "eficácia como no PoE" — no ATAQUE também: o PoB multiplica a arma pelo `baseMultiplier` e todo dano ADICIONADO — peças, passivas,
  // auras, Arautos, suportes, Empalamento, Marca do Caçador — pelo `damageEffectiveness` (CalcOffence.lua, "Calculate base hit damage"); antes, × 1)
  const eficacia = daGemaPoe ? GemasPoe.eficaciaDoAdicionado(daGemaPoe.slug, nivelPoe) : 1;
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
  let semDanoNenhum = false;
  // (lote A5c, dono 20/10: "regra do PoE, no motor inteiro") as ORIGENS de cada parte — o que veio do Físico (convertido ou "como Extra") e das conversões entre
  // elementos guarda os tipos por onde passou (`ModsPoe.somarOrigem`); o `mult` da parte soma o "aumentado" de todos eles, abaixo
  const origens = {};
  if (daGemaPoe) {
    porElemento = {};
    const somar = (el, [a, b], m = 1) => { if (!(a > 0 || b > 0)) return; const x = porElemento[el] ?? [0, 0]; porElemento[el] = [x[0] + a * m, x[1] + b * m]; };
    const doSuporte = {};
    for (const k of Object.keys(efeitoDaGema ?? {})) { const m = k.match(/^somadoMin:(\w+)$/); if (m) doSuporte[m[1]] = [efeitoDaGema[k], efeitoDaGema[`somadoMax:${m[1]}`] ?? efeitoDaGema[k]]; }
    if (daGemaPoe.ataque) {
      const extras = { ...(fichaBase.danoSomado ?? {}) };
      if (golpeDaLamina && extras.energy) extras.energy = [Math.max(0, extras.energy[0] - golpeDaLamina.min), Math.max(0, extras.energy[1] - golpeDaLamina.max)];
      for (const [el, [a, b]] of Object.entries(doSuporte)) extras[el] = [(extras[el]?.[0] ?? 0) + a, (extras[el]?.[1] ?? 0) + b];
      // (revisão do lote da eficácia, 20/10) a Lâmina de Energia e as gemas de escudo não usam a arma da ficha, que é onde está o Físico adicionado global ("Adiciona X a Y
      // de Dano Físico em Ataques"): ele entra aqui, como o adicionado que é (no PoB vale em todo ataque, × o damageEffectiveness)
      if ((golpeDaLamina || escudoDaGema?.base) && fichaBase.fisicoAdicionado) {
        const [a, b] = fichaBase.fisicoAdicionado;
        if (a > 0 || b > 0) extras.physical = [(extras.physical?.[0] ?? 0) + a, (extras.physical?.[1] ?? 0) + b];
      }
      // (dono, 20/10) o dano ADICIONADO ao ataque (o das peças/auras e o dos suportes) × a eficácia do dano adicionado da gema, como no PoE
      for (const el of Object.keys(extras)) extras[el] = [extras[el][0] * eficacia, extras[el][1] * eficacia];
      // (lote G4) "X a Y de Dano Adicional por cada 15 de Armadura (ou Evasão) no Escudo": × as defesas do escudo vestido, × a eficácia do ataque
      // (o dano adicionado do ataque escala com o "Dano de Ataque X% de base", como a base)
      if (escudoDaGema?.porDefesa?.length) {
        const de = defesaDaPecaVestida(estado.equipment?.shield) ?? { armadura: 0, evasao: 0 };
        const ef = GemasPoe.eficaciaNoNivel(daGemaPoe.slug, nivelPoe);
        for (const x of escudoDaGema.porDefesa) {
          const n = Math.floor(Math.max(0, x.defesa === 'armEva' ? (de.armadura ?? 0) + (de.evasao ?? 0) : de[x.defesa] ?? 0) / Math.max(1, x.por));
          if (n > 0) extras[x.elemento] = [(extras[x.elemento]?.[0] ?? 0) + x.min * n * ef, (extras[x.elemento]?.[1] ?? 0) + x.max * n * ef];
        }
      }
      // PoE: o Físico como Caos/Fogo extra e as conversões das outras fontes (`ModsPoe.extrasDoFisico`).
      // (lote A5c, dono 20/10: a mesma ordem das magias — a conversão da GEMA primeiro, as das outras fontes só no Físico que sobrou, proporcionais se passarem
      // dele, e o "como Extra" sobre o Físico de antes da conversão, todo o Físico do golpe; antes saíam da arma crua, sem a eficácia, e a gema convertia o resto)
      const outras = (fis, teto) => ModsPoe.extrasDoFisico(fichaBase, fis, Math.random, teto);
      for (const [el, v] of Object.entries(GemasPoe.partesDoAtaque(daGemaPoe.slug, nivelPoe, { min: armaDoGolpe.min, max: armaDoGolpe.max, elemento: armaDoGolpe.elemento ?? 'physical' }, extras, Math.random, { outras, origens, escolhido: elementoSorteado, conversoesExtras: GemasPoe.conversoesDosSuportes(efeitoDaGema) }))) somar(el, v);
    } else {
      // (lote A5c, dono 20/10: "corrigir como o PoE") o adicionado vai JUNTO com o dano da gema para `GemasPoe.partesDaMagia`, que converte o Físico de
      // tudo — a conversão da gema, depois a das outras fontes (`ModsPoe.extrasDoFisico`, só no que a gema deixou) e o Físico como Extra —, como nos ataques
      const adicionado = {};
      const adicionar = (el, [a, b], m = 1) => { if (!(a > 0 || b > 0)) return; const x = adicionado[el] ?? [0, 0]; adicionado[el] = [x[0] + a * m, x[1] + b * m]; };
      // (lote 32, P071: o dano ADICIONADO às magias das peças e do Mago de Batalha — de todo tipo, não só dos elementos da magia ("Adiciona X a Y de
      // Dano de Fogo às Magias" vale numa magia de Gelo), × a eficácia do dano adicionado, como o dos suportes)
      for (const [el, v] of Object.entries(fichaBase.danoSomadoMagia ?? {})) adicionar(el, v, eficacia);
      for (const [el, v] of Object.entries(doSuporte)) adicionar(el, v, eficacia);
      // (14/10, o Feiticeiro: "Dano Mágico Adicional igual a X% do Dano da Varinha Equipada" — cada elemento da varinha, × a eficácia do dano
      // adicionado, como o dos suportes)
      if (efeitoDaGema?.feiticeiro) {
        const f = GemasPoe.feiticeiroNoNivel(efeitoDaGema.feiticeiro.nivel);
        for (const [el, [a, b]] of Object.entries(fichaBase.danoDasVarinhas ?? {})) adicionar(el, [(a * f.pct) / 100, (b * f.pct) / 100], eficacia);
      }
      // (lote A5, dono 20/10 — D7) a Lâmina Mágica ("Dano Mágico Adicional igual a X% do Dano das Armas Corpo a Corpo de Uma Mão Equipadas", 60% de cada com
      // duas) e a Detonação da Adaga ("X% do dano da adaga equipada", 60% de cada com duas): o dano de cada arma que vale — a base com os locais e a qualidade, e
      // o elemental somado da própria peça —, × a eficácia do dano adicionado, como o do Feiticeiro
      for (const [el, v] of Object.entries(danoDeArmaNaMagia(estado, entry, efeitoDaGema))) adicionar(el, v, eficacia);
      // (lote PR2, dono 20/10) o Ritual Proibido ("Causa X% do seu máximo de Vida / Escudo de Energia como Dano de Caos base") e a Barganha Sombria sem
      // Esqueleto ("Usa sua Vida": X% da Vida máxima) — o PoB soma no ChaosMin e no ChaosMax da gema: é dano BASE, sem a Eficácia do Dano Adicionado
      const doRecurso = baseDoRecursoNoUso(estado, daGemaPoe.slug, nivelPoe, efeitoDaGema, fichaBase);
      if (doRecurso > 0) adicionar('chaos', [doRecurso, doRecurso]);
      // (lote B1: + `basePor` — a Descarga, o dano base de cada elemento × as cargas do tipo dele; o adicionado não multiplica)
      const daMagia = GemasPoe.partesDaMagia(daGemaPoe.slug, nivelPoe, adicionado, { elementoSorteado, origens, outras: (fis, teto) => ModsPoe.extrasDoFisico(fichaBase, fis, Math.random, teto), basePor: efeitoDaGema?.danoBasePor ?? null, baseExtra: efeitoDaGema?.danoBaseExtra ?? null, conversoesExtras: GemasPoe.conversoesDosSuportes(efeitoDaGema) });
      for (const [el, v] of Object.entries(daMagia)) somar(el, v);
    }
    // PoE (únicos): as conversões entre elementos, os ganhos extras e a máscara de dano ("Não Causa Dano Elemental"…).
    porElemento = ModsPoe.transformarPartes(fichaBase, porElemento, origens);
    // (revisão do A5) "Habilidades Suportadas não causam Dano Elemental / de Caos" (a Manipulação do Vazio): sai só a parte daquele tipo; sem nada, o golpe não fere
    if (porElemento && (efeitoDaGema?.semDanoElemental || efeitoDaGema?.semDanoCaos)) {
      const tinha = Object.keys(porElemento).length;
      for (const el of efeitoDaGema.semDanoElemental ? ['fire', 'ice', 'energy'] : []) delete porElemento[el];
      if (efeitoDaGema.semDanoCaos) delete porElemento.chaos;
      if (tinha && !Object.keys(porElemento).length) { porElemento = { physical: [0, 0] }; semDanoNenhum = true; }
    }
    // (17/10, lote G17) a Volatilidade: "X% mais Dano Máximo de Ataque" e "Y% menos Dano Mínimo de Ataque" — as pontas da faixa de cada parte (o
    // mínimo não passa do máximo)
    if (daGemaPoe.ataque && porElemento && (efeitoDaGema?.maisMaxAtaquePct || efeitoDaGema?.maisMinAtaquePct)) {
      for (const el of Object.keys(porElemento)) {
        const [a, b] = porElemento[el];
        const b2 = b * Math.max(0, 1 + (efeitoDaGema.maisMaxAtaquePct ?? 0) / 100);
        porElemento[el] = [Math.min(b2, a * Math.max(0, 1 + (efeitoDaGema.maisMinAtaquePct ?? 0) / 100)), b2];
      }
    }
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
  // (17/10, lote G4) "+0,1% de Chance de Golpe Crítico da Mão Secundária por cada 10 de Escudo de Energia Máximo no Escudo" (as gemas de escudo).
  if (escudoDaGema?.critPorEs) {
    const es = (defesaDaPecaVestida(estado.equipment?.shield) ?? {}).escudo ?? 0;
    const pontos = (escudoDaGema.critPorEs.pct * Math.floor(Math.max(0, es) / Math.max(1, escudoDaGema.critPorEs.por))) / 100;
    if (pontos > 0) ficha = { ...ficha, critChance: Math.min(1, (ficha.critChance ?? 0) + pontos) };
  }
  // (17/10, lote G10) "X% mais Chance de Golpe Crítico por cada Estágio" (as Lâminas Velozes da Incisão): × os estágios deste uso
  if (critMais) ficha = { ...ficha, critChance: Math.min(ficha.critTeto ?? 1, (ficha.critChance ?? 0) * Math.max(0, 1 + critMais / 100)) };
  // (A proficiência de arma saiu — dono, 06/10: o "% da perícia como dano" e o crítico de runa dela não existem mais.)
  const daPericia = 0;
  // O treino em %: magic level (mágicas), melee (físicas de perto), distance (físicas de longe).
  const doTreino = defDaGema ? Gemas.bonusDoTreino(estado, defDaGema, fichaBase) : fichaBase.skillBonus?.magic ?? 0;
  // A gema: o crítico das supports soma na chance/dano; o nível e as supports multiplicam o dano.
  if (efeitoDaGema?.critChance || efeitoDaGema?.critDano) ficha = { ...ficha, critChance: ficha.critChance + (efeitoDaGema.critChance ?? 0) / 100, critMultiplier: ficha.critMultiplier + (efeitoDaGema.critDano ?? 0) / 100 };
  // (14/10, o Feiticeiro: "Habilidades Suportadas causam X% menos Dano com Acertos e Afecções")
  const menosDoFeiticeiro = efeitoDaGema?.feiticeiro && daGemaPoe ? Math.max(0, 1 - GemasPoe.feiticeiroNoNivel(efeitoDaGema.feiticeiro.nivel).menos / 100) : 1;
  // (14/10, as Miragens Suspensas: "Habilidades usadas por Miragens Suspensas causam X% menos Dano" — `maisDano` do gatilho)
  // (17/10, lote G18) o "mais Dano" SÓ DO ACERTO da ficha (`mais_dano_acerto` — o Fogo Justo: "Concede X% mais Dano Mágico", só no acerto das magias,
  // como no PoB): no fator do acerto; o `acertar` o tira da afecção e o degenerativo da gema sai sem ele (`soAcertoDaFicha`)
  const soAcertoDaFicha = itensPoeLigado() ? Math.max(0, 1 + ModsPoe.valor(fichaBase, 'mais_dano_acerto') / 100) : 1;
  // (lote PR2, dono 20/10) a Barganha Sombria: "X% mais Dano com Acertos e Afecções se usar sua Vida" (o MORE do PoB com Hit e Ailment — o golpe inteiro)
  const daBarganha = daGemaPoe && !daGemaPoe.ataque ? maisDaBarganhaNoUso(estado, daGemaPoe.slug, nivelPoe, efeitoDaGema) : 1;
  const fatorDaGema = daBarganha * (semDanoNenhum ? 0 : 1) * (1 + (efeitoDaGema?.danoPct ?? 0) / 100) * (efeitoDaGema?.fatorDeDano ?? 1) * menosDoFeiticeiro * Math.max(0, 1 + (Number(maisDano) || 0) / 100) * soAcertoDaFicha;
  // Os REFORÇOS ligados (posturas, raiva...): dano, crítico e treino nas skills com as tags deles.
  const tags = Tags.tagsDaAcao(entry).filter((t) => !semCorpo || t !== 'melee');
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
  // (lote S1, 26/10) a Empunhadura de Ferro: o Bônus de Dano da Força também no Dano de Ataque dos Projéteis do uso suportado (como a passiva — `forca_em_projeteis`)
  const forcaVale = Ficha.forcaNoGolpe(ficha, tags) || (efeitoDaGema?.forcaEmProjeteis > 0 && ehAtaqueDoPoe && tagsPoeDaSkill(entry).includes('projetil'));
  const doElemento = (ficha.danoDoElemento?.[entry.element] ?? 0) - (daGemaPoe && entry.element === 'physical' && !forcaVale ? ficha.danoFisicoDaForca ?? 0 : 0);
  const afinidade = entry.poeGema ? 0 : Ficha.afinidadePara(ficha, tags).pct;
  // (lote S1, 26/10) a Vontade de Ferro: "Bônus de dano da Força também é aplicado à todo Dano Mágico" — o "aumentado" da Força em todo o dano da magia suportada
  const forcaNaMagia = ehMagia && efeitoDaGema?.forcaEmMagias > 0 ? ficha.danoFisicoDaForca ?? 0 : 0;
  const mult = (1 + ((ficha.danoDeMagia ?? 0) + (ehMagia ? ficha.danoDeMagiaDoPoe ?? 0 : 0) + doElemento + (daGema?.dano ?? 0) + treino + doReforco + afinidade + forcaNaMagia) / 100) * sintonia;
  // O multiplicador de CADA elemento da gema do PoE: o mesmo `mult`, trocando o "aumentado" do elemento da skill pelo da parte.
  const doElementoDe = (el) => (ficha.danoDoElemento?.[el] ?? 0) - (el === 'physical' && !forcaVale ? ficha.danoFisicoDaForca ?? 0 : 0);
  // (lote A5c, dono 20/10: "regra do PoE") a parte que passou por mais de um tipo (o Físico convertido em Gelo, o Fogo ganho como Caos…) soma o "aumentado" de
  // todos eles, uma vez cada, e os "mais" dos tipos do caminho que não são o final (`ModsPoe.maisDaOrigem` — o do final entra no acerto); a faixa rola com o
  // fator médio das origens dela (`ModsPoe.fatorPelasOrigens`). A penetração, a resistência e as afecções seguem o tipo final.
  const multDosTipos = (tipos, final) => (mult + ((tipos.reduce((t, x) => t + doElementoDe(x), 0) - doElemento) / 100) * sintonia) * ModsPoe.maisDaOrigem(ficha, hunt, entry.id, tipos, final);
  if (partes) for (const p of partes) p.mult = ModsPoe.fatorPelasOrigens(origens[p.elemento], p.elemento, (tipos) => multDosTipos(tipos.length ? tipos : [p.elemento], p.elemento));
  // (13/10, a Sobrecarga Elemental: "Habilidades que causaram um Golpe Crítico nos últimos 8 segundos causam 40% mais Dano Elemental" — a parte
  // de Fogo, Gelo e Raio desta habilidade, se ela critou há pouco; + 14/10, o "X% mais Dano Elemental" do Liberto: `ModsPoe.fatorDoDanoElemental`.)
  // (lote A5c: o "mais Dano Elemental" agora vai em `multDosTipos` — uma vez, pelo caminho da parte)
  // (`sobrecarga`, à parte do `mult` — que é a base do "aumentado" por projétil: o golpe sem partes e o balão multiplicam por ele)
  const sobrecarga = ModsPoe.fatorDoDanoElemental(ficha, hunt, entry.id, entry.element);
  // "X% mais Dano por cada tipo de Afecção Elemental no Inimigo" (Acerto Elemental do Espectro).
  const porAfeccao = daGemaPoe ? GemasPoe.extrasDoAtaque(daGemaPoe.slug, nivelPoe, efeitoDaGema?.qualidade ?? 0).porAfeccao : 0;
  // (lote 31, P043: o multiplicador da parte Física e a eficácia do dano adicionado — o Físico adicional por Empalamento, alvo a alvo)
  const multFisico = (mult + ((doElementoDe('physical') - doElemento) / 100) * sintonia) * ModsPoe.fatorDoDanoElemental(ficha, hunt, entry.id, 'physical');
  return { min, max, daPericia, mult, sobrecarga, fatorDaGema, ficha, partes, porAfeccao, ehMagia, sintonia, multFisico, eficacia, soAcertoDaFicha, multDosTipos };
}

/*
 * ---- (lote PR2, dono 20/10) o RECURSO no uso: a Vida e o Escudo de Energia (`itens-poe/gemas-pr2.mjs`) ----
 */
/** Algum Esqueleto seu vivo a até `alcance` casas de você ou de `alvo` (sem `alcance`: em qualquer lugar da caçada) — a Barganha Sombria. */
function esqueletoPerto(hunt, alvo = null, alcance = null) {
  return (hunt?.lacaios ?? []).some((l) => l.hp > 0 && GemasPR2.ehEsqueleto(l) && (alcance == null || distanciaChebyshev(l, hunt.pos) <= alcance || (alvo && distanciaChebyshev(l, alvo) <= alcance)));
}
/**
 * (lote E1b, dono 26/10 — como o PoB, DarkPact "Cast on Skeleton") a Barganha Sombria COM Esqueleto: o Esqueleto vivo mais perto do alvo (ou de você) no alcance da gema
 * e a cadeia aos Esqueletos seguintes (2 — number_of_chains), cada um a até `BARGANHA.cadeiaCasas` do anterior. Cada um sacrifica X% da Vida MÁXIMA dele (sem morrer)
 * e causa o acerto da gema na área em volta dele (2,6 m — radius 26), com a Vida sacrificada como Caos base a mais (`baseDoRecursoNoUso`).
 */
export const BARGANHA = Object.freeze({ cadeia: 2, cadeiaCasas: 3, raioM: 2.6 });
function esqueletosDaBarganha(hunt, alvo, alcance) {
  const vivos = (hunt?.lacaios ?? []).filter((l) => l.hp > 0 && GemasPR2.ehEsqueleto(l));
  const ref = alvo ?? hunt?.pos;
  const perto = (a, b) => distanciaChebyshev(a, ref) - distanciaChebyshev(b, ref);
  const primeiro = vivos.filter((l) => distanciaChebyshev(l, hunt.pos) <= alcance || (alvo && distanciaChebyshev(l, alvo) <= alcance)).sort(perto)[0];
  if (!primeiro) return [];
  const lista = [primeiro];
  while (lista.length < 1 + BARGANHA.cadeia) {
    const ult = lista[lista.length - 1];
    const prox = vivos.filter((l) => !lista.includes(l) && distanciaChebyshev(l, ult) <= BARGANHA.cadeiaCasas).sort((a, b) => distanciaChebyshev(a, ult) - distanciaChebyshev(b, ult))[0];
    if (!prox) break;
    lista.push(prox);
  }
  return lista;
}
/** A Barganha Sombria usa a SUA Vida neste uso (sem Esqueleto vivo em alcance): o que o `disparar` decidiu (`barganhaComVida`) ou, no balão, nenhum vivo. */
const barganhaComVida = (estado, efeito) => (efeito?.barganhaComVida ?? !esqueletoPerto(estado?.hunt));
/** O dano de Caos BASE a mais do uso pela Vida e pelo Escudo de Energia máximos (o Ritual Proibido; a Barganha Sombria com a sua Vida). */
function baseDoRecursoNoUso(estado, slug, nivel, efeito, ficha) {
  if (!itensPoeLigado()) return 0;
  const ritual = GemasPoe.ritualDaGema(slug, nivel);
  if (ritual) return GemasPR2.baseDoRitual(ritual, estado.maxHp ?? 0, ficha?.energyShield ?? 0);
  const b = GemasPoe.barganhaDaGema(slug, nivel, efeito?.qualidade ?? 0);
  if (b && efeito?.barganhaVidaEsqueleto > 0) return (efeito.barganhaVidaEsqueleto * b.vidaPct) / 100;
  return b && barganhaComVida(estado, efeito) ? ((estado.maxHp ?? 0) * b.vidaPct) / 100 : 0;
}
/** O "X% mais Dano com Acertos e Afecções se usar sua Vida" da Barganha Sombria neste uso (o fator; 1 com Esqueleto). */
function maisDaBarganhaNoUso(estado, slug, nivel, efeito) {
  const b = itensPoeLigado() ? GemasPoe.barganhaDaGema(slug, nivel, efeito?.qualidade ?? 0) : null;
  return b && barganhaComVida(estado, efeito) ? Math.max(0, 1 + b.maisPct / 100) : 1;
}
/**
 * O Ritual Proibido FERE você a cada conjuração (D1 do dono: pela resistência a Caos, como o PoB, e pode matar): `GemasPR2.danoEmVoceDoRitual` com o que passa
 * da resistência a Caos e dos "dano sofrido" (`ModsPoe.fatorDaResistenciaRecebida`); o Caos atravessa o Escudo de Energia, como no PoE (salvo "X% do dano de
 * caos sofrido não ignora o escudo de energia"), e a espera da recarga reinicia. Devolve o dano na Vida.
 */
function ritualEmVoce(estado, hunt, personagem, slug, nivel, eventos) {
  const r = GemasPoe.ritualDaGema(slug, nivel);
  if (!r) return 0;
  const ficha = Ficha.combate(estado);
  let dano = GemasPR2.danoEmVoceDoRitual(r, estado.maxHp ?? 0, ficha.energyShield ?? 0, ModsPoe.fatorDaResistenciaRecebida(ficha, 'chaos'));
  if (!(dano > 0)) return 0;
  const base = { uid: 'player', quem: personagem?.nome, x: hunt.pos.x, y: hunt.pos.y, foe: false, de: personagem?.nome, golpe: 'Ritual Proibido' };
  dano = Defesa.absorverComOCaos(estado, ficha, dano, dano, eventos, base);
  if (!(dano > 0)) return 0;
  estado.hp = Math.max(0, (estado.hp ?? 0) - dano);
  eventos.push({ t: 'dmg', ...base, v: dano, color: COR_DO_ELEMENTO.chaos ?? '#b44dff' });
  return dano;
}
/**
 * Os COMPOSTOS gastam as cargas dos frascos (D4 do dono: sem carga, sai sem o bônus): o Venenoso, do PRIMEIRO Frasco de Vida do cinto que paga ao menos um
 * projétil; o Explosivo, de um frasco de cada tipo (Rubi, Safira, Topázio — o primeiro de cada que paga). Cada projétil gasta o seu; o bônus do uso vai ×
 * (pagos ÷ projéteis) — a exceção 4. Devolve o efeito da gema com o bônus (`GemasPR2.bonusDoComposto`), ou o mesmo efeito.
 */
export function comOsFrascosDoComposto(estado, entry, efeito, nProjeteis) {
  const c = GemasPoe.compostoDaGema(entry.poeGema.slug, efeito?.nivel ?? 1, efeito?.qualidade ?? 0);
  if (!c || !efeito) return efeito;
  const afp = Ficha.combate(estado).afPoe ?? {};
  const n = Math.max(1, Math.round(nProjeteis) || 1);
  const cinto = FrascosPoe.cinto(estado);
  const gastar = (filtro) => {
    for (const p of cinto) {
      if (!p?.poe || !filtro(p)) continue;
      const par = FrascosPoe.parametros(p, afp);
      const { pagos, gastas } = GemasPR2.pagosPeloFrasco(FrascosPoe.cargasDe(p, par), c.cargas, n);
      if (!(pagos > 0)) continue;
      p.poe.cargas = Math.max(0, FrascosPoe.cargasDe(p, par) - gastas);
      return { fracao: pagos / n, recuperacao: par.quantidade };
    }
    return null;
  };
  const base = (p) => String(p.poe.base ?? '').split('/').pop();
  let pagos;
  if (c.tipo === 'vida') pagos = { vida: gastar((p) => p.poe.classe === 'Life_Flasks') };
  else pagos = Object.fromEntries(Object.entries(GemasPR2.FRASCO_DO_TIPO).map(([tipo, b]) => [tipo, gastar((p) => base(p) === b)?.fracao ?? 0]));
  const af = GemasPR2.bonusDoComposto(c, pagos);
  if (!Object.keys(af).length) return efeito;
  const e = { ...efeito };
  for (const [k, v] of Object.entries(af)) e[k] = (Number(e[k]) || 0) + v;
  return e;
}

/**
 * (lote PR2, dono 20/10 — D2) o DRENO dos debuffs do Drenar Essência no tique (`cacadas`, depois dos pulsos — `Dot.tique` junta em `hunt.drenoDosDebuffs`): a
 * Vida regenerada ("Regenera X% do Dano do Debuff como Vida" — salvo o "Não pode Recuperar Vida fora o Dreno" do Pacto Vaal) e a perda do Desespero ("Perca
 * Vida e Escudo de Energia igual a X% do Dano do Debuff" — a perda por segundo do jogo: não mata, exceção 2). O que sobra da fração fica para o próximo.
 */
export function drenoDosDebuffs(estado, hunt, personagem, eventos) {
  const r = hunt?.drenoDosDebuffs;
  if (!r) return;
  delete hunt.drenoDosDebuffs;
  if (!(estado.hp > 0)) return;
  const resto = (hunt.drenoResto ??= { vida: 0, perda: 0 });
  resto.vida += r.vida;
  resto.perda += r.perda;
  const vida = Math.floor(resto.vida);
  const perda = Math.floor(resto.perda);
  resto.vida -= vida;
  resto.perda -= perda;
  const ficha = Ficha.combate(estado);
  if (vida > 0 && !ModsPoe.vidaSoPeloDreno(ficha.afPoe)) {
    const antes = estado.hp;
    estado.hp = Math.min(estado.maxHp ?? estado.hp, estado.hp + vida);
    if (estado.hp > antes) eventos?.push({ t: 'heal', uid: 'player', quem: personagem?.nome, x: hunt.pos.x, y: hunt.pos.y, v: estado.hp - antes, color: '#00ff66' });
  }
  if (perda > 0) {
    estado.hp = Math.max(1, estado.hp - perda);
    if ((estado.es ?? 0) > 0) estado.es = Math.max(0, estado.es - perda);
  }
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
 * a área da queda (a casa e as vizinhas) cresce com a "Área de Efeito aumentada/mais", como toda área — `ModsPoe.casasPelaArea`.) (Lote A5d: e
 * cada acerto rola a PRECISÃO contra a evasão do bicho — `Defesa.errou`; o erro não dá dano.)
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
  // (revisão do lote da eficácia, 20/10 — o PoB: TriggeredMoltenStrike, baseMultiplier = damageEffectiveness 1,7 → 2) o golpe da arma × o Dano de Ataque do nível e
  // o dano ADICIONADO aos ataques (peças, auras, Arautos: `ficha.danoSomado`) × a mesma eficácia; os 60% do Físico (o da arma e o adicionado) em Fogo. Antes, só a arma
  const ef = danoPct / 100;
  const partes = { physical: media * ef };
  for (const [el, [a, b]] of Object.entries(ficha.danoSomado ?? {})) partes[el] = (partes[el] ?? 0) + ((a + b) / 2) * ef;
  const conv = (partes.physical * RAJADA.conversaoFogoPct) / 100;
  partes.physical -= conv;
  partes.fire = (partes.fire ?? 0) + conv;
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
      // (lote A5d, dono 20/10: "como no PoE") a Rajada é um ATAQUE: cada acerto rola a precisão (a da ficha do golpe, pelas tags dele) contra a evasão
      // do bicho, pela conta do golpe básico (`Defesa.errou`: a Técnica Resoluta, o "não podem ser Evadidos", os Provocados). Errou: o evento do erro, sem dano
      if (Defesa.errou(ficha, hunt, m, rng)) {
        eventos.push({ t: 'block', uid: m.uid, x: m.x, y: m.y, color: '#999999', esquiva: true, errou: true, fonte: 'rajada-vulcanica' });
        continue;
      }
      const crit = critou();
      const v = Math.round(Object.entries(partes).reduce((t, [el, d]) => t + (d > 0 ? resistido(hunt, m, el, d * aum(el), ficha) : 0), 0) * (crit ? ficha.critMultiplier ?? 1.5 : 1));
      if (!(v > 0)) continue;
      m.hp -= v;
      QuemFeriu.carimbar(m, QuemFeriu.VOCE, ['ataque', 'projetil', 'area', 'fogo', 'fisico']); // (lote 31, S001/P025)
      total += v;
      eventos.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v, foe: true, crit, alvo: m.name, color: COR_DO_ELEMENTO.fire ?? '#ff9000' });
    }
  }
  return total;
}

/*
 * ---- (lote 81) os ACERTOS dos ARAUTOS (dono: "As duas coisas" — o Mensageiro Solitário pede; como o PoE/PoB) ----
 * A explosão do Arauto Glacial (o inimigo que você Estilhaça explode) e — lote 82 — a tempestade do Trovejante são ACERTOS da gema do Arauto:
 * o dano no nível dela (`GemasPoe.danoNoNivel`), com a ficha do golpe pelas TAGS da gema SEM "magia" (o PoB: `baseFlags` sem `spell` — "Este
 * dano não é afetado por modificadores de dano mágico"; o "adicionado às magias" também não entra), os suportes ligados a ela (o aumentado e o
 * "mais"), o crítico só pelo crítico-base fixo ("+X% de Chance de Golpe Crítico de Habilidades Arauto" — a gema não tem crítico), a resistência,
 * os eventos "ao acertar" e as afecções. A queima do Arauto das Cinzas é DANO DEGENERATIVO (não acerto): `queimaduraDoArautoDasCinzas`.
 */
const ARAUTO_GLACIAL = 'poe-gema:Herald_of_Ice';
const ARAUTO_DAS_CINZAS = 'poe-gema:Herald_of_Ash';
/** O buff do Arauto `id` está ligado? */
const arautoLigado = (hunt, id) => { const b = hunt?.buffs?.[id]; return !!b && b.tipo === 'poe-arauto' && b.ate > (hunt.clock ?? 0); };
/** (revisão do lote da eficácia, 20/10) O golpe da ARMA da ficha sem o Físico adicionado global (`ficha.fisicoAdicionado`, que o acerto de ataque leva à parte). */
const armaSemAdicionado = (ficha) => { const d = ficha?.damage ?? { min: 1, max: 1 }; const [a, b] = ficha?.fisicoAdicionado ?? [0, 0]; return { min: Math.max(0, d.min - a), max: Math.max(0, d.max - b) }; };
/** As tags dos acertos (e da queima) do Arauto: as da gema, sem "magia" (+ `extra`). */
const tagsDoArauto = (entry, extra = []) => [...new Set([...tagsPoeDaSkill(entry).filter((t) => t !== 'magia' && t !== 'naoCanalizar'), 'arauto', ...extra])];
/**
 * Um ACERTO do Arauto `id` no bicho `m`: `bruto` (o dano no nível, antes dos aumentos) do `elemento`. `semEletrizar`: a tempestade "Não Pode
 * aplicar Eletrizar". Devolve o dano dado.
 */
export function acertoDoArauto(estado, hunt, id, m, bruto, elemento, { tags = null, eventos = [], rng = Math.random, semEletrizar = false, fonte = null, personagem = null, critBase = 0, afeccoesExtra = null, ataque = false, adicionado = null, adicionadoMagia = null, conversaoFisico = null } = {}) {
  const entry = POR_ID.get(id);
  if (!entry || !m || !(m.hp > 0) || m.dummy || !(bruto > 0)) return 0;
  const agora = hunt.clock ?? 0;
  const fichaBase = Ficha.combate(estado);
  const t = tags ?? tagsDoArauto(entry);
  const ef = Gemas.efeitoNaSkill(estado, id);
  const f = ModsPoe.fichaDoGolpe(fichaBase, t, { alvo: m, estado });
  // (lote A5b, dono 20/10) o acerto de ATAQUE que sai por aqui (a Onda de Choque e a Tormenta das Excepcionais do Vazio, a explosão da Torre Óssea) rola o
  // acerto como as gemas de ataque: a precisão do uso (as linhas da gema e dos suportes, a tag `habilidade`) contra a evasão do alvo. Errou: o evento do erro
  // e `null` (quem chama não o conta como acertado). Os Arautos e a Onda Arcana (sem `ataque`) não rolam
  if (ataque && itensPoeLigado()) {
    const doUso = ModsPoe.fichaDoGolpe(comAsLinhasDaGema(estado, fichaBase, entry, ef), [...new Set(['habilidade', ...t])], { alvo: m, estado });
    if (Defesa.errou(doUso, hunt, m)) {
      eventos.push({ t: 'block', uid: m.uid, x: m.x, y: m.y, color: '#999999', esquiva: true, errou: true });
      return null;
    }
  }
  const doSuporte = (1 + (ef?.danoPct ?? 0) / 100) * (ef?.fatorDeDano ?? 1);
  /*
   * (revisão do lote da eficácia, 20/10) o ACERTO DE ATAQUE daqui (a Onda de Choque e a Tormenta do Vazio, a explosão da Torre Óssea — `adicionado`: o "mais" do uso
   * sobre o dano adicionado, sem o "Dano de Ataque X% de base"): como no `contaDoDano`, o golpe da arma (`bruto`, já × o X% de base) + o dano ADICIONADO aos ataques
   * — o Físico global (`ficha.fisicoAdicionado`), o elemental das peças/auras/Arautos (`danoSomado`, com o do alvo) e o dos suportes (`somadoMin:<el>`) —, × a
   * eficácia do dano adicionado (1: o PoB não tem a destas habilidades, `damageEffectiveness or 1`), as conversões entre tipos, e o "aumentado" de cada parte.
   * Antes: só o Físico da arma (o adicionado elemental sumia; o Físico global saía × o X% de base)
   */
  let partes = null;
  // (lote G-B, dono 25/10: + a MAGIA que sai por aqui com a Eficácia do Dano Adicionado — a Onda Arcana do Cajado Impregnado, 450%: `adicionadoMagia`, o dano adicionado às
  // magias das peças e dos suportes × a eficácia; lote G-D: + a conversão própria do golpe — a Combustão do Clamor Infernal, 60% do Físico em Fogo: `conversaoFisico`)
  if (itensPoeLigado() && ((ataque && adicionado != null) || adicionadoMagia != null)) {
    const rolar = ([a, b]) => a + rng() * Math.max(0, b - a);
    const p = { [elemento]: bruto };
    const fator = adicionadoMagia ?? adicionado;
    const somar = (el, faixa) => { const v = rolar(faixa) * fator; if (v > 0) p[el] = (p[el] ?? 0) + v; };
    if (adicionadoMagia == null && fichaBase.fisicoAdicionado) somar('physical', fichaBase.fisicoAdicionado);
    for (const [el, faixa] of Object.entries((adicionadoMagia != null ? fichaBase.danoSomadoMagia : f.danoSomado) ?? {})) somar(el, faixa);
    for (const k of Object.keys(ef ?? {})) { const x = /^somadoMin:(\w+)$/.exec(k); if (x) somar(x[1], [ef[k], ef[`somadoMax:${x[1]}`] ?? ef[k]]); }
    for (const [para, pct] of Object.entries(conversaoFisico ?? {})) { const v = ((p.physical ?? 0) * Math.min(100, pct)) / 100; if (v > 0) { p.physical -= v; p[para] = (p[para] ?? 0) + v; } }
    const transformadas = ModsPoe.transformarPartes(f, Object.fromEntries(Object.entries(p).map(([el, v]) => [el, [v, v]])), null) ?? {};
    partes = Object.entries(transformadas).map(([el, [v]]) => ({ el, v: v * Math.max(0, 1 + (f.danoDoElemento?.[el] ?? 0) / 100) * ModsPoe.fatorDoDanoElemental(f, hunt, id, el) * doSuporte })).filter((x) => x.v > 0);
  }
  const comAumento = partes ? partes.reduce((t, x) => t + x.v, 0) : bruto * Math.max(0, 1 + (f.danoDoElemento?.[elemento] ?? 0) / 100) * ModsPoe.fatorDoDanoElemental(f, hunt, id, elemento) * doSuporte;
  // o crítico: a gema não tem — só o "+X% de Chance de Golpe Crítico" fixo das tags, × os "aumentados"
  const porTag = ModsPoe.somaPorTags(fichaBase, t);
  const nunca = ModsPoe.valor(f, 'nunca_critico') > 0;
  // (+ o crítico dos suportes ligados à gema — como nas habilidades: a chance e o multiplicador somados no fim)
  // (lote A2: + o crítico BASE de quem tem — a Onda Arcana, 6%)
  const chance = Math.min(f.critTeto ?? 1, Math.max(0, (((porTag.crit_chance ?? 0) + critBase) / 100) * (1 + ((fichaBase.critInc ?? 0) + (porTag.crit_chance_inc ?? 0)) / 100) + (ef?.critChance ?? 0) / 100));
  const crit = !nunca && (ModsPoe.valor(f, 'critico_sempre') > 0 || (chance > 0 && ModsPoe.sorteado(chance, ModsPoe.valor(f, 'critico_sortudo'), ModsPoe.valor(f, 'critico_azarado'), rng, ModsPoe.valor(f, 'sorte_tres_jogadas') > 0)));
  // (o "mais Dano com Acertos" — `mais_dano@arauto`, o Mensageiro Solitário — está em `fatorDasCargas`: só no acerto, não nas afecções)
  // (+ a Eletrização do alvo: o dano a mais dela, como nos outros acertos)
  const fatorDoAcerto = (f.fatorDasCargas ?? 1) * AfeccoesPoe.fatorDeEletrizacao(m, agora);
  const resistidoTotal = partes ? partes.reduce((t, x) => t + resistido(hunt, m, x.el, x.v * fatorDoAcerto, f), 0) : resistido(hunt, m, elemento, comAumento * fatorDoAcerto, f);
  const dano = Math.round(resistidoTotal * (crit ? (f.critMultiplier ?? 1.5) + (ef?.critDano ?? 0) / 100 : 1));
  if (!(dano > 0)) return 0;
  m.hp -= dano;
  QuemFeriu.carimbar(m, QuemFeriu.VOCE, t);
  eventos.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v: dano, foe: true, crit, spell: entry.name, alvo: m.name, color: COR_DO_ELEMENTO[elemento] ?? '#ffffff', ...(fonte ? { fonte } : {}) });
  const fracDe = (el) => (partes ? partes.filter((x) => x.el === el).reduce((t, x) => t + x.v, 0) / Math.max(1e-9, comAumento) : el === elemento ? 1 : 0);
  ModsPoe.aoAcertar(estado, hunt, m, f, { dano, fisico: partes ? Math.round(dano * fracDe('physical')) : 0, fogo: Math.round(dano * fracDe('fire')), crit, eventos, agora, personagem, mover: (b) => ModsPoe.empurrar(hunt, b), elementos: partes ? partes.map((x) => x.el) : [elemento], habilidade: id });
  if (f.afeccoes) {
    const afeccoes0 = semEletrizar ? { ...f.afeccoes, naoPode: { ...(f.afeccoes.naoPode ?? {}), eletrizacao: true } } : f.afeccoes;
    // (lote A2: + as chances e o "mais" de afecção de quem acerta assim — a explosão das torres da Torre Óssea: "Causa Sangramento", "200% mais Dano com
    // Sangramento")
    const afeccoes = afeccoesExtra ? { ...afeccoes0, chance: { ...(afeccoes0.chance ?? {}), ...(afeccoesExtra.chance ?? {}) }, maisDoSuporte: { ...(afeccoes0.maisDoSuporte ?? {}), ...(afeccoesExtra.maisDoSuporte ?? {}) } } : afeccoes0;
    // (a afecção sem o "mais Dano com Acertos" dos suportes — o lote G17)
    const postos = AfeccoesPoe.aoAcertar(m, (partes ?? [{ el: elemento, v: comAumento }]).map((x) => ({ elemento: x.el, dano: x.v / Math.max(1e-9, 1 + (ef?.maisDanoAcertoPct ?? 0) / 100) })), { afeccoes, crit: crit && !f.sobrecargaElemental, ataque, agora, rng, salaDeBoss: !!hunt.isBoss, aoPor: ModsPoe.refletorDeAfeccoes(hunt, f), sofrido: ModsPoe.sofridoDoAtacante(f.afPoe) });
    for (const st of postos) eventos.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: st });
    ModsPoe.aoPorAfeccoes(estado, hunt, m, f, postos, { eventos, personagem });
  }
  return dano;
}
/**
 * (lote 81) A EXPLOSÃO do Arauto Glacial: o inimigo que você Estilhaça (morto Congelado — ou pelo golpe que o congelaria: dono, "Golpe fatal
 * também") explode em Gelo nos vizinhos, a 1,2 m (+0,1 m por 1% de qualidade — o PoB: raio 12 unidades) × a Área; cada um rola o seu acerto. Os
 * que morrem Congelados explodem também (a cadeia — `combate.processarMortes` repete a volta das mortes).
 */
export function explosaoDoArautoGlacial(estado, hunt, morto, eventos = [], rng = Math.random, personagem = null) {
  if (!itensPoeLigado() || !hunt || !morto || hunt.pvp || !arautoLigado(hunt, ARAUTO_GLACIAL)) return 0;
  const entry = POR_ID.get(ARAUTO_GLACIAL);
  const ef = Gemas.efeitoNaSkill(estado, ARAUTO_GLACIAL);
  const nivel = ef?.nivel ?? 1;
  const d = GemasPoe.danoNoNivel('Herald_of_Ice', nivel);
  if (!(d.max > 0)) return 0;
  const fichaBase = Ficha.combate(estado);
  const tags = tagsDoArauto(entry);
  const porTag = ModsPoe.somaPorTags(fichaBase, tags);
  const raioM = 1.2 + 0.01 * (ef?.qualidade ?? 0);
  const base = Math.max(1, Math.round(raioM / 2));
  const raio = base + ModsPoe.casasPelaArea(base, ModsPoe.fatorDaArea(ModsPoe.valor(fichaBase, 'area_inc') + (porTag.area_inc ?? 0) + (ef?.areaIncPct ?? 0), ModsPoe.valor(fichaBase, 'area_mais') + (porTag.area_mais ?? 0), ef?.areaMaisPct ?? 0), rng);
  eventos.push({ t: 'explosao', uid: morto.uid, x: morto.x, y: morto.y, raio, fonte: 'arauto-glacial', color: COR_DO_ELEMENTO.ice ?? '#7fd0ff' });
  let total = 0;
  for (const m of [...(hunt.monstros ?? [])]) {
    if (m === morto || !(m.hp > 0) || m.dummy || (m.z ?? 0) !== (morto.z ?? 0) || Math.max(Math.abs(m.x - morto.x), Math.abs(m.y - morto.y)) > raio) continue;
    total += acertoDoArauto(estado, hunt, ARAUTO_GLACIAL, m, d.min + rng() * (d.max - d.min), 'ice', { tags, eventos, rng, fonte: 'arauto-glacial', personagem });
  }
  return total;
}
/*
 * (lote 81) A TEMPESTADE do Arauto Trovejante (o PoB: `Skills/act_int.lua`): ao matar um inimigo Eletrizado (e, com o Segredo da Tormenta, ao
 * Eletrizar) com o Arauto ligado, uma tempestade em volta de você por 6 s × a Duração (a nova renova); a cada 0,25 s ÷ (1 + a qualidade + "com
 * Frequência aumentada") um raio cai num inimigo ao acaso a até 3,2 m (2 casas × a Área): o dano do nível (Raio), um acerto que "Não Pode aplicar
 * Eletrizar". Com "Sofre N de Dano de Raio quando o Arauto Trovejante Acertar um Inimigo", cada raio tira N × a sua resistência a Raio.
 */
const ARAUTO_TROVEJANTE = 'poe-gema:Herald_of_Thunder';
const TEMPESTADE = Object.freeze({ duracaoMs: 6000, intervaloMs: 250, raioM: 3.2, porTique: 40 });
export function abrirTempestade(estado, hunt, agora = hunt?.clock ?? 0) {
  if (!itensPoeLigado() || !hunt || hunt.pvp || !arautoLigado(hunt, ARAUTO_TROVEJANTE)) return false;
  const entry = POR_ID.get(ARAUTO_TROVEJANTE);
  const ef = Gemas.efeitoNaSkill(estado, ARAUTO_TROVEJANTE);
  const ate = agora + Math.round(TEMPESTADE.duracaoMs * fatorDeDuracao(estado, entry, ef));
  const t = hunt.poeTempestade;
  hunt.poeTempestade = t && t.ate > agora ? { ...t, ate: Math.max(t.ate, ate) } : { ate, prox: agora };
  return true;
}
/** O tique da tempestade (`cacadas.tique`): os raios do tempo que passou. */
export function tiqueDaTempestade(estado, hunt, agora = hunt?.clock ?? 0, rng = Math.random, personagem = null) {
  const eventos = [];
  if (!itensPoeLigado() || !hunt) return eventos;
  // (o Segredo da Tormenta: o Eletrizar de agora — `mods-poe.aoPorAfeccoes` marca)
  if (hunt.poeEletrizouParaTempestade != null) { abrirTempestade(estado, hunt, hunt.poeEletrizouParaTempestade); delete hunt.poeEletrizouParaTempestade; }
  const t = hunt.poeTempestade;
  if (!t) return eventos;
  if (t.ate <= agora && t.prox >= t.ate) { delete hunt.poeTempestade; return eventos; }
  if (!arautoLigado(hunt, ARAUTO_TROVEJANTE)) { delete hunt.poeTempestade; return eventos; }
  const entry = POR_ID.get(ARAUTO_TROVEJANTE);
  const ef = Gemas.efeitoNaSkill(estado, ARAUTO_TROVEJANTE);
  const ficha = Ficha.combate(estado);
  const intervalo = TEMPESTADE.intervaloMs / (1 + ((ef?.qualidade ?? 0) + ModsPoe.valor(ficha, 'arauto_tempestade_freq_inc')) / 100);
  const porTag = ModsPoe.somaPorTags(ficha, tagsDoArauto(entry));
  const base = Math.max(1, Math.round(TEMPESTADE.raioM / 2));
  const raio = base + ModsPoe.casasPelaArea(base, ModsPoe.fatorDaArea(ModsPoe.valor(ficha, 'area_inc') + (porTag.area_inc ?? 0) + (ef?.areaIncPct ?? 0), ModsPoe.valor(ficha, 'area_mais') + (porTag.area_mais ?? 0), ef?.areaMaisPct ?? 0), rng);
  const d = GemasPoe.danoNoNivel('Herald_of_Thunder', ef?.nivel ?? 1);
  const emVoce = ModsPoe.valor(ficha, 'arauto_trovao_dano_em_voce');
  const tags = tagsDoArauto(entry);
  let n = 0;
  while (t.prox <= agora && t.prox < t.ate && n < TEMPESTADE.porTique) {
    n++;
    t.prox += intervalo;
    const perto = hunt.pos ? (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && (m.z ?? hunt.z ?? 0) === (hunt.z ?? 0) && Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) <= raio) : [];
    if (!perto.length || !(d.max > 0)) continue;
    const m = perto[Math.floor(rng() * perto.length)];
    eventos.push({ t: 'fx', id: 11, x: m.x, y: m.y });
    const dado = acertoDoArauto(estado, hunt, ARAUTO_TROVEJANTE, m, d.min + rng() * (d.max - d.min), 'energy', { tags, eventos, rng, semEletrizar: true, fonte: 'arauto-trovejante', personagem });
    if (dado > 0 && emVoce > 0) {
      // (a sua resistência a Raio, como o golpe de Raio de um monstro — o StormSecretSelfDamage do PoB)
      const v = Math.round(emVoce * ModsPoe.fatorDaResistenciaRecebida(ficha, 'energy'));
      // (pelo caminho de todo dano em você: o Escudo de Energia, a árvore, a vida)
      if (v > 0) Poderes.aplicarNoJogador({ estado, hunt, bicho: null, dano: v, elemento: 'energy', eventos, ficha, temEscudo: false, base: { uid: 'player', quem: personagem?.nome ?? estado.name ?? null, x: hunt.pos.x, y: hunt.pos.y } });
    }
  }
  if (t.prox >= t.ate && t.ate <= agora) delete hunt.poeTempestade;
  return eventos;
}

/** (lote 81) Os números da queima do Arauto das Cinzas no nível (o PoB): o % do excesso por segundo (+0,25 por 1% de qualidade), o "mais" dela, 4 s, 1 m. */
export function arautoDasCinzasNoNivel(nivel = 1, qualidade = 0) {
  const linhas = GemasPoe.textosDaGema('Herald_of_Ash', nivel)?.linhas ?? [];
  const pct = Number(/([\d.]+) ?% do Dano Excedente/.exec(linhas.join('\n'))?.[1]) || 25;
  const mais = Number(/([\d.]+) ?% mais Dano Incendiário/.exec(linhas.join('\n'))?.[1]) || 0;
  return { pctPorS: pct + 0.25 * qualidade, maisPct: mais, duracaoMs: 4000, raioM: 1 };
}
/**
 * (lote 81) A QUEIMA do Arauto das Cinzas: ao matar com um acerto (o excesso de dano do golpe fatal — `mods-poe.aoAcertar` guarda), os vizinhos do
 * morto (1 m × a Área) queimam com X% do excesso por segundo × o "mais" do nível, por 4 s × a Duração. É dano degenerativo de Fogo (o
 * `degenFogo`, não o Incêndio): o aumentado geral, de Fogo, Elemental, o "Dano Degenerativo aumentado" (também o de Arauto), o "Dano Incendiário
 * aumentado", os multiplicadores e o "mais Dano Degenerativo com Habilidades de Arautos" (o Mensageiro Solitário — `dotMais`); nada "com Acertos".
 * Uma por inimigo (a mais forte renova).
 */
export function queimaduraDoArautoDasCinzas(estado, hunt, morto, excedente, eventos = []) {
  if (!itensPoeLigado() || !hunt || !morto || hunt.pvp || !(excedente > 0) || !arautoLigado(hunt, ARAUTO_DAS_CINZAS)) return 0;
  const entry = POR_ID.get(ARAUTO_DAS_CINZAS);
  const ef = Gemas.efeitoNaSkill(estado, ARAUTO_DAS_CINZAS);
  const n = arautoDasCinzasNoNivel(ef?.nivel ?? 1, ef?.qualidade ?? 0);
  const fichaBase = Ficha.combate(estado);
  const tags = tagsDoArauto(entry, ['fogo', 'dot']);
  const durMs = Math.round(n.duracaoMs * fatorDeDuracao(estado, entry, ef));
  // (os suportes ligados — as chaves do lote G17: sem o "mais com Acertos", com o "mais Degenerativo" geral e o de Fogo)
  const doSuporte = (1 + (ef?.danoPct ?? 0) / 100) * ((ef?.fatorDeDano ?? 1) / Math.max(1e-9, 1 + (ef?.maisDanoAcertoPct ?? 0) / 100)) * Math.max(0, 1 + (ef?.maisDotPct ?? 0) / 100) * Math.max(0, 1 + (ef?.maisDotFogoPct ?? 0) / 100);
  // (lote E1b, 26/10) a conta com as condições de CADA vizinho (a ficha do golpe com o alvo — "contra Inimigos Amaldiçoados", "contra Inimigos com Vida Baixa"…);
  // sem alvo, a de antes (o que volta e a saída sem vizinhos)
  const contaDaQueima = (alvo) => {
    const f = ModsPoe.fichaDoGolpe(fichaBase, tags, { estado, alvo });
    const a = f.afeccoes ?? AfeccoesPoe.daSoma(f.afPoe ?? {});
    const inc = (f.danoDoElemento?.fire ?? 0) + (a.danoAumentado ?? 0) + (a.danoIncendio ?? 0);
    const multi = (a.multiplicador ?? 0) + (a.multiplicadorFogo ?? 0);
    return excedente * (n.pctPorS / 100) * (1 + n.maisPct / 100) * (durMs / 1000) * Math.max(0, 1 + inc / 100) * (1 + multi / 100) * Math.max(0, 1 + (a.dotMais ?? 0) / 100) * doSuporte;
  };
  const total = contaDaQueima(null);
  if (!(total > 0)) return 0;
  const porTag = ModsPoe.somaPorTags(fichaBase, tags);
  const base = Math.max(1, Math.round(n.raioM / 2));
  const raio = base + ModsPoe.casasPelaArea(base, ModsPoe.fatorDaArea(ModsPoe.valor(fichaBase, 'area_inc') + (porTag.area_inc ?? 0) + (ef?.areaIncPct ?? 0), ModsPoe.valor(fichaBase, 'area_mais') + (porTag.area_mais ?? 0), ef?.areaMaisPct ?? 0));
  const agora = hunt.clock ?? 0;
  let n0 = 0;
  for (const m of hunt.monstros ?? []) {
    if (m === morto || !(m.hp > 0) || m.dummy || (m.z ?? 0) !== (morto.z ?? 0) || Math.max(Math.abs(m.x - morto.x), Math.abs(m.y - morto.y)) > raio) continue;
    const doVizinho = contaDaQueima(m);
    if (!(doVizinho > 0)) continue;
    const posto = Dot.aplicar(m, { tipo: 'degenFogo', total: doVizinho, duracaoMs: durMs, chave: 'Herald_of_Ash', origem: { fonte: 'gema', habilidade: ARAUTO_DAS_CINZAS } }, agora);
    if (posto) eventos.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: posto });
    n0++;
  }
  if (n0) eventos.push({ t: 'fx', id: 37, x: morto.x, y: morto.y });
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
/**
 * (lote 75 — dono, 17/10: "No máximo, como o PoB") O ARAUTO DA AGONIA a cada tique: com o Arauto ligado e você Envenenando (`Virulencia.atual`
 * — a Virulência no máximo), o Rastejador Agonizante vem (sem contar como uso de Lacaio) e escala pela Virulência (`LacaiosPoe.oQueInvoca` com
 * `efeito.virulencia`; os números refeitos quando o nível, a qualidade ou o máximo mudam — `chaveDaVirulencia`); sem Virulência, ele SOME
 * (pelo `ate`: não é morte — no PoB ele não pode morrer). Devolve os eventos.
 */
export function tiqueDoArautoDaAgonia(estado, hunt, agora = hunt?.clock ?? 0) {
  const parede = Math.max(1, hunt?.ultimoTique ?? Date.now());
  const b = hunt?.buffs?.[Virulencia.ID];
  const vivos = (hunt?.lacaios ?? []).filter((l) => l.gema === Virulencia.SLUG && l.hp > 0 && !(l.ate && l.ate <= parede));
  if (!b && !vivos.length) return [];
  const entry = POR_ID.get(Virulencia.ID);
  const ef = entry ? Gemas.efeitoNaSkill(estado, entry.id) : null;
  const af = Ficha.combate(estado).afPoe ?? {};
  const V = b && ef ? Virulencia.atual(hunt, Virulencia.maxima(ef.nivel ?? 1, ef.qualidade ?? 0, af), agora) : 0;
  if (!(V > 0)) {
    for (const l of vivos) l.ate = parede;
    return [];
  }
  const chave = `${ef.nivel ?? 1}:${V}`;
  if (vivos.length) {
    for (const l of vivos) {
      if (l.chaveDaVirulencia === chave) continue;
      const q = LacaiosPoe.oQueInvoca(Virulencia.SLUG, ef.nivel ?? 1, { ...ef, virulencia: V }, af);
      if (q) Object.assign(l, { dano: q.dano, somado: q.somado, velAtaquePct: q.velAtaquePct, poe: q.poe, virulencia: V, chaveDaVirulencia: chave });
    }
    return [];
  }
  const eventos = invocarLacaios(hunt, entry, { ...ef, virulencia: V }, null, estado, { semUso: true });
  for (const l of hunt.lacaios ?? []) if (l.gema === Virulencia.SLUG && l.hp > 0 && l.chaveDaVirulencia == null) Object.assign(l, { virulencia: V, chaveDaVirulencia: chave });
  return eventos;
}

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
/** (lote A5, dono 20/10) A Vida ao matar do suporte: `pct`% da Vida máxima por atingido que morreu por você neste uso. Devolve a vida pedida. */
export function vidaAoMatarDoSuporte(estado, hunt, personagem, pct, atingidos, eventos = []) {
  const mortos = atingidos.filter((b) => b && b.hp <= 0 && !b.dummy && QuemFeriu.abateSeu(b)).length;
  if (!mortos || !(pct > 0) || !((estado.hp ?? 0) > 0)) return 0;
  const vida = Math.round(((estado.maxHp ?? 0) * pct * mortos) / 100);
  if (vida > 0) Ficha.curar(estado, vida, 0, eventos, personagem?.nome, hunt?.pos ?? { x: 0, y: 0 });
  return vida;
}
/**
 * (lote S1, 26/10) Depois das afecções de UM acerto do uso (`postos`: as que ele pôs): a PROLIFERAÇÃO — "Afecções Elementais … se espalham para outros inimigos dentro de
 * 1.5 metros" (o Incêndio, o Congelamento, a Eletrização e o Resfriamento) e "Incêndios … dentro de 2 metros" — copia a afecção posta (o mesmo dano e o tempo que falta)
 * nos vivos a até N m do atingido (1 casa = 2 m, ao menos 1; a afecção espalhada não espalha de novo); a DOSE LETAL — envenenar quem não estava envenenado
 * (`envenenadoAntes`) inflige N Venenos a mais (cópias do posto). Devolve quantas afecções a mais saíram.
 */
export function aposAfeccoesS1(hunt, alvo, postos, ef, eventos = [], agora = hunt?.clock ?? 0, envenenadoAntes = true, acao = null) {
  // (o Incêndio Controlado conta os Incêndios infligidos por esta habilidade — os de 4 s para trás saem)
  if ((ef?.blazeIncendioPorPct > 0 || ef?.blazeMenosPorPct > 0) && acao != null && hunt && postos?.includes('queimando')) {
    const t = (hunt.poeIncendiosS1 ??= {});
    t[acao] = [...(t[acao] ?? []).filter((x) => agora - x <= ModsPoe.RECENTE_MS), agora].slice(-200);
  }
  const elemM = Number(ef?.proliferarElementalM) || 0;
  const incM = Math.max(elemM, Number(ef?.proliferarIncendioM) || 0);
  const venenos = Math.max(0, Math.floor(Number(ef?.venenosExtrasNoNaoEnvenenado) || 0));
  if (!alvo || !postos?.length || !(elemM > 0 || incM > 0 || venenos > 0)) return 0;
  let n = 0;
  const copia = (b, d) => { Dot.aplicar(b, { tipo: d.tipo, total: d.falta, duracaoMs: Math.max(100, (d.ate ?? agora) - agora), origem: { ...(d.origem ?? {}), proliferado: true }, ...(d.chave != null ? { chave: d.chave } : {}) }, agora); n++; };
  const maisNovo = (tipos) => (alvo.dots ?? []).filter((d) => tipos.includes(d.tipo) && d.falta > 0 && !d.origem?.proliferado).sort((a, b) => (b.ate ?? 0) - (a.ate ?? 0))[0];
  if (venenos > 0 && !envenenadoAntes && postos.includes('envenenado')) {
    const d = maisNovo(['venenoPoe', 'veneno']);
    if (d) for (let i = 0; i < venenos; i++) copia(alvo, d);
  }
  if (!(elemM > 0 || incM > 0)) return n;
  const z = alvo.z ?? hunt?.z ?? 0;
  const perto = (m) => (hunt?.monstros ?? []).filter((b) => b !== alvo && b.hp > 0 && !b.dummy && (b.z ?? hunt?.z ?? 0) === z && distanciaChebyshev(b, alvo) <= Math.max(1, Math.round(m / 2)));
  const marcar = (b, st) => eventos.push({ t: 'estado', uid: b.uid, x: b.x, y: b.y, estado: st });
  if (incM > 0 && postos.includes('queimando')) {
    const d = maisNovo(['queimadura']);
    if (d) for (const b of perto(incM)) { copia(b, d); marcar(b, 'queimando'); }
  }
  if (elemM > 0) {
    const e = alvo.estados ?? {};
    for (const b of perto(elemM)) {
      const eb = (b.estados ??= {});
      if (postos.includes('congelado') && (e.congelado?.ate ?? 0) > agora && !((eb.congelado?.ate ?? 0) >= e.congelado.ate)) { eb.congelado = { ...e.congelado }; marcar(b, 'congelado'); n++; }
      if (postos.includes('eletrizado') && (e.chocado?.ate ?? 0) > agora && !((eb.chocado?.ate ?? 0) > agora && (eb.chocado.pct ?? 0) >= (e.chocado.pct ?? 0))) { eb.chocado = { ate: e.chocado.ate, pct: e.chocado.pct }; marcar(b, 'eletrizado'); n++; }
      if (postos.includes('lento') && (e.lento?.ate ?? 0) > agora && e.lento.pct > 0) { GemasGBD.porLento(eb, e.lento.ate, e.lento.pct, agora); marcar(b, 'lento'); n++; }
    }
  }
  return n;
}
/**
 * (lote S1, 26/10) A CASCATA MÁGICA: as `casas` da área (centro `forma`) copiadas ao lado dela — na frente e atrás na linha de `de` (você) até o centro; com `modo` 2,
 * também dos lados — encostadas (o passo é 2 × o raio + 1). Cada vivo em cada cópia leva mais um acerto (`golpes`). Devolve `{ casas, atingidos }` (a união).
 */
export function cascataMagicaS1(casas, forma, de, modo, vivos, golpes, atingidos) {
  const ref = { x: forma.x, y: forma.y };
  const raio = casas.reduce((r, q) => Math.max(r, distanciaChebyshev(ref, q)), 0);
  const passo = 2 * raio + 1;
  let ux = Math.sign(ref.x - de.x);
  let uy = Math.sign(ref.y - de.y);
  if (!ux && !uy) { const d = [[0, -1], [1, 0], [0, 1], [-1, 0]][forma.dir ?? 1] ?? [1, 0]; ux = d[0]; uy = d[1]; }
  const lados = modo >= 2 ? [[-uy, ux], [uy, -ux]] : [];
  const centros = [[ux, uy], [-ux, -uy], ...lados].map((v) => ({ x: ref.x + v[0] * passo, y: ref.y + v[1] * passo }));
  const chave = (q) => q.x + ',' + q.y;
  const todas = new Map(casas.map((q) => [chave(q), q]));
  const unicos = new Set(atingidos);
  for (const c of centros) {
    const cs = casas.map((q) => ({ x: q.x - ref.x + c.x, y: q.y - ref.y + c.y }));
    for (const q of cs) todas.set(chave(q), q);
    const ks = new Set(cs.map(chave));
    for (const b of vivos) if (b.hp > 0 && ks.has(chave(b))) { golpes.push({ bicho: b, pct: 100 }); unicos.add(b); }
  }
  return { casas: [...todas.values()], atingidos: [...unicos] };
}
/** (lote S1, 26/10) As regras de carga do ACERTO deste uso: as da ficha + as do suporte (a de Tolerância só no acerto corpo a corpo). */
export function cargasDoUsoS1(cargas, ef, corpoACorpo) {
  const poder = Number(ef?.cargaPoderNoCriticoPct) || 0;
  const tolerancia = corpoACorpo ? Number(ef?.cargaToleranciaAoAtordoarPct) || 0 : 0;
  if (!poder && !tolerancia) return cargas;
  const c = { ...(cargas ?? {}) };
  if (poder) c.carga_poder_ao_critico = (Number(c.carga_poder_ao_critico) || 0) + poder;
  if (tolerancia) c.carga_tolerancia_ao_atordoar = (Number(c.carga_tolerancia_ao_atordoar) || 0) + tolerancia;
  return c;
}
/**
 * (lote S1, 26/10) O SACRIFICAR: a magia suportada, ao ser conjurada por você, tira X% da Vida atual (até 1) e ganha Dano de Caos adicional igual a Y% do sacrificado
 * (× a eficácia do dano adicionado, como o dos suportes — `somadoMin:chaos`); o SACRIFÍCIO VAAL: o uso tira tudo, menos 1, da Vida e todo o Escudo de Energia. Devolve o
 * efeito do uso (com o Caos do sacrifício).
 */
export function doUsoS1(estado, entry, ef, agora = estado?.hunt?.clock ?? 0) {
  let e = ef;
  const hunt = estado?.hunt;
  const vezes = (a, b) => ((1 + (a ?? 0) / 100) * (1 + (b ?? 0) / 100) - 1) * 100;
  // (o Incêndio Controlado: os Incêndios que esta habilidade infligiu nos últimos 4 s — `aposAfeccoesS1` — dão o "mais" no Incêndio e o "menos" no dano todo, com os tetos)
  if ((e?.blazeIncendioPorPct > 0 || e?.blazeMenosPorPct > 0) && hunt) {
    const lista = (hunt.poeIncendiosS1 ?? {})[entry.id] ?? [];
    const n = lista.filter((t) => agora - t <= ModsPoe.RECENTE_MS).length;
    const mais = Math.min(e.blazeIncendioMax ?? Infinity, (e.blazeIncendioPorPct ?? 0) * n);
    const menos = Math.min(e.blazeMenosMax ?? Infinity, (e.blazeMenosPorPct ?? 0) * n);
    if (mais || menos) e = { ...e, maisIncendioPct: vezes(e.maisIncendioPct, mais), fatorDeDano: (e.fatorDeDano ?? 1) * Math.max(0, 1 - menos / 100) };
  }
  // (o Superaquecimento: consome toda a Fortificação; o "+X% de dano com afecções" por cada N consumidas — o "mais" das afecções do uso)
  if (e?.superaquecerPct > 0 && hunt) {
    const f = hunt.fortificacao && hunt.fortificacao.ate > agora ? hunt.fortificacao.n ?? 0 : 0;
    if (f > 0) {
      hunt.fortificacao = { n: 0, ate: agora };
      Ficha.invalidar(estado);
      const pct = e.superaquecerPct * Math.floor(f / Math.max(1, e.superaquecerPor ?? 3));
      if (pct) e = { ...e, maisAfeccaoPct: vezes(e.maisAfeccaoPct, pct) };
    }
  }
  if (e?.sacrificioVidaPct > 0 && !entry?.poeGema?.ataque) {
    const sacrificado = Math.max(0, Math.min((estado.hp ?? 0) - 1, Math.floor(((estado.hp ?? 0) * e.sacrificioVidaPct) / 100)));
    if (sacrificado > 0) {
      estado.hp -= sacrificado;
      const caos = (sacrificado * (e.sacrificioCaosPct ?? 0)) / 100;
      e = { ...e, ['somadoMin:chaos']: (e['somadoMin:chaos'] ?? 0) + caos, ['somadoMax:chaos']: (e['somadoMax:chaos'] ?? e['somadoMin:chaos'] ?? 0) + caos, sacrificado };
    }
  }
  // (a Comunhão: X a Y de Físico adicionado à magia por lacaio permanente seu vivo — sem duração)
  if (e?.comunhaoMin > 0 && !entry?.poeGema?.ataque) {
    const n = (estado.hunt?.lacaios ?? []).filter((l) => l.hp > 0 && !(l.ate > 0) && !l.totem).length;
    if (n > 0) e = { ...e, ['somadoMin:physical']: (e['somadoMin:physical'] ?? 0) + e.comunhaoMin * n, ['somadoMax:physical']: (e['somadoMax:physical'] ?? e['somadoMin:physical'] ?? 0) + (e.comunhaoMax ?? e.comunhaoMin) * n };
  }
  if (e?.sacrificaTudoMenosUm > 0) {
    if ((estado.hp ?? 0) > 1) estado.hp = 1;
    estado.es = 0;
  }
  return e;
}
/**
 * (lote S1, 26/10) O ABATE do uso suportado (os mortos SEUS deste uso — `QuemFeriu.abateSeu`): a Mordida Congelante — "X% de chance de ganhar uma Carga de Frenesi ao
 * Matar um Inimigo Congelado" (um sorteio por morto que estava Congelado) — e o Devorar — "Golpes Abatedores … Consomem cadáveres para Recuperar X de Vida e Y de Mana": por
 * morto, recupera e marca o "Consumiu um cadáver Recentemente"; o morto não deixa cadáver (`poeDevorado`, lido em `hunt/combate`). Devolve quantos mortos contaram.
 */
export function abatesDoSuporteS1(estado, hunt, personagem, ef, atingidos, eventos = [], rng = Math.random) {
  if (!itensPoeLigado() || !ef || !(ef.cargaFrenesiAoMatarCongeladoPct > 0 || ef.devorarVida > 0 || ef.devorarMana > 0 || ef.explodirAoMatarPct > 0)) return 0;
  const agora = hunt?.clock ?? 0;
  const mortos = (atingidos ?? []).filter((b) => b && b.hp <= 0 && !b.dummy && !b.poeAbateS1 && QuemFeriu.abateSeu(b));
  for (const b of mortos) {
    b.poeAbateS1 = true;
    if (ef.cargaFrenesiAoMatarCongeladoPct > 0 && (b.estados?.congelado?.ate ?? 0) > agora && rng() * 100 < ef.cargaFrenesiAoMatarCongeladoPct && CargasPoe.ganhar(estado, 'frenesi', Ficha.combate(estado).cargas ?? {}, 1)) Ficha.invalidar(estado);
    // (a Aniquilação: o morto explode — um décimo da Vida máxima dele, de um elemento sorteado)
    if (ef.explodirAoMatarPct > 0 && hunt?.pos && rng() * 100 < ef.explodirAoMatarPct) ModsPoe.explodirMorto(hunt, b, 10, eventos, { tipo: ['fire', 'ice', 'energy'][Math.min(2, Math.floor(rng() * 3))] });
    if ((ef.devorarVida > 0 || ef.devorarMana > 0) && (estado.hp ?? 0) > 0) {
      b.poeDevorado = true;
      ModsPoe.marcar(hunt, 'consumiuCadaver', agora);
      ((hunt.poeUsosRecentes ??= {}).cadaver ??= []).push(agora);
      Ficha.curar(estado, Math.round(ef.devorarVida ?? 0), Math.round(ef.devorarMana ?? 0), eventos, personagem?.nome, hunt?.pos ?? { x: 0, y: 0 });
    }
  }
  return mortos.length;
}
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
    // (17/10, lote G2: a forma no raio do PoE da gema — `formaNoRaioDoPoe`)
    const forma = formaNoRaioDoPoe(entry, efeito, rng).forma;
    const raio = Areas.raioDaForma(forma);
    const n = ModsPoe.casasPelaArea(raio, ModsPoe.fatorDaArea(efeito.areaIncPct ?? 0, efeito.areaMaisPct ?? 0), rng);
    const casas = Areas.daForma(n ? Areas.escalarForma(forma, raio + n) : forma, noAlvo ? alvo : origem, !noAlvo && direcional(entry) ? ordemDosLados(origem, alvo)[0] : null);
    const golpes = Areas.dentro(casas, vivos).filter((b) => b !== alvo).map((b) => ({ bicho: b, pct: 100, tipo: 'area' }));
    return { golpes, eventos: entry.efeito ? [{ t: 'area', id: entry.efeito, x: origem.x, y: origem.y, casas: Areas.paraTela(casas, origem) }] : [], emitidos: [], explosoes: [] };
  }
  if (entry.cadeia) {
    const atingidos = saltosDaCadeia(alvo, vivos, efeito.cadeiaPoe ? { ...entry.cadeia, targets: 1 + efeito.cadeiaPoe.saltos, distance: alcanceDoRicochete(DISTANCIA_DA_CADEIA_POE(), efeito, rng) } : entry.cadeia);
    return { golpes: atingidos.slice(1).map((b, i) => ({ bicho: b, pct: 100, tipo: 'cadeia', de: atingidos[i] })), eventos: [], emitidos: [], explosoes: [] };
  }
  const tags = Tags.tagsDaAcao(entry);
  if (!tags.includes('projectile')) return null;
  // (lote A3c, dono 19/10: "Sim, igual") + a área no impacto do projétil da gema dele, com o mesmo raio do seu (`areaNoImpactoDoUso`); o golpe da
  // área vai como 'area' (a caçada não desenha um voo para ele), com `impacto: true` e o `doImpacto`
  const r = Secundarios.resolver({ efeito, tags, origem, alvo, atingidos: [alvo], vivos, alcance: entry.range || ALCANCE_PADRAO, rng, areaNoImpacto: areaNoImpactoDoUso(entry, efeito, 0, rng), cinetica: cineticaDoUso(entry, efeito, 0, rng) });
  return { golpes: r.golpes.map((g) => (g.tipo === 'impacto' ? { ...g, tipo: 'area', impacto: true } : g)), eventos: [], emitidos: r.emitidos, explosoes: r.explosoes };
}
/**
 * (lote A3c, dono 19/10: "Fazer como o PoE") A ÁREA NO IMPACTO do projétil da gema com raio-base no PoB (`GemasPoe.areaNoImpacto`) neste uso:
 * `{ raio, soNosExtras }` — o raio em casas = os metros × √ da Área de Efeito do uso (a da gema, dos suportes e das peças — o "aumentado" e o
 * "mais", como a forma das áreas do uso; a "menos" da Intensidade) ÷ 2, a fração como a chance de uma casa a mais —, ou null. O seu disparo (e o
 * do totem, que passa por ele) e o golpe do mercenário (dono, 19/10: "Sim, igual").
 */
export function areaNoImpactoDoUso(entry, efeito, intensidade = 0, rng = Math.random) {
  if (!itensPoeLigado() || !entry?.poeGema) return null;
  const a = GemasPoe.areaNoImpacto(entry.poeGema.slug, efeito?.nivel ?? 1, efeito?.qualidade ?? 0);
  if (!a) return null;
  const fator = ModsPoe.fatorDaArea(efeito?.areaIncPct ?? 0, efeito?.areaMaisPct ?? 0, intensidade > 0 ? -intensidade * (efeito?.intensidadeMenosAreaPct ?? 0) : 0);
  return { raio: casasDoRaio(a.raioM * Math.sqrt(fator), rng), soNosExtras: a.soNosExtras };
}
/**
 * (lote PR3, dono 21/10) As EXPLOSÕES da Explosão Cinética neste uso (`GemasPoe.cineticaDaGema`, `Secundarios.resolver`): `{ n, pct, raio, raioSec }` — as
 * adicionais, o % de cada explosão (o "menos Dano em Área"), o raio da explosão e o secundário em casas (os metros × √ da Área de Efeito do uso ÷ 2, a fração como
 * a chance de uma casa a mais, sorteados uma vez no uso — a exceção 6 do lote) —, ou null.
 */
export function cineticaDoUso(entry, efeito, intensidade = 0, rng = Math.random) {
  const k = itensPoeLigado() && entry?.poeGema ? efeito?.cinetica : null;
  if (!k) return null;
  const fator = ModsPoe.fatorDaArea(efeito?.areaIncPct ?? 0, efeito?.areaMaisPct ?? 0, intensidade > 0 ? -intensidade * (efeito?.intensidadeMenosAreaPct ?? 0) : 0);
  return { n: k.n, pct: Math.max(0, 100 - (k.menosAreaPct ?? 0)), raio: casasDoRaio(k.raioM * Math.sqrt(fator), rng), raioSec: casasDoRaio(k.raioSecM * Math.sqrt(fator), rng) };
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
ModsPoe.definirAoEstilhacar((estado, hunt, ficha, rng, ctx = {}) => {
  // (lote 81) o Arauto Glacial: o Estilhaçado explode
  if (ctx.alvo) explosaoDoArautoGlacial(estado, hunt, ctx.alvo, ctx.eventos ?? [], rng, ctx.personagem ?? null);
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
// (lote PR1, dono 20/10: + a qualidade — "Cadáveres Criados têm Vida Máxima aumentada em X%", o Desenterrar: a Vida Máxima de cada cadáver × (1 + X%))
export function criarCadaveres(estado, hunt, slug, nivelDaGema = 1, onde = hunt?.pos, rng = Math.random, { qualidade = 0 } = {}) {
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
    // (17/10, lote G12: + a Vida Máxima — a do monstro da área que deu o desenho; o Arqueiro de Ossos, a média dos monstros da área)
    const vidaDaArea = daArea.length ? daArea.reduce((t, m) => t + (m.maxHp ?? 0), 0) / daArea.length : 0;
    const vidaInc = qualidade > 0 ? GemasPoe.vidaDoCadaverDaGema(slug, qualidade) : 0;
    lista.push({ key: base?.key ?? 'skeleton', nome: base?.name ?? 'Arqueiro de Ossos', look: desenho.look, lookItem: desenho.lookItem ?? 0, colors: desenho.colors ?? null, x, y, nivel, maxHp: Math.round((base?.maxHp ?? vidaDaArea) * (1 + vidaInc / 100)), criadoPor: slug, criadoEm: hunt.clock ?? 0 });
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
function amaldicoouAgora(estado, hunt, bicho, ficha, agora, eventos, personagem, { doTotem = false } = {}) {
  const m = Reforcos.marcar(hunt, bicho, agora);
  // (lote G20a: o acerto do totem amaldiçoa — a skill é a sua —, mas os "quando você Amaldiçoar" não são seus)
  if (doTotem) return;
  // (lote 83: + os vizinhos que a área da maldição amaldiçoou — cada um é um inimigo que você amaldiçoou)
  for (const x of [{ ...m, bicho }, ...(m.espalhou ?? [])]) {
    if (x.amaldicoouSemMaldicao) ModsPoe.evento(estado, hunt, 'amaldicoarSemMaldicao', ficha, { alvo: x.bicho, eventos, personagem });
    if (x.semMaldicaoNaoAura) ModsPoe.evento(estado, hunt, 'amaldicoarSemMaldicaoNaoAura', ficha, { alvo: x.bicho, eventos, personagem });
  }
}

/** O dano que a skill causa agora, por acerto (sem crítico nem resistência): o que o balão mostra. */
export function danoMostrado(estado, entry, efeitoDaGema = Gemas.ehSkillDeGema(entry) ? Gemas.efeitoNaSkill(estado, entry.id) : null) {
  // (Duas armas: a gema que combina as armas mostra as duas juntas; a que alterna, a mão principal.)
  const ficha = Ficha.combate(estado);
  const mao = maoDaGemaDeAtaque(entry, ficha);
  const c = contaDoDano(estado, entry, efeitoDaGema, mao?.ficha ?? ficha, mao?.arma ?? null);
  // (18/10, lote G18b: + o "X% mais Dano de <tipo>" — a Ira: "mais Dano Mágico de Raio" — pela fração de cada parte do golpe; no acerto ele entra
  // por `fatorRecebidoPeloBicho`, e o balão o deixava de fora)
  const md = c.ficha?.maisDoElemento;
  const doTipo = md && c.partes ? c.partes.reduce((t, p) => t + p.frac * Math.max(0, 1 + (md[p.elemento] ?? 0) / 100), 0) || 1 : 1;
  const f = c.mult * c.fatorDaGema * c.sobrecarga * doTipo;
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
/** (lote C4, dono 21/10) A duração do Tolhimento das áreas renovado a cada pulso (as runas da Vinculação, a Esfera do Vazio, o Tornado): a de antes, a do `lento` (3 s). */
const TOLHIMENTO_DAS_AREAS_MS = 3000;
// (lote A1) o efeito na tela nas duas pontas do deslocamento (o `teleporte` dos estilos das gemas — `itens-poe/estilos-das-gemas.mjs`)
const EFEITO_DO_TELEPORTE = 11;
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
  // (lote A1b, dono 19/10: D-c) a conjuração em curso se perdeu (o congelamento, o atordoamento): a fila do Teleporte vai junto
  if (!c) { if (hunt?.filaDoTeleporte?.length) hunt.filaDoTeleporte = []; return []; }
  const alvo = c.alvo != null ? hunt.monstros.find((b) => b.uid === c.alvo && b.hp > 0) ?? null : c.alvoDoPlano != null ? hunt.monstros.find((b) => b.uid === c.alvoDoPlano && b.hp > 0) ?? null : null;
  const cancelar = (motivo) => {
    hunt.conjurando = null;
    if (hunt.filaDoTeleporte?.length) hunt.filaDoTeleporte = [];
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
  // (lote A1b, dono 19/10: D-c) o próximo Teleporte da fila assume (ele parte daqui — o destino deste)
  if (hunt.filaDoTeleporte?.length) hunt.conjurando = hunt.filaDoTeleporte.shift();
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
    ...(entry.kind !== 'item' && (entry.mana || entry.poeGema) ? { mana: Math.round(custoDaSkill(entry, daGema(entry)?.efeito ?? null, estado)) } : {}),
    // Gema do PoE: os tempos do PoE com a ficha (`temposDaGemaPoe`) — o balão mostra o tempo de uso e a recarga de verdade. (lote A4, dono 19/10: D1: o uso
    // com repetições ocupa (1 + r) tempos de uso — `fatorDoTempoDoUso`)
    ...(entry.poeGema ? (() => { const t = temposDaGemaPoe(estado, entry, daGema(entry)?.efeito ?? null, ficha); return { cooldown: t.recarga, groupCooldown: Math.round(t.uso * (repeteNoMotor(entry, daGema(entry)?.efeito ?? null) ? fatorDoTempoDoUso(entry, daGema(entry)?.efeito ?? null, ficha) : 1)), tempoPoe: t }; })() : {}),
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
  // (lote A2, dono 19/10: "o Berserk ganha uma condição nova no slot, Fúria ≥ N, configurável") a Fúria do PoE agora (0 a 100 — o máximo de Fúria
  // com os "+N ao Máximo")
  if (kind === 'furia') {
    const r = { kind, op: op('gte'), value: faixa(c.value, 0, 100, 5) };
    if (r.op === 'entre') r.value2 = faixa(c.value2, 0, 100, r.value);
    return r;
  }
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
    // (lote A1, dono 19/10 — D2) a gema de movimento "para longe" (fugir, com as condições do slot); sem isto, ela vai atrás do alvo e nunca foge
    ...(v.direcao === 'longe' ? { direcao: 'longe' } : {}),
    // (lote A1b, dono 19/10: I1) a Investida Carregada: "Segurar a miragem no alvo" — parada, ela segue pulsando enquanto houver inimigo na área dela
    ...(v.segurarMiragem === true ? { segurarMiragem: true } : {}),
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
  // (lote A2) a Fúria do PoE agora (`ModsPoe.furiaAtual`)
  if (condition.kind === 'furia') return compara(condition.op ?? 'gte', ModsPoe.furiaAtual(estado), Number(condition.value) || 0, Number(condition.value2) || 0);
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
  // (lote A2: + os buffs LIGADOS sem reserva — a Automação, a Lâmina de Energia, o Berserk: saem com a gema fora da barra ou da peça — a exceção (7)
  // do dono, `itens-poe/gemas-a2.mjs`)
  // (lote G-D, dono 25/10: + o Fogo Justo da Devoção ligado — `b.gbd.fogoJusto`)
  const ligadasA2 = Object.entries(hunt?.buffs ?? {}).filter(([, b]) => (b?.a2 || b?.gbd?.fogoJusto) && !b.reserva && b.ate >= Reserva.LIGADA_ATE);
  let saiuA2 = false;
  if (ligadasA2.length) {
    const ativas = Gemas.skillsAtivas(estado);
    // (revisão do A2: o Berserk desligado assim também liga a recarga — `encerrarBuffA2`; a Lâmina de Energia sai sem espada)
    const espada = ESPADAS.test(String(estado.equipment?.weapon?.poe?.classe ?? ''));
    for (const [id] of ligadasA2) if (!((estado.actions ?? []).some((a) => a?.id === id && a.enabled !== false) && ativas.has(id)) || (id === GemasA2.ACAO.lamina && !espada)) { encerrarBuffA2(hunt, id, hunt.clock ?? 0); saiuA2 = true; }
  }
  if (!Object.values(hunt?.buffs ?? {}).some((b) => b?.reserva)) return saiuA2;
  const ativas = Gemas.skillsAtivas(estado);
  const ficha = itensPoeLigado() ? Ficha.combate(estado) : null;
  const so = ficha ? auraPermitida(ficha) : null;
  // (lote 80, o Mensageiro Solitário: "Você só pode ter um Arauto" — com dois ligados, o mais novo desliga)
  const umArauto = !!ficha && ModsPoe.valor(ficha, 'so_um_arauto') > 0;
  // (revisão do A2: o Cajado Impregnado de Mana sai sem cajado — RequiresStaff)
  const cajado = CAJADOS.test(String(estado.equipment?.weapon?.poe?.classe ?? ''));
  return Reserva.desligarAsQueSairam(hunt, (id) => !(id === GemasA2.ACAO.cajado && !cajado) && (estado.actions ?? []).some((a) => a?.id === id && a.enabled !== false) && ativas.has(id) && !auraDesabilitada(POR_ID.get(id), so, POR_ID.get(id)?.poeGema?.arquetipo === 'maldicao' && !!hunt.buffs?.[id]?.reserva) && !(umArauto && arautoExcedente(hunt, id, ficha))) || saiuA2;
}
/**
 * (lote 80, o Mensageiro Solitário) "Você só pode ter um Arauto": o Arauto `id` passa do limite — há outro ligado (o mais antigo fica: o 2º não liga
 * e, com dois ligados, o mais novo sai). Religar o mesmo pode.
 */
export function arautoExcedente(hunt, id, ficha) {
  if (!(ModsPoe.valor(ficha, 'so_um_arauto') > 0) || !ehArauto(POR_ID.get(id))) return false;
  const agora = hunt?.clock ?? 0;
  // (o Arauto da Pureza é Arauto no PoE, mas no jogo é lacaio: ligado = as Sentinelas dele em campo. Ela só sai sem outro Arauto ligado, então
  // com Sentinela em campo o Arauto de buff é o excedente — as Sentinelas contam o tempo em outro relógio, não dá para comparar o `desde`)
  if (id === PUREZA) return Object.values(hunt?.buffs ?? {}).some((b) => b?.tipo === 'poe-arauto' && b.ate > agora);
  if ((hunt?.lacaios ?? []).some((l) => l?.acao === PUREZA && l.hp > 0)) return true;
  const meu = hunt?.buffs?.[id];
  return Object.entries(hunt?.buffs ?? {}).some(([o, b]) => o !== id && b?.tipo === 'poe-arauto' && b.ate > agora && (!meu || (b.desde ?? 0) < (meu.desde ?? 0)));
}
const PUREZA = 'poe-gema:Herald_of_Purity';
/** A gema é de Arauto (o arquétipo; a Pureza, pelo slug — no jogo ela é lacaio). */
const ehArauto = (entry) => entry?.poeGema?.arquetipo === 'arauto' || /^Herald_of_/.test(entry?.poeGema?.slug ?? '');
/**
 * (lote 56, a Visão Sublime) "Habilidades de Aura diferentes de <Aura> são Desabilitadas": as auras permitidas pela ficha (`aura_unica:<o nome da
 * gema>` — o conjunto dos nomes), ou null sem a linha. A aura de gema fora dele não liga (`disparar`) e a ligada sai no tique
 * (`desligarAurasForaDaBarra`).
 */
export function auraPermitida(ficha) {
  // (lote 80, o Mensageiro Solitário: "Suas Habilidades de Aura são Desabilitadas" — nenhuma aura de gema)
  if (Number(ficha?.afPoe?.auras_desabilitadas) > 0) return new Set();
  const so = Object.entries(ficha?.afPoe ?? {}).filter(([k, v]) => k.startsWith('aura_unica:') && v > 0).map(([k]) => k.slice('aura_unica:'.length));
  return so.length ? new Set(so) : null;
}
/**
 * A gema é Aura (o tipo, ou a tag — o Orgulho e os Estandartes trazem só a tag) — ou a maldição em aura da Blasfêmia (`ehAura`: o PoB dá o
 * tipo Aura à habilidade suportada) — e está fora das permitidas.
 */
export const auraDesabilitada = (entry, so, ehAura = false) => {
  if (!so || !entry?.poeGema) return false;
  const g = GemasPoe.doSlug(entry.poeGema.slug)?.gema;
  return (ehAura || !!g?.tipos?.includes('Aura') || !!g?.tags?.includes('Aura')) && !so.has(ModsPoe.slugDoNome(g?.nome ?? ''));
};

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
  // (lote G-A, dono 25/10: + a QUALIDADE da própria gema — "Efeito de Maldições aumentado" do Desespero, "Efeito da Marca aumentado" da Alquimista)
  const daQualidade = entry?.poeGema?.slug && entry.poeGema.arquetipo === 'maldicao' ? GemasPoe.qualidadeDaMaldicaoDaGema(entry.poeGema.slug, efeitoDaGema?.qualidade ?? 0) : { efeitoPct: 0, duracaoPct: 0 };
  const pct = (Number(efeitoDaGema?.efeitoMaldicaoPct) || 0) + dasPecas + daQualidade.efeitoPct;
  // (09/10, auditoria de dependências) "Duração da Maldição aumentada em X%" (a árvore, as peças): a marca da maldição dura mais no monstro.
  // (lote G14: + a do suporte — "Habilidades reforçadas têm -X% de duração de maldição", o Toque Maldito)
  // (lote G-A: + a da qualidade — "Duração de Maldições aumentada" do Enfraquecer e da Corrente Temporal)
  const duracao = (f ? valorPoe(f, 'duracao_maldicao') : 0) + (Number(efeitoDaGema?.duracaoMaldicaoPct) || 0) + daQualidade.duracaoPct;
  // "X% menos Efeito das suas Maldições" e "Seus Feitiços têm Duração infinita" (Mestre dos Feitiços — só os Feitiços, as maldições Hex).
  const menos = f ? valorPoe(f, 'efeito_maldicao_menos') : 0;
  const tagsDaGema = GemasPoe.doSlug(entry?.poeGema?.slug)?.gema?.tags ?? [];
  const ehFeitico = tagsDaGema.includes('Feitiço');
  const infinita = !!f && ehFeitico && valorPoe(f, 'feitico_duracao_infinita') > 0;
  const fatorPct = Math.max(0, 1 + pct / 100) * Math.max(0, 1 - menos / 100);
  const saida = efeitos.map((e) => (/^marca/.test(e.efeito) && typeof e.pct === 'number'
    ? { ...e, pct: e.pct * fatorPct, ...(e.efeito === 'marcaGac' ? { escala: fatorPct } : {}), ...(e.durMarca && (duracao || infinita) ? { durMarca: infinita ? DURACAO_INFINITA_MS : Math.round(e.durMarca * Math.max(0.1, 1 + duracao / 100)) } : {}) }
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
  // (lote 83) a ÁREA da maldição em casas (a Marca é de um alvo só): os metros da gema no nível ÷ 2 × √ da "Área de Efeito aumentada/mais" — a
  // geral, a das Maldições ("Efeito em Área de Habilidades de Maldição aumentado" — `area_inc@maldicao`), a da gema e a dos suportes (a da Blasfêmia);
  // `Reforcos.marcar` amaldiçoa os vizinhos a até esse raio
  const slugDaGema = entry.poeGema.slug;
  const nivelDaGema = efeitoDaGema?.nivel ?? 1;
  const qualidadeDaGema = efeitoDaGema?.qualidade ?? 0;
  const areaDaGema = marca ? null : GemasPoe.areaNoNivel(slugDaGema, nivelDaGema, qualidadeDaGema);
  const raioM = areaDaGema ? areaDaGema.raioM ?? GemasPoe.compilada(slugDaGema, nivelDaGema, qualidadeDaGema)?.stats?.raioFinal ?? null : null;
  // (a Blasfêmia: a maldição em aura também conta como Habilidade Aura — "Efeito em Área de Habilidades de Aura" — e a área da própria Blasfêmia)
  const porTag = raioM ? ModsPoe.somaPorTags(f, [...tagsPoeDaSkill(entry), ...(efeitoDaGema?.maldicaoEmAura ? ['aura'] : [])]) : null;
  const raioCasas = raioM ? (raioM / 2) * Math.sqrt(ModsPoe.fatorDaArea(valorPoe(f, 'area_inc') + (porTag.area_inc ?? 0) + (areaDaGema.areaIncPct ?? 0) + (Number(efeitoDaGema?.areaIncPct) || 0) + (Number(efeitoDaGema?.areaMaldicaoPct) || 0), valorPoe(f, 'area_mais') + (porTag.area_mais ?? 0), Number(efeitoDaGema?.areaMaisPct) || 0)) : 0;
  return [...saida, {
    efeito: 'maldicaoRegras', limite: marca ? 1 : 1 + Math.max(0, valorPoe(f, 'maldicoes_adicionais')), nome: GemasPoe.doSlug(entry.poeGema.slug)?.gema?.nome ?? null,
    ...(marca ? { marca: true } : {}), ...(ehFeitico ? { feitico: true } : {}), ...(valorPoe(f, 'feitico_afeta_aprova') > 0 || valorPoe(f, `feitico_afeta_aprova:${entry.poeGema.slug}`) > 0 ? { afetaAProva: true } : {}),
    ...(expirou.length ? { expirou } : {}), ...(desacelera ? { desacelera } : {}), ...(regenMenos ? { regenMenos } : {}), ...(lentoApos ? { lentoApos } : {}), ...(danoApos ? { danoApos } : {}),
    ...(valorPoe(f, 'amaldicoado_sem_recarga_es') > 0 ? { semRecargaEs: true } : {}), ...(valorPoe(f, 'amaldicoado_destruido') > 0 ? { destruir: true } : {}),
    ...(Object.keys(daMarca).length ? { daMarca } : {}), ...(raioCasas > 0 ? { raioCasas } : {}),
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
function fragmentosNoUso(estado, hunt, entry, efeitoDaGema, agora, { doTotem = false } = {}) {
  if (!entry.poeGema || !efeitoDaGema || !itensPoeLigado()) return null;
  const d = doAcoDaGema(entry.poeGema.slug, efeitoDaGema.nivel ?? 1);
  // (lote G20a: a gema cujo TOTEM gasta os fragmentos — "Ataque do Totem consome até 1 dos Fragmentos de Aço" — gasta no uso do totem, `doTotem`)
  if (!d || !!d.doTotem !== doTotem) return null;
  const ficha = Ficha.combate(estado);
  const antes = Aco.aco(hunt).fragmentos;
  const gastos = Aco.consumir(hunt, ficha, d.consome + consumoExtraDoAco(ficha, entry), agora);
  Object.assign(efeitoDaGema, Aco.projeteisNoUso(d, gastos, { base: efeitoDaGema.projeteisBase ?? 1, extras: efeitoDaGema.alvosExtras ?? 0, divisao: efeitoDaGema.divisao ?? 0 }));
  if (d.protecao) {
    const duracaoMs = Math.round((GemasPoe.compilada(entry.poeGema.slug, efeitoDaGema.nivel ?? 1, efeitoDaGema.qualidade ?? 0)?.stats?.duracao ?? 0) * 1000 * fatorDeDuracao(estado, entry, efeitoDaGema));
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

/**
 * (lote G-A, dono 25/10) O Impelir do Clamor que ESTE uso da gema de ataque recebe (`hunt.impelidos` — o mesmo critério das tags do golpe, `condicoes-poe.fichaDoGolpe`:
 * não a Emboscada, não o que não pode ser Impelido, não o totem; o Sísmico só nas Pancadas, o Ancestral só nos Golpes — `GemasGAC.impeleEste`), ou null.
 */
function impelidoNoUso(estado, entry) {
  const im = estado?.hunt?.impelidos;
  if (!itensPoeLigado() || !entry?.poeGema?.ataque || !im) return null;
  if (estado.hunt.emboscada?.ate > (estado.hunt.clock ?? 0)) return null;
  const tags = tagsPoeDaSkill(entry);
  if (tags.includes('naoImpelivel') || tags.includes('totem')) return null;
  // (lote S1, dono 26/10) todos os Clamores que impelem este ataque (um Impelir por Clamor — `GemasGAC.impelemEste`): os `de` de cada um, os alvos a mais somados e quantos
  const lista = GemasGAC.impelemEste(im, tags, estado.hunt.clock ?? 0);
  if (!lista.length) return null;
  return { lista, clamores: lista.length, des: lista.map((x) => x.de).filter(Boolean), alvosExtra: lista.reduce((t, x) => t + (Number(x.alvosExtra) || 0), 0) };
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
  const a = GemasPoe.alvosNoNivel(entry.poeGema.slug, efeito.nivel ?? 1, efeito.qualidade ?? 0);
  const e = { ...efeito };
  if (a.proximos) e.proximosDoAlvo = a.proximos;
  // (17/10, lote G18a) o Golpe Vulcânico e as Lâminas Gélidas: o golpe direto é o corpo a corpo e os N projéteis saem DO ALVO além dele (o PoB:
  // ProjectilesNotFromUser — "Dispara 4 projéteis" são as 4 bolas) — o direto não ocupa um dos projéteis
  if (/^(?:Vaal_)?(?:Molten_Strike|Frost_Blades)/.test(entry.poeGema.slug)) e.alvosExtras = (e.alvosExtras ?? 0) + 1;
  // PoE: os das PEÇAS — "Habilidades disparam N Projéteis adicionais", "Ataques com Arco disparam N Flechas adicionais", "Gemas Encaixadas
  // atiram N Projéteis adicionais" (a peça da gema), "Projéteis Perfuram N Alvos" e a "Área de Efeito aumentada" (lote 36: o "aumentado" e o
  // "mais" em %, com os dos suportes; o raio da forma cresce × √ no uso — `ModsPoe.casasPelaArea`) — `itens-poe/mods-poe.mjs`.
  // (17/10: + a área das linhas locais da gema — "X% mais Área de Efeito por Carga de Tolerância" — `comAsLinhasDaGema`)
  // (lote G-A, dono 25/10) o ataque IMPELIDO pelo Clamor (o próximo uso gasta um): as tags `impelido`/`impelidoClamor` na área — "Ataques Impelidos têm 50% mais Área de
  // Efeito" (o Sísmico) — e, no Golpe, os alvos a mais do Ancestral ("Golpes Impelidos focam em 2 Inimigos adicionais")
  const impelidoAgora = impelidoNoUso(estado, entry);
  // (revisão G: + `impelidoClamor_<slug>` — os bônus do buff de um Clamor só no ataque Impelido por ELE — `GemasPoe.adds`)
  const tagsDoUso = impelidoAgora ? [...tagsPoeDaSkill(entry), 'impelido', 'impelidoClamor', ...impelidoAgora.des.map((d) => `impelidoClamor_${d}`)] : tagsPoeDaSkill(entry);
  // (lote S1, dono 26/10) o Esforço Excessivo: "X% mais Dano por cada Clamor que os Impelir" — × os Clamores que impelem este ataque
  if (impelidoAgora && e.impelidoPorClamorMaisPct > 0) e['af:mais_dano@impelido'] = (e['af:mais_dano@impelido'] ?? 0) + e.impelidoPorClamorMaisPct * impelidoAgora.clamores;
  const dasPecas = estado ? ModsPoe.alvosDasPecas(estado, comAsLinhasDaGema(estado, Ficha.combate(estado), entry, efeito), entry, tagsDoUso, Gemas.skillsAtivas(estado).get(entry.id)?.onde?.slot ?? null) : null;
  if (impelidoAgora?.alvosExtra && tagsDoUso.includes('golpe')) e.alvosExtras = (e.alvosExtras ?? 0) + impelidoAgora.alvosExtra;
  // (lote A3, D5: o `divide` do feixe; a divisão do projétil — `partir` — é do alvo atingido, `comOsProjeteisDaGema`)
  e.alvosExtras = (e.alvosExtras ?? 0) + a.projeteis + a.divide - (a.partir ?? 0) + (dasPecas?.projeteis ?? 0);
  // (12/10) A divisão da gema (o Aço Violento: "Projéteis se Partem na direção de N alvos") — o "Se você não tiver Fragmentos de Aço,
  // Projéteis contam como se já tivessem se Partido" a tira (`fragmentosNoUso`); e o "Habilidades Disparam N Projéteis adicionais por S
  // segundos após você consumir um total de T Fragmentos de Aço" (o Verme de Aço — `itens-poe/convocar-o-aco.mjs`).
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
    // (lote G14: + o do suporte — "têm alcance do Ricochete aumentado em X%", o Encadear)
    e.alcanceRicochetePct = ModsPoe.valor(fichaDoAlvo, 'alcance_ricochete_inc') + (efeito.alcanceRicochetePct ?? 0);
    // (lote 40) a gema do PoE: o ricochete do projétil salta os 6 m do PoE 2 (`Secundarios.resolver`)
    e.ricochetePoe = true;
    e.retornarChance = ModsPoe.valor(fichaDoAlvo, 'proj_retornar_chance');
    // (lote E1b, 26/10: + o "Projéteis Ricocheteiam ao colidirem com o terreno" da própria gema — a Relampejante das Fagulhas, 100%)
    e.ricocheteTerrenoChance = ModsPoe.valor(fichaDoAlvo, 'proj_ricochete_terreno_chance') + GemasPoe.ricocheteNoTerrenoDaGema(entry.poeGema.slug, efeito.nivel ?? 1);
    if (ModsPoe.valor(fichaDoAlvo, 'proj_direcoes_aleatorias') > 0) e.direcoesAleatorias = true;
    if (ModsPoe.valor(fichaDoAlvo, 'barragem_nao_propaga') > 0) e.semPropagar = true;
  }
  // (lote A3, dono 19/10 — D10: a perfuração SOMA a da gema, a dos suportes e a das peças, como no PoE — antes valia a maior da gema e do suporte;
  // 99 = "todos")
  e.perfurar = Math.min(99, (e.perfurar ?? 0) + a.perfurar + (dasPecas?.perfurar ?? 0));
  if (dasPecas?.areaInc) e.areaIncPct = (e.areaIncPct ?? 0) + dasPecas.areaInc;
  // (17/10, lote G2) a "Área de Efeito aumentada em X%" da PRÓPRIA gema (do nível e da qualidade): soma com a das peças e a dos suportes
  const daGema = GemasPoe.areaNoNivel(entry.poeGema.slug, efeito.nivel ?? 1, efeito.qualidade ?? 0);
  if (daGema.areaIncPct) e.areaIncPct = (e.areaIncPct ?? 0) + daGema.areaIncPct;
  if (dasPecas?.areaMais) e.areaMaisPct = ((1 + (e.areaMaisPct ?? 0) / 100) * Math.max(0, 1 + dasPecas.areaMais / 100) - 1) * 100;
  // "Habilidades Ricocheteiam +N vezes": os ricochetes do projétil (os saltos da cadeia, na magia de cadeia).
  if (dasPecas?.ricochetes) e.encadear = (e.encadear ?? 0) + dasPecas.ricochetes;
  e.bifurcar = Math.max(e.bifurcar ?? 0, a.bifurcar) + (dasPecas?.bifurcar ?? 0);
  // (13/10) "Projéteis têm X% de chance de receber um Projétil adicional quando Difundindo" (`Secundarios.resolver`).
  // (lote G20a: + o da GEMA — a Balista de Cerco Fragmentadora, na qualidade —, e o "Projéteis podem Difundir N Vezes adicionais" dela)
  // (lote A3: + o do SUPORTE — a Difusão Maior, "X% de chance de ganhar um Projétil adicional ao Difundirem"; antes esta linha o sobrescrevia)
  if (estado || a.difusaoExtraChance || efeito.bifurcarExtraChance) e.bifurcarExtraChance = (estado ? ModsPoe.valor(Ficha.combate(estado), 'proj_difusao_extra_chance') : 0) + (a.difusaoExtraChance ?? 0) + (efeito.bifurcarExtraChance ?? 0);
  // (14/10, o Grande Emissário das Direções: "Projéteis Difundem e Difundem de novo" — os filhos da difusão difundem mais N vezes)
  // (lote A3: + o do SUPORTE — a Difusão Maior e a Desperta, "podem Difundir N Vezes adicionais"; antes esta linha o sobrescrevia)
  if ((estado || a.difundirDeNovo || efeito.bifurcarDeNovo) && e.bifurcar > 0) e.bifurcarDeNovo = (estado ? Math.max(0, Math.floor(ModsPoe.valor(Ficha.combate(estado), 'bifurcar_de_novo'))) : 0) + (a.difundirDeNovo ?? 0) + (efeito.bifurcarDeNovo ?? 0);
  if (entry.cadeia) {
    e.cadeiaPoe = { saltos: a.saltos + (e.encadear ?? 0), pct: a.pctPorRestante };
    e.encadear = 0;
  } else {
    e.encadear = (e.encadear ?? 0) + a.saltos;
    // (lote G18: o "% mais dano por Ricochete restante" do projétil que ricocheteia — o Chicote da Naja —, no motor dos secundários e no golpe direto)
    if (a.pctPorRestante) e.pctPorRicocheteRestante = a.pctPorRestante;
  }
  // (lote S1, 26/10) a Propagação Maior: "se propagam X% mais vezes" — o total de Ricochetes × (1 + X%), para baixo
  if (efeito.encadearMaisPct > 0) {
    const mais = (n) => Math.floor((Number(n) || 0) * (1 + efeito.encadearMaisPct / 100));
    if (e.cadeiaPoe) e.cadeiaPoe = { ...e.cadeiaPoe, saltos: mais(e.cadeiaPoe.saltos) };
    else e.encadear = mais(e.encadear);
  }
  // ("Projéteis param ao colidir com um alvo": sem perfurar, difundir nem ricochetear.)
  if (dasPecas?.param) {
    e.perfurar = 0;
    e.bifurcar = 0;
    e.bifurcarDeNovo = 0;
    e.encadear = 0;
    // (lote 80, o Cineticismo: "não podem Ricochetear" — o ricochete no terreno também é Ricochete, o CannotChain do PoB)
    e.ricocheteTerrenoChance = 0;
    if (e.cadeiaPoe) e.cadeiaPoe = { ...e.cadeiaPoe, saltos: 0 };
  }
  // (lote PR1, dono 20/10) o ARREMESSO DE ESCUDO ESPECTRAL: os projéteis adicionais são as ESTILHAS (`GemasPR1.estilhasNoUso`) — o escudo não perfura e as solta a
  // cada colisão (`Secundarios.resolver`); o de Trarthus perfura e as solta do lugar onde para (`criarObjetosDoUso`)
  const comEstilhas = GemasPR1.estilhasNoUso(comOsProjeteisDaGema(e, a), GemasPoe.estilhasDaGema(entry.poeGema.slug, efeito.nivel ?? 1));
  // (lote PR3, dono 21/10) o que o projétil da gema GERA (`itens-poe/gemas-pr3.mjs`, `Secundarios.resolver`): os secundários do Tiro Tornado (`tornado`), as
  // explosões da Explosão Cinética (`cinetica` — na da Ramificação, os projéteis adicionais viram explosões) e o rodízio do Aço Perfurador (`lanca`)
  const slug = entry.poeGema.slug;
  const tornado = GemasPoe.tornadoDaGema(slug, efeito.nivel ?? 1);
  if (tornado) comEstilhas.tornado = tornado;
  const lanca = GemasPoe.lancaDaGema(slug, efeito.nivel ?? 1);
  if (lanca) comEstilhas.lanca = lanca;
  return GemasPR3.cineticaNoUso(comEstilhas, GemasPoe.cineticaDaGema(slug, efeito.nivel ?? 1, efeito.qualidade ?? 0));
}

/**
 * (lote A3, dono 19/10) O que a gema e os suportes dizem do PROJÉTIL além dos alvos (`GemasPoe.alvosNoNivel`, `Secundarios.resolver`):
 * - a DIVISÃO (D5): "Projéteis se Partem na direção de N alvos" — do alvo atingido, N projéteis para os mais próximos (`divisao`); "Modificadores do
 *   número de Projéteis ao invés são aplicados ao número de alvos … da Divisão" (os projéteis a mais viram alvos da divisão); "podem se Dividir sem
 *   acertar um alvo" (no fim do voo) e "ao acertar o terreno"; "não podem se Partir" (sem divisão);
 * - o "Atravessaram causam X% mais Dano" (F3), o retorno da gema (F4: o Giro Venenoso, o Arremesso Espectral — com o % e a reta da volta), as
 *   rampas de distância (F2: o Pulso Congelante, o Olho Invernal), as direções aleatórias (a Vaal Faísca), o salto no solo (o Magma Rolante);
 * - as REBATIDAS (D6): a Hélice — os projéteis a mais viram rebatidas — e a Vaal Flecha Relampejante — os ricochetes e a difusão viram mudanças de
 *   direção;
 * - a emissão (F7, D7): os "em até N Inimigos ao redor", o "por projétil disparado anteriormente em sequência", a Nova de Flechas (o círculo do
 *   ponto do alvo), a Saraivada (origens laterais) e o mínimo/menos projéteis do Localizar e da Mina Locus.
 */
function comOsProjeteisDaGema(e, a) {
  if (a.atravessouMaisPct) e.atravessouMaisPct = (e.atravessouMaisPct ?? 0) + a.atravessouMaisPct;
  if (a.retornar) e.retornar = Math.max(e.retornar ?? 0, a.retornar);
  if (a.danoDoRetornoPct != null) e.danoDoRetornoPct = ((e.danoDoRetornoPct ?? 100) * a.danoDoRetornoPct) / 100;
  if (a.voltaAtravessa) e.voltaAtravessa = 1;
  if (a.soNaVolta) e.soNaVolta = true;
  // (revisão do PR3, 21/10) a 1ª forma da Lança Gélida atravessa (`Secundarios.resolver`)
  if (a.perfuraNaPrimeiraForma) e.perfuraNaPrimeiraForma = a.perfuraNaPrimeiraForma;
  if (a.rampaMaisPct) e.rampaMaisPct = a.rampaMaisPct;
  if (a.rampaCongelar) e.rampaCongelar = a.rampaCongelar;
  if (a.direcoesAleatorias) e.direcoesAleatorias = true;
  if (a.saltoNoSolo) e.saltoNoSolo = true;
  // (lote PR2) o Composto Venenoso Saltador: o rumo de cada salto no solo, sorteado
  if (a.saltoAleatorio) e.saltoAleatorio = true;
  if (a.aoRedor) e.aoRedor = (e.aoRedor ?? 0) + a.aoRedor;
  if (a.porProjetilAnteriorPct) e.porProjetilAnteriorPct = (e.porProjetilAnteriorPct ?? 0) + a.porProjetilAnteriorPct;
  if (a.extrasNoAlvo) e.extrasNoAlvo = true;
  if (a.simultaneos) e.simultaneos = (e.simultaneos ?? 0) + a.simultaneos;
  // (revisão do A3: o Raio Cinético — a Difusão vira mudança de direção, que não se aplica: nada)
  if (a.semDifundir) { e.bifurcar = 0; e.bifurcarDeNovo = 0; e.bifurcarExtraChance = 0; }
  // a divisão
  if (a.partir) e.divisao = (e.divisao ?? 0) + a.partir;
  if (a.extrasNaDivisao && e.divisao) { e.divisao += Math.max(0, e.alvosExtras ?? 0); e.alvosExtras = 0; }
  if (a.partirSemAcertar) e.dividirSemAcertar = true;
  if (a.partirNoTerreno) e.dividirNoTerreno = true;
  if (a.semPartir) e.divisao = 0;
  // as rebatidas
  if (a.rebatidas) {
    e.rebatidas = a.rebatidas;
    // (revisão do A3: a Hélice só rebate em parede — `Secundarios.resolver`)
    if (a.rebatidasNoTerreno) e.rebatidasNoTerreno = true;
    if (a.extrasNasRebatidas) { e.rebatidas += Math.max(0, e.alvosExtras ?? 0); e.alvosExtras = 0; }
    if (a.ricochetesNasRebatidas) { e.rebatidas += Math.max(0, e.encadear ?? 0) + (e.bifurcar > 0 ? 1 : 0); e.encadear = 0; e.bifurcar = 0; e.bifurcarDeNovo = 0; }
  }
  // o mínimo e o "menos Projéteis" (a Mina Locus: o total × (1 − X%), para baixo — a regra do PoB para a contagem —, e o "ao menos N")
  if (e.menosProjeteisPct > 0 || e.projeteisMinimo > 0) {
    const base = Math.max(1, Math.round(Number(e.projeteisBase) || 1));
    const total0 = base + Math.max(0, Math.round(Number(e.alvosExtras) || 0));
    const total = Math.max(Math.round(e.projeteisMinimo || 1), Math.floor(total0 * Math.max(0, 1 - (e.menosProjeteisPct ?? 0) / 100) + 1e-9));
    e.projeteisBase = Math.min(base, total);
    e.alvosExtras = total - e.projeteisBase;
  }
  return e;
}

/**
 * (lote A3, dono 19/10 — D1: "a velocidade de projétil segue o PoB") A VELOCIDADE DE PROJÉTIL deste uso: o "aumentada" (o da ficha — a árvore e as
 * peças —, o da gema e o dos suportes: `af:projectile_speed`) e o "mais/menos" (o da gema e o dos suportes: `velProjetilMaisPct`, que multiplica).
 * `mod` é o ProjectileSpeedMod do PoB — (1 + aumentada) × mais: o voo na tela (o `vel` do tiro) e as rampas do Pulso e do Olho. `localIncPct` é o
 * "aumentada" só do uso (a gema e os suportes): o "Aumentos e Reduções à Velocidade de Projéteis também se aplicam ao Dano com Arcos" — o da ficha já
 * vale pela soma. O alcance não muda (7 casas).
 */
export function velocidadeDoProjetil(estado, entry, efeito) {
  const a = entry?.poeGema && !entry.poeGema.buff ? GemasPoe.alvosNoNivel(entry.poeGema.slug, efeito?.nivel ?? 1, efeito?.qualidade ?? 0) : null;
  const global = estado ? ModsPoe.valor(Ficha.combate(estado), 'projectile_speed') : 0;
  const localIncPct = (a?.velInc ?? 0) + (Number(efeito?.['af:projectile_speed']) || 0);
  const mais = (a?.velMais ?? 1) * Math.max(0, 1 + (Number(efeito?.velProjetilMaisPct) || 0) / 100);
  return { incPct: global + localIncPct, localIncPct, mais, mod: Math.max(0.05, (1 + (global + localIncPct) / 100) * mais) };
}

/** O personagem olha para `para` (0 norte, 1 leste, 2 sul, 3 oeste — o eixo de maior distância), se não está na mesma casa. */
export function virarParaOAlvo(hunt, para) {
  if (!hunt?.pos || !para || (para.x === hunt.pos.x && para.y === hunt.pos.y)) return;
  const dx = para.x - hunt.pos.x;
  const dy = para.y - hunt.pos.y;
  hunt.pos.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
}

/**
 * O total do DANO DEGENERATIVO de uma parte `p` da gema (`{ elemento, dps }` — `GemasPoe.degenerativoNoNivel`) por `durMs`, com a conta do uso
 * (`contaDoDano`: o fator da gema e os suportes, a ficha do golpe): o Multiplicador de Dano Degenerativo (o geral e o do elemento), o "Dano
 * Degenerativo aumentado" (o geral, o do elemento — lote 65 — e o do elemento da ficha) e o "mais" do degenerativo. Sem o "mais/menos Dano com
 * Acertos" do fator da gema (lote G17: o degenerativo não é acerto); na gema cujo degenerativo leva os modificadores de Dano Mágico (o
 * `dotIsSpell` do PoB), o "mais Dano Mágico" dos suportes e da ficha volta (lote G18a). (Lote G20d: uma função só — o acerto e o feixe do Vínculo
 * Abrasador.)
 */
function totalDoDegenerativo(p, durMs, { efeitoDaGema, ficha, fatorDaGema, soAcertoDaFicha = 1, dotMagico = false }) {
  const a = ficha.afeccoes ?? AfeccoesPoe.daSoma(ficha.afPoe ?? {});
  const MULTI = { fire: a.multiplicadorFogo, ice: a.multiplicadorGelo, energy: a.multiplicadorRaio, chaos: a.multiplicadorCaos, physical: a.multiplicadorFisico };
  const maisDoDot = Math.max(0, 1 + (efeitoDaGema?.maisDotPct ?? 0) / 100) * Math.max(0, 1 + (efeitoDaGema?.[MAIS_DOT_DO_ELEMENTO[p.elemento]] ?? 0) / 100);
  const voltaMagico = dotMagico ? Math.max(0, 1 + (efeitoDaGema?.maisDanoMagicoPct ?? 0) / 100) * (soAcertoDaFicha ?? 1) : 1;
  return p.dps * (durMs / 1000) * (fatorDaGema / Math.max(1e-9, (1 + (efeitoDaGema?.maisDanoAcertoPct ?? 0) / 100) * (soAcertoDaFicha ?? 1))) * voltaMagico * maisDoDot * (1 + ((a.multiplicador ?? 0) + (MULTI[p.elemento] ?? 0)) / 100) * (1 + ((a.danoAumentado ?? 0) + (ficha.danoDoElemento?.[p.elemento] ?? 0) + (a.danoDegenDoElemento?.[p.elemento] ?? 0)) / 100) * Math.max(0, 1 + (a.dotMais ?? 0) / 100);
}

/**
 * (18/10, lote G20d) O VÍNCULO ABRASADOR (act_str.lua:9494-9625): "Summons a totem that casts a beam of fire at you and each other totem you
 * control, dealing burning damage to enemies caught in the beam. Enemies near either end of a beam also suffer burning damage." O feixe do totem
 * `l` vai a você e a cada outro totem dele (as casas da reta, Bresenham) e queima quem está nas casas dele e nas 8 em volta de cada ponta (o "perto
 * da ponta" não tem número no PoB: a casa vizinha). A queima é o degenerativo da gema por `FEIXE_MS`, renovado a cada tique dele, com a conta do
 * uso (os suportes, o Dano Mágico — `spell_damage_modifiers_apply_to_skill_dot`); uma queima da gema por inimigo (a chave dela: não soma entre
 * os feixes). Os acertos não são seus (`fonte: 'totem'`). Devolve os eventos.
 */
export const FEIXE_MS = 500;
function dadosDoDegenerativoDoTotem(estado, l, maisPct = 0) {
  const base = POR_ID.get(l.acao);
  if (!base?.poeGema) return null;
  const entry = { ...base, papeis: ['attack'], poeGema: { ...base.poeGema, lacaio: undefined, doTotem: true } };
  const efeito = comOsAlvosDaGema(entry, Gemas.ehSkillDeGema(entry) ? Gemas.efeitoNaSkill(estado, entry.id) : null, estado) ?? null;
  const dg = GemasPoe.degenerativoNoNivel(entry.poeGema.slug, efeito?.nivel ?? 1, efeito?.qualidade ?? 0);
  if (!dg) return null;
  const { fatorDaGema, ficha, soAcertoDaFicha } = contaDoDano(estado, entry, efeito, Ficha.combate(estado), null, { maisDano: maisPct });
  return { entry, dg, conta: { efeitoDaGema: efeito, ficha, fatorDaGema, soAcertoDaFicha, dotMagico: GemasPoe.dotEhMagico(entry.poeGema.slug) } };
}
const casasDaReta = (a, b) => {
  const r = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 200; i++) {
    r.push(`${x},${y}`);
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return r;
};
function queimarCasas(hunt, casas, d, durMs, agora, eventos) {
  for (const m of hunt.monstros ?? []) {
    if (!(m.hp > 0) || m.dummy || !casas.has(`${m.x},${m.y}`)) continue;
    for (const p of d.dg.partes) {
      const posto = Dot.aplicar(m, { tipo: GemasPoe.DEGEN_DO_ELEMENTO[p.elemento], total: totalDoDegenerativo(p, durMs, d.conta), duracaoMs: durMs, chave: d.entry.poeGema.slug, origem: { fonte: 'totem', habilidade: d.entry.id } }, agora);
      if (posto) eventos.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: posto });
    }
  }
}
export function feixeDoVinculo(estado, hunt, l, agora = hunt?.clock ?? 0) {
  const d = dadosDoDegenerativoDoTotem(estado, l);
  if (!d || !hunt?.pos) return [];
  const pontas = [hunt.pos, ...(hunt.lacaios ?? []).filter((x) => x !== l && x.hp > 0 && x.tipo === 'totem' && x.gema === l.gema)];
  const casas = new Set();
  const emVolta = (c) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) casas.add(`${c.x + dx},${c.y + dy}`); };
  emVolta(l);
  for (const p of pontas) {
    for (const c of casasDaReta(l, p)) casas.add(c);
    emVolta(p);
  }
  const eventos = [];
  queimarCasas(hunt, casas, d, FEIXE_MS, agora, eventos);
  return eventos;
}
/**
 * (lote G20d) A DETONAÇÃO do Vínculo Abrasador da Detonação: "Reaching maximum active totem count will cause all totems from this skill to detonate,
 * applying the same burning damage for a duration" — cada totem da gema some e queima os inimigos no raio dele (2,7 m no nível 20, × √ da Área de
 * Efeito) pela duração da gema (4 s), com "+30% (+0,5 por % de qualidade) mais Dano Degenerativo por totem detonado" (MORE por TotemsSummoned —
 * act_str.lua:9590-9611). Devolve os eventos.
 */
export function detonarVinculos(estado, hunt, slug, agora = hunt?.clock ?? 0, rng = Math.random) {
  const totens = (hunt.lacaios ?? []).filter((x) => x.hp > 0 && x.tipo === 'totem' && x.gema === slug);
  if (!totens.length) return [];
  const ef = Gemas.efeitoNaSkill(estado, POR_ID.get(totens[0].acao)?.id);
  const porTotem = [...GemasPoe.textosDaGema(slug, ef?.nivel ?? 1).linhas, ...GemasPoe.linhasDaQualidadeDe(slug, ef?.qualidade ?? 0)]
    .reduce((n, x) => n + (Number(/^Dano abrasador aplicado pela detonação causa \+ ?([\d.]+) ?% de dano por totem detonado$/i.exec(x)?.[1]) || 0), 0);
  const d = dadosDoDegenerativoDoTotem(estado, totens[0], porTotem * totens.length);
  const eventos = [];
  if (d) {
    const area = GemasPoe.areaNoNivel(slug, ef?.nivel ?? 1, ef?.qualidade ?? 0);
    const ficha = Ficha.combate(estado);
    const raioM = (area.raioM ?? 2.7) * Math.sqrt(ModsPoe.fatorDaArea((area.areaIncPct ?? 0) + ModsPoe.valor(ficha, 'area_inc'), ModsPoe.valor(ficha, 'area_mais')));
    const durMs = Math.round(d.dg.duracaoMs * fatorDeDuracao(estado, d.entry, d.conta.efeitoDaGema));
    for (const t of totens) {
      const r = Math.floor(raioM / 2) + (rng() < (raioM / 2) % 1 ? 1 : 0);
      const casas = new Set();
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) casas.add(`${t.x + dx},${t.y + dy}`);
      queimarCasas(hunt, casas, d, durMs, agora, eventos);
      eventos.push({ t: 'explosao', id: d.entry.efeito ?? 6, x: t.x, y: t.y, lado: 2 * r + 1, sk: d.entry.id });
    }
  }
  for (const t of totens) t.hp = 0;
  return eventos;
}

/** A entrada do catálogo de ações pelo id (o totem do PoE usa a skill da gema dele). */
export const POR_ID_PUBLICO = (id) => POR_ID.get(id) ?? null;

/**
 * (18/10, lote G20a) O TOTEM `l` usa a habilidade da gema no `alvo` pelo MESMO caminho do seu uso, do lugar dele (`dispararSemMarcar` com `plantada`
 * do tipo 'totem': sem custo, recarga, conjuração nem as condições do slot — o tempo é o do totem, `cacadas.golpeDoTotem`). O PoB: a skill do totem
 * é a sua, com os seus modificadores; os acertos NÃO são seus (CalcPerform.lua:264) — o abate é do totem (`matarTotem`), sem o seu dreno, a vida e
 * a mana no acerto, as cargas e os "Acertou Recentemente"; o "Drenado como Vida" dos seus Totens vale. Devolve os eventos (null: não saiu).
 */
export function usarComoTotem(estado, hunt, personagem, l, alvo) {
  // (a ficha é a medida da SUA casa — as condições de presença, "perto de você"; se algo a refizer com a posição trocada, ela é esquecida no fim)
  const antes = Ficha.combate(estado);
  const pos = hunt.pos;
  // (o revezamento das mãos e o "local anterior" das Habilidades de Golpe são do totem, não os seus)
  const seus = { golpeDaSecundaria: hunt.golpeDaSecundaria, golpeAnterior: hunt.golpeAnterior };
  hunt.golpeDaSecundaria = l.golpeDaSecundaria;
  hunt.golpeAnterior = l.golpeAnterior;
  hunt.pos = { ...pos, x: l.x, y: l.y };
  try {
    const r = dispararSemMarcar(estado, hunt, personagem, null, alvo, { plantada: { tipo: 'totem', acao: l.acao, uid: l.uid, x: l.x, y: l.y, z: hunt.z ?? 0, dono: pos } });
    if (!r?.ok) return null;
    const eventos = r.eventos ?? [];
    // (o dano do totem vai marcado como o dos lacaios — `lacaio` no evento, como no golpe antigo dele)
    for (const ev of eventos) if (ev.t === 'dmg' && ev.foe) ev.lacaio = true;
    return eventos;
  } finally {
    hunt.pos = pos;
    l.golpeDaSecundaria = hunt.golpeDaSecundaria;
    l.golpeAnterior = hunt.golpeAnterior;
    Object.assign(hunt, seus);
    if (Ficha.fichaGuardada(estado) !== antes) Ficha.invalidar(estado);
  }
}

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
/**
 * (18/10, lote G20a) O ALCANCE do totem: o de CORPO A CORPO (os ancestrais — a gema com a tag Corpo a Corpo) é o do seu golpe corpo a corpo em metros —
 * o da arma + o "+X metros ao Alcance de Golpes Corpo a Corpo" das peças e da própria gema (o Protetor: +1,8 m) —, 1 + ⌊metros / 2⌋ casas (a regra do
 * lote 35); antes eram 6 casas. O resto, o da habilidade (no mínimo 3 casas; sem alcance, 6).
 */
/** (lote G20c) Um raio em metros em casas (1 casa = 2 m): a parte inteira e a fração como chance de mais uma — a conversão das áreas. */
/**
 * (revisão do C1) O PUXÃO (a Corrente de Anzol para Pesca): o bicho não Único (nem chefe, nem boneco) a mais de 1 casa de você vem para a casa livre e andável mais perto
 * de você na reta de você até ele — o contrário do Empurrão (`ModsPoe.empurrar`: a mesma grade do andar e as mesmas casas ocupadas). Devolve true se moveu.
 */
export function puxarParaPerto(hunt, bicho) {
  if (!hunt?.pos || !bicho || bicho.boss || bicho.chefe || bicho.dummy || /unico/.test(bicho.raridade ?? bicho.raridadePoe ?? '')) return false;
  const d = distanciaChebyshev(hunt.pos, bicho);
  if (d <= 1) return false;
  const andavel = ModsPoe.gradeDoCombate(hunt)?.andavel ?? null;
  const livre = (c) => (!andavel || andavel.has(`${c.x},${c.y}`)) && !(c.x === hunt.pos.x && c.y === hunt.pos.y) && !hunt.monstros.some((m) => m !== bicho && m.hp > 0 && m.x === c.x && m.y === c.y);
  const c = Areas.reta(hunt.pos, bicho, d - 1).find(livre);
  if (!c) return false;
  bicho.x = c.x;
  bicho.y = c.y;
  bicho.andouEm = hunt.clock ?? 0;
  return true;
}
const casasDoRaio = (metros, rng = Math.random) => Math.floor(metros / 2) + (rng() < (metros / 2) % 1 ? 1 : 0);
function alcanceDoTotem(entry, estado) {
  if (!tagsPoeDaSkill(entry).includes('corpo')) return Math.max(3, entry.range || 6);
  const ef = estado ? Gemas.efeitoNaSkill(estado, entry.id) : null;
  const linhas = [...GemasPoe.textosDaGema(entry.poeGema.slug, ef?.nivel ?? 1).linhas, ...GemasPoe.linhasDaQualidadeDe(entry.poeGema.slug, ef?.qualidade ?? 0)];
  const daGema = linhas.reduce((n, l) => n + (Number(/^\+([\d.]+) metros? ao Alcance de Golpes Corpo a Corpo$/i.exec(l)?.[1]) || 0), 0);
  const metros = estado ? Ficha.alcanceCorpoEmMetros(estado.equipment?.weapon ?? null, Ficha.combate(estado).afPoe ?? {}) : 0;
  return 1 + Math.floor((metros + daGema) / 2);
}
function invocarLacaios(hunt, entry, efeito, alvo, estado = null, { semUso = false } = {}) {
  const slug = entry.poeGema.slug;
  // (PoE: "usou uma Habilidade de Lacaio Recentemente". Lote 75: `semUso` — o Rastejador que o Arauto da Agonia chama ao Envenenar não é uso.)
  if (!semUso) ModsPoe.marcar(hunt, 'usouLacaio');
  const q = LacaiosPoe.oQueInvoca(slug, efeito?.nivel ?? 1, efeito, estado ? Ficha.combate(estado)?.afPoe ?? null : null);
  // (a restrição de uma peça — "Você não pode ter Lacaios não-Golens": o de outro tipo não vem)
  if (!q || q.proibido) return [];
  const agora = hunt.ultimoTique ?? Date.now();
  const eventos = [];
  hunt.lacaios ??= [];
  // A OFERENDA: o bônus em todos os lacaios em campo, pela duração dela.
  if (q.tipo === 'oferenda') {
    // (dono, 26/10 — as Oferendas do PoE: "Consome um cadáver… e os outros cadáveres próximos, com a duração aumentada por cadáver consumido") consome os
    // cadáveres a até 4 casas (`GemasE1a.cadaveresDaOferenda`); a duração é a base + N s por cadáver extra. Sem cadáver, não sai (`dispararSemMarcar` recusa antes).
    const cadaveres = GemasE1a.cadaveresDaOferenda(hunt);
    if (!cadaveres.length) return eventos;
    const usados = new Set(cadaveres);
    hunt.cadaveres = (hunt.cadaveres ?? []).filter((c) => !usados.has(c));
    for (const c of cadaveres) eventos.push({ t: 'fx', id: 13, x: c.x, y: c.y, sk: entry.id });
    const duracaoMs = GemasE1a.duracaoDaOferenda(q, cadaveres.length);
    for (const l of hunt.lacaios) if (l.hp > 0 && l.tipo === 'lacaio') { l.oferenda = { ...q.bonus, ate: agora + duracaoMs }; eventos.push({ t: 'fx', id: 13, uid: l.uid, x: l.x, y: l.y, sk: entry.id }); }
    // (PoE, o Necromante: "Suas Habilidades de Oferenda também afetam você" — `condicoes-poe.adds`, com o "redução do Efeito em você".)
    if (estado && ModsPoe.valor(Ficha.combate(estado), 'oferenda_em_voce') > 0) { hunt.oferendaEmVoce = { ...q.bonus, ate: (hunt.clock ?? agora) + duracaoMs }; Ficha.invalidar(estado); }
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
  // (lote G20b: + "Habilidades Suportadas Convocam dois Totens ao invés de um" — os Totens Múltiplos)
  // (lote E1a: + o "X% de chance de convocar um Lacaio extra" da qualidade do Espírito Furioso — `q.chanceDeLacaioExtra`)
  const porUso = q.tipo === 'totem' ? Math.max(q.porUso, efeito?.totensPorUso ?? 1, estado && Math.random() * 100 < ModsPoe.valor(Ficha.combate(estado), 'totem_dois_chance') ? 2 : 1) : q.porUso + (q.chanceDeLacaioExtra > 0 && Math.random() * 100 < q.chanceDeLacaioExtra ? 1 : 0) + GemasE1a.sentinelaAMais(q, alvo);
  // (lote G20b) a BALISTA FOCADA: "Totens Balista das Habilidades Suportadas só Atacam quando você disparar um Projétil de Ataque" — só na balista
  const focada = q.tipo === 'totem' && efeito?.balistaFocada > 0 && (efeito?.viraTotem === 2 || (GemasPoe.doSlug(slug)?.gema?.tipos ?? []).includes('TotemsAreBallistae'));
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
      perto: 2, alcance: 0, alcanceDeAtaque: q.tipo === 'totem' ? alcanceDoTotem(entry, estado) : Math.max(1, q.estilo?.alcance ?? 1), proximoGolpe: agora + 400, proximoPassoEm: 0,
      // As HABILIDADES próprias (`LacaiosPoe.oQueInvoca`): o jeito de atacar, a velocidade, o crítico, o dano adicionado, o sangramento e o
      // bônus do golem ao dono (enquanto ele vive — `GemasPoe.adds`).
      estilo: q.estilo ?? null, velAtaquePct: q.velAtaquePct ?? 0, critChance: q.critChance ?? 5, ...(q.critChanceBase != null ? { critChanceBase: q.critChanceBase } : {}), critMult: q.critMult ?? 1.5, somado: q.somado ?? [0, 0], sangrar: q.sangrar ?? 0,
      afDono: q.afDono ?? null, porLacaioFisico: q.porLacaioFisico ?? null, golem: !!q.golem, acertos: 0, poe: q.poe ?? null,
      // (lote 44) o lacaio que no PoE não pode sofrer dano (o PoB) e o tipo dele no PoB
      ...(q.intocavel ? { intocavel: true } : {}), ...(q.pob ? { pob: q.pob } : {}),
      ...(q.tipo === 'totem' && alvo ? { mira: { x: alvo.x, y: alvo.y } } : {}),
      ...(focada ? { focada: true } : {}),
      // (lote G20b) o totem ANCESTRAL do Devastador: a distância de ativação em casas (7 m = 3 casas e meia: a metade é a chance de mais uma, sorteada ao
      // pôr — a mesma conversão das áreas)
      ...(q.tipo === 'totem' && (efeito?.ativacaoM ?? q.efeitosDoTotem?.ativacaoM) > 0 ? { ativacao: casasDoRaio(efeito?.ativacaoM ?? q.efeitosDoTotem.ativacaoM) } : {}),
      // (lote G20c) os efeitos próprios do totem (`LacaiosPoe.efeitosDoTotem`): o buff do ancestral Ativo, a aura do Rejuvenescedor, o Devorador
      ...(q.efeitosDoTotem?.buffAtivo ? { buffAtivo: q.efeitosDoTotem.buffAtivo } : {}),
      ...(q.efeitosDoTotem?.auraDoTotem ? { auraDoTotem: { af: q.efeitosDoTotem.auraDoTotem.af, raio: casasDoRaio(q.efeitosDoTotem.auraDoTotem.raioM), absorvePct: q.efeitosDoTotem.auraDoTotem.absorvePct } } : {}),
      ...(q.efeitosDoTotem?.devorador ? { devorador: q.efeitosDoTotem.devorador } : {}),
      // (lote E1a) o Efeito do Buff do golem (a qualidade), o Ceifador e o "mais Dano por Lacaio Não-Golem próximo" do Golem da Carniça — `GemasE1a`
      ...(q.e1a ?? {}),
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
    // (lote A2, dono 19/10) a Sentinela Divina: a sentinela nasce com uma aura templária sorteada (o raio da aura de lacaio do jogo — 2 casas) e a
    // área dos lacaios suportados cresce
    if (efeito?.auraTemplaria > 0 && /sentinela|sentinel/i.test(`${l.nome} ${GemasPoe.doSlug(slug)?.gema?.en ?? ''}`)) {
      const aura = GemasA2.sortearAuraTemplaria();
      l.auraTemplaria = { nome: aura.nome, af: { ...aura.af }, raio: AURA_DE_LACAIO_CASAS };
    }
    if (efeito?.areaLacaioPct > 0 && l.poe) l.poe = { ...l.poe, areaPct: (l.poe.areaPct ?? 0) + efeito.areaLacaioPct };
    hunt.lacaios.push(l);
    // (lote G20c) o Solo Sagrado do Flamejante Sagrado em volta dele, enquanto ele viver (`dono`), com a imunidade a maldições
    if (q.efeitosDoTotem?.soloSagradoM) (hunt.solosSagrados ??= []).push({ x: l.x, y: l.y, raio: Math.max(1, casasDoRaio(q.efeitosDoTotem.soloSagradoM)), ate: l.ate ?? Infinity, dono: l.uid, imuneMaldicao: true });
    eventos.push({ t: 'fx', id: 11, uid: l.uid, x: l.x, y: l.y, sk: entry.id });
    if (fichaDoTotem) eventos.push(...aoConvocarTotem(estado, hunt, l, fichaDoTotem, agora));
  }
  // (lote G20d) o Vínculo Abrasador da Detonação: no máximo de totens, todos detonam (`detonarVinculos`)
  if (q.detonaNoMaximo && estado && hunt.lacaios.filter((l) => l.gema === slug && l.hp > 0).length >= q.maximo) {
    eventos.push(...detonarVinculos(estado, hunt, slug, hunt.clock ?? 0));
    return eventos;
  }
  // Passou do máximo da gema: os mais velhos saem.
  const desta = hunt.lacaios.filter((l) => l.gema === slug);
  for (const velho of desta.slice(0, Math.max(0, desta.length - q.maximo))) velho.hp = 0;
  // (lote E1a) o "menos Vida Máxima" do Ceifador nos outros lacaios já na invocação (o tique segue — `LacaiosPoe.aplicarCeifador`)
  LacaiosPoe.aplicarCeifador(hunt.lacaios);
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
    // (lote E1b, dono 26/10) o TOLHIMENTO do PoE (Hinder — Estados.tolher, só no passo), não a lentidão
    Estados.tolher(m, lentidaoPct, duracaoMs, agora, ModsPoe.valor(ficha, 'desacelerados_regen_red'));
    eventos.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: 'tolhido' });
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
/**
 * (17/10, lote G2 — a decisão do dono "Toda área em metros": 1 casa = 2 m) A FORMA da gema do PoE no RAIO DELA (`GemasPoe.areaNoNivel`: o raio-base
 * do PoE, os "+X metros de raio" e o "X% mais Área de Efeito" da gema, no nível e na qualidade): a forma da magia-molde (a onda, o losango, a
 * varredura) esticada ou encolhida até o raio em casas (os metros ÷ 2; a fração é a chance de uma casa a mais, como `ModsPoe.casasPelaArea`).
 * Depois, a Área de Efeito das peças, dos suportes e da gema cresce essa forma (`areaNoUso`). Sem raio publicado no PoE, a forma do molde fica
 * (o status da gema não muda por isto). `entry` sem forma (o projétil, o golpe no alvo, a cadeia) volta igual.
 */
export function formaNoRaioDoPoe(entry, efeito, rng = Math.random, { hunt = null, minimo = 0, raioExtraM = 0 } = {}) {
  if (!itensPoeLigado() || !entry?.poeGema || entry.poeGema.buff || !entry.forma) return entry;
  const doNivel = GemasPoe.areaNoNivel(entry.poeGema.slug, efeito?.nivel ?? 1, efeito?.qualidade ?? 0).raioM;
  if (doNivel == null) return entry;
  // (lote G10: + o raio dos estágios — "+X metros ao raio por estágio")
  const raioM = Math.max(0.2, doNivel + raioExtraM);
  const casas = raioM / 2;
  // (`hunt`: o sorteio da fração fica guardado até um uso SAIR — `consumirRaioDoPoe` — para a área que não pegou ninguém não sortear de novo no
  // tique seguinte: sem isto, a fração virava "a casa a mais" na prática, de tanto tentar)
  const chave = `${entry.poeGema.slug}@${raioM}`;
  let r = hunt?.poeRaioPendente?.[chave];
  if (r == null) {
    r = Math.max(0, Math.trunc(casas) + (rng() < casas % 1 ? 1 : 0));
    if (hunt) (hunt.poeRaioPendente ??= {})[chave] = r;
  }
  // (`minimo`: a ARMADILHA — no PoE o inimigo que a ativa está sempre na explosão, porque o raio de ativação é menor que o dela; aqui a
  // ativação é a 1 casa, `Plantadas.PADRAO.armadilha.raioDeAtivacao`, e a explosão pega ao menos essa casa)
  r = Math.max(r, minimo);
  return r === Areas.raioDaForma(entry.forma) ? entry : { ...entry, forma: Areas.escalarForma(entry.forma, r) };
}
/*
 * ---- (lote A1, dono 19/10) O DESLOCAMENTO das gemas de movimento do PoE ----
 * O salto, a investida e o teleporte (`itens-poe/deslocamento.mjs`: a distância, onde o dano cai, o chão). `planoDoDeslocamento` escolhe a casa
 * de destino ANTES de gastar nada (D1: o ataque salta até o alvo fora do alcance corpo a corpo; a viagem cobre distância até o alvo a pelo menos
 * a distância do salto; D2: "para longe" só com a opção do slot; D4: pela grade do jogador — sem atravessar parede, sem pousar em zona segura nem
 * em casa ocupada). O `dispararSemMarcar` move o personagem (`moverNoDeslocamento`) depois de pagar o custo, e o dano cai onde a gema manda.
 */
/** A grade do JOGADOR no andar dele, sem as zonas seguras (a do combate, que o tique põe; fora do tique — o teste, o clique —, a do mapa). */
function gradeDoJogador(hunt) {
  const g = ModsPoe.gradeDoCombate(hunt);
  if (g?.andavel) return g;
  try {
    return hunt?.huntId ? Protecao.gradeDosBichos(andarDaGrade(gradeDaHunt(huntOuMapaCustom(hunt.huntId)), hunt.z)) : null;
  } catch {
    return null;
  }
}
/**
 * O PLANO do deslocamento deste uso: `{ ok, de, para, caminho, casas, max, semMover?, fuga?, atrasoMs, maisDanoPct }` ou `{ ok: false, erro,
 * motivo }` (o uso não sai). `fixo`: o destino guardado no começo da conjuração (`hunt.conjurando.deslocamento`) — o atraso do Teleporte já foi
 * esperado até ele; só muda se a casa ficou ocupada.
 */
export function planoDoDeslocamento(estado, hunt, entry, action, alvo, desloc, { manual = false, vivos = null, fixo = null, rng = Math.random } = {}) {
  if (!hunt?.pos || !desloc) return { ok: false, erro: 'Sem deslocamento.', motivo: 'SEM_DESLOCAMENTO' };
  const ficha = Ficha.combate(estado);
  const grade = gradeDoJogador(hunt);
  const andavel = grade?.andavel ? (x, y) => grade.andavel.has(`${x},${y}`) : null;
  const bichos = (vivos ?? hunt.monstros ?? []).filter((b) => b.hp > 0);
  const aliados = aliadosPorCasa(hunt);
  const ocupada = (x, y) => bichos.some((b) => b.x === x && b.y === y) || (hunt.lacaios ?? []).some((l) => l.hp > 0 && l.x === x && l.y === y) || aliados.has(`${x},${y}`) || (hunt.summon && hunt.summon.x === x && hunt.summon.y === y);
  const direcao = action?.direcao === 'longe' && desloc.fuga ? 'longe' : 'alvo';
  const de = { x: hunt.pos.x, y: hunt.pos.y };
  const max = Deslocamento.casasDosMetros(desloc.maxM, rng);
  let r;
  // (revisão do A1: o destino guardado só vale no MESMO andar e da MESMA casa de onde a conjuração começou; senão a escolha é refeita)
  if (fixo && ((fixo.z ?? 0) !== (hunt.z ?? 0) || (fixo.de && (fixo.de.x !== de.x || fixo.de.y !== de.y)))) fixo = { manual: !!fixo.manual };
  if (fixo?.para && (fixo.para.x !== de.x || fixo.para.y !== de.y) && (!andavel || andavel(fixo.para.x, fixo.para.y)) && !ocupada(fixo.para.x, fixo.para.y)) {
    r = { para: { ...fixo.para }, caminho: Deslocamento.reta(de, fixo.para), casas: distanciaChebyshev(de, fixo.para), ...(fixo.fuga ? { fuga: true } : {}) };
  } else if (fixo?.semMover) {
    r = { para: de, caminho: [], casas: 0, semMover: true };
  } else {
    // (a VIAGEM automática só anda atrás do alvo da caçada: juntando bichos, seguindo alguém da party ou no passo do jogador, não)
    if (!manual && !fixo?.manual && desloc.modo === 'viagem' && direcao === 'alvo' && (hunt.lurando || hunt.guia || hunt.reagrupar || hunt.modo === 'online')) return { ok: false, erro: 'O passo segue outro rumo agora.', motivo: 'SEM_DESLOCAMENTO' };
    r = Deslocamento.escolherDestino({
      pos: de, alvo: alvo?.hp > 0 ? alvo : null, max, modo: desloc.modo, direcao, andavel, ocupada, alcanceCorpo: 1 + (ficha.alcanceCorpoExtra ?? 0),
      querDistancia: Math.max(1, Number(hunt.distancia) || 1), vivos: bichos.filter((b) => !b.dummy), manual: manual || !!fixo?.manual, dir: hunt.pos.dir ?? 2,
      paraNoBicho: !!desloc.paraNoBicho, fuga: !!desloc.fuga,
    });
    if (r.erro) return { ok: false, erro: r.erro, motivo: r.motivo };
  }
  // (a party: quem segue alguém não salta para fora da coleira dele)
  if (hunt.guia?.pos && !r.semMover && desloc.modo !== 'inimigos' && distanciaChebyshev(r.para, hunt.guia.pos) > hunt.guia.coleira && distanciaChebyshev(r.para, hunt.guia.pos) > distanciaChebyshev(de, hunt.guia.pos)) {
    return { ok: false, erro: 'Longe demais de quem você segue.', motivo: 'COLEIRA' };
  }
  // O ATRASO do Teleporte Relampejante (dono, 19/10): a distância ÷ a velocidade de movimento × (1 − a redução da gema) — no jogo, um passo
  // (`R.PASSO_MS`) por casa na velocidade-base; ele entra na conjuração (`dispararSemMarcar`) e o teleporte sai no tique em que ela termina.
  const velocidade = Math.min(2, Math.max(0.25, (ficha.speed ?? R.baseSpeed(estado.level ?? 1)) / Math.max(1, R.baseSpeed(estado.level ?? 1))));
  const atrasoMs = desloc.atraso && !r.semMover ? Math.round(((r.casas * R.PASSO_MS) / velocidade) * (1 - (desloc.atrasoMenosPct ?? 0) / 100)) : 0;
  // A Investida com Escudo: "100% mais Dano com Acertos na Distância Máxima da Investida", proporcional às casas percorridas (dono, 19/10)
  const maisDanoPct = desloc.maisNaDistanciaMaximaPct && !r.semMover && max > 0 ? desloc.maisNaDistanciaMaximaPct * Math.min(1, r.casas / max) : 0;
  return { ok: true, de, ...r, max, direcao, atrasoMs, maisDanoPct };
}
/** (revisão do A1) O chefe que a Vaal do Teleporte não leva: o critério de chefe do jogo (o `ehChefe` da barra — `cacadas`) + o chefe do mapa. */
const ehChefeQueNaoTeleporta = (m, hunt) => !!(m.isBoss || m.boss || m.chefe || m.chefeDoMapa || m.raridade === 'boss' || m.raridade === 'unico' || CATALOGO.bestiary?.[m.key]?.boss || CATALOGO.bestiary?.[m.key]?.poe?.unico);
/** (lote A1) A gema de ILUSÃO do PoE (a tag "Ilusão" — Blink): a recarga é compartilhada entre elas. */
const ehIlusao = (entry) => !!entry?.poeGema && (GemasPoe.doSlug(entry.poeGema.slug)?.gema?.tags ?? []).includes('Ilusão');
/** Move o personagem para `para` (o salto, o teleporte): o passo de agora não vale mais (a perseguição, o recuo, o vigia de progresso). */
function moverNoDeslocamento(hunt, para, agora = hunt?.clock ?? 0) {
  if (!hunt?.pos || !para) return;
  hunt.pos.x = para.x;
  hunt.pos.y = para.y;
  hunt.casaAnterior = null;
  hunt.progresso = null;
  hunt.perseguicao = null;
  hunt.recuo = null;
  ModsPoe.perderMomentum(hunt);
  ModsPoe.marcar(hunt, 'moveu', agora);
  // (o contador que o cliente olha para desenhar o teleporte — `cacadas.snapshotDaHunt`, `map.mjs`)
  hunt.teleportes = (hunt.teleportes ?? 0) + 1;
}

/*
 * ---- (lote A1b, dono 19/10) A MIRAGEM da Investida Carregada e o resto das gemas de movimento (`itens-poe/movimento-a1b.mjs`) ----
 * A miragem (`hunt.miragem = { acao, z, de, pos, andadoM, caminho, parou, chegou, rumo, estagios, usos, ate }`) nasce em você no primeiro uso do
 * canalizar e anda a cada uso (I2/I3); cada uso em que ela andou dá 1 estágio (até 15); os usos 1, 3, 5… pulsam em volta dela (I4/I5/I6); parada, o
 * pulso leva o "+150%" (só com a opção "Segurar a miragem no alvo" — I1). Na liberação (ela parou; ou, segurando, ninguém mais na área dela; ou outra
 * habilidade sua — I7; ou o canalizar acabou), a onda final ("75% de dano por estágio") cai em volta dela e você teleporta para ela (a da
 * Projeção não teleporta), sem contar como movimento.
 */
/** (lote A1b) Até onde o alvo pode estar para um canalizar NOVO começar: os 6,2 m da miragem (3 casas) + 1 casa do raio. */
const ALCANCE_DA_MIRAGEM = 4;
/** A casa tem alguém (bicho vivo, lacaio, aliado da party, familiar)? — onde o teleporte não pousa (a regra D4 do A1). */
function casaOcupada(hunt, x, y, vivos = hunt.monstros ?? []) {
  return vivos.some((b) => b.hp > 0 && b.x === x && b.y === y) || (hunt.lacaios ?? []).some((l) => l.hp > 0 && l.x === x && l.y === y) || aliadosPorCasa(hunt).has(`${x},${y}`) || (!!hunt.summon && hunt.summon.x === x && hunt.summon.y === y);
}
/**
 * (lote A1b, dono 19/10) O PLANO da miragem neste uso, ANTES de gastar nada: `{ ok, novo, pulso, soltar, raio, casas }` ou `{ ok: false, … }`. `novo`: o
 * estado da miragem depois do uso (gravado quando o uso sai); `pulso`: `{ pct }` (o 100%, ou o +150% parada) — o uso pulsa; `soltar`: a liberação
 * (a onda final e o teleporte) sai neste uso; `raio`: o raio do estágio em casas (a fração como chance, × √ da Área de Efeito); `casas`: as casas em
 * volta da miragem. `soltar: true` nos argumentos: só a liberação (a outra habilidade — I7 —, o fim do canalizar).
 */
function planoDaMiragem(estado, hunt, entry, action, alvo, m, efeito, inicio, vivos, { soltar = false, rng = Math.random } = {}) {
  const atual = hunt.miragem && hunt.miragem.acao === entry.id && !hunt.miragem.soltou && (hunt.miragem.z ?? 0) === (hunt.z ?? 0) ? hunt.miragem : null;
  const fatorDaArea = Math.sqrt(ModsPoe.fatorDaArea(efeito?.areaIncPct ?? 0, efeito?.areaMaisPct ?? 0));
  const raioDe = (estagios) => Deslocamento.casasDosMetros(GemasA1b.raioDaMiragemM(m, estagios) * fatorDaArea, rng);
  if (soltar) {
    if (!atual) return { ok: false, erro: 'Sem miragem.', motivo: 'SEM_MIRAGEM' };
    const raio = raioDe(atual.estagios);
    return { ok: true, novo: atual, pulso: null, soltar: true, raio, casas: Areas.quadrado(atual.pos, raio) };
  }
  // (revisão do A1b: andar encerra o canalizar — o uso de outra casa começa uma miragem nova; a velha já foi liberada no uso — `dispararSemMarcar`)
  const continua = !!atual && inicio <= (atual.ate ?? -Infinity) + 250 && naCasaDoCanalizar(hunt, atual);
  if (!continua) {
    // (o canalizar NOVO começa com o alvo ao alcance da miragem — senão o automático canalizaria no vazio)
    if (!(alvo?.hp > 0)) return { ok: false, erro: 'Sem alvo.', motivo: 'SEM_ALVO' };
    if (distanciaChebyshev(hunt.pos, alvo) > ALCANCE_DA_MIRAGEM) return { ok: false, erro: 'Alvo fora do alcance da miragem.', motivo: 'FORA_DE_ALCANCE' };
  }
  const de = { x: hunt.pos.x, y: hunt.pos.y };
  const base = continua ? atual : { acao: entry.id, slug: entry.poeGema.slug, z: hunt.z ?? 0, de, pos: { ...de }, andadoM: 0, caminho: [{ ...de }], parou: false, chegou: false, rumo: null, estagios: 0, usos: 0 };
  const parouAntes = !!base.parou;
  // (I2) a velocidade: 3,8 m/s × (1 + a sua Velocidade de Movimento aumentada — a do jogo, como o atraso do Teleporte do A1) × o "% da sua Velocidade de
  // Movimento" da gema; os metros deste uso: × o tempo de ataque dele
  const ficha = Ficha.combate(estado);
  const fatorDeMovimento = Math.min(2, Math.max(0.25, (ficha.speed ?? R.baseSpeed(estado.level ?? 1)) / Math.max(1, R.baseSpeed(estado.level ?? 1))));
  const usoMs = temposDaGemaPoe(estado, entry, efeito).uso;
  const metros = (GemasA1b.velocidadeDaMiragem(m, fatorDeMovimento) * usoMs) / 1000;
  const grade = gradeDoJogador(hunt);
  const andavel = grade?.andavel ? (x, y) => grade.andavel.has(`${x},${y}`) : null;
  const rumo = [[0, -1], [1, 0], [0, 1], [-1, 0]][hunt.pos.dir ?? 2] ?? [0, 1];
  const andou = GemasA1b.andarMiragem(base, metros, { alvo: alvo?.hp > 0 ? alvo : null, andavel, distanciaM: m.distanciaM, rumo });
  const estagios = andou.moveu ? Math.min(m.maxEstagios, base.estagios + 1) : base.estagios;
  const novo = { ...andou, estagios, usos: base.usos + 1, parou: andou.parou || estagios >= m.maxEstagios };
  delete novo.moveu;
  const raio = raioDe(estagios);
  const casas = Areas.quadrado(novo.pos, raio);
  const segurar = action?.segurarMiragem === true;
  const pulsa = GemasA1b.pulsaNoUso(m, novo.usos);
  // (I1) segurando: parada, pulsa com o +150% enquanto houver inimigo vivo na área dela; sem ninguém, libera (neste uso, sem pulso)
  if (parouAntes && segurar) {
    if (!Areas.dentro(casas, vivos.filter((b) => b.hp > 0 && !b.dummy)).length) return { ok: true, novo, pulso: null, soltar: true, raio, casas };
    return { ok: true, novo, pulso: pulsa ? { pct: 100 + m.paradaMaisPct } : null, soltar: false, raio, casas };
  }
  return { ok: true, novo, pulso: pulsa ? { pct: parouAntes ? 100 + m.paradaMaisPct : 100 } : null, soltar: novo.parou && !segurar, raio, casas };
}
/** (lote A1b) Você TELEPORTA para a miragem (a casa dela; ocupada, a livre mais perto no caminho dela, de trás para a frente — D4 do A1): sem "moveu" e
 * sem perder o Momentum (o wiki: "você não conta como se movendo"); o contador do teleporte anda (a tela). */
function teleportarParaAMiragem(hunt, mir, eventos) {
  if (!hunt?.pos || !mir) return;
  // (revisão do A1b) só de onde o canalizar começou: você saiu de lá (andou), a Investida acabou ali — sem o teleporte de volta (a onda sai, de onde a
  // miragem está); e nunca de longe (a miragem anda 6,2 m: 3 casas + 1 de folga)
  if (!naCasaDoCanalizar(hunt, mir) || distanciaChebyshev(hunt.pos, mir.pos) > ALCANCE_DA_MIRAGEM) return;
  const casa = [...mir.caminho].reverse().find((c) => (c.x === hunt.pos.x && c.y === hunt.pos.y) || !casaOcupada(hunt, c.x, c.y));
  if (!casa || (casa.x === hunt.pos.x && casa.y === hunt.pos.y)) return;
  eventos.push({ t: 'fx', id: EFEITO_DO_TELEPORTE, uid: 'player', x: hunt.pos.x, y: hunt.pos.y });
  hunt.pos.x = casa.x;
  hunt.pos.y = casa.y;
  hunt.casaAnterior = null;
  hunt.progresso = null;
  hunt.perseguicao = null;
  hunt.recuo = null;
  hunt.teleportes = (hunt.teleportes ?? 0) + 1;
  // (revisão do A1b: o tique das condições não conta o teleporte como passo — "você não conta como se movendo")
  hunt.poeUltimaPos = `${hunt.pos.x},${hunt.pos.y}`;
  eventos.push({ t: 'fx', id: EFEITO_DO_TELEPORTE, uid: 'player', x: hunt.pos.x, y: hunt.pos.y });
}
/** (lote B3, dono 21/10 — D-B3.3) O teleporte da Troca de Corpos para `para`: como o da miragem (A1b) — não conta como movimento. */
function teleportarSemMover(hunt, para, eventos) {
  if (!hunt?.pos || !para || (para.x === hunt.pos.x && para.y === hunt.pos.y)) return;
  eventos.push({ t: 'fx', id: EFEITO_DO_TELEPORTE, uid: 'player', x: hunt.pos.x, y: hunt.pos.y });
  hunt.pos.x = para.x;
  hunt.pos.y = para.y;
  hunt.casaAnterior = null;
  hunt.progresso = null;
  hunt.perseguicao = null;
  hunt.recuo = null;
  hunt.teleportes = (hunt.teleportes ?? 0) + 1;
  hunt.poeUltimaPos = `${hunt.pos.x},${hunt.pos.y}`;
  eventos.push({ t: 'fx', id: EFEITO_DO_TELEPORTE, uid: 'player', x: hunt.pos.x, y: hunt.pos.y });
}
/** (revisão do A1b) Você está na casa de onde o canalizar da Investida começou (`mir.de`)? Andar encerra o canalizar, como no PoE. */
const naCasaDoCanalizar = (hunt, mir) => !mir?.de || (hunt.pos?.x === mir.de.x && hunt.pos?.y === mir.de.y);
/**
 * (lote A1b, dono 19/10: I7) SOLTA a miragem fora do uso dela (outra habilidade sua no meio, o canalizar que acabou, a troca de andar): a onda final e o
 * teleporte, pelo caminho do uso (`dispararSemMarcar` com `gatilho.soltarMiragem` — sem custo, sem recarga, sem contar como uso). Devolve os eventos.
 */
export function soltarMiragem(estado, hunt, personagem = null, alvo = null) {
  const mir = hunt?.miragem;
  if (!mir || mir.soltou) return [];
  // (outro andar: a miragem ficou para trás — some, sem onda)
  if ((mir.z ?? 0) !== (hunt.z ?? 0)) { hunt.miragem = null; return []; }
  const r = dispararSemMarcar(estado, hunt, personagem, null, alvo, { gatilho: { acao: { id: mir.acao }, semCusto: true, soltarMiragem: true } });
  // (não saiu — a zona segura, a gema que saiu da barra: a miragem some)
  if (hunt.miragem === mir) hunt.miragem = null;
  if (hunt.canalizacao?.acao === mir.acao) hunt.canalizacao.liberou = true;
  return r?.eventos ?? [];
}
/**
 * (lote A1b, dono 19/10: D-c) A FILA do Teleporte Relampejante ("Pode aglomerar até 50 usos"): conjurando um Teleporte já na ESPERA (a conjuração
 * dele acabou — `castFim`), a barra pode lançar o Teleporte de novo; ele parte do destino do último da fila e espera o atraso dele depois. Devolve o
 * último da fila (o de onde o novo parte), ou null.
 */
function podeAglomerarTeleporte(estado, hunt, slot, agora) {
  const c = hunt?.conjurando;
  const action = estado.actions?.[slot];
  const entry = action?.id ? POR_ID.get(action.id) : null;
  if (!c?.deslocamento || !entry?.poeGema || !itensPoeLigado()) return null;
  const doConjurando = POR_ID.get(c.id)?.poeGema?.slug;
  if (!/^Lightning_Warp$/.test(entry.poeGema.slug) || doConjurando !== entry.poeGema.slug) return null;
  const max = GemasPoe.filaDoTeleporteDaGema(entry.poeGema.slug, Gemas.efeitoNaSkill(estado, entry.id)?.nivel ?? 1);
  const fila = hunt.filaDoTeleporte ?? [];
  const ultimo = fila.at(-1) ?? c;
  if (!(max > 1) || 1 + fila.length >= max || !ultimo.deslocamento?.para || agora < (ultimo.castFim ?? ultimo.fim)) return null;
  return ultimo;
}
/** (lote A1b, dono 19/10: D-d) TRESPASSAR agora: o buff com nome (`trespassar`), o da Corrida de Fase (antes da troca) ou o do Passo Definhante. */
export function trespassando(estado, hunt) {
  if (!itensPoeLigado() || !hunt) return false;
  if (ModsPoe.buffAtivo(estado, 'trespassar')) return true;
  const agora = hunt.clock ?? 0;
  return GemasA1b.TRESPASSAM.some((slug) => {
    const id = GemasPoe.doSlug(slug)?.acao;
    const b = id ? hunt.buffs?.[id] : null;
    return !!b && b.ate > agora && !b.faseDois;
  });
}
/**
 * (lote A1b, dono 19/10: D-d) O PASSO com Trespassar: o caminho não desvia de bicho (a busca sem os bichos); o passo que cairia na casa de um bicho
 * pula por cima dele até a próxima casa livre no mesmo caminho (até 3 casas — o "passa por cima" do A1). Null: sem passo assim (quem chama faz o de
 * sempre).
 */
// (revisão do A1b: o destino livre logo depois do bicho é o passo — o clique atrás dele; `destinoOcupado`: o destino é casa de alguém — o aliado que
// você segue —, e o passo não cai nele)
export function passoTrespassando(grade, origem, destino, casasDeBicho, { destinoOcupado = false } = {}) {
  let c = proximoPassoAte(grade, origem, destino, null, null);
  for (let k = 0; c && casasDeBicho.has(`${c.x},${c.y}`) && k < 3; k++) {
    const prox = proximoPassoAte(grade, c, destino, null, null);
    if (!prox || (prox.x === destino.x && prox.y === destino.y && (destinoOcupado || casasDeBicho.has(`${prox.x},${prox.y}`)))) return null;
    c = prox;
  }
  return c && !casasDeBicho.has(`${c.x},${c.y}`) ? c : null;
}
/**
 * (lote A1b, dono 19/10: D-e) A TROCA da Corrida de Fase: o uso de qualquer habilidade sua (não a do totem — o PoB) com o buff de velocidade ligado o
 * troca pelo de "X% mais Dano Físico Corpo a Corpo", pela duração secundária (0,2 s × a duração da habilidade); o próprio uso já o recebe (a ficha é
 * refeita aqui, antes do golpe). Devolve true se trocou.
 */
export function trocarCorridaDeFase(estado, hunt, agora = hunt?.clock ?? 0, { exceto = null } = {}) {
  if (!itensPoeLigado() || !hunt?.buffs) return false;
  const id = GemasPoe.doSlug('Old_Phase_Run')?.acao;
  const b = id && id !== exceto ? hunt.buffs[id] : null;
  if (!b || !(b.ate > agora) || b.faseDois || !b.fase) return false;
  hunt.buffs[id] = { ...b, ate: agora + Math.max(1, Math.round(b.fase.segundoMs * (b.fase.fatorDur ?? 1))), desde: agora, faseDois: true, afPoe: { 'mais_dano_fisico@corpo': b.fase.maisFisicoCorpoPct }, efeitosPoe: [] };
  Ficha.invalidar(estado);
  return true;
}
/**
 * (lote A1b, dono 19/10: D-b) A EMBOSCADA deste ataque corpo a corpo (o seu — o da gema ou o golpe básico): `{ critPontos, critMultPct }` se o buff está
 * ligado e a arma é de uma mão (o ataque a gasta — `hunt.emboscada.golpe` marca o ataque Impelido por ela), ou null.
 */
export function emboscadaNoGolpe(estado, hunt, agora = hunt?.clock ?? 0) {
  const e = hunt?.emboscada;
  if (!itensPoeLigado() || !e || !(e.ate > agora)) return null;
  if (!GemasA1b.ARMA_DE_UMA_MAO.test(String(estado.equipment?.weapon?.poe?.classe ?? ''))) return null;
  return e;
}
/** (lote A1b) A ficha DESTE uso com os atributos `af` como condicionais do golpe (sem tags: valem nele inteiro) — a Emboscada, a Investida com Escudo. */
export const comAtributosDoUso = (ficha, af) => {
  const extra = Object.entries(af ?? {}).filter(([, v]) => typeof v === 'number' && v).map(([stat, valor]) => ({ stat, tags: [], valor }));
  return extra.length && ficha ? { ...ficha, porTag: [...(ficha.porTag ?? []), ...extra] } : ficha;
};
/**
 * (lote A1) O SOLO ARDENTE do Avanço Flamejante (dono, 19/10: "nas casas do rastro, 4 s, com o dps da gema"): `hunt.solosDoJogador = [{ casas,
 * z, ate, acao, chave, partes: [{ tipo, porSegundo }] }]`; a cada tique, quem está numa casa dele queima — o degenerativo da gema, renovado por
 * meio segundo (uma queima da gema por inimigo, como o feixe). O dano por segundo é o do uso (a conta dos suportes, no instante do uso).
 */
export function tiqueDosSolosDoJogador(hunt, eventos = [], agora = hunt?.clock ?? 0) {
  if (!hunt?.solosDoJogador?.length) return eventos;
  for (const s of hunt.solosDoJogador) {
    // (revisão do A1: o solo paga o dps EXATO pelo tempo que o bicho ficou nele — antes, o degenerativo de meio segundo reaplicado a cada tique
    // pagava só 62,5%. O tempo deste tique: do último até agora, sem passar do fim do solo; a fração que não fecha 1 de dano fica para o próximo.)
    const fim = Math.min(agora, s.ate);
    const dt = Math.max(0, fim - (s.ultimo ?? fim));
    s.ultimo = fim;
    if (!(dt > 0) || (s.z ?? 0) !== (hunt.z ?? 0)) continue;
    const casas = new Set(s.casas);
    queimarNoSolo(hunt, s, (m) => casas.has(`${m.x},${m.y}`), dt, eventos);
  }
  hunt.solosDoJogador = hunt.solosDoJogador.filter((s) => s.ate > agora);
  return eventos;
}
/**
 * (lote A3b: a conta do Solo Ardente numa função só — o chão do Vórtice e da Geada Rastejante, `tiqueDosObjetos`, também a usa) Quem está no chão `s`
 * (`dentro(m)`) leva o dano por segundo de cada parte (`s.partes`) pelos `dt` ms, exato: a fração que não fecha 1 de dano fica para o próximo tique.
 */
/**
 * (revisão B2, dono 21/10 — o PoB: Burning é mais amplo que Incendiado) o monstro QUEIMANDO agora: o estado do jogo (o Incêndio, o degenerativo de Fogo — só o ativo)
 * ou num CHÃO DE FOGO seu (o Solo Ardente — do Chicote, do Avanço Flamejante —, a Tormenta Flamejante Vaal: os chãos com parte de Fogo) ou marcado pelo Sangue Fervendo.
 */
const temParteDeFogo = (x) => (x?.partes ?? []).some((p) => (p.elemento === 'fire' || p.tipo === 'degenFogo') && (p.porSegundo ?? 0) > 0);
export function queimandoAgora(hunt, m, agora = hunt?.clock ?? 0) {
  if (!m) return false;
  if (Dot.ativosDe(m, agora).includes('queimando')) return true;
  const z = m.z ?? hunt?.z ?? 0;
  if ((hunt?.poeObjetos ?? []).some((o) => o.efeito === 'solo' && o.ate > agora && (o.z ?? 0) === z && temParteDeFogo(o) && distanciaChebyshev(m, o) <= (o.raio ?? 0))) return true;
  if ((hunt?.solosDoJogador ?? []).some((s) => s.ate > agora && (s.z ?? 0) === z && temParteDeFogo(s) && (s.casas ?? []).includes(`${m.x},${m.y}`))) return true;
  return (m.estados?.poeSangueFervendo?.ate ?? -Infinity) > agora;
}
function queimarNoSolo(hunt, s, dentro, dt, eventos, origem = 'solo') {
  for (const m of hunt.monstros ?? []) {
    if (!(m.hp > 0) || m.dummy || (m.z ?? hunt.z ?? 0) !== (s.z ?? 0) || !dentro(m)) continue;
    for (const p of s.partes) {
      const resto = (s.resto ??= {});
      const k = `${m.uid}|${p.elemento}`;
      const bruto = (resto[k] ?? 0) + (p.porSegundo * dt) / 1000;
      const parte = Math.floor(bruto);
      resto[k] = bruto - parte;
      if (parte < 1) continue;
      const v = resistido(hunt, m, p.elemento, parte);
      m.hp -= v;
      QuemFeriu.carimbar(m, s.dono === 'totem' ? QuemFeriu.TOTEM : QuemFeriu.VOCE);
      eventos.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v, foe: true, alvo: m.name, color: COR_DO_ELEMENTO[p.elemento] ?? '#ff9000', dot: p.tipo, queimando: true, ...(s.dono === 'totem' ? { lacaio: true } : {}) });
      registrarGolpe(() => ({ origem, habilidade: s.acao, tipo: p.elemento, alvo: m.name, danoAntesDaResistencia: parte, danoFinal: v, vidaRestante: Math.max(0, m.hp) }));
    }
  }
}
/**
 * (lote A1, dono 19/10 — D7) O PASSO DEFINHANTE é um buff: concede o Elusivo (com o "Efeito do Elusivo desta Habilidade aumentado") — não sai com
 * o Elusivo ligado — e quem está na área dele ganha os Definhamentos (1 + os "adicionais na primeira vez que cada Inimigo entrar na Área"), pela
 * duração do Definhado da gema. A área não acompanha você: conta quem está nela no uso.
 */
function passoDefinhante(estado, hunt, entry, efeitoDaGema, agora) {
  const linhas = [...GemasPoe.textosDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1).linhas, ...GemasPoe.linhasDaQualidadeDe(entry.poeGema.slug, efeitoDaGema?.qualidade ?? 0)];
  const soma = (re) => linhas.reduce((n, l) => n + (Number(re.exec(String(l).replace(/(\d)%/g, '$1 %'))?.[1]) || 0), 0);
  const efeitoExtra = soma(/^Efeito do Elusivo desta Habilidade aumentado em ([\d.]+) ?%$/i);
  const adicionais = soma(/^Inflige \+?([\d.]+) Debuffs de Definhamento adicionais/i);
  const segundos = soma(/^Definhado dura ([\d.]+) segundos?$/i) || 2;
  ModsPoe.ganharBuff(hunt, 'elusivo', 1, agora, { efeitoExtra });
  const raioM = GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? 2.6;
  const raio = Deslocamento.casasDosMetros(raioM);
  const ficha = Ficha.combate(estado);
  for (const m of hunt.monstros ?? []) {
    if (!(m.hp > 0) || m.dummy || distanciaChebyshev(hunt.pos, m) > raio) continue;
    for (let i = 0; i < 1 + Math.floor(adicionais); i++) ModsPoe.porNoAlvoComMods(m, 'definhado', agora + Math.round(segundos * 1000), agora, ficha);
  }
}

/**
 * (17/10, lote G10) O ESTÁGIO de canalização deste uso: `{ estagio, liberar, soCarrega, maisPct, critMaisPct, raioExtraM, est }` ou null. A
 * habilidade canalizada usada de novo em seguida (a mesma, até o fim do uso anterior + um tique — `hunt.canalizacao`) ganha 1 estágio, até o
 * máximo; outra habilidade no meio zera. No máximo, LIBERA: a Rajada de Chamas e a Flecha Flagelante (`carrega`) só causam dano aí, com o
 * "mais Dano por estágio" × os estágios; as Lâminas Velozes soltam um golpe por estágio; o Incinerar, a onda final. (O Ciclone do Tumulto
 * ganha estágios pelo tempo — `temposDaGemaPoe`.)
 */
function estagioDaCanalizacao(hunt, entry, efeito, inicio, { gatilho = null, plantada = null } = {}) {
  if (!itensPoeLigado() || !entry?.poeGema || gatilho || plantada) return null;
  const est = GemasPoe.estagiosDaGema(entry.poeGema.slug, efeito?.nivel ?? 1, efeito?.qualidade ?? 0);
  // (lote A4, dono 19/10: os estágios sem canalizar — o Devastar, o Golpe Duplo do Ímpeto — são de `estagioSemCanalizar`)
  if (!est || est.modo === 'acerto' || est.modo === 'usos') return null;
  const c = hunt?.canalizacao;
  const continua = c && c.acao === entry.id && !c.liberou && inicio <= c.ate + 250;
  const estagio = est.modo === 'tempo'
    ? (continua ? Math.min(est.max, Math.floor(Math.max(0, inicio - c.desde) / Math.max(1, est.porMs))) : 0)
    : Math.min(est.max, (continua ? c.estagios ?? 0 : 0) + 1);
  // (lote G18: só LIBERA quem tem o que liberar — a carga, a onda final, os golpes finais; o Incinerar da Exaustão fica no máximo)
  const liberar = est.modo !== 'tempo' && estagio >= est.max && (est.modo === 'carrega' || !!est.final || !!est.golpesFinais || !!est.finalIncendio || est.finalIncendeia);
  // (revisão do A4, dono 19/10: a Rajada de Chamas Vaal explode a cada 3 estágios — `est.explodeCada` — sem zerar; no máximo, libera e recomeça)
  const explode = est.modo === 'carrega' && est.explodeCada > 0 && estagio % est.explodeCada === 0;
  // (lote A4, dono 19/10: a Rajada de Chamas Vaal — o raio "por Estágio" conta após o primeiro: VaalFlameblastStageAfterFirst)
  const doRaio = est.raioAposPrimeiro ? Math.max(0, estagio - 1) : estagio;
  const raioExtraM = est.raioMaxM != null ? Math.sign(est.raioM) * Math.min(Math.abs(est.raioM * doRaio), est.raioMaxM) : est.raioM * doRaio;
  // o "mais Dano": por estágio (no `carrega`, só na liberação) × a onda final × os golpes da liberação das Lâminas Velozes (um por estágio, cada
  // um com o dano do estágio)
  // (lote G18, pela flag do PoB: `maisPct` — o "com Acertos e Afecções" e os golpes finais — vale no acerto e na afecção; `maisAcertoPct` — o
  // "Mágico por estágio" da Rajada e a onda final "com Acertos" do Incinerar — só no acerto; `maisAfeccaoPct`/`maisIncendioPct` — o "com
  // Afecções por estágio" e a onda final "com Incêndio" — só nas afecções; `sempreIncendeia` na onda final)
  const ativo = !(est.modo === 'carrega' && !liberar && !explode);
  // (lote A4, dono 19/10: o "mais" no máximo — as Lâminas Velozes na qualidade, MultiplierThreshold do PoB: "Mais X% de dano" e "+X% ao multiplicador de golpe
  // crítico quando em estágios máximos"; o "após o primeiro" da Ira Divina — o do acerto e o da afecção, DivineIreStageAfterFirst)
  const noMax = estagio >= est.max;
  const aposPrimeiro = Math.max(0, estagio - 1);
  const fator = (1 + (ativo ? est.maisAmbos * estagio : 0) / 100) * (liberar && est.golpesFinais ? 1 + estagio : 1) * (noMax && est.maisNoMax ? 1 + est.maisNoMax / 100 : 1);
  const fatorAcerto = (1 + (ativo ? (est.mais - est.maisAmbos) * estagio : 0) / 100) * (liberar && est.final ? 1 + est.final / 100 : 1) * (ativo && est.maisAcertoAposPrimeiro ? 1 + (est.maisAcertoAposPrimeiro * aposPrimeiro) / 100 : 1);
  const fatorAfeccao = (1 + (ativo ? est.maisAfeccao * estagio : 0) / 100) * (ativo && est.maisAfeccaoAposPrimeiro ? 1 + (est.maisAfeccaoAposPrimeiro * aposPrimeiro) / 100 : 1);
  return {
    est, estagio, liberar, explode, soCarrega: est.modo === 'carrega' && !liberar && !explode, maisPct: (fator - 1) * 100, maisAcertoPct: (fatorAcerto - 1) * 100,
    maisAfeccaoPct: (fatorAfeccao - 1) * 100, maisIncendioPct: liberar ? est.finalIncendio : 0, sempreIncendeia: liberar && est.finalIncendeia,
    critMaisPct: est.critMais * estagio, critMultPct: noMax ? est.critMultNoMax ?? 0 : 0, raioExtraM,
  };
}

/**
 * (lote A4, dono 19/10: E2) Os ESTÁGIOS SEM CANALIZAR (`hunt.poeEstagios[acao] = { n, em, usos, pos }`): `acerto` — o Devastar: o uso conta os estágios
 * de agora ("50% mais Área de Efeito por cada estágio"); o que acerta ganha 1, até o máximo (D6: 8 do PoB + o "+N do máximo"); D6: 2 s sem acertar
 * zeram. `usos` — o Golpe Duplo do Ímpeto: "Ganhe um Estágio no início de cada ataque par" (até 10), "X% mais Velocidade de Ataque por cada Estágio";
 * mover-se zera (o PoB). Devolve `{ est, estagio }` (o de AGORA, já com o ganho do começo do ataque par) ou null.
 */
export function estagioSemCanalizar(hunt, entry, efeito, inicio, { gatilho = null, plantada = null, contar = false } = {}) {
  if (!itensPoeLigado() || !entry?.poeGema || gatilho || plantada || !hunt) return null;
  const est = GemasPoe.estagiosDaGema(entry.poeGema.slug, efeito?.nivel ?? 1, efeito?.qualidade ?? 0);
  if (!est || (est.modo !== 'acerto' && est.modo !== 'usos')) return null;
  const tudo = (hunt.poeEstagios ??= {});
  // (revisão do A4: o Devastar Vaal começa com 4 estágios — `est.iniciais`)
  const iniciais = Math.min(est.max, est.iniciais ?? 0);
  let st = tudo[entry.id] ?? { n: iniciais, em: inicio, usos: 0, pos: hunt.pos ? `${hunt.pos.x},${hunt.pos.y}` : null };
  const aqui = hunt.pos ? `${hunt.pos.x},${hunt.pos.y}` : null;
  if (est.modo === 'acerto' && inicio - (st.em ?? inicio) > GemasA4.DEVASTAR.perdeMs) st = { ...st, n: iniciais };
  if (est.modo === 'usos' && st.pos !== aqui) st = { ...st, n: 0, usos: 0, pos: aqui };
  if (contar && est.modo === 'usos') {
    st = { ...st, usos: st.usos + 1 };
    if (st.usos % Math.max(1, est.cadaUsos || 2) === 0) st.n = Math.min(est.max, st.n + 1);
  }
  if (contar) tudo[entry.id] = st;
  return { est, estagio: Math.min(est.max, st.n) };
}
/** (lote A4, dono 19/10: E2) O Devastar acertou: +1 estágio (até o máximo), e o relógio dos 2 s recomeça. */
function devastarAcertou(hunt, entry, est, inicio) {
  const iniciais = Math.min(est.max, est.iniciais ?? 0);
  const st = ((hunt.poeEstagios ??= {})[entry.id] ??= { n: iniciais, em: inicio, usos: 0 });
  st.n = Math.min(est.max, (inicio - (st.em ?? inicio) > GemasA4.DEVASTAR.perdeMs ? iniciais : st.n) + 1);
  st.em = inicio;
}

/**
 * (17/10, lote G12) A EXPLOSÃO DOS CADÁVERES do uso: cada um causa "X% da Vida Máxima do Cadáver" como dano de Fogo — sem os modificadores de dano
 * mágico ("A explosão não é afetada por modificadores de dano mágico": o "aumentado" de Fogo e o geral da ficha) — nos inimigos no raio da
 * explosão (1 casa = 2 m, × √ da Área de Efeito), pela resistência a Fogo; o cadáver some. A Cremação deixa no lugar um GÊISER que dispara os
 * projéteis dela a cada intervalo, pela duração, até o máximo de gêiseres (`tiqueDosGeiseres`). Devolve os eventos.
 */
function explodirCadaveres(estado, hunt, entry, efeito, def, cadaveres, ficha, agora) {
  const eventos = [];
  const fator = ModsPoe.fatorDaArea(efeito?.areaIncPct ?? 0, efeito?.areaMaisPct ?? 0);
  const c0 = (def.raioExplosaoM * Math.sqrt(fator)) / 2;
  // (lote B2: `def.elemento` — o cadáver da Explosão Voltáxica explode com Raio; os outros, com Fogo)
  const el = def.elemento ?? 'fire';
  const aumento = Math.max(0, 1 + (ficha.danoDoElemento?.[el] ?? 0) / 100);
  for (const c of cadaveres) {
    const r = Math.max(0, Math.trunc(c0) + (Math.random() < c0 % 1 ? 1 : 0));
    const bruto = ((def.pct / 100) * Math.max(0, Number(c.maxHp) || 0)) * aumento;
    if (bruto > 0) for (const m of hunt.monstros ?? []) {
      if (!(m.hp > 0) || m.dummy || Math.max(Math.abs(m.x - c.x), Math.abs(m.y - c.y)) > r) continue;
      const v = Math.round(resistido(hunt, m, el, bruto, ficha));
      if (!(v > 0)) continue;
      m.hp -= v;
      // (lote B2: `def.tags` — a explosão do morto pelo Golpe Infernal é de um ataque)
      QuemFeriu.carimbar(m, QuemFeriu.VOCE, def.tags ?? ['magia', 'area', 'fogo']);
      eventos.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v, foe: true, alvo: m.name, color: COR_DO_ELEMENTO[el] ?? '#ff9000', sk: entry.id });
      // (17/10, lote G18) a explosão é um ACERTO de Fogo (o PoB: a vida do cadáver × % como dano base da habilidade): põe as afecções pela chance
      // (a da ficha, a da gema, a dos suportes), com o "mais/menos" das afecções dos suportes e o da gema (o Detonar Mortos da Limpeza: 70% menos)
      if (itensPoeLigado() && ficha.afeccoes && entry.poeGema && m.hp > 0) {
        const k = (x) => Math.max(0, 1 + (x ?? 0) / 100);
        const g = GemasPoe.maisNasAfeccoesDaGema(entry.poeGema.slug, efeito?.nivel ?? 1, efeito?.qualidade ?? 0);
        const postos = AfeccoesPoe.aoAcertar(m, [{ elemento: el, dano: bruto }], { afeccoes: GemasPoe.afeccoesComAGema(ficha.afeccoes, entry.poeGema.slug, efeito?.nivel ?? 1, efeito?.qualidade ?? 0), ataque: false, agora, salaDeBoss: !!hunt.isBoss, fatoresDoDano: { todas: k(efeito?.maisAfeccaoPct) * k(efeito?.maisDotPct) * k(g.maisAfeccaoPct), incendio: k(efeito?.maisIncendioPct) * k(efeito?.maisDotFogoPct) }, sofrido: ModsPoe.sofridoDoAtacante(ficha.afPoe) });
        for (const st of postos) eventos.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: st });
      }
    }
    eventos.push({ t: 'area', id: entry.efeito ?? null, x: c.x, y: c.y, casas: Areas.paraTela(Areas.quadrado({ x: c.x, y: c.y }, r), { x: c.x, y: c.y }), sk: entry.id });
    // (decisão do dono, 21/10 — a regra do PoE: a duração do gêiser × os modificadores de Duração, como o do Vulcão)
    if (def.geiser) porGeiser(estado, hunt, entry, c, { ...def.geiser, duracaoMs: Math.max(1, Math.round(def.geiser.duracaoMs * fatorDeDuracao(estado, entry, efeito))) }, agora, def.explodeAoDisparar ? { pct: def.pct, raioExplosaoM: def.raioExplosaoM } : null);
  }
  const usados = new Set(cadaveres);
  hunt.cadaveres = (hunt.cadaveres ?? []).filter((c) => !usados.has(c));
  return eventos;
}
/**
 * Põe o GÊISER da Cremação em `c` (até o máximo da gema — sai o mais velho). (lote B3, dono 21/10: `cadaver` — a Exumação: a explosão do cadáver perto a cada disparo,
 * `{ pct, raioExplosaoM }`; a do Vulcão põe o gêiser sem cadáver — D-B3.5.)
 */
function porGeiser(estado, hunt, entry, c, geiser, agora, cadaver = null) {
  const g = (hunt.poeGeiseres ??= []).filter((x) => x.acao === entry.id);
  while (g.length >= geiser.max) { const velho = g.shift(); hunt.poeGeiseres = hunt.poeGeiseres.filter((x) => x !== velho); }
  hunt.poeGeiseres.push({ id: `geiser-${agora}-${c.x},${c.y}`, acao: entry.id, slot: Gemas.skillsAtivas(estado).get(entry.id)?.onde?.slot ?? null, x: c.x, y: c.y, z: c.z ?? hunt.z ?? 0, ate: agora + geiser.duracaoMs, proxima: agora + geiser.intervaloMs, intervaloMs: geiser.intervaloMs, projeteis: geiser.projeteis, ...(cadaver ? { explodeCadaver: cadaver } : {}) });
}
/** O raio em que o projétil do GÊISER da Cremação procura um inimigo (o PoE solta em volta: "na área ao redor"). */
export const RAIO_DO_GEISER = 3;
/** Os gêiseres da Cremação: a cada intervalo, os N projéteis — cada um a habilidade saindo do lugar do gêiser num inimigo sorteado em volta dele. */
export function tiqueDosGeiseres(estado, hunt, personagem, eventos, agora) {
  if (!hunt?.poeGeiseres?.length) return;
  const slotDe = (acao) => (estado.actions ?? []).findIndex((a) => a?.id === acao);
  for (const g of hunt.poeGeiseres) {
    const slot = slotDe(g.acao);
    while (g.proxima <= Math.min(agora, g.ate) && (estado.hp ?? 0) > 0) {
      g.proxima += g.intervaloMs;
      if (slot < 0) continue;
      // (lote B3, dono 21/10) a Cremação da Exumação: "Explode um Cadáver próximo ao Disparar Projéteis" (o PoB: cremation_chance_to_explode_nearby_corpse_when_firing_projectiles
      // 100) — o cadáver mais perto do gêiser, a até 3 casas dele (o raio em que o projétil procura o inimigo), com a explosão da gema (a % da Vida dele)
      if (g.explodeCadaver) {
        const cad = (hunt.cadaveres ?? []).filter((c) => (c.z == null || c.z === (g.z ?? 0)) && distanciaChebyshev(c, g) <= GemasB3.RAIO_DO_CADAVER_DO_GEISER).sort((a, b) => distanciaChebyshev(a, g) - distanciaChebyshev(b, g))[0];
        const entry = cad ? POR_ID.get(g.acao) : null;
        if (entry) {
          const ef = comOsAlvosDaGema(entry, Gemas.efeitoNaSkill(estado, entry.id), estado);
          eventos.push(...explodirCadaveres(estado, hunt, entry, ef, g.explodeCadaver, [cad], Ficha.combate(estado), agora));
        }
      }
      for (let k = 0; k < g.projeteis; k++) {
        const perto = Plantadas.inimigosPerto(hunt, g, RAIO_DO_GEISER);
        if (!perto.length) break;
        const alvo = perto[Math.floor(Math.random() * perto.length)];
        const r = dispararSemMarcar(estado, hunt, personagem, slot, alvo, { plantada: { ...g, tipo: 'geiser' } });
        if (r?.ok) eventos.push(...(r.eventos ?? []));
      }
    }
  }
  hunt.poeGeiseres = hunt.poeGeiseres.filter((g) => g.ate > agora);
  if (!hunt.poeGeiseres.length) delete hunt.poeGeiseres;
}

/** O uso SAIU: o sorteio do raio da gema guardado (`formaNoRaioDoPoe`) vale só para ele. */
export function consumirRaioDoPoe(hunt, entry) {
  if (!hunt?.poeRaioPendente || !entry?.poeGema) return;
  for (const k of Object.keys(hunt.poeRaioPendente)) if (k.startsWith(`${entry.poeGema.slug}@`)) delete hunt.poeRaioPendente[k];
  if (!Object.keys(hunt.poeRaioPendente).length) delete hunt.poeRaioPendente;
}

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
/**
 * (lote A4, dono 19/10: D1: "as repetições seguem o PoE/PoB") As REPETIÇÕES do uso: as dos suportes e da ficha (o Eco de Magia, o Golpe Múltiplo, o
 * Altar Ecoante, "Ataques executados por você se repetem mais N vezes" — com o teto de 3 de antes) + a repetição própria da gema (a Procissão —
 * `GemasPoe.repeticoesDaGema`). A ativada por gatilho não leva as da ficha.
 */
// (revisão do A4, dono 19/10) o uso do TOTEM (o ramo do totem é de outra sessão: até ela dar ao intervalo dele os (1 + r) tempos, o totem fica sem as
// repetições — a Procissão também) e o que sai da ESTACA do Estilhaçar e do ORBE Invernal (a quebra da estaca e o projétil do orbe não são o ataque
// repetível) não repetem
// (lote A3b, dono 19/10: + o golpe que sai de um OBJETO no chão ou no tempo — `tiqueDosObjetos` —: a bola, o tornado, os projéteis da espiral não repetem)
const SEM_REPETICAO = new Set(['totem', 'estaca', 'orbe', 'objeto']);
export function repeticoesDoUso(entry, efeito, ficha, { gatilho = null, plantada = null } = {}) {
  if (SEM_REPETICAO.has(plantada?.tipo) || entry?.poeGema?.doTotem) return 0;
  const dosSuportes = Math.min(3, (efeito?.repeticoes ?? 0) + (entry?.poeGema?.ataque && !gatilho ? ModsPoe.valor(ficha, 'repeticoes_ataque_proprio') : 0) + (!gatilho ? ModsPoe.valor(ficha, 'repeticoes_extra') : 0));
  const propria = itensPoeLigado() && entry?.poeGema ? GemasPoe.repeticoesDaGema(entry.poeGema.slug, efeito?.nivel ?? 1, efeito?.qualidade ?? 0)?.n ?? 0 : 0;
  return dosSuportes + propria;
}
/**
 * (lote A4, dono 19/10: D1) Quantos TEMPOS DE USO o uso ocupa: 1 + as repetições (o PoB conta cada repetição como um uso — o RepeatCount não multiplica o DPS:
 * ModParser.lua:5671, ConfigOptions.lua:940-951; antes as repetições saíam de graça, (1 + r)× os acertos por segundo do PoE); o Golpe Cintilante
 * Vaal (D3): 25 × o tempo de ataque.
 */
/**
 * (revisão do A4) O uso passa pelo bloco do golpe — o único em que as repetições saem e alongam o uso (`fatorDoTempo`)? A aura, o buff, o clamor, a
 * colocação do totem, o arremesso da Armadilha/Mina e a Runa não: o balão mostra o (1 + r) só nos que de fato o têm.
 */
export function repeteNoMotor(entry, efeito) {
  if (!entry?.poeGema || entry.papeis?.[0] !== 'attack' || entry.poeGema.lacaio || efeito?.viraTotem > 0) return false;
  return !Plantadas.tipoDaGema(entry, efeito) && !Runas.ehRuna(entry) && !Vinculos.ehVinculo(entry);
}
export function fatorDoTempoDoUso(entry, efeito, ficha, { gatilho = null } = {}) {
  if (itensPoeLigado() && entry?.poeGema?.slug === 'Vaal_Flicker_Strike' && !gatilho) return GemasA4.GOLPE_CINTILANTE_VAAL.golpes;
  return 1 + repeticoesDoUso(entry, efeito, ficha, { gatilho });
}
/** A gema instantânea (sem tempo de uso: 0 de conjuração, ou "Utilizar Habilidades Suportadas é Instantâneo") ocupa um tique. */
const USO_DA_INSTANTANEA_MS = 250;
/**
 * (lote A5, dono 20/10) O tempo da arma SECUNDÁRIA ÷ a média das duas que a ficha usa (`Ficha.intervaloBaseDoGolpe`: a média dos intervalos, a secundária com
 * a "Velocidade de Ataque com a Mão Secundária aumentada"): o fator que leva o intervalo da ficha ao da secundária. 1 sem as duas armas.
 */
export function fatorDoTempoDaSecundaria(estado, ficha) {
  const [principal, secundaria] = Ficha.armasEquipadas(estado);
  if (!principal?.intervaloMs || !secundaria?.intervaloMs || secundaria.slot !== 'shield') return 1;
  const daSec = secundaria.intervaloMs / (1 + Math.max(0, Number(ficha?.afPoe?.atk_speed_mao_secundaria) || 0) / 100);
  const media = (principal.intervaloMs + daSec) / 2;
  return media > 0 ? daSec / media : 1;
}
export function temposDaGemaPoe(estado, entry, efeitoDaGema = Gemas.efeitoNaSkill(estado, entry.id), fichaDoPersonagem = Ficha.combate(estado), { doJogador = true, velExtraPct = 0, recuperacaoExtraPct = 0 } = {}) {
  // (17/10: + as linhas locais da gema — "X% mais Velocidade de Ataque por Carga de Frenesi" — `comAsLinhasDaGema`)
  const ficha = comAsLinhasDaGema(estado, fichaDoPersonagem, entry, efeitoDaGema);
  const t = GemasPoe.temposNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0);
  const suportes = 1 + (efeitoDaGema?.castTimePct ?? 0) / 100;
  const ataque = !!entry.poeGema.ataque;
  // PoE: a velocidade de conjuração / a recuperação de recarga "com Habilidades de Fogo", "de Movimento", "do Totem"… (pelas tags da gema).
  const porTag = ModsPoe.somaPorTags(ficha, tagsPoeDaSkill(entry));
  // (18/10, lote G20a) a "Velocidade de Posicionamento do Totem aumentada" das peças e da árvore (`cast_speed_tag@totem`) é a de COLOCAR o totem (o
  // seu uso da gema de totem, abaixo), não a de conjurar do totem: sai da habilidade que ele usa
  const posDasPecas = (ficha.porTag ?? []).reduce((n, x) => (x.stat === 'cast_speed_tag' && x.tags.length === 1 && x.tags[0] === 'totem' ? n + x.valor : n), 0);
  const semPosicionamento = tagsPoeDaSkill(entry).includes('totem') ? posDasPecas : 0;
  // (17/10, lote G3) a VELOCIDADE DE ARREMESSO dos suportes de Armadilha/Mina, só no tipo que a habilidade planta (`Plantadas.tipoDaGema`): o
  // "aumentada" soma (na conjuração e no ataque — o arremesso usa o tempo da habilidade) e o "mais/menos" multiplica o tempo.
  const plantaTipo = Plantadas.tipoDaGema(entry, efeitoDaGema);
  const arremessoPct = plantaTipo === 'armadilha' ? efeitoDaGema?.velArremessoArmadilhaPct ?? 0 : plantaTipo === 'mina' ? efeitoDaGema?.velArremessoMinaPct ?? 0 : 0;
  const arremessoMais = plantaTipo === 'armadilha' ? efeitoDaGema?.velArremessoArmadilhaMaisPct ?? 0 : plantaTipo === 'mina' ? efeitoDaGema?.velArremessoMinaMaisPct ?? 0 : 0;
  // (lote E1b, 26/10) o "X% menos Velocidade de Arremesso de Armadilhas" da PRÓPRIA gema (a Explosiva da Magnitude; o "com arma de duas mãos" da Hélice de Trarthus):
  // outro "menos", multiplica o tempo do arremesso
  const arremessoDaGema = plantaTipo === 'armadilha' ? GemasPoe.arremessoDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, ModsPoe.condicoesDe(estado, ficha.afPoe, null)) : null;
  // (lote G20a: `velExtraPct` — a do TOTEM usando a habilidade: "Magias Conjuradas por Totens têm X% de Velocidade de Conjuração aumentada", "Ataques
  // utilizados por Totens…" — `cacadas.golpeDoTotem`)
  const castSpeed = (ficha.castSpeed ?? 0) + (porTag.cast_speed_tag ?? 0) - semPosicionamento + (efeitoDaGema?.velConjuracaoPct ?? 0) + arremessoPct + (entry.poeGema.ataque ? 0 : velExtraPct);
  // O ataque: o intervalo da ficha (`1000 / APS` ÷ (1 + aumentos globais)) com os aumentos da gema somados aos globais.
  const global = ficha.velocidadeDeAtaque ?? 0;
  // (ciclo 7) + a velocidade de ataque "com Habilidades de X" (`atk_speed@<tag>` — Retaliação, Movimento…): antes não entrava em lugar nenhum.
  const daGema = (efeitoDaGema?.velAtaquePct ?? 0) + (doJogador ? velocidadeCondicional(estado, efeitoDaGema) : 0) + (porTag.atk_speed ?? 0) + arremessoPct + (entry.poeGema.ataque ? velExtraPct : 0);
  // (17/10) o "X% mais Velocidade de Ataque" com condição (a da gema — o Frenesi, "por Carga de Frenesi"): multiplica.
  // (17/10, lote G10) "X% mais Velocidade de Ataque por Estágio" (o Ciclone do Tumulto — um estágio a cada N s canalizando)
  const estDoTempo = doJogador && estado.hunt ? estagioDaCanalizacao(estado.hunt, entry, efeitoDaGema, estado.hunt.clock ?? 0) : null;
  // (lote A4, dono 19/10: E2: + o "X% mais Velocidade de Ataque por cada Estágio" do Golpe Duplo do Ímpeto — os estágios de agora, `estagioSemCanalizar`)
  const semCanal = doJogador && estado.hunt ? estagioSemCanalizar(estado.hunt, entry, efeitoDaGema, estado.hunt.clock ?? 0) : null;
  const porEstagioVel = (estDoTempo?.est?.velMais ? 1 + (estDoTempo.est.velMais * estDoTempo.estagio) / 100 : 1) * (semCanal?.est.velMais ? 1 + (semCanal.est.velMais * semCanal.estagio) / 100 : 1);
  // (lote G18b: + o "+N segundos ao Tempo de Ataque" da gema — o Salto Esmagador, a Cutilada Vaal — no tempo-base, antes dos aumentos, como no PoB)
  // (lote A5, dono 20/10) o Golpe Duplo da Ambidestria: "Utiliza o Tempo de Ataque da Arma Secundária" (o PoB: UseOffhandAttackSpeed) — o intervalo da ficha
  // (a média das duas armas) passa a ser o da secundária, com os mesmos aumentos
  const intervaloDaFicha = (ficha.intervaloDoGolpeMs ?? 2000) * (ataque && ficha.duasArmas && GemasPoe.usaTempoDaSecundaria(entry.poeGema.slug) ? fatorDoTempoDaSecundaria(estado, ficha) : 1);
  const intervalo = (intervaloDaFicha * Math.max(0.1, 1 + global / 100) + (t.tempoExtraMs ?? 0)) / Math.max(0.1, 1 + (global + daGema) / 100) / Math.max(0.1, 1 + (porTag.atk_speed_mais ?? 0) / 100) / porEstagioVel;
  const lentidao = doJogador ? Controle.fatorDeLentidao(estado.hunt) : 1;
  // (lote 34, P008: o CLAMOR não é ataque nem magia — a Velocidade de Conjuração não vale nele; o tempo de uso dele encurta pela "Velocidade dos
  // Clamores aumentada", `velocidade_clamor`)
  const ehClamor = entry.poeGema.arquetipo === 'clamor';
  // (17/10, lote G2: + a "Velocidade de Clamor aumentada" da própria gema — `temposNoNivel.velClamor`)
  const velocidadeDoUso = ehClamor ? ModsPoe.valor(ficha, 'velocidade_clamor') + (porTag.velocidade_clamor ?? 0) + (t.velClamor ?? 0) : castSpeed;
  // (17/10, lote G3: a Rajada — "X% mais Tempo de Ataque por Projétil" / "de Arremesso de Minas e Armadilhas por Projétil": × (1 + X × os
  // projéteis do uso), o "mais" do PoE por projétil; e o "mais/menos Velocidade de Arremesso" dos suportes de Armadilha/Mina)
  const projeteisDoUso = 1 + Math.max(0, Math.floor(efeitoDaGema?.alvosExtras ?? 0));
  const porProjetil = (ataque ? efeitoDaGema?.tempoPorProjetilPct ?? 0 : 0) + (plantaTipo ? efeitoDaGema?.tempoArremessoPorProjetilPct ?? 0 : 0);
  const maisTempo = (1 + (porProjetil * projeteisDoUso) / 100) / Math.max(0.1, 1 + arremessoMais / 100) / Math.max(0.1, 1 + (arremessoDaGema?.maisPct ?? 0) / 100);
  // (lote A2: "Velocidade de Conjuração desta Habilidade não pode ser modificada" — a Fenda Temporal: os 0,25 s dela, fixos)
  const conjuracaoFixa = entry.poeGema.slug === 'Temporal_Rift';
  // (lote B1, dono 20/10: + o "X% mais Velocidade de Conjuração" do uso — a qualidade da Nova Elétrica da Procissão, `cast_speed_mais`: multiplica, como o PoB
  // active_skill_cast_speed_+%_final; o clamor não conjura)
  const conjMais = ataque || ehClamor ? 1 : Math.max(0.1, 1 + (porTag.cast_speed_mais ?? 0) / 100);
  const bruto = conjuracaoFixa ? t.conjuracaoMs : (ataque ? (intervalo / (t.velAtaqueBase / 100)) * suportes : (t.conjuracaoMs * suportes) / (1 + Math.max(0, velocidadeDoUso) / 100) / conjMais) * lentidao * maisTempo;
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
  // (17/10, lote G3: + "Velocidade de Recarga por armar Armadilhas aumentada" das Armadilhas Avançadas, só na habilidade que planta Armadilha)
  const doArremesso = plantaTipo === 'armadilha' ? efeitoDaGema?.recuperacaoArmadilhaPct ?? 0 : 0;
  // (lote A1, dono 19/10) o Passo Rápido: "+200% se não houver inimigos em sua presença" / "se usado enquanto um Inimigo Único estiver em sua
  // Presença" — a presença no uso (`RAIO_DA_PRESENCA`); fora da caçada, a recarga-base (10 s). + a do Piscar Gélido por inimigo na área
  // (`recuperacaoExtraPct`, do uso).
  let condicional = recuperacaoExtraPct;
  if ((t.recargaSemInimigosPct || t.recargaComUnicoPct) && doJogador && estado?.hunt?.pos) {
    const naPresenca = (estado.hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && distanciaChebyshev(m, estado.hunt.pos) <= ModsPoe.RAIO_DA_PRESENCA);
    if (!naPresenca.length) condicional += t.recargaSemInimigosPct ?? 0;
    else if (naPresenca.some((m) => m.boss || m.raridade === 'unico' || m.raridade === 'boss')) condicional += t.recargaComUnicoPct ?? 0;
  }
  const recarga = recargaBase > 0 && !clamorSemRecarga ? Math.round((recargaBase / Math.max(0.1, 1 + ((ficha.recuperacaoDeRecarga ?? 0) + (porTag.cooldown_recovery ?? 0) + daGemaNomeada + doArremesso + condicional) / 100)) * (1 + (efeitoDaGema?.recargaPct ?? 0) / 100)) : 0;
  // (O piso de 250 ms é só da INSTANTÂNEA, um tique; o resto vai até `R.INTERVALO_MINIMO_DA_ACAO_MS` — mais de uma ação cabe num tique.)
  // (18/10, lote G20a) COLOCAR O TOTEM: o SEU uso da gema de totem leva o tempo de posicionamento do PoE — 0,6 s, ou 0,5 s na Balista
  // (CalcSetup.lua:58-59) — ÷ (1 + a "Velocidade de Posicionamento do Totem aumentada": a das peças e da árvore, a da gema e a dos suportes — no PoB
  // todas AUMENTADAS) × a lentidão (a velocidade de ação — CalcOffence.lua:1380-1387). O tempo de conjuração ou de ataque da gema é o do totem
  // usando-a (`doJogador: false`); a recarga da gema fica.
  const colocarMs = doJogador && entry.poeGema.lacaio === 'totem'
    ? (1000 * (efeitoDaGema?.viraTotem === 2 || (GemasPoe.doSlug(entry.poeGema.slug)?.gema?.tipos ?? []).includes('TotemsAreBallistae') ? 0.5 : 0.6) * lentidao) / Math.max(0.1, 1 + (posDasPecas + (t.velPosicionamentoPct ?? 0) + (efeitoDaGema?.velPosicionamentoPct ?? 0)) / 100)
    : null;
  const uso = colocarMs != null ? Math.max(R.INTERVALO_MINIMO_DA_ACAO_MS, Math.round(colocarMs)) : bruto > 0 ? Math.max(R.INTERVALO_MINIMO_DA_ACAO_MS, Math.round(bruto)) : USO_DA_INSTANTANEA_MS;
  // (+ "Habilidades de Clamor Encaixadas têm +N Usos de Recarga" — os usos a mais da peça, `efeitoDaGema.usosExtra`; + 12/10, a árvore:
  // "Habilidades que Arremessam Armadilhas têm +1 Uso de Recarga" — `usos_recarga@armadilha`.)
  // (lote S1: + a Segunda Ventania — "Habilidades Não-Instantâneas Suportadas têm +1 Usos de Tempo de Recarga": só com tempo de uso)
  const usosExtra = (efeitoDaGema?.usosExtra ?? 0) + (porTag.usos_recarga ?? 0) + (bruto > 0 ? efeitoDaGema?.usosExtraNaoInstantanea ?? 0 : 0);
  const cargas = usosExtra ? Math.max(1, t.cargas ?? 1) + usosExtra : t.cargas;
  return { uso, recarga, ataque: colocarMs != null ? false : ataque, conjuracaoMs: colocarMs != null ? Math.round(colocarMs) : ataque ? 0 : Math.round(bruto), conjuracaoBaseMs: t.conjuracaoMs, velAtaqueBase: t.velAtaqueBase, cargas, ...(colocarMs != null ? { colocarTotem: true } : {}) };
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
  // (lote A1b, dono 19/10: D-c) a FILA do Teleporte Relampejante: na espera de um Teleporte, a barra só lança o Teleporte de novo (`podeAglomerarTeleporte`)
  const aglomera = hunt.conjurando && !concluir && !gatilho ? podeAglomerarTeleporte(estado, hunt, slot, hunt.clock ?? 0) : null;
  if (hunt.conjurando && !concluir && !gatilho && !aglomera) return { ok: false, erro: 'Conjurando.', motivo: 'CONJURANDO' };
  // `gatilho`: a magia ATIVADA por um suporte de gatilho do PoE (`ativarGatilhos`) — instantânea, fora da barra, sem o relógio de uso
  // (uma ação por vez) nem as condições do slot; respeita a recarga própria e paga o custo.
  const action = gatilho ? gatilho.acao : estado.actions?.[slot];
  if (!action?.id) return { ok: false, erro: 'Esse slot está vazio.', motivo: 'VAZIO' };
  if (action.enabled === false) return { ok: false, erro: 'Esse slot está desligado.', motivo: 'DESLIGADA' };
  let entry = POR_ID.get(action.id);
  if (!entry) return { ok: false, erro: 'Ação desconhecida.', motivo: 'DESCONHECIDA' };
  // (18/10, lote G20a) o TOTEM usa a habilidade da gema DO LUGAR DELE (`usarComoTotem`), pelo mesmo caminho do seu uso — o PoB: a skill do totem é a
  // sua skill com `skillFlags.totem` (dano, crítico, área, afecções, as linhas da gema e os suportes pela conta de sempre). A entrada da barra (a de
  // suporte, que invoca) vira a do golpe, sem o `lacaio` (o uso não invoca de novo); a gema tirada depois não o desfaz.
  // (lote A3b, dono 19/10: D3: + o golpe do OBJETO que o totem deixou — a bola, o tornado — é do totem, pelo mesmo caminho)
  const doTotem = plantada?.tipo === 'totem' || (plantada?.tipo === 'objeto' && !!plantada.doTotem);
  if (doTotem) entry = { ...entry, papeis: ['attack'], group: 'attack', poeGema: { ...entry.poeGema, lacaio: undefined, doTotem: true } };
  // (lote B4, dono 25/10) o golpe do OBJETO de uma gema de BUFF (o feixe do Campo Galvânico — o buff é o uso; o dano é o do campo): o golpe sai como o de um uso
  if (plantada?.tipo === 'objeto' && plantada.comoUso && entry.poeGema?.buff) entry = { ...entry, papeis: ['attack'], group: 'attack', poeGema: { ...entry.poeGema, buff: false } };
  // (o dono, 25/10) o CONTRAGOLPE de uma gema de buff — o raio do Escudo Tempestuoso no atacante bloqueado: o acerto da gema no alvo, com o ricochete dela
  if (plantada?.tipo === 'contragolpe' && entry.poeGema?.buff) entry = { ...entry, papeis: ['attack'], group: 'attack', cadeia: entry.cadeia ?? {}, poeGema: { ...entry.poeGema, buff: false } };
  // (lote E2B, 26/10 — o PoB) o CASTIGO e o CASTIGO VAAL: o uso é o ATAQUE corpo a corpo (um alvo — "Melee Hit", area = false) com o raio nos inimigos perto (o do C1,
  // `raiosDoCastigo`); acertar um inimigo liga a aura (`auraDoCastigoE2b`). Antes o uso só ligava a aura.
  const castigoE2b = itensPoeLigado() && !plantada && entry.poeGema?.buff && GemasE2b.ehCastigo(entry.poeGema.slug) ? { buff: BUFFS[entry.id] } : null;
  if (castigoE2b) entry = { ...entry, papeis: ['attack'], group: 'attack', kind: 'spell', element: 'physical', damage: entry.damage ?? { min: 1, max: 1 }, poeGema: { ...entry.poeGema, buff: false } };
  // Defesa em profundidade: `definir()` já recusa vocação/level errados ao
  // configurar o slot, mas um arranjo salvo (`actionPresets`) antes de um
  // level up, por exemplo, não passa por ali de novo.
  if (!doTotem && bloqueio(entry, estado)) return { ok: false, erro: 'Você não pode mais usar isso.', motivo: 'BLOQUEADA' };
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
  // (lote A4, dono 19/10) a CANALIZAÇÃO que continua (a mesma gema canalizada usada de novo em seguida — `hunt.canalizacao`) não paga a recarga de novo:
  // a recarga (as Almas das Vaal — a Rajada de Chamas Vaal, as Lâminas Velozes Vaal) é do começo do canalizar, como no PoE; antes cada estágio a pagava
  // e a Vaal não passava do primeiro. (Revisão do A4: depois da LIBERAÇÃO — `hunt.canalizacao.liberou` — o ciclo seguinte é novo e paga a recarga.)
  const continuaCanal = itensPoeLigado() && !!entry.poeGema && !gatilho && !plantada && hunt.canalizacao?.acao === entry.id && !hunt.canalizacao.liberou && (concluir ? hunt.conjurando?.inicio ?? agora : agora) <= (hunt.canalizacao.ate ?? -Infinity) + 250 && tagsPoeDaSkill(entry).includes('canalizar');
  // (lote A1b, dono 19/10: D-a) a CARGA que pula a recarga: o Golpe Súbito (Frenesi), o do Poder (Poder), o Caminho Sagrado da Tolerância (Tolerância) — na
  // recarga e com a carga, a gema sempre gasta uma e sai (gasta quando o uso sai, abaixo); a recarga em curso não recomeça
  const cargaQuePula = itensPoeLigado() && entry.poeGema && !gatilho && !plantada ? GemasA1b.CARGA_QUE_PULA_A_RECARGA[entry.poeGema.slug] ?? null : null;
  // (revisão do B1: o pulo é decidido no COMEÇO do uso e segue na conjuração — `hunt.conjurando.pulaARecarga` —: a carga que acaba no meio dos 0,8 s do Estalo Gélido
  // não cancela o uso no fim)
  const pulaARecarga = concluir && hunt.conjurando?.id === entry.id && hunt.conjurando?.pulaARecarga ? !!cargaQuePula : !!cargaQuePula && !!cd && !R.liberou(agora, cd.ate) && (CargasPoe.ativas(estado)[cargaQuePula] ?? 0) > 0;
  if (!plantada && !gatilho?.ignorarRecarga && !continuaCanal && !pulaARecarga && cd && !R.liberou(agora, cd.ate)) return { ok: false, erro: 'Ainda recarregando.', motivo: 'COOLDOWN', faltaMs: cd.ate - agora };
  // (PoE, 11/10) A RETALIAÇÃO só se usa na janela: depois de bloquear um acerto (ou de um Acerto Selvagem) — `ModsPoe.abrirRetaliacao`. (lote A5, dono 20/10 —
  // D8: com a janela desta gema — o "X% maior" da Retaliação Experiente que a suporta)
  const gatilhoDaRetaliacao = !gatilho && entry.poeGema ? GemasPoe.gatilhoDeRetaliacao(entry.poeGema.slug) : null;
  if (gatilhoDaRetaliacao && !concluir && !ModsPoe.retaliacaoUsavel(hunt, gatilhoDaRetaliacao, entry.poeGema.slug, hunt.clock ?? 0, Gemas.efeitoNaSkill(estado, entry.id)?.retaliacaoJanelaPct ?? 0)) {
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
  let efeitoDaGema = comOsAlvosDaGema(entry, Gemas.ehSkillDeGema(entry) ? Gemas.efeitoNaSkill(estado, entry.id) : null, estado);
  // (lote A3b, dono 19/10) o projétil que o OBJETO solta (a espiral, o fragmento do Olho Invernal, o capturado das Lâminas Giratórias): `angulos` — um projétil
  // por ângulo (null: a direção aleatória da gema), sem os "+N projéteis" (já contados no objeto); `semVolta` — o capturado solto não volta de novo (D9)
  if (plantada?.tipo === 'objeto' && plantada.emitir && efeitoDaGema) {
    const angulos = Array.isArray(plantada.angulos) && plantada.angulos.length ? plantada.angulos : [null];
    efeitoDaGema = { ...efeitoDaGema, projeteisBase: angulos.length, alvosExtras: 0, ...(angulos.some((a) => a != null) ? { angulos, direcoesAleatorias: true } : {}), ...(plantada.semVolta ? { retornar: 0, retornarChance: 0 } : {}), ...(plantada.acertaNaOrigem ? { acertaNaOrigem: true } : {}) };
    // (lote PR1) as estilhas do escudo de Trarthus perfuram todos (não ricocheteiam, não difundem, não voltam)
    if (plantada.estilhas) efeitoDaGema = { ...efeitoDaGema, perfurar: 99, encadear: 0, bifurcar: 0, bifurcarDeNovo: 0, retornar: 0, retornarChance: 0, divisao: 0, rebatidas: 0 };
  }
  // (lote B2, dono 20/10) o que o lote B2 muda no uso (`GemasPoe.b2DaGema`, `itens-poe/gemas-b2.mjs`):
  //  - a Explosão Voltáxica: "60% do Dano de Raio Convertido em Dano de Caos" — a conversão da HABILIDADE, como a dos suportes (`ModsPoe.transformarPartes`); também no
  //    golpe do objeto dela (a explosão, que é o dano do uso)
  const b2 = itensPoeLigado() && entry.poeGema && !entry.poeGema.buff ? GemasPoe.b2DaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  if (b2?.raioEmCaosPct > 0 && efeitoDaGema) efeitoDaGema = { ...efeitoDaGema, 'af:conv_hab_energy_chaos': (efeitoDaGema['af:conv_hab_energy_chaos'] ?? 0) + b2.raioEmCaosPct };
  // (lote B3, dono 21/10) o que o lote B3 muda no uso (`GemasPoe.b3DaGema`, `itens-poe/gemas-b3.mjs`): a Conflagração, a Cremação da Exumação e a do Vulcão, a Troca de
  // Corpos, a Chuva de Lâminas de Trarthus
  const b3 = itensPoeLigado() && entry.poeGema && !entry.poeGema.buff ? GemasPoe.b3DaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  //  - o golpe do OBJETO com o "X% mais Dano com Acertos e Afecções" dele (a explosão da Rajada Divina — discus_slam_damage_+%_final_for_shockwave —, a da flecha da
  //    Conflagração — napalm_arrow_detonation_hit_damage_+%_final —, o PoB: KeywordFlag.Hit e Ailment): no acerto e nas afecções; o degenerativo da gema, não
  // (lote PR4, dono 25/10) o golpe do que grudou ou pulsou (`tiqueDasGemasPR4`): a explosão da Flecha Explosiva, o feixe do Golpe Estático, a explosão da Concha
  // (`GemasPR4.efeitoDoGolpePR4`); e, no seu uso, o "mais" dos Relâmpagos Concentrados de agora (`GemasPR4.comOsConcentrados` — o de antes do ganho, a exceção 9)
  if (itensPoeLigado() && plantada?.pr4 && efeitoDaGema) efeitoDaGema = GemasPR4.efeitoDoGolpePR4(efeitoDaGema, plantada.pr4);
  if (itensPoeLigado() && entry.poeGema && !plantada && efeitoDaGema && hunt.poeConcentrados?.acao === entry.id && hunt.poeConcentrados.ate > agora) {
    const rc = GemasPoe.concentradosDaGema(entry.poeGema.slug, efeitoDaGema.nivel ?? 1, efeitoDaGema.qualidade ?? 0);
    if (rc) efeitoDaGema = GemasPR4.comOsConcentrados(efeitoDaGema, rc.maisPct, Math.min(rc.maximo, hunt.poeConcentrados.n ?? 0));
  }
  // (lote PR4, dono 25/10) o golpe corpo a corpo do Golpe Estático não ricocheteia (a parte "Melee hit" do PoB: chaining = false); os feixes, sim (`tiqueDasGemasPR4`)
  if (itensPoeLigado() && entry.poeGema && !plantada && efeitoDaGema?.cadeiaPoe && GemasPoe.estaticoDaGema(entry.poeGema.slug, efeitoDaGema.nivel ?? 1)) efeitoDaGema = { ...efeitoDaGema, cadeiaPoe: { ...efeitoDaGema.cadeiaPoe, saltos: 0 } };
  if (plantada?.maisAcertoEAfeccaoPct && efeitoDaGema) {
    const x = (a) => ((1 + (a ?? 0) / 100) * (1 + plantada.maisAcertoEAfeccaoPct / 100) - 1) * 100;
    efeitoDaGema = { ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * (1 + plantada.maisAcertoEAfeccaoPct / 100), maisDanoAcertoPct: x(efeitoDaGema.maisDanoAcertoPct), maisAfeccaoPct: x(efeitoDaGema.maisAfeccaoPct) };
  }
  // (lote C3, dono 25/10) o golpe do ABALO do Terremoto: o "mais" só do acerto e o só das afecções (o do comum e o do Vaal, os dois iguais; o da Amplificação, por 0,1 s
  // de duração) — o PoB: KeywordFlag.Hit / KeywordFlag.Ailment
  if (plantada?.c3Mais && efeitoDaGema && (plantada.c3Mais.acertoPct || plantada.c3Mais.afeccaoPct)) {
    const x = (a, b) => ((1 + (a ?? 0) / 100) * (1 + (b ?? 0) / 100) - 1) * 100;
    efeitoDaGema = { ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * (1 + plantada.c3Mais.acertoPct / 100), maisDanoAcertoPct: x(efeitoDaGema.maisDanoAcertoPct, plantada.c3Mais.acertoPct), maisAfeccaoPct: x(efeitoDaGema.maisAfeccaoPct, plantada.c3Mais.afeccaoPct) };
  }
  // (lote B4, dono 25/10) o que o lote B4 muda no uso (`GemasPoe.b4DaGema`, `itens-poe/gemas-b4.mjs`):
  //  - D-B4.6: a INTENSIDADE da Lança Crepitante ("ganha Intensidade quando você Conjurá-la, máximo de 3"; "perde 1 de Intensidade a cada 0.5 segundos enquanto se movendo,
  //    ou imediatamente ao teleportar") pelo mecanismo do Intensificar (`intensidadeAgora`, `ganharIntensidade`): o máximo e a perda da gema, + o teleporte que zera. O
  //    "mais" por Intensidade vai abaixo, com a de agora. O totem não tem a sua
  const b4 = itensPoeLigado() && entry.poeGema && !entry.poeGema.buff ? GemasPoe.b4DaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  if (b4?.intensidade && efeitoDaGema && !doTotem) {
    const d = b4.intensidade;
    efeitoDaGema = { ...efeitoDaGema, intensidadeMax: Math.max(efeitoDaGema.intensidadeMax ?? 0, d.max), intensidadePerdaMs: efeitoDaGema.intensidadePerdaMs > 0 ? Math.min(efeitoDaGema.intensidadePerdaMs, d.perdeMs) : d.perdeMs, intensidadeTeleporte: true };
  }
  //  - D-B4.4: o PULSO da Hidroesfera converte o Físico pela afecção da esfera (`GemasB4.conversaoDaEsfera` — a conversão da habilidade, como a da Explosão Voltáxica)
  if (plantada?.tipo === 'objeto' && plantada.conversaoFisico && efeitoDaGema) {
    for (const [el, pct] of Object.entries(plantada.conversaoFisico)) if (pct > 0) efeitoDaGema = { ...efeitoDaGema, [`af:conv_hab_physical_${el}`]: (efeitoDaGema[`af:conv_hab_physical_${el}`] ?? 0) + pct };
  }
  //  - D-B2.2: o Ceifar e o da Carnificina — "Custa 20% mais Vida por Carga Sangrenta" (um "mais" só no custo de Vida da gema: o PoB, LifeCost MORE × BloodCharge)
  const sangrentasNoCusto = b2?.ceifar?.custoPorCargaPct ? GemasB2.cargasSangrentas(hunt, agora).n : 0;
  //  - (decisão do dono, 20/10 — o PoB) a Explosão de Lâminas do Descarrego detona as N lâminas do SEU Vórtice de Lâminas (o comum, não o Vaal): N explosões, cada uma com
  //    5% × N mais Dano e (100% + 1% por qualidade) × N mais Área; sem lâmina, não há dano — o uso não sai. As lâminas saem quando o uso sai (pagou)
  const vorticeDoDescarrego = b2?.descarrego ? (hunt.poeObjetos ?? []).find((o) => o.tipo === 'vortice' && o.dono === (doTotem ? 'totem' : 'voce') && !o.vaal && o.ate > agora && (o.z ?? 0) === (hunt.z ?? 0)) : null;
  const laminasDoDescarrego = vorticeDoDescarrego ? (vorticeDoDescarrego.laminas ?? []).filter((a) => a > agora).length : 0;
  if (b2?.descarrego && !laminasDoDescarrego) return { ok: false, erro: 'Sem lâminas do Vórtice de Lâminas para detonar.', motivo: 'SEM_LAMINAS' };
  if (laminasDoDescarrego && efeitoDaGema) {
    efeitoDaGema = { ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * (1 + (b2.descarrego.danoPorLaminaPct * laminasDoDescarrego) / 100), areaMaisPct: ((1 + (efeitoDaGema.areaMaisPct ?? 0) / 100) * (1 + (b2.descarrego.areaPorLaminaPct * laminasDoDescarrego) / 100) - 1) * 100 };
  }
  if (sangrentasNoCusto > 0 && efeitoDaGema && GemasPoe.recursoDoCusto(entry.poeGema.slug, efeitoDaGema.nivel ?? 1) === 'vida') {
    efeitoDaGema = { ...efeitoDaGema, custoPct: ((1 + (efeitoDaGema.custoPct ?? 0) / 100) * (1 + GemasB2.maisPelasSangrentas(b2.ceifar.custoPorCargaPct, sangrentasNoCusto) / 100) - 1) * 100 };
  }
  // (18/10, lote G20b) o SUPORTE QUE VIRA TOTEM (o Totem de Magia, o Totem Balista, o Devastador): o seu uso da habilidade suportada COLOCA um totem
  // (o tempo de posicionamento, o freio do máximo, a invocação — como a gema de totem); o totem a usa sozinho, com o "menos Dano/Velocidade" do
  // suporte (`usarComoTotem`). A ativada por gatilho e a plantada não viram totem.
  if (!doTotem && !gatilho && !plantada && itensPoeLigado() && entry.poeGema && !entry.poeGema.lacaio && efeitoDaGema?.viraTotem > 0) {
    entry = { ...entry, papeis: ['suporte'], group: 'support', poeGema: { ...entry.poeGema, lacaio: 'totem', doSuporte: true } };
  }
  // (17/10, lote G15) a CANALIZAÇÃO FOCADA: "X% mais dano / custo por segundo canalizando, até Y%" — os segundos desde o começo do canalizar
  // desta habilidade (`hunt.canalizacao`, contínua)
  if ((efeitoDaGema?.focadoDanoPorS || efeitoDaGema?.focadoCustoPorS) && hunt.canalizacao?.acao === entry.id && (hunt.clock ?? 0) <= hunt.canalizacao.ate + 250) {
    const seg = Math.max(0, ((hunt.clock ?? 0) - hunt.canalizacao.desde) / 1000);
    const dano = Math.min(efeitoDaGema.focadoDanoMax ?? 0, (efeitoDaGema.focadoDanoPorS ?? 0) * seg);
    const custo = Math.min(efeitoDaGema.focadoCustoMax ?? 0, (efeitoDaGema.focadoCustoPorS ?? 0) * seg);
    efeitoDaGema = { ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * (1 + dano / 100), custoPct: ((1 + (efeitoDaGema.custoPct ?? 0) / 100) * (1 + custo / 100) - 1) * 100 };
  }
  // (17/10, lote G13) a MINA detonada: "Dispara um Projétil adicional para cada N Minas anteriores na Sequência de Detonação" (`plantada.anteriores`)
  if (plantada?.tipo === 'mina' && entry.poeGema && efeitoDaGema) {
    const n = GemasPoe.minaDaGema(entry.poeGema.slug, efeitoDaGema.nivel ?? 1)?.porAnteriores;
    if (n > 0 && plantada.anteriores > 0) efeitoDaGema = { ...efeitoDaGema, alvosExtras: (efeitoDaGema.alvosExtras ?? 0) + Math.floor(plantada.anteriores / n) };
  }
  // (17/10, lote G2) A FORMA da área no RAIO DO PoE da gema (o da magia-molde do Draevor era fixo: a nova pegava 5 casas, fosse a Nova de Gelo
  // de 3 m ou a de 2,2 m) — `formaNoRaioDoPoe`.
  // (17/10, lote G10) o ESTÁGIO de canalização deste uso (`GemasPoe.estagiosDaGema`): o uso seguido da mesma habilidade canalizada ganha 1, até o
  // máximo; no máximo, a canalização se LIBERA (a abstração do idle: o PoE solta o botão) — `estagioDoUso`
  const estagioDoUso = estagioDaCanalizacao(hunt, entry, efeitoDaGema, inicio, { gatilho, plantada });
  // (lote G18) o "mais" só do acerto e o só das afecções do estágio entram no efeito do uso como os dos suportes (o G17: `maisDanoAcertoPct` sai da
  // afecção; `maisAfeccaoPct`/`maisIncendioPct` só nela)
  if (estagioDoUso && efeitoDaGema && (estagioDoUso.maisAcertoPct || estagioDoUso.maisAfeccaoPct || estagioDoUso.maisIncendioPct)) {
    const x = (a, b) => ((1 + (a ?? 0) / 100) * (1 + (b ?? 0) / 100) - 1) * 100;
    efeitoDaGema = {
      ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * (1 + estagioDoUso.maisAcertoPct / 100), maisDanoAcertoPct: x(efeitoDaGema.maisDanoAcertoPct, estagioDoUso.maisAcertoPct),
      maisAfeccaoPct: x(efeitoDaGema.maisAfeccaoPct, estagioDoUso.maisAfeccaoPct), maisIncendioPct: x(efeitoDaGema.maisIncendioPct, estagioDoUso.maisIncendioPct),
    };
  }
  // (lote A4, dono 19/10: D10) a gema ATIVADA pelo Atirar: o "X% mais Dano com Acertos/Afecções por Estágio do Tiro" × os estágios da liberação (`ativarGatilhos`
  // com `maisAcertoPct`/`maisAfeccaoPct` — como o estágio do uso: só o acerto e só a afecção)
  if (gatilho && efeitoDaGema && (gatilho.maisAcertoPct || gatilho.maisAfeccaoPct)) {
    const x = (a, b) => ((1 + (a ?? 0) / 100) * (1 + (b ?? 0) / 100) - 1) * 100;
    efeitoDaGema = { ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * (1 + (gatilho.maisAcertoPct ?? 0) / 100), maisDanoAcertoPct: x(efeitoDaGema.maisDanoAcertoPct, gatilho.maisAcertoPct), maisAfeccaoPct: x(efeitoDaGema.maisAfeccaoPct, gatilho.maisAfeccaoPct) };
  }
  // (lote G-D, dono 25/10) o "mais" do pulso da Runa da Penitência da Dissipação por Energia (`plantada.maisAcertoPct`/`maisAfeccaoPct` — só o acerto e só a afecção, como o
  // do gatilho) e o "menos Área" das magias da Runa do Arcanista (`gatilho.areaMaisPct`)
  if (plantada && efeitoDaGema && (plantada.maisAcertoPct || plantada.maisAfeccaoPct)) {
    const x = (a, b) => ((1 + (a ?? 0) / 100) * (1 + (b ?? 0) / 100) - 1) * 100;
    efeitoDaGema = { ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * (1 + (plantada.maisAcertoPct ?? 0) / 100), maisDanoAcertoPct: x(efeitoDaGema.maisDanoAcertoPct, plantada.maisAcertoPct), maisAfeccaoPct: x(efeitoDaGema.maisAfeccaoPct, plantada.maisAfeccaoPct) };
  }
  if (gatilho?.areaMaisPct && efeitoDaGema) efeitoDaGema = { ...efeitoDaGema, areaMaisPct: ((1 + (efeitoDaGema.areaMaisPct ?? 0) / 100) * Math.max(0, 1 + gatilho.areaMaisPct / 100) - 1) * 100 };
  // (lote A4, dono 19/10: E2) os estágios sem canalizar deste uso (o Devastar, o Golpe Duplo do Ímpeto): os de agora — o ganho é depois (`estagioSemCanalizar`)
  const semCanalizar = estagioSemCanalizar(hunt, entry, efeitoDaGema, inicio, { gatilho, plantada });
  // (revisão do A4, dono 19/10) a Rajada de Chamas Vaal cai no LOCAL MIRADO — o círculo no ponto do alvo, no raio dela —, não como a onda que sai de você
  if (itensPoeLigado() && entry.poeGema && GemasA4.NO_LOCAL_MIRADO[entry.poeGema.slug] && !plantada && !doTotem) entry = { ...entry, forma: Areas.circulo({ x: 0, y: 0 }, 3).map((c) => [c.x, c.y]), alvoNoCentro: true };
  // (lote A1b, dono 19/10) + a Corrente com Gancho: "+0.1 metro ao Raio por 5 de Fúria" (a Fúria de agora — 30 de Fúria: 2,4 m → 3,0 m)
  // (lote C1, dono 20/10: + a Cutilada da Fúria — "+0.1 metro ao Raio por 5 de Fúria")
  const raioDaFuria = itensPoeLigado() && entry.poeGema ? GemasA1b.raioExtraPelaFuria(GemasPoe.raioPorFuriaDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1), ModsPoe.furiaAtual(estado)) : 0;
  // (lote C1, dono 20/10) o que o lote C1 muda na forma e no efeito do uso, antes da área (`GemasPoe.c1DaGema`, `itens-poe/gemas-c1.mjs`)
  const c1 = itensPoeLigado() && entry.poeGema && !entry.poeGema.buff ? GemasPoe.c1DaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  //  - D1.1: a Cutilada e a Cutilada Vaal — "+0.1 metros de raio por inimigo próximo" (os vivos a até 2 casas de você, até 10 — o PoB)
  const raioDosInimigos = c1?.raioPorInimigoM && hunt.pos ? GemasC1.raioPelosInimigos(c1.raioPorInimigoM, (hunt.monstros ?? []).filter((b) => b.hp > 0 && !b.dummy && (b.z ?? hunt.z ?? 0) === (hunt.z ?? 0) && distanciaChebyshev(hunt.pos, b) <= GemasC1.CUTILADA.pertoCasas).length) : 0;
  //  - o buff da Cutilada Vaal na Cutilada e nas transfiguradas (`hunt.poeCutiladaVaal`, do golpe final num Raro/Único): o Golpe de Misericórdia, o "mais Área" e o
  //    "mais Dano com Acertos e Afecções" contra quem está em Vida Baixa (os atributos locais do uso — `af:` —, como os dos suportes)
  if (c1 && efeitoDaGema && !plantada && GemasC1.melhoradaPelaCutiladaVaal(entry.poeGema.slug) && hunt.poeCutiladaVaal?.ate > agora) {
    const b = hunt.poeCutiladaVaal;
    efeitoDaGema = {
      ...efeitoDaGema, areaMaisPct: ((1 + (efeitoDaGema.areaMaisPct ?? 0) / 100) * (1 + b.areaMaisPct / 100) - 1) * 100,
      ...(b.culling ? { 'af:culling': (efeitoDaGema['af:culling'] ?? 0) + 1 } : {}), 'af:mais_dano@alvoVidaBaixa': (efeitoDaGema['af:mais_dano@alvoVidaBaixa'] ?? 0) + b.maisVidaBaixaPct,
    };
  }
  //  - o Acerto Elemental: o elemento do uso é escolhido agora, sem repetir o anterior (guardado até o uso sair, como o raio sorteado), e o raio fica "80% mais"
  //    contra o alvo com a afecção daquele elemento
  let elementoDoAcerto = null;
  if (c1?.raioContraAfeccaoPct && !plantada) {
    const pend = (hunt.poeElementoPendente ??= {});
    elementoDoAcerto = pend[entry.id] ??= GemasC1.escolherElemento(hunt.poeElementoAnterior?.[entry.id] ?? null);
  }
  const raioDaAfeccao = elementoDoAcerto && alvo && GemasC1.temAfeccaoDoElemento(alvo, elementoDoAcerto, agora) ? (GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? 0) * (c1.raioContraAfeccaoPct / 100) : 0;
  entry = formaNoRaioDoPoe(entry, efeitoDaGema, Math.random, { hunt, minimo: plantada?.tipo === 'armadilha' ? Plantadas.PADRAO.armadilha.raioDeAtivacao : 0, raioExtraM: (estagioDoUso?.raioExtraM ?? 0) + raioDaFuria + raioDosInimigos + raioDaAfeccao + (b2?.chicote?.raioExtraM ?? 0) + (plantada?.raioExtraM ?? 0) });
  //  - a Evisceração: a onda RETANGULAR à frente — a extensão (10 m) em casas e a largura ("Circunferência base") com a fração de meia largura como a chance de uma
  //    casa a mais de cada lado (sorteada até o uso sair); a Área de Efeito do uso a estica depois (`areaNoUso`)
  if (c1?.onda && entry.forma) {
    const pend = (hunt.poeRaioPendente ??= {});
    const meia = (pend[`${entry.poeGema.slug}@larg`] ??= (() => { const c = c1.onda.larguraM / 4; return Math.trunc(c) + (Math.random() < c % 1 ? 1 : 0); })());
    entry = { ...entry, forma: GemasC1.formaRetangular(Math.max(1, Math.round(c1.onda.comprimentoM / 2)), meia) };
  }
  //  - D1.6: o Esmagar Escudos do Chefe Guerreiro — a Onda Central (o terço do meio do cone) no raio × √(1 + o "mais" da Onda Central), em casas (a fração sorteada
  //    até o uso sair)
  if (c1?.ondaCentralMaisPct && entry.forma) {
    const pend = (hunt.poeRaioPendente ??= {});
    const raioM = GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? 2.9;
    const rc = (pend[`${entry.poeGema.slug}@central`] ??= casasDoRaio(raioM * Math.sqrt(1 + c1.ondaCentralMaisPct / 100)));
    entry = { ...entry, forma: GemasC1.formaComOndaCentral(entry.forma, rc), ondaCentral: { cone: entry.forma, rc } };
  }
  // (lote C2, dono 20/10) o que o lote C2 muda no uso antes da área (`GemasPoe.c2DaGema`, `itens-poe/gemas-c2.mjs`)
  const c2 = itensPoeLigado() && entry.poeGema && !entry.poeGema.buff ? GemasPoe.c2DaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  // (lote C3, dono 25/10) o que o lote C3 lê no uso (`GemasPoe.c3DaGema`, `itens-poe/gemas-c3.mjs`): o Sangramento na Postura de Sangue, as estacas, os martelos, as erupções
  const c3 = itensPoeLigado() && entry.poeGema && !entry.poeGema.buff ? GemasPoe.c3DaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  // (lote C4, dono 21/10) o que o lote C4 faz no acerto (`GemasPoe.c4DaGema`, `itens-poe/gemas-c4.mjs`): o Tolhimento e as camadas da Praga, o Definhamento do Definhar,
  // o debuff do Golpe Pestilento e as regras do Veneno da gema
  const c4 = itensPoeLigado() && entry.poeGema && !entry.poeGema.buff ? GemasPoe.c4DaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  const msDoC4 = (ms) => Math.round(ms * fatorDeDuracao(estado, entry, efeitoDaGema));
  const definhadosPeloC4 = new Set();
  //  - o golpe de ALVO ÚNICO do Esmagar Ossos e do Golpe Infernal da Imolação (MeleeSingleTarget no PoB: a área é a do pulso e a da explosão, abaixo)
  if (c2?.alvoUnico && (!plantada || doTotem) && entry.forma) entry = { ...entry, forma: null };
  //  - D2.1: o Traumatismo — o "mais" pelos Traumatismos de agora (o ganho é no acerto — `acertar`); o totem não tem os seus
  const traumaDoUso = c2?.trauma && !plantada && !doTotem ? c2.trauma : null;
  if (traumaDoUso && efeitoDaGema) {
    const f = GemasC2.fatorDoTrauma(traumaDoUso, GemasC2.traumasAgora(hunt, agora));
    if (f !== 1) efeitoDaGema = { ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * f };
  }
  //  - D2.3: as CARGAS do uso — quantas ele gasta (gastas quando o uso sai, abaixo: os Martelos Sagrados 1 de Poder, os das Espirais e o Golpe Tectônico do Cataclismo
  //    todas; o Golpe Tectônico só lê as de Tolerância) e o que elas dão a este uso: o "mais" do dano, a área e as cascatas
  const cargasAgora = (c2?.martelos || c2?.fissura) && !plantada && !doTotem ? CargasPoe.ativas(estado) : null;
  const poderGasto = c2?.martelos && cargasAgora ? Math.min(cargasAgora.poder ?? 0, c2.martelos.consome) : 0;
  const toleranciaGasta = c2?.fissura && cargasAgora ? Math.min(cargasAgora.tolerancia ?? 0, c2.fissura.consome) : 0;
  if (efeitoDaGema && (poderGasto || toleranciaGasta)) {
    const maisArea = toleranciaGasta ? c2.fissura.maisAreaPorCargaPct * toleranciaGasta : 0;
    efeitoDaGema = {
      ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * GemasC2.fatorDosMartelos(c2.martelos, poderGasto) * (toleranciaGasta ? 1 + (c2.fissura.maisDanoPorCargaPct * toleranciaGasta) / 100 : 1),
      ...(maisArea ? { areaMaisPct: ((1 + (efeitoDaGema.areaMaisPct ?? 0) / 100) * (1 + maisArea / 100) - 1) * 100 } : {}),
    };
  }
  //  - as Gavinhas Relampejantes: o Pulso Mais Forte a cada N usos SEGUIDOS da canalização (`hunt.poeSeguidos`, contado quando o uso sai): sempre crítico (no
  //    acerto — `acertar`); o da Excentricidade, com o "mais" de Área e de Dano com Acertos e Afecções
  const seguidosDoUso = !gatilho && !plantada ? (hunt.poeSeguidos?.id === entry.id ? hunt.poeSeguidos.n : 0) + 1 : 0;
  const pulsoForteDoUso = c2?.pulsoForte && GemasC2.ehPulsoForte(c2.pulsoForte, seguidosDoUso) ? c2.pulsoForte : null;
  if (pulsoForteDoUso && efeitoDaGema && (pulsoForteDoUso.maisAreaPct || pulsoForteDoUso.maisDanoPct)) {
    efeitoDaGema = {
      ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * (1 + pulsoForteDoUso.maisDanoPct / 100),
      areaMaisPct: ((1 + (efeitoDaGema.areaMaisPct ?? 0) / 100) * (1 + pulsoForteDoUso.maisAreaPct / 100) - 1) * 100,
    };
  }
  // (lote A4, dono 19/10: D7) o ÂNGULO: a forma da gema (no raio dela) abre pelo "Ângulo aumentado em X%" — o Golpe no Chão do Tremor, a Laceração (a
  // do Abate sempre; a comum na Postura da Areia), o Incinerar ("100% de aumento do ângulo por estágio, até 300%") — `Areas.abrirForma`, até 360°
  const anguloDaGema = itensPoeLigado() && entry.poeGema && entry.forma ? GemasPoe.anguloDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  const anguloIncPct = anguloDaGema ? GemasA4.anguloNoUso(anguloDaGema, { estagio: estagioDoUso?.estagio ?? 0, areia: ModsPoe.posturaDe(hunt) === 'areia' }) : 0;
  // (a forma de antes do ângulo: a Área de Efeito do uso a estica e só então abre — `areaNoUso` —, para o ângulo valer no raio de verdade)
  const formaSemAngulo = entry.forma;
  if (anguloIncPct) entry = { ...entry, forma: Areas.abrirForma(entry.forma, 1 + anguloIncPct / 100) };
  // (lote A2, dono 19/10: a Parede de Força simplificada) o uso de PROJÉTIL cuja linha até o alvo cruza a sua Parede de Força: +1 ricochete e −20% de
  // dano (a colisão é gasta quando o uso sai — abaixo)
  const naParede = itensPoeLigado() && !plantada && !doTotem && alvo && efeitoDaGema && entry.poeGema && !entry.poeGema.buff && !entry.cadeia && tagsPoeDaSkill(entry).includes('projetil') ? GemasA2.cruzaAParede(hunt, hunt.pos, alvo) : null;
  // (lote A2, dono 19/10: "Pacifismo: segue a regra do PoE … a IA troca de alvo quando o monstro está com 1 de vida e só o ataque com Pacifismo está
  // pronto") o ataque com o Pacifismo não sai no alvo com 1 de Vida (ele não o mataria); no automático, o alvo passa a ser o outro bicho mais perto
  if (efeitoDaGema?.naoMata > 0 && entry.poeGema?.ataque && alvo && alvo.hp <= 1 && !gatilho && !plantada) {
    if (!manual) {
      const outro = hunt.monstros.filter((b) => b !== alvo && b.hp > 1 && !b.dummy && (b.z ?? hunt.z ?? 0) === (hunt.z ?? 0)).sort((a, b) => distanciaChebyshev(hunt.pos, a) - distanciaChebyshev(hunt.pos, b))[0];
      if (outro) hunt.alvo = outro.uid;
    }
    return { ok: false, erro: 'O Pacifismo não mata: o alvo está com 1 de Vida.', motivo: 'PACIFISMO' };
  }
  // (lote B4, dono 25/10 — D-B4.5) a PAREDE FLAMEJANTE: o uso de PROJÉTIL seu (ou do seu totem) cuja linha até o alvo cruza uma Parede Flamejante sua ganha o dano de Fogo
  // adicional dela ("Projéteis que passam pela parede causam X a Y de Dano de Fogo Adicional" — o PoB: FireMin/FireMax BASE com ModFlag.Projectile), × a eficácia
  // do dano adicionado, como o dos suportes; uma vez por projétil (a parede de fogo mais forte que a linha cruza). (revisão: a linha sai de onde o projétil sai — o
  // objeto do totem, a espiral, atira da casa dele; o totem direto já tem `hunt.pos` na casa dele, `usarComoTotem`)
  const pelaParedeDeFogo = itensPoeLigado() && (!plantada || doTotem) && alvo && efeitoDaGema && entry.poeGema && !entry.poeGema.buff && tagsPoeDaSkill(entry).includes('projetil') ? paredeDeFogoNoCaminho(hunt, plantada?.tipo === 'objeto' ? { x: plantada.x, y: plantada.y } : hunt.pos, alvo, agora) : null;
  if (pelaParedeDeFogo) efeitoDaGema = { ...efeitoDaGema, 'somadoMin:fire': (efeitoDaGema['somadoMin:fire'] ?? 0) + pelaParedeDeFogo[0], 'somadoMax:fire': (efeitoDaGema['somadoMax:fire'] ?? efeitoDaGema['somadoMin:fire'] ?? 0) + pelaParedeDeFogo[1] };
  if (naParede) efeitoDaGema = { ...efeitoDaGema, encadear: (efeitoDaGema.encadear ?? 0) + (Number(naParede.a2?.ricochetes) || 1), fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * Math.max(0, 1 - (Number(naParede.a2?.menosDanoPct) || 20) / 100) };
  // (PoE, a Lâmina Noturna: "Habilidades Suportadas só podem ser usadas com Garras e Adagas".)
  if (efeitoDaGema?.soGarraAdaga && !/^(Claws|Daggers|Rune_Daggers)$/.test(String(estado.equipment?.weapon?.poe?.classe ?? ''))) return { ok: false, erro: 'Só com Garras e Adagas (Lâmina Noturna).', motivo: 'ARMA' };
  // (17/10, lote G3) "Habilidades de Ataque Suportadas não podem ser usadas com Armas Corpo a Corpo" (os suportes de Armadilha e Mina) e "só podem
  // ser usadas com Arcos e Varinhas" (a Rajada).
  const classeDaArma = String(estado.equipment?.weapon?.poe?.classe ?? '');
  if (efeitoDaGema?.ataqueSemArmaCorpo && entry.poeGema?.ataque && classeDaArma && !/^(Bows|Wands)$/.test(classeDaArma)) return { ok: false, erro: 'Não com Arma Corpo a Corpo (Armadilha/Mina).', motivo: 'ARMA' };
  if (efeitoDaGema?.soArcoVarinha && !/^(Bows|Wands)$/.test(classeDaArma)) return { ok: false, erro: 'Só com Arcos e Varinhas (Rajada).', motivo: 'ARMA' };
  // (lote A3, dono 19/10) "Habilidades Suportadas só podem ser usadas com Arcos" (a Nova de Flechas)
  if (efeitoDaGema?.soArco && classeDaArma !== 'Bows') return { ok: false, erro: 'Só com Arcos (Nova de Flechas).', motivo: 'ARMA' };
  // (lote A4, dono 19/10) "Habilidades Suportadas só podem ser usadas com Machados, Maças, Cetros ou Cajados" (a Onda de Choque do Vazio; lote A5, dono 20/10: + a
  // Fissura e o Trauma — a regra geral dos suportes; + "só com Maças, Cetros ou Cajados" — a Onda de Choque — e "só com Machados e Espadas" — o Combate
  // Próximo. D6: com duas armas, só a mão principal, como a Lâmina Noturna)
  if (efeitoDaGema?.soMachadoMacaCetroCajado && !/^(One_Hand_Axes|Two_Hand_Axes|One_Hand_Maces|Two_Hand_Maces|Sceptres|Staves|Warstaves)$/.test(classeDaArma)) return { ok: false, erro: 'Só com Machados, Maças, Cetros ou Cajados.', motivo: 'ARMA' };
  if (efeitoDaGema?.soMacaCetroCajado && !/^(One_Hand_Maces|Two_Hand_Maces|Sceptres|Staves|Warstaves)$/.test(classeDaArma)) return { ok: false, erro: 'Só com Maças, Cetros ou Cajados.', motivo: 'ARMA' };
  if (efeitoDaGema?.soMachadoEspada && !/^(One_Hand_Axes|Two_Hand_Axes)$/.test(classeDaArma) && !ESPADAS.test(classeDaArma)) return { ok: false, erro: 'Só com Machados e Espadas.', motivo: 'ARMA' };
  // (lote A2, dono 19/10) a Lâmina de Energia só com espada ("não pode ser ativada ou usada com armas que não sejam espadas"); o Cajado Impregnado de
  // Mana, só com cajado (RequiresStaff)
  if (itensPoeLigado() && entry.poeGema?.slug === 'Energy_Blade' && !ESPADAS.test(classeDaArma)) return { ok: false, erro: 'Só com espadas (Lâmina de Energia).', motivo: 'ARMA' };
  if (itensPoeLigado() && entry.poeGema?.slug === 'Mana-Infused_Staff' && !CAJADOS.test(classeDaArma)) return { ok: false, erro: 'Requer um cajado.', motivo: 'ARMA' };
  // (lote G4) as gemas de escudo exigem um Escudo (a base delas é a da mão secundária)
  if (itensPoeLigado() && entry.poeGema?.ataque && GemasPoe.escudoDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1)?.base && estado.equipment?.shield?.poe?.classe !== 'Shields') return { ok: false, erro: 'Requer um Escudo.', motivo: 'ARMA' };
  // (PoE, o Intensificar: a INTENSIDADE desta magia agora — "perdem 1 de Intensidade a cada N segundos enquanto se movendo"; ela vale nesta
  // conjuração — mais dano em área, menos área — e a conjuração ganha 1, até o máximo — `ganharIntensidade`, depois do uso.)
  const intensidade = efeitoDaGema?.intensidadeMax > 0 ? intensidadeAgora(hunt, entry.id, efeitoDaGema, hunt.clock ?? 0, Ficha.combate(estado).afPoe) : 0;
  // (lote B4, dono 25/10 — D-B4.6) a Lança Crepitante: "X% mais Dano com Acertos e Afecções por Intensidade" (+ o da qualidade; o PoB: Damage MORE × Multiplier Intensity)
  if (intensidade > 0 && b4?.intensidade?.maisPorPct > 0 && efeitoDaGema && !doTotem) {
    const pct = b4.intensidade.maisPorPct * intensidade;
    const x = (a) => ((1 + (a ?? 0) / 100) * (1 + pct / 100) - 1) * 100;
    efeitoDaGema = { ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * (1 + pct / 100), maisDanoAcertoPct: x(efeitoDaGema.maisDanoAcertoPct), maisAfeccaoPct: x(efeitoDaGema.maisAfeccaoPct) };
  }
  // (lote A3, dono 19/10 — F7) o LOCALIZAR: "disparam um Projétil a menos por Intensidade" (os +3 do suporte; o PoB: ProjectileCount −1 por
  // Intensidade, até o máximo), com o "sempre disparam ao menos 1 Projétil" (o mais Dano por Intensidade vai no `fatorDoProjetil`)
  if (intensidade > 0 && efeitoDaGema?.intensidadeMenosProjetil > 0) {
    const base = Math.max(1, Math.round(Number(efeitoDaGema.projeteisBase) || 1));
    const total = Math.max(Math.round(efeitoDaGema.projeteisMinimo || 1), base + Math.round(Number(efeitoDaGema.alvosExtras) || 0) - intensidade * efeitoDaGema.intensidadeMenosProjetil);
    efeitoDaGema = { ...efeitoDaGema, projeteisBase: Math.min(base, total), alvosExtras: total - Math.min(base, total) };
  }
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
  if (itensPoeLigado() && auraDesabilitada(entry, auraPermitida(fichaDoCusto), Reserva.ehMaldicaoEmAura(entry, efeitoDaGema))) return { ok: false, erro: `${entry.name} está Desabilitada.`, motivo: 'AURA_DESABILITADA' };
  // (lote 80, o Mensageiro Solitário: "Você só pode ter um Arauto")
  if (itensPoeLigado() && arautoExcedente(hunt, entry.id, fichaDoCusto)) return { ok: false, erro: `${entry.name}: você só pode ter um Arauto.`, motivo: 'ARAUTO_UNICO' };
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
  const custoDeMana = entry.kind === 'item' || gatilho?.semCusto || reserva || Vinculos.ehVinculo(entry) || (doCustoPorTag.sem_custo_mana ?? 0) > 0 ? 0 : Math.max(0, Math.round((custoDaSkill(entry, efeitoDaGema, estado) * (1 + (fichaDoCusto.custoDeMana ?? 0)) * (1 + (efeitoDaGema?.custoPct ?? 0) / 100) * Math.max(0, 1 + (ModsPoe.valor(fichaDoCusto, 'custo_mana_inc') + (doCustoPorTag.custo_mana_inc ?? 0)) / 100) * Math.max(0, 1 + ((doCustoPorTag.custo_mana_mais ?? 0) + ModsPoe.valor(fichaDoCusto, 'custo_mana_mais')) / 100) * (gatilho?.custoMult ?? 1)) / Math.max(0.1, 1 + (ModsPoe.valor(fichaDoCusto, 'eficiencia_custo_mana') + (doCustoPorTag.eficiencia_custo_mana ?? 0)) / 100) / Math.max(0.1, 1 + eficaciaDaMina / 100) + ModsPoe.valor(fichaDoCusto, 'custo_mana_fixo') + (doCustoPorTag.custo_mana_fixo ?? 0)));
  // Life Cost (support): o custo sai da VIDA, e não da mana (sem deixar o personagem a menos de 1).
  // Magia Sanguínea (keystone do PoE): as habilidades custam Vida em vez de Mana.
  // (lote A2: + a gema cujo custo É de Vida — "Custo: 29 Vida", a Fúria Sangrenta — ou de Escudo de Energia — "Custo: 624 Escudo de Energia", a
  // Lâmina de Energia: `GemasPoe.recursoDoCusto`)
  const recursoDaGema = entry.poeGema ? GemasPoe.recursoDoCusto(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : 'mana';
  const pagaComVida = (!!efeitoDaGema?.custoEmVida || recursoDaGema === 'vida' || temHabilidade(estado, 'magiaSanguinea') || ModsPoe.valor(Ficha.combate(estado), 'keystone_magia_sanguinea') > 0) && custoDeMana > 0;
  if (pagaComVida && (estado.hp ?? 0) <= custoDeMana) return { ok: false, erro: 'Sem vida para pagar.', motivo: 'VIDA' };
  // (09/10, as maestrias da árvore:) "Habilidades (de Ataque) custam Vida ao invés de X% do seu Custo de Mana": essa parte sai da vida.
  const parteEmVida = pagaComVida || !custoDeMana ? 0 : Math.round((custoDeMana * Math.min(100, Math.max(0, ModsPoe.valor(fichaDoCusto, 'custo_em_vida_pct')))) / 100);
  if (parteEmVida && (estado.hp ?? 0) <= parteEmVida) return { ok: false, erro: 'Sem vida para pagar.', motivo: 'VIDA' };
  // (PoE, os únicos: "Habilidades custam escudo de energia em vez de mana ou vida" — `custo_em_es`; "Habilidades ganham Custo Base de Vida /
  // de Escudo de Energia igual a X% do Custo de Mana" — o custo a mais, além do de mana.)
  const pagaComEscudo = !pagaComVida && custoDeMana > 0 && (ModsPoe.valor(fichaDoCusto, 'custo_em_es') > 0 || recursoDaGema === 'es');
  if (pagaComEscudo && (estado.es ?? 0) < custoDeMana) return { ok: false, erro: 'Sem escudo de energia para pagar.', motivo: 'ESCUDO' };
  // (lote A2: + o Sangue Petrificado — "Habilidades ganham Custo de Vida Base igual a 40% do Custo de Mana Base enquanto não estiver em Vida Baixa":
  // sobre o custo BASE da gema, como no PoE)
  const doSangue = custoDeMana > 0 && !pagaComVida && !pagaComEscudo ? Math.round((custoDaSkill(entry, efeitoDaGema) * GemasA2.custoDeVidaDoSangue(estado, hunt)) / 100) : 0;
  // (revisão do A5: a gema que custa os três recursos — o Golpe Selvagem dos Extremos — paga a Mana pelo caminho de sempre e o MESMO custo em Vida e em Escudo de Energia)
  const custoTriplo = recursoDaGema === 'todos' && custoDeMana > 0 && !pagaComVida && !pagaComEscudo ? custoDeMana : 0;
  const vidaAMais = (custoDeMana > 0 ? Math.round((custoDeMana * ModsPoe.valor(fichaDoCusto, 'custo_vida_extra_pct')) / 100) : 0) + doSangue + custoTriplo;
  const escudoAMais = (custoDeMana > 0 ? Math.round((custoDeMana * ModsPoe.valor(fichaDoCusto, 'custo_es_extra_pct')) / 100) : 0) + custoTriplo;
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
  // (lote A1, dono 19/10) o DESLOCAMENTO da gema de movimento (`planoDoDeslocamento`): para onde ela leva, antes de gastar nada; sem destino, não
  // sai (o alvo longe demais do salto, ou perto demais para a viagem). Não vale no ativado por gatilho, na plantada nem no totem.
  const desloc = itensPoeLigado() && entry.poeGema && !gatilho && !plantada && !doTotem ? GemasPoe.deslocamentoDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  // (lote A1b, dono 19/10: D-c) o Teleporte na fila parte do destino do último da fila (`aglomera`)
  // (revisão do A1b: o hunt de verdade por baixo — `Object.create` —, para o plano ver a party, o guia e os aliados, que não são enumeráveis)
  const huntDoPlano = aglomera ? Object.assign(Object.create(hunt), { pos: { ...hunt.pos, x: aglomera.deslocamento.para.x, y: aglomera.deslocamento.para.y }, conjurando: null }) : hunt;
  const plano = desloc ? planoDoDeslocamento(estado, huntDoPlano, entry, action, alvo, desloc, { manual, vivos, fixo: concluir ? hunt.conjurando?.deslocamento ?? null : null }) : null;
  if (plano && !plano.ok) return plano;
  // (lote A1b, dono 19/10: I1–I7) a MIRAGEM da Investida Carregada neste uso (`planoDaMiragem`): para onde ela anda, o estágio, o pulso e a liberação — antes de
  // gastar nada; `gatilho.soltarMiragem`: só a liberação (I7, o fim do canalizar — `soltarMiragem`)
  const miragemDaGema = itensPoeLigado() && entry.poeGema && !doTotem && !plantada && (!gatilho || gatilho.soltarMiragem) ? GemasPoe.miragemDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  const miragemDoUso = miragemDaGema ? planoDaMiragem(estado, hunt, entry, action, alvo, miragemDaGema, efeitoDaGema, inicio, vivos, { soltar: !!gatilho?.soltarMiragem }) : null;
  if (miragemDoUso && !miragemDoUso.ok) return miragemDoUso;
  // (as pontas do dano: a casa onde a área do uso cai primeiro e a segunda — o Piscar Gélido e o Teleporte nas duas pontas; o de Retorno no destino
  // e de volta na origem; a Vaal do Teleporte em você e onde os bichos param)
  const pontas = plano && !plano.semMover && desloc.danoEm === 'origem_e_chegada' ? (desloc.modo === 'ida_e_volta' ? [plano.para, plano.de] : [plano.de, plano.para]) : null;
  // (o personagem: na casa de onde a gema bate — a chegada; nas duas pontas, a primeira)
  // (lote A3b: o golpe do OBJETO sai do lugar dele — a bola, o tornado, o olho)
  const x = plantada?.tipo === 'objeto' ? plantada.x : pontas ? pontas[0].x : plano && !plano.semMover ? plano.para.x : hunt.pos.x;
  const y = plantada?.tipo === 'objeto' ? plantada.y : pontas ? pontas[0].y : plano && !plano.semMover ? plano.para.y : hunt.pos.y;
  // (17/10, lote G12) as gemas de CADÁVER (`GemasPoe.cadaverDaGema`): o(s) cadáver(es) deste uso — o mais perto do alvo, ao alcance (os da Vaal:
  // todos em volta dele; os Mortos Voláteis: até N) — e a área da gema centrada nele (os Mortos Voláteis: no inimigo mais perto do cadáver, onde o
  // orbe vai). Sem cadáver, não sai. `cadaveresDoUso` explodem depois da faixa (`explodirCadaveres`).
  const doCadaver = itensPoeLigado() && entry.poeGema && !plantada && !gatilho ? GemasPoe.cadaverDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  let cadaveresDoUso = null;
  if (doCadaver) {
    const centro = mira ?? alvo ?? hunt.pos;
    const alcance = entry.range || ALCANCE_PADRAO;
    const podem = (hunt.cadaveres ?? []).filter((c) => (c.z == null || c.z === (hunt.z ?? 0)) && !(doCadaver.soMortos && c.criadoPor) && distanciaChebyshev(hunt.pos, c) <= alcance)
      .sort((a, b) => distanciaChebyshev(a, centro) - distanciaChebyshev(b, centro));
    if (!podem.length) return { ok: false, erro: 'Sem cadáver.', motivo: 'SEM_CADAVER' };
    cadaveresDoUso = doCadaver.modo === 'todos' ? podem.filter((c) => distanciaChebyshev(c, podem[0]) <= 3) : podem.slice(0, doCadaver.modo === 'consumir' ? doCadaver.maximo : 1);
    // (lote B1, dono 20/10) "X% de chance de detonar um cadáver adicional" (a qualidade do Detonar Mortos e do Vaal): o mais perto do alvo que ainda não
    // explode, ao alcance — a explosão dele (a % da Vida), como a dos outros do uso (`explodirCadaveres`)
    if (doCadaver.adicionalPct > 0 && Math.random() * 100 < doCadaver.adicionalPct) {
      const mais = podem.find((c) => !cadaveresDoUso.includes(c));
      if (mais) cadaveresDoUso = [...cadaveresDoUso, mais];
    }
    const primeiro = cadaveresDoUso[0];
    const doOrbe = doCadaver.modo === 'consumir' ? vivos.filter((b) => !b.dummy).sort((a, b) => distanciaChebyshev(a, primeiro) - distanciaChebyshev(b, primeiro))[0] : null;
    mira = doOrbe ? { x: doOrbe.x, y: doOrbe.y } : { x: primeiro.x, y: primeiro.y };
    // sem enemigo na explosão nem no dano mágico, não vale o uso
    const raioDaExplosao = Math.max(1, Math.round(doCadaver.raioExplosaoM / 2)) + (doCadaver.modo === 'geiser' ? 2 : 0);
    if (!vivos.some((b) => !b.dummy && cadaveresDoUso.some((c) => distanciaChebyshev(b, c) <= raioDaExplosao)) && !doOrbe) return { ok: false, erro: 'Nenhum bicho perto do cadáver.', motivo: 'SEM_BICHO_NA_AREA' };
  }
  // (lote B1, dono 20/10) a DESCARGA (`GemasB1.usoDaDescarga`): as cargas de agora — o dano BASE de cada elemento × as do tipo dele (Raio × Poder, Fogo ×
  // Tolerância, Gelo × Frenesi), "X% mais Área de Efeito por Carga removida" (um "mais" só, X × o total); sem carga, não sai. As cargas saem depois do golpe
  // (`descargaDoUso.remover`), salvo a chance da qualidade de não remover; o totem e a plantada usam as SUAS cargas, como o PoB
  // (revisão do B1: só as cargas REMOVÍVEIS — acima do mínimo, o PoB: max(Cargas − CargasMin, 0), CalcPerform.lua:1023-1089 —, contadas no começo do uso: as
  // que o golpe dá depois ficam, e as do mínimo também; tudo no mínimo, a gema não sai)
  const removiveisDaDescarga = itensPoeLigado() && entry.poeGema && /^Discharge/.test(entry.poeGema.slug) ? (() => { const at = CargasPoe.ativas(estado); const fc = Ficha.combate(estado).cargas ?? {}; return Object.fromEntries(CargasPoe.TIPOS.map((t) => [t, Math.max(0, (at[t] ?? 0) - CargasPoe.minimo(fc, t))])); })() : null;
  const descargaDoUso = removiveisDaDescarga ? GemasB1.usoDaDescarga(GemasPoe.descargaDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0), removiveisDaDescarga) : null;
  if (descargaDoUso) descargaDoUso.cargas = removiveisDaDescarga;
  if (itensPoeLigado() && entry.poeGema && /^Discharge/.test(entry.poeGema.slug) && !descargaDoUso) return { ok: false, erro: 'Sem cargas para descarregar.', motivo: 'SEM_CARGAS' };
  if (descargaDoUso && efeitoDaGema) {
    efeitoDaGema = { ...efeitoDaGema, danoBasePor: descargaDoUso.basePor, areaMaisPct: ((1 + (efeitoDaGema.areaMaisPct ?? 0) / 100) * (1 + descargaDoUso.areaMaisPct / 100) - 1) * 100 };
    descargaDoUso.remover = !(Math.random() * 100 < (GemasPoe.descargaDaGema(entry.poeGema.slug, efeitoDaGema.nivel ?? 1, efeitoDaGema.qualidade ?? 0)?.semRemoverPct ?? 0));
  }
  // (lote B1, dono 20/10 — D-B1.3) a BOMBA CONGELANTE DA APROXIMAÇÃO: "X% mais Dano com Acertos / Y% mais Dano com Afecções por cada 0.1 segundos de Duração" — ⌊a
  // duração final (a da gema, com a qualidade, × os modificadores de duração) ÷ 0,1 s⌋ décimos; o do acerto sai da afecção (`maisDanoAcertoPct`), como o estágio
  const porDuracao = itensPoeLigado() && entry.poeGema && efeitoDaGema ? GemasPoe.porDuracaoDaGema(entry.poeGema.slug, efeitoDaGema.nivel ?? 1) : null;
  if (porDuracao) {
    const segundos = (GemasPoe.compilada(entry.poeGema.slug, efeitoDaGema.nivel ?? 1, efeitoDaGema.qualidade ?? 0)?.stats?.duracao ?? 0) * fatorDeDuracao(estado, entry, efeitoDaGema);
    const m = GemasB1.maisPelaDuracao(porDuracao, segundos);
    const x = (a, b) => ((1 + (a ?? 0) / 100) * (1 + (b ?? 0) / 100) - 1) * 100;
    efeitoDaGema = { ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * (1 + m.acertoPct / 100), maisDanoAcertoPct: x(efeitoDaGema.maisDanoAcertoPct, m.acertoPct), maisAfeccaoPct: x(efeitoDaGema.maisAfeccaoPct, m.afeccaoPct) };
  }
  // (lote PR2, dono 20/10 — D3) a BARGANHA SOMBRIA: sem Esqueleto seu vivo a até o alcance da gema (de você ou do alvo), usa a SUA Vida (`baseDoRecursoNoUso`,
  // `maisDaBarganhaNoUso`); como no PoB, a Vida não sai de você. Com Esqueleto, a parte dele é da outra sessão (os lacaios)
  // (lote E1b, dono 26/10) com Esqueleto: o uso não fere na hora — cada Esqueleto da cadeia sacrifica a Vida e solta o acerto em volta dele (`barganhaDosEsqueletos`, depois
  // do custo); o acerto de cada um sai como a `plantada` 'barganha', com a Vida máxima dele
  const barganhaDoUso = itensPoeLigado() && entry.poeGema && efeitoDaGema ? GemasPoe.barganhaDaGema(entry.poeGema.slug, efeitoDaGema.nivel ?? 1, efeitoDaGema.qualidade ?? 0) : null;
  const esqueletosDoUso = barganhaDoUso && !plantada && !doTotem ? esqueletosDaBarganha(hunt, alvo, entry.range || ALCANCE_PADRAO) : [];
  if (barganhaDoUso && plantada?.tipo === 'barganha') efeitoDaGema = { ...efeitoDaGema, barganhaComVida: false, barganhaVidaEsqueleto: plantada.vidaEsqueleto };
  else if (barganhaDoUso) efeitoDaGema = { ...efeitoDaGema, barganhaComVida: !esqueletosDoUso.length && !esqueletoPerto(hunt, alvo, entry.range || ALCANCE_PADRAO) };
  // (lote G12: o uso que não tem acerto próprio — a Detonação do Saque, só a explosão; a Cremação, cujo dano mágico é o dos projéteis do gêiser)
  // (lote A4, dono 19/10: + o uso do Orbe Invernal — a canalização carrega o orbe; o dano é o dos projéteis dele, `tiqueDoOrbe`)
  const orbeDoUso = itensPoeLigado() && entry.poeGema && !gatilho && !plantada && !doTotem ? GemasPoe.orbeDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  // (lote B2, dono 20/10: + a Febre Corrompedora — o uso é o buff em você; o dano é o Sangue Corrompido dos SEUS acertos, `febreNoAcerto`)
  // (lote C2, dono 20/10: + a Vinculação da Tempestade — o uso espalha a runa; o dano é o da runa detonada pela Explosão de Runas, `explosaoDeRunas`)
  const runasDoUso = c2?.runas && !plantada && !doTotem ? c2.runas : null;
  // (lote PR3, dono 21/10: + o Pacto de Beidat — o uso é o buff que fortalece as próximas magias, `GemasPR3.pactoNoUso`)
  const usoDoPacto = itensPoeLigado() && entry.poeGema && !doTotem && !plantada && GemasPR3.ehPactoDeBeidat(entry.poeGema.slug) ? GemasPoe.pactoDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  // (lote B3, dono 21/10: + a Cremação do Vulcão — o uso deixa o gêiser no local, o dano é o dos projéteis dele, D-B3.5 —; a Chuva de Lâminas de Trarthus — o uso liga, o
  // dano é o das rajadas no tique, D-B3.4)
  const vulcaoDoUso = b3?.vulcao && !plantada ? b3.vulcao : null;
  const trarthusDoUso = b3?.trarthus && !gatilho && !plantada && !doTotem ? b3.trarthus : null;
  const semGolpeDireto = (!!doCadaver && (!doCadaver.comDano || doCadaver.modo === 'geiser')) || !!orbeDoUso || !!runasDoUso || !!b2?.febre || !!usoDoPacto || !!vulcaoDoUso || !!trarthusDoUso || esqueletosDoUso.length > 0;
  // (revisão do B3, 21/10) a Chuva de Lâminas de Trarthus por gatilho, totem, armadilha ou mina NÃO SAI — o PoB (act_dex.lua, BladefallOfTrarthus): "This skill
  // cannot be triggered or used by Totems, Traps, or Mines" (os `skillTypes` sem Triggerable/Totemable/Trappable/Mineable). Antes, virava um golpe direto comum.
  // A rajada dela (`rajadaDaTrarthus` → `golpeDoObjeto`, o `plantada` 'objeto' seu — que também chega com o `gatilho` das plantadas) segue saindo.
  if (b3?.trarthus && ((gatilho && !plantada) || doTotem || (plantada && plantada.tipo !== 'objeto'))) return { ok: false, erro: 'A Chuva de Lâminas de Trarthus não pode ser ativada nem usada por totens, armadilhas ou minas.', motivo: 'NAO_ATIVAVEL' };
  // (lote B3, dono 21/10 — D-B3.4) a Chuva de Lâminas de Trarthus LIGADA: o clique desliga; a barra automática não a usa de novo
  // (revisão do B3, 21/10) ANTES das checagens de alvo e de alcance: o clique desliga mesmo sem ninguém ao alcance (as rajadas são em volta de você)
  if (trarthusDoUso && hunt.poeTrarthus?.acao === entry.id) {
    if (!manual) return { ok: false, erro: 'Ainda está ativo.', motivo: 'EFEITO_ATIVO' };
    delete hunt.poeTrarthus;
    return { ok: true, eventos: [{ t: 'fx', id: 3, uid: 'player', x: hunt.pos.x, y: hunt.pos.y, sk: entry.id }], desligou: true };
  }

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
  // A CADEIA da gema a partir de `a0` (os ricochetes); (lote PR4, dono 25/10) o ENSANGUENTAR: "Releases several tendrils of blood from your character, targeting
  // enemies in a narrow angle in front of you … Effects which allow skills to chain can apply to these tendrils" — os N tentáculos (`GemasPR4.alvosDosTentaculos`, a
  // exceção 6), cada um com os ricochetes
  const cadeiaDe = (a0) => saltosDaCadeia(a0, vivos, efeitoDaGema?.cadeiaPoe ? { ...entry.cadeia, targets: 1 + efeitoDaGema.cadeiaPoe.saltos, distance: alcanceDoRicochete(DISTANCIA_DA_CADEIA_POE(), efeitoDaGema) } : entry.cadeia);
  const nDeTentaculos = itensPoeLigado() && entry.poeGema ? GemasPoe.tentaculosDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : 0;
  const alvosDaCadeia = (a0, origem) => (nDeTentaculos > 0 ? GemasPR4.alvosDosTentaculos(origem, a0, vivos, nDeTentaculos, entry.range || ALCANCE_PADRAO).flatMap((t) => cadeiaDe(t)) : cadeiaDe(a0));
  // (lote G11: os acertos da sequência de áreas da Ruptura — `{ bicho, pct, choque }`; null fora dela)
  let golpesDaSequencia = null;
  // (lote B3, dono 21/10) as flechas da Conflagração que ficam presas (D-B3.2) e o destino da Troca de Corpos (D-B3.3) deste uso
  let flechasDaConflagracao = null;
  let trocaNoUso = null;
  // (lote A4, dono 19/10: D5: as casas das estacas que este uso do Estilhaçar a Terra deixa — `porEstacas`; E1: o uso de carga da Ira Divina que acerta os
  // inimigos perto — `zapsDaIra`)
  let estacasDoUso = null;
  let zapsDaIra = false;
  // (lote C1, dono 20/10 — D1.4: os alvos do raio do Castigo do Julgamento Divino)
  let raiosDoCastigo = null;
  // (revisão do C1) os inimigos na sobreposição das ondas do Esmagar Escudos do Chefe Guerreiro (dois acertos)
  let duasOndas = null;
  // (revisão do C1) os acertados pela Corrente de Anzol para Pesca — os não únicos distantes são puxados para perto de você depois do ataque (`puxarParaPerto`)
  let puxadosDoAnzol = null;
  // (lote A4, dono 19/10: D10: o Atirar libera nas gemas suportadas — sem a flecha própria)
  let atirarSuportadas = false;
  let casas = null;
  // (lote 36) Onde a forma caiu (o centro e o lado) e a área deste uso com a Área de Efeito — a Repetição Final a refaz com o "aumentado" dela.
  let formaNoUso = null;
  let areaNoUso = null;
  // (lote 42, P067) "Projéteis são disparados em direções aleatórias": o projétil de alvo único não vai no alvo — todos saem em direções sorteadas
  // (`Secundarios.resolver`); o golpe direto e o tiro desenhado no alvo não saem.
  const projeteisAleatorios = () => !!efeitoDaGema?.direcoesAleatorias && !casas && Tags.tagsDaAcao(entry).includes('projectile');
  // (lote A3, dono 19/10) a ida que não acerta (o Arremesso Espectral da Materialização) e o ProjectileSpeedMod do uso (o `vel` dos tiros — D1)
  const soNaVolta = () => !!efeitoDaGema?.soNaVolta && !casas && Tags.tagsDaAcao(entry).includes('projectile');
  const velDoTiro = velocidadeDoProjetil(estado, entry, efeitoDaGema).mod;
  let virarPara = null;
  // (PoE, 12/10) A gema que PLANTA (Armadilha, Mina): o uso joga a armadilha/mina no lugar mirado; a habilidade sai quando ela ativa.
  const tipoPlantado = Plantadas.tipoDaGema(entry, efeitoDaGema);
  /*
   * (lote PR3, dono 21/10 — D7) o PACTO DE BEIDAT fortalece esta magia? (`hunt.poePacto`, `GemasPR3.pactoNoUso`): a sua magia não canalizada que dispara projéteis,
   * cai numa área no local mirado ou tem feixe com ricochete (a cadeia) — o totem, a armadilha e a mina não contam (a exceção 10). Fortalecida: "+35% de dano com
   * ataques e afecções" (o PoB: MORE com Hit e Ailment — o do acerto sai da afecção como o estágio, e o da afecção entra só nela), "6 projéteis adicionais … em círculo"
   * (o círculo de você — o `emCirculo` do A3), "Feixes … se propagam mais 6 vezes" (os saltos da cadeia) e "8 áreas adicionais em espiral" (`golpesDoPacto`). Gasta
   * uma das magias quando o uso sai (pagou).
   */
  const pactoAgora = itensPoeLigado() && entry.poeGema && efeitoDaGema && !doTotem && !plantada && !tipoPlantado && hunt.poePacto
    ? GemasPR3.pactoNoUso(hunt.poePacto, { tags: tagsPoeDaSkill(entry), cadeia: !!entry.cadeia, noLocal: !!(entry.miraNoChao || entry.alvoNoCentro) }) : null;
  if (pactoAgora) {
    const xm = (a, b) => ((1 + (a ?? 0) / 100) * (1 + (b ?? 0) / 100) - 1) * 100;
    efeitoDaGema = { ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * (1 + pactoAgora.maisPct / 100), maisDanoAcertoPct: xm(efeitoDaGema.maisDanoAcertoPct, pactoAgora.maisPct), maisAfeccaoPct: xm(efeitoDaGema.maisAfeccaoPct, pactoAgora.maisPct) };
    if (pactoAgora.projeteis > 0) efeitoDaGema = { ...efeitoDaGema, alvosExtras: (efeitoDaGema.alvosExtras ?? 0) + pactoAgora.projeteis, emCirculo: true, doPontoDoAlvo: false };
    if (pactoAgora.feixes > 0 && efeitoDaGema.cadeiaPoe) efeitoDaGema = { ...efeitoDaGema, cadeiaPoe: { ...efeitoDaGema.cadeiaPoe, saltos: (efeitoDaGema.cadeiaPoe.saltos ?? 0) + pactoAgora.feixes } };
  }
  // (lote G-D, dono 25/10 — D17) o PACTO DE K'TASH fortalece esta magia Vaal que causa dano (`hunt.poeKtash`, `GemasGBD.ktashFortalece`): "+29% de dano" — o MORE do PoB, no
  // acerto e nas afecções (como o de Beidat); gasta quando o uso sai e devolve as almas — a recarga volta pronta (`recargaDoGBD`). O totem, a armadilha, a mina e a ativada
  // por gatilho não contam
  const ktashAgora = itensPoeLigado() && entry.poeGema && efeitoDaGema && !doTotem && !plantada && !tipoPlantado && !gatilho && hunt.poeKtash && GemasGBD.ktashFortalece(tagsPoeDaSkill(entry), !semGolpeDireto) ? hunt.poeKtash : null;
  if (ktashAgora) {
    const xm = (a, b) => ((1 + (a ?? 0) / 100) * (1 + (b ?? 0) / 100) - 1) * 100;
    efeitoDaGema = { ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * (1 + ktashAgora.maisPct / 100), maisDanoAcertoPct: xm(efeitoDaGema.maisDanoAcertoPct, ktashAgora.maisPct), maisAfeccaoPct: xm(efeitoDaGema.maisAfeccaoPct, ktashAgora.maisPct) };
  }
  // (lote PR3) as áreas da espiral do Pacto: cada uma, a forma do uso transladada (`GemasPR3.centrosDaEspiral`); quem está nelas leva um acerto de cada (em `atacar`)
  let golpesDoPacto = null;
  // (lote A3b, dono 19/10) o OBJETO que este uso deixa no chão ou no tempo (`GemasPoe.objetoDaGema`, `criarObjetosDoUso`): o seu uso e o do totem (D3) — a
  // armadilha, a mina e o golpe que já sai de um objeto não deixam. `semAcerto`: o uso não acerta na hora (a bola, o tornado, a espiral, o olho)
  // (lote PR4, dono 25/10) o que este uso deixa grudado ou ligado (`pr4DoUso` → `aposOPasseDoPR4`): as flechas da Flecha Explosiva e da Eletrocussão, as cordas da
  // Flecha Aprisionadora, a Concha Somática, a energia do Golpe Estático e os Relâmpagos Concentrados — só o SEU uso (a exceção 3); e a concha que a explodida passa
  const pr4DoUso = itensPoeLigado() && entry.poeGema && efeitoDaGema && !doTotem && !tipoPlantado && (!plantada || plantada.pr4?.tipo === 'passaConcha') ? usoDoPR4(estado, entry, efeitoDaGema, !!plantada) : null;
  const objetoDaGemaNoUso = itensPoeLigado() && entry.poeGema && !entry.poeGema.lacaio && !tipoPlantado && (!plantada || plantada.tipo === 'totem') ? GemasPoe.objetoDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  // (lote B1, dono 20/10 — D-B1.10) a Invocar Tormenta: na chance da qualidade, o raio cai NA HORA (o uso acerta como sempre, sem o marcador); os outros marcadores
  // dela caem junto (`tormentasCaem`)
  const tormentaNaHora = objetoDaGemaNoUso?.tipo === 'tormenta' && Math.random() * 100 < (objetoDaGemaNoUso.naHoraPct ?? 0);
  const objetoDoUso = tormentaNaHora ? null : objetoDaGemaNoUso;
  // (lote A3b: D1/D2: os Disparos Congelantes de que esta Nova explode — `novasDosDisparos`; D8: as Lâminas Persistentes deste uso — `laminasDoUso`; os
  // projéteis que saíram — `emitidosDoUso`)
  let novasDosDisparos = null;
  // (lote B1, D-B1.8) os anéis das sequências da Chuva de Flechas Vaal (as casas de cada um), para a tela
  let aneisDaChuva = null;
  let laminasDoUso = null;
  const emitidosDoUso = [];
  // (lote A1) a SEGUNDA PONTA do deslocamento (as casas da área lá) e quem ele acertou nas duas (a recarga do Piscar Gélido conta os da área)
  let segundaPonta = null;
  const doDeslocamento = new Set();
  // (lote G-C, dono 25/10 — D11) a DETONAÇÃO DE FEITIÇOS: os Feitiços de cada vivo ANTES do uso (o "se o Inimigo estiver Enfeitiçado" e o que o acerto consome — os
  // que o próprio uso põe não contam); a área só sai se o alvo estava Enfeitiçado
  const detonacaoDoUso = itensPoeLigado() && entry.poeGema ? GemasPoe.detonacaoNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  const feiticosAntes = detonacaoDoUso ? new Map(vivos.map((b) => [b, GemasGAC.feiticosNoBicho(b, agora)])) : null;
  if (ataque) {
    const centradoNoAlvo = entry.miraNoChao || entry.alvoNoCentro;
    if (miragemDoUso) {
      // (lote A1b, dono 19/10: I4/I6) o PULSO da miragem: em volta dela, no raio do estágio (a Área de Efeito já entrou no raio — `planoDaMiragem`); o uso
      // sem pulso (os pares) e a liberação fora do uso não acertam aqui (a onda final sai depois do pulso, abaixo)
      casas = miragemDoUso.pulso ? miragemDoUso.casas : [];
    } else if (plano) {
      // (lote A1, dono 19/10) ONDE o dano do deslocamento cai (`Deslocamento.DESLOCAMENTO[slug].danoEm`): a área centrada no alvo (o salto mira o
      // ponto do inimigo — você fica colado nele), só o alvo (o Golpe Cintilante), o percurso (as Lâminas Giratórias; a Investida, com a área do
      // fim), onde pousa, ou as duas pontas. Sem raio publicado na gema, o da tabela (`raioM`, `raioDoFimM`).
      const alvoVivo = alvo?.hp > 0 ? alvo : null;
      const dano = desloc.danoEm;
      const raioDaTabela = dano === 'caminho_e_alvo' ? desloc.raioDoFimM : GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM == null ? desloc.raioM : null;
      if (raioDaTabela != null && entry.forma) entry = { ...entry, forma: Areas.escalarForma(entry.forma, Deslocamento.casasDosMetros(raioDaTabela)) };
      const noAlvo = ['no_alvo', 'caminho_e_alvo'].includes(dano) && alvoVivo && !plano.fuga;
      const centro = pontas ? pontas[0] : noAlvo ? alvoVivo : ['no_alvo', 'caminho_e_alvo', 'chegada', 'origem_e_chegada'].includes(dano) ? plano.para : null;
      if (dano === 'alvo') atingidos = alvoVivo ? [alvoVivo] : [];
      else if (dano === 'caminho') casas = [...plano.caminho, ...(alvoVivo && !plano.fuga ? [{ x: alvoVivo.x, y: alvoVivo.y }] : [])];
      else if (centro && entry.forma && dano !== 'nenhum') {
        casas = casasDaForma(entry, centro.x, centro.y);
        formaNoUso = { x: centro.x, y: centro.y, dir: null };
      }
    } else if (plantada?.tipo === 'objeto') {
      // (lote A3b, dono 19/10) o golpe do OBJETO (`tiqueDosObjetos`): o PULSO acerta todos no quadrado do raio dele (D4: a bola; D7: o tornado); o projétil
      // que ele solta (`emitir`) sai do lugar dele, na direção da espiral (o alvo é só a referência — o projétil acerta o primeiro da reta)
      if (!(alvo?.hp > 0)) return { ok: true, eventos: [] };
      if (plantada.emitir) atingidos = [alvo];
      // (lote B3, dono 21/10: + as casas dadas pelo objeto — as lâminas da rajada da Chuva de Lâminas de Trarthus, cada inimigo um acerto)
      else casas = Array.isArray(plantada.casas) ? plantada.casas : Areas.quadrado({ x: plantada.x, y: plantada.y }, Math.max(0, plantada.raio ?? 1));
    } else if (doTotem) {
      // (lote G20a) o TOTEM (`hunt.pos` é a casa dele — `usarComoTotem`), que já escolheu o alvo ao alcance (`cacadas.tiqueDosLacaios`): a área no
      // alvo (a de mirar no chão), virada para ele (a direcional: o lado com mais bichos, começando pelo do alvo, como no seu uso) ou em volta do
      // totem; a de alvo único, no alvo (com a cadeia da gema).
      if (!(alvo?.hp > 0)) return { ok: true, eventos: [] };
      if (entry.forma && centradoNoAlvo) {
        casas = casasDaForma(entry, alvo.x, alvo.y);
        formaNoUso = { x: alvo.x, y: alvo.y, dir: null };
      } else if (entry.forma) {
        // (o Totem Sísmico da Autoridade: "sacode a terra em volta de VOCÊ" — nova_spells_cast_at_target_location, act_str.lua:10211 —; os outros, em
        // volta do totem)
        const c = /_of_Authority$/.test(entry.poeGema.slug) && plantada.dono ? plantada.dono : { x, y };
        let melhor = null;
        for (const dir of direcional(entry) ? ordemDosLados(c, alvo) : [null]) {
          const cs = casasDaForma(entry, c.x, c.y, dir);
          const n = Areas.dentro(cs, vivos).length;
          if (!melhor || n > melhor.n) melhor = { dir, cs, n };
        }
        // (ninguém na área: o uso não acerta nada — antes o totem sempre acertava o alvo)
        if (!melhor.n) return { ok: false, erro: 'Nenhum bicho na área.', motivo: 'SEM_BICHO_NA_AREA' };
        casas = melhor.cs;
        virarPara = melhor.dir;
        formaNoUso = { x: c.x, y: c.y, dir: melhor.dir };
      } else atingidos = entry.cadeia ? alvosDaCadeia(alvo, { x, y }) : [alvo];
    } else if (plantada?.tipo === 'estaca') {
      // (lote A4, dono 19/10: D5) a ESTACA do Estilhaçar a Terra que explode: a área de `raio` casas em volta dela (sem a sequência das fissuras)
      casas = Areas.quadrado({ x: plantada.x, y: plantada.y }, plantada.raio ?? 1);
    } else if (plantada?.tipo === 'orbe') {
      // (lote A4, dono 19/10) o projétil do ORBE INVERNAL: no inimigo sorteado, a área de impacto dele (radius 16 do PoB: 1,6 m — em casas, a fração como chance)
      if (!(alvo?.hp > 0)) return { ok: true, eventos: [] };
      casas = Areas.quadrado({ x: alvo.x, y: alvo.y }, Math.max(0, casasDoRaio(1.6)));
    } else if (plantada) {
      // A Armadilha ativada / a Mina detonada / a Runa Ativada: a área em volta DELA (sem alcance — ela está lá); a de alvo único, em quem a
      // ativou (com a cadeia da gema).
      // (lote G-D, dono 25/10: + o acerto de UM alvo da Runa — o feixe da Tempestuosa em cada um, o golpe da Condução em cada inimigo com Energia: `soNoAlvo`)
      if (plantada.soNoAlvo) atingidos = alvo?.hp > 0 ? [alvo] : [];
      else if (entry.forma) {
        casas = casasDaForma(entry, plantada.x, plantada.y);
        formaNoUso = { x: plantada.x, y: plantada.y, dir: null };
      } else if (!(alvo.hp > 0)) atingidos = [];
      else atingidos = entry.cadeia ? alvosDaCadeia(alvo, { x: plantada.x, y: plantada.y }) : [alvo];
    } else if (!entry.forma && c1?.anzol) {
      // (lote C1, dono 20/10 — D1.2) a Corrente de Anzol para Pesca: "Lança uma corrente em até N inimigos" — os N vivos mais perto de você, a começar pelo alvo, no
      // alcance da Corrente com Gancho (6 m) com o "Alcance aumentado" da qualidade, em casas (a fração como a chance de uma casa a mais)
      if (!alvo) return { ok: false, erro: 'Sem alvo.', motivo: 'SEM_ALVO' };
      const alcance = Math.max(1, Deslocamento.casasDosMetros(c1.anzol.alcanceM));
      if (distanciaChebyshev(hunt.pos, alvo) > alcance) return { ok: false, erro: 'Alvo fora de alcance.', motivo: 'FORA_DE_ALCANCE' };
      const outros = vivos.filter((b) => b !== alvo && b.hp > 0 && (b.z ?? hunt.z ?? 0) === (hunt.z ?? 0) && distanciaChebyshev(hunt.pos, b) <= alcance).sort((a, b) => distanciaChebyshev(hunt.pos, a) - distanciaChebyshev(hunt.pos, b));
      atingidos = [alvo, ...outros].slice(0, c1.anzol.n);
      puxadosDoAnzol = [...atingidos];
    } else if (!entry.forma) {
      if (!alvo) return { ok: false, erro: 'Sem alvo.', motivo: 'SEM_ALVO' };
      // Sem `range` próprio é golpe de corpo a corpo (Brutal Strike, Tiger Clash...). (lote 35 — P001: com o alcance corpo a corpo em metros — o
      // da arma + os "+X metros ao Alcance de Golpes Corpo a Corpo", `Ficha.alcanceCorpoExtra` —, como o golpe básico)
      const corpoDaGemaNoAlvo = itensPoeLigado() && (!entry.range || (entry.poeGema && tagsPoeDaSkill(entry).includes('corpo')));
      // (lote A5, dono 20/10: + o alcance das linhas da gema e dos suportes — "+2.1 metros ao Alcance de Golpes Corpo a Corpo" das Lâminas Gélidas, o
      // Decapitar —, pela ficha do uso: `alcanceCorpoDoUso`)
      const alcanceDoGolpe = (entry.range || 1) + (corpoDaGemaNoAlvo ? (entry.poeGema ? alcanceCorpoDoUso(estado, entry, efeitoDaGema).casas : Ficha.combate(estado).alcanceCorpoExtra ?? 0) : 0);
      if (distanciaChebyshev(hunt.pos, alvo) > alcanceDoGolpe) return { ok: false, erro: 'Alvo fora de alcance.', motivo: 'FORA_DE_ALCANCE' };
      atingidos = [alvo];
      // (lote S1, 26/10) os ALVOS EXTRAS do Golpe corpo a corpo da gema ("focam em N Inimigos próximos adicionais" — o Chamado Ancestral, o Impelido pelo Clamor
      // Ancestral, a maestria dos Golpes): os N vivos mais perto do alvo a até o alcance do golpe a partir de você ("Os alvos extras precisam estar em uma distância
      // mínima do usuário"), × (1 + "Alvos Extras … podem ser encontrados X% mais distante" — em casas, a fração como chance); o mesmo golpe em cada um.
      // Antes o `alvosExtras` do golpe corpo a corpo não tinha quem o lesse.
      const extrasDoGolpe = corpoDaGemaNoAlvo && entry.poeGema?.ataque && !entry.cadeia ? Math.max(0, Math.floor(efeitoDaGema?.alvosExtras ?? 0)) : 0;
      if (extrasDoGolpe > 0 && tagsPoeDaSkill(entry).includes('golpe') && !tagsPoeDaSkill(entry).includes('projetil')) {
        const c = alcanceDoGolpe * (1 + (efeitoDaGema?.alcanceAlvosExtrasPct ?? 0) / 100);
        const raio = Math.max(1, Math.trunc(c) + (Math.random() < c % 1 ? 1 : 0));
        const outros = vivos.filter((b) => b !== alvo && b.hp > 0 && !b.dummy && (b.z ?? hunt.z ?? 0) === (hunt.z ?? 0) && distanciaChebyshev(hunt.pos, b) <= raio)
          .sort((a, b) => distanciaChebyshev(alvo, a) - distanciaChebyshev(alvo, b));
        atingidos = [alvo, ...outros.slice(0, extrasDoGolpe)];
      }
      // CADEIA (tag `chain`: Forked Thorns, Forked Glacier, Chained Penance...): do alvo, salta para o
      // bicho vivo mais perto a até `cadeia.distance` sqm do último atingido, até `cadeia.targets` alvos.
      // A cadeia da gema do PoE: 1 + os ricochetes DO NÍVEL dela (+ os do suporte de corrente); a distância do salto é a da magia-molde.
      if (entry.cadeia) atingidos = alvosDaCadeia(alvo, hunt.pos);
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
      // (lote A3b, dono 19/10: D2) a Nova Glacial dos Disparos e o Vórtice da Projeção: explodem dos SEUS Disparos Congelantes perto da mira (até o raio da
      // nova, a partir do alvo — os mais perto dele, até o máximo da gema), com o "mais Dano" e o "mais Área" da gema; sem Disparo perto, a nova em você
      const consome = itensPoeLigado() && entry.poeGema && !plantada && !doTotem && alvo ? GemasPoe.consomeDisparosDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : null;
      const marcas = consome ? disparosPerto(hunt, alvo, Areas.raioDaForma(entry.forma), consome.max, agora) : [];
      if (marcas.length) {
        novasDosDisparos = { consome, marcas, casas: [] };
        if (efeitoDaGema) efeitoDaGema = { ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * (1 + consome.maisDanoPct / 100), areaMaisPct: ((1 + (efeitoDaGema.areaMaisPct ?? 0) / 100) * (1 + consome.maisAreaPct / 100) - 1) * 100 };
        casas = casasDaForma(entry, marcas[0].x, marcas[0].y, null);
        formaNoUso = { x: marcas[0].x, y: marcas[0].y, dir: null };
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
      // (17/10, lote G3: + a Invenção — "área de efeito aumentada em X% por segundo que ficaram posicionadas antes de serem ativadas, até Y%")
      // (lote A4, dono 19/10: C: + a área do Ciclone pelo alcance — "X% por cada 0.1 metro de Alcance de Golpe Corpo a Corpo adicional" × os décimos de metro do
      // alcance a mais das peças e da árvore, `alcance_corpo_m`; E2: + o "50% mais Área de Efeito por cada estágio" do Devastar)
      const porAlcance = itensPoeLigado() && entry.poeGema ? GemasPoe.areaPorAlcanceDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : 0;
      // (lote A5, dono 20/10: + o alcance a mais das linhas do uso e dos suportes — `alcanceCorpoDoUso`)
      const alcanceExtra = porAlcance ? Math.max(0, Math.round(alcanceCorpoDoUso(estado, entry, efeitoDaGema).metrosExtra * 10)) : 0;
      const inc = (efeitoDaGema?.areaIncPct ?? 0) + (plantada?.areaPct ?? 0) + (maximizado ? efeitoDaGema.maximizadoAreaIncPct ?? 0 : 0) + daInvencao(plantada, efeitoDaGema, agora).area + porAlcance * alcanceExtra;
      const mais = [efeitoDaGema?.areaMaisPct ?? 0, intensidade > 0 ? -intensidade * (efeitoDaGema.intensidadeMenosAreaPct ?? 0) : 0, semCanalizar?.est.areaMaisPorEstagioPct ? semCanalizar.est.areaMaisPorEstagioPct * semCanalizar.estagio : 0];
      const legado = Math.round(efeitoDaGema?.areaExtra ?? 0);
      areaNoUso = (incExtra = 0) => {
        const n = ModsPoe.casasPelaArea(raio, ModsPoe.fatorDaArea(inc + incExtra, ...mais));
        const cs = n ? Areas.daForma(anguloIncPct ? Areas.abrirForma(Areas.escalarForma(formaSemAngulo, raio + n), 1 + anguloIncPct / 100) : Areas.escalarForma(entry.forma, raio + n), formaNoUso, formaNoUso.dir) : base;
        return legado ? Areas.mudar(cs, legado) : cs;
      };
      casas = areaNoUso();
      // (decisão do dono, 20/10) os 4 BRAÇOS do Vínculo de Mana: da borda do círculo, cada um ganha 0,6 m a cada 25% inteiros de Mana livre que você tem (a de agora ÷ a
      // máxima não reservada), × √ da Área do uso, em casas (a fração como chance), 1 casa de largura
      if (b2?.larguraDoVinculo && formaNoUso) {
        const livre = Math.max(0, (estado.maxMana ?? 0) - Reserva.reservadas(estado).mana);
        const extraM = GemasB2.bracosDoVinculo(b2.larguraDoVinculo, estado.mana ?? 0, livre);
        const raioC = casas.reduce((r, c) => Math.max(r, Math.abs(c.x - formaNoUso.x), Math.abs(c.y - formaNoUso.y)), 0);
        const comp = extraM > 0 ? casasDoRaio(((GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? 1.8) + extraM) * Math.sqrt(ModsPoe.fatorDaArea(inc, ...mais))) : 0;
        if (comp > raioC) {
          const ja = new Set(casas.map(Areas.chave));
          for (const [ux, uy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) for (let d = raioC + 1; d <= comp; d++) { const c = { x: formaNoUso.x + ux * d, y: formaNoUso.y + uy * d }; if (!ja.has(Areas.chave(c))) { ja.add(Areas.chave(c)); casas.push(c); } }
        }
      }
    }
    // (lote A1) a Investida com Escudo acerta também quem está no percurso; a segunda ponta é a mesma área, transladada
    if (plano && casas && desloc.danoEm === 'caminho_e_alvo') casas = [...casas, ...plano.caminho];
    if (pontas && casas) segundaPonta = casas.map((c) => ({ x: c.x - pontas[0].x + pontas[1].x, y: c.y - pontas[0].y + pontas[1].y }));
    // Quem está nas casas da área: por índice de casa (sem varrer área × bichos).
    if (casas) atingidos = Areas.dentro(casas, vivos);
    if (pactoAgora?.espiral > 0 && casas?.length && formaNoUso) {
      const raio = casas.reduce((m, c) => Math.max(m, Math.abs(c.x - formaNoUso.x), Math.abs(c.y - formaNoUso.y)), 0);
      const a0 = Math.atan2(formaNoUso.y - y, formaNoUso.x - x);
      golpesDoPacto = [];
      for (const c of GemasPR3.centrosDaEspiral(formaNoUso, pactoAgora.espiral, raio, a0)) {
        const cs = casas.map((k) => ({ x: k.x - formaNoUso.x + c.x, y: k.y - formaNoUso.y + c.y }));
        if (entry.efeito) golpesDoPacto.push({ evento: { t: 'area', id: entry.efeito, x: c.x, y: c.y, casas: Areas.paraTela(cs, c) } });
        for (const b of Areas.dentro(cs, vivos)) golpesDoPacto.push({ bicho: b });
      }
    }
    // (revisão do C1) o Esmagar Escudos do Chefe Guerreiro: "Inimigos podem ser acertados por duas das ondas sobrepostas" (o PoB: a parte "2 Overlapping Waves", dpsMultiplier 2;
    // o poedb: 100%, 100%, 100%) — quem está no cone E na Onda Central leva os dois acertos (`GemasC1.sobreposicaoDaOndaCentral`, na escala da Área do uso)
    if (entry.ondaCentral && casas && formaNoUso) {
      const cs = GemasC1.sobreposicaoDaOndaCentral(entry.ondaCentral.cone, entry.ondaCentral.rc, casas, formaNoUso);
      duasOndas = new Set(Areas.dentro(cs, atingidos));
    }
    // (revisão do C1, dono 20/10) a Evisceração: "Inimigos na sua frente podem ser acertados por ambas as ondas" (o PoB: a parte "Both Waves", dpsMultiplier 2) — quem
    // está na onda a 1 casa de você leva as duas
    if (c1?.onda && casas) duasOndas = new Set(atingidos.filter((b) => distanciaChebyshev({ x, y }, b) <= 1));
    // (lote B1, dono 20/10) "Acerta até N Inimigos" (o Condutor Elétrico dos Céus — o nível + a qualidade): os N da área mais perto do centro dela
    // (lote E1b, 26/10: + as Armadilhas Drenantes — "Aplica feixes aos N Inimigos próximos": os N mais perto da Armadilha, no raio dela)
    const maxAlvos = casas && itensPoeLigado() && entry.poeGema ? GemasPoe.maxAlvosDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) ?? GemasPoe.feixesDaDrenanteDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    if (maxAlvos) atingidos = GemasB1.maisPertoDoCentro(atingidos, formaNoUso ?? alvo ?? hunt.pos, maxAlvos);
    // (lote G-C, D11) "If the enemy was Hexed, also deals area damage to other enemies around the target" (o PoB): o alvo sem Feitiço leva só o acerto dele
    if (detonacaoDoUso && casas && alvo && !feiticosAntes.get(alvo)?.length) atingidos = atingidos.includes(alvo) ? [alvo] : [];
    // (lote C1, dono 20/10 — D1.5) a Pancada de Gelo da Cadência: a área no raio da mão da vez (1,1 m na principal, 3,1 m na secundária — o revezamento das duas
    // armas, `maoDaGemaDeAtaque`; sem a segunda arma, a principal), centrada na casa à sua frente na direção do alvo (como a Colisão de Gelo), × √ da Área de Efeito
    if (c1?.maos && casas && formaNoUso) {
      const fichaDaVez = Ficha.combate(estado);
      const daSecundaria = !!fichaDaVez?.duasArmas && GemasPoe.danoComAsDuasArmas(entry.poeGema.slug) == null && !hunt.golpeDaSecundaria;
      const dir = formaNoUso.dir ?? ordemDosLados(hunt.pos, alvo)[0];
      const [ux, uy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][dir] ?? [1, 0];
      const c = alvo && (alvo.x !== x || alvo.y !== y) ? Areas.reta({ x, y }, alvo, 1)[0] : { x: x + ux, y: y + uy };
      casas = Areas.quadrado(c, casasDoRaio((daSecundaria ? c1.maos.secundariaM : c1.maos.principalM) * Math.sqrt(ModsPoe.fatorDaArea(efeitoDaGema?.areaIncPct ?? 0, efeitoDaGema?.areaMaisPct ?? 0))));
      atingidos = Areas.dentro(casas, vivos);
      formaNoUso = { x: c.x, y: c.y, dir: null };
    }
    // (revisão do PR1) a Flecha Galvânica da Energia: sem flecha, o CONE sai de você na direção do alvo (ou da mira), no raio da gema × √ da Área de Efeito — no
    // lugar da área no chão do molde (`GemasPR1.temConeGalvanicoDeVoce`)
    if (itensPoeLigado() && entry.poeGema && GemasPR1.temConeGalvanicoDeVoce(entry.poeGema.slug) && casas && (alvo || mira)) {
      const raioM = GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? GemasPR1.CONE_GALVANICO.raioPadraoM;
      const r = Math.max(1, casasDoRaio(raioM * Math.sqrt(ModsPoe.fatorDaArea(efeitoDaGema?.areaIncPct ?? 0, efeitoDaGema?.areaMaisPct ?? 0))));
      const dir = ordemDosLados({ x, y }, mira ?? alvo)[0];
      casas = Areas.daForma(Areas.escalarForma(GemasA4.CONE_DO_TIRO_GELIDO.forma, r), { x, y }, dir);
      atingidos = Areas.dentro(casas, vivos);
      formaNoUso = { x, y, dir };
    }
    // (dono, 25/10 — a ramificação da Lança Crepitante) o FEIXE da Lança no lugar da área do molde: o principal de 7 casas (× √ da Área) na direção do alvo e as 2 laterais, do meio
    // dele, a 45° (67,5° na da Ramificação) × (1 − 33%) por Intensidade (`GemasB4.casasDaLanca`); cada inimigo nas casas leva um acerto
    if (b4?.lanca && casas && (alvo || mira) && (!plantada || doTotem)) {
      const l = b4.lanca;
      const n = doTotem ? 0 : intensidade;
      // (dono, 25/10 — a revisão: como o PoB, TODA a Área do uso alarga e alonga o feixe nas duas Lanças — a mesma conta da área das outras gemas: o "aumentado" da
      // gema, das peças e dos suportes, a Runa, e os "mais/menos", o da Intensidade do Intensificar também; + a qualidade da Ramificação, `casasDaLancaNoUso`)
      const fatorDoUso = ModsPoe.fatorDaArea((efeitoDaGema?.areaIncPct ?? 0) + (plantada?.areaPct ?? 0), efeitoDaGema?.areaMaisPct ?? 0, intensidade > 0 ? -intensidade * (efeitoDaGema?.intensidadeMenosAreaPct ?? 0) : 0);
      casas = GemasB4.casasDaLancaNoUso({ x, y }, mira ?? alvo, l, n, Math.random, fatorDoUso);
      atingidos = Areas.dentro(casas, vivos);
      formaNoUso = { x, y, dir: null };
    }
    // (lote C1, dono 20/10 — D1.4) o Castigo do Julgamento Divino: o raio cai nos N inimigos mais perto de você, a até X m (+ a qualidade), que o golpe ainda não
    // pegou ("Cada alvo só pode ser acertado uma vez por esta habilidade") — um acerto cada, com o "mais Dano em Área" do raio (`raiosDoCastigo`, em `atacar`)
    if (c1?.raioDoCastigo && !plantada && !doTotem) {
      const r = casasDoRaio(c1.raioDoCastigo.alcanceM);
      const ja = new Set(atingidos);
      raiosDoCastigo = vivos.filter((b) => b.hp > 0 && !b.dummy && !ja.has(b) && (b.z ?? hunt.z ?? 0) === (hunt.z ?? 0) && distanciaChebyshev(hunt.pos, b) <= r).sort((a, b) => distanciaChebyshev(hunt.pos, a) - distanciaChebyshev(hunt.pos, b)).slice(0, c1.raioDoCastigo.alvos + alvosDaAuraDoCastigoVaal(estado, hunt, entry));
      // (revisão do C1) o raio causa dano EM ÁREA ("fazendo com que um raio atinja um inimigo próximo, causando dano em área"): a área de "O raio Base é de X metros"
      // (1,5 a 2,1 m — o PoB, SmiteAltX: active_skill_base_area_of_effect_radius 15 + o do nível) em volta de cada alvo do raio, × √ da Área de Efeito do uso
      if (raiosDoCastigo.length) {
        const raioAreaM = GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? 0;
        raiosDoCastigo.casas = Math.max(0, casasDoRaio(raioAreaM * Math.sqrt(ModsPoe.fatorDaArea(efeitoDaGema?.areaIncPct ?? 0, efeitoDaGema?.areaMaisPct ?? 0))));
      }
    }
    // (lote B1, dono 20/10 — D-B1.8) as SEQUÊNCIAS da Chuva de Flechas Vaal (1 + 4): anéis concêntricos iguais no raio da área, a partir do alvo (o PoE e o poedb
    // não publicam o passo); cada inimigo leva só o golpe do anel em que está — o acerto da área, uma vez —, e a tela recebe um anel por sequência (`aneisDaChuva`)
    const seqDaChuva = casas && formaNoUso && itensPoeLigado() && entry.poeGema ? GemasPoe.sequenciasDaChuvaDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : null;
    if (seqDaChuva > 1) {
      const d = (c) => Math.max(Math.abs(c.x - formaNoUso.x), Math.abs(c.y - formaNoUso.y));
      const raio = casas.reduce((r, c) => Math.max(r, d(c)), 0);
      // (revisão do B1, dono 20/10: o raio que não comporta um anel por sequência — a flecha do PoE tem 1 m — repete a área inteira em cada sequência, só na tela;
      // o golpe segue um por inimigo)
      if (raio + 1 < seqDaChuva) aneisDaChuva = Array.from({ length: seqDaChuva }, () => casas);
      else {
        aneisDaChuva = Array.from({ length: seqDaChuva }, () => []);
        for (const c of casas) aneisDaChuva[GemasB1.anelDaCasa(d(c), raio, seqDaChuva)].push(c);
      }
    }
    // (lote A3b: D2) as outras novas dos Disparos Congelantes: a mesma área (com a Área de Efeito do uso), em cada um dos outros Disparos
    if (novasDosDisparos && casas && formaNoUso) novasDosDisparos.casas = novasDosDisparos.marcas.slice(1).map((c) => ({ c, cs: casas.map((q) => ({ x: q.x - formaNoUso.x + c.x, y: q.y - formaNoUso.y + c.y })) }));
    if (plano) for (const b of atingidos) doDeslocamento.add(b);
    // (17/10, lote G11) a SEQUÊNCIA DE ÁREAS da Ruptura: as N áreas em linha à frente (o raio cresce a cada área), cada uma acertando quem está
    // nela (a mesma criatura pode levar de mais de uma área), e as Ondas de Choque dos primeiros M acertados de cada área — `golpesDaSequencia`
    const seq = itensPoeLigado() && entry.poeGema && formaNoUso ? GemasPoe.sequenciaDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    if (seq) {
      const dir = formaNoUso.dir ?? ordemDosLados(hunt.pos, alvo)[0];
      const [ux, uy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][dir] ?? [1, 0];
      const fator = ModsPoe.fatorDaArea((efeitoDaGema?.areaIncPct ?? 0), efeitoDaGema?.areaMaisPct ?? 0);
      const emCasas = (m) => { const c = (m * Math.sqrt(fator)) / 2; return Math.max(0, Math.trunc(c) + (Math.random() < c % 1 ? 1 : 0)); };
      golpesDaSequencia = [];
      const unicos = new Set();
      // (lote A4, dono 19/10: as casas de todas as áreas — o que a tela desenha nas formas novas)
      const todas = new Map();
      const naCasa = (c) => todas.set(`${c.x},${c.y}`, c);
      const quem = (cs) => { const k = new Set(cs.map((c) => `${c.x},${c.y}`)); return vivos.filter((b) => b.hp > 0 && k.has(`${b.x},${b.y}`)); };
      if (seq.forma === 'linha') {
        // (lote C1, dono 20/10) a Ruptura de Trarthus: "Onda pode recomeçar até 3 vezes" — no fim de cada onda, se há um inimigo vivo onde a próxima chegaria (a até
        // o comprimento da onda — as N áreas, N casas — do centro da última área), ela recomeça dali na direção dele (o mais perto), com o raio de volta ao início
        // (o PoB: SunderWaveArea conta só dentro de uma onda)
        const onda = (centros) => centros.forEach((c, i) => {
          const r = emCasas(seq.raioM + seq.porAreaM * i);
          const naArea = vivos.filter((b) => b.hp > 0 && Math.max(Math.abs(b.x - c.x), Math.abs(b.y - c.y)) <= r);
          for (const b of naArea) { golpesDaSequencia.push({ bicho: b, pct: 100 }); unicos.add(b); }
          for (const fonte of naArea.slice(0, seq.choques)) {
            for (const b of vivos) if (b !== fonte && b.hp > 0 && Math.max(Math.abs(b.x - fonte.x), Math.abs(b.y - fonte.y)) <= Math.max(1, r)) { golpesDaSequencia.push({ bicho: b, pct: 100 - seq.choqueMenos, choque: true }); unicos.add(b); }
          }
        });
        let centros = Array.from({ length: seq.areas }, (_, i) => ({ x: x + ux * (i + 1), y: y + uy * (i + 1) }));
        onda(centros);
        for (let k = 0; k < (seq.recomecos ?? 0); k++) {
          const fim = centros.at(-1);
          const prox = vivos.filter((b) => b.hp > 0 && distanciaChebyshev(fim, b) >= 1 && distanciaChebyshev(fim, b) <= seq.areas).sort((a, b) => distanciaChebyshev(fim, a) - distanciaChebyshev(fim, b))[0];
          if (!prox) break;
          centros = Areas.reta(fim, prox, seq.areas);
          onda(centros);
        }
      } else if (seq.forma === 'retangulo') {
        // (lote A4, dono 19/10: D4) a CHUVA DE LÂMINAS: a rajada i a i+1 casas à frente de você, 1 casa de profundidade, a largura de (4,4 + 0,6 × i) m em casas (a
        // fração é a chance de uma a mais de cada lado); quem está na sobreposição leva mais de um acerto (o PoE). As Saraivadas: "X% mais Dano" e
        // "X% de aumento da Chance de Acerto Crítico" × a ordem da rajada (a primeira sem — a escolha sem fonte do lote)
        for (let i = 0; i < seq.areas; i++) {
          const cx = x + ux * (i + 1);
          const cy = y + uy * (i + 1);
          const meia = emCasas((seq.larguraM + seq.porAreaM * i) / 2);
          const cs = [];
          for (let l = -meia; l <= meia; l++) cs.push({ x: cx + uy * l, y: cy + ux * l });
          cs.forEach(naCasa);
          // (lote A3b, dono 19/10: D8) "Deixa uma Lâmina Persistente no solo para cada N Saraivadas": no centro da rajada
          if (objetoDoUso?.tipo === 'laminas' && objetoDoUso.por === 'saraivada' && (i + 1) % Math.max(1, objetoDoUso.cada) === 0) (laminasDoUso ??= []).push({ x: cx, y: cy });
          for (const b of quem(cs)) { golpesDaSequencia.push({ bicho: b, pct: 100 * (1 + (seq.maisPorAreaPct * i) / 100), critIncPct: seq.critPorAreaPct * i }); unicos.add(b); }
        }
      } else if (seq.forma === 'concentrica') {
        // (lote A4, dono 19/10) a COLISÃO DE GELO: os 3 acertos no mesmo centro — a casa à sua frente, na direção do alvo —, cada um no raio dele (em casas, a
        // fração como chance), com o "menos Dano" do 2º e do 3º estágio; quem está no meio leva os três
        const c = alvo && (alvo.x !== x || alvo.y !== y) ? Areas.reta({ x, y }, alvo, 1)[0] : { x: x + ux, y: y + uy };
        for (let i = 0; i < seq.areas; i++) {
          const cs = Areas.quadrado(c, emCasas(seq.raiosM[i]));
          cs.forEach(naCasa);
          for (const b of quem(cs)) { golpesDaSequencia.push({ bicho: b, pct: seq.pcts[i] }); unicos.add(b); }
        }
      } else if (seq.forma === 'estrela') {
        // (lote A4, dono 19/10: D5) o ESTILHAÇAR A TERRA: N fissuras em estrela a partir de você — as N das 8 direções mais perto da direção do alvo —, cada uma
        // com o comprimento do diâmetro da área da gema (em casas, a fração como chance — a escolha sem fonte do lote: o PoE não publica); quem está
        // nelas leva um acerto; na ponta de cada uma fica uma ESTACA (`estacasDoUso`, postas depois da explosão das velhas)
        const ang = alvo && (alvo.x !== x || alvo.y !== y) ? Math.atan2(alvo.y - y, alvo.x - x) : Math.atan2(uy, ux);
        const dif = (a) => { const d = Math.abs(a - ang) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
        const direcoes = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]].sort((a, b) => dif(Math.atan2(a[1], a[0])) - dif(Math.atan2(b[1], b[0]))).slice(0, Math.min(8, seq.areas));
        const raioM = GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? 1.8;
        estacasDoUso = [];
        for (const [dx, dy] of direcoes) {
          const cs = Areas.reta({ x, y }, { x: x + dx, y: y + dy }, Math.max(1, emCasas(2 * raioM)));
          cs.forEach(naCasa);
          for (const b of quem(cs)) unicos.add(b);
          estacasDoUso.push(cs.at(-1));
        }
        for (const b of unicos) golpesDaSequencia.push({ bicho: b, pct: 100 });
      } else if (seq.forma === 'cascata') {
        // (lote B3, dono 21/10 — D-B3.1) a CASCATA GLACIAL: as N rajadas em linha até o alvo (a i-ésima a i casas de você, na reta do local mirado — sem ele, na direção do
        // uso), cada uma no raio de 1,2 m × √ da Área (em casas, a fração como chance); a última — a Explosão Final — no raio de 2,4 m, com o "mais" dela (o PoB: a parte
        // "Final Burst"); quem está em mais de uma leva mais de um acerto (o "Empurra Inimigos ao Acertar" o leva na direção da próxima)
        const rumo = formaNoUso.x !== x || formaNoUso.y !== y ? formaNoUso : { x: x + ux, y: y + uy };
        Areas.reta({ x, y }, rumo, seq.areas).forEach((c, i) => {
          const final = !!seq.final && i === seq.areas - 1;
          const cs = Areas.quadrado(c, emCasas(final ? seq.final.raioM : seq.raioM));
          cs.forEach(naCasa);
          for (const b of quem(cs)) { golpesDaSequencia.push({ bicho: b, pct: final ? 100 * (1 + seq.final.maisPct / 100) : 100 }); unicos.add(b); }
        });
      } else if (seq.forma === 'ondas') {
        // (lote B3, dono 21/10 — D-B3.1; o PoB: "waves of lightning bursts expand outward from a targeted location") a RETRIBUIÇÃO DIVINA: as N ondas em anéis que crescem do
        // local mirado (a onda k no anel a k casas dele), cada uma com as M explosões sorteadas no anel (sem repetir a casa, se der), no raio do estouro × √ da Área (a
        // fração como chance); quem está em mais de uma explosão leva mais de um acerto
        for (let k = 1; k <= seq.ondas; k++) {
          for (const c of GemasB3.sortearCasas(GemasB3.anel(formaNoUso, k), seq.porOnda)) {
            const cs = Areas.quadrado(c, emCasas(seq.raioM));
            cs.forEach(naCasa);
            for (const b of quem(cs)) { golpesDaSequencia.push({ bicho: b, pct: 100 }); unicos.add(b); }
          }
        }
      } else if (seq.forma === 'chuvaRetangular') {
        // (lote B3, dono 21/10) a CHUVA CINÉTICA DO IMPACTO: o retângulo à sua frente, na direção do alvo — 9 m de comprimento a partir da casa ao seu lado e 4,5 m de
        // largura, × √ da Área (em casas, a fração como chance) —; cada projétil cai num inimigo da área (um por inimigo, na ordem, e de novo do primeiro quando sobram) e
        // explode no raio da gema (1,2 m × √ da Área); quem está na explosão leva o acerto dela (mais de uma explosão, mais de um acerto)
        const comp = Math.max(1, emCasas(seq.comprimentoM));
        const meia = emCasas(seq.larguraM / 2);
        const ret = [];
        for (let i = 1; i <= comp; i++) for (let l = -meia; l <= meia; l++) ret.push({ x: x + ux * i + uy * l, y: y + uy * i + ux * l });
        const naArea = quem(ret);
        const n = Math.max(1, Math.round(efeitoDaGema?.projeteisBase ?? 1) + Math.max(0, Math.round(efeitoDaGema?.alvosExtras ?? 0)));
        const raioM = GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? 1.2;
        for (let k = 0; k < n && naArea.length; k++) {
          const c = naArea[k % naArea.length];
          const cs = Areas.quadrado(c, emCasas(raioM));
          cs.forEach(naCasa);
          for (const b of quem(cs)) { golpesDaSequencia.push({ bicho: b, pct: 100 }); unicos.add(b); }
        }
      }
      atingidos = [...unicos];
      if (todas.size) casas = [...todas.values()];
    }
    // (lote B3, dono 21/10 — D-B3.2) a CONFLAGRAÇÃO (o PoB): as N flechas (3 + os "+N projéteis"), a primeira no local mirado e as outras sorteadas no raio de 3 m × √ da
    // Área em volta dele; cada uma acerta quem está no impacto (1 m × √ da Área, em casas, a fração como chance) e fica presa no chão (`flechasDaConflagracao`, depois do
    // golpe); o Fogo degenerativo não vem do impacto — é o da explosão (`tiqueDasGemasB3`)
    if (b3?.conflagracao && formaNoUso && !plantada && casas) {
      const cf = b3.conflagracao;
      const fatorA = ModsPoe.fatorDaArea(efeitoDaGema?.areaIncPct ?? 0, efeitoDaGema?.areaMaisPct ?? 0);
      const queda = Math.max(0, casasDoRaio(cf.quedaM * Math.sqrt(fatorA)));
      const n = Math.max(1, cf.flechas + Math.max(0, Math.round(efeitoDaGema?.alvosExtras ?? 0)));
      flechasDaConflagracao = Array.from({ length: n }, (_, i) => (i === 0 ? { x: formaNoUso.x, y: formaNoUso.y } : { x: formaNoUso.x + Math.floor(Math.random() * (2 * queda + 1)) - queda, y: formaNoUso.y + Math.floor(Math.random() * (2 * queda + 1)) - queda }));
      golpesDaSequencia = [];
      const todas = new Map();
      const unicos = new Set();
      for (const c of flechasDaConflagracao) {
        const cs = Areas.quadrado(c, Math.max(0, casasDoRaio(cf.impactoM * Math.sqrt(fatorA))));
        for (const q of cs) todas.set(`${q.x},${q.y}`, q);
        const k = new Set(cs.map((q) => `${q.x},${q.y}`));
        for (const b of vivos) if (b.hp > 0 && k.has(`${b.x},${b.y}`)) { golpesDaSequencia.push({ bicho: b, pct: 100 }); unicos.add(b); }
      }
      flechasDaConflagracao.raioExplosao = Math.max(0, casasDoRaio(cf.explosaoM * Math.sqrt(fatorA)));
      atingidos = [...unicos];
      casas = [...todas.values()];
    }
    // (lote B3, dono 21/10 — D-B3.3) a TROCA DE CORPOS: o destino é o cadáver perto do local mirado (a até 3 casas dele, ao alcance — o mais perto do local) ou, sem ele, a
    // casa livre ao lado do alvo (a mais perto de você); a explosão da magia sai nos DOIS lugares (de onde você sai e onde chega — o PoB: "dealing spell damage in an area at
    // both locations"), no raio da gema × √ da Área; quem está nas duas leva os dois acertos. O teleporte e a explosão do cadáver vêm depois do golpe (`trocaNoUso`)
    if (b3?.troca && formaNoUso && !plantada && !doTotem && casas) {
      const t = b3.troca;
      const ponto = { x: formaNoUso.x, y: formaNoUso.y };
      const alcance = entry.range || ALCANCE_PADRAO;
      const cad = (hunt.cadaveres ?? []).filter((c) => (c.z == null || c.z === (hunt.z ?? 0)) && distanciaChebyshev(c, ponto) <= GemasB3.TROCA_DE_CORPOS.cadaverPertoCasas && distanciaChebyshev(hunt.pos, c) <= alcance)
        .sort((a, b) => distanciaChebyshev(a, ponto) - distanciaChebyshev(b, ponto))[0] ?? null;
      const grade = gradeDoJogador(hunt);
      const livre = (c) => (!grade?.andavel || grade.andavel.has(`${c.x},${c.y}`)) && !casaOcupada(hunt, c.x, c.y, vivos);
      const aoLado = Areas.quadrado(ponto, 1).filter((c) => (c.x !== ponto.x || c.y !== ponto.y) && livre(c)).sort((a, b) => distanciaChebyshev(a, { x, y }) - distanciaChebyshev(b, { x, y }))[0] ?? null;
      const destino = cad && (livre(cad) || (cad.x === x && cad.y === y)) ? { x: cad.x, y: cad.y } : cad ? Areas.quadrado(cad, 1).filter(livre).sort((a, b) => distanciaChebyshev(a, cad) - distanciaChebyshev(b, cad))[0] ?? null : aoLado;
      const r = Math.max(0, casasDoRaio(t.raioM * Math.sqrt(ModsPoe.fatorDaArea(efeitoDaGema?.areaIncPct ?? 0, efeitoDaGema?.areaMaisPct ?? 0))));
      const lugares = [{ x, y }, ...(destino && (destino.x !== x || destino.y !== y) ? [destino] : [])];
      golpesDaSequencia = [];
      const todas = new Map();
      const unicos = new Set();
      for (const c of lugares) {
        const cs = Areas.quadrado(c, r);
        for (const q of cs) todas.set(`${q.x},${q.y}`, q);
        const k = new Set(cs.map((q) => `${q.x},${q.y}`));
        for (const b of vivos) if (b.hp > 0 && k.has(`${b.x},${b.y}`)) { golpesDaSequencia.push({ bicho: b, pct: 100 }); unicos.add(b); }
      }
      trocaNoUso = { destino, cad: cad && destino ? cad : null };
      atingidos = [...unicos];
      casas = [...todas.values()];
    }
    // (lote C3, dono 25/10 — D3.3) as ESTACAS da Perfuração: na Postura de Sangue (a da Carnificina, sempre), as N estacas (+ as "adicionais se você mudou de Postura
    // Recentemente" da Dualidade) caem nas casas da área em volta do alvo — uma em cada 3 no próprio alvo —, cada uma no raio dela (0,8 m; a da Carnificina, 1,1 m) × √ da
    // Área do uso (a fração como chance); quem está em mais de uma leva mais de um acerto. Na de Areia, a área de sempre (o raio da gema, com o "76% mais Área")
    if (c3?.estacas && formaNoUso && (!plantada || plantada.tipo === 'totem') && casas?.length && (c3.estacas.sempre || ModsPoe.posturaDe(hunt, agora) === 'sangue')) {
      const mudou = ModsPoe.condicoesDe(estado, Ficha.combate(estado).afPoe, null).has('mudouPosturaRecente');
      const centro = alvo?.hp > 0 ? { x: alvo.x, y: alvo.y } : { x: formaNoUso.x, y: formaNoUso.y };
      const r0 = (c3.estacas.raioM * Math.sqrt(ModsPoe.fatorDaArea(efeitoDaGema?.areaIncPct ?? 0, efeitoDaGema?.areaMaisPct ?? 0))) / 2;
      golpesDaSequencia = [];
      const todas = new Map();
      const unicos = new Set();
      for (const c of GemasC3.casasDasEstacas(GemasC3.estacasNoUso(c3.estacas, mudou), centro, casas)) {
        const cs = Areas.quadrado(c, Math.trunc(r0) + (Math.random() < r0 % 1 ? 1 : 0));
        for (const q of cs) todas.set(`${q.x},${q.y}`, q);
        const k = new Set(cs.map((q) => `${q.x},${q.y}`));
        for (const b of vivos) if (b.hp > 0 && k.has(`${b.x},${b.y}`)) { golpesDaSequencia.push({ bicho: b, pct: 100 }); unicos.add(b); }
      }
      atingidos = [...unicos];
      casas = [...todas.values()];
    }
    // (lote C3, dono 25/10) a FISSURA VULCÂNICA DO SERPENTEADO: "Fissuras irrompem N vezes adicionais" — depois da erupção, a fissura segue até o inimigo vivo mais perto (a até
    // 7 casas da última erupção — o alcance do projétil do jogo; o próprio atingido vale) e irrompe de novo, a mesma área; quem está em mais de uma leva mais de um acerto
    if (c3?.erupcoesExtras > 0 && formaNoUso && (!plantada || plantada.tipo === 'totem') && casas?.length) {
      const base = casas;
      const ref = { x: formaNoUso.x, y: formaNoUso.y };
      golpesDaSequencia ??= atingidos.map((b) => ({ bicho: b, pct: 100 }));
      const todas = new Map(casas.map((q) => [`${q.x},${q.y}`, q]));
      const unicos = new Set(atingidos);
      let c0 = ref;
      for (let k = 0; k < c3.erupcoesExtras; k++) {
        const prox = vivos.filter((b) => b.hp > 0 && !b.dummy && distanciaChebyshev(c0, b) <= GemasC3.SERPENTEADO.alcanceCasas).sort((a, b) => distanciaChebyshev(c0, a) - distanciaChebyshev(c0, b))[0];
        if (!prox) break;
        const cs = base.map((q) => ({ x: q.x - ref.x + prox.x, y: q.y - ref.y + prox.y }));
        for (const q of cs) todas.set(`${q.x},${q.y}`, q);
        const ks = new Set(cs.map((q) => `${q.x},${q.y}`));
        for (const b of vivos) if (b.hp > 0 && ks.has(`${b.x},${b.y}`)) { golpesDaSequencia.push({ bicho: b, pct: 100 }); unicos.add(b); }
        c0 = { x: prox.x, y: prox.y };
      }
      atingidos = [...unicos];
      casas = [...todas.values()];
    }
    // (lote S1, 26/10) a CASCATA MÁGICA (a comum: na frente e atrás; a Desperta e a Maior: também dos lados): as cópias da área do uso encostadas nela (o passo é o lado da
    // área, 2 × o raio + 1 casas), na linha de você até o centro (sem direção — o centro em você —, a do uso) e na perpendicular; quem está em mais de uma leva mais de um
    // acerto, como a Fissura do Serpenteado (`cascataMagicaS1`)
    if (efeitoDaGema?.cascataMagica > 0 && formaNoUso && (!plantada || plantada.tipo === 'totem') && casas?.length) {
      golpesDaSequencia ??= atingidos.map((b) => ({ bicho: b, pct: 100 }));
      const c = cascataMagicaS1(casas, formaNoUso, { x, y }, efeitoDaGema.cascataMagica, vivos, golpesDaSequencia, atingidos);
      atingidos = c.atingidos;
      casas = c.casas;
    }
    // (lote A4, dono 19/10: E1) as LIBERAÇÕES e os usos de carga com área própria:
    //  - a Ira Divina carregando: "Causa Dano em N Inimigos próximos quando você ganha Estágios" — os N vivos mais perto, no raio da explosão dela;
    //  - a Ira Divina liberando: a explosão em volta de você (3,8 m — o PoB; a Desintegração não tem) e o feixe à frente, na direção do alvo, até o
    //    alcance (1 casa de largura; a Luz Sagrada não tem) — um acerto em cada um que eles pegam;
    //  - as Lâminas Velozes Vaal liberando: um acerto em cada inimigo do círculo (1 m + 0,5 m por estágio, em casas);
    //  - o Atirar liberando sem gema suportada: a flecha própria, no alvo.
    const ira = itensPoeLigado() && entry.poeGema && estagioDoUso ? GemasPoe.iraDivinaDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    const raioDaIra = ira ? Math.max(1, casasDoRaio(ira.raioDaExplosaoM * Math.sqrt(ModsPoe.fatorDaArea(efeitoDaGema?.areaIncPct ?? 0, efeitoDaGema?.areaMaisPct ?? 0)))) : 0;
    if (ira && estagioDoUso.soCarrega && ira.zaps > 0) {
      atingidos = vivos.filter((b) => b.hp > 0 && !b.dummy && distanciaChebyshev(hunt.pos, b) <= raioDaIra).sort((a, b) => distanciaChebyshev(hunt.pos, a) - distanciaChebyshev(hunt.pos, b)).slice(0, ira.zaps);
      casas = null;
      zapsDaIra = true;
    } else if (ira && estagioDoUso.liberar) {
      const cs = new Map();
      if (ira.explosao) for (const c of Areas.quadrado({ x, y }, raioDaIra)) cs.set(`${c.x},${c.y}`, c);
      if (ira.feixe && alvo) for (const c of Areas.feixe({ x, y }, alvo, entry.range || ALCANCE_PADRAO)) cs.set(`${c.x},${c.y}`, c);
      casas = [...cs.values()];
      atingidos = Areas.dentro(casas, vivos.filter((b) => b.hp > 0));
    }
    const circulo = itensPoeLigado() && entry.poeGema && estagioDoUso?.liberar ? GemasPoe.circuloDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : null;
    if (circulo) {
      const r = Math.max(1, casasDoRaio(Math.min(circulo.maxM, circulo.baseM + circulo.porEstagioM * estagioDoUso.estagio)));
      casas = Areas.quadrado({ x, y }, r);
      atingidos = Areas.dentro(casas, vivos.filter((b) => b.hp > 0));
    }
    if (itensPoeLigado() && entry.poeGema?.slug === 'Snipe' && estagioDoUso?.liberar) {
      casas = null;
      atingidos = alvo?.hp > 0 ? [alvo] : [];
      // (D10: com gema de arco ligada, a flecha própria não sai — as suportadas saem, uma por estágio, depois do uso)
      atirarSuportadas = !gatilho && Gemas.gruposComGatilho(estado).some((g) => g.atirar === entry.id && g.magias.length);
    }
  }
  /*
   * ---- A faixa de criaturas do slot ("Mínimo" e "Máximo de criaturas") ----
   * Na magia de área conta quem a área PEGA; na de alvo único (e na cadeia), quem
   * está a até `RAIO_DA_FAIXA` sqm — o que a tela diz. Máximo 0 = sem teto.
   */
  // (a Armadilha/Mina: o raio sorteado vale só para esta ativação)
  if (plantada) consumirRaioDoPoe(hunt, entry);
  // (lote G10: o uso que só carrega estágios — a Rajada de Chamas antes do máximo — sai sem ninguém na área, como no PoE)
  // (lote A1) a VIAGEM e a FUGA saem sem bicho na área (o deslocamento é o efeito): o raio sorteado vale só para este uso
  // (revisão do C3) a TROCA de Postura do Sangue e Areia ligado (`trocarPosturaNoUso`, abaixo) sai sem bicho por perto: não gasta mana, só alterna a Postura
  const trocaPostura = itensPoeLigado() && manual && !gatilho && !plantada?.comoUso && !!BUFFS[entry.id] && GemasC3.ehGemaDePostura(entry.poeGema?.slug) && hunt.buffs?.[entry.id]?.ate > agora;
  if (ataque && plano && (desloc.modo === 'viagem' || plano.fuga)) consumirRaioDoPoe(hunt, entry);
  // (lote A1b, dono 19/10) a MIRAGEM canaliza sem bicho na área (ela anda; o pulso pega quem estiver lá) — o alvo do começo já foi conferido (`planoDaMiragem`)
  else if (ataque && miragemDoUso) consumirRaioDoPoe(hunt, entry);
  else if (ataque && !plantada && !estagioDoUso?.soCarrega && !semGolpeDireto) {
    // (O próprio alvo sempre conta: a magia de 7 sqm no bicho a 6 não some da faixa.)
    // (lote A3b: as novas dos Disparos Congelantes contam todas)
    const n = casas ? (novasDosDisparos?.casas.length ? new Set([...atingidos, ...novasDosDisparos.casas.flatMap((d) => Areas.dentro(d.cs, vivos))]).size : atingidos.length) : new Set([...atingidos, ...vivos.filter((b) => distanciaChebyshev(hunt.pos, b) <= RAIO_DA_FAIXA)]).size;
    if (n < Math.max(1, Number(action.minTargets) || 1)) {
      return casas ? { ok: false, erro: 'Nenhum bicho na área.', motivo: 'SEM_BICHO_NA_AREA' } : { ok: false, erro: 'Poucas criaturas para o mínimo do slot.', motivo: 'POUCAS_CRIATURAS' };
    }
    if (action.maxTargets > 0 && n > action.maxTargets) return { ok: false, erro: 'Criaturas demais para o máximo do slot.', motivo: 'CRIATURAS_DEMAIS' };
    // (17/10, lote G2) o uso sai: o raio sorteado da gema vale só para ele (`formaNoRaioDoPoe`)
    consumirRaioDoPoe(hunt, entry);
  // (revisão do A3b: o golpe do OBJETO não passa pelo "bicho por perto" — ele só sai com o alvo no raio do objeto, que pode estar longe de você)
  } else if (!plano && !trocaPostura && plantada?.tipo !== 'objeto' && !entry.heals && entry.kind === 'spell' && !vivos.some((b) => distanciaChebyshev(hunt.pos, b) <= 8)) {
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
  // (lote A1) o Passo Definhante: "Não pode ser Conjurado ou Ativado enquanto Elusivo"
  if (entry.poeGema?.slug === 'Withering_Step' && ModsPoe.buffAtivo(estado, 'elusivo')) return { ok: false, erro: 'Não sai enquanto você está Elusivo.', motivo: 'ELUSIVO' };
  // (lote A2, dono 19/10) as regras de uso das gemas do lote A2 (`regrasDoUsoA2`): desligar a Lâmina de Energia e a Automação no clique, a arma da
  // Lâmina e do Cajado, a Fúria do Berserk
  const doA2 = itensPoeLigado() && entry.poeGema ? regrasDoUsoA2(estado, hunt, entry, action, { manual, gatilho, agora }) : null;
  if (doA2) return doA2;
  // Suporte: não relança enquanto o efeito dele ainda está ligado.
  // (lote B4: o golpe do objeto de uma gema de buff — o feixe do Campo Galvânico — não é o buff)
  // (lote E2B: o Castigo é o ataque — a aura sai ao acertar, `auraDoCastigoE2b`)
  const buff = plantada?.comoUso || castigoE2b ? null : BUFFS[entry.id];
  // (lote C3, dono 25/10 — D3.1) o SANGUE E AREIA ligado: o clique troca de Postura (Sangue ↔ Areia — "Using the skill again alternates between Blood Stance and Sand
  // Stance", o PoB), na recarga da gema; a barra automática não troca sozinha. "Mudou de Postura Recentemente": os 4 s desde a troca (`trocarPosturaNoUso`)
  if (buff && trocaPostura) return trocarPosturaNoUso(estado, hunt, entry, action, agora);
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
    // (dono, 26/10) a Oferenda consome cadáveres: sem nenhum a até 4 casas, não sai
    if (q?.tipo === 'oferenda' && !GemasE1a.cadaveresDaOferenda(hunt).length) return { ok: false, erro: 'Nenhum cadáver perto.', motivo: 'SEM_CADAVER' };
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
  // (lote A1b, dono 19/10: I7) OUTRA habilidade sua no meio do canalizar da Investida Carregada (ou a mesma, depois de o canalizar ter acabado): a miragem é
  // LIBERADA antes — a onda final e o teleporte (`soltarMiragem`) —, e o uso é refeito de onde você ficou. Os eventos da liberação vão na fila do tique
  // (`hunt.poeEventosDoTempo`): o uso refeito pode não sair (o alvo agora fora de alcance) e não os levaria.
  if (itensPoeLigado() && !gatilho && !plantada && !concluir && hunt.miragem && !hunt.miragem.soltou && (hunt.miragem.acao !== entry.id || inicio > (hunt.miragem.ate ?? -Infinity) + 250 || (hunt.miragem.z ?? 0) !== (hunt.z ?? 0) || !naCasaDoCanalizar(hunt, hunt.miragem))) {
    (hunt.poeEventosDoTempo ??= []).push(...soltarMiragem(estado, hunt, personagem, alvo?.hp > 0 ? alvo : null));
    return dispararSemMarcar(estado, hunt, personagem, slot, alvo, { concluir, mira, gatilho, manual, plantada });
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
    // (lote A1: + o ATRASO do Teleporte Relampejante — `planoDoDeslocamento`: o personagem espera parado, como no PoE, e o teleporte sai no fim)
    const castMs = (entry.poeGema ? temposDaGemaPoe(estado, entry, efeitoDaGema).conjuracaoMs : Gemas.tempoDeConjuracao(estado, entry.id, Ficha.combate(estado).castSpeed)) + (plano?.atrasoMs ?? 0);
    // (lote A1b, dono 19/10: D-c) o Teleporte na FILA: a conjuração dele corre junto da espera do anterior; a espera dele começa quando ela acaba e o
    // anterior já teleportou (`fim`) — no fim da conjuração em curso, o próximo da fila assume (`concluirConjuracao`)
    if (aglomera && !(castMs > 0)) return { ok: false, erro: 'Conjurando.', motivo: 'CONJURANDO' };
    if (aglomera && plano) {
      const soConjuracaoMs = Math.max(0, castMs - (plano.atrasoMs ?? 0));
      const castFim = inicio + soConjuracaoMs;
      // (revisão do A1b: `alvoDoPlano` — o alvo do enfileirado, para o plano refeito no fim, se o destino ficou ocupado)
      (hunt.filaDoTeleporte ??= []).push({ slot, id: entry.id, alvo: null, alvoDoPlano: alvo?.uid ?? null, inicio, castFim, fim: Math.max(castFim, aglomera.fim ?? castFim) + (plano.atrasoMs ?? 0),
        deslocamento: { para: plano.para, de: plano.de, z: hunt.z ?? 0, ...(manual ? { manual: true } : {}) } });
      return { ok: true, conjurando: true, eventos: [{ t: 'cast', uid: 'player', quem: personagem?.nome, skill: entry.name, ms: soConjuracaoMs, sk: entry.id, x: plano.de.x, y: plano.de.y }] };
    }
    if (castMs > 0) {
      // Conjurando, já olha para onde a skill vai sair.
      virarParaOAlvo(hunt, mira && entry.miraNoChao ? mira : alvo);
      // Skill que não é de ataque (invocação, aura, buff) não depende do alvo: ele morrer no meio não cancela a conjuração.
      // (revisão do A1: o Teleporte e a Vaal dele, com o destino já escolhido, saem mesmo se o alvo morrer na espera — a conjuração não guarda o alvo)
      const semAlvoNaEspera = !!plano && ['viagem', 'inimigos'].includes(desloc.modo);
      hunt.conjurando = { ...(pulaARecarga ? { pulaARecarga: true } : {}), slot, id: entry.id, alvo: !ataque || (mira && entry.miraNoChao) || semAlvoNaEspera ? null : alvo?.uid ?? null, inicio, fim: inicio + castMs, ...(mira && entry.miraNoChao ? { mira } : {}),
        // (lote A1b, dono 19/10: D-c) o fim só da conjuração (sem a espera do Teleporte): dali em diante, o Teleporte pode entrar na fila
        castFim: inicio + Math.max(0, castMs - (plano?.atrasoMs ?? 0)),
        // (lote A1: o destino do deslocamento escolhido agora — no fim da conjuração ele vale, salvo a casa ocupada)
        ...(plano ? { deslocamento: { para: plano.para, de: plano.de, z: hunt.z ?? 0, ...(plano.semMover ? { semMover: true } : {}), ...(plano.fuga ? { fuga: true } : {}), ...(manual ? { manual: true } : {}) } } : {}) };
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
      // (lote A2) o Emblema do Poder: a mana gasta na área dele dá os estágios
      if (GemasA2.aoGastarManaNoEmblema(hunt, manaGasta, hunt.clock ?? 0)) Ficha.invalidar(estado);
    }
    // PoE: "X% de chance de, quando pagar o Custo de uma Habilidade, ganhar a mesma quantidade de Mana".
    if (Math.random() * 100 < ModsPoe.valor(Ficha.combate(estado), 'chance_devolver_custo')) estado.mana = Math.min(estado.maxMana ?? estado.mana, estado.mana + custoDeMana);
    Treino.gastarMana(estado, custoDeMana);
    // O Ocultista (cargas do PoE): Carga de Poder a cada N de mana gasta.
    const regrasDasCargas = Ficha.combate(estado).cargas;
    if (regrasDasCargas && CargasPoe.aoGastarMana(estado, regrasDasCargas, custoDeMana).length) Ficha.invalidar(estado);
  }

  const eventos = [];
  // (lote S1, 26/10) o SACRIFICAR e o SACRIFÍCIO VAAL no uso que você paga (`sacrificioDoUsoS1`)
  if (itensPoeLigado() && efeitoDaGema && !doTotem && !plantada) efeitoDaGema = doUsoS1(estado, entry, efeitoDaGema, agora);
  // (lote PR2, dono 20/10 — D1) o RITUAL PROIBIDO fere você a cada conjuração (pela resistência a Caos; pode matar); o do totem e o da armadilha/mina, não
  // (exceção 1 do lote)
  if (itensPoeLigado() && entry.poeGema && !doTotem && !plantada && !tipoPlantado && GemasPoe.ritualDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1)) ritualEmVoce(estado, hunt, personagem, entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, eventos);
  // (lote E1b, dono 26/10) a Barganha Sombria com Esqueleto: cada Esqueleto da cadeia sacrifica X% da Vida MÁXIMA (sem morrer) e o acerto da gema sai em cada inimigo na
  // área em volta dele (2,6 m), com a Vida sacrificada como Caos base
  if (esqueletosDoUso.length) {
    const raio = Math.max(1, Math.round(BARGANHA.raioM / 2));
    for (const s of esqueletosDoUso) {
      const vida = Math.max(0, s.maxHp ?? s.hp ?? 0);
      s.hp = Math.max(1, (s.hp ?? 0) - (vida * barganhaDoUso.vidaPct) / 100);
      for (const m of vivos.filter((b) => b.hp > 0 && !b.dummy && (b.z ?? hunt.z ?? 0) === (hunt.z ?? 0) && distanciaChebyshev(b, s) <= raio)) {
        const r = dispararSemMarcar(estado, hunt, personagem, slot, m, { plantada: { tipo: 'barganha', acao: entry.id, slot, x: s.x, y: s.y, z: hunt.z ?? 0, soNoAlvo: true, vidaEsqueleto: vida } });
        if (r?.ok) eventos.push(...(r.eventos ?? []));
      }
    }
  }
  // (lote G-D — D17) o Pacto de K'Tash gasto: a magia Vaal recebe as almas de volta (a recarga, no fim do uso — `recargaDoGBD`)
  if (ktashAgora && hunt.poeKtash === ktashAgora) {
    delete hunt.poeKtash;
    if (ktashAgora.devolveAlmas) hunt.poeKtashDevolve = entry.id;
  }
  // (lote PR3, dono 21/10) o PACTO DE BEIDAT: o uso dele fortalece as próximas N magias (com as da qualidade; um uso novo recomeça a conta — a exceção 12); a magia
  // fortalecida gasta uma
  if (usoDoPacto) {
    hunt.poePacto = { acao: entry.id, restantes: usoDoPacto.magias, maisPct: usoDoPacto.maisPct, espiral: usoDoPacto.espiral, feixes: usoDoPacto.feixes, projeteis: usoDoPacto.projeteis };
    if (entry.efeito) eventos.push({ t: 'fx', id: entry.efeito, uid: 'player', x: hunt.pos.x, y: hunt.pos.y });
  } else if (pactoAgora && hunt.poePacto && !semGolpeDireto && !objetoDoUso?.semAcerto) {
    // (revisão do merge, 21/10) só GASTA quando fortalece: o uso sem golpe direto (a Cremação do Vulcão — o gêiser —, a Chuva de Lâminas de Trarthus — as rajadas do
    // tique) e o que deixa um objeto que não acerta na hora (a Invocar Tormenta Vaal) não recebem o Pacto — o dano deles sai depois, de outro caminho (`plantada`)
    hunt.poePacto.restantes -= 1;
    if (!(hunt.poePacto.restantes > 0)) delete hunt.poePacto;
  }
  // (lote A1b, dono 19/10) o uso SAIU (pagou):
  //  - D-a: a carga que pula a recarga é gasta agora (o golpe já sai sem ela — no PoE ela é gasta no uso);
  if (pulaARecarga && CargasPoe.gastar(estado, cargaQuePula, 1)) Ficha.invalidar(estado);
  //  - (lote C2, dono 20/10 — D2.3) as cargas que o uso consome (os Martelos Sagrados: 1 de Poder; os das Espirais: todas; o Golpe Tectônico do Cataclismo: todas as de
  //    Tolerância) — o "mais" delas já está no efeito do uso
  if (poderGasto && CargasPoe.gastar(estado, 'poder', poderGasto)) Ficha.invalidar(estado);
  if (toleranciaGasta && CargasPoe.gastar(estado, 'tolerancia', toleranciaGasta)) Ficha.invalidar(estado);
  //    (dono, 20/10) o Golpe Tectônico comum gasta 1 Carga de Tolerância a cada 3 usos ("every third time you slam" — act_str.lua:12144); o "mais" das cargas deste uso
  //    já foi lido acima
  if (c2?.fissura?.consomeACada > 0 && !plantada && !doTotem) {
    const k = (hunt.poeGolpesTectonicos ??= {});
    k[entry.id] = (k[entry.id] ?? 0) + 1;
    if (k[entry.id] % c2.fissura.consomeACada === 0 && CargasPoe.gastar(estado, 'tolerancia', 1)) Ficha.invalidar(estado);
  }
  // (lote B2, dono 20/10) o uso SAIU:
  //  - D-B2.4: a Vida gasta no custo (o inteiro em Vida, a parte em Vida e a Vida a mais) renova a Febre Corrompedora (`vidaGastaB2`)
  const vidaGastaNoUso = (vidaAMais || 0) + (pagaComVida ? custoDeMana : 0) + (parteEmVida || 0);
  if (vidaGastaNoUso > 0) vidaGastaB2(hunt, vidaGastaNoUso, agora);
  //  - o Descarrego detonou as lâminas do Vórtice
  if (vorticeDoDescarrego) { vorticeDoDescarrego.laminas = []; vorticeDoDescarrego.ate = Math.min(vorticeDoDescarrego.ate, agora); }
  //  - D-B2.2: o Ceifar Vaal dá o "+4 ao máximo" pela duração secundária e "até o máximo" de Cargas Sangrentas; o "mais Dano por Carga Sangrenta" do uso (o acerto e o
  //    degenerativo — o PoB: Damage MORE × BloodCharge), com as cargas de agora
  if (b2?.ceifar?.vaal && !plantada && !doTotem) GemasB2.sangueDoVaal(hunt, b2.ceifar.vaal, fatorDeDuracao(estado, entry, efeitoDaGema), agora);
  const sangrentasNoDano = b2?.ceifar?.danoPorCargaPct ? GemasB2.cargasSangrentas(hunt, agora).n : 0;
  if (sangrentasNoDano > 0 && efeitoDaGema) efeitoDaGema = { ...efeitoDaGema, fatorDeDano: (efeitoDaGema.fatorDeDano ?? 1) * (1 + GemasB2.maisPelasSangrentas(b2.ceifar.danoPorCargaPct, sangrentasNoDano) / 100) };
  //  - D-B2.6: a Barganha de Trarthus — uma Ruína por uso (+1 na chance da qualidade); na sétima, sacrifica 50% da Vida MÁXIMA e o Caos BASE do uso ganha 600% do
  //    sacrificado (o PoB: ChaosMin/ChaosMax + floor(Vida × 50% × 600%)); as Ruínas zeram. O do totem fica de fora (o PoB usa a vida do totem)
  if (b2?.ruina && efeitoDaGema && !doTotem) {
    const u = GemasB2.usarRuina(hunt.poeRuina ?? 0, b2.ruina, estado.maxHp ?? 0, Math.random());
    hunt.poeRuina = u.n;
    if (u.sacrificio > 0) {
      estado.hp = Math.max(1, (estado.hp ?? 0) - u.sacrificio);
      ModsPoe.marcar(hunt, 'gastouVida');
      vidaGastaB2(hunt, u.sacrificio, agora);
      efeitoDaGema = { ...efeitoDaGema, danoBaseExtra: { chaos: [u.caosBase, u.caosBase] } };
    }
  }
  //  - o Vínculo de Mana: "Dano de Raio base igual a X% da Mana Não Reservada que falta" — o adicionado do uso (× a Eficácia do Dano Adicionado, como no PoB), pela mana de
  //    agora (já paga)
  if (b2?.manaQueFaltaPct > 0 && efeitoDaGema) {
    const raio = GemasB2.raioDaManaQueFalta(b2.manaQueFaltaPct, estado.maxMana ?? 0, Reserva.reservadas(estado).mana, estado.mana ?? 0);
    if (raio > 0) efeitoDaGema = { ...efeitoDaGema, 'somadoMin:energy': (efeitoDaGema['somadoMin:energy'] ?? 0) + raio, 'somadoMax:energy': (efeitoDaGema['somadoMax:energy'] ?? efeitoDaGema['somadoMin:energy'] ?? 0) + raio };
  }
  // (lote B3, dono 21/10) o que o lote B3 faz depois de pagar o uso:
  //  - a Troca de Corpos: o Fogo base da linha + X% da Vida máxima (o PoB: FireBonusMin/Max = output.Life × o multiplicador — na base, sem a Eficácia do Dano Adicionado);
  //    o do totem fica de fora (o PoB usa a Vida do totem)
  if (b3?.troca && efeitoDaGema && !doTotem) efeitoDaGema = { ...efeitoDaGema, danoBaseExtra: { ...(efeitoDaGema.danoBaseExtra ?? {}), fire: GemasB3.fogoDaTroca(b3.troca, estado.maxHp ?? 0) } };
  //  - D-B3.4: a Chuva de Lâminas de Trarthus liga (a primeira rajada sai no intervalo; o custo por segundo e as rajadas são do tique — `tiqueDasGemasB3`)
  if (trarthusDoUso) hunt.poeTrarthus = { acao: entry.id, slug: entry.poeGema.slug, z: hunt.z ?? 0, ultimo: agora, proxima: agora + GemasB3.intervaloDaTrarthus(trarthusDoUso, estado.maxMana ?? 0) };
  //  - D-e: a Corrida de Fase troca para o buff de dano (o uso de qualquer habilidade sua, não a dela, não a do totem nem a liberação da miragem); este
  //    uso já o recebe (a ficha é refeita antes do golpe);
  if (!gatilho && !plantada && !doTotem) trocarCorridaDeFase(estado, hunt, inicio, { exceto: entry.id });
  //  - I1–I7: a miragem anda (o estado novo); na liberação ela sai da caçada — a onda final e o teleporte vêm depois do pulso, abaixo;
  if (miragemDoUso) hunt.miragem = miragemDoUso.soltar ? null : { ...miragemDoUso.novo, ate: inicio + Math.max(250, temposDaGemaPoe(estado, entry, efeitoDaGema).uso) };
  //  - D-b: o ataque corpo a corpo seu com arma de uma mão gasta a Emboscada (é Impelido por ela — a tag `impelido` do golpe, `ModsPoe.fichaDoGolpe`)
  // (revisão do C1: a habilidade que não pode ser Impelida — NeverExertable no PoB — não gasta a Emboscada)
  const emboscadaDoUso = ataque && entry.poeGema?.ataque && !gatilho && !plantada && !doTotem && tagsPoeDaSkill(entry).includes('corpo') && !tagsPoeDaSkill(entry).includes('naoImpelivel') ? emboscadaNoGolpe(estado, hunt, inicio) : null;
  if (emboscadaDoUso) emboscadaDoUso.golpe = true;
  // (lote A4, dono 19/10: D1) quantos tempos de uso este uso ocupa: 1 + as repetições que saíram dentro dele (`fatorDoTempoDoUso`)
  let fatorDoTempo = 1;
  // (lote A4, dono 19/10) o ORBE INVERNAL: cada uso da canalização soma 1 estágio ao orbe (`carregarOrbe`) — ele dispara no tique
  if (orbeDoUso) carregarOrbe(estado, hunt, entry, efeitoDaGema, orbeDoUso, inicio);
  // (lote C2, dono 20/10) a Vinculação da Tempestade: o uso da canalização espalha uma runa no chão (`porRunaDaTempestade`)
  if (runasDoUso) eventos.push(...porRunaDaTempestade(estado, hunt, entry, efeitoDaGema, runasDoUso, mira ?? alvo ?? hunt.pos, inicio));
  // (lote A4, dono 19/10: E2) o uso saiu: o Golpe Duplo do Ímpeto conta o ataque (o par ganha 1 estágio — antes do tempo deste uso, que já o leva)
  if (semCanalizar?.est.modo === 'usos') estagioSemCanalizar(hunt, entry, efeitoDaGema, inicio, { gatilho, plantada, contar: true });
  // (lote A2) a Parede de Força: a colisão deste uso
  if (naParede) naParede.colisoes -= 1;
  // (lote A1, dono 19/10) o DESLOCAMENTO: pagou e vai sair — o personagem vai para o destino (o de Retorno vai e volta: termina onde começou; a Vaal
  // do Teleporte não move você, e sim os bichos — abaixo, entre as duas pontas)
  if (plano && !plano.semMover && desloc.modo !== 'inimigos') {
    eventos.push({ t: 'fx', id: EFEITO_DO_TELEPORTE, uid: 'player', x: plano.de.x, y: plano.de.y });
    moverNoDeslocamento(hunt, plano.para, inicio);
    if (desloc.modo === 'ida_e_volta') moverNoDeslocamento(hunt, plano.de, inicio);
    eventos.push({ t: 'fx', id: EFEITO_DO_TELEPORTE, uid: 'player', x: hunt.pos.x, y: hunt.pos.y });
  }
  // (lote A1b, dono 19/10: D-b) a EMBOSCADA: o buff (a duração da gema) que Impele o próximo ataque corpo a corpo com arma de uma mão — o crítico e o
  // multiplicador dele — e a cegueira no alvo para onde você foi ("Duração da penalidade base é de 3 segundos", × a Duração da Habilidade)
  const daEmboscada = itensPoeLigado() && entry.poeGema && !plantada && !doTotem && !gatilho ? GemasPoe.emboscadaDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
  if (daEmboscada) {
    const fatorDur = fatorDeDuracao(estado, entry, efeitoDaGema);
    const segundos = GemasPoe.compilada(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0)?.stats?.duracao ?? 1.5;
    hunt.emboscada = { ate: agora + Math.round(segundos * 1000 * fatorDur), critPontos: daEmboscada.critPontos, critMultPct: daEmboscada.critMultPct };
    // (a Emboscada conjurada chega aqui sem o alvo — a magia que não é de ataque não o guarda na conjuração: o cegado é o bicho colado em você, o alvo da
    // caçada antes)
    const colados = vivos.filter((m) => m.hp > 0 && !m.dummy && distanciaChebyshev(m, hunt.pos) <= 1);
    const cegado = alvo?.hp > 0 && !alvo.dummy ? alvo : colados.find((m) => m.uid === hunt.alvo) ?? colados[0] ?? null;
    if (cegado) ModsPoe.porNoAlvoComMods(cegado, 'cego', agora + Math.round(daEmboscada.cegueiraMs * fatorDur), agora, Ficha.combate(estado));
  }
  // (PoE, 12/10) A gema de Aço gasta os Fragmentos de Aço agora (pagou o custo e vai sair): os projéteis deste uso e a Proteção de Aço.
  const doAco = doTotem ? fragmentosNoUso(estado, hunt, entry, efeitoDaGema, agora, { doTotem: true }) : plantada ? null : fragmentosNoUso(estado, hunt, entry, efeitoDaGema, agora);
  // Vira para ONDE a skill vai (dono, 06/10: "o boneco vira para onde lança a magia?"): a onda/feixe já escolheu o lado (`virarPara`);
  // o resto olha para a casa mirada ou para o alvo.
  if (virarPara != null) hunt.pos.dir = virarPara;
  else virarParaOAlvo(hunt, mira && entry.miraNoChao ? mira : alvo);
  if (buff) {
    // (lote A1b, dono 19/10: D-e) a CORRIDA DE FASE gasta todas as Cargas de Frenesi: "100% de aumento da Duração da Habilidade por Carga de Frenesi removida"
    // (3 Frenesis: 1,8 s × 4 = 7,2 s), somado aos outros "aumentados" da duração
    const daFase = itensPoeLigado() && entry.poeGema?.slug === 'Old_Phase_Run' ? GemasPoe.corridaDeFaseDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : null;
    const frenesisRemovidas = daFase ? CargasPoe.gastar(estado, 'frenesi', Infinity) : 0;
    if (frenesisRemovidas) Ficha.invalidar(estado);
    const incDaFase = daFase ? daFase.duracaoPorFrenesiPct * frenesisRemovidas : 0;
    // Uma velocidade só por vez (a mais nova vale), como no Tibia.
    if (buff.tipo === 'speed') for (const [id, b] of Object.entries(hunt.buffs ?? {})) if (b.tipo === 'speed') delete hunt.buffs[id];
    // O nível, a raridade e a qualidade da gema escalam o efeito (`Reforcos.fatorDaGema`); a duração não muda.
    const fator = Reforcos.fatorDaGema(efeitoDaGema);
    // Skill Duration (support): +% na duração do reforço.
    const duracao = Math.round(buff.dur * (1 + (efeitoDaGema?.duracaoPct ?? 0) / 100));
    // A gema do PoE: os efeitos e os atributos do NÍVEL dela (`GemasPoe.buffNoNivel`) ficam no buff; a ficha é refeita (atributos novos).
    const doPoe = entry.poeGema?.buff ? GemasPoe.buffNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    // (A aura que reserva fica LIGADA — sem expirar — e guarda a reserva dela: o recurso, a % ou o fixo, e o fator dos suportes/eficácia.)
    // (11/10: o RAIO da aura em casas, × √ do "Efeito em Área de Habilidades de Aura aumentado" de quem lança — os companheiros a esse raio
    // também a recebem: `GemasPoe.adds`.)
    // (11/10) O ESTANDARTE: plantar consome o Valor — a aura fica no chão, onde você está, maior e mais forte pelo Valor consumido
    // (`ModsPoe.plantarEstandarte`; o efeito multiplica os efeitos do nível — `fator` — e os atributos — `GemasPoe.adds`).
    const plantado = doPoe?.porValor ? ModsPoe.plantarEstandarte(estado, hunt, Ficha.combate(estado), doPoe.porValor, agora) : null;
    const raioDaAura = plantado ? raioDaAuraDe(estado, entry, (doPoe.raioM ?? 2) / 2, 1 + plantado.areaMais / 100) : doPoe?.raio ? raioDaAuraDe(estado, entry, doPoe.raio, 1, efeitoDaGema?.auraAreaIncPct ?? 0) : null;
    // (PoE, a Mobilização: "Seus Clamores não concedem Buffs ou Cargas a Você" — o Clamor provoca e Impele, mas o buff dele não fica em você;
    // "X% mais Duração dos Clamores" — a provocação dura mais.)
    const fichaDoClamor = buff.tipo === 'poe-clamor' && itensPoeLigado() ? Ficha.combate(estado) : null;
    const clamorSemBuff = !!fichaDoClamor && ModsPoe.valor(fichaDoClamor, 'clamor_sem_buff_em_voce') > 0;
    const duracaoDoClamor = doPoe ? Math.round(doPoe.dur * Math.max(0.1, 1 + (fichaDoClamor ? ModsPoe.valor(fichaDoClamor, 'clamor_duracao_mais') : 0) / 100)) : 0;
    // (lote 32, P042: o Clamor que sai sem outro Buff de Clamor ativo começa a contagem "para cada segundo que você for afetado por um Buff de Clamor")
    if (!clamorSemBuff && buff.tipo === 'poe-clamor' && !ModsPoe.sobBuffDeClamor(hunt, agora)) hunt.poeSobClamorDesde = agora;
    // (17/10, lote G5) o PODER do Clamor, contado agora: os atributos do buff "por cada N de Poder" e as Cargas de Tolerância por Poder
    // (`GemasPoe.clamorPeloPoder`; "Seus Clamores não concedem Buffs ou Cargas a Você" tira os dois)
    const peloPoder = fichaDoClamor && doPoe ? GemasPoe.clamorPeloPoder(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, ModsPoe.poderDoClamor(hunt, fichaDoClamor)) : null;
    if (peloPoder && Object.keys(peloPoder.af).length) doPoe.af = { ...doPoe.af, ...Object.fromEntries(Object.entries(peloPoder.af).map(([k, v]) => [k, (doPoe.af?.[k] ?? 0) + v])) };
    if (peloPoder?.tolerancia > 0 && !clamorSemBuff && CargasPoe.ganhar(estado, 'tolerancia', fichaDoClamor.afPoe, peloPoder.tolerancia)) Ficha.invalidar(estado);
    // (lote 80, a Astúcia do Veterano) o buff de GUARDA pela tag da gema ("Habilidade de Guarda não Vaal" — o arquétipo `guarda` junta outras);
    // o que expirou e volta guarda o fim do anterior ("se um Buff de Guarda não Vaal terminou Recentemente")
    const tagsDoBuff = doPoe && entry.poeGema ? tagsPoeDaSkill(entry) : [];
    // (lotes G-B e G-D, dono 25/10) o que o uso faz ANTES de ligar o buff (`antesDoBuffGBD`): o Chamado Imortal consome as Cargas de Tolerância (a duração por carga), o
    // Manto Arcano gasta a Mana, o Fogo Justo Vaal sacrifica a Vida e o Escudo de Energia
    const gbdAntes = doPoe?.gbd && itensPoeLigado() && !plantada ? antesDoBuffGBD(estado, hunt, entry, doPoe.gbd, personagem, agora) : null;
    // (lote G-A, dono 25/10) a QUALIDADE da guarda (merge com o G-B: os dois "aumentados" da duração somam — o da qualidade e o das cargas do Chamado): "Duração do Efeito de Habilidades aumentada em X%" (somada aos outros "aumentados" da duração) e "Efeito do Buff aumentado
    // em X%" (o efeito do buff — `GemasPoe.adds`)
    const qualDoBuff = doPoe && entry.poeGema?.arquetipo === 'guarda' ? GemasPoe.qualidadeDoBuffDaGema(entry.poeGema.slug, efeitoDaGema?.qualidade ?? 0) : null;
    const anterior = hunt.buffs?.[entry.id];
    if (anterior?.guarda && !anterior.vaal && anterior.ate <= agora) ModsPoe.marcar(hunt, 'guardaNaoVaalTerminou', anterior.ate);
    if (!clamorSemBuff) (hunt.buffs ??= {})[entry.id] = doPoe
      ? { ate: reserva || doPoe.ligada ? Reserva.LIGADA_ATE : agora + Math.round((daFase?.duracaoBaseMs ?? doPoe.dur) * fatorDeDuracao(estado, entry, efeitoDaGema, incDaFase + (qualDoBuff?.duracaoIncPct ?? 0) + (gbdAntes?.incPct ?? 0))), desde: agora, tipo: buff.tipo,
        ...(qualDoBuff?.efeitoPct ? { efeitoBuffQualPct: qualDoBuff.efeitoPct } : {}),
        // (lote A2: os números da mecânica própria — `GemasA2` — e a duração, para quem renova: a Fúria Sangrenta ao matar)
        ...(doPoe.a2 ? { a2: doPoe.a2, durMs: Math.round(doPoe.dur * fatorDeDuracao(estado, entry, efeitoDaGema)) } : {}),
        // (lote C3, dono 25/10 — D3.1) o Sangue e Areia liga na Postura de SANGUE (o PoE: "Você fica automaticamente em Postura de Sangue"); o clique de novo alterna
        ...(GemasC3.ehGemaDePostura(entry.poeGema?.slug) ? { postura: 'sangue' } : {}), ...(tagsDoBuff.includes('guarda') ? { guarda: true, ...(tagsDoBuff.includes('vaal') ? { vaal: true } : {}) } : {}), fator: plantado ? 1 + plantado.efeitoMais / 100 : 1,
        // (17/10, lote G14) o suporte de aura: "têm Efeito das Auras aumentado em X%" (Arrogância, Generosidade…) e "Auras Suportadas não afetam
        // você" (Generosidade — só os aliados: `GemasPoe.adds`)
        // (lote E1b, 26/10: + o "Efeito das Auras aumentado" da PRÓPRIA gema — as Impurezas Vaal — somado ao dos suportes; e a resistência que os acertos ignoram no raio)
        ...((efeitoDaGema?.efeitoAuraPct ?? 0) + (doPoe.e1b?.efeitoAuraPct ?? 0) ? { efeitoAuraPct: (efeitoDaGema?.efeitoAuraPct ?? 0) + (doPoe.e1b?.efeitoAuraPct ?? 0) } : {}), ...(doPoe.e1b ? { e1b: doPoe.e1b } : {}), ...(efeitoDaGema?.auraSoAliados ? { soAliados: true } : {}), ...(raioDaAura ? { raio: raioDaAura } : {}), efeitosPoe: efeitosDaMaldicao(doPoe.efeitos, efeitoDaGema, estado, entry), afPoe: efeitoDaGema?.arautoSemBuff > 0 ? {} : doPoe.af,
        ...(plantado ? { estandarte: { x: hunt.pos.x, y: hunt.pos.y, z: hunt.z ?? 0, valor: plantado.valor, efeitoMais: plantado.efeitoMais } } : {}),
        ...(reserva ? { reserva: { recurso: reserva.recurso, ...(reserva.pct ? { pct: reserva.pct } : { fixo: reserva.fixo }), fator: reserva.fator } } : {}) }
      : { ate: agora + duracao, tipo: buff.tipo, fator, ...(buff.mult ? { mult: Reforcos.velocidadeEscalada(buff.mult, fator) } : {}) };
    if (doPoe) Ficha.invalidar(estado);
    // (lote A1b, dono 19/10: D-e) a Corrida de Fase guarda o buff secundário — o próximo uso de qualquer habilidade sua o troca (`trocarCorridaDeFase`)
    if (daFase && hunt.buffs?.[entry.id]) hunt.buffs[entry.id].fase = { segundoMs: daFase.segundoMs, maisFisicoCorpoPct: daFase.maisFisicoCorpoPct, fatorDur: fatorDeDuracao(estado, entry, efeitoDaGema) };
    // (lote A2) o que o uso põe no chão: o Escudo Gélido, o Emblema do Poder, a Parede de Força (`itens-poe/gemas-a2.mjs`); o Berserk guarda a
    // recarga, que só começa quando ele acaba
    if (doPoe?.a2 && itensPoeLigado()) aoLigarA2(estado, hunt, entry, hunt.buffs[entry.id], alvo, efeitoDaGema, eventos, agora);
    // (lotes G-B e G-D, dono 25/10) só UM buff de Guarda por vez (o novo tira o velho — D5) e o que o uso liga além do buff (`aoLigarGBD`): a absorção, o Imortal, o gelo da
    // Armadura Ártica Vaal, o Fogo Justo em volta, o Pacto de K'Tash
    if (itensPoeLigado() && hunt.buffs?.[entry.id] && tagsDoBuff.includes('guarda')) trocarGuarda(estado, hunt, entry.id, personagem, eventos, agora);
    if (doPoe?.gbd && itensPoeLigado() && hunt.buffs?.[entry.id]) aoLigarGBD(estado, hunt, entry, hunt.buffs[entry.id], doPoe.gbd, gbdAntes, efeitoDaGema, personagem, eventos, agora);
    // (lote A1, dono 19/10 — D7) o Passo Definhante: o Elusivo e o Definhar de quem está na área (`passoDefinhante`)
    if (entry.poeGema?.slug === 'Withering_Step' && itensPoeLigado()) passoDefinhante(estado, hunt, entry, efeitoDaGema, agora);
    // (lote 75) ligar o Arauto da Agonia é usar uma habilidade de Lacaio (a gema tem o tipo Minion — o Rastejador vem depois, ao Envenenar)
    if (entry.poeGema && (GemasPoe.doSlug(entry.poeGema.slug)?.gema?.tipos ?? []).includes('Minion')) ModsPoe.marcar(hunt, 'usouLacaio');
    // A parte reservada sai da mana (ou da vida) atual na hora.
    if (reserva) Reserva.cortarNoLivre(estado);
    // A provocação: os bichos por perto vêm atacar você (o grito do PoE traz o `provocar` nos efeitos do nível).
    if (buff.tipo === 'desafio') Reforcos.provocar(hunt, buff, distanciaChebyshev);
    // (lote 46) o raio do Clamor: o da gema em casas × √ da "Área de Efeito aumentada/mais" (a geral e a dos Clamores — `area_inc@clamor`)
    if (doPoe?.efeitos.some((e) => e.efeito === 'provocar')) Reforcos.provocar(hunt, { efeitos: doPoe.efeitos.map((e) => (e.efeito === 'provocar' ? { ...e, raio: raioDoClamor(estado, entry, e.raio) } : e)), dur: duracaoDoClamor }, distanciaChebyshev);
    // (lote G-A, dono 26/10) o Clamor Sísmico: "Empurra e Interrompe Inimigos em uma pequena Área" — os inimigos a até 1 casa do alvo, empurrados (3 casas com os +200%)
    // e interrompidos (`empurraoDoClamor`)
    if (buff.tipo === 'poe-clamor' && entry.poeGema && itensPoeLigado()) empurraoDoClamor(hunt, entry, efeitoDaGema, alvo, agora, eventos);
    // (lote A2, dono 19/10) a Torre Óssea no Clamor suportado: "Clamores reforçados ativam Tomar a Carne ao usar" — as torres em volta de você
    if (efeitoDaGema?.torresOsseas > 0 && buff.tipo === 'poe-clamor' && itensPoeLigado()) eventos.push(...torresOsseas(hunt, entry, efeitoDaGema, agora));
    // (lote 72, a Palavra Sagrada) "Seus clamores infligem Chama Santificada": nos inimigos no raio do Clamor.
    const doClamor = doPoe?.efeitos.find((e) => e.efeito === 'provocar');
    const afDoClamor = doClamor ? Ficha.combate(estado).afPoe : null;
    if (doClamor && ModsPoe.valor({ afPoe: afDoClamor }, 'clamor_chama_santificada') > 0) {
      const raio = raioDoClamor(estado, entry, doClamor.raio);
      for (const m of hunt.monstros ?? []) if (m.hp > 0 && !m.dummy && distanciaChebyshev(hunt.pos, m) <= raio) ModsPoe.porChamaSantificada(hunt, m, afDoClamor, hunt.clock ?? 0, { doClamor: true });
    }
    // (lote G-D, dono 25/10) os Clamores do lote: a penalidade do Infernal nos provocados e o "mais por aliado afetado" do de Reunião (`clamorGBD`)
    if (doClamor && itensPoeLigado()) clamorGBD(estado, hunt, entry, efeitoDaGema, raioDoClamor(estado, entry, doClamor.raio), agora);
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

  // (17/10, lote G18) os usos SEGUIDOS da mesma gema (o Martelo Glacial: "Cada terceiro golpe sucessivo Congela … / é um Golpe Crítico" — a tag
  // `terceiroGolpe` do golpe): QUALQUER outra habilidade usada no meio (a aura, o clamor, a magia) zera; o ativado por gatilho e a plantada não contam
  if (!gatilho && !plantada) {
    const seguidos = (hunt.poeSeguidos?.id === entry.id ? hunt.poeSeguidos.n : 0) + 1;
    hunt.poeSeguidos = { id: entry.id, n: seguidos };
    hunt.poeTerceiroGolpe = !!entry.poeGema && seguidos % 3 === 0;
  } else hunt.poeTerceiroGolpe = false;
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
  } else if (tipoPlantado && !plantada && entry.poeGema?.slug === 'Detonate_Mines' && itensPoeLigado()) {
    // (lote E2B, 26/10) a gema DETONAR MINAS na barra não planta: começa a Sequência de Detonação das suas Minas agora — andando e sem inimigo perto, como o atalho do PoE
    // (a primeira na hora; cada seguinte 10% mais rápida por Mina anterior — `Plantadas.minasQueDetonam`)
    hunt.poeDetonarManualE2b = agora;
    eventos.push(...tiqueDasPlantadas(estado, hunt, personagem, [], agora));
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
    // (lote A3, dono 19/10 — D1: o ProjectileSpeedMod do uso — o da ficha, o da gema e o dos suportes, o "mais" multiplicando: `velocidadeDoProjetil`;
    // vai em todos os tiros do uso)
    // (lote A3b: o uso que só deixa o objeto não tem o tiro no alvo — o objeto é desenhado; o pulso do objeto é o raio no acertado)
    if (entry.projetil && alvo && !projeteisAleatorios() && !objetoDoUso?.semAcerto) eventos.push({ t: 'shot', id: entry.projetil, x, y, tx: alvo.x, ty: alvo.y, ...(velDoTiro !== 1 ? { vel: velDoTiro } : {}) });
    const cor = COR_DO_ELEMENTO[entry.element] ?? COR_DO_ELEMENTO.physical;
    // A área vai para a tela num evento SÓ, com as MESMAS casas que causam dano (o cliente
    // desenha cada uma). Antes era um `fx` por casa — e a tela, que guardava os 60 últimos,
    // perdia o começo das áreas grandes (a parte de CIMA da Rage of the Skies, 85 casas).
    // (lote A3b: o pulso do objeto não desenha a área toda a cada golpe — o objeto e o raio dele estão na tela, `objetosParaCliente`; o efeito vai no acertado)
    if (casas && entry.efeito && plantada?.tipo === 'objeto') { if (alvo) eventos.push({ t: 'fx', id: entry.efeito, uid: alvo.uid, x: alvo.x, y: alvo.y }); }
    // (lote A1b: o uso da miragem que não pulsa não desenha área — a onda final tem o evento dela)
    // (revisão do B1: a Chuva de Flechas Vaal desenha só os anéis das sequências — `aneisDaChuva`)
    else if (casas && entry.efeito) { if (!aneisDaChuva && (casas.length || !miragemDoUso)) eventos.push({ t: 'area', id: entry.efeito, x, y, casas: Areas.paraTela(casas, { x, y }) }); }
    else if (entry.efeito && !objetoDoUso?.semAcerto) eventos.push({ t: 'fx', id: entry.efeito, uid: alvo.uid, x: alvo.x, y: alvo.y });
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
    // (lote 53: + o crítico por Intensidade do Modo Alfa / Nadir; lote G20a: o do totem não é "usada por você" — não gasta os frascos)
    // (lote A1b, dono 19/10) + o que o uso tem a mais: o ataque Impelido pela Emboscada ("+25% de Chance de Golpe Crítico" — na chance base, como o PoE — e
    // "+138% de Multiplicador"); a Investida com Escudo — "Redução do Ponto de Atordoamento aumentada em 75% … na distância Máxima", pelas casas percorridas
    // (como o dano)
    // (lote PR2, dono 20/10 — D4) os COMPOSTOS gastam as cargas dos frascos agora, um consumo por projétil (`comOsFrascosDoComposto`); o do totem, não
    if (itensPoeLigado() && entry.poeGema && !doTotem && !plantada) efeitoDaGema = comOsFrascosDoComposto(estado, entry, efeitoDaGema, 1 + Math.max(0, Math.round(efeitoDaGema?.alvosExtras ?? 0)));
    const atordoamentoDaInvestida = plano && !plano.semMover && plano.max > 0 && entry.poeGema ? GemasPoe.atordoamentoDaInvestidaDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) * Math.min(1, plano.casas / plano.max) : 0;
    const fichaDaGema = comAtributosDoUso(comCriticoDaIntensidade(doTotem ? Ficha.combate(estado) : doDestilador(estado, Ficha.combate(estado), entry), intensidade), {
      ...(emboscadaDoUso ? { crit_base_golpe: emboscadaDoUso.critPontos, crit_dmg: emboscadaDoUso.critMultPct } : {}), ...(atordoamentoDaInvestida ? { enemy_stun_threshold_red: atordoamentoDaInvestida } : {}),
    });
    const mao = maoDaGemaDeAtaque(entry, fichaDaGema, hunt);
    const { min, max, daPericia, mult, sobrecarga, fatorDaGema, ficha, partes, porAfeccao, ehMagia: ehMagiaDaConta, sintonia, multFisico, eficacia: eficaciaDoAdicionado, soAcertoDaFicha, multDosTipos } = contaDoDano(estado, entry, efeitoDaGema, mao?.ficha ?? fichaDaGema, mao?.arma ?? null, { ativada: !!gatilho && !plantada, custaVida: pagaComVida || parteEmVida > 0, maisDano: ((1 + ((gatilho?.maisDano ?? 0) + maisDaPlantada(plantada, efeitoDaGema, agora)) / 100) * (1 + (estagioDoUso?.maisPct ?? 0) / 100) * (doCadaver?.modo === 'consumir' ? cadaveresDoUso.length : 1) - 1) * 100, critMais: estagioDoUso?.critMaisPct ?? 0, elementoSorteado: plantada?.elementoSorteado ?? elementoDoAcerto ?? null });
    // (lote C1, dono 20/10) o Acerto Elemental: o elemento deste uso vira o "anterior" (o próximo não o repete)
    if (elementoDoAcerto) { (hunt.poeElementoAnterior ??= {})[entry.id] = elementoDoAcerto; if (hunt.poeElementoPendente) delete hunt.poeElementoPendente[entry.id]; }
    // (lote B2, dono 20/10) o que o lote B2 faz no golpe deste uso:
    //  - a FEBRE CORROMPEDORA: o buff em você pela duração (× a Duração); com ele, os SEUS acertos infligem o Sangue Corrompido — o dano degenerativo da gema (a conta
    //    deste uso), pela duração da penalidade (× a Duração), +1 estágio por acerto até 10, cada estágio depois do primeiro com 100% mais (`febreNoAcerto`)
    if (b2?.febre && !doTotem && !plantada) {
      const dg = GemasPoe.degenerativoNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0);
      if (dg) {
        const fd = fatorDeDuracao(estado, entry, efeitoDaGema);
        const conta = { efeitoDaGema, ficha, fatorDaGema, soAcertoDaFicha, dotMagico: GemasPoe.dotEhMagico(entry.poeGema.slug) };
        const durMs = Math.round(b2.febre.duracaoMs * fd);
        hunt.poeFebre = { acao: entry.id, ate: agora + durMs, durMs, renovaVida: b2.febre.renovaVida, gasto: 0, penalidadeMs: Math.max(1, Math.round(b2.febre.penalidadeMs * fd)), partes: dg.partes.map((p) => ({ tipo: GemasPoe.DEGEN_DO_ELEMENTO[p.elemento], elemento: p.elemento, porSegundo: totalDoDegenerativo(p, 1000, conta) })) };
      }
    }
    //  - o Chicote Ardente: "X% mais Dano com Acertos contra Inimigos Incendiados" (só no acerto — o PoB: ModFlag.Hit, ActorCondition Burning)
    // (revisão B2, 21/10: QUEIMANDO — `queimandoAgora`: o estado do jogo, só o ativo, e o chão de fogo; o PoB: `ActorCondition enemy var=Burning`)
    const contraIncendiado = (bicho) => (b2?.chicote?.contraIncendiadoPct > 0 && queimandoAgora(hunt, bicho, agora) ? 1 + b2.chicote.contraIncendiadoPct / 100 : 1);
    //  - D-B2.3: o Golpe Infernal — o debuff com cargas (`infernalNoAcerto`) e os que chegaram a 6 cargas neste passe (`explodemNoPasse`, a explosão no fim do passe)
    const infernalDoUso = b2?.infernal ?? null;
    const infernalMs = infernalDoUso ? Math.max(1, Math.round(infernalDoUso.duracaoMs * fatorDeDuracao(estado, entry, efeitoDaGema))) : 0;
    const raioInfernal = infernalDoUso ? Math.max(0, casasDoRaio(infernalDoUso.raioM * Math.sqrt(ModsPoe.fatorDaArea(efeitoDaGema?.areaIncPct ?? 0, efeitoDaGema?.areaMaisPct ?? 0)))) : 0;
    const explodemNoPasse = [];
    //  - (decisão do dono, 20/10) os mortos pela explosão da Voltáxica explodem como cadáver (`mortosDaVoltaxica`, no fim do passe)
    const mortosDaVoltaxica = [];
    //  - D-B2.5: o Contágio — o raio do espalhar é o da área do uso (em casas)
    const raioDoContagio = b2?.contagio ? (casas && formaNoUso ? casas.reduce((r, c) => Math.max(r, Math.abs(c.x - formaNoUso.x), Math.abs(c.y - formaNoUso.y)), 0) : Math.max(0, casasDoRaio(GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? 2))) : 0;
    // (17/10, lote G18) o "até X% mais Dano com Acertos aos alvos próximos" da gema (só no acerto; o perto do Curto Alcance — 2 casas — ou a rampa do
    // corpo a corpo do Esmagar com Escudo) e os projéteis SECUNDÁRIOS ("Projéteis causam X% mais/menos Dano com Acertos e Afecções" — o golpe
    // direto é o corpo a corpo do PoB; no acerto e na afecção), com o quinto ataque do Zênite (mais dano e 5 projéteis a mais)
    const pertoDaGema = entry.poeGema ? GemasPoe.maisPertoNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    const fatorDoPerto = (bicho) => {
      if (!pertoDaGema) return 1;
      const parte = pertoDaGema.rampa === 'proximidade' ? ModsPoe.proximidadeCorpoACorpo(ModsPoe.unidadesAte(bicho, { x, y })) : Math.max(Math.abs(bicho.x - x), Math.abs(bicho.y - y)) <= 2 ? 1 : 0;
      return 1 + (pertoDaGema.pct * parte) / 100;
    };
    // (lote A1, dono 19/10) a Investida com Escudo: "100% mais Dano com Acertos na Distância Máxima da Investida", pelas casas percorridas (só no acerto)
    const maisDaInvestida = 1 + (plano?.maisDanoPct ?? 0) / 100;
    // (lote A1b, dono 19/10) o Teleporte Gélido da Explosão Invernal: "15% mais Dano com Acertos por cada 5% de Efeito do Resfriamento no Inimigo" (só no
    // acerto; o Resfriamento do alvo agora — o `lento` dele —, arredondado para baixo de 5 em 5); as cargas no acerto do Golpe Súbito; a Causticação do
    // Avanço Ardente do Retorno
    const daExplosaoInvernal = itensPoeLigado() && entry.poeGema ? GemasPoe.explosaoInvernalDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    const contraResfriado = (bicho) => (daExplosaoInvernal ? GemasA1b.maisContraResfriado(daExplosaoInvernal, (bicho.estados?.lento?.ate ?? 0) > agora ? bicho.estados.lento.pct ?? 0 : 0) : 1);
    // (lote A5, dono 20/10 — f34 D1/D2) o Condutor Elétrico: "X% mais Dano com Acertos por cada 5% de Efeito de Eletrização no Inimigo" (só no acerto; a
    // Eletrização do alvo agora — a soma da pilha —, de 5 em 5, para baixo), e tira a Eletrização depois do acerto; (D8/D9) a Exposição da gema — a Bomba
    // Congelante antes do dano, a Onda de Convicção depois do acerto, no elemento que mais causou dano —, pela duração secundária × a Duração
    const doCondutor = itensPoeLigado() && entry.poeGema ? GemasPoe.condutorDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    // (revisão do A5 — a descrição do PoE/PoB: "Raios acertam todos os inimigos Eletrizados …" e "Eletrizações não podem expirar em inimigos no alcance enquanto
    // conjurando essa magia") a Eletrização dos atingidos que corria no começo da conjuração segue até o raio cair; o Condutor só acerta quem está Eletrizado
    if (doCondutor?.segurarEletrizacao && concluir && hunt.conjurando?.inicio != null) {
      for (const b of atingidos ?? []) {
        const c = b?.estados?.chocado;
        if (c && c.ate > hunt.conjurando.inicio && c.ate <= agora) c.ate = agora + 1;
        for (const x of b?.estados?.chocadosPilha ?? []) if (x.ate > hunt.conjurando.inicio && x.ate <= agora) x.ate = agora + 1;
      }
    }
    const contraEletrizado = (bicho) => (doCondutor ? GemasA5.maisContraEletrizado(doCondutor, Math.round((AfeccoesPoe.fatorDeEletrizacao(bicho, agora) - 1) * 100000) / 1000) : 1);
    const exposicaoDoUso = itensPoeLigado() && entry.poeGema ? GemasPoe.exposicaoDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : null;
    const msDaExposicao = exposicaoDoUso ? Math.round(exposicaoDoUso.duracaoMs * fatorDeDuracao(estado, entry, efeitoDaGema)) : 0;
    const regenMenosDoUso = exposicaoDoUso ? GemasPoe.regenMenosDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) ?? 0 : 0;
    // (lote B1, dono 20/10 — D-B1.9) a Chuva Tóxica do Definhamento: 1 Definhamento (2 s) por uso em cada inimigo acertado — `definhadosNoUso`
    const definhaDoUso = itensPoeLigado() && entry.poeGema ? GemasPoe.definhamentoDaChuvaDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : null;
    // (lote PR2, dono 20/10) a qualidade do Composto Venenoso: "X% de chance de infligir Definhando por 2 segundos ao Acertar" — sorteado em cada acerto
    const definharDoUso = itensPoeLigado() && entry.poeGema ? GemasPoe.definharDaGema(entry.poeGema.slug, efeitoDaGema?.qualidade ?? 0) : null;
    const definhadosNoUso = new Set();
    const exporNoAcerto = (bicho, el) => {
      if (el && ModsPoe.porExposicao(bicho, el, exposicaoDoUso.pct + Math.abs(ModsPoe.valor(ficha, { fire: 'exposicao_extra_fogo', ice: 'exposicao_extra_gelo', energy: 'exposicao_extra_raio' }[el])), msDaExposicao, agora) && !doTotem) ModsPoe.marcar(hunt, 'infligiuExposicao', agora);
    };
    const cargaDoSifao = itensPoeLigado() && entry.poeGema ? GemasPoe.cargaDoSifaoDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : 0;
    const cargasDoAcerto = itensPoeLigado() && entry.poeGema && !doTotem && !plantada ? GemasPoe.cargasNoAcertoDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    const chanceDeCausticar = itensPoeLigado() && entry.poeGema ? GemasPoe.chanceDeCausticarDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : 0;
    // (lote A1b, dono 19/10: I1/I4) o % de cada acerto do uso — o pulso da miragem parada (+150%), a onda final (75% × os estágios): `atacar`
    let escalaDoUso = 100;
    const projDaGema = entry.poeGema ? GemasPoe.projeteisDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    let quinto = false;
    if (projDaGema?.quintoPct > 0 && !gatilho && !plantada) {
      const q = (hunt.poeQuintoAtaque ??= {});
      q[entry.id] = (q[entry.id] ?? 0) + 1;
      quinto = q[entry.id] % 5 === 0;
      if (quinto && projDaGema.quintoProjeteis) efeitoDaGema = { ...efeitoDaGema, alvosExtras: (efeitoDaGema.alvosExtras ?? 0) + projDaGema.quintoProjeteis };
    }
    // (lote PR1: + as estilhas do Arremesso de Escudo Espectral)
    // (lote PR3: + os secundários do Tiro Tornado)
    const FONTES_DE_PROJETIL = new Set(['projetil', 'perfuracao', 'bifurcacao', 'encadeamento', 'retorno', 'estilha', 'secundario']);
    const doProjetilDaGema = (fonte) => (projDaGema && FONTES_DE_PROJETIL.has(fonte) ? Math.max(0, 1 + projDaGema.pct / 100) * (quinto ? 1 + projDaGema.quintoPct / 100 : 1) : 1);
    // (PoE, a Impiedade: "Cada terceiro Ataque com Ataques Corpo a Corpo Suportados causa um Golpe Impiedoso" — este uso é o terceiro?)
    const impiedosoCada = Math.round(efeitoDaGema?.impiedosoCada ?? 0);
    let impiedosoDoUso = false;
    if (impiedosoCada > 0 && tagsPoeDaSkill(entry).includes('corpo')) {
      const c = (hunt.poeImpiedosos ??= {});
      c[entry.id] = (c[entry.id] ?? 0) + 1;
      impiedosoDoUso = c[entry.id] % impiedosoCada === 0;
    }
    // (o Libertar: o golpe que Ocorre Novamente por um Selo causa menos dano — `reocorrendo`; a Intensidade: mais dano em área)
    let reocorrendo = false;
    // (17/10, lote G17) a repetição da vez (0 = o uso, 1 = a primeira repetição…): o "mais Dano" da Primeira/Segunda Repetição do Golpe Múltiplo
    let repeticaoAtual = 0;
    // (lote A4, dono 19/10: o Dano Dobrado sorteado da Repetição Final — o Eco Desperto; os FERIMENTOS do Golpe Cintilante Vaal — o dano por inimigo, que entra no
    // fim do uso: `Map<bicho, { dano, crit, color }>`, ou null)
    let dobroNaFinal = false;
    let ferimentos = null;
    const maisDaRepeticao = () => (repeticaoAtual ? Math.max(0, 1 + (efeitoDaGema?.[`repeticaoMaisPct:${repeticaoAtual}`] ?? 0) / 100) : 1);
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
    // (lote A5b, dono 20/10: "fazer como o PoE") a PRECISÃO das gemas de ATAQUE (as suas e as do totem — no PoE o ataque do totem também erra; a precisão
    // é a sua): cada acerto rola o acerto no alvo (`acertar`). O bloqueio vem depois do acerto: o bloqueado conta como acertado. O que sai "no acerto"
    // DENTRO de um passe (a propagação, os próximos do alvo, o cone) olha quem foi acertado NESTE passe (`acertouNoPasse` — o 1º golpe, cada repetição,
    // os selos, a segunda ponta); o que sai no FIM do uso (a Rajada Vulcânica, a Onda do Vazio, o estágio do Devastar, o Fantasma, o Empurrão do Salto
    // Impactante) olha quem foi acertado em algum passe (`acertouNoUso`)
    // (lote C3, dono 25/10: o martelo da Varrida Sagrada — "Os ataques dos martelos sagrados não podem ser evadidos", CannotBeEvaded na parte do martelo)
    const rolaPrecisao = itensPoeLigado() && !!entry.poeGema?.ataque && !plantada?.nuncaErra;
    const acertadosNoUso = new Set();
    let acertadosNoPasse = new Set();
    const acertouNoUso = (b) => !rolaPrecisao || acertadosNoUso.has(b);
    const acertouNoPasse = (b) => !rolaPrecisao || acertadosNoPasse.has(b);
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
    // (lote G20a: "Você não pode causar Dano com suas Habilidades" — o totem causa: é ele quem usa)
    const semDanoProprio = itensPoeLigado() && !!entry.poeGema && !entry.poeGema.lacaio && !doTotem && ModsPoe.valor(ficha, 'sem_dano_proprio') > 0;
    // (lote C4, dono 21/10) a MAGIA SEM ACERTO (a Praga, o Definhar, o Contágio, o Raio Abrasador…): o uso põe o debuff e não acerta — sem o "1" do piso da faixa, sem
    // crítico, sem afecções nem os efeitos de acerto (o fator do golpe é 0, como o do Vínculo Ancestral); o degenerativo e os debuffs da gema seguem (`GemasPoe.magiaSemAcerto`)
    const semAcertoDaGema = itensPoeLigado() && !!entry.poeGema && !entry.poeGema.lacaio && GemasPoe.magiaSemAcerto(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0);
    /*
     * (13/10) O PROJÉTIL neste acerto (`golpe`: o que `Secundarios.resolver` marcou — `atravessados`, `ricochetes`): "Projéteis causam Dano
     * aumentado em X% com Acertos e Afecções para cada Inimigo Atravessado / para cada vez que Ricochetearam" e a DISTÂNCIA até o bicho (o
     * Tiro Longo, a Animosidade Adjacente, o Tiro Distante — `ModsPoe.projetilNoAlvo`; a ficha da habilidade é montada sem alvo). O
     * "aumentado" soma aos outros aumentos do golpe (o `mult` da conta); o "mais" multiplica. (Por distância: a conta é a mesma — cache.)
     */
    const tagsDaSkill = tagsPoeDaSkill(entry);
    const deProjetil = itensPoeLigado() && tagsDaSkill.includes('projetil');
    // (lote G-C, D13) a RUÍNA: as maldições ligadas a ela (uma vez por uso) — aplicadas em cada inimigo do debuff (`Reforcos.marcarCom`)
    const ruinaDoUso = itensPoeLigado() && entry.poeGema ? GemasPoe.ruinaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    const ligadasDaRuina = ruinaDoUso ? maldicoesDaRuina(estado, entry, ruinaDoUso, agora) : null;
    // (lote S1, 26/10) o Toque Maldito: as maldições que ele suporta no grupo, para os acertos deste uso (`maldicoesDoToqueS1`)
    const toqueDoUso = itensPoeLigado() && entry.poeGema ? maldicoesDoToqueS1(estado, entry, agora) : null;
    const porDistancia = new Map();
    // (lote A3, dono 19/10 — F2, D1/D2) as rampas de distância da gema (o Pulso Congelante, o Olho Invernal), × o ProjectileSpeedMod do uso
    const rampaDoUso = efeitoDaGema?.rampaMaisPct || efeitoDaGema?.rampaCongelar ? { rampaMaisPct: efeitoDaGema.rampaMaisPct ?? 0, rampaCongelar: efeitoDaGema.rampaCongelar ?? 0, modVel: velDoTiro } : null;
    // (lote PR4, dono 25/10 — D4) o APRISIONADO: "Inimigos Aprisionados sofrem Dano de Projétil dos Acertos de Ataques aumentado em X%" — só no acerto de projétil de
    // ataque (o direto e os secundários do projétil; a área e a explosão, não — a exceção 8), × as outras vulnerabilidades
    const fatorDoAprisionado = (bicho, fonte) => (deProjetil && entry.poeGema?.ataque && !casas && bicho.poeAprisionado?.danoSofridoPct > 0 && (fonte == null || FONTES_DE_PROJETIL.has(fonte)) ? 1 + bicho.poeAprisionado.danoSofridoPct / 100 : 1);
    const fatorDoProjetil = (bicho, golpe) => {
      if (!deProjetil) return 1;
      const d = Math.max(Math.abs(bicho.x - x), Math.abs(bicho.y - y));
      if (!porDistancia.has(d)) porDistancia.set(d, ModsPoe.projetilNoAlvo(ficha, tagsDaSkill, bicho, estado, rampaDoUso));
      const noAlvo = porDistancia.get(d);
      // (lote A3 — F3) "Projéteis que Atravessaram causam X% mais Dano": o acerto do projétil que já atravessou alguém; (F7) o Localizar — "X% mais
      // Dano com Acertos por Intensidade" — e a Fuzilaria Cinética — "+X% (mais) dano por projétil disparado anteriormente em sequência" (o k-ésimo
      // projétil do uso)
      const doUso = ((golpe?.atravessados ?? 0) >= 1 && efeitoDaGema?.atravessouMaisPct ? 1 + efeitoDaGema.atravessouMaisPct / 100 : 1)
        * (intensidade > 0 && efeitoDaGema?.intensidadeMaisProjetilPct ? 1 + (intensidade * efeitoDaGema.intensidadeMaisProjetilPct) / 100 : 1)
        * (efeitoDaGema?.porProjetilAnteriorPct && golpe?.ordem > 0 ? 1 + (efeitoDaGema.porProjetilAnteriorPct * golpe.ordem) / 100 : 1);
      // (lote 73, o Acompanhamento: "… aumentado em X% por cada propagação restante, até Y%" — os ricochetes que faltam; o acerto direto tem todos)
      const restantes = golpe ? golpe.restantes ?? 0 : Math.max(0, Math.round(Number(efeitoDaGema?.encadear) || 0));
      const porRestante = restantes > 0 ? Math.min(ModsPoe.valor(ficha, 'proj_inc_por_ricochete_restante_max') || Infinity, restantes * ModsPoe.valor(ficha, 'proj_inc_por_ricochete_restante')) : 0;
      const inc = noAlvo.incPct + (golpe?.atravessados ?? 0) * ModsPoe.valor(ficha, 'proj_inc_por_atravessado') + (golpe?.ricochetes ?? 0) * ModsPoe.valor(ficha, 'proj_inc_por_ricochete') + porRestante;
      return (inc && mult > 0 ? (mult + (inc / 100) * (sintonia ?? 1)) / mult : 1) * noAlvo.mais * doUso;
    };
    // (lote 33, P045 — o Impacto: "Causa até X% mais Dano Corpo a Corpo aos Inimigos, baseado na proximidade": o golpe corpo a corpo da gema,
    // alvo a alvo — a ficha da habilidade é montada sem alvo; `ModsPoe.maisPelaProximidade`, a rampa do PoB)
    const corpoDaGema = itensPoeLigado() && tagsDaSkill.includes('corpo');
    const fatorDaProximidade = (bicho) => (corpoDaGema ? ModsPoe.maisPelaProximidade(ficha, tagsDaSkill, bicho, estado) : 1);
    // (17/10, lote G7) o ALVO no golpe da gema (`ModsPoe.golpeNoAlvo`): o que depende dele — os condicionais com tag de alvo da soma, as escalas
    // do alvo, as Marcas — no "aumentado" (somado ao `mult` de cada parte, como o projétil acima), no "mais", no crítico, no roubo e nas tags do
    // golpe (o `valor` do acerto lê as de alvo). A ficha da gema segue sem alvo; isto entra alvo a alvo.
    const EL_DO_AUMENTADO = { physical: 'phys_dmg', fire: 'fire_dmg', ice: 'ice_dmg', energy: 'energy_dmg', chaos: 'chaos_dmg' };
    const ajusteDoAlvo = (bicho) => {
      const g = itensPoeLigado() && entry.poeGema ? ModsPoe.golpeNoAlvo(ficha, bicho, agora) : null;
      if (!g || g.vazio) return g ? { fatorEl: () => 1, ficha: { ...ficha, tagsDoGolpe: g.tags } } : null;
      const a = g.s;
      const fatorEl = (el, m) => {
        const inc = (a.dmg_inc ?? 0) + (a[EL_DO_AUMENTADO[el]] ?? 0);
        const doInc = inc && m > 0 ? (m + (inc / 100) * (sintonia ?? 1)) / m : 1;
        return doInc * Math.max(0, 1 + (a.mais_dano ?? 0) / 100) * Math.max(0, 1 + (a[ModsPoe.MAIS_DANO_DO_TIPO[el]] ?? 0) / 100);
      };
      // o crítico: o "aumentada" (pelos pontos da ficha, como o `fichaDoGolpe`), o "mais", o "+X%" e o multiplicador
      let critChance = ficha.critChance ?? 0;
      if (a.crit_chance_inc && ficha.critPontos != null) critChance *= (1 + ((ficha.critInc ?? 0) + a.crit_chance_inc) / 100) / Math.max(0.01, 1 + (ficha.critInc ?? 0) / 100);
      if (a.crit_mais_pct) critChance *= Math.max(0, 1 + a.crit_mais_pct / 100);
      if (a.crit_chance) critChance += a.crit_chance / 100;
      const extras = Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v + (Number(ficha.extrasDoAlvo?.[k]) || 0)]));
      return {
        fatorEl, somado: [a.added_physical_dmg_min ?? 0, a.added_physical_dmg_max ?? 0],
        ficha: { ...ficha, tagsDoGolpe: g.tags, extrasDoAlvo: { ...(ficha.extrasDoAlvo ?? {}), ...extras }, critChance: Math.min(ficha.critTeto ?? 1, critChance),
          ...(a.crit_dmg ? { critMultiplier: (ficha.critMultiplier ?? 1.5) + a.crit_dmg / 100 } : {}),
          ...(a.life_leech ? { lifeLeech: (ficha.lifeLeech ?? 0) + a.life_leech / 100 } : {}), ...(a.mana_leech ? { manaLeech: (ficha.manaLeech ?? 0) + a.mana_leech / 100 } : {}),
          ...(a.life_on_hit ? { vidaPorAcerto: (ficha.vidaPorAcerto ?? 0) + a.life_on_hit } : {}), ...(a.mana_on_hit ? { manaPorAcerto: (ficha.manaPorAcerto ?? 0) + a.mana_on_hit } : {}) },
      };
    };
    // (lote G7: o roubo a mais deste alvo — a Marca do Senhor da Guerra, "…concedem X% de Dreno de Vida quando Acertados por Ataques" —, × o dano
    // nele; no fim entra na conta do roubo como a fração do total)
    const rouboDosAlvos = { vida: 0, mana: 0 };
    // (17/10, lote G13) a RUNA: "Causa X% mais/menos Dano com Acertos contra o Inimigo Vinculado" — só no inimigo a que ela está vinculada
    const contraVinculado = plantada?.vinculado != null && entry.poeGema ? GemasPoe.contraOVinculado(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : 0;
    // (lote E1b, 26/10) a Armadilha Flamejante: "X a Y de Dano de Fogo adicionado contra Inimigos Queimando" — no acerto de quem está Queimando
    const fogoContraQueimando = itensPoeLigado() && entry.poeGema ? GemasPoe.fogoContraQueimandoDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : null;
    // (lote E1b, dono 26/10) as Armadilhas de Urso: "Trava o inimigo no lugar" — o acertado fica Imobilizado por 3 s × a Duração da Habilidade
    const travaDaGema = itensPoeLigado() && entry.poeGema ? GemasPoe.travaDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    const travaDoUso = travaDaGema ? Math.round(travaDaGema.ms * fatorDeDuracao(estado, entry, efeitoDaGema)) : 0;
    // (lote E2B, 26/10 — o PoB) o debuff da Armadilha de Urso: "25% de aumento de Dano dos Acertos de Minas ou Armadilhas" e o "−80% de Velocidade de Movimento" que cai
    // até 0 — pela duração da habilidade DEPOIS da Imobilização (`GemasE2b.porDebuffDoUrso`)
    const ursoDoUso = travaDoUso > 0 ? GemasPoe.ursoDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : null;
    // (17/10, lote G17) o Toxinas Vis: "X% mais Dano com Acertos por Veneno no Inimigo, até N" — os Venenos no alvo agora
    const porVeneno = (bicho) => (efeitoDaGema?.maisAcertoPorVenenoPct > 0 ? 1 + (efeitoDaGema.maisAcertoPorVenenoPct * Math.min(efeitoDaGema.maisAcertoPorVenenoMax ?? Infinity, (bicho.dots ?? []).filter((d) => (d.tipo === 'venenoPoe' || d.tipo === 'veneno') && d.falta > 0).length)) / 100 : 1);
    // (a Sede de Sangue: "X% mais Dano Físico Corpo a Corpo contra inimigos Sangrando" — só no acerto; o Eco de Magia Maior: "+X% de dano mágico por
    // repetição" — só no acerto da magia, X a mais por repetição)
    const contraSangrando = (bicho) => (efeitoDaGema?.maisAcertoContraSangrandoPct > 0 && (bicho.dots ?? []).some((d) => d.tipo === 'sangramento' && d.falta > 0) ? 1 + efeitoDaGema.maisAcertoContraSangrandoPct / 100 : 1);
    const porRepeticao = () => Math.max(0, 1 + (repeticaoAtual * (efeitoDaGema?.repeticaoMaisPorPct ?? 0)) / 100);
    // (lote C1: o Frenesi dá a carga uma vez por ataque — a repetição em que ela já saiu; revisão do C1: o uso e cada repetição)
    let frenesiNaRepeticao = -1;
    // (lote C2, dono 20/10) o que o acerto do golpe guarda para depois do passe: os atordoados (o pulso do Esmagar Ossos) e a explosão da Imolação; `passeC2`: o passe a
    // mais do lote (o pulso, os martelos, o ramo da fissura, a explosão) — nele o acerto não ganha Traumatismo, não carrega a Imolação e não prende
    let traumaNaRepeticao = -1;
    let imolacaoNaRepeticao = -1;
    const atordoadosNoPasse = new Map();
    let imolacaoExplode = 0;
    let passeC2 = null;
    // (lote PR3, dono 21/10 — D3) a 2ª forma da Lança Gélida: o acerto a ≥ 2 casas de você leva o crítico dela
    const segundaForma = itensPoeLigado() && entry.poeGema && !casas ? GemasPoe.segundaFormaDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    // (lote G-C, D11) a Detonação: "Dano de Caos com Acertos é Resistido pela Resistência mais baixa" (a da Contradição: a maior) — no acerto (`resistenciaEfetivaDe`)
    const fichaDaRes = detonacaoDoUso?.resistencia ? { ...ficha, caosResistidoPela: detonacaoDoUso.resistencia } : ficha;
    const acertar = (bicho, pct0 = 100, fonte = null, golpe = null) => {
      // (revisão do C1) o raio do Castigo do Julgamento Divino não é golpe corpo a corpo (a parte "Area Hit" do PoB: melee = false): sem o Golpe Impiedoso e sem a
      // Proximidade do Impacto, que são do corpo a corpo; o "aumentado"/"mais" corpo a corpo da ficha sai pelo `fatorDoRaioSemCorpo`
      const naoCorpo = fonte === 'raio';
      const impiedoso = impiedosoDoUso && !naoCorpo;
      // (revisão do A5) o Condutor Elétrico só acerta o inimigo Eletrizado
      if (doCondutor?.soEletrizados && AfeccoesPoe.fatorDeEletrizacao(bicho, agora) <= 1) return;
      // (revisão G) + a magia da Runa do Arcanista: "mais Dano com Acertos contra o Inimigo Vinculado" — só no vinculado da Runa (`gatilho.vinculadoUid`), só no acerto
      const doArcanista = gatilho?.contraVinculadoPct && gatilho.vinculadoUid != null && bicho.uid === gatilho.vinculadoUid ? Math.max(0, 1 + gatilho.contraVinculadoPct / 100) : 1;
      const pct0b = (contraVinculado && bicho.uid === plantada.vinculado ? pct0 * Math.max(0, 1 + contraVinculado / 100) : pct0) * doArcanista;
      // (lote G-C) só nos ACERTOS: a Marca do Atirador ("sofrem Dano aumentado em X% de Acertos de Projéteis") e a Detonação de Feitiços no Enfeitiçado ("+200% mais Dano
      // com Acertos") — no `pct` (o acerto) e no `soNoAcerto` (a afecção sai sem eles); o "+90% mais com Afecções" vai na afecção (`maisNaAfeccao`)
      const doAtirador = deProjetil ? GemasGAC.fatorDoProjetil(bicho, agora) : 1;
      const enfeiticadoAntes = !!detonacaoDoUso && !!feiticosAntes?.get(bicho)?.length;
      const daDetonacao = enfeiticadoAntes ? 1 + detonacaoDoUso.maisAcertoPct / 100 : 1;
      const pct = pct0b * doAtirador * daDetonacao;
      const noAlvo = ajusteDoAlvo(bicho);
      const fichaNoAlvo = noAlvo?.ficha ?? ficha;
      // (lote A5b, dono 20/10: "fazer como o PoE") a gema de ATAQUE rola o acerto POR ALVO — a precisão do uso (a ficha do golpe, com a da gema e a dos
      // suportes) contra a evasão do bicho, pela conta do golpe básico (`Defesa.errou`: as exceções "Acertos não podem ser Evadidos", a Técnica Resoluta, o
      // "Não pode ser Evadido" da gema, os Provocados por você). A magia nunca erra; a gema só de dano contínuo não acerta. O erro é o evento do golpe
      // básico: sem dano, sem afecções, sem os efeitos "ao acertar", sem gastar o que o acerto gasta (as Chamas, a Exposição…)
      if (rolaPrecisao && !entry.overTime && Defesa.errou(fichaNoAlvo, hunt, bicho)) {
        eventos.push({ t: 'block', uid: bicho.uid, x: bicho.x, y: bicho.y, color: '#999999', esquiva: true, errou: true });
        registrarGolpe(() => ({ origem: 'gema-errou', habilidade: entry.id, alvo: bicho.name, errou: true, precisao: fichaNoAlvo.accuracy ?? 0 }));
        return;
      }
      if (rolaPrecisao) { acertadosNoUso.add(bicho); acertadosNoPasse.add(bicho); }
      // O golpe da gema do PoE com MAIS DE UM elemento (ou de outro elemento que o da skill): cada parte com o "aumentado", a marca de
      // vulnerável e a resistência do elemento dela; o golpe leva o elemento da maior parte (a cor, o registro, as mecânicas do mob).
      // (lote A3c: o acerto da área no impacto tem o dano do projétil que a causou — `golpe.doImpacto`, a fonte do impacto)
      const fator = (semDanoProprio || semAcertoDaGema ? 0 : 1) * (dobroNaFinal ? 2 : 1) * (impiedoso ? 1 + (efeitoDaGema.impiedosoMaisDanoPct ?? 0) / 100 : 1) * (reocorrendo ? Math.max(0, 1 - (efeitoDaGema.selosMenosDanoPct ?? 0) / 100) : 1) * maisDaIntensidade * maisDoMaximizado() * maisDaRepeticao() * porRepeticao() * porVeneno(bicho) * contraSangrando(bicho) * fatorDoPerto(bicho) * maisDaInvestida * contraResfriado(bicho) * contraEletrizado(bicho) * contraIncendiado(bicho) * doProjetilDaGema(golpe?.tipo === 'impacto' ? golpe.doImpacto : fonte) * fatorDoAco(bicho) * fatorDoProjetil(bicho, golpe) * fatorDoAprisionado(bicho, fonte) * fatorDaProximidade(bicho) * (fatorDaGema * (1 + ((porAfeccao ?? 0) * GemasPoe.afeccoesElementaisEm(bicho, agora)) / 100) * pct * fatorDoAtaque) / 10000;
      // (O dano SORTUDO do PoE — rola duas vezes e fica o maior: "Dano Elemental com Acertos é Sortudo enquanto você estiver Eletrizado" em
      // todo golpe — `sorteDoGolpe.sempre`; "Dano de Raio com Golpes Não-Críticos é Sortudo" só no não crítico — `sorteDoGolpe.naoCritico`.)
      // (17/10, lote G17) o que no PoB vale SÓ NO ACERTO e o jogo põe no `fator`: o "mais/menos Dano com Acertos" e os de Mágico/Projétil/Corpo a
      // Corpo/Ataque/Área dos suportes, o "mais Dano Corpo a Corpo" do Golpe Impiedoso, a Intensidade (Área com Acertos), o Aço, a Proximidade (o
      // Impacto), o Toxinas Vis e a Runa contra o vinculado ("com Acertos") — a afecção de dano sai sem eles (`fatoresDoDano`)
      const soNoAcerto = Math.max(1e-9, (1 + (efeitoDaGema?.maisDanoAcertoPct ?? 0) / 100) * (soAcertoDaFicha ?? 1) * (impiedoso ? 1 + (efeitoDaGema.impiedosoMaisDanoPct ?? 0) / 100 : 1) * maisDaIntensidade * fatorDoAco(bicho) * (naoCorpo ? 1 : fatorDaProximidade(bicho)) * porVeneno(bicho) * contraSangrando(bicho) * porRepeticao() * fatorDoPerto(bicho) * maisDaInvestida * contraResfriado(bicho) * contraEletrizado(bicho) * contraIncendiado(bicho) * fatorDoAprisionado(bicho, fonte) * (pct0 ? pct / pct0 : 1));
      const rolarParte = (p) => (p.min + Math.random() * (p.max - p.min) + daPericia * p.frac) * fator * p.mult * Reforcos.vulnerabilidade(bicho, p.elemento, agora) * (noAlvo ? noAlvo.fatorEl(p.elemento, p.mult) : 1);
      // (o Sabotador: "Dano com Acertos é Azarado" — rola duas vezes e fica o menor; com o Sortudo junto, os dois se anulam)
      const azarado = ModsPoe.valor(ficha, 'dano_acertos_azarado') > 0;
      // (lote 31: a Sorte e o Azar juntos se anulam — UM sorteio, como no PoE; antes, com os dois, ficava o Sortudo. Os mesmos sorteios de antes.)
      // (lote A4, dono 19/10: D7: o cone do Tiro Gélido converte o resto do Físico em Gelo)
      // (lote A5c, dono 20/10: "regra do PoE, no motor inteiro" — revoga a exceção 15: a parte convertida no cone rola com o "aumentado" do Físico E o do Gelo,
      // `multDosTipos`; antes, só o do Gelo)
      const pedacos = partes ? partes.map((p0) => {
        const p = golpe?.fisicoParaGelo && p0.elemento === 'physical' ? { ...p0, elemento: 'ice', mult: multDosTipos(['physical', 'ice'], 'ice') } : p0;
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
      // (lote G7: "Adiciona X a Y de Dano Físico aos Acertos contra Inimigos Amaldiçoados" — a Marca do Caçador — na parte Física, como o do
      // Empalamento acima)
      if (pedacos && noAlvo?.somado && (noAlvo.somado[0] || noAlvo.somado[1])) {
        const v = (noAlvo.somado[0] + Math.random() * (noAlvo.somado[1] - noAlvo.somado[0])) * (eficaciaDoAdicionado ?? 1) * fator * (multFisico ?? mult) * Reforcos.vulnerabilidade(bicho, 'physical', agora) * noAlvo.fatorEl('physical', multFisico ?? mult);
        const fisico = pedacos.find((p) => p.elemento === 'physical');
        if (fisico) fisico.dano += v;
        else pedacos.push({ elemento: 'physical', dano: v });
      }
      // (lote E1b, 26/10: o Fogo adicionado contra o Queimando — a Armadilha Flamejante e a da Explosão — na parte de Fogo, × a Eficácia do Dano Adicionado, o
      // "aumentado" do Fogo e os "mais" do golpe, como o Físico da Marca acima)
      if (pedacos && fogoContraQueimando && GemasE1b.queimando(bicho)) {
        const mFogo = multDosTipos ? multDosTipos(['fire'], 'fire') : mult;
        const v = (fogoContraQueimando[0] + Math.random() * (fogoContraQueimando[1] - fogoContraQueimando[0])) * (eficaciaDoAdicionado ?? 1) * fator * mFogo * Reforcos.vulnerabilidade(bicho, 'fire', agora) * (noAlvo ? noAlvo.fatorEl('fire', mFogo) : 1);
        const fogo = pedacos.find((p) => p.elemento === 'fire');
        if (fogo) fogo.dano += v;
        else pedacos.push({ elemento: 'fire', dano: v });
      }
      const tipo = pedacos ? pedacos.reduce((a, b) => (b.dano > a.dano ? b : a)).elemento : entry.element ?? 'physical';
      const rolagem = sorteDoGolpe.sempre.has(tipo) || sorteDoGolpe.naoCritico.has(tipo) ? [sortear(min, max), sortear(min, max)] : azarado ? [Math.min(sortear(min, max), sortear(min, max))] : [sortear(min, max)];
      const doAlvoNoTipo = !pedacos && noAlvo ? noAlvo.fatorEl(tipo, mult) : 1;
      const bruto = pedacos ? pedacos.reduce((t, p) => t + p.dano, 0) : ((sorteDoGolpe.sempre.has(tipo) ? Math.max(...rolagem) : rolagem[0]) + daPericia) * fator * mult * sobrecarga * Reforcos.vulnerabilidade(bicho, tipo, agora) * doAlvoNoTipo;
      const brutoNaoCritico = pedacos ? null : (Math.max(...rolagem) + daPericia) * fator * mult * sobrecarga * Reforcos.vulnerabilidade(bicho, tipo, agora) * doAlvoNoTipo;
      // Gema de DANO CONTÍNUO (Ignite, Envenom, Inflict Wound...): o dano dela é o TOTAL de um efeito ao longo do tempo (`combate/dot.mjs`),
      // não um golpe — sem acerto, sem crítico, e a resistência passa em cada pulso.
      const tipoDoDot = entry.overTime ? Dot.tipoDaFonte(entry.overTime.type) : null;
      if (tipoDoDot) {
        amaldicoouAgora(estado, hunt, bicho, ficha, agora, eventos, personagem, { doTotem });
        // (revisão do C4, 21/10: o `bruto` já traz a maldição de dano sofrido — `doAcerto`; + o dano sofrido do atacante no pulso — `sofrido`)
        const doDot = Dot.aplicar(bicho, { tipo: tipoDoDot, total: bruto, origem: { fonte: doTotem ? 'totem' : 'gema', habilidade: entry.id, doAcerto: true, ...(ModsPoe.sofridoDoAtacante(ficha.afPoe) ? { sofrido: ModsPoe.sofridoDoAtacante(ficha.afPoe) } : {}) } }, agora);
        if (doDot) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: doDot });
        registrarGolpe(() => ({ origem: 'gema-dot', habilidade: entry.id, alvo: bicho.name, tipo, dot: tipoDoDot, totalDoEfeito: Math.round(bruto), aplicou: !!doDot }));
        return;
      }
      // O bicho BLOQUEIA o golpe (só quem tem bloqueio configurado — `mobs/atributos.mjs`): sem dano nem estados.
      // ("Monstros não podem Bloquear seus Ataques" — as maestrias da árvore: só nos ataques.)
      // ("Chance de Inimigos Bloquearem Ataques com Espada reduzida em X%" — `inimigos_bloqueio_red@comEspada`: só nos ataques.)
      const ehAtaque = entry.poeGema ? !!entry.poeGema.ataque : true;
      // (lote A2: + a Redução de Chance de Bloqueio — os pontos a menos do suporte, o "reduzido" da qualidade e o Subjugado no bicho; ao bloquear, o
      // suporte o Subjuga — `subjugarAoBloquear`)
      // (revisão do C4, 21/10) a magia SEM ACERTO (`semAcertoDaGema` — a Praga, o Definhar, o Contágio…) não é bloqueada: no PoE só o ACERTO pode ser bloqueado
      if (!semAcertoDaGema && !(ModsPoe.valor(ficha, 'inimigos_nao_bloqueiam') > 0 && ehAtaque) && AtributosDoMob.bloqueou(bicho, Math.random, (ehAtaque ? Math.max(0, 1 - ModsPoe.valor(ficha, 'inimigos_bloqueio_red') / 100) : 1) * Math.max(0, 1 - (efeitoDaGema?.bloqueioInimigoReduzidoPct ?? 0) / 100), { menosPontos: (efeitoDaGema?.bloqueioInimigoMenos ?? 0) + AtributosDoMob.subjugadoPontos(bicho, agora) })) {
        eventos.push({ t: 'block', uid: bicho.uid, x: bicho.x, y: bicho.y, color: '#999999', bloqueado: true });
        if (efeitoDaGema?.subjugadoMs > 0) AtributosDoMob.subjugar(bicho, efeitoDaGema.subjugadoMs, efeitoDaGema.subjugadoPct ?? 5, agora);
        return;
      }
      // (lote A5, dono 20/10 — f34 D9) a Exposição da Bomba Congelante entra ANTES do dano (os pulsos do cristal vêm antes da explosão)
      if (exposicaoDoUso?.antes) exporNoAcerto(bicho, exposicaoDoUso.el);
      // (lote B1, dono 20/10) e a "Regeneração de Vida reduzida em 75%" do mesmo debuff, pela mesma duração (`skills/estados`: `regenMenosDebuff`)
      if (regenMenosDoUso > 0 && msDaExposicao > 0) {
        const e = (bicho.estados ??= {});
        const r = e.regenMenosDebuff;
        e.regenMenosDebuff = r?.ate > agora ? { ate: Math.max(r.ate, agora + msDaExposicao), pct: Math.max(r.pct ?? 0, regenMenosDoUso) } : { ate: agora + msDaExposicao, pct: regenMenosDoUso };
      }
      // (13/10, a Presa Sombria: "Projéteis que Ricochetearam ganham X% de Dano Não-Caótico como Dano de Caos extra" — pela resistência a Caos)
      const caosDoRicochete = deProjetil && golpe?.ricochetes > 0 ? ModsPoe.valor(ficha, 'proj_ricochete_caos_extra') : 0;
      const naoCaotico = caosDoRicochete > 0 ? (pedacos ? pedacos.filter((p) => p.elemento !== 'chaos').reduce((t, p) => t + p.dano, 0) : tipo !== 'chaos' ? bruto : 0) : 0;
      // (14/10, a Chama Santificada: o ATAQUE de um aliado no bicho com Chamas que não são dele ganha X% do Físico como Fogo extra — pela
      // resistência a Fogo — e as tira; quem pôs conta a remoção — `ModsPoe.consumirChamas`)
      const chamaPct = ehAtaque && itensPoeLigado() ? ModsPoe.consumirChamas(estado, bicho, ModsPoe.idDaChama(hunt), agora) : 0;
      const fisicoDaChama = chamaPct > 0 ? (pedacos ? pedacos.filter((p) => p.elemento === 'physical').reduce((t, p) => t + p.dano, 0) : tipo === 'physical' ? bruto : 0) : 0;
      const fogoDaChama = fisicoDaChama > 0 ? resistido(hunt, bicho, 'fire', (fisicoDaChama * chamaPct) / 100, ficha) : 0;
      const base = (pedacos ? Math.round(pedacos.reduce((t, p) => t + resistido(hunt, bicho, p.elemento, p.dano, fichaDaRes), 0)) : resistido(hunt, bicho, tipo, bruto, fichaDaRes)) + (naoCaotico > 0 ? resistido(hunt, bicho, 'chaos', (naoCaotico * caosDoRicochete) / 100, ficha) : 0) + fogoDaChama;
      // (a maldição amaldiçoa no acerto; "Recupera X% de Vida quando você Amaldiçoar um Inimigo sem Maldições")
      // (revisão do C4, 21/10: a magia sem acerto não amaldiçoa "no acerto")
      if (!semAcertoDaGema) amaldicoouAgora(estado, hunt, bicho, ficha, agora, eventos, personagem, { doTotem });
      if (travaDoUso > 0 && GemasE1b.imobilizar(bicho, agora + travaDoUso)) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'imobilizado' });
      if (ursoDoUso && bicho.hp > 0) GemasE2b.porDebuffDoUrso(bicho, ursoDoUso, agora + travaDoUso, agora + 2 * travaDoUso);
      const sempreNaFinal = ehMagiaDaConta && naRepeticaoFinal && ModsPoe.valor(ficha, 'critico_repeticao_final') > 0;
      const semForaDaFinal = ehMagiaDaConta && !naRepeticaoFinal && ModsPoe.valor(ficha, 'sem_critico_fora_da_final') > 0;
      // (+ a quarta Retaliação: sempre crítica)
      // (a Lâmina Noturna: "+X% de Chance de Golpe Crítico enquanto Elusivo"; "Elusivo … concede +X% de Multiplicador de Golpes Críticos para
      // Habilidades Suportadas por Lâmina Noturna" — o do suporte e o da árvore)
      // (lote 33: o "Elusivo também concede +X% de Multiplicador" é do EFEITO do Elusivo — cai com ele, `ModsPoe.efeitoDoElusivo`; o "+X% de Chance
      // enquanto Elusivo" é uma condição, inteiro)
      const efeitoElusivo = hunt.poeElusivo ? ModsPoe.efeitoDoElusivo(hunt, agora) / 100 : 1;
      const fichaDoCritico = (efeitoDaGema?.critElusivo || efeitoDaGema?.critMultElusivo) && ModsPoe.buffAtivo(estado, 'elusivo')
        ? { ...fichaNoAlvo, critChance: Math.min(1, (fichaNoAlvo.critChance ?? 0) + (efeitoDaGema.critElusivo ?? 0) / 100), critMultiplier: (fichaNoAlvo.critMultiplier ?? 1.5) + (((efeitoDaGema.critMultElusivo ?? 0) + ModsPoe.valor(ficha, 'lamina_crit_mult_elusivo')) * efeitoElusivo) / 100 }
        : fichaNoAlvo;
      // (lote A4, dono 19/10) o crítico deste acerto: o "X% de aumento da Chance de Acerto Crítico por Rajada" das Saraivadas (`golpe.critIncPct`, somado aos
      // "aumentada" da ficha) e o "+X% ao multiplicador de golpe crítico quando em estágios máximos" das Lâminas Velozes da Incisão (`critMultPct`)
      // (lote PR3, dono 21/10 — D3) + a 2ª forma da Lança Gélida: "Segunda forma possui um aumento de 600% de Chance de Crítico" e "+49% ao Multiplicador" (+ a
      // qualidade) no acerto a ≥ 2 casas de você (`GemasPR3.naSegundaForma`)
      const daSegunda = segundaForma && GemasPR3.naSegundaForma(segundaForma, { x, y }, bicho) ? segundaForma : null;
      const incDoGolpe = (golpe?.critIncPct ?? 0) + (daSegunda?.critIncPct ?? 0);
      const multDoUso = (estagioDoUso?.critMultPct ?? 0) + (daSegunda?.critMultPct ?? 0);
      const fichaDoCritico2 = incDoGolpe || multDoUso ? (() => {
        const inc = Number(fichaDoCritico.critMagiaPoe?.aumentada ?? fichaDoCritico.critInc ?? 0) || 0;
        const k = incDoGolpe ? (1 + (inc + incDoGolpe) / 100) / Math.max(0.01, 1 + inc / 100) : 1;
        return { ...fichaDoCritico, critChance: Math.min(fichaDoCritico.critTeto ?? 1, (fichaDoCritico.critChance ?? 0) * k), ...(fichaDoCritico.critChanceMagia != null ? { critChanceMagia: Math.min(1, fichaDoCritico.critChanceMagia * k) } : {}), critMultiplier: (fichaDoCritico.critMultiplier ?? 1.5) + multDoUso / 100 };
      })() : fichaDoCritico;
      const rolado = Ficha.rolarCritico(estado, base, bicho, eventos, sempreNaFinal || retaliacaoCritica || pulsoForteDoUso?.sempreCritico ? { ...fichaDoCritico2, critChance: 1, critChanceMagia: 1 } : semForaDaFinal ? { ...fichaDoCritico2, critChance: 0 } : fichaDoCritico2);
      // PoE: "Golpes Críticos de Ataques ignoram a Resistência Elemental dos Monstros" — no crítico, a parte elemental sem a resistência positiva.
      if (rolado.crit && base > 0 && ModsPoe.valor(ficha, 'critico_ignora_res') > 0) {
        // (revisão G) as razões partem da mesma ficha da `base` (`fichaDaRes` — o Caos da Detonação pela menor/maior resistência)
        const semRes = pedacos ? pedacos.reduce((t, p) => t + (['fire', 'ice', 'energy'].includes(p.elemento) ? Math.max(p.dano, resistido(hunt, bicho, p.elemento, p.dano, fichaDaRes)) : resistido(hunt, bicho, p.elemento, p.dano, fichaDaRes)), 0) : (['fire', 'ice', 'energy'].includes(tipo) ? Math.max(bruto, base) : base);
        rolado.dano = Math.round((rolado.dano * semRes) / base);
      }
      // (o Inquisidor: "Acertos Não Críticos penetram X% das Resistências Elementais do Inimigo" — o golpe não crítico, na proporção da parte
      // elemental com a penetração a mais)
      // (lote 55, o Olho do Vigia: + "Acertos Críticos Penetram X% da Resistência Elemental Inimiga" — o golpe crítico, `pen_critico`)
      const penNaoCritico = ModsPoe.valor(ficha, rolado.crit ? 'pen_critico' : 'pen_nao_critico');
      if (base > 0 && penNaoCritico > 0) {
        const comPen = { ...fichaDaRes, penetracao: { ...(ficha.penetracao ?? {}), elemental: (Number(ficha.penetracao?.elemental) || 0) + penNaoCritico } };
        const comMais = pedacos ? pedacos.reduce((t, p) => t + resistido(hunt, bicho, p.elemento, p.dano, ['fire', 'ice', 'energy'].includes(p.elemento) ? comPen : fichaDaRes), 0) : resistido(hunt, bicho, tipo, bruto, ['fire', 'ice', 'energy'].includes(tipo) ? comPen : fichaDaRes);
        if (comMais > base) rolado.dano = Math.round((rolado.dano * comMais) / base);
      }
      // (o golpe NÃO crítico com a parte de Raio sortuda: o mesmo golpe, na proporção do dano rolado duas vezes)
      if (!rolado.crit && base > 0 && (pedacos ? pedacos.some((p) => p.naoCritico != null && sorteDoGolpe.naoCritico.has(p.elemento)) : sorteDoGolpe.naoCritico.has(tipo))) {
        const sortudo = pedacos ? Math.round(pedacos.reduce((t, p) => t + resistido(hunt, bicho, p.elemento, sorteDoGolpe.naoCritico.has(p.elemento) ? p.naoCritico ?? p.dano : p.dano, fichaDaRes), 0)) : resistido(hunt, bicho, tipo, brutoNaoCritico, fichaDaRes);
        if (sortudo > base) rolado.dano = Math.round((rolado.dano * sortudo) / base);
      }
      const { dano, crit, onslaught, chance } = rolado;
      if (crit) { houveCritico = true; danoCritico += dano; }
      // (lote G-C, D11) a Detonação consome um Feitiço sorteado dos que o alvo tinha antes do uso (a qualidade: a chance de não consumir; a do Caos nunca consome)
      if (enfeiticadoAntes && dano > 0) GemasGAC.consumirFeitico(bicho, detonacaoDoUso, feiticosAntes.get(bicho), agora);
      // (lote C4, dono 21/10) os debuffs do lote C4 no acertado (antes da camada nova da Praga — o "quem ainda não tem a Praga" é o de antes deste acerto)
      if (c4) debuffsDoC4(hunt, bicho, c4, { agora, msDoC4, definhados: definhadosPeloC4, ficha, acao: entry.id, quem: doTotem ? null : personagem?.nome ?? null, raioDoPestilento: c4.pestilento ? Math.max(0, casasDoRaio(c4.pestilento.raioM * Math.sqrt(ModsPoe.fatorDaArea(efeitoDaGema?.areaIncPct ?? 0, efeitoDaGema?.areaMaisPct ?? 0)))) : 0, eventos });
      // (os suportes no acerto: a Crueldade — "Acertos de Habilidades Suportadas concedem Crueldade"; a Lâmina Noturna — "concedem Elusivo no
      // Golpe Crítico"; o Golpe Impiedoso — o atordoamento base dele e, da árvore, "Acertos Impiedosos Intimidam Inimigos por N segundos")
      const doSuporte = dano > 0 ? efeitosDosSuportesNoAcerto(estado, hunt, bicho, ficha, efeitoDaGema, { crit, impiedoso, agora, eventos, doTotem }) : null;
      // (o Assassino — Mortífero: o crítico de ataque num Raro/Único sem Marca nenhuma ativa a Marca do Assassino)
      // (lote G20a: o crítico do totem não é o seu)
      if (crit && entry.poeGema?.ataque && !doTotem) marcaDoAssassino(estado, hunt, bicho, ficha, agora);
      // (lote A4, dono 19/10: D3: o ferimento do Golpe Cintilante Vaal não fere agora — soma, e o total entra no fim do uso)
      if (ferimentos) {
        const f = ferimentos.get(bicho) ?? { dano: 0, crit: false, color: pedacos ? COR_DO_ELEMENTO[tipo] ?? cor : cor };
        f.dano += dano;
        f.crit ||= crit;
        ferimentos.set(bicho, f);
      } else if (conchaDoBicho(bicho, agora) && !(entry.poeGema && GemasPoe.conchaDaGema(entry.poeGema.slug, 1))) {
        // (lote PR4, dono 25/10 — D3) a CONCHA SOMÁTICA: "Damage from hits against that target is taken from the shell first. If fully depleted, the shell will explode"
        // — o acerto sai dela antes da Vida; a que se esgota explode no tique (`tiqueDasGemasPR4`, a exceção 4); os acertos da própria Concha não a gastam (a exceção 7)
        const c = conchaDoBicho(bicho, agora);
        const r = GemasPR4.absorverNaConcha(c, dano, c.absorvePct ?? 100);
        bicho.hp -= r.naVida;
        if (r.estourou) c.estourou = agora;
      } else bicho.hp -= dano;
      // (lote B2, dono 20/10) o acerto no lote B2: o Golpe Infernal (o debuff CARREGADO no acertado pelo golpe — +1 carga, a duração renova —; o DESCARREGADO no acertado
      // pela explosão), a Febre Corrompedora e o Contágio da Transferência (`aoAcertarB2`); o acerto do totem não é seu
      // (revisão B2, 21/10: o debuff guarda QUEM o pôs — a party divide os bichos —; o mesmo bicho entra uma vez só na lista do passe)
      if (infernalDoUso && infernalNoAcerto(bicho, infernalDoUso, agora + infernalMs, !(fonte === 'explosaoInfernal' || plantada?.explosaoInfernal), entry.id, agora, personagem?.nome ?? null) >= infernalDoUso.maxCargas && !explodemNoPasse.includes(bicho)) explodemNoPasse.push(bicho);
      if (!doTotem) for (const st of aoAcertarB2(hunt, bicho, dano, agora)) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: st });
      if (b2?.cadaverVoltaxicoPct > 0 && plantada?.voltaxica && dano > 0 && bicho.hp <= 0 && !mortosDaVoltaxica.includes(bicho)) mortosDaVoltaxica.push(bicho);
      // (decisão do dono, 20/10) o Chicote Ardente: o acerto num Incendiado cria o Solo Ardente sob ele (`soloDoChicoteArdente`)
      if (b2?.chicote?.solo && !b2.chicote.solo.aoIncendiar && dano > 0) soloDoChicoteArdente(estado, hunt, entry, efeitoDaGema, b2.chicote.solo, bicho, agora, doTotem ? 'totem' : 'voce');
      // (lote A2) os suportes do acerto: o Pacifismo ("Ataques de habilidades reforçadas não podem matar inimigos" — o golpe deixa com 1 de Vida), a
      // Chance de Fugir (`acertoDosSuportesA2`); a Raridade de Itens do abate vai no carimbo do golpe (`QuemFeriu.carimbar`)
      if (efeitoDaGema) acertoDosSuportesA2(hunt, bicho, efeitoDaGema, { dano, ataque: ehAtaque, agora, doTotem });
      // (lote C1, dono 20/10) o Frenesi: o primeiro acerto do ataque dá a Carga de Frenesi da gema — e o da Agressividade, no máximo de Frenesi, consome todas por
      // 1 s de Agressividade cada. (revisão do C1: uma vez por ATAQUE — o uso e cada repetição do Golpe Múltiplo, que é um ataque próprio: Multistrikeable no PoB; as
      // duas armas e os pedaços de um mesmo ataque dão uma só)
      if (c1?.frenesi && !doTotem && !plantada && frenesiNaRepeticao !== repeticaoAtual) {
        frenesiNaRepeticao = repeticaoAtual;
        const af = ficha.afPoe ?? {};
        const max = CargasPoe.maximo(af, 'frenesi');
        if (c1.frenesi.agressividadePorCargaS > 0 && max > 0 && CargasPoe.ativas(estado).frenesi >= max) {
          const n = CargasPoe.gastar(estado, 'frenesi', Infinity);
          if (n) { ModsPoe.ganharBuff(hunt, 'agressividade', n * c1.frenesi.agressividadePorCargaS, agora); Ficha.invalidar(estado); }
        } else if (CargasPoe.ganhar(estado, 'frenesi', af)) Ficha.invalidar(estado);
      }
      // (lote C2, dono 20/10 — D2.1) o Traumatismo: o primeiro acerto de cada ataque (o uso e cada repetição — "a primeira vez que este Ataque Acertar") dá 1, cada um
      // com os seus 6 s × a Duração, e você sofre o dano por Traumatismo × os que tem depois do ganho (o Complexo zera ao chegar em 10)
      if (traumaDoUso && passeC2 == null && traumaNaRepeticao !== repeticaoAtual) {
        traumaNaRepeticao = repeticaoAtual;
        const g = GemasC2.ganharTrauma(hunt, traumaDoUso, agora, traumaDoUso.duracaoS * 1000 * fatorDeDuracao(estado, entry, efeitoDaGema));
        if (g.dano > 0) danoDoTraumatismo(estado, hunt, personagem, g.dano, eventos);
      }
      // (lote C2) o Golpe Infernal da Imolação: o primeiro acerto de cada ataque põe uma carga do debuff em VOCÊ (a duração da gema × a Duração, renovada); com 6 cargas o
      // debuff sai e explode depois do passe (`extrasDoC2`); se acabar antes, explode no tique com as que tiver (`tiqueDoC2`)
      if (c2?.imolacao && !plantada && !doTotem && passeC2 == null && imolacaoNaRepeticao !== repeticaoAtual) {
        imolacaoNaRepeticao = repeticaoAtual;
        const ms = Math.round((GemasPoe.compilada(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0)?.stats?.duracao ?? 3) * 1000 * fatorDeDuracao(estado, entry, efeitoDaGema));
        const im = hunt.poeImolacao?.acao === entry.id && hunt.poeImolacao.ate > agora ? hunt.poeImolacao : null;
        const n = Math.min(c2.imolacao.max, (im?.n ?? 0) + 1);
        if (n >= c2.imolacao.max) { delete hunt.poeImolacao; imolacaoExplode = n; } else hunt.poeImolacao = { acao: entry.id, n, ate: agora + ms };
      }
      // (lote 31, S001/P025: o acerto é seu — as tags do golpe, para o "ao Matar Corpo a Corpo"; lote G20a: o do totem é dele — `matarTotem`)
      QuemFeriu.carimbar(bicho, doTotem ? QuemFeriu.TOTEM : QuemFeriu.VOCE, ficha.tagsDoGolpe ?? tagsPoeDaSkill(entry), { raridade: efeitoDaGema?.raridadeAoMatarPct ?? 0 });
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
      // (lote A5, dono 20/10 — f34 D8) a Onda de Convicção: depois do acerto, a Exposição no elemento (Fogo, Gelo ou Raio) que mais causou dano, depois da
      // resistência — o próprio acerto não a aproveita
      if (exposicaoDoUso && !exposicaoDoUso.antes && dano > 0) {
        const porEl = {};
        for (const p of pedacos ?? [{ elemento: tipo, dano: bruto }]) if (['fire', 'ice', 'energy'].includes(p.elemento)) porEl[p.elemento] = (porEl[p.elemento] ?? 0) + resistido(hunt, bicho, p.elemento, p.dano, ficha);
        exporNoAcerto(bicho, exposicaoDoUso.el === 'maior' ? GemasA5.elementoDoMaiorDano(porEl) : exposicaoDoUso.el);
      }
      // (f34 D2) o Condutor Elétrico tira a Eletrização do alvo depois do acerto
      if (doCondutor?.tiraEletrizacao && dano > 0 && bicho.estados) { delete bicho.estados.chocado; delete bicho.estados.chocadosPilha; }
      // (lote B1, D-B1.9) o Definhamento da Chuva Tóxica do Definhamento, uma vez por uso em cada um
      if (definhaDoUso && dano > 0 && !definhadosNoUso.has(bicho)) { definhadosNoUso.add(bicho); for (let k = 0; k < definhaDoUso.n; k++) ModsPoe.porNoAlvoComMods(bicho, 'definhado', agora + definhaDoUso.ms, agora, ficha); }
      if (definharDoUso && dano > 0 && Math.random() * 100 < definharDoUso.chance) ModsPoe.porNoAlvoComMods(bicho, 'definhado', agora + definharDoUso.ms, agora, ficha);
      total += dano;
      if (noAlvo?.ficha) { rouboDosAlvos.vida += dano * ((noAlvo.ficha.lifeLeech ?? 0) - (ficha.lifeLeech ?? 0)); rouboDosAlvos.mana += dano * ((noAlvo.ficha.manaLeech ?? 0) - (ficha.manaLeech ?? 0)); }
      if (bicho.semDreno) totalSemDreno += dano;
      if (Mecanicas.semDrenoDeEs(bicho)) totalSemDrenoEs += dano;
      danos.push({ bicho, dano });
      // As mecânicas do mob que reagem ao dano (Endurecido, Espelhado — `mobs/mecanicas.mjs`); os espinhos do Raro do mapa só no corpo a corpo.
      // (lote G20a: o acerto do totem não volta em você — os espinhos e o reflexo iriam nele)
      Mecanicas.aoReceberDano(estado, hunt, personagem, bicho, dano, tipo, eventos, { corpoACorpo: Tags.tagsDaAcao(entry).includes('melee'), doTotem, ...(itensPoeLigado() && entry.poeGema ? { ficha } : {}) });
      // `fonte`: de que efeito veio (explosão, perfuração, bifurcação, encadeamento, retorno, projétil extra).
      // (A gema só de dano degenerativo — Flecha Cáustica, Contagiar… — não mostra um "0": o dano dela vem nos pulsos.)
      // (lote C4: a magia sem acerto não mostra o "0" — o efeito dela é o debuff)
      if (!ferimentos && !semAcertoDaGema && (dano > 0 || !(entry.poeGema && GemasPoe.degenerativoNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0)))) {
        eventos.push({ t: 'dmg', uid: bicho.uid, x: bicho.x, y: bicho.y, v: dano, foe: true, crit, onslaught, spell: entry.name, alvo: bicho.name, color: pedacos ? COR_DO_ELEMENTO[tipo] ?? cor : cor, ...(fonte ? { fonte } : {}) });
      }
      // Os estados das supports (Ignite, Freeze, Slow, Stun) no bicho atingido.
      // (PoE, 14/10: a chance de Congelar dos suportes — "têm X% de chance de Congelar" — vai para a conta do PoE, nas afecções abaixo: a
      // duração pelo dano de Gelo; o resto dos estados do suporte segue aqui.)
      // (lote A3, F2: + a chance de Congelar da rampa do Pulso Congelante — 25% colado, 0 a 15 unidades × o ProjectileSpeedMod; D2: colado = 20 u)
      const congelarDoSuporte = (ficha.afeccoes && efeitoDaGema?.congelarChance > 0 ? efeitoDaGema.congelarChance : 0)
        + (ficha.afeccoes && rampaDoUso?.rampaCongelar ? ModsPoe.congelarDaRampa(rampaDoUso, ModsPoe.unidadesAte(bicho, { x, y })) : 0);
      // (lote 76 — dono, 17/10: "Corrigir num lote próprio aqui") as chances de Incendiar, Envenenar e Sangrar dos suportes ("têm X% de chance
      // de Envenenar ao Acertar", "Causa Sangramento") também vão para a conta do PoE, como o Congelar — antes iam para o dano contínuo antigo
      // do Draevor (um % do acerto, e o Veneno sem o %, 0). (O "X% mais Dano" de cada afecção dos suportes: `fatoresDoDano`, abaixo — lote G17.)
      const chanceDoSuporte = ficha.afeccoes ? { incendio: efeitoDaGema?.igniteChance ?? 0, veneno: efeitoDaGema?.venenoChance ?? 0, sangramento: efeitoDaGema?.sangramentoChance ?? 0 } : null;
      const efeitoDosEstados = ficha.afeccoes ? { ...efeitoDaGema, congelarChance: 0, igniteChance: 0, venenoChance: 0, sangramentoChance: 0 } : efeitoDaGema;
      const postosDaGema = Estados.aplicar(bicho, efeitoDosEstados, dano, agora, Math.random, !!hunt.isBoss, bruto);
      for (const st of postosDaGema) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: st });
      // Os efeitos de acerto do PoE (atordoamento, Mutilar, Cegar, Desacelerar, Empalar, Empurrar, Provocar, Fúria — `itens-poe/mods-poe.mjs`).
      const fisicoDoAcerto = pedacos ? pedacos.filter((p) => p.elemento === 'physical').reduce((t, p) => t + p.dano, 0) : tipo === 'physical' ? bruto : 0;
      if (fisicoDoAcerto > 0 && base > 0) danoFisico += dano * Math.min(1, resistido(hunt, bicho, 'physical', fisicoDoAcerto, ficha) / base);
      // (a gema do PoE soma as chances dela que não são afecção — o empalamento — `GemasPoe.fichaComAsChancesDaGema`)
      const fichaComAsChances = entry.poeGema ? GemasPoe.fichaComAsChancesDaGema(ficha, entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : ficha;
      // (lote G7: com o alvo — as tags, os extras do alvo e o crítico dele —, e as chances da gema no `afPoe`)
      const fichaDoAcerto = noAlvo ? { ...fichaNoAlvo, afPoe: fichaComAsChances.afPoe } : fichaComAsChances;
      // (lote 31, P034: a parte de Fogo do acerto, na proporção do dano final — como o físico acima; + o Fogo da Chama Santificada)
      const fogoBruto = pedacos ? pedacos.filter((p) => p.elemento === 'fire').reduce((t, p) => t + p.dano, 0) : tipo === 'fire' ? bruto : 0;
      const fogoDoAcerto = base > 0 && (fogoBruto > 0 || fogoDaChama > 0) ? dano * Math.min(1, ((fogoBruto > 0 ? resistido(hunt, bicho, 'fire', fogoBruto, ficha) : 0) + fogoDaChama) / base) : 0;
      // (revisão do C4, 21/10) a magia SEM ACERTO não dispara os efeitos "no acerto" (o Empalamento, os sorteios de Mutilar/Cegar/Desacelerar…, a Exposição, a
      // Fortificação): no PoE ela não acerta — fica o debuff dela (`debuffsDoC4`) e o degenerativo, abaixo
      const doAcerto = semAcertoDaGema ? { atordoou: false, extra: 0 } : ModsPoe.aoAcertar(estado, hunt, bicho, fichaDoAcerto, { dano, fisico: fisicoDoAcerto, fogo: fogoDoAcerto, crit, eventos, agora, personagem, mover: (b) => ModsPoe.empurrar(hunt, b), elementos: pedacos ? pedacos.map((p) => p.elemento) : [tipo], habilidade: entry.id, deTotem: doTotem });
      // (lote S1, 26/10) o Toque Maldito: o acerto amaldiçoa com as maldições ligadas a ele
      if (toqueDoUso?.length && !semAcertoDaGema && bicho.hp > 0) Reforcos.marcarCom(hunt, bicho, toqueDoUso, agora);
      // (lote C2, dono 20/10 — D2.2) o golpe do Esmagar Ossos que ATORDOOU solta o pulso em volta do atordoado, com a área pela duração do atordoamento (`extrasDoC2`)
      if (c2?.pulso && passeC2 == null && (doAcerto?.atordoou || doSuporte?.atordoou || postosDaGema.includes('atordoado'))) atordoadosNoPasse.set(bicho, Math.max(0, (bicho.estados?.atordoado?.ate ?? agora) - agora));
      // (lote C1, dono 20/10) o golpe final da Cutilada Vaal num Raro ou Único dá o buff dela (20 s × a Duração — `hunt.poeCutiladaVaal`, lido no uso da Cutilada).
      // (revisão do C1: depois do `aoAcertar` — o golpe final pode ser o Golpe de Misericórdia, o da própria gema ou de outra fonte)
      if (c1?.buffDaVaal && !doTotem && dano > 0 && bicho.hp <= 0 && GemasC1.raroOuUnico(bicho)) {
        const s = (GemasPoe.compilada(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0)?.stats?.duracao ?? 20) * fatorDeDuracao(estado, entry, efeitoDaGema);
        hunt.poeCutiladaVaal = { ate: agora + Math.round(s * 1000), ...c1.buffDaVaal };
      }
      // (17/10, lote G7) a VIDA/MANA POR INIMIGO ACERTADO ("Ganha X de Vida por Inimigo Acertado com Ataques", e a da Marca do Caçador) também
      // nos acertos das gemas de ataque — antes só o golpe básico a aplicava
      // (lote G14: pelo `valor` do acerto — a da soma, a da Marca no alvo e a local do uso: o suporte Vida no Acerto)
      // (lote G20a: a do acerto do totem iria nele — não em você)
      const vidaNoAcerto = entry.poeGema?.ataque && !doTotem ? ModsPoe.valor(fichaDoAcerto, 'life_on_hit') : 0;
      const manaNoAcerto = entry.poeGema?.ataque && !doTotem ? ModsPoe.valor(fichaDoAcerto, 'mana_on_hit') : 0;
      if ((vidaNoAcerto > 0 || manaNoAcerto > 0) && (estado.hp ?? 0) > 0) Ficha.curar(estado, Math.round(vidaNoAcerto), Math.round(manaNoAcerto), eventos, personagem?.nome, hunt.pos);
      // O suporte Fúria: "Ganhe 3 de Fúria no Acerto com Ataques" (cada acerto do ataque suportado, como o "Fúria com Acertos" das peças).
      if (efeitoDaGema?.furiaNoAcerto > 0 && entry.poeGema?.ataque && !doTotem) ModsPoe.ganharFuria(hunt, efeitoDaGema.furiaNoAcerto, agora);
      // As afecções do PoE (só com ITENS_POE=1): o acerto entra com o elemento da skill; habilidade de ataque (golpe físico de perto/longe) é ataque.
      // As cargas do PoE no acerto da skill (crítico, não crítico, atordoou, Inimigo Único).
      // ("Acertos Corpo a Corpo contam como Mortes com Fúria" — o Rampage.)
      // (lote G20a: o Rampage e as cargas são do acerto SEU — o do totem não conta: CalcPerform.lua:264)
      if (!doTotem && !semAcertoDaGema && ModsPoe.valor(ficha, 'rampage_acerto_corpo') > 0 && Tags.tagsDaAcao(entry).includes('melee') && ModsPoe.contarRampage(estado, hunt, ficha, agora)) Ficha.invalidar(estado);
      // (lote S1, 26/10: + as cargas dos suportes — a Carga de Poder no Crítico e a de Tolerância ao Atordoar com um Acerto Corpo a Corpo —, somadas às da ficha neste acerto)
      const regrasDasCargasDoAcerto = cargasDoUsoS1(ficha.cargas, efeitoDaGema, Tags.tagsDaAcao(entry).includes('melee'));
      if (!doTotem && !semAcertoDaGema && CargasPoe.reageAoAcerto(regrasDasCargasDoAcerto)) {
        const corpoACorpo = Tags.tagsDaAcao(entry).includes('melee');
        if (CargasPoe.aoAcertar(estado, regrasDasCargasDoAcerto, bicho, { crit, corpoACorpo, atordoou: postosDaGema.includes('atordoado') || doAcerto.atordoou }).length) Ficha.invalidar(estado);
      }
      // (lote PR1, dono 20/10 — D2 do plano) o SIFÃO DE PODER: "X% de chance de receber uma Carga de Poder quando um Projétil Acertar um Inimigo Raro ou Único" —
      // sorteado por projétil que acerta (a Vaal: sempre); o acerto do totem não dá carga a você
      if (!doTotem && !semAcertoDaGema && cargaDoSifao > 0 && GemasPR1.raroOuUnico(bicho) && Math.random() * 100 < cargaDoSifao && CargasPoe.ganhar(estado, 'poder', ficha.cargas, 1)) Ficha.invalidar(estado);
      // (09/10) O DANO DEGENERATIVO da gema do PoE no alvo acertado: dano por segundo × a duração da habilidade, com o Multiplicador de Dano
      // Degenerativo (o geral e o do elemento), o "Dano Degenerativo aumentado", o aumentado do elemento e os suportes da gema (`fatorDaGema`).
      // A resistência do alvo vale em cada pulso; não rola crítico. Uma instância por gema: a mesma habilidade não acumula com ela mesma.
      // (O Vínculo Ancestral: sem dano por si só — `semDanoProprio`.)
      // (lote A1: o do Avanço Flamejante não vem no acerto — é o do SOLO ARDENTE do rastro, `tiqueDosSolosDoJogador`)
      // (lote A3b, dono 19/10: D5: o do Vórtice e da Geada Rastejante é o do CHÃO — `criarObjetosDoUso`, `tiqueDosObjetos`; da armadilha e da mina, segue no acerto)
      // (lote B2, dono 20/10: + o Ceifar Vaal e a Tormenta Flamejante Vaal — o degenerativo é o do chão deles, `GemasB2.degenNoChao`)
      if (entry.poeGema && !semDanoProprio && desloc?.solo !== 'ardente' && !(objetoDoUso?.tipo === 'chao' && GemasA3b.ehChao(entry.poeGema.slug)) && !GemasB2.degenNoChao(entry.poeGema.slug) && !(b3?.conflagracao && !plantada?.conflagracao)) {
        // (lote B3, dono 21/10 — D-B3.2: o da Conflagração é o da EXPLOSÃO da flecha presa — o PoB: FireDot na parte "Explosion" —, pela duração secundária de 4 s × a
        // Duração; o impacto não o põe)
        const dg = GemasPoe.degenerativoNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0);
        const dotMagico = !!dg?.partes?.length && GemasPoe.dotEhMagico(entry.poeGema.slug);
        // (lote A4, dono 19/10) o DEBUFF COM ESTÁGIOS no acertado (a Maré Invernal: +1 a cada Ativação; o Raio Abrasador: +1 a cada uso que o acerta): os estágios
        // dele (até o máximo, enquanto dura) multiplicam o degenerativo — "Debuff causa 20% mais Dano por Estágio", "Estágios Adicionais do Debuff
        // adicionam 80% de Dano" (após o primeiro) —, a duração é a do debuff ("Duração Base do Debuff é de 2 segundos"); no máximo do Raio
        // Abrasador, a Exposição a Fogo ("aplica −25% de Resistência a Fogo")
        const deb = dg?.partes?.length ? GemasPoe.debuffDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
        let fatorDoDebuff = 1;
        let duracaoDoDebuff = dg?.duracaoMs;
        if (plantada?.conflagracao && b3?.conflagracao) duracaoDoDebuff = Math.max(1, Math.round(b3.conflagracao.penalidadeMs * fatorDeDuracao(estado, entry, efeitoDaGema)));
        if (deb) {
          const tabela = ((bicho.estados ??= {}).poeEstagiosDoDebuff ??= {});
          const atual = tabela[entry.poeGema.slug]?.ate > agora ? tabela[entry.poeGema.slug] : null;
          const n = Math.min(deb.max, (atual?.n ?? 0) + 1);
          duracaoDoDebuff = deb.duracaoMs ? Math.round(deb.duracaoMs * fatorDeDuracao(estado, entry, efeitoDaGema)) : dg.duracaoMs;
          tabela[entry.poeGema.slug] = { n, ate: agora + duracaoDoDebuff };
          fatorDoDebuff = 1 + (deb.porEstagioPct * (deb.aposPrimeiro ? n - 1 : n)) / 100;
          // (lote A5, dono 20/10 — D10: pela função única, `ModsPoe.porExposicao` — a de uma Exposição já vencida não conta mais)
          if (deb.exposicaoPct && n >= deb.max && ModsPoe.porExposicao(bicho, 'fire', Math.abs(deb.exposicaoPct), duracaoDoDebuff, agora) && !doTotem) ModsPoe.marcar(hunt, 'infligiuExposicao');
        }
        // (lote G-C, D13) a RUÍNA aplica as maldições ligadas no inimigo do debuff e, por maldição aplicada, o debuff causa X% mais dano (o "mais" multiplica) e dura +100%
        // (a Ruína; somado ao "aumentado" da Duração) — a duração-base é a do PoB (`GemasGAC.RUINA`)
        if (ruinaDoUso && dg?.partes?.length) {
          if (ligadasDaRuina?.length) Reforcos.marcarCom(hunt, bicho, ligadasDaRuina, agora);
          const c = GemasGAC.ruinaComMaldicoes(ruinaDoUso, quantasDaRuina(ligadasDaRuina ?? []));
          fatorDoDebuff *= c.fatorDano;
          duracaoDoDebuff = Math.max(1, Math.round(ruinaDoUso.duracaoMs * fatorDeDuracao(estado, entry, efeitoDaGema, c.duracaoIncPct)));
        }
        // (revisão do C4, 21/10) o dano sofrido do atacante (o Definhado com o "Efeito do Definhamento aumentado", os "Inimigos … sofrem Dano aumentado") vale no pulso
        const sofridoDoAtacante = ModsPoe.sofridoDoAtacante(ficha.afPoe);
        const sofridoDoUso = sofridoDoAtacante ? { sofrido: sofridoDoAtacante } : {};
        for (const p of dg?.partes ?? []) {
          const tipoDegen = GemasPoe.DEGEN_DO_ELEMENTO[p.elemento];
          const total = totalDoDegenerativo(p, duracaoDoDebuff, { efeitoDaGema, ficha, fatorDaGema, soAcertoDaFicha, dotMagico }) * fatorDoDebuff;
          // (revisão B2, 21/10: o do Ceifar guarda QUEM o pôs — a Carga Sangrenta da morte é do dono — `aoMorrerB2`)
          const quemDoDot = !doTotem && /^Reap(_of_Butchery)?$/.test(entry.poeGema.slug) ? { quem: personagem?.nome ?? null } : {};
          const posto = Dot.aplicar(bicho, { tipo: tipoDegen, total, duracaoMs: duracaoDoDebuff, chave: entry.poeGema.slug, origem: { fonte: doTotem ? 'totem' : 'gema', habilidade: entry.id, ...quemDoDot, ...sofridoDoUso } }, agora);
          // (lote C4, dono 21/10 — D4.2) a Praga: o uso põe mais uma CAMADA (cada uma com a sua duração, até o máximo): o pulso é o de uma camada × as vivas
          if (c4?.praga && posto) {
            const d = (bicho.dots ?? []).find((x) => x.chave === entry.poeGema.slug && x.tipo === tipoDegen);
            const pulsoMs = Dot.CONFIG.tipos[tipoDegen]?.pulsoMs ?? 500;
            if (d) GemasC4.porCamada(d, { ate: agora + duracaoDoDebuff, max: c4.praga.max, porPulsoCamada: total / Math.max(1, Math.round(duracaoDoDebuff / pulsoMs)), pulsoMs, agora });
          }
          if (posto) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: posto });
          // (lote PR2, dono 20/10 — D2) o DRENAR ESSÊNCIA: o debuff da gema leva a % do dano dele que vira a sua Vida (ou a perda do Desespero) — cada pulso, em
          // cada debuff ativo, somados (`Dot.tique` → `drenoDosDebuffs`); o do totem, não (exceção 1)
          const dreno = posto && !doTotem ? GemasPoe.drenoDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
          if (dreno) for (const d of bicho.dots ?? []) if (d.chave === entry.poeGema.slug && d.tipo === tipoDegen) d.dreno = dreno;
        }
        // (lote B2, dono 20/10 — D-B2.5) o Contágio marca o degenerativo dele: espalha na morte (ou no acerto, o da Transferência) — `espalharContagio`
        if (b2?.contagio && dg?.partes?.length) for (const d of bicho.dots ?? []) if (d.chave === entry.poeGema.slug && d.falta > 0) d.contagio = { ...b2.contagio, raio: raioDoContagio };
        // (lote S1, 26/10) a PODRIDÃO da Decadência: o degenerativo de Caos no acertado pela duração dela (8 s), pela conta do degenerativo do uso; uma por inimigo
        if (efeitoDaGema?.podridaoPorS > 0 && !semAcertoDaGema) {
          const durPodridao = efeitoDaGema.podridaoMs ?? 8000;
          const totalPodridao = totalDoDegenerativo({ elemento: 'chaos', dps: efeitoDaGema.podridaoPorS }, durPodridao, { efeitoDaGema, ficha, fatorDaGema, soAcertoDaFicha });
          const postoPodridao = Dot.aplicar(bicho, { tipo: 'degenCaos', total: totalPodridao, duracaoMs: durPodridao, chave: 'podridao', origem: { fonte: doTotem ? 'totem' : 'gema', habilidade: entry.id, ...sofridoDoUso } }, agora);
          if (postoPodridao) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: postoPodridao });
        }
      }
      if (ficha.afeccoes) {
        const tagsDoAcerto = Tags.tagsDaAcao(entry);
        const ataque = entry.poeGema ? !!entry.poeGema.ataque : tagsDoAcerto.includes('physical') && (tagsDoAcerto.includes('melee') || tagsDoAcerto.includes('ranged'));
        // A gema do PoE soma as chances dela (incendiar, congelar, eletrizar, envenenar, sangrar) no nível em que está.
        // (lote C4, dono 21/10: + as regras do Veneno da gema — a Víbora da Mamba, o Golpe Pestilento — `GemasC4.comOVenenoDaGema`)
        const afeccoes = entry.poeGema ? GemasC4.comOVenenoDaGema(GemasPoe.afeccoesComAGema(ficha.afeccoes, entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0), c4?.veneno) : ficha.afeccoes;
        // (o Golpe Impiedoso: "X% mais Dano com Afecções causadas por Acertos Corpo a Corpo")
        // (17/10, lote G17) O DANO das afecções (Incêndio, Sangramento, Veneno) sai do acerto SEM o "mais/menos Dano com Acertos" dos suportes (as
        // Afecções Mortais: 80% menos no acerto, a afecção inteira) e COM o "mais Dano de Afecções" e o de cada uma — `fatoresDoDano`. A força das
        // não danificadoras (Eletrização, Resfriamento, Congelamento) segue o dano do acerto, como no PoE.
        const maisNaAfeccao = (impiedoso ? 1 + (efeitoDaGema.impiedosoMaisAfeccaoPct ?? 0) / 100 : 1) * (enfeiticadoAntes ? 1 + detonacaoDoUso.maisAfeccaoPct / 100 : 1);
        // (lote G18: × o da própria gema — "60 % menos Dano de Afecções", "49 % mais Dano com Sangramento")
        const daGemaAf0 = entry.poeGema ? GemasPoe.maisNasAfeccoesDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
        // (lote C3, dono 25/10) "X% mais Dano com Sangramento enquanto na Postura de Sangue" (a Dilaceração, a Tempestade de Lâminas — o PoB: active_skill_bleeding_damage_
        // +%_final_in_blood_stance): soma ao "mais" do Sangramento da gema, só na de Sangue
        const naSangue = c3?.sangramentoNaSanguePct && ModsPoe.posturaDe(hunt, agora) === 'sangue' ? c3.sangramentoNaSanguePct : 0;
        const daGemaAf = naSangue && daGemaAf0 ? { ...daGemaAf0, maisSangramentoPct: (daGemaAf0.maisSangramentoPct ?? 0) + naSangue } : daGemaAf0;
        const m = (k) => Math.max(0, 1 + (efeitoDaGema?.[k] ?? 0) / 100) * Math.max(0, 1 + (daGemaAf?.[k] ?? 0) / 100);
        const fatoresDoDano = {
          todas: (maisNaAfeccao * m('maisAfeccaoPct') * m('maisDotPct')) / soNoAcerto,
          incendio: m('maisIncendioPct') * m('maisDotFogoPct'),
          sangramento: m('maisSangramentoPct') * m('maisDotFisicoPct'),
          veneno: m('maisVenenoPct') * m('maisDotCaosPct'),
        };
        const partesDaAfeccao = pedacos ?? [{ elemento: tipo, dano: bruto }];
        // (PoE, a Força Concussiva: "Incêndios de Acertos Corpo a Corpo Atordoantes causam X% mais Dano" — o acerto corpo a corpo que atordoou: pelo
        // suporte, pelo Golpe Impiedoso ou pelo atordoamento do PoE)
        const atordoouAgora = postosDaGema.includes('atordoado') || !!doAcerto?.atordoou || !!doSuporte?.atordoou;
        const incendioAtordoante = atordoouAgora && tagsPoeDaSkill(entry).includes('corpo') ? ModsPoe.valor(ficha, 'incendio_atordoante_mais') : 0;
        const comIncendio = incendioAtordoante ? { ...afeccoes, incendioMais: (afeccoes.incendioMais ?? 0) + incendioAtordoante } : afeccoes;
        // (+ lote 76: as chances de Incendiar, Envenenar e Sangrar que o suporte ainda dê como estado do Draevor — `chanceDoSuporte` — vão para a conta do PoE)
        const comCongelar = congelarDoSuporte || Object.values(chanceDoSuporte ?? {}).some((v) => v > 0)
          ? { ...comIncendio, chance: { ...(comIncendio.chance ?? {}), congelamento: (comIncendio.chance?.congelamento ?? 0) + congelarDoSuporte, incendio: (comIncendio.chance?.incendio ?? 0) + (chanceDoSuporte?.incendio ?? 0), veneno: (comIncendio.chance?.veneno ?? 0) + (chanceDoSuporte?.veneno ?? 0), sangramento: (comIncendio.chance?.sangramento ?? 0) + (chanceDoSuporte?.sangramento ?? 0) } }
          : comIncendio;
        // (lote G18: a onda final do Incinerar "sempre Incendeia")
        const comOnda0 = estagioDoUso?.sempreIncendeia ? { ...comCongelar, chance: { ...(comCongelar.chance ?? {}), incendio: (comCongelar.chance?.incendio ?? 0) + 100 } } : comCongelar;
        // (lote C3, dono 25/10) a Tempestade de Lâminas de Sangue Sangra (o PoB: BleedChance 100 na parte da tempestade, em Postura de Sangue — `pulsarObjeto`)
        const comOnda = plantada?.sangraSempre ? { ...comOnda0, chance: { ...(comOnda0.chance ?? {}), sangramento: (comOnda0.chance?.sangramento ?? 0) + 100 } } : comOnda0;
        // (lote G18b: o que o ALVO dá às afecções deste acerto — a maldição nele: "Acertos contra Inimigos Amaldiçoados têm X% de chance de
        // Incendiar…", a duração no amaldiçoado; os mods "contra Inimigos X" — `ModsPoe.golpeNoAlvo` → `extrasDoAlvo`)
        const ex = noAlvo ? fichaNoAlvo.extrasDoAlvo ?? null : null;
        const doAlvoAf = ex && Object.keys(ex).some((k) => /^(chance_|duracao_)/.test(k)) ? AfeccoesPoe.daSoma(ex) : null;
        const afeccoesDoAcerto = doAlvoAf
          ? {
            ...comOnda,
            chance: Object.fromEntries([...new Set([...Object.keys(comOnda.chance ?? {}), ...Object.keys(doAlvoAf.chance)])].map((k) => [k, (comOnda.chance?.[k] ?? 0) + (doAlvoAf.chance[k] ?? 0)])),
            duracaoIncendio: (comOnda.duracaoIncendio ?? 0) + doAlvoAf.duracaoIncendio, duracaoCongelamento: (comOnda.duracaoCongelamento ?? 0) + doAlvoAf.duracaoCongelamento,
            duracaoEletrizacao: (comOnda.duracaoEletrizacao ?? 0) + doAlvoAf.duracaoEletrizacao, duracaoSangramento: (comOnda.duracaoSangramento ?? 0) + doAlvoAf.duracaoSangramento,
          }
          : comOnda;
        // (a Sobrecarga Elemental: "Afecções nunca contam como sendo de um Golpe Crítico")
        // (lote A1b, dono 19/10) "Não pode infligir Resfriamento" (o Teleporte Gélido da Explosão Invernal); "X% de chance de Causticar Inimigos" (D-f)
        const afeccoesDoUso = daExplosaoInvernal?.naoResfria || chanceDeCausticar > 0
          ? { ...afeccoesDoAcerto, ...(daExplosaoInvernal?.naoResfria ? { naoPode: { ...(afeccoesDoAcerto.naoPode ?? {}), resfriamento: true } } : {}), ...(chanceDeCausticar > 0 ? { chanceCausticar: (afeccoesDoAcerto.chanceCausticar ?? 0) + chanceDeCausticar } : {}) }
          : afeccoesDoAcerto;
        const envenenadoAntes = (bicho.dots ?? []).some((d) => (d.tipo === 'venenoPoe' || d.tipo === 'veneno') && d.falta > 0);
        const postos = AfeccoesPoe.aoAcertar(bicho, partesDaAfeccao, { afeccoes: b2?.chicote?.naoIncendeia ? { ...afeccoesDoUso, naoPode: { ...(afeccoesDoUso.naoPode ?? {}), incendio: true } } : afeccoesDoUso, praga: pragaDoAcerto(hunt), crit: crit && !ficha.sobrecargaElemental, ataque, agora, salaDeBoss: !!hunt.isBoss, fatoresDoDano, fonte: doTotem ? 'totem' : 'poe', aoPor: doTotem ? null : ModsPoe.refletorDeAfeccoes(hunt, ficha), sofrido: ModsPoe.sofridoDoAtacante(ficha.afPoe) });
        for (const st of postos) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: st });
        // (lote B4, dono 25/10) o CAMPO GALVÂNICO: Eletrizar um inimigo com o buff ativo cria o campo nele (`campoGalvanicoAoEletrizar`)
        if (!doTotem && postos.includes('eletrizado') && hunt.buffs) campoGalvanicoAoEletrizar(estado, hunt, bicho, agora);
        // (14/10, o Avatar da Selva: a Fúria Liberta pelas Afecções Elementais que o acerto pôs)
        if (!doTotem) ModsPoe.ganharFuriaLiberta(estado, hunt, ficha.afPoe, postos, agora);
        ModsPoe.aoPorAfeccoes(estado, hunt, bicho, ficha, postos, { eventos, personagem, deTotem: doTotem });
        // (lote S1, 26/10) a Proliferação (Elemental, de Incêndio) e a Dose Letal: as afecções que este acerto pôs (`aposAfeccoesS1`)
        if (efeitoDaGema) aposAfeccoesS1(hunt, bicho, postos, efeitoDaGema, eventos, agora, envenenadoAntes, entry.id);
        // (decisão do dono, 20/10) o Chicote Ardente da Combustão: Incendiar cria o Solo Ardente sob o Incendiado (`soloDoChicoteArdente`)
        if (b2?.chicote?.solo?.aoIncendiar && postos.includes('queimando')) soloDoChicoteArdente(estado, hunt, entry, efeitoDaGema, b2.chicote.solo, bicho, agora, doTotem ? 'totem' : 'voce');
        // (lote G-C, D12) a Marca do Alquimista: o acerto que Incendeia / Envenena o marcado cria o Solo Ardente / Cáustico sob ele (`soloDaAlquimista`)
        if (postos.includes('queimando') || postos.includes('envenenado')) soloDaAlquimista(hunt, bicho, postos, agora, doTotem ? 'totem' : 'voce');
        // (lote 73, a Cutilada Perigosa: o Sangramento das afecções do PoE ou o da gema de suporte — `postosDaGema`)
        ModsPoe.empalamentoComSangramento(bicho, ficha, postos.includes('sangrando') || postosDaGema.includes('sangrando'));
      }
      // (lote A1b, dono 19/10) "Remove Resfriamentos após Causar Dano" (o Teleporte Gélido da Explosão Invernal)
      if (daExplosaoInvernal?.tiraResfriamento && dano > 0 && bicho.estados?.lento) delete bicho.estados.lento;
      // (lote A1b, dono 19/10) o Golpe Súbito: "15% de chance de receber uma Carga de Frenesi ao Acertar"; o do Poder: "30% de chance de ganhar uma Carga de
      // Poder em Acertos Críticos"
      if (cargasDoAcerto?.frenesiNoAcertoPct > 0 && Math.random() * 100 < cargasDoAcerto.frenesiNoAcertoPct && CargasPoe.ganhar(estado, 'frenesi', ficha.afPoe ?? {})) Ficha.invalidar(estado);
      if (crit && cargasDoAcerto?.poderNoCriticoPct > 0 && Math.random() * 100 < cargasDoAcerto.poderNoCriticoPct && CargasPoe.ganhar(estado, 'poder', ficha.afPoe ?? {})) Ficha.invalidar(estado);
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
    // (lote A4, dono 19/10: D7: o cone do Tiro Gélido no raio da gema — o padrão de 2,4 m na Vaal, que não publica —, em casas, aberto pelo ângulo da qualidade)
    const coneDoTiro = itensPoeLigado() && entry.poeGema && GemasA4.temConeDoTiroGelido(entry.poeGema.slug) && !casas ? (() => {
      const raioM = GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? GemasA4.CONE_DO_TIRO_GELIDO.raioPadraoM;
      const r = Math.max(1, casasDoRaio(raioM * Math.sqrt(ModsPoe.fatorDaArea(efeitoDaGema?.areaIncPct ?? 0, efeitoDaGema?.areaMaisPct ?? 0))));
      const ang = GemasA4.anguloNoUso(GemasPoe.anguloDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0));
      return Areas.abrirForma(Areas.escalarForma(GemasA4.CONE_DO_TIRO_GELIDO.forma, r), 1 + ang / 100);
    })() : null;
    // (lote PR1, dono 20/10) o CONE da Flecha Galvânica: sai de você na direção do alvo, no raio da gema (2,8 m + a qualidade) × √ da Área de Efeito, com os
    // aumentos e reduções da Velocidade de Projéteis (a ficha, a gema e os suportes — o "aumentado", não o "mais") somados à Área aumentada
    const coneGalvanico = itensPoeLigado() && entry.poeGema && GemasPR1.temConeGalvanico(entry.poeGema.slug) && !casas && alvo ? (() => {
      const raioM = GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? GemasPR1.CONE_GALVANICO.raioPadraoM;
      const m = GemasPR1.metrosDoConeGalvanico(raioM, efeitoDaGema?.areaIncPct ?? 0, velocidadeDoProjetil(estado, entry, efeitoDaGema).incPct, efeitoDaGema?.areaMaisPct ?? 0);
      return Areas.escalarForma(GemasA4.CONE_DO_TIRO_GELIDO.forma, Math.max(1, casasDoRaio(m)));
    })() : null;
    // (revisão do PR1) o cone da Flecha Galvânica do Surto: atrás do alvo, em cada impacto de flecha (como o do Tiro Gélido), no raio da gema × √ da Área
    const coneDoSurto = itensPoeLigado() && entry.poeGema && GemasPR1.temConeAtrasDoAlvo(entry.poeGema.slug) && !casas ? (() => {
      const raioM = GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? GemasPR1.CONE_GALVANICO.raioPadraoM;
      return Areas.escalarForma(GemasA4.CONE_DO_TIRO_GELIDO.forma, Math.max(1, casasDoRaio(raioM * Math.sqrt(ModsPoe.fatorDaArea(efeitoDaGema?.areaIncPct ?? 0, efeitoDaGema?.areaMaisPct ?? 0)))));
    })() : null;
    // (lote A3c, dono 19/10: "Fazer como o PoE") a ÁREA NO IMPACTO do projétil da gema com raio-base no PoB — `areaNoImpactoDoUso`, sorteada uma
    // vez no uso. (revisão do A3c: também no Totem de Magia e na Balista — no PoE o projétil lançado pelo totem explode igual)
    const areaNoImpacto = !casas ? areaNoImpactoDoUso(entry, efeitoDaGema, intensidade) : null;
    // (lote PR3, dono 21/10) as explosões da Explosão Cinética — `cineticaDoUso`, sorteadas uma vez no uso
    const cineticaNoUso = !casas ? cineticaDoUso(entry, efeitoDaGema, intensidade) : null;
    // (lote C1, dono 20/10) os acertos da gema em cada inimigo do uso (a Tormenta de Espadas: 8)
    const golpesPorAlvo = Math.max(1, c1?.golpesPorAlvo ?? 1);
    // (revisão do C1) o raio do Castigo do Julgamento Divino sem o corpo a corpo da ficha: a razão do dano médio do uso sem a tag `corpo` (e sem a Força no Físico
    // corpo a corpo) pelo dele com ela — os "aumentado/mais Dano Corpo a Corpo" das peças, da árvore e dos suportes não valem no raio (melee = false no PoB)
    let fatorDoRaio = null;
    const fatorDoRaioSemCorpo = () => {
      if (fatorDoRaio != null) return fatorDoRaio;
      const media = (k) => (k.partes ? k.partes.reduce((t, p) => t + ((p.min + p.max) / 2) * p.mult, 0) : ((k.min + k.max) / 2) * k.mult) * (k.soAcertoDaFicha ?? 1);
      const com = media(contaDoDano(estado, entry, efeitoDaGema, mao?.ficha ?? fichaDaGema, mao?.arma ?? null));
      const sem = media(contaDoDano(estado, entry, efeitoDaGema, mao?.ficha ?? fichaDaGema, mao?.arma ?? null, { semCorpo: true }));
      fatorDoRaio = com > 0 && Number.isFinite(sem / com) ? Math.max(0, sem / com) : 1;
      return fatorDoRaio;
    };
    const atacar = (segundo) => {
      // (lote A5b) os acertados DESTE passe
      acertadosNoPasse = new Set();
      // (lote G10: o uso que só CARREGA estágios — a Rajada de Chamas, a Flecha Flagelante antes do máximo — não acerta ninguém)
      // (lote A4, dono 19/10: o uso de carga da Ira Divina acerta os inimigos perto — `zapsDaIra`)
      // (lote A3b: + o uso que só deixa o objeto — a bola, o tornado, a espiral, o olho: o dano é o dele, no tique)
      if ((estagioDoUso?.soCarrega && !zapsDaIra) || semGolpeDireto || atirarSuportadas || objetoDoUso?.semAcerto) return;
      // "X% mais Dano por cada Ricochete restante" (Arco): o 1º atingido tem todos os ricochetes pela frente; cada salto gasta um.
      const cp = efeitoDaGema?.cadeiaPoe;
      // (lote G11: a sequência de áreas — cada área e cada Onda de Choque é um acerto, com o "menos Dano" da Onda de Choque)
      // (lote A4, dono 19/10: + o "aumento da Chance de Acerto Crítico" de cada rajada das Saraivadas — `critIncPct` do golpe)
      if (golpesDaSequencia) { for (const g of golpesDaSequencia) if (g.bicho.hp > 0 || !segundo) acertar(g.bicho, g.pct, g.choque ? 'choque' : null, g.critIncPct ? { critIncPct: g.critIncPct } : null); }
      // (lote A3, D3: o Arremesso Espectral da Materialização não acerta na ida — o golpe é o da volta, `Secundarios.resolver`)
      // (lote A1b, dono 19/10: × o % do uso — a miragem parada, a onda final)
      // (lote C1, dono 20/10: × os acertos da gema em cada inimigo — a Tormenta de Espadas, "Causa Dano nos Inimigos 8 vezes": swordstorm_num_hits do PoB)
      else if (!projeteisAleatorios() && !soNaVolta()) atingidos.forEach((bicho, i) => { for (let k = 0; k < golpesPorAlvo + (duasOndas?.has(bicho) ? 1 : 0); k++) if ((!segundo && !k) || bicho.hp > 0) acertar(bicho, ((cp?.pct ? 100 * (1 + (cp.pct * Math.max(0, cp.saltos - i)) / 100) : !casas && i === 0 && efeitoDaGema?.pctPorRicocheteRestante ? 100 * (1 + (efeitoDaGema.pctPorRicocheteRestante * Math.max(0, efeitoDaGema.encadear ?? 0)) / 100) : 100) * escalaDoUso) / 100); });
      // (lote C1, dono 20/10 — D1.4) o raio do Castigo do Julgamento Divino nos alvos dele, com o "mais Dano em Área" (a parte "Area Hit" do PoB)
      // (revisão do C1: + a ÁREA em volta de cada alvo do raio — cada inimigo leva o acerto do raio uma vez só, e quem o golpe corpo a corpo pegou não leva: "Cada alvo
      // só pode ser acertado uma vez por esta habilidade"; o acerto do raio não é corpo a corpo — `fatorDoRaioSemCorpo`, e o `naoCorpo` do `acertar`)
      if (raiosDoCastigo?.length) {
        const jaDoRaio = new Set(atingidos);
        const pctDoRaio = 100 * (1 + (c1.raioDoCastigo.maisAreaPct ?? 0) / 100) * fatorDoRaioSemCorpo();
        for (const b of raiosDoCastigo) {
          if (!(b.hp > 0)) continue;
          const cs = Areas.quadrado({ x: b.x, y: b.y }, raiosDoCastigo.casas ?? 0);
          if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x: b.x, y: b.y, casas: Areas.paraTela(cs, b) });
          for (const m of [b, ...Areas.dentro(cs, vivos).filter((m) => m !== b)]) if (m.hp > 0 && !jaDoRaio.has(m)) { jaDoRaio.add(m); acertar(m, pctDoRaio, 'raio'); }
        }
      }
      // (lote C1, dono 20/10 — D1.3) o Escudo de Luz: do primeiro atingido (o mais perto de você entre os acertados), as ondas dos aliados — a party e os seus lacaios a
      // até 4 m (2 casas) dele, os mais perto primeiro, até o máximo —, cada uma a mesma onda do uso saindo do aliado na direção dele
      if (c1?.escudosDeLuz && casas && formaNoUso && !segundo) {
        const primeiro = atingidos.filter(acertouNoPasse).sort((a, b) => distanciaChebyshev({ x, y }, a) - distanciaChebyshev({ x, y }, b))[0];
        if (primeiro) {
          const raio = casasDoRaio(c1.escudosDeLuz.raioM);
          const aliados = [...aliadosPorCasa(hunt).values()].map((h) => h.pos).concat((hunt.lacaios ?? []).filter((l) => l.hp > 0 && (l.z ?? hunt.z ?? 0) === (hunt.z ?? 0)))
            .filter((a) => a && distanciaChebyshev(a, primeiro) <= raio && (a.x !== primeiro.x || a.y !== primeiro.y)).sort((a, b) => distanciaChebyshev(a, primeiro) - distanciaChebyshev(b, primeiro)).slice(0, c1.escudosDeLuz.max);
          const r = casas.reduce((m, c) => Math.max(m, Math.abs(c.x - formaNoUso.x), Math.abs(c.y - formaNoUso.y)), 0);
          const forma = Areas.escalarForma(entry.forma, Math.max(1, r));
          for (const a of aliados) {
            const cs = Areas.daForma(forma, { x: a.x, y: a.y }, ordemDosLados(a, primeiro)[0]);
            if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x: a.x, y: a.y, casas: Areas.paraTela(cs, a) });
            for (const m of Areas.dentro(cs, vivos)) if (m.hp > 0) acertar(m, 100, 'onda');
          }
        }
      }
      // (17/10, lote G18b) a Flecha Relampejante: "Acerta até N inimigos adicionais próximos ao alvo" — os até N vivos a 1 casa de cada atingido
      if (efeitoDaGema?.proximosDoAlvo > 0) {
        const ja = new Set(atingidos);
        // (lote A5b: só em volta de quem o golpe acertou)
        for (const centro of atingidos.filter(acertouNoPasse)) {
          for (const m of vivos.filter((b) => b.hp > 0 && !ja.has(b) && Math.max(Math.abs(b.x - centro.x), Math.abs(b.y - centro.y)) <= 1).slice(0, efeitoDaGema.proximosDoAlvo)) { ja.add(m); acertar(m, 100, 'proximo'); }
        }
      }
      // (PoE, a Fúria Tribal: "Habilidades de Golpe Corpo a Corpo causam Dano Propagado aos alvos ao redor" — os vivos a 1 casa de cada atingido.)
      if (propagaGolpe || propagaDoSuporte) {
        const ja = new Set(atingidos);
        const pct = propagaDoSuporte ? Math.max(0, 100 + (efeitoDaGema.propagaMaisPct ?? 0)) : 100;
        const raio = propagaDoSuporte ? 1 + ModsPoe.casasPelaArea(1, ModsPoe.fatorDaArea(efeitoDaGema.areaIncPct ?? 0, efeitoDaGema.areaMaisPct ?? 0, efeitoDaGema.propagaAreaMaisPct ?? 0)) : 1;
        // (lote A5b: o Dano Propagado sai do acerto — não em volta de quem o golpe errou)
        for (const b of atingidos.filter(acertouNoPasse)) for (const m of vivos) if (m.hp > 0 && !ja.has(m) && Math.max(Math.abs(m.x - b.x), Math.abs(m.y - b.y)) <= raio) { ja.add(m); acertar(m, pct, 'propagado'); }
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
        // (lote A3c) a área no impacto do projétil
        areaNoImpacto,
        // (lote PR3) as explosões da Explosão Cinética
        cinetica: cineticaNoUso,
        // (lote G-C) a divisão do projétil que acerta o marcado pela Marca do Atirador
        divisaoNoAlvo: deProjetil ? (b) => GemasGAC.divisaoDaMarca(b, agora) : null,
      });
      // (lote A3b, dono 19/10) os projéteis que saíram do uso (o primeiro passe): o marcador do Disparo Congelante, a captura da Espiral Venenosa, a
      // Lâmina Persistente das Facas Etéreas (D8: 1 a cada N facas, onde a faca parou), o Tornado que os absorve (D7)
      if (!segundo) {
        emitidosDoUso.push(...emitidos);
        if (objetoDoUso?.tipo === 'laminas' && objetoDoUso.por === 'faca') emitidos.forEach((p, k) => { if ((k + 1) % Math.max(1, objetoDoUso.cada) === 0) (laminasDoUso ??= []).push({ x: p.para.x, y: p.para.y }); });
      }
      // A EMISSÃO na tela: cada projétil do total da skill sai de quem lança (o principal já saiu, acima) — o que acerta e o que erra,
      // mesmo que o bicho dele morra antes. (Nas direções aleatórias, todos — o principal não saiu no alvo.)
      if (entry.projetil) for (const p of emitidos.slice(alvo && !casas && !projeteisAleatorios() ? 1 : 0)) eventos.push({ t: 'shot', id: entry.projetil, x: p.de.x, y: p.de.y, tx: p.para.x, ty: p.para.y, ...(velDoTiro !== 1 ? { vel: velDoTiro } : {}) });
      // A explosão na tela: UM evento por detonação (o cliente desenha o quadrado inteiro).
      for (const ex of explosoes) eventos.push({ t: 'explosao', id: entry.efeito || EFEITO_DA_EXPLOSAO, x: ex.x, y: ex.y, lado: ex.lado });
      for (const s of golpes) {
        if (s.bicho.hp <= 0) continue;
        // (o 1º voo de cada projétil já foi desenhado na emissão; aqui, os saltos: perfuração, bifurcação, encadeamento, retorno)
        // (lote A3c: o acerto da área no impacto não é um voo)
        if (s.tipo !== 'explosao' && s.tipo !== 'projetil' && s.tipo !== 'impacto' && entry.projetil) eventos.push({ t: 'shot', id: entry.projetil, x: s.de.x, y: s.de.y, tx: s.bicho.x, ty: s.bicho.y, ...(velDoTiro !== 1 ? { vel: velDoTiro } : {}) });
        acertar(s.bicho, s.pct, s.tipo, s);
      }
      // (lote PR3) as áreas da espiral do Pacto de Beidat: um acerto em cada um de cada área
      if (golpesDoPacto) for (const g of golpesDoPacto) { if (g.evento) { if (!segundo) eventos.push(g.evento); } else if (g.bicho.hp > 0) acertar(g.bicho, 100, 'pacto'); }
      // (lote PR4, dono 25/10) o que gruda nos alvos finais das flechas, a concha no primeiro acertado de cada projétil, a energia estática e os Relâmpagos
      // Concentrados do ataque que acertou (`aposOPasseDoPR4`)
      if (pr4DoUso) aposOPasseDoPR4(estado, hunt, personagem, pr4DoUso, { diretos: !casas && !projeteisAleatorios() && !soNaVolta() ? atingidos : [], golpes, acertou: acertouNoPasse, agora });
      // (lote A4, dono 19/10: D7) o CONE do Tiro Gélido: em cada impacto da flecha (o alvo direto e os dos projéteis — a perfuração, a difusão…), o
      // cone sai do acertado na direção do tiro, no raio da gema, aberto pelo "Ângulo do Efeito em Área aumentado"; os do cone levam um acerto com
      // todo o Físico como Gelo (os +40% de conversão do PoB); o acertado não leva o do próprio cone
      if (coneDoTiro) {
        // (lote A5b: o cone sai do impacto que acertou)
        const impactos = [...(!casas && !projeteisAleatorios() && !soNaVolta() ? atingidos : []), ...golpes.filter((g) => FONTES_DE_PROJETIL.has(g.tipo)).map((g) => g.bicho)].filter(acertouNoPasse);
        // (revisão do A4: o da Penetração — dois cones perpendiculares ao tiro, um de cada lado do alvo)
        const perpendiculares = GemasA4.conesPerpendiculares(entry.poeGema.slug);
        for (const b of impactos) {
          const d = ordemDosLados({ x, y }, b)[0];
          for (const dir of perpendiculares ? [(d + 1) % 4, (d + 3) % 4] : [d]) {
            const cs = Areas.daForma(coneDoTiro, { x: b.x, y: b.y }, dir);
            for (const m of Areas.dentro(cs, vivos)) if (m !== b && m.hp > 0) acertar(m, 100, 'cone', { fisicoParaGelo: true });
            if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x: b.x, y: b.y, casas: Areas.paraTela(cs, b) });
          }
        }
      }
      // (revisão do PR1) o cone do Surto: sai de cada acertado pela flecha, na direção do tiro; o acertado não leva o do próprio cone
      if (coneDoSurto) {
        const impactos = [...(!casas && !projeteisAleatorios() && !soNaVolta() ? atingidos : []), ...golpes.filter((g) => FONTES_DE_PROJETIL.has(g.tipo)).map((g) => g.bicho)].filter(acertouNoPasse);
        for (const b of impactos) {
          const cs = Areas.daForma(coneDoSurto, { x: b.x, y: b.y }, ordemDosLados({ x, y }, b)[0]);
          for (const m of Areas.dentro(cs, vivos)) if (m !== b && m.hp > 0) acertar(m, 100, 'cone');
          if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x: b.x, y: b.y, casas: Areas.paraTela(cs, b) });
        }
      }
      // (lote PR1) o cone da Galvânica: cada um no cone leva o acerto dele (o alvo também — a flecha e o cone são acertos à parte, como as duas partes do PoB)
      if (coneGalvanico) {
        const cs = Areas.daForma(coneGalvanico, { x, y }, ordemDosLados({ x, y }, alvo)[0]);
        for (const m of Areas.dentro(cs, vivos)) if (m.hp > 0) acertar(m, 100 * escalaDoUso / 100, 'cone');
        if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x, y, casas: Areas.paraTela(cs, { x, y }) });
      }
      // (lote B2, dono 20/10 — D-B2.3) o Golpe Infernal: o debuff que chegou a 6 cargas neste passe explode NA HORA — 66% × 6 = 396% do acerto (o PoB: o "mais" de
      // (−100 + X) + X × (cargas − 1)) — em volta dele, no raio da explosão (1,8 m × √ da Área); quem a explosão acerta leva o debuff descarregado
      if (explodemNoPasse.length) {
        const pctX = GemasB2.pctDaExplosaoInfernal(infernalDoUso.porCargaPct, infernalDoUso.maxCargas);
        for (const b of explodemNoPasse.splice(0)) {
          // (revisão B2, 21/10) só explode quem ainda está CARREGADO: o que já explodiu (neste passe ou numa repetição) não explode de novo
          const meu = infernalDe(b, personagem?.nome ?? null);
          if (!meu?.carregado) continue;
          tirarInfernal(b, meu);
          eventos.push({ t: 'explosao', id: entry.efeito || EFEITO_DA_EXPLOSAO, x: b.x, y: b.y, lado: 2 * raioInfernal + 1 });
          for (const m of vivos) if (m.hp > 0 && distanciaChebyshev(m, b) <= raioInfernal) acertar(m, pctX, 'explosaoInfernal');
        }
      }
      // (decisão do dono, 20/10) a Explosão Voltáxica: quem a explosão matou explode — 10% da Vida máxima como Raio, no raio da própria nova (2,5 m × √ da Área)
      if (mortosDaVoltaxica.length) {
        const raioM = GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? 2.5;
        eventos.push(...explodirCadaveres(estado, hunt, entry, efeitoDaGema, { pct: b2.cadaverVoltaxicoPct, raioExplosaoM: raioM, elemento: 'energy', tags: ['magia', 'area', 'raio'] }, mortosDaVoltaxica.splice(0).map((b) => ({ x: b.x, y: b.y, z: b.z ?? hunt.z ?? 0, maxHp: b.maxHp ?? 0 })), ficha, agora));
      }
      // (lote B2, dono 20/10) a CHAMA PURIFICADORA: o Solo Sagrado no local mirado — o raio do acerto inicial + "X metros ao raio do Solo Sagrado", × √ da Área —, pela
      // duração (× a Duração); depois a Onda de Choque (5 m × √ da Área, o PoB: radiusSecondary 50) acerta quem está sobre um Solo Sagrado e ainda não foi acertado
      // neste passe, com o "mais/menos" dela (sanctify_wave_damage_+%_final: no acerto e nas afecções)
      if (b2?.purificadora && casas && formaNoUso && plantada?.tipo !== 'objeto') {
        const fatorA = ModsPoe.fatorDaArea(efeitoDaGema?.areaIncPct ?? 0, efeitoDaGema?.areaMaisPct ?? 0);
        const raioInicialM = GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? 1.8;
        criarSoloSagrado(hunt, (b2.purificadora.duracaoMs / 1000) * fatorDeDuracao(estado, entry, efeitoDaGema), agora, { x: formaNoUso.x, y: formaNoUso.y, raio: Math.max(0, casasDoRaio((raioInicialM + b2.purificadora.sagradoExtraM) * Math.sqrt(fatorA))), fonte: entry.poeGema.slug });
        const ro = Math.max(1, casasDoRaio(b2.purificadora.ondaRaioM * Math.sqrt(fatorA)));
        const ja = new Set(atingidos);
        const sagrados = (hunt.solosSagrados ?? []).filter((sg) => sg.ate > agora);
        const naOnda = vivos.filter((m) => m.hp > 0 && !ja.has(m) && distanciaChebyshev(m, formaNoUso) <= ro && sagrados.some((sg) => distanciaChebyshev(m, sg) <= sg.raio));
        if (naOnda.length && entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x: formaNoUso.x, y: formaNoUso.y, casas: Areas.paraTela(Areas.quadrado(formaNoUso, ro), formaNoUso) });
        for (const m of naOnda) acertar(m, Math.max(0, 100 + b2.purificadora.ondaMaisPct), 'onda');
      }
    };
    /*
     * (lote C2, dono 20/10) as ÁREAS A MAIS do passe (o uso e cada repetição — cada uma é um ataque no PoE), depois do golpe: o pulso do Esmagar Ossos (D2.2), os
     * martelos dos lados e as cascatas dos Martelos Sagrados (D2.5), o ramo da fissura do Golpe Tectônico (D2.4), a explosão da Imolação com 6 cargas e as correntes
     * da Corrente com Gancho de Trarthus (D2.7). `areaDoC2`: um acerto em cada vivo das casas `cs`, com `pct`% do golpe; devolve se acertou alguém.
     */
    const areaDoC2 = (cs, centro, pct, fonte) => {
      if (!cs?.length) return false;
      if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x: centro.x, y: centro.y, casas: Areas.paraTela(cs, centro) });
      const antes = atingidos;
      const escalaAntes = escalaDoUso;
      atingidos = Areas.dentro(cs, vivos.filter((b) => b.hp > 0));
      escalaDoUso = pct;
      passeC2 = fonte;
      let acertou = false;
      if (atingidos.length) { atacar(true); acertou = atingidos.some(acertouNoPasse); }
      passeC2 = null;
      atingidos = antes;
      escalaDoUso = escalaAntes;
      return acertou;
    };
    const fatorDaAreaDoUso = (incExtra = 0) => ModsPoe.fatorDaArea((efeitoDaGema?.areaIncPct ?? 0) + incExtra, efeitoDaGema?.areaMaisPct ?? 0);
    const extrasDoC2 = () => {
      if (!c2 || (plantada && !doTotem)) return;
      const acertouOGolpe = atingidos.some(acertouNoPasse);
      const acertados = atingidos.filter(acertouNoPasse);
      // o pulso em volta de cada atordoado: 1,4 m × √ da Área do uso com o "aumentado" pela duração do atordoamento
      if (c2.pulso && atordoadosNoPasse.size) {
        const quem = [...atordoadosNoPasse];
        atordoadosNoPasse.clear();
        for (const [b, ms] of quem) areaDoC2(Areas.quadrado({ x: b.x, y: b.y }, Math.max(0, casasDoRaio(c2.pulso.raioM * Math.sqrt(fatorDaAreaDoUso(GemasC2.areaDoPulsoPct(c2.pulso, ms)))))), b, 100, 'pulso');
      }
      // a explosão da Imolação com o máximo de cargas: em volta de você, no raio da gema × √ da Área, com o golpe × o "% por carga" × as cargas
      if (imolacaoExplode) {
        const n = imolacaoExplode;
        imolacaoExplode = 0;
        const raioM = GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? 2.9;
        areaDoC2(Areas.quadrado(hunt.pos, Math.max(0, casasDoRaio(raioM * Math.sqrt(fatorDaAreaDoUso())))), hunt.pos, GemasC2.pctDaExplosao(c2.imolacao, n), 'explosao');
      }
      // os Martelos Sagrados: com a Carga de Poder gasta, os martelos dos dois lados da área (cada um o primeiro da cascata dele — o "+100%"); depois, enquanto o anel
      // anterior acertou alguém, os anéis da cascata em volta de tudo, até o máximo (D2.5)
      if (c2.martelos && casas?.length && formaNoUso) {
        let todas = casas;
        const primeiro = 100 + (c2.martelos.primeiroMaisPct ?? 0);
        let continua = acertouOGolpe;
        if (poderGasto > 0 && c2.martelos.lados > 0) {
          const dir = formaNoUso.dir ?? ordemDosLados(hunt.pos, alvo ?? hunt.pos)[0];
          const [ux, uy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][dir] ?? [0, -1];
          const meio = GemasC2.centroDasCasas(casas);
          const passo = 2 * meio.raio + 1;
          const novas = [];
          for (let k = 0; k < c2.martelos.lados; k++) {
            const lado = k % 2 === 0 ? 1 : -1;
            const d = passo * (Math.floor(k / 2) + 1) * lado;
            const cs = casas.map((q) => ({ x: q.x - uy * d, y: q.y + ux * d }));
            novas.push(...cs);
            if (areaDoC2(cs, { x: meio.x - uy * d, y: meio.y + ux * d }, primeiro, 'martelo')) continua = true;
          }
          todas = [...casas, ...novas];
        }
        const meio = GemasC2.centroDasCasas(todas);
        const raioM = GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? 1.8;
        const largura = Math.max(1, Math.round((raioM * Math.sqrt(fatorDaAreaDoUso())) / 2));
        for (let k = 1; k <= GemasC2.cascatasDoUso(c2.martelos, poderGasto) && continua; k++) continua = areaDoC2(GemasC2.anelDaCascata(meio, meio.raio, largura, k), meio, 100, 'cascata');
      }
      // o ramo da fissura do Golpe Tectônico (D2.4): o eixo da fissura — da casa à sua frente até a ponta da área, na direção dela
      if (c2.fissura && casas?.length && formaNoUso) {
        const dir = formaNoUso.dir ?? ordemDosLados(hunt.pos, alvo ?? hunt.pos)[0];
        const [ux, uy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][dir] ?? [0, -1];
        const comp = Math.max(1, casas.reduce((r, q) => Math.max(r, Math.abs(q.x - x), Math.abs(q.y - y)), 0));
        const eixo = Array.from({ length: comp }, (_, i) => ({ x: x + ux * (i + 1), y: y + uy * (i + 1) }));
        const chance = GemasC2.chanceDeRamificar(c2.fissura, c2.fissura.consome ? 0 : cargasAgora?.tolerancia ?? 0, toleranciaGasta);
        const ramo = GemasC2.ramoDaFissura(eixo, { ux, uy }, chance);
        if (ramo.length) areaDoC2(ramo, ramo[0], 100, 'ramo');
      }
      // as correntes: os acertados do golpe ficam presos (até N por uso, até o máximo)
      if (c2.correntes && acertados.length && !doTotem) GemasC2.prender(hunt, c2.correntes, acertados, agora, entry.id);
    };
    // (+ "Ataques executados por você se repetem mais N vezes": os ataques usados pelo personagem — não os ativados por gatilho.)
    // (+ 14/10, o Altar Ecoante: "Habilidades se Repetem 1 Vezes mais" — todas as usadas, não as ativadas por gatilho)
    // (lote A4, dono 19/10: D1/R1: + a repetição própria da gema — a Procissão; o uso dura (1 + r) tempos de uso — `fatorDoTempoDoUso`)
    const repeticoes = repeticoesDoUso(entry, efeitoDaGema, ficha, { gatilho, plantada });
    const repDaGema = itensPoeLigado() && entry.poeGema && !plantada ? GemasPoe.repeticoesDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    // (lote A4, dono 19/10: D3) o Golpe Cintilante Vaal: os 25 golpes nos vivos perto, sorteados; os "ferimentos" somam o dano por inimigo e ele entra no fim
    const cintilante = itensPoeLigado() && entry.poeGema?.slug === 'Vaal_Flicker_Strike' && !gatilho && !plantada && !doTotem && atingidos.length ? GemasA4.GOLPE_CINTILANTE_VAAL : null;
    fatorDoTempo = doTotem ? 1 : cintilante ? cintilante.golpes : 1 + repeticoes;
    naRepeticaoFinal = repeticoes === 0;
    // (17/10, lote G12) os CADÁVERES deste uso explodem (e a Cremação deixa os gêiseres) — `explodirCadaveres`
    // (lote B3, dono 21/10: + a Cremação da Exumação — o gêiser explode um cadáver perto a cada disparo, `explodeAoDisparar`)
    if (cadaveresDoUso?.length) eventos.push(...explodirCadaveres(estado, hunt, entry, efeitoDaGema, b3?.explodeAoDisparar ? { ...doCadaver, explodeAoDisparar: true } : doCadaver, cadaveresDoUso, ficha, agora));
    // (lote A4, dono 19/10: R1) a NOVA que se repete a partir dos inimigos acertados (a Nova de Gelo Vaal: "Causa explosões menores até 5 vezes em acertos
    // inimigos", cada uma com o raio "reduzido em 15% a cada repetição" — o PoB: ice_nova_radius_+%_per_repeat), depois de cada nova: o centro é um
    // dos acertados vivos até aqui (sorteado, sem repetir o centro), a forma do uso no raio menor (a fração é a chance de uma casa)
    const raioDoUso = casas && formaNoUso ? casas.reduce((r, c) => Math.max(r, Math.abs(c.x - formaNoUso.x), Math.abs(c.y - formaNoUso.y)), 0) : 0;
    const novasDosAcertados = () => {
      if (!repDaGema?.deInimigo || !casas || !formaNoUso || !entry.forma) return;
      const centros = new Set();
      const fonte = new Set(atingidos);
      for (let k = 1; k <= repDaGema.deInimigo; k++) {
        const podem = [...fonte].filter((b) => b.hp > 0 && !centros.has(b));
        if (!podem.length) break;
        const c = podem[Math.min(podem.length - 1, Math.floor(Math.random() * podem.length))];
        centros.add(c);
        const rk = Math.max(0, raioDoUso * (1 + (repDaGema.raioPorRepPct * k) / 100));
        const r = Math.trunc(rk) + (Math.random() < rk % 1 ? 1 : 0);
        const cs = Areas.daForma(Areas.escalarForma(entry.forma, r), { x: c.x, y: c.y });
        if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x: c.x, y: c.y, casas: Areas.paraTela(cs, { x: c.x, y: c.y }) });
        atingidos = Areas.dentro(cs, vivos.filter((b) => b.hp > 0));
        if (atingidos.length) atacar(true);
        for (const b of atingidos) fonte.add(b);
      }
    };
    // (lote C2, D2.5) o primeiro martelo da cascata dos Martelos Sagrados: o golpe da área do uso com o "+100%"
    const escalaDaPrimeira = c2?.martelos?.primeiroMaisPct && casas?.length ? 100 + c2.martelos.primeiroMaisPct : 100;
    if (cintilante) {
      // (os inimigos perto de onde você chegou, a até a distância do salto: os ferimentos não matam no meio — todos seguem alvos possíveis)
      const raio = Math.max(1, Math.floor((desloc?.maxM ?? 6) / 2));
      const perto = vivos.filter((b) => b.hp > 0 && !b.dummy && distanciaChebyshev(hunt.pos, b) <= raio);
      const alvos = perto.length ? perto : atingidos;
      efeitoDaGema = { ...efeitoDaGema, maisAfeccaoPct: ((1 + (efeitoDaGema?.maisAfeccaoPct ?? 0) / 100) * (1 + cintilante.maisAfeccaoPct / 100) - 1) * 100 };
      ferimentos = new Map();
      for (let k = 0; k < cintilante.golpes; k++) {
        atingidos = [alvos[Math.min(alvos.length - 1, Math.floor(Math.random() * alvos.length))]];
        atacar(k > 0);
      }
      for (const [b, f] of ferimentos) {
        b.hp -= f.dano;
        eventos.push({ t: 'dmg', uid: b.uid, x: b.x, y: b.y, v: f.dano, foe: true, crit: f.crit, spell: entry.name, alvo: b.name, color: f.color, fonte: 'ferimentos' });
      }
      atingidos = [...ferimentos.keys()];
      ferimentos = null;
    } else if (miragemDoUso) {
      // (lote A1b, dono 19/10: I4/I5) o PULSO da miragem (os usos 1, 3, 5…; parada, com o +150%) e, na liberação (I1/I7), a ONDA FINAL — "75% de dano por
      // estágio" (a da Projeção 125% + a qualidade), no mesmo raio (I6), em volta dela — e o teleporte para ela (a da Projeção não teleporta)
      escalaDoUso = miragemDoUso.pulso?.pct ?? 100;
      if (miragemDoUso.pulso && atingidos.length) atacar(false);
      if (miragemDoUso.soltar) {
        const mir = miragemDoUso.novo;
        if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x: mir.pos.x, y: mir.pos.y, casas: Areas.paraTela(miragemDoUso.casas, mir.pos) });
        atingidos = Areas.dentro(miragemDoUso.casas, vivos.filter((b) => b.hp > 0));
        escalaDoUso = miragemDaGema.finalPorEstagioPct * mir.estagios;
        if (atingidos.length && escalaDoUso > 0) atacar(!!miragemDoUso.pulso);
        if (miragemDaGema.teleporta) teleportarParaAMiragem(hunt, mir, eventos);
      }
      escalaDoUso = 100;
    } else { escalaDoUso = escalaDaPrimeira; atacar(false); escalaDoUso = 100; }
    // (lote E2B, 26/10) o Castigo que acertou um inimigo liga a aura dele (`auraDoCastigoE2b`)
    if (castigoE2b && eventos.some((ev) => ev.t === 'dmg' && ev.foe && !ev.dot)) auraDoCastigoE2b(estado, hunt, entry, efeitoDaGema, castigoE2b.buff, agora);
    // (lote C2) as áreas a mais do golpe (`extrasDoC2`)
    extrasDoC2();
    // (lote C4, dono 21/10) a Praga Vaal: mais 2 camadas, cada uma numa área 50% maior que a anterior, em volta do centro do uso (o passe dela: só o debuff — a magia não
    // acerta; quem está na área de dentro leva as 3)
    if (c4?.praga?.camadasExtras > 0 && !(plantada && !doTotem)) {
      const centro = formaNoUso ? { x: formaNoUso.x, y: formaNoUso.y } : { x: hunt.pos.x, y: hunt.pos.y };
      const raioM = GemasPoe.areaNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0).raioM ?? 2;
      for (let k = 1; k <= c4.praga.camadasExtras; k++) areaDoC2(Areas.quadrado(centro, Math.max(0, casasDoRaio(raioM * Math.sqrt(fatorDaAreaDoUso() * GemasC4.fatorDaCamadaVaal(c4.praga, k))))), centro, 100, 'camadaVaal');
    }
    novasDosAcertados();
    // (lote B2, dono 20/10) depois do primeiro passe do uso:
    const atingidosDoUsoB2 = atingidos;
    //  - (decisão do dono, 20/10) a Explosão de Lâminas do Descarrego: a explosão de cada lâmina detonada — N no total (o primeiro passe é a primeira)
    for (let k = 1; k < laminasDoDescarrego && casas; k++) {
      atingidos = Areas.dentro(casas, vivos.filter((b) => b.hp > 0));
      if (!atingidos.length) break;
      if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x, y, casas: Areas.paraTela(casas, { x, y }) });
      atacar(true);
    }
    if (laminasDoDescarrego > 1) atingidos = atingidosDoUsoB2;
    //  - D-B2.1: os ESPOROS da Chuva Tóxica — cada flecha do uso deixa um esporo na área; quem está nela fica com o lento da fonte (5% por esporo vivo, até 30%: os de
    //    usos seguidos somam, a mesma fonte não multiplica), pela duração dos esporos (× a Duração) — `GemasB2.porEsporos`
    if (b2?.esporos && atingidos.length && plantada?.tipo !== 'objeto') {
      const n = Math.max(1, Math.round(Number(efeitoDaGema?.projeteisBase) || 1) + Math.round(Number(efeitoDaGema?.alvosExtras) || 0));
      const ate = agora + Math.round((GemasPoe.compilada(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0)?.stats?.duracao ?? 1) * 1000 * fatorDeDuracao(estado, entry, efeitoDaGema));
      for (const m of atingidos) if (m.hp > 0) GemasB2.porEsporos(m, entry.poeGema.slug, n, ate, b2.esporos.porEsporoPct, b2.esporos.maxPct, agora);
    }
    //  - o CEIFAR VAAL: o Sangue Fervendo no chão da área do uso (o PoB: dotIsArea), pela duração (× a Duração), com o dano degenerativo da gema (a conta deste uso);
    //    quem sai dele segue queimando pelos "Efeitos do Sangue Fervendo Perduram por 4 segundos" (`tiqueDasGemasB2`)
    if (b2?.ceifar?.vaal && casas && formaNoUso && plantada?.tipo !== 'objeto' && !semDanoProprio) {
      const dg = GemasPoe.degenerativoNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0);
      if (dg) {
        const conta = { efeitoDaGema, ficha, fatorDaGema, soAcertoDaFicha, dotMagico: GemasPoe.dotEhMagico(entry.poeGema.slug) };
        const raio = casas.reduce((r, c) => Math.max(r, Math.abs(c.x - formaNoUso.x), Math.abs(c.y - formaNoUso.y)), 0);
        const o = porObjeto(hunt, {
          acao: entry.id, slug: entry.poeGema.slug, el: entry.element ?? null, dono: doTotem ? 'totem' : 'voce', tipo: 'chao', mov: 'parado', efeito: 'inerte', x: formaNoUso.x, y: formaNoUso.y, raio,
          partes: dg.partes.map((p) => ({ tipo: GemasPoe.DEGEN_DO_ELEMENTO[p.elemento], elemento: p.elemento, porSegundo: totalDoDegenerativo(p, 1000, conta) })),
          ate: agora + Math.round(b2.ceifar.vaal.chaoMs * fatorDeDuracao(estado, entry, efeitoDaGema)), perduraMs: b2.ceifar.vaal.perduraMs, sangueFervendo: true, quem: personagem?.nome ?? null, max: 10,
        }, agora);
        marcarSangueFervendo(hunt, o, agora);
      }
    }
    // (lote A3b, dono 19/10: D2) as outras novas dos Disparos Congelantes (uma em cada) — e a repetição sai dos mesmos pontos (abaixo)
    const daPrimeiraNova = atingidos;
    const novasNosOutrosDisparos = () => {
      if (!novasDosDisparos?.casas.length) return;
      const antes = atingidos;
      for (const { c, cs } of novasDosDisparos.casas) {
        if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x: c.x, y: c.y, casas: Areas.paraTela(cs, c) });
        atingidos = Areas.dentro(cs, vivos.filter((b) => b.hp > 0));
        if (atingidos.length) atacar(true);
      }
      atingidos = antes;
    };
    novasNosOutrosDisparos();
    // (lote A3b, dono 19/10: D8) a EXPLOSÃO DE LÂMINAS detona as Lâminas Persistentes que toca: cada uma é destruída e a área da gema sai no lugar dela; a
    // detonação encadeia (detona as lâminas que a área dela toca), até 50 por uso
    if (itensPoeLigado() && entry.poeGema && GemasA3b.detonaLaminas(entry.poeGema.slug) && casas && formaNoUso && (!plantada || plantada.tipo === 'totem')) {
      const laminas = (hunt.poeObjetos ?? []).filter((o) => o.tipo === 'lamina' && (o.z ?? 0) === (hunt.z ?? 0) && o.ate > agora);
      const naArea = new Set(casas.map(Areas.chave));
      const fila = laminas.filter((o) => naArea.has(Areas.chave(o)));
      const tocadas = new Set(fila);
      const detonadas = new Set();
      while (fila.length && detonadas.size < GemasA3b.EXPLOSAO_DE_LAMINAS.maxPorUso) {
        const l = fila.shift();
        detonadas.add(l);
        const cs = casas.map((q) => ({ x: q.x - formaNoUso.x + l.x, y: q.y - formaNoUso.y + l.y }));
        if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x: l.x, y: l.y, casas: Areas.paraTela(cs, l) });
        atingidos = Areas.dentro(cs, vivos.filter((b) => b.hp > 0));
        if (atingidos.length) atacar(true);
        const k = new Set(cs.map(Areas.chave));
        for (const o of laminas) if (!tocadas.has(o) && k.has(Areas.chave(o))) { tocadas.add(o); fila.push(o); }
      }
      if (detonadas.size) hunt.poeObjetos = hunt.poeObjetos.filter((o) => !detonadas.has(o));
      atingidos = daPrimeiraNova;
    }
    // (revisão do A1) o Salto Impactante EMPURRA quem acertou na queda (o PoB: `leap_slam_always_knockback_within_range`) — o Empurrão do jogo
    if (plano && desloc.empurra) for (const m of doDeslocamento) if (m.hp > 0 && acertouNoUso(m)) ModsPoe.empurrar(hunt, m); // (lote A5b: só quem foi acertado)
    // (lote A1, dono 19/10) a SEGUNDA PONTA do deslocamento: a mesma área na outra ponta, um acerto a mais (como no PoE, quem está nas duas leva os
    // dois). A Vaal do Teleporte (D6) leva antes os bichos que você acertou para lá — os que cabem nas casas livres em volta do destino.
    if (segundaPonta) {
      if (desloc.modo === 'inimigos') {
        // (revisão do A1: nenhum chefe vai — o critério de chefe do jogo; e o bicho só para numa casa a que se chega a pé do destino, em até 2
        // passos, na grade sem as zonas seguras, fora da casa de gente: você, aliado da party, lacaio, familiar)
        const grade = gradeDoJogador(hunt);
        const andavel = grade?.andavel ? (cx, cy) => grade.andavel.has(`${cx},${cy}`) : null;
        const aliados = aliadosPorCasa(hunt);
        const ocupada = (c) => hunt.monstros.some((m) => m.hp > 0 && m.x === c.x && m.y === c.y) || (hunt.pos.x === c.x && hunt.pos.y === c.y) || aliados.has(`${c.x},${c.y}`)
          || (hunt.lacaios ?? []).some((l) => l.hp > 0 && l.x === c.x && l.y === c.y) || (hunt.summon && hunt.summon.x === c.x && hunt.summon.y === c.y);
        const lugares = [...Deslocamento.alcancaveis(pontas[1], 2, andavel)].map(([k, n]) => { const [cx, cy] = k.split(',').map(Number); return { x: cx, y: cy, n }; }).sort((a, b) => a.n - b.n);
        for (const m of atingidos) {
          if (!(m.hp > 0) || m.dummy || ehChefeQueNaoTeleporta(m, hunt)) continue;
          const c = lugares.find((l) => !ocupada(l));
          if (!c) continue;
          m.x = c.x;
          m.y = c.y;
          m.andouEm = hunt.clock ?? 0;
          // (o contador do teleporte do bicho — a tela o põe na casa nova, sem o desenho do caminho: `cacadas.snapshotDaHunt`)
          m.teleportes = (m.teleportes ?? 0) + 1;
        }
      }
      atingidos = Areas.dentro(segundaPonta, vivos.filter((b) => b.hp > 0));
      for (const b of atingidos) doDeslocamento.add(b);
      if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x: pontas[1].x, y: pontas[1].y, casas: Areas.paraTela(segundaPonta, pontas[1]) });
      if (atingidos.length) atacar(true);
    }
    // (lote 46, o Punho de Guerra: a Maximização vale só neste primeiro ataque — a próxima, daqui a N s)
    if (maximizado) { noMaximizado = false; (hunt.poeMaximizadoAte ??= {})[entry.id] = (hunt.clock ?? 0) + efeitoDaGema.maximizadoMs; }
    // REPETIÇÕES dos suportes do PoE (Eco de Magia, Golpe Múltiplo): a skill sai de novo na hora, nos vivos (sem gastar de novo).
    // (lote A4, dono 19/10: D1: dentro do uso, que dura os tempos delas — `fatorDoTempo`; R1: a Procissão — cada repetição anda 1 raio da nova na direção do
    // alvo (D2, exceção do dono), até o alcance da gema com +50% de distância máxima; o Eco Desperto — "Repetição Final das Habilidades Suportadas
    // tem X% de chance de causar Dano Dobrado")
    // (revisão do A4: cada repetição do Estilhaçar a Terra é um impacto — deixa as estacas dela, nas pontas das mesmas fissuras)
    const pontasDoUso = estacasDoUso?.length ? [...estacasDoUso] : null;
    if (pontasDoUso) for (let r = 0; r < repeticoes; r++) estacasDoUso.push(...pontasDoUso);
    const centroDaNova = formaNoUso ? { x: formaNoUso.x, y: formaNoUso.y } : { x, y };
    const casasDaNova = casas;
    for (let r = 0; r < repeticoes; r++) {
      if (repDaGema?.deslocaRaios && casasDaNova && raioDoUso > 0) {
        const alcance = Math.floor((entry.range || ALCANCE_PADRAO) * (1 + (repDaGema.alcanceMaisPct ?? 0) / 100));
        const passos = Math.min(alcance, raioDoUso * repDaGema.deslocaRaios * (r + 1));
        const [ux, uy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][hunt.pos.dir ?? 2] ?? [0, 1];
        const para = alvo && (alvo.x !== centroDaNova.x || alvo.y !== centroDaNova.y) ? alvo : { x: centroDaNova.x + ux, y: centroDaNova.y + uy };
        const c = Areas.reta(centroDaNova, para, passos).at(-1) ?? centroDaNova;
        const cs = casasDaNova.map((q) => ({ x: q.x - centroDaNova.x + c.x, y: q.y - centroDaNova.y + c.y }));
        if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x: c.x, y: c.y, casas: Areas.paraTela(cs, c) });
        atingidos = Areas.dentro(cs, vivos.filter((b) => b.hp > 0));
        naRepeticaoFinal = r === repeticoes - 1;
        repeticaoAtual = r + 1;
        dobroNaFinal = naRepeticaoFinal && (efeitoDaGema?.repeticaoFinalDobroPct ?? 0) > 0 && !ficha.danoDobradoNoGolpe && Math.random() * 100 < efeitoDaGema.repeticaoFinalDobroPct;
        if (atingidos.length) atacar(true);
        continue;
      }
      // (lote A3b: D2: a nova dos Disparos repete dos mesmos pontos — a primeira pode estar vazia)
      if (novasDosDisparos) atingidos = daPrimeiraNova.filter((b) => b.hp > 0);
      if (!atingidos.some((b) => b.hp > 0) && !novasDosDisparos?.casas.length) break;
      naRepeticaoFinal = r === repeticoes - 1;
      repeticaoAtual = r + 1;
      dobroNaFinal = naRepeticaoFinal && (efeitoDaGema?.repeticaoFinalDobroPct ?? 0) > 0 && !ficha.danoDobradoNoGolpe && Math.random() * 100 < efeitoDaGema.repeticaoFinalDobroPct;
      // (PoE: "Repetição Final das Magias têm Efeito em Área aumentado em X%" — lote 36, P002: o X soma no "aumentado" da área da última
      // repetição, e o raio da forma cresce × √ como o resto da área.)
      const areaFinal = naRepeticaoFinal && areaNoUso && ehMagiaDaConta ? ModsPoe.valor(ficha, 'repeticao_final_area') : 0;
      // (lote 46: a repetição não é Maximizada — sem a área dos Impactos Maximizados)
      const semMaximizado = maximizado && areaNoUso ? efeitoDaGema.maximizadoAreaIncPct ?? 0 : 0;
      if (areaFinal > 0 || semMaximizado > 0) atingidos = Areas.dentro(areaNoUso(areaFinal - semMaximizado), vivos.filter((b) => b.hp > 0));
      escalaDoUso = escalaDaPrimeira;
      atacar(true);
      escalaDoUso = 100;
      // (lote C2: cada repetição é um ataque — o pulso, os martelos, o ramo)
      extrasDoC2();
      novasDosAcertados();
      novasNosOutrosDisparos();
    }
    repeticaoAtual = 0;
    dobroNaFinal = false;
    // (lote B2, dono 20/10 — D-B2.2) o Ceifar: "Ganhe uma Carga Sangrenta se esta Habilidade Acertar Inimigos e nenhum deles Morrerem" (os do primeiro passe; o seu uso)
    if (b2?.ceifar?.ganha && !doTotem && !plantada && atingidosDoUsoB2.length && atingidosDoUsoB2.every((b) => b.hp > 0)) GemasB2.mudarSangrentas(hunt, 1, agora);
    // (revisão do C1) a Corrente de Anzol para Pesca: "Os inimigos não únicos que estiverem distantes serão puxados para perto de você" (o poedb) — cada acertado vivo,
    // não Único (nem chefe), a mais de 1 casa, vem para a casa livre e andável mais perto de você na reta até ele (`puxarParaPerto`)
    if (puxadosDoAnzol) for (const b of [...puxadosDoAnzol].sort((a, b) => distanciaChebyshev(hunt.pos, a) - distanciaChebyshev(hunt.pos, b))) if (b.hp > 0 && acertouNoUso(b)) puxarParaPerto(hunt, b);
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
    // (revisão B4: "ganha Intensidade quando você Conjurá-la" — a ativada por gatilho, a armadilha e a mina — `plantada` também tem o `gatilho` — não ganham; o
    // Community Wiki: "cannot gain a stack of Intensity when this spell is repeated, triggered, or cast by a totem"; usa os acúmulos que já existem)
    if (efeitoDaGema?.intensidadeMax > 0 && !gatilho) ganharIntensidade(hunt, entry.id, efeitoDaGema, ModsPoe.valor(ficha, 'intensidade_max_extra'), hunt.clock ?? 0, ficha.afPoe);
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
    // (lote A3b, dono 19/10: D5/D6: a da Geada Rastejante que persegue anda com o chão — `criarObjetosDoUso`)
    const fria = entry.poeGema && !(objetoDoUso?.tipo === 'chao' && objetoDoUso.persegue) ? ModsPoe.AREAS_FRIAS.porGema[entry.poeGema.slug] : null;
    if (fria) {
      // (lote A1, dono 19/10: o Piscar Gélido deixa a área fria nas DUAS pontas do teleporte)
      const segundos = (GemasPoe.compilada(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0)?.stats?.duracao ?? 4) * fatorDeDuracao(estado, entry, efeitoDaGema);
      // (lote A5, dono 20/10) o raio da linha ("Raio Base final do Solo Resfriado igual a 3 metros" — o Estalo Gélido; D4) e o Resfriamento da área com o
      // "mais Efeito de Resfriamento" da gema e o "Efeito dos Resfriamentos aumentado" do uso (a gema e os suportes — o Resfriamento Ósseo, D5), no teto de 30%;
      // com o Resfriamento Ósseo, quem está nela sofre o Gelo aumentado pelo Resfriamento (`fragilGelo`)
      const afDoUso = afLocalDoUso(entry, efeitoDaGema);
      const efeitoDaArea = Math.min(AfeccoesPoe.BASE.resfriamento.maximo, ModsPoe.AREAS_FRIAS.efeitoPct * Math.max(0, 1 + (afDoUso.efeito_resfriamento ?? 0) / 100) * Math.max(0, 1 + (afDoUso.efeito_resfriamento_mais ?? 0) / 100));
      const raioM = GemasPoe.raioDaAreaFriaDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) ?? fria.raioM;
      // (lote B1, dono 20/10 — D-B1.6/D-B1.7) o chão dos ESTALOS GÉLIDOS cresce do raio inicial ao final pela duração (× √ da Área de Efeito do uso, a fração como
      // chance — sorteada uma vez) e dá as cargas: o Frenesi (25%) quando um inimigo morre nele; no Vaal, o Poder ao morrer e o Frenesi a cada segundo com um
      // inimigo nele (`ModsPoe.cargasAoMorrerNaAreaFria`, `cargasPorSegundoDasAreasFrias`). O totem não dá as cargas (não são dele).
      const estalo = GemasPoe.estaloDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1);
      const cresce = estalo?.raioInicialM != null && estalo.raioFinalM != null ? { deM: estalo.raioInicialM, ateM: estalo.raioFinalM, fator: ModsPoe.fatorDaArea(efeitoDaGema?.areaIncPct ?? 0, efeitoDaGema?.areaMaisPct ?? 0), sorte: Math.random() } : null;
      const doEstalo = { ...(cresce ? { cresce } : {}), ...(estalo?.aoMorrer && !doTotem ? { aoMorrer: estalo.aoMorrer } : {}), ...(estalo?.porSegundo && !doTotem ? { porSegundo: estalo.porSegundo } : {}) };
      for (const c of pontas ?? [fria.noAlvo && alvo ? alvo : formaNoUso ?? hunt.pos]) ModsPoe.criarAreaFria(hunt, { x: c.x, y: c.y, raioM, segundos, ...(efeitoDaArea !== ModsPoe.AREAS_FRIAS.efeitoPct ? { efeitoPct: Math.round(efeitoDaArea * 10) / 10 } : {}), ...(efeitoDaGema?.areaFriaFragilGelo ? { fragilGelo: true } : {}), ...doEstalo });
    }
    // (lote A1, dono 19/10) o CHÃO do deslocamento: o Solo Ardente do Avanço Flamejante nas casas do rastro (4 s, o dps da gema com a conta deste
    // uso — `tiqueDosSolosDoJogador`) e o Solo Sagrado do Caminho Consagrado na chegada (a duração da gema).
    if (plano && desloc.solo === 'ardente' && !semDanoProprio) {
      const dg = GemasPoe.degenerativoNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0);
      if (dg) {
        const conta = { efeitoDaGema, ficha, fatorDaGema, soAcertoDaFicha, dotMagico: GemasPoe.dotEhMagico(entry.poeGema.slug) };
        const partes = dg.partes.map((p) => ({ tipo: GemasPoe.DEGEN_DO_ELEMENTO[p.elemento], elemento: p.elemento, porSegundo: totalDoDegenerativo(p, 1000, conta) }));
        const rastro = [...new Set([plano.de, ...plano.caminho].map((c) => `${c.x},${c.y}`))];
        (hunt.solosDoJogador ??= []).push({ casas: rastro, z: hunt.z ?? 0, ate: agora + Math.round(dg.duracaoMs * fatorDeDuracao(estado, entry, efeitoDaGema)), acao: entry.id, chave: entry.poeGema.slug, partes, ultimo: agora });
        hunt.solosDoJogador = hunt.solosDoJogador.slice(-8);
        tiqueDosSolosDoJogador(hunt, eventos, agora);
      }
    }
    if (plano && desloc.solo === 'sagrado') criarSoloSagrado(hunt, (GemasPoe.compilada(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0)?.stats?.duracao ?? 4) * fatorDeDuracao(estado, entry, efeitoDaGema), agora);
    // (lote A3b, dono 19/10) os OBJETOS deste uso (`criarObjetosDoUso`): a bola, o tornado, a espiral, o olho, o marcador, o chão, as lâminas, a captura;
    // os Disparos que o Vórtice da Projeção destruiu; os seus projéteis que o Tornado absorve (D7)
    if (itensPoeLigado() && entry.poeGema) {
      const danoMedio = (partes ? partes.reduce((t, p) => t + ((p.min + p.max) / 2) * (p.mult ?? mult), 0) : ((min + max) / 2 + (daPericia ?? 0)) * mult * (sobrecarga ?? 1)) * (fatorDaGema ?? 1) / 100;
      if (tormentaNaHora) tormentasCaem(hunt, entry.id, doTotem ? 'totem' : 'voce', agora);
      if (aneisDaChuva && formaNoUso) aneisDaChuva.forEach((cs, k) => { if (cs.length) eventos.push({ t: 'area', id: entry.efeito ?? null, x: formaNoUso.x, y: formaNoUso.y, casas: Areas.paraTela(cs, formaNoUso), sk: entry.id, sequencia: k }); });
      // (lote B3, dono 21/10) o que o uso do lote B3 deixa:
      //  - D-B3.2: as flechas da Conflagração presas no chão (6 s × a Duração, até 20 da gema — saem as mais velhas), com o raio da explosão deste uso; você chegando
      //    perto, explodem (`tiqueDasGemasB3`). As do totem, não (é você quem se aproxima)
      if (flechasDaConflagracao?.length && !doTotem) {
        const cf = b3.conflagracao;
        for (const c of flechasDaConflagracao) porObjeto(hunt, { acao: entry.id, slug: entry.poeGema.slug, el: entry.element ?? null, dono: 'voce', tipo: 'flechaPresa', mov: 'parado', efeito: 'inerte', x: c.x, y: c.y, raio: flechasDaConflagracao.raioExplosao, maisAcertoEAfeccaoPct: cf.explosaoMaisPct, ate: agora + Math.round(cf.presaMs * fatorDeDuracao(estado, entry, efeitoDaGema)), max: cf.maxFlechas }, agora);
      }
      //  - D-B3.5: o gêiser da Cremação do Vulcão no local mirado (sem cadáver), pela duração × a Duração, até o máximo
      if (vulcaoDoUso) {
        const c = mira ?? alvo ?? formaNoUso ?? hunt.pos;
        porGeiser(estado, hunt, entry, { x: c.x, y: c.y, z: hunt.z ?? 0 }, { ...vulcaoDoUso, duracaoMs: Math.max(1, Math.round(vulcaoDoUso.duracaoMs * fatorDeDuracao(estado, entry, efeitoDaGema))) }, agora);
      }
      //  - D-B3.3: a Troca de Corpos — o cadáver consumido explode (a % da Vida dele, no raio da gema × √(1 + 300%) — corpse_warp_area_of_effect_+%_final_when_consuming_corpse,
      //    só na explosão do cadáver — × √ da Área do uso) e você teleporta para o destino (sem contar como movimento, como o teleporte do A1b)
      if (trocaNoUso?.destino) {
        if (trocaNoUso.cad) eventos.push(...explodirCadaveres(estado, hunt, entry, efeitoDaGema, { pct: b3.troca.cadaverPct, raioExplosaoM: b3.troca.raioM * Math.sqrt(1 + b3.troca.areaCadaverMaisPct / 100) }, [trocaNoUso.cad], ficha, agora));
        teleportarSemMover(hunt, trocaNoUso.destino, eventos);
      }
      if (objetoDoUso || laminasDoUso?.length || novasDosDisparos) {
        const conta = { efeitoDaGema, ficha, fatorDaGema, soAcertoDaFicha, dotMagico: GemasPoe.dotEhMagico(entry.poeGema.slug) };
        // (revisão do B1: a Invocar Tormenta é Multicastable — cada repetição do uso (o Eco de Magia, o Altar Ecoante) deixa o SEU marcador, no mesmo ponto, como no PoE)
        // (revisão do PR1: o escudo do Arremesso de Escudo Espectral de Trarthus também — cada repetição do uso (o Golpe Múltiplo, o Altar Ecoante) joga o SEU
        // escudo, que para no mesmo ponto e solta as SUAS estilhas, como o comum, que as solta em cada colisão de cada passe)
        const vezes = objetoDoUso?.tipo === 'tormenta' || objetoDoUso?.tipo === 'escudo' ? 1 + repeticoesDoUso(entry, efeitoDaGema, ficha, { gatilho, plantada }) : 1;
        for (let k = 0; k < vezes; k++) eventos.push(...criarObjetosDoUso(estado, hunt, entry, efeitoDaGema, { obj: objetoDoUso, alvo, mira, x, y, formaNoUso, emitidos: emitidosDoUso, laminas: k ? null : laminasDoUso, novas: k ? null : novasDosDisparos, velDoTiro, conta, doTotem, dono: doTotem ? plantada?.dono ?? null : null, agora }));
      }
      if (deProjetil && !doTotem && emitidosDoUso.length && hunt.poeObjetos?.length) absorverNosTornados(hunt, emitidosDoUso, danoMedio, agora);
      // (lote C3, dono 25/10) a VARRIDA SAGRADA: "Convoca Martelos Sagrados em até N inimigos atingidos" — N dos atingidos, sorteados; cada martelo cai neles no raio do
      // martelo (1,2 m × √ da Área), com o "−35%", sem poder ser evadido (`pulsarObjetoC3`, no tique)
      if (c3?.martelos?.alvos > 0 && !plantada && !doTotem && atingidos?.length) {
        const r = Math.max(0, casasDoRaio(c3.martelos.raioM * Math.sqrt(ModsPoe.fatorDaArea(efeitoDaGema?.areaIncPct ?? 0, efeitoDaGema?.areaMaisPct ?? 0))));
        for (const m of GemasC3.sortearAlvos(atingidos.filter((b) => b.hp > 0 && !b.dummy), c3.martelos.alvos)) porObjeto(hunt, { acao: entry.id, slug: entry.poeGema.slug, el: entry.element ?? null, dono: 'voce', tipo: 'martelo', mov: 'parado', x: m.x, y: m.y, efeito: 'pulso', raio: r, menosPct: c3.martelos.menosPct, intervaloMs: 1, proxima: agora, ate: agora + 1 }, agora);
      }
      // (lote C3, dono 25/10 — D3.4) o TERREMOTO VAAL ligado: este ataque seu deixa um abalo no centro dele (o anterior já estourou), até os 9
      if (hunt.poeAbaloVaal && entry.poeGema.ataque && !plantada && !gatilho && !doTotem && entry.id !== hunt.poeAbaloVaal.acao) abaloVaalNoAtaque(hunt, formaNoUso ?? alvo ?? hunt.pos, agora);
      // (lote B4, dono 25/10) o que o uso faz nos objetos do lote B4 e na Intensidade:
      if (!doTotem && hunt.poeObjetos?.length) {
        //  - D-B4.4: a área ou o projétil deste uso que pega a casa da sua Hidroesfera a acerta (no máximo 1 vez por segundo — as outras habilidades, não o pulso dela)
        if (danoMedio > 0) acertarAsHidroesferas(estado, hunt, entry, efeitoDaGema, ficha, partes, danoMedio, { casas, emitidos: emitidosDoUso, de: { x, y }, alvo, objeto: plantada?.tipo === 'objeto' ? plantada.objeto : null, crit: danoCritico > 0 }, agora, eventos);
        //  - D-B4.3: o seu uso de uma habilidade de RAIO perto do Orbe Trovejante faz o orbe golpear (a canalizada, no ritmo da canalização — `tiqueDasGemasB4`)
        if (!plantada && !/^Orb_of_Storms/.test(entry.poeGema.slug) && tagsPoeDaSkill(entry).includes('raio') && !tagsPoeDaSkill(entry).includes('canalizar')) orbesGolpeiamPeloUso(estado, hunt, personagem, agora, eventos);
      }
    }
    // (lote G20a) o acerto do TOTEM não é seu: o dreno da ficha e o dos suportes não vêm para você (CalcPerform.lua:264); vale o "X% do Dano causado
    // pelos seus Totens é Drenado como Vida para você" (todo o dano) e o "X% do Dano Físico de Ataques causado pelos seus Totens" (o físico do ataque)
    if (doTotem) {
      // (sem o dano nos monstros com "Vida Não Pode ser Drenada" — `totalSemDreno`, na proporção também no físico)
      const drenavel = total > 0 ? Math.max(0, total - totalSemDreno) / total : 0;
      const vida = drenavel * (total * ModsPoe.valor(ficha, 'totem_roubo_vida') + (entry.poeGema?.ataque ? danoFisico * ModsPoe.valor(ficha, 'totem_roubo_vida_fisico') : 0)) / 100;
      if (vida > 0) Ficha.drenarPoe(estado, { vida }, ficha, eventos, personagem?.nome, plantada.dono ?? hunt.pos);
    }
    // (No PoE as magias não roubam: só os ataques — `Ficha.aplicarLeech`.)
    const fichaDoRoubo = total > 0 && (rouboDosAlvos.vida > 0 || rouboDosAlvos.mana > 0) ? { ...ficha, lifeLeech: (ficha.lifeLeech ?? 0) + rouboDosAlvos.vida / total, manaLeech: (ficha.manaLeech ?? 0) + rouboDosAlvos.mana / total } : ficha;
    if (!doTotem) Ficha.aplicarLeech(estado, total, eventos, personagem?.nome, { x, y }, fichaDoRoubo, null, { ataque: !ehMagiaDaConta, danoCritico, danoFisico, danoVezesMaldicoes, semDrenoDeVida: Math.min(total, totalSemDreno), semDrenoDeEs: Math.min(total, totalSemDrenoEs) });
    // Life Leech / Mana Leech (supports): % do dano desta skill volta em vida/mana.
    const vidaDoLeech = doTotem ? 0 : Math.round((total * (efeitoDaGema?.leechVidaPct ?? 0)) / 100);
    const manaDoLeech = doTotem ? 0 : Math.round((total * (efeitoDaGema?.leechManaPct ?? 0)) / 100);
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
      // (lote A5b: no primeiro que o golpe acertou)
      const primeiroAcertado = atingidos.find(acertouNoUso);
      if (corpoACorpo && primeiroAcertado) rajadaVulcanica(estado, hunt, primeiroAcertado, eventos);
    }
    // (14/10, o Convocar Fantasma: o golpe fatal e o acerto no Raro/Único das habilidades suportadas)
    // (lote A5b: o acerto no Raro/Único — quem o golpe errou não conta)
    if (efeitoDaGema && atingidos.length) convocarFantasmas(estado, hunt, efeitoDaGema, atingidos.filter(acertouNoUso));
    // (lote A5, dono 20/10) "Recupera X% de Vida quando Habilidades Suportadas Matam um Inimigo" (o Golpe de Misericórdia e o Abater o Fraco): X% da Vida máxima
    // por inimigo que este uso matou — o abate seu (`QuemFeriu.abateSeu`; o do totem não é seu)
    if (!doTotem && efeitoDaGema?.vidaAoMatarPct > 0 && atingidos.length) vidaAoMatarDoSuporte(estado, hunt, personagem, efeitoDaGema.vidaAoMatarPct, atingidos, eventos);
    // (lote S1, 26/10) o abate do uso suportado: a Carga de Frenesi ao Matar um Inimigo Congelado (a Mordida Congelante) e o Devorar
    if (!doTotem && efeitoDaGema && atingidos.length) abatesDoSuporteS1(estado, hunt, personagem, efeitoDaGema, atingidos, eventos);
    // (lote A4, dono 19/10) as Excepcionais do Vazio: a Onda de Choque no acerto corpo a corpo (no primeiro acertado) e a Tormenta onde o ataque cai
    if (itensPoeLigado() && efeitoDaGema?.ondaDoVazio && !gatilho && !plantada && !doTotem && atingidos.some(acertouNoUso) && tagsPoeDaSkill(entry).includes('corpo')) eventos.push(...ondaDoVazio(estado, hunt, entry, efeitoDaGema, atingidos.find(acertouNoUso), personagem, agora));
    if (itensPoeLigado() && efeitoDaGema?.tormentaDoVazio && !gatilho && !plantada && !doTotem && (formaNoUso || alvo)) porTormentaDoVazio(hunt, entry, efeitoDaGema, formaNoUso ?? alvo, agora);
    // (lote A4, dono 19/10: D10) o Atirar liberou com gemas de arco ligadas: uma ativação por estágio, com o "mais por Estágio do Tiro" × os estágios
    if (atirarSuportadas) ativarGatilhos(estado, hunt, personagem, 'snipe', { acao: entry.id, alvo: alvo?.hp > 0 ? alvo : null, vezes: estagioDoUso.estagio, maisAcertoPct: (estagioDoUso.estagio * (estagioDoUso.est.mais - estagioDoUso.est.maisAmbos)), maisAfeccaoPct: estagioDoUso.estagio * estagioDoUso.est.maisAfeccao }, eventos);
    // (lote A4, dono 19/10: E1) a FLECHA FLAGELANTE liberada deixa os esporos: N por estágio, na linha até o alvo (espalhados — a escolha sem fonte do lote); cada
    // um dispara as Flechas de Espinho ("Cada Esporo dispara 9 Flechas de Espinho", + a qualidade) nos vivos a até 2 casas dele (sorteados), com os
    // "50% menos Dano" delas e o "mais por estágio" da liberação
    const esporos = itensPoeLigado() && entry.poeGema && estagioDoUso?.liberar ? GemasPoe.esporosDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    if (esporos?.flechas > 0 && alvo) {
      const n = esporos.porEstagio * estagioDoUso.estagio;
      const linha = Areas.reta({ x, y }, alvo, Math.max(1, distanciaChebyshev({ x, y }, alvo)));
      for (let i = 0; i < n; i++) {
        const c = linha[Math.min(linha.length - 1, Math.floor(((i + 1) * linha.length) / (n + 1)))] ?? alvo;
        if (entry.efeito) eventos.push({ t: 'fx', id: entry.efeito, uid: 'player', x: c.x, y: c.y });
        for (let k = 0; k < esporos.flechas; k++) {
          const perto = vivos.filter((b) => b.hp > 0 && !b.dummy && distanciaChebyshev(b, c) <= esporos.raio);
          if (!perto.length) break;
          acertar(perto[Math.min(perto.length - 1, Math.floor(Math.random() * perto.length))], Math.max(0, 100 - esporos.menosPct), 'espinho');
        }
      }
    }
    // (lote PR3, dono 21/10) a FLECHA VIRULENTA DA AMEAÇA: cada flecha do uso (a principal e as adicionais — "Modifiers that cause additional projectiles to be
    // fired will only apply to the initial arrows, each of which leaves its own spore pod") deixa os seus esporos no caminho (a exceção 8 do lote), que disparam na
    // hora as Flechas de Espinho como as da Flecha Flagelante (nos vivos a até 2 casas, sorteados), com o "50% menos Dano" delas
    const esporosDaAmeaca = itensPoeLigado() && entry.poeGema && !estagioDoUso?.liberar ? GemasPoe.esporosPorFlechaDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0) : null;
    if (esporosDaAmeaca?.flechas > 0) {
      for (const p of emitidosDoUso.filter((q) => q.tipo === 'direto' || q.tipo === 'projetil')) {
        for (const c of GemasPR3.pontosDosEsporos(p.de, p.para, esporosDaAmeaca.porFlecha)) {
          if (entry.efeito) eventos.push({ t: 'fx', id: entry.efeito, uid: 'player', x: c.x, y: c.y });
          for (let k = 0; k < esporosDaAmeaca.flechas; k++) {
            const perto = vivos.filter((b) => b.hp > 0 && !b.dummy && distanciaChebyshev(b, c) <= esporosDaAmeaca.raio);
            if (!perto.length) break;
            acertar(perto[Math.min(perto.length - 1, Math.floor(Math.random() * perto.length))], Math.max(0, 100 - esporosDaAmeaca.menosPct), 'espinho');
          }
        }
      }
    }
    // (lote PR3, dono 21/10 — D5) a FISSURA VULCÂNICA VAAL: "After erupting, the fissure continues moving towards enemies to cause further eruptions" — as 2 erupções a
    // mais (o poedb), cada uma o acerto do uso no vivo mais perto da erupção anterior, a até o alcance da habilidade (o mesmo, se for o único — a exceção 9)
    const erupcoes = itensPoeLigado() && entry.poeGema && !casas && alvo && !plantada ? GemasPoe.erupcoesDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1) : 0;
    if (erupcoes > 0 && atingidos.length) {
      let anterior = alvo;
      for (let i = 0; i < erupcoes; i++) {
        const de = anterior;
        const perto = vivos.filter((b) => b.hp > 0 && distanciaChebyshev(b, de) <= (entry.range || ALCANCE_PADRAO)).sort((a, b) => distanciaChebyshev(a, de) - distanciaChebyshev(b, de));
        const prox = perto.find((b) => b !== de) ?? (de.hp > 0 ? de : null);
        if (!prox) break;
        if (entry.projetil) eventos.push({ t: 'shot', id: entry.projetil, x: de.x, y: de.y, tx: prox.x, ty: prox.y });
        acertar(prox, 100, 'erupcao');
        anterior = prox;
      }
    }
    // (lote A4, dono 19/10: E2) o Devastar que acertou ganha 1 estágio
    // (lote A5b: só o uso que acertou alguém)
    if (semCanalizar?.est.modo === 'acerto' && atingidos.some(acertouNoUso)) devastarAcertou(hunt, entry, semCanalizar.est, inicio);
  }

  // Gemas: "-Ns recarga de <magia>" (supremo), sem passar de zero.
  // "Cooldown Recovery" (add): a recarga própria anda mais rápido.
  const fichaDaRecarga = Ficha.combate(estado);
  // + o Cooldown Recovery da gema (support).
  // (lote A1) o Piscar Gélido: "Velocidade de Recuperação da Recarga aumentada em X% para cada Inimigo Normal ou Mágico na Área / Y% para cada
  // Raro ou Único" — quem as duas pontas acertaram
  const porInimigo = desloc?.recargaPorInimigo ? [...doDeslocamento].reduce((n, b) => n + (b.boss || ['raro', 'elite', 'unico', 'boss'].includes(b.raridade) ? desloc.recargaPorInimigo.raro : desloc.recargaPorInimigo.normal), 0) : 0;
  const tempoPoe = entry.poeGema ? temposDaGemaPoe(estado, entry, efeitoDaGema, fichaDaRecarga, { recuperacaoExtraPct: porInimigo }) : null;
  // (lote A1b, dono 19/10) o Teleporte Gélido da Explosão Invernal: "Tempo de Conjuração desta Magia é adicionado à sua Recarga se Ativada" (por gatilho)
  // (lote B1, dono 20/10: + o Condutor Elétrico — a mesma linha; o leitor é a linha da gema, `GemasPoe.conjuracaoNaRecargaSeAtivada`)
  const conjuracaoNaRecarga = gatilho && !gatilho.soltarMiragem && !plantada && tempoPoe && entry.poeGema && (entry.poeGema.slug === 'Frostblink_of_Wintry_Blast' || GemasPoe.conjuracaoNaRecargaSeAtivada(entry.poeGema.slug)) ? tempoPoe.conjuracaoMs ?? 0 : 0;
  const recarga = conjuracaoNaRecarga + (tempoPoe ? tempoPoe.recarga : Math.max(0, Math.round(((recargaDe(entry, entry.cooldown ?? 1000) - (fichaDaRecarga.magiasDasGemas?.[action.id]?.recargaMs ?? 0)) / (1 + (fichaDaRecarga.recuperacaoDeRecarga ?? 0) / 100)) * (1 + (efeitoDaGema?.recargaPct ?? 0) / 100))));
  // Tudo a partir do instante LÓGICO (`inicio`), não do tique em que saiu. (A Armadilha/Mina plantada que ativa não mexe na recarga: ela
  // foi do arremesso.)
  // (lote 51, o Reino de Atziri — dono, 16/10: "Traduzir para a recarga": as Almas Vaal do PoE são a recarga das Vaal no jogo) "Habilidades
  // Vaal tem X% de chance de ganharem as Almas consumidas novamente quando usadas" = a Vaal usada não entra em recarga, na chance.
  const vaalDeGraca = !plantada && recarga > 0 && entry.poeGema && tagsPoeDaSkill(entry).includes('vaal') && Math.random() * 100 < ModsPoe.valor(fichaDaRecarga, 'vaal_almas_de_volta_chance');
  // (lote A1b, dono 19/10: D-a: a recarga pulada com a carga não recomeça)
  if (!plantada && !vaalDeGraca && !continuaCanal && !pulaARecarga) cds[action.id] = { ate: inicio + recarga, total: recarga };
  // (14/10, o Coveiro) Profanar e Desenterrar criam os cadáveres deles no alvo (`criarCadaveres`).
  if (entry.poeGema && GemasPoe.cadaveresDaGema(entry.poeGema.slug, 1)) criarCadaveres(estado, hunt, entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, alvo ?? hunt.pos, Math.random, { qualidade: efeitoDaGema?.qualidade ?? 0 });
  // (lote B1, dono 20/10) a Descarga remove as cargas que contou no começo (as removíveis) depois do golpe, salvo a chance da qualidade; as que o golpe deu ficam
  if (descargaDoUso?.remover) {
    let saiu = 0;
    for (const t of CargasPoe.TIPOS) saiu += CargasPoe.gastar(estado, t, descargaDoUso.cargas?.[t] ?? 0) || 0;
    if (saiu) Ficha.invalidar(estado);
  }
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
        // (lote G-A, dono 25/10 — D2) o que o Clamor Impele (o Sísmico: as Pancadas; o Ancestral: os Golpes — `so`) e os alvos a mais dos Golpes Impelidos (o Ancestral);
        // um Clamor de outro tipo troca o Impelir (um por vez — os números do anterior não somam com o do novo)
        const so = GemasPoe.impeleSoDaGema(entry.poeGema.slug);
        const alvosExtra = GemasPoe.alvosDoImpelidoDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1);
        // (revisão G: o MESMO Clamor — o `de` — renova pelo máximo; outro, mesmo com o mesmo `so`, troca: os números do anterior não ficam com o `de` do novo)
        // (lote G-D, dono 25/10: + `de` — o Clamor que Impeliu: o ataque Impelido pelo Clamor Infernal ativa a Combustão)
        // (lote S1, dono 26/10: um Impelir por Clamor — o de outro Clamor fica junto, nos `outros`, e os dois impelem; `GemasGAC.porImpelir`)
        GemasGAC.porImpelir(hunt, { n, ate: inicio + 20000, de: entry.poeGema.slug, ...(so ? { so } : {}), ...(alvosExtra ? { alvosExtra } : {}) }, inicio);
      }
    // (lote A1b, dono 19/10: D-b: o ataque Impelido pela Emboscada "não pode ser Impelido por outras Habilidades" — não gasta o Impelir do Clamor)
    // (revisão do C1: nem a que não pode ser Impelida — `naoImpelivel`)
    // (lote G-A, D2: + só o ataque que este Impelir alcança — `GemasGAC.impeleEste`)
    } else if (tagsPoe.includes('ataque') && !tagsPoe.includes('naoImpelivel') && !emboscadaDoUso && GemasGAC.impelemEste(hunt.impelidos, tagsPoe, inicio).length && !(tagsPoe.includes('movimento') && ModsPoe.valor(fichaDoUso, 'clamor_nao_impele_movimento') > 0)) {
      // (lote G-D, dono 25/10 — D16) o ataque corpo a corpo Impelido pelo Clamor Infernal ativa a COMBUSTÃO no alvo (`combustao`)
      // (lote S1, dono 26/10: cada Clamor que impele este ataque gasta a SUA carga; o Infernal e o Mago de Batalha valem se estiverem entre eles)
      const impelem = GemasGAC.impelemEste(hunt.impelidos, tagsPoe, inicio);
      if (impelem.some((x) => x.de === 'Infernal_Cry') && tagsPoe.includes('corpo')) eventos.push(...combustao(estado, hunt, personagem, entry, alvo?.hp > 0 ? alvo : atingidos.find((m) => m?.hp > 0) ?? alvo, agora));
      // (lote E1b, 26/10) o ataque Impelido pelo Clamor do Mago de Batalha ativa as magias SUPORTADAS por ele (as ligadas à gema — Gemas.gruposComGatilho, 'magoDeBatalha'),
      // com o "X% menos Dano" do nível do Clamor no acerto e nas afecções
      if (impelem.some((x) => x.de === 'Battlemages_Cry')) {
        const mago = GemasPoe.magoDeBatalhaDaGema('Battlemages_Cry', Gemas.efeitoNaSkill(estado, `${GemasPoe.PREFIXO}Battlemages_Cry`)?.nivel ?? 1);
        if (mago) ativarGatilhos(estado, hunt, personagem, 'magoDeBatalha', { alvo: alvo?.hp > 0 ? alvo : atingidos.find((m) => m?.hp > 0) ?? alvo, maisAcertoPct: -mago.menosPct, maisAfeccaoPct: -mago.menosPct }, eventos);
      }
      for (const x of impelem) x.n--;
    }
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
      // (revisão do A4: o uso depois da liberação começa um canalizar novo)
      const continua = canal && canal.acao === entry.id && !canal.liberou && inicio <= canal.ate + 250;
      // (lote A1b, dono 19/10: + a liberação da miragem — o próximo uso começa um canalizar novo)
      hunt.canalizacao = { acao: entry.id, desde: continua ? canal.desde : inicio, ...(estagioDoUso?.liberar || miragemDoUso?.soltar ? { liberou: true } : {}), ate: inicio + Math.max(250, Math.round((tempoPoe?.uso ?? tempoPoe?.conjuracaoMs ?? 500) * fatorDoTempo)), magia: tagsPoe.includes('magia'),
        // (lote G10: o estágio deste uso — zera na liberação)
        ...(estagioDoUso && estagioDoUso.est.modo !== 'tempo' ? { estagios: estagioDoUso.liberar ? 0 : estagioDoUso.estagio } : {}),
        // (lote A4, dono 19/10: o nível da gema e o estágio do tempo — o que a canalização dá a você: `GemasPoe.adds`, o "menos Velocidade de Movimento por Estágio")
        nivel: efeitoDaGema?.nivel ?? 1, ...(estagioDoUso?.est.modo === 'tempo' ? { estagioDaFicha: estagioDoUso.estagio } : {}),
        // (lote S1: o Conjurar ao Canalizar Desperto — "Ignora Atordoamentos enquanto Usando Habilidades Suportadas", lido em `Controle.tentar`)
        ...(efeitoDaGema?.ignoraAtordoamento ? { ignoraAtordoamento: true } : {}) };
      // (lote A4, dono 19/10: o que a canalização dá a você mudou — a ficha é refeita)
      if (!continua || (canal?.estagioDaFicha ?? null) !== (hunt.canalizacao.estagioDaFicha ?? null)) Ficha.invalidar(estado);
      // (lote A1b, dono 19/10) a miragem dura o mesmo que o canalizar (o fim deste uso, com as repetições)
      if (miragemDoUso && hunt.miragem && !miragemDoUso.soltar) hunt.miragem.ate = hunt.canalizacao.ate;
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
  // (lote A2) a Torre Óssea: a Pancada (a gema com a tag Impacto) que pega a casa de uma torre a explode (`explodirTorres`)
  if (itensPoeLigado() && entry.poeGema && !plantada && hunt.a2?.torres?.length && (GemasPoe.doSlug(entry.poeGema.slug)?.gema?.tags ?? []).includes('Impacto')) eventos.push(...explodirTorres(estado, hunt, casas ?? (alvo ? [{ x: alvo.x, y: alvo.y }] : []), personagem, agora));
  // (lote A4, dono 19/10: D5) as ESTACAS do Estilhaçar a Terra: o uso com a tag Impacto que as pega na área dele, ou o Clamor no raio dele, as explode
  // (`explodirEstacas`); depois, as estacas DESTE uso ficam no chão (`porEstacas`)
  if (itensPoeLigado() && entry.poeGema && !plantada && hunt.poeEstacas?.length) {
    const impacto = (GemasPoe.doSlug(entry.poeGema.slug)?.gema?.tags ?? []).includes('Impacto');
    const clamor = entry.poeGema.arquetipo === 'clamor';
    if (impacto || clamor) {
      const raioDoGrito = clamor ? raioDoClamor(estado, entry, GemasPoe.buffNoNivel(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0)?.efeitos?.find((e) => e.efeito === 'provocar')?.raio ?? 3) : 0;
      const naArea = new Set((casas ?? (alvo ? [{ x: alvo.x, y: alvo.y }] : [])).map((c) => `${c.x},${c.y}`));
      const pegas = hunt.poeEstacas.filter((e) => (e.z ?? 0) === (hunt.z ?? 0) && (clamor ? distanciaChebyshev(hunt.pos, e) <= raioDoGrito : naArea.has(`${e.x},${e.y}`)));
      if (pegas.length) eventos.push(...explodirEstacas(estado, hunt, personagem, pegas));
    }
  }
  if (itensPoeLigado() && estacasDoUso?.length && entry.poeGema && !plantada) porEstacas(estado, hunt, entry, efeitoDaGema, estacasDoUso, agora);
  // Recarga com CARGAS (PoE: "Recarga: 3,5 s (3 usos)" — o Avanço Flamejante): gasta uma por uso e elas voltam uma de cada vez; só trava
  // quando todas estão recarregando (até a primeira voltar).
  if (!plantada && tempoPoe?.cargas > 1 && recarga) {
    const fila = ((hunt.cargasPoe ??= {})[action.id] ?? []).filter((t) => t > inicio);
    fila.push(Math.max(inicio, fila.at(-1) ?? inicio) + recarga);
    hunt.cargasPoe[action.id] = fila;
    cds[action.id] = fila.length >= tempoPoe.cargas ? { ate: fila[0], total: recarga } : { ate: inicio, total: 0 };
  }
  // (lote A1, dono 19/10) a recarga das ILUSÕES (o Avanço, o Avanço Flamejante, o Piscar Gélido, o Passo Rápido, o Passo Definhante) é
  // COMPARTILHADA, como no PoE ("Compartilha recarga com outras Habilidades de Ilusão"): usar uma põe as outras da barra na recarga dela.
  // (revisão do A1, sem assimetria: cada uso gasta UM uso de cada Ilusão da barra, pela recarga dela — a de 1 uso trava pela recarga dela; o
  // Avanço Flamejante de 3 usos perde um, que volta pela recarga dele, como no uso próprio. Exceção aceita pelo dono: o PoE não diz como a
  // recarga compartilhada conta os usos.)
  if (!plantada && !gatilho && recarga > 0 && entry.poeGema && ehIlusao(entry)) {
    for (const a of estado.actions ?? []) {
      const outra = a?.id && a.id !== action.id ? POR_ID.get(a.id) : null;
      if (!ehIlusao(outra)) continue;
      const t2 = temposDaGemaPoe(estado, outra, Gemas.efeitoNaSkill(estado, outra.id), fichaDaRecarga);
      if (!(t2.recarga > 0)) continue;
      if (t2.cargas > 1) {
        const fila = ((hunt.cargasPoe ??= {})[a.id] ?? []).filter((t) => t > inicio);
        fila.push(Math.max(inicio, fila.at(-1) ?? inicio) + t2.recarga);
        hunt.cargasPoe[a.id] = fila;
        cds[a.id] = fila.length >= t2.cargas ? { ate: fila[0], total: t2.recarga } : { ate: Math.max(inicio, cds[a.id]?.ate ?? inicio), total: 0 };
      } else if (!((cds[a.id]?.ate ?? -Infinity) >= inicio + t2.recarga)) cds[a.id] = { ate: inicio + t2.recarga, total: t2.recarga };
    }
  }
  // (revisão do A1) o Passo Definhante: "A Recarga desta Habilidade não é recuperada durante seu efeito" — a recarga começa quando o Elusivo dele acaba
  if (!plantada && !gatilho && entry.poeGema?.slug === 'Withering_Step' && recarga > 0 && (hunt.poeBuffs?.elusivo ?? 0) > inicio) cds[action.id] = { ate: hunt.poeBuffs.elusivo + recarga, total: recarga };
  // (lote G-B, dono 25/10 — D5) as GUARDAS: "A Recarga desta Habilidade não é recuperada durante seu efeito" (a recarga começa no fim do buff) e a recarga COMPARTILHADA
  // entre as Guardas não Vaal; (D17) o Pacto de K'Tash devolve as almas da magia Vaal fortalecida — a recarga dela volta pronta
  if (!plantada && !gatilho && itensPoeLigado() && entry.poeGema) recargaDoGBD(estado, hunt, entry, action, cds, recarga, inicio, fichaDaRecarga);
  // O familiar: o slot mostra a espera dele (17 min no nível 0, 2 min no 100).
  if (entry.summon) cds[action.id] = { ate: inicio + Summon.recarga(estado), total: Summon.recarga(estado) };
  if (!gatilho && (entry.kind === 'spell' || grupoDeAtaque)) {
    // "Cast Speed" (add): encurta o intervalo entre magias (a recarga do grupo).
    // (lote A4, dono 19/10: D1: × os tempos de uso das repetições — `fatorDoTempo`)
    const doGrupo = tempoPoe ? Math.round(tempoPoe.uso * fatorDoTempo) : Math.round(recargaDe(entry, entry.groupCooldown ?? (grupoDeAtaque ? 2000 : 0)) / (entry.kind === 'spell' ? 1 + (fichaDaRecarga.castSpeed ?? 0) / 100 : 1));
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
  // (lote G20b) o SEU projétil de ataque (não o do totem nem o da plantada): a Balista Focada ataca depois dele
  if (!plantada && entry.poeGema?.ataque && papel === 'attack' && tagsPoeDaSkill(entry).includes('projetil')) hunt.poeProjetilDeAtaqueEm = hunt.clock ?? 0;
  // (lote A3b, dono 19/10: D9) as LÂMINAS GIRATÓRIAS soltam os projéteis capturados da Espiral Venenosa do ponto de chegada (`soltarCapturados`)
  if (itensPoeLigado() && plano && entry.poeGema?.slug === 'Whirling_Blades' && !plantada) eventos.push(...soltarCapturados(estado, hunt, personagem, agora));
  // (lote A1b, dono 19/10: D-b) o ataque gastou a Emboscada
  if (emboscadaDoUso && hunt.emboscada === emboscadaDoUso) delete hunt.emboscada;
  marcarDaSkill(eventos, entry, hunt, alvo, { conjurada: concluir || !!plantada, de: plantada });
  return { ok: true, eventos };
}

/**
 * (PoE, 12/10) O ARREMESSO da Armadilha/Mina (`itens-poe/armas-plantadas.mjs`): planta no lugar mirado — + as armadilhas a mais do "X% de
 * chance de arremessar até N Armadilhas adicionais", em volta —, com a duração da gema ("Armadilha/Mina dura N segundos") e o tempo de
 * detonação da Mina, e já processa as plantadas (`tiqueDasPlantadas`). Devolve os eventos.
 */
/**
 * (17/10, lote G3) O que a Armadilha/Mina que SOLTOU a habilidade dá ao uso: a Invenção ("+X% de dano / área de efeito aumentada em X% por
 * segundo que ficaram posicionadas antes de serem ativadas, até Y%" — o tempo desde o arremesso, `plantada.desde`) e a Explosão em Cadeia ("X%
 * mais Dano para cada Mina anterior na Sequência de Detonação" — `plantada.anteriores`, de `Plantadas.minasQueDetonam`).
 */
function daInvencao(plantada, efeito, agora) {
  if (!plantada || !efeito) return { dano: 0, area: 0 };
  const s = Math.max(0, ((agora ?? 0) - (plantada.desde ?? agora ?? 0)) / 1000);
  return {
    dano: efeito.invencaoDanoPorS > 0 ? Math.min(efeito.invencaoDanoMax || 100, efeito.invencaoDanoPorS * s) : 0,
    area: efeito.invencaoAreaPorS > 0 ? Math.min(efeito.invencaoAreaMax || 100, efeito.invencaoAreaPorS * s) : 0,
  };
}
/** O "X% mais dano" do uso que sai da plantada: a Invenção e a Explosão em Cadeia (os dois "mais" somados num só, como no PoE no mesmo suporte). */
function maisDaPlantada(plantada, efeito, agora) {
  // (lote A3b: o golpe do objeto com o "mais" dele — o primeiro impacto da Tormenta Flamejante, as lâminas do Vórtice de Lâminas)
  if (plantada?.tipo === 'objeto') return Number(plantada.maisPct) || 0;
  // (lote A4, dono 19/10: D5: a explosão da estaca do Estilhaçar a Terra, com o "−30%" do PoB)
  if (plantada?.tipo === 'estaca') return Number(plantada.maisPct) || 0;
  if (!plantada || !efeito) return 0;
  const cadeia = plantada.tipo === 'mina' && efeito.maisPorMinaAnteriorPct > 0 ? efeito.maisPorMinaAnteriorPct * Math.max(0, plantada.anteriores ?? 0) : 0;
  const invencao = daInvencao(plantada, efeito, agora).dano;
  return ((1 + cadeia / 100) * (1 + invencao / 100) - 1) * 100;
}

function plantarArmas(estado, hunt, personagem, slot, entry, action, lugar, efeitoDaGema, agora) {
  const tipo = Plantadas.tipoDaGema(entry, efeitoDaGema);
  const ficha = Ficha.combate(estado);
  const slug = entry.poeGema.slug;
  // (17/10, lote G3: a duração e o tempo de detonação do SUPORTE que a transforma em Armadilha/Mina — "Armadilha dura 4 segundo", "Tempo Base de
  // Detonação de Minas de 0.25 segundos" —; sem eles, os da gema)
  const dur0 = Plantadas.duracaoMs(ficha, tipo, efeitoDaGema?.plantaDuracaoMs > 0 ? efeitoDaGema.plantaDuracaoMs / 1000 : GemasPoe.compilada(slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0)?.stats?.duracaoObjeto ?? null);
  // (lote S1: + a "Duração da Armadilha/Mina aumentada" do suporte — a qualidade da Invenção —, somada à das peças)
  const incDaFicha = Number(ficha?.afPoe?.[tipo === 'mina' ? 'duracao_mina' : 'duracao_armadilha']) || 0;
  const dur = efeitoDaGema?.plantaDuracaoIncPct ? Math.round((dur0 * Math.max(0.1, 1 + (incDaFicha + efeitoDaGema.plantaDuracaoIncPct) / 100)) / Math.max(0.1, 1 + incDaFicha / 100)) : dur0;
  const detonacaoMs = tipo === 'mina' ? (efeitoDaGema?.plantaDetonacaoMs > 0 ? efeitoDaGema.plantaDetonacaoMs : Plantadas.detonacaoDaGema(GemasPoe.doSlug(slug)?.gema?.mods ?? [])) : null;
  const eventos = [];
  // ("Minas Desaceleram Inimigos próximos delas por N segundos quando são Plantadas" — os a até 3 casas da Mina.)
  const lentidao = tipo === 'mina' ? Plantadas.segundosDaLentidaoAoPlantar(ficha) : 0;
  // (lote E1b, 26/10: + as Armadilhas a mais da própria gema — "Lança até 1 armadilhas a mais ao usar duas armas", a Hélice de Trarthus)
  const extrasDaGema = tipo === 'armadilha' ? GemasPoe.arremessoDaGema(slug, efeitoDaGema?.nivel ?? 1, ModsPoe.condicoesDe(estado, ficha.afPoe, null)).extras : 0;
  for (const c of Plantadas.casasDoArremesso(lugar.x, lugar.y, Plantadas.extrasDoArremesso(ficha, tipo, Math.random, efeitoDaGema) + extrasDaGema)) {
    const p = Plantadas.plantar(hunt, ficha, { tipo, acao: action.id, slot, x: c.x, y: c.y, z: hunt.z ?? 0, duracaoMs: dur, detonacaoMs, agora, maximoExtra: tipo === 'armadilha' ? efeitoDaGema?.maxArmadilhasExtra ?? 0 : efeitoDaGema?.maxMinasExtra ?? 0 });
    // (lote E1b, dono 26/10) "Minas Desaceleram…" é o TOLHIMENTO do PoE (Hinder — Estados.tolher, os 30% da Desaceleração do jogo, só no passo), não a lentidão
    if (lentidao > 0) for (const b of Plantadas.inimigosPerto(hunt, p, Plantadas.PADRAO.mina.raioDosProximos)) {
      if (Estados.tolher(b, NO_ACERTO.desacelerar.lentidaoPct, lentidao * 1000, agora, ModsPoe.valor(ficha, 'desacelerados_regen_red'))) eventos.push({ t: 'estado', uid: b.uid, x: b.x, y: b.y, estado: 'tolhido' });
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
  // (lote G18b: + as linhas da qualidade — a duração base)
  const props = Vinculos.daGema([...GemasPoe.textosDaGema(slug, nivel).linhas, ...GemasPoe.linhasDaQualidadeDe(slug, efeitoDaGema?.qualidade ?? 0)]);
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
  const props0 = Runas.daGema(GemasPoe.textosDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1).linhas);
  // (lote G-D, dono 25/10 — D14) a Runa da Penitência fica vinculada sem limite de tempo (o PoB: brand_atttached_duration_is_infinite) — sai na explosão
  const props = GemasPoe.penitenciaDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1)?.modo === 'explode' ? { ...props0, vinculadaMs: GemasGBD.PENITENCIA.vinculadaSemFimMs } : props0;
  // (lote G-D — D16: + a "Frequência de Ativação de Runas aumentada" da qualidade do Arcanista — o PoB soma no INC da velocidade de conjuração)
  const castSpeed = (ficha.castSpeed ?? 0) + (ModsPoe.somaPorTags(ficha, tagsPoeDaSkill(entry)).cast_speed_tag ?? 0) + (efeitoDaGema?.velConjuracaoPct ?? 0) + (GemasPoe.arcanistaDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1, efeitoDaGema?.qualidade ?? 0)?.freqPct ?? 0);
  const fatorDaDuracao = fatorDeDuracao(estado, entry, efeitoDaGema);
  // (lote S1: + a Runa Repentina — "X% mais frequência de Ativação", o "mais" do PoB: o intervalo ÷ (1 + X%))
  const conjurar = () => Runas.vincular(hunt, ficha, Runas.conjurar(hunt, ficha, { acao: action.id, slot, x: lugar.x, y: lugar.y, z: hunt.z ?? 0, props, intervaloMs: props.intervaloMs / Math.max(0.1, 1 + castSpeed / 100) / Math.max(0.1, 1 + (efeitoDaGema?.freqAtivacaoMaisPct ?? 0) / 100), fatorDaDuracao, agora, custo }), agora, { preferido: alvo });
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
    // (lote G-A) a Runa que "Não pode ser Convocada" (a do Armagedom da Volatilidade) fica onde está: nem é Ativada nem vem
    if (r.naoConvocavel) continue;
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
  // (lote G-D, dono 25/10 — D14/D15) a Runa da Penitência da Condução que se desvinculou (o vinculado morreu ou a duração acabou): cada inimigo com a Energia dela leva o acerto
  conducaoDesvinculada(estado, hunt, personagem, expiradas, eventos, agora);
  for (const { r, alvo, areaPct } of ativar) {
    if ((estado.hp ?? 0) <= 0) break;
    const plantada = { tipo: 'runa', id: r.id, acao: r.acao, slot: r.slot, x: alvo.x, y: alvo.y, z: r.z, areaPct, vinculado: alvo.uid };
    // (lote G-D, dono 25/10) as Runas do lote: a Energia da Penitência (D14), os feixes da Tempestuosa (D15) e as magias da Runa do Arcanista (D16) — `ativarRunaGBD`
    if (ativarRunaGBD(estado, hunt, personagem, r, alvo, plantada, eventos, agora)) continue;
    const res = dispararSemMarcar(estado, hunt, personagem, r.slot, alvo, { plantada });
    if (res?.ok) eventos.push(...(res.eventos ?? []));
  }
  const mana = ModsPoe.valor(ficha, 'mana_runa_expira_vinculada');
  if (mana > 0) for (const x of expiradas) if (x.vinculada && !x.destruida) estado.mana = Math.min(estado.maxMana ?? 0, (estado.mana ?? 0) + Math.round(((estado.maxMana ?? 0) * mana) / 100));
  return eventos;
}

/**
 * (lote G-D, dono 25/10) A ATIVAÇÃO das Runas do lote (true: tratada aqui):
 *  - D14, a PENITÊNCIA: +1 de Energia no vinculado por Ativação (a Energia some quando a Runa troca de inimigo); com 20, a explosão (o acerto da gema) e a Runa sai;
 *  - a DISSIPAÇÃO: +1 de Energia (até 20) e o pulso com o "mais" e o raio por Energia depois da primeira (`GemasGBD.pulsoDaDissipacao`);
 *  - D15, a CONDUÇÃO: +1 de Energia no vinculado e 1 nos vizinhos a até 1 casa dele que ainda não têm — o golpe é ao se desvincular (`conducaoDesvinculada`);
 *  - D15, a TEMPESTUOSA: os feixes no vinculado e nos N − 1 vivos mais perto dele a até 3 casas, um acerto em cada (`GemasGBD.alvosDosFeixes`);
 *  - D16, o ARCANISTA: as magias ligadas a ela saem DA CASA da Runa (a do vinculado — dono, 26/10), nele (`ativarGatilhos` 'arcanista'), com o "menos Dano", o "mais com Acertos contra o Vinculado" e o "menos
 *    Área" do nível.
 */
function ativarRunaGBD(estado, hunt, personagem, r, alvo, plantada, eventos, agora) {
  const slug = String(r.acao ?? '').replace(GemasPoe.PREFIXO, '');
  const ef = Gemas.efeitoNaSkill(estado, r.acao);
  const nivel = ef?.nivel ?? 1;
  const q = ef?.qualidade ?? 0;
  const pen = GemasPoe.penitenciaDaGema(slug, nivel);
  const disparar = (m, extra = {}) => { const res = dispararSemMarcar(estado, hunt, personagem, r.slot, m, { plantada: { ...plantada, ...extra } }); if (res?.ok) eventos.push(...(res.eventos ?? [])); return res; };
  if (pen) {
    if (r.energiaDe !== alvo.uid) { r.energia = 0; r.energiaDe = alvo.uid; }
    if (pen.modo === 'explode') {
      r.energia += 1;
      (alvo.estados ??= {}).energiaPenitencia = { n: r.energia, runa: r.id, ate: agora + 1000 };
      if (r.energia < pen.max) return true;
      delete alvo.estados.energiaPenitencia;
      disparar(alvo);
      hunt.runas = (hunt.runas ?? []).filter((x) => x !== r);
      Runas.marcarNosInimigos(hunt);
      return true;
    }
    if (pen.modo === 'pulsa') {
      r.energia = Math.min(pen.max, r.energia + 1);
      (alvo.estados ??= {}).energiaPenitencia = { n: r.energia, runa: r.id, ate: agora + 1000 };
      const p = GemasGBD.pulsoDaDissipacao(pen, r.energia);
      disparar(alvo, { maisAcertoPct: p.maisAcertoPct, maisAfeccaoPct: p.maisAfeccaoPct, raioExtraM: p.raioExtraM });
      return true;
    }
    // (a Condução)
    r.alvoConducao = alvo.uid;
    for (const m of hunt.monstros ?? []) {
      if (!(m.hp > 0) || m.dummy || (m.z ?? 0) !== (alvo.z ?? 0)) continue;
      const e = m.estados?.energiaConducao;
      if (m === alvo) (m.estados ??= {}).energiaConducao = { runa: r.id, n: (e?.runa === r.id ? e.n : 0) + 1 };
      else if (!e && distanciaChebyshev(m, alvo) <= GemasGBD.PENITENCIA.conducaoCasas) (m.estados ??= {}).energiaConducao = { runa: r.id, n: 1 };
    }
    return true;
  }
  const feixes = GemasPoe.feixesDaGema(slug, nivel, q);
  if (feixes > 1) {
    for (const m of GemasGBD.alvosDosFeixes(hunt.monstros ?? [], alvo, feixes, GemasGBD.FEIXES.alcance)) disparar(m, { x: m.x, y: m.y, soNoAlvo: true });
    return true;
  }
  const arc = GemasPoe.arcanistaDaGema(slug, nivel, q);
  if (arc) {
    // (revisão G, 26/10) o "menos Dano" vale em todos os atingidos; o "mais Dano com Acertos contra o Inimigo Vinculado" só no vinculado (o PoB: TargetingBrandedEnemy) —
    // `gatilho.vinculadoUid`/`contraVinculadoPct`, no acerto por alvo (`dispararSemMarcar`)
    const mais = GemasGBD.maisDoArcanista(arc, false);
    // (dono, 26/10: como no PoE — as magias saem da casa da Runa, a do vinculado, e não de você)
    const pos = hunt.pos;
    hunt.pos = { ...pos, x: alvo.x, y: alvo.y };
    try { ativarGatilhos(estado, hunt, personagem, 'arcanista', { alvo, runa: r.acao, maisAcertoPct: mais.maisAcertoPct, maisAfeccaoPct: mais.maisAfeccaoPct, areaMaisPct: -arc.menosAreaPct, vinculadoUid: alvo?.uid ?? null, contraVinculadoPct: arc.contraVinculadoPct ?? 0 }, eventos); } finally { hunt.pos = pos; }
    return true;
  }
  return false;
}
/**
 * (lote G-D, dono 25/10) Os CLAMORES do lote no uso, no raio do Clamor:
 *  - o INFERNAL (D16, o PoB): os provocados ganham a penalidade (3,4 s × a Duração) — quem morre com ela explode (`aoMorrerGBD`);
 *  - o de REUNIÃO: "Ataques Impelidos causam 5% mais Dano por Aliado afetado, máximo de 25%" — os aliados no raio (os companheiros da party e os seus lacaios vivos) no
 *    buff do Clamor (`mais_dano@impelidoClamor`).
 */
function clamorGBD(estado, hunt, entry, efeitoDaGema, raio, agora) {
  const slug = entry.poeGema.slug;
  const nivel = efeitoDaGema?.nivel ?? 1;
  const inf = GemasPoe.infernalDaGema(slug, nivel);
  if (inf?.explodePct > 0 && hunt.pos) {
    const ate = agora + Math.round(inf.penalidadeMs * fatorDeDuracao(estado, entry, efeitoDaGema));
    for (const m of hunt.monstros ?? []) if (m.hp > 0 && !m.dummy && (m.z ?? hunt.z ?? 0) === (hunt.z ?? 0) && distanciaChebyshev(hunt.pos, m) <= raio) (m.estados ??= {}).infernal = { ate, pct: inf.explodePct, acao: entry.id };
  }
  const reu = GemasPoe.reuniaoDaGema(slug, nivel);
  const b = hunt.buffs?.[entry.id];
  if (reu?.porAliadoPct > 0 && b && hunt.pos) {
    const perto = (p, z) => p && (z ?? 0) === (hunt.z ?? 0) && distanciaChebyshev(hunt.pos, p) <= raio;
    const aliados = (hunt.partilha?.naSala ?? []).filter((o) => o && o !== estado && perto(o.hunt?.pos, o.hunt?.z)).length + (hunt.lacaios ?? []).filter((l) => l.hp > 0 && perto(l, l.z ?? hunt.z)).length;
    const mais = GemasGBD.maisDaReuniao(reu, aliados);
    if (mais > 0) { b.afPoe = { ...(b.afPoe ?? {}), 'mais_dano@impelidoClamor': (b.afPoe?.['mais_dano@impelidoClamor'] ?? 0) + mais }; Ficha.invalidar(estado); }
    // o buff dos ALIADOS (o PoB: o Dano de Ataque Adicional igual a X% do dano da sua arma principal — cada tipo dela, "por cada 5 de Poder, até 30"): a foto em `hunt.poeReuniao`,
    // que os companheiros a até o raio do Clamor leem na ficha deles (`Aliados.aplicar`) enquanto ele dura; você não o recebe
    // (dono, 26/10: "Conta o Poder total de Inimigos e Aliados no Raio" — cada aliado afetado conta o Poder de um inimigo Normal, 1 — `GemasGBD.REUNIAO.poderPorAliado`)
    const pct = GemasGBD.armaDaReuniao(reu, ModsPoe.poderDoClamor(hunt, Ficha.combate(estado)) + (reu.contaAliados ? aliados * GemasGBD.REUNIAO.poderPorAliado : 0));
    const arma = Ficha.armasEquipadas(estado).find((a) => a.slot === 'weapon');
    if (pct > 0 && arma) {
      const af = {};
      const add = (el, x, y) => { if (x > 0 || y > 0) { const [kMin, kMax] = el === 'physical' ? ['phys_add_min', 'phys_add_max'] : [`added_${el}_dmg_min`, `added_${el}_dmg_max`]; af[kMin] = Math.round((x * pct) / 100); af[kMax] = Math.round((y * pct) / 100); } };
      add('physical', arma.min, arma.max);
      const daPeca = estado.equipment?.weapon?.poe?.af ?? {};
      for (const el of ['fire', 'ice', 'energy', 'chaos']) add(el, Number(daPeca[`added_${el}_dmg_min`]) || 0, Number(daPeca[`added_${el}_dmg_max`]) || 0);
      // (lote E1b, dono 26/10: + o "Buff tem 100% mais Efeito em seus Lacaios" — os seus lacaios no raio o recebem × (1 + X%), GemasE1b.reuniaoNoLacaio)
      hunt.poeReuniao = { ate: b.ate, raio, z: hunt.z ?? 0, af, lacaiosMaisPct: reu.lacaiosMaisPct ?? 0 };
    }
  }
}
/**
 * (lote G-D, dono 25/10 — D16) A COMBUSTÃO do Clamor Infernal (o PoB, act_str.lua Combust): o ataque em área (2,2 m × √ da Área — o poedb, a exceção 6) em volta do alvo do
 * ataque Impelido, com o golpe da arma × a eficácia do nível (2,342 no 20 — o baseMultiplier e o damageEffectiveness do PoB) e 60% do Físico convertido em Fogo; o
 * acerto de ataque das habilidades sem golpe (`acertoDoArauto`, a precisão e as tags de ataque corpo a corpo em área). Devolve os eventos.
 */
export function combustao(estado, hunt, personagem, entry, centro, agora) {
  const eventos = [];
  const clamor = POR_ID.get(`${GemasPoe.PREFIXO}Infernal_Cry`);
  if (!centro || !hunt.pos || !clamor) return eventos;
  const ef = Gemas.efeitoNaSkill(estado, clamor.id);
  const efic = GemasGBD.eficaciaDaCombustao(ef?.nivel ?? 1);
  const arma = armaSemAdicionado(Ficha.combate(estado));
  const tags = [...new Set(['ataque', 'area', 'corpo', 'fogo', 'fisico'])];
  const r = Math.max(0, Math.round((GemasGBD.COMBUSTAO.raioM * Math.sqrt(ModsPoe.fatorDaArea(ef?.areaIncPct ?? 0, ef?.areaMaisPct ?? 0))) / 2));
  eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: centro.x, y: centro.y, lado: 2 * r + 1, sk: clamor.id });
  for (const m of [...(hunt.monstros ?? [])]) {
    if (!(m.hp > 0) || m.dummy || (m.z ?? hunt.z ?? 0) !== (hunt.z ?? 0) || distanciaChebyshev(m, centro) > r) continue;
    const bruto = (arma.min + Math.random() * (arma.max - arma.min)) * efic;
    acertoDoArauto(estado, hunt, clamor.id, m, bruto, 'physical', { tags, eventos, fonte: 'combustao', personagem, ataque: true, adicionado: efic, conversaoFisico: { fire: GemasGBD.COMBUSTAO.fisicoEmFogoPct } });
  }
  return eventos;
}
/**
 * (lote G-D, dono 25/10 — D16) A MORTE de quem tinha a penalidade do Clamor Infernal: explode — 8% da Vida máxima DELE como Fogo nos vizinhos a até 2,2 m (o poedb, a exceção
 * 6), pela resistência a Fogo de cada um, sem os seus modificadores de dano.
 */
export function aoMorrerGBD(estado, hunt, personagem, morto, eventos = []) {
  const p = morto?.estados?.infernal;
  if (!itensPoeLigado() || !p || !(p.ate > (hunt.clock ?? 0))) return eventos;
  delete morto.estados.infernal;
  const valor = ((morto.maxHp ?? 0) * p.pct) / 100;
  if (!(valor > 0)) return eventos;
  const r = Math.max(1, Math.round(GemasGBD.COMBUSTAO.explosaoRaioM / 2));
  eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: morto.x, y: morto.y, lado: 2 * r + 1, sk: p.acao });
  for (const m of [...(hunt.monstros ?? [])]) {
    if (m === morto || !(m.hp > 0) || m.dummy || (m.z ?? 0) !== (morto.z ?? 0) || distanciaChebyshev(m, morto) > r) continue;
    const dano = Math.round(resistido(hunt, m, 'fire', valor, null));
    if (!(dano > 0)) continue;
    m.hp -= dano;
    QuemFeriu.carimbar(m, QuemFeriu.VOCE, ['fogo', 'area']);
    eventos.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v: dano, foe: true, spell: 'Clamor Infernal', alvo: m.name, color: COR_DO_ELEMENTO.fire ?? '#ff6a00', fonte: 'explosao-infernal', sk: p.acao });
  }
  return eventos;
}
/** (lote G-D — D15) A Condução desvinculada: as Runas dela cujo vinculado morreu (a Runa soltou) ou que acabaram; cada inimigo com a Energia de uma delas leva o acerto da gema. */
function conducaoDesvinculada(estado, hunt, personagem, expiradas, eventos, agora) {
  const soltas = [...(hunt.runas ?? []).filter((r) => r.alvoConducao != null && r.alvo !== r.alvoConducao), ...(expiradas ?? []).map((x) => x.r).filter((r) => r.alvoConducao != null)];
  for (const r of soltas) {
    const vinculado = r.alvoConducao;
    r.alvoConducao = null;
    for (const m of [...(hunt.monstros ?? [])]) {
      const e = m.estados?.energiaConducao;
      if (!e || e.runa !== r.id) continue;
      delete m.estados.energiaConducao;
      if (!(m.hp > 0) || m.dummy || (estado.hp ?? 0) <= 0) continue;
      const res = dispararSemMarcar(estado, hunt, personagem, r.slot, m, { plantada: { tipo: 'runa', id: r.id, acao: r.acao, slot: r.slot, x: m.x, y: m.y, z: r.z, vinculado, soNoAlvo: true } });
      if (res?.ok) eventos.push(...(res.eventos ?? []));
    }
  }
}

/**
 * (PoE, 12/10) O tique das ARMADILHAS e MINAS plantadas (`itens-poe/armas-plantadas.mjs`): as Armadilhas com inimigo no raio de ativação
 * ativam (e as próximas, com "Quando suas Armadilhas Ativarem, suas Armadilhas próximas também Ativam"); as Minas detonam na sequência.
 * Cada uma sai do lugar dela (`dispararSemMarcar` com `plantada`). Devolve os eventos.
 */
/**
 * (17/10, lote G11) As TORRES da Armadilha de Torre Elétrica (`GemasPoe.torreDaGema`): ativada, a armadilha vira uma torre no lugar dela que, a
 * cada intervalo ("Ataca a cada 0.36 segundos", ÷ a Velocidade de Arremesso de Armadilhas — "também se aplicam à Frequência dos golpes"), pela
 * duração da gema, golpeia N áreas: a habilidade da gema sai DO LUGAR da torre num inimigo sorteado a até 2 casas dela (cada área, um uso sem
 * custo — o mesmo caminho do dano da Armadilha). `hunt.poeTorres` (JSON puro).
 */
export const RAIO_DA_TORRE = 2;
function tiqueDasTorres(estado, hunt, personagem, eventos, agora) {
  if (!hunt.poeTorres?.length) return;
  for (const t of hunt.poeTorres) {
    while (t.proxima <= Math.min(agora, t.ate) && (estado.hp ?? 0) > 0) {
      t.proxima += t.intervaloMs;
      // (lote E2B, 26/10 — o PoB) o pulso da Armadilha Sísmica: N ondas; cada uma acerta cada inimigo na área da Armadilha com a chance da sobreposição (121/324)
      if (t.ondasE2b) {
        for (let k = 0; k < t.ondasE2b.n; k++) for (const m of Plantadas.inimigosPerto(hunt, t, t.ondasE2b.raio)) {
          if (!(m.hp > 0) || !(Math.random() < t.ondasE2b.chance)) continue;
          const o = dispararSemMarcar(estado, hunt, personagem, t.slot, m, { plantada: { ...t.plantada, soNoAlvo: true } });
          if (o?.ok) eventos.push(...(o.eventos ?? []));
        }
        continue;
      }
      for (let k = 0; k < t.areas; k++) {
        const perto = Plantadas.inimigosPerto(hunt, t, RAIO_DA_TORRE);
        if (!perto.length) break;
        const alvo = perto[Math.floor(Math.random() * perto.length)];
        const r = dispararSemMarcar(estado, hunt, personagem, t.slot, alvo, { plantada: { ...t, tipo: 'torre' } });
        if (r?.ok) eventos.push(...(r.eventos ?? []));
      }
    }
  }
  hunt.poeTorres = hunt.poeTorres.filter((t) => t.ate > agora);
  if (!hunt.poeTorres.length) delete hunt.poeTorres;
}

/**
 * (17/10, lote G13) A AURA DAS MINAS DA GEMA: "Cada Mina aplica Chance de Golpe Crítico de Acertos aumentada em X% contra Inimigos próximos a ela,
 * até Y%" (a Mina de Gelo — `minaCritico` no inimigo, lido no golpe: `ModsPoe.golpeNoAlvo`/`fichaDoGolpe`) e "Cada mina aplica Dano aumentado em
 * X% aos Inimigos próximos máximo de Y%" (a Mina de Tempestade — o dano sofrido, `minaFragil`): cada Mina plantada daquela gema soma X × (1 +
 * "Efeito de Auras das Minas") nos inimigos a até 35 unidades dela (o raio das auras de Mina do lote 34), até Y. O estado dura o tique.
 */
function auraDasMinasDaGema(estado, hunt, agora) {
  const minas = Plantadas.plantadas(hunt, 'mina', agora);
  if (!minas.length) return;
  const efeitoDaFicha = ModsPoe.valor(Ficha.combate(estado), 'efeito_aura_mina');
  const porGema = new Map();
  for (const p of minas) {
    if (porGema.has(p.acao)) continue;
    // (lote E1b, 26/10: + o que a qualidade e as linhas a mais dão à aura — a Tormenta Explosiva, a Congelante da Sabotagem, a Exposição ao Fogo da Piroclástica)
    const slugP = String(p.acao).replace(GemasPoe.PREFIXO, '');
    const efP = Gemas.efeitoNaSkill(estado, p.acao);
    const base = GemasPoe.minaDaGema(slugP, efP?.nivel ?? 1);
    const e1b = GemasPoe.auraDaMinaE1bDaGema(slugP, efP?.nivel ?? 1, efP?.qualidade ?? 0);
    porGema.set(p.acao, base || e1b ? { ...(base ?? {}), ...(e1b ? { e1b } : {}) } : null);
  }
  for (const b of hunt.monstros ?? []) {
    if (!(b.hp > 0) || b.dummy) continue;
    const soma = { minaCritico: { pct: 0, teto: 0 }, minaFragil: { pct: 0, teto: 0 } };
    let exposicaoFogo = 0;
    for (const p of minas) {
      const d = porGema.get(p.acao);
      if (!d || (b.z != null && p.z != null && b.z !== p.z) || Math.max(Math.abs(b.x - p.x), Math.abs(b.y - p.y)) * ModsPoe.DISTANCIA_DO_PROJETIL.unidadesPorCasa > ModsPoe.AURA_DA_MINA_UNIDADES) continue;
      // (lote E1b: o "Efeito das Auras aumentado" da gema soma ao "Efeito de Auras das Minas" das peças)
      const efeitoAura = Math.max(0, 1 + (efeitoDaFicha + (d.e1b?.efeitoAuraPct ?? 0)) / 100);
      if (d.auraCritico) { soma.minaCritico.pct += d.auraCritico.porMina * efeitoAura; soma.minaCritico.teto = Math.max(soma.minaCritico.teto, d.auraCritico.teto); }
      if (d.auraDano) { soma.minaFragil.pct += (d.auraDano.porMina + (d.e1b?.danoPorMinaExtra ?? 0)) * efeitoAura; soma.minaFragil.teto = Math.max(soma.minaFragil.teto, d.auraDano.teto); }
      // (a Exposição não soma entre as Minas: vale a mais forte — o PoE)
      if (d.e1b?.exposicaoFogoPct) exposicaoFogo = Math.max(exposicaoFogo, d.e1b.exposicaoFogoPct * efeitoAura);
    }
    if (exposicaoFogo > 0) ModsPoe.porExposicao(b, 'fire', exposicaoFogo, 500, agora);
    for (const [campo, c] of Object.entries(soma)) if (c.pct > 0) {
      const ja = b.estados?.[campo]?.ate > agora ? b.estados[campo].pct ?? 0 : 0;
      (b.estados ??= {})[campo] = { ate: agora + 500, pct: Math.max(ja, Math.min(c.teto, c.pct)) };
    }
  }
}

// (revisão C2, dono 21/10: `explosaoDeRunas: false` — a caçada do modo PoE faz a Explosão de Runas no laço da barra, em cada volta — `cacadas`)
export function tiqueDasPlantadas(estado, hunt, personagem, eventos = [], agora = hunt?.clock ?? 0, { explosaoDeRunas = true } = {}) {
  if (itensPoeLigado() && hunt?.plantadas?.length) auraDasMinasDaGema(estado, hunt, agora);
  // (lote E2B, 26/10: a Regeneração da Sifão de Gelo pelos inimigos afetados e o Solo Eletrizado da Relampejante Vaal — `tiqueDoE2b`)
  if (itensPoeLigado() && (hunt?.poeSifaoE2b || hunt?.poeSolosE2b?.length)) tiqueDoE2b(estado, hunt, agora);
  if (itensPoeLigado() && hunt?.poeTorres?.length) tiqueDasTorres(estado, hunt, personagem, eventos, agora);
  // (lote G12: os gêiseres da Cremação, no mesmo tique)
  if (itensPoeLigado() && hunt?.poeGeiseres?.length) tiqueDosGeiseres(estado, hunt, personagem, eventos, agora);
  // (lote A4, dono 19/10: as estacas do Estilhaçar a Terra e o Orbe Invernal, no mesmo tique)
  if (itensPoeLigado() && hunt?.poeEstacas?.length) tiqueDasEstacas(estado, hunt, personagem, eventos, agora);
  if (itensPoeLigado() && hunt?.poeTormentas?.length) tiqueDasTormentas(estado, hunt, personagem, eventos, agora);
  if (itensPoeLigado() && hunt?.poeOrbes?.length) tiqueDoOrbe(estado, hunt, personagem, eventos, agora);
  // (lote A1: o Solo Ardente do Avanço Flamejante, no mesmo tique)
  if (itensPoeLigado() && hunt?.solosDoJogador?.length) tiqueDosSolosDoJogador(hunt, eventos, agora);
  // (lote A3b, dono 19/10: os OBJETOS no chão ou no tempo — a bola, o tornado, a espiral, o olho, o chão —, no mesmo tique)
  // (lote B4, dono 25/10: as flechas da Chuva Tempestuosa, o Orbe Trovejante, o Campo Galvânico, a Hidroesfera e as Paredes — antes dos objetos, que
  // tiram os vencidos — `tiqueDasGemasB4`)
  if (itensPoeLigado() && hunt?.poeObjetos?.length) tiqueDasGemasB4(estado, hunt, personagem, eventos, agora);
  if (itensPoeLigado() && hunt?.poeObjetos?.length) tiqueDosObjetos(estado, hunt, personagem, eventos, agora);
  // (lote C3, dono 25/10: a Fúria da Tempestade Furiosa do Berserker; a explosão dos orbes da Tormenta Explosiva quando a canalização para)
  if (itensPoeLigado() && hunt?.poeObjetos?.length) tiqueDoC3(estado, hunt, personagem, eventos, agora);
  // (lote C2, dono 20/10: a Imolação que acabou e as correntes da Corrente com Gancho de Trarthus, no mesmo tique)
  if (itensPoeLigado() && (hunt?.poeImolacao || hunt?.poeCorrentes?.length || hunt?.poeObjetos?.length)) tiqueDoC2(estado, hunt, personagem, eventos, agora, explosaoDeRunas);
  // (lote B2, dono 20/10: o debuff do Golpe Infernal que expira, o Sangue Fervendo do Ceifar Vaal — `tiqueDasGemasB2`)
  if (itensPoeLigado() && hunt?.monstros?.length) tiqueDasGemasB2(estado, hunt, personagem, eventos, agora);
  // (lote B3, dono 21/10: as flechas presas da Conflagração que você ativou chegando perto, a Chuva de Lâminas de Trarthus ligada — `tiqueDasGemasB3`)
  if (itensPoeLigado() && (hunt?.poeTrarthus || hunt?.poeObjetos?.length)) tiqueDasGemasB3(estado, hunt, personagem, eventos, agora);
  // (lote PR4, dono 25/10: as flechas grudadas, as conchas, as cordas, a energia estática — `tiqueDasGemasPR4`)
  if (itensPoeLigado() && (hunt?.poeEstatico || hunt?.poeConcentrados || hunt?.poeFeixesConcentrados || hunt?.monstros?.length || salaDe(hunt)?.poeRestosPR4?.length)) tiqueDasGemasPR4(estado, hunt, personagem, eventos, agora);
  if (!hunt?.plantadas?.length || !itensPoeLigado()) return eventos;
  const ficha = Ficha.combate(estado);
  // (lote E2B, 26/10: + a gema Detonar Minas — a qualidade dela na Velocidade de Detonação, com ela encaixada; o uso dela na barra detona andando e sem inimigo perto)
  const doDetonar = hunt.plantadas.some((x) => x.tipo === 'mina') ? { velocidadeExtraPct: detonacaoDaGemaE2b(estado), manual: hunt.poeDetonarManualE2b === agora } : undefined;
  for (const { p, alvo } of [...Plantadas.armadilhasQueAtivam(hunt, ficha, agora), ...Plantadas.minasQueDetonam(hunt, ficha, agora, doDetonar)]) {
    if ((estado.hp ?? 0) <= 0) break;
    Plantadas.tirar(hunt, p);
    // (lote G11) a Torre Elétrica: a ativação cria a torre (os golpes saem no tique — `tiqueDasTorres`)
    const efTorre = Gemas.efeitoNaSkill(estado, p.acao);
    // (lote E1b, dono 26/10: + a Lança-Chamas — o mesmo objeto que pulsa, a cada 0,1 s na área em volta da Armadilha, pela duração × a Duração da Habilidade)
    const chamas = GemasPoe.chamasDaGema(String(p.acao).replace(GemasPoe.PREFIXO, ''), efTorre?.nivel ?? 1, efTorre?.qualidade ?? 0);
    const torre = GemasPoe.torreDaGema(String(p.acao).replace(GemasPoe.PREFIXO, ''), efTorre?.nivel ?? 1, efTorre?.qualidade ?? 0) ?? (chamas ? { ...chamas, duracaoMs: Math.round(chamas.duracaoMs * fatorDeDuracao(estado, POR_ID.get(p.acao), efTorre)) } : null);
    if (torre) {
      const ef = Gemas.efeitoNaSkill(estado, p.acao);
      const vel = torre.velocidadeDeArremesso ? 1 + (ef?.velArremessoArmadilhaPct ?? 0) / 100 : 1;
      (hunt.poeTorres ??= []).push({ id: `torre-${p.id}`, slot: p.slot, acao: p.acao, x: p.x, y: p.y, z: p.z, ate: agora + torre.duracaoMs, proxima: agora, intervaloMs: Math.max(50, Math.round(torre.intervaloMs / Math.max(0.1, vel))), areas: torre.areas });
      tiqueDasTorres(estado, hunt, personagem, eventos, agora);
      // (lote E1b, 26/10) a Espiral da Eletrização: "X% de Chance de uma Armadilha ser Ativada uma vez adicional" (a qualidade, somada à das peças) — a Armadilha
      // ativada de novo ergue outra Espiral no mesmo lugar
      const slugT = String(p.acao).replace(GemasPoe.PREFIXO, '');
      if (GemasE1b.ativaDeNovo(ModsPoe.valor(ficha, 'armadilha_ativa_de_novo'), GemasPoe.chanceDeAtivarDeNovoDaGema(slugT, ef?.nivel ?? 1, ef?.qualidade ?? 0))) {
        hunt.poeTorres.push({ id: `torre-${p.id}-2`, slot: p.slot, acao: p.acao, x: p.x, y: p.y, z: p.z, ate: agora + torre.duracaoMs, proxima: agora, intervaloMs: Math.max(50, Math.round(torre.intervaloMs / Math.max(0.1, vel))), areas: torre.areas });
        tiqueDasTorres(estado, hunt, personagem, eventos, agora);
      }
      continue;
    }
    // (lote E2B, 26/10 — o PoB) a Armadilha Sísmica: ativada, pulsa a cada 0,9 s ÷ a Velocidade de Arremesso pela duração (os pulsos, ⌊duração × frequência⌋); cada
    // pulso, as ondas dela (`tiqueDasTorres`, `ondasE2b`) — sem acerto na ativação
    if (p.tipo === 'armadilha' && sismicaNaAtivacao(estado, hunt, personagem, p, eventos, agora)) continue;
    // (lote E1b, dono 26/10 — o PoB) a Sísmica dos Poços: N ondas; cada uma acerta cada inimigo na área da Armadilha com a chance da sobreposição (121/324) — sem a
    // área inteira de uma vez
    const efOndas = Gemas.efeitoNaSkill(estado, p.acao);
    const slugOndas = String(p.acao).replace(GemasPoe.PREFIXO, '');
    const ondas = p.tipo === 'armadilha' ? GemasPoe.ondasDaGema(slugOndas, efOndas?.nivel ?? 1, efOndas?.qualidade ?? 0) : null;
    let r = null;
    if (ondas) {
      const raioOndas = Math.max(1, Math.round((GemasPoe.areaNoNivel(slugOndas, efOndas?.nivel ?? 1, efOndas?.qualidade ?? 0).raioM ?? 1.8) / 2));
      r = { ok: true, eventos: [] };
      for (let k = 0; k < ondas.n; k++) for (const m of Plantadas.inimigosPerto(hunt, p, raioOndas)) {
        if (!(Math.random() < ondas.chance)) continue;
        const o = dispararSemMarcar(estado, hunt, personagem, p.slot, m, { plantada: { ...p, soNoAlvo: true } });
        if (o?.ok) r.eventos.push(...(o.eventos ?? []));
      }
    } else r = dispararSemMarcar(estado, hunt, personagem, p.slot, alvo, { plantada: p });
    if (r?.ok) eventos.push(...(r.eventos ?? []));
    // (lote E2B, 26/10) o que a ativação faz além do acerto: as explosões menores das Explosivas, o Solo Eletrizado da Relampejante Vaal, a Sifão ligada
    if (r?.ok && p.tipo === 'armadilha') depoisDaAtivacaoE2b(estado, hunt, personagem, p, r, eventos, agora);
    // (17/10, lote G3) as Armadilhas e Minas CARREGADAS: "X% de chance de receber uma Carga de Frenesi/Poder quando sua Armadilha for ativada
    // por um Inimigo" / "quando uma Mina … for Detonada focando um Inimigo"
    if (r?.ok && alvo) {
      const ef = Gemas.efeitoNaSkill(estado, p.acao);
      for (const tipo of ['frenesi', 'poder']) {
        const chance = Number(ef?.[`cargaAoAtivar:${tipo}`]) || 0;
        if (chance > 0 && Math.random() * 100 < chance && CargasPoe.ganhar(estado, tipo, ficha.afPoe)) Ficha.invalidar(estado);
      }
    }
    // ("X% de Chance das Armadilhas Ativarem uma vez adicional", "Minas têm uma chance de X% de serem Detonadas uma Vez Adicional": a
    // habilidade sai mais uma vez do mesmo lugar, no inimigo mais perto que sobrou.)
    // (lote E1b, 26/10: + a chance da PRÓPRIA gema na Armadilha — a qualidade da Glacial, da Relampejante…; a Flamejante da Explosão, 50% —, somada à das peças)
    const efDaPlantada = p.tipo === 'armadilha' ? Gemas.efeitoNaSkill(estado, p.acao) : null;
    const chanceDaGema = efDaPlantada ? GemasPoe.chanceDeAtivarDeNovoDaGema(String(p.acao).replace(GemasPoe.PREFIXO, ''), efDaPlantada.nivel ?? 1, efDaPlantada.qualidade ?? 0) : 0;
    const deNovo = chanceDaGema > 0 ? GemasE1b.ativaDeNovo(ModsPoe.valor(ficha, 'armadilha_ativa_de_novo'), chanceDaGema) : Plantadas.ativaDeNovo(ficha, p.tipo);
    if (r?.ok && deNovo && (estado.hp ?? 0) > 0) {
      const outro = alvo?.hp > 0 ? alvo : Plantadas.inimigoPerto(hunt, p, p.tipo === 'mina' ? Plantadas.PADRAO.mina.raioDeDetonacao : Plantadas.PADRAO.armadilha.raioDasProximas);
      const de = dispararSemMarcar(estado, hunt, personagem, p.slot, outro, { plantada: p });
      if (de?.ok) eventos.push(...(de.eventos ?? []));
      if (de?.ok && p.tipo === 'armadilha') depoisDaAtivacaoE2b(estado, hunt, personagem, p, de, eventos, agora);
    }
  }
  return eventos;
}

// ---------------------------------------------------------------- o LOTE E2B (26/10: as Armadilhas que pedem mecânica nova — `itens-poe/gemas-e2b.mjs`)

/** (lote E2B) "Minas tem Velocidade de Detonação aumentada em X%" — a qualidade da gema Detonar Minas encaixada (0 sem ela). */
function detonacaoDaGemaE2b(estado) {
  const id = `${GemasPoe.PREFIXO}Detonate_Mines`;
  if (!Gemas.skillsAtivas(estado).has(id)) return 0;
  return GemasPoe.detonacaoDaGemaDetonar(Gemas.efeitoNaSkill(estado, id)?.qualidade ?? 0);
}

/**
 * (lote E2B — o PoB) a AURA do Castigo / do Castigo Vaal ao acertar: o buff da gema (`GemasPoe.buffNoNivel` — o Raio adicional e a chance de Eletrizar) por a duração dela ×
 * a Duração da Habilidade, no raio da aura; renova a cada acerto. A do Castigo não vale com a do Vaal ligada (o PoB: AffectedByVaalSmite).
 */
function auraDoCastigoE2b(estado, hunt, entry, ef, buff, agora) {
  const slug = entry.poeGema.slug;
  if (slug === 'Smite' && hunt.buffs?.[`${GemasPoe.PREFIXO}Vaal_Smite`]?.ate > agora) return;
  const doPoe = GemasPoe.buffNoNivel(slug, ef?.nivel ?? 1, ef?.qualidade ?? 0);
  if (!doPoe) return;
  const raio = doPoe.raio ? raioDaAuraDe(estado, entry, doPoe.raio, 1, ef?.auraAreaIncPct ?? 0) : null;
  (hunt.buffs ??= {})[entry.id] = {
    // (a duração da gema — 4 s; a Vaal, 8 s —, não a da aura ligada)
    ate: agora + Math.round((GemasPoe.compilada(slug, ef?.nivel ?? 1, ef?.qualidade ?? 0)?.stats?.duracao ?? 4) * 1000 * fatorDeDuracao(estado, entry, ef)), desde: agora, tipo: buff?.tipo ?? 'poe-aura', fator: 1, efeitosPoe: efeitosDaMaldicao(doPoe.efeitos, ef, estado, entry), afPoe: doPoe.af,
    ...(raio ? { raio } : {}), ...(ef?.efeitoAuraPct ? { efeitoAuraPct: ef.efeitoAuraPct } : {}),
  };
  // (o do Vaal tira o do Castigo: os dois não valem juntos)
  if (slug === 'Vaal_Smite') delete hunt.buffs[`${GemasPoe.PREFIXO}Smite`];
  Ficha.invalidar(estado);
}
/** (lote E2B) "Aura faz com que Castigo ataque +1 alvos com relâmpagos": o +N do raio do Castigo com a aura do Castigo Vaal ligada (0 fora dela ou em outra gema). */
function alvosDaAuraDoCastigoVaal(estado, hunt, entry) {
  if (entry?.poeGema?.slug !== 'Smite') return 0;
  const id = `${GemasPoe.PREFIXO}Vaal_Smite`;
  if (!(hunt.buffs?.[id]?.ate > (hunt.clock ?? 0))) return 0;
  return GemasE2b.alvosDaAuraVaal(GemasPoe.textosDaGema('Vaal_Smite', Gemas.efeitoNaSkill(estado, id)?.nivel ?? 1).linhas);
}

/** O fator da Área de Efeito do uso de `entry` (a da ficha, a das tags da gema e a dos suportes): multiplica a área; o raio, √ dele. */
function fatorDaAreaE2b(estado, entry, ef) {
  const f = Ficha.combate(estado);
  const porTag = ModsPoe.somaPorTags(f, tagsPoeDaSkill(entry));
  return ModsPoe.fatorDaArea(ModsPoe.valor(f, 'area_inc') + (porTag.area_inc ?? 0) + (ef?.areaIncPct ?? 0), ModsPoe.valor(f, 'area_mais') + (porTag.area_mais ?? 0), ef?.areaMaisPct ?? 0);
}
/**
 * (lote E2B — o PoB, SeismicTrap) a ATIVAÇÃO da Armadilha Sísmica: o objeto que pulsa (`hunt.poeTorres` com `ondasE2b`) a cada 0,9 s ÷ (1 + a Velocidade de Arremesso de
 * Armadilhas aumentada — a dos suportes e a das peças, `cast_speed_tag@armadilha`) × o "mais" dela, pela duração (3,5 s × a Duração da Habilidade): ⌊duração ×
 * frequência⌋ pulsos, o primeiro um intervalo depois da ativação; cada pulso, N ondas na área (1,8 m × √ da Área). true se é a Sísmica.
 */
function sismicaNaAtivacao(estado, hunt, personagem, p, eventos, agora) {
  const slug = String(p.acao).replace(GemasPoe.PREFIXO, '');
  if (slug !== 'Seismic_Trap') return false;
  const entry = POR_ID.get(p.acao);
  const ef = Gemas.efeitoNaSkill(estado, p.acao);
  const d = GemasPoe.sismicaDaGema(slug, ef?.nivel ?? 1, ef?.qualidade ?? 0);
  if (!d || !entry) return false;
  const ficha = Ficha.combate(estado);
  const incPct = (ef?.velArremessoArmadilhaPct ?? 0) + (Number(ficha.afPoe?.['cast_speed_tag@armadilha']) || 0);
  const maisPct = ((1 + (ef?.velArremessoArmadilhaMaisPct ?? 0) / 100) * (1 + (GemasPoe.arremessoDaGema(slug, ef?.nivel ?? 1, ModsPoe.condicoesDe(estado, ficha.afPoe, null)).maisPct ?? 0) / 100) - 1) * 100;
  const durMs = Math.round(((GemasPoe.compilada(slug, ef?.nivel ?? 1, ef?.qualidade ?? 0)?.stats?.duracao ?? 3.5) * 1000) * fatorDeDuracao(estado, entry, ef));
  const { intervaloMs, pulsos } = GemasE2b.pulsosDaSismica(d, durMs, incPct, maisPct);
  if (!(pulsos > 0)) return true;
  const raio = Math.max(1, casasDoRaio(d.raioM * Math.sqrt(fatorDaAreaE2b(estado, entry, ef))));
  (hunt.poeTorres ??= []).push({ id: `sismica-${p.id}`, slot: p.slot, acao: p.acao, x: p.x, y: p.y, z: p.z, ate: agora + intervaloMs * pulsos, proxima: agora + intervaloMs, intervaloMs, areas: 0, ondasE2b: { n: d.ondas, chance: d.chance, raio }, plantada: { ...p } });
  if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x: p.x, y: p.y, casas: Areas.paraTela(Areas.quadrado({ x: p.x, y: p.y }, raio), p) });
  return true;
}
/**
 * (lote E2B) o que a ATIVAÇÃO de uma Armadilha do lote faz depois do acerto (`r`):
 *  - as Armadilhas Explosivas: as N explosões menores em casas sorteadas da área secundária (o raio secundário × √ da Área), cada uma com o raio menor × (1 ± 30%) × √ da
 *    Área — um acerto da gema em cada inimigo que ela pega (`soNoAlvo`);
 *  - a Relampejante Vaal: o Solo Eletrizado no caminho dos projéteis (os `shot` do uso), pela duração (4 s × a Duração) — `tiqueDoE2b` Eletriza quem está nele;
 *  - a Sifão de Gelo: liga a Regeneração pelos inimigos afetados (`tiqueDoE2b`).
 */
function depoisDaAtivacaoE2b(estado, hunt, personagem, p, r, eventos, agora) {
  const slug = String(p.acao).replace(GemasPoe.PREFIXO, '');
  if (!/^(Explosive_Trap(_of_Shrapnel)?|Vaal_Lightning_Trap|Siphoning_Trap)$/.test(slug)) return;
  const entry = POR_ID.get(p.acao);
  const ef = Gemas.efeitoNaSkill(estado, p.acao);
  if (!entry) return;
  const exp = GemasPoe.explosoesDaGema(slug, ef?.nivel ?? 1, ef?.qualidade ?? 0);
  if (exp) {
    const fArea = Math.sqrt(fatorDaAreaE2b(estado, entry, ef));
    const sec = Math.max(0, casasDoRaio(exp.raioSecundarioM * fArea));
    for (let k = 0; k < exp.n && (estado.hp ?? 0) > 0; k++) {
      const c = { x: p.x + Math.round((Math.random() * 2 - 1) * sec), y: p.y + Math.round((Math.random() * 2 - 1) * sec) };
      const raio = Math.max(0, casasDoRaio(GemasE2b.raioDaExplosaoMenor(exp) * fArea));
      const casas = Areas.quadrado(c, raio);
      if (entry.efeito) eventos.push({ t: 'area', id: entry.efeito, x: c.x, y: c.y, casas: Areas.paraTela(casas, c), sk: entry.id });
      for (const m of Areas.dentro(casas, (hunt.monstros ?? []).filter((b) => b.hp > 0 && !b.dummy && (b.z ?? p.z ?? 0) === (p.z ?? 0)))) {
        const o = dispararSemMarcar(estado, hunt, personagem, p.slot, m, { plantada: { ...p, x: c.x, y: c.y, soNoAlvo: true } });
        if (o?.ok) eventos.push(...(o.eventos ?? []));
      }
    }
  }
  const solo = GemasPoe.soloEletrizadoDaGema(slug, ef?.nivel ?? 1, ef?.qualidade ?? 0);
  if (solo) {
    // (os 9 projéteis em círculo da Armadilha — o primeiro na direção do alvo dela —, até o alcance do projétil; perfuram todos: vão até o fim)
    const alvoDoSolo = (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy).sort((a, b) => distanciaChebyshev(p, a) - distanciaChebyshev(p, b))[0];
    const a0 = alvoDoSolo && (alvoDoSolo.x !== p.x || alvoDoSolo.y !== p.y) ? Math.atan2(alvoDoSolo.y - p.y, alvoDoSolo.x - p.x) : 0;
    const nTiros = GemasPoe.compilada(slug, ef?.nivel ?? 1, ef?.qualidade ?? 0)?.stats?.projeteis ?? 1;
    const casas = GemasE2b.casasDoSolo({ x: p.x, y: p.y }, a0, nTiros, entry.range || ALCANCE_PADRAO);
    const durMs = Math.round(((GemasPoe.compilada(slug, ef?.nivel ?? 1, ef?.qualidade ?? 0)?.stats?.duracao ?? 4) * 1000) * fatorDeDuracao(estado, entry, ef));
    if (casas.length) hunt.poeSolosE2b = [...(hunt.poeSolosE2b ?? []).filter((s) => s.ate > agora), { casas, z: p.z ?? hunt.z ?? 0, ate: agora + durMs, efeitoPct: solo.efeitoPct, acao: p.acao }].slice(-6);
  }
  const sifao = GemasPoe.sifaoDaGema(slug, ef?.nivel ?? 1);
  if (sifao) hunt.poeSifaoE2b = { ...(hunt.poeSifaoE2b ?? {}), acao: p.acao, d: sifao, chave: slug, ate: agora + 500, n: hunt.poeSifaoE2b?.n ?? -1 };
}
/**
 * (lote E2B) o tique do lote: a Regeneração da Sifão de Gelo pelos inimigos com o debuff dela agora (o `hunt.poeSifaoE2b` sai sem nenhum — a ficha é refeita quando o
 * número muda) e a Eletrização de quem está no Solo Eletrizado da Relampejante Vaal.
 */
function tiqueDoE2b(estado, hunt, agora) {
  const s = hunt.poeSifaoE2b;
  if (s) {
    const n = GemasE2b.afetadosPeloSifao(hunt.monstros ?? [], s.chave);
    if (!n) { delete hunt.poeSifaoE2b; Ficha.invalidar(estado); }
    else {
      Object.assign(s, GemasE2b.regeneracaoDoSifao(s.d, n), { ate: agora + 500 });
      if (s.n !== n) { s.n = n; Ficha.invalidar(estado); }
    }
  }
  if (hunt.poeSolosE2b?.length) {
    hunt.poeSolosE2b = hunt.poeSolosE2b.filter((x) => x.ate > agora);
    GemasE2b.eletrizarNoSolo(hunt.monstros, hunt.poeSolosE2b, agora);
    if (!hunt.poeSolosE2b.length) delete hunt.poeSolosE2b;
  }
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
  eventos.unshift({ t: 'skill', sk: entry.id, uid: de?.tipo === 'totem' ? de.uid : 'player', x: de ? de.x : hunt.pos.x, y: de ? de.y : hunt.pos.y, ...(alvo ? { tx: alvo.x, ty: alvo.y, alvo: alvo.uid } : {}), ...(conjurada ? { semLancamento: true } : {}) });
}

/**
 * ---- Os SUPORTES DE GATILHO do PoE (dono, 06/10: "faça isso" — as magias ativadas) ----
 * Cada grupo de sockets ligados com um suporte de gatilho (`Gemas.gruposComGatilho`): quando o `evento` acontece (o ataque do grupo acerta
 * crítico, mata de perto, ou o personagem acumula o dano do limiar), as MAGIAS do grupo saem na hora — instantâneas, sem o relógio de uso,
 * pagando o custo e respeitando a recarga própria — e o gatilho entra na recarga dele (0,15 s na "Conjurar no Acerto Crítico").
 * Os eventos das magias entram nos do ataque. Devolve quantas saíram.
 */
// (lote A4, dono 19/10: D10: + o Atirar — `vezes` ativações, rodando as suportadas, com o "mais por Estágio do Tiro": `maisAcertoPct`/`maisAfeccaoPct`)
// (lote G-D, dono 25/10 — D16: + a Runa do Arcanista — `runa`: a ação da Runa Ativada, o grupo dela; o "menos Dano", o "mais contra o Vinculado" e o "menos Área" das suportadas)
export function ativarGatilhos(estado, hunt, personagem, evento, { acao = null, alvo = null, vezes = 1, maisAcertoPct = 0, maisAfeccaoPct = 0, runa = null, areaMaisPct = 0, vinculadoUid = null, contraVinculadoPct = 0 } = {}, eventos = []) {
  const cds = (hunt.cooldowns ??= {});
  const agora = hunt.clock ?? 0;
  let n = 0;
  for (const g of Gemas.gruposComGatilho(estado)) {
    if (g.gatilho.quando !== evento) continue;
    // (17/10, lote G15: a chance do gatilho — "X% de chance de Ativar Magias Suportadas quando você for Atordoado")
    if (g.gatilho.chance != null && !(Math.random() * 100 < g.gatilho.chance)) continue;
    // O ataque que dispara tem de estar no MESMO grupo (o dano recebido não tem ataque). (14/10: o Feiticeiro — qualquer ataque de varinha,
    // com ele LIGADO: a reserva dele.)
    if (acao && !g.feiticeiro && !g.automacao && !g.ataques.includes(acao)) continue;
    if (g.arcanista && g.arcanista !== runa) continue;
    if (g.feiticeiro && !(hunt.buffs?.[g.feiticeiro]?.ate > agora)) continue;
    // (lote A2) a Automação: só com ela ligada (o buff dela)
    if (g.automacao && !(hunt.buffs?.[g.automacao]?.ate > agora)) continue;
    const chave = `gatilho:${g.chave}`;
    if (cds[chave] && !R.liberou(agora, cds[chave].ate)) continue;
    let saiu = false;
    const lista = g.atirar ? Array.from({ length: Math.max(0, vezes | 0) }, (_, k) => g.magias[k % g.magias.length]) : g.magias;
    for (const magia of lista) {
      // O alvo do ataque, se ainda vive; senão o bicho vivo mais perto (o do crítico pode ter morrido no golpe).
      const alvoDaMagia = alvo && alvo.hp > 0 ? alvo : hunt.monstros.filter((b) => b.hp > 0).sort((a, b) => distanciaChebyshev(hunt.pos, a) - distanciaChebyshev(hunt.pos, b))[0] ?? null;
      // (as magias do Feiticeiro não custam: o custo delas virou a reserva dele)
      const robos = comRobos(estado);
      // (lote A2: a Automação — o "Multiplicador de Custo: 150%" da gema, no custo da suportada)
      const disparo = () => dispararSemMarcar(estado, hunt, personagem, null, alvoDaMagia, { gatilho: { acao: { id: magia, enabled: true, minMana: 0, minTargets: 1, conditions: [] }, ...(g.feiticeiro ? { semCusto: true } : {}), ...(g.automacao ? { custoMult: AUTOMACAO.custoMult } : {}), ...(g.atirar || g.arcanista || g.magoDeBatalha ? { maisAcertoPct, maisAfeccaoPct } : {}), ...(g.arcanista && areaMaisPct ? { areaMaisPct } : {}), ...(g.arcanista && vinculadoUid != null && contraVinculadoPct ? { vinculadoUid, contraVinculadoPct } : {}) } });
      const r = robos ? doLugarDoRobo(hunt, 0, disparo) : disparo();
      if (!r.ok) continue;
      saiu = true;
      n++;
      // (lote A2) "Habilidades Suportadas têm Velocidade de Recuperação da Recarga reduzida em X%" (com a qualidade, +0,25 por ponto): a recarga
      // própria da suportada, ÷ (1 + o valor com sinal)
      if (g.automacao && cds[magia]?.total > 0) {
        const rec = Number(hunt.buffs[g.automacao]?.a2?.recuperacaoPct) || 0;
        const total = Math.round(cds[magia].total / Math.max(0.1, 1 + rec / 100));
        cds[magia] = { ate: agora + total, total };
      }
      eventos.push({ t: 'gatilho', quem: personagem?.nome, suporte: g.nome, skill: POR_ID.get(magia)?.name ?? magia }, ...(r.eventos ?? []));
      // (os Robôs Ativadores: a mesma magia de novo, ignorando a recarga)
      if (robos) {
        const alvo2 = alvoDaMagia && alvoDaMagia.hp > 0 ? alvoDaMagia : hunt.monstros.filter((b) => b.hp > 0).sort((a, b) => distanciaChebyshev(hunt.pos, a) - distanciaChebyshev(hunt.pos, b))[0] ?? null;
        const r2 = doLugarDoRobo(hunt, 1, () => dispararSemMarcar(estado, hunt, personagem, null, alvo2, { gatilho: { acao: { id: magia, enabled: true, minMana: 0, minTargets: 1, conditions: [] }, ignorarRecarga: true, ...(g.feiticeiro ? { semCusto: true } : {}), ...(g.automacao ? { custoMult: AUTOMACAO.custoMult } : {}) } }));
        if (r2.ok) { n++; eventos.push({ t: 'gatilho', quem: personagem?.nome, suporte: ROBOS.nome, skill: POR_ID.get(magia)?.name ?? magia }, ...(r2.eventos ?? [])); }
      }
    }
    // (o Feiticeiro: 0,6 s ÷ a "Recuperação da Recarga" do nível dele; lote A2: a Automação, a recarga dela — 0,6 s)
    const recargaMs = g.feiticeiro ? GemasPoe.feiticeiroNoNivel(g.nivel).recargaMs : g.automacao ? GemasPoe.temposNoNivel('Automation', g.nivel).recargaMs || AUTOMACAO.recargaMs : g.gatilho.recargaMs;
    if (saiu && recargaMs) cds[chave] = { ate: agora + recargaMs, total: recargaMs };
  }
  return n;
}

// ---------------------------------------------------------------- o LOTE C3 (dono, 25/10: a Postura)

/**
 * (lote C3, dono 25/10 — D3.1) A TROCA DE POSTURA do Sangue e Areia ligado (o clique): Sangue ↔ Areia no buff (`GemasC3.trocarPostura`), a recarga da gema (2 s ÷ a
 * Velocidade de Recarga — o PoB: cooldown 2, storedUses 1), o "mudou de Postura Recentemente" (`mudouPostura`, os 4 s desde a troca) e o evento "ao mudar de Postura"
 * (`mudarPostura`), na hora — o tique (`ModsPoe.aurasProximas`) não conta a mesma troca de novo. Sem custo: a reserva já está paga.
 */
function trocarPosturaNoUso(estado, hunt, entry, action, agora) {
  const b = hunt.buffs[entry.id];
  const postura = GemasC3.trocarPostura(b, agora);
  const ef = Gemas.efeitoNaSkill(estado, entry.id);
  const recarga = Math.max(0, Math.round(temposDaGemaPoe(estado, entry, ef).recarga ?? 0));
  if (recarga > 0) (hunt.cooldowns ??= {})[action.id] = { ate: agora + recarga, total: recarga };
  Ficha.invalidar(estado);
  ModsPoe.marcar(hunt, 'mudouPostura', agora);
  ModsPoe.evento(estado, hunt, 'mudarPostura', Ficha.combate(estado), { agora });
  hunt.poePostura = postura;
  return { ok: true, eventos: [{ t: 'fx', id: 3, uid: 'player', x: hunt.pos.x, y: hunt.pos.y, sk: entry.id }], postura };
}

// ---------------------------------------------------------------- o LOTE A2 (dono, 19/10: as gemas "sem efeito" do PoE)

/** (lote A2) A Automação: o multiplicador de custo (PoB: 150%) e a recarga dela (0,6 s). */
export const AUTOMACAO = Object.freeze({ custoMult: 1.5, recargaMs: 600 });
const ESPADAS = /^(One_Hand_Swords|Two_Hand_Swords|Thrusting_One_Hand_Swords)$/;
const CAJADOS = /^(Staves|Warstaves)$/;
/**
 * (lote A2) As regras de USO das gemas do lote A2, antes do resto: `{ ok, … }` quando decidem (a recusa, ou o desligar), ou null (segue o uso).
 *  - a Lâmina de Energia e a Automação LIGADAS: o clique desliga ("Relançar a magia remove o bônus"); o automático não relança;
 *  - a Lâmina de Energia só com espada ("não pode ser ativada ou usada com armas que não sejam espadas"); o Cajado Impregnado, só com cajado;
 *  - o Berserk: "Ao menos 5 de Fúria necessário para entrar em Berserk"; no automático, sem a condição "Fúria ≥ N" no slot, só com a Fúria no máximo
 *    (dono, 19/10).
 */
function regrasDoUsoA2(estado, hunt, entry, action, { manual, gatilho, agora }) {
  const slug = entry.poeGema.slug;
  const ligadoAgora = hunt.buffs?.[entry.id]?.ate > agora;
  // (lote G-D, dono 25/10: + o Fogo Justo da Devoção — "usar de novo desliga", como o Fogo Justo do PoE)
  if ((slug === 'Energy_Blade' || slug === 'Automation' || GemasGBD.LIGADAS_GBD.has(slug)) && ligadoAgora && manual && !gatilho) {
    delete hunt.buffs[entry.id];
    for (const k of CHAVES_DO_FOGO_JUSTO) if (hunt[k]?.acao === entry.id) delete hunt[k];
    Ficha.invalidar(estado);
    return { ok: true, eventos: [{ t: 'fx', id: 3, uid: 'player', x: hunt.pos.x, y: hunt.pos.y, sk: entry.id }], desligou: true };
  }
  if (slug === 'Berserk' && !ligadoAgora) {
    const a2 = GemasPoe.daGemaA2(slug, Gemas.efeitoNaSkill(estado, entry.id)?.nivel ?? 1).a2;
    const furia = ModsPoe.furiaAtual(estado);
    if (furia < (a2.furiaMin ?? 5)) return { ok: false, erro: `Precisa de ao menos ${a2.furiaMin ?? 5} de Fúria (agora ${furia}).`, motivo: 'FURIA' };
    const comCondicao = (action?.conditions ?? []).some((c) => c?.kind === 'furia');
    if (!manual && !gatilho && !comCondicao && furia < ModsPoe.maximoDeFuria(Ficha.combate(estado).afPoe)) return { ok: false, erro: `Juntando Fúria para o Berserk (${furia}/${ModsPoe.maximoDeFuria(Ficha.combate(estado).afPoe)}).`, motivo: 'FURIA' };
  }
  return null;
}
/** (lote A2) O que o uso LIGA além do buff: o objeto no chão e a recarga do Berserk. `b`: o buff recém-ligado. */
function aoLigarA2(estado, hunt, entry, b, alvo, efeitoDaGema, eventos, agora) {
  if (!b) return;
  const slug = entry.poeGema.slug;
  const dur = Math.max(0, (b.ate ?? agora) - agora);
  if (slug === 'Frost_Shield' && GemasA2.porEscudoGelido(estado, hunt, b.a2, dur, agora)) eventos.push({ t: 'fx', id: 43, uid: 'player', x: hunt.pos.x, y: hunt.pos.y, sk: entry.id });
  if (slug === 'Sigil_of_Power' && GemasA2.porEmblema(hunt, b.a2, dur, agora)) eventos.push({ t: 'fx', id: 49, uid: 'player', x: hunt.pos.x, y: hunt.pos.y, sk: entry.id });
  if (slug === 'Wall_of_Force') {
    const p = GemasA2.porParede(hunt, alvo, b.a2, dur, agora);
    if (p) for (const c of p.casas) eventos.push({ t: 'fx', id: 4, uid: 'player', x: c.x, y: c.y, sk: entry.id });
  }
  if (slug === 'Berserk') b.recargaMs = temposDaGemaPoe(estado, entry, efeitoDaGema).recarga ?? 0;
}
/**
 * (lote A2) Os suportes do lote A2 no ACERTO da habilidade suportada (`dispararSemMarcar`, depois do dano):
 *  - Pacifismo: o ataque não mata — o golpe deixa o inimigo com 1 de Vida (`bicho.pacificado`; com 1 de Vida o ataque não sai e, no automático, o alvo vira o outro bicho mais perto — `dispararSemMarcar`);
 *  - Chance de Fugir / Pacifismo: a chance de o monstro FUGIR (2 s — dono, 19/10): o Mágico tem 50% de chance de evitar, o Raro e o Único não fogem;
 *  - Raridade de Itens: a raridade do abate vai no carimbo do golpe (`QuemFeriu.carimbar`, lida em `combate.raridadeDoDrop`); todo golpe sem o suporte a apaga.
 */
export const FUGA = Object.freeze({ duracaoMs: 2000, magicoEvitaPct: 50 });
function acertoDosSuportesA2(hunt, bicho, ef, { dano, ataque, agora, doTotem = false }) {
  if (ef.naoMata > 0 && ataque && bicho.hp < 1) { bicho.hp = 1; bicho.pacificado = agora; }
  if (dano > 0 && ef.chanceFugirPct > 0 && bicho.hp > 0) fugir(bicho, ef.chanceFugirPct, agora);
}
export function fugir(bicho, chance, agora, rng = Math.random) {
  // (as raridades do jogo — `gamedata/mobs/raridades.json`: o Mágico é `modificado`; o Raro, o Elite, o Único e o boss não fogem)
  const raridade = String(bicho?.raridade ?? bicho?.raridadePoe ?? '');
  if (!bicho || bicho.dummy || bicho.boss || bicho.chefe || bicho.isBoss || /raro|elite|unico|único|boss/i.test(raridade)) return false;
  if (!(rng() * 100 < chance)) return false;
  if (/modificado|magic|mágic/i.test(raridade) && rng() * 100 < FUGA.magicoEvitaPct) return false;
  (bicho.estados ??= {}).fugindo = { ate: agora + FUGA.duracaoMs };
  return true;
}
/**
 * (lote A2) O tique das gemas do lote A2 (`cacadas.tique`): o fim do Berserk (com a Fúria em 0, a recarga começa), a perda do Sangue Petrificado, as
 * imagens e a volta da Fenda Temporal, o dreno do Escudo Gélido, a Automação, e a ficha refeita quando o que elas dão muda (o estágio, você
 * entrando ou saindo da área).
 */
export function tiqueDasGemasA2(estado, hunt, personagem, eventos = [], agora = hunt?.clock ?? 0) {
  if (!itensPoeLigado() || !hunt) return;
  const cds = (hunt.cooldowns ??= {});
  if (GemasA2.tiqueDoBerserk(hunt, agora)) {
    encerrarBuffA2(hunt, GemasA2.ACAO.berserk, agora);
    Ficha.invalidar(estado);
  }
  GemasA2.tiqueDoSangue(estado, hunt, agora);
  GemasA2.tiqueDoEscudoGelido(estado, hunt, agora);
  // (o Emblema do Poder no máximo de estágios: os inimigos na área causam menos dano — `Reforcos.forcaDoBicho`)
  if (hunt.a2?.emblema) for (const m of hunt.monstros ?? []) {
    const pct = m.hp > 0 && !m.dummy ? GemasA2.menosDanoDoEmblema(hunt, m, agora) : 0;
    if (pct > 0) (m.estados ??= {}).emblema = { ate: agora + 500, pct };
  }
  GemasA2.fotografarFenda(estado, hunt, agora);
  const fenda = GemasA2.ligado(hunt, GemasA2.ACAO.fenda);
  // (revisão do A2: só com o personagem VIVO — a Fenda não revive)
  if (fenda && (estado.hp ?? 0) > 0 && R.liberou(agora, cds[GemasA2.ACAO.fenda]?.ate ?? -Infinity) && !hunt.conjurando) {
    const velha = GemasA2.voltaDaFenda(estado, hunt, agora);
    if (velha) {
      const entry = POR_ID.get(GemasA2.ACAO.fenda);
      const t = entry ? temposDaGemaPoe(estado, entry, Gemas.efeitoNaSkill(estado, entry.id)) : null;
      estado.hp = Math.min(estado.maxHp ?? velha.hp, Math.max(estado.hp ?? 0, velha.hp));
      estado.mana = Math.min(estado.maxMana ?? velha.mana, velha.mana);
      estado.es = Math.max(0, velha.es);
      // (revisão do A2: a Fenda DEFINE a Vida — não é recuperação: o teto do Sangue Petrificado parte dela)
      if (hunt.a2) hunt.a2.sangueVida = estado.hp;
      const livre = (velha.z ?? 0) === (hunt.z ?? 0) && !(hunt.monstros ?? []).some((m) => m.hp > 0 && m.x === velha.x && m.y === velha.y);
      eventos.push({ t: 'fx', id: EFEITO_DO_TELEPORTE, uid: 'player', x: hunt.pos.x, y: hunt.pos.y, sk: GemasA2.ACAO.fenda });
      if (livre) moverNoDeslocamento(hunt, { x: velha.x, y: velha.y }, agora);
      eventos.push({ t: 'fx', id: EFEITO_DO_TELEPORTE, uid: 'player', x: hunt.pos.x, y: hunt.pos.y, sk: GemasA2.ACAO.fenda });
      const recarga = t?.recarga ?? 3600;
      if (recarga > 0) cds[GemasA2.ACAO.fenda] = { ate: agora + recarga, total: recarga };
      hunt.a2.fenda = [];
    }
  }
  ativarGatilhos(estado, hunt, personagem, 'automacao', {}, eventos);
  // (o que vale na ficha mudou? — o estágio do Escudo/Emblema, você na área, as auras das sentinelas)
  // (lote G-B — D9: + o Emblema do Poder dos companheiros, com você na área dele)
  const assinatura = JSON.stringify([GemasA2.adds(estado) ?? {}, ...(hunt.partilha?.naSala ?? []).filter((o) => o && o !== estado && o.hunt).map((o) => GemasA2.emblemaDoAliado(o.hunt, hunt.pos, hunt.z ?? 0, o.hunt.clock ?? agora)).filter(Boolean)]);
  if ((hunt.a2?.assinatura ?? '[{}]') !== assinatura) { (hunt.a2 ??= {}).assinatura = assinatura; Ficha.invalidar(estado); }
}
/** (lote A2) Desliga um buff do lote A2; o que guarda a recarga do efeito (o Berserk: "não é recuperada durante seu efeito") a começa agora. */
export function encerrarBuffA2(hunt, id, agora = hunt?.clock ?? 0) {
  const b = hunt?.buffs?.[id];
  if (!b) return;
  delete hunt.buffs[id];
  if (b.recargaMs > 0) (hunt.cooldowns ??= {})[id] = { ate: agora + b.recargaMs, total: b.recargaMs };
}
/** (lote A2) A Fúria Sangrenta ao MATAR (a descrição: "Matar um inimigo enquanto este bônus está ativo reinicia a duração do bônus"). */
export function aoMatarA2(estado, hunt, agora = hunt?.clock ?? 0) {
  const b = GemasA2.ligado(hunt, GemasA2.ACAO.furiaSangrenta);
  if (b?.durMs > 0) b.ate = Math.max(b.ate, agora + b.durMs);
}
/**
 * (lote A2) A ONDA ARCANA do Cajado Impregnado de Mana (act_int.lua:13426-13516): ao bloquear, no máximo uma vez por segundo, uma onda em anel em
 * volta de você (o raio do dono: 2 casas) — Raio base igual a 73% da Mana máxima, o crítico de 6% da gema; o acerto é o das habilidades sem golpe
 * (`acertoDoArauto`, com as tags da gema). Devolve o dano total.
 */
export function ondaArcana(estado, hunt, personagem = null, eventos = [], agora = hunt?.clock ?? 0, rng = Math.random) {
  const b = GemasA2.ligado(hunt, GemasA2.ACAO.cajado);
  if (!b || !itensPoeLigado() || hunt.pvp || !hunt.pos || !CAJADOS.test(String(estado.equipment?.weapon?.poe?.classe ?? ''))) return 0;
  if (agora < (hunt.a2?.ondaEm ?? -Infinity)) return 0;
  (hunt.a2 ??= {}).ondaEm = agora + (Number(b.a2?.ondaCadaMs) || 1000);
  const bruto = ((estado.maxMana ?? 0) * (Number(b.a2?.ondaPctMana) || 0)) / 100;
  if (!(bruto > 0)) return 0;
  const raio = GemasA2.ONDA_ARCANA.raio;
  eventos.push({ t: 'explosao', uid: 'player', x: hunt.pos.x, y: hunt.pos.y, raio, fonte: 'onda-arcana', color: COR_DO_ELEMENTO.energy ?? '#ffe066' });
  let total = 0;
  for (const m of [...(hunt.monstros ?? [])]) {
    if (!(m.hp > 0) || m.dummy || (m.z ?? hunt.z ?? 0) !== (hunt.z ?? 0) || distanciaChebyshev(hunt.pos, m) > raio) continue;
    // (lote G-B, dono 25/10) a Eficácia do Dano Adicionado da Onda (o PoB: damageEffectiveness 4,5 — `ONDA_ARCANA.eficacia`) no dano adicionado às magias
    total += acertoDoArauto(estado, hunt, GemasA2.ACAO.cajado, m, bruto, 'energy', { eventos, rng, fonte: 'onda-arcana', personagem, critBase: GemasA2.ONDA_ARCANA.critBase, adicionadoMagia: GemasA2.ONDA_ARCANA.eficacia });
  }
  return total;
}

// ---------------------------------------------------------------- os LOTES G-B e G-D (dono, 25/10: as guardas e as mecânicas novas — `itens-poe/gemas-gbd.mjs`)

/** (D9) A Mana gasta por um efeito (o Manto Arcano) conta como a do custo: o "Gastou Mana Recentemente", o "ao Gastar Mana", o Emblema do Poder e as cargas. */
function manaGastaGBD(estado, hunt, personagem, gasto, agora) {
  if (!(gasto > 0)) return;
  hunt.poeManaGasta = [...(hunt.poeManaGasta ?? []).filter((x) => agora - x.t <= ModsPoe.RECENTE_MS), { t: agora, n: gasto }].slice(-40);
  ModsPoe.marcar(hunt, 'gastouMana');
  ModsPoe.evento(estado, hunt, 'gastarMana', Ficha.combate(estado), { personagem, quantidade: gasto, eventos: [] });
  if (GemasA2.aoGastarManaNoEmblema(hunt, gasto, agora)) Ficha.invalidar(estado);
  const regras = Ficha.combate(estado).cargas;
  if (regras && CargasPoe.aoGastarMana(estado, regras, gasto).length) Ficha.invalidar(estado);
}
/**
 * (lotes G-B e G-D) O que o uso faz ANTES de ligar o buff: `{ incPct, cargas?, gasto?, sacrificado? }` — o Chamado Imortal consome as Cargas de Tolerância ("+X% de
 * Duração do Buff por Carga removida" no `incPct`), o Manto Arcano gasta X% da Mana ATUAL, o Fogo Justo Vaal sacrifica X% da Vida e do Escudo de Energia máximos (sem
 * matar; o PoB: (Vida + ES) × X% é a base do dano).
 */
function antesDoBuffGBD(estado, hunt, entry, gbd, personagem, agora) {
  const r = { incPct: 0 };
  if (gbd.chamado) {
    const n = CargasPoe.gastar(estado, 'tolerancia', gbd.chamado.maxCargas);
    if (n) Ficha.invalidar(estado);
    r.cargas = n;
    r.incPct = gbd.chamado.duracaoPorCargaPct * n;
  }
  if (gbd.guarda?.gastaPct > 0) {
    const gasto = Math.floor(((estado.mana ?? 0) * gbd.guarda.gastaPct) / 100);
    if (gasto > 0) {
      estado.mana = Math.max(0, (estado.mana ?? 0) - gasto);
      manaGastaGBD(estado, hunt, personagem, gasto, agora);
    }
    r.gasto = gasto;
  }
  if (gbd.fogoJusto?.modo === 'sacrificio') {
    const maxEs = Math.max(0, Math.round(Ficha.combate(estado).energyShield ?? 0));
    const pct = gbd.fogoJusto.sacrificioPct / 100;
    const daVida = Math.min(Math.max(0, (estado.hp ?? 0) - 1), Math.round((estado.maxHp ?? 0) * pct));
    const doEs = Math.min(Math.max(0, estado.es ?? 0), Math.round(maxEs * pct));
    estado.hp = (estado.hp ?? 0) - daVida;
    estado.es = Math.max(0, (estado.es ?? 0) - doEs);
    r.sacrificado = ((estado.maxHp ?? 0) + maxEs) * pct;
  }
  return r;
}
/**
 * (lotes G-B e G-D) O que o uso LIGA além do buff `b`: guarda os números no buff (`b.gbd`), a absorção da Guarda (o limite pela Armadura de agora, já com o buff, ou pelo
 * gasto), o Raio adicional do Manto, o "menos Físico" do Chamado pelas cargas, o Imortal do Vaal, o gelo da Armadura Ártica Vaal (você Congelado até ele quebrar), o
 * Fogo Justo em volta e o Pacto de K'Tash; o Pacto pendente fortalece a gema de buff Vaal que causa dano (o Fogo Justo Vaal, a Carapaça Vaal).
 */
function aoLigarGBD(estado, hunt, entry, b, gbd, antes, efeitoDaGema, personagem, eventos, agora) {
  const slug = entry.poeGema.slug;
  b.gbd = gbd;
  if (gbd.recargaParada) b.recargaParada = true;
  let maisDoPacto = 1;
  if (hunt.poeKtash && GemasGBD.KTASH_NO_BUFF.has(slug)) {
    maisDoPacto = 1 + (hunt.poeKtash.maisPct ?? 0) / 100;
    if (hunt.poeKtash.devolveAlmas) hunt.poeKtashDevolve = entry.id;
    delete hunt.poeKtash;
  }
  if (gbd.guarda) {
    Ficha.invalidar(estado);
    const f = Ficha.combate(estado);
    // (dono, 26/10 — no merge com o G-A: a regra do PoE/PoB) o limite da absorção NÃO escala com o efeito do buff (o PoB: GuardAbsorbLimit e GuardAbsorbRate `unscalable`);
    // a qualidade "Efeito do Buff aumentado" do Manto (`b.efeitoBuffQualPct`, do G-A) vale no Raio adicional do gasto, pelo `afPoe` — `GemasPoe.adds`
    const limite = GemasGBD.limiteDaGuarda(gbd.guarda, { armadura: f.armor ?? 0, gasto: antes?.gasto ?? 0 });
    const reflete = gbd.guarda.reflete ? { ...gbd.guarda.reflete, pct: gbd.guarda.reflete.pct * maisDoPacto } : null;
    GemasGBD.porGuarda(hunt, { acao: entry.id, slug, pct: gbd.guarda.pct, limite, reflete }, agora);
    if (gbd.guarda.raioDoGastoPct > 0 && antes?.gasto > 0) {
      const v = Math.round((antes.gasto * gbd.guarda.raioDoGastoPct) / 100);
      const af = { ...(b.afPoe ?? {}) };
      for (const k of ['added_energy_dmg_min', 'added_energy_dmg_max', 'spell_added_energy_dmg_min', 'spell_added_energy_dmg_max']) af[k] = (af[k] ?? 0) + v;
      b.afPoe = af;
      Ficha.invalidar(estado);
    }
  }
  if (gbd.chamado) {
    if (gbd.chamado.vaal) { hunt.poeImortal = b.ate; hunt.poeImortalDe = entry.id; }
    else if (antes?.cargas > 0) {
      b.afPoe = { ...(b.afPoe ?? {}), dano_physical_recebido_mais: GemasGBD.fisicoDoChamado(b.afPoe?.dano_physical_recebido_mais ?? 0, gbd.chamado.fisicoPorCargaPct, antes.cargas) };
      Ficha.invalidar(estado);
    }
  }
  if (gbd.articaVaal && hunt.pos) {
    hunt.poeGeloVaal = { acao: entry.id, ate: b.ate, acertos: 0, max: Math.max(1, gbd.articaVaal.acertos), menosPct: gbd.articaVaal.menosPct };
    (hunt.controle ??= {}).congelado = { ate: b.ate, desde: agora, ms: Math.max(0, b.ate - agora), geloVaal: true };
    eventos.push({ t: 'estado', uid: 'player', quem: personagem?.nome, x: hunt.pos.x, y: hunt.pos.y, estado: 'congelado' });
  }
  if (gbd.fogoJusto) {
    const porS = gbd.fogoJusto.modo === 'sacrificio' ? GemasGBD.fogoJustoPorS(gbd.fogoJusto, { sacrificado: antes?.sacrificado ?? 0 }) * maisDoPacto : null;
    // (revisão G, 26/10) cada Fogo Justo no seu registro: o Vaal e o da Devoção podem estar ligados juntos (dois buffs, como no PoE) — o fim de um não apaga a queima do outro
    hunt[chaveDoFogoJusto(gbd.fogoJusto)] = { acao: entry.id, slug, ultimo: agora, ...(porS != null ? { porS } : {}) };
  }
  if (gbd.ktash) hunt.poeKtash = { acao: entry.id, maisPct: gbd.ktash.maisPct, devolveAlmas: !!gbd.ktash.devolveAlmas };
}
/**
 * (D5) Só UM buff de Guarda por vez: o novo (`idNovo`) tira os outros — a Carapaça tirada reflete o que absorveu (a exceção 2) e a recarga dela começa agora. A Guarda
 * pendente da mesma gema (o uso de novo) também acaba (reflete), sem tirar o buff novo.
 */
function trocarGuarda(estado, hunt, idNovo, personagem, eventos, agora) {
  for (const [id, b] of Object.entries(hunt.buffs ?? {})) if (id !== idNovo && b?.guarda && b.ate > agora) encerrarGuarda(estado, hunt, id, personagem, eventos, agora);
  if (hunt.poeGuarda) encerrarGuarda(estado, hunt, hunt.poeGuarda.acao, personagem, eventos, agora, { manterBuff: hunt.poeGuarda.acao === idNovo });
}
/**
 * O FIM da Guarda `id` (esgotada, vencida, trocada): a Carapaça reflete o que o buff tomou (3000% / 9000% como Fogo, sem os seus modificadores — `refletirDaCarapaca`), o
 * buff sai e, se acabou antes da hora, a recarga parada dele — e a das Guardas que a compartilharam — começa agora.
 */
function encerrarGuarda(estado, hunt, id, personagem, eventos, agora, { manterBuff = false } = {}) {
  const g = hunt.poeGuarda?.acao === id ? hunt.poeGuarda : null;
  if (g) {
    delete hunt.poeGuarda;
    if (g.reflete && g.absorvido > 0) refletirDaCarapaca(estado, hunt, personagem, GemasGBD.fogoRefletido(g, g.absorvido), g, eventos, agora);
  }
  const b = hunt.buffs?.[id];
  if (!b || manterBuff) return;
  // (revisão G, 26/10) a Guarda nova que troca o Chamado Imortal Vaal tira também o "não pode morrer" dele (uma Guarda por vez)
  if (hunt.poeImortal != null && (hunt.poeImortalDe ?? id) === id) { delete hunt.poeImortal; delete hunt.poeImortalDe; }
  const antesDaHora = b.ate > agora;
  delete hunt.buffs[id];
  Ficha.invalidar(estado);
  if (!antesDaHora || !(b.recargaMs > 0)) return;
  const cds = (hunt.cooldowns ??= {});
  if (b.recargaParada) cds[id] = { ate: agora + b.recargaMs, total: b.recargaMs };
  for (const outro of b.compartilhou ?? []) if (cds[outro]?.compartilhada === id) cds[outro] = { ate: cds[id]?.ate ?? agora + b.recargaMs, total: b.recargaMs, compartilhada: id };
}
/**
 * (D5) A REFLEXÃO da Carapaça Derretida: `valor` de Fogo (o absorvido × X%) em cada inimigo no raio dela em volta de você (1,5 m × √ da Área — a casa), pela resistência a
 * Fogo dele, sem os seus modificadores de dano (o PoE: "Reflected damage is not affected by your modifiers"). Devolve o total.
 */
function refletirDaCarapaca(estado, hunt, personagem, valor, g, eventos, agora) {
  if (!(valor > 0) || !hunt?.pos) return 0;
  const entry = POR_ID.get(g.acao);
  const fichaBase = Ficha.combate(estado);
  const porTag = entry ? ModsPoe.somaPorTags(fichaBase, tagsPoeDaSkill(entry)) : {};
  const ef = entry ? Gemas.efeitoNaSkill(estado, entry.id) : null;
  const raio = Math.max(1, Math.round(((g.reflete?.raioM ?? GemasGBD.CARAPACA.raioM) * Math.sqrt(ModsPoe.fatorDaArea(ModsPoe.valor(fichaBase, 'area_inc') + (porTag.area_inc ?? 0) + (ef?.areaIncPct ?? 0), ModsPoe.valor(fichaBase, 'area_mais') + (porTag.area_mais ?? 0), ef?.areaMaisPct ?? 0))) / 2));
  eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: hunt.pos.x, y: hunt.pos.y, lado: 2 * raio + 1, ...(entry ? { sk: entry.id } : {}) });
  let total = 0;
  for (const m of [...(hunt.monstros ?? [])]) {
    if (!(m.hp > 0) || m.dummy || (m.z ?? hunt.z ?? 0) !== (hunt.z ?? 0) || distanciaChebyshev(hunt.pos, m) > raio) continue;
    const dano = Math.round(resistido(hunt, m, 'fire', valor, null));
    if (!(dano > 0)) continue;
    m.hp -= dano;
    QuemFeriu.carimbar(m, QuemFeriu.VOCE, ['fogo', 'area', 'magia']);
    eventos.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v: dano, foe: true, spell: entry?.name ?? 'Carapaça Derretida', alvo: m.name, color: COR_DO_ELEMENTO.fire ?? '#ff6a00', fonte: 'carapaca', ...(entry ? { sk: entry.id } : {}) });
    total += dano;
  }
  return total;
}
/**
 * (lote G-B — D5, e D17) A recarga do uso: a Guarda com "A Recarga desta Habilidade não é recuperada durante seu efeito" começa a recarga no FIM do buff (o fim
 * antecipado a reinicia — `encerrarGuarda`), e a das Guardas não Vaal é COMPARTILHADA (as outras da barra recebem a mesma); o Pacto de K'Tash que fortaleceu esta magia
 * Vaal devolve as almas — a recarga volta pronta.
 */
function recargaDoGBD(estado, hunt, entry, action, cds, recarga, inicio) {
  if (hunt.poeKtashDevolve === entry.id) {
    delete hunt.poeKtashDevolve;
    cds[action.id] = { ate: inicio, total: 0 };
    return;
  }
  const tags = tagsPoeDaSkill(entry);
  const b = hunt.buffs?.[entry.id];
  if (!tags.includes('guarda') || !(recarga > 0) || !b || !(b.ate > inicio)) return;
  b.recargaMs = recarga;
  if (b.recargaParada) cds[action.id] = { ate: b.ate + recarga, total: recarga };
  if (tags.includes('vaal')) return;
  const minha = cds[action.id] ?? { ate: inicio + recarga, total: recarga };
  const lista = [];
  for (const a of estado.actions ?? []) {
    const outra = a?.id && a.id !== action.id ? POR_ID.get(a.id) : null;
    if (!outra?.poeGema) continue;
    const t2 = tagsPoeDaSkill(outra);
    if (!t2.includes('guarda') || t2.includes('vaal')) continue;
    if (!((cds[a.id]?.ate ?? -Infinity) >= minha.ate)) cds[a.id] = { ate: minha.ate, total: minha.total, compartilhada: action.id };
    lista.push(a.id);
  }
  if (lista.length) b.compartilhou = lista;
}
/**
 * (lotes G-B e G-D) O tique do lote (`cacadas.tique`): a reflexão por segundo da Carapaça Vaal e o fim da Guarda (esgotada ou vencida), o fim do Imortal e do gelo da
 * Armadura Ártica Vaal, a Fúria Sangrenta (o Dano Físico degenerativo em você — D8) e o Fogo Justo (`tiqueDoFogoJusto`).
 */
export function tiqueDasGemasGBD(estado, hunt, personagem, eventos = [], agora = hunt?.clock ?? 0) {
  if (!itensPoeLigado() || !hunt) return eventos;
  const g = hunt.poeGuarda;
  if (g) {
    const b = hunt.buffs?.[g.acao];
    if (g.reflete?.porSegundo && b) {
      while (g.proximoSegundo <= Math.min(agora, b.ate)) {
        if (g.noSegundo > 0) refletirDaCarapaca(estado, hunt, personagem, GemasGBD.fogoRefletido(g, g.noSegundo), g, eventos, g.proximoSegundo);
        g.noSegundo = 0;
        g.proximoSegundo += 1000;
      }
    }
    if (!b || !(b.ate > agora) || !(g.resta > 0)) encerrarGuarda(estado, hunt, g.acao, personagem, eventos, agora);
  }
  if (hunt.poeImortal != null && !(hunt.poeImortal > agora)) { delete hunt.poeImortal; delete hunt.poeImortalDe; }
  const gelo = hunt.poeGeloVaal;
  if (gelo && (!(gelo.ate > agora) || !(hunt.buffs?.[gelo.acao]?.ate > agora)) && GemasGBD.quebrarGelo(hunt, agora)) Ficha.invalidar(estado);
  // (D8) a Fúria Sangrenta: o PhysicalDegen do PoB — o Dano Físico degenerativo em você (o motor do dano contínuo no jogador: os modificadores de dano degenerativo
  // sofrido, o Escudo de Energia e a Vida; pode matar), renovado a cada tique enquanto o buff dura
  const furia = GemasA2.ligado(hunt, GemasA2.ACAO.furiaSangrenta);
  if (furia?.a2 && (furia.a2.degenVidaPct || furia.a2.degenEsPct) && (estado.hp ?? 0) > 0) {
    const es = Math.max(0, Math.round(Ficha.combate(estado).energyShield ?? 0));
    const porS = ((estado.maxHp ?? 0) * (furia.a2.degenVidaPct ?? 0) + es * (furia.a2.degenEsPct ?? 0)) / 100;
    if (porS > 0) Dot.aplicarNoJogador(hunt, { tipo: 'degenFisico', total: porS * (FURIA_SANGRENTA_MS / 1000), duracaoMs: FURIA_SANGRENTA_MS, origem: { fonte: 'proprio', mob: 'Fúria Sangrenta' } }, agora);
  }
  for (const k of CHAVES_DO_FOGO_JUSTO) tiqueDoFogoJusto(estado, hunt, personagem, eventos, agora, k);
  return eventos;
}
/** (D8) o degenerativo da Fúria Sangrenta é renovado a cada tique por meio segundo (um pulso do motor) — sem passar do fim do buff mais que isso */
const FURIA_SANGRENTA_MS = 500;
/**
 * (D18) O FOGO JUSTO ligado (a Devoção Arcana; o Vaal, pela duração): a queima em volta de você — o dano de Fogo base por segundo (a Devoção: X% da Mana máxima de agora; o
 * Vaal: o do sacrifício) pela conta do degenerativo da gema (os suportes, os "aumentados" e os multiplicadores; os modificadores de Dano Mágico na da Devoção), renovada a
 * cada tique por `FEIXE_MS` nos inimigos no raio (× √ da Área); e a da Devoção em você — X% da Mana máxima por segundo como Fogo, pela sua resistência a Fogo e os
 * modificadores de dano degenerativo sofrido, sem matar: com 1 de Vida o buff acaba.
 */
// (revisão G) o registro de cada Fogo Justo: o Vaal (o sacrifício) em `poeFogoJusto`; o da Devoção (a Mana) em `poeFogoJustoDevocao`
// (lote E2B, 26/10: + o Fogo Justo base — a Vida e o Escudo de Energia — em `poeFogoJustoBase`)
const CHAVES_DO_FOGO_JUSTO = ['poeFogoJusto', 'poeFogoJustoDevocao', 'poeFogoJustoBase'];
const chaveDoFogoJusto = (d) => (d?.modo === 'mana' ? 'poeFogoJustoDevocao' : d?.modo === 'vida' ? 'poeFogoJustoBase' : 'poeFogoJusto');
function tiqueDoFogoJusto(estado, hunt, personagem, eventos, agora, chave = 'poeFogoJusto') {
  const fj = hunt[chave];
  if (!fj) return;
  const b = hunt.buffs?.[fj.acao];
  const entry = POR_ID.get(fj.acao);
  const d = b?.gbd?.fogoJusto;
  if (!b || !(b.ate > agora) || !entry?.poeGema || !d || !hunt.pos) { delete hunt[chave]; return; }
  const dt = Math.max(0, agora - (fj.ultimo ?? agora));
  fj.ultimo = agora;
  const fichaBase = Ficha.combate(estado);
  const ef = Gemas.efeitoNaSkill(estado, entry.id);
  // (lote E2B, 26/10: o Fogo Justo base — X% da Vida máxima + Y% do Escudo de Energia máximo de agora)
  const maxEsRF = d.modo === 'vida' ? Math.max(0, Math.round(fichaBase.energyShield ?? 0)) : 0;
  const porS = d.modo === 'mana' ? GemasGBD.fogoJustoPorS(d, { maxMana: estado.maxMana ?? 0 }) : d.modo === 'vida' ? GemasE2b.fogoJustoBasePorS(d, { maxHp: estado.maxHp ?? 0, maxEs: maxEsRF }) : fj.porS ?? 0;
  if (porS > 0) {
    const { fatorDaGema, ficha, soAcertoDaFicha } = contaDoDano(estado, entry, ef, fichaBase);
    const conta = { efeitoDaGema: ef, ficha, fatorDaGema, soAcertoDaFicha, dotMagico: !!d.dotMagico };
    const porTag = ModsPoe.somaPorTags(fichaBase, tagsPoeDaSkill(entry));
    const raio = Math.max(1, Math.round((d.raioM * Math.sqrt(ModsPoe.fatorDaArea(ModsPoe.valor(fichaBase, 'area_inc') + (porTag.area_inc ?? 0) + (ef?.areaIncPct ?? 0), ModsPoe.valor(fichaBase, 'area_mais') + (porTag.area_mais ?? 0), ef?.areaMaisPct ?? 0))) / 2));
    const total = totalDoDegenerativo({ elemento: 'fire', dps: porS }, FEIXE_MS, conta);
    for (const m of hunt.monstros ?? []) {
      if (!(m.hp > 0) || m.dummy || (m.z ?? hunt.z ?? 0) !== (hunt.z ?? 0) || distanciaChebyshev(hunt.pos, m) > raio) continue;
      const posto = Dot.aplicar(m, { tipo: 'degenFogo', total, duracaoMs: FEIXE_MS, chave: entry.poeGema.slug, origem: { fonte: 'gema', habilidade: entry.id } }, agora);
      if (posto) QuemFeriu.carimbar(m, QuemFeriu.VOCE, tagsPoeDaSkill(entry));
    }
  }
  // (lote E2B: a base queima X% da Vida máxima + Y% do Escudo de Energia máximo por segundo — não letal, como a da Devoção)
  const queimaPorS = d.modo === 'vida' ? GemasE2b.queimaDoFogoJustoBasePorS(d, { maxHp: estado.maxHp ?? 0, maxEs: maxEsRF }) : d.queimaPctPorS > 0 ? ((estado.maxMana ?? 0) * d.queimaPctPorS) / 100 : 0;
  if (queimaPorS > 0 && dt > 0) {
    const menosDegen = Math.max(0, 1 - ModsPoe.valor(fichaBase, 'dano_degen_recebido_menos') / 100) * Math.max(0, 1 + ModsPoe.valor(fichaBase, 'dano_degen_recebido_pct') / 100);
    fj.resto = (fj.resto ?? 0) + (queimaPorS * (dt / 1000)) * ModsPoe.fatorDaResistenciaRecebida(fichaBase, 'fire') * menosDegen;
    const inteiro = Math.floor(fj.resto);
    if (inteiro > 0) { fj.resto -= inteiro; GemasGBD.queimarEmVoce(estado, inteiro); }
    if ((estado.hp ?? 0) <= 1) {
      delete hunt.buffs[fj.acao];
      delete hunt[chave];
      Ficha.invalidar(estado);
    }
  }
}
/**
 * (o dono, 25/10) o ESCUDO TEMPESTUOSO ligado, com escudo: ao BLOQUEAR, o raio sai no atacante e ricocheteia (o PoB: chanceToTriggerCounterattackOnBlock 100,
 * number_of_chains 1) — o acerto da gema pelo caminho do uso (`plantada` 'objeto' `comoUso`: o dano, os suportes, o crítico e o ricochete da gema), sem custo. Devolve se
 * saiu.
 */
export function escudoTempestuoso(estado, hunt, personagem, bicho, eventos = [], agora = hunt?.clock ?? 0) {
  const id = GemasGBD.ESCUDO_TEMPESTUOSO.acao;
  if (!itensPoeLigado() || !hunt?.pos || hunt.pvp || !bicho || !(bicho.hp > 0) || !(hunt.buffs?.[id]?.ate > agora) || !estado.equipment?.shield) return false;
  const r = dispararSemMarcar(estado, hunt, personagem, null, bicho, { plantada: { tipo: 'contragolpe', comoUso: true, acao: id, x: hunt.pos.x, y: hunt.pos.y, z: hunt.z ?? 0 } });
  if (!r?.ok) return false;
  eventos.push(...(r.eventos ?? []));
  return true;
}

/** (lote A2) O raio das auras de lacaio do jogo, em casas (o dos Robôs Ativadores; o Rejuvenescedor: 4 m = 2 casas) — as auras templárias. */
const AURA_DE_LACAIO_CASAS = 2;
/**
 * (lote A2) A LÂMINA DE ENERGIA ligada com espada (act_int.lua:5072-5169): o golpe da arma vira o Raio do seu Escudo de Energia — mínimo = 2% do
 * ES + o fixo do nível, máximo = 40% do ES + o fixo do nível (o ES já com o "50% menos" do buff); com espada de duas mãos, 70% mais. null sem ela.
 */
export function laminaDeEnergia(estado, ficha = Ficha.combate(estado)) {
  const b = itensPoeLigado() ? GemasA2.ligado(estado?.hunt, GemasA2.ACAO.lamina) : null;
  const classe = String(estado?.equipment?.weapon?.poe?.classe ?? '');
  if (!b || !ESPADAS.test(classe)) return null;
  const a2 = b.a2 ?? {};
  const es = Math.max(0, Number(ficha?.energyShield) || 0);
  const mais = classe === 'Two_Hand_Swords' ? 1 + (Number(a2.duasMaosMaisPct) || 0) / 100 : 1;
  const min = ((es * (Number(a2.minPctEs) || 0)) / 100 + (Number(a2.minFixo) || 0)) * mais;
  const max = ((es * (Number(a2.maxPctEs) || 0)) / 100 + (Number(a2.maxFixo) || 0)) * mais;
  return { min: Math.max(1, min), max: Math.max(1, max, min), elemento: 'energy' };
}
/**
 * (lote A2, revisão: "a arma vira a base Lâmina de Energia") A arma da FICHA com a Lâmina de Energia ligada e uma espada: a base Lâmina de Energia
 * (de uma ou de duas mãos — 1,7 / 1,6 ataques por segundo, 7% de crítico), sem nenhum mod da espada, com os encaixes dela (as gemas seguem); o Raio
 * do golpe é o de `laminaDeEnergia` pelo ES da ficha (`Ficha.combate`). Também vale no golpe básico, que lê a mesma ficha.
 */
export function laminaNaFicha(estado) {
  const b = itensPoeLigado() ? GemasA2.ligado(estado?.hunt, GemasA2.ACAO.lamina) : null;
  const espada = estado?.equipment?.weapon;
  const classe = String(espada?.poe?.classe ?? '');
  if (!b || !ESPADAS.test(classe)) return null;
  const duasMaos = classe === 'Two_Hand_Swords';
  const baseId = duasMaos ? 'Two_Hand_Swords/Energy_Blade' : 'One_Hand_Swords/Energy_Blade';
  const id = ItensPoeJogo.idDaBase(baseId);
  if (!id) return null;
  const virtual = { id, ...(espada.soquetes ? { soquetes: espada.soquetes } : {}), poe: { base: baseId, classe: duasMaos ? 'Two_Hand_Swords' : 'One_Hand_Swords', nome: 'Lâmina de Energia', af: {} } };
  const a2 = b.a2 ?? {};
  const mais = duasMaos ? 1 + (Number(a2.duasMaosMaisPct) || 0) / 100 : 1;
  return {
    estado: { ...estado, equipment: { ...estado.equipment, weapon: virtual } },
    raio: (es) => [((Math.max(0, es) * (Number(a2.minPctEs) || 0)) / 100 + (Number(a2.minFixo) || 0)) * mais, ((Math.max(0, es) * (Number(a2.maxPctEs) || 0)) / 100 + (Number(a2.maxFixo) || 0)) * mais],
  };
}
Ficha.definirLaminaNaFicha(laminaNaFicha);
/**
 * (lote A2, dono 19/10) A TORRE ÓSSEA (Bonespire, Excepcional — o poedb: "Clamores reforçados ativam Tomar a Carne ao usar"): o Clamor suportado
 * ergue as torres de osso em volta de você (as casas andáveis a até o alcance secundário — 2,4 m = 1 casa, a exceção (3) do dono), pela duração, até o máximo; a
 * recarga de Tomar a Carne (4 s) vale entre duas vezes.
 */
function torresOsseas(hunt, entry, ef, agora) {
  const eventos = [];
  if (!hunt?.pos || agora < (hunt.a2?.torresEm ?? -Infinity)) return eventos;
  (hunt.a2 ??= {}).torresEm = agora + (ef.torresRecargaMs ?? 4000);
  const andavel = ModsPoe.gradeDoCombate(hunt)?.andavel ?? null;
  const raio = Math.max(1, casasDoRaio(ef.torresAlcanceM ?? 2.4));
  const livres = [];
  for (let dx = -raio; dx <= raio; dx++) for (let dy = -raio; dy <= raio; dy++) {
    const c = { x: hunt.pos.x + dx, y: hunt.pos.y + dy };
    if ((dx || dy) && (!andavel || andavel.has(`${c.x},${c.y}`))) livres.push(c);
  }
  const lista = (hunt.a2.torres ?? []).filter((t) => t.ate > agora);
  for (let i = 0; i < Math.max(1, Math.floor(ef.torres ?? 6)) && livres.length; i++) {
    const [c] = livres.splice(Math.floor(Math.random() * livres.length), 1);
    lista.push({ x: c.x, y: c.y, z: hunt.z ?? 0, ate: agora + (ef.torresMs ?? 8000), acao: entry.id, danoPct: ef.torresDanoPct ?? 250, raioM: ef.torresRaioM ?? 4.5, sangramentoMaisPct: ef.torresSangramentoMaisPct ?? 0, sangram: !!ef.torresSangram });
    eventos.push({ t: 'fx', id: 2, uid: 'player', x: c.x, y: c.y, sk: entry.id });
  }
  hunt.a2.torres = lista.slice(-Math.max(1, ef.torresMax ?? 20));
  return eventos;
}
/**
 * (lote A4, dono 19/10) A ONDA DE CHOQUE DO VAZIO (Excepcional): "Habilidades Suportadas Ativam Onda de Choque no Acerto Corpo a Corpo" — uma vez a
 * cada recarga dela (0,5 s), em volta do acertado: o raio da onda ("O raio Base é de 2 metros", em casas — a fração é a chance), o "Dano de Ataque: X%
 * de base" (o físico médio da arma × isso — como a Torre Óssea, `acertoDoArauto`), × o "Dano Corpo a Corpo aumentado" da qualidade dela; "Onda de
 * choque se repete de até N inimigos na área" — cada um dos acertados (fora o do centro) solta outra, com o "-50% de dano com ataques e afecções".
 */
function ondaDoVazio(estado, hunt, entry, ef, centro, personagem, agora) {
  const eventos = [];
  // (lote S1: + a Onda de Choque comum — os usos da recarga, recuperados um de cada vez, e a "Velocidade de Recarga aumentada" dela)
  const recarga = Math.round((ef.ondaRecargaMs ?? 500) / Math.max(0.1, 1 + (ef.ondaRecargaIncPct ?? 0) / 100));
  const usos = Math.max(1, Math.floor(ef.ondaUsos ?? 1));
  if (usos > 1) {
    const l = (hunt.poeOndaDeChoqueUsos ?? []).filter((t) => t > agora);
    if (!centro || l.length >= usos) return eventos;
    l.push(Math.max(agora, l.at(-1) ?? agora) + recarga);
    hunt.poeOndaDeChoqueUsos = l;
  } else {
    if (!centro || agora < (hunt.poeOndaDoVazioAte ?? -Infinity)) return eventos;
    hunt.poeOndaDoVazioAte = agora + recarga;
  }
  const arma = armaSemAdicionado(Ficha.combate(estado));
  const tags = [...new Set([...tagsPoeDaSkill(entry), 'ataque', 'area', 'corpo', 'fisico'])];
  const onda = (c, pct) => {
    const r = Math.max(1, casasDoRaio(ef.ondaRaioM ?? 1.8));
    eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: c.x, y: c.y, lado: 2 * r + 1 });
    const acertados = [];
    for (const m of [...(hunt.monstros ?? [])]) {
      if (!(m.hp > 0) || m.dummy || (m.z ?? hunt.z ?? 0) !== (hunt.z ?? 0) || distanciaChebyshev(m, c) > r) continue;
      const bruto = ((arma.min + Math.random() * (arma.max - arma.min)) * (ef.ondaDanoPct ?? 100) * (1 + (ef.ondaIncPct ?? 0) / 100) * pct) / 10000;
      // (lote A5b: só quem foi acertado de fato — o errado não é centro de repetição)
      if (acertoDoArauto(estado, hunt, entry.id, m, bruto, 'physical', { tags, eventos, fonte: 'onda-do-vazio', personagem, ataque: true, adicionado: ((1 + (ef.ondaIncPct ?? 0) / 100) * pct) / 100 }) !== null) acertados.push(m);
    }
    return acertados;
  };
  const primeiros = onda(centro, 100);
  for (const m of primeiros.filter((b) => b !== centro).slice(0, ef.ondaRepeticoes ?? 0)) onda(m, Math.max(0, 100 + (ef.ondaRepeticaoMaisPct ?? -50)));
  return eventos;
}
/**
 * (lote A4, dono 19/10) A TORMENTA DO VAZIO (Excepcional): "Habilidades reforçadas ativam Tormenta do Vazio ao atingir o chão" (onde o ataque cai — a casa da forma
 * do uso ou o alvo), "não podem ser ativadas a menos de 3 metros de você", uma a cada recarga dela (0,5 s), até o máximo ("Máximo de 3 tempestades" —
 * a mais velha sai), pela duração ("Duração base é de 10 segundos"). `hunt.poeTormentas`; a explosão é no tique (`tiqueDasTormentas`).
 */
function porTormentaDoVazio(hunt, entry, ef, c, agora) {
  if (!hunt?.pos || agora < (hunt.poeTormentaAte ?? -Infinity)) return;
  if (distanciaChebyshev(hunt.pos, c) < Math.ceil((ef.tormentaMinM ?? 3) / 2)) return;
  hunt.poeTormentaAte = agora + (ef.tormentaRecargaMs ?? 500);
  const lista = (hunt.poeTormentas ??= []);
  lista.push({ acao: entry.id, x: c.x, y: c.y, z: hunt.z ?? 0, desde: agora, ate: agora + (ef.tormentaMs ?? 10000), raioM: ef.tormentaRaioM ?? 1.8, danoPct: ef.tormentaDanoPct ?? 100, incPct: ef.tormentaIncPct ?? 0,
    estagioMs: ef.tormentaEstagioMs ?? 200, estagiosMax: ef.tormentaEstagiosMax ?? 10, areaPorEstagioPct: ef.tormentaAreaPorEstagioPct ?? 0, danoPorEstagioPct: ef.tormentaDanoPorEstagioPct ?? 0 });
  hunt.poeTormentas = lista.slice(-Math.max(1, ef.tormentasMax ?? 3));
}
/**
 * (lote A4, dono 19/10) A tempestade no tempo: "ganham um estágio por 0.2 segundos, até 10"; "Ao entrar na tormenta, ela explode" — o inimigo no raio dela
 * ("+15% de área de efeito por estágio": o raio × √, em casas — o sorteio da fração uma vez por estágio) a explode, com "+40% de dano com ataques e
 * afecções por estágio", em todos os do raio. As vencidas somem.
 */
function tiqueDasTormentas(estado, hunt, personagem, eventos, agora) {
  const arma = armaSemAdicionado(Ficha.combate(estado));
  const ficam = [];
  for (const t of hunt.poeTormentas ?? []) {
    if (t.ate <= agora) continue;
    const estagio = Math.min(t.estagiosMax, Math.floor(Math.max(0, agora - t.desde) / Math.max(1, t.estagioMs)));
    if (t.raioDoEstagio?.estagio !== estagio) t.raioDoEstagio = { estagio, r: Math.max(0, casasDoRaio(t.raioM * Math.sqrt(1 + (t.areaPorEstagioPct * estagio) / 100))) };
    const r = t.raioDoEstagio.r;
    const dentro = (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && (m.z ?? hunt.z ?? 0) === (t.z ?? 0) && distanciaChebyshev(m, t) <= r);
    if (!dentro.length) { ficam.push(t); continue; }
    eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: t.x, y: t.y, lado: 2 * r + 1 });
    const entry = POR_ID.get(t.acao);
    const tags = [...new Set([...(entry ? tagsPoeDaSkill(entry) : []), 'ataque', 'area', 'fisico'])];
    for (const m of dentro) {
      const bruto = ((arma.min + Math.random() * (arma.max - arma.min)) * t.danoPct * (1 + t.incPct / 100) * (1 + (t.danoPorEstagioPct * estagio) / 100)) / 100;
      acertoDoArauto(estado, hunt, t.acao, m, bruto, 'physical', { tags, eventos, fonte: 'tormenta-do-vazio', personagem, ataque: true, adicionado: (1 + t.incPct / 100) * (1 + (t.danoPorEstagioPct * estagio) / 100) });
    }
  }
  hunt.poeTormentas = ficam;
  if (!ficam.length) delete hunt.poeTormentas;
}
/**
 * (lote A4, dono 19/10) O ORBE INVERNAL (o PoB, act_int.lua:20963): `hunt.poeOrbes` — um por gema, em você. O uso de canalização soma 1 estágio (até o
 * máximo: 8 + a qualidade "+2 Estágios Máximos") e renova a duração ("Duração base é de 1.6 segundos" × a Duração da Habilidade × "Duração aumentada em
 * 30% por Estágio", após o primeiro — WinterOrbStageAfterFirst).
 */
function carregarOrbe(estado, hunt, entry, efeito, orbe, agora) {
  const st = GemasPoe.compilada(entry.poeGema.slug, efeito?.nivel ?? 1, efeito?.qualidade ?? 0)?.stats ?? {};
  const max = Math.max(1, orbe.max ?? 8);
  const lista = (hunt.poeOrbes ??= []);
  let o = lista.find((x) => x.acao === entry.id && x.ate > agora);
  if (!o) {
    o = { acao: entry.id, estagios: 0, desde: agora, proxima: agora + orbe.intervaloMs, ...orbe };
    hunt.poeOrbes = [...lista.filter((x) => x.acao !== entry.id), o];
  }
  o.estagios = Math.min(max, o.estagios + 1);
  o.castSpeedPct = Number(Ficha.combate(estado).castSpeed ?? 0) + (efeito?.velConjuracaoPct ?? 0);
  o.duracaoBaseMs = (st.duracao ?? 1.6) * 1000 * fatorDeDuracao(estado, entry, efeito);
  o.ate = agora + duracaoDoEstagioDoOrbe(o);
}
/** (revisão do A4) A duração do orbe no estágio de agora: a base × "Duração aumentada em 30% por Estágio" (após o primeiro). */
const duracaoDoEstagioDoOrbe = (o) => Math.round((o.duracaoBaseMs ?? 1600) * (1 + (o.duracaoPorEstagioPct * Math.max(0, o.estagios - 1)) / 100));
/**
 * (lote A4, dono 19/10) O orbe no tempo: dispara os N projéteis ("Dispara 3 projéteis") a cada intervalo — "a cada 1.2 segundos" ÷ (1 + a Velocidade de
 * Conjuração + "20% de aumento da Frequência … por Estágio" após o primeiro, somadas — o display_frost_fury_additive_cast_speed_modifiers_apply_to_fire_speed)
 * ÷ "80% mais … enquanto Canalizando" (canalizando o orbe agora) —, cada um num inimigo sorteado a até 4 casas de você (a escolha sem fonte do lote),
 * pela habilidade da gema saindo do orbe (`dispararSemMarcar` com a `plantada` de tipo `orbe`). Os vencidos somem.
 */
function tiqueDoOrbe(estado, hunt, personagem, eventos, agora) {
  for (const o of hunt.poeOrbes ?? []) {
    let guarda = 0;
    // (revisão do A4, dono 19/10: "ao parar de canalizar, os estágios decaem com o tempo" — o PoB, act_int.lua:20969: no fim da duração de um
    // estágio, sem canalizar, o orbe perde 1 e segue com a duração do estágio novo — a frequência vai caindo; com 1 estágio, acaba)
    for (;;) {
      while (o.proxima <= Math.min(agora, o.ate) && (estado.hp ?? 0) > 0 && guarda++ < 50) {
        const canalizando = ModsPoe.canalizandoAgora(hunt, o.proxima) && hunt.canalizacao?.acao === o.acao;
        const freq = Math.max(0.1, 1 + ((o.velocidadeDeConjuracao ? o.castSpeedPct ?? 0 : 0) + o.frequenciaPorEstagioPct * Math.max(0, o.estagios - 1)) / 100) * (canalizando ? 1 + o.canalizandoMaisPct / 100 : 1);
        o.proxima += Math.max(50, Math.round(o.intervaloMs / freq));
        for (let k = 0; k < o.projeteis; k++) {
          const perto = (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && (m.z ?? hunt.z ?? 0) === (hunt.z ?? 0) && distanciaChebyshev(hunt.pos, m) <= o.raio);
          if (!perto.length) break;
          const alvo = perto[Math.min(perto.length - 1, Math.floor(Math.random() * perto.length))];
          const r = dispararSemMarcar(estado, hunt, personagem, null, alvo, { plantada: { tipo: 'orbe', acao: o.acao, x: hunt.pos.x, y: hunt.pos.y, z: hunt.z ?? 0 } });
          if (r?.ok) eventos.push(...(r.eventos ?? []));
        }
      }
      if (o.ate > agora || o.estagios <= 1 || guarda >= 50) break;
      o.estagios -= 1;
      o.ate += duracaoDoEstagioDoOrbe(o);
    }
  }
  hunt.poeOrbes = (hunt.poeOrbes ?? []).filter((o) => o.ate > agora);
  if (!hunt.poeOrbes.length) delete hunt.poeOrbes;
}
/**
 * (lote A4, dono 19/10: D5) As ESTACAS do Estilhaçar a Terra (o PoB, act_str.lua:3600-3640): uma na ponta de cada fissura, pela duração da gema (× a
 * Duração da Habilidade), até o máximo ("Máximo de 15 Estacas", + a qualidade — as mais velhas saem). `hunt.poeEstacas`.
 */
function porEstacas(estado, hunt, entry, efeito, casas, agora) {
  const seq = GemasPoe.sequenciaDaGema(entry.poeGema.slug, efeito?.nivel ?? 1, efeito?.qualidade ?? 0);
  if (!seq?.estacasMax) return;
  const durMs = Math.round((GemasPoe.compilada(entry.poeGema.slug, efeito?.nivel ?? 1, efeito?.qualidade ?? 0)?.stats?.duracao ?? 6) * 1000 * fatorDeDuracao(estado, entry, efeito));
  const lista = (hunt.poeEstacas ??= []);
  // (lote C1, dono 20/10) a estaca grande do Estilhaçar a Terra da Proeminência: "Estacas Despedaçadas têm X% mais Área de Efeito" — o raio da explosão (1 casa)
  // × √(1 + X%), sorteado na criação (a fração como a chance de uma casa a mais)
  const raioDaEstaca = () => {
    if (!seq.areaDaEstacaMaisPct) return seq.raioDaExplosao;
    const c = seq.raioDaExplosao * Math.sqrt(1 + seq.areaDaEstacaMaisPct / 100);
    return Math.trunc(c) + (Math.random() < c % 1 ? 1 : 0);
  };
  for (const c of casas) lista.push({ acao: entry.id, x: c.x, y: c.y, z: hunt.z ?? 0, ate: agora + durMs, maisPct: seq.explosaoMaisPct, raio: raioDaEstaca(), quebraSozinha: !!seq.quebraSozinha });
  const daAcao = lista.filter((e) => e.acao === entry.id);
  const sobra = new Set(daAcao.slice(0, Math.max(0, daAcao.length - seq.estacasMax)));
  if (sobra.size) hunt.poeEstacas = lista.filter((e) => !sobra.has(e));
}
/**
 * (lote A4, dono 19/10: D5) A EXPLOSÃO das estacas: cada uma sai do lugar dela como a habilidade da gema (`dispararSemMarcar` com a `plantada` de tipo `estaca`
 * — o golpe da gema, com o "−30%" do PoB: spike_slam_explosion_damage_+%_final), na área de 1 casa em volta (o raio da explosão não está nos dados —
 * a escolha sem fonte do lote), num inimigo vivo nela; sem inimigo, ela some mesmo assim. Devolve os eventos.
 */
function explodirEstacas(estado, hunt, personagem, quais) {
  const eventos = [];
  const tirar = new Set(quais);
  hunt.poeEstacas = (hunt.poeEstacas ?? []).filter((e) => !tirar.has(e));
  if (!hunt.poeEstacas.length) delete hunt.poeEstacas;
  for (const e of quais) {
    if ((estado.hp ?? 0) <= 0) break;
    const alvo = (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && (m.z ?? hunt.z ?? 0) === (e.z ?? 0) && distanciaChebyshev(m, e) <= e.raio).sort((a, b) => distanciaChebyshev(a, e) - distanciaChebyshev(b, e))[0] ?? null;
    eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: e.x, y: e.y, lado: 2 * e.raio + 1 });
    if (!alvo) continue;
    const r = dispararSemMarcar(estado, hunt, personagem, null, alvo, { plantada: { tipo: 'estaca', acao: e.acao, x: e.x, y: e.y, z: e.z, maisPct: e.maisPct, raio: e.raio } });
    if (r?.ok) eventos.push(...(r.eventos ?? []));
  }
  return eventos;
}
/** (lote A4, dono 19/10) As estacas no tempo: as vencidas somem; as da Fragilidade ("As estacas despedaçam depois de um tempo") explodem. */
function tiqueDasEstacas(estado, hunt, personagem, eventos, agora) {
  const vencidas = (hunt.poeEstacas ?? []).filter((e) => e.ate <= agora);
  if (!vencidas.length) return;
  const quebram = vencidas.filter((e) => e.quebraSozinha);
  hunt.poeEstacas = hunt.poeEstacas.filter((e) => e.ate > agora || e.quebraSozinha);
  if (quebram.length) eventos.push(...explodirEstacas(estado, hunt, personagem, quebram));
  else if (!hunt.poeEstacas.length) delete hunt.poeEstacas;
}

/**
 * (lote C2, dono 20/10) A RUNA da Vinculação da Tempestade: um objeto inerte no chão (`hunt.poeObjetos`, tipo `runa_tempestade`), na casa do alvo ou na mais perto
 * dele que ainda não tem runa (o "padrão crescente" — escolha do lote), por 12 s × a Duração, no nível 0. Devolve os eventos.
 */
function porRunaDaTempestade(estado, hunt, entry, efeitoDaGema, R, centro, agora) {
  const z = hunt.z ?? 0;
  const minhas = (hunt.poeObjetos ?? []).filter((o) => o.tipo === 'runa_tempestade' && (o.z ?? 0) === z && o.ate > agora);
  // (revisão C2, 21/10) só casa andável do jogo (a grade do combate): nada de runa em parede ou fora da grade — e o Teletransporte herda isso
  const andavel = ModsPoe.gradeDoCombate(hunt)?.andavel ?? null;
  const c = GemasC2.casaDaProximaRuna({ x: centro.x, y: centro.y }, minhas, 8, andavel ? (k) => andavel.has(`${k.x},${k.y}`) : null);
  if (!c) return [];
  porObjeto(hunt, { acao: entry.id, slug: entry.poeGema.slug, tipo: 'runa_tempestade', efeito: 'inerte', mov: 'parado', dono: 'voce', x: c.x, y: c.y, raio: 0, nivel: 0, ate: agora + Math.round(R.duracaoMs * fatorDeDuracao(estado, entry, efeitoDaGema)) }, agora);
  return [{ t: 'fx', id: entry.efeito ?? EFEITO_DA_EXPLOSAO, x: c.x, y: c.y }];
}
/** As runas da Vinculação na caçada (as do andar, vivas). */
const runasDaTempestade = (hunt, agora) => (hunt?.poeObjetos ?? []).filter((o) => o.tipo === 'runa_tempestade' && o.ate > agora && (o.z ?? 0) === (hunt.z ?? 0));
/**
 * (lote C2, dono 20/10: "criar a Explosão de Runas, como no PoE") A EXPLOSÃO DE RUNAS que a Vinculação concede, automática (o jogo é idle — como o Convocar o Aço
 * que as gemas de Aço concedem): com o relógio de ação livre e uma runa cuja explosão pega um inimigo vivo,
 *  - CANALIZA enquanto houver runa a melhorar e nenhuma das que pegam inimigo estiver a 1 s de acabar: cada uso (0,16 s ÷ a Velocidade de Conjuração) paga o
 *    custo dela, e cada "X de Mana Gasta" da Vinculação melhora a runa mais antiga que ainda não está no nível 3 (D2.6; uma vez por runa em cada uso, até 9);
 *  - senão, LIBERA: detona a runa que pega mais inimigos e, em cadeia, as ligadas a ela — cada uma com o golpe da Vinculação (a gema e os suportes dela), +100%
 *    de dano e +30% (+0,5 por qualidade) de área por nível, no raio de 1,6 m × √ da Área de Efeito; a do Teletransporte leva você à runa detonada se você não
 *    detonou runas nos últimos 0,5 s. Sem mana para a canalização, libera.
 * Devolve os eventos.
 */
/*
 * (revisão C2, 21/10) A Explosão não trava a barra: na caçada do modo PoE ela entra no LAÇO DA BARRA (`cacadas`), em cada volta, revezando com a barra (depois
 * de um uso dela a vez é da barra; a barra sem nada a fazer devolve a vez) — com o relógio lógico (`logico`: o uso conta de quando o relógio liberou dentro do
 * tique, como as magias da barra), então a Velocidade de Conjuração encurta de verdade os 0,16 s. E a CANALIZAÇÃO tem fim: melhora as runas que havia quando
 * ela começou (`canal`) — as que a Vinculação espalhar enquanto isso entram na próxima —, e libera quando nenhuma delas melhora mais (ou uma a 1 s do fim, ou
 * sem mana): como no PoE, em que canalizar a Explosão é não espalhar runas.
 */
export function explosaoDeRunas(estado, hunt, personagem, agora0 = hunt?.clock ?? 0, { logico = false } = {}) {
  if ((estado.hp ?? 0) <= 0 || hunt.conjurando || Protecao.imune(hunt)) return [];
  const cds = (hunt.cooldowns ??= {});
  if (cds[GRUPO_DO_POE] && !R.liberou(agora0, cds[GRUPO_DO_POE].ate)) return [];
  const agora = logico ? R.instanteLogico(agora0, hunt.relogioAnterior, [cds[GRUPO_DO_POE]?.ate]) : agora0;
  const runas = runasDaTempestade(hunt, agora);
  if (!runas.length) return [];
  // (a Vinculação encaixada que concede: a da runa mais nova — o nível e a qualidade dela)
  const acao = runas.at(-1).acao;
  const ef = Gemas.efeitoNaSkill(estado, acao);
  const slug = String(acao).replace(GemasPoe.PREFIXO, '');
  const Rr = ef ? GemasPoe.c2DaGema(slug, ef.nivel ?? 1, ef.qualidade ?? 0).runas : null;
  if (!Rr) return [];
  const fator = ModsPoe.fatorDaArea(ef.areaIncPct ?? 0, ef.areaMaisPct ?? 0);
  const vivos = vivosNoAndar(hunt);
  // (revisão C2, 21/10) o raio pela regra do jogo — m ÷ 2 e a fração vira a chance de uma casa a mais (`casasDoRaio`) —, sorteado uma vez por runa, nível e Área
  // (a decisão de qual runa pega e a explosão dela usam o mesmo)
  const raioDe = (r) => {
    const n = r.nivel ?? 0;
    if (r.raioSorteado?.nivel !== n || r.raioSorteado?.fator !== fator) r.raioSorteado = { nivel: n, fator, casas: Math.max(0, casasDoRaio(GemasC2.raioDaRunaM(Rr, n) * Math.sqrt(fator))) };
    return r.raioSorteado.casas;
  };
  const pega = (r) => vivos.filter((m) => !m.dummy && distanciaChebyshev(m, r) <= raioDe(r)).length;
  const comAlvo = runas.map((r) => ({ r, n: pega(r) })).filter((x) => x.n > 0);
  if (!comAlvo.length) return [];
  const ficha = Ficha.combate(estado);
  // (revisão C2, 21/10 — o PoB, RuneBlast) a conjuração: a da ficha + a das tags dela (Magia, Canalização, Arcano) + a dos suportes da Vinculação + 0,5% por qualidade;
  // o custo (6 a 26) com os mesmos modificadores do custo das gemas (o multiplicador dos suportes, "Custo de Mana aumentado", a eficiência, o fixo)
  const porTag = ModsPoe.somaPorTags(ficha, [...ModsPoe.tagsDoPoe(Rr.tagsDaExplosao ?? []), 'habilidade']);
  const vel = (ficha.castSpeed ?? 0) + (porTag.cast_speed_tag ?? 0) + (ef.velConjuracaoPct ?? 0) + (Rr.velConjuracaoPorQualidade ?? 0) * (ef.qualidade ?? 0);
  const usoMs = Math.round(Rr.explosaoMs / Math.max(0.1, 1 + vel / 100));
  const custo = (porTag.sem_custo_mana ?? 0) > 0 ? 0 : Math.max(0, Math.round((GemasC2.custoDaExplosao(ef.nivel ?? 1) * (1 + (ficha.custoDeMana ?? 0)) * (1 + (ef.custoPct ?? 0) / 100) * Math.max(0, 1 + (ModsPoe.valor(ficha, 'custo_mana_inc') + (porTag.custo_mana_inc ?? 0)) / 100) * Math.max(0, 1 + (ModsPoe.valor(ficha, 'custo_mana_mais') + (porTag.custo_mana_mais ?? 0)) / 100)) / Math.max(0.1, 1 + (ModsPoe.valor(ficha, 'eficiencia_custo_mana') + (porTag.eficiencia_custo_mana ?? 0)) / 100) + ModsPoe.valor(ficha, 'custo_mana_fixo') + (porTag.custo_mana_fixo ?? 0)));
  const g = (hunt.poeExplosaoDeRunas ??= { gasto: 0 });
  // (as runas da canalização de agora: as que havia quando ela começou, ainda vivas)
  const vivasIds = new Set(runas.map((r) => r.id));
  if (!g.canal?.some((id) => vivasIds.has(id))) g.canal = runas.map((r) => r.id);
  const doCanal = new Set(g.canal);
  const melhoravel = runas.some((r) => doCanal.has(r.id) && (r.nivel ?? 0) < Rr.nivelMax);
  const acabando = comAlvo.some((x) => x.r.ate - agora <= 1000);
  const eventos = [];
  if (melhoravel && !acabando && (estado.mana ?? 0) >= custo) {
    estado.mana = Math.max(0, (estado.mana ?? 0) - custo);
    g.gasto += custo;
    g.ultimoUso = agora;
    const n = Math.floor(g.gasto / Rr.manaPorMelhoria);
    const feitas = GemasC2.melhorarRunas(runas, n, Rr);
    g.gasto -= feitas.length * Rr.manaPorMelhoria;
    // (sem runa a melhorar, o gasto que sobrou não passa do custo de uma melhoria)
    g.gasto = Math.min(g.gasto, Rr.manaPorMelhoria);
    cds[GRUPO_DO_POE] = { ate: agora + usoMs, total: usoMs };
    for (const r of feitas) eventos.push({ t: 'fx', id: EFEITO_DA_EXPLOSAO, x: r.x, y: r.y });
    return eventos;
  }
  cds[GRUPO_DO_POE] = { ate: agora + usoMs, total: usoMs };
  g.ultimoUso = agora;
  delete g.canal;
  const alvo = comAlvo.sort((a, b) => b.n - a.n || distanciaChebyshev(hunt.pos, a.r) - distanciaChebyshev(hunt.pos, b.r))[0].r;
  const cadeia = GemasC2.cadeiaDeRunas(runas, alvo);
  consumirObjetos(hunt, cadeia);
  g.gasto = 0;
  // (a do Teletransporte: até a runa detonada, se você não detonou runas há 0,5 s — e a casa não tem bicho; revisão C2, 21/10: e é andável no jogo)
  const andavelDoTp = ModsPoe.gradeDoCombate(hunt)?.andavel ?? null;
  if (Rr.teleporta && agora - (hunt.poeUltimaDetonacao ?? -Infinity) >= Rr.teleporteMs && !vivos.some((m) => m.x === alvo.x && m.y === alvo.y) && (!andavelDoTp || andavelDoTp.has(`${alvo.x},${alvo.y}`))) {
    eventos.push({ t: 'fx', id: EFEITO_DO_TELEPORTE, uid: 'player', x: hunt.pos.x, y: hunt.pos.y });
    moverNoDeslocamento(hunt, { x: alvo.x, y: alvo.y }, agora);
    eventos.push({ t: 'fx', id: EFEITO_DO_TELEPORTE, uid: 'player', x: hunt.pos.x, y: hunt.pos.y });
  }
  hunt.poeUltimaDetonacao = agora;
  for (const r of cadeia) {
    if ((estado.hp ?? 0) <= 0) break;
    const raio = raioDe(r);
    eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: r.x, y: r.y, lado: 2 * raio + 1 });
    const quem = vivosNoAndar(hunt).filter((m) => !m.dummy && distanciaChebyshev(m, r) <= raio).sort((a, b) => distanciaChebyshev(a, r) - distanciaChebyshev(b, r))[0];
    if (!quem) continue;
    const res = dispararSemMarcar(estado, hunt, personagem, null, quem, { plantada: { tipo: 'estaca', acao: r.acao, x: r.x, y: r.y, z: r.z ?? hunt.z ?? 0, maisPct: Rr.maisDanoPorNivelPct * (r.nivel ?? 0), raio } });
    if (res?.ok) eventos.push(...(res.eventos ?? []));
  }
  return eventos;
}

/**
 * (lote C2, dono 20/10) O que o lote C2 deixa no tempo:
 *  - a Imolação do Golpe Infernal que ACABOU (o debuff em você, sem chegar às 6 cargas) explode com as cargas que tem, em volta de você — o golpe da gema × o "% por
 *    carga" × as cargas, no raio da gema × √ da Área (o PoB: "Upon reaching 6 charges, or charges expiring");
 *  - as correntes da Corrente com Gancho de Trarthus: o preso que morreu sai; o que ficou a mais que o comprimento da corrente de você (6 m: 3 casas) a ARREBENTA —
 *    o golpe da gema na área dela (2,4 m + o raio pela Fúria, × √ da Área) em volta dele ("When chains are broken, they snap and deal attack damage in an area
 *    around the target").
 * O golpe sai pelo caminho de sempre (`dispararSemMarcar` com a `plantada` de tipo `estaca`: a área em volta do ponto, com o "mais" da explosão). Devolve os eventos.
 */
function tiqueDoC2(estado, hunt, personagem, eventos, agora, comExplosao = true) {
  const noPonto = (acao, centro, raioM, pct, raioExtraM = 0) => {
    const ef = Gemas.efeitoNaSkill(estado, acao);
    if (!ef) return;
    const fator = ModsPoe.fatorDaArea(ef.areaIncPct ?? 0, ef.areaMaisPct ?? 0);
    const raio = Math.max(0, casasDoRaio((raioM + raioExtraM) * Math.sqrt(fator)));
    const z = hunt.z ?? 0;
    const alvo = (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && (m.z ?? z) === z && distanciaChebyshev(m, centro) <= raio).sort((a, b) => distanciaChebyshev(a, centro) - distanciaChebyshev(b, centro))[0] ?? null;
    eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: centro.x, y: centro.y, lado: 2 * raio + 1 });
    if (!alvo || (estado.hp ?? 0) <= 0) return;
    const r = dispararSemMarcar(estado, hunt, personagem, null, alvo, { plantada: { tipo: 'estaca', acao, x: centro.x, y: centro.y, z, maisPct: pct - 100, raio } });
    if (r?.ok) eventos.push(...(r.eventos ?? []));
  };
  // (a Vinculação da Tempestade) o Tolhimento de quem está numa runa ("Inimigos em cima das runas são Desacelerados", −50%) e a Explosão de Runas
  const runas = runasDaTempestade(hunt, agora);
  if (runas.length) {
    const casas = new Set(runas.map((r) => `${r.x},${r.y}`));
    // (lote C4, dono 21/10: o Tolhimento é o estado próprio, só de movimento e sem teto — `Estados.tolher`)
    // (revisão do C4, 21/10: + o "Inimigos Desacelerados por você têm Regeneração de Vida reduzida" — em todo Tolhimento seu)
    const regenMenos = ModsPoe.valor(Ficha.combate(estado), 'desacelerados_regen_red');
    for (const m of vivosNoAndar(hunt)) if (!m.dummy && casas.has(`${m.x},${m.y}`)) Estados.tolher(m, GemasC2.RUNAS_DA_TEMPESTADE.tolhePct, TOLHIMENTO_DAS_AREAS_MS, agora, regenMenos);
    if (comExplosao) eventos.push(...explosaoDeRunas(estado, hunt, personagem, agora));
  }
  const im = hunt.poeImolacao;
  if (im && im.ate <= agora) {
    delete hunt.poeImolacao;
    const slug = String(im.acao).replace(GemasPoe.PREFIXO, '');
    const ef = Gemas.efeitoNaSkill(estado, im.acao);
    const c2 = GemasPoe.c2DaGema(slug, ef?.nivel ?? 1, ef?.qualidade ?? 0);
    if (c2?.imolacao) noPonto(im.acao, { x: hunt.pos.x, y: hunt.pos.y }, GemasPoe.areaNoNivel(slug, ef?.nivel ?? 1, ef?.qualidade ?? 0).raioM ?? 2.9, GemasC2.pctDaExplosao(c2.imolacao, im.n));
  }
  if (hunt.poeCorrentes?.length) {
    const z = hunt.z ?? 0;
    const ficam = [];
    const arrebentam = [];
    for (const c of hunt.poeCorrentes) {
      const m = (hunt.monstros ?? []).find((b) => b.uid === c.uid);
      if (!m || !(m.hp > 0) || (m.z ?? z) !== z) continue;
      if (distanciaChebyshev(hunt.pos, m) > Math.floor((c.comprimentoM ?? 6) / 2)) arrebentam.push({ m, acao: c.acao });
      else ficam.push(c);
    }
    if (ficam.length) hunt.poeCorrentes = ficam;
    else delete hunt.poeCorrentes;
    for (const { m, acao } of arrebentam) {
      const slug = String(acao).replace(GemasPoe.PREFIXO, '');
      const ef = Gemas.efeitoNaSkill(estado, acao);
      if (!ef) continue;
      const raioM = GemasPoe.areaNoNivel(slug, ef.nivel ?? 1, ef.qualidade ?? 0).raioM ?? 2.4;
      noPonto(acao, { x: m.x, y: m.y }, raioM, 100, GemasA1b.raioExtraPelaFuria(GemasPoe.raioPorFuriaDaGema(slug, ef.nivel ?? 1), ModsPoe.furiaAtual(estado)));
    }
  }
  return eventos;
}

/*
 * ======================================================================= (lote A3b, dono 19/10) os OBJETOS no chão ou no tempo
 *
 * `hunt.poeObjetos` (JSON puro — `itens-poe/gemas-a3b.mjs`): `{ id, tipo, acao, slug, dono: 'voce'|'totem', z, x, y, mov, efeito, desde, ate, proxima,
 * intervaloMs, raio, … }`. O uso cria (`criarObjetosDoUso`); o tique os move e faz o efeito (`tiqueDosObjetos`); outras gemas os consomem (a Nova Glacial
 * dos Disparos, o Vórtice da Projeção, a Explosão de Lâminas, as Lâminas Giratórias). A tela os desenha (`objetosParaCliente`, `map.mjs`).
 */
const vivosNoAndar = (hunt, z = hunt.z ?? 0) => (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && (m.z ?? hunt.z ?? 0) === z);
function maisPertoDe(hunt, c, raio = Infinity, z = hunt.z ?? 0) {
  let melhor = null;
  let d0 = Infinity;
  for (const m of vivosNoAndar(hunt, z)) {
    const d = distanciaChebyshev(m, c);
    if (d <= raio && d < d0) { melhor = m; d0 = d; }
  }
  return melhor;
}
/** (D2) Os SEUS Disparos Congelantes no chão a até `raio` casas do alvo, os mais perto dele, até `max`. */
function disparosPerto(hunt, alvo, raio, max, agora) {
  return (hunt.poeObjetos ?? []).filter((o) => o.tipo === 'marcador' && o.dono === 'voce' && (o.z ?? 0) === (hunt.z ?? 0) && o.ate > agora && distanciaChebyshev(o, alvo) <= raio)
    .sort((a, b) => distanciaChebyshev(a, alvo) - distanciaChebyshev(b, alvo)).slice(0, Math.max(0, max));
}
/**
 * Põe o objeto `o` na lista, com o TETO: o da gema (os tornados, os chãos, as lâminas, os capturados — `o.max`) e, nos ativos (pulso, emitir, solo), os 20
 * por gema (D12); saem os mais velhos.
 */
function porObjeto(hunt, o, agora) {
  hunt.poeObjetosSeq = (hunt.poeObjetosSeq ?? 0) + 1;
  Object.assign(o, { id: `obj-${hunt.poeObjetosSeq}`, z: o.z ?? hunt.z ?? 0, desde: o.desde ?? agora });
  const lista = (hunt.poeObjetos ??= []);
  lista.push(o);
  const sai = new Set();
  const doTipo = lista.filter((x) => x.acao === o.acao && x.tipo === o.tipo && x.dono === o.dono);
  if (o.max != null && doTipo.length > o.max) for (const x of doTipo.slice(0, doTipo.length - o.max)) sai.add(x);
  if (o.efeito !== 'inerte') {
    const ativos = lista.filter((x) => x.acao === o.acao && x.dono === o.dono && x.efeito !== 'inerte' && !sai.has(x));
    if (ativos.length > GemasA3b.TETOS.ativosPorGema) for (const x of ativos.slice(0, ativos.length - GemasA3b.TETOS.ativosPorGema)) sai.add(x);
  }
  if (sai.size) hunt.poeObjetos = lista.filter((x) => !sai.has(x));
  return o;
}
/** O ponto onde o projétil que sai de `de` no ângulo `ang` para: a `alcance` casas, ou antes do terreno (a grade do andar). */
function fimDoVoo(hunt, de, ang, alcance = GemasA3b.ALCANCE) {
  const andavel = ModsPoe.gradeDoCombate(hunt)?.andavel ?? null;
  const fim = { x: Math.round(de.x + Math.cos(ang) * alcance), y: Math.round(de.y + Math.sin(ang) * alcance) };
  let ultimo = { x: de.x, y: de.y };
  for (const c of Areas.reta(de, fim, alcance)) {
    if (andavel && !andavel.has(Areas.chave(c))) break;
    ultimo = c;
  }
  return ultimo;
}
const RUMO_DA_DIRECAO = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

/**
 * (lote A3b, dono 19/10) Os OBJETOS que o uso deixa (`GemasPoe.objetoDaGema`): a BOLA RELAMPEJANTE (D4), o TORNADO (D7), a ESPIRAL (D10), o OLHO INVERNAL
 * (D11), o MARCADOR do Disparo Congelante (D1), o CHÃO do Vórtice e da Geada Rastejante (D5/D6 — o dano por segundo com a conta deste uso, `conta`), as
 * LÂMINAS PERSISTENTES (D8) e os CAPTURADOS da Espiral Venenosa (D9); e os Disparos que o Vórtice da Projeção destruiu (D2). Devolve os eventos.
 */
function criarObjetosDoUso(estado, hunt, entry, ef, { obj, alvo, mira, x, y, formaNoUso, emitidos = [], laminas, novas, velDoTiro = 1, conta, doTotem = false, dono = null, agora }) {
  const eventos = [];
  const slug = entry.poeGema.slug;
  const nivel = ef?.nivel ?? 1;
  const q = ef?.qualidade ?? 0;
  // (lote A5c, dono 20/10) a conversão "em Fogo, Gelo ou Raio" da gema (o Tornado da Turbulência Elemental — "Cria um Tornado de um elemento aleatório",
  // o PoB): o elemento é sorteado UMA vez por objeto, ao criá-lo, e vale em todos os golpes dele (`golpeDoObjeto` → `contaDoDano`)
  const sorteado = GemasPoe.conversaoDaMagia(slug, nivel).some((c) => c.para === 'aleatorio') ? ['fire', 'ice', 'energy'][Math.floor(Math.random() * 3)] : null;
  const base = { acao: entry.id, slug, el: entry.element ?? null, dono: doTotem ? 'totem' : 'voce', ...(doTotem && dono ? { donoPos: { x: dono.x, y: dono.y } } : {}), ...(sorteado ? { elementoSorteado: sorteado } : {}) };
  const raioEmCasas = (m) => Math.max(0, casasDoRaio(m * Math.sqrt(ModsPoe.fatorDaArea(ef?.areaIncPct ?? 0, ef?.areaMaisPct ?? 0))));
  const rumo = (para) => (para && (para.x !== x || para.y !== y) ? Math.atan2(para.y - y, para.x - x) : RUMO_DA_DIRECAO[hunt.pos?.dir ?? 2] ?? 0);
  const fd = fatorDeDuracao(estado, entry, ef);
  const extras = Math.max(0, Math.round((ef?.projeteisBase ?? 1) - 1) + Math.round(ef?.alvosExtras ?? 0));
  // (D2) o Vórtice da Projeção destrói os Disparos de que explodiu; a Nova Glacial, não
  if (novas?.consome?.destruir) {
    const sai = new Set(novas.marcas);
    hunt.poeObjetos = (hunt.poeObjetos ?? []).filter((o) => !sai.has(o));
  }
  if (!obj) return eventos;
  if (obj.tipo === 'bola') {
    // (D4) a bola: 2 s, um golpe a cada 0,15 s (o primeiro aos 0,15 s) em todos no raio; a velocidade (40 u/s × 1,33) × o mod de velocidade de projétil do uso
    const raio = raioEmCasas(GemasPoe.areaNoNivel(slug, nivel, q).raioM ?? 2);
    const vel = ((obj.velUnidades * (1 + obj.velMaisPct / 100)) / GemasA3b.UNIDADES_POR_CASA) * velDoTiro;
    const comum = { ...base, tipo: 'bola', efeito: 'pulso', raio, intervaloMs: obj.intervaloMs, proxima: agora + obj.intervaloMs, ate: agora + obj.duracaoMs };
    if (obj.mov === 'parado') {
      const c = mira ?? alvo ?? { x, y };
      porObjeto(hunt, { ...comum, mov: 'parado', x: c.x, y: c.y }, agora);
    } else if (obj.mov === 'orbita') {
      const ang0 = rumo(alvo);
      const r = obj.orbitaCasas;
      porObjeto(hunt, { ...comum, mov: 'orbita', x: Math.round(x + Math.cos(ang0) * r), y: Math.round(y + Math.sin(ang0) * r), ang0, r, omega: vel / r, ...(doTotem ? { cx: x, cy: y } : {}) }, agora);
    } else porObjeto(hunt, { ...comum, mov: 'reta', x, y, ox: x, oy: y, ang: rumo(alvo), vel }, agora);
  } else if (obj.tipo === 'tornado') {
    // (D7) o tornado: para a frente pela duração inicial, depois persegue pela secundária (a Turbulência só persegue); 1 casa a cada 0,5 s com o "+%"
    const f1 = Math.round(obj.fase1Ms * fd);
    const f2 = Math.round(obj.fase2Ms * fd);
    const passoMs = GemasA3b.passoComVelocidade(obj.passoMs, obj.velIncPct);
    porObjeto(hunt, {
      ...base, tipo: 'tornado', mov: f1 > 0 ? 'reta' : 'persegue', x, y, ox: x, oy: y, ang: rumo(alvo), vel: obj.velCasasS * (1 + obj.velIncPct / 100), passoMs, proximoPasso: agora + passoMs, busca: obj.buscaCasas,
      ...(f1 > 0 ? { depois: { em: agora + f1, mov: 'persegue' }, fase: 1 } : { fase: 2 }), efeito: 'pulso', raio: raioEmCasas(2 * obj.raio), intervaloMs: obj.intervaloMs, proxima: agora + obj.intervaloMs,
      ate: agora + f1 + f2, max: obj.max, lentidaoPct: obj.lentidaoPct, ...(obj.absorve ? { absorve: { max: obj.absorve.max, pct: obj.absorve.pct, n: 0, guardado: 0 } } : {}),
    }, agora);
  } else if (obj.tipo === 'espiral') {
    // (D10) a espiral: N projéteis no tempo dela (um a cada tempo ÷ N; o espelhado, dois por vez); a Faísca Vaal soma os "+N projéteis" ao total
    const n = obj.n + (slug === 'Vaal_Spark' ? extras : 0);
    porObjeto(hunt, { ...base, tipo: 'espiral', mov: doTotem ? 'parado' : 'no_dono', x, y, efeito: 'emitir', n, feitos: 0, a0: rumo(alvo), angulo: obj.angulo, ini: obj.ini, espelhado: obj.espelhado, intervaloMs: obj.ms / n, proxima: agora, ate: agora + obj.ms }, agora);
  } else if (obj.tipo === 'escudo') {
    // (lote PR1, dono 20/10) o Arremesso de Escudo Espectral de Trarthus: o escudo para no local mirado e solta as estilhas — N por vez, a primeira rajada aos 0,6 s,
    // cada intervalo 40% mais rápido (`GemasPR1.rajadasDoEscudo`), até todas saírem; cada estilha com o "X% menos Dano" da gema
    const n = Math.max(0, Math.round(ef?.estilhasDoObjeto ?? 0));
    const rajadas = GemasPR1.rajadasDoEscudo(n, obj);
    if (rajadas.length) {
      const c = mira ?? alvo ?? { x, y };
      porObjeto(hunt, { ...base, tipo: 'escudo', mov: 'parado', x: c.x, y: c.y, efeito: 'emitir', n, feitos: 0, porVez: obj.porVez, maisPct: -obj.menosPct, aceleraPct: obj.aceleraPct, intervaloMs: obj.intervaloMs, proxima: agora + obj.intervaloMs, ate: agora + Math.ceil(rajadas[rajadas.length - 1].em) + 1 }, agora);
    }
  } else if (obj.tipo === 'esfera') {
    // (A3b-2) a Esfera do Vazio: parada no lugar mirado, pela duração, uma por vez; o raio da gema (ao menos 1 casa)
    const c = mira ?? alvo ?? { x, y };
    porObjeto(hunt, { ...base, tipo: 'esfera', mov: 'parado', x: c.x, y: c.y, efeito: 'pulso', raio: Math.max(1, raioEmCasas(GemasPoe.areaNoNivel(slug, nivel, q).raioM ?? 3.8)), intervaloMs: obj.intervaloMs, proxima: agora + obj.intervaloMs, ate: agora + Math.round((GemasPoe.compilada(slug, nivel, q)?.stats?.duracao ?? 5) * 1000 * fd), max: obj.max, tolhePct: obj.tolhePct }, agora);
  } else if (obj.tipo === 'tempestade') {
    // (A3b-2) a Tormenta Flamejante: no lugar mirado, um impacto a cada intervalo num ponto sorteado da área onde as bolas caem; até o máximo de tempestades
    const c = mira ?? alvo ?? { x, y };
    const fator = ModsPoe.fatorDaArea(ef?.areaIncPct ?? 0, ef?.areaMaisPct ?? 0);
    // (lote B2, dono 20/10) a Tormenta Flamejante VAAL (`GemasB2.tormentaVaalDasLinhas`): N impactos ("16 Tiros"), um a cada 0,5 s — o fim é o do último —, cada impacto
    // com o "20% mais Efeito em Área" e o Solo Ardente dele (o dano degenerativo da gema, a conta deste uso), pela duração do solo × a Duração (`pulsarObjeto`)
    const vaal = obj.total > 0;
    const dg = vaal && obj.soloMs > 0 ? GemasPoe.degenerativoNoNivel(slug, nivel, q) : null;
    porObjeto(hunt, { ...base, tipo: 'tempestade', mov: 'parado', x: c.x, y: c.y, efeito: 'pulso', raio: Math.max(1, casasDoRaio(obj.areaM * Math.sqrt(fator))), raioImpactoM: (GemasPoe.areaNoNivel(slug, nivel, q).raioM ?? 1.3) * Math.sqrt(fator) * Math.sqrt(1 + (obj.impactoAreaMaisPct ?? 0) / 100), feitos: 0, primeiroMaisPct: obj.primeiroMaisPct, primeiroAreaPct: obj.primeiroAreaPct, intervaloMs: obj.intervaloMs, proxima: agora + obj.intervaloMs, ate: vaal ? agora + obj.intervaloMs * obj.total : agora + Math.round((GemasPoe.compilada(slug, nivel, q)?.stats?.duracao ?? 1.4) * 1000 * fd), max: obj.max,
      ...(dg ? { soloMs: Math.round(obj.soloMs * fd), soloPartes: dg.partes.map((p) => ({ tipo: GemasPoe.DEGEN_DO_ELEMENTO[p.elemento], elemento: p.elemento, porSegundo: totalDoDegenerativo(p, 1000, conta) })) } : {}) }, agora);
  } else if (obj.tipo === 'explosaoDivina' || obj.tipo === 'orbeDivino' || obj.tipo === 'tormentaVaal' || obj.tipo === 'carregamento') {
    // (lote B3, dono 21/10) os objetos do lote B3, no local mirado (`GemasB3.objetoDaGema`):
    //  - a RAJADA DIVINA: a explosão sai depois da duração (1,2 s × a Duração), no raio dela (2,6 m + o da qualidade, × √ da Área), com o "100% mais" nos acertos e nas
    //    afecções (`maisAcertoEAfeccaoPct`) — a implosão é o acerto do uso;
    //  - a do ESPLENDOR: o orbe fica a duração (5 s × a Duração) e explode a cada 1 s ÷ (1 + a Velocidade de Ataque aumentada — "Increases and reductions to attack speed
    //    affect the rate"), no raio dele; até 3 orbes (saem os mais velhos);
    //  - a INVOCAR TORMENTA VAAL: o marcador pela duração (× a Duração); a cada 0,2 s × a Duração, um golpe num inimigo sorteado a até o raio final do marcador (4 m × √
    //    da Área), no raio da gema em volta dele; no fim, o raio grande no marcador (`pulsarObjeto`);
    //  - o TIRO TORNADO DA NUVEM EXPLOSIVA: a flecha carregada cai no local e, no tique seguinte, as N flechas saem de lá em volta (360° ÷ N — `emitirDoObjeto`)
    const c = mira ?? formaNoUso ?? alvo ?? { x, y };
    if (obj.tipo === 'explosaoDivina') {
      const atraso = Math.max(1, Math.round(obj.atrasoMs * fd));
      porObjeto(hunt, { ...base, tipo: 'explosaoDivina', mov: 'parado', x: c.x, y: c.y, efeito: 'pulso', raio: raioEmCasas(obj.raioM), intervaloMs: atraso, proxima: agora + atraso, ate: agora + atraso, maisAcertoEAfeccaoPct: obj.maisPct }, agora);
    } else if (obj.tipo === 'orbeDivino') {
      const ficha = Ficha.combate(estado);
      const inc = (ficha.velocidadeDeAtaque ?? 0) + (ef?.velAtaquePct ?? 0) + (ModsPoe.somaPorTags(ficha, tagsPoeDaSkill(entry)).atk_speed ?? 0);
      const intervaloMs = obj.intervaloMs / Math.max(0.1, 1 + inc / 100);
      porObjeto(hunt, { ...base, tipo: 'orbeDivino', mov: 'parado', x: c.x, y: c.y, efeito: 'pulso', raio: raioEmCasas(obj.raioM), intervaloMs, proxima: agora + intervaloMs, ate: agora + Math.round(obj.duracaoMs * fd), max: obj.max }, agora);
    } else if (obj.tipo === 'tormentaVaal') {
      const intervaloMs = Math.max(1, Math.round(obj.intervaloMs * fd));
      porObjeto(hunt, { ...base, tipo: 'tormentaVaal', mov: 'parado', x: c.x, y: c.y, efeito: 'pulso', raio: raioEmCasas(GemasPoe.areaNoNivel(slug, nivel, q).raioM ?? 1.6), raioFinal: Math.max(1, raioEmCasas(obj.raioFinalM)), intervaloMs, proxima: agora + intervaloMs, ate: agora + Math.round(obj.duracaoMs * fd) }, agora);
    } else {
      const n = Math.max(1, Math.round(ef?.projeteisBase ?? 1) + Math.max(0, Math.round(ef?.alvosExtras ?? 0)));
      porObjeto(hunt, { ...base, tipo: 'carregamento', mov: 'parado', x: c.x, y: c.y, efeito: 'emitir', n, feitos: 0, a0: Math.random() * 2 * Math.PI, intervaloMs: 1, proxima: agora, ate: agora + 1 }, agora);
    }
  } else if (obj.tipo === 'voltaxica') {
    // (lote B2, dono 20/10) a EXPLOSÃO VOLTÁXICA: cada uso espera a duração (× os modificadores de duração) em você e solta a explosão em volta de onde você estiver, no
    // raio da gema (× √ da Área do uso; a fração, a chance de uma casa a mais) — com o "mais" pelas outras que ainda aguardam (`pulsarObjeto`)
    const atraso = Math.max(1, Math.round(obj.atrasoMs * fd));
    const r0 = ((GemasPoe.areaNoNivel(slug, nivel, q).raioM ?? 2.5) * Math.sqrt(ModsPoe.fatorDaArea(ef?.areaIncPct ?? 0, ef?.areaMaisPct ?? 0))) / 2;
    porObjeto(hunt, { ...base, tipo: 'voltaxica', mov: doTotem ? 'parado' : 'no_dono', x, y, efeito: 'pulso', raio: Math.trunc(r0) + (Math.random() < r0 % 1 ? 1 : 0), intervaloMs: atraso, proxima: agora + atraso, ate: agora + atraso, porAguardandoPct: obj.porAguardandoPct }, agora);
  } else if (obj.tipo === 'vortice') {
    // (A3b-2) o Vórtice de Lâminas: cada uso põe uma lâmina (pela duração) no vórtice em você, até o máximo — saem as mais velhas; a Vaal é um vórtice próprio,
    // com as 10 lâminas, que anda até os inimigos perto
    const durMs = Math.round(obj.duracaoMs * fd);
    const raio = Math.max(1, raioEmCasas(GemasPoe.areaNoNivel(slug, nivel, q).raioM ?? 1.6));
    const comum = { ...base, tipo: 'vortice', efeito: 'pulso', raio, baseMs: obj.baseMs, incPorLaminaPct: obj.incPorLaminaPct, maisPorLaminaPct: obj.maisPorLaminaPct, max: 1 };
    if (obj.vaal) {
      const ate = agora + durMs;
      porObjeto(hunt, { ...comum, mov: 'persegue', x, y, passoMs: obj.passoMs, proximoPasso: agora + obj.passoMs, busca: obj.buscaCasas, laminas: Array(obj.fixas).fill(ate), intervaloMs: GemasA3b.intervaloDoVortice(obj.baseMs, obj.incPorLaminaPct, obj.fixas), proxima: agora + GemasA3b.intervaloDoVortice(obj.baseMs, obj.incPorLaminaPct, obj.fixas), ate, vaal: true }, agora);
    } else {
      const ja = (hunt.poeObjetos ?? []).find((o) => o.tipo === 'vortice' && o.acao === entry.id && o.dono === base.dono && !o.vaal && o.ate > agora);
      if (ja) {
        ja.laminas = [...ja.laminas.filter((a) => a > agora), agora + durMs].slice(-Math.max(1, obj.max));
        ja.ate = Math.max(...ja.laminas);
        ja.raio = raio;
        ja.maxLaminas = obj.max;
        // (o próximo golpe já sai no intervalo das lâminas de agora, contado do último)
        ja.intervaloMs = GemasA3b.intervaloDoVortice(ja.baseMs, ja.incPorLaminaPct, ja.laminas.length);
        ja.proxima = Math.max(agora, Math.min(ja.proxima, (ja.ultimoPulso ?? ja.desde) + ja.intervaloMs));
      } else {
        const intervaloMs = GemasA3b.intervaloDoVortice(obj.baseMs, obj.incPorLaminaPct, 1);
        porObjeto(hunt, { ...comum, mov: doTotem ? 'parado' : 'no_dono', x, y, laminas: [agora + durMs], maxLaminas: obj.max, intervaloMs, proxima: agora + intervaloMs, ate: agora + durMs }, agora);
      }
    }
  } else if (obj.tipo === 'olho') {
    // (D11) o olho: voa até 7 casas (ou o terreno), solta 1 fragmento a cada 0,1 s e a espiral do fim; os "+N projéteis" só no fim
    const vel = obj.velCasasS * velDoTiro;
    const voo = Math.round((1000 * GemasA3b.ALCANCE) / Math.max(0.1, vel));
    // (revisão do A3b: a Transitoriedade solta os N — + os "+N", que nela valem nos Fragmentos — espalhados pelo voo, em espiral de 360° ÷ N, sem a do fim)
    const n = obj.fim + extras;
    const doVoo = obj.noVoo ? { intervaloMs: voo / Math.max(1, n), proxima: agora + voo / Math.max(1, n), passoGraus: 360 / Math.max(1, n), noVooMax: n, fim: 0 } : { intervaloMs: obj.fragmentoMs, proxima: agora + obj.fragmentoMs, passoGraus: obj.passoGraus, fim: n };
    porObjeto(hunt, { ...base, tipo: 'olho', mov: 'reta', x, y, ox: x, oy: y, ang: rumo(alvo), vel, efeito: 'emitir', feitos: 0, ...doVoo, ate: agora + voo }, agora);
  } else if (obj.tipo === 'tormenta') {
    // (lote B1, dono 20/10 — D-B1.10) o MARCADOR da Invocar Tormenta: no alvo (ou na mira), o raio cai nele depois da duração (× os modificadores), uma vez, na
    // área da gema (× √ da Área do uso, a fração como chance)
    const c = mira ?? alvo ?? formaNoUso ?? { x, y };
    const atraso = Math.max(1, Math.round(obj.atrasoMs * fd));
    const raioM = GemasPoe.areaNoNivel(slug, nivel, q).raioM ?? 2;
    const r0 = (raioM * Math.sqrt(ModsPoe.fatorDaArea(ef?.areaIncPct ?? 0, ef?.areaMaisPct ?? 0))) / 2;
    porObjeto(hunt, { ...base, tipo: 'tormenta', mov: 'parado', x: c.x, y: c.y, efeito: 'pulso', raio: Math.trunc(r0) + (Math.random() < r0 % 1 ? 1 : 0), intervaloMs: atraso, proxima: agora + atraso, ate: agora + atraso }, agora);
  } else if (obj.tipo === 'marcador' && !doTotem) {
    // (D1) um marcador no fim do voo de cada projétil (a 7 casas, ou antes do terreno), por 2 s ÷ o mod de velocidade de projétil do uso
    const voos = emitidos.length ? emitidos : alvo ? [{ de: { x, y }, para: alvo }] : [];
    for (const p of voos) {
      const ang = p.para.x === p.de.x && p.para.y === p.de.y ? rumo(alvo) : Math.atan2(p.para.y - p.de.y, p.para.x - p.de.x);
      const c = fimDoVoo(hunt, p.de, ang);
      porObjeto(hunt, { ...base, tipo: 'marcador', mov: 'parado', efeito: 'inerte', x: c.x, y: c.y, ate: agora + Math.round(obj.vidaMs / Math.max(0.05, velDoTiro)), max: GemasA3b.TETOS.ativosPorGema }, agora);
    }
  } else if (obj.tipo === 'chao') {
    // (D5) o chão: o Vórtice no centro da nova (ou em cada Disparo do Vórtice da Projeção), a Geada onde o projétil parou; o dano por segundo é o do uso
    const dg = GemasPoe.degenerativoNoNivel(slug, nivel, q);
    if (dg) {
      const partes = dg.partes.map((p) => ({ tipo: GemasPoe.DEGEN_DO_ELEMENTO[p.elemento], elemento: p.elemento, porSegundo: totalDoDegenerativo(p, 1000, conta) }));
      const durMs = Math.round(dg.duracaoMs * fd);
      const raio = raioEmCasas(obj.raioM);
      const centros = obj.persegue ? (emitidos.length ? emitidos.map((p) => p.para) : alvo ? [alvo] : []) : novas?.marcas?.length ? novas.marcas : [formaNoUso ?? { x, y }];
      const fria = obj.persegue ? ModsPoe.AREAS_FRIAS.porGema[slug] : null;
      for (const c of centros) {
        const passoMs = obj.persegue ? GemasA3b.passoComVelocidade(obj.persegue.passoMs, obj.persegue.velIncPct) : 0;
        const o = porObjeto(hunt, { ...base, tipo: 'chao', mov: obj.persegue ? 'persegue' : 'parado', x: c.x, y: c.y, efeito: 'solo', raio, partes, ultimo: agora, ate: agora + durMs, max: obj.max, ...(obj.persegue ? { passoMs, proximoPasso: agora + passoMs, busca: obj.persegue.buscaCasas } : {}) }, agora);
        if (fria) ModsPoe.criarAreaFria(hunt, { x: c.x, y: c.y, raioM: fria.raioM, segundos: durMs / 1000, obj: o.id });
      }
    }
  } else if (obj.tipo === 'laminas') {
    // (D8) as Lâminas Persistentes: 6 s (× a Duração), até 40, sem dano
    for (const c of laminas ?? []) porObjeto(hunt, { ...base, tipo: 'lamina', mov: 'parado', efeito: 'inerte', x: c.x, y: c.y, ate: agora + Math.round(obj.duracaoMs * fd), max: obj.max }, agora);
  } else if (obj.tipo === 'captura' && !doTotem) {
    // (D9) cada projétil do uso que voltou é capturado (todos voltam, no modelo); a Vaal: os iniciais na hora e mais N por segundo pela duração secundária
    const durMs = Math.round(obj.duracaoMs * fd);
    const capturado = () => porObjeto(hunt, { ...base, tipo: 'capturado', mov: 'no_dono', efeito: 'inerte', x: hunt.pos.x, y: hunt.pos.y, ate: agora + durMs, max: obj.max, manterPct: obj.manterPct }, agora);
    if (obj.vaal) {
      for (let i = 0; i < obj.iniciais; i++) capturado();
      if (obj.porS > 0) porObjeto(hunt, { ...base, tipo: 'captador', mov: 'no_dono', efeito: 'capturar', x: hunt.pos.x, y: hunt.pos.y, intervaloMs: 1000 / obj.porS, proxima: agora + 1000 / obj.porS, ate: agora + Math.round(obj.emitirMs * fd), max: 1, capturaMax: obj.max, capturaMs: durMs, manterPct: obj.manterPct }, agora);
    } else for (let i = 0; i < Math.max(1, emitidos.length); i++) capturado();
  } else if (GemasC3.TIPOS.has(obj.tipo)) {
    // (lote C3, dono 25/10) as tempestades, o abalo, os Martelos Cadentes e o orbe da Tormenta Explosiva (`criarObjetoC3`)
    criarObjetoC3(estado, hunt, entry, ef, obj, { base, x, y, alvo, mira, formaNoUso, fd, doTotem, agora });
  } else if (obj.tipo === 'flechaTempestade' || obj.tipo === 'orbeTempestade' || obj.tipo === 'hidroesfera' || obj.tipo === 'paredeGelo' || obj.tipo === 'paredeFogo') {
    eventos.push(...criarObjetosB4(estado, hunt, entry, ef, obj, { base, alvo, mira, x, y, formaNoUso, extras, fd, conta, agora }));
  }
  return eventos;
}

/**
 * (lote C3, dono 25/10) Os OBJETOS do lote C3 (`GemasC3.objetoDaGema`), pelo mecanismo do A3b:
 *  - a TEMPESTADE DE LÂMINAS: onde você está, na sua Postura (a da Incerteza: 50% de chance da outra), pela duração (3 s × a Duração), até o máximo (3 + a qualidade —
 *    saem as mais velhas); acerta todos no raio (2 m × √ da Área) a cada tempo de ataque da gema (D3.2), com o "50% menos"; a de Sangue Sangra, a de Areia Cega. (O
 *    "move-se lentamente para a frente" da de Areia — a velocidade que o PoE não publica — fica parado: pendência do dono.)
 *  - a TEMPESTADE FURIOSA: com ao menos 10 de Fúria; sacrifica ⌊Fúria × X%⌋ (10% mais dano por Fúria sacrificada, +0,1 m de raio por 2) e vai atrás dos inimigos
 *    (1 casa a cada 0,5 s até o vivo mais perto a até 7 casas — o passo do Tornado), por 3 s × a Duração; a do Berserker fica presa em você, sem sacrificar e sem
 *    duração, gastando a Fúria (`tiqueDoC3`); acerta a cada tempo de ataque ÷ 3,5 (D3.2); 1 por vez;
 *  - o ABALO (D3.4): no ponto do impacto, estoura uma vez depois da duração (× a Duração), no raio 2,8 m × √ da Área (× √ do "mais Área" da Amplificação); o Vaal liga
 *    os abalos dos ataques seguintes (`hunt.poeAbaloVaal` — `abaloVaalNoAtaque`);
 *  - os MARTELOS CADENTES: em você, a cada 0,7 s ÷ (1 + a Velocidade de Ataque aumentada), 3 martelos em inimigos sorteados no raio da varrida em volta de você;
 *  - o ORBE da Tormenta Explosiva (D3.5): nasce em você e acerta na hora, salta a cada 0,4 s; explode quando a canalização para (`tiqueDoC3`).
 */
function criarObjetoC3(estado, hunt, entry, ef, obj, { base, x, y, alvo, mira, formaNoUso, fd, doTotem, agora }) {
  const slug = entry.poeGema.slug;
  const nivel = ef?.nivel ?? 1;
  const q = ef?.qualidade ?? 0;
  const fatorA = ModsPoe.fatorDaArea(ef?.areaIncPct ?? 0, ef?.areaMaisPct ?? 0);
  const casasDe = (m, mais = 1) => Math.max(0, casasDoRaio(m * Math.sqrt(fatorA * mais)));
  if (obj.tipo === 'tempestadeDeLaminas') {
    const postura = GemasC3.posturaDaTempestade(obj, ModsPoe.posturaDe(hunt, agora));
    const intervaloMs = Math.max(50, Math.round(temposDaGemaPoe(estado, entry, ef).uso ?? 1000));
    porObjeto(hunt, { ...base, tipo: 'tempestadeDeLaminas', mov: 'parado', x, y, efeito: 'pulso', raio: casasDe(obj.raioM), postura, sangra: obj.sangra && postura === 'sangue', menosPct: obj.menosPct, intervaloMs, proxima: agora + intervaloMs, ate: agora + Math.round(obj.duracaoMs * fd), max: obj.max }, agora);
  } else if (obj.tipo === 'tempestadeFuriosa') {
    if (doTotem) return;
    const furia = ModsPoe.furiaAtual(estado);
    if (furia < obj.furiaMin) return;
    const sac = obj.presa ? 0 : GemasC3.furiaSacrificada(obj, furia);
    if (sac > 0 && hunt.furia) { hunt.furia.n = Math.max(0, (hunt.furia.n | 0) - sac); Ficha.invalidar(estado); }
    const raio = casasDe(GemasC3.raioDaTempestadeFuriosaM(obj, GemasPoe.areaNoNivel(slug, nivel, q).raioM ?? 1.8, sac));
    const intervaloMs = GemasC3.intervaloDaTempestadeFuriosa(obj, temposDaGemaPoe(estado, entry, ef).uso ?? 1000);
    const comum = { ...base, tipo: 'tempestadeFuriosa', efeito: 'pulso', raio, maisPct: obj.maisPorFuriaPct * sac, sacrificada: sac, intervaloMs, proxima: agora + intervaloMs, max: obj.max };
    if (obj.presa) porObjeto(hunt, { ...comum, mov: 'no_dono', x: hunt.pos.x, y: hunt.pos.y, presa: true, perda: { perdaPorS: obj.perdaPorS, perdaMaisPorSPct: obj.perdaMaisPorSPct }, perdaAte: agora, perdaAcum: 0, ate: agora + 3_600_000 }, agora);
    else porObjeto(hunt, { ...comum, mov: 'persegue', x, y, passoMs: GemasC3.TEMPESTADE_FURIOSA.passoMs, proximoPasso: agora + GemasC3.TEMPESTADE_FURIOSA.passoMs, busca: GemasC3.TEMPESTADE_FURIOSA.buscaCasas, ate: agora + Math.round(obj.duracaoMs * fd) }, agora);
  } else if (obj.tipo === 'abalo') {
    // (revisão do C3 — o PoB, act_str.lua:3287/3393: "Cracks created before the first one has erupted will not generate their own aftershocks") no Terremoto e no da
    // Amplificação, um abalo por vez de cada dono (o seu, o do totem): com o anterior ainda pendente, o uso só golpeia; o Vaal segue a D3.4 (`abaloVaalNoAtaque`)
    if (!obj.vaal && (hunt.poeObjetos ?? []).some((o) => o.tipo === 'abalo' && o.acao === base.acao && o.dono === base.dono && o.ate > agora)) return;
    const durMs = Math.max(1, Math.round(obj.atrasoMs * fd));
    const m = GemasC3.maisDoAbalo(obj, durMs);
    const c = formaNoUso ?? alvo ?? { x, y };
    const o = porObjeto(hunt, { ...base, tipo: 'abalo', mov: 'parado', x: c.x, y: c.y, efeito: 'pulso', raio: casasDe(obj.raioM, 1 + m.areaPct / 100), c3Mais: { acertoPct: m.acertoPct, afeccaoPct: m.afeccaoPct }, intervaloMs: durMs, proxima: agora + durMs, ate: agora + durMs }, agora);
    // (D3.4) o Terremoto Vaal: por 12 s × a Duração, cada ataque seu deixa outro abalo (com o anterior já estourado), até 9 no total — este é o 1º
    if (obj.vaal && !doTotem) hunt.poeAbaloVaal = { acao: entry.id, slug, el: base.el, ate: agora + Math.round(obj.vaal.secundariaMs * fd), restantes: Math.max(0, obj.vaal.max - 1), pendente: o.id, durMs, raioM: obj.raioM, fatorA: fatorA * (1 + m.areaPct / 100), c3Mais: o.c3Mais };
  } else if (obj.tipo === 'martelosCadentes') {
    const ficha = Ficha.combate(estado);
    const inc = (ficha.velocidadeDeAtaque ?? 0) + (ef?.velAtaquePct ?? 0) + (ModsPoe.somaPorTags(ficha, tagsPoeDaSkill(entry)).atk_speed ?? 0);
    const intervaloMs = Math.max(50, obj.cadaMs / Math.max(0.1, 1 + inc / 100));
    porObjeto(hunt, { ...base, tipo: 'martelosCadentes', mov: doTotem ? 'parado' : 'no_dono', x, y, efeito: 'pulso', raio: casasDe(GemasPoe.areaNoNivel(slug, nivel, q).raioM ?? obj.varridaM ?? 3), raioMartelo: casasDe(obj.raioM), porQueda: obj.porQueda, menosPct: obj.menosPct, intervaloMs, proxima: agora + intervaloMs, ate: agora + Math.round(obj.duracaoMs * fd), max: 1 }, agora);
  } else if (obj.tipo === 'orbeTormentaExplosiva') {
    porObjeto(hunt, { ...base, tipo: 'orbeTormentaExplosiva', mov: 'parado', x, y, efeito: 'pulso', raio: casasDe(obj.raioM), explosao: casasDe(obj.explosaoM), porRestantePct: obj.porRestantePct, saltoMs: obj.saltoMs, saltos: 0, busca: GemasC3.TORMENTA_EXPLOSIVA.buscaCasas, ...(obj.afasta ? { longeDe: (({ x: lx, y: ly }) => ({ x: lx, y: ly }))(mira ?? alvo ?? { x: x + 1, y }) } : {}), intervaloMs: obj.saltoMs, proxima: agora, ate: agora + Math.round(obj.duracaoMs * fd) }, agora);
  }
}
/** (lote C3, D3.4) O ataque seu durante o Terremoto Vaal: outro abalo no centro dele (o anterior já estourou), até acabarem os 9 ou os 12 s. */
function abaloVaalNoAtaque(hunt, centro, agora) {
  const v = hunt.poeAbaloVaal;
  if (!v) return;
  if (!(v.ate > agora) || v.restantes <= 0) { if (!v.pendente || !(hunt.poeObjetos ?? []).some((o) => o.id === v.pendente && o.ate > agora)) delete hunt.poeAbaloVaal; return; }
  if (v.pendente && (hunt.poeObjetos ?? []).some((o) => o.id === v.pendente && o.ate > agora)) return;
  const o = porObjeto(hunt, { acao: v.acao, slug: v.slug, el: v.el, dono: 'voce', tipo: 'abalo', mov: 'parado', x: centro.x, y: centro.y, efeito: 'pulso', raio: Math.max(0, casasDoRaio(v.raioM * Math.sqrt(v.fatorA))), c3Mais: v.c3Mais, intervaloMs: v.durMs, proxima: agora + v.durMs, ate: agora + v.durMs }, agora);
  v.pendente = o.id;
  v.restantes -= 1;
}
/** (lote C3) O PULSO dos objetos do lote C3 (`pulsarObjeto`). */
function pulsarObjetoC3(estado, hunt, personagem, o, t, eventos) {
  const dentroDe = (c, r) => vivosNoAndar(hunt, o.z).filter((m) => distanciaChebyshev(m, c) <= r);
  if (o.tipo === 'martelosCadentes') {
    // (os 3 martelos da queda, em inimigos sorteados no raio da varrida em volta de você; cada um no raio do martelo, com o "−50%", sem poder ser evadido)
    for (const m of GemasC3.sortearAlvos(dentroDe(o, o.raio), o.porQueda)) {
      eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: m.x, y: m.y, lado: 2 * o.raioMartelo + 1 });
      golpeDoObjeto(estado, hunt, personagem, { ...o, x: m.x, y: m.y, raio: o.raioMartelo }, m, { maisPct: -o.menosPct, nuncaErra: true }, eventos);
    }
    return;
  }
  const extra = {};
  if (o.tipo === 'tempestadeDeLaminas') {
    extra.maisPct = -o.menosPct;
    if (o.sangra) extra.sangraSempre = true;
  } else if (o.tipo === 'tempestadeFuriosa') {
    if (o.maisPct) extra.maisPct = o.maisPct;
  } else if (o.tipo === 'abalo' || o.tipo === 'martelo') {
    o.ate = Math.min(o.ate, t);
    if (o.tipo === 'abalo') extra.c3Mais = o.c3Mais;
    else { extra.maisPct = -o.menosPct; extra.nuncaErra = true; }
    eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: o.x, y: o.y, lado: 2 * o.raio + 1 });
    const v = hunt.poeAbaloVaal;
    if (o.tipo === 'abalo' && v?.pendente === o.id) { v.pendente = null; if (v.restantes <= 0) delete hunt.poeAbaloVaal; }
  } else if (o.tipo === 'orbeTormentaExplosiva') {
    // (D3.5) depois de nascer, cada pulso é um salto: o orbe vai para a casa do vivo mais perto (a até 7 casas) e acerta lá
    // (dono, 25/10: a da Repulsão se afasta do local mirado — `GemasC3.saltoDaRepulsao`)
    if (o.saltos++ > 0) {
      if (o.longeDe) Object.assign(o, GemasC3.saltoDaRepulsao(o, o.longeDe, vivosNoAndar(hunt, o.z), o.busca));
      else { const quem = maisPertoDe(hunt, o, o.busca, o.z); if (quem) { o.x = quem.x; o.y = quem.y; } }
    }
  }
  const dentro = dentroDe(o, o.raio);
  if (!dentro.length) return;
  const saiu = golpeDoObjeto(estado, hunt, personagem, o, dentro[0], extra, eventos);
  // (a Tempestade de Lâminas de Areia Cega quem está nela — a duração-base da Cegueira, 4 s)
  if (saiu && o.tipo === 'tempestadeDeLaminas' && o.postura === 'areia') {
    const ficha = Ficha.combate(estado);
    for (const m of dentro) if (m.hp > 0) ModsPoe.porNoAlvoComMods(m, 'cego', t + GemasC3.CEGUEIRA_DA_AREIA_MS, t, ficha);
  }
}
/**
 * (lote C3, dono 25/10) O tique do lote C3 (depois do tique dos objetos):
 *  - a Tempestade Furiosa do Berserker gasta a Fúria — 3 por segundo, 20% mais a cada segundo desde que nasceu — e acaba quando a Fúria acaba;
 *  - D3.5: a canalização da Tormenta Explosiva parou (outra habilidade, ou a folga de um tique depois do último uso): cada orbe seu dela explode, no raio secundário,
 *    com max(0, 75 × saltos restantes − 100)% mais dano.
 */
export function tiqueDoC3(estado, hunt, personagem, eventos = [], agora = hunt?.clock ?? 0) {
  const canal = hunt.canalizacao;
  for (const o of [...(hunt.poeObjetos ?? [])]) {
    if (!(o.ate > agora) || (o.z ?? 0) !== (hunt.z ?? 0)) continue;
    if (o.tipo === 'tempestadeFuriosa' && o.presa) {
      o.perdaAcum += GemasC3.furiaPerdidaNoBerserker(o.perda, o.perdaAte - o.desde, agora - o.desde);
      o.perdaAte = agora;
      const k = Math.floor(o.perdaAcum + 1e-9);
      if (k > 0 && hunt.furia) { hunt.furia.n = Math.max(0, (hunt.furia.n | 0) - k); o.perdaAcum -= k; Ficha.invalidar(estado); }
      if (!(ModsPoe.furiaAtual(estado) > 0)) o.ate = agora;
    } else if (o.tipo === 'orbeTormentaExplosiva' && o.dono === 'voce') {
      const canalizando = !!canal && canal.acao === o.acao && !canal.liberou && agora <= (canal.ate ?? -Infinity) + GemasC3.TORMENTA_EXPLOSIVA.folgaDoCanalMs;
      if (canalizando || (estado.hp ?? 0) <= 0) continue;
      const maisPct = GemasC3.maisDaExplosaoDoOrbe(o, o.ate - agora);
      o.ate = agora;
      eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: o.x, y: o.y, lado: 2 * o.explosao + 1 });
      const dentro = vivosNoAndar(hunt, o.z).filter((m) => distanciaChebyshev(m, o) <= o.explosao);
      if (dentro.length) golpeDoObjeto(estado, hunt, personagem, { ...o, raio: o.explosao }, dentro[0], { ...(maisPct ? { maisPct } : {}) }, eventos);
    }
  }
  if (hunt.poeObjetos) hunt.poeObjetos = hunt.poeObjetos.filter((o) => o.ate > agora);
  if (hunt.poeObjetos && !hunt.poeObjetos.length) delete hunt.poeObjetos;
  if (hunt.poeAbaloVaal && !(hunt.poeAbaloVaal.ate > agora) && !hunt.poeAbaloVaal.pendente) delete hunt.poeAbaloVaal;
  return eventos;
}

/**
 * (D7) O TORNADO na fase inicial absorve os SEUS projéteis cuja reta passa pela casa dele (até 20 por tornado): guarda 10% do dano médio do acerto de
 * cada um (antes da resistência), que a perseguição soma a cada golpe dela (`pulsarObjeto`).
 */
function absorverNosTornados(hunt, emitidos, danoMedio, agora) {
  for (const o of hunt.poeObjetos ?? []) {
    if (o.tipo !== 'tornado' || !o.absorve || o.dono !== 'voce' || o.fase !== 1 || !(agora < (o.depois?.em ?? -Infinity)) || (o.z ?? 0) !== (hunt.z ?? 0)) continue;
    for (const p of emitidos) {
      if (o.absorve.n >= o.absorve.max) break;
      const reta = [p.de, ...Areas.reta(p.de, p.para, distanciaChebyshev(p.de, p.para))];
      if (!reta.some((c) => c.x === o.x && c.y === o.y)) continue;
      o.absorve.n++;
      o.absorve.guardado += (Math.max(0, danoMedio) * o.absorve.pct) / 100;
    }
  }
}

/** Move o objeto até o instante `t` (`mov`): a reta (para no terreno — a bola e o olho acabam), a perseguição (1 casa por passo), a órbita, em você. */
function moverObjeto(hunt, o, t) {
  if (o.depois && t >= o.depois.em) {
    o.mov = o.depois.mov;
    o.proximoPasso = o.depois.em + (o.passoMs ?? 500);
    o.depois = null;
    o.fase = 2;
  }
  const andavel = ModsPoe.gradeDoCombate(hunt)?.andavel ?? null;
  const livre = (c) => !andavel || andavel.has(Areas.chave(c));
  if (o.mov === 'reta') {
    const d = (o.vel * Math.max(0, t - o.desde)) / 1000;
    const c = { x: Math.round(o.ox + Math.cos(o.ang) * d), y: Math.round(o.oy + Math.sin(o.ang) * d) };
    if (c.x === o.x && c.y === o.y) return;
    if (!livre(c)) {
      if (o.tipo === 'bola' || o.tipo === 'olho') { o.acabou = true; o.ate = Math.min(o.ate, t); } else o.mov = 'parado';
      return;
    }
    o.x = c.x;
    o.y = c.y;
  } else if (o.mov === 'persegue') {
    for (let guarda = 0; o.proximoPasso <= t && guarda < 100; guarda++) {
      const quem = maisPertoDe(hunt, o, o.busca ?? GemasA3b.GEADA.buscaCasas, o.z);
      if (quem && distanciaChebyshev(quem, o) > 0) {
        const c = GemasA3b.passoPara(o, quem);
        if (livre(c)) { o.x = c.x; o.y = c.y; }
      }
      o.proximoPasso += o.passoMs;
    }
  } else if (o.mov === 'orbita') {
    // (revisão do A3b: a do totem gira em volta dele — `cx`/`cy`, a casa do totem; a sua, em você)
    const a = o.ang0 + (o.omega * (t - o.desde)) / 1000;
    o.x = Math.round((o.cx ?? hunt.pos.x) + Math.cos(a) * o.r);
    o.y = Math.round((o.cy ?? hunt.pos.y) + Math.sin(a) * o.r);
  } else if (o.mov === 'no_dono') {
    o.x = hunt.pos.x;
    o.y = hunt.pos.y;
  }
}
/** O golpe que sai do objeto: a habilidade da gema pelo caminho de sempre (`dispararSemMarcar` com a `plantada` de tipo `objeto`). */
function golpeDoObjeto(estado, hunt, personagem, o, alvo, extra, eventos) {
  const r = dispararSemMarcar(estado, hunt, personagem, null, alvo, { plantada: { tipo: 'objeto', acao: o.acao, x: o.x, y: o.y, z: o.z ?? hunt.z ?? 0, raio: o.raio ?? 0, objeto: o.id ?? null, doTotem: o.dono === 'totem', dono: o.donoPos ?? null, ...(o.elementoSorteado ? { elementoSorteado: o.elementoSorteado } : {}), ...extra } });
  if (!r?.ok) return false;
  // (o golpe do objeto do totem vai marcado como o dos lacaios — como o do próprio totem, `usarComoTotem`)
  if (o.dono === 'totem') for (const ev of r.eventos ?? []) if (ev.t === 'dmg' && ev.foe) ev.lacaio = true;
  eventos.push(...(r.eventos ?? []));
  return true;
}
/**
 * (D4/D7) O PULSO: todos no raio (o Tolhimento do Tornado neles), e na perseguição do Tornado o dano guardado dos projéteis absorvidos em cada um. (A3b-2: a
 * Tormenta Flamejante — o impacto num ponto sorteado da área, o primeiro com o "mais"; a Esfera do Vazio — o Tolhimento pela distância; o Vórtice de Lâminas —
 * o "mais por lâmina" e o intervalo pelas lâminas de agora.)
 */
/** (lote B1, D-B1.10) Os marcadores da Invocar Tormenta de `acao` (de `dono`) caem agora: "causing lightning strikes at any other markers you've cast" (o PoB). */
function tormentasCaem(hunt, acao, dono, t, exceto = null) {
  for (const x of hunt.poeObjetos ?? []) if (x !== exceto && x.tipo === 'tormenta' && x.acao === acao && x.dono === dono && x.ate > t && x.proxima > t) x.proxima = t;
}
function pulsarObjeto(estado, hunt, personagem, o, t, eventos) {
  // (lote C3, dono 25/10) os objetos do lote C3 — as tempestades, o abalo, os martelos, o orbe (`pulsarObjetoC3`)
  if (GemasC3.TIPOS.has(o.tipo)) { pulsarObjetoC3(estado, hunt, personagem, o, t, eventos); return; }
  // (lote B1, D-B1.10) o raio que cai num marcador faz os outros caírem junto
  if (o.tipo === 'tormenta') { o.ate = Math.min(o.ate, t); tormentasCaem(hunt, o.acao, o.dono, t, o); }
  let centro = o;
  let raio = o.raio;
  const extra = {};
  if (o.tipo === 'tempestade') {
    const k = o.feitos++;
    centro = { ...o, x: o.x + Math.floor(Math.random() * (2 * o.raio + 1)) - o.raio, y: o.y + Math.floor(Math.random() * (2 * o.raio + 1)) - o.raio };
    raio = Math.max(0, casasDoRaio(o.raioImpactoM * Math.sqrt(k === 0 ? 1 + (o.primeiroAreaPct ?? 0) / 100 : 1)));
    if (k === 0 && o.primeiroMaisPct) extra.maisPct = o.primeiroMaisPct;
    eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: centro.x, y: centro.y, lado: 2 * raio + 1 });
    // (lote B2, dono 20/10) o impacto da Tormenta Flamejante Vaal deixa o Solo Ardente no raio dele (com ou sem inimigo ali) — os da mesma gema não somam no bicho
    if (o.soloMs > 0 && o.soloPartes?.length) porObjeto(hunt, { acao: o.acao, slug: o.slug, el: o.el, dono: o.dono, ...(o.donoPos ? { donoPos: o.donoPos } : {}), tipo: 'chao', mov: 'parado', x: centro.x, y: centro.y, z: o.z, efeito: 'solo', raio, partes: o.soloPartes, ultimo: t, ate: t + o.soloMs, max: 16 }, t);
  } else if (o.tipo === 'voltaxica') {
    // (lote B2, dono 20/10) a Explosão Voltáxica solta agora: "X% mais Dano com Acertos e Afecções por cada Conjuração desta Magia aguardando" — as outras suas que ainda
    // esperam (o PoB: Multiplier VoltaxicWaitingStages)
    o.ate = Math.min(o.ate, t);
    const aguardando = (hunt.poeObjetos ?? []).filter((x) => x !== o && x.tipo === 'voltaxica' && x.acao === o.acao && x.dono === o.dono && x.ate > t && x.proxima > t).length;
    if (aguardando && o.porAguardandoPct) extra.maisPct = o.porAguardandoPct * aguardando;
    extra.voltaxica = true;
    eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: o.x, y: o.y, lado: 2 * o.raio + 1 });
  } else if (o.tipo === 'explosaoDivina') {
    // (lote B3, dono 21/10) a explosão da Rajada Divina: uma vez, com o "mais" dela
    o.ate = Math.min(o.ate, t);
    extra.maisAcertoEAfeccaoPct = o.maisAcertoEAfeccaoPct;
    eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: o.x, y: o.y, lado: 2 * o.raio + 1 });
  } else if (o.tipo === 'orbeDivino') {
    eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: o.x, y: o.y, lado: 2 * o.raio + 1 });
  } else if (o.tipo === 'tormentaVaal') {
    // (lote B3, dono 21/10) o golpe da Invocar Tormenta Vaal num inimigo sorteado a até o raio final do marcador; no último (o próximo passaria do fim), também o raio grande
    // no marcador
    const perto = vivosNoAndar(hunt, o.z).filter((m) => !m.dummy && distanciaChebyshev(m, o) <= o.raioFinal);
    const quem = perto.length ? perto[Math.min(perto.length - 1, Math.floor(Math.random() * perto.length))] : null;
    if (quem) {
      eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: quem.x, y: quem.y, lado: 2 * o.raio + 1 });
      golpeDoObjeto(estado, hunt, personagem, { ...o, x: quem.x, y: quem.y }, quem, {}, eventos);
    }
    if (t + o.intervaloMs > o.ate + 1e-6 && !o.final) {
      o.final = true;
      o.ate = Math.min(o.ate, t);
      const noFim = vivosNoAndar(hunt, o.z).filter((m) => distanciaChebyshev(m, o) <= o.raioFinal);
      eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: o.x, y: o.y, lado: 2 * o.raioFinal + 1 });
      if (noFim.length) golpeDoObjeto(estado, hunt, personagem, { ...o, raio: o.raioFinal }, noFim[0], {}, eventos);
    }
    return;
  } else if (o.tipo === 'vortice') {
    const n = (o.laminas ?? []).filter((a) => a > t).length;
    if (!n) { o.ate = Math.min(o.ate, t); return; }
    if (o.maisPorLaminaPct) extra.maisPct = o.maisPorLaminaPct * n;
    o.intervaloMs = GemasA3b.intervaloDoVortice(o.baseMs, o.incPorLaminaPct, n);
    o.ultimoPulso = t;
  }
  const dentro = vivosNoAndar(hunt, o.z).filter((m) => distanciaChebyshev(m, centro) <= raio);
  // (revisão do C4, 21/10: o "Inimigos Desacelerados por você têm Regeneração de Vida reduzida" — em todo Tolhimento seu; o do objeto do totem fica como estava)
  const regenDoTolhimento = () => (o.dono === 'totem' ? 0 : ModsPoe.valor(Ficha.combate(estado), 'desacelerados_regen_red'));
  if (o.tipo === 'esfera' && o.tolhePct > 0) {
    // (o Tolhimento da Esfera: o máximo colado nela, caindo até a borda do raio)
    // (lote C4, dono 21/10: o Tolhimento é o estado próprio, só de movimento e sem teto — `Estados.tolher`)
    const regenMenos = regenDoTolhimento();
    for (const m of dentro) Estados.tolher(m, Math.round(o.tolhePct * (1 - distanciaChebyshev(m, o) / (o.raio + 1))), TOLHIMENTO_DAS_AREAS_MS, t, regenMenos);
  }
  if (!dentro.length) return;
  // (o Tolhimento do Tornado — "Inimigos no alcance são Desacelerados com Velocidade de Movimento reduzida": o mesmo estado)
  if (o.lentidaoPct > 0) { const regenMenos = regenDoTolhimento(); for (const m of dentro) Estados.tolher(m, o.lentidaoPct, TOLHIMENTO_DAS_AREAS_MS, t, regenMenos); }
  const saiu = golpeDoObjeto(estado, hunt, personagem, centro === o ? o : { ...o, x: centro.x, y: centro.y, raio }, dentro[0], extra, eventos);
  // (revisão do A3b: o guardado só soma ao golpe que saiu — na Safe Zone, ou recusado, nada)
  if (saiu && o.fase === 2 && o.absorve?.guardado > 0) {
    for (const m of dentro) {
      if (!(m.hp > 0)) continue;
      const v = resistido(hunt, m, 'physical', Math.round(o.absorve.guardado));
      if (!(v > 0)) continue;
      m.hp -= v;
      QuemFeriu.carimbar(m, o.dono === 'totem' ? QuemFeriu.TOTEM : QuemFeriu.VOCE);
      eventos.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v, foe: true, alvo: m.name, color: COR_DO_ELEMENTO.physical ?? '#d0d0d0', fonte: 'tornado', ...(o.dono === 'totem' ? { lacaio: true } : {}) });
      registrarGolpe(() => ({ origem: 'tornado', habilidade: o.acao, tipo: 'physical', alvo: m.name, danoAntesDaResistencia: Math.round(o.absorve.guardado), danoFinal: v, vidaRestante: Math.max(0, m.hp) }));
    }
  }
}
/** (D10/D11) Os projéteis do objeto nos ângulos (null: a direção aleatória da gema), do lugar dele; o alvo é o vivo mais perto (só a referência). */
function dispararDoObjeto(estado, hunt, personagem, o, angulos, eventos, extra = {}) {
  const alvo = maisPertoDe(hunt, o, Infinity, o.z ?? hunt.z ?? 0);
  if (!alvo || !angulos.length) return false;
  return golpeDoObjeto(estado, hunt, personagem, o, alvo, { emitir: true, angulos, ...extra }, eventos);
}
function emitirDoObjeto(estado, hunt, personagem, o, eventos) {
  if (o.tipo === 'espiral') {
    if (o.feitos >= o.n) return;
    const k = o.feitos++;
    const angulos = [GemasA3b.anguloDaEspiral(k, o.n, o.a0, o.angulo, o.ini)];
    if (o.espelhado) angulos.push(GemasA3b.anguloDaEspiral(k, o.n, o.a0, o.angulo, o.ini, true));
    dispararDoObjeto(estado, hunt, personagem, o, angulos, eventos);
  } else if (o.tipo === 'escudo') {
    // (lote PR1) a rajada do escudo de Trarthus: até N estilhas em direções sorteadas, com o "menos Dano" delas; o próximo intervalo, 40% mais rápido
    const k = Math.min(o.porVez, o.n - o.feitos);
    if (k <= 0) return;
    o.feitos += k;
    dispararDoObjeto(estado, hunt, personagem, o, Array.from({ length: k }, () => Math.random() * 2 * Math.PI), eventos, { maisPct: o.maisPct, estilhas: true });
    o.intervaloMs /= 1 + (o.aceleraPct ?? 0) / 100;
  } else if (o.tipo === 'carregamento') {
    // (lote B3, dono 21/10) o Tiro Tornado da Nuvem Explosiva: as N flechas de uma vez, em volta do lugar onde a carregada caiu
    if (o.feitos) return;
    o.feitos = o.n;
    dispararDoObjeto(estado, hunt, personagem, o, GemasB3.angulosEmVolta(o.n, o.a0), eventos, { acertaNaOrigem: true });
  } else if (o.tipo === 'olho') {
    if (o.noVooMax != null && o.feitos >= o.noVooMax) return;
    dispararDoObjeto(estado, hunt, personagem, o, [o.ang + (o.feitos++ * o.passoGraus * Math.PI) / 180], eventos);
  }
}

// ---------------------------------------------------------------- (lote B2, dono 20/10) os mecanismos do lote B2 (`itens-poe/gemas-b2.mjs`)

/** (D-B2.4) A VIDA GASTA (o custo de Vida, o Sacrifício): a Febre Corrompedora ligada renova a duração a cada N de Vida gasta ("após você gastar um total de N"). */
export function vidaGastaB2(hunt, v, agora = hunt?.clock ?? 0) {
  const f = hunt?.poeFebre;
  if (!(v > 0) || !f || !(f.ate > agora) || !(f.renovaVida > 0)) return;
  f.gasto = (f.gasto ?? 0) + v;
  if (f.gasto >= f.renovaVida) { f.gasto %= f.renovaVida; f.ate = agora + f.durMs; }
}
/**
 * O SANGUE CORROMPIDO da Febre Corrompedora no acertado (com a Febre ligada): +1 estágio (até 10), a duração da penalidade renova; o degenerativo é o da gema × (1 + 100% ×
 * (estágios − 1)) — o PoB: Damage MORE 100 × CorruptingFeverStageAfterFirst, ModFlag.Dot. Uma instância da gema por inimigo (a mais forte fica).
 */
export function febreNoAcerto(hunt, bicho, agora = hunt?.clock ?? 0) {
  const f = hunt?.poeFebre;
  if (!f || !(f.ate > agora) || !(bicho?.hp > 0)) return null;
  const e = (bicho.estados ??= {});
  const n = Math.min(GemasB2.FEBRE.maxEstagios, (e.poeFebre?.ate > agora ? e.poeFebre.n : 0) + 1);
  e.poeFebre = { n, ate: agora + f.penalidadeMs };
  let posto = null;
  for (const p of f.partes ?? []) posto = Dot.aplicar(bicho, { tipo: p.tipo, total: (p.porSegundo * GemasB2.fatorDaFebre(n) * f.penalidadeMs) / 1000, duracaoMs: f.penalidadeMs, chave: 'Corrupting_Fever', origem: { fonte: 'gema', habilidade: f.acao } }, agora) ?? posto;
  return posto;
}
/**
 * (D-B2.5) O CONTÁGIO espalha (na morte do afetado — `morte` — ou no acerto nele, o da Transferência): o degenerativo dele, com o dano que falta e a duração que resta,
 * para os vivos no raio (em casas, o da área do uso que o pôs) em volta do afetado; os que pegam também espalham. Uma instância da gema por inimigo (a mais forte fica).
 * (revisão B2, dono 21/10) O MAIS FORTE FICA, pelo critério do PoE — o maior DANO POR SEGUNDO: o vizinho que já tem o da mesma gema com pelo menos o mesmo dano por
 * segundo não recebe o espalhado (o mais fraco não encurta o dele nem tira o dano que falta); o mais forte troca o dele inteiro (o que falta, a duração e o pulso —
 * mesmo que dure menos).
 * (revisão PR2, 21/10) "O debuff é espalhado por Contágio" (`GemasPoe.espalhadoPeloContagio`: o Drenar Essência e o do Desespero, a Praga do Contágio): os desse
 * inimigo vão junto, no mesmo raio, com o dreno (D2 do dono: cada debuff ativo soma) — sem marca de Contágio: só espalham de novo com um Contágio no novo alvo.
 */
const ativoDoDot = (d, agora) => d.falta > 0 && d.ate + (Dot.CONFIG.tipos[d.tipo]?.pulsoMs ?? 1000) > agora;
/** O dano por segundo que falta de um dano contínuo (o critério do "mais forte" do PoE). */
const dpsDoDot = (d, agora) => d.falta / Math.max(0.05, (d.ate - agora) / 1000);
function espalharUmDot(hunt, de, d, raio, agora, marcar) {
  for (const m of hunt.monstros ?? []) {
    if (m === de || !(m.hp > 0) || (m.z ?? hunt.z ?? 0) !== (de.z ?? hunt.z ?? 0) || distanciaChebyshev(m, de) > raio) continue;
    const ja = (m.dots ?? []).find((x) => x.chave === d.chave && x.tipo === d.tipo && ativoDoDot(x, agora));
    if (ja && dpsDoDot(ja, agora) >= dpsDoDot(d, agora)) continue;
    if (ja) m.dots.splice(m.dots.indexOf(ja), 1);
    if (!Dot.aplicar(m, { tipo: d.tipo, total: d.falta, duracaoMs: d.ate - agora, chave: d.chave, origem: d.origem }, agora)) continue;
    // (revisão do C4, 21/10 — D4.2) a Praga espalhada leva as CAMADAS (cada uma com a sua duração) e o pulso de uma camada: sem elas, a próxima camada canalizada no
    // vizinho (`GemasC4.porCamada`) recalcularia o que falta só com a nova e apagaria o dano espalhado; o que falta é o das camadas no relógio de pulsos do vizinho
    if (d.camadas?.length) {
      const x = (m.dots ?? []).find((y) => y.chave === d.chave && y.tipo === d.tipo && y.falta > 0);
      const vivas = d.camadas.filter((a) => a > agora);
      if (x && vivas.length) {
        Object.assign(x, { camadas: vivas, porPulsoCamada: d.porPulsoCamada, porPulso: (d.porPulsoCamada ?? 0) * vivas.length, ate: Math.max(...vivas) });
        x.falta = GemasC4.faltaDasCamadas(x, Dot.CONFIG.tipos[d.tipo]?.pulsoMs ?? 500);
      }
    }
    for (const x of m.dots ?? []) if (x.chave === d.chave && x.tipo === d.tipo && x.falta > 0) marcar(x);
  }
}
export function espalharContagio(hunt, de, agora = hunt?.clock ?? 0, { morte = false } = {}) {
  let raio = -1;
  for (const d of [...(de?.dots ?? [])]) {
    const c = d.contagio;
    if (!c || !(d.falta > 0) || !(d.ate > agora) || !(morte ? c.aoMorrer : c.aoAcertar)) continue;
    raio = Math.max(raio, c.raio ?? 0);
    espalharUmDot(hunt, de, d, c.raio, agora, (x) => { if (!x.contagio) x.contagio = c; });
  }
  if (raio < 0) return;
  for (const d of [...(de?.dots ?? [])]) {
    if (d.contagio || d.chave == null || !(d.falta > 0) || !(d.ate > agora) || !GemasPoe.espalhadoPeloContagio(d.chave)) continue;
    espalharUmDot(hunt, de, d, raio, agora, (x) => { if (d.dreno) x.dreno = d.dreno; });
  }
}
/** O acerto SEU num inimigo (as gemas e o golpe básico — `combate`): a Febre Corrompedora e o Contágio da Transferência. Devolve os estados postos. */
export function aoAcertarB2(hunt, bicho, dano, agora = hunt?.clock ?? 0) {
  if (!itensPoeLigado() || !hunt || !bicho || !(dano > 0)) return [];
  const postos = [];
  const st = febreNoAcerto(hunt, bicho, agora);
  if (st) postos.push(st);
  if ((bicho.dots ?? []).some((d) => d.contagio?.aoAcertar)) espalharContagio(hunt, bicho, agora);
  return postos;
}
/**
 * (D-B2.3) O debuff do GOLPE INFERNAL no acertado: o CARREGADO (`carregado` — o acertado pelo golpe): +1 carga (até 6), a duração renova; o DESCARREGADO (o acertado pela
 * explosão) só marca — não tira a carga de quem já a tem. Devolve as cargas de agora.
 */
// (revisão B2, dono 21/10: UM DEBUFF POR JOGADOR, como no PoE) `quem`: o nome de quem pôs (a party divide `hunt.monstros`) — cada membro tem o seu no monstro, com as
// cargas e a explosão dele. O primeiro fica em `estados.poeInfernal` (o de quem caça sozinho); os de outros membros, em `estados.poeInfernaisDeOutros[quem]`.
const mesmoQuem = (a, b) => (a ?? null) === (b ?? null);
/** Todos os debuffs do Golpe Infernal no bicho (um por jogador). */
function infernaisDe(b) {
  const e = b?.estados;
  return e ? [...(e.poeInfernal ? [e.poeInfernal] : []), ...Object.values(e.poeInfernaisDeOutros ?? {})] : [];
}
/** O debuff do Golpe Infernal de `quem` no bicho, ou null. */
function infernalDe(b, quem) {
  const e = b?.estados;
  if (!e) return null;
  if (e.poeInfernal && mesmoQuem(e.poeInfernal.quem, quem)) return e.poeInfernal;
  return e.poeInfernaisDeOutros?.[quem ?? ''] ?? null;
}
function porInfernal(b, quem, deb) {
  const e = (b.estados ??= {});
  if (!e.poeInfernal || mesmoQuem(e.poeInfernal.quem, quem)) e.poeInfernal = deb;
  else (e.poeInfernaisDeOutros ??= {})[quem ?? ''] = deb;
}
function tirarInfernal(b, deb) {
  const e = b?.estados;
  if (!e || !deb) return;
  const outros = e.poeInfernaisDeOutros;
  if (e.poeInfernal === deb) {
    delete e.poeInfernal;
    // (o de outro membro passa ao lugar do primeiro)
    const k = outros ? Object.keys(outros)[0] : undefined;
    if (k !== undefined) { e.poeInfernal = outros[k]; delete outros[k]; }
  } else if (outros) for (const [k, v] of Object.entries(outros)) if (v === deb) delete outros[k];
  if (outros && !Object.keys(outros).length) delete e.poeInfernaisDeOutros;
}
function infernalNoAcerto(bicho, inf, ate, carregado, acao, agora, quem = null) {
  const deb = infernalDe(bicho, quem);
  const atual = deb?.ate > agora ? deb : null;
  if (carregado) {
    const n = Math.min(inf.maxCargas, (atual?.carregado ? atual.n : 0) + 1);
    porInfernal(bicho, quem, { carregado: true, n, ate, acao, quem });
    return n;
  }
  if (!atual?.carregado) porInfernal(bicho, quem, { carregado: false, n: 0, ate: Math.max(ate, atual?.ate ?? 0), acao, quem });
  return atual?.carregado ? atual.n : 0;
}
/**
 * (D-B2.3) O debuff CARREGADO do Golpe Infernal que acaba (expirou, ou o inimigo morreu) explode com as cargas que tem — 66% × n do acerto —, em volta do lugar dele: o golpe da
 * gema pelo caminho de sempre (`golpeDoObjeto`, a área no raio da explosão × √ da Área do uso), num vivo dali; quem ela acerta leva o descarregado.
 */
function explodirInfernal(estado, hunt, personagem, onde, deb, eventos) {
  const entry = POR_ID.get(deb.acao);
  if (!entry?.poeGema) return;
  const ef = Gemas.efeitoNaSkill(estado, deb.acao);
  const inf = GemasPoe.b2DaGema(entry.poeGema.slug, ef?.nivel ?? 1, ef?.qualidade ?? 0).infernal;
  if (!inf || !(deb.n > 0)) return;
  const r = Math.max(0, casasDoRaio(inf.raioM * Math.sqrt(ModsPoe.fatorDaArea(ef?.areaIncPct ?? 0, ef?.areaMaisPct ?? 0))));
  const alvo = vivosNoAndar(hunt, onde.z ?? hunt.z ?? 0).filter((m) => distanciaChebyshev(m, onde) <= r).sort((a, b) => distanciaChebyshev(a, onde) - distanciaChebyshev(b, onde))[0];
  eventos.push({ t: 'explosao', id: entry.efeito || EFEITO_DA_EXPLOSAO, x: onde.x, y: onde.y, lado: 2 * r + 1 });
  if (alvo) golpeDoObjeto(estado, hunt, personagem, { acao: deb.acao, x: onde.x, y: onde.y, z: onde.z ?? hunt.z ?? 0, raio: r, dono: 'voce' }, alvo, { maisPct: GemasB2.pctDaExplosaoInfernal(inf.porCargaPct, deb.n) - 100, explosaoInfernal: true }, eventos);
}
/**
 * (lote C4, dono 21/10) Os DEBUFFS DO LOTE C4 no acertado:
 *  - D4.1: o TOLHIMENTO da Praga ("Enemies who aren't already debuffed by Blight are also hindered" — a Vaal Tolhe sempre) e o do Definhar: o estado próprio `tolhido`
 *    (só de movimento) com a porcentagem do PoE pela Duração Secundária × a Duração da Habilidade (`Estados.tolher` — vale a instância mais forte, com a duração
 *    dela; sem o teto da lentidão e sem a metade no chefe; com o "Desacelerados por você têm Regeneração de Vida reduzida" de quem Tolheu); o Tolhido
 *    pela Atrofia tem a Regeneração de Vida reduzida (`regenMenosDebuff`), e o pela Vaal sofre +X% de Dano de Caos (`tolhidoCaos` — no acerto e no dano contínuo);
 *  - o DEFINHAMENTO do Definhar (2 s × a Duração; +6% de Caos sofrido por acúmulo, até 15 — o `definhado`), uma vez por uso em cada um;
 *  - o debuff do GOLPE PESTILENTO (1 s × a Duração): quem morre com ele e Envenenado solta o secundário em volta (`aoMorrerC4`).
 */
function debuffsDoC4(hunt, bicho, c4, { agora, msDoC4, definhados, ficha, acao, quem, raioDoPestilento, eventos }) {
  // (o golpe que matou ainda marca o Pestilento — a morte é processada depois do passe; o Tolhimento e o Definhamento, só no vivo)
  // (dono, 21/10: o Tolhimento é o estado próprio `tolhido` — só de movimento, sem teto, vale o mais forte — `Estados.tolher`)
  // (revisão do C4, 21/10: + o "Inimigos Desacelerados por você têm Regeneração de Vida reduzida em X%" de quem Tolheu)
  const tolher = (pct, ms) => {
    if (!Estados.tolher(bicho, pct, ms, agora, ModsPoe.valor(ficha, 'desacelerados_regen_red'))) return false;
    eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'tolhido' });
    return true;
  };
  const p = c4.praga;
  if (p && (!p.soSemPraga || !GemasC4.temPraga(bicho, agora))) {
    const ms = msDoC4(p.tolheMs);
    if (tolher(p.tolhePct, ms)) {
      const e = (bicho.estados ??= {});
      if (p.regenMenosPct > 0) {
        const r = e.regenMenosDebuff;
        e.regenMenosDebuff = r?.ate > agora ? { ate: Math.max(r.ate, agora + ms), pct: Math.max(r.pct ?? 0, p.regenMenosPct) } : { ate: agora + ms, pct: p.regenMenosPct };
      }
      if (p.caosSofridoPct > 0) {
        const c = e.tolhidoCaos;
        e.tolhidoCaos = c?.ate > agora ? { ate: Math.max(c.ate, agora + ms), pct: Math.max(c.pct ?? 0, p.caosSofridoPct) } : { ate: agora + ms, pct: p.caosSofridoPct };
      }
    }
  }
  const w = c4.definhar;
  if (w && bicho.hp > 0 && !definhados.has(bicho)) {
    definhados.add(bicho);
    tolher(w.tolhePct, msDoC4(w.tolheMs));
    ModsPoe.porNoAlvoComMods(bicho, 'definhado', agora + msDoC4(w.definhadoMs), agora, ficha);
    eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'definhado' });
  }
  const ps = c4.pestilento;
  if (ps) {
    const e = (bicho.estados ??= {});
    e.poePestilento = { ate: agora + msDoC4(ps.debuffMs), acao, quem, porSegundoPct: ps.porSegundoPct, secundarioMs: msDoC4(ps.secundarioMs), raio: raioDoPestilento };
  }
}
/**
 * (lote C4, dono 21/10 — D4.3) A MORTE de quem tinha o debuff do GOLPE PESTILENTO e estava Envenenado: o debuff secundário em cada vivo a até o raio da gema (2,7 m × a
 * Área) em volta do morto — dano de Caos degenerativo, X%/s do que faltava de todos os Venenos no morto pela Duração Secundária ("This damage is not affected by your
 * damage modifiers": o total cru; a resistência a Caos do vizinho vale no pulso). Um secundário por inimigo (o mais forte fica, renovado). Os números são os do debuff,
 * guardados no acerto: a morte não depende da ficha de quem o pôs.
 */
export function aoMorrerC4(hunt, morto, eventos = []) {
  if (!itensPoeLigado() || !hunt || !morto) return eventos;
  const agora = hunt.clock ?? 0;
  const deb = morto.estados?.poePestilento;
  if (!deb) return eventos;
  delete morto.estados.poePestilento;
  if (!(deb.ate > agora)) return eventos;
  const total = GemasC4.totalDoSecundario(morto, deb, deb.secundarioMs);
  if (!(total > 0) || !(deb.secundarioMs > 0)) return eventos;
  eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: morto.x, y: morto.y, lado: 2 * deb.raio + 1 });
  for (const m of vivosNoAndar(hunt, morto.z ?? hunt.z ?? 0)) {
    if (m === morto || m.dummy || distanciaChebyshev(m, morto) > deb.raio) continue;
    const posto = Dot.aplicar(m, { tipo: 'degenCaos', total, duracaoMs: deb.secundarioMs, chave: 'Pestilent_Strike#secundario', origem: { fonte: 'gema', habilidade: deb.acao, ...(deb.quem != null ? { quem: deb.quem } : {}) } }, agora);
    if (posto) eventos.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: posto });
  }
  return eventos;
}
/**
 * A MORTE de um inimigo (por quem for — `combate.matarMonstro`): o Ceifar perde uma Carga Sangrenta se ele tinha o debuff de um Ceifar (D-B2.2); o Contágio espalha
 * (D-B2.5); o Golpe Infernal — o carregado explode com as cargas dele, e o morto com qualquer um dos dois debuffs explode como cadáver ("Explosão causa Dano de Fogo base
 * igual a 6% da Vida máxima do cadáver", no raio da explosão — D-B2.3).
 */
// (revisão B2, 21/10) O QUE É DE OUTRO MEMBRO da party (a sala divide os bichos): a morte que outro processa (quem matou, ou o tique dele) não usa a ficha nem as
// cargas de quem não é o dono — fica na fila da sala (`salaDe(hunt).poeB2Pendentes`) e o DONO a faz no tique dele (`tiqueDasGemasB2`). Caçando sozinho, é sempre o seu.
const PENDENTES_B2 = 40;
const ehMeu = (quem, personagem) => quem == null || quem === (personagem?.nome ?? null);
function pendenteB2(hunt, p) {
  const sala = salaDe(hunt) ?? hunt;
  const fila = (sala.poeB2Pendentes ??= []);
  fila.push(p);
  if (fila.length > PENDENTES_B2) fila.splice(0, fila.length - PENDENTES_B2);
}
function infernalNaMorte(estado, hunt, personagem, deb, onde, maxHp, eventos, agora) {
  if (!((estado.hp ?? 0) > 0)) return;
  if (deb.carregado) explodirInfernal(estado, hunt, personagem, onde, deb, eventos);
  const entry = POR_ID.get(deb.acao);
  const ef = entry ? Gemas.efeitoNaSkill(estado, deb.acao) : null;
  const inf = entry?.poeGema ? GemasPoe.b2DaGema(entry.poeGema.slug, ef?.nivel ?? 1, ef?.qualidade ?? 0).infernal : null;
  if (inf?.cadaverPct > 0) eventos.push(...explodirCadaveres(estado, hunt, entry, ef, { pct: inf.cadaverPct, raioExplosaoM: inf.raioM, tags: ['ataque', 'area', 'fogo'] }, [{ ...onde, maxHp }], Ficha.combate(estado), agora));
}
export function aoMorrerB2(estado, hunt, personagem, morto, eventos = []) {
  if (!itensPoeLigado() || !hunt || !morto) return eventos;
  const agora = hunt.clock ?? 0;
  // (revisão B2, 21/10) o Ceifar: o debuff AINDA ATIVO (o `ativo` do dano contínuo: a folga de um pulso, nada mais) — uma carga de CADA dono dos Ceifares no morto
  const donosDoCeifar = new Set((morto.dots ?? []).filter((d) => /^Reap(_of_Butchery)?$/.test(d.chave ?? '') && ativoDoDot(d, agora)).map((d) => d.origem?.quem ?? null));
  for (const quem of donosDoCeifar) {
    if (ehMeu(quem, personagem)) GemasB2.mudarSangrentas(hunt, -1, agora);
    else pendenteB2(hunt, { quem, sangrenta: -1 });
  }
  if ((morto.dots ?? []).some((d) => d.contagio?.aoMorrer)) espalharContagio(hunt, morto, agora, { morte: true });
  // (um debuff por jogador: cada um explode com a ficha do dono dele)
  for (const deb of infernaisDe(morto)) {
    tirarInfernal(morto, deb);
    if (!(deb.ate > agora)) continue;
    const onde = { x: morto.x, y: morto.y, z: morto.z ?? hunt.z ?? 0 };
    if (ehMeu(deb.quem, personagem)) infernalNaMorte(estado, hunt, personagem, deb, onde, morto.maxHp ?? 0, eventos, agora);
    else pendenteB2(hunt, { quem: deb.quem, infernal: deb, onde, maxHp: morto.maxHp ?? 0 });
  }
  return eventos;
}
/**
 * (decisão do dono, 20/10) O SOLO ARDENTE do Chicote Ardente sob o inimigo Incendiado: 1 casa em volta dele, com o % do dano por segundo do Incêndio mais forte nele ("Seus
 * modificadores de dano não se aplicam": o do Incêndio), pela duração da gema (4 s × a Duração); uma vez a cada 2 s (o da Combustão: 1 s) por gema.
 */
function soloDoChicoteArdente(estado, hunt, entry, ef, solo, bicho, agora, dono) {
  const cd = (hunt.poeSoloDoChicote ??= {});
  if ((cd[entry.id] ?? -Infinity) > agora) return false;
  const incendios = (bicho.dots ?? []).filter((d) => d.tipo === 'queimadura' && d.falta > 0 && d.ate > agora);
  if (!incendios.length) return false;
  const dps = Math.max(...incendios.map((d) => d.falta / Math.max(0.1, (d.ate - agora) / 1000)));
  cd[entry.id] = agora + solo.recargaMs;
  const durMs = Math.round((GemasPoe.compilada(entry.poeGema.slug, ef?.nivel ?? 1, ef?.qualidade ?? 0)?.stats?.duracao ?? 4) * 1000 * fatorDeDuracao(estado, entry, ef));
  porObjeto(hunt, { acao: entry.id, slug: entry.poeGema.slug, el: 'fire', dono, tipo: 'chao', mov: 'parado', x: bicho.x, y: bicho.y, z: bicho.z ?? hunt.z ?? 0, efeito: 'solo', raio: solo.raio, partes: [{ tipo: GemasPoe.DEGEN_DO_ELEMENTO.fire, elemento: 'fire', porSegundo: (dps * solo.pct) / 100 }], ultimo: agora, ate: agora + durMs, max: 10 }, agora);
  return true;
}
/**
 * (lote G-A, dono 26/10) O EMPURRÃO DO CLAMOR SÍSMICO: os inimigos vivos a até 1 casa do alvo do uso (sem alvo, de você) são empurrados para longe de você as casas da
 * gema, uma a uma (`ModsPoe.empurrar` — a casa tem de ser andável e livre; o chefe não se move), e interrompidos: o próximo golpe deles começa de novo agora (o intervalo
 * do golpe deles — `AtributosDoMob.intervaloDoGolpe`). Devolve quantos pegou.
 */
export function empurraoDoClamor(hunt, entry, efeitoDaGema, alvo, agora = hunt?.clock ?? 0, eventos = []) {
  const e = GemasPoe.empurraoDoClamorDaGema(entry.poeGema.slug, efeitoDaGema?.nivel ?? 1);
  if (!e || !hunt?.pos) return 0;
  const c = alvo && alvo.hp > 0 ? alvo : hunt.pos;
  const centro = { x: c.x, y: c.y };
  // (quem está na área ANTES de alguém se mover; os mais longe de você primeiro — o da frente não trava o de trás)
  const naArea = (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && (m.z ?? hunt.z ?? 0) === (hunt.z ?? 0) && distanciaChebyshev(centro, m) <= e.raio).sort((a, b) => distanciaChebyshev(hunt.pos, b) - distanciaChebyshev(hunt.pos, a));
  let n = 0;
  for (const m of naArea) {
    for (let k = 0; k < e.casas && ModsPoe.empurrar(hunt, m); k++);
    m.proximoGolpe = agora + AtributosDoMob.intervaloDoGolpe(m);
    eventos.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: 'empurrado' });
    n++;
  }
  return n;
}
/**
 * (lote G-C, dono 25/10 — D12) A MARCA DO ALQUIMISTA: o acerto que Incendeia o marcado cria o Solo Ardente sob ele com X% do dano por segundo do Incêndio mais forte nele;
 * o que Envenena, o Solo Cáustico com Y% do Veneno mais forte ("Os modificadores de dano não se aplicam": o dps é o da afecção) — 1 casa em volta (o Solo Ardente do
 * Chicote Ardente), 4 s, cada um no máximo uma vez por segundo. Devolve quantos solos criou.
 */
export function soloDaAlquimista(hunt, bicho, postos, agora, dono = 'voce') {
  const a = GemasGAC.alquimistaNoBicho(bicho, agora);
  if (!a || !hunt) return 0;
  const cd = (hunt.poeSoloDaAlquimista ??= {});
  const acao = GemasPoe.doSlug('Alchemists_Mark')?.acao ?? 'Alchemists_Mark';
  let n = 0;
  const criar = (chave, elemento, pct, doTipo) => {
    if (!(pct > 0) || (cd[chave] ?? -Infinity) > agora) return;
    const dots = (bicho.dots ?? []).filter((d) => doTipo(d) && d.falta > 0 && d.ate > agora);
    if (!dots.length) return;
    const dps = Math.max(...dots.map((d) => d.falta / Math.max(0.1, (d.ate - agora) / 1000)));
    cd[chave] = agora + (a.cadaMs ?? 1000);
    porObjeto(hunt, { acao, slug: 'Alchemists_Mark', el: elemento, dono, tipo: 'chao', mov: 'parado', x: bicho.x, y: bicho.y, z: bicho.z ?? hunt.z ?? 0, efeito: 'solo', raio: GemasGAC.SOLO_DO_ALQUIMISTA.raio, partes: [{ tipo: GemasPoe.DEGEN_DO_ELEMENTO[elemento], elemento, porSegundo: (dps * pct) / 100 }], ultimo: agora, ate: agora + GemasGAC.SOLO_DO_ALQUIMISTA.duracaoMs, max: 10, alquimista: chave }, agora);
    n++;
  };
  if (postos.includes('queimando')) criar('ardente', 'fire', a.incendioPct, (d) => d.tipo === 'queimadura');
  if (postos.includes('envenenado')) criar('caustico', 'chaos', a.venenoPct, (d) => d.tipo === 'venenoPoe' || d.tipo === 'veneno');
  return n;
}
/**
 * (lote G-C, dono 25/10 — D13) As MALDIÇÕES LIGADAS À RUÍNA (o PoB: "Linked hex curses are also applied to those enemies"): as gemas de maldição Feitiço no mesmo grupo
 * dela que exigem até o nível dela (70), cada uma com os efeitos do nível dela (`GemasPoe.buffNoNivel` → `efeitosDaMaldicao`, com a qualidade da Ruína — "+1% de efeito" —
 * e o "−25% final" dela), na forma da lista do `Reforcos.marcarCom` (sem a área da maldição: a Ruína já é a área). `[{ id, def, fator, lancado, emAura }]`.
 */
export function maldicoesDaRuina(estado, entry, ruina, agora = estado?.hunt?.clock ?? 0) {
  if (!ruina || !entry) return [];
  const out = [];
  // (revisão G) só as que a Ruína suporta (o mesmo critério do `Gemas.gruposComGatilho` — 'ruina': o nível exigido, e nenhuma com a Blasfêmia no grupo)
  const suportadas = new Set(Gemas.gruposComGatilho(estado).find((g) => g.ruina === entry.id)?.magias ?? []);
  for (const x of Gemas.ativasDoMesmoGrupo(estado, entry.id)) {
    if (!suportadas.has(x.def.acao)) continue;
    const slug = x.def.poe?.slug;
    const r = slug ? GemasPoe.doSlug(slug) : null;
    if (!r || r.arquetipo !== 'maldicao' || !(r.gema?.tags ?? []).includes('Feitiço')) continue;
    if ((GemasPoe.textosDaGema(slug, x.nivel).requer ?? 1) > ruina.nivelMax) continue;
    const doPoe = GemasPoe.buffNoNivel(slug, x.nivel, x.qualidade);
    const entryDaMaldicao = POR_ID_PUBLICO(r.acao);
    if (!doPoe || !entryDaMaldicao) continue;
    const k = Math.max(0, 1 + (ruina.efeitoLigadasMaisPct ?? 0) / 100);
    const efeitos = efeitosDaMaldicao(doPoe.efeitos, { nivel: x.nivel, qualidade: x.qualidade, efeitoMaldicaoPct: ruina.efeitoLigadasPct ?? 0 }, estado, entryDaMaldicao)
      .map((e) => (e.efeito === 'maldicaoRegras' ? { ...e, raioCasas: 0 } : /^marca/.test(e.efeito) && typeof e.pct === 'number' ? { ...e, pct: e.pct * k, ...(e.escala != null ? { escala: e.escala * k } : {}), ...(e.pctRaro != null && e.escala == null ? { pctRaro: e.pctRaro * k } : {}) } : e));
    // (revisão G) o `pctRaro` só leva o k quando não há `escala`: com ela, o `GemasGAC.efeitoNoBicho` já o multiplica pela `escala` (o k não sai em dobro)
    out.push({ id: r.acao, def: { ...(Reforcos.REFORCOS[r.acao] ?? {}), tipo: 'poe-maldicao', efeitos }, fator: 1, lancado: agora, emAura: false });
  }
  return out;
}
/**
 * (lote S1, 26/10) As MALDIÇÕES DO TOQUE MALDITO para os acertos de `entry` (a ativa de um grupo com o Toque Maldito — `Gemas.gruposComGatilho`, `toqueMaldito`): cada
 * maldição do grupo com o efeito DELA (o nível, a qualidade e os suportes dela — o "35% menos Efeito" e a duração do Toque entram aqui), sem a área da maldição, na forma
 * da lista do `Reforcos.marcarCom`. null sem o Toque.
 */
export function maldicoesDoToqueS1(estado, entry, agora = estado?.hunt?.clock ?? 0) {
  const g = Gemas.gruposComGatilho(estado).find((x) => x.toqueMaldito && x.ataques.includes(entry?.id));
  if (!g) return null;
  const out = [];
  for (const acao of g.magias) {
    const entryDaMaldicao = POR_ID_PUBLICO(acao);
    const slug = entryDaMaldicao?.poeGema?.slug;
    const ef = slug ? Gemas.efeitoNaSkill(estado, acao) : null;
    const doPoe = ef ? GemasPoe.buffNoNivel(slug, ef.nivel ?? 1, ef.qualidade ?? 0) : null;
    if (!doPoe) continue;
    const efeitos = efeitosDaMaldicao(doPoe.efeitos, ef, estado, entryDaMaldicao).map((e) => (e.efeito === 'maldicaoRegras' ? { ...e, raioCasas: 0 } : e));
    out.push({ id: acao, def: { ...(Reforcos.REFORCOS[acao] ?? {}), tipo: 'poe-maldicao', efeitos }, fator: 1, lancado: agora, emAura: false });
  }
  return out.length ? out : null;
}
/** (D13) Quantas maldições a Ruína aplica (as ligadas, até o limite de maldições — "if curseCount == output.EnemyCurseLimit then break", o PoB). */
export function quantasDaRuina(lista) {
  const limite = Math.max(1, ...lista.map((x) => (x.def.efeitos ?? []).find((e) => e.efeito === 'maldicaoRegras')?.limite ?? 1));
  return Math.min(lista.length, limite);
}
/** (lote B2) Quem está agora num chão de Sangue Fervendo `o` fica queimando pelo "Perduram por N segundos" depois de sair (o fim: o do chão, ou agora, + N s). */
// (revisão B2, 21/10: a marca guarda QUEM — o dono do chão, `o.quem` —; o tique de outro membro não a queima; a de outro dono só é trocada pela mais forte)
function marcarSangueFervendo(hunt, o, agora) {
  const fim = Math.min(agora, o.ate);
  const forca = (x) => (x?.partes ?? []).reduce((t, p) => t + (p.porSegundo ?? 0), 0);
  for (const m of vivosNoAndar(hunt, o.z ?? hunt.z ?? 0)) {
    if (distanciaChebyshev(m, o) > o.raio) continue;
    const e = (m.estados ??= {});
    const s = e.poeSangueFervendo;
    const mesmoDono = (s?.quem ?? null) === (o.quem ?? null);
    if (s && s.ate > agora && (mesmoDono ? forca(s) > forca(o) : forca(s) >= forca(o))) continue;
    const segue = s?.ate > agora && mesmoDono;
    e.poeSangueFervendo = { ate: fim + (o.perduraMs ?? 0), partes: o.partes, acao: o.acao, dono: o.dono, quem: o.quem ?? null, z: o.z ?? hunt.z ?? 0, ultimo: segue ? s.ultimo : agora, resto: segue ? s?.resto ?? {} : {} };
  }
}
/**
 * (lote B2, dono 20/10) O tique das gemas do lote B2 (no das plantadas): o debuff CARREGADO do Golpe Infernal que expirou explode (D-B2.3); o SANGUE FERVENDO do Ceifar Vaal —
 * quem está no chão (até o fim dele) fica marcado até o fim + 4 s, e queima pelo tempo exato que esteve marcado (o dano por segundo da gema, pela resistência; um só por
 * inimigo, o mais forte). Na Safe Zone (você nela), nada fere.
 */
// ---------------------------------------------------------------- (lote B3, dono 21/10) os mecanismos do lote B3 no tique (`itens-poe/gemas-b3.mjs`)

/** O multiplicador do custo de Mana do uso (o dos suportes, o "aumentado/mais" e a eficiência da ficha — o mesmo do custo do uso, sem o fixo). */
function fatorDoCustoDeMana(estado, entry, ef) {
  const ficha = Ficha.combate(estado);
  const porTag = ModsPoe.somaPorTags(ficha, tagsPoeDaSkill(entry));
  if ((porTag.sem_custo_mana ?? 0) > 0) return 0;
  return ((1 + (ficha.custoDeMana ?? 0)) * (1 + (ef?.custoPct ?? 0) / 100) * Math.max(0, 1 + (ModsPoe.valor(ficha, 'custo_mana_inc') + (porTag.custo_mana_inc ?? 0)) / 100) * Math.max(0, 1 + (ModsPoe.valor(ficha, 'custo_mana_mais') + (porTag.custo_mana_mais ?? 0)) / 100))
    / Math.max(0.1, 1 + (ModsPoe.valor(ficha, 'eficiencia_custo_mana') + (porTag.eficiencia_custo_mana ?? 0)) / 100);
}
/**
 * (D-B3.4) A RAJADA da Chuva de Lâminas de Trarthus em volta de você: as N lâminas — cada uma num inimigo diferente da área da saraivada (sorteados; as que sobram,
 * em casas sorteadas dela) —, cada uma no raio dela (× √ da Área, a fração como chance); quem está em alguma leva um acerto (um por rajada — o PoB: "Each enemy can only
 * be hit once by each volley"); onde cada lâmina caiu fica uma Lâmina Persistente (o D8 do A3b: 6 s × a Duração, até 40).
 */
function rajadaDaTrarthus(estado, hunt, personagem, entry, ef, d, eventos, t) {
  const fator = ModsPoe.fatorDaArea(ef?.areaIncPct ?? 0, ef?.areaMaisPct ?? 0);
  const rv = Math.max(1, casasDoRaio(d.raioM * Math.sqrt(fator)));
  const rl = Math.max(0, casasDoRaio(d.laminaM * Math.sqrt(fator)));
  const c0 = { x: hunt.pos.x, y: hunt.pos.y };
  const vivos = vivosNoAndar(hunt).filter((m) => !m.dummy);
  const naArea = vivos.filter((m) => distanciaChebyshev(m, c0) <= rv);
  const alvos = GemasB3.sortearCasas(naArea, Math.min(d.laminas, naArea.length));
  const pontos = [...alvos.map((m) => ({ x: m.x, y: m.y })), ...GemasB3.sortearCasas(Areas.quadrado(c0, rv), d.laminas - alvos.length)];
  const cs = new Map();
  for (const p of pontos) for (const q of Areas.quadrado(p, rl)) cs.set(Areas.chave(q), q);
  const casas = [...cs.values()];
  const acertados = Areas.dentro(casas, vivos);
  eventos.push({ t: 'area', id: entry.efeito ?? null, x: c0.x, y: c0.y, casas: Areas.paraTela(casas, c0), sk: entry.id });
  if (acertados.length) golpeDoObjeto(estado, hunt, personagem, { acao: entry.id, x: c0.x, y: c0.y, z: hunt.z ?? 0, raio: rv, dono: 'voce' }, acertados[0], { casas }, eventos);
  const ate = t + Math.round(d.persistenteMs * fatorDeDuracao(estado, entry, ef));
  for (const p of pontos) porObjeto(hunt, { acao: entry.id, slug: entry.poeGema.slug, el: entry.element ?? null, dono: 'voce', tipo: 'lamina', mov: 'parado', efeito: 'inerte', x: p.x, y: p.y, ate, max: d.maxPersistentes }, t);
}
/**
 * O tique do lote B3:
 *  - D-B3.2: as FLECHAS PRESAS da Conflagração a até 1 casa de você (o PoE: "If you move close to a stuck arrow, it will explode") ou de um inimigo vivo (decisão
 *    do dono, 21/10) explodem, e cada explosão detona as suas
 *    presas no raio dela ("causing other stuck arrows in range to also explode"); a explosão acerta quem está no raio dela, com o "+50%" nos acertos e nas afecções, e põe
 *    o Fogo degenerativo da gema por 4 s × a Duração;
 *  - D-B3.4: a CHUVA DE LÂMINAS DE TRARTHUS ligada gasta 5% da Mana máxima por segundo (× o multiplicador de custo do uso) e solta as rajadas no intervalo; sem Mana para o
 *    tique, sem a gema na barra ou noutro andar, desliga.
 */
export function tiqueDasGemasB3(estado, hunt, personagem, eventos = [], agora = hunt?.clock ?? 0) {
  if (!hunt?.pos) return eventos;
  const presas = (hunt.poeObjetos ?? []).filter((o) => o.tipo === 'flechaPresa' && o.dono === 'voce' && (o.z ?? 0) === (hunt.z ?? 0) && o.ate > agora);
  // (decisão do dono, 21/10: também um INIMIGO a até 1 casa da flecha a detona)
  const vivosAqui = presas.length ? vivosNoAndar(hunt) : [];
  const fila = presas.filter((o) => distanciaChebyshev(o, hunt.pos) <= GemasB3.CONFLAGRACAO.gatilhoCasas || vivosAqui.some((m) => distanciaChebyshev(m, o) <= GemasB3.CONFLAGRACAO.gatilhoCasas));
  if (fila.length) {
    const explodem = new Set();
    while (fila.length) {
      const f = fila.shift();
      if (explodem.has(f)) continue;
      explodem.add(f);
      for (const o of presas) if (!explodem.has(o) && o.acao === f.acao && distanciaChebyshev(o, f) <= f.raio) fila.push(o);
    }
    hunt.poeObjetos = (hunt.poeObjetos ?? []).filter((o) => !explodem.has(o));
    for (const f of explodem) {
      if ((estado.hp ?? 0) <= 0) break;
      eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: f.x, y: f.y, lado: 2 * f.raio + 1 });
      const dentro = vivosNoAndar(hunt, f.z).filter((m) => distanciaChebyshev(m, f) <= f.raio);
      if (dentro.length) golpeDoObjeto(estado, hunt, personagem, f, dentro[0], { maisAcertoEAfeccaoPct: f.maisAcertoEAfeccaoPct, conflagracao: true }, eventos);
    }
  }
  const tr = hunt.poeTrarthus;
  if (tr) {
    const entry = POR_ID.get(tr.acao);
    if (!entry?.poeGema || !(estado.actions ?? []).some((a) => a?.id === tr.acao && a.enabled !== false) || (tr.z ?? 0) !== (hunt.z ?? 0) || (estado.hp ?? 0) <= 0) delete hunt.poeTrarthus;
    else {
      const ef = comOsAlvosDaGema(entry, Gemas.efeitoNaSkill(estado, entry.id), estado);
      const d = GemasPoe.b3DaGema(entry.poeGema.slug, ef?.nivel ?? 1, ef?.qualidade ?? 0).trarthus;
      const dt = Math.max(0, agora - (tr.ultimo ?? agora));
      tr.ultimo = agora;
      const custo = d ? GemasB3.custoDaTrarthus(d, estado.maxMana ?? 0, dt, fatorDoCustoDeMana(estado, entry, ef)) : Infinity;
      if (!d || custo > (estado.mana ?? 0)) delete hunt.poeTrarthus;
      else {
        estado.mana = Math.max(0, (estado.mana ?? 0) - custo);
        for (let guarda = 0; tr.proxima <= agora && guarda < 20 && hunt.poeTrarthus === tr && (estado.hp ?? 0) > 0; guarda++) {
          rajadaDaTrarthus(estado, hunt, personagem, entry, ef, d, eventos, tr.proxima);
          tr.proxima += GemasB3.intervaloDaTrarthus(d, estado.maxMana ?? 0);
        }
        if (tr.proxima <= agora) tr.proxima = agora + GemasB3.intervaloDaTrarthus(d, estado.maxMana ?? 0);
      }
    }
  }
  return eventos;
}

// ---------------------------------------------------------------- (lote PR4, dono 25/10) o que GRUDA ou PULSA no alvo (`itens-poe/gemas-pr4.mjs`)

/** Quem é o dono do que grudou (a party divide os bichos): o nome do personagem. */
const donoPR4 = (personagem) => personagem?.nome ?? 'voce';
/** (D3) A Concha Somática ativa no bicho (a de qualquer membro da party, a primeira que ainda aguenta), ou null. */
function conchaDoBicho(b, agora) {
  for (const c of Object.values(b?.poeConchas ?? {})) if (c && c.ate > agora && c.hp > 0) return c;
  return null;
}
/** (revisão) O bicho tem uma concha ESGOTADA que ainda não explodiu no tique (de qualquer um da party): conta como na imunidade — a nova não a sobrescreve. */
const conchaEsgotada = (b) => Object.values(b?.poeConchas ?? {}).some((c) => c?.estourou != null);
/**
 * O que o uso da gema do lote PR4 deixa (`dispararSemMarcar` → `aposOPasseDoPR4`): `{ entry, ef, ea, la, ge, rc, concha, ap, durMs, passa }` (só as da gema), ou null.
 * `passa`: o projétil que a Concha explodida solta (só a concha, no primeiro acertado).
 */
function usoDoPR4(estado, entry, ef, passa = false) {
  const slug = entry.poeGema.slug;
  const n = ef?.nivel ?? 1;
  const q = ef?.qualidade ?? 0;
  const concha = GemasPoe.conchaDaGema(slug, n, q);
  if (passa) return concha ? { entry, ef, concha, passa: true, durMs: Math.round(concha.duracaoS * 1000 * fatorDeDuracao(estado, entry, ef)) } : null;
  const ea = GemasPoe.flechaExplosivaDaGema(slug, n, q);
  const la = GemasPoe.eletrocussaoDaGema(slug, n, q);
  const ge = GemasPoe.estaticoDaGema(slug, n, q);
  const rc = GemasPoe.concentradosDaGema(slug, n, q);
  const ap = GemasPoe.aprisionadoraDaGema(slug, n, q);
  if (!ea && !la && !ge && !rc && !concha && !ap) return null;
  const durS = concha ? concha.duracaoS : GemasPoe.compilada(slug, n, q)?.stats?.duracao ?? (ea ? GemasPR4.FLECHA_EXPLOSIVA.duracaoS : GemasPR4.GOLPE_ESTATICO.duracaoS);
  return { entry, ef, ea, la, ge, rc, concha, ap, durMs: Math.round(durS * 1000 * fatorDeDuracao(estado, entry, ef)) };
}
/**
 * (revisão B4/PR4/C3) O bicho `m` MORREU (`combate.morrerOsMortos`, antes de sair da sala): as flechas da Flecha Explosiva grudadas nele e a Concha esgotada no golpe que
 * o matou explodem no próximo tique (a exceção 4 — "no máximo ou na morte do bicho"). Ficam os RESTOS na sala (todos da party os veem; cada um explode as suas no
 * tique dele), com a casa e o andar do morto; somem em 2 s ou na troca de andar.
 */
export function guardarRestosPR4(hunt, m) {
  if (!itensPoeLigado() || !m) return;
  const fusiveis = m.poeFusiveis && Object.keys(m.poeFusiveis).length ? { ...m.poeFusiveis } : null;
  const conchas = Object.fromEntries(Object.entries(m.poeConchas ?? {}).filter(([, c]) => c?.estourou != null));
  if (!fusiveis && !Object.keys(conchas).length) return;
  const sala = salaDe(hunt) ?? hunt;
  (sala.poeRestosPR4 ??= []).push({ uid: m.uid, x: m.x, y: m.y, z: m.z ?? hunt.z ?? 0, hp: 0, restos: true, ateRestos: (hunt.clock ?? 0) + 2000,
    ...(fusiveis ? { poeFusiveis: fusiveis } : {}), ...(Object.keys(conchas).length ? { poeConchas: conchas } : {}) });
  delete m.poeFusiveis;
  delete m.poeConchas;
}
/** A concha nova no bicho `b` (D3): a imunidade de 200 ms depois de uma explosão; a 7ª sua tira a mais velha (a exceção 7). */
function porConcha(hunt, b, u, quem, agora) {
  if (!(b?.hp > 0) || (b.poeConchaImuneAte ?? -Infinity) > agora || conchaEsgotada(b)) return false;
  (b.poeConchas ??= {})[quem] = { acao: u.entry.id, hp: u.concha.absorve, max: u.concha.absorve, absorvePct: u.concha.absorvePct, ate: agora + u.durMs, desde: agora };
  const minhas = (hunt.monstros ?? []).filter((m) => m.poeConchas?.[quem]?.ate > agora).sort((a, c) => a.poeConchas[quem].desde - c.poeConchas[quem].desde);
  for (const m of minhas.slice(0, Math.max(0, minhas.length - u.concha.maximo))) delete m.poeConchas[quem];
  return true;
}
/**
 * (lote PR4) Depois de cada passe do uso: `diretos` os do golpe direto, `golpes` os do `Secundarios.resolver`, `acertou` quem o passe acertou (o erro não gruda):
 *  - D1: a FLECHA EXPLOSIVA gruda no alvo final de cada flecha (a exceção 2): +1 flecha; a primeira marca a explosão para 1 s × a Duração; no máximo, explode já;
 *  - a ELETROCUSSÃO gruda no alvo final: mais N golpes, um a cada 0,5 s; até 10 por inimigo (a 11ª tira a mais velha sua);
 *  - D4: a FLECHA APRISIONADORA prende o alvo final: uma corda a mais (até 3), a âncora na casa do primeiro acerto;
 *  - D3: a CONCHA no primeiro acertado de cada projétil (a passada: só no primeiro do projétil);
 *  - D2: o GOLPE ESTÁTICO que acertou dá a energia estática (4 s × a Duração; renova); os RELÂMPAGOS CONCENTRADOS: +1 por ataque que acerta (a exceção 9).
 */
function aposOPasseDoPR4(estado, hunt, personagem, u, { diretos = [], golpes = [], acertou = () => true, agora = hunt?.clock ?? 0 } = {}) {
  const quem = donoPR4(personagem);
  if (u.concha) {
    const primeiros = GemasPR4.primeirosAcertados(diretos, golpes, acertou);
    // (a passada: o primeiro acertado que pode receber — o estourado, na imunidade, não; o que já tem concha, também não)
    for (const b of u.passa ? primeiros.filter((m) => !conchaDoBicho(m, agora) && !conchaEsgotada(m) && !((m.poeConchaImuneAte ?? -Infinity) > agora)).slice(0, u.concha.passa) : primeiros) porConcha(hunt, b, u, quem, agora);
    if (u.passa) return;
  }
  const finais = u.ea || u.la || u.ap ? GemasPR4.alvosFinais(diretos, golpes, acertou).filter((b) => b.hp > 0) : [];
  for (const b of finais) {
    if (u.ea) {
      const f = (b.poeFusiveis ??= {});
      const at = f[quem]?.ate > agora || f[quem]?.n >= f[quem]?.max ? f[quem] : null;
      const novo = at ?? { acao: u.entry.id, n: 0, desde: agora, ate: agora + u.durMs };
      // (revisão: o teto antes do tique — a flecha que gruda no pavio já no máximo, à espera do tique, não soma; o PoB, act_dex.lua: `math.min(..., fuseLimit)`)
      novo.max = u.ea.maximo;
      novo.n = Math.min(novo.max, novo.n + 1);
      if (novo.n >= novo.max) novo.ate = agora;
      f[quem] = novo;
    }
    if (u.la) {
      const lista = (b.poeEletrocussao ??= []);
      lista.push({ quem, acao: u.entry.id, proxima: agora + u.la.intervaloMs, intervaloMs: u.la.intervaloMs, restam: u.la.vezes });
      const minhas = lista.filter((x) => x.quem === quem);
      if (minhas.length > u.la.maximo) { const sai = new Set(minhas.slice(0, minhas.length - u.la.maximo)); b.poeEletrocussao = lista.filter((x) => !sai.has(x)); }
    }
    if (u.ap) b.poeAprisionado = GemasPR4.novaCorda(b.poeAprisionado, u.ap, b);
  }
  if ((u.ge || u.rc) && diretos.some(acertou)) {
    if (u.ge) {
      const at = hunt.poeEstatico?.acao === u.entry.id && hunt.poeEstatico.ate > agora ? hunt.poeEstatico : null;
      hunt.poeEstatico = { acao: u.entry.id, z: hunt.z ?? 0, ate: agora + u.durMs, proxima: at ? at.proxima : agora + GemasPR4.intervaloDoEstatico(u.ge) };
    }
    if (u.rc) {
      const at = hunt.poeConcentrados?.acao === u.entry.id && hunt.poeConcentrados.ate > agora ? hunt.poeConcentrados.n ?? 0 : 0;
      // (decisão do dono, 25/10) com Relâmpagos Concentrados, o ataque solta o feixe (os de antes do ganho — a exceção 9), no tique (a exceção 4)
      if (at > 0) (hunt.poeFeixesConcentrados ??= []).push({ acao: u.entry.id, n: Math.min(u.rc.maximo, at), z: hunt.z ?? 0 });
      hunt.poeConcentrados = { acao: u.entry.id, n: Math.min(u.rc.maximo, at + u.rc.ganha), ate: agora + u.durMs };
    }
  }
}
/** O raio (casas) de `metros` × √ da Área do uso (a fração como a chance de uma casa a mais). */
const raioDoUsoPR4 = (ef, metros) => Math.max(0, casasDoRaio(metros * Math.sqrt(ModsPoe.fatorDaArea(ef?.areaIncPct ?? 0, ef?.areaMaisPct ?? 0))));
/** A gema `acao` ainda está na barra (o que ela deixou some quando sai). */
const naBarra = (estado, acao) => (estado.actions ?? []).some((a) => a?.id === acao);
/** O primeiro vivo dentro das casas (a referência do golpe do objeto: o golpe acerta todos nelas), ou null. */
const vivoNasCasas = (hunt, casas, z) => { const em = new Set(casas.map((c) => `${c.x},${c.y}`)); return vivosNoAndar(hunt, z).find((m) => em.has(`${m.x},${m.y}`)) ?? null; };
/**
 * (lote PR4, dono 25/10) O TIQUE do lote PR4 (a exceção 4: o que grudou age no tique):
 *  - D1: a FLECHA EXPLOSIVA explode no fim do pavio (1 s × a Duração da primeira), no máximo ou na morte do bicho: a área de (1,5 m + 0,2 m por flecha, até +1,2 m) × √
 *    da Área em volta dele, com o "mais" das flechas (`GemasPR4.efeitoDoGolpePR4`); as flechas saem;
 *  - a ELETROCUSSÃO: cada flecha grudada acerta o bicho a cada 0,5 s, as N vezes; some com ele;
 *  - D2: a ENERGIA ESTÁTICA: a cada intervalo, um feixe em cada um dos N vivos mais perto de você a até o raio (2 m × √ da Área), com o "menos Dano" e os ricochetes;
 *  - D3: a CONCHA esgotada explode (a área de 1,8 m + a qualidade × √ da Área, 750% mais Dano em Área), deixa a imunidade de 200 ms e solta o projétil que passa a
 *    concha ao vivo mais perto, a até o alcance da gema; a vencida some;
 *  - D4: o APRISIONAMENTO quebra com o bicho a mais de 2 casas da âncora (ou morto).
 */
export function tiqueDasGemasPR4(estado, hunt, personagem, eventos = [], agora = hunt?.clock ?? 0) {
  if (!hunt?.pos) return eventos;
  const quem = donoPR4(personagem);
  const z = hunt.z ?? 0;
  const vivo = () => (estado.hp ?? 0) > 0;
  const efeitoDe = (entry) => comOsAlvosDaGema(entry, Gemas.efeitoNaSkill(estado, entry.id), estado);
  const sala = salaDe(hunt) ?? hunt;
  // (revisão: os RESTOS dos mortos — `guardarRestosPR4` — explodem como o bicho morto: as flechas e a concha esgotada de cada um da party, no tique dele)
  const restos = sala.poeRestosPR4 ?? [];
  for (const b of [...(hunt.monstros ?? []), ...restos]) {
    if ((b.z ?? z) !== z) continue;
    // a Flecha Explosiva
    const f = b.poeFusiveis?.[quem];
    if (f && (f.ate <= agora || !(b.hp > 0))) {
      delete b.poeFusiveis[quem];
      const entry = POR_ID.get(f.acao);
      if (entry?.poeGema && naBarra(estado, f.acao) && vivo()) {
        const ef = efeitoDe(entry);
        const d = GemasPoe.flechaExplosivaDaGema(entry.poeGema.slug, ef?.nivel ?? 1, ef?.qualidade ?? 0);
        if (d) {
          const raioBase = GemasPoe.areaNoNivel(entry.poeGema.slug, ef?.nivel ?? 1, ef?.qualidade ?? 0).raioM ?? GemasPR4.FLECHA_EXPLOSIVA.raioM;
          const raio = raioDoUsoPR4(ef, GemasPR4.raioDaExplosaoM(d, f.n, raioBase));
          const casas = Areas.quadrado({ x: b.x, y: b.y }, raio);
          eventos.push({ t: 'explosao', id: entry.efeito || EFEITO_DA_EXPLOSAO, x: b.x, y: b.y, lado: 2 * raio + 1 });
          const ref = b.hp > 0 ? b : vivoNasCasas(hunt, casas, z);
          if (ref) golpeDoObjeto(estado, hunt, personagem, { acao: f.acao, x: b.x, y: b.y, z, raio, dono: 'voce' }, ref, { casas, pr4: { tipo: 'explosao', n: f.n, d } }, eventos);
        }
      }
    }
    // a Eletrocussão
    if (b.poeEletrocussao?.length) {
      if (!(b.hp > 0)) delete b.poeEletrocussao;
      else {
        for (const x of b.poeEletrocussao) {
          if (x.quem !== quem) continue;
          if (!naBarra(estado, x.acao)) { x.restam = 0; continue; }
          for (let guarda = 0; x.restam > 0 && x.proxima <= agora && b.hp > 0 && vivo() && guarda < 20; guarda++) {
            golpeDoObjeto(estado, hunt, personagem, { acao: x.acao, x: b.x, y: b.y, z, raio: 0, dono: 'voce' }, b, { casas: [{ x: b.x, y: b.y }], pr4: { tipo: 'eletrocussao' } }, eventos);
            x.restam -= 1;
            x.proxima += x.intervaloMs;
          }
        }
        b.poeEletrocussao = b.poeEletrocussao.filter((x) => x.restam > 0);
        if (!b.poeEletrocussao.length || !(b.hp > 0)) delete b.poeEletrocussao;
      }
    }
    // a Concha Somática
    const c = b.poeConchas?.[quem];
    if (c && c.estourou != null) {
      delete b.poeConchas[quem];
      b.poeConchaImuneAte = Math.max(b.poeConchaImuneAte ?? -Infinity, c.estourou + GemasPR4.CONCHA.imunidadeMs);
      const entry = POR_ID.get(c.acao);
      if (entry?.poeGema && naBarra(estado, c.acao) && vivo()) {
        const ef = efeitoDe(entry);
        const d = GemasPoe.conchaDaGema(entry.poeGema.slug, ef?.nivel ?? 1, ef?.qualidade ?? 0);
        if (d) {
          const raio = raioDoUsoPR4(ef, d.raioM);
          const casas = Areas.quadrado({ x: b.x, y: b.y }, raio);
          eventos.push({ t: 'explosao', id: entry.efeito || EFEITO_DA_EXPLOSAO, x: b.x, y: b.y, lado: 2 * raio + 1 });
          const ref = b.hp > 0 ? b : vivoNasCasas(hunt, casas, z);
          if (ref) golpeDoObjeto(estado, hunt, personagem, { acao: c.acao, x: b.x, y: b.y, z, raio, dono: 'voce' }, ref, { casas, pr4: { tipo: 'concha', maisAreaPct: d.maisAreaPct } }, eventos);
          // a concha passa: o projétil sai do estourado para o vivo mais perto dele sem concha e fora da imunidade, a até o alcance da gema
          const alcance = entry.range || ALCANCE_PADRAO;
          const prox = vivosNoAndar(hunt, z).filter((m) => m !== b && !conchaDoBicho(m, agora) && !conchaEsgotada(m) && !((m.poeConchaImuneAte ?? -Infinity) > agora) && distanciaChebyshev(m, b) <= alcance)
            .sort((m1, m2) => distanciaChebyshev(m1, b) - distanciaChebyshev(m2, b))[0];
          if (prox && vivo()) golpeDoObjeto(estado, hunt, personagem, { acao: c.acao, x: b.x, y: b.y, z, raio: 0, dono: 'voce' }, prox, { emitir: true, angulos: [Math.atan2(prox.y - b.y, prox.x - b.x)], pr4: { tipo: 'passaConcha' } }, eventos);
        }
      }
    } else if (c && !(c.ate > agora && b.hp > 0)) delete b.poeConchas[quem];
    if (b.poeConchas && !Object.keys(b.poeConchas).length) delete b.poeConchas;
    if (b.poeFusiveis && !Object.keys(b.poeFusiveis).length) delete b.poeFusiveis;
    // a Flecha Aprisionadora
    if (b.poeAprisionado && (!(b.hp > 0) || GemasPR4.quebrouOAprisionamento(b.poeAprisionado, b))) delete b.poeAprisionado;
  }
  if (restos.length) {
    const ficam = restos.filter((r) => (r.z ?? z) === z && r.ateRestos > agora && (r.poeFusiveis || r.poeConchas));
    if (ficam.length) sala.poeRestosPR4 = ficam;
    else delete sala.poeRestosPR4;
  }
  // a energia estática do Golpe Estático
  const ge = hunt.poeEstatico;
  if (ge) {
    const entry = POR_ID.get(ge.acao);
    if (!entry?.poeGema || !naBarra(estado, ge.acao) || (ge.z ?? 0) !== z || !vivo()) delete hunt.poeEstatico;
    else {
      const ef = efeitoDe(entry);
      const d = GemasPoe.estaticoDaGema(entry.poeGema.slug, ef?.nivel ?? 1, ef?.qualidade ?? 0);
      if (!d) delete hunt.poeEstatico;
      else {
        const intervalo = GemasPR4.intervaloDoEstatico(d);
        const saltos = ef?.cadeiaPoe?.saltos ?? 0;
        for (let guarda = 0; ge.proxima <= Math.min(agora, ge.ate) && vivo() && guarda < 40; guarda++) {
          const raio = Math.max(1, raioDoUsoPR4(ef, GemasPR4.GOLPE_ESTATICO.raioM));
          const perto = vivosNoAndar(hunt, z).filter((m) => distanciaChebyshev(m, hunt.pos) <= raio).sort((a, m) => distanciaChebyshev(a, hunt.pos) - distanciaChebyshev(m, hunt.pos)).slice(0, d.alvos);
          const vivosAqui = vivosNoAndar(hunt, z);
          for (const t of perto) {
            if (!(t.hp > 0) || !vivo()) continue;
            const cadeia = saltosDaCadeia(t, vivosAqui, { targets: 1 + saltos, distance: alcanceDoRicochete(DISTANCIA_DA_CADEIA_POE(), ef) });
            golpeDoObjeto(estado, hunt, personagem, { acao: ge.acao, x: hunt.pos.x, y: hunt.pos.y, z, raio: 0, dono: 'voce' }, t, { casas: cadeia.map((m) => ({ x: m.x, y: m.y })), pr4: { tipo: 'feixe', menosPct: d.menosPct } }, eventos);
          }
          ge.proxima += intervalo;
        }
        if (ge.ate <= agora) delete hunt.poeEstatico;
      }
    }
  }
  // (decisão do dono, 25/10) o FEIXE dos Relâmpagos Concentrados: 1 alvo (o vivo mais perto de você a até 2 m × √ da Área), +1 ricochete a cada 2 Relâmpagos (+ os
  // ricochetes dos suportes), sem "menos Dano"; o "mais" dos Relâmpagos do ataque que o soltou
  const feixes = hunt.poeFeixesConcentrados;
  if (feixes) {
    delete hunt.poeFeixesConcentrados;
    for (const fx of feixes) {
      const entry = POR_ID.get(fx.acao);
      if (!entry?.poeGema || !naBarra(estado, fx.acao) || (fx.z ?? 0) !== z || !vivo()) continue;
      const ef = efeitoDe(entry);
      const rc = GemasPoe.concentradosDaGema(entry.poeGema.slug, ef?.nivel ?? 1, ef?.qualidade ?? 0);
      if (!rc) continue;
      const raio = Math.max(1, raioDoUsoPR4(ef, GemasPR4.GOLPE_ESTATICO.raioM));
      const vivosAqui = vivosNoAndar(hunt, z);
      const t = vivosAqui.filter((m) => distanciaChebyshev(m, hunt.pos) <= raio).sort((a, m) => distanciaChebyshev(a, hunt.pos) - distanciaChebyshev(m, hunt.pos))[0];
      if (!t) continue;
      const cadeia = saltosDaCadeia(t, vivosAqui, { targets: 1 + GemasPR4.ricochetesDoConcentrado(fx.n) + (ef?.cadeiaPoe?.saltos ?? 0), distance: alcanceDoRicochete(DISTANCIA_DA_CADEIA_POE(), ef) });
      golpeDoObjeto(estado, hunt, personagem, { acao: fx.acao, x: hunt.pos.x, y: hunt.pos.y, z, raio: 0, dono: 'voce' }, t, { casas: cadeia.map((m) => ({ x: m.x, y: m.y })), pr4: { tipo: 'feixeConcentrado', n: fx.n, maisPct: rc.maisPct } }, eventos);
    }
  }
  if (hunt.poeConcentrados && !(hunt.poeConcentrados.ate > agora)) delete hunt.poeConcentrados;
  return eventos;
}

// ---------------------------------------------------------------- (lote B4, dono 25/10) os mecanismos do lote B4 (`itens-poe/gemas-b4.mjs`)

/** O `chocado`/`congelado`… de `x` vale agora? */
const ativoB4 = (x, agora) => !!x && (x.ate ?? -Infinity) > agora;
/**
 * Os OBJETOS que o uso das gemas do lote B4 deixa (`criarObjetosDoUso`), no local mirado (ou no alvo):
 *  - D-B4.2: as FLECHAS da Chuva Tempestuosa (a do uso no centro da área e as dos "+N projéteis" sorteadas em volta, a até 1 casa — a da Barreira não soma: "Modificadores
 *    à quantidade de Projéteis não se aplicam"), até o máximo de flechas no chão (saem as mais velhas); cada uma pulsa N vezes, a largura do feixe pela Área do uso;
 *  - D-B4.3: o ORBE TROVEJANTE (um por gema: usar de novo troca o orbe), no raio da gema × √ da Área; golpeia ao ser posto e depois sozinho no intervalo ÷ (1 + a
 *    Velocidade de Conjuração), até N golpes;
 *  - D-B4.4: a HIDROESFERA (uma por gema: usar de novo a move e renova a duração), que pulsa ao ser posta/movida;
 *  - D-B4.5: as PAREDES — as casas perpendiculares à direção do alvo, centradas nele; a de Gelo aparece do centro para fora (uma casa a cada 0,15 s), a Flamejante de uma
 *    vez, com o degenerativo primário nas casas e o secundário em quem está nelas; até o máximo de Paredes Flamejantes (saem as mais velhas).
 */
function criarObjetosB4(estado, hunt, entry, ef, obj, { base, alvo, mira, x, y, formaNoUso, extras, fd, conta, agora }) {
  const eventos = [];
  const slug = entry.poeGema.slug;
  const nivel = ef?.nivel ?? 1;
  const q = ef?.qualidade ?? 0;
  const fator = ModsPoe.fatorDaArea(ef?.areaIncPct ?? 0, ef?.areaMaisPct ?? 0);
  const raioEmCasas = (m) => Math.max(0, casasDoRaio(m * Math.sqrt(fator)));
  const c = mira ?? formaNoUso ?? alvo ?? { x, y };
  const doDono = (o) => o.acao === entry.id && o.dono === base.dono;
  if (obj.tipo === 'flechaTempestade') {
    const andavel = ModsPoe.gradeDoCombate(hunt)?.andavel ?? null;
    const em = [{ x: c.x, y: c.y }];
    const n = obj.semQuantidade ? 0 : Math.max(0, extras);
    const vizinhas = Areas.quadrado(c, 1).filter((v) => (v.x !== c.x || v.y !== c.y) && (!andavel || andavel.has(Areas.chave(v))));
    for (const v of GemasB3.sortearCasas(vizinhas, Math.min(n, vizinhas.length))) em.push(v);
    for (const v of em) {
      porObjeto(hunt, { ...base, tipo: 'flechaTempestade', mov: 'parado', efeito: 'inerte', x: v.x, y: v.y, raio: 0, intervaloMs: obj.intervaloMs, proxima: agora + obj.intervaloMs, feixes: obj.feixes,
        largura: GemasB4.larguraDoFeixe(obj.larguraM, fator), ate: agora + obj.intervaloMs * obj.feixes + 1, max: obj.max }, agora);
    }
  } else if (obj.tipo === 'orbeTempestade') {
    const ficha = Ficha.combate(estado);
    const vel = (ficha.castSpeed ?? 0) + (ModsPoe.somaPorTags(ficha, tagsPoeDaSkill(entry)).cast_speed_tag ?? 0) + (ef?.velConjuracaoPct ?? 0);
    const intervaloMs = obj.intervaloMs ? obj.intervaloMs / Math.max(0.1, 1 + vel / 100) : null;
    // (sem duração: o orbe some depois dos N golpes — "Orbes desaparecem após N Golpes"; a troca de instância o tira, como todo objeto)
    // (golpeia ao ser posto — `golpeInicial`, no tique —: "will strike enemies in its area of effect with beams of lightning when placed", a descrição do PoB da das Borrascas)
    porObjeto(hunt, { ...base, tipo: 'orbeTempestade', mov: 'parado', efeito: 'inerte', x: c.x, y: c.y, raio: Math.max(1, raioEmCasas(obj.raioM)), raioDivisao: Math.max(1, raioEmCasas(obj.raioDivisaoM)),
      divide: obj.divide, golpes: obj.golpes, golpeInicial: true, ...(intervaloMs ? { intervaloMs, proxima: agora + intervaloMs } : {}), canalMs: obj.canalMs, proximoCanal: agora, teleporta: !!obj.teleporta, ate: agora + 3_600_000, max: 1 }, agora);
  } else if (obj.tipo === 'hidroesfera') {
    const ja = (hunt.poeObjetos ?? []).find((o) => o.tipo === 'hidroesfera' && doDono(o) && o.ate > agora);
    const comum = { raio: Math.max(1, raioEmCasas(obj.raioM)), pulsoMs: obj.pulsoMs, acertoMs: obj.acertoMs, limiar: obj.limiar, exposicaoPct: obj.exposicaoPct, encharcadoMs: Math.round(obj.encharcadoMs * fd), ate: agora + Math.round(obj.duracaoMs * fd) };
    // ("Create a sphere of water, or move an existing sphere and reset its duration … The sphere pulses when created … and after moving")
    if (ja) Object.assign(ja, comum, { x: c.x, y: c.y, z: hunt.z ?? 0, pulsoAgora: true }); // (revisão: + o andar de agora, como o `porObjeto`)
    else porObjeto(hunt, { ...base, tipo: 'hidroesfera', mov: 'parado', efeito: 'inerte', x: c.x, y: c.y, ...comum, estados: {}, proximoAcerto: -1, pulsoAgora: true, max: 1 }, agora);
  } else if (obj.tipo === 'paredeGelo' || obj.tipo === 'paredeFogo') {
    const n = GemasB4.casasDoComprimento(obj.comprimentoM, obj.comArea ? fator : 1);
    const casas = GemasB4.casasDaParede(c, { x, y }, n);
    hunt.poeParedesSeq = (hunt.poeParedesSeq ?? 0) + 1;
    const parede = `${entry.id}#${hunt.poeParedesSeq}`;
    const durMs = Math.max(1, Math.round(obj.duracaoMs * fd));
    if (obj.tipo === 'paredeGelo') {
      // (revisão: do centro para os DOIS lados ao mesmo tempo — o anel ⌈k ÷ 2⌉ da lista [centro, +1, −1, +2, −2, …]: wall_expand_delay_ms por passo)
      casas.forEach((v, k) => { const anel = Math.ceil(k / 2); porObjeto(hunt, { ...base, tipo: 'secaoGelo', mov: 'parado', efeito: 'inerte', x: v.x, y: v.y, raio: 0, parede, aparece: agora + anel * obj.secaoMs, ate: agora + anel * obj.secaoMs + durMs, porParedePct: obj.porParedePct }, agora); });
    } else {
      const dg = GemasPoe.degenerativoNoNivel(slug, nivel, q);
      const [p1, p2] = dg?.partes ?? [];
      const partes = p1 ? [{ tipo: GemasPoe.DEGEN_DO_ELEMENTO[p1.elemento], elemento: p1.elemento, porSegundo: totalDoDegenerativo(p1, 1000, conta) }] : [];
      const secundario = p2 ? { tipo: GemasPoe.DEGEN_DO_ELEMENTO[p2.elemento], elemento: p2.elemento, porSegundo: totalDoDegenerativo(p2, 1000, conta), ms: Math.max(1, Math.round(obj.secundarioMs * fd)) } : null;
      for (const v of casas) porObjeto(hunt, { ...base, tipo: 'secaoFogo', mov: 'parado', efeito: 'inerte', x: v.x, y: v.y, raio: 0, parede, partes, secundario, adicional: obj.adicional, ultimo: agora, ate: agora + durMs }, agora);
      // (o máximo de Paredes Flamejantes por vez: saem as mais velhas inteiras)
      const minhas = [...new Set((hunt.poeObjetos ?? []).filter((o) => o.tipo === 'secaoFogo' && doDono(o) && o.ate > agora).map((o) => o.parede))];
      if (minhas.length > obj.max) {
        const sai = new Set(minhas.slice(0, minhas.length - obj.max));
        hunt.poeObjetos = hunt.poeObjetos.filter((o) => !(o.tipo === 'secaoFogo' && doDono(o) && sai.has(o.parede)));
      }
    }
  }
  return eventos;
}
/**
 * (D-B4.3) Um GOLPE do Orbe Trovejante: um feixe num inimigo sorteado no raio do orbe, que se divide para até N outros a até o raio da divisão dele (os mais perto);
 * cada um leva um acerto. A das Borrascas teleporta para um dos atingidos (sorteado). Depois de N golpes, o orbe some.
 */
function golpeDoOrbe(estado, hunt, personagem, o, t) {
  const eventos = [];
  if (!o || !(o.golpes > 0) || !(o.ate > t - 1e-6)) return eventos;
  const vivos = vivosNoAndar(hunt, o.z).filter((m) => !m.dummy);
  const perto = vivos.filter((m) => distanciaChebyshev(m, o) <= o.raio);
  if (!perto.length) return eventos;
  const primeiro = perto[Math.min(perto.length - 1, Math.floor(Math.random() * perto.length))];
  const atingidos = GemasB4.atingidosDoOrbe(primeiro, vivos, o.divide, o.raioDivisao);
  // (revisão: o golpe RECUSADO — a zona segura, `imune` — não aparece, não gasta golpe nem teleporta)
  const golpe = [];
  if (!golpeDoObjeto(estado, hunt, personagem, o, primeiro, { casas: atingidos.map((m) => ({ x: m.x, y: m.y })) }, golpe)) return eventos;
  eventos.push(...atingidos.map((m) => ({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: m.x, y: m.y, lado: 1 })), ...golpe);
  o.golpes -= 1;
  if (o.teleporta) {
    const para = atingidos[Math.min(atingidos.length - 1, Math.floor(Math.random() * atingidos.length))];
    if (para) { o.x = para.x; o.y = para.y; }
  }
  if (o.golpes <= 0) o.ate = Math.min(o.ate, t);
  return eventos;
}
/** (D-B4.3) O seu uso de uma habilidade de Raio (não canalizada) a até o raio de um Orbe Trovejante seu faz esse orbe golpear agora. */
function orbesGolpeiamPeloUso(estado, hunt, personagem, agora, eventos) {
  for (const o of hunt.poeObjetos ?? []) {
    if (o.tipo !== 'orbeTempestade' || o.dono !== 'voce' || (o.z ?? 0) !== (hunt.z ?? 0) || !(o.ate > agora) || distanciaChebyshev(hunt.pos, o) > o.raio) continue;
    eventos.push(...golpeDoOrbe(estado, hunt, personagem, o, agora));
  }
}
/** A canalização de Raio sua em curso (D-B4.3: "canalizando" é qualquer gema canalizada de Raio), ou null. */
function canalizandoRaio(hunt, t) {
  const c = hunt.canalizacao;
  if (!c || c.liberou || !(t <= (c.ate ?? -Infinity) + 250)) return null;
  const tags = tagsPoeDaSkill(POR_ID.get(c.acao) ?? {});
  return tags.includes('canalizar') && tags.includes('raio') ? c : null;
}
/**
 * (D-B4.4) A ÁREA ou o PROJÉTIL do seu uso que pega a casa de uma Hidroesfera sua (de outra habilidade — o pulso dela não) a acerta, no máximo 1 vez a cada 1 s: as
 * afecções de Gelo e de Raio do acerto (o Congelamento, a Eletrização, e o Fragilizado/Exaurido se houver) são sorteadas nela como num bicho de vida fixa (o limiar do
 * PoB); o Resfriamento e os danos contínuos não ficam nela. Afligida de novo, ela volta a pulsar no ritmo dela.
 */
function acertarAsHidroesferas(estado, hunt, entry, ef, ficha, partes, danoMedio, { casas, emitidos = [], de, alvo, objeto = null, crit = false }, agora, eventos) {
  const esferas = (hunt.poeObjetos ?? []).filter((o) => o.tipo === 'hidroesfera' && o.dono === 'voce' && o.acao !== entry.id && o.id !== objeto && (o.z ?? 0) === (hunt.z ?? 0) && o.ate > agora && !(o.proximoAcerto > agora));
  if (!esferas.length) return;
  const nasCasas = new Set((casas ?? []).map(Areas.chave));
  const linhas = emitidos.length ? emitidos : !casas && alvo ? [{ de, para: alvo }] : [];
  const partesDoAcerto = partes?.length ? partes.map((p) => ({ elemento: p.elemento, dano: (((p.min + p.max) / 2) * (p.mult ?? 1) * (ef?.fatorDeDano ?? 1)) })) : [{ elemento: entry.element ?? 'physical', dano: danoMedio }];
  const afeccoes = GemasPoe.afeccoesComAGema(ficha.afeccoes, entry.poeGema.slug, ef?.nivel ?? 1, ef?.qualidade ?? 0);
  for (const o of esferas) {
    const k = Areas.chave(o);
    const pegou = nasCasas.has(k) || linhas.some((l) => (l.para.x === o.x && l.para.y === o.y) || GemasB4.cruza(l.de, l.para, new Set([k])));
    if (!pegou) continue;
    o.proximoAcerto = agora + o.acertoMs;
    const antes = GemasB4.afeccoesDaEsfera(o.estados, agora);
    const esfera = { uid: o.id, name: 'Hidroesfera', x: o.x, y: o.y, z: o.z, hp: o.limiar, maxHp: o.limiar, estados: { ...(o.estados ?? {}) }, dots: [], resist: {} };
    const postos = AfeccoesPoe.aoAcertar(esfera, partesDoAcerto, { afeccoes, crit: crit && !ficha.sobrecargaElemental, ataque: !!entry.poeGema.ataque, agora, salaDeBoss: false });
    const e = esfera.estados;
    o.estados = Object.fromEntries(['congelado', 'chocado', 'fragilizado', 'exaurido'].filter((x) => ativoB4(e[x], agora)).map((x) => [x, e[x]]));
    for (const st of postos.filter((x) => ['congelado', 'eletrizado'].includes(x))) eventos.push({ t: 'estado', uid: o.id, x: o.x, y: o.y, estado: st });
    const depois = GemasB4.afeccoesDaEsfera(o.estados, agora);
    if (!(antes.frio || antes.raio) && (depois.frio || depois.raio)) o.proxima = agora + o.pulsoMs;
  }
}
/** (D-B4.4) O PULSO da Hidroesfera: acerta todos no raio dela (o Físico convertido pela afecção dela) e põe Encharcado neles (a Exposição a Gelo e a Raio). */
function pulsoDaHidroesfera(estado, hunt, personagem, o, t, eventos) {
  eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: o.x, y: o.y, lado: 2 * o.raio + 1 });
  const dentro = vivosNoAndar(hunt, o.z).filter((m) => !m.dummy && distanciaChebyshev(m, o) <= o.raio);
  if (!dentro.length || Protecao.imune(hunt)) return;
  // (revisão: o Encharcado ANTES do golpe — "continually applies a drenched debuff … to enemies in its area … damaging all drenched enemies", o PoB: o pulso já sai
  // com a Exposição a Gelo e a Raio)
  for (const m of dentro) if (m.hp > 0) for (const el of ['ice', 'energy']) porExposicao(m, el, o.exposicaoPct, o.encharcadoMs, t);
  golpeDoObjeto(estado, hunt, personagem, o, dentro[0], { casas: Areas.quadrado(o, o.raio), conversaoFisico: GemasB4.conversaoDaEsfera(o.estados, t) }, eventos);
}
/**
 * (D-B4.5) A Parede Flamejante sua que a linha de `de` a `para` cruza agora: o dano de Fogo adicional dela (`[min, max]`; a mais forte, se cruza mais de uma), ou null.
 */
function paredeDeFogoNoCaminho(hunt, de, para, agora) {
  const secoes = (hunt?.poeObjetos ?? []).filter((o) => o.tipo === 'secaoFogo' && o.dono === 'voce' && o.adicional && (o.z ?? 0) === (hunt.z ?? 0) && o.ate > agora);
  if (!secoes.length) return null;
  const porParede = new Map();
  for (const o of secoes) (porParede.get(o.parede) ?? porParede.set(o.parede, { casas: new Set(), adicional: o.adicional }).get(o.parede)).casas.add(Areas.chave(o));
  let melhor = null;
  for (const p of porParede.values()) if (GemasB4.cruza(de, para, p.casas) && (!melhor || p.adicional[0] + p.adicional[1] > melhor[0] + melhor[1])) melhor = p.adicional;
  return melhor;
}
/** As casas das Paredes de Gelo que já apareceram agora (as do andar) — os bichos não passam por elas (`gradeSemParedes`). */
function casasDasParedesDeGelo(hunt, agora = hunt?.clock ?? 0) {
  const r = new Set();
  const porParede = new Map();
  for (const o of hunt?.poeObjetos ?? []) {
    if (o.tipo !== 'secaoGelo' || (o.z ?? 0) !== (hunt.z ?? 0) || !(o.ate > agora) || o.aparece > agora) continue;
    r.add(Areas.chave(o));
    const p = porParede.get(o.parede) ?? new Set();
    p.add(Areas.chave(o));
    porParede.set(o.parede, p);
  }
  // (revisão: a parede na DIAGONAL só se tocava pela quina — o bicho passava entre duas seções; a casa da quina, entre duas seções vizinhas na diagonal da mesma
  // parede, também segura: a parede vira uma escada contínua)
  for (const p of porParede.values()) {
    for (const k of p) {
      const [x, y] = k.split(',').map(Number);
      for (const dy of [-1, 1]) if (p.has(`${x + 1},${y + dy}`) && !p.has(`${x + 1},${y}`) && !p.has(`${x},${y + dy}`)) r.add(`${x + 1},${y}`);
    }
  }
  return r;
}
/**
 * (D-B4.5) A grade que os BICHOS usam sem as casas das suas Paredes de Gelo (a parede "segura os inimigos" como terreno até expirar — `cacadas`, `moverMonstros`). Sem
 * parede, a própria grade.
 */
export function gradeSemParedes(hunt, grade, agora = hunt?.clock ?? 0) {
  if (!itensPoeLigado() || !grade?.andavel || !hunt?.poeObjetos?.length) return grade;
  const paredes = casasDasParedesDeGelo(hunt, agora);
  if (!paredes.size) return grade;
  // (revisão: a grade sem as paredes fica guardada enquanto as casas delas não mudam — antes era refeita a cada tique, e a `numerica` do mapa inteiro junto)
  const chave = [...paredes].sort().join(';');
  const guardada = hunt._gradeSemParedes;
  if (guardada?.base === grade && guardada.chave === chave) return guardada.semParedes;
  const andavel = new Set();
  for (const k of grade.andavel) if (!paredes.has(k)) andavel.add(k);
  const semParedes = { ...grade, andavel };
  delete semParedes.numerica;
  delete semParedes.andares;
  Object.defineProperty(hunt, '_gradeSemParedes', { value: { base: grade, chave, semParedes }, enumerable: false, writable: true, configurable: true });
  return semParedes;
}
/**
 * (lote B4) O CAMPO GALVÂNICO: Eletrizar um inimigo com o buff do Campo Galvânico ativo cria o campo preso nele (um por gema — `max` —, saem os mais velhos; no inimigo
 * que já tem o campo da gema, não), com a força pela Eletrização dele ao criar (`GemasB4.campoPelaEletrizacao`), pela duração da gema × a Duração.
 */
export function campoGalvanicoAoEletrizar(estado, hunt, bicho, agora = hunt?.clock ?? 0) {
  if (!itensPoeLigado() || !bicho || !(bicho.hp > 0) || !hunt?.buffs) return;
  for (const [acao, b] of Object.entries(hunt.buffs)) {
    if (!(b?.ate > agora)) continue;
    const slug = String(acao).replace(GemasPoe.PREFIXO, '');
    if (!/^Galvanic_Field/.test(slug)) continue;
    const entry = POR_ID.get(acao);
    if (!entry?.poeGema) continue;
    const ef = comOsAlvosDaGema(entry, Gemas.efeitoNaSkill(estado, acao), estado);
    const d = GemasPoe.b4DaGema(slug, ef?.nivel ?? 1, ef?.qualidade ?? 0).campo;
    if (!d) continue;
    if ((hunt.poeObjetos ?? []).some((o) => o.tipo === 'campoGalvanico' && o.acao === acao && o.hospede === bicho.uid && o.ate > agora)) continue;
    const pct = ativoB4(bicho.estados?.chocado, agora) ? bicho.estados.chocado.pct ?? 0 : 0;
    const forca = GemasB4.campoPelaEletrizacao(d, pct);
    const fator = ModsPoe.fatorDaArea(ef?.areaIncPct ?? 0, ef?.areaMaisPct ?? 0);
    porObjeto(hunt, { acao, slug, el: 'energy', dono: 'voce', tipo: 'campoGalvanico', mov: 'parado', efeito: 'inerte', x: bicho.x, y: bicho.y, z: bicho.z ?? hunt.z ?? 0, hospede: bicho.uid,
      raio: Math.max(1, casasDoRaio(forca.raioM * Math.sqrt(fator))), maisPct: forca.maisPct, eletrizacaoPct: pct, feixeMs: d.feixeMs, focoMs: d.focoMs, focados: {}, proxima: agora + d.feixeMs,
      ate: agora + Math.max(1, Math.round(d.duracaoMs * fatorDeDuracao(estado, entry, ef))), max: d.max }, agora);
  }
}
/**
 * (lote B4, dono 25/10) O TIQUE do lote B4 (antes do dos objetos — `tiqueDasPlantadas`):
 *  - D-B4.2: as flechas da Chuva Tempestuosa pulsam — cada uma, um feixe até a flecha viva mais perto (`GemasB4.paresDoPulso`), acertando cada bicho nas casas do feixe;
 *  - D-B4.3: o Orbe Trovejante golpeia no intervalo dele e, com você canalizando Raio a até o raio dele, a cada 0,5 s;
 *  - o Campo Galvânico segue o inimigo dele e solta um feixe a cada intervalo num inimigo do raio que ele não focou há pouco;
 *  - D-B4.4: a Hidroesfera pulsa ao ser posta/movida e, afligida, no ritmo dela;
 *  - D-B4.5: as seções da Parede de Gelo aparecem (acertam e empurram quem está nelas; a da Invasão com o "mais" por parede ativa) e as da Flamejante queimam quem está
 *    nelas (o primário pelo tempo exato; o secundário renovado enquanto ele estiver lá — os da mesma gema não somam no bicho).
 */
export function tiqueDasGemasB4(estado, hunt, personagem, eventos = [], agora = hunt?.clock ?? 0) {
  if (!hunt?.pos) return eventos;
  const objs = (hunt.poeObjetos ?? []).filter((o) => (o.z ?? 0) === (hunt.z ?? 0));
  if (!objs.length) return eventos;
  const TETO = GemasA3b.TETOS.golpesPorTique;
  const imune = Protecao.imune(hunt);
  // as flechas da Chuva Tempestuosa (os pulsos de todas, na ordem do tempo)
  // (o último pulso de cada flecha é no fim dela — `ate` —, mesmo que o tique tenha passado dele)
  const flechas = objs.filter((o) => o.tipo === 'flechaTempestade' && o.feixes > 0);
  for (let n = 0; n < TETO * 4 && (estado.hp ?? 0) > 0; n++) {
    const prontas = flechas.filter((o) => o.feixes > 0 && o.proxima <= Math.min(agora, o.ate) + 1e-6);
    if (!prontas.length) break;
    const t = Math.min(...prontas.map((o) => o.proxima));
    const agoraPulsam = prontas.filter((o) => o.proxima <= t + 1e-6);
    const vivas = flechas.filter((o) => o.feixes > 0 && o.desde <= t);
    for (const [a, b] of GemasB4.paresDoPulso(agoraPulsam, vivas)) {
      const casas = GemasB4.casasDoFeixe(a, b, a.largura ?? 1);
      eventos.push({ t: 'area', id: null, x: a.x, y: a.y, casas: Areas.paraTela(casas, a), sk: a.acao, feixe: true });
      const nas = new Set(casas.map(Areas.chave));
      const dentro = vivosNoAndar(hunt, a.z).filter((m) => !m.dummy && nas.has(Areas.chave(m)));
      if (dentro.length && !imune) golpeDoObjeto(estado, hunt, personagem, a, dentro[0], { casas }, eventos);
    }
    for (const o of agoraPulsam) {
      o.feixes -= 1;
      o.proxima += o.intervaloMs;
      if (o.feixes <= 0) o.ate = Math.min(o.ate, t);
    }
  }
  for (const o of objs) {
    if ((estado.hp ?? 0) <= 0) break;
    if (o.tipo === 'orbeTempestade') {
      if (o.golpeInicial) { o.golpeInicial = false; if (!imune) eventos.push(...golpeDoOrbe(estado, hunt, personagem, o, agora)); }
      for (let n = 0; o.proxima != null && o.proxima <= agora + 1e-6 && n < TETO && o.ate > agora - 1e-6; n++) {
        const t = o.proxima;
        eventos.push(...golpeDoOrbe(estado, hunt, personagem, o, t));
        o.proxima = t + o.intervaloMs;
      }
      const canal = canalizandoRaio(hunt, agora);
      if (canal && distanciaChebyshev(hunt.pos, o) <= o.raio) {
        if (!(o.proximoCanal > agora)) { eventos.push(...golpeDoOrbe(estado, hunt, personagem, o, agora)); o.proximoCanal = agora + o.canalMs; }
      } else o.proximoCanal = Math.min(o.proximoCanal ?? agora, agora);
    } else if (o.tipo === 'campoGalvanico') {
      const hospede = (hunt.monstros ?? []).find((m) => m.uid === o.hospede && m.hp > 0 && (m.z ?? hunt.z ?? 0) === (o.z ?? 0));
      if (hospede) { o.x = hospede.x; o.y = hospede.y; }
      for (let n = 0; o.proxima <= Math.min(agora, o.ate) + 1e-6 && n < TETO; n++) {
        const t = o.proxima;
        o.proxima += o.feixeMs;
        const perto = vivosNoAndar(hunt, o.z).filter((m) => !m.dummy && distanciaChebyshev(m, o) <= o.raio);
        const alvo = GemasB4.alvoDoCampo(perto, o.focados, t, o.focoMs);
        if (!alvo || imune) continue;
        o.focados[alvo.uid] = t;
        eventos.push({ t: 'fx', id: EFEITO_DA_EXPLOSAO, uid: alvo.uid, x: alvo.x, y: alvo.y });
        golpeDoObjeto(estado, hunt, personagem, o, alvo, { casas: [{ x: alvo.x, y: alvo.y }], maisPct: o.maisPct, comoUso: true }, eventos);
      }
    } else if (o.tipo === 'hidroesfera') {
      if (o.pulsoAgora) {
        o.pulsoAgora = false;
        if (!imune) pulsoDaHidroesfera(estado, hunt, personagem, o, agora, eventos);
        o.proxima = agora + o.pulsoMs;
      }
      const a = GemasB4.afeccoesDaEsfera(o.estados, agora);
      // (sem afecção, não pulsa: afligida, o primeiro pulso sai um intervalo depois)
      if (!(a.frio || a.raio)) o.proxima = Math.max(o.proxima ?? agora, agora + o.pulsoMs);
      else for (let n = 0; o.proxima <= Math.min(agora, o.ate) + 1e-6 && n < TETO; n++) {
        const t = o.proxima;
        o.proxima += o.pulsoMs;
        const aT = GemasB4.afeccoesDaEsfera(o.estados, t);
        if (!(aT.frio || aT.raio)) break;
        if (!imune) pulsoDaHidroesfera(estado, hunt, personagem, o, t, eventos);
      }
    } else if (o.tipo === 'secaoGelo') {
      if (o.apareceu || o.aparece > agora + 1e-6) continue;
      o.apareceu = true;
      const ativas = new Set(objs.filter((x) => x.tipo === 'secaoGelo' && x.acao === o.acao && x.dono === o.dono && x.ate > o.aparece).map((x) => x.parede)).size;
      const dentro = vivosNoAndar(hunt, o.z).filter((m) => !m.dummy && m.x === o.x && m.y === o.y);
      eventos.push({ t: 'explosao', id: EFEITO_DA_EXPLOSAO, x: o.x, y: o.y, lado: 1 });
      if (!dentro.length || imune) continue;
      golpeDoObjeto(estado, hunt, personagem, o, dentro[0], { casas: [{ x: o.x, y: o.y }], ...(o.porParedePct ? { maisPct: o.porParedePct * ativas } : {}) }, eventos);
      for (const m of dentro) if (m.hp > 0) ModsPoe.empurrar(hunt, m);
    }
  }
  // as seções da Parede Flamejante: cada bicho queima pela seção mais forte da gema em que está (os da mesma gema não somam — como o chão do A3b)
  const fogo = objs.filter((o) => o.tipo === 'secaoFogo');
  if (fogo.length) {
    const forca = (o) => (o.partes ?? []).reduce((t, p) => t + (p.porSegundo ?? 0), 0);
    const porGema = new Map();
    for (const o of fogo) (porGema.get(`${o.acao}|${o.dono}`) ?? porGema.set(`${o.acao}|${o.dono}`, []).get(`${o.acao}|${o.dono}`)).push(o);
    for (const lista of porGema.values()) {
      const melhor = new Map();
      for (const m of vivosNoAndar(hunt)) {
        let b = null;
        for (const o of lista) if (o.ate > (o.ultimo ?? agora) && m.x === o.x && m.y === o.y && (!b || forca(o) > forca(b))) b = o;
        if (b) melhor.set(m, b);
      }
      for (const o of lista) {
        const fim = Math.min(agora, o.ate);
        const dt = Math.max(0, fim - (o.ultimo ?? fim));
        o.ultimo = fim;
        if (imune || !(dt > 0)) continue;
        queimarNoSolo(hunt, o, (m) => melhor.get(m) === o, dt, eventos, 'paredeFogo');
        // o debuff secundário em quem está na parede ("each enemy that enters the wall also receives a secondary burning debuff which persists for a short duration after
        // leaving the wall"): renovado enquanto ele está nela
        if (o.secundario?.porSegundo > 0) for (const [m, s] of melhor) if (s === o && m.hp > 0) Dot.aplicar(m, { tipo: o.secundario.tipo, total: (o.secundario.porSegundo * o.secundario.ms) / 1000, duracaoMs: o.secundario.ms, chave: `${o.slug}:secundario`, origem: { fonte: 'gema', habilidade: o.acao } }, agora);
      }
    }
  }
  return eventos;
}

export function tiqueDasGemasB2(estado, hunt, personagem, eventos = [], agora = hunt?.clock ?? 0) {
  // (revisão B2, 21/10) o que a morte processada por outro membro deixou para você (a carga do Ceifar, o Golpe Infernal do morto)
  const sala = salaDe(hunt) ?? hunt;
  if (sala.poeB2Pendentes?.length) {
    const meus = sala.poeB2Pendentes.filter((p) => ehMeu(p.quem, personagem));
    if (meus.length) {
      sala.poeB2Pendentes = sala.poeB2Pendentes.filter((p) => !meus.includes(p));
      if (!sala.poeB2Pendentes.length) delete sala.poeB2Pendentes;
      for (const p of meus) {
        if (p.sangrenta) GemasB2.mudarSangrentas(hunt, p.sangrenta, agora);
        if (p.infernal) infernalNaMorte(estado, hunt, personagem, p.infernal, p.onde, p.maxHp ?? 0, eventos, agora);
      }
    }
  }
  for (const m of [...(hunt.monstros ?? [])]) {
    for (const deb of infernaisDe(m)) {
      if (deb.ate > agora || !ehMeu(deb.quem, personagem)) continue;
      tirarInfernal(m, deb);
      if (deb.carregado && deb.n > 0 && m.hp > 0 && (estado.hp ?? 0) > 0) explodirInfernal(estado, hunt, personagem, { x: m.x, y: m.y, z: m.z ?? hunt.z ?? 0 }, deb, eventos);
    }
  }
  for (const o of hunt.poeObjetos ?? []) if (o.sangueFervendo && (o.z ?? 0) === (hunt.z ?? 0) && o.ate > (o.marcado ?? -Infinity)) { marcarSangueFervendo(hunt, o, agora); o.marcado = Math.min(agora, o.ate); }
  const imune = Protecao.imune(hunt);
  for (const m of vivosNoAndar(hunt)) {
    const s = m.estados?.poeSangueFervendo;
    if (!s || !ehMeu(s.quem, personagem)) continue;
    const fim = Math.min(agora, s.ate);
    const dt = Math.max(0, fim - (s.ultimo ?? fim));
    s.ultimo = fim;
    if (dt > 0 && !imune) queimarNoSolo(hunt, s, (x) => x === m, dt, eventos, 'sangueFervendo');
    if (s.ate <= agora) delete m.estados.poeSangueFervendo;
  }
  return eventos;
}

/**
 * (lote A3b, dono 19/10) Os OBJETOS no tempo (no tique das plantadas): move cada um e faz o efeito dele — o PULSO e a EMISSÃO a cada intervalo (até 60 golpes
 * por objeto por tique — D12; o que passar do teto não sai), o CHÃO pelo tempo exato (a área fria da Geada anda com ele), a CAPTURA da Espiral Venenosa
 * Vaal; o Olho Invernal solta a espiral do fim quando acaba (no fim do voo ou no terreno). Os vencidos saem.
 */
export function tiqueDosObjetos(estado, hunt, personagem, eventos = [], agora = hunt?.clock ?? 0) {
  const TETO = GemasA3b.TETOS.golpesPorTique;
  const chaos = [];
  for (const o of [...(hunt.poeObjetos ?? [])]) {
    if (!(hunt.poeObjetos ?? []).includes(o)) continue;
    if ((o.z ?? 0) !== (hunt.z ?? 0)) { o.ate = Math.min(o.ate, agora); continue; }
    if (o.efeito === 'solo') {
      const fim = Math.min(agora, o.ate);
      if (o.mov === 'persegue') moverObjeto(hunt, o, fim);
      const dt = Math.max(0, fim - (o.ultimo ?? fim));
      o.ultimo = fim;
      if (dt > 0) chaos.push({ o, dt });
      if (o.mov === 'persegue') for (const a of hunt.areasFrias ?? []) if (a.obj === o.id) { a.x = o.x; a.y = o.y; }
      continue;
    }
    if (!['pulso', 'emitir', 'capturar'].includes(o.efeito)) continue;
    let n = 0;
    // (a folga de 1e-6 ms: o intervalo fracionário — 1000 ÷ 15 — não perde o último por arredondamento)
    while (o.proxima <= Math.min(agora, o.ate) + 1e-6 && n < TETO && (estado.hp ?? 0) > 0 && !o.acabou) {
      const t = o.proxima;
      moverObjeto(hunt, o, t);
      if (o.acabou) break;
      if (o.efeito === 'pulso') pulsarObjeto(estado, hunt, personagem, o, t, eventos);
      else if (o.efeito === 'emitir') emitirDoObjeto(estado, hunt, personagem, o, eventos);
      else if ((hunt.poeObjetos ?? []).filter((x) => x.tipo === 'capturado' && x.acao === o.acao && x.ate > t).length < o.capturaMax) {
        porObjeto(hunt, { acao: o.acao, slug: o.slug, el: o.el, dono: o.dono, tipo: 'capturado', mov: 'no_dono', efeito: 'inerte', x: hunt.pos.x, y: hunt.pos.y, ate: t + o.capturaMs, max: o.capturaMax, manterPct: o.manterPct }, t);
      }
      o.proxima += o.intervaloMs;
      n++;
    }
    // (D12: o que passou do teto neste tique não sai)
    if (n >= TETO && o.proxima <= agora) o.proxima = agora + o.intervaloMs;
    if (o.mov !== 'parado' && !o.acabou && o.proxima > agora) moverObjeto(hunt, o, Math.min(agora, o.ate));
    // (D11) a espiral do fim do Olho Invernal: N fragmentos em volta (360° ÷ N), do lugar onde ele acabou
    if (o.tipo === 'olho' && !o.estourou && (o.acabou || o.ate <= agora) && (estado.hp ?? 0) > 0) {
      o.estourou = true;
      o.ate = Math.min(o.ate, agora);
      if (o.fim > 0) dispararDoObjeto(estado, hunt, personagem, o, Array.from({ length: o.fim }, (_, k) => o.ang + (2 * Math.PI * k) / o.fim), eventos);
    }
  }
  // (revisão do A3b) o CHÃO queima: os da mesma gema não somam no mesmo bicho (no PoE o dano contínuo da mesma habilidade não acumula com ele mesmo) — cada
  // bicho queima só pelo mais forte da gema em que está; na Safe Zone (você nela), nada fere
  if (chaos.length && !Protecao.imune(hunt)) {
    const forca = (o) => (o.partes ?? []).reduce((t, p) => t + (p.porSegundo ?? 0), 0);
    const grupos = new Map();
    for (const c of chaos) { const k = `${c.o.acao}|${c.o.dono}`; (grupos.get(k) ?? grupos.set(k, []).get(k)).push(c); }
    for (const lista of grupos.values()) {
      const melhor = new Map();
      for (const m of vivosNoAndar(hunt)) {
        let b = null;
        for (const c of lista) if (distanciaChebyshev(m, c.o) <= c.o.raio && (!b || forca(c.o) > forca(b.o))) b = c;
        if (b) melhor.set(m, b);
      }
      for (const c of lista) queimarNoSolo(hunt, c.o, (m) => melhor.get(m) === c, c.dt, eventos, 'objeto');
    }
  }
  hunt.poeObjetos = (hunt.poeObjetos ?? []).filter((o) => o.ate > agora && !(o.tipo === 'olho' && o.estourou));
  if (!hunt.poeObjetos.length) delete hunt.poeObjetos;
  return eventos;
}

/**
 * (D9) As LÂMINAS GIRATÓRIAS soltam todos os seus projéteis capturados da Espiral Venenosa do ponto de chegada, em leque (360° ÷ N, a partir do rumo do vivo
 * mais perto), com o dano do projétil de ida (sem voltar); cada um tem a chance da gema ("40% de chance de manter cada Projétil capturado") de ficar.
 */
function soltarCapturados(estado, hunt, personagem, agora) {
  const eventos = [];
  // (revisão do A3b: no máximo 30 por soltura — `snapping_adder_maximum_projectiles_released 30`, act_dex.lua:16313/16394 —, os mais velhos primeiro; os que
  // passam do teto seguem capturados; só os soltos passam pela chance de ficar)
  const capturados = (hunt.poeObjetos ?? []).filter((o) => o.tipo === 'capturado' && o.dono === 'voce' && o.ate > agora && (o.z ?? 0) === (hunt.z ?? 0)).slice(0, GemasA3b.ESPIRAL_VENENOSA.maxSoltos);
  if (!capturados.length) return eventos;
  const porAcao = new Map();
  for (const o of capturados) (porAcao.get(o.acao) ?? porAcao.set(o.acao, []).get(o.acao)).push(o);
  const perto = maisPertoDe(hunt, hunt.pos);
  const a0 = perto ? Math.atan2(perto.y - hunt.pos.y, perto.x - hunt.pos.x) : RUMO_DA_DIRECAO[hunt.pos.dir ?? 2] ?? 0;
  for (const [acao, lista] of porAcao) {
    const de = { acao, x: hunt.pos.x, y: hunt.pos.y, z: hunt.z ?? 0, dono: 'voce' };
    // (o golpe que não saiu — sem alvo, recusado — não gasta os capturados)
    if (!dispararDoObjeto(estado, hunt, personagem, de, lista.map((_, k) => a0 + (2 * Math.PI * k) / lista.length), eventos, { semVolta: true })) continue;
    const sai = new Set(lista.filter((o) => !(Math.random() * 100 < (o.manterPct ?? 40))));
    hunt.poeObjetos = (hunt.poeObjetos ?? []).filter((o) => !sai.has(o));
  }
  if (!hunt.poeObjetos?.length) delete hunt.poeObjetos;
  return eventos;
}

/**
 * (lote A3b, dono 19/10: D13) Os objetos para a TELA (`cacadas.snapshotDaHunt` → `map.mjs`): o tipo, a casa, o raio (casas), o FIM (`ate`, no relógio de
 * quem vê — `relogio`: o cliente calcula o que falta, e a lista não muda a cada tique só pelo tempo — o quadro em delta) e o elemento; os capturados vão
 * juntos, na casa do dono, com o número; `segue`: o uid de quem o objeto acompanha (você — `player` —, ou o aliado), para a tela o pôr na posição andando
 * dele. A espiral e o captador não têm desenho próprio (os projéteis deles são os tiros). Só os da TELA de quem vê (`centro`, a janela do quadro + o raio).
 * `sufixo`: o do aliado (o id não colide com os seus).
 */
export function objetosParaCliente(hunt, { centro = hunt?.pos, relogio = hunt?.clock ?? 0, segue = 'player', sufixo = '' } = {}) {
  const agora = hunt?.clock ?? 0;
  const saida = [];
  let capturados = 0;
  const naTela = (o) => !centro || (Math.abs(o.x - centro.x) - (o.raio ?? 0) <= JANELA.x && Math.abs(o.y - centro.y) - (o.raio ?? 0) <= JANELA.y);
  for (const o of hunt?.poeObjetos ?? []) {
    if (!(o.ate > agora) || (o.z ?? 0) !== (hunt.z ?? 0)) continue;
    if (o.tipo === 'capturado') { capturados++; continue; }
    // (lote PR1: + o escudo de Trarthus — os desenhos são os das estilhas, os tiros)
    // (lote B2: + a Explosão Voltáxica que aguarda — o desenho é a explosão, no fim)
    if (o.tipo === 'espiral' || o.tipo === 'captador' || o.tipo === 'escudo' || o.tipo === 'voltaxica' || !naTela(o)) continue;
    // (lote B4: a seção da Parede de Gelo que ainda não apareceu não se desenha)
    if (o.aparece > agora) continue;
    saida.push({ id: `${o.id}${sufixo}`, t: o.tipo, x: o.x, y: o.y, r: o.raio ?? 0, ate: Math.round(o.ate - agora + relogio), ...(o.el ? { el: o.el } : {}),
      ...(o.tipo === 'vortice' ? { n: (o.laminas ?? []).filter((a) => a > agora).length } : {}), ...(o.mov === 'no_dono' && o.dono === 'voce' ? { segue } : {}),
      ...(o.tipo === 'tempestadeDeLaminas' && o.postura ? { postura: o.postura } : {}) }); // (revisão do C3: a cor da tempestade pela Postura dela, na tela)
  }
  if (capturados && hunt?.pos && naTela(hunt.pos)) saida.push({ id: `capturados${sufixo}`, t: 'capturados', x: hunt.pos.x, y: hunt.pos.y, r: 0, ate: 0, n: capturados, segue });
  return saida.slice(0, 160);
}
/**
 * (lote A3b, dono 19/10: D8) As LÂMINAS PERSISTENTES no chão agora — para a Arma Animada dos Arcos (a sessão dos lacaios) consumir: ela lê esta lista (as
 * do andar, vivas; `{ x, y, acao, ate }`) e tira as que usou com `consumirObjetos(hunt, as_usadas)`.
 */
export const laminasPersistentes = (hunt, agora = hunt?.clock ?? 0) => (hunt?.poeObjetos ?? []).filter((o) => o.tipo === 'lamina' && o.ate > agora && (o.z ?? 0) === (hunt.z ?? 0));
/** Tira da caçada os objetos `quais` (os da lista de `hunt.poeObjetos`). Devolve quantos saíram. */
export function consumirObjetos(hunt, quais = []) {
  const sai = new Set(quais);
  const antes = hunt?.poeObjetos?.length ?? 0;
  if (!antes) return 0;
  hunt.poeObjetos = hunt.poeObjetos.filter((o) => !sai.has(o));
  const n = antes - hunt.poeObjetos.length;
  if (!hunt.poeObjetos.length) delete hunt.poeObjetos;
  return n;
}

/**
 * (lote A2) A Pancada nas torres: cada torre nas casas do uso explode — o dano de ataque da habilidade de Tomar a Carne ("Dano de Ataque: 250% de
 * base": o físico médio da sua arma × isso), no raio da explosão (4,5 m), com o Sangramento ("Causa Sangramento", "200% mais Dano com
 * Sangramento"). O acerto é o das habilidades sem golpe (`acertoDoArauto`, com a tag de ataque e as tags do Clamor que a ergueu).
 */
function explodirTorres(estado, hunt, casas, personagem, agora) {
  const eventos = [];
  const em = new Set((casas ?? []).map((c) => `${c.x},${c.y}`));
  const vivas = (hunt.a2?.torres ?? []).filter((t) => t.ate > agora);
  const explodem = vivas.filter((t) => (t.z ?? 0) === (hunt.z ?? 0) && em.has(`${t.x},${t.y}`));
  if (!explodem.length) { if (hunt.a2) hunt.a2.torres = vivas; return eventos; }
  hunt.a2.torres = vivas.filter((t) => !explodem.includes(t));
  const ficha = Ficha.combate(estado);
  const arma = armaSemAdicionado(ficha);
  for (const t of explodem) {
    const raio = Math.max(1, casasDoRaio(t.raioM));
    eventos.push({ t: 'explosao', uid: 'player', x: t.x, y: t.y, raio, fonte: 'torre-ossea', color: COR_DO_ELEMENTO.physical ?? '#d0d0d0' });
    for (const m of [...(hunt.monstros ?? [])]) {
      if (!(m.hp > 0) || m.dummy || (m.z ?? hunt.z ?? 0) !== (t.z ?? 0) || Math.max(Math.abs(m.x - t.x), Math.abs(m.y - t.y)) > raio) continue;
      const bruto = ((arma.min + Math.random() * (arma.max - arma.min)) * t.danoPct) / 100;
      const tags = [...new Set([...tagsPoeDaSkill(POR_ID.get(t.acao) ?? {}), 'ataque', 'area', 'fisico'])];
      acertoDoArauto(estado, hunt, t.acao, m, bruto, 'physical', { tags, eventos, fonte: 'torre-ossea', personagem, ataque: true, adicionado: 1, afeccoesExtra: { chance: t.sangram ? { sangramento: 100 } : {}, maisDoSuporte: t.sangramentoMaisPct ? { sangramento: t.sangramentoMaisPct } : {} } });
    }
  }
  return eventos;
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
// (lote G-A, dono 25/10) as Cargas de Frasco da Marca do Alquimista no acerto (`ModsPoe.aoAcertar` → `FrascosPoe.ganharCargas`)
ModsPoe.definirCargasDeFrasco((estado, n) => FrascosPoe.ganharCargas(estado, n));
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
// (lote C4, dono 21/10) as maldições de dano sofrido no pulso do degenerativo das gemas (`Dot.recebidoNoPulso`)
Dot.definirVulnerabilidadeNoDot((m, el, agora) => Reforcos.vulnerabilidade(m, el, agora));

/**
 * (17/10, lote G15) Depois do acerto no personagem: "Conjurar ao ser Atordoado" (o atordoamento que este acerto pôs — `hunt.controle.atordoado`,
 * uma vez) e "Conjurar ao Morrer" (a vida chegou a 0: as magias saem antes do fim). Quem chama: o golpe e a magia do bicho no personagem.
 */
export function depoisDeSerAcertado(estado, hunt, personagem, eventos = []) {
  if (!itensPoeLigado() || !hunt) return 0;
  let n = 0;
  const at = hunt.controle?.atordoado;
  if (at && at.desde === (hunt.clock ?? 0) && !at.gatilhou) { at.gatilhou = true; n += ativarGatilhos(estado, hunt, personagem, 'atordoado', {}, eventos); }
  if ((estado.hp ?? 0) <= 0 && !hunt.poeGatilhouMorte) { hunt.poeGatilhouMorte = true; n += ativarGatilhos(estado, hunt, personagem, 'morte', {}, eventos); }
  return n;
}
/** (lote G15) A Canalização Infundida: o % de "menos Dano dos Acertos" enquanto canaliza a habilidade suportada por ela (0 sem canalizar). */
export function menosDanoDaCanalizacao(estado, hunt) {
  const c = hunt?.canalizacao;
  if (!itensPoeLigado() || !c || !(c.ate + 250 >= (hunt.clock ?? 0))) return 0;
  return Math.max(0, Number(Gemas.efeitoNaSkill(estado, c.acao)?.infusaMenosDanoPct) || 0);
}
/** (lote G15) Conjurar enquanto Canaliza: canalizando agora a habilidade do grupo, as magias dele saem a cada intervalo (a recarga do gatilho). */
export function tiqueDaCanalizacao(estado, hunt, personagem, eventos = []) {
  // (lote A1b, dono 19/10: I7) o canalizar da Investida Carregada ACABOU (nenhum uso dela no tempo — você parou de usá-la, mudou de andar): a miragem é
  // liberada (a onda final e o teleporte — `soltarMiragem`)
  const mir = hunt?.miragem;
  // (revisão do A1b: + você andou — o canalizar acaba na hora, sem o teleporte de volta)
  if (itensPoeLigado() && mir && !mir.soltou && ((hunt.clock ?? 0) > (mir.ate ?? -Infinity) + 250 || (mir.z ?? 0) !== (hunt.z ?? 0) || !naCasaDoCanalizar(hunt, mir))) {
    const alvo = hunt.alvo != null ? (hunt.monstros ?? []).find((b) => b.uid === hunt.alvo && b.hp > 0) ?? null : null;
    eventos.push(...soltarMiragem(estado, hunt, personagem, alvo));
  }
  const c = hunt?.canalizacao;
  if (!itensPoeLigado() || !c || !(c.ate + 250 >= (hunt.clock ?? 0))) return 0;
  return ativarGatilhos(estado, hunt, personagem, 'canalizar', { acao: c.acao }, eventos);
}

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
