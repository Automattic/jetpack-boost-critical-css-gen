/**
 * Modify playwright or puppeteer page object to add additional properties
 *
 * @param page playwright page object
 */
export function preparePage( page ) {
	// Initialize a flag to track whether the event listener is attached
	if ( ! page._statusCodeListenerAttached ) {
		page._statusCodeListenerAttached = true;

		page.on( 'response', async response => {
			if ( response.url() === page._gotoUrl ) {
				page._statusCode = response.status();
			}
		} );
	}

	page.gotoWithStatus = async function ( url, options ) {
		this._statusCode = null;
		this._gotoUrl = url;

		return await page.goto.call( this, url, options );
	};
}
