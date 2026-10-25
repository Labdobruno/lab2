-- =====================================================================
--  LAB V2 · Onda 3 · Estratégia: plano do ciclo com versões, metas históricas por ciclo, documento do quarter e aprendizados estruturados.
--  O banco só guarda: nenhuma fórmula em SQL. O passado não se reescreve: versões, registros e publicações são só de acréscimo.
-- =====================================================================

/* Plano do ciclo: as metas vivem em lab.meta (só acréscimo; a vigente é a última). Aqui fica o estado do plano, a foto original
   aprovada na ativação e cada versão substituída por replanejamento (corte + motivo + metas que valiam até ali). */
create table lab.plano_ciclo (
  id             uuid primary key default gen_random_uuid(),
  operacao_id    uuid not null references lab.operacao(id) on delete cascade,
  ciclo_inicio   date not null,
  status         text not null default 'rascunho' check (status in ('rascunho', 'ativo', 'fechado')),
  versao         int not null default 1 check (versao >= 1),
  original       jsonb,                                -- { em, por, metas: [{ indicador, pessoaId, valor }] } congelado na ativação
  versoes        jsonb not null default '{}'::jsonb,   -- { v1: { n, em, por, corte, motivo, metas, realizadoNoCorte }, ... }
  corte          date,                                 -- último corte de replanejamento
  ativado_em     timestamptz,
  ativado_por    text not null default '',
  fechado_em     timestamptz,
  fechado_por    text not null default '',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (operacao_id, ciclo_inicio)
);
create or replace function lab.plano_ciclo_guarda() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('lab.apagando_operacao', true) is distinct from 'sim' then raise exception 'lab.plano_ciclo é só de acréscimo: o plano do ciclo não pode ser apagado'; end if;
    return old;
  end if;
  if old.status = 'fechado' and current_setting('lab.apagando_operacao', true) is distinct from 'sim' then raise exception 'lab.plano_ciclo: plano fechado não muda'; end if;
  if old.original is not null and new.original is distinct from old.original then raise exception 'lab.plano_ciclo: a meta original aprovada nunca muda (replanejar cria uma versão)'; end if;
  if new.versao < old.versao then raise exception 'lab.plano_ciclo: a versão não volta'; end if;
  new.atualizado_em := now();
  return new;
end $$;
create trigger plano_ciclo_guarda before update or delete on lab.plano_ciclo for each row execute function lab.plano_ciclo_guarda();

/* Metas históricas (D16–D20): registro imutável da meta oficial de cada ciclo encerrado (r1 = encerramento; rN = revisão ou estimativa)
   e observação diária da meta em vigor (evidência para ciclos que não tiveram plano). */
create table lab.meta_ciclo_registro (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  ciclo_inicio  date not null,
  n             int not null check (n >= 1),
  tipo          text not null check (tipo in ('encerramento', 'recuperacao', 'correcao', 'estimativa')),
  registro      jsonb not null,
  criado_em     timestamptz not null default now(),
  unique (operacao_id, ciclo_inicio, n)
);
create trigger meta_ciclo_registro_acrescimo before update or delete on lab.meta_ciclo_registro
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();
create table lab.meta_ciclo_obs (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  ciclo_inicio  date not null,
  dia           date not null,
  receita       numeric(14,2) check (receita >= 0),   -- nulo com fonte 'nenhuma' = registrado que não havia meta
  fonte         text not null default '',
  pessoas       jsonb not null default '{}'::jsonb,
  criado_em     timestamptz not null default now(),
  unique (operacao_id, ciclo_inicio, dia)
);
create trigger meta_ciclo_obs_acrescimo before update or delete on lab.meta_ciclo_obs
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

/* Documento do quarter (estratégia): objetivo, resultados-chave, prioridades, iniciativas e marcos, meses, cenários, riscos, gatilhos,
   capacidade, decisões, respostas da retrospectiva, fechamento de cada mês e programa. Em rascunho muda; publicar congela uma versão;
   encerrado não recebe mais nada. */
create table lab.quarter_estrategia (
  id             uuid primary key default gen_random_uuid(),
  operacao_id    uuid not null references lab.operacao(id) on delete cascade,
  inicio         date not null,
  fim            date not null,
  status         text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'encerrado')),
  versao         int not null default 0 check (versao >= 0),
  doc            jsonb not null default '{}'::jsonb,
  publicado_em   timestamptz,
  encerrado_em   timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (operacao_id, inicio)
);
create or replace function lab.quarter_estrategia_guarda() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('lab.apagando_operacao', true) is distinct from 'sim' then raise exception 'lab.quarter_estrategia é só de acréscimo: o plano do quarter não pode ser apagado'; end if;
    return old;
  end if;
  if old.status = 'encerrado' and current_setting('lab.apagando_operacao', true) is distinct from 'sim' then raise exception 'lab.quarter_estrategia: quarter encerrado não muda'; end if;
  if new.versao < old.versao then raise exception 'lab.quarter_estrategia: a versão não volta'; end if;
  new.atualizado_em := now();
  return new;
end $$;
create trigger quarter_estrategia_guarda before update or delete on lab.quarter_estrategia for each row execute function lab.quarter_estrategia_guarda();

create table lab.quarter_versao (
  id              bigint generated always as identity primary key,
  operacao_id     uuid not null references lab.operacao(id) on delete cascade,
  quarter_inicio  date not null,
  n               int not null check (n >= 1),
  snapshot        jsonb not null,
  motivo          text not null,
  por             text not null default '',
  em              timestamptz not null default now(),
  unique (operacao_id, quarter_inicio, n)
);
create trigger quarter_versao_acrescimo before update or delete on lab.quarter_versao
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();
create table lab.quarter_historico (
  id              bigint generated always as identity primary key,
  operacao_id     uuid not null references lab.operacao(id) on delete cascade,
  quarter_inicio  date not null,
  em              timestamptz not null default now(),
  por             text not null default '',
  acao            text not null,
  detalhe         jsonb not null default '{}'::jsonb
);
create index quarter_historico_quarter on lab.quarter_historico (operacao_id, quarter_inicio, em desc);
create trigger quarter_historico_acrescimo before update or delete on lab.quarter_historico
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

/* aprendizado estruturado: contexto, evidência, conclusão, confiança, condições, implicação e decisão (o texto continua sendo o resumo) */
alter table lab.aprendizado add column quarter_inicio date, add column dados jsonb;

alter table lab.plano_ciclo enable row level security;
alter table lab.meta_ciclo_registro enable row level security;
alter table lab.meta_ciclo_obs enable row level security;
alter table lab.quarter_estrategia enable row level security;
alter table lab.quarter_versao enable row level security;
alter table lab.quarter_historico enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on lab.plano_ciclo, lab.meta_ciclo_registro, lab.meta_ciclo_obs, lab.quarter_estrategia, lab.quarter_versao, lab.quarter_historico from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on lab.plano_ciclo, lab.meta_ciclo_registro, lab.meta_ciclo_obs, lab.quarter_estrategia, lab.quarter_versao, lab.quarter_historico from authenticated; end if;
end $$;
