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
import { readFileSync } from 'node:fs';
import * as Arvore from './arvore.mjs';
import * as Areas from '../engine/areas.mjs';
import * as Prey from './prey.mjs';
import * as Charms from './charms.mjs';
import * as Defesa from './personagem/defesa.mjs';
import * as Reforcos from './skills/reforcos.mjs';

const ler = (arquivo) => JSON.parse(readFileSync(new URL(`../gamedata/${arquivo}`, import.meta.url), 'utf8'));
const PODERES = { ...ler('monstro-poderes.json').monstros, ...ler('boss-poderes.json').bosses };

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
const EFEITO_PADRAO = { physical: 35, fire: 7, ice: 42, earth: 21, energy: 38, death: 18, holy: 50, lifedrain: 14, manadrain: 13, drown: 26 };
/** O sangue no jogador a cada golpe que passa (o original manda `fx` 1 junto de todo dano). */
const EFEITO_DO_SANGUE = 1;

/** O nome do golpe como o original escreve: o físico no alvo é "à distância" (Ghastly Dragon). */
function nomeDoGolpe(a) {
  if (a.elemento === 'physical' && a.forma === 'alvo') return 'à distância';
  return `${NOME_DO_ELEMENTO[a.elemento] ?? a.elemento}${FORMA[a.forma]}`;
}

const sortear = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const distancia = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export const temPoderes = (bicho) => !!PODERES[bicho?.key];

/** Boss cujo arquivo não tem melee (Brain Head, Malofur, The Nightmare Beast): só magia. */
export const semCorpoACorpo = (bicho) => !!PODERES[bicho?.key] && !PODERES[bicho.key].ataques.some((a) => a.tipo === 'melee');

/** O melee do arquivo; `null` = bicho sem poderes (usa a regra de sempre); 0 = boss sem melee. */
export function golpeCorpoACorpo(bicho) {
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

function alcanca(a, bicho, alvo) {
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
export function aplicarNoJogador({ estado, hunt, bicho, dano, elemento, eventos, base, ficha, temEscudo }) {
  dano = Defesa.absorver(estado, ficha, dano, eventos, base);
  if (dano > 0 && temEscudo && (estado.mana ?? 0) > 0) {
    const daMana = Math.min(estado.mana, dano);
    estado.mana -= daMana;
    dano -= daMana;
    eventos.push({ t: 'dmg', ...base, v: daMana, color: '#4fc3ff' });
  }
  dano = Arvore.danoRecebido(estado, dano, eventos, { x: base.x, y: base.y }, base.quem);
  if (dano <= 0) return 0;
  estado.hp = Math.max(0, estado.hp - dano);
  eventos.push({ t: 'fx', id: EFEITO_DO_SANGUE, uid: 'player', x: base.x, y: base.y });
  eventos.push({ t: 'dmg', ...base, v: dano, color: COR_DO_ELEMENTO[elemento] ?? '#ff0000' });
  // Parry e Numb (charms defensivos).
  Charms.depoisDeApanhar(estado, hunt, bicho, dano, eventos);
  return dano;
}

/**
 * Um dano de `elemento` (o valor ANTES da proteção) de um mob no jogador, pelo
 * caminho inteiro: a proteção do elemento, a prey de defesa, a mitigação das
 * gemas e `aplicarNoJogador`. `golpe`: o nome que aparece ("Explosão"...).
 */
export function danoDeElementoNoJogador(estado, hunt, personagem, bicho, valor, elemento, eventos, golpe, ficha, temEscudo) {
  if (!(valor > 0) || estado.hp <= 0) return 0;
  const prot = Math.min(100, ficha.protection?.[elemento] ?? 0);
  const dano = Math.round(valor * (1 - prot / 100) * Prey.fatorDeDefesa(estado, bicho.key) * (1 - (ficha.danoRecebidoDasGemas ?? 0)));
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
    bicho.proximoPoder[i] = agora + a.intervalo;
    if (Math.random() * 100 >= a.chance || !alcanca(a, bicho, alvo)) return;
    // Esquiva das gemas: a magia inteira não pega (o efeito na tela sai igual).
    // "Chance to Avoid Damage" (add) também evita a magia inteira (a Evasion não: só o golpe corpo a corpo).
    // + a esquiva de magia de LONGE dos reforços (Divine Defiance): só se o bicho não está colado.
    const deLonge = Math.max(Math.abs(bicho.x - alvo.x), Math.abs(bicho.y - alvo.y)) > 1;
    const esquivaDeLonge = deLonge ? Reforcos.bonus(hunt, 'esquivaDeLonge') / 100 : 0;
    const esquivou = (ficha.esquiva && Math.random() < ficha.esquiva) || Defesa.evitou(ficha) || (esquivaDeLonge > 0 && Math.random() < esquivaDeLonge);
    // Dodge (charm) também: sai o `block` dele e o golpe não pega.
    const doCharm = !esquivou && Charms.desviou(estado, hunt, personagem, bicho, eventos);

    const efeito = a.efeito ?? EFEITO_PADRAO[a.elemento];
    if (a.tiro != null) eventos.push({ t: 'shot', id: a.tiro, x: bicho.x, y: bicho.y, tx: alvo.x, ty: alvo.y });
    // A área na tela: um evento só, com as casas que acertam (antes: um `fx` por casa, cortado em 90).
    const casas = casasDa(a, bicho, alvo);
    if (casas.length > 1) eventos.push({ t: 'area', id: efeito, x: bicho.x, y: bicho.y, casas: Areas.paraTela(casas, bicho) });
    else for (const c of casas) eventos.push({ t: 'fx', id: efeito, x: c.x, y: c.y });

    if (doCharm) return;
    if (esquivou) {
      eventos.push({ t: 'block', uid: 'player', quem: personagem.nome, x: alvo.x, y: alvo.y, color: '#999999', esquiva: true });
      return;
    }
    const prot = Math.min(100, ficha.protection?.[a.elemento] ?? 0);
    // `forca`: o degrau da Arena x1 (+15% a cada 2 min).
    // A magia é cortada pela resistência do elemento (em %); a antiga armadura
    // mágica virou o Energy Shield (absorve abaixo, antes do magic shield e da vida).
    // `forcaDoBicho`: a força × a marca de enfraquecido (Aura of Sapped Strength).
    const bruto = sortear(a.min, a.max) * Reforcos.forcaDoBicho(bicho, agora) * (1 - prot / 100);
    let dano = Math.round(bruto * Prey.fatorDeDefesa(estado, bicho.key) * (1 - (ficha.danoRecebidoDasGemas ?? 0)));
    const base = { uid: 'player', quem: personagem.nome, x: alvo.x, y: alvo.y, foe: false, de: bicho.name, golpe: nomeDoGolpe(a) };
    // Void Inversion (charm): o dreno de mana vira ganho de mana.
    if (a.elemento === 'manadrain' && Charms.inverteDreno(estado, bicho)) {
      const ganho = Math.min(dano, Math.max(0, (estado.maxMana ?? 0) - (estado.mana ?? 0)));
      estado.mana = (estado.mana ?? 0) + ganho;
      if (ganho > 0) eventos.push({ t: 'heal', uid: 'player', quem: personagem.nome, x: alvo.x, y: alvo.y, v: ganho, color: '#4fc3ff' });
      return;
    }
    if (a.elemento === 'manadrain') {
      const tira = Math.min(estado.mana ?? 0, dano);
      estado.mana = (estado.mana ?? 0) - tira;
      if (tira > 0) eventos.push({ t: 'dmg', ...base, v: tira, color: COR_DO_ELEMENTO.manadrain });
      return;
    }
    dano = aplicarNoJogador({ estado, hunt, bicho, dano, elemento: a.elemento, eventos, base, ficha, temEscudo });
    if (dano <= 0) return;
    if (a.elemento === 'lifedrain') bicho.hp = Math.min(bicho.maxHp, bicho.hp + dano);
    total += dano;
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
