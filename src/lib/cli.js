import transpile from './transpile.js';
import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';
import * as chalk from 'chalk';
import lineNumbers from 'line-numbers';

function compile( source, target ) {
	if ( !source ) {
		console.log( 'ptc - Proton compiler' );
		console.log( 'Usage: ptc <source.ptn>');
		return;
	}

	target = target || source.slice( 0, source.lastIndexOf( '.' ) ) + '.js';

	const code = readFileSync( source, 'utf8' );

	let res;

	try {
		res = transpile( code, {
			loc: true,
			filename: source,
		});
	} catch ( e ) {
		const pos = e.pos;

		if ( pos ) {
			// get lines
			const lines = code.split( '\n' );

			// mark the line after the errored line
			lines[ pos.start.line ] = mark( lines[ pos.start.line ], pos );

			console.error( lineNumbers( lines.slice( pos.start.line - 2, pos.start.line + 2 ).join( '\n' ), { start: pos.start.line - 1 } ) );
		}

		console.error();
		console.error( e.stack );
		process.exit( 1 );
	}

	writeFileSync( target, res.code );
	writeFileSync( target + '.map', res.map.toString() );
}

function mark( line, pos ) {
	const arrow = '^' + chars( '~', pos.end.column - pos.start.column - 1 );
	return rightPad( line.slice( 0, pos.start.column ), pos.start.column ) + chalk.red( arrow ) + line.slice( pos.start.column + arrow.length ); //replace( /./g, c => c === '\t' ? '\t' : ' ' ).slice( 0, pos.start.column ) + '^' + chars( '~', pos.end.column - pos.start.column - 1 );
}

function rightPad( str, len ) {
	return str + chars( ' ', len - str.length );
}

function chars( char, num ) {
	if ( num <= 0 ) return '';

	return char + chars( char, num - 1 );
}

compile( process.argv[ 2 ], process.argv[ 3 ] );
