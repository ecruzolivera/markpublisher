import { createMarkdownRenderer } from './markdown.js';

const blockParser = createMarkdownRenderer();

// The Markdown block parser owns fence length, indentation, list and quote
// context. Its source maps let every preprocessing pass preserve literal code.
export function findCodeLines(lines) {
  const codeLines = new Set();
  const tokens = [];
  blockParser.block.parse(lines.join('\n'), blockParser, {}, tokens);
  for (const token of tokens) {
    if (!['fence', 'code_block'].includes(token.type)) continue;
    for (let line = token.map[0]; line < token.map[1]; line++) codeLines.add(line);
  }
  return codeLines;
}
