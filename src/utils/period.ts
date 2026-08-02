export const getOffsetFromDate = (value: string, firstLeadDate: string) => {
  const start = new Date(`${firstLeadDate}T00:00:00`).getTime();
  const target = new Date(`${value}T00:00:00`).getTime();
  const dayMs = 86400000;
  const diff = Math.round((target - start) / dayMs);
  return Math.max(0, diff);
};

export const getDateFromOffset = (offset: number, firstLeadDate: string) => {
  const start = new Date(`${firstLeadDate}T00:00:00`).getTime();
  const dayMs = 86400000;
  return new Date(start + offset * dayMs).toISOString().split('T')[0];
};

export const formatPeriodLabel = (mode: 'range' | 'day', start: string, end: string) => {
  return mode === 'range' ? `${start} → ${end}` : start;
};
