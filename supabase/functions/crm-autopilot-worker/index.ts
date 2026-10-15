import {createClient} from 'npm:@supabase/supabase-js@2.57.2';
Deno.serve(async request=>{
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const token=Deno.env.get('AUTOPILOT_CRON_SECRET');
 if(!token||request.headers.get('authorization')!==('Bearer '+token))return new Response('Unauthorized',{status:401});
 const url=Deno.env.get('SUPABASE_URL');
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return new Response('Not configured',{status:503});
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.rpc('crm_run_approved_automations',{p_limit:25});
 if(error)return new Response(JSON.stringify({error:'Execution failed'}),{status:500});
 return Response.json({results:data});
});
