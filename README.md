# LAB V2

Central de inteligência de receita do Bruno. Cobre o funil borboleta inteiro: geração de demanda, conversão, retenção, expansão e a eficiência financeira de tudo isso. O mesmo motor serve a qualquer operação; o que muda de um negócio para outro fica num **pack**.

> O LAB V2 é um projeto novo e independente. Ele **não altera nada** no CRM ou no LAB da Amicta: quando a Amicta entrar, entra como uma operação a mais, lida pela API pública do CRM, somente leitura.

## O que já existe (fase 1: base e conectores)

| Peça | O que faz | Onde |
|---|---|---|
| Vocabulário canônico | Papéis de etapa da borboleta, tipos de atividade, canais, motivos de perda, CS | `packages/nucleo/src/papeis.ts` |
| Comandos canônicos | A única linguagem que entra no banco (11 comandos) | `packages/nucleo/src/comandos.ts` |
| Packs | O que é específico de cada modelo de negócio, escrito em JSON, com herança | `packs/`, `docs/packs.md` |
| Banco | Modelo canônico por operação, histórico de etapas só de acréscimo, entradas brutas guardadas para sempre | `supabase/migrations/` |
| Conectores | Webhook canônico (n8n, Make, scripts), planilha CSV e CRM Amicta v1 | `packages/conectores/src/fontes/` |
| API | Cloudflare Worker: entrada de webhooks, importação, sincronização, saúde, cron a cada 15 min | `apps/api/` |

O que ainda **não** existe: métricas, planejamento, produtividade, telas. A ordem de construção está em [`docs/roteiro.md`](docs/roteiro.md).

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
