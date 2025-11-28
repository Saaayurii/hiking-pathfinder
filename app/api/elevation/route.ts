import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchElevations, fetchElevation } from '@/lib/terrain/elevation';

const ElevationRequestSchema = z.object({
  points: z.array(
    z.object({
      lat: z.number(),
      lng: z.number(),
    })
  ),
});

const SingleElevationRequestSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

/**
 * GET /api/elevation?lat=...&lng=...
 * Fetch elevation for a single point
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
      return NextResponse.json(
        { success: false, error: 'Missing lat or lng parameter' },
        { status: 400 }
      );
    }

    const validated = SingleElevationRequestSchema.parse({
      lat: Number(lat),
      lng: Number(lng),
    });

    const elevation = await fetchElevation(validated);

    return NextResponse.json({
      success: true,
      elevation,
    });
  } catch (error) {
    console.error('Elevation API error:', error);

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
 * POST /api/elevation
 * Fetch elevations for multiple points
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = ElevationRequestSchema.parse(body);

    // Limit to reasonable number of points
    if (validated.points.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Too many points (max 1000)' },
        { status: 400 }
      );
    }

    const elevations = await fetchElevations(validated.points);

    return NextResponse.json({
      success: true,
      elevations,
      count: elevations.length,
    });
  } catch (error) {
    console.error('Elevation API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
