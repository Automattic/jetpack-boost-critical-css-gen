const { InternalError } = require( './errors' );

class BrowserInterface {
	// eslint-disable-next-line no-unused-vars
	async runInPage( pageUrl, viewport, method, ...args ) {
		throw new InternalError( {
			message: 'Undefined interface method: BrowserInterface.runInPage()'
		} );
	}

	async cleanup() {}

	async getCssUrls( pageUrl ) {
		return await this.runInPage(
			pageUrl,
			null,
			BrowserInterface.innerGetCssUrls
		);
	}

	static innerGetCssUrls( window ) {
		return [ ...window.document.getElementsByTagName( 'link' ) ]
			.filter( ( link ) => link.rel === 'stylesheet' )
			.map( ( link ) => link.href );
	}
}

module.exports = BrowserInterface;
