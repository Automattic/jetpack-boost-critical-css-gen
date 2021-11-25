const BrowserInterfaceNode = require( './browser-interface-node' );

class BrowserInterfacePuppeteer extends BrowserInterfaceNode {
	constructor( pages ) {
		super( pages );

		this.interfaceName = 'Puppeteer';
	}
}

module.exports = BrowserInterfacePuppeteer;
