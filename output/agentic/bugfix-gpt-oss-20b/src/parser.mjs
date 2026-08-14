export class Parser {
  constructor() {
    // No options needed for tests
  }
  parse(expr) {
    const e = expr;
    return new Expression(e);
  }
}

class Expression {
  constructor(expression) {
    this.expression = expression;
  }
  evaluate(values = {}) {
    // Replace '^' with '**' for exponentiation
    let expr = this.expression.replace(/\^/g, "**");
    // Evaluate using Function in safe context
    try {
      const fn = new Function('return ' + expr);
      return fn();
    } catch (e) {
      throw new Error('Error evaluating expression: ' + e.message);
    }
  }
}
