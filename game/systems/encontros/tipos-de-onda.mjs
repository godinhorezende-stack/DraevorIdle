// Os encontros de ONDAS: `sobrevivencia` (ondas sucessivas, dificuldade crescente, recompensa por desempenho) e `fenda` (o mesmo,
// com limite de tempo — "uma passagem que se abre e se fecha"). O motor é `ondas.mjs`.
//
// Idle: é uma luta (`idle: 'combate'`) — na Caça Automática o idle ativa o encontro e o combate de sempre vence as ondas; o
// encontro em andamento segura o CLEAR da fase até acabar (por vitória ou pelo tempo da fenda). A "passagem" que a fenda abre é o
// que os outros encontros já sabem fazer: um encontro com `condicao: apos-encontro` da fenda fica disponível quando ela é vencida.
import { registrarTipo } from './tipos.mjs';
import * as Recompensas from './recompensas.mjs';
import { avisarSala, bichosDaSala } from './sala.mjs';
import * as Estado from './estado.mjs';
import { iniciar, avancar, limparSobras, aviso, validar as validarOndas } from './ondas.mjs';

// ESCOLTA: as ondas são as EMBOSCADAS e há um `protegido` com uma reserva de vida (`vida`, padrão 100): cada emboscador vivo a
// desgasta (`desgastePorSegundo`, padrão 1,5, por monstro). Zerou, a escolta falha (o que as ondas vencidas pagaram fica). Vencer
// todas as ondas leva o protegido ao destino. É decisão do LÍDER (`decisaoDoLider`, idle 'escolha'): só opcional.
const desgaste = (e) => Number(e.protegido?.desgastePorSegundo ?? 1.5);
const vidaMax = (e) => Number(e.protegido?.vida ?? 100);

function validarProtegido(e) {
  const erros = [];
  const p = e.protegido;
  if (!p || typeof p.nome !== 'string' || !p.nome) return ['a escolta precisa de "protegido" com "nome".'];
  if (p.vida != null && !(Number(p.vida) >= 10 && Number(p.vida) <= 1000)) erros.push('protegido.vida de 10 a 1000.');
  if (p.desgastePorSegundo != null && !(Number(p.desgastePorSegundo) >= 0.1 && Number(p.desgastePorSegundo) <= 20)) erros.push('protegido.desgastePorSegundo de 0,1 a 20.');
  if (e.x == null) erros.push('a escolta precisa de posição (x/y): é onde o líder decide partir.');
  if (e.descricao != null && typeof e.descricao !== 'string') erros.push('descricao precisa ser texto.');
  return erros;
}

function desgastar(ctx, e) {
  const { hunt, instancia, agora } = ctx;
  const esc = (e.escolta ??= { vida: vidaMax(e), ultimoEm: agora });
  const dt = Math.min(5, Math.max(0, (agora - (esc.ultimoEm ?? agora)) / 1000));
  esc.ultimoEm = agora;
  const atacando = bichosDaSala(hunt).filter((m) => m.hp > 0 && m.encontro === e.id && m.onda).length;
  const antes = esc.vida;
  esc.vida = Math.max(0, esc.vida - atacando * desgaste(e) * dt);
  const pct = (v) => Math.floor((v / vidaMax(e)) * 4); // quartos de vida: avisa a cada um que se perde
  if (esc.vida > 0 && pct(esc.vida) < pct(antes)) aviso(hunt, e, `${e.protegido.nome} está ferido (${Math.round((esc.vida / vidaMax(e)) * 100)}%)!`, '#ffb04a');
  if (esc.vida <= 0) {
    limparSobras(hunt, e);
    aviso(hunt, e, `${e.protegido.nome} caiu. A escolta falhou.`, '#ff4a4a');
    Estado.falhar(instancia, e.id, { agora });
    return true;
  }
  return false;
}

function definicao(tipo) {
  const escolta = tipo === 'escolta';
  return {
    idle: escolta ? 'escolha' : 'combate',
    ...(escolta ? { decisaoDoLider: true } : {}),
    validar(e) {
      const erros = validarOndas(tipo, e);
      if (escolta) erros.push(...validarProtegido(e));
      // A recompensa é opcional (uma onda pode valer só pelo desafio), mas se existe tem de ser válida.
      if (e.recompensa) erros.push(...Recompensas.validar(e.recompensa, 'recompensa'));
      return erros;
    },
    podeAtivar: () => ({ ok: true }),
    aoAtivar(ctx) {
      if (ctx.estado && ctx.personagem?.nome) avisarSala(ctx.hunt, ctx.estado, `${ctx.personagem.nome} iniciou: ${ctx.encontro.nome}.`);
      if (escolta) ctx.encontro.escolta = { vida: vidaMax(ctx.encontro), ultimoEm: ctx.agora };
      iniciar(ctx, ctx.encontro);
    },
    // Cada tique da instância (com o encontro ativo): tempo, onda vencida, próxima onda (e, na escolta, o desgaste do protegido).
    verificar(ctx) {
      if (escolta && ctx.hunt && ctx.encontro.onda && desgastar(ctx, ctx.encontro)) return;
      avancar(ctx, ctx.encontro);
    },
  };
}

registrarTipo('sobrevivencia', definicao('sobrevivencia'));
registrarTipo('fenda', definicao('fenda'));
registrarTipo('escolta', definicao('escolta'));
