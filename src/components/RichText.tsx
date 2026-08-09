/* Renders authored content strings.

   The library mixes two conventions, because it was written by hand over
   time: note text uses `**bold**` / `*italic*`, while zone-quiz text uses a
   little inline HTML (<b>, <i>, <br>, and the occasional table).

   Both are first-party static content, but it still runs through a tag
   allowlist rather than straight into innerHTML — that way a future content
   edit can never turn into a script injection. */

import { useMemo } from 'react';
import { cx } from '@/lib/utils';

const ALLOWED_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  'br',
  'sub',
  'sup',
  'code',
  'span',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'ul',
  'ol',
  'li',
  'p',
]);

/* Content is hand-authored JSON, so a field can turn out to be an array of
   steps rather than a string. Coerce instead of throwing — a rendering glitch
   beats a blank screen. */
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(asText).join('\n\n');
  if (value == null) return '';
  return String(value);
}

/** Strip every tag not on the allowlist, and every attribute without exception. */
function sanitize(input: string): string {
  const html = asText(input);
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, rawTag: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    return match.startsWith('</') ? `</${tag}>` : `<${tag}>`;
  });
}

/** `**bold**` and `*italic*` -> real tags. Escapes everything else first. */
function markish(input: string): string {
  const source = asText(input);
  const escaped = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(?!\s)(.+?)(?<!\s)\*/g, '$1<em>$2</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

interface Props {
  children: string;
  /** `markdown` for note prose, `html` for authored inline markup. */
  format?: 'markdown' | 'html';
  as?: 'p' | 'div' | 'span';
  className?: string;
}

export function RichText({ children, format = 'markdown', as: Tag = 'p', className }: Props) {
  const html = useMemo(
    () => (format === 'markdown' ? markish(children) : sanitize(children)),
    [children, format],
  );
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Multi-paragraph prose: blank lines become separate paragraphs. */
export function Prose({ text, className }: { text: string; className?: string }) {
  const paragraphs = useMemo(
    () =>
      asText(text)
        .split(/\n{2,}/)
        .filter((p) => p.trim()),
    [text],
  );
  return (
    <div className={cx('prose-quill', className)}>
      {paragraphs.map((p, i) => (
        <RichText key={i}>{p}</RichText>
      ))}
    </div>
  );
}
