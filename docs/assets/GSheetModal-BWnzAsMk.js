import{c as f,Y as b,Z as R,r as n,l as D,k as e,X as N,F as v,T as O,_ as L,$ as E,a0 as M,s as T,a1 as P}from"./index-DV6JxNXH.js";import{U as I}from"./upload-99OPpvrV.js";import{R as B}from"./refresh-cw-DJ4SvCwv.js";import{D as J}from"./download-CLh61a1A.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const G=[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]],F=f("circle-check-big",G);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const V=[["ellipse",{cx:"12",cy:"5",rx:"9",ry:"3",key:"msslwz"}],["path",{d:"M3 5V19A9 3 0 0 0 15 21.84",key:"14ibmq"}],["path",{d:"M21 5V8",key:"1marbg"}],["path",{d:"M21 12L18 17H22L19 22",key:"zafso"}],["path",{d:"M3 12A9 3 0 0 0 14.59 14.87",key:"1y4wr8"}]],j=f("database-zap",V);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $=[["path",{d:"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",key:"1cjeqo"}],["path",{d:"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",key:"19qd67"}]],z=f("link",$);async function W(){if(!b())return{ok:!1,message:"Configuration Supabase absente. Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY."};try{return{ok:!0,message:"Migration Supabase terminée.",summary:await R()}}catch(o){return{ok:!1,message:o instanceof Error?o.message:"Échec de la migration."}}}const K=({isOpen:o,onClose:k,onSyncSuccess:y})=>{const[s,h]=n.useState(D()),[c,i]=n.useState(!1),[d,r]=n.useState(null),[S,w]=n.useState(!1),[m,x]=n.useState(null),p=n.useRef(null);if(!o)return null;const _=async()=>{if(i(!0),r(null),M(s),s.sheetCsvUrl){const t=await T(s.sheetCsvUrl,{strictUsers:!0});t.success?(r({type:"success",text:t.message}),y()):r({type:"error",text:t.message})}else r({type:"success",text:"Paramètres Google Sheets enregistrés avec succès."});i(!1)},C=async t=>{var l;const u=(l=t.target.files)==null?void 0:l[0];if(u){i(!0),r(null);try{const a=await u.arrayBuffer(),g=await E(a,{strictUsers:!0});g.success?(r({type:"success",text:g.message}),y()):r({type:"error",text:g.message})}catch(a){r({type:"error",text:`Erreur de lecture du fichier : ${a.message||a}`})}finally{i(!1),p.current&&(p.current.value="")}}},A=()=>{const t=P(),u=new Blob(["\uFEFF"+t],{type:"text/csv;charset=utf-8;"}),l=URL.createObjectURL(u),a=document.createElement("a");a.href=l,a.download=`Vodacom_Base_Donnees_GSheet_${new Date().toISOString().split("T")[0]}.csv`,document.body.appendChild(a),a.click(),document.body.removeChild(a),URL.revokeObjectURL(l)},U=async()=>{w(!0),x(null);try{const t=await W();x({type:t.ok?"success":"error",text:t.message+(t.summary?` (${JSON.stringify(t.summary)})`:"")})}catch(t){x({type:"error",text:(t==null?void 0:t.message)||"Échec de la migration"})}finally{w(!1)}};return e.jsx("div",{className:"fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop",children:e.jsxs("div",{className:"modal-sheet relative w-full max-w-lg max-h-[90vh] overflow-y-auto",children:[e.jsx("div",{className:"modal-handle"}),e.jsx("button",{onClick:k,className:"absolute top-6 right-6 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10",children:e.jsx(N,{className:"w-5 h-5"})}),e.jsxs("div",{className:"flex items-center space-x-3 mb-6",children:[e.jsx("div",{className:"p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30",children:e.jsx(v,{className:"w-6 h-6"})}),e.jsxs("div",{children:[e.jsxs("h2",{className:"text-xl font-black uppercase text-white tracking-wider",children:["Import & Synchro ",e.jsx("span",{className:"text-emerald-400",children:"Multi-Onglets"})]}),e.jsx("p",{className:"text-xs text-gray-400 font-semibold mt-0.5",children:"Chargement direct Fichier Excel (.xlsx) ou Lien Google Sheets"})]})]}),d&&e.jsxs("div",{className:`p-3.5 rounded-2xl border mb-4 text-xs font-bold flex items-center space-x-2 ${d.type==="success"?"bg-emerald-500/10 border-emerald-500/30 text-emerald-400":"bg-red-500/10 border-red-500/30 text-red-400"}`,children:[d.type==="success"?e.jsx(F,{className:"w-4 h-4 shrink-0"}):e.jsx(N,{className:"w-4 h-4 shrink-0"}),e.jsx("span",{children:d.text})]}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl",children:[e.jsxs("label",{className:"text-xs font-black uppercase text-emerald-400 block mb-2 flex items-center space-x-2",children:[e.jsx(I,{className:"w-4 h-4"}),e.jsx("span",{children:"Importer un Fichier Excel complet (.xlsx)"})]}),e.jsx("p",{className:"text-[11px] text-gray-300 mb-3",children:"Permet de parcourir et charger automatiquement tous les onglets (Users, Shops, Leads, DailyReports) à partir d'un fichier Excel."}),e.jsx("input",{type:"file",ref:p,accept:".xlsx,.xls,.csv",onChange:C,className:"hidden"}),e.jsxs("button",{onClick:()=>{var t;return(t=p.current)==null?void 0:t.click()},disabled:c,className:"w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs rounded-xl flex items-center justify-center space-x-2 shadow-lg transition-all",children:[e.jsx(v,{className:"w-4 h-4"}),e.jsx("span",{children:c?"Traitement du fichier...":"Sélectionner Fichier .XLSX / .CSV"})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-black uppercase text-gray-400 block mb-1",children:"Ou Lien Google Sheets Publié (Import Web)"}),e.jsxs("div",{className:"relative",children:[e.jsx(z,{className:"w-4 h-4 text-gray-500 absolute left-3 top-3"}),e.jsx("input",{type:"url",value:s.sheetCsvUrl,onChange:t=>h({...s,sheetCsvUrl:t.target.value}),placeholder:"https://docs.google.com/spreadsheets/d/e/.../pub?output=csv",className:"w-full bg-black/60 border border-white/10 rounded-2xl pl-9 pr-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-emerald-500"})]}),e.jsxs("p",{className:"text-[10px] text-gray-500 mt-1",children:["Dans Google Sheets : ",e.jsx("b",{className:"text-gray-300",children:"Fichier > Partager > Publier sur le web"}),"."]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-black uppercase text-gray-400 block mb-1",children:"URL Webhook Apps Script (Export temps réel)"}),e.jsx("input",{type:"url",value:s.webhookUrl,onChange:t=>h({...s,webhookUrl:t.target.value}),placeholder:"https://script.google.com/macros/s/.../exec",className:"w-full bg-black/60 border border-white/10 rounded-2xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-emerald-500"})]}),e.jsxs("div",{className:"p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-2",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("span",{className:"text-xs font-black uppercase text-gray-300",children:"Auto-synchronisation en arrière-plan"}),e.jsx("input",{type:"checkbox",checked:s.autoSync,onChange:t=>h({...s,autoSync:t.target.checked}),className:"w-4 h-4 accent-emerald-500 rounded"})]}),s.lastSyncedAt&&e.jsxs("p",{className:"text-[10px] text-emerald-400 font-bold",children:["Dernière synchro : ",new Date(s.lastSyncedAt).toLocaleString("fr-FR")]})]}),e.jsxs("div",{className:"p-4 bg-violet-500/10 border border-violet-500/30 rounded-2xl",children:[e.jsxs("div",{className:"flex items-center space-x-2 mb-2",children:[e.jsx(j,{className:"w-4 h-4 text-violet-400"}),e.jsx("span",{className:"text-xs font-black uppercase text-violet-400",children:"Migration vers Supabase"})]}),e.jsx("p",{className:"text-[11px] text-gray-300 mb-3",children:"Copie les données locales vers Supabase (users, shops, checkins, leads, reports, notifications, chat). Les photos peuvent ensuite être stockées dans Supabase Storage."}),m&&e.jsx("div",{className:`p-2.5 rounded-xl border mb-3 text-[11px] font-bold ${m.type==="success"?"bg-emerald-500/10 border-emerald-500/30 text-emerald-400":"bg-red-500/10 border-red-500/30 text-red-400"}`,children:m.text}),e.jsxs("button",{onClick:U,disabled:S||!b(),className:"w-full py-2.5 bg-violet-500 hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black uppercase text-xs rounded-xl flex items-center justify-center space-x-2 shadow-lg transition-all",children:[e.jsx(j,{className:"w-4 h-4"}),e.jsx("span",{children:S?"Migration en cours...":"Lancer la migration Supabase"})]}),!b()&&e.jsx("p",{className:"text-[10px] text-gray-400 mt-2",children:"Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans votre environnement pour activer cette action."})]}),e.jsxs("details",{className:"p-3.5 bg-zinc-900 border border-white/10 rounded-2xl group",children:[e.jsxs("summary",{className:"text-xs font-black uppercase text-amber-400 cursor-pointer flex items-center justify-between",children:[e.jsx("span",{children:"📜 Code Google Apps Script (Webhook + Drive Photos)"}),e.jsx("span",{className:"text-[10px] text-gray-400 group-open:rotate-180 transition-transform",children:"▼"})]}),e.jsxs("div",{className:"mt-3 space-y-2 text-[11px] text-gray-300",children:[e.jsxs("p",{className:"font-semibold text-white",children:["Code ",e.jsx("code",{className:"text-amber-400 font-mono",children:"Code.gs"})," à coller dans Extensions > Apps Script :"]}),e.jsx("pre",{className:"p-3 bg-black/90 border border-white/10 rounded-xl text-[10px] text-emerald-300 overflow-x-auto select-all font-mono leading-relaxed",children:`function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ success: false, message: "Aucune donnée reçue" });
    }
    const data = JSON.parse(e.postData.contents);
    const action = data.action || data.event || data.type;

    if (action === 'processCheckin' || data.type === 'checkin' || data.tab === 'Checkins') {
      return responseJSON(processCheckin(data));
    } else if (action === 'processLead' || data.type === 'lead' || data.tab === 'Leads') {
      return responseJSON(processLead(data));
    } else if (action === 'processReport' || data.type === 'report' || data.tab === 'DailyReports') {
      return responseJSON(processReport(data));
    } else if (action === 'processChat' || data.type === 'chat' || data.tab === 'Chat') {
      return responseJSON(processChat(data));
    } else {
      return responseJSON({ success: true, message: "Événement reçu", data: data });
    }
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function responseJSONP(callbackName, obj) {
  const safeCallback = String(callbackName || '').replace(/[^a-zA-Z0-9_.$]/g, '');
  if (!safeCallback) return responseJSON(obj);
  return ContentService.createTextOutput(safeCallback + '(' + JSON.stringify(obj) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function processCheckin(d) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let photoUrl = "";

    if (d.photo && typeof d.photo === "string") {
      const cleanPhoto = d.photo.trim();
      const lowerPhoto = cleanPhoto.toLowerCase();

      // 1. CAS : Image envoyée en Base64 (data:image/...)
      if (lowerPhoto.startsWith("data:image")) {
        try {
          let folder;
          const folderName = "Vodacom_Pointages_Photos";
          const folders = DriveApp.getFoldersByName(folderName);
          
          if (folders.hasNext()) {
            folder = folders.next();
          } else {
            folder = DriveApp.createFolder(folderName);
          }

          // Extraction du type MIME (ex: image/jpeg ou image/png)
          const parts = cleanPhoto.split(",");
          const header = parts[0]; // e.g., "data:image/jpeg;base64"
          const base64Data = parts[1];

          if (base64Data) {
            const contentType = header.split(":")[1].split(";")[0]; // e.g., "image/jpeg"
            const extension = contentType.split("/")[1] || "jpg";
            const bytes = Utilities.base64Decode(base64Data);
            
            const fileName = "Pointage_" + (d.agent_id || "agent") + "_" + Date.now() + "." + extension;
            const blob = Utilities.newBlob(bytes, contentType, fileName);
            
            const file = folder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            
            // Format d'URL Google Drive direct pour affichage
            photoUrl = "https://lh3.googleusercontent.com/d/" + file.getId();
          } else {
            console.error("Données Base64 invalides ou absentes après la virgule.");
          }
        } catch (errDrive) {
          console.error("Erreur Google Drive : " + errDrive.toString());
        }
      } 
      // 2. CAS : Image déjà sous forme d'URL (http / https)
      else if (lowerPhoto.startsWith("http")) {
        photoUrl = cleanPhoto;
      }
    }

    // 3. ENREGISTREMENT DANS GOOGLE SHEETS
    let sheet = ss.getSheetByName("Checkins");
    if (!sheet) {
      sheet = ss.insertSheet("Checkins");
      sheet.appendRow(["id", "assignment_id", "agent_id", "type", "timestamp", "lat", "long", "accuracy", "photo", "device", "status"]);
    }

    sheet.appendRow([
      d.id || d.uuid || Utilities.getUuid(),
      d.assignment_id || "",
      d.agent_id || "",
      d.type || "IN",
      d.timestamp || new Date().toISOString(),
      d.lat || 0,
      d.long || d.lng || 0,
      d.accuracy || 0,
      photoUrl, // On enregistre uniquement l'URL générée ou propre
      d.device || "Mobile App",
      d.status || "synced"
    ]);

    return { success: true, photoUrl: photoUrl };

  } catch (e) {
    console.error("Erreur globale : " + e.toString());
    return { success: false, error: e.toString() };
  }
}
function processLead(d) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Leads");
    if (!sheet) {
      sheet = ss.insertSheet("Leads");
      sheet.appendRow(["id", "agent_id", "shop_id", "client_name", "msisdn", "action_type", "bundle_type", "timestamp", "status"]);
    }
    sheet.appendRow([
      d.id || d.uuid || Utilities.getUuid(),
      d.agent_id || "",
      d.shop_id || "S001",
      d.client_name || d.name || "",
      d.msisdn || d.phone || "",
      d.action_type || "",
      d.bundle_type || "",
      d.timestamp || new Date().toISOString(),
      d.status || "synced"
    ]);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function processReport(d) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("DailyReports");
    if (!sheet) {
      sheet = ss.insertSheet("DailyReports");
      sheet.appendRow(["id", "agent_id", "shop_name", "date", "priv", "roam", "bund", "comment", "timestamp"]);
    }
    sheet.appendRow([
      d.id || d.uuid || Utilities.getUuid(),
      d.agent_id || "",
      d.shop_name || "",
      d.date || new Date().toISOString().split('T')[0],
      d.priv || 0,
      d.roam || 0,
      d.bund || 0,
      d.comment || "",
      d.timestamp || new Date().toISOString()
    ]);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function processChat(d) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Chat");
    if (!sheet) {
      sheet = ss.insertSheet("Chat");
      sheet.appendRow(["id", "sender_id", "sender_name", "sender_role", "message", "created_at", "timestamp", "read_by", "deleted", "deleted_by", "deleted_at"]);
    }

    sheet.appendRow([
      d.id || Utilities.getUuid(),
      d.sender_id || "",
      d.sender_name || "",
      d.sender_role || "",
      d.message || "",
      d.created_at || new Date().toISOString(),
      d.timestamp || "",
      JSON.stringify(d.read_by || []),
      false,
      "",
      ""
    ]);

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : '';
  const callback = e && e.parameter ? e.parameter.callback : '';
  if (action === 'getChatMessages') {
    const payload = getChatMessages();
    if (callback) return responseJSONP(callback, payload);
    return responseJSON(payload);
  }
  const unknown = { success: false, message: 'Action GET inconnue' };
  if (callback) return responseJSONP(callback, unknown);
  return responseJSON(unknown);
}

function getChatMessages() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Chat');
    if (!sheet) {
      sheet = ss.insertSheet('Chat');
      sheet.appendRow(['id', 'sender_id', 'sender_name', 'sender_role', 'message', 'created_at', 'timestamp', 'read_by', 'deleted', 'deleted_by', 'deleted_at']);
      return { success: true, messages: [] };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, messages: [] };
    }

    const rows = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
    const messages = rows.map(function(row) {
      let readBy = [];
      try {
        readBy = JSON.parse(String(row[7] || '[]'));
      } catch (err) {}

      return {
        id: String(row[0] || ''),
        sender_id: String(row[1] || ''),
        sender_name: String(row[2] || ''),
        sender_role: String(row[3] || ''),
        message: String(row[4] || ''),
        created_at: String(row[5] || ''),
        timestamp: String(row[6] || ''),
        read_by: Array.isArray(readBy) ? readBy : [],
        deleted: String(row[8] || '').toLowerCase() === 'true',
        deleted_by: String(row[9] || ''),
        deleted_at: String(row[10] || '')
      };
    }).filter(function(msg) {
      return !msg.deleted;
    });

    return { success: true, messages: messages };
  } catch (e) {
    return { success: false, error: e.toString(), messages: [] };
  }
}`})]})]}),e.jsxs("div",{className:"pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2",children:[e.jsxs("button",{onClick:_,disabled:c,className:"w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition-all",children:[e.jsx(B,{className:`w-4 h-4 ${c?"animate-spin":""}`}),e.jsx("span",{children:c?"Connexion...":"Synchroniser URL GSheet"})]}),e.jsxs("button",{onClick:A,className:"w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-black uppercase flex items-center justify-center space-x-2 transition-all border border-white/10",children:[e.jsx(J,{className:"w-4 h-4 text-emerald-400"}),e.jsx("span",{children:"Exporter Base CSV"})]})]}),e.jsx("div",{className:"pt-2 border-t border-white/10",children:e.jsxs("button",{onClick:()=>{window.confirm("Êtes-vous sûr de vouloir effectuer un reset complet ? Cela effacera toutes les données en cache et vous déconnectera.")&&(L(),window.location.reload())},className:"w-full py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-2xl text-xs font-black uppercase flex items-center justify-center space-x-2 transition-all border border-red-500/30",children:[e.jsx(O,{className:"w-4 h-4"}),e.jsx("span",{children:"Vider le Cache & Reset Total (Déconnexion)"})]})})]})]})})};export{K as GSheetModal};
