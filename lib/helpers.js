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

	for (const url of urls ) {
		const result = await browserInterface.checkUrlValidity(url);
		if (result.status === 'failed') {
			failures.push({
				url,
				error: result.error
			})
		}
	}

	if (urls.length < meta.query_limit ) {
		successThreshold = Math.round(meta.query_limit / successThreshold);
	}

	if (failures.length > 0 ) {
		if (successThreshold <= urls.length - failures.length) {
			const failedUrls = failures.map(failure => failure.url );
			urls = urls.filter(url => ! failedUrls.includes(url));
		} else {
			// TODO: Maybe create a new error Class which can gather the multiple failures.
			throw failures[0].error;
		}
	}

	return urls;
}

module.exports = {
	getValidUrls,
};
