import test from 'node:test';
import assert from 'node:assert/strict';
import { getOffsetFromDate, getDateFromOffset, formatPeriodLabel } from '../src/utils/period';

test('converts dates to offsets and back consistently', () => {
  const firstLeadDate = '2026-07-01';
  const offset = getOffsetFromDate('2026-07-03', firstLeadDate);
  assert.equal(offset, 2);
  assert.equal(getDateFromOffset(offset, firstLeadDate), '2026-07-03');
});

test('formats a compact label for the admin period selector', () => {
  assert.equal(formatPeriodLabel('range', '2026-07-01', '2026-07-05'), '2026-07-01 → 2026-07-05');
  assert.equal(formatPeriodLabel('day', '2026-07-05', '2026-07-05'), '2026-07-05');
});
