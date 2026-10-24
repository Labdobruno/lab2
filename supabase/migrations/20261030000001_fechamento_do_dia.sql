-- =====================================================================
--  LAB V2 · Onda 2 · Fechamento do dia: o relatório gerencial gerado no servidor (cron) e gravado; cada execução auditada.
--  Idempotente: a chave é (operação, data). Repetir não cria outro relatório; se nada mudou, "sem_mudanca"; se mudou,
--  o original é preservado e o recálculo entra como complemento. O banco só guarda: nenhuma fórmula em SQL.
-- =====================================================================
create table lab.dia_fechamento (
  id             bigint generated always as identity primary key,
  operacao_id    uuid not null references lab.operacao(id) on delete cascade,
  data           date not null,
  original       jsonb not null,                       -- como saiu na primeira geração: nunca muda
  atual          jsonb not null,                       -- último cálculo
  complementos   jsonb not null default '[]'::jsonb,   -- cada recálculo que mudou algo: quando, origem, hash, o que mudou (máx. 30)
  acoes          jsonb not null default '{}'::jsonb,   -- decisões do gestor por chave (analisada, decidida, encaminhada, investigar), com histórico
  ref            jsonb not null default '{}'::jsonb,   -- referência dos dados: corte, versão das regras, pessoas, contagens, hash
  assinatura     text not null,                        -- SHA-256 da essência do relatório atual
  gerado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (operacao_id, data)
);
create index dia_fechamento_data on lab.dia_fechamento (operacao_id, data desc);

/* o original nunca muda e a linha nunca some (só o Worker reescreve "atual", "complementos", "acoes" e "ref") */
create or replace function lab.fechamento_guarda() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('lab.apagando_operacao', true) is distinct from 'sim' then raise exception 'lab.dia_fechamento é só de acréscimo: o relatório do dia não pode ser apagado'; end if;
    return old;
  end if;
  if new.original is distinct from old.original or new.data is distinct from old.data or new.operacao_id is distinct from old.operacao_id then
    raise exception 'lab.dia_fechamento: o relatório original do dia nunca muda (recálculos entram como complemento)';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
create trigger dia_fechamento_guarda before update or delete on lab.dia_fechamento for each row execute function lab.fechamento_guarda();

/* cada execução: agendada (cron), manual (gestor) ou complemento; início, fim, status, erro e tentativa */
create table lab.dia_execucao (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  data          date not null,
  origem        text not null check (origem in ('agendado', 'manual', 'complemento')),
  inicio        timestamptz not null default now(),
  fim           timestamptz,
  status        text not null default 'rodando' check (status in ('rodando', 'ok', 'complemento', 'sem_mudanca', 'sem_expediente', 'falhou', 'ignorado')),
  erro          text,
  tentativa     int not null default 1,
  por           text not null default '',
  detalhe       jsonb not null default '{}'::jsonb
);
create index dia_execucao_data on lab.dia_execucao (operacao_id, data, inicio desc);

alter table lab.dia_fechamento enable row level security;
alter table lab.dia_execucao enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on lab.dia_fechamento, lab.dia_execucao from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on lab.dia_fechamento, lab.dia_execucao from authenticated; end if;
end $$;
