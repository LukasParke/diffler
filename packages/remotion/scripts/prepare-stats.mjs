import {runPrepareStatsCli} from '../dist/render/index.js';

runPrepareStatsCli().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
