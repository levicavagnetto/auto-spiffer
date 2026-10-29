import { describe, expect, it, vi } from 'vitest'
import { reportUnexpected } from '../../src/main/log'

describe('unexpected errors', () => {
  it('saves the technical error and sends plain instructions to the screen', () => {
    const writeLog = vi.fn()
    const sendToScreen = vi.fn()
    reportUnexpected(new Error('disk exploded'), writeLog, sendToScreen)
    expect(writeLog).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'disk exploded' })
    )
    expect(sendToScreen).toHaveBeenCalledWith(
      'Something went wrong. Details were saved to the log.'
    )
  })
})
