// O MODO DE MANUTENÇÃO (desligado por padrão): para quando uma manutenção realmente exigir indisponibilidade.
// Não faz parte do Server Save diário e nunca é ligado por ele.
//
// O que faz quando ligado: bloqueia ENTRADAS novas (`play`), com a mensagem abaixo — quem já está jogando segue
// jogando até a hora de `drenar`, que grava todo mundo (`gravarAgora`: a mesma gravação do autosave, que carimba
// `offlineDesde` e portanto MANTÉM a caçada correndo offline) e libera as sessões pelo caminho de sempre
// (`soltarPersonagem`, o mesmo do fechar a aba). Nada aqui toca em caçada, XP, loot ou recompensas.
let ativo = false;
let motivo = 'O servidor está em manutenção. Sua caçada offline continua correndo normalmente; tente de novo em alguns minutos.';

export const bloqueada = () => ativo;
export const mensagemDeBloqueio = () => motivo;
export function definir(ligado, mensagem = null) {
  ativo = !!ligado;
  if (mensagem) motivo = mensagem;
  return ativo;
}

/** Grava e solta todas as sessões. Devolve `{ gravadas, erros }`. Só chamar com a manutenção ligada. */
export async function drenar(sessoes) {
  if (!ativo) throw new Error('drenar: a manutenção não está ligada');
  let gravadas = 0;
  let erros = 0;
  for (const s of [...sessoes.values()]) {
    if (!s?.personagem) continue;
    try {
      await s.gravarAgora();
      await s.soltarPersonagem();
      gravadas++;
    } catch {
      erros++;
    }
  }
  return { gravadas, erros };
}
