/** `quote` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'action.quote': '引用',
  'action.removeQuote': '移除引用',
  'toolbar.label': '引用选中的 AI 回复',
  'insert.attribution': '引用 AI 回复：',
} satisfies Record<string, string>

/** The quote namespace key union. */
export type QuoteKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The selection-quoting tooltip's copy. */
    quote: QuoteKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'action.quote': 'Quote',
  'action.removeQuote': 'Remove quote',
  'toolbar.label': 'Quote the selected AI response',
  'insert.attribution': 'Quoting the AI response:',
} satisfies Record<QuoteKey, string>
