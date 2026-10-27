# Auditoria do Famosodle

Revisão completa feita em 26/10/2026: leitura de todo o código, correções, conferência dos dados e das fotos, otimização, auditoria de segurança, testes automáticos e uma segunda revisão de segurança independente. As linhas citadas são da versão original, anterior a esta revisão. Gravidade: **alta** (quebra o jogo, vaza a resposta ou expõe o jogador), **média** (atrapalha parte dos jogadores ou enfraquece a segurança), **baixa** (refinamento).

## Resumo

- Lighthouse no celular (mediana de 3 rodadas): desempenho de 85 para 99, boas práticas de 96 para 100, acessibilidade e SEO continuam em 100. O deslocamento de layout (CLS) caiu de 0,267 para zero.
- O modo Foto ficou determinístico: a resposta é igual para todo mundo e não depende mais da Wikipedia.
- O crédito da foto não entrega mais a resposta no modo Foto.
- `localStorage` corrompido, desligado ou cheio não quebra mais a página.
- CSP sem `'unsafe-inline'` e sem `data:`; `Referrer-Policy: no-referrer`; nada obsoleto que gere erro no console.
- Revisão de segurança independente: nada de gravidade alta ou média; 13 achados de gravidade baixa ou informativa corrigidos e 4 aceitos ou não aplicados, com justificativa.
- 374 fotos baixadas e conferidas, servidas pelo próprio site, com autor e licença.
- 14 correções nos dados (títulos da Wikipedia, datas aproximadas, frases mal atribuídas, uma dica de político).
- 26 testes automáticos com o Playwright.

## Lighthouse

Lighthouse 13.5.0, perfil de celular padrão (rede e processador simulados), servidor local com os mesmos cabeçalhos do `vercel.json` e compressão gzip, mediana de 3 rodadas. Comando: `npm run lighthouse`.

| Métrica | Antes | Depois |
|---|---|---|
| Desempenho | 85 | 99 |
| Acessibilidade | 100 | 100 |
| Boas práticas | 96 | 100 |
| SEO | 100 | 100 |
| First Contentful Paint | 1,5 s | 1,07 s |
| Largest Contentful Paint | 1,95 s | 2,07 s |
| Total Blocking Time | 51 ms | 52 ms |
| Cumulative Layout Shift | 0,267 | 0 |

Na primeira visita o maior elemento da tela é o texto do diálogo "Como jogar", que abre sozinho, por isso o LCP depende do script e ficou parecido. Antes, o diálogo abria 400 ms depois do script; agora abre na hora. Em visitas seguintes o diálogo não aparece.

## Bugs

| Item | Onde | Gravidade | Situação |
|---|---|---|---|
| A resposta do modo Foto dependia da rede (primeira de 25 candidatas com foto livre); jogadores diferentes podiam ter respostas diferentes. | app.js 148-149, 451-469 | alta | Corrigido. O build marca com `ph: 1` quem tem foto no pacote `fotos/` e o Foto sorteia só entre essas figuras. A resposta é a primeira candidata, como nos outros modos. |
| O crédito da foto entregava a resposta no modo Foto (link com o nome do arquivo e autor que às vezes é a própria pessoa ou um parente). | app.js 443-448, 611 | alta | Corrigido. Durante a partida aparece só a licença e o botão "ver autor e fonte (pode entregar a resposta)". O crédito completo aparece ao acertar ou ao clicar. |
| `localStorage` corrompido derrubava a página (valor que não é objeto, `guesses` que não é lista, ids como `constructor`). | app.js 12, 124, 137, 146 | alta | Corrigido. `readState()` valida tudo, ids precisam ter o formato `p000` e existir, índices sem protótipo. Testado com 8 valores corrompidos. |
| No modo Foto, cada renderização buscava as fotos de 25 candidatas só para escrever "a figura de ontem foi". | app.js 651-653 | média | Corrigido junto com o sorteio determinístico. |
| O ano atual era calculado uma vez; com a página aberta na virada do ano, a idade dos vivos ficava errada. | app.js 51 | média | Corrigido: recalculado na virada do dia. |
| Depois de acertar, o foco caía no começo da página. | app.js 508 | média | Corrigido: o foco vai para o nome da figura no resultado. |
| O link de crédito dizia "Wikimedia Commons" mas apontava para a Wikipedia. | app.js 445-447 | média | Corrigido: aponta para a página do arquivo informada pela API (Commons ou Wikipedia) e o texto do link acompanha. |
| Encontrado durante a revisão: o cartão de resultado espera a animação (1 s) e, se o jogador trocasse de região nesse meio tempo, aparecia na região errada. | app.js 665-666 | média | Corrigido: o resultado só aparece se o modo ainda for o mesmo. |
| Encontrado durante a revisão: a escolha de uma sugestão só ouvia `mousedown`; leitores de tela que mandam só `click` não conseguiam escolher. | app.js 528 | média | Corrigido: a escolha acontece no `click` e o `mousedown` só segura o foco no campo. |
| A idade ficava um ano maior para quem nasceu antes de Cristo e morreu depois. | app.js 74 | baixa | Corrigido (`span()`); nenhuma figura atual cruza o ano 1. |
| Sorteio do treino enviesado (`sort(() => Math.random() - .5)`). | app.js 699 | baixa | Corrigido: Fisher-Yates. |
| A busca não priorizava o nome exato. | app.js 490-498, 515 | baixa | Corrigido: correspondência exata em primeiro lugar. |
| "Está vivo(a)" sem concordância. | app.js 105 | baixa | Corrigido. |
| Duas abas abertas sobrescreviam o progresso uma da outra. | app.js 153-157 | baixa | Corrigido: evento `storage`. |
| Pedidos à Wikipedia sem tempo limite. | app.js 207-211 | baixa | Corrigido: 10 segundos. |
| O texto de compartilhar não tinha o endereço do jogo. | app.js 672-681 | baixa | Corrigido. |
| Encontrado durante a revisão: ao abrir uma dica, o botão some e o foco se perdia. | app.js 548-553 | baixa | Corrigido: o foco vai para a dica aberta, que também é anunciada. |
| Apontado depois da publicação: no Windows as bandeiras apareciam como as letras do país ("BR"), porque o sistema não desenha emojis de bandeira. | app.js `flag()` | média | Corrigido: as bandeiras viraram imagens PNG de 120 px tiradas do Wikimedia Commons (todas em domínio público), baixadas por `npm run baixar-bandeiras` e servidas pelo próprio site em `bandeiras/` (84 KB no total, cada uma só carrega quando aparece). O arquivo único leva as bandeiras embutidas. O crédito de cada uma fica no diálogo "Sobre as imagens". Se alguma imagem faltar, o jogo volta ao emoji. |

## Segurança

| Item | Onde | Gravidade | Situação |
|---|---|---|---|
| CSP com `style-src 'unsafe-inline'`. | empacotar.js 41 e atributos `style` | média | Corrigido. CSS em `assets/famosodle.<hash>.css`, nenhum atributo `style` no HTML nem no JavaScript, atrasos da animação por `:nth-child`, desfoque pelo CSSOM. |
| Chave `__proto__` em `creditos.json` trocava o protótipo do objeto de saída; o cache de fotos tinha o mesmo padrão. | app.js 188, 224-226 | média | Corrigido e testado com um `creditos.json` adulterado. |
| `img-src` com `data:`. | empacotar.js 42 | baixa | Corrigido: setas e sinais viraram SVG no HTML e o favicon virou arquivo. |
| `thumb.wikimedia.org` parecia sobrar no CSP. | empacotar.js 42 | baixa | **Mantido.** A suspeita estava errada: a Wikimedia passou a servir as miniaturas por `thumb.wikimedia.org`, como mostrou o download das fotos. |
| `Permissions-Policy` com `interest-cohort` obsoleto. | empacotar.js 56 | baixa | Corrigido. |
| `Referrer-Policy` enviava a origem para a Wikipedia. | empacotar.js 54 | baixa | Corrigido: `no-referrer`. |
| Dados entravam no `app.js` sem escapar `<`. | empacotar.js 31, 35 | baixa | Corrigido: `<` vira escape, e o build verifica `</script` e `<!--`. |
| Imagens da Wikimedia sem `crossOrigin`. | app.js 294-296, 607, 641 | baixa | Corrigido: `crossOrigin = "anonymous"` e `referrerPolicy = "no-referrer"`. |
| `textOnly` com expressão regular quadrática sobre texto sem limite. | app.js 202 | baixa | Corrigido: o texto é cortado antes. |
| Bandeira sem `esc()`. | app.js 99, 479, 587-588, 630, 650 | baixa | Corrigido. |
| Fontes com cache `immutable` sem hash no nome. | empacotar.js 58 | baixa | Corrigido: nomes com hash. |
| O `vercel.json` da raiz é lido pela Vercel antes do build. | empacotar.js 61-63 | baixa | O build avisa quando ele muda; documentado no CLAUDE.md e no DEPLOY.md. |
| Dependências: `npm audit` sem vulnerabilidades; versões exatas; o único script de instalação é o `postinstall` do esbuild, que só confere o binário da plataforma. | package.json | ok | Conferido. O script fica negado em `allowScripts` (o esbuild funciona sem ele, como mostram os testes), e `npm ci` termina sem avisos. |
| Segredos, dados pessoais e caminhos do computador no repositório e no build. | todos os arquivos | ok | Nenhum encontrado. |
| As respostas de cada dia estão no código do navegador. | app.js | aceito | Jogo casual; documentado. |

### Revisão independente

Uma segunda revisão de segurança foi feita por um agente sem nenhum contexto deste trabalho, só com o checklist, lendo o build final e as fontes, sem alterar arquivos. Ele também subiu o servidor local e tentou caminhos maliciosos. Não encontrou nada de gravidade alta nem média. Os achados de gravidade baixa e informativa, e o que foi feito com cada um:

| Achado | Gravidade | Situação |
|---|---|---|
| Cache `immutable` de um ano também num 404 dentro de `/assets/`, porque a regra casava qualquer caminho. | baixa | Corrigido: a regra só casa com nomes com hash (`nome.<10 hex>.js`, `.css`, `.woff` ou `.woff2`). O padrão foi validado com a biblioteca de rotas da própria Vercel (`@vercel/routing-utils`), e o teste confere que `/assets/nao-existe.js` volta sem `immutable`. |
| Qualquer arquivo das pastas `fotos/fotos-N` ia para o site. | baixa | Corrigido: o empacotar copia só `pXXX.jpg` e o `creditos.json` da `fotos-1`, ignora atalhos e avisa o que deixou de fora. |
| Arquivo único e cópia offline sem CSP (abertos por `file://`, não recebem cabeçalhos). | baixa | Corrigido: o arquivo único leva o CSP numa `<meta>`, que vai junto para a cópia offline. Ela precisa de `'unsafe-inline'` para o script e o estilo embutidos, mas bloqueia scripts externos e limita imagens e conexões à Wikipedia e à Wikimedia. Os testes geram o pacote e a cópia com a meta ativa, sem nenhuma violação. |
| Créditos vindos da Wikipedia mantinham caracteres de controle bidirecional, que podem inverter o texto na tela. | informativa | Corrigido: `textOnly()` remove os caracteres invisíveis e de controle; o `baixar-fotos` também passou a remover U+2060 a U+206F e U+FEFF. O teste simula um autor com esses caracteres. |
| A data do cache de fotos aceitava `Infinity` e datas futuras, e a entrada nunca vencia. | informativa | Corrigido: só vale data finita e no passado. |
| `MODE`, `POOL`, `ORDER`, `GUESSABLE` e `P` eram objetos com protótipo. | informativa | Corrigido: objetos sem protótipo, como no resto do código. |
| O tipo de `thumbnail.source` não era conferido; um valor estranho derrubava o lote de até 50 fotos. | informativa | Corrigido. |
| As fotos embutidas na cópia offline não eram revalidadas ao abrir. | informativa | Corrigido: só JPEG em `data:`, com os mesmos limites de tamanho e o mesmo filtro de página de arquivo das outras fontes. |
| Os botões de gerar fotos recebiam o evento de clique mesmo escondidos no site. | informativa | Corrigido: o evento só é ligado quando os botões aparecem. |
| Servidor local: `/index.html.`, `/INDEX.HTML` e `/index.html::$DATA` serviam o mesmo arquivo por outro nome, e atalhos não eram resolvidos. | informativa | Corrigido: o caminho real precisa ser idêntico ao pedido; `:`, barra invertida e ponto ou espaço no fim dão 404. Testado. O servidor só escuta em 127.0.0.1. |
| `baixar-fotos`: sem limite de tamanho no download, sem conferir o endereço final depois de um redirecionamento e sem limite de dimensões no PNG. | informativa | Corrigido: até 5 MB, endereço final conferido com o filtro da Wikimedia e PNG com no máximo 4000 px de lado. O comentário do `textoPuro` avisa que a saída é texto e precisa de escape. |
| `verificar-dados`: uma data do Wikidata em formato inesperado derrubava o script. | informativa | Corrigido: vira data desconhecida. |
| Sem `Cross-Origin-Resource-Policy`. | informativa | Corrigido: `same-origin` em `/assets/` e nas pastas de fotos. `og.png` e os ícones ficam de fora, porque outros sites mostram essas imagens. |
| `medir-lighthouse` roda o Lighthouse por `npx` e monta o comando como texto. | informativa | Aceito. Pôr o Lighthouse nas dependências traria centenas de pacotes para todo `npm ci`, inclusive o da Vercel. A versão é fixa, o comando só leva valores fixos e caminhos do próprio projeto, e o script só roda quando alguém pede. |
| `vercel.json` aparece como arquivo público em `/vercel.json`. | informativa | Aceito: só mostra os cabeçalhos, que já vão em toda resposta. A cópia em `dist/famosodle` é necessária para quem publica só a pasta. |
| `PRISTINE` copia o DOM, e não o arquivo; algo que uma extensão do navegador injetar antes do script iria para a cópia offline. | informativa | Aceito: a captura acontece antes de qualquer dado do jogador entrar na página. |
| Trusted Types (`require-trusted-types-for 'script'`). | informativa | Não aplicado: todos os `innerHTML` já passam por `esc()`, e o ganho seria pequeno perto da mudança. |
| HSTS com `includeSubDomains` por dois anos. | informativa | Certo para `famosodle.vercel.app`. Se um dia houver domínio próprio, confirme antes que todos os subdomínios têm HTTPS. |

Três apontamentos não se confirmaram: o agente disse que o `.gitignore` não ignorava os relatórios de teste e do Lighthouse, que o `DEPLOY.md` não existia e que o manifesto usava `"any maskable"` num ícone só. No projeto o `.gitignore` ignora `test-results/`, `playwright-report/`, `lighthouse/` e `fotos/.baixando/`, o `DEPLOY.md` existe e o manifesto tem um ícone `maskable` separado.

Conferido por ele e sem problema: os 13 `innerHTML`, um a um; a validação do `localStorage` e do `creditos.json` (os 374 registros reais passam); os quatro `fetch`, todos com `credentials: "omit"`; a ausência de `eval`, de script inline e de atributos de evento; o lockfile com integridade em todos os pacotes; a ausência de segredos, e-mails e caminhos do computador; e as tentativas de sair da pasta no servidor local (`..%2F`, `%2e%2e`, `..%5C`, `%00`), todas com 404.

## Desempenho

| Item | Situação |
|---|---|
| CLS de 0,267 causado pela troca de fontes (alta). | Corrigido: `preload` das três fontes do primeiro desenho e fontes de reserva com `size-adjust` medido no Chrome (Arial 108,2% e 103% para a Open Sauce, Times New Roman 72,3% para a Instrument Serif). Depois disso o deslocamento que sobrou vinha do JavaScript preenchendo regiões, dicas e cabeçalho do tabuleiro; agora o HTML já traz esses elementos e reserva altura para as linhas dinâmicas. CLS zero. |
| HTML, CSS e JavaScript sem minificação (média). | Corrigido: esbuild 0.28.2 no build do site. `index.html` 4,5 KB, CSS 5 KB e JS 39 KB com gzip. O arquivo único continua legível. |
| `creditos.json` baixado em toda visita (média). | Corrigido: só quando a primeira foto é pedida. O 404 dele no console sumiu. |
| Sem hash nos nomes (média). | Corrigido: `assets/` com hash e cache `immutable`; fotos com um dia de cache, `stale-while-revalidate` e hash na URL. |
| Miniaturas de 640 px (baixa). | Corrigido: 500 px, tamanho padrão da Wikimedia. |
| Lista de palpites possíveis recriada a cada tecla (baixa). | Corrigido. |
| Miniaturas dos palpites. | `loading="lazy"`, `decoding="async"`, quadro de tamanho fixo (sem deslocamento) e transição de opacidade. |

## Acessibilidade

| Item | Situação |
|---|---|
| Resultado do palpite não anunciado (média). | Corrigido: região `aria-live` com o resumo de cada coluna, as dicas liberadas e o acerto. |
| Tabuleiro sem estrutura para leitores de tela (média). | Corrigido: papéis de tabela, cabeçalhos de coluna e texto escondido com o estado ("igual", "perto, a figura secreta nasceu depois"...). |
| Cor como único sinal (média). | Corrigido: sinal no canto de cada quadro (✓, ≈, ✕), repetido na legenda e na ajuda. |
| Contorno de foco com contraste 2,1:1 (média). | Corrigido: preto nas áreas claras e dourado nas escuras, 3 px. |
| Áreas de toque menores que 44 px (média). | Corrigido e testado em 360, 390 e 430 px. |
| Campos de busca sem rótulo (média). | Corrigido: rótulo visualmente escondido. |
| `aria-label` em elementos genéricos (baixa). | Corrigido. |
| Mensagem vazia dentro do `listbox` sem papel (baixa). | Corrigido. |
| Abas sem setas (baixa). | Corrigido: setas, Home e End com `tabindex` móvel. |
| Foco ao fechar diálogos (baixa). | Corrigido: volta para quem abriu. |
| `--muted` sobre `--sand` com 4,0:1 (baixa). | Corrigido: `--muted` passou de `#6e6253` para `#655a4b`. |
| Opacidade em `.tile small` (baixa). | Corrigido. |
| Rolagem suave ignorando `prefers-reduced-motion` (baixa). | Corrigido. |
| Aviso flutuante pouco anunciado (baixa). | Corrigido: o texto também vai para a região `aria-live`. |
| A foto do modo Foto não pode entregar a resposta pelo texto alternativo. | Conferido: o texto é "Retrato borrado da figura secreta" e o endereço da foto é `fotos-N/pXXX.jpg`, sem o nome. |

## Celular

| Item | Situação |
|---|---|
| Lista de sugestões atrás do teclado virtual (média). | Corrigido: a lista se ajusta ao espaço visível (`visualViewport`) e a página sobe quando falta espaço. |
| Coluna da pessoa sumia ao rolar o tabuleiro (baixa). | Corrigido: coluna fixa. |
| Título em 360 px. | O tamanho mínimo passou de 56 para 48 px; testado sem corte e sem rolagem lateral em 360, 390 e 430 px. |

## Conteúdo e dados

### Como foi conferido

- `npm run verificar-fotos` (novo) consultou os 375 títulos na Wikipedia: 5 redirecionavam, nenhum artigo faltando, nenhuma desambiguação, 2 artigos com imagem principal que não é livre (Eddie Mabo e Darcy Ribeiro).
- `npm run verificar-dados` (novo) comparou nascimento, morte e gênero com o Wikidata: só 2 diferenças, as duas com os nossos dados certos (Castelo Branco nasceu em 1897, como diz a Wikipedia; Amelia Earhart desapareceu em 1937, e o Wikidata usa 1939, ano da declaração de morte). Ninguém marcado como vivo aparece como morto no Wikidata nesta data.
- Revisão manual de todas as 61 frases e das dicas de políticos.
- `npm run baixar-fotos` (novo) baixou 374 fotos livres (23,5 MB, 13 PNG convertidos para JPEG). Darcy Ribeiro ganhou um retrato livre do Commons (`File:Darcy Ribeiro.jpg`, CC BY-SA 3.0) pela lista de alternativas. Eddie Mabo não tem retrato livre e fica sem foto e fora do modo Foto.
- O build ganhou novas validações: título repetido, apelido para figura que não existe, apelido igual ao de outra figura, dica vazia, frase longa, ano em formato errado ou no futuro, espaço sobrando e aviso de vivos com mais de 105 anos.

### Mudanças nos dados

Todas feitas na própria linha da figura, sem mover nem apagar linhas. Os ids continuam iguais (conferido contra o `data.json` original).

| Id | Figura | Campo | Antes | Depois | Motivo |
|---|---|---|---|---|---|
| p022 | Sócrates | frase | Só sei que nada sei. | Uma vida sem exame não vale a pena ser vivida. | A frase antiga é uma paráfrase que não aparece nos textos de Platão; a nova está na Apologia (38a). |
| p054 | Steve Jobs | frase | Continuem famintos, continuem tolos. | A única maneira de fazer um ótimo trabalho é amar o que você faz. | A antiga é uma citação do Whole Earth Catalog que Jobs repetiu; a nova é dele, no mesmo discurso de Stanford (2005). |
| p070 | Zumbi dos Palmares | nascimento | 1655 | ~1655 | Ano tradicional, sem registro preciso. |
| p099 | Wangari Maathai | título | Wangari_Maathai | Wangarĩ_Maathai | Redirecionamento. |
| p126 | Kim Jong-un | nascimento | 1984 | ~1984 | Ano incerto (1982, 1983 ou 1984 conforme a fonte). |
| p150 | Don Bradman | título | Donald_Bradman | Don_Bradman | Redirecionamento. |
| p151 | Steve Irwin | frase | Crikey! | (vazia) | Interjeição em inglês, sem tradução possível; a figura sai do modo Frase. |
| p175 | Carlos Lacerda | dica 2 | Primeiro governador do estado da Guanabara | Primeiro governador eleito do estado da Guanabara | O primeiro governador foi provisório (1960); Lacerda foi o primeiro eleito. |
| p177 | Rui Barbosa | título | Rui_Barbosa | Ruy_Barbosa | Redirecionamento. |
| p180 | José Bonifácio | título | José_Bonifácio_de_Andrada | José_Bonifácio_de_Andrada_e_Silva | Redirecionamento. |
| p202 | Irmã Dulce | título | Irmã_Dulce | Dulce_de_Souza_Lopes_Pontes | Redirecionamento. |
| p219 | Frederick Douglass | nascimento | 1818 | ~1818 | Data estimada pelo próprio Douglass. |
| p251 | José Mujica | frase | Pobres não são os que têm pouco, mas os que precisam de muito. | Não sou pobre, sou sóbrio, de bagagem leve. | A antiga é de Sêneca, citada por Mujica na Rio+20; a nova é dele. |
| p252 | Nayib Bukele | dica 2 | Presidente de El Salvador conhecido pela política dura de segurança | Eleito presidente de El Salvador em 2019 e reeleito em 2024 | A dica antiga tinha juízo de valor; a nova é só fato (cargo e período). |

Com isso o modo Frase tem 60 figuras (eram 61).

### Conferido e mantido

- Frases de atribuição consagrada, mesmo sendo paráfrases ou slogans: Napoleão ("Impossível não é uma palavra francesa", carta de 1813), Mark Twain ("A notícia da minha morte foi um exagero"), Charles de Gaulle (os 246 queijos, registrado em 1962), Michael Jordan (falada por ele num comercial de 1997), Donald Trump (slogan de campanha) e Margaret Thatcher (fala escrita por um assessor, dita por ela).
- Bruce Lee e Jackie Chan continuam com país CN (Hong Kong é parte da China e não existe como opção separada no jogo).
- As outras dicas de políticos são factuais (cargo, período, feito) para figuras de todos os lados.

## Publicação

| Item | Situação |
|---|---|
| O projeto não era um repositório git e o git não está instalado neste computador (alta). | Não foi possível criar o repositório nem os commits. O DEPLOY.md explica como instalar o Git para Windows e publicar pelo VS Code. |
| Faltavam `robots.txt`, `sitemap.xml`, página 404, `og:image`, URL canônica, `og:url`, ícone para iPhone e manifesto (média). | Corrigido: tudo em `src/estaticos/` e `src/404.html`, com o endereço `https://famosodle.vercel.app/` numa constante do build. A imagem de compartilhar (1200x630) é gerada por `npm run imagens`, sem nenhuma foto ou obra protegida. |
| `dist/famosodle` não era limpo entre builds (baixa). | Corrigido. |
| `.gitignore` (baixa). | Corrigido: ignora relatórios de teste e do Lighthouse; a pasta `fotos/` continua no git. |

## O que ficou de fora ou tem limite

- Sem git neste computador, não houve commits por fase. O backup do estado original ficou fora do projeto.
- O Lighthouse foi medido no servidor local com rede simulada. Na Vercel os números podem variar um pouco; o DEPLOY.md mostra como conferir depois do deploy.
- Os testes rodam só no Chrome. Firefox e Safari não foram testados automaticamente.
- A conferência dos fatos vale para 27/10/2026. Rode `npm run verificar-dados` antes de novas levas de mudanças.

## Atualização de 27/10/2026: níveis e 150 figuras

- 150 figuras novas no fim de `dados/figuras-extra.txt` (4 de política, 46 do futebol, 19 da Fórmula 1, 22 do basquete e 59 do cinema), ids p376 a p525. Nenhuma linha antiga mudou de lugar. Com elas entram 8 países (Benin, Eslovênia, Finlândia, Malásia, Marrocos, Mônaco, Noruega e Sérvia), com bandeira do Commons em domínio público.
- Quatro níveis de dificuldade em todos os modos, a partir de `dados/fama.txt` (525 figuras) e das visitas na Wikipedia em português (`dados/visitas.json`). Regras e tamanhos das faixas no CLAUDE.md.
- O progresso passou para `famosodle:v2`, com partidas e estatísticas por nível. As estatísticas antigas entram no total de cada modo; o `famosodle:v1` fica guardado como estava.

### Conferência das figuras novas

| Item | Situação |
|---|---|
| Datas de nascimento e morte e gênero das 150 figuras. | Conferidos com o Wikidata: tudo bate, inclusive a morte do Oscar Schmidt em 2026 e quem está vivo. |
| Título da Wikipedia do Luis Suárez apontava para uma página de desambiguação. | Corrigido para `Luis_Suárez_(Uruguayan_footballer)`. |
| Dica da Angelina Jolie dizia que ela é enviada especial da ONU para refugiados. | Corrigido: ela deixou o cargo em 2022. A dica agora diz que foi enviada especial até 2022. |
| Dicas, feitos e frases das outras figuras. | Conferidos um a um; sem mudanças. As frases de atores são falas curtas e conhecidas de filmes, traduzidas; nenhuma letra de música. |
| País do Josef Stálin (RU), nascido na Geórgia. | Mantido: segue a regra do "país mais associado", como Trotsky (RU) e Golda Meir (IL). |
| Fotos das 150 figuras. | Todas com licença livre e crédito, conferidas uma a uma numa folha de contato. O artigo do Lee Jung-jae não tem imagem principal: entrou um retrato livre do Commons (`ALTERNATIVAS`). A imagem do Cantinflas é WebP: o `baixar-fotos` passou a converter WebP para JPEG pelo Chrome. Pacote: 524 fotos, cerca de 33 MB; só o Eddie Mabo segue sem foto. |
| O `baixar-fotos` e o `baixar-bandeiras` refaziam o pacote inteiro. | Agora só baixam o que falta; as 374 fotos e as 75 bandeiras antigas ficaram com os mesmos bytes. |

### Problemas encontrados durante a atualização

| Item | Gravidade | Situação |
|---|---|---|
| Quem trocava de região (ou agora de nível) logo depois de acertar, antes do cartão do resultado aparecer, perdia o foco ao voltar: o cartão aparecia animado e puxava o foco. | baixa | Corrigido: trocar de aba, região ou nível esquece o momento do acerto. Teste novo. |
| "A figura de ontem" mostraria, no dia de uma mudança nas figuras, uma resposta calculada com os dados novos, que ninguém jogou. | média | Corrigido: o build grava o dia em que foi feito (`BUILT`) e a linha só aparece quando os dados já valiam ontem. |
| Um `fama.txt` ou lista de figuras salvo com BOM (o Bloco de Notas às vezes faz isso) quebraria o build. | baixa | Corrigido: o `gerar-dados` ignora o BOM. |
| Com o nome do nível, a linha "Ficha nº · modo · nível" e a data deixaram de caber numa linha em celulares de 412 px: o texto quebrava quando chegava pelo JavaScript e empurrava a página (CLS 0,006). | baixa | Corrigido: em telas estreitas a data fica sempre na segunda linha, com as duas linhas reservadas. CLS de volta a zero. |

Lighthouse depois da atualização (mesmo método, mediana de 3 rodadas): desempenho 99, acessibilidade 100, boas práticas 100, SEO 100, CLS 0. O JavaScript passou de 39 KB para 51 KB com gzip, quase tudo por causa dos dados das 150 figuras e das faixas de nível.
