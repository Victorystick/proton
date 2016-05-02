import {
	call,
	data,
	file,
	fn,
	identifier,
	imp,
	literal,
	match,
	matchexpr,
	type,
	typeinstance,
} from './nodes.js';

import { tokenize, EOF } from './tokenize.js';

export default function parse ( code, options ) {
	return new Parser( code, options ).parse();
}

export function Parser( code, opts ) {
	opts = Object.assign({ filename: '<string source>' }, opts );
	this.source = opts.filename;
	this.location = opts.location || false;

	this.tokens = tokenize( code, Object.assign( {}, opts, { location: true } ) );
	this.index = 0;
}

Object.assign( Parser.prototype, {
	positionFromStartToken ( first ) {
		if ( !this.location ) return;

		const start = first.pos;
		const last = this.prev().pos;

		return {
			source: this.source,
			range: [ start.range[ 0 ], last.range[ 1 ] ],
			start: start.start,
			end: last.end,
		};
	},

	prev() {
		return this.tokens[ this.index - 1 ];
	},

	token() {
		return this.tokens[ this.index ];
	},

	next() {
		return this.tokens[ ++this.index ];
	},

	eatIdentifier( name ) {
		const token = this.token();

		if ( token.type !== 'id' ) {
			this.raise( `expected 'id' token, got '${ token.type }' token` );
		}

		if ( token.name !== name ) {
			this.raise( `expected '${ name }', got '${ token.name }'` );
		}

		this.next();
	},

	parse () {
		const body = [];

		let tok = this.token();

		while ( tok !== EOF ) {

			if ( tok.type === 'id' ) {
				switch (tok.name) {
					case 'data':
						body.push( this.parseData() );
						break;

					case 'fn':
						body.push( this.parseFunction() );
						break;

					case 'import':
						body.push( this.parseImport() );
						break;

					case 'type':
						body.push( this.parseType() );
						break;

					default:
						this.raise( `unexpected '${ tok.name }'` );
				}
			} else {
				this.next();
				this.raise( `expected 'id' token at top-level, got '${ tok.type }'` );
			}

			tok = this.token();
		}

		return file( body );
	},

	parseData () {
		const tok = this.token();

		this.eatIdentifier( 'data' );

		const id = this.parseIdentifier();

		return data( id, this.parseList(), this.positionFromStartToken( tok ) );
	},

	parseFunction () {
		const tok = this.token();

		this.eatIdentifier( 'fn' );

		const name = this.parseIdentifier();

		const args = this.parseList();

		const expr = this.parseExpression();

		return fn( name, args, expr, this.positionFromStartToken( tok ) );
	},

	parseExpression () {
		const tok = this.token();

		if ( tok.type === 'id' && tok.name === 'match' ) {
			return this.parseMatch();
		}

		if ( tok.type === 'literal' ) {
			return this.parseLiteral();
		}

		return this.parsePossibleCall();
	},

	parseMatch () {
		const tok = this.token();

		this.eatIdentifier( 'match' );

		const id = this.parseIdentifier();

		return match( id,
			this.parseList( () => this.parseMatchExpression() ),
			this.positionFromStartToken( tok ) );
	},

	parseMatchExpression () {
		const tok = this.token();

		const typeinstance = this.parseTypeInstance();

		const arrow = this.token();

		if ( arrow.type !== 'punc' || arrow.kind !== 'arrow' ) {
			this.raise( `expected 'arrow'; got '${ arrow.type }'` );
		}

		this.next();

		return matchexpr(
			typeinstance,
			this.parseExpression(),
			this.positionFromStartToken( tok ) );
	},

	parseString () {
		const t = this.token();

		if ( typeof t.value !== 'string' ) {
			this.raise( `expected string literal` );
		}

		return this.parseLiteral();
	},

	parseLiteral () {
		const t = this.token();

		if ( t.type !== 'literal' ) {
			this.raise( `expected 'literal' token, got '${ t.type }'` );
		}

		this.next();
		return literal( t.value, this.positionFromStartToken( t ) );
	},

	// Parses an identifier from the current position.
	parseIdentifier () {
		const t = this.token();

		if ( t.type !== 'id' ) {
			this.raise( `expected 'id' token; got '${ t.type }'`);
		}
		this.next();

		return identifier( t.name, this.positionFromStartToken( t ) );
	},

	// Parses an import statement from the current position.
	parseImport () {
		const tok = this.token();

		this.eatIdentifier( 'import' );

		const path = this.parseString();

		const imports = this.parseList();

		return imp( path, imports, this.positionFromStartToken( tok ) );
	},

	parseList ( parseItem ) {
		parseItem = parseItem || (() => this.parseIdentifier());

		const list = [];

		let tok = this.token();

		if ( tok.type === 'punc' && tok.kind === 'left-parens' ) {
			tok = this.next();

			while ( tok.type !== 'punc' || tok.kind !== 'right-parens' ) {
				list.push( parseItem() );
				tok = this.token();
			}

			this.next();

			return list;
		}

		return this.parseIndentedList( parseItem );
	},

	parseIndentedList( parseItem ) {
		let tok = this.token();

		if ( tok.type !== 'indent' ) {
			this.raise( 'expected list');
			return;
		}

		const indent = tok.size;
		const list = [];

		do {
			if ( tok.size !== indent ) {
				this.raise( 'expected other indentation' );
			}

			// eat the indent
			this.next();

			list.push( parseItem() );

			// repeat if the current token is an indent
			tok = this.token();
		} while ( tok.type === 'indent' );

		return list;
	},

	parsePossibleCall() {
		const id = this.parseIdentifier();

		if ( this.token().type !== 'id' ) {
			return id;
		}

		const args = [];

		for ( let tok = this.token(); tok.type !== 'punc' && tok.type !== 'eof'; tok = this.token() ) {
			args.push( this.parseExpression() );
		}

		return call( id, args, this.positionFromStartToken( id ) );
	},

	/**
	 * Parse a Type declaration.
	 *
	 * @example
	 * type Name ( First Second )
	 *
	 * type Void ( )
	 *
	 * type Option
	 * 	None
	 * 	( Some value )
	 *
	 * @return {type} a type declaration
	 */
	parseType () {
		const tok = this.token();

		if ( tok.type !== 'id' || tok.name !== 'type' ) {
			this.raise( 'unexpected token' );
		}

		this.next();

		const name = this.parseIdentifier();

		return type( name,
			this.parseList( () => this.parseTypeInstance() ),
			this.positionFromStartToken( tok ) );
	},

	/**
	 * Parse a TypeInstance.
	 *
	 * @example
	 * First
	 *
	 * ( Some value )
	 *
	 * @return {typeinstance}
	 */
	parseTypeInstance () {
		const tok = this.token();

		if ( tok.type === 'punc' && tok.kind === 'left-parens' ) {
			const list = this.parseList();
			return typeinstance( list.shift(), list, this.positionFromStartToken( tok ) );
		}

		return typeinstance( this.parseIdentifier(), [], this.positionFromStartToken( tok ) );
	},

	// Raises an error with a message.
	raise ( message ) {
		const pos = this.token().pos;

		const err = new Error( sourceLocation( pos ) + ': ' + message );
		err.pos = pos;
		throw err;
	},
});

function sourceLocation( pos ) {
	if ( !pos ) return 'unknown';

	return `${pos.source} (${pos.start.line}:${pos.start.column})`;
}
