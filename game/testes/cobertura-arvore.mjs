// A COBERTURA DE TESTES dos modificadores da árvore de passivas do PoE (auditoria da árvore, 09/10). Duas coisas, no mesmo lugar:
//
//   MEDIDAS        — para cada atributo, ONDE medir na ficha efetiva (`Ficha.combate`, a vida máxima, o golpe) e o número ESPERADO. O teste
//                    `passivas-poe-cobertura.test.mjs` aloca, para cada um, um nó REAL da árvore que tem esse atributo e confere o número —
//                    o "validado por teste" do inventário (`tools/auditar-arvore-passivas.mjs`) é o que está aqui E passa.
//   CONDICOES / ESCALAS / EVENTOS — as condições, escalas e eventos com teste próprio (o arquivo citado), que completam a validação de uma
//                    chave condicional (`block@comEscudo` = o `block` daqui + o `comEscudo` com teste).
//
// Uma medida: `{ preparar?(e), medir(ctx) → número, esperado(antes, valor, ctx) → número, tolerancia? }`, `ctx = { e, f (a ficha), af (a
// soma), pct(...chaves) (a soma dessas chaves de %), golpe(tags) (a ficha do golpe) }`.
import * as R from '../systems/regras.mjs';

const PECA_COM_DEFESAS = { id: 3357, count: 1, base: { armor: [400, 400], evasion: [400, 400], es: [400, 400] }, poe: { classe: 'Body_Armours', base: 'Body_Armours/X', af: {}, prefixos: [], sufixos: [], implicitos: [] } };
const ESCUDO = { id: 3357, count: 1, poe: { classe: 'Shields', base: 'Shields/X', af: {}, prefixos: [], sufixos: [], implicitos: [] } };
const soma = (antes, valor) => antes + valor;
/** A razão de um "aumentado em %": o número × (1 + (p + v)/100) / (1 + p/100). */
const razao = (chaves) => (antes, valor, ctx) => (antes * (1 + (ctx.pct(...chaves) + valor) / 100)) / (1 + ctx.pct(...chaves) / 100);

export const MEDIDAS = {
  // atributos
  str: { medir: ({ f }) => f.atributos.str, esperado: soma },
  dex: { medir: ({ f }) => f.atributos.dex, esperado: soma },
  int: { medir: ({ f }) => f.atributos.int, esperado: soma },
  // vida e mana (máximas, refeitas pelo servidor depois de mudar a árvore)
  'stat:life': { medir: ({ e }) => e.maxHp, esperado: razao(['stat:life', 'life_inc']), tolerancia: 1 },
  'stat:mana': { medir: ({ e }) => e.maxMana, esperado: razao(['stat:mana', 'mana_inc']), tolerancia: 1 },
  life: { medir: ({ e }) => e.maxHp, esperado: (antes, v, ctx) => antes + v * (1 + ctx.pct('stat:life', 'life_inc') / 100), tolerancia: 1 },
  // defesas (sobre a peça vestida)
  armour_pct: { preparar: (e) => { e.equipment = { body: structuredClone(PECA_COM_DEFESAS) }; }, medir: ({ f }) => f.armor, esperado: razao(['armour_pct']), tolerancia: 1 },
  evasion_pct: { preparar: (e) => { e.equipment = { body: structuredClone(PECA_COM_DEFESAS) }; }, medir: ({ f }) => f.evasion, esperado: razao(['evasion_pct', 'atr:evasaoPct']), tolerancia: 1 },
  es_pct: { preparar: (e) => { e.equipment = { body: structuredClone(PECA_COM_DEFESAS) }; }, medir: ({ f }) => f.energyShield, esperado: razao(['es_pct', 'atr:energyShieldPct']), tolerancia: 1 },
  'block@comEscudo': { preparar: (e) => { e.equipment = { shield: structuredClone(ESCUDO) }; }, medir: ({ f }) => Math.round(f.blockChance * 1000) / 10, esperado: soma, tolerancia: 0.05 },
  // resistências (abaixo do teto)
  fire_res: { medir: ({ f }) => f.protection.fire, esperado: soma },
  ice_res: { medir: ({ f }) => f.protection.ice, esperado: soma },
  energy_res: { medir: ({ f }) => f.protection.energy, esperado: soma },
  chaos_res: { medir: ({ f }) => f.protection.chaos, esperado: soma },
  // dano (aumentado) — o "Dano de Fogo aumentado" entra no % do elemento
  fire_dmg: { medir: ({ f }) => f.danoDoElemento.fire, esperado: soma },
  ice_dmg: { medir: ({ f }) => f.danoDoElemento.ice, esperado: soma },
  energy_dmg: { medir: ({ f }) => f.danoDoElemento.energy, esperado: soma },
  phys_dmg: { medir: ({ f }) => f.danoDoElemento.physical, esperado: soma },
  'dmg_inc@corpo': { medir: ({ golpe }) => golpe(['ataque', 'corpo']).danoDoElemento.physical, esperado: soma },
  'dmg_inc@projetil': { medir: ({ golpe }) => golpe(['ataque', 'projetil']).danoDoElemento.physical, esperado: soma },
  'dmg_inc@ataque': { medir: ({ golpe }) => golpe(['ataque']).danoDoElemento.physical, esperado: soma },
  'dmg_inc@area': { medir: ({ golpe }) => golpe(['area']).danoDoElemento.physical, esperado: soma },
  // velocidade, crítico, precisão
  atk_speed: { medir: ({ f }) => f.intervaloDoGolpeMs, esperado: (antes, v, ctx) => (antes * (1 + ctx.pct('atk_speed', 'atr:velocidadeDeAtaquePct') / 100)) / (1 + (ctx.pct('atk_speed', 'atr:velocidadeDeAtaquePct') + v) / 100), tolerancia: 1 },
  cast_speed: { medir: ({ f }) => f.castSpeed, esperado: soma },
  // (o movimento: a base do level × (1 + %); a ficha arredonda)
  move_speed: { medir: ({ f }) => f.speed, esperado: (antes, v, ctx) => antes + (R.baseSpeed(ctx.e.level ?? 1) * v) / 100, tolerancia: 1 },
  crit_chance_inc: { medir: ({ f }) => f.critInc, esperado: soma },
  crit_dmg: { medir: ({ f }) => Math.round(f.critMultiplier * 1000) / 1000, esperado: (antes, v) => Math.round((antes + v / 100) * 1000) / 1000 },
  accuracy: { medir: ({ f }) => f.accuracy, esperado: (antes, v, ctx) => antes + v * (1 + ctx.pct('stat:accuracy', 'accuracy_inc') / 100), tolerancia: 1 },
  'stat:accuracy': { medir: ({ f }) => f.accuracy, esperado: razao(['stat:accuracy', 'accuracy_inc']), tolerancia: 1 },
  // recuperação
  life_regen_max_pct: { medir: ({ f }) => f.regenPoe.vidaPctDoMax, esperado: soma },
  mana_regen_pct: { medir: ({ f }) => f.regenPoe.manaAumentada, esperado: soma },
  life_leech: { medir: ({ f }) => Math.round(f.lifeLeech * 10000) / 100, esperado: soma, tolerancia: 0.001 },
  es_recharge: { medir: ({ f }) => f.esRecargaPct, esperado: soma },
  // AFECÇÕES (o que a ficha entrega ao acerto — `ficha.afeccoes`, de `AfeccoesPoe.daSoma`; o dano contínuo aplicado no monstro está em
  // passivas-poe-afeccoes.test.mjs)
  dot_dmg_inc: { medir: ({ f }) => f.afeccoes.danoAumentado, esperado: soma },
  chance_ignite: { medir: ({ f }) => f.afeccoes.chance.incendio, esperado: soma },
  chance_freeze: { medir: ({ f }) => f.afeccoes.chance.congelamento, esperado: soma },
  chance_shock: { medir: ({ f }) => f.afeccoes.chance.eletrizacao, esperado: soma },
  chance_poison: { medir: ({ f }) => f.afeccoes.chance.veneno, esperado: soma },
  chance_bleed_ataque: { medir: ({ f }) => f.afeccoes.chanceAtaque.sangramento, esperado: soma },
  chance_poison_ataque: { medir: ({ f }) => f.afeccoes.chanceAtaque.veneno, esperado: soma },
  dot_multi: { medir: ({ f }) => f.afeccoes.multiplicador, esperado: soma },
  dot_multi_fire: { medir: ({ f }) => f.afeccoes.multiplicadorFogo, esperado: soma },
  dot_multi_poison: { medir: ({ f }) => f.afeccoes.multiplicadorVeneno, esperado: soma },
  dot_multi_bleed: { medir: ({ f }) => f.afeccoes.multiplicadorSangramento, esperado: soma },
  efeito_resfriamento: { medir: ({ f }) => f.afeccoes.efeitoResfriamento, esperado: soma },
  efeito_eletrizacao: { medir: ({ f }) => f.afeccoes.efeitoEletrizacao, esperado: soma },
  duracao_congelamento: { medir: ({ f }) => f.afeccoes.duracaoCongelamento, esperado: soma },
  // os lidos NO ACERTO (`ModsPoe.valor` da ficha do golpe — o efeito no monstro está em passivas-poe-afeccoes.test.mjs)
  stun_duration: { medir: ({ f }) => Number(f.afPoe.stun_duration) || 0, esperado: soma },
  enemy_stun_threshold_red: { medir: ({ f }) => Number(f.afPoe.enemy_stun_threshold_red) || 0, esperado: soma },
  avoid_elem_ailments: { medir: ({ f }) => Number(f.afPoe.avoid_elem_ailments) || 0, esperado: soma },
};

/** As CONDIÇÕES (de estado e de golpe) com teste próprio — o arquivo que prova. */
export const CONDICOES = {
  comEscudo: 'passivas-poe (bloqueio só com escudo)',
  duasArmas: 'itens-poe-arvore-poedb (Terrores Gêmeos: crítico com duas armas)',
  corpo: 'passivas-poe (golpe corpo × projétil; combate real)',
  projetil: 'passivas-poe (golpe corpo × projétil)',
  ataque: 'passivas-poe; itens-poe-arvore-poedb (escala do escudo só no ataque)',
  alvoVidaBaixa: 'passivas-poe ("mais" contra vida baixa)',
  peitoralSemVida: 'itens-poe-arvore-poedb (lotes 3 e 4)',
  armadurasComEvasao: 'itens-poe-arvore-poedb (lotes 3 e 4)',
  armadurasComArmadura: 'itens-poe-arvore-poedb (lotes 3 e 4)',
  elmoArmaduraMaior: 'itens-poe-arvore-poedb (lote 5)',
  elmoEvasaoMaior: 'itens-poe-arvore-poedb (lote 5)',
  aneisComEvasao: 'itens-poe-arvore-poedb (lote 6)',
  comEscudoDeEnergia: 'itens-poe-arvore-poedb (lote 6)',
  armasDiferentes: 'itens-poe-arvore-poedb (lote 6)',
  runa: 'passivas-poe (tags das gemas)',
  vidaBaixa: 'itens-poe-arvore-poedb (limiar de vida baixa)',
  'maestriasDe:*': 'itens-poe-arvore-poedb (lotes 3 e 4)',
  'atrMin:*': 'itens-poe-arvore-poedb (condições com parâmetro)',
  'atrMaior:*': 'itens-poe-arvore-poedb (condições com parâmetro)',
  'furiaMin:*': 'itens-poe-arvore-poedb (condições com parâmetro)',
  'semCargas:*': 'itens-poe-arvore-poedb (condições com parâmetro)',
  'comCargas:*': 'itens-poe-arvore-poedb (condições com parâmetro)',
};
/** As ESCALAS ("por X") com teste próprio. */
export const ESCALAS = {
  armEvaEscudo: 'itens-poe-arvore-poedb (lote 5)', esEscudo: 'itens-poe-arvore-poedb (lote 5)', bloqueioEscudo: 'itens-poe-arvore-poedb (lote 5)',
  armas: 'itens-poe-arvore-poedb (lote 6)', arautosAtivos: 'itens-poe-arvore-poedb (lote 6)', aurasAtivas: 'itens-poe-arvore-poedb (lotes 3 e 4)',
};
/** Os EVENTOS (evento:ação) com teste próprio. */
export const EVENTOS = {
  'usarFrasco:vidaPct': 'passivas-poe (frascos)', 'usarFrascoMana:removerAfeccao': 'passivas-poe (frascos)', 'critico:frascoChance': 'passivas-poe (frascos)',
  'bloquearMagia:es': 'itens-poe-arvore-poedb (lote 6)',
};
/** As MECÂNICAS (atributos que mudam uma regra, sem número único na ficha) com teste próprio. */
export const MECANICAS = {
  sem_es_da_int: 'passivas-poe-keystones (Solipsismo)', duracao_afeccoes_elementais_propria: 'passivas-poe-keystones (Solipsismo)',
  sem_evasao_da_des: 'passivas-poe-keystones (Terror dos Magos)', spell_suppression: 'passivas-poe-keystones (Terror dos Magos)',
  forca_em_projeteis: 'passivas-poe-keystones (Empunhadura de Ferro)', regen_vida_no_escudo: 'passivas-poe-keystones (Juramento do Zelote)',
  roubo_vida_no_escudo: 'passivas-poe-keystones (Devastador Fantasma)', roubo_teto_es_dobrado: 'passivas-poe-keystones (Devastador Fantasma)',
  sem_recarga_es: 'passivas-poe-keystones (Devastador Fantasma)', bateria_ancia: 'passivas-poe-keystones (Bateria Anciã)',
  es_protege_mana: 'passivas-poe-keystones (Bateria Anciã)', es_recarga_menos: 'passivas-poe-keystones (Bateria Anciã, Proteção Perversa)',
  recarga_nao_interrompida: 'passivas-poe-keystones (Proteção Perversa)', regen_vida_menos: 'passivas-poe-keystones (Juventude Eterna)',
  roubo_teto_vida_menos: 'passivas-poe-keystones (Juventude Eterna)', recarga_es_na_vida: 'passivas-poe-keystones (Juventude Eterna)',
  inicio_extra: 'passivas-poe ("Caminho do Marauder")', pontos_passiva: 'passivas-poe (pontos concedidos)',
  equilibrio_exposicao: 'passivas-poe-keystones (Equilíbrio Elemental)', equilibrio_exposicao_pct: 'passivas-poe-keystones (Equilíbrio Elemental)',
};
ESCALAS.atr = 'passivas-poe-keystones (Solipsismo, Terror dos Magos: "por cada 15 de Int/Des")';
// (as condições de ARMA e o "Dano com Afecções" — passivas-poe-afeccoes.test.mjs: o nó real, a arma na mão, o golpe e o incêndio no monstro)
for (const c of ['comMaca', 'comCetro', 'comMachado', 'comEspada', 'comAdaga', 'comGarra', 'comArco', 'comVarinha', 'comCajado']) CONDICOES[c] = 'passivas-poe-afeccoes (condições de arma, golpe de ataque)';
MECANICAS.ailment_dmg_inc = 'passivas-poe-afeccoes (o incêndio posto no monstro sobe na razão exata)';
MECANICAS.duracao_maldicao = 'passivas-poe-afeccoes (a marca da maldição no monstro dura mais)';
// (os LACAIOS — passivas-poe-lacaios.test.mjs: o nó real → a soma do dono → os zumbis invocados pela caçada)
MECANICAS.max_lacaio = 'passivas-poe-lacaios (a caçada invoca o lacaio a mais)';
MECANICAS.minion_life = 'passivas-poe-lacaios (a vida do lacaio invocado)';
MECANICAS.minion_dmg = 'passivas-poe-lacaios (o dano do lacaio invocado)';
// (CARGAS e FÚRIA — passivas-poe-cargas.test.mjs: o nó real → as cargas/Fúria guardadas na caçada)
for (const k of ['max_frenesi', 'max_poder', 'max_tolerancia', 'duracao_frenesi', 'furia_max', 'furia_perda_lenta', 'furia_por_acerto']) MECANICAS[k] = 'passivas-poe-cargas';
// (os FRASCOS — passivas-poe-frascos.test.mjs: o nó real → o frasco no cinto → usar/tique/abate)
for (const k of ['frasco_vida_rec', 'frasco_duracao', 'frasco_cargas_recebidas', 'frasco_regen_n', 'frasco_regen_s']) MECANICAS[k] = 'passivas-poe-frascos';
