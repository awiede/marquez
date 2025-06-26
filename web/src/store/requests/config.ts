// Copyright 2018-2023 contributors to the Marquez project
// SPDX-License-Identifier: Apache-2.0

import { API_URL } from '../../globals'
import { genericFetchWrapper } from './index'

export interface MarquezConfig {
  jobHierarchyEnabled: boolean
}

export const getConfig = async (): Promise<MarquezConfig> => {
  const url = `${API_URL}/config`
  return genericFetchWrapper(url, { method: 'GET' }, 'fetchConfig')
} 