# Frente E: motor de achados, modelo, inteligência, painéis, trilhas e casca do LAB (V1)

Convenções: "lab.js:159" = arquivo `fontes__lab.js`, linha 159. "modelo", "motor", "intel", "bib", "paineis", "trilhas" = `lab_modelo.js`, `lab_motor.js`, `lab_inteligencia.js`, `lab_biblioteca.js`, `lab_paineis.js`, `lab_trilhas.js`. As linhas vêm da numeração dos arquivos lidos (o cabeçalho de `#####` do arquivo conta como linha 1).

Ressalvas de escopo:
- O dicionário de métricas do funil (`LAB_MET`, `lpMed`, `lpPlano`, `lpVendas`) mora em `lab_plan.js`, que não era minha frente. Aqui só vejo quem o chama.
- O texto "Briefing Master" aparece uma única vez, no cabeçalho do `modelo` (linha 2). O documento em si não está nos arquivos. O que existe são referências numeradas "§" espalhadas pelo código (§10, §20, §111–117, §119–124, §129, §133, §139–155, §164–168). Elas mostram que o roteiro tem pelo menos 168 seções. Não dá para reconstruir o Briefing Master inteiro, só as partes que viraram código.

---

## 1. Para que serve cada parte (em termos de trabalho de RevOps)

### 1.1 A casca: quatro trilhas, não três
`lab.js` é a casca e o orquestrador: guarda o estado (`LAB`), os filtros, calcula uma vez por tela o pacote `labCalc()` e despacha para a tela certa. O princípio está no cabeçalho (lab.js:3-8): "O CRM registra a operação; o LAB entende a operação". Três estados nunca se misturam: REALIZADO, PROJETADO e SIMULADO (legenda de cores no rodapé de toda tela, trilhas:106). A fórmula-mãe é `receita = entradas × taxa etapa 1 × taxa etapa 2 × … × ticket médio`.

`trilhas.js` (comentário de 12/10/2026) organiza tudo em **perguntas de entrada**. O roteiro original tinha três (Passado, Mês, Futuro). O código atual tem **quatro trilhas** (trilhas:10-15), e o teste confirma "passado · mês · futuro · Studio":

| Trilha | Pergunta | O que responde |
|---|---|---|
| Analisar o passado | "O que aconteceu?" | Resultado, funil, pessoas, origens, preço e operação de um período escolhido. Onde trava e por quê. |
| Planejar e acompanhar o mês | "Como está o ciclo?" | Meta, plano, dia a dia, sinais de desvio e fechamento do ciclo comercial atual. |
| Projetar e simular o futuro | "E se…?" | Quarter, quanto precisa acontecer para bater a meta, cenários, simulações que não gravam nada. |
| GTM & Revenue Studio | "Como o resultado é gerado?" | Desenhar a estratégia, calcular o que ela exige, publicar como plano e acompanhar com dados do CRM. |

São **36 passos** (12 no Passado, 11 no Mês, 8 no Futuro, 5 no Studio). Cada passo é uma tela que já existia. A trilha só decide ordem e o que fica aberto (trilhas:17-59). Os passos:
- **Passado (12):** Relatório da última semana, Resultado do período, Funil e conversões, Onde está travando, Pessoas, Origens e o que anda junto, Tempo até fechar, Preço e margem, Operação e entrega, Achados e hipóteses, Qualidade dos dados, Meus painéis.
- **Mês (11):** Como está o mês, Projeção para esta semana, Contingência do ciclo, Fechamento do dia, Plano do dia, Metas e o que precisa acontecer, Equipe e metas por pessoa, Dia a dia, Sinais e correção de rota, Hipóteses do mês, Fechamento e aprendizado.
- **Futuro (8):** Planejar o quarter, Quanto preciso gerar?, Cenários do ciclo, Simular variáveis, Simular uma hipótese, Programa de ciclos, Projeção de marketing, Curva de caixa.
- **Studio (5):** Visão geral, Funis, Campanhas e GTM, Simulações, Monitoramento.

Por baixo há **26 abas** (`LAB_ABAS`, lab.js:12-13). O comentário "19 abas" em trilhas:4 está desatualizado. Um teste de UI garante que toda aba está em exatamente um passo.

A entrada (`ltLanding`, trilhas:82) é a tela "O que você quer fazer hoje?": 4 cartões, atalhos grandes (Relatório da última semana, Meus painéis, Projeção da semana, Desenhar um funil, Acompanhar o plano publicado), o bloco do plano do mês (`lpHomeBloco`) e "Perguntas rápidas" (`LAB_PERG`, lab.js:251, 13 perguntas como "Onde estamos perdendo receita?", "E se a conversão subir 20%?", "Qual vendedor precisa de mais volume?").

Há também a jornada em sete perguntas (lab.js:295): Onde está minha receita → Onde estou perdendo → Por quê → Qual variável altero → Quanto impacta → Vamos testar → Funcionou?

### 1.2 O que cada tela do "Passado" e do "Futuro" responde (funil clássico, lab.js)
- **Resultado do período** (trilhas:147): receita realizada, entradas, conversão geral, ticket, ciclo (cada um com comparação contra o período anterior), funil da coorte, principal gargalo, alertas de inteligência, os 3 achados do motor.
- **Funil e conversões** (`labTelaFunil`, lab.js:311): volume por etapa, conversão da etapa anterior com intervalo de Wilson, perda, tempo na etapa, valor envolvido, benchmark (quartil superior e mediana dos vendedores), período anterior e **receita potencial** se a etapa chegasse ao benchmark. Mostra a conta passo a passo (`labPassos`).
- **Onde está travando** (`labTelaAlav`, lab.js:478): gargalos ordenados por receita potencial, quem está abaixo, e sensibilidade (+10% em cada variável: qual move mais a receita).
- **Pessoas** (`labTelaVend`, lab.js:355, e `labTelaProd`, lab.js:554): página do vendedor (pontos fortes, gargalos, impacto potencial), comparação com equipe/mediana/quartil superior/outro vendedor, matriz volume × eficiência com hipótese de investigação por quadrante, produtividade (contatos/dia, receita por oportunidade, por reunião, por dia produtivo).
- **Origens e o que anda junto** (`labTelaCorr`, lab.js:506): correlações de Pearson e tabelas por origem, tipo de cliente e vendedor.
- **Tempo até fechar** (`labTelaTempo`, lab.js:531): tempo por etapa, rápidas × lentas, cohorts por mês de entrada (reunião 7d/30d, venda 14d/30d/60d).
- **Preço e margem** (`labTelaPreco`, lab.js:617): recomendado × aprovado × final, desconto médio, MC perdida no desconto, abaixo do limite/piso, MC por vendedor, ticket × contribuição, preço × conversão, produto e condição de pagamento, custo estimado × realizado.
- **Quanto preciso gerar?** (`labTelaMeta`, lab.js:452): engenharia reversa da meta, arredondando para cima em cada etapa; mais as alavancas isoladas para zerar o gap.
- **Simular variáveis** (`labTelaSim`, lab.js:414): entradas, taxas e ticket editáveis, atalhos (+20% nas conversões, tudo no benchmark, +10% volume, +10% ticket) e "transferência de performance" entre vendedores (`labTransf`).
- **Curva de caixa** (`labTelaCaixa`, motor:223): quanto caixa a empresa adianta por condição de pagamento, pontos de equilíbrio e exposição agregada dos projetos em 12 semanas. Responde "posso vender mais?".

### 1.3 O "motor de achados"
É a parte que transforma o LAB de painel em consultor (`lab_motor.js` + `lab_biblioteca.js`, o "LAB v3"). Em termos de RevOps:
- Existe uma **biblioteca de 20 hipóteses** escritas como dados (10 universais "Core" e 10 do "Solar Intelligence Pack"). Exemplos: H-FIN-001 "Crescimento comercial consumindo caixa", H-COM-002 "Crescimento comprado com desconto", H-COM-003 "Gargalo comercial no fechamento", H-COM-004 "lead pior", H-OPE-009 "Capacidade operacional virou gargalo", H-SOL-013 "Erosão de margem entre proposta e compra", H-SOL-014 "Cancelamento pós-venda inflando o resultado".
- Cada hipótese tem condições sobre métricas do dicionário (ex.: receita AUMENTOU, desconto_medio AUMENTOU, margem_contrib DIMINUIU, custo_var_venda ESTAVEL), mecanismo, rivais, "dado que distingue" as rivais, evidência a favor e contra, intervenções, simulações, critério de sucesso e "não usar se".
- O motor mede, avalia, calcula o **impacto em reais**, a confiança, a prioridade e devolve uma lista ordenada. A lista respeita um **orçamento de atenção** (padrão 5 achados na tela). O resto fica numa dobra.
- O princípio é "o LAB prefere dizer 'não sei' a inventar uma causa" (motor:193). Hipótese sem dado essencial ou com amostra insuficiente vira "Não sei (ainda)" com a lista do que falta.
- Cada achado abre um **Canvas de decisão** com 10 blocos (motor:203): 1 Problema, 2 Evidência, 3 Hipótese e confiança, 4 Rivais, 5 Consequências (pelo grafo), 6 Restrições, 7 Intervenções (matriz de impacto), 8 Simulação, 9 Decisão (Em tratamento / Aceito como está / Não procede), 10 Resultado e aprendizado. A pessoa pode "Registrar como experimento" a partir de uma intervenção.

### 1.4 O "modelo" (Briefing Master, seções numeradas)
`lab_modelo.js` é a camada de **contrato**. Aparece na aba "Modelo do LAB" (passo "Qualidade dos dados") e contém:
- Dicionário canônico de métricas: cada métrica é um contrato com fórmula, grão, base temporal, evento, unidade, fonte, dono, versão e decisão tomada (§111).
- Grafo de relações entre métricas (§141): 27 relações com tipo, direção, mecanismo, natureza, atraso e origem.
- Condições de regra com seis parâmetros (§114): janela, base de comparação, limiar, banda, amostra mínima, histerese.
- Qualidade da amostra (§20), rubrica de confiança (§117), níveis de inferência que travam o verbo da tela (§10), maturidade de dados 0–4 (§129), 15 "decisões de base" assumidas em 08/10/2026 (§139) e convenções de unidade (§113).
- A tela Modelo também mostra a **"Saúde da inteligência"** (intel:118): o LAB mede a si mesmo.

### 1.5 Inteligência aplicada (`lab_inteligencia.js`)
- **Acurácia do forecast** (erro e viés, por antecedência e por vendedor).
- **Build-up faseado**: quando os leads precisam entrar e se o time comporta as reuniões.
- **Ponte (waterfall)** de receita e de margem, com categoria do desvio plano × realizado.
- **Métricas de proteção**: volume sobe e a qualidade piora.
- **Contribuição necessária** no mês (venda → custo fixo → lucro).
- API interna de consulta (`AMS._labv3`, intel:126) para IA ou outras interfaces: `get_metric`, `explain_metric`, `get_hypotheses`, `get_accuracy`, `get_health` etc.

### 1.6 Painéis (`lab_paineis.js`, 19/10/2026)
Construtor de dashboards estilo Looker Studio, feito para qualquer pessoa montar o próprio painel: escolhe indicadores, o recorte (tempo, pessoa, origem, natureza financeira, grupo da DRE) e o tipo de gráfico. Nada é recalculado: cada indicador chama a função dona do número. O painel só guarda a escolha.

---

## 2. Telas e interações

**Navegação global.** Endereços: `#lab`, `#lab/<aba>`, `#lab/plan/<sub>`, `#lab/studio/<passo>`, `#lab/paineis/<id>`. Barra do topo com migalha "LAB › trilha › passo" e botões das quatro trilhas. Trilho lateral com os passos da trilha (no celular vira faixa rolável). Rodapé com "‹ anterior" e "próximo ›". Cada passo tem título (h1) e frase "para que serve".

**Filtros do LAB** (`labFiltrosHtml`, lab.js:227). Ficam recolhidos num `<details>` com resumo em chips (período, funil, vendedor, "n mínimo"). Só aparecem nos passos que os usam (`filtros:true`). Campos:
- Período: este mês (ciclo), mês passado, 90d, 180d, ano, 12m, todo o histórico, personalizado (lab.js:15).
- Funil (pipeline).
- Vendedor (multisseleção).
- Origem.
- Tipo de cliente.
- Cidade.
- "Analisar a partir de" (data de corte do histórico confiável, só quem tem `lab.configurar` edita).
- Base das taxas: "Todas as entradas" ou "Só encerradas".

**Dobras.** Cada passo mostra só as N primeiras seções (`data-ltess`). As demais ficam como lista de títulos no índice "Nesta tela". Clique no "+" abre. "Abrir tudo" vira preferência (`PREF ltTudo`). O estado aberto/fechado é lembrado enquanto a sessão dura. Telas com menos de 3 seções não dobram (trilhas:131).

**Interações de detalhe.**
- Clicar numa etapa do funil abre o drill-down: conversão por vendedor, origem, mês de entrada e tipo de cliente, cada uma com IC 95%, e botão "Simular esta etapa" (`labDrill`, lab.js:327).
- Clicar no número abre a **lista dos leads** daquela etapa (`labLeads`, lab.js:341) com nome (abre o negócio), etapa atual, vendedor, origem, data de entrada e data em que chegou na etapa.
- Cartões de alerta e KPIs são botões que levam à tela de origem.
- A tela é redesenhada sem roubar foco: se há campo em foco, o redesenho espera (`LAB.pend`, lab.js:213).

**Achados.**
- Lista numerada com cartão por achado: nome, tipo, código e versão, "composto de", tag de confiança, impacto em R$ + dimensão (contribuição/caixa/capacidade) + custo da inação por mês, rivais ativas, eventos de contexto, marca atual, botão "Abrir a decisão".
- Dobras: "Mais N achados fora do orçamento de atenção", "N aceitos/não procede", "Modo sombra" (só para quem cura a biblioteca).
- **Diário de contexto**: o gestor registra eventos fora do sistema (reajuste tarifário, saída de vendedor, troca de fornecedor, campanha), com data, áreas e descrição. Eventos próximos entram como explicação rival.

**Hipóteses (aba `hip`, lab.js:780).**
- Formulário: título, problema, hipótese, variável, escopo, meta, início/fim, responsável. O baseline é medido na hora.
- Cartões com baseline, meta, resultado observado e impacto estimado e observado.
- Status automático (Planejada, Em teste, Validada, Parcialmente validada, Refutada) ou manual.
- "Registrar aprendizado" e "Memória comercial" (hipóteses concluídas).
- Sugestões automáticas: as 3 etapas com maior receita potencial.

**Painéis.**
- Abas por painel, "+ Novo painel", seletor "Modelos prontos". Há 4 modelos: Comercial da semana, Pré-vendas, Origens (canais), Financeiro.
- Cabeçalho com nome editável, "Quem vê" (Só eu / Todos do LAB), Métricas calculadas, Duplicar, Excluir.
- Filtros do painel: período (10 opções), comparar com (período anterior / mesmo período do ano passado / sem), funil, pessoa, origem.
- Grade de gráficos com largura de ¼ a tela inteira. Cada gráfico tem botões mover, editar, duplicar, remover. Alterna gráfico/tabela (acessibilidade).
- Editor com **prévia ao vivo**.
- Quem não é dono vê o painel mas só mexe nos filtros da própria sessão (`PN_FSESSAO`, não grava).

**Painéis: 9 tipos de visual** (paineis:57): Números (cartões com variação e minigráfico), Evolução no tempo (nunca dois eixos: unidades diferentes viram gráficos lado a lado; opção "base 100"), Colunas, Ranking, Rosca, Dispersão (com reta de tendência e r), Tabela (cor de intensidade opcional, total no rodapé para métricas aditivas), Funil, Texto.

**Relatório da última semana e Projeção da semana** (`lab_semana.js`, `lab_projsemana.js`, fora do meu escopo de leitura, mas testados no mesmo teste): "deu certo / deu errado / possíveis causas / hipóteses de solução com 'como testar' e 'funcionou se'", navegação ‹ semana anterior.

---

## 3. Modelo de dados

**Tudo é "documento JSON por chave"** numa tabela `public.gestao (id text, dados jsonb)`. No front, `G('lab')`, `patchG('lab:...', {...}, atraso_ms)` (mescla, não substitui) e `cache['gestao/<id>']`. Chaves usadas por esta frente:

| Chave | Conteúdo |
|---|---|
| `lab` | Configuração: `minN` (padrão 5), `inicio` (data de corte), `hipoteses{}` (cada uma com `num`, `titulo`, `variavel`, `vend`, `meta`, `ini`, `fim`, `resp`, `base{val,n,de,ate,F}`, `status`, `aprendizado`, `hist`; v2/v3 do construtor), `regras{codigo:{estado, params}}`, `amostra{insuf,lim,rel}`, `packs{solar}`, `achadosSemana`, `custoCapitalMes`, `metas` (legado), `mkt` (investimento por mês/canal), `chaves` |
| `lab:plan:<AAAA-MM>` | Plano do ciclo: `status`, `pipe`, `metas{id:{ind, alvo, escopo:'empresa'\|'pessoa', ref}}`, `cal{dias[0-6], feriados{iso:...}}`, pessoas, premissas |
| `lab:prev:<AAAA-MM>` | **Foto diária**: `dias[<AAAA-MM-DD>]` e `vend[<dia>][<pessoa>]` |
| `lab:motor` | `hist{codigo: {ligada, desde, abaixoDesde, desligouEm}}` (histerese) e `obs{codigo:{disparos, uteis, naoProcede, intervencoes, ultimo}}` (observabilidade) |
| `lab:achados` | `marcas{codigo:{estado:'tratamento'\|'aceito'\|'naoprocede', motivo, em, por, ref}}` |
| `lab:contexto` | `{id:{data, desc, areas[], por, em}}` (diário de contexto) |
| `lab:painel:<id>` | `{id, nome, dono, donoNome, vis:'eu'\|'todos', f:{per,de,ate,cmp,pipe,pessoa,canal}, calc:[{id,nome,a,op,b,un,menorMelhor}], w:[{id,tipo,t,m[],dim,larg,idx,calor,top,txt}], criadoEm, atualizadoEm, apagado}` |
| `dia:<iso>`, `metas` | Produtividade diária (legado) e `metas.independentes` (pessoas fora do plano) |

**Formato da foto do servidor** (SQL 25, `lab_foto_diaria()`):
```
{ em: epoch_ms, servidor: true,
  meta:{receita, vendas},               -- só metas com escopo 'empresa'
  receita:{real, ritmo}, vendas:{real, ritmo},
  dd: dias úteis decorridos, du: dias úteis do ciclo }
```
`ritmo = real ÷ dd × du` (arredondado a 2 casas; nulo se dd = 0). A foto completa do navegador (com `receita.ajust`, a projeção ajustada, que é o que `labAcuracia` usa) substitui a do servidor no mesmo dia.

**Regras da foto do servidor:**
- Roda no pg_cron todo dia 06:15 UTC = 03:15 de Brasília.
- Calcula o ciclo a partir de `config.geral.cicloDia` (limitado a 1–28).
- Sem plano do ciclo, não grava (`motivo:'sem plano'`).
- Nunca sobrescreve uma foto do mesmo dia (`'já havia foto'`).
- Realizado = soma de `funil.valor` dos negócios `etapa='ganho'` com `fechadoEm` no ciclo, no mesmo funil (padrão `'solar'`), excluindo `avulso=true` e as "operações independentes".
- Quem vende é o dono no último registro de ganho em `funil.hist` (`dono`); sem registro, o `consultor`.
- Dias úteis pelo calendário do plano (`cal.dias` e `cal.feriados`); sem calendário, segunda a sexta.
- Só o servidor executa: `revoke ... from authenticated`.

**Permissões de leitura/escrita (SQL 13 e 57).**
- Quem tem `lab` nível ≥ 1 lê `gestao` onde `id = 'lab'` ou `id ~ '^lab:'` (planos e histórico de previsões). Gravar continua só com o administrador, exceto painéis.
- Painéis: políticas "restritivas" (somam às de leitura). "Só eu" só o dono e o admin leem; "todos" qualquer um com LAB. Só o dono ou o admin altera, cria em nome de alguém ou apaga. Excluir marca `apagado` (reversível pelo banco).

**SQL 36** (auditoria de 20/10): refaz `lab_foto_diaria` com dias úteis pelo calendário e muda `pd_registrar_fechamento`: o primeiro fechamento do dia gravado pelo CRM vale. Cálculo diferente depois vai para `fechamento.revisoes` (as 10 mais recentes). O do servidor prevalece. Só aceita datas dos últimos 7 dias e anteriores a hoje.

---

## 4. Regras e fórmulas exatas

### 4.1 Estatística de base
- **Wilson 95%**: `wilson(k,n)` lab.js:26 e `labWilson` modelo:19. `z=1,96; p=k/n; d=1+z²/n; c=(p+z²/2n)/d; h=z·√(p(1−p)/n + z²/4n²)/d; [max(0,c−h), min(1,c+h)]`. Sem n devolve `null`.
- **Amostra mínima de exibição**: `labMinN()` = `lab.minN` ou **5** (lab.js:17). `confianca(n)` (lab.js:27): `n ≥ 30` não mostra nada; `5 ≤ n < 30` selo "n=… amostra moderada"; abaixo, "amostra pequena".
- **Faixas de qualidade da amostra** `labAmostra` (modelo:13): `< 10` insuficiente (não avalia), `< 30` limitada, `< 100` relevante, `≥ 100` robusta. Ajustável em `lab.amostra`.
- **Taxa ajustada** (modelo:17): `(k + K·taxaTime)/(n + K)`, `K=10`. Convergência para a taxa própria. Exemplo no teste: 1 em 2 com time a 20% → 25%.
- **Mediana/quantil** (lab.js:23-24): `quantil` com interpolação linear em `(n−1)·q`.
- **Benchmark por etapa** (`labCalc`, lab.js:113): só vendedores com `N[i] ≥ minN`; guarda mediana, **p75 (quartil superior)**, máximo e n.

### 4.2 Coorte, período e funil
- **Coorte** (`labCoorte`, lab.js:73): negócios **criados** no período (`criadoEm`), no funil escolhido, que passam nos filtros (vendedor, origem, tipo, cidade, `inicio`). Com `base='encerradas'`, só ganho/perdido.
- **Base** (`labBase`, lab.js:63): exclui `avulso`; cidade vem de `endereco.cidade` ou do resumo.
- **Alcance** (`labAlcance`, lab.js:47): maior etapa atingida (histórico ou atual); **salto conta como passagem** pelas anteriores.
- **Entrou em** (`labEntrouEm`, lab.js:54): primeira vez que entrou na etapa i ou posterior; etapa 0 = `criadoEm`.
- **`labFunil`** (lab.js:79): `N[i]` = quantos alcançaram a etapa i; `conv[i] = N[i+1]/N[i]`; perdas por alcance; tempos entre etapas; `ciclo` = média de (`fechadoEm − criadoEm`) dos ganhos (≥ 0); `total = N_última/N[0]`; ticket e receita de `ticketMedio(ganhos)` (uma conta de ticket para o CRM inteiro).
- **Receita** `labReceita(entradas, taxas, ticket)` (lab.js:97) = `entradas × Π taxas × ticket` (taxa nula conta 0).
- **Receita potencial** `labPotencial` (lab.js:122): troca a taxa da etapa i pelo p75 (se maior) e recalcula; ganho = diferença para a base. Cada etapa é um efeito **isolado**, e a soma "não é receita garantida" (aviso na tela).
- **Realizado** `labRealizado` (lab.js:129): ganhos com `fechadoEm` no período. A venda é de quem era dono no ganho (`vendedorDaVenda`, decisão D12).
- **Meta do período** `labMeta` (lab.js:140): `lmMetaIntervalo` (lab_metas.js). Meta oficial do ciclo rateada por dias elegíveis e pesos; **meta desconhecida em algum ciclo = sem meta, nunca soma parcial**. Teste D14: 10/jan a 20/mar cobre 3 ciclos e a meta é a soma 100+200+300 mil, não "meta × dias ÷ 30,4". Pessoa sem meta = `null`, nunca zero.

### 4.3 Forecast do mês (`labForecast`, lab.js:159)
Independe do filtro de período; olha o ciclo atual.
- Por etapa `i`, usa os **encerrados** (ganho/perdido) que alcançaram a etapa: `pv = ganhos/passaram` (chance de venda).
- `pt = % dos ganhos históricos dessa etapa cuja duração (entrada na etapa → fechadoEm) ≤ dias restantes do ciclo` (chance de fechar a tempo).
- `pond = valor(abertos dentro) × pv`; `noPrazo = valor × pv × pt`.
- **Forecast = realizado do mês + Σ noPrazo**. `gap = meta − forecast`.
- **Fora da curva** (20/10/2026): `LAB_FORA_X = 5` (lab.js:155). Limite = `5 × ticket de referência`. O ticket vem do plano (`opt.ticket`) ou, sem ele, da **mediana inferior** dos ganhos da base (`valores[floor((n−1)/2)]`, só com ≥ 3 ganhos). Negócio aberto acima do limite sai de `pond`/`noPrazo` e vai para `fora[]`, com valor, `pv`, `pt` e `esperado = v·pv·pt`, ordenado por esperado. `abertos` e `valor` continuam mostrando tudo; `foraN` conta quantos saíram. Motivo registrado: R$ 1 milhão × 32% = R$ 321 mil "previstos" pendurados num negócio só.

### 4.4 Alertas de inteligência (`labAlertas`, lab.js:186)
- **Gargalo**: vendedor com `N[i] ≥ minN` e conversão ≥ **10 p.p.** abaixo da mediana dos vendedores.
- **Oportunidade**: conversão total > **1,15×** a da equipe e volume de entradas < **0,7×** a média (com `N[0] ≥ minN`).
- **Anomalia**: taxa de ganho dos últimos 60 dias < **0,75×** a do histórico anterior (ambos com ≥ `minN` encerrados e histórico > 0).
- **Tendência**: ticket das últimas 4 semanas vs. as 4 anteriores, variação ≥ **10%**, com ≥ 3 vendas em cada.

### 4.5 Correlação e leitura (lab.js:503)
Pearson com `n ≥ 3`. Força: `<0,1` desprezível, `<0,3` fraca, `<0,5` moderada, senão forte. A "leitura" só afirma associação se `|r| ≥ 0,3` e `n ≥ 10`; sempre rotulada "Correlação ≠ causalidade". No painel (`pnLeituraR`, paineis:39) os cortes são outros: `≥0,7` forte, `≥0,4` moderada, `≥0,2` fraca, abaixo disso "praticamente nenhuma relação".

### 4.6 Dicionário de métricas (`labDic`, modelo:188)
Quatro áreas somadas em um objeto:
- **Comercial**: derivado de `LAB_MET` (lab_plan.js) + campos extras (grão, base, evento, sinônimos, decisão). Inclui leads, contatos, agendadas, ag_sdr, realizadas, compar, visitas, oport, propostas, negoc, vendas, receita, ticket, tx_agenda, tx_oport, tx_fech, tx_lead_venda, t_contato.
- **Econômico (5)**: margem_contrib (%, `(receita − impostos − taxas − custos variáveis − comissão) ÷ (receita − impostos − taxas)`), margem_valor, desconto_medio (`Σ(preço aprovado − vendido) ÷ Σ preço aprovado`), custo_var_venda, custo_kit_desvio (`(Σ pedidos do kit − Σ kit do snapshot) ÷ Σ kit do snapshot`).
- **Financeiro (8)**: recebiveis, recebido, pago, caixa_oper (`recebido − pago`), prazo_receb (média ponderada pelo valor), exposicao (`Σ(pago − recebido)` dos projetos deficitários), saldo, comprometido.
- **Operação (6)**: backlog, prazo_inst, atraso_os, retrabalho, vendas_assinadas, cancelamentos.

`labMetrica(id, a, b)` devolve `{v, n, estado:'ok'|'ausente', nota, id, un, nome, asOf, versao, janela}`.

**Bases temporais** (`LAB_BASES`): competência (resultado, DRE), caixa (liquidez), coorte (taxas de conversão).
**Convenções** (`LAB_CONVENCOES`): variação entre percentuais sempre em p.p.; "%" só para variação relativa; contagens que representam necessidade arredondam para cima; moeda sempre com período e base; comparações dizem contra o quê; indicadores "menor é melhor" levam marca; estimado e medido visualmente distintos.

### 4.7 Condição de regra (`labCondicao`, modelo:36)
Seis parâmetros: `met, op (AUMENTOU|DIMINUIU|ESTAVEL|ACIMA|ABAIXO), janela (dias), base ('anterior'|'media90'|'ano'), limiar, banda, amostraMin, histerese{folga, dias, intervalo}, ref`.
- A janela atual é `[b−janela, b)`, com `b = agora`. Para métricas de **coorte** (`LAB_COORTE = tx_agenda, tx_oport, tx_fech, tx_lead_venda`), `b = agora − 30 dias` (**coortes imaturas não entram na taxa**).
- Base: `anterior` = janela imediatamente antes; `media90` = 90 dias antes; `ano` = mesmo período do ano anterior.
- **Métricas aditivas** (`LAB_ADITIVAS`: leads, contatos, agendadas, ag_sdr, realizadas, visitas, oport, propostas, negoc, vendas, vendas_assinadas, receita, margem_valor, recebido, pago, caixa_oper, retrabalho, cancelamentos): a base é multiplicada por `janela/dias_da_base`, senão "leads em 30 dias" nunca supera "leads em 90 dias". Taxas, médias e estoques não são escalados.
- Variação (`labVariacao`): unidade `%` em **p.p.** `(atual−base)·100`; demais em % relativo `(atual−base)/|base|·100`. Base 0 gera ±Infinity (não "aumentou" de 0 para negativo). NaN = ausente.
- `ESTAVEL` testa a banda **antes de tudo** (`|Δ| ≤ banda`). `AUMENTOU` exige `Δ ≥ limiar`; `DIMINUIU`, `Δ ≤ −limiar` (tolerância EPS 1e-9).
- Estados: `ausente` (sem dado), `insuficiente` (amostra < `amostraMin`), `verdadeiro`, `falso`.
- Padrões de `C_` (bib:11): janela 30, base media90, limiar 10, banda 3, amostraMin 5, histerese folga 2 / 14 dias / intervalo 14. `Cpp` (métricas em %): limiar 2 p.p., banda 1. `C0_`: amostraMin 0 (contagens em que zero é valor legítimo: backlog, cancelamentos, atraso_os).

### 4.8 Histerese (`labHisterese`, modelo:65)
Liga quando a condição fecha (e já passou o `intervalo` desde que desligou). Uma vez ligada só desliga se o desvio voltar com folga (`|Δ| < max(0, limiar − folga)`) **por `dias` seguidos** (14). Sem dado (ausente/insuficiente) o estado **é mantido** ("queda de dados não conta como 'voltou ao normal'"). O motor chama com `limiar:1, folga:0.5` e `delta` 1e9 (ativo) ou 0 (inativo).

### 4.9 Avaliação de uma hipótese (`labMotorAvaliar`, motor:20)
1. Hipóteses em `rascunho` ou `aposentada` são puladas. `sombra` roda e registra, mas não aparece.
2. Cada condição é medida (com calibração: `regras[codigo].params[met]` vale só para aquela métrica; `params` plano vale para condições que não são ESTAVEL).
3. Condição não essencial sem dado **não derruba** a hipótese (vira "faltando", e rebaixa a confiança). Essencial sem dado → `nao_avaliavel`.
4. `aderência = verdadeiros / condições relevantes`.
   - `ativo` = todas as relevantes verdadeiras e nenhuma essencial faltando.
   - `parcial` = aderência ≥ 0,5. `inativo` caso contrário. `sem_regra` = sem condições.
5. **Amostra da hipótese** (`nMin`): menor `n` entre as condições avaliadas que declaram `amostraMin`. Contagens não entram. Se há condições avaliadas e nenhuma exige amostra, vale 1000.
6. **Impacto em R$** (função `impacto(ctx)` de cada hipótese, só se ativa ou parcial; descartado se ≤ 0). O contexto oferece `ctx.v(id)` (valor na janela), `ctx.base(id)` (na linha de base, reduzida se aditiva) e `ctx.n(id)`. Exemplos:
   - H-FIN-001 e H-FIN-005: `exposicao` (R$ de caixa preso).
   - H-COM-002: `max(0, desconto − desconto_base) × receita / (1 − desconto)`.
   - H-COM-003: `max(0, (tx_fech_base − tx_fech) × oport × ticket)`.
   - H-COM-004: `max(0, (tx_oport_base − tx_oport) × realizadas × tx_fech × ticket)`.
   - H-FIN-006: `atraso_os × ticket × 0,2` (parcela final retida).
   - H-OPE-009: `backlog × ticket × 0,2`.
   - H-COM-007: `oport × (tx_base·ticket_base − tx·ticket)`.
   - H-COM-010: `max(0, margem_base − margem) × receita`.
   - H-COM-008 e várias do pack solar: `impacto = null` (aparece "sem valor em reais").
7. **Receita vira contribuição**: se o impacto está em "receita", multiplica por `margem_contrib` da janela (se 0<m<1) ou pela margem de referência (`margemRef`, padrão 0,25; na camada do navegador `min(0,6; margemAlvo/100)`). Guarda `receitaBruta` e `margemUsada` para mostrar. Teste: (0,22−0,12)×60×20.000×0,26 = **31.200** de contribuição. Assim todos os achados disputam prioridade na mesma moeda.
8. **Rivais** (`rivaisAtivas`): rivais cadastradas que estejam `ativo` e fora de sombra, e que **não** sejam co-componentes de um composto ativo.
9. **Confiança** (`labConfianca`, modelo:77), com `rivais = nº rivais ativas + 1 se há evento de contexto relevante`:
   - `nao` (peso 0,1): amostra insuficiente ou essencial ausente.
   - `baixa` (0,3): dados incompletos, ou amostra "limitada", ou há contraevidência (`contra` hoje é sempre `false` no motor).
   - `alta` (1,0): aderência 100%, sem rival, com histórico próprio.
   - `media` (0,6): aderência 100% e no máximo 1 rival.
   - Caso contrário, `baixa`.
   - O objeto devolve também `criterios` e `subir` (o que faltaria para subir de nível). Todo cartão tem tooltip com os critérios.
10. **Prioridade** (motor:54): `impacto.valor × peso(confiança) × (parcial ? aderência : 1) ÷ esforço + (tipo risco ou gargalo ? 1 : 0)`. O `esforço` é o **menor** esforço (1–3) entre as intervenções da hipótese, e vale 2 se não houver nenhuma.
11. **Composição** (§145): `LAB_COMPOSTOS` C-001 (H-FIN-001 + H-OPE-009, crescimento acima da capacidade), C-002 (H-COM-002 + H-SOL-013, margem perdida duas vezes), C-003 (H-OPE-009 + H-FIN-006, atraso de obra virando atraso de caixa). Só existem quando **todos** os componentes estão ativos e fora de sombra. O composto: impacto = **o maior** (não a soma), confiança = a pior, prioridade = `max(prioridade dos componentes) + 2`, intervenções unidas. Os componentes ficam marcados `cobertoPor` (um problema, um cartão).
12. **Contexto**: eventos do diário entram como "explicação rival" se caem em `[início da janela − 15 dias, agora]` e se suas áreas explicam a dimensão do achado (`LAB_CTX_DIM`: contribuição → Comercial/Marketing/Fornecedor/Equipe/Tarifa; caixa → Financeiro/Operação/Fornecedor/Tarifa; capacidade → Operação/Equipe/Fornecedor; receita → Comercial/Marketing/Equipe/Tarifa). Evento sem áreas explica qualquer um.
13. Ordenação final: prioridade decrescente, depois código.

### 4.10 Orçamento de atenção (`labOrcamentoAtencao`, motor:70)
- **Exibível** = não sombra e (composto ativo, ou "ligado pela histerese" e não-`nao_avaliavel`, ou `parcial`).
- Marcas `aceito` e `naoprocede` escondem o achado em `tratados` **até o impacto atual passar de 1,5 × o impacto guardado na marca** (`ref`); depois a marca expira e o achado volta. `tratamento` não esconde.
- Achado `cobertoPor` composto vai direto ao `resto`.
- Os N primeiros (padrão **5**, `lab.achadosSemana`) vão para `visiveis`; o resto, para `resto`.
- Saem também `naoAvaliaveis` e `sombra`.

### 4.11 Persistência e desempenho (`labMotorRodar`, motor:112)
- Cache de 60 s, invalidado por assinatura (contagem de negócios, títulos, OS e baixas).
- Histerese local (`LAB.histLocal`) cobre o atraso (debounce) da gravação para não contar o mesmo disparo duas vezes.
- Só grava (`lab:motor`) quem tem a chave `lab.hipoteses`: ler o Executivo não escreve no banco.
- O contador `obs` conta disparos (`novo`), úteis (marca `tratamento`), "não procede" e intervenções, só na transição de estado.
- `labMotorEmSegundoPlano` roda no tempo ocioso (cerca de 0,5 s com 3 mil negócios).
- Confirmadas (`final==='sucesso'`) alimentam `historico` (confiança alta) e `confirmadas` (intervenção elegível).

### 4.12 Intervenções
- `LAB_INTERV_CORE`: 11 intervenções com matriz de impacto em 7 dimensões (receita, conversão, margem, caixa, capital de giro, capacidade, risco), escala `+ ++ − −− 0`, "fonte", riscos, "não usar se", esforço 1–3 e prazo.
- **Elegibilidade** (`labElegibilidade`, motor:11): inelegível se está na lista de restrições conhecidas ou se o ponto de equilíbrio diz `false`. Elegível se confirmada na empresa. Se algum efeito (exceto risco) tem "−" e não há histórico, vira "requer experimento". Caso contrário elegível.

### 4.13 Curva de caixa e pontos de equilíbrio (motor:78-92)
- **`labCurva`**: saldo acumulado por dia (arredondado a centavos), pior saldo, dia do pior, dias no negativo (saldo < −0,005).
- **Projeto típico** (`labProjetoTipico`): mediana de receita, kit, obra, impostos e comissão das vendas ganhas dos últimos 180 dias com financeiro; com ≥ 3 vendas. Sem base, premissas ilustrativas: R$ 20.000 / kit 11.000 / obra 2.000 / impostos 1.200 / comissão 600.
- **Cenários**: as condições publicadas (vista, p7030, etapas, c6040, fin) mais 50/30/20 e 30/30/40.
- **Break-even do desconto** (`labBreakEvenDesconto`): `contribNova = contribAtual − desconto·ticket`; `volumeEq = contribAtual/contribNova`; `quedaMax = 1 − contribNova/contribAtual`; `convEq = conv × contribNova/contribAtual`.
- **Break-even da entrada** (`labBreakEvenEntrada`): `ganho = R × Δentrada × (dias/30) × custoCapitalMes`; `quedaMax = ganho/contribUnit`. Custo de capital padrão 2% ao mês.
- **Custo da inação** (`labCustoInacao`): `impacto × 30 / janela` por mês.
- **Desenho de experimento** (`labDesenhoExperimento`) aponta lacunas: sem métrica principal, sem métrica de proteção, sem critério de sucesso numérico, duração menor que um ciclo de venda, amostra do baseline abaixo do mínimo, sem grupo de comparação, intervenção sobreposta na mesma variável, evento de contexto no período.

### 4.14 Inteligência aplicada (`lab_inteligencia.js`)
- **Waterfall de receita** (intel:8): `volume = (V1−V0)·T0`, `ticket = V1·(T1−T0)`. 10×20 mil → 12×22 mil: +40 mil volume, +24 mil ticket, +64 mil total.
- **Waterfall de margem** (intel:10), na ordem fixa §66: preço (receita), custo, comissão, imposto, taxa; sobra = "sem explicação". O desconto já está dentro da receita e não é somado duas vezes.
- **Categoria do desvio plano × realizado** (§155, `labCategoriaDesvio`, intel:15):
  - premissa: ticket planejado ±15% do histórico, ou conversão planejada > 5 p.p. acima do histórico.
  - execução: desconto real acima da política, ou atividade real < 80% da planejada.
  - contexto: eventos do diário.
  - sem explicação: quando nada se sustenta.
- **Acurácia do forecast** (§122, `labAcuracia`, intel:24): para cada foto, `erro = ajust − final`, `erroPct = erro/final`, antecedência em dias até o fim do ciclo. Erro absoluto médio e viés (média com sinal); médias a 30/15/7 dias (janela ±3 dias). `labAcuraciaGeral`: viés > +5% "otimista", < −5% "pessimista", senão "sem viés relevante"; **confiável se erro absoluto médio < 15%**. Por vendedor usa **erro simétrico** `(previsto − real)/((|prev|+|real|)/2)` (para quem previu venda e vendeu zero contar como erro grande); direção > ±10%.
- **Oportunidades velhas** (`labOportunidadesVelhas`): abertas há mais que o P90 do ciclo histórico. Ainda contadas com probabilidade cheia, o que superestima.
- **Build-up faseado** (§118, `labFaseado`, intel:33): vendas a assinar = `ceil(vendas meta / (1 − cancelamento))`; todos os volumes sobem na mesma proporção; antecedência = ciclo mediano lead→venda; "deve entrar até" por semana = início da semana − antecedência; `atrasado` se a data já passou; reuniões por pessoa/dia = `ceil(realizadas × fator) / dias úteis / nº closers`; `cabe` = ≤ teto de reuniões/dia (ou `null` sem teto: não afirma).
- **Proteção** (§153): mapa `LAB_PROTECAO` (leads→tx_agenda; agendadas→compar, tx_oport; propostas→tx_fech, desconto_medio; vendas→margem_contrib, cancelamentos; receita→margem_contrib, caixa_oper; backlog→retrabalho, atraso_os...). Alerta quando o volume sobe ≥ 10% e a proteção piora mais de 2 (p.p. ou %). Para "menor é melhor" (`LAB_MENOR_MELHOR`), piorar é subir.
- **Saúde** (§164/168, `labSaude`): regras, ativas, não avaliáveis, cobertura `(regras − naoAv − semRegra)/regras`, utilidade `úteis/(úteis + não procede)`, taxa de intervenção `intervenções/disparos`, ciclos completos (hipóteses com `aval` e `final`), taxa de confirmação.
- **Contribuição necessária** (`labContribNecessaria`, intel:55): `meta de MC = F ÷ (1 − l/m)` (F = custo fixo, l = lucro desejado, m = MC média, ambos em % da receita líquida); se `m ≤ l`, sem meta. `vendas que faltam = ceil((necessária − feita)/MC por venda)`. `ritmo = feita/fraçãoMês`. Sem custo fixo → `null`. A MC média vem dos últimos 90 dias (ou da margem alvo da política).

### 4.15 Hipóteses do formato simples (lab.js:698-743)
- Variáveis: receita/mês, vendas/mês, ticket, conversão total, ciclo, taxa de perda, entradas, conversão de cada etapa. Receita e vendas são normalizadas por mês (`DIAS_MES/duração`).
- A **direção** vem da meta: meta abaixo do baseline significa que a hipótese espera queda.
- `hipStatus`: atingiu → validada; melhorou mas não atingiu → parcial; senão refutada.
- Status automático: antes do início, "planejada"; durante, "em teste"; após o fim, calculado.
- Impacto estimado só para variáveis que entram na identidade entradas × taxas × ticket (ciclo e perda não entram).

### 4.16 Painéis (paineis.js)
- **Baldes de tempo** (`pnBaldes`): dia, semana (segunda a domingo, cortada nas pontas) ou mês (pelo ciclo comercial se informado; senão mês do calendário). **Granularidade automática** (`pnAuto`): ≤ 35 dias = dia; ≤ 190 = semana; senão mês.
- **Métrica calculada** `A op B`, com `op ∈ {/, −, +, ×}`; divisão por zero ou lado ausente → sem valor. É feita **em cada recorte**, não sobre médias. Unidade: `/` entre R$ e não-R$ = R$; senão `x`.
- **Catálogo** (`pnCat`): todas as métricas de `LAB_MET` (áreas Pré-vendas/Vendas/Funil), o dicionário não comercial (Margem e preço/Financeiro/Operação) e 11 "extras" (perdidos, tx_ganho, ciclo_venda, kwp, pipe_valor, pipe_qtd, receita_comp, despesa_comp, resultado_comp, receber_vencido, pagar_aberto). Cada uma declara em quais dimensões pode ser dividida (`dims`); fora disso mostra "—" com nota.
- **Variação** (`pnVar`): % em p.p., o resto relativo; base zero → sem variação (exceto 0→0); base negativa respeita o sinal.
- **Comparação** (`pnComparar`): "ciclo até hoje" é comparado com os mesmos dias do ciclo anterior; "semana até hoje" com os mesmos dias da semana anterior; "mesmo período do ano passado" desloca a/b um ano.
- Rosca agrupa o que passa de 7 fatias em "Outros"; valores ≤ 0 saem. Aviso quando o indicador não é aditivo.
- Funil de painel é **fluxo no período**, não coorte (nota na tela).
- **Visibilidade**: `pnPodeVer = não apagado e (admin ou dono ou vis='todos')`; `pnPodeAlterar = admin ou dono`.

### 4.17 Julgamento da semana e ritmo (testados em `paineis.test.js`, código em lab_semana.js e lab_projsemana.js)
Valores fixados pelo teste, úteis para o V2:
- Volume: +20% = melhor; +10% = normal; −40% = pior; volume pequeno (2 contra 1) não conclui.
- Taxa: limiar de 5 p.p., com amostra mínima.
- Meta da semana: ≥ 100% = "deu certo"; < 85% = "deu errado"; entre 85% e 100% decide a comparação com a média.
- `psRitmo(feito, decorridos, ritmoHist)` = `(feito + 5·ritmoHist)/(decorridos + 5)`. Peso 5 no histórico.
- `psProjetar`: projeção = feito + ritmo × dias restantes, com faixa pior/melhor semana e estados bate / risco (85–100%) / não bate / batida / sem meta.
- `psFracaoDia`: 8h = 0; 13h = 0,5; 18h ou depois = 1.

### 4.18 Fonte única (decisões D4, D12, D13, D14 de `lab_fonte_unica.test.js`)
- **D12**: venda é do dono no momento do ganho.
- **D13**: encaixe de canal por prefixo + espaço/separador ("Tráfego Pago" encaixa em "Tráfego Pago - Novos leads"). Dois nomes do mesmo canal somam no canal da meta.
- **D14**: meta por ciclos (acima).
- **D4**: investimento realizado rateado pelos dias do mês dentro do ciclo. Ciclo 05/09–05/10 = `3000·26/30 + 3100·4/31`.

---

## 5. O que os testes garantem

Há um padrão: o código "puro" fica entre `/* ===== PURO ===== */` e `/* ===== FIM PURO ===== */` e os testes o carregam sem navegador. Os testes de UI usam Playwright em modo local, com relógio fixo.

**`lab_motor.test.js` (124 linhas).** Problemas plantados.
- Período saudável: **zero achados** ("alarme falso = 0"), nenhum composto, 20 hipóteses avaliadas.
- H-FIN-001 plantada (receita +30%, recebíveis +48%, prazo +12 d, caixa −40%):
  - Detectada, impacto exato 30.000 (exposição) em dimensão `caixa`, confiança **média**, primeira da lista.
  - Com histórico confirmado, mas rival ativa (H-FIN-005), segue média. Sem rival e com histórico, sobe a **alta**.
  - Só disparam as compatíveis (H-FIN-001, H-FIN-005, H-SOL-012).
- H-COM-002 (desconto 4%→9%, margem 26%→21%):
  - A rival H-SOL-013 (kit estável) **não** dispara, e H-COM-010 (mix) também não.
  - Impacto = 0,05×360000/0,91.
- Desconto + kit juntos: ambas ativas, **viram composto C-002**, e não são tratadas como rivais.
- Honestidade: amostra 4 < 10 → "não avaliável" com confiança `nao`; recebíveis ausente → H-FIN-001 `nao_avaliavel` listando "recebiveis". Determinismo: duas execuções dão o mesmo resultado.
- C-001 (H-FIN-001 + H-OPE-009): prioridade acima dos componentes, impacto = o maior (não a soma = `max(30000, 16·20000·0,2)`).
- Histerese: achado novo liga; 2 dias depois de normalizar continua ligado e não é "novo"; 20 dias depois de normal desliga (14 dias com folga).
- Sombra: ativa, marcada, fora do orçamento. Aposentada: não é avaliada.
- Orçamento: limite 2 na tela com o resto acessível; "não procede" sai; **marca expira quando o impacto passa de 1,5× o marcado** (dobrou → volta).
- Curva de caixa (venda 20 mil, kit 11 mil no dia 2, instalação 2 mil dia 15, impostos 1.200 e comissão 600 no dia 30):
  - 60/20/20: pior saldo +1.000, final 5.200.
  - 70/20/10: pior +3.000.
  - 50/30/20: pior −1.000.
  - 30/30/40: pior −5.000 e **43 dias no negativo**.
- Break-even: desconto 5% com contribuição 5.000 e ticket 20 mil = **+25% de volume**, queda máxima 20%, conversão de equilíbrio 20% → 16%. Entrada +10 p.p. por 45 dias a 2%/mês: ganho de R$ 60 por venda, queda máxima 1,2%.
- Desenho de experimento: 6 lacunas apontadas; um desenho completo passa.
- Elegibilidade: só efeitos positivos = elegível; efeito colateral negativo sem histórico = requer experimento; confirmada = elegível; abaixo do ponto de equilíbrio = inelegível.
- Correções da revisão adversarial de 08/10:
  - Receita→contribuição (31.200).
  - Taxa de coorte madura (estável não dispara).
  - Aditivas (leads +30% não vira "queda").
  - Queda de dado não desliga a histerese, mas "não avaliável" não aparece como achado.
  - Composto cobre os componentes e o orçamento mostra o composto e esconde os componentes.
  - Condição não essencial sem dado → ainda ativa, confiança **baixa**.
  - Cancelamentos = 0 é avaliável.
  - Evento de Marketing não explica achado de caixa; do Financeiro explica.
  - Rival em sombra não penaliza.
  - Calibração por métrica não afeta as demais (limiar 10 p.p. só para o desconto).

**`lab_modelo.test.js` (69 linhas).**
- Amostra: 9 insuficiente, 10 limitada, 30 relevante, 100 robusta, faixas ajustáveis.
- Taxa ajustada: (1+2)/(2+10) = 25%; converge com n grande.
- Wilson 1/2 ≈ 9%–91%; 50/100 ≈ 40%–60%.
- Variação: 24%→15% = "−9 p.p."; R$100→128 = "+28%"; base negativa respeita direção.
- Condição: 7%→10% = verdadeiro (+3 p.p.); +1 p.p. dentro da banda = estável; +1,5 p.p. = "indefinido" e falso; amostra 12 < 20 = insuficiente.
- Histerese passo a passo (liga, folga de 1 dia, sem folga zera a contagem, 14 dias desliga, não religa antes do intervalo, religa depois).
- Confiança: alta / média (sem histórico, ou 1 rival) / baixa (dado faltando, amostra limitada, contraevidência) / não avaliável; "diz o que falta para subir".
- Linguagem por nível: "observado" só permite "ocorreu junto com"; "evidência forte" permite "produziu".
- Maturidade 0–4.
- Grafo: caminho vendas→pago→exposição→saldo; natureza do caminho = elo mais fraco.
- Aditivas: 130 em 30 d contra 100/30 d = +30%, não −57%. Coorte termina 30 d antes de agora. ESTAVEL com +2 p.p. e banda 2 é estável. Limiar 0 sem variação não dispara. NaN = ausente.

**`lab_inteligencia.test.js` (52 linhas).** Waterfall (volume +40 mil, ticket +24 mil; margem 60 mil→62 mil com efeitos preço +30 mil, custo −25 mil, comissão −900, imposto −1.800, taxa −300, sem explicação 0). Categorias do desvio. Acurácia: fotos a 30/15/7 dias com realizado 100 mil dão erros +30%, +15%, +4%; erro médio ≈ 16,3%, viés otimista; geral de 2 ciclos = erro 13,2%, "sem viés relevante", confiável. Faseado: 600 leads, ciclo 45 d, 4 semanas, 3 vendedores, teto 3: 2,83 reuniões/pessoa/dia, cabe; 170 leads por semana a entrar até 18/09; 15 efetivas com 10% de cancelamento = **17 assinadas**, R$ 340 mil; com 2 vendedores não cabe (3,75); sem teto, `cabe = null`. Proteção. Saúde (cobertura 67%, utilidade 75%, taxa de intervenção 50%). **Contribuição necessária**: fixo 40 mil, MC 25%, lucro 10% → meta = 40/0,6; faltam 10 mil = 3 vendas; ritmo 60 mil; MC média abaixo do lucro desejado → sem meta; sem custo fixo → `null`.

**`paineis.test.js` (83 linhas).** Baldes de tempo (inclusive ciclo com dia 6), granularidade automática, A÷B/−/+/×, Pearson (1, −1, `null` com <3 pontos ou sem variação), regressão y = 2x+1, eixos, "Outros", variações, julgamento da semana, condição de hipótese da semana, quem vê/altera, ritmo e projeção da semana (valores da 4.17).

**`lab_fonte_unica.test.js` (53 linhas).** D12, D13, D14, D4 (4.18).

**`ui/lab_trilhas.mjs`.** Entrada com a pergunta e **4 trilhas na ordem**, toda aba em exatamente um passo, **36 passos nos cartões**, trilho do Passado com 12 passos, migalha "LAB › Analisar o passado › Funil e conversões", endereços `#lab/funil`, `#lab/plan/resumo`, `#lab/plan/metas`, `#lab/plan/cen`, filtros recolhidos e **ausentes** onde não valem, o Planejamento não repete a sub-navegação, dobras (≥ 3 seções, ≥ 1 recolhida, estado lembrado após redesenho), "Abrir tudo"/"Só o essencial" como preferência, passo com duas abas ("Pessoas"), celular sem rolagem horizontal, zero erros de console.

**`ui/lab_paineis.mjs`.** Semana de 12/10 a 18/10 de 2026 com a Ana sem vender (vendia 3/semana) e 20 leads (eram 10). Confere: "deu certo: leads 20 (média 10)", "deu errado: vendas 1 (média 4)", "quem mais pesou foi a Ana (0 vs 3)", decomposição volume × ticket, roteiro "Hipóteses de solução para testar... Funcionou se:", navegação ‹ semana. Painéis: um "Todos" de outra pessoa aparece com marca; o "Só eu" de outra pessoa é invisível para quem não é admin, e o admin o vê; modelo pronto mostra aviso e **5 gráficos** ("Comercial da semana"); "Usar este modelo" cria cópia "Só eu"; endereço `#lab/paineis/<id>`; editor com prévia; gráfico novo gravado; visibilidade, mover, duplicar ("(cópia)"), excluir (marca `apagado`); **métrica calculada: R$ 20.000 ÷ 20 leads = R$ 1.000**; celular sem rolagem.

**`ui/lab_fora_curva.mjs`.** Limite = 5 × ticket = **R$ 100.000**; o negócio de R$ 1 milhão fica fora com chance histórica; a projeção usa só o normal (≤ R$ 20 mil × chance); abertos 2 / `foraN` 1; o Resumo mostra "Fora da projeção: 1 negócio(s) acima de R$ 100.000", o nome é clicável, a projeção não chega perto da meta (< R$ 300 mil); "Vendemos 2 de 11" (1 antes do corte + 10 do plano); a meta de vendas do mês é "vendido antes do corte + meta do plano"; o ritmo por dia mostra decimal ("0,4", "3", "12"); o Plano do dia mostra "fora: Rádio Grande SA (R$ 1.000.000)".

**`ui/lab_receita_corte.mjs`.** Plano replanejado: com corte, "por dia útil" = (meta do mês − vendido antes do corte) ÷ dias úteis do corte ao fim do ciclo. Exemplo: (100.000 − 30.000) ÷ dias úteis; por semana "faltam R$ 70.000"; a meta da semana e do período no relatório usa o que falta (R$ 70.000). Sem corte: meta cheia ÷ dias úteis do ciclo.

**`sql/lab_foto.sql` (15 verificações).** Sem plano: `foto=false`; chave do ciclo com dia 1 = mês corrente. Com 9 negócios plantados, receita real = **48.000** e vendas = **3**, onde ficam de fora: ciclo anterior, outro funil, avulso, não ganho, independente pelo consultor e independente pelo dono no ganho. O valor em texto `"18000"` é aceito (`lab_num`). Meta da empresa 300.000 / 12 vendas (meta por pessoa não entra). Foto marcada `servidor`. `dd ≤ du`, `du ≥ 20`, ritmo ≥ realizado. Segunda chamada recusa e não sobrescreve. Dias úteis descontam feriados do plano e contam sábado se o plano tiver. `authenticated` não executa a função. `lab_num('abc')` é `null`; `lab_num('12.5')` é 12,5.

---

## 6. Comparação com o V2 atual

Visão geral: o V2 tem **a espinha dorsal do motor** (hipóteses como dados, fórmula de impacto em texto, ordenação por R$, orçamento de atenção, "sem dados"). Mas o que o V1 acumulou depois (honestidade estatística por regra, histerese, rivais, confiança, composição, contexto, memória de marcas, forecast probabilístico, painéis, casca em trilhas) praticamente não existe.

| Capacidade do V1 | V2 |
|---|---|
| Motor com hipóteses por dados | **Cobre, de forma rasa.** `packages/hipoteses/src/motor.ts` tem 39 linhas. Biblioteca no pack: **8 hipóteses no `base.json` + 2 em `licitacao-b2b`**, contra 20 no V1. Cada uma tem `quando`, `impacto`, `acao`, `severidade`, em fórmula de texto com analisador próprio. |
| Ordenação | V2: maior impacto em R$, depois severidade, depois chave. **Não** pondera por confiança, esforço ou aderência. Tipos risco/gargalo não ganham bônus. |
| Orçamento de atenção | V2: `orcamento = 3`, corta a lista. **Não tem** "histerese" (visível = ligado), nem marcas tratamento/aceito/não procede com expiração em 50%, nem composição, nem "coberto por". |
| "Não sei" | **Cobre**: `semDados` lista as variáveis faltantes. Mas não separa dado essencial × não essencial, não rebaixa confiança. |
| Condições com 6 parâmetros | **Não existe**. Fórmulas booleanas livres, sem janela/base/limiar/banda/amostra/histerese por condição. Sem comparação contra "média 90 dias" ou "ano anterior". Sem escalar métricas aditivas. Sem maturação de coorte de 30 dias. |
| Amostra mínima | **Rasa**: um único `AMOSTRA_MINIMA = 30` (V1: 5 para exibir, 10/30/100 em faixas, por regra). Exposta como `amostra_minima` no pack. |
| Wilson | **Cobre**: `wilson`/`proporcao` em `metricas/estatistica.ts`, com `amostraSuficiente`. |
| Confiança (alta/média/baixa/não) | **Não existe** (só `severidade` fixa do autor da hipótese). |
| Rivais e "dado que distingue" | **Não existe**. |
| Composição de achados | **Não existe**. |
| Grafo de relações (27 relações) e consequências | **Não existe**. |
| Dicionário de métricas | **Cobre, de forma rasa**: `DICIONARIO` com 16 métricas (`chave, nome, formula, unidade, dona`). V1: ≈ 50 métricas com grão, base temporal (competência/caixa/coorte), evento, sinônimos, decisão, versão e `menorMelhor`. |
| Variáveis do motor | V2: ~50 variáveis em `nucleo/hipoteses/variaveis.ts` (conversão por papel, CAC, CPL, churn, LTV, pessoas atrás). Tem coisas que o V1 não tem (retenção/churn/LTV, CAC). **Não tem** financeiro de caixa (recebíveis, prazo, exposição), operação (backlog, atraso, retrabalho, cancelamento pós-venda). |
| Canvas de decisão (10 blocos) | **Cobre, de forma rasa**: `registrarDecisao` + experimentos (`memoria.ts`), com baseline, alvo e conclusão, mas sem o canvas guiado, sem rivais/restrições/simulação nele. |
| Diário de contexto | **Não existe**. |
| Memória/aprendizado | **Cobre, de forma rasa**: decisões e experimentos que escrevem aprendizados. Sem `obs` (disparos, úteis, não procede) e sem "saúde da inteligência". |
| Ciclo de vida da regra (rascunho/sombra/ativa/aposentada) | **Não existe**. Biblioteca mora no JSON do pack, versionada no repositório. |
| Intervenções com matriz de impacto e elegibilidade | **Não existe**. |
| Funil por coorte + taxas | **Cobre**: conversão por coorte e fluxo por papel em `metricas`. |
| Benchmark entre vendedores (mediana/p75), receita potencial, gargalo, simulador, transferência de performance | **Não existe**. V2 tem "alavancas (+5 pontos)" no Studio, que é muito mais simples. |
| Drill-down (vendedor/origem/mês/tipo) e lista dos leads por trás de cada número | **Não existe** (sem lista de leads clicável). |
| Forecast do mês (probabilidade por etapa × a tempo) | **Não existe**. V2 projeta por ritmo linear pelos dias úteis (`no_ritmo/atenção/atrás`) e `receita_esperada_ate_hoje`. |
| Fora da curva (5× ticket) | **Não existe**. |
| Meta reversa | **Cobre**: build-up reverso (receita → vendas → … → tentativas) por pessoa/canal/dia útil. É mais completo que o `labTelaMeta`. |
| Foto diária do servidor e acurácia do forecast (erro, viés) | **Não existe** ("foto diária do LAB" já listada como ausente no resumo). V2 tem `retrato_ciclo` imutável e assinado no fechamento, mas isso é só 1 foto por ciclo, não um histórico diário de previsões. |
| Correlações, tempo por etapa, cohorts por mês | **Não existe**. |
| Preço e margem (recomendado × aprovado × final, MC perdida no desconto) | **Cobre, de forma rasa**: desconto e MC por venda em `metricas`. Sem a tela, sem política de preço com regras, sem MC por vendedor/produto/condição. |
| Curva de caixa por condição de pagamento, break-even de desconto/entrada, exposição agregada | **Não existe** (sem financeiro e sem projetos). |
| Contribuição necessária do mês (custo fixo → lucro) | **Não existe**. |
| Waterfall e categoria do desvio | **Não existe**. |
| Build-up faseado (quando os leads precisam entrar, cabe na capacidade?) | **Não existe**. V2 faz o build-up reverso, mas sem antecedência pelo ciclo nem teto de reuniões/pessoa. |
| Métricas de proteção | **Não existe**. |
| **Painéis do usuário (construtor)** | **Não existe**. A tela do V2 (`tela.ts`, 622 linhas) tem 8 abas fixas (Ritmo, Equipe e metas, Quarter, Fechamento, Achados, Dados, Studio, Operações) e nenhum gráfico configurável por pessoa. Sem visibilidade "só eu/todos". |
| **Casca em trilhas, filtros, dobras, índice, deep links** | **Não existe**. |
| Relatório da semana, projeção da semana | **Não existe** (o V2 tem Ritmo e Fechamento do dia). |
| Quarter, programa de ciclos, hipóteses do mês, contingência | **Cobre** quarter em 6 passos e ciclos; contingência é listada como feita em V2 ("contingência"), sem a precisão do V1. |
| Studio (funis em grafo, campanhas) | **Cobre** em parte (`packages/studio`). Fora da minha frente. |

**Leitura crítica.**
1. O V2 reproduz o "o quê" do motor (achar e ordenar) mas não o "quão confiável" nem o "por que não olhar de novo". Sem histerese, sem marca "aceito/não procede com validade" e sem rivais, o motor do V2 piscaria a cada abertura da tela e não aprenderia com o gestor.
2. As 8 hipóteses do V2 são genéricas. As 20 do V1 foram construídas para o cenário em que o dono vive: caixa × crescimento, desconto × margem, capacidade de instalação, cancelamento pós-venda. Como o V2 nasceu "multi-operação", essa riqueza setorial precisa virar pack (solar-b2c hoje não tem hipóteses próprias).
3. O V2 tem duas coisas que o V1 não tem e que valem manter: pack por operação com herança e **CAC/CPL/LTV/churn**; e o retrato imutável assinado.
4. O que mais pesa para o objetivo do dono ("Jarvis" que mostra estratégia, planejamento, funis e **acompanha se o time produz o que a meta exige**) é a falta de: forecast probabilístico, benchmark entre vendedores com receita potencial, relatório/projeção da semana, e a casca de navegação em trilhas. Hoje o V2 diz se está "no ritmo", mas não diz **por que** e **quanto vale** corrigir.

---

## 7. O que isso entrega que uma planilha não entrega

- **Valor em reais ordenado por prioridade, com limite de atenção.** Uma planilha mostra 80 números. O motor devolve 5 achados ordenados por `impacto × confiança ÷ esforço`.
- **Admitir que não sabe.** "Não avaliável" com lista do que falta. Planilha dá um número mesmo com n=3.
- **Memória do gestor.** O que foi aceito, o que não procede e por quê, com validade (reaparece se o impacto crescer 50%). O histórico de hipóteses testadas e o aprendizado ficam amarrados ao achado.
- **Não oscilar.** A histerese evita que o achado apareça e suma a cada atualização.
- **Rivais e contexto.** O LAB mostra a explicação concorrente e o evento do diário (reajuste tarifário, saída de vendedor) que pode explicar o desvio.
- **Autoauditoria.** Acurácia do forecast (erro e viés por antecedência e por vendedor), "oportunidades velhas ainda contadas", saúde da inteligência. A planilha não se mede.
- **Coortes certas.** Taxas só de coortes maduras, métricas aditivas ajustadas à janela, benchmark só com amostra, intervalo de Wilson visível.
- **Forecast por etapa e por prazo**, com negócio gigante isolado em vez de contaminar a projeção.
- **Foto diária automática** no servidor, que vira histórico de previsão (impossível reconstruir depois, em planilha).
- **Mesma fórmula em todo lugar** ("fonte única": o painel chama a mesma função que o resto do CRM). Planilha diverge entre abas.
- **Do número à pessoa**: clicar na conversão → vendedor/origem/mês → lista de leads → abre o negócio.
- **Simulação que não grava** e "transferência de performance" ("e se a Ana tivesse a conversão do Pedro").
- **Controle de acesso por linha** (painel "só eu"/"todos", financeiro só para quem tem a chave) sem montar planilhas diferentes.

---

## 8. Riscos e armadilhas ao portar para o V2

1. **Não é só copiar a biblioteca.** As condições dependem de 4 áreas de dados (comercial, margem, financeiro de caixa, operação/OS). O V2 não tem financeiro de caixa, projetos nem o conceito de "exposição". Metade das 20 hipóteses nasce `nao_avaliavel`. É o comportamento correto, mas a tela deve explicar por quê, ou parece quebrada.
2. **Unidades e coortes são onde o V1 já errou.** A revisão adversarial de 08/10 corrigiu: base de 90 dias não reduzida (métrica aditiva), taxa de coorte imatura, base zero, NaN virando "estável". Portar com os mesmos testes (a suíte `lab_motor` e `lab_modelo` é a especificação). Sem eles, o V2 reintroduz esses bugs.
3. **O V2 expressa condições como texto livre com analisador próprio.** O V1 usa objetos com 6 parâmetros e calibração por regra. Escolha de arquitetura: ou o analisador do V2 ganha funções (`aumentou(met, janela, base, limiar)`), ou as hipóteses passam a ter condições estruturadas. Misturar os dois dificulta a calibração pelo gestor e a histerese.
4. **Histerese exige estado persistido por operação** (`hist` por código) e cuidado com gravação duplicada (o V1 usa `histLocal` contra o debounce). No V2 isso tem que ir para uma tabela, com chave de operação, e rodar de forma idempotente por data.
5. **Marcas "aceito/não procede" expiram por `ref × 1,5`.** Guardar o `ref` no momento da marca (V1 arredonda). Sem ele, o achado nunca volta ou nunca some.
6. **Moeda de prioridade.** O V1 converte receita em contribuição pela margem (a da janela se 0<m<1, senão 0,25 de referência). Se o V2 mantiver impacto "em R$" sem dizer a dimensão (receita × contribuição × caixa), vai ordenar maçãs com laranjas. O caixa preso e a contribuição perdida não são a mesma coisa; o V1 os mantém separados por `dimensao`.
7. **Fora da curva e mediana inferior.** O limite usa a mediana *inferior* (`floor((n−1)/2)`) e exige ≥ 3 ganhos. Em operações B2B de ticket muito variável (licitação), o fator 5 pode precisar de calibração por pack.
8. **Meta desconhecida ≠ zero.** `labMeta` devolve `null` se algum ciclo do intervalo não tiver meta. Se o V2 somar o que existir, o "gap" fica falso.
9. **A venda é de quem era o dono no ganho** (D12), e **operações independentes** ficam fora da foto (SQL 25). O V2 precisa decidir isso antes de somar realizado por pessoa. Quem trocou de dono no meio do ciclo distorce o ritmo.
10. **Ordem de execução dos SQLs.** O 36 recria `lab_foto_diaria` **sem** o filtro de "independentes" do 25 (que foi atualizado em 20/10). Rodar o 36 depois do 25 desfaz a correção. No V2, uma única definição, com teste do cenário (48.000 e 3 vendas).
11. **A foto diária é cumulativa.** Acurácia só existe a partir da primeira foto; não dá para recalcular o passado. Se o V2 só grava o retrato de fechamento, perde a série diária que alimenta erro e viés. Decidir cedo, porque o dado perdido não volta.
12. **Painéis: segurança na linha.** No V1 a regra mora no banco (políticas restritivas) e no front. No V2 (Worker + Supabase) a regra "só dono altera" precisa estar na API, não só na tela. Excluir é lógico (`apagado`); manter.
13. **Catálogo de painéis depende de `dims` por métrica.** Dividir "receber vencido" por pessoa não faz sentido. O V1 devolve "—" com nota; se o V2 devolver 0, o painel mente.
14. **Desempenho.** O V1 já nota 0,5 s com 3 mil negócios e usa cache de 60 s, assinatura de dados e execução ociosa. No Worker, o motor deve ser calculado no servidor e cacheado por operação.
15. **Persistência de preferências na UI** (dobras abertas, "Abrir tudo", último passo por trilha) é pequena mas muda muito a sensação de uso. Não custa caro portar, mas é fácil esquecer.
16. **Texto de inferência travado pelo motor** (`LAB_INFER`: "ocorreu junto com", "é compatível com"...). Se o V2 gerar texto livre (ou por IA) sem essa trava, volta a afirmar causa onde há só associação.
17. **Briefing Master ausente.** As "§" do código referenciam um documento que não está nos arquivos. Antes de portar o "modelo", pedir ao dono o texto original (ou aceitar o código como a especificação) para não portar regras sem saber a razão.
18. **Dados que o V1 usa e o V2 pode não ter**: produtividade diária (`dia:<iso>`), equipe/papéis (SDR × closer), "valor de conta de energia" e kWp nas correlações, motivos de cancelamento. Eles são específicos do solar. Algumas métricas (kWp, R$/kWp) devem entrar como campos do pack, não do núcleo.
