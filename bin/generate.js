const playwright = require( 'playwright' );
const {
	generateCriticalCSS,
	BrowserInterfacePlaywright,
} = require( '../index' );

async function main() {
	const urls = process.argv.slice( 2 );

	if ( urls.length === 0 ) {
		console.log( 'Usage: node bin/generate.js [url1] [url2] ...' );
	}

	console.log( 'Loading pages: ' );
	console.log( urls );

	const browser = await playwright.chromium.launch();
	const testPages = {};
	for ( const url of urls ) {
		testPages[ url ] = await browser.newPage();
		await testPages[ url ].goto( url );
	}

	console.log( 'Generating Critical CSS...' );

	const [ css, warnings ] = await generateCriticalCSS( {
		urls,
		viewports: [
			{ width: 414, height: 896 },
			{ width: 1200, height: 800 },
			{ width: 1920, height: 1080 },
		],
		browserInterface: new BrowserInterfacePlaywright( testPages ),
	} );

	if ( warnings.length ) {
		console.log( '\n\nwarnings => ' );
		console.log( warnings );
	}

	console.log( 'css => ' );
	console.log( css );
}

main()
	.catch( ( err ) => {
		console.error( err );
		process.exit( 1 );
	} )
	.then( () => process.exit( 0 ) );
