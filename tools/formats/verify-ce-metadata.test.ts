import assert from 'node:assert/strict';
import test from 'node:test';

import { publicParserSummary } from './verify-ce-metadata.ts';

test('parser summary keeps counts and drops paths, hashes, and names', () => {
  const summary = publicParserSummary({
    shiplist: {
      source: 'Assets/Specs/shiplist.txt',
      sha256: 'a'.repeat(64),
      headerNames: ['Race', 'Class'],
      rowCount: 3,
      columnCount: 2,
      copies: [{ path: 'Assets/Specs/shiplist.txt', sha256: 'b'.repeat(64) }],
      copiesIdentical: true,
      counts: { 'shiplist:duplicateClassKey:error': 1 },
      weaponCodes: ['Phaser'],
    },
    ftrlist: null,
  });
  const text = JSON.stringify(summary);
  assert.equal(text.includes('Assets/'), false);
  assert.equal(text.includes('a'.repeat(64)), false);
  assert.equal(text.includes('Phaser'), false);
  assert.equal(text.includes('Race'), false);
  assert.equal(summary.result, 'fail');
  assert.equal(summary.shiplist?.rows, 3);
  assert.equal(summary.shiplist?.copies, 1);
  assert.deepEqual(summary.shiplist?.errors, [{ class: 'duplicateClassKey:error', count: 1 }]);
  assert.equal(summary.ftrlist, null);
});
