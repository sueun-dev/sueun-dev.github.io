import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeRanges,
  calculateUsedBytes,
  summarizeCoverage,
  totalCoverage,
} from '../tools/coverage.mjs';

test('mergeRanges: empty input returns empty array', () => {
  assert.deepEqual(mergeRanges([]), []);
});

test('mergeRanges: a single range is returned unchanged', () => {
  assert.deepEqual(mergeRanges([{ start: 5, end: 10 }]), [{ start: 5, end: 10 }]);
});

test('mergeRanges: two disjoint ranges stay separate', () => {
  const out = mergeRanges([
    { start: 0, end: 5 },
    { start: 10, end: 20 },
  ]);
  assert.deepEqual(out, [
    { start: 0, end: 5 },
    { start: 10, end: 20 },
  ]);
});

test('mergeRanges: overlapping ranges are merged into one', () => {
  const out = mergeRanges([
    { start: 0, end: 10 },
    { start: 5, end: 15 },
  ]);
  assert.deepEqual(out, [{ start: 0, end: 15 }]);
});

test('mergeRanges: a fully-contained range does not shrink the outer range', () => {
  const out = mergeRanges([
    { start: 0, end: 100 },
    { start: 20, end: 30 },
  ]);
  assert.deepEqual(out, [{ start: 0, end: 100 }]);
});

test('mergeRanges: touching ranges (end === next.start) merge (boundary case)', () => {
  // range.start <= last.end  ->  10 <= 10 is true, so they merge.
  const out = mergeRanges([
    { start: 0, end: 10 },
    { start: 10, end: 20 },
  ]);
  assert.deepEqual(out, [{ start: 0, end: 20 }]);
});

test('mergeRanges: ranges with a one-byte gap stay separate (boundary case)', () => {
  const out = mergeRanges([
    { start: 0, end: 10 },
    { start: 11, end: 20 },
  ]);
  assert.deepEqual(out, [
    { start: 0, end: 10 },
    { start: 11, end: 20 },
  ]);
});

test('mergeRanges: unsorted input is sorted before merging', () => {
  const out = mergeRanges([
    { start: 30, end: 40 },
    { start: 0, end: 10 },
    { start: 5, end: 35 },
  ]);
  // 0-10 overlaps 5-35 -> 0-35, which touches/overlaps 30-40 -> 0-40
  assert.deepEqual(out, [{ start: 0, end: 40 }]);
});

test('mergeRanges: does NOT mutate the caller input objects (regression)', () => {
  const input = [
    { start: 0, end: 10 },
    { start: 5, end: 25 },
  ];
  const snapshot = input.map((r) => ({ ...r }));
  mergeRanges(input);
  assert.deepEqual(input, snapshot, 'input ranges must be unchanged after merge');
});

test('calculateUsedBytes: empty ranges => 0', () => {
  assert.equal(calculateUsedBytes([]), 0);
});

test('calculateUsedBytes: disjoint ranges sum their lengths', () => {
  assert.equal(
    calculateUsedBytes([
      { start: 0, end: 5 },
      { start: 10, end: 20 },
    ]),
    5 + 10
  );
});

test('calculateUsedBytes: overlapping ranges are not double counted', () => {
  assert.equal(
    calculateUsedBytes([
      { start: 0, end: 10 },
      { start: 5, end: 15 },
    ]),
    15 // merged 0-15
  );
});

test('summarizeCoverage: computes used/unused/percent per entry', () => {
  const out = summarizeCoverage([
    {
      url: 'style.css',
      text: 'x'.repeat(100),
      ranges: [
        { start: 0, end: 25 },
        { start: 20, end: 50 }, // merges to 0-50 => 50 used
      ],
    },
  ]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], {
    url: 'style.css',
    totalBytes: 100,
    usedBytes: 50,
    unusedBytes: 50,
    percentUsed: 50,
  });
});

test('summarizeCoverage: empty stylesheet reports 0% (no divide-by-zero)', () => {
  const out = summarizeCoverage([{ url: 'empty.css', text: '', ranges: [] }]);
  assert.equal(out[0].totalBytes, 0);
  assert.equal(out[0].percentUsed, 0);
});

test('summarizeCoverage: percentUsed is rounded to two decimals', () => {
  const out = summarizeCoverage([
    {
      url: 'a.css',
      text: 'y'.repeat(3),
      ranges: [{ start: 0, end: 1 }], // 1/3 = 33.333... -> 33.33
    },
  ]);
  assert.equal(out[0].percentUsed, 33.33);
});

test('totalCoverage: aggregates byte counts across entries', () => {
  const summary = [
    { totalBytes: 100, usedBytes: 40, unusedBytes: 60 },
    { totalBytes: 200, usedBytes: 150, unusedBytes: 50 },
  ];
  assert.deepEqual(totalCoverage(summary), {
    totalBytes: 300,
    usedBytes: 190,
    unusedBytes: 110,
  });
});

test('totalCoverage: empty summary yields zeroed totals', () => {
  assert.deepEqual(totalCoverage([]), {
    totalBytes: 0,
    usedBytes: 0,
    unusedBytes: 0,
  });
});
