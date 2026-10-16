import { COLLEGE } from '../lib/college'

/**
 * College letterhead: logo on the left, name and accreditation lines centred.
 * `variant="card"` for the login/sign-up screens, default is the page-top band.
 */
export default function CollegeHeader({ variant = 'band', className = '' }) {
  const card = variant === 'card'
  return (
    <header
      className={`${card
        ? 'rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-black/5 sm:px-8 sm:py-5'
        : 'border-b border-slate-200 bg-white px-4 py-3 sm:py-4 md:px-8 dark:border-slate-800'} ${className}`}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 sm:gap-6">
        <img
          src={COLLEGE.logo}
          alt="KNCET logo"
          className="h-14 w-auto shrink-0 select-none sm:h-[92px]"
          draggable="false"
        />
        <div className="letterhead min-w-0 flex-1 text-center text-slate-800">
          <div className="letterhead-name leading-tight font-bold text-slate-900 sm:whitespace-nowrap">
            {COLLEGE.name}
          </div>
          <div className="letterhead-line mt-0.5 font-bold tracking-wide text-slate-900">{COLLEGE.status}</div>
          <div className="letterhead-line mt-1 leading-snug text-slate-700">
            {COLLEGE.lines.map((l) => <div key={l}>{l}</div>)}
          </div>
          <div className="letterhead-line mt-1 leading-snug font-bold text-slate-900 lg:whitespace-nowrap">
            {COLLEGE.address}
          </div>
        </div>
        {/* balances the logo so the text stays truly centred */}
        <div className="hidden w-[52px] shrink-0 sm:block" aria-hidden="true" />
      </div>
    </header>
  )
}
