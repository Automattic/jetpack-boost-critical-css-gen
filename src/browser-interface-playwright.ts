import { Viewport } from './types';
import { BrowserInterface } from './browser-interface';

// Avoid actually important Playwright; caller can use it if they want.
// Just define enough of an interface to satisfy the caller.
interface Page {
	setViewportSize: ( viewport: Viewport ) => Promise< void >;
	evaluate: ( fn: Function | string, arg?: any ) => Promise< any >;
};

export class BrowserInterfacePlaywright extends BrowserInterface {
	constructor( private pages: { [ url: string ]: Page } ) {
		super();
	}

	async runInPage< ReturnType >(
		pageUrl: string,
		viewport: Viewport | null,
		method: Function | string,
		...args: any[]
	): Promise< ReturnType > {
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
	async fetch( url: string, options: RequestInit, _role: 'css' | 'html' ) {
		const fetch = require( 'node-fetch' );
		return fetch( url, options );
	}
}
