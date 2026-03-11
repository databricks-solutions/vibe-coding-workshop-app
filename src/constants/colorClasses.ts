export type ColorType = 'purple' | 'green' | 'orange' | 'red' | 'blue' | 'indigo' | 'cyan' | 'pink' | 'teal' | 'amber' | 'yellow' | 'lime' | 'slate' | 'violet' | 'emerald';

export interface ColorClasses {
  bg: string;
  icon: string;
  badge: string;
  border?: string;
}

// Professional dark theme colors - subtle backgrounds with good contrast
export const colorClasses: Record<ColorType, ColorClasses> = {
  purple: {
    bg: 'bg-purple-900/40',
    icon: 'text-purple-300',
    badge: 'bg-purple-900/50 text-purple-200 border-purple-700/50',
    border: 'border-purple-700/50',
  },
  green: {
    bg: 'bg-emerald-900/40',
    icon: 'text-emerald-300',
    badge: 'bg-emerald-900/50 text-emerald-200 border-emerald-700/50',
  },
  orange: {
    bg: 'bg-orange-900/40',
    icon: 'text-orange-300',
    badge: 'bg-orange-900/50 text-orange-200 border-orange-700/50',
  },
  red: {
    bg: 'bg-red-900/40',
    icon: 'text-red-300',
    badge: 'bg-red-900/50 text-red-200 border-red-700/50',
  },
  blue: {
    bg: 'bg-blue-900/40',
    icon: 'text-blue-300',
    badge: 'bg-blue-900/50 text-blue-200 border-blue-700/50',
  },
  indigo: {
    bg: 'bg-indigo-900/40',
    icon: 'text-indigo-300',
    badge: 'bg-indigo-900/50 text-indigo-200 border-indigo-700/50',
  },
  cyan: {
    bg: 'bg-cyan-900/40',
    icon: 'text-cyan-300',
    badge: 'bg-cyan-900/50 text-cyan-200 border-cyan-700/50',
  },
  pink: {
    bg: 'bg-pink-900/40',
    icon: 'text-pink-300',
    badge: 'bg-pink-900/50 text-pink-200 border-pink-700/50',
  },
  teal: {
    bg: 'bg-teal-900/40',
    icon: 'text-teal-300',
    badge: 'bg-teal-900/50 text-teal-200 border-teal-700/50',
    border: 'border-teal-700/50',
  },
  amber: {
    bg: 'bg-amber-900/40',
    icon: 'text-amber-300',
    badge: 'bg-amber-900/50 text-amber-200 border-amber-700/50',
  },
  yellow: {
    bg: 'bg-yellow-900/40',
    icon: 'text-yellow-300',
    badge: 'bg-yellow-900/50 text-yellow-200 border-yellow-700/50',
  },
  lime: {
    bg: 'bg-lime-900/40',
    icon: 'text-lime-300',
    badge: 'bg-lime-900/50 text-lime-200 border-lime-700/50',
  },
  slate: {
    bg: 'bg-slate-800/60',
    icon: 'text-slate-300',
    badge: 'bg-slate-800/60 text-slate-200 border-slate-600/50',
  },
  violet: {
    bg: 'bg-violet-900/40',
    icon: 'text-violet-300',
    badge: 'bg-violet-900/50 text-violet-200 border-violet-700/50',
  },
  emerald: {
    bg: 'bg-emerald-900/40',
    icon: 'text-emerald-300',
    badge: 'bg-emerald-900/50 text-emerald-200 border-emerald-700/50',
    border: 'border-emerald-700/50',
  },
};
