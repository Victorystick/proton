import Scope from './scope.js';

export default function analyse ( ast ) {
	const exports = [];
	const functions = [];
	const scope = new Scope();

	const result = {
		exports,
		functions,
		scope,
	};

	if ( ast.type !== 'file' ) {
		return result;
	}

	ast.body.forEach( node => {
		try {
			node.analyse( scope );
		} catch (_) {
			console.error( node.type, 'missing analyse' );
		}

		if ( node.type === 'fn' ) {
			functions.push( node );
		} else if ( node.type === 'export' ) {
			exports.push( node );
		}
	});

	for (let i = 0; i < functions.length; i++) {
		analyseFunction( functions[i], scope );
	}

	exports.forEach( exp => {
		exp.analyse( scope );
	});

	return result;
}

function analyseFunction( fn, upperScope ) {
	const scope = fn.scope = new Scope( upperScope );

	fn.args.forEach( id => {
		scope.set( id.id, id );
	});

	fn.body.analyse( scope );
}
