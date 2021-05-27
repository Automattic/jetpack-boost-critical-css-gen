const { InternalError } = require( './errors' );

class BrowserInterface {
	constructor() {
		this.urlErrors = {};
	}

	trackUrlError( url, error ) {
		this.urlErrors.urlErrors[ url ] = error;
	}

	filterValidUrls( urls ) {
		return urls.filter( ( url ) => ! this.urlErrors[ url ] );
	}

	// eslint-disable-next-line no-unused-vars
	async runInPage( pageUrl, viewport, method, ...args ) {
		throw new InternalError( {
			message: 'Undefined interface method: BrowserInterface.runInPage()',
		} );
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
}

module.exports = BrowserInterface;
