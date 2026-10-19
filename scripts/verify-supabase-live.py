"""Opt-in live checks using disposable users/apps; no outgoing emails or provider messages."""
import base64,json,os,secrets,struct,subprocess,sys,urllib.request,urllib.error,uuid,zlib
from pathlib import Path
if '--run' not in sys.argv:
 print('Use --run to create and clean up temporary verification users/apps. Add --browser for Chromium checks.')
 raise SystemExit(2)
if '--browser' in sys.argv:
 try:
  with urllib.request.urlopen('http://127.0.0.1:8080/',timeout=5) as response:
   if response.status != 200: raise RuntimeError()
 except Exception:
  print('Start the Vite development server on 127.0.0.1:8080 before --browser; no test accounts were created.')
  raise SystemExit(2)
ROOT=Path(__file__).resolve().parents[1]
config={}
local=ROOT/'.env.local'
if local.exists():
 config=dict(line.split('=',1) for line in local.read_text().splitlines() if '=' in line and not line.lstrip().startswith('#'))
TOKEN=os.environ.get('SUPABASE_ACCESS_TOKEN')
BASE=(os.environ.get('VITE_SUPABASE_URL') or config.get('VITE_SUPABASE_URL','')).rstrip('/')
KEY=os.environ.get('VITE_SUPABASE_PUBLISHABLE_KEY') or config.get('VITE_SUPABASE_PUBLISHABLE_KEY')
import re
if not TOKEN or not KEY or not re.fullmatch(r'https://[a-z0-9]+\.supabase\.co',BASE):
 print('Configure SUPABASE_ACCESS_TOKEN, VITE_SUPABASE_URL and the public VITE_SUPABASE_PUBLISHABLE_KEY first; values are never logged.')
 raise SystemExit(2)
MGMT='https://api.supabase.com/v1/projects/'+BASE.split('//')[1].split('.')[0]
users=[]; apps=[]; objects=[]; orgs=[]; sessions={}; passed=0

def request(label,url,method='GET',body=None,bearer=None,apikey=None,expected=(200,),headers=None):
 global passed
 h=dict(headers or {})
 if bearer: h['Authorization']='Bearer '+bearer
 if apikey: h['apikey']=apikey
 if body is not None and not isinstance(body,bytes): body=json.dumps(body).encode();h.setdefault('Content-Type','application/json')
 req=urllib.request.Request(url,data=body,method=method,headers=h)
 try:
  with urllib.request.urlopen(req,timeout=35) as r: status=r.status; raw=r.read()
 except urllib.error.HTTPError as e: status=e.code;raw=e.read()
 try: data=json.loads(raw)
 except (ValueError,UnicodeDecodeError): data=raw
 if status not in expected: raise RuntimeError(f'{label}: unexpected HTTP {status}; code {data.get("code","") if isinstance(data,dict) else ""}')
 return status,data

def ok(label):
 global passed
 passed+=1; print('PASS '+label,flush=True)

def mgmt(path,method='GET',body=None): return request('Management '+path,MGMT+path,method,body,TOKEN,expected=(200,201))[1]
def client(label,path,role='owner',method='GET',body=None,expected=(200,),headers=None):
 return request(label,BASE+path,method,body,sessions[role]['access_token'],KEY,expected,headers)
def rpc(name,body,role='owner',expected=(200,204)):
 return client(name,'/rest/v1/rpc/'+name,role,'POST',body,expected)[1]
def create(entity,data,role='owner'):
 result=client('create '+entity,'/rest/v1/crm_records?select=*',role,'POST',{'app_id':apps[0]['id'],'entity':entity,'data':data},(201,),{'Prefer':'return=representation'})[1]
 assert len(result)==1;return result[0]

try:
 keys=mgmt('/api-keys'); admin=next(k['api_key'] for k in keys if k.get('name')=='service_role')
 request('public Auth',BASE+'/auth/v1/settings',apikey=KEY);ok('public client key and Auth reachable')
 for role in ['owner','other','agent','viewer','admin']:
  password=secrets.token_urlsafe(36);email='statehubs-check-'+uuid.uuid4().hex+'@example.invalid'
  _,u=request('create temporary '+role,BASE+'/auth/v1/admin/users','POST',{'email':email,'password':password,'email_confirm':True,'user_metadata':{'statehubs_verification':True}},admin,admin,(200,201))
  users.append(u['id'])
  _,session=request('authenticate '+role,BASE+'/auth/v1/token?grant_type=password','POST',{'email':email,'password':password},apikey=KEY)
  sessions[role]=session
 ok('five temporary users authenticated; no emails sent')
 for role in ['owner','other']:
  rows=client('create agency','/rest/v1/crm_apps?select=*',role,'POST',{'name':'StateHubs isolated verification '+role},(201,),{'Prefer':'return=representation'})[1]
  apps.append(rows[0]);orgs.append(rows[0]['org_id'])
 ok('real app creation provisions separate organizations')
 for i,role in enumerate(['agent','viewer','admin'],start=2): rpc('crm_set_org_member',{'p_org':orgs[0],'p_user':users[i],'p_role':role})
 ok('owner can assign agent/admin/viewer memberships')
 fixture_env=os.environ.copy();fixture_env.pop('SUPABASE_ACCESS_TOKEN',None)
 generated=subprocess.run(['node','--experimental-transform-types','--input-type=module','-e',"import {composePack} from './supabase/functions/_shared/blueprint/modules.ts'; console.log(JSON.stringify(composePack('ambos','StateHubs activation test')));"],cwd=ROOT,env=fixture_env,capture_output=True,text=True,check=True)
 fixture=json.loads(generated.stdout)
 _,proposal=client('crm-agent card proposal','/functions/v1/crm-agent',method='POST',body={'app_id':apps[0]['id'],'blueprint':fixture})
 assert proposal.get('proposal',{}).get('id')
 version=rpc('crm_apply_proposal',{'p_proposal':proposal['proposal']['id']});assert version==1
 ok('deployed crm-agent validates blueprint; proposal applies persistently')
 prop=create('inmueble',{'direccion':'Verification property','operacion':'venta','estado':'disponible','precio':350000,'moneda':'USD'})
 contact=create('contacto_inmo',{'nombre':'Verification buyer','tipo':'comprador','presupuesto':400000,'moneda':'USD','match_qualified':True,'match_intent':'sale'})
 note_id=str(uuid.uuid4()); payload={'p_record':prop['id'],'p_kind':'note','p_body':'StateHubs temporary verification note','p_request':note_id}
 for _ in range(2): rpc('crm_add_record_activity',payload)
 events=client('read activity','/rest/v1/crm_record_events?record_id=eq.'+prop['id'])[1]
 assert sum(e['id']==note_id for e in events)==1
 ok('property CRUD and idempotent persistent notes')
 patched=rpc('crm_patch_record',{'p_id':prop['id'],'p_patch':{'precio':351000},'p_expected_updated_at':prop['updated_at']});assert patched['data']['precio']==351000
 error=rpc('crm_patch_record',{'p_id':prop['id'],'p_patch':{'precio':1},'p_expected_updated_at':prop['updated_at']},expected=(409,));assert error.get('code')=='PT409'
 ok('acknowledged patches reject stale writes with HTTP 409')
 decision=rpc('crm_set_match_decision',{'p_contact':contact['id'],'p_property':prop['id'],'p_status':'saved'});assert decision['status']=='saved'
 assert client('read saved match','/rest/v1/crm_match_decisions?property_id=eq.'+prop['id'])[1][0]['contact_id']==contact['id']
 ok('property/contact match decision persists')
 assert client('cross tenant read','/rest/v1/crm_records?id=eq.'+prop['id'],'other')[1]==[]
 rpc('crm_add_record_activity',{**payload,'p_request':str(uuid.uuid4())},'other',(400,403))
 rpc('crm_set_match_decision',{'p_contact':contact['id'],'p_property':prop['id'],'p_status':'dismissed'},'other',(400,403))
 ok('real JWTs deny cross-agency records, notes and matching')
 assert client('viewer read','/rest/v1/crm_records?id=eq.'+prop['id'],'viewer')[1][0]['id']==prop['id']
 client('viewer create denied','/rest/v1/crm_records','viewer','POST',{'app_id':apps[0]['id'],'entity':'inmueble','data':{}},(401,403))
 rpc('crm_add_record_activity',{**payload,'p_request':str(uuid.uuid4())},'viewer',(400,403))
 rpc('crm_patch_record',{'p_id':prop['id'],'p_patch':{'precio':1}},'viewer',(400,403))
 ok('viewer reads permitted records but cannot create, edit or add activity')
 rpc('crm_patch_record',{'p_id':prop['id'],'p_patch':{'descripcion':'Agent confirmed update'}},'agent')
 rows=client('agent delete denied','/rest/v1/crm_records?id=eq.'+prop['id'],'agent','DELETE',expected=(200,204),headers={'Prefer':'return=representation'})[1]
 assert not rows and client('record retained','/rest/v1/crm_records?id=eq.'+prop['id'])[1]
 disposable=create('inmueble',{'direccion':'Disposable permissions check'})
 deleted=client('admin delete','/rest/v1/crm_records?id=eq.'+disposable['id'],'admin','DELETE',expected=(200,),headers={'Prefer':'return=representation'})[1]
 assert len(deleted)==1
 ok('agent edits without delete rights; administrator can delete')
 def chunk(kind,data): return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data))
 image=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!IIBBBBB',1,1,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b'\x00\x14\xb8\xa6\xff'))+chunk(b'IEND',b'')
 path=apps[0]['id']+'/'+prop['id']+'/'+str(uuid.uuid4())+'.png';objects.append(path)
 client('private image upload','/storage/v1/object/crm-property-media/'+path,method='POST',body=image,expected=(200,),headers={'Content-Type':'image/png','x-upsert':'false'})
 rpc('crm_patch_record',{'p_id':prop['id'],'p_patch':{'statehubs_media':[{'path':path,'kind':'image','name':'Verification.png'}]}})
 _,signed=client('owner signed URL','/storage/v1/object/sign/crm-property-media/'+path,method='POST',body={'expiresIn':60})
 signed_url=signed.get('signedURL') or signed.get('signedUrl');assert signed_url
 _,download=request('signed download',BASE+'/storage/v1'+signed_url if signed_url.startswith('/object/') else BASE+signed_url if signed_url.startswith('/') else signed_url)
 assert download==image
 client('cross-tenant signing denied','/storage/v1/object/sign/crm-property-media/'+path,'other','POST',{'expiresIn':60},(400,403,404))
 client('viewer signed read','/storage/v1/object/sign/crm-property-media/'+path,'viewer','POST',{'expiresIn':60})
 denied_path=apps[0]['id']+'/'+prop['id']+'/'+str(uuid.uuid4())+'.png'
 client('viewer upload denied','/storage/v1/object/crm-property-media/'+denied_path,'viewer','POST',image,(400,401,403),{'Content-Type':'image/png'})
 ok('private upload, persisted media metadata and signed download; Storage tenant/viewer isolation')
 _,automate=client('automate no-op','/functions/v1/crm-automate',method='POST',body={'app_id':apps[0]['id'],'record_id':prop['id'],'event':'cambio'})
 assert automate['results']==[]
 _,ical=client('ical no-feed','/functions/v1/crm-ical',method='POST',body={'app_id':apps[0]['id']})
 assert ical['nuevas']==0
 client('foreign builder denied','/functions/v1/crm-agent','other','POST',{'app_id':apps[0]['id'],'blueprint':fixture},(404,))
 request('anonymous Edge denied',BASE+'/functions/v1/crm-agent','POST',{'app_id':apps[0]['id']},apikey=KEY,expected=(401,))
 ok('deployed Edge runtime: builder ownership, automation no-op, iCal no-feed and unauthenticated rejection')
 for connector,body in [('crm-google',{'action':'status'}),('crm-instagram',{'app_id':apps[0]['id'],'action':'status'})]:
  _,state=client(connector+' status','/functions/v1/'+connector,method='POST',body=body)
  assert state['connected'] is False and isinstance(state['configured'],bool)
  request(connector+' anonymous rejection',BASE+'/functions/v1/'+connector,'POST',body,apikey=KEY,expected=(401,))
 ok('Google Calendar and Instagram expose configuration status and reject anonymous actions; no provider calls made')
 if '--browser' in sys.argv:
  runtime=os.environ.copy();runtime.pop('SUPABASE_ACCESS_TOKEN',None)
  runtime['VITE_SUPABASE_URL']=BASE
  runtime['STATEHUBS_SMOKE_SESSIONS']=json.dumps({'owner':sessions['owner'],'viewer':sessions['viewer'],'appId':apps[0]['id']})
  subprocess.run(['node','--use-env-proxy',str(ROOT/'scripts/verify-supabase-browser.mjs')],cwd=ROOT,env=runtime,check=True)
  ok('live frontend auth callback, notes and viewer restrictions at mobile/desktop sizes')
 print(f'REAL SUPABASE CHECKS PASSED: {passed}; provider/email delivery and production frontend remain separate checks.',flush=True)
finally:
 cleanup_errors=[]
 if 'admin' in locals():
  for path in objects:
   try: request('cleanup media',BASE+'/storage/v1/object/crm-property-media','DELETE',{'prefixes':[path]},admin,admin,(200,))
   except Exception: cleanup_errors.append('temporary media')
  if apps:
   ids=','.join("'"+str(uuid.UUID(a['id']))+"'" for a in apps); orgids=','.join("'"+str(uuid.UUID(o))+"'" for o in orgs)
   try: mgmt('/database/query','POST',{'read_only':False,'query':f'begin; delete from public.crm_apps where id in ({ids}); delete from public.crm_organizations where id in ({orgids}); commit;'})
   except Exception: cleanup_errors.append('temporary apps/organizations')
  for uid in users:
   try: request('cleanup temporary user',BASE+'/auth/v1/admin/users/'+uid,'DELETE',bearer=admin,apikey=admin,expected=(200,))
   except Exception: cleanup_errors.append('temporary user')
 if cleanup_errors: print('CLEANUP INCOMPLETE: '+', '.join(cleanup_errors),flush=True);sys.exit(2)
 print('CLEANUP: temporary media, apps, organizations and users removed.',flush=True)
