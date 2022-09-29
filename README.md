# jetpack-boost-critical-css-gen
Critical CSS Generator built for Jetpack Boost. It can generate Critical CSS on the server-side using Puppeteer, or on the client-side using iframes. It also supports generating blocks of Critical CSS that can apply to multiple URLs, and/or multiple viewports.

# Warning
This is a work in progress, and its API is not guaranteed to be stable. :)

# Basic API
```
const { BrowserInterfacePlaywright, BrowserInterfacePuppeteer, BrowserInterfaceIframe, generateCriticalCSS } = require( 'jetpack-boost-critical-css-gen' );
const [css, warnings] = generateCriticalCSS( options );
```

Where `options` is an object with the following keys:
- `urls` (required) - An array of URLs to generate Critical CSS for.
- `viewports` (required) - An array of viewport sizes to generate Critical CSS for. Each entry should be an object with a `width` and `height` property.
- `browserInterface` (required) - An instance of `BrowserInterfacePlaywright` or `BrowserInterfacePuppeteer` or `BrowserInterfaceIframe` which defines an interface for the Generator to query the (real or virtual) browser.
- `progressCallback` - A callback to receive progress information, with two arguments; `step` and `stepCount`. Each are integers; progress percentage can be expressed in the form `percentage = step * 100 / stepCount`.
- `filters` - An object describing a filter to run each property and/or atRule through for inclusion.

Example usage with an IFrame:
```javascript
  const { BrowserInterfaceIframe, generateCriticalCSS } = require( 'jetpack-boost-critical-css-gen' );
  
  const [css, warnings] = await generateCriticalCSS( {
    urls: [ 'http://example.com' ],
    viewports: [ { width: 800, height: 600 } ],
    progressCallback: ( step, stepCount ) => { console.log( `Step ${ step } of ${ stepCount }.` ); },
    browserInterface: new BrowserInterfaceIframe( {} ),
    filters: {
      properties: ( key, value ) => {
        return ! /^\s*url\s*\(/.test( value );
      },
    },
  } );
```

Example usage in TypeScript with Playwright:
```typescript
import { chromium, Page } from 'playwright';
import { BrowserInterfacePlaywright, generateCriticalCSS } from 'jetpack-boost-critical-css-gen';

async function playwrightGenerator( urls: string[] ): Promise< string > {
	const browser = await chromium.launch();
	const context = await browser.newContext();

	// Open playwright pages for each URL.
	const pages: { [ url: string ]: Page } = {};
	for ( const url of urls ) {
		pages[ url ] = await context.newPage();
		await pages[ url ].goto( url );
	}

	// Call the Critical CSS generator.
	const [ css, warnings ] = await generateCriticalCSS( {
		urls,
		viewports: [
			{ width: 640, height: 480 },
			{ width: 1024, height: 768 },
			{ width: 1280, height: 1024 },
		],
		browserInterface: new BrowserInterfacePlaywright( pages ),
	} );

	if ( warnings.length ) {
		console.warn( warnings );
	}

	return css;
}
```
