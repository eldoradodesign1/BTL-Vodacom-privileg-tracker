import test from 'node:test';
import assert from 'node:assert/strict';

import { sortUsersForSimulation } from '../src/components/SimulationBar';

test('simulation user list stays alphabetically sorted by name', () => {
  const users = [
    { id: 'b', name: 'Zoe', role: 'admin', phone: '1', permanentShopId: 'S1' },
    { id: 'a', name: 'Alice', role: 'admin', phone: '2', permanentShopId: 'S1' },
    { id: 'c', name: 'Bob', role: 'admin', phone: '3', permanentShopId: 'S1' },
  ] as any;

  assert.deepEqual(
    sortUsersForSimulation(users).map((u) => u.name),
    ['Alice', 'Bob', 'Zoe']
  );
});
