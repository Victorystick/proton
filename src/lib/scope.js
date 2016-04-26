export default function Scope( parent ) {
	this.parent = parent || null;

	this.names = {};
}

Object.assign( Scope.prototype, {
	child () {
		return new Scope( this );
	},

	get ( name ) {
		if ( name in this.names ) return this.names[ name ];

		if ( this.parent ) return this.parent.get( name );

		return null;
	},

	set ( name, value ) {
		this.names[ name ] = value;
	}
});
