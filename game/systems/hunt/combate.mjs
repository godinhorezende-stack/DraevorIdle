// O combate da caçada: golpe do personagem (arma, wand, tiro, elemento), golpe dos bichos, mortes, loot e level.
// Parte de `cacadas.mjs` (dividido em 2026-09-25); a fachada continua lá.
import * as Mecanicas from '../mobs/mecanicas.mjs';
import * as BuffsDeMob from '../mobs/buffs.mjs';
import { ITEM_CATALOG, CATALOGO } from '../dados.mjs';
import * as Progressao from '../progressao.mjs';
import * as R from '../regras.mjs';
import { VALOR_DA_MOEDA, pesoDoInventario } from '../inventario.mjs';
import * as Acoes from '../acoes.mjs';
import * as Treino from '../treino.mjs';
import * as Setores from './setores.mjs';
import { partesDeXp, dividirOuro, proximoInicioDoResto, sortearDono, novoIdDeDrop, registrarSorteio } from '../party-recompensas.mjs';
import * as Bolsa from '../bolsa.mjs';
import * as Ficha from '../ficha.mjs';
import { temHabilidade } from '../passivas/arvore.mjs';
import * as AfeccoesPoe from '../itens-poe/afeccoes.mjs';
import { ligado as itensPoeLigado } from '../itens-poe/catalogo.mjs';
import { metaDaPeca } from '../itens/item.mjs';
import * as Bau from '../bau.mjs';
import * as Equipamento from '../itens/equipamento.mjs';
import * as Boosts from '../boosts.mjs';
import * as BuffPower from '../buffpower.mjs';
import * as Tiers from '../tiers.mjs';
import * as Afixos from '../afixos.mjs';
import * as DropsDoSite from '../drops-do-site.mjs';
import { nomeDaHunt, huntOuMapaCustom } from './terreno.mjs';
import { pecasGarantidas } from '../itens/equipamento-do-boss.mjs';
import { gerarItem } from '../itens/gerar.mjs';
import * as EfeitosDeItem from '../itens/efeitos.mjs';
import * as Campanha from '../campanha.mjs';
import * as DropsPorMonstro from '../itens-poe/drops-por-monstro.mjs';
import * as RecompensasDeEncontro from '../encontros/recompensas.mjs';
import * as EventosDeEncontro from '../encontros/eventos.mjs';
import * as Prey from '../prey.mjs';
import * as Arvore from '../arvore.mjs';
import * as Bosses from '../bosses.mjs';
import * as Poderes from '../poderes.mjs';
import * as BossesUnicos from '../bosses-unicos/boss.mjs';
import * as Reforcos from '../skills/reforcos.mjs';
import * as Estados from '../skills/estados.mjs';
import * as Gemas from '../gemas.mjs';
import * as Charms from '../charms.mjs';
import * as ItensPoeJogo from '../itens-poe/jogo.mjs';
import * as MoedasPoe from '../itens-poe/moedas.mjs';
import * as Pinaculos from '../itens-poe/pinaculos.mjs';
import { tipoDoBicho } from './escalonamento.mjs';
import * as AtributosDoPersonagem from '../personagem/atributos.mjs';
import * as Tarefas from '../tarefas.mjs';
import { BESTIARY, RESPAWN_MS } from './monstros.mjs';

/**
 * O ITEM LEVEL do drop do PoE = o nível do monstro (regra do dono, 05/10: bicho nível 11 não solta mod de iLvl 23). O monstro do PoE tem
 * o nível dele no bestiário; os outros, o da fase. Os níveis a mais da raridade do Draevor (`levelExtra`) não sobem o iLvl.
 */
export const nivelDoDropPoe = (hunt, alvo) => BESTIARY[alvo?.key]?.poe?.nivel ?? hunt?.escala?.nivel ?? AtributosDoPersonagem.levelDoBicho(hunt, { ...alvo, levelExtra: 0 });
import { resistido, resistenciaEfetivaDe, resistenciaDe } from './resistencia.mjs';
import * as ModsPoe from '../itens-poe/mods-poe.mjs';
import { registrarGolpe } from '../combate/registro.mjs';
import * as Limites from '../combate/limites.mjs';
import * as Formulas from '../combate/formulas.mjs';
import * as Controle from '../combate/controle.mjs';
import * as AtributosDoMob from '../mobs/atributos.mjs';
import * as Dot from '../combate/dot.mjs';
import { distancia } from './caminho.mjs';
import { tirarMonstro, salaDe } from './sala.mjs';
import { alvoAtual } from './alvo.mjs';
import * as Defesa from '../personagem/defesa.mjs';
import * as Anuncios from '../anuncios.mjs';
import * as Tags from '../skills/tags.mjs';
import * as GemasDeSkill from '../skills/gemas.mjs';
import * as CargasPoe from '../itens-poe/cargas.mjs';
import * as FrascosPoe from '../itens-poe/frascos.mjs';

/** Depois de qualquer dano de ação (magia/runa) — mata e dá loot de quem chegou a 0. */
export function processarMortes(estado, personagem, eventos) {
  const hunt = estado.hunt;
  if (!hunt) return;
  for (const m of [...hunt.monstros]) {
    if (m.dummy) {
      m.hp = m.maxHp; // o boneco do pátio não morre
      continue;
    }
    if (m.hp > 0) continue;
    // Os CADÁVERES recentes (o Erguer Espectro do PoE ergue o último): o tipo do bicho, o desenho e onde caiu.
    if (!m.boss) {
      hunt.cadaveres = [...(hunt.cadaveres ?? []), { key: m.key, nome: m.name, look: m.look, lookItem: m.lookItem ?? 0, colors: m.colors ?? null, x: m.x, y: m.y }].slice(-10);
    }
    matarMonstro(estado, hunt, personagem, m, eventos);
  }
}

/** Soma real do `armor` de cada peça vestida (ver `item-catalog.json` — o `defense` do escudo é outra conta, ainda não ligada). */
/*
 * A armadura que corta o golpe do bicho: a da FICHA — a das peças (catálogo)
 * + o atributo "Armadura" (`armor_flat`). Antes somava só o catálogo e o
 * atributo aparecia na ficha sem cortar nada (auditoria dos atributos, 29/09).
 */
export function armorDoPersonagem(estado) {
  return Ficha.combate(estado).armor ?? 0;
}

/** O ML de BÔNUS (itens, proficiência, imbuement): +1% de dano/cura por ponto em magia, runa e wand (decisão do dono). */
export const bonusDeMagicLevel = (ficha) => ficha?.skillBonus?.magic ?? 0;

export function armaDoPersonagem(estado) {
  // Com o ataque que a peça sorteou no drop (`p.base`), não o valor cheio do catálogo.
  return metaDaPeca(estado.equipment?.weapon) ?? null;
}

/*
 * ---- Nem toda arma bate corpo a corpo ----
 *
 * "criei um druid e n ta dando atk magico, cada classe tem um dano
 * especifico" — e tinha razão: o golpe básico sempre usava `R.golpeDoJogador`
 * (a fórmula de arma FÍSICA), mesmo pro sorcerer/druid, cuja arma inicial é
 * um wand/rod (`item-catalog.json`: `wand:{min,max,element,mana}`, SEM
 * `attack` nenhum) — o golpe saía sempre no piso mínimo, porque `attack: 0`.
 * O spear inicial do paladin tem o mesmo problema pela metade: tem `attack`
 * (então não saía zerado), mas é arma de distância (`range:3`) e o round só
 * golpeava com o bicho adjacente, obrigando o paladino a andar pro corpo a
 * corpo em vez de atirar de longe.
 */
export function categoriaDaArma(arma) {
  if (arma?.wand) return 'magica';
  if (arma?.skill === 'distance') return 'distancia';
  return 'melee';
}

export function alcanceDaArma(arma, estado = null) {
  // + o "alcance" da proficiência (arco, besta, wand), com a arma na mão. PoE: "+N metros ao Alcance de Golpes Corpo a Corpo" (1 casa = 2 m).
  return categoriaDaArma(arma) === 'melee' ? 1 + (estado ? Ficha.combate(estado).alcanceCorpoExtra ?? 0 : 0) : (arma?.range ?? 3);
}

/*
 * O `shoot` do item é o NOME real do projétil (`items.xml` do OTServ) — o
 * atlas capturado (`missile-sprites.json`) é indexado pelo id numérico
 * (`CONST_ANI_*`). A tabela inteira do OTServ, conferida contra os
 * `projetil` REAIS do `action-catalog.json` capturado (ethereal spear 28,
 * sudden death 32, explosion 41, earth 30, smallholy 38...) — do 1 ao 42.
 */
export const ID_DO_TIRO = {
  spear: 1, bolt: 2, arrow: 3, fire: 4, energy: 5, poisonarrow: 6, burstarrow: 7,
  throwingstar: 8, throwingknife: 9, smallstone: 10, death: 11, largerock: 12,
  snowball: 13, powerbolt: 14, poison: 15, infernalbolt: 16, huntingspear: 17,
  enchantedspear: 18, redstar: 19, greenstar: 20, royalspear: 21, sniperarrow: 22,
  onyxarrow: 23, piercingbolt: 24, whirlwindsword: 25, whirlwindaxe: 26,
  whirlwindclub: 27, etherealspear: 28, ice: 29, earth: 30, holy: 31,
  suddendeath: 32, flasharrow: 33, flammingarrow: 34, shiverarrow: 35,
  energyball: 36, smallice: 37, smallholy: 38, smallearth: 39, eartharrow: 40,
  explosion: 41, cake: 42,
};
// Do 43 em diante a numeração muda entre versões do OTServ e o atlas só tem
// 56 — em vez de chutar, essas munições novas (tarsal, vortex, prismatic,
// diamond, spectral, leaf/royal star...) usam o projétil do TIPO delas.
export const TIRO_DO_TIPO = { arrow: 3, bolt: 2, star: 8, spear: 1 };

/** O projétil do golpe: arco/besta atiram a munição do slot `ammo`; o resto, o próprio `shoot`. */
export function tiroDaArma(estado, arma) {
  const municao = arma?.ammo ? ITEM_CATALOG[estado.equipment?.ammo?.id] : null;
  const nome = (municao?.ammo === arma?.ammo ? municao?.shoot : null) ?? arma?.shoot ?? '';
  const tipo = arma?.ammo ?? (/star$/.test(nome) ? 'star' : /spear$/.test(nome) ? 'spear' : /bolt$/.test(nome) ? 'bolt' : 'arrow');
  return ID_DO_TIRO[nome] ?? TIRO_DO_TIPO[tipo];
}

/*
 * O efeito de IMPACTO de cada elemento — os `efeito` REAIS das magias de alvo
 * único do `action-catalog.json` capturado (Energy/Flame/Ice/Terra/Death
 * Strike, Divine Missile). Antes a wand/rod usava sempre o 13, que é o brilho
 * azul de cura: o golpe da rod parecia o monstro se curando.
 */
export const EFEITO_DO_ELEMENTO = { energy: 38, fire: 37, ice: 44, earth: 47, death: 18, holy: 40, physical: 1 };

/** Golpe de wand/rod: dano REAL do próprio item (`wand.min/max`), sem fórmula — não precisa de magic level pra isso. */
export function golpeDaWand(estado, hunt, alvo, arma, eventos, personagem, segundo = false) {
  // O 2º golpe do ataque duplo (`segundo`) não gasta mana nem treina, e não dá roubo de vida/mana (ver `round`).
  const custo = segundo ? 0 : arma.wand.mana ?? 0;
  if ((estado.mana ?? 0) < custo) return false; // sem mana: fica sem golpe este round, não cai pro físico (simplificação, ver comentário do arquivo)
  estado.mana -= custo;
  if (!segundo) Treino.gastarMana(estado, custo);
  // O Ocultista (cargas do PoE): Carga de Poder a cada N de mana gasta.
  const regrasDasCargas = Ficha.combate(estado).cargas;
  if (regrasDasCargas && CargasPoe.aoGastarMana(estado, regrasDasCargas, custo).length) Ficha.invalidar(estado);
  // O dano do golpe da wand/rod é o "Dano" da ficha (Magic Attack + Magic Level + level), como o golpe físico; o elemento é o da arma.
  const { element } = arma.wand;
  const { min, max } = Ficha.combate(estado).damage;
  eventos.push({ t: 'shot', id: ID_DO_TIRO[arma.shoot] ?? 5, x: hunt.pos.x, y: hunt.pos.y, tx: alvo.x, ty: alvo.y });
  eventos.push({ t: 'fx', id: EFEITO_DO_ELEMENTO[element] ?? 13, uid: alvo.uid, x: alvo.x, y: alvo.y });
  // A ficha do golpe básico: + crítico de auto-ataque da proficiência.
  const ficha = Ficha.combate(estado);
  // Accuracy: o tiro pode errar (a mana já foi gasta, como um golpe no ar).
  if (Defesa.errou(ficha, hunt, alvo)) {
    eventos.push({ t: 'block', uid: alvo.uid, x: alvo.x, y: alvo.y, color: '#999999', esquiva: true, errou: true });
    return true;
  }
  // O bicho BLOQUEIA o tiro (só quem tem bloqueio configurado): sem dano.
  if (AtributosDoMob.bloqueou(alvo)) {
    eventos.push({ t: 'block', uid: alvo.uid, x: alvo.x, y: alvo.y, color: '#999999', bloqueado: true });
    return true;
  }
  // "Dano de <elemento>" (afixo) na wand/rod do mesmo elemento, + o ML de bônus
  // (+1%/ponto) e o dano mágico do INT; + "% da perícia como dano" (proficiência); e a resistência do
  // bicho àquele elemento (`resistido`).
  const bruto = (min + Math.floor(Math.random() * (max - min + 1))) * (segundo ? Limites.LIMITES.ataqueDuplo.danoDoSegundoGolpePct / 100 : 1) * (1 + ((ficha.danoDoElemento?.[element] ?? 0) + bonusDeMagicLevel(ficha) + (ficha.danoDeMagia ?? 0) + Ficha.afinidadePara(ficha, Tags.tagsDoGolpe('magica', element)).pct) / 100);
  const base = resistido(hunt, alvo, element, bruto, ficha);
  const { dano: golpe, crit, onslaught, chance } = Ficha.rolarCritico(estado, base, alvo, eventos, ficha);
  alvo.hp -= golpe;
  registrarGolpe(() => ({ origem: segundo ? 'wand-2o-golpe' : 'wand', alvo: alvo.name, tipo: element, danoAntesDaResistencia: Math.round(bruto), resistenciaDoAlvo: resistenciaDe(hunt, alvo, element), penetracao: ficha.penetracao, resistenciaEfetiva: resistenciaEfetivaDe(hunt, alvo, element, ficha), danoAposResistencia: base, chanceCritica: chance, critico: crit, danoFinal: golpe, vidaRestante: Math.max(0, alvo.hp) }));
  eventos.push({ t: 'dmg', uid: alvo.uid, x: alvo.x, y: alvo.y, v: golpe, foe: true, crit, onslaught, alvo: alvo.name, color: Acoes.COR_DO_ELEMENTO[element] ?? '#ff0000' });
  // As mecânicas do mob que reagem ao dano (Endurecido, Espelhado... — `mobs/mecanicas.mjs`).
  Mecanicas.aoReceberDano(estado, hunt, personagem, alvo, golpe, element, eventos);
  // As cargas do PoE no acerto da varinha (Poder no crítico, no crítico com varinhas, no acerto não crítico...).
  if (CargasPoe.reageAoAcerto(ficha.cargas) && CargasPoe.aoAcertar(estado, ficha.cargas, alvo, { crit, varinha: true }).length) Ficha.invalidar(estado);
  if (!segundo) {
    Ficha.aplicarLeech(estado, golpe, eventos, personagem?.nome, hunt.pos, ficha, alvo.key);
    Charms.aoAcertar(estado, hunt, alvo, eventos);
  }
  return true;
}

/**
 * Um round de combate corpo a corpo — chamado a cada `R.PASSO_MS`, igual ao
 * passo. Golpe do jogador usa a fórmula real (`R.golpeDoJogador`); o troco do
 * bicho usa a aproximação documentada em `R.ataqueDoMonstro`/`R.danoRecebido`.
 * Devolve os eventos reais que o cliente sabe desenhar (mesmo formato
 * capturado ao vivo — ver `api-mapeada/captura-combate-real.json`).
 */
/*
 * Quantas moedas caem. O bestiary real só tem a CHANCE de cada item, não a
 * quantidade. Calibrado no dado real que temos: 7.618 Trolls mortos pelo Zotod
 * renderam 147.036 de ouro (19,3 por Troll, que dá 20 de exp), com drops
 * vistos de 6, 12 e 24. Aproximação: média = a exp do bicho, sorteada de 1 a
 * 2x — não é a tabela real, que o servidor original nunca manda.
 */
/**
 * Level pela fórmula real (`levelFromExp`, formulas.mjs). Subindo, a vida e a
 * mana máximas crescem pela fórmula da vocação e o que já tinha sobe junto
 * (como no Tibia: o level novo não cura, soma a diferença).
 */
/**
 * O inverso do `subirDeLevel`, para a morte (`Morte.morrer`): a experiência
 * caiu abaixo do level, e vida/mana máximas voltam às do level novo (com os
 * bônus de afixos, árvore e gemas refeitos por cima). A vida atual é tratada por
 * quem chamou — a morte devolve o personagem na cidade de vida cheia.
 */
export function descerDeLevel(estado) {
  const novo = Math.max(1, R.levelFromExp(estado.xp ?? 0));
  if (!(novo < (estado.level ?? 0))) return;
  refazerMaximos(estado, novo);
  estado.hp = Math.min(estado.hp ?? 0, estado.maxHp);
  estado.mana = Math.min(estado.mana ?? 0, estado.maxMana);
}

/**
 * Vida/mana máximas do level `novo`: a base + os 3000 do Buff Power, e os
 * bônus de afixos, árvore e gemas refeitos por cima. Os três marcadores
 * (`afixoMax`, `arvoreMax`, `gemasMax`) são zerados antes: sem isso o
 * `sincronizarMaximos` de cada um achava que o bônus ainda estava no máximo
 * (que acabou de ser refeito) e não punha de novo — a vida das gemas sumia a
 * cada level up.
 */
/** Põe o personagem num level (a Arena x1 nivela os dois lados), com vida e mana máximas refeitas. */
export const definirLevel = (estado, novo) => refazerMaximos(estado, novo);

export function refazerMaximos(estado, novo) {
  const { maxHp, maxMana } = R.statsBase(estado.vocation, novo);
  estado.level = novo;
  estado.maxHp = maxHp + BuffPower.bonusDeVida(estado);
  estado.maxMana = maxMana + BuffPower.bonusDeVida(estado);
  estado.afixoMax = { hp: 0, mana: 0 };
  Afixos.sincronizarMaximos(estado);
  estado.arvoreMax = { hp: 0, mana: 0 };
  Arvore.recalcularVida(estado);
  estado.gemasMax = { hp: 0, mana: 0 };
  Gemas.sincronizarMaximos(estado);
}

export function subirDeLevel(estado) {
  const novo = R.levelFromExp(estado.xp ?? 0);
  if (!(novo > (estado.level ?? 0))) return;
  const { maxHp, maxMana } = R.statsBase(estado.vocation, novo);
  // O level novo soma na vida/mana ATUAL só o que a BASE cresceu. (Antes a conta
  // era "base nova − máximo antigo", e o máximo antigo inclui afixos, árvore e
  // gemas: a cada level a vida atual CAÍA o tamanho desses bônus.)
  const antes = R.statsBase(estado.vocation, estado.level ?? novo);
  estado.hp = (estado.hp ?? 0) + (maxHp - antes.maxHp);
  estado.mana = (estado.mana ?? 0) + (maxMana - antes.maxMana);
  refazerMaximos(estado, novo);
}

export function quantasMoedas(bicho, id, estado = null) {
  if (id !== 3031) return 1;
  const media = Math.max(1, bicho.expDasMoedas ?? bicho.exp ?? 10);
  // "Gold Find" (add): mais moedas no mesmo drop.
  const achado = 1 + (estado ? Ficha.combate(estado).goldFind ?? 0 : 0) / 100;
  return Math.max(1, Math.round((1 + Math.floor(Math.random() * (2 * media - 1))) * achado));
}

/*
 * ---- Boss derrotado ----
 *
 * Como no original: o loot vai para uma SACOLA no Baú de Boss (não para a
 * bolsa de loot, que se vende sozinha), a recarga do boss começa
 * (`cooldownHours` do catálogo real) e sai a faixa de vitória (`victory`, com
 * `boss`, `exp` e `loot`). Alguns segundos depois ele volta para a cidade.
 */
/**
 * De onde o drop saiu, para o gerador de itens: na campanha, o ATO e a
 * DIFICULDADE da fase (ou do boss do ato); fora dela (VIP, boss avulso), o
 * level — o ato sai dele e a dificuldade é a padrão (`systems/itens/config.mjs`).
 */
export function contextoDoDrop(hunt) {
  // Item Level = o level da fase onde caiu (decisão do dono; o boss soma o bônus no gerador).
  if (hunt?.campanha) {
    const extra = hunt.escala?.nivel ? { itemLevel: hunt.escala.nivel } : {};
    // As tabelas de raridade são dos atos 1–4: um ato do editor (5 em diante) usa a faixa do level alvo da fase, sem criar tabela nova.
    if (hunt.campanha.ato > Campanha.ATOS) return { level: hunt.escala?.nivel ?? 1, dificuldade: hunt.campanha.dificuldade, ...extra };
    return { ato: hunt.campanha.ato, dificuldade: hunt.campanha.dificuldade, ...extra };
  }
  if (hunt?.isBoss) return { level: CATALOGO.bosses.find((b) => b.id === hunt.bossId)?.level ?? 1 };
  return { level: huntOuMapaCustom(hunt?.huntId)?.level ?? 1 };
}

export function vitoriaNoBoss(estado, hunt, alvo, personagem = null) {
  // A vitória é registrada UMA vez por luta: um evento de morte repetido não paga outra sacola nem conta outra conclusão.
  if (hunt.vitoria) return;
  const itens = [];
  for (const drop of [...alvo.loot, ...Gemas.DROP.boss]) {
    // Buff Power Loot +50%, o afixo "Loot" e a Caça Online ("15% mais chance de loot" na sala do boss).
    if (Math.random() >= drop.chance * BuffPower.fatorDeLoot(estado) * (1 + Afixos.de(estado, 'loot_bonus') / 100) * fatorDaCacaOnline(hunt)) continue;
    // O item inteiro (raridade, atributos, efeito) sai do gerador central.
    if (VALOR_DA_MOEDA[drop.id]) itens.push({ id: drop.id, count: quantasMoedas(alvo, drop.id, estado) });
    else {
      const peca = gerarItem({ itemId: drop.id, ...contextoDoDrop(hunt), boss: true, origem: 'boss' });
      itens.push(peca);
      // Épico para cima na sacola do boss: o anúncio para o servidor inteiro.
      Anuncios.dropRaro({ quem: personagem?.nome ?? null, peca, bicho: alvo.name, boss: true, onde: alvo.name });
    }
  }
  // O boss de fim de Ato (campanha) ACRESCENTA equipamento ao loot: antes só dava tokens, poções e gemas (`itens/equipamento-do-boss.mjs`).
  if (hunt.campanha?.bossDoAto) {
    for (const peca of pecasGarantidas(contextoDoDrop(hunt), estado.vocation)) {
      itens.push(peca);
      Anuncios.dropRaro({ quem: personagem?.nome ?? null, peca, bicho: alvo.name, boss: true, onde: alvo.name });
    }
  }
  // Sistema de itens do PoE (só com ITENS_POE=1): o drop do PoE do boss (raridade do monstro: Único) e, no chefe pináculo, 1 Único
  // da tabela EXCLUSIVA dele (`itens-poe/pinaculos.mjs`). Vão na sacola do boss junto com o resto.
  {
    const quantidade = BuffPower.fatorDeLoot(estado) * (1 + Afixos.de(estado, 'loot_bonus') / 100) * fatorDaCacaOnline(hunt);
    for (const daPoe of ItensPoeJogo.dropsDoMonstro(nivelDoDropPoe(hunt, alvo), tipoDoBicho(alvo), Math.random, undefined, quantidade, raridadeDoDrop(estado, alvo))) {
      itens.push(daPoe);
      // O Único do PoE: o servidor inteiro fica sabendo (chat e faixa do alto — `anuncios.mjs`).
      Anuncios.dropRaro({ quem: personagem?.nome ?? null, peca: daPoe, bicho: alvo.name, boss: true, onde: alvo.name });
    }
    // As moedas do PoE que o boss solta (`itens-poe/moedas.mjs`, `regras.json → moedas.drop`).
    itens.push(...MoedasPoe.dropDoMonstro('boss', Math.random, quantidade));
    if (BESTIARY[alvo.key]?.poe) {
      const ouro = ItensPoeJogo.ouroDoMonstro(nivelDoDropPoe(hunt, alvo), tipoDoBicho(alvo), Math.random, undefined, 1 + (Ficha.combate(estado).goldFind ?? 0) / 100);
      if (ouro > 0) itens.push({ id: 3031, count: ouro });
    }
    const exclusivo = Pinaculos.dropExclusivo(hunt.bossId);
    if (exclusivo) {
      itens.push(exclusivo);
      Anuncios.dropRaro({ quem: personagem?.nome ?? null, peca: exclusivo, bicho: alvo.name, boss: true, onde: alvo.name });
    }
  }
  Bau.novaSacola(estado, alvo.name, itens);
  // O boss de fim de ato (campanha): a primeira vitória libera o ato seguinte.
  if (hunt.campanha?.bossDoAto) {
    Campanha.venceuBoss(estado, hunt.campanha.dificuldade, hunt.campanha.bossDoAto);
    // Ato do editor: a recompensa configurada do boss final (drops a cada vitória; primeira vitória uma vez por personagem).
    const rec = Campanha.recompensaDoBoss(hunt.campanha.bossDoAto);
    if (rec) pagarRecompensaDeAto({ estado, hunt, personagem, recompensa: rec, nome: alvo.name, chave: `boss:${hunt.campanha.bossDoAto}`, dificuldade: hunt.campanha.dificuldade });
  }
  // O cooldown já começou na ENTRADA (`Bosses.marcarEntrada`); aqui o de task fecha.
  Bosses.marcarVitoria(estado, hunt.bossId);
  hunt.vitoria = { boss: alvo.name, exp: alvo.exp, loot: Object.fromEntries(itens.map((i) => [i.id, i.count])) };
  tirarMonstro(hunt, alvo);
  if (hunt.alvo === alvo.uid) hunt.alvo = null;
  hunt.fimEm = (hunt.clock ?? 0) + 5000;
}

// Sem bônus de pódio: mesmo formato de `arena.mjs::SEM_BONUS`, duplicado aqui
// de propósito — este módulo não pode importar `arena.mjs` (sessão, `vivas`,
// banco), é o que permite rodar num worker_thread (Fase 5). `hunt.podio` é
// calculado uma vez por tique em `sessao.mjs` e chega pronto até aqui.
const SEM_PODIO = { exp: 0, loot: 0, lugar: 0 };

/*
 * ---- O bônus da Caça Online ----
 *
 * "Por jogar no braço, a caçada paga 15% a mais de experiência e 15% a mais de
 * chance em cada linha do loot" — a placa da Caça Online (panels.mjs) anuncia
 * `catalog.bonusOnline` (15, capturado do original), mas nenhuma linha do
 * servidor o cobrava: exp e loot online saíam iguais aos da automática.
 *
 * Na exp, é um fator sobre a exp JÁ calculada (level, boosts, premium,
 * stamina, prey, pódio), para ela ser exatamente "15% a mais" do que a mesma
 * morte pagaria na Caça Automática. No loot, multiplica a CHANCE de cada
 * linha, como os outros bônus de loot (Buff Power, afixo, prey, pódio) — "no
 * modo online é 15% mais chance de loot", pedido do dono para a sala de boss.
 *
 * Só vale com `hunt.modo === 'online'`: a caçada offline (`simularAusencia`)
 * roda com o modo trocado para 'auto', e na party cada membro usa o modo da
 * PRÓPRIA caçada (como os outros bônus).
 */
export function fatorDaCacaOnline(hunt) {
  // Modo PoE (dono, 07/10): sem bônus — o manual e o automático são só o jeito de controlar (um interruptor na barra, a qualquer hora).
  if (itensPoeLigado()) return 1;
  return hunt?.modo === 'online' ? 1 + (CATALOGO.bonusOnline ?? 0) / 100 : 1;
}

/*
 * ---- O loot na PARTY: ouro dividido, itens em rodízio ----
 *
 * Medido (4 contas, 30 min em Troll Cave): com "o loot fica com quem matou", o
 * knight — que bate de perto e dá mais golpes finais — levava ~60% do ouro e
 * dos itens, e o paladin ~7%, com a MESMA exp para os quatro. O dono escolheu:
 * ouro igual para todos e itens em rodízio.
 *
 * Vale para quem está na PARTILHA (mesma sala, faixa de level, perto — as
 * mesmas regras da exp). O ouro de cada bicho vai em partes iguais (o resto
 * da divisão fica com quem matou). Cada item que cai vai para o próximo da
 * fila da sala; quem não pode levar (filtro do loot dele, sem capacidade,
 * bolsa cheia) passa a vez para o seguinte. A CHANCE do drop continua sendo a
 * de quem matou (Buff Power, afixo, prey, pódio).
 */
const vezDoResto = new WeakMap(); // sala -> quem recebe a primeira unidade do resto do ouro no próximo evento
// O "Loot of a ..." de um item que foi para outro da party: entra no chat DELE no próximo tique (ver `tirarEventosDaParty`).
const eventosDaParty = new WeakMap(); // estado -> [evento]
export function tirarEventosDaParty(estado) {
  const lista = eventosDaParty.get(estado);
  if (!lista) return null;
  eventosDaParty.delete(estado);
  return lista;
}

function darOuro(estado, valor) {
  if (!valor) return;
  estado.gold = (estado.gold ?? 0) + valor;
  if (estado.hunt?.sessao) estado.hunt.sessao.gold += valor;
  Ficha.totais(estado).gold += valor;
}

/**
 * Quanto de exp um bicho (`key`) pagaria AGORA a este personagem, nesta caçada (ou fora de uma): a mesma
 * cadeia de `matarMonstro` — escala da fase, level/boosts/premium/stamina/estágio (`Boosts.expDoBicho`), prey,
 * pódio e Caça Online. É o que a ficha do monstro mostra ao lado do XP-base. Sem raridade/modificadores
 * (esses são do bicho que nasceu) e sem a partilha da party (que divide e dá bônus).
 */
export function estimarExpDoBicho(estado, hunt, key, { huntId = null, dificuldade = null } = {}) {
  const base = BESTIARY[key]?.exp ?? 0;
  // Na prévia do seletor ainda não há caçada: a escala é a da fase e dificuldade ESCOLHIDAS (a mesma da hora de entrar).
  const escalaDaFase = (huntId && Campanha.escalaDaFase(huntId, dificuldade)?.exp) ?? hunt?.escala?.exp ?? 1;
  const naFase = Math.round(base * escalaDaFase);
  const podio = hunt?.podio ?? SEM_PODIO;
  const semOnline = Boosts.expDoBicho(estado, naFase) * Prey.fatorDeExp(estado, key) * (1 + podio.exp / 100);
  return { key, huntId, dificuldade, base, escalaDaFase, naFase, final: Math.round(semOnline * fatorDaCacaOnline(hunt)) };
}

/**
 * A ficha do monstro (`{t:'fichaDoBicho'}`): o XP que ele paga a este personagem e os ataques dele — as
 * duas contas do servidor, na mesma resposta. `escalaDoDano` é a da fase (a `forca` que o golpe leva na
 * luta, ver `aplicarEscala`); o dano-base dos `ataques` ainda passa por raridade, proteções e armadura.
 */
export function fichaDoBicho(estado, hunt, key, { huntId = null, dificuldade = null } = {}) {
  const escalaDoDano = (huntId && Campanha.escalaDaFase(huntId, dificuldade)?.dano) ?? hunt?.escala?.dano ?? 1;
  return { ...estimarExpDoBicho(estado, hunt, key, { huntId, dificuldade }), ataques: Poderes.ataquesParaFicha(key), escalaDoDano };
}

/**
 * Sorteia e ENTREGA uma lista de drops (`[{ id, chance }]`, chance em fração): chance com os bônus de loot, moedas
 * no bolso, a peça pelo gerador central, filtros de coleta, capacidade, rodízio da party, anúncio de drop raro e o
 * evento de loot. É o laço que `matarMonstro` sempre teve, extraído para o loot dos ENCONTROS (baús, guardiões)
 * seguir exatamente as mesmas regras. `alvo`: de onde veio (`key`, `name`, `exp`/`expDasMoedas`, `lootMult`).
 */
/**
 * Escolhe quem leva UM item e já o põe na bolsa dele. Na party, sorteio uniforme (sem peso por nível, dano, distância ou setor)
 * entre os que podem levar (o filtro "não coletar" e a capacidade dele); se o sorteado não consegue guardar, sai da disputa e
 * sorteia-se de novo — o item não se perde enquanto alguém puder levar, e nunca vai para dois. `verificar: false` (gemas e
 * orbes) só exige que a bolsa aceite. Devolve `{ dono, ignorado }` (`ignorado`: todos filtraram o item).
 */
function escolherDono({ estado, personagem, juntos, id, peca, origem, verificar = true }) {
  const fila = juntos ?? [{ estado, nome: personagem?.nome }];
  let ignorado = verificar;
  let candidatos = fila.filter((m) => {
    if (!verificar) return true;
    // A peça já sorteada (raridade e atributos) vai junto: as regras específicas de "não coletar" olham os atributos reais.
    if (Bolsa.ignora(m.estado, id, peca)) return false;
    ignorado = false;
    return pesoDoInventario(m.estado) + (ITEM_CATALOG[id]?.weight ?? 0) <= Afixos.capacidade(m.estado);
  });
  const concorrentes = candidatos.map((m) => m.nome);
  let dono = null;
  while (candidatos.length) {
    const m = sortearDono(candidatos);
    if (Bolsa.porNaBolsa(m.estado, id, 1, peca)) {
      dono = m;
      break;
    }
    candidatos = candidatos.filter((x) => x !== m);
  }
  if (juntos) registrarSorteio({ drop: novoIdDeDrop(), item: id, origem: origem ?? null, concorrentes, dono: dono?.nome ?? null, resultado: dono ? 'entregue' : ignorado ? 'ignorado' : 'perdido' });
  return { dono, ignorado };
}

/**
 * Entrega `n` moedas (`id`) de um drop. Moeda do loot cai no bolso (carregado), como o resto do ouro ganho caçando — só vai para o banco
 * quando o jogador deposita de propósito no Banqueiro. (Uma versão anterior mandava direto para `bank`, a partir de uma medição do original
 * que o dono do projeto confirmou estar errada.) Na party: partes iguais; o resto (unidades que não dividem) roda entre os integrantes,
 * evento a evento (`dividirOuro`).
 */
function entregarMoedas({ estado, juntos, sala, caiu, conta }, id, n) {
  if (!(n > 0)) return;
  const total = n * VALOR_DA_MOEDA[id];
  caiu.push({ id, count: n });
  conta('loot', id, n);
  if (!juntos) {
    darOuro(estado, total);
    return;
  }
  const inicio = vezDoResto.get(sala) ?? 0;
  const partes = dividirOuro(total, juntos.length, inicio);
  juntos.forEach((m, k) => darOuro(m.estado, partes[k]));
  vezDoResto.set(sala, proximoInicioDoResto(total, juntos.length, inicio));
}

function soltarDrops({ estado, hunt, personagem, alvo, drops, eventos, juntos, sala, caiu, conta, deOutros, podio }) {
  for (const drop of drops) {
    // Entrada de loot SEM id no bestiário (64 bichos têm "rotten feather"/"ritual tooth" assim): não é
    // item nenhum — antes entrava na bolsa como um item fantasma (sem nome, sem venda) e como
    // "undefined" no Analisador. Não muda a chance de nenhum item de verdade.
    if (drop.id == null) continue;
    // `lootMult`: a raridade do mob (raro/elite dão mais loot — ver `mobs/raridade.mjs`).
    const chance = drop.chance * BuffPower.fatorDeLoot(estado) * (1 + Afixos.de(estado, 'loot_bonus') / 100) * Prey.fatorDeLoot(estado, alvo.key) * (1 + podio.loot / 100) * fatorDaCacaOnline(hunt) * (alvo.lootMult ?? 1);
    if (Math.random() >= chance * Progressao.fatorDeDropDe(contextoDoDrop(hunt).dificuldade, drop.id)) continue; // (a dificuldade só mexe na chance de EQUIPAMENTO; neutra por padrão) Buff Power Loot +50%, o afixo "Loot", a prey de loot, o pódio e a Caça Online
    if (VALOR_DA_MOEDA[drop.id]) {
      entregarMoedas({ estado, juntos, sala, caiu, conta }, drop.id, quantasMoedas(alvo, drop.id, estado));
      continue;
    }
    // O item inteiro (raridade, atributos, efeito) sai do gerador central.
    // A origem decide a raridade mínima: boss e boss único, o baú do encontro e os guardiões dele não soltam peça Comum.
    const origem = alvo.origemDoLoot ?? (alvo.raridade === 'boss' || alvo.raridade === 'unico' || alvo.isBoss ? 'boss' : alvo.guardiao ? 'guardiao' : null);
    const peca = gerarItem({ itemId: drop.id, ...contextoDoDrop(hunt), raridadeDoMob: alvo.raridade, ...(origem ? { origem } : {}) });
    const af = peca.af ?? null;
    // Quem leva: sozinho, quem matou; na party, SORTEIO uniforme entre os que PODEM levar (`escolherDono`).
    const { dono, ignorado } = escolherDono({ estado, personagem, juntos, id: drop.id, peca, origem: alvo.name });
    if (!dono) {
      conta(ignorado ? 'ignorado' : 'perdido', drop.id, 1);
      continue;
    }
    // A raridade do drop vai no evento: é ela que pinta o nome em "Loot of a ...".
    const noChat = { id: drop.id, count: 1, ...(peca.raridade ? { raridade: peca.raridade } : {}) };
    if (dono.estado === estado) {
      caiu.push(noChat);
      conta('loot', drop.id, 1);
    } else {
      conta('loot', drop.id, 1, dono.estado.hunt?.sessao);
      const lista = deOutros.get(dono.estado) ?? [];
      lista.push(noChat);
      deOutros.set(dono.estado, lista);
    }
    // O drop raro vai para a capa do site (ver `drops-do-site.mjs`) — fogo e
    // esquece, é só um log, não pode atrasar o golpe que matou o bicho.
    DropsDoSite.anotarDrop({ quem: dono.nome, onde: nomeDaHunt(hunt.huntId), bicho: alvo.name, id: drop.id, af, raridade: peca.raridade, efeito: peca.efeito, peca }).catch((e) => console.error('drops-do-site', e.message));
    // Épico para cima: o servidor inteiro fica sabendo (ver `anuncios.mjs`).
    Anuncios.dropRaro({ quem: dono.nome, peca, bicho: alvo.name, onde: nomeDaHunt(hunt.huntId) });
  }
  for (const [outro, items] of deOutros) {
    const lista = eventosDaParty.get(outro) ?? [];
    lista.push({ t: 'loot', name: alvo.name, items });
    eventosDaParty.set(outro, lista);
  }
  // Mesmo evento do original (`{t:'loot', name, items:[{id,count}]}`, capturado
  // ao vivo): é ele que escreve "Loot of a Troll: ..." no chat.
  if (caiu.length) eventos.push({ t: 'loot', name: alvo.name, items: caiu });
}

/**
 * O loot de um ENCONTRO (baú, guardião): a lista de drops `[{ id, chance }]` (chance em fração) pelas MESMAS regras
 * do loot de um bicho — bônus de loot, filtros de coleta, capacidade, rodízio da party, anúncio de drop raro.
 * `origem`: `{ key, name, expDasMoedas }` (o que faz o papel do bicho). Devolve o que caiu (para o aviso).
 */
export function lootDoEncontro(estado, hunt, personagem, origem, drops, eventos) {
  const part = hunt.partilha;
  const sessao = hunt.sessao;
  const caiu = [];
  const conta = (grupo, id, n, ses = sessao) => {
    if (ses) ses.itens[grupo][id] = (ses.itens[grupo][id] ?? 0) + n;
  };
  const juntos = part?.ativa && part.membros.length > 1 ? part.membros.filter((m) => m.estado === estado || m.estado?.hunt) : null;
  const sala = juntos ? salaDe(hunt) : null;
  soltarDrops({ estado, hunt, personagem, alvo: origem, drops, eventos, juntos, sala, caiu, conta, deOutros: new Map(), podio: hunt.podio ?? SEM_PODIO });
  return caiu;
}

/**
 * Paga a recompensa configurada de um ATO do editor (fase limpa ou boss final vencido), no formato dos encontros: os drops sorteiam
 * `rolagens` vezes pelo loot de sempre (bônus, filtros, capacidade, rodízio da party) e a `primeiraConclusao` paga UMA vez por personagem
 * (`Campanha.reivindicarPremio`, chave `chave`). `donos`: quem recebe o prêmio de primeira vez (a sala). Devolve o que caiu (para o teste).
 */
export function pagarRecompensaDeAto({ estado, hunt, personagem, recompensa, nome, chave, dificuldade, donos = [estado] }) {
  const eventos = [];
  if (!recompensa || !estado) return { caiu: [], pagos: 0 };
  const drops = RecompensasDeEncontro.dropsDe(recompensa);
  const origem = { key: `ato:${chave}`, origemDoLoot: 'bau', name: nome, exp: recompensa.moedasMedia ?? 100, expDasMoedas: recompensa.moedasMedia ?? 100 };
  const caiu = [];
  if (drops.length) for (let i = 0; i < (recompensa.rolagens ?? 1); i++) caiu.push(...lootDoEncontro(estado, hunt, personagem, origem, drops, eventos));
  EventosDeEncontro.empurrar(hunt, eventos);
  let pagos = 0;
  const pc = recompensa.primeiraConclusao;
  if (pc) {
    for (const quem of donos) {
      if (!Campanha.reivindicarPremio(quem, dificuldade, chave)) continue;
      const antes = quem.avisoDaHunt;
      pagarPremio({ estado: quem, gold: Number(pc.gold ?? 0), exp: Number(pc.exp ?? 0), itens: (pc.itens ?? []).map((i) => ({ id: i.id, count: i.count })), nome });
      // Não apaga o aviso que já estava na tela ("Hunt Clear!"): junta.
      if (antes) quem.avisoDaHunt = `${antes} ${quem.avisoDaHunt}`;
      pagos++;
    }
  }
  return { caiu, pagos };
}

/** Paga um prêmio único (`{ estado, gold, exp, itens, nome }`): ouro, experiência e itens, com o aviso na tela. */
export function pagarPremio({ estado, gold, exp, itens, nome, rotulo = 'Primeira vez:' }) {
  const partes = [];
  if (gold > 0) {
    darOuro(estado, gold);
    partes.push(`${gold.toLocaleString('pt-BR')} de ouro`);
  }
  if (exp > 0) {
    estado.xp = (estado.xp ?? 0) + exp;
    Ficha.totais(estado).exp += exp;
    subirDeLevel(estado);
    partes.push(`${exp.toLocaleString('pt-BR')} de experiência`);
  }
  for (const { id, count } of itens) if (Bolsa.porNaBolsa(estado, id, count)) partes.push(`${count}x ${ITEM_CATALOG[id]?.name ?? id}`);
  estado.avisoDaHunt = `${rotulo} ${nome}${partes.length ? ` — ${partes.join(', ')}` : ''}.`;
}

export function matarMonstro(estado, hunt, personagem, alvo, eventos) {
  // Uma morte é processada UMA vez: um evento repetido (golpe de área e dano contínuo no mesmo quadro) não paga exp, ouro nem item de novo.
  if (alvo.recompensado) return;
  Object.defineProperty(alvo, 'recompensado', { value: true, enumerable: false, configurable: true });
  // As mecânicas do mob ao morrer (Explosivo, Procriador) e as dos vizinhos (Vingativo) — `mobs/mecanicas.mjs`.
  Mecanicas.aoMorrer(estado, hunt, personagem, alvo, eventos);
  // Na Arena x1 ninguém ganha exp nem loot dos bichos: eles só atrapalham.
  if (hunt.pvp) {
    eventos.push({ t: 'kill', name: alvo.name, exp: 0, quem: personagem?.nome, x: alvo.x, y: alvo.y, color: '#ffffff' });
    if (alvo.spawn) (hunt.respawns ??= []).push({ ...alvo.spawn, volta: (salaDe(hunt).clock ?? 0) + RESPAWN_MS });
    tirarMonstro(hunt, alvo);
    return;
  }
  // Boss único (`bosses-unicos/`): leva os lacaios, conclui o encontro e paga a PRIMEIRA vitória de quem estava na luta.
  if (alvo.boss) {
    const partilha = hunt.partilha;
    const quem = [estado, ...(partilha?.ativa ? partilha.membros.map((m) => m.estado).filter((e) => e?.hunt) : [])];
    for (const r of BossesUnicos.aoMorrer(hunt, alvo, { quem, agora: hunt.clock ?? 0 })) pagarPremio(r);
  }
  // A exp de verdade: a do bicho x (bônus de level + boosts + premium). Ver `Boosts.expDoBicho`.
  // Shared Experience (party na mesma caçada, ver `party.mjs`): a exp do bicho,
  // com o bônus das vocações, dividida em partes iguais; cada um recebe a parte
  // dele com os PRÓPRIOS bônus (level, boosts, stamina).
  const part = hunt.partilha;
  let exp;
  let parte; // a fatia do próprio matador (party)
  if (part?.ativa && part.membros.length > 1) {
    // A exp do bicho (com o bônus das vocações) dividida pelo PESO de cada um: nível ^ k, sem limite de diferença (`party-recompensas.mjs`).
    const total = alvo.exp * (alvo.exp >= 20 ? part.bonus : 1);
    const fatias = partesDeXp(part.membros.map((m) => m.estado?.level ?? 1));
    parte = total * fatias[Math.max(0, part.membros.findIndex((m) => m.estado === estado))];
    for (const [k, m] of part.membros.entries()) {
      if (m.estado === estado || !m.estado?.hunt) continue;
      const deles = Math.round(Boosts.expDoBicho(m.estado, total * fatias[k]) * Prey.fatorDeExp(m.estado, alvo.key) * fatorDaCacaOnline(m.estado.hunt));
      m.estado.xp = (m.estado.xp ?? 0) + deles;
      const s2 = m.estado.hunt.sessao;
      if (s2) {
        s2.exp += deles;
        s2.expPorNome[m.nome] = (s2.expPorNome[m.nome] ?? 0) + deles;
      }
      Ficha.totais(m.estado).exp += deles;
      subirDeLevel(m.estado);
      // As gemas de skill encaixadas nas peças vestidas ganham a mesma exp.
      GemasDeSkill.ganharXp(m.estado, deles);
    }
    exp = Boosts.expDoBicho(estado, parte);
  } else {
    exp = Boosts.expDoBicho(estado, alvo.exp);
  }
  // Prey de experiência: só contra a criatura do slot (ver `Prey.fatorDeExp`).
  // + o bônus do pódio da Arena x1 da semana (1º +8%, 2º +5%, 3º +3%)
  // + o da Caça Online (`fatorDaCacaOnline`).
  const podio = hunt.podio ?? SEM_PODIO;
  const semOnline = exp * Prey.fatorDeExp(estado, alvo.key) * (1 + podio.exp / 100);
  exp = Math.round(semOnline * fatorDaCacaOnline(hunt));
  // As moedas (`quantasMoedas`) sorteiam em volta desta exp — a de antes do
  // bônus online, que é de CHANCE no loot e não de quantidade de ouro.
  alvo.expDasMoedas = Math.round(semOnline);
  alvo.exp = exp;
  eventos.push({ t: 'kill', name: alvo.name, exp, quem: personagem.nome, x: alvo.x, y: alvo.y, color: '#ffffff' });
  estado.xp = (estado.xp ?? 0) + exp;
  const sessao = hunt.sessao;
  if (sessao) {
    sessao.exp += exp;
    sessao.kills += 1;
  }
  const totais = Ficha.totais(estado);
  totais.kills += 1;
  totais.exp += exp;
  subirDeLevel(estado);
  // As gemas de skill encaixadas nas peças vestidas ganham a mesma exp (e avisam quando sobem).
  for (const g of GemasDeSkill.ganharXp(estado, exp)) eventos.push({ t: 'gemaSubiu', quem: personagem?.nome, nome: g.nome, nivel: g.nivel });
  // O bestiary (e os pontos de charm quando fecha) e o Carnage.
  Charms.contarMorte(estado, alvo.key, eventos);
  if (part?.ativa) for (const m of part.membros) if (m.estado !== estado && m.estado?.hunt) Charms.contarMorte(m.estado, alvo.key, null);
  // As tasks — Boss Task, de bicho e de montaria — DEPOIS do bestiary, que é de onde elas contam.
  Bosses.contarMorte(estado, alvo.key);
  // A Boss Task conta para a party toda, como a task de bicho (pedido do dono).
  if (part?.ativa) for (const m of part.membros) if (m.estado !== estado && m.estado?.hunt) Bosses.contarMorte(m.estado, alvo.key);
  Tarefas.contarMorte(estado, alvo.key);
  if (part?.ativa) for (const m of part.membros) if (m.estado !== estado && m.estado?.hunt) Tarefas.contarMorte(m.estado, alvo.key);
  // A fase da campanha não conta mortes: ela completa quando a INSTÂNCIA é
  // limpa (ver `hunt/instancia.mjs` e `tique`, em cacadas.mjs).
  Charms.aoMatar(estado, hunt, alvo, eventos);
  // A proficiência: XP para a arma da mão (e para a de cada um da party) e vida/mana por morte.
  // Os efeitos de item que reagem a uma morte (Sede de Sangue, Colheita de Almas).
  EfeitosDeItem.aoMatar(estado, hunt, alvo, eventos, personagem?.nome);
  // Vida/mana por abate das peças do PoE ("Ganha X de Vida por Inimigo Morto"); 0 sem elas.
  {
    const f = Ficha.combate(estado);
    // (+ o "Recupera X% da Vida/Mana ao Matar" do PoE.)
    const vidaPct = ModsPoe.valor(f, 'vida_ao_matar_pct');
    const manaPct = ModsPoe.valor(f, 'mana_ao_matar_pct');
    const vida = (f.vidaPorAbate ?? 0) + ((estado.maxHp ?? 0) * vidaPct) / 100;
    const mana = (f.manaPorAbate ?? 0) + ((estado.maxMana ?? 0) * manaPct) / 100;
    if ((vida || mana) && estado.hp > 0) Ficha.curar(estado, Math.round(vida), Math.round(mana), eventos, personagem?.nome, hunt.pos);
    // (PoE: "se você Matou Recentemente" e os eventos "ao Matar" dos únicos — com o morto como alvo: Incendiado, Congelado, Raro…)
    ModsPoe.marcar(hunt, 'matou');
    (hunt.poeMortesRecentes ??= []).push(hunt.clock ?? 0);
    if (hunt.poeMortesRecentes.length > 50) hunt.poeMortesRecentes.splice(0, hunt.poeMortesRecentes.length - 50);
    ModsPoe.evento(estado, hunt, 'matar', f, { alvo, eventos, personagem });
    // As cargas do PoE "ao Matar" (só com ITENS_POE=1): mudou o número, a ficha é refeita.
    if (f.cargas && CargasPoe.aoMatar(estado, f.cargas).length) Ficha.invalidar(estado);
  }
  // As cargas dos FRASCOS do PoE (de quem matou e da party na sala), pela raridade do monstro.
  FrascosPoe.aoMatar(estado, tipoDoBicho(alvo));
  if (part?.ativa) for (const m of part.membros) if (m.estado !== estado && m.estado?.hunt) FrascosPoe.aoMatar(m.estado, tipoDoBicho(alvo));
  if (alvo.spawn && !hunt.isBoss) (hunt.respawns ??= []).push({ ...alvo.spawn, volta: (salaDe(hunt).clock ?? 0) + RESPAWN_MS });
  if (hunt.isBoss) return vitoriaNoBoss(estado, hunt, alvo, personagem);
  if (sessao) sessao.byMonster[alvo.name] = (sessao.byMonster[alvo.name] ?? 0) + 1;
  if (sessao) sessao.expPorNome[personagem.nome] = (sessao.expPorNome[personagem.nome] ?? 0) + alvo.exp;
  /*
   * ---- O loot cai na BOLSA, como no original ----
   *
   * Moeda vai direto para o bolso (o `session.loot` real conta o 3031 como
   * ouro). O resto entra na Bolsa de Loot (`Bolsa.porNaBolsa`, 1000 vagas),
   * que a auto-venda esvazia (ver `autoVenda`). O que o filtro recusa
   * (`itemRules.noLoot`) fica no chão como "Ignorado"; bolsa cheia, como
   * "Ficou no chão" (`perdido`, o nome real da sessão capturada).
   */
  const caiu = [];
  const conta = (grupo, id, n, ses = sessao) => {
    if (ses) ses.itens[grupo][id] = (ses.itens[grupo][id] ?? 0) + n;
  };
  // Quem divide o loot deste bicho (null: sozinho, ou fora da partilha).
  const juntos = part?.ativa && part.membros.length > 1 ? part.membros.filter((m) => m.estado === estado || m.estado?.hunt) : null;
  const sala = juntos ? salaDe(hunt) : null;
  const deOutros = new Map(); // estado -> itens que foram para ele
  /*
   * ---- A GEMA DE SKILL que cai (chance do ato; ver `skills/gemas.mjs#sortearDrop`) ----
   * Vai para a bolsa de quem matou, como item (nível 1). Os bônus de loot aumentam a chance.
   */
  const gemaQueCai = GemasDeSkill.sortearDrop({
    ato: Number(contextoDoDrop(hunt).ato) || 1,
    levelDaFase: hunt.escala?.nivel ?? estado.level ?? 1,
    dificuldade: contextoDoDrop(hunt).dificuldade ?? null,
    fatorDeChance: BuffPower.fatorDeLoot(estado) * (1 + Afixos.de(estado, 'loot_bonus') / 100),
  });
  // Gemas, lapidadoras, fundidoras e orbes também são sorteados na party (a chance do drop segue a de quem matou).
  const darExtra = (item, peca = undefined) => {
    if (!item) return;
    const { dono } = escolherDono({ estado, personagem, juntos, id: item.id, peca, origem: alvo.name, verificar: false });
    if (!dono) return;
    if (dono.estado === estado) {
      caiu.push({ id: item.id, count: 1 });
      conta('loot', item.id, 1);
    } else {
      conta('loot', item.id, 1, dono.estado.hunt?.sessao);
      const lista = deOutros.get(dono.estado) ?? [];
      lista.push({ id: item.id, count: 1 });
      deOutros.set(dono.estado, lista);
    }
  };
  darExtra(gemaQueCai, gemaQueCai);
  // A LAPIDADORA (a moeda que sobe a qualidade da gema): mesma regra de chance.
  const lapidadora = GemasDeSkill.sortearLapidadora({
    ato: Number(contextoDoDrop(hunt).ato) || 1,
    fatorDeChance: BuffPower.fatorDeLoot(estado) * (1 + Afixos.de(estado, 'loot_bonus') / 100),
  });
  darExtra(lapidadora);
  // A FUNDIDORA (sorteia de novo os links da peça): mesma regra de chance.
  const fundidora = GemasDeSkill.sortearFundidora({
    ato: Number(contextoDoDrop(hunt).ato) || 1,
    fatorDeChance: BuffPower.fatorDeLoot(estado) * (1 + Afixos.de(estado, 'loot_bonus') / 100),
  });
  darExtra(fundidora);
  // Os ORBES de socket (config `orbes`): a chance por ato é ZERO por enquanto (a fonte é a loja da Zuma) —
  // o gancho existe para ligar quando houver balanceamento, sem tocar de novo no combate.
  for (const tipo of ['encaixe', 'ligacao']) {
    const orbe = GemasDeSkill.sortearOrbe(tipo, {
      ato: Number(contextoDoDrop(hunt).ato) || 1,
      fatorDeChance: BuffPower.fatorDeLoot(estado) * (1 + Afixos.de(estado, 'loot_bonus') / 100),
    });
    darExtra(orbe);
  }
  // No PoE: o Joalheiro, a Fusão e o Cromático (`itens-poe/regras.json` → `sockets.orbes`).
  for (const orbe of GemasDeSkill.sortearOrbesDoPoe({ ato: Number(contextoDoDrop(hunt).ato) || 1, fatorDeChance: BuffPower.fatorDeLoot(estado) * (1 + Afixos.de(estado, 'loot_bonus') / 100) })) darExtra(orbe);
  soltarDrops({ estado, hunt, personagem, alvo, drops: [...alvo.loot, ...Gemas.dropDoBicho(BESTIARY[alvo.key])], eventos, juntos, sala, caiu, conta, deOutros, podio });
  // Sistema de itens do PoE (Fase 1, só com ITENS_POE=1): quantas peças pela raridade do bicho × os modificadores de quantidade do loot
  // do Draevor (Buff Power, afixo Loot, prey, pódio, Caça Online — sem o lootMult, que já é a raridade do bicho); números em `itens-poe/regras.json`.
  const quantidadeDoJogador = BuffPower.fatorDeLoot(estado) * (1 + Afixos.de(estado, 'loot_bonus') / 100) * Prey.fatorDeLoot(estado, alvo.key) * (1 + (podio?.loot ?? 0) / 100) * fatorDaCacaOnline(hunt);
  for (const daPoe of ItensPoeJogo.dropsDoMonstro(nivelDoDropPoe(hunt, alvo), tipoDoBicho(alvo), Math.random, undefined, quantidadeDoJogador, raridadeDoDrop(estado, alvo))) {
    if (!Bolsa.porNaBolsa(estado, daPoe.id, 1, daPoe)) break;
    caiu.push({ id: daPoe.id, count: 1 });
    conta('loot', daPoe.id, 1);
    // O Único do PoE: o servidor inteiro fica sabendo (chat e faixa do alto — `anuncios.mjs`).
    Anuncios.dropRaro({ quem: personagem?.nome ?? null, peca: daPoe, bicho: alvo.name, onde: nomeDaHunt(hunt.huntId) });
  }
  // As MOEDAS do PoE (Transmutação, Caos, Exaltado... — `itens-poe/moedas.mjs`, chances em `regras.json → moedas.drop`).
  for (const moeda of MoedasPoe.dropDoMonstro(tipoDoBicho(alvo), Math.random, quantidadeDoJogador)) {
    if (!Bolsa.porNaBolsa(estado, moeda.id, moeda.count)) break;
    caiu.push(moeda);
    conta('loot', moeda.id, moeda.count);
  }
  // O OURO do monstro do PoE (pedido do dono, 05/10): aleatório na faixa do level dele × a raridade (`itens-poe/regras.json` → `ouro`),
  // com o Gold Find de quem matou. Cai no bolso como as moedas (e divide na party).
  if (BESTIARY[alvo.key]?.poe) {
    const achado = 1 + (Ficha.combate(estado).goldFind ?? 0) / 100;
    entregarMoedas({ estado, juntos, sala, caiu, conta }, 3031, ItensPoeJogo.ouroDoMonstro(nivelDoDropPoe(hunt, alvo), tipoDoBicho(alvo), Math.random, undefined, achado));
  }
  // A TABELA DE DROP do monstro (engine — Acts/Campanha do PoE; o item de missão só enquanto a fase dele está aberta) e o OBJETIVO da fase
  // (matar o chefe, N monstros, pegar o item da missão — `Campanha.matou`, que conclui a fase e põe o aviso na tela).
  {
    const daBolsa = (id) => {
      if (!Bolsa.porNaBolsa(estado, id, 1)) return false;
      caiu.push({ id, count: 1 });
      conta('loot', id, 1);
      return true;
    };
    const c = hunt.campanha;
    const missaoAberta = (id) => {
      if (!c) return false;
      const conc = Campanha.conclusaoDa(c.huntId);
      return conc.tipo === 'item-de-missao' && Number(conc.item) === id && !Campanha.faseCompleta(estado, c.dificuldade, c.huntId);
    };
    const daTabela = DropsPorMonstro.soltar(alvo.key, { missaoAberta, existe: (id) => !!ITEM_CATALOG[id] }).filter((d) => daBolsa(d.id));
    Campanha.matou(estado, hunt, alvo, { ganhou: daTabela, dar: daBolsa });
  }
  // Sede de sangue (knight) e Fonte eterna (sorcerer).
  Arvore.aoMatar(estado, eventos, hunt.pos, personagem?.nome);
  tirarMonstro(hunt, alvo);
  if (hunt.alvo === alvo.uid) hunt.alvo = null;
  // O setor da instância ficou limpo: a party toda é avisada (uma vez — o último bicho do setor só morre uma vez).
  const salaDoSetor = salaDe(hunt);
  const bichosDaSala = salaDoSetor?.instancia?.setores ? [...salaDoSetor.monstros, ...Object.values(salaDoSetor.outrosAndares ?? {}).flat()] : [];
  // O último bicho da INSTÂNCIA inteira não anuncia setor: quem fala é o "Hunt Clear!".
  const sobrouAlgum = bichosDaSala.some((m) => m.hp > 0 && m.instancia === salaDoSetor.instancia.id && !m.opcional);
  const setorLimpo = sobrouAlgum ? Setores.setorQueAcabou(alvo, bichosDaSala, salaDoSetor.instancia, null) : null;
  if (setorLimpo) {
    const quem = part?.ativa ? part.membros.map((m) => m.estado).filter(Boolean) : [estado];
    for (const e of quem) e.avisoDaHunt = `Setor concluído: ${setorLimpo}.`;
  }
}

/** O troco de UM bicho — chamado pra todo monstro adjacente, não só o alvo (ver `round`). */
export function contraAtaque(estado, hunt, personagem, bicho, eventos) {
  Treino.treinar(estado, 'shielding');
  const ficha = Ficha.combate(estado);
  // Bloqueio: a chance da ficha (`blockChance`, fórmula real do client) apara o
  // golpe inteiro — o `block` que o original manda, visto ao vivo.
  // A chance sorteia entre o pior e o melhor bloqueio da faixa das peças (escudo e arma) a cada golpe.
  const chanceDeBloquear = (ficha.blockChanceMin ?? ficha.blockChance) + Math.random() * ((ficha.blockChanceMax ?? ficha.blockChance) - (ficha.blockChanceMin ?? ficha.blockChance));
  // `bloqueio.modo` (`combate/formulas.json`): 'draevor' bloqueia ANTES da esquiva (como sempre); 'poe' só depois que o golpe ACERTOU (esquiva primeiro).
  // `glancingPct`: o golpe bloqueado ainda causa esta % do dano (0 = o bloqueio anula o golpe).
  let fatorDoBloqueio = 1;
  const bloquear = () => {
    if (!(Math.random() < chanceDeBloquear)) return false;
    eventos.push({ t: 'block', uid: 'player', quem: personagem.nome, x: hunt.pos.x, y: hunt.pos.y, color: '#999999' });
    Arvore.aoBloquear(estado, eventos, hunt.pos, personagem.nome); // Vento que volta (monk)
    // As cargas do PoE "ao Bloquear".
    if (ficha.cargas && CargasPoe.aoBloquear(estado, ficha.cargas).length) Ficha.invalidar(estado);
    // PoE: "Inflige Causticar/Enfraquecer/Exaurir em Inimigos ao Bloquear seu Dano" e os eventos "ao Bloquear" dos únicos.
    ModsPoe.aoBloquear(hunt, bicho, ficha, { eventos });
    ModsPoe.marcar(hunt, 'bloqueou');
    ModsPoe.evento(estado, hunt, 'bloquear', ficha, { alvo: bicho, eventos, personagem });
    // Golpes Reveladores (keystone do PoE): o golpe bloqueado ainda causa 65% do dano. PoE: "Você sofre X% do Dano de Acertos Bloqueados".
    const glancing = Math.max(temHabilidade(estado, 'golpesReveladores') ? 65 : Formulas.PARAMETROS.bloqueio.glancingPct, ModsPoe.valor(ficha, 'dano_dos_bloqueados'));
    if (glancing > 0) {
      fatorDoBloqueio = glancing / 100;
      return false;
    }
    return true;
  };
  const bloqueioDepois = Formulas.PARAMETROS.bloqueio.modo === 'poe';
  if (!bloqueioDepois && bloquear()) return;
  // Esquiva das gemas (supremo "Esquiva"): o golpe inteiro não pega.
  if (ficha.esquiva && Math.random() < ficha.esquiva) {
    eventos.push({ t: 'block', uid: 'player', quem: personagem.nome, x: hunt.pos.x, y: hunt.pos.y, color: '#999999', esquiva: true });
    return;
  }
  // Evasion (DEX, bases de Evasion e adds) e "Chance to Avoid Damage": o golpe inteiro não pega.
  if (Defesa.esquivou(ficha, hunt, bicho) || Defesa.evitou(ficha)) {
    eventos.push({ t: 'block', uid: 'player', quem: personagem.nome, x: hunt.pos.x, y: hunt.pos.y, color: '#999999', esquiva: true });
    return;
  }
  // Dodge (charm): desvia do golpe inteiro.
  if (Charms.desviou(estado, hunt, personagem, bicho, eventos)) return;
  // Ruse (tier da armadura): desvia do golpe inteiro.
  if (Tiers.rolar(estado, 'body')) {
    eventos.push({ t: 'block', uid: 'player', quem: personagem.nome, x: hunt.pos.x, y: hunt.pos.y, color: '#999999', ruse: true });
    Arvore.aoBloquear(estado, eventos, hunt.pos, personagem.nome);
    return;
  }
  if (bloqueioDepois && bloquear()) return;
  // O melee do monster.lua (`Poderes`); bicho sem arquivo, a regra de sempre.
  // `forca`: o degrau da Arena x1 (+15% a cada 2 min).
  // `forcaDoBicho`: a força × a marca de enfraquecido (Aura of Sapped Strength).
  // (PoE: × o Exaurido — "Inflige Exaurir … ao Bloquear": o bicho causa 10% menos dano.)
  const forcaDoGolpe = Reforcos.forcaDoBicho(bicho, hunt.clock ?? Date.now()) * fatorDoBloqueio * ModsPoe.doBicho(bicho, hunt.clock ?? 0).danoFator;
  const brutoSemCritico = (Poderes.golpeCorpoACorpo(bicho) ?? R.ataqueDoMonstro(bicho)) * forcaDoGolpe;
  // O CRÍTICO do mob (só quem tem — `mobs/atributos.json`): rola UMA vez e vale para o golpe todo, todos os tipos de dano.
  // (PoE: a chance × o Cego, e o dano extra × "Dano Extra recebido de Acertos Críticos reduzido".)
  const critDoMob = ModsPoe.criticoDoBicho(AtributosDoMob.critico(bicho), bicho, ficha, hunt.clock ?? 0) ?? AtributosDoMob.rolarCritico(bicho);
  const bruto = brutoSemCritico * critDoMob.fator;
  // O golpe ACERTOU (passou da esquiva e do bloqueio): boss e elite podem CONGELAR, ATORDOAR ou fazer LENTIDÃO no jogador
  // (`combate/controle.mjs`), mesmo que o Energy Shield engula o dano; a resistência a controle dele encurta o efeito.
  if (bruto > 0) {
    const controle = Controle.tentar(hunt, bicho, ficha, hunt.clock ?? 0);
    if (controle) eventos.push({ t: 'estado', uid: 'player', quem: personagem.nome, x: hunt.pos.x, y: hunt.pos.y, estado: controle, de: bicho.name });
  }
  // Os EFEITOS do golpe (`efeitos` da espécie): dano contínuo no jogador pelo motor `combate/dot.mjs` — do dano antes da defesa e do crítico.
  for (const ef of AtributosDoMob.efeitosDoGolpe(bicho)) {
    if (Math.random() * 100 >= (ef.chance ?? 100) || !(brutoSemCritico > 0)) continue;
    const estadoPosto = ModsPoe.dotNoJogador(hunt, { tipo: ef.tipo, total: (brutoSemCritico * ef.pctDoGolpe) / 100, duracaoMs: ef.duracaoMs ?? null, origem: { fonte: 'mob', mob: bicho.name, uid: bicho.uid, key: bicho.key } }, hunt.clock ?? 0);
    if (estadoPosto) eventos.push({ t: 'estado', uid: 'player', quem: personagem.nome, x: hunt.pos.x, y: hunt.pos.y, estado: estadoPosto, de: bicho.name });
  }
  // Golpe corpo a corpo é físico: a proteção física do equipamento corta em %.
  // (PoE: o Físico recebido com as conversões dele — "X% do Dano Físico sofrido como Dano de Fogo" —, o "Dano Físico recebido aumentado"
  // e o fixo por golpe — "-25 de Dano Físico sofrido dos Acertos de Ataques".)
  const protegido = Math.max(0, Math.round(bruto * (itensPoeLigado() ? ModsPoe.fatorDaResistenciaRecebida(ficha, 'physical') : 1 - Math.min(100, ficha.protection.physical ?? 0) / 100) + ModsPoe.fixoRecebido(ficha, 'physical', { ataque: true })));
  // O dano de OUTROS tipos do mesmo golpe (`danoExtra` da espécie): cada um passa pela proteção do SEU elemento (a armadura é só do físico).
  // (PoE: com as conversões do dano recebido — "X% do Dano de Fogo dos Acertos recebido como Dano de Gelo" — e o "Recebe X% do Dano Físico
  // como Dano Extra de um Elemento aleatório".)
  const doutrosTipos = AtributosDoMob.danoExtraDoGolpe(bicho).reduce((n, x) => n + Math.round((x.min + Math.floor(Math.random() * (x.max - x.min + 1))) * forcaDoGolpe * critDoMob.fator * ModsPoe.fatorDaResistenciaRecebida(ficha, x.elemento)), 0) + Math.round(ModsPoe.extraDoFisicoRecebido(ficha, bruto));
  // Prey de defesa: corta o que SOBROU da armadura. Antes dela, a armadura
  // (redução fixa) ampliava o corte — "Defesa +30%" virava -69% num golpe de 13.
  let final = Math.round((R.danoRecebido(protegido, armorDoPersonagem(estado)) + doutrosTipos) * Prey.fatorDeDefesa(estado, bicho.key) * (1 - (ficha.danoRecebidoDasGemas ?? 0)));
  // "Conjurar ao Receber Dano" (suporte de gatilho do PoE): o dano recebido (antes do Escudo de Energia, como no PoE) soma no limiar.
  if (final > 0) Acoes.aoReceberDano(estado, hunt, personagem, final, eventos);
  // Energy Shield: absorve antes do magic shield e da vida.
  final = Defesa.absorver(estado, ficha, final, eventos, { uid: 'player', quem: personagem.nome, x: hunt.pos.x, y: hunt.pos.y, foe: false, de: bicho.name, golpe: 'corpo a corpo' });
  // Magic shield ligado: o golpe sai da MANA primeiro (o que sobra, da vida).
  if (final > 0 && Acoes.temBuff(hunt, 'shield') && (estado.mana ?? 0) > 0) {
    const daMana = Math.min(estado.mana, final);
    estado.mana -= daMana;
    final -= daMana;
    eventos.push({ t: 'dmg', uid: 'player', quem: personagem.nome, x: hunt.pos.x, y: hunt.pos.y, v: daMana, foe: false, de: bicho.name, golpe: 'corpo a corpo', color: '#4fc3ff' });
  }
  // Absorção e "Dano recebido" da árvore, Última muralha, o escudo da Fonte
  // viva e o Não cai nunca (ver `Arvore.danoRecebido`).
  final = Arvore.danoRecebido(estado, final, eventos, hunt.pos, personagem.nome);
  // As cargas do PoE: "acertado recentemente" e a chance de Tolerância quando acertado.
  if (ficha.cargas && CargasPoe.aoSerAcertado(estado, ficha.cargas).length) Ficha.invalidar(estado);
  // PoE: o "acertado/dano recentemente", o Reflexo aos agressores corpo a corpo, a recuperação do dano sofrido e o congelar quem acerta.
  ModsPoe.aoSerAcertado(estado, hunt, bicho, ficha, { dano: Math.max(0, final), corpoACorpo: true, eventos });
  registrarGolpe(() => ({ origem: 'mob', atacante: bicho.name, alvo: personagem.nome, tipo: 'physical', danoAntesDaResistencia: Math.round(bruto), resistenciaDoAlvo: Math.min(100, ficha.protection.physical ?? 0), danoAposResistencia: protegido, armadura: armorDoPersonagem(estado), danoFinal: final, vidaRestante: Math.max(0, estado.hp - Math.max(0, final)) }));
  if (final > 0) {
    estado.hp = Math.max(0, estado.hp - final);
    // O sangue no boneco — sem isto o golpe só existia no número que sobe,
    // nunca na tela (mesmo id real do OTServ que `round()` usa no bicho).
    // O efeito do golpe na tela: o do cadastro do bicho (aba Mobs → Ataques e efeitos) ou o sangue de sempre.
    eventos.push({ t: 'fx', id: Poderes.efeitoDoGolpe(bicho), uid: 'player', x: hunt.pos.x, y: hunt.pos.y });
    eventos.push({
      t: 'dmg',
      uid: 'player',
      quem: personagem.nome,
      x: hunt.pos.x,
      y: hunt.pos.y,
      v: final,
      foe: false,
      de: bicho.name,
      golpe: 'corpo a corpo',
      color: '#ff0000',
      ...(critDoMob.critico ? { crit: true } : {}),
    });
    // Parry e Numb (charms defensivos).
    Charms.depoisDeApanhar(estado, hunt, bicho, final, eventos);
    // As mecânicas do mob ao acertar (Venenoso: dano ao longo do tempo — `mobs/mecanicas.mjs`).
    Mecanicas.aoAtacar(estado, hunt, personagem, bicho, final, eventos);
  } else {
    // A armadura (e a proteção) engoliu o golpe INTEIRO: não é bloqueio — o escudo não fez nada —,
    // então o texto é outro (`absorvido`), e a chance de bloqueio da ficha não parece maior do que é.
    eventos.push({ t: 'block', uid: 'player', quem: personagem.nome, x: hunt.pos.x, y: hunt.pos.y, color: '#999999', absorvido: true });
  }
}

/*
 * ---- Não é só o alvo que bate — é todo bicho do lado ----
 *
 * "os mob tbm atacam igual o oficial" — um Troll que a Caça Automática NÃO
 * escolheu como alvo mas que ficou adjacente (perseguindo, ver
 * `moverMonstros`) bate igual: no jogo de verdade, ficar rodeado por três
 * bichos dói o triplo, e não fingir isso tornava perseguição inofensiva.
 * O jogador só bate de volta no ALVO (é assim que "corpo a corpo" escolhe
 * quem golpear); os outros adjacentes só recebem o troco.
 */
/*
 * ---- O ritmo do combate ----
 *
 * Medido no original (Biro, paladino level 8, na troll-cave, 2026-09-24): o
 * ataque básico sai a cada ~2s (golpes em 6205, 8260, 14583, 16720, 18863,
 * 21972ms do relógio da caçada — o 2s do Tibia), e a barra de magias tenta uma
 * por segundo. Aqui o golpe saía a cada 250ms (o passo), e o troco de cada
 * bicho também — 8x rápido demais dos dois lados.
 */
export const ATAQUE_MS = Ficha.INTERVALO_BASE_DO_GOLPE_MS;
export const ATAQUE_DO_MONSTRO_MS = 2000;
/** Até onde um bicho lança magia: a tela do Tibia (7 casas para o lado). */
export const ALCANCE_DAS_MAGIAS = 7;

/** Cada bicho colado bate no seu próprio ritmo, pelo relógio da caçada (vale na caçada offline também). */
export function golpesDosMonstros(estado, hunt, personagem) {
  const eventos = [];
  // Arena x1: durante a largada ninguém luta, nem os bichos (`Arena.antesDoTique`).
  if (hunt.largadaAte && Date.now() < hunt.largadaAte) return eventos;
  const agora = hunt.clock ?? 0;
  // As magias (área, feixe e no alvo) de boss e de bicho: não pedem estar
  // colado, só estar na tela (`ALCANCE_DAS_MAGIAS`).
  let ficha = null;
  let escudo = false;
  for (const bicho of hunt.monstros) {
    // As magias de um bicho já mataram: os outros não batem no personagem caído.
    if ((estado.hp ?? 0) <= 0) break;
    // O boss único (`bosses-unicos/`) tem os comportamentos DELE além (ou no lugar) das magias do arquivo da criatura-base.
    if (bicho.dummy || bicho.hp <= 0 || !(bicho.boss || Poderes.temPoderes(bicho)) || distancia(hunt.pos, bicho) > ALCANCE_DAS_MAGIAS) continue;
    // Congelado ou atordoado (supports Freeze/Stun): não lança.
    if (!Estados.podeAgir(bicho, agora)) continue;
    if (!ficha) {
      ficha = Ficha.combate(estado);
      escudo = Acoes.temBuff(hunt, 'shield');
    }
    if (bicho.boss) BossesUnicos.tique({ estado, hunt, personagem, bicho, eventos, agora, ficha, temEscudo: escudo });
    if (Poderes.temPoderes(bicho) && !bicho.boss?.semPoderesDoBase) Poderes.lancar(estado, hunt, personagem, bicho, eventos, agora, ficha, escudo);
  }
  for (const bicho of hunt.monstros) {
    if (bicho.dummy || bicho.hp <= 0 || distancia(hunt.pos, bicho) > 1 || Poderes.semCorpoACorpo(bicho)) continue;
    if (estado.hp <= 0) break;
    if (!R.jaPode(agora, bicho.proximoGolpe)) continue;
    // Congelado ou atordoado: não bate; lento: bate mais devagar (supports Freeze/Stun/Slow).
    if (!Estados.podeAgir(bicho, agora)) continue;
    // O modificador de velocidade de ataque (`velocidadeDeAtaque`) encurta o intervalo do golpe.
    // (+ o buff de velocidade de ataque das mecânicas: Enfurecido, Vingativo — `mobs/buffs.mjs`.)
    // O intervalo entre golpes (`mobs/atributos.mjs`): o base × a lentidão ÷ a velocidade (modificador × buffs), com limites configuráveis.
    bicho.proximoGolpe = agora + AtributosDoMob.intervaloDoGolpe(bicho, { base: bicho.boss?.melee?.intervaloMs ?? ATAQUE_DO_MONSTRO_MS, lentidao: Estados.fatorDeLentidao(bicho, agora), buffPct: BuffsDeMob.soma(bicho, agora, 'velocidadeDeAtaquePct') });
    contraAtaque(estado, hunt, personagem, bicho, eventos);
  }
  return eventos;
}

/*
 * ---- A parte ELEMENTAL do golpe da arma ----
 *
 * Arma com `element` (Crafted V2: holy 65; soulcutter: death 45) bate DUAS
 * vezes no mesmo golpe no original: o físico (ataque da arma) e o elemento (o
 * `value` dele pela MESMA fórmula) — capturado ao vivo, knight level 400 de
 * soulcutter no boneco: 16 em cinza (#999999) e 73 em death (#990000) juntos
 * (`api-mapeada/treino-online-msgs.json`). Aqui só o físico existia, e a arma
 * V2 batia quase igual a um steel axe. O elemento passa pela resistência do
 * bicho (a do bestiário, com o teto do boss) e pela mesma rolagem de crítico.
 */
// As reais capturadas: death na soulcutter (#990000) e fire na sanguine blade do Zoros (#ff9900,
// 2026-09-25 — a magia de fogo é #ff9000); os outros, a cor do elemento.
export const COR_DO_GOLPE_ELEMENTAL = { death: '#990000', fire: '#ff9900', chaos: '#b44dff' };
export const ELEMENTO_DO_CATALOGO = { poison: 'earth' };

export function parteElementalDoGolpe(estado, hunt, alvo, arma, ficha, rolagem) {
  // O elemento da arma — ou, no arco/besta, o da munição (`Ficha.combate().element`).
  const el = arma?.element ?? (ficha.element?.value ? ficha.element : null);
  if (!el?.value) return null;
  const tipo = ELEMENTO_DO_CATALOGO[el.type] ?? el.type;
  const bruto = R.golpeDoJogador({ attack: el.value }, ficha.skillValue, estado.level) * (1 + (ficha.danoDoElemento?.[tipo] ?? 0) / 100);
  const base = resistido(hunt, alvo, tipo, bruto, ficha);
  const { dano } = Ficha.rolarCritico(estado, base, alvo, [], ficha, rolagem);
  alvo.hp -= dano;
  return { v: dano, cor: COR_DO_GOLPE_ELEMENTAL[tipo] ?? Acoes.COR_DO_ELEMENTO[tipo] ?? '#ff0000' };
}

/**
 * A parte do golpe que o imbuement de dano elemental converteu: com o "Dano de
 * <elemento>" do personagem (antes não entrava — auditoria, 29/09) e a
 * resistência do bicho (teto do boss).
 */
export function elementalDoImbuement(hunt, alvo, tipo, parte, ficha = null) {
  const v = Math.round(resistido(hunt, alvo, tipo, parte * (1 + (ficha?.danoDoElemento?.[tipo] ?? 0) / 100), ficha));
  alvo.hp -= v;
  return { v, cor: COR_DO_GOLPE_ELEMENTAL[tipo] ?? Acoes.COR_DO_ELEMENTO[tipo] ?? '#ff0000' };
}

/**
 * O "Dano de <elemento> %" dos atributos no golpe da ARMA: X% do físico (antes
 * da resistência física) sai em cada elemento que o personagem tem, pela
 * resistência do bicho àquele elemento e com a mesma rolagem de crítico. Antes
 * o atributo só aumentava ataques que JÁ eram daquele elemento — num knight,
 * "+20% Dano de Fogo" não fazia nada (auditoria, 29/09). O físico fica de fora:
 * "Dano físico" já multiplica o próprio golpe. Cada elemento leva no mínimo 1 de dano
 * e o efeito visual dele no bicho (`round`).
 */
/**
 * O dano elemental SOMADO das peças do PoE (sistema de itens do PoE, Fase 1): "Adiciona X a Y de Dano de Fogo/Gelo/Raio/Caos". Cada
 * elemento sorteia na faixa, ganha o "Dano de <elemento> %" do personagem, passa pela resistência do bicho àquele elemento e usa a
 * MESMA rolagem de crítico do golpe. Sem peças do PoE a ficha não tem `danoSomado` e nada acontece.
 */
export function danoSomadoDoPoe(estado, hunt, alvo, ficha, rolagem) {
  const saida = [];
  for (const [tipo, [min, max]] of Object.entries(ficha.danoSomado ?? {})) {
    // PoE: "Golpes Críticos de Ataques ignoram a Resistência Elemental dos Monstros Inimigos" — no crítico, a resistência positiva não vale.
    const ignoraRes = !!rolagem?.crit && ModsPoe.valor(ficha, 'critico_ignora_res') > 0 && tipo !== 'physical' && tipo !== 'chaos';
    if (!(max > 0) || (!ignoraRes && resistenciaEfetivaDe(hunt, alvo, tipo, ficha) >= 100)) continue;
    const bruto = (min + Math.random() * (max - min)) * (1 + (ficha.danoDoElemento?.[tipo] ?? 0) / 100);
    const base = Math.max(1, Math.round(ignoraRes ? Math.max(resistido(hunt, alvo, tipo, bruto, ficha), bruto) : resistido(hunt, alvo, tipo, bruto, ficha)));
    const { dano } = Ficha.rolarCritico(estado, base, alvo, [], ficha, rolagem);
    alvo.hp -= dano;
    saida.push({ tipo, v: dano, cor: COR_DO_GOLPE_ELEMENTAL[tipo] ?? Acoes.COR_DO_ELEMENTO[tipo] ?? '#ff0000' });
  }
  return saida;
}

/** A "Raridade de Itens encontrados aumentada" para o drop deste morto (PoE: com as condições dele — "por Inimigos Congelados/Eletrizados"). */
const raridadeDoDrop = (estado, alvo) => ModsPoe.valor(ModsPoe.fichaDoGolpe(Ficha.combate(estado), [], { alvo, estado }), 'item_rarity');

/** Soma faixas por elemento (`{ fire: [a, b] }`). */
const somarFaixas = (a = {}, b = {}) => {
  const s = { ...a };
  for (const [el, [x, y]] of Object.entries(b)) s[el] = [(s[el]?.[0] ?? 0) + x, (s[el]?.[1] ?? 0) + y];
  return s;
};

export function elementalDosAtributos(estado, hunt, alvo, ficha, fisico, rolagem) {
  const saida = [];
  for (const [tipo, pct] of Object.entries(ficha.danoDoElemento ?? {})) {
    if (tipo === 'physical' || !(pct > 0)) continue;
    // Resistência efetiva de 100% (o bicho no teto menos a penetração): nada passa, nem o 1 mínimo.
    if (resistenciaEfetivaDe(hunt, alvo, tipo, ficha) >= 100) continue;
    // Nunca menos que 1: 2,2% de um golpe de 10 dá 0,22 — e o elemento tem de aparecer batendo 1
    // (com o teto de resistência do bicho abaixo de 100%, ninguém é imune). Vale antes e depois do crítico.
    const base = Math.max(1, resistido(hunt, alvo, tipo, (fisico * pct) / 100, ficha));
    const { dano: rolado } = Ficha.rolarCritico(estado, base, alvo, [], ficha, rolagem);
    const dano = Math.max(1, rolado);
    alvo.hp -= dano;
    saida.push({ tipo, v: dano, cor: COR_DO_GOLPE_ELEMENTAL[tipo] ?? Acoes.COR_DO_ELEMENTO[tipo] ?? '#ff0000' });
  }
  return saida;
}

export function round(estado, personagem) {
  const hunt = estado.hunt;
  const eventos = [];
  // No duelo, mirando o adversário: o golpe básico é dele (`Arena.antesDoTique`).
  if (hunt.alvoPvp) return { eventos, bateu: false };
  const alvo = alvoAtual(hunt);
  let bateu = false;

  // Lurando (juntando a leva, ver `atualizarLure`) ele não bate: bater
  // matava os bichos que estava puxando e a leva nunca chegava na meta. O
  // perigo de apanhar sem revidar fica com `atualizarLure`, que manda brigar
  // quando a vida cai abaixo de `VIDA_PARA_DESISTIR_DO_LURE`.
  const arma = armaDoPersonagem(estado);
  // Arco e besta (as armas que o catálogo marca com a munição que aceitam) só atiram com a munição COMPATÍVEL na mão; wand, rod e arma de arremesso não
  // pedem munição, e a magia (gema) nunca pede. A munição é uma peça que dá ataque e não se gasta (decisão do dono: "munição não empilha mais").
  const semMunicao = Equipamento.faltaMunicao(estado);
  if (semMunicao && !hunt.avisouSemMunicao) {
    hunt.avisouSemMunicao = true;
    estado.avisoDaHunt = 'Sem munição compatível equipada: o arco e a besta só atiram com a munição do tipo deles (flecha no arco, bolt na besta).';
  } else if (!semMunicao) hunt.avisouSemMunicao = false;
  if (!hunt.lurando && alvo && !semMunicao && distancia(hunt.pos, alvo) <= alcanceDaArma(arma, estado)) {
    bateu = true;
    // O golpe básico também vira o personagem para o alvo.
    Acoes.virarParaOAlvo(hunt, alvo);
    if (categoriaDaArma(arma) === 'magica') {
      const acertou = golpeDaWand(estado, hunt, alvo, arma, eventos, personagem);
      // Ataque duplo: no máximo UM golpe extra (que não gasta mana e não rola o duplo de novo).
      if (acertou && alvo.hp > 0 && Math.random() < (Ficha.combate(estado).ataqueDuplo ?? 0)) golpeDaWand(estado, hunt, alvo, arma, eventos, personagem, true);
    } else {
      // A perícia REAL da arma (sword/axe/club/distance; sem arma, fist) —
      // o golpe treina ela e o dano usa o valor dela.
      // A ficha do golpe básico: + crítico de auto-ataque da proficiência.
      const fichaDoPersonagem = Ficha.combate(estado);
      const pericia = fichaDoPersonagem.skillName;
      const alvoDoTique = alvo;
      /*
       * ---- O golpe, e o ATAQUE DUPLO ----
       * `segundo`: o golpe EXTRA (chance `ficha.ataqueDuplo`, no máximo UM por golpe — o extra nunca rola o duplo de novo). Ele rola a
       * precisão, o crítico e a resistência dele, mas não gasta nada, não treina, não dá roubo de vida/mana nem charm.
       */
      const golpear = (segundo, alvo = alvoDoTique) => {
        // A ficha DESTE golpe (PoE): os mods condicionais pelas tags do golpe básico (ataque, corpo a corpo/projétil, físico, arco) e pelo
        // alvo, e os sorteios do golpe (dano dobrado, ignorar a redução física) — `itens-poe/mods-poe.mjs`. Sem o PoE, a mesma ficha.
        const ficha = ModsPoe.fichaDoGolpe(fichaDoPersonagem, ModsPoe.tagsDoGolpeBasico(estado, categoriaDaArma(arma)), { alvo, estado });
        const fatorDoGolpe = segundo ? Limites.LIMITES.ataqueDuplo.danoDoSegundoGolpePct / 100 : 1;
        // Accuracy: o golpe pode errar o bicho (a perícia treina igual, como no Tibia).
        if (Defesa.errou(ficha, hunt, alvo)) {
          Treino.treinar(estado, pericia);
          if (categoriaDaArma(arma) === 'distancia') eventos.push({ t: 'shot', id: tiroDaArma(estado, arma), x: hunt.pos.x, y: hunt.pos.y, tx: alvo.x, ty: alvo.y });
          eventos.push({ t: 'block', uid: alvo.uid, x: alvo.x, y: alvo.y, color: '#999999', esquiva: true, errou: true });
          return false;
        }
        // O bicho BLOQUEIA o golpe (só quem tem bloqueio configurado — `mobs/atributos.mjs`): o golpe não causa dano.
      if (AtributosDoMob.bloqueou(alvo)) {
        Treino.treinar(estado, pericia);
        eventos.push({ t: 'block', uid: alvo.uid, x: alvo.x, y: alvo.y, color: '#999999', bloqueado: true });
        return true;
      }
      // Crítico e leech da ficha (base 3%/+60% e o que o equipamento soma).
        // O golpe da arma é físico: "Dano físico" (árvore/afixo) entra aqui.
        // + a afinidade da classe para este golpe (Physical, Melee/Ranged — `Ficha.afinidadePara`, pelas tags dele).
        // + os reforços ligados (Blood Rage no corpo a corpo, Sharpshooter à distância), pelas tags do golpe.
        const tagsDoGolpe = Tags.tagsDoGolpe(categoriaDaArma(arma));
        // No PoE: sem a afinidade de classe do Draevor, e a parte da Força só no corpo a corpo (o arco não ganha dano físico da STR).
        const poe = itensPoeLigado();
        const fisicoDoGolpe = (ficha.danoDoElemento?.physical ?? 0) - (poe && !tagsDoGolpe.includes('melee') ? ficha.danoFisicoDaForca ?? 0 : 0);
        const fisico = 1 + (fisicoDoGolpe + (poe ? 0 : Ficha.afinidadePara(ficha, tagsDoGolpe).pct) + Reforcos.bonus(hunt, 'dano', tagsDoGolpe)) / 100;
        // O físico sem a resistência: é dele que sai o dano elemental dos atributos (abaixo).
        // PoE com duas armas: os golpes ALTERNAM entre a mão principal e a secundária, cada uma com o próprio dano.
        const daSecundaria = !!ficha.duasArmas && (hunt.golpeDaSecundaria = !hunt.golpeDaSecundaria);
        const [faixaMin, faixaMax] = daSecundaria ? [ficha.ataqueSecundarioMin, ficha.ataqueSecundarioMax] : [ficha.ataqueMin, ficha.ataqueMax];
        const fisicoCheio = (R.golpeDoJogador({ ...arma, attack: Math.round((faixaMin + faixaMax) / 2), attackMin: faixaMin, attackMax: faixaMax }, ficha.skillValue, estado.level)) * fisico * fatorDoGolpe;
        // PoE: "Ganha X% do Dano Físico como Dano de Caos/Fogo extra" e "X% do Dano Físico … Convertido para um Elemento Aleatório" — do Físico
        // BASE do golpe (antes dos "aumentado"); o convertido sai do Físico. As partes extras entram como o dano somado (`danoSomadoDoPoe`).
        const { extras: extrasDoFisico, convertidoPct } = poe ? ModsPoe.extrasDoFisico(ficha, fisicoCheio / Math.max(0.01, fisico)) : { extras: {}, convertidoPct: 0 };
        const semResistencia = ModsPoe.semFisico(ficha) ? 0 : fisicoCheio * (1 - convertidoPct / 100);
        const { dano: bruto, crit: critico, onslaught, chance: chanceCritica } = Ficha.rolarCritico(estado, resistido(hunt, alvo, 'physical', semResistencia, ficha), alvo, eventos, ficha);
        registrarGolpe(() => ({ origem: segundo ? 'golpe-basico-2o-golpe' : 'golpe-basico', alvo: alvo.name, tipo: 'physical', danoAntesDaResistencia: Math.round(semResistencia), resistenciaDoAlvo: resistenciaDe(hunt, alvo, 'physical'), penetracao: ficha.penetracao?.fisica ?? 0, resistenciaEfetiva: resistenciaEfetivaDe(hunt, alvo, 'physical', ficha), chanceCritica, critico: critico, danoFinal: bruto, vidaRestante: Math.max(0, alvo.hp - bruto) }));
        if (!segundo) Treino.treinar(estado, pericia);
        // Imbuement de dano elemental: X% do golpe físico vira o elemento (ver `elementalDoImbuement`).
        const convertido = ficha.imbuElemental ? Math.round((bruto * ficha.imbuElemental.pct) / 100) : 0;
        const golpe = bruto - convertido;
        alvo.hp -= golpe;
        Mecanicas.aoReceberDano(estado, hunt, personagem, alvo, golpe, 'physical', eventos);
        const elemental = parteElementalDoGolpe(estado, hunt, alvo, arma, ficha, { crit: critico, onslaught });
        const doImbuement = convertido ? elementalDoImbuement(hunt, alvo, ficha.imbuElemental.tipo, convertido, ficha) : null;
        // "Dano de <elemento> %" dos atributos: o golpe da arma causa, além do
        // físico, X% dele em cada elemento (decisão do dono), na mesma rolagem.
        // (No PoE o "Dano de <elemento> aumentado" só AUMENTA o dano daquele elemento: o golpe físico não ganha partes elementais por ele.)
        const fichaDasPartes = poe ? { ...ficha, danoSomado: ModsPoe.transformarPartes(ficha, somarFaixas(ficha.danoSomado, extrasDoFisico)) } : ficha;
        const dosAtributos = [...(poe ? [] : elementalDosAtributos(estado, hunt, alvo, ficha, semResistencia, { crit: critico, onslaught })), ...danoSomadoDoPoe(estado, hunt, alvo, fichaDasPartes, { crit: critico, onslaught })];
        // Mil mãos, Flecha que atravessa, Chuva de flechas (ver `Arvore.depoisDoGolpe`).
        // O 2º golpe do ataque duplo não repete o que vem DEPOIS do golpe (árvore, roubo de vida e mana, vida/mana por acerto, charms).
        const extra = segundo ? 0 : Arvore.depoisDoGolpe(estado, hunt, alvo, golpe, categoriaDaArma(arma) === 'distancia' ? 'distancia' : 'corpo', eventos);
        if (!segundo) Ficha.aplicarLeech(estado, golpe + (elemental?.v ?? 0) + (doImbuement?.v ?? 0) + dosAtributos.reduce((n, d) => n + d.v, 0) + extra, eventos, personagem.nome, hunt.pos, ficha, alvo.key);
        // Vida/mana por acerto (proficiência).
        // Vida/mana por acerto das peças do PoE ("Concede X de Vida por Inimigo Acertado").
        if (!segundo && (ficha.vidaPorAcerto || ficha.manaPorAcerto)) Ficha.curar(estado, ficha.vidaPorAcerto, ficha.manaPorAcerto, eventos, personagem.nome, hunt.pos);
        // Arma de distância (spear, arco, besta, estrela...): o projétil voa até o
        // alvo antes do dano, igual ao original — antes só a wand mandava `shot`.
        if (categoriaDaArma(arma) === 'distancia') {
          // (PoE: "Velocidade do Projétil aumentada" — o projétil voa mais rápido na tela.)
          const vel = 1 + ModsPoe.valor(ficha, 'projectile_speed') / 100;
          eventos.push({ t: 'shot', id: tiroDaArma(estado, arma), x: hunt.pos.x, y: hunt.pos.y, tx: alvo.x, ty: alvo.y, ...(vel !== 1 ? { vel } : {}) });
        }
        eventos.push({ t: 'fx', id: 1, uid: alvo.uid, x: alvo.x, y: alvo.y });
        // Com parte elemental, o físico sai CINZA e o elemento na cor dele — os dois
        // números do mesmo golpe, como no original.
        eventos.push({ t: 'dmg', uid: alvo.uid, x: alvo.x, y: alvo.y, v: golpe, foe: true, crit: critico, onslaught, alvo: alvo.name, color: elemental || doImbuement || dosAtributos.length ? '#999999' : '#ff0000' });
        if (elemental) eventos.push({ t: 'dmg', uid: alvo.uid, x: alvo.x, y: alvo.y, v: elemental.v, foe: true, crit: critico, onslaught, alvo: alvo.name, color: elemental.cor });
        if (doImbuement) eventos.push({ t: 'dmg', uid: alvo.uid, x: alvo.x, y: alvo.y, v: doImbuement.v, foe: true, crit: critico, onslaught, alvo: alvo.name, color: doImbuement.cor });
        for (const d of dosAtributos) {
          // O efeito do elemento no bicho (chama, gelo, raio...) junto do número colorido.
          eventos.push({ t: 'fx', id: EFEITO_DO_ELEMENTO[d.tipo] ?? 13, uid: alvo.uid, x: alvo.x, y: alvo.y });
          eventos.push({ t: 'dmg', uid: alvo.uid, x: alvo.x, y: alvo.y, v: d.v, foe: true, crit: critico, onslaught, alvo: alvo.name, color: d.cor });
        }
        // As afecções do PoE (incêndio, sangramento, veneno, congelar, eletrizar, resfriar — `itens-poe/afeccoes.mjs`, só com ITENS_POE=1):
        // o golpe da arma é ATAQUE; cada parte (o físico e os elementos) entra com o tipo dela.
        // Os efeitos de acerto do PoE (atordoamento, Mutilar, Cegar, Empalar, Empurrar, Provocar, Fúria, Escudo por acerto — `itens-poe/mods-poe.mjs`).
        const doAcerto = poe ? ModsPoe.aoAcertar(estado, hunt, alvo, ficha, { dano: golpe + (elemental?.v ?? 0) + dosAtributos.reduce((n, d) => n + d.v, 0), fisico: golpe, crit: critico, eventos, personagem, mover: (b) => ModsPoe.empurrar(hunt, b), elementos: ['physical', ...dosAtributos.map((d) => d.tipo), ...(elemental ? [elemental.tipo ?? arma?.element?.type] : [])] }) : null;
        // A carga de Frenesi "ao Acertar um Inimigo Único" (cargas do PoE).
        if (CargasPoe.reageAoAcerto(ficha.cargas) && CargasPoe.aoAcertar(estado, ficha.cargas, alvo, { crit: critico, corpoACorpo: categoriaDaArma(arma) !== 'distancia', atordoou: !!doAcerto?.atordoou }).length) Ficha.invalidar(estado);
        if (ficha.afeccoes) {
          // O dano das afecções sai do acerto SEM o multiplicador de crítico (como no PoE: o crítico não multiplica o dano ao longo do tempo);
          // o físico já é o de antes da rolagem, e as partes elementais (roladas junto com o crítico) voltam ao valor sem ele.
          const semCritico = (v) => (critico ? v / Math.max(1, ficha.critMultiplier ?? 1) : v);
          const partes = [{ elemento: 'physical', dano: semResistencia }, ...dosAtributos.map((d) => ({ elemento: d.tipo, dano: semCritico(d.v) }))];
          const postos = AfeccoesPoe.aoAcertar(alvo, partes, { afeccoes: ficha.afeccoes, crit: critico, ataque: true, agora: hunt.clock ?? 0, salaDeBoss: !!hunt.isBoss });
          for (const st of postos) eventos.push({ t: 'estado', uid: alvo.uid, x: alvo.x, y: alvo.y, estado: st });
          ModsPoe.aoPorAfeccoes(estado, hunt, alvo, ficha, postos, { eventos, personagem });
        }
        // Os charms ofensivos apontados para esta criatura (ver `charms.mjs`).
        if (!segundo) Charms.aoAcertar(estado, hunt, alvo, eventos);
        // As auras ligadas marcam o bicho atingido (vulnerável, enfraquecido).
        Reforcos.marcar(hunt, alvo);
        return true;
      };
      if (!golpear(false)) return { eventos, bateu };
      // PoE: os projéteis a mais e a perfuração do golpe básico de longe ("Ataques com Arco disparam N Flechas adicionais", "Projéteis
      // Perfuram N Alvos adicionais"): cada um acerta OUTRO bicho (os mais perto do alvo, ao alcance), com o golpe inteiro.
      if (itensPoeLigado() && categoriaDaArma(arma) === 'distancia') {
        const fichaDoTiro = ModsPoe.fichaDoGolpe(fichaDoPersonagem, ModsPoe.tagsDoGolpeBasico(estado, 'distancia'), { estado });
        for (const outro of ModsPoe.alvosDosProjeteisExtras(hunt, alvo, ModsPoe.valor(fichaDoTiro, 'extra_projectiles') + ModsPoe.valor(fichaDoTiro, 'perfurar'), alcanceDaArma(arma, estado))) {
          if (outro.hp > 0) golpear(false, outro);
        }
      }
      if (alvo.hp > 0 && Math.random() < (fichaDoPersonagem.ataqueDuplo ?? 0)) golpear(true);
    }
    // Momentum (tier do elmo): a cada golpe, chance de tirar 2s de todas as recargas.
    if (Tiers.rolar(estado, 'head')) {
      for (const cd of Object.values(hunt.cooldowns ?? {})) if (cd?.ate) cd.ate = Math.max(hunt.clock ?? 0, cd.ate - 2000);
    }
    if (alvo.dummy) {
      alvo.hp = alvo.maxHp; // o boneco não morre
      Treino.treinar(estado, 'shielding'); // no pátio o escudo sobe junto (a faixa do HUD)
    }
    else if (alvo.hp <= 0) matarMonstro(estado, hunt, personagem, alvo, eventos);
    // Quem caiu com o dano extra da árvore (Chuva de flechas, Flecha que atravessa).
    processarMortes(estado, personagem, eventos);
  }
  return { eventos, bateu };
}
