import{r as s,j as e,X as A,a9 as U,aa as M,ab as B,ac as G,ad as T,a5 as P,T as q,f as F}from"./vendor-react-Bfnoqz8p.js";import{J as I,K as D,L as O,M as V,b as $,N as J,g as H,d as Q,j as X}from"./index-CKeXgYEf.js";import"./vendor-supabase-CG6S1lgy.js";const W=`-- BTL Vodacom Privilege Tracker — schéma opérationnel
-- Les migrations versionnées dans supabase/migrations restent la source d’exécution.

create table public.users (
  id uuid primary key,
  full_name text not null,
  phone text not null unique,
  password_hash text,
  role text not null,
  user_category text,
  supervisor_id uuid,
  permanent_shop_id text
);

create table public.shops (
  id text primary key,
  name text not null,
  city text,
  type text
);

create table public.checkins (
  id uuid primary key,
  agent_id uuid not null references public.users(id),
  type text not null,
  timestamp timestamptz not null,
  lat numeric,
  long numeric,
  photo text,
  photo_drive_url text,
  status text
);

create table public.leads (
  id uuid primary key,
  agent_id uuid not null references public.users(id),
  shop_id text references public.shops(id),
  client_name text not null,
  msisdn text not null,
  action_type text not null,
  timestamp timestamptz not null,
  status text
);

create table public.daily_reports (
  id uuid primary key,
  agent_id uuid not null references public.users(id),
  date date not null,
  priv integer default 0,
  roam integer default 0,
  bund integer default 0,
  comment text
);

create table public.campaigns (
  id uuid primary key,
  code text not null unique,
  name text not null
);

create table public.campaign_runs (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns(id),
  start_date date not null,
  status text not null,
  campaign_pos_target integer,
  target_pos_per_ba integer,
  target_transactions_per_pos integer
);

create table public.ba_daily_attendance (
  id uuid primary key,
  campaign_run_id uuid not null references public.campaign_runs(id),
  ba_id uuid not null references public.users(id),
  activity_date date not null,
  checkin_at timestamptz,
  checkout_at timestamptz,
  checkin_photo_path text,
  closing_comment text
);

create table public.points_of_sale (
  id uuid primary key,
  agent_number text,
  denomination text not null,
  address text,
  pool text
);

create table public.ba_pos_visits (
  id uuid primary key,
  campaign_run_id uuid not null references public.campaign_runs(id),
  ba_id uuid not null references public.users(id),
  pos_id uuid not null references public.points_of_sale(id),
  activity_date date not null,
  visited_at timestamptz not null,
  latitude numeric,
  longitude numeric,
  accuracy_m numeric,
  arrival_photo_path text,
  unique (campaign_run_id, pos_id, activity_date)
);

create table public.ba_transactions (
  id uuid primary key,
  campaign_run_id uuid not null references public.campaign_runs(id),
  ba_id uuid not null references public.users(id),
  pos_id uuid not null references public.points_of_sale(id),
  pos_visit_id uuid references public.ba_pos_visits(id),
  transaction_reference text,
  client_number text not null,
  amount numeric not null,
  evidence_path text,
  occurred_at timestamptz not null,
  latitude numeric,
  longitude numeric,
  comment text,
  status text
);`,Y=i=>`"${String(i??"").replace(/"/g,'""')}"`,ae=({isOpen:i,currentUser:u,onClose:N,onRefreshData:S})=>{const a=I(),[c,d]=s.useState((a==null?void 0:a.url)||""),[p,m]=s.useState((a==null?void 0:a.anonKey)||""),[h,f]=s.useState(""),[C,y]=s.useState(!!(a!=null&&a.geminiConfigured)),[z,_]=s.useState(!1),[v,j]=s.useState(!1),[x,l]=s.useState(null);if(s.useEffect(()=>{if(!i)return;let t=!0;return _(!0),D().then(r=>{t&&r&&(d(r.url),m(r.anonKey),y(r.geminiConfigured))}).catch(()=>{}).finally(()=>{t&&_(!1)}),()=>{t=!1}},[i]),!i)return null;const L=async()=>{if(u.role!=="super_admin"){l({type:"error",text:"Seul le super_admin peut modifier la configuration partagée."});return}if(!c.trim()||!p.trim()){l({type:"error",text:"Renseignez l’URL Supabase et la clé API publiable."});return}j(!0),l(null);try{new URL(c.trim());const t=await V({actor:{phone:u.phone,password:u.password},url:c,anonKey:p,geminiApiKey:h||void 0});d(t.url),m(t.anonKey),f(""),y(t.geminiConfigured),l({type:"success",text:"Configuration partagée mise à jour pour tous les appareils."}),S()}catch(t){l({type:"error",text:t instanceof Error?t.message:"La configuration partagée n’a pas pu être enregistrée."})}finally{j(!1)}},R=()=>{const r=[["users",$()],["shops",J()],["checkins",H()],["leads",Q()],["daily_reports",X()]].flatMap(([n,o])=>o.map(g=>({table:n,...g}))),k=Array.from(r.reduce((n,o)=>(Object.keys(o).forEach(g=>n.add(g)),n),new Set)),E=[k.join(","),...r.map(n=>k.map(o=>Y(n[o])).join(","))].join(`
`),K=new Blob(["\uFEFF"+E],{type:"text/csv;charset=utf-8"}),w=URL.createObjectURL(K),b=document.createElement("a");b.href=w,b.download=`BTL_Tracker_export_${new Date().toISOString().slice(0,10)}.csv`,b.click(),URL.revokeObjectURL(w)};return e.jsx("div",{className:"fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-5",role:"dialog","aria-modal":"true","aria-labelledby":"system-settings-title",children:e.jsxs("section",{className:"modal-sheet max-h-[92vh] w-full max-w-xl overflow-y-auto p-5 sm:rounded-3xl",children:[e.jsx("button",{type:"button",onClick:N,className:"absolute right-5 top-5 rounded-xl p-2 text-gray-400 transition hover:bg-white/10 hover:text-white","aria-label":"Fermer",children:e.jsx(A,{size:18})}),e.jsxs("div",{className:"flex items-start gap-3 pr-10",children:[e.jsx("div",{className:"rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/10 p-3 text-fuchsia-100",children:e.jsx(U,{size:22})}),e.jsxs("div",{children:[e.jsx("p",{className:"text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200/70",children:"Super admin"}),e.jsx("h2",{id:"system-settings-title",className:"mt-1 text-lg font-black",children:"Paramètres de la base"}),e.jsx("p",{className:"mt-1 text-xs text-gray-400",children:"Configuration commune à tous les appareils et aux deux campagnes."})]})]}),x&&e.jsx("div",{className:`mt-4 rounded-2xl border p-3 text-xs font-bold ${x.type==="success"?"border-emerald-400/30 bg-emerald-400/10 text-emerald-100":"border-red-400/40 bg-red-500/10 text-red-100"}`,children:x.text}),e.jsxs("div",{className:"mt-5 space-y-4",children:[e.jsxs("section",{className:"rounded-2xl border border-cyan-300/25 bg-cyan-400/[0.05] p-4",children:[e.jsxs("div",{className:"flex items-center gap-2 text-cyan-100",children:[e.jsx(M,{size:16}),e.jsx("b",{className:"text-xs uppercase tracking-wide",children:"Connexion Supabase"})]}),e.jsx("p",{className:"mt-2 text-[11px] leading-relaxed text-gray-400",children:"Ces valeurs sont préremplies avec la base actuellement utilisée. Après enregistrement, elles sont servies à tous les utilisateurs dès leur prochain chargement."}),e.jsx("label",{className:"mt-3 block text-[10px] font-black uppercase text-gray-400",children:"URL Supabase"}),e.jsx("input",{value:c,onChange:t=>d(t.target.value),placeholder:"https://votre-projet.supabase.co",inputMode:"url",className:"app-input mt-1 w-full rounded-2xl px-3 py-2.5 text-xs"}),e.jsx("label",{className:"mt-3 block text-[10px] font-black uppercase text-gray-400",children:"API publishable / anon key"}),e.jsx("input",{value:p,onChange:t=>m(t.target.value),type:"text",autoComplete:"off",placeholder:"sb_publishable_… ou eyJ…",className:"app-input mt-1 w-full rounded-2xl px-3 py-2.5 text-xs"})]}),e.jsxs("section",{className:"rounded-2xl border border-amber-300/25 bg-amber-400/[0.05] p-4",children:[e.jsxs("div",{className:"flex items-center gap-2 text-amber-100",children:[e.jsx(B,{size:16}),e.jsx("b",{className:"text-xs uppercase tracking-wide",children:"Gemini OCR"})]}),e.jsx("p",{className:"mt-2 text-[11px] leading-relaxed text-gray-400",children:"La clé Gemini est conservée côté serveur et sert à tous les agents Merchant. Elle n’est jamais renvoyée aux navigateurs."}),e.jsx("input",{value:h,onChange:t=>f(t.target.value),type:"password",autoComplete:"new-password",placeholder:C?"Clé Gemini déjà configurée — laissez vide pour conserver":"Clé API Gemini",className:"app-input mt-3 w-full rounded-2xl px-3 py-2.5 text-xs"})]}),e.jsxs("button",{type:"button",disabled:z||v,onClick:()=>{L()},className:"btn-neon btn-red flex w-full items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60",children:[e.jsx(G,{size:16})," ",v?"Enregistrement partagé…":"Enregistrer les paramètres"]}),e.jsxs("details",{className:"rounded-2xl border border-white/10 bg-white/[0.035] p-4",children:[e.jsxs("summary",{className:"flex cursor-pointer items-center gap-2 text-xs font-black uppercase text-gray-200",children:[e.jsx(T,{size:16,className:"text-violet-200"})," schema.sql"]}),e.jsx("pre",{className:"mt-3 max-h-64 overflow-auto rounded-xl bg-black/50 p-3 text-[10px] leading-relaxed text-emerald-200",children:W})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("button",{type:"button",onClick:R,className:"flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-3 py-3 text-xs font-black uppercase text-white transition hover:bg-white/10",children:[e.jsx(P,{size:16,className:"text-cyan-200"})," Exporter"]}),e.jsxs("button",{type:"button",onClick:()=>{window.confirm("Vider le cache local et déconnecter cet appareil ?")&&(O(),window.location.reload())},className:"flex items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/[0.08] px-3 py-3 text-xs font-black uppercase text-red-100 transition hover:bg-red-500/15",children:[e.jsx(q,{size:16})," Vider le cache"]})]}),e.jsxs("p",{className:"flex items-center gap-2 text-[10px] text-gray-500",children:[e.jsx(F,{size:13})," Les données opérationnelles se synchronisent depuis Supabase ; aucun import de fichier ou service externe n’est disponible."]})]})]})})};export{ae as SystemConfigurationModal};
