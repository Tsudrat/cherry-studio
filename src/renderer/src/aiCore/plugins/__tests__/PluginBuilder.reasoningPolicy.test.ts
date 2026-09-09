import type { Model, Provider } from '@renderer/types'
import { describe, expect, it, vi } from 'vitest'

import { resolveReasoningStreamPolicy } from '../../reasoning/resolveStreamPolicy'

vi.mock('@renderer/hooks/useSettings', () => ({ getEnableDeveloperMode: () => false }))

const { buildPlugins } = await import('../PluginBuilder')
const { createReasoningExtractionPlugin } = await import('../reasoningExtractionPlugin')

describe('buildPlugins reasoning stream policy', () => {
  const baseConfig = {
    streamOutput: true,
    enableReasoning: true,
    isPromptToolUse: false,
    isSupportedToolUse: false,
    enableWebSearch: false,
    enableGenerateImage: false,
    enableUrlContext: false
  }

  it('installs reasoningExtraction for Ollama with default think dialect', () => {
    const provider = {
      id: 'ollama',
      type: 'ollama',
      name: 'Ollama',
      apiKey: '',
      apiHost: 'http://localhost:11434'
    } as Provider
    const model = { id: 'qwen3:8b', name: 'Qwen3 8B', provider: 'ollama', group: 'qwen' } as Model

    const plugins = buildPlugins({
      provider,
      model,
      config: { ...baseConfig, assistant: { id: 'assistant', name: 'Assistant', settings: {} } as never }
    })

    expect(plugins.map((plugin) => plugin.name)).toContain('reasoningExtraction')
    expect(resolveReasoningStreamPolicy(model, provider).extractors).toEqual([{ kind: 'xml-tag', tagName: 'think' }])
  })

  it('uses thought + gemma-channel for Gemma on OpenAI-compat gateways', async () => {
    const provider = {
      id: 'cloudflare',
      type: 'openai',
      name: 'Cloudflare',
      apiKey: '',
      apiHost: 'https://gateway.ai.cloudflare.com'
    } as Provider
    const model = {
      id: 'google/gemma-4-31b-it',
      name: 'Gemma 4',
      provider: 'cloudflare',
      group: 'google'
    } as Model

    const plugins = buildPlugins({
      provider,
      model,
      config: { ...baseConfig, assistant: { id: 'a', name: 'A', settings: {} } as never }
    })

    expect(plugins.map((p) => p.name)).toContain('reasoningExtraction')

    const policy = resolveReasoningStreamPolicy(model, provider)
    expect(policy.extractors).toEqual([{ kind: 'xml-tag', tagName: 'thought' }, { kind: 'gemma-channel' }])

    const context = { middlewares: [] as unknown[] }
    await createReasoningExtractionPlugin(policy).configureContext?.(context as never)
    expect(context.middlewares).toHaveLength(2)
  })

  it('does not install reasoningExtraction for native Gemini', () => {
    const provider = {
      id: 'gemini',
      type: 'gemini',
      name: 'Gemini',
      apiKey: '',
      apiHost: 'https://generativelanguage.googleapis.com'
    } as Provider
    const model = {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'gemini',
      group: 'gemini'
    } as Model

    const plugins = buildPlugins({
      provider,
      model,
      config: { ...baseConfig, assistant: { id: 'a', name: 'A', settings: {} } as never }
    })

    expect(plugins.map((p) => p.name)).not.toContain('reasoningExtraction')
    expect(resolveReasoningStreamPolicy(model, provider).extractors).toEqual([])
  })
})
