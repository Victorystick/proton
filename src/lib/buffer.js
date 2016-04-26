import { SourceMapGenerator } from 'source-map';

export default function Buffer ( filename ) {
	this.array = [];

	this.line = 1;
	this.column = 0;
	this.lastPosition = {
		line: this.line,
		column: this.column
	};

	this.map = new SourceMapGenerator();

	this.indentString = '\n';
}

Object.assign( Buffer.prototype, {
	put( str, pos, name ) {
		pos && this.map.addMapping({
			name,
			source: pos.source,
			original: {
				line: pos.start.line,
				column: pos.start.column
			},
			generated: {
				line: this.line,
				column: this.column
			}
		});

		this.push( str );
	},

	indent() {
		this.indentString += '  ';
	},

	dedent() {
		this.indentString = this.indentString.slice( 0, -2 );
	},

	push( str ) {
		this.lastPosition = {
			line: this.line,
			column: this.column
		};

		str = str.replace( /\n/g, this.indentString );

		for ( let i = 0, n = str.length; i < n; i++ ) {
			if ( str[ i ] === '\n' ) {
				if ( str[ i + 1 ] ==='\r' ) { i++; }
				this.line++;
				this.column = 0;
			} else {
				this.column++;
			}
		}

		this.array.push( str );
	},

	pop() {
		this.array.pop();
		Object.assign( this, this.lastPosition );
	},

	code() {
		return this.array.join( '' );
	}
});
