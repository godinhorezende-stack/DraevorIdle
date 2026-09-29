/*
 * A porta da rua: números ao vivo e o ranking.
 *
 * Tudo vem de uma chamada só (`/api/status`), e a página funciona sem ela — se
 * o servidor não responder, os travessões continuam no lugar e o botão de jogar
 * continua valendo. Uma página de entrada que quebra porque uma tabela não
 * carregou é pior do que uma sem tabela.
 *
 * Não há WebSocket aqui de propósito. Abrir uma conexão de jogo para quem só
 * está lendo a página custa uma sessão no servidor por curioso; um pedido a
 * cada trinta segundos diz a mesma coisa e não custa nada.
 */
import { t, aplicarIdioma, montarSeletor } from '/client/site/idiomas.mjs';
import { linhaDaGuilda } from '/client/site/brasao-no-site.mjs';

const $ = (id) => document.getElementById(id);
const numero = (valor) => Number(valor ?? 0).toLocaleString('pt-BR');
const reais = (valor) =>
  Number(valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const VOCACOES = {
  knight: 'Knight',
  paladin: 'Paladin',
  druid: 'Druid',
  sorcerer: 'Sorcerer',
  monk: 'Monk',
  none: 'Sem vocação',
};

/*
 * As abas do ranking, com o desenho de cada uma.
 *
 * São os MESMOS ícones do jogo (`client/assets/icons`), e é de propósito: quem
 * já jogou reconhece a espada antes de ler "sword", e quem ainda não jogou
 * chega ao jogo achando a tela conhecida. O nome bonito fica aqui; a lista de
 * quais categorias existem vem do servidor, que é quem sabe.
 */
/*
 * O nome de cada aba vem do dicionario quando ha' um.
 *
 * "Sword", "Axe" e "Fishing" ficam como estao nos dois idiomas: sao os nomes
 * das skills DENTRO do jogo, e traduzir aqui faria a pagina chamar de um jeito
 * o que a tela do jogo chama de outro.
 */
const CATEGORIAS = {
  // A barra de experiencia mora em `ui/`, e nao em `icons/`: ela e' parte do HUD
  // e nao da fileira de ferramentas. O caminho vai inteiro para nao ter de
  // adivinhar a pasta de cada um.
  exp: { nome: 'Experiência', icone: 'ui/sk-experience' },
  level: { nome: 'Level', icone: 'ficha-level' },
  magic: { nome: 'Magic', icone: 'sk-magic' },
  melee: { nome: 'Melee', icone: 'sk-melee' },
  distance: { nome: 'Distance', icone: 'sk-distance' },
  shielding: { nome: 'Shielding', icone: 'sk-shielding' },
  fishing: { nome: 'Fishing', icone: 'sk-fishing' },
};

// A coluna do valor muda de nome com a aba: "Experiência" numa, "Nível" noutra,
// "Pontos" nas skills. Uma coluna chamada sempre "Experiência" mentiria em oito
// das dez abas.
const TITULO_DO_VALOR = { exp: 'Experiência', level: 'Level' };

let categoriaAtual = 'exp';

function icone(nome, tamanho = 16) {
  const img = document.createElement('img');
  img.className = 'icone';
  img.src = nome.includes('/')
    ? `/client/assets/${nome}.png`
    : `/client/assets/icons/${nome}.png`;
  img.alt = '';
  img.width = tamanho;
  img.height = tamanho;
  // Ícone que não existe some em vez de deixar a moldura quebrada na tela.
  img.onerror = () => img.remove();
  return img;
}

// O placar "O servidor agora" saiu da capa; sobrou o contador de online no topo.
// Cada número só é escrito se o lugar dele existir na página.
function pintarNumeros(dados) {
  const escrever = (id, texto) => { if ($(id)) $(id).textContent = texto; };
  escrever('online', numero(dados.online));
  escrever('personagens', numero(dados.personagens));
  escrever('maior-level', dados.maiorLevel ? numero(dados.maiorLevel) : '—');
  escrever('hunts', dados.hunts ? numero(dados.hunts) : '—');
}

function pintarAbas(categorias) {
  const barra = $('abas-ranking');
  if (barra.dataset.pronto === '1') return; // a lista não muda em tempo de execução
  barra.dataset.pronto = '1';
  barra.innerHTML = '';

  for (const chave of categorias ?? ['exp']) {
    const base = CATEGORIAS[chave] ?? { nome: chave, icone: null };
    const info = { ...base, nome: t(`cat.${chave}`, base.nome) };
    const botao = document.createElement('button');
    botao.className = 'aba';
    botao.setAttribute('aria-selected', String(chave === categoriaAtual));
    if (info.icone) botao.append(icone(info.icone));
    botao.append(document.createTextNode(info.nome));
    botao.onclick = () => {
      categoriaAtual = chave;
      for (const outro of barra.children) {
        outro.setAttribute('aria-selected', String(outro === botao));
      }
      atualizar();
    };
    barra.append(botao);
  }
}

function pintarRanking(lista, categoria) {
  const titulo = TITULO_DO_VALOR[categoria];
  $('titulo-valor').textContent = titulo
    ? t(`ranking.${categoria}`, titulo)
    : t('ranking.pontos', 'Pontos');

  const corpo = $('lista-ranking');
  corpo.innerHTML = '';

  if (!lista?.length) {
    const linha = document.createElement('tr');
    const celula = document.createElement('td');
    celula.colSpan = 5;
    celula.className = 'vazio';
    celula.textContent = t('ranking.vazio', 'ninguém no ranking ainda — seja o primeiro');
    linha.append(celula);
    corpo.append(linha);
    return;
  }

  lista.forEach((entrada, i) => {
    const linha = document.createElement('tr');
    if (i === 0) linha.className = 'top1';

    const posicao = document.createElement('td');
    posicao.className = 'posicao';
    posicao.textContent = String(i + 1);

    const nome = document.createElement('td');
    nome.className = 'nome';
    const ponto = document.createElement('i');
    // Verde: conectado. Amarelo: caçando de aba fechada. Apagado: offline.
    ponto.className = `ponto${entrada.online ? '' : entrada.cacandoOffline ? ' ausente' : ' off'}`;
    ponto.title = entrada.online ? 'online agora' : entrada.cacandoOffline ? 'caçando offline' : 'offline';
    const link = document.createElement('a');
    link.className = 'link-personagem';
    link.href = `/personagem?nome=${encodeURIComponent(entrada.name)}`;
    link.textContent = entrada.name;
    nome.append(ponto, link);
    /*
     * A guilda vai EMBAIXO do nome, e não numa coluna nova: a tabela já tem
     * cinco colunas e uma sexta espremeria o nome, que é o que se procura aqui.
     * Quem não tem guilda não ganha linha nenhuma — ver `linhaDaGuilda`.
     */
    const daGuilda = linhaDaGuilda(entrada.guilda);
    if (daGuilda) nome.append(daGuilda);

    const vocacao = document.createElement('td');
    vocacao.className = 'vocacao';
    vocacao.textContent = VOCACOES[entrada.vocation] ?? entrada.vocation ?? '—';

    const level = document.createElement('td');
    level.className = 'num';
    level.textContent = numero(entrada.level);

    const valor = document.createElement('td');
    valor.className = 'num';
    valor.textContent = numero(entrada.value);

    linha.append(posicao, nome, vocacao, level, valor);
    corpo.append(linha);
  });
}

/*
 * ---- O donate saiu da porta da rua ----
 *
 * Ele esteve aqui — a grade de pacotes com a janela de pagamento — e o dono
 * pediu para tirar. O caminho continua de pé e testado: a rota `/api/site` com
 * as ações `entrar`, `google` e `doar`, e a janela em `doar.mjs`. Voltar a
 * mostrar é acrescentar a seção no HTML e chamar `doar(pack)` num botão.
 *
 * Fica escrito porque o contrário — apagar tudo — jogaria fora o login pelo
 * Google e o QR do site, que deram trabalho e funcionam.
 */

async function atualizar() {
  try {
    const resposta = await fetch(`/api/status?ranking=${encodeURIComponent(categoriaAtual)}`, {
      cache: 'no-store',
    });
    if (!resposta.ok) return;
    const dados = await resposta.json();
    pintarNumeros(dados);
    pintarAbas(dados.categorias);
    pintarRanking(dados.highscore, dados.categoria ?? categoriaAtual);
  } catch {
    // Servidor fora do ar ou rede ruim: a página fica como está. Ela não
    // depende disto para nada — o botão de jogar continua valendo.
  }
}

/*
 * O idioma primeiro, e a engrenagem no menu.
 *
 * `aplicarIdioma` antes do primeiro `atualizar` para a pagina nao piscar em
 * portugues para quem escolheu ingles; e o `draevor:idioma` refaz o que veio do
 * servidor, que nao esta no HTML e o dicionario nao alcanca sozinho.
 */
aplicarIdioma();
montarSeletor(document.querySelector('.topo nav'));
window.addEventListener('draevor:idioma', () => {
  const abas = $('abas-ranking');
  abas.dataset.pronto = '';
  atualizar();
});

atualizar();
// Trinta segundos: rápido o bastante para o número parecer vivo, devagar o
// bastante para uma aba esquecida aberta não virar tráfego.
setInterval(atualizar, 30_000);
