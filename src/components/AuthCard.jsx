export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <img src="/icon.svg" alt="" className="mx-auto mb-3 h-14 w-14 rounded-2xl ring-4 ring-white/20" />
          <div className="text-xs font-semibold tracking-wider text-blue-200 uppercase">Kongunadu College of Engineering and Technology</div>
          <div className="text-lg font-bold">Venue Booking</div>
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
