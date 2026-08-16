/**
 * Selection validation and quote-block building, kept DOM-free except where a
 * live browser Range is required (the selection pick) so both arms stay
 * unit-testable without render machinery.
 */

/** Chat flow row kinds whose text may be quoted (the assistant's replies). */
export const QUOTABLE_FLOW_KINDS: readonly string[] = ['assistant-step']

/** A validated assistant-text selection: the picked text plus its live DOM Range. */
export interface QuotePick {
  readonly text: string
  readonly range: Range
}

/** Whether a range rect is still visible (a detached or streaming-replaced range reports a zero box). */
export function rectVisible(rect: DOMRect): boolean {
  return rect.width > 0 && rect.height > 0
}

/** Element holding the selection anchor (text nodes resolve to their parent). */
function anchorElementOf(range: Range): Element | null {
  const node = range.startContainer
  if (node.nodeType === Node.TEXT_NODE) return node.parentElement
  return node instanceof Element ? node : null
}

/**
 * Read the current document selection when it targets quotable assistant text
 * inside the host conversation scrollport.
 * @param host - the session scrollport containing the chat flow.
 * @returns the picked text and range, or null when the selection is empty,
 * outside the chat flow, or not an assistant row.
 */
export function pickAssistantSelection(host: Element | null): QuotePick | null {
  if (host === null) return null
  const selection = window.getSelection()
  if (selection === null || selection.isCollapsed || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  const text = range.toString()
  if (text.trim() === '') return null
  const anchor = anchorElementOf(range)
  if (anchor === null) return null
  const row = anchor.closest('[data-chat-flow-kind]')
  if (row === null || !host.contains(row)) return null
  const kind = row.getAttribute('data-chat-flow-kind')
  if (kind === null || !QUOTABLE_FLOW_KINDS.includes(kind)) return null
  return { text, range }
}

/**
 * Build the markdown block the sink prepends to the outgoing message: the
 * selected text as a blockquote with an attribution line. The banner displays
 * the raw selection text; only the serialized form reaches the model.
 * @param selected - the picked selection text.
 * @param attribution - attribution line placed inside the quote.
 * @returns the quote block (one `> `-prefixed line per selected line).
 */
export function buildQuoteSerialized(selected: string, attribution: string): string {
  const lines = selected.replace(/\r\n?/g, '\n').trim().split('\n')
  return [attribution, ...lines].map(line => `> ${line}`).join('\n')
}

/**
 * Merge an insertion into the current draft, used by the stock-harness
 * fallback (an environment without the quote attachment embeds the quote
 * block at the end of the draft instead).
 * @param current - the live draft.
 * @param insert - the block to add.
 * @returns the full next draft.
 */
export function mergeDraft(current: string, insert: string): string {
  return current.trim() === '' ? insert : `${current.trimEnd()}\n\n${insert}`
}
