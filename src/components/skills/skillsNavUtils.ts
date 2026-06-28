/**
 * Helper functions ported from workshop-explorer.html, used by the Skills
 * Navigator React components. These operate on the trusted, static content
 * shipped in skillsNavigatorData.ts.
 */
import type { SkillNavType } from '../../constants/skillsNavigatorData';

export interface TypeColor {
  bg: string;
  fg: string;
}

const TYPE_COLOR_MAP: Record<string, TypeColor> = {
  orchestrator: { bg: 'var(--purple-dim)', fg: 'var(--purple)' },
  worker: { bg: 'var(--gold-dim)', fg: 'var(--gold)' },
  common: { bg: 'var(--green-dim)', fg: 'var(--green)' },
  entry: { bg: 'var(--cyan-dim)', fg: 'var(--cyan)' },
  platform: { bg: 'var(--blue-dim)', fg: 'var(--blue)' },
};

export function typeColor(t: SkillNavType): TypeColor {
  return TYPE_COLOR_MAP[t] || { bg: 'var(--surface2)', fg: 'var(--text-dim)' };
}

export function stripHtml(h?: string): string {
  if (!h) return '';
  return h
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Lightweight syntax highlighter (SQL / Python / TS) — returns HTML string. */
export function highlightCode(code: string): string {
  let h = escHtml(code);
  const toks: string[] = [];
  const tok = (cls: string, txt: string) => {
    const ph = '\x01' + toks.length + '\x01';
    toks.push('<span class="' + cls + '">' + txt + '</span>');
    return ph;
  };
  h = h.replace(/(--|#|\/\/)(.*)$/gm, (_m, a, b) => tok('cm', a + b));
  h = h.replace(/(@\w+[.\w]*)/g, (_m, a) => tok('dec', a));
  h = h.replace(/'([^']*?)'/g, (_m, a) => "'" + tok('str', a) + "'");
  h = h.replace(/"([^"]*?)"/g, (_m, a) => '"' + tok('str', a) + '"');
  const kws =
    /\b(SELECT|FROM|WHERE|INSERT|INTO|UPDATE|SET|DELETE|CREATE|TABLE|MERGE|USING|ON|WHEN|MATCHED|THEN|NOT|AND|OR|AS|CLUSTER|BY|AUTO|TBLPROPERTIES|ALTER|ADD|CONSTRAINT|PRIMARY KEY|FOREIGN KEY|REFERENCES|IF NOT EXISTS|DROP|import|export|const|let|var|function|return|async|await|try|catch|new|def|class|with|elif|else|if|for|in|True|False|None|COMMENT|SCHEMA|MANAGED|LOCATION|DBPROPERTIES|IDENTITY|GENERATED|ALWAYS|DEFAULT|MONITOR|SCHEDULE|CRON|QUALITY|RULES|ALERT|NOTIFY|MATERIALIZED|VIEW|RETURNS)\b/gi;
  h = h.replace(kws, (m) => tok('kw', m));
  h = h.replace(/\b(dlt|appkit|databricks|mlflow|ResponsesAgent)\b/gi, (m) => tok('fn', m));
  toks.forEach((s, i) => {
    h = h.split('\x01' + i + '\x01').join(s);
  });
  return h;
}

export interface AcadSection {
  title?: string;
  html: string;
}

/** Splits an academy module's content HTML into <h5>-delimited sections. */
export function splitAcadContent(html: string): AcadSection[] {
  const parts = html.split(/<h5>/g);
  if (parts.length <= 1) return [{ html }];
  const out: AcadSection[] = [];
  if (parts[0].trim()) out.push({ html: parts[0] });
  for (let i = 1; i < parts.length; i++) {
    const endTag = parts[i].indexOf('</h5>');
    if (endTag === -1) {
      out.push({ html: '<h5>' + parts[i] });
      continue;
    }
    const title = parts[i].substring(0, endTag);
    const body = parts[i].substring(endTag + 5);
    out.push({ title, html: body });
  }
  return out;
}
