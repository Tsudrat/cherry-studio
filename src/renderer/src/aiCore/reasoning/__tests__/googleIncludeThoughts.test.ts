import type { Model, ReasoningEffortOption } from '@renderer/types'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/config/models', () => ({
  isHostedGemma4ThinkingModel: vi.fn()
}))

import { isHostedGemma4ThinkingModel } from '@renderer/config/models'

import { resolveGoogleIncludeThoughts } from '../googleIncludeThoughts'

function model(id: string, provider = 'gemini'): Model {
  return { id, name: id, provider, group: 'test' } as Model
}

describe('resolveGoogleIncludeThoughts', () => {
  it('returns false when effort is unset or default', () => {
    vi.mocked(isHostedGemma4ThinkingModel).mockReturnValue(false)
    expect(resolveGoogleIncludeThoughts(model('gemini-2.5-flash'), undefined)).toBe(false)
    expect(resolveGoogleIncludeThoughts(model('gemini-2.5-flash'), 'default')).toBe(false)
  })

  it('returns false for none and true for other efforts on Gemini', () => {
    vi.mocked(isHostedGemma4ThinkingModel).mockReturnValue(false)
    expect(resolveGoogleIncludeThoughts(model('gemini-2.5-flash'), 'none')).toBe(false)
    for (const effort of ['low', 'medium', 'high', 'auto'] as ReasoningEffortOption[]) {
      expect(resolveGoogleIncludeThoughts(model('gemini-2.5-flash'), effort)).toBe(true)
    }
  })

  it('only includes thoughts for hosted Gemma at high/xhigh', () => {
    vi.mocked(isHostedGemma4ThinkingModel).mockReturnValue(true)
    expect(resolveGoogleIncludeThoughts(model('gemma-4-31b-it'), 'low')).toBe(false)
    expect(resolveGoogleIncludeThoughts(model('gemma-4-31b-it'), 'medium')).toBe(false)
    expect(resolveGoogleIncludeThoughts(model('gemma-4-31b-it'), 'high')).toBe(true)
    expect(resolveGoogleIncludeThoughts(model('gemma-4-31b-it'), 'xhigh')).toBe(true)
  })
})
