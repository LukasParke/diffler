export interface RenderConfig {
  compositionIds: string[];
  entryPoint: string;
  formats: Array<'gif' | 'webp'>;
  outputDir: string;
  props: Record<string, unknown>;
  concurrency?: number;
  remotionConcurrency?: number;
}
