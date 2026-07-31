import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFReportData {
  agentName: string;
  shopName: string;
  date: string;
  arrivalTime: string;
  departureTime: string;
  mapsIn: string;
  mapsOut: string;
  totalPrivilege: number;
  totalRoaming: number;
  totalBundles: number;
  targets: { privilege: number; roaming: number; bundle: number };
  leads: Array<{ timestamp: string; client_name: string; msisdn: string; action_type: string }>;
  photos: string[];
  comment: string;
}

export interface PDFSupervisorData {
  supName: string;
  date: string;
  team: Array<{
    name: string;
    shop: string;
    status: string;
    stats: { priv: number; roam: number; bund: number };
  }>;
}

export interface PDFAdminBatchData {
  period: string;
  rows: Array<{ date: string; agent: string; priv: number; roam: number; bund: number }>;
  totals: { privilege: number; roaming: number; bundles: number };
}

/**
 * Renders an HTML element off-screen and exports it as a Data URL PDF / opens it.
 */
async function renderHtmlToPdfDataUrl(htmlContent: string): Promise<string> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0px';
  container.style.width = '794px'; // A4 width at 96 DPI
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#1a1a1a';
  container.style.fontFamily = 'Helvetica, Arial, sans-serif';
  container.style.padding = '30px';
  container.style.boxSizing = 'border-box';
  container.innerHTML = htmlContent;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    const dataUrl = pdf.output('datauristring');
    return dataUrl;
  } finally {
    document.body.removeChild(container);
  }
}

export async function generateAgentPDF(d: PDFReportData): Promise<string> {
  const realTotal = d.totalPrivilege + d.totalRoaming + d.totalBundles;
  const targetTotal = d.targets.privilege + d.targets.roaming + d.targets.bundle;
  const globalPerc = Math.min(100, Math.round((realTotal / Math.max(1, targetTotal)) * 100));

  const profilePhoto = d.photos && d.photos.length > 0 ? d.photos[0] : 'https://www.vodacom.cd/favicon.ico';

  const makeGpsLink = (val: string) => {
    if (!val || val === '00:00' || val === '-') return '#';
    if (val.startsWith('http')) return val;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(val)}`;
  };

  const gpsInUrl = makeGpsLink(d.mapsIn);
  const gpsOutUrl = makeGpsLink(d.mapsOut);

  const privilegeLeads = d.leads.filter(l => l.action_type.includes('Privilège'));
  const roamingLeads = d.leads.filter(l => l.action_type.includes('Roaming'));
  const bundleLeads = d.leads.filter(l => l.action_type.includes('Bundle'));

  const photosHtml = d.photos && d.photos.length > 1
    ? `<div style="margin-top:20px; font-size:10px; font-weight:800; color:#999; text-transform:uppercase; border-bottom:1px solid #eee; padding-bottom:5px;">PREUVES TERRAIN / BOUTIQUE (PHOTOS)</div>
       <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
         ${d.photos.slice(1).map(p => `<div style="width:31%; height:110px; border-radius:12px; border:1px solid #eee; overflow:hidden;"><img src="${p}" style="width:100%; height:100%; object-fit:cover; object-position:center; display:block;"></div>`).join('')}
       </div>`
    : '';

  const html = `
    <div style="width:100%; border-bottom:8px solid #E60000; padding-bottom:15px; margin-bottom:20px;">
      <table style="width:100%;">
        <tr>
          <td style="width:90px;">
            <div style="width:80px; height:80px; border-radius:16px; border:3px solid #E60000; overflow:hidden;">
              <img src="${profilePhoto}" style="width:100%; height:100%; object-fit:cover; object-position:center;">
            </div>
          </td>
          <td style="padding-left:15px; vertical-align:middle;">
            <p style="margin:0; font-size:10px; font-weight:bold; color:#999; letter-spacing:1px;">RAPPORT D'ACTIVATION JOURNALIER</p>
            <h1 style="margin:4px 0 0 0; font-size:26px; font-weight:900; color:#E60000; text-transform:uppercase;">${d.agentName}</h1>
            <p style="margin:4px 0 0 0; font-size:12px; color:#555;">Shop: <b>${d.shopName}</b> | Date: <b>${d.date}</b></p>
          </td>
        </tr>
      </table>
    </div>

    <div style="font-size:10px; font-weight:800; color:#999; text-transform:uppercase; margin-top:15px; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px; letter-spacing:1px;">Présence & Horaires GPS</div>
    <table style="width:100%; border-spacing:10px; margin-left:-10px;">
      <tr>
        <td style="width:50%;">
          <div style="background:#f8f8f8; padding:12px; border-radius:12px; text-align:center; border:1px solid #eee;">
            <small style="color:#888; font-weight:bold;">ARRIVÉE</small><br>
            <b style="font-size:16px; color:#111;">${d.arrivalTime}</b><br>
            <a href="${gpsInUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block; margin-top:6px; font-size:9px; color:#E60000; font-weight:bold; text-decoration:none; border:1px solid #E60000; padding:4px 10px; border-radius:6px; background:#fff;">📍 Vérifier GPS (Carte)</a>
          </div>
        </td>
        <td style="width:50%;">
          <div style="background:#f8f8f8; padding:12px; border-radius:12px; text-align:center; border:1px solid #eee;">
            <small style="color:#888; font-weight:bold;">DÉPART (CLÔTURE)</small><br>
            <b style="font-size:16px; color:#111;">${d.departureTime}</b><br>
            <a href="${gpsOutUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block; margin-top:6px; font-size:9px; color:#E60000; font-weight:bold; text-decoration:none; border:1px solid #E60000; padding:4px 10px; border-radius:6px; background:#fff;">📍 Vérifier GPS (Carte)</a>
          </div>
        </td>
      </tr>
    </table>

    <div style="font-size:10px; font-weight:800; color:#999; text-transform:uppercase; margin-top:15px; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px; letter-spacing:1px;">Analyse des Objectifs</div>
    <div style="background:#eee; height:12px; border-radius:6px; width:100%; margin:8px 0; overflow:hidden;">
      <div style="height:12px; border-radius:6px; background:#E60000; width:${globalPerc}%;"></div>
    </div>
    <p style="font-size:11px; font-weight:900; color:#E60000; margin:0 0 10px 0;">${globalPerc}% de l'objectif global atteint (${realTotal} / ${targetTotal})</p>

    <table style="width:100%; border-spacing:10px; margin-left:-10px;">
      <tr>
        <td style="width:33%;"><div style="background:#fff; border:1px solid #eee; padding:10px; text-align:center; border-radius:12px;"><small style="color:#999; font-weight:bold;">PRIVILÈGE</small><br><b style="font-size:16px;">${d.totalPrivilege} / ${d.targets.privilege}</b></div></td>
        <td style="width:33%;"><div style="background:#fff; border:1px solid #eee; padding:10px; text-align:center; border-radius:12px;"><small style="color:#999; font-weight:bold;">ROAMING</small><br><b style="font-size:16px;">${d.totalRoaming} / ${d.targets.roaming}</b></div></td>
        <td style="width:34%;"><div style="background:#fff; border:1px solid #eee; padding:10px; text-align:center; border-radius:12px;"><small style="color:#999; font-weight:bold;">BUNDLES</small><br><b style="font-size:16px;">${d.totalBundles} / ${d.targets.bundle}</b></div></td>
      </tr>
    </table>

    <div style="font-size:10px; font-weight:800; color:#999; text-transform:uppercase; margin-top:15px; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px; letter-spacing:1px;">Liste Détaillée des Numéros & Activations (${d.leads.length})</div>
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
        ${d.leads.length > 0 ? d.leads.map((l, i) => `
          <tr style="border-bottom:1px solid #eee; font-size:10px; background:${i % 2 === 0 ? '#fff' : '#fcfcfc'};">
            <td style="padding:6px;">${l.timestamp ? (l.timestamp.includes('T') ? l.timestamp.split('T')[1].substring(0, 5) : l.timestamp) : '08:00'}</td>
            <td style="padding:6px;"><b>${l.client_name}</b></td>
            <td style="padding:6px; font-family:monospace; font-weight:bold; color:#E60000;">${l.msisdn}</td>
            <td style="padding:6px; text-align:right; font-weight:bold; color:#333;">${l.action_type}</td>
          </tr>
        `).join('') : `
          <tr>
            <td colspan="4" style="padding:12px; text-align:center; color:#999; font-size:10px; font-style:italic;">Aucune activation saisie aujourd'hui.</td>
          </tr>
        `}
      </tbody>
    </table>

    ${photosHtml}

    <div style="font-size:10px; font-weight:800; color:#999; text-transform:uppercase; margin-top:15px; margin-bottom:5px;">Commentaires / Observations</div>
    <div style="font-size:11px; font-style:italic; background:#f9f9f9; padding:10px; border-radius:10px; border:1px solid #eee;">${d.comment || 'Aucune observation enregistrée.'}</div>

    <div style="margin-top:30px; text-align:center; font-size:9px; color:#888; text-transform:uppercase; letter-spacing:1px; font-weight:bold;">
      BTL Deployment Tracker — Conçu par Eldorado Design
    </div>
  `;

  return renderHtmlToPdfDataUrl(html);
}

export async function generateSupervisorPDF(d: PDFSupervisorData): Promise<string> {
  const activeCount = d.team.filter(a => a.status !== 'Absent').length;
  const closedCount = d.team.filter(a => a.status === 'Clôturé').length;

  const html = `
    <div style="border-left:12px solid #E60000; padding-left:15px; margin-bottom:30px;">
      <p style="color:#E60000; font-weight:bold; margin:0; text-transform:uppercase; letter-spacing:2px; font-size:10px;">Consolidation Supervision</p>
      <h1 style="margin:2px 0 0 0; font-size:28px; font-weight:900;">${d.supName}</h1>
      <p style="color:#888; font-size:12px; margin:2px 0 0 0;">Performance d'équipe du ${d.date}</p>
    </div>

    <table style="width:100%; border-spacing:10px; margin-left:-10px; margin-bottom:20px;">
      <tr>
        <td style="width:50%;">
          <div style="background:#1a1a1a; color:white; padding:20px; border-radius:20px; text-align:center;">
            <small style="font-size:9px; letter-spacing:1px; color:#aaa;">HÔTESSES ACTIVES</small><br>
            <span style="font-size:36px; font-weight:900; color:#E60000;">${activeCount} / ${d.team.length}</span>
          </div>
        </td>
        <td style="width:50%;">
          <div style="background:#1a1a1a; color:white; padding:20px; border-radius:20px; text-align:center;">
            <small style="font-size:9px; letter-spacing:1px; color:#aaa;">CLÔTURES REÇUES</small><br>
            <span style="font-size:36px; font-weight:900; color:#E60000;">${closedCount}</span>
          </div>
        </td>
      </tr>
    </table>

    <h3 style="font-size:14px; font-weight:800; color:#1a1a1a; text-transform:uppercase; margin-bottom:10px;">Performance Individuelle</h3>
    ${d.team.map(a => `
      <div style="border:1px solid #eee; border-radius:16px; padding:15px; margin-bottom:12px; background:#fcfcfc;">
        <span style="float:right; font-size:9px; font-weight:bold; color:${a.status === 'Clôturé' ? '#22c55e' : (a.status === 'Présent' ? '#3b82f6' : '#999')}">${a.status === 'Clôturé' ? 'DÉJÀ PRÉSENTÉ' : a.status.toUpperCase()}</span>
        <div style="font-size:14px; font-weight:900; text-transform:uppercase;">${a.name} <small style="color:#999; font-weight:normal;">• ${a.shop}</small></div>
        <div style="margin-top:10px; border-top:1px solid #f0f0f0; padding-top:10px; display:flex; justify-content:space-between;">
          <div style="text-align:center; width:33%;"><b>${a.stats.priv}</b><br><small style="font-size:8px; color:#aaa;">PRIVILÈGE</small></div>
          <div style="text-align:center; width:33%; border-left:1px solid #eee; border-right:1px solid #eee;"><b>${a.stats.roam}</b><br><small style="font-size:8px; color:#aaa;">ROAMING</small></div>
          <div style="text-align:center; width:33%;"><b>${a.stats.bund}</b><br><small style="font-size:8px; color:#aaa;">BUNDLES</small></div>
        </div>
      </div>
    `).join('')}
  `;

  return renderHtmlToPdfDataUrl(html);
}

export async function generateAdminBatchPDF(d: PDFAdminBatchData): Promise<string> {
  const html = `
    <div style="border-bottom:8px solid #E60000; padding-bottom:15px; margin-bottom:25px;">
      <p style="color:#999; font-weight:bold; margin:0; font-size:10px;">SYNTHÈSE ADMINISTRATIVE</p>
      <h1 style="margin:2px 0 0 0; font-size:26px; color:#E60000; font-weight:900;">Rapport Périodique Vodacom Pro</h1>
      <p style="margin:4px 0 0 0; font-size:12px; color:#555;">Période: ${d.period}</p>
    </div>

    <table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr style="background:#f4f4f4; border-bottom:2px solid #eee;">
          <th style="text-align:left; font-size:10px; padding:10px;">Date d'activité</th>
          <th style="text-align:left; font-size:10px; padding:10px;">Hôtesse</th>
          <th style="text-align:center; font-size:10px; padding:10px;">PRV</th>
          <th style="text-align:center; font-size:10px; padding:10px;">ROA</th>
          <th style="text-align:center; font-size:10px; padding:10px;">BND</th>
        </tr>
      </thead>
      <tbody>
        ${d.rows.map(r => `
          <tr style="border-bottom:1px solid #eee; font-size:11px;">
            <td style="padding:10px;">${r.date}</td>
            <td style="padding:10px;"><b>${r.agent}</b></td>
            <td style="padding:10px; text-align:center;">${r.priv}</td>
            <td style="padding:10px; text-align:center;">${r.roam}</td>
            <td style="padding:10px; text-align:center;">${r.bund}</td>
          </tr>
        `).join('')}
        <tr style="background:#1a1a1a; color:white; font-weight:900; font-size:11px;">
          <td colspan="2" style="padding:12px;">CUMUL TOTAL PÉRIODE</td>
          <td style="padding:12px; text-align:center; color:#E60000;">${d.totals.privilege}</td>
          <td style="padding:12px; text-align:center; color:#E60000;">${d.totals.roaming}</td>
          <td style="padding:12px; text-align:center; color:#E60000;">${d.totals.bundles}</td>
        </tr>
      </tbody>
    </table>
  `;

  return renderHtmlToPdfDataUrl(html);
}
