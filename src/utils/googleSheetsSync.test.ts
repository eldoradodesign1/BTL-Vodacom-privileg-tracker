import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeUsersForLocalAuth, parseCheckinsFromRows } from './googleSheetsSync';
import type { User } from '../types';

test('preserves local user passwords and roles when Google Sheet users are merged', () => {
  const localUsers: User[] = [
    {
      id: 'local-1',
      phone: '0816701000',
      name: 'Admin Local',
      role: 'admin',
      password: 'localpass',
      permanentShopId: 'S001'
    }
  ];

  const importedUsers: User[] = [
    {
      id: 'sheet-1',
      phone: '0816701000',
      name: 'Admin Sheet',
      role: 'supervisor',
      password: 'sheetpass',
      permanentShopId: 'S999'
    }
  ];

  const merged = mergeUsersForLocalAuth(localUsers, importedUsers);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].password, 'localpass');
  assert.equal(merged[0].role, 'admin');
  assert.equal(merged[0].permanentShopId, 'S001');
});

test('parses Google Sheet check-ins into drive URLs and preserves pending status', () => {
  const rows = [
    ['id', 'agent_id', 'type', 'timestamp', 'lat', 'long', 'accuracy', 'photo', 'device', 'status'],
    ['chk-1', 'A1', 'IN', '2026-08-03T10:00:00.000Z', '1.23', '2.34', '5', 'https://example.com/photo.jpg', 'Mobile App', 'pending'],
    ['chk-2', 'A2', 'OUT', '2026-08-03T11:00:00.000Z', '4.56', '7.89', '3', '12345678901234567890', 'Mobile App', 'synced']
  ];

  const checkins = parseCheckinsFromRows(rows);

  assert.equal(checkins.length, 2);
  assert.equal(checkins[0].photo, 'https://example.com/photo.jpg');
  assert.equal(checkins[0].status, 'pending');
  assert.equal(checkins[1].photo, 'https://drive.google.com/uc?id=12345678901234567890');
  assert.equal(checkins[1].status, 'synced');
});
