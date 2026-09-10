import type {z} from 'zod';
import type {renderConfigSchema} from './validation';

export type RenderConfig = z.input<typeof renderConfigSchema>;
export type RenderFormat = RenderConfig['formats'][number];
