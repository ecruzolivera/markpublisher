import MarkdownIt from 'markdown-it';
import footnotePlugin from 'markdown-it-footnote';
import deflistPlugin from 'markdown-it-deflist';
import attrsPlugin from 'markdown-it-attrs';
import anchorPlugin from 'markdown-it-anchor';
import abbrPlugin from 'markdown-it-abbr';
import subPlugin from 'markdown-it-sub';
import supPlugin from 'markdown-it-sup';

export function createMarkdownRenderer() {
  const md = new MarkdownIt({
    html: true,
    breaks: false,
    linkify: true,
    typographer: true,
    xhtmlOut: false,
  });

  md.use(footnotePlugin);
  md.use(deflistPlugin);
  md.use(attrsPlugin);
  md.use(anchorPlugin);
  md.use(abbrPlugin);
  md.use(subPlugin);
  md.use(supPlugin);

  // Keep the plugin's slug/text conventions, but leave cross-page allocation
  // to the document assembler and diagnose explicit duplicates there.
  md.core.ruler.at('anchor', state => {
    const used = new Set();
    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];
      if (token.type !== 'heading_open') continue;
      if (!token.attrGet('id')) {
        const title = anchorPlugin.defaults.getTokensText(state.tokens[i + 1].children);
        const base = anchorPlugin.defaults.slugify(title);
        let id = base;
        let suffix = 1;
        while (used.has(id)) id = `${base}-${suffix++}`;
        token.attrSet('id', id);
        if (state.env.documentScope) token.attrSet('data-mp-auto-id', base);
      }
      used.add(token.attrGet('id'));
      token.attrSet('tabindex', '-1');
    }
  });

  return md;
}

export const md = createMarkdownRenderer();

export function renderMarkdown(content, env = {}) {
  return md.render(content, env);
}
