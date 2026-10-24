-- =====================================================================
--  LAB V2 · Fase 6 · Canvas de decisão e experimentos
--  A memória comercial continua em lab.aprendizado (fase 5): concluir um experimento escreve lá.
-- =====================================================================

/* Canvas de decisão: a pergunta, as opções, o que foi escolhido e como saber se deu certo. Só de acréscimo. */
create table lab.decisao (
  id               uuid primary key default gen_random_uuid(),
  operacao_id      uuid not null references lab.operacao(id) on delete cascade,
  hipotese_id      text,                                  -- chave da hipótese do pack que originou a decisão, se houve
  pergunta         text not null check (length(pergunta) between 1 and 300),
  contexto         jsonb not null default '{}',           -- o achado, com os números, como estava no dia
  opcoes           jsonb not null default '[]',           -- [{ nome, esforco?, impacto? }]
  escolha          text not null check (length(escolha) between 1 and 500),
  porque           text check (length(porque) <= 2000),
  criterio_sucesso text check (length(criterio_sucesso) <= 1000),
  revisar_em       date,
  criado_em        timestamptz not null default now()
);
create index decisao_operacao on lab.decisao (operacao_id, criado_em desc);
create trigger decisao_acrescimo before update or delete on lab.decisao
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

/* Experimento: uma métrica do dicionário, de onde partiu (baseline) para onde deve ir (alvo).
   Enquanto roda pode ser concluído ou descartado; depois disso, nada muda. */
create table lab.experimento (
  id            uuid primary key default gen_random_uuid(),
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  decisao_id    uuid references lab.decisao(id),
  hipotese_id   text,
  titulo        text not null check (length(titulo) between 1 and 200),
  metrica       text not null,                            -- variável do dicionário de hipóteses (ex.: taxa_ganho)
  baseline      numeric,                                  -- valor no dia em que começou (nulo = sem dado na hora)
  alvo          numeric not null,
  inicio        date not null,
  fim_previsto  date,
  status        text not null default 'rodando' check (status in ('rodando', 'concluido', 'descartado')),
  resultado     numeric,
  conclusao     text check (length(conclusao) <= 1500),
  concluido_em  timestamptz,
  criado_em     timestamptz not null default now()
);
create index experimento_operacao on lab.experimento (operacao_id, criado_em desc);
create trigger experimento_encerrado before update or delete on lab.experimento
  for each row when (old.status <> 'rodando' and pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

do $$
declare t text;
begin
  foreach t in array array['decisao', 'experimento'] loop
    execute format('alter table lab.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on lab.%I from anon', t); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on lab.%I from authenticated', t); end if;
  end loop;
end $$;
