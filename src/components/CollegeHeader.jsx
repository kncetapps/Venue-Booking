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
        ? 'rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-black/5 sm:px-6'
        : 'border-b border-slate-200 bg-white px-4 py-3 sm:py-4 md:px-8 dark:border-slate-800'} ${className}`}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 sm:gap-5">
        <img
          src={COLLEGE.logo}
          alt="KNCET logo"
          className="h-14 w-auto shrink-0 select-none sm:h-[88px]"
          draggable="false"
        />
        <div className="min-w-0 flex-1 text-center font-serif text-slate-800">
          <div className="text-[13px] leading-tight font-bold tracking-wide text-slate-900 sm:text-lg md:text-xl">
            {COLLEGE.name}
          </div>
          <div className="mt-0.5 text-[11px] font-bold tracking-wider text-slate-900 sm:text-sm">{COLLEGE.status}</div>
          <div className="mt-0.5 space-y-px text-[10px] leading-snug text-slate-700 sm:mt-1 sm:text-[12.5px] md:text-[13.5px]">
            {COLLEGE.lines.map((l) => <div key={l}>{l}</div>)}
          </div>
          <div className="mt-1 text-[10.5px] leading-snug font-semibold text-slate-800 sm:text-[12.5px] md:text-[13.5px]">
            {COLLEGE.address}
          </div>
        </div>
        {/* balances the logo so the text stays truly centred */}
        <div className="hidden w-[50px] shrink-0 sm:block" aria-hidden="true" />
      </div>
    </header>
  )
}
