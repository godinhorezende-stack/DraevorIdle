/*
 * ---- A tela de ENTRADA, do clique até o `welcome` (04/11) ----
 *
 * "Clico no personagem, demora muito e não aparece nada": entre o `play` e o `welcome` o servidor lê o personagem e, quem caçava de aba
 * fechada, simula até 30 minutos dessa caçada tique a tique (numa thread à parte, que na primeira vez ainda carrega os dados do jogo).
 * Agora a mesma tela de entrada que cobre o carregamento do mapa (`#entrada`, a caixa da abertura) aparece já no clique, com a etapa
 * que o servidor manda (`{t:'entrando', etapa, feito?, total?}` — ver `Sessao.avisarEntrada`):
 *
 *   Conectando → Carregando o personagem → Preparando o mundo → Simulando a caçada offline — X de Y min → Entrando no mundo
 *
 * No `welcome` esta parte acaba e a tela segue com o carregamento das imagens (`entrarNoPersonagem`, main.mjs), da barra onde parou.
 * Recusada (`authError`/`error`), a tela mostra o motivo e o botão de voltar; "Cancelar" solta a entrada no servidor (`release` →
 * `cancelarCarregamento`) e volta para a lista, como fechar a aba sempre fez.
 */
const $ = (id) => document.getElementById(id);

// Onde a barra está em cada etapa (a simulação anda de 25% a 85%; as imagens, depois do `welcome`, de 90% a 100%).
const ETAPAS = {
  conectando: { texto: 'Conectando', pct: 5 },
  carregando: { texto: 'Carregando o personagem', pct: 15 },
  preparando: { texto: 'Preparando o mundo', pct: 25 },
  simulando: { texto: 'Simulando a caçada offline', pct: 25 },
  entrando: { texto: 'Entrando no mundo', pct: 90 },
};
const SIMULACAO_DE = 25;
const SIMULACAO_ATE = 85;
/** Onde a barra estava quando o `welcome` chegou (o carregamento das imagens continua dali). */
export const FIM_DA_ENTRADA_NO_SERVIDOR = 90;

let aberta = false;
let aoCancelar = null;

function botoes() {
  let caixa = $('entrada-botoes');
  if (caixa) return caixa;
  caixa = document.createElement('div');
  caixa.id = 'entrada-botoes';
  caixa.className = 'entrada-botoes';
  const cancelar = document.createElement('button');
  cancelar.type = 'button';
  cancelar.id = 'entrada-cancelar';
  cancelar.className = 'ghost';
  cancelar.textContent = 'Cancelar';
  cancelar.onclick = () => {
    const f = aoCancelar;
    fecharEntrada();
    f?.();
  };
  caixa.append(cancelar);
  $('entrada')?.querySelector('.boot-caixa')?.append(caixa);
  return caixa;
}

function pintar(texto, detalhe, pct) {
  $('entrada-passo').textContent = texto;
  $('entrada-detalhe').textContent = detalhe ?? '';
  $('entrada-progresso').style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

/** No clique de entrar: a tela aparece em "Conectando". `cancelar()` é o que o botão faz (manda o `release` e volta para a lista). */
export function abrirEntrada(nome, cancelar) {
  const tela = $('entrada');
  if (!tela) return;
  aberta = true;
  aoCancelar = cancelar ?? null;
  $('entrada-nome').textContent = nome ?? '';
  tela.classList.remove('saindo', 'com-erro');
  const b = botoes();
  b.hidden = false;
  $('entrada-cancelar').textContent = 'Cancelar';
  pintar(ETAPAS.conectando.texto, '', ETAPAS.conectando.pct);
  tela.hidden = false;
}

/** `{t:'entrando', etapa, feito?, total?}` do servidor. */
export function avancarEntrada(m) {
  if (!aberta) return;
  const etapa = ETAPAS[m.etapa];
  if (!etapa) return;
  if (m.etapa === 'simulando' && m.total > 0) {
    const feito = Math.min(m.feito ?? 0, m.total);
    pintar(`${etapa.texto} — ${feito} de ${m.total} min`, '', SIMULACAO_DE + (SIMULACAO_ATE - SIMULACAO_DE) * (feito / m.total));
    return;
  }
  pintar(etapa.texto, '', etapa.pct);
}

/** A entrada do servidor está na tela (do clique até o `welcome`, ou com o erro dela)? */
export const entradaAberta = () => aberta;

/** Chegou o `welcome`: esta parte acaba; a tela continua com as imagens (`entrarNoPersonagem`). */
export function concluirEntrada() {
  if (!aberta) return false;
  aberta = false;
  aoCancelar = null;
  if ($('entrada-botoes')) $('entrada-botoes').hidden = true;
  return true;
}

/** A entrada foi recusada: o motivo fica na tela, e o botão vira "Voltar". */
export function erroNaEntrada(mensagem, voltar) {
  if (!aberta) return;
  $('entrada')?.classList.add('com-erro');
  $('entrada-passo').textContent = 'Não foi possível entrar';
  $('entrada-detalhe').textContent = mensagem ?? '';
  aoCancelar = voltar ?? aoCancelar;
  botoes().hidden = false;
  $('entrada-cancelar').textContent = 'Voltar';
}

/** Some com a tela, sem mexer em mais nada (o `released` e o "Voltar" já trocam a tela por baixo). */
export function fecharEntrada() {
  if (!aberta) return;
  aberta = false;
  aoCancelar = null;
  const tela = $('entrada');
  if (!tela) return;
  tela.hidden = true;
  tela.classList.remove('saindo', 'com-erro');
}
