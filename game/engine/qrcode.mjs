/*
 * Um QR Code escrito aqui dentro.
 *
 * ---- Por que não uma biblioteca ----
 *
 * O projeto não tem dependência que não seja essencial, e esta entra no meio de
 * um PAGAMENTO: um pacote de terceiro que gere o quadrado errado (ou que um dia
 * seja trocado por versão maliciosa) manda o dinheiro do jogador para outro
 * lugar. Um serviço externo de imagem seria pior ainda — o endereço do
 * pagamento sairia daqui para um site que ninguém controla.
 *
 * Então o quadrado é desenhado por este arquivo, e o `tools/test-qrcode.mjs`
 * confere o miolo dele contra o exemplo da norma (ISO/IEC 18004), que é a única
 * referência que não depende de ninguém.
 *
 * ---- O que ele faz e o que não faz ----
 *
 * Faz: modo BYTE (que cobre qualquer URL), correção de erro à escolha, versões
 * 1 a 20 — o bastante para um link de pagamento de ~200 caracteres.
 *
 * Não faz: modo numérico e alfanumérico (que encurtariam o quadrado para um
 * texto só de dígitos), ECI, nem QR Micro. Nada disso serve para o que este
 * arquivo existe: transformar um endereço em algo que o celular lê.
 */

// ---------------------------------------------------------------- Galois

/*
 * A aritmética do corpo finito GF(256), que é onde a correção de erro vive.
 *
 * As duas tabelas são a exponencial e o logaritmo na base 2, com o polinômio
 * 0x11D — o mesmo da norma. Com elas, multiplicar vira somar logaritmos, que é
 * o que torna o Reed-Solomon barato.
 */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** O polinômio gerador de `grau` símbolos de correção. */
function gerador(grau) {
  let poly = [1];
  for (let i = 0; i < grau; i++) {
    const proximo = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      proximo[j] ^= poly[j];
      proximo[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = proximo;
  }
  return poly;
}

/** Os símbolos de correção de um bloco de dados. */
function correcao(dados, quantos) {
  const g = gerador(quantos);
  const resto = new Uint8Array(quantos);
  for (const byte of dados) {
    const fator = byte ^ resto[0];
    resto.copyWithin(0, 1);
    resto[quantos - 1] = 0;
    if (fator !== 0) {
      for (let i = 0; i < quantos; i++) resto[i] ^= mul(g[i + 1], fator);
    }
  }
  return resto;
}

// ---------------------------------------------------------------- tabelas

/*
 * Os dois bits com que cada nível de correção é escrito no formato.
 *
 * A ordem NÃO é L, M, Q, H: a norma numera M=00, L=01, H=10, Q=11. Parece
 * descuido e é de propósito — e escrever na ordem "natural" faz o leitor do
 * celular achar que o quadrado tem outra correção, ler os blocos errados e não
 * decodificar nada. Foi o que este arquivo fazia antes de o teste apanhar.
 */
const NIVEIS = { M: 0, L: 1, H: 2, Q: 3 };

/*
 * Por versão e por nível: [símbolos de correção por bloco, blocos do grupo 1,
 * blocos do grupo 2]. Da tabela 9 da norma. Vai até a versão 20, que guarda
 * mais de 800 bytes no nível M — um link de pagamento cabe folgado.
 */
const BLOCOS = {
  1: { L: [7, 1, 0], M: [10, 1, 0], Q: [13, 1, 0], H: [17, 1, 0] },
  2: { L: [10, 1, 0], M: [16, 1, 0], Q: [22, 1, 0], H: [28, 1, 0] },
  3: { L: [15, 1, 0], M: [26, 1, 0], Q: [18, 2, 0], H: [22, 2, 0] },
  4: { L: [20, 1, 0], M: [18, 2, 0], Q: [26, 2, 0], H: [16, 4, 0] },
  5: { L: [26, 1, 0], M: [24, 2, 0], Q: [18, 2, 2], H: [22, 2, 2] },
  6: { L: [18, 2, 0], M: [16, 4, 0], Q: [24, 4, 0], H: [28, 4, 0] },
  7: { L: [20, 2, 0], M: [18, 4, 0], Q: [18, 2, 4], H: [26, 4, 1] },
  8: { L: [24, 2, 0], M: [22, 2, 2], Q: [22, 4, 2], H: [26, 4, 2] },
  9: { L: [30, 2, 0], M: [22, 3, 2], Q: [20, 4, 4], H: [24, 4, 4] },
  10: { L: [18, 2, 2], M: [26, 4, 1], Q: [24, 6, 2], H: [28, 6, 2] },
  11: { L: [20, 4, 0], M: [30, 1, 4], Q: [28, 4, 4], H: [24, 3, 8] },
  12: { L: [24, 2, 2], M: [22, 6, 2], Q: [26, 4, 6], H: [28, 7, 4] },
  13: { L: [26, 4, 0], M: [22, 8, 1], Q: [24, 8, 4], H: [22, 12, 4] },
  14: { L: [30, 3, 1], M: [24, 4, 5], Q: [20, 11, 5], H: [24, 11, 5] },
  15: { L: [22, 5, 1], M: [24, 5, 5], Q: [30, 5, 7], H: [24, 11, 7] },
  16: { L: [24, 5, 1], M: [28, 7, 3], Q: [24, 15, 2], H: [30, 3, 13] },
  17: { L: [28, 1, 5], M: [28, 10, 1], Q: [28, 1, 15], H: [28, 2, 17] },
  18: { L: [30, 5, 1], M: [26, 9, 4], Q: [28, 17, 1], H: [28, 2, 19] },
  19: { L: [28, 3, 4], M: [26, 3, 11], Q: [26, 17, 4], H: [26, 9, 16] },
  20: { L: [28, 3, 5], M: [26, 3, 13], Q: [30, 15, 5], H: [28, 15, 10] },
};

/** Quantos códigos (dados + correção) cabem em cada versão. */
const TOTAL_CODIGOS = [
  0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
];

/** Onde ficam os padrões de alinhamento, por versão. */
const ALINHAMENTO = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
  [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78],
  [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
];

// ---------------------------------------------------------------- montagem

/** Quantos bytes de DADOS cabem numa versão e nível. */
function capacidade(versao, nivel) {
  const [porBloco, g1, g2] = BLOCOS[versao][nivel];
  const blocos = g1 + g2;
  return TOTAL_CODIGOS[versao] - porBloco * blocos;
}

/** A menor versão que segura este texto. */
function versaoPara(bytes, nivel) {
  for (let versao = 1; versao <= 20; versao++) {
    // 4 bits de modo + 8 ou 16 bits de tamanho, arredondado para byte.
    const cabecalho = versao < 10 ? 2 : 3;
    if (bytes + cabecalho <= capacidade(versao, nivel)) return versao;
  }
  return 0;
}

/** O texto vira a fila de códigos de dados, já com o enchimento da norma. */
function codigosDeDados(bytes, versao, nivel) {
  const total = capacidade(versao, nivel);
  const bits = [];
  const empurrar = (valor, quantos) => {
    for (let i = quantos - 1; i >= 0; i--) bits.push((valor >> i) & 1);
  };

  empurrar(0b0100, 4); // modo byte
  empurrar(bytes.length, versao < 10 ? 8 : 16);
  for (const byte of bytes) empurrar(byte, 8);

  // Terminador de até quatro zeros, e o resto até fechar o byte.
  const folga = Math.min(4, total * 8 - bits.length);
  empurrar(0, folga);
  while (bits.length % 8) bits.push(0);

  const codigos = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codigos.push(byte);
  }
  // O enchimento alterna 0xEC e 0x11, como manda a norma.
  for (let i = 0; codigos.length < total; i++) codigos.push(i % 2 ? 0x11 : 0xec);
  return codigos;
}

/**
 * Os códigos finais: dados e correção intercalados bloco a bloco.
 *
 * A intercalação existe para o quadrado sobreviver a um borrão: um arranhão que
 * apague uma área contígua tira um pedaço de CADA bloco, e não um bloco inteiro
 * — e cada bloco aguenta perder um tanto.
 */
function codigosFinais(dados, versao, nivel) {
  const [porBloco, g1, g2] = BLOCOS[versao][nivel];
  const blocos = g1 + g2;
  const tamanho1 = Math.floor(dados.length / blocos);
  const tamanho2 = tamanho1 + 1;

  const partes = [];
  const ecs = [];
  let posicao = 0;
  for (let i = 0; i < blocos; i++) {
    const tamanho = i < g1 ? tamanho1 : tamanho2;
    const parte = dados.slice(posicao, posicao + tamanho);
    posicao += tamanho;
    partes.push(parte);
    ecs.push(correcao(parte, porBloco));
  }

  const saida = [];
  for (let i = 0; i < tamanho2; i++) {
    for (const parte of partes) if (i < parte.length) saida.push(parte[i]);
  }
  for (let i = 0; i < porBloco; i++) {
    for (const ec of ecs) saida.push(ec[i]);
  }
  return saida;
}

/** A grade com os padrões fixos (localizadores, tempo, alinhamento). */
function grade(versao) {
  const lado = versao * 4 + 17;
  const modulos = Array.from({ length: lado }, () => new Int8Array(lado).fill(-1));

  const localizador = (x, y) => {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px >= lado || py >= lado) continue;
        const borda = dx === -1 || dy === -1 || dx === 7 || dy === 7;
        const dentro = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        const anel = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        modulos[py][px] = borda ? 0 : dentro || anel ? 1 : 0;
      }
    }
  };
  localizador(0, 0);
  localizador(lado - 7, 0);
  localizador(0, lado - 7);

  // As duas linhas de tempo: preto e branco alternados, ligando os cantos.
  for (let i = 8; i < lado - 8; i++) {
    const cor = i % 2 === 0 ? 1 : 0;
    modulos[6][i] = cor;
    modulos[i][6] = cor;
  }

  // Alinhamento: onde não bater nos localizadores.
  const centros = ALINHAMENTO[versao];
  for (const cy of centros) {
    for (const cx of centros) {
      const perto = (x, y) => (x < 9 && y < 9) || (x > lado - 10 && y < 9) || (x < 9 && y > lado - 10);
      if (perto(cx, cy)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const anel = Math.abs(dx) === 2 || Math.abs(dy) === 2;
          modulos[cy + dy][cx + dx] = anel || (dx === 0 && dy === 0) ? 1 : 0;
        }
      }
    }
  }

  // O módulo escuro, que é sempre preto e nunca foi explicado por ninguém.
  modulos[lado - 8][8] = 1;

  // Espaço reservado da informação de formato (preenchido depois).
  for (let i = 0; i < 9; i++) {
    if (modulos[8][i] === -1) modulos[8][i] = 2;
    if (modulos[i][8] === -1) modulos[i][8] = 2;
  }
  for (let i = 0; i < 8; i++) {
    if (modulos[8][lado - 1 - i] === -1) modulos[8][lado - 1 - i] = 2;
    if (modulos[lado - 1 - i][8] === -1) modulos[lado - 1 - i][8] = 2;
  }

  // Da versão 7 em diante há um bloco de versão nos dois cantos.
  if (versao >= 7) {
    const bits = versaoBits(versao);
    for (let i = 0; i < 18; i++) {
      const bit = (bits >> i) & 1;
      const linha = Math.floor(i / 3);
      const coluna = i % 3;
      modulos[linha][lado - 11 + coluna] = bit;
      modulos[lado - 11 + coluna][linha] = bit;
    }
  }
  return modulos;
}

/** Os 18 bits do bloco de versão: 6 de dado e 12 de BCH(18,6). */
function versaoBits(versao) {
  let resto = versao;
  for (let i = 0; i < 12; i++) {
    resto = (resto << 1) ^ ((resto >> 11) * 0x1f25);
  }
  return ((versao << 12) | resto) >>> 0;
}

/** Os 15 bits do formato: nível, máscara, BCH e a máscara fixa da norma. */
function formatoBits(nivel, mascara) {
  const dado = (NIVEIS[nivel] << 3) | mascara;
  let resto = dado;
  for (let i = 0; i < 10; i++) {
    resto = (resto << 1) ^ ((resto >> 9) * 0x537);
  }
  return (((dado << 10) | resto) ^ 0x5412) >>> 0;
}

const MASCARAS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Escreve os códigos na grade, no zigue-zague de baixo para cima. */
function preencher(modulos, codigos, mascara) {
  const lado = modulos.length;
  let bit = 0;
  const proximo = () => {
    const byte = codigos[bit >> 3];
    const valor = byte === undefined ? 0 : (byte >> (7 - (bit & 7))) & 1;
    bit++;
    return valor;
  };

  let subindo = true;
  for (let coluna = lado - 1; coluna > 0; coluna -= 2) {
    // A coluna 6 é a linha de tempo: ela não entra no zigue-zague.
    if (coluna === 6) coluna--;
    for (let passo = 0; passo < lado; passo++) {
      const linha = subindo ? lado - 1 - passo : passo;
      for (let lateral = 0; lateral < 2; lateral++) {
        const x = coluna - lateral;
        if (modulos[linha][x] !== -1) continue;
        const valor = proximo();
        modulos[linha][x] = MASCARAS[mascara](x, linha) ? valor ^ 1 : valor;
      }
    }
    subindo = !subindo;
  }
}

/**
 * A informação de formato, escrita nas DUAS cópias em que ela mora.
 *
 * Duas porque ela é vital: sem ela o leitor não sabe o nível de correção nem a
 * máscara, e o quadrado inteiro vira ruído. Ficam longe uma da outra para um
 * dano local não levar as duas.
 *
 * ---- Onde cada bit vai, e por que isso deu errado ----
 *
 * A primeira cópia abraça o localizador de cima à esquerda: os bits 0..5 descem
 * pela COLUNA 8, e os 9..14 correm pela LINHA 8. A segunda se divide: os bits
 * 0..7 vão na linha 8 à direita, e os 8..14 na coluna 8 embaixo.
 *
 * Este arquivo trocou linha por coluna nas duas cópias, e o teste apanhou pelo
 * módulo escuro: a cópia de baixo, transposta, escrevia justamente em cima dele
 * (`lado-8, 8`) — o único módulo do quadrado que é preto por definição. Um erro
 * que nenhum olho pegaria e que nenhum celular perdoaria.
 */
function escreverFormato(modulos, nivel, mascara) {
  const lado = modulos.length;
  const bits = formatoBits(nivel, mascara);
  const pegar = (i) => (bits >> i) & 1;

  // Primeira cópia: em volta do localizador de cima à esquerda.
  for (let i = 0; i <= 5; i++) modulos[i][8] = pegar(i);
  modulos[7][8] = pegar(6);
  modulos[8][8] = pegar(7);
  modulos[8][7] = pegar(8);
  for (let i = 9; i <= 14; i++) modulos[8][14 - i] = pegar(i);

  // Segunda cópia: linha 8 à direita, coluna 8 embaixo. O módulo escuro fica em
  // `lado-8` e não é tocado — a coluna começa em `lado-7`.
  for (let i = 0; i <= 7; i++) modulos[8][lado - 1 - i] = pegar(i);
  for (let i = 8; i <= 14; i++) modulos[lado - 15 + i][8] = pegar(i);
}

/**
 * A nota de feiura de um desenho, pela conta da norma: quanto MENOR, melhor.
 *
 * As quatro penalidades existem porque um quadrado com faixas longas, blocos
 * grandes ou trechos parecidos com o localizador confunde o leitor do celular.
 * A máscara escolhida é a de menor nota.
 */
function penalidade(modulos) {
  const lado = modulos.length;
  let total = 0;

  // 1: faixas de cinco ou mais na mesma cor.
  for (let i = 0; i < lado; i++) {
    for (const horizontal of [true, false]) {
      let cor = -1;
      let corrida = 0;
      for (let j = 0; j < lado; j++) {
        const valor = horizontal ? modulos[i][j] : modulos[j][i];
        if (valor === cor) {
          corrida++;
          if (corrida === 5) total += 3;
          else if (corrida > 5) total += 1;
        } else {
          cor = valor;
          corrida = 1;
        }
      }
    }
  }

  // 2: blocos 2x2 da mesma cor.
  for (let y = 0; y < lado - 1; y++) {
    for (let x = 0; x < lado - 1; x++) {
      const c = modulos[y][x];
      if (c === modulos[y][x + 1] && c === modulos[y + 1][x] && c === modulos[y + 1][x + 1]) total += 3;
    }
  }

  // 3: o padrão 1011101 com quatro claros de um lado — parece localizador.
  const alvo = [1, 0, 1, 1, 1, 0, 1];
  for (let i = 0; i < lado; i++) {
    for (let j = 0; j < lado - 6; j++) {
      for (const horizontal of [true, false]) {
        const em = (k) => (horizontal ? modulos[i][j + k] : modulos[j + k][i]);
        if (!alvo.every((v, k) => em(k) === v)) continue;
        const antes = [1, 2, 3, 4].every((k) => j - k >= 0 && (horizontal ? modulos[i][j - k] : modulos[j - k][i]) === 0);
        const depois = [7, 8, 9, 10].every(
          (k) => j + k < lado && (horizontal ? modulos[i][j + k] : modulos[j + k][i]) === 0
        );
        if (antes || depois) total += 40;
      }
    }
  }

  // 4: desequilíbrio entre claro e escuro.
  let escuros = 0;
  for (const linha of modulos) for (const v of linha) if (v === 1) escuros++;
  const parte = (escuros * 100) / (lado * lado);
  total += Math.floor(Math.abs(parte - 50) / 5) * 10;
  return total;
}

/**
 * O QR de um texto: devolve `{ lado, modulos }`, com `modulos[y][x]` valendo 1
 * onde o quadradinho é escuro.
 *
 * `nivel` é a correção de erro (L, M, Q, H). M é o padrão e é o que os leitores
 * esperam: aguenta ~15% do quadrado danificado sem perder o conteúdo.
 */
export function qrcode(texto, nivel = 'M') {
  // `=== undefined` e nao `!`: o nivel M vale ZERO na numeracao da norma, e um
  // teste de veracidade recusaria justamente o nivel padrao.
  if (NIVEIS[nivel] === undefined) throw new Error(`nível de correção inválido: ${nivel}`);
  const bytes = new TextEncoder().encode(String(texto));
  const versao = versaoPara(bytes.length, nivel);
  if (!versao) throw new Error('texto grande demais para um QR de versão 20');

  const codigos = codigosFinais(codigosDeDados(bytes, versao, nivel), versao, nivel);

  // As oito máscaras são desenhadas e a menos feia ganha, como manda a norma.
  let melhor = null;
  for (let mascara = 0; mascara < 8; mascara++) {
    const modulos = grade(versao);
    preencher(modulos, codigos, mascara);
    escreverFormato(modulos, nivel, mascara);
    const nota = penalidade(modulos);
    if (!melhor || nota < melhor.nota) melhor = { nota, modulos, mascara };
  }

  return {
    versao,
    nivel,
    mascara: melhor.mascara,
    lado: melhor.modulos.length,
    modulos: melhor.modulos.map((linha) => Array.from(linha, (v) => (v === 1 ? 1 : 0))),
  };
}

/*
 * Os números por trás do desenho, para o teste conferir sem redesenhar nada.
 *
 * `grade` e `MASCARAS` estão aqui porque o teste LÊ o quadrado de volta: ele
 * refaz a grade para saber quais módulos são de dado, tira a máscara e remonta
 * os códigos. Comparar isso com o que a norma manda gravar é o que prova que a
 * varredura em zigue-zague, a máscara e a informação de formato estão certas —
 * as três coisas que um olho não confere e um celular não perdoa.
 */
export const _interno = {
  correcao,
  codigosDeDados,
  codigosFinais,
  versaoPara,
  capacidade,
  formatoBits,
  gerador,
  grade,
  MASCARAS,
};
