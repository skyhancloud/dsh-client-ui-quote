/**
 * Selection quoting plugin, browser half: the `quote` entry of the
 * `conversation.input.dock` list. The entry mounts once per session inside
 * the conversation scrollport and hosts a floating toolbar over any text
 * selection inside an assistant message; 引用 attaches the selection to the
 * composer as a removable quote banner so the model sees what the user refers
 * to.
 * @module dsh-client-ui-quote/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-conversation SlotMap merge (the input.dock seat).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { SelectionQuoteTooltip } from './SelectionQuoteTooltip.tsx'
import { en, zh } from './locales.ts'

export type { SelectionQuoteTooltipProps } from './SelectionQuoteTooltip.tsx'
export type { QuotePick } from './quote.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'quote'

/** Required services: the slot registry and the copy. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: the quoting toolbar dock entry.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-quote: dictionaries')

  // The dock seat is declared by ui-conversation; inject waits on the actual
  // declaration, removes the entry when that declaration collapses, and
  // re-registers after a redeclaration.
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'quote',
    order: 100,
    locale: NS,
  }, SelectionQuoteTooltip))
}
