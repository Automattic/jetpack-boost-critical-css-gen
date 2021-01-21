const BrowserInterfacePuppeteer = require('./browser-interface-puppeteer');
const BrowserInterfaceIframe = require('./browser-interface-iframe');
const generateCriticalCSS = require('./generate-critical-css');

module.exports = {
	BrowserInterfaceIframe,
	BrowserInterfacePuppeteer,
	generateCriticalCSS,
};
