import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('keyv', {
  get: vi.fn(),
  set: vi.fn()
})

import DeepSeekProvider from '../DeepSeekProvider'

function createProvider(overrides = {}) {
  return new DeepSeekProvider({
    id: 'deepseek',
    name: 'DeepSeek',
    apiHost: 'https://api.deepseek.com/v1/tools/search',
    apiKey: 'test-key',
    ...overrides
  })
}

const defaultWebsearch = { maxResults: 5, excludeDomains: [] } as any

const SEARCH_RESPONSE = {
  results: [
    {
      title: 'First Result',
      url: 'https://example.com/first',
      snippet: 'A short snippet.',
      summary: 'A longer summary meant for model consumption.',
      content: 'Full page content fetched server-side.'
    },
    {
      title: 'Second Result',
      url: 'https://example.com/second',
      snippet: 'Snippet only.',
      summary: 'Summary for second result.',
      content: ''
    }
  ]
}

function mockSearchResponse(body: unknown = SEARCH_RESPONSE) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: true,
    json: async () => body
  } as Response)
}

describe('DeepSeekProvider', () => {
  let provider: DeepSeekProvider

  beforeEach(() => {
    provider = createProvider()
  })

  it('posts to the configured endpoint with bearer auth', async () => {
    const fetchSpy = mockSearchResponse()

    await provider.search('hello world', defaultWebsearch)

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.deepseek.com/v1/tools/search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json'
        })
      })
    )
  })

  it('maps results to title/content/url, falling back to summary', async () => {
    mockSearchResponse()

    const result = await provider.search('test', defaultWebsearch)

    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toEqual({
      title: 'First Result',
      url: 'https://example.com/first',
      content: 'Full page content fetched server-side.'
    })
    expect(result.results[1].content).toBe('Summary for second result.')
  })

  it('requests server-side content and clamps count to the API maximum', async () => {
    const fetchSpy = mockSearchResponse()

    await provider.search('test', { maxResults: 100, excludeDomains: [] } as any)

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.count).toBe(50)
    expect(body.need_content).toBe(true)
  })

  it('maps excludeDomains to -site: operators', async () => {
    const fetchSpy = mockSearchResponse()

    await provider.search('test', { maxResults: 5, excludeDomains: ['foo.com', 'bar.com'] } as any)

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.query).toBe('test -site:foo.com -site:bar.com')
  })

  it('truncates queries to the 128 character API limit', async () => {
    const fetchSpy = mockSearchResponse()

    await provider.search('x'.repeat(200), defaultWebsearch)

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.query).toHaveLength(128)
  })

  it('tolerates an empty results array', async () => {
    mockSearchResponse({ results: [] })

    const result = await provider.search('test', defaultWebsearch)

    expect(result.results).toHaveLength(0)
  })

  describe('error handling', () => {
    it('throws on empty query', async () => {
      await expect(provider.search('  ', defaultWebsearch)).rejects.toThrow('Search failed')
    })

    it('throws on HTTP error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      } as Response)

      await expect(provider.search('test', defaultWebsearch)).rejects.toThrow('Search failed')
    })
  })
})
