export interface AgentLocationDetails {
  shop: string;
  status?: string;
  arrivalTime?: string;
  departureTime?: string;
  mapsIn?: string;
  mapsOut?: string;
  lat?: number;
  long?: number;
}

export function formatAgentLocationLine(details: AgentLocationDetails): string {
  const baseShop = details.shop?.trim() || 'Shop non défini';

  if (details.status === 'Présent' && details.arrivalTime) {
    return `${baseShop} | ${details.arrivalTime}`;
  }

  if (details.status === 'Clôturé' && details.departureTime) {
    return `${baseShop} | ${details.departureTime}`;
  }

  return baseShop;
}

export function getLocationEmbedUrl(details: AgentLocationDetails, fallbackLat = -4.3033, fallbackLong = 15.3015): string {
  const preferredMapsUrl = details.status === 'Clôturé' ? (details.mapsOut || details.mapsIn || '') : (details.mapsIn || details.mapsOut || '');
  const mapsUrl = preferredMapsUrl;
  if (mapsUrl.includes('google.com/maps') || mapsUrl.includes('maps.google.com')) {
    return mapsUrl.replace('output=classic', 'output=embed').replace('output=sv', 'output=embed');
  }

  const lat = typeof details.lat === 'number' ? details.lat : fallbackLat;
  const long = typeof details.long === 'number' ? details.long : fallbackLong;
  return `https://www.google.com/maps?q=${lat},${long}&output=embed`;
}
