import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeUsersForLocalAuth } from './googleSheetsSync';
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
