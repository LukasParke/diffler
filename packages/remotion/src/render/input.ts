import {z} from 'zod';
import {fetchUserStats, sourcePropsSchema, type MainProps} from '../data';

// Zod 4 keeps refinements on the object, including Studio's passthrough props.
export const compositionSchema = sourcePropsSchema.passthrough();
export type CompositionInputProps = z.input<typeof compositionSchema>;

export async function resolveRenderProps(
	value: unknown,
): Promise<MainProps & Record<string, unknown>> {
	assertJson(value);
	const props = sourcePropsSchema.parse(value);
	const userStats = await fetchUserStats(props);
	const resolved = {...(value as Record<string, unknown>)};
	// Once resolved, do not send a URL/raw document back into calculateMetadata:
	// it would fetch again for every composition and could use different data.
	for (const key of ['stats', 'statsUrl', 'username', 'usernames']) {
		delete resolved[key];
	}
	return {...resolved, userStats};
}

function assertJson(
	value: unknown,
	ancestors = new Set<object>(),
	path = 'props',
): void {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'boolean'
	) {
		return;
	}
	if (typeof value === 'number' && Number.isFinite(value)) {
		return;
	}
	if (typeof value !== 'object' || value === null) {
		throw new Error(`${path} must contain only JSON-serializable values`);
	}
	if (ancestors.has(value)) {
		throw new Error(`${path} must not contain circular references`);
	}
	if (
		!Array.isArray(value) &&
		Object.getPrototypeOf(value) !== Object.prototype &&
		Object.getPrototypeOf(value) !== null
	) {
		throw new Error(`${path} must contain only plain JSON objects`);
	}
	ancestors.add(value);
	for (const [key, child] of Object.entries(value)) {
		assertJson(child, ancestors, `${path}.${key}`);
	}
	ancestors.delete(value);
}
