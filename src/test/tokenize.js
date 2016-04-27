import * as assert from 'assert';
import {
	arrow,
	EOF,
	id,
	indent,
	literal,
	punc,
	tokenize,
} from '../lib/tokenize.js';

describe( 'tokenize', () => {
	it( 'one identifier', () => {
		assert.deepEqual( tokenize( 'a' ), [ id( 'a' ), EOF ] );
	});

	it( 'two identifiers', () => {
		assert.deepEqual( tokenize( 'a b' ), [ id( 'a' ), id( 'b' ), EOF ] );
	});

	it( 'indentation', () => {
		assert.deepEqual( tokenize( '  ' ), [ indent( 2 ), EOF ] );
	});

	it( 'identifiers at indentation', () => {
		assert.deepEqual( tokenize( '  a' ), [ indent( 2 ), id( 'a' ), EOF ] );
	});

	it( 'strings', () => {
		assert.deepEqual( tokenize( '"foo" \'bar\' `baz`' ), [
			literal( 'foo' ), literal( 'bar' ), literal( 'baz' ), EOF,
		]);
	});

	it( 'rejects unterminated strings', () => {
		assert.throws( () => {
			tokenize( '"foo' );
		}, /unexpected EOF/ );
	});

	it( 'parens', () => {
		assert.deepEqual( tokenize( '()' ), [ punc( 'left-parens' ), punc( 'right-parens' ), EOF ] );
	});

	it( 'arrows',() => {
		assert.deepEqual( tokenize( '->->' ), [ arrow(), arrow(), EOF ] );
	});

	describe( 'syntax', () => {
		it( 'match', () => {
			const x = id( 'x' );

			assert.deepEqual( tokenize( `
match x
	foo -> x
	bar -> y
` ), [
				id( 'match' ), id( 'x' ),
				indent( 1 ), id( 'foo' ), arrow(), x,
				indent( 1 ), id( 'bar' ), arrow(), id( 'y' ),
				EOF,
			]);
		});

		it( 'type', () => {
			assert.deepEqual( tokenize(`
type Option
	Some a
	None
`), [ id( 'type' ), id( 'Option' ), indent( 1 ), id( 'Some' ), id( 'a' ), indent( 1 ), id( 'None' ), EOF ] );
		});
	});

	describe( 'locations', () => {
		const options = {
			location: true,
		};

		it( 'identifier', () => {
			const tokens = [
				id( 'foo', {
					range: [ 2, 5 ],
					start: { line: 3, column: 0 },
					end: { line: 3, column: 3 },
				}),

				indent( 1, {
					range: [ 6, 7 ],
					start: { line: 4, column: 0 },
					end: { line: 4, column: 1 },
				}),

				id( 'bar', {
					range: [ 7, 10 ],
					start: { line: 4, column: 1 },
					end: { line: 4, column: 4 },
				}),

				EOF,
			];

			assert.deepEqual( tokenize( `

foo
	bar

`, options ), tokens );
		});

		it( 'string', () => {
			const tokens = [
				id( 'pattern', {
					range: [ 1, 8 ],
					start: { line: 2, column: 0 },
					end: { line: 2, column: 7 },
				}),

				arrow({
					range: [ 9, 11 ],
					start: { line: 2, column: 8 },
					end: { line: 2, column: 10 },
				}),

				literal( 'quotes', {
					range: [ 12, 20 ],
					start: { line: 2, column: 11 },
					end: { line: 2, column: 19 },
				}),

				EOF,
			];


			assert.deepEqual( tokenize( `
pattern -> "quotes"
`, options ), tokens );
		});
	});
});
