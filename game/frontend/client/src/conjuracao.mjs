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
      barra.classList.remove('cancelada');
      barra.dataset.total = String(e.ms || 1);
      fim = performance.now() + (e.ms || 0);
      barra.lastChild.textContent = e.skill ?? '';
      barra.hidden = false;
      if (!laco) laco = requestAnimationFrame(tique);
    } else esconder(e.t === 'castCancel' ? 'cancelada' : 'concluida');
  }
}
