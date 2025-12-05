import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { PathfindingResponse } from '@/types/api';
import type { TerrainFeature, ZoneStatistics } from '@/types/route';
import type { PathfindingGraph, GraphNode } from '@/lib/pathfinding/types';
import { findPath, smoothPath } from '@/lib/pathfinding/astar';
import { createNodeId } from '@/lib/pathfinding/graph';
import { calculateSlope, getSlopeFactor, isWalkable } from '@/lib/terrain/slope';
import { DEFAULT_COEFFICIENTS, calculateTerrainCoefficient, getCoefficientLabel } from '@/lib/terrain/coefficients';
import { fetchOverpassData, calculateBounds, type OverpassElement } from '@/lib/osm/overpass';
import { extractObstacles, doesPathIntersectObstacle, distanceToObstacle, type Obstacle } from '@/lib/osm/obstacles';
import { haversineHeuristic } from '@/lib/pathfinding/heuristics';

const PathfindingRequestSchema = z.object({
  start: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  end: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  options: z.object({
    gridSizeMeters: z.number().optional(),
    maxSlope: z.number().optional(),
    coefficients: z.record(z.number()).optional(),
    avoidTypes: z.array(z.string()).optional(),
    useSmartPathfinding: z.boolean().optional(),
  }).optional(),
});

// Elevation cache
const elevationCache = new Map<string, number>();

/**
 * Smart pathfinding API with A* algorithm, terrain awareness, and obstacle avoidance
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = PathfindingRequestSchema.parse(body);
    const { start, end, options } = validated;

    const useSmartPathfinding = options?.useSmartPathfinding ?? true;
    const gridSizeMeters = options?.gridSizeMeters || 40; // Larger grid for faster processing
    const maxSlope = options?.maxSlope || 35;
    const customCoefficients = { ...DEFAULT_COEFFICIENTS, ...(options?.coefficients || {}) };

    console.log('\n🗺️  Smart Pathfinding Started');
    console.log(`  Start: ${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}`);
    console.log(`  End: ${end.lat.toFixed(5)}, ${end.lng.toFixed(5)}`);

    // Calculate distance for determining approach
    const directDistance = haversineDistance(start, end);
    console.log(`  Direct distance: ${(directDistance / 1000).toFixed(2)}km`);

    // For very short distances or when smart pathfinding is disabled, use direct route
    if (!useSmartPathfinding || directDistance < 100) {
      return handleDirectRoute(start, end, directDistance, customCoefficients);
    }

    // Step 1: Fetch OSM data for obstacles and terrain
    console.log('\n📡 Fetching OSM data...');
    const bounds = calculateBoundsForRoute(start, end, 500); // 500m padding

    let osmElements: OverpassElement[] = [];
    let obstacles: Obstacle[] = [];
    let terrainFeatures: TerrainFeature[] = [];

    try {
      const osmData = await fetchOverpassData(bounds, true);
      osmElements = osmData.elements || [];
      console.log(`  ✓ Fetched ${osmElements.length} OSM elements`);

      // Build node map for geometry processing
      const nodeMap = buildNodeMap(osmElements);

      // Extract obstacles
      obstacles = extractObstacles(osmElements, nodeMap);
      console.log(`  ✓ Found ${obstacles.length} obstacles`);

      // Extract terrain features for visualization
      terrainFeatures = extractTerrainFeatures(osmElements, nodeMap);
      console.log(`  ✓ Found ${terrainFeatures.length} terrain features`);
    } catch (error) {
      console.warn('  ⚠️ OSM fetch failed, continuing without obstacle data');
    }

    // Step 2: Fetch elevation data
    console.log('\n🏔️  Fetching elevation data...');
    const elevationData = await fetchElevationsForGrid(
      bounds,
      gridSizeMeters
    );
    console.log(`  ✓ Loaded ${elevationData.size} elevation points`);

    // Step 3: Build terrain-aware graph
    console.log('\n🕸️  Building pathfinding graph...');
    const terrainData = buildTerrainData(
      bounds,
      gridSizeMeters,
      osmElements,
      obstacles,
      customCoefficients
    );

    const graph = buildGraph(
      bounds,
      gridSizeMeters,
      elevationData,
      terrainData,
      obstacles,
      maxSlope
    );
    console.log(`  ✓ Graph: ${graph.nodes.size} nodes`);

    // Step 4: Run A* pathfinding
    console.log('\n🔍 Running A* pathfinding...');
    const pathResult = findPath(graph, start, end);

    if (!pathResult) {
      console.log('  ⚠️ A* failed, falling back to direct route');
      return handleDirectRoute(start, end, directDistance, customCoefficients, terrainFeatures);
    }

    console.log(`  ✓ Path found: ${pathResult.path.length} points, ${pathResult.nodesExplored} nodes explored`);

    // Step 5: Smooth path
    const smoothedPath = smoothPath(pathResult.path, 30);
    console.log(`  ✓ Smoothed to ${smoothedPath.length} points`);

    // Step 6: Calculate route statistics
    const stats = calculateRouteStats(smoothedPath, pathResult.distance, customCoefficients);
    const zoneStats = calculateZoneStatistics(smoothedPath, graph, pathResult.distance);

    console.log('\n✅ Route calculated successfully');
    console.log(`  Distance: ${(pathResult.distance / 1000).toFixed(2)}km`);
    console.log(`  Duration: ${formatDuration(stats.duration)}`);
    console.log(`  Elevation gain: ${stats.elevationGain.toFixed(0)}m`);

    const response: PathfindingResponse = {
      success: true,
      route: {
        name: 'Оптимальный маршрут',
        start,
        end,
        path: smoothedPath.map(p => ({
          lat: p.lat,
          lng: p.lng,
          elevation: p.elevation,
        })),
        distance: pathResult.distance,
        duration: stats.duration,
        elevation: {
          gain: stats.elevationGain,
          loss: stats.elevationLoss,
          max: stats.maxElevation,
          min: stats.minElevation,
          profile: stats.profile,
        },
        zoneStats,
        terrainFeatures,
        trailQuality: {
          avgVisibility: 'good',
          avgSmoothness: 'intermediate',
          officialPercent: 60,
          avgWidth: 1.5,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Pathfinding error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * Handle direct route (fallback or short distances)
 */
async function handleDirectRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  distance: number,
  coefficients: Record<string, number>,
  terrainFeatures: TerrainFeature[] = []
) {
  const numPoints = Math.max(10, Math.min(50, Math.ceil(distance / 100)));
  const pathPoints: Array<{ lat: number; lng: number; elevation: number }> = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lat = start.lat + (end.lat - start.lat) * t;
    const lng = start.lng + (end.lng - start.lng) * t;
    pathPoints.push({ lat, lng, elevation: 0 });
  }

  const elevations = await fetchElevationsBatch(pathPoints);
  for (let i = 0; i < pathPoints.length; i++) {
    pathPoints[i].elevation = elevations[i];
  }

  const stats = calculateRouteStats(pathPoints, distance, coefficients);

  return NextResponse.json({
    success: true,
    route: {
      name: 'Прямой маршрут',
      start,
      end,
      path: pathPoints,
      distance,
      duration: stats.duration,
      elevation: {
        gain: stats.elevationGain,
        loss: stats.elevationLoss,
        max: stats.maxElevation,
        min: stats.minElevation,
        profile: stats.profile,
      },
      terrainFeatures,
    },
  });
}

/**
 * Build graph for A* pathfinding
 */
function buildGraph(
  bounds: { south: number; north: number; west: number; east: number },
  gridSizeMeters: number,
  elevationData: Map<string, number>,
  terrainData: Map<string, { type: string; coefficient: number }>,
  obstacles: Obstacle[],
  maxSlope: number
): PathfindingGraph {
  const latStep = gridSizeMeters / 111000;
  const avgLat = (bounds.south + bounds.north) / 2;
  const lngStep = gridSizeMeters / (111000 * Math.cos((avgLat * Math.PI) / 180));

  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, any[]>();

  // Pre-filter obstacles by type for performance
  const buildingObstacles = obstacles.filter(o => o.type === 'building');
  const otherObstacles = obstacles.filter(o => o.type !== 'building');

  console.log(`  Buildings: ${buildingObstacles.length}, Other obstacles: ${otherObstacles.length}`);

  // Create grid nodes
  for (let lat = bounds.south; lat <= bounds.north; lat += latStep) {
    for (let lng = bounds.west; lng <= bounds.east; lng += lngStep) {
      const nodeId = createNodeId(lat, lng);
      const elevation = elevationData.get(nodeId) || 200;
      const terrain = terrainData.get(nodeId) || { type: 'unknown', coefficient: 3.5 };

      // Skip impassable nodes
      if (terrain.coefficient >= 10.0) continue;

      // Check if node is inside an obstacle
      const point = { lat, lng };
      let isBlocked = false;
      let obstaclePenalty = 0;

      // Check all buildings first (critical for pathfinding)
      for (const obstacle of buildingObstacles) {
        if (!obstacle.properties.passable) {
          const dist = distanceToObstacle(point, obstacle);
          const avoidDist = obstacle.properties.avoidanceDistance || 2;
          if (dist < avoidDist) {
            isBlocked = true;
            break;
          }
          // Add penalty for being near buildings
          if (dist < avoidDist * 3) {
            obstaclePenalty = Math.max(obstaclePenalty,
              (obstacle.properties.penaltyCoefficient * 0.1) * (1 - dist / (avoidDist * 3)));
          }
        }
      }

      // Check other obstacles with a limit for performance
      if (!isBlocked) {
        const otherCheckLimit = Math.min(100, otherObstacles.length);
        for (let oi = 0; oi < otherCheckLimit; oi++) {
          const obstacle = otherObstacles[oi];
          if (!obstacle.properties.passable) {
            const dist = distanceToObstacle(point, obstacle);
            const avoidDist = obstacle.properties.avoidanceDistance || 2;
            if (dist < avoidDist) {
              isBlocked = true;
              break;
            }
            if (dist < avoidDist * 2) {
              obstaclePenalty = Math.max(obstaclePenalty,
                (obstacle.properties.penaltyCoefficient * 0.05) * (1 - dist / (avoidDist * 2)));
            }
          }
        }
      }

      if (isBlocked) continue;

      const node: GraphNode = {
        id: nodeId,
        lat,
        lng,
        elevation,
        coefficient: Math.min(10, terrain.coefficient + obstaclePenalty * 0.1),
        terrainType: terrain.type,
        g: Infinity,
        h: 0,
        f: Infinity,
        parent: null,
        closed: false,
        opened: false,
      };

      nodes.set(nodeId, node);
      edges.set(nodeId, []);
    }
  }

  // Create edges (8-directional)
  const directions = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ];

  for (const [nodeId, node] of nodes) {
    const nodeEdges: any[] = [];

    for (const [dLat, dLng] of directions) {
      const neighborLat = node.lat + dLat * latStep;
      const neighborLng = node.lng + dLng * lngStep;
      const neighborId = createNodeId(neighborLat, neighborLng);

      const neighbor = nodes.get(neighborId);
      if (!neighbor) continue;

      // Check slope
      const slope = calculateSlope(
        { lat: node.lat, lng: node.lng, elevation: node.elevation },
        { lat: neighbor.lat, lng: neighbor.lng, elevation: neighbor.elevation }
      );

      if (!isWalkable(slope, maxSlope)) continue;

      // Check for obstacle intersection - check all buildings and impassable obstacles
      let pathBlocked = false;

      // Check all buildings for edge intersection (critical)
      for (const obstacle of buildingObstacles) {
        if (!obstacle.properties.passable &&
            doesPathIntersectObstacle(node, neighbor, obstacle)) {
          pathBlocked = true;
          break;
        }
      }

      // Check other impassable obstacles
      if (!pathBlocked) {
        const edgeCheckLimit = Math.min(50, otherObstacles.length);
        for (let oi = 0; oi < edgeCheckLimit; oi++) {
          const obstacle = otherObstacles[oi];
          if (!obstacle.properties.passable &&
              (obstacle.type === 'water' || obstacle.type === 'wall' || obstacle.type === 'cliff') &&
              doesPathIntersectObstacle(node, neighbor, obstacle)) {
            pathBlocked = true;
            break;
          }
        }
      }
      if (pathBlocked) continue;

      // Calculate edge weight
      const distance = haversineHeuristic(node, neighbor);
      const isUphill = neighbor.elevation > node.elevation;
      const slopeFactor = getSlopeFactor(slope, isUphill);

      // Weight formula: distance * terrain_coefficient * slope_factor
      // This makes the algorithm prefer:
      // 1. Shorter distances
      // 2. Easier terrain (lower coefficient)
      // 3. Gentler slopes (lower slope factor)
      const weight = distance * neighbor.coefficient * slopeFactor;

      nodeEdges.push({
        from: nodeId,
        to: neighborId,
        weight,
        distance,
      });
    }

    edges.set(nodeId, nodeEdges);
  }

  return { nodes, edges };
}

/**
 * Build terrain data from OSM elements
 */
function buildTerrainData(
  bounds: { south: number; north: number; west: number; east: number },
  gridSizeMeters: number,
  osmElements: OverpassElement[],
  obstacles: Obstacle[],
  coefficients: Record<string, number>
): Map<string, { type: string; coefficient: number }> {
  const terrainData = new Map<string, { type: string; coefficient: number }>();
  const latStep = gridSizeMeters / 111000;
  const avgLat = (bounds.south + bounds.north) / 2;
  const lngStep = gridSizeMeters / (111000 * Math.cos((avgLat * Math.PI) / 180));

  // Initialize with default terrain
  for (let lat = bounds.south; lat <= bounds.north; lat += latStep) {
    for (let lng = bounds.west; lng <= bounds.east; lng += lngStep) {
      const nodeId = createNodeId(lat, lng);
      terrainData.set(nodeId, { type: 'ground', coefficient: coefficients['ground'] || 2.5 });
    }
  }

  // Process OSM elements to determine terrain type
  for (const element of osmElements) {
    if (element.type !== 'way' || !element.tags) continue;

    const tags = element.tags;
    let terrainType = 'unknown';
    let coefficient = coefficients['unknown'] || 3.5;

    // Paths and trails - good for walking
    if (tags.highway) {
      switch (tags.highway) {
        case 'path':
        case 'footway':
          terrainType = tags.surface || 'path';
          coefficient = calculateTerrainCoefficient({
            surface: tags.surface || 'path',
            visibility: tags.trail_visibility,
            smoothness: tags.smoothness,
            informal: tags.informal === 'yes',
          });
          break;
        case 'track':
          terrainType = tags.surface || 'gravel';
          coefficient = coefficients['gravel'] || 2.0;
          break;
        case 'steps':
          terrainType = 'paved';
          coefficient = coefficients['paved'] * 1.5; // Steps are slower
          break;
        case 'residential':
        case 'service':
          terrainType = 'paved';
          coefficient = coefficients['paved'] || 1.0;
          break;
      }
    }

    // Natural terrain
    if (tags.natural) {
      switch (tags.natural) {
        case 'wood':
        case 'grassland':
          terrainType = 'forest';
          coefficient = coefficients['forest'] || 4.0;
          break;
        case 'scrub':
        case 'heath':
          terrainType = 'grass';
          coefficient = coefficients['grass'] * 1.5;
          break;
        case 'bare_rock':
        case 'scree':
          terrainType = 'rock';
          coefficient = coefficients['rock'] || 4.5;
          break;
        case 'wetland':
          terrainType = 'wetland';
          coefficient = coefficients['wetland'] || 7.5;
          break;
        case 'water':
          terrainType = 'water';
          coefficient = 10.0; // Impassable
          break;
      }
    }

    // Landuse
    if (tags.landuse === 'forest') {
      terrainType = 'forest';
      coefficient = coefficients['forest'] || 4.0;
    }

    // Apply terrain to nearby grid points (simplified - in production, use proper geometry)
    if (element.geometry) {
      for (const point of element.geometry) {
        const nodeId = createNodeId(
          Math.round(point.lat / latStep) * latStep,
          Math.round(point.lon / lngStep) * lngStep
        );
        terrainData.set(nodeId, { type: terrainType, coefficient });
      }
    }
  }

  return terrainData;
}

/**
 * Extract terrain features for visualization
 */
function extractTerrainFeatures(
  elements: OverpassElement[],
  nodeMap: Map<number, { lat: number; lng: number }>
): TerrainFeature[] {
  const features: TerrainFeature[] = [];

  for (const element of elements) {
    if (element.type !== 'way' || !element.nodes) continue;

    const tags = element.tags || {};
    const geometry: Array<{ lat: number; lng: number }> = [];

    for (const nodeId of element.nodes) {
      const node = nodeMap.get(nodeId);
      if (node) {
        geometry.push(node);
      }
    }

    if (geometry.length < 2) continue;

    let type = 'unknown';
    let passable = true;
    let coefficient = 3.5;

    // Classify feature
    if (tags.natural === 'water' || tags.waterway) {
      type = 'water';
      passable = false;
      coefficient = 10.0;
    } else if (tags.natural === 'wetland') {
      type = 'wetland';
      passable = false;
      coefficient = 7.5;
    } else if (tags.natural === 'wood' || tags.landuse === 'forest') {
      type = 'forest';
      passable = true;
      coefficient = 4.0;
    } else if (tags.building) {
      type = 'building';
      passable = false;
      coefficient = 10.0;
    } else if (tags.highway) {
      type = tags.highway;
      passable = true;
      coefficient = 2.0;
    }

    features.push({
      type,
      geometry,
      tags,
      passable,
      coefficient,
    });
  }

  return features;
}

/**
 * Build node map from OSM elements
 */
function buildNodeMap(elements: OverpassElement[]): Map<number, { lat: number; lng: number }> {
  const nodeMap = new Map<number, { lat: number; lng: number }>();

  for (const element of elements) {
    if (element.type === 'node' && element.lat !== undefined && element.lon !== undefined) {
      nodeMap.set(element.id, { lat: element.lat, lng: element.lon });
    }
  }

  return nodeMap;
}

/**
 * Calculate bounds for route with padding
 */
function calculateBoundsForRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  paddingMeters: number
): { south: number; north: number; west: number; east: number } {
  const minLat = Math.min(start.lat, end.lat);
  const maxLat = Math.max(start.lat, end.lat);
  const minLng = Math.min(start.lng, end.lng);
  const maxLng = Math.max(start.lng, end.lng);

  const latPadding = paddingMeters / 111000;
  const avgLat = (minLat + maxLat) / 2;
  const lngPadding = paddingMeters / (111000 * Math.cos((avgLat * Math.PI) / 180));

  return {
    south: minLat - latPadding,
    north: maxLat + latPadding,
    west: minLng - lngPadding,
    east: maxLng + lngPadding,
  };
}

/**
 * Fetch elevations for grid
 */
async function fetchElevationsForGrid(
  bounds: { south: number; north: number; west: number; east: number },
  gridSizeMeters: number
): Promise<Map<string, number>> {
  const elevationData = new Map<string, number>();
  const points: Array<{ lat: number; lng: number }> = [];
  const nodeIds: string[] = [];

  const latStep = gridSizeMeters / 111000;
  const avgLat = (bounds.south + bounds.north) / 2;
  const lngStep = gridSizeMeters / (111000 * Math.cos((avgLat * Math.PI) / 180));

  // Collect points
  for (let lat = bounds.south; lat <= bounds.north; lat += latStep) {
    for (let lng = bounds.west; lng <= bounds.east; lng += lngStep) {
      const nodeId = createNodeId(lat, lng);

      // Check cache
      const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      const cached = elevationCache.get(cacheKey);
      if (cached !== undefined) {
        elevationData.set(nodeId, cached);
      } else {
        points.push({ lat, lng });
        nodeIds.push(nodeId);
      }
    }
  }

  // Fetch uncached elevations in parallel batches for speed
  const batchSize = 50;
  const maxParallel = 3; // Limit parallel requests to avoid rate limiting

  const batches: Array<{ points: typeof points; nodeIds: string[] }> = [];
  for (let i = 0; i < points.length; i += batchSize) {
    batches.push({
      points: points.slice(i, i + batchSize),
      nodeIds: nodeIds.slice(i, i + batchSize),
    });
  }

  // Process batches in parallel groups
  for (let i = 0; i < batches.length; i += maxParallel) {
    const parallelBatches = batches.slice(i, i + maxParallel);

    const results = await Promise.all(
      parallelBatches.map(async ({ points: batchPoints, nodeIds: batchNodeIds }) => {
        try {
          const elevations = await fetchElevationsBatch(batchPoints);
          return { elevations, batchPoints, batchNodeIds, success: true };
        } catch (error) {
          return { elevations: batchPoints.map(() => 200), batchPoints, batchNodeIds, success: false };
        }
      })
    );

    // Process results
    for (const result of results) {
      for (let j = 0; j < result.batchPoints.length; j++) {
        const elevation = result.elevations[j];
        elevationData.set(result.batchNodeIds[j], elevation);

        // Cache successful results
        if (result.success) {
          const cacheKey = `${result.batchPoints[j].lat.toFixed(4)},${result.batchPoints[j].lng.toFixed(4)}`;
          elevationCache.set(cacheKey, elevation);
        }
      }
    }
  }

  return elevationData;
}

/**
 * Fetch elevations using Open-Meteo API with retry and fallback
 */
async function fetchElevationsBatch(
  points: Array<{ lat: number; lng: number }>,
  retries = 2
): Promise<number[]> {
  if (points.length === 0) return [];

  // Try Open-Meteo API first (faster and more reliable)
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const latitudes = points.map(p => p.lat.toFixed(5)).join(',');
      const longitudes = points.map(p => p.lng.toFixed(5)).join(',');
      const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (data.elevation && Array.isArray(data.elevation)) {
          return data.elevation;
        }
      }
    } catch (error) {
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
        continue;
      }
    }
  }

  // Fallback to Open-Elevation API
  try {
    const locations = points.map(p => ({ latitude: p.lat, longitude: p.lng }));
    const url = 'https://api.open-elevation.com/api/v1/lookup';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data.results && Array.isArray(data.results)) {
        return data.results.map((r: { elevation: number }) => r.elevation);
      }
    }
  } catch (error) {
    // Silent fail, use defaults
  }

  // Return default elevation if all APIs fail
  return points.map(() => 200);
}

/**
 * Calculate route statistics
 */
function calculateRouteStats(
  path: Array<{ lat: number; lng: number; elevation: number }>,
  totalDistance: number,
  coefficients: Record<string, number>
) {
  let elevationGain = 0;
  let elevationLoss = 0;
  let maxElevation = path[0]?.elevation || 0;
  let minElevation = path[0]?.elevation || 0;

  const profile: Array<{ distance: number; elevation: number }> = [];
  let cumulativeDistance = 0;
  let totalDuration = 0;

  for (let i = 0; i < path.length; i++) {
    const point = path[i];

    if (i > 0) {
      const prev = path[i - 1];
      const segmentDist = haversineDistance(prev, point);
      cumulativeDistance += segmentDist;

      const elevDiff = point.elevation - prev.elevation;
      if (elevDiff > 0) {
        elevationGain += elevDiff;
      } else {
        elevationLoss += Math.abs(elevDiff);
      }

      // Calculate segment duration with Tobler's hiking function
      const slope = calculateSlope(
        { lat: prev.lat, lng: prev.lng, elevation: prev.elevation },
        { lat: point.lat, lng: point.lng, elevation: point.elevation }
      );
      const isUphill = elevDiff > 0;
      const slopeFactor = getSlopeFactor(slope, isUphill);

      // Base speed: 4 km/h = 1.11 m/s
      const baseSpeed = 1.11;
      const effectiveSpeed = baseSpeed / slopeFactor;
      totalDuration += segmentDist / effectiveSpeed;
    }

    maxElevation = Math.max(maxElevation, point.elevation);
    minElevation = Math.min(minElevation, point.elevation);

    profile.push({
      distance: cumulativeDistance,
      elevation: point.elevation,
    });
  }

  return {
    elevationGain,
    elevationLoss,
    maxElevation,
    minElevation,
    duration: totalDuration,
    profile,
  };
}

/**
 * Calculate zone statistics
 */
function calculateZoneStatistics(
  path: Array<{ lat: number; lng: number; elevation: number }>,
  graph: PathfindingGraph,
  totalDistance: number
): ZoneStatistics {
  const zoneDistances: Record<string, number> = {};

  for (let i = 0; i < path.length - 1; i++) {
    const point = path[i];
    const nextPoint = path[i + 1];
    const nodeId = createNodeId(point.lat, point.lng);
    const node = graph.nodes.get(nodeId);

    const terrainType = node?.terrainType || 'unknown';
    const segmentDistance = haversineDistance(point, nextPoint);

    zoneDistances[terrainType] = (zoneDistances[terrainType] || 0) + segmentDistance;
  }

  const stats: ZoneStatistics = {};
  for (const [type, distance] of Object.entries(zoneDistances)) {
    stats[type] = {
      distance,
      percentage: (distance / totalDistance) * 100,
    };
  }

  return stats;
}

/**
 * Haversine distance in meters
 */
function haversineDistance(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  const R = 6371000;
  const φ1 = (p1.lat * Math.PI) / 180;
  const φ2 = (p2.lat * Math.PI) / 180;
  const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
  const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Format duration for logging
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}ч ${minutes}мин`;
  }
  return `${minutes}мин`;
}
