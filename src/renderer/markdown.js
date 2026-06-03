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

  return md;
}

export const md = createMarkdownRenderer();

export function renderMarkdown(content) {
  return md.render(content);
}
