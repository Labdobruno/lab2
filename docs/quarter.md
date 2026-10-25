# Onda 3: o quarter de verdade e as metas históricas

Fonte da V1: `lab_quarter.js`, `lab_objetivos.js` (consistência, cenários por premissa, replanejamento, programa) e `lab_metas.js` (D16–D20). Os testes da V1 (`lab_quarter.test.js`, `lab_objetivos.test.js`, `lab_metas.test.js`) são o contrato dos motores puros em `packages/estrategia/src/{quarter,plano_ciclo,metas_historicas}.ts`; a montagem com os dados da V2 fica em `*_consultas.ts` e `medidas.ts`.

## Onde está

| Tela (menu **Mais**) | Pergunta | API |
|---|---|---|
| **Quarter** | uma fase por vez: Visão · 1 Revisão · 2 Prioridades · 3 Objetivo · 4 Iniciativas · 5 Meses · 6 Publicar | `GET/POST …/estrategia`, `POST …/estrategia/publicar · metas · fechar-mes · encerrar · aprendizado`, `GET …/estrategia/historico · marcos` |
| **Metas históricas** | "Quanto o ano precisa e quanto já veio?" + a meta oficial de cada ciclo | `GET …/metas-historicas · /ano · /intervalo`, `POST …/metas-historicas/registrar · revisar`, `GET/POST …/plano-ciclo` |
| **Dia** | os entregáveis do quarter (atrasados e dos próximos 7 dias) da pessoa aparecem no plano do dia | campo `quarter` em `GET …/dia` |

## As regras, em português

**Revisão do quarter anterior.** A meta de cada mês é a meta oficial do ciclo (abaixo): receita e vendas somam entre meses só quando os três são conhecidos (senão "sem meta do quarter", nunca soma parcial); original × final ficam separadas quando houve replanejamento. Volumes vêm dos realizados, taxas da coorte dos negócios criados no período (k e n), ticket das vendas, margem do relatório. Tendência contra o quarter anterior: ±5% é estável em volume, ±2 p.p. em taxa, e taxa com amostra abaixo do mínimo não conclui. Indicador sem dado vira lacuna explicada, nunca zero. Iniciativas do quarter anterior são avaliadas em execução × hipótese (funcionou, sem resultado, mal executada, resultado sem execução, sem marcos, sem dado) e geram perguntas só onde há lacuna de interpretação; as respostas ficam no plano.

**Diagnóstico.** Só o que move a receita: demanda, conversão por etapa, ticket, margem, ciclo comercial, capacidade, perdas por preço/condição, dependência de canal e confiabilidade dos dados. "Comprovado" exige amostra mínima nos dois períodos e intervalos de Wilson (95%) sem sobreposição; senão é hipótese. Cada item leva o impacto em R$ com as premissas escritas. Itens comprovados ou hipótese viram sugestões de prioridade; o gestor aceita, modifica, rejeita ou cria a própria. Pontuação explicável (9 critérios, 1–3), ordem manual por cima, aviso de foco (3 a 5).

**Objetivo e metas.** Meta × cenários por premissa: a base é o que já entrou + pipeline em oportunidade/proposta/negociação × conversão + leads que ainda vêm × cadeia × "cabem no prazo"; o conservador e o otimista alteram premissas nomeadas (padrão do LAB até a operação ajustar). A leitura diz em que cenário a meta cabe e o que ela exige na parte nova; **a meta nunca é reduzida pelo LAB**. Resultados-chave com campos obrigatórios (indicador, partida, meta, responsável, critério, frequência) e aviso sem indicador antecedente.

**Iniciativas.** Nome que descreve uma intervenção (não "melhorar vendas"), prioridade ligada, responsável, problema, hipótese, variável, indicador com inicial → mínimo → alvo, critérios para continuar/corrigir/interromper e ao menos um marco. Quatro níveis acompanhados à parte: entregável, execução, hipótese, resultado (taxa com amostra pequena não valida nem atinge nada). Capacidade declarada (horas por pessoa descontada a rotina) × carga, com alternativas; sequência por dependências e tempo de implantação + ciclo de venda.

**Os três meses.** Meta sugerida pelos dias úteis; bottom-up de cada mês com a origem de cada taxa (histórico ou manual) e a defasagem do ciclo de venda; resultado esperado e critério de sucesso obrigatórios; gatilhos de decisão (não reagem a amostra pequena) e riscos com plano de resposta.

**Aprovação e publicação.** Bloqueios: objetivo, meta, prioridade sem iniciativa, iniciativa ou resultado-chave incompletos, mês sem resultado/critério, soma dos meses ≠ meta, sobrecarga declarada sem decisão. Avisos não bloqueiam. Publicar grava uma versão imutável (`lab.quarter_versao`); revisar exige motivo; o encerramento compara com a **v1**. Levar as metas dos meses para os ciclos é ação explícita do gestor: acrescenta a meta de receita em `lab.meta` (só acréscimo) e congela o programa (meta original de cada mês nunca muda; o que sobrou ou faltou passa aos meses seguintes como meta vigente).

**Acompanhamento.** Reprevisão (projeção pelo ritmo × meta vigente; "a meta não muda sozinha"), avisos com id estável (gatilho disparado, marco atrasado, projeção < 95% com 10+ dias úteis, fechamento do mês nos últimos 3 dias, próximo quarter sem plano a 15 dias, quarter anterior sem encerramento), resumo dos Fechamentos do dia no quarter (recorrências, dias com o quarter em risco), encadeamento objetivo → KR → problema → iniciativa → entregável → indicador → mês → observado. Fechamento do mês classifica cada marco (só "pendente e válido" e "replanejado" seguem). Encerramento só depois do último dia; sugere aprendizados estruturados (contexto, evidência, conclusão, confiança, implicação) que o gestor grava em `lab.aprendizado`.

## Metas históricas (D16–D20)

- **D16** replanejamento: `lab.plano_ciclo` guarda a foto **original** aprovada na ativação e cada versão substituída (corte + motivo + metas que valiam até ali); as metas novas entram em `lab.meta` por acréscimo; a referência consolidada é a última versão.
- **D17** ciclo passado sem plano ativo e sem evidência = **desconhecida** (nunca zero, nunca a meta de hoje); fica fora do atingimento. Evidências aceitas: observação diária da rotina (`lab.meta_ciclo_obs`), metas cadastradas **durante** o ciclo (a tabela só de acréscimo prova a época) e a meta gravada no Fechamento do dia (`ref.meta`).
- **D18** ano: meta final dos ciclos, meta acumulada até hoje, realizado e projeção pelo ritmo dos dias úteis, separados; projeção só depois de 10% do ano.
- **D19** registro no encerramento (`lab.meta_ciclo_registro`, r1) imutável e idempotente, feito pela rotina de 15 min ou ao fechar o plano; correção = revisão (rN) com justificativa; estimativa fica à parte e não substitui o desconhecido.
- **D20** ciclos anteriores a `pack.parametros.analisarDesde` ficam fora (nem meta, nem pesos, nem projeção).

## Testes

`packages/estrategia/test/{quarter,plano_ciclo,metas_historicas}.test.ts` (52 verificações espelhadas da V1) e `banco.test.ts` (plano do ciclo, metas históricas, rotina, quarter ponta a ponta no Postgres local).
