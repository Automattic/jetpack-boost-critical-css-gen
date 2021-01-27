const CleanCSS = require( 'clean-css' );

/**
 * Minifies the given CSS, returning it as a string. Any errors that occur are returned
 * in the second positional return value.
 *
 * If the CSS fails to minify, the original content will be returned instead.
 *
 * @param {string} css - CSS to minify.
 *
 * @return {[ string, string[] ]} - Minified CSS and a list of errors returned.
 */
function minifyCss( css ) {
	const result = new CleanCSS().minify( css );

	if ( ! result.styles ) {
		return [ css, result.errors ];
	}

	return [ result.styles, result.errors ];
}

module.exports = { minifyCss };
