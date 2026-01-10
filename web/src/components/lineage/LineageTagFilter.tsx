import React, { useMemo } from 'react'
import {
  Autocomplete,
  Box,
  Chip,
  TextField,
  Typography,
} from '@mui/material'
import { LineageGraph } from '../../types/api'
import { LineageDataset, LineageJob } from '../../types/lineage'

interface LineageTagFilterProps {
  lineage: LineageGraph
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  tagSearchTerm: string
  onTagSearchChange: (term: string) => void
}

const LineageTagFilter: React.FC<LineageTagFilterProps> = ({
  lineage,
  selectedTags,
  onTagsChange,
  tagSearchTerm,
  onTagSearchChange,
}) => {
  // Extract all unique tags from lineage datasets and jobs
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    
    if (!lineage?.graph) return []
    
    console.log('=== LINEAGE TAG EXTRACTION DEBUG ===')
    console.log('Lineage graph has', lineage.graph.length, 'nodes')
    
    lineage.graph.forEach((node, index) => {
      console.log(`\n--- Node ${index + 1} ---`)
      console.log('Node type:', node.type)
      
      if (node.type === 'DATASET') {
        const dataset = node.data as LineageDataset
        console.log('Dataset name:', dataset.name)
        console.log('Dataset namespace:', dataset.namespace)
        console.log('Full dataset object:', dataset)
        console.log('Dataset.tags:', dataset.tags)
        console.log('Dataset.facets:', dataset.facets)
        
        // Extract traditional tags
        if (dataset.tags && Array.isArray(dataset.tags)) {
          console.log('✓ Found traditional tags array:', dataset.tags)
          dataset.tags.forEach(tag => {
            console.log('Processing tag:', tag, 'Type:', typeof tag)
            if (typeof tag === 'string') {
              tagSet.add(tag)
              console.log('✓ Added string tag:', tag)
            } else if (tag && typeof tag === 'object' && 'key' in tag && typeof tag.key === 'string') {
              tagSet.add(tag.key)
              console.log('✓ Added object tag key:', tag.key)
            } else {
              console.log('⚠️ Unhandled tag format:', tag)
            }
          })
        } else {
          console.log('✗ No traditional tags found or not an array')
        }
        
        // Extract facet tags
        if (dataset.facets && typeof dataset.facets === 'object') {
          const facets = dataset.facets as any
          console.log('✓ Found facets object with keys:', Object.keys(facets))
          
          // Check for tags facet
          if (facets.tags && Array.isArray(facets.tags)) {
            console.log('✓ Found facets.tags array:', facets.tags)
            facets.tags.forEach((tag: any) => {
              console.log('Processing facet tag:', tag, 'Type:', typeof tag)
              if (typeof tag === 'string') {
                tagSet.add(tag)
                console.log('✓ Added facet string tag:', tag)
              } else if (tag && typeof tag === 'object' && tag.key && typeof tag.key === 'string') {
                tagSet.add(tag.key)
                console.log('✓ Added facet object tag key:', tag.key)
              } else {
                console.log('⚠️ Unhandled facet tag format:', tag)
              }
            })
          } else {
            console.log('✗ No facets.tags found or not an array')
          }
          
          // Check for nested facet structures
          Object.entries(facets).forEach(([facetKey, facet]) => {
            console.log(`Checking facet "${facetKey}":`, facet)
            if (facet && typeof facet === 'object' && (facet as any).tags && Array.isArray((facet as any).tags)) {
              console.log(`✓ Found nested tags in facet "${facetKey}":`, (facet as any).tags)
              ;(facet as any).tags.forEach((tag: any) => {
                console.log('Processing nested tag:', tag, 'Type:', typeof tag)
                if (typeof tag === 'string') {
                  tagSet.add(tag)
                  console.log('✓ Added nested string tag:', tag)
                } else if (tag && typeof tag === 'object' && tag.key && typeof tag.key === 'string') {
                  tagSet.add(tag.key)
                  console.log('✓ Added nested object tag key:', tag.key)
                } else {
                  console.log('⚠️ Unhandled nested tag format:', tag)
                }
              })
            }
          })
        } else {
          console.log('✗ No facets found or not an object')
        }
      } else {
        console.log('Skipping non-dataset node:', node.type)
      }
    })
    
    const finalTags = Array.from(tagSet).sort()
    console.log('\n=== FINAL RESULTS ===')
    console.log('Total unique tags found:', finalTags.length)
    console.log('Tags:', finalTags)
    console.log('=== END DEBUG ===\n')
    
    return finalTags
  }, [lineage])

  // Filter tags based on search term
  const filteredTags = useMemo(() => {
    if (!tagSearchTerm) return allTags
    return allTags.filter(tag => 
      tag.toLowerCase().includes(tagSearchTerm.toLowerCase())
    )
  }, [allTags, tagSearchTerm])

  return (
    <Box sx={{ minWidth: 300, maxWidth: 400 }}>
      <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
        Filter by Tags
      </Typography>
      
      <Autocomplete
        multiple
        options={filteredTags}
        value={selectedTags}
        onChange={(_, newValue) => onTagsChange(newValue)}
        onInputChange={(_, newInputValue) => onTagSearchChange(newInputValue)}
        inputValue={tagSearchTerm}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              variant="outlined"
              label={option}
              size="small"
              {...getTagProps({ index })}
              key={option}
            />
          ))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            variant="outlined"
            size="small"
            placeholder={selectedTags.length === 0 ? "Search and select tags..." : "Add more tags..."}
            sx={{
              '& .MuiOutlinedInput-root': {
                minHeight: '40px',
              },
            }}
          />
        )}
        renderOption={(props, option) => (
          <li {...props} key={option}>
            <Typography variant="body2">{option}</Typography>
          </li>
        )}
        noOptionsText={
          tagSearchTerm ? `No tags found matching "${tagSearchTerm}"` : "No tags available"
        }
        size="small"
        sx={{
          '& .MuiAutocomplete-tag': {
            margin: '2px',
          },
        }}
      />
      
      {selectedTags.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
        </Typography>
      )}
    </Box>
  )
}

export default LineageTagFilter 