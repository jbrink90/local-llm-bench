import { Parser } from './src/parser.mjs';

const parser = new Parser();
const expr1 = parser.parse('2 + 3 * 4');
console.log('Expression 1 tokens:', expr1.tokens);

const expr2 = parser.parse('10 - 6 / 2');  
console.log('Expression 2 tokens:', expr2.tokens);

const expr3 = parser.parse('1 + 7 % 4');
console.log('Expression 3 tokens:', expr3.tokens);