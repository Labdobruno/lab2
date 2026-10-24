# Mapa LAB V1 × LAB V2

Feito em 24/10/2026 a partir do código completo do LAB V1 (33 arquivos, cerca de 12.500 linhas, mais os 139 arquivos de teste) e do recorte de funções de precificação. Leitura apenas: nada da Amicta foi alterado.

Os detalhes (fórmulas exatas, valores dos testes, linhas do código) estão nos sete relatórios em [`v1-analise/`](v1-analise/README.md). Este documento é o resumo para decidir o que fazer e em que ordem.

---

## 1. O diagnóstico, sem rodeio

O que foi entregue na V2 tem a **estrutura certa** (dados por operação, packs, metas só de acréscimo, retrato assinado, servidor fazendo as contas), mas é **um esqueleto**. O LAB V1 é um **sistema de gestão da operação comercial**; a V2 é, hoje, um conjunto de calculadoras com abas. Isso explica a sua impressão de que dá para fazer numa planilha.

O motivo é objetivo: o roteiro da V2 citava peças da V1 (`LAB_MET`, `lpReverso`, `lq*`, `gs*`, os testes `lab_*.test.js`) como "a referência", e eu construí sem tê-las. Cada fase foi feita a partir do modelo de dados, não do que o LAB faz de verdade.

**Três coisas que a V1 faz e que dão a ela o ar de "Jarvis" (e que a V2 não tem):**

1. **Responde "vamos bater a meta?" e "por quê?"**: projeção do ciclo (já vendido + pipeline × chance × prazo + leads que ainda vão entrar), chance de bater a meta, sinais com veredito (falta esforço, falta conversão, falta demanda, ou falta dado) e o valor em reais de cada problema. A V2 só diz se está "no ritmo" de forma linear.
2. **Transforma número em ação e memória**: do sinal sai uma tarefa; cada decisão é registrada; o plano original fica congelado e toda revisão exige motivo; o fechamento do dia sai sozinho às 17h30 e não se reescreve. A V2 recalcula tudo na hora, sem memória do dia.
3. **É honesto sobre o que não sabe**: "sem dado" nunca vira zero, amostra pequena é dita, meta de ciclo passado sem evidência é "desconhecida" (não zero, nem a meta de hoje), e a causa nunca é afirmada, só "compatível com".

---

## 2. Como o LAB V1 está organizado

**Quatro trilhas** (cada uma é uma pergunta), **36 passos** e 26 abas por baixo:

| Trilha | Pergunta | Passos (resumo) |
|---|---|---|
| Analisar o passado (12) | "O que aconteceu?" | Relatório da última semana, resultado do período, funil e conversões, onde está travando, pessoas, origens, tempo até fechar, preço e margem, operação e entrega, achados e hipóteses, qualidade dos dados, meus painéis |
| Planejar e acompanhar o mês (11) | "Como está o ciclo?" | Como está o mês, projeção da semana, contingência, fechamento do dia, plano do dia, metas e o que precisa acontecer, equipe e metas por pessoa, dia a dia, sinais e correção de rota, hipóteses do mês, fechamento e aprendizado |
| Projetar e simular o futuro (8) | "E se...?" | Planejar o quarter, quanto preciso gerar, cenários do ciclo, simular variáveis, simular uma hipótese, programa de ciclos, projeção de marketing, curva de caixa |
| GTM & Revenue Studio (5) | "Como o resultado é gerado?" | Visão geral, funis (editor visual), campanhas e GTM, simulações, monitoramento |

Outras características da casca: filtros recolhidos (período, funil, vendedor, origem, tipo de cliente, cidade), dobras "só o essencial", índice da tela, links diretos (`#lab/plan/metas`), "perguntas rápidas" ("Onde estamos perdendo receita?", "E se a conversão subir 20%?") e uma jornada em sete perguntas (onde está minha receita → onde estou perdendo → por quê → qual variável altero → quanto impacta → vamos testar → funcionou?).

Três estados nunca se misturam em nenhuma tela: **REALIZADO, PROJETADO e SIMULADO**.

---

## 3. Mapa por área

Legenda: **Cobre** = a V2 faz o equivalente. **Raso** = existe, faz bem menos (ou com erro). **Falta** = não existe.

### 3.1 Planejar o mês (frente A)

| O que a V1 faz | V2 hoje | |
|---|---|---|
| Metas do mês por indicador (19 indicadores, operador "atingir / pelo menos / no máximo / faixa"), consistência entre metas (a meta de receita cabe no ticket mínimo?) | Metas só de acréscimo, sem operador, sem consistência | Raso |
| Build-up reverso exato: calcula em fração e arredonda só no total de cada pessoa; taxa por canal e por pessoa (precedência: premissa da pessoa → do canal → histórico da pessoa → do canal → geral); canal-filho herda do pai; canais que não geram lead; pré-venda do closer vai para o SDR | `ceil` em cada degrau, taxa única, sem canal/pessoa | **Raso, com erro conhecido** |
| Metas diárias inteiras que somam exatamente a meta do mês (`floor(T(k+1)/du) − floor(Tk/du)`), mínimo de 1 por dia na etapa principal | `ceil(meta/dias)` por dia; a soma passa da meta (22 em 5 dias dá 25) | **Raso, com erro** |
| Esperado até hoje: **hoje conta meio dia**, ausência por pessoa, peso por semana, corte de vigência (replanejar) | Linear, hoje conta inteiro, sem ausência, sem peso | Raso |
| **Projeção do ciclo** (4 projeções: planejada, ritmo atual, histórica, ajustada) e **chance de bater a meta** (Poisson); negócio acima de 5× o ticket fica fora da conta | Não existe | **Falta** |
| Sinais, incidentes por zona do funil, veredito conjunto (7 frases), "classe do desvio" (impede chamar baixa conversão de falta de esforço); botão cria tarefa | Achados por hipótese cobrem uma parte; sem veredito, sem tarefa | Raso |
| Cenários por premissa (ticket, margem, leads, pipeline, taxas) em %, com justificativa; conservador = limite inferior de Wilson 95%; sensibilidade ±10%; conflito de margem | ±15% em todas as taxas | **Raso, conceito oposto** |
| Capacidade e viabilidade: necessário × viável × déficit; a meta nunca é cortada, mostra alternativas | Não existe | **Falta** |
| Replanejar com data de corte e motivo (cria v2, preserva v1 e o original) | Não existe | **Falta** |
| Programa de ciclos (2 a 6 ciclos): meta original congelada + meta vigente que redistribui sobra e falta | Divide uma vez por pesos, sem rebalancear | Raso |
| Equipe: função, peso, capacidade por dia, ausências, canais pré-venda/venda, indicador de sucesso | Só a função | Raso |
| Hipóteses do mês com estados e veredito automático | Experimentos com baseline/alvo | Parcial |
| **Relatório da última semana** (deu certo/errado, por pessoa e canal, causas "compatíveis com", roteiro de testes, texto para colar no WhatsApp) e **Projeção da semana** (ritmo, faixa, "na mesa para fechar") | Não existe | **Falta** |
| Decomposição da receita (volume × conversão × ticket), comparação com ciclo anterior e do ano anterior, defasagem leads→vendas | Não existe | **Falta** |
| CPL, CAC, ROI por canal com rateio do investimento pelos dias do ciclo; mês sem investimento lançado = "incompleto" | CPL, CAC, ROI e payback por canal (mensal) | Cobre (falta o rateio e o "incompleto") |

### 3.2 O dia a dia (frente F)

| O que a V1 faz | V2 hoje | |
|---|---|---|
| **Fechamento do dia** às 17h30: relatório gravado, imutável, com complemento às 23h30, decisões do gestor e recorrência (o mesmo alerta 3 relatórios seguidos sobe de nível) | Texto de 3 a 4 frases calculado na hora, não grava | **Falta** (só o nome é igual) |
| Worker automático com trava contra duplicidade, tentativas e auditoria; sino "o fechamento de hoje não saiu" | Cron de 15 min só sincroniza conectores | **Falta** |
| Contingência em 4 níveis (100/90/75% e crítico), 3 critérios, alvo de recuperação por pessoa e por dia que fecha exatamente a meta, ações sugeridas | `ceil(falta/restantes)`, viável até 1,5× da meta planejada | Raso |
| Plano do dia da pessoa (alvo de hoje, viabilidade, capacidade) | Não existe | **Falta** |
| Situação da pessoa em 6 estados ("sem registro" ≠ "não executou"), diagnóstico atividade × resultado, causa sistêmica | Só o status de ritmo | **Falta** |

### 3.3 Quarter, objetivos e metas (frente B)

O quarter da V1 tem **seis fases** e é um sistema de gestão da estratégia: decide primeiro **o quê e por quê** e só depois **quanto**.

| Fase V1 | Para que serve |
|---|---|
| 1. Revisão do quarter anterior | Planejado × realizado em 15 indicadores, tendência, o que funcionou e não funcionou, retrospectiva guiada |
| 2. Diagnóstico e prioridades | Restrições à receita (demanda, conversão, ticket, margem, ciclo, capacidade, perdas, canal) com estado **comprovado / hipótese / sem dado** e impacto em R$; prioridades pontuadas por 9 critérios |
| 3. Objetivo e metas | Meta com 3 cenários, "meta ambiciosa × viável" (nunca corta a meta; mostra o que ela exige), resultados-chave |
| 4. Iniciativas | Cada prioridade vira intervenção testável: hipótese, indicador (inicial → mínimo → alvo), marcos, critério de continuar/corrigir/interromper |
| 5. Os três meses | Meta por mês, bottom-up, capacidade em horas, sequência, riscos, gatilhos |
| 6. Publicação e acompanhamento | Aprovação com bloqueios explicados, versões v1/v2 com motivo, programa de ciclos, projeção e reprevisão semanal, fechamento mensal, encerramento e aprendizados |

**V2:** tem "6 passos" que são outra coisa (diagnóstico de métricas, meta, cenários ±15%, esforço, pesos, travar). **Raso**, e o "travar" é irreversível, enquanto a V1 permite revisar com motivo preservando a v1.

**Metas históricas por ciclo** (V1): estados conhecida / desconhecida / sem meta / estimada; cada registro numerado (r1, r2...), protegido por gatilho no banco; meta de qualquer período por rateio dos dias úteis; ano com acumulado e projeção. **V2: falta**; sem isso o atingimento de períodos passados mente.

### 3.4 Fechamento do ciclo (frente C)

A V1 gera um relatório de **13 seções**, imutável e versionado (r1; r2 e r3 só por revisão com justificativa), que **nunca calcula** indicador: consolida o que as funções-dona calculam, confere (reprodução com tolerância zero) e congela. Inclui integridade dos dados antes de fechar (19 códigos), meta original × vigente × realizado × desvio, leitura executiva, diagnóstico do funil por coorte com gargalo por peso em R$, pessoas sem ranking, achados classificados como fato / interpretação / hipótese, aprendizados com nível de confiança, plano de ação (15 regras), ligação com o trimestre e uma ponte para o ciclo seguinte.

**V2:** o retrato é uma foto de números com **assinatura SHA-256 (melhor que a da V1)** e a trava "só fecha depois do último dia útil". O resto é **raso ou falta**, e não existe caminho de correção: um erro trava o ciclo para sempre.

### 3.5 Motor de achados e hipóteses (frente E)

| O que a V1 faz | V2 hoje | |
|---|---|---|
| 20 hipóteses como dados (10 universais + 10 do pack solar), cada uma com condições de 6 parâmetros (janela, base, limiar, banda, amostra mínima, **histerese**), **rivais**, "dado que distingue", intervenções e impacto em R$ | 10 hipóteses (8 no base + 2 na licitação), condição e impacto em fórmula de texto | Raso |
| Prioridade = impacto × confiança × aderência ÷ esforço; orçamento de atenção de 5; achados compostos | Ordena por R$, depois severidade; orçamento de 3 | Raso |
| Marcas "aceito / não procede" com validade (voltam se o impacto passar de 1,5×); diário de contexto (reajuste, saída de vendedor, campanha); histerese de 14 dias | Não existe | **Falta** |
| Canvas de decisão com 10 blocos; ciclo de vida da regra (rascunho, sombra, ativa, aposentada) | Decisão simples + experimento | Raso |
| Dicionário de ~50 métricas como contrato; grafo de 27 relações entre métricas; níveis de inferência que travam o verbo ("compatível com", nunca "causou") | Dicionário de 16 métricas | Raso |
| Forecast do mês por etapa × prazo; acurácia do forecast (erro, viés); foto diária do servidor | Não existe | **Falta** |
| Benchmark entre vendedores (mediana, p75), **receita potencial** se a etapa chegasse ao benchmark, transferência de performance ("e se a Ana tivesse a conversão do Pedro") | Não existe | **Falta** |
| Drill-down (vendedor, origem, mês, tipo) e lista dos leads por trás de cada número | Não existe | **Falta** |
| Funil por coorte com Wilson; Wilson como estatística | Existe | Cobre |

### 3.6 Studio, GTM e construtor (frente D)

**Correção ao roteiro:** na V1 o **construtor** e o **Studio** são **dois motores separados** (construtor: funil linear; Studio: grafo). A "unificação" foi uma ideia que eu incluí na V2 (a mesma linguagem de fórmula), não algo herdado.

| O que a V1 faz | V2 hoje | |
|---|---|---|
| **GTM & Revenue Studio**: editor visual (arrastar, conectar, zoom) com 8 tipos de bloco; cada bloco ligado ao CRM (7 tipos de vínculo, taxa vem de **coorte** com Wilson); retornos com limite de voltas; capacidade que vira fila; defasagem por conexão | Grafo com 3 tipos, sem editor visual, sem vínculo, sem capacidade, sem retorno; o "observado" conta **fluxo**, erro que a V1 evitou de propósito | Raso |
| Cálculo direto **e reverso** (alvo de resultado → quanto precisa entrar, com capacidade e limite da fonte) | Só direto | **Falta** o reverso |
| Cenários nomeados, sensibilidade, natureza de cada premissa (histórico / premissa / benchmark / estimativa / hipótese) | Alavanca fixa de +5 pontos | Raso |
| **Publicar** o modelo como plano oficial imutável com validade; **monitor** planejado × realizado por bloco e conexão com estados (dentro, atenção, fora, insuficiente), diagnósticos com R$, ação que vira tarefa e é avaliada antes e depois | Não existe | **Falta** (é o maior bloco do Studio) |
| **Campanhas**: briefing de ~45 campos, funil próprio, 10 critérios de prontidão (sem "nota de probabilidade"), aprovação, decisão pós-teste (continuar, corrigir ou encerrar) com aprendizado | Projeção financeira simples (correta), plano × realizado | Raso (a projeção é boa; falta o resto) |
| **Construtor de hipóteses**: pergunta em frase ("Se o X do closer fosse igual à mediana, qual seria o impacto em margem/caixa?") sobre uma árvore marketing → funil → receita → margem → caixa → ponto de equilíbrio | Não existe | **Falta, o maior buraco desta frente** |

### 3.7 Economia da venda (frente G)

A V1 quase não tem fórmula econômica própria no LAB: ela **consome o motor de Precificação do CRM** (`precEcon`). As contas:

- **Receita líquida** = preço − imposto − taxa da condição − antecipação − comissão.
- **MC (margem de contribuição)** = receita líquida − custos − custo financeiro do prazo. MC % é sempre sobre a receita líquida; a % sobre o preço aparece ao lado, nomeada.
- **Comissão** ligada à margem: 1% + 0,25 × (margem − 20%), piso de 1%, sem teto. A comissão depende da margem e a margem da comissão: o motor resolve iterando.
- **Previsto** (orçamento aprovado) × **real** (contas pagas) × **efetivo** (real só quando tudo foi pago).
- A venda ganha **congela a política de preço do dia do ganho**.
- **"Fonte única":** cada número tem um dono, e testes leem o código e falham se alguém reescrever a conta em outro lugar.

**V2:** registra preço de referência/aprovado/fechado e custos informados; MC = fechado − custos. **Superestima a margem** (não tira imposto, taxa nem comissão), não tem política de preço funcionando, nem preço recomendado/piso, nem condição de pagamento, nem previsto × real. Para servir a **qualquer operação**, deduções, condições e comissão precisam virar **configuração do pack**; o núcleo só soma. Regras específicas da solar (kit fora da base do imposto, RBT12, cartão 60/40, kWp) ficam no pack da solar.

### 3.8 Painéis e navegação (frente E)

Construtor de painéis ao estilo Looker (9 tipos de visual, 4 modelos prontos, ~50 indicadores, visibilidade "só eu / todos" garantida no banco) e a casca em trilhas. **V2: não existe** nenhum dos dois; as 8 abas da V2 são fixas.

---

## 4. O que a V2 faz melhor (manter)

- **Multi-operação com packs** (JSON com herança): uma operação nova nasce em minutos; a V1 é presa à solar.
- **Retrato do ciclo com SHA-256** (a V1 usa um hash fraco de 32 bits).
- **CAC, CPL, LTV, churn e retenção** por canal e por operação, que a V1 não tem nesse nível.
- **Feriados móveis por fórmula** e fuso por operação.
- **Modelo relacional limpo** (a V1 guarda tudo em documentos JSON mesclados, com pessoa identificada por nome).
- **Linguagem de fórmulas** para hipóteses e taxas, auditável e sem código (a V1 usa funções JavaScript).
- **Orçamento de atenção** com "sem dados" explícito e erro de fórmula isolado.
- Login por e-mail e senha, migrations automáticas e deploy.

---

## 5. Erros concretos da V2 que a V1 já tinha resolvido

Estes não são "falta de recurso": são cálculos errados que já foram descobertos e corrigidos na V1 e que preciso corrigir primeiro.

1. **Arredondar a cada degrau do build-up** infla o funil: a V1 mediu **+26% em vendas e +51% em leads** num caso real de 12/10/2026. Regra certa: calcular em fração e arredondar uma vez, no total de cada pessoa.
2. **Meta diária com `ceil`**: a soma dos dias passa da meta do mês. Regra certa: `floor(T(k+1)/du) − floor(Tk/du)`.
3. **"Hoje" conta como dia inteiro**: durante o dia o time aparece sempre "atrás". A V1 conta hoje como meio dia.
4. **Funil observado por fluxo**: mistura coortes e passa de 100%. A V1 usa coorte (quem entrou na etapa e quantos desses chegaram à seguinte) e exige que a coorte esteja madura (termina 30 dias antes).
5. **Cenário de ±15% em todas as taxas**: o oposto do desenho da V1 (premissas nomeadas, justificadas, com o conservador pelo limite inferior de Wilson).
6. **Taxa acima de 100% é truncada** em vez de descartada como dado incoerente.
7. **Travar o quarter irreversível**, sem revisão com motivo.
8. **Meta de ciclo sem registro** não é tratada como "desconhecida".
9. **Metas de ciclos antigos** não têm original × vigente.

---

## 6. O que isso muda no plano (ordem sugerida)

Uma só frase de princípio: **portar a parte "pura" (as contas) primeiro, usando os testes da V1 como contrato**, e só depois as telas. A V1 já tem essa parte separada em funções sem tela e com testes de valores concretos (por exemplo: R$ 150 mil com ticket de R$ 30 mil dá 5 vendas, 10 oportunidades, 13 realizadas, 19 agendadas, 95 leads e 64 contatos).

| Onda | O que entra | Por que nesta ordem |
|---|---|---|
| **0. Fundação correta** | Corrigir os 9 erros da seção 5; trazer os testes da V1 (`cadeia`, `metas_dia`, `lab_metas`, `lab_objetivos`) como contrato; metas históricas com estado "desconhecida"; meta original × vigente; replanejar com corte e motivo | Sem isso, qualquer tela nova mostra número errado |
| **1. "Vamos bater a meta?"** | Projeção do ciclo e chance de bater; fora da curva; ausências e pesos de semana; sinais com veredito; contingência e plano do dia fiéis; relatório e projeção da semana | É a pergunta central do seu trabalho de RevOps e hoje não tem resposta |
| **2. Memória e rotina** | Fechamento do dia gravado + worker 17h30 com auditoria; fechamento do ciclo com revisão, desvio, leitura executiva, plano de ação e ponte para o ciclo seguinte | Transforma o LAB de painel em sistema que lembra |
| **3. Estratégia** | Quarter de verdade (diagnóstico, prioridades, iniciativas, KRs, cenários por premissa, capacidade, riscos, gatilhos, publicação com versões, acompanhamento) | Responde "para onde vou e como saberei cedo que erro" |
| **4. Inteligência** | Motor v3 (confiança, rivais, histerese, marcas com validade, diário de contexto), benchmark de vendedores com receita potencial, drill-down, foto diária e acurácia | Faz o LAB dizer **por que** e **quanto vale** corrigir |
| **5. Studio e construtor** | Monitor planejado × realizado, cálculo reverso, capacidade e fila, retornos, publicação; campanhas com briefing, prontidão e decisão; construtor "e se" (começando por funil + ticket + margem) | É a camada de desenho da estratégia, que depende das anteriores estarem certas |
| **6. Economia e navegação** | Deduções, condições e comissão como configuração do pack; previsto × real; painéis; casca em trilhas | Depende de decisões suas sobre financeiro (seção 7) |

Essa ordem é uma sugestão minha. A prioridade real é sua: você sabe o que olha todo dia.

---

## 7. O que preciso de você para decidir

**Dados que a V1 usa e a V2 não tem hoje.** Cada número abaixo depende de uma fonte; sem a fonte, a V2 mostra "sem dado" (nunca zero):

| Fonte | O que sustenta |
|---|---|
| Agenda (reuniões com status, no-show, reagendamento) | Comparecimento, reuniões realizadas, projeção da semana |
| Cadência e WhatsApp | Tempo até o primeiro contato, contatos por dia |
| Contas a pagar / Financeiro | Custo real da venda, caixa, curva de caixa |
| OS, produção e entrega | Metade das hipóteses (backlog, atraso, cancelamento pós-venda) |
| Tarefas | Ação a partir do sinal, "ação já existe" |
| Forecast por negócio | Pipeline × chance × prazo |

**Perguntas:**

1. **Como a V2 vai receber esses dados?** Pela API de leitura do CRM da Amicta (como previsto no conector), por planilha, ou a V2 terá os seus próprios cadastros? Isso define o que entra nas ondas 1 e 6.
2. **Financeiro:** a V2 terá contas a pagar próprias, ou aceita custo real digitado (rotulado como "lançado")?
3. **Briefing Master:** o código cita um documento com mais de 168 seções ("§"). Se ele existe, mande; senão aceito o código como especificação.
4. **Prioridade:** qual dessas ondas pesa mais na sua rotina de RevOps? O que você abre todo dia de manhã?
5. **"Hoje conta meio dia"** no esperado até hoje, como na V1?
6. **Arquivos que o LAB usa e não vieram** e que preciso para portar fiel: `gestao.js` (`vendedorDaVenda`, `ticketMedio`), `esforco.js`, o forecast (`labForecast`), o motor do Plano do dia (`pdm*`), o catálogo de métricas `LAB_MET` (`lpMed`) e a parte da precificação que faltou (`precCapital`, `taxaMaq`, `condFrac`, `margemVenda`).

---

## 8. Observações finais

- **Amicta intocável:** esta leitura não escreveu em nada dela. Os arquivos que você enviou ficaram só numa pasta temporária de trabalho; o repositório recebe apenas esta análise (sem o código da V1).
- **Pontos frágeis da própria V1 que não vamos herdar:** o bloco "Principais riscos" do Resumo nunca aparece (expressão solta), cálculos refeitos a cada desenho de tela, tela e conta no mesmo arquivo, limiares duplicados (amostra mínima 5 num lugar e 10 em outro), pessoa por nome em vez de id, e a foto diária da contingência só gravada por quem abre o CRM.
- **Limite da leitura:** sete leitores trabalharam em paralelo e escreveram relatórios longos. Eu li por inteiro os de planejamento (A) e de quarter (B); dos demais li as seções de comparação com a V2 e de riscos, e partes das de funcionamento (D e E), apoiado nas sínteses de cada leitor. As fórmulas exatas ficam nos relatórios e serão conferidas contra os testes da V1, e contra o código, quando cada parte for reconstruída.
