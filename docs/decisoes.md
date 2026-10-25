# Registro de decisões

Cada decisão tem o porquê, para não ser refeita sem motivo.

| # | Data | Decisão | Por quê |
|---|---|---|---|
| D1 | 24/10/2026 | O LAB V2 é um projeto novo, em contas pessoais. O CRM e o LAB da Amicta não são tocados | A Amicta é a operação piloto; o V2 é a ferramenta de carreira do Bruno, independente de qualquer empresa |
| D2 | 24/10/2026 | Escopo: receita (demanda, conversão, retenção, expansão) e a eficiência financeira dela | O Bruno é profissional de receita; engenharia, obras, compras e operação de entrega ficam fora |
| D3 | 24/10/2026 | Sem contas a pagar e sem caixa da empresa. Com precificação completa e recebimento por venda e por cliente | Recebimento basta para medir venda boa e ruim, retenção e LTV sem virar ERP |
| D4 | 24/10/2026 | Sem IA: sistema determinístico que alerta | A IA tiraria o aprendizado; o Bruno quer entender o porquê de cada número |
| D5 | 24/10/2026 | Usuário único (o Bruno). O time é registrado como pessoas, sem login | É o "Jarvis" do Bruno; simplifica segurança e telas |
| D6 | 24/10/2026 | Funil borboleta com papéis canônicos de etapa; o que é setorial fica em packs JSON com herança | O mesmo motor precisa servir à solar B2C e à licitação B2B; criar operação nova tem de ser fácil |
| D7 | 24/10/2026 | Pessoas e entidades por id, com vínculo para o id da fonte | Na V1, identidade por nome quebrava o histórico ao renomear alguém |
| D8 | 24/10/2026 | Tudo o que entra é guardado bruto antes de ser traduzido | Reprocessar depois de corrigir um mapeamento; auditar; não depender dos 30 dias de eventos do CRM |
| D9 | 24/10/2026 | Histórico de etapas e política de preço só aceitam acréscimo | Coortes e "venda avaliada pela regra do dia do fechamento" exigem passado imutável |
| D10 | 24/10/2026 | Conectores não gravam telefone, e-mail, endereço nem o texto das notas | Minimizar dado pessoal de clientes de terceiros (LGPD) |
| D11 | 24/10/2026 | Stack: TypeScript, Cloudflare Workers e Supabase Postgres; testes contra um Postgres real com as opções de conexão de produção | É a stack que o Bruno já usa; o teste com as opções reais pegou um bug que só apareceria em produção |
| D12 | 24/10/2026 | Construir base e conectores antes de plugar qualquer operação; aprovado até a segunda operação (licitação) | Decisão do Bruno |

## Login do administrador pelo Supabase Auth

- **Decisão:** a tela entra com e-mail e senha de um usuário do Supabase Auth; só o `ADMIN_EMAIL` é aceito. O `ADMIN_TOKEN` continua valendo para scripts (curl) e como reserva, e pode ser removido quando não for mais necessário.
- **Como:** o Worker repassa e-mail e senha ao Supabase (`/auth/entrar`), e a cada chamada de `/admin` pergunta ao Supabase de quem é o token. A página nunca fala com o Supabase, então a política de segurança da tela continua fechada.
- **Por quê:** senha própria, troca por e-mail, possibilidade de mais usuários e nenhum segredo único repartido.
- **Fora desta etapa:** verificação em duas etapas (MFA) no login.

## Fase 5: quarter, fechamento e migrations automáticas

- **Quarter em 6 passos:** diagnóstico, meta, cenários, esforço necessário, programa de ciclos e compromisso. O passo só avança na ordem; refazer um passo derruba os seguintes; depois de travado, nada muda (gatilho no banco).
- **Cenários:** o conservador converte 15% menos e o otimista 15% mais (teto de 100%); o ticket não muda. Os 15% são uma escolha inicial, ajustável em `packages/ciclos/src/plano.ts`.
- **Travar** grava, para cada ciclo, a meta de receita e a de cada degrau do funil (por operação e por pessoa). São as mesmas metas que o ritmo e o Fechamento do dia leem.
- **Fechar o ciclo** só depois do último dia útil, uma vez por ciclo. O retrato guarda metas, ritmo final e métricas, com assinatura SHA-256; a tela mostra "Íntegro" ou "ALTERADO".
- **Migrations automáticas:** o Worker traz embutidas as migrations (`npm run migracoes:gerar`) e aplica as pendentes, em transação e com trava, na primeira chamada autenticada e a cada rodada do agendamento. Bancos que receberam as duas primeiras à mão são reconhecidos. O `/saude` informa se há migration pendente. Motivo: quem publica o Worker não precisa abrir o SQL Editor do Supabase.

## Fase 6: hipóteses, decisões e qualidade de dados

- **Fórmulas em texto, sem `eval`:** analisador próprio (`packages/nucleo/src/hipoteses/expr.ts`) com lógica de três valores; só aceita a gramática da linguagem, então um pack não executa código.
- **Achado = hipótese verdadeira + impacto em R$ + os números que a provam.** Ordem por impacto; o orçamento de atenção (3 por padrão) esconde o resto em "em espera".
- **Canvas de decisão** só acrescenta. **Experimento** guarda o ponto de partida no dia em que começa; ao concluir mede o valor de hoje contra o alvo e escreve o resultado em `lab.aprendizado` (memória comercial). Encerrado, não muda mais.
- **Operações antigas:** se o pack guardado na operação não tem a biblioteca, o Worker a resolve de novo pelo pack e pelos ajustes da operação.
- **Correção importante:** o driver do Postgres não converte listas (`text[]`) quando `fetch_types` está desligado, como no pooler do Supabase. Consultas passam a devolver `jsonb`. Isso corrigiu as etapas já alcançadas nas coortes da fase 2.

## Fase 8: segunda operação (licitação)

- **Pack, sem conector novo:** a fonte de dados da licitação não está definida. Em vez de inventar um conector, o pack usa as portas genéricas (planilha e webhook canônico), com planilhas de exemplo e um teste que importa todas e confere as métricas.
- **Sem números de negócio inventados:** o pack não fixa margem, desconto máximo nem impostos.
- **Tela de Operações:** criar operação (escolhendo o pack) e importar CSV pelo navegador, com os arquivos aplicados na ordem certa.
- **Correção de fuso:** datas sem horário e horários sem fuso vindos de planilha passam a valer no fuso da operação (`packages/conectores/src/fuso.ts`). O teste da licitação revelou que o negócio do dia 1º caía no mês anterior.

## Fase 7: Studio (funis em grafo e campanhas)

- **Funil em grafo:** nós (etapas, vendas, perdas) e arestas com taxa de passagem; sem ciclos. O **observado** sai das passagens reais do histórico (taxa = passagens ÷ saídas da etapa); voltas a etapas anteriores são ignoradas e contadas. Com todas as saídas resolvidas, o modelo reproduz as vendas reais (há teste).
- **Um só motor:** a taxa de uma aresta, o CPL, o ticket e a margem de uma campanha podem ser número ou **fórmula**, na mesma linguagem e com as mesmas variáveis das hipóteses (`packages/nucleo/src/hipoteses`). Dado ausente é `null` e a simulação recusa em vez de assumir zero.
- **Alavancas:** para cada passagem, +5 pontos de conversão, tirados primeiro do que está parado na etapa e depois das saídas para "perdido", de modo que as saídas continuam somando 100%. As que mais rendem em vendas aparecem primeiro.
- **Funis desenhados** são versionados (cada gravação é uma versão nova; só acréscimo).
- **Campanha:** orçamento ÷ CPL = leads → funil → vendas, receita, CAC, ROI e margem. O plano é uma fotografia (o banco impede mudar). O andamento só avança (planejada → rodando → encerrada). Ao encerrar, mede o realizado (leads do canal criados no período, vendas e receita deles) e escreve plano × realizado na memória comercial. O investimento realizado vem do que você informar ao encerrar; sem isso, dos lançamentos mensais do canal nos meses da campanha, o que pode incluir outras campanhas do mesmo canal.
- **Tela:** o grafo é desenhado em SVG, sem biblioteca. Quando a tela é redesenhada, as buscas da versão anterior são descartadas, para duas atualizações seguidas não duplicarem conteúdo.

## Onda 1: plano do dia e rituais

- **A V1 é o contrato de cálculo.** As regras puras foram portadas 1:1 (`packages/dia/src/producao.ts`, `motor.ts`) e os testes da V1 rodam com os mesmos números (22 em 5 = 4,4,5,4,5; atraso 20 com janela 5 → alvo 14; adiantado 25 → 0 a fazer; cenários 16/46/86; gargalo 5% vs 10%; capacidade p80 = 84).
- **Três rituais em vez de "meio dia".** A V1 perguntava se já era meio-dia; a V2 lê o mesmo plano em três momentos (manhã 0, tarde ½, fim 1) e o "esperado até agora" usa essa fração. O ritual padrão segue a hora local; dias passados são lidos como fim do dia.
- **Dias úteis da pessoa.** A meta do ciclo é distribuída nos dias úteis da operação menos as ausências da pessoa (`lab.pessoa_ausencia`). Num dia sem trabalho não há meta nem recuperação.
- **Mínimo diário só na atividade principal** (SDR: agendamento; closer: reunião realizada). Aplicado a vendas inflaria uma meta de 4 no mês para 21. Descoberto no teste de tela e corrigido antes de publicar.
- **Fonte única do feito**: `realizados()` do planejamento (atividades por papel, negócios ganhos, passagens a oportunidade) mais os lançamentos do administrador, que são só de acréscimo, com motivo e desfeitos por um lançamento contrário.
- **Fotos imutáveis** por pessoa, dia e ritual, assinadas como os retratos de ciclo; o banco impede alterar. A memória plano × executado é lida delas, não recalculada.
- **Sem fonte ≠ zero.** Tarefas, agenda, cadência e próximo passo não existem na V2 ainda; o plano diz "sem fonte" e não conta como zero.
- **Correções na V2 antiga**: `metaDoDia` usava `ceil(meta ÷ dias úteis)` (somava mais que a meta); o build-up arredondava a cada degrau (inflava tentativas). Ambos corrigidos em `packages/planejamento` com testes.
- **Uma pergunta por tela.** Manhã: "O que fazer hoje para o dia ser um sucesso?"; tarde: "Como está o dia até agora?"; fim: "O dia foi um sucesso?"; gestor: "Quem precisa de mim hoje?". Situação do ciclo, taxas, gargalo e ajustes do administrador ficam fechados em "detalhes".

## Onda 2: vamos bater a meta?, semana e Fechamento do dia

- **Motores puros primeiro, com os testes da V1**: contingência (contingencia.test.js), objetivos/critérios/veredito/ponte (lab_objetivos.test.js), Fechamento do dia (daily_motor.test.js e a regra do tique de daily_worker.test.js) rodam com os mesmos números. Projeção, forecast e semana (sem teste puro na V1) ganharam testes próprios com valores calculados à mão.
- **Hoje conta a fração do ritual** também na projeção e na contingência (a V1 usava meio dia fixo). A manhã responde "no ritmo de ontem"; o fim do dia, com hoje inteiro.
- **Coorte com maturação**: lead → venda e lead → agendada vêm de negócios criados numa janela que termina 30 dias antes de hoje, para não medir conversão de quem ainda não teve tempo. As taxas de atividade (agendamento → realizada etc.) continuam vindo de `taxasHistoricas`.
- **Pipeline por chance × prazo**: p(venda | etapa) = ganhos ÷ encerrados que passaram pela etapa; p(fechar a tempo) = fração das durações (entrada na etapa → fechamento) que cabe nos dias que restam. Sem duração histórica, p(prazo) é nula e a etapa não sustenta projeção (não inventa).
- **Fechamento do dia no cron existente** (a cada 15 min), por operação e no fuso dela, em vez de um Worker separado como na V1. Trava com `pg_advisory_xact_lock`; execução presa expira em 10 minutos.
- **Imutabilidade por gatilho + assinatura**: `lab.dia_fechamento.original` nunca muda e a linha não se apaga; a essência é assinada (SHA-256) e a tela mostra "íntegro" ou "ALTERADO", como no retrato do ciclo.
- **Decisões do gestor dentro do relatório** (`acoes`, com histórico de até 20 por chave), sem tabela nova: é o que a recorrência lê no dia seguinte.
- **Semana sem hipóteses da biblioteca** por enquanto: a V2 tem hipóteses em linguagem de fórmula; a compatibilidade "condições da semana" entra na onda da inteligência.
- **Abas**: Dia · Meta · Semana · Fechamento do dia na frente; o resto em "Mais ▾". A aba "Ritmo" antiga continua acessível, mas a Meta a substitui.

## Onda 3: o quarter de verdade e as metas históricas

- **Pacote próprio** (`@lab/estrategia`) que depende de `planejamento`, `ciclos` e `metricas`, nunca de `dia`: o plano do dia recebe os marcos do quarter pela API, não por import, para não haver ciclo entre pacotes.
- **A meta nunca é reduzida pelo LAB.** Meta × cenários mostra o que a meta exige; viabilidade mostra o déficit e alternativas; a reprevisão coexiste com a meta original. Replanejar é decisão com motivo e cria versão.
- **Levar as metas aos ciclos é ação explícita** do gestor depois de publicar (como na V1): acrescenta a meta de receita em `lab.meta` e congela o programa original. Publicar não mexe nas metas dos ciclos.
- **Capacidade não declarada não bloqueia a aprovação**: sem horas declaradas não há sobrecarga comprovada; vira aviso. Declarada e estourada, bloqueia até haver decisão registrada.
- **Evidência de meta na V2 vai além da V1**: como `lab.meta` só acrescenta e tem `criado_em`, a meta cadastrada durante o ciclo prova a meta em vigor na época; o Fechamento do dia passa a gravar `ref.meta`; a rotina observa a meta de hoje uma vez por dia e registra ciclos encerrados até 3 ciclos para trás.
- **Ticket entra como "taxa"** para amostra (como na V1): iniciativa cujo indicador é o ticket só valida a hipótese com n ≥ amostra mínima do pack.
- **A tela antiga do quarter em 6 passos (programa de ciclos pelo build-up) continua** em **Mais › Programa de ciclos**; a nova **Quarter** é a estratégia.

## Onda 4: economia da venda

- **O motor só soma; a política decide.** Deduções, condições e comissão são configuração (pack ou publicação da operação). Regras da solar (kit fora da base do imposto, 60/40, antecipação) viram linhas e condições, nunca código.
- **MC % sobre a receita líquida, uma vez só.** A % sobre o preço existe, nomeada ao lado. O `relatorio` das métricas e o dicionário passam a apontar para `@lab/economia` como dono de preço, margem, comissão e deduções.
- **Valor de dedução informado na venda vale por cima do percentual da política.** É fato da venda (ex.: imposto efetivamente destacado). A V1 proibia ajustar imposto no orçamento por decisão da Amicta; no LAB genérico a venda manda e a política é o padrão. **Confirmado pelo Bruno em 25/10/2026.**
- **Preço recomendado por bissecção, não por fórmula fechada.** Serve a qualquer política; a fórmula da V1 é caso particular, provado no teste de ida e volta. O recomendado mira a MC bruta % (sem o custo do prazo, que fica como linha própria).
- **Sem contas a pagar.** O custo real é lançado à mão e rotulado; só vira efetivo quando marcado completo. Até lá a conta prevista vale.
- **Exceção não barra, registra.** Abaixo do piso ou acima do desconto máximo exige motivo e grava quem, por quê e quanto custou de MC. O painel mostra. **Confirmado pelo Bruno em 25/10/2026.**
- **D21 com bom senso:** só meses terminados, a partir do primeiro mês lançado do canal, cobram investimento. Senão qualquer janela histórica anularia CAC e ROI.

## Onda 5: Studio e construtor

- **Coorte, não fluxo.** Toda taxa observada (modelo observado, preencher pelo histórico, monitor) conta cada negócio uma vez: dos que alcançaram a origem, quantos alcançaram o destino. O "observado" por transições da fase 7 continua na tela antiga, mas não alimenta o modelo.
- **Dois motores, duas telas.** O construtor "E se…?" é linear e fala português com o gestor; o Studio é o desenho em blocos. Não há unificação forçada: a V1 também os separava.
- **A margem do construtor vem da economia da venda.** Sem venda com custo lançado, usa a política de preço no ticket médio e avisa "estimada". Nenhuma margem padrão escondida.
- **Capacidade e limite não declarados não dizem "sim".** A viabilidade do reverso fica "não avaliada"; a prontidão fica pendente.
- **Publicação imutável, rascunho editável.** O modelo sobe versão a cada gravação; publicar congela a fotografia com cenário, alvo, meta e validade; republicar exige motivo; o monitor sempre compara a publicação vigente na data.
- **O monitor não atribui causa a pessoa.** "A causa precisa de evidência adicional"; o diagnóstico mostra onde está o desvio e o que investigar.
- **Premissas ao plano é ação explícita**, como levar metas aos ciclos: grava `quarter_estrategia.doc.premissas` com a origem (modelo, publicação, cenário).

## Onda 6: inteligência

- **Dois formatos de hipótese no mesmo pack.** A simples (`quando`) continua valendo; a estruturada (`condicoes`) ganha histerese, confiança, rivais e impacto na mesma moeda. O resolver confere métricas, referências e variáveis das fórmulas.
- **O motor não lê banco.** `medir(id, a, b)` é injetado; a V2 fornece um medidor sobre o modelo canônico. O que não tem fonte responde "ausente" e a hipótese lista o que falta: nunca zero, nunca inventado.
- **Marca expira em 1,5×.** "Não procede" ou "aceito" tira o achado da lista até o impacto crescer 1,5× sobre a referência do dia da marca (como na V1). Marcas são só acréscimo.
- **Uma observação por mudança de estado.** A saúde conta disparos reais, não execuções do cron.
- **Benchmark é quartil superior de quem tem amostra.** Receita potencial é efeito isolado por etapa e a tela diz "simulada, não garantida".
- **Associação não é causa.** Alertas, matriz e canvas repetem a frase; a inferência trava o verbo pelo nível de evidência.
