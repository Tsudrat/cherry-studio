import { isHostedGemma4ThinkingModel } from '@renderer/config/models'
import type { Model, ReasoningEffortOption } from '@renderer/types'

/**
 * Whether Google-family thinking APIs should return thought summaries / text.
 *
 * Used for both:
 * - Native Gemini: `thinkingConfig.includeThoughts`
 * - OpenAI-compat: `extra_body.google.thinking_config.include_thoughts`
 *
 * Hosted Gemma 4 only surfaces thoughts at high/xhigh; other efforts map to
 * thinkingLevel minimal without including thought text.
 */
export function resolveGoogleIncludeThoughts(
  model: Model,
  reasoningEffort: ReasoningEffortOption | undefined
): boolean {
  if (!reasoningEffort || reasoningEffort === 'default') {
    return false
  }

  if (isHostedGemma4ThinkingModel(model)) {
    return reasoningEffort === 'high' || reasoningEffort === 'xhigh'
  }

  return reasoningEffort !== 'none'
}
