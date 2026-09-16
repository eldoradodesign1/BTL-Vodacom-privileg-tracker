import{r as n,j as e,X as L,a9 as R,aa as A,ab as K,ac as U,ad as B,a5 as G,T as P,f as T}from"./vendor-react-hJ4yCqyH.js";import{L as q,M as F,N as I,O,b as $,P as H,g as J,d as Q,j as X}from"./index-CcNVuHrm.js";import"./vendor-supabase-D_iOwayF.js";const W=`-- BTL Vodacom Privilege Tracker — schéma opérationnel
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
);`,Y=o=>`"${String(o??"").replace(/"/g,'""')}"`,ae=({isOpen:o,currentUser:d,onClose:C,onRefreshData:j})=>{const a=q(),[u,p]=n.useState((a==null?void 0:a.url)||""),[m,c]=n.useState((a==null?void 0:a.anonKey)||""),[g,N]=n.useState(""),[E,y]=n.useState(!!(a!=null&&a.geminiConfigured)),[D,h]=n.useState(!1),[v,M]=n.useState(!1),[f,l]=n.useState(null);if(n.useEffect(()=>{if(!o)return;let t=!0;return h(!0),F().then(s=>{t&&s&&(p(s.url),c(s.anonKey),y(s.geminiConfigured))}).catch(()=>{}).finally(()=>{t&&h(!1)}),()=>{t=!1}},[o]),!o)return null;const V=async()=>{if(d.role!=="super_admin"){l({type:"error",text:"Seul le super_admin peut modifier la configuration partagée."});return}if(!u.trim()||!m.trim()){l({type:"error",text:"Renseignez l’URL Supabase et la clé API publiable."});return}M(!0),l(null);try{new URL(u.trim());const t=await O({actor:{phone:d.phone,password:d.password},url:u,anonKey:m,geminiApiKey:g||void 0});p(t.url),c(t.anonKey),N(""),y(t.geminiConfigured),l({type:"success",text:"Configuration partagée mise à jour pour tous les appareils."}),j()}catch(t){l({type:"error",text:t instanceof Error?t.message:"La configuration partagée n’a pas pu être enregistrée."})}finally{M(!1)}},k=()=>{const s=[["users",$()],["shops",H()],["checkins",J()],["leads",Q()],["daily_reports",X()]].flatMap(([i,r])=>r.map(b=>({table:i,...b}))),_=Array.from(s.reduce((i,r)=>(Object.keys(r).forEach(b=>i.add(b)),i),new Set)),w=[_.join(","),...s.map(i=>_.map(r=>Y(i[r])).join(","))].join(`
`),z=new Blob(["\uFEFF"+w],{type:"text/csv;charset=utf-8"}),S=URL.createObjectURL(z),x=document.createElement("a");x.href=S,x.download=`BTL_Tracker_export_${new Date().toISOString().slice(0,10)}.csv`,x.click(),URL.revokeObjectURL(S)};return e.jsxDEV("div",{className:"fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-5",role:"dialog","aria-modal":"true","aria-labelledby":"system-settings-title",children:e.jsxDEV("section",{className:"modal-sheet max-h-[92vh] w-full max-w-xl overflow-y-auto p-5 sm:rounded-3xl",children:[e.jsxDEV("button",{type:"button",onClick:C,className:"absolute right-5 top-5 rounded-xl p-2 text-gray-400 transition hover:bg-white/10 hover:text-white","aria-label":"Fermer",children:e.jsxDEV(L,{size:18},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:105,columnNumber:177},void 0)},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:105,columnNumber:7},void 0),e.jsxDEV("div",{className:"flex items-start gap-3 pr-10",children:[e.jsxDEV("div",{className:"rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/10 p-3 text-fuchsia-100",children:e.jsxDEV(R,{size:22},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:106,columnNumber:150},void 0)},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:106,columnNumber:53},void 0),e.jsxDEV("div",{children:[e.jsxDEV("p",{className:"text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200/70",children:"Super admin"},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:106,columnNumber:183},void 0),e.jsxDEV("h2",{id:"system-settings-title",className:"mt-1 text-lg font-black",children:"Paramètres de la base"},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:106,columnNumber:284},void 0),e.jsxDEV("p",{className:"mt-1 text-xs text-gray-400",children:"Configuration commune à tous les appareils et aux deux campagnes."},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:106,columnNumber:377},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:106,columnNumber:178},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:106,columnNumber:7},void 0),f&&e.jsxDEV("div",{className:`mt-4 rounded-2xl border p-3 text-xs font-bold ${f.type==="success"?"border-emerald-400/30 bg-emerald-400/10 text-emerald-100":"border-red-400/40 bg-red-500/10 text-red-100"}`,children:f.text},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:107,columnNumber:19},void 0),e.jsxDEV("div",{className:"mt-5 space-y-4",children:[e.jsxDEV("section",{className:"rounded-2xl border border-cyan-300/25 bg-cyan-400/[0.05] p-4",children:[e.jsxDEV("div",{className:"flex items-center gap-2 text-cyan-100",children:[e.jsxDEV(A,{size:16},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:109,columnNumber:146},void 0),e.jsxDEV("b",{className:"text-xs uppercase tracking-wide",children:"Connexion Supabase"},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:109,columnNumber:167},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:109,columnNumber:91},void 0),e.jsxDEV("p",{className:"mt-2 text-[11px] leading-relaxed text-gray-400",children:"Ces valeurs sont préremplies avec la base actuellement utilisée. Après enregistrement, elles sont servies à tous les utilisateurs dès leur prochain chargement."},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:109,columnNumber:242},void 0),e.jsxDEV("label",{className:"mt-3 block text-[10px] font-black uppercase text-gray-400",children:"URL Supabase"},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:109,columnNumber:467},void 0),e.jsxDEV("input",{value:u,onChange:t=>p(t.target.value),placeholder:"https://votre-projet.supabase.co",inputMode:"url",className:"app-input mt-1 w-full rounded-2xl px-3 py-2.5 text-xs"},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:109,columnNumber:564},void 0),e.jsxDEV("label",{className:"mt-3 block text-[10px] font-black uppercase text-gray-400",children:"API publishable / anon key"},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:109,columnNumber:762},void 0),e.jsxDEV("input",{value:m,onChange:t=>c(t.target.value),type:"text",autoComplete:"off",placeholder:"sb_publishable_… ou eyJ…",className:"app-input mt-1 w-full rounded-2xl px-3 py-2.5 text-xs"},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:109,columnNumber:873},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:109,columnNumber:9},void 0),e.jsxDEV("section",{className:"rounded-2xl border border-amber-300/25 bg-amber-400/[0.05] p-4",children:[e.jsxDEV("div",{className:"flex items-center gap-2 text-amber-100",children:[e.jsxDEV(K,{size:16},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:110,columnNumber:149},void 0),e.jsxDEV("b",{className:"text-xs uppercase tracking-wide",children:"Gemini OCR"},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:110,columnNumber:170},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:110,columnNumber:93},void 0),e.jsxDEV("p",{className:"mt-2 text-[11px] leading-relaxed text-gray-400",children:"La clé Gemini est conservée côté serveur et sert à tous les agents Merchant. Elle n’est jamais renvoyée aux navigateurs."},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:110,columnNumber:237},void 0),e.jsxDEV("input",{value:g,onChange:t=>N(t.target.value),type:"password",autoComplete:"new-password",placeholder:E?"Clé Gemini déjà configurée — laissez vide pour conserver":"Clé API Gemini",className:"app-input mt-3 w-full rounded-2xl px-3 py-2.5 text-xs"},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:110,columnNumber:423},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:110,columnNumber:9},void 0),e.jsxDEV("button",{type:"button",disabled:D||v,onClick:()=>{V()},className:"btn-neon btn-red flex w-full items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60",children:[e.jsxDEV(U,{size:16},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:111,columnNumber:222},void 0)," ",v?"Enregistrement partagé…":"Enregistrer les paramètres"]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:111,columnNumber:9},void 0),e.jsxDEV("details",{className:"rounded-2xl border border-white/10 bg-white/[0.035] p-4",children:[e.jsxDEV("summary",{className:"flex cursor-pointer items-center gap-2 text-xs font-black uppercase text-gray-200",children:[e.jsxDEV(B,{size:16,className:"text-violet-200"},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:112,columnNumber:189},void 0)," schema.sql"]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:112,columnNumber:86},void 0),e.jsxDEV("pre",{className:"mt-3 max-h-64 overflow-auto rounded-xl bg-black/50 p-3 text-[10px] leading-relaxed text-emerald-200",children:W},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:112,columnNumber:257},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:112,columnNumber:9},void 0),e.jsxDEV("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxDEV("button",{type:"button",onClick:k,className:"flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-3 py-3 text-xs font-black uppercase text-white transition hover:bg-white/10",children:[e.jsxDEV(G,{size:16,className:"text-cyan-200"},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:113,columnNumber:275},void 0)," Exporter"]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:113,columnNumber:49},void 0),e.jsxDEV("button",{type:"button",onClick:()=>{window.confirm("Vider le cache local et déconnecter cet appareil ?")&&(I(),window.location.reload())},className:"flex items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/[0.08] px-3 py-3 text-xs font-black uppercase text-red-100 transition hover:bg-red-500/15",children:[e.jsxDEV(P,{size:16},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:113,columnNumber:702},void 0)," Vider le cache"]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:113,columnNumber:340},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:113,columnNumber:9},void 0),e.jsxDEV("p",{className:"flex items-center gap-2 text-[10px] text-gray-500",children:[e.jsxDEV(T,{size:13},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:114,columnNumber:74},void 0)," Les données opérationnelles se synchronisent depuis Supabase ; aucun import de fichier ou service externe n’est disponible."]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:114,columnNumber:9},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:108,columnNumber:7},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:104,columnNumber:5},void 0)},void 0,!1,{fileName:"/app/applet/src/components/Modals/SystemConfigurationModal.tsx",lineNumber:103,columnNumber:10},void 0)};export{ae as SystemConfigurationModal};
