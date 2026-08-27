import{E as B}from"./jspdf.es.min-DEtGlfVV.js";import U from"./html2canvas.esm-QH1iLAAe.js";import"./index-Bvq_K8Hi.js";import"./vendor-react-UcvdFEdZ.js";import"./vendor-supabase-CG6S1lgy.js";function a(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function Y(t,i){const s=t.filter(r=>Number.isFinite(r)),d=i.filter(r=>Number.isFinite(r)),p=[...s,...d];if(!s.length&&!d.length)return'<div style="margin-top:8px; font-size:10px; color:#64748b; font-style:italic;">Aucune évolution disponible pour cette période.</div>';const c=Math.max(...p,1),l=260,n=90,f=16,g=Math.max(s.length,d.length,1),m=g>1?(l-f*2)/(g-1):0,u=r=>r.length?r.map((v,z)=>{const k=f+m*z,T=n-f-v/c*(n-f*2);return`${k},${T}`}).join(" "):"",w=u(s),b=u(d),$=s[s.length-1]??0,o=d[d.length-1]??0;return`
    <div style="margin-top:8px;">
      <svg width="100%" height="100" viewBox="0 0 ${l} ${n}" preserveAspectRatio="none" style="display:block; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
        <line x1="${f}" y1="${n-f}" x2="${l-f}" y2="${n-f}" stroke="#cbd5e1" stroke-width="1" />
        ${w?`<polyline fill="none" stroke="#2563eb" stroke-width="2.2" stroke-dasharray="4 3" points="${w}" />`:""}
        ${b?`<polyline fill="none" stroke="#dc2626" stroke-width="3" points="${b}" />`:""}
      </svg>
      <div style="font-size:10px; color:#e2e8f0; margin-top:4px; display:flex; gap:10px; flex-wrap:wrap;">
        <span>🎯 Targets journaliers: <b>${$}</b></span>
        <span>📈 Activations journalières: <b>${o}</b></span>
      </div>
    </div>
  `}function M(t,i,s,d,p){const c=Math.max(1,i),l=Math.min(100,Math.round(t/c*100)),f=2*Math.PI*24,g=f*(1-l/100),m=`${t}/${c}`;return`
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:33%; min-width:0;">
      <svg width="70" height="70" viewBox="0 0 70 70" style="display:block;">
        <circle cx="35" cy="35" r="24" fill="none" stroke="${d}" stroke-width="8" />
        <circle cx="35" cy="35" r="24" fill="none" stroke="${s}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${f}" stroke-dashoffset="${g}" transform="rotate(-90 35 35)" />
        <text x="35" y="40" text-anchor="middle" style="font-size:9px; font-weight:900; fill:#111827;">${m}</text>
      </svg>
      <span style="font-size:9px; font-weight:800; color:#475569; text-transform:uppercase; margin-top:4px;">${p}</span>
    </div>
  `}function O(t){return`<div style="page-break-after:always; padding-bottom:16px;">${t}</div>`}function j(t){const i=t.arrivalTime&&t.arrivalTime.trim()?t.arrivalTime:"00:00",s=t.departureTime&&t.departureTime.trim()?t.departureTime:"00:00",d=t.pointagePhoto||(t.photos&&t.photos.length>0?t.photos[0]:""),p=(t.comment||"").trim()||"Rien à signaler",c=(t.leads||[]).map(o=>{const r=o.timestamp||"";return{timestamp:(r.includes("T")?r.split("T")[1].substring(0,5):r.substring(0,5)||"00:00")||"00:00",client_name:(o.client_name||"").trim()||"Anonyme",msisdn:(o.msisdn||"").trim()||"N/A",action_type:(o.action_type||"").trim()||"Action non renseignée"}}),l=t.totalPrivilege+t.totalRoaming+t.totalBundles,n=t.targets.privilege+t.targets.roaming+t.targets.bundle;Math.min(100,Math.round(t.totalPrivilege/Math.max(1,t.targets.privilege)*100)),Math.min(100,Math.round(t.totalRoaming/Math.max(1,t.targets.roaming)*100)),Math.min(100,Math.round(t.totalBundles/Math.max(1,t.targets.bundle)*100));const f=o=>!o||o==="00:00"||o==="-"||o.toLowerCase().includes("non disponible")?"":o.startsWith("http")?o:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o)}`,g=f(t.mapsIn),m=f(t.mapsOut),u=g?`<a href="${g}" target="_blank" rel="noopener noreferrer" style="display:inline-block; margin-top:6px; font-size:9px; color:#E60000; font-weight:bold; text-decoration:none; border:1px solid #E60000; padding:4px 10px; border-radius:6px; background:#fff;">📍 Vérifier GPS (Carte)</a>`:'<span style="display:inline-block; margin-top:6px; font-size:9px; color:#999; font-weight:bold; border:1px solid #ddd; padding:4px 10px; border-radius:6px; background:#fafafa;">Coordonnées non disponibles</span>',w=m?`<a href="${m}" target="_blank" rel="noopener noreferrer" style="display:inline-block; margin-top:6px; font-size:9px; color:#E60000; font-weight:bold; text-decoration:none; border:1px solid #E60000; padding:4px 10px; border-radius:6px; background:#fff;">📍 Vérifier GPS (Carte)</a>`:'<span style="display:inline-block; margin-top:6px; font-size:9px; color:#999; font-weight:bold; border:1px solid #ddd; padding:4px 10px; border-radius:6px; background:#fafafa;">Coordonnées non disponibles</span>',b=t.photos&&t.photos.length>1?`<div style="margin-top:20px; font-size:10px; font-weight:800; color:#999; text-transform:uppercase; border-bottom:1px solid #eee; padding-bottom:5px;">PREUVES TERRAIN / BOUTIQUE (PHOTOS)</div>
       <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
         ${t.photos.slice(1).map(o=>`<div style="width:31%; height:110px; border-radius:12px; border:1px solid #eee; overflow:hidden; background:#f8fafc; display:flex; align-items:center; justify-content:center;"><img src="${o}" style="max-width:100%; max-height:100%; width:auto; height:auto; object-fit:contain; object-position:center; display:block;"></div>`).join("")}
       </div>`:"",$=Y(t.evolutionTargetData||[],t.evolutionActivationData||t.evolutionData||[]);return`
    <style>
      body { font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      * { box-sizing: border-box; }
    </style>
    <div style="background:linear-gradient(135deg,#0f172a 0%,#111827 48%,#7f1d1d 100%); color:#fff; border-radius:20px; padding:18px; margin-bottom:16px; box-shadow:0 12px 30px rgba(2,6,23,0.35); position:relative; overflow:hidden; font-family:'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="position:absolute; inset:0; opacity:0.08; background-image:repeating-linear-gradient(45deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 10px); pointer-events:none;"></div>
      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="width:90px; vertical-align:top;">
            <div style="width:80px; height:80px; border-radius:16px; border:3px solid #ef4444; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#0b1220;">
              ${d?`<img src="${d}" style="max-width:100%; max-height:100%; width:auto; height:auto; object-fit:contain; object-position:center; display:block;">`:'<span style="font-size:10px; font-weight:900; color:#cbd5e1; text-transform:uppercase; text-align:center;">Photo non disponible</span>'}
            </div>
          </td>
          <td style="vertical-align:top; padding-left:14px;">
            <div style="font-size:10px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#fda4af;">📌 Rapport d'activation journalier</div>
            <div style="font-size:26px; line-height:1.05; font-weight:900; text-transform:uppercase; margin-top:4px;">${a(t.agentName)}</div>
            <div style="font-size:12px; color:#e2e8f0; margin-top:6px;">Shop: <b>${a(t.shopName)}</b> • Date: <b>${a(t.date)}</b></div>
          </td>
        </tr>
      </table>
    </div>

    <table style="width:100%; border-spacing:10px; margin-left:-10px;">
      <tr>
        <td style="width:34%;">
          <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; padding:12px; min-height:120px;">
            <div style="font-size:9px; font-weight:800; text-transform:uppercase; color:#6b7280;">🕘 Arrivée</div>
            <div style="font-size:18px; font-weight:900; color:#111827; margin-top:4px;">${a(i)}</div>
            ${u}
          </div>
        </td>
        <td style="width:33%;">
          <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; padding:12px; min-height:120px;">
            <div style="font-size:9px; font-weight:800; text-transform:uppercase; color:#6b7280;">🕔 Départ</div>
            <div style="font-size:18px; font-weight:900; color:#111827; margin-top:4px;">${a(s)}</div>
            ${w}
          </div>
        </td>
        <td style="width:33%;">
          <div style="background:linear-gradient(140deg,#111827 0%,#1f2937 100%); border-radius:14px; padding:12px; color:white; min-height:120px; position:relative; overflow:hidden;">
            <div style="position:absolute; right:-10px; top:-8px; font-size:42px; opacity:0.16;">↗</div>
            <div style="font-size:9px; font-weight:800; text-transform:uppercase; opacity:0.85;">📈 Évolution</div>
            ${$}
          </div>
        </td>
      </tr>
    </table>

    <table style="width:100%; border-spacing:10px; margin-left:-10px; margin-top:4px;">
      <tr>
        <td style="width:100%;" colspan="3">
          <div style="background:#ffffff; border:1px solid #e5e7eb; padding:12px; border-radius:14px;">
            <div style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase; margin-bottom:8px; letter-spacing:0.7px;">📊 Répartition & performance</div>
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:6px;">
              ${M(t.totalPrivilege,Math.max(t.targets.privilege,1),"#dc2626","#fee2e2","Privilège")}
              ${M(t.totalRoaming,Math.max(t.targets.roaming,1),"#d97706","#fef3c7","Roaming")}
              ${M(t.totalBundles,Math.max(t.targets.bundle,1),"#2563eb","#dbeafe","Bundles")}
            </div>
            <div style="margin-top:10px; font-size:10px; color:#64748b;">Total journalier: <b>${l}</b> / <b>${n}</b> • Taux global: <b>${Math.min(100,Math.round(l/Math.max(1,n)*100))}%</b></div>
          </div>
        </td>
      </tr>
    </table>

    <div style="font-size:10px; font-weight:800; color:#6b7280; text-transform:uppercase; margin-top:15px; margin-bottom:10px; border-bottom:1px solid #e5e7eb; padding-bottom:5px; letter-spacing:1px;">Liste détaillée des numéros & activations (${c.length})</div>
    <table style="width:100%; border-collapse:collapse; margin-top:6px; border:1px solid #eee;">
      <thead>
        <tr style="background:#1a1a1a; color:white; font-size:9px; text-transform:uppercase;">
          <th style="padding:6px; text-align:left;">Heure</th>
          <th style="padding:6px; text-align:left;">Client</th>
          <th style="padding:6px; text-align:left;">N° MSISDN</th>
          <th style="padding:6px; text-align:right;">Action / Offre</th>
        </tr>
      </thead>
      <tbody>
        ${c.length>0?c.map((o,r)=>`
          <tr style="border-bottom:1px solid #eee; font-size:10px; background:${r%2===0?"#fff":"#fcfcfc"};">
            <td style="padding:6px;">${a(o.timestamp||"00:00")}</td>
            <td style="padding:6px;"><b>${a(o.client_name)}</b></td>
            <td style="padding:6px; font-family:monospace; font-weight:bold; color:#E60000;">${a(o.msisdn)}</td>
            <td style="padding:6px; text-align:right; font-weight:bold; color:#333;">${a(o.action_type)}</td>
          </tr>
        `).join(""):`
          <tr>
            <td colspan="4" style="padding:12px; text-align:center; color:#999; font-size:10px; font-style:italic;">Aucune activation saisie aujourd'hui.</td>
          </tr>
        `}
      </tbody>
    </table>

    ${b}

    <div style="font-size:10px; font-weight:800; color:#6b7280; text-transform:uppercase; margin-top:15px; margin-bottom:5px;">Commentaires / Observations</div>
    <div style="font-size:11px; font-style:italic; background:#f9f9f9; padding:10px; border-radius:10px; border:1px solid #eee;">${a(p)}</div>

    <div style="margin-top:30px; text-align:center; font-size:9px; color:#888; text-transform:uppercase; letter-spacing:1px; font-weight:bold;">
      BTL DEPLOYMENT TRACKER - by Eldorado Design
    </div>
  `}async function J(t){const i=document.createElement("div");i.style.position="fixed",i.style.left="-9999px",i.style.top="0px",i.style.width="794px",i.style.backgroundColor="#ffffff",i.style.color="#1a1a1a",i.style.fontFamily="Helvetica, Arial, sans-serif",i.style.padding="30px",i.style.boxSizing="border-box",i.innerHTML=t,document.body.appendChild(i);try{const s=await U(i,{scale:2,useCORS:!0,logging:!1,backgroundColor:"#ffffff"}),d=s.toDataURL("image/png"),p=new B("p","mm","a4"),c=p.internal.pageSize.getWidth(),l=s.height*c/s.width;return p.addImage(d,"PNG",0,0,c,l),p.output("datauristring")}finally{document.body.removeChild(i)}}async function _(t){const i=new B("p","mm","a4"),s=i.internal.pageSize.getWidth(),d=i.internal.pageSize.getHeight(),p=794,c=1123;for(let l=0;l<t.length;l+=1){const n=document.createElement("div");n.style.position="fixed",n.style.left="-9999px",n.style.top="0px",n.style.width=`${p}px`,n.style.minHeight=`${c}px`,n.style.backgroundColor="#ffffff",n.style.color="#1a1a1a",n.style.fontFamily='"Segoe UI", Arial, Helvetica, sans-serif',n.style.padding="24px",n.style.boxSizing="border-box",n.innerHTML=t[l],document.body.appendChild(n);try{const g=(await U(n,{scale:2,useCORS:!0,logging:!1,backgroundColor:"#ffffff"})).toDataURL("image/png");l>0&&i.addPage(),i.addImage(g,"PNG",0,0,s,d)}finally{document.body.removeChild(n)}}return i.output("datauristring")}async function rt(t){return J(j(t))}async function nt(t){return _(F(t))}function F(t){var T,S,H;const i=t.team.filter(e=>e.status!=="Absent").length,s=t.team.filter(e=>e.status==="Clôturé").length,d=t.team.reduce((e,h)=>e+h.stats.priv+h.stats.roam+h.stats.bund,0),p=((T=t.reports)==null?void 0:T.length)||0,c=e=>`
    <div style="
      width:100%;
      font-family:'Segoe UI', Arial, Helvetica, sans-serif;
      color:#0f172a;
      display:flex;
      flex-direction:column;
      gap:12px;
    ">
      ${e}
    </div>
  `,l=`
    <div style="background:linear-gradient(140deg,#111827 0%,#312e81 48%,#991b1b 100%); border-radius:24px; padding:24px; color:#fff; margin-bottom:18px;">
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#c4b5fd; font-weight:800;">Rapport de supervision</div>
      <div style="font-size:28px; font-weight:900; margin-top:6px;">${a(t.supName)}</div>
      <div style="font-size:12px; color:#e2e8f0; margin-top:5px;">Période: <b>${a(t.date)}</b></div>
      <div style="font-size:11px; color:#dbeafe; margin-top:10px;">A4 • Synthèse équipe • ${t.team.length} hôtesse(s) • ${p} rapport(s)</div>
    </div>
  `,n=`
    <table style="width:100%; border-spacing:10px; margin-left:-10px; margin-bottom:10px;">
      <tr>
        <td style="width:33%;"><div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; padding:12px; text-align:center;"><div style="font-size:9px; color:#6b7280; text-transform:uppercase; font-weight:800;">Actifs</div><div style="font-size:24px; font-weight:900; color:#111827;">${i}/${t.team.length}</div></div></td>
        <td style="width:33%;"><div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:14px; padding:12px; text-align:center;"><div style="font-size:9px; color:#166534; text-transform:uppercase; font-weight:800;">Clôturés</div><div style="font-size:24px; font-weight:900; color:#15803d;">${s}</div></div></td>
        <td style="width:34%;"><div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:14px; padding:12px; text-align:center;"><div style="font-size:9px; color:#1e3a8a; text-transform:uppercase; font-weight:800;">Leads équipe</div><div style="font-size:24px; font-weight:900; color:#1d4ed8;">${d}</div></div></td>
      </tr>
    </table>
  `,f=e=>{const h=e.stats.priv+e.stats.roam+e.stats.bund,C=e.status==="Clôturé"?"Clôturé":e.status==="Présent"?"Présent":"Absent";return`
      <div style="border:1px solid #e5e7eb; border-radius:14px; padding:12px; background:#ffffff; min-height:162px; display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div>
            <div style="font-size:13px; font-weight:900; text-transform:uppercase; color:#111827;">${a(e.name)}</div>
            <div style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase;">${a(e.shop)}</div>
          </div>
          <span style="font-size:9px; font-weight:900; padding:4px 9px; border-radius:999px; border:1px solid ${e.status==="Clôturé"?"#86efac":e.status==="Présent"?"#93c5fd":"#fecaca"}; color:${e.status==="Clôturé"?"#166534":e.status==="Présent"?"#1e3a8a":"#991b1b"}; background:${e.status==="Clôturé"?"#f0fdf4":e.status==="Présent"?"#eff6ff":"#fef2f2"};">${a(C)}</span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px;">
          <div style="border:1px solid #fee2e2; border-radius:10px; background:#fff5f5; padding:8px; text-align:center;">
            <div style="font-size:8px; text-transform:uppercase; color:#7f1d1d; font-weight:800;">Privilège</div>
            <div style="font-size:16px; font-weight:900; color:#991b1b; line-height:1.1;">${e.stats.priv}</div>
          </div>
          <div style="border:1px solid #fde68a; border-radius:10px; background:#fffbeb; padding:8px; text-align:center;">
            <div style="font-size:8px; text-transform:uppercase; color:#78350f; font-weight:800;">Roaming</div>
            <div style="font-size:16px; font-weight:900; color:#92400e; line-height:1.1;">${e.stats.roam}</div>
          </div>
          <div style="border:1px solid #bfdbfe; border-radius:10px; background:#eff6ff; padding:8px; text-align:center;">
            <div style="font-size:8px; text-transform:uppercase; color:#1e3a8a; font-weight:800;">Bundle</div>
            <div style="font-size:16px; font-weight:900; color:#1d4ed8; line-height:1.1;">${e.stats.bund}</div>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; gap:8px; margin-top:auto;">
          <div style="font-size:10px; color:#334155; font-weight:700;">Arrivée: <b>${a(e.arrivalTime||"00:00")}</b></div>
          <div style="font-size:10px; color:#334155; font-weight:700;">Clôture: <b>${a(e.departureTime||"00:00")}</b></div>
          <div style="font-size:10px; color:#0f172a; font-weight:900;">Total: ${h}</div>
        </div>
      </div>
    `},g=e=>`
    <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; align-content:start;">
      ${e.map(h=>f(h)).join("")}
    </div>
  `,m=8,u=10,w=t.team.slice(0,m),b=t.team.slice(m),$=(S=t.comment)!=null&&S.trim()?`<div style="background:#f0fdfa; border:1px solid #99f6e4; border-radius:14px; padding:14px; margin-bottom:12px;"><div style="font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:1px; color:#0f766e;">Commentaire du superviseur</div><div style="font-size:11px; line-height:1.55; color:#134e4a; margin-top:6px; white-space:pre-wrap;">${a(t.comment.trim())}</div></div>`:"",o=[l+n+$+g(w)];for(let e=0;e<b.length;e+=u)o.push(g(b.slice(e,e+u)));const r=(()=>{var I,L;if(!t.team.length)return`
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:18px; padding:16px;">
          <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#64748b; font-weight:800;">Performances de la journée</div>
          <div style="font-size:11px; color:#64748b; margin-top:8px;">Aucune donnée agent disponible pour tracer l'histogramme.</div>
        </div>
      `;const e=t.team.flatMap(x=>[x.stats.priv,x.stats.roam,x.stats.bund]),h=Math.max(1,...e),C=122,D=t.team.reduce((x,y)=>x+y.stats.priv+y.stats.roam+y.stats.bund,0),V=(t.reports||[]).reduce((x,y)=>{const P=y.targets||{privilege:0,roaming:0,bundle:0};return x+Number(P.privilege||0)+Number(P.roaming||0)+Number(P.bundle||0)},0),A=Number(((I=t.dayTargets)==null?void 0:I.total)||0)||V,N=A>0?Math.round(D/A*100):0,W=Math.min(100,Math.max(0,N)),R=44,E=2*Math.PI*R,q=E*(1-W/100),X=t.team.map(x=>{const y=(P,K)=>{const Q=Math.max(2,Math.round(P/h*C));return`
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:4px;">
            <div style="font-size:8px; color:#334155; font-weight:900; line-height:1;">${P}</div>
            <div style="width:8px; height:${Q}px; border-radius:6px 6px 0 0; background:${K};"></div>
          </div>
        `};return`
        <div style="display:flex; flex-direction:column; align-items:center; gap:8px; min-width:46px;">
          <div style="height:${C}px; display:flex; align-items:flex-end; gap:3px;">
            ${y(x.stats.priv,"#dc2626")}
            ${y(x.stats.roam,"#d97706")}
            ${y(x.stats.bund,"#2563eb")}
          </div>
          <div style="font-size:8px; line-height:1.15; color:#475569; font-weight:800; text-transform:uppercase; width:46px; min-height:20px; text-align:center; white-space:normal; word-break:break-word; overflow-wrap:anywhere;">
            ${a(x.name.split(" ").slice(0,2).join(" ")||x.name)}
          </div>
        </div>
      `}).join("");return`
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:18px; padding:16px;">
        <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#64748b; font-weight:800;">Performances de la journée</div>
        <div style="display:flex; align-items:flex-start; gap:12px; margin-top:8px;">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:10px; font-size:9px; color:#334155; font-weight:800;">
              <span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:2px; background:#dc2626;"></span>Privilège</span>
              <span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:2px; background:#d97706;"></span>Roaming</span>
              <span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:2px; background:#2563eb;"></span>Bundle</span>
              <span style="margin-left:auto; font-size:9px; color:#64748b;">Max: ${h}</span>
            </div>
            <div style="margin-top:10px; padding:8px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc; overflow-x:auto;">
              <div style="display:flex; align-items:flex-end; gap:8px; min-height:${C+42}px; min-width:max-content;">
                ${X}
              </div>
            </div>
          </div>
          <div style="width:180px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc; padding:10px; text-align:center;">
            <div style="font-size:9px; text-transform:uppercase; color:#64748b; font-weight:800; letter-spacing:0.6px;">Performance globale</div>
            <svg width="116" height="116" viewBox="0 0 116 116" style="display:block; margin:8px auto 2px auto;">
              <circle cx="58" cy="58" r="${R}" fill="none" stroke="#e2e8f0" stroke-width="12" />
              <circle cx="58" cy="58" r="${R}" fill="none" stroke="#0ea5e9" stroke-width="12" stroke-linecap="round" stroke-dasharray="${E}" stroke-dashoffset="${q}" transform="rotate(-90 58 58)" />
              <text x="58" y="54" text-anchor="middle" style="font-size:19px; font-weight:900; fill:#0f172a;">${N}%</text>
              <text x="58" y="68" text-anchor="middle" style="font-size:8px; font-weight:800; fill:#64748b; text-transform:uppercase;">du target</text>
            </svg>
            <div style="font-size:10px; color:#334155; font-weight:800; margin-top:2px;">${D} / ${A||"N/A"}</div>
            <div style="font-size:8px; color:#64748b; margin-top:3px; line-height:1.2;">Target du jour = targets définis × ${((L=t.dayTargets)==null?void 0:L.deployedCount)??t.team.length} hôtesse(s) déployée(s).</div>
          </div>
        </div>
      </div>
    `})(),v=`
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:18px; padding:20px;">
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#64748b; font-weight:800;">Clôture de compilation</div>
      <div style="font-size:24px; font-weight:900; color:#111827; margin-top:4px;">Rapports inclus: ${((H=t.reports)==null?void 0:H.length)||0}</div>
      <div style="font-size:11px; color:#475569; margin-top:8px;">La compilation regroupe désormais les rapports journaliers des agents de la période choisie.</div>
    </div>
  `,z=r+v,k=(t.reports||[]).map(e=>j(e));if(k.length>0){const e=k.length-1;k[e]=k[e]+z}else if(o.length>0){const e=o.length-1;o[e]=o[e]+z}else o.push(z);return[...o,...k].map(e=>O(c(e)))}function at(t){return F(t).join("")}async function st(t){return _(G(t))}function G(t){var b,$,o;const i=t.rows||[],s=t.totals||{privilege:0,roaming:0,bundles:0},d=r=>{const v=new Date(`${r}T00:00:00`);return Number.isNaN(v.getTime())?r:v.toLocaleDateString("fr-FR",{weekday:"long",day:"2-digit",month:"short",year:"numeric"})},p=(t.period||"").match(/(\d{4}-\d{2}-\d{2})\s+au\s+(\d{4}-\d{2}-\d{2})/i),c=(p==null?void 0:p[1])||((b=i[0])==null?void 0:b.date)||"",l=(p==null?void 0:p[2])||(($=i[i.length-1])==null?void 0:$.date)||c,n=`
    <div style="background:linear-gradient(135deg,#111827 0%,#1d4ed8 46%,#dc2626 100%); color:#fff; border-radius:24px; padding:24px; margin-bottom:18px;">
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#dbeafe; font-weight:800;">Compilation de période</div>
      <div style="font-size:34px; font-weight:900; margin-top:6px;">Rapport compilé</div>
      <div style="font-size:12px; color:#e2e8f0; margin-top:8px;">Période du <b>${a(d(c))}</b> au <b>${a(d(l))}</b></div>
    </div>
  `,f=`
    <table style="width:100%; border-spacing:10px; margin-left:-10px; margin-bottom:10px;">
      <tr>
        <td style="width:25%;"><div style="background:#fff5f5; border:1px solid #fecaca; border-radius:14px; text-align:center; padding:14px;"><div style="font-size:9px; color:#991b1b; text-transform:uppercase; font-weight:800;">Privilège</div><div style="font-size:24px; font-weight:900; color:#7f1d1d; margin-top:3px;">${s.privilege}</div></div></td>
        <td style="width:25%;"><div style="background:#fffbeb; border:1px solid #fde68a; border-radius:14px; text-align:center; padding:14px;"><div style="font-size:9px; color:#92400e; text-transform:uppercase; font-weight:800;">Roaming</div><div style="font-size:24px; font-weight:900; color:#78350f; margin-top:3px;">${s.roaming}</div></div></td>
        <td style="width:25%;"><div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:14px; text-align:center; padding:14px;"><div style="font-size:9px; color:#1e3a8a; text-transform:uppercase; font-weight:800;">Bundles</div><div style="font-size:24px; font-weight:900; color:#1d4ed8; margin-top:3px;">${s.bundles}</div></div></td>
        <td style="width:25%;"><div style="background:#0f172a; border:1px solid #334155; border-radius:14px; text-align:center; padding:14px;"><div style="font-size:9px; color:#cbd5e1; text-transform:uppercase; font-weight:800;">Total rapports</div><div style="font-size:24px; font-weight:900; color:#ffffff; margin-top:3px;">${i.length}</div></div></td>
      </tr>
    </table>
  `,g=i.length>0?`
    <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#334155; font-weight:800; margin-bottom:8px;">Tableau des rapports</div>
    <table style="width:100%; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">
      <thead>
        <tr style="background:#0f172a; color:#ffffff; border-bottom:1px solid #1e293b;">
          <th style="text-align:left; font-size:10px; padding:9px;">Date</th>
          <th style="text-align:left; font-size:10px; padding:9px;">Agent</th>
          <th style="text-align:center; font-size:10px; padding:9px;">PRV</th>
          <th style="text-align:center; font-size:10px; padding:9px;">ROA</th>
          <th style="text-align:center; font-size:10px; padding:9px;">BND</th>
          <th style="text-align:center; font-size:10px; padding:9px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${i.map((r,v)=>{const z=r.priv+r.roam+r.bund;return`
          <tr style="border-bottom:1px solid #e5e7eb; font-size:10px; background:${v%2===0?"#ffffff":"#f8fafc"};">
            <td style="padding:8px;">${a(r.date)}</td>
            <td style="padding:8px;"><b>${a(r.agent)}</b></td>
            <td style="padding:8px; text-align:center; color:#991b1b; font-weight:800;">${r.priv}</td>
            <td style="padding:8px; text-align:center; color:#92400e; font-weight:800;">${r.roam}</td>
            <td style="padding:8px; text-align:center; color:#1e3a8a; font-weight:800;">${r.bund}</td>
            <td style="padding:8px; text-align:center; color:#0f172a; font-weight:900;">${z}</td>
          </tr>
        `}).join("")}
      </tbody>
    </table>
  `:'<div style="font-size:11px; color:#64748b;">Aucune ligne disponible pour cette période.</div>',m=(o=t.comment)!=null&&o.trim()?`<div style="background:#f0fdfa; border:1px solid #99f6e4; border-radius:14px; padding:14px; margin-bottom:12px;"><div style="font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:1px; color:#0f766e;">Commentaire du superviseur</div><div style="font-size:11px; line-height:1.55; color:#134e4a; margin-top:6px; white-space:pre-wrap;">${a(t.comment.trim())}</div></div>`:"",u=[n+f+m,g];t.reports&&t.reports.length&&u.push(...t.reports.map(r=>j(r)));const w=`
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:20px;">
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#64748b; font-weight:800;">Clôture de compilation</div>
      <div style="font-size:24px; font-weight:900; color:#111827; margin-top:4px;">${(t.reports||[]).length} rapports journaliers inclus</div>
      <div style="font-size:11px; color:#475569; margin-top:8px;">Fin du rapport compilé pour la période sélectionnée.</div>
    </div>
  `;return u.push(w),u.map(r=>O(r))}function dt(t){return G(t).join("")}export{dt as buildAdminBatchReportHtml,j as buildAgentReportHtml,at as buildSupervisorReportHtml,st as generateAdminBatchPDF,rt as generateAgentPDF,nt as generateSupervisorPDF};
