-- StockStak: Super Vendors (separate from Vendors)
--
-- Creates a dedicated table for Super Vendors and a mapping table that links
-- existing vendor_invoices to a super vendor for roll-up / reporting.

create table if not exists public.super_vendors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists super_vendors_company_name_uidx
  on public.super_vendors(company_id, lower(name));

create index if not exists super_vendors_company_id_idx
  on public.super_vendors(company_id);

-- Map an invoice to a super vendor (at most one super vendor per invoice).
create table if not exists public.vendor_invoice_supervendor_sv (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null references public.vendor_invoices(id) on delete cascade,
  super_vendor_id uuid not null references public.super_vendors(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists vendor_invoice_supervendor_sv_invoice_id_uidx
  on public.vendor_invoice_supervendor_sv(invoice_id);

create index if not exists vendor_invoice_supervendor_sv_company_id_idx
  on public.vendor_invoice_supervendor_sv(company_id);

create index if not exists vendor_invoice_supervendor_sv_super_vendor_id_idx
  on public.vendor_invoice_supervendor_sv(super_vendor_id);

alter table public.super_vendors enable row level security;
alter table public.vendor_invoice_supervendor_sv enable row level security;

-- Policies: company members can read/write
do $$
begin
  -- super_vendors SELECT
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='super_vendors' and policyname='member_can_read_super_vendors'
  ) then
    create policy member_can_read_super_vendors
      on public.super_vendors
      for select
      using (
        exists (
          select 1 from public.company_users cu
          where cu.company_id = super_vendors.company_id
            and cu.user_id = auth.uid()
        )
      );
  end if;

  -- super_vendors INSERT/UPDATE/DELETE (admin only)
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='super_vendors' and policyname='admin_can_write_super_vendors'
  ) then
    create policy admin_can_write_super_vendors
      on public.super_vendors
      for all
      using (
        exists (
          select 1 from public.company_users cu
          where cu.company_id = super_vendors.company_id
            and cu.user_id = auth.uid()
            and cu.role = 'admin'
        )
      )
      with check (
        exists (
          select 1 from public.company_users cu
          where cu.company_id = super_vendors.company_id
            and cu.user_id = auth.uid()
            and cu.role = 'admin'
        )
      );
  end if;

  -- mapping SELECT
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='vendor_invoice_supervendor_sv' and policyname='member_can_read_supervendor_map_sv'
  ) then
    create policy member_can_read_supervendor_map_sv
      on public.vendor_invoice_supervendor_sv
      for select
      using (
        exists (
          select 1 from public.company_users cu
          where cu.company_id = vendor_invoice_supervendor_sv.company_id
            and cu.user_id = auth.uid()
        )
      );
  end if;

  -- mapping write (admin + pm allowed)
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='vendor_invoice_supervendor_sv' and policyname='member_can_write_supervendor_map_sv'
  ) then
    create policy member_can_write_supervendor_map_sv
      on public.vendor_invoice_supervendor_sv
      for all
      using (
        exists (
          select 1 from public.company_users cu
          where cu.company_id = vendor_invoice_supervendor_sv.company_id
            and cu.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.company_users cu
          where cu.company_id = vendor_invoice_supervendor_sv.company_id
            and cu.user_id = auth.uid()
        )
      );
  end if;
end $$;
