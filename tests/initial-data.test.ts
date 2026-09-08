import test from 'node:test';
import assert from 'node:assert/strict';

import { INITIAL_USERS } from '../src/data/initialData';
import { getUsers } from '../src/utils/storage';

test('Eldo Bitulu must be seeded as super admin to match the production role model', () => {
  const eldo = INITIAL_USERS.find((user) => user.name === 'Eldo Bitulu');

  assert.ok(eldo, 'Eldo Bitulu should exist in the seeded users');
  assert.equal(eldo?.role, 'super_admin');
});

test('stale local storage admin data is normalized back to the canonical super-admin role', () => {
  const eldoId = '0a6a2520-96bb-474d-87b6-b0eb8fc46cd6';
  localStorage.clear();
  localStorage.setItem('vodacom_users_v6', JSON.stringify([
    { id: eldoId, phone: '0896332431', name: 'Eldo Bitulu', role: 'admin', permanentShopId: 'S001' }
  ]));

  const users = getUsers();
  const eldo = users.find((user) => user.id === eldoId);

  assert.ok(eldo, 'Eldo Bitulu should still be present in the merged user list');
  assert.equal(eldo?.role, 'super_admin');
  localStorage.clear();
});
