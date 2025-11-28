import type { Route } from '@/types/route';

/**
 * Export route to GPX format
 * GPX (GPS Exchange Format) is an XML schema for GPS data
 */
export function exportToGPX(route: Route): string {
  const now = new Date().toISOString();
  
  // Build waypoints (start and end)
  const waypoints = `
  <wpt lat="${route.start.lat}" lon="${route.start.lng}">
    <name>Старт: ${route.name}</name>
    <type>start</type>
  </wpt>
  <wpt lat="${route.end.lat}" lon="${route.end.lng}">
    <name>Финиш: ${route.name}</name>
    <type>end</type>
  </wpt>`;

  // Build track points
  const trackPoints = route.path
    .map((point) => {
      const ele = point.elevation !== undefined 
        ? `    <ele>${point.elevation.toFixed(1)}</ele>` 
        : '';
      
      return `  <trkpt lat="${point.lat}" lon="${point.lng}">
${ele}
  </trkpt>`;
    })
    .join('\n');

  // Calculate statistics
  const distanceKm = (route.distance / 1000).toFixed(2);
  const durationHours = (route.duration / 3600).toFixed(2);
  
  const elevationInfo = route.elevation
    ? `
Набор высоты: ${Math.round(route.elevation.gain)}м
Сброс высоты: ${Math.round(route.elevation.loss)}м
Макс. высота: ${Math.round(route.elevation.max)}м
Мин. высота: ${Math.round(route.elevation.min)}м`
    : '';

  const description = `Расстояние: ${distanceKm}км
Время в пути: ${durationHours}ч${elevationInfo}

Создано с помощью Hiking Pathfinder`;

  // Generate GPX XML
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" 
     creator="Hiking Pathfinder" 
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(route.name)}</name>
    <desc>${escapeXml(description)}</desc>
    <time>${now}</time>
  </metadata>
${waypoints}
  <trk>
    <name>${escapeXml(route.name)}</name>
    <type>hiking</type>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;

  return gpx;
}

/**
 * Download GPX file in browser
 */
export function downloadGPX(route: Route, filename?: string): void {
  const gpxContent = exportToGPX(route);
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${sanitizeFilename(route.name)}.gpx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Sanitize filename for download
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zа-яё0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 50);
}
