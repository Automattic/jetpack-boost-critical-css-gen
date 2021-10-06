class BrowserInterface {
	constructor() {
		this.urlErrors = {};
	}

	trackUrlError( url, error ) {
		this.urlErrors[ url ] = error;
	}

	filterValidUrls( urls ) {
		return urls.filter( ( url ) => ! this.urlErrors[ url ] );
	}

	// eslint-disable-next-line no-unused-vars
	async runInPage( pageUrl, viewport, method, ...args ) {
		throw new Error(
			'Undefined interface method: BrowserInterface.runInPage()'
		);
	}

	async cleanup() {}

	async getCssIncludes( pageUrl ) {
		return await this.runInPage(
			pageUrl,
			null,
			BrowserInterface.innerGetCssIncludes
		);
	}

	static innerGetCssIncludes( window ) {
		return [ ...window.document.getElementsByTagName( 'link' ) ]
			.filter( ( link ) => link.rel === 'stylesheet' )
			.reduce( ( set, link ) => {
				set[ link.href ] = {
					media: link.media || null,
				};

				return set;
			}, {} );
	}

	/**
	 * Given a set of CSS selectors (as object keys), along with "simplified" versions
	 * for easy querySelector calling (values), return an array of selectors which match
	 * _any_ element on the page.
	 *
	 * @param {Window} innerWindow - Window inside the browser interface.
	 * @param {Object} selectors - Map containing selectors (object keys), and simplified versions for easy matching (values).
	 */
	static innerFindMatchingSelectors( innerWindow, selectors ) {
		return Object.keys( selectors ).filter( ( selector ) => {
			try {
				return !! innerWindow.document.querySelector(
					selectors[ selector ]
				);
			} catch ( err ) {
				// Ignore invalid selectors.
				return false;
			}
		} );
	}

	/**
	 * Given a set of CSS selectors (as object keys), along with "simplified" versions
	 * for easy querySelector calling (values), return an array of selectors which match
	 * any above-the-fold element on the page.
	 *
	 * @param {Window} innerWindow - Window inside the browser interface.
	 * @param {Object} selectors - Map containing selectors (object keys), and simplified versions for easy matching (values).
	 * @param {string[]} pageSelectors - String array containing selectors that appear anywhere on this page (as returned by innerFindMatchingSelectors) - should be a subset of keys in selectors.
	 */
	static innerFindAboveFoldSelectors(
		innerWindow,
		selectors,
		pageSelectors
	) {
		/**
		 * Inner helper function used inside browser / iframe to check if the given
		 * element is "above the fold".
		 *
		 * @param {HTMLElement} element - Element to check.
		 */
		const isAboveFold = ( element ) => {
			const originalClearStyle = element.style.clear || '';
			element.style.clear = 'none';

			const rect = element.getBoundingClientRect();

			element.style.clear = originalClearStyle;

			return rect.top < innerWindow.innerHeight;
		};

		return pageSelectors.filter( ( s ) => {
			if ( '*' === selectors[ s ] ) {
				return true;
			}

			const matches = innerWindow.document.querySelectorAll(
				selectors[ s ]
			);
			for ( const match of matches ) {
				if ( isAboveFold( match ) ) {
					return true;
				}
			}

			return false;
		} );
	}
}

module.exports = BrowserInterface;
