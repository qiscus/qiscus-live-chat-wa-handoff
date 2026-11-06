// Loads an ES-module source file of this package (src/lib/*.js, or the
// <script> of a .vue file) in Node's CommonJS test runner: transpiled with the
// project's own babel-core + preset-env, so tests run the shipped code.

const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('babel-core');
const { parseComponent } = require('vue-template-compiler');

const SRC_DIR = path.resolve(__dirname, '../../src');

function compile(code, filename) {
  const { code: out } = babel.transform(code, {
    babelrc: false,
    filename,
    presets: [['env', { targets: { node: 'current' } }]],
    plugins: ['add-module-exports'],
  });
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(out, filename);
  return mod.exports;
}

// `lib/omniForm.js` -> its exports
function loadSrc(relPath) {
  const file = path.join(SRC_DIR, relPath);
  return compile(fs.readFileSync(file, 'utf8'), file);
}

// `components/X.vue` -> its component options (the <script> export)
function loadVueScript(relPath) {
  const file = path.join(SRC_DIR, relPath);
  const sfc = parseComponent(fs.readFileSync(file, 'utf8'));
  return compile(sfc.script.content, file);
}

module.exports = { loadSrc, loadVueScript };
