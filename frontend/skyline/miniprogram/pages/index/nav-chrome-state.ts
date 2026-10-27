export {
  PAGE_NAV_CHROME_DELTA_THRESHOLD as INDEX_NAV_CHROME_DELTA_THRESHOLD,
  PAGE_NAV_CHROME_ENTER_SCROLL_TOP as INDEX_NAV_CHROME_ENTER_SCROLL_TOP,
  PAGE_NAV_CHROME_TOP_EPS as INDEX_NAV_CHROME_TOP_EPS,
  type PageNavChromeStateInput as IndexNavChromeStateInput,
} from '../../utils/page-nav-chrome'

import {
  derivePageNavChromeTransparent,
  type PageNavChromeStateInput,
} from '../../utils/page-nav-chrome'

export function deriveIndexNavChromeState(input: PageNavChromeStateInput): boolean {
  return derivePageNavChromeTransparent(input)
}
