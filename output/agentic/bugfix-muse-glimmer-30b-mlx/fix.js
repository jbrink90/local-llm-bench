import { readFileSync, writeFileSync } from 'fs';
const path = 'src/parser.mjs';
let content = readFileSync(path, 'utf8');
content = content.replace("var ADD_SUB_OPERATORS = ['*', '/', '%'];", "var ADD_SUB_OPERATORS = ['+', '-', '||'];");
content = content.replace("var TERM_OPERATORS = ['+', '-', '||'];", "var TERM_OPERATORS = ['*', '/', '%'];");
writeFileSync(path, content);
