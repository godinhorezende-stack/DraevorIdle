// A RECOMPENSA DAS MISSÕES do PoE (dono, 06/10: "como no PoE" — ao concluir a missão o jogador escolhe UMA gema da lista da classe
// dele, no nível 1). O servidor diz o que está pendente (`character.missoesPoe`: `[{ slug, nome, ato, opcoes: [itemId] }]`) e quem
// entrega é ele (`{t:'gema', action:'recompensaDeMissao', missao, itemId}`, `itens-poe/missoes-de-gemas.mjs`). Aqui: a janela abre
// sozinha UMA vez por missão; fechada sem escolher, fica o botão "Recompensa de missão" no canto para voltar a ela.
import { itemCanvas } from './sprites.mjs';
import { tipFor } from './tooltip.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const abertasNestaSessao = new Set();
let ctx = null;
let botao = null;
let escolhida = null;

/** A cada estado: abre a janela da primeira missão pendente que ainda não abriu; mostra/esconde o botão. */
export function cuidarDasMissoes(context) {
  ctx = context;
  const pendentes = ctx.state.character?.missoesPoe ?? [];
  atualizarBotao(pendentes);
  const nova = pendentes.find((m) => !abertasNestaSessao.has(m.slug));
  if (nova && document.getElementById('modal')?.hidden !== false) abrir(nova);
}

function atualizarBotao(pendentes) {
  if (!pendentes.length) {
    botao?.remove();
    botao = null;
    return;
  }
  if (!botao) {
    botao = el('button', 'missao-poe-botao');
    botao.type = 'button';
    botao.onclick = () => {
      const p = ctx.state.character?.missoesPoe ?? [];
      if (p[0]) abrir(p[0]);
    };
    document.body.append(botao);
  }
  botao.textContent = `🎁 Recompensa de missão${pendentes.length > 1 ? ` (${pendentes.length})` : ''}`;
}

function abrir(missao) {
  abertasNestaSessao.add(missao.slug);
  escolhida = null;
  ctx.openModal(`Recompensa: ${missao.nome}`, (body) => {
    const desenhar = () => {
      body.replaceChildren();
      body.append(el('p', 'shop-note', `Missão concluída (Ato ${missao.ato}). Escolha UMA gema — ela vem no nível 1. As outras a Zuma Magehide vende.`));
      const grade = el('div', 'missao-poe-grade');
      for (const id of missao.opcoes) {
        const meta = ctx.state.items?.[id];
        const card = el('button', `missao-poe-gema${escolhida === id ? ' escolhida' : ''}`);
        card.type = 'button';
        card.append(itemCanvas(id, 40));
        const def = meta?.gemaDef;
        card.append(el('b', null, def?.nomePt ?? def?.nome ?? meta?.name ?? `#${id}`), el('em', null, def?.tipo === 'support' ? 'suporte' : 'gema de skill'));
        tipFor(card, id, null, null, { id, count: 1, gema: { nivel: 1, xp: 0, qualidade: 0 } });
        card.onclick = () => {
          escolhida = id;
          desenhar();
        };
        grade.append(card);
      }
      body.append(grade);
      const acoes = el('div', 'confirm-actions');
      const depois = el('button', 'ghost', 'Escolher depois');
      depois.type = 'button';
      depois.onclick = () => ctx.closeModal();
      const pegar = el('button', 'primary', escolhida ? 'Pegar esta gema' : 'Escolha uma gema');
      pegar.type = 'button';
      pegar.disabled = !escolhida;
      pegar.onclick = () => {
        pegar.disabled = true;
        ctx.send({ t: 'gema', action: 'recompensaDeMissao', missao: missao.slug, itemId: escolhida });
        ctx.closeModal();
      };
      acoes.append(depois, pegar);
      body.append(acoes);
    };
    desenhar();
  });
}
