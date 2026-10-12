// Os poderes dos bosses e dos bichos das hunts: melee e magias de
// `gamedata/boss-poderes.json` e `monstro-poderes.json` (os ataques do
// monster.lua do Canary, o datapack do original — ver
// `tools/gerar-poderes-dos-bosses.mjs`).
//
// Nas hunts (Winter Dream Court, 2026-09-24, `api-mapeada/captura-monstros-0924/`,
// 1.160 golpes): os mesmos golpes do arquivo, com os mesmos efeitos (gelo em
// área → fx 42, gelo em feixe → 53, sagrado em área → 50, energia em feixe →
// 38); metade dos golpes até 79% do máximo, 97% até 1,11x. Os 2% raros de até
// ~2x não têm explicação ainda e não estão aqui.
//
// O que o original manda, capturado ao vivo em 22 salas (Zoros, 2026-09-24,
// `api-mapeada/captura-bosses-0924/`):
// - `{t:'dmg', uid:'player', de:<boss>, golpe:'de morte em área', color:'#990000'}`
//   — o golpe é "de <elemento> em <forma>" (área = raio, feixe = linha, sem
//   forma = a magia no alvo); cada elemento com a sua cor.
// - Cada golpe cai na faixa min..max do arquivo, depois da proteção do
//   personagem (Gaffir: terra em área 614 de 500..620; Goshnar's Greed: morte
//   em área 1.706..1.907 de 1.500..2.000).
// - A área se desenha como um `fx` do efeito em CADA casa dela (Essence of
//   Malice: 69 `fx` 18 num raio 4).
// - O melee dos bosses é o do arquivo (Essence of Malice: 1..488 de 0..603) —
//   não o `ataqueDoMonstro` genérico, que dava 25 mil num boss de 50 mil de vida.
import * as Formulas from './combate/formulas.mjs';
import * as Controle from './combate/controle.mjs';
import * as AtributosDoMob from './mobs/atributos.mjs';
import * as Dot from './combate/dot.mjs';
import { readFileSync } from 'node:fs';
import * as Overrides from './overrides.mjs';
import { OVERRIDES_DE_MONSTROS, resultadoDosOverrides } from './dados.mjs';
import * as Arvore from './arvore.mjs';
import * as Areas from '../engine/areas.mjs';
import * as Prey from './prey.mjs';
import * as Charms from './charms.mjs';
import * as Defesa from './personagem/defesa.mjs';
import * as Reforcos from './skills/reforcos.mjs';
import * as CargasPoe from './itens-poe/cargas.mjs';
import * as ModsPoe from './itens-poe/mods-poe.mjs';
import * as Protecao from './protecao.mjs';
import * as Plantadas from './itens-poe/armas-plantadas.mjs';

const ler = (arquivo) => JSON.parse(readFileSync(new URL(`../gamedata/${arquivo}`, import.meta.url), 'utf8'));
const PODERES = { ...ler('monstro-poderes.json').monstros, ...ler('boss-poderes.json').bosses };
// Os ataques que o dono sobrescreveu (`gamedata/overrides/monstros.json`, validados e aplicados ao bestiário em `dados.mjs`): só entram para quem passou.
export const ESTADO_DE_PODERES = Overrides.criarEstadoDeCamada();
const validosDoBoot = () => [...resultadoDosOverrides.aplicados, ...resultadoDosOverrides.criados];
Overrides.reaplicarNosPoderes(PODERES, ESTADO_DE_PODERES, OVERRIDES_DE_MONSTROS, validosDoBoot());
/** Hot Reload: re-aplica os ataques dos overrides (só para as chaves que passaram na validação). Devolve `{ feitos, mudados }`. */
export const recarregarPoderes = (dados, validas) => Overrides.reaplicarNosPoderes(PODERES, ESTADO_DE_PODERES, dados, validas);
/** Os poderes cadastrados de um bicho (para conferir o que o jogo vai lançar). */
export const poderesDe = (key) => PODERES[key] ?? null;
/** Registra os poderes de um bicho criado em tempo de execução (os monstros da campanha do PoE — `itens-poe/monstros.mjs`). */
export function registrarPoderes(key, def, { forcar = false } = {}) {
  if (!PODERES[key] || forcar) PODERES[key] = def;
}

const NOME_DO_ELEMENTO = {
  physical: 'físico', fire: 'de fogo', ice: 'de gelo', earth: 'de terra', energy: 'de energia',
  death: 'de morte', holy: 'sagrado', lifedrain: 'de dreno de vida', manadrain: 'de dreno de mana', drown: 'de afogamento',
};
// As capturadas (gelo: Winter Dream Court; o dreno de mana sai VERMELHO, Enfeebled
// Silencer na Feyrist Nightmare); afogamento nunca apareceu (cor do Tibia).
const COR_DO_ELEMENTO = {
  physical: '#ff0000', fire: '#ff9900', earth: '#00ff00', energy: '#cc33cc', death: '#990000', holy: '#ffff00',
  lifedrain: '#ff0000', ice: '#99ffff', manadrain: '#ff0000', drown: '#00ccff',
};
const FORMA = { area: ' em área', feixe: ' em feixe', alvo: '' };
export const EFEITO_PADRAO = { physical: 35, fire: 7, ice: 42, earth: 21, energy: 38, death: 18, holy: 50, lifedrain: 14, manadrain: 13, drown: 26 };
/** O sangue no jogador a cada golpe que passa (o original manda `fx` 1 junto de todo dano). */
const EFEITO_DO_SANGUE = 1;

/** O nome do golpe como o original escreve: o físico no alvo é "à distância" (Ghastly Dragon). */
function nomeDoGolpe(a) {
  // Boss único: o golpe leva o nome que o cadastro deu (as magias dos arquivos não têm `golpe`).
  if (a.golpe) return a.golpe;
  if (a.elemento === 'physical' && a.forma === 'alvo') return 'à distância';
  return `${NOME_DO_ELEMENTO[a.elemento] ?? a.elemento}${FORMA[a.forma]}`;
}

const sortear = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const distancia = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/** A distância em casas (a regra de alcance das magias). */
export const distanciaAte = distancia;

export const temPoderes = (bicho) => !!PODERES[bicho?.key];

/*
 * (PoE, 12/10) O que o ACERTO do bicho faz em você além do dano (Cegar, Exposição, Sangue Corrompido, o dreno e as cargas do monstro, a
 * afecção inerente do Golpe Crítico): quem registra é `mobs/mecanicas.mjs` (que importa este módulo — evita o ciclo de importação). `var`
 * sem valor inicial: o registro pode chegar ANTES do corpo deste módulo rodar (quando ele é o primeiro importado), e o `let` daria erro.
 */
// eslint-disable-next-line no-var
var aoAcertarJogador;
export function definirAoAcertarJogador(fn) { aoAcertarJogador = fn; }


/**
 * Os ataques de um bicho para a FICHA (bestiário e prévia da hunt): os mesmos do arquivo que `lancar` e
 * `golpeCorpoACorpo` sorteiam, com o dano-BASE (`min`..`max`, antes de fase, raridade, proteção e armadura).
 * `null` = o bicho não tem arquivo de poderes (nada a mostrar — a ficha não inventa). O melee é físico;
 * `estimado` marca os golpes cujo valor o gerador dos dados estimou (a magia não tinha número no monster.lua).
 */
export function ataquesParaFicha(key) {
  const p = PODERES[key];
  if (!p) return null;
  return p.ataques.map((a) => ({
    tipo: a.tipo,
    elemento: a.tipo === 'melee' ? 'physical' : a.elemento,
    // Cinco golpes dos dados vêm com a faixa invertida (140..80) e um melee negativo (0..-6160, que na luta não causa dano):
    // a ficha mostra a faixa que o combate de fato sorteia — ordenada e sem negativos. Os dados não são tocados.
    min: Math.max(0, Math.min(a.min, a.max)),
    max: Math.max(0, Math.max(a.min, a.max)),
    intervalo: a.intervalo,
    chance: a.chance,
    forma: a.forma ?? null,
    raio: a.raio || 0,
    comprimento: a.comprimento || 0,
    estimado: !!a.estimado,
  }));
}

/** Boss cujo arquivo não tem melee (Brain Head, Malofur, The Nightmare Beast): só magia. */
// Boss único: só bate de perto se o cadastro deu um `melee` (a regra genérica daria milhares num chefe de muita vida).
export const semCorpoACorpo = (bicho) => (bicho?.boss ? !bicho.boss.melee : !!PODERES[bicho?.key] && !PODERES[bicho.key].ataques.some((a) => a.tipo === 'melee'));

/** O EFEITO na tela quando o golpe corpo a corpo acerta (o id do efeito do Tibia): o do cadastro (aba Mobs → Ataques e efeitos) ou o sangue (1). */
export const efeitoDoGolpe = (bicho) => (bicho?.boss ? bicho.boss.melee?.efeito : PODERES[bicho?.key]?.ataques.find((a) => a.tipo === 'melee')?.efeito) ?? EFEITO_DO_SANGUE;

/** O melee do arquivo; `null` = bicho sem poderes (usa a regra de sempre); 0 = boss sem melee. */
export function golpeCorpoACorpo(bicho) {
  if (bicho?.boss) return bicho.boss.melee ? sortear(bicho.boss.melee.min, bicho.boss.melee.max) : 0;
  const p = PODERES[bicho?.key];
  if (!p) return null;
  const m = p.ataques.find((a) => a.tipo === 'melee');
  if (!m || Math.random() * 100 >= m.chance) return 0;
  return sortear(m.min, m.max);
}

/** As casas que a magia pega (para acertar o jogador e para desenhar o efeito) — geometria de `engine/areas.mjs`. */
function casasDa(a, bicho, alvo) {
  if (a.forma === 'area') return Areas.circulo(a.noAlvo ? alvo : bicho, a.raio);
  // Sai para o lado em que o jogador está (o boss vira para ele), e abre em leque quando tem `espalha` (as ondas).
  if (a.forma === 'feixe') return Areas.feixe(bicho, alvo, a.comprimento, !!a.espalha);
  return [{ x: alvo.x, y: alvo.y }];
}

/** As casas que uma magia de monstro pega saindo de `origem` na direção de `alvo` (o espectro do PoE usa as do monstro erguido). */
export const casasDaMagia = (a, origem, alvo) => casasDa(a, origem, alvo);

export function alcanca(a, bicho, alvo) {
  const d = distancia(bicho, alvo);
  if (a.forma === 'alvo' || (a.forma === 'area' && a.noAlvo)) return d <= (a.alcance || 7);
  return casasDa(a, bicho, alvo).some((c) => c.x === alvo.x && c.y === alvo.y);
}

/**
 * A cada tique da sala: cada magia do boss no seu intervalo, com a sua chance.
 * `ficha` é a `Ficha.combate` do personagem (proteção por elemento). Devolve o
 * dano total causado (para quem quiser saber).
 */
/**
 * O dano que JÁ passou pela resistência do elemento chega no jogador: Energy
 * Shield, magic shield (`temEscudo`), a árvore (absorção, Última muralha...),
 * a vida, o sangue na tela, o número e os charms defensivos. Devolve o que
 * tirou da vida. É o mesmo caminho para as magias dos bosses e para as
 * mecânicas dos mobs (explosão, aura, veneno, reflexo — `mobs/mecanicas.mjs`).
 */
export function aplicarNoJogador({ estado, hunt, bicho, dano, elemento, eventos, base, ficha, temEscudo, suprimiu = false }) {
  // Numa Safe Zone, nada fere o jogador — magia, mecânica, dano contínuo (`protecao.mjs`).
  if (Protecao.imune(hunt)) return 0;
  // (PoE: "X% do dano mágico sofrido suprimido ignora o escudo de energia" — essa parte vai direto.)
  const direto = suprimiu ? Math.round((dano * Math.min(100, ModsPoe.valor(ficha, 'suprimido_ignora_escudo'))) / 100) : 0;
  dano -= direto;
  // PoE: o dano de CAOS atravessa o Escudo de Energia (a menos que um único diga que não); a espera da recarga reinicia do mesmo jeito.
  // (+ ciclo 7, lote E: "X% do dano de caos sofrido não ignora o escudo de energia" — essa parte passa pelo escudo.)
  if (elemento === 'chaos' && ModsPoe.caosAtravessaOEscudo(ficha)) {
    estado.esEspera = Defesa.esperaDaRecarga(ficha);
    const peloEscudo = Math.round((dano * Math.min(100, ModsPoe.valor(ficha, 'caos_pelo_escudo_pct'))) / 100);
    if (peloEscudo > 0) dano = dano - peloEscudo + Defesa.absorver(estado, ficha, peloEscudo, eventos, base);
  }
  // ("Dano Físico sofrido ignora o Escudo de Energia".)
  else if (elemento === 'physical' && ModsPoe.valor(ficha, 'fisico_ignora_escudo') > 0) estado.esEspera = Defesa.esperaDaRecarga(ficha);
  else dano = Defesa.absorver(estado, ficha, dano, eventos, base);
  if (direto > 0) { dano += direto; estado.esEspera = Defesa.esperaDaRecarga(ficha); }
  // (o "X% do Dano de Acertos é sofrido na Vida do seu Totem mais próximo antes da sua" sai no `Arvore.danoRecebido`, logo abaixo.)
  if (dano > 0 && temEscudo && (estado.mana ?? 0) > 0) {
    const daMana = Math.min(estado.mana, dano);
    estado.mana -= daMana;
    dano -= daMana;
    eventos.push({ t: 'dmg', ...base, v: daMana, color: '#4fc3ff' });
  }
  dano = Arvore.danoRecebido(estado, dano, eventos, { x: base.x, y: base.y }, base.quem, { ficha, elemento });
  // As cargas do PoE: a magia do bicho também conta como "acertado" (recentemente, e a chance de Tolerância).
  if (ficha?.cargas) CargasPoe.aoSerAcertado(estado, ficha.cargas);
  if (dano <= 0) return 0;
  estado.hp = Math.max(0, estado.hp - dano);
  eventos.push({ t: 'fx', id: EFEITO_DO_SANGUE, uid: 'player', x: base.x, y: base.y });
  eventos.push({ t: 'dmg', ...base, v: dano, color: COR_DO_ELEMENTO[elemento] ?? '#ff0000' });
  // Parry e Numb (charms defensivos).
  Charms.depoisDeApanhar(estado, hunt, bicho, dano, eventos);
  return dano;
}

/**
 * UMA magia do bicho, da esquiva ao dano no jogador (sem o relógio, a chance e o alcance, que são de quem chama).
 * `casas`: as casas já decididas (a magia TELEGRAFADA de um boss único as fixa no aviso); sem isso, a geometria do
 * momento. Devolve o dano que chegou na vida do jogador. É o corpo que `lancar` sempre teve, extraído para os
 * bosses únicos (`bosses-unicos/`) reaproveitarem a MESMA esquiva, proteção, escudo, charms e efeitos.
 */
export function dispararMagia({ estado, hunt, personagem, bicho, eventos, agora, ficha, temEscudo }, a, { casas: casasFixas = null } = {}) {
  const alvo = hunt.pos;
  // Esquiva das gemas: a magia inteira não pega (o efeito na tela sai igual).
  // "Chance to Avoid Damage" (add) também evita a magia inteira (a Evasion não: só o golpe corpo a corpo).
  // + a esquiva de magia de LONGE dos reforços (Divine Defiance): só se o bicho não está colado.
  const deLonge = Math.max(Math.abs(bicho.x - alvo.x), Math.abs(bicho.y - alvo.y)) > 1;
  const esquivaDeLonge = deLonge ? Reforcos.bonus(hunt, 'esquivaDeLonge') / 100 : 0;
  // (+ PoE: "X% de chance de evitar Projéteis" — a magia de longe com projétil do bicho.)
  const projetil = a.tiro != null;
  const evitaProjetil = projetil ? ModsPoe.valor(ficha, 'evitar_projeteis') : 0;
  // (PoE, 11/10: o projétil FÍSICO do bicho é um Ataque de Projétil — a Evasão vale nele, como no golpe corpo a corpo, `Defesa.esquivou`; a
  // magia — o resto — pode ser Esquivada pela Esquiva Mágica da Acrobacia, `ficha.esquivaMagica`.)
  const projetilDeAtaque = projetil && a.elemento === 'physical';
  const esquivou = (ficha.esquiva && Math.random() < ficha.esquiva) || Defesa.evitou(ficha) || (esquivaDeLonge > 0 && Math.random() < esquivaDeLonge) || (evitaProjetil > 0 && Math.random() * 100 < evitaProjetil)
    || (projetilDeAtaque && Defesa.esquivou(ficha, hunt, bicho, { projetil: true })) || (!projetilDeAtaque && (ficha.esquivaMagica ?? 0) > 0 && Math.random() < ficha.esquivaMagica);
  // Dodge (charm) também: sai o `block` dele e o golpe não pega.
  const doCharm = !esquivou && Charms.desviou(estado, hunt, personagem, bicho, eventos);
  // Bloqueio de MAGIA (`bloqueio.modo` = 'poe', `combate/formulas.json`): depois da esquiva, a magia pode ser bloqueada (`ficha.bloqueioDeMagia`);
  // com `glancingPct` ela ainda causa essa % do dano, senão não causa nada.
  let fatorDoBloqueio = 1;
  let bloqueouAMagia = false;
  // ("Chance de Bloquear é Sortuda", "A Chance de Bloquear o Dano Mágico é Azarada": rola duas vezes — `ModsPoe.sorteado`.)
  const bloqueiaMagia = () => ModsPoe.sorteado(ficha.bloqueioDeMagia ?? 0, ModsPoe.valor(ficha, 'bloqueio_sortudo'), ModsPoe.valor(ficha, 'bloqueio_azarado') + ModsPoe.valor(ficha, 'bloqueio_magia_azarado'), Math.random, ModsPoe.valor(ficha, 'sorte_tres_jogadas') > 0);
  // (+ "+X% de chance de Bloquear o Dano de Ataques de Projéteis": o projétil do bicho tem mais uma chance de ser bloqueado.)
  const bloqueiaProjetil = () => projetil && ModsPoe.valor(ficha, 'bloqueio_projetil') > 0 && Math.random() * 100 < ModsPoe.valor(ficha, 'bloqueio_projetil');
  if (!esquivou && !doCharm && Formulas.PARAMETROS.bloqueio.modo === 'poe' && (bloqueiaMagia() || bloqueiaProjetil())) {
    const glancing = Formulas.PARAMETROS.bloqueio.glancingPct;
    if (glancing > 0) fatorDoBloqueio = glancing / 100;
    else bloqueouAMagia = true;
    // PoE: os eventos "ao Bloquear" dos únicos e o "Bloqueou Recentemente".
    ModsPoe.marcar(hunt, 'bloqueou');
    // (o bloqueio da magia de um Elite/Chefe trava a próxima ação — a Recuperação de Bloqueio encurta)
    Controle.travarNoBloqueio(hunt, bicho, ficha);
    ModsPoe.abrirRetaliacao(hunt, 'bloquear', ficha.afPoe);
    ModsPoe.evento(estado, hunt, 'bloquear', ficha, { alvo: bicho, eventos, personagem });
    // ("ao Bloquear o Dano de Ataques" / "ao Bloquear Dano Mágico": o evento de cada tipo de bloqueio.)
    ModsPoe.evento(estado, hunt, 'bloquearMagia', ficha, { alvo: bicho, eventos, personagem });
  }

  const efeito = a.efeito ?? EFEITO_PADRAO[a.elemento];
  if (a.tiro != null) eventos.push({ t: 'shot', id: a.tiro, x: bicho.x, y: bicho.y, tx: alvo.x, ty: alvo.y });
  // A área na tela: um evento só, com as casas que acertam (antes: um `fx` por casa, cortado em 90).
  const casas = casasFixas ?? casasDa(a, bicho, alvo);
  // (PoE, 12/10) A magia em área do bicho destrói as Armadilhas e Minas plantadas que pega ("… não podem ser Danificadas" impede).
  if (a.min > 0 || a.max > 0) Plantadas.destruirNaArea(hunt, casas, ficha);
  if (casas.length > 1) eventos.push({ t: 'area', id: efeito, x: bicho.x, y: bicho.y, casas: Areas.paraTela(casas, bicho) });
  else for (const c of casas) eventos.push({ t: 'fx', id: efeito, x: c.x, y: c.y });

  if (doCharm) return 0;
  if (bloqueouAMagia) {
    eventos.push({ t: 'block', uid: 'player', quem: personagem.nome, x: alvo.x, y: alvo.y, color: '#999999' });
    return 0;
  }
  if (esquivou) {
    eventos.push({ t: 'block', uid: 'player', quem: personagem.nome, x: alvo.x, y: alvo.y, color: '#999999', esquiva: true });
    return 0;
  }
  // (PoE: com as conversões do dano recebido — "X% do Dano de Fogo dos Acertos recebido como Dano de Gelo".)
  const fatorDaResistencia = ModsPoe.fatorDaResistenciaRecebida(ficha, a.elemento);
  // `forca`: o degrau da Arena x1 (+15% a cada 2 min).
  // A magia é cortada pela resistência do elemento (em %); a antiga armadura
  // mágica virou o Energy Shield (absorve abaixo, antes do magic shield e da vida).
  // `forcaDoBicho`: a força × a marca de enfraquecido (Aura of Sapped Strength).
  // O CRÍTICO do mob (só quem tem — `mobs/atributos.json`): rola UMA vez e vale para a magia toda, todos os tipos de dano.
  // (PoE: a chance × o Cego, o dano extra × "Dano Extra recebido de Acertos Críticos reduzido"; o Exaurido causa 10% menos dano.)
  const critDoMob = ModsPoe.criticoDoBicho(AtributosDoMob.critico(bicho, a), bicho, ficha, agora) ?? AtributosDoMob.rolarCritico(bicho, a);
  // (+ PoE: "Dano Mágico Sofrido de Inimigos Cegos reduzido em X%" — o bicho cego.)
  const deCego = ModsPoe.ativo(bicho?.estados?.cego, agora) ? Math.max(0, 1 - ModsPoe.valor(ficha, 'dano_magico_de_cegos_red') / 100) : 1;
  const forcaDaMagia = Reforcos.forcaDoBicho(bicho, agora) * fatorDoBloqueio * critDoMob.fator * ModsPoe.doBicho(bicho, agora, { ficha }).danoFator * deCego;
  // `extras` da magia: dano de OUTROS tipos no mesmo lançamento, cada um com a proteção do SEU elemento.
  // ("O Dano de Raio dos Inimigos Acertando você é Sortudo": a parte de Raio rola duas vezes e fica a maior.)
  const raioSortudo = ModsPoe.valor(ficha, 'dano_raio_recebido_sortudo') > 0;
  // ("Excomunga inimigos…": o excomungado não causa dano de Caos — `ModsPoe.semCaos`.)
  const excomungado = ModsPoe.semCaos(bicho, agora);
  const rolar = (el, min, max) => (excomungado && el === 'chaos' ? 0 : raioSortudo && el === 'energy' ? Math.max(sortear(min, max), sortear(min, max)) : sortear(min, max));
  // (+ "Armadura também é aplicada no Dano de Raio sofrido de Acertos": a armadura sobre a parte daquele tipo — `ModsPoe.armaduraNoElemento`.)
  // (PoE, as ascendências: "Inimigos próximos causam X% menos Dano Elemental" — a aura põe `elemMenos` nos de perto, `mods-poe.aurasProximas`.)
  const elemFator = (el) => (['fire', 'ice', 'energy'].includes(el) && ModsPoe.ativo(bicho?.estados?.elemMenos, agora) ? Math.max(0, 1 - bicho.estados.elemMenos.pct / 100) : 1);
  // (12/10: o dano de cada tipo — antes e depois das suas resistências — para o que o acerto faz além do dano: `aoAcertarJogador`.)
  const brutas = {};
  const partes = {};
  const somarParte = (el, antes, depois) => { brutas[el] = (brutas[el] ?? 0) + antes; partes[el] = (partes[el] ?? 0) + depois; return depois; };
  const doutrosTipos = AtributosDoMob.danoExtraDoGolpe(null, a).reduce((n, x) => { const parte = rolar(x.elemento, x.min, x.max) * forcaDaMagia * elemFator(x.elemento); return n + somarParte(x.elemento, parte, parte * ModsPoe.fatorDaResistenciaRecebida(ficha, x.elemento) * ModsPoe.armaduraNoElemento(ficha, x.elemento, parte)); }, 0);
  // (O MAPA do endgame: o dano extra por elemento em % do dano da magia — `bicho.danoExtraPct`.)
  // (ciclo 7, lote E: "Dano de Raio dos Inimigos Acertando você enquanto você estiver Eletrizado é Azarado"; "O Dano dos Inimigos Acertando
  // você é Azarado" — `dano_recebido_azarado`: o menor de dois sorteios.)
  const azarado = ModsPoe.valor(ficha, 'dano_recebido_azarado') > 0 || (a.elemento === 'energy' && ModsPoe.valor(ficha, 'raio_azarado_eletrizado') > 0 && (hunt.efeitosDoJogador?.dots ?? []).some((d) => d.tipo === 'choque' && d.falta > 0));
  // ("-N de Dano Físico sofrido por Ataques de Projéteis": o fixo a menos no projétil físico do bicho.)
  const daMagia = Math.max(0, (azarado ? Math.min(rolar(a.elemento, a.min, a.max), rolar(a.elemento, a.min, a.max)) : rolar(a.elemento, a.min, a.max)) * forcaDaMagia * elemFator(a.elemento) + (projetil && a.elemento === 'physical' ? ModsPoe.valor(ficha, 'fisico_sofrido_projetil') : 0));
  const extraDoMapa = AtributosDoMob.danoExtraPctDoBicho(bicho).reduce((n, x) => n + somarParte(x.elemento, daMagia * (x.pct / 100), daMagia * (x.pct / 100) * ModsPoe.fatorDaResistenciaRecebida(ficha, x.elemento)), 0);
  // PoE 1 (dono, 10/10): a magia FÍSICA do bicho também é um acerto físico — passa pela armadura do personagem, somada à redução física
  // adicional, no teto de 90% (`ModsPoe.acertoFisicoRecebido`), como o golpe corpo a corpo.
  // ("Armadura contra Projéteis aumentada em X%": a armadura do personagem no projétil físico do bicho.)
  // (+ "Defende com X% da Armadura contra Ataques de Projéteis" — a armadura × X%.)
  const defendeCom = projetil ? ModsPoe.valor(ficha, 'armadura_projetil_defende_pct') : 0;
  const armaduraContra = (ficha.armor ?? 0) * (projetil ? 1 + ModsPoe.valor(ficha, 'armadura_projetil_inc') / 100 : 1) * (defendeCom > 0 ? defendeCom / 100 : 1);
  const daParteDaMagia = a.elemento === 'physical' && ModsPoe.somaFisicaDoPoe() ? ModsPoe.acertoFisicoRecebido(ficha, daMagia, armaduraContra) : daMagia * fatorDaResistencia * ModsPoe.armaduraNoElemento(ficha, a.elemento, daMagia);
  somarParte(a.elemento, daMagia, daParteDaMagia);
  const bruto = daParteDaMagia + doutrosTipos + extraDoMapa;
  // A SUPRESSÃO DE FEITIÇO do PoE: a magia suprimida causa 50% menos dano (`ficha.supressaoDeMagia`, a chance) — sorteada ANTES das
  // afecções: "Dano Mágico Suprimido não pode infligir Afecções Elementais em você" (a árvore) as tira da magia suprimida.
  // (+ ciclo 7, lote F: "Chance de Suprimir Dano Mágico é Sortuda" — o melhor de dois sorteios.)
  const sorteioDaSupressao = ModsPoe.valor(ficha, 'supressao_sortuda') > 0 ? Math.min(Math.random(), Math.random()) : Math.random();
  const suprimiu = (ficha.supressaoDeMagia ?? 0) > 0 && sorteioDaSupressao < ficha.supressaoDeMagia;
  const semElementais = suprimiu && (Number(ficha.afPoe?.suprimido_sem_afeccao_elemental) || 0) > 0;
  // Os EFEITOS da magia (`efeitos` do ataque): dano contínuo no jogador pelo motor `combate/dot.mjs`.
  for (const ef of AtributosDoMob.efeitosDoGolpe(null, a)) {
    if (Math.random() * 100 >= (ef.chance ?? 100) + ModsPoe.chanceExtraDeSer(ficha, ef.tipo)) continue;
    if (semElementais && ['queimadura', 'choque', 'gelo'].includes(ef.tipo)) continue;
    const posto = ModsPoe.dotNoJogador(hunt, { tipo: ef.tipo, total: (sortear(a.min, a.max) * ef.pctDoGolpe) / 100, duracaoMs: ef.duracaoMs ?? null, origem: { fonte: 'mob', mob: bicho.name, uid: bicho.uid, key: bicho.key } }, hunt.clock ?? agora);
    if (posto) eventos.push({ t: 'estado', uid: 'player', quem: personagem.nome, x: alvo.x, y: alvo.y, estado: posto, de: bicho.name });
  }
  // A magia ACERTOU (passou da esquiva e do bloqueio): boss e elite podem CONGELAR, ATORDOAR ou fazer LENTIDÃO no jogador (`combate/controle.mjs`).
  if (a.min > 0 || a.max > 0) {
    const controle = Controle.tentar(hunt, bicho, ficha, hunt.clock ?? 0, Math.random, { semAfeccaoElemental: semElementais, soFisico: a.elemento === 'physical', estado, semAtordoamento: suprimiu && ModsPoe.valor(ficha, 'suprimido_sem_atordoamento') > 0 });
    if (controle) eventos.push({ t: 'estado', uid: 'player', quem: personagem.nome, x: alvo.x, y: alvo.y, estado: controle, de: bicho.name });
  }
  // PoE: os eventos "ao Suprimir Dano Mágico" dos únicos.
  if (suprimiu) ModsPoe.evento(estado, hunt, 'suprimir', ficha, { alvo: bicho, eventos, personagem });
  // (A supressão previne 50% — + "Ignora/Impede +X% do Dano Mágico Suprimido", "X% de quantidade de Dano Mágico Suprimido Ignorado".)
  const prevenido = suprimiu ? Math.min(100, 50 + ModsPoe.valor(ficha, 'supressao_prevenida')) / 100 : 0;
  // (PoE, o Sabotador: "X% de chance de sofrer Y% menos Dano em Área de Acertos" — a magia em área do bicho.)
  const menosEmArea = casas.length > 1 && Math.random() * 100 < ModsPoe.valor(ficha, 'area_recebida_menos_chance') ? Math.max(0, 1 - ModsPoe.valor(ficha, 'area_recebida_menos_pct') / 100) : 1;
  let dano = Math.round(bruto * (1 - prevenido) * menosEmArea * Prey.fatorDeDefesa(estado, bicho.key) * (1 - (ficha.danoRecebidoDasGemas ?? 0)) * (1 + (Number(ficha.afPoe?.dano_magico_recebido_inc) || 0) / 100) + ModsPoe.fixoRecebido(ficha, a.elemento));
  const danoDoAcerto = dano;
  const base = { uid: 'player', quem: personagem.nome, x: alvo.x, y: alvo.y, foe: false, de: bicho.name, golpe: nomeDoGolpe(a) };
  // Void Inversion (charm): o dreno de mana vira ganho de mana.
  if (a.elemento === 'manadrain' && Charms.inverteDreno(estado, bicho)) {
    const ganho = Math.min(dano, Math.max(0, (estado.maxMana ?? 0) - (estado.mana ?? 0)));
    estado.mana = (estado.mana ?? 0) + ganho;
    if (ganho > 0) eventos.push({ t: 'heal', uid: 'player', quem: personagem.nome, x: alvo.x, y: alvo.y, v: ganho, color: '#4fc3ff' });
    return 0;
  }
  if (a.elemento === 'manadrain') {
    // ("Inimigos Não Podem Drenar Mana De Você".)
    if (Number(ficha.afPoe?.imune_dreno_mana) > 0) return 0;
    const tira = Math.min(estado.mana ?? 0, dano);
    estado.mana = (estado.mana ?? 0) - tira;
    if (tira > 0) eventos.push({ t: 'dmg', ...base, v: tira, color: COR_DO_ELEMENTO.manadrain });
    return 0;
  }
  // ("X% do dano mágico sofrido suprimido é recuperado como escudo de energia".)
  if (suprimiu && dano > 0 && ModsPoe.valor(ficha, 'suprimido_recupera_es') > 0) estado.es = Math.min(Math.round(ficha.energyShield ?? 0), (estado.es ?? 0) + Math.round((dano * ModsPoe.valor(ficha, 'suprimido_recupera_es')) / 100));
  dano = aplicarNoJogador({ estado, hunt, bicho, dano, elemento: a.elemento, eventos, base, ficha, temEscudo, suprimiu });
  // PoE: o "acertado/dano recentemente", a recuperação do dano sofrido e o congelar quem acerta (a magia não é corpo a corpo: sem Reflexo).
  ModsPoe.aoSerAcertado(estado, hunt, bicho, ficha, { dano: Math.max(0, dano), corpoACorpo: false, tipo: a.elemento, eventos });
  if (critDoMob.critico) ModsPoe.evento(estado, hunt, 'serAcertadoCritico', ficha, { alvo: bicho, eventos, personagem });
  // ("Quando um Acerto Inimigo causar Dano Elemental em você, as Resistências deles para tais Elementos são zeradas por N segundos".)
  const zerar = ModsPoe.valor(ficha, 'zera_res_de_quem_acerta_s');
  if (zerar > 0 && dano > 0 && ['fire', 'ice', 'energy'].includes(a.elemento)) (bicho.estados ??= {}).resZerada = { ...(bicho.estados.resZerada?.ate > agora ? bicho.estados.resZerada : {}), [a.elemento]: true, ate: agora + zerar * 1000 };
  // (PoE, 12/10) O que os modificadores de monstro e de mapa fazem no acerto além do dano (`mobs/mecanicas.aoAcertarJogador`); a magia física
  // de projétil é um Ataque (Mutilar e Empalar são só dos Ataques).
  if (aoAcertarJogador && bruto > 0) aoAcertarJogador(estado, hunt, personagem, bicho, { dano: danoDoAcerto, bruto: Object.values(brutas).reduce((t, x) => t + x, 0), partes, brutas, critico: critDoMob.critico, ataque: projetilDeAtaque, eventos });
  if (dano <= 0) return 0;
  if (a.elemento === 'lifedrain') bicho.hp = Math.min(bicho.maxHp, bicho.hp + dano);
  return dano;
}

/**
 * Um dano de `elemento` (o valor ANTES da proteção) de um mob no jogador, pelo
 * caminho inteiro: a proteção do elemento, a prey de defesa, a mitigação das
 * gemas e `aplicarNoJogador`. `golpe`: o nome que aparece ("Explosão"...).
 */
export function danoDeElementoNoJogador(estado, hunt, personagem, bicho, valor, elemento, eventos, golpe, ficha, temEscudo) {
  if (!(valor > 0) || estado.hp <= 0 || Protecao.imune(hunt)) return 0;
  const dano = Math.round(valor * ModsPoe.fatorDaResistenciaRecebida(ficha, elemento) * Prey.fatorDeDefesa(estado, bicho.key) * (1 - (ficha.danoRecebidoDasGemas ?? 0)));
  const base = { uid: 'player', quem: personagem?.nome, x: hunt.pos.x, y: hunt.pos.y, foe: false, de: bicho.name, golpe };
  return dano > 0 ? aplicarNoJogador({ estado, hunt, bicho, dano, elemento, eventos, base, ficha, temEscudo }) : 0;
}

export function lancar(estado, hunt, personagem, bicho, eventos, agora, ficha, temEscudo) {
  const p = PODERES[bicho.key];
  if (!p || bicho.hp <= 0 || estado.hp <= 0) return 0;
  // Primeira vez que este bicho (recém-criado ou renascido) lança: cada magia
  // começa num ponto sorteado do intervalo dela. Com o relógio zerado, todos os
  // bichos ao alcance soltavam tudo JUNTOS no primeiro tique — ~2.000 de dano
  // em 0,25 s na entrada da Werehyaenna North (Médio), o mago morria sem agir.
  if (!bicho.proximoPoder) {
    bicho.proximoPoder = {};
    p.ataques.forEach((a, i) => { if (a.tipo === 'magia') bicho.proximoPoder[i] = agora + Math.random() * a.intervalo; });
  }
  let total = 0;
  const alvo = hunt.pos;
  p.ataques.forEach((a, i) => {
    if (a.tipo !== 'magia' || agora < (bicho.proximoPoder[i] ?? 0)) return;
    // Morto no meio do tique (a magia anterior matou): as outras não saem — nem o dano depois
    // da morte, nem a recarga gasta à toa (elas esperam a próxima luta).
    if ((estado.hp ?? 0) <= 0) return;
    // (A Velocidade de Conjuração do monstro — o mapa único "Chefe Único tem X% de sua Velocidade de Conjuração aumentada": a magia sai mais vezes.)
    // (+ "Velocidade de Conjuração dos Inimigos Eletrizados por você reduzida em X%": o eletrizado demora mais para a próxima.)
    const eletrizado = ModsPoe.ativo(bicho.estados?.chocado, agora) ? Math.max(0.1, 1 - ModsPoe.valor(ficha, 'eletrizados_conjuracao_lenta') / 100) : 1;
    // (PoE, o Sabotador: "Inimigos Próximos têm Recuperação da Recarga reduzido em X%" — a aura põe `recargaMenos`, `mods-poe.aurasProximas`.)
    const recarga = ModsPoe.ativo(bicho.estados?.recargaMenos, agora) ? Math.max(0.1, 1 - bicho.estados.recargaMenos.pct / 100) : 1;
    bicho.proximoPoder[i] = agora + a.intervalo / Math.max(0.1, (Number(bicho.velocidadeDeConjuracao) || 1) * eletrizado * recarga);
    if (Math.random() * 100 >= a.chance || !alcanca(a, bicho, alvo)) return;
    total += dispararMagia({ estado, hunt, personagem, bicho, eventos, agora, ficha, temEscudo }, a);
  });
  // As curas do boss (`monster.defenses` do arquivo).
  p.curas.forEach((c, i) => {
    const chave = `cura${i}`;
    if (agora < (bicho.proximoPoder[chave] ?? 0) || bicho.hp >= bicho.maxHp) return;
    bicho.proximoPoder[chave] = agora + c.intervalo;
    if (Math.random() * 100 >= c.chance) return;
    bicho.hp = Math.min(bicho.maxHp, bicho.hp + sortear(c.min, c.max));
    eventos.push({ t: 'fx', id: c.efeito ?? 15, uid: bicho.uid, x: bicho.x, y: bicho.y });
  });
  return total;
}
