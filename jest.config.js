module.exports = {
	testMatch: ['**/?(*.)+(spec|test).js'],
	setupFilesAfterEnv: ['./tests/config/jest-setup.js'],
	collectCoverageFrom: ['lib/**/*.js', 'index.js'],
	globalSetup: 'jest-environment-puppeteer/setup',
	globalTeardown: 'jest-environment-puppeteer/teardown',
	testEnvironment: 'jest-environment-puppeteer',
	testPathIgnorePatterns: [
		'/node_modules/',
		'tests/config/jest-setup.js',
		'tests/lib/*',
	],
};
