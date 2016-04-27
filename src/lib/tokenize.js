/*
Tokens:

keyword:
	data
	type
	fn
	match

identifier:
	a-z, A-Z, and -

string:
	'...' "..." `...`

number:
	123, 0b0010101

comment:
	# xxxx

indentation: spaces
*/

function set( arr ) {
	return arr.reduce( ( set, val ) => (set[ val ] = true, set), Object.create(null) );
}

const identifierChars = set( 'abcdefghijklmnopqrstuvxyzABCDEFGHIJKLMNOPQRSTUVXYZ-'.split( '' ) );
const indentChars = set( ' \t'.split( '' ) );
const punctuationChars = set( '()'.split( '' ) );
const quotes = set( '`"\''.split( '' ) );

export function punc( kind, pos ) {
	return {
		type: 'punc',
		kind,
		pos,
	};
}

export const EOF = { type: 'eof' };

export function arrow( pos ) {
	return punc( 'arrow', pos );
}

export function id( name, pos ) {
	return {
		type: 'id',
		name,
		pos,
	};
}

export function indent( size, pos ) {
	return {
		type: 'indent',
		size,
		pos,
	};
}

export function literal( value, pos ) {
	return {
		type: 'literal',
		value,
		pos,
	};
}


let index, line, column;
let source, locations;

export function tokenize( code, options ) {
	options = options || {};

	source = code;
	index = 0;
	line = 1;
	column = 0;
	locations = options.location || false;

	return base( [] );
}

function position() {
	return {
		start: { line, column },
		range: [ index ],
	};
}

function complete( pos ) {
	if ( !locations ) return;

	pos.end = { line, column };
	pos.range.push( index );
	return pos;
}

function char() {
	return source[ index ];
}

function next() {
	if ( char() === '\n' ) {
		line += 1;
		column = 0;
	} else {
		column += 1;
	}

	index += 1;

	return char();
}

function base( tokens ) {
	while ( index < source.length ) {
		const c = char();

		if ( c === '\n' ) {
			next();
			continue;
		}

		const pos = position();

		if ( c in identifierChars ) {
			identifier( tokens, pos );
		}

		else if ( c in indentChars ) {
			indentation( tokens, pos );
		}

		else if ( c in punctuationChars ) {
			punctuation( tokens, pos );
		}

		else if ( c in quotes ) {
			tokens.push( string( c, pos ) );
		}

		else {
			throw new Error( `(${ line },${ column }): unexpected character '${ c }'` );
		}
	}

	tokens.push( EOF );
	return tokens;
}

function identifier( tokens, pos ) {
	const start = index;

	if ( char() === '-' && next() === '>' ) {
		next();
		tokens.push( punc( 'arrow', complete( pos ) ) );
		return;
	}

	while ( char() in identifierChars ) next();

	tokens.push( id( source.slice( start, index ), complete( pos ) ) );
}

function indentation( tokens, pos ) {
	const start = index;
	const startColumn = column;

	do {
		next()
	} while ( char() in indentChars );

	if ( startColumn === 0 ) {
		tokens.push( indent( index - start, complete( pos ) ) );
	}
}

function punctuation( tokens, pos ) {
	const c = char();

	if ( c === '(' ) {
		tokens.push( punc( 'left-parens', complete( pos ) ) );
	}

	else if ( c === ')' ) {
		tokens.push( punc( 'right-parens', complete( pos ) ) );
	}

	next();
}

function string( quote, pos ) {
	const start = index;

	while ( next() !== quote ) {
		if ( char() === undefined ) {
			throw new Error( `(${ line },${ column }): unexpected EOF` );
		}
	}

	// eat final quote
	next();

	return literal( source.slice( start + 1, index - 1 ), complete( pos ) );
}
