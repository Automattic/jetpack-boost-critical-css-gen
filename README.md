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

# Releasing new version
- Update the const `version` in `src/index.ts`
- Update version number in `package.json`
- Commit your changes
- Create a new release in [jetpack-boost-critical-css-gen](https://github.com/Automattic/jetpack-boost-critical-css-gen/releases/new)
	- Create a new tag in the release with the release version with the format `release-x.x.x`
	- The release title will be the same as the tag.
	- Click "Generate release notes" to automatically generate new release note.
	- Publish

# Local development
Since we generally do development in docker, it is hard to test this with Jetpack Boost. `npm link` does not work in this case.
To get around this issue, we can use `yalc` and do some customization to make development and testing easy. Here is what to do:

- Run `npm -g yalc` to install yalc globally.
- Run `yalc publish` from this package directory to publish this locally as a yalc repository.
- Go to your jetpack boost folder (`jetpack/projects/packages/boost`).
- Run `yalc link jetpack-boost-critical-css-gen` to link from this the dependency to this library.
- Now every time you want to sync changes, use `yalc push` from this library.

See: pc9hqz-1NI-p2
