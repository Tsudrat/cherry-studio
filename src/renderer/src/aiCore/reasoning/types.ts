/**
 * Stream-side reasoning extractors applied to text that embeds CoT in-band.
 * Empty `extractors` means the client relies on native AI SDK `reasoning-*` parts only.
 */
export type ReasoningExtractor =
  | {
      kind: 'xml-tag'
      tagName: string
      startWithReasoning?: boolean
    }
  | {
      kind: 'gemma-channel'
    }

export type ReasoningStreamPolicy = {
  extractors: ReasoningExtractor[]
}
