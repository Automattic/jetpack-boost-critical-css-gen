/**
 * @param {string[]} urls Urls.
 * @param {{min, max}} successTargets Success targets.
 * @param {BrowserInterfaceIframe} browserInterface Browser Interface.
 *
 * @returns {string[]}
 */
async function getValidUrls (urls, successTargets, browserInterface) {
	const failures = [];

	if (!successTargets || !successTargets.min || !successTargets.max) {
		return urls
	}

	let minSuccessTarget =  successTargets.min;

	const validUrls = [];
	for (const url of urls ) {
		// If we have enough valid urls, exit early.
		if (validUrls.length === minSuccessTarget) {
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

	// If we had less urls than the original max number of urls and the original number of required valid urls,
	// we are recalibrating the number of required valid urls.
	if (urls.length < successTargets.max && urls.length < minSuccessTarget) {
		minSuccessTarget = Math.round(urls.length  / (successTargets.max / minSuccessTarget ));
	}

	if (failures.length > 0 && minSuccessTarget > validUrls.length) {
		// If we have not enough valid urls from the the pool of urls, throw an error
		// TODO: Maybe create a new error Class which can gather the multiple failures.
		throw failures[0].error;
	}

	return validUrls;
}

module.exports = {
	getValidUrls,
};
