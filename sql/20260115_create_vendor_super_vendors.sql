-- Create a per-company list of vendors that act as "Super Vendors" (invoice aggregators).
-- Supports multiple super vendors without relying on a vendor name convention.

create table if not exists public.vendor_super_vendors (
  company_id uuid not null,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company_id, vendor_id)
);

create index if not exists vendor_super_vendors_vendor_id_idx
  on public.vendor_super_vendors(vendor_id);

alter table public.vendor_super_vendors enable row level security;

-- Company members can read.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='vendor_super_vendors' and policyname='member_can_read_vendor_super_vendors'
  ) then
    create policy member_can_read_vendor_super_vendors
      on public.vendor_super_vendors
      for select
      using (
        exists (
          select 1 from public.company_users cu
          where cu.company_id = vendor_super_vendors.company_id
            and cu.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Company members can write (insert/delete) to manage the list.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='vendor_super_vendors' and policyname='member_can_write_vendor_super_vendors'
  ) then
    create policy member_can_write_vendor_super_vendors
      on public.vendor_super_vendors
      for all
      using (
        exists (
          select 1 from public.company_users cu
          where cu.company_id = vendor_super_vendors.company_id
            and cu.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.company_users cu
          where cu.company_id = vendor_super_vendors.company_id
            and cu.user_id = auth.uid()
        )
      );
  end if;
end $$;
