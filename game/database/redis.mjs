// Cache compartilhado entre processos, para leituras caras que hoje só têm
// um Map em memória por processo (`melhoriasDaConta` em banco.mjs,
// `guildaDe` em systems/guildas.mjs, `topo` em systems/ranking.mjs — ver
// docs/auditoria-performance.md, "Redis só entra quando existir um SEGUNDO
// processo").
//
// Sem `REDIS_URL` no ambiente, todo mundo aqui vira no-op: quem chama nunca
// sabe a diferença, e o comportamento de hoje (só o Map/cache local)
// continua intacto — é assim que os testes e o dev sem Docker continuam
// funcionando sem Redis nenhum no ar.
//
// Mesmo com um processo só, isto já dá valor: sobrevive a reinício (a conta
// não perde o cache das melhorias/guilda/ranking no boot seguinte, evitando
// a consulta fria no Postgres) — e é o primeiro passo de infraestrutura para
// quando existir mais de um processo de jogo.
let clientePromise = null;
/*
 * Quando a conexão falha, NÃO tenta de novo na próxima chamada — isso faria
 * toda leitura de cache (uma por vez: `obter` E `guardar` chamam `cliente()`
 * cada um) esperar um ciclo inteiro de reconexão (segundos) enquanto o Redis
 * estiver fora do ar, o oposto de "gracioso". Em vez disso, guarda o
 * fracasso por um tempo (`COOLDOWN_MS`) e devolve `null` na hora — o cache
 * fica desligado por um tempo, nunca lento.
 */
const COOLDOWN_MS = 30_000;
let semRedisAte = 0;

/** Hits/misses/erros do cache (`obterOuCalcular`, abaixo) — não é métrica de produção, só o suficiente pra ver se está servindo pra algo. */
const estatisticas = { hits: 0, misses: 0, erros: 0 };
export function estatisticasDoCache() {
  return { ...estatisticas };
}

async function conectar() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const { createClient } = await import('redis');
  const cliente = createClient({
    url,
    socket: {
      // Sem isto, o cliente tenta reconectar PARA SEMPRE (padrão da lib) —
      // uma URL errada ou o Redis fora do ar de vez vira um log de erro
      // infinito, sem nunca desistir. Depois de 5 tentativas (~3s de
      // backoff crescente), desiste: as próximas chamadas de cache caem no
      // catch de `obter`/`guardar` (undefined/no-op) até o processo
      // reiniciar — é o mesmo "cai pro banco" de sempre, só que sem gastar
      // CPU tentando de novo pra sempre.
      reconnectStrategy: (tentativas) => (tentativas > 5 ? false : Math.min(tentativas * 200, 1000)),
    },
  });
  // Sem isto, um erro de conexão (Redis fora do ar, rede caiu) vira exceção
  // não tratada e derruba o processo do JOGO por causa de um CACHE — o
  // cache é sempre opcional; quem chama já sabe cair para o banco.
  cliente.on('error', (e) => console.error('redis', e.message));
  await cliente.connect();
  return cliente;
}

function cliente() {
  if (Date.now() < semRedisAte) return Promise.resolve(null);
  clientePromise ??= conectar().catch((e) => {
    console.error('redis: não conectou —', e.message, `(sem cache por ${COOLDOWN_MS / 1000}s)`);
    clientePromise = null;
    semRedisAte = Date.now() + COOLDOWN_MS;
    return null;
  });
  return clientePromise;
}

/** O valor guardado, ou `undefined` se não tem Redis, a chave não existe, OU deu erro — os três casos são "vá calcular de verdade". */
export async function obter(chave) {
  const c = await cliente();
  if (!c) return undefined;
  try {
    const texto = await c.get(chave);
    return texto === null ? undefined : JSON.parse(texto);
  } catch (e) {
    estatisticas.erros++;
    console.error('redis obter', chave, '->', e.message);
    return undefined;
  }
}

/** `segundosDeVida` é a rede de segurança (o dado nunca fica velho pra sempre) — quem grava já chama isto de novo com o valor certo. */
export async function guardar(chave, valor, segundosDeVida) {
  const c = await cliente();
  if (!c) return;
  try {
    await c.set(chave, JSON.stringify(valor), segundosDeVida ? { EX: segundosDeVida } : undefined);
  } catch (e) {
    estatisticas.erros++;
    console.error('redis guardar', chave, '->', e.message);
  }
}

export async function apagar(chave) {
  const c = await cliente();
  if (!c) return;
  try {
    await c.del(chave);
  } catch (e) {
    estatisticas.erros++;
    console.error('redis apagar', chave, '->', e.message);
  }
}

/** Invalidação em bloco (ex.: `guildaDe:*` inteiro) — `SCAN`, não `KEYS`: não trava o Redis num keyspace grande. */
export async function apagarComPrefixo(prefixo) {
  const c = await cliente();
  if (!c) return;
  try {
    for await (const chave of c.scanIterator({ MATCH: `${prefixo}*` })) {
      await c.del(chave);
    }
  } catch (e) {
    estatisticas.erros++;
    console.error('redis apagarComPrefixo', prefixo, '->', e.message);
  }
}

/** Só para os testes fecharem a conexão e o processo sair sozinho. */
export async function fechar() {
  const c = await cliente();
  if (c) await c.quit();
  clientePromise = null;
}

// ---------------------------------------------------------- camada de cache
//
// A partir daqui é a ÚNICA porta de entrada para "cache de leitura cara" do
// jogo — quem quer cachear uma consulta chama só `obterOuCalcular`, nunca
// `obter`/`guardar` direto (essas duas continuam existindo cruas, para o dia
// em que Redis servir outra coisa que não seja cache — sessão, pub/sub).
// Todo cache mora sob o prefixo `cache:`, então dá pra listar/limpar só isto
// (`redis-cli --scan --pattern 'cache:*'`) sem tocar em nada mais que um dia
// exista no mesmo Redis.
const PREFIXO_CACHE = 'cache:';

/**
 * O padrão único: HIT → devolve do Redis. MISS → roda `calcular()` (a
 * consulta real, quase sempre Postgres), grava no Redis com o TTL dado, e só
 * ENTÃO devolve — nunca o contrário. Sem Redis (ou com erro nele), `calcular`
 * roda do mesmo jeito: o cache nunca é o motivo de um dado não aparecer.
 */
export async function obterOuCalcular(chave, ttlSegundos, calcular) {
  const chaveCache = PREFIXO_CACHE + chave;
  const doCache = await obter(chaveCache);
  if (doCache !== undefined) {
    estatisticas.hits++;
    return doCache;
  }
  estatisticas.misses++;
  const valor = await calcular();
  await guardar(chaveCache, valor, ttlSegundos);
  return valor;
}

/** Apaga uma chave de cache específica (ex.: depois de uma escrita no Postgres). */
export async function invalidar(chave) {
  await apagar(PREFIXO_CACHE + chave);
}

/** Atualiza uma chave de cache com o valor que ACABOU de ser confirmado no Postgres — mais barato que invalidar e esperar o próximo miss recalcular. */
export async function atualizar(chave, valor, ttlSegundos) {
  await guardar(PREFIXO_CACHE + chave, valor, ttlSegundos);
}

/** Apaga todo um grupo de cache (ex.: `invalidarPrefixo('guildaDe:')` limpa `cache:guildaDe:*` inteiro). */
export async function invalidarPrefixo(prefixo) {
  await apagarComPrefixo(PREFIXO_CACHE + prefixo);
}
