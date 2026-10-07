import MarkdownIt from 'markdown-it';
import attrsPlugin from 'markdown-it-attrs';
import imageRule from 'markdown-it/lib/rules_inline/image.mjs';
import htmlRule from 'markdown-it/lib/rules_inline/html_inline.mjs';

export function encodeAssetPath(filePath) {
  return filePath.replace(/%/g, '%25').replace(/#/g, '%23').replace(/\?/g, '%3F')
    .replace(/</g, '%3C').replace(/>/g, '%3E');
}

// Record source ranges through the actual inline parser. Code spans, escapes and
// image titles keep their original spelling; only destinations are replaced.
const scanner = new MarkdownIt({ html: true });
scanner.use(attrsPlugin);
scanner.inline.ruler.at('image', (state, silent) => {
  const start = state.pos;
  if (state.src.slice(start, start + 2) !== '![') return false;
  const labelEnd = state.md.helpers.parseLinkLabel(state, start + 1, false);
  if (!imageRule(state, silent)) return false;
  if (silent || state.src !== state.env.source || state.src[labelEnd + 1] !== '(') return true;
  let from = labelEnd + 2;
  while (/\s/.test(state.src[from] || '') && from < state.pos) from++;
  const destination = state.md.helpers.parseLinkDestination(state.src, from, state.posMax);
  const target = state.env.resolve(destination.str);
  if (target !== destination.str) state.env.edits.push({ from, to: destination.pos, text: `<${target}>` });
  return true;
});
scanner.inline.ruler.at('html_inline', (state, silent) => {
  const from = state.pos;
  if (!htmlRule(state, silent)) return false;
  if (!silent && state.src === state.env.source) {
    const original = state.src.slice(from, state.pos);
    const text = original.replace(/(<img\b[^>]*?\ssrc\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
      (full, before, double, single, bare) => {
        const target = state.env.resolve(state.md.utils.unescapeAll(double ?? single ?? bare));
        return `${before}"${state.md.utils.escapeHtml(target)}"`;
      });
    if (text !== original) state.env.edits.push({ from, to: state.pos, text });
  }
  return true;
});

export function rewriteImageDestinations(source, resolve) {
  const env = { source, resolve, edits: [] };
  scanner.inline.parse(source, scanner, env, []);
  let result = source;
  for (const edit of env.edits.sort((a, b) => b.from - a.from)) {
    result = result.slice(0, edit.from) + edit.text + result.slice(edit.to);
  }
  return result;
}

export function isStandaloneImage(source) {
  const parsed = scanner.parse(source, { source, resolve: value => value, edits: [] });
  if (parsed[0]?.type !== 'paragraph_open') return false;
  const tokens = parsed[1].children;
  return tokens[0]?.type === 'image' && tokens.slice(1).every(token => token.type === 'text' && !token.content);
}
