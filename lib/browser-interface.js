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

	/**
	 * Context-specific wrapper for fetch; uses window.fetch in browsers, or a
	 * node library when using Puppeteer.
	 *
	 * @param {string} _url URL to fetch.
	 * @param {Object} _options Fetch options.
	 * @param {string} _role 'css' or 'html' indicating what kind of thing is being fetched.
	 */
	async fetch( _url, _options, _role ) {
		throw new Error(
			'Undefined interface method: BrowserInterface.fetch()'
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
		return {
			files: [ ...window.document.getElementsByTagName( 'link' ) ]
				.filter( ( link ) => link.rel === 'stylesheet' )
				.reduce( ( set, link ) => {
					set[ link.href ] = {
						media: link.media || null,
					};

					return set;
				}, {} ),
			blocks: [ ...window.document.getElementsByTagName( 'style' ) ]
				.filter(
					( style ) => style.id === 'fusion-stylesheet-inline-css'
				)
				.reduce( ( set, style ) => {
					set[ style.id ] = style.innerHTML;

					return set;
				}, {} ),
		};
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

		const preloadImages = [];
		const returnData = {};

		// Find important background images above the fold.
		const preloadBGs = innerWindow.document.querySelectorAll(
			'[data-preload-img]'
		);
		for ( const preloadBG of preloadBGs ) {
			if ( isAboveFold( preloadBG ) ) {
				preloadImages.push( {
					type: 'background',
					src: preloadBG.getAttribute( 'data-preload-img' ),
				} );
			}
		}

		// Find important image elements above the fold.
		const preloadIMGs = innerWindow.document.querySelectorAll(
			'.fusion-imageframe .disable-lazyload'
		);
		for ( const preloadIMG of preloadIMGs ) {
			if ( isAboveFold( preloadIMG ) ) {
				const imageSrc = preloadIMG.getAttribute( 'src' );
				if ( 'string' === typeof imageSrc ) {
					preloadImages.push( {
						type: 'image',
						src: imageSrc,
						srcset: preloadIMG.getAttribute( 'srcset' ),
						sizes: preloadIMG.getAttribute( 'sizes' ),
					} );
				}
			}
		}

		returnData.preloads = preloadImages;

		returnData.selectors = pageSelectors.filter( ( s ) => {
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

		return returnData;
	}
}

module.exports = BrowserInterface;
