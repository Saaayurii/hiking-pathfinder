/**
 * A* pathfinding algorithm implementation
 */

import type { PathfindingGraph, GraphNode, PathfindingResult, PriorityQueueItem } from './types';
import { defaultHeuristic } from './heuristics';
import { createNodeId, getNeighbors, getEdge, resetGraph, findNearestNode } from './graph';

/**
 * Priority Queue implementation using binary heap
 */
class PriorityQueue {
  private heap: PriorityQueueItem[] = [];

  push(item: PriorityQueueItem): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): PriorityQueueItem | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const result = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);

    return result;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  size(): number {
    return this.heap.length;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);

      if (this.heap[index].priority >= this.heap[parentIndex].priority) {
        break;
      }

      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      let minIndex = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (
        leftChild < this.heap.length &&
        this.heap[leftChild].priority < this.heap[minIndex].priority
      ) {
        minIndex = leftChild;
      }

      if (
        rightChild < this.heap.length &&
        this.heap[rightChild].priority < this.heap[minIndex].priority
      ) {
        minIndex = rightChild;
      }

      if (minIndex === index) break;

      [this.heap[index], this.heap[minIndex]] = [this.heap[minIndex], this.heap[index]];
      index = minIndex;
    }
  }
}

/**
 * A* pathfinding algorithm
 */
export function findPath(
  graph: PathfindingGraph,
  start: { lat: number; lng: number },
  goal: { lat: number; lng: number }
): PathfindingResult | null {
  // Reset graph state
  resetGraph(graph);

  // Find nearest nodes to start and goal (they might not be exact grid points)
  const startNode = findNearestNode(graph, start);
  const goalNode = findNearestNode(graph, goal);

  if (!startNode || !goalNode) {
    console.error('Start or goal node not found in graph');
    return null;
  }

  console.log(`  Using nearest start node: ${startNode.lat.toFixed(6)}, ${startNode.lng.toFixed(6)}`);
  console.log(`  Using nearest goal node: ${goalNode.lat.toFixed(6)}, ${goalNode.lng.toFixed(6)}`);

  // Debug: Check connectivity
  const startNeighbors = getNeighbors(graph, startNode.id);
  const goalNeighbors = getNeighbors(graph, goalNode.id);
  console.log(`  Start node has ${startNeighbors.length} neighbors`);
  console.log(`  Goal node has ${goalNeighbors.length} neighbors`);

  if (startNeighbors.length === 0) {
    console.error('❌ Start node is isolated (no neighbors)!');
    return null;
  }
  if (goalNeighbors.length === 0) {
    console.error('❌ Goal node is isolated (no neighbors)!');
    return null;
  }

  // Initialize start node
  startNode.g = 0;
  startNode.h = defaultHeuristic(startNode, goalNode);
  startNode.f = startNode.g + startNode.h;

  const openSet = new PriorityQueue();
  openSet.push({ node: startNode, priority: startNode.f });
  startNode.opened = true;

  let nodesExplored = 0;

  // Main A* loop
  while (!openSet.isEmpty()) {
    const current = openSet.pop()!.node;

    // Goal reached
    if (current.id === goalNode.id) {
      return reconstructPath(current, nodesExplored);
    }

    current.closed = true;
    nodesExplored++;

    // Explore neighbors
    const neighbors = getNeighbors(graph, current.id);

    for (const neighbor of neighbors) {
      if (neighbor.closed) continue;

      const edge = getEdge(graph, current.id, neighbor.id);
      if (!edge) continue;

      // Calculate tentative g score
      const tentativeG = current.g + edge.weight;

      // If this path to neighbor is better
      if (tentativeG < neighbor.g) {
        neighbor.parent = current;
        neighbor.g = tentativeG;
        neighbor.h = defaultHeuristic(neighbor, goalNode);
        neighbor.f = neighbor.g + neighbor.h;

        if (!neighbor.opened) {
          openSet.push({ node: neighbor, priority: neighbor.f });
          neighbor.opened = true;
        }
      }
    }
  }

  // No path found
  console.warn('No path found from start to goal');
  return null;
}

/**
 * Reconstruct path from goal to start
 */
function reconstructPath(goalNode: GraphNode, nodesExplored: number): PathfindingResult {
  const path: Array<{ lat: number; lng: number; elevation: number }> = [];
  let current: GraphNode | null = goalNode;
  let totalDistance = 0;
  let totalDuration = 0;

  // Build path backwards
  while (current !== null) {
    path.unshift({
      lat: current.lat,
      lng: current.lng,
      elevation: current.elevation,
    });

    if (current.parent) {
      // Calculate segment distance and duration
      const parent = current.parent;
      const distance = haversineDistance(parent, current);
      totalDistance += distance;

      // Calculate duration based on coefficient and slope
      const baseSpeed = 4000; // 4 km/h in m/h
      const effectiveSpeed = baseSpeed / current.coefficient;
      totalDuration += (distance / effectiveSpeed) * 3600; // in seconds
    }

    current = current.parent;
  }

  return {
    path,
    distance: totalDistance,
    duration: totalDuration,
    totalCost: goalNode.g,
    nodesExplored,
  };
}

/**
 * Haversine distance between two nodes
 */
function haversineDistance(
  node1: { lat: number; lng: number },
  node2: { lat: number; lng: number }
): number {
  const R = 6371000;
  const φ1 = (node1.lat * Math.PI) / 180;
  const φ2 = (node2.lat * Math.PI) / 180;
  const Δφ = ((node2.lat - node1.lat) * Math.PI) / 180;
  const Δλ = ((node2.lng - node1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Simplify path by removing unnecessary waypoints
 * Uses Douglas-Peucker algorithm
 * @param path - Array of path points
 * @param epsilon - Tolerance in meters (not degrees!) - larger value = more simplification
 */
export function simplifyPath(
  path: Array<{ lat: number; lng: number; elevation: number }>,
  epsilon: number = 50
): Array<{ lat: number; lng: number; elevation: number }> {
  if (path.length <= 2) return path;

  // Find point with maximum distance from line
  let maxDist = 0;
  let index = 0;

  const start = path[0];
  const end = path[path.length - 1];

  for (let i = 1; i < path.length - 1; i++) {
    const dist = perpendicularDistance(path[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  // If max distance > epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = simplifyPath(path.slice(0, index + 1), epsilon);
    const right = simplifyPath(path.slice(index), epsilon);

    return [...left.slice(0, -1), ...right];
  } else {
    return [start, end];
  }
}

/**
 * Catmull-Rom spline interpolation for smooth curves
 * Creates a smooth curve passing through all control points
 */
function catmullRomSpline(
  p0: { lat: number; lng: number; elevation: number },
  p1: { lat: number; lng: number; elevation: number },
  p2: { lat: number; lng: number; elevation: number },
  p3: { lat: number; lng: number; elevation: number },
  t: number,
  tension: number = 0.5
): { lat: number; lng: number; elevation: number } {
  const t2 = t * t;
  const t3 = t2 * t;

  // Catmull-Rom basis functions with tension parameter
  const s = (1 - tension) / 2;

  const h1 = -s * t3 + 2 * s * t2 - s * t;
  const h2 = (2 - s) * t3 + (s - 3) * t2 + 1;
  const h3 = (s - 2) * t3 + (3 - 2 * s) * t2 + s * t;
  const h4 = s * t3 - s * t2;

  return {
    lat: h1 * p0.lat + h2 * p1.lat + h3 * p2.lat + h4 * p3.lat,
    lng: h1 * p0.lng + h2 * p1.lng + h3 * p2.lng + h4 * p3.lng,
    elevation: h1 * p0.elevation + h2 * p1.elevation + h3 * p2.elevation + h4 * p3.elevation,
  };
}

/**
 * Smooth path using Catmull-Rom spline interpolation
 * Creates smooth curves through all waypoints
 * @param path - Array of path points
 * @param pointsPerSegment - Number of interpolated points between each pair of original points
 * @param tension - Spline tension (0 = loose, 1 = tight). Default 0.5 for natural curves
 */
export function interpolatePathWithSpline(
  path: Array<{ lat: number; lng: number; elevation: number }>,
  pointsPerSegment: number = 5,
  tension: number = 0.5
): Array<{ lat: number; lng: number; elevation: number }> {
  if (path.length <= 2) return path;

  const result: Array<{ lat: number; lng: number; elevation: number }> = [];

  // For each segment between points
  for (let i = 0; i < path.length - 1; i++) {
    // Get 4 control points for Catmull-Rom (handle boundaries)
    const p0 = path[Math.max(0, i - 1)];
    const p1 = path[i];
    const p2 = path[i + 1];
    const p3 = path[Math.min(path.length - 1, i + 2)];

    // Add the start point of this segment
    result.push(p1);

    // Interpolate points between p1 and p2
    for (let j = 1; j < pointsPerSegment; j++) {
      const t = j / pointsPerSegment;
      result.push(catmullRomSpline(p0, p1, p2, p3, t, tension));
    }
  }

  // Add the last point
  result.push(path[path.length - 1]);

  return result;
}

/**
 * Smooth path by first simplifying then interpolating with splines
 * This creates smooth, natural-looking curves while maintaining route accuracy
 * @param path - Array of path points
 * @param epsilon - Simplification tolerance in meters
 * @param pointsPerSegment - Number of interpolated points per segment (default 4)
 * @param tension - Spline tension (0.3-0.7 recommended, default 0.5)
 */
export function smoothPath(
  path: Array<{ lat: number; lng: number; elevation: number }>,
  epsilon: number = 30
): Array<{ lat: number; lng: number; elevation: number }> {
  if (path.length <= 2) return path;

  // Step 1: Simplify path to remove redundant points
  const simplified = simplifyPath(path, epsilon);

  // Step 2: If we have enough points, apply spline interpolation for smooth curves
  if (simplified.length >= 3) {
    // Calculate average segment distance to determine interpolation density
    let totalDist = 0;
    for (let i = 0; i < simplified.length - 1; i++) {
      totalDist += haversineDistance(simplified[i], simplified[i + 1]);
    }
    const avgSegmentDist = totalDist / (simplified.length - 1);

    // More interpolation points for longer segments
    // Aim for ~20m between interpolated points for smooth appearance
    const pointsPerSegment = Math.max(3, Math.min(10, Math.ceil(avgSegmentDist / 20)));

    return interpolatePathWithSpline(simplified, pointsPerSegment, 0.5);
  }

  return simplified;
}

/**
 * Perpendicular distance from point to line
 */
function perpendicularDistance(
  point: { lat: number; lng: number },
  lineStart: { lat: number; lng: number },
  lineEnd: { lat: number; lng: number }
): number {
  const dx = lineEnd.lng - lineStart.lng;
  const dy = lineEnd.lat - lineStart.lat;

  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return haversineDistance(point, lineStart);

  const u =
    ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / (mag * mag);

  const closest = {
    lng: lineStart.lng + u * dx,
    lat: lineStart.lat + u * dy,
  };

  return haversineDistance(point, closest);
}
