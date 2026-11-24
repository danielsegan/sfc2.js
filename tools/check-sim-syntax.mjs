#!/usr/bin/env node
/**
 * Determinism bans for engine/core and engine/sim (tests excluded).
 * A second pass over tools/lint-fixtures proves each rule fires.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const root = join(import.meta.dirname, '..');
const simRoots = [join(root, 'engine', 'core'), join(root, 'engine', 'sim')];
const fixturePath = join(root, 'tools', 'lint-fixtures', 'sim-violations.ts');

const MATH_TRANSCENDENTAL = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh',
  'exp', 'expm1', 'log', 'log2', 'log10', 'log1p',
]);
const LOCALE_PROPS = new Set([
  'localeCompare', 'toLocaleString', 'toLocaleLowerCase', 'toLocaleUpperCase',
  'toLocaleDateString', 'toLocaleTimeString',
]);

function walkFiles(dir, out) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walkFiles(path, out);
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

function isNonIntegerLiteral(raw) {
  const text = raw.replace(/_/g, '').replace(/n$/, '');
  if (/^0[xXbBoO]/.test(text)) return false;
  return /[.]|[eE]/.test(text);
}

function ident(node) {
  if (!node) return '';
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return ident(node.expression);
  return '';
}

function propName(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPrivateIdentifier(node)) return node.text;
  if (ts.isStringLiteral(node)) return node.text;
  return '';
}

function isAsync(node) {
  return node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
}

function scan(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const hits = [];
  const report = (id, node) => {
    const pos = source.getLineAndCharacterOfPosition(node.getStart(source));
    hits.push({ id, file, line: pos.line + 1 });
  };
  const visit = (node) => {
    if (isAsync(node)) report('async', node);
    if (ts.isAwaitExpression(node)) report('await', node);
    if (ts.isForInStatement(node)) report('for-in', node);
    if (ts.isBigIntLiteral(node)) report('bigint', node);
    if (ts.isNumericLiteral(node) && isNonIntegerLiteral(node.getText(source))) report('non-integer', node);
    if (ts.isBinaryExpression(node)) {
      if (node.operatorToken.kind === ts.SyntaxKind.SlashToken || node.operatorToken.kind === ts.SyntaxKind.SlashEqualsToken) {
        report('raw-div', node);
      }
      if (
        node.operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskToken ||
        node.operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskEqualsToken
      ) {
        report('exponent', node);
      }
    }
    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (name === 'Date') report('date', node);
      if (name === 'performance') report('performance', node);
      if (name === 'setTimeout' || name === 'setInterval') report('timer', node);
      if (name === 'requestAnimationFrame') report('raf', node);
      if (name === 'queueMicrotask') report('microtask', node);
      if (name === 'Promise') report('promise', node);
      if (name === 'BigInt') report('bigint', node);
      if (name === 'parseFloat') report('parse-float', node);
      if (name === 'Intl') report('intl', node);
      if (name === 'fetch') report('fetch', node);
      if (name === 'Float32Array' || name === 'Float64Array') report('float-array', node);
      if (name === 'WeakMap' || name === 'WeakSet') report('weakmap', node);
      if (name === 'WeakRef') report('weakref', node);
      if (name === 'FinalizationRegistry') report('finalization', node);
    }
    if (ts.isPropertyAccessExpression(node)) {
      const objectName = ident(node.expression);
      const name = propName(node.name);
      if (objectName === 'Math' && name === 'random') report('math-random', node);
      if (objectName === 'Math' && MATH_TRANSCENDENTAL.has(name)) report('math-transcendental', node);
      if (objectName === 'Math' && (name === 'sqrt' || name === 'cbrt' || name === 'hypot' || name === 'fround')) {
        report('math-sqrt', node);
      }
      if (objectName === 'Math' && name === 'pow') report('math-pow', node);
      if (objectName === 'Object' && name === 'keys') report('object-keys', node);
      if (objectName === 'Object' && name === 'values') report('object-values', node);
      if (objectName === 'Object' && name === 'entries') report('object-entries', node);
      if (LOCALE_PROPS.has(name)) report('locale', node);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      if (propName(node.expression.name) === 'sort' && node.arguments.length === 0) report('sort', node);
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (spec === 'three' || spec.startsWith('three/') || spec.includes('react') || spec.startsWith('node:fs') || spec.startsWith('node:http')) {
        report('import', node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (source.parseDiagnostics.length > 0) {
    hits.push({ id: 'parse', file, line: 1 });
  }
  return hits;
}

const expected = [
  'date', 'performance', 'timer', 'raf', 'microtask', 'promise', 'async', 'await',
  'math-random', 'math-transcendental', 'math-sqrt', 'math-pow', 'bigint', 'parse-float',
  'locale', 'intl', 'float-array', 'raw-div', 'exponent', 'non-integer', 'for-in',
  'object-keys', 'object-values', 'object-entries', 'sort', 'weakmap', 'weakref',
  'finalization', 'fetch',
];

const files = simRoots.flatMap((dir) => walkFiles(dir, []));
const violations = files.flatMap((file) => scan(file, readFileSync(file, 'utf8')));
const fixtureHits = new Set(scan(fixturePath, readFileSync(fixturePath, 'utf8')).map((hit) => hit.id));
const missing = expected.filter((id) => !fixtureHits.has(id));
let failed = false;
if (violations.length > 0) {
  failed = true;
  console.error('sim packages violate the determinism bans:');
  for (const hit of violations) {
    console.error(`  ${hit.id} ${relative(root, hit.file)}:${hit.line}`);
  }
}
if (missing.length > 0) {
  failed = true;
  console.error(`lint fixture did not fire: ${missing.join(', ')}`);
}
if (failed) process.exit(1);
console.log(`sim syntax ok (${files.length} files, ${expected.length} fixture rules)`);
