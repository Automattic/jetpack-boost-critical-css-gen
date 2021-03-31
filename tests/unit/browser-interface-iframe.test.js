/* global browser, TestGenerator */

const path = require( 'path' );
const TestServer = require( '../lib/test-server' );
const { dataDirectory } = require( '../lib/data-directory' );

let testServer = null;

describe( 'Iframe interface', () => {

	// Start test server to serve wrapped content.
	beforeAll( async () => {
		testServer = new TestServer( {
			'page-a': path.join( dataDirectory, 'page-a' ),
		} );
		await testServer.start();
	} );

	// Kill test server.
	afterAll( async () => {
		if ( testServer ) {
			await testServer.stop();
			testServer = null;
		}
	} );

	it( 'Successfully generates via iframes', async () => {
		const page = await browser.newPage();
		await page.goto( testServer.getUrl() );

		const innerUrl = path.join( testServer.getUrl(), 'page-a' );

		const [ css, warnings ] = await page.evaluate( ( url ) => {
			return TestGenerator.generateCriticalCSS( {
				urls: [ url ],
				viewports: [ { width: 640, height: 480 } ],
				browserInterface: new TestGenerator.BrowserInterfaceIframe( {
					verifyPage: ( url, innerWindow, innerDocument) => {
						return !! innerDocument.querySelector( 'meta[name="testing-page"]' );
					}
				} ),
			} );
		}, innerUrl );

		expect( warnings ).toHaveLength( 0 );
		expect( css ).toContain( 'div.top' );

		await page.close();
	} );

	it( 'Allows scripts if not explicitly turned off', async () => {
		const page = await browser.newPage();
		await page.goto( testServer.getUrl() );

		const innerUrl = path.join( testServer.getUrl(), 'page-a' );

		// Will throw an error if the inner page does not contain
		// 'script-created-content'; a string appended to page-a by a script.
		await page.evaluate( async ( url ) => {
			const iframeInterface = new TestGenerator.BrowserInterfaceIframe( {
				verifyPage: ( url, innerWindow, innerDocument) => {
					return innerDocument.documentElement.innerHTML.includes( 'script-created-content' );
				}
			} )

			await iframeInterface.loadPage( url );
		}, innerUrl );

		await page.close();
	} );

	it( 'Blocks scripts if turned off', async () => {
		const page = await browser.newPage();
		await page.goto( testServer.getUrl() );

		const innerUrl = path.join( testServer.getUrl(), 'page-a' );

		// Will throw an error if the inner page contains
		// 'script-created-content'; a string appended to page-a by a script.
		await page.evaluate( async ( url ) => {
			const iframeInterface = new TestGenerator.BrowserInterfaceIframe( {
				verifyPage: ( url, innerWindow, innerDocument) => {
					return ! innerDocument.documentElement.innerHTML.includes( 'script-created-content' );
				},
				allowScripts: false,
			} )

			await iframeInterface.loadPage( url );
		}, innerUrl );

		await page.close();
	} );

	it( 'Can successfully generate using an iframe with JavaScript off', async () => {
		const page = await browser.newPage();
		await page.goto( testServer.getUrl() );

		const innerUrl = path.join( testServer.getUrl(), 'page-a' );

		const [ css, warnings ] = await page.evaluate( ( url ) => {
			return TestGenerator.generateCriticalCSS( {
				urls: [ url ],
				viewports: [ { width: 640, height: 480 } ],
				browserInterface: new TestGenerator.BrowserInterfaceIframe( {
					verifyPage: ( url, innerWindow, innerDocument) => {
						return !! innerDocument.querySelector( 'meta[name="testing-page"]' );
					},
					allowScripts: false,
				} ),
			} );
		}, innerUrl );

		expect( warnings ).toHaveLength( 0 );
		expect( css ).toContain( 'div.top' );

		await page.close();
	} );

} );
