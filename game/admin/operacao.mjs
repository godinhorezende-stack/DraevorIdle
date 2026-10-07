// A OPERAÇÃO do servidor pela Engine: o modo beta, o modo de manutenção e o Server Save — o que antes só existia como rotas soltas em
// `backend/index.mjs`. Funções que as telas "Testes e beta" e "Configurações" (e as rotas antigas, por compatibilidade) usam. Nada aqui
// grava arquivo: o estado é do processo (o modo beta e a manutenção voltam ao padrão no reinício) e o Server Save é o do jogo
// (`systems/server-save.mjs`). Cada AÇÃO fica num registro em memória (quem pediu o quê e quando) para a tela mostrar.
import * as Beta from '../systems/modo-beta.mjs';
import * as Manutencao from '../systems/modo-de-manutencao.mjs';
import * as Campanha from '../systems/campanha.mjs';
import { CATALOGO } from '../systems/dados.mjs';
import { proximoSlot } from '../systems/server-save-horario.mjs';
import { conexoes, vivas } from '../websocket/sessao.mjs';
import { nomeDaHunt } from '../systems/hunt/terreno.mjs';
import { avisoGlobal } from '../systems/avisos-globais.mjs';

const REGISTRO = [];
const MAX_REGISTRO = 50;
const anotar = (acao, detalhe) => {
  REGISTRO.unshift({ quando: Date.now(), acao, detalhe });
  REGISTRO.length = Math.min(REGISTRO.length, MAX_REGISTRO);
};
/** As últimas ações de operação deste processo (mais nova primeiro). */
export const registro = () => REGISTRO.map((r) => ({ ...r }));
export const _limparRegistroParaTestes = () => { REGISTRO.length = 0; };

// ------------------------------------------------------------------ modo beta

/** O que o beta libera e o que NÃO muda (texto da tela; a regra de verdade está em `modo-beta.mjs`, `premium.mjs`, `cacadas.mjs`, `bosses.mjs`). */
export const BETA_LIBERA = [
  'Hunts VIP, Instance e Divine: entra sem premium, sem pergaminho de acesso e sem o level mínimo (e não é expulso por falta de acesso).',
  'Bosses: entra sem level, sem Boss Task, sem "já derrotado" e sem recarga (tentativas ilimitadas); nenhuma espera é gravada na entrada.',
  'Atos do editor em estado "beta" passam a valer para os jogadores.',
];
export const BETA_NAO_MUDA = [
  'O boss final de um ato só abre pelo portal, depois de limpar a hunt NESTA execução.',
  'A duração da sala de boss (25 min), a instância e a limpeza da hunt e os limites de combate.',
  'Nada é gravado nos personagens: desligar devolve as regras normais na hora.',
  'Os drops e recompensas ganhos durante o beta entram na economia real (não há perfil de teste separado).',
];

export function estadoDoBeta() {
  const padrao = Beta.padraoDoBoot();
  return { ativo: Beta.ativo(), padraoDoBoot: padrao.valor, origemDoPadrao: padrao.origem, libera: BETA_LIBERA, naoMuda: BETA_NAO_MUDA, alcance: { vips: CATALOGO.vips?.length ?? 0, especiais: CATALOGO.especiais?.length ?? 0, divinas: CATALOGO.divinas?.length ?? 0, bosses: CATALOGO.bosses?.length ?? 0 }, atosDoEditor: atosDoEditor() };
}

/** Os atos do editor que o jogo carregou neste boot, com o estado e se valem AGORA (beta só vale com o modo beta ligado). */
export function atosDoEditor() {
  return [...Campanha.ATOS_DO_EDITOR.values()].map((g) => ({ id: g.ato.id, nome: g.ato.nome, numero: g.numero, estado: g.ato.estado, fases: g.ato.fases.length, valeAgora: Campanha.atoAtivo(g.numero) }));
}

export function definirBeta(ativo) {
  if (typeof ativo !== 'boolean') return { ok: false, erros: ['ativo deve ser true ou false.'] };
  const antes = Beta.ativo();
  Beta.definir(ativo);
  if (antes !== ativo) anotar('modo beta', ativo ? 'ligado' : 'desligado');
  return { ok: true, ativo: Beta.ativo(), mudou: antes !== ativo };
}

// ------------------------------------------------------------------ manutenção

export const MAX_MENSAGEM = 200;
export function definirManutencao(ativo, mensagem = null) {
  if (typeof ativo !== 'boolean') return { ok: false, erros: ['ativo deve ser true ou false.'] };
  if (mensagem != null && (typeof mensagem !== 'string' || mensagem.length > MAX_MENSAGEM)) return { ok: false, erros: [`A mensagem tem até ${MAX_MENSAGEM} caracteres.`] };
  const texto = mensagem?.trim() ? mensagem.trim() : null;
  const antes = Manutencao.bloqueada();
  Manutencao.definir(ativo, texto);
  if (antes !== ativo) anotar('manutenção', ativo ? `ligada${texto ? `: ${texto}` : ''}` : 'desligada');
  return { ok: true, ativa: Manutencao.bloqueada(), mensagem: Manutencao.mensagemDeBloqueio(), mudou: antes !== ativo };
}

// ------------------------------------------------------------------ Server Save (carregado só quando preciso: ele abre o banco)

/** A situação do Server Save, os últimos ciclos e o próximo horário (se o sistema estiver rodando neste processo). */
export async function estadoDoServerSave() {
  const SS = await import('../systems/server-save.mjs');
  const situacao = SS.situacao();
  let ciclos = [];
  try {
    ciclos = await SS.ultimosCiclos(10);
  } catch {
    ciclos = [];
  }
  const proximo = situacao?.config ? proximoSlot(Date.now(), { timezone: situacao.config.timezone, horaLocal: situacao.config.horaLocal }) : null;
  return { rodando: !!situacao, situacao, proximoSlot: proximo, ciclos, processo: SS.PROCESSO_ID };
}

/** Roda um Server Save agora (os jogadores recebem o aviso global da rotina). */
export async function executarServerSave() {
  const SS = await import('../systems/server-save.mjs');
  if (!SS.situacao()) return { ok: false, erros: ['O Server Save não está rodando neste processo.'] };
  anotar('server save', 'executado agora (manual)');
  return SS.executarAgora();
}

// ------------------------------------------------------------------ o servidor: quem está online (com IP) e o reinício

/** Onde o personagem está agora, em palavras. */
function ondeEsta(s) {
  const e = s.estado;
  if (!e) return 'escolhendo personagem';
  if (e.hunt?.huntId) return `${e.hunt.mode === 'offline' ? 'caçando offline em' : 'caçando em'} ${nomeDaHunt(e.hunt.huntId)}`;
  return 'na cidade';
}

/** Contas e personagens online agora, com IP, e os números do processo (para a tela "Servidor"). */
export function estadoDoServidor({ agora = Date.now() } = {}) {
  const lista = [...conexoes].filter((s) => s.ws?.readyState === 1);
  const contas = new Set();
  const ips = new Set();
  const online = [];
  for (const s of lista) {
    if (s.conta?.id != null) contas.add(s.conta.id);
    if (s.ip) ips.add(s.ip);
    online.push({ conta: s.conta?.email ?? null, personagem: s.personagem?.nome ?? null, level: s.estado?.level ?? null, ip: s.ip ?? null, onde: s.personagem ? ondeEsta(s) : (s.conta ? 'escolhendo personagem' : 'sem login'), desde: s.entrouEm ?? s.conectadoEm, conectadoEm: s.conectadoEm });
  }
  online.sort((a, b) => (a.personagem ? 0 : 1) - (b.personagem ? 0 : 1) || a.desde - b.desde);
  const m = process.memoryUsage();
  return {
    agora,
    totais: { conexoes: lista.length, contas: contas.size, personagens: vivas.size, ips: ips.size },
    online,
    processo: { pid: process.pid, noDesde: agora - Math.round(process.uptime() * 1000), memoriaMb: Math.round(m.rss / 1048576), node: process.version, supervisionado: !!(process.env.DOCKER || process.env.ENGINE_MODO === 'producao' || process.env.NODE_ENV === 'production') },
    reinicio: REINICIO ? { ...REINICIO } : null,
    registro: registro(),
  };
}

let REINICIO = null;
/** O que o `backend/index.mjs` manda parar antes de sair (Server Save, limpeza do chão) — ele registra aqui no boot. */
export let aoReiniciar = null;
export const registrarDesligamento = (fn) => { aoReiniciar = fn; };
const ATRASO_DO_REINICIO_MS = 5000;
/**
 * Reinicia o servidor: avisa quem está jogando, grava todo mundo (o mesmo caminho do Ctrl+C) e sai com código 0. Quem sobe o processo de
 * novo é o supervisor (em produção o Docker, `restart: unless-stopped`); num `node` solto o processo só para. `sair` é injetável para os testes.
 */
export function reiniciar({ quem = null, motivo = null, sair = (c) => process.exit(c), esperar = ATRASO_DO_REINICIO_MS, desligar = null } = {}) {
  if (REINICIO) return { ok: false, erros: [`Já há um reinício em andamento (pedido ${new Date(REINICIO.pedidoEm).toLocaleTimeString('pt-BR')}).`] };
  const texto = motivo?.trim() ? String(motivo).trim().slice(0, MAX_MENSAGEM) : null;
  REINICIO = { pedidoEm: Date.now(), quem, motivo: texto, em: Date.now() + esperar };
  anotar('reinício do servidor', `pedido${quem ? ` por ${quem}` : ''}${texto ? `: ${texto}` : ''}`);
  const jogadores = avisoGlobal(`O servidor vai reiniciar em ${Math.round(esperar / 1000)} segundos${texto ? ` (${texto})` : ''}. Seu progresso é gravado; entre de novo em instantes.`, 'aviso');
  setTimeout(() => {
    try {
      desligar?.();
      for (const s of vivas.values()) s.soltarPersonagem?.();
    } finally {
      sair(0);
    }
  }, esperar).unref?.();
  return { ok: true, em: REINICIO.em, avisados: jogadores ?? 0 };
}
export const _limparReinicioParaTestes = () => { REINICIO = null; };

/** Tudo da tela Configurações. */
export async function estadoGeral() {
  return { manutencao: { ativa: Manutencao.bloqueada(), mensagem: Manutencao.mensagemDeBloqueio(), maxMensagem: MAX_MENSAGEM }, beta: { ativo: Beta.ativo() }, serverSave: await estadoDoServerSave(), registro: registro(), agora: Date.now() };
}
