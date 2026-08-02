import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentCompilationPayload } from '../src/utils/agentCompilation';

test('buildAgentCompilationPayload creates a cover, summary rows and report pages for one agent', () => {
  const payload = buildAgentCompilationPayload({
    agentId: 'agent-1',
    agentName: 'Marie Dupont',
    shopName: 'Shop A',
    reports: [
      {
        date: '2026-08-01',
        agent_name: 'Marie Dupont',
        shop_name: 'Shop A',
        agent_id: 'agent-1',
        arrival_time: '08:00',
        departure_time: '17:30',
        maps_in: '',
        maps_out: '',
        priv: 5,
        roam: 2,
        bund: 3,
        pointage_photo: '',
        photos: [],
        comment: ''
      }
    ],
    leads: [
      {
        agent_id: 'agent-1',
        timestamp: '2026-08-01T08:15:00.000Z',
        client_name: 'Alice',
        msisdn: '0810000000',
        action_type: 'Opt-in Privilège'
      }
    ]
  });

  assert.equal(payload.title, 'Compilation Marie Dupont');
  assert.equal(payload.rows[0].agent, 'Marie Dupont');
  assert.equal(payload.totals.privilege, 5);
  assert.equal(payload.reports[0].leads.length, 1);
  assert.equal(payload.groups[0].agentCount, 1);
  assert.ok(payload.reports[0].pointagePhoto === '');
});
