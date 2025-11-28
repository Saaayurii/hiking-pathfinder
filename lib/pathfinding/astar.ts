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
 * Smooth path by removing unnecessary waypoints
 * Uses Douglas-Peucker algorithm
 * @param path - Array of path points
 * @param epsilon - Tolerance in meters (not degrees!) - larger value = more simplification
 */
export function smoothPath(
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
    const left = smoothPath(path.slice(0, index + 1), epsilon);
    const right = smoothPath(path.slice(index), epsilon);

    return [...left.slice(0, -1), ...right];
  } else {
    return [start, end];
  }
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
