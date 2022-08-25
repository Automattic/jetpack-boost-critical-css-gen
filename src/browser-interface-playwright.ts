import { Viewport } from './types';
import { BrowserInterface, BrowserRunnable, FetchOptions } from './browser-interface';
import type { Page } from 'playwright';
import nodeFetch from 'node-fetch';

export class BrowserInterfacePlaywright extends BrowserInterface {
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
			throw new Error( `Playwright interface does not include URL ${ pageUrl }` );
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
	async fetch( url: string, options: FetchOptions, _role: 'css' | 'html' ) {
		return nodeFetch( url, options );
	}
}
