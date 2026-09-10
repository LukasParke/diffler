import {describe, expect, it} from 'vitest';
import {formatCodeSize, formatMetricValue} from './formatMetric';

describe('metric presentation', () => {
	it('preserves precise grouped totals that fit', () => {
		expect(formatMetricValue(1234)).toBe('1,234');
	});

	it('compacts large totals rather than overflowing a metric column', () => {
		expect(formatMetricValue(1234567890)).toBe('1.2B');
	});

	it('can opt in to full precision', () => {
		expect(formatMetricValue(1234567890, 'integer')).toBe('1,234,567,890');
	});

	it('keeps exceptionally large finite numbers bounded', () => {
		expect(formatMetricValue(Number.MAX_VALUE)).toBe('1.8e308');
	});

	it('shows an unavailable mark instead of a non-finite number', () => {
		expect(formatMetricValue(Number.NaN)).toBe('—');
	});

	it('uses an unambiguous binary byte unit', () => {
		expect(formatCodeSize(1048576)).toBe('1.0 MiB');
	});

	it('handles zero bytes without a logarithm edge case', () => {
		expect(formatCodeSize(0)).toBe('0 B');
	});

	it('does not produce an undefined suffix above terabytes', () => {
		expect(formatCodeSize(2 ** 60)).toBe('1.0 EiB');
	});
});
