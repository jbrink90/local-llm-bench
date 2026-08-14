var INUMBER = 'INUMBER';
var IOP1 = 'IOP1';
var IOP2 = 'IOP2';
var IOP3 = 'IOP3';
var IVAR = 'IVAR';
var IVARNAME = 'IVARNAME';
var IFUNCALL = 'IFUNCALL';
var IFUNDEF = 'IFUNDEF';
var IEXPR = 'IEXPR';
var IEXPREVAL = 'IEXPREVAL';
var IMEMBER = 'IMEMBER';
var IENDSTATEMENT = 'IENDSTATEMENT';
var IARRAY = 'IARRAY';

function Instruction(type, value) {
  this.type = type;
  this.value = (value !== undefined && value !== null) ? value : 0;
}

Instruction.prototype.toString = function () {
  switch (this.type) {
    case INUMBER:
    case IOP1:
    case IOP2:
    case IOP3:
    case IVAR:
    case IVARNAME:
    case IENDSTATEMENT:
      return this.value;
    case IFUNCALL:
      return 'CALL ' + this.value;
    case IFUNDEF:
      return 'DEF ' + this.value;
    case IARRAY:
      return 'ARRAY ' + this.value;
    case IMEMBER:
      return '.' + this.value;
    default:
      return 'Invalid Instruction';
  }
};

function unaryInstruction(value) {
  return new Instruction(IOP1, value);
}

function binaryInstruction(value) {
  return new Instruction(IOP2, value);
}

function ternaryInstruction(value) {
  return new Instruction(IOP3, value);
}

function simplify(tokens, unaryOps, binaryOps, ternaryOps, values) {
  var nstack = [];
  var newexpression = [];
  var n1, n2, n3;
  var f;
  for (var i = 0; i < tokens.length; i++) {
    var item = tokens[i];
    var type = item.type;
    if (type === INUMBER || type === IVARNAME) {
      if (Array.isArray(item.value)) {
        nstack.push.apply(nstack, simplify(item.value.map(function (x) {
          return new Instruction(INUMBER, x);
        }).concat(new Instruction(IARRAY, item.value.length)), unaryOps, binaryOps, ternaryOps, values));
      } else {
        nstack.push(item);
      }
    } else if (type === IVAR && values.hasOwnProperty(item.value)) {
      item = new Instruction(INUMBER, values[item.value]);
      nstack.push(item);
    } else if (type === IOP2 && nstack.length > 1) {
      n2 = nstack.pop();
      n1 = nstack.pop();
      f = binaryOps[item.value];
      item = new Instruction(INUMBER, f(n1.value, n2.value));
      nstack.push(item);
    } else if (type === IOP3 && nstack.length > 2) {
      n3 = nstack.pop();
      n2 = nstack.pop();
      n1 = nstack.pop();
      if (item.value === '?') {
        nstack.push(n1.value ? n2.value : n3.value);
      } else {
        f = ternaryOps[item.value];
        item = new Instruction(INUMBER, f(n1.value, n2.value, n3.value));
        nstack.push(item);
      }
    } else if (type === IOP1 && nstack.length > 0) {
      n1 = nstack.pop();
      f = unaryOps[item.value];
      item = new Instruction(INUMBER, f(n1.value));
      nstack.push(item);
    } else if (type === IEXPR) {
      while (nstack.length > 0) {
        newexpression.push(nstack.shift());
      }
      newexpression.push(new Instruction(IEXPR, simplify(item.value, unaryOps, binaryOps, ternaryOps, values)));
    } else if (type === IMEMBER && nstack.length > 0) {
      n1 = nstack.pop();
      nstack.push(new Instruction(INUMBER, n1.value[item.value]));
    } /* else if (type === IARRAY && nstack.length >= item.value) {
      var length = item.value;
      while (length-- > 0) {
        newexpression.push(nstack.pop());
      }
      newexpression.push(new Instruction(IARRAY, item.value));
    } */ else {
      while (nstack.length > 0) {
        newexpression.push(nstack.shift());
      }
      newexpression.push(item);
    }
  }
  while (nstack.length > 0) {
    newexpression.push(nstack.shift());
  }
  return newexpression;
}

function substitute(tokens, variable, expr) {
  var newexpression = [];
  for (var i = 0; i < tokens.length; i++) {
    var item = tokens[i];
    var type = item.type;
    if (type === IVAR && item.value === variable) {
      for (var j = 0; j < expr.tokens.length; j++) {
        var expritem = expr.tokens[j];
        var replitem;
        if (expritem.type === IOP1) {
          replitem = unaryInstruction(expritem.value);
        } else if (expritem.type === IOP2) {
          replitem = binaryInstruction(expritem.value);
        } else if (expritem.type === IOP3) {
          replitem = ternaryInstruction(expritem.value);
        } else {
          replitem = new Instruction(expritem.type, expritem.value);
        }
        newexpression.push(replitem);
      }
    } else if (type === IEXPR) {
      newexpression.push(new Instruction(IEXPR, substitute(item.value, variable, expr)));
    } else {
      newexpression.push(item);
    }
  }
  return newexpression;
}

function evaluate(tokens, expr, values) {
  var nstack = [];
  var n1, n2, n3;
  var f, args, argCount;

  if (isExpressionEvaluator(tokens)) {
    return resolveExpression(tokens, values);
  }

  var numTokens = tokens.length;

  for (var i = 0; i < numTokens; i++) {
    var item = tokens[i];
    var type = item.type;
    if (type === INUMBER || type === IVARNAME) {
      nstack.push(item.value);
    } else if (type === IOP2) {
      n2 = nstack.pop();
      n1 = nstack.pop();
      if (item.value === 'and') {
        nstack.push(n1 ? !!evaluate(n2, expr, values) : false);
      } else if (item.value === 'or') {
        nstack.push(n1 ? true : !!evaluate(n2, expr, values));
      } else if (item.value === '=') {
        f = expr.binaryOps[item.value];
        nstack.push(f(n1, evaluate(n2, expr, values), values));
      } else {
        f = expr.binaryOps[item.value];
        nstack.push(f(resolveExpression(n1, values), resolveExpression(n2, values)));
      }
    } else if (type === IOP3) {
      n3 = nstack.pop();
      n2 = nstack.pop();
      n1 = nstack.pop();
      if (item.value === '?') {
        nstack.push(evaluate(n1 ? n2 : n3, expr, values));
      } else {
        f = expr.ternaryOps[item.value];
        nstack.push(f(resolveExpression(n1, values), resolveExpression(n2, values), resolveExpression(n3, values)));
      }
    } else if (type === IVAR) {
      if (item.value in expr.functions) {
        nstack.push(expr.functions[item.value]);
      } else if (item.value in expr.unaryOps && expr.parser.isOperatorEnabled(item.value)) {
        nstack.push(expr.unaryOps[item.value]);
      } else {
        var v = values[item.value];
        if (v !== undefined) {
          nstack.push(v);
        } else {
          throw new Error('undefined variable: ' + item.value);
        }
      }
    } else if (type === IOP1) {
      n1 = nstack.pop();
      f = expr.unaryOps[item.value];
      nstack.push(f(resolveExpression(n1, values)));
    } else if (type === IFUNCALL) {
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(resolveExpression(nstack.pop(), values));
      }
      f = nstack.pop();
      if (f.apply && f.call) {
        nstack.push(f.apply(undefined, args));
      } else {
        throw new Error(f + ' is not a function');
      }
    } else if (type === IFUNDEF) {
      // Create closure to keep references to arguments and expression
      nstack.push((function () {
        var n2 = nstack.pop();
        var args = [];
        var argCount = item.value;
        while (argCount-- > 0) {
          args.unshift(nstack.pop());
        }
        var n1 = nstack.pop();
        var f = function () {
          var scope = Object.assign({}, values);
          for (var i = 0, len = args.length; i < len; i++) {
            scope[args[i]] = arguments[i];
          }
          return evaluate(n2, expr, scope);
        };
        // f.name = n1
        Object.defineProperty(f, 'name', {
          value: n1,
          writable: false
        });
        values[n1] = f;
        return f;
      })());
    } else if (type === IEXPR) {
      nstack.push(createExpressionEvaluator(item, expr));
    } else if (type === IEXPREVAL) {
      nstack.push(item);
    } else if (type === IMEMBER) {
      n1 = nstack.pop();
      nstack.push(n1[item.value]);
    } else if (type === IENDSTATEMENT) {
      nstack.pop();
    } else if (type === IARRAY) {
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(nstack.pop());
      }
      nstack.push(args);
    } else {
      throw new Error('invalid Expression');
    }
  }
  if (nstack.length > 1) {
    throw new Error('invalid Expression (parity)');
  }
  // Explicitly return zero to avoid test issues caused by -0
  return nstack[0] === 0 ? 0 : resolveExpression(nstack[0], values);
}

function createExpressionEvaluator(token, expr, values) {
  if (isExpressionEvaluator(token)) return token;
  return {
    type: IEXPREVAL,
    value: function (scope) {
      return evaluate(token.value, expr, scope);
    }
  };
}

function isExpressionEvaluator(n) {
  return n && n.type === IEXPREVAL;
}

function resolveExpression(n, values) {
  return isExpressionEvaluator(n) ? n.value(values) : n;
}

function expressionToString(tokens, toJS) {
  var nstack = [];
  var n1, n2, n3;
  var f, args, argCount;
  for (var i = 0; i < tokens.length; i++) {
    var item = tokens[i];
    var type = item.type;
    if (type === INUMBER) {
      if (typeof item.value === 'number' && item.value < 0) {
        nstack.push('(' + item.value + ')');
      } else if (Array.isArray(item.value)) {
        nstack.push('[' + item.value.map(escapeValue).join(', ') + ']');
      } else {
        nstack.push(escapeValue(item.value));
      }
    } else if (type === IOP2) {
      n2 = nstack.pop();
      n1 = nstack.pop();
      f = item.value;
      if (toJS) {
        if (f === '^') {
          nstack.push('Math.pow(' + n1 + ', ' + n2 + ')');
        } else if (f === 'and') {
          nstack.push('(!!' + n1 + ' && !!' + n2 + ')');
        } else if (f === 'or') {
          nstack.push('(!!' + n1 + ' || !!' + n2 + ')');
        } else if (f === '||') {
          nstack.push('(function(a,b){ return Array.isArray(a) && Array.isArray(b) ? a.concat(b) : String(a) + String(b); }((' + n1 + '),(' + n2 + ')))');
        } else if (f === '==') {
          nstack.push('(' + n1 + ' === ' + n2 + ')');
        } else if (f === '!=') {
          nstack.push('(' + n1 + ' !== ' + n2 + ')');
        } else if (f === '[') {
          nstack.push(n1 + '[(' + n2 + ') | 0]');
        } else {
          nstack.push('(' + n1 + ' ' + f + ' ' + n2 + ')');
        }
      } else {
        if (f === '[') {
          nstack.push(n1 + '[' + n2 + ']');
        } else {
          nstack.push('(' + n1 + ' ' + f + ' ' + n2 + ')');
        }
      }
    } else if (type === IOP3) {
      n3 = nstack.pop();
      n2 = nstack.pop();
      n1 = nstack.pop();
      f = item.value;
      if (f === '?') {
        nstack.push('(' + n1 + ' ? ' + n2 + ' : ' + n3 + ')');
      } else {
        throw new Error('invalid Expression');
      }
    } else if (type === IVAR || type === IVARNAME) {
      nstack.push(item.value);
    } else if (type === IOP1) {
      n1 = nstack.pop();
      f = item.value;
      if (f === '-' || f === '+') {
        nstack.push('(' + f + n1 + ')');
      } else if (toJS) {
        if (f === 'not') {
          nstack.push('(' + '!' + n1 + ')');
        } else if (f === '!') {
          nstack.push('fac(' + n1 + ')');
        } else {
          nstack.push(f + '(' + n1 + ')');
        }
      } else if (f === '!') {
        nstack.push('(' + n1 + '!)');
      } else {
        nstack.push('(' + f + ' ' + n1 + ')');
      }
    } else if (type === IFUNCALL) {
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(nstack.pop());
      }
      f = nstack.pop();
      nstack.push(f + '(' + args.join(', ') + ')');
    } else if (type === IFUNDEF) {
      n2 = nstack.pop();
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(nstack.pop());
      }
      n1 = nstack.pop();
      if (toJS) {
        nstack.push('(' + n1 + ' = function(' + args.join(', ') + ') { return ' + n2 + ' })');
      } else {
        nstack.push('(' + n1 + '(' + args.join(', ') + ') = ' + n2 + ')');
      }
    } else if (type === IMEMBER) {
      n1 = nstack.pop();
      nstack.push(n1 + '.' + item.value);
    } else if (type === IARRAY) {
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(nstack.pop());
      }
      nstack.push('[' + args.join(', ') + ']');
    } else if (type === IEXPR) {
      nstack.push('(' + expressionToString(item.value, toJS) + ')');
    } else if (type === IENDSTATEMENT) ; else {
      throw new Error('invalid Expression');
    }
  }
  if (nstack.length > 1) {
    if (toJS) {
      nstack = [ nstack.join(',') ];
    } else {
      nstack = [ nstack.join(';') ];
    }
  }
  return String(nstack[0]);
}

function escapeValue(v) {
  if (typeof v === 'string') {
    return JSON.stringify(v).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  }
  return v;
}

function contains(array, obj) {
  for (var i = 0; i < array.length; i++) {
    if (array[i] === obj) {
      return true;
    }
  }
  return false;
}

function getSymbols(tokens, symbols, options) {
  options = options || {};
  var withMembers = !!options.withMembers;
  var prevVar = null;

  for (var i = 0; i < tokens.length; i++) {
    var item = tokens[i];
    if (item.type === IVAR || item.type === IVARNAME) {
      if (!withMembers && !contains(symbols, item.value)) {
        symbols.push(item.value);
      } else if (prevVar !== null) {
        if (!contains(symbols, prevVar)) {
          symbols.push(prevVar);
        }
        prevVar = item.value;
      } else {
        prevVar = item.value;
      }
    } else if (item.type === IMEMBER && withMembers && prevVar !== null) {
      prevVar += '.' + item.value;
    } else if (item.type === IEXPR) {
      getSymbols(item.value, symbols, options);
    } else if (prevVar !== null) {
      if (!contains(symbols, prevVar)) {
        symbols.push(prevVar);
      }
      prevVar = null;
    }
  }

  if (prevVar !== null && !contains(symbols, prevVar)) {
    symbols.push(prevVar);
  }
}

function Expression(tokens, parser) {
  this.tokens = tokens;
  this.parser = parser;
  this.unaryOps = parser.unaryOps;
  this.binaryOps = parser.binaryOps;
  this.ternaryOps = parser.ternaryOps;
  this.functions = parser.functions;
}

Expression.prototype.simplify = function (values) {
  values = values || {};
  return new Expression(simplify(this.tokens, this.unaryOps, this.binaryOps, this.ternaryOps, values), this.parser);
};

Expression.prototype.substitute = function (variable, expr) {
  if (!(expr instanceof Expression)) {
    expr = this.parser.parse(String(expr));
  }

  return new Expression(substitute(this.tokens, variable, expr), this.parser);
};

Expression.prototype.evaluate = function (values) {
  values = values || {};
  return evaluate(this.tokens, this, values);
};

Expression.prototype.toString = function () {
  return expressionToString(this.tokens, false);
};

Expression.prototype.symbols = function (options) {
  options = options || {};
  var vars = [];
  getSymbols(this.tokens, vars, options);
  return vars;
};

Expression.prototype.variables = function (options) {
  options = options || {};
  var vars = [];
  getSymbols(this.tokens, vars, options);
  var functions = this.functions;
  return vars.filter(function (name) {
    return !(name in functions);
  });
};

Expression.prototype.toJSFunction = function (param, variables) {
  var expr = this;
  var f = new Function(param, 'with(this.functions) with (this.ternaryOps) with (this.binaryOps) with (this.unaryOps) { return ' + expressionToString(this.simplify(variables).tokens, true) + '; }'); // eslint-disable-line no-new-func
  return function () {
    return f.apply(expr, arguments);
  };
};

var TEOF = 'TEOF';
var TOP = 'TOP';
var TNUMBER = 'TNUMBER';
var TSTRING = 'TSTRING';
var TPAREN = 'TPAREN';
var TBRACKET = 'TBRACKET';
var TCOMMA = 'TCOMMA';
var TNAME = 'TNAME';
var TSEMICOLON = 'TSEMICOLON';

function Token(type, value, index) {
  this.type = type;
  this.value = value;
  this.index = index;
}

Token.prototype.toString = function () {
  return this.type + ': ' + this.value;
};

function TokenStream(parser, expression) {
  this.pos = 0;
  this.current = null;
  this.unaryOps = parser.unaryOps;
  this.binaryOps = parser.binaryOps;
  this.ternaryOps = parser.ternaryOps;
  this.consts = parser.consts;
  this.expression = expression;
  this.savedPosition = 0;
  this.savedCurrent = null;
  this.options = parser.options;
  this.parser = parser;
}

TokenStream.prototype.newToken = function (type, value, pos) {
  return new Token(type, value, pos != null ? pos : this.pos);
};

TokenStream.prototype.save = function () {
  this.savedPosition = this.pos;
  this.savedCurrent = this.current;
};

TokenStream.prototype.restore = function () {
  this.pos = this.savedPosition;
  this.current = this.savedCurrent;
};

TokenStream.prototype.next = function () {
  if (this.pos >= this.expression.length) {
    return this.newToken(TEOF, 'EOF');
  }

  if (this.isWhitespace() || this.isComment()) {
    return this.next();
  } else if (this.isRadixInteger() ||
      this.isNumber() ||
      this.isOperator() ||
      this.isString() ||
      this.isParen() ||
      this.isBracket() ||
      this.isComma() ||
      this.isSemicolon() ||
      this.isNamedOp() ||
      this.isConst() ||
      this.isName()) {
    return this.current;
  } else {
    this.parseError('Unknown character "' + this.expression.charAt(this.pos) + '"');
  }
};

TokenStream.prototype.isString = function () {
  var r = false;
  var startPos = this.pos;
  var quote = this.expression.charAt(startPos);

  if (quote === '\'' || quote === '"') {
    var index = this.expression.indexOf(quote, startPos + 1);
    while (index >= 0 && this.pos < this.expression.length) {
      this.pos = index + 1;
      if (this.expression.charAt(index - 1) !== '\\') {
        var rawString = this.expression.substring(startPos + 1, index);
        this.current = this.newToken(TSTRING, this.unescape(rawString), startPos);
        r = true;
        break;
      }
      index = this.expression.indexOf(quote, index + 1);
    }
  }
  return r;
};

TokenStream.prototype.isParen = function () {
  var c = this.expression.charAt(this.pos);
  if (c === '(' || c === ')') {
    this.current = this.newToken(TPAREN, c);
    this.pos++;
    return true;
  }
  return false;
};

TokenStream.prototype.isBracket = function () {
  var c = this.expression.charAt(this.pos);
  if ((c === '[' || c === ']') && this.isOperatorEnabled('[')) {
    this.current = this.newToken(TBRACKET, c);
    this.pos++;
    return true;
  }
  return false;
};

TokenStream.prototype.isComma = function () {
  var c = this.expression.charAt(this.pos);
  if (c === ',') {
    this.current = this.newToken(TCOMMA, ',');
    this.pos++;
    return true;
  }
  return false;
};

TokenStream.prototype.isSemicolon = function () {
  var c = this.expression.charAt(this.pos);
  if (c === ';') {
    this.current = this.newToken(TSEMICOLON, ';');
    this.pos++;
    return true;
  }
  return false;
};

TokenStream.prototype.isConst = function () {
  var startPos = this.pos;
  var i = startPos;
  for (; i < this.expression.length; i++) {
    var c = this.expression.charAt(i);
    if (c.toUpperCase() === c.toLowerCase()) {
      if (i === this.pos || (c !== '_' && c !== '.' && (c < '0' || c > '9'))) {
        break;
      }
    }
  }
  if (i > startPos) {
    var str = this.expression.substring(startPos, i);
    if (str in this.consts) {
      this.current = this.newToken(TNUMBER, this.consts[str]);
      this.pos += str.length;
      return true;
    }
  }
  return false;
};

TokenStream.prototype.isNamedOp = function () {
  var startPos = this.pos;
  var i = startPos;
  for (; i < this.expression.length; i++) {
    var c = this.expression.charAt(i);
    if (c.toUpperCase() === c.toLowerCase()) {
      if (i === this.pos || (c !== '_' && (c < '0' || c > '9'))) {
        break;
      }
    }
  }
  if (i > startPos) {
    var str = this.expression.
      substring(startPos, i);
    if (str in this.consts) {
      this.current = this.newToken(TNUMBER, this.consts[str]);
      this.pos += str.length;
      return true;
    }
  }
  return false;
};

TokenStream.prototype.isName = function () {
  var c = this.expression.charAt(this.pos);
  if (c === '$' || c === '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
    var i = this.pos + 1;
    for (; i < this.expression.length; i++) {
      c = this.expression.charAt(i);
      if (c === '$' || c === '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
        continue;
      } else {
        break;
      }
    }
    var str = this.expression.substring(this.pos, i);
    if (str in this.consts) {
      this.current = this.newToken(TNUMBER, this.consts[str]);
      this.pos += str.length;
      return true;
    } else if (str === 'true' || str === 'false') {
      this.current = this.newToken(TNUMBER, str === 'true');
      this.pos += str.length;
      return true;
    } else {
      this.current = this.newToken(TNAME, str);
      this.pos += str.length;
      return true;
    }
  }
  return false;
};

TokenStream.prototype.isNumber = function () {
  var i = this.pos;
  var c;
  var hasDot = false;
  var hasExp = false;

  if (this.expression.charAt(i) === '.') {
    i++;
    hasDot = true;
  }

  for (; i < this.expression.length; i++) {
    c = this.expression.charAt(i);
    if (c >= '0' && c <= '9') {
      continue;
    } else if (c === '.' && !hasDot) {
      hasDot = true;
    } else if ((c === 'e' || c === 'E') && !hasExp) {
      hasExp = true;
      if (i + 1 < this.expression.length) {
        var nextChar = this.expression.charAt(i + 1);
        if (nextChar === '+' || nextChar === '-') {
          i++;
        }
      }
    } else {
      break;
    }
  }

  if (i > this.pos) {
    var str = this.expression.substring(this.pos, i);
    this.current = this.newToken(TNUMBER, parseFloat(str));
    this.pos += str.length;
    return true;
  }
  return false;
};

TokenStream.prototype.isRadixInteger = function () {
  var c = this.expression.charAt(this.pos);
  if (c === '0') {
    if (this.pos + 1 < this.expression.length) {
      var nextChar = this.expression.charAt(this.pos + 1);
      if (nextChar === 'x' || nextChar === 'X') {
        var i = this.pos + 2;
        for (; i < this.expression.length; i++) {
          c = this.expression.charAt(i);
          if ((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
            continue;
          } else {
            break;
          }
        }
        if (i > this.pos + 2) {
          var str = this.expression.substring(this.pos, i);
          this.current = this.newToken(TNUMBER, parseInt(str, 16));
          this.pos += str.length;
          return true;
        }
      }
    }
  }
  return false;
};

TokenStream.prototype.isOperator = function () {
  var c = this.expression.charAt(this.pos);
  if (c === '+' || c === '-' || c === '*' || c === '/' || c === '%' || c === '^' || c === '=' || c === '!' || c === '>' || c === '<' || c === '&' || c === '|' || c === '?') {
    var i = this.pos;
    if (c === '=') {
      if (this.expression.charAt(i + 1) === '=') {
        i++;
      }
    } else if (c === '!') {
      if (this.expression.charAt(i + 1) === '=') {
        i++;
      }
    } else if (c === '&') {
      if (this.expression.charAt(i + 1) === '&') {
        i++;
      }
    } else if (c === '|') {
      if (this.expression.charAt(i + 1) === '|') {
        i++;
      }
    } else if (c === '<') {
      if (this.expression.charAt(i + 1) === '=') {
        i++;
      }
    } else if (c === '>') {
      if (this.expression.charAt(i + 1) === '=') {
        i++;
      }
    }
    this.current = this.newToken(TOP, this.expression.substring(this.pos, i + 1));
    this.pos += i - this.pos + 1;
    return true;
  }
  return false;
};

TokenStream.prototype.isWhitespace = function () {
  var c = this.expression.charAt(this.pos);
  if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
    this.pos++;
    return true;
  }
  return false;
};

TokenStream.prototype.isComment = function () {
  var c = this.expression.charAt(this.pos);
  if (c === '/') {
    if (this.pos + 1 < this.expression.length) {
      var nextChar = this.expression.charAt(this.pos + 1);
      if (nextChar === '/') {
        var i = this.pos + 2;
        for (; i < this.expression.length; i++) {
          c = this.expression.charAt(i);
          if (c !== '\n') {
            continue;
          } else {
            break;
          }
        }
        this.pos = i;
        return true;
      } else if (nextChar === '*') {
        var i = this.pos + 2;
        for (; i < this.expression.length; i++) {
          c = this.expression.charAt(i);
          if (c === '*' && this.expression.charAt(i + 1) === '/') {
            i += 2;
            break;
          }
        }
        this.pos = i;
        return true;
      }
    }
  }
  return false;
};

TokenStream.prototype.parseError = function (message) {
  throw new Error(message);
};

TokenStream.prototype.unescape = function (str) {
  return str.replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\'/g, '\'')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
};

function ParserState(parser, expression) {
  this.stream = new TokenStream(parser, expression);
  this.parser = parser;
}

ParserState.prototype.parse = function () {
  var instr = [];
  this.stream.save();
  this.stream.next();
  this.parseAddSub(instr);
  if (this.stream.current.type !== TEOF) {
    this.stream.restore();
    this.stream.parseError('Syntax error');
  }
  return instr;
};

ParserState.prototype.accept = function (type, values) {
  if (this.stream.current.type === type && values.indexOf(this.stream.current.value) !== -1) {
    var token = this.stream.current;
    this.stream.next();
    return token;
  }
  return null;
};

ParserState.prototype.parseAddSub = function (instr) {
  this.parseTerm(instr);
  while (this.accept(TOP, ADD_SUB_OPERATORS)) {
    var op = this.stream.current;
    this.parseTerm(instr);
    instr.push(binaryInstruction(op.value));
  }
};

ParserState.prototype.parseTerm = function (instr) {
  this.parseFactor(instr);
  while (this.accept(TOP, TERM_OPERATORS)) {
    var op = this.stream.current;
    this.parseFactor(instr);
    instr.push(binaryInstruction(op.value));
  }
};

ParserState.prototype.parseFactor = function (instr) {
  this.parseExponential(instr);
  while (this.accept(TOP, FACTOR_OPERATORS)) {
    var op = this.stream.current;
    this.parseExponential(instr);
    instr.push(binaryInstruction(op.value));
  }
};

ParserState.prototype.parseExponential = function (instr) {
  if (this.accept(TNUMBER)) {
    instr.push(new Instruction(INUMBER, this.stream.current.value));
  } else if (this.accept(TNAME)) {
    instr.push(new Instruction(IVARNAME, this.stream.current.value));
  } else if (this.accept(TPAREN, '(')) {
    this.parseAddSub(instr);
    if (!this.accept(TPAREN, ')')) {
      this.stream.parseError('Syntax error');
    }
  } else {
    this.stream.parseError('Syntax error');
  }
};

// The bug fix: Swapped the operator precedence levels
var ADD_SUB_OPERATORS = ['+', '-', '||'];
var TERM_OPERATORS = ['*', '/', '%'];

var FACTOR_OPERATORS = ['^'];

function Parser() {
  this.unaryOps = {
    '+': function (x) { return x; },
    '-': function (x) { return -x; },
    '!': function (x) { return !x; },
    'not': function (x) { return !x; }
  };
  this.binaryOps = {
    '+': function (x, y) { return x + y; },
    '-': function (x, y) { return x - y; },
    '*': function (x, y) { return x * y; },
    '/': function (x, y) { return x / y; },
    '%': function (x, y) { return x % y; },
    '^': function (x, y) { return Math.pow(x, y); },
    '=': function (x, y) { return x === y; },
    '==': function (x, y) { return x == y; },
    '!=': function (x, y) { return x != y; },
    '<': function (x, y) { return x < y; },
    '>': function (x, y) { return x > y; },
    '<=': function (x, y) { return x <= y; },
    '>=': function (x, y) { return x >= y; },
    'and': function (x, y) { return x && y; },
    'or': function (x, y) { return x || y; }
  };
  this.ternaryOps = {
    '?': function (x, y, z) { return x ? y : z; }
  };
  this.functions = {};
  this.consts = {
    'true': true,
    'false': false,
    'null': null,
    'undefined': undefined,
    'PI': Math.PI,
    'E': Math.E
  };
}

Parser.prototype.parse = function (expression) {
  var state = new ParserState(this, expression);
  return new Expression(state.parse(), this);
};

Parser.prototype.isOperatorEnabled = function (op) {
  return true;
};

export { Parser };