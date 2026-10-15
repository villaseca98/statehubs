import {useEffect,useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {Loader2} from 'lucide-react';
import {supabase} from '@/lib/supabase';

function safePath(raw:string|null):string {
 if(!raw||!raw.startsWith('/')||raw.startsWith('//')||raw.includes('\\')||/[\r\n]/.test(raw))return '/workspace';
 return raw;
}
export default function AuthCallback(){
 const [params]=useSearchParams();
 const navigate=useNavigate();
 const [error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  const next=safePath(params.get('next'));
  const run=async()=>{
   if(!supabase){setError('Account sign-in is not configured.');return;}
   try{
    const authError=params.get('error_description')||params.get('error');
    if(authError)throw new Error(authError);
    const code=params.get('code');
    if(code){
     const {error}=await supabase.auth.exchangeCodeForSession(code);
     if(error)throw error;
    }
    // Hash-based token links are processed by the Supabase client automatically.
    const {data,error}=await supabase.auth.getSession();
    if(error)throw error;
    if(!data.session)throw new Error('Your sign-in link has expired or could not be verified. Please try again.');
    if(alive)navigate(next,{replace:true});
   }catch(e){if(alive)setError(e instanceof Error?e.message:'Could not complete sign-in.');}
  };
  void run();
  return()=>{alive=false};
 },[navigate,params]);
 return <main className="grid min-h-screen place-items-center bg-[#f8f8fa] p-6 text-estate-ink"><div className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">{error?<><h1 className="text-2xl font-semibold">Sign-in unsuccessful</h1><p role="alert" className="mt-4 text-sm text-red-700">{error}</p><Link to="/login" className="mt-6 inline-block rounded-xl bg-estate-forest px-5 py-3 font-semibold text-white">Try again</Link></>:<><Loader2 className="mx-auto h-7 w-7 animate-spin text-estate-forest"/><h1 className="mt-4 text-xl font-semibold">Securing your session</h1><p className="mt-2 text-sm text-estate-muted">You'll be redirected to your workspace automatically.</p></>}</div></main>;
}
