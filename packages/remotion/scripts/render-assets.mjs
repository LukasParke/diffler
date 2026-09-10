import {runRenderCli} from '../dist/render/index.js';

runRenderCli().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
