import { Page } from 'playwright';

export type Viewport = {
	width: number;
	height: number;
};

export type NullableViewport = Viewport | { width: null; height: null };

export type PropertiesFilter = ( name: string, value: string ) => boolean;
export type AtRuleFilter = ( name: string ) => boolean;

export type FilterSpec = {
	properties?: PropertiesFilter;
	atRules?: AtRuleFilter;
};

export type PreparedPage< T > = T & {
	_statusCode: number | null;
	_statusCodeListenerAttached: boolean;
	gotoWithStatus: ( url: string, options?: Parameters< Page[ 'goto' ] >[ 1 ] ) => Promise< void >;
};
