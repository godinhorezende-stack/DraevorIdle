// Party — o time (`grupo`) e a caçada em grupo (`party`), no formato que o
// client lê (`character.party`, `hunt.party`, `hunt.aliados`,
// `hunt.summonsDoGrupo`, `partyInvite`, `grupoConvite`, `pedidoDeEntrada`) e
// com as regras que ele escreve:
//
// - "Party não é caçada": o grupo se monta primeiro (`grupo convidar/aceitar/
//   recusar/sair/lider/expulsar`); o convite para caçar junto vem depois
//   (`party invite/accept/decline`, ou o contrário: `pedir` + `aceitarPedido`).
// - Tamanho: 2 pessoas + os "Slot de party" da conta (até 5). "A party fica no
//   tamanho da conta com menos slots." E a conta joga com até esse mesmo
//   número de chars ao mesmo tempo (`limiteDeChars`).
// - Na caçada em grupo os bichos são OS MESMOS para todos: quem entrou divide
//   o array de monstros de quem abriu (`Cacadas.entrarNaSala`). Quem abriu é
//   o dono da sala — é ele quem move os bichos e faz renascer; saindo ele, o
//   próximo da sala assume.
// - "Quem vai na frente" (`frente`, escolhido por quem manda na fila, o líder)
//   puxa; os outros seguem a ponta ou quem escolheram ("Andar atrás de"), a
//   `coleira` sqm (1, 2, 3, 5, 7, 9, 12; padrão 5).
// - Level: ninguém mais de `DIFERENCA_DE_LEVEL` (10) longe de ninguém — para
//   entrar na party e na caçada de alguém. E a caçada precisa estar LIBERADA
//   para quem entra (o level dela; nas Vip/Instance/Divine, premium e acesso).
// - Shared Experience: ativa com 2+ na mesma caçada, todos dentro da faixa de
//   level (os mesmos 10) e perto (30 sqm). A exp do bicho é dividida
//   em partes iguais, com o bônus por vocações diferentes — "Mesma vocação +20%
//   · duas +35% · três +70% · quatro ou mais +100%. Vale para criaturas de 20
//   de experiência para cima." O loot, na partilha: o ouro em partes iguais e
//   os itens em rodízio (ver `matarMonstro`, em hunt/combate.mjs); a Boss Task
//   conta para todos, como a task de bicho.
//
// O grupo vive na memória do servidor ("a party dura entre uma caçada e
// outra"); reiniciar o servidor desfaz as parties.
import * as B from '../database/banco.mjs';
import * as Cacadas from './cacadas.mjs';
import * as Promocao from './promocao.mjs';
import * as Amigos from './amigos.mjs';

const CONVITE_MS = 60_000;
const COLEIRAS = [1, 2, 3, 5, 7, 9, 12];
const LONGE = 30;
const BONUS_POR_VOCACOES = [1, 1.2, 1.35, 1.7, 2];
/*
 * A diferença de level na party: ninguém mais de 10 levels longe de ninguém
 * (pedido do dono, "um limite de lv, exemplo 10 leveis"). Vale para entrar na
 * party, para entrar na caçada de alguém e para a partilha — quem passar disso
 * subindo de level na caçada continua na party, mas a partilha desliga até
 * todos voltarem a caber.
 */
export const DIFERENCA_DE_LEVEL = 10;

let vivas = new Map(); // nome -> Sessao (injetado por sessao.mjs)
export const ligar = (mapa) => void (vivas = mapa);

const parties = new Map(); // id -> { id, lider, membros:[nome], convites:Map(nome->expira), frente, coleiras:Map, seguir:Map }
const partyDe = new Map(); // nome -> id
const convitesDeCaca = new Map(); // convidado -> { de, expira }
const pedidos = new Map(); // anfitrião -> { de, expira }
let proximoId = 1;

const sessaoDe = (nome) => vivas.get(nome) ?? [...vivas.values()].find((s) => s.personagem?.nome?.toLowerCase() === String(nome ?? '').toLowerCase()) ?? null;
const nomeDe = (s) => s.personagem?.nome;
const minhaParty = (s) => parties.get(partyDe.get(nomeDe(s))) ?? null;
/*
 * A party mudou: o estado de cada membro e a lista de amigos dele — a janela de
 * Amigos só se redesenha quando chega uma lista nova, e sem isto a linha do
 * amigo que acabou de entrar seguia com o botão "Party" em vez de "na party".
 */
const atualizar = (party) => {
  for (const nome of party?.membros ?? []) {
    mandarJa(sessaoDe(nome));
    Amigos.avisar(nome).catch((e) => console.error('amigos avisar', e.message));
  }
};
/** Manda o estado JÁ com o personagem inteiro: a party é campo dele, e sem isto ela chegava até 1 s depois. */
const mandarJa = (s) => {
  if (!s) return;
  s.characterSujo = true;
  s.mandarEstado();
};
const avisar = (s, notice) => s?.enviar({ t: 'notice', notice });

/** Slots comprados pela conta (0 a 3) — do cache síncrono (ver `banco.mjs`'s `melhoriasCache`), não do banco direto: isto roda a cada `mandarEstado`. */
const slotsDaConta = (contaId) => Math.min(3, B.melhoriasCache(contaId)?.slotsDeParty ?? 0);
/** Quantos chars desta conta podem jogar ao mesmo tempo. */
export const limiteDeChars = (contaId) => 2 + slotsDaConta(contaId);
/** O tamanho da party: o da conta com MENOS slots entre os nomes. */
function maximo(nomes) {
  const contas = new Set(nomes.map((n) => sessaoDe(n)?.conta?.id).filter(Boolean));
  return 2 + Math.min(...[...contas].map(slotsDaConta), 3);
}

/** `null` se todos os nomes cabem na diferença de level; senão, a frase de quem não cabe. */
function foraDaFaixa(nomes) {
  const niveis = nomes.map((n) => ({ n, lv: sessaoDe(n)?.estado?.level ?? 1 }));
  if (niveis.length < 2) return null;
  const alto = niveis.reduce((a, b) => (b.lv > a.lv ? b : a));
  const baixo = niveis.reduce((a, b) => (b.lv < a.lv ? b : a));
  if (alto.lv - baixo.lv <= DIFERENCA_DE_LEVEL) return null;
  return `A diferença de level na party é de no máximo ${DIFERENCA_DE_LEVEL}: ${alto.n} é level ${alto.lv} e ${baixo.n} é level ${baixo.lv}.`;
}

// ------------------------------------------------------------------ grupo

export function comandoDoGrupo(s, m) {
  const eu = nomeDe(s);
  const party = minhaParty(s);
  switch (m.action) {
    case 'convidar': {
      const alvo = sessaoDe(m.name);
      if (!alvo) return { ok: false, erro: `${m.name} não está online.` };
      if (alvo === s) return { ok: false, erro: 'Você não pode se convidar.' };
      if (partyDe.has(nomeDe(alvo))) return { ok: false, erro: `${nomeDe(alvo)} já está numa party.` };
      if (party && party.lider !== eu) return { ok: false, erro: 'Só o líder da party convida.' };
      // A faixa de level ANTES de criar a party: recusado, não sobra uma party de um só.
      const longe = foraDaFaixa([...(party?.membros ?? [eu]), nomeDe(alvo)]);
      if (longe) return { ok: false, erro: longe };
      const p = party ?? criar(eu);
      const teto = maximo([...p.membros, nomeDe(alvo)]);
      if (p.membros.length >= teto) return { ok: false, erro: `A party está cheia (${teto} lugares). Mais lugares: "Slot de party", na Store — cada conta precisa ter os seus.` };
      p.convites.set(nomeDe(alvo), Date.now() + CONVITE_MS);
      alvo.enviar({ t: 'grupoConvite', from: eu, expiraEm: Date.now() + CONVITE_MS });
      return { ok: true, notice: `Convite de party enviado para ${nomeDe(alvo)}.` };
    }
    case 'aceitar': {
      if (party) return { ok: false, erro: 'Você já está numa party.' };
      const p = [...parties.values()].find((x) => (x.convites.get(eu) ?? 0) > Date.now());
      if (!p) return { ok: false, erro: 'O convite expirou.' };
      p.convites.delete(eu);
      if (p.membros.length >= maximo([...p.membros, eu])) return { ok: false, erro: 'A party encheu antes de você aceitar.' };
      // Alguém subiu de level entre o convite e o aceite.
      const longe = foraDaFaixa([...p.membros, eu]);
      if (longe) return { ok: false, erro: longe };
      p.membros.push(eu);
      partyDe.set(eu, p.id);
      for (const n of p.membros) if (n !== eu) avisar(sessaoDe(n), `${eu} entrou na party.`);
      atualizar(p);
      return { ok: true, notice: `Você entrou na party de ${p.lider}.` };
    }
    case 'recusar': {
      const p = [...parties.values()].find((x) => x.convites.has(eu));
      if (p) {
        p.convites.delete(eu);
        avisar(sessaoDe(p.lider), `${eu} recusou o convite de party.`);
        if (p.membros.length < 2 && !p.convites.size) desfazer(p);
      }
      return { ok: true };
    }
    case 'sair':
      if (!party) return { ok: false, erro: 'Você não está numa party.' };
      tirar(party, eu, 'saiu da party');
      return { ok: true, notice: 'Você saiu da party.' };
    case 'lider': {
      if (!party || party.lider !== eu) return { ok: false, erro: 'Só o líder passa a liderança.' };
      const novo = party.membros.find((n) => n.toLowerCase() === String(m.name ?? '').toLowerCase());
      if (!novo) return { ok: false, erro: 'Essa pessoa não está na party.' };
      party.lider = novo;
      for (const n of party.membros) avisar(sessaoDe(n), `${novo} agora lidera a party.`);
      atualizar(party);
      return { ok: true };
    }
    case 'expulsar': {
      if (!party || party.lider !== eu) return { ok: false, erro: 'Só o líder tira alguém da party.' };
      const quem = party.membros.find((n) => n.toLowerCase() === String(m.name ?? '').toLowerCase());
      if (!quem || quem === eu) return { ok: false, erro: 'Essa pessoa não está na party.' };
      avisar(sessaoDe(quem), `${eu} tirou você da party.`);
      tirar(party, quem, 'foi tirado da party');
      return { ok: true };
    }
    default:
      return { ok: false, erro: 'Ação de party desconhecida.' };
  }
}

function criar(lider) {
  const p = { id: proximoId++, lider, membros: [lider], convites: new Map(), frente: null, coleiras: new Map(), seguir: new Map() };
  parties.set(p.id, p);
  partyDe.set(lider, p.id);
  return p;
}

function desfazer(p) {
  // Sem party não há caçada em grupo: cada um fica com os bichos dele.
  for (const n of p.membros) {
    const h = sessaoDe(n)?.estado?.hunt;
    if (h && Cacadas.salaDe(h) !== h) Cacadas.separar(h);
  }
  for (const n of p.membros) partyDe.delete(n);
  parties.delete(p.id);
  for (const n of p.membros) {
    mandarJa(sessaoDe(n));
    Amigos.avisar(n).catch((e) => console.error('amigos avisar', e.message));
  }
}

function tirar(p, nome, motivo, { saindoDoJogo = false } = {}) {
  const s = sessaoDe(nome);
  const convidado = s?.estado?.hunt && Cacadas.salaDe(s.estado.hunt) !== s.estado.hunt;
  if (convidado && saindoDoJogo) {
    // Deslogou na caçada de outro: ela segue OFFLINE, só dele, com uma cópia dos bichos.
    Cacadas.separar(s.estado.hunt);
  } else if (convidado) {
    // Saiu da party estando na caçada de outro membro: volta para a cidade.
    s.estado.hunt = null;
    avisar(s, 'Você saiu da caçada da party e voltou para a cidade.');
  } else if (s) {
    antesDeSairDaCacada(s);
  }
  p.membros = p.membros.filter((n) => n !== nome);
  partyDe.delete(nome);
  if (p.frente === nome) p.frente = null;
  for (const n of p.membros) avisar(sessaoDe(n), `${nome} ${motivo}.`);
  if (p.lider === nome) p.lider = p.membros[0] ?? null;
  if (!saindoDoJogo) mandarJa(s);
  if (p.membros.length < 2) desfazer(p);
  else atualizar(p);
}

/** Saiu do jogo: sai da caçada em grupo e da party. */
export function saiuDoJogo(s) {
  const p = minhaParty(s);
  if (p) tirar(p, nomeDe(s), 'saiu do jogo', { saindoDoJogo: true });
  else if (s.estado?.hunt && Cacadas.salaDe(s.estado.hunt) !== s.estado.hunt) Cacadas.separar(s.estado.hunt);
}

// --------------------------------------------------------- caçada em grupo

/**
 * Quem vai deixar a caçada (stopHunt, morte, logout, trocar de hunt): se ele
 * é o dono de uma sala com gente dentro, o próximo da sala assume.
 */
export function antesDeSairDaCacada(s) {
  const hunt = s.estado?.hunt;
  if (!hunt || Cacadas.salaDe(hunt) !== hunt) return;
  const convidados = [...vivas.values()].filter((o) => o !== s && o.estado?.hunt && Cacadas.salaDe(o.estado.hunt) === hunt);
  if (!convidados.length) return;
  const [novo, ...resto] = convidados;
  Cacadas.virarDono(novo.estado.hunt);
  for (const o of resto) Cacadas.mudarDeDono(o.estado.hunt, novo.estado.hunt);
  // Quem saiu leva uma CÓPIA dos bichos (a caçada dele segue offline sozinha).
  Cacadas.separar(hunt);
  for (const o of convidados) avisar(o, `${nomeDe(s)} saiu da caçada — ${nomeDe(novo)} segue puxando.`);
}

/**
 * Pode `convidado` entrar na sala de caçada `sala`? `null` = pode; senão, a
 * frase do porquê. Conferido no chamado, no pedido e de novo na entrada (o
 * level muda no meio): a hunt precisa estar LIBERADA para ele — o level dela,
 * e, nas Vip/Instance/Divine, premium e o acesso — e ele precisa caber na
 * faixa de level de quem já está lá.
 */
function motivoParaNaoEntrar(convidado, sala) {
  if (!sala) return 'Essa pessoa não está caçando.';
  if (sala.isBoss || sala.huntId === 'treino') return 'Nessa caçada não dá para entrar.';
  const nome = nomeDe(convidado);
  // A fase da campanha NÃO é conferida aqui: na party, qualquer um entra na
  // caçada do outro (decisão do dono — um amigo pode "carregar" o outro).
  const naSala = [...vivas.values()].filter((o) => o !== convidado && o.estado?.hunt && Cacadas.salaDe(o.estado.hunt) === sala).map(nomeDe);
  return foraDaFaixa([...naSala, nome]);
}

function juntar(convidado, anfitriao) {
  const sala = Cacadas.salaDe(anfitriao.estado?.hunt);
  if (!sala) return { ok: false, erro: `${nomeDe(anfitriao)} não está caçando.` };
  const motivo = motivoParaNaoEntrar(convidado, sala);
  if (motivo) return { ok: false, erro: motivo };
  const naSala = [...vivas.values()].filter((o) => o.estado?.hunt && Cacadas.salaDe(o.estado.hunt) === sala).length;
  const p = minhaParty(convidado);
  if (naSala >= maximo(p?.membros ?? [])) return { ok: false, erro: 'A caçada já está com a party inteira.' };
  // Vip/Instance/Divine: premium, o acesso e o level da porta ANTES de largar a caçada de agora.
  const tranca = Cacadas.podeEntrarNaSala(convidado.estado, sala);
  if (!tranca.ok) return tranca;
  if (convidado.estado.hunt) {
    /*
     * A caçada de antes acaba aqui: o extrato dela vai para ele, como no
     * "Parar". Sem isto o que ela rendeu sumia sem ninguém ver. (Sem aba — um
     * char da conta trazido pela troca de personagem —, quem chamou recebe; ver
     * `chamarOutro`, em sessao.mjs.)
     */
    const h = convidado.estado.hunt;
    if (h.huntId !== 'treino' && Cacadas.salaDe(h) !== sala) {
      const report = Cacadas.relatorio(convidado.estado);
      if (report) {
        convidado.enviar({
          t: 'runReport',
          report,
          motivo: `Você saiu de ${Cacadas.nomeDaHunt(h.huntId)} para entrar na caçada de ${nomeDe(anfitriao)}.`,
        });
      }
    }
    antesDeSairDaCacada(convidado);
    convidado.estado.hunt = null;
  }
  // Onde cada um da sala está: quem entra cai numa casa livre (a colisão da caçada em grupo).
  const gente = [...vivas.values()]
    .filter((o) => o !== convidado && o.estado?.hunt && Cacadas.salaDe(o.estado.hunt) === sala)
    .map((o) => ({ ...o.estado.hunt.pos, z: o.estado.hunt.z }));
  const r = Cacadas.entrarNaSala(convidado.estado, sala, gente);
  if (!r.ok) return r;
  for (const o of vivas.values()) if (o.estado?.hunt && Cacadas.salaDe(o.estado.hunt) === sala && o !== convidado) avisar(o, `${nomeDe(convidado)} entrou na caçada.`);
  atualizar(minhaParty(convidado));
  // O líder entrou na caçada de alguém: quem segue o líder vem também.
  if (minhaParty(convidado)?.lider === nomeDe(convidado)) seguirOLider(convidado);
  return { ok: true, notice: `Você entrou na caçada de ${nomeDe(anfitriao)} (${Cacadas.nomeDaHunt(sala.huntId)}).` };
}

export function comandoDaCaca(s, m) {
  const eu = nomeDe(s);
  const p = minhaParty(s);
  const outro = m.name ? sessaoDe(m.name) : null;
  const doMeuGrupo = (o) => o && p && p.membros.includes(nomeDe(o));
  switch (m.action) {
    case 'invite': {
      if (!outro) return { ok: false, erro: `${m.name} não está online.` };
      if (!doMeuGrupo(outro)) return { ok: false, erro: `Chame ${nomeDe(outro)} para a party primeiro (Party → Convidar).` };
      if (!s.estado.hunt) return { ok: false, erro: 'Comece uma caçada para chamar alguém.' };
      const sala = Cacadas.salaDe(s.estado.hunt);
      // Já no chamado: quem chama sabe na hora que o outro não pode vir.
      const motivo = motivoParaNaoEntrar(outro, sala);
      if (motivo) return { ok: false, erro: motivo };
      const tranca = Cacadas.podeEntrarNaSala(outro.estado, sala);
      if (!tranca.ok) return { ok: false, erro: `${nomeDe(outro)}: ${tranca.erro}` };
      convitesDeCaca.set(nomeDe(outro), { de: eu, expira: Date.now() + CONVITE_MS });
      outro.enviar({ t: 'partyInvite', from: eu, hunt: Cacadas.nomeDaHunt(sala.huntId), faixa: faixa([s, outro]), expiraEm: Date.now() + CONVITE_MS });
      return { ok: true, notice: `Chamado enviado para ${nomeDe(outro)}.` };
    }
    case 'accept': {
      const c = convitesDeCaca.get(eu);
      convitesDeCaca.delete(eu);
      if (!c || c.expira < Date.now()) return { ok: false, erro: 'O chamado expirou.' };
      const host = sessaoDe(c.de);
      if (!host) return { ok: false, erro: `${c.de} saiu do jogo.` };
      return juntar(s, host);
    }
    case 'decline': {
      const c = convitesDeCaca.get(eu);
      convitesDeCaca.delete(eu);
      if (c) avisar(sessaoDe(c.de), `${eu} não quis entrar agora.`);
      return { ok: true };
    }
    case 'pedir': {
      if (!doMeuGrupo(outro)) return { ok: false, erro: 'Essa pessoa não está na sua party.' };
      if (!outro.estado?.hunt) return { ok: false, erro: `${nomeDe(outro)} não está caçando.` };
      const sala = Cacadas.salaDe(outro.estado.hunt);
      const motivo = motivoParaNaoEntrar(s, sala);
      if (motivo) return { ok: false, erro: motivo };
      const tranca = Cacadas.podeEntrarNaSala(s.estado, sala);
      if (!tranca.ok) return tranca;
      pedidos.set(nomeDe(outro), { de: eu, expira: Date.now() + CONVITE_MS });
      outro.enviar({ t: 'pedidoDeEntrada', from: eu, level: s.estado.level, vocation: s.estado.vocation, hunt: Cacadas.nomeDaHunt(outro.estado.hunt.huntId), expiraEm: Date.now() + CONVITE_MS });
      outro.mandarEstado();
      return { ok: true, notice: `Pedido enviado para ${nomeDe(outro)}.` };
    }
    case 'aceitarPedido': {
      const c = pedidos.get(eu);
      pedidos.delete(eu);
      s.mandarEstado();
      if (!c || c.expira < Date.now()) return { ok: false, erro: 'O pedido expirou.' };
      const quem = sessaoDe(c.de);
      if (!quem) return { ok: false, erro: `${c.de} saiu do jogo.` };
      const r = juntar(quem, s);
      if (r.ok) avisar(quem, r.notice);
      return r.ok ? { ok: true } : r;
    }
    case 'recusarPedido': {
      const c = pedidos.get(eu);
      pedidos.delete(eu);
      if (c) avisar(sessaoDe(c.de), `${eu} não deixou entrar agora.`);
      s.mandarEstado();
      return { ok: true };
    }
    case 'entrar': {
      // "Permitir entrar na caçada": quem marcou deixa a party entrar direto, sem pedir.
      if (!doMeuGrupo(outro)) return { ok: false, erro: 'Essa pessoa não está na sua party.' };
      if (!outro.estado?.hunt) return { ok: false, erro: `${nomeDe(outro)} não está caçando.` };
      if (outro.estado.settings?.entrarSemConvite !== true) return { ok: false, erro: `${nomeDe(outro)} não liberou a entrada direta — peça para entrar.` };
      return juntar(s, outro);
    }
    case 'sair':
      return comandoDoGrupo(s, { action: 'sair' });
    case 'frente': {
      if (!p || p.lider !== eu) return { ok: false, erro: 'Só quem manda na fila (o líder) escolhe quem vai na frente.' };
      p.frente = p.membros.find((n) => n.toLowerCase() === String(m.name ?? '').toLowerCase()) ?? null;
      atualizar(p);
      return { ok: true };
    }
    case 'seguirQuem': {
      if (!p) return { ok: false, erro: 'Você não está numa party.' };
      const alvo = p.membros.find((n) => n.toLowerCase() === String(m.name ?? '').toLowerCase());
      if (alvo) p.seguir.set(eu, alvo);
      else p.seguir.delete(eu);
      atualizar(p);
      return { ok: true };
    }
    case 'coleira': {
      if (!p) return { ok: false, erro: 'Você não está numa party.' };
      const v = Number(m.valor);
      p.coleiras.set(eu, COLEIRAS.includes(v) ? v : 5);
      atualizar(p);
      return { ok: true };
    }
    default:
      return { ok: false, erro: 'Ação de party desconhecida.' };
  }
}

// ------------------------------------------------ o que cada tique precisa

/** As sessões na MESMA sala de caçada que `s` (incluindo ele). */
function naMesmaSala(s) {
  const sala = s.estado?.hunt ? Cacadas.salaDe(s.estado.hunt) : null;
  if (!sala) return [];
  return [...vivas.values()].filter((o) => o.estado?.hunt && Cacadas.salaDe(o.estado.hunt) === sala);
}

/** A faixa de level em que todos cabem: ninguém mais de `DIFERENCA_DE_LEVEL` longe de ninguém. */
function faixa(sessoes) {
  const niveis = sessoes.map((o) => o.estado?.level ?? 1);
  return { min: Math.max(1, Math.max(...niveis) - DIFERENCA_DE_LEVEL), max: Math.min(...niveis) + DIFERENCA_DE_LEVEL };
}

/** A partilha agora: `{ativa, motivo, bonus, vocacoes, faixa, membros:[estado]}`. */
export function partilha(s) {
  const juntos = naMesmaSala(s).filter((o) => minhaParty(o) && minhaParty(o) === minhaParty(s));
  const f = juntos.length ? faixa(juntos) : null;
  const base = { membros: juntos.map((o) => ({ estado: o.estado, nome: nomeDe(o) })), faixa: f, vocacoes: new Set(juntos.map((o) => o.estado.vocation)).size };
  if (juntos.length < 2) return { ...base, ativa: false, motivo: 'sozinho', bonus: 1 };
  // Alguém subiu de level na caçada e passou da diferença: a partilha desliga até ele voltar a caber.
  const niveis = juntos.map((o) => o.estado.level ?? 1);
  if (Math.max(...niveis) - Math.min(...niveis) > DIFERENCA_DE_LEVEL) return { ...base, ativa: false, motivo: 'level', bonus: 1 };
  const eu = s.estado.hunt.pos;
  if (juntos.some((o) => Math.max(Math.abs(o.estado.hunt.pos.x - eu.x), Math.abs(o.estado.hunt.pos.y - eu.y)) > LONGE)) {
    return { ...base, ativa: false, motivo: 'longe', bonus: 1 };
  }
  return { ...base, ativa: true, motivo: null, bonus: BONUS_POR_VOCACOES[Math.min(4, base.vocacoes)] };
}

/** Quem este membro segue e a quantos sqm (`{pos, coleira}` ou null). */
export function guia(s) {
  const p = minhaParty(s);
  if (!p) return null;
  const juntos = naMesmaSala(s).filter((o) => p.membros.includes(nomeDe(o)));
  if (juntos.length < 2) return null;
  const nomes = juntos.map(nomeDe);
  const ponta = nomes.includes(p.frente) ? p.frente : nomes.includes(p.lider) ? p.lider : Cacadas.salaDe(s.estado.hunt) === s.estado.hunt ? nomeDe(s) : nomes.find((n) => Cacadas.salaDe(sessaoDe(n).estado.hunt) === sessaoDe(n).estado.hunt);
  if (ponta === nomeDe(s)) return null;
  // "Andar atrás de": vale se não fechar círculo; senão, a ponta.
  let alvo = p.seguir.get(nomeDe(s));
  const visto = new Set([nomeDe(s)]);
  for (let n = alvo; n && n !== ponta; n = p.seguir.get(n)) {
    if (visto.has(n) || !nomes.includes(n)) {
      alvo = null;
      break;
    }
    visto.add(n);
  }
  const quem = sessaoDe(alvo && nomes.includes(alvo) ? alvo : ponta);
  return quem?.estado?.hunt ? { pos: quem.estado.hunt.pos, coleira: p.coleiras.get(nomeDe(s)) ?? 5 } : null;
}

const olhar = (e) => ({ type: e.outfit?.type ?? 128, head: e.outfit?.head ?? 78, body: e.outfit?.body ?? 88, legs: e.outfit?.legs ?? 58, feet: e.outfit?.feet ?? 76, mount: e.outfit?.mount ?? 0, addons: e.outfit?.addons ?? 0 });

/** O que entra no retrato da hunt: os outros da sala, os familiares deles e `party`. */
export function extrasDoRetrato(s) {
  const outros = naMesmaSala(s).filter((o) => o !== s);
  const p = minhaParty(s);
  const extras = {
    aliados: outros.map((o) => {
      const e = o.estado;
      const v = olhar(e);
      return { uid: `aliado:${nomeDe(o)}`, name: nomeDe(o), x: e.hunt.pos.x, y: e.hunt.pos.y, dir: e.hunt.pos.dir ?? 2, look: v.type, colors: v, mount: 0, addons: v.addons, hp: e.hp, maxHp: e.maxHp, level: e.level, moveMs: 250 };
    }),
    summonsDoGrupo: outros
      .filter((o) => o.estado.hunt.summon)
      .map((o) => {
        const f = o.estado.hunt.summon;
        return { uid: `${f.uid}:${nomeDe(o)}`, x: f.x, y: f.y, dir: f.dir, look: f.look, name: f.name, nivel: f.nivel, moveMs: 250 };
      }),
  };
  // Sempre presente (null sem party): o quadro em delta (`game/websocket/quadro.mjs`)
  // só manda chave que MUDOU — uma chave que some nunca chegaria ao client, e
  // ele seguiria mostrando a partilha de antes de sair da party.
  extras.party = null;
  if (p) {
    const part = partilha(s);
    const nomes = part.membros.map((m) => m.nome);
    extras.party = {
      ativa: part.ativa,
      motivo: part.motivo,
      faixa: part.faixa,
      bonus: part.bonus,
      vocacoes: part.vocacoes,
      lider: p.lider,
      mandaNaFila: p.lider,
      frente: nomes.includes(p.frente) ? p.frente : p.lider,
      seguirQuem: p.seguir.get(nomeDe(s)) ?? null,
      coleira: p.coleiras.get(nomeDe(s)) ?? 5,
      coleiras: COLEIRAS,
      membros: part.membros.map((m) => {
        const o = sessaoDe(m.nome);
        const mostrar = o?.estado?.settings?.verAcoesDaParty !== false;
        return {
          name: m.nome,
          coleira: p.coleiras.get(m.nome) ?? 5,
          estado: 'ok',
          acoes: mostrar ? (o?.estado?.actions ?? []).filter((a) => a?.id).slice(0, 8).map((a) => ({ id: a.id, ...(o.estado.hunt?.cooldowns?.[a.id] ?? {}) })) : null,
        };
      }),
    };
  }
  return extras;
}

/** Os campos do personagem: `party`, `partySlots`, `convitePartyDe`, `pedidoDeEntrada`. */
export function camposDoPersonagem(s) {
  const p = minhaParty(s);
  const eu = nomeDe(s);
  const convite = [...parties.values()].find((x) => (x.convites.get(eu) ?? 0) > Date.now());
  const pedido = pedidos.get(eu);
  const minhaSala = s.estado?.hunt ? Cacadas.salaDe(s.estado.hunt) : null;
  const campos = {
    partySlots: limiteDeChars(s.conta?.id),
    convitePartyDe: convite?.lider ?? null,
    pedidoDeEntrada: pedido && pedido.expira > Date.now() ? { de: pedido.de } : null,
    party: null,
  };
  if (!p) return campos;
  campos.party = {
    lider: p.lider,
    souLider: p.lider === eu,
    maximo: maximo(p.membros),
    membros: p.membros.map((nome) => {
      const o = sessaoDe(nome);
      const e = o?.estado;
      const sala = e?.hunt ? Cacadas.salaDe(e.hunt) : null;
      const naMinha = !!sala && sala === minhaSala;
      const cacando = !!e?.hunt;
      const expDoLevel = e ? Cacadas.progressoDoLevel(e) : 0;
      return {
        name: nome,
        nome,
        eu: nome === eu,
        lider: nome === p.lider,
        online: !!o,
        vocation: e?.vocation ?? 'none',
        // O nome depois da promoção ("Royal Paladin"), para o card do membro.
        vocationName: e ? Promocao.nomeDaClasse(e) : null,
        level: e?.level ?? 0,
        outfit: e ? olhar(e) : null,
        hp: e?.hp ?? 0,
        maxHp: e?.maxHp ?? 1,
        mana: e?.mana ?? 0,
        maxMana: e?.maxMana ?? 1,
        progresso: expDoLevel,
        hunt: cacando ? Cacadas.nomeDaHunt(e.hunt.huntId) : null,
        naMinhaCacada: naMinha && nome !== eu,
        cacandoPorFora: cacando && !naMinha,
        podeChamar: !!o && nome !== eu && !!minhaSala && !naMinha,
        // Ele deixou a porta aberta ("Permitir entrar na caçada") e eu posso entrar lá.
        podeEntrarDireto: !!o && nome !== eu && cacando && !naMinha && e.settings?.entrarSemConvite === true && !motivoParaNaoEntrar(s, sala),
        podePedirEntrada: !!o && nome !== eu && cacando && !naMinha,
      };
    }),
  };
  return campos;
}

// ------------------------------------- os chars da MESMA conta (troca de personagem)

/** Está numa party agora? (o char sem aba — ver `Sessao.contaChar` — sai do mundo quando deixa de estar). */
export const naParty = (s) => !!minhaParty(s);

/**
 * "+ Party" na troca de personagem: põe `outro` (da MESMA conta, já no mundo)
 * na party de `dono`, sem convite para aceitar — é a mesma pessoa dos dois
 * lados. As regras são as do convite normal: só o líder chama, e o teto da party.
 */
export function juntarDaConta(dono, outro) {
  const p = minhaParty(dono);
  if (p && p.membros.includes(nomeDe(outro))) return { ok: true, jaEstava: true };
  const convite = comandoDoGrupo(dono, { action: 'convidar', name: nomeDe(outro) });
  if (!convite.ok) return convite;
  const aceite = comandoDoGrupo(outro, { action: 'aceitar' });
  if (!aceite.ok) return aceite;
  return { ok: true, notice: `${nomeDe(outro)} entrou na sua party.` };
}

/** "➜ Hunt": leva `outro` (já na party) para a caçada de `dono`, sem ele precisar aceitar. */
export function chamarDaConta(dono, outro) {
  if (!dono.estado?.hunt) return { ok: false, erro: 'Entre numa caçada para chamar alguém para ela.' };
  const sala = Cacadas.salaDe(dono.estado.hunt);
  if (outro.estado?.hunt && Cacadas.salaDe(outro.estado.hunt) === sala) return { ok: true, notice: `${nomeDe(outro)} já está na sua caçada.` };
  return juntar(outro, dono);
}

// -------------------------------------------- "Seguir líder em qualquer ocasião"

/*
 * A marca `settings.seguirLider` (⚙ Config da troca de personagem, e a janela de
 * party de quem não é o líder): o membro vai junto quando o líder ENTRA numa
 * caçada (ou troca de hunt, ou entra na caçada de alguém), e volta junto quando
 * ele VOLTA PARA A CIDADE ou MORRE — mesmo sem aba aberta. As portas valem: a
 * hunt liberada, os 10 levels, premium/acesso, o teto da sala (ver `juntar`).
 * Quem não pode seguir fica onde está e recebe o porquê (e o líder também).
 *
 * Sala de boss em grupo não existe: boss o líder faz sozinho, e ninguém segue.
 */
const seguidores = (lider) => {
  const p = minhaParty(lider);
  if (!p || p.lider !== nomeDe(lider)) return [];
  return p.membros
    .filter((n) => n !== p.lider)
    .map(sessaoDe)
    .filter((o) => o?.estado && o.estado.settings?.seguirLider === true);
};

/** O líder acabou de entrar numa caçada: quem segue, vai junto. */
export function seguirOLider(lider) {
  const sala = lider.estado?.hunt ? Cacadas.salaDe(lider.estado.hunt) : null;
  if (!sala || sala.isBoss || sala.huntId === 'treino') return;
  for (const o of seguidores(lider)) {
    if (o.estado.hunt && Cacadas.salaDe(o.estado.hunt) === sala) continue;
    // Treinando no boneco (exercise): o treino é dele, e seguir o interromperia sem ele pedir.
    if (o.estado.exercicio?.treinando) continue;
    const r = juntar(o, lider);
    if (r.ok) avisar(o, `Seguindo ${nomeDe(lider)}: ${Cacadas.nomeDaHunt(sala.huntId)}.`);
    else {
      avisar(o, `Não deu para seguir ${nomeDe(lider)}: ${r.erro}`);
      avisar(lider, `${nomeDe(o)} não pôde vir: ${r.erro}`);
    }
    mandarJa(o);
  }
}

/*
 * ---- "Avançar sozinho" em grupo ----
 *
 * O dono (29/09): "na party, se eu tiver avançar sozinho e ele também, a gente segue junto para a
 * próxima hunt". Quem completa a fase e tem o "Avançar sozinho" (`settings.aoCompletarFase ===
 * 'seguir'`) vai para a próxima; os da party que estão NA MESMA sala e também marcaram "Avançar
 * sozinho" vão junto. Quem deixou em "Ficar na fase" fica onde está. As portas valem como sempre
 * (`juntar`): a fase liberada para ELE, o teto da sala... — quem não pode ir recebe o porquê.
 *
 * `quemAvancaJunto` roda ANTES de o dono sair da fase (a saída passa a sala para quem fica e muda
 * quem está nela); `avancarJunto` roda depois de ele entrar na próxima.
 */
export function quemAvancaJunto(dono) {
  const p = minhaParty(dono);
  const sala = dono.estado?.hunt ? Cacadas.salaDe(dono.estado.hunt) : null;
  if (!p || !sala || sala.isBoss) return [];
  return p.membros
    .filter((n) => n !== nomeDe(dono))
    .map(sessaoDe)
    .filter((o) => o?.estado?.hunt && Cacadas.salaDe(o.estado.hunt) === sala && o.estado.settings?.aoCompletarFase === 'seguir');
}

export function avancarJunto(dono, membros) {
  const sala = dono.estado?.hunt ? Cacadas.salaDe(dono.estado.hunt) : null;
  if (!sala) return;
  for (const o of membros) {
    if (o.estado.hunt && Cacadas.salaDe(o.estado.hunt) === sala) continue; // já veio (Seguir líder)
    const r = juntar(o, dono);
    if (r.ok) avisar(o, `Avançando com ${nomeDe(dono)}: ${Cacadas.nomeDaHunt(sala.huntId)}.`);
    else {
      avisar(o, `Não deu para avançar com ${nomeDe(dono)}: ${r.erro}`);
      avisar(dono, `${nomeDe(o)} não pôde avançar: ${r.erro}`);
    }
    mandarJa(o);
  }
}

/**
 * O líder vai sair da caçada (voltou para a cidade, ou morreu): quem segue e
 * está na MESMA sala volta junto, com o extrato — chamado ANTES de ele sair.
 */
export function voltarComOLider(lider, motivo) {
  const sala = lider.estado?.hunt ? Cacadas.salaDe(lider.estado.hunt) : null;
  if (!sala) return;
  for (const o of seguidores(lider)) {
    if (!o.estado.hunt || Cacadas.salaDe(o.estado.hunt) !== sala) continue;
    const report = Cacadas.relatorio(o.estado);
    // Se a sala é DELE (o líder entrou na dele), quem fica assume antes de ele sair.
    antesDeSairDaCacada(o);
    o.estado.hunt = null;
    if (report) o.enviar({ t: 'runReport', report, motivo: `${nomeDe(lider)} ${motivo} — você voltou junto (Seguir líder).` });
    avisar(o, `Você voltou para a cidade com ${nomeDe(lider)}.`);
    mandarJa(o);
  }
}
