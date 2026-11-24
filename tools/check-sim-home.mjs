#!/usr/bin/env node
/**
 * SimSystem, CommandHandler, and TableSpec definitions belong in the trees
 * simSourceHash covers (engine/core, engine/sim). Tests are excluded, matching
 * that hash. Synthetic scripts under engine/replay/scenarios are stamped by
 * scenarioHash and are the only other allowed home (determinism.md §8).
 *
 * A fixture under tools/lint-fixtures proves each kind of definition is caught.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

const root = join(import.meta.dirname, '..');
const fixturePath = join(root, 'tools', 'lint-fixtures', 'sim-home-outside.ts');
const NAMES = new Set(['SimSystem', 'CommandHandler', 'TableSpec']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'lint-fixtures']);

function posix(file) {
  return relative(root, file).split(sep).join('/');
}

function allowed(file) {
  const path = posix(file);
  if (path.startsWith('engine/sim/') || path.startsWith('engine/core/')) return true;
  if (path.startsWith('engine/replay/scenarios/')) return true;
  return false;
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')) out.push(path);
  }
  return out;
}

function propName(node) {
  if (!node) return '';
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  if (ts.isPrivateIdentifier(node)) return node.text;
  return '';
}

function typeName(node) {
  if (!node) return null;
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) return node.typeName.text;
  if (ts.isArrayTypeNode(node)) return typeName(node.elementType);
  if (ts.isTypeOperatorNode(node)) return typeName(node.type);
  if (ts.isParenthesizedTypeNode(node)) return typeName(node.type);
  if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
    for (const part of node.types) {
      const name = typeName(part);
      if (NAMES.has(name)) return name;
    }
  }
  return null;
}

function exactTypeName(node) {
  if (!node) return null;
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) return node.typeName.text;
  if (ts.isParenthesizedTypeNode(node)) return exactTypeName(node.type);
  return null;
}

function namesOf(obj) {
  const names = new Set();
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop) || ts.isMethodDeclaration(prop)) {
      names.add(propName(prop.name));
    }
  }
  return names;
}

function hasAll(names, required) {
  for (const key of required) {
    if (!names.has(key)) return false;
  }
  return true;
}

function structuralKind(obj) {
  const names = namesOf(obj);
  if (hasAll(names, ['id', 'phase', 'priority', 'step'])) return 'SimSystem';
  if (hasAll(names, ['kind', 'apply'])) return 'CommandHandler';
  if (hasAll(names, ['id', 'fieldCount']) && !names.has('data') && !names.has('step') && !names.has('phase')) {
    return 'TableSpec';
  }
  return null;
}

function scan(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const hits = [];
  const report = (kind, node) => {
    const pos = source.getLineAndCharacterOfPosition(node.getStart(source));
    hits.push({ kind, file, line: pos.line + 1 });
  };
  const visit = (node) => {
    if ((ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) && node.initializer) {
      const name = typeName(node.type);
      if (NAMES.has(name)) report(name, node);
    }
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)) &&
      node.type
    ) {
      const name = exactTypeName(node.type);
      if (NAMES.has(name)) report(name, node);
    }
    if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
      const name = exactTypeName(node.type);
      if (NAMES.has(name)) report(name, node);
    }
    if (ts.isObjectLiteralExpression(node)) {
      const kind = structuralKind(node);
      if (kind) report(kind, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (source.parseDiagnostics.length > 0) hits.push({ kind: 'parse', file, line: 1 });
  return hits;
}

const expected = ['SimSystem', 'CommandHandler', 'TableSpec'];
const files = walk(root, []).filter((file) => !allowed(file));
const violations = files.flatMap((file) => scan(file, readFileSync(file, 'utf8')));
const fixtureHits = new Set(scan(fixturePath, readFileSync(fixturePath, 'utf8')).map((hit) => hit.kind));
const missing = expected.filter((kind) => !fixtureHits.has(kind));
let failed = false;
if (violations.length > 0) {
  failed = true;
  console.error('sim definitions outside engine/sim and engine/core:');
  for (const hit of violations) {
    console.error(`  ${hit.kind} ${posix(hit.file)}:${hit.line}`);
  }
}
if (missing.length > 0) {
  failed = true;
  console.error(`sim-home fixture did not fire: ${missing.join(', ')}`);
}
if (failed) process.exit(1);
console.log(`sim home ok (${files.length} files outside the hash, ${expected.length} fixture kinds)`);
