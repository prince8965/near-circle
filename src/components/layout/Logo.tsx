export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-secondary border border-[#334155] shadow-cyber">
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
          <circle cx="16" cy="16" r="11" fill="none" stroke="#00F2FE" strokeWidth="1.8" strokeDasharray="3 2" opacity="0.6" />
          <circle cx="16" cy="16" r="7" fill="none" stroke="#00F2FE" strokeWidth="2.4" />
          <circle cx="16" cy="16" r="2.5" fill="#00F2FE" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight text-white">
        Near<span className="text-brand">Circle</span>
      </span>
    </span>
  )
}
