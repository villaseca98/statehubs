-- Seed two independent agencies in the LEGACY layout (before phase 09).
insert into auth.users(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
insert into public.crm_apps (id,owner_id,name) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Agency A'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Agency B');
insert into public.crm_records (id,app_id,entity,data) values
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','inmueble','{"titulo":"A home"}'),
 ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','inmueble','{"titulo":"B home"}');
