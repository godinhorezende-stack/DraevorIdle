// O ACESSO na tela da Engine: pergunta ao servidor quem está logado (`auth/quem`) e, se o servidor exige login e não há sessão de administrador,
// leva para a PÁGINA DE LOGIN (`/editor/login`). A barra de cima diz quem entrou e se a gravação está desligada (produção). TODA decisão é do
// servidor (`admin/acesso.mjs`): aqui só se apresenta.
import { el } from './editor-ui.mjs';

const BASE = '/api/mapas/_conteudo/auth/';
export const PAGINA_DE_LOGIN = '/editor/login';
export const enderecoDeLogin = (voltar) => `${PAGINA_DE_LOGIN}?voltar=${encodeURIComponent(voltar)}`;

/** Pinta a barra de cima: quem entrou, "Sair" e o aviso de somente leitura. */
export function pintarBarra(estado, alvo = document.getElementById('eng-acesso')) {
  if (!alvo) return;
  const c = estado.config ?? {};
  document.body.classList.toggle('eng-somente-leitura', c.grava === false);
  alvo.replaceChildren(...[
    c.grava === false ? el('span', { class: 'selo aviso', title: 'Em produção a Engine só lê e opera: para editar, rode localmente, faça commit e publique pelo deploy. ENGINE_GRAVA=1 religa a gravação.' }, 'somente leitura') : null,
    estado.logado ? el('span', { class: 'eng-usuario', title: 'Conta administradora' }, estado.email, el('button', { type: 'button', class: 'fantasma', onclick: async () => { await fetch(`${BASE}sair`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); location.href = PAGINA_DE_LOGIN; } }, 'Sair')) : (c.exigeLogin ? null : el('span', { class: 'dica', title: 'Desenvolvimento: sem login. Em produção o login é obrigatório.' }, 'sem login (dev)')),
  ].filter(Boolean));
}

/**
 * Garante o acesso antes de a Engine carregar. Resolve quando pode seguir (o servidor não exige login ou já há sessão de administrador); senão
 * vai para `/editor/login?voltar=…` e NUNCA resolve (a página é trocada).
 */
export async function garantirAcesso() {
  const estado = await fetch(`${BASE}quem`).then((r) => r.json()).catch(() => ({ logado: false, admin: false, config: { exigeLogin: false, grava: true } }));
  pintarBarra(estado);
  if (estado.config.exigeLogin && !estado.admin) {
    location.replace(enderecoDeLogin(location.pathname + location.search + location.hash));
    return new Promise(() => {});
  }
  return estado;
}
