import {test} from 'node:test';
import assert from 'node:assert/strict';

const {isSupportedNode} = await import('../server/preflight.js');

test('preflight accepts Node >= 22.13 and rejects older runtimes', () => {
  assert.equal(isSupportedNode('22.13.0'), true);
  assert.equal(isSupportedNode('22.14.1'), true);
  assert.equal(isSupportedNode('24.4.0'), true);
  assert.equal(isSupportedNode('22.12.1'), false);
  assert.equal(isSupportedNode('21.7.3'), false);
  assert.equal(isSupportedNode('18.17.1'), false);
});
