export const OTHER_MFS_VALUE = '__other_mfs__';

export const MERCHANT_MFS_OPTIONS = [
  'DIEU-MERCI NSOMBI',
  'JONATHAN LUTONADIO',
  'CLAUDINE KELETE',
  'ALISON BAJIKILE',
  'KEVIN KABEYA',
  'CHANEL MIMPIYA',
  'RIX MBUYI',
  'SWEETY KASENGELA',
  'LAETITIA NANGA MUKENDI',
  'ONYX MBOKOLO',
  'ESTHER NGANA',
  'AIMÉE NTANGA',
  'SERGE KABANDANYI',
  'GLODY BASUKISA',
  'ANASTASIE NGOLELA',
  'TRÉSOR NGANDU',
  'CHARLIE NZAZI',
  'CHADRACK BWALWEMBE',
  'SANDRA MOAKAKONDE',
  'AURÉLIE MABESU',
  'JOHN NSIALA',
  'LEVIS MUBENGA',
  'CHRISSEVIE MASSAMBA',
  'ELODIE NZEBA',
  'BAUDOUIN KIVANGU',
  'DALIDA MOKOBE',
  'ISAAC BUNIAKIRI',
  'EPHRAIM LEKULANGAY',
  'JOHNNY NGOYI',
  'AMOS MALELI',
  'BOVICK LUANDA',
  'JONATHAN MAMBO',
  'PATRICK KADIMA',
  'SURPRISE NSIMBA VANGU',
  'ESTHER NDUWA',
  'PHILIPPE KENGE',
  'IDRISS LOHENDA',
  'PATRICK MUKANDA',
  'GRACE KIKUNI',
  'MIKE KAVUALA',
  'FRESNEL EPAMBO',
  'DANIELA MABESU',
  'LYDIE MONGA',
  'GRACE LUZANGI',
  'EMERY MUJINGA',
  'BIENHEUREUSE MUAKAKONDE',
  'PARFAIT BALONGI',
  'EDGAD MOBA',
] as const;

export const normalizeMerchantMfs = (value?: string | null): string => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/gi, '')
  .toUpperCase();

export const sameMerchantMfs = (left?: string | null, right?: string | null): boolean => {
  const normalizedLeft = normalizeMerchantMfs(left);
  return Boolean(normalizedLeft && normalizedLeft === normalizeMerchantMfs(right));
};

export const merchantMfsLabel = (value?: string | null): string => value === OTHER_MFS_VALUE ? 'Autre MFS' : value?.trim() || 'Tous les MFS';
