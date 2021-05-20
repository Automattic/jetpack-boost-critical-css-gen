/**
 * @param {string[]} urls Urls.
 * @param {{success_threshold, query_limit}} meta Meta.
 * @param {BrowserInterfaceIframe} browserInterface Browser Interface.
 *
 * @returns {string[]}
 */
async function getValidUrls (urls, meta, browserInterface) {
	const failures = [];

	if (!meta || !meta.success_threshold || !meta.query_limit) {
		return urls
	}

	let successThreshold =  meta.success_threshold;

	const validUrls = [];
	for (const url of urls ) {
		// If we have enough valid urls, exit early.
		if (validUrls.length === successThreshold) {
			break;
		}
		const result = await browserInterface.checkUrlValidity(url);
		if (result.status === 'failed') {
			failures.push({
				url,
				error: result.error
			})
		} else {
			validUrls.push(url);
		}
	}

	// If we had less urls than the original max number of urls,
	// then then success threshold is the original max number of urls divided by itself.
	if (urls.length < meta.query_limit ) {
		successThreshold = Math.round(meta.query_limit / successThreshold);
	}

	if (failures.length > 0 && successThreshold > validUrls.length) {
		// If we have not enough valid urls from the the pool of urls, throw an error
		// TODO: Maybe create a new error Class which can gather the multiple failures.
		throw failures[0].error;
	}

	return validUrls;
}

module.exports = {
	getValidUrls,
};
