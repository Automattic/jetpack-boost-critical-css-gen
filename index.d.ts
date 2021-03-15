interface BrowserInterface {}

interface PuppeteerPage {
	setViewport( args: { width: number, height: number } ): void;
	evaluateHandle( getter: () => any ): Promise< any >;
	evaluate( method: string | ((arg1: T, ...args: any[]) => any), window: Window, ...args: any[] ): Promise< any >;
}

export declare class BrowserInterfaceIframe implements BrowserInterface {
	constructor( args?: {
		requestGetParameters?: { [ key: string ]: string },
		loadTimeout?: number,
		resizeTimeout?: number,
		verifyPage?: ( url: string, contentWindow: Window, contentDocument: Document ) => boolean,
	} );
}

export declare class BrowserInterfacePuppeteer implements BrowserInterface {
	constructor( pages: { [ url: string ]: PuppeteerPage } );
}

export interface CssFilters {
	atRules?: ( name: string ) => boolean,
	properties?: ( name: string, value: string ) => boolean,
}

export declare class CriticalCssError {
	hasUrl(): boolean;
	toJSON(): any;
	static fromJSON: ( data: any ) => Error;
}

export declare function generateCriticalCSS( args: {
	browserInterface: BrowserInterface,
	progressCallback?: ( step: number, stepCount: number ) => void,
	urls: string[],
	viewports: Array< { width: number, height: number } >,
	filters?: CssFilters,
} ): Promise< [ string, Error[] ] >;
