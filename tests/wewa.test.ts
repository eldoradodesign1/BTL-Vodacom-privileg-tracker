import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeWewaPhone, wewaRequestId, wewaRank, wewaStats, type WewaReport } from '../src/utils/wewaModel';
import { buildWewaWorkbook, wewaPerformance } from '../src/utils/wewaExport';

const report: WewaReport = {
  records: [
    { id:'r1',ba_id:'ba1',agent:'BA A',station_id:'s1',station:'Station A',district:'Lukunga',activity_date:'2026-10-20',had_mpesa_account:true,had_app:false,merchant_account_opened:true,app_installed:true },
    { id:'r2',ba_id:'ba1',agent:'BA A',station_id:'s1',station:'Station A',district:'Lukunga',activity_date:'2026-10-20',had_mpesa_account:true,had_app:true,merchant_account_opened:false,app_installed:false },
    { id:'r3',ba_id:'ba2',agent:'BA B',station_id:'s2',station:'Station B',district:'Funa',activity_date:'2026-10-20',had_mpesa_account:false,had_app:false,merchant_account_opened:true,app_installed:false },
  ],
  attendance: [
    {ba_id:'ba1',agent:'BA A',station_id:'s1',station:'Station A',district:'Lukunga',activity_date:'2026-10-20',status:'closed'},
    {ba_id:'ba2',agent:'BA B',station_id:'s2',station:'Station B',district:'Funa',activity_date:'2026-10-20',status:'closed'},
    {ba_id:'ba3',agent:'BA C',station_id:'s3',station:'Station C',district:'Tshangu',activity_date:'2026-10-20',status:'open'},
  ],
  settings:{campaign_id:'wewa',daily_registration_target:10,daily_merchant_target:5,daily_app_target:5,podium_metric:'registrations',identifier_mode:'either',expected_in:'08:00:00',expected_out:'17:00:00'},
};
test('RDC phones normalize without losing a leading zero or accepting malformed inputs',()=>{
  for(const input of ['0812345678','+243812345678','00243 81 234 56 78','812345678']) assert.equal(normalizeWewaPhone(input),'+243812345678');
  for(const input of ['012','+33812345678','','08123456789']) assert.equal(normalizeWewaPhone(input),'');
});
test('registrations, new merchant accounts and new installs are independent counters',()=>{
  assert.deepEqual(wewaStats(report.records),{registrations:3,merchant_accounts:2,app_installs:1});
  assert.equal(wewaRank(report.records,'registrations')[0].id,'ba1');
  assert.equal(wewaRank(report.records,'app_installs')[0].app_installs,1);
});
test('performance keeps checked-in BAs and stations with no registrations',()=>{
  assert.deepEqual(wewaPerformance(report,'agent').find(r=>r.id==='ba3'),{id:'ba3',label:'BA C',district:'',registrations:0,merchant:0,apps:0,days:1});
  assert.equal(wewaPerformance(report,'station').find(r=>r.id==='s3')?.registrations,0);
});
test('Excel summaries are formulas, sources are hidden, identifiers are absent',async()=>{
  const XLSX=await import('xlsx');const wb=await buildWewaWorkbook(report,'2026-10-20','2026-10-20');
  assert.equal(wb.Sheets['Synthèse'].B3.f,'SUM(Sources!G2:G4)');
  assert.equal(wb.Sheets['Performance BA'].C2.f,'SUMIF(Sources!H$2:H$4,I2,Sources!G$2:G$4)');
  assert.equal(wb.Workbook?.Sheets?.find(s=>s.name==='Sources')?.Hidden,1);
  const roundTrip=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
  assert.equal(roundTrip.Sheets['Synthèse'].B4.v,2);assert.equal(roundTrip.Sheets['Performance BA'].C4.v,0);
  assert.equal(roundTrip.Workbook?.Sheets?.find(s=>s.name==='Pointages')?.Hidden,1);
  assert.equal(XLSX.utils.sheet_to_json(roundTrip.Sheets.Sources).length,3);
  assert.equal(JSON.stringify(wb).includes('rider_name'),false);
});
test('an empty campaign produces valid zero-valued formula summaries',async()=>{
  const wb=await buildWewaWorkbook({...report,records:[],attendance:[]},'2026-10-20','2026-10-29');
  assert.equal(wb.Sheets['Synthèse'].B3.v,0);assert.equal(wb.Sheets['Synthèse'].B7.v,0);assert.equal(wb.Sheets['Synthèse'].B6.f,'COUNTA(Pointages!A2:A2)');
});

test('registration request IDs are UUIDs suitable for idempotent database inserts',()=>{
  const values=Array.from({length:20},()=>wewaRequestId());
  assert.equal(new Set(values).size,20);
  values.forEach(id=>assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
});
