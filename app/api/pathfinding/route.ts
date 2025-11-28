import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { PathfindingResponse } from '@/types/api';
import { fetchElevations, calculateElevationStats, createElevationProfile } from '@/lib/terrain/elevation';
import { buildTerrainGraph, createNodeId } from '@/lib/pathfinding/graph';
import { findPath, smoothPath } from '@/lib/pathfinding/astar';
import { calculateDistance } from '@/lib/utils/geo';

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
    gridSizeMeters: z.number().optional(),
  }).optional(),
});

/**
 * A* pathfinding with terrain awareness
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = PathfindingRequestSchema.parse(body);

    const { start, end, options = {} } = validated;

    console.log('🗺️  Starting A* pathfinding...');
    console.log(`  Start: ${start.lat}, ${start.lng}`);
    console.log(`  End: ${end.lat}, ${end.lng}`);

    // Step 1: Build terrain grid and fetch elevation data
    console.log('📊 Building terrain grid...');

    const gridSize = options.gridSizeMeters || 20;
    const distance = calculateDistance(start, end);

    // Estimate grid points needed
    const estimatedPoints = Math.ceil(distance / gridSize) * 10; // Rough estimate with padding

    console.log(`  Grid size: ${gridSize}m`);
    console.log(`  Distance: ${(distance / 1000).toFixed(2)}km`);
    console.log(`  Estimated grid points: ${estimatedPoints}`);

    // Create grid points for elevation sampling
    const gridPoints: Array<{ lat: number; lng: number }> = [];
    const elevationDataMap = new Map<string, number>();
    const terrainDataMap = new Map<string, { type: string; coefficient: number }>();

    // Calculate bounds
    const padding = 0.01;
    const minLat = Math.min(start.lat, end.lat) - padding;
    const maxLat = Math.max(start.lat, end.lat) + padding;
    const minLng = Math.min(start.lng, end.lng) - padding;
    const maxLng = Math.max(start.lng, end.lng) + padding;

    // Convert grid size to degrees
    const latStep = gridSize / 111000;
    const avgLat = (minLat + maxLat) / 2;
    const lngStep = gridSize / (111000 * Math.cos((avgLat * Math.PI) / 180));

    // Sample elevation data
    const sampleRate = 2; // Sample every Nth point to reduce API calls
    let pointCount = 0;

    for (let lat = minLat; lat <= maxLat; lat += latStep * sampleRate) {
      for (let lng = minLng; lng <= maxLng; lng += lngStep * sampleRate) {
        gridPoints.push({ lat, lng });
        pointCount++;
      }
    }

    console.log(`  Sampling ${gridPoints.length} elevation points...`);

    // Fetch elevations (max 1000 points at a time)
    if (gridPoints.length > 1000) {
      console.warn(`  Too many points (${gridPoints.length}), using simplified grid`);
      // Use coarser grid
      const simplifiedGrid: Array<{ lat: number; lng: number }> = [];
      const step = Math.ceil(gridPoints.length / 1000);
      for (let i = 0; i < gridPoints.length; i += step) {
        simplifiedGrid.push(gridPoints[i]);
      }
      gridPoints.length = 0;
      gridPoints.push(...simplifiedGrid);
      console.log(`  Simplified to ${gridPoints.length} points`);
    }

    const elevations = await fetchElevations(gridPoints);

    // Map elevations to grid
    gridPoints.forEach((point, i) => {
      const nodeId = createNodeId(point.lat, point.lng);
      elevationDataMap.set(nodeId, elevations[i] || 0);

      // Default terrain (will be enhanced with OSM data later)
      terrainDataMap.set(nodeId, {
        type: 'path',
        coefficient: 2.0,
      });
    });

    // Interpolate elevations for all grid points
    for (let lat = minLat; lat <= maxLat; lat += latStep) {
      for (let lng = minLng; lng <= maxLng; lng += lngStep) {
        const nodeId = createNodeId(lat, lng);

        if (!elevationDataMap.has(nodeId)) {
          // Find nearest sampled point
          let nearestDist = Infinity;
          let nearestElev = 0;

          for (const point of gridPoints) {
            const dist = Math.abs(point.lat - lat) + Math.abs(point.lng - lng);
            if (dist < nearestDist) {
              nearestDist = dist;
              const nearestId = createNodeId(point.lat, point.lng);
              nearestElev = elevationDataMap.get(nearestId) || 0;
            }
          }

          elevationDataMap.set(nodeId, nearestElev);
          terrainDataMap.set(nodeId, {
            type: 'path',
            coefficient: 2.0,
          });
        }
      }
    }

    console.log(`✅ Elevation data ready (${elevationDataMap.size} points)`);

    // Step 2: Build graph
    console.log('🕸️  Building pathfinding graph...');

    const graph = await buildTerrainGraph(
      start,
      end,
      elevationDataMap,
      terrainDataMap,
      options
    );

    console.log(`  Nodes: ${graph.nodes.size}`);
    console.log(`  Edges: ${Array.from(graph.edges.values()).reduce((sum, edges) => sum + edges.length, 0)}`);

    // Step 3: Run A* algorithm
    console.log('🔍 Running A* algorithm...');

    const result = findPath(graph, start, end);

    if (!result) {
      console.error('❌ No path found');
      return NextResponse.json({
        success: false,
        error: 'No path found between start and end points. Try adjusting the route or increasing max slope.',
      }, { status: 404 });
    }

    console.log(`✅ Path found!`);
    console.log(`  Nodes explored: ${result.nodesExplored}`);
    console.log(`  Path length: ${result.path.length} points`);
    console.log(`  Distance: ${(result.distance / 1000).toFixed(2)}km`);

    // Step 4: Smooth path
    const smoothedPath = smoothPath(result.path, 0.00005);
    console.log(`  Smoothed to: ${smoothedPath.length} points`);

    // Step 5: Calculate statistics
    const pathElevations = smoothedPath.map(p => p.elevation);
    const elevationStats = calculateElevationStats(pathElevations);
    const elevationProfile = createElevationProfile(smoothedPath, pathElevations);

    const response: PathfindingResponse = {
      success: true,
      route: {
        name: 'Оптимальный маршрут (A*)',
        start,
        end,
        path: smoothedPath,
        distance: result.distance,
        duration: result.duration,
        elevation: {
          ...elevationStats,
          profile: elevationProfile,
        },
      },
    };

    console.log('✨ Pathfinding complete!\n');

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Pathfinding error:', error);

    const response: PathfindingResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
