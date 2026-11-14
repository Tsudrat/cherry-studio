import { loggerService } from '@logger'
import type { WebSearchState } from '@renderer/store/websearch'
import type { WebSearchProvider, WebSearchProviderResponse } from '@renderer/types'

import BaseWebSearchProvider from './BaseWebSearchProvider'

const logger = loggerService.withContext('DeepSeekProvider')

const DEEPSEEK_MAX_QUERY_LENGTH = 128
const DEEPSEEK_MAX_COUNT = 50

interface DeepSeekSearchResult {
  title: string
  url: string
  snippet: string
  summary: string
  content: string
}

interface DeepSeekSearchResponse {
  results: DeepSeekSearchResult[]
}

export default class DeepSeekProvider extends BaseWebSearchProvider {
  constructor(provider: WebSearchProvider) {
    super(provider)
    if (!this.apiKey) {
      throw new Error('API key is required for DeepSeek provider')
    }
    if (!this.apiHost) {
      throw new Error('API host is required for DeepSeek provider')
    }
  }

  public async search(query: string, websearch: WebSearchState): Promise<WebSearchProviderResponse> {
    try {
      if (!query.trim()) {
        throw new Error('Search query cannot be empty')
      }

      // DeepSeek has no structured domain-exclusion field; map excluded
      // domains onto its -site: query operator.
      let formattedQuery = query
      for (const domain of websearch.excludeDomains) {
        formattedQuery += ` -site:${domain}`
      }
      formattedQuery = formattedQuery.slice(0, DEEPSEEK_MAX_QUERY_LENGTH)

      const response = await fetch(`${this.apiHost}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...this.defaultHeaders()
        },
        body: JSON.stringify({
          query: formattedQuery,
          count: Math.min(Math.max(1, websearch.maxResults), DEEPSEEK_MAX_COUNT),
          // Server-side page extraction: content carries the fetched page
          // text, so results don't need a second crawl step downstream.
          need_content: true
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('DeepSeek search failed:', { status: response.status, error: errorText })
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data: DeepSeekSearchResponse = await response.json()

      return {
        query: query,
        results: (data.results ?? []).slice(0, websearch.maxResults).map((result) => {
          return {
            title: result.title || 'No title',
            content: result.content || result.summary || result.snippet || '',
            url: result.url || ''
          }
        })
      }
    } catch (error) {
      logger.error('DeepSeek search failed:', error as Error)
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
