// A PÁGINA DE LOGIN da Engine (`/editor/login`): autônoma (não carrega nada da Engine), para funcionar mesmo se a Engine falhar. Entra com a
// conta do jogo de um administrador (`auth/entrar`); o servidor guarda a sessão num cookie e decide tudo. Depois leva de volta ao `voltar`.

const BASE = '/api/mapas/_conteudo/auth/';
const PADRAO = '/editor/conteudo';

/** Só volta para páginas da própria Engine (nunca um endereço externo): começa com `/editor`, sem `//` nem esquema. Pura. */
export function destinoSeguro(voltar) {
  const v = String(voltar ?? '');
  if (!v.startsWith('/editor') || v.startsWith('//') || /[\\\r\n]/.test(v) || v.startsWith('/editor/login')) return PADRAO;
  return v;
}

/** Quebra-laço: se a página de destino manda de volta ao login várias vezes seguidas, para e explica (em vez de girar para sempre). */
function girandoEmLaco(agora = Date.now(), storage = window.sessionStorage) {
  try {
    const marcas = JSON.parse(storage.getItem('engine.voltas') ?? '[]').filter((t) => agora - t < 10_000);
    marcas.push(agora);
    storage.setItem('engine.voltas', JSON.stringify(marcas));
    return marcas.length >= 4;
  } catch {
    return false;
  }
}

async function iniciar() {
  const voltar = destinoSeguro(new URLSearchParams(location.search).get('voltar'));
  const quem = await fetch(`${BASE}quem`).then((r) => r.json()).catch(() => null);
  if (!quem) return void (document.getElementById('aviso').textContent = 'Não consegui falar com o servidor.');
  if (quem.admin || !quem.config.exigeLogin) {
    if (girandoEmLaco()) return void (document.getElementById('aviso').textContent = 'A sessão é válida, mas a página de destino mandou de volta ao login várias vezes. Recarregue com Ctrl+F5; se persistir, avise o desenvolvedor.');
    return void location.replace(voltar);
  }
  const form = document.getElementById('form');
  const erro = document.getElementById('erro');
  const enviar = document.getElementById('enviar');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    enviar.disabled = true;
    erro.textContent = '';
    const r = await fetch(`${BASE}entrar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: document.getElementById('email').value, senha: document.getElementById('senha').value }) })
      .then((x) => x.json()).catch(() => ({ ok: false, erro: 'Sem resposta do servidor.' }));
    enviar.disabled = false;
    if (!r.ok) {
      erro.textContent = r.erro ?? 'Não entrou.';
      document.getElementById('senha').value = '';
      document.getElementById('senha').focus();
      return;
    }
    location.replace(voltar);
  });
}
if (typeof document !== 'undefined') iniciar();
