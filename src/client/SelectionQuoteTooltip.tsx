/**
 * The selection-quoting surface: a floating toolbar over a text selection in
 * an assistant message plus the composer quote banner. Registered as the
 * `quote` entry of the `conversation.input.dock` list, so it mounts once per
 * session inside the conversation scrollport and receives the input-zone
 * owner currency plus the standard session kit.
 *
 * Selecting text inside an assistant row (`data-chat-flow-kind="assistant-step"`)
 * shows one 引用 button above the selection — always above, clamped to the
 * viewport margin when the selection sits at the very top. The show is
 * debounced by 50ms so the toolbar never flashes mid-drag; any selection
 * change restarts the delay, and a collapsed or unquotable selection cancels
 * it. Clicking 引用 attaches the selection as a quote banner above the
 * composer card in the queue-panel look — a quote glyph, the quoted text,
 * and a remove button — without touching the draft. The banner
 * rides the input machine's `quote` attachment (`inputActions.setQuote`), and
 * the conversation sink prepends the serialized blockquote to the outgoing
 * message at submit, so the model sees what the user refers to while the
 * composer text stays clean.
 *
 * Environments whose input machine predates the `quote` attachment (the
 * published `ui-conversation` rc line without `setQuote`) degrade gracefully:
 * the banner is absent and the button embeds the quote block at the end of
 * the draft instead.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { IconCloseOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-conversation SlotMap + SessionStandardProps merges
// (the 'conversation.input.dock' seat, useInput, inputActions).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls this package's LocaleNamespaceMap merge (the 'quote' seat).
import type {} from './locales.ts'
import type { QuotePick } from './quote.ts'
import { buildQuoteSerialized, mergeDraft, pickAssistantSelection, rectVisible } from './quote.ts'
import css from './SelectionQuoteTooltip.module.css'

/** Full props of the quote dock entry: the input-zone owner currency, the standard kit, and the locale seat. */
export type SelectionQuoteTooltipProps =
  PropsRuntime<'conversation.input.dock'>
  & PropsLocale<'quote'>

/**
 * The input-machine quote attachment shape this plugin writes. Declared
 * locally (not imported) because the published ui-conversation rc line
 * predates the extension; the runtime boundary is feature-detected, never
 * assumed.
 */
interface DraftQuoteAttachment {
  /** Display text for the composer banner (CSS truncates). */
  readonly text: string
  /** Markdown block prepended to the outgoing message at submit. */
  readonly serialized: string
}

/** The dock owner's input snapshot widened by the optional attachment. */
type DockInput = PropsRuntime<'conversation.input.dock'>['input'] & {
  quote?: DraftQuoteAttachment | null
}

/** The standard action face widened by the optional attachment write. */
type DockActions = PropsRuntime<'conversation.input.dock'>['inputActions'] & {
  setQuote?: (quote: DraftQuoteAttachment | null) => void
}

/** A pick plus its measured viewport rect (re-measured while the toolbar floats). */
interface ActivePick extends QuotePick {
  readonly rect: DOMRect
}

/** Toolbar placement in viewport coordinates. */
interface ToolbarPos {
  readonly left: number
  readonly top: number
}

const GAP = 8
const EDGE_MARGIN = 8
/** Debounce before the toolbar appears; every selection change restarts it. */
const SHOW_DELAY_MS = 50

function sameRange(a: Range, b: Range): boolean {
  return a.startContainer === b.startContainer && a.startOffset === b.startOffset
    && a.endContainer === b.endContainer && a.endOffset === b.endOffset
}

function sameRect(a: DOMRect, b: DOMRect): boolean {
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height
}

/** Clamp a value into [min, max] with a degenerate max collapsing to min. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/**
 * One session's quoting surface.
 * @param props - the input-zone owner currency (`input.draft`/`input.quote`),
 * the standard `inputActions` write face, and the quote-namespace translator.
 * @returns a pointer-inert full-viewport layer hosting the selection toolbar
 * plus the composer quote banner.
 */
export function SelectionQuoteTooltip({ input, inputActions, t }: SelectionQuoteTooltipProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const tipRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState<ActivePick | null>(null)
  const [pos, setPos] = useState<ToolbarPos | null>(null)

  // The runtime boundary: the published input machine may predate the quote
  // attachment, so support is detected once per mount, never assumed.
  const actions = inputActions as DockActions
  const inputState = input as DockInput
  const quoteSupported = typeof actions.setQuote === 'function'
  const setQuote = actions.setQuote

  // All event handlers read and write through this ref; the state copy exists
  // only to drive renders. Keeps handler closures dependency-free.
  const activeRef = useRef<ActivePick | null>(null)

  // The debounced show: `pendingRef` holds the latest evaluated pick and the
  // timer restarts on every selection change, so the toolbar only appears
  // once selection activity has settled for SHOW_DELAY_MS.
  const pendingRef = useRef<ActivePick | null>(null)
  const showTimerRef = useRef<number | null>(null)

  const commit = useCallback((next: ActivePick | null) => {
    activeRef.current = next
    setActive(prev => {
      if (next === null) return prev === null ? prev : null
      if (prev === null) return next
      if (prev.text === next.text && sameRange(prev.range, next.range) && sameRect(prev.rect, next.rect)) {
        return prev
      }
      return next
    })
  }, [])

  /** Cancel any pending show; the toolbar only appears through a settled selection. */
  const cancelShow = useCallback(() => {
    pendingRef.current = null
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
  }, [])

  /** Start (or restart) the delayed show for one evaluated pick. */
  const scheduleShow = useCallback((pick: ActivePick) => {
    pendingRef.current = pick
    if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current)
    showTimerRef.current = window.setTimeout(() => {
      showTimerRef.current = null
      const pending = pendingRef.current
      if (pending === null) return
      // Re-measure at show time: the selection settled, so its rect is final.
      const rect = pending.range.getBoundingClientRect()
      if (!rectVisible(rect)) {
        commit(null)
        return
      }
      commit({ text: pending.text, range: pending.range, rect })
    }, SHOW_DELAY_MS)
  }, [commit])

  /** Re-read the document selection; hide when it is gone or unquotable. */
  const evaluate = useCallback(() => {
    const host = hostRef.current?.closest('[data-conversation-scroll]') ?? null
    const picked = pickAssistantSelection(host)
    if (picked === null) {
      cancelShow()
      commit(null)
      return
    }
    const rect = picked.range.getBoundingClientRect()
    if (!rectVisible(rect)) {
      cancelShow()
      commit(null)
      return
    }
    scheduleShow({ text: picked.text, range: picked.range, rect })
  }, [cancelShow, commit, scheduleShow])

  /** Follow the active selection through scroll/resize; hide when it leaves the viewport. */
  const reposition = useCallback(() => {
    const current = activeRef.current
    if (current === null) return
    const rect = current.range.getBoundingClientRect()
    if (!rectVisible(rect) || rect.top < 0 || rect.bottom > window.innerHeight) {
      commit(null)
      return
    }
    commit({ text: current.text, range: current.range, rect })
  }, [commit])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      cancelShow()
      commit(null)
      // Escape while the composer textarea is focused clears the pending
      // quote: the banner is the thing the gesture dismisses.
      if (quoteSupported && setQuote !== undefined
        && event.target instanceof HTMLElement
        && event.target.closest('[data-input-scroll]') !== null) {
        setQuote(null)
      }
    }
    document.addEventListener('selectionchange', evaluate)
    document.addEventListener('mouseup', evaluate)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelShow()
      document.removeEventListener('selectionchange', evaluate)
      document.removeEventListener('mouseup', evaluate)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [cancelShow, commit, evaluate, quoteSupported, reposition, setQuote])

  // Place the toolbar above the active pick's rect, measured against the
  // toolbar's REAL size: the toolbar renders in the same commit (hidden until
  // positioned), so even a one-character selection centers correctly instead
  // of anchoring on a zero-size first pass.
  useLayoutEffect(() => {
    if (active === null) {
      setPos(null)
      return
    }
    const el = tipRef.current
    if (el === null) {
      setPos(null)
      return
    }
    const width = el.offsetWidth
    const height = el.offsetHeight
    const rect = active.rect
    const left = clamp(
      rect.left + rect.width / 2 - width / 2,
      EDGE_MARGIN,
      window.innerWidth - width - EDGE_MARGIN,
    )
    const top = Math.max(EDGE_MARGIN, rect.top - height - GAP)
    setPos(prev => (prev !== null && prev.left === left && prev.top === top ? prev : { left, top }))
  }, [active])

  /** Keep the document selection and focus untouched when pressing a button. */
  const keepSelection = useCallback((event: MouseEvent): void => {
    event.preventDefault()
  }, [])

  /** Attach the active selection as the composer's quote banner (or, on
   *  environments without the attachment, embed it at the end of the draft). */
  const quote = useCallback(() => {
    const pick = activeRef.current
    if (pick === null) return
    const serialized = buildQuoteSerialized(pick.text, t('insert.attribution'))
    if (quoteSupported && setQuote !== undefined) {
      setQuote({ text: pick.text, serialized })
    } else {
      inputActions.setDraft(mergeDraft(inputState.draft, `${serialized}\n\n`))
    }
    cancelShow()
    commit(null)
    // The draft is untouched on the attachment path; hand focus to the
    // composer so typing follows.
    const host = hostRef.current?.closest('[data-conversation-scroll]')
    const textarea = host?.querySelector<HTMLTextAreaElement>('[data-input-scroll] textarea')
    if (textarea === null || textarea === undefined) return
    requestAnimationFrame(() => {
      textarea.focus({ preventScroll: true })
      textarea.setSelectionRange(inputState.draft.length, inputState.draft.length)
    })
  }, [cancelShow, commit, inputActions, inputState.draft, quoteSupported, setQuote, t])

  return (
    <>
      <div ref={hostRef} className={css.layer} data-quote-tooltip-host="">
        {active !== null && (
          <div
            ref={tipRef}
            className={css.tooltip}
            style={pos === null ? { visibility: 'hidden' } : { left: pos.left, top: pos.top }}
            role="toolbar"
            aria-label={t('toolbar.label')}
          >
            <button
              type="button"
              className={css.action}
              onMouseDown={keepSelection}
              onClick={quote}
            >
              {t('action.quote')}
            </button>
          </div>
        )}
      </div>
      {quoteSupported && (inputState.quote ?? null) !== null && (
        <div className={css.dock} data-quote-banner="">
          <div className={css.panel}>
            <div className={css.row}>
              <span className={css.glyph}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
                </svg>
              </span>
              <span className={css.objective}>{inputState.quote?.text}</span>
              <div className={css.actions}>
                <button
                  type="button"
                  className={css.iconBtn}
                  aria-label={t('action.removeQuote')}
                  onClick={() => { setQuote?.(null) }}
                >
                  <IconCloseOutline16 size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
