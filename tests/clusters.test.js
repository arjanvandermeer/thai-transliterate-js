import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VALID_CLUSTERS, isValidCluster, CLUSTER_SECOND } from '../src/tables/clusters.js';

describe('VALID_CLUSTERS', () => {
  it('is a Set', () => {
    assert.ok(VALID_CLUSTERS instanceof Set);
  });

  it('contains common clusters', () => {
    const expected = ['กร', 'กล', 'กว', 'ปร', 'ปล', 'คร', 'คล', 'ตร', 'ทร', 'ศร'];
    for (const cluster of expected) {
      assert.ok(VALID_CLUSTERS.has(cluster), `expected ${cluster} in VALID_CLUSTERS`);
    }
  });

  it('does not contain invalid clusters', () => {
    const invalid = ['กก', 'รก', 'ลก', 'วว', 'หร'];
    for (const cluster of invalid) {
      assert.ok(!VALID_CLUSTERS.has(cluster), `${cluster} should not be in VALID_CLUSTERS`);
    }
  });
});

describe('isValidCluster', () => {
  it('returns true for valid two-consonant clusters', () => {
    assert.equal(isValidCluster('ก', 'ร'), true);
    assert.equal(isValidCluster('ก', 'ล'), true);
    assert.equal(isValidCluster('ป', 'ร'), true);
    assert.equal(isValidCluster('ท', 'ร'), true);
    assert.equal(isValidCluster('ศ', 'ร'), true);
  });

  it('returns false for invalid clusters', () => {
    assert.equal(isValidCluster('ก', 'ก'), false);
    assert.equal(isValidCluster('ร', 'ก'), false);
    assert.equal(isValidCluster('ห', 'ร'), false);
  });

  it('returns false for empty strings', () => {
    assert.equal(isValidCluster('', ''), false);
    assert.equal(isValidCluster('ก', ''), false);
    assert.equal(isValidCluster('', 'ร'), false);
  });
});

describe('CLUSTER_SECOND', () => {
  it('has entries for ร, ล, ว', () => {
    assert.ok('ร' in CLUSTER_SECOND);
    assert.ok('ล' in CLUSTER_SECOND);
    assert.ok('ว' in CLUSTER_SECOND);
  });

  it('ร has r as primary variant', () => {
    const r = CLUSTER_SECOND['ร'];
    assert.ok(r.some(v => v.text === 'r' && v.weight === 1.0));
  });
});
