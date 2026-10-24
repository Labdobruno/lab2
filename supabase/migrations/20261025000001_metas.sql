-- =====================================================================
--  LAB V2 · Fase 3 · Metas (tabela única, só de acréscimo)
--  Para mudar uma meta, grava-se uma linha nova: vale a mais recente de cada
--  (ciclo, indicador, pessoa). O que valia antes continua guardado.
-- =====================================================================
create table lab.meta (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  ciclo_inicio  date not null,
  indicador     text not null check (indicador in ('receita','vendas','oportunidades','reuniao_realizada','agendamento','contato','tentativa','proposta_enviada')),
  pessoa_id     uuid references lab.pessoa(id),      -- nulo = meta da operação inteira
  valor         numeric(14,2) not null check (valor >= 0),
  nota          text,
  criado_em     timestamptz not null default now()
);
create index meta_ciclo on lab.meta (operacao_id, ciclo_inicio, indicador, pessoa_id, id desc);
create trigger meta_acrescimo before update or delete on lab.meta
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

alter table lab.meta enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on lab.meta from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on lab.meta from authenticated; end if;
end $$;
