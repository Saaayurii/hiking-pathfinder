/**
 * Types for A* pathfinding algorithm
 */

export interface GraphNode {
  id: string;
  lat: number;
  lng: number;
  elevation: number;
  coefficient: number; // Terrain walkability coefficient
  terrainType?: string;

  // A* specific properties
  g: number; // Cost from start to this node
  h: number; // Heuristic cost to goal
  f: number; // Total cost (g + h)
  parent: GraphNode | null;
  closed: boolean;
  opened: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight: number; // Cost to traverse this edge
  distance: number; // Physical distance in meters
}

export interface PathfindingGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge[]>; // nodeId -> list of edges
}

export interface PathfindingOptions {
  maxSlope?: number; // Maximum allowed slope in degrees (default: 35)
  avoidTypes?: string[]; // Terrain types to avoid
  preferOfficial?: boolean; // Prefer official trails
  minVisibility?: string; // Minimum trail visibility
  gridSizeMeters?: number; // Grid cell size (default: 20)
  customCoefficients?: Record<string, number>;
}

export interface PathfindingResult {
  path: Array<{ lat: number; lng: number; elevation: number }>;
  distance: number;
  duration: number;
  totalCost: number;
  nodesExplored: number;
}

/**
 * Priority queue item for A* algorithm
 */
export interface PriorityQueueItem {
  node: GraphNode;
  priority: number; // f-score
}
