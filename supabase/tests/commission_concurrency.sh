#!/usr/bin/env bash
# Run only against the isolated fixture database used by tenant-security CI.
set -euo pipefail
scratch=$(mktemp -d)
psql -v ON_ERROR_STOP=1 <<'SQL'
begin;
insert into public.crm_records(id,app_id,entity,data) values('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111','operacion','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select public.crm_create_commission('99999999-9999-4999-8999-999999999999','EUR',1000,'[{"recipient":"Agency","units":1000}]',gen_random_uuid());
commit;
SQL
trap 'psql -v ON_ERROR_STOP=1 -c "delete from public.crm_records where id='"'"'99999999-9999-4999-8999-999999999999'"'"'" >/dev/null; rm -rf "$scratch"' EXIT
for n in 1 2; do
 psql -v ON_ERROR_STOP=1 >"$scratch/$n.log" 2>&1 <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select public.crm_record_commission_receipt('99999999-9999-4999-8999-999999999999',0,700,'Concurrent receipt',gen_random_uuid());
select pg_sleep(1);
commit;
SQL
 if [ "$n" = 1 ]; then first=$!; else second=$!; fi
done
first_status=0;second_status=0
wait "$first" || first_status=$?
wait "$second" || second_status=$?
if [ "$first_status" = 0 ] && [ "$second_status" = 0 ]; then echo 'Both concurrent receipts committed';exit 1;fi
if [ "$first_status" != 0 ] && [ "$second_status" != 0 ]; then cat "$scratch"/*.log;exit 1;fi
grep -q 'Receipt exceeds the outstanding allocation' "$scratch"/*.log
psql -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from public.crm_commission_receipts where deal_id='99999999-9999-4999-8999-999999999999')<>1 or (select sum(units) from public.crm_commission_receipts where deal_id='99999999-9999-4999-8999-999999999999')<>700 then raise exception 'Concurrent ledger inconsistent';end if;
end $$;
SQL
echo 'PASS: concurrent receipts cannot overcollect'
