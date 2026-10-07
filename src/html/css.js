import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { resolveReference, sourceKey } from './resources.js';

export async function rewriteCssUrls(value, rewrite) {
  const parsed = valueParser(value);
  const pending = [];
  parsed.walk(node => {
    if (node.type !== 'function' || node.value.toLowerCase() !== 'url') return;
    const reference = node.nodes.length === 1 && node.nodes[0].type === 'string'
      ? node.nodes[0].value : valueParser.stringify(node.nodes).trim();
    pending.push((async () => {
      const rewritten = await rewrite(reference);
      if (rewritten === null || rewritten === reference) return;
      node.nodes = [{ type: 'string', quote: '"', value: rewritten.replace(/\\/g, '\\\\').replace(/"/g, '\\"') }];
    })());
    return false;
  });
  await Promise.all(pending);
  return parsed.toString();
}

function parseImport(params) {
  const nodes = valueParser(params).nodes;
  let index = 0;
  const next = () => {
    while (nodes[index]?.type === 'space' || nodes[index]?.type === 'comment') index++;
    return nodes[index];
  };
  const first = next();
  if (!first) throw new Error('missing import URL');
  let reference;
  if (first.type === 'string') reference = first.value;
  else if (first.type === 'function' && first.value.toLowerCase() === 'url') {
    reference = first.nodes[0]?.type === 'string' ? first.nodes[0].value : valueParser.stringify(first.nodes).trim();
  } else throw new Error('invalid import URL');
  index++;
  const wrappers = [];
  let node = next();
  if (node?.value.toLowerCase() === 'layer') {
    wrappers.push({ name: 'layer', params: node.type === 'function' ? valueParser.stringify(node.nodes).trim() : '' });
    index++;
    node = next();
  }
  if (node?.type === 'function' && node.value.toLowerCase() === 'supports') {
    const condition = valueParser.stringify(node.nodes).trim();
    wrappers.push({ name: 'supports', params: /^(?:\(|[\w-]+\()/.test(condition) ? condition : `(${condition})` });
    index++;
  }
  const media = valueParser.stringify(nodes.slice(index)).trim();
  if (media) wrappers.push({ name: 'media', params: media });
  return { reference, wrappers };
}

export async function processCss(css, source, { rewriteReference, loadStylesheet, warnings, maxDepth = 32 }, chain = []) {
  const key = sourceKey(source);
  const root = postcss.parse(css, { from: key });
  const active = [...chain, key];
  const declarations = [];
  root.walkDecls(declaration => {
    declarations.push((async () => {
      declaration.value = await rewriteCssUrls(declaration.value, reference => rewriteReference(reference, source));
    })());
  });
  await Promise.all(declarations);
  const imports = [];
  root.walkAtRules(/^import$/i, rule => imports.push(rule));
  for (const rule of imports) {
    let parsed;
    try { parsed = parseImport(rule.params); } catch (error) {
      warnings.push(`Invalid CSS import in ${key}: ${error.message}`);
      continue;
    }
    const imported = resolveReference(parsed.reference, source);
    if (!imported) continue;
    const importedKey = sourceKey(imported);
    if (active.includes(importedKey) || active.length >= maxDepth) {
      warnings.push(`CSS import ${active.includes(importedKey) ? 'cycle' : 'depth limit'}: ${[...active, importedKey].join(' -> ')}`);
      rule.remove();
      continue;
    }
    const loaded = await loadStylesheet(imported);
    if (!loaded) continue;
    const loadedKey = sourceKey(loaded.source || imported);
    if (active.includes(loadedKey)) {
      warnings.push(`CSS import cycle: ${[...active, loadedKey].join(' -> ')}`);
      rule.remove();
      continue;
    }
    const nested = await processCss(loaded.content, loaded.source || imported,
      { rewriteReference, loadStylesheet, warnings, maxDepth }, active);
    let nodes = postcss.parse(nested).nodes;
    for (const wrapper of [...parsed.wrappers].reverse()) {
      const container = postcss.atRule(wrapper);
      container.append(nodes);
      nodes = [container];
    }
    rule.replaceWith(...nodes);
  }
  root.walkAtRules(/^charset$/i, rule => rule.remove());
  return root.toString();
}
