import { toISO } from './storage';

export interface AgentCompilationReportInput {
  date: string;
  agent_name: string;
  shop_name?: string;
  agent_id: string;
  arrival_time?: string;
  departure_time?: string;
  maps_in?: string;
  maps_out?: string;
  priv: number;
  roam: number;
  bund: number;
  pointage_photo?: string;
  photos?: string[];
  comment?: string;
}

export interface AgentCompilationLeadInput {
  agent_id: string;
  timestamp: string;
  client_name: string;
  msisdn: string;
  action_type: string;
}

export interface AgentCompilationPayload {
  title: string;
  period: string;
  rows: Array<{ date: string; agent: string; priv: number; roam: number; bund: number }>;
  totals: { privilege: number; roaming: number; bundles: number };
  reports: Array<{
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
    pointagePhoto: string;
    photos: string[];
    comment: string;
    evolutionData: number[];
  }>;
  groups: Array<{ supervisor: string; agentCount: number; totalLeads: number; totalPrivilege: number; totalRoaming: number; totalBundles: number }>;
}

export function buildAgentCompilationPayload(params: {
  agentId: string;
  agentName: string;
  shopName?: string;
  reports: AgentCompilationReportInput[];
  leads: AgentCompilationLeadInput[];
}): AgentCompilationPayload {
  const rows = params.reports.map((report) => ({
    date: report.date,
    agent: report.agent_name,
    priv: report.priv,
    roam: report.roam,
    bund: report.bund
  }));

  const totals = rows.reduce(
    (acc, row) => ({
      privilege: acc.privilege + row.priv,
      roaming: acc.roaming + row.roam,
      bundles: acc.bundles + row.bund
    }),
    { privilege: 0, roaming: 0, bundles: 0 }
  );

  const reports = params.reports.map((report) => ({
    agentName: report.agent_name,
    shopName: report.shop_name || params.shopName || 'Vodacom Shop',
    date: report.date,
    arrivalTime: report.arrival_time || '08:00',
    departureTime: report.departure_time || '17:30',
    mapsIn: report.maps_in || '',
    mapsOut: report.maps_out || '',
    totalPrivilege: report.priv,
    totalRoaming: report.roam,
    totalBundles: report.bund,
    targets: { privilege: 20, roaming: 20, bundle: 20 },
    leads: params.leads
      .filter((lead) => lead.agent_id === params.agentId && toISO(lead.timestamp) === report.date)
      .map((lead) => ({
        timestamp: lead.timestamp,
        client_name: lead.client_name,
        msisdn: lead.msisdn,
        action_type: lead.action_type
      })),
    pointagePhoto: report.pointage_photo || '',
    photos: report.photos || [],
    comment: report.comment || '',
    evolutionData: [report.priv, report.priv + report.roam, report.priv + report.roam + report.bund]
  }));

  const groups = params.reports.reduce<Array<{ supervisor: string; agentCount: number; totalLeads: number; totalPrivilege: number; totalRoaming: number; totalBundles: number }>>((acc, report) => {
    const existing = acc.find((group) => group.supervisor === (report.shop_name || params.shopName || 'Administration'));
    if (existing) {
      existing.agentCount += 1;
      existing.totalLeads += report.priv + report.roam + report.bund;
      existing.totalPrivilege += report.priv;
      existing.totalRoaming += report.roam;
      existing.totalBundles += report.bund;
    } else {
      acc.push({
        supervisor: report.shop_name || params.shopName || 'Administration',
        agentCount: 1,
        totalLeads: report.priv + report.roam + report.bund,
        totalPrivilege: report.priv,
        totalRoaming: report.roam,
        totalBundles: report.bund
      });
    }
    return acc;
  }, []);

  return {
    title: `Compilation ${params.agentName}`,
    period: params.reports.length ? `${params.reports[0].date} → ${params.reports[params.reports.length - 1].date}` : 'Aucune période',
    rows,
    totals,
    reports,
    groups
  };
}
