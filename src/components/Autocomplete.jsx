import { useId, useMemo, useRef, useState } from 'react'

/**
 * Type box with suggestions: typing 2–3 letters ("inf", "me") lists matching options
 * to tap; free typing is still allowed. Options: [{ value, label, hint }].
 */
export default function Autocomplete({ value, onChange, options, placeholder, required, minChars = 1, id }) {
  const autoId = useId()
  const inputId = id || autoId
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const blurTimer = useRef()

  const matches = useMemo(() => {
    const q = (value || '').trim().toLowerCase()
    if (q.length < minChars) return options.slice(0, 12)
    return options
      .filter((o) => o.value.toLowerCase().includes(q) || (o.label || '').toLowerCase().includes(q))
      .sort((a, b) => Number(!a.value.toLowerCase().startsWith(q)) - Number(!b.value.toLowerCase().startsWith(q)))
      .slice(0, 12)
  }, [value, options, minChars])

  const pick = (o) => { onChange(o.value); setOpen(false) }

  const onKeyDown = (e) => {
    if (!open || matches.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(matches[active]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  const exact = matches.length === 1 && matches[0].value.toLowerCase() === (value || '').trim().toLowerCase()

  return (
    <div className="relative">
      <input
        id={inputId}
        className="input"
        value={value}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120) }}
        onKeyDown={onKeyDown}
      />
      {open && matches.length > 0 && !exact && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {matches.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                className={`flex w-full items-baseline gap-2 px-3.5 py-2.5 text-left text-[15px] ${i === active ? 'bg-brand-50 dark:bg-slate-800' : ''}`}
              >
                <span className="font-semibold">{o.value}</span>
                {o.label && o.label !== o.value && <span className="truncate text-sm text-slate-500">{o.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
