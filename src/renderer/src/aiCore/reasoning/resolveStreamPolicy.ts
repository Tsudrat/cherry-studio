import type { Model, Provider } from '@renderer/types'
import { isOllamaProvider } from '@renderer/utils/provider'

import type { ReasoningExtractor, ReasoningStreamPolicy } from './types'

/**
 * Whether this provider/model path typically dumps CoT into plain text
 * (XML tags or channel tokens) instead of structured reasoning fields.
 */
export function shouldExtractReasoningFromText(provider: Provider, model: Model): boolean {
  return (
    provider.type === 'openai' ||
    provider.type === 'azure-openai' ||
    model.endpoint_type === 'openai' ||
    isOllamaProvider(provider)
  )
}

/**
 * Map model id → in-band CoT dialect(s).
 * This is a delimiter convention table, not a product-family merge
 * (e.g. Gemini and Gemma share `<thought>` on some OpenAI-compat gateways,
 * but request params stay separate).
 */
export function resolveReasoningDialectExtractors(modelId: string | undefined): ReasoningExtractor[] {
  const id = modelId?.toLowerCase() ?? ''

  if (id.includes('gpt-oss')) {
    return [{ kind: 'xml-tag', tagName: 'reasoning' }]
  }

  // Gemini OpenAI-compat / gateways often emit <thought>…</thought>
  if (id.includes('gemini')) {
    return [{ kind: 'xml-tag', tagName: 'thought' }]
  }

  // Gemma may emit XML <thought> (Cloudflare Compat) and/or HF channel tokens
  if (id.includes('gemma')) {
    return [{ kind: 'xml-tag', tagName: 'thought' }, { kind: 'gemma-channel' }]
  }

  if (id.includes('seed-oss-36b')) {
    return [{ kind: 'xml-tag', tagName: 'seed:think' }]
  }

  // Default for Qwen / DeepSeek clones / most local OpenAI-compat models
  return [{ kind: 'xml-tag', tagName: 'think' }]
}

/**
 * Resolve whether / how to peel reasoning out of streamed text for this call.
 */
export function resolveReasoningStreamPolicy(model: Model, provider: Provider): ReasoningStreamPolicy {
  if (!shouldExtractReasoningFromText(provider, model)) {
    return { extractors: [] }
  }

  return {
    extractors: resolveReasoningDialectExtractors(model.id)
  }
}
