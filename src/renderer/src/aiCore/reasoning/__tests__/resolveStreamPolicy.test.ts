import type { Model, Provider } from '@renderer/types'
import { describe, expect, it } from 'vitest'

import {
  resolveReasoningDialectExtractors,
  resolveReasoningStreamPolicy,
  shouldExtractReasoningFromText
} from '../resolveStreamPolicy'

function openaiProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'custom',
    type: 'openai',
    name: 'Custom',
    apiKey: '',
    apiHost: 'https://example.com',
    ...overrides
  } as Provider
}

function model(id: string, overrides: Partial<Model> = {}): Model {
  return {
    id,
    name: id,
    provider: 'custom',
    group: 'test',
    ...overrides
  } as Model
}

describe('resolveReasoningDialectExtractors', () => {
  it('maps gpt-oss to <reasoning>', () => {
    expect(resolveReasoningDialectExtractors('openai/gpt-oss-120b')).toEqual([
      { kind: 'xml-tag', tagName: 'reasoning' }
    ])
  })

  it('maps gemini to <thought>', () => {
    expect(resolveReasoningDialectExtractors('google/gemini-2.5-flash')).toEqual([
      { kind: 'xml-tag', tagName: 'thought' }
    ])
  })

  it('maps gemma to <thought> plus gemma-channel (not merged into gemini brand logic)', () => {
    expect(resolveReasoningDialectExtractors('google/gemma-4-31b-it')).toEqual([
      { kind: 'xml-tag', tagName: 'thought' },
      { kind: 'gemma-channel' }
    ])
  })

  it('maps seed-oss-36b to <seed:think>', () => {
    expect(resolveReasoningDialectExtractors('seed-oss-36b')).toEqual([{ kind: 'xml-tag', tagName: 'seed:think' }])
  })

  it('defaults to <think>', () => {
    expect(resolveReasoningDialectExtractors('qwen3:8b')).toEqual([{ kind: 'xml-tag', tagName: 'think' }])
  })
})

describe('resolveReasoningStreamPolicy', () => {
  it('installs dialect extractors for OpenAI-compat providers', () => {
    const policy = resolveReasoningStreamPolicy(model('gemma-4-31b-it'), openaiProvider())
    expect(policy.extractors).toHaveLength(2)
    expect(policy.extractors[0]).toEqual({ kind: 'xml-tag', tagName: 'thought' })
  })

  it('skips text extraction for native Gemini provider', () => {
    const provider = openaiProvider({ id: 'gemini', type: 'gemini', name: 'Gemini' })
    const policy = resolveReasoningStreamPolicy(model('gemini-2.5-flash', { provider: 'gemini' }), provider)
    expect(policy.extractors).toEqual([])
  })

  it('extracts for Ollama', () => {
    const provider = openaiProvider({ id: 'ollama', type: 'ollama', name: 'Ollama' })
    expect(shouldExtractReasoningFromText(provider, model('qwen3:8b'))).toBe(true)
    expect(resolveReasoningStreamPolicy(model('qwen3:8b'), provider).extractors).toEqual([
      { kind: 'xml-tag', tagName: 'think' }
    ])
  })

  it('extracts when endpoint_type is openai on a non-openai provider type', () => {
    const provider = openaiProvider({ id: 'vertexai', type: 'vertexai', name: 'Vertex' })
    const m = model('gemini-2.5-pro', { endpoint_type: 'openai' })
    expect(resolveReasoningStreamPolicy(m, provider).extractors).toEqual([{ kind: 'xml-tag', tagName: 'thought' }])
  })
})
