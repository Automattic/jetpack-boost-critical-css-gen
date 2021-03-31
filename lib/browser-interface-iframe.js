const BrowserInterface = require( './browser-interface' );
const {
	ConfigurationError,
	CrossDomainError,
	HttpError,
	GenericUrlError,
	LoadTimeoutError,
	UrlVerifyError,
} = require( './errors' );

const defaultLoadTimeout = 60 * 1000;
const defaultResizeTimeout = 1 * 1000;

class BrowserInterfaceIframe extends BrowserInterface {
	constructor( {
		requestGetParameters,
		loadTimeout,
		resizeTimeout,
		verifyPage,
		allowScripts,
	} = {} ) {
		super();

		this.requestGetParameters = requestGetParameters || {};
		this.loadTimeout = loadTimeout || defaultLoadTimeout;
		this.resizeTimeout = resizeTimeout || defaultResizeTimeout;
		this.verifyPage = verifyPage;

		// Default 'allowScripts' to true if not specified.
		allowScripts = ( allowScripts !== false );

		if ( ! verifyPage ) {
			throw new ConfigurationError( {
				message: 'You must specify a page verification callback',
			} );
		}

		this.currentUrl = null;
		this.currentSize = { width: undefined, height: undefined };

		// Create a wrapper div to keep the iframe invisible.
		this.wrapperDiv = document.createElement( 'div' );
		this.wrapperDiv.setAttribute(
			'style',
			'position:fixed; z-index: -1000; opacity: 0; top: 50px;'
		);
		document.body.append( this.wrapperDiv );

		// Create iframe itself.
		this.iframe = document.createElement( 'iframe' );
		this.iframe.setAttribute(
			'style',
			'max-width: none; max-height: none; border: 0px;'
		);
		this.iframe.setAttribute( 'aria-hidden', 'true' );
		this.iframe.setAttribute(
			'sandbox',
			'allow-same-origin ' + ( allowScripts ? 'allow-scripts' : '' )
		);
		this.wrapperDiv.append( this.iframe );
	}

	cleanup() {
		this.iframe.remove();
		this.wrapperDiv.remove();
	}

	async runInPage( pageUrl, viewport, method, ...args ) {
		await this.loadPage( pageUrl );

		if ( viewport ) {
			await this.resize( viewport );
		}

		return method( this.iframe.contentWindow, ...args );
	}

	addGetParameters( rawUrl ) {
		const urlObject = new URL( rawUrl );
		for ( const key of Object.keys( this.requestGetParameters ) ) {
			urlObject.searchParams.append(
				key,
				this.requestGetParameters[ key ]
			);
		}

		return urlObject.toString();
	}

	async diagnoseUrlError( url ) {
		try {
			const response = await fetch( url );
			if ( response.status === 200 ) {
				return null;
			}

			return new HttpError( { url, code: response.status } );
		} catch ( err ) {
			return new GenericUrlError( { url, message: err.message } );
		}
	}

	async loadPage( rawUrl ) {
		if ( rawUrl === this.currentUrl ) {
			return;
		}

		const fullUrl = this.addGetParameters( rawUrl );

		await new Promise( ( resolve, reject ) => {
			// Set a timeout.
			const timeoutId = setTimeout( () => {
				this.iframe.onload = undefined;
				reject( new LoadTimeoutError( { url: fullUrl } ) );
			}, this.loadTimeout );

			// Catch load event.
			this.iframe.onload = async () => {
				try {
					this.iframe.onload = undefined;
					clearTimeout( timeoutId );

					// Verify the inner document is readable.
					if ( ! this.iframe.contentDocument ) {
						throw new CrossDomainError( { url: fullUrl } );
					}

					if (
						! this.verifyPage(
							rawUrl,
							this.iframe.contentWindow,
							this.iframe.contentDocument
						)
					) {
						// Diagnose and throw an appropriate error.
						throw (
							( await this.diagnoseUrlError( fullUrl ) ) ||
							new UrlVerifyError( { url: fullUrl } )
						);
					}

					resolve();
				} catch ( err ) {
					reject( err );
				}
			};

			this.iframe.src = fullUrl;
		} );
	}

	async resize( { width, height } ) {
		if (
			this.currentSize.width === width &&
			this.currentSize.height === height
		) {
			return;
		}

		return new Promise( ( resolve ) => {
			// Set iframe size.
			this.iframe.width = width;
			this.iframe.height = height;

			// Wait for an animation frame, indicating resize complete.
			this.iframe.contentWindow.requestAnimationFrame( () => {
				// After receiving an animation frame, bounce to main loop to ensure paint finished.
				this.iframe.contentWindow.setTimeout( resolve, 1 );
			} );

			// Set a back-stop timeout; if it takes longer than a second, assume it's done.
			setTimeout( resolve, this.resizeTimeout );
		} );
	}
}

module.exports = BrowserInterfaceIframe;
