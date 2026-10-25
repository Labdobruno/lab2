-- =====================================================================
--  LAB V2 · Onda 4 · Economia da venda: política de preço completa e versionada, política congelada na venda, exceção de alçada, custo real lançado.
--  Sem contas a pagar: o custo real é lançado à mão, rotulado, e só vale como "efetivo" quando marcado completo. O banco só guarda.
-- =====================================================================
alter table lab.politica_preco
  add column comissao            jsonb not null default '{"tipo":"nenhuma"}'::jsonb,   -- { tipo: nenhuma|fixa|por_margem, alvo, minima }
  add column custo_capital_mes   numeric(8,6) not null default 0 check (custo_capital_mes between 0 and 1),
  add column custos_fixos_mes    numeric(14,2) check (custos_fixos_mes >= 0),
  add column lucro_desejado_mes  numeric(14,2) check (lucro_desejado_mes >= 0),
  add column por                 text not null default '',
  add column motivo              text;

/* a venda guarda a versão da política do dia (mudar a política depois não reescreve vendas feitas) e a exceção de alçada, se houve */
alter table lab.preco_negocio
  add column politica_versao  int,
  add column comissao_fixa    numeric(8,6) check (comissao_fixa between 0 and 1),
  add column por              text not null default '',
  add column excecao          jsonb;                 -- { motivo, piso, aprovado, desconto, impactoMc, em, por }

/* custo real lançado por venda (só acréscimo); a linha com completo = true diz que todo o custo da venda foi lançado */
create table lab.custo_real (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  negocio_id    uuid not null references lab.negocio(id) on delete cascade,
  chave         text not null,
  valor         numeric(14,2) not null check (valor >= 0),
  categoria     text check (categoria in ('cpv', 'servico', 'contingencia', 'interno', 'reserva')),
  em            date not null,
  por           text not null default '',
  nota          text,
  completo      boolean not null default false,
  criado_em     timestamptz not null default now()
);
create index custo_real_negocio on lab.custo_real (negocio_id, id);
create trigger custo_real_acrescimo before update or delete on lab.custo_real
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

alter table lab.custo_real enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on lab.custo_real from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on lab.custo_real from authenticated; end if;
end $$;
