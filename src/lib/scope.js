export default function Scope( parent ) {
	this.parent = parent;

	this.names = Object.create( null );
}

Object.assign( Scope.prototype, {
	child () {
		return new Scope( this );
	},

	get ( name ) {
		if ( name in this.names ) {
			return this.names[ name ];
		}

		if ( this.parent ) {
			return this.parent.get( name );
		}

		return null;
	},

	set ( name, value ) {
		if ( name in this.names ) {
			throw new Error( `redefining '${ name }'` );
		}

		this.names[ name ] = value;
	},
});
