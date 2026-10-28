begin;

alter table public.service_offerings
  add column if not exists price_max_paisa integer,
  add column if not exists pricing_mode text not null default 'fixed',
  add column if not exists pricing_unit text,
  add column if not exists pricing_note text;

alter table public.service_offerings
  drop constraint if exists service_offerings_pricing_mode_check;
alter table public.service_offerings
  add constraint service_offerings_pricing_mode_check check (pricing_mode in ('fixed', 'starting_at', 'range'));
alter table public.service_offerings
  drop constraint if exists service_offerings_price_max_paisa_check;
alter table public.service_offerings
  add constraint service_offerings_price_max_paisa_check check (price_max_paisa is null or price_max_paisa >= base_paisa);

insert into public.service_categories (name, slug, description, icon_name)
values ('General Home Services', 'general-home-services', 'On-site household inspection and technical scope planning.', 'clipboard-check')
on conflict (slug) do update set name = excluded.name, description = excluded.description, icon_name = excluded.icon_name;

update public.service_offerings set
  title = 'Tap & faucet leakage repair', base_paisa = 35000, visit_paisa = 0,
  pricing_mode = 'fixed', pricing_unit = 'per unit', price_max_paisa = null,
  pricing_note = 'Accessible tap or faucet leak; replacement parts are separate.', image = '/images/tirkha-plumber.webp'
where id = 'sink-leak';

update public.service_offerings set
  title = 'Switch, socket & bulb replacement', base_paisa = 35000, visit_paisa = 0,
  pricing_mode = 'range', pricing_unit = 'per unit', price_max_paisa = 50000,
  pricing_note = 'Rs. 350–500 per unit depending on fitting; parts are separate.', image = '/images/tirkha-electrician.webp'
where id = 'switchboard';

update public.service_offerings set image = '/images/tirkha-plumber.webp' where category_slug = 'plumbing';
update public.service_offerings set image = '/images/tirkha-electrician.webp' where category_slug = 'electrical';
update public.service_offerings set image = '/images/tirkha-home-care.webp' where category_slug in ('home-cleaning', 'sofa-carpet-cleaning');
update public.service_offerings set image = '/images/tirkha-carpenter.webp' where id = 'carpentry';
update public.service_offerings set image = '/images/tirkha-tank-care.webp' where id = 'tank-clean';
update public.service_offerings set image = '/images/tirkha-home-doctor.webp' where id in ('doctor-home', 'home-nurse', 'physiotherapy');
update public.service_offerings set image = '/images/tirkha-beautician.webp' where id = 'salon-home';
update public.service_offerings set image = '/images/tirkha-astrologer.webp' where id = 'astrology-session';
update public.service_offerings set image = '/images/tirkha-tutor.webp' where id = 'home-tutor';
update public.service_offerings set image = '/images/tirkha-decorator.webp' where id = 'home-decorator';

insert into public.service_offerings (
  id, title, category_slug, category_name, icon, vertical, base_paisa, visit_paisa,
  duration_minutes, description, included, excluded, keywords, image, regions, active,
  sort_order, price_max_paisa, pricing_mode, pricing_unit, pricing_note
)
values
('plumbing-inspection', 'Plumbing initial inspection & leak diagnosis', 'plumbing', 'Plumbing', 'wrench', 'Home repairs', 65000, 0, 45,
 'A focused first inspection to identify an accessible plumbing leak or fault.',
 array['Visual inspection of one accessible fault','Basic leak or flow checks','Written findings and next-step scope'],
 array['Repair labour and replacement parts','Concealed-line opening or civil work'],
 array['inspection','diagnosis','leak','plumbing','pipe','tap'], '/images/tirkha-plumber.webp', array['Kathmandu','Lalitpur','Bhaktapur','Pokhara'], true, 17, null, 'fixed', null, null),
('drain-clearing', 'Waste pipe & drainage clearing', 'plumbing', 'Plumbing', 'droplets', 'Home repairs', 50000, 0, 60,
 'Starting rate for clearing one accessible household waste pipe or drain.',
 array['Clear one accessible household blockage','Basic flow test','Work-area cleanup'],
 array['Major sewer line work','Chemical treatment, replacement parts or concealed access'],
 array['drain','drainage','waste pipe','sink jam','dhal'], '/images/tirkha-plumber.webp', array['Kathmandu','Lalitpur','Bhaktapur','Pokhara'], true, 18, null, 'starting_at', null, 'From Rs. 500; final scope confirmed on inspection.'),
('sump-pump-fitting', 'Water motor & sump pump fitting', 'plumbing', 'Plumbing', 'wrench', 'Home repairs', 200000, 0, 120,
 'Labour for fitting one compatible water motor or sump pump at an accessible household installation.',
 array['Fit one customer-supplied compatible pump','Accessible connection check','Basic operational test'],
 array['Pump, wiring, pipework, electrical changes or civil work'],
 array['motor','pump','sump pump','water motor','paani motor'], '/images/tirkha-plumber.webp', array['Kathmandu','Lalitpur','Bhaktapur','Pokhara'], true, 19, null, 'fixed', null, null),
('electrical-inspection', 'Electrical safety inspection & MCB diagnosis', 'electrical', 'Electrical', 'zap', 'Home repairs', 65000, 0, 45,
 'A first safety inspection and diagnosis for one accessible household circuit or breaker issue.',
 array['Visual check of one accessible circuit or distribution board','Basic trip-pattern diagnosis','Written findings and next-step scope'],
 array['Live repair, replacement parts, full rewiring or concealed wiring access'],
 array['inspection','mcb','breaker','electrical diagnosis','safety'], '/images/tirkha-electrician.webp', array['Kathmandu','Lalitpur','Bhaktapur','Pokhara'], true, 20, null, 'fixed', null, null),
('mcb-fuse-swap', 'Single-phase MCB & fuse swap', 'electrical', 'Electrical', 'zap', 'Home repairs', 75000, 0, 45,
 'Labour to replace one compatible single-phase MCB or fuse after confirming the fault and rating.',
 array['Verify one compatible breaker rating','Replace one customer-approved unit','Basic functional check'],
 array['MCB/fuse and repairs for underlying overload, short circuit or wiring fault'],
 array['mcb','fuse','breaker swap','single phase','trip'], '/images/tirkha-electrician.webp', array['Kathmandu','Lalitpur','Bhaktapur','Pokhara'], true, 21, null, 'fixed', null, null),
('technical-audit', 'General on-site technical audit', 'general-home-services', 'General Home Services', 'clipboard-check', 'Home repairs', 100000, 0, 60,
 'A general on-site technical audit for a household repair issue that needs a professional assessment.',
 array['One on-site assessment','Documented scope and written estimate','Safety observations'],
 array['Repair work, parts, testing requiring specialist equipment'],
 array['technical audit','site inspection','on-site inspection','home audit'], '/images/tirkha-hero-team.webp', array['Kathmandu','Lalitpur','Bhaktapur','Pokhara'], true, 22, null, 'fixed', null, null)
on conflict (id) do update set
  title = excluded.title, category_slug = excluded.category_slug, category_name = excluded.category_name,
  icon = excluded.icon, vertical = excluded.vertical, base_paisa = excluded.base_paisa,
  visit_paisa = excluded.visit_paisa, duration_minutes = excluded.duration_minutes,
  description = excluded.description, included = excluded.included, excluded = excluded.excluded,
  keywords = excluded.keywords, image = excluded.image, regions = excluded.regions,
  active = excluded.active, sort_order = excluded.sort_order, price_max_paisa = excluded.price_max_paisa,
  pricing_mode = excluded.pricing_mode, pricing_unit = excluded.pricing_unit, pricing_note = excluded.pricing_note;

commit;
