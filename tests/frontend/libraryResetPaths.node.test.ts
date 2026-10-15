// Node tests for library-lint (D-183): the six Library sites that copied props
// into state inside a useEffect now reset during render with React's "store the
// previous prop in state" pattern, keyed on the same props the effect listed,
// and never through a `key` remount, so the drawer's AnimatePresence exit and
// the dialog's Modal wrapper are unchanged.
//
// Run: node --experimental-strip-types --test tests/frontend/libraryResetPaths.node.test.ts
//
// There is no render harness for the Library components (they need the Library
// model and actions), so these checks are static, as in genieDefaultSession.node.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const LIB = new URL('../../src/components/library/', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, LIB), 'utf-8');

/** The brace-balanced body that follows `head` in `source` (head ends with `{`). */
function bracedBody(source: string, head: string, from = 0): string {
  const start = source.indexOf(head, from);
  assert.ok(start >= 0, `found ${head}`);
  let depth = 0;
  for (let i = start + head.length - 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start + head.length, i);
  }
  throw new Error(`unbalanced braces after ${head}`);
}

/** A component's body: from its signature's `) {` to the matching close brace. */
function componentBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `found ${signature}`);
  return bracedBody(source, ') {', source.indexOf(') {\n', start));
}

/** Every `useEffect(...)` call in `body`, paren-balanced. */
function effects(body: string): string[] {
  const out: string[] = [];
  let at = body.indexOf('useEffect(');
  while (at >= 0) {
    let depth = 0;
    let end = at + 'useEffect'.length;
    for (; end < body.length; end++) {
      if (body[end] === '(') depth++;
      else if (body[end] === ')' && --depth === 0) break;
    }
    out.push(body.slice(at, end + 1));
    at = body.indexOf('useEffect(', end);
  }
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Site { file: string; signature: string; keys: string[]; setters: string[] }

const SITES: Site[] = [
  { file: 'CollectionDialog.tsx', signature: 'export function CollectionDialog(', keys: ['open', 'initial', 'initialKind'], setters: ['setDraft'] },
  { file: 'CollectionPage.tsx', signature: 'function InlineText(', keys: ['value', 'editing'], setters: ['setDraft'] },
  { file: 'CollectionPage.tsx', signature: 'export function CollectionPage(', keys: ['collection.collection_id'], setters: ['setSelected', 'setExtraCats', 'setQuery', 'setFilter'] },
  { file: 'UseCaseDrawer.tsx', signature: 'export function UseCaseDrawer(', keys: ['key'], setters: ['setTab', 'setConfirmDelete', 'setDeleteText'] },
  { file: 'UseCaseDrawer.tsx', signature: 'function TitleEditor(', keys: ['value'], setters: ['setDraft'] },
  { file: 'UseCaseDrawer.tsx', signature: 'function PlacementTab(', keys: ['initial'], setters: ['setList'] },
];

for (const site of SITES) {
  const name = site.signature.replace(/^export /, '').replace(/^function /, '').replace('(', '');

  test(`${name}: no useEffect calls a state setter`, () => {
    const body = componentBody(read(site.file), site.signature);
    const setters = [...body.matchAll(/const \[\w+, (set\w+)\] = useState\b/g)].map(m => m[1]);
    for (const setter of site.setters) assert.ok(setters.includes(setter), `${name} declares ${setter}`);
    for (const effect of effects(body)) {
      for (const setter of setters) {
        assert.doesNotMatch(effect, new RegExp(`(?<![.\\w])${setter}\\(`), `${name} calls ${setter} in an effect:\n${effect}`);
      }
    }
  });

  test(`${name}: resets during render on ${site.keys.join(', ')}`, () => {
    const body = componentBody(read(site.file), site.signature);
    const guards = [...body.matchAll(/\n {2}if \(([^\n{]*\bprev\w*[^\n{]*)\) \{\n/g)];
    assert.equal(guards.length, 1, `${name} has one previous-prop guard`);
    const [head, condition] = guards[0];
    for (const key of site.keys) {
      assert.match(condition, new RegExp(`\\bprev\\w*(?:\\.\\w+)?\\s*!==\\s*${escape(key)}(?![\\w.])`), `${name} compares the previous ${key}`);
    }
    const block = bracedBody(body, head.trim());
    assert.match(block, /(?<![.\w])setPrev\w*\(/, `${name} stores the new previous value`);
    for (const setter of site.setters) {
      assert.match(block, new RegExp(`(?<![.\\w])${setter}\\(`), `${name} resets with ${setter}`);
    }
  });
}

test('UseCaseDrawer: the AnimatePresence exit wrapper is unchanged and carries no prop key', () => {
  const src = read('UseCaseDrawer.tsx');
  assert.ok(src.includes(`    <AnimatePresence>
      {uc && (
        <motion.div
          key="use-case-drawer"
          className="lib-root fixed inset-0 z-[900] pointer-events-none"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.26 } }}
        >
`), 'root motion.div inside AnimatePresence');
  const root = src.slice(src.indexOf('<AnimatePresence>'));
  const rootTag = root.slice(root.indexOf('<motion.div'), root.indexOf('>\n', root.indexOf('<motion.div')));
  assert.equal(rootTag.match(/\bkey=/g)?.length, 1, 'the root keeps its one static key');
  assert.ok(src.includes(`exit={{ x: '100%', pointerEvents: 'none' }}`), 'the panel still slides out');
});

test('CollectionDialog: the Modal wrapper is unchanged and carries no key', () => {
  const src = read('CollectionDialog.tsx');
  assert.ok(src.includes(`    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
`), 'Modal opening tag');
  const tag = src.slice(src.indexOf('<Modal'), src.indexOf('\n    >\n', src.indexOf('<Modal')));
  assert.doesNotMatch(tag, /\bkey=/);
  const modal = read('ui.tsx');
  assert.ok(modal.includes(`  if (!open) return null;
  return createPortal(
    <div className="lib-root fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
`), 'Modal body in ui.tsx');
});

test('ui.tsx exports only components; cx comes from the sibling module; no fixed rule is disabled', () => {
  assert.doesNotMatch(read('ui.tsx'), /export \{ cx \}/);
  assert.match(read('cx.ts'), /^export \{ cx \} from '\.\.\/skills\/uiStyles';$/m);
  for (const file of readdirSync(LIB).filter(f => /\.tsx?$/.test(f))) {
    const src = read(file);
    assert.doesNotMatch(src, /eslint-disable.*(set-state-in-effect|static-components|only-export-components)/, `${file} disables no fixed rule`);
    const fromUi = src.match(/^import \{([^}]*)\} from '\.\/ui';$/m);
    if (fromUi) assert.doesNotMatch(fromUi[1], /\bcx\b/, `${file} imports cx from ./cx`);
  }
});
