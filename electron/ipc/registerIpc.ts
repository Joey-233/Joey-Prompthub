import { clipboard, ipcMain } from 'electron'

import { IMAGE_TAG, type CreatePromptInput } from '../../src/shared/types'
import { callAiOptimize, callOpenaiImage, callSdWebui } from '../aiCalls'
import type { PromptDatabase } from '../db'
import type { FloatingBallController } from '../floatingBall'
import { secretStore } from '../secretStore'

export function registerIpc(
  database: PromptDatabase,
  onOpenMainWindow: () => void,
  getFloatingBall?: () => FloatingBallController | null
) {
  ipcMain.handle('prompts:list', (_event, filter) => database.prompts.list(filter))
  ipcMain.handle('prompts:create', (_event, input: CreatePromptInput) => database.prompts.create(input))
  ipcMain.handle('prompts:update', (_event, payload) => database.prompts.update(payload.id, payload.patch))
  ipcMain.handle('prompts:delete', (_event, id: string) => {
    database.prompts.delete(id)
  })

  ipcMain.handle('generations:list', () => database.generations.list())
  ipcMain.handle('generations:create', (_event, input) => database.generations.create(input))

  ipcMain.handle('settings:list', () => database.settings.list())
  ipcMain.handle('settings:set', (_event, payload) => {
    database.settings.set(payload.key, payload.value)
  })

  ipcMain.handle('secure:has', (_event, key: string) => secretStore.has(key))
  ipcMain.handle('secure:reveal', (_event, key: string) => secretStore.reveal(key))
  ipcMain.handle('secure:set', (_event, payload) => {
    secretStore.set(payload.key, payload.value)
  })
  ipcMain.handle('secure:delete', (_event, key: string) => {
    secretStore.delete(key)
  })

  ipcMain.handle('ai:optimize', (_event, input) => callAiOptimize(database, input))
  ipcMain.handle('image:openaiGenerate', (_event, input) => callOpenaiImage(database, input))
  ipcMain.handle('image:sdWebuiGenerate', (_event, input) => callSdWebui(database, input))

  ipcMain.handle('system:clipboardImport', () => {
    const text = clipboard.readText().trim()

    if (!text) {
      return null
    }

    return database.prompts.create({
      content: text,
      tags: [IMAGE_TAG]
    })
  })

  ipcMain.handle('system:openMainWindow', () => {
    onOpenMainWindow()
  })
  ipcMain.handle('system:getFloatingState', () => {
    return getFloatingBall?.()?.getState() ?? { x: 0, y: 0, side: 'right', expanded: false }
  })
  ipcMain.handle('system:setFloatingExpanded', (_event, expanded: boolean) => {
    return getFloatingBall?.()?.setExpanded(expanded) ?? { x: 0, y: 0, side: 'right', expanded }
  })
  ipcMain.handle('system:moveFloatingWindow', (_event, input) => {
    return getFloatingBall?.()?.moveWindow(input) ?? {
      x: input.x,
      y: input.y,
      side: 'right',
      expanded: false
    }
  })

  ipcMain.handle('floating:dragStart', (_event, input: { cursorScreenX?: number; cursorScreenY?: number } | undefined) => {
    return (
      getFloatingBall?.()?.startDrag({
        cursorScreenX: input?.cursorScreenX,
        cursorScreenY: input?.cursorScreenY
      }) ?? { x: 0, y: 0, side: 'right', expanded: false }
    )
  })

  ipcMain.handle('floating:dragEnd', (_event, payload: { snap: boolean } | undefined) => {
    return (
      getFloatingBall?.()?.endDrag(payload?.snap ?? false) ?? {
        x: 0,
        y: 0,
        side: 'right',
        expanded: false
      }
    )
  })
}
