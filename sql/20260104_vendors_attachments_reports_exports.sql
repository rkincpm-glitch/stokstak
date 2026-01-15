-- Stokstak: Vendors + Attachments + Report Exports
-- Safe/idempotent migration (can be re-run).

-- 1) Vendors master
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  created_by uuid null
);

create index if not exists vendors_company_id_idx on public.vendors(company_id);

-- 2) Vendor invoices
create table if not exists public.vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  invoice_number text not null,
  invoice_date date,
  due_date date,
  amount numeric not null,
  status text not null default 'unpaid',
  description text,
  attachment_url text,
  created_at timestamptz not null default now(),
  created_by uuid null
);

create index if not exists vendor_invoices_company_id_idx on public.vendor_invoices(company_id);
create index if not exists vendor_invoices_vendor_id_idx on public.vendor_invoices(vendor_id);

-- 3) Vendor payments
create table if not exists public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  invoice_id uuid references public.vendor_invoices(id) on delete set null,
  payment_date date not null,
  amount numeric not null,
  method text,
  reference text,
  attachment_url text,
  created_at timestamptz not null default now(),
  created_by uuid null
);

create index if not exists vendor_payments_company_id_idx on public.vendor_payments(company_id);
create index if not exists vendor_payments_vendor_id_idx on public.vendor_payments(vendor_id);
create index if not exists vendor_payments_invoice_id_idx on public.vendor_payments(invoice_id);

-- 4) RLS
alter table public.vendors enable row level security;
alter table public.vendor_invoices enable row level security;
alter table public.vendor_payments enable row level security;

-- Optional but recommended: force RLS
-- alter table public.vendors force row level security;
-- alter table public.vendor_invoices force row level security;
-- alter table public.vendor_payments force row level security;

-- 5) Policies (drop/recreate to avoid duplicates)
-- Vendors
drop policy if exists vendors_select_member on public.vendors;
drop policy if exists vendors_write_roles on public.vendors;
drop policy if exists vendors_update_roles on public.vendors;
drop policy if exists vendors_delete_roles on public.vendors;

create policy vendors_select_member
on public.vendors
for select
to authenticated
using (company_id = current_company_id());

create policy vendors_write_roles
on public.vendors
for insert
to authenticated
with check (is_company_role(company_id, array['owner','admin','purchaser']));

create policy vendors_update_roles
on public.vendors
for update
to authenticated
using (is_company_role(company_id, array['owner','admin','purchaser']))
with check (is_company_role(company_id, array['owner','admin','purchaser']));

create policy vendors_delete_roles
on public.vendors
for delete
to authenticated
using (is_company_role(company_id, array['owner','admin','purchaser']));

-- Vendor invoices
drop policy if exists vendor_invoices_select_member on public.vendor_invoices;
drop policy if exists vendor_invoices_write_roles on public.vendor_invoices;
drop policy if exists vendor_invoices_update_roles on public.vendor_invoices;
drop policy if exists vendor_invoices_delete_roles on public.vendor_invoices;

create policy vendor_invoices_select_member
on public.vendor_invoices
for select
to authenticated
using (company_id = current_company_id());

create policy vendor_invoices_write_roles
on public.vendor_invoices
for insert
to authenticated
with check (is_company_role(company_id, array['owner','admin','purchaser']));

create policy vendor_invoices_update_roles
on public.vendor_invoices
for update
to authenticated
using (is_company_role(company_id, array['owner','admin','purchaser']))
with check (is_company_role(company_id, array['owner','admin','purchaser']));

create policy vendor_invoices_delete_roles
on public.vendor_invoices
for delete
to authenticated
using (is_company_role(company_id, array['owner','admin','purchaser']));

-- Vendor payments
drop policy if exists vendor_payments_select_member on public.vendor_payments;
drop policy if exists vendor_payments_write_roles on public.vendor_payments;
drop policy if exists vendor_payments_update_roles on public.vendor_payments;
drop policy if exists vendor_payments_delete_roles on public.vendor_payments;

create policy vendor_payments_select_member
on public.vendor_payments
for select
to authenticated
using (company_id = current_company_id());

create policy vendor_payments_write_roles
on public.vendor_payments
for insert
to authenticated
with check (is_company_role(company_id, array['owner','admin','purchaser']));

create policy vendor_payments_update_roles
on public.vendor_payments
for update
to authenticated
using (is_company_role(company_id, array['owner','admin','purchaser']))
with check (is_company_role(company_id, array['owner','admin','purchaser']));

create policy vendor_payments_delete_roles
on public.vendor_payments
for delete
to authenticated
using (is_company_role(company_id, array['owner','admin','purchaser']));

-- 6) Storage bucket for attachments (private)
-- Note: storage is a Supabase schema. This is the supported way to create buckets via SQL.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- 7) Storage policies
-- Path convention enforced by the app:
--   <company_id>/vendors/<vendor_id>/invoices/...  OR  <company_id>/vendors/<vendor_id>/payments/...
-- We derive company_id from the first path segment.

drop policy if exists attachments_read_company on storage.objects;
drop policy if exists attachments_insert_roles on storage.objects;
drop policy if exists attachments_update_roles on storage.objects;
drop policy if exists attachments_delete_roles on storage.objects;

create policy attachments_read_company
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attachments'
  and is_company_member(split_part(name, '/', 1)::uuid)
);

create policy attachments_insert_roles
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and is_company_role(split_part(name, '/', 1)::uuid, array['owner','admin','purchaser'])
);

create policy attachments_update_roles
on storage.objects
for update
to authenticated
using (
  bucket_id = 'attachments'
  and is_company_role(split_part(name, '/', 1)::uuid, array['owner','admin','purchaser'])
)
with check (
  bucket_id = 'attachments'
  and is_company_role(split_part(name, '/', 1)::uuid, array['owner','admin','purchaser'])
);

create policy attachments_delete_roles
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attachments'
  and is_company_role(split_part(name, '/', 1)::uuid, array['owner','admin','purchaser'])
);
