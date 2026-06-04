import {Config} from '@remotion/cli/config';
import {webpackOverride} from './src/webpack-override';

Config.setScale(1);
Config.setCodec('gif');
Config.setVideoImageFormat('png');
Config.setNumberOfGifLoops(0);
Config.setOverwriteOutput(true);
Config.overrideWebpackConfig(webpackOverride);
