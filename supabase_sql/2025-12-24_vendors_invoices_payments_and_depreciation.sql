-- Vendors / Invoices / Payments (company-scoped)
-- Run this in Supabase SQL editor.
-- Safe to re-run because it uses IF NOT EXISTS where supported.

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  invoice_number text not null,
  invoice_date date,
  due_date date,
  amount numeric not null default 0,
  description text,
  status text not null default 'open', -- open / partially_paid / paid / void
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  invoice_id uuid references public.vendor_invoices(id) on delete set null,
  payment_date date not null,
  amount numeric not null default 0,
  method text,
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid
);

-- Optional: depreciation fields on items
alter table public.items add column if not exists useful_life_years integer;
alter table public.items add column if not exists depreciation_rate numeric;

-- RLS policies (adjust to your functions)
alter table public.vendors enable row level security;
alter table public.vendor_invoices enable row level security;
alter table public.vendor_payments enable row level security;

-- Some environments referenced is_company_purchaser(company_id) without creating it.
-- Define it here for backwards compatibility.
create or replace function public.is_company_purchaser(cid uuid)
returns boolean
language sql
stable
as $$
  select public.is_company_role(cid, ARRAY['admin','owner','purchaser']::text[]);
$$;

-- Read for company members
drop policy if exists vendors_select_member on public.vendors;
create policy vendors_select_member on public.vendors
for select to authenticated
using (company_id = current_company_id());

drop policy if exists vendor_invoices_select_member on public.vendor_invoices;
create policy vendor_invoices_select_member on public.vendor_invoices
for select to authenticated
using (company_id = current_company_id());

drop policy if exists vendor_payments_select_member on public.vendor_payments;
create policy vendor_payments_select_member on public.vendor_payments
for select to authenticated
using (company_id = current_company_id());

-- Write for admins/purchasers (tighten/loosen as desired)
drop policy if exists vendors_write_admin on public.vendors;
create policy vendors_write_admin on public.vendors
for all to authenticated
using (
  is_company_admin(company_id)
  or public.is_company_role(company_id, ARRAY['admin','owner','purchaser']::text[])
)
with check (
  is_company_admin(company_id)
  or public.is_company_role(company_id, ARRAY['admin','owner','purchaser']::text[])
);

drop policy if exists vendor_invoices_write_admin on public.vendor_invoices;
create policy vendor_invoices_write_admin on public.vendor_invoices
for all to authenticated
using (
  is_company_admin(company_id)
  or public.is_company_role(company_id, ARRAY['admin','owner','purchaser']::text[])
)
with check (
  is_company_admin(company_id)
  or public.is_company_role(company_id, ARRAY['admin','owner','purchaser']::text[])
);

drop policy if exists vendor_payments_write_admin on public.vendor_payments;
create policy vendor_payments_write_admin on public.vendor_payments
for all to authenticated
using (
  is_company_admin(company_id)
  or public.is_company_role(company_id, ARRAY['admin','owner','purchaser']::text[])
)
with check (
  is_company_admin(company_id)
  or public.is_company_role(company_id, ARRAY['admin','owner','purchaser']::text[])
);
