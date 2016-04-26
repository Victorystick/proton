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

let index, line, col, indent;
let source;

export function tokenize( code ) {
	source = code;
	index = 0;
	line = 1;
	col = 0;
	indent = 0;

	return base( [] );
}

function base( tokens ) {
	if ( index >= source.length ) {
		tokens.push( EOF );
		return;
	}
}
