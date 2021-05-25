const { InternalError } = require( './errors' );

class BrowserInterface {
	// eslint-disable-next-line no-unused-vars
	async runInPage( pageUrl, viewport, method, ...args ) {
		throw new InternalError( {
			message: 'Undefined interface method: BrowserInterface.runInPage()'
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
		return {
			files: [ ...window.document.getElementsByTagName( 'link' ) ]
				.filter( ( link ) => link.rel === 'stylesheet' )
				.reduce( ( set, link ) => {
					set[ link.href ] = {
						media: link.media || null
					};

					return set;
			}, {} ),
			blocks: [ ...window.document.getElementsByTagName( 'style' ) ].filter( ( style ) => style.id === 'fusion-stylesheet-inline-css' )
				.reduce( ( set, style ) => {
					set[ style.id ] = style.innerHTML;

					return set;
			}, {} ),
		}
	}
}

module.exports = BrowserInterface;
