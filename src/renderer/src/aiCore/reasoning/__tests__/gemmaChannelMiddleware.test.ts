import type { LanguageModelV3StreamPart } from '@ai-sdk/provider'
import { describe, expect, it } from 'vitest'

import {
  createGemmaChannelReasoningMiddleware,
  GEMMA_CHANNEL_CLOSE,
  GEMMA_CHANNEL_OPEN
} from '../extractors/gemmaChannelMiddleware'

async function collectStream(parts: LanguageModelV3StreamPart[]): Promise<LanguageModelV3StreamPart[]> {
  const middleware = createGemmaChannelReasoningMiddleware()
  const input = new ReadableStream<LanguageModelV3StreamPart>({
    start(controller) {
      for (const part of parts) controller.enqueue(part)
      controller.close()
    }
  })

  const { stream } = await middleware.wrapStream!({
    doStream: async () => ({ stream: input }),
    params: {} as never,
    model: {} as never
  })

  const out: LanguageModelV3StreamPart[] = []
  const reader = stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    out.push(value)
  }
  return out
}

describe('createGemmaChannelReasoningMiddleware', () => {
  it('extracts channel thought from a complete text part on generate', async () => {
    const middleware = createGemmaChannelReasoningMiddleware()
    const result = await middleware.wrapGenerate!({
      doGenerate: async () => ({
        content: [
          {
            type: 'text',
            text: `${GEMMA_CHANNEL_OPEN}step by step${GEMMA_CHANNEL_CLOSE}Final answer`
          }
        ]
      }),
      params: {} as never,
      model: {} as never
    })

    expect(result.content).toEqual([
      { type: 'reasoning', text: 'step by step' },
      { type: 'text', text: 'Final answer' }
    ])
  })

  it('streams reasoning across chunk boundaries', async () => {
    const parts = await collectStream([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: '<|chan' },
      { type: 'text-delta', id: 't1', delta: 'nel>thought\nhello' },
      { type: 'text-delta', id: 't1', delta: ` world${GEMMA_CHANNEL_CLOSE}Answer` },
      { type: 'text-end', id: 't1' }
    ])

    const reasoning = parts.filter((p) => p.type === 'reasoning-delta').map((p) => ('delta' in p ? p.delta : ''))
    const text = parts.filter((p) => p.type === 'text-delta').map((p) => ('delta' in p ? p.delta : ''))

    expect(parts.some((p) => p.type === 'reasoning-start')).toBe(true)
    expect(parts.some((p) => p.type === 'reasoning-end')).toBe(true)
    expect(reasoning.join('')).toContain('hello')
    expect(reasoning.join('')).toContain('world')
    expect(text.join('')).toBe('Answer')
    expect(text.join('')).not.toContain(GEMMA_CHANNEL_OPEN)
  })
})
