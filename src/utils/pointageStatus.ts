export type PointageFeedbackStatus = 'ok' | 'warn' | 'unknown';

export interface PointageFeedbackBadge {
  text: string;
  status: PointageFeedbackStatus;
}

export interface PointageFeedbackState {
  stage: 'idle' | 'captured';
  gpsMessage?: string;
  geoBadge?: PointageFeedbackBadge;
}

export interface PointageFeedbackResult {
  primaryText: string;
  badgeText: string | null;
  showBadge: boolean;
  badgeStatus: PointageFeedbackStatus | null;
}

export const buildPointageFeedback = ({
  stage,
  gpsMessage,
  geoBadge
}: PointageFeedbackState): PointageFeedbackResult => {
  const hasGpsMessage = Boolean(gpsMessage && gpsMessage.trim().length > 0);
  const hasBadge = Boolean(geoBadge?.text && geoBadge.text.trim().length > 0);

  if (stage !== 'captured') {
    return {
      primaryText: '',
      badgeText: null,
      showBadge: false,
      badgeStatus: null
    };
  }

  if (hasGpsMessage) {
    return {
      primaryText: gpsMessage!.trim(),
      badgeText: null,
      showBadge: false,
      badgeStatus: null
    };
  }

  const badgeText = hasBadge ? geoBadge!.text : null;

  return {
    primaryText: '',
    badgeText,
    showBadge: Boolean(badgeText),
    badgeStatus: geoBadge?.status ?? null
  };
};
