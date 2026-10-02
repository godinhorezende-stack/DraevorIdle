// Os encontros de ONDAS: `sobrevivencia` (ondas sucessivas, dificuldade crescente, recompensa por desempenho) e `fenda` (o mesmo,
// com limite de tempo — "uma passagem que se abre e se fecha"). O motor é `ondas.mjs`.
//
// Idle: é uma luta (`idle: 'combate'`) — na Caça Automática o idle ativa o encontro e o combate de sempre vence as ondas; o
// encontro em andamento segura o CLEAR da fase até acabar (por vitória ou pelo tempo da fenda). A "passagem" que a fenda abre é o
// que os outros encontros já sabem fazer: um encontro com `condicao: apos-encontro` da fenda fica disponível quando ela é vencida.
import { registrarTipo } from './tipos.mjs';
import * as Recompensas from './recompensas.mjs';
import { avisarSala } from './sala.mjs';
import { iniciar, avancar, validar as validarOndas } from './ondas.mjs';

function definicao(tipo) {
  return {
    idle: 'combate',
    validar(e) {
      const erros = validarOndas(tipo, e);
      // A recompensa é opcional (uma onda pode valer só pelo desafio), mas se existe tem de ser válida.
      if (e.recompensa) erros.push(...Recompensas.validar(e.recompensa, 'recompensa'));
      return erros;
    },
    podeAtivar: () => ({ ok: true }),
    aoAtivar(ctx) {
      if (ctx.estado && ctx.personagem?.nome) avisarSala(ctx.hunt, ctx.estado, `${ctx.personagem.nome} iniciou: ${ctx.encontro.nome}.`);
      iniciar(ctx, ctx.encontro);
    },
    // Cada tique da instância (com o encontro ativo): tempo, onda vencida, próxima onda.
    verificar: (ctx) => avancar(ctx, ctx.encontro),
  };
}

registrarTipo('sobrevivencia', definicao('sobrevivencia'));
registrarTipo('fenda', definicao('fenda'));
