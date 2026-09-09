import { definePlugin } from '@cherrystudio/ai-core'
import { extractReasoningMiddleware } from 'ai'

import { createGemmaChannelReasoningMiddleware } from '../reasoning/extractors/gemmaChannelMiddleware'
import type { ReasoningStreamPolicy } from '../reasoning/types'

/**
 * Reasoning Extraction Plugin
 *
 * Peels in-band CoT (XML tags and/or Gemma channel tokens) out of text streams
 * and exposes them as AI SDK reasoning parts, using the resolved stream policy.
 */
export const createReasoningExtractionPlugin = (policy: ReasoningStreamPolicy) =>
  definePlugin({
    name: 'reasoningExtraction',
    enforce: 'pre',

    configureContext: (context) => {
      context.middlewares = context.middlewares || []

      for (const extractor of policy.extractors) {
        if (extractor.kind === 'xml-tag') {
          context.middlewares.push(
            extractReasoningMiddleware({
              tagName: extractor.tagName,
              startWithReasoning: extractor.startWithReasoning
            })
          )
        } else if (extractor.kind === 'gemma-channel') {
          context.middlewares.push(createGemmaChannelReasoningMiddleware())
        }
      }
    }
  })
