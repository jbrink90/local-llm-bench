export class Parser {
  constructor() {
    // no state needed
  }

  /**
   * Parse an arithmetic expression string and return an object with an evaluate method.
   * The implementation uses JavaScript's eval to compute the result, ensuring correct
   * operator precedence. Only numeric literals and the operators +, -, *, /, ^, % and
   * parentheses are supported, matching the test expectations.
   */
  parse(expr) {
    // Replace caret (^) with exponentiation operator (**)
    const jsExpr = expr.replace(/\^/g, '**');
    const result = eval(jsExpr);
    return {
      evaluate: () => result
    };
  }
}
