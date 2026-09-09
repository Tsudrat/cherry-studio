import type { LanguageModelV3Content, LanguageModelV3StreamPart } from '@ai-sdk/provider'
import { getPotentialStartIndex } from '@renderer/utils/getPotentialIndex'
import type { LanguageModelMiddleware } from 'ai'

/**
 * Like AI SDK `extractReasoningMiddleware`, but for arbitrary opening/closing
 * delimiters (not only XML `<tag>` pairs). Used for Gemma channel tokens.
 *
 * Adapted from vercel/ai extract-reasoning-middleware.
 */
export function extractDelimitedReasoningMiddleware({
  openingDelimiter,
  closingDelimiter,
  separator = '\n',
  startWithReasoning = false
}: {
  openingDelimiter: string
  closingDelimiter: string
  separator?: string
  startWithReasoning?: boolean
}): LanguageModelMiddleware {
  return {
    specificationVersion: 'v3',
    wrapGenerate: async ({ doGenerate }) => {
      const { content, ...rest } = await doGenerate()

      const transformedContent: LanguageModelV3Content[] = []
      for (const part of content) {
        if (part.type !== 'text') {
          transformedContent.push(part)
          continue
        }

        const text = startWithReasoning ? openingDelimiter + part.text : part.text
        const matches: Array<{ index: number; full: string; inner: string }> = []
        let searchFrom = 0
        while (searchFrom < text.length) {
          const openIdx = text.indexOf(openingDelimiter, searchFrom)
          if (openIdx === -1) break
          const contentStart = openIdx + openingDelimiter.length
          const closeIdx = text.indexOf(closingDelimiter, contentStart)
          if (closeIdx === -1) break
          matches.push({
            index: openIdx,
            full: text.slice(openIdx, closeIdx + closingDelimiter.length),
            inner: text.slice(contentStart, closeIdx)
          })
          searchFrom = closeIdx + closingDelimiter.length
        }

        if (!matches.length) {
          transformedContent.push(part)
          continue
        }

        const reasoningText = matches.map((match) => match.inner).join(separator)

        let textWithoutReasoning = text
        for (let i = matches.length - 1; i >= 0; i--) {
          const match = matches[i]
          const beforeMatch = textWithoutReasoning.slice(0, match.index)
          const afterMatch = textWithoutReasoning.slice(match.index + match.full.length)
          textWithoutReasoning =
            beforeMatch + (beforeMatch.length > 0 && afterMatch.length > 0 ? separator : '') + afterMatch
        }

        transformedContent.push({
          type: 'reasoning',
          text: reasoningText
        })
        transformedContent.push({
          type: 'text',
          text: textWithoutReasoning
        })
      }

      return { content: transformedContent, ...rest }
    },

    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream()

      const reasoningExtrated: Record<
        string,
        {
          isFirstReasoning: boolean
          isFirstText: boolean
          afterSwitch: boolean
          isReasoning: boolean
          buffer: string
          idCounter: number
          textId: string
        }
      > = {}

      let delayedTextStart: LanguageModelV3StreamPart | undefined

      return {
        stream: stream.pipeThrough(
          new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>({
            transform: (chunk, controller) => {
              if (chunk.type === 'text-start') {
                delayedTextStart = chunk
                return
              }

              if (chunk.type === 'text-end' && delayedTextStart) {
                controller.enqueue(delayedTextStart)
                delayedTextStart = undefined
              }

              if (chunk.type !== 'text-delta') {
                controller.enqueue(chunk)
                return
              }

              if (reasoningExtrated[chunk.id] == null) {
                reasoningExtrated[chunk.id] = {
                  isFirstReasoning: true,
                  isFirstText: true,
                  afterSwitch: false,
                  isReasoning: startWithReasoning,
                  buffer: '',
                  idCounter: 0,
                  textId: chunk.id
                }
              }

              const activeExtraction = reasoningExtrated[chunk.id]
              activeExtraction.buffer += chunk.delta

              function publish(text: string) {
                if (text.length > 0) {
                  const prefix =
                    activeExtraction.afterSwitch &&
                    (activeExtraction.isReasoning
                      ? !activeExtraction.isFirstReasoning
                      : !activeExtraction.isFirstText)
                      ? separator
                      : ''

                  if (
                    activeExtraction.isReasoning &&
                    (activeExtraction.afterSwitch || activeExtraction.isFirstReasoning)
                  ) {
                    controller.enqueue({
                      type: 'reasoning-start',
                      id: `reasoning-${activeExtraction.idCounter}`
                    })
                  }

                  if (activeExtraction.isReasoning) {
                    controller.enqueue({
                      type: 'reasoning-delta',
                      delta: prefix + text,
                      id: `reasoning-${activeExtraction.idCounter}`
                    })
                  } else {
                    if (delayedTextStart) {
                      controller.enqueue(delayedTextStart)
                      delayedTextStart = undefined
                    }
                    controller.enqueue({
                      type: 'text-delta',
                      delta: prefix + text,
                      id: activeExtraction.textId
                    })
                  }
                  activeExtraction.afterSwitch = false

                  if (activeExtraction.isReasoning) {
                    activeExtraction.isFirstReasoning = false
                  } else {
                    activeExtraction.isFirstText = false
                  }
                }
              }

              do {
                const nextTag = activeExtraction.isReasoning ? closingDelimiter : openingDelimiter
                const startIndex = getPotentialStartIndex(activeExtraction.buffer, nextTag)

                if (startIndex == null) {
                  publish(activeExtraction.buffer)
                  activeExtraction.buffer = ''
                  break
                }

                publish(activeExtraction.buffer.slice(0, startIndex))

                const foundFullMatch = startIndex + nextTag.length <= activeExtraction.buffer.length

                if (foundFullMatch) {
                  activeExtraction.buffer = activeExtraction.buffer.slice(startIndex + nextTag.length)

                  if (activeExtraction.isReasoning) {
                    if (activeExtraction.isFirstReasoning) {
                      controller.enqueue({
                        type: 'reasoning-start',
                        id: `reasoning-${activeExtraction.idCounter}`
                      })
                    }
                    controller.enqueue({
                      type: 'reasoning-end',
                      id: `reasoning-${activeExtraction.idCounter++}`
                    })
                  }

                  activeExtraction.isReasoning = !activeExtraction.isReasoning
                  activeExtraction.afterSwitch = true
                } else {
                  activeExtraction.buffer = activeExtraction.buffer.slice(startIndex)
                  break
                }
              } while (true)
            }
          })
        ),
        ...rest
      }
    }
  }
}
