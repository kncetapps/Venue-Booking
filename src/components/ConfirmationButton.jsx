import { useState } from 'react'
import { downloadConfirmation } from '../lib/pdf'
import { useSettings } from '../lib/useSettings'

/** Downloads the official confirmation copy (PDF with college letterhead) for an approved booking. */
export default function ConfirmationButton({ b, className = 'btn-ghost py-2' }) {
  const settings = useSettings()
  const [busy, setBusy] = useState(false)
  if (b.status !== 'approved') return null
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try { await downloadConfirmation(b, settings) } finally { setBusy(false) }
      }}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
      {busy ? 'Preparing…' : 'Confirmation copy'}
    </button>
  )
}
