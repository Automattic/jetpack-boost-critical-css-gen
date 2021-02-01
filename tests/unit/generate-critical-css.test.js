/* global browser */

const { generateCriticalCSS, BrowserInterfacePuppeteer } = require( '../../index' );
const { dataUrl } = require( '../lib/data-directory' );
const mockFetch = require( '../lib/mock-fetch' );
const path = require( 'path' );

jest.mock( 'node-fetch' );
require( 'node-fetch' ).mockImplementation( mockFetch );

describe( 'Generate Critical CSS', () => {

	describe( 'Inclusions and Exclusions', () => {

		it( 'Excludes elements below the fold', async () => {
			const url = path.join( dataUrl, 'page-a/index.html' );
			const page = await browser.newPage();
			await page.goto( url );

			const pages = {
				[ url ]: page,
			};

			// Viewport settings to check, and which selectors should and should not appear:
			const testSets = [
				{
					viewports: [ { width: 640, height: 480 } ],
					shouldContain: [ 'div.top' ],
					shouldNotContain: [ 'div.four_eighty', 'div.six_hundred', 'div.seven_sixty_eight', 'div.media_800_plus' ],
				},

				{
					viewports: [ { width: 800, height: 600 } ],
					shouldContain: [ 'div.top', 'div.four_eighty', 'div.media_800_plus' ],
					shouldNotContain: [ 'div.eight_hundred', 'div.seven_sixty_eight' ],
				}
			];

			for ( const { viewports, shouldContain, shouldNotContain } of testSets ) {
				const [css, warnings] = await generateCriticalCSS({
					urls: [ url ],
					viewports,
					browserInterface: new BrowserInterfacePuppeteer(pages),
				});

				expect( warnings ).toHaveLength( 0 );

				for ( const should of shouldContain ) {
					expect( css ).toContain( should );
				}

				for ( const shouldNot of shouldNotContain ) {
					expect( css ).not.toContain( shouldNot );
				}
			}
		} );

	} );

} );