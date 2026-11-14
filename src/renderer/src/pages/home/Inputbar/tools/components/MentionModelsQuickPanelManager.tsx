import type { ToolActionKey, ToolRenderContext, ToolStateKey } from '@renderer/pages/home/Inputbar/types'

import { useMentionModelsPanel } from './useMentionModelsPanel'

interface ManagerProps {
  context: ToolRenderContext<readonly ToolStateKey[], readonly ToolActionKey[]>
}

const MentionModelsQuickPanelManager = ({ context }: ManagerProps) => {
  const {
    quickPanel,
    quickPanelController,
    state: { mentionedModels, files, couldMentionNotVisionModel },
    actions: { setMentionedModels, onTextChange }
  } = context

  useMentionModelsPanel(
    {
      quickPanel,
      quickPanelController,
      mentionedModels: mentionedModels,
      setMentionedModels: setMentionedModels,
      couldMentionNotVisionModel,
      files: files,
      setText: onTextChange
    },
    'manager'
  )

  return null
}

export default MentionModelsQuickPanelManager
