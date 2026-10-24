# LAB V2

Central de inteligência de receita do Bruno. Cobre o funil borboleta inteiro: geração de demanda, conversão, retenção, expansão e a eficiência financeira de tudo isso. O mesmo motor serve a qualquer operação; o que muda de um negócio para outro fica num **pack**.

> O LAB V2 é um projeto novo e independente. Ele **não altera nada** no CRM ou no LAB da Amicta: quando a Amicta entrar, entra como uma operação a mais, lida pela API pública do CRM, somente leitura.

## O que já existe (fases 1 a 6 e 8: base, conectores, métricas, planejamento, quarter, hipóteses e a operação de licitação)

| Peça | O que faz | Onde |
|---|---|---|
| Vocabulário canônico | Papéis de etapa da borboleta, tipos de atividade, canais, motivos de perda, CS | `packages/nucleo/src/papeis.ts` |
| Comandos canônicos | A única linguagem que entra no banco (11 comandos) | `packages/nucleo/src/comandos.ts` |
| Packs | O que é específico de cada modelo de negócio, escrito em JSON, com herança | `packs/`, `docs/packs.md` |
| Banco | Modelo canônico por operação, histórico de etapas só de acréscimo, entradas brutas guardadas para sempre | `supabase/migrations/` |
| Conectores | Webhook canônico (n8n, Make, scripts), planilha CSV e CRM Amicta v1 | `packages/conectores/src/fontes/` |
| API | Cloudflare Worker: entrada de webhooks, importação, sincronização, saúde, cron a cada 15 min | `apps/api/` |
| Segunda operação (fase 8) | Pack `licitacao-b2b` (assessoria de licitação: ciclo longo, diagnóstico, honorário recorrente), planilhas de exemplo e tela de Operações (criar operação e importar CSV) | `packs/licitacao-b2b.json`, `docs/licitacao.md`, `docs/exemplos/licitacao/` |
| Hipóteses e qualidade de dados (fase 6) | Biblioteca de hipóteses por pack, com condição e impacto em R$ escritos como fórmula; achados com orçamento de atenção; canvas de decisão; experimentos que escrevem na memória comercial; 13 checagens de qualidade de dados | `packages/hipoteses/`, `packages/nucleo/src/hipoteses/`, `…/achados`, `…/qualidade`, `…/decisoes`, `…/experimentos` |
| Quarter e fechamento (fase 5) | Planejamento do quarter em 6 passos (diagnóstico, meta, cenários, esforço, programa de ciclos, compromisso), metas dos ciclos geradas ao travar, retrato imutável e assinado do ciclo e aprendizados | `packages/ciclos/`, `…/quarter`, `…/fechar-ciclo`, `…/retratos`, `…/aprendizados` |
| Telas (fase 4) | "O time está no ritmo?" (quem está no ritmo, atenção ou atrás, com o detalhe ao tocar numa pessoa) e "Equipe e metas" (cadastro da equipe e das metas do ciclo). Página única, sem dados, que lê a API com a chave de acesso | `apps/api/src/tela.ts`, `GET /app` |
| Planejamento (fase 3) | Ciclo e calendário (feriados BR), metas só de acréscimo, build-up reverso, ritmo, contingência, plano do dia e Fechamento do dia | `packages/planejamento/`, `GET /admin/operacoes/:slug/{ciclo,buildup,ritmo,fechamento-do-dia}`, `POST …/metas` |
| Métricas (fase 2) | Dicionário e funções puras: CPL, CAC, ROI, payback, MC, conversão por coorte (Wilson), fluxo, churn, retenção e LTV | `packages/metricas/`, `GET /admin/operacoes/:slug/metricas` |

O que ainda **não** existe: a fase 7 do roteiro (Studio: funis em grafo e campanhas). A ordem de construção está em [`docs/roteiro.md`](docs/roteiro.md).

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

- [`docs/arquitetura.md`](docs/arquitetura.md): camadas, modelo de dados e regras que valem para tudo.
- [`docs/packs.md`](docs/packs.md): como criar o pack de uma operação nova.
- [`docs/conectores.md`](docs/conectores.md): como cada conector funciona, as colunas das planilhas e como criar um conector novo.
- [`docs/implantacao.md`](docs/implantacao.md): passo a passo para subir nas suas contas (GitHub, Supabase, Cloudflare).
- [`docs/decisoes.md`](docs/decisoes.md): registro das decisões e do porquê de cada uma.
- [`docs/roteiro.md`](docs/roteiro.md): ordem de construção das próximas fases.
- [`docs/inventario-v1.md`](docs/inventario-v1.md): o que vem do LAB da Amicta, o que fica de fora e o que muda.
