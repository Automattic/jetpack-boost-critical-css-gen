const BrowserInterface = require('./browser-interface');

class BrowserInterfacePuppeteer extends BrowserInterface {
	constructor(pages) {
		super();

		this.pages = pages;
	}

	async runInPage(pageUrl, viewport, method, ...args) {
		const page = this.pages[pageUrl];

		if (!page) {
			throw new Error('Unrecognized page URL: ' + pageUrl);
		}

		if (viewport) {
			await page.setViewport(viewport);
		}

		return page.evaluate(method, ...args);
	}
}

module.exports = BrowserInterfacePuppeteer;
