import { generatePaginationToolbar } from './pagination-toolbar.js';

export function addPreviewControls(html, liveScript = '') {
  const padding = '<style>@media screen { html { scroll-padding-top: calc(var(--toolbar-height) + 40px); } #pages-container { padding-top: calc(var(--toolbar-height) + 40px); } }</style>';
  // Treat raw-text elements and comments as opaque, just as the HTML tag helpers
  // do. Closing-tag text inside CSS/JS strings must not become an injection site.
  const tokens = /<!--[\s\S]*?-->|<(script|style|textarea|title)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>|<\/?[a-z][a-z0-9:-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
  return html.replace(tokens, (token, rawTextElement) => {
    if (rawTextElement || token.startsWith('<!--')) return token;
    if (/^<\/head\s*>$/i.test(token)) return padding + token;
    if (/^<\/body\s*>$/i.test(token)) return liveScript + generatePaginationToolbar() + token;
    return token;
  });
}
