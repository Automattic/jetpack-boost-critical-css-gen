class GenericUrlError extends Error {
	constructor( url, message ) {
		super( url + ' - ' + message );
		this.url = url;
	}
}

class ConfigurationError extends Error {
	constructor() {
		super( 'Invalid configuration' );
	}
}

class CrossDomainError extends GenericUrlError {
	constructor( url ) {
		super( url, 'Failed to read cross-domain content' );
	}
}

class LoadTimeoutError extends GenericUrlError {
	constructor( url ) {
		super( url, 'Timeout while loading page' );
	}
}

class HttpError extends GenericUrlError {
	constructor( url, code ) {
		super( url, 'HTTP ' + code + ' detected' );
		this.code = code;
	}
}

class UrlVerifyError extends GenericUrlError {
	constructor( url ) {
		super( url, 'Invalid content received' );
	}
}

module.exports = {
	GenericUrlError,
	ConfigurationError,
	CrossDomainError,
	LoadTimeoutError,
	HttpError,
	UrlVerifyError,
};
