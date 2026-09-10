/**
 * Local Studio/direct Remotion CLI defaults only. renderCards passes its options
 * to the Node APIs explicitly and owns the staged WebP/GIF/PNG pipeline.
 */
import {Config} from '@remotion/cli/config';

Config.setConcurrency(1);
Config.setScale(1);
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(false);
