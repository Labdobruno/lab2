# Frente D: Studio, Construtor de hipóteses e Biblioteca executável (LAB V1)

Arquivos lidos por inteiro: lab_studio.js (927 linhas), lab_studio_motor.js (360), lab_construtor.js (635), lab_biblioteca.js (112), 64_lab_studio.sql (63), lab_studio.css (só o início, é aparência), studio.test.js (158), ui/lab_studio.mjs (200), sql/lab_studio.sql (19). Referências "arquivo:linha" abaixo: motor = lab_studio_motor.js; tela = lab_studio.js; cons = lab_construtor.js; bib = lab_biblioteca.js.

## 1. Para que serve cada parte

**Studio (GTM & Revenue Studio)** é a "quarta trilha do LAB", que responde "Como o resultado é gerado?" (tela:4). É um modelo de funil em grafo desenhado pelo gestor, mas bem mais do que um desenho: é um modelo de planejamento que cobre o ciclo inteiro. Ele junta quatro coisas.
1. Um grafo de blocos (entrada, etapa, decisão, ação, marco de compromisso, resultado, perda, pós-venda) e conexões com taxa. O Bowtie da Amicta vai de aquisição até venda, passagem para a operação, instalação, entrega e indicação (tela:58).
2. Um simulador. Dado o volume de entrada e as taxas, calcula o que passa por cada etapa (cálculo direto). Dada uma meta, calcula quanto precisa entrar (cálculo reverso). Também faz cenários, sensibilidade, capacidade/fila e defasagem de tempo.
3. Uma publicação: a "fotografia aprovada" do modelo vira o plano oficial, com validade, autor e versão imutável.
4. Um monitor. Compara o plano publicado com o que o CRM registra, por bloco e por conexão. Gera estados (dentro, atenção, fora, bloqueado, insuficiente), diagnósticos com evidência e impacto em R$, e ações que viram Tarefas. Depois acompanha antes e depois da ação.

Há também **Campanhas e GTM**. Uma campanha é "qualquer estratégia que mereça um GTM próprio: canal novo, segmento novo, oferta nova, recuperação de perdidos, indicação, expansão na base" (tela:596). Tem briefing estruturado, funil próprio, cenários, checklist de prontidão sem nota mágica, aprovação registrada e decisão pós-teste (continuar, corrigir ou encerrar) com aprendizado. Ou seja, campanha = experimento de go-to-market com critério de decisão, não só projeção de orçamento.

**Construtor de hipóteses** (cons) é outra ferramenta, com outro motor. É um simulador "e se" em frase: "Se o [indicador] [da equipe/de um vendedor/do canal X] fosse [igual a / maior em / menor em / de] [referência ou valor], qual seria o impacto em [receita/margem/caixa/etc.]?" (cons:1-8). Sobe pela "árvore de indicadores": marketing (investimento, impressões, CTR, CPC, CPL) → funil (conversão entre quaisquer duas etapas) → receita (ticket, kWp, preço por kWp, desconto) → margem (kit, comissão, impostos, taxas de cartão) → caixa → custos fixos e ponto de equilíbrio. Aceita várias condições (+E) e dois cenários (A ou B). A pergunta pode ser salva, e pode virar uma hipótese para testar (com baseline, meta e janela de teste) que depois é medida pela mesma árvore (lbcCard, cons:553).

**Biblioteca executável** (bib) é conhecimento de RevOps guardado como dados: 10 hipóteses universais (Core) + 10 setoriais solares (pack "Solar Intelligence Pack", pode ser desligado em `lab.packs`) + 10 intervenções + 3 achados compostos. Cada hipótese tem código, versão, origem, nível, tipo, condições de ativação (métrica, operador, janela, base, limiar), mecanismo, rivais, "dado que distingue", evidências a favor e contra, intervenções, simulações, critério de sucesso, "quando não usar", segmentos e uma função de impacto em R$.

**Como se relacionam, e atenção à premissa do roteiro:** o roteiro dizia que o motor do construtor é unificado ao do Studio. No código lido isso é falso. São dois motores separados:
- Construtor: `lbc*` em cons, funil linear fixo do pipeline oficial (`labEtapas()`), vendas = leads × produto das conversões (cons:184).
- Studio: `gs*` em motor, grafo arbitrário com ramificações, retorno, capacidade e fila.

As costuras reais são só estas:
- O Studio "toma emprestado" a Biblioteca. Quando um diagnóstico de conversão aponta uma conexão que corresponde a uma métrica do catálogo (`gsMetricaAresta`, tela:457: lead>reuniao_ag→tx_agenda, reuniao_ok>sql→tx_oport, sql>ganho→tx_fech, lead>ganho→tx_lead_venda), a tela lista as intervenções (`variavel===met`) e as hipóteses (`ativacao.met===met`) compatíveis (`gsBiblioteca`, tela:459). Dali dá para "criar como ação" (vira Tarefa).
- O Studio publica premissas no Planejamento (`gsLevarAoPlano`, tela:772) e usa o Forecast do LAB para o pipeline aberto (`labForecast`, tela:472).
- A "unificação" que o V2 fez (mesma linguagem de fórmula para taxa de aresta e para hipótese) é uma ideia nova do V2, não uma herança do V1.

Não li o motor que avalia as condições de ativação da Biblioteca (`AUMENTOU`, `DIMINUIU`, `ESTAVEL`, `ACIMA`, com janela/base/histerese). Ele não está nos meus arquivos: aqui só existem os dados (`C_()`, bib:10) e as funções de impacto.

## 2. Telas e interações

Cinco passos dentro do Studio (`GS_SUBS`, tela:13): Visão geral, Funis, Campanhas e GTM, Simulações, Monitoramento. A URL guarda o passo e o modelo (`#lab/studio/funis/<id>`).

**Visão geral** (`gsTelaVisao`, tela:659). KPIs de funis e campanhas. Tabela "Situação dos modelos no ciclo atual": modelo, status (publicado/rascunho/alterações não publicadas), resultado medido, meta, realizado, projeção, diferença, principal gargalo, quantas situações "fora do esperado". Sem funil, convida a começar por: funil do CRM, Bowtie Amicta ou em branco.

**Funis (editor visual)** (`gsTelaFunis`, tela:378).
- Canvas SVG. Arrasta bloco para mover (grade de 2 px); arrasta a "bolinha" da borda até outro bloco para conectar; arrasta o fundo para andar; Ctrl+roda para zoom; setas do teclado movem o bloco, Delete exclui.
- Botões: Enquadrar, Compacto/Detalhes, Organizar (layout automático em camadas, com "Desfazer organização"), direção do fluxo (esquerda→direita ou cima→baixo), filtro de "Trecho do Bowtie".
- Paleta para adicionar bloco já conectado ao selecionado.
- Painel do bloco (progressivo): nome, finalidade, tipo, unidade de contagem, vínculo com o CRM. Para entrada: volume por período, natureza do volume, máximo que a fonte entrega. Para resultado/compromisso: ticket e margem. Para todos: capacidade no período e permanência esperada. Em "mais campos": critérios de entrada/saída/perda, responsável, canal.
- Painel da conexão: taxa (%), natureza, amostra n, tempo de passagem (dias), botão "Usar o histórico do CRM nesta taxa", a definição formal da conversão (evento inicial/final, população elegível, numerador, denominador, coorte, atribuição), retorno com limite de voltas, flag "exclusiva", inverter, desconectar.
- Abaixo do canvas: Validação, Cálculo direto (tabela), Cálculo reverso, Premissas e de onde vêm, Versões e publicações.
- Botões de cabeçalho: seletor de cenário, Preencher pelo histórico do CRM, Salvar versão, Duplicar, Publicar como plano, Excluir.
- Permissão: quem não tem a chave `lab.planejamento_salvar` só vê e simula (tudo fica `disabled`).

**Simulações** (`gsTelaSim`, tela:408). Tabela de premissas por cenário (célula vazia = herda do base). Botões "Criar cenário conservador/otimista", "Novo cenário" e "Preencher conservador e otimista pela banda de 95% do histórico". Comparação lado a lado. Sensibilidade com variação ±p.p. ajustável e opção de usar a banda histórica. Frase de esforço "volume × conversão".

**Monitoramento** (`gsTelaMonitor`, tela:531). Período (ciclo atual, ciclo anterior, 30 d, 90 d). Cabeçalho executivo com 7 KPIs. O funil colorido pelo estado de cada bloco/conexão. Diagnósticos com evidência, consequência e "para investigar". Estado de análise (novo, em análise, causa confirmada, descartado). Tabelas "Etapas: planejado × realizado" e "Conexões: conversão planejada × realizada". "Ações e o que mudou depois delas".

**Campanhas e GTM** (`gsTelaGtm`, tela:590). Lista de campanhas. Comparar estratégias lado a lado, quando há mais de uma. Prontidão (10 itens). Briefing em 6 seções: Objetivo, Público, Oferta, Canais, Viabilidade financeira, Hipótese e experimento (`GS_BRIEF`, tela:569). Jornada e cenários com custo por venda e retorno estimados. Aprovação, confronto premissa × observado e decisão pós-teste.

**Construtor** (`labTelaCons`, cons:413). Frase editável com seletores. Alternância "passado (se fosse)" ou "futuro (se for)". Visão por período, por mês ou em 12 meses. Cenário B ("OU se…"). Resultado "Atual × Simulado × Impacto". Tabela com ~26 indicadores antes e depois. Premissas (o que ficou constante e de onde vem cada número). "Como chegamos nesse número?" passo a passo. "Quanto precisa?" (meta reversa por busca binária). Sensibilidade de −30% a +30%. Curva de caixa. Botões: copiar resumo, salvar pergunta, salvar no planejamento do mês, "Transformar em hipótese para testar".

## 3. Modelo de dados

**Gravação.** Um documento por modelo e um por campanha, na tabela genérica `gestao` do Supabase:
- `gestao/lab:studio:<id>`: modelo.
- `gestao/lab:gtm:<id>`: campanha.
- `gestao/lab` (documento único do LAB): `hipoteses`, `perguntas` (construtor), `mkt[AAAA-MM][canal]={inv,imp,cli,leadsPlat}`, `minN`, `packs`, `regras`.

Não há tabelas relacionais próprias para o Studio. É JSON com patch por campo: `patchG(chave, patch, atrasoMs)`, e `null` apaga a chave.

**Modelo `lab:studio:<id>`** (campos vistos em `gsCriarModelo`, tela:76):
- Cabeçalho: `nome`, `status` (rascunho, publicado, arquivado), `versao`, `pipe` (id do funil do CRM), `dir` ('LR'|'TB'), `diasPeriodo` (30), `vista`, `camp` (campanha dona), `meta {no, valor, medida: 'vol'|'receita'}`, `origemDe`.
- `nos{id}`: `tipo` (8 tipos), `nome`, `desc`, `un` (lead, pessoa, empresa, reuniao, oportunidade, proposta, contrato, cliente, pedido, os, brl), `x`, `y`, `fase` (aquisicao, comercial, operacao, pos), `vol`, `fonte` (natureza), `limite` (máximo da fonte), `cap {v, por}`, `prazo`, `ticket`, `margem`, `fonteTicket`, `nHist`, `nTicket`, `jan`, `critEntrada`, `critSaida`, `critPerda`, `evento`, `resp`, `canal`, `obs`, `bind`.
- `bind` (vínculo com o CRM; define o que significa "entrou neste bloco"), em 6 formas:
  - `{tipo:'lead'}`: lead criado.
  - `{tipo:'etapa', etapa}`: entrou na etapa X.
  - `{tipo:'proposta'}`: primeira proposta pronta.
  - `{tipo:'ganho'}`: venda.
  - `{tipo:'perdido'}`: negócio perdido.
  - `{tipo:'os', marco}`: pedido, os, instalada, homologada ou concluida.
  - `{tipo:'ind', ind}`: indicador de contagem do catálogo, sem coorte.
- `arestas{id}`: `de`, `para`, `taxa` (0–1 ou null), `fonte`, `n`, `k`, `dias`, `diasFonte`, `jan`, `retorno` (bool), `maxVoltas` (1–10), `exclusiva` (bool), `evento`, `criterio`, `saida`.
- `cenarios{id}`: `{nome, regras{ 'a:<aid>.taxa' | 'n:<nid>.vol' | 'n:<nid>.ticket' | 'n:<nid>.cap' : {v, fonte, n, nota} }}`. O cenário guarda só o que muda.
- `vers{vN}`: versões salvas (snapshot de nos, arestas e cenários, com motivo). Podem ser restauradas. Restaurar guarda antes o estado atual como nova versão.
- `pub{vN}`: publicação. Contém `n`, `em`, `por`, `porId`, `validade {de, ate}`, `motivo`, `cenario:'base'`, `snapshot`, `cenarios`, `resultado {no, vol, contratado}`, `lacunas[]`, `compativel`, `plano` (ciclo ao qual as premissas foram levadas).
- `pubAtual`, `diags{chave: {estado, por, em}}`, `interv{chave:tarefa: {tarefa, titulo, resp, em, chave, aresta, metrica, esperado, intervencao}}`, `hist{}` (log de alterações com `acao`, `de`, `para`), `apagado`.

**Naturezas da premissa** (`GS_NATUREZA`, motor:31): historico, premissa, benchmark, estimativa, hipotese. Só historico e benchmark contam como "evidência" (`GS_EVIDENCIA`).

**Campanha `lab:gtm:<id>`**:
- `nome`, `status` (rascunho, pronta, execucao, encerrada), `modelo` (id do funil).
- `brief` com 6 seções: objetivo {oque, sucesso, de, ate, meta, invest, naoComprometer}; publico {icp, segmento, criterios, necessidade, geo, sinais, exclusoes}; oferta {produto, valor, problema, diferenciais, condicoes, faixa, provas, objecoes, porque}; canais {lista[], origem, entrada, cadencias, investCanal, ativos, resp}; financeiro {ticket, orcamento, margem, pagamento, prazos, capitalGiro}; experimento {hipotese, evidencia, esperado, variavel, metrica, amostra, duracao, continuar, corrigir, encerrar}.
- `aprov {em, por, porId, pendencias, bloqueadores, leitura}`, `decisao {escolha, motivo, aprendizado, em, por}`, `hist`.
- Atribuição: o funil da campanha só enxerga negócios dos canais listados e criados dentro do período (±12 h) (`gsNegs`, tela:119).

**Construtor** (`gestao/lab`): `perguntas{qTimestamp}` = `{frase, em, cfg: {sujeito, clausulas[], alt, res, tempo}}`. Cláusula = `{ind, op, ref, num, un, mant}`. `hipoteses{hTimestamp}` = `{titulo, hipotese, variavel, v2:{sujeito, ind, alvo, res, mant, clausulas}, vend, meta, ini, fim, resp, num, status, aprendizado, base:{val, n, de, ate, impacto, resAtual, resSim}}`.

**Banco (SQL 64)**. Só segurança, sem tabelas novas (64_lab_studio.sql):
- Três políticas RESTRICTIVE em `gestao` (insert, update, delete). Quando `id ~ '^lab:(studio|gtm):'`, exige `usuario_tem('lab.planejamento_salvar')`. Leitura segue a regra geral do LAB.
- Gatilho `lab_studio_guarda` (before update/delete): (a) nenhuma `pub.<vN>` existente pode mudar ou sumir (erro 42501); (b) modelo com publicação não pode ser apagado do banco, só marcado `apagado:true`.
- Desliga o cron `lab_fechamento` de uma prévia anterior (o relatório das 17h30 é de outro módulo, Daily Executive Intelligence).

## 4. Regras e fórmulas exatas

### 4.1 Parâmetros e cenários: `gsParams` (motor:40)
O base é o próprio modelo. Um cenário aplica `regras` por cima de uma cópia. A chave `^([na]):([^.]+)\.(\w+)$` aponta nó ou aresta. `cap` troca só `cap.v`. Taxa alterada recebe `fonte = r.fonte || 'hipotese'` e `n = r.n`. Outros campos ganham `fonte_<campo>`. Devolve a lista `alterados` (chave, de, para, fonte, nota). O modelo nunca é alterado.

### 4.2 Grafo: `gsGrafo` (motor:56)
- Ordem topológica por algoritmo de Kahn, ignorando arestas de retorno. Nós que sobram formam `ciclo`.
- `ent` = nós tipo entrada; `res` = tipo resultado.
- `gsAlcance` (motor:68) calcula o alcance, com ou sem retorno.

### 4.3 Validação: `gsValidar` (motor:71). Cada item tem gravidade (erro, aviso, info), código, alvo e mensagem.
Erros:
- vazio, sem_entrada;
- laco (aresta de um nó para ele mesmo);
- taxa_invalida (<0 ou >1);
- unidade: liga R$ a contagem (um lado `brl` e o outro não);
- retorno_regra: maxVoltas não inteiro entre 1 e 10;
- distribuicao: saídas do nó somam >100,5%;
- capacidade ≤0;
- ciclo sem regra de retorno;
- retorno_explosivo: `taxa_retorno × rendimento_do_trecho ≥ 1`.

Avisos:
- sem_resultado;
- sem_taxa (o volume não passa por ali);
- duplicada (duas conexões entre os mesmos blocos);
- decisao_aberta (decisão com todas as taxas informadas que não soma 100% ±0,5%);
- decisao_unica (menos de 2 caminhos);
- entrada_recebe;
- sem_saida (etapa, ação, compromisso ou decisão sem saída);
- orfao (bloco que nenhuma entrada alcança);
- convergencia: um nó recebe de A e de B, e B é alcançável a partir de A. Risco de contar a mesma entidade duas vezes. Se a conexão for marcada `exclusiva`, o aviso some.

Info: entrada_sem_volume.

Se houver erro, o modelo não calcula número preciso, e a publicação é bloqueada.

### 4.4 Cálculo direto: `gsDireto` (motor:115)
- Se há ciclo não resolvido, `ok:false`.
- Injeta o volume nas entradas (`vol`, ou as `entradas` passadas).
- Até 12 passadas. Em cada passada, percorre a ordem topológica. Para cada nó com `chega > 1e-9`:
  - `p = min(chega, capLeft[n])`. A capacidade é consumida cumulativamente ao longo das passadas.
  - `fila += chega − p` (excesso de capacidade vira fila).
  - `v[n] += chega`. `novo[n]` na passada 0; `ret[n]` nas passadas de retorno. `proc[n] += p`.
  - Para cada aresta de saída que não seja retorno: `q = p × min(1, taxa)`; `fluxo[a] += q`; `chega[destino] += q`.
  - Defasagem: `lagAc[dest] += q × (lag médio do nó + dias da aresta)`; `lagPeso[dest] += q`.
  - `perdaImpl[n] += p × max(0, 1 − Σ taxas)`, exceto resultado e perda. É o que "não avança", ou seja, a perda implícita.
- Retornos: depois de cada passada, para cada aresta de retorno com `voltas < maxVoltas`: `q = sai[origem] × min(1, taxa)`, que entra de novo no destino na próxima passada. Para quando não há mais retorno.
- Lag médio do bloco: `lagAc/lagPeso`. Para resultado, pós-venda e compromisso:
  - `contratado = proc × ticket`;
  - `margem = proc × ticket × margem%`;
  - `fracPeriodo = clamp((D − lag)/D, 0, 1)`, com D = `diasPeriodo`;
  - `noPeriodo = proc × fracPeriodo`.
  Isso trata a premissa de entradas uniformes ao longo do período, em que só o que cabe no prazo do ciclo cai dentro dele.
- Resultados são esperados (médias) e frações aparecem de propósito.

### 4.5 Rendimento: `gsRendimento` (motor:151)
Para cada nó n, injeta 1 unidade em n sem capacidade e lê `proc[alvo]`. Resultado: "quanto do alvo sai por unidade colocada neste bloco". É a chave de todo o resto (reverso, impacto, esforço). Exemplo fixado em teste: 0,02625 venda por lead = 0,3 × 0,7 × 0,5 × 0,25.

### 4.6 Cálculo reverso: `gsReverso` (motor:156)
1. Valida. Se houver erro, recusa.
2. Meta em R$: `alvoVol = meta / ticket` do bloco resultado. Sem ticket, recusa com explicação.
3. `alvoInteiro = gsTeto(alvoVol)`, que é `ceil(v − 1e-7)`. Nunca existe fração de venda.
4. Pipeline aberto contribui: `contrib = Σ estoque[n] × rendimento[n]`; `falta = max(0, alvoInteiro − contrib)`.
5. As entradas com rendimento positivo dividem a necessidade na proporção do `vol` informado (ou do `mix`), ou em partes iguais se não houver pesos: `k = falta / Σ(peso_n/Σpeso × rend_n)` e `entExato[n] = k × peso_n/Σpeso`.
6. Exato por nó = `gsDireto` com as entradas exatas. Inteiro por nó = `ceil` de cada volume exato. Há também `comInteiros` (rodando as entradas arredondadas) e `resultadoComInteiros`. As frações atravessam a cadeia e o arredondamento para cima é feito uma só vez, em cada número mostrado.
7. Impossibilidades: capacidade (`req > cap`) e limite da fonte (`req > limite`, só em entrada). Aviso quando há taxas no caminho sem evidência histórica.
8. Se nenhuma entrada chega ao resultado, a mensagem lista as taxas que faltam.

### 4.7 Sensibilidade: `gsSensibilidade` (motor:193)
- Para cada taxa: resultado em `t−pp` e `t+pp` (padrão 5 p.p., ou a banda de Wilson se informada). Amplitude = `rHi − rLo`. Derivada numérica com h=0,001. `ppPorUm = 1/derivada × 100`, ou seja, quantos pontos percentuais de taxa dão +1 no resultado.
- Para cada entrada com volume: ±10%, e `porUm = vol/R0`, quantas entradas a mais dão +1 resultado.
- Lista ordenada por amplitude. "Incerta" = fonte sem evidência ou `n < minN`. Alerta quando uma variável incerta move >20% do resultado base.

### 4.8 Comparação de cenários: `gsComparar` (motor:214)
Para cada cenário: parâmetros, validação, direto, reverso (se há meta), sensibilidade, premissas e "lacunas" (sem taxa ou hipótese não validada). `viavel` só existe se houver capacidade ou limite declarado. Caso contrário é `null`, com a condição "viabilidade não avaliada". Nunca diz "sim" por omissão.

### 4.9 Prontidão da campanha: `gsProntidao` (motor:227)
Dez itens, cada um completo, pendente, frágil ou bloqueador, com o "porquê" em texto.
- público (essencial): ICP e critérios;
- oferta: produto, valor e condições;
- demanda (essencial): bloqueador se não há canal;
- processo (essencial): sem funil ou funil com erro = bloqueador;
- evidência: frágil se menos de 70% das taxas têm fonte histórica ou benchmark e `n ≥ 5`;
- volume: bloqueador se a fonte não entrega o que o reverso pede;
- capacidade e entrega: bloqueador se o reverso estoura capacidade declarada;
- financeiro: ticket, orçamento, margem e condição de pagamento;
- medição (essencial): entrada e resultado ligados ao CRM;
- decisão (essencial): métrica, amostra ou duração e limites.

`pronto = sem bloqueador e sem pendente essencial`. Não existe nota de probabilidade, e isso é fixado em teste.

### 4.10 Monitor: `gsMonitorar` (motor:275)
Parâmetros: `minN=5`, `minVol=3`, tolerância de atenção 0,9 e de "fora" 0,75.

**Por bloco.**
- `fracAte(lag) = clamp((decorridos − lag)/D, 0, 1)`. O esperado é `plano × fracAte`, para não chamar de ruim uma etapa que ainda nem deveria ter recebido volume.
- Estado: sem dado ou sem vínculo = insuficiente. Esperado e real ambos <3 = insuficiente. Caso contrário `razao = real/esperado`: ≥0,9 dentro; ≥0,75 atenção; abaixo disso fora.
- Se `entradas > cap × frac` = bloqueado.
- Projetado = `real/frac` (só se `frac ≥ 0,15`).
- `deficit = max(0, esperado − real)`. `impactoVol = deficit × rendimento[bloco]`. `impactoRec = impactoVol × ticket`.

**Por conexão.**
- Coorte real `k/n` contra a taxa planejada.
- Estados: `n < minN` = insuficiente. `Wilson_superior < taxa` = fora. `real < taxa − 0,05` ou `< 0,85 × taxa` = atenção. Senão, dentro.
- Coorte imatura (ainda amadurecendo, fim do período < 30 dias atrás) rebaixa "fora" para "atenção".
- `perdidos = (taxa − real) × n`. `impactoVol = perdidos × rendimento[destino]`. `impactoRec = impactoVol × ticket`.

**Diagnósticos gerados:**
- entrada_baixa;
- conversao_baixa;
- acumulo, pela lei de Little: `saldoEsperado = plano/D × prazo`; dispara se `saldo ≥ max(3, 1,5 × esperado)`;
- tempo_acima: ≥30% da etapa acima do prazo;
- perdas_motivo: motivo ≥50% de ≥3 perdas;
- dependencia: origem ≥70% de ≥10 entradas;
- canal_qualidade: canal ≥30% da coorte que converte <50% do resto;
- qualidade_dados: passagem do período >105%, ou blocos sem acesso;
- capacidade_entrega;
- volume_meta: `projeção = realizado + pipeline × rendimento + entradas restantes × (1 − dec/D) × rendimento`; dispara se `gap > 0,5`, "fora" se `projeção < 0,75 × meta`.

Cada diagnóstico traz evidência numérica, consequência provável e lista "para investigar (hipóteses de causa, não conclusões)", tirada de `GS_INVESTIGAR`. Ordem: fora, bloqueado, atenção, insuficiente, depois por impacto. O "principal gargalo" é o maior `impactoVol` entre conversão baixa e entrada baixa.

### 4.11 Antes e depois de uma ação: `gsAntesDepois` (motor:339)
Coortes de 60 dias antes e de depois da data da ação, na mesma conexão. "Melhorou" se o piso do IC de 95% de depois > teto de antes; "piorou" se o contrário; "igual" se há sobreposição; "amostra" se algum lado tem `n < minN`. O texto sempre avisa que associação no tempo não prova causa.

### 4.12 Wilson: `gsWilson` (motor:260), z=1,96. Teste: 5/10 → 23,7% a 76,3%.

### 4.13 Coorte e vínculo com o CRM (tela)
- `gsEntFn` (tela:92) devolve, por vínculo, a data em que o negócio "entrou" no bloco. Lead = `criadoEm`. Etapa/ganho = `prodEntrou(d, etapa)`, que é a mesma regra de todo o LAB. Proposta = menor `prontaEm` das versões. OS = datas dos projetos. Perdido = `gsPerdaEm`. Cada negócio conta uma vez.
- `gsCoorte` (tela:125): dos negócios que entraram em "de" no período [a,b), quantos chegaram a "para" até hoje. É a mesma definição de `lpCoorte`, a coorte do Planejamento. Também devolve `porCanal`, `imaturo` (b > hoje − 30 d) e `diasMed` (mediana de dias entre os eventos).
- Janela histórica de premissas: 180 dias que terminam 30 dias atrás (`gsJanelaHist`), para a coorte amadurecer.
- `gsPreencherHistorico` (tela:716): taxa = `k/n`, fonte historico, dias = mediana. Volume de entrada = média por período dos últimos 90 dias. Ticket = ticket médio das vendas dos últimos 180 dias.
- Cenários pela banda: conservador = limite inferior de Wilson, otimista = limite superior (`gsCenariosHistorico`, tela:785), só onde `n ≥ minN`. O resto fica igual ao base e é marcado como lacuna.

### 4.14 Publicação e levar ao Planejamento
- `gsPublicar` (tela:743) bloqueia se houver erro de validação. Mostra resultado esperado, entradas pedidas pela meta, compatibilidade com capacidade e lacunas. Pede validade (por padrão, o ciclo atual) e motivo. Grava `pub.vN` com snapshot.
- O plano vigente é a publicação de maior `n` cuja validade cobre hoje (`gsPubVigente`). Mudar depois mostra "alterações não publicadas" (`gsMudouDesde` compara nós e arestas, ignorando posição x/y).
- `gsMapaPlano` (tela:766): só as 4 taxas que têm lugar no Planejamento — `lead>reuniao_ag→lead_ag`, `reuniao_ag>reuniao_ok→ag_real`, `reuniao_ok>sql→real_oport`, `sql>ganho→oport_venda` — mais o ticket, e só quando os vínculos batem. `gsLevarAoPlano` grava em `premissas` do plano do ciclo com `origem:'studio'`, modelo e versão, com histórico de→para. Não ativa o plano nem gera metas.

### 4.15 Campanha: custo e retorno (tela:611)
`CAC estimado = orçamento / (vendas esperadas por período × dias da campanha / dias do período)`. `Retorno = vendasCamp × ticket × margem − orçamento`. A tela avisa que o CAC medido só existe depois, com o investimento lançado.

### 4.16 Construtor (cons)
**Modelo `lbcModelo` (cons:164).** População = negócios do escopo (equipe, vendedor ou canal) criados no período. Entradas:
- L = leads;
- conversões por etapa: `lbcConvElegivel` (cons:151) = `avançaram / (avançaram + perdidos na etapa + parados além do prazo)`. Ficam de fora os que ainda estão na etapa dentro do prazo (lead: 5 dias de cadência; demais: `max(7, 2 × prazo da etapa)`) e os que têm reunião futura na agenda. Sem elegível, a taxa é `null`, nunca 0 inventado;
- ticket, kWp médio;
- margem %: de custos lançados nas vendas; senão, estimativa pela regra da Precificação no projeto-exemplo, marcada como estimativa;
- kit %, comissão, impostos e taxas % (custo lançado ou Precificação);
- caixa no mês da venda (forma de pagamento);
- custos fixos mensais × meses do período;
- marketing (inv, imp, cli) por canal e mês, lançado pelo administrador.

**Derivadas `lbcDerivar` (cons:182).**
- `V = L × Π conv` (ou `L × total`).
- `R = V × ticket`.
- `margem = R × mPct`, ou `V × (ticket − custo por venda)` quando o custo foi fixado. Menos `R × dDed` (comissão/imposto/taxa alterados saem inteiros da margem).
- `mm = margem − inv`.
- `caixa = R × cx`.
- `CAC = inv/V`. `ROAS = R/inv`. `CPL = inv/Lp`. `CTR = cli/imp`. `CPC = inv/cli`.
- `tpm` (ticket que preserva a margem % de hoje) = `custo/(1 − mPct₀)`.
- `vnec` (vendas para manter a margem em R$) = `margem₀ / (ticket − custo)`.
- `ro = (mm ou margem) − fixos`. `pe = (fixos + inv) / margem por venda`.

**Aplicação de uma condição `lbcAplicar` (cons:221).** Subir pela árvore, mantendo constante tudo que não foi alterado:
- inv/imp: variam juntos (mesmo CPM, CTR, CPC e conversão em lead). Só os leads pagos mudam.
- ctr/cpc/tx/cpl: recalculam cliques e leads pagos.
- nVend/lpv: `L = vendedores × leads por vendedor`.
- L: opção "manter investimento" (CPL muda) ou "manter CPL" (investimento acompanha).
- Conversão entre etapas i→j: com 1 passagem muda só ela. Com várias, três modos:
  - "distribuir": mesmo fator em cada passagem, `f = (alvo/atual)^(1/n)`, iterado até caber em 100%;
  - "tudo na primeira";
  - "tudo na última".
  Avisa o teto possível.
- ticket: manter margem % (custo acompanha) ou manter custo por venda.
- desconto: custo fixo e ticket cai em `cheio × (1 − desc)`, com o desconto saindo inteiro da margem.
- kitPct: manter preço (a diferença sai da margem) ou manter margem % (o ticket sobe).
- kwp/rkwp: viram ticket = kWp × preço por kWp.
- cx, comPct, impPct, taxaPct, fixos.

**Referências `lbcAlvo` (cons:272).** "igual a": período anterior, outro vendedor ou canal, mediana, média, quartil superior (P75, ou P25 se menor é melhor), melhor ou pior dos pares com `n ≥ minN`. "maior/menor em": por pontos percentuais, por % ou por unidade. "de": valor absoluto.

**Validações do construtor.**
- `lbcValidarCombinacao` (cons:344) impede duplicar o mesmo indicador, trechos de conversão sobrepostos e conflitos: ticket×desconto, ticket×kWp, ticket×preço por kWp, desconto×kWp, desconto×preço por kWp, mPct×kitPct, mPct×desconto. Também impede duas formas de definir o volume de leads (L, vendedores×leads por vendedor, e alavancas de marketing).
- `lbcValidarValor` (cons:358): taxa entre 0 e 100%, nada negativo, não reduzir mais de 100%.
- Indicadores de venda sem nenhuma venda na referência = erro explicativo ("não é zero").
- Sem histórico para a taxa = pede que o gestor informe a taxa como premissa.
- Alertas: amostra pequena (`n < minN`); taxas com base pequena; margem estimada; capacidade (pede mais leads/mês que o melhor mês dos últimos 12 meses × 1,05); "o LAB não modela vendedores, reuniões, instalação, compras e capital de giro suficientes".

**"Quanto precisa?" (cons:573).** Busca binária (80 iterações) no indicador escolhido até o resultado atingir o alvo, partindo do cenário A. Responde "inalcançável" quando mesmo o limite não chega.

**Hipótese gerada.** `base.impacto = resultado simulado − resultado atual`. Ao acompanhar, mede o indicador no período do teste e reaplica `lbcAplicar` sobre a base para obter o impacto observado. Status automático (cons:559): planejada, em teste, validada (valor observado melhor ou igual à meta), parcial (melhor que a base mas não a meta) ou refutada. Pode ser sobrescrito manualmente.

### 4.17 Biblioteca: condição e impacto
- Condição de ativação: `C_(met, op, extra)` com padrões (bib:10): `janela:30`, `base:'media90'`, `limiar:10`, `banda:3`, `amostraMin:5`, `histerese {folga:2, dias:14, intervalo:14}`. Operadores: AUMENTOU, DIMINUIU, ESTAVEL, ACIMA. Variações: `Cpp` (métricas em %: limiar 2 p.p., banda 1) e `C0_` (contagens em que zero é válido: `amostraMin:0`).
- Impacto: função JS `impacto(ctx)` com `ctx.v(m)` (valor na janela), `ctx.base(m)` (linha de base) e `ctx.n(m)` (amostra), que devolve `{valor, dimensao, texto, premissas[]}` ou `null`. Dimensões: contribuicao, caixa, receita, capacidade. Exemplos exatos:
  - H-COM-002 (desconto): `max(0, d−d₀) × receita / (1−d)`.
  - H-COM-003 (fechamento): `(tx_fech₀ − tx_fech) × oportunidades × ticket`.
  - H-COM-004 (lead pior): `(tx_oport₀ − tx_oport) × reuniões realizadas × tx_fech × ticket`.
  - H-COM-007 (ticket sobe, conversão cai): `oport × (t₀·ticket₀ − t·ticket)`.
  - H-COM-010 (mix): `max(0, m₀−m) × receita`.
  - H-FIN-001 e H-FIN-005: exposição de caixa (soma de pago − recebido nos projetos deficitários).
  - H-FIN-006 e H-OPE-009: `ticket × 20%` por OS atrasada ou backlog.
  - H-SOL-012: `max(0, prazo−prazo₀)/30 × custo de capital (2% ao mês) × receita`.
  - H-SOL-013: `max(0,desvio) × receita × peso do kit (45%)`.
  - H-SOL-011 e H-SOL-014: `cancelamentos × ticket`.
  - H-SOL-020: custo de retrabalho lançado.
  - 6 hipóteses (H-COM-008, H-SOL-015/016/017/018/019) têm impacto `null`.
- Hipótese por hipótese: `intervencoes[]`, `rivais[]`, `distingue` (o dado que separa a hipótese de suas rivais), `evidencia_pro`/`evidencia_contra`, `sucesso`, `nao_usar_se`.
- Intervenção (`LAB_INTERV_CORE`, bib:15): `variavel` mexida, `ataca[]`, matriz `impacto` (receita, conversão, margem, caixa, capital_giro, capacidade, risco, cada um com 0, +, ++, −, −−), `fonte`, `riscos`, `naoUsar`, `esforco` (1–3) e `prazoDias`.
- Achados compostos (bib:102): C-001 (crescimento acima da capacidade pressiona backlog e caixa), C-002 (margem perdida duas vezes: desconto e kit), C-003 (atraso de obra vira atraso de caixa).
- Tipos de achado: problema, risco, oportunidade, gargalo, anomalia, contradição, hipótese, investigação, decisão pendente, aprendizado.

## 5. O que os testes garantem

**studio.test.js** (motor puro; modelo do briefing: 1.000 leads → 30% → 70% → 50% → 25%, ticket R$ 30.000).
- Cálculo direto: 1.000 → 300 → 210 → 105 → 26,25 vendas e R$ 787.500 contratados. Perda implícita de L = 700. Fluxo a2 = 210. Mudar a1 para 40% recalcula tudo (35 vendas).
- Reverso: 20 vendas pedem 762 leads (exato 761,9 sobe para cima); etapas arredondadas 229, 160, 80; rendimento 0,02625 por lead; aviso de taxas sem evidência. Meta em R$: 600 mil = 20 vendas; 610 mil = 21 (nunca fração). Pipeline aberto: 40 oportunidades × 25% = 10, faltam 10, o que dá 381 leads. Sem ticket: explica e não calcula. Sem taxa no caminho: diz qual ("Reunião realizada → Oportunidade").
- Decisão: 100 leads dão 60/30/10 e 30 vendas. Saídas somando 120% = erro; somando 90% = aviso.
- Convergência: C recebe 20 direto + 20 via B = 40, e o aviso de dupla contagem some com `exclusiva`.
- Ciclo sem regra = erro e nenhum número. Retorno com 1 volta: 100 entram, 30 voltam, 130 em N, 39 vendas. Com 3 voltas, `30 × (1 + 0,3 + 0,09 + 0,027)`. `maxVoltas=0` = erro. Reverso com retorno usa menos entradas que `ceil(40/0,3)`.
- Capacidade: 210 chegam, 150 processados, 60 em fila, e o seguinte recebe só 75. O reverso acima da capacidade acusa meta impossível. Fonte com limite 800 acusa impossível para 30 vendas.
- Validações: taxa 140% erro; R$ ligado a contagem erro; bloco órfão aviso; sem entrada erro; conexão duplicada aviso; capacidade negativa erro.
- Cenários: conservador (800 leads e 20%) dá 14 vendas, base fica 26,25. O modelo não é alterado. `alterados` traz a natureza. Cenário altera capacidade sem perder o resto do bloco. Comparação sem capacidade nem limite: `viavel===null`, "não avaliada". Com limite 700: `viavel===false`.
- Sensibilidade: 5 linhas (4 taxas + 1 volume). ±5 p.p. em oportunidade→venda move mais que em lead→agendamento. +1 venda pede ≈ 0,95 p.p. (100/105) ou 38,1 leads (1000/26,25). Alerta para premissa hipotética de grande efeito. A banda histórica substitui o ±p.p.
- Defasagem: dias 3+4+2+21 = 30 → `fracPeriodo=0`. Com 6 dias no último passo (15 de ciclo), `fracPeriodo=0,5` e `noPeriodo=13,125`.
- Prontidão: campanha vazia = não pronta, ≥3 bloqueadores. Campanha completa = pronta, com evidência "frágil" (não bloqueia). Meta acima de fonte e capacidade = bloqueadores em volume e capacidade. Não existe campo `nota` nem `probabilidade`.
- Monitor (obs: leads 480; conversões a1 140/480, a3 20/100 imatura, a4 1/3): leads 480 contra 500 esperados à metade = dentro; oportunidades 2 contra 52,5 = fora; amostra 3 = insuficiente com motivo "amostra"; 20/100 contra 50% com coorte imatura = atenção, "amadurecendo"; 140/480 (29%) contra 30% = dentro; `perdidos`=30, `impactoVol`=7,5, `impactoRec`=R$ 225.000; diagnóstico sem culpar pessoa ("a causa precisa de evidência adicional"); acúmulo de Little (30 na etapa, fluxo sustenta 20); dependência de origem (83% Tráfego Pago); canal com volume e pouca passagem; volume insuficiente para a meta; evidência formatada com vírgula ("20,5", não "20.46"). Início do período (0,1 dia) = insuficiente ou dentro, nunca fora. Bloco sem vínculo = "bloco sem vínculo com o CRM". Entradas acima da capacidade no período decorrido = bloqueado.
- Antes × depois: 20% (n 100) → 45% (n 100) = melhorou; 20% → 26% = igual; amostras 3 e 4 = amostra. Wilson 5/10 = 23,7% a 76,3%.
- Layout: camadas da esquerda para a direita, sem sobreposição.

**ui/lab_studio.mjs** (Playwright, relógio fixo em 23/10/2026; semente com 40 leads maduros: 20 agendam, 10 realizam, 8 SQL, 4 compram a R$ 30.000, 10 perdidos; ciclo atual com 10 leads e 1 agendamento).
- Entrada do LAB com cartão do Studio e os 5 passos.
- Funil do CRM = 11 blocos e 10 conexões ligados às etapas reais.
- Histórico: lead→reunião 50% (n=40, fonte histórico); reunião realizada→SQL 80% com 2 dias; ticket R$ 30.000.
- Taxa de 140% é recusada. Editar a taxa a transforma em premissa. Volume 30 aparece no bloco.
- Adicionar, arrastar, ligar e excluir bloco. A convergência sem exclusividade gera o aviso.
- Reverso: 6 vendas = 50 leads (60%×50%×80%×50% = 12%).
- Publicar mostra resultado, meta, validade; diz "não foi avaliada" quando não há capacidade; oferece levar 4 premissas ao Planejamento. O plano recebe 60% com `origem:'studio'` e histórico "0,45→0,6", e continua em rascunho.
- A publicação v1 tem snapshot, autor e validade 2026-10-01. Mudar depois mostra "alterações não publicadas" e a fotografia continua com 30.
- Salvar versão guarda 11 nós e o motivo. Cenários pela banda de Wilson (conservador < 80% < otimista, nota "Wilson"). A comparação cabe na tela. A sensibilidade tem ≥10 linhas.
- Monitor mostra o plano v1 e "lido agora do CRM". Gargalo: "Entrada de Lead qualificado abaixo do necessário". Leads fora do esperado (10 contra ≈22). A ação vira tarefa ligada ao modelo e não duplica.
- Campanha: bloqueador "fonte de demanda" sem nota de probabilidade; público preenchido = completo; aprovação registra quem, quando e pendências.
- Celular sem rolagem lateral. Nenhum erro no console.

**sql/lab_studio.sql** (gatilho): acrescentar `pub.v2` é aceito; mudar `v1`, apagar `pub` ou apagar modelo publicado falha com `insufficient_privilege`; marcar `apagado:true` é aceito; modelo nunca publicado pode ser apagado. A regra de quem grava está em outro teste (acessos.sql [64]), que não li.

Não há teste unitário do construtor (`lbc*`) nem da biblioteca nos arquivos desta frente. Só testei o que listei acima; não procurei testes do construtor em outros arquivos.

## 6. Comparação com o V2 atual

Li `packages/studio/src/grafo.ts` (187 linhas), `campanha.ts` (57), o início de `consultas.ts` e `hipoteses/src/motor.ts` (39).

**O que o V2 chama de Studio é o mesmo conceito, mas em versão muito reduzida.** Em comum: funil em grafo, taxa por conexão, simulação, versionamento (`studio_funil.versao`) e campanhas com plano × realizado. A diferença é de profundidade.

| Capacidade | V1 | V2 |
|---|---|---|
| Tipos de bloco | 8 (entrada, etapa, decisão, ação, compromisso, resultado, perda, pós-venda) | 3 (etapa, ganho, perdido) |
| Editor visual (arrastar, conectar, layout, zoom) | sim | não (grafo é JSON salvo por API; não vi editor) |
| Vínculo bloco↔CRM (bind) e coorte real | 7 tipos de vínculo, coorte por data de entrada, atribuição por canal | só o "funil observado": conta transições de etapas do histórico, sem coorte nem vínculo explícito; ignora voltas e as contabiliza à parte |
| Volume de entrada | declarado (`vol`) por bloco, com limite da fonte | um número de leads (`ctx.leads`) ou dado |
| Ramificação com validação de distribuição | sim (erro se soma >100%, aviso se decisão não fecha) | só `excedem` (soma >1,0001) |
| Ciclos / retornos com limite de voltas | sim (até 10) | proibidos (Kahn; erro) |
| Capacidade e fila | sim | não |
| Defasagem de tempo / fração no período | sim (`dias` por aresta) | não |
| Cálculo reverso (meta → entradas) | sim, com arredondamento só no fim, pipeline aberto abatido, impossibilidade por capacidade/fonte | não existe |
| Sensibilidade | ±p.p. por taxa e ±10% por volume, esforço "+1 resultado", alerta de premissa fraca | só alavanca fixa de +5 pontos, top 5 |
| Cenários nomeados (conservador/otimista/outros) com banda de Wilson | sim | o V2 tem cenários ±15% no Quarter (outro módulo), não no Studio |
| Natureza da premissa (histórico/premissa/benchmark/estimativa/hipótese) | sim, em toda taxa, volume e ticket | não |
| Validações | ~20 regras com gravidade | ~8 (ids, tipos, taxa 0–1, ciclo, alcance, etapa sem saída) |
| Publicação como plano oficial, imutável, com validade | sim, com gatilho no banco | não |
| Monitor planejado × realizado por bloco e conexão, com estados e diagnósticos | sim (o maior bloco do V1) | não; só `desvios()` de campanha (5 números) |
| Diagnóstico → Tarefa → antes/depois | sim | não |
| Publicar premissa ao Planejamento | sim | não |

**Campanhas.** O V1 tem briefing de 6 seções (~45 campos), funil próprio, prontidão em 10 critérios, aprovação, decisão pós-teste e aprendizado. O V2 tem `projetar` (orçamento ÷ CPL → leads → funil → vendas, receita, CAC, ROI, MC−orçamento, alavancas) e `desvios` (leads, vendas, receita, CAC, ROI). A projeção financeira do V2 é um recorte útil e correto, mais enxuto que o do V1 (CAC e retorno estimados no V1, tela:611). O V2 tem a vantagem de usar CPL e margem do histórico por fórmula. Faltam todo o raciocínio de viabilidade, o checklist, o critério de decisão e a memória do aprendizado. O V2 tem experimentos e decisões em outras tabelas, o que pode cobrir parte da decisão. Não verifiquei se há ligação entre campanha e experimento.

**Hipóteses.** O V2 usa condição e impacto em R$ como texto (analisador próprio, 3 valores lógicos), por pack, com `chave`, `titulo`, `acao`, `severidade`, `quando` e `impacto`. Isso é mais limpo e auditável do que as funções JS do V1 e mais seguro de editar. Mas o V1 entrega muito mais metadados por hipótese, e é isso que a torna útil para decidir: `mecanismo`, `rivais`, `distingue` (o dado que separa duas explicações), evidências a favor e contra, intervenções ligadas com matriz de efeito (receita, conversão, margem, caixa, capital de giro, capacidade, risco) e `esforco`/`prazoDias`, `nao_usar_se`, `sucesso` e `segmentos`. Também tem achados compostos (C-001 a C-003) e a ligação Studio→biblioteca. Pelo que li do motor V2, o achado devolve título, ação, severidade, impacto e evidências, sem rivais, sem "dado discriminante" e sem intervenção estruturada. O V2 tem a vantagem do "orçamento de atenção" (só N achados) e de sinalizar `semDados`/`errosDeFormula`; não vi o equivalente no V1 desta frente.

**Construtor de hipóteses.** Não existe no V2. É o maior buraco desta frente: o V2 não responde "se a conversão do closer fosse a da mediana dos closers, quanto isso valeria em margem e caixa?". As alavancas de +5 pontos do Studio V2 cobrem só a parte "uma taxa sobe X pontos, quantas vendas", em funil linear, sem comparação com pares, sem custo, margem, caixa nem marketing. O V2 tem experimentos com baseline/alvo/medição, que equivalem ao fim do fluxo "transformar em hipótese para testar" do V1, mas sem a simulação que gera a meta e o impacto estimado.

**Resumo crítico.** O V2 entregou o esqueleto matemático certo (grafo, topologia, simulação, projeção de campanha, linguagem unificada de fórmula). O que ele não tem é o que faz o V1 servir de "Jarvis": ligar o desenho ao realizado (monitor), dizer onde está o furo em R$ e por quê, e ter uma biblioteca de causas e intervenções.

## 7. O que isso entrega que uma planilha não entrega

- Coorte real e vínculo com o CRM: a taxa "50% (20 de 40)" vem dos negócios, não de digitação, com intervalo de confiança e marca de coorte ainda amadurecendo. Uma planilha não lê o CRM sozinha.
- Plano congelado × realizado vivo: a publicação é imutável (gatilho no banco) e o monitor relê o CRM a cada movimentação. Na planilha, a premissa e o realizado se misturam.
- Estado "dados insuficientes" no lugar de falso alarme: o monitor desconta o atraso do processo (defasagem), exige amostra mínima e rebaixa coorte imatura. Planilha não faz isso.
- Impacto em R$ por gargalo, com causa tratada como hipótese a investigar, sem culpar pessoas, e com ação que vira Tarefa e é avaliada pela mesma coorte antes e depois (IC de 95%).
- Reverso inteiro com capacidade e limite da fonte: "para 20 vendas, 762 leads; a fonte só entrega 700, meta impossível". Em planilha, isso exige solver.
- Retorno, ramificação e fila, com bloqueio de dupla contagem e de ciclo.
- Honestidade epistêmica embutida: toda taxa carrega a natureza (histórico, premissa, hipótese). O sistema recusa dizer "viável" sem capacidade declarada e dá alerta quando o resultado depende de premissa sem evidência.
- Construtor: a pergunta é escrita como se fala. As premissas constantes, a fonte de cada número e a ordem das contas são mostradas. A pergunta salva se recalcula com dados de hoje e vira hipótese testável com status automático.
- Biblioteca: o conhecimento acumulado (mecanismo, rivais, dado que distingue, quando não usar) aparece junto do sinal que disparou. A planilha não traz isso.

## 8. Riscos e armadilhas ao portar para o V2

1. **Não repita a "unificação" imaginada.** No V1 os dois motores são separados de propósito (Construtor: funil linear e árvore financeira; Studio: grafo). O V2 já unificou a linguagem de fórmula, o que é bom. Resista à tentação de colar o construtor dentro do grafo: as regras de "mantendo constante" (ticket×custo, kit, desconto, comissão) não existem no grafo.
2. **O V1 guarda tudo em JSON de documento único, com patch por campo.** O V2 tem tabela própria (`studio_funil`, versionada). Ao portar, defina o que é imutável. O V1 congela só `pub.vN`. No V2 a publicação precisa de tabela própria, com trava no banco, para não depender de a aplicação se comportar bem. Cuidado também com as 2 regras de `DELETE` e `UPDATE` do gatilho.
3. **Ciclo é proibido no V2 e permitido no V1.** Retrabalho e renegociação são reais em solar (proposta revisada). Se o V2 mantiver a proibição, o observado ignora voltas e subestima o fluxo. Se adotar retorno, copie `maxVoltas` (1–10) e o erro `retorno_explosivo`, senão o laço não termina.
4. **Defasagem e período.** Sem `dias` por aresta e `fracPeriodo`, o monitor chamará de "ruim" etapas que ainda nem deveriam ter volume no meio do ciclo. A fórmula `fracAte(lag) = (decorridos − lag)/D` é essencial. Sem ela os alarmes são falsos.
5. **Coorte, não fluxo.** A passagem do período (entradas no destino ÷ entradas na origem) mistura coortes e passa de 100%. O V1 usa coorte e mostra o fluxo só como referência, com aviso `qualidade_dados`. O V2 `grafoObservado` usa transições na janela (fluxo): é o erro que o V1 evitou de propósito. Corrija ao portar.
6. **Arredondamento só no fim e `gsTeto` com tolerância** (`ceil(v − 1e-7)`). Sem isso, 105,0000000001 vira 106. Os testes fixam 762, 229, 160, 80.
7. **Regra de "contar uma vez".** Cada negócio entra uma vez em cada bloco (primeira entrada vale; retornos de etapa são contados à parte). Se o V2 contar transições em vez de negócios, haverá dupla contagem.
8. **Amostra e honestidade.** Portar `minN=5`, Wilson, "insuficiente" ≠ "ruim", e a natureza da premissa. Sem isso o V2 volta a dar número com cara de certeza.
9. **Unidades.** O V1 impede ligar R$ a contagem. Receita sai de quantidade × ticket, nunca de taxa.
10. **Permissão.** O V1 amarra gravação à chave `lab.planejamento_salvar` por políticas restritivas. No V2 (papéis gestor/sdr/closer) decida quem pode publicar e quem pode só simular.
11. **Dependência de dados que o V2 ainda não tem.** O V1 usa marcos de OS/instalação, propostas (`propostasV`), motivos de perda e kWp. O V2 não tem produção, OS, proposta/orçamento (pelo resumo). Blocos de operação e pós-venda ficariam "a instrumentar", como já ocorre no V1 em acompanhamento e indicação (tela:71-72). Não prometa o Bowtie completo antes de existir a fonte.
12. **Impacto da biblioteca depende de métricas que o V2 pode não ter** (`exposicao`, `atraso_os`, `backlog`, `custo_kit_desvio`, `cancelamentos`, `retrabalho`, `prazo_receb`). Ao portar as 20 hipóteses, marque quais são calculáveis hoje e quais ficam em `semDados`. Os fatores fixos (20% de parcela final, 2% ao mês de custo de capital, 45% de peso do kit) são premissas de negócio escondidas no código: no V2 devem virar parâmetros do pack.
13. **O motor de ativação das condições (AUMENTOU/DIMINUIU/ESTAVEL, janela, base, histerese) não está nos arquivos que li.** O V2 substituiu isso por `quando` em fórmula. Funciona, mas perde a histerese (evitar disparar e desligar toda hora). Isso merece decisão explícita.
14. **Construtor: o mais caro de portar.** Depende de custos lançados por venda, Precificação, marketing por canal/mês, forma de pagamento e agenda. A ordem sensata é migrar primeiro o núcleo funil + ticket + margem, com a margem vinda de `preco_negocio`/`MC por venda`, e deixar caixa e marketing para depois.
15. **Escala da tela.** O editor visual (~300 linhas de SVG e eventos de ponteiro) é a parte mais frágil de portar para uma tela HTML sem framework: arrastar, ligar, zoom e teclado, mais responsividade em celular (o teste fixa "sem rolagem lateral" em 390 px).
