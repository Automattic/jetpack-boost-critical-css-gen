/**
 * Add get parameters to an URL.
 *
 * @param {string} url - URL to add the parameters to.
 * @param {Object} parameters - Parameters. E.g.: {jb-generate-critical-css: "00272ca1a3"}
 *
 * @return {string} - URL including the get parameters.
 */
function addGetParameters( url, parameters ) {
	const urlObject = new URL( url );
	for ( const key of Object.keys( parameters ) ) {
		urlObject.searchParams.append( key, parameters[ key ] );
	}

	return urlObject.toString();
}

module.exports = { addGetParameters };
