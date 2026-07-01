import React, { useCallback, useEffect, useRef } from 'react';
import type { CosmosEngine } from './cosmosEngine';
import type { NodeRecord, ClusterRecord, HoverState, FocusedEdgeRecord } from './types';

/* ═══════════════════════════════════════════════════════════
   Dynamic label tiers
   ═══════════════════════════════════════════════════════════ */

const ZOOM_TIER_MID = 1.8;
const ZOOM_TIER_DETAIL = 3.2;
const MAX_NODE_LABELS_MID = 28;
const MAX_NODE_LABELS_DETAIL = 120;

/* ═══════════════════════════════════════════════════════════ */

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 4,
  overflow: 'hidden',
};

interface LabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsOverlap(a: LabelRect, b: LabelRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function reserveRect(occupied: LabelRect[], rect: LabelRect): boolean {
  if (occupied.some((item) => rectsOverlap(item, rect))) {
    return false;
  }
  occupied.push(rect);
  return true;
}

/* ═══════════════════════════════════════════════════════════ */

interface CosmosLabelsProps {
  engine: CosmosEngine | null;
  isIsolationMode?: boolean;
  showLabels?: boolean;
  showClusterLabels?: boolean;
  showEdgeLabels?: boolean;
  tick?: number;
}

export function CosmosLabels({
  engine,
  isIsolationMode,
  showLabels = true,
  showClusterLabels = true,
  showEdgeLabels = true,
  tick,
}: CosmosLabelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevHtmlRef = useRef<string>('');

  const syncLabels = useCallback(() => {
    const container = containerRef.current;
    if (!container || !engine) {
      return;
    }

    const graph = engine.getGraph();
    if (!graph) {
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) {
      return;
    }

    const zoom = engine.getZoomLevel();
    const nodes = engine.getNodes() as NodeRecord[];
    const clusters = engine.getClusters() as ClusterRecord[];
    const hover = engine.getHoverState();

    const positions = engine.getPointPositionsForRender();

    const project = (index: number): [number, number] | null => {
      if (!positions || index * 2 + 1 >= positions.length) {
        return null;
      }
      const sx = positions[index * 2];
      const sy = positions[index * 2 + 1];
      if (sx === undefined || sy === undefined) {
        return null;
      }
      try {
        return graph.spaceToScreenPosition([sx, sy]);
      } catch {
        return null;
      }
    };

    const margin = 70;
    const isVisible = (pos: [number, number]): boolean =>
      pos[0] > -margin &&
      pos[0] < width + margin &&
      pos[1] > -margin &&
      pos[1] < height + margin &&
      isFinite(pos[0]) &&
      isFinite(pos[1]);

    const elements: string[] = [];
    const occupied: LabelRect[] = [];
    const clusterLimit = nodes.length >= 2500 ? 10 : nodes.length >= 800 ? 14 : 24;

    if (!showLabels && !showClusterLabels) {
      /* both off */
    } else if (isIsolationMode || nodes.length <= 60) {
      if (showClusterLabels) {
        renderClusterLabels(elements, clusters, engine, graph, positions, isVisible, occupied, clusterLimit);
      }
      if (showLabels) {
        renderNodeLabels(
          elements,
          nodes,
          project,
          isVisible,
          hover,
          nodes.length,
          occupied,
          Boolean(isIsolationMode && nodes.length <= 120)
        );
      }
    } else {
      if (showClusterLabels) {
        renderClusterLabels(elements, clusters, engine, graph, positions, isVisible, occupied, clusterLimit);
      }

      if (showLabels && hover.lockedNodeId) {
        const focused = new Set<string>([hover.lockedNodeId]);
        hover.hoveredNeighborIds?.forEach((id) => focused.add(id));
        const focusedNodes = nodes
          .filter((node) => focused.has(node.id))
          .sort((a, b) => (a.id === hover.lockedNodeId ? -1 : b.id === hover.lockedNodeId ? 1 : b.degree - a.degree));
        renderNodeLabels(elements, focusedNodes, project, isVisible, hover, 32, occupied);
      } else if (showLabels && zoom >= ZOOM_TIER_MID) {
        const sorted = [...nodes].sort((a, b) => b.degree - a.degree);
        const limit = zoom >= ZOOM_TIER_DETAIL ? MAX_NODE_LABELS_DETAIL : MAX_NODE_LABELS_MID;
        renderNodeLabels(elements, sorted, project, isVisible, hover, limit, occupied);
      }
    }

    const shouldRenderFocusedEdgeLabels =
      Boolean(hover.lockedNodeId) ||
      hover.lockedLinkIndex !== undefined ||
      engine.getLayout().hoverMode === 'focus' ||
      (engine.getLayout().hoverMode !== 'panel' && nodes.length <= 800);

    if (showEdgeLabels && shouldRenderFocusedEdgeLabels) {
      renderFocusedEdgeLabels(elements, engine.getFocusedEdges(), engine, graph, positions, isVisible, occupied);
    }

    const html = elements.join('');
    if (html !== prevHtmlRef.current) {
      container.innerHTML = html;
      prevHtmlRef.current = html;
    }
  }, [engine, isIsolationMode, showLabels, showClusterLabels, showEdgeLabels]);

  useEffect(() => {
    syncLabels();
  }, [syncLabels, tick]);

  return <div ref={containerRef} style={containerStyle} />;
}

/* ═══════════════════════════════════════════════════════════ */

function renderClusterLabels(
  out: string[],
  clusters: ClusterRecord[],
  engine: CosmosEngine,
  graph: any,
  positions: ArrayLike<number> | null,
  isVisible: (pos: [number, number]) => boolean,
  occupied: LabelRect[],
  maxLabels: number
): void {
  const stableClusterPositions = engine.getClusterPositionsMap();
  let clusterPositions: number[] | null = null;
  try {
    clusterPositions = graph.getClusterPositions();
  } catch {
    /* */
  }

  let rendered = 0;
  const sorted = [...clusters].sort((a, b) => b.count - a.count);

  for (const c of sorted) {
    if (rendered >= maxLabels) {
      break;
    }
    if (c.count < 2) {
      continue;
    }
    const ci = clusters.indexOf(c);
    let pos = getClusterCentroidScreenPosition(c, graph, positions);

    const stablePosition = !pos ? stableClusterPositions.get(c.key) : undefined;
    if (!pos && stablePosition) {
      try {
        pos = graph.spaceToScreenPosition(stablePosition);
      } catch {
        /* */
      }
    }

    if (!pos && clusterPositions && ci * 2 + 1 < clusterPositions.length) {
      const cx = clusterPositions[ci * 2];
      const cy = clusterPositions[ci * 2 + 1];
      if (cx !== undefined && cy !== undefined && isFinite(cx) && isFinite(cy)) {
        try {
          pos = graph.spaceToScreenPosition([cx, cy]);
        } catch {
          /* */
        }
      }
    }

    if (!pos || !isVisible(pos)) {
      if (c.nodeIndices.length > 0) {
        if (positions) {
          const midIdx = c.nodeIndices[Math.floor(c.nodeIndices.length / 2)];
          if (midIdx * 2 + 1 < positions.length) {
            try {
              pos = graph.spaceToScreenPosition([positions[midIdx * 2], positions[midIdx * 2 + 1]]);
            } catch {
              /* */
            }
          }
        }
      }
    }

    if (!pos || !isVisible(pos)) {
      continue;
    }

    const text = trunc(c.label, 24);
    const labelWidth = Math.min(240, 42 + text.length * 7 + String(c.count).length * 7);
    const labelHeight = 28;
    if (
      !reserveRect(occupied, {
        x: pos[0] - labelWidth / 2,
        y: pos[1] - labelHeight / 2,
        width: labelWidth,
        height: labelHeight,
      })
    ) {
      continue;
    }

    out.push(
      `<div style="position:absolute;left:${pos[0]}px;top:${pos[1]}px;transform:translate(-50%,-50%);` +
        `display:flex;align-items:center;gap:8px;padding:5px 11px;border-radius:999px;` +
        `background:rgba(255,255,255,0.92);backdrop-filter:blur(8px);` +
        `box-shadow:0 5px 18px rgba(15,23,42,0.08),0 0 0 1px rgba(15,23,42,0.08);` +
        `font-size:12px;font-weight:750;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;` +
        `color:#334155;white-space:nowrap;line-height:1.2;letter-spacing:0">` +
        `<span style="width:9px;height:9px;border-radius:50%;background:${esc(c.iconFill)};flex-shrink:0"></span>` +
        `${esc(text)}` +
        `<span style="font-size:12px;font-weight:600;color:#94a3b8;margin-left:2px">${c.count}</span>` +
        `</div>`
    );
    rendered += 1;
  }
}

function getClusterCentroidScreenPosition(
  cluster: ClusterRecord,
  graph: any,
  positions: ArrayLike<number> | null
): [number, number] | null {
  if (!positions || cluster.nodeIndices.length === 0) {
    return null;
  }

  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (const nodeIndex of cluster.nodeIndices) {
    const offset = nodeIndex * 2;
    if (offset + 1 >= positions.length) {
      continue;
    }
    const x = positions[offset];
    const y = positions[offset + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    sumX += x;
    sumY += y;
    count += 1;
  }
  if (count === 0) {
    return null;
  }

  try {
    return graph.spaceToScreenPosition([sumX / count, sumY / count]);
  } catch {
    return null;
  }
}

function renderFocusedEdgeLabels(
  out: string[],
  edges: FocusedEdgeRecord[],
  engine: CosmosEngine,
  graph: any,
  positions: ArrayLike<number> | null,
  isVisible: (pos: [number, number]) => boolean,
  occupied: LabelRect[]
): void {
  if (!positions || edges.length === 0) {
    return;
  }

  const nodeIdToIndex = engine.getNodeIdToIndex();
  const maxLabels = Math.min(edges.length, 6);

  for (let i = 0; i < maxLabels; i += 1) {
    const edge = edges[i];
    const sourceIndex = nodeIdToIndex.get(edge.sourceId);
    const targetIndex = nodeIdToIndex.get(edge.targetId);
    if (sourceIndex === undefined || targetIndex === undefined) {
      continue;
    }
    if (sourceIndex * 2 + 1 >= positions.length || targetIndex * 2 + 1 >= positions.length) {
      continue;
    }

    let source: [number, number];
    let target: [number, number];
    try {
      source = graph.spaceToScreenPosition([positions[sourceIndex * 2], positions[sourceIndex * 2 + 1]]);
      target = graph.spaceToScreenPosition([positions[targetIndex * 2], positions[targetIndex * 2 + 1]]);
    } catch {
      continue;
    }

    const mid: [number, number] = [
      source[0] + (target[0] - source[0]) * 0.55,
      source[1] + (target[1] - source[1]) * 0.55,
    ];
    if (!isVisible(mid)) {
      continue;
    }

    const rawText = `${trunc(edge.sourceTitle, 14)} -> ${trunc(edge.targetTitle, 14)}`;
    const labelWidth = Math.min(360, 72 + rawText.length * 7 + trunc(edge.label, 16).length * 7);
    const labelHeight = 36;
    if (
      !reserveRect(occupied, {
        x: mid[0] - labelWidth / 2,
        y: mid[1] - labelHeight / 2,
        width: labelWidth,
        height: labelHeight,
      })
    ) {
      continue;
    }

    const angle = (Math.atan2(target[1] - source[1], target[0] - source[0]) * 180) / Math.PI;
    const text = `${esc(trunc(edge.sourceTitle, 14))} &#8594; ${esc(trunc(edge.targetTitle, 14))}`;
    const label = edge.label ? `<span style="color:#64748b;margin-left:6px">${esc(trunc(edge.label, 16))}</span>` : '';

    out.push(
      `<div style="position:absolute;left:${mid[0]}px;top:${mid[1]}px;transform:translate(-50%,-50%);` +
        `display:flex;align-items:center;gap:8px;padding:6px 9px;border-radius:8px;` +
        `background:rgba(255,255,255,0.97);border:1px solid rgba(79,70,229,0.22);` +
        `box-shadow:0 10px 28px rgba(15,23,42,0.12),0 0 0 5px rgba(79,70,229,0.06);` +
        `font-size:11px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;` +
        `color:#1e293b;white-space:nowrap;line-height:1;pointer-events:none">` +
        `<span style="width:20px;height:20px;border-radius:999px;background:#4f46e5;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">` +
        `<span style="display:block;width:0;height:0;border-top:4px solid transparent;border-bottom:4px solid transparent;border-left:7px solid #fff;transform:rotate(${angle}deg);margin-left:1px"></span>` +
        `</span>` +
        `<span>${text}${label}</span>` +
        `</div>`
    );
  }
}

function renderNodeLabels(
  out: string[],
  nodes: NodeRecord[],
  project: (index: number) => [number, number] | null,
  isVisible: (pos: [number, number]) => boolean,
  hover: HoverState,
  limit: number,
  occupied: LabelRect[],
  forceVisible = false
): void {
  const hasFocus = !!((hover.hoveredNodeId || hover.lockedNodeId) && hover.hoverProgress > 0);
  const focusId = hover.lockedNodeId || hover.hoveredNodeId;
  let count = 0;

  for (const n of nodes) {
    if (count >= limit) {
      break;
    }
    const pos = project(n.index);
    if (!pos || !isVisible(pos)) {
      continue;
    }

    let opacity = 0.9;
    if (hasFocus) {
      if (n.id === focusId) {
        opacity = 1;
      } else if (hover.hoveredNeighborIds?.has(n.id)) {
        opacity = 0.92;
      } else {
        opacity = 0.2;
      }
    }
    opacity *= n.opacity ?? 1;

    const text = trunc(n.title, 20);
    const labelWidth = Math.min(150, 20 + text.length * 6.5);
    const labelHeight = 18;
    const y = pos[1] + Math.max(9, (n.screenSize || 12) / 2 + 6);
    if (
      !reserveRect(occupied, { x: pos[0] - labelWidth / 2, y, width: labelWidth, height: labelHeight }) &&
      !forceVisible
    ) {
      continue;
    }

    out.push(
      `<div style="position:absolute;left:${pos[0]}px;top:${y}px;transform:translate(-50%,0);` +
        `font-size:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;` +
        `font-weight:650;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;` +
        `max-width:150px;text-align:center;opacity:${opacity};transition:opacity 180ms ease;` +
        `text-shadow:0 0 3px rgba(250,250,250,0.95),0 0 8px rgba(250,250,250,0.8);` +
        `line-height:1.3;pointer-events:none">${esc(text)}</div>`
    );
    count++;
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function trunc(s: string, max: number): string {
  if (!s) {
    return '';
  }
  if (s.length <= max) {
    return s;
  }
  return s.slice(0, max - 3) + '...';
}
