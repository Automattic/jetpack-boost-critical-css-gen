const CSSFileSet = require( './css-file-set' );
const { removeIgnoredPseudoElements } = require( './ignored-pseudo-elements' );
const { minifyCss } = require( './minify-css' );

async function generateCriticalCSS( {
	browserInterface,
	progressCallback,
	urls,
	viewports,
	filters,
} ) {
	if ( ! progressCallback ) {
		progressCallback = () => {};
	}

	try {
		const progressSteps = 1 + urls.length * viewports.length;
		let progress = 0;

		// Gather all CSS files used by all URLs.
		const cssFiles = await CSSFileSet.collate( browserInterface, urls );
		progressCallback( ++progress, progressSteps );

		// Trim ignored rules out of all CSS ASTs.
		cssFiles.applyFilters( filters || {} );

		// Gather a record of all selectors, and which page URLs each is referenced by.
		const selectorPages = cssFiles.collateSelectorPages();
		const selectorText = Object.keys( selectorPages );

		// For each selector string, create a "trimmed" version with the stuff JavaScript can't handle cut out.
		const trimmedSelectors = selectorText.reduce( ( set, selector ) => {
			set[ selector ] = removeIgnoredPseudoElements( selector );
			return set;
		}, {} );

		// Go through all the URLs looking for above-the-fold selectors, and selectors which may be "dangerous"
		// i.e.: may match elements on pages that do not include their CSS file.
		const aboveFoldSelectors = new Set();
		const dangerousSelectors = new Set();
		const aboveFoldPreloads  = [];
		for ( const url of urls ) {
			// Work out which CSS selectors match any element on this page.
			const pageSelectors = await browserInterface.runInPage(
				url,
				null,
				( innerWindow, selText, trimmed ) => {
					return selText.filter( ( selector ) => {
						try {
							return !! innerWindow.document.querySelector(
								trimmed[ selector ]
							);
						} catch ( err ) {
							// Ignore invalid selectors.
							return false;
						}
					} );
				},
				selectorText,
				trimmedSelectors
			);

			// Check for selectors which may match this page, but are not included in this page's CSS.
			pageSelectors
				.filter( ( s ) => ! selectorPages[ s ].has( url ) )
				.forEach( ( s ) => dangerousSelectors.add( s ) );

			// Collate all above-fold selectors for all viewport sizes.
			for ( const size of viewports ) {
				progressCallback( ++progress, progressSteps );

				const pageAboveFold = await browserInterface.runInPage(
					url,
					size,
					( innerWindow, pageSel, trimmed ) => {
						const isAboveFold = ( element ) => {
							const originalClearStyle =
								element.style.clear || '';
							element.style.clear = 'none';

							const rect = element.getBoundingClientRect();

							element.style.clear = originalClearStyle;

							return rect.top < innerWindow.innerHeight;
						};

						let preloadImages = [];
						let returnData    = {};

						// Find important background images above the fold.
						const preloadBGs = innerWindow.document.querySelectorAll( '[data-preload-img]' );
						for ( const preloadBG of preloadBGs ) {
							if ( isAboveFold( preloadBG ) ) {
								preloadImages.push( {
									type: 'background',
									src: preloadBG.getAttribute( 'data-preload-img' )
								} );
							}
						}

						// Find important image elements above the fold.
						const preloadIMGs = innerWindow.document.querySelectorAll( '.fusion-imageframe .disable-lazyload' );
						for ( const preloadIMG of preloadIMGs ) {
							if ( isAboveFold( preloadIMG ) ) {
								let imageSrc = preloadIMG.getAttribute( 'src' );
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

						returnData.preloads  = preloadImages;

						returnData.selectors = pageSel.filter( ( s ) => {
							if ( '*' === trimmed[ s ] ) {
								return true;
							}

							const matches = innerWindow.document.querySelectorAll(
								trimmed[ s ]
							);
							for ( const match of matches ) {
								if ( isAboveFold( match ) ) {
									return true;
								}
							}

							return false;
						} );

						return returnData;
					},
					pageSelectors,
					trimmedSelectors
				);

				pageAboveFold.selectors.forEach( ( s ) => aboveFoldSelectors.add( s ) );
				pageAboveFold.preloads.forEach( ( p ) => aboveFoldPreloads.push( p ) );
			}
		}

		// Remove dangerous selectors from above fold set.
		for ( const dangerousSelector of dangerousSelectors ) {
			aboveFoldSelectors.delete( dangerousSelector );
		}

		// Prune each AST for above-fold selector list. Note: this prunes a clone.
		const asts = cssFiles.prunedAsts( aboveFoldSelectors );

		// Convert ASTs to CSS.
		const [ css, cssErrors ] = minifyCss(
			asts.map( ( ast ) => ast.toCSS() ).join( '\n' )
		);

		// Collect warnings / errors together.
		const warnings = cssFiles.getErrors().concat( cssErrors );

		return [ css, warnings, aboveFoldPreloads ];
	} finally {
		browserInterface.cleanup();
	}
}

module.exports = generateCriticalCSS;
