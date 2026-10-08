// Os personagens ANTIGOS, do Draevor clássico (dono, 07/10: "as contas existentes devem ser preservadas; NÃO migrar personagens antigos
// para o novo sistema PoE — o personagem novo começa no PoE").
//
// O jogo oficial é o do PoE (`itens-poe/catalogo.ligado`). Um personagem criado no Draevor clássico fica ARQUIVADO: a conta o vê na lista
// (com o selo de arquivado), mas ele não entra no jogo, não é convertido, não roda a caçada offline em segundo plano e não conta no limite
// de personagens da conta (para ninguém ter de apagar um antigo para criar o novo). Os dados dele ficam como estão no banco.
//
// Quem é do PoE: o criado no jogo oficial leva `sistema: 'poe'` (`sessao.estadoInicialPersonagem`); os criados antes dessa marca no jogo
// local do PoE são reconhecidos pelo cinto de frascos (`frascos`), que só o PoE dá na criação.
import { ligado } from '../itens-poe/catalogo.mjs';

/** A marca gravada no personagem criado no jogo oficial (PoE). */
export const SISTEMA_DO_POE = 'poe';

/** O personagem é do jogo do PoE? (a marca, ou o cinto de frascos que só o PoE dá na criação) */
export const ehDoPoe = (estado) => estado?.sistema === SISTEMA_DO_POE || Array.isArray(estado?.frascos);

/** O personagem está ARQUIVADO neste processo? (é do Draevor clássico e o jogo é o oficial, do PoE) */
export const arquivado = (estado) => ligado() && !ehDoPoe(estado);

/**
 * A mesma regra de `ehDoPoe` como condição SQL sobre a tabela `personagens` — para as listas que leem o banco direto (ranking do jogo e
 * do site, pódio da arena, totais do site), que no jogo oficial mostram só quem é do PoE (dono, 07/10: "ranking só com personagens do
 * PoE"). No modo clássico não filtra nada.
 */
export const sqlDoPoe = (dialeto) => {
  if (!ligado()) return '1 = 1';
  return dialeto === 'postgres'
    ? "(estado::jsonb ->> 'sistema' = 'poe' OR jsonb_typeof(estado::jsonb -> 'frascos') = 'array')"
    : "(json_extract(estado, '$.sistema') = 'poe' OR json_type(estado, '$.frascos') = 'array')";
};

/** A frase que a tela mostra para o personagem arquivado. */
export const MENSAGEM_DO_ARQUIVADO = 'Este personagem é do Draevor clássico e foi arquivado: ele continua guardado na sua conta, mas não entra no novo Draevor. Crie um novo personagem para jogar.';
