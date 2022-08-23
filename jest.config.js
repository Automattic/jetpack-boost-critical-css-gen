module.exports = {
	testMatch: [ '**/?(*.)+(spec|test).js' ],
	transform: {
		"^.+\\.ts?$": "ts-jest"
	},
	setupFilesAfterEnv: [ './tests/config/jest-setup.js' ],
	collectCoverageFrom: [ 'lib/**/*.ts', 'index.ts' ],
	globalSetup: 'jest-environment-puppeteer/setup',
	globalTeardown: 'jest-environment-puppeteer/teardown',
	testEnvironment: 'jest-environment-puppeteer',
	testPathIgnorePatterns: [
		'/node_modules/',
		'tests/config/jest-setup.js',
		'tests/lib/*',
	],
};
