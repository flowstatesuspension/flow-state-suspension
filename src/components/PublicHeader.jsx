/**
 * The black bar at the top of both public pages.
 *
 * One component rather than two near-copies: /book and /intervals are the only
 * pages a customer ever sees, and the brand line under the title has to read
 * identically on both or it looks like two different businesses.
 *
 * The logo is sized to the text beside it rather than to a round number. 48px
 * is the title (16px at leading-none) plus its 4px gap plus two 11px lines at
 * leading-tight — so the tip of the mountain sits on the top of the heading
 * and the foot of the wordmark on the bottom of "Service". The source PNG is
 * cropped tight to the artwork, with no transparent margin to allow for.
 *
 * width and pad take the page's own content box, so the logo lines up with
 * whatever sits under it — the two pages don't use the same gutter.
 */
export default function PublicHeader({ title, width = 'max-w-xl', pad = 'px-4' }) {
  return (
    <div className="bg-black safe-top">
      <div className={`${width} ${pad} mx-auto pt-3 pb-3 flex items-center gap-3`}>
        <img src="/logo.png" alt="" className="h-12 w-auto shrink-0" />
        <div>
          <h1 className="text-white font-bold text-base leading-none tracking-tight">{title}</h1>
          <p className="text-slate-400 text-[11px] mt-1 leading-tight">
            Flow State Suspension · Edinburgh
            {/* Own line: as a sixth item on the one above it ran on and broke
                mid-list at phone width. */}
            <span className="block">Service · Repair · Tuning · Sales</span>
          </p>
        </div>
      </div>
    </div>
  )
}
