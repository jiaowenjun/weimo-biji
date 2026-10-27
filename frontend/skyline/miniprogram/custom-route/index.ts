import BottomSheet from './bottom-sheet'
import Cupertino from './cupertino'
import CupertinoInside from './cupertino-inside'
import CupertinoModal from './cupertino-modal'
import Modal from './modal'
import Upwards from './upwards'
import Zoom from './zoom'

let hasInstalledRouteBuilder = false

export function installRouteBuilder() {
  if (hasInstalledRouteBuilder) return
  wx.router.addRouteBuilder('cupertino', Cupertino as (ctx: unknown) => unknown)
  wx.router.addRouteBuilder('cupertino-inside', CupertinoInside as (ctx: unknown) => unknown)
  wx.router.addRouteBuilder('bottom-sheet', BottomSheet as (ctx: unknown) => unknown)
  wx.router.addRouteBuilder('upwards', Upwards as (ctx: unknown) => unknown)
  wx.router.addRouteBuilder('zoom', Zoom as (ctx: unknown) => unknown)
  wx.router.addRouteBuilder('modal', Modal as (ctx: unknown) => unknown)
  wx.router.addRouteBuilder('cupertino-modal', CupertinoModal as (ctx: unknown) => unknown)
  hasInstalledRouteBuilder = true
}
