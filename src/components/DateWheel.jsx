// A date picker made of three wheels (month, day, year) in one row, like iOS's wheel-style date picker. Safari's
// own <input type="date"> opens a calendar instead, and can't be asked for wheels, so these are drawn here:
// each wheel is a column that scrolls and snaps one row at a time, read when it comes to rest.

import { useEffect, useRef } from 'react';
import { cn } from './ui.jsx';

const ROW = 36;       // one row's height; the wheel shows five, the middle one is the choice
const SHOWN = 5;
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleString('en-GB', { month: 'long' }));

const pad = (n) => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();   // m: 0-11

function Wheel({ items, index, onChange, label, className }) {
  const el = useRef(null);
  const settle = useRef(0);
  const own = useRef(false);   // the last scroll was ours (setting the position), not a finger

  // Keep the wheel on the chosen row when the value changes from outside (or a month gets shorter).
  useEffect(() => {
    const w = el.current;
    if (!w || Math.round(w.scrollTop / ROW) === index) return;
    own.current = true;
    w.scrollTop = index * ROW;
  }, [index, items.length]);

  function onScroll() {
    if (own.current) { own.current = false; return; }
    clearTimeout(settle.current);
    // read the row once the wheel has stopped (scroll-snap has put it on a row by then)
    settle.current = setTimeout(() => {
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.current.scrollTop / ROW)));
      if (i !== index) onChange(i);
    }, 120);
  }

  return (
    <div
      ref={el}
      role="listbox"
      aria-label={label}
      onScroll={onScroll}
      className={cn('wheel relative h-[180px] snap-y snap-mandatory overflow-y-auto overscroll-contain', className)}
      style={{ paddingBlock: ((SHOWN - 1) / 2) * ROW }}
    >
      {items.map((t, i) => (
        <div
          key={t}
          role="option"
          aria-selected={i === index}
          onClick={() => { el.current.scrollTo({ top: i * ROW, behavior: 'smooth' }); }}
          className={cn(
            'flex h-9 snap-center items-center justify-center text-title tabular transition-colors',
            i === index ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {t}
        </div>
      ))}
    </div>
  );
}

/** value: 'YYYY-MM-DD' or ''; onChange gets 'YYYY-MM-DD'. Shows `fallback` (a Date) while there's no value. */
export function DateWheel({ value, onChange, fallback = new Date(), years = 3 }) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  const y = m ? +m[1] : fallback.getFullYear();
  const mo = m ? +m[2] - 1 : fallback.getMonth();
  const d = m ? +m[3] : fallback.getDate();

  const first = Math.min(y, new Date().getFullYear());
  const yearList = Array.from({ length: years }, (_, i) => String(first + i));
  const dayList = Array.from({ length: daysIn(y, mo) }, (_, i) => String(i + 1));

  // Changing the month or year keeps the day, unless the new month is shorter (31 January → 28 February).
  const set = (ny, nm, nd) => onChange(ny + '-' + pad(nm + 1) + '-' + pad(Math.min(nd, daysIn(ny, nm))));

  return (
    <div className="relative flex rounded-control bg-fill-1 px-2">
      {/* the band behind the chosen row */}
      <div className="pointer-events-none absolute inset-x-2 top-1/2 h-9 -translate-y-1/2 rounded-chip bg-fill-2" />
      <Wheel label="Month" items={MONTHS} index={mo} onChange={(i) => set(y, i, d)} className="flex-[1.6]" />
      <Wheel label="Day" items={dayList} index={Math.min(d, dayList.length) - 1} onChange={(i) => set(y, mo, i + 1)} className="flex-1" />
      <Wheel label="Year" items={yearList} index={Math.max(0, yearList.indexOf(String(y)))} onChange={(i) => set(+yearList[i], mo, d)} className="flex-[1.2]" />
    </div>
  );
}
