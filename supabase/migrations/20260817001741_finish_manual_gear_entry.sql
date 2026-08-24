-- Complete FishWizz manual gear entry without rewriting existing inventory.

alter table public.rods
  alter column atlas_id set default ('ROD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  alter column rod_type set default 'Other',
  add column if not exists piece_count smallint,
  add column if not exists upc text,
  add column if not exists notes text;

alter table public.reels
  alter column atlas_id set default ('REEL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  alter column reel_type set default 'Other',
  add column if not exists gear_ratio text,
  add column if not exists reel_size text,
  add column if not exists retrieve_side text,
  add column if not exists line_capacity text,
  add column if not exists upc text,
  add column if not exists notes text;

alter table public.lures
  alter column atlas_id set default ('LURE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  add column if not exists diving_depth text,
  add column if not exists buoyancy text,
  add column if not exists hook_size text,
  add column if not exists upc text;

alter table public.combos
  alter column atlas_id set default ('COMBO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rods_piece_count_positive'
  ) then
    alter table public.rods
      add constraint rods_piece_count_positive check (piece_count is null or piece_count > 0);
  end if;
end $$;

comment on column public.rods.upc is 'Optional manufacturer barcode entered or scanned by the angler.';
comment on column public.reels.gear_ratio is 'Displayed reel gear ratio, for example 7.5:1.';
comment on column public.reels.retrieve_side is 'Right, Left, or Interchangeable.';
comment on column public.lures.diving_depth is 'Manufacturer-rated or angler-entered running depth.';
