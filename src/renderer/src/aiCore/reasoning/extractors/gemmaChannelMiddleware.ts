import type { LanguageModelMiddleware } from 'ai'

import { extractDelimitedReasoningMiddleware } from './extractDelimitedReasoningMiddleware'

/**
 * Gemma 4 HF / local chat template emits thought channels as:
 *   <|channel>thought ... <channel|>
 * See https://ai.google.dev/gemma/docs/capabilities/thinking
 */
export const GEMMA_CHANNEL_OPEN = '<|channel>thought'
export const GEMMA_CHANNEL_CLOSE = '<channel|>'

export function createGemmaChannelReasoningMiddleware(): LanguageModelMiddleware {
  return extractDelimitedReasoningMiddleware({
    openingDelimiter: GEMMA_CHANNEL_OPEN,
    closingDelimiter: GEMMA_CHANNEL_CLOSE
  })
}
