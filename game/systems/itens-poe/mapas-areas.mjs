// As ÁREAS dos mapas do endgame (T1–T16, dono 10/10 — só no jogo oficial). Cada tier é uma hunt virtual (`poe-mapa-<tier>`) montada como as
// áreas da campanha do PoE (`campanha.mjs`): o TERRENO de uma hunt do Draevor (o apelido do mapa), os MONSTROS comuns de uma área da
// campanha e um CHEFE (um monstro único da campanha) — todos LEVADOS AO NÍVEL DO MAPA (68–83) pelo crescimento por nível do PoE
// (`mapas.json → instancia.crescimentoPorNivel`, medido nos próprios monstros da campanha — vida, dano, exp e ES; a armadura e a evasão
// saem da tabela do PoE no nível do mapa, lote A5e). A peça que abre o mapa decide o resto, na
// entrada (`Cacadas.entrar` com `mapa`): os efeitos dos afixos nos monstros e no chefe (`aplicarEfeitos`), a raridade a mais, o tamanho
// do grupo e quantos chefes.
import { ligado } from './catalogo.mjs';
import * as Mapas from './mapas.mjs';
import * as Monstros from './monstros.mjs';
import * as DefesaPoe from './defesa-poe.mjs';
import { CATALOGO } from '../dados.mjs';
import { BESTIARY } from '../hunt/monstros.mjs';
import { acharHunt, apelidarMapa, definirTransformadorDeSpawns, spawnsDaHunt, spawnsDaHuntSemGuardar } from '../hunt/terreno.mjs';

const C = Monstros.CAMPANHA;
export const CONFIG = Mapas.DADOS.instancia ?? { porTier: [], crescimentoPorNivel: {} };
const POR_TIER = new Map((CONFIG.porTier ?? []).map((t) => [Number(t.tier), t]));
const PREFIXO = 'poe-mapa-';

/** A hunt virtual do tier (`poe-mapa-<tier>`), ou null fora de T1…T16. */
export const huntIdDoTier = (tier) => (POR_TIER.has(Number(tier)) && Mapas.nivelDoTier(tier) ? `${PREFIXO}${Number(tier)}` : null);
/** O tier de uma hunt de mapa (ou null: não é mapa). (08/11: + as do terreno próprio do mapa único — `poe-mapa-<tier>-<terreno>`) */
export function tierDaHunt(huntId) {
  const m = /^poe-mapa-(\d+)(?:-[a-z]+)?$/.exec(String(huntId ?? ''));
  return m && POR_TIER.has(Number(m[1])) ? Number(m[1]) : null;
}
/**
 * (08/11 — o dono: "Terreno próprio") os TERRENOS dos mapas únicos que o PoE descreve pelo terreno: "Área é um imenso Labirinto" (o Pesadelo de
 * Acton, o Hospício de Poorjoy) e "Área contém brechas sem passagem atravessar" (os Pilares de Arun). A hunt do Draevor de cada um foi medida
 * (as casas alcançáveis): o labirinto é a Black Serpent Dungeon (3.889 casas, 17% de corredor — das maiores com corredor), as brechas são a
 * Hive Surface (4.127 casas, 0,20 buraco sem passagem por casa — a que mais tem); nenhuma é terreno de tier. Os monstros e o chefe são os do tier.
 */
export const TERRENOS_PROPRIOS = Object.freeze({ labirinto: 'black-serpent-dungeon', brechas: 'hive-surface' });
/** A hunt virtual do mapa aberto: a do terreno próprio do único (`efeitos.instancia.terreno_<tipo>`), ou a do tier. */
export function huntIdDoMapa(tier, peca) {
  const base = huntIdDoTier(tier);
  const inst = peca?.poe?.mapa?.efeitos?.instancia ?? (peca?.poe ? Mapas.resumo({ poe: peca.poe }).efeitos.instancia : {});
  const tipo = Object.keys(TERRENOS_PROPRIOS).find((t) => Number(inst?.[`terreno_${t}`]) > 0);
  return base && tipo && CATALOGO.hunts.some((h) => h.id === `${base}-${tipo}`) ? `${base}-${tipo}` : base;
}

// (lote A5e) A armadura e a evasão NÃO crescem pela curva: no combate saem da tabela do PoE no nível × o multiplicador do tipo
// (`itens-poe/defesa-poe.mjs`); aqui o número de referência do monstro no mapa fica o mesmo da conta (o `crescimentoPorNivel` delas saiu de `mapas.json`, dono 20/10).
const STATUS_QUE_CRESCEM = ['vida', 'dano', 'experiencia', 'escudoDeEnergia'];
/**
 * O monstro do PoE (status de `campanha-poe.json`, num nível da campanha) levado ao `nivel` do mapa: cada status × e^(crescimento × níveis
 * a mais) — o dano das habilidades junto (a proporção entre o golpe e as magias continua a mesma). Resistências e tempo de ataque não
 * mudam com o nível no PoE. A armadura e a evasão NÃO crescem pelo `crescimentoPorNivel`: são a tabela do PoE no nível do mapa × o multiplicador
 * do tipo (lote A5e).
 */
export function noNivel(m, nivel) {
  const d = Number(nivel) - Number(m.nivel);
  // (revisão do A5e) mesmo no nível da campanha (d = 0) a armadura e a evasão de referência viram as da tabela (abaixo): sem o atalho de antes.
  const fator = (campo) => Math.exp((Number(CONFIG.crescimentoPorNivel?.[campo]) || 0) * d);
  const saida = { ...m, nivel: Number(nivel) };
  for (const campo of STATUS_QUE_CRESCEM) if (Number(m[campo]) > 0) saida[campo] = Math.round(m[campo] * fator(campo));
  saida.armadura = DefesaPoe.armaduraPoeDoSlug(m.slug, saida.nivel);
  saida.evasao = DefesaPoe.defesaPoeDoSlug(m.slug, saida.nivel).evasao;
  if (m.habilidades?.length) {
    const fd = fator('dano');
    // O fator de uma habilidade só nos mapas (`mapas.json → instancia.fatorDasHabilidades`, por slug do monstro e interno da habilidade): a
    // Bomba Viva do General Adus × 0,6 (dono, 27/10). A campanha não passa por aqui.
    const doMonstro = CONFIG.fatorDasHabilidades?.[m.slug] ?? {};
    saida.habilidades = m.habilidades.map((h) => {
      if (!h.dano) return h;
      const f = fd * (Number(doMonstro[h.interno]) > 0 ? Number(doMonstro[h.interno]) : 1);
      return { ...h, dano: { min: Math.round(h.dano.min * f), max: Math.round(h.dano.max * f) } };
    });
  }
  return saida;
}

/** O monstro único da campanha pelo slug (o de nível mais alto; os chefes de ato também valem). */
function unicoPeloSlug(slug) {
  let achado = null;
  for (const a of Object.values(C.areas)) for (const m of a.monstros ?? []) if (m.slug === slug && (!achado || m.nivel > achado.nivel)) achado = m;
  for (const c of Object.values(C.chefes ?? {})) if (c.monstro?.slug === slug && (!achado || c.monstro.nivel > achado.nivel)) achado = c.monstro;
  return achado;
}
/** As criaturas do Draevor dos spawns de um terreno (o desenho dos monstros do PoE que não têm um pelo nome). */
const nativosDoTerreno = (terreno, lerSpawns = spawnsDaHunt) => [...new Set((lerSpawns(terreno) ?? []).flatMap((s) => (s.criaturas ?? []).map((c) => c.key)))].filter((k) => BESTIARY[k]);

// tier → { comuns: [chaves], chefe: chave }
const DO_TIER = new Map();
/** As chaves do bestiário dos monstros comuns do tier. */
export const comunsDoTier = (tier) => DO_TIER.get(Number(tier))?.comuns ?? [];
/** A chave do bestiário do chefe do tier (ou null). */
export const chefeDoTier = (tier) => DO_TIER.get(Number(tier))?.chefe ?? null;

let INICIADO = null;
/**
 * Monta as áreas dos mapas (uma vez): as hunts virtuais com o apelido do terreno, os monstros e o chefe de cada tier no nível do mapa, e o
 * transformador que põe os monstros do tier nos spawns do terreno. Sem o jogo oficial, nada. `{ tiers, problemas }`.
 */
/** `mapasSobDemanda`: os bichos nativos de cada terreno sem deixar os mapas na memória (a thread da caçada offline — ver `CampanhaPoe.iniciar`). */
export function iniciar({ mapasSobDemanda = false } = {}) {
  if (!ligado()) return { tiers: 0, problemas: [] };
  if (INICIADO) return INICIADO;
  const problemas = [];
  for (const t of CONFIG.porTier ?? []) {
    const tier = Number(t.tier);
    const nivel = Mapas.nivelDoTier(tier);
    const area = C.areas[t.area];
    const base = acharHunt(t.terreno);
    if (!nivel) problemas.push(`T${tier}: o tier não está em mapas.json → tiers`);
    else if (!area || area.cidade) problemas.push(`T${tier}: a área "${t.area}" não existe na campanha do PoE`);
    else if (!base || base.poeArea || base.poeMapa) problemas.push(`T${tier}: o terreno "${t.terreno}" não é uma hunt do Draevor`);
    if (problemas.length && problemas.at(-1).startsWith(`T${tier}:`)) continue;
    const nativos = nativosDoTerreno(t.terreno, mapasSobDemanda ? spawnsDaHuntSemGuardar : spawnsDaHunt);
    const comuns = (area.monstros ?? []).filter((m) => !m.unico).map((m, i) => Monstros.registrar(noNivel(m, nivel), nativos[i % Math.max(1, nativos.length)] ?? 'skeleton'));
    if (!comuns.length) {
      problemas.push(`T${tier}: a área "${t.area}" não tem monstros comuns`);
      continue;
    }
    const doChefe = t.chefe ? unicoPeloSlug(t.chefe) : null;
    if (t.chefe && !doChefe) problemas.push(`T${tier}: o chefe "${t.chefe}" não é um monstro único da campanha`);
    const chefe = doChefe ? Monstros.registrar(noNivel(doChefe, nivel), 'demon') : null;
    DO_TIER.set(tier, { comuns, chefe, nativos, area: t.area });
    const id = `${PREFIXO}${tier}`;
    apelidarMapa(id, t.terreno);
    const criaturas = [...new Set([...comuns, ...(chefe ? [chefe] : [])])].map((k) => ({ key: k, name: BESTIARY[k].name, look: BESTIARY[k].look, exp: BESTIARY[k].exp, hp: BESTIARY[k].hp }));
    const hunt = { ...base, id, name: `Mapa (Nível ${tier})`, level: nivel, blurb: `Mapa do Atlas · Nível ${tier} (PoE)`, poeMapa: tier, creatures: criaturas };
    const i = CATALOGO.hunts.findIndex((h) => h.id === id);
    if (i >= 0) CATALOGO.hunts[i] = hunt;
    else CATALOGO.hunts.push(hunt);
    // (08/11) o mesmo tier nos terrenos próprios dos únicos (`TERRENOS_PROPRIOS`): os monstros e o chefe do tier, o terreno do único
    for (const [tipo, terreno] of Object.entries(TERRENOS_PROPRIOS)) {
      const doTerreno = acharHunt(terreno);
      if (!doTerreno || doTerreno.poeArea || doTerreno.poeMapa) { problemas.push(`o terreno "${terreno}" (${tipo}) não é uma hunt do Draevor`); continue; }
      const idT = `${id}-${tipo}`;
      apelidarMapa(idT, terreno);
      const huntT = { ...doTerreno, id: idT, name: `Mapa (Nível ${tier})`, level: nivel, blurb: `Mapa do Atlas · Nível ${tier} (PoE)`, poeMapa: tier, creatures: criaturas };
      const j = CATALOGO.hunts.findIndex((h) => h.id === idT);
      if (j >= 0) CATALOGO.hunts[j] = huntT;
      else CATALOGO.hunts.push(huntT);
    }
  }
  // Os spawns do terreno com os monstros comuns do tier, revezando (a quantidade, a raridade e os modificadores do spawn ficam).
  definirTransformadorDeSpawns((huntId, spawns) => {
    const comuns = comunsDoTier(tierDaHunt(huntId));
    if (!comuns.length) return spawns;
    return spawns.map((s, i) => ({ ...s, criaturas: [{ key: comuns[i % comuns.length], peso: 1 }] }));
  }, 'mapas');
  INICIADO = { tiers: DO_TIER.size, problemas };
  return INICIADO;
}

/**
 * Os EFEITOS do mapa (`resumo.efeitos.monstros`, ou `.chefe` no chefe) num monstro já pronto (raridade aplicada) — muta e devolve. As
 * porcentagens "mais" do PoE multiplicam o que o monstro já tem: a vida (e o escudo, que é parte da barra), o dano (`forca`), as
 * velocidades; a chance de crítico e o multiplicador somam pontos; a resistência soma por elemento; o dano extra por elemento e a
 * imunidade a atordoamento são campos do monstro (`combate.mjs`, `poderes.mjs`, `skills/estados.mjs`).
 */
export function aplicarEfeitos(m, ef) {
  if (!m || !ef) return m;
  const n = (k) => Number(ef[k]) || 0;
  if (n('vidaPct')) {
    m.maxHp = Math.max(1, Math.round(m.maxHp * (1 + n('vidaPct') / 100)));
    m.hp = m.maxHp;
    if (m.esPoe) m.esPoe.ultimoHp = m.maxHp;
  }
  if (n('esPct') > 0) {
    // "Ganham X% da Vida Máxima como Escudo de Energia Máximo Extra": o escudo por cima da barra, como o do modificador do monstro.
    const esAntes = (m.esPoe?.fracao ?? 0) * m.maxHp;
    const es = Math.round(((m.maxHp - esAntes) * n('esPct')) / 100);
    m.maxHp += es;
    m.hp = m.maxHp;
    m.esPoe = { ...(m.esPoe ?? {}), fracao: (esAntes + es) / m.maxHp, ultimoHp: m.maxHp };
  }
  if (n('danoPct')) m.forca = (m.forca ?? 1) * (1 + n('danoPct') / 100);
  if (n('velocidadePct')) m.velocidade = (m.velocidade ?? 1) * (1 + n('velocidadePct') / 100);
  if (n('velocidadeDeAtaquePct')) m.velocidadeDeAtaque = (m.velocidadeDeAtaque ?? 1) * (1 + n('velocidadeDeAtaquePct') / 100);
  if (n('critChance')) m.critChance = (m.critChance ?? 0) + n('critChance');
  if (n('critMultiplicador')) m.critMultiplicador = (m.critMultiplicador ?? 0) + n('critMultiplicador');
  if (n('precisaoPct')) m.precisaoPct = (m.precisaoPct ?? 0) + n('precisaoPct');
  for (const [el, v] of Object.entries(ef.resist ?? {})) if (Number(v)) m.resist = { ...(m.resist ?? {}), [el]: (m.resist?.[el] ?? 0) + Number(v) };
  for (const [el, v] of Object.entries(ef.danoExtraPct ?? {})) if (Number(v) > 0) m.danoExtraPct = { ...(m.danoExtraPct ?? {}), [el]: (m.danoExtraPct?.[el] ?? 0) + Number(v) };
  if (n('imuneAtordoamento') > 0) m.imuneAtordoamento = true;
  // (Os dos MAPAS ÚNICOS:) a experiência que o monstro dá ("Ganho de Experiência aumentado", "Chefe Único aumenta X% de Experiência"),
  // "Monstros não são Afetados por Eletrizações" e a Velocidade de Conjuração (as magias saem mais vezes — `poderes.mjs`).
  if (n('experienciaPct')) m.exp = Math.round((Number(m.exp) || 0) * Math.max(0, 1 + n('experienciaPct') / 100));
  if (n('imuneChoque') > 0) m.imuneChoque = true;
  if (n('velocidadeDeConjuracaoPct')) m.velocidadeDeConjuracao = (m.velocidadeDeConjuracao ?? 1) * (1 + n('velocidadeDeConjuracaoPct') / 100);
  // (12/10 — dono: "ligar os modificadores") O que o monstro faz ao ACERTAR você (`mobs/mecanicas.aoAcertarJogador`): a chance de Cegar,
  // Mutilar e Empalar e de ganhar cada Carga; os ESPINHOS (só nos Raros — `mecanicas.aoReceberDano`); "Impossível Drenar dos Monstros".
  for (const [k, v] of Object.entries(ef.noAcerto ?? {})) if (Number(v) > 0) m.noAcerto = { ...(m.noAcerto ?? {}), [k]: (m.noAcerto?.[k] ?? 0) + Number(v) };
  for (const [k, v] of Object.entries(ef.espinhos ?? {})) if (Number(v) > 0) m.espinhos = { ...(m.espinhos ?? {}), [k]: (m.espinhos?.[k] ?? 0) + Number(v) };
  if (n('semDreno') > 0) m.semDreno = true;
  // (08/11 — dono: zerar as linhas sem efeito dos mapas únicos)
  // O NÍVEL DOS MONSTROS ("Nível dos Monstros: 83", "+2 ao Nível dos Monstros da Área" — `nivelDelta`, a diferença para o nível do tier, do
  // `Mapas.resumo`): a vida, o dano e a experiência pelo crescimento por nível do PoE (o mesmo de `noNivel`); o nível novo vale no drop (`nivelPoe`).
  if (n('nivelDelta')) {
    const d = n('nivelDelta');
    const fator = (campo) => Math.exp((Number(CONFIG.crescimentoPorNivel?.[campo]) || 0) * d);
    m.maxHp = Math.max(1, Math.round(m.maxHp * fator('vida')));
    m.hp = m.maxHp;
    if (m.esPoe) m.esPoe.ultimoHp = m.maxHp;
    m.forca = (m.forca ?? 1) * fator('dano');
    m.exp = Math.round((Number(m.exp) || 0) * fator('experiencia'));
    m.nivelPoe = Math.max(1, (Number(m.nivelPoe ?? BESTIARY[m.key]?.poe?.nivel) || 1) + d);
  }
  // o drop do chefe: os Itens de Níveis maiores (o Santuário Olmeca, "+4" no poedb — `ilvlExtra`) e os Raros a mais de uma classe (o Hospício de
  // Poorjoy — `rarosExtras`, `rarosClasse`: o índice da classe em `CLASSES_DOS_RAROS`) — `hunt/combate.mjs`
  if (n('ilvlExtra')) m.ilvlExtra = (m.ilvlExtra ?? 0) + n('ilvlExtra');
  if (n('rarosExtras') > 0) {
    m.rarosExtras = (m.rarosExtras ?? 0) + Math.round(n('rarosExtras'));
    m.rarosClasse = CLASSES_DOS_RAROS[Math.max(0, Math.min(CLASSES_DOS_RAROS.length - 1, Math.round(n('rarosClasse'))))];
  }
  // as AFECÇÕES: "Monstros têm X% de chance de Evitarem Afecções" (`afeccoes.aoAcertar`) e "Imunes a Atordoamentos ou Afecções Elementais
  // aleatórias" (cada monstro, a sua: o Atordoamento ou uma das elementais — o Incêndio, o Resfriamento, o Congelamento, a Eletrização)
  if (n('evitarAfeccoesPct') > 0) m.evitarAfeccoesPct = Math.min(100, (m.evitarAfeccoesPct ?? 0) + n('evitarAfeccoesPct'));
  if (n('imuneAleatoria') > 0) {
    const q = IMUNIDADES[Math.floor(Math.random() * IMUNIDADES.length)];
    if (q === 'atordoamento') m.imuneAtordoamento = true;
    else m.imuneAfeccoes = [...new Set([...(m.imuneAfeccoes ?? []), q])];
  }
  // as MALDIÇÕES: "Monstros Refletem Feitiços" (a sua Maldição volta em você — `skills/reforcos.marcarCom`, `refleteFeiticos`) e "Maldições têm
  // seu efeito em Monstros reduzido em X%" (`efeitoMaldicaoMenosPct`)
  if (n('refleteFeiticos') > 0) m.refleteFeiticos = Math.min(100, (m.refleteFeiticos ?? 0) + n('refleteFeiticos'));
  if (n('efeitoMaldicaoMenosPct') > 0) m.efeitoMaldicaoMenosPct = Math.min(100, (m.efeitoMaldicaoMenosPct ?? 0) + n('efeitoMaldicaoMenosPct'));
  // os MORTOS INQUIETOS ("map undead monsters get up after X seconds [10]" — `hunt/instancia.guardarParaRessurgir`)
  if (n('ressurgirS') > 0) m.ressurgirMs = Math.round(n('ressurgirS') * 1000);
  return m;
}
/** As afecções de "Imunes a Atordoamentos ou Afecções Elementais aleatórias" (as do jogo; o PoE lista também o Causticado, o Fragilizado e o Exaurido). */
export const IMUNIDADES = Object.freeze(['atordoamento', 'incendio', 'resfriamento', 'congelamento', 'eletrizacao']);
/**
 * As classes dos Raros a mais do chefe do Hospício de Poorjoy ("Chefe Único derruba N Raro adicional <classe>" — o poedb dá o índice 0–23 do
 * `unique_map_boss_class_of_rare_items_to_drop`, sem a lista: aqui as 24 classes de equipamento do PoE).
 */
export const CLASSES_DOS_RAROS = Object.freeze(['Amulets', 'Rings', 'Belts', 'Body_Armours', 'Boots', 'Gloves', 'Helmets', 'Shields', 'Quivers', 'Bows', 'Claws', 'Daggers', 'Rune_Daggers', 'One_Hand_Axes', 'One_Hand_Maces', 'One_Hand_Swords', 'Thrusting_One_Hand_Swords', 'Sceptres', 'Wands', 'Staves', 'Warstaves', 'Two_Hand_Axes', 'Two_Hand_Maces', 'Two_Hand_Swords']);

// ---------------------------------------------------------------- os TRECHOS DE SOLO do mapa único (08/11)

/**
 * Os SOLOS do mapa único ("Área possui trechos de Solo Ardente / solo congelado / solo profano" — o Pesadelo de Acton, o Vórtice do Caos, o
 * Tesouro Maldito de Oba). O poedb em inglês dá: 20 trechos por 100 tiles ("map ground effect patches per 100 tiles"), o raio ("map ground
 * effect radius": 14; o Oba, 10), o fogo 16000 por 10 s, o profano 25000 por minuto e o gelo de magnitude 10. Aqui:
 *   - o TILE do PoE é 23 casas da grade dele (250 unidades); a casa do jogo é 20 unidades (`gemas-a3b.UNIDADES_POR_CASA`) — 100 tiles ≈ 15600
 *     casas; o raio é na grade do PoE (× 10,87 unidades), no quadrado de mesma área do círculo;
 *   - o dano segue a área (como o solo dos monstros — `mobs/mecanicas.criarSolo`, 62,5% do golpe máximo por segundo): o ARDENTE, 62,5% do golpe
 *     dos monstros comuns da área; o PROFANO, na proporção do PoE (25000/min contra 96000/min do fogo: 16,3%); o CONGELADO Resfria em 10%.
 */
export const SOLOS_DO_MAPA = Object.freeze({
  ardente: { pctDoGolpe: 62.5, efeito: 6 },
  profanado: { pctDoGolpe: (62.5 * 25000) / 96000, efeito: 17 },
  congelado: { resfriamentoPct: 10, efeito: 41 },
});
export const TRECHOS_POR_100_TILES = 20;
export const CASAS_POR_TILE = (250 / 20) ** 2;
const raioEmCasas = (raioPoe) => Math.max(1, Math.round(((Number(raioPoe) || 14) * 10.87 * Math.sqrt(Math.PI)) / 2 / 20));
/**
 * Põe os trechos na instância (`instancia.solosDoMapa`, as casas alcançáveis, longe da entrada): `solos` — `{ ardente: raio, … }` dos fatores
 * da instância; `golpe`: o golpe máximo dos monstros comuns da área. A semente é a da instância (todos da party veem os mesmos).
 */
export function porSolosNaInstancia(instancia, { grade, inicio = null, solos = {}, golpe = 0, alcancaveis, rng = Math.random } = {}) {
  const lista = [];
  for (const [tipo, raioPoe] of Object.entries(solos ?? {})) {
    const def = SOLOS_DO_MAPA[tipo];
    if (!def || !(raioPoe > 0)) continue;
    const raio = raioEmCasas(raioPoe);
    for (const [z, casas] of alcancaveis ?? []) {
      const todas = [...casas];
      const n = Math.max(1, Math.round((todas.length * TRECHOS_POR_100_TILES) / (100 * CASAS_POR_TILE)));
      for (let i = 0; i < n && todas.length; i++) {
        const [x, y] = todas.splice(Math.floor(rng() * todas.length), 1)[0].split(',').map(Number);
        // (nunca em cima da entrada: quem chega não nasce queimando)
        if (inicio && (inicio.z ?? grade?.z ?? 0) === z && Math.max(Math.abs(inicio.x - x), Math.abs(inicio.y - y)) <= raio + 1) continue;
        lista.push({ tipo, x, y, z, raio, efeito: def.efeito, ...(def.pctDoGolpe ? { dps: Math.round((golpe * def.pctDoGolpe) / 100) } : {}), ...(def.resfriamentoPct ? { pct: def.resfriamentoPct } : {}) });
      }
    }
  }
  if (lista.length && instancia) instancia.solosDoMapa = lista;
  return lista;
}

// ---------------------------------------------------------------- os HABITANTES do mapa único (08/11)

/**
 * Quem HABITA o mapa único (no lugar dos monstros comuns do tier — os slugs da campanha do PoE): "Área é habitada por Esqueletos" (o Pesadelo
 * de Acton — "map packs are skeletons"), "por seguidores de Lunaris / Solaris" (o Templo do Crepúsculo: os juramentados do Ato 8), "Área possui
 * muitos Totens" (o Whakawairua Tuahu: metade dos grupos são Totens Inua) e "aumento na variedade de monstros" (+ os comuns de dois outros tiers).
 */
export const HABITANTES = Object.freeze({
  esqueletos: ['Ancient_Bonestalker', 'Rattling_Bones', 'Colossal_Bonestalker', 'Bonewarped_Archer', 'Bonewarped_Warrior', 'Skeleton_Spriggan'],
  lunaris: ['Lunarsworn_Wintermage', 'Lunaris_Elite', 'Lunar_Scout', 'Lunar_Miscreation', 'Lunaris_Concubine', 'Lunaris_Zealot'],
  solaris: ['Solarsworn_Infernomage', 'Solaris_Elite', 'Solar_Scout', 'Solar_Elemental'],
  totens: ['Inua_Totem'],
});
/** O monstro COMUM da campanha pelo slug (o de nível mais alto). */
function comumPeloSlug(slug) {
  let achado = null;
  for (const a of Object.values(C.areas)) for (const m of a.monstros ?? []) if (m.slug === slug && !m.unico && (!achado || m.nivel > achado.nivel)) achado = m;
  return achado;
}
/** As chaves do bestiário dos `slugs`, no nível do `tier` (registradas uma vez — `Monstros.registrar`). */
export function chavesNoTier(slugs, tier) {
  const nivel = Mapas.nivelDoTier(tier);
  const nativos = DO_TIER.get(Number(tier))?.nativos ?? [];
  return (slugs ?? []).map((slug) => comumPeloSlug(slug)).filter(Boolean).map((m, i) => Monstros.registrar(noNivel(m, nivel), nativos[i % Math.max(1, nativos.length)] ?? 'skeleton'));
}
/**
 * Os spawns da instância com os HABITANTES do mapa (`habitantes`: `{ esqueletos, lunaris, solaris, totens, variedade }` dos fatores da instância):
 * a quantidade e a raridade de cada spawn ficam; muda quem nasce. Sem habitantes, os spawns como vieram.
 */
export function comHabitantes(spawns, tier, habitantes = {}) {
  const h = habitantes ?? {};
  if (!spawns?.length || !Object.values(h).some((v) => v > 0)) return spawns;
  let base = ['esqueletos', 'lunaris', 'solaris'].filter((g) => h[g] > 0).flatMap((g) => chavesNoTier(HABITANTES[g], tier));
  if (!base.length) base = [...comunsDoTier(tier)];
  // (a variedade: os comuns de dois outros tiers — os do meio do caminho, sempre os mesmos para o tier — no nível deste)
  if (h.variedade > 0) for (const outro of [((tier + 4) % 16) + 1, ((tier + 9) % 16) + 1]) base.push(...chavesNoTier((C.areas[CONFIG.porTier?.find((t) => Number(t.tier) === outro)?.area]?.monstros ?? []).filter((m) => !m.unico).map((m) => m.slug), tier));
  const totens = h.totens > 0 ? chavesNoTier(HABITANTES.totens, tier) : [];
  if (!base.length) return spawns;
  return spawns.map((s, i) => ({ ...s, criaturas: [{ key: totens.length && i % 2 === 1 ? totens[Math.floor(i / 2) % totens.length] : base[i % base.length], peso: 1 }] }));
}

// ---------------------------------------------------------------- as ONDAS do Julgamento do Covarde (08/11)

/**
 * O JULGAMENTO DO COVARDE: "Contém ondas de Monstros" e as "ondas adicionais" de cada tipo (Mortos-Vivos, Fantasmas, Zumbis Oriatianos, Espíritos,
 * Espíritos Furiosos, Rhoas de Osso, Mandíbulas Devastadoras, Zumbis). No PoE o mapa é um caminho de ondas, sem os grupos de sempre: aqui a
 * área não tem os grupos nem o chefe (`cacadas.povoar`), e a SOBREVIVÊNCIA (o motor de ondas — `encontros/ondas.mjs`) perto da entrada é a
 * área: obrigatória, ela segura a limpeza até a última onda. A campanha do PoE não tem Fantasmas, Espíritos nem Zumbis com esse nome: cada
 * tipo usa o morto-vivo da campanha mais perto dele (os Espectros, os Mortos de Oriath e de Wraeclast); os Espíritos Furiosos vêm Mágicos.
 */
export const GRUPOS_DAS_ONDAS = Object.freeze({
  mortosVivos: { slugs: ['Undead_Vaal_Guard', 'Undead_Vaal_Archer', 'Undead_Vaal_Bladedancer', 'Experimented_Dead'] },
  fantasmas: { slugs: ['Dockhand_Wraith'] },
  zumbisOriatianos: { slugs: ['Noble_Dead'] },
  espiritos: { slugs: ['Labourer_Wraith'] },
  espiritosFuriosos: { slugs: ['Labourer_Wraith'], raridade: 'modificado' },
  rhoasDeOsso: { slugs: ['Bone_Rhoa'] },
  mandibulas: { slugs: ['Devourer'] },
  zumbis: { slugs: ['Dripping_Dead', 'Disbanded_Dead', 'Ghoul'] },
});
export const ONDAS_DO_COVARDE = 10;
/** As ondas: os grupos que o mapa tem (`grupos` — 'monstros' são os comuns do tier), revezando, cada vez com mais monstros (até o teto da onda). */
export function ondasDoMapa(grupos, tier, { ondas = ONDAS_DO_COVARDE, teto = 10 } = {}) {
  const tipos = (grupos ?? []).map((g) => (g === 'monstros' ? { chaves: comunsDoTier(tier) } : GRUPOS_DAS_ONDAS[g] ? { chaves: chavesNoTier(GRUPOS_DAS_ONDAS[g].slugs, tier), raridade: GRUPOS_DAS_ONDAS[g].raridade } : null)).filter((x) => x?.chaves.length);
  const lista = [];
  for (let i = 0; i < ondas && tipos.length; i++) {
    // a onda: o tipo da vez e o seguinte, de 4 a `teto` monstros (cresce a cada onda)
    const total = Math.min(teto, 4 + Math.floor((i * (teto - 4)) / Math.max(1, ondas - 1)));
    const daVez = [tipos[i % tipos.length], tipos[(i + 1) % tipos.length]].filter((t, k, a) => a.indexOf(t) === k);
    const criaturas = [];
    for (let k = 0; k < total; k++) {
      const t = daVez[k % daVez.length];
      const key = t.chaves[(i + k) % t.chaves.length];
      const c = criaturas.find((x) => x.key === key);
      if (c && c.qtd < 8) c.qtd++;
      else if (!c) criaturas.push({ key, qtd: 1 });
    }
    const raridade = daVez.find((t) => t.raridade)?.raridade ?? null;
    lista.push({ criaturas, ...(raridade ? { raridade } : {}) });
  }
  return lista;
}
/** Põe a sobrevivência do mapa na instância (perto da entrada, a 4–9 casas dela). Devolve o encontro, ou null. */
export function porOndasNaInstancia(instancia, { grade, inicio, grupos, tier, alcancaveis, nome = 'O Julgamento', rng = Math.random } = {}) {
  const ondas = ondasDoMapa(grupos, tier);
  if (!instancia || !ondas.length || !inicio) return null;
  const z = inicio.z ?? grade?.z ?? 0;
  const perto = [...(alcancaveis?.get(z) ?? [])].map((k) => k.split(',').map(Number)).filter(([x, y]) => { const d = Math.max(Math.abs(x - inicio.x), Math.abs(y - inicio.y)); return d >= 4 && d <= 9; });
  if (!perto.length) return null;
  const [x, y] = perto[Math.floor(rng() * perto.length)];
  const e = { id: 'ondas-do-mapa', defId: 'sobrevivencia', tipo: 'sobrevivencia', nome, estado: 'disponivel', disponivelEm: 0, tentativas: 0, obrigatorio: true, condicao: { tipo: 'sempre' }, x, y, z, ondas, pausaMs: 3000 };
  (instancia.encontros ??= {})[e.id] = e;
  return e;
}

