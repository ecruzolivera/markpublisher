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

  if (!raw || typeof raw !== 'object') {
    return { data: { ...DEFAULTS }, warnings: [], errors: [] };
  }

  const result = { ...DEFAULTS };

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.includes(key)) {
      if (FORBIDDEN_KEYS.includes(key)) {
        errors.push(`[${sourcePath}] Key "${key}" belongs in theme.toml, not markpublisher.toml`);
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

  if (raw.output !== undefined && typeof raw.output === 'object') {
    result.output = { ...DEFAULTS.output, ...raw.output };
  }

  if (raw.build !== undefined && typeof raw.build === 'object') {
    result.build = { ...DEFAULTS.build, ...raw.build };
  }

  if (raw.serve !== undefined && typeof raw.serve === 'object') {
    result.serve = { ...DEFAULTS.serve, ...raw.serve };
  }

  return { data: result, warnings, errors };
}
