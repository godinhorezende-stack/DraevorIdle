// JSON de mensagens que carregam os objetos GIGANTES e fixos do jogo.
//
// O `hello` leva o catálogo (2,3 MB), o `welcome` os itens (1 MB) e o mapa da
// cidade (2,7 MB) — os mesmos para todo mundo, e nunca mudam com o servidor
// rodando. Transformar isso em texto a cada conexão era a maior parte do
// `enviar` no teste de carga (tools/carga.mjs, 30 jogadores: 3 s de CPU em 12 s).
// Aqui cada um vira texto UMA vez; a mensagem é montada em volta dele.

const grandes = new Map(); // objeto → o texto dele (feito na primeira vez que precisa)
const MARCA = '__RAVOX_PEDACO_GRANDE_';

/** Registra objetos fixos que podem ir inteiros numa mensagem. */
export function registrarGrandes(...objetos) {
  for (const o of objetos) if (o && typeof o === 'object' && !grandes.has(o)) grandes.set(o, null);
}

const textoDe = (o) => {
  let t = grandes.get(o);
  if (t == null) {
    t = JSON.stringify(o);
    grandes.set(o, t);
  }
  return t;
};

/**
 * O mesmo que `JSON.stringify(msg)`, mas os objetos registrados entram pelo
 * texto já pronto. Só vale a pena para mensagem que carrega um deles.
 */
export function jsonComGrandes(msg) {
  const achados = [];
  const s = JSON.stringify(msg, (_chave, valor) => {
    if (valor && typeof valor === 'object' && grandes.has(valor)) {
      achados.push(valor);
      return `${MARCA}${achados.length - 1}`;
    }
    return valor;
  });
  if (!achados.length) return s;
  return s.replace(new RegExp(`"${MARCA}(\\d+)"`, 'g'), (_, i) => textoDe(achados[Number(i)]));
}
