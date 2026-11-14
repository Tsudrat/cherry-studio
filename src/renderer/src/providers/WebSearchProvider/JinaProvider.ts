import { loggerService } from '@logger'
import type { WebSearchState } from '@renderer/store/websearch'
import type { WebSearchProvider, WebSearchProviderResponse } from '@renderer/types'

import BaseWebSearchProvider from './BaseWebSearchProvider'

const logger = loggerService.withContext('JinaProvider')

const JINA_MAX_COUNT = 20

interface JinaSearchResult {
  title: string
  url: string
  description?: string
  content?: string
}

interface JinaSearchResponse {
  code: number
  status: number
  data: JinaSearchResult[]
}

export default class JinaProvider extends BaseWebSearchProvider {
  constructor(provider: WebSearchProvider) {
    super(provider)
    if (!this.apiKey) {
      throw new Error('API key is required for Jina provider')
    }
    if (!this.apiHost) {
      throw new Error('API host is required for Jina provider')
    }
  }

  public async search(query: string, websearch: WebSearchState): Promise<WebSearchProviderResponse> {
    try {
      if (!query.trim()) {
        throw new Error('Search query cannot be empty')
      }

      // Jina forwards query operators to its SERP backend; -site: is the
      // closest mapping for excluded domains.
      let formattedQuery = query
      for (const domain of websearch.excludeDomains) {
        formattedQuery += ` -site:${domain}`
      }

      const response = await fetch(`${this.apiHost}/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this.defaultHeaders()
        },
        body: JSON.stringify({
          q: formattedQuery,
          // Full page content is fetched server-side by default, so results
          // don't need a second crawl step downstream.
          num: Math.min(Math.max(1, websearch.maxResults), JINA_MAX_COUNT)
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('Jina search failed:', { status: response.status, error: errorText })
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data: JinaSearchResponse = await response.json()

      return {
        query: query,
        results: (data.data ?? []).slice(0, websearch.maxResults).map((result) => {
          return {
            title: result.title || 'No title',
            content: result.content || result.description || '',
            url: result.url || ''
          }
        })
      }
    } catch (error) {
      logger.error('Jina search failed:', error as Error)
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
