// O ACESSO na tela da Engine: pergunta ao servidor quem está logado (`auth/quem`), mostra o login quando o servidor exige e não há sessão de
// administrador, e deixa a barra de cima dizer quem entrou e se a gravação está desligada (produção). TODA decisão é do servidor
// (`admin/acesso.mjs`): aqui só se apresenta. Sem essa tela, o servidor responde 401/403 e a Engine não carrega dados.
import { el } from './editor-ui.mjs';

const BASE = '/api/mapas/_conteudo/auth/';
const post = (rota, corpo = {}) => fetch(BASE + rota, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }).then((r) => r.json());

/** Pinta a barra de cima: quem entrou, "Sair" e o aviso de somente leitura. */
export function pintarBarra(estado, alvo = document.getElementById('eng-acesso')) {
  if (!alvo) return;
  const c = estado.config ?? {};
  document.body.classList.toggle('eng-somente-leitura', c.grava === false);
  alvo.replaceChildren(...[
    c.grava === false ? el('span', { class: 'selo aviso', title: 'Em produção a Engine só lê e opera: para editar, rode localmente, faça commit e publique pelo deploy. ENGINE_GRAVA=1 religa a gravação.' }, 'somente leitura') : null,
    estado.logado ? el('span', { class: 'eng-usuario', title: 'Conta administradora' }, estado.email, el('button', { type: 'button', class: 'fantasma', onclick: async () => { await post('sair'); location.reload(); } }, 'Sair')) : (c.exigeLogin ? null : el('span', { class: 'dica', title: 'Desenvolvimento: sem login. Em produção o login é obrigatório.' }, 'sem login (dev)'))].filter(Boolean));
}

/**
 * Garante o acesso antes de a Engine carregar. Resolve quando pode seguir (servidor não exige login, ou já há sessão de administrador, ou o
 * login deu certo). Enquanto isso, a área de trabalho mostra o formulário.
 */
export async function garantirAcesso({ raiz }) {
  const estado = await fetch(`${BASE}quem`).then((r) => r.json()).catch(() => ({ logado: false, config: { exigeLogin: false, grava: true } }));
  pintarBarra(estado);
  if (!estado.config.exigeLogin || estado.admin) return estado;
  return new Promise((resolver) => {
    const erro = el('div', { class: 'eng-modal-erro', role: 'alert' });
    const email = el('input', { type: 'email', autocomplete: 'username', placeholder: 'conta de administrador', required: true });
    const senha = el('input', { type: 'password', autocomplete: 'current-password', required: true });
    const enviar = el('button', { type: 'submit', class: 'primario' }, 'Entrar');
    const form = el('form', { class: 'eng-login', onsubmit: async (e) => {
      e.preventDefault();
      enviar.disabled = true;
      erro.textContent = '';
      const r = await post('entrar', { email: email.value, senha: senha.value }).catch(() => ({ ok: false, erro: 'Sem resposta do servidor.' }));
      enviar.disabled = false;
      if (!r.ok) { erro.textContent = r.erro ?? 'Não entrou.'; senha.value = ''; senha.focus(); return; }
      pintarBarra(r);
      resolver(r);
    } },
    el('h2', {}, 'Entrar na Engine'),
    el('p', { class: 'dica' }, 'Use a conta do jogo de um administrador. A Engine em produção exige login; sem ele o servidor não entrega nenhum dado.'),
    el('label', { class: 'campo' }, 'E-mail', email), el('label', { class: 'campo' }, 'Senha', senha), erro, enviar);
    raiz().replaceChildren(form);
    email.focus();
  });
}
