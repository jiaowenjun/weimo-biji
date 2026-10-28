import { Fragment } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Hash } from 'lucide-react'

import { CapsuleButton } from 'weimo-ui-core/components/capsule-button'
import {
  getCapsuleFrameAttributes,
  getCapsuleFrameClassName,
} from 'weimo-ui-core/components/capsule-frame'

export type TagBreadProps = Omit<
  ComponentPropsWithoutRef<'nav'>,
  'children' | 'prefix' | 'onSelect'
> & {
  tag: string
  onSelect?: (tag: string) => void
  separator?: ReactNode
}

type TagBreadCrumb = {
  label: string
  path: string
}

function buildTagBreadCrumbs(tag: string): TagBreadCrumb[] {
  const segments = tag
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)

  return segments.map((label, index) => ({
    label,
    path: segments.slice(0, index + 1).join('/'),
  }))
}

// 每级标签路径渲染为一颗胶囊：父级胶囊可点返回该级（CapsuleButton 默认
// 带 # 前缀），末级为当前所在层，用非交互的胶囊形态呈现；# 前缀只在
// 首颗胶囊出现一次（对齐原 TagBread 的前缀行为）。
export function TagBread({
  className,
  onSelect,
  separator = '/',
  tag,
  ...props
}: TagBreadProps) {
  const crumbs = buildTagBreadCrumbs(tag)

  return (
    <nav
      {...props}
      className={['tag-bread', className].filter(Boolean).join(' ')}
    >
      {crumbs.map((crumb, index) => {
        const isPage = index === crumbs.length - 1

        return (
          <Fragment key={crumb.path}>
            {isPage ? (
              <span
                aria-current="page"
                className={getCapsuleFrameClassName('tag-bread__page')}
                {...getCapsuleFrameAttributes({ material: 'solid' })}
              >
                {index === 0 ? (
                  <span className="capsule-frame__slot capsule-button__prefix">
                    <Hash aria-hidden="true" />
                  </span>
                ) : null}
                <span className="capsule-frame__content">{crumb.label}</span>
              </span>
            ) : (
              <CapsuleButton
                onClick={onSelect ? () => onSelect(crumb.path) : undefined}
                prefix={index === 0 ? undefined : null}
              >
                {crumb.label}
              </CapsuleButton>
            )}
            {index < crumbs.length - 1 ? (
              <span aria-hidden="true" className="tag-bread__separator">
                {separator}
              </span>
            ) : null}
          </Fragment>
        )
      })}
    </nav>
  )
}
