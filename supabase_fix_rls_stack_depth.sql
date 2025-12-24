-- Fix Postgres "stack depth limit exceeded" caused by recursive RLS helper functions
-- Run this in Supabase SQL Editor (Database -> SQL) as the project owner.

-- 1) Make helper functions SECURITY DEFINER and disable RLS inside the function body.
-- This prevents policies like "is_company_member(company_id)" from recursively triggering RLS on company_users.

create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.company_users cu
    where cu.company_id = p_company_id
      and cu.user_id = auth.uid()
  );
$$;

create or replace function public.is_company_admin(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.company_users cu
    where cu.company_id = p_company_id
      and cu.user_id = auth.uid()
      and cu.role = 'admin'
  );
$$;

-- Optional: If you use current_company_id() in policies and it queries company_users, consider applying the same pattern there as well.
