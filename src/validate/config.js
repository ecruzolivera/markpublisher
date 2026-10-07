const ALLOWED_KEYS = [
  'input', 'theme', 'outputDir', 'name',
  'output', 'build', 'serve',
];

const FORBIDDEN_KEYS = [
  'page', 'columns', 'headers', 'assets', 'fonts',
  'layout', 'page_size', 'margin_top', 'margin_right',
  'margin_bottom', 'margin_left', 'width', 'height',
];

const DEFAULTS = {
  theme: 'default',
  outputDir: './output',
  name: 'output',
  output: {
    html: true,
    pdf: true,
  },
  build: {
    failOnWarning: false,
  },
  serve: {
    port: 3000,
  },
};

export function validateConfig(raw, sourcePath) {
  const warnings = [];
  const errors = [];

  const result = {
    ...DEFAULTS,
    output: { ...DEFAULTS.output },
    build: { ...DEFAULTS.build },
    serve: { ...DEFAULTS.serve },
  };
  if (!isTable(raw)) {
    return { data: result, warnings, errors: [`[${sourcePath}] Config must be a table`] };
  }

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.includes(key)) {
      if (FORBIDDEN_KEYS.includes(key)) {
        errors.push(`[${sourcePath}] Key "${key}" belongs in theme.css, not markpublisher.toml`);
      } else {
        warnings.push(`[${sourcePath}] Unknown config key: "${key}"`);
      }
    }
  }

  if (raw.input !== undefined) {
    if (typeof raw.input !== 'string') {
      errors.push(`[${sourcePath}] Config "input" must be a string`);
    }
    result.input = raw.input;
  }

  if (raw.theme !== undefined) {
    if (typeof raw.theme !== 'string') {
      errors.push(`[${sourcePath}] Config "theme" must be a string`);
    }
    result.theme = raw.theme;
  }

  if (raw.outputDir !== undefined) {
    if (typeof raw.outputDir !== 'string') {
      errors.push(`[${sourcePath}] Config "outputDir" must be a string`);
    }
    result.outputDir = raw.outputDir;
  }

  if (raw.name !== undefined) {
    if (typeof raw.name !== 'string') {
      errors.push(`[${sourcePath}] Config "name" must be a string`);
    }
    result.name = raw.name;
  }

  for (const table of ['output', 'build', 'serve']) {
    if (raw[table] === undefined) continue;
    if (!isTable(raw[table])) {
      errors.push(`[${sourcePath}] Config "${table}" must be a table`);
      continue;
    }
    for (const [key, value] of Object.entries(raw[table])) {
      if (!Object.hasOwn(DEFAULTS[table], key)) {
        warnings.push(`[${sourcePath}] Unknown config key: "${table}.${key}"`);
        continue;
      }
      const valid = table === 'serve'
        ? Number.isInteger(value) && value >= 1 && value <= 65535
        : typeof value === 'boolean';
      if (!valid) {
        errors.push(`[${sourcePath}] Config "${table}.${key}" must be ${table === 'serve' ? 'an integer from 1 to 65535' : 'a boolean'}`);
        continue;
      }
      result[table][key] = value;
    }
  }

  return { data: result, warnings, errors };
}

function isTable(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
