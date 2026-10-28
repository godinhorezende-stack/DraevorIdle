// O LOTE P4 das gemas do PoE (rodada 4, dono 27/10: "quero resolver" — as parciais e as limitações do idle que sobraram). Aqui ficam os DADOS (os números do PoB e
// do poedb) e as contas PURAS (sem a caçada); quem usa é `acoes.mjs` (o uso, os gatilhos, o tique dos Vínculos, a Praga), `skills/gemas.mjs` (o grupo do Vínculo
// Intuitivo), `suportes-poe.mjs` (as linhas das Maquinações), `vinculos.mjs` (o "menos Dano" do Intuitivo), `gemas-poe.mjs`/`gemas-c4.mjs` (o status) e
// `cacadas.mjs` (os Duplos no tique dos lacaios).
//
// O que o lote faz:
//   - o IMPEDIMENTO DE GANHO DE ALMAS (decisão do dono 27/10: criar o do PoE para TODAS as gemas Vaal). No jogo as almas das Vaal são a recarga delas (lote 51 — "Traduzir
//     para a recarga"); então "não ganhar almas por N segundos" = a recarga de TODA habilidade Vaal na barra fica parada por N segundos depois do uso de uma Vaal (a que
//     acabou de ser usada começa a carregar só depois do impedimento). N é o "Impedimento de Ganho de Almas: N Seg" da gema usada (o PoB: soulPreventionDuration); com
//     "Modificadores à Duração do Efeito de Habilidade também se aplicam à Anulação do Ganho de Almas dessa Habilidade" (27 gemas — o PoB:
//     modifiers_to_skill_effect_duration_also_affect_soul_prevention_duration), × a Duração da Habilidade do uso. Impedimentos que se sobrepõem não somam: vale até o fim
//     do mais longo (o PoE: o debuff renova). Durante o impedimento a alma a mais "por Inimigo Estilhaçado" também não entra. A TENTAÇÃO VAAL troca o impedimento pelo
//     Dano Físico degenerativo dela (o "em vez de aplicar impedimento de ganho de almas" — `SuportesS2A.tentacaoVaalNoUso`, pelo mesmo tempo);
//   - o VÍNCULO INTUITIVO (o PoB, act_dex.lua IntuitiveLink/SupportIntuitiveLink): as magias ligadas a ele (ativáveis, sem reserva, sem Armadilha, Mina, Totem, Vaal,
//     Canalização e as de Ativação embutida) só saem por ele: quando o aliado vinculado (um jogador da party na sala — o Vínculo dele) ACERTA um inimigo, elas saem de
//     você no inimigo vivo mais perto dele, com o "X% menos Dano" do nível (support_trigger_link_damage_+%_final, −44 no 1 … −38 no 20) e a recarga de 0,5 s do
//     gatilho (cooldown 0.5, storedUses 1). Sem party, o Vínculo não tem alvo (como no PoE);
//   - as MAQUINAÇÕES (o PoB não tem a gema; o poedb em inglês — https://poedb.tw/us/Machinations_Support, baixada pelo Scrapling em 27/10: "Supported Skills gain
//     (6—8)% of Physical Damage as Extra Chaos Damage per Keystone" e "Supported Skills have 10% increased Cost per Keystone"; o "fundamental" do poedb pt é a
//     Keystone): por keystone ALOCADA na árvore (o PoB: Multiplier:AllocatedKeystone — os nós Keystone alocados; as keystones que vêm das peças não contam), X% do
//     Físico como Caos adicional e 10% de Custo aumentado (o "aumentado" do custo, que soma com os outros aumentados);
//   - o INFESTADOR (o PoB, act_dex.lua PlagueBearer): o raio da Infestação é o do PoB — radius 25 (2,5 m) + o "+X metros de raio" do nível —, × √ da Área de Efeito,
//     ÷ 2 em casas (a fração, a chance de uma casa a mais); usar a gema à mão ALTERNA entre Incubando e Infestando (com Valor na Praga), na recarga de 0,5 s, como
//     no PoE; ligada na barra ela segue alternando sozinha (o automático do jogo: Infesta no Valor Máximo com um inimigo no raio);
//   - os DUPLOS do Golpe Duplo Vaal (o PoB, act_dex.lua VaalDoubleStrike — "each of which summons a double of you for a duration to continuously attack monsters in this
//     fashion"; number_of_monsters_to_summon 1 por golpe, maximum_number_of_summoned_doubles 8, base_skill_effect_duration 6000, doubles_have_movement_speed_+%): o seu
//     uso convoca um Duplo por golpe (2) ao seu lado, pela Duração da Habilidade; no máximo 8 (o mais velho sai). O Duplo anda até o inimigo mais perto (o passo do
//     lacaio, + o "Clones possuem X% de aumento da Velocidade de Movimento" na chance do passo a mais) e, colado, usa o Golpe Duplo Vaal com a SUA força, do lugar
//     dele, no tempo do seu ataque — sem custo, sem recarga e sem ser uso de Vaal (não gasta almas, não impede o ganho, não convoca outro Duplo). O PoE não publica a vida
//     dos Duplos: eles não são alvo dos monstros (escolha registrada, como os Robôs Ativadores).

const num = (s) => parseFloat(String(s).replace(',', '.'));
const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- o Impedimento de Ganho de Almas

const LINHA_DURACAO_NO_IMPEDIMENTO = /^Modificadores à Duração do Efeito de Habilidade também se aplicam à Anulação do Ganho de Almas dessa Habilidade$/i;
/** A gema tem o "Modificadores à Duração … também se aplicam à Anulação do Ganho de Almas"? (`linhas`: as linhas da gema no nível) */
export const duracaoValeNoImpedimento = (linhas = []) => linhas.some((l) => LINHA_DURACAO_NO_IMPEDIMENTO.test(norm(l)));
/** Os ms do impedimento: o da gema (`baseMs`, das propriedades) × a Duração da Habilidade (`fatorDur`) se a gema tem a linha; 0 sem impedimento. */
export function msDoImpedimento(baseMs, linhas = [], fatorDur = 1) {
  if (!(baseMs > 0)) return 0;
  return Math.round(baseMs * (duracaoValeNoImpedimento(linhas) ? Math.max(0, Number(fatorDur) || 0) : 1));
}
/** O ganho de almas está impedido agora? (`hunt.poeAlmasImpedidasAte`) */
export const almasImpedidas = (hunt, agora = hunt?.clock ?? 0) => (hunt?.poeAlmasImpedidasAte ?? -Infinity) > agora;
/**
 * Põe o impedimento de `ms` a partir de `inicio`: a recarga de cada habilidade Vaal que ainda carrega (`cds[id]` de `vaalIds` — a recém-usada também) anda para frente
 * pelo pedaço do impedimento que ainda não estava coberto (o novo fim menos o fim do anterior, se este ainda valia); a recém-usada (`usadaId`) anda até o fim do
 * impedimento que vale (o novo ou o de antes). Guarda um número só (`hunt.poeAlmasImpedidasAte`):
 * o fim do impedimento — o estado novo é um instante, sem lista. Devolve os ms acrescentados.
 */
export function impedirAlmas(hunt, cds, vaalIds, inicio, ms, usadaId = null) {
  if (!hunt || !(ms > 0)) return 0;
  const fim = inicio + ms;
  const antes = hunt.poeAlmasImpedidasAte ?? -Infinity;
  const extra = Math.max(0, fim - Math.max(inicio, antes));
  if (fim > antes) hunt.poeAlmasImpedidasAte = fim;
  // (achado C3 da rodada 4) a RECÉM-USADA (`usadaId`) começou a carregar em `inicio`: ela só carrega no fim do impedimento que vale — o novo ou o de antes, o que
  // acabar depois —, então anda (esse fim − `inicio`), e não só o pedaço novo (quem já carregava já foi parado pelo impedimento de antes).
  const fimQueVale = Math.max(fim, antes);
  for (const id of vaalIds ?? []) {
    const cd = cds?.[id];
    if (!cd || !(cd.ate > inicio)) continue;
    if (usadaId != null && id === usadaId) cd.ate += fimQueVale - inicio;
    else if (extra > 0) cd.ate += extra;
  }
  return extra;
}
/** O impedimento acabou: a chave sai (a caçada não guarda instantes vencidos). */
export function limparImpedimento(hunt, agora = hunt?.clock ?? 0) {
  if (hunt && hunt.poeAlmasImpedidasAte != null && hunt.poeAlmasImpedidasAte <= agora) delete hunt.poeAlmasImpedidasAte;
}

// ---------------------------------------------------------------- o Vínculo Intuitivo

export const INTUITIVO = Object.freeze({ slug: 'Intuitive_Link', recargaMs: 500 });
const LINHA_MENOS_DO_INTUITIVO = /^Magias Suportadas causam ([\d.,]+) ?% menos Dano$/i;
/** O "Magias Suportadas causam X% menos Dano" do Vínculo Intuitivo (as linhas da gema no nível), ou null. */
export function menosDoIntuitivo(linhas = []) {
  for (const l of linhas) { const m = LINHA_MENOS_DO_INTUITIVO.exec(norm(l)); if (m) return num(m[1]); }
  return null;
}
/**
 * O aliado vinculado acertou desde a última olhada? `visto`: o último acerto dele já contado (no relógio da caçada DELE); `acertou`: o `poeRecente.acertou` dele agora.
 * `{ dispara, visto }` — o primeiro olhar só guarda (o acerto de antes do Vínculo não conta).
 */
export function acertoDoVinculado(visto, acertou) {
  if (acertou == null) return { dispara: false, visto: visto ?? -Infinity };
  if (visto === undefined) return { dispara: false, visto: acertou };
  return acertou > visto ? { dispara: true, visto: acertou } : { dispara: false, visto };
}

// ---------------------------------------------------------------- as Maquinações

/** As linhas das Maquinações (`suportes-poe.efeitoNoNivel`, as próprias do slug): o "por fundamental" vira por keystone alocada no uso (`comAsFundamentais`). */
export const PROPRIAS_P4 = {
  Machinations_Support: [
    [/^Habilidades reforçadas ganham ([\d.,]+) ?% do dano físico como dano de caos adicional por fundamental$/i, (m, e) => { e.p4CaosPorFundamentalPct = (e.p4CaosPorFundamentalPct ?? 0) + num(m[1]); }],
    [/^Habilidades reforçadas têm o custo aumentado em ([\d.,]+) ?% por fundamental$/i, (m, e) => { e.p4CustoPorFundamentalPct = (e.p4CustoPorFundamentalPct ?? 0) + num(m[1]); }],
  ],
};
/**
 * O efeito do uso com as Maquinações e `keystones` alocadas: + `af:phys_as_extra_chaos` (X% × keystones — o "Ganha X% do Dano Físico como Dano de Caos Extra" das
 * linhas locais) e + `custoIncPct` (10% × keystones — o "aumentado" do custo). Sem as linhas, o mesmo efeito.
 */
export function comAsFundamentais(ef, keystones = 0) {
  if (!ef || !(ef.p4CaosPorFundamentalPct > 0 || ef.p4CustoPorFundamentalPct > 0)) return ef;
  const k = Math.max(0, Math.floor(Number(keystones) || 0));
  if (!k) return ef;
  const out = { ...ef };
  if (ef.p4CaosPorFundamentalPct > 0) out['af:phys_as_extra_chaos'] = (out['af:phys_as_extra_chaos'] ?? 0) + ef.p4CaosPorFundamentalPct * k;
  if (ef.p4CustoPorFundamentalPct > 0) out.custoIncPct = (out.custoIncPct ?? 0) + ef.p4CustoPorFundamentalPct * k;
  return out;
}

// ---------------------------------------------------------------- o Infestador

/** O raio do Infestador no PoB: radius 25 (2,5 m); o "+X metros de raio" do nível soma (active_skill_base_radius_+). */
export const INFESTADOR = Object.freeze({ raioBaseM: 2.5 });
export const raioDoInfestadorM = (raioBonusM = 0) => INFESTADOR.raioBaseM + Math.max(0, Number(raioBonusM) || 0);
/**
 * A troca À MÃO do Infestador (o PoE: "Using the skill again alternates between Incubating and Infecting"): Incubando com Valor → Infestando (do Valor de agora);
 * Infestando → Incubando (o Valor que sobrou fica). Respeita a recarga (`p.recargaAte`). Devolve o modo novo, ou null se não trocou (e o motivo).
 */
export function alternarPraga(p, agora, { recargaMs = 500, porSegundoPct = 12 } = {}) {
  if (!p) return { modo: null, motivo: 'SEM_PRAGA' };
  if (agora < (p.recargaAte ?? 0)) return { modo: null, motivo: 'COOLDOWN' };
  if (p.modo === 'incubando') {
    if (!(p.valor > 0)) return { modo: null, motivo: 'SEM_VALOR' };
    Object.assign(p, { modo: 'infestando', inicio: p.valor, recargaAte: agora + recargaMs, porSegundoPct });
    return { modo: 'infestando' };
  }
  Object.assign(p, { modo: 'incubando', recargaAte: agora + recargaMs });
  delete p.inicio;
  return { modo: 'incubando' };
}

// ---------------------------------------------------------------- o Devastador

/**
 * (dono 27/10) O DEVASTADOR: "Estar próximo do totem te concede aumento da área de efeito para habilidades corpo a corpo" — o valor (o PoB:
 * ancestor_totem_grants_owner_area_of_effect_+%_with_melee_skills) não está no PoB, no poedb salvo nem nas páginas do Scrapling: 15% é o número escolhido pelo dono
 * (sem fonte; dono 27/10). "Perto" é o raio do buff dos totens ancestrais que o jogo já usa: a distância de ativação do totem (`l.ativacao` — a do Devastador, 7 m do
 * PoB), a mesma do "X% mais Dano Corpo a Corpo enquanto o Totem estiver Ativo" do Chefe Guerreiro (`GemasPoe.adds`); não soma entre totens (o maior).
 */
export const DEVASTADOR = Object.freeze({ slug: 'Earthbreaker_Support', areaCorpoIncPct: 15, fonte: 'sem fonte; dono 27/10' });
/** O buff do totem do Devastador em você, perto dele (`l.buffAtivo`): a Área de Efeito aumentada das Habilidades Corpo a Corpo. */
export const buffDoDevastador = (pct = DEVASTADOR.areaCorpoIncPct) => (pct > 0 ? { 'area_inc@corpo': pct } : null);

// ---------------------------------------------------------------- os Duplos do Golpe Duplo Vaal

export const DUPLOS = Object.freeze({ slug: 'Vaal_Double_Strike', porUso: 2, maximo: 8, duracaoMs: 6000, nome: 'Duplo' });
const LINHA_MOVIMENTO_DOS_DUPLOS = /^Clones possuem ([\d.,]+) ?% de aumento da Velocidade de Movimento$/i;
const LINHA_MAXIMO_DOS_DUPLOS = /^Máximo de (\d+) Clones Convocados$/i;
const LINHA_DURACAO = /^Duração base é de ([\d.,]+) segundos?$/i;
/** Os Duplos pelas linhas do Golpe Duplo Vaal no nível: `{ movimentoPct, maximo, duracaoMs }`. */
export function duplosDasLinhas(linhas = []) {
  const achar = (re) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return num(m[1]); } return null; };
  return { movimentoPct: achar(LINHA_MOVIMENTO_DOS_DUPLOS) ?? 0, maximo: achar(LINHA_MAXIMO_DOS_DUPLOS) ?? DUPLOS.maximo, duracaoMs: Math.round((achar(LINHA_DURACAO) ?? DUPLOS.duracaoMs / 1000) * 1000) };
}
/** A linha do movimento dos Duplos tem leitor (sai de "efeito não simulado"). */
export const ehLinhaDosDuplos = (slug, l) => slug === DUPLOS.slug && LINHA_MOVIMENTO_DOS_DUPLOS.test(norm(l));
/** Os Duplos vivos da ação `acao` na lista de lacaios (no relógio `agora` dos lacaios). */
export const duplosVivos = (lacaios, acao, agora) => (lacaios ?? []).filter((l) => l.p4Duplo === acao && l.hp > 0 && !(l.ate && agora >= l.ate));
/** Abre espaço para `novos` Duplos no máximo: os mais velhos acabam agora (`ate`). Devolve quantos saíram. */
export function abrirEspacoDosDuplos(lacaios, acao, maximo, novos, agora) {
  const vivos = duplosVivos(lacaios, acao, agora).sort((a, b) => (a.desde ?? 0) - (b.desde ?? 0));
  const sobra = Math.max(0, vivos.length + novos - Math.max(1, maximo));
  for (const l of vivos.slice(0, sobra)) l.ate = agora;
  return sobra;
}
