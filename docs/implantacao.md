# Implantação nas contas pessoais

São três contas no seu e-mail pessoal, cada uma com verificação em duas etapas (2FA):

| Conta | Para quê |
|---|---|
| GitHub | Guarda o código e o histórico de versões (o "repo") |
| Supabase | Banco de dados (Postgres) |
| Cloudflare | Roda a API (Worker) e, depois, as telas |

O plano gratuito de cada uma basta para começar. Confira os limites atuais nas páginas de preço antes de contar com eles. Um ponto conhecido: projetos gratuitos do Supabase podem ser pausados por inatividade; o cron do Worker, que roda a cada 15 minutos, mantém o banco em uso.

## 1. GitHub

1. Crie um repositório **privado** vazio chamado `lab-v2`, sem README.
2. Me passe o endereço (`seu-usuario/lab-v2`) e eu envio o código.

## 2. Supabase

1. Crie um projeto (região São Paulo, se houver) e guarde a senha do banco num gerenciador de senhas.
2. Abra o **SQL Editor**, cole o conteúdo de `supabase/migrations/20261024000001_modelo_canonico.sql` e execute. Ou, com a Supabase CLI: `supabase link` e depois `supabase db push`.
3. Em **Connect**, copie a connection string do **Transaction pooler** (porta 6543). Ela é o `DATABASE_URL`.

O schema `lab` não fica exposto à API pública do Supabase: só o Worker acessa.

## 3. Cloudflare (Worker da API)

```bash
cd apps/api
npx wrangler login                       # abre o navegador na sua conta pessoal
npx wrangler secret put DATABASE_URL     # cole a connection string do passo 2
npx wrangler secret put ADMIN_TOKEN      # um token longo e aleatório (ex.: openssl rand -hex 32)
npx wrangler deploy
```

Para conferir: `curl https://lab-v2-api.<sua-conta>.workers.dev/saude` deve responder `"ok": true`.

**Hyperdrive** (opcional, recomendado mais tarde) é o pool de conexões do Cloudflare para Postgres. Se configurar, adicione o binding `HYPERDRIVE` no `wrangler.toml`: o Worker passa a usá-lo no lugar do `DATABASE_URL`.

## 4. Primeira operação

```bash
API=https://lab-v2-api.<sua-conta>.workers.dev
TOKEN=<seu ADMIN_TOKEN>
curl -X POST $API/admin/operacoes -H "authorization: Bearer $TOKEN" \
  -d '{"slug":"minha-operacao","nome":"Minha operação","packId":"base"}'
curl -X POST $API/admin/conectores -H "authorization: Bearer $TOKEN" \
  -d '{"operacao":"minha-operacao","tipo":"planilha","nome":"planilhas"}'
```

## 5. Quando for ligar a Amicta

1. No CRM da Amicta: Equipe → Integrações (API) → gere uma chave **só de leitura** (`negocios:ler`; `propostas:ler` e `financeiro:ler` são opcionais).
2. `npx wrangler secret put AMICTA_CHAVE`.
3. Crie a operação com o pack `solar-b2c` e o conector `amicta-crm-v1` com `"segredoRef": "AMICTA"`.
4. No CRM: cadastre o webhook apontando para `/entrada/<id-do-conector>` e guarde o segredo com `npx wrangler secret put AMICTA_WEBHOOK`.
5. Rode a primeira sincronização (`POST /admin/conectores/<id>/sincronizar`) e confira `GET /admin/conectores/<id>/saude`.

## Segurança

- Nunca coloque segredos em arquivos do repositório. O `.gitignore` já ignora `.dev.vars` e `.env`.
- Se um token vazar, gere outro e rode `wrangler secret put` de novo. Para chaves do CRM, revogue no próprio CRM.

## Atualizações do banco

A partir da fase 5 o Worker aplica sozinho as migrations pendentes (na primeira chamada autenticada ou na rodada de 15 minutos). Basta publicar com `npx wrangler deploy`; o `/saude` mostra `"migracoes": "em dia"` quando terminou. Ao criar uma migration nova, rode `npm run migracoes:gerar` antes de publicar (o teste avisa se esquecer).
