// Copyright 2018-2023 contributors to the Marquez project
// SPDX-License-Identifier: Apache-2.0

import * as Redux from 'redux'
import {
  Button,
  Chip,
  Container,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  createTheme,
} from '@mui/material'
import { Dataset } from '../../types/api'
import { HEADER_HEIGHT } from '../../helpers/theme'
import { IState } from '../../store/reducers'
import { MqScreenLoad } from '../../components/core/screen-load/MqScreenLoad'
import { Nullable } from '../../types/util/Nullable'
import { Refresh } from '@mui/icons-material'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import {
  datasetFacetsQualityAssertions,
  datasetFacetsStatus,
  encodeNode,
} from '../../helpers/nodes'
import { fetchDatasets, resetDatasets } from '../../store/actionCreators'
import { formatUpdatedAt } from '../../helpers'
import { truncateText } from '../../helpers/text'
import { useTheme } from '@emotion/react'
import Assertions from '../../components/datasets/Assertions'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress/CircularProgress'
import DatasetTagFilter from '../../components/datasets/DatasetTagFilter'
import IconButton from '@mui/material/IconButton'
import MQTooltip from '../../components/core/tooltip/MQTooltip'
import MqEmpty from '../../components/core/empty/MqEmpty'
import MqPaging from '../../components/paging/MqPaging'
import MqStatus from '../../components/core/status/MqStatus'
import MqText from '../../components/core/text/MqText'
import NamespaceSelect from '../../components/namespace-select/NamespaceSelect'
import React from 'react'

interface StateProps {
  datasets: Dataset[]
  isDatasetsLoading: boolean
  isDatasetsInit: boolean
  selectedNamespace: Nullable<string>
  totalCount: number
}

interface DatasetsState {
  page: number
  selectedTags: string[]
  tagSearchTerm: string
}

interface DispatchProps {
  fetchDatasets: typeof fetchDatasets
  resetDatasets: typeof resetDatasets
}

type DatasetsProps = StateProps & DispatchProps

const PAGE_SIZE = 20
const DATASET_HEADER_HEIGHT = 64

const Datasets: React.FC<DatasetsProps> = ({
  datasets,
  totalCount,
  isDatasetsLoading,
  isDatasetsInit,
  selectedNamespace,
  fetchDatasets,
  resetDatasets,
}) => {
  const defaultState = {
    page: 0,
    selectedTags: [],
    tagSearchTerm: '',
  }
  const [state, setState] = React.useState<DatasetsState>(defaultState)

  const theme = createTheme(useTheme())

  React.useEffect(() => {
    if (selectedNamespace) {
      fetchDatasets(selectedNamespace, PAGE_SIZE, state.page * PAGE_SIZE)
    }
  }, [selectedNamespace, state.page])

  React.useEffect(() => {
    return () => {
      // on unmount
      resetDatasets()
    }
  }, [])

  const handleClickPage = (direction: 'prev' | 'next') => {
    const directionPage = direction === 'next' ? state.page + 1 : state.page - 1

    fetchDatasets(selectedNamespace || '', PAGE_SIZE, directionPage * PAGE_SIZE)
    // reset page scroll
    window.scrollTo(0, 0)
    setState({ ...state, page: directionPage })
  }

  const handleTagsChange = (tags: string[]) => {
    setState({ ...state, selectedTags: tags, page: 0 })
  }

  const handleTagSearch = (searchTerm: string) => {
    setState({ ...state, tagSearchTerm: searchTerm, page: 0 })
  }

  // Pre-compute tags for all datasets to avoid repeated computation
  const datasetTagsMap = React.useMemo(() => {
    const tagMap = new Map<string, string[]>()
    
    datasets.forEach((dataset) => {
      const tags = new Set<string>()
      
      // Add tags from the tags array
      if (dataset.tags) {
        dataset.tags.forEach(tag => tags.add(tag))
      }
      
      // Add tags from facets (TagsDatasetFacet)
      if (dataset.facets && typeof dataset.facets === 'object') {
        const facets = dataset.facets as any
        
        // Try different possible locations for tags
        let tagsArray = null
        
        // Check for direct tags property
        if (facets.tags && Array.isArray(facets.tags)) {
          tagsArray = facets.tags
        }
        // Check for nested tags facet structure
        else if (facets.tags && facets.tags.tags && Array.isArray(facets.tags.tags)) {
          tagsArray = facets.tags.tags
        }
        // Check for other possible tag locations
        else {
          Object.keys(facets).forEach(key => {
            const facetValue = facets[key]
            if (facetValue && typeof facetValue === 'object' && facetValue.tags && Array.isArray(facetValue.tags)) {
              tagsArray = facetValue.tags
            }
          })
        }
        
        if (tagsArray) {
          tagsArray.forEach((tagObj: any) => {
            if (tagObj && typeof tagObj === 'object' && tagObj.key) {
              // For tags with key-value structure: use key as tag name
              tags.add(tagObj.key)
            } else if (typeof tagObj === 'string') {
              // For simple string tags
              tags.add(tagObj)
            }
          })
        }
      }
      
      tagMap.set(`${dataset.namespace}:${dataset.name}`, Array.from(tags))
    })
    
    return tagMap
  }, [datasets])

  // Helper function to get tags for a dataset from the pre-computed map
  const getAllDatasetTags = React.useCallback((dataset: Dataset): string[] => {
    return datasetTagsMap.get(`${dataset.namespace}:${dataset.name}`) || []
  }, [datasetTagsMap])

  // Filter datasets based on selected tags and tag search term
  const filteredDatasets = React.useMemo(() => {
    let filtered = datasets.filter((dataset) => !dataset.deleted)

    // Filter by selected tags (dataset must have ALL selected tags)
    if (state.selectedTags.length > 0) {
      filtered = filtered.filter((dataset) => {
        const allTags = getAllDatasetTags(dataset)
        return state.selectedTags.every((tag) => allTags.includes(tag))
      })
    }

    // Filter by tag search term (dataset must have at least one tag containing the search term)
    if (state.tagSearchTerm.trim()) {
      const searchTerm = state.tagSearchTerm.toLowerCase().trim()
      filtered = filtered.filter((dataset) => {
        const allTags = getAllDatasetTags(dataset)
        return allTags.some((tag) => tag.toLowerCase().includes(searchTerm))
      })
    }

    return filtered
  }, [datasets, state.selectedTags, state.tagSearchTerm, getAllDatasetTags])

  const i18next = require('i18next')
  return (
    <Container maxWidth={'lg'} disableGutters>
      <Box p={2} display={'flex'} justifyContent={'space-between'} alignItems={'center'}>
        <Box display={'flex'}>
          <MqText heading>{i18next.t('datasets_route.heading')}</MqText>
          {!isDatasetsLoading && (
            <Chip
              size={'small'}
              variant={'outlined'}
              color={'primary'}
              sx={{ marginLeft: 1 }}
              label={
                state.selectedTags.length > 0 || state.tagSearchTerm
                  ? `${filteredDatasets.length} of ${totalCount} datasets`
                  : `${totalCount} total`
              }
            ></Chip>
          )}
        </Box>
        <Box display={'flex'} alignItems={'center'}>
          {isDatasetsLoading && <CircularProgress size={16} />}
          <NamespaceSelect />
          <MQTooltip title={'Refresh'}>
            <IconButton
              sx={{ ml: 2 }}
              color={'primary'}
              size={'small'}
              onClick={() => {
                if (selectedNamespace) {
                  fetchDatasets(selectedNamespace, PAGE_SIZE, state.page * PAGE_SIZE)
                }
              }}
            >
              <Refresh fontSize={'small'} />
            </IconButton>
          </MQTooltip>
        </Box>
      </Box>
      
      {/* Tag Filter Section */}
      {datasets.length > 0 && Array.from(datasetTagsMap.values()).some(tags => tags.length > 0) && (
        <Box px={2} pb={2}>
          <DatasetTagFilter
            selectedTags={state.selectedTags}
            onTagsChange={handleTagsChange}
            onTagSearch={handleTagSearch}
            tagSearchTerm={state.tagSearchTerm}
          />
        </Box>
      )}
      <MqScreenLoad
        loading={isDatasetsLoading && !isDatasetsInit}
        customHeight={`calc(100vh - ${HEADER_HEIGHT}px - ${DATASET_HEADER_HEIGHT}px)`}
      >
        <>
          {filteredDatasets.length === 0 && datasets.length > 0 ? (
            <Box p={2}>
              <MqEmpty title="No datasets match your filters">
                <>
                  <MqText subdued>
                    {(() => {
                      const parts = []
                      if (state.selectedTags.length > 0) {
                        parts.push(`No datasets found with the selected tags: ${state.selectedTags.join(', ')}`)
                      }
                      if (state.tagSearchTerm) {
                        if (parts.length > 0) {
                          parts.push(' and ')
                        }
                        parts.push(`containing "${state.tagSearchTerm}"`)
                      }
                      return parts.join('') || 'No datasets match your current filters.'
                    })()}
                  </MqText>
                  <Button
                    color={'primary'}
                    size={'small'}
                    onClick={() => setState({ ...state, selectedTags: [], tagSearchTerm: '' })}
                  >
                    Clear Filters
                  </Button>
                </>
              </MqEmpty>
            </Box>
          ) : datasets.length === 0 ? (
            <Box p={2}>
              <MqEmpty title={i18next.t('datasets_route.empty_title')}>
                <>
                  <MqText subdued>{i18next.t('datasets_route.empty_body')}</MqText>
                  <Button
                    color={'primary'}
                    size={'small'}
                    onClick={() => {
                      if (selectedNamespace) {
                        fetchDatasets(selectedNamespace, PAGE_SIZE, state.page * PAGE_SIZE)
                      }
                    }}
                  >
                    Refresh
                  </Button>
                </>
              </MqEmpty>
            </Box>
          ) : (
            <>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell key={i18next.t('datasets_route.name_col')} align='left'>
                      <MqText subheading>{i18next.t('datasets_route.name_col')}</MqText>
                    </TableCell>
                    <TableCell key={i18next.t('datasets_route.namespace_col')} align='left'>
                      <MqText subheading>{i18next.t('datasets_route.namespace_col')}</MqText>
                    </TableCell>
                    <TableCell key={i18next.t('datasets_route.source_col')} align='left'>
                      <MqText subheading>{i18next.t('datasets_route.source_col')}</MqText>
                    </TableCell>
                    <TableCell key={i18next.t('datasets_route.updated_col')} align='left'>
                      <MqText subheading>{i18next.t('datasets_route.updated_col')}</MqText>
                    </TableCell>
                    <TableCell key={i18next.t('datasets_route.quality')} align='left'>
                      <MqText subheading>{i18next.t('datasets_route.quality')}</MqText>
                    </TableCell>
                    <TableCell key={'tags'} align='left'>
                      <MqText inline subheading>
                        TAGS
                      </MqText>
                    </TableCell>
                    <TableCell key={i18next.t('datasets.column_lineage_tab')} align='left'>
                      <MqText inline subheading>
                        COLUMN LINEAGE
                      </MqText>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredDatasets.map((dataset) => {
                      const assertions = datasetFacetsQualityAssertions(dataset.facets)
                      const datasetTags = getAllDatasetTags(dataset) // Pre-compute tags for this dataset
                      return (
                        <TableRow key={dataset.name}>
                          <TableCell align='left'>
                            <MqText
                              link
                              linkTo={`/lineage/${encodeNode(
                                'DATASET',
                                dataset.namespace,
                                dataset.name
                              )}`}
                            >
                              {truncateText(dataset.name, 40)}
                            </MqText>
                          </TableCell>
                          <TableCell align='left'>
                            <MqText>{truncateText(dataset.namespace, 40)}</MqText>
                          </TableCell>
                          <TableCell align='left'>
                            <MqText>{dataset.sourceName}</MqText>
                          </TableCell>
                          <TableCell align='left'>
                            <MqText>{formatUpdatedAt(dataset.updatedAt)}</MqText>
                          </TableCell>
                          <TableCell align='left'>
                            {datasetFacetsStatus(dataset.facets) ? (
                              <>
                                <MQTooltip title={<Assertions assertions={assertions} />}>
                                  <Box>
                                    <MqStatus
                                      label={
                                        assertions.find((a) => !a.success) ? 'UNHEALTHY' : 'HEALTHY'
                                      }
                                      color={datasetFacetsStatus(dataset.facets)}
                                    />
                                  </Box>
                                </MQTooltip>
                              </>
                            ) : (
                              <MqStatus label={'N/A'} color={theme.palette.secondary.main} />
                            )}
                          </TableCell>
                          <TableCell align='left'>
                            <Box display="flex" flexWrap="wrap" gap={0.5}>
                              {datasetTags.slice(0, 3).map((tag) => (
                                <Chip
                                  key={tag}
                                  label={tag}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                              ))}
                              {datasetTags.length > 3 && (
                                <Chip
                                  label={`+${datasetTags.length - 3}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {dataset.columnLineage ? (
                              <MqText
                                link
                                linkTo={`column-level/${encodeURIComponent(
                                  encodeURIComponent(dataset.id.namespace)
                                )}/${encodeURIComponent(dataset.id.name)}`}
                              >
                                VIEW
                              </MqText>
                            ) : (
                              <MqText subdued>N/A</MqText>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
              <MqPaging
                pageSize={PAGE_SIZE}
                currentPage={state.page}
                totalCount={state.selectedTags.length > 0 || state.tagSearchTerm ? filteredDatasets.length : totalCount}
                incrementPage={() => handleClickPage('next')}
                decrementPage={() => handleClickPage('prev')}
              />
            </>
          )}
        </>
      </MqScreenLoad>
    </Container>
  )
}

const mapStateToProps = (state: IState) => ({
  datasets: state.datasets.result,
  totalCount: state.datasets.totalCount,
  isDatasetsLoading: state.datasets.isLoading,
  isDatasetsInit: state.datasets.init,
  selectedNamespace: state.namespaces.selectedNamespace,
})

const mapDispatchToProps = (dispatch: Redux.Dispatch) =>
  bindActionCreators(
    {
      fetchDatasets: fetchDatasets,
      resetDatasets: resetDatasets,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(Datasets)
