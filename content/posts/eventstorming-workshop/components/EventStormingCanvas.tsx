'use client'

import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  MarkerType,
  addEdge,
  useNodesState,
  useEdgesState,
  type OnConnect,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { DomainEventNode } from './nodes/DomainEventNode'
import { CommandNode } from './nodes/CommandNode'
import { ActorNode } from './nodes/ActorNode'
import { PolicyNode } from './nodes/PolicyNode'
import { AggregateNode } from './nodes/AggregateNode'
import { RuleNode } from './nodes/RuleNode'
import { ContextDividerNode } from './nodes/ContextDividerNode'
import { ContextLabelNode } from './nodes/ContextLabelNode'
import { SagaRibbonNode } from './nodes/SagaRibbonNode'
import { BackboneSpineNode } from './nodes/BackboneSpineNode'
import {
  layoutNodes,
  buildContextDividers,
  buildBackboneSpine,
  buildSagaRibbons,
} from './layout'
import type { StickyNode, StickyEdge, InitialModel } from './types'

type Props = {
  initial: InitialModel
  presetLabel?: string
  height?: number
}

function styleEdge(sourceId: string, e: StickyEdge): StickyEdge {
  if (sourceId.startsWith('rule-')) {
    return {
      ...e,
      style: { stroke: 'rgb(168, 162, 158)', strokeDasharray: '3 4', strokeWidth: 1 },
      animated: false,
    }
  }
  if (sourceId.startsWith('pol-')) {
    return {
      ...e,
      style: { stroke: 'rgb(168, 85, 247)', strokeWidth: 1.5 },
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: 'rgb(168, 85, 247)' },
    }
  }
  if (sourceId.startsWith('cmd-')) {
    return {
      ...e,
      style: { stroke: 'rgb(14, 165, 233)', strokeWidth: 1.5 },
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: 'rgb(14, 165, 233)' },
    }
  }
  if (sourceId.startsWith('agg-')) {
    return {
      ...e,
      style: { stroke: 'rgb(251, 146, 60)', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'rgb(251, 146, 60)' },
    }
  }
  if (sourceId.startsWith('evt-')) {
    return {
      ...e,
      style: { stroke: 'rgb(251, 146, 60)', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'rgb(251, 146, 60)' },
    }
  }
  if (sourceId.startsWith('act-')) {
    return {
      ...e,
      style: { stroke: 'rgb(168, 162, 158)', strokeWidth: 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'rgb(168, 162, 158)' },
    }
  }
  return e
}

export function EventStormingCanvas({ initial, presetLabel, height = 720 }: Props) {
  const initialNodes = useMemo<StickyNode[]>(() => {
    // Kolejność = z-order (najpierw renderowane = na spodzie).
    // background: spine → ribbons → dividers → labels → sticky cards on top.
    const spine = buildBackboneSpine(initial.contexts)
    const ribbons = buildSagaRibbons(initial.sagas)
    const dividers = buildContextDividers(initial.contexts)
    const sticky = layoutNodes(initial.nodes)
    return [...spine, ...ribbons, ...dividers, ...sticky]
  }, [initial.contexts, initial.sagas, initial.nodes])

  const initialEdges = useMemo<StickyEdge[]>(
    () =>
      initial.edges.map(e => {
        const base: StickyEdge = {
          id: `${e.source}->${e.target}`,
          source: e.source,
          target: e.target,
          label: e.label,
        }
        return styleEdge(e.source, base)
      }),
    [initial.edges]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<StickyNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<StickyEdge>(initialEdges)

  const nodeTypes = useMemo(
    () => ({
      event: DomainEventNode,
      command: CommandNode,
      actor: ActorNode,
      policy: PolicyNode,
      aggregate: AggregateNode,
      rule: RuleNode,
      'context-divider': ContextDividerNode,
      'context-label': ContextLabelNode,
      'saga-ribbon': SagaRibbonNode,
      'backbone-spine': BackboneSpineNode,
    }),
    []
  )

  const onConnect: OnConnect = useCallback(
    connection => setEdges(prev => addEdge({ ...connection, animated: true }, prev)),
    [setEdges]
  )

  const onReset = useCallback(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const onExport = useCallback(() => {
    const payload = JSON.stringify({ nodes, edges }, null, 2)
    void navigator.clipboard.writeText(payload)
  }, [nodes, edges])

  return (
    // Breakout poza prose width — mirror pattern z `<EventStorming>` v6-03.
    <div className="my-8 not-prose -mx-4 sm:mx-0 md:relative md:left-1/2 md:-translate-x-1/2 md:w-[min(80rem,calc(100vw-2rem))]">
      <div className="mb-2 flex flex-wrap items-center gap-2 px-4 sm:px-0">
        {presetLabel && (
          <span className="text-xs uppercase tracking-wide text-stone-500">
            Preset: {presetLabel}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded border border-stone-400 px-3 py-1 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onExport}
            className="rounded border border-stone-400 px-3 py-1 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Copy JSON
          </button>
        </div>
      </div>
      <div
        className="rounded-lg border border-stone-300 dark:border-stone-700"
        style={{ height: `${height}px` }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          defaultViewport={{ x: 0, y: 60, zoom: 0.85 }}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} />
          <Controls />
          <MiniMap pannable zoomable position="bottom-right" />
        </ReactFlow>
      </div>
    </div>
  )
}
