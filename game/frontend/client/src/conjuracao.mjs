// A barra de CONJURAÇÃO (gemas de skill com tempo de cast — "conjuração de
// verdade"): o servidor manda `cast` ao começar (`skill`, `ms`), `castFim` ao
// soltar e `castCancel` se o alvo morreu ou saiu do alcance. Só a do próprio
// personagem (`quem`).
let barra = null;
let fim = 0;
let laco = 0;

function criar() {
  barra = document.createElement('div');
  barra.id = 'barra-de-conjuracao';
  barra.hidden = true;
  barra.innerHTML = '<div class="conj-enche"></div><span class="conj-nome"></span>';
  document.body.append(barra);
}

/*
 * Logo ACIMA do painel de baixo (vida, mana e a barra de ações), medido: a barra de ações
 * tem uma ou duas fileiras e muda de altura com a tela, e o `bottom` fixo no css a deixava
 * em cima das barras de vida e mana quando o painel era mais alto.
 */
function posicionar() {
  // O rodapé inteiro (`#actionbar`): as réguas de vida/mana/exp e as fileiras de slots.
  const painel = document.getElementById('actionbar');
  if (!painel || painel.hidden || !painel.getBoundingClientRect().height) return;
  const topo = painel.getBoundingClientRect().top;
  barra.style.bottom = `${Math.max(8, Math.round(window.innerHeight - topo + 8))}px`;
}

function tique() {
  laco = 0;
  if (!barra || barra.hidden) return;
  const resta = fim - performance.now();
  const total = Number(barra.dataset.total) || 1;
  barra.firstChild.style.width = `${Math.min(100, Math.max(0, 100 * (1 - resta / total)))}%`;
  if (resta > -400) laco = requestAnimationFrame(tique);
  else barra.hidden = true;
}

function esconder(classe) {
  if (!barra) return;
  barra.classList.add(classe);
  setTimeout(() => {
    barra.hidden = true;
    barra.classList.remove(classe);
  }, classe === 'cancelada' ? 450 : 120);
}

export function acompanharConjuracao(events, eu) {
  for (const e of events) {
    if (e.t !== 'cast' && e.t !== 'castFim' && e.t !== 'castCancel') continue;
    if (eu && e.quem && e.quem !== eu) continue;
    if (!barra) criar();
    if (e.t === 'cast') {
      posicionar();
      barra.classList.remove('cancelada');
      barra.dataset.total = String(e.ms || 1);
      fim = performance.now() + (e.ms || 0);
      barra.lastChild.textContent = e.skill ?? '';
      barra.hidden = false;
      if (!laco) laco = requestAnimationFrame(tique);
    } else esconder(e.t === 'castCancel' ? 'cancelada' : 'concluida');
  }
}
