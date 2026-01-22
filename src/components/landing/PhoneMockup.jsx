/**
 * PhoneMockup - iPhone-style frame for screenshot placeholders
 *
 * Props:
 * - screenshot: URL to screenshot image (optional)
 * - label: Placeholder label text (default: "Screenshot")
 * - className: Additional CSS classes
 */
export default function PhoneMockup({
  screenshot = null,
  label = "Screenshot",
  className = ""
}) {
  return (
    <div className={`relative mx-auto ${className}`}>
      {/* Phone frame */}
      <div className="relative w-[280px] h-[580px] bg-landing-bg-secondary rounded-[3rem] border-4 border-landing-border shadow-2xl overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-landing-bg rounded-b-2xl z-10" />

        {/* Dynamic Island (small pill) */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-20" />

        {/* Screen content */}
        <div className="absolute inset-3 top-4 bg-gradient-to-br from-slate-100 to-slate-200 rounded-[2.25rem] overflow-hidden">
          {screenshot ? (
            <img
              src={screenshot}
              alt={label}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
              {/* Placeholder content - mimics app UI */}
              <div className="w-full space-y-3">
                <div className="h-3 bg-slate-300 rounded w-3/4 mx-auto" />
                <div className="h-2 bg-slate-200 rounded w-1/2 mx-auto" />
              </div>
              <div className="mt-8 px-4 py-2 bg-slate-300/50 rounded-lg">
                <span className="text-slate-500 text-xs font-body uppercase tracking-wide">
                  {label}
                </span>
              </div>
              <div className="mt-8 w-full space-y-2">
                <div className="h-2 bg-slate-200 rounded w-full" />
                <div className="h-2 bg-slate-200 rounded w-5/6" />
                <div className="h-2 bg-slate-200 rounded w-4/6" />
              </div>
            </div>
          )}
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-landing-border rounded-full" />
      </div>
    </div>
  )
}
