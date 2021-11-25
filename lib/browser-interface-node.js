const BrowserInterface = require( './browser-interface' );

class BrowserInterfaceNode extends BrowserInterface {
	constructor( pages ) {
		super();

		this.interfaceName = 'Node default';
		this.pages = pages;
	}

	async runInPage( pageUrl, viewport, method, ...args ) {
		const page = this.pages[ pageUrl ];

		if ( ! page ) {
			throw new Error(
				`${ this.interfaceName } interface does not include URL ${ pageUrl }`
			);
		}

		if ( viewport ) {
			await page.setViewport( viewport );
		}

		// Get the inner window to pass to inner method.
		const window = await page.evaluateHandle( () => window );
		// console.log( args )

		// Call inner method within the puppeteer context.
		return page.evaluate( method, window, ...args );
	}

	/**
	 * Replacement for browser.fetch, uses node-fetch to simulate the same
	 * interface.
	 *
	 * @param {string} url URL to fetch.
	 * @param {Object} options Fetch options.
	 * @param {string} _role 'css' or 'html' indicating what kind of thing is being fetched.
	 */
	async fetch( url, options, _role ) {
		const nodeFetch = require( 'node-fetch' );
		return nodeFetch( url, options );
	}
}

module.exports = BrowserInterfaceNode;
