const BrowserInterfacePuppeteer = require( './lib/browser-interface-puppeteer' );
const BrowserInterfaceIframe = require( './lib/browser-interface-iframe' );
const generateCriticalCSS = require( './lib/generate-critical-css' );
const { SuccessTargetError } = require( './lib/errors' );

module.exports = {
	version: '0.0.1',
	BrowserInterfaceIframe,
	BrowserInterfacePuppeteer,
	generateCriticalCSS,
	SuccessTargetError,
};
