import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser } from '../src/parser.mjs';

const parser = new Parser();
const evaluate = (expr, values) => parser.parse(expr).evaluate(values);

test('boolean and with evaluator', () => {
  const values = { zero: function() { return 0; } };
  assert.strictEqual(evaluate('zero() and 1', values), false);
});

test('boolean or with evaluator', () => {
  const values = { zero: function() { return 0; } };
  assert.strictEqual(evaluate('zero() or 1', values), true);
});

test('ternary with evaluator', () => {
  const values = { zero: function() { return 0; } };
  assert.strictEqual(evaluate('zero() ? 1 : 2', values), 2);
});

test('equality with evaluator', () => {
  const values = { zero: function() { return 0; } };
  assert.strictEqual(evaluate('zero() == 0', values), true);
});

test('member access with evaluator', () => {
  const values2 = { obj: function() { return { a: 1 }; } };
  assert.strictEqual(evaluate('obj().a', values2), 1);
});
