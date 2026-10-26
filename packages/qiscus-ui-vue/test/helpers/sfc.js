// Minimal Single-File-Component reader for tests. It compiles the *real* .vue
// sources (pug template + stylus style) with the project's own devDependencies,
// so tests exercise shipped markup/CSS instead of hand-copied copies.

const fs = require('fs');
const path = require('path');
const pug = require('pug');
const stylus = require('stylus');
const { parseComponent } = require('vue-template-compiler');

const COMPONENTS_DIR = path.resolve(__dirname, '../../src/components');

function readSfc(name) {
  const file = path.join(COMPONENTS_DIR, name);
  const sfc = parseComponent(fs.readFileSync(file, 'utf8'));
  return { file, sfc };
}

// pug template -> HTML template string (what vue-loader would hand to Vue)
function compileTemplate(name) {
  const { sfc } = readSfc(name);
  return pug.render(sfc.template.content, { pretty: false });
}

// stylus <style> block -> plain CSS string
function compileStyle(name) {
  const { file, sfc } = readSfc(name);
  const style = sfc.styles[0];
  if (!style) return '';
  let css = '';
  stylus(style.content)
    .set('filename', file)
    .render((err, out) => {
      if (err) throw err;
      css = out;
    });
  return css;
}

// <script> block -> source of a function body returning the component options.
// Only handles the `import X from './X'; export default {...}` shape used by
// the small button components.
function compileScript(name) {
  const { sfc } = readSfc(name);
  return sfc.script.content
    .replace(/^import .*$/gm, '')
    .replace('export default', 'return');
}

// Tiny flat-CSS reader (no @media/@keyframes needed for these components).
// Returns [{ selectors: [...], decls: { prop: value } }] in source order.
function parseRules(css) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m = re.exec(css);
  while (m) {
    const selectors = m[1]
      .split(',')
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const decls = {};
    m[2].split(';').forEach((d) => {
      const i = d.indexOf(':');
      if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    });
    rules.push({ selectors, decls });
    m = re.exec(css);
  }
  return rules;
}

// Declarations that apply to exactly `selector` (later rules win), ignoring
// rules that only target it through a longer/more specific selector.
function declarationsFor(css, selector) {
  const merged = {};
  parseRules(css).forEach((rule) => {
    if (rule.selectors.includes(selector)) Object.assign(merged, rule.decls);
  });
  return merged;
}

module.exports = { compileTemplate, compileStyle, compileScript, parseRules, declarationsFor };
