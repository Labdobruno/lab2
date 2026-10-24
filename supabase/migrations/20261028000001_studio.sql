-- =====================================================================
--  LAB V2 · Fase 7 · Studio: funis em grafo (versionados) e campanhas
-- =====================================================================

/* Funil desenhado no Studio. Salvar de novo cria uma versão nova; as antigas ficam. */
create table lab.studio_funil (
  id           uuid primary key default gen_random_uuid(),
  operacao_id  uuid not null references lab.operacao(id) on delete cascade,
  nome         text not null check (length(nome) between 1 and 80),
  versao       int not null,
  grafo        jsonb not null,
  criado_em    timestamptz not null default now(),
  unique (operacao_id, nome, versao)
);
create trigger studio_funil_acrescimo before update or delete on lab.studio_funil
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

/* Campanha de go-to-market. O plano (orçamento, premissas, projeção) é uma fotografia que não muda;
   só o andamento (planejada → rodando → encerrada) e o resultado final são gravados depois. */
create table lab.campanha (
  id            uuid primary key default gen_random_uuid(),
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  nome          text not null check (length(nome) between 1 and 120),
  canal         text not null,                              -- chave do canal da operação
  funil_nome    text,                                       -- funil do Studio usado; nulo = o observado no histórico
  inicio        date not null,
  fim           date not null check (fim >= inicio),
  orcamento     numeric(14,2) not null check (orcamento > 0),
  premissas     jsonb not null default '{}',                -- cpl, ticket, margem e o grafo usado
  projecao      jsonb not null,
  status        text not null default 'planejada' check (status in ('planejada', 'rodando', 'encerrada')),
  resultado     jsonb,
  encerrada_em  timestamptz,
  criado_em     timestamptz not null default now()
);
create index campanha_operacao on lab.campanha (operacao_id, criado_em desc);

create or replace function lab.campanha_guarda() returns trigger language plpgsql as $$
declare ordem text[] := array['planejada', 'rodando', 'encerrada'];
begin
  if tg_op = 'DELETE' then raise exception 'campanha é só de acréscimo: delete não é permitido'; end if;
  if old.status = 'encerrada' then raise exception 'campanha é só de acréscimo: campanha encerrada não muda'; end if;
  if (new.operacao_id, new.nome, new.canal, new.funil_nome, new.inicio, new.fim, new.orcamento, new.premissas, new.projecao)
     is distinct from (old.operacao_id, old.nome, old.canal, old.funil_nome, old.inicio, old.fim, old.orcamento, old.premissas, old.projecao) then
    raise exception 'campanha é só de acréscimo: o plano não pode mudar';
  end if;
  if array_position(ordem, new.status) < array_position(ordem, old.status) then
    raise exception 'campanha é só de acréscimo: o andamento não volta atrás';
  end if;
  return new;
end $$;
create trigger campanha_guarda before update or delete on lab.campanha
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.campanha_guarda();

do $$
declare t text;
begin
  foreach t in array array['studio_funil', 'campanha'] loop
    execute format('alter table lab.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on lab.%I from anon', t); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on lab.%I from authenticated', t); end if;
  end loop;
end $$;
