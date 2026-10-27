import { CardComposer, type CardComposerProps } from 'weimo-ui/components/card-composer'

import type { CardProps } from '@/components/card'
import { RefCard } from '@/components/ref-card'

type PendingCreateCardProps = CardComposerProps

function renderPendingRefCard(cardProps: CardProps) {
  return <RefCard {...cardProps} />
}

export function PendingCreateCard(props: PendingCreateCardProps) {
  return (
    <CardComposer
      {...props}
      renderCard={renderPendingRefCard}
    />
  )
}
