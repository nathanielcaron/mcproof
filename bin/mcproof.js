#!/usr/bin/env node

const { runCli } = require('../dist/cli.js');

runCli(process.argv.slice(2))
	.then(code => {
		process.exit(code);
	})
	.catch(error => {
		console.error(error && error.message ? error.message : String(error));
		process.exit(1);
	});