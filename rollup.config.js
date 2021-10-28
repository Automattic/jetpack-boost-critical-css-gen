import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import globals from 'rollup-plugin-node-globals';
import { terser } from 'rollup-plugin-terser';
import builtins from 'rollup-plugin-node-builtins';

export default {
	input: 'index.js',
	output: {
		sourcemap: true,
		format: 'iife',
		name: 'CriticalCSSGenerator',
		file: 'dist/critical-calc.min.js',
	},

	plugins: [
		resolve( { browser: true, preferBuiltins: false } ),
		commonjs( {
			transformMixedEsModules: true,
		} ),
		globals(),
		builtins(),
		json(),
		terser(),
	],
	watch: {
		clearScreen: false,
	},
};
