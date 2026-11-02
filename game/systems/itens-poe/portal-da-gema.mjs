// O PORTAL da gema do PoE (dono, 02/11: "como o PoE" — antes "não se aplica"). No PoE o Portal "Cria um portal para a vila da área atual": você
// vai para a cidade e volta pelo MESMO portal para o mesmo lugar da área, com os monstros que ficaram. Aqui:
//
//   - o uso da gema (à mão, com os 2,5 s de conjuração dela — `acoes.usarPortalDaGema`) marca a saída (`hunt.saidaPeloPortal`); a sessão leva
//     você para a cidade (`Sessao.entrarNoPortalDaGema`) e a caçada fica GUARDADA aqui, em `estado.portalDaGema` (gravado com o personagem,
//     nenhuma tabela nova — os monstros compactados, como o mapa aberto faz — `mapa-aberto.mjs`);
//   - na cidade, o botão "Voltar pelo portal" (`{t:'voltarPeloPortal'}`) leva de volta: a instância com as casas, os monstros vivos, a limpeza e o
//     relógio de quando você saiu, na casa onde o portal abriu (`Cacadas.voltarPeloPortalDaGema`);
//   - o portal dura até ser usado para voltar ou até você abrir OUTRA caçada (`Cacadas.entrar`/`entrarNaSala` o fecham — `fechar`);
//   - na party, quem usa vai sozinho (como no PoE: cada um entra no portal) e, na volta, entra na sala da party se ela ainda estiver na mesma
//     instância (`Party.voltarPeloPortal`); sem ela, volta sozinho à cópia guardada;
//   - no MAPA do endgame, o Portal NÃO gasta um dos 6 portais do mapa (no PoE o da gema é outro portal): os monstros ficam com o mapa aberto
//     (`MapaAberto.guardarAoSair`, sem morte) e a volta é a do mapa (`MapaAberto.retomar`), na casa do portal.
//
// (Sem uso no nível do módulo dos outros módulos: só funções.)
import { compactarMonstro, completarMonstro, garantirUidAcimaDe } from '../hunt/monstros.mjs';

export const SLUG = 'Portal';
/** O que a caçada leva junto pelo portal (o relatório da sessão, as recargas, o portal do boss do ato, o tempo da sala do chefe…). */
const CAMPOS_DA_CACADA = ['sessao', 'startedAt', 'cooldowns', 'faseCompletaAoEntrar', 'avancarJa', 'fimDaSala'];

/** O portal aberto deste personagem (ou null). */
export const doPersonagem = (estado) => estado?.portalDaGema ?? null;

/** Fecha o portal (usado para voltar, ou outra caçada aberta). */
export function fechar(estado) {
  if (estado?.portalDaGema) estado.portalDaGema = null;
}

/** Por que o Portal não abre nesta caçada (ou null): o duelo da Arena e a sala de chefe que não é a do ato (os pináculos, os chefes diários). */
export function motivoParaNaoAbrir(hunt) {
  if (!hunt) return 'Você não está numa caçada.';
  if (hunt.pvp) return 'O Portal não abre no duelo.';
  if (hunt.isBoss && hunt.campanha?.bossDoAto == null) return 'O Portal não abre na sala deste chefe.';
  return null;
}

/** A cópia JSON de um bicho vivo (o mesmo que vai para o banco: a caçada da sala segue viva para os outros da party). */
const guardarBicho = (m) => JSON.parse(JSON.stringify(compactarMonstro(m)));

/**
 * Guarda a caçada de agora no portal (antes de ela sumir — a sessão chama ANTES de a sala passar a outro da party). No mapa do endgame, só o
 * lugar: os monstros ficam com o mapa aberto. `{ ok, nome }` ou `{ ok: false, erro }`.
 */
export function guardar(estado, { nome = null, agora = Date.now() } = {}) {
  const h = estado?.hunt;
  const motivo = motivoParaNaoAbrir(h);
  if (motivo) return { ok: false, erro: motivo };
  const sala = h.anfitriao ?? h;
  const instancia = sala.instancia ?? h.instancia ?? null;
  const p = {
    huntId: h.huntId, nome: nome ?? h.huntId, modo: h.modo === 'online' ? 'online' : 'auto', strategy: h.strategy ?? null,
    dificuldade: h.campanha?.dificuldade ?? null, bossDoAto: h.campanha?.bossDoAto ?? null,
    z: h.z ?? 0, pos: { x: h.pos?.x, y: h.pos?.y }, instanciaId: instancia?.id ?? null, abertoEm: agora,
  };
  if (h.mapa?.id) {
    // (o mapa: a volta é a do mapa aberto — só o dono dele o tem; o convidado volta pela party)
    p.mapaId = h.mapa.id;
    p.doDono = !h.anfitriao && estado.mapas?.aberto?.id === h.mapa.id;
  } else {
    const porAndar = { [sala.z ?? 0]: (sala.monstros ?? []).filter((m) => m.hp > 0).map(guardarBicho) };
    for (const [z, lista] of Object.entries(sala.outrosAndares ?? {})) porAndar[z] = [...(porAndar[z] ?? []), ...(Array.isArray(lista) ? lista : []).filter((m) => m.hp > 0).map(guardarBicho)];
    p.porAndar = porAndar;
    p.instancia = instancia ? JSON.parse(JSON.stringify(instancia)) : null;
    p.relogio = sala.clock ?? h.clock ?? 0;
    p.campos = JSON.parse(JSON.stringify(Object.fromEntries(CAMPOS_DA_CACADA.filter((k) => h[k] != null).map((k) => [k, h[k]]))));
    if (sala.portalDoBoss) p.campos.portalDoBoss = JSON.parse(JSON.stringify(sala.portalDoBoss));
  }
  estado.portalDaGema = p;
  return { ok: true, nome: p.nome };
}

/**
 * A volta (fora do mapa): põe a caçada guardada na caçada NOVA (`hunt`, recém-criada por `Cacadas.entrar` na mesma área) — os monstros do andar
 * dela em `monstros`, os outros em `outrosAndares` (o que estiver na sua casa sai do caminho), a instância, o relógio e o que a caçada levou.
 */
export function restaurar(hunt, p) {
  if (!hunt || !p?.porAndar) return false;
  let maior = 0;
  const andares = {};
  for (const [z, lista] of Object.entries(p.porAndar)) {
    andares[z] = lista.map((m) => {
      completarMonstro(m);
      if (Number(m.uid) > maior) maior = Number(m.uid);
      return m;
    });
  }
  garantirUidAcimaDe(maior);
  const z = String(hunt.z ?? 0);
  hunt.monstros = (andares[z] ?? []).filter((m) => !(m.x === hunt.pos.x && m.y === hunt.pos.y));
  delete andares[z];
  hunt.outrosAndares = andares;
  if (p.instancia) hunt.instancia = p.instancia;
  // (o relógio continua de onde parou: os prazos dos monstros guardados são dele — como a volta ao mapa)
  if (Number.isFinite(p.relogio) && p.relogio > (hunt.clock ?? 0)) hunt.clock = p.relogio;
  for (const [k, v] of Object.entries(p.campos ?? {})) hunt[k] = v;
  return true;
}

/** O portal para a tela (o botão "Voltar pelo portal" na cidade). */
export function paraTela(estado) {
  const p = doPersonagem(estado);
  return p ? { nome: p.nome, huntId: p.huntId, mapa: !!p.mapaId, abertoEm: p.abertoEm } : null;
}
