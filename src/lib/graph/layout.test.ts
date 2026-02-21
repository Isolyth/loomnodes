import { describe, it, expect } from 'vitest';
import { computeLayout } from './layout.js';

describe('computeLayout', () => {
	it('returns positions for all nodes', () => {
		const positions = computeLayout(
			[{ id: 'a' }, { id: 'b' }, { id: 'c' }],
			[
				{ source: 'a', target: 'b' },
				{ source: 'a', target: 'c' }
			],
			280, 200
		);
		expect(positions.size).toBe(3);
		expect(positions.get('a')).toBeDefined();
		expect(positions.get('b')).toBeDefined();
		expect(positions.get('c')).toBeDefined();
	});

	it('positions are finite numbers', () => {
		const positions = computeLayout(
			[{ id: 'a' }, { id: 'b' }],
			[{ source: 'a', target: 'b' }],
			280, 200
		);
		for (const [, pos] of positions) {
			expect(Number.isFinite(pos.x)).toBe(true);
			expect(Number.isFinite(pos.y)).toBe(true);
		}
	});

	it('handles single node', () => {
		const positions = computeLayout([{ id: 'a' }], [], 280, 200);
		expect(positions.size).toBe(1);
	});

	it('parent is above children (top-to-bottom layout)', () => {
		const positions = computeLayout(
			[{ id: 'a' }, { id: 'b' }, { id: 'c' }],
			[
				{ source: 'a', target: 'b' },
				{ source: 'a', target: 'c' }
			],
			280, 200
		);
		const a = positions.get('a')!;
		const b = positions.get('b')!;
		const c = positions.get('c')!;
		expect(a.y).toBeLessThan(b.y);
		expect(a.y).toBeLessThan(c.y);
	});

	it('siblings are side by side', () => {
		const positions = computeLayout(
			[{ id: 'a' }, { id: 'b' }, { id: 'c' }],
			[
				{ source: 'a', target: 'b' },
				{ source: 'a', target: 'c' }
			],
			280, 200
		);
		const b = positions.get('b')!;
		const c = positions.get('c')!;
		// Same rank = same y, different x
		expect(b.y).toBe(c.y);
		expect(b.x).not.toBe(c.x);
	});
});
