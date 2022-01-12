const BrowserInterface = require( './browser-interface' );

class BrowserInterfacePlaywright extends BrowserInterface {
	constructor( pages ) {
		super();

		this.pages = pages;
	}

	async runInPage( pageUrl, viewport, method, ...args ) {
		const page = this.pages[ pageUrl ];

		if ( ! page ) {
			throw new Error(
				`Playwright interface does not include URL ${ pageUrl }`
			);
		}

		if ( viewport ) {
			await page.setViewportSize( viewport );
		}

		// The inner window in Playwright is the directly accessible main window object.
		// The evaluating method does not need a separate window object.
		// Call inner method within the Playwright context.
		return page.evaluate( method, { innerWindow: null, args } );
	}

	/**
	 * Replacement for browser.fetch, uses node-fetch to simulate the same
	 * interface.
	 *
	 * @param {string} url     URL to fetch.
	 * @param {Object} options Fetch options.
	 * @param {string} _role   'css' or 'html' indicating what kind of thing is being fetched.
	 */
	async fetch( url, options, _role ) {
		const nodeFetch = require( 'node-fetch' );
		return nodeFetch( url, options );
	}
}

module.exports = BrowserInterfacePlaywright;
