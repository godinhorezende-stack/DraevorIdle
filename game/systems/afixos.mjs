// Afixos ("Atributos" da peça) — a soma do que está vestido, a régua, a cor, a
// forja (rerrolar) e a regra de guardar na venda automática.
//
// Formato na peça: `af: [{id, nivel, value, rr?}]` — `id` do `catalog.afixos`
// (49 no total), `nivel` o TIER do add (T1–T5), `value` já no número final
// ("+3.1%"), `rr` quantas vezes aquele posto foi rerrolado. Peça de antes do
// sistema de itens tinha `tier` (1–3) no lugar do nível: `nivelDe` resolve as
// duas, e a entrada no personagem converte (ver `systems/itens/item.mjs`). A
// essência (item 900001) leva um afixo só e `afixoDe` (o slot de onde saiu),
// `raridade` e `mitica` (a vermelha).
//
// O SORTEIO não mora mais aqui: raridade, quantidade, quais atributos, nível e
// valor saem do gerador central (`systems/itens/gerar.mjs`), com as tabelas em
// `gamedata/itens/*.json`. Antes era fixo em código, medido nos drops reais do
// original (1 afixo 73% / 2 24% / 3 3%; T1 90% / T2 8% / T3 2%; 31% "tortos").
import * as Atributos from './personagem/atributos.mjs';
import * as Passivas from './passivas/arvore.mjs';
import * as Especializacoes from './personagem/especializacoes.mjs';
import { CATALOGO, ITEM_CATALOG } from './dados.mjs';
import * as R from './regras.mjs';
import * as Gemas from './gemas.mjs';
// O sistema de itens (raridade, níveis 1–5, faixas por nível, pools): a régua
// de cada atributo passa a ser a dele — ver `systems/itens/config.mjs`.
import * as ItensConfig from './itens/config.mjs';
import * as Gerar from './itens/gerar.mjs';
import { raridadeDaPeca, faixaDoCampo } from './itens/item.mjs';
import { gruposLigados } from '../engine/sockets-de-gema.mjs';
import * as CargasPoe from './itens-poe/cargas.mjs';
import { ligado as itensPoeLigado } from './itens-poe/catalogo.mjs';
import * as FrascosPoe from './itens-poe/frascos.mjs';
import * as GemasPoe from './itens-poe/gemas-poe.mjs';
import * as ModsPoe from './itens-poe/condicoes-poe.mjs';
import { addsDosDebuffsNoJogador } from './itens-poe/monstros-no-jogador.mjs';
import { addsDosVinculos } from './itens-poe/vinculos.mjs';
import { addsDoAco } from './itens-poe/convocar-o-aco.mjs';
import * as Aliados from './itens-poe/aliados.mjs';
import * as Mapas from './itens-poe/mapas.mjs';
// (a soma da árvore para quem não monta a ficha — as gemas do peitoral suportadas pela árvore: `skills/gemas.dasPecas`)
ModsPoe.definirLeitorDaArvore((estado) => Passivas.efeitos(estado).adds);

export const FICHAS = CATALOGO.afixos ?? {};
export const ID_DA_ESSENCIA = 900001;
export const MAX_AFIXOS = 3;
export const FRACAO_DA_MITICA = 1.3;
export const RARIDADES = ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico'];

// Os slots cujas peças levam adds. O que cada peça aceita é o POOL do tipo dela
// (`gamedata/itens/pools.json`, via `Gerar.poolDe`) — a lista única de "o que
// pode rolar onde"; um add fora do pool (peça antiga, forja) sai "torto".
const SLOTS_COM_AFIXO = new Set(['weapon', 'head', 'body', 'legs', 'feet', 'shield', 'neck', 'ring', 'backpack']);

/** Os adds que a peça aceita: o pool do tipo dela (sem os que não dropam); sem peça, todos. */
function nativosDe(slot, itemId) {
  if (!itemId || slot === 'backpack') return Object.keys(FICHAS);
  return Gerar.poolDe(itemId).filter((id) => ItensConfig.ATRIBUTOS[id]?.dropa !== false);
}

const sorteio = (lista) => lista[Math.floor(Math.random() * lista.length)];
const arredonda = (ficha, v) => (ficha.tipo === 'flat' ? Math.round(v) : Math.round(v * 10) / 10);

/** Onde o valor cai na régua do afixo, em % (100 = o topo; a vermelha passa). */
export function pctDe(a) {
  const f = FICHAS[a.id];
  if (!f || f.max <= f.min) return 0;
  return Math.round(((a.value - f.min) / (f.max - f.min)) * 100);
}

export const valorNaRegua = (id, pct) => {
  const f = FICHAS[id];
  return arredonda(f, f.min + (Math.max(0, pct) / 100) * (f.max - f.min));
};

const ehTorto = (slot, id, itemId) => !nativosDe(slot, itemId).includes(id);

/** A peça aceita afixo? (equipável, não empilha, de um slot com afixo) */
export function aceitaAfixo(id) {
  const meta = ITEM_CATALOG[id];
  return !!meta && !meta.stackable && SLOTS_COM_AFIXO.has(meta.slot);
}

/**
 * Os atributos de um drop — só a PONTE para o gerador central
 * (`systems/itens/gerar.mjs`), para não existir um segundo sorteio. O combate
 * já chama o gerador direto; isto fica para quem ainda pede só os `af`.
 */
export function rolarDrop(id, { boss = false, level = 1 } = {}) {
  if (!Gerar.aceitaAtributos(id)) return null; // mochila: só pela forja
  return Gerar.gerarItem({ itemId: id, level, boss }).af ?? [];
}

/** O NÍVEL (1–5) de um atributo: o gravado, ou (peça antiga) o da faixa onde o valor cai. */
export const nivelDe = (a) => a?.nivel ?? Gerar.nivelDoValor(a?.id, Number(a?.value) || 0);

/**
 * A cor de um atributo pelo nível: 1 azul (N1–N2), 2 roxa (N3–N4), 3 dourada
 * (N5), 4 vermelha (acima do teto do N5 — a essência vermelha da fusão).
 */
export function corDoAtributo(a) {
  const f = FICHAS[a?.id];
  if (f && Number(a.value) > f.max + 1e-9) return 4;
  const n = nivelDe(a);
  return n >= 5 ? 3 : n >= 3 ? 2 : 1;
}

/** Quantos atributos uma peça desta raridade pode ter (o topo da faixa da raridade). */
export function maxAtributos(raridade) {
  const q = ItensConfig.RARIDADES.raridades[raridade]?.atributos;
  return q ? Math.max(...Object.keys(q).map(Number)) : MAX_AFIXOS;
}

/** Rerroll: outro sorteio SEMPRE acima do pct atual (no topo: outro afixo, em 100%). Só do pool do equipamento. */
export function rerrolar(slot, af, indice, itemId = null) {
  const atual = af[indice];
  const pctAtual = Math.min(100, pctDe(atual));
  const outros = af.filter((_, i) => i !== indice).map((a) => a.id);
  const pool = nativosDe(slot, itemId).filter((id) => FICHAS[id]);
  const livres = pool.filter((id) => !outros.includes(id) && !(pctAtual >= 100 && id === atual.id));
  let id = Math.random() < 0.5 && pctAtual < 100 ? atual.id : sorteio(livres);
  id ??= atual.id;
  const pctSorteado = pctAtual >= 100 ? 100 : pctAtual + 1 + Math.random() * (100 - pctAtual - 1);
  let value = valorNaRegua(id, pctSorteado);
  /*
   * "Sempre acima" tem de valer no NÚMERO, não só no sorteio: numa régua curta
   * (perícia vai de 1 a 3) o arredondamento devolvia o mesmo valor — Shielding
   * +2 (50%) virava Shielding +2 (50%), e o reroll era pago sem mudar nada.
   * Mesmo afixo abaixo do topo: pelo menos um degrau (+1, ou +0,1 no %).
   */
  const f = FICHAS[id];
  if (id === atual.id && pctAtual < 100 && f && value <= atual.value) {
    value = Math.min(f.max, arredonda(f, atual.value + (f.tipo === 'flat' ? 1 : 0.1)));
  }
  return { id, nivel: Gerar.nivelDoValor(id, value), value, rr: (atual.rr ?? 0) + 1 };
}

// ------------------------------------------------------- o que está vestido

/**
 * A soma de cada add que vale: os das peças VESTIDAS mais os da ÁRVORE DE
 * PASSIVAS (os nós "+5 STR", "+2% Crit"... usam as mesmas chaves dos adds de
 * item, e por isso entram aqui — a ficha, os requisitos de item e a
 * comparação leem esta soma e não fazem conta própria). `{atk_flat: 7, str: 12, ...}`.
 */
export function soma(estado) {
  const total = somaDeItens(estado);
  const daArvore = Passivas.efeitos(estado).adds;
  for (const [k, v] of Object.entries(daArvore)) total[k] = (total[k] ?? 0) + v;
  // (13/10) a Égide Necromântica: o escudo vai para os lacaios.
  if (ehEgideComEscudo(estado, total)) passarOEscudoAosLacaios(estado, total);
  // (13/10) a penalidade de movimento da BASE das armaduras (peitorais e escudos: `move_speed_armadura` — `itens-poe/jogo.afDaBase`) entra
  // no movimento, menos com a Arte do Gladiador ("Penalidades de Movimento das Armaduras são Ignoradas").
  if (total.move_speed_armadura) {
    if (!(Number(total.ignora_penalidade_armadura) > 0)) total.move_speed = (total.move_speed ?? 0) + total.move_speed_armadura;
    delete total.move_speed_armadura;
  }
  // (ciclo 7, lote F) "Bônus recebidos da Aljava Equipada aumentado em X%": a aljava (o espaço do escudo) soma X% a mais do que ela dá. (A
  // linha nas PEÇAS já multiplica a aljava no `somaDeItens`; aqui, só a da ÁRVORE.)
  const aljava = estado.equipment?.shield;
  // (o Gladiador / Ascendente: "Ganhe N% de Chance de Bloquear com o Escudo Equipado ao invés do valor do Escudo" — o bloqueio-base do escudo
  // vira N; os "+X% de chance de Bloquear" das outras peças seguem somando.)
  const escudoFixo = Number(daArvore.bloqueio_escudo_fixo) || 0;
  if (itensPoeLigado() && escudoFixo > 0 && aljava?.poe?.classe === 'Shields') total.block = (total.block ?? 0) - (Number(aljava.poe.af?.block) || 0) + escudoFixo;
  const bonusDaArvore = Number(daArvore.bonus_aljava) || 0;
  if (itensPoeLigado() && bonusDaArvore > 0 && aljava?.poe?.classe === 'Quivers') {
    for (const [k0, v] of Object.entries(aljava.poe.af ?? {})) {
      const k = typeof v === 'number' && ModsPoe.ehCondicional(k0) ? ModsPoe.doAnel(k0, 'shield') : k0;
      if (k && typeof v === 'number' && Number.isFinite(v)) total[k] = (total[k] ?? 0) + (v * bonusDaArvore) / 100;
    }
  }
  // + o altar ativado nesta caçada (temporário): mesma chave dos adds de item.
  const altar = efeitosDeAltar(estado);
  if (altar) for (const [k, v] of Object.entries(altar)) total[k] = (total[k] ?? 0) + v;
  // + as cargas do PoE ativas (Tolerância, Frenesi, Poder — `itens-poe/cargas.mjs`, só com ITENS_POE=1).
  const cargas = CargasPoe.adds(estado, total);
  if (cargas) for (const [k, v] of Object.entries(cargas)) total[k] = (total[k] ?? 0) + v;
  // + os frascos de Utilidade do PoE ativos (o efeito da base e o "durante o Efeito" — `itens-poe/frascos.mjs`).
  const frascos = FrascosPoe.adds(estado);
  if (frascos) for (const [k, v] of Object.entries(frascos)) total[k] = (total[k] ?? 0) + v;
  // + os buffs das gemas do PoE ligados (aura, arauto, guarda: armadura, resistências, dano adicionado... — `itens-poe/gemas-poe.mjs`).
  const gemas = GemasPoe.adds(estado);
  if (gemas) for (const [k, v] of Object.entries(gemas)) total[k] = (total[k] ?? 0) + v;
  // Os mods CONDICIONAIS do PoE ("segurando um Escudo", "se você Matou Recentemente"…) e os "por X" (por nível, a cada N de Destreza, por
  // carga…): os que valem agora entram no atributo-base.
  if (!itensPoeLigado()) return total;
  // + o MAPA do endgame em que você está (`itens-poe/mapas.mjs`): o máximo de resistência menor, a recuperação reduzida, menos precisão…
  const doMapa = Mapas.addsNoJogador(estado);
  if (doMapa) for (const [k, v] of Object.entries(doMapa)) total[k] = (total[k] ?? 0) + v;
  const resolvido = ModsPoe.resolver(estado, total, Atributos.principais(estado, total));
  // + as auras "Você e Aliados" (a sua e as dos companheiros perto — a maior de cada) e o "Auras das suas Habilidades concedem…"
  // (`itens-poe/aliados.mjs`): logo depois das condições (a de quem dá já resolvida) e antes dos buffs nomeados (o Vento Favorável é um deles).
  Aliados.aplicar(estado, resolvido);
  // + os BUFFS nomeados do PoE ativos (Agressividade, Adrenalina, Poder Profano… — ganhos por evento ou "sempre" pela peça). DEPOIS das
  // condições: o "sempre" com condição ("Você tem Agonia Perfeita se causou um Golpe Crítico Recentemente" — `sempre:agoniaPerfeita@criticoRecente`)
  // e o "Efeito do Elusivo aumentado por Carga de Poder" (`efeito_buff:elusivo%carga:poder`) só existem depois do `resolver` (antes, o
  // buff condicional ficava ativo sem somar nada). Os buffs não somam nada que as condições leiam (velocidade, dano, defesas).
  const dosBuffs = ModsPoe.adds(estado, resolvido);
  if (dosBuffs) for (const [k, v] of Object.entries(dosBuffs)) resolvido[k] = (resolvido[k] ?? 0) + v;
  // ("Aumentos e reduções à vida máxima de lacaio também se aplicam a você em N% de seu valor", "Aumentos e Reduções ao Dano de Lacaios
  // também afetam você em N%": o "aumentado" dos lacaios entra no seu, na fração.)
  const vidaDosLacaios = (Number(resolvido.lacaio_vida_em_voce) || 0) * (Number(resolvido.minion_life) || 0);
  if (vidaDosLacaios) resolvido.life_inc = (resolvido.life_inc ?? 0) + vidaDosLacaios / 100;
  const danoDosLacaios = (Number(resolvido.lacaio_dano_em_voce) || 0) * (Number(resolvido.minion_dmg) || 0);
  if (danoDosLacaios) resolvido.dmg_inc = (resolvido.dmg_inc ?? 0) + danoDosLacaios / 100;
  // (a keystone Fúria — o Rampage do PoE: +2% de Dano e +1% de Velocidade de Movimento a cada 20 abates seguidos — `mods-poe.contarRampage`;
  // por aqui, e não pela tradução, para duas peças com a keystone não dobrarem os bônus)
  const vinteAbates = Number(resolvido.rampage) > 0 ? ModsPoe.fatorDaEscala(estado, resolvido, null, 'rampage:20') : 0;
  if (vinteAbates) { resolvido.dmg_inc = (resolvido.dmg_inc ?? 0) + 2 * vinteAbates; resolvido.move_speed = (resolvido.move_speed ?? 0) + vinteAbates; }
  // (lote 32, P024 — a Maestria de Armadura e Escudo de Energia: "Aumentos e Reduções à Armadura também se aplicam à Recarga do Escudo de
  // Energia em X% de seu valor" — todo o "aumentado/reduzido" de Armadura que vale agora (das peças, da árvore, as Defesas Globais, os
  // condicionais e os "por X": depois do `resolver`), na fração; antes a escala lia a soma de antes das condições.)
  if (Number(resolvido.armadura_na_recarga_es) > 0 && resolvido.armour_pct) resolvido.es_recharge = (resolvido.es_recharge ?? 0) + (resolvido.armour_pct * resolvido.armadura_na_recarga_es) / 100;
  // ("Aumentos e reduções à sua evasão também se aplicam ao seu dano mágico" — O Olho Aberto: o "aumentado" da evasão entra no Dano Mágico.)
  if (Number(resolvido.evasao_no_dano_magico) > 0 && resolvido.evasion_pct) resolvido.spell_dmg = (resolvido.spell_dmg ?? 0) + (resolvido.evasion_pct * resolvido.evasao_no_dano_magico) / 100;
  // (as Transfigurações — keystones dos únicos: "Aumentos e Reduções ao Escudo de Energia Máximo também são aplicados ao Dano Mágico em 30%
  // de seu valor", "à Vida Máxima … ao Dano de Ataque", "à Mana Máxima … ao Dano")
  const transf = (chave, de) => (Number(resolvido[chave]) || 0) * (Number(resolvido[de]) || 0) / 100;
  if (transf('transf_es_magia', 'es_pct')) resolvido.spell_dmg = (resolvido.spell_dmg ?? 0) + transf('transf_es_magia', 'es_pct');
  if (transf('transf_vida_ataque', 'life_inc')) resolvido['dmg_inc@ataque'] = (resolvido['dmg_inc@ataque'] ?? 0) + transf('transf_vida_ataque', 'life_inc');
  if (transf('transf_mana_dano', 'mana_inc')) resolvido.dmg_inc = (resolvido.dmg_inc ?? 0) + transf('transf_mana_dano', 'mana_inc');
  // + as MALDIÇÕES dos monstros em você (Fraqueza Elemental, Vulnerabilidade, Enfraquecer; as refletidas): depois das condições, porque a
  // imunidade e o efeito delas podem ser condicionais ("Imune a Maldições enquanto possuir ao menos N de Fúria").
  const malditas = ModsPoe.addsDasMaldicoesNoJogador(estado, resolvido);
  if (malditas) for (const [k, v] of Object.entries(malditas)) resolvido[k] = (resolvido[k] ?? 0) + v;
  // + o que os MONSTROS do PoE puseram em você ao acertar (a Cegueira, a Mutilação, a Exposição, a Eletrização do crítico —
  // `itens-poe/monstros-no-jogador.mjs`).
  const dosMonstros = addsDosDebuffsNoJogador(estado);
  if (dosMonstros) for (const [k, v] of Object.entries(dosMonstros)) resolvido[k] = (resolvido[k] ?? 0) + v;
  // + os VÍNCULOS (`itens-poe/vinculos.mjs`): o que o Vínculo de um companheiro dá em você e o que os seus dão a quem vincula. ("igual a sua"
  // — o bloqueio e o crítico do dono — vale o maior, não soma.)
  const dosVinculos = addsDosVinculos(estado);
  if (dosVinculos) for (const [k, v] of Object.entries(dosVinculos)) resolvido[k] = /_igual_/.test(k) || k === 'velocidade_igual_vinculado' ? Math.max(resolvido[k] ?? 0, v) : (resolvido[k] ?? 0) + v;
  // + as PROTEÇÕES DE AÇO do Aço Estraçalhador da Munição ("+8% de Chance de Bloquear o Dano de Ataques de Projéteis" cada —
  // `itens-poe/convocar-o-aco.mjs`).
  const doAco = addsDoAco(estado?.hunt);
  if (doAco) for (const [k, v] of Object.entries(doAco)) resolvido[k] = (resolvido[k] ?? 0) + v;
  return resolvido;
}

/** Só os adds das peças VESTIDAS (a parte de `soma` que vem do equipamento; a ficha mostra a origem por categoria). */
export function somaDeItens(estado) {
  const total = {};
  // (PoE, os únicos: "Bônus recebidos da Aljava Equipada aumentado em X%" — os números da ALJAVA vestida × (1 + X%).)
  const daAljava = 1 + Object.entries(estado.equipment ?? {}).reduce((n, [slot, p]) => n + (slot !== 'backpack' ? Number(p?.poe?.af?.bonus_aljava) || 0 : 0), 0) / 100;
  for (const [slot, peca] of Object.entries(estado.equipment ?? {})) {
    if (!peca || slot === 'backpack') continue;
    somarPeca(total, estado, slot, peca, daAljava !== 1 && peca.poe?.classe === 'Quivers' ? daAljava : 1);
  }
  // (15/10, lote 27) as JOIAS nos encaixes alocados da árvore do PoE: os mods delas somam como os de uma peça.
  for (const { peca } of Passivas.joiasAtivas(estado)) somarPeca(total, estado, 'joia', peca);
  return total;
}
/** Soma UMA peça vestida em `total` (a do Draevor e a do PoE — `poe.af`, com as condições da própria peça e do lado do anel). */
function somarPeca(total, estado, slot, peca, fatorDaPeca = 1) {
  for (const a of peca.af ?? []) if (FICHAS[a.id]) total[a.id] = (total[a.id] ?? 0) + Number(a.value || 0);
  // A peça no modelo do PoE (sistema de itens do PoE, Fase 1 — só existe com ITENS_POE=1): os mods já traduzidos para os atributos do
  // Draevor e os atributos NOVOS (`itens-poe/atributos-novos.json`), em `peca.poe.af`. Peça comum não tem `poe`: nada muda para ela.
  for (const [k0, v0] of Object.entries(peca.poe?.af ?? {})) {
    if (typeof v0 !== 'number' || !Number.isFinite(v0)) continue;
    // "Espaço esquerdo/direito de anel: …": vale só no anel daquele lado (`ring` = esquerdo, `ring2` = direito). E a escala da própria
    // peça ("por Encaixe Vermelho" do Punho da Tríade — `daPeca`).
    const [k1, v] = ModsPoe.ehCondicional(k0) ? ModsPoe.daPeca(k0, v0, peca, estado) : [k0, v0];
    const k = ModsPoe.ehCondicional(k1) ? ModsPoe.doAnel(k1, slot) : k1;
    if (k) total[k] = (total[k] ?? 0) + v * fatorDaPeca;
  }
  // (15/10, lote 28) as JOIAS ABISSAIS encaixadas nos encaixes abissais da peça: somam como peças, × o "Efeito das Joias Abissais
  // Encaixadas" da própria peça (o Torno Estígio único).
  const abissais = peca.poe?.abissais;
  if (abissais?.length) {
    const efeito = 1 + (Number(peca.poe.af?.efeito_joias_abissais) || 0) / 100;
    for (const joia of abissais) if (joia) somarPeca(total, estado, slot, joia, efeito);
  }
  return total;
}
/**
 * (13/10) A ÉGIDE NECROMÂNTICA (keystone do PoE): "Todos os bônus do Escudo equipado se aplicam aos seus Lacaios e não a você". O que o
 * escudo dá vira o atributo do LACAIO (o que o lacaio do jogo tem: bloqueio, resistências, vida %, dano, velocidades, crítico, regeneração,
 * movimento, dreno — `LacaiosPoe.oQueInvoca` lê do dono); o resto sai de você sem ir a ninguém. A defesa da base do escudo também sai de você
 * (`Ficha.defesasDaFicha`). Muda `total`.
 */
const DO_ESCUDO_PARA_O_LACAIO = {
  block: 'minion_block', spell_block: 'minion_spell_block', fire_res: 'minion_fire_res', ice_res: 'minion_ice_res', energy_res: 'minion_energy_res',
  chaos_res: 'minion_chaos_res', life_inc: 'minion_life', dmg_inc: 'minion_dmg', atk_speed: 'minion_atk_speed', cast_speed: 'minion_cast_speed',
  crit_chance_inc: 'minion_crit_inc', crit_dmg: 'minion_crit_mult', move_speed: 'minion_move', life_regen: 'minion_regen', life_regen_max_pct: 'minion_regen_pct',
  life_leech: 'minion_leech', move_speed_armadura: 'minion_move',
  // (lote 43, P040) a vida fixa, a redução física adicional e a supressão de magia também vão aos lacaios (as defesas: `passarOEscudoAosLacaios`)
  life: 'minion_vida_fixa', phys_res: 'minion_phys_red', spell_suppression: 'minion_supressao',
  // (+ o bloqueio aumentado, o dano mágico e o crítico mágico — no lacaio que conjura —, o dano de cada elemento — no lacaio daquele elemento
  // —, o evitar afecções elementais, o reflexo físico corpo a corpo e o início da recarga do escudo de energia)
  block_inc: 'minion_block_inc', spell_dmg: 'minion_dano_magico', spell_crit_chance_inc: 'minion_crit_magico', fire_dmg: 'minion_dano_fire',
  ice_dmg: 'minion_dano_ice', energy_dmg: 'minion_dano_energy', avoid_elem_ailments: 'minion_evitar_afeccoes', reflect_phys_melee: 'minion_reflexo_fisico',
  es_recharge_start: 'minion_es_recarga_inicio',
};
export const ehEgideComEscudo = (estado, total) => itensPoeLigado() && Number(total?.egide_necromantica) > 0 && estado?.equipment?.shield?.poe?.classe === 'Shields';

/**
 * (13/10) As PEÇAS DE ARMADURA do PoE (os "Itens de Proteção": peitoral, elmo, luvas, botas e escudo — a aljava não) e A APÓSTATA (o nó da
 * Caçadora de Relíquias e o único O Apóstata: "Ganhe Vida Máxima ao invés de Escudo de Energia Máximo dos Itens de Proteção Equipados"): o
 * Escudo de Energia da base de cada uma (com os locais e a qualidade — `faixaDoCampo`, a média da faixa) vira VIDA fixa, que os aumentos de
 * Vida aumentam (`sincronizarMaximos`), e sai do Escudo (`Ficha.defesasDaFicha`). O escudo da Égide Necromântica não conta (vai aos lacaios).
 * `vidaDasArmaduras`: a Vida que isso dá agora (0 sem a linha). (As classes: as da aba "Armaduras" do filtro — `CLASSES_DE_ARMADURA`.)
 */
export const ehPecaDeArmadura = (p) => CLASSES_DE_ARMADURA.has(p?.poe?.classe);
export const esDasArmadurasEmVida = (af) => itensPoeLigado() && Number(af?.es_das_armaduras_em_vida) > 0;
export function vidaDasArmaduras(estado, total) {
  if (!esDasArmadurasEmVida(total)) return 0;
  const semEscudo = ehEgideComEscudo(estado, total) ? estado.equipment.shield : null;
  return Math.round(Object.entries(estado?.equipment ?? {}).reduce((n, [slot, p]) => {
    if (slot === 'backpack' || !ehPecaDeArmadura(p) || p === semEscudo) return n;
    const [a, b] = faixaDoCampo(p, 'es');
    return n + (a + b) / 2;
  }, 0));
}
function passarOEscudoAosLacaios(estado, total) {
  const escudo = estado.equipment.shield;
  const doEscudo = somarPeca({}, estado, 'shield', escudo);
  for (const [k, v] of Object.entries(doEscudo)) {
    total[k] = (total[k] ?? 0) - v;
    const doLacaio = DO_ESCUDO_PARA_O_LACAIO[k];
    if (doLacaio) total[doLacaio] = (total[doLacaio] ?? 0) + v;
  }
  // (lote 43, P040 — dono, 16/10: "Fazer todos") as DEFESAS do escudo nos lacaios: a da base dele (a armadura, a evasão e o escudo de energia —
  // `faixaDoCampo`, a média) com o "+X" e o "aumentada em X%" do PRÓPRIO escudo (os seus outros aumentos são seus) — `LacaiosPoe.danoNoLacaio`.
  const base = (campo) => { const [a, b] = faixaDoCampo(escudo, campo); return (a + b) / 2; };
  const comPct = (campo, fixo, pct) => (base(campo) + (Number(doEscudo[fixo]) || 0)) * Math.max(0, 1 + ((Number(doEscudo[pct]) || 0) + (Number(doEscudo.defesas_pct_escudo) || 0)) / 100);
  const armadura = comPct('armor', 'armor_flat', 'armour_pct');
  const evasao = comPct('evasion', 'evasion', 'evasion_pct');
  const es = comPct('es', 'energy_shield', 'es_pct');
  if (armadura > 0) total.minion_armadura = (total.minion_armadura ?? 0) + armadura;
  if (evasao > 0) total.minion_evasao = (total.minion_evasao ?? 0) + evasao;
  if (es > 0) total.minion_es = (total.minion_es ?? 0) + es;
}

/** O relógio da sala (o do anfitrião, se for convidado): é nele que contam os efeitos de altar. */
export const relogioDaSala = (hunt) => (hunt?.anfitriao ?? hunt)?.clock ?? 0;

/**
 * Os efeitos TEMPORÁRIOS de altar (`estado.hunt.efeitosDeAltar`, ver `encontros/altares.mjs`) vigentes agora: a soma por
 * afixo, limitada a 2× o teto do afixo numa peça (altares empilhados não passam disso). `null`: nenhum.
 */
export function efeitosDeAltar(estado) {
  const h = estado?.hunt;
  if (!h?.efeitosDeAltar?.length) return null;
  const agora = relogioDaSala(h);
  const total = {};
  // (× o "Efeito dos Buffs de Altares em você aumentado" dos únicos do PoE.)
  const efeito = 1 + Object.values(estado.equipment ?? {}).reduce((n, p) => n + (Number(p?.poe?.af?.efeito_altar) || 0), 0) / 100;
  for (const e of h.efeitosDeAltar) if (e.ate > agora && FICHAS[e.afixo]) total[e.afixo] = (total[e.afixo] ?? 0) + e.valor * efeito;
  for (const [id, v] of Object.entries(total)) {
    const teto = FICHAS[id].max * 2;
    total[id] = Math.max(-teto, Math.min(teto, v));
  }
  return Object.keys(total).length ? total : null;
}

/** O que vale agora de um afixo (0 se não tem). Cache por tique fica para depois. */
export const de = (estado, id) => soma(estado)[id] ?? 0;

// ------------------------------------------------------------ a tela

export function viewDoAfixo(a, slot, itemId = null) {
  const f = FICHAS[a.id] ?? { nome: a.id, tipo: 'pct', min: 0, max: 1 };
  const rr = a.rr ?? 0;
  return {
    id: a.id,
    nome: f.nome,
    tipo: f.tipo,
    valor: a.value,
    // "Nível do Atributo" (1–5). `tier` fica igual, para a tela de antes da atualização.
    nivel: nivelDe(a),
    tier: nivelDe(a),
    pct: pctDe(a),
    min: f.min,
    max: f.max,
    torto: slot ? ehTorto(slot, a.id, itemId) : false,
    rerrolls: rr,
    texto: f.proporcaoDoMaximo ? `${f.nome} ${a.value}–${Math.round(a.value * f.proporcaoDoMaximo)}` : `${f.nome} +${a.value}${f.tipo === 'pct' ? '%' : ''}`,
  };
}

// ------------------------------------------- guardar na venda automática

/** A cor da peça: a do melhor afixo (1 azul, 2 roxa, 3 dourada, 4 vermelha). */
export function corDaPeca(p) {
  let q = 0;
  for (const a of p.af ?? []) q = Math.max(q, corDoAtributo(a));
  return q;
}

/**
 * O filtro de loot pelo ATRIBUTO, no sistema de itens: `{nivel, quantos}` =
 * guardar a peça com pelo menos `quantos` atributos de nível `nivel` ou mais
 * (`nivel` 0 = o atributo não segura nada). Quem gravou as regras de antes (a
 * cor da estrela em 3 degraus e a contagem até 3) é traduzido: "qualquer"
 * vira N1+, "roxa para cima" N3+, "só a dourada" N5.
 */
export function regraDoAtributo(s = {}) {
  const nivel = s.guardarNivel != null ? Number(s.guardarNivel) : ({ 0: 0, 1: 1, 2: 3, 3: 5 }[Number(s.guardarAfixo ?? 1)] ?? 1);
  const quantos = s.guardarQuantos != null ? Number(s.guardarQuantos) : Math.max(1, Number(s.guardarEstrelas ?? 0));
  return { nivel: Math.max(0, Math.min(5, nivel || 0)), quantos: Math.max(1, Math.min(6, quantos || 1)) };
}

/**
 * A venda automática GUARDA esta peça? Tier, imbuement e essência nunca
 * vendem. Fora isso, as regras LIGADAS do filtro valem JUNTAS (a peça passa em
 * todas): `guardarRaridade` (0 não olha, 1 incomum para cima ... 5 só mítico)
 * e o atributo (`regraDoAtributo`, com `itemRules.soAfixo` = só nestes itens).
 * Nenhuma ligada: vende.
 */
/*
 * ---- O FILTRO DE LOOT: uma decisão só, na ordem do dono (30/09) ----
 *
 *   1. NÃO COLETAR (lista por item)         → fica no chão
 *   2. NÃO VENDER (lista por item)          → fica na bolsa
 *   3. valor próprio: tier, imbuement, essência, gema encaixada → fica
 *   4. REGRAS ESPECÍFICAS (`estado.lootRegras`, na ordem da lista: a PRIMEIRA
 *      que bate decide — "não vender" ou "não coletar")
 *   5. ATRIBUTOS DO ITEM (quantidade + nível mínimo; "Afixo só nestes" limita onde vale)
 *   6. SOCKETS (abertos / ligados)
 *   7. RARIDADE
 *   8. padrão: vende
 * 5, 6 e 7 valem com OU: a peça comum com atributo bom fica mesmo com a
 * raridade ligada em "raro para cima" — a raridade não decide sozinha quando
 * há regra de atributo. Uma regra de cima nunca é desfeita por uma de baixo.
 *
 * Os atributos são os REAIS da peça depois do drop (`p.af`), conferidos contra
 * o catálogo de atributos: id desconhecido, valor 0, nulo ou inválido não conta.
 * Genérico: um atributo novo no catálogo entra sozinho.
 */
export const ACOES_DO_FILTRO = ['naoVender', 'naoColetar'];

/** Os atributos que valem de verdade nesta peça. */
export function atributosReais(p) {
  return (Array.isArray(p?.af) ? p.af : []).filter((a) => {
    if (!a || !FICHAS[a.id]) return false;
    const v = Number(a.value);
    return Number.isFinite(v) && v !== 0;
  });
}

/** O nível (1–5) de um atributo; acima do teto (a cor "mítica") conta como 5. */
export const nivelDoAtributo = (a) => (corDoAtributo(a) === 4 ? 5 : Math.max(1, Math.min(5, nivelDe(a) || 1)));

/**
 * A regra da seção "Atributos do item": `{ quantos, nivel }` — `quantos` 0 = não
 * considerar; `nivel` 1 = qualquer, 2..5 = pelo menos UM atributo desse nível.
 * Sem as chaves novas, traduz as de antes (`guardarNivel`/`guardarQuantos`).
 */
export function regraDeAtributos(s = {}) {
  if (s.guardarAtributos != null || s.guardarNivelMinimo != null) {
    const quantos = Math.max(0, Math.min(6, Math.round(Number(s.guardarAtributos ?? 1)) || 0));
    const nivel = Math.max(1, Math.min(5, Math.round(Number(s.guardarNivelMinimo ?? 1)) || 1));
    return { quantos, nivel };
  }
  const antiga = regraDoAtributo(s);
  return antiga.nivel ? { quantos: antiga.quantos, nivel: antiga.nivel } : { quantos: 0, nivel: 1 };
}

/** A peça passa em "pelo menos `quantos` atributos e (se `nivel` > 1) um deles N`nivel`+"? */
export function passaAtributos(p, { quantos = 0, nivel = 1 } = {}) {
  const reais = atributosReais(p);
  if (reais.length < quantos) return false;
  return nivel <= 1 || reais.some((a) => nivelDoAtributo(a) >= nivel);
}

const indiceDaRaridade = (p) => RARIDADES.indexOf(raridadeDaPeca(p));

/**
 * Uma regra específica bate nesta peça? `{ raridade, acima, quantos, nivel, acao }`:
 * `raridade` null = qualquer; `acima` = "ou acima"; `quantos` null = qualquer
 * quantidade, 0 = SEM atributo, n = n ou mais; `nivel` 1 = qualquer.
 * Só vale para peça que aceita atributo (equipamento) — poção e produto de bicho não.
 */
export function regraBate(r, p) {
  if (!aceitaAfixo(p?.id)) return false;
  if (r.raridade) {
    const alvo = RARIDADES.indexOf(r.raridade);
    const tem = indiceDaRaridade(p);
    if (r.acima ? tem < alvo : tem !== alvo) return false;
  }
  const reais = atributosReais(p);
  if (r.quantos === 0) {
    if (reais.length) return false;
  } else if (r.quantos != null && reais.length < r.quantos) return false;
  if ((r.nivel ?? 1) > 1 && !reais.some((a) => nivelDoAtributo(a) >= r.nivel)) return false;
  return true;
}

/** Uma regra específica, limpa (o que o cliente manda). `null` se não serve. */
export function sanearRegraDeLoot(r) {
  if (!r || typeof r !== 'object') return null;
  const raridade = RARIDADES.includes(r.raridade) ? r.raridade : null;
  const quantos = r.quantos == null || r.quantos === '' ? null : Math.max(0, Math.min(6, Math.round(Number(r.quantos)) || 0));
  return {
    raridade,
    acima: !!raridade && r.acima === true,
    quantos,
    nivel: Math.max(1, Math.min(5, Math.round(Number(r.nivel ?? 1)) || 1)),
    acao: ACOES_DO_FILTRO.includes(r.acao) ? r.acao : 'naoVender',
    ativa: r.ativa !== false,
  };
}

/**
 * A decisão do filtro para esta peça: `{ acao: 'naoColetar'|'naoVender'|'vender', motivo }`.
 * `motivo` diz QUAL regra decidiu (a tela mostra).
 */
export function decisaoDoLoot(estado, p) {
  const rules = estado?.itemRules ?? {};
  const s = estado?.settings ?? {};
  const id = Number(p?.id);
  if ((rules.noLoot ?? []).includes(id)) return { acao: 'naoColetar', motivo: 'lista "Não coletar"' };
  if ((rules.noSell ?? []).includes(id)) return { acao: 'naoVender', motivo: 'lista "Não vender"' };
  if (p?.tier || p?.imbu?.length) return { acao: 'naoVender', motivo: 'tier ou imbuement' };
  if (id === ID_DA_ESSENCIA) return { acao: 'naoVender', motivo: 'essência' };
  // Peça com GEMA encaixada nunca vai para o NPC (a gema iria junto).
  if (p?.soquetes?.gemas?.some(Boolean)) return { acao: 'naoVender', motivo: 'gema encaixada' };
  // Peça do PoE (modo PoE): as regras do PoE (raridade Normal/Mágico/Raro/Único, mods e tiers, Item Level, sockets, classe).
  if (itensPoeLigado() && p?.poe) return decisaoDoLootPoe(estado, p);
  const regras = (estado?.lootRegras ?? []).filter((r) => r?.ativa !== false && !r.poe);
  for (const [i, r] of regras.entries()) {
    if (regraBate(r, p)) return { acao: r.acao === 'naoColetar' ? 'naoColetar' : 'naoVender', motivo: `regra específica ${i + 1}` };
  }
  // "Afixo só nestes": fora da lista a seção de atributos não entra na conta.
  const soEm = rules.soAfixo ?? [];
  const atr = regraDeAtributos(s);
  if (atr.quantos > 0 && (!soEm.length || soEm.includes(id)) && passaAtributos(p, atr)) return { acao: 'naoVender', motivo: 'atributos do item' };
  // SOCKETS: a peça com os sockets pedidos fica (uma 4-ligada vale por si).
  if (guardaPelosSockets(s, p)) return { acao: 'naoVender', motivo: 'sockets' };
  const piso = Number(s.guardarRaridade ?? 0);
  if (piso > 0 && indiceDaRaridade(p) >= piso) return { acao: 'naoVender', motivo: 'raridade' };
  return { acao: 'vender', motivo: 'nenhuma regra segura' };
}

// ------------------------------------------- o filtro de loot do PoE (só com ITENS_POE=1)
/*
 * As peças do PoE têm o que um filtro de loot do PoE olha: a RARIDADE (Normal, Mágico, Raro, Único), a CLASSE (Anel, Botas…), o ITEM
 * LEVEL, os MODS explícitos (prefixos e sufixos) com o TIER de cada um (T1 é o melhor, como no PoE) e os SOCKETS (até 6, os ligados e as
 * cores — o R-G-B ligado do Cromático). As seções guardam com OU (basta uma segurar); as regras específicas juntam tudo com E e a
 * primeira que bate decide, antes das seções. As listas "Não coletar"/"Não vender" continuam por base (o id é a base do PoE).
 */
export const RARIDADES_POE = ['normal', 'magico', 'raro', 'unico'];
const indiceDaRaridadePoe = (p) => Math.max(0, RARIDADES_POE.indexOf(p?.poe?.raridade));
/** Os mods explícitos (prefixos e sufixos) da peça do PoE. */
const modsExplicitos = (p) => [...(p?.poe?.prefixos ?? []), ...(p?.poe?.sufixos ?? [])];
/** O melhor tier (o menor número) entre os mods explícitos; null sem mods com tier. */
export function melhorTierPoe(p) {
  const tiers = modsExplicitos(p).map((m) => Number(m.tier)).filter((n) => n > 0);
  return tiers.length ? Math.min(...tiers) : null;
}
/** Os sockets da peça e se há um grupo LIGADO com as três cores (R, G e B — o Cromático do PoE). */
export function socketsPoe(p) {
  const so = p?.soquetes;
  const { abertos, ligados } = socketsDaPeca(p);
  const rgb = !!so?.abertos && gruposLigados(so).some((g) => ['R', 'G', 'B'].every((c) => g.some((i) => so.cores?.[i] === c)));
  return { abertos, ligados, rgb };
}
/** As seções do filtro do PoE (as chaves de `settings`). Sem nada escolhido, o filtro pega tudo (como o filtro padrão do PoE). */
export function regraDasSecoesPoe(s = {}) {
  const n = (k, max, padrao = 0) => Math.max(0, Math.min(max, Math.round(Number(s[k] ?? padrao)) || 0));
  return {
    raridade: n('guardarRaridadePoe', 3),
    mods: n('guardarModsPoe', 6),
    tier: n('guardarTierPoe', 5),
    ilvl: n('guardarIlvlPoe', 100),
    abertos: n('guardarSockets', 6),
    ligados: n('guardarLigados', 6),
    rgb: s.guardarRgbPoe === true,
  };
}
/*
 * ---- As ABAS do filtro do PoE por TIPO de item (dono, 10/10: "quero que no loot filter trate abas de tipos de itens para selecionar
 * outros tipos, raridades diferentes") ----
 * A raridade da seção (`guardarRaridadePoe`) é a GERAL: vale para todo equipamento e, desde 10/10, para os FRASCOS ("mudar só para
 * frascos" — as moedas e os mapas seguem vindo sempre). Cada aba troca a raridade só daquele tipo (`guardarRaridadePoe<Tipo>`): sem
 * escolha (null), igual à geral; 0 = a raridade não decide nada para o tipo; 1–3 = Mágico/Raro/Único para cima.
 */
export const TIPOS_DO_FILTRO_POE = ['armas', 'armaduras', 'acessorios', 'frascos'];
export const CHAVE_DA_RARIDADE_DO_TIPO = Object.freeze({ armas: 'guardarRaridadePoeArmas', armaduras: 'guardarRaridadePoeArmaduras', acessorios: 'guardarRaridadePoeAcessorios', frascos: 'guardarRaridadePoeFrascos' });
const CLASSES_DE_ARMADURA = new Set(['Body_Armours', 'Helmets', 'Boots', 'Gloves', 'Shields']);
const CLASSES_DE_ACESSORIO = new Set(['Rings', 'Amulets', 'Belts']);
const CLASSES_DE_ARMA = new Set(['One_Hand_Swords', 'Thrusting_One_Hand_Swords', 'Two_Hand_Swords', 'One_Hand_Axes', 'Two_Hand_Axes', 'One_Hand_Maces', 'Two_Hand_Maces', 'Sceptres', 'Staves', 'Warstaves', 'Claws', 'Daggers', 'Rune_Daggers', 'Bows', 'Wands', 'Quivers']);
/** O tipo da peça do PoE para as abas do filtro ('armas' | 'armaduras' | 'acessorios' | 'frascos'), ou null (o resto: só a geral). */
export function tipoDoFiltroPoe(p) {
  if (FrascosPoe.ehFrasco(p)) return 'frascos';
  const classe = p?.poe?.classe;
  if (CLASSES_DE_ARMA.has(classe)) return 'armas';
  if (CLASSES_DE_ARMADURA.has(classe)) return 'armaduras';
  if (CLASSES_DE_ACESSORIO.has(classe)) return 'acessorios';
  return null;
}
/** A raridade escolhida na aba do tipo (0–3), ou null (igual à geral). */
export function raridadeDoTipoPoe(s = {}, tipo) {
  const v = tipo ? s[CHAVE_DA_RARIDADE_DO_TIPO[tipo]] : null;
  return v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.min(3, Math.round(Number(v))));
}

/** A peça passa em "pelo menos `mods` mods e (com `tier`) um deles T`tier` ou melhor"? */
function passaModsPoe(p, mods, tier) {
  const lista = modsExplicitos(p);
  if (lista.length < mods) return false;
  if (!tier) return true;
  const melhor = melhorTierPoe(p);
  return melhor != null && melhor <= tier;
}
/** Uma regra específica do PoE bate nesta peça? `{ poe: true, raridade, acima, classe, quantos, tier, ilvl, ligados, acao }`. */
export function regraPoeBate(r, p) {
  if (!p?.poe) return false;
  if (r.raridade) {
    const alvo = RARIDADES_POE.indexOf(r.raridade);
    const tem = indiceDaRaridadePoe(p);
    if (r.acima ? tem < alvo : tem !== alvo) return false;
  }
  if (r.classe && p.poe.classe !== r.classe) return false;
  const mods = modsExplicitos(p);
  if (r.quantos === 0) {
    if (mods.length) return false;
  } else if (r.quantos != null && mods.length < r.quantos) return false;
  if (r.tier && !(melhorTierPoe(p) != null && melhorTierPoe(p) <= r.tier)) return false;
  if (r.ilvl && (Number(p.poe.ilvl) || 0) < r.ilvl) return false;
  if (r.ligados && socketsPoe(p).ligados < r.ligados) return false;
  return true;
}
/** Uma regra específica do PoE, limpa (o que o cliente manda). */
export function sanearRegraDeLootPoe(r) {
  if (!r || typeof r !== 'object') return null;
  const raridade = RARIDADES_POE.includes(r.raridade) ? r.raridade : null;
  const inteiro = (v, max) => (v == null || v === '' ? null : Math.max(0, Math.min(max, Math.round(Number(v)) || 0)));
  return {
    poe: true,
    raridade,
    acima: !!raridade && r.acima === true,
    classe: typeof r.classe === 'string' && /^[A-Z][A-Za-z_]{1,40}$/.test(r.classe) ? r.classe : null,
    quantos: inteiro(r.quantos, 6),
    tier: inteiro(r.tier, 5) || 0,
    ilvl: inteiro(r.ilvl, 100) || 0,
    ligados: inteiro(r.ligados, 6) || 0,
    acao: ACOES_DO_FILTRO.includes(r.acao) ? r.acao : 'naoVender',
    ativa: r.ativa !== false,
  };
}
/*
 * A decisão do filtro para uma peça do PoE (as listas e a gema encaixada já passaram em `decisaoDoLoot`): a COLETA, como o filtro de
 * loot do PoE — dono, 08/10: "o filtro de loot não está funcionando, está pegando itens mesmo setando as coisas" e "só dá para limpar,
 * vender não pode". As peças do PoE não têm preço no NPC: a "venda automática" que as seções decidiam nunca vendia nada, e tudo ficava
 * na bolsa. Agora: `naoVender` = pega (a bolsa recebe), `naoColetar` = fica no chão (`Bolsa.ignora`). Sem seção nenhuma escolhida, pega
 * tudo; com alguma, só o que ela pega (as seções com OU). O Único sempre é pego, a não ser que uma regra específica diga o contrário.
 *
 * FRASCO e MOEDA (dono, 08/10: "frascos e moedas têm raridade, mas no loot filter não era para ser considerado"): as seções e as regras são
 * para escolher EQUIPAMENTO. A moeda nem chega aqui: o drop dela passa só pela lista (`Bolsa.ignora` sem a peça). O FRASCO, desde 10/10
 * (dono: "mudar só para frascos"), segue a RARIDADE — a da aba Frascos ou, sem ela, a geral (com "Só Único", o frasco Normal fica no chão);
 * as outras seções (mods, sockets, Item Level) continuam sem valer para ele, e a regra específica da CLASSE dele decide antes.
 */
export function decisaoDoLootPoe(estado, p) {
  const frasco = FrascosPoe.ehFrasco(p);
  // O MAPA do endgame é como o frasco: só uma regra específica da classe Mapas o deixa no chão (as seções de mods/raridade/item level são
  // das peças de equipar — sem isto, com qualquer seção ligada, o mapa Normal sumia), e nunca vai para o NPC.
  const mapa = Mapas.ehMapa(p);
  const regras = (estado?.lootRegras ?? []).filter((r) => r?.ativa !== false && r.poe && (!(frasco || mapa) || r.classe === p.poe.classe));
  for (const [i, r] of regras.entries()) {
    if (regraPoeBate(r, p)) return { acao: r.acao === 'naoColetar' ? 'naoColetar' : 'naoVender', motivo: `regra específica ${i + 1}` };
  }
  // A raridade que vale para esta peça: a da aba do tipo dela, ou a geral.
  const settings = estado?.settings ?? {};
  const s = regraDasSecoesPoe(settings);
  const doTipo = raridadeDoTipoPoe(settings, tipoDoFiltroPoe(p));
  if (doTipo != null) s.raridade = doTipo;
  if (frasco) {
    if (s.raridade && indiceDaRaridadePoe(p) < s.raridade) return { acao: 'naoColetar', motivo: 'raridade do frasco' };
    return { acao: 'naoVender', motivo: s.raridade ? 'frasco (raridade)' : 'frasco (sempre)' };
  }
  if (mapa) return { acao: 'naoVender', motivo: 'mapa (sempre)' };
  if (p.poe.raridade === 'unico') return { acao: 'naoVender', motivo: 'Único (sempre)' };
  const algumaSecao = s.mods > 0 || s.tier > 0 || s.abertos > 0 || s.ligados > 1 || s.rgb || s.ilvl > 0 || s.raridade > 0;
  if (!algumaSecao) return { acao: 'naoVender', motivo: 'sem filtro: pega tudo' };
  if (s.mods > 0 && passaModsPoe(p, s.mods, s.tier)) return { acao: 'naoVender', motivo: 'mods da peça' };
  if (!s.mods && s.tier && passaModsPoe(p, 1, s.tier)) return { acao: 'naoVender', motivo: 'tier dos mods' };
  const so = socketsPoe(p);
  if ((s.abertos && so.abertos >= s.abertos) || (s.ligados > 1 && so.ligados >= s.ligados) || (s.rgb && so.rgb)) return { acao: 'naoVender', motivo: 'sockets' };
  if (s.ilvl && (Number(p.poe.ilvl) || 0) >= s.ilvl) return { acao: 'naoVender', motivo: 'item level' };
  if (s.raridade && indiceDaRaridadePoe(p) >= s.raridade) return { acao: 'naoVender', motivo: 'raridade' };
  return { acao: 'naoColetar', motivo: 'nenhuma seção pega — fica no chão' };
}
/** A prévia do filtro do PoE: peças de exemplo pela MESMA decisão. */
const EXEMPLOS_DO_FILTRO_POE = [
  { rotulo: 'Normal, sem mods, 1 socket', raridade: 'normal', tiers: [], ilvl: 40, abertos: 1 },
  { rotulo: 'Normal, ilvl 84, 6 sockets (5 ligados)', raridade: 'normal', tiers: [], ilvl: 84, abertos: 6, ligados: 5 },
  { rotulo: 'Normal, 3 sockets R-G-B ligados', raridade: 'normal', tiers: [], ilvl: 30, abertos: 3, ligados: 3, cores: ['R', 'G', 'B'] },
  { rotulo: 'Mágico, 2 mods (T6 e T7)', raridade: 'magico', tiers: [6, 7], ilvl: 40, abertos: 2 },
  { rotulo: 'Raro, 4 mods (melhor T4)', raridade: 'raro', tiers: [4, 5, 6, 7], ilvl: 60, abertos: 3 },
  { rotulo: 'Raro, 6 mods com um T1', raridade: 'raro', tiers: [1, 3, 4, 5, 6, 7], ilvl: 84, abertos: 4 },
  { rotulo: 'Único', raridade: 'unico', tiers: [], ilvl: 70, abertos: 2 },
  { rotulo: 'Frasco de Vida Mágico', raridade: 'magico', tiers: [7], ilvl: 40, abertos: 0, classe: 'Life_Flasks' },
  // (As abas por tipo: uma arma e um acessório — os de cima, sem classe, são armaduras.)
  { rotulo: 'Arma: Machado Raro, 3 mods', raridade: 'raro', tiers: [5, 6, 7], ilvl: 50, abertos: 3, classe: 'Two_Hand_Axes' },
  { rotulo: 'Acessório: Anel Mágico, 1 mod', raridade: 'magico', tiers: [6], ilvl: 40, abertos: 0, classe: 'Rings' },
];
function previaDoFiltroPoe(estado) {
  const base = { ...estado, itemRules: { ...(estado.itemRules ?? {}), noLoot: [], noSell: [] } };
  return EXEMPLOS_DO_FILTRO_POE.map((x) => {
    const lig = x.ligados ?? 1;
    const p = {
      id: 0, count: 1,
      soquetes: { abertos: x.abertos, links: Array.from({ length: Math.max(0, x.abertos - 1) }, (_, i) => i < lig - 1), gemas: [], cores: x.cores ?? Array(x.abertos).fill('R') },
      poe: { raridade: x.raridade, classe: x.classe ?? 'Body_Armours', ilvl: x.ilvl, prefixos: x.tiers.slice(0, 3).map((tier) => ({ tier })), sufixos: x.tiers.slice(3).map((tier) => ({ tier })) },
    };
    return { rotulo: x.rotulo, ...decisaoDoLootPoe(base, p) };
  });
}

/** A venda automática guarda esta peça? (tudo que não é "vender") */
export const guarda = (estado, p) => decisaoDoLoot(estado, p).acao !== 'vender';

/*
 * A PRÉVIA do filtro (a tela mostra "com a sua configuração, isto acontece"):
 * a decisão para peças de exemplo, pela MESMA função da venda.
 */
const EXEMPLOS_DO_FILTRO = [
  { rotulo: 'Comum, 0 atributos', raridade: 'comum', niveis: [] },
  { rotulo: 'Comum, 1 atributo N1', raridade: 'comum', niveis: [1] },
  { rotulo: 'Comum, 2 atributos N3', raridade: 'comum', niveis: [3, 3] },
  { rotulo: 'Incomum, 0 atributos', raridade: 'incomum', niveis: [] },
  { rotulo: 'Incomum, 1 atributo N1', raridade: 'incomum', niveis: [1] },
  { rotulo: 'Raro, 0 atributos', raridade: 'raro', niveis: [] },
  { rotulo: 'Raro, 3 atributos N2', raridade: 'raro', niveis: [2, 2, 2] },
  { rotulo: 'Épico, 1 atributo N4', raridade: 'épico', niveis: [4] },
  { rotulo: 'Mítico, 6 atributos N5', raridade: 'mítico', niveis: [5, 5, 5, 5, 5, 5] },
];
let pecaDeExemplo = null;
export function previaDoFiltro(estado) {
  if (itensPoeLigado()) return previaDoFiltroPoe(estado);
  pecaDeExemplo ??= Number(Object.keys(ITEM_CATALOG).find((id) => aceitaAfixo(Number(id)) && ITEM_CATALOG[id].slot === 'body'));
  const ids = Object.keys(FICHAS);
  return EXEMPLOS_DO_FILTRO.map((x) => {
    const p = { id: pecaDeExemplo, count: 1, raridade: x.raridade, af: x.niveis.map((nivel, i) => ({ id: ids[i % ids.length], nivel, value: 1 })) };
    return { rotulo: x.rotulo, ...decisaoDoLoot({ ...estado, itemRules: { ...(estado.itemRules ?? {}), noLoot: [], noSell: [] } }, p) };
  });
}

/** Os sockets da peça: quantos abertos e o maior grupo ligado. */
export function socketsDaPeca(p) {
  const so = p?.soquetes;
  if (!so?.abertos) return { abertos: 0, ligados: 0 };
  return { abertos: so.abertos, ligados: Math.max(0, ...gruposLigados(so).map((g) => g.length)) };
}

/** A regra de sockets da venda automática (`guardarSockets`: abertos, `guardarLigados`: o maior grupo ligado). */
export function guardaPelosSockets(s, p) {
  const minAbertos = Number(s?.guardarSockets ?? 0);
  const minLigados = Number(s?.guardarLigados ?? 0);
  if (!minAbertos && !minLigados) return false;
  const { abertos, ligados } = socketsDaPeca(p);
  return (minAbertos > 0 && abertos >= minAbertos) || (minLigados > 1 && ligados >= minLigados);
}

// ------------------------------------------- vida/mana máxima e capacidade

/** A capacidade com o afixo "Capacidade" das peças vestidas. */
// + o imbuement "Increase Capacity" (% da capacidade), nas botas e na armadura.
// Com o sistema de itens do PoE ligado NÃO HÁ capacidade (dono, 06/10: "não existe cap mais" — o PoE não tem peso): infinita, então o
// peso nunca impede pegar loot, trocar nem manda nada para o Depósito.
export const capacidade = (estado) =>
  itensPoeLigado() ? Infinity : R.maxCapacity(estado.vocation, estado.level ?? 1) + Gemas.bonus(estado).capacidade;

/**
 * "+Life" e "+Mana" dos adds, mais a Life do STR e a Mana do INT. Aplicados como diferença
 * sobre `maxHp`/`maxMana` (o resto do jogo lê esses dois campos), marcando o
 * quanto já foi posto em `afixoMax` — vestir, tirar e subir de level chamam
 * isto de novo e só a diferença entra ou sai.
 */
export function sincronizarMaximos(estado) {
  const t = soma(estado);
  // +Life / +Mana dos adds, e o que STR (Life) e INT (Mana) dão — ver `personagem/atributos.mjs`.
  const doAtributo = Atributos.efeitos(Atributos.principais(estado, t));
  // PoE (únicos): "Força não concede bônus à Vida Máxima", "Inteligência não concede nenhum bônus inerente ao Máximo de Mana".
  if (itensPoeLigado() && t.str_sem_vida > 0) doAtributo.vida = 0;
  if (itensPoeLigado() && t.int_sem_mana > 0) doAtributo.mana = 0;
  // + a Life % da especialização da classe (Knight: Life), sobre a vida do level + a dos adds e do STR.
  // + a "Vida máxima aumentada em X%" das peças do PoE (`life_inc`).
  const lifePct = (Especializacoes.efeitos(estado).stats.life ?? 0) + (t.life_inc ?? 0);
  const base = R.statsBase(estado.vocation, estado.level ?? 1);
  // (13/10, A Apóstata) + o Escudo de Energia das armaduras, como Vida fixa (antes dos aumentos — `vidaDasArmaduras`).
  const daApostata = vidaDasArmaduras(estado, t);
  const vidaSemPct = base.maxHp + (t.life ?? 0) + daApostata + doAtributo.vida;
  // + a Mana % (a árvore do PoE: "Mana máxima aumentada em X%"), do mesmo jeito da Life %. Nada do Draevor dá Mana %: sem ela, nada muda.
  const manaPct = (Especializacoes.efeitos(estado).stats.mana ?? 0) + (t.mana_inc ?? 0);
  const manaSemPct = base.maxMana + (t.mana ?? 0) + doAtributo.mana;
  const quer = { hp: Math.round((t.life ?? 0) + daApostata + doAtributo.vida + (vidaSemPct * lifePct) / 100), mana: Math.round((t.mana ?? 0) + doAtributo.mana + (manaSemPct * manaPct) / 100) };
  // (09/10) "X% MAIS Vida Máxima" (a maestria de vida da árvore: `life_more`): multiplica a vida inteira.
  const maisVida = itensPoeLigado() ? Number(t.life_more) || 0 : 0;
  if (maisVida) quer.hp = Math.round((base.maxHp + quer.hp) * (1 + maisVida / 100) - base.maxHp);
  // PoE: "X% de Vida Máxima Convertida em Escudo de Energia" — sai da vida e vira escudo (a ficha soma `vidaConvertidaPoe` no escudo).
  const converte = itensPoeLigado() ? Math.min(100, Number(t.vida_em_escudo) || 0) : 0;
  const vidaConvertida = converte > 0 ? Math.round(((base.maxHp + quer.hp) * converte) / 100) : 0;
  quer.hp -= vidaConvertida;
  estado.vidaConvertidaPoe = vidaConvertida;
  // (ciclo 7, lote H) A Inoculação do Caos: "Vida Máxima torna-se 1, Imune a Dano de Caos".
  if (itensPoeLigado() && Number(t.vida_vira_1) > 0) quer.hp = 1 - base.maxHp;
  const tem = estado.afixoMax ?? { hp: 0, mana: 0 };
  if (quer.hp === tem.hp && quer.mana === tem.mana) return;
  estado.maxHp = (estado.maxHp ?? 0) + quer.hp - tem.hp;
  estado.maxMana = (estado.maxMana ?? 0) + quer.mana - tem.mana;
  estado.hp = Math.min(estado.hp ?? 0, estado.maxHp);
  estado.mana = Math.min(estado.mana ?? 0, estado.maxMana);
  estado.afixoMax = quer;
}
