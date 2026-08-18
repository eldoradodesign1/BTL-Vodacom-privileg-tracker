import type { DailyReport } from '../types';

export interface AgentLocationDetails {
  shop: string;
  status?: string;
  arrivalTime?: string;
  departureTime?: string;
  mapsIn?: string;
  mapsOut?: string;
  lat?: number;
  long?: number;
  reportObj?: Pick<DailyReport, 'maps_in' | 'maps_out' | 'arrival_time' | 'departure_time'>;
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

function extractCoordinates(value: string): { lat: number; long: number } | null {
  if (!value) return null;

  const decoded = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();

  const patterns = [
    /[?&](?:q|query)=(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/i,
    /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const long = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(long) && Math.abs(lat) <= 90 && Math.abs(long) <= 180) {
      return { lat, long };
    }
  }

  return null;
}

function createEmbedUrl(lat: number, long: number): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${long}`)}&output=embed`;
}

export function getLocationEmbedUrl(details: AgentLocationDetails, fallbackLat = -4.3033, fallbackLong = 15.3015): string {
  const reportMapsIn = details.reportObj?.maps_in || '';
  const reportMapsOut = details.reportObj?.maps_out || '';
  const preferredMapsUrl = details.status === 'Clôturé'
    ? (details.mapsOut || reportMapsOut || details.mapsIn || reportMapsIn)
    : (details.mapsIn || reportMapsIn || details.mapsOut || reportMapsOut);

  const coordinatesFromMaps = extractCoordinates(preferredMapsUrl);
  if (coordinatesFromMaps) {
    return createEmbedUrl(coordinatesFromMaps.lat, coordinatesFromMaps.long);
  }

  const lat = typeof details.lat === 'number' && Number.isFinite(details.lat) ? details.lat : fallbackLat;
  const long = typeof details.long === 'number' && Number.isFinite(details.long) ? details.long : fallbackLong;
  return createEmbedUrl(lat, long);
}
