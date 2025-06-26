import { Edge, Node as ElkNode } from '../../../libs/graph'
import { LineageGraph } from '../../types/api'

import { JobOrDataset, LineageDataset, LineageJob, LineageNode } from '../../types/lineage'
import { Nullable } from '../../types/util/Nullable'
import { TableLevelNodeData } from './nodes'
import { theme } from '../../helpers/theme'

/**
 * Recursively trace the `inEdges` and `outEdges` of the current node to find all connected downstream column nodes
 * @param lineageGraph
 * @param currentGraphNode
 */
export const findDownstreamNodes = (
  lineageGraph: LineageGraph,
  currentGraphNode: Nullable<string>
): LineageNode[] => {
  if (!currentGraphNode) return []
  const currentNode = lineageGraph.graph.find((node) => node.id === currentGraphNode)
  if (!currentNode) return []
  const connectedNodes: LineageNode[] = []
  const visitedNodes: string[] = []
  const queue: LineageNode[] = [currentNode]

  while (queue.length) {
    const currentNode = queue.shift()
    if (!currentNode) continue
    if (visitedNodes.includes(currentNode.id)) continue
    visitedNodes.push(currentNode.id)
    connectedNodes.push(currentNode)
    queue.push(
      ...currentNode.outEdges
        .map((edge) => lineageGraph.graph.find((n) => n.id === edge.destination))
        .filter((item): item is LineageNode => !!item)
    )
  }
  return connectedNodes
}
/**
 * Recursively trace the `inEdges` and `outEdges` of the current node to find all connected upstream column nodes
 * @param lineageGraph
 * @param currentGraphNode
 */
export const findUpstreamNodes = (
  lineageGraph: LineageGraph,
  currentGraphNode: Nullable<string>
): LineageNode[] => {
  if (!currentGraphNode) return []
  const currentNode = lineageGraph.graph.find((node) => node.id === currentGraphNode)
  if (!currentNode) return []
  const connectedNodes: LineageNode[] = []
  const visitedNodes: string[] = []
  const queue: LineageNode[] = [currentNode]

  while (queue.length) {
    const currentNode = queue.shift()
    if (!currentNode) continue
    if (visitedNodes.includes(currentNode.id)) continue
    visitedNodes.push(currentNode.id)
    connectedNodes.push(currentNode)
    queue.push(
      ...currentNode.inEdges
        .map((edge) => lineageGraph.graph.find((n) => n.id === edge.origin))
        .filter((item): item is LineageNode => !!item)
    )
  }
  return connectedNodes
}

export const createElkNodes = (
  lineageGraph: LineageGraph,
  currentGraphNode: Nullable<string>,
  isCompact: boolean,
  isFull: boolean,
  collapsedNodes: Nullable<string>,
  showJobHierarchy: boolean = true
) => {
  const downstreamNodes = findDownstreamNodes(lineageGraph, currentGraphNode)
  const upstreamNodes = findUpstreamNodes(lineageGraph, currentGraphNode)

  const nodes: ElkNode<JobOrDataset, TableLevelNodeData>[] = []
  const edges: Edge[] = []

  const collapsedNodesAsArray = collapsedNodes?.split(',')

  const filteredGraph = lineageGraph.graph.filter((node) => {
    if (isFull) return true
    return (
      downstreamNodes.includes(node) || upstreamNodes.includes(node) || node.id === currentGraphNode
    )
  })

  // Helper function to determine edge type
  const getEdgeType = (edge: { origin: string; destination: string }) => {
    const sourceNode = filteredGraph.find((n) => n.id === edge.origin)
    const targetNode = filteredGraph.find((n) => n.id === edge.destination)
    
    if (sourceNode?.type === 'JOB' && targetNode?.type === 'JOB') {
      return 'JOB_TO_JOB'
    } else if (sourceNode?.type === 'JOB' && targetNode?.type === 'DATASET') {
      return 'JOB_TO_DATASET'
    } else if (sourceNode?.type === 'DATASET' && targetNode?.type === 'JOB') {
      return 'DATASET_TO_JOB'
    }
    return 'DATASET_TO_JOB' // default
  }

  for (const node of filteredGraph) {
    edges.push(
      ...node.outEdges
        .filter((edge) => filteredGraph.find((n) => n.id === edge.destination))
        .filter((edge) => {
          const edgeType = getEdgeType(edge)
          const isJobToJobEdge = edgeType === 'JOB_TO_JOB'
          // Skip job-to-job edges if showJobHierarchy is false
          return !(isJobToJobEdge && !showJobHierarchy)
        })
        .map((edge) => {
          const edgeType = getEdgeType(edge)
          const isJobToJobEdge = edgeType === 'JOB_TO_JOB'
          const isConnectedNode = downstreamNodes.includes(node) || upstreamNodes.includes(node)
          
          return {
            id: `${edge.origin}:${edge.destination}`,
            sourceNodeId: edge.origin,
            targetNodeId: edge.destination,
            color: isJobToJobEdge
              ? theme.palette.secondary.main // Different color for job-to-job edges
              : isConnectedNode
              ? theme.palette.primary.main
              : theme.palette.grey[400],
            style: (isJobToJobEdge ? 'dashed' : 'solid') as 'solid' | 'dashed' | 'dotted', // Dashed line for job hierarchy
            strokeWidth: isJobToJobEdge ? 2 : 1,
          }
        })
    )

    if (node.type === 'JOB') {
      nodes.push({
        id: node.id,
        kind: node.type,
        width: 112,
        height: 24,
        data: {
          job: node.data as LineageJob,
        },
      })
    } else if (node.type === 'DATASET') {
      const data = node.data as LineageDataset
      nodes.push({
        id: node.id,
        kind: node.type,
        width: 112,
        height:
          isCompact || collapsedNodesAsArray?.includes(node.id) ? 24 : 34 + data.fields.length * 10,
        data: {
          dataset: data,
        },
      })
    }
  }
  return { nodes, edges }
}
