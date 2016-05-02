import { alphabet } from './alphabet.js';
import Scope from './scope.js';
import { times } from './util.js';

const noop = () => {};

// declare a new node with the following properties.
//
// All nodes must declare a compile method with the following signature:
// compile( Buffer, Scope, ... )
function node( type, keys, tweak ) {
	tweak = tweak || noop;

	function fn() {
		const o = Object.create( fn );
		keys.forEach( (key, i) => o[key] = arguments[i] );
		tweak( o );
		return o;
	}

	fn.type = type;

	fn.raise = raise;

	return fn;
}

function raise( msg ) {
	const pos = ( this.pos && this.pos.start ) || { line: 0, column: 0 };
	const line = pos.line;
	const col = pos.column;

	const err = new Error( `(${ line }:${ col }): ${ msg }` );

	err.pos = this.pos;

	throw err;
}

export const call = node( 'call', [ 'id', 'args' ]);

Object.assign( call, {
	analyse ( scope ) {
		this.id.analyse( scope );
		this.args.forEach( arg => arg.analyse( scope ) );
	},

	compile ( buffer, scope ) {
		this.id.compile( buffer, scope );

		buffer.push( '(' );
		this.args.forEach( arg => {
			arg.compile( buffer, scope );
			buffer.push(', '); // push a ', '
		});
		buffer.pop(); // remove the last ', '
		buffer.push( ')' );
	},
});

export const data = node( 'data', [ 'id', 'fields' ]);

Object.assign( data, {
	analyse: noop,
	compile: noop,
});

export const exp = node( 'export', [ 'names' ] );

Object.assign( exp, {
	analyse ( scope ) {
		this.names.forEach( n => n.analyse( scope ) );
	},

	compile: noop,
});

export const file = node( 'file', [ 'body' ]);

file.compile = function ( buffer, scope ) {
	this.body.forEach( top => {
		if ( Object.getPrototypeOf( top ) === data ) return;

		top.compile( buffer, scope );
		buffer.push( '\n' );
	});
};

export const literal = Object.assign( node( 'literal', [ 'value', 'pos' ] ), {
	analyse: noop,

	compile ( buffer, _, method ) {
		buffer.put( ( method || '' ) + JSON.stringify( this.value ), this.pos );
	},
});

export const identifier = Object.assign( node( 'identifier', [ 'id', 'pos' ] ), {
	compile ( buffer, scope, method ) {
		const what = scope.get( this.id );

		if ( what && what.type === 'member' ) {
			what.compile( buffer, scope, method );
		} else {
			buffer.put( ( method || '' ) + this.id.replace( /-(\w)/g, ( _, c ) => c.toUpperCase() ), this.pos, this.id );
		}
	},

	analyse ( scope ) {
		if ( !scope.get( this.id ) ) {
			this.raise( `references undefined identifier '${ this.id }'` );
		}
	},
});

export const imp = Object.assign( node( 'import', [ 'path', 'imports', 'pos' ] ), {
	analyse ( scope ) {
		this.imports.forEach( imp => {
			scope.set( imp.id.id, imp );
		});
	},

	compile ( buffer, scope ) {
		buffer.put( 'import { ', this.pos );

		if ( this.imports.length ) {
			this.imports.forEach( imp => {
				// scope.set( imp.id, undefined );
				imp.compile( buffer, scope );
				buffer.push(', '); // push a ', '
			});
			buffer.pop(); // remove the last ', '
		}

		buffer.put( ' } from ', this.pos );
		this.path.compile( buffer, scope );
		buffer.put( ';', this.pos );
	},
});

export const fn = node( 'fn', [ 'id', 'args', 'body', 'pos' ]);

fn.analyse = function ( scope ) {
	scope.set( this.id.id, this );
};

fn.compile = function ( buffer, _ ) {
	const scope = this.scope;

	buffer.put( 'function ', this.pos );
	this.id.compile( buffer, scope );
	buffer.put( '(', this.pos );

	if ( this.args.length ) {
		this.args.forEach( arg => {
			arg.compile( buffer, scope );
			buffer.push(', ');
		});
		buffer.pop(); // remove the last ', '
	}

	buffer.indent();
	buffer.put( ') {\n', this.pos );
	this.body.compile( buffer, scope, 'return ' );
	buffer.dedent();
	buffer.put( '\n}', this.pos );
};

export const match = node( 'match', [ 'id', 'expressions', 'pos' ]);

match.compile = function ( buffer, scope, method ) {
	buffer.indent();
	buffer.put( 'switch (', this.pos );
	this.id.compile( buffer, scope );
	buffer.put( '.type) {' );

	this.expressions.forEach( expr => {
		buffer.put( '\n', this.pos );
		expr.compile( buffer, scope, method );
	});

	if ( !this.complete ) {
		buffer.put( '\n', this.pos );
		buffer.put( `default: throw new Error('No match!');`, this.pos );
	}

	buffer.dedent();
	buffer.put( '\n}', this.pos );
};

function getType( scope, instance ) {
	const subtype = scope.get( instance.id.id );

	if ( !subtype || !subtype.type || subtype.type.type !== 'type' ) {
		instance.raise( `'${ instance.id.id }' is not a type` );
	}

	return subtype;
}

match.analyse = function ( scope ) {
	this.id.analyse( scope );

	if ( !this.expressions.length ) {
		this.raise( 'empty match' );
	}

	// TODO: make this check stricter.
	const instances = this.expressions.map( e => getType( scope, e.typeinstance ) );
	const last = instances.pop();

	if ( !instances.every( i => i.type === last.type ) ) {
		this.raise( 'cannot match against conflicting types' );
	}

	this.complete = instances.length + 1 === last.length;

	this.expressions.forEach( e => e.analyse( scope, this.id ) );
};

export const matchexpr = node( 'matchexpr', [ 'typeinstance', 'expression', 'pos' ]);

matchexpr.compile = function ( buffer, scope, method ) {
	buffer.put( 'case ', this.pos );

	const type = scope.get( this.typeinstance.id.id );

	buffer.put( String( type.value ), this.typeinstance.pos );

	buffer.indent();
	buffer.put( ':\n', this.pos );

	this.expression.compile( buffer, this.scope, method );

	buffer.put( ';', this.pos );

	if ( method !== 'return ') buffer.push( 'break;' );

	buffer.dedent();
};

matchexpr.analyse = function ( parent, target ) {
	const scope = this.scope = parent.child();

	this.typeinstance.values.forEach( ( value, i ) => {
		scope.set( value.id, member( target.id, alphabet[ i ] ) );
	});

	this.expression.analyse( scope );
};

const member = node( 'member', [ 'parent', 'prop', 'value' ] );
member.compile = function ( buffer, scope, method ) {
	buffer.put( ( method || '' )  + this.parent + '.' + this.prop, this.pos );
};

export const type = node( 'type', [ 'id', 'types', 'pos' ], self => {
	self.values = Math.max.apply( Math, self.types.map( type => type.values.length ) );
});

Object.assign( type, {
	analyse ( scope ) {
		this.types.forEach( ( type, value ) => {
			scope.set( type.id.id, {
				type: this,
				instance: type,
				length: this.types.length,
				value
			});
		});
	},

	compile ( buffer, scope ) {
		buffer.indent();
		buffer.put( 'function ', this.pos );
		this.id.compile( buffer, scope );
		buffer.put( '(type', this.pos );

		times( this.values, i => buffer.push( ',' + alphabet[ i ] ) );

		buffer.put( ') {\nthis.type = type;', this.pos );

		times( this.values, i => buffer.push( '\nthis.' + alphabet[ i ] + ' = ' + alphabet[ i ] + ';' ) );

		// this.types.forEach( ( type, value ) => {
		// 	scope.set( type.id.id, {
		// 		type: this,
		// 		instance: type,
		// 		value
		// 	});
		// });

		buffer.dedent();
		buffer.put( '\n}\n', this.pos );
	},
});

export const typeinstance = node( 'typeinstance', [ 'id', 'values', 'pos' ]);
