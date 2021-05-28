const CSSFileSet = require( './css-file-set' );
const { removeIgnoredPseudoElements } = require( './ignored-pseudo-elements' );
const { minifyCss } = require( './minify-css' );
const { SuccessTargetError } = require( './errors' );
const { BrowserInterface } = require( './browser-interface' );

/**
 * Collate and return a CSSFileSet object describing all the CSS files used by
 * the set of URLs provided.
 *
 * URLs which fail to load generate warnings, but do not stop the process.
 *
 * @param {BrowserInterface} browserInterface - interface to access pages
 * @param {string[]} urls - list of URLs to scan for CSS files
 * @return {CSSFileSet} - Set of CSS files used by the urls.
 */
async function collateCssFiles( browserInterface, urls ) {
	const cssFiles = new CSSFileSet();
	const warnings = [];

	for ( const url of urls ) {
		try {
			const cssIncludes = await browserInterface.getCssIncludes( url );

			// Convert relative URLs to absolute.
			const relativeUrls = Object.keys( cssIncludes );
			const absoluteIncludes = relativeUrls.reduce( ( set, relative ) => {
				const absolute = new URL( relative, url ).toString();
				set[ absolute ] = cssIncludes[ relative ];

				return set;
			}, {} );

			await cssFiles.addMultiple( url, absoluteIncludes );
		} catch ( err ) {
			warnings.push( err );
		}
	}

	return [ cssFiles, warnings ];
}

async function generateCriticalCSS( {
	browserInterface,
	progressCallback,
	urls,
	viewports,
	filters,
	successTargets,
} ) {
	// Ensure successTargets minimum isn't too low.
	if ( successTargets && successTargets.min < urls.length ) {
		successTargets.min = urls.length;
	}

	try {
		progressCallback = progressCallback || ( () => {} );
		const progressSteps = 1 + urls.length * viewports.length;
		let progress = 0;

		// Collate all CSS Files used by all URLs.
		const [ cssFiles, fileWarnings ] = await collateCssFiles(
			browserInterface,
			urls
		);
		progressCallback( ++progress, progressSteps );

		// Verify there are enough valid URLs to carry on with.
		const validUrls = browserInterface.filterValidUrls( urls );
		if ( successTargets && validUrls.length < successTargets.min ) {
			throw new SuccessTargetError( { pageErrors: fileWarnings } );
		}

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
		const maxTarget = successTargets && successTargets.max;
		for ( const url of validUrls.slice( 0, maxTarget ) ) {
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

						return pageSel.filter( ( s ) => {
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
