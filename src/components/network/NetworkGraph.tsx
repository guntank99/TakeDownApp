"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Search } from "lucide-react";

export interface GraphNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  type: "account" | "post" | "hashtag" | "topic";
  color: string;
  clusterColor: string;
  degree: number;
  degreeCentrality: number;
  betweenness: number;
  clusterName: string | null;
  role: string | null;
  platform?: string;
  x: number;
  y: number;
}
export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
}

const NODE_TYPES = ["account", "post", "hashtag", "topic"] as const;
const SHAPE: Record<GraphNodeData["type"], string> = {
  account: "rounded-full",
  post: "rounded-[3px]",
  hashtag: "rotate-45 rounded-[3px]",
  topic: "rounded-[30%]",
};

type FlowNodeData = { node: GraphNodeData; dim: boolean; selected: boolean; showLabel: boolean; colorBy: "type" | "cluster" };

function SentinelNode({ data }: NodeProps<Node<FlowNodeData>>) {
  const { node, dim, selected, showLabel, colorBy } = data;
  const size = 16 + Math.min(30, node.degree * 1.2);
  return (
    <div className={`relative ${dim ? "opacity-20" : ""}`} style={{ width: size, height: size }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, left: "50%", top: "50%" }} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, left: "50%", top: "50%" }} isConnectable={false} />
      <div
        className={`size-full border ${SHAPE[node.type]} ${selected ? "ring-2 ring-sky-300 ring-offset-2 ring-offset-slate-950" : ""}`}
        style={{ background: colorBy === "cluster" ? node.clusterColor : node.color, borderColor: "#0f172a" }}
      />
      {showLabel ? (
        <span className="pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950/80 px-1 text-[10px] text-slate-200">
          {node.label}
        </span>
      ) : null}
    </div>
  );
}
const nodeTypes = { sentinel: SentinelNode };

interface Props {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  clusters: { name: string; color: string; nodeCount: number }[];
}

function Inner({ nodes, edges, clusters }: Props) {
  const { fitView, setCenter } = useReactFlow();
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<Set<string>>(new Set(["account", "hashtag", "topic"]));
  const [edgeTypes, setEdgeTypes] = useState<Set<string>>(new Set(edges.map((e) => e.type)));
  const [minDegree, setMinDegree] = useState(0);
  const [colorBy, setColorBy] = useState<"type" | "cluster">("type");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allEdgeTypes = useMemo(() => [...new Set(edges.map((e) => e.type))].sort(), [edges]);
  const q = query.trim().toLowerCase();

  const visible = useMemo(() => nodes.filter((n) => types.has(n.type) && n.degree >= minDegree), [nodes, types, minDegree]);
  const visibleIds = useMemo(() => new Set(visible.map((n) => n.id)), [visible]);
  const visibleEdges = useMemo(
    () => edges.filter((e) => edgeTypes.has(e.type) && visibleIds.has(e.source) && visibleIds.has(e.target)),
    [edges, edgeTypes, visibleIds],
  );
  const matches = useMemo(() => (q ? visible.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id) : []), [visible, q]);
  const matchSet = useMemo(() => new Set(matches), [matches]);

  const flowNodes: Node<FlowNodeData>[] = useMemo(
    () =>
      visible.map((n) => ({
        id: n.id,
        type: "sentinel",
        position: { x: n.x, y: n.y },
        data: { node: n, dim: q ? !matchSet.has(n.id) : false, selected: n.id === selectedId, showLabel: n.id === selectedId || matchSet.has(n.id) || n.degree >= 12, colorBy },
        draggable: true,
      })),
    [visible, q, matchSet, selectedId, colorBy],
  );
  const flowEdges: Edge[] = useMemo(
    () =>
      visibleEdges.map((e) => {
        const touches = selectedId !== null && (e.source === selectedId || e.target === selectedId);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "straight",
          style: { stroke: touches ? "#7dd3fc" : "#475569", strokeWidth: touches ? 1.8 : 0.8, opacity: selectedId && !touches ? 0.15 : 0.55 },
        };
      }),
    [visibleEdges, selectedId],
  );

  useEffect(() => {
    if (matches.length > 0) fitView({ nodes: matches.map((id) => ({ id })), padding: 0.4, duration: 400, maxZoom: 1.5 });
  }, [matches, fitView]);

  const selected = selectedId ? nodes.find((n) => n.id === selectedId) : undefined;
  const neighbors = useMemo(() => {
    if (!selectedId) return [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const seen = new Map<string, { node: GraphNodeData; types: Set<string> }>();
    for (const e of edges) {
      const other = e.source === selectedId ? e.target : e.target === selectedId ? e.source : null;
      const n = other ? byId.get(other) : undefined;
      if (!other || !n) continue;
      const cur = seen.get(other) ?? { node: n, types: new Set<string>() };
      cur.types.add(e.type);
      seen.set(other, cur);
    }
    return [...seen.values()].sort((a, b) => b.node.degree - a.node.degree).slice(0, 12);
  }, [selectedId, nodes, edges]);

  const toggle = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const ctl = "rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <label htmlFor="graph-search" className="mb-1 block text-xs text-slate-400">Search node</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input id="graph-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="handle, #hashtag, topic…" className={`${ctl} pl-8`} />
          </div>
          <p className="mt-1 text-xs text-slate-500" aria-live="polite">{q ? `${matches.length} match(es)` : " "}</p>
        </div>
        <fieldset>
          <legend className="mb-1 text-xs text-slate-400">Node types</legend>
          <div className="flex gap-3 text-sm text-slate-300">
            {NODE_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-1.5">
                <input type="checkbox" className="accent-sky-500" checked={types.has(t)} onChange={() => toggle(types, t, setTypes)} />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-xs text-slate-400">Edge types</legend>
          <div className="flex flex-wrap gap-3 text-sm text-slate-300">
            {allEdgeTypes.map((t) => (
              <label key={t} className="flex items-center gap-1.5">
                <input type="checkbox" className="accent-sky-500" checked={edgeTypes.has(t)} onChange={() => toggle(edgeTypes, t, setEdgeTypes)} />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="graph-degree" className="mb-1 block text-xs text-slate-400">Min. connections: {minDegree}</label>
          <input id="graph-degree" type="range" min={0} max={20} value={minDegree} onChange={(e) => setMinDegree(Number(e.target.value))} className="accent-sky-500" />
        </div>
        <div>
          <label htmlFor="graph-color" className="mb-1 block text-xs text-slate-400">Colour by</label>
          <select id="graph-color" value={colorBy} onChange={(e) => setColorBy(e.target.value as "type" | "cluster")} className={ctl}>
            <option value="type">Platform / type</option>
            <option value="cluster">Cluster</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="h-[42rem] overflow-hidden rounded-xl border border-slate-800 bg-slate-950" aria-label="Network graph. Use the filters above or the side panel for a text view.">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            colorMode="dark"
            fitView
            fitViewOptions={{ padding: 0.04 }}
            minZoom={0.1}
            maxZoom={3}
            nodesConnectable={false}
            elementsSelectable
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            onlyRenderVisibleElements
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={28} color="#1e293b" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <aside className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm" aria-label="Selected node">
          {selected ? (
            <>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">{selected.type}</p>
                <p className="break-all text-base font-semibold text-slate-50">{selected.label}</p>
                {selected.type === "account" ? <a href={`/accounts/${selected.id}`} className="text-xs text-sky-400 hover:underline">Open account</a> : null}
                {selected.type === "post" ? <a href={`/posts/${selected.label}`} className="text-xs text-sky-400 hover:underline">Open post</a> : null}
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-slate-500">Connections</dt><dd className="text-slate-200">{selected.degree}</dd></div>
                <div><dt className="text-slate-500">Degree centrality</dt><dd className="text-slate-200">{selected.degreeCentrality.toFixed(3)}</dd></div>
                <div><dt className="text-slate-500">Betweenness</dt><dd className="text-slate-200">{selected.betweenness.toFixed(3)}</dd></div>
                <div><dt className="text-slate-500">Cluster</dt><dd className="text-slate-200">{selected.clusterName ?? "—"}</dd></div>
              </dl>
              {selected.role ? <p className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300">{selected.role}</p> : null}
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Strongest connections</p>
                <ul className="space-y-1">
                  {neighbors.map(({ node, types: t }) => (
                    <li key={node.id}>
                      <button type="button" className="w-full text-left text-slate-300 hover:text-sky-300" onClick={() => { setSelectedId(node.id); setCenter(node.x, node.y, { zoom: 1.2, duration: 400 }); }}>
                        {node.label} <span className="text-xs text-slate-500">{[...t].join(", ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-slate-400">Select a node to see its metrics and connections. Zoom with the wheel, pan by dragging.</p>
          )}
          <hr className="border-slate-800" />
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Legend</p>
            <p className="text-xs text-slate-400">Shape: ● account · ■ post · ◆ hashtag · ▢ topic. Size grows with connections. Account colour = platform.</p>
            {colorBy === "cluster" ? (
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {clusters.map((c) => (
                  <li key={c.name} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: c.color }} aria-hidden="true" />{c.name} · {c.nodeCount} nodes</li>
                ))}
              </ul>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function NetworkGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
