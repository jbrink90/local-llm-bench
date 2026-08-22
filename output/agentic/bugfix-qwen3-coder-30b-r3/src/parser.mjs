export class Parser {
  parse(expr) {
    return new ParserState(expr).parse();
  }
}

const NUMBER = 'NUMBER';
const STRING = 'STRING';
const IDENTIFIER = 'IDENTIFIER';
const OPERATOR = 'OPERATOR';
const LEFT_PAREN = 'LEFT_PAREN';
const RIGHT_PAREN = 'RIGHT_PAREN';
const COMMA = 'COMMA';

class ParserState {
  constructor(expr) {
    this.expr = expr;
    this.pos = 0;
    this.current = null;
    this.tokens = [];
    this.tokenize();
    this.pos = 0;
    this.current = this.tokens[0];
  }

  tokenize() {
    const tokens = [];
    let i = 0;
    while (i < this.expr.length) {
      const char = this.expr[i];
      if (/\s/.test(char)) {
        i++;
        continue;
      }
      if (char === '(') {
        tokens.push({ type: LEFT_PAREN, value: char });
        i++;
        continue;
      }
      if (char === ')') {
        tokens.push({ type: RIGHT_PAREN, value: char });
        i++;
        continue;
      }
      if (char === ',') {
        tokens.push({ type: COMMA, value: char });
        i++;
        continue;
      }
      if (/[0-9]/.test(char)) {
        let num = '';
        while (i < this.expr.length && /[0-9.]/.test(this.expr[i])) {
          num += this.expr[i];
          i++;
        }
        tokens.push({ type: NUMBER, value: parseFloat(num) });
        continue;
      }
      if (char === "'") {
        let str = '';
        i++;
        while (i < this.expr.length && this.expr[i] !== "'") {
          str += this.expr[i];
          i++;
        }
        i++;
        tokens.push({ type: STRING, value: str });
        continue;
      }
      if (/[a-zA-Z_]/.test(char)) {
        let id = '';
        while (i < this.expr.length && /[a-zA-Z0-9_]/.test(this.expr[i])) {
          id += this.expr[i];
          i++;
        }
        tokens.push({ type: IDENTIFIER, value: id });
        continue;
      }
      // Handle multi-character operators
      if (char === '=' && this.expr[i+1] === '=') {
        tokens.push({ type: OPERATOR, value: '==' });
        i += 2;
        continue;
      }
      if (char === '!' && this.expr[i+1] === '=') {
        tokens.push({ type: OPERATOR, value: '!=' });
        i += 2;
        continue;
      }
      if (char === '<' && this.expr[i+1] === '=') {
        tokens.push({ type: OPERATOR, value: '<=' });
        i += 2;
        continue;
      }
      if (char === '>' && this.expr[i+1] === '=') {
        tokens.push({ type: OPERATOR, value: '>=' });
        i += 2;
        continue;
      }
      if (['+', '-', '*', '/', '%', '^', '<', '>', '!'].includes(char)) {
        tokens.push({ type: OPERATOR, value: char });
        i++;
        continue;
      }
      throw new Error(`Unexpected character: ${char}`);
    }
    this.tokens = tokens;
  }

  parse() {
    const instr = [];
    this.parseExpr(instr);
    return {
      evaluate: () => this.evaluate(instr)
    };
  }

  parseExpr(instr) {
    this.parseComparison(instr);
  }

  accept(type, values) {
    if (this.current && this.current.type === type) {
      if (values && !values.includes(this.current.value)) {
        return false;
      }
      const result = this.current.value;
      this.pos++;
      this.current = this.tokens[this.pos];
      return result;
    }
    return false;
  }

  parseComparison(instr) {
    this.parseAddSub(instr);
    const COMPARISON_OPERATORS = ['==', '!=', '<', '<=', '>=', '>'];
    while (true) {
      const op = this.accept(OPERATOR, COMPARISON_OPERATORS);
      if (!op) break;
      this.parseAddSub(instr);
      instr.push({ type: 'BINARY_OP', value: op });
    }
  }

  parseAddSub(instr) {
    this.parseTerm(instr);
    const ADD_SUB_OPERATORS = ['+', '-'];
    while (true) {
      const op = this.accept(OPERATOR, ADD_SUB_OPERATORS);
      if (!op) break;
      this.parseTerm(instr);
      instr.push({ type: 'BINARY_OP', value: op });
    }
  }

  parseTerm(instr) {
    this.parsePower(instr);
    const TERM_OPERATORS = ['*', '/', '%'];
    while (true) {
      const op = this.accept(OPERATOR, TERM_OPERATORS);
      if (!op) break;
      this.parsePower(instr);
      instr.push({ type: 'BINARY_OP', value: op });
    }
  }

  parsePower(instr) {
    this.parseFactor(instr);
    const POWER_OPERATORS = ['^'];
    while (true) {
      const op = this.accept(OPERATOR, POWER_OPERATORS);
      if (!op) break;
      this.parseFactor(instr);
      instr.push({ type: 'BINARY_OP', value: op });
    }
  }

  parseFactor(instr) {
    const num = this.accept(NUMBER);
    if (num !== false) {
      instr.push({ type: 'PUSH', value: num });
    } else if (this.accept(LEFT_PAREN) !== false) {
      this.parseExpr(instr);
      if (this.accept(RIGHT_PAREN) === false) {
        throw new Error('Missing closing parenthesis');
      }
    } else {
      throw new Error(`Unexpected token: ${this.current?.value}`);
    }
  }

  evaluate(instr) {
    const stack = [];
    for (const inst of instr) {
      if (inst.type === 'PUSH') {
        stack.push(inst.value);
      } else if (inst.type === 'BINARY_OP') {
        const b = stack.pop();
        const a = stack.pop();
        switch (inst.value) {
          case '+': stack.push(a + b); break;
          case '-': stack.push(a - b); break;
          case '*': stack.push(a * b); break;
          case '/': stack.push(a / b); break;
          case '%': stack.push(a % b); break;
          case '^': stack.push(Math.pow(a, b)); break;
          case '==': stack.push(a == b); break;
          case '!=': stack.push(a != b); break;
          case '<': stack.push(a < b); break;
          case '>': stack.push(a > b); break;
          case '<=': stack.push(a <= b); break;
          case '>=': stack.push(a >= b); break;
          default: throw new Error(`Unknown operator: ${inst.value}`);
        }
      }
    }
    return stack[0];
  }
}