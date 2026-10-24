# Conectores

Todo conector segue o mesmo contrato (`packages/conectores/src/tipos.ts`):

1. **Trazer**: `webhook` (a fonte avisa), `sincronizar` (o LAB busca) ou `importar` (arquivo).
2. **Traduzir**: `normalizar` transforma cada entrada bruta em comandos canônicos.

Quem grava é sempre o aplicador. Por isso um conector novo não pode corromper o banco: no máximo gera comandos inválidos, que ficam registrados como erro.

## Criar e usar um conector

```http
POST /admin/conectores
Authorization: Bearer <ADMIN_TOKEN>
{ "operacao": "amicta", "tipo": "amicta-crm-v1", "nome": "crm", "segredoRef": "AMICTA",
  "config": { "inicio": "2026-01-01" } }
```

- **`segredoRef`**: prefixo das variáveis de ambiente do Worker. Com `AMICTA`, o conector lê `AMICTA_CHAVE` e `AMICTA_WEBHOOK`.
- **`config.mapa`**: traduz chaves da fonte para as da operação. Vale para qualquer conector: `{ "etapas": { "qualificacao": "sql" }, "atividades": { "ligacao": "tentativa" }, "motivosPerda": { "Financiamento negado": "financiamento" } }`.
- **`GET /admin/conectores/<id>/saude`**: mostra as últimas execuções, as entradas por status, os erros recentes e o que o conector criou sozinho e você deve revisar (canal novo, motivo de perda novo).

## `canonico`: n8n, Make, Zapier, scripts

Recebe os comandos já no formato do LAB. É a porta para qualquer fonte sem conector próprio.

```http
POST /entrada/<id-do-conector>
Authorization: Bearer <valor da variável segredoRef>
{ "id": "lote-2026-10-24-01",
  "comandos": [
    { "tipo": "negocio.upsert", "ref": "L-1", "etapa": "agendada", "criadoEm": "2026-10-01", "canalRef": "outbound", "donoRef": "bruno" },
    { "tipo": "atividade.registrar", "ref": "lig-991", "atividade": "tentativa", "em": "2026-10-01T09:00:00Z", "pessoaRef": "bruno", "quantidade": 10 }
  ] }
```

O `id` do lote evita processar o mesmo lote duas vezes. A lista dos comandos e dos campos de cada um está em `packages/nucleo/src/comandos.ts`.

## `planilha`: CSV

O tipo do arquivo sai do começo do nome: `negocios.csv`, `atividades-outubro.csv` e assim por diante. O separador pode ser `;` ou `,`. Valores como `R$ 1.234,56` e datas como `15/10/2026` são aceitos.

```http
POST /admin/conectores/<id>/importar?nome=negocios.csv
Authorization: Bearer <ADMIN_TOKEN>
<conteúdo do arquivo>
```

| Arquivo | Colunas (as em negrito são obrigatórias) |
|---|---|
| `pessoas` | **nome**, id, email, funcao (sdr, closer, ambos, cs, gestor), ativa |
| `contas` | **nome**, id, tipo_pessoa (pf/pj), segmento, cidade, uf, dono_cs |
| `negocios` | **id**, **criado_em**, cliente, conta_id, canal, responsavel, etapa, etapa_desde, funil, tipo, valor_estimado, valor_fechado, fechado_em, motivo_perda, preco_referencia, preco_aprovado, condicao, custo_<linha> (ex.: custo_kit) |
| `transicoes` | **negocio_id**, **etapa**, **data**, de, responsavel (para importar o histórico de etapas de outro CRM) |
| `atividades` | **data**, **atividade**, pessoa, quantidade, negocio_id, conta, resultado, id |
| `investimentos` | **mes** (10/2026 ou 2026-10), **canal**, **valor**, impressoes, cliques, leads |
| `recebimentos` | **id**, **status** (pago, aberto, vencido, parcial, cancelado, estornado), negocio_id, conta, descricao, valor_previsto, vencimento, valor_recebido, recebido_em |
| `contratos` | **id**, **conta**, **valor**, **inicio**, **status** (ativo, cancelado, encerrado, renovado, suspenso), recorrente (sim/não), periodicidade_meses, negocio_id, fim, renovacao, motivo_cancelamento |
| `eventos_cs` | **conta**, **evento**, **data**, valor, pessoa, id |

Se a planilha usa outros nomes de coluna, configure assim:

```json
{ "planilhas": { "Pipeline Exportado": { "tipo": "negocios", "colunas": { "id": "Código", "cliente": "Empresa", "responsavel": "Dono" } } } }
```

Reimportar o mesmo arquivo não duplica nada. Uma linha alterada é reaplicada. Um erro aponta o arquivo e a linha, por exemplo: `negocios.csv, linha 4: coluna "criado_em": "ontem" não é uma data`.

## `amicta-crm-v1`: CRM Amicta

Somente leitura. Nunca escreve no CRM.

- **Sincronização** (cron a cada 15 minutos, ou `POST /admin/conectores/<id>/sincronizar`): lê equipe (`/usuarios`), negócios alterados (`/negocios?atualizado_desde=`, paginado) e a fila de eventos (`/eventos?desde=`). O cursor é salvo página a página.
- **Webhook**: cadastre no CRM a URL `https://<seu-worker>/entrada/<id-do-conector>` com os eventos desejados (ou `*`). A assinatura HMAC é conferida e eventos com mais de 5 minutos são recusados.
- **Segredos**: `AMICTA_CHAVE` (chave `amk_…` com `negocios:ler`; `propostas:ler` e `financeiro:ler` são opcionais) e `AMICTA_WEBHOOK` (`whsec_…`).
- **Dados pessoais**: telefone, e-mail, endereço, conta de luz e o texto das notas nunca são gravados. Com `"dadosPessoais": "nenhum"`, nem o nome do cliente é gravado.
- **O que vira o quê**:

  | No CRM | No LAB |
  |---|---|
  | Negócio | negócio + conta + pessoa + canal |
  | `etapa_alterada` | transição explícita |
  | `orcamento.preco_aprovado` | preço aprovado, com o limite de negociação |
  | Ganho | preço fechado, com a condição de pagamento |
  | `proposta.pronta` | atividade "proposta" |
  | Título a receber | recebimento (títulos a pagar são ignorados) |
  | Nota | atividade "nota", sem o texto |

- **Limite atual da API v1**: ela não traz ligações e contatos por pessoa, agendamentos com status, nem o histórico de etapas anterior aos 30 dias de eventos. Quando a API ganhar essas rotas, elas entram como novas páginas na sincronização.

## Escrever um conector novo

1. Crie `packages/conectores/src/fontes/<nome>.ts` implementando `Conector`.
2. Registre-o em `packages/conectores/src/registro.ts`.
3. Teste a tradução (`normalizar`) com payloads reais e faça um teste de ponta a ponta com a fonte simulada. Veja `test/amicta.test.ts` como modelo.
