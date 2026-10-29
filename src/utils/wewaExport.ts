import type { WewaReport, WewaReportRow } from './wewaModel';

export function wewaPerformance(report: WewaReport, dimension: 'agent' | 'station') {
  const entries = new Map<string, { id: string; label: string; district: string; registrations: number; merchant: number; apps: number; days: number }>();
  const get = (r: { ba_id: string; agent: string; station_id: string; station: string; district: string }) => {
    const id = dimension === 'agent' ? r.ba_id : r.station_id;
    const value = entries.get(id) ?? { id, label: dimension === 'agent' ? r.agent : r.station, district: dimension === 'station' ? r.district : '', registrations: 0, merchant: 0, apps: 0, days: 0 };
    entries.set(id, value); return value;
  };
  report.records.forEach(r => { const e=get(r);e.registrations++;e.merchant+=Number(r.merchant_account_opened);e.apps+=Number(r.app_installed); });
  report.attendance.forEach(r => { get(r).days++; });
  return Array.from(entries.values()).sort((a,b)=>b.registrations-a.registrations || a.label.localeCompare(b.label,'fr'));
}

export async function buildWewaWorkbook(report: WewaReport, start: string, end: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  wb.Props = { Title: 'Activation WEWA · Performances', Author: 'BTL Africa' };
  const source = XLSX.utils.aoa_to_sheet([['Date','BA','Station','District','Compte marchand ouvert','Application installée','Motard enregistré','ID BA','ID station'], ...report.records.map(r=>[r.activity_date,r.agent,r.station,r.district,Number(r.merchant_account_opened),Number(r.app_installed),1,r.ba_id,r.station_id])]);
  const presence = XLSX.utils.aoa_to_sheet([['Date','BA','Station','District','Statut','ID BA','ID station'],...report.attendance.map(r=>[r.activity_date,r.agent,r.station,r.district,r.status,r.ba_id,r.station_id])]);
  const sourcesEnd = Math.max(2, report.records.length+1), attendanceEnd=Math.max(2,report.attendance.length+1);
  const formula=(sheet: import('xlsx').WorkSheet,cell:string,f:string,v:number)=>{sheet[cell]={t:'n',f,v};};
  const summary = XLSX.utils.aoa_to_sheet([['ACTIVATION WEWA','Valeur'],['Période',`${start} → ${end}`],['Motards enregistrés',0],['Comptes marchands ouverts',0],['Applications installées',0],['Journées BA pointées',0],['Taux d’ouverture',0],['Taux d’installation',0]]);
  formula(summary,'B3',`SUM(Sources!G2:G${sourcesEnd})`,report.records.length);
  formula(summary,'B4',`SUM(Sources!E2:E${sourcesEnd})`,report.records.filter(r=>r.merchant_account_opened).length);
  formula(summary,'B5',`SUM(Sources!F2:F${sourcesEnd})`,report.records.filter(r=>r.app_installed).length);
  formula(summary,'B6',`COUNTA(Pointages!A2:A${attendanceEnd})`,report.attendance.length);
  formula(summary,'B7','IFERROR(B4/B3,0)',report.records.length?report.records.filter(r=>r.merchant_account_opened).length/report.records.length:0);
  formula(summary,'B8','IFERROR(B5/B3,0)',report.records.length?report.records.filter(r=>r.app_installed).length/report.records.length:0);
  summary.B7.z=summary.B8.z='0.0%';
  XLSX.utils.book_append_sheet(wb,summary,'Synthèse');
  for(const dimension of ['agent','station'] as const){
    const rows=wewaPerformance(report,dimension),key=dimension==='agent'?'H':'I',presenceKey=dimension==='agent'?'F':'G';
    const sheet=XLSX.utils.aoa_to_sheet([[dimension==='agent'?'BA':'Station','District','Motards','Comptes marchands','Installations','Taux comptes','Taux installations','Journées BA','ID'],...rows.map(r=>[r.label,r.district,0,0,0,0,0,0,r.id])]);
    rows.forEach((r,index)=>{const n=index+2;formula(sheet,`C${n}`,`SUMIF(Sources!${key}$2:${key}$${sourcesEnd},I${n},Sources!G$2:G$${sourcesEnd})`,r.registrations);formula(sheet,`D${n}`,`SUMIF(Sources!${key}$2:${key}$${sourcesEnd},I${n},Sources!E$2:E$${sourcesEnd})`,r.merchant);formula(sheet,`E${n}`,`SUMIF(Sources!${key}$2:${key}$${sourcesEnd},I${n},Sources!F$2:F$${sourcesEnd})`,r.apps);formula(sheet,`F${n}`,`IFERROR(D${n}/C${n},0)`,r.registrations?r.merchant/r.registrations:0);formula(sheet,`G${n}`,`IFERROR(E${n}/C${n},0)`,r.registrations?r.apps/r.registrations:0);formula(sheet,`H${n}`,`COUNTIF(Pointages!${presenceKey}$2:${presenceKey}$${attendanceEnd},I${n})`,r.days);sheet[`F${n}`].z=sheet[`G${n}`].z='0.0%';});
    sheet['!cols']=[{wch:30},{wch:19},...Array.from({length:6},()=>({wch:21})),{hidden:true}];
    sheet['!autofilter']={ref:`A1:H${Math.max(1,rows.length+1)}`};
    XLSX.utils.book_append_sheet(wb,sheet,dimension==='agent'?'Performance BA':'Performance stations');
  }
  source['!cols']=[{wch:13},{wch:28},{wch:29},{wch:20},{wch:25},{wch:23},{wch:20},{hidden:true},{hidden:true}];
  presence['!cols']=[{wch:13},{wch:28},{wch:29},{wch:20},{wch:13},{hidden:true},{hidden:true}];
  XLSX.utils.book_append_sheet(wb,source,'Sources');XLSX.utils.book_append_sheet(wb,presence,'Pointages');
  wb.Workbook={Sheets:wb.SheetNames.map(name=>({name,Hidden:name==='Sources'||name==='Pointages'?1:0})),CalcPr:{calcMode:'auto',fullCalcOnLoad:true}} as import('xlsx').WBProps;
  summary['!cols']=[{wch:35},{wch:30}];
  return wb;
}
export async function exportWewaExcel(report: WewaReport,start:string,end:string){const XLSX=await import('xlsx');XLSX.writeFile(await buildWewaWorkbook(report,start,end),`WEWA-performances-${start}-${end}.xlsx`);}
export async function exportWewaPdf(report: WewaReport,start:string,end:string){
  const {jsPDF}=await import('jspdf'); const doc=new jsPDF();let y=22;
  doc.setFont('helvetica','bold');doc.setFontSize(19);doc.text('ACTIVATION WEWA',14,y);y+=9;doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(`${start} > ${end} | BTL Africa - ENGEN`,14,y);y+=12;
  for(const dimension of ['agent','station'] as const){if(y>245){doc.addPage();y=20;}doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(dimension==='agent'?'Performance des BA':'Performance des stations',14,y);y+=9;doc.setFontSize(9);doc.text('Nom',14,y);doc.text('Motards',119,y);doc.text('Comptes',145,y);doc.text('Applis',174,y);y+=6;doc.setFont('helvetica','normal');const rows=wewaPerformance(report,dimension);if(!rows.length){doc.text('Aucune activite sur cette periode.',14,y);y+=8;}for(const r of rows){if(y>278){doc.addPage();y=20;}doc.text(doc.splitTextToSize(r.label,97)[0],14,y);doc.text(String(r.registrations),125,y,{align:'right'});doc.text(String(r.merchant),153,y,{align:'right'});doc.text(String(r.apps),181,y,{align:'right'});y+=7;}y+=12;}
  doc.save(`WEWA-performances-${start}-${end}.pdf`);
}
