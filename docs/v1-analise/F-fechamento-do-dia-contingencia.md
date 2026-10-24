# Frente F: Daily (Fechamento do dia), Contingência do ciclo e Worker, no LAB V1

Convenções: "motor" = regras puras testadas; arquivos citados são os de `v1_fontes/` (prefixo `fontes__` omitido), linhas entre parênteses. "Amicta" é o nome da operação no V1. Quando uma função usada aqui mora em outro arquivo (Plano do dia, Planejamento), digo isso e cito só o que os testes provam.

---

## 1. Para que serve cada parte

**Fechamento do dia (o "daily")**. Relatório gerencial automático, gerado todo dia útil às 17h30 (fuso de São Paulo) no servidor, sem ninguém abrir o CRM. Responde, para o gestor: "o time entregou hoje o que o plano pedia? quem precisa de conversa? o que travou? o que eu preciso decidir? isso mexe na meta do mês e do quarter?". Não é rotina do time (o time tem o "Plano do dia"); é o espelho do gestor sobre a execução do dia. Seções fixas, nesta ordem: Resumo, Alertas, Previsto × realizado, O que deu certo, O que deu errado, Quem precisa de atenção, Oportunidades e gargalos, Pendências, Impacto nas metas do mês e do quarter, O que exige sua intervenção, Limites da leitura.

Princípios que o código impõe (e que valem como requisito de produto):
- Nada de fórmula nova: o relatório só junta o que o Plano do dia (`pdDados`) e o Planejamento (`lpCalc`) já calculam (daily.js:5-6).
- "Sem dado" nunca vira zero; um dia só é "sinal a investigar", não problema comprovado (daily_motor.js:10).
- Toda frase tem um tipo: fato, desvio, diagnóstico, risco, recomendação, decisão. A decisão é sempre do gestor, nunca do motor (daily_motor.js:14).
- O relatório nunca altera meta; recomendações estratégicas são "levadas ao Planejamento".
- Memória: o original nunca muda; recálculos do mesmo dia entram como "complemento".

**Contingência do ciclo**. Responde: "faltam N dias úteis até o fim do ciclo; para bater a meta de receita e de vendas, o que cada vendedor precisa fazer em cada dia?". É a ferramenta de recuperação de meta. Mede a empresa e cada pessoa contra uma régua única (100% / 90% / 75%), diz em que nível está (no ritmo, atenção, contingência, crítico), explica por quê, sugere ações (como hipóteses, nunca promessa) e entrega uma matriz "vendedor × dia útil" com o alvo diário de recuperação. Nada é aplicado sozinho; não altera meta, plano ou tarefa (contingencia.js:12).

**Worker (Cloudflare, rotina no servidor)**. Dispara a cada 15 minutos, pergunta ao banco se o relatório de hoje já existe, e a partir das 17h30 gera uma vez. Faz retentativa (até 4 falhas), ignora dia sem expediente, e às 23h30 roda mais uma vez para captar registros lançados com atraso. Roda o MESMO código do CRM (núcleo gerado do site) com um relógio no fuso da empresa. Grava cada execução em tabela de auditoria. Também atende o botão "Gerar agora" (só gestão).

---

## 2. Telas e interações

**Fechamento do dia** (LAB › Planejar e acompanhar o mês › Fechamento do dia, `labTelaFechamento`, daily.js:189-255). Só gestão (`pd_gestor`); outros veem "Só para a gestão".
- Barra de navegação: ‹ dia anterior, › dia seguinte, "Hoje", seletor de data (últimos 60 dias), botão "Gerar agora" (só no dia de hoje), "Copiar resumo" (texto pronto para WhatsApp/e-mail: status, desvio, avanço, risco, 5 recomendações; `dxCopiar` 302-307).
- Faixa de corte: "Gerado às HH:MM de DD/MM. Dados registrados no CRM até HH:MM (fuso). Regras AAAA-MM-DD.n" e aviso de complementos.
- Se ainda não há relatório gravado hoje: "Prévia ao vivo, não gravada" (calculada na hora no navegador). Na prévia não dá para registrar decisão.
- Resumo: selo do dia (Dentro do previsto / Atenção / Crítico / Sem dados), 3 KPIs (objetivos atingidos X de Y; pessoas que pedem atenção X de Y; nº de alertas e quantos críticos), e 5 linhas: desvio mais relevante, principal avanço, principal risco, decisão mais urgente, meta do mês.
- Alertas (nível 2 e 3), cada um com Esperado × Aconteceu × Desvio e um "Evidência e confiança" expansível (evidência, período, referência, confiança, hipótese de causa, o que falta saber, impacto). Mostra "Aparece pelo 3º relatório seguido" e decisões anteriores.
- Tabela Previsto × realizado (indicador e origem do dado, previsto, realizado, diferença, %, situação atingido/perto/abaixo/sem meta/sem dado).
- Duas colunas: o que deu certo / o que deu errado (este com roteiro de 7 passos: esperado, aconteceu, desvio, evidência, causa, impacto, ação).
- Quem precisa de atenção: por pessoa, situação (6 estados), entregas, desvios, bloqueios, nº de pendências, cumprimento médio dos relatórios anteriores, se a carga de amanhã cabe, "necessidade" (o que o gestor deve fazer). Clique no nome abre o Plano do dia da pessoa.
- Oportunidades e gargalos: avanços do dia (venda, oportunidade, visita, reunião, um por negócio) e gargalos como hipóteses com evidência/período/referência/confiança.
- Pendências: tarefas atrasadas e de hoje classificadas, com prazo ORIGINAL e "adiada N×"; botões "Reagendar" (abre o adiamento com justificativa da própria tarefa) ou "Decidir".
- Metas do mês e do quarter (situação, esperado, desvio, projeção, premissas, impacto) + botão "Abrir a Correção de rota".
- Intervenções: lista ordenada por gravidade com problema, evidência, "se nada for feito", ação recomendada, responsável sugerido, prazo e indicador da correção. Botões "Registrar decisão" (modal: decidida / encaminhar como tarefa / pedir investigação / só analisada; texto obrigatório com 5+ caracteres exceto "analisada"; se "encaminhar", escolhe responsável e prazo e CRIA uma tarefa real com origem `{mod:'daily', data, chave}`, prioridade alta) e "Marcar como analisada".
- Limites da leitura, Histórico (tabela dos últimos 60 dias, clicável), Complementos, bloco "Rotina das 17:30" (horário, fuso, ligado/desligado; última execução, status, duração, última falha; só quem tem `lab.configurar` altera, cada mudança vai para `dailyHist`) e "Como calculamos".
- Sino do CRM (`dxNotificacoes`, 171-178): "Fechamento do dia: <status>" quando sai; "O fechamento de hoje não foi gerado" se passaram 20 min do horário e não existe (com a última falha).

**Contingência do ciclo** (aba "Contingência do ciclo", `labTelaContingencia` contingencia.js:206-223):
1. Cabeçalho colorido com o nível pior entre receita e vendas, frase de ação, ciclo, hoje, último dia, dias úteis restantes (contando hoje) e contagem de vendedores por nível.
2. 5 KPIs: meta de receita (+ fechado e esperado até hoje), falta de receita (+ dias úteis e R$/dia útil e "N× a média"), meta de vendas, faltam vendas (+ ticket de referência), projeção ajustada do Planejamento (% da meta).
3. "Por que está neste nível": cada critério disparado, com número e dono.
4. "O que fazer (gatilhos)": ações sugeridas, rotuladas "Hipótese de melhoria".
5. Dia a dia da empresa: por dia útil, meta acumulada, fechado acumulado, diferença, alvo do dia (R$ e vendas).
6. Matriz do vendedor por dia: passado = feito/meta (verde ≥ 90%), hoje = feito/alvo, futuro = alvo de contingência (itálico, arredondado para cima), última coluna = o que falta no ciclo. Seletor de etapa (contatos, reuniões, realizadas, oportunidades, vendas...).
7. Situação de cada vendedor: vendas, receita, vendas esperadas do pipeline aberto ("cobre / não cobre o que falta"), contatos, principal desvio.
8. Fotos diárias gravadas, e "O padrão e como calculamos" com três campos editáveis (limite da contingência, limite do crítico, dias seguidos), botão "Voltar ao padrão".
- Bloco dentro do Plano do dia de cada vendedor (`ctPessoaHtml` 226-240), só aparece se a empresa ou a pessoa estiver em contingência ou pior: tabela por etapa com alvo de contingência de hoje, e a nota de que o alvo do Plano do dia é o "mínimo de hoje" e o de contingência é "o que fecha o ciclo".

---

## 3. Modelo de dados, entradas/saídas, quando roda, quem recebe

**Tabelas (supabase 65_lab_daily.sql)**
- `lab_daily` (uma linha por dia, chave = data, l.18-27): `original` (jsonb, nunca muda), `atual` (último cálculo), `complementos` (lista, máx. 30: quando, origem, hash, "o que mudou"), `acoes` (decisões do gestor por chave, com histórico de até 20), `ref` (referência dos dados: corte, versão das regras, versão do Plano do dia, plano usado, pessoas, contagem de negócios/tarefas/agenda/cadências, hash), `gerado_em`, `atualizado_em`.
- `lab_daily_exec` (cada execução, l.28-40): data, origem (`agendado`/`manual`/`complemento`), início, fim, status (`rodando, ok, complemento, sem_mudanca, sem_expediente, falhou, ignorado`), erro, tentativa, por quem, detalhe (ms, nº de pessoas, nº de alertas, hash, o que mudou).
- Segurança: RLS ligada sem política; tudo por funções `security definer`. Worker (service_role) grava; gestão (`pd_gestor`) lê e registra decisão. Dependência: SQL 30 (`pd_gestor`); SQL 60 (WhatsApp) opcional.
- Funções: `lab_daily_tique` (o que o Worker precisa saber: existe, rodando, sem_expediente, nº de falhas, complementado, config), `lab_daily_exec_inicio` (trava por data com `pg_advisory_xact_lock`; se há outra "rodando" há menos de 10 min, grava "ignorado" e devolve null; execução presa >10 min vira "falhou"), `lab_daily_exec_fim`, `lab_daily_gravar` (primeiro = `ok`; mesmo hash = `sem_mudanca`; hash diferente = `complemento`, original preservado), `lab_daily_wa_contatos`, `lab_daily_lista`, `lab_daily_ler`, `lab_daily_status`, `lab_daily_acao`.
- Configuração em `gestao/lab.daily` {hora, fuso, ativo} e `dailyHist`; padrão da contingência em `gestao/lab.conting` e `contingHist`.

**Contingência: sem tabela nova.** A "foto diária" fica em `gestao/lab:prev:<ciclo>.conting[<data>]` (contingencia.js:91-98): nível, placar da empresa (meta, real, esperado, projeção, falta, ritmo necessário/atual, fator), por pessoa o nível e por etapa metaTotal/esperado/feito/falta/alvoHoje, resumo por nível, ações e versão das regras. Enquanto o dia é hoje a foto é refeita se mudou (compara um hash); dia que passou não é regravado. Só quem tem `lpAdmin` grava; o sino chama `ctCapturar` no máximo a cada 10 minutos (100-106). A mesma foto (sem a hora) entra também no relatório das 17h30 em `equipe.conting`.

**Entradas do relatório (daily.js:74-83, `dxFoto0`)**: negócios, tarefas, agenda, cadências, config, projetos, compras, enablement, gestão (plano do ciclo, quarter), perfis, contatos de WhatsApp dos últimos 200 dias, linhas do `plano_dia` de hoje (quem abriu o plano, justificativas, feitos) e os últimos 10 relatórios (para recorrência). Por pessoa (`dxPessoa` 31-51): produção por etapa (meta de hoje, alvo com recuperação, feito, falta, atraso, janela), objetivos da semana, quadrante (atividade × resultado), viabilidade, padrão de dias abaixo, gargalos de conversão, tarefas, reuniões, avanços do dia, cards críticos, capacidade, carga de amanhã. A fotografia ignora o filtro de funis e a semana escolhidos na tela (relatório é da operação inteira).

**Saída**: um JSON `R` com `resumo, comparacoes, certo, errado, pessoas, avancos, pendencias, alertas, recomendacoes, metas, limitacoes, chaves, conting, ref`. **Quem recebe**: a gestão, na tela, no sino e no texto copiável. Não há envio por e-mail/WhatsApp.

**Quando roda**: Cron a cada 15 min; gera no primeiro tique ≥ 17:30 (`hm >= cfg.hora`, comparação de texto "HH:MM"); complemento no primeiro tique ≥ 23:30; "Gerar agora" a qualquer hora.

---

## 4. Regras e fórmulas exatas

### 4.1 Esperado até hoje (regra única do LAB, em lab_plan.js, usada por tudo)
- `lpDU(P,C,a,b,pessoa)` (lab_plan.js:49-53): dia útil = dia da semana está em `cal.dias` (padrão seg-sex) E não está em `cal.feriados` E não está nas ausências da pessoa (`P.pessoas[n].aus[iso]`). Feriados: do plano (editáveis) ou os nacionais gerados por `lpFeriados(ano)` dentro do ciclo.
- `lpDecorridos` (lab_plan.js:55): dias úteis antes de hoje contam inteiros; **hoje conta 0,5**.
- `lpPesosDias` (lab_plan.js:764): o gestor pode dar peso por semana (`cal.pesos`, chave = segunda-feira); se todos forem 1, devolve null (distribuição uniforme).
- `lpFrac` (lab_plan.js ~767): sem pesos = `decorridos ÷ dias úteis`; com pesos = (soma dos pesos dos dias passados + metade do peso de hoje) ÷ soma total, limitado a 1.
- `lpEsperado` (lab_plan.js:780): `meta × lpFrac`. Metas de **taxa/média** (ticket etc.) não se dividem: esperado = a própria meta. Receita e vendas contam o ciclo inteiro; atividade conta da vigência (corte do "Replanejar a partir de uma data"). Em plano replanejado, vendas: `vendidoAntes + max(0, meta − vendidoAntes) × fração da vigência`.
- Meta diária inteira (`metaDiaInteira`, gestao.js; teste metas_dia): o dia k recebe `floor(T·(k+1)/du) − floor(T·k/du)`; a soma dos dias é exatamente T (22 em 5 dias = 4,4,5,4,5). Meta por canal: `lpDividir` pelo método do maior resto (10 em 50/30/20 = 5/3/2).

### 4.2 Régua da contingência (contingencia_motor.js)
`CTM_PADRAO = { atencao:1, contingencia:0.9, critico:0.75, esforco:[1.2,1.5,2], minDiasProj:3, diasSeguidos:2, pctDia:0.9 }` (l.15).
- `ctmNivel(razao)` (24-27): ≥1 → 0 no ritmo; ≥0,9 → 1 atenção; ≥0,75 → 2 contingência; abaixo → 3 crítico; null se não há razão.
- `ctmNivelEsforco(fator)` (29-32): ≥2 → 3; ≥1,5 → 2; ≥1,2 → 1; senão 0.
- `ctmCfg` (17): config do gestor sobrepõe o padrão; valor ≤0 ou inválido é ignorado. A tela ainda recusa: contingência fora de 50-100% ou ≤ crítico; crítico fora de 10% a < contingência; dias seguidos não inteiro ou fora de 1-10; quem não é `lpAdmin` não altera (contingencia.js:250-263).

### 4.3 Placar de uma meta de ciclo (`ctmPlacar` 37-56)
Entrada: meta, real, esperado até hoje, projeção ajustada, `projFragil`, `dd` (dias úteis decorridos, hoje = meio), `diasRest` (dias úteis de hoje ao fim, **contando hoje**).
- `falta = max(0, meta − real)`; `razaoEsp = real ÷ esperado`; `razaoProj = proj ÷ meta` **só se** `dd ≥ 3` e projeção não frágil.
- `ritmoNec = falta ÷ diasRest`; `ritmoAtual = real ÷ dd`; `fator = ritmoNec ÷ ritmoAtual` (se ritmoAtual > 0).
- Casos especiais: sem meta ou sem realizado = `sem_dado`; `falta ≤ 0` = `batida` (nível 0); `diasRest = 0` e não bateu = `encerrado` (nível 3: "não restam dias úteis").
- **Nível = o pior de três critérios**: ritmo (razaoEsp), projeção (razaoProj) e esforço (fator). Cada um que passa de 0 vira um "motivo" em texto com os números e é ordenado por gravidade.
- Exemplo do teste: meta 400.000, real 150.000, esperado 200.000, proj 300.000, dd 10, 10 dias restantes: falta 250.000, 25.000/dia útil, ritmo médio 15.000, fator 1,67; razão 75% = contingência; projeção 75% = contingência; esforço 1,67× = contingência; 3 motivos.

### 4.4 Empresa (`ctEmpresa`, contingencia.js:32-43)
Estados: `sem_plano`, `rascunho` (só mede contra plano **ativo**), `encerrado` (plano fechado ou hoje > fim). Para receita e vendas: meta do plano, real = `X.proj[k].real`, esperado = `lpEsperado`, proj = `X.proj[k].ajust`, `dd = X.dd`, `diasRest` = dias úteis ≥ hoje. Nível da empresa = o pior entre receita e vendas. Última data do ciclo = `C.fim − 1 dia`.

### 4.5 Trajetória dia a dia (`ctmTrajetoria` 62-76)
- Cada dia útil recebe `peso` (1 ou o do calendário). `metaDia = meta × peso ÷ soma(pesos)`; `esperadoAcum = meta × pesoAcumulado ÷ soma`.
- Realizado acumulado soma **todos os dias corridos** até aquela data, então o que fecha em sábado/domingo/feriado entra no próximo dia útil (teste: sábado 5 + seg 10 = 15).
- Hoje e futuro: `faltaAntes = max(0, meta − realizado antes de hoje)`; `alvoDia = faltaAntes × peso ÷ soma dos pesos restantes (hoje incluso)`; `alvoAcum` chega exatamente na meta no último dia. Se já bateu antes de hoje, alvo 0 (nunca negativo). Em vendas é média esperada, não promessa por dia.

### 4.6 Uma pessoa (`ctmPessoa` 82-101; dados em `ctPessoaDados` contingencia.js:55-67)
Por etapa (contatos, reuniões, realizadas, oportunidades, vendas etc., conforme `PD_ORDEM`): `metaTotal` (ciclo inteiro), `metaCiclo` (acumulada até hoje, com hoje) = esperado, `feitoCiclo`.
- `razao = feito ÷ esperado`; `nivel = ctmNivel(razao)`; `falta = max(0, metaTotal − feito)`.
- `atrasoAntes = (esperado − metaHoje) − (feito − feitoHoje)` (atraso acumulado **até ontem**; negativo = adiantado).
- Dias da pessoa = `pdDiasUteis(n, hoje, fim)`: já descontadas as ausências dela. `alvo[dia] = max(0, metaDoPlanoNoDia + atrasoAntes ÷ nDias)`. A soma dos alvos = falta + feito de hoje (teste: 110 = 100 + 10); chega à meta no último dia; adiantado abate, sem negativo.
- Atividade = etapa `contatos`; resultado = etapa `vendas`. Nível da pessoa = o maior entre etapas, atividade e resultado.
- **Regra dos dias seguidos**: se `seguidos ≥ 2` (dias úteis seguidos com atividade abaixo de 90% do alvo do dia, vindo de `D.padrao.seguidos`) e a atividade estava abaixo do nível 2, ela é **promovida a contingência** (nível 2, `porSeguidos`), mesmo com o acumulado em dia.
- Pessoa sem meta nenhuma: `sem_dado`, sem inventar nível. Sem dias restantes: não divide por zero.
- Receita por pessoa só aparece quando o plano tem meta de receita dela (`ctmPlacar` com `diasRest` = dias dela).

### 4.7 Ações dos gatilhos (`ctmAcoes` 109-120)
- Pior nível da empresa ≥3: ação 0 "Decidir sobre a meta do ciclo" (manter e redistribuir, replanejar a partir de uma data, ou reforçar geração de oportunidades; "manter a meta sem mudar nada não é uma decisão"), prazo hoje.
- Nível 2: "Ativar o plano de recuperação até DD/MM" (alvo diário por vendedor, revisão diária de 10 min por vendedor).
- Atenção (1): nenhuma ação.
- Por pessoa (só nível ≥2): atividade abaixo e resultado ok = "Atraso operacional"; resultado abaixo e atividade ok = "Insuficiência de resultado com atividade em dia" (se `pipe ≥ falta`: "o foco é fechar, não gerar mais volume"; senão revisar conversão oportunidade→venda); ambos = "Atividade e resultado abaixo do plano". `pipe` = vendas esperadas do pipeline aberto (cada negócio × chance histórica da etapa × chance de fechar a tempo, mesma conta do Plano do dia). Todas com tipo `hip`.

### 4.8 Fechamento do dia: regras do motor (daily_motor.js)
Parâmetros (`DXM_CRIT`, l.19): `pctOk 0.9`, `minN 10`, `recorrente 3`, `histDias 10`.
- **Previsto × realizado** `dxmComparar` (31-37): `pct = real ÷ prev`; status `atingido` (≥1), `perto` (≥0,9), `abaixo`; sem realizado = `sem_dado`; sem previsto (≤0) = `sem_meta`. Só **contatos** são meta do DIA; reuniões, oportunidades e vendas valem pela SEMANA (objetivo semanal = meta da semana + parcela do atraso). Comparações geradas (96-106): cada etapa diária e semanal, "Tarefas com prazo hoje × concluídas hoje", "Reuniões da Agenda conduzidas já no horário × realizadas".
- **Situação da pessoa** `dxmSituacao` (40-53), na ordem: fora do expediente (`trabalha===false`, pelo calendário e ausência); **sem registro** (nenhum contato, tarefa concluída, reunião realizada ou evento hoje, e havia alvo ou tarefa: "pode ser registro ainda não feito: confirmar antes de concluir"); **bloqueio** (há tarefa de terceiro ou justificativa de terceiro e o cumprimento < 90%); **falta de execução** (cumprimento < 90%; cumprimento = soma de min(feito, alvo) ÷ soma dos alvos diários); **resultado abaixo** (quadrante `resultado` = atividade em dia, conversão atrás); sem meta; em dia.
- **Pendências** `dxmPendencia` (56-64), ordem de precedência: negócio encerrado = `sem_validade`; `bloqueada`; `terceiro`; adiada ≥2× = `decisao`; prioridade alta, card crítico ou atraso ≥3 dias = `prioridade`; resto = `reagendar`. Reagendar não apaga o desvio (guarda `prazoOriginal` = o `de` do primeiro adiamento).
- **Carga de amanhã** `dxmAmanha` (75-81): `carga = metaContatos de amanhã + atrasoContatos` (atraso = ceil((atraso+falta) ÷ janela)); `cap` = capacidade; `cabe` se carga ≤ cap, `sobrecarga` se maior, `sem_cap` quando não há capacidade (e então NÃO afirma).
- **Recorrência** `dxmRecorrencia` (67-72): conta quantos relatórios anteriores seguidos, do mais recente para trás, trazem a mesma chave; guarda a última decisão/encaminhamento registrada.
- **Alertas** (141-170), nível base e ajustes:
  - `dia:<etapa>:<pessoa>`: feito < 90% do alvo. Nível 1; 2 se feito = 0; +1 se há padrão recorrente naquela etapa; teto 3. Tipo vira `diagnostico` se for padrão.
  - `viab:<pessoa>`: recuperação "inviável" (Plano do dia), risco nível 3.
  - `conv:<passagem>:<pessoa>`: quadrante `resultado`, primeiro gargalo de conversão, diagnóstico nível 2.
  - `padrao:<pessoa>`: padrão recorrente sem desvio hoje, nível 2. Se há desvio hoje, o padrão vira parte do alerta do dia (um alerta por pessoa).
  - `adiadas:<pessoa>`: tarefas atrasadas com ≥2 adiamentos, nível 2.
  - `sis:<passagem>`: mesma passagem de conversão abaixo da referência em pelo menos `max(2, ceil(nPessoas/2))` pessoas (`pdmSistemico`), "possível causa sistêmica".
  - `noshow`: ≥2 reuniões que já passaram do horário e ≥30% no-show; nível 2 se ≥10 reuniões, senão 1, e a confiança diz "um dia, amostra pequena".
  - `mes:<origem>:<ind>`: sinais do Planejamento com gravidade ≥2 e origem meta/trajetória/demanda/capacidade, até 4; nível 3 se grav ≥3, senão 2.
  - `qtr:*`: avisos do quarter (marco atrasado, gatilho disparado, fechamento do mês pendente, próximo quarter sem plano, encerramento): gatilho = risco nível 2; os demais = desvio nível 1. `qtr:receita` quando a reprevisão do quarter < meta vigente: risco nível 2.
  - **Recorrência sobe nível**: se já apareceu em ≥1 relatório anterior, `nivel = min(3, nivel + 1)` quando `seguidos + 1 ≥ 3`, e escreve "Aparece pelo 3º relatório seguido (desde DD/MM). Recorrente: investigar a causa, não só cobrar o dia." e, se houve decisão, "Houve decisão registrada em DD/MM e o desvio continua".
  - Ordenação: nível decrescente, risco antes.
- **Resumo** (224-231): crítico se algum alerta nível ≥3; atenção se algum nível 2 ou alguma comparação `abaixo`; bom caso contrário; `sem_dado` sem pessoas. "Objetivos atingidos" = comparações com status `atingido` ÷ comparações com meta e dado. "Pessoas com atenção" = pessoas com situação diferente de em_dia/sem_meta (não conta fora do expediente).
- **O que deu certo**: comparações atingidas; pessoa com situação em_dia e cumprimento ≥100%; vendas fechadas do dia (soma em R$); e "desvio que aparecia ontem e sumiu depois de uma intervenção" (com a cautela "Um dia não prova a correção").
- **Avanços**: um por (etapa, negócio); SDR e closer aparecem juntos ("Ana e Pedro"); ordem vendas > oportunidades > visitas > realizadas > reuniões, depois por valor.
- **Recomendações** (187-209): cada alerta vira recomendação com problema, evidência, consequência, ação, responsável, prazo e indicador, ordenadas por gravidade (`viab` 4,5; conversão, padrão, sistêmico, no-show, quarter 3; tarefas adiadas e pendências de decisão 2; mês = nível + 1). Dedup por chave. Regras de seletividade: se a pessoa está dentro de uma causa sistêmica de atividade, vale a recomendação da equipe, não as individuais; **exceção**: "sem registro" sempre pede confirmação individual primeiro ("Confirmar com X o que foi feito e pedir o registro no CRM").
- **Metas do mês/quarter** (211-221): mês = realizado × meta × esperado até hoje (proporcional a dias úteis) × projeção ajustada (ritmo do ciclo + pipeline ponderado pela chance de cada etapa) → "faltariam R$ X no ritmo atual". Quarter: só com plano **publicado** ou encerrado (`dxQuarter`), meta vigente e original, projeção e projeção descontando iniciativas atrasadas. Sem meta de receita no plano ativo ou sem quarter publicado: vira "limitação", nunca valor inventado.
- **Limitações** (89-93, 124-125): plano em rascunho/inexistente, WhatsApp indisponível (SQL 60), avisos de integração, ninguém no plano, pessoas que não abriram o Plano do dia, reuniões já passadas sem resultado (não são contadas como "não realizadas").
- **Hash e complemento**: `dxRef` (86-91) calcula o hash sobre a essência `[comparações (k, período, previsto, realizado), alertas (chave, nível, contexto), pessoas (n, situação), pendências (id, classe)]`. Hash igual = `sem_mudanca`. `dxmDiferencas` (235-241) lista o que mudou ("Contatos da equipe hoje: 21/249 → 22/249", "alerta novo/saiu").
- Determinismo: mesma fotografia = mesmo relatório (teste compara o JSON inteiro).

### 4.9 Regras do Plano do dia que alimentam tudo (plano_dia_motor.js, só pelos testes)
- `pdmSemana`: objetivo da semana = meta dos dias úteis da semana + parcela do atraso; janela de recuperação (`janelaRecup`, padrão 5 dias úteis): com janela 5, todo o atraso entra; janela 10, entra metade. "Visitas 5 na semana + 3 de atraso = 8; feito 1; faltam 7 em 3 dias". Contatos são diários.
- `pdmViabilidade`: `ok` (cabe hoje), `janela` (40 + 100/5 = 60 ≤ cap 70), `ciclo` ((400+40+300)/11 ≈ 67,3 ≤ 70), `inviavel` → "Decisão gerencial"; `sem_cap` quando não há capacidade informada.
- `pdmCapacidade`: percentil 80 dos dias com atividade; ignora dias zerados; com menos de 5 dias ativos devolve null (9 dias → 84).
- `pdmPadrao`: 7 de 10 dias abaixo = recorrente (4 dias seguidos); com poucos dias não conclui.
- `pdmQuadrante`: em_dia / resultado (atividade ok, venda atrás) / operacional (atividade atrás) / ambos / sem_dado.
- `pdmGargalo`: compara passagens do funil contra plano, histórico e equipe, com intervalo de Wilson e confiança alta/baixa pela amostra. `pdmBeneficio`: cadeia de taxas (30 contatos × 10% = 3 reuniões × 60% = 1,8 realizadas).
- `pdmCenarios`: "executar" × "não executar" hoje (ex.: atraso 20, meta 40, alvo 44, feito 14: executando, amanhã +4; não executando, atraso 46 e +10 amanhã; na última janela, tudo cai em amanhã e estoura a capacidade).
- `pdmNegligencia`: card parado por valor esperado e tipo de falha, não só idade. `pdmOrdenar`: classe, depois quem habilita mais, horário, valor.
- `esforco.js`: `esLinha` (saldo, progresso, status adiantado/em_dia/atras/sem_meta, tendência = feito × metaTotal ÷ metaAteHoje); coorte de conversão por canal (janela 90 dias terminando 30 dias atrás, amostra mínima 3, reunião só "inferida" não conta); origem dos leads com ticket e ciclo medianos.

---

## 5. O que os testes garantem

**contingencia.test.js** (motor): régua 100/90/75 com bordas (0,999=atenção, 0,9=atenção, 0,899=contingência, 0,75=contingência, 0,749=crítico); esforço 1,2/1,5/2; config inválida ignorada; placar do exemplo (falta 250.000, 25.000/dia, fator 1,67, 3 motivos, nível 2); projeção a 50% = crítico; meta batida; ciclo sem dias úteis = crítico "não restam dias úteis"; sem meta = sem dado; projeção frágil ou com menos de 3 dias não conta; primeiro meio dia sem esperado = sem dado; trajetória (20/40/60/80/100; sábado entra na segunda; 65 faltam em 3 dias = 21,67/dia; alvo acumulado fecha em 100; meta batida = alvo 0; pesos 2/1/1/1/1 = 33,3 no 1º dia; ciclo vazio não quebra); pessoa (falta 100, 33,3/dia, atraso 50, alvo hoje 20+50/3, soma 110, nível crítico 57% e 25%; 2 seguidos = contingência com acumulado em dia; adiantado nunca negativo; sem meta e sem dias seguros); resumo por nível; ações (crítico, contingência, atenção = nenhuma, por pessoa, Dani em atenção não gera ação, todas `hip`).

**daily_motor.test.js** (relatório): status de comparação (10/10, 9/10, 5/10, null, meta 0); situações (em dia, falta, zero registros = sem registro e não "não executou", terceiro = bloqueio, resultado, fora do expediente); pendências (6 classes); amanhã (sobrecarga 55>40, cabe 55≤60, sem_cap); dia com Ana e Pedro (contatos da equipe 30+20 previstos × 32+8 realizados = 40/50 abaixo; reuniões só por semana; rótulos "da/pela equipe"; origem em toda comparação; venda de R$ 25.000 em "deu certo"; roteiro completo em "deu errado"; reunião sem resultado fica como limitação e `agenda.realizado===1`; no-show 1 de 3 = "sinal a investigar"; inviável = risco nível 3 e primeira recomendação; recomendações com 7 campos; meta nunca alterada, só encaminhada ao Planejamento; pendências com prazo original; quarter publicado em risco com projeção com/sem atrasos; avisos do quarter viram alertas e recomendações com a fase certa; marco que continua atrasado sobe de nível por recorrência; resumo; amanhã de Pedro em sobrecarga; todo item tem tipo); determinismo; recorrência (2 relatórios anteriores = "3º relatório seguido", nível sobe, cita a decisão de 21/10, vira conversa de causa; desvio que some depois da intervenção aparece em "deu certo" com "Um dia não prova"; histórico do próprio dia/futuro é ignorado); seletividade (padrão 8 de 10 num alerta só; padrão sem desvio hoje continua alerta próprio; causa sistêmica substitui as individuais, exceto "sem registro"); incompletos (rascunho, WhatsApp, aviso de integração, plano não aberto, confiança baixa, pede confirmação); `diferencas` (40/50 → 54/50, alerta que saiu, nada mudou = vazio).

**daily_nucleo.test.js** (núcleo do Worker com `daily/base.json`: 3 pessoas, ciclo outubro/2026, meta R$ 300.000 e 12 vendas): fuso (processo em UTC = processo em São Paulo, inclusive 23:50 e um contato às 23:40 da véspera que fica de fora); menos de 3 s; sexta é expediente, sábado não; **contatos de hoje: 18 + 0 + 3 = 21 contra 249 previstos**; agenda 3 no horário e 1 realizada; tarefas 2 com prazo hoje, 1 concluída; Eduardo "sem registro", Ana "bloqueio" (conta de luz), Pedro "falta de execução"; avanços (venda de R$ 31.000 primeiro, um por negócio/etapa, SDR e closer juntos); pendências (t3 sem validade, t2 decisão com prazo original 16/10, t5 terceiro, t1 reagendar); meta do mês em risco (R$ 31.000 de R$ 300.000); `ref` com corte, negócios=6 e hash; quarter ausente/publicado/em risco, marco vencido, gatilho nível 2 sem duplicar a projeção; mesmo resultado em UTC e no relógio do navegador; recorrência com decisão de 22/10 leva Eduardo a nível 3 e muda o hash.

**daily_worker.test.js** (banco simulado): `agoraLocal` (20:30 UTC = 17:30 SP); `decidir` (17:15 nada, 17:30 gera, horário configurável, desligado, já existe antes de 23:30 nada, 23:30 complementa uma vez, em andamento/sem expediente nada, para após 4 falhas: com 3 ainda tenta, com 4 não); dia completo (17:15 nem carrega tabelas; 17:30 gera e grava; resumo, comparações e `ref` presentes; WhatsApp indisponível vira limitação; execução registra duração e nº de pessoas; o `Date` global não é trocado; 17:45 não gera de novo; "Gerar de novo" sem mudança = `sem_mudanca` com original intacto; 23:30 sem mudança = `sem_mudanca` mas registrado como complemento; 23:45 não repete); registro atrasado (cadência criada às 18:10 vira `complemento` com "Contatos da equipe hoje: 21/249 → 22/249", Eduardo deixa de ser "sem registro", original preservado); falha (tarefas fora do ar: `falhou` com erro gravado, nenhum relatório parcial, o tique seguinte recupera; persistente para em 4); sábado (`sem_expediente`, não tenta de novo); execução simultânea (uma `ok`, outra `ignorado`, um relatório só); "Gerar agora" (vendedor 403; gestor gera antes das 17:30 com o nome dele e origem manual; só POST).

**plano_dia.test.js**: ver 4.9 (todos os valores acima vêm daqui). **metas_dia.test.js**: soma exata para T≤60 e du≤23; 22/5 = 4,4,5,4,5; 3 em 20 dias = zeros e uns; 12,6 arredonda para 13; maior resto. **esforco.test.js**: esLinha (meta 100/esperado 40/feito 30: saldo 70, 30%, atrás, tendência 75), coorte, origens.

**sql/plano_dia.sql** (banco real): foto da manhã (`pd_foto_servidor`): alvo 16 = 10 + 6 de recuperação com janela 1, e **nunca é sobrescrita**; fechamento de ontem (`pd_fechamento_servidor`) grava 4 de 10 contatos; vendedor registra o próprio plano uma vez (o segundo não sobrescreve) e só o próprio; justificativa mínima e no máximo 7 dias para trás; RLS (vendedor só lê as próprias linhas; gravar direto é negado); fechamento "do CRM" não regrava, a revisão (9) fica em `revisoes` e o oficial continua 7; gestor lê tudo.

**ui/daily.mjs** (navegador, relógio fixo 23/10/2026 17:40): prévia ao vivo antes de gravar; "Gerar agora" grava; 10 seções na ordem; 249 previstos e 21 feitos; situações das 3 pessoas; venda de R$ 31.000; pendências classificadas; meta do mês em risco; decisão "encaminhada" cria tarefa real com origem `daily`; "analisada"; reagendar abre o adiamento com justificativa e a tarefa fica com o motivo; repetir não duplica, mudança vira complemento (1) e repetir de novo não cria outro; histórico clicável; configuração de horário (18:15) gravada com histórico; a prévia não mexe no filtro de funis do Plano do dia; celular 390 px sem rolagem lateral; sem erro de console.

**ui/contingencia.mjs**: cabeçalho com "último dia 05/11/2026"; rótulos específicos (nunca genéricos); base (R$ 31.000 de 300.000) = Crítico; 1ª ação = "Decidir sobre a meta do ciclo"; "Hipótese de melhoria"; calendário com ≥18 dias úteis, hoje destacado, último 05/11; matriz com feito/meta, hoje e futuro, troca de etapa; foto gravada em `lab:prev.conting[hoje]` com nível, placar e alvo por vendedor; reabrir sem mudança não regrava; foto de 22/10 não é regravada; limites inválidos recusados; limite 80% salvo com histórico e refletido no texto; "voltar ao padrão"; bloco no Plano do dia da pessoa; o relatório das 17h30 guarda a foto (`nivel 3`, `fim 2026-11-05`, meta 300000, sem campo `em`).

**ui/plano_dia_esforco.mjs**: seção "Esforço planejado × realizado" (esperado, tendência), realizado de contatos editável pelo administrador (2 → 3 → 10 → 1 → 2, com "lançado pelo administrador" e retorno ao valor do CRM), "registros" abre os 2 que sustentam o número, compromissos marcáveis, contatos por contexto, conversão por canal "referência histórica, não meta". **ui/plano_dia_semana_ciclo.mjs**: a semana respeita o ciclo (ciclo começando no dia 6: semana atual 06/10 a 11/10, só 1 venda conta; ciclo no dia 5: 05/10 a 11/10, 2 vendas; sem recuperação de atraso do ciclo anterior; navegação ‹ por trechos; ao vivo R$ 21.000/1 venda e R$ 39.000/2 vendas).

---

## 6. Comparação com o V2 atual

Base: `packages/planejamento/src/ritmo.ts` (54 linhas), `consultas.ts` (`ritmo`, `fechamento`), `calendario.ts`, aba "Fechamento" da `tela.ts` (que, na verdade, é "Fechamento do ciclo"), rota `GET .../fechamento-do-dia`.

| Tema | V1 | V2 hoje | Veredito |
|---|---|---|---|
| Esperado até hoje | `meta × lpFrac`; hoje conta meio dia; pesos por semana; ausência por pessoa; corte de vigência (replanejar); taxas não se dividem | `meta × (dias úteis ≤ hoje ÷ total)`; hoje conta **inteiro**; sem pesos, sem ausências, sem replanejar | Raso. Meio dia vs. dia inteiro faz o V2 mostrar "atrás" durante o dia. Sem pesos o ciclo com semana de campanha/feriado prolongado fica errado |
| Faixas de status | 4 níveis (100/90/75), 3 critérios (ritmo, projeção ajustada, esforço) | 3 faixas (100/85), só ritmo | Raso. Falta o nível "contingência" (ativa plano) vs. "crítico" (exige decisão), e a faixa é fixa, não configurável com histórico |
| Contingência | Necessário/dia = falta ÷ dias restantes; fator contra o **ritmo médio real do ciclo**; vira nível e motivo em texto; gatilhos de ação; alvo por pessoa e por dia | `ceil(falta ÷ restantes)`; viável se fator ≤ 1,5× contra a **meta diária planejada** (meta ÷ total) | Raso. Compara com o plano, não com o que o time de fato produz; um único limiar; sem projeção, sem tela própria, sem ações, sem matriz pessoa × dia, sem trajetória acumulada |
| Distribuição da meta diária | inteiros que somam exatamente a meta (floor-diff), por canal pelo maior resto | `ceil(meta ÷ dias)` por dia (a soma passa da meta) | Raso e inconsistente (22 em 5 dias dá 5×5 = 25) |
| Recuperação de atraso | atraso diluído em janela configurável (padrão 5 dias úteis); alvo de hoje = meta + parcela; "Executar × Não executar" | Só `planoAmanha` (necessário/dia a partir de amanhã) | Quase inexistente |
| Fechamento do dia | Relatório estruturado, gravado, imutável, com complementos, decisões, recorrência | `fechamento()` = 3-4 frases de texto calculadas **na hora** a cada GET; não grava | Rótulo igual, produto diferente. Não existe como "documento do dia": se corrigirem um dado hoje, o "fechamento de ontem" muda sem rastro |
| Geração automática | Worker às 17h30 + retentativas + complemento às 23h30 + trava anti-duplicidade + auditoria + sino | Cron de 15 min existe (`wrangler.toml`), mas só sincroniza conectores; nada gera ou grava fechamento | Não existe |
| Tabelas | `lab_daily`, `lab_daily_exec`, config do horário/fuso | Nenhuma | Não existe |
| Previsto × realizado | Contatos por dia, demais etapas por semana; origem do dado em cada linha; tarefas; agenda | Meta do ciclo, esperado e realizado no ciclo, meta/realizado do dia por pessoa × indicador | Parcial. Cobre o essencial de "pessoa × indicador", sem semana, sem tarefas/agenda |
| Diagnóstico por pessoa | 6 situações (sem registro ≠ não executou, bloqueio, falta, resultado, fora do expediente...) | Apenas status de ritmo | Não existe |
| Alertas e recomendações | ~10 famílias de alerta, nível, confiança, causa, impacto; recomendações com consequência/ação/responsável/prazo/indicador | Nenhum | Não existe |
| Recorrência / memória de decisão | 3 relatórios seguidos sobe nível; decisão registrada e acompanhada; "resolvido após intervenção" | Nenhuma (V2 tem `decisao` no modelo, mas não ligada ao dia) | Não existe |
| Pendências / tarefas / agenda / no-show | Sim | V2 não tem tarefas nem agenda (tem `atividade` com tipo no_show) | Não existe |
| Causa sistêmica | Sim | Não | Não existe |
| Quarter e mês no relatório | Sim, com projeção e premissas | Quarter existe em outro pacote (`ciclos`), mas não conversa com o dia | Parcial/desconectado |
| Foto diária da contingência | Em `lab:prev:<ciclo>.conting` (e no relatório) | Não | Não existe |
| Plano do dia da pessoa (alvo de hoje, viabilidade, capacidade, cenários) | Sim | Resumo do V2 diz que não existe | Não existe |
| Calendário | Dias da semana + feriados editáveis + ausências por pessoa + pesos | Feriados BR automáticos (bom: inclui móveis) + dias da semana; sem ausências, sem pesos | Parcial. Ponto forte do V2: cálculo de feriados móveis. Falta ausência individual |
| Fuso | Relógio do fuso injetado no núcleo; teste de equivalência UTC × São Paulo | `hojeNoFuso` e SQL com `at time zone op.fuso` | Coberto no caso básico (e a base de dados está no fuso certo) |
| Permissão | Só gestão lê; vendedor 403 | Existe login Supabase Auth; não vi papel específico para o fechamento | A verificar |

Pontos onde o V2 já é melhor que o V1: modelo canônico limpo (eventos de atividade, transição de etapa como fonte, nada de JSON solto), feriados móveis por fórmula, multi-operação e fuso por operação, métricas com intervalo de Wilson em outro pacote. A base dá para construir o Jarvis; o que falta aqui é a camada de julgamento sobre ela.

---

## 7. O que isso entrega que uma planilha não entrega

1. **Memória congelada**: o relatório de ontem é o que o sistema disse ontem. Em planilha, corrigir uma célula reescreve a história. Aqui o original fica, cada recálculo vira complemento com "o que mudou".
2. **Rotina que roda sozinha**, com auditoria (quem, quando, quanto tempo, falha), retentativa e aviso "o fechamento de hoje não saiu". Planilha depende de alguém lembrar.
3. **Julgamento com honestidade**: "sem registro" não é "não executou"; um dia não é padrão; amostra pequena é rotulada; sem plano/sem quarter vira limitação em vez de número inventado.
4. **Recorrência e acompanhamento da decisão**: o mesmo problema pela 3ª vez sobe de nível, e a decisão do gestor é cobrada nos relatórios seguintes ("houve decisão em 22/10 e o desvio continua"). Isso fecha o ciclo de gestão (decidir, medir se funcionou), algo que planilha não faz.
5. **Separação atividade × resultado** e causa individual × sistêmica: evita cobrar volume de quem tem conversão ruim, e cobrar pessoa por problema de lead/oferta.
6. **Meta de recuperação viva**: alvo por vendedor por dia, que fecha exatamente a meta, com pesos de calendário, ausências e janela; mais "executar × não executar hoje" e checagem de capacidade ("a carga de amanhã não cabe").
7. **Encaminhar vira tarefa de verdade** com origem rastreável; reagendar mantém o prazo original.
8. **Ligação estratégia → dia**: o desvio do dia aparece ao lado do impacto na meta do mês e do quarter, e a recomendação estratégica vai ao Planejamento sem alterar meta sozinha.
9. **Reprodutibilidade**: mesma foto, mesmo relatório; teste prova equivalência entre servidor e navegador.

---

## 8. Riscos e armadilhas ao portar para o V2

1. **Fonte única de realizado**. O V1 só presta porque o "feito" vem de uma função única (`evDaPessoa`, "fonte única de eventos"). No V2, `realizados()` em `consultas.ts` já é um bom ponto único; qualquer comparação (dia, semana, ciclo, quem está atrás) deve sair dele. Duas contas diferentes = duas verdades (o V1 teve esse bug com vendas contadas do corte e corrigiu em 20/10).
2. **"Hoje conta meio dia"** no esperado: sem isso, relatório antes do fim do expediente sempre acusa atraso. Decidir explicitamente se o fechamento oficial (17h30) usa dia inteiro ou proporcional e documentar. O V1 usa 0,5 para a régua e o Plano do dia usa o alvo diário para o dia.
3. **Dias úteis individuais**: ausência/férias da pessoa muda o esperado e o alvo diário. Faltando isso no V2, a contingência por pessoa é injusta. Precisa de tabela de ausência por pessoa.
4. **Pesos do calendário e corte (replanejar)**: o V1 trata meta replanejada a partir de uma data (vendas antes do corte somam no mês; atividade só da vigência). Se o V2 permitir ajuste de meta no meio do ciclo (a meta é só-acréscimo no V2, o que ajuda: dá para derivar vigência da data de cada linha), a fórmula do esperado precisa saber disso.
5. **Fuso**: o Worker roda em UTC. O V1 injeta relógio e testa 23:40 da véspera e 23:50. No V2, usar sempre `op.fuso` na SQL e em "hoje"; criar teste dos mesmos casos de borda (evento às 23:40, geração às 23:50).
6. **Idempotência e concorrência**: dois tiques/cliques simultâneos não podem gerar dois relatórios; execução presa precisa expirar (10 min no V1); limite de tentativas (4); complemento às 23h30. Reproduzir a trava (advisory lock) e a tabela de execuções.
7. **Imutabilidade**: guardar `original` e tratar recálculo por hash; o hash do V1 cobre só a essência (comparações, alertas, pessoas, pendências), senão qualquer ruído gera complemento. Cuidado: a recorrência faz o hash mudar (testado), o que é intencional.
8. **Limiar de recorrência e `dxmRecorrencia`**: a ordem do histórico e ignorar o dia atual/futuro são essenciais (teste). Gaps (dia sem expediente) não podem quebrar a sequência; o V1 só olha os relatórios gravados, então fim de semana não conta.
9. **"Sem dado" ≠ 0**: se a ingestão do V2 (conectores) cair, o relatório precisa dizer que faltou fonte (equivalente ao aviso do WhatsApp). Sem essa disciplina o Jarvis acusa vendedor por falha do conector.
10. **Não duplicar cálculo do Plano do dia**: o relatório do V1 é uma "fotografia" de funções que já existem (alvo de hoje, viabilidade, capacidade, padrão, gargalo, quadrante). Portar só o relatório sem o Plano do dia obriga a recriar essas funções; o caminho é portar `pdmSemana/pdmViabilidade/pdmCapacidade/pdmPadrao/pdmQuadrante/pdmGargalo` como pacote puro no V2 primeiro.
11. **Thresholds configuráveis e versionados**: `CTM_VERSAO`/`DXM_VERSAO` gravados em cada foto/relatório; mudar regra sem mudar versão quebra a comparabilidade histórica. Mudança de limiar pelo gestor precisa de histórico (o V1 grava `contingHist`/`dailyHist`).
12. **Validação de limiares**: a ordem `crítico < contingência ≤ 100%` precisa ser garantida (o V1 recusa); senão níveis se invertem.
13. **Texto como produto**: muito do valor do V1 está nos rótulos que dizem de quem é o número ("Receita fechada no ciclo da Amicta", "Contatos da equipe hoje") e em testes que exigem isso. Copiar a lógica sem a disciplina de rótulo recria o problema de números ambíguos.
14. **Escopo de lançamento realista**: o V1 vive de dados que o V2 ainda não modela (tarefas, agenda/reuniões com status, adiamentos com justificativa, negligência de cards, capacidade apontada, abertura do Plano do dia). Portar por camadas: (a) esperado correto + 4 níveis + contingência pessoa × dia; (b) Fechamento persistido, Worker às 17h30 e auditoria; (c) alertas de atividade/recorrência/decisão; (d) pendências e agenda só quando houver o modelo.
15. **Pontos frágeis do próprio V1 a não herdar**: `dxmComparar` tem ramo redundante (`sem_meta`/`sem_meta`); a foto da contingência só é gravada por quem tem `lpAdmin` abrindo o CRM (no V2, gravar no servidor); `ctmAcoes` usa texto "N× o ritmo médio" mas se o ritmo atual for 0 o fator vira null e a ação por esforço some; metas por pessoa em `contagem de dias` usam `D.padrao.seguidos` vindo de outro módulo sem contrato explícito; o "sem expediente" é decidido por nenhuma pessoa trabalhar (um dia só de feriado local de uma pessoa não bloqueia a geração).
