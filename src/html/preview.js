import { generatePaginationToolbar } from './pagination-toolbar.js';

export function addPreviewControls(html, liveScript = '') {
  const padding = '<style>@media screen { html { scroll-padding-top: calc(var(--toolbar-height) + 40px); } #pages-container { padding-top: calc(var(--toolbar-height) + 40px); } }</style>';
  return html.replace('</head>', padding + '</head>')
    .replace('</body>', liveScript + generatePaginationToolbar() + '</body>');
}
