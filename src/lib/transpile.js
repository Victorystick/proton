import parse from './parse.js';
import generate from './generate.js';

// The transpilation step includes both parsing and generation.
export default function transpile( code, options ) {
	return generate( parse( code, options ), options );
}
