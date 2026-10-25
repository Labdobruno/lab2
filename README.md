# LAB V2

Central de inteligência de receita do Bruno. Cobre o funil borboleta inteiro: geração de demanda, conversão, retenção, expansão e a eficiência financeira de tudo isso. O mesmo motor serve a qualquer operação; o que muda de um negócio para outro fica num **pack**.

> O LAB V2 é um projeto novo e independente. Ele **não altera nada** no CRM ou no LAB da Amicta: quando a Amicta entrar, entra como uma operação a mais, lida pela API pública do CRM, somente leitura.

## O que já existe (fases 1 a 8: base, conectores, métricas, planejamento, telas, quarter, hipóteses, Studio e a operação de licitação)

| Peça | O que faz | Onde |
|---|---|---|
| **Economia da venda (Onda 4)** | "Quanto sobra de cada venda?": política de preço versionada com deduções, condições de pagamento, comissão por margem e custo do dinheiro; receita líquida e MC sobre a RL (a % sobre o preço nomeada ao lado); preço recomendado e piso; alçada com exceção registrada e impacto na MC; política congelada na venda; custo real lançado e previsto × real × efetiva; painel por vendedor, canal, condição e faixa; contribuição necessária no mês; break-even do desconto | `packages/economia/`, `docs/economia.md`, `…/economia`, tela **Economia** |
| **O quarter de verdade e as metas históricas (Onda 3)** | Quarter em 6 fases, uma pergunta por fase: revisão do anterior, diagnóstico e prioridades, objetivo × cenários por premissa, iniciativas com hipótese e marcos, três meses com bottom-up, aprovação com bloqueios e publicação com versões; programa original × vigente, reprevisão, avisos, fechamento do mês, encerramento e aprendizados. Plano do ciclo com foto original e replanejamento com motivo; meta oficial de cada ciclo (conhecida, desconhecida, sem meta, estimada), registro imutável, ano | `packages/estrategia/`, `docs/quarter.md`, `…/estrategia`, `…/metas-historicas`, `…/plano-ciclo`, telas **Quarter** e **Metas históricas** |
| **Vamos bater a meta?, semana e Fechamento do dia (Onda 2)** | Projeção do ciclo (planejada, ritmo, histórica com pipeline × chance × prazo, ajustada) e chance de bater; negócios fora da curva; sinais com classe do desvio e veredito; contingência (régua 100/90/75, trajetória, alvo pessoa × dia, ações); semana passada (deu certo × errado, causas, roteiro) e esta semana (projeção, na mesa); Fechamento do dia gerado às 17h30 no servidor, imutável, com complementos, decisões do gestor e recorrência | `packages/dia/`, `docs/dia.md`, `…/dia/ciclo`, `…/dia/semana`, `…/dia/fechamento`, abas **Meta**, **Semana**, **Fechamento do dia** |
| **Plano do dia (Onda 1)** | "O que fazer hoje para o dia ser um sucesso?" por pessoa, lido em três rituais (manhã, tarde, fim do dia): meta do dia inteira + recuperação distribuída, objetivos da semana, situação, viabilidade frente à capacidade, negócios parados, ações com por quê / o que ganha / se não fizer, justificativas, fotos imutáveis de cada ritual e memória plano × executado. "Quem precisa de mim hoje?" para o gestor. Regras portadas da V1 com os testes dela | `packages/dia/`, `docs/dia.md`, `…/dia`, `…/dia/equipe`, aba **Dia** |
| Vocabulário canônico | Papéis de etapa da borboleta, tipos de atividade, canais, motivos de perda, CS | `packages/nucleo/src/papeis.ts` |
| Comandos canônicos | A única linguagem que entra no banco (11 comandos) | `packages/nucleo/src/comandos.ts` |
| Packs | O que é específico de cada modelo de negócio, escrito em JSON, com herança | `packs/`, `docs/packs.md` |
| Banco | Modelo canônico por operação, histórico de etapas só de acréscimo, entradas brutas guardadas para sempre | `supabase/migrations/` |
| Conectores | Webhook canônico (n8n, Make, scripts), planilha CSV e CRM Amicta v1 | `packages/conectores/src/fontes/` |
| API | Cloudflare Worker: entrada de webhooks, importação, sincronização, saúde, cron a cada 15 min | `apps/api/` |
| Studio (fase 7) | Funil em grafo (observado no histórico ou desenhado), simulação com as alavancas de maior retorno, funis versionados e campanhas de go-to-market com projeção, acompanhamento e fechamento plano × realizado; taxas e premissas na mesma linguagem de fórmulas das hipóteses | `packages/studio/`, `…/studio/observado`, `…/studio/simular`, `…/studio/funis`, `…/studio/campanhas` |
| Segunda operação (fase 8) | Pack `licitacao-b2b` (assessoria de licitação: ciclo longo, diagnóstico, honorário recorrente), planilhas de exemplo e tela de Operações (criar operação e importar CSV) | `packs/licitacao-b2b.json`, `docs/licitacao.md`, `docs/exemplos/licitacao/` |
| Hipóteses e qualidade de dados (fase 6) | Biblioteca de hipóteses por pack, com condição e impacto em R$ escritos como fórmula; achados com orçamento de atenção; canvas de decisão; experimentos que escrevem na memória comercial; 13 checagens de qualidade de dados | `packages/hipoteses/`, `packages/nucleo/src/hipoteses/`, `…/achados`, `…/qualidade`, `…/decisoes`, `…/experimentos` |
| Quarter e fechamento (fase 5) | Planejamento do quarter em 6 passos (diagnóstico, meta, cenários, esforço, programa de ciclos, compromisso), metas dos ciclos geradas ao travar, retrato imutável e assinado do ciclo e aprendizados | `packages/ciclos/`, `…/quarter`, `…/fechar-ciclo`, `…/retratos`, `…/aprendizados` |
| Telas (fase 4) | "O time está no ritmo?" (quem está no ritmo, atenção ou atrás, com o detalhe ao tocar numa pessoa) e "Equipe e metas" (cadastro da equipe e das metas do ciclo). Página única, sem dados, que lê a API com a chave de acesso | `apps/api/src/tela.ts`, `GET /app` |
| Planejamento (fase 3) | Ciclo e calendário (feriados BR), metas só de acréscimo, build-up reverso, ritmo, contingência, plano do dia e Fechamento do dia | `packages/planejamento/`, `GET /admin/operacoes/:slug/{ciclo,buildup,ritmo,fechamento-do-dia}`, `POST …/metas` |
| Métricas (fase 2) | Dicionário e funções puras: CPL, CAC, ROI, payback, MC, conversão por coorte (Wilson), fluxo, churn, retenção e LTV | `packages/metricas/`, `GET /admin/operacoes/:slug/metricas` |

Todas as fases do roteiro estão construídas. O que vem a seguir é uso real: cadastrar a equipe, importar dados e ajustar as fórmulas ao que os números mostrarem. A ordem de construção está em [`docs/roteiro.md`](docs/roteiro.md).

## Como as peças se encaixam

```
fonte (CRM, planilha, n8n)
   │  conector: traz os dados e traduz
   ▼
entrada bruta  ──►  comandos canônicos  ──►  aplicador  ──►  modelo canônico (Postgres)
(guardada para sempre,                        (único código que           │
 reprocessável)                                grava dados)               ▼
                                                              métricas → motores → telas  (próximas fases)
```

## Rodar no computador (para desenvolvimento)

Precisa de Node 22 e Postgres 16.

```bash
npm install
npm run db:local                       # sobe o Postgres local e aplica as migrations
DATABASE_URL=postgres://lab:lab@localhost:5432/lab_teste npm test
npm run typecheck
npm run pack:validar                   # confere todos os packs
```

Sem `DATABASE_URL`, os testes que precisam de banco são pulados e só os testes puros rodam.

## Documentação

- [`docs/dia.md`](docs/dia.md): o plano do dia e os três rituais (as regras em português).
- [`docs/mapa-v1-v2.md`](docs/mapa-v1-v2.md): o que a V1 faz, o que a V2 já cobre e a ordem das ondas.
- [`docs/arquitetura.md`](docs/arquitetura.md): camadas, modelo de dados e regras que valem para tudo.
- [`docs/packs.md`](docs/packs.md): como criar o pack de uma operação nova.
- [`docs/conectores.md`](docs/conectores.md): como cada conector funciona, as colunas das planilhas e como criar um conector novo.
- [`docs/implantacao.md`](docs/implantacao.md): passo a passo para subir nas suas contas (GitHub, Supabase, Cloudflare).
- [`docs/decisoes.md`](docs/decisoes.md): registro das decisões e do porquê de cada uma.
- [`docs/roteiro.md`](docs/roteiro.md): ordem de construção das próximas fases.
- [`docs/inventario-v1.md`](docs/inventario-v1.md): o que vem do LAB da Amicta, o que fica de fora e o que muda.
