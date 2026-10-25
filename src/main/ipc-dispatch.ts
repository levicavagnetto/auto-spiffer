import { z } from 'zod'
import { calls, type CallHandlers, type CallName } from '../shared/ipc'

const requestSchema = z
  .object({ name: z.string(), input: z.unknown() })
  .strict()

export async function dispatchCall(
  request: unknown,
  handlers: CallHandlers,
  log: (message: string) => void
): Promise<unknown> {
  const envelope = requestSchema.safeParse(request)
  if (!envelope.success) {
    log('Invalid app call envelope')
    throw new Error('Invalid app call')
  }

  const name = envelope.data.name as CallName
  if (!Object.hasOwn(calls, name)) {
    log(`Unknown app call: ${name}`)
    throw new Error('Unknown app call')
  }

  const contract = calls[name]
  const parsedInput = contract.input.safeParse(envelope.data.input)
  if (!parsedInput.success) {
    log(`Invalid app call input: ${name}`)
    throw new Error('Invalid app call input')
  }

  const handler = handlers[name] as (input: unknown) => unknown
  const result = await handler(parsedInput.data)
  return contract.output.parse(result)
}
