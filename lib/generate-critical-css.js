const CSSFileSet = require( './css-file-set' );
const { removeIgnoredPseudoElements } = require( './ignored-pseudo-elements' );
const { minifyCss } = require( './minify-css' );
const { SuccessTargetError, EmptyCSSError } = require( './errors' );
const BrowserInterface = require( './browser-interface' );

/**
 * Collate and return a CSSFileSet object describing all the CSS files used by
 * the set of URLs provided.
 *
 * Errors that occur during this process are collated, but not thrown yet.
 *
 * @param {BrowserInterface} browserInterface - interface to access pages
 * @param {string[]} urls - list of URLs to scan for CSS files
 * @param {number} successUrlsThreshold - success urls amount threshold
 * @return {Array} - Two member array; CSSFileSet, and an object containing errors that occurred at each URL.
 */
async function collateCssFiles( browserInterface, urls, successUrlsThreshold ) {
	const cssFiles = new CSSFileSet();
	const errors = {};
	let successes = 0;

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

			// Abort early if we hit the threshold of success urls.
			successes++;
			if ( successes >= successUrlsThreshold ) {
				break;
			}
		} catch ( err ) {
			errors[ url ] = err;
		}
	}

	return [ cssFiles, errors ];
}

async function generateCriticalCSS( {
	browserInterface,
	progressCallback,
	urls,
	viewports,
	filters,
	successRatio = 1,
} ) {
	const successUrlsThreshold = Math.ceil( urls.length * successRatio );

	try {
		progressCallback = progressCallback || ( () => {} );
		const progressSteps = 1 + urls.length * viewports.length;
		let progress = 0;

		// Collate all CSS Files used by all valid URLs.
		const [ cssFiles, cssFileErrors ] = await collateCssFiles(
			browserInterface,
			urls,
			successUrlsThreshold
		);
		progressCallback( ++progress, progressSteps );

		// Verify there are enough valid URLs to carry on with.
		const validUrls = browserInterface.filterValidUrls( urls );

		if ( validUrls.length < successUrlsThreshold ) {
			throw new SuccessTargetError( cssFileErrors );
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

		for ( const url of validUrls.slice( 0, successUrlsThreshold ) ) {
			// Work out which CSS selectors match any element on this page.
			const pageSelectors = await browserInterface.runInPage(
				url,
				null,
				BrowserInterface.innerFindMatchingSelectors,
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
					BrowserInterface.innerFindAboveFoldSelectors,
					trimmedSelectors,
					pageSelectors
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

		// If there is no Critical CSS, it means the URLs did not have any CSS in their external style sheet(s).
		if ( ! css ) {
			const emptyCSSErrors = {};
			for ( const url of validUrls ) {
				emptyCSSErrors[ url ] = new EmptyCSSError( { url } );
			}
			throw new SuccessTargetError( emptyCSSErrors );
		}

		// Collect warnings / errors together.
		const warnings = cssFiles.getErrors().concat( cssErrors );

		return [ css, warnings ];
	} finally {
		browserInterface.cleanup();
	}
}

module.exports = generateCriticalCSS;
