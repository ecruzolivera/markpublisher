import { escapeHtml, unescapeAll } from 'markdown-it/lib/common/utils.mjs';

export { escapeHtml };

// Skip comments and raw-text elements; quoted > characters are part of a tag.
const TAGS = /<!--[\s\S]*?-->|<(script|style|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>|<[a-z][a-z0-9:-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;

export function mapHtmlTags(html, transform) {
  return html.replace(TAGS, (tag, raw) => {
    if (raw || tag.startsWith('<!--')) return tag;
    return transform(tag, tag.match(/^<([^\s/>]+)/)[1].toLowerCase());
  });
}

export async function mapHtmlTagsAsync(html, transform) {
  const pending = [];
  mapHtmlTags(html, (tag, name) => {
    pending.push(transform(tag, name));
    return tag;
  });
  const replacements = await Promise.all(pending);
  let index = 0;
  return mapHtmlTags(html, () => replacements[index++]);
}

function attributePattern(name) {
  return new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
}

export function getAttribute(tag, name) {
  const match = tag.match(attributePattern(name));
  return match ? unescapeAll(match[1] ?? match[2] ?? match[3]) : null;
}

export function setAttribute(tag, name, value) {
  const attribute = ` ${name}="${escapeHtml(String(value))}"`;
  if (attributePattern(name).test(tag)) return tag.replace(attributePattern(name), () => attribute);
  return tag.replace(/\s*\/?>(?=$)/, ending => attribute + ending);
}

export function removeAttribute(tag, name) {
  return tag.replace(attributePattern(name), '');
}
