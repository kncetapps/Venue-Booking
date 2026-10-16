import { useEffect, useId, useRef, useState } from 'react'
import { fmtTime, pad, toMinutes } from '../lib/format'

/**
 * Parse what someone types into 'HH:MM' (24h), or null.
 * Accepts: 10, 10:30, 1030, 10.30, 10 30, 2pm, 2:30 pm, 14:00, 0930
 * A bare hour 1–7 without am/pm is read as PM (no events at 1–7 AM).
 */
export function parseTime(text) {
  if (!text) return null
  let s = text.trim().toLowerCase().replace(/\s+/g, ' ')
  const mer = /(a|p)\.?\s*m?\.?$/.exec(s)?.[1]
  s = s.replace(/(a|p)\.?\s*m?\.?$/, '').trim()
  let h, m
  let mm = /^(\d{1,2})[:.\s](\d{1,2})$/.exec(s)
  if (mm) { h = +mm[1]; m = +mm[2] }
  else if ((mm = /^(\d{3,4})$/.exec(s))) { h = +s.slice(0, -2); m = +s.slice(-2) }
  else if ((mm = /^(\d{1,2})$/.exec(s))) { h = +mm[1]; m = 0 }
  else return null
  if (m > 59 || h > 23) return null
  if (mer) {
    if (h < 1 || h > 12) return null
    if (mer === 'p' && h !== 12) h += 12
    if (mer === 'a' && h === 12) h = 0
  } else if (h >= 1 && h <= 7) {
    h += 12
  }
  return `${pad(h)}:${pad(m)}`
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function Dial({ values, selected, onPick, format }) {
  const R = 42 // % radius
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[260px] rounded-full bg-slate-100 dark:bg-slate-800">
      <span className="absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-700" />
      {selected != null && (() => {
        const i = values.indexOf(selected)
        if (i < 0) return null
        const angle = i * 30
        return (
          <span className="absolute top-1/2 left-1/2 h-[42%] w-0.5 origin-bottom -translate-x-1/2 bg-brand-700"
            style={{ transform: `translate(-50%, -100%) rotate(${angle}deg)` }} />
        )
      })()}
      {values.map((v, i) => {
        const a = (i * 30 - 90) * (Math.PI / 180)
        const on = v === selected
        return (
          <button
            key={v}
            type="button"
            onClick={() => onPick(v)}
            className={`absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[15px] font-semibold transition
              ${on ? 'bg-brand-700 text-white shadow' : 'hover:bg-white dark:hover:bg-slate-700'}`}
            style={{ left: `${50 + R * Math.cos(a)}%`, top: `${50 + R * Math.sin(a)}%` }}
          >
            {format(v)}
          </button>
        )
      })}
    </div>
  )
}

function ClockDialog({ initial, min, max, onCancel, onOk }) {
  const start = initial || min || '09:00'
  const [h24, setH24] = useState(() => toMinutes(start) / 60 | 0)
  const [m, setM] = useState(() => toMinutes(start) % 60)
  const [stage, setStage] = useState('hour')
  const pm = h24 >= 12
  const h12 = ((h24 + 11) % 12) + 1
  const value = `${pad(h24)}:${pad(m)}`
  const outOfRange = (min && toMinutes(value) < toMinutes(min)) || (max && toMinutes(value) > toMinutes(max))

  // College hours: 8–11 are mornings, 12 and 1–7 are afternoons (AM/PM can still be switched)
  const setHour12 = (h) => {
    setH24(h >= 8 && h <= 11 ? h : (h % 12) + 12)
    setStage('minute')
  }
  const setMeridiem = (toPm) => setH24((h) => (toPm ? (h % 12) + 12 : h % 12))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onCancel}>
      <div className="card w-full max-w-xs space-y-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose time">
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => setStage('hour')}
            className={`rounded-xl px-3 py-1 text-4xl font-bold tabular-nums ${stage === 'hour' ? 'bg-brand-100 text-brand-700 dark:bg-brand-800 dark:text-white' : ''}`}>{pad(h12)}</button>
          <span className="text-4xl font-bold">:</span>
          <button type="button" onClick={() => setStage('minute')}
            className={`rounded-xl px-3 py-1 text-4xl font-bold tabular-nums ${stage === 'minute' ? 'bg-brand-100 text-brand-700 dark:bg-brand-800 dark:text-white' : ''}`}>{pad(m)}</button>
          <div className="ml-2 flex flex-col gap-1">
            {['AM', 'PM'].map((x) => {
              const on = (x === 'PM') === pm
              return (
                <button key={x} type="button" onClick={() => setMeridiem(x === 'PM')}
                  className={`rounded-lg px-2 py-0.5 text-sm font-bold ${on ? 'bg-brand-700 text-white' : 'text-slate-500 ring-1 ring-slate-300 dark:ring-slate-700'}`}>{x}</button>
              )
            })}
          </div>
        </div>

        <div className="text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {stage === 'hour' ? 'Tap the hour' : 'Tap the minutes'}
        </div>

        {stage === 'hour'
          ? <Dial values={HOURS} selected={h12} onPick={setHour12} format={(v) => v} />
          : <Dial values={MINUTES} selected={MINUTES.includes(m) ? m : null} onPick={setM} format={(v) => pad(v)} />}

        {outOfRange && (
          <p className="text-center text-sm text-rose-600">Bookings are allowed {fmtTime(min)} – {fmtTime(max)}.</p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-primary" disabled={outOfRange} onClick={() => onOk(value)}>OK</button>
        </div>
      </div>
    </div>
  )
}

/**
 * Time field: type a time ("10:30", "2pm", "1430") or open the clock to choose it.
 * value/onChange use 'HH:MM' (24h). min/max limit the allowed range.
 */
export default function TimePicker({ id, value, onChange, min, max, disabled, placeholder = 'e.g. 10:30 AM' }) {
  const autoId = useId()
  const inputId = id || autoId
  const [text, setText] = useState(value ? fmtTime(value) : '')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) { setText(value ? fmtTime(value) : ''); setError('') }
  }, [value])

  const commit = () => {
    focused.current = false
    if (!text.trim()) { setError(''); onChange(''); return }
    const t = parseTime(text)
    if (!t) { setError('Type a time like 10:30 AM or 2 PM'); return }
    if ((min && toMinutes(t) < toMinutes(min)) || (max && toMinutes(t) > toMinutes(max))) {
      setError(`Allowed between ${fmtTime(min)} and ${fmtTime(max)}`)
      return
    }
    setError('')
    setText(fmtTime(t))
    onChange(t)
  }

  return (
    <div>
      <div className="relative">
        <input
          id={inputId}
          className={`input pr-12 ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''}`}
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          inputMode="text"
          autoComplete="off"
          onFocus={() => { focused.current = true }}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50 disabled:opacity-40 dark:text-blue-300 dark:hover:bg-slate-800"
          aria-label="Open clock"
          title="Choose on clock"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {open && (
        <ClockDialog
          initial={value}
          min={min}
          max={max}
          onCancel={() => setOpen(false)}
          onOk={(t) => { setOpen(false); setError(''); setText(fmtTime(t)); onChange(t) }}
        />
      )}
    </div>
  )
}

