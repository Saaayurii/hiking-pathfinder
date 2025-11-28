/**
 * Graph construction for terrain-based pathfinding
 */

import type { PathfindingGraph, GraphNode, GraphEdge, PathfindingOptions } from './types';
import { haversineHeuristic } from './heuristics';
import { calculateSlope, getSlopeFactor, isWalkable } from '../terrain/slope';
import { calculateTerrainCoefficient, DEFAULT_COEFFICIENTS } from '../terrain/coefficients';

/**
 * Create a node ID from coordinates
 */
export function createNodeId(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * Parse node ID back to coordinates
 */
export function parseNodeId(id: string): { lat: number; lng: number } {
  const [lat, lng] = id.split(',').map(Number);
  return { lat, lng };
}

/**
 * Build a grid-based graph for the area between start and goal
 */
export async function buildTerrainGraph(
  start: { lat: number; lng: number },
  goal: { lat: number; lng: number },
  elevationData: Map<string, number>,
  terrainData: Map<string, { type: string; coefficient: number }>,
  options: PathfindingOptions = {}
): Promise<PathfindingGraph> {
  const gridSizeMeters = options.gridSizeMeters || 20;
  const maxSlope = options.maxSlope || 35;

  // Calculate grid bounds with some padding
  const padding = 0.01; // ~1km padding
  const minLat = Math.min(start.lat, goal.lat) - padding;
  const maxLat = Math.max(start.lat, goal.lat) + padding;
  const minLng = Math.min(start.lng, goal.lng) - padding;
  const maxLng = Math.max(start.lng, goal.lng) + padding;

  // Convert grid size to degrees
  const latStep = gridSizeMeters / 111000;
  const avgLat = (minLat + maxLat) / 2;
  const lngStep = gridSizeMeters / (111000 * Math.cos((avgLat * Math.PI) / 180));

  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge[]>();

  // Create grid nodes
  for (let lat = minLat; lat <= maxLat; lat += latStep) {
    for (let lng = minLng; lng <= maxLng; lng += lngStep) {
      const nodeId = createNodeId(lat, lng);
      const elevation = elevationData.get(nodeId) || 0;

      // Get terrain data or use default
      const terrain = terrainData.get(nodeId) || {
        type: 'unknown',
        coefficient: DEFAULT_COEFFICIENTS['unknown'] || 3.5,
      };

      // Skip impassable nodes (water, extreme terrain)
      if (terrain.coefficient >= 10.0) {
        continue;
      }

      // Filter by terrain type if specified
      if (options.avoidTypes && options.avoidTypes.includes(terrain.type)) {
        continue;
      }

      const node: GraphNode = {
        id: nodeId,
        lat,
        lng,
        elevation,
        coefficient: terrain.coefficient,
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

  // Add start and goal nodes if not in grid
  const startId = createNodeId(start.lat, start.lng);
  if (!nodes.has(startId)) {
    nodes.set(startId, {
      id: startId,
      lat: start.lat,
      lng: start.lng,
      elevation: elevationData.get(startId) || 0,
      coefficient: 1.0,
      g: Infinity,
      h: 0,
      f: Infinity,
      parent: null,
      closed: false,
      opened: false,
    });
    edges.set(startId, []);
  }

  const goalId = createNodeId(goal.lat, goal.lng);
  if (!nodes.has(goalId)) {
    nodes.set(goalId, {
      id: goalId,
      lat: goal.lat,
      lng: goal.lng,
      elevation: elevationData.get(goalId) || 0,
      coefficient: 1.0,
      g: Infinity,
      h: 0,
      f: Infinity,
      parent: null,
      closed: false,
      opened: false,
    });
    edges.set(goalId, []);
  }

  // Create edges (8-directional connectivity)
  const directions = [
    [-1, -1], [0, -1], [1, -1], // Top row
    [-1, 0], /*[0, 0],*/ [1, 0],  // Middle row
    [-1, 1], [0, 1], [1, 1],       // Bottom row
  ];

  for (const [nodeId, node] of nodes) {
    const nodeEdges: GraphEdge[] = [];

    for (const [dLat, dLng] of directions) {
      const neighborLat = node.lat + dLat * latStep;
      const neighborLng = node.lng + dLng * lngStep;
      const neighborId = createNodeId(neighborLat, neighborLng);

      const neighbor = nodes.get(neighborId);
      if (!neighbor) continue;

      // Check if slope is walkable
      const slope = calculateSlope(
        { lat: node.lat, lng: node.lng, elevation: node.elevation },
        { lat: neighbor.lat, lng: neighbor.lng, elevation: neighbor.elevation }
      );

      if (!isWalkable(slope, maxSlope)) {
        continue;
      }

      // Calculate edge weight
      const distance = haversineHeuristic(node, neighbor);

      // Determine if uphill
      const isUphill = neighbor.elevation > node.elevation;

      // Get slope factor
      const slopeFactor = getSlopeFactor(slope, isUphill);

      // Edge weight = distance * terrain_coefficient * slope_factor
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
 * Get neighbors of a node
 */
export function getNeighbors(graph: PathfindingGraph, nodeId: string): GraphNode[] {
  const edgeList = graph.edges.get(nodeId) || [];
  return edgeList
    .map((edge) => graph.nodes.get(edge.to))
    .filter((node): node is GraphNode => node !== undefined);
}

/**
 * Get edge between two nodes
 */
export function getEdge(
  graph: PathfindingGraph,
  fromId: string,
  toId: string
): GraphEdge | undefined {
  const edges = graph.edges.get(fromId) || [];
  return edges.find((edge) => edge.to === toId);
}

/**
 * Reset graph for new pathfinding search
 */
export function resetGraph(graph: PathfindingGraph): void {
  for (const node of graph.nodes.values()) {
    node.g = Infinity;
    node.h = 0;
    node.f = Infinity;
    node.parent = null;
    node.closed = false;
    node.opened = false;
  }
}
