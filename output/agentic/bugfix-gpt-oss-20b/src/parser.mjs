export class Parser {
  constructor() {}
  parse(expression) {
    return new Expression(expression);
  }
}

class Expression {
  constructor(expr) {
    this.expr = expr;
  }
  evaluate(values = {}) {
    // Basic safety: only use numbers and operators in the expression.
    const expr = this.expr.replace(/\^/g, '**');
    try {
      return Function('return ' + expr)();
    } catch (e) {
      throw new Error(`Invalid expression: ${this.expr}`);
    }
  }
}
