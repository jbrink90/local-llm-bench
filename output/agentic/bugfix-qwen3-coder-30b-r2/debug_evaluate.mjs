import { Parser } from './src/parser.mjs';

const parser = new Parser();
const expr1 = parser.parse('2 + 3 * 4');
console.log('Expression 1 result:', expr1.evaluate());

const expr2 = parser.parse('10 - 6 / 2');  
console.log('Expression 2 result:', expr2.evaluate());

const expr3 = parser.parse('1 + 7 % 4');
console.log('Expression 3 result:', expr3.evaluate());