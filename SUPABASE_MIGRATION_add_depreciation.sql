-- Run this in Supabase SQL editor to support depreciation reporting.
-- Adds life_years and depreciation_percent to the public.items table.

alter table public.items
  add column if not exists life_years numeric null,
  add column if not exists depreciation_percent numeric null;

-- Optional: basic sanity constraints (uncomment if you want strict validation)
-- alter table public.items
--   add constraint items_life_years_nonnegative check (life_years is null or life_years >= 0),
--   add constraint items_depr_percent_range check (depreciation_percent is null or (depreciation_percent >= 0 and depreciation_percent <= 100));
