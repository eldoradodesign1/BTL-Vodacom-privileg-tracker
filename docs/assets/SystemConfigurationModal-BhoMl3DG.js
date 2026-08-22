import{r as i,j as e,X as C,a3 as S,a4 as z,a5 as L,a6 as R,a7 as E,$ as U,T as A,f as K}from"./vendor-react-dy_Y008X.js";import{E as q,F as G,G as M,H as T,I as B,b as F,J as I,g as P,d as O,j as $}from"./index-Dnkg57KZ.js";import"./vendor-supabase-CG6S1lgy.js";const D=`-- BTL Vodacom Privilege Tracker — schéma opérationnel
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
);`,V=r=>`"${String(r??"").replace(/"/g,'""')}"`,X=({isOpen:r,onClose:h,onRefreshData:y})=>{const t=i.useMemo(()=>q(),[r]),[l,_]=i.useState((t==null?void 0:t.url)||""),[c,f]=i.useState((t==null?void 0:t.anonKey)||""),[m,j]=i.useState(()=>G()),[o,u]=i.useState(null);if(!r)return null;const v=()=>{if(!l.trim()||!c.trim()){u({type:"error",text:"Renseignez l’URL Supabase et la clé API publiable."});return}try{new URL(l.trim()),T({url:l,anonKey:c}),B(m),u({type:"success",text:"Configuration enregistrée localement sur cet appareil."}),y()}catch{u({type:"error",text:"L’URL Supabase doit être valide."})}},k=()=>{const x=[["users",F()],["shops",I()],["checkins",P()],["leads",O()],["daily_reports",$()]].flatMap(([s,n])=>n.map(p=>({table:s,...p}))),b=Array.from(x.reduce((s,n)=>(Object.keys(n).forEach(p=>s.add(p)),s),new Set)),w=[b.join(","),...x.map(s=>b.map(n=>V(s[n])).join(","))].join(`
`),N=new Blob(["\uFEFF"+w],{type:"text/csv;charset=utf-8"}),g=URL.createObjectURL(N),d=document.createElement("a");d.href=g,d.download=`BTL_Tracker_export_${new Date().toISOString().slice(0,10)}.csv`,d.click(),URL.revokeObjectURL(g)};return e.jsx("div",{className:"fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-5",role:"dialog","aria-modal":"true","aria-labelledby":"system-settings-title",children:e.jsxs("section",{className:"modal-sheet max-h-[92vh] w-full max-w-xl overflow-y-auto p-5 sm:rounded-3xl",children:[e.jsx("button",{type:"button",onClick:h,className:"absolute right-5 top-5 rounded-xl p-2 text-gray-400 transition hover:bg-white/10 hover:text-white","aria-label":"Fermer",children:e.jsx(C,{size:18})}),e.jsxs("div",{className:"flex items-start gap-3 pr-10",children:[e.jsx("div",{className:"rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/10 p-3 text-fuchsia-100",children:e.jsx(S,{size:22})}),e.jsxs("div",{children:[e.jsx("p",{className:"text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200/70",children:"Super admin"}),e.jsx("h2",{id:"system-settings-title",className:"mt-1 text-lg font-black",children:"Paramètres de la base"}),e.jsx("p",{className:"mt-1 text-xs text-gray-400",children:"Configuration commune aux deux campagnes."})]})]}),o&&e.jsx("div",{className:`mt-4 rounded-2xl border p-3 text-xs font-bold ${o.type==="success"?"border-emerald-400/30 bg-emerald-400/10 text-emerald-100":"border-red-400/40 bg-red-500/10 text-red-100"}`,children:o.text}),e.jsxs("div",{className:"mt-5 space-y-4",children:[e.jsxs("section",{className:"rounded-2xl border border-cyan-300/25 bg-cyan-400/[0.05] p-4",children:[e.jsxs("div",{className:"flex items-center gap-2 text-cyan-100",children:[e.jsx(z,{size:16}),e.jsx("b",{className:"text-xs uppercase tracking-wide",children:"Connexion Supabase"})]}),e.jsx("p",{className:"mt-2 text-[11px] leading-relaxed text-gray-400",children:"Les valeurs sont conservées uniquement dans le stockage local de cet appareil et remplacent la configuration embarquée si elles sont renseignées."}),e.jsx("label",{className:"mt-3 block text-[10px] font-black uppercase text-gray-400",children:"URL Supabase"}),e.jsx("input",{value:l,onChange:a=>_(a.target.value),placeholder:"https://votre-projet.supabase.co",inputMode:"url",className:"app-input mt-1 w-full rounded-2xl px-3 py-2.5 text-xs"}),e.jsx("label",{className:"mt-3 block text-[10px] font-black uppercase text-gray-400",children:"API publishable / anon key"}),e.jsx("input",{value:c,onChange:a=>f(a.target.value),type:"password",autoComplete:"off",placeholder:"sb_publishable_… ou eyJ…",className:"app-input mt-1 w-full rounded-2xl px-3 py-2.5 text-xs"})]}),e.jsxs("section",{className:"rounded-2xl border border-amber-300/25 bg-amber-400/[0.05] p-4",children:[e.jsxs("div",{className:"flex items-center gap-2 text-amber-100",children:[e.jsx(L,{size:16}),e.jsx("b",{className:"text-xs uppercase tracking-wide",children:"Gemini OCR"})]}),e.jsx("p",{className:"mt-2 text-[11px] leading-relaxed text-gray-400",children:"La clé permet de suggérer l’identifiant de transaction à partir d’une capture. Elle reste stockée localement et n’est jamais intégrée au build publié."}),e.jsx("input",{value:m,onChange:a=>j(a.target.value),type:"password",autoComplete:"off",placeholder:"Clé API Gemini",className:"app-input mt-3 w-full rounded-2xl px-3 py-2.5 text-xs"})]}),e.jsxs("button",{type:"button",onClick:v,className:"btn-neon btn-red flex w-full items-center justify-center gap-2",children:[e.jsx(R,{size:16})," Enregistrer les paramètres"]}),e.jsxs("details",{className:"rounded-2xl border border-white/10 bg-white/[0.035] p-4",children:[e.jsxs("summary",{className:"flex cursor-pointer items-center gap-2 text-xs font-black uppercase text-gray-200",children:[e.jsx(E,{size:16,className:"text-violet-200"})," schema.sql"]}),e.jsx("pre",{className:"mt-3 max-h-64 overflow-auto rounded-xl bg-black/50 p-3 text-[10px] leading-relaxed text-emerald-200",children:D})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("button",{type:"button",onClick:k,className:"flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-3 py-3 text-xs font-black uppercase text-white transition hover:bg-white/10",children:[e.jsx(U,{size:16,className:"text-cyan-200"})," Exporter"]}),e.jsxs("button",{type:"button",onClick:()=>{window.confirm("Vider le cache local et déconnecter cet appareil ?")&&(M(),window.location.reload())},className:"flex items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/[0.08] px-3 py-3 text-xs font-black uppercase text-red-100 transition hover:bg-red-500/15",children:[e.jsx(A,{size:16})," Vider le cache"]})]}),e.jsxs("p",{className:"flex items-center gap-2 text-[10px] text-gray-500",children:[e.jsx(K,{size:13})," Les données opérationnelles se synchronisent depuis Supabase ; aucun import de fichier ou service externe n’est disponible."]})]})]})})};export{X as SystemConfigurationModal};
