/**
 * @param {string[]} urls Urls.
 * @param {{required_valid_urls_number, max_urls_number}} meta Meta.
 * @param {BrowserInterfaceIframe} browserInterface Browser Interface.
 *
 * @returns {string[]}
 */
async function getValidUrls (urls, meta, browserInterface) {
	const failures = [];

	if (!meta || !meta.required_valid_urls_number || !meta.max_urls_number) {
		return urls
	}

	let requiredValidUrlsNumber =  meta.required_valid_urls_number;

	const validUrls = [];
	for (const url of urls ) {
		// If we have enough valid urls, exit early.
		if (validUrls.length === requiredValidUrlsNumber) {
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
	// then the required valid urls number is the original max number of urls divided by itself.
	if (urls.length < meta.max_urls_number && urls.length < requiredValidUrlsNumber) {
		requiredValidUrlsNumber = Math.round(meta.max_urls_number / requiredValidUrlsNumber);
	}

	if (failures.length > 0 && requiredValidUrlsNumber > validUrls.length) {
		// If we have not enough valid urls from the the pool of urls, throw an error
		// TODO: Maybe create a new error Class which can gather the multiple failures.
		throw failures[0].error;
	}

	return validUrls;
}

module.exports = {
	getValidUrls,
};
