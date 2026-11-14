import type { CollapseProps } from 'antd'
import { useTranslation } from 'react-i18next'

import { truncateOutput } from '../shared/truncateOutput'
import { SkeletonValue, ToolHeader, TruncatedIndicator } from './GenericTools'
import { AgentToolsType, type SkillToolInput, type SkillToolOutput } from './types'

export function SkillTool({
  input,
  output
}: {
  input?: SkillToolInput
  output?: SkillToolOutput
}): NonNullable<CollapseProps['items']>[number] {
  const { t } = useTranslation()
  const { data: truncatedOutput, isTruncated, originalLength } = truncateOutput(output)

  return {
    key: AgentToolsType.Skill,
    label: (
      <ToolHeader
        toolName={AgentToolsType.Skill}
        params={<SkeletonValue value={input?.skill} width="150px" />}
        variant="collapse-label"
        showStatus={false}
      />
    ),
    children: (
      <div className="flex flex-col gap-3">
        {/* Args 输入区域 */}
        {input?.args && (
          <div>
            <div className="text-muted-foreground mb-1 text-xs font-medium">{t('message.tools.sections.args')}</div>
            <div className="bg-muted/50 max-h-40 overflow-y-auto rounded-md p-2">
              <code className="font-mono text-xs break-all whitespace-pre-wrap">{input.args}</code>
            </div>
          </div>
        )}

        {/* Output 输出区域 */}
        {truncatedOutput ? (
          <div>
            <div className="text-muted-foreground mb-1 text-xs font-medium">{t('message.tools.sections.output')}</div>
            <div className="bg-muted/30 max-h-60 overflow-y-auto rounded-md p-2">
              <pre className="font-mono text-xs whitespace-pre-wrap">{truncatedOutput}</pre>
            </div>
            {isTruncated && <TruncatedIndicator originalLength={originalLength} />}
          </div>
        ) : (
          <SkeletonValue value={null} width="100%" fallback={null} />
        )}
      </div>
    )
  }
}
