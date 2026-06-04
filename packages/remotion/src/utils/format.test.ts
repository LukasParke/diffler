import {describe, it, expect} from 'vitest';
import {
  formatCompactNumber,
  formatBytes,
  formatInteger,
  humanReadableFileSize,
  percentage,
  addCommas,
  cn,
} from './format';

describe('humanReadableFileSize', () => {
  it('returns 0 B for zero bytes', () => {
    expect(humanReadableFileSize(0)).toBe('0 B');
  });

  it('formats binary kilobytes', () => {
    expect(humanReadableFileSize(1024)).toBe('1.0 KiB');
  });

  it('formats SI kilobytes', () => {
    expect(humanReadableFileSize(1000, true)).toBe('1.0 kB');
  });
});

describe('percentage', () => {
  it('calculates percentage', () => {
    expect(percentage(50, 100)).toBe(50);
  });

  it('returns 0 when total is 0', () => {
    expect(percentage(10, 0)).toBe(0);
  });
});

describe('addCommas', () => {
  it('adds commas to large numbers', () => {
    expect(addCommas(1000)).toBe('1,000');
  });

  it('returns 0 as string', () => {
    expect(addCommas(0)).toBe('0');
  });
});

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('filters falsy values', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
});

describe('formatCompactNumber', () => {
  it('formats thousands with k suffix', () => {
    expect(formatCompactNumber(1500)).toBe('1.5K');
  });

  it('formats millions with M suffix', () => {
    expect(formatCompactNumber(2_500_000)).toBe('2.5M');
  });

  it('returns string for small numbers', () => {
    expect(formatCompactNumber(42)).toBe('42');
  });

  it('returns 0 for zero', () => {
    expect(formatCompactNumber(0)).toBe('0');
  });

  it('formats negative thousands', () => {
    expect(formatCompactNumber(-1000)).toBe('-1K');
  });
});

describe('formatBytes', () => {
  it('returns bytes for small values', () => {
    expect(formatBytes(0)).toBe('0 Byte');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 ** 2)).toBe('1.00 MB');
  });

  it('formats single byte', () => {
    expect(formatBytes(1)).toBe('1.00 Bytes');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1024 ** 3)).toBe('1.00 GB');
  });
});

describe('formatInteger', () => {
  it('adds commas to large numbers', () => {
    expect(formatInteger(1234567)).toBe('1,234,567');
  });

  it('returns 0 for zero', () => {
    expect(formatInteger(0)).toBe('0');
  });

  it('adds commas to negative numbers', () => {
    expect(formatInteger(-1234)).toBe('-1,234');
  });
});
