/**
 * Make webpacked Critical CSS Generator lib available in window for testing.
 */
import * as Generator from '../../../index';

( window as any ).TestGenerator = Generator;
