-- =====================================================================
--  LAB V2 · Fase 5 · Quarter, retrato imutável do ciclo e aprendizados
-- =====================================================================

/* Quarter: 3 ciclos seguidos, planejado em 6 passos (fase = último passo concluído).
   Em rascunho pode ser refeito; depois de travado, nada muda. */
create table lab.quarter (
  id             uuid primary key default gen_random_uuid(),
  operacao_id    uuid not null references lab.operacao(id) on delete cascade,
  inicio         date not null,
  fim            date not null,                    -- [inicio, fim)
  fase           int not null default 1 check (fase between 1 and 6),
  receita_meta   numeric(14,2) check (receita_meta >= 0),
  premissas      jsonb not null default '{}',      -- { taxas, ticketMedio, canais } que valem para os cenários
  cenario        text check (cenario in ('conservador', 'base', 'otimista')),
  pesos          jsonb not null default '[]',      -- peso de cada ciclo na meta
  status         text not null default 'rascunho' check (status in ('rascunho', 'travado')),
  travado_em     timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (operacao_id, inicio)
);
create trigger quarter_atualizado before update on lab.quarter for each row execute function lab.tocar_atualizado_em();
create trigger quarter_travado before update or delete on lab.quarter
  for each row when (old.status = 'travado' and pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

/* Retrato do ciclo fechado: fotografia que nunca mais muda (um por ciclo). */
create table lab.retrato_ciclo (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  ciclo_inicio  date not null,
  ciclo_fim     date not null,
  gerado_em     timestamptz not null default now(),
  dados         jsonb not null,
  assinatura    text not null,                    -- SHA-256 do conteúdo: prova de que não foi alterado
  unique (operacao_id, ciclo_inicio)
);
create trigger retrato_acrescimo before update or delete on lab.retrato_ciclo
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

/* Aprendizados e decisões: memória comercial, só de acréscimo. */
create table lab.aprendizado (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  ciclo_inicio  date,
  quarter_id    uuid references lab.quarter(id) on delete cascade,
  tipo          text not null check (tipo in ('funcionou', 'nao_funcionou', 'hipotese', 'decisao')),
  texto         text not null check (length(texto) between 1 and 2000),
  criado_em     timestamptz not null default now()
);
create index aprendizado_operacao on lab.aprendizado (operacao_id, criado_em desc);
create trigger aprendizado_acrescimo before update or delete on lab.aprendizado
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

do $$
declare t text;
begin
  foreach t in array array['quarter', 'retrato_ciclo', 'aprendizado'] loop
    execute format('alter table lab.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on lab.%I from anon', t); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on lab.%I from authenticated', t); end if;
  end loop;
end $$;
