export function cleanReportComment(value?: string | null): string {
  if (!value) return '';
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/^\s*(?:process(?:us|ing)?|summary|synth[eè]se|comment(?:aire)?|analysis|analyse)\s*:\s*(?:\*+\s*)?/i, '')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[\s>*•-]+(?=\S)/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
