// O ESTADO dos encontros de UMA instância (`instancia.encontros`) e as regras de transição.
//
//   ausente     — o sorteio disse que NÃO existe nesta instância (nem é gravado: sai do `rolar` da semente);
//   dormindo    — existe, mas a condição ainda não foi cumprida;
//   disponivel  — pode ser ativado;
//   ativo       — em andamento (alguém o ativou);
//   concluido   — terminou bem (terminal);
//   falhou      — terminou mal (terminal; um OBRIGATÓRIO que falha volta a `disponivel`: nunca trava a fase);
//   expirado    — ninguém o resolveu a tempo (terminal; só opcionais).
//
// Tudo aqui é idempotente: o segundo comando igual (clique duplo, reconexão, dois membros da party) devolve
// `{ ok: false, motivo }` e NÃO muda nada — é isso que impede dois bosses, dois baús e duas recompensas.
// A instância (e portanto este estado) é gravada junto com a caçada (`huntParaGravar`): o que se sorteou e o que
// já aconteceu sobrevivem a reconexão, a salvamento e à volta de quem estava offline.
import { aparece, novaSemente } from './sorteio.mjs';
import { tipoDe } from './tipos.mjs';

export const ESTADOS = ['dormindo', 'disponivel', 'ativo', 'concluido', 'falhou', 'expirado'];
const PENDENTES = new Set(['dormindo', 'disponivel', 'ativo']);

const nomeDoSlot = (id, i, quantidade) => (quantidade > 1 ? `${id}#${i + 1}` : id);

/**
 * Cria os encontros da instância a partir das definições (já normalizadas) do mapa: sorteia, uma vez, quais
 * existem. Guarda `semente`, `encontros` (só os que existem) e `ausentes` (os ids que não saíram, para auditoria).
 */
export function criar(instancia, definicoes, { semente = novaSemente(), agora = 0 } = {}) {
  instancia.semente = semente;
  instancia.encontros = {};
  instancia.ausentes = [];
  const existentes = new Set();
  for (const def of definicoes ?? []) {
    if (!def.ativo) continue;
    for (let i = 0; i < def.quantidade; i++) {
      const slot = nomeDoSlot(def.id, i, def.quantidade);
      if (!aparece(semente, slot, def.probabilidade)) {
        instancia.ausentes.push(slot);
        continue;
      }
      existentes.add(def.id);
      // O encontro leva a definição INTEIRA (a instância é gravada com a caçada e o balanceamento do mapa pode mudar
      // depois: o que foi sorteado e prometido nesta instância continua valendo até ela acabar).
      const { ativo, quantidade, probabilidade, ...resto } = def;
      instancia.encontros[slot] = { ...resto, id: slot, defId: def.id, estado: 'dormindo', tentativas: 0 };
      // Sorteios que são do TIPO (armadilha, invocação secreta) também saem da semente, uma vez.
      tipoDe(def.tipo)?.aoCriar?.(instancia.encontros[slot], def, { semente });
    }
  }
  // Quem depende de um encontro que não saiu na instância não existe nela (não há como liberá-lo).
  for (const [slot, e] of Object.entries(instancia.encontros)) {
    if (e.condicao.tipo === 'apos-encontro' && !existentes.has(e.condicao.encontro)) {
      delete instancia.encontros[slot];
      instancia.ausentes.push(slot);
    }
  }
  avaliar(instancia, { monstrosLimpos: false, agora });
  return instancia;
}

const slotsDe = (instancia, defId) => Object.values(instancia.encontros ?? {}).filter((e) => e.defId === defId);

function condicaoCumprida(instancia, e, { monstrosLimpos }) {
  switch (e.condicao.tipo) {
    case 'sempre':
      return true;
    case 'monstros-limpos':
      return !!monstrosLimpos;
    case 'apos-encontro': {
      const de = slotsDe(instancia, e.condicao.encontro);
      return de.length > 0 && de.every((x) => x.estado === 'concluido');
    }
    default:
      return false;
  }
}

/**
 * Chamada pela instância a cada passo da limpeza (barata: só olha a lista pequena de encontros): libera os que
 * a condição liberou, expira os opcionais que passaram do prazo e, na Caça AUTOMÁTICA, deixa cada tipo resolver
 * o que o idle resolve sozinho (`resolverNoIdle`). Devolve quantos encontros mudaram de estado.
 */
export function avaliar(instancia, { monstrosLimpos = false, agora = 0, hunt = null, estado = null, personagem = null } = {}) {
  const todos = instancia?.encontros;
  if (!todos) return 0;
  let mudou = 0;
  for (const e of Object.values(todos)) {
    if (e.estado === 'dormindo' && condicaoCumprida(instancia, e, { monstrosLimpos })) {
      e.estado = 'disponivel';
      e.disponivelEm = agora;
      mudou++;
    }
    // Só opcionais expiram, e só enquanto ninguém os ativou.
    if (e.estado === 'disponivel' && !e.obrigatorio && e.expiraMs && agora - (e.disponivelEm ?? agora) >= e.expiraMs) {
      e.estado = 'expirado';
      mudou++;
    }
  }
  // O tipo confere se o encontro EM ANDAMENTO ainda tem como terminar (ex.: o boss sumiu sem o gancho de morte):
  // nunca deixa a instância esperando por algo que não existe mais.
  if (hunt) {
    let verificou = false;
    for (const e of Object.values(todos)) if (e.estado === 'ativo') (verificou = true), tipoDe(e.tipo)?.verificar?.({ hunt, instancia, encontro: e, agora, estado, personagem });
    // Quem concluiu agora (ex.: a última onda) libera já os que dependem dele — a fase pode fechar neste mesmo passo.
    if (verificou) {
      for (const e of Object.values(todos)) {
        if (e.estado === 'dormindo' && condicaoCumprida(instancia, e, { monstrosLimpos })) {
          e.estado = 'disponivel';
          e.disponivelEm = agora;
          mudou++;
        }
      }
    }
  }
  // Os que CHEGAM sozinhos (o invasor) não esperam interação nem o modo automático.
  if (hunt) {
    for (const e of Object.values(todos)) if (e.estado === 'disponivel' && tipoDe(e.tipo)?.sozinho && ativar(instancia, e.id, { quem: 'sozinho', agora, hunt, estado, personagem }).ok) mudou++;
  }
  if (hunt?.modo === 'auto') {
    for (const e of Object.values(todos)) {
      const tipo = tipoDe(e.tipo);
      // Quem pede uma DECISÃO do jogador não é ativado pelo idle (e expira, se for opcional).
      if (!tipo || tipo.idle === 'escolha') continue;
      if (e.estado === 'disponivel' && ativar(instancia, e.id, { quem: 'idle', agora, hunt, estado, personagem }).ok) mudou++;
      if (e.estado === 'ativo' && tipo.resolverNoIdle) {
        tipo.resolverNoIdle({ hunt, instancia, encontro: e, agora, estado, personagem });
        mudou++;
      }
    }
  }
  return mudou;
}

const nega = (motivo) => ({ ok: false, motivo });

/** `disponivel → ativo`. Só o primeiro comando vale: o segundo (mesmo de outro jogador) devolve `ja-ativo`. */
export function ativar(instancia, id, { quem = null, agora = 0, hunt = null, estado = null, personagem = null } = {}) {
  const e = instancia?.encontros?.[id];
  if (!e) return nega('nao-existe');
  if (e.estado === 'ativo') return nega('ja-ativo');
  if (e.estado === 'concluido') return nega('ja-concluido');
  if (e.estado !== 'disponivel') return nega(`indisponivel:${e.estado}`);
  // Requisitos do tipo (nível, chave): quem não cumpre não ativa — e o encontro segue disponível.
  const pode = tipoDe(e.tipo)?.podeAtivar?.({ hunt, instancia, encontro: e, agora, estado, personagem });
  if (pode && !pode.ok) return nega(`requisito:${pode.motivo}`);
  e.estado = 'ativo';
  e.ativadoPor = quem;
  e.ativadoEm = agora;
  tipoDe(e.tipo)?.aoAtivar?.({ hunt, instancia, encontro: e, agora, estado, personagem });
  return { ok: true, encontro: e };
}

/** `ativo → concluido`, uma vez só: `{ ok: true }` na primeira; `ja-concluido` (sem efeito) depois — a recompensa vai pela primeira. */
export function concluir(instancia, id, { agora = 0, viaProjecao = false } = {}) {
  const e = instancia?.encontros?.[id];
  if (!e) return nega('nao-existe');
  if (e.estado === 'concluido') return nega('ja-concluido');
  if (e.estado !== 'ativo') return nega(`indisponivel:${e.estado}`);
  e.estado = 'concluido';
  e.concluidoEm = agora;
  if (viaProjecao) e.viaProjecao = true;
  return { ok: true, encontro: e };
}

/** `ativo → falhou`. O OBRIGATÓRIO volta a `disponivel` (mais uma tentativa); o opcional termina. */
export function falhar(instancia, id, { agora = 0 } = {}) {
  const e = instancia?.encontros?.[id];
  if (!e) return nega('nao-existe');
  if (e.estado !== 'ativo') return nega(`indisponivel:${e.estado}`);
  e.tentativas += 1;
  if (e.obrigatorio) {
    e.estado = 'disponivel';
    e.disponivelEm = agora;
    delete e.ativadoPor;
  } else {
    e.estado = 'falhou';
  }
  return { ok: true, encontro: e, terminou: !e.obrigatorio };
}

/** O líder recusou o que estava disponível: `disponivel → expirado` (não volta; opcional, a decisão é dele). */
export function recusar(instancia, id, { agora = 0, quem = null } = {}) {
  const e = instancia?.encontros?.[id];
  if (!e) return nega('nao-existe');
  if (e.estado !== 'disponivel') return nega(`indisponivel:${e.estado}`);
  e.estado = 'expirado';
  e.recusadoPor = quem;
  e.expiradoEm = agora;
  return { ok: true, encontro: e };
}

/** O evento foi cancelado (quem o ativou saiu da sala, a hunt acabou...): `ativo → disponivel`, sem contar tentativa. */
export function cancelar(instancia, id, { agora = 0 } = {}) {
  const e = instancia?.encontros?.[id];
  if (!e) return nega('nao-existe');
  if (e.estado !== 'ativo') return nega(`indisponivel:${e.estado}`);
  e.estado = 'disponivel';
  e.disponivelEm = agora;
  delete e.ativadoPor;
  return { ok: true, encontro: e };
}

/** Quantos encontros estão EM ANDAMENTO (ativos): seguram o CLEAR, obrigatórios ou não. */
export function emAndamento(instancia) {
  let n = 0;
  for (const e of Object.values(instancia?.encontros ?? {})) if (e.estado === 'ativo') n++;
  return n;
}

/** Quantos encontros OBRIGATÓRIOS ainda faltam (trava o CLEAR da fase). */
export function obrigatoriosPendentes(instancia) {
  let n = 0;
  for (const e of Object.values(instancia?.encontros ?? {})) if (e.obrigatorio && PENDENTES.has(e.estado)) n++;
  return n;
}

/**
 * A caçada offline PROJETADA zerou a instância: o idle resolve o que pode (política do dono: o personagem nunca
 * fica preso). Obrigatórios contam como concluídos — SEM recompensa (`viaProjecao`) — e opcionais expiram.
 */
export function resolverNaProjecao(instancia, { agora = 0 } = {}) {
  let n = 0;
  for (const e of Object.values(instancia?.encontros ?? {})) {
    if (!PENDENTES.has(e.estado)) continue;
    if (e.obrigatorio) {
      e.estado = 'concluido';
      e.concluidoEm = agora;
      e.viaProjecao = true;
    } else {
      e.estado = 'expirado';
    }
    n++;
  }
  return n;
}

/** Contagem por estado (para o log, o editor e os testes). */
export function resumo(instancia) {
  const r = Object.fromEntries(ESTADOS.map((s) => [s, 0]));
  for (const e of Object.values(instancia?.encontros ?? {})) r[e.estado]++;
  return { ...r, ausentes: instancia?.ausentes?.length ?? 0, obrigatoriosPendentes: obrigatoriosPendentes(instancia) };
}
