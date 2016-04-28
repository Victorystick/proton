import parse, { Parser } from '../lib/parse.js';
import {
	data,
	file,
	fn,
	identifier,
	literal,
	match,
	matchexpr,
	imp,
	type,
	typeinstance,
} from '../lib/nodes.js';

import * as assert from 'assert';

const importExample = `
import "path"
	foo
	bar
`;

describe( 'parser', () => {
	it( 'parses imports', function () {
		assert.deepEqual( parse( 'import "path" ( foo bar )' ).body[ 0 ],
			imp( literal( 'path' ), [ identifier( 'foo' ), identifier( 'bar' ) ] ));

		assert.deepEqual( parse( importExample ).body[ 0 ],
			imp( literal( 'path' ), [ identifier( 'foo' ), identifier( 'bar' ) ] ));

		// With location information.
		assert.deepEqual( parse( importExample, { location: true } ),
			file([ imp(
				literal( 'path', {
					range: [ 8, 14 ],
					source: '<string source>',
					start: { line: 2, column: 7 },
					end: { line: 2, column: 13 },
				}),
				[
					identifier( 'foo', {
						range: [ 16, 19 ],
						source: '<string source>',
						start: { line: 3, column: 1 },
						end: { line: 3, column: 4 },
					}),
					identifier( 'bar', {
						range: [ 21, 24 ],
						source: '<string source>',
						start: { line: 4, column: 1 },
						end: { line: 4, column: 4 },
					}),
				],
				{
					range: [ 1, 24 ],
					source: '<string source>',
					start: { line: 2, column: 0 },
					end: { line: 4, column: 4 },
				}
			)])
		);
	});

	it( 'throws on EOF', function () {
		assert.throws( () => new Parser( '".' ).parseString() );
	});

	it( 'parses functions', function () {
		const x = identifier( 'x' );
		assert.deepEqual( parse( 'fn i ( x ) x' ).body[ 0 ],
			fn( identifier( 'i' ), [ x ], x ) );
	});

	it( 'parses data', function () {
		assert.deepEqual( parse( 'data Point ( x y )\ndata Other ( thing )' ).body, [
			data( identifier( 'Point' ), [
				identifier( 'x' ),
				identifier( 'y' ),
			]),
			data( identifier( 'Other' ), [
				identifier( 'thing' ),
			]),
		]);
	});

	describe( 'parses types', function () {
		it( 'parses no constructors', () => {
			assert.deepEqual( parse( 'type Void ( )' ).body, [
				type( identifier( 'Void' ), [] ),
			]);
		});

		it( 'parses two constructors, single line', () => {
			assert.deepEqual( parse( 'type Name ( First Second )' ).body, [
				type( identifier( 'Name' ), [
					typeinstance( identifier( 'First' ), [] ),
					typeinstance( identifier( 'Second' ), [] ),
				]),
			]);
		});

		it( 'parses two constructors, multiline', () => {
			assert.deepEqual( parse( 'type Name\n First\n Second' ).body, [
				type( identifier( 'Name' ), [
					typeinstance( identifier( 'First' ), [] ),
					typeinstance( identifier( 'Second' ), [] ),
				]),
			]);
		});

		it( 'parses options', () => {
			const optionAst = type( identifier( 'Option' ), [
				typeinstance( identifier( 'None' ), [] ),
				typeinstance( identifier( 'Some' ), [ identifier( 'a' ) ] ),
			]);

			assert.deepEqual( parse( 'type Option ( None ( Some a ) )' ).body, [ optionAst ] );

			assert.deepEqual( parse(`
type Option
	None
	( Some a )
` ).body, [ optionAst ] );
		});
	});

	it( 'parses match', function () {
		const matchSource = `
type Option ( None ( Just a ) )

fn a ( x ) match x
	None -> "None"
	( Just a ) -> a
`;

		const a = identifier( 'a' );
		const x = identifier( 'x' );

		const none = typeinstance( identifier( 'None' ), [] );
		const just = typeinstance( identifier( 'Just' ), [ a ]);

		const ast = file([
			type( identifier( 'Option' ), [
				none,
				just,
			]),
			fn( a, [ x ],
				match( x, [
					matchexpr(
						none,
						literal( 'None' ) ),
					matchexpr(
						just,
						a ),
				])),
		]);

		assert.deepEqual( parse( matchSource ), ast );
	});

	it( 'parses identifiers', function () {
		assert.deepEqual( new Parser( 'something-nice' ).parseIdentifier(),
			identifier( 'something-nice' ) );
	});

	describe( 'handles line endings', function () {
		it( 'CR', function () {
			assert.deepEqual( new Parser( '\ra', { location: true } ).parseIdentifier(), identifier(
				'a', {
					source: '<string source>',
					range: [ 1, 2 ],
					start: { line: 2, column: 0 },
					end: { line: 2, column: 1 },
				}
			));
		});

		it( 'LF', function () {
			assert.deepEqual( new Parser( '\na', { location: true } ).parseIdentifier(), identifier(
				'a', {
					source: '<string source>',
					range: [ 1, 2 ],
					start: { line: 2, column: 0 },
					end: { line: 2, column: 1 },
				}
			));
		});

		it( 'LFCR', function () {
			assert.deepEqual( new Parser( '\r\na', { location: true } ).parseIdentifier(), identifier(
				'a', {
					source: '<string source>',
					range: [ 2, 3 ],
					start: { line: 2, column: 0 },
					end: { line: 2, column: 1 },
				}
			));
		});
	});
});
