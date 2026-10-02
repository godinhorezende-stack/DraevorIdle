// Os encontros de BAÚ e ALTAR: `bau-comum`, `bau-raro`, `bau-amaldicoado` e `altar`.
//
//   bau-comum        — abre e paga a recompensa (pode ter armadilha e, por chance, guardiões escondidos).
//   bau-raro         — igual, mas pode exigir DERROTAR guardiões antes de abrir (`guardioes`, com raridade/modificadores).
//   bau-amaldicoado  — sempre invoca um grupo (`invocacao`): sobreviver e derrotar libera a recompensa.
//   altar            — bônus temporário (`efeitos`) para quem está na luta, com penalidade opcional (efeitos negativos
//                      e/ou inimigos invocados). Reaproveita os afixos do equipamento (`altares.mjs`).
//
// Tudo passa pelas regras do jogo: a recompensa pelo loot de sempre (`combate.lootDoEncontro`), a armadilha pela mesma
// proteção/escudo de qualquer dano elemental (`poderes.danoDeElementoNoJogador`, com teto de % da vida), os guardiões
// pelo combate comum. O sorteio da armadilha e da invocação secreta sai da SEMENTE da instância (`aoCriar`): reconectar
// não re-rola. Cada encontro termina UMA vez (`Estado.concluir`) — é nesse instante, e só nele, que a recompensa é paga.
//
// Idle: bau-comum e altar se resolvem sozinhos (`idle: 'auto'`); raro e amaldiçoado são lutas (`'combate'`).
import { registrarTipo } from './tipos.mjs';
import * as Estado from './estado.mjs';
import { aparece } from './sorteio.mjs';
import { CONFIG } from './config.mjs';
import * as Recompensas from './recompensas.mjs';
import * as Altares from './altares.mjs';
import * as Eventos from './eventos.mjs';
import { quemEstaNaSala, nascerGrupo, bichosDaSala, avisarSala } from './sala.mjs';
import { BESTIARY } from '../hunt/monstros.mjs';
import { lootDoEncontro, pagarPremio } from '../hunt/combate.mjs';
import { danoDeElementoNoJogador } from '../poderes.mjs';
import * as Ficha from '../ficha.mjs';
import * as Entrega from './entrega.mjs';
import * as Inventario from '../inventario.mjs';
import * as Acoes from '../acoes.mjs';

const ELEMENTOS = ['physical', 'fire', 'ice', 'earth', 'energy', 'death', 'holy'];

function errosDeGrupo(g, onde) {
  const erros = [];
  if (!g?.criaturas?.length) return [`${onde}: precisa de criaturas.`];
  let total = 0;
  for (const c of g.criaturas) {
    if (!BESTIARY[c?.key]) erros.push(`${onde}: "${c?.key}" não é um monstro do bestiário.`);
    if (!(Number.isInteger(c?.qtd ?? 1) && (c.qtd ?? 1) >= 1 && (c.qtd ?? 1) <= 5)) erros.push(`${onde}: qtd de 1 a 5 por criatura.`);
    total += c?.qtd ?? 1;
  }
  if (total > CONFIG.limites.guardioesMax) erros.push(`${onde}: no máximo ${CONFIG.limites.guardioesMax} monstros por grupo (limite do servidor).`);
  return erros;
}

function validarBau(tipo, e) {
  const erros = Recompensas.validar(e.recompensa, 'recompensa');
  if (e.armadilha) {
    const a = e.armadilha;
    if (!(Number(a.chance) >= 0 && Number(a.chance) <= 100)) erros.push('armadilha.chance entre 0 e 100.');
    if (!ELEMENTOS.includes(a.elemento)) erros.push(`armadilha.elemento "${a.elemento}" desconhecido.`);
    if (!(Number(a.min) >= 0 && Number(a.min) <= Number(a.max))) erros.push('armadilha precisa de min >= 0 e min <= max.');
  }
  if (e.guardioes) erros.push(...errosDeGrupo(e.guardioes, 'guardioes'));
  if (tipo === 'bau-amaldicoado') erros.push(...errosDeGrupo(e.invocacao, 'invocacao'));
  if (e.chanceDeInvocacao != null) {
    if (!(Number(e.chanceDeInvocacao) >= 0 && Number(e.chanceDeInvocacao) <= 100)) erros.push('chanceDeInvocacao entre 0 e 100.');
    if (!e.invocacao) erros.push('chanceDeInvocacao precisa de "invocacao" (quem é invocado).');
    else erros.push(...errosDeGrupo(e.invocacao, 'invocacao'));
  }
  const req = e.requisitos;
  if (req) {
    if (req.levelMin != null && !(Number.isInteger(req.levelMin) && req.levelMin >= 1)) erros.push('requisitos.levelMin inválido.');
    if (req.chave && !(Number.isInteger(req.chave.count ?? 1) && Number.isInteger(req.chave.id))) erros.push('requisitos.chave precisa de id e count.');
    // Um obrigatório não pode depender do que o jogador pode não ter: a fase travaria.
    if (e.obrigatorio && (req.chave || req.levelMin)) erros.push('obrigatório não pode ter requisitos (o personagem pode não cumpri-los e a fase travaria).');
  }
  return erros;
}

function validarAltar(e) {
  const erros = Altares.validarEfeitos(e.efeitos, 'efeitos');
  if (!(Number(e.duracaoMs) > 0 && Number(e.duracaoMs) <= CONFIG.limites.altarDuracaoMsMax)) erros.push(`duracaoMs de 1 a ${CONFIG.limites.altarDuracaoMsMax}.`);
  if (e.penalidade) {
    if (e.penalidade.efeitos) erros.push(...Altares.validarEfeitos(e.penalidade.efeitos, 'penalidade.efeitos', { negativo: true }));
    if (e.penalidade.invocacao) erros.push(...errosDeGrupo(e.penalidade.invocacao, 'penalidade.invocacao'));
  }
  return erros;
}

/** Requisitos do jogador para abrir (nível e chave): `{ ok }` ou `{ ok: false, motivo }`. Não consome nada. */
export function podeAbrir(estado, e) {
  const req = e.requisitos;
  if (!req || !estado) return { ok: true };
  if (req.levelMin && (estado.level ?? 1) < req.levelMin) return { ok: false, motivo: `precisa do level ${req.levelMin}` };
  if (req.chave && Inventario.contarGuardadas(estado, req.chave.id) < (req.chave.count ?? 1)) return { ok: false, motivo: 'falta a chave' };
  return { ok: true };
}

const lootOrigem = (e) => ({ key: `encontro:${e.defId}`, name: e.nome, exp: e.recompensa?.moedasMedia ?? 100, expDasMoedas: e.recompensa?.moedasMedia ?? 100 });

function armadilha(ctx, e) {
  const { estado, personagem, hunt } = ctx;
  const a = e.armadilha;
  if (!e.armadilhaAtiva || !a || !estado || !personagem || estado.hp <= 0) return;
  // O golpe de uma armadilha nunca passa de uma fração da vida (teto do validador): ela assusta, não mata de graça.
  const teto = Math.floor(((estado.maxHp ?? 1) * CONFIG.limites.armadilhaPctDaVidaMax) / 100);
  const valor = Math.min(teto, a.min + Math.floor(Math.random() * (a.max - a.min + 1)));
  const eventos = [];
  danoDeElementoNoJogador(estado, hunt, personagem, { key: `encontro:${e.defId}`, name: e.nome }, valor, a.elemento, eventos, 'armadilha', Ficha.combate(estado), Acoes.temBuff(hunt, 'shield'));
  Eventos.empurrar(hunt, eventos);
}

/** Paga a recompensa do baú (loot de sempre + primeira conclusão por membro). Chamada UMA vez, pelo `finalizar`. */
function pagar(ctx, e) {
  const { estado, personagem, hunt, instancia } = ctx;
  const r = e.recompensa;
  if (!r || !estado) return;
  const eventos = [];
  for (let i = 0; i < (r.rolagens ?? 1); i++) lootDoEncontro(estado, hunt, personagem, lootOrigem(e), Recompensas.dropsDe(r), eventos);
  Eventos.empurrar(hunt, eventos);
  for (const quem of quemEstaNaSala(hunt, estado)) {
    const { primeira } = Entrega.registrarConclusao(quem, hunt.huntId, e.defId);
    const pc = r.primeiraConclusao;
    if (primeira && pc && Entrega.reivindicar(quem, instancia.id, e.id).ok) {
      pagarPremio({ estado: quem, gold: Number(pc.gold ?? 0), exp: Number(pc.exp ?? 0), itens: (pc.itens ?? []).map((i) => ({ id: i.id, count: i.count })), nome: e.nome });
    }
  }
}

/** O fim do encontro: conclui (uma vez só) e, só se concluiu agora, paga. */
function finalizar(ctx, e, { altar = false } = {}) {
  const { instancia, agora } = ctx;
  if (!Estado.concluir(instancia, e.id, { agora }).ok) return;
  if (altar) return;
  pagar(ctx, e);
}

function gruposDoBau(e) {
  if (e.tipo === 'bau-amaldicoado') return e.invocacao;
  if (e.guardioes?.criaturas?.length) return e.guardioes;
  return e.invocaSecreta ? e.invocacao : null;
}

function ponto(e) {
  return e.x != null ? { x: e.x, y: e.y, ...(e.z != null ? { z: e.z } : {}) } : null;
}

function aoAtivarBau(ctx) {
  const { hunt, instancia, encontro: e } = ctx;
  if (!hunt) return;
  if (ctx.estado && ctx.personagem?.nome) avisarSala(hunt, ctx.estado, `${ctx.personagem.nome} abriu: ${e.nome}.`);
  // A chave só é gasta quando o baú de fato abre.
  if (e.requisitos?.chave && ctx.estado) Inventario.tirarGuardadas(ctx.estado, e.requisitos.chave.id, e.requisitos.chave.count ?? 1);
  armadilha(ctx, e);
  const grupo = gruposDoBau(e);
  if (grupo?.criaturas?.length) {
    e.guardiaoUids = nascerGrupo(hunt, { ...grupo, ponto: ponto(e), instanciaId: instancia.id, encontro: e.id, opcional: !e.obrigatorio, marca: 'guardiao' });
    Eventos.empurrar(hunt, [{ t: 'say', uid: 'player', text: e.tipo === 'bau-amaldicoado' ? 'Maldito!' : 'Armadilha!', x: hunt.pos.x, y: hunt.pos.y, color: '#c040ff' }]);
    // Nenhum coube (sem casa livre): abre assim mesmo — o baú nunca fica fechado esperando quem não existe.
    if (e.guardiaoUids.length) return;
  }
  finalizar(ctx, e);
}

/** Com guardiões em campo: abre quando o último cai; sem nenhum (morreram sem passar pelo combate), também. */
function verificarBau(ctx) {
  const e = ctx.encontro;
  if (!ctx.hunt || !e.guardiaoUids) return;
  const vivos = bichosDaSala(ctx.hunt).some((m) => m.hp > 0 && m.encontro === e.id && m.guardiao);
  if (!vivos) finalizar(ctx, e);
}

function definicaoDeBau(tipo, idle) {
  return {
    idle,
    validar: (e) => validarBau(tipo, e),
    aoCriar(slot, def, { semente }) {
      slot.armadilhaAtiva = !!def.armadilha && aparece(semente, `${slot.id}:armadilha`, def.armadilha.chance);
      slot.invocaSecreta = !!def.chanceDeInvocacao && aparece(semente, `${slot.id}:invocacao`, def.chanceDeInvocacao);
    },
    podeAtivar: (ctx) => podeAbrir(ctx.estado, ctx.encontro),
    aoAtivar: aoAtivarBau,
    verificar: verificarBau,
    // O idle de um baú que se resolve sozinho: se há guardiões em campo, é o combate que termina; senão já abriu.
    ...(idle === 'auto' ? { resolverNoIdle: verificarBau } : {}),
  };
}

registrarTipo('bau-comum', definicaoDeBau('bau-comum', 'auto'));
registrarTipo('bau-raro', definicaoDeBau('bau-raro', 'combate'));
registrarTipo('bau-amaldicoado', definicaoDeBau('bau-amaldicoado', 'combate'));

registrarTipo('altar', {
  idle: 'auto',
  validar: validarAltar,
  aoAtivar(ctx) {
    const { hunt, instancia, encontro: e } = ctx;
    if (!hunt || !ctx.estado) return;
    const todos = quemEstaNaSala(hunt, ctx.estado);
    if (ctx.personagem?.nome) avisarSala(hunt, ctx.estado, `${ctx.personagem.nome} ativou: ${e.nome}.`);
    Altares.aplicar(todos, e.efeitos, e.duracaoMs, { id: e.id, hunt });
    if (e.penalidade?.efeitos) Altares.aplicar(todos, e.penalidade.efeitos, e.duracaoMs, { id: `${e.id}:penalidade`, hunt });
    if (e.penalidade?.invocacao) nascerGrupo(hunt, { ...e.penalidade.invocacao, ponto: ponto(e), instanciaId: instancia.id, encontro: e.id, opcional: true, marca: 'invasor' });
    Eventos.empurrar(hunt, [{ t: 'say', uid: 'player', text: e.nome, x: hunt.pos.x, y: hunt.pos.y, color: '#ffd24c' }]);
    finalizar(ctx, e, { altar: true });
    // O histórico de conclusões também conta o altar (sem recompensa de item).
    for (const quem of todos) Entrega.registrarConclusao(quem, hunt.huntId, e.defId);
  },
  podeAtivar: (ctx) => podeAbrir(ctx.estado, ctx.encontro),
  // Altar nunca fica "ativo" esperando: aoAtivar já conclui. O gancho existe porque o idle 'auto' o exige.
  resolverNoIdle: () => {},
});
