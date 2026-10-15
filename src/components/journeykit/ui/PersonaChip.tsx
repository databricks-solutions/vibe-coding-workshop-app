import { avatarFor } from '../art';

/** A persona as a face plus a name; the same name always gets the same face. */
export function PersonaChip({ name, role, size = 'sm' }: { name: string; role?: string; size?: 'sm' | 'md' }) {
  const px = size === 'md' ? 28 : 22;
  return (
    <span title={role} className={`inline-flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 rounded-full bg-secondary text-foreground ${size === 'md' ? 'text-ui-sm' : 'text-ui-xs'}`}>
      <img src={avatarFor(name)} alt="" width={px} height={px} className="rounded-full" style={{ width: px, height: px }} />
      {name}
    </span>
  );
}

/** Overlapping faces for a compact "who it's for" summary. */
export function PersonaStack({ names, max = 3, size = 32 }: { names: string[]; max?: number; size?: number }) {
  if (!names.length) return null;
  return (
    <div className="flex -space-x-2 shrink-0" title={names.join(', ')}>
      {names.slice(0, max).map(p => (
        <img key={p} src={avatarFor(p)} alt="" width={size} height={size} className="rounded-full ring-2 ring-card" style={{ width: size, height: size }} />
      ))}
    </div>
  );
}
