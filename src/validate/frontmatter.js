const ALLOWED_KEYS = ['title', 'author', 'date', 'lang'];

export function validateFrontmatter(data, sourcePath) {
  const warnings = [];
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { data: {}, warnings: [], errors: [] };
  }

  const result = {};

  for (const key of Object.keys(data)) {
    if (!ALLOWED_KEYS.includes(key)) {
      warnings.push(`[${sourcePath}] Unknown front matter key: "${key}"`);
    }
  }

  if (data.title !== undefined) {
    if (typeof data.title !== 'string') {
      errors.push(`[${sourcePath}] Front matter "title" must be a string`);
    }
    result.title = data.title;
  }

  if (data.author !== undefined) {
    if (typeof data.author !== 'string') {
      errors.push(`[${sourcePath}] Front matter "author" must be a string`);
    }
    result.author = data.author;
  }

  if (data.date !== undefined) {
    result.date = data.date;
  }

  if (data.lang !== undefined) {
    if (typeof data.lang !== 'string') {
      errors.push(`[${sourcePath}] Front matter "lang" must be a string`);
    }
    result.lang = data.lang;
  } else {
    result.lang = 'en';
  }

  return { data: result, warnings, errors };
}
