import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, purgeAndResetEverything, getUsers } from '../src/utils/storage';

test('authenticate succeeds for seeded admin phone', () => {
  purgeAndResetEverything();
  const result = authenticate('0816701000', '');
  assert.equal(result.success, true);
  assert.equal(result.user?.role, 'admin');
});

test('authenticate works for seeded supervisor phone', () => {
  purgeAndResetEverything();
  const result = authenticate('0812923941', '');
  assert.equal(result.success, true);
  assert.equal(result.user?.role, 'supervisor');
});

test('users remain available after initialization', () => {
  purgeAndResetEverything();
  const users = getUsers();
  assert.ok(users.length > 0);
});
