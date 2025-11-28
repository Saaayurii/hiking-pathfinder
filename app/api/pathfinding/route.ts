import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { PathfindingResponse } from '@/types/api';
import type { RoutePoint } from '@/types/route';
import { fetchElevations, calculateElevationStats, createElevationProfile } from '@/lib/terrain/elevation';
import { calculateSlope, getSlopeFactor } from '@/lib/terrain/slope';

const PathfindingRequestSchema = z.object({
  start: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  end: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  waypoints: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
  })).optional(),
  options: z.object({
    maxSlope: z.number().optional(),
    coefficients: z.record(z.number()).optional(),
    avoidTypes: z.array(z.string()).optional(),
    preferOfficial: z.boolean().optional(),
    minVisibility: z.string().optional(),
  }).optional(),
});

/**
 * Enhanced pathfinding with elevation data
 * Still using straight line, but now with terrain analysis
 * TODO: Replace with A* algorithm
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = PathfindingRequestSchema.parse(body);

    const { start, end } = validated;

    // Create path with more points for better elevation accuracy
    const numPoints = 100;
    const path: RoutePoint[] = [];

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const lat = start.lat + (end.lat - start.lat) * t;
      const lng = start.lng + (end.lng - start.lng) * t;
      path.push({ lat, lng });
    }

    // Fetch elevation data for all points
    console.log('Fetching elevation data for', path.length, 'points...');
    const elevations = await fetchElevations(path);

    // Add elevation to path points
    path.forEach((point, i) => {
      point.elevation = elevations[i] || 0;
    });

    // Calculate elevation statistics
    const elevationStats = calculateElevationStats(elevations);

    // Create elevation profile
    const elevationProfile = createElevationProfile(path, elevations);

    // Calculate distance and duration with slope factors
    let totalDistance = 0;
    let totalDuration = 0; // in seconds
    const baseSpeed = 4; // km/h on flat terrain

    for (let i = 0; i < path.length - 1; i++) {
      const segmentDistance = calculateDistance(path[i], path[i + 1]);
      totalDistance += segmentDistance;

      // Calculate slope between points
      const slope = calculateSlope(
        { ...path[i], elevation: elevations[i] },
        { ...path[i + 1], elevation: elevations[i + 1] }
      );

      // Determine if uphill or downhill
      const isUphill = elevations[i + 1] > elevations[i];

      // Get slope factor (affects walking speed)
      const slopeFactor = getSlopeFactor(slope, isUphill);

      // Calculate segment duration
      const segmentSpeedKmh = baseSpeed / slopeFactor;
      const segmentDurationHours = segmentDistance / 1000 / segmentSpeedKmh;
      totalDuration += segmentDurationHours * 3600; // convert to seconds
    }

    const response: PathfindingResponse = {
      success: true,
      route: {
        name: 'Новый маршрут',
        start,
        end,
        path,
        distance: totalDistance,
        duration: totalDuration,
        elevation: {
          ...elevationStats,
          profile: elevationProfile,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Pathfinding error:', error);

    const response: PathfindingResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };

    return NextResponse.json(response, { status: 400 });
  }
}

/**
 * Haversine formula for calculating distance between two points
 * Returns distance in meters
 */
function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
