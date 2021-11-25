const BrowserInterfaceNode = require( './browser-interface-node' );

class BrowserInterfacePlaywright extends BrowserInterfaceNode {
	constructor( pages ) {
		super( pages );

		this.interfaceName = 'Playwright';
	}
}

module.exports = BrowserInterfacePlaywright;
