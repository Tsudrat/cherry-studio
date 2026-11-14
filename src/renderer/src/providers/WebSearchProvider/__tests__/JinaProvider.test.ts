import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('keyv', {
  get: vi.fn(),
  set: vi.fn()
})

import JinaProvider from '../JinaProvider'

function createProvider(overrides = {}) {
  return new JinaProvider({
    id: 'jina',
    name: 'Jina',
    apiHost: 'https://s.jina.ai',
    apiKey: 'jina_test',
    ...overrides
  })
}

const defaultWebsearch = { maxResults: 5, excludeDomains: [] } as any

const SEARCH_RESPONSE = {
  code: 200,
  status: 20000,
  data: [
    {
      title: 'First Result',
      url: 'https://example.com/first',
      description: 'A short description.',
      content: 'Full page content fetched server-side.'
    },
    {
      title: 'Second Result',
      url: 'https://example.com/second',
      description: 'Description only.'
    }
  ]
}

function mockSearchResponse(body: unknown = SEARCH_RESPONSE) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: true,
    json: async () => body
  } as Response)
}

describe('JinaProvider', () => {
  let provider: JinaProvider

  beforeEach(() => {
    provider = createProvider()
  })

  it('posts to the configured endpoint with bearer auth and json accept', async () => {
    const fetchSpy = mockSearchResponse()

    await provider.search('hello world', defaultWebsearch)

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://s.jina.ai/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer jina_test',
          'Content-Type': 'application/json',
          Accept: 'application/json'
        })
      })
    )
  })

  it('maps data entries to title/content/url, falling back to description', async () => {
    mockSearchResponse()

    const result = await provider.search('test', defaultWebsearch)

    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toEqual({
      title: 'First Result',
      url: 'https://example.com/first',
      content: 'Full page content fetched server-side.'
    })
    expect(result.results[1].content).toBe('Description only.')
  })

  it('clamps num to the API maximum', async () => {
    const fetchSpy = mockSearchResponse()

    await provider.search('test', { maxResults: 50, excludeDomains: [] } as any)

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.num).toBe(20)
  })

  it('maps excludeDomains to -site: operators', async () => {
    const fetchSpy = mockSearchResponse()

    await provider.search('test', { maxResults: 5, excludeDomains: ['foo.com', 'bar.com'] } as any)

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.q).toBe('test -site:foo.com -site:bar.com')
  })

  it('tolerates an empty data array', async () => {
    mockSearchResponse({ code: 200, status: 20000, data: [] })

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
