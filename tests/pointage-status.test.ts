import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPointageFeedback } from '../src/utils/pointageStatus';

test('shows the GPS message and hides the badge when GPS data is available', () => {
  const feedback = buildPointageFeedback({
    stage: 'captured',
    gpsMessage: 'GPS OK (+/- 12m) - Lat: 1.2345, Long: 2.3456',
    geoBadge: { text: 'A 45m du shop - Conforme', status: 'ok' }
  });

  assert.equal(feedback.primaryText, 'GPS OK (+/- 12m) - Lat: 1.2345, Long: 2.3456');
  assert.equal(feedback.badgeText, null);
  assert.equal(feedback.showBadge, false);
});

test('shows only the GPS fallback message when GPS is unavailable', () => {
  const feedback = buildPointageFeedback({
    stage: 'captured',
    gpsMessage: 'GPS indisponible (mode simulé actif)',
    geoBadge: { text: 'Donnees GPS non disponible', status: 'unknown' }
  });

  assert.equal(feedback.primaryText, 'GPS indisponible (mode simulé actif)');
  assert.equal(feedback.showBadge, false);
  assert.equal(feedback.badgeText, null);
});
