import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { Route } from '@/types/route';

const RouteSchema = z.object({
  name: z.string().min(1).max(200),
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
  path: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
    elevation: z.number().optional(),
    coefficient: z.number().optional(),
  })),
  distance: z.number(),
  duration: z.number(),
  elevation: z.object({
    gain: z.number(),
    loss: z.number(),
    max: z.number(),
    min: z.number(),
    profile: z.array(z.object({
      distance: z.number(),
      elevation: z.number(),
    })),
  }).optional(),
  zoneStats: z.record(z.object({
    distance: z.number(),
    percentage: z.number(),
  })).optional(),
  trailQuality: z.object({
    avgVisibility: z.string(),
    avgSmoothness: z.string(),
    officialPercent: z.number(),
    avgWidth: z.number().nullable(),
  }).optional(),
});

/**
 * GET /api/routes - List all routes
 * GET /api/routes?id=xxx - Get specific route
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // Get specific route
      const route = await prisma.route.findUnique({
        where: { id },
      });

      if (!route) {
        return NextResponse.json(
          { success: false, error: 'Route not found' },
          { status: 404 }
        );
      }

      // Transform database model to API model
      const routeData: Route = {
        id: route.id,
        name: route.name,
        start: { lat: route.startLat, lng: route.startLng },
        end: { lat: route.endLat, lng: route.endLng },
        waypoints: route.waypoints as any,
        path: route.path as any,
        distance: route.distance,
        duration: route.duration,
        elevation: route.elevation as any,
        zoneStats: route.zoneStats as any,
        trailQuality: route.trailQuality as any,
        createdAt: route.createdAt,
        updatedAt: route.updatedAt,
      };

      return NextResponse.json({
        success: true,
        route: routeData,
      });
    }

    // List all routes
    const routes = await prisma.route.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        distance: true,
        duration: true,
        createdAt: true,
        startLat: true,
        startLng: true,
        endLat: true,
        endLng: true,
      },
    });

    return NextResponse.json({
      success: true,
      routes: routes.map(r => ({
        id: r.id,
        name: r.name,
        distance: r.distance,
        duration: r.duration,
        createdAt: r.createdAt,
        start: { lat: r.startLat, lng: r.startLng },
        end: { lat: r.endLat, lng: r.endLng },
      })),
    });
  } catch (error) {
    console.error('Error fetching routes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch routes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/routes - Create new route
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = RouteSchema.parse(body);

    const route = await prisma.route.create({
      data: {
        name: validated.name,
        startLat: validated.start.lat,
        startLng: validated.start.lng,
        endLat: validated.end.lat,
        endLng: validated.end.lng,
        waypoints: validated.waypoints ? validated.waypoints : Prisma.JsonNull,
        path: validated.path as any,
        distance: validated.distance,
        duration: validated.duration,
        elevation: validated.elevation ? validated.elevation : Prisma.JsonNull,
        zoneStats: validated.zoneStats ? validated.zoneStats : Prisma.JsonNull,
        trailQuality: validated.trailQuality ? validated.trailQuality : Prisma.JsonNull,
      },
    });

    return NextResponse.json({
      success: true,
      id: route.id,
      route: {
        id: route.id,
        name: route.name,
        createdAt: route.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating route:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid route data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create route' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/routes?id=xxx - Update route
 */
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Route ID required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = RouteSchema.parse(body);

    const route = await prisma.route.update({
      where: { id },
      data: {
        name: validated.name,
        startLat: validated.start.lat,
        startLng: validated.start.lng,
        endLat: validated.end.lat,
        endLng: validated.end.lng,
        waypoints: validated.waypoints ? validated.waypoints : Prisma.JsonNull,
        path: validated.path as any,
        distance: validated.distance,
        duration: validated.duration,
        elevation: validated.elevation ? validated.elevation : Prisma.JsonNull,
        zoneStats: validated.zoneStats ? validated.zoneStats : Prisma.JsonNull,
        trailQuality: validated.trailQuality ? validated.trailQuality : Prisma.JsonNull,
      },
    });

    return NextResponse.json({
      success: true,
      route: {
        id: route.id,
        name: route.name,
        updatedAt: route.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating route:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid route data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update route' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/routes?id=xxx - Delete route
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Route ID required' },
        { status: 400 }
      );
    }

    await prisma.route.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Route deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting route:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete route' },
      { status: 500 }
    );
  }
}
