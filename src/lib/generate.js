import Buffer from './buffer.js';
import analyse from './analyse.js';
import Scope from './scope.js';

export default function generate ( ast, options ) {
	options = options || {};

	const buffer = new Buffer( options.filename );

	const result = analyse( ast );

	ast.compile( buffer, result.scope );

	return {
		code: buffer.code(),
		map: buffer.map.toString()
	};
}
