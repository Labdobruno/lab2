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
| **7. Studio** | Funis em grafo e campanhas de go-to-market, com o motor do construtor de hipóteses unificado ao do Studio | `gs*` (motor), `lbc*` |
| **8. Segunda operação** | Pack `licitacao-b2b` e conector da fonte que ela usar | — |

## Pendências

- **Amicta (quando o Bruno atualizar a API):** rotas de atividades por pessoa (ligações, contatos), agendamentos com status e, se possível, histórico de etapas por negócio e custo e margem por venda. O conector já tem o lugar para elas na sincronização.
- **Testes da V1:** os testes de `testes/lab_*.test.js` (enviados pelo Bruno) são a referência para os motores portados nas fases 2, 3 e 5. A V2 precisa calcular igual à V1 quando os dados forem os mesmos.
