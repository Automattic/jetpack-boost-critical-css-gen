import { Viewport } from './types';
import { BrowserInterface, BrowserRunnable } from './browser-interface';
import type { Page } from 'puppeteer';

export class BrowserInterfacePuppeteer extends BrowserInterface {
	constructor( private pages: { [ url: string ]: Page } ) {
		super();
	}

	async runInPage< ReturnType >(
		pageUrl: string,
		viewport: Viewport | null,
		method: BrowserRunnable< ReturnType >,
		...args: unknown[]
	): Promise< ReturnType > {
		const page = this.pages[ pageUrl ];

		if ( ! page ) {
			throw new Error( `Puppeteer interface does not include URL ${ pageUrl }` );
		}

		if ( viewport ) {
			await page.setViewport( viewport );
		}

		// Get the inner window to pass to inner method.
		// const window = await page.evaluateHandle( () => window );

		// The inner window in Puppeteer is the directly accessible main window object.
		// The evaluating method does not need a separate window object.
		// Call inner method within the Puppeteer context.
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
		// Special case: only import node-fetch if used, to avoid unnecessary requirements.
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const fetch = require( 'node-fetch' );

		return fetch( url, options );
	}
}
