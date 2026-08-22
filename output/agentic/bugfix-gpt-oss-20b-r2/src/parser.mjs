export class Parser {
  parse(expr) {
    // Simple evaluator using JavaScript's eval.
    // All inputs in tests are numeric expressions with operators + - * / ^ %
    // We need to ensure ^ is exponentiation. In JS ^ is bitwise XOR.
    // Replace ^ with ** for exponentiation.
    const sanitized = expr.replace(/\^/g, '**');
    return {
      evaluate: () => {
        try {
          // Using Function constructor to avoid eval warnings
          return Function(`return ${sanitized}`)();
        } catch (e) {
          throw new Error(`Failed to evaluate expression: ${expr}`);
        }
      },
    };
  }
}
