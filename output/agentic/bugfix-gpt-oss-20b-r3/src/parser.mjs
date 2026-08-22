// Simple expression parser for the test suite

class Parser {
  constructor() {
    // operator precedence map
    this.precedence = {
      '+': 2,
      '-': 2,
      '*': 3,
      '/': 3,
      '%': 3,
      '^': 4
    };
    // associativity: true = right associative
    this.rightAssociative = {
      '^': true
    };
  }

  parse(expr) {
    const tokens = this.tokenize(expr);
    const rpn = this.toRPN(tokens);
    const value = this.evaluateRPN(rpn);
    return {
      evaluate: () => value
    };
  }

  // Tokenize into array of {type, value}
  tokenize(str) {
    const tokens = [];
    const regex = /\s*(\d*\.?\d+|\S)/g;
    let match;
    while ((match = regex.exec(str)) !== null) {
      const tok = match[1];
      if (/^\d*\.?\d+$/.test(tok)) {
        tokens.push({ type: 'NUMBER', value: Number(tok) });
      } else if (['+', '-', '*', '/', '%', '^', '(', ')'].includes(tok)) {
        tokens.push({ type: 'OP', value: tok });
      } else {
        // unknown token
        throw new Error(`Unknown token: ${tok}`);
      }
    }
    return tokens;
  }

  toRPN(tokens) {
    const output = [];
    const stack = [];
    for (const token of tokens) {
      if (token.type === 'NUMBER') {
        output.push(token);
      } else if (token.type === 'OP') {
        const op = token.value;
        if (op === '(') {
          stack.push(token);
        } else if (op === ')') {
          while (stack.length && stack[stack.length - 1].value !== '(') {
            output.push(stack.pop());
          }
          if (stack.length && stack[stack.length - 1].value === '(') {
            stack.pop();
          } else {
            throw new Error('Mismatched parentheses');
          }
        } else {
          // operator
          while (
            stack.length && stack[stack.length - 1].value !== '(' &&
            (this.precedence[stack[stack.length - 1].value] > this.precedence[op] ||
              (this.precedence[stack[stack.length - 1].value] === this.precedence[op] && !this.rightAssociative[op]))
          ) {
            output.push(stack.pop());
          }
          stack.push(token);
        }
      }
    }
    while (stack.length) {
      const op = stack.pop();
      if (op.value === '(' || op.value === ')') {
        throw new Error('Mismatched parentheses');
      }
      output.push(op);
    }
    return output;
  }

  evaluateRPN(rpn) {
    const stack = [];
    for (const token of rpn) {
      if (token.type === 'NUMBER') {
        stack.push(token.value);
      } else if (token.type === 'OP') {
        const b = stack.pop();
        const a = stack.pop();
        switch (token.value) {
          case '+': stack.push(a + b); break;
          case '-': stack.push(a - b); break;
          case '*': stack.push(a * b); break;
          case '/': stack.push(a / b); break;
          case '%': stack.push(a % b); break;
          case '^': stack.push(Math.pow(a, b)); break;
          default: throw new Error(`Unsupported operator ${token.value}`);
        }
      }
    }
    if (stack.length !== 1) throw new Error('Invalid expression');
    return stack[0];
  }
}

export { Parser };
