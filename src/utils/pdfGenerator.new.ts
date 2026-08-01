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
  pointagePhoto?: string;
  photos: string[];
  comment?: string;
  evolutionData?: number[];
}

export interface PDFSupervisorData {
  supName: string;
  date: string;
  team: Array<{
    id?: string;
    name: string;
    shop: string;
    status: string;
    stats: { priv: number; roam: number; bund: number };
    arrivalTime?: string;
    departureTime?: string;
  }>;
  reports?: PDFReportData[];
}

export interface PDFAdminBatchData {
  period: string;
  title?: string;
  reports?: PDFReportData[];
  groups?: Array<{ supervisor: string; agentCount: number; totalLeads: number; totalPrivilege: number; totalRoaming: number; totalBundles: number }>;
}

function escapeHtml(value: string | number | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEvolutionSvg(values: number[]): string {
  if (!values.length) {
    return `<div style="margin-top:8px; font-size:10px; color:#64748b; font-style:italic;">Aucune évolution disponible pour cette période.</div>`;
  }

  const clean = values.filter(v => Number.isFinite(v));
  if (clean.length < 2) {
    return `<div style="margin-top:8px; font-size:10px; color:#64748b; font-style:italic;">Évolution à partir du premier rapport disponible.</div>`;
  }

  const max = Math.max(...clean, 1);
  const width = 260;
  const height = 90;
  const padding = 16;
  const step = clean.length > 1 ? (width - padding * 2) / (clean.length - 1) : 0;
  const points = clean.map((value, idx) => {
    const x = padding + step * idx;
    const y = height - padding - ((value / max) * (height - padding * 2));
    return `${x},${y}`;
  }).join(' ');

  const lastValue = clean[clean.length - 1];
  return `
    <div style="margin-top:8px;">
      <svg width="100%" height="100" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="display:block; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="1" />
        <polyline fill="none" stroke="#dc2626" stroke-width="3" points="${points}" />
        <circle cx="${padding + step * (clean.length - 1)}" cy="${height - padding - ((lastValue / max) * (height - padding * 2))}" r="4" fill="#dc2626" />
      </svg>
      <div style="font-size:10px; color:#64748b; margin-top:4px;">Dernier total: <b>${lastValue}</b></div>
    </div>
  `;
}

function buildDonutSvg(value: number, maxValue: number, color: string, track: string, label: string): string {
  const safeMax = Math.max(1, maxValue);
  const percent = Math.min(100, Math.round((value / safeMax) * 100));
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:33%; min-width:0;">
      <svg width="70" height="70" viewBox="0 0 70 70" style="display:block;">
        <circle cx="35" cy="35" r="24" fill="none" stroke="${track}" stroke-width="8" />
        <circle cx="35" cy="35" r="24" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 35 35)" />
        <text x="35" y="40" text-anchor="middle" style="font-size:10px; font-weight:900; fill:#111827;">${value}</text>
      </svg>
      <span style="font-size:9px; font-weight:800; color:#475569; text-transform:uppercase; margin-top:4px;">${label}</span>
    </div>
  `;
}

function wrapPage(content: string): string {
  return `<div style="page-break-after:always; padding-bottom:16px;">${content}</div>`;
}

export function buildAgentReportHtml(d: PDFReportData): string {
  const safeArrival = d.arrivalTime && d.arrivalTime.trim() ? d.arrivalTime : '00:00';
  const safeDeparture = d.departureTime && d.departureTime.trim() ? d.departureTime : '00:00';
  const profilePhoto = d.pointagePhoto || (d.photos && d.photos.length > 0 ? d.photos[0] : '');
  const commentText = (d.comment || '').trim() || 'Rien à signaler';

  const safeLeads = (d.leads || []).map((l) => {
    const rawTs = l.timestamp || '';
    const ts = rawTs.includes('T') ? rawTs.split('T')[1].substring(0, 5) : (rawTs.substring(0, 5) || '00:00');
    return {
      timestamp: ts || '00:00',
      client_name: (l.client_name || '').trim() || 'Anonyme',
      msisdn: (l.msisdn || '').trim() || 'N/A',
      action_type: (l.action_type || '').trim() || 'Action non renseignée'
    };
  });

  const realTotal = d.totalPrivilege + d.totalRoaming + d.totalBundles;
  const targetTotal = d.targets.privilege + d.targets.roaming + d.targets.bundle;
  const privPct = Math.min(100, Math.round((d.totalPrivilege / Math.max(1, d.targets.privilege)) * 100));
  const roamPct = Math.min(100, Math.round((d.totalRoaming / Math.max(1, d.targets.roaming)) * 100));
  const bundPct = Math.min(100, Math.round((d.totalBundles / Math.max(1, d.targets.bundle)) * 100));

  const makeGpsLink = (val: string) => {
    if (!val || val === '00:00' || val === '-' || val.toLowerCase().includes('non disponible')) return '';
    if (val.startsWith('http')) return val;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(val)}`;
  };

  const gpsInUrl = makeGpsLink(d.mapsIn);
  const gpsOutUrl = makeGpsLink(d.mapsOut);
  const gpsInHtml = gpsInUrl
    ? `<a href="${gpsInUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block; margin-top:6px; font-size:9px; color:#E60000; font-weight:bold; text-decoration:none; border:1px solid #E60000; padding:4px 10px; border-radius:6px; background:#fff;">📍 Vérifier GPS (Carte)</a>`
    : `<span style="display:inline-block; margin-top:6px; font-size:9px; color:#999; font-weight:bold; border:1px solid #ddd; padding:4px 10px; border-radius:6px; background:#fafafa;">Donnees GPS non disponible</span>`;
  const gpsOutHtml = gpsOutUrl
    ? `<a href="${gpsOutUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block; margin-top:6px; font-size:9px; color:#E60000; font-weight:bold; text-decoration:none; border:1px solid #E60000; padding:4px 10px; border-radius:6px; background:#fff;">📍 Vérifier GPS (Carte)</a>`
    : `<span style="display:inline-block; margin-top:6px; font-size:9px; color:#999; font-weight:bold; border:1px solid #ddd; padding:4px 10px; border-radius:6px; background:#fafafa;">Donnees GPS non disponible</span>`;

  const photosHtml = d.photos && d.photos.length > 1
    ? `<div style="margin-top:20px; font-size:10px; font-weight:800; color:#999; text-transform:uppercase; border-bottom:1px solid #eee; padding-bottom:5px;">PREUVES TERRAIN / BOUTIQUE (PHOTOS)</div>
       <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
         ${d.photos.slice(1).map(p => `<div style="width:31%; height:110px; border-radius:12px; border:1px solid #eee; overflow:hidden;"><img src="${p}" style="width:100%; height:100%; object-fit:cover; object-position:center; display:block;"></div>`).join('')}
       </div>`
    : '';

  const evolutionHtml = buildEvolutionSvg(d.evolutionData || []);

  return `
    <div style="background:linear-gradient(135deg,#0f172a 0%,#111827 48%,#7f1d1d 100%); color:#fff; border-radius:20px; padding:18px; margin-bottom:16px; box-shadow:0 12px 30px rgba(2,6,23,0.35); position:relative; overflow:hidden;">
      <div style="position:absolute; inset:0; opacity:0.08; background-image:repeating-linear-gradient(45deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 10px); pointer-events:none;"></div>
      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="width:90px; vertical-align:top;">
            <div style="width:80px; height:80px; border-radius:16px; border:3px solid #ef4444; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#0b1220;">
              ${profilePhoto
                ? `<img src="${profilePhoto}" style="width:100%; height:100%; object-fit:cover; object-position:center;">`
                : `<span style="font-size:10px; font-weight:900; color:#cbd5e1; text-transform:uppercase; text-align:center;">Photo non disponible</span>`}
            </div>
          </td>
          <td style="vertical-align:top; padding-left:14px;">
            <div style="font-size:10px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#fda4af;">📌 Rapport d'activation journalier</div>
            <div style="font-size:26px; line-height:1.05; font-weight:900; text-transform:uppercase; margin-top:4px;">${escapeHtml(d.agentName)}</div>
            <div style="font-size:12px; color:#e2e8f0; margin-top:6px;">Shop: <b>${escapeHtml(d.shopName)}</b> • Date: <b>${escapeHtml(d.date)}</b></div>
          </td>
        </tr>
      </table>
    </div>

    <table style="width:100%; border-spacing:10px; margin-left:-10px;">
      <tr>
        <td style="width:34%;">
          <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; padding:12px; min-height:120px;">
            <div style="font-size:9px; font-weight:800; text-transform:uppercase; color:#6b7280;">🕘 Arrivée</div>
            <div style="font-size:18px; font-weight:900; color:#111827; margin-top:4px;">${escapeHtml(safeArrival)}</div>
            ${gpsInHtml}
          </div>
        </td>
        <td style="width:33%;">
          <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; padding:12px; min-height:120px;">
            <div style="font-size:9px; font-weight:800; text-transform:uppercase; color:#6b7280;">🕔 Départ</div>
            <div style="font-size:18px; font-weight:900; color:#111827; margin-top:4px;">${escapeHtml(safeDeparture)}</div>
            ${gpsOutHtml}
          </div>
        </td>
        <td style="width:33%;">
          <div style="background:linear-gradient(140deg,#111827 0%,#1f2937 100%); border-radius:14px; padding:12px; color:white; min-height:120px; position:relative; overflow:hidden;">
            <div style="position:absolute; right:-10px; top:-8px; font-size:42px; opacity:0.16;">↗</div>
            <div style="font-size:9px; font-weight:800; text-transform:uppercase; opacity:0.85;">📈 Évolution depuis le début</div>
            ${evolutionHtml}
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
              ${buildDonutSvg(d.totalPrivilege, Math.max(d.targets.privilege, 1), '#dc2626', '#fee2e2', 'Privilège')}
              ${buildDonutSvg(d.totalRoaming, Math.max(d.targets.roaming, 1), '#d97706', '#fef3c7', 'Roaming')}
              ${buildDonutSvg(d.totalBundles, Math.max(d.targets.bundle, 1), '#2563eb', '#dbeafe', 'Bundles')}
            </div>
            <div style="margin-top:10px; font-size:10px; color:#64748b;">Total journalier: <b>${realTotal}</b> / <b>${targetTotal}</b> • Taux global: <b>${Math.min(100, Math.round((realTotal / Math.max(1, targetTotal)) * 100))}%</b></div>
          </div>
        </td>
      </tr>
    </table>

    <div style="font-size:10px; font-weight:800; color:#6b7280; text-transform:uppercase; margin-top:15px; margin-bottom:10px; border-bottom:1px solid #e5e7eb; padding-bottom:5px; letter-spacing:1px;">Liste détaillée des numéros & activations (${safeLeads.length})</div>
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
        ${safeLeads.length > 0 ? safeLeads.map((l, i) => `
          <tr style="border-bottom:1px solid #eee; font-size:10px; background:${i % 2 === 0 ? '#fff' : '#fcfcfc'};">
            <td style="padding:6px;">${escapeHtml(l.timestamp || '00:00')}</td>
            <td style="padding:6px;"><b>${escapeHtml(l.client_name)}</b></td>
            <td style="padding:6px; font-family:monospace; font-weight:bold; color:#E60000;">${escapeHtml(l.msisdn)}</td>
            <td style="padding:6px; text-align:right; font-weight:bold; color:#333;">${escapeHtml(l.action_type)}</td>
          </tr>
        `).join('') : `
          <tr>
            <td colspan="4" style="padding:12px; text-align:center; color:#999; font-size:10px; font-style:italic;">Aucune activation saisie aujourd'hui.</td>
          </tr>
        `}
      </tbody>
    </table>

    ${photosHtml}

    <div style="font-size:10px; font-weight:800; color:#6b7280; text-transform:uppercase; margin-top:15px; margin-bottom:5px;">Commentaires / Observations</div>
    <div style="font-size:11px; font-style:italic; background:#f9f9f9; padding:10px; border-radius:10px; border:1px solid #eee;">${escapeHtml(commentText)}</div>

    <div style="margin-top:30px; text-align:center; font-size:9px; color:#888; text-transform:uppercase; letter-spacing:1px; font-weight:bold;">
      BTL DEPLOYMENT TRACKER - by Eldorado Design
    </div>
  `;
}

async function renderHtmlToPdfDataUrl(htmlContent: string): Promise<string> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0px';
  container.style.width = '794px';
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
    return pdf.output('datauristring');
  } finally {
    document.body.removeChild(container);
  }
}

export async function generateAgentPDF(d: PDFReportData): Promise<string> {
  return renderHtmlToPdfDataUrl(buildAgentReportHtml(d));
}

export async function generateSupervisorPDF(d: PDFSupervisorData): Promise<string> {
  return renderHtmlToPdfDataUrl(buildSupervisorReportHtml(d));
}

export function buildSupervisorReportHtml(d: PDFSupervisorData): string {
  const activeCount = d.team.filter(a => a.status !== 'Absent').length;
  const closedCount = d.team.filter(a => a.status === 'Clôturé').length;
  const totalLeads = d.team.reduce((acc, a) => acc + a.stats.priv + a.stats.roam + a.stats.bund, 0);

  const cover = `
    <div style="background:linear-gradient(140deg,#111827 0%,#312e81 48%,#991b1b 100%); border-radius:24px; padding:24px; color:#fff; margin-bottom:18px;">
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#c4b5fd; font-weight:800;">Rapport de supervision</div>
      <div style="font-size:28px; font-weight:900; margin-top:6px;">${escapeHtml(d.supName)}</div>
      <div style="font-size:12px; color:#e2e8f0; margin-top:5px;">Période: <b>${escapeHtml(d.date)}</b></div>
    </div>
  `;

  const summary = `
    <table style="width:100%; border-spacing:10px; margin-left:-10px; margin-bottom:10px;">
      <tr>
        <td style="width:33%;"><div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; padding:12px; text-align:center;"><div style="font-size:9px; color:#6b7280; text-transform:uppercase; font-weight:800;">Actifs</div><div style="font-size:24px; font-weight:900; color:#111827;">${activeCount}/${d.team.length}</div></div></td>
        <td style="width:33%;"><div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:14px; padding:12px; text-align:center;"><div style="font-size:9px; color:#166534; text-transform:uppercase; font-weight:800;">Clôturés</div><div style="font-size:24px; font-weight:900; color:#15803d;">${closedCount}</div></div></td>
        <td style="width:34%;"><div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:14px; padding:12px; text-align:center;"><div style="font-size:9px; color:#1e3a8a; text-transform:uppercase; font-weight:800;">Leads équipe</div><div style="font-size:24px; font-weight:900; color:#1d4ed8;">${totalLeads}</div></div></td>
      </tr>
    </table>
  `;

  const cards = d.team.map((a) => {
    const maxValue = Math.max(1, ...[a.stats.priv, a.stats.roam, a.stats.bund]);
    const badge = a.status === 'Clôturé' ? 'Clôturé' : (a.status === 'Présent' ? 'Présent' : 'Absent');
    return `
      <div style="border:1px solid #e5e7eb; border-radius:14px; padding:12px; margin-bottom:10px; background:#ffffff;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div>
            <div style="font-size:13px; font-weight:900; text-transform:uppercase; color:#111827;">${escapeHtml(a.name)}</div>
            <div style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase;">${escapeHtml(a.shop)}</div>
          </div>
          <span style="font-size:9px; font-weight:900; padding:4px 9px; border-radius:999px; border:1px solid ${a.status === 'Clôturé' ? '#86efac' : (a.status === 'Présent' ? '#93c5fd' : '#fecaca')}; color:${a.status === 'Clôturé' ? '#166534' : (a.status === 'Présent' ? '#1e3a8a' : '#991b1b')}; background:${a.status === 'Clôturé' ? '#f0fdf4' : (a.status === 'Présent' ? '#eff6ff' : '#fef2f2')};">${escapeHtml(badge)}</span>
        </div>
        <div style="display:flex; gap:8px; align-items:center; margin-top:8px; flex-wrap:wrap;">
          <div style="flex:1; min-width:0;">
            <div style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:6px;">Présence & horaires</div>
            <div style="font-size:10px; color:#111827; font-weight:700;">Arrivée: <b>${escapeHtml(a.arrivalTime || '00:00')}</b></div>
            <div style="font-size:10px; color:#111827; font-weight:700;">Clôture: <b>${escapeHtml(a.departureTime || '00:00')}</b></div>
          </div>
          <div style="display:flex; gap:6px; flex:1; justify-content:flex-end;">
            ${buildDonutSvg(a.stats.priv, maxValue, '#dc2626', '#fee2e2', 'PRV')}
            ${buildDonutSvg(a.stats.roam, maxValue, '#d97706', '#fef3c7', 'ROA')}
            ${buildDonutSvg(a.stats.bund, maxValue, '#2563eb', '#dbeafe', 'BND')}
          </div>
        </div>
      </div>
    `;
  }).join('');

  const reportPages = (d.reports || []).map((report) => wrapPage(buildAgentReportHtml(report))).join('');
  const closing = `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:18px; padding:20px;">
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#64748b; font-weight:800;">Clôture de compilation</div>
      <div style="font-size:24px; font-weight:900; color:#111827; margin-top:4px;">Rapports inclus: ${d.reports?.length || 0}</div>
      <div style="font-size:11px; color:#475569; margin-top:8px;">La compilation regroupe désormais les rapports journaliers des agents de la période choisie.</div>
    </div>
  `;

  return [
    wrapPage(cover + summary + cards),
    ...reportPages ? [reportPages] : [],
    wrapPage(closing)
  ].join('');
}

export async function generateAdminBatchPDF(d: PDFAdminBatchData): Promise<string> {
  return renderHtmlToPdfDataUrl(buildAdminBatchReportHtml(d));
}

export function buildAdminBatchReportHtml(d: PDFAdminBatchData): string {
  const title = d.title || 'Compilation périodique';
  const cover = `
    <div style="background:linear-gradient(135deg,#111827 0%,#1d4ed8 46%,#dc2626 100%); color:#fff; border-radius:24px; padding:24px; margin-bottom:18px;">
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#dbeafe; font-weight:800;">Compilation de période</div>
      <div style="font-size:28px; font-weight:900; margin-top:6px;">${escapeHtml(title)}</div>
      <div style="font-size:12px; color:#e2e8f0; margin-top:5px;">Période: <b>${escapeHtml(d.period)}</b></div>
    </div>
  `;

  const reportPages = (d.reports || []).map((report) => wrapPage(buildAgentReportHtml(report))).join('');
  const groupsHtml = (d.groups || []).map((group) => `
    <div style="border:1px solid #e2e8f0; border-radius:12px; padding:10px; margin-bottom:8px; background:#fff;">
      <div style="font-size:11px; font-weight:900; color:#111827; text-transform:uppercase;">${escapeHtml(group.supervisor)}</div>
      <div style="font-size:10px; color:#64748b; margin-top:4px;">Agents: <b>${group.agentCount}</b> • Leads: <b>${group.totalLeads}</b></div>
    </div>
  `).join('');

  const closing = `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:20px;">
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#64748b; font-weight:800;">Clôture de compilation</div>
      <div style="font-size:24px; font-weight:900; color:#111827; margin-top:4px;">${(d.reports || []).length} rapports journaliers inclus</div>
      <div style="margin-top:10px;">${groupsHtml || '<div style="font-size:10px; color:#64748b;">Aucun regroupement disponible pour cette période.</div>'}</div>
    </div>
  `;

  return [
    wrapPage(cover),
    reportPages,
    wrapPage(closing)
  ].join('');
}
