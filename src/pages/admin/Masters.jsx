import { useCallback, useEffect, useState } from 'react'
import { friendlyError, supabase } from '../../lib/supabase'

// Distinct colours offered for halls; a new hall gets the first one not already in use
const PALETTE = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#9333ea']

const CONFIG = {
  venues: {
    label: 'Halls',
    singular: 'hall',
    fields: [
      { key: 'name', label: 'Hall name', required: true, placeholder: 'e.g. Seminar Hall 5' },
      { key: 'location', label: 'Floor / location', placeholder: 'e.g. Second Floor' },
      { key: 'capacity', label: 'Seats', type: 'number', placeholder: 'optional' },
      { key: 'facilities', label: 'Facilities', placeholder: 'Projector, AC, mic…' },
      { key: 'color', label: 'Colour', type: 'color' },
    ],
    title: (r) => r.name,
    subtitle: (r) => [r.location, r.capacity && `${r.capacity} seats`, r.facilities].filter(Boolean).join(' · '),
  },
  departments: {
    label: 'Departments',
    singular: 'department',
    fields: [
      { key: 'short_name', label: 'Code', required: true, placeholder: 'e.g. IT' },
      { key: 'full_name', label: 'Full name', required: true, placeholder: 'e.g. Information Technology' },
    ],
    title: (r) => r.short_name,
    subtitle: (r) => r.full_name,
  },
  event_types: {
    label: 'Event types',
    singular: 'event type',
    fields: [{ key: 'name', label: 'Event type', required: true, placeholder: 'e.g. Guest Lecture' }],
    title: (r) => r.name,
    subtitle: () => '',
  },
}

function Editor({ table, row, rows, onClose, onSaved }) {
  const cfg = CONFIG[table]
  const isNew = !row.id
  const [form, setForm] = useState(() => {
    const f = {}
    for (const fld of cfg.fields) f[fld.key] = row[fld.key] ?? ''
    if (table === 'venues' && isNew) {
      const used = new Set(rows.map((r) => r.color))
      f.color = PALETTE.find((c) => !used.has(c)) || PALETTE[rows.length % PALETTE.length]
    }
    return f
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    const patch = {}
    for (const fld of cfg.fields) {
      const v = typeof form[fld.key] === 'string' ? form[fld.key].trim() : form[fld.key]
      patch[fld.key] = fld.type === 'number' ? (v === '' ? null : Number(v)) : (v === '' ? null : v)
    }
    if (isNew) patch.sort_order = Math.max(0, ...rows.filter((r) => r.sort_order < 99).map((r) => r.sort_order)) + 1
    const q = isNew ? supabase.from(table).insert(patch) : supabase.from(table).update(patch).eq('id', row.id)
    const { error } = await q
    setBusy(false)
    if (error) {
      return setError(error.code === '23505' ? `A ${cfg.singular} with that name already exists.` : friendlyError(error))
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="card w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold">{isNew ? `Add ${cfg.singular}` : `Edit ${cfg.singular}`}</h2>
        {error && <div className="alert-error">{error}</div>}
        {cfg.fields.map((fld) => (
          <div key={fld.key}>
            <label className="label" htmlFor={fld.key}>{fld.label}</label>
            {fld.type === 'color' ? (
              <div className="flex flex-wrap items-center gap-2">
                {PALETTE.map((c) => (
                  <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`h-8 w-8 rounded-full ring-offset-2 dark:ring-offset-slate-900 ${form.color === c ? 'ring-2 ring-slate-900 dark:ring-white' : ''}`}
                    style={{ background: c }} aria-label={c} />
                ))}
                <input id="color" type="color" value={form.color || '#2563eb'} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-transparent" title="Custom colour" />
              </div>
            ) : (
              <input
                id={fld.key}
                className="input"
                type={fld.type === 'number' ? 'number' : 'text'}
                min={fld.type === 'number' ? 1 : undefined}
                value={form[fld.key]}
                onChange={(e) => setForm((f) => ({ ...f, [fld.key]: e.target.value }))}
                required={fld.required}
                placeholder={fld.placeholder}
                autoFocus={fld === cfg.fields[0]}
              />
            )}
          </div>
        ))}
        {!isNew && table === 'departments' && (
          <p className="text-xs text-slate-500">Changing a code doesn't rename it on existing bookings or profiles.</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  )
}

export default function Masters() {
  const [table, setTable] = useState('venues')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const cfg = CONFIG[table]

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from(table).select('*').order('active', { ascending: false }).order('sort_order').order('id')
    setLoading(false)
    if (error) return setError(friendlyError(error))
    setRows(data || [])
  }, [table])

  useEffect(() => { setError(''); load() }, [load])

  const update = async (id, patch) => {
    setError('')
    const { error } = await supabase.from(table).update(patch).eq('id', id)
    if (error) return setError(friendlyError(error))
    load()
  }

  const active = rows.filter((r) => r.active)
  const inactive = rows.filter((r) => !r.active)

  const move = async (i, dir) => {
    const a = active[i], b = active[i + dir]
    if (!a || !b) return
    // give every active row a clean sequence, then swap the two
    const order = active.map((r) => r.id)
    ;[order[i], order[i + dir]] = [order[i + dir], order[i]]
    setRows((rs) => {
      const byId = Object.fromEntries(rs.map((r) => [r.id, r]))
      return [...order.map((id, k) => ({ ...byId[id], sort_order: k + 1 })), ...inactive]
    })
    await Promise.all(order.map((id, k) => supabase.from(table).update({ sort_order: k + 1 }).eq('id', id)))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Masters</h1>
          <p className="text-slate-500">Lists used in sign-up, the booking form and the calendar. Changes show up everywhere straight away.</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({})}>+ Add {cfg.singular}</button>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-200/70 p-1 sm:w-fit dark:bg-slate-800">
        {Object.entries(CONFIG).map(([key, c]) => (
          <button key={key} onClick={() => setTable(key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold sm:flex-none ${table === key ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-600 dark:text-slate-400'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading ? <div className="text-slate-500">Loading…</div> : (
        <>
          <div className="card divide-y divide-slate-100 p-0 dark:divide-slate-800">
            {active.length === 0 && <div className="p-4 text-slate-500">Nothing yet.</div>}
            {active.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-col">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1 leading-none text-slate-400 disabled:opacity-20 hover:text-slate-900 dark:hover:text-white" aria-label="Move up">▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === active.length - 1} className="px-1 leading-none text-slate-400 disabled:opacity-20 hover:text-slate-900 dark:hover:text-white" aria-label="Move down">▼</button>
                </div>
                {table === 'venues' && <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: r.color }} />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{cfg.title(r)}</div>
                  {cfg.subtitle(r) && <div className="truncate text-sm text-slate-500">{cfg.subtitle(r)}</div>}
                </div>
                <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setEditing(r)}>Edit</button>
                <button className="btn-ghost px-3 py-1.5 text-sm text-rose-700 dark:text-rose-300" onClick={() => update(r.id, { active: false })}>Remove</button>
              </div>
            ))}
          </div>

          {inactive.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-500">Removed — hidden from forms and the calendar filter; past bookings keep their name</h2>
              <div className="card divide-y divide-slate-100 p-0 opacity-75 dark:divide-slate-800">
                {inactive.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                    {table === 'venues' && <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: r.color }} />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold line-through decoration-slate-400">{cfg.title(r)}</div>
                      {cfg.subtitle(r) && <div className="truncate text-sm text-slate-500">{cfg.subtitle(r)}</div>}
                    </div>
                    <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => update(r.id, { active: true, sort_order: active.length + 1 })}>Restore</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {editing && (
        <Editor table={table} row={editing} rows={rows} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
    </div>
  )
}
