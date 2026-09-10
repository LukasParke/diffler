#!/usr/bin/env node
import {runRenderCli} from './commands';

runRenderCli().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
