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
	try {
		const progressSteps = 1 + urls.length + viewports.length;
		let progress = 0;

		// Gather all CSS files used by all URLs.
		const cssFiles = await CSSFileSet.collate( browserInterface, urls );
		progressCallback && progressCallback( ++progress, progressSteps );

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
		for ( const url of urls ) {
			// Work out which CSS selectors match any element on this page.
			const pageSelectors = await browserInterface.runInPage(
				url,
				null,
				( innerWindow, selectorText, trimmedSelectors ) => {
					return selectorText.filter( ( selector ) => {
						try {
							return !! innerWindow.document.querySelector(
								trimmedSelectors[ selector ]
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
				progressCallback &&
					progressCallback( ++progress, progressSteps );

				const pageAboveFold = await browserInterface.runInPage(
					url,
					size,
					( innerWindow, pageSelectors, trimmedSelectors ) => {
						const isAboveFold = ( element ) => {
							const originalClearStyle =
								element.style.clear || '';
							element.style.clear = 'none';

							const rect = element.getBoundingClientRect();

							element.style.clear = originalClearStyle;

							return rect.top < innerWindow.innerHeight;
						};

						return pageSelectors.filter( ( s ) => {
							if ( '*' === trimmedSelectors[ s ] ) {
								return true;
							}

							const matches = innerWindow.document.querySelectorAll(
								trimmedSelectors[ s ]
							);
							for ( const match of matches ) {
								if ( isAboveFold( match ) ) {
									return true;
								}
							}

							return false;
						} );
					},
					pageSelectors,
					trimmedSelectors
				);

				pageAboveFold.forEach( ( s ) => aboveFoldSelectors.add( s ) );
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

		return [ css, warnings ];
	} finally {
		browserInterface.cleanup();
	}
}

module.exports = generateCriticalCSS;
