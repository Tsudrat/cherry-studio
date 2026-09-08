import type { Model } from '@renderer/types'
import { getLowerBaseModelName } from '@renderer/utils/naming'

export const OPENAI_NO_SUPPORT_DEV_ROLE_MODELS = ['o1-preview', 'o1-mini']

// Excludes known image models from isOpenAIModel.
export function isOpenAILLMModel(model?: Model): boolean {
  if (!model) {
    return false
  }
  const modelId = getLowerBaseModelName(model.id)

  if (modelId.includes('gpt-4o-image')) {
    return false
  }
  return isOpenAIModel(model)
}

// TODO: only covers GPT and reasoning (o-series) models.
// Non-chat models (dall-e, whisper, tts, text-embedding-*) are not detected.
export function isOpenAIModel(model: Model): boolean {
  if (!model) {
    return false
  }
  const modelId = getLowerBaseModelName(model.id)

  return /\bgpt\b/.test(modelId) || isOpenAIReasoningModel(model)
}

export const isGPT5ProModel = (model: Model) => {
  const modelId = getLowerBaseModelName(model.id)
  return modelId.includes('gpt-5-pro')
}

export const isGPT52ProModel = (model: Model) => {
  const modelId = getLowerBaseModelName(model.id)
  return modelId.includes('gpt-5.2-pro')
}

export const isGPT51CodexMaxModel = (model: Model) => {
  const modelId = getLowerBaseModelName(model.id)
  return modelId.includes('gpt-5.1-codex-max')
}

export const isOpenAIOpenWeightModel = (model: Model) => {
  const modelId = getLowerBaseModelName(model.id)
  return modelId.includes('gpt-oss')
}

/**
 * Normalize OpenAI GPT version separators so hyphenated gateway ids match dotted API ids.
 * e.g. gpt-5-6-sol -> gpt-5.6-sol; gpt-6-astra stays unchanged.
 * Avoid rewriting dated snapshots like gpt-5-2025-08-07.
 */
export const normalizeOpenAIGptModelId = (modelId: string) => {
  return getLowerBaseModelName(modelId).replace(/gpt-(\d+)-(\d)(?!\d)/g, 'gpt-$1.$2')
}

/**
 * Checks if a model belongs to the GPT-5 base series (e.g. gpt-5, gpt-5-pro).
 * Uses negative lookahead to exclude sub-versions like gpt-5.1, gpt-5.2, etc.
 */
export const isGPT5SeriesModel = (model: Model) => {
  const modelId = normalizeOpenAIGptModelId(model.id)
  return /gpt-5(?!\.\d)/.test(modelId)
}

export const isGPT5SeriesReasoningModel = (model: Model) => {
  const modelId = normalizeOpenAIGptModelId(model.id)
  return isGPT5SeriesModel(model) && !modelId.includes('chat')
}

/**
 * Checks if a model belongs to the GPT-5 family (gpt-5, gpt-5.1, gpt-5.2, etc.).
 */
export const isGPT5FamilyModel = (model: Model) => {
  const modelId = normalizeOpenAIGptModelId(model.id)
  return modelId.includes('gpt-5')
}

export const isGPT51SeriesModel = (model: Model) => {
  const modelId = normalizeOpenAIGptModelId(model.id)
  return modelId.includes('gpt-5.1')
}

export const isGPT52SeriesModel = (model: Model) => {
  const modelId = normalizeOpenAIGptModelId(model.id)
  return modelId.includes('gpt-5.2')
}

/**
 * GPT-5.6 family (Sol / Terra / Luna and base gpt-5.6).
 * Accepts both dotted (`gpt-5.6-sol`) and hyphenated (`gpt-5-6-sol`) ids.
 */
export const isGPT56SeriesModel = (model: Model) => {
  const modelId = normalizeOpenAIGptModelId(model.id)
  return /(?:^|[-_.])gpt-5\.6(?:$|[-_.])/.test(modelId)
}

export const isGPT56ProModel = (model: Model) => {
  const modelId = normalizeOpenAIGptModelId(model.id)
  return isGPT56SeriesModel(model) && /(?:^|[-_.])pro(?:$|[-_.])/.test(modelId)
}

/**
 * GPT-6 family. Currently only Astra is released; keep the matcher open for later SKUs.
 */
export const isGPT6FamilyModel = (model: Model) => {
  const modelId = normalizeOpenAIGptModelId(model.id)
  return /(?:^|[-_.])gpt-6(?:$|[-_.])/.test(modelId)
}

export const isGPT6AstraModel = (model: Model) => {
  const modelId = normalizeOpenAIGptModelId(model.id)
  return /(?:^|[-_.])gpt-6-astra(?:$|[-_.])/.test(modelId)
}

export const isGPT6AstraProModel = (model: Model) => {
  const modelId = normalizeOpenAIGptModelId(model.id)
  return isGPT6AstraModel(model) && /(?:^|[-_.])pro(?:$|[-_.])/.test(modelId)
}

/**
 * GPT-5.6 / GPT-6 models that support Responses API `reasoning.mode` (`standard` | `pro`).
 * Dedicated `*-pro` SKUs already embed Pro behavior and do not need the mode field.
 */
export const isSupportOpenAIReasoningModeModel = (model: Model) => {
  if (isGPT56ProModel(model) || isGPT6AstraProModel(model)) {
    return false
  }
  return isGPT56SeriesModel(model) || isGPT6AstraModel(model) || isGPT6FamilyModel(model)
}

export const isSupportVerbosityModel = (model: Model) => {
  return isGPT5FamilyModel(model) || isGPT6FamilyModel(model)
}

/**
 * Determines if a model supports the "none" reasoning effort parameter.
 *
 * This applies to GPT-5.x sub-version models (non-chat, non-pro variants).
 * These models allow setting reasoning_effort to "none" to skip reasoning steps.
 * Codex variants are supported from GPT-5.3 onwards; GPT-5.1/5.2 codex models are excluded.
 *
 * @param model - The model to check
 * @returns true if the model supports "none" reasoning effort, false otherwise
 *
 * @example
 * ```ts
 * // Returns true
 * isSupportNoneReasoningEffortModel({ id: 'gpt-5.1', provider: 'openai' })
 * isSupportNoneReasoningEffortModel({ id: 'gpt-5.2-mini', provider: 'openai' })
 * isSupportNoneReasoningEffortModel({ id: 'gpt-5.3-codex', provider: 'openai' })
 *
 * // Returns false
 * isSupportNoneReasoningEffortModel({ id: 'gpt-5.1-pro', provider: 'openai' })
 * isSupportNoneReasoningEffortModel({ id: 'gpt-5.1-codex', provider: 'openai' })
 * isSupportNoneReasoningEffortModel({ id: 'gpt-5-pro', provider: 'openai' })
 * ```
 */
export function isSupportNoneReasoningEffortModel(model: Model): boolean {
  const modelId = normalizeOpenAIGptModelId(model.id)
  // GPT-6 Astra rejects `none` (HTTP 400). Other GPT-6 SKUs may restore it later.
  if (isGPT6AstraModel(model)) {
    return false
  }
  const isCodex = modelId.includes('codex')
  const isOldCodex = isCodex && (isGPT51SeriesModel(model) || isGPT52SeriesModel(model))
  return (
    isGPT5FamilyModel(model) &&
    !isGPT5SeriesModel(model) &&
    !modelId.includes('chat') &&
    !modelId.includes('pro') &&
    !isOldCodex
  )
}

export function isOpenAIChatCompletionOnlyModel(model?: Model): boolean {
  if (!model) {
    return false
  }

  const modelId = getLowerBaseModelName(model.id)
  return (
    modelId.includes('gpt-4o-search-preview') ||
    modelId.includes('gpt-4o-mini-search-preview') ||
    modelId.includes('o1-mini') ||
    modelId.includes('o1-preview')
  )
}

export function isOpenAIReasoningModel(model: Model): boolean {
  const modelId = getLowerBaseModelName(model.id, '/')
  return isSupportedReasoningEffortOpenAIModel(model) || /(?:^|[-_.])o1(?:$|[-_.])/.test(modelId)
}

export function isSupportedReasoningEffortOpenAIModel(model: Model): boolean {
  const modelId = normalizeOpenAIGptModelId(model.id)
  const isO1 = /(?:^|[-_.])o1(?:$|[-_.])/.test(modelId)
  const isO3OrO4 = /(?:^|[-_.])o[34](?:$|[-_.])/.test(modelId)
  return (
    (isO1 && !(modelId.includes('o1-preview') || modelId.includes('o1-mini'))) ||
    isO3OrO4 ||
    modelId.includes('gpt-oss') ||
    (isGPT5FamilyModel(model) && !modelId.includes('chat')) ||
    (isGPT6FamilyModel(model) && !modelId.includes('chat'))
  )
}

const OPENAI_DEEP_RESEARCH_MODEL_REGEX = /deep[-_]?research/

export function isOpenAIDeepResearchModel(model?: Model): boolean {
  if (!model) {
    return false
  }

  const providerId = model.provider
  if (providerId !== 'openai' && providerId !== 'openai-chat') {
    return false
  }

  const modelId = getLowerBaseModelName(model.id, '/')
  return OPENAI_DEEP_RESEARCH_MODEL_REGEX.test(modelId)
}
