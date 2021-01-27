const BrowserInterface = require( './browser-interface' );

class BrowserInterfacePuppeteer extends BrowserInterface {
	constructor( pages ) {
		super();

		this.pages = pages;
	}

	async runInPage( pageUrl, viewport, method, ...args ) {
		const page = this.pages[ pageUrl ];

		if ( ! page ) {
			throw new Error( 'Unrecognized page URL: ' + pageUrl );
		}

		if ( viewport ) {
			await page.setViewport( viewport );
		}

		// Get the inner window to pass to inner method.
		const window = await page.evaluateHandle( () => window );

		// Call inner method within the puppeteer context.
		return page.evaluate( method, window, ...args );
	}
}

module.exports = BrowserInterfacePuppeteer;
