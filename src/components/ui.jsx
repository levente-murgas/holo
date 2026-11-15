// Holo's few building blocks, after Valet's (button, card, slider, switch, segmented control):
// fills are the ink at a strength, the accent is kept for the one thing to do.

import { Slider as SliderPrimitive, Switch as SwitchPrimitive, ToggleGroup } from 'radix-ui';

export const cn = (...c) => c.filter(Boolean).join(' ');

const VARIANT = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 font-semibold',
  tonal: 'bg-fill-1 text-foreground hover:bg-fill-2 aria-pressed:bg-fill-3',
  ghost: 'text-muted-foreground hover:bg-fill-1 hover:text-foreground',
  danger: 'bg-bad text-white hover:bg-bad/90 font-semibold',
  quiet: 'text-muted-foreground underline underline-offset-4 decoration-fill-3 hover:text-foreground',
};
const SIZE = {
  sm: 'h-8 px-3 rounded-chip text-body gap-1.5 [&_svg]:size-icon-sm',
  md: 'h-11 px-4 rounded-control text-item gap-2 [&_svg]:size-icon',
  lg: 'h-13 px-5 rounded-control text-title gap-2 [&_svg]:size-icon-lg',
  icon: 'size-10 rounded-full [&_svg]:size-icon-lg',
};

export function Button({ variant = 'tonal', size = 'md', block, className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'press inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none',
        'disabled:opacity-40 [&_svg]:shrink-0',
        VARIANT[variant], SIZE[size], block && 'w-full', className,
      )}
      {...props}
    />
  );
}

/** A small toggle chip: tonal at rest, chosen it fills a step more and its icon turns brass. */
export function Chip({ on, className, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={on === undefined ? undefined : !!on}
      className={cn(
        'press inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-body font-medium',
        '[&_svg]:size-icon-sm [&_svg]:shrink-0',
        on ? 'bg-fill-3 text-foreground [&_svg]:text-primary' : 'bg-fill-1 text-muted-foreground hover:bg-fill-2',
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }) {
  return <div className={cn('glass rounded-surface', className)} {...props} />;
}

/** A section's quiet title, then its content. */
export function Section({ title, aside, children, className }) {
  return (
    <section className={cn('space-y-2.5', className)}>
      {(title || aside) && (
        <div className="flex items-center justify-between px-1">
          <h3 className="text-meta font-medium text-muted-foreground">{title}</h3>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Segmented control: one of a few choices. options: [{ value, label, icon? }] */
export function Segmented({ value, onChange, options, className, label }) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={label}
      onValueChange={(v) => v && onChange(v)}
      className={cn('flex gap-1 rounded-control bg-fill-1 p-1', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            'press flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-4px)] px-2',
            'text-body font-medium text-muted-foreground [&_svg]:size-icon-sm [&_svg]:shrink-0',
            'data-[state=on]:bg-fill-3 data-[state=on]:text-foreground data-[state=on]:[&_svg]:text-primary',
            'data-[state=on]:shadow-[inset_0_0_0_.5px_var(--glass-stroke)]',
          )}
        >
          {o.icon}
          <span className="truncate">{o.label}</span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

/** A labelled slider with its value on the right. */
export function SliderRow({ label, value, display, min, max, step, onChange }) {
  return (
    <div className="px-3.5 py-3">
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-item">{label}</span>
        <span className="tabular text-meta text-muted-foreground">{display}</span>
      </div>
      <SliderPrimitive.Root
        value={[value]}
        min={min} max={max} step={step}
        onValueChange={([v]) => onChange(v)}
        className="relative flex h-5 w-full touch-none items-center select-none"
        aria-label={label}
      >
        <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-fill-2">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block size-5 rounded-full bg-white shadow-[0_1px_4px_rgb(0_0_0/.4),0_0_0_.5px_rgb(0_0_0/.2)] outline-none focus-visible:ring-4 focus-visible:ring-primary/30" />
      </SliderPrimitive.Root>
    </div>
  );
}

export function Switch({ checked, onCheckedChange, label }) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className="press relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-fill-2 data-[state=checked]:bg-primary"
    >
      <SwitchPrimitive.Thumb className="block size-6 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/.35)] transition-transform duration-200 data-[state=checked]:translate-x-5.5" />
    </SwitchPrimitive.Root>
  );
}

/** A row in an inset group: icon tile, title and note, something on the right. */
export function Row({ icon, title, note, children, onClick, className }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 px-3.5 py-3 text-left', onClick && 'press hover:bg-fill-1', className)}
    >
      {icon && <IconTile>{icon}</IconTile>}
      <div className="min-w-0 flex-1">
        <div className="text-item">{title}</div>
        {note && <div className="mt-0.5 text-meta text-muted-foreground">{note}</div>}
      </div>
      {children}
    </Tag>
  );
}

export function IconTile({ children, className }) {
  return (
    <span className={cn('grid size-8 shrink-0 place-items-center rounded-chip bg-fill-1 text-muted-foreground [&_svg]:size-icon', className)}>
      {children}
    </span>
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-control bg-fill-1 px-3.5 text-item text-foreground placeholder:text-muted-foreground',
        'shadow-[inset_0_0_0_1px_var(--input)] outline-none focus:shadow-[inset_0_0_0_1px_var(--primary)]',
        className,
      )}
      {...props}
    />
  );
}

/** A line of status text under a control; empty takes no room. */
export function Note({ children, className }) {
  if (!children) return null;
  return <p className={cn('px-1 text-meta text-muted-foreground', className)}>{children}</p>;
}

/** A tab's layout: scrolling content and, optionally, a footer that stays put (the one thing to do). */
export function TabBody({ children, footer }) {
  return (
    <>
      {/* only up and down: rows that scroll sideways (fonts, colours) do it inside themselves */}
      <div className="scroll min-h-0 flex-1 space-y-5 overflow-x-hidden p-4">{children}</div>
      {footer && <div className="border-t border-border p-3">{footer}</div>}
    </>
  );
}
