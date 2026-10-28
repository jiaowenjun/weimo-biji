import { type ReactNode } from 'react'

import {
  SiteTemplate,
  type SiteTemplateSidebar,
} from 'weimo-ui-template/components/site-template'

import { useSiteTheme } from '@/lib/site-theme'

type WorkspaceShellProps = {
  children: ReactNode
  pageTitle: string
  sidebar: SiteTemplateSidebar
  topBarActions: ReactNode
  topBarLeading?: ReactNode
}

/** 工作区站点框架：SiteTemplate 提供顶栏、侧边栏抽屉与主题切换，页面只注入内容。 */
export function WorkspaceShell({
  children,
  pageTitle,
  sidebar,
  topBarActions,
  topBarLeading,
}: WorkspaceShellProps) {
  const { onThemeChange, theme } = useSiteTheme()

  return (
    <SiteTemplate
      onThemeChange={onThemeChange}
      pageTitle={pageTitle}
      sidebar={sidebar}
      siteName="微墨笔记"
      theme={theme}
      topBarActions={topBarActions}
      topBarLeading={topBarLeading}
    >
      {children}
    </SiteTemplate>
  )
}
