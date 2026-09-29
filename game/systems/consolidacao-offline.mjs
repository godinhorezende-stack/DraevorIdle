// A caçada offline consolidada em SEGUNDO PLANO — o ranking do dia sobe com
// quem caça de aba fechada, sem esperar ele logar.
//
// "quero o ranking atualizando direto". O progresso offline era calculado só na
// volta (`Cacadas.simularAusencia`), e o ranking "exp do dia" lê o banco
// (`site.mjs`, `xp − expDoDia.xp`): quem caçava fora só aparecia ao voltar. A
// cada `INTERVALO_MS`, os ausentes caçando têm a ausência AVANÇADA até agora
// (`Cacadas.consolidarAusencia` — a mesma conta da volta, em pedaços) e o
// personagem é regravado, ainda ausente. O login só termina o que falta.
//
// ---- Quem nunca é mexido aqui ----
// - Quem está no jogo ou entrando (`estaNoJogo`): o estado dele é o da sessão.
// - Ninguém que outro caminho gravou no meio: a regravação é CONDICIONAL
//   (`... WHERE estado = <o que foi lido>`). Uma transferência, uma entrega do
//   mercado, um login que gravou antes — mudou, esta rodada desiste dele e a
//   próxima lê de novo. Nada se perde e nada conta duas vezes: a ausência é
//   sempre avançada a partir do que está gravado.
//
// A parte cara (os 30 min simulados tique a tique, ~3 s) roda na thread da
// simulação offline (`simulacao-offline.mjs`), uma vez por ausência; os pedaços
// seguintes só projetam (milissegundos).
import { banco } from '../database/banco.mjs';
import { colunasDaCacaOffline } from '../database/caca-offline.mjs';
import * as SimulacaoOffline from './simulacao-offline.mjs';
import * as Ausentes from './ausentes.mjs';
import { marcarDia } from './site.mjs';
import { estaNoJogo } from '../websocket/sessao.mjs';

/** De quanto em quanto tempo a rodada passa. */
export const INTERVALO_MS = 10 * 60_000;
/** Só quem está fora há pelo menos isto (menos que isso, a volta resolve sozinha). */
export const MINIMO_FORA_MS = 10 * 60_000;
/** Quantos personagens por rodada, no máximo (os mais antigos primeiro). */
export const POR_RODADA = 40;

/*
 * Pelas colunas-índice (`caca-offline.mjs`), não pelo JSON: só quem ainda TEM o
 * que avançar (`ate > desde`). Quem acabou — morreu, a stamina zerou, bateu o
 * teto de 12 h — sai da fila sozinho; antes ficava no topo dela para sempre
 * (os "mais antigos"), e 40 desses travavam a rodada de todo mundo.
 */
const consultaDosAusentes = banco.prepare(
  `SELECT id, conta, nome, vocacao, estado FROM personagens
    WHERE caca_offline_desde IS NOT NULL AND caca_offline_desde <= ?
      AND caca_offline_ate IS NOT NULL AND caca_offline_ate > caca_offline_desde
    ORDER BY caca_offline_desde
    LIMIT ?`,
);

// Só grava se o estado no banco ainda for EXATAMENTE o que foi lido (e as colunas vão junto).
const gravarSeNinguemMexeu = banco.prepare(
  'UPDATE personagens SET estado = ?, caca_offline_desde = ?, caca_offline_ate = ? WHERE id = ? AND estado = ?',
);

/**
 * Avança a ausência de UM personagem (a linha como veio do banco) e regrava.
 * Devolve `'gravado' | 'no-jogo' | 'nada' | 'mudou'`.
 */
export async function consolidarUm(linha, agora = Date.now()) {
  if (estaNoJogo(linha.nome)) return 'no-jogo';
  const estado = JSON.parse(linha.estado);
  // O ganho entra no dia de HOJE: virou o dia desde a última gravação, a régua
  // do ranking recomeça do que ele tinha (a mesma `marcarDia` de quem está online).
  marcarDia(estado, agora);
  const quem = { id: linha.id, nome: linha.nome, conta: linha.conta, vocacao: linha.vocacao };
  const { estado: novo, ausencia } = await SimulacaoOffline.consolidar(estado, quem, agora);
  if (!ausencia?.avancou) return 'nada';
  // Entrou no jogo enquanto a thread trabalhava: a sessão manda.
  if (estaNoJogo(linha.nome)) return 'no-jogo';
  const r = await gravarSeNinguemMexeu.run(JSON.stringify(novo), ...colunasDaCacaOffline(novo), linha.id, linha.estado);
  return r.changes ? 'gravado' : 'mudou';
}

/** Uma rodada: os ausentes mais antigos, um de cada vez. Devolve a contagem por resultado. */
export async function rodada(agora = Date.now()) {
  const contagem = { gravado: 0, 'no-jogo': 0, nada: 0, mudou: 0, erro: 0 };
  const linhas = await consultaDosAusentes.all(agora - MINIMO_FORA_MS, POR_RODADA);
  for (const linha of linhas) {
    try {
      contagem[await consolidarUm(linha, agora)]++;
    } catch (e) {
      contagem.erro++;
      console.error('consolidação offline', linha.nome, '->', e.message);
    }
  }
  // Quem acabou (stamina, teto) sai do número de online já nesta rodada.
  await Ausentes.atualizar(agora);
  return contagem;
}

let relogio = null;
let rodando = false;
/** Liga a rodada periódica (o servidor chama uma vez, no boot). */
export function ligar() {
  if (relogio) return;
  relogio = setInterval(() => {
    if (rodando) return; // uma rodada lenta não empilha outra por cima
    rodando = true;
    rodada()
      .catch((e) => console.error('consolidação offline ->', e.message))
      .finally(() => {
        rodando = false;
      });
  }, INTERVALO_MS);
  relogio.unref();
}
