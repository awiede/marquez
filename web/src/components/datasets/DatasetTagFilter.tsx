// Copyright 2018-2024 contributors to the Marquez project
// SPDX-License-Identifier: Apache-2.0

import {
  Autocomplete,
  Checkbox,
  TextField,
  Typography,
} from '@mui/material'
import { Box, createTheme } from '@mui/material'
import { useTheme } from '@emotion/react'
import { useSelector } from 'react-redux'
import { IState } from '../../store/reducers'
import { Tag, Dataset } from '../../types/api'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import Chip from '@mui/material/Chip'
import MqText from '../core/text/MqText'
import React from 'react'

interface DatasetTagFilterProps {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  onTagSearch: (searchTerm: string) => void
  tagSearchTerm: string
}

const DatasetTagFilter: React.FC<DatasetTagFilterProps> = ({
  selectedTags,
  onTagsChange,
  onTagSearch,
  tagSearchTerm,
}) => {
  const theme = createTheme(useTheme())
  
  // Get all available tags from the store
  const storeTags = useSelector((state: IState) =>
    state.tags.tags.sort((a, b) => a.name.localeCompare(b.name))
  )

  // Get datasets to extract tags from facets
  const datasets = useSelector((state: IState) => state.datasets.result)

  // Extract all unique tags from both store and dataset facets (optimized)
  const allTags = React.useMemo(() => {
    const tagMap = new Map<string, Tag>()
    
    // Add tags from the store (these are already optimized)
    storeTags.forEach(tag => {
      tagMap.set(tag.name, tag)
    })
    
    // Add tags from dataset facets (only process if we have datasets and they have facets)
    if (datasets.length > 0) {
      for (const dataset of datasets) {
        // Early exit if no facets
        if (!dataset.facets || typeof dataset.facets !== 'object') continue
        
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
        
        if (!tagsArray || tagsArray.length === 0) continue
        
        for (const tagObj of tagsArray) {
          if (tagObj && typeof tagObj === 'object' && tagObj.key && !tagMap.has(tagObj.key)) {
            // Create a Tag object for facet tags
            tagMap.set(tagObj.key, {
              name: tagObj.key,
              description: tagObj.value || 'Tag from dataset facet'
            })
          }
        }
      }
    }
    
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [storeTags, datasets])

  const handleTagChange = (
    _event: React.SyntheticEvent,
    value: string[]
  ) => {
    onTagsChange(value)
  }

  const handleTagSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onTagSearch(event.target.value)
  }

  const formatSelectedTags = (tags: string[], tagData: Tag[]) => {
    return tags.map((tag, index) => {
      const tagDescription = tagData.find((tagItem) => tagItem.name === tag)
      const tooltipTitle = tagDescription?.description || 'No Tag Description'
      return (
        <Chip
          key={tag}
          color="primary"
          variant="outlined"
          label={tag}
          size="small"
          title={tooltipTitle}
          onDelete={() => {
            const newTags = tags.filter(t => t !== tag)
            onTagsChange(newTags)
          }}
          style={{
            marginLeft: index === 0 ? 0 : theme.spacing(0.5),
            marginBottom: theme.spacing(0.5),
          }}
        />
      )
    })
  }

  return (
    <Box display="flex" flexDirection="column" gap={1} minWidth={300}>
      {/* Tag Search Input */}
      <TextField
        size="small"
        placeholder="Search by tag name..."
        value={tagSearchTerm}
        onChange={handleTagSearchChange}
        InputProps={{
          startAdornment: <LocalOfferIcon sx={{ mr: 1, color: theme.palette.action.active }} />,
        }}
        sx={{ minWidth: 200 }}
      />

      {/* Tag Filter Selector */}
      <Autocomplete
        multiple
        disableCloseOnSelect
        size="small"
        options={allTags.map((tag) => tag.name)}
        value={selectedTags}
        onChange={handleTagChange}
        limitTags={3}
        renderTags={(value: string[]) => (
          <Box display="flex" flexWrap="wrap" gap={0.5}>
            {formatSelectedTags(value, allTags)}
          </Box>
        )}
        renderOption={(props, option, { selected }) => (
          <li {...props}>
            <Checkbox
              icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
              checkedIcon={<CheckBoxIcon fontSize="small" />}
              style={{ marginRight: 8 }}
              checked={selected}
            />
            <Box>
              <MqText bold>{option}</MqText>
              <MqText subdued overflowHidden>
                {allTags.find((tagItem) => tagItem.name === option)?.description || ''}
              </MqText>
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            placeholder={selectedTags.length > 0 ? '' : 'Filter by tags...'}
            InputLabelProps={{
              shrink: true,
            }}
          />
        )}
        sx={{ minWidth: 200 }}
      />

      {/* Filter Summary */}
      {(selectedTags.length > 0 || tagSearchTerm) && (
        <Box>
          <Typography variant="caption" color="textSecondary">
            {selectedTags.length > 0 && `Filtering by ${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}`}
            {selectedTags.length > 0 && tagSearchTerm && ' • '}
            {tagSearchTerm && `Searching for "${tagSearchTerm}"`}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default DatasetTagFilter 