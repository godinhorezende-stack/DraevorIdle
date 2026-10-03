// A OPERAÇÃO do servidor pela Engine: o modo beta, o modo de manutenção e o Server Save — o que antes só existia como rotas soltas em
// `backend/index.mjs`. Funções que as telas "Testes e beta" e "Configurações" (e as rotas antigas, por compatibilidade) usam. Nada aqui
// grava arquivo: o estado é do processo (o modo beta e a manutenção voltam ao padrão no reinício) e o Server Save é o do jogo
// (`systems/server-save.mjs`). Cada AÇÃO fica num registro em memória (quem pediu o quê e quando) para a tela mostrar.
import * as Beta from '../systems/modo-beta.mjs';
import * as Manutencao from '../systems/modo-de-manutencao.mjs';
import * as Campanha from '../systems/campanha.mjs';
import { CATALOGO } from '../systems/dados.mjs';
import { proximoSlot } from '../systems/server-save-horario.mjs';

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

/** Tudo da tela Configurações. */
export async function estadoGeral() {
  return { manutencao: { ativa: Manutencao.bloqueada(), mensagem: Manutencao.mensagemDeBloqueio(), maxMensagem: MAX_MENSAGEM }, beta: { ativo: Beta.ativo() }, serverSave: await estadoDoServerSave(), registro: registro(), agora: Date.now() };
}
