import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { PathfindingResponse } from '@/types/api';
import type { RoutePoint } from '@/types/route';

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
 * Simple straight-line pathfinding endpoint
 * TODO: Replace with A* algorithm and terrain data integration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = PathfindingRequestSchema.parse(body);

    const { start, end } = validated;

    // For now, create a simple straight line between start and end
    // with 50 interpolated points for smooth visualization
    const numPoints = 50;
    const path: RoutePoint[] = [];

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const lat = start.lat + (end.lat - start.lat) * t;
      const lng = start.lng + (end.lng - start.lng) * t;
      path.push({ lat, lng });
    }

    // Calculate simple distance using Haversine formula
    const distance = calculateDistance(start, end);

    // Estimate duration (assuming average hiking speed of 4 km/h)
    const duration = (distance / 1000) / 4 * 3600; // in seconds

    const response: PathfindingResponse = {
      success: true,
      route: {
        name: 'Новый маршрут',
        start,
        end,
        path,
        distance,
        duration,
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
