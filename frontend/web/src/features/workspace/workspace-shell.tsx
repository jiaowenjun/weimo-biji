import { type ReactNode } from 'react'

import {
  SiteTemplate,
  type SiteTemplateSidebar,
} from 'weimo-ui-template/components/site-template'

type WorkspaceShellProps = {
  children: ReactNode
  pageTitle: string
  sidebar: SiteTemplateSidebar
  topBarActions: ReactNode
  topBarLeading?: ReactNode
}

/** 工作区站点框架：SiteTemplate 提供顶栏、侧边栏抽屉与布局占位，页面只注入内容。
 * 主题跟随系统（showThemeToggle 隐藏切换按钮，html.dark 仍由模板同步）；
 * 窄屏抽屉不渲染右上角关闭按钮，收起靠点背景/左滑/选中即收起。 */
export function WorkspaceShell({
  children,
  pageTitle,
  sidebar,
  topBarActions,
  topBarLeading,
}: WorkspaceShellProps) {
  return (
    <SiteTemplate
      pageTitle={pageTitle}
      showSidebarCloseButton={false}
      showThemeToggle={false}
      sidebar={sidebar}
      siteName="微墨笔记"
      topBarActions={topBarActions}
      topBarLeading={topBarLeading}
    >
      {children}
    </SiteTemplate>
  )
}
