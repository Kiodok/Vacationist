import { describe, it, expect } from 'vitest';
import { formatMessageTime } from './formatMessageTime';

// ISO strings without a Z suffix parse as local time, keeping expectations
// deterministic regardless of the machine's timezone.
const NOW = '2026-07-13T15:00:00';

describe('formatMessageTime', () => {
  it('shows only the time for same-day messages', () => {
    expect(formatMessageTime('2026-07-13T09:30:00', NOW)).toBe('09:30');
  });

  it('shows day, month, and time for same-year messages', () => {
    expect(formatMessageTime('2026-03-02T09:30:00', NOW)).toBe('2 Mar 09:30');
  });

  it('shows the full date for messages from another year', () => {
    expect(formatMessageTime('2025-06-15T12:00:00', NOW)).toBe('15 Jun 2025 12:00');
  });
});
