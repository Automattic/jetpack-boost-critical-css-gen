const BrowserInterface = require( './browser-interface' );
const {
	CrossDomainError,
	HttpError,
	LoadTimeoutError,
	RedirectError,
	UrlVerifyError,
	UnknownError,
	XFrameDenyError,
} = require( './errors' );

const defaultLoadTimeout = 60 * 1000;

class BrowserInterfaceIframe extends BrowserInterface {
	constructor( {
		requestGetParameters,
		loadTimeout,
		verifyPage,
		allowScripts,
	} = {} ) {
		super();

		this.requestGetParameters = requestGetParameters || {};
		this.loadTimeout = loadTimeout || defaultLoadTimeout;
		this.verifyPage = verifyPage;

		// Default 'allowScripts' to true if not specified.
		allowScripts = allowScripts !== false;

		if ( ! verifyPage ) {
			throw new Error( 'You must specify a page verification callback' );
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

	/**
	 * Wrapper for window.fetch. Overload this to change CSS or HTML fetching
	 * behaviour.
	 *
	 * @param {string} url     URL to fetch.
	 * @param {Object} options Fetch options.
	 * @param {string} _role   'css' or 'html' indicating what kind of thing is being fetched.
	 */
	async fetch( url, options, _role ) {
		return window.fetch( url, options );
	}

	async runInPage( pageUrl, viewport, method, ...args ) {
		await this.loadPage( pageUrl );

		if ( viewport ) {
			await this.resize( viewport );
		}

		// The inner window in the iframe is separate from the main window object.
		// Pass the iframe window object to the evaluating method.
		return method( { innerWindow: this.iframe.contentWindow, args } );
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
			const response = await this.fetch(
				url,
				{ redirect: 'manual' },
				'html'
			);
			const headers = response.headers;

			if ( headers.get( 'x-frame-options' ) === 'DENY' ) {
				return new XFrameDenyError( { url } );
			}

			if ( response.type === 'opaqueredirect' ) {
				return new RedirectError( {
					url,
					redirectUrl: response.url,
				} );
			}

			if ( response.status === 200 ) {
				return null;
			}

			return new HttpError( { url, code: response.status } );
		} catch ( err ) {
			return new UnknownError( { url, message: err.message } );
		}
	}

	sameOrigin( url ) {
		return new URL( url ).origin === window.location.origin;
	}

	async loadPage( rawUrl ) {
		if ( rawUrl === this.currentUrl ) {
			return;
		}

		const fullUrl = this.addGetParameters( rawUrl );

		await new Promise( ( resolve, rawReject ) => {
			// Track all URL errors.
			const reject = ( err ) => {
				this.trackUrlError( rawUrl, err );
				rawReject( err );
			};

			// Catch cross-domain errors before they occur.
			if ( ! this.sameOrigin( fullUrl ) ) {
				reject( new CrossDomainError( { url: fullUrl } ) );
				return;
			}

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
						throw (
							( await this.diagnoseUrlError( fullUrl ) ) ||
							new CrossDomainError( { url: fullUrl } )
						);
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

			// Bounce to browser main loop to allow resize to complete.
			setTimeout( resolve, 1 );
		} );
	}
}

module.exports = BrowserInterfaceIframe;
