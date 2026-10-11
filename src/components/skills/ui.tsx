import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Copy, Info } from 'lucide-react';
import { TYPE_INFO, tint, typeInfo } from './navModel';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, cx } from './uiStyles';

/** A collapsed-by-default section; the core of progressive disclosure. */
export function Disclosure({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 py-3 text-left text-ui-sm font-semibold text-foreground hover:text-primary transition-colors"
      >
        <span className="flex-1">
          {title}
          {count !== undefined && <span className="ml-1.5 font-normal text-muted-foreground">{count}</span>}
        </span>
        <ChevronDown className={cx('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="pb-4 animate-fade-in">{children}</div>}
    </div>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const info = typeInfo(type);
  return (
    <span
      className="sn-tint inline-flex items-center px-2 py-0.5 rounded-full text-ui-2xs font-semibold whitespace-nowrap"
      style={tint(info.color)}
      title={info.meaning}
    >
      {info.label}
    </span>
  );
}

export function NewBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-ui-2xs font-semibold uppercase tracking-wide bg-primary/15 text-primary">
      New
    </span>
  );
}

export function CopyButton({
  text,
  label = 'Copy prompt',
  variant = 'primary',
  className,
}: {
  text: string;
  label?: string;
  variant?: 'primary' | 'secondary' | 'icon';
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {});
  };
  const Icon = copied ? Check : Copy;
  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={copy}
        title={copied ? 'Copied' : label}
        aria-label={label}
        className={cx(
          'p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-secondary transition-colors',
          className
        )}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  }
  return (
    <button type="button" onClick={copy} className={cx(variant === 'primary' ? BTN_PRIMARY : BTN_SECONDARY, className)}>
      <Icon className="w-4 h-4" />
      {copied ? 'Copied' : label}
    </button>
  );
}

/** Small popover anchored to a trigger; closes on outside click and Escape. */
export function Popover({
  trigger,
  label,
  align = 'left',
  children,
}: {
  trigger: ReactNode;
  label: string;
  align?: 'left' | 'right';
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        className={BTN_GHOST}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cx(
            'absolute z-30 mt-1 w-72 rounded-xl border border-border bg-popover p-3 shadow-xl animate-fade-in',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function Legend() {
  return (
    <Popover
      label="What do the colors mean?"
      trigger={
        <>
          <Info className="w-4 h-4" />
          <span>What do the colors mean?</span>
        </>
      }
    >
      {() => (
        <ul className="space-y-2.5">
          {Object.entries(TYPE_INFO).map(([key, info]) => (
            <li key={key} className="flex gap-2.5">
              <span className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: info.color }} />
              <span className="text-ui-sm">
                <span className="font-semibold text-foreground">{info.label}</span>
                <span className="text-muted-foreground"> · {info.meaning}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

/** Renders trusted HTML authored in the template repo. */
export function Html({ html, className }: { html: string; className?: string }) {
  return <div className={cx('sn-prose', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}
