export function times ( n, fn ) {
	let i = 0;
	while ( i < n ) fn( i++ );
}
