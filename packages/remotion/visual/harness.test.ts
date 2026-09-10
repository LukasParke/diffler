import {expect, it} from 'vitest';
import {join, resolve} from 'node:path';
import {normalizeUserStats, userStatsSchema} from '@lukasparke/diffler-remotion';
import {sampleFrames} from './contracts.mjs';
import {fixtureTime, visualScenarios} from './fixtures.mjs';
import {escapeHtml} from './gallery.mjs';
import {fullValueMatches, overflowEdges} from './measure';
import {bundlePath} from './serve.mjs';

it.each(visualScenarios)('$id is a valid, normalized public stats fixture', ({userStats}) => {
  expect(userStatsSchema.parse(userStats)).toEqual(userStats);
  expect(normalizeUserStats(userStats)).toEqual(userStats);
});

it.each(visualScenarios)('$id has fixed timestamps and no remote identity resources', ({userStats}) => {
  expect(userStats).toMatchObject({
    generatedAt: fixtureTime, fetchedAt: Date.parse(fixtureTime),
    avatarUrl: '', websiteUrl: null, summary: {refreshedAt: fixtureTime},
  });
});

it('keeps the normal fixture complete instead of inheriting demo coverage gaps', () => {
  expect(visualScenarios.find(({id}) => id === 'normal')?.userStats).toMatchObject({
    isComplete: true, collectionStatus: {coreComplete: true, complete: true, warnings: []},
  });
});

it('keeps pending optional metrics distinct from measured zeroes', () => {
  expect(visualScenarios.find(({id}) => id === 'pending')?.userStats).toMatchObject({
    isComplete: false, collectionStatus: {coreComplete: true, complete: false, backfillPending: 213},
    code: {linesOfCodeChanged: 0, contributorReposCompleted: 0, contributorReposPending: 213, contributorReposFailed: 3},
    repositories: {repoViews: 0, trafficReposCompleted: 0, trafficReposPending: 213, trafficReposFailed: 3},
  });
});

it('selects first, 2.6-second key, and composition-specific final frames', () => {
  expect(sampleFrames('first,key,settled', 360, 30)).toEqual([0, 78, 359]);
});

it('sorts and deduplicates explicitly selected key frames', () => {
  expect(sampleFrames('299,78,first,0,78', 300, 30)).toEqual([0, 78, 299]);
});

it.each(['', '-1', '300', '1.5', 'Infinity', 'last', '0,,78'])('rejects invalid frame selection %j before rendering', (selection) => {
  expect(() => sampleFrames(selection, 300, 30)).toThrow('Invalid frame');
});

const clip = {left: 0, top: 0, right: 100, bottom: 100};

it('accepts contained text with one CSS pixel of rounding tolerance', () => {
  expect(overflowEdges({left: -0.75, top: 0, right: 100.75, bottom: 100}, clip)).toEqual([]);
});

it('identifies all four overflow edges', () => {
  expect(overflowEdges({left: -2, top: -2, right: 102, bottom: 102}, clip)).toEqual(['left', 'right', 'top', 'bottom']);
});

it('respects an ancestor that clips only the vertical axis', () => {
  expect(overflowEdges({left: -20, top: 0, right: 120, bottom: 103}, clip, false, true)).toEqual(['bottom']);
});

it('accepts a complete identity title rather than requiring an exact text-node match', () => {
  expect(fullValueMatches('Ada Example', "Hi, I'm Ada Example")).toBe(true);
});

it('accepts the full exact numeric value behind a compact display', () => {
  expect(fullValueMatches('9.9B', '9,876,543,210')).toBe(true);
});

it('does not accept an unrelated tooltip as intentional truncation', () => {
  expect(fullValueMatches('Long language name', 'Language')).toBe(false);
});

it('does not accept a different numeric value as intentional truncation', () => {
  expect(fullValueMatches('9.9B', '123,456')).toBe(false);
});

it('does not accept missing accessibility text', () => {
  expect(fullValueMatches('Long language name', '')).toBe(false);
});

it('escapes fixture and diagnostic strings in the review gallery', () => {
  expect(escapeHtml('<img title="Ada & Co\'s">')).toBe('&lt;img title=&quot;Ada &amp; Co&#39;s&quot;&gt;');
});

const bundleDirectory = resolve('visual-test-bundle');

it('serves the bundle index at the loopback origin root', () => {
  expect(bundlePath(bundleDirectory, '/')).toBe(join(bundleDirectory, 'index.html'));
});

it('resolves bundle assets without including query strings in file paths', () => {
  expect(bundlePath(bundleDirectory, '/fonts/fira.woff2?v=1')).toBe(join(bundleDirectory, 'fonts', 'fira.woff2'));
});

it('rejects encoded traversal outside the owned bundle', () => {
  expect(() => bundlePath(bundleDirectory, '/..%2Foutside.txt')).toThrow('escapes its directory');
});

it('rejects malformed URL encodings instead of reading an unintended path', () => {
  expect(() => bundlePath(bundleDirectory, '/%invalid')).toThrow(URIError);
});
