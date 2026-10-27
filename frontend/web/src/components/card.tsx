import {
  Card as UiCard,
  type CardProps,
} from 'weimo-ui/components/card'

export type {
  CardDraft,
  CardEditorOptions,
  CardLabels,
  CardMode,
  CardNote,
  CardProps,
} from 'weimo-ui/components/card'

const BIJI_CARD_TRANSITION_MS = 180

export function Card({
  transitionDurationMs = BIJI_CARD_TRANSITION_MS,
  ...props
}: CardProps) {
  return <UiCard transitionDurationMs={transitionDurationMs} {...props} />
}
