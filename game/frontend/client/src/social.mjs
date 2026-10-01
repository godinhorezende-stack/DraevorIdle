/*
 * O que se faz com OUTRA pessoa: o menu do botão direito, a troca de itens e a
 * caixa de "quantos?".
 *
 * ---- Por que um módulo só ----
 *
 * As três coisas são a mesma conversa vista de ângulos diferentes. O menu é
 * onde ela começa (mensagem, amizade, party, troca); a troca é a única delas
 * que precisa de uma tela própria; e a caixa de quantidade é usada pelas duas
 * (quanto oferecer, quanto separar de uma pilha) — e também pelo inventário,
 * que é de onde ela veio.
 *
 * Nada aqui fala com o servidor por conta própria: tudo passa pelo `ctx.send`
 * que o `main.mjs` entrega, como no resto do cliente.
 */
import { itemCanvas, outfitCanvas } from './sprites.mjs';
import { openMenu, closeMenu } from './inventory.mjs';
import { brasaoDe, abrirGuildasNaTabela } from './guildas.mjs';
import { vestirNomeDaGuilda } from '/packages/shared/src/desenhar-brasao.mjs';
import { tipTexto, tipFor, classeDaRaridade } from './tooltip.mjs';
import { fecharAoClicarFora, atalhosDaCaixa } from './windows.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

let ctx = null; // { state, send, notice, openModal, closeModal, redraw }

export function initSocial(context) {
  ctx = context;
}

// ---------------------------------------------------------------- quantidade

/*
 * ---- "Quantos?" ----
 *
 * É a caixa do client: uma régua para arrastar, um campo para digitar e o OK.
 * Vale para separar uma pilha na mochila e para pôr uma quantidade na oferta
 * de troca — as duas perguntas são a mesma, e por isso a caixa é uma só.
 *
 * A régua e o campo são o MESMO número visto de dois jeitos: arrastar escreve
 * no campo, digitar move a régua. Quem tem pressa arrasta; quem sabe o número
 * digita, e o Enter confirma sem tirar a mão do teclado.
 */
/*
 * ---- A régua, o campo e os atalhos, sozinhos ----
 *
 * Isto era o miolo de `pedirQuantidade` e agora sai de dentro dela, porque a
 * caixa de DESTRUIR precisa da mesma régua sem ser a mesma caixa: lá a pergunta
 * não é "quantos?", é "tem certeza?", e ela tem o aviso em vermelho, o "não
 * perguntar novamente" e o botão de perigo. Duplicar a régua deixaria dois
 * lugares para consertar quando um deles estiver errado.
 *
 * Devolve o pedaço de tela e um `ler()` — quem chama decide o que fazer com o
 * número, e quando.
 *
 * `aoMudar` existe para quem precisa acompanhar o valor enquanto ele muda: a
 * caixa de destruir reescreve "3x piercing bolt" a cada arrastada da régua, para
 * o texto nunca contradizer o botão logo abaixo dele.
 */
export function controleDeQuantidade({ id, max, valor = null, aoMudar = null }) {
  const teto = Math.max(1, Math.floor(max));

  const regua = document.createElement('input');
  regua.type = 'range';
  regua.className = 'quantia-regua';
  regua.min = '1';
  regua.max = String(teto);
  regua.step = '1';
  regua.setAttribute('aria-label', 'quantidade');

  const campo = document.createElement('input');
  campo.type = 'number';
  campo.className = 'quantia-campo';
  campo.min = '1';
  campo.max = String(teto);
  campo.step = '1';

  const escrever = (n) => {
    const limpo = Math.min(teto, Math.max(1, Math.floor(Number(n) || 1)));
    regua.value = String(limpo);
    campo.value = String(limpo);
    aoMudar?.(limpo);
    return limpo;
  };

  regua.oninput = () => escrever(regua.value);
  campo.oninput = () => {
    const limpo = Math.min(teto, Math.max(1, Math.floor(Number(campo.value) || 1)));
    regua.value = String(limpo);
    aoMudar?.(limpo);
  };

  const linha = el('div', 'quantia-linha');
  linha.append(regua, campo, el('em', 'quantia-teto', `de ${teto}`));

  // Os três saltos que se usa de verdade. Digitar 1 é fácil; digitar "metade
  // de 137" não é.
  const atalhos = el('div', 'quantia-atalhos');
  for (const [rotulo, quanto] of [['1', 1], ['Metade', Math.max(1, Math.floor(teto / 2))], ['Tudo', teto]]) {
    const botao = el('button', 'ghost', rotulo);
    botao.type = 'button';
    botao.onclick = () => escrever(quanto);
    atalhos.append(botao);
  }

  const node = el('div', 'quantia-controle');
  node.append(linha, atalhos);

  escrever(valor ?? teto);
  return { node, campo, teto, ler: () => escrever(campo.value), escrever };
}

export function pedirQuantidade({ id, max, titulo = 'Quantos?', valor = null, aoConfirmar }) {
  const teto = Math.max(1, Math.floor(max));
  // Com um só não há o que perguntar: a caixa seria um clique a mais para nada.
  if (teto <= 1) return void aoConfirmar(1);

  const back = el('div', 'confirm-back');
  const box = el('div', 'confirm-box quantia-box');
  box.append(el('h3', null, titulo));

  const topo = el('div', 'quantia-topo');
  if (id) topo.append(itemCanvas(id, 40));
  const nome = ctx.state.items?.[id]?.name;
  if (nome) topo.append(el('b', null, nome));
  box.append(topo);

  const quantia = controleDeQuantidade({ id, max: teto, valor });
  const campo = quantia.campo;
  box.append(quantia.node);

  const fechar = () => back.remove();
  const confirmar = () => {
    const quantos = quantia.ler();
    fechar();
    aoConfirmar(quantos);
  };

  const acoes = el('div', 'confirm-actions');
  const cancelar = el('button', 'ghost', 'Cancelar');
  cancelar.onclick = fechar;
  const ok = el('button', 'primary', 'OK');
  ok.onclick = confirmar;
  acoes.append(cancelar, ok);
  box.append(acoes);

  // Enter confirma, Escape cancela — nos dois campos e na caixa inteira.
  atalhosDaCaixa(back, { confirmar, fechar });

  back.append(box);
  fecharAoClicarFora(back, fechar);
  document.body.append(back);
  campo.focus();
  campo.select();
}

// ------------------------------------------------------------ menu de gente

/*
 * ---- Copiar o nome de alguém ----
 *
 * O pedido do dono: conseguir copiar o nome de quem falou no chat ou de quem
 * ele clicou na cidade, pelo mesmo menu que já tem "Convidar para a party".
 *
 * Nome de personagem neste jogo tem espaço e acento ("Waipaladin", "Gestos
 * Teste"), e é o que se digita para mandar privado, para procurar no ranking e
 * para falar dele com outra pessoa. Selecionar com o mouse não dá: o nome no
 * chat é um botão, e no mapa é pixel desenhado num canvas.
 *
 * ---- Dois caminhos, e o segundo não é enfeite ----
 *
 * `navigator.clipboard` é o certo, mas ele só existe em contexto seguro (https
 * ou localhost) e pode ser recusado pelo navegador. O `<textarea>` escondido
 * com `execCommand` é o caminho antigo, e funciona onde o primeiro não vai —
 * sem ele, num http qualquer o clique não faria nada e não diria nada.
 *
 * O aviso confirma que copiou. Copiar é uma ação sem efeito visível nenhum: sem
 * a confirmação, a pessoa clica de novo achando que falhou.
 */
export function copiarNome(nome) {
  const texto = String(nome ?? '').trim();
  if (!texto) return;

  const avisar = (ok) => ctx.notice?.(ok ? `Nome copiado: ${texto}` : 'não consegui copiar o nome');

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(texto).then(
      () => avisar(true),
      // Recusado (permissão, aba sem foco): cai para o caminho antigo.
      () => avisar(copiarNaMarra(texto))
    );
    return;
  }
  avisar(copiarNaMarra(texto));
}

/** O jeito antigo: um campo fora da vista, selecionado e copiado. */
function copiarNaMarra(texto) {
  try {
    const campo = document.createElement('textarea');
    campo.value = texto;
    // Fora da vista, mas DENTRO da página: o que não está no documento não
    // pode ser selecionado, e o que está escondido com `display:none` também não.
    campo.style.position = 'fixed';
    campo.style.top = '-1000px';
    campo.setAttribute('readonly', '');
    document.body.append(campo);
    campo.select();
    const deu = document.execCommand('copy');
    campo.remove();
    return deu;
  } catch {
    return false;
  }
}

/** A linha de menu, igual nos dois lugares que mostram alguém. */
const linhaDeCopiar = (nome) => ({
  label: 'Copiar o nome',
  action: () => copiarNome(nome),
});

/**
 * O menu do botão direito em cima de OUTRA pessoa.
 *
 * As quatro coisas que se faz com alguém, na ordem em que se costuma fazê-las:
 * falar, virar amigo, caçar junto, trocar. Cada uma diz por que não dá, quando
 * não dá — um item apagado sem explicação é pior do que item nenhum.
 */
/*
 * ---- A caixa de castigo ----
 *
 * O dono: "ter a opção de mute, ban, ban ip, e escolher o tempo em dias horas ou
 * minutos e botão de confirmar".
 *
 * ---- Por que ela MONTA UM COMANDO em vez de mandar um recado próprio ----
 *
 * Porque as regras já existem, e elas são de quem pune, não de quem clica: o
 * nível exigido, o prazo que se recusa a ler, o registro no painel, o aviso para
 * a pessoa castigada, o ban que derruba quem está online. Tudo isso mora no
 * `/ban` do servidor.
 *
 * Um canal novo para o menu seria uma segunda implementação das mesmas regras —
 * e a segunda é sempre a que fica para trás. Assim, o menu é um jeito mais
 * confortável de escrever o comando, e não um caminho paralelo.
 *
 * ---- E por que a confirmação é uma CAIXA, e não um clique no menu ----
 *
 * Um item de menu que banisse no clique baniria por engano no dia em que o god
 * errasse a linha. O prazo tem de ser escolhido de qualquer jeito, então a caixa
 * não custa um passo a mais — ela é o passo que já era necessário.
 */
const UNIDADES = [
  { id: 'm', nome: 'minuto(s)' },
  { id: 'h', nome: 'hora(s)' },
  { id: 'd', nome: 'dia(s)' },
];

const CASTIGOS = {
  mute: { titulo: 'Calar', comando: 'mute', o_que: 'não vai poder falar no chat, e continua jogando.' },
  ban: { titulo: 'Banir', comando: 'ban', o_que: 'a CONTA inteira sai do jogo, e quem estiver online cai na hora.' },
  ban_ip: {
    titulo: 'Banir o IP',
    comando: 'banip',
    o_que: 'nenhuma conta entra desse endereço. Precisa da pessoa ONLINE — o endereço sai da conexão de agora.',
  },
};

export function abrirCastigo(nome, tipo) {
  const { send, openModal, closeModal } = ctx;
  const castigo = CASTIGOS[tipo];
  if (!castigo) return;

  openModal(`${castigo.titulo} ${nome}`, (body) => {
    body.append(el('p', 'shop-note', castigo.o_que));

    const linha = el('div', 'castigo-tempo');
    const quanto = document.createElement('input');
    quanto.type = 'number';
    quanto.min = '1';
    quanto.step = '1';
    quanto.value = '30';
    const unidade = document.createElement('select');
    for (const u of UNIDADES) {
      const op = document.createElement('option');
      op.value = u.id;
      op.textContent = u.nome;
      unidade.append(op);
    }
    /*
     * O permanente é uma CAIXINHA, e não uma quarta unidade na lista.
     *
     * Numa lista ele seria escolhido por engano com um rolar do dedo — e é o
     * único da lista que não tem volta sozinho. Marcado à parte, ele é uma
     * decisão, e ainda apaga o número para deixar claro que o prazo não vale.
     */
    const semFim = el('label', 'castigo-perm');
    const marca = document.createElement('input');
    marca.type = 'checkbox';
    marca.onchange = () => {
      quanto.disabled = marca.checked;
      unidade.disabled = marca.checked;
    };
    semFim.append(marca, el('span', null, 'permanente'));
    linha.append(el('span', 'castigo-rotulo', 'Por'), quanto, unidade, semFim);
    body.append(linha);

    const motivo = document.createElement('input');
    motivo.type = 'text';
    motivo.maxLength = 120;
    motivo.placeholder = 'motivo (aparece para a pessoa)';
    motivo.className = 'castigo-motivo';
    body.append(motivo);

    const acoes = el('div', 'confirm-actions');
    const cancelar = el('button', 'ghost', 'Cancelar');
    cancelar.onclick = () => closeModal();
    const confirmar = el('button', tipo === 'mute' ? 'primary' : 'danger', castigo.titulo);
    confirmar.onclick = () => {
      const prazo = marca.checked ? 'perm' : `${Math.max(1, Math.round(Number(quanto.value) || 0))}${unidade.value}`;
      /*
       * O comando vai pelo chat, que é por onde os comandos de god entram — ver
       * `tentarComando`, no servidor. O motivo vai solto no fim porque é assim
       * que o comando o lê, e um motivo com espaços continua inteiro.
       */
      const razao = motivo.value.trim().replace(/\s+/g, ' ');
      send({ t: 'chat', text: `/${castigo.comando} ${nome} ${prazo}${razao ? ' ' + razao : ''}` });
      closeModal();
    };
    acoes.append(cancelar, confirmar);
    body.append(acoes);
  });
}

/*
 * ---- A PATENTE DE QUEM ESTA NA TELA ----
 *
 * O retrato da cidade carrega um numero (`arenaPontos`) e o catalogo carrega a
 * escada (`patentesDeArena`), mandada uma vez no login. O cruzamento e aqui.
 *
 * E' assim e nao com a patente pronta no retrato porque o retrato viaja seis
 * vezes por segundo com todo mundo que esta na praca: um nome e uma cor por
 * pessoa por quadro e o tipo de peso que ninguem ve somando — a mesma conta que
 * fez os buffs da party viajarem em segundos inteiros em vez de milissegundos.
 *
 * Sem o catalogo (sessao velha, resposta que ainda nao chegou) devolve `null` e
 * o menu simplesmente nao mostra patente nenhuma.
 */
/* =========================================================================
 * A GUILDA DE QUEM SE CLICOU — a linha e o brasão
 *
 * "faz o que te pedi de mostrar a guilda e o emblema da guilda quando eu clicar
 *  em alguém na cidade ou pelo chat."
 *
 * As duas telas de clicar num nome (o menu do botão direito no mapa e a ficha
 * que o chat pede ao servidor) passam pelas mesmas duas funções daqui, e por
 * isso mostram a mesma coisa do mesmo jeito. Elas devolvem `null` para quem não
 * tem guilda — e aí a linha simplesmente não nasce, em vez de dizer "sem
 * guilda", que é uma frase para ocupar espaço.
 *
 * O brasão é o MESMO da janela de guildas (`brasaoDe`): ele sai do hash do nome,
 * então o escudo que se vê aqui é o escudo que se vê lá dentro.
 *
 * ---- O NOME DEIXOU DE BASTAR ----
 *
 * Enquanto o escudo saía de um hash do nome, nenhum dado de desenho precisava
 * viajar: o cliente derivava tudo sozinho. Com o brasão escolhido pelo líder
 * isso acabou — duas guildas com o mesmo nome de letras não existem, mas o nome
 * não diz mais qual é a forma, o símbolo nem a cor.
 *
 * O brasão vem dentro da própria etiqueta (`etiquetaDeGuilda`, no servidor), que
 * já viajava e já era memoizada por nome. O caminho de string continua valendo,
 * e cai no padrão do nome — é o que mantém de pé quem chama isto com um nome
 * solto.
 * ========================================================================= */
/*
 * ---- DE ONDE SAI O DESENHO, nos dois caminhos ----
 *
 * O chat manda a etiqueta INTEIRA (nome, posto e brasão) — ela vem de uma
 * pergunta ao servidor, uma vez, e traz tudo.
 *
 * A cidade manda só o NOME no retrato, porque o retrato viaja seis vezes por
 * segundo por pessoa e o brasão é da GUILDA: repeti-lo por membro seria mandar
 * trinta cópias do mesmo escudo. Ele viaja uma vez, no `brasoes` do mesmo
 * pacote, e é aqui que os dois se encontram.
 *
 * Sem o catálogo (um pacote antigo, ou uma guilda que entrou na praça entre um
 * quadro e outro) volta `null`, e `brasaoDe` desenha o padrão do nome. Um
 * escudo com a cor de antes é melhor do que um buraco.
 */
function brasaoDaEtiqueta(guilda) {
  if (guilda && typeof guilda === 'object' && guilda.brasao) return guilda.brasao;
  const nome = typeof guilda === 'string' ? guilda : guilda?.nome;
  return nome ? (ctx.state?.city?.brasoes?.[nome] ?? null) : null;
}

/* =========================================================================
 * O BLOCO DA GUILDA NO MENU DO JOGADOR
 *
 * "hoje o nome da guilda aparece solto embaixo do level e o brasão fica sozinho no
 *  canto direito, então não dá para saber que aquilo é guilda."
 *
 * ---- O DEFEITO, E O QUE ELE ERA ----
 *
 * Eram duas metades da mesma informação em lados opostos do cabeçalho: o NOME como
 * terceira linha do texto, logo abaixo de "level 300" e com a mesma cara que ele; e
 * o ESCUDO na ponta direita, sem nada escrito ao lado. Nenhuma das duas dizia
 * "guilda" — uma parecia um segundo subtítulo do personagem, a outra um enfeite.
 *
 * ---- O QUE ELE E' AGORA ----
 *
 * Um bloco próprio, embaixo do cabeçalho e separado dele por um divisor fino, em
 * duas linhas:
 *
 *   "Guilda:"  o rótulo. É a palavra que faltava, e é ela que faz o resto do
 *              bloco ser lido como guilda em vez de como personagem.
 *   o nome     na FONTE DA GUILDA (ver `vestirNomeDaGuilda`), com "›" no fim —
 *              a seta é o que promete que aquilo abre alguma coisa.
 *   o escudo   ~28px, e em modo ícone quando o desenho pedir (ver `LIMITE_DO_ICONE`).
 *   o cargo    "Líder", "Vice" ou "Membro", na cor do posto do site.
 *
 * O bloco INTEIRO é um botão: o alvo de clique passa de um nome de oito letras para
 * uma caixa de duas linhas, e num menu que abre com o botão direito num personagem
 * em movimento isso é a diferença entre abrir a guilda e fechar o menu sem querer.
 *
 * ---- O CARGO NEM SEMPRE VEM ----
 *
 * O caminho do CHAT pergunta ao servidor e recebe a etiqueta inteira (nome, cargo,
 * posto e brasão). O da CIDADE recebe só o nome, porque o retrato viaja seis vezes
 * por segundo por pessoa e o cargo mudaria de dono a cada promoção — ver
 * `citySnapshot`. Sem cargo, a segunda linha fica só com o escudo: é uma linha a
 * menos de texto, e não um "Membro" inventado que pode estar errado.
 * ========================================================================= */

/* O rótulo curto do cargo, e a classe de cor — as mesmas do site (`.guilda-posto`). */
const CARGO_CURTO = { 3: 'Líder', 2: 'Vice', 1: 'Membro' };

function blocoDaGuilda(guilda) {
  const nome = typeof guilda === 'string' ? guilda : guilda?.nome;
  if (!nome) return null;
  /* O posto e o cargo só existem no caminho do chat — ver a nota acima. */
  const cargo = typeof guilda === 'object' ? Number(guilda?.cargo) || 0 : 0;
  const brasao = brasaoDaEtiqueta(guilda);

  const bloco = el('button', 'menu-guilda-bloco');
  bloco.type = 'button';

  const topo = el('span', 'menu-guilda-topo');
  topo.append(el('i', 'menu-guilda-rotulo', 'Guilda:'));
  /*
   * ---- O ESCUDO A ESQUERDA DO NOME, e nao embaixo dele ----
   *
   * "o icone da guilda, la' onde mostra clicando no char ou no chat: em vez de ser
   *  embaixo do nome da guild, coloca a' esquerda do nome da guild."
   *
   * Ele nasceu numa segunda linha, abaixo do nome, e aquela linha tinha so' ele e o
   * cargo — um escudo de 28 pixels ao lado de uma palavra de cinco letras, com meio
   * bloco de espaco vazio a' direita. Ao lado do nome ele vira o marcador da linha:
   * o olho encontra o escudo e o nome na mesma passada, e a altura que a segunda
   * linha gastava volta para o menu.
   *
   * 24 e nao 28: aqui ele divide a linha com o rotulo e com o nome, e tem de caber na
   * altura deles sem empurrar a linha. Continua bem acima do corte do modo icone (20),
   * entao sai com o desenho CHEIO — simbolo, iniciais e o efeito que a guilda pagou.
   * Quem decide isso e' o desenhista, pelo tamanho; esta tela nao repete a regra. Ver
   * `LIMITE_DO_ICONE`.
   */
  topo.append(brasaoDe(nome, 24, brasao));
  /*
   * A fonte da guilda E o corte com reticências, num gesto só — a Decorativa e a
   * Pesada tem larguras bem diferentes, e o menu tem uma largura fixa.
   */
  topo.append(vestirNomeDaGuilda(el('b', 'menu-guilda-nome', nome), brasao));
  /* A seta é decoração: quem lê com leitor de tela já ouve o `aria-label` do botão. */
  const seta = el('span', 'menu-guilda-seta', '\u203a');
  seta.setAttribute('aria-hidden', 'true');
  topo.append(seta);
  bloco.append(topo);

  /*
   * A segunda linha e' so' o cargo agora, e ela so' NASCE quando ele e' conhecido —
   * ver a nota do cabecalho sobre o caminho da cidade. Sem cargo, o bloco tem uma
   * linha e mais nada: uma linha vazia reservada para um dado que nao vem e' o que
   * faz um menu parecer quebrado.
   */
  if (cargo) {
    const baixo = el('span', 'menu-guilda-baixo');
    baixo.append(el('i', `menu-guilda-cargo cargo-${cargo}`, CARGO_CURTO[cargo] ?? 'Membro'));
    bloco.append(baixo);
  }

  bloco.setAttribute('aria-label', `Abrir a guilda ${nome}`);
  tipTexto(bloco, `Abrir a guilda ${nome} na janela de guildas.`);
  bloco.onclick = (e) => {
    /*
     * O menu se fecha ao clicar fora, e este botão está DENTRO dele — sem parar a
     * propagação, o mesmo clique abriria a janela e o fechamento do menu chegaria
     * depois, roubando o foco do que acabou de abrir.
     */
    e?.stopPropagation?.();
    closeMenu();
    abrirGuildasNaTabela(nome);
  };
  return bloco;
}

function patenteDosPontos(pontos) {
  const escada = ctx.state.catalog?.patentesDeArena;
  if (!escada?.length) return null;
  const quantos = Number(pontos) || 0;
  for (let i = escada.length - 1; i >= 0; i--) if (quantos >= escada[i].pontos) return escada[i];
  return escada[0];
}

export function menuDeJogador(evento, nome) {
  const { state, send } = ctx;
  if (!nome || nome === state.character?.name) return;

  const amigos = state.friends?.amigos ?? [];
  const jaEhAmigo = amigos.some((amigo) => amigo.name === nome);
  const euCaçando = !!state.hunt;
  const souLider = euCaçando && !state.hunt?.convidadoPor;

  /* A party é outra lista, e outro convite. Ver a opção mais abaixo. */
  const minhaParty = state.character?.party ?? null;
  const temParty = !!minhaParty;
  const souLiderDaParty = !!minhaParty?.souLider;
  const naMinhaParty = (minhaParty?.membros ?? []).some((membro) => membro.name === nome);

  // Quem está online e em que level: o retrato do menu vem do que a tela já
  // sabe da pessoa, e não de uma consulta nova.
  const naTela =
    (state.city?.players ?? []).find((outro) => outro.name === nome) ??
    (state.hunt?.aliados ?? []).find((outro) => outro.name === nome) ??
    null;

  /*
   * A patente entra no subtitulo, ao lado do level — o mesmo lugar em que a
   * ficha do chat a poe (ver `mostrarPerfil`). Duas telas que mostram o elo da
   * mesma pessoa nao podem mostra-lo em lugares diferentes.
   */
  const patente = patenteDosPontos(naTela?.arenaPontos);
  const oQueEle = naTela?.level ? `level ${naTela.level}` : 'jogador';

  openMenu(evento, [
    {
      cabeca: nome,
      sub: patente ? `${oQueEle} · ${patente.nome} na arena` : oQueEle,
      arte: naTela?.look ? outfitCanvas(naTela.look, naTela.colors ?? naTela, 28) : null,
    },
    /*
     * ---- O BLOCO DA GUILDA, e nao uma terceira linha do cabecalho ----
     *
     * A guilda vem no retrato da cidade, e só o nome dela — o servidor não manda o
     * cargo por aqui porque este retrato viaja seis vezes por segundo com todo mundo
     * da praça. Ver `citySnapshot` em `city.mjs` e a nota do `blocoDaGuilda`.
     *
     * `null` quando a pessoa não tem guilda, e um `null` no meio da lista é pulado
     * pelo `openMenu`: sem guilda não há bloco nem espaço vazio.
     */
    blocoDaGuilda(naTela?.guilda),
    { divider: true },
    /*
     * ---- ATACAR, e so' onde da' para atacar ----
     *
     * "os jogadores podem matar entre si" — e "o pvp so deve funcionar em locais
     *  que eu entitular como pvp, ou seja qualquer arena x1 da aba de arenas".
     *
     * A linha so' NASCE dentro de um lugar de pvp (`state.hunt.pvp`, que o
     * servidor carimba no retrato) e so' para quem esta la dentro com voce. Em
     * qualquer outro lugar ela nao existe — nao aparece cinzenta com um porque,
     * como as outras: "atacar" nao e' uma coisa que se explica que nao da' na
     * praca da cidade.
     *
     * Vem no TOPO do menu, e e' a unica coisa do jogo que justifica tirar a
     * mensagem privada do primeiro lugar: dentro de um duelo, o botao direito no
     * adversario e' para brigar.
     */
    ...(state.hunt?.pvp && (state.hunt?.aliados ?? []).some((quem) => quem.name === nome)
      ? [
          {
            label: `Atacar ${nome}`,
            action: () => send({ t: 'huntTarget', uid: `aliado:${nome}` }),
          },
          { divider: true },
        ]
      : []),
    { label: 'Mensagem privada', action: () => abrirPrivado(nome) },
    jaEhAmigo
      ? { label: 'Já é seu amigo', disabled: true }
      : { label: 'Adicionar aos amigos', action: () => send({ t: 'friends', action: 'add', name: nome }) },
    /*
     * ---- Party e caçada são dois convites ----
     *
     * A PARTY é o time: forma-se na cidade, dura entre uma caverna e outra, e é
     * de onde o convite de caçada sai depois. A CAÇADA é entrar na sessão
     * agora, e por isso ela exige estar numa.
     *
     * Os dois no mesmo menu porque é o mesmo gesto — botão direito na pessoa —,
     * e separados porque querem dizer coisas diferentes. Chamar para a party
     * quem já está nela seria um convite que o outro lado recusa.
     */
    naMinhaParty
      ? { label: 'Já está na sua party', disabled: true }
      : {
          label: 'Convidar para a party',
          disabled: temParty && !souLiderDaParty,
          porque: temParty && !souLiderDaParty ? 'só o líder da party convida' : null,
          action: () => send({ t: 'grupo', action: 'convidar', name: nome }),
        },
    {
      label: 'Convidar para a caçada',
      // Convidar é do líder, e de dentro de uma caçada: é lá que existe o mapa
      // para onde o convidado vai.
      disabled: !euCaçando || !souLider,
      porque: !euCaçando ? 'você precisa estar numa caçada' : !souLider ? 'só o líder da caçada convida' : null,
      action: () => send({ t: 'party', action: 'invite', name: nome }),
    },
    { divider: true },
    {
      label: 'Trocar itens',
      // Trocar exige os dois parados: dentro da caçada o inventário muda
      // sozinho a cada segundo.
      disabled: euCaçando,
      porque: euCaçando ? 'saia da caçada para trocar' : null,
      action: () => send({ t: 'trade', action: 'invite', name: nome }),
    },
    { divider: true },
    linhaDeCopiar(nome),
    /*
     * ---- E as ferramentas de quem modera ----
     *
     * No fim do menu, e não no topo: o gesto de botão direito num nome é, em
     * noventa e nove por cento das vezes, chamar para a party ou mandar um
     * privado. Pôr "Banir" na primeira linha é convidar o clique errado.
     *
     * O tutor cala; o god cala, bane e libera. É o mesmo degrau do servidor
     * (`nivel` em `god.mjs`), repetido aqui só para a tela não oferecer o que
     * vai ser recusado — quem manda continua sendo o servidor.
     */
    ...linhasDeCastigo(nome),
  ]);
}

/** As opções de moderação, conforme o cargo de quem está olhando. */
function linhasDeCastigo(nome) {
  const { state, send } = ctx;
  const meu = state.character?.marca?.nivel ?? 1;
  if (meu < 2) return [];

  const linhas = [{ divider: true }, { cabeca: 'Moderação', sub: meu >= 3 ? 'God' : 'Tutor' }];
  linhas.push({ label: 'Calar (mute)…', action: () => abrirCastigo(nome, 'mute') });
  if (meu >= 3) {
    linhas.push({ label: 'Banir a conta…', action: () => abrirCastigo(nome, 'ban') });
    linhas.push({ label: 'Banir o IP…', action: () => abrirCastigo(nome, 'ban_ip') });
  }
  linhas.push({ label: 'Liberar', action: () => send({ t: 'chat', text: `/liberar ${nome}` }) });
  linhas.push({ label: 'Ver os castigos', action: () => send({ t: 'chat', text: `/castigos ${nome}` }) });
  return linhas;
}

/*
 * ---- O nome no chat abre a FICHA da pessoa ----
 *
 * O menu de contexto acima é do mapa: ele nasce onde o mouse está, é pequeno e
 * some ao clicar fora. No chat o gesto é outro — o dono pediu o clique com o
 * botão esquerdo, e uma janela de verdade: o boneco vestido, o level, e os
 * botões de falar e de adicionar.
 *
 * As regras de quem pode o quê são as MESMAS do menu do mapa (ver
 * `menuDeJogador`), e é de propósito: duas telas que oferecem as mesmas ações
 * não podem discordar sobre quando elas valem.
 *
 * O pedido vai ao servidor e a janela abre quando a resposta chega. Abrir antes,
 * com o pouco que a tela já sabe, mostraria "level 0" para quem não está à vista
 * e depois corrigiria sozinho — pior do que meio segundo de espera.
 */
export function abrirPerfil(nome, evento = null) {
  const { state, send } = ctx;
  const limpo = String(nome ?? '').trim();
  if (!limpo || limpo === state.character?.name) return;
  /*
   * Onde o dedo estava.
   *
   * O menu abre no lugar do clique, e a resposta do servidor chega meio segundo
   * depois — sem guardar o ponto aqui, ele nasceria no canto da tela. Um só
   * porque só existe um clique de cada vez.
   */
  ondeClicou = evento ? { x: evento.clientX, y: evento.clientY } : null;
  send({ t: 'perfil', name: limpo });
}

/** O ponto do último clique num nome, para o menu nascer ali. */
let ondeClicou = null;

/*
 * A ficha, com o que o servidor respondeu.
 *
 * É o MESMO menuzinho de quando se clica em alguém na cidade — o dono pediu
 * assim, e ele tem razão: uma janela no meio da tela para quatro opções tapa o
 * jogo e pede um segundo clique para sair. O menu nasce onde o dedo está e some
 * ao clicar fora.
 *
 * A diferença para o `menuDeJogador` é de onde vêm o level e a roupa: lá, do que
 * a tela já enxerga; aqui, do servidor — porque no chat aparece gente que está
 * do outro lado do mundo, e para ela a tela não sabe nada. Ver `abrirPerfil`.
 */
export function mostrarPerfil(perfil) {
  const { state, send } = ctx;
  if (!perfil?.name) return;

  const amigos = state.friends?.amigos ?? [];
  const jaEhAmigo = amigos.some((amigo) => amigo.name === perfil.name);
  const euCaçando = !!state.hunt;
  const souLider = euCaçando && !state.hunt?.convidadoPor;

  /* As mesmas contas de party do menu do mapa. Ver `menuDeJogador`. */
  const minhaParty = state.character?.party ?? null;
  const temParty = !!minhaParty;
  const souLiderDaParty = !!minhaParty?.souLider;
  const naMinhaParty = (minhaParty?.membros ?? []).some((membro) => membro.name === perfil.name);
  const nomeDaVocacao =
    perfil.vocationName ?? (state.catalog?.vocations ?? []).find((v) => v.id === perfil.vocation)?.name ?? 'sem vocação';

  const onde = ondeClicou ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  /*
   * `openMenu` quer um evento — ele chama `preventDefault` e lê `clientX/Y`.
   * O clique de verdade já acabou (a resposta veio do servidor), então o que vai
   * é um evento de mentirinha com o ponto guardado.
   */
  const comoSeFosseClique = {
    preventDefault: () => {},
    stopPropagation: () => {},
    clientX: onde.x,
    clientY: onde.y,
  };

  const estado = perfil.online
    ? perfil.hunt
      ? `level ${perfil.level} · caçando em ${perfil.hunt}`
      : `level ${perfil.level} · na cidade`
    : `level ${perfil.level} · offline`;

  /*
   * ---- A patente de arena na ficha ----
   *
   * "e mostrar ao clicar em alguem tambem naquele modal que aparece pra mandar
   *  msg privada."
   *
   * Na terceira linha do cabecalho, embaixo do level e da vocacao: a patente e'
   * sobre o que a pessoa faz na arena, e quem clica num nome quer primeiro saber
   * quem e' e onde esta. Com vitorias e derrotas junto, porque uma patente sem o
   * placar e' um titulo sem historia.
   */
  const daArena = perfil.patente
    ? `${perfil.patente.nome} · ${perfil.arenaVitorias ?? 0}V ${perfil.arenaDerrotas ?? 0}D na arena`
    : null;

  openMenu(comoSeFosseClique, [
    {
      cabeca: perfil.marca?.tag ? `[${perfil.marca.tag}] ${perfil.name}` : perfil.name,
      sub: `${estado} · ${nomeDaVocacao}${daArena ? ` · ${daArena}` : ''}`,
      /*
       * O boneco com os addons DELE.
       *
       * `colors` é a roupa inteira do outro personagem — cores e bitmask de
       * addon. Desenhar só pelo `look` devolveria o modelo pelado.
       */
      arte: outfitCanvas(perfil.look, perfil.colors ?? { addons: perfil.addons ?? 0 }, 32),
    },
    /*
     * ---- "MESMO MENU VALE QUANDO ABERTO PELO CHAT" ----
     *
     * O mesmo `blocoDaGuilda` do menu da cidade, e aqui ele vem COMPLETO: este
     * caminho é uma pergunta feita ao servidor, uma por clique, então a etiqueta
     * traz o cargo junto e a segunda linha do bloco ganha o "Líder"/"Vice"/"Membro"
     * que o caminho da cidade não tem como saber.
     *
     * Duas montagens diferentes do mesmo bloco seriam duas telas discordando sobre
     * o que é uma guilda — que é o defeito que este bloco veio consertar.
     */
    blocoDaGuilda(perfil.guilda),
    { divider: true },
    { label: 'Mensagem privada', action: () => ctx.abrirChatPrivado?.(perfil.name) },
    jaEhAmigo
      ? { label: 'Já é seu amigo', disabled: true, porque: 'ele já está na sua lista' }
      : { label: 'Adicionar aos amigos', action: () => send({ t: 'friends', action: 'add', name: perfil.name }) },
    /*
     * As MESMAS duas opções do menu do mapa, e é de propósito: duas telas que
     * oferecem as mesmas ações não podem discordar sobre quando elas valem.
     * Ver `menuDeJogador`.
     */
    naMinhaParty
      ? { label: 'Já está na sua party', disabled: true, porque: 'vocês já são do mesmo time' }
      : {
          label: 'Convidar para a party',
          disabled: !perfil.online || (temParty && !souLiderDaParty),
          porque: !perfil.online
            ? 'ele está offline'
            : temParty && !souLiderDaParty
              ? 'só o líder da party convida'
              : null,
          action: () => send({ t: 'grupo', action: 'convidar', name: perfil.name }),
        },
    {
      label: 'Convidar para a caçada',
      disabled: !euCaçando || !souLider || !perfil.online,
      porque: !perfil.online
        ? 'ele está offline'
        : !euCaçando
          ? 'você precisa estar numa caçada'
          : !souLider
            ? 'só o líder da caçada convida'
            : null,
      action: () => send({ t: 'party', action: 'invite', name: perfil.name }),
    },
    { divider: true },
    {
      label: 'Trocar itens',
      disabled: euCaçando || !perfil.online || perfil.cacando,
      porque: !perfil.online
        ? 'ele está offline'
        : perfil.cacando
          ? 'ele está caçando'
          : euCaçando
            ? 'saia da caçada para trocar'
            : null,
      action: () => send({ t: 'trade', action: 'invite', name: perfil.name }),
    },
    { divider: true },
    // A mesma linha do menu do mapa. Ver `copiarNome`.
    linhaDeCopiar(perfil.name),
  ]);
}

/**
 * O menu do botão direito em cima do PRÓPRIO personagem (com Ctrl).
 *
 * Ctrl porque o botão direito sem ele já tem dono no mapa — é a mira da Caça
 * Online. É o mesmo gesto do client dele.
 */
export function menuDeMim(evento) {
  const { state, send } = ctx;
  const montado = !!state.character?.outfit?.mount;
  const temMontaria = (state.mounts?.mounts ?? []).some((entry) => entry.owned);

  openMenu(evento, [
    {
      cabeca: state.character?.name ?? 'Você',
      sub: `level ${state.character?.level ?? 1}`,
      arte: state.character?.outfit
        ? outfitCanvas(state.character.outfit.type, state.character.outfit, 28)
        : null,
    },
    { divider: true },
    { label: 'Aparência', action: () => ctx.abrirAparencia?.() },
    {
      label: montado ? 'Desmontar' : 'Montaria',
      // Sem nenhuma montaria comprada não há o que montar, e o item apagado já
      // conta essa história.
      disabled: !montado && !temMontaria,
      porque: !montado && !temMontaria ? 'compre uma montaria na loja' : null,
      action: () => {
        if (montado) return send({ t: 'mount', id: 0 });
        const primeira = (state.mounts?.mounts ?? []).find((entry) => entry.owned);
        if (primeira) send({ t: 'mount', id: primeira.id });
      },
    },
  ]);
}

/** Abre a conversa privada com alguém, no canal de chat. */
function abrirPrivado(nome) {
  ctx.abrirChatPrivado?.(nome);
}

// ------------------------------------------------------------------- troca

/** Quantos desse item existem na mochila — a única bolsa que a troca enxerga. */
function quantosNaMochila(id) {
  return (ctx.state.character?.inventory ?? [])
    .filter((entry) => entry.id === id)
    .reduce((total, entry) => total + entry.count, 0);
}

/*
 * ---- O convite de troca ----
 *
 * Era uma caixa modal no meio da tela, com fundo escurecido. Três defeitos, e
 * o terceiro é o grave:
 *
 *   - tamanho: uma caixa de confirmação inteira para uma pergunta de uma linha;
 *   - lugar: bem no meio, tapando o mapa e o personagem;
 *   - e o fundo escurecido PRENDE o jogo. Quem recebe um convite no meio de
 *     uma luta fica sem andar, sem atacar e sem beber poção até responder —
 *     e qualquer um pode mandar um convite. Um convite que trava o outro
 *     jogador é uma arma.
 *
 * Agora é o mesmo cartão do convite de caçada: pequeno, embaixo no meio, sem
 * fundo, sem prender o teclado, e some sozinho quando o convite expira do lado
 * do servidor. É o desenho que o cartão de party já tinha — e as duas coisas
 * são a mesma: alguém pedindo licença para começar algo com você.
 */
export function perguntarTroca(de, expiraEm = null) {
  const { send } = ctx;
  document.getElementById('convite-troca')?.remove();

  const caixa = el('div', 'convite convite-baixo');
  caixa.id = 'convite-troca';
  caixa.append(el('b', null, `${de} quer trocar itens`));
  caixa.append(el('span', null, 'Abrir a mesa de troca?'));

  const acoes = el('div', 'convite-acoes');
  const recusar = el('button', 'ghost', 'Recusar');
  recusar.onclick = () => {
    caixa.remove();
    send({ t: 'trade', action: 'decline' });
  };
  const aceitar = el('button', 'primary', 'Abrir troca');
  aceitar.onclick = () => {
    caixa.remove();
    send({ t: 'trade', action: 'accept' });
  };
  acoes.append(recusar, aceitar);
  caixa.append(acoes);

  // O relógio combina com o do servidor: aceitar um cartão morto dá erro.
  const prazo = expiraEm ?? Date.now() + 60_000;
  const relogio = el('i', 'convite-relogio');
  caixa.append(relogio);
  const escrever = () => {
    const falta = Math.max(0, Math.ceil((prazo - Date.now()) / 1000));
    relogio.textContent = falta ? `expira em ${falta}s` : 'expirado';
    return falta;
  };
  escrever();
  const tique = setInterval(() => {
    if (!escrever() || !caixa.isConnected) {
      clearInterval(tique);
      caixa.remove();
    }
  }, 1000);

  document.body.append(caixa);
}

/*
 * ---- A janela da troca ----
 *
 * Dois quadros lado a lado: o que eu ofereço e o que ele oferece. O meu tem os
 * botões (tirar item, mexer no ouro); o dele é só de olhar.
 *
 * O aviso do meio é a regra que faz a troca ser segura, escrita com todas as
 * letras: mexer na oferta derruba as duas confirmações. Sem dizer isso, o
 * jogador só descobre a proteção quando ela dispara.
 */
/*
 * ---- O OURO DA TROCA ----
 *
 * O dono: "às vezes eu tô colocando o gold e um dos chares da troca não vai o
 * gold; e também não mostra automaticamente com as vírgulas, e tem que ter o
 * ícone do gold".
 *
 * ---- Por que o ouro sumia ----
 *
 * Era um `<input type=number>` com `onchange`, e `change` num campo nativo só
 * dispara quando ele PERDE O FOCO. Só que esta janela é redesenhada a cada
 * `state` do servidor — e durante uma troca eles chovem, porque o outro lado
 * está mexendo na mesa. O redesenho trocava o campo por um novo com o valor do
 * SERVIDOR (ainda zero), e o que a pessoa tinha acabado de digitar ia embora
 * sem nunca ter virado um `change`.
 *
 * É a quarta vez que este mesmo defeito aparece neste jogo — o botão "zerar
 * analisador", a quantidade da loja e o seletor de charm foram os outros três.
 * O remédio é sempre o mesmo: o elemento que recebe o gesto não pode ser
 * refeito embaixo do dedo.
 *
 * ---- E os botões não são enfeite ----
 *
 * Digitar é o gesto que o defeito engolia; um passo de +/- COMMITA na hora, sem
 * depender de foco nenhum. Por isso eles existem, e por isso o campo continua
 * ali para quem quer um número exato.
 */

/** O campo de digitar, guardado FORA do desenho para sobreviver ao redesenho. */
let campoDoOuroDaTroca = null;

/** O desenho da moeda, do próprio catálogo do jogo. */
const ITEM_DA_MOEDA = 3031; // gold coin
const moedaDeOuro = (tamanho = 18) => itemCanvas(ITEM_DA_MOEDA, tamanho);

/**
 * Os passos do +/-.
 *
 * Não é um passo só: uma troca tanto é de 500 quanto de 50 milhões, e subir de
 * mil em mil até os milhões seria um botão inútil. O passo acompanha o que já
 * está na mesa — a mesma ideia da régua de quantidade da loja.
 */
function passoDoOuro(valor) {
  const v = Math.max(0, Math.floor(Number(valor) || 0));
  if (v < 10_000) return 1_000;
  if (v < 100_000) return 10_000;
  if (v < 1_000_000) return 100_000;
  if (v < 10_000_000) return 1_000_000;
  return 10_000_000;
}

function controleDoOuro(oferta, send, state) {
  const carteira = Math.max(0, Math.floor(Number(state.character?.gold) || 0));
  const agora = Math.max(0, Math.floor(Number(oferta.gold) || 0));
  const caixa = el('div', 'troca-ouro-controle');

  const mandar = (valor) => {
    /*
     * O teto é o que a pessoa CARREGA: o servidor recusa o que passa disso
     * (`oferecerOuro` compara com `character.gold`, e o banco não entra numa
     * troca). Cortar aqui transforma uma recusa em silêncio numa parada visível
     * no número máximo.
     */
    const limpo = Math.max(0, Math.min(carteira, Math.floor(Number(valor) || 0)));
    send({ t: 'trade', action: 'gold', value: limpo });
    return limpo;
  };

  /*
   * O campo é criado UMA VEZ e reaproveitado em todo redesenho. É a peça que
   * conserta o ouro que sumia.
   */
  if (!campoDoOuroDaTroca) {
    campoDoOuroDaTroca = document.createElement('input');
    campoDoOuroDaTroca.type = 'text';
    campoDoOuroDaTroca.inputMode = 'numeric';
    campoDoOuroDaTroca.className = 'troca-ouro-campo';
  }
  const campo = campoDoOuroDaTroca;

  /*
   * O valor do servidor só é escrito quando o campo NÃO está sendo digitado.
   * Escrever por cima de quem está digitando é o mesmo defeito com outra roupa.
   */
  if (document.activeElement !== campo) campo.value = agora ? agora.toLocaleString('pt-BR') : '';

  /*
   * Manda a cada tecla, e não no `change`.
   *
   * `change` esperava o foco sair, e era esperando isso que o valor se perdia. A
   * cada tecla o servidor já sabe o número — e como ele derruba as duas
   * confirmações a cada mudança (`desconfirmar`), não há risco de fechar a troca
   * com um valor pela metade.
   */
  campo.oninput = () => {
    const cru = campo.value.replace(/[^\d]/g, '');
    mandar(cru);
  };
  /* Ao sair, o número volta bonito, com os pontos de milhar. */
  campo.onblur = () => {
    const cru = Math.max(0, Math.min(carteira, Math.floor(Number(campo.value.replace(/[^\d]/g, '')) || 0)));
    campo.value = cru ? cru.toLocaleString('pt-BR') : '';
  };

  const passo = passoDoOuro(agora);
  const menos = el('button', 'ghost troca-ouro-passo', '−');
  menos.title = `-${passo.toLocaleString('pt-BR')}`;
  menos.disabled = agora <= 0;
  menos.onclick = () => mandar(agora - passo);

  const mais = el('button', 'ghost troca-ouro-passo', '+');
  mais.title = `+${passo.toLocaleString('pt-BR')}`;
  mais.disabled = agora >= carteira;
  mais.onclick = () => mandar(agora + passo);

  /*
   * Não há botão de "Tudo".
   *
   * O dono: "tira opção de pôr tudo, senão a pessoa pode clicar sem querer". Ele
   * está certo — é o único botão desta janela cujo erro de um clique entrega a
   * bolsa inteira a outra pessoa, e a troca é irreversível. Quem quer oferecer
   * tudo digita o número, que é um gesto que ninguém faz sem querer.
   */
  const zerar = el('button', 'ghost troca-ouro-acao', 'Redefinir');
  zerar.disabled = agora <= 0;
  zerar.onclick = () => mandar(0);

  caixa.append(menos, campo, mais, zerar);

  /* Quanto sobra depois desta oferta — a conta que evita prometer o que falta. */
  const resto = el('em', 'troca-ouro-resto', `de ${carteira.toLocaleString('pt-BR')} na bolsa`);
  const embrulho = el('div', 'troca-ouro-caixa');
  embrulho.append(caixa, resto);
  return embrulho;
}

export function corpoDaTroca(body) {
  const { state, send } = ctx;
  const troca = state.troca;
  if (!troca) return void body.append(el('p', 'empty', 'A troca foi encerrada.'));

  const aviso = el('p', 'troca-aviso', 'Qualquer mudança na oferta desmarca as duas confirmações.');

  const quadro = (titulo, oferta, meu) => {
    const caixa = el('div', `troca-lado${meu ? ' meu' : ''}${oferta.confirmou ? ' pronto' : ''}`);
    const cabeca = el('div', 'troca-cabeca');
    cabeca.append(el('b', null, titulo));
    cabeca.append(el('em', null, oferta.confirmou ? '✓ confirmou' : 'montando...'));
    caixa.append(cabeca);

    const grade = el('div', 'troca-grade');
    for (const entry of oferta.itens) {
      const celula = el('div', 'troca-item');
      celula.append(itemCanvas(entry.id, 32));
      if (entry.count > 1) celula.append(el('u', null, String(entry.count)));
      // A peça como ela É (o servidor manda a raridade, os afixos, o tier): a borda na cor da
      // raridade e o balão completo — quem recebe vê que é a Mítica, e não uma qualquer.
      celula.classList.add(classeDaRaridade(state.items?.[entry.id], entry));
      tipFor(celula, entry.id, meu ? 'clique para tirar da oferta' : null, null, entry);
      if (meu) celula.onclick = () => send({ t: 'trade', action: 'offer', id: entry.id, count: 0 });
      grade.append(celula);
    }
    // As casas vazias existem para o quadro não pular de tamanho a cada item.
    for (let i = oferta.itens.length; i < (troca.limite ?? 8); i++) grade.append(el('div', 'troca-item vazio'));
    caixa.append(grade);

    const ouro = el('div', 'troca-ouro');
    ouro.append(moedaDeOuro(18));
    ouro.append(el('span', null, 'Ouro'));
    if (meu) ouro.append(controleDoOuro(oferta, send, state));
    else ouro.append(el('b', null, (oferta.gold ?? 0).toLocaleString('pt-BR')));
    caixa.append(ouro);
    return caixa;
  };

  const colunas = el('div', 'troca-colunas');
  const meu = quadro('Você oferece', troca.minha, true);
  /*
   * ---- Arrastar para a mesa ----
   *
   * O único caminho para pôr um item na oferta era o menu do botão direito, e
   * o gesto que qualquer um tenta primeiro — arrastar da mochila para a mesa —
   * não fazia nada: o quadro não era zona de soltura, então o navegador
   * recusava o `drop` sem dizer por quê.
   *
   * O pacote arrastado é o mesmo que a mochila e o inventário já emitem
   * (`{ id, from }`), então isto atende os dois de uma vez. Equipamento não
   * entra: a troca mexe só no que está na mochila, e é a regra do
   * `trade.mjs` — deixar soltar aqui prometeria o que a entrega recusaria.
   */
  meu.addEventListener('dragover', (evento) => {
    evento.preventDefault();
    meu.classList.add('soltar-aqui');
  });
  meu.addEventListener('dragleave', () => meu.classList.remove('soltar-aqui'));
  meu.addEventListener('drop', (evento) => {
    evento.preventDefault();
    meu.classList.remove('soltar-aqui');
    let carga = null;
    try {
      carga = JSON.parse(evento.dataTransfer.getData('text/plain'));
    } catch {
      return;
    }
    if (!carga?.id) return;
    if (carga.from === 'equipment') {
      return void ctx.notice?.('Equipamento não entra na troca — tire da mão primeiro.');
    }
    // A troca oferece da MOCHILA: vindo da Store Inbox ofereceria a cópia de lá.
    if (carga.from === 'storeInbox') return void ctx.notice?.('Leve da Store Inbox para a mochila primeiro.');
    /*
     * O mesmo aviso que o menu do botão direito dá, para o mesmo gesto.
     *
     * Sem ele o item era arrastado, a caixa de "quantos?" abria, o jogador
     * escolhia — e só então o servidor recusava. Recusar na hora de SOLTAR diz
     * a mesma coisa três passos antes.
     */
    if (ctx.state.items?.[carga.id]?.fixo) {
      const nome = ctx.state.items[carga.id]?.name ?? 'Esse item';
      return void ctx.notice?.(`${nome} é fixa no personagem — não entra na troca.`);
    }
    const tem = quantosNaMochila(carga.id);
    if (!tem) return void ctx.notice?.('Esse item não está na sua mochila.');
    pedirQuantidade({
      id: carga.id,
      max: tem,
      titulo: 'Quantos oferecer?',
      // A cópia arrastada (`alvo`: raridade e afixos), e não outra igual da mochila.
      aoConfirmar: (count) => send({ t: 'trade', action: 'offer', id: carga.id, count, alvo: carga.alvo ?? null }),
    });
  });
  colunas.append(meu);
  colunas.append(quadro(troca.com, troca.dele, false));

  body.append(colunas, aviso);

  const dica = el('p', 'shop-note', 'Arraste um item da mochila para o seu lado da mesa — ou clique nele com o botão direito e escolha "Pôr na troca".');
  body.append(dica);

  const acoes = el('div', 'confirm-actions');
  const cancelar = el('button', 'ghost', 'Cancelar troca');
  cancelar.onclick = () => {
    send({ t: 'trade', action: 'cancel' });
    ctx.closeModal();
  };
  const confirmar = el('button', 'primary', troca.minha.confirmou ? 'Confirmado' : 'Confirmar troca');
  confirmar.disabled = troca.minha.confirmou;
  confirmar.onclick = () => send({ t: 'trade', action: 'confirm' });
  acoes.append(cancelar, confirmar);
  body.append(acoes);
}
