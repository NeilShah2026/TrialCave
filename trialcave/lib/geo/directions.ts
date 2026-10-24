/**
 * Transit directions link (B12.3). Opens Google Maps with transit mode in the
 * patient's browser — TrialCave never sends anything to Google from the server.
 */
export function transitDirectionsUrl(fromTown: string, facility: string, city: string | null): string {
  const origin = encodeURIComponent(`${fromTown}, MA`);
  const dest = encodeURIComponent(`${facility}${city ? `, ${city}` : ""}, MA`);
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=transit`;
}
