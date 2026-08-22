# Fixture: expr-eval (bug-fix variant)

Vendored from [expr-eval](https://www.npmjs.com/package/expr-eval) v2.0.2,
MIT licensed, zero runtime dependencies. `LICENSE.txt` is the upstream notice and
must stay intact.

## Why vendored

The benchmark run must touch no network. A fixture with a dependency tree would
force `npm install` mid-run and break that. `expr-eval` has `dependencies: {}`,
so the source drops in as-is.

The upstream test suite needs mocha, so it is **not** used. `test/precedence.test.mjs`
is written against node's built-in `node:test` — no install, no dev dependencies.

## The planted defect

`src/parser.mjs` is upstream `dist/index.mjs` with the two precedence-level
operator sets swapped:

```js
var ADD_SUB_OPERATORS = ['*', '/', '%'];   // should be ['+', '-', '||']
var TERM_OPERATORS    = ['+', '-', '||'];  // should be ['*', '/', '%']
```

The recursive-descent chain is `parseAddSub -> parseTerm -> parseFactor ->
parseExponential`, so swapping the sets inverts precedence between the additive
and multiplicative levels.

Effect: `2 + 3 * 4` evaluates to 20 instead of 14.

3 of 6 tests fail and 3 still pass, which matters — a model cannot pass by
deleting the suite, and the surviving tests (parentheses, exponentiation,
left-associativity) constrain the fix.

Pristine `dist/index.mjs` sha256 starts `f22579ba06af36f4`; with the defect,
`909b93b1bd75967f`.

## Run

```
npm test          # or: node --test 'test/*.test.mjs'
```

Note `node --test <dir>` does not work on a bare directory — pass the glob.

## If a future model has memorized this

Change the planted defect rather than generating fixtures at run time.
Reproducibility is worth more than novelty here.
