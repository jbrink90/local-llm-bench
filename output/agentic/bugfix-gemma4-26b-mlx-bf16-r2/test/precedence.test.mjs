import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser } from '../src/parser.mjs';

const parser = new Parser();
const evaluate = (expr) => parser.parse(expr).evaluate();

test('multiplication binds tighter than addition', () => {
  assert.equal(evaluate('2 + 3 * 4'), 14);
  assert.equal(evaluate('3 * 4 + 2'), 14);
});

test('division binds tighter than subtraction', () => {
  assert.equal(evaluate('10 - 6 / 2'), 7);
});

test('parentheses override precedence', () => {
  assert.equal(evaluate('(2 + 3) * 4'), 20);
});

test('exponentiation binds tighter than multiplication', () => {
  assert.equal(evaluate('2 * 3 ^ 2'), 18);
});

test('modulo binds tighter than addition', () => {
  assert.equal(evaluate('1 + 7 % 4'), 4);
});

test('left-associative same-precedence chains', () => {
  assert.equal(evaluate('100 / 5 / 2'), 10);
  assert.equal(evaluate('10 - 4 - 3'), 3);
});
