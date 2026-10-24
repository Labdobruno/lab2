# Relatório C — Fechamento de ciclo e Validação (LAB V1)

Fonte lida por inteiro: `fontes__lab_fecho.js` (326 linhas), `_acao.js` (171), `_diag.js` (317), `_tela.js` (341), `.css`, `fontes__lab_validacao.js` (415), `supabase__66_fecho_ciclo.sql` (44), mais os 4 testes unitários e os 8 testes de interface. Referências no formato `arquivo:linha`, usando o nome curto (fecho, acao, diag, tela, validacao, sql66).

Nota de leitura: o V1 usa "ciclo" para o período comercial (mensal, com dia de início configurável, `cicloDia`), "plano" para o conjunto de metas do ciclo, e "funções-dona" (LAB_MET, lpMed, lpCoorte...) para os módulos que calculam cada indicador. O fechamento NUNCA calcula indicador: ele só pergunta às funções-dona, confere, classifica e congela.

---

## 1. Para que serve cada parte (em termos de RevOps)

**Fechar um ciclo** no V1 não é apertar um botão que "trava o mês". É produzir um **relatório de fechamento**: uma fotografia imutável, com seus números, regras vigentes e o julgamento do gestor, que responde: "o mês foi bem-sucedido? onde perdi? o que aprendi? o que faço no próximo?". É feito uma vez por ciclo (quando ele termina), pelo dono do plano. Depois, só se corrige por **revisão** (r2, r3...), sempre com justificativa, sem apagar o original (r1).

O relatório tem 13 seções (tela:216-237): 1 leitura executiva; 2 planejado × realizado; 3 evolução ao longo do ciclo; 4 diagnóstico do funil; 5 pessoas; 6 canais e iniciativas; 7 diagnóstico integrado; 8 aprendizados; 9 plano de ação; 10 conexão com o trimestre; 11 comparação com o ciclo anterior; 12 integridade e limitações; 13 regras e versões usadas.

Perguntas que cada parte responde:

- **Integridade (`fiAvaliar`)**: "Posso confiar nestes números? O que está faltando ou torto nos dados?" Usada ANTES de fechar. Nunca bloqueia (`podeSeguir: true` sempre, fecho:100); o gestor pode seguir com pendências, que ficam gravadas como limitações do relatório.
- **Leitura executiva (`frLeitura`)**: "Bem-sucedido, parcial ou abaixo? Quais os 3 melhores e os 3 piores desvios contra a meta?" Só fatos e a decisão que o gestor escreveu; nenhuma causa.
- **Planejado × realizado**: meta ORIGINAL do plano ao lado da meta VIGENTE (depois de replanejamentos) e do realizado. Resolve a briga clássica "a meta mudou no meio do mês".
- **Diagnóstico (`fdMontar` → blocos 3 a 7)**: "Onde exatamente o resultado vazou e quanto vale?" Evolução semanal, funil em coorte com gargalos pesados em R$ (simulado), pessoas sem ranking, canais, iniciativas, e um diagnóstico que separa FATO, INTERPRETAÇÃO e HIPÓTESE.
- **Ação e aprendizado (`acao.js`)**: "O que fazer no próximo ciclo e o que realmente aprendi?" Gera plano de ação por regra (5 categorias), aprendizados com nível de confiança e liga o ciclo ao programa/trimestre. Nada vira tarefa ou meta sozinho.
- **Validação (`lab_validacao.js`)**: NÃO é parte do fechamento do ciclo. É uma **ferramenta de auditoria do administrador** para a migração de regras: compara, sobre a mesma base, a regra ANTIGA (código antes de 09/10/2026, commit 6f69d2f) com a regra NOVA, e classifica cada divergência como esperada / a revisar / não explicada. Responde: "mudei a forma de calcular ticket, reuniões, vendedor da venda, meta e investimento por canal; meus números mudaram por decisão minha ou por bug?". Uso pontual (depois de mexer em regra de negócio), não rotina mensal.

---

## 2. Telas e interações

### 2.1 Entrada
LAB › Planejamento › "Fechamento e aprendizado". Ao lado do fechamento antigo do plano (que continua existindo, `data-lpfechar`) aparecem botões (`lfBotoes`, tela:20-26): "Fechar o ciclo com relatório" (se não há r1), "Corrigir o relatório (revisão)" e "Abrir o relatório do ciclo (rN)". Os botões de gravar só aparecem se `lpAdmin() && frPodeGravar()` (administrador E chave `lab.planejamento_salvar`).

### 2.2 Fluxo de fechamento em 3 passos (`lfAbrirFluxo`, tela:265-314)
1. **Integridade**: contagem por gravidade (alta/média/baixa/info) e lista de pendências, cada uma com detalhe e "Impacto na análise". Se houver pendência (qualquer coisa que não seja `info`), o botão Continuar fica desabilitado até marcar "Entendo as limitações acima e quero seguir com elas registradas". Essas pendências viram `integridade.aceitas` no retrato.
2. **Prévia executiva**: mostra, SEM gravar nada, a leitura executiva, até 8 indicadores da empresa em planejado × realizado e a comparação com o ciclo anterior. Informa se o ciclo é parcial e se o plano será fechado junto.
3. **Confirmação**: se o plano ainda não está fechado, 3 perguntas: "O que funcionou e deve ser mantido?", "O que não funcionou e por quê?", "O que muda no próximo ciclo?". A terceira é obrigatória ("Registre ao menos o que muda", tela:303). O aviso final diz que o relatório "não pode ser apagado nem alterado" e que correções entram como revisão. Botão "Consolidar e fechar o ciclo" grava o r1 (`frGravar`) e, na mesma ação, fecha o plano com o fluxo antigo (`lpFecharMes`). Se o plano já estava fechado, só gera o relatório.

### 2.3 Revisão (`lfAbrirRevisao`, tela:316-331)
Recalcula tudo, mostra tabela "O que mudou desde o rN" (indicador, campo, antes, agora, diferença) e exige justificativa de pelo menos 10 caracteres. Se nada mudou: "não há o que revisar", sem botão de gravar.

### 2.4 Relatório (`lfRelatorio`/`lfRelHtml`, tela:216-261)
Janela larga com: cabeçalho (data, autor, "registro r1 (original)" ou "(revisão do r1)", chip "registro íntegro (hash ...)" ou "registro ALTERADO depois de gravado"); botões Imprimir/salvar em PDF e Copiar resumo executivo (só empresa, sem nomes de pessoas); abas de versões r1/r2...; caixa amarela com a justificativa e o impacto da revisão; navegação por seção; tabela com botão "evidência" por indicador (definição, fórmula, origem, função oficial e versão, tipo do número, grão, amostra, histórico, limitações); gráfico SVG de receita acumulada × ritmo esperado (linha cheia e tracejada, acessível); tabelas de funil, pessoas, canais; cartões de ação com "Criar tarefa a partir desta ação" (só abre o diálogo de tarefa já preenchido; só nas ações que não têm equivalente); caixas "Levar para o planejamento do próximo ciclo". Links "ver evidência" rolam até a linha e a destacam.

### 2.5 Ciclo seguinte (`lfAnteriorHtml`, tela:198-213)
No Planejamento › Metas do mês seguinte aparece o bloco "Do fechamento de [ciclo anterior]": decisões do gestor, ações marcadas para levar, aprendizados confirmados, hipóteses abertas (até 4), riscos, posição no trimestre, pendências aceitas. "Nada foi criado nem alterado."

### 2.6 Validação (`lbvSecao`, validacao:394-409)
LAB › Passado › Qualidade dos dados, no topo. Só administrador. Botão "Gerar comparação" → tabela de 7 indicadores (antiga, nova, diferença, %, contagem esperada/revisar/não explicada), cada um expansível com regra antiga, regra nova, fonte e a lista de registros que causam a divergência (máx. 60 na tela, tudo no texto copiado); blocos "Qualidade dos dados" e "Limitações"; botão "Copiar relatório" (texto puro). O resultado só vive na memória da aba.

---

## 3. Modelo de dados, imutabilidade e permissões

**Documento por ciclo**: `gestao` id `lab:fecho:<AAAA-MM>`, campo `registros.rN` (sql66:3-5, fecho:312). Cada registro (esquema 4, fecho:16) tem: `n`, `tipo` (encerramento|revisao), `revisaDe`, `justificativa`, `impacto[]`, `em`, `por`, `chave`, `ini`, `fim`, `parcial`, `regras` (versão do dicionário, do plano do dia, das metas, `cicloDia`, `analisarAPartir`, build do app), `integridade{itens,resumo,limitacoes,aceitas}`, `planejamento{metaOficial,pessoas,metas,plano,versoes}`, `indicadores[]`, `comparacao`, `leitura`, `evolucao`, `funil`, `pessoas`, `canais`, `iniciativas`, `contexto`, `diagnostico`, `limiaresDiagnostico`, `aprendizados`, `acoes`, `trimestre`, `blocos`, `pendentes`, `hash`.

**Cada indicador congelado** (fecho:120-126): `id` (`ind` ou `ind:pessoa`), escopo, nome, unidade, tipo (observado|calculado|estimado|simulado), definição, fórmula, fonte, função, versão da definição, grão, base, `menorMelhor`, `planejado_original`, `planejado_vigente`, `revisado`, `removida`, `refDesvio`, `realizado`, `estado`, `nota`, `amostra`, `desvio_abs`, `desvio_pct`, `atingimento`, histórico, limitações. Regra de ouro: "ausente ≠ zero" (sem dado fica `null`).

**Imutabilidade em duas camadas**:
- Servidor (sql66:13-37, gatilho `lab_fecho_guarda` antes de insert/update/delete na tabela `gestao`): (1) nenhum registro existente pode mudar ou sumir (compara `obj_new->k` com `obj_old->k` para cada chave antiga, mesmo se alguém tentar mesclar com null ou regravar o documento inteiro); (2) o documento `lab:fecho:*` não pode ser apagado; (3) só quem tem `usuario_tem('lab.planejamento_salvar')` acrescenta registro novo. Gravar o MESMO conteúdo passa (idempotente). O gatilho não confere o hash, nem o conteúdo, nem se o r2 é coerente com o r1.
- Cliente: `frRegistroInicial` só grava r1 se o ciclo não tem registro (fecho:206-210); `frRevisao` só gera rN+1 com justificativa ≥ 10 caracteres e ao menos um indicador diferente (fecho:222-231). `frHash` é FNV-1a de 32 bits sobre JSON estável (fecho:28-40): serve para DETECTAR alteração acidental (chip "registro ALTERADO"), não é assinatura criptográfica (o V2 usa SHA-256, melhor).

**Quem pode**: fechar/corrigir exige administrador (`lpAdmin()`) + chave de planejamento, na tela (tela:21 e 266, 317). No banco basta a chave de planejamento (admin tem todas). Gestor com LAB no nível máximo mas sem ser admin NÃO vê botões, e botões forjados no DOM não abrem nada nem gravam (teste lab_fecho_acesso). Marcar "levar para o próximo ciclo" (`faCarregar`, acao:165) também exige a chave e grava em outro documento, `lab:fechocarga:<ciclo>`, que NÃO é protegido pelo gatilho (o regex `^lab:fecho:` não casa com `lab:fechocarga:`); tem histórico `hist` próprio, mas é editável.

**Leitura do CRM** (`frColetar`, fecho:259-288): tudo vem das funções-dona; a "prévia" (`frPrevia`, fecho:291) não grava. Nada no CRM chama o fechamento sozinho (sem timer; teste garante que só a tela chama e `frGravar` só aparece em 2 handlers).

**Validação**: somente leitura (teste proíbe `patchG`, `fetch`, `localStorage` etc. no módulo), resultado só em `LBV.r` (memória), seção e botões só para `isAdmin()`.

---

## 4. REGRAS E FÓRMULAS EXATAS

### 4.1 Constantes do fechamento
- `FR_LIMIAR_META = 0.95` (fecho:19): meta atingida se realizado ≥ 95% da referência; para "menor é melhor", ≤ 105% (`2 − 0,95`).
- `FI_LIMIARES` (fecho:22): `dadoRuimAlto 0.10`, `perdaSemMotivoAlto 0.30`, `fotoCobertura 0.80`, `historicoMin 3`.
- Gravidades ordenadas alta(0) < média < baixa < info (fecho:23).
- Amostra pequena no indicador: n < 10 (fecho:117).
- Esquema do retrato = 4; `FR_STATUS` = bem_sucedido / parcial / abaixo / indeterminado ("Sem meta para classificar").

### 4.2 Integridade — `fiAvaliar` (fecho:52-101). Cada item: código, gravidade, título, detalhe, impacto.
| Código | Condição | Gravidade |
|---|---|---|
| PERIODO_INVALIDO | sem ini/fim ou fim ≤ ini | alta |
| CICLO_EM_ANDAMENTO | `hoje < fim` (fim exclusivo; no dia do fim já é encerrado) | alta |
| CICLO_FORA_OPERACAO | ciclo anterior ao início da operação no CRM (decisão D20) | alta |
| JA_CONSOLIDADO | já existe registro (informa rN, data, autor) | info |
| META_DESCONHECIDA | meta oficial `desconhecida` (sem plano ativo/fechado nem evidência) | alta |
| META_AUSENTE | `sem_meta` | média |
| PLANO_AUSENTE | sem plano | média |
| PLANO_NAO_OFICIAL | plano com status ≠ ativo/fechado (rascunho não é meta oficial, D2) | média |
| META_ALTERADA | `nVersoes > 0` (lista versão substituída, "até <data>", motivo) | info |
| INDICADOR_SEM_DADO | linha com estado ≠ ok. Alta se for da empresa e for `receita` ou `vendas`; média se empresa outro; baixa se por pessoa | alta/média/baixa |
| GANHO_SEM_VALOR | ganhos com valor vazio ou ≤ 0. Alta se ≥ 10% dos ganhos (1 de 8 = 12,5% já é alta); senão média | alta/média |
| GANHO_SEM_DONO | ganho sem registro "ganho com dono" no histórico (a venda cai no consultor atual) | média |
| PERDA_SEM_MOTIVO | perdas sem motivo. Alta se ≥ 30% (4 de 10); 2 de 10 = média | alta/média |
| AGENDAMENTO_SEM_DESFECHO | reuniões com data passada ainda "agendada/confirmada" (`AG_ABERTOS`). Impacto cita que ausência de registro não prova que não ocorreu | média |
| DIVERGENCIA_FONTES | |a−b| > 0,005 entre duas fontes. Hoje compara `LAB_MET.receita` com soma de `funil.valor` dos ganhos; vale a função-dona | alta |
| HIPOTESE_SEM_AVALIACAO | hipótese encerrada sem avaliação humana | média |
| HIPOTESE_EM_ABERTO | hipótese não encerrada quando `hoje ≥ fim` | baixa |
| TAREFAS_SEM_DESFECHO | tarefas com prazo no ciclo e status ≠ feita | média |
| HISTORICO_CURTO | ciclos anteriores com meta conhecida < 3 (0 ciclos = alta; 1 ou 2 = média) | alta/média |
| FOTO_DIARIA_INCOMPLETA | fotos diárias ÷ dias úteis < 0,80 (17/21 passa; 16/21 não) | média |

Contagem de "ciclos com meta" olha até 12 meses para trás (fecho:282). A "qualidade" que alimenta a integridade (fecho:270-276): ganhos do ciclo = negócios `etapa=ganho` com `fechadoEm` no ciclo; perdas = `etapa=perdido` com `fechadoEm` (ou `desde`) no ciclo.

### 4.3 Consolidação — `frConsolidar` (fecho:109-147)
Por indicador:
- `original` = meta do plano original (`P.original.metas`), `vigente` = `alvo` atual.
- `realizado` = `r.v` só se `r.estado === 'ok'`, senão null.
- Referência do desvio (`refDesvio`): vigente se existe; senão original; senão nenhuma. Meta removida num replanejamento continua no retrato (marcada `removida`), com desvio sobre a ORIGINAL (fecho:264-267, 119).
- `desvio_abs = realizado − ref`; `desvio_pct = (realizado − ref)/ref`; `atingimento = realizado/ref` (só se ref ≠ 0).
- `revisado` = original e vigente diferem em mais de 0,005.
- Limitações geradas: "sem dado: não é zero"; "sem acesso... não foi congelado"; "a versão original não tinha esta meta"; "sem versão original congelada"; "amostra pequena (n = X)"; "a meta saiu do plano".
- `parcial` = `hoje < fim`.

### 4.4 Leitura executiva — `frLeitura` (fecho:169-195) e `frAtingida` (167)
- Só indicadores da EMPRESA com meta e resultado conhecidos entram na situação.
- `atingida`: normal `realizado/ref ≥ 0,95`; ref = 0 → `realizado ≥ 0`; "menor é melhor" → `realizado ≤ ref × 1,05`.
- Status: nenhum avaliado → `indeterminado`; todos atingidos → `bem_sucedido`; nenhum → `abaixo`; senão `parcial`. Regra do teste: 76.000 de 80.000 (95%) atinge, 75.900 (94,9%) não.
- "A favor da meta" (`frFavor`): `desvio_pct`, invertido se menor-é-melhor. Top 3 positivos (favor > 0) e top 3 problemas (favor < 0), ordenados por favor e desempate por id.
- Ressalvas = pendências de integridade de gravidade ALTA. Decisões = só o que o gestor escreveu em "mudar", classe `recomendacao`, origem `gestor`.
- Narrativa fixa em 5 a 6 frases (meta oficial, receita realizada e % da meta, situação e "porque X de Y metas atingidas", aviso de ciclo parcial, nº de pendências altas, "Causas e hipóteses não são afirmadas aqui").

### 4.5 Comparação com ciclo anterior — `frComparar`/`frAnterior` (fecho:197, 248)
Ciclo anterior = mês −1. Se fora da operação: indisponível com motivo. Se tem retrato gravado: usa o realizado do VIGENTE dele (fonte `retrato`). Senão calcula ao vivo pelas funções-dona e DIZ ("calculado agora pelas funções oficiais"). `delta_abs = atual − anterior`; `delta_pct = delta/anterior` (null se anterior = 0). Só indicadores da empresa com valor nos dois ciclos. Se o atual é parcial, avisa que compara com ciclo completo. Efeito importante: o retrato do ciclo −2 gravado vira a base, e mudar dado do ciclo −3 depois NÃO altera a comparação do −1 (teste cenários).

### 4.6 Revisão e reprodução
- `frImpacto` (fecho:212): por indicador, compara `planejado_original`, `planejado_vigente`, `realizado` com tolerância 0,005; indicador novo = "incluído", sumido = "presente → null".
- `frRevisao`: recusa se não há r1, se justificativa < 10 caracteres; "nada" se impacto vazio; senão `n = base.n+1`, `revisaDe = base.n` (compara com a ÚLTIMA versão, não com r1).
- `frReproduzir` (fecho:235): confere `realizado` e `planejado_vigente` de cada indicador contra o "oráculo" (recálculo atual pelas funções-dona), tolerância ZERO (1 centavo diverge). Sem oráculo nenhum → `ok:false`. Detecta quando dado do passado mudou depois do fechamento (caso real nos testes: gravado 92.000, hoje 132.000).

### 4.7 Diagnóstico (`diag.js`). Limiares `fdLim` (diag:26), default: `trajetoria 0.85`, `metaRisco 0.95`, `conversao 0.70`, `volumeOk 0.90`, `minN 10` (em produção vêm de `lpLim()`, configuráveis).

**Evolução `fdEvolucao` (diag:32-77)**
- Semanas de 7 dias a partir do início do ciclo; receita por dia útil da semana.
- Maior/menor semana por receita÷dias úteis (exige ≥ 3 semanas com receita; semana de 2 dias não distorce).
- Concentração: maior venda ÷ total ≥ 0,50 (com ≥ 2 vendas com valor).
- Metades: divide a série diária no meio; `desaceleracao` se segunda metade < 0,8 × primeira; `aceleracao` se > 1,25 ×. Exige ≥ 10 dias e ≥ 3 vendas com valor. Texto sempre "os dados não dizem por quê".
- Desvio precoce: ritmo esperado da semana = `meta × diasÚteisAcumulados / diasÚteisTotais`; primeira semana com `acumulado/esperado < 0,85`; "corrigido" se receita final/meta ≥ 0,95. Se nenhuma semana abaixo → `trajetoria_ok`.
- Fotos diárias (projeção do próprio LAB durante o ciclo): precisa ≥ 3; primeiro dia com `projeção ajustada < 0,95 × meta` = "alerta cedo"; senão "sem alerta".

**Funil `fdFunil` (diag:85-143)**: 4 passagens oficiais (`FD_TRANS`, diag:261): lead→reunião agendada (`lead_ag`), agendada→realizada (`ag_real`), realizada→SQL (`real_oport`), SQL→ganho (`oport_venda`).
- Taxa por COORTE: dos negócios que entraram na etapa de origem no ciclo, quantos chegaram à seguinte até hoje (`lpCoorte`). Coorte < 30 dias = "imatura".
- Referência da taxa: 1º a premissa gravada no plano; 2º razão meta destino ÷ meta origem do plano; nunca o histórico recalculado hoje.
- `razaoRef = taxa/ref`; `abaixoRef` se < 1; `sinalConversao` se `razaoRef < 0,70` E n ≥ 10; `amostraSuficiente` = n ≥ 10.
- `variacaoAnteriorPP` = taxa − taxa da coorte do ciclo anterior.
- Permanência: mediana, em dias úteis (seg-sex, sem feriados, `fdDiasUteis`), do tempo na etapa de origem dos negócios que saíram dela dentro do ciclo; SLA = `prazo` da etapa no funil; `acimaSla` se mediana > prazo.
- **Impacto simulado**: se `taxa < ref`: `extraAvanço = n × (ref − taxa)`; `vendas = extraAvanço × produto das taxas das etapas seguintes` (nulo se alguma etapa seguinte não tem taxa); `receita = vendas × ticket médio do ciclo`. Exemplo do teste: 16 × (0,60 − 0,375) × 0,5 = 1,8 vendas × R$ 30.000 = R$ 54.000. Sempre rotulado "Simulação, não venda certa".
- **Gargalos** (7 classes `FD_CLASSES`): volume, conversão, velocidade, qualidade, processo, capacidade, registro.
  - Volume: indicador de volume (leads, agendadas, realizadas, oport) com `real/meta < 0,90`. Só é "falta de volume" se for a entrada do funil OU a etapa anterior também estiver abaixo (`vOk(anterior) === false`); senão é conversão (evita contar a mesma falta duas vezes). Peso = `(meta − real) × produto das taxas dali até a venda × ticket`. Exemplo: leads 30 de 100 → 70 × 0,03 × 30.000 = R$ 63.000.
  - Conversão: `razaoRef < 1`; peso só se houver impacto E amostra suficiente (n ≥ 10); caso contrário aparece sem R$ e o texto diz "amostra pequena".
  - Velocidade: `acimaSla` e n ≥ 3; sem peso ("sem como converter o atraso em resultado").
  - Qualidade: só como HIPÓTESE, se `real_oport` abaixo da referência; senão vai para "não mensurável".
  - Processo: leads sem nenhum contato (Cadência/WhatsApp) > 0; texto inclui "ausência de registro não prova que o contato não ocorreu".
  - Capacidade: só se definida no plano (contatos/dia por pessoa × dias úteis) e `contatosReal ≥ 0,90 × capacidade`; senão "não mensurável".
  - Registro: se integridade tem GANHO_SEM_VALOR, GANHO_SEM_DONO, PERDA_SEM_MOTIVO, AGENDAMENTO_SEM_DESFECHO ou INDICADOR_SEM_DADO.
  - Ordenação: peso em R$ decrescente (sem peso por último), depois ordem das classes, depois id. O maior gargalo é o de maior PESO, não a pior taxa (teste: 18% vs 20% com 1000 leads ≈ R$ 72 mil vence 30% vs 60% com 10 negócios ≈ R$ 45 mil).
- Perdas: atribuídas à passagem pela última etapa antes de perder; motivo vazio vira "Sem motivo". Limitação se ≥ 30% sem motivo.

**Pessoas `fdPessoas` (diag:150-182)**: ordem alfabética, sem ranking. Quatro grupos separados: esforço (`contatos`), execução (`agendadas`, `realizadas`, `oport`), eficiência (conversões em coorte), resultado (`vendas`, `receita`).
- `volOk` = todos os indicadores de esforço+execução com atingimento ≥ 0,90; `resBaixo` = algum de resultado < 0,95.
- Padrões (todos "fato"): `esforco_ok_conversao_baixa` (volOk, resBaixo e conversão individual < 0,70 × a da empresa com n ≥ 10); `volume_e_resultado_baixos`; `recebeu_menos` (resultado baixo e leads ou oportunidades recebidas < 0,80 × média de quem tem a mesma função, média só com ≥ 3 pessoas da função); `meta_batida`; `registro` (vendas sem valor/dono).
- Padrão que se repete em ≥ 2 pessoas (exceto meta_batida) vira `recorrentes` ("olhar o processo, não só a pessoa").
- Perguntas do briefing: "melhor" = quem tem `meta_batida`; "replicar" e "acompanhar" são deliberadamente NÃO afirmados.
- Limitações: < 3 pessoas "sem base para padrão do time"; amostra abaixo do mínimo; tempo de atuação não existe no CRM.

**Canais `fdCanais` (diag:186-199)**: considera canal com lead, venda ou investimento. Maior receita; maior/menor conversão só entre canais com ≥ 10 leads (precisa de ≥ 2 canais); "sem investimento lançado" (leads sem investimento); investimento incompleto (mês sem lançamento) desliga CPL/CAC/ROI (D21); campanhas não têm registro estruturado, logo coincidência de período nunca é atribuída.

**Iniciativas `fdIniciativas` (diag:204-215)**: hipótese vira sucesso/insucesso/inconclusiva/aguardando/andamento. Decisão sugerida: sucesso → "Manter e repetir para confirmar" (se sem avaliação humana: "Registrar a avaliação antes de decidir"); insucesso → investigar antes de ajustar ou interromper; inconclusiva → coletar mais dados; em andamento → acompanhar. Amostra < 5 gera limitação. Toda limitação lembra que o veredito não separa o efeito de outras mudanças. "Tarefa concluída não é resultado alcançado."

**Diagnóstico integrado `fdDiagnostico` (diag:226-257)**: três classes: FATO (número observado), INTERPRETAÇÃO (exige 2 ou mais fatos independentes alinhados), HIPÓTESE (explicação possível com "Para validar").
- Sempre: `resultado` (situação) e `desvio_principal` (gargalo de maior peso, ou o primeiro gargalo-fato).
- Interpretação `volume_ok_conversao_baixa:<passagem>` (confiança média): conversão abaixo da ref com amostra e volume de entrada ≥ 0,90 da meta. Interpretação `conversao_e_velocidade` (confiança baixa): conversão abaixo + permanência acima do prazo com n ≥ 3 ("coincidir não é causar").
- Hipóteses (`FD_HIP`, diag:220-225), até 3 conversões, 2 hipóteses por passagem, todas com confiança baixa e o dado que separa as rivais: lead_ag ("velocidade/qualidade do 1º contato"; "perfil do lead que entra"), ag_real ("confirmação e no-show"; "lead agendado sem intenção real"), real_oport ("qualificação ou aderência"; "condução da reunião"), oport_venda ("proposta, preço ou condição"; "cadência de avanço das negociações").
- `perdas_sem_motivo` se ≥ 30%. Padrão de pessoas recorrente, até 2 observações de canais, evento de contexto do diário (ou "nenhum registrado... não significa que nada aconteceu") e sempre `limite_causal` ("dados de um único ciclo não permitem afirmar um único fator").
- `fatores`: controláveis (volume, conversão, velocidade, processo), estruturais (capacidade), mensuração (registro), externos (contexto).

### 4.8 Aprendizados `faAprendizados` (acao:22-51)
- `confirmado`/`refutado` só com: veredito do indicador (sucesso/insucesso) E avaliação humana registrada E amostra n ≥ `minN` (10). Caso contrário `aberta`, com os motivos listados.
- Confiança: confirmado = "média"; o resto "baixa"; NUNCA "alta" ("um ciclo não basta").
- O texto do gestor ("funcionou"/"não funcionou") entra como `declarado`, confiança baixa, "não conferida por indicador".
- Até 4 hipóteses do diagnóstico entram como `aberta`.
- **Padrão promissor**: o mesmo `chaveTeste` (código de intervenção ou código da hipótese ou título normalizado) confirmado em ≥ 2 ciclos distintos (olha até 6 ciclos para trás, acao:156); marca `padraoPromissor`; texto: "não uma regra universal". Teste anterior só "aberta" ou o mesmo ciclo repetido não contam.

### 4.9 Plano de ação `faAcoes` (acao:56-111). Categorias: imediata, processo, crescimento, experimento, monitoramento (ordem fixa). Prazo = fim do ciclo (ou hoje, se maior) + dias sugeridos; responsável = sempre "gestor do LAB (quem fecha o plano)" (nunca nome inventado). Cada ação tem problema, evidência, ação, indicador, esperado, critério objetivo, como avaliar, dependências, riscos.
| Ação (id) | Gatilho | Categoria | Prazo |
|---|---|---|---|
| a:registro:perda_motivo | PERDA_SEM_MOTIVO e perdas > 0 | imediata se sem-motivo/total ≥ 0,30, senão processo. Critério: no máximo 10% sem motivo | 7 d |
| a:registro:ganho_completo | GANHO_SEM_VALOR ou GANHO_SEM_DONO | imediata | 5 d |
| a:registro:agenda_desfecho | AGENDAMENTO_SEM_DESFECHO | processo | 7 d |
| a:execucao:tarefas_abertas | TAREFAS_SEM_DESFECHO | imediata | 5 d |
| a:funil:volume_entrada | gargalo de volume em leads | crescimento | 10 d |
| a:funil:validar_<passagem> | até 2 gargalos de conversão: 1º com peso = imediata, demais experimento. Ação é "levantar o dado que separa as explicações" e desenhar teste (nunca "corrigir"); critério: taxa ≥ ref com n ≥ 10 OU conclusão registrada de que a referência estava errada | imediata/experimento | 10 d / 15 d |
| a:funil:velocidade_<etapa> | gargalo de velocidade | processo | 7 d |
| a:funil:primeiro_contato | gargalo de processo; critério ≤ 5% leads sem contato | processo | 7 d |
| a:pessoas:padrao_<padrão> | padrão recorrente em várias pessoas | processo (revisar roteiro e critério de passagem; critério: conversão > 70% da empresa) | 15 d |
| a:pessoas:acompanhar | padrões individuais `esforco_ok_conversao_baixa` ou `recebeu_menos` de quem NÃO está no padrão repetido | monitoramento | 30 d |
| a:canais:lancar_investimento | canal sem investimento | processo | 10 d |
| a:iniciativa:avaliar_<id> | sucesso sem avaliação humana | imediata | 5 d |
| a:iniciativa:repetir_<id> | sucesso avaliado (nunca "ampliar") | experimento | 30 d |
| a:iniciativa:investigar_<id> | insucesso | monitoramento | 15 d |
| a:dados:historico | HISTORICO_CURTO ou FOTO_DIARIA_INCOMPLETA | monitoramento | 30 d |

Ação que já existe: casa por palavra-chave normalizada (sem acento/caixa) com tarefa não concluída (ou pelos ids em `refs`, caso das tarefas abertas) ou hipótese; vira `existente` (referencia, não duplica; a tela diz "não crie outra"). `recorrente` = em quantos dos ciclos anteriores o mesmo id já foi recomendado.

### 4.10 Trimestre `faTrimestre` (acao:115-135) — liga o ciclo ao "programa de ciclos"
- `pctDaMetaAgregada = receitaCiclo / metaAgregada`; `falta = meta − realizado do programa`; `ritmoNecessário = falta ÷ ciclos ainda abertos (excluindo o atual)`; posição = acima/abaixo conforme `receitaCiclo ≥ ritmoNecessário`.
- Simulação rotulada: `receita projetada = realizado do programa + receitaCiclo × ciclos restantes` e % da meta. "Simulação, não previsão."
- Premissas (cada taxa com referência): `confirmada` se `razaoRef ≥ 0,95`; `nao_confirmada` se abaixo; `inconclusiva` se n < 10. Ticket: confirmada se `ticket ≥ 0,95 × premissa`.
- Riscos = até 3 gargalos-fato como "extrapolação simples, não previsão". Capacidade comercial: "ainda não consolidada" (apontada para outra tela).
- `faCarregados` (acao:139): o que o ciclo seguinte recebe; ação só vem se marcada explicitamente.

### 4.11 Validação (validacao.js). `LBV_MINN = 10` (amostra menor = baixa confiança). Classes: esperada (peso 1), a revisar (2), não explicada (3). Diferença = `nova − antiga`; % sobre `|antiga|` (antiga 0 e nova 0 → 0%; antiga 0 e nova ≠ 0 → % nulo).
- Ticket (`lbvTicket`, :70): antiga = receita ÷ TODAS as vendas (inclusive valor zero); nova = receita ÷ vendas com valor > 0 (D1). Valor zero = esperada; sem valor/negativo = a revisar; venda duplicada ou painel ≠ função = não explicada. Exemplo: [100, 200, 0] → antiga 100, nova 150 (+50%).
- Reuniões (`lbvReunioes`, :89): antiga = negócios que entraram na etapa "reunião agendada/realizada" no período; nova = agendamentos da Agenda (criados no período, sem cancelados) ou reuniões "realizado" pela data da reunião (D3). Classificação por negócio: sem negócio = esperada; > 1 agendamento no mesmo negócio = a revisar (possível reagendamento duplicado); entrou na etapa mas a Agenda é de outro período = esperada; Agenda no período sem entrar na etapa = esperada; resto = não explicada.
- Vendedor da venda (`lbvVendas`, :106): antiga = consultor atual do negócio; nova = dono no momento do ganho (D12). Troca = esperada; mesmo nome com grafia diferente = a revisar. Total da empresa não muda; muda a pessoa.
- Meta (`lbvMeta`, :123): antiga = meta do 1º ciclo × meses (dias ÷ 30,44 arredondado); nova = soma por ciclo. Hoje a comparação ficou substituída pela meta oficial (validacao:359).
- Canais (`lbvCanais`, :144): antiga = investimento PROJETADO do ciclo; nova = REALIZADO lançado em Marketing, rateado pelos dias (D4/D5). Só projeção ou só realizado = esperada; mês sem lançamento = a revisar e desliga o ROI novo (D21); investimento em canal sem nenhum negócio de mesmo nome = a revisar (sugere nome parecido). ROI sobre receita = `receita/investimento − 1`.
- Meta oficial (`lbvMetaOficial`, :165) e "Este ano" (`lbvMetaAno`, :192): conferem que a regra em uso (Painel/LAB) coincide com a regra oficial D16-D21 (última versão aprovada do plano ativo ou fechado; ciclo passado sem evidência = meta desconhecida, fora do atingimento; rateio por dias elegíveis e pesos semanais; ano da operação começa no início do CRM, D20). Divergência de "conferência" (painel ≠ função) é sempre não explicada.
- Qualidade (`lbvGerar`, :341-356): conta ids repetidos, vendas por tipo de valor, amostra < 10, vendas sem dono, agendamentos órfãos, ciclos sem plano ativo, meses sem marketing, canais sem negócio, ciclos de meta desconhecida.

---

## 5. O que os testes garantem (resumo com valores)

**`lab_fecho.test.js`** (≈100 verificações): ciclo saudável só gera `INDICADOR_SEM_DADO,META_ALTERADA`; "no primeiro dia depois do fim o ciclo está encerrado" (hoje = fim); 1 de 8 ganhos sem valor (12,5%) = alta, 2 de 10 perdas sem motivo (20%) = média, 4 de 10 (40%) = alta; diferença ≤ 0,005 não é divergência; 17 de 21 fotos basta, 16 de 21 não; histórico 0 ciclos = alta, 1 = média ("Mínimo recomendado: 3"). Retrato: receita original 100.000, vigente 80.000, realizado 92.000, desvio +12.000, atingimento 1,15; zero real fica 0 e não vira "sem dado"; amostra pequena (n=0, n=8) sinalizada; meta removida (visitas, original 10, 4 feitas) fica com desvio −6 (−60%) sobre a original; hash estável independente da ordem das chaves e detecta adulteração. Revisão: sem justificativa/curta/sem r1 é recusada; sem mudança = "nada"; r2 muda a receita de 92.000 para 95.000 (+3.000) e o r1 permanece; r3 compara com r2. Reprodução: tolerância zero (92.000,01 diverge), sem oráculo não aprova. Leitura: 2 de 2 metas = bem-sucedido; receita 40% abaixo + vendas abaixo = abaixo; receita acima + vendas abaixo = parcial; só metas de pessoa = indeterminado (nunca bem-sucedido por falta de meta); menor-é-melhor: 1 h contra 2 h é favorável, 2,2 h (110%) não atinge, 2,1 h (105%) atinge; formatação pt-BR exata (`R$ 92.000,00`, `25,5%`, `+3 pontos percentuais`, `−R$ 1.500,00`); comparação 92.000 × 70.000 = +22.000. Guarda: só a tela chama o motor, sem timer, e `frGravar` só aparece em 2 lugares.

**`lab_fecho_diag.test.js`**: dias úteis (sex 10h → seg 10h = 1); evolução (semana 3 = R$ 8.000/dia útil é a maior; primeira metade com 23,9% da receita; desvio precoce na semana 1 em 42% do ritmo e não recuperado quando termina em 92%, recuperado em 99%); impacto simulado R$ 54.000; volume de leads 30/100 = R$ 63.000; o maior gargalo é o de maior peso (R$ 72 mil vs R$ 45 mil); velocidade com n < 3 não vira gargalo; capacidade não informada vai para "não mensurável"; pessoas: Bia (esforço ok + conversão 10% vs 40% com n=20) tem o padrão; Ana (n=5) não, vira "sem amostra"; Edu e Bia repetem o padrão = processo; < 3 pessoas = sem base; canais com 5 leads ficam fora da conversão; diagnóstico: interpretação exige 2 evidências, hipóteses sempre com "validar" e confiança baixa, nenhuma linguagem de causa ("causou", "devido a", "provou").

**`lab_fecho_acao.test.js`**: confirmado só com veredito+avaliação+n ≥ 10 (n=4 → aberta; "n = 4, mínimo 10"); nunca confiança alta; padrão promissor com 2 ciclos (`2026-08,2026-09`); ações completas (todos os campos), prazos 2026-10-13 e 2026-10-11 a partir do fim 2026-10-06; 50% de perdas sem motivo = imediata, 10% = processo; "ampliar" nunca aparece; referência a tarefa existente (id tx, Ana, 2026-10-09) e tarefa concluída não conta; recorrência (2 ciclos); trimestre: 150 de 600 mil = 25%, ritmo 450÷2 = 225.000, posição "abaixo", simulação 450.000 (75%); premissa com n=4 = inconclusiva; ticket 30 mil contra 40 mil = não confirmada; nada carregado sem marcação; bloco puro não toca DOM, banco ou criação de tarefa.

**`lab_validacao.test.js`**: dif (100→150 = +50/+50%; base zero e nova 10 = % indefinido; base negativa usa módulo); ticket (300÷3=100 contra 300÷2=150); reuniões (6 casos de classe); vendas (Ana perde 1 venda/R$ 1.000, Pedro ganha); meta (3 ciclos 100+200+300=600 contra 100×3=300; plano fechado ignorado = a revisar; 90 dias cobrindo 4 ciclos: antiga 300 × nova 400); canais (ROI novo +400%; incompleto desliga o ROI e guarda o bruto); D20/D21; relatório em texto (frases exatas, `Diferença: +R$ 50,00 (+100%)`); somente leitura por regex; permissão: não-admin não vê seção, não gera, cliques forjados não fazem nada; 8 detalhes quando há resultado.

**Interface (`ui/*.mjs`, navegador real em modo local/banco simulado)**: `lab_fecho`: prévia não grava; r1 gravado uma só vez; re-gravar sem justificativa = recusado; depois de corrigir uma venda sem valor o retrato gravado deixa de reproduzir (92.000 vs 132.000) e a revisão r2 guarda impacto +40.000 e o r1 intacto; ciclo em andamento não grava. `lab_fecho_fluxo`: passos 1-3, botão desabilitado até "entendo as limitações", sem "mudar" não fecha, r1 guarda build/aceitas/decisão/comparação, relatório com meta original/vigente, "meta saiu do plano", evidência escondida até clicar, revisão r2 com justificativa, r1 consultável. `lab_fecho_cenarios`: 4 ciclos (positivo 130 mil/100 mil = bem-sucedido; negativo 40 mil/100 mil = abaixo; incompleto 60 mil/80 mil = parcial; atual parcial); comparação usa o retrato do anterior (130 mil → 40 mil, −69,2%); reprodução acusa dado mudado; ação recorrente; imprimir esconde menu/navegação; resumo copiado sem nomes de pessoas. `lab_fecho_diag`: funil 20 leads → 10 → 8 → 3 → 2 (50%, 80%, 37,5%, 2/3), ticket R$ 35 mil, receita R$ 70 mil, último ponto da série diária = receita oficial, gráfico SVG com `role=img`, título, descrição e linha tracejada; "ver evidência" leva à linha e a destaca. `lab_fecho_acao`: aprendizado confirmado com n=10; ação "perda sem motivo" referencia a tarefa t1 (Ana); botão "Criar tarefa" só em ações sem equivalente e cancelar não cria nada; marcar "levar" grava só decisão (quem/quando); bloco "Do fechamento de..." aparece no mês seguinte e some ao desmarcar. `lab_fecho_acesso` e `lab_validacao_acesso`: gestor não-admin não vê botões/seção, botões forjados não gravam; admin: percorrer os 3 passos grava ZERO vezes, confirmar grava 1 vez em `lab:fecho:` e fecha o plano. `lab_validacao`: sete indicadores; ticket antiga R$ 10.000 e nova R$ 15.000 (+50%); reuniões agendadas antiga 4 e nova 6; gerar e copiar não gravam nada.

---

## 6. Comparação com o V2 atual

O V2 (`packages/ciclos/src/consultas.ts:121-146`, `retrato.ts`) tem: `fecharCiclo` que só pode rodar depois do último dia útil (`podeFechar`), monta `dados = {operação, ciclo, metas vigentes, ritmoFinal, métricas da fase 2, resumo do quarter}`, assina com SHA-256 e insere em `lab.retrato_ciclo` (tabela com gatilho de só acréscimo, uma linha por ciclo, 409 se repetir); `retratos` recalcula a assinatura para mostrar "confere"; e `aprendizados` em texto livre (`funcionou|nao_funcionou|hipotese|decisao`).

**O V2 cobre bem (igual ou melhor)**: imutabilidade com assinatura criptográfica SHA-256 (o V1 usa FNV de 32 bits); trava "só fecha depois do último dia útil" (no V1 o ciclo em andamento pode fechar parcial, com alerta); retrato por operação multi-modelo; métricas ricas (CPL, CAC, ROI, payback, Wilson na conversão) que o V1 não tem nesse nível.

**O V2 cobre de forma rasa**:
- Retrato = foto de números. Não guarda meta ORIGINAL × VIGENTE (as metas do V2 são só de acréscimo, então a história existe, mas o retrato só guarda `metasVigentes`); não marca meta removida; não calcula desvio, atingimento nem status do ciclo (bem-sucedido/parcial/abaixo).
- Sem dicionário por indicador (definição, fórmula, função, versão, tipo observado/calculado/estimado/simulado, grão, amostra, limitações). O retrato do V2 não sabe explicar de onde veio cada número.
- Sem versão das regras usadas (build, dicionário, regras de meta): daqui a seis meses não dá para saber com que lógica o número foi calculado.
- Aprendizados = texto livre sem veredito, sem amostra, sem confiança, sem evidência, sem distinção entre confirmado e opinião.
- Ritmo final existe, mas sem a leitura "desvio precoce / recuperado" nem comparação com a projeção diária.

**O V2 não tem nada de**:
1. Revisão (r2, r3) com justificativa, impacto por indicador e histórico de versões. No V2 um erro no retrato só se corrige apagando via banco (o gatilho impede) ou nunca: não há caminho de correção.
2. Reprodução ("este retrato ainda bate com o que as funções calculam hoje?") e detecção de dado histórico alterado depois.
3. Revisão de integridade pré-fechamento (19 códigos, gravidade, impacto, "seguir com limitações" gravado). O V2 tem 13 checagens de qualidade na aba Dados, mas elas não entram no retrato.
4. Leitura executiva, narrativa, top 3 a favor/contra, critérios 95%/105%.
5. Comparação com o ciclo anterior ancorada no retrato gravado.
6. Evolução semanal com gráfico, concentração de venda, metades do ciclo, desvio precoce.
7. Diagnóstico do funil em COORTE com referência vinda do plano, permanência vs prazo da etapa, perdas por passagem, gargalos com peso simulado em R$ e a regra de não contar duas vezes volume e conversão.
8. Pessoas sem ranking com padrões (esforço ok mas conversão baixa, recebeu menos, padrão recorrente = processo).
9. Classificação FATO/INTERPRETAÇÃO/HIPÓTESE com "o dado que validaria" e "limite causal".
10. Plano de ação por regra (15 tipos, 5 categorias, critério objetivo, como avaliar, prazo, recorrência, referência a tarefa existente) e botão de criar tarefa pré-preenchida.
11. Aprendizados com níveis, padrão promissor em 2 ciclos, e a "ponte" para o ciclo seguinte (decisão explícita de levar).
12. Ligação com o trimestre: ritmo necessário, simulação, premissas confirmadas/não confirmadas. O V2 tem quarter com 6 passos e cenários ±15%, mas o fechamento do ciclo não lê o quarter para dizer "o ciclo deixou o trimestre acima ou abaixo".
13. Validação regra antiga × nova (fora do escopo de produto, mas o V2 não tem nenhuma conferência de "o que mudou quando troquei uma regra").
14. Impressão/PDF e resumo executivo copiável.

Observação: o V2 já tem a matéria-prima de muitos desses blocos (coorte com Wilson, build-up reverso com taxas, hipóteses em fórmula, achados por impacto em R$, studio de funil com alavancas +5 pontos). Ou seja, o gargalo é CONSOLIDAR no retrato e dar o fluxo, não recalcular.

---

## 7. O que isso entrega que uma planilha não entrega

- **A memória não muda**: o r1 de setembro é exatamente o que foi decidido em outubro, assinado e blindado no banco; planilha sobrescreve. O gestor consegue provar "a meta era 100, virou 80, e eu bati 115% da vigente e 92% da original".
- **A disciplina de honestidade**: nenhum número sem dono (função oficial), nada de "zero" no lugar de "sem dado", amostra pequena dita, simulação rotulada, correlação não vendida como causa. Uma planilha aceita qualquer coisa.
- **Gargalo por valor**: ranqueia onde está o dinheiro (simulado em R$) em vez de apontar "a pior taxa". Isso exige coorte, ticket, cadeia de conversões seguintes: trabalho que ninguém mantém em planilha todo mês.
- **Auditoria automática**: reprodução tolerância zero denuncia dado retroativo mudado; integridade lista 19 tipos de furo antes de fechar.
- **Aprendizado acumulado**: "padrão promissor" só aparece quando o mesmo teste é confirmado em 2 ciclos; ações recorrentes são marcadas ("já recomendada em N ciclos"); o ciclo seguinte recebe o que foi decidido.
- **Fecha o ciclo da gestão**: diagnóstico → ação com critério de sucesso → ligação com tarefa → bloco "Do fechamento anterior" no planejamento seguinte → quarter. Planilha não amarra esses passos.
- **Sem ranking de pessoas** por desenho, o que protege a cultura e evita conclusões erradas com n pequeno.

---

## 8. Riscos e armadilhas ao portar para o V2

1. **Não copiar o motor sem as funções-dona.** O fechamento V1 só consolida o que `lpMed`, `lpCoorte`, `lpCanaisBase` etc. calculam. No V2 as equivalentes são `packages/metricas` e `packages/planejamento`; o retrato deve chamar essas funções, nunca reimplementar fórmula. Risco: dois cálculos divergentes (o V1 resolveu com `DIVERGENCIA_FONTES` e `frReproduzir`).
2. **Metas só de acréscimo no V2** é vantagem (original × vigente sai de graça pelo histórico) mas exige definir "versão original" e "vigente" por ciclo e por pessoa. Cuidado com meta que saiu do plano: no V1 ela continua visível; no V2 só aparece se o retrato a procurar na história.
3. **Revisão é indispensável.** Hoje o V2 retorna 409 "este ciclo já foi fechado". Se o dono errar um valor de venda, fica preso. Porte o modelo r1/rN (tabela com `n`, `revisa_de`, `justificativa`, `impacto`) antes de qualquer bloco novo; a unique por ciclo vira unique por (ciclo, n).
4. **Armadilha de ciclo parcial.** O V1 permite fechar em andamento (marcado parcial, integridade alta); o V2 bloqueia antes do último dia útil. Decidir: manter a trava e oferecer "prévia" (que no V1 é muito usada) sem gravar.
5. **Hash**: manter SHA-256 do V2 (não o FNV do V1). Cobrir TODO o conteúdo novo (leitura, regras, diagnóstico). Atenção ao `canonico()` do V2: ele ordena chaves e remove `undefined`, mas precisa tratar `null` e números de forma estável entre Worker e navegador.
6. **Guarda no banco**: o gatilho do V1 não valida conteúdo e o `lab:fechocarga:` ficou fora da proteção. No V2, definir quais tabelas são imutáveis (retrato, revisão) e quais são decisões editáveis (levar para o próximo ciclo) com histórico.
7. **Limiares configuráveis**: `fdLim` tem defaults mas produção usa `lpLim()`. Se o V2 fixar 0,85/0,95/0,70/0,90/10 no código, perde a calibragem por operação; gravar os limiares usados DENTRO do retrato (o V1 faz: `limiaresDiagnostico`).
8. **O peso do gargalo é simulado e depende da cadeia de taxas do próprio ciclo.** Sem amostra mínima o V1 omite o R$; sem taxa de alguma etapa seguinte devolve "não calculável". Portar a regra exata, senão o V2 vai mostrar valores bonitos e falsos. Reaproveitar o intervalo de Wilson do V2 como critério adicional de amostra pode ser melhoria, mas muda os números dos testes.
9. **Textos são parte da especificação.** Os testes do V1 fixam frases (ex.: "não prova", "Simulação, não venda certa", "não uma regra universal"). Portar o espírito (rótulos fato/interpretação/hipótese, ausência de afirmação causal), com testes que garantam a ausência de "causou/devido a".
10. **Pessoas**: sem ranking, com contexto (dias úteis, ausências, leads e oportunidades recebidos) e amostra mínima. Risco de transformar em placar de vendedores no V2 (que tem papéis sdr/closer/cs); manter a regra "média de recebidas só entre mesma função com ≥ 3 pessoas".
11. **Dependências que o V2 não tem**: diário de contexto (`labContexto`), tarefas (`tfTodas`), fotos diárias de projeção (`lpPrev`), prazo (SLA) por etapa, capacidade por pessoa e hipóteses com avaliação humana. Sem fotos diárias, os alertas "alerta cedo" ficam em branco; sem tarefas, "ação já existe" não funciona. O V2 pode substituir por seus equivalentes (`experimento`, `decisao`, `meta`), mas é preciso mapear.
12. **Validação regra antiga × nova**: NÃO portar como está; é específica do histórico do V1 (commit 6f69d2f, decisões D1-D21). O valor reaproveitável é o padrão (comparar antes/depois sobre a mesma base, classificar divergência em esperada/revisar/não explicada, texto copiável). No V2 faz sentido como "conferência após mudar regra ou pack", só admin e somente leitura. Prioridade baixa.
13. **Ordem sugerida de porte** (menor risco, maior valor): (1) integridade + retrato com meta original/vigente/realizado/desvio + leitura executiva; (2) revisões com justificativa e reprodução; (3) comparação com o ciclo anterior pelo retrato; (4) funil em coorte + gargalos por peso; (5) evolução e desvio precoce; (6) aprendizados confirmados/refutados/abertos; (7) plano de ação por regra e ponte para o ciclo seguinte; (8) trimestre; (9) pessoas e canais; (10) validação.
14. **Versão das regras no retrato**: guardar versão dos packs (base, solar-b2c, licitacao-b2b) e do dicionário de métricas, senão retratos de operações diferentes não são comparáveis.
