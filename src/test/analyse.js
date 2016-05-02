import * as assert from 'assert';
import analyse from '../lib/analyse.js';
import generate from '../lib/generate.js';
import {
	exp,
	file,
	fn,
	identifier,
	match,
	matchexpr,
	type,
	typeinstance,
} from '../lib/nodes.js';

describe( 'analyse', () => {
	const a = identifier( 'a' );
	const b = identifier( 'b' );
	const c = identifier( 'c' );

	it( 'finds functions', () => {
		assert.equal( analyse( file([]) ).functions.length, 0 );

		const ast = file([
			fn(
				identifier( 'foo' ),
				[],
				identifier( 'foo' )
			),
		]);

		assert.equal( analyse( ast ).functions.length, 1 );
	});

	it( 'rejects undefined identifiers', () => {
		assert.throws( () => {
			analyse( file([
				fn(
					identifier( 'foo' ),
					[],
					identifier( 'fo' )
				),
			]));
		}, /references undefined identifier 'fo'/);
	});

	it( 'rejects undefined exports', () => {
		assert.throws( () => {
			analyse( file([
				exp([
					a,
				]),
			]));
		}, /references undefined identifier 'a'/);
	});

	describe( 'match', () => {
		it( 'rejects empty matches', () => {
			assert.throws( () => {
				analyse( file([
					fn( a, [], match( a, [] ) ),
				]));
			}, /empty match/);
		});

		it( 'rejects non-types', () => {
			assert.throws( () => {
				analyse( file([
					fn( a, [], match( a, [
						matchexpr( typeinstance( a, [] ), a ),
					])),
				]));
			}, /'a' is not a type/);
		});

		it( 'rejects conflicting types', () => {
			const tia = typeinstance( a, [] );
			const tib = typeinstance( b, [] );

			assert.throws( () => {
				analyse( file([
					type( a, [ tia ] ),
					type( b, [ tib ] ),

					fn( c, [], match( c, [
						matchexpr( tia, c ),
						matchexpr( tib, c ),
					])),
				]));
			}, /cannot match against conflicting types/);
		});

		it( 'matches expressions with types', () => {
			const none = identifier( 'None' );
			const some = identifier( 'Some' );
			const opt = identifier( 'opt' );

			const ast = file([
				type( identifier( 'Option' ), [
					typeinstance( none, [] ),
					typeinstance( some, [ a ] ),
				]),

				fn( identifier( 'get-or' ), [ opt, b ], match( opt, [
					matchexpr( typeinstance( none, [] ), b ),
					matchexpr( typeinstance( some, [ a ] ), a ),
				])),
			]);

			assert.equal( generate( ast ).code, `function Option(type,a) {
  this.type = type;
  this.a = a;
}

function getOr(opt, b) {
  switch (opt.type) {
    case 0:
      return b;
    case 1:
      return opt.a;
  }
}
` );
		});
	});
});
