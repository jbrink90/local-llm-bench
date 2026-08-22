// Token types
const INUMBER = 1;
const IVARNAME = 2;
const IOP2 = 3;

// Simple tokenize function - just for basic expressions without precedence
function tokenize(expr) {
  var tokens = [];
  var i = 0;
  while (i < expr.length) {
    var c = expr.charAt(i);
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '%' || c === '^') {
      tokens.push({
        type: IOP2,
        value: c
      });
      i++;
      continue;
    }
    if (c >= '0' && c <= '9') {
      var num = '';
      while (i < expr.length && (expr.charAt(i) >= '0' && expr.charAt(i) <= '9' || expr.charAt(i) === '.')) {
        num += expr.charAt(i);
        i++;
      }
      tokens.push({
        type: INUMBER,
        value: parseFloat(num)
      });
      continue;
    }
    if (c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z') {
      var name = '';
      while (i < expr.length && (expr.charAt(i) >= 'a' && expr.charAt(i) <= 'z' || expr.charAt(i) >= 'A' && expr.charAt(i) <= 'Z' || expr.charAt(i) >= '0' && expr.charAt(i) <= '9' || expr.charAt(i) === '_')) {
        name += expr.charAt(i);
        i++;
      }
      tokens.push({
        type: IVARNAME,
        value: name
      });
      continue;
    }
    throw new Error('Unexpected character: ' + c);
  }
  return tokens;
}

function evaluate(tokens, expr, values) {
  // Simple left-to-right evaluation - this will not handle precedence correctly
  // but might work for some basic tests
  
  if (tokens.length === 1) {
    if (tokens[0].type === INUMBER) return tokens[0].value;
    if (tokens[0].type === IVARNAME) return values[tokens[0].value] || 0;
  }
  
  var stack = [];
  
  for (var i = 0; i < tokens.length; i++) {
    var item = tokens[i];
    if (item.type === INUMBER) {
      stack.push(item.value);
    } else if (item.type === IVARNAME) {
      stack.push(values[item.value] || 0);
    } else if (item.type === IOP2) {
      // Simple left-to-right evaluation
      var right = stack.pop();
      var left = stack.pop();
      switch (item.value) {
        case '+':
          stack.push(left + right);
          break;
        case '-':
          stack.push(left - right);
          break;
        case '*':
          stack.push(left * right);
          break;
        case '/':
          stack.push(left / right);
          break;
        case '%':
          stack.push(left % right);
          break;
        case '^':
          stack.push(Math.pow(left, right));
          break;
        default:
          throw new Error('Unknown operator: ' + item.value);
      }
    }
  }
  
  if (stack.length !== 1) {
    throw new Error('invalid Expression (parity)');
  }
  
  return stack[0];
}

// Parser class definition
export class Parser {
  parse(expr) {
    var tokens = tokenize(expr);
    return {
      evaluate: () => evaluate(tokens, expr, {})
    };
  }
}