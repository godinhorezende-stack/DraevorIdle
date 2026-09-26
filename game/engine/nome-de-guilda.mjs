/* =========================================================================
 * O NOME DE UMA GUILDA — a regra, num lugar só
 *
 * Ela morava dentro do servidor, e isso bastava enquanto quem perguntava era
 * só o servidor. Deixou de bastar quando a tela de criar passou a responder
 * "✓ disponível / ✗ inválido" enquanto se digita: o cliente precisa da MESMA
 * regra, e uma cópia dela no cliente seria uma cópia que um dia diverge.
 *
 * A forma dessa divergência é ruim de um jeito específico: a tela diria "pode"
 * e o servidor recusaria no clique, depois de a pessoa ter montado o brasão
 * inteiro — ou o contrário, a tela diria "não pode" para um nome que o
 * servidor aceitaria, e ninguém descobriria que o nome estava livre.
 *
 * Por isso o arquivo é compartilhado e o servidor REEXPORTA daqui em vez de
 * ter o seu. Quem valida de verdade continua sendo ele; o cliente só adianta
 * a resposta.
 * ========================================================================= */

/**
 * O nome: entre 3 e 24 letras, e só letras, números e espaço.
 *
 * O limite de cima é o da tela (o cartaz da guilda e a linha do membro têm
 * largura), e o de baixo evita nomes de uma letra que ninguém consegue
 * procurar. A peneira de caracteres existe porque o nome vai para o chat, para
 * o ranking e um dia para a tela de castle war — e um nome com quebra de linha
 * ou com caractere invisível estraga as três.
 *
 * Devolve a frase da recusa, ou `null` quando o nome serve.
 */
export function recusaDoNome(nome) {
  const limpo = String(nome ?? '').trim().replace(/\s+/g, ' ');
  if (limpo.length < 3) return 'o nome precisa de pelo menos 3 letras';
  if (limpo.length > 24) return 'o nome passa de 24 letras';
  if (!/^[A-Za-zÀ-ÿ0-9 ]+$/.test(limpo)) return 'o nome só aceita letras, números e espaço';
  return null;
}

/**
 * O nome normalizado, que é o que a coluna `chave` guarda.
 *
 * É ele que decide se dois nomes são o mesmo: "Os Corvos" e "os  corvos" não
 * podem ser duas guildas. Espaços repetidos viram um só, as pontas caem e tudo
 * desce para minúsculo.
 */
export const chaveDoNome = (nome) =>
  String(nome ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** O nome como ele será gravado — o que a tela deve mostrar como "este é o nome". */
export const nomeArrumado = (nome) => String(nome ?? '').trim().replace(/\s+/g, ' ');
