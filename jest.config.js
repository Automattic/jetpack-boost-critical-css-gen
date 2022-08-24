export default {
	testEnvironment: 'jest-environment-node',
	testMatch: [ '**/?(*.)+(spec|test).js' ],
	setupFilesAfterEnv: [ './tests/config/jest-setup.js' ],
	collectCoverageFrom: [ 'lib/*.js' ],
	globalSetup: 'jest-environment-puppeteer/setup',
	globalTeardown: 'jest-environment-puppeteer/teardown',
	testEnvironment: 'jest-environment-puppeteer',
	testPathIgnorePatterns: [
		'/node_modules/',
		'tests/config/jest-setup.js',
		'tests/lib/*',
	],
	moduleDirectories: [
		"lib",
		"node_modules",
	]
};