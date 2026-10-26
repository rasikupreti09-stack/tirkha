-- Safe to rerun. Stable slugs preserve category IDs and professional mappings.
begin;
insert into public.service_categories (name, slug, description, icon_name) values
  ('Plumbing', 'plumbing', 'Help with leaking taps, blocked drains, water tanks, pipes, and everyday plumbing repairs.', 'wrench'),
  ('Electrical', 'electrical', 'Assistance with wiring, switches, lighting, fans, and household electrical faults.', 'zap'),
  ('Home Cleaning', 'home-cleaning', 'Routine cleaning and deep cleaning for homes, kitchens, bathrooms, and living spaces.', 'sparkles'),
  ('Appliance Repair', 'appliance-repair', 'Repair support for refrigerators, washing machines, and other household appliances.', 'washing-machine'),
  ('Painting', 'painting', 'Interior and exterior painting, wall preparation, and touch-ups for your home.', 'paint-roller')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon_name = excluded.icon_name;
commit;
