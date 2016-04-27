import {
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

export default function parse ( code, options ) {
	return new Parser( code, options ).parse();
}

function set( arr ) {
	return arr.reduce( ( set, val ) => (set[ val ] = true, set), Object.create(null) );
}

function node( type, fn ) {
	return function () {
		const pos = this.createPosition();
		return type.apply( null, fn.call( this ).concat( this.completePosition( pos ) ) );
	};
}

const quotes = set( '\'"`'.split( '' ) );
const indentChars = set( ' \t'.split( '' ) );
const whitespace = set( ' \t\n'.split( '' ) );
const id = set( 'abcdefghijklmnopqrstuvxyzABCDEFGHIJKLMNOPQRSTUVXYZ-'.split( '' ) );

export function Parser( code, opts ) {
	this.opts = opts || {};

	this.code = code;
	this.lines = code.split( /(?:\n\r?|\r)/ );

	this.source = this.opts.filename || '<string source>';
	this.pos = 0;
	this.line = 1;
	this.col = 0;
	this.indent = 0;
}

Object.assign( Parser, {
	defineTopLevel ( name, node, tokens ) {
		this.prototype._toplevels[ name[ 0 ] ] = {
			name,
			node,
			tokens,
		};
	},
});

Object.assign( Parser.prototype, {
	_toplevels: {},

	// Returns the current character.
	char () {
		return this.code[ this.pos ];
	},

	// Creates a position to be completed by `completePosition`.
	createPosition () {
		return {
			start: {
				line: this.line,
				column: this.col
			},
			source: this.source,
			range: [ this.pos ]
		};
	},

	codeSince ( pos ) {
		return this.code.slice( pos.range[ 0 ], this.pos );
	},

	completePosition ( pos ) {
		if ( !this.opts.loc ) return undefined;

		pos.end = {
			line: this.line,
			column: this.col
		};
		pos.range.push( this.pos );
		return pos;
	},

	// Eats the given string.
	eat ( str ) {
		let i = 0;
		while ( str[ i ] ) {
			if ( this.char() !== str[ i++ ] ) {
				this.raise( `expected "${str}"` );
			}
			this.next();
		}
	},

	eatOptional ( ch ) {
		if ( this.char() === ch ) {
			this.next();
		}
	},

	// Returns true if successful.
	eatNewline ( ) {
		const ch = this.char();

		if ( ch === '\r' ) {
			this.next();
			return true;
		}

		if ( ch === '\n') {
			this.next();
			this.eatOptional( '\r' );
			return true;
		}

		return false;
	},

	// Eats one or more non-newline spaces.
	eatSpaces ( acceptNone ) {
		const start = this.pos;

		if ( !( this.char() in indentChars ) ) {
			if ( acceptNone ) return;

			this.raise( 'expected indentation character: one of [ \\t]' );
		}

		do { this.next(); } while ( this.char() in indentChars );
		return this.code.slice( start, this.pos );
	},

	// Steps forward to the next character. Multiple character line-endings are
	// interpreted as single characters.
	next () {
		const ch = this.char();

		if ( ch === '\n' || ch === '\r' ) {
			this.col = 0;
			this.line++;

			// handle '\n\r' line endings
			if ( ch === '\n' && this.code[ this.pos + 1 ] === '\r' ) {
				this.pos++;
			}
		} else {
			this.col++;
		}
		this.pos++;
	},

	parse () {
		while ( this.char() in whitespace ) this.next();

		const body = [];

		while ( this.char() !== undefined ) {
			// const toplevel = this._toplevels[ this.char() ];
			//
			// if ( !toplevel ) this.raise( 'Expected top-level declaration' );
			//
			// this.eat( toplevel.name );
			//
			// toplevel.tokens.map( t => {
			//
			// 	t.call( this );
			// });

			switch (this.char()) {
				case 'd':
					body.push( this.parseData() );
					break;

				// case 'e':
				// 	body.push( this.parseExport() );
				// 	break;

				case 'f':
					body.push( this.parseFunction() );
					break;

				case 'i':
					body.push( this.parseImport() );
					break;

				case 't':
					body.push( this.parseType() );
					break;

				default:
					this.raise( 'Expected top-level declaration: data, fn, import, type' );
			}

			while( this.char() in whitespace ) this.next();
		}

		return file( body );
	},

	parseData: node( data, function () {
		this.eat( 'data' );

		this.eatSpaces();
		const id = this.parseIdentifier();

		this.eatSpaces();

		return [ id, this.parseList() ];
	}),

	parseFunction () {
		const pos = this.createPosition();
		this.eat( 'fn' );

		this.eatSpaces();
		const name = this.parseIdentifier();

		this.eatSpaces();
		const args = this.parseList();

		this.eatNewline();
		this.eatSpaces();

		return fn( name, args, this.parseExpression(), this.completePosition( pos ) );
	},

	parseExpression () {
		switch ( this.char() ) {
			case 'm':
				return this.parseMatch();

			case '\'':
			case '"':
			case '`':
				return this.parseString();
		}

		// Default to identifier.
		return this.parsePossibleCall();
	},

	parseMatch () {
		const pos = this.createPosition();
		this.eat( 'match' );
		this.eatSpaces();

		const id = this.parseIdentifier();

		return match( id,
			this.parseList( () => this.parseMatchExpression() ),
			this.completePosition( pos ) );
	},

	parseMatchExpression () {
		const pos = this.createPosition();

		const typeinstance = this.parseTypeInstance()

		this.eatSpaces();
		this.eat( '->' );
		this.eatSpaces();

		return matchexpr(
			typeinstance,
			this.parseExpression(),
			this.completePosition( pos ) );
	},

	parseString () {
		const pos = this.createPosition();
		const quote = this.char();

		if ( !( quote in quotes ) ) {
			this.raise( `Expected quote character (\', ", \`), got: "${quote}"` );
		}

		// skip quote
		this.next();

		while ( this.char() !== quote ) {
			if ( this.char() === undefined ) {
				this.raise( 'unexpected EOF!' );
			}

			this.next();
		}

		// skip final quote
		this.next();

		return literal( this.code.slice( pos.range[ 0 ] + 1, this.pos - 1 ), this.completePosition( pos ) );
	},

	// Parses an identifier from the current position.
	parseIdentifier,

	// Parses an import statement from the current position.
	parseImport () {
		const pos = this.createPosition();

		this.eat( 'import' );
		this.eatSpaces();
		const path = this.parseString();

		this.eatSpaces( true );

		const imports = this.parseList();

		return imp( path, imports, this.completePosition( pos ) );
	},

	parseList ( parseItem ) {
		parseItem = parseItem || (() => this.parseIdentifier());

		const list = [];

		if ( this.char() === '(' ) {
			this.next();
			this.eatSpaces();
			while ( this.char() !== ')' ) {
				list.push( parseItem() );
				this.eatSpaces();
			}
			this.next();

			return list;
		}

		if ( this.eatNewline() ) {
			const indent = this.eatSpaces();
			list.push( parseItem() );

			while ( this.eatNewline() )  {
				if ( this.char() === '\n' || this.char() === '\r' || this.char() === undefined ) {
					break;
				}
				this.eat( indent );
				list.push( parseItem() );
			}

			return list;
		}

		this.raise( 'expected list');
	},

	parsePossibleCall() {
		return this.parseIdentifier();
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
		const pos = this.createPosition();
		this.eat( 'type' );
		this.eatSpaces();

		const name = this.parseIdentifier();
		this.eatSpaces( true );

		return type( name,
			this.parseList( () => this.parseTypeInstance() ),
			this.completePosition( pos ) );
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
		const pos = this.createPosition();

		if ( this.char() === '(' ) {
			const list = this.parseList();
			return typeinstance( list.shift(), list, this.completePosition( pos ) );
		}

		return typeinstance( this.parseIdentifier(), [], this.completePosition( pos ) );
	},

	// Raises an error with a message and an optional position.
	raise ( message, pos ) {
		const err = new Error( this.sourceLocation( pos ) + ': ' + message );
		err.pos = this.completePosition( this.createPosition() );
		throw err;
	},

	// Returns a source location string with filename, line and column.
	// Example: 'file.ptn (14:25)'
	sourceLocation ( pos ) {
		if ( pos ) {
			return `${pos.source} (${pos.start.line}:${pos.start.col})`;
		}
		return `${this.source} (${this.line}:${this.col})`;
	}
});

function parseIdentifier () {
	const pos = this.createPosition();

	while ( this.char() in id ) {
		this.next();
	}

	return identifier( this.codeSince( pos ), this.completePosition( pos ) );
}
