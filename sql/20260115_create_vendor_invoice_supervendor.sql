-- StockStak: Super Vendor invoice aggregation
--
-- Creates a mapping table that lets an existing invoice (vendor_invoices)
-- be optionally associated with an aggregator vendor ("Super Vendor")
-- without changing vendor_invoices.

create table if not exists public.vendor_invoice_supervendor (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null references public.vendor_invoices(id) on delete cascade,
  super_vendor_id uuid not null references public.vendors(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- One invoice can belong to at most one super vendor
create unique index if not exists vendor_invoice_supervendor_invoice_id_uidx
  on public.vendor_invoice_supervendor(invoice_id);

create index if not exists vendor_invoice_supervendor_company_id_idx
  on public.vendor_invoice_supervendor(company_id);

create index if not exists vendor_invoice_supervendor_super_vendor_id_idx
  on public.vendor_invoice_supervendor(super_vendor_id);

alter table public.vendor_invoice_supervendor enable row level security;

-- Helper: membership check
-- Assumes public.company_users has (company_id, user_id)

do $$
begin
  -- SELECT
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='vendor_invoice_supervendor' and policyname='member_can_read_supervendor_map'
  ) then
    create policy member_can_read_supervendor_map
      on public.vendor_invoice_supervendor
      for select
      using (
        exists (
          select 1
          from public.company_users cu
          where cu.company_id = vendor_invoice_supervendor.company_id
            and cu.user_id = auth.uid()
        )
      );
  end if;

  -- INSERT
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='vendor_invoice_supervendor' and policyname='member_can_write_supervendor_map'
  ) then
    create policy member_can_write_supervendor_map
      on public.vendor_invoice_supervendor
      for insert
      with check (
        exists (
          select 1
          from public.company_users cu
          where cu.company_id = vendor_invoice_supervendor.company_id
            and cu.user_id = auth.uid()
        )
      );
  end if;

  -- UPDATE
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='vendor_invoice_supervendor' and policyname='member_can_update_supervendor_map'
  ) then
    create policy member_can_update_supervendor_map
      on public.vendor_invoice_supervendor
      for update
      using (
        exists (
          select 1
          from public.company_users cu
          where cu.company_id = vendor_invoice_supervendor.company_id
            and cu.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.company_users cu
          where cu.company_id = vendor_invoice_supervendor.company_id
            and cu.user_id = auth.uid()
        )
      );
  end if;

  -- DELETE
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='vendor_invoice_supervendor' and policyname='member_can_delete_supervendor_map'
  ) then
    create policy member_can_delete_supervendor_map
      on public.vendor_invoice_supervendor
      for delete
      using (
        exists (
          select 1
          from public.company_users cu
          where cu.company_id = vendor_invoice_supervendor.company_id
            and cu.user_id = auth.uid()
        )
      );
  end if;
end $$;
