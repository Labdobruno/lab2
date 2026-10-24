# Frente A: Planejamento e Semana no LAB V1

Siglas de arquivo: PLAN = fontes__lab_plan.js (1977 linhas), SEM = fontes__lab_semana.js, PSEM = fontes__lab_projsemana.js, SIM = fontes__lab_simulador.js, OBJ = fontes__lab_objetivos.js (motor puro usado por PLAN, li só as partes que PLAN chama). Formato de citação: função, arquivo:linha.

Observação de escopo: PLAN depende de vários módulos que não estavam na minha lista (gestao.js, esforco.js, painéis pnMedir, labForecast, Cadência, Agenda). Onde a regra mora neles, aviso. O que sei deles vem dos testes.

---

## 1. Para que serve cada parte (a pergunta do RevOps)

**Planejamento do ciclo (PLAN, aba "Planejamento", 9 sub-abas).** É o núcleo do "Jarvis". Responde: "Qual é a meta deste ciclo, o que a equipe precisa fazer para bater, onde provavelmente vamos chegar e o que está fora do trilho?". O RevOps usa no início do ciclo (montar e ativar o plano), todo dia (conferir trajetória) e no fim (fechar e aprender).

- **Resumo do mês**: meta × realizado × projeção × diferença (lpDecisaoHtml, PLAN:1851). Pergunta: "Vamos bater?".
- **Metas e o que precisa acontecer**: o gestor informa a meta final (receita ou vendas) e o LAB calcula de trás para frente quantas oportunidades, reuniões, agendamentos, contatos e leads são necessários, por pessoa e por canal (build-up). Pergunta: "O que o time precisa produzir?".
- **Equipe**: função (SDR, closer, os dois), peso na meta, capacidade por dia, canais, ausências, indicador de sucesso. Pergunta: "Quem carrega quanto, e a meta cabe na capacidade?".
- **Acompanhamento diário**: curva da meta (por dia útil) contra o realizado acumulado, mais histórico das previsões que o LAB fez em cada dia. Pergunta: "Estamos adiantados ou atrasados, e as previsões do LAB acertam?".
- **Sinais e alertas**: desvios agrupados em "incidentes" por trecho do funil, com veredito conjunto. Pergunta: "O que está errado e é falta de esforço, de conversão ou de dado?".
- **Cenários**: conservador, neutro e otimista por premissa, sensibilidade de ±10%, simulador por pessoa. Pergunta: "E se a conversão ou o ticket mudar?".
- **Programa de ciclos**: meta agregada de 2 a 6 ciclos, com sobra e falta passando para o ciclo seguinte. É o antecessor do "quarter" do V2.
- **Hipóteses**: experimentos do mês com linha de base, esperado e veredito automático.
- **Fechamento e aprendizado**: decisões, plano original × atual, versões do replanejamento, fechamento guiado com três perguntas e "memória comercial".

**Relatório da última semana (SEM).** "O que deu certo e errado na semana que passou, em quem, onde e por quê?". Uso: segunda-feira, reunião de time. Compara cada indicador com a média das 4 semanas anteriores e com a meta da semana, aponta quem e qual canal pesou, o elo anterior do funil, hipóteses da biblioteca compatíveis e um roteiro de ações para testar.

**Projeção para esta semana (PSEM).** "Onde a semana vai fechar, bate a meta da semana, quem está atrás, o que precisa acontecer até domingo?". Uso: meio de semana. Inclui "Na mesa para fechar" (negócios em Negociação e Assinando contrato) e caixa da semana.

**Simulador/caixa (SIM).** Não é simulador de funil (esse é o Construtor, outro arquivo). É o complemento financeiro: perfil de caixa de uma "safra" de vendas e o armazenamento das simulações salvas no planejamento do mês, com comparação posterior com o realizado.

**Casca de navegação (lab_trilhas, fora da minha leitura profunda).** O LAB tem 4 trilhas (Passado, Mês, Futuro, Studio) e 36 passos. As sub-abas de PLAN e as telas SEM/PSEM são passos da trilha "Planejar e acompanhar o mês".

---

## 2. Telas e interações

**Cabeçalho do plano (lpTela, PLAN:683):** setas de mês ‹ ›, nome do ciclo (com datas se o ciclo não começa no dia 1), selo de status (Sem plano / Rascunho / Ativo / Fechado), botões: Criar plano do mês, Montar a partir do ciclo anterior, Ativar plano (congela o original), selo "vN · desde dd/mm" e Replanejar a partir de uma data. Só o administrador (chave `lab.planejamento_salvar`) grava; os demais só leem.

**Montar plano (lpDialogoMontar/lpMontarPlano, PLAN:619/648):** o gestor informa meta de receita e ticket, marca quem entra e a função (closer/SDR/os dois). O LAB deduz função pelo cadastro, pelo nome ("sdr", "pré-venda") ou pelo histórico (quem vendeu é closer, quem agendou é SDR), calcula pesos pela receita (closer) ou agendamentos (SDR) do ciclo anterior, monta o mix de canais pela origem dos leads do ciclo anterior e gera as metas. Nada é ativado.

**Metas (lpSubMetas, PLAN:979):** tabela de metas (indicador, tipo de objetivo "atingir / pelo menos / no máximo / ficar entre", alvo, por dia útil, por semana, escopo, origem manual ou derivada, premissa, realizado), filtro por colaborador, bloco "Consistência das metas", campos da meta final, janela histórica (90/180/365 dias), ticket e 6 taxas com histórico e premissa, "Gerar metas do mês", build-up por pessoa e canal com botão "Taxas" (fixar "a cada N leads, K vendas"), necessário × viável × déficit, calendário (dias de trabalho, feriados editáveis, peso por semana).

**Configurar pessoa (lpDialogoPessoa, PLAN:1085):** função, peso (%), cargo, canais com marcação separada de pré-venda e venda e % da meta, botão "Sugerir % pelo retorno de cada canal", prospecção própria do closer, capacidade/dia (ações no CRM com "automática" observada, agendadas, realizadas, visitas), indicador de sucesso, ausências por data, responsabilidade por indicador.

**Ativar (lpDialogoPublicar, PLAN:1815):** resumo auditável (metas, período, envolvidos, taxas e amostras, build-up, necessário × viável, cenário neutro, consistência, dados ausentes). Ao confirmar, grava o "original" congelado e envia as metas diárias à Produtividade.

**Replanejar (lpDialogoReplanejar, PLAN:1752):** data de corte + motivo obrigatório. Cria versão vN+1; a anterior fica guardada inteira.

**Sinais (lpSubSinais, PLAN:1335):** cada sinal mostra O que aconteceu, Esperado, Desvio, Impacto potencial, Confiança, Investigar, Ação possível e "classe do desvio". Botões: Tarefa para o time (cria tarefa por pessoa com a lista de leads atrasados na Cadência), Tarefa para o gestor, Registrar decisão, Abrir hipótese.

**Semana (labTelaSemana, SEM:126):** navegação por semana, lista "O que deu certo" e "O que deu errado", "Possíveis causas", hipóteses compatíveis, roteiro de solução por indicador, tabela completa e "Copiar resumo" (texto para WhatsApp). **Projeção da semana (labTelaProjSemana, PSEM:70):** cartões por indicador com barra de projeção × feito, faixa, "O que precisa acontecer até domingo", "Na mesa", "Semanas do ciclo", caixa da semana, "Copiar resumo".

---

## 3. Modelo de dados e entradas/saídas

Armazenamento é um repositório chave-documento ("gestao/...") sincronizado com Supabase (tabela `gestao`, ver supabase__13/25/39/41), com cache no navegador. Nomes em português, documentos JSON mesclados em profundidade (`patchG`); remover um campo exige gravar `null`.

| Chave | Conteúdo |
|---|---|
| `gestao/lab:plan:<AAAA-MM>` | O plano do ciclo. A chave é o mês em que o ciclo COMEÇA (lpKey, PLAN:23). |
| `gestao/lab:prev:<AAAA-MM>` | Fotos diárias das projeções (`dias[iso]`), nunca sobrescreve um dia já fotografado por cliente (lpFoto, PLAN:1287). |
| `gestao/lab:cen:<AAAA-MM>` | Regras dos cenários (conservador/otimista em fração + notas), só leem quem tem chave de cenários (SQL 39). |
| `gestao/lab:prog:<id>` | Programa de ciclos (nome, ciclos, meta, original, fotos, hist). |
| `gestao/lab:sim:<id>` | Simulação congelada do Construtor (SIM:70). |
| `gestao/lab` | Config geral do LAB: `hipoteses{}`, `mkt{AAAA-MM:{canal:{inv}}}`, `metas{vendedor}` (legado), `diario` (limiares), `minN`, `inicio`, `regras`. |
| `gestao/metas` | `.lab[AAAA-MM]` = texto JSON com as metas diárias que a Produtividade lê (lpMetasLab, PLAN:783) e `.pessoas[nome]` = texto JSON `{lista, canais}`. |
| `gestao/dia:<iso>` | Registro diário manual (legado), vale por cima do automático só até `PR_MANUAL_ATE`. |
| `config/geral` | `cicloDia`, `metaMensal`. |

**Documento do plano** (campos): `ciclo, ini, fim, pipe, status (rascunho|ativo|fechado), versao, corte, cal{dias[0-6], feriados{iso:nome}, pesos{segundaISO:peso}}, pessoas{nome:{funcao, peso, cargo, cap{contatos,agendadas,realizadas,visitas}, aus{iso:true}, canais{canal:%}, tx{canal:{taxa:{v,em,por,de,fecha}}}, atua{canal:{pre,venda}}, sucesso{de,meta}, resp{ind:papel}}}, metas{id:{ind, alvo, alvo2, op, escopo(empresa|pessoa), ref, origem(manual|reverso|programa), premissa, criadoEm, por}}, premissas{taxa|ticket:{v,fonte,em,por}}, reverso{tipo(vendas|receita), alvo}, janela, txCanal{canal:{taxa:{v}}}, cadeia (texto JSON), expectativas{carteiraVendas, leadsCanal, ticket}, original{em,por,metas,premissas,reverso,pessoas}, publicacao, versoes{vN:{...}}, restanteNoCorte, decisoes{id}, fechamento{em,por,metas[],hips[],respostas,aprendizados,proj}, hist{id:{em,por,acao,campo,de,para}}`. Todo gravar passa por lpGravar (PLAN:28), que carimba `atualizadoEm/Por` e acrescenta uma linha em `hist` (auditoria de cada mudança de meta, premissa, pessoa).

**Entradas lidas do CRM** (dependências duras): negócios (`criadoEm`, `canal`, `consultor`, `funil.etapa/desde/hist[]/valor/fechadoEm`), Agenda (`agTodos`: `sdrNome`, `closerNome`, `ini`, `status`, `neg`), Cadência (`cdDocs`, tentativas), WhatsApp (`waContatosLista`), produtividade (`prAuto`, registro diário), Financeiro (margem, títulos), Marketing (`mkt`), pessoas e permissões (`S.equipe`, `permCfg`).

**Saídas:** metas diárias por pessoa/canal na Produtividade e no Plano do dia; tarefas (`tfGravar`, com `labSinal`, `labPara`); notificações (lpNotificacoes, PLAN:1593); textos prontos para copiar; fotos diárias; registro imutável ao fechar (`lmRegistrarEncerramento`, fora do arquivo).

---

## 4. Regras e fórmulas exatas

### 4.1 Ciclo, dias úteis e "hoje"
- **Ciclo**: cicloDe do CRM; `lpKey` = AAAA-MM do início do ciclo. `cicloDia` (config) define o dia de início. O V2 limita o dia a 1-28; o V1 não mostra limite no arquivo.
- **Feriados** (lpFeriados, PLAN:39): fixos 01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, **20/11 (sempre, sem corte de ano)**, 25/12; móveis pela Páscoa: Carnaval (-48, -47, rotulado "ponto facultativo"), Sexta-feira Santa (-2), Corpus Christi (+60, "ponto facultativo"). Se `cal.feriados` existe no plano, ele manda (lista editável pelo gestor).
- **Dias de trabalho** `cal.dias` padrão [1,2,3,4,5]; se vazio volta ao padrão (lpCal, PLAN:45).
- **Dias úteis** de [a,b) (lpDU, PLAN:49): dia da semana na lista, não feriado, não ausência da pessoa (`pessoas[n].aus[iso]`).
- **Dias decorridos** (lpDecorridos, PLAN:55): `dias úteis < hoje` contam 1 cada; **hoje conta 0,5** (se for útil). O V2 conta o dia de hoje inteiro (`d <= hoje`).
- **Vigência / corte** (lpVig, PLAN:59): o corte só vale se `a < corte <= último dia do ciclo`; senão a vigência é o início. `lpVigTs` devolve meia-noite do dia do corte. Receita, vendas e ticket são medidos no ciclo inteiro; atividade (leads, contatos, reuniões…) do corte em diante (LP_JAN_CICLO, PLAN:774).
- **Peso por semana** (lpPesosDias, PLAN:764): `cal.pesos[segunda-feira ISO]`, 1 = padrão. Se todos são 1, retorna `null` (distribuição linear).
- **Fração decorrida** (lpFrac, PLAN:767): sem pesos, `min(1, decorridos/úteis)`; com pesos, soma ponderada dos dias passados (+ metade do peso de hoje) ÷ soma dos pesos.

### 4.2 Indicadores (LAB_MET, PLAN:125-146) e fases
19 indicadores: `leads, t_contato, contatos, agendadas, ag_sdr, realizadas, compar, visitas, oport, propostas, negoc, vendas, receita, ticket, tx_agenda, tx_oport, tx_fech, margem, tx_lead_venda`. Fases (LP_FASE, PLAN:149): Pré-vendas (SDR), Vendas (closer), Funil completo. Unidades: n, R$, %, h.

Definições fixadas no código (resumo):
- **leads**: negócios criados no período, no funil do plano, sem avulsos, sem criados antes de `labCfg().inicio`, sem operações independentes (lpNegs, PLAN:68).
- **agendadas / realizadas** (lpReunioes, PLAN:100, "decisão D3, 09/10/2026"): a Agenda manda; negócio SEM agendamento registrado conta pela entrada na etapa do funil (`reuniao_ag`/`reuniao_ok`), atribuída ao dono naquele momento. Agendamento cancelado nunca conta. Agendada: pela data de CRIAÇÃO do agendamento, pessoa = SDR que agendou. Realizada: pela data da reunião, pessoa = quem conduziu (closer, ou SDR se closer vazio). Agendamento sem negócio conta só na empresa.
- **compar** (comparecimento): `realizadas ÷ (realizadas + no-show)` pela data da reunião; reagendadas e canceladas ficam fora.
- **vendas / receita**: negócios `ganho` com `fechadoEm` no período; pessoa = `vendedorDaVenda`. Receita = soma de `valorNegocio`.
- **ticket**: `ticketMedio` (fora do arquivo) exclui vendas de valor zero (decisão D1).
- **propostas**: primeira `propostasV[x].prontaEm` do negócio.
- **t_contato** (lpTempoContato, PLAN:422): mediana de horas entre criação do lead e o primeiro contato (Cadência `tent`/`ajuste` ou mensagem enviada pelo WhatsApp do CRM posterior à criação do card); mínimo 0 h; devolve também % em até 1 h e em até 24 h e "sem nenhum contato".
- **contatos** (lpProd, PLAN:72): por pessoa/dia/canal, vale o MAIOR entre o lançado no registro diário e o automático da Cadência; "tentativas" antigas viram contatos (`max(contatos, tentativas)`). Dia sem registro = ausente, **nunca zero**.
- **Taxas de coorte** (lpCoorte, PLAN:91): `k/n` onde n = entrados na etapa de origem no período e k = quantos desses alcançaram a etapa destino (até hoje). `imaturo = b > agora-30d`. Etapa inexistente no funil ou base vazia = estado "ausente" com nota.
- **margem**: `margemAgregada` sobre as vendas do período (não é média das margens); exige acesso ao Financeiro.

### 4.3 Histórico que sustenta o plano (lpHistorico, PLAN:171)
- Janela = `max(30, P.janela || 180)` dias, **terminando 30 dias antes de hoje** (maturação das oportunidades).
- 5 taxas de coorte: `lead_ag` (lead→reunião agendada), `ag_real`, `real_oport`, `oport_venda`, `lead_venda`.
- `contato_ag` = reuniões ÷ contatos do registro diário **nos últimos 90 dias**; se > 100% é descartada como incoerente (motivo guardado).
- `ticket` = ticket médio das vendas na janela (sem valor zero) e `nTicket`.
- `ciclos[]` = dias entre criação e fechamento das vendas dos últimos 365 dias (≥0).
- **Taxa efetiva do plano** (lpTaxa, PLAN:185): premissa manual (se `v` numérico) > histórico (só se estado ok) > nula.
- **Lead → venda** (lpTaxaLeadVenda, PLAN:188): premissa > produto das 4 taxas de etapa (só se todas > 0) > lead→venda direto do histórico. O direto fica de reserva porque vendas antigas já cadastradas como ganhas inflam a taxa.
- Amostra mínima `labMinN()`: padrão 10 (critério `minN` de OBJ:213, configurável).

### 4.4 Taxa por canal e pessoa (lpTxCanal, PLAN:228)
Ordem de precedência, taxa a taxa (e ticket): **premissa da pessoa no canal > premissa do canal > histórico da pessoa no canal (n ≥ minN) > histórico do canal (n ≥ minN) > taxa geral do plano**. Herança de canal-pai (lpPaiCanal, PLAN:224): "Indicação clientes" herda de "Indicação"; casa quando o nome do canal começa com o do pai seguido de espaço, hífen ou travessão; vence o pai mais longo; a premissa do próprio canal vale por cima, taxa por taxa. `lpRazao` converte a taxa em "K em N" (N de 1 a 10, menor erro; ≥1 → "1 em 1"; 0 → "—").

### 4.5 Plano reverso simples (lpReverso, PLAN:317)
1. Alvo = `reverso.alvo`. **Com corte**: `alvo = max(0, alvo − (vendido antes do corte, em receita ou vendas))`, guardado em `alvoRest`.
2. `vendas = ceil(alvo / ticket)` (tipo receita) ou `ceil(alvo)`.
3. Cadeia `LP_CADEIA`: vendas→oport (÷oport_venda), oport→realizadas (÷real_oport), realizadas→agendadas (÷ag_real), agendadas→leads (÷lead_ag); **cada passo com `ceil`**. Contatos = `ceil(agendadas ÷ contato_ag)`. Taxa ausente = valor `null` e entra em `falta[]`, a cadeia não inventa.
4. **O que já existe**: `pipeVendas = Σ por etapa (abertos − foraDaCurva) × pv × pt` (pv = chance histórica de virar venda; pt = chance de fechar até o fim do ciclo, de `labForecast`). `vendasReal` do corte em diante. `vendasFaltam = max(0, vendas − vendasReal − pipeVendas)`.
5. **Fração que fecha no ciclo**: `cabe = (nº de ciclos históricos ≤ diasCorridosRestantes) ÷ total`. `leadsAdicionais = ceil(vendasFaltam / (leadVenda × cabe))`; 0 se nada falta; `null` se faltar taxa.

### 4.6 Build-up por pessoa e canal (lpCadeia, PLAN:271 e lpCadeiaCanal, PLAN:248)
Regra central, com a lição de um caso real de 12/10/2026 (comentário PLAN:278):
- **Calcular em frações** (modo `exato`) por pessoa × canal e **arredondar só no total de cada pessoa** (`ceil(x − 1e-6)`; receita usa `Math.round`). O arredondamento a cada canal e etapa inflava o funil: +26% em vendas e +51% em leads.
- Receita/vendas da empresa → closers pelo `peso` (ou meta individual manual fixa, o restante vai aos sem meta, `reparte`, PLAN:276) → canais pelo mix `lpMix` → cadeia do canal com as taxas daquele canal/pessoa.
- **Mix** (lpMix, PLAN:755): % digitados valem; canais sem % dividem igualmente o que falta para 100; se passa de 100, normaliza proporcionalmente.
- `semLeads` para canais que não são origem de lead (`rsEhOrigem` falso: Follow-up, Leads perdidos, Base): leads = 0 e não se cobra taxa de lead.
- **Leads por canal**: se a premissa de lead→venda é manual (ou falta lead_ag), `leads = vendas ÷ lead_venda`; senão `agendadas ÷ lead_ag`.
- **Pré-venda do closer "puro"** (função closer com SDRs no plano) vai para os SDRs, dividida pelo peso entre os SDRs que atuam o canal (`canaisPessoa`), exceto canais em que o closer marcou "Pré-venda" (ficam com ele). Closer não conta agendadas/contatos/leads no seu total quando há SDR.
- Total de cada canal = total da pessoa repartido por **maior resto** (lpDividir, PLAN:518) pelo peso exato do canal, de modo que a soma dos canais bata com o total da pessoa.
- Empresa = soma das pessoas. A cadeia usada é gravada como texto em `P.cadeia` ao "Gerar metas" e é ela que a Produtividade segue até a próxima geração.
- **Divisão simples** (lpDividir): `T = round(total)`; parte inteira + sobras aos maiores restos; sem pesos válidos → partes iguais. lpDividirExato divide sem arredondar.
- **Metas derivadas** (lpGerarMetasReverso, PLAN:1535): cria/atualiza metas `origem: 'reverso'`, **preservando metas manuais do mesmo indicador e escopo**, remove metas derivadas que a cadeia não gera mais, grava `hist` por mudança (tela devolve "N metas criadas ou recalculadas").

### 4.7 Distribuição das metas pelas pessoas e pelos dias
- **Quem recebe** (lpElegivel/lpMetasPessoasMes, PLAN:731/733): meta individual vale por cima; o restante `max(0, empresa − Σ individuais)` é dividido pelos elegíveis sem meta individual, por `peso` (sem peso = partes iguais); fase pré → SDR, vendas → closer, "os dois" recebe as duas. `lpMetasSemDono` acusa a parte que ninguém recebe (> 0,5).
- **Por canal** (lpCanaisMes, PLAN:305): `lpDividir(round(meta), canais, pesos)`; pesos = cadeia gravada quando existe, senão o mix; só nos canais em que a pessoa atua na fase (`rsCanaisDaEtapa`). Visitas seguem as realizadas.
- **Por dia** (lpMetasLab, PLAN:783): só plano `ativo` ou `fechado`. `lpoDistribuir` (OBJ:132): `T = round(total)`; acumula `w/Σw × T`, `floor(acc + 1e-9)` por dia, o último dia absorve o resto. Sem pesos equivale a `floor(T·(k+1)/du) − floor(T·k/du)` (metaDiaInteira em gestao.js, confirmada em metas_dia.test.js). Formato v2 (sem pesos/mínimo) ou v3 (com `porDia` explícito).
- **Mínimo de 1 por dia na etapa principal** (lpoMinimoDia, OBJ:143; etapa principal: SDR = agendadas, depois contatos; closer = realizadas, oport, vendas; "os dois" = agendadas, realizadas, contatos): todo dia trabalhado recebe ≥ 1; se a meta do mês é menor que os dias, **o mês sobe** (`extra`), nunca desce; o mês continua exato nas demais etapas; os canais recebem a unidade do dia pela cota acumulada (quem está mais atrasado na sua parte).

### 4.8 Esperado até hoje: regra única do LAB (lpEsperado, PLAN:780)
- `esperado = alvo × lpFrac(janela)`. Taxas e médias não se dividem: o esperado é o próprio alvo.
- **Vendas com corte**: alvo do mês = `vendidoAntesDoCorte + metaDoPlano` (lpAlvoMes, PLAN:778); esperado = `antes + max(0, alvo − antes) × fração da vigência`.
- Receita: janela do ciclo inteiro; volumes: da vigência.
- **Ritmo** (lpCalc, PLAN:403): `ritmo = realizado ÷ diasDecorridos × diasÚteisTotais`, só para indicadores não-taxa e com `dd ≥ 1`.

### 4.9 As quatro projeções (lpProjecoes, PLAN:351)
- `du` = dias úteis do ciclo, `dd` decorridos (hoje = 0,5), `rest = max(0, du − dd)`. `encerrado` se `fim ≤ agora`; `futuro` se `ini > agora` (todas as projeções ficam `null`).
- **Planejada**: meta de vendas/receita (se só tem vendas: `vendas × ticket`).
- **Ritmo atual**: `real + real/dd × rest`; `null` se `dd < 1`. Marcado "frágil" se `dd < 3`.
- **Histórica**: `real + pipeline aberto`, onde pipeline = Σ `(abertos − foraDaCurva) × pv × pt` (receita via `fc.noPrazo`). Negócio **fora da curva = valor acima de 5× o ticket** fica de fora, listado à parte com valor e chance (lpForaHtml); o limite vem de `labForecast`.
- **Ajustada**: `histórica + leadsRestantes × leadVenda × cabe` (× ticket para receita). `leadsRestantes = ritmoLeads × rest`.
- **Ritmo de leads**: nos primeiros 5 dias úteis, mistura `pesoAt × ritmoCiclo + (1 − pesoAt) × ritmo90d` com `pesoAt = min(1, dd/5)`; `ritmoCiclo = leads ÷ dd` (só com dd ≥ 1); `ritmo90d = leads em 90 dias ÷ dias úteis seg-sex dos 90 dias`. Depois do 5º dia vale só o do ciclo.
- **Chance de bater a meta de vendas (Poisson)**: só se há meta de vendas, ciclo em curso e `nTicket ≥ minN`. `k = ceil(metaVendas − vendas)`; `λ = max(0, ajustada − vendas)`; `prob = 1 − Σ_{i<k} e^{-λ}λ^i/i!`; `k ≤ 0 → 100%`. A tela avisa que é estimativa simples.
- Receita com meta ausente: se não há plano e o ciclo é o atual, usa `config/geral.metaMensal` como meta de receita.

### 4.10 Consistência, cenários, viabilidade, replanejamento, programa
- **lpoAvaliar** (OBJ:22): `atingir/min`: ok se `v ≥ alvo − 1e-9`, gap = `max(0, alvo − v)`; `max`: ok se `v ≤ alvo + 1e-9`; `faixa` com dois alvos e direção; `maximizar/minimizar`: só direção.
- **Cenários** (lpoCenarios, OBJ:83): cada cenário é um conjunto de premissas alteradas **em % sobre o neutro**, só para `ticket, margem, leadsRestantes, cabe, pipeVendas, taxas.lead_ag/ag_real/real_oport/oport_venda`; taxas, `cabe` e margem têm teto 0-1. Receita = `receitaReal + (pipe + leadsRestantes × ΠtaxasEtapas × cabe) × ticket`. **Conservador automático**: sem regra gravada, cada taxa vai ao **limite inferior de Wilson 95%** das coortes (o V2 usa fator fixo ×0,85/×1,15). Otimista sem regra = neutro. Conflito econômico: cenário que atinge a receita com margem abaixo da mínima. Sensibilidade ±10% uma premissa de cada vez, ordenada por impacto.
- **Simulador por pessoa** (lpSubCen, PLAN:1344): variáveis em % de -50 a +100 em passos de 5, taxas travadas em 100%; base = premissas do plano ou, no escopo de pessoa, a taxa da pessoa na janela 120 a 30 dias atrás (se n ≥ minN). Contribuição de cada variável calculada uma de cada vez.
- **Viabilidade** (lpViabilidade, PLAN:1879 e lpoViabilidade, OBJ:245): necessário (build-up) × capacidade (Σ cap/dia × dias úteis da vigência, por pessoa); déficit = `max(0, nec − cap)`. A meta **nunca é reduzida**; o sistema lista alternativas (ampliar capacidade, closers a mais, melhorar conversão X pontos, rever o objetivo com receita viável). Há análise por pessoa: a folga de um não cobre a sobrecarga de outro.
- **Replanejar** (lpoReplanejar, OBJ:107): exige data `AAAA-MM-DD` e motivo; recusa plano fechado; `versao = n+1`, guarda a versão `vN` inteira (metas, premissas, reverso, pessoas, txCanal, cadeia, status, realizadoNoCorte); `restanteNoCorte[ind] = max(0, alvo − realizado)` para indicadores não-taxa; `original` nunca é tocado.
- **Programa de ciclos** (lpoPrograma, OBJ:268): 2 a 6 ciclos **consecutivos** e sem repetição; meta ORIGINAL do ciclo = agregada × `(dias úteis × peso do ciclo) / Σ`, congelada na criação; meta VIGENTE dos ciclos ainda abertos = `max(0, agregada − realizado dos fechados)` repartido entre os abertos pelo mesmo critério (sobra e falta passam para frente). Cada venda conta só no ciclo em que fechou; um ciclo não pode estar em dois programas ativos.
- **Ponte da previsão** (lpoPonte, OBJ:121): diferença entre duas projeções ajustadas = Δ já vendido + Δ pipeline + Δ leads novos + "Outros (ticket, premissas)" como resíduo.

### 4.11 Sinais e veredito (lpSinais, PLAN:441)
Só quando o ciclo já começou. Limiares configuráveis (padrões em OBJ:213): meta em risco **95%**, trajetória **85%**, trajetória grave **60%**, conversão **70%**, volume em dia **90%**, amostra mínima **10**, janela de recuperação 5 dias úteis, card parado 5 dias, proposta sem acompanhamento 3 dias, lead novo crítico 24 h.
- **Meta em risco**: só com `dd ≥ 2`; `ajustada < meta × metaRisco`; gravidade 3 se o gap > 25% da meta, senão 2. Receita tem precedência sobre vendas (um `else if`).
- **Trajetória**: indicadores de volume da empresa (não taxa; exclui vendas e receita) com `realizado < esperado × trajetoria`; gravidade 3 abaixo de 60%.
- **Demanda insuficiente**: `ritmoLeads × restantes < leadsAdicionais × 0,9`.
- **Capacidade**: `necessário/dia = volume total × peso da pessoa ÷ dias úteis da pessoa`; gravidade 3 se `déficit/cap > 0,3`.
- **Comparecimento**: mês atual vs 120 dias anteriores; sinal se caiu mais de **10 pontos** e ambos têm n ≥ minN.
- **Conversão** (tx_oport, tx_fech): sinal se `n ≥ 2` nas duas e `mês < histórico × conversao`; gravidade 1; amostra < minN vira "(amostra pequena)" e conf "baixa".
- **Atividade em dia, resultado abaixo** (decisão de 09/10): todos os volumes (leads, contatos, agendadas, realizadas) ≥ `volumeOk × esperado` e receita < `esperado × trajetoria`.
- **Ticket e margem** com operador (objetivo com `op`): só com n ≥ minN.
- **Dados ausentes**: lista metas da empresa sem dado (ou "sem acesso").
- **Hipóteses** em risco/atenção; **proteção** (labProtecaoSinais, fora).
- **Classe do desvio** (lpoClasseDesvio) diz o que investigar e impede transformar baixa conversão em "falta de esforço".
- **Veredito conjunto** (lpoVeredito, OBJ:232): combina `metaRisco`, `volOk`, `convBaixa`, `confBaixa`, `dadosFaltam` em 7 frases (sem_dados, resultado, atividade, risco, conversao, volume, ok), evitando alertas contraditórios.
- **Incidentes**: sinais agrupados por zona do funil (topo, meio, fundo, capacidade, hipóteses); gravidade do incidente = máxima; **impacto = o maior**, nunca a soma, porque sinais encadeados contariam o mesmo dinheiro duas vezes. Ordenação: gravidade desc, impacto desc.
- **Impacto de um déficit** (lpImpactoVendas, PLAN:493): leva o déficit pelas taxas do plano até vendas × ticket; sem taxa devolve "sem taxa histórica para estimar".

### 4.12 Hipóteses do mês (lpHipMedir, PLAN:542)
- Estados: rascunho, planejada, aguardando, andamento, atenção, risco, sucesso, insucesso, inconclusiva, pausada, cancelada.
- `esperado até hoje`: taxa = `base + (alvo − base) × fração`; volume = `alvo × fração`; fração = (agora − ini)/(fim − ini) limitada a [0,1], janela com ±12 h.
- Estado automático: antes do início = aguardando; **depois do fim**: sem dado ou n < minN = inconclusiva; senão atingiu = sucesso, não = insucesso (para "diminuir" vale `real ≤ alvo`); **durante**: sem dado, n < minN ou fração < 0,15 = andamento; senão ok se `real ≥ esp × 0,95` (ou `≤ esp × 1,05` se menor é melhor), atenção entre 85% e 95% (115%), risco abaixo.
- **Veredito automático** (lpAutoVeredito, PLAN:588): hipótese encerrada há **2+ dias** sem avaliação recebe o veredito e uma notificação por 7 dias para registrar o aprendizado.

### 4.13 Canais: custo e retorno (lpCanaisBase, PLAN:888)
- Investimento realizado vem de Marketing em mês-calendário e é **rateado pelos dias do ciclo** (lpInvRateado, PLAN:882: `inv × dias do mês dentro do intervalo ÷ dias do mês`).
- `CPL = inv/leads`; `CAC = inv/vendas`; `margem R$ = receita × margem%`; `MC líquida por venda = margem/vendas − inv/vendas`; `Retorno = margem − inv`; `ROI sobre margem = margem/inv − 1`; `ROI sobre receita = receita/inv − 1`.
- **Mês sem NENHUM investimento lançado (D21)**: CPL, CAC, MC−CAC, retorno e ROI viram `null` e aparecem como "incompleto".
- **Sugestão de % por canal** (lpSugerirMix, PLAN:931): score = `conversão lead→venda × ticket × margem` dos últimos 90 dias, só com `leads ≥ minN` e 1+ venda; canais sem base recebem a média; último canal fecha 100 − soma.

### 4.14 Outros cálculos do Resumo
- **Decomposição** (lpDecomposicao, PLAN:941): `ln receita = ln leads + ln taxa aparente + ln ticket`; cada fator recebe `Δreceita × ln(fator)/ln(receita)`. Compara o mesmo ponto do ciclo anterior. Exige leads, vendas e receita > 0 nos dois períodos.
- **Os três ciclos no mesmo ponto** (lpComparaCiclos, PLAN:843): este, anterior e mesmo ciclo do ano anterior, com variação; para tempo até o 1º contato menor é melhor; verde a partir de 3%.
- **Defasagem** (lpDefasagem, PLAN:1396): Pearson entre leads da semana e vendas N semanas depois (N = 0,1,2,3,4,6,8) em 26 semanas; mínimo 10 leads; avisa "inconclusivo" abaixo de r = 0,3.
- **Plano semanal do ciclo** (lpRitmoSemanas, PLAN:815, hoje incorporado em PSEM): semanas segunda a domingo recortadas no ciclo; meta da semana proporcional aos dias úteis; **o que faltou passa para a semana seguinte**; semanas futuras mostram o "precisa" = `max(0, meta − feito) ÷ dias úteis restantes × dias da semana`.
- **Peso sugerido** (lpSugestaoPesos, PLAN:534): por pessoa `base = vendas90d×3 + reuniões realizadas90d` (0,5 se zero) × dias úteis disponíveis no ciclo, normalizado. Só vale se o gestor aplicar.
- **Diagnóstico por pessoa** (cenários A-D, PLAN:1211): A atividade insuficiente, B conversão baixa, C atividade e conversão ok com resultado baixo, D resultado no ritmo. `ativOk = realizado ≥ 90% do esperado`; `efOk = taxa da pessoa (90d) ≥ 90% da mediana da equipe` (n ≥ minN); `resOk = receita ≥ 95% de meta×fração`.

### 4.15 Relatório da semana (SEM)
- Semana de segunda a domingo; padrão = última semana completa (`off = -1`); semana atual é parcial com `fr = max(0.05, (agora − segunda)/7 dias)`.
- **Base**: média das 4 semanas anteriores (volumes: total ÷ 4 × `fr`; taxas: as 4 semanas juntas; "foto" como receber vencido: usa a semana anterior).
- **Taxas da semana são de FLUXO** (`f:agl` agendadas÷leads, `f:opr` oport÷realizadas, `f:vop` vendas÷oport da mesma semana), não de coorte.
- **smJulgar** (SEM:16): com meta da semana e "maior é melhor": `atual/meta ≥ 1` = bom; `< 0,85` = ruim; entre 0,85 e 1 cai para a comparação com a base. Sem base = neutro. Volume pequeno (aditiva e `max(|atual|,|base|) < 3` e não R$) = neutro. Taxa com `n < 5` (ou `minN`) = neutro. Limiar de variação: **5 p.p. para %**, **20% para h/d**, **15% para o resto**; dentro dele = neutro; fora, bom ou ruim conforme a direção (inverte para "menor é melhor", como tempo até 1º contato).
- **Meta da semana** (smMeta, SEM:88): só com plano ativo ou fechado e indicador de volume (`LP_VOL`): `alvo restante × dias úteis da semana ÷ dias úteis da vigência`. **Receita com corte**: usa `max(0, alvo − vendido antes do corte)`; volumes já são da vigência. Semana atual: meta × `fr`.
- **Causas**: decomposição por pessoa e por canal (até 15 canais; só membros com n ≥ minN nas taxas); "elo anterior" por tabela fixa SM_ELO (receita ← vendas, ticket; vendas ← oport, f:vop; …); volume × ticket por `labWaterfallReceita`; hipóteses da biblioteca cujas condições a semana atende (≥ 50% das condições relevantes verdadeiras e nenhuma condição essencial ausente, top 5), linguagem "compatível com", nunca "causou".
- **Roteiro de ação** SM_ROTEIRO: 20 indicadores com ação, "por quê", "como testar" e "funcionou se"; é texto fixo no código.

### 4.16 Projeção da semana (PSEM)
- **Ritmo** (psRitmo, PSEM:19): `(feito + ritmoHist × 5) ÷ (decorridos + 5)`. O histórico pesa como 5 dias úteis (`PS_PESO_HIST = 5`); sem decorridos devolve o histórico; sem histórico, `feito/decorridos`.
- **Projeção** = `feito + ritmo × restantes`; **faixa** = a mesma conta com o pior e o melhor ritmo semanal das 4 semanas anteriores (com o mesmo encolhimento, por isso a projeção sempre cai dentro da faixa).
- **Situação**: `batida` (feito ≥ meta), `bate` (proj/meta ≥ 1), `risco` (≥ 0,85), `nao` (< 0,85). `precisa por dia = max(0, meta − feito) ÷ restantes`.
- **Dia útil parcial** (psFracaoDia): das 8h às 18h, linear, limitado a [0,1]; quarta 13h = 0,5 dia.
- **Reuniões realizadas pela agenda**: `feito + agendadas ainda pendentes (hoje até domingo, não canceladas/realizadas/no-show) × comparecimento das 4 semanas (padrão 0,75 sem dado)`; faixa: `feito + pend × max(0, taxa − 0,15)` até `feito + pend`.
- **Na mesa**: negócios em Negociação e Assinando contrato; valor = estimado do forecast ou valor do negócio; valor esperado = Σ valor × taxa de coorte (150 a 15 dias atrás) de `contrato_env→ganho` e `negociacao→ganho`; "parado" se há mais de 14 dias na etapa.
- **Ritmo/dia formatado**: contagem com 1 casa abaixo de 10 (antes aparecia "0/dia" para 0,43).

### 4.17 Simulador/caixa (SIM)
- **Perfil de caixa** (lbcPerfilCaixa, SIM:17): fração da receita que entra e sai em cada um de 7 meses depois da venda (mês 0 até "+6 ou depois"), pelo plano de pagamento de cada venda no Financeiro. **Mínimo de 2 vendas com plano** (decisão Amicta) ou não mostra caixa; se faltam vendas no período, cai para as vendas dos últimos 12 meses do escopo. Saídas só com 2+ vendas com custos.
- **Simulação salva** (lbsSnapshot, SIM:70): congela base, projeção, premissas, versão das fórmulas, fontes e data dos dados; comparação posterior reaplica a mesma árvore e filtros ao mês do planejamento e mostra realizado − projetado.

### 4.18 Pontos que parecem incoerências ou código morto no V1 (para não copiar)
- `lpSubResumo` (PLAN:716): há uma expressão `+ labSec('Principais riscos e oportunidades'...)` solta no início de uma linha, depois de um `;`. Ela é avaliada e jogada fora. A seção "Principais riscos" **nunca aparece** no Resumo; o conteúdo foi transferido para a tabela de decisão.
- `lpRitmoSemanas` (PLAN:827): `duRest = sem.reduce(... a + w.dias ? 0 : 0, 0) || ...` é código morto; o valor real vem do `||`.
- `lpDefasagem` e boa parte da Memória são calculadas a cada desenho de tela (sem cache), o que pesa em bases grandes.
- Dois modos de ritmo semanal coexistem (lpRitmoSemanas e PSEM); o comentário diz que o primeiro foi substituído.

---

## 5. O que os testes garantem

**cadeia.test.js** (unitário, extrai funções de PLAN por recorte de texto):
- 150 mil com ticket 30 mil, taxas 50/80/70/20/30%: 5 vendas, 10 oportunidades, **13 realizadas (ceil de 12,5)**, 19 agendadas, 95 leads, 64 contatos, "19 leads por venda", nada falta; sem tentativas.
- Premissa "2 em 5" (lead_venda 0,4 manual): 13 leads; outras etapas inalteradas.
- Entrada em vendas: 3 vendas → receita 90 mil, 6 oportunidades.
- Receita 0: tudo zero e nada falta. Sem ticket: vendas `null` e `falta` contém "ticket". Sem real_oport: `falta` tem real_oport e lead_venda.
- SDR: 19 agendadas → 64 contatos e 95 leads; com leads vindos da cadeia dos closers (13), leads = 13.
- lpRazao: 0,4="2 em 5", 1/3="1 em 3", 0,05="1 em 10", 0,5="1 em 2", 1,2="1 em 1", 0="—".
- lpDividir: 150 mil em 50/30/20; 7 em 60/40 = 4/3; sem peso 5 = 3/2.
- **Modo exato**: 150 mil → 12,5 realizadas; 12,5÷0,7 = 17,857; fatia de 13.917 com ticket 30.000 = 0,464 vendas (não vira 1); sem o modo exato continua a dar 1.
- semLeads: leads 0, nada falta, contatos > 0. Sem semLeads e sem taxa de lead: `falta` contém lead_venda ou lead_ag.
- lpDividirExato: 10 em 3 partes iguais; 7,5 em 3:1 = 5,625 e 1,875.
- Herança de canal-pai: "Indicação clientes" e "Indicação Parceiros" herdam de "Indicação"; "Tráfego Pago - Cadência" herda de "Tráfego Pago"; "Indicação", "PAP" e "Indicações" (plural) não herdam; a premissa própria (ticket 18.000) vale por cima, taxa por taxa; herdado fica marcado.

**metas_dia.test.js**: 22 em 5 dias = 4,4,5,4,5 (soma 22, só 4 ou 5, dia 1 = 4); 3 em 20 dias = zeros e uns somando 3; 40 em 20 = 2 por dia; 12,6 arredonda para 13; k fora do intervalo, du 0, T vazio = 0; **soma preservada para todo T ≤ 60 e du ≤ 23**; lpDividir: 10 em 50/30/20 = 5/3/2; 7 em 60/40 = 4/3; 1 em três canais vai inteiro para um.

**esforco.test.js** (módulo esforco.js, fora da minha lista): meta 100, esperado 40, feito 30 → saldo 70, progresso 30%, status "atrás", tendência 75 (`feito × meta/esperado`); feito 50 → adiantado, 125; igual → em dia; sem meta → `sem_meta`, tendência e progresso nulos; saldo nunca negativo. **Conversão por canal em coorte**: janela de 90 dias que termina 30 dias atrás, amostra mínima 3, reunião "inferida" não conta e "comprovada" pelo funil conta, avanço de etapa (mesmo inferido) prova oportunidade e venda; canal com 1 lead aparece, sem esconder, marcado amostra pequena. **Origens do período**: Tráfego Pago 4 leads (80%), 1 venda, conversão 25%, ticket 30 mil, ciclo 10 dias; ordenação por leads. **Fontes do resultado**: carteira (criada antes do corte) × leads novos; a carteira não é descontada das metas, soma.

**ui/lab_plano.mjs** (roteiro funcional ponta a ponta, modo local): entrada com 3 trilhas; todas as abas abrem dentro de uma trilha; criar plano; consistência aparece; meta de receita 300.000 + ticket 22.000 mínimo → **14 vendas necessárias**; operador "pelo menos" é gravado; premissas gravadas; cenários com 3 colunas; premissa de cenário −10% gravada; montar a partir do ciclo anterior; peso da semana gravado e nota "Pesos definidos pelo gestor"; necessário × viável aparece; responsabilidade por indicador; resumo auditável com "Taxas e amostras" e "Qualidade dos dados"; **ativar grava `publicacao`**; replanejar cria "v2" e a v1 aparece em Versões com o motivo; plano original × atual continua; critério `metaRisco` configurado em 92 aparece no veredito ("meta em risco < 92%") e no histórico; projeção do ciclo como decisão; planilha do Forecast; programa de ciclos de 900 mil com 3 ciclos, "Levar a meta ao plano", e **segundo programa com os mesmos ciclos é recusado**; nenhum erro de console.

**ui/lab_plano_produtividade.mjs**: plano em rascunho não envia nada à Produtividade; ao ativar, Ana (SDR: 400 contatos e 40 reuniões) e Bruno (closer: 30 realizadas, 8 vendas) recebem metas inteiras repartidas pelos canais; meta do dia = `floor(T(k+1)/du) − floor(Tk/du)`; cada função só recebe as etapas da própria função; soma dos dias = meta do mês (Ana 400, Bruno 8); alterar a meta no plano ativo (Ana 620) atualiza tudo; **meta de 5 agendadas no mês com mais de 5 dias úteis → todo dia útil tem ≥ 1 e o mês sobe para o número de dias úteis (`extra = du − 5`)**; contatos da Ana continuam 620; Bruno: realizadas sobem para `max(30, du)`, vendas continuam 8; a tela mostra "mín. 1/dia: o mês passa a N".

**ui/lab_projsemana.mjs** (relógio fixo: quarta 21/10/2026 13h): semana 19/10 a 25/10 com **"2,5 dias úteis passados · 2,5 pela frente"**; vendas feito 1; projeção = `1 + (1 + ritmoHist×5)/(2,5+5) × 2,5` (conferido com tolerância 1e-9); meta da semana entre 3 e 6 (20 no mês); negócio em Assinando contrato (R$ 33.000) aparece em "Na mesa"; semana a semana no ciclo; por pessoa mora em Equipe › Execução por pessoa ("1 → N / meta"); resumo "Vendas fechadas: feito 1, projeção N, meta N"; clique no cliente abre o card; celular sem rolagem lateral.

**ui/lab_cadeia_exata.mjs**: vendas da empresa ≤ `ceil(receita/15.000) + 1` (sem inflar); oportunidades ≥ vendas, realizadas ≥ oportunidades; canais não-origem (Follow-up, Base, Leads Perdidos) sem meta de leads.

**ui/lab_receita_corte.mjs**: com corte no dia 15 e venda de R$ 30.000 no dia 3: "por dia útil" da receita = (100.000 − 30.000) ÷ dias úteis do corte ao fim; célula diz "N dias úteis desde o corte"; semana mostra "faltam R$ 70.000"; a dica explica a conta; vendas continuam 10 ÷ N; **a meta da pessoa na semana (metaPessoa) é R$ 70.000** do corte ao fim do ciclo. Sem corte: meta cheia ÷ dias úteis.

**ui/lab_fora_curva.mjs** (auditoria de 20/10/2026 com backup real): limite = **5 × ticket = R$ 100.000**; negócio de R$ 1 milhão fica fora (nome "Rádio Grande SA", chance histórica > 0) e o pipeline previsto conta só o normal (≤ R$ 20.000); o total aberto da etapa continua mostrando os dois (abertos 2, foraN 1); Resumo lista "Fora da projeção: 1 negócio(s) acima de R$ 100.000" e a projeção fica abaixo de R$ 300 mil; **"Vendemos 2 de 11"** (1 antes do corte + meta 10); ciclo inteiro: 2 vendas, ticket R$ 6.000; linha de vendas: "do corte em diante · mês: 11" com campo editável em 10; Equipe: "R$ 290.000 + R$ 10.000 vendidos antes de 13/10 = R$ 300.000 × meta coletiva R$ 300.000 ✓"; ritmo 0,43 → "0,4", 3 → "3", 12,4 → "12"; Plano do dia mostra "fora: Rádio Grande SA (R$ 1.000.000)".

**ui/lab_trilhas.mjs**: 4 cartões (passado, mês, futuro, Studio); toda aba e sub-aba do Planejamento em exatamente um passo; **36 passos**; migalha "LAB › trilha › passo"; endereços `#lab/<aba>`, `#lab/plan/<sub>`; "próximo" no rodapé; dobras de seção com estado lembrado; "Abrir tudo"/"Só o essencial"; atalhos antigos continuam; celular sem rolagem lateral.

---

## 6. Comparação com o V2 atual

Legenda: **cobre** = equivalente; **raso** = existe, mas faz bem menos; **não existe**.

| Capacidade do V1 | V2 hoje | Veredito |
|---|---|---|
| Ciclo mensal + calendário com feriados BR | `cicloDe`, `diasUteis`, `feriadosBR` (calendario.ts). Falta ausência por pessoa, edição de feriados no plano, dias de trabalho por ciclo, peso por semana; 20/11 só de 2024 em diante (acerto); `inicioCicloDia` limitado a 1-28 | **raso** |
| Metas só de acréscimo, por indicador e pessoa | `lab.meta` append-only, `metasVigentes` (distinct on) | **cobre**, mas sem `op` (atingir/min/max/faixa), sem escopo canal, sem `origem` (manual/derivada/programa), sem premissa e sem histórico de quem mudou o quê |
| Esperado até hoje | `esperadoAteHoje`: linear, mas **conta hoje inteiro** (V1: 0,5), sem ausências, sem pesos, sem janela de vigência/corte | **raso**; vira a regra única do V1 no dia e muda a leitura em até um dia útil |
| Status do ritmo | `statusDoRitmo`: ≥ 100% no ritmo, ≥ 85% atenção, senão atrás | **cobre** o 85% (coincide com `trajetoria`), mas limiares não são configuráveis e não há "grave" 60% |
| Build-up reverso | `buildupReverso`: receita→vendas→…→tentativa, `ceil` em cada passo, **meta por pessoa = total ÷ nº elegíveis**, canais por participação nas vendas | **raso e com a falha que o V1 já corrigiu**: arredonda a cada degrau (V1 em 12/10/2026 mediu +26% de vendas e +51% de leads por isso), não usa taxas por canal/pessoa, sem herança de canal-pai, sem premissa "a cada N leads, K vendas", sem canais que não são origem de lead, sem pré-venda indo para o SDR, sem pesos, nem meta individual manual |
| Taxas históricas | `taxasHistoricas`: janela fixa anterior a `ate` (padrão 180 dias, sem a defasagem de 30 dias), taxas de atividade como razão de contagens, coorte só para oportunidade→venda; sem amostra mínima por taxa | **raso**: faltam coorte por etapa, maturação, `n` por taxa, descarte de taxa > 100%, precedência canal/pessoa |
| Projeção de fechamento (ritmo, histórica, ajustada, Poisson) | **não existe** (só quarter/cenários e ritmo) | **não existe**; é o coração da pergunta "vamos bater?" |
| Pipeline × chance × prazo, fora da curva (5× ticket) | não existe no planejamento (há projeção no studio/campanha, não no ciclo) | **não existe** |
| Plano reverso do que falta (leads adicionais, "cabe no mês") | não existe | **não existe** |
| Corte/replanejamento com versões | não existe (metas só de acréscimo, sem corte nem `versao`) | **não existe** |
| Ativação com original congelado e resumo auditável | `quarter` + "travar" (compromisso) + `retrato_ciclo` assinado SHA-256 | **cobre em parte e supera** em imutabilidade (assinatura), mas sem original × atual por meta |
| Cenários | `cenariosDoQuarter`: ±15% fixo nas taxas, ticket fixo | **raso**: V1 usa Wilson 95% por taxa, regras em % por premissa (ticket, margem, pipeline, leads, cabe), notas, conflito de margem, sensibilidade ±10% |
| Programa de ciclos | `programaDeCiclos`: divide a meta por pesos (dias úteis), último ciclo absorve arredondamento | **raso**: não faz meta vigente (sobra e falta passam para frente), não tem fotos de fechamento, nem proteção contra dupla contagem |
| Contingência | `contingencia`: falta ÷ dias restantes, "viável" até 1,5× | **cobre** a ideia (o módulo de contingência do V1 é outro arquivo) |
| Fechamento do dia | `fechamentoDoDia` (servidor): meta do dia, realizado do dia/ciclo, status, plano de amanhã | **cobre** o essencial do relatório das 17h30 |
| Meta diária inteira distribuída (soma exata, mín. 1/dia) | `ceil(meta/du)` na meta do dia | **raso e com erro de soma**: `ceil` em todos os dias faz a soma passar da meta do mês |
| Capacidade e viabilidade (necessário × viável × déficit) | não existe | **não existe** |
| Equipe: função, peso, ausências, canais pré/venda | `pessoa.funcao` apenas | **raso** |
| Sinais, incidentes, veredito, classe do desvio, tarefa a partir do sinal | `hipoteses` (achados por impacto em R$, canvas de decisão) cobre uma parte do conceito | **parcial por outro caminho**: achados com impacto são equivalentes ao "impacto potencial", mas não há grupo por zona, veredito conjunto nem criação de tarefa |
| Hipóteses do mês com veredito automático | `experimento` (baseline/alvo/medição) e `aprendizado` | **cobre em parte** (sem estados automáticos nem veredito após 2 dias) |
| Relatório da semana (deu certo/errado, causas por pessoa e canal, hipóteses, roteiro) | **não existe** | **não existe** |
| Projeção da semana (ritmo encolhido, faixa, "na mesa", pela agenda) | **não existe** | **não existe** |
| Canais: custo e retorno (CPL, CAC, MC−CAC, ROI com rateio por dias do ciclo) | `metricas` tem CPL, CAC, ROI e payback por canal (mensal) | **cobre** o cálculo, mas sem o rateio mês-calendário → ciclo e sem a regra "mês sem lançamento = incompleto" |
| Decomposição log da receita, comparação de 3 ciclos, defasagem | não existe | **não existe** |
| Caixa projetado por safra | não existe (V2 não tem financeiro) | **não existe** |
| Trilhas de navegação (passado/mês/futuro) | abas Ritmo, Equipe e metas, Quarter, Fechamento, Achados, Dados, Studio, Operações | **parcial**: a estrutura é por módulo, sem a lógica "pergunta → passo" |

Resumo crítico: o V2 acerta no desenho (dados canônicos, metas só de acréscimo, quarter assinado, servidor faz as contas). Mas, na pergunta central do Jarvis ("vamos bater a meta deste ciclo, e o que muda se eu mexer em X?"), ele só tem o ritmo linear. Faltam a projeção composta (realizado + pipeline + leads futuros), a chance de bater, o replanejamento com corte e o build-up fiel por canal e pessoa. A conta de metas diárias e de build-up do V2 tem erros de arredondamento que o V1 já descobriu e corrigiu.

---

## 7. O que isso entrega que uma planilha não entrega

1. **Uma só definição por indicador** (LAB_MET): "Reuniões agendadas" significa a mesma coisa no plano, no relatório da semana, na projeção e na Produtividade. Na planilha cada aba redefine à sua maneira.
2. **Meta que vira ordem do dia**: ao ativar, as metas do mês descem para cada pessoa, canal e dia, em números inteiros que somam exatamente a meta, e aparecem no Plano do dia e na Produtividade. A planilha não age sobre a rotina.
3. **Realizado vindo da operação**, sem digitar: contatos da Cadência/WhatsApp, reuniões da Agenda, vendas do funil. A diferença entre "dado ausente" e "zero" é explícita (traço, não 0).
4. **Projeção honesta e decomponível**: realizado + pipeline × chance histórica × chance de fechar no prazo + leads que ainda vão entrar × conversão × ticket, com tudo explicado em linguagem corrente por clique (lpExplicar), negócio gigante tratado à parte, e "chance de bater" por Poisson.
5. **Memória e auditoria**: original congelado, versões do replanejamento com motivo, histórico de cada alteração com autor e data, fotos diárias das previsões para medir erro das próprias previsões, registro de decisões e de aprendizados.
6. **Diagnóstico que não acusa o time errado**: o veredito conjunto e a classe do desvio separam falta de volume, conversão baixa, demanda ruim, ticket e dado ausente, e mostram a amostra (n) e a confiança em cada número.
7. **Necessário × viável**: a meta nunca é reduzida em silêncio; mostra o déficit de capacidade e as alternativas.
8. **Ação a partir do sinal**: um clique vira tarefa para o time (com a lista de leads atrasados na Cadência) ou para o gestor.
9. **Texto pronto para a reunião**: resumo do mês e da semana para colar no WhatsApp.

---

## 8. Riscos e armadilhas ao portar para o V2

1. **Dependência pesada do CRM e do navegador.** PLAN chama `G()`, `patchG()`, `todosNegocios()`, `agTodos()`, `cdDocs()`, `prAuto()`, `labForecast()`, `pnMedir()`, `consultores()`, `S.equipe`… e desenha HTML na mesma função que calcula. Portar é separar o cálculo (puro) da tela e reescrever cada fonte contra o modelo canônico do V2.
2. **Estado do navegador que vira regra.** `LP` (mês, sub-aba, filtros), `PREF.get('lpProj')`, cache `LP.hc`/`LP.ppc`, `LAB.f` (filtros trocados temporariamente em `lpComFiltrosNeutros`). No V2 o servidor deve receber tudo por parâmetro; nada de estado global.
3. **Nomes em português são as chaves** (`ind`, `alvo`, `escopo`, `ref`, `funcao: 'ambos'`, `reuniao_ag`, `reuniao_ok`, `sql`, `contrato_env`). Etapas do funil do V1 (`sql`, `orc_sol`, `visita_ok`…) são específicas de solar B2C; o V2 usa papéis canônicos. É preciso um mapa etapa V1 → papel V2, e `sql` do V1 = oportunidade.
4. **Pessoa identificada por nome**, não por id (`nomeNorm(consultorDe(d))`, `pessoas[nome]`, `ref: nome`). Renomear uma pessoa quebra histórico. O V2 já usa `pessoa_id`; o port deve migrar nomes para ids antes de importar metas.
5. **Mês do ciclo é a chave** (`AAAA-MM` do início). Se o V2 permitir ciclos de duração diferente, a chave não serve.
6. **Documentos JSON mesclados e gravados em texto** (`cadeia`, `gestao/metas.lab[...]`, `pessoas[n]` como string). `null` apaga campo. Não replicar; no V2 usar tabelas ou JSON tipado e acrescentar linhas.
7. **Arredondamento é regra de negócio.** Mantenha: calcular em fração e arredondar uma vez por pessoa; receita com `round`, volumes com `ceil(x − 1e-6)`; metas diárias por `floor(T(k+1)/du) − floor(Tk/du)`; maior resto. Os testes do V1 (`cadeia`, `metas_dia`) são o contrato; portar como testes do V2 antes de escrever o código.
8. **"Hoje conta 0,5" e "ausente ≠ zero"** são decisões que mudam números. Se o V2 mantiver "hoje inteiro", o esperado até hoje fica sempre maior que o do V1 no meio do dia.
9. **Janela histórica termina 30 dias atrás** (maturação) e taxa de coorte exige `n ≥ minN` (10). Sem isso o histórico recente subestima conversão e o plano vira "meta impossível".
10. **Taxa > 100% é descartada** (contato→reunião); o V2 trunca em 1 com `Math.min`, escondendo dado incoerente.
11. **Regras de data/fuso.** O V1 usa meio-dia local (+12 h) para evitar virada de dia (lpVigTs, `tsDe(iso) − 12h`). O V2 usa UTC e `at time zone op.fuso`; cuidado com corte e semanas.
12. **Fontes que o V2 não tem**: WhatsApp do CRM como contato, Cadência com atraso, Agenda com no-show/reagendamento, `forecast.estimado` por negócio, Financeiro (margem, caixa), Marketing mensal, tarefas, notificações. Cada uma sustenta um número (tempo até 1º contato, comparecimento, pipeline, margem, CAC). Sem a fonte o número deve aparecer como "sem dado", não zero.
13. **Mix de decisões de produto escondidas em comentários** (D1 ticket sem valor zero, D3 regra única de reunião, D4 marketing em mês-calendário, D9 pesos de semana, D16 meta final continua após fechamento, D21 investimento incompleto, "decisão da Amicta" caixa ≥ 2 vendas, decisão de 10/10 mínimo 1/dia, decisão de 09/10 volume ok ≠ resultado ok). Registrar como decisões no V2 antes do port.
14. **Texto fixo do roteiro de ações (SM_ROTEIRO) é conhecimento solar B2C** ("kWp", "conta de luz", "kit"). No V2 deve vir do pack por modelo de negócio.
15. **Permissões.** A gravação é só do administrador, cenários têm chave própria e tabelas protegidas (SQL 39), financeiro e produtividade individual pedem nível 2. O V2 tem login Supabase Auth, mas ainda sem essa granularidade.
16. **Pontos para consertar, não copiar**: o bloco morto "Principais riscos" no Resumo (4.18), o cálculo repetido a cada desenho sem cache, e a tela e o cálculo no mesmo arquivo.
17. **Ordem sugerida de portagem** (maior valor por esforço): (1) projeção composta com pipeline e leads futuros + chance de bater (4.9); (2) esperado com regra de dia parcial, ausências e vigência/corte (4.1, 4.8); (3) build-up exato por pessoa × canal com precedência de taxas (4.4, 4.6); (4) distribuição inteira por dia com mínimo (4.7); (5) projeção e relatório da semana (4.15, 4.16); (6) sinais, veredito e classes (4.11); (7) replanejamento com versões e programa com meta vigente (4.10); (8) hipóteses do mês (4.12).
