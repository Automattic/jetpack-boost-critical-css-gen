const StyleAST = require('./style-ast');
const fetch =
	(typeof window !== 'undefined' && window.fetch) || require('node-fetch');

// Maximum number of iterations when pruning unused variables.
const maxVarPruneIterations = 10;

/**
 * Represents a set of CSS files found on one or more HTML page. Automatically de-duplicates
 * CSS files by URL and by content, and parses each into an Abstract Syntax Tree. Also tracks
 * all errors that occur while loading or parsing CSS.
 */
class CSSFileSet {
	constructor() {
		this.knownUrls = {};
		this.cssFiles = [];
		this.errors = [];
	}

	/**
	 * Add an array of CSS URLs from an HTML page to this set.
	 *
	 * @param {string} page - URL of the page the CSS URLs were found on.
	 * @param {string[]} cssUrls - The CSS file URLs.
	 */
	async addMultiple(page, cssUrls) {
		return Promise.all(cssUrls.map((cssUrl) => this.add(page, cssUrl)));
	}

	/**
	 * Add a CSS URL from an HTML page to this set.
	 *
	 * @param {string} page - URL of the page the CSS URL was found on.
	 * @param {string} cssUrl - The CSS file URL.
	 */
	async add(page, cssUrl) {
		// Add by reference if we already know this file.
		if (Object.prototype.hasOwnProperty.call(this.knownUrls, cssUrl)) {
			if (this.knownUrls[cssUrl] instanceof Error) {
				// We already know this URL failed. Bail early.
				return;
			}

			this.addExtraReference(page, cssUrl, this.knownUrls[cssUrl]);
			return;
		}

		// Try to load this URL.
		try {
			const response = await fetch(cssUrl);
			if (!response.ok) {
				throw new Error('Invalid response.');
			}

			this.storeCss(page, cssUrl, await response.text());
		} catch (err) {
			const wrapped = `Error while attempting to load CSS at ${cssUrl}: ${err.message}`;
			this.storeError(cssUrl, new Error(wrapped));
		}
	}

	/**
	 * Collates an object describing the selectors found in the CSS files in this set, and which
	 * HTML page URLs include them (via CSS files)
	 *
	 * @return {Object} - An object with selector text keys, each containing a Set of page URLs (strings)
	 */
	collateSelectorPages() {
		const selectors = {};

		for (const file of this.cssFiles) {
			file.ast.forEachSelector((selector) => {
				if (!selectors[selector]) {
					selectors[selector] = new Set();
				}

				file.pages.forEach((pageUrl) =>
					selectors[selector].add(pageUrl)
				);
			});
		}

		return selectors;
	}

	/**
	 * Returns a new AST which is pruned appropriately for the specified contentWindow, and the
	 * set of selectors that are worth keeping. (i.e.: appear above the fold).
	 *
	 * @param {Set<string>} usefulSelectors - Set of selectors to keep.
	 */
	prunedAsts(usefulSelectors) {
		// Perform basic pruning.
		let asts = this.cssFiles.map((file) => {
			return file.ast.pruned(usefulSelectors);
		});

		// Repeatedly prune unused variables (up to maxVarPruneIterations), to catch vars which are
		// only used to define other vars which aren't used.
		let prevUsedVariables;
		for (let i = 0; i < maxVarPruneIterations; i++) {
			// Gather the set of used variables.
			const usedVariables = asts.reduce((set, ast) => {
				ast.getUsedVariables().forEach((v) => set.add(v));
				return set;
			}, new Set());

			// If the number of used vars hasn't changed since last iteration, stop early.
			if (
				prevUsedVariables &&
				prevUsedVariables.size === usedVariables.size
			) {
				break;
			}

			// Prune unused variables, keep a sum of pruned variables.
			const prunedCount = asts.reduce((sum, ast) => {
				sum += ast.pruneUnusedVariables(usedVariables);
				return sum;
			}, 0);

			// If no variables were pruned this iteration, stop early.
			if (prunedCount === 0) {
				break;
			}

			prevUsedVariables = usedVariables;
		}

		// Find all fonts used across all ASTs, and prune all that are not referenced.
		const fontWhitelist = asts.reduce((set, ast) => {
			ast.getUsedFontFamilies().forEach((font) => set.add(font));
			return set;
		}, new Set());

		// Remove any fonts that aren't used above the fold.
		asts.forEach((ast) => ast.pruneNonCriticalFonts(fontWhitelist));

		// Throw away any ASTs without rules.
		asts = asts.filter((ast) => ast.ruleCount() > 0);

		return asts;
	}

	/**
	 * Internal method: Store the specified css found at the cssUrl for an HTML page,
	 * de-duplicating CSS files by content along the way.
	 *
	 * @param {string} page - URL of HTML page this CSS file was found on.
	 * @param {string} cssUrl - URL of the CSS file.
	 * @param {string} css - Content of the CSS File.
	 */
	storeCss(page, cssUrl, css) {
		// De-duplicate css contents in case cache busters in URLs or WAFs, etc confound URL de-duplication.
		const matchingFile = this.cssFiles.find((file) => file.css === css);
		if (matchingFile) {
			this.addExtraReference(page, cssUrl, matchingFile);
			return;
		}

		// Parse the CSS into an AST.
		const ast = StyleAST.parse(css);

		const file = { css, ast, pages: [page], urls: [cssUrl] };
		this.knownUrls[cssUrl] = file;
		this.cssFiles.push(file);
	}

	/**
	 * Internal method: Add an extra reference to a previously known CSS file found either
	 * on a new HTML page, or at a new URL.
	 *
	 * @param {string} page - URL of the page this CSS file was found on.
	 * @param {string} cssUrl - URL of the CSS File.
	 * @param {Object} matchingFile - Internal CSS File object.
	 */
	addExtraReference(page, cssUrl, matchingFile) {
		this.knownUrls[cssUrl] = matchingFile;
		matchingFile.pages.push(page);

		if (!matchingFile.urls.includes(cssUrl)) {
			matchingFile.urls.push(cssUrl);
		}
	}

	/**
	 * Stores an error that occurred while fetching or parsing CSS at the given URL.
	 *
	 * @param {string} url - CSS URL that failed to fetch or parse.
	 * @param {Error} err - Error object describing the problem.
	 */
	storeError(url, err) {
		this.knownUrls[url] = err;
		this.errors.push(err);
	}

	/**
	 * Returns a list of errors that occurred while fetching or parsing these CSS files.
	 *
	 * @return {Error[]} - List of errors that occurred.
	 */
	getErrors() {
		return this.errors;
	}

	static async collate(browserInterface, urls) {
		const cssFiles = new CSSFileSet();

		for (const url of urls) {
			// Code for fetching CSS dependencies by asking PHP. Relies on cooperation with the plugin.
			/* const cssUrls = await queryPage(url, null, () => {
				// TODO: Dependence on Jetpack_Boost will have be removed if this is to become a standalone library.
				if (
					!window.Jetpack_Boost ||
					!window.Jetpack_Boost.generatorCssUrls
				) {
					throw new Error(
						'Failed to find a list of registered CSS URLs in the output'
					);
				}

				return window.Jetpack_Boost.generatorCssUrls;
			}); */

			// Alternate code for fetching CSS dependencies directly from the DOM.
			const cssUrls = await browserInterface.getCssUrls(url);

			await cssFiles.addMultiple(
				url,
				cssUrls.map((relative) => new URL(relative, url).toString())
			);
		}

		return cssFiles;
	}
}

module.exports = CSSFileSet;
