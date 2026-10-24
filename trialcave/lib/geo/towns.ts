/**
 * Massachusetts towns with centroid coordinates (B13.1).
 *
 * Used for onboarding (dropdown), synthetic patients, and transit links.
 * Coordinates are town centroids, never a person's address (B0 rule 11).
 */

export interface Town {
  name: string;
  lat: number;
  lon: number;
}

export const TOWNS: Town[] = [
  { name: "Boston", lat: 42.3601, lon: -71.0589 },
  { name: "Cambridge", lat: 42.3736, lon: -71.1097 },
  { name: "Somerville", lat: 42.3876, lon: -71.0995 },
  { name: "Brookline", lat: 42.3318, lon: -71.1212 },
  { name: "Newton", lat: 42.337, lon: -71.2092 },
  { name: "Quincy", lat: 42.2529, lon: -71.0023 },
  { name: "Dorchester", lat: 42.3016, lon: -71.0676 },
  { name: "Malden", lat: 42.4251, lon: -71.0662 },
  { name: "Waltham", lat: 42.3765, lon: -71.2356 },
  { name: "Needham", lat: 42.2809, lon: -71.2378 },
  { name: "Wellesley", lat: 42.2968, lon: -71.2924 },
  { name: "Framingham", lat: 42.2793, lon: -71.4162 },
  { name: "Burlington", lat: 42.5048, lon: -71.1956 },
  { name: "Lynn", lat: 42.4668, lon: -70.9495 },
  { name: "Salem", lat: 42.5195, lon: -70.8967 },
  { name: "Lowell", lat: 42.6334, lon: -71.3162 },
  { name: "Brockton", lat: 42.0834, lon: -71.0184 },
  { name: "Sharon", lat: 42.1237, lon: -71.1786 },
  { name: "Plymouth", lat: 41.9584, lon: -70.6673 },
  { name: "Worcester", lat: 42.2626, lon: -71.8023 },
  { name: "Springfield", lat: 42.1015, lon: -72.5898 },
];

const BY_NAME = new Map(TOWNS.map((t) => [t.name, t]));

export function getTown(name: string): Town | undefined {
  return BY_NAME.get(name);
}

export const TOWN_NAMES: string[] = TOWNS.map((t) => t.name);

/** First 17 towns are Greater Boston; synthetic patients weight toward them (B13.3). */
export const GREATER_BOSTON_TOWNS: Town[] = TOWNS.slice(0, 17);
