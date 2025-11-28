import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchOverpassData, calculateBounds } from '@/lib/osm/overpass';
import { overpassToGeoJSON, extractTrailSegments } from '@/lib/osm/parser';

const OSMRequestSchema = z.object({
  bounds: z.object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
  }).optional(),
  center: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  radius: z.number().optional().default(5000),
});

/**
 * GET /api/osm
 * Fetch OSM data for a bounding box or center point
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    let bounds;

    // Parse bounds from query params
    if (searchParams.has('bounds')) {
      const boundsStr = searchParams.get('bounds');
      const [south, west, north, east] = boundsStr!.split(',').map(Number);
      bounds = { north, south, east, west };
    } else if (searchParams.has('lat') && searchParams.has('lng')) {
      const lat = Number(searchParams.get('lat'));
      const lng = Number(searchParams.get('lng'));
      const radius = Number(searchParams.get('radius') || 5000);
      bounds = calculateBounds({ lat, lng }, radius);
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing bounds or center coordinates' },
        { status: 400 }
      );
    }

    // Fetch data from Overpass API
    const osmData = await fetchOverpassData(bounds);

    // Convert to GeoJSON
    const geoJSON = overpassToGeoJSON(osmData);

    // Extract trail segments
    const trailSegments = extractTrailSegments(osmData);

    return NextResponse.json({
      success: true,
      data: {
        geoJSON,
        trailSegments,
        elementCount: osmData.elements.length,
      },
    });
  } catch (error) {
    console.error('OSM API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/osm
 * Fetch OSM data with more complex request body
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = OSMRequestSchema.parse(body);

    let bounds;

    if (validated.bounds) {
      bounds = validated.bounds;
    } else if (validated.center) {
      bounds = calculateBounds(validated.center, validated.radius);
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing bounds or center' },
        { status: 400 }
      );
    }

    // Fetch data from Overpass API
    const osmData = await fetchOverpassData(bounds);

    // Convert to GeoJSON
    const geoJSON = overpassToGeoJSON(osmData);

    // Extract trail segments
    const trailSegments = extractTrailSegments(osmData);

    return NextResponse.json({
      success: true,
      data: {
        geoJSON,
        trailSegments,
        elementCount: osmData.elements.length,
      },
    });
  } catch (error) {
    console.error('OSM API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
