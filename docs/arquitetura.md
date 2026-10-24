# Arquitetura do LAB V2

## Objetivo

Ser o "Jarvis" de um profissional de receita: um sistema determinístico (sem IA) que mostra, para qualquer operação, o que está funcionando e o que não está no funil borboleta inteiro, e avisa quando um indicador não bate. Usuário único: o Bruno.

## Camadas

1. **Conectores** (`packages/conectores/src/fontes/`): trazem dados de uma fonte e os traduzem para comandos canônicos. Nunca escrevem no banco.
2. **Comandos canônicos** (`packages/nucleo/src/comandos.ts`): 11 comandos validados (zod). Apontam para as coisas pelo id da fonte (`ref`), nunca por id interno.
3. **Aplicador** (`packages/conectores/src/aplicador.ts`): o único código que grava dados de negócio. Resolve `ref` → id interno pela tabela `lab.vinculo`.
4. **Modelo canônico** (`supabase/migrations/`): Postgres, schema `lab`, tudo separado por `operacao_id`.
5. **Métricas, motores e telas**: próximas fases (ver `roteiro.md`). Vão ler só o modelo canônico.

## Pack e operação

- **Pack** (`packs/*.json`): o que é específico de um modelo de negócio. Inclui etapas e o papel canônico de cada uma, atividades de esforço, canais, motivos de perda, linhas de precificação, condições de pagamento, calendário, CS e parâmetros. Tem herança (`"herda": "base"`).
- **Operação**: um pack mais os ajustes daquela empresa. Ao criar a operação, o pack é "instalado" em tabelas (`lab.funil`, `lab.etapa`, `lab.tipo_atividade`, `lab.canal`…). Reaplicar o pack nunca apaga nada: o que saiu fica inativo, e o histórico continua apontando para as mesmas etapas.

## Papéis canônicos (a chave da portabilidade)

Cada etapa de cada operação tem um papel. As métricas só falam de papéis:

- **Aquisição:** `lead → contato → qualificado → agendada → realizada → oportunidade → proposta → negociacao → ganho | perdido`
- **Pós-venda:** `onboarding → ativo → renovacao → expansao → churn`
- **`intermediaria`:** etapa própria da operação sem equivalente (ex.: visita técnica na solar).

Com isso, "taxa de agendamento" é calculada do mesmo jeito para a solar e para a licitação, mesmo que as etapas tenham nomes diferentes.

## Modelo de dados

| Grupo | Tabelas |
|---|---|
| Operação e catálogos | `operacao`, `funil`, `etapa`, `tipo_atividade`, `canal`, `motivo_perda`, `condicao_pagamento` |
| Pessoas e clientes | `pessoa` (por id, com função SDR/closer/ambos/CS), `conta` |
| Aquisição | `negocio` (tipo: novo, expansão, renovação, revenda, cross-sell), `negocio_transicao` (histórico de etapas, só acréscimo) |
| Esforço | `atividade` (tipo, pessoa, quando, quantidade) |
| Marketing | `investimento_canal` (por canal e mês: valor, impressões, cliques, leads) |
| Precificação | `politica_preco` (versionada, só acréscimo), `preco_negocio` (referência, aprovado, fechado, com custos informados) |
| Pós-venda | `recebimento` (quanto entrou, quando, status), `contrato` (recorrente ou não, renovação, cancelamento), `evento_cs` (onboarding, saúde, NPS, risco, renovação, expansão, cancelamento, indicação) |
| Integração | `conector`, `vinculo`, `entrada_bruta`, `execucao` |

**Fora de escopo, de propósito:** contas a pagar, caixa da empresa, obras, OS, compras. O recebimento por venda e por cliente basta para medir eficiência, retenção e LTV sem virar um ERP.

## Regras que valem para tudo

1. **Uma fonte por número.** Cada indicador terá uma única função dona, calculada no servidor. Na V1, o mesmo número era calculado em vários lugares (realizado em 3, ticket em 3, meta em 4).
2. **Pessoas por id, nunca por nome.** Renomear alguém não quebra o histórico.
3. **"—" não é zero.** Ausência de dado é mostrada como ausência.
4. **O passado não se reescreve.** Histórico de etapas e política de preço só aceitam acréscimo (gatilho no banco).
5. **Nada se perde na entrada.** Tudo o que chega fica em `entrada_bruta` antes de ser traduzido. Se a tradução falha (etapa não mapeada, negócio que ainda não chegou), a entrada fica como `erro` e é reprocessada depois.
6. **Idempotência.** A mesma entrada chegando duas vezes não conta duas vezes (`chave_idem`, `vinculo`).
7. **Dado velho não sobrescreve dado novo** (`negocio.fonte_atualizado_em`).
8. **Mudança de etapa nunca some.** Se a fonte não manda o evento, o aplicador registra uma transição "inferida".
9. **Dados pessoais mínimos.** Conectores não gravam telefone, e-mail ou endereço de cliente. O conector Amicta usa um hash do telefone só para juntar negócios do mesmo cliente.
10. **Tarefas automáticas no servidor.** Nada depende de alguém estar com a tela aberta: o cron do Worker roda a cada 15 minutos.

## Segurança

- O navegador nunca acessa o banco. RLS ligada sem políticas; só a API (Worker) conecta.
- Rotas `/admin/*` exigem `ADMIN_TOKEN`.
- Webhooks em `/entrada/<conector>`: cada conector confere a própria assinatura ou chave (HMAC no Amicta, Bearer no canônico).
- Segredos ficam nas variáveis do Worker. O banco guarda só o nome da variável (`segredo_ref`), e conectores não alcançam `ADMIN_TOKEN` nem `DATABASE_URL`.

## Stack

- **Linguagem:** TypeScript em monorepo (npm workspaces).
- **API:** Cloudflare Workers.
- **Banco:** Supabase (Postgres), via Hyperdrive ou conexão direta.
- **Testes:** vitest, com testes de integração contra um Postgres real, usando as mesmas opções de conexão de produção.
- **Telas** (próximas fases): front-end novo, a definir na fase de interface.
