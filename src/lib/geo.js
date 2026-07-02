// Geo/distance helpers for the Love Map (GPS jitter filtering, path length,
// and duration formatting).

// Haversine distance between two lat/lng points, in metres.
export function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

// Total length of a coordinate path, in km (string, 2 decimals). Defensive.
export const calculatePathDistance = (coords) => {
  if (!coords || !Array.isArray(coords) || coords.length < 2) return '0.00';
  let totalMeters = 0;
  try {
    for (let i = 1; i < coords.length; i++) {
      const p1 = coords[i - 1];
      const p2 = coords[i];
      if (p1 && p2 && typeof p1.lat === 'number' && typeof p1.lng === 'number' && typeof p2.lat === 'number' && typeof p2.lng === 'number') {
        totalMeters += getDistance(p1.lat, p1.lng, p2.lat, p2.lng);
      }
    }
  } catch (e) {
    console.error("Error calculating path distance:", e);
  }
  return (totalMeters / 1000).toFixed(2);
};

// Human-readable duration from seconds (Vietnamese).
export const formatDuration = (secs) => {
  if (!secs || isNaN(secs)) return 'Không rõ';
  if (secs < 60) return `${secs} giây`;
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins} phút ${remainingSecs > 0 ? `${remainingSecs}s` : ''}`;
};
