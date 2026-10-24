# Frente B — Quarter, Objetivos e Metas (LAB V1)

Convenção de citação: `Q` = fontes__lab_quarter.js, `O` = fontes__lab_objetivos.js, `M` = fontes__lab_metas.js. "V2" = /home/user/lab2. Todos os números abaixo foram lidos do código ou dos testes; nada foi executado.

Observação de partida: o V1 tem **sete abas** no quarter (`LQ_FASES`, Q:16): "Visão do quarter" (painel de leitura) mais **seis fases numeradas**. A "Visão" não é fase de planejamento; é o resumo. O V2 chama de "6 passos" outra coisa (ver seção 6).

---
## 1. Para que serve cada parte e as seis fases

**Quarter** = três ciclos comerciais consecutivos (Q:4). Responde ao gestor: "Para onde vou nos próximos 90 dias, por quê, com quais apostas, e como saberei cedo se estou errado?" Usa-se (a) 2 a 4 semanas antes do quarter começar, para planejar; (b) toda semana/fim de mês, para acompanhar; (c) no fim, para encerrar e deixar aprendizado ao quarter seguinte. A ferramenta não calcula indicadores próprios: reaproveita o catálogo `LAB_MET`/`lpMed` do Planejamento (Q:6-9).

**Objetivos (O)** = motor puro (sem tela) com: o que é "atingir" um objetivo, se as metas se contradizem, cenários por premissa, replanejamento com data de corte, programa de ciclos, déficit de capacidade. Pergunta: "Essa meta é possível? O que ela exige? Está em risco por falta de atividade ou por falta de conversão?"

**Metas (M)** = "qual era a meta oficial daquele ciclo?" com histórico auditável. Pergunta: "Posso confiar no atingimento de um período passado?" Regra de ouro (D17): ciclo passado sem evidência = "meta desconhecida", nunca zero, nunca a meta de hoje.

### As seis fases (nome exato em `LQ_FASES`, Q:16)

| # | Nome na tela | Objetivo | Entradas | Saídas gravadas |
|---|---|---|---|---|
| 1 | "1 · Revisão do quarter anterior" (`lqFaseRevisao`, Q:574) | Dizer, sem inventar, como foi o quarter passado: planejado × realizado em 15 indicadores, tendência, o que funcionou/não funcionou | Metas oficiais de cada mês (`lmCiclo`), medidas do catálogo, quarter antes dele, iniciativas/encerramento do quarter anterior, hipóteses do LAB, fechamento de cada mês, lista do Fechamento do dia | `revisao.respostas` (retrospectiva guiada) e `aprendizados` (documento global `gestao/lab`) |
| 2 | "2 · Diagnóstico e prioridades" (Q:637) | Achar as restrições à geração de **receita** (só receita; operação/entrega ficam fora, Q:128) e transformar em prioridades explícitas | Janela do quarter anterior contra os 180 dias antes dele (`lqDiagCtx`, Q:458) | `prioridades{id}` (título, escopo, justificativa, st, critérios, ordem, impacto) e `decisoes` |
| 3 | "3 · Objetivo e metas" (Q:688) | Escolher o objetivo e a meta sabendo histórico, continuidade e 3 cenários; definir resultados-chave | Cenários (`lqCenariosCtx`), receita dos 2 quarters anteriores | `objetivo{texto,ind,alvo,partida,resp,criterio}`, `krs{}`, `cenarios{conservador,otimista,notas}` |
| 4 | "4 · Iniciativas" (Q:765) | Cada prioridade vira intervenção testável: hipótese, indicador (inicial→mínimo→alvo), marcos, critérios de continuar/corrigir/interromper | Prioridades aceitas, sugestões `LQ_SUG` (Q:476) ligadas ao catálogo de intervenções | `iniciativas{}` com `marcos{}` |
| 5 | "5 · Os três meses" (Q:834) | Quebrar em mês 1/2/3: meta de receita, resultado esperado, critério, bottom-up do mês, sequência, capacidade, riscos, gatilhos | Objetivo, iniciativas, taxas do histórico, capacidade do plano do mês | `meses{0,1,2}`, `capacidade`, `riscos`, `gatilhos` |
| 6 | "6 · Publicação e acompanhamento" (Q:904) | Aprovar (com bloqueios explicáveis), publicar v1/vN, criar o programa de ciclos, acompanhar semana a semana, fechar cada mês, encerrar o quarter | Tudo acima + `lqAprovacao` | `versoes{vN}`, `status`, `lab:prog:q<chave>`, `fechMes`, `encerramento` |

---
## 2. Telas e interações

**Cabeçalho (`lqCab`, Q:509):** setas ‹ › entre quarters; nome ("4º quarter de 2026"); estado do calendário (ainda não começou/em andamento/encerrado); selo (sem planejamento / em rascunho / publicado vN / encerrado); botão "Começar o planejamento deste quarter"; seletor "Ano começa em" (só com a chave `lab.configurar`) para ano fiscal; abas das fases; navegação ‹ anterior / próxima ›. Sem documento criado, só Visão, Revisão e Diagnóstico abrem.

**Visão (Q:527):** 4 KPIs (resultado pretendido; receita do quarter passado vs meta oficial; receita do quarter atual até hoje; próxima revisão), prioridades aprovadas, últimos 3 aprendizados, a **árvore "Do objetivo ao resultado"** (objetivo → resultado-chave → problema → prioridade → iniciativa → indicador → entregável por mês → meta mensal → observado; cada nó é clicável e abre a fase onde se edita), indicadores críticos, resumo dos três meses, top 3 riscos (impacto × probabilidade).

**Fase 1:** KPIs executivos; listas "Melhoraram"/"Pioraram"; "Problemas que mais comprometeram a meta" (top 3 comprovados); **tabela Planejado × Realizado** por indicador (meta original, meta final com selo "revisada", realizado, desvio abs e %, mês a mês, tendência vs quarter anterior, fonte e completude, definição ao abrir o nome); "Lacunas que limitam a análise"; "O que funcionou/não funcionou" (iniciativas + hipóteses); o que o encerramento do quarter anterior deixou; o que cada fechamento mensal registrou; **retrospectiva guiada** (perguntas só onde há lacuna; caixa de texto grava ao sair do campo); tabela de aprendizados com botão "Registrar aprendizado".

**Fase 2:** tabela de restrições (dimensão, situação com selo, evidência, impacto quantificado com "premissas" recolhíveis, botão **Decidir**). Decidir abre diálogo com título sugerido, escopo, justificativa e alternativas de iniciativa; botões Aceitar / Rejeitar (exige justificativa) / Cancelar. Lista de prioridades ordenada, com "Pontos +N · a favor… contra… sem avaliação", botões Avaliar critérios (9 selects baixo/médio/alto/não avaliado), Modificar escopo, ↑ ↓, Rejeitar; rejeitadas recolhidas com "reabrir"; "Adicionar prioridade própria"; aviso de foco (3 a 5).

**Fase 3:** KPIs de histórico, continuidade e três cenários; premissas do cenário-base recolhíveis; botão "Premissas dos cenários" (tabela premissa × conservador% × otimista% × justificativa); objetivo (diálogo com trava de sanidade: valor > 3× otimista exige checkbox de confirmação); **Meta ambiciosa × meta viável** (distância a cada referência e frase "o que a meta exige"); resultados-chave (diálogo completo, remover) e botão "Sugerir antecedentes pelo bottom-up" (cria oportunidades, reuniões realizadas e leads como KR antecedente).

**Fase 4:** por prioridade aceita, cartões de iniciativa com quatro "níveis" (Entregável, Estratégia, Hipótese, Resultado), marcos com select de situação, bloco "Justificativa, execução e gestão da hipótese", "Falta para aprovar: …". Diálogo longo (nome*, responsável*, problema*, hipótese*, variável*, indicador*, inicial*, mínimo*, alvo*, continuar/corrigir/interromper*, marcos em linhas "mês | entregável | dd/mm/aaaa | responsável", horas/mês, orçamento, contribuição esperada em R$, dias de implantação, dependências, meses ativos). Botões de sugestão "+ nome" vindos de `LQ_SUG`; "Cancelar a iniciativa" exige motivo e não apaga.

**Fase 5:** três colunas (empilham no celular) com meta de receita do mês + botão "usar R$ X (proporcional aos dias úteis)", 12 campos de compromisso (`LQ_MES_CAMPOS`, Q:829), iniciativas e marcos do mês e **tabela bottom-up do mês**; "Sequência sugerida" com botão "aplicar"; "Capacidade e carga de trabalho" (declarar horas por pessoa, rotina %, orçamento; alternativas; "Registrar a decisão sobre a sobrecarga"); linha do tempo (Gantt simples); matriz de riscos 3×3; gatilhos de decisão.

**Fase 6:** resumo para aprovação (dl com todo o plano); lista de **bloqueios** e **avisos**; botão "Aprovar e publicar" (desabilitado se há bloqueio) ou "Publicar uma revisão (nova versão)" que exige motivo; "Plano oficial" (tabela meta original do mês × plano do mês × botão "Levar a meta ao plano do mês"); acompanhamento semanal (iniciativas, KRs, **reprevisão**, Fechamento do dia dentro do quarter, decisões pendentes); fechamento mensal (classificar cada compromisso, notas, "Registrar o fechamento do mês", disponível a partir de 3 dias antes do fim do mês); encerramento do quarter (KPIs original×final×resultado, "Do resultado ao aprendizado", Encerrar); versões e histórico de decisões e de alterações (80 últimas).

**Fora da tela:** sino de avisos (`lqNotificacoes`, Q:1198), seção "Entregáveis do quarter" no Plano do dia (`lqMarcosDoDia`, Q:1206), link de volta ao quarter por `#lab/quarter/<fase>`. Metas históricas ficam em LAB › Passado › Qualidade dos dados › "Metas históricas por ciclo" (M:227): tabela ciclo × estado × meta oficial × origem × registro, com Registrar, Revisar, Estimativa, "Versões e registros".

---
## 3. Modelo de dados, entradas e saídas

Todo armazenamento é a tabela chave-valor `public.gestao` (id texto, `dados` JSON) com mesclagem por `patchG` (um campo `null` apaga a chave). Chaves:

- `gestao/lab:qtr:<AAAA-MM do 1º ciclo>` — o quarter inteiro: `ciclos`, `nome`, `status` (`rascunho|publicado|encerrado`), `versao`, `objetivo`, `krs{}`, `prioridades{}`, `iniciativas{}` (cada uma com `marcos{}`, `deps`, `meses`), `meses{0,1,2}`, `cenarios`, `capacidade`, `riscos{}`, `gatilhos{}`, `decisoes{}`, `hist{}` (trilha de alterações: quem, quando, ação, de→para), `versoes{vN}`, `fechMes{}`, `revisao.respostas`, `encerramento`, `prog`. Gravação central: `lqGravar` (Q:434) carimba `atualizadoEm/Por` e, se houver `hist`, acrescenta entrada. Só grava quem `lpAdmin()` (chave `lab.planejamento_salvar`).
- `gestao/lab.aprendizados[id]` — conclusão, evidência, confiança (baixa/média/alta), condições, implicação, decisão, `quarter`, `origem` (ex.: `ini:<quarter>:<iniciativa>` evita duplicar), `por`, `em`.
- `gestao/lab.quarter.mesIni` — mês de início do ano fiscal. `gestao/lab.minN` — amostra mínima. `gestao/lab.inicio` — "Analisar a partir de" (D20).
- `gestao/lab:prog:q<chave>` — **programa de ciclos** criado ao publicar: `{nome, ciclos, meta:{receita}, pesos, pipe, original{ciclo:{receita}}, status, qtr, hist}`.
- `gestao/lab:plan:<ciclo>` — plano de cada mês (fora desta frente), com `original`, `versoes{vN}`, `versao`, `corte`, `fechamento`.
- `gestao/lab:cen:<ciclo>` — cenários gerenciais do Planejamento; SQL 39 (`supabase__39`, linhas 13-17) cria política **restritiva** que só deixa ler/gravar quem tem `lab.cenarios` ou `lab.planejamento_salvar`.
- `gestao/metas` — metas diárias da Produtividade; SQL 39 (19-23) deixa gravar quem tem `lab.planejamento_salvar` (antes só o administrador).
- `gestao/lab:metaciclo:<AAAA-MM>` — `registros{r1,r2…}` e `obs{<dia>}`.

**Imutabilidade no servidor (SQL 41, linhas 14-40):** gatilho `lab_metaciclo_guarda` antes de insert/update/delete: (1) nenhum `registros.rN` nem `obs.<dia>` existente pode mudar ou sumir, nem por upsert do documento inteiro; (2) o documento não pode ser apagado; (3) só quem tem `lab.planejamento_salvar` acrescenta chave nova. Gravar o mesmo conteúdo é aceito (idempotente). Erro com código 42501.

**Versionamento do quarter:** cada publicação grava `versoes.vN` = foto de `LQ_CAMPOS_VERSAO` (objetivo, krs, prioridades, iniciativas, meses, cenarios, riscos, gatilhos, capacidade) + `n, em, por, motivo, premissas, revisao` (Q:314-323). `lqDiferencas` (Q:325) lista campos que mudaram. A v1 é a referência do encerramento. Quarter `encerrado` não recebe versão.

**Revisão com motivo:** de quarter publicado (motivo obrigatório, Q:318); de meta de ciclo (`lmRevisao`, M:93: justificativa ≥ 10 caracteres; estimativa exige valor > 0, origem e limitações); de plano de mês (`lpoReplanejar`, O:107: data de corte AAAA-MM-DD, motivo, plano não pode estar fechado; a versão anterior inteira vai para `versoes[n]` e o `original` nunca é tocado).

**Registro da meta de ciclo:** `r1` = encerramento (tipo `encerramento` ou `recuperacao`), campos `n, tipo, em, por, versaoRegra, chave, ini, fim, estado, receita, pessoas, metas, fonte, motivo, evidencia, plano{status,versao,versoes}`; `rN` posteriores = `correcao` ou `estimativa` com `revisaDe`.

---
## 4. Regras e fórmulas exatas

### 4.1 Calendário do quarter
- `lqTrimestre(key, mesIni)` (Q:39): `off = ((mês−1) − (mesIni−1) + 12) % 12`; `q = ⌊off/3⌋+1`; primeiro mês = `(ano·12 + mês−1) − (off % 3)`. Nome: "Nº quarter de AAAA"; com ano fiscal, "Nº quarter do ano fiscal 2025/26 (começa em abril)". Chave inválida (mês fora de 1-12) → `null`. `mesIni` é limitado a 1-12.
- `lqDesloc(key, n)` (Q:46): move n quarters (3n meses), atravessa o ano.

### 4.2 Desvio e tendência
- `lqDesvio(meta, real, menorMelhor)` (Q:49): sem real → `sem_dado`; sem meta → `sem_meta`; `abs = real − meta`; `pct = abs/meta` **só se meta > 0**; `atingido = menorMelhor ? real ≤ meta : real ≥ meta`.
- `lqTendencia` (Q:56): precisa dos dois `estado='ok'`. Mínimo de amostra `minN` padrão 5 (taxas: se alguma amostra < mínimo → `amostra`, não conclui). "Estável" se: indicador `margem` ou nome começando com `tx_` ou contendo `compar` → |Δ| < 0,02 (2 p.p.); demais → |Δ/anterior| < 5%; anterior = 0 → estável só se Δ = 0. `t_contato` é "menor é melhor" (subir = piorou). Atenção: `ticket` e `t_contato` estão em `LQ_TAXA` (exigem amostra) mas usam a regra de 5% relativo, não de 2 p.p.

### 4.3 Revisão do quarter anterior (`lqRevisao`, Q:69)
- 15 indicadores (`LQ_IND_REV`, Q:18): receita, vendas, ticket, leads, agendadas, realizadas, oport, propostas, tx_agenda, tx_oport, tx_fech, tx_lead_venda, compar, margem, t_contato.
- Meta de receita/vendas do quarter = **soma das metas finais dos 3 meses, só se os 3 são conhecidos** (senão `final = null` com nota "meta conhecida em X de 3 meses: sem meta do quarter" — nunca soma parcial). Original = soma das originais se as 3 existem; "revisada" se |orig − final| > 0,5.
- Volumes (não-taxa): meta = soma das metas da empresa nos planos dos 3 meses. Taxas: **não se somam** ("veja mês a mês").
- Desvio calculado contra a final e, se revisada, também contra a original.
- Lacunas: `semacesso` → "pede a permissão da fonte"; sem dado → "a revisão não diz nada sobre este indicador"; taxa com n < minN → "amostra pequena".
- `lqAvaliarIniciativa` (Q:93): execução = marcos concluídos ÷ marcos não cancelados; "executada" se ≥ 0,8; resultado atingido se valor ≥ mínimo (≤ se menor-melhor; mínimo cai no alvo se vazio). Matriz: sem medida/amostra pequena → `sem_dado`; mal executada + abaixo → `mal_executada` ("não é motivo para abandonar a estratégia"); executada + abaixo → `sem_resultado` ("evidência a favor da hipótese enfraqueceu"); mal executada + atingiu → `resultado_sem_execucao`; atingiu sem marcos → `resultado_sem_marcos`; abaixo sem marcos → `sem_resultado`; senão `funcionou` ("associação, não prova de causa").
- `lqPerguntas` (Q:109): ids estáveis `exec:`, `hip:`, `rep:`, `ext:`, `pos:`, `cap`, `oferta`. No máximo 3 perguntas "piorou sem iniciativa" e 2 "melhorou sem iniciativa"; "capacidade" se houve déficit.

### 4.4 Diagnóstico (`lqDiagnostico`, Q:129) — limiares
Cada dimensão devolve estado `comprovado | hipotese | sem_dado | ok`. "Comprovado" é o desvio; a causa continua hipótese.
- **Demanda:** `leads reais < 0,95 × leads necessários` → comprovado. Impacto = `(necessário − real) × lead→venda × ticket` (tipo "receita potencial, não perdida"). Leads necessários = `metaQ ÷ ticket ÷ lead→venda` (Q:471).
- **Conversão por etapa** (4 etapas, `LQ_ETAPAS`, Q:457): só é problema se `queda = ref − atual ≥ max(0,02; 10% × ref)`. Comprovado exige n ≥ minN nos dois períodos **e** intervalos de Wilson 95% sem sobreposição (`wa[1] < wr[0]`); senão hipótese. Impacto = `entradas × queda × conversão a jusante × ticket`.
- **Ticket:** `atual < 0,9 × ref` → impacto `vendas × (ref − atual)`; comprovado se n ≥ minN nos dois lados.
- **Margem:** `atual < ref − 0,02` → impacto `receita × (ref − atual)` (tipo "margem afetada"); sem acesso ao Financeiro → "sem_dado".
- **Ciclo comercial:** `atual > 1,2 × ref` **e** `atual − ref ≥ 5 dias` → impacto `receitaMes × min(1; (atual−ref)/30)` (tipo "receita deslocada no tempo, não perdida"). `receitaMes = receita do quarter ÷ 3`. Ciclo = mediana de (fechadoEm − criadoEm) em dias.
- **Capacidade:** déficit > 0 do Planejamento → comprovado.
- **Perdas:** poucas (< minN) → sem_dado; `(Preço + Inviabilidade econômica + Financiamento negado) ÷ total ≥ 0,3` → **sempre hipótese** (motivo declarado por quem perdeu).
- **Canal:** vendas totais ≥ minN e maior canal ≥ 60% da receita → comprovado, tipo "receita em risco" (valor = receita do canal).
- Ordenação: comprovado → hipótese → sem_dado → ok; dentro, por impacto R$ decrescente.
- Referência: **180 dias antes do quarter** (Q:459).

### 4.5 Prioridades
- `lqPontuar` (Q:186): 9 critérios com valor 1/2/3; ponto = `sinal × (valor − 2)`; sinal +1 para impacto, evidência, urgência, controle; −1 para esforço, custo, risco, tempo, dependências. Critério vazio ou fora de 1-3 fica fora da soma e aparece em "sem avaliação". Texto "a favor: …; contra: …; sem avaliação: …".
- `lqPriorizar` (Q:191): ordem manual vence quando ambos têm `ordem`; quem tem ordem vem antes de quem não tem; senão pontos desc, depois impacto R$ desc.
- `lqFoco` (Q:197): 0 aceitas → aviso; > 5 → "tende a virar lista sem hierarquia"; < 3 → informativo; 3-5 → sem aviso. Contam `aceita`, `modificada`, `propria`.

### 4.6 Cenários (o motor que o quarter usa)
- `lpoModelo` (O:75): `lead→venda = lead_ag × ag_real × real_oport × oport_venda` (todos > 0; senão `taxaLeadVenda`). `novas = leadsRestantes × lead→venda × cabe`. `vendas = vendasReal + pipeVendas + novas`. `receita = receitaReal + (pipeVendas + novas) × ticket`. `margemR = receita × margem`.
- `lpoCenarios` (O:83): cada premissa em `LPO_PREM` (ticket, margem, leadsRestantes, cabe, pipeVendas, 4 taxas) recebe delta relativo: `v1 = v0 × (1+d)`; taxas, `cabe` e margem **limitadas a 0-1**. Sem regra explícita, conservador "automático" usa o p25 da variação histórica. Sem nada, conservador = neutro e a tela diz "sem premissa própria: igual ao base".
- No quarter (`lqCenariosCtx`, Q:492): taxas e ticket do histórico/plano do mês atual; `var['taxas.k'] = {p25: limite inferior do Wilson 95%}`; `leadsRestantes = ritmo de leads/dia do quarter anterior × dias corridos restantes`; `cabe` = fração dos ciclos históricos ≤ metade dos dias restantes; `pipe` = pipeline aberto (só no quarter em andamento); continuidade = `receita do quarter anterior ÷ dias dele × dias do quarter`. `fixo = receita já fechada + pipe × ticket`; `novo = receita neutra − fixo`.
- Diálogo de premissas (Q:1016): conservador de −95% a 0%; otimista de 0% a 300%; **justificativa obrigatória** para qualquer premissa alterada.
- Também em O: comparação por KPI (gap de cada cenário contra a meta), **conflito econômico** (cenário bate receita mas margem < mínima), **sensibilidade ±10%** por premissa, ordenada pelo efeito absoluto.

### 4.7 Meta ambiciosa × viável (`lqMetaVsCenarios`, Q:202)
Linhas: continuidade, conservador, base, otimista; `alcanca = v ≥ meta − 0,5`; `distancia = meta − v`. "O que a meta exige": se base < meta e `novo > 0`: `f = (meta − fixo) ÷ novo − 1`; texto: "+f de leads com mesma conversão e ticket, ou +(√(1+f) − 1) em dois deles". Leitura: cabe no conservador/continuidade → "pode ser pouco ambiciosa"; só no base; só no otimista ("depende das hipóteses"); em nenhum → "acima de todos os cenários". **Nunca reduz a meta.** Teste: meta 1.000.000, fixo 200 mil, novo 600 mil → +33,3%.

### 4.8 Repartição pelos meses e pelo programa
- `lqRepartir(total, du)` (Q:211): `total × du_k ÷ Σdu`; sem dias úteis, divide igual.
- `lqPesos(metasMes, du)` (Q:213): `peso_k = meta_k ÷ du_k`, normalizado pelo maior (maior = 1); mês sem meta/dia → 1. Isso faz o programa reproduzir exatamente as metas mensais digitadas.
- `lpoPrograma` (O:268): **2 a 6 ciclos, consecutivos, sem repetição** (virada dez→jan vale). Peso do ciclo = `dias úteis × peso`. **Meta original** do ciclo = meta agregada repartida por esse peso, **congelada**. **Meta vigente** dos ciclos não fechados = `max(0; meta agregada − realizado dos ciclos fechados)` repartido entre os não fechados. Ciclo fechado tem vigente `null`. Saldo do ciclo anterior = `real − original`. Excedente também passa adiante; meta batida → vigente 0, nunca negativo. Exemplos dos testes: 300 mil em 20/22/18 dias úteis → 100/110/90 mil; outubro fecha 80 mil → 121 mil e 99 mil; fecha 130 mil → 93,5 e 76,5 mil.

### 4.9 Resultado-chave e iniciativa
- KR obrigatório (`LQ_KR_REQ`, Q:216): indicador, valor de partida, meta final, responsável, critério de sucesso, frequência. Tipo: `resultado` ou `antecedente`. Período: quarter inteiro ou cada mês.
- Iniciativa obrigatória (`LQ_INI_REQ`, Q:220): 13 campos (nome, prioridade, responsável, problema, hipótese, variável, indicador, valor inicial, alvo, mínimo, continuar, corrigir, interromper) **mais** ao menos 1 marco. **Nome vago** (`lqVago`, Q:218): começa com melhorar/aumentar/otimizar/crescer/vender/alavancar/focar, até 4 palavras e até ~25 caracteres após o verbo → bloqueia ("intenção, não intervenção").
- `lqNiveis` (Q:223): entregável (atrasado = marco não concluído com prazo < hoje), execução (≥ 80% = executada), hipótese (valor ≥ mínimo = validada), resultado (valor ≥ alvo = atingido); taxa com n < minN → `amostra`, nem valida nem atinge.

### 4.10 Bottom-up do mês (`lqBottomUp`, Q:236)
`vendas = meta ÷ ticket`; `oportunidades = vendas ÷ tx(oport→venda)`; `realizadas = oport ÷ tx(real→oport)`; `agendadas = realizadas ÷ tx(ag→real)`; `leads = agendadas ÷ tx(lead→ag)`; `contatos = agendadas ÷ tx(contato→reunião)`. Sem taxa: para ali e diz qual falta (`falta[]`), nunca inventa. Cada passo guarda a fonte da taxa (histórico/manual) e n. **Defasagem:** `fracaoAnterior = min(1; ciclo mediano ÷ dias do mês)`; se ciclo ≥ 50% do mês, avisa que parte das vendas vem de leads do mês anterior. **Sobrecarga:** necessário > capacidade do plano do mês em realizadas/agendadas/contatos. Teste: 400 mil, ticket 20 mil → 20 vendas → 80 oport → 160 realizadas → 200 agendadas → 500 leads → 2000 contatos. Sem ticket → erro. Capacidade mensal vem de `lqCapMes` (Q:832): cap por dia útil × dias úteis, SDR não conta realizadas, closer não conta agendadas.

### 4.11 Capacidade e sequência
- `lqCapacidade` (Q:251): rotina comercial `op` limitada a 0-0,95; capacidade do mês = `horas × (1 − op)` por pessoa; carga = soma das horas/mês das iniciativas ativas no mês (padrão: 3 meses); responsável sem capacidade declarada conta como excesso; orçamento total × disponível. Se há sobrecarga, alternativas fixas: priorizar (cortar a de menor prioridade), redistribuir (mês com folga), adiar, reforçar. Validações no diálogo: horas/pessoa 0-300; rotina 0-95%; aviso se iniciativa > 200 h/mês (~jornada de 170 h).
- `lqSequencia` (Q:268): mês de início = maior (mês do fim de cada dependência = início da dependência + ⌈implantação/30⌉, limitado a 2). `mesEfeito = início + (implantação + ciclo mediano)/30`; se > 3, "fora do quarter: meça um indicador antecedente". Dependência circular → erro.

### 4.12 Gatilhos, aprovação, publicação
- `lqGatilhos` (Q:283): medido nos **últimos 30 dias** do quarter. Estados: `incompleto` (sem limite), `sem_dado`, `amostra` (taxa com n < `amostraMin`, padrão minN), `disparado` (`op='acima' ? v>lim : v<lim`, estrito), `ok`.
- `lqAprovacao` (Q:292) — **bloqueios**: sem texto do objetivo; meta sem valor; nenhuma prioridade aceita; prioridade aceita sem iniciativa; iniciativa com lacunas; nenhum KR ou KR com lacunas; mês sem resultado esperado ou sem critério; **metas dos 3 meses não somam a meta do quarter (tolerância R$ 1,00, só se o indicador é receita)**; sobrecarga de capacidade sem decisão `tipo=capacidade`; conflito com outro programa de ciclos que cobre os mesmos meses (Q:889). **Avisos:** sem indicador antecedente; meta acima de todos os cenários sem risco registrado; nenhum risco; risco sem plano de resposta; nenhum gatilho; aviso de foco.
- `lqPublicar` (Q:315): quarter encerrado → recusa; versão = `versao+1` (publicado) ou `versao+1` do rascunho; revisão sem motivo → recusa; "primeira publicação" é o motivo padrão da v1.
- `lqPublicarAcao` (Q:996): cria (se não existe) `lab:prog:q<chave>` com `meta.receita`, `pesos` (de `lqPesos`), `pipe`, `original[ciclo].receita = metas mensais digitadas` e `status:'ativo'`; se existe, atualiza só `meta`, `pesos`, `status` e acrescenta histórico — **a meta original de cada mês nunca muda numa revisão**. Só se o objetivo é receita. "Levar a meta ao plano do mês" é ação manual do gestor (`lpProgAplicar`), não automática.

### 4.13 Acompanhamento
- `lqProjecao` (Q:893): para cada mês: futuro = `receita média/dia dos últimos 90 dias × dias do ciclo`; em andamento = projeção ajustada do Planejamento do mês (`lpCalc(k).proj.receita.ajust`), senão o realizado; encerrado = realizado. Atrasos: `Σ contribuição esperada da iniciativa × marcos atrasados ÷ total de marcos`.
- `lqReprevisao` (Q:328): `falta = max(0; original − realizado)`; `gap = projeção − original`; `projeçãoComAtrasos = projeção − Σ impactos`. Texto fixo: "A meta não muda sozinha: replanejar é uma decisão com motivo".
- `lqFechamentoMes` (Q:335): estados concluído, parcial, pendente e válido, replanejado, bloqueado, cancelado. **Só "pendente" e "replanejado" seguem** para o mês seguinte. Completo = nenhum sem classificar. O botão de registrar aparece a partir de `fim − 3 dias`.
- `lqEncerramento` (Q:341): compara **sempre contra a v1** (meta original), mostra a final ao lado; agrupa iniciativas em concluídas, abandonadas, confirmadas, rejeitadas (executadas sem resultado), falhas de execução, sem dado; custo = soma de orçamentos.
- `lqAprendizadoDe` (Q:384): rascunho de aprendizado a conferir; confiança `media` só se funcionou/sem_resultado **e** execução ≥ 0,8; senão `baixa`. Texto de implicação por caso.
- `lqDailyResumo` (Q:376): conta dias por status (bom/atenção/crítico/sem_dado) do Fechamento do dia dentro do quarter; desvios que repetem em ≥ 2 dias; dias com "Meta do Q… em risco". A lista cobre os últimos 60 dias.

### 4.14 Avisos no sino (`lqAvisos`, Q:353)
- Próximo quarter: 0 a 15 dias para começar **e** sem plano publicado/encerrado.
- Quarter anterior publicado e não encerrado depois do fim.
- Só com o quarter atual **publicado**: gatilho disparado; marco vencido (prazo < hoje, não concluído/cancelado); projeção `< 0,95 × meta vigente` **e** ≥ 10 dias de quarter decorridos; fechamento do mês quando faltam ≤ 2 dias (mensagem "fecha em N dias") e continua "pendente" depois, até registrar. O id é estável enquanto a situação é a mesma, para o "lido" valer.

### 4.15 Objetivos (O)
- `lpoAvaliar` (O:22): operadores `atingir`/`min` (v ≥ a, folga 1e-9; gap = max(0, a−v)); `max`; `faixa` (entre dois valores; direção subir/descer/manter); `maximizar`/`minimizar` (sem "atingido", só direção). Meta antiga sem operador = atingir.
- `lpoConsistencia` (O:33): nunca altera as metas; achados `incompativel`, `exige_melhoria`, `sem_definicao`, `sem_dado`. Exemplos: vendas necessárias = `⌈receita ÷ ticket usado⌉` (ticket mínimo manda; senão histórico); `vendas × ticket mínimo > receita` → incompatível; ticket mínimo acima do histórico → "melhoria assumida"; oport necessárias = `⌈vendas ÷ tx_fech⌉` contra capacidade; reuniões realizadas necessárias = `⌈⌈vendas ÷ oport→venda⌉ ÷ real→oport⌉` contra capacidade; margem mínima acima da referência → possível violação. Teste do Caso A: 300 mil, ticket ≥ 22 mil → 14 vendas; 56 oport; 94 realizadas > 80 de capacidade → incompatível.
- `lpoViabilidade` (O:245): necessário × viável × déficit por etapa; alternativas (capacidade, equipe, conversão como hipótese, rever objetivo). Exemplo: 160 necessárias × 120 de capacidade → déficit 40; rever o objetivo: 120 × (0,5×0,3) = 18 vendas ≈ R$ 396 mil. "A meta não é reduzida automaticamente."
- `lpoReplanejar`, `lpoPonte` (explica por que a projeção mudou: fechamentos novos, pipeline, leads futuros, "Outros"), `lpoDistribuir` (reparte inteiros com soma exata), `lpoMinimoDia` (mínimo de 1 por dia na etapa principal; meta do mês sobe, nunca desce; canais por cota acumulada), `lpoFallback` (taxa por nível: pessoa → pares → empresa; confiança alta se n ≥ 30, média se ≥ minN, baixa sem amostra), `lpoClasseDesvio` (11 classes d1-d11 do tipo de problema), `lpoSugestoes` ("para o mesmo resultado, A precisa trabalhar N% mais volume que B", relevante se > 10% e amostra ≥ minN), `lpoResponsaveis`, catálogo de 12 critérios configuráveis `LPO_CRITERIOS` (meta em risco 95%, trajetória 85%/60%, conversão 70%, volume ok 90%, minN 10, janela de recuperação 5 dias úteis, etc.) e `lpoVeredito` (junta os sinais para não dar alertas contraditórios).

### 4.16 Metas oficiais do ciclo (M)
- `lmSnapshot` (M:48), ordem de decisão: plano `ativo/fechado` com receita > 0 → **conhecida**, fonte plano (versão final); encerrado sem receita no plano → desconhecida; ciclo em andamento → meta mensal da configuração, ou `sem_meta`; encerrado: última **observação diária dentro do ciclo** (`obs`); depois "foto diária" do LAB dentro do ciclo; senão **desconhecida** ("a meta da configuração de hoje não vale para o passado"). Observação com `fonte:'nenhuma'` = `sem_meta`. Rascunho nunca ativado em ciclo passado = desconhecida. Metas individuais de ciclo encerrado vêm só da observação da época.
- `lmVersoes` (M:36): linha do tempo `aprovada → substituida (cada uma com vigenteAte) → final`.
- `lmOficial` (M:73): último registro **não-estimativa**; estimativa nunca substitui. Se as fontes mudaram depois do registro, aparece `divergencia` (aviso), a meta registrada não muda.
- `lmRegistroInicial` (M:82): grava `r1` só se encerrado e sem nenhum registro (idempotente). Automático usa como data o `fechamento.em` ou o fim do ciclo e como autor "registro automático no encerramento do ciclo".
- `lmIntervalo` (M:114): meta de qualquer período = Σ (meta do ciclo × fração ponderada de dias elegíveis do ciclo dentro do intervalo). Dias elegíveis = dias úteis do calendário do plano; pesos semanais por dia; ciclo sem dia elegível → rateio por dias corridos com confiança "baixa". Estados: `ok`, `parcial` (algum ciclo desconhecido), `sem_meta`, `invalido`. **D20:** ciclos anteriores a "Analisar a partir de" ficam fora (nem meta, nem peso, nem "desconhecido").
- `lmAtingimento` (M:135): só calcula com meta conhecida em todo o intervalo; senão `null` com motivo.
- `lmAnual` (M:142): meta final do ano, meta acumulada até hoje, atingimento sobre o **acumulado**; projeção = `realizado ÷ fração ponderada decorrida` só a partir de **10%** (`LM_PROJ_MIN`) do ano; ano encerrado: projeção = realizado.
- `lmAuto` (M:211): a cada 5 min, para administrador: grava a observação do dia (meta oficial) e registra ciclos recém-encerrados dos últimos 2 meses que já tinham observação. Ciclos anteriores: só pela "recuperação" com prévia.

---
## 5. O que os testes garantem

**`lab_quarter.test.js` (~175 verificações)**
- Calendário: nov/2026 está no Q4 (out, nov, dez); ano fiscal abrindo em abril: fev/2026 = Q4 do ano fiscal 2025/26 (jan, fev, mar); Q1/2027 vem depois do Q4/2026; chave `2026-13` e `''` → null.
- Desvio: 300 mil × 240 mil → abs −60 mil, pct −0,2; meta 0 → sem %; sem real → `sem_dado`; menor-melhor 2 h contra 4 h → atingido.
- Tendência: +20% melhorou, +3% estável, taxa com n=3 → `amostra`, −5 p.p. com amostra → piorou, tempo de 1º contato 5→10 → piorou.
- Revisão: três meses com original 100/100/100 e final 100/80/100 → final 280 mil, original 300 mil, `revisada`, desvio −10 mil vs final e −30 mil vs original; evolução 90/70/110 mil; leads meta somada 180, tendência estável; margem sem acesso vira lacuna; mês de meta desconhecida → "2 de 3", sem soma parcial.
- Iniciativas: 1 de 4 marcos + abaixo → `mal_executada`; 4 de 4 + abaixo → `sem_resultado`; 4 de 4 + 0,35 ≥ 0,30 → `funcionou` com "não prova de causa"; amostra 2 → `sem_dado`.
- Diagnóstico: 150 de 200 leads → comprovado, impacto `50 × 0,05 × 20.000`; conversão 15% (n=200) × 30% → comprovado, impacto `100 × 0,15 × 1 × 20.000`; n=4 → só hipótese; ticket 17 mil × 20 mil (n=12) → comprovado, 12 × 3.000 = 36 mil; ciclo 60 × 40 dias → comprovado, atraso (não perda); canal com 83% → "receita em risco"; perdas por preço → sempre hipótese; **nenhuma dimensão de operação/entrega**.
- Priorização: pontos = soma visível (impacto alto +1, evidência alta +1, esforço alto −1, custo baixo +1 = +2); critério não avaliado aparece; ordem manual vence; 6 aceitas avisa "acima de 5".
- Meta × cenários: meta 1 mi acima de todos → não reduz; exige +33,3%; repartição 900 mil por 20/22/18 dias úteis; pesos 300/400/200 mil → razões 0,75 e 0,5.
- Aprovação e versões: plano completo aprovável com um aviso de foco; bloqueios por mês sem critério, soma 800 mil ≠ 900 mil e sobrecarga sem decisão; v1 fotografa o plano; revisão sem motivo recusada; v2 não toca a v1; `lqDiferencas` = `objetivo`; encerrado não recebe versão; reprevisão 900 mil/410 mil: `projeçãoComAtrasos` 800 mil.
- Bottom-up e capacidade: cadeia 20→80→160→200→500→2000; defasagem 35 dias; sobrecarga 60; Ana 50 h para 40 → excesso 10; orçamento 5 mil × 3 mil → excesso 2 mil; rotina de 25% reduz 80 h a 60 h.
- Sequência, gatilhos (disparado com amostra suficiente, "amostra" não dispara), avisos do sino (95%, 10 dias, 2 dias do fim do mês, 15 dias do próximo quarter), Fechamento do dia no quarter (4 dias, 2 em atenção, "Ana sem reuniões" em 2 dias), aprendizado sugerido, encadeamento e marcos da semana por pessoa (nome completo, primeiro nome, acento).

**`lab_objetivos.test.js`:** operadores (faixa 20-25%: 27% → gap 2 p.p.); Caso A (14 vendas, hipóteses rotuladas, incompatível com capacidade 80); Caso E (maturação: 100 leads × 0,3 × 0,7 × 0,5 × 0,3 = 3,15; só 60% cabem → 1,89; vendas 8,89); cenários (conservador < neutro < otimista; taxas até 100%; conflito de margem; conservador automático pelo p25); Caso C (fallback: SDR nova usa pares, n=40); Caso G (replanejamento guarda v1, original intacto, restante no corte 180 mil/9 vendas); ponte (+44 mil, −20 mil, −12 mil = +12 mil); distribuição (22 em 5 dias = 4,4,5,4,5); mínimo de 1 por dia (5 agendadas em 23 dias → 23, +18; 5 canais × 8 em 31 dias deixam de ter 23 dias zerados); classes de desvio; sugestão individual (Pedro 25% mais volume); critérios (padrão × configurado); veredito; viabilidade; **programa de ciclos (D8)** com os exemplos numéricos da seção 4.8.

**`lab_metas.test.js` (D16-D21):** plano fechado replanejado 100→90→80 mil: oficial = 80 mil (não os 50 mil da configuração); versões `aprovada,substituida,substituida,final`; ciclo encerrado sem plano → desconhecida; observação dentro do ciclo vale (45 mil), a de fora (99.999) não; foto diária vale; `r1` idempotente; alteração posterior do plano (95 mil) **não muda** o oficial e aparece como divergência; revisão exige justificativa ≥ 10 caracteres; estimativa sem origem/limitações recusada e **não substitui** o desconhecido; rateio por dias úteis (90 dias em 4 ciclos); aditividade; pesos semanais (semana de peso 2 recebe o dobro); fim de semana e feriado sem meta; ciclo sem dia elegível → dias corridos e confiança baixa; D20; ano (acumulado 9-10 ciclos, projeção só ≥ 10%); verificações de código-fonte: leitura não grava, uma única porta de gravação `lmGravar`, só acrescenta, exige `lab.planejamento_salvar`, e que o CRM inteiro lê a meta por `lmMetaCiclo` (uma definição).

**UI `lab_quarter.mjs` (percorre as 6 fases com relógio fixo 21/10/2026):** cabeçalho; ponto de partida R$ 60.000 com meta oficial R$ 280.000; planejado × realizado (300 mil, 280 mil revisada, 60 mil, −220 mil, −78,6%); diagnóstico com comprovado/hipótese/sem avaliar; prioridade aceita com decisão; critérios "Pontos +2…"; mudar ordem; **meta de R$ 900.000.000 é recusada com aviso (> 3× otimista)**; objetivo 450 mil com partida 60 mil; KRs sugeridos pelo bottom-up; iniciativa vaga ("Aumentar vendas") aparece com "Falta para aprovar"; metas sugeridas somam 450 mil (±2); meta negativa não entra nem apaga a anterior; capacidade Ana 30 h × 20 h → "+10 h"; publicação bloqueada até registrar decisão de capacidade; publicado v1 + programa `lab:prog:q2026-10`; revisão sem motivo recusada; v2 com meta 420 mil, v1 e original dos meses intactos; "Levar a meta ao plano" cria rascunho de novembro; Plano do dia mostra o entregável da Ana "vence em 3 dias"; sino mostra "Projeção do Q4 2026 abaixo da meta" e clique abre `#lab/quarter/publicar`; sem rolagem lateral no celular; sem erros no console.

**UI `lab_metas.mjs`:** observação do dia gravada (120 mil, fonte plano); ciclo fechado antigo não é registrado sozinho; Painel mostra 80 mil (versão final) e não 50 mil; Este mês = acumulada + meta do ciclo à parte; recuperação com prévia; revisão para desconhecida; estimativa não substitui; fechar plano grava `r1` uma vez e não apaga metas diárias; D20.

**UI `lab_plano.mjs` (parte metas/cenários):** operador por meta (pelo menos), consistência (14 vendas), tabela de cenários, premissa do conservador −10% gravada, publicar abre resumo auditável, replanejamento cria v2 com motivo, critério de meta em risco 92% fica no histórico, programa de ciclos (900 mil em 3 ciclos), "Levar a meta ao plano", e segundo programa com os mesmos ciclos é recusado.

---
## 6. Comparação com o V2 atual

O V2 (`packages/ciclos/src/quarter.ts`, `plano.ts`, `consultas.ts`) tem 6 passos: Diagnóstico → Meta → Cenários → Esforço necessário → Programa de ciclos → Compromisso (travar e gerar as metas). Cada passo avança `fase`; travar é irreversível (gatilho `somente_acrescimo` no SQL).

| Capacidade do V1 | V2 | Avaliação |
|---|---|---|
| Quarter = 3 ciclos, ano fiscal configurável | `quarterDe(mesInicioAno, inicioCicloDia)` | **Equivalente** (e com dia de início de ciclo configurável, melhor que o V1) |
| Diagnóstico do quarter anterior | `relatorio()` da Fase 2: CPL/CAC/ROI/conversão/Wilson/fluxo | **Raso/diferente**: é um relatório de métricas, não um diagnóstico. Sem planejado × realizado (não há meta original × final), sem tendência vs quarter anterior, sem estado comprovado/hipótese/sem dado por dimensão, sem impacto em R$ com premissas, sem lacunas, sem retrospectiva guiada. O Wilson existe no pacote de métricas mas não é usado para "comprovar" |
| Meta | Um número de receita, sem objetivo textual, sem KRs | **Raso**. Sem "meta ambiciosa × viável", sem trava de sanidade (> 3× otimista), sem continuidade, sem distância a cada cenário |
| Cenários | `CENARIOS = {0,85; 1; 1,15}` multiplica **todas as taxas** (máx. 1); só 3 saídas | **Raso e contrário ao desenho do V1** (que proíbe "×0,9 em tudo"). Faltam: premissas nomeadas com justificativa, conservador pelo limite de Wilson, ticket/leads/pipeline/fração-que-fecha como premissas, comparação por KPI, sensibilidade ±10%, conflito econômico (margem), pipeline e realizado já no quarter |
| Esforço necessário | `buildupReverso` por pessoa/canal/dia útil (já no pacote planejamento) + `confirmarEsforco` bloqueia se faltar taxa | **Equivalente no cálculo e melhor na granularidade** (por pessoa e canal). **Falta**: defasagem pelo ciclo mediano, comparação com capacidade declarada (V1 mostra déficit), mínimo diário, alternativas |
| Programa de ciclos | Pesos normalizados (dias úteis por padrão), último ciclo absorve o arredondamento; metas gravadas só-acréscimo com nota | **Raso**: não há meta original × vigente. O V2 reparte uma vez e congela; se o ciclo 1 fica abaixo, nada rebalanceia os próximos. Faltam: 2-6 ciclos, vigente = falta redistribuída, saldo herdado, bloqueio de programas sobrepostos, "Levar a meta ao plano" como ato do gestor |
| Travar | Irreversível, sem revisão | **Raso e rígido**: o V1 permite revisão com motivo → nova versão v2, v1 intacta, meta original de cada mês preservada. No V2, errou o plano → não há caminho (só novas metas por acréscimo, sem registro do porquê) |
| Prioridades, iniciativas, marcos, hipóteses de iniciativa, quatro níveis | Não existe | **Não existe** (o pacote `hipoteses` do V2 é de outra natureza: achados por condição/impacto) |
| Resultados-chave e indicadores antecedentes | Não existe | **Não existe** |
| Capacidade e carga em horas, orçamento, sequência/dependências | Não existe (só capacidade por função no build-up) | **Não existe** |
| Riscos (matriz), gatilhos de decisão | Não existe | **Não existe** |
| Aprovação com bloqueios explicados | Só a ordem dos passos e `plano.ok` | **Raso** |
| Acompanhamento: reprevisão, projeção, fechamento mensal por compromisso, encerramento comparável à v1 | `ritmo` (esperado linear, no_ritmo/atenção/atrás) + `fecharCiclo` | **Parcial**: o ritmo de ciclo existe (o V1 o tem em lab_plan, fora desta frente), mas não há projeção do **quarter**, nem reprevisão, nem encerramento do quarter |
| Retrato imutável | `retrato_ciclo` com SHA-256 e verificação de integridade | **O V2 faz melhor aqui**: assinatura prova que não foi alterado. O V1 garante imutabilidade por gatilho, sem hash |
| Aprendizados | 4 tipos (`funcionou|nao_funcionou|hipotese|decisao`) com texto livre, só-acréscimo | **Raso**: sem evidência, confiança, condições, implicação, origem; não alimentam a revisão do próximo quarter |
| Metas históricas por ciclo (estado conhecida/desconhecida/sem_meta/estimada/fora, registros rN, observação diária, divergência) | `lab.meta` só-acréscimo com `nota`; `metasVigentes` = a mais recente | **Raso e perigoso para o atingimento**: não há "meta desconhecida"; ciclo sem meta tende a ser lido como zero ou ausente sem distinção; sem rateio de períodos parciais, sem ano (acumulado × final × projeção), sem versão com motivo |
| Replanejamento com data de corte, ponte da projeção | Não existe (só contingência diária) | **Não existe** |
| Objetivos (operadores atingir/min/max/faixa), consistência entre metas | Não existe | **Não existe** |
| Avisos (sino), entregáveis no Plano do dia, link entre telas | Não existe | **Não existe** |
| Árvore objetivo → resultado | Não existe | **Não existe** |

Resumo crítico: o V2 acerta no esqueleto (ciclos, build-up reverso por pessoa, metas só-acréscimo, retrato assinado) e na estrutura de dados relacional (tabela `quarter` com `fase`, `premissas`, `cenario`, `pesos`). Mas o "quarter" do V2 é um **calculador de meta em 6 cliques**; o do V1 é um **sistema de gestão da estratégia**: decide-se *o quê e por quê* (diagnóstico → prioridade → iniciativa com hipótese testável) antes de decidir *quanto*. O V2 começa pelo "quanto". Como o dono quer ver "o desenho da estratégia" e "se o time produz o que a meta exige", as lacunas mais graves são: (1) meta original × vigente e versões com motivo; (2) metas desconhecidas tratadas como tais; (3) cenários por premissa; (4) prioridades/iniciativas/KRs/gatilhos; (5) acompanhamento do quarter (projeção/reprevisão).

---
## 7. O que isso entrega que uma planilha não entrega

1. **Verdade histórica que não se reescreve.** Meta original congelada, versões numeradas, registro por ciclo com gatilho no servidor. Em planilha, quem edita o número de setembro em dezembro muda o passado sem rastro. Aqui, "foi 100 mil, virou 90 mil em 20/09 por feriado, fechou em 80 mil" é consultável.
2. **"Não sei" é um valor.** Ciclo sem evidência vira "meta desconhecida", fora do atingimento — a planilha põe zero ou copia a meta de hoje e distorce a média do ano.
3. **Honestidade estatística embutida.** "Comprovado" só com amostra mínima e intervalos de 95% sem sobreposição; taxa com amostra pequena não dispara gatilho, não valida hipótese, não conclui tendência. Planilha mostra 3 de 4 = 75% sem alarme.
4. **Separa execução de estratégia.** "Não funcionou" se divide em mal executada (hipótese não testada) e executada sem resultado (hipótese enfraquecida). Impede o time de abandonar boa estratégia por má execução.
5. **A meta não é "reduzida", é "explicada".** Mostra a distância até cada cenário e o que muda para chegar lá (+X% de leads, ou +Y% em dois fatores), com premissas nomeadas e justificadas. Evita o ritual de cortar a meta no meio do mês.
6. **O elo meta → esforço → capacidade → decisão.** Bottom-up do mês com origem de cada taxa, comparação com a capacidade e bloqueio de aprovação se a sobrecarga não tiver decisão registrada.
7. **Um programa que se rebalanceia.** O que sobrou ou faltou num mês passa para os seguintes sem tocar o histórico.
8. **A estratégia tem cadeia verificável.** Objetivo → KR → problema → prioridade → iniciativa → marco → meta mensal → observado, tudo clicável e preenchido com o que já existe. Entregáveis aparecem no Plano do dia do responsável.
9. **O sistema avisa.** Marco vencido, gatilho disparado, projeção 5% abaixo da meta depois de 10 dias, quarter começando sem plano, mês fechando — sem ninguém abrir a planilha.
10. **Memória que volta.** Encerramento e aprendizados alimentam a revisão do próximo quarter automaticamente.

---
## 8. Riscos e armadilhas ao portar para o V2

1. **Não portar o V1 como "tela com 40 formulários".** A parte pura (`lq*`, `lpo*`, `lm*`) é a joia: são funções sem tela, testadas. Portar primeiro como pacote TypeScript puro (`packages/ciclos`), reaproveitando os testes como especificação (os valores numéricos citados na seção 5).
2. **Armazenamento JSON mesclado vs relacional.** O V1 guarda o quarter num documento e usa `null` para apagar chaves. No V2 (tabelas, `somente_acrescimo`), decidir: tabelas relacionais para entidades com ciclo de vida (`prioridade`, `iniciativa`, `marco`, `risco`, `gatilho`, `decisao`) e JSON só para a foto de versão (`versoes.vN`). Versão = fotografia imutável + motivo (parecido com `retrato_ciclo`).
3. **O travar irreversível do V2 contradiz o V1.** Trocar por publicar → revisar com motivo → nova versão; manter meta original dos meses congelada. Sem isso, qualquer erro no plano exige hack.
4. **Armadilha de "meta desconhecida".** Se `lab.meta` continuar só devolvendo "a mais recente", o atingimento de períodos passados será mentiroso. É preciso o conceito `estado` (conhecida/desconhecida/sem_meta/estimada/fora) e o registro por ciclo. O V2 ainda não tem o equivalente de observação diária, foto diária nem "Analisar a partir de" (D20): definir a política de migração, porque o V2 nasce sem histórico (todos os ciclos anteriores à operação seriam "desconhecidos" se não houver o conceito de "fora").
5. **Dependências ocultas do V1.** O quarter chama funções de outros módulos que o V2 pode não ter com a mesma semântica: `lpMed` (catálogo `LAB_MET` de 15 indicadores), `lpCoorte` (coorte por etapa), `lpTaxa/lpHistorico` (fallback de taxas), `lpCalc().proj` (projeção do mês), `lpViabilidade`, `labHips`, `lmCiclo`, `dxCarregarLista`, `LAB_INTERV_CORE` (catálogo de intervenções com prazo/risco/"não usar"). Mapear cada uma para o equivalente do V2 antes de começar, senão o diagnóstico fica sem insumo.
6. **Limiares são políticas, não matemática.** 0,95, 10%, 2 p.p., 5%, 1,2×, 5 dias, 60%, 30%, 0,8, 3×, 10 dias, 15 dias, 180 dias, 30 dias, minN: estão espalhados e alguns duplicados (minN padrão 5 em `lq*` vs 10 em `LPO_CRITERIOS.minN`, e `labMinN()` na tela). Levar tudo para uma configuração por operação (o V2 já tem pack/herança) com histórico de mudança, como o V1 fez em `LPO_CRITERIOS` — e escolher **um** minN.
7. **Cenário do V2 (±15%) é conceitualmente incompatível.** Não "enriquecer" o fator: substituir por premissas nomeadas com delta, justificativa obrigatória e trava (conservador −95% a 0, otimista 0 a +300%), mantendo `lpoModelo` com leads restantes, fração que fecha no quarter e pipeline. Exige o histórico de ciclo mediano e pipeline aberto como entrada.
8. **Pouca história.** Muitos testes do V1 dependem de n ≥ minN. Num V2 recém-povoado quase tudo será "sem dado/hipótese": projetar UX para isso (a tela do V1 mostra a lacuna e o efeito dela, em vez de esconder).
9. **Arredondamento e somas.** O V1 tolera R$ 1,00 entre soma dos meses e meta do quarter; o V2 faz o último ciclo absorver o resto (melhor). Escolher uma regra só. Cuidado também com pesos: `lqPesos` produz peso = meta/du, enquanto o V2 normaliza para fração; os dois reproduzem a mesma repartição, mas não misturar.
10. **Escopo "só receita" é decisão deliberada** (Q:128: operação, OS e entrega ficam fora do quarter, decisão de 23/10/2026). Manter; do contrário o diagnóstico vira lista infinita.
11. **Permissões.** O V1 tem 3 chaves (`lab.planejamento_salvar`, `lab.cenarios`, `lab.configurar`) e políticas restritivas no banco. O V2 tem login Supabase Auth; definir papéis antes de portar gravações (principalmente o registro imutável da meta, que o gatilho 41 protege até de upsert).
12. **Escopo de portagem em camadas (recomendação):** (A) metas históricas + versões com motivo + programa com original/vigente (fundação, é o que dá credibilidade ao atingimento); (B) cenários por premissa + meta × viável + diagnóstico com Wilson; (C) prioridades/iniciativas/KRs; (D) capacidade, riscos, gatilhos, aprovação com bloqueios; (E) acompanhamento (projeção, reprevisão, avisos, fechamento mensal, encerramento, aprendizados estruturados); (F) árvore objetivo→resultado e integração com o Plano do dia.
13. **Armadilha de UI.** Diálogos muito longos (iniciativa tem ~35 campos; marcos em texto "mês | entregável | data | responsável"). O dono não é desenvolvedor; vale simplificar a entrada (linhas de marco, assistente), sem perder a validação (13 campos obrigatórios + marco).
