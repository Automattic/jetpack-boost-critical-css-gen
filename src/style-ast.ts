import * as csstree from 'css-tree';
import { AtRuleFilter, FilterSpec, PropertiesFilter } from './types';

const validMediaTypes = [ 'all', 'print', 'screen', 'speech' ];
const base64Pattern = /data:[^,]*;base64,/;
const stringPattern = /^(["']).*\1$/;
const maxBase64Length = 1000;
const excludedSelectors = [ /::?(?:-moz-)?selection/ ];
const excludedProperties = [
	/(.*)animation/,
	/(.*)transition(.*)/,
	/cursor/,
	/pointer-events/,
	/(-webkit-)?tap-highlight-color/,
	/(.*)user-select/,
];

function isDeclaration( node: csstree.CssNode ): node is csstree.Declaration {
	return node.type === 'Declaration';
}

function hasEmptyChildList( node: csstree.CssNode ): boolean {
	if ( 'children' in node && node.children instanceof csstree.List ) {
		return node.children.isEmpty;
	}

	return false;
}

/**
 * Represents an Abstract Syntax Tree for a CSS file (as generated by css-tree) and contains helper
 * methods for pruning and rearranging it.
 */
export class StyleAST {
	constructor( private css: string, private ast: csstree.CssNode, private errors: Error[] ) {}

	/**
	 * Given a base URL (where the CSS file this AST was built from), find all relative URLs and
	 * convert them to absolute.
	 *
	 * @param {string} base base URL for relative URLs.
	 */
	absolutifyUrls( base: string ): void {
		csstree.walk( this.ast, {
			visit: 'Url',
			enter: url => {
				if ( url.value ) {
					const value = StyleAST.readValue( url );
					const absolute = new URL( value, base ).toString();

					if ( absolute !== value ) {
						url.value = absolute;
					}
				}
			},
		} );
	}

	/**
	 * Returns a new StyleAST with content from this one pruned based on the specified contentWindow
	 * and criticalSelectors to keep.
	 *
	 * Removes:
	 * - Irrelevant media queries
	 * - Selectors not included in criticalSelectors
	 * - Excluded properties
	 * - Large embeds
	 * - Empty rules
	 *
	 * @param {Set< string >} criticalSelectors - Set of selectors to keep in the new AST.
	 *
	 * @return {StyleAST} - New AST with pruned contents.
	 */
	pruned( criticalSelectors: Set< string > ): StyleAST {
		const clone = new StyleAST( this.css, csstree.clone( this.ast ), this.errors );

		clone.pruneMediaQueries();
		clone.pruneAtRules();
		clone.pruneNonCriticalSelectors( criticalSelectors );
		clone.pruneExcludedProperties();
		clone.pruneLargeBase64Embeds();
		clone.pruneComments();

		return clone;
	}

	/**
	 * Given an AST node, returns the original text it was compiled from in the source CSS.
	 *
	 * @param {Object} node - Node from the AST.
	 * @return {string} original text the node was compiled from.
	 */
	originalText( node: csstree.CssNode ): string {
		if ( node.loc && node.loc.start && node.loc.end ) {
			return this.css.substring( node.loc.start.offset, node.loc.end.offset );
		}
		return '';
	}

	/**
	 * Applies filters to the properties or atRules in this AST. Mutates the AST in-place.
	 *
	 * @param {{properties: Function, atRules: Function}} filters
	 */
	applyFilters( filters: FilterSpec ): void {
		if ( ! filters ) {
			return;
		}

		if ( filters.properties ) {
			this.applyPropertiesFilter( filters.properties );
		}

		if ( filters.atRules ) {
			this.applyAtRulesFilter( filters.atRules );
		}
	}

	/**
	 * Applies a filter to the properties in this AST. Mutates the AST in-place.
	 *
	 * @param {Function} filter to apply.
	 */
	applyPropertiesFilter( filter: PropertiesFilter ): void {
		csstree.walk( this.ast, {
			visit: 'Declaration',
			enter: ( declaration, item, list ) => {
				if ( filter( declaration.property, this.originalText( declaration.value ) ) === false ) {
					list.remove( item );
				}
			},
		} );
	}

	/**
	 * Applies a filter to the atRules in this AST. Mutates the AST in-place.
	 *
	 * @param {Function} filter to apply.
	 */
	applyAtRulesFilter( filter: AtRuleFilter ): void {
		csstree.walk( this.ast, {
			visit: 'Atrule',
			enter: ( atrule, item, list ) => {
				if ( filter( atrule.name ) === false ) {
					list.remove( item );
				}
			},
		} );
	}

	/**
	 * Remove variables that do not appear in the usedVariables set. Returns a count of variables
	 * that were removed.
	 *
	 * @param {Set< string >} usedVariables - Set of used variables to keep.
	 * @return {number} variables pruned.
	 */
	pruneUnusedVariables( usedVariables: Set< string > ): number {
		let pruned = 0;

		csstree.walk( this.ast, {
			visit: 'Declaration',
			enter: ( declaration, item, list ) => {
				// Ignore declarations that aren't defining variables.
				if ( ! declaration.property.startsWith( '--' ) ) {
					return;
				}

				// Check if this declared variable is used.
				if ( usedVariables.has( declaration.property ) ) {
					return;
				}

				// Prune unused variable.
				list.remove( item );
				pruned++;
			},
		} );

		return pruned;
	}

	/**
	 * Find all variables that are used and return them as a Set.
	 */
	getUsedVariables(): Set< string > {
		const usedVariables = new Set< string >();

		csstree.walk( this.ast, {
			visit: 'Function',
			enter: func => {
				// Ignore functions that aren't var()
				if ( csstree.keyword( func.name ).name !== 'var' ) {
					return;
				}

				const names = func.children.map( StyleAST.readValue );
				names.forEach( name => usedVariables.add( name ) );
			},
		} );

		return usedVariables;
	}

	/**
	 * Remove all comments from the syntax tree.
	 */
	pruneComments(): void {
		csstree.walk( this.ast, {
			visit: 'Comment',
			enter: ( _, item, list ) => {
				list.remove( item );
			},
		} );
	}

	/**
	 * Remove media queries that only apply to print.
	 */
	pruneMediaQueries(): void {
		csstree.walk( this.ast, {
			visit: 'Atrule',
			enter: ( atrule, atitem, atlist ) => {
				// Ignore non-media and invalid atrules.
				if ( csstree.keyword( atrule.name ).name !== 'media' || ! atrule.prelude ) {
					return;
				}

				// Go through all MediaQueryLists (should be one, but let's be sure).
				csstree.walk( atrule, {
					visit: 'MediaQueryList',
					enter: ( mqrule, mqitem, mqlist ) => {
						// Filter out MediaQueries that aren't interesting.
						csstree.walk( mqrule, {
							visit: 'MediaQuery',
							enter: ( mediaQuery, mediaItem, mediaList ) => {
								if ( ! StyleAST.isUsefulMediaQuery( mediaQuery ) ) {
									mediaList.remove( mediaItem );
								}
							},
						} );

						// If empty MQ, remove from parent.
						if ( hasEmptyChildList( mqrule ) ) {
							mqlist.remove( mqitem );
						}
					},
				} );

				// If there are no useful media query lists left, throw away the block.
				if ( hasEmptyChildList( atrule.prelude ) ) {
					atlist.remove( atitem );
				}
			},
		} );
	}

	/**
	 * Remove atrules which are incompatible with Critical CSS.
	 * Targets keyframes (for animations), charsets and imports.
	 */
	pruneAtRules(): void {
		const prune = [ 'keyframes', 'charset', 'import' ];

		csstree.walk( this.ast, {
			visit: 'Atrule',
			enter: ( atrule, atitem, atlist ) => {
				if ( prune.includes( csstree.keyword( atrule.name ).basename ) ) {
					atlist.remove( atitem );
				}
			},
		} );
	}

	/**
	 * Returns true if the given CSS rule object relates to animation keyframes.
	 *
	 * @param {Object} rule - CSS rule.
	 */
	static isKeyframeRule( rule: csstree.WalkContext ): boolean {
		return ( rule.atrule && csstree.keyword( rule.atrule.name ).basename === 'keyframes' ) || false;
	}

	/**
	 * Walks this AST and calls the specified callback with each selector found (as text).
	 * Skips any selectors in the excludedSelectors constant.
	 *
	 * @param {Function} callback - Callback to call with each selector.
	 */
	forEachSelector( callback: ( selector: string ) => void ): void {
		csstree.walk( this.ast, {
			visit: 'Rule',
			enter( rule ) {
				// Ignore rules inside @keyframes.
				if ( StyleAST.isKeyframeRule( this ) ) {
					return;
				}

				// Ignore invalid rules.
				if ( rule.prelude.type !== 'SelectorList' ) {
					return;
				}

				// Go through all selectors, filtering out unwanted ones.
				rule.prelude.children.forEach( child => {
					const selector = csstree.generate( child );

					if ( ! excludedSelectors.some( s => s.test( selector ) ) ) {
						callback( selector );
					}
				} );
			},
		} );
	}

	/**
	 * Remove any selectors not listed in the criticalSelectors set, deleting any
	 * rules that no longer have any selectors in their prelude.
	 *
	 * @param criticalSelector
	 */
	pruneNonCriticalSelectors( criticalSelector: Set< string > ): void {
		csstree.walk( this.ast, {
			visit: 'Rule',
			enter( rule, item, list ) {
				// Ignore rules inside @keyframes... until later.
				if ( this.atrule && csstree.keyword( this.atrule.name ).basename === 'keyframes' ) {
					return;
				}

				// Remove invalid rules.
				if ( rule.prelude.type !== 'SelectorList' ) {
					list.remove( item );
					return;
				}

				// Always include any rule that uses the grid-area property.
				if (
					rule.block.children.some(
						propertyNode => isDeclaration( propertyNode ) && propertyNode.property === 'grid-area'
					)
				) {
					return;
				}

				// Prune any selectors that aren't used.
				rule.prelude.children = rule.prelude.children.filter( selector => {
					// Prune selectors marked to always remove.
					if ( excludedSelectors.some( s => s.test( csstree.generate( selector ) ) ) ) {
						return false;
					}

					const selectorText = csstree.generate( selector );
					return criticalSelector.has( selectorText );
				} );

				// If the selector list is empty, prune the whole rule.
				if ( hasEmptyChildList( rule.prelude ) ) {
					list.remove( item );
				}
			},
		} );
	}

	/**
	 * Remove any Base64 embedded content which exceeds maxBase64Length.
	 */
	pruneLargeBase64Embeds(): void {
		csstree.walk( this.ast, {
			visit: 'Declaration',
			enter: ( declaration, item, list ) => {
				let tooLong = false;

				csstree.walk( declaration, {
					visit: 'Url',
					enter( url ) {
						const value = url.value;
						if ( base64Pattern.test( value ) && value.length > maxBase64Length ) {
							tooLong = true;
						}
					},
				} );

				if ( tooLong ) {
					list.remove( item );
				}
			},
		} );
	}

	/**
	 * Remove any properties that match the regular expressions in the excludedProperties constant.
	 */
	pruneExcludedProperties(): void {
		csstree.walk( this.ast, {
			visit: 'Declaration',
			enter: ( declaration, item, list ) => {
				if ( declaration.property ) {
					const property = csstree.property( declaration.property ).name;
					if ( excludedProperties.some( e => e.test( property ) ) ) {
						list.remove( item );
					}
				}
			},
		} );
	}

	/**
	 * Remove any fonts which are not in the specified whitelist.
	 *
	 * @param {Set< string >} fontWhitelist - Whitelisted font.
	 */
	pruneNonCriticalFonts( fontWhitelist: Set< string > ): void {
		csstree.walk( this.ast, {
			visit: 'Atrule',
			enter: ( atrule, item, list ) => {
				// Skip rules that aren't @font-face...
				if ( csstree.keyword( atrule.name ).basename !== 'font-face' ) {
					return;
				}

				// Find src and font-family.
				const properties: { [ key: string ]: string[] } = {};
				csstree.walk( atrule, {
					visit: 'Declaration',
					enter: ( declaration, decItem, decList ) => {
						const property = csstree.property( declaration.property ).name;
						if (
							[ 'src', 'font-family' ].includes( property ) &&
							'children' in declaration.value
						) {
							const values = declaration.value.children.toArray();
							properties[ property ] = values.map( StyleAST.readValue );
						}

						// Prune out src from result.
						if ( property === 'src' ) {
							decList.remove( decItem );
						}
					},
				} );

				// Remove font-face rules without a src and font-family.
				if ( ! properties.src || ! properties[ 'font-family' ] ) {
					list.remove( item );
					return;
				}

				// Prune if none of the font-family values are in the whitelist.
				if ( ! properties[ 'font-family' ].some( family => fontWhitelist.has( family ) ) ) {
					list.remove( item );
				}
			},
		} );
	}

	/**
	 * Returns a count of the rules in this Style AST.
	 *
	 * @return {number} rules in this AST.
	 */
	ruleCount(): number {
		let rules = 0;

		csstree.walk( this.ast, {
			visit: 'Rule',
			enter: () => {
				rules++;
			},
		} );

		return rules;
	}

	/**
	 * Returns a list of font families that are used by any rule in this AST.
	 *
	 * @return {Set<string>} Set of used fonts.
	 */
	getUsedFontFamilies(): Set< string > {
		const fontFamilies = new Set< string >();

		csstree.walk( this.ast, {
			visit: 'Declaration',
			enter( node ) {
				// Ignore declarations not inside rules.
				if ( ! this.rule ) {
					return;
				}

				// Pull the lexer out of csstree. Note: the types don't include
				// this, so we have to hack it with any :(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const lexer = ( csstree as any ).lexer;

				// Gather family-name values.
				const frags = lexer.findDeclarationValueFragments( node, 'Type', 'family-name' );
				const nodes = frags.map( frag => frag.nodes.toArray() ).flat();
				const names = nodes.map( StyleAST.readValue ) as string[];
				names.forEach( name => fontFamilies.add( name ) );
			},
		} );

		return fontFamilies;
	}

	/**
	 * Given an AST node, read it as a value based on its type. Removes quote marks from
	 * string types if present.
	 *
	 * @param {Object} node - AST node.
	 */
	static readValue( node: csstree.CssNode ): string {
		if ( node.type === 'String' && stringPattern.test( node.value ) ) {
			return node.value.substr( 1, node.value.length - 2 );
		} else if ( node.type === 'Identifier' ) {
			return node.name;
		} else if ( 'value' in node ) {
			return node.value as string;
		}

		return '';
	}

	/**
	 * Returns true if the specified media query node is relevant to screen rendering.
	 *
	 * @param {Object} mediaQueryNode - Media Query AST node to examine.
	 *
	 * @return {boolean} true if the media query is relevant to screens.
	 */
	static isUsefulMediaQuery( mediaQueryNode: csstree.MediaQuery ): boolean {
		// Find media types.
		let lastIdentifierNot = false;
		const mediaTypes = {};
		csstree.walk( mediaQueryNode, {
			visit: 'Identifier',
			enter: node => {
				const identifier = csstree.keyword( node.name ).name;

				if ( identifier === 'not' ) {
					lastIdentifierNot = true;
					return;
				}

				if ( validMediaTypes.includes( identifier ) ) {
					mediaTypes[ identifier ] = ! lastIdentifierNot;
				}

				lastIdentifierNot = false;
			},
		} );

		// If no media types specified, assume screen.
		if ( Object.keys( mediaTypes ).length === 0 ) {
			return true;
		}

		// If 'screen' or 'all' explicitly specified, use those (preference screen).
		for ( const mediaType of [ 'screen', 'all' ] ) {
			if ( Object.prototype.hasOwnProperty.call( mediaTypes, mediaType ) ) {
				return mediaTypes[ mediaType ];
			}
		}

		// If any other media type specified, only true if 'not'. e.g.: 'not print'.
		return Object.values( mediaTypes ).some( value => ! value );
	}

	/**
	 * Returns this AST converted to CSS.
	 *
	 * @return {string} this AST represented in CSS.
	 */
	toCSS(): string {
		return csstree.generate( this.ast );
	}

	/**
	 * Static method to parse a block of CSS and return a new StyleAST object which represents it.
	 *
	 * @param {string} css - CSS to parse.
	 *
	 * @return {StyleAST} new parse AST based on the CSS.
	 */
	static parse( css: string ): StyleAST {
		const errors: Error[] = [];
		const ast = csstree.parse( css, {
			parseCustomProperty: true,
			positions: true,
			onParseError: err => {
				errors.push( err );
			},
		} );

		return new StyleAST( css, ast, errors );
	}
}
