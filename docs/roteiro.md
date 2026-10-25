# Roteiro de construção

Aprovado pelo Bruno até a fase 8 (segunda operação).

| Fase | O que entrega | Vem da V1 |
|---|---|---|
| **1. Base e conectores** ✅ | Modelo canônico, packs com herança, conectores canônico, planilha e Amicta, API com cron | — |
| **2. Métricas** ✅ | Dicionário canônico no servidor (uma função por número), coortes e fluxo, Wilson e amostra mínima. Inclui:<br>• CPL, CAC, ROI e payback por canal, e MC por venda menos CAC;<br>• economia de cada venda: preço de referência → aprovado → fechado, desconto, linhas da precificação e MC;<br>• retenção: churn, receita retida, expansão e LTV | `LAB_MET`, `labDic`, `lpMed`, `lpCoorte`, `lbcConvElegivel` |
| **3. Planejamento e produtividade** ✅ | Para o time júnior:<br>• ciclo e calendário;<br>• metas numa tabela única, só de acréscimo;<br>• build-up reverso único, que desce de receita → vendas → oportunidades → reuniões → agendamentos → contatos → tentativas por pessoa, por canal e por dia;<br>• esperado até hoje e acumulado;<br>• quem está no ritmo e quem está atrás;<br>• contingência e plano do dia;<br>• Fechamento do dia gerado no servidor | `lpReverso`/`lpCadeia` (unificados), `lpo*`, `ctm*`, `dxm*`, `lmOficial` |
| **4. Telas novas** (1ª tela ✅) | Front-end novo: uma pergunta por tela e detalhe só quando pedido. A primeira tela é a produtividade do time | Conceito das trilhas (Passado, Mês, Futuro) |
| **5. Quarter e fechamento de ciclo** ✅ | Planejar o quarter em 6 fases, cenários, programa de ciclos, retrato imutável do ciclo e aprendizados | `lq*`, `fr*`/`fi*`/`fd*`/`fa*`, `lpoPrograma` |
| **6. Motor de hipóteses e qualidade de dados** ✅ | Biblioteca declarativa por pack, com impacto em R$ escrito como fórmula e não como código. Também:<br>• achados com orçamento de atenção;<br>• canvas de decisão;<br>• experimentos e memória comercial;<br>• checagens de qualidade de dados | `labMotorAvaliar`, `LAB_BIB_CORE`, `labCondicao`, `lbv*` |
| **7. Studio** ✅ | Funis em grafo e campanhas de go-to-market, com o motor do construtor de hipóteses unificado ao do Studio | `gs*` (motor), `lbc*` |
| **8. Segunda operação** ✅ | Pack `licitacao-b2b` e conector da fonte que ela usar | — |

## Depois da fase 8: as ondas do mapa V1 × V2

| Onda | O que entrega | Vem da V1 |
|---|---|---|
| **1. Plano do dia e rituais** ✅ | Meta do dia inteira, recuperação distribuída, objetivos da semana, quadrante, viabilidade, negligência, cenários, padrão, gargalo, capacidade; três rituais com foto imutável; equipe para o gestor; ausências, lançamentos e capacidade. Corrige a meta diária (ceil) e o build-up (arredondamento por degrau) da V2. Ver `docs/dia.md` | `plano_dia_motor.js`, `plano_dia.js`, `producao.js`, `gestao.js`, `esforco.js` |
| **2. "Vamos bater a meta?" e a rotina** ✅ | Projeção do ciclo (4 projeções, chance de bater, fora da curva), sinais com classe do desvio e veredito, contingência (régua, trajetória, pessoa × dia), semana (relatório e projeção) e o Fechamento do dia gerado às 17h30 no servidor, imutável, com complementos, decisões e recorrência. Ver `docs/dia.md` | `lab_plan.js` (lpProjecoes, lpSinais), `lab.js` (labForecast), `contingencia_motor.js`, `daily_motor.js`, `worker/daily.mjs`, `lab_semana.js`, `lab_projsemana.js`, `lab_objetivos.js` |
| **3. O quarter de verdade** ✅ | Revisão automática do quarter anterior, diagnóstico com estado da evidência, prioridades explicáveis, meta × cenários por premissa (a meta nunca é reduzida), iniciativas com hipótese e marcos, três meses com bottom-up, aprovação com bloqueios, publicação com versões, programa original × vigente, reprevisão, avisos, fechamento do mês, encerramento e aprendizados; plano do ciclo com versões; metas históricas por ciclo (D16–D20). Ver `docs/quarter.md` | `lab_quarter.js`, `lab_objetivos.js`, `lab_metas.js` |
| **4. Economia da venda** ✅ | Política de preço versionada (deduções, condições, comissão por margem, custo do dinheiro, custos fixos), receita líquida e MC sobre a RL, preço recomendado e piso, alçada com exceção registrada, política congelada na venda, custo real lançado (sem contas a pagar) com previsto × real × efetiva, painel por vendedor/canal/condição/faixa, contribuição necessária e break-even do desconto. Ver `docs/economia.md` | `precEcon`, `margemVenda`, `comissaoDaMargem`, `financeiroDe` |
| **5. Studio e construtor** ✅ | Motor do Studio da V1 inteiro (8 tipos de bloco, retornos, capacidade e fila, defasagem, ~20 validações, cenários, direto e reverso com inteiros, sensibilidade, prontidão, monitor por coorte com Wilson e lei de Little, antes × depois); modelo em blocos guardado e publicado com validade; monitor planejado × realizado; premissas ao plano do quarter; construtor "E se…?" (frase em português, "mantendo", referências aos pares, quanto precisa, sensibilidade, perguntas guardadas, virar experimento). Ver `docs/studio.md` | `lab_studio_motor.js` (`gs*`), `lab_construtor.js` (`lbc*`) |

## Pendências

- **Amicta (quando o Bruno atualizar a API):** rotas de atividades por pessoa (ligações, contatos), agendamentos com status e, se possível, histórico de etapas por negócio e custo e margem por venda. O conector já tem o lugar para elas na sincronização.
- **Testes da V1:** os testes de `testes/lab_*.test.js` (enviados pelo Bruno) são a referência para os motores portados nas fases 2, 3 e 5. A V2 precisa calcular igual à V1 quando os dados forem os mesmos.
