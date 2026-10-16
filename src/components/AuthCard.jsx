import CollegeHeader from './CollegeHeader'

export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <CollegeHeader variant="card" />
      </div>
      <div className="mx-auto mt-6 w-full max-w-md">
        <div className="mb-4 flex items-center justify-center gap-2.5 text-white">
          <img src="/icon.svg" alt="" className="h-9 w-9 rounded-xl ring-2 ring-white/25" />
          <span className="text-lg font-bold tracking-wide">Venue Booking Portal</span>
        </div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-blue-100">{footer}</div>}
      </div>
    </div>
  )
}
