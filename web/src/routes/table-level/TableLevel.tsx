import * as Redux from 'redux'
import { ActionBar } from './ActionBar'
import { Box } from '@mui/system'
import { DEFAULT_MAX_SCALE, Graph, ZoomPanControls } from '../../../libs/graph'
import { Drawer } from '@mui/material'
import { HEADER_HEIGHT, theme } from '../../helpers/theme'
import { IState } from '../../store/reducers'
import { JobOrDataset, LineageDataset } from '../../types/lineage'
import { LineageGraph } from '../../types/api'
import { TableLevelNodeData, tableLevelNodeRenderer } from './nodes'
import { ZoomControls } from '../column-level/ZoomControls'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { createElkNodes } from './layout'
import { fetchLineage } from '../../store/actionCreators'
import { useCallbackRef } from '../../helpers/hooks'
import { useParams, useSearchParams } from 'react-router-dom'
import ParentSize from '@visx/responsive/lib/components/ParentSize'
import React, { useEffect, useRef, useState, useMemo } from 'react'
import TableLevelDrawer from './TableLevelDrawer'
import { getConfig } from '../../store/requests/config'

interface StateProps {
  lineage: LineageGraph
}

interface DispatchProps {
  fetchLineage: typeof fetchLineage
}

type ColumnLevelProps = StateProps & DispatchProps

const zoomInFactor = 1.5
const zoomOutFactor = 1 / zoomInFactor

const ColumnLevel: React.FC<ColumnLevelProps> = ({
  fetchLineage: fetchLineage,
  lineage: lineage,
}: ColumnLevelProps) => {
  const { nodeType, namespace, name } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const [depth, setDepth] = useState(Number(searchParams.get('depth')) || 2)

  const [isCompact, setIsCompact] = useState(searchParams.get('isCompact') === 'true')
  const [isFull, setIsFull] = useState(searchParams.get('isFull') === 'true')
  const [showJobHierarchy, setShowJobHierarchy] = useState(false)
  const [jobHierarchyFeatureEnabled, setJobHierarchyFeatureEnabled] = useState(false)
  
  // Tag filtering state
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagSearchTerm, setTagSearchTerm] = useState('')

  const graphControls = useRef<ZoomPanControls>()

  const collapsedNodes = searchParams.get('collapsedNodes')

  // Fetch configuration on component mount
  useEffect(() => {
    getConfig().then(config => {
      setJobHierarchyFeatureEnabled(config.jobHierarchyEnabled)
      
      // Set default showJobHierarchy based on config and URL params
      const urlParamValue = searchParams.get('showJobHierarchy')
      if (urlParamValue !== null) {
        // If explicitly set in URL, use that value
        setShowJobHierarchy(urlParamValue === 'true')
      } else if (config.jobHierarchyEnabled) {
        // If feature is enabled but no URL param, default to true and update URL
        setShowJobHierarchy(true)
        searchParams.set('showJobHierarchy', 'true')
        setSearchParams(searchParams)
      } else {
        // Feature disabled, keep false
        setShowJobHierarchy(false)
      }
    }).catch(error => {
      console.warn('Failed to fetch config, job hierarchy will be disabled:', error)
      setJobHierarchyFeatureEnabled(false)
      setShowJobHierarchy(false)
    })
  }, [])

  useEffect(() => {
    if (name && namespace && nodeType) {
      fetchLineage(nodeType as JobOrDataset, namespace, name, depth)
    }
  }, [name, namespace, depth])

  if (!lineage) {
    return <div />
  }

  const handleScaleZoom = (inOrOut: 'in' | 'out') => {
    graphControls.current?.scaleZoom(inOrOut === 'in' ? zoomInFactor : zoomOutFactor)
  }

  const handleResetZoom = () => {
    graphControls.current?.fitContent()
  }

  const handleCenterOnNode = () => {
    graphControls.current?.centerOnPositionedNode(
      `${nodeType}:${namespace}:${name}`,
      DEFAULT_MAX_SCALE
    )
  }

  const setGraphControls = useCallbackRef((zoomControls) => {
    graphControls.current = zoomControls
  })

  // Helper function to extract tags from a dataset
  const extractDatasetTags = useMemo(() => {
    return (dataset: LineageDataset): string[] => {
      const tagSet = new Set<string>()
      
      // Extract traditional tags
      if (dataset.tags && Array.isArray(dataset.tags)) {
        dataset.tags.forEach(tag => {
          if (typeof tag === 'string') {
            tagSet.add(tag)
          } else if (tag && typeof tag === 'object' && 'key' in tag && typeof tag.key === 'string') {
            tagSet.add(tag.key)
          }
        })
      }
      
      // Extract facet tags
      if (dataset.facets && typeof dataset.facets === 'object') {
        const facets = dataset.facets as any
        
        // Check for tags facet
        if (facets.tags && Array.isArray(facets.tags)) {
          facets.tags.forEach((tag: any) => {
            if (typeof tag === 'string') {
              tagSet.add(tag)
            } else if (tag && typeof tag === 'object' && tag.key && typeof tag.key === 'string') {
              tagSet.add(tag.key)
            }
          })
        }
        
        // Check for nested facet structures
        Object.values(facets).forEach((facet: any) => {
          if (facet && typeof facet === 'object' && facet.tags && Array.isArray(facet.tags)) {
            facet.tags.forEach((tag: any) => {
              if (typeof tag === 'string') {
                tagSet.add(tag)
              } else if (tag && typeof tag === 'object' && tag.key && typeof tag.key === 'string') {
                tagSet.add(tag.key)
              }
            })
          }
        })
      }
      
      return Array.from(tagSet)
    }
  }, [])

  // Filter lineage based on selected tags
  const filteredLineage = useMemo(() => {
    if (!lineage || selectedTags.length === 0) {
      return lineage
    }

    const filteredGraph = lineage.graph.filter(node => {
      if (node.type === 'DATASET') {
        const dataset = node.data as LineageDataset
        const datasetTags = extractDatasetTags(dataset)
        
        // Check if dataset has all selected tags (AND operation)
        return selectedTags.every(selectedTag => 
          datasetTags.some(datasetTag => 
            datasetTag.toLowerCase().includes(selectedTag.toLowerCase())
          )
        )
      }
      // For now, always include jobs - could extend filtering to jobs later
      return true
    })

    return {
      ...lineage,
      graph: filteredGraph
    }
  }, [lineage, selectedTags, extractDatasetTags])

  const { nodes, edges } = createElkNodes(
    filteredLineage,
    `${nodeType}:${namespace}:${name}`,
    isCompact,
    isFull,
    collapsedNodes,
    jobHierarchyFeatureEnabled && showJobHierarchy
  )

  useEffect(() => {
    setTimeout(() => {
      graphControls.current?.fitContent()
    }, 300)
  }, [nodes.length, isCompact])

  return (
    <>
      <ActionBar
        nodeType={nodeType?.toUpperCase() as JobOrDataset}
        fetchLineage={fetchLineage}
        depth={depth}
        setDepth={setDepth}
        isCompact={isCompact}
        setIsCompact={setIsCompact}
        isFull={isFull}
        setIsFull={setIsFull}
        showJobHierarchy={jobHierarchyFeatureEnabled ? showJobHierarchy : undefined}
        setShowJobHierarchy={jobHierarchyFeatureEnabled ? setShowJobHierarchy : undefined}
        lineage={lineage}
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
        tagSearchTerm={tagSearchTerm}
        onTagSearchChange={setTagSearchTerm}
      />
      <Box height={`calc(100vh - ${HEADER_HEIGHT}px - ${HEADER_HEIGHT}px - 1px)`}>
        <Drawer
          anchor={'right'}
          open={!!searchParams.get('tableLevelNode')}
          onClose={() => setSearchParams({})}
          PaperProps={{
            sx: {
              backgroundColor: theme.palette.background.default,
              backgroundImage: 'none',
              mt: `${HEADER_HEIGHT}px`,
              height: `calc(100vh - ${HEADER_HEIGHT}px)`,
            },
          }}
        >
          <Box>
            <TableLevelDrawer />
          </Box>
        </Drawer>
        <ZoomControls
          handleCenterOnNode={handleCenterOnNode}
          handleScaleZoom={handleScaleZoom}
          handleResetZoom={handleResetZoom}
        />
        <ParentSize>
          {(parent) => (
            <Graph<JobOrDataset, TableLevelNodeData>
              id='column-level-graph'
              backgroundColor={theme.palette.background.default}
              height={parent.height}
              width={parent.width}
              nodes={nodes}
              edges={edges}
              direction='right'
              nodeRenderers={tableLevelNodeRenderer}
              setZoomPanControls={setGraphControls}
            />
          )}
        </ParentSize>
      </Box>
    </>
  )
}

const mapStateToProps = (state: IState) => ({
  lineage: state.lineage.lineage,
})

const mapDispatchToProps = (dispatch: Redux.Dispatch) =>
  bindActionCreators(
    {
      fetchLineage: fetchLineage,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(ColumnLevel)
