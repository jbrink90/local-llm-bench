
import sys

def find_unbalanced(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    stack = []
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        # This is a very naive way to handle comments and strings.
        # But let's see if it helps.
        
        # Remove comments
        line_no_comments = line.split('//')[0]
        
        # Remove strings (very basic)
        import re
        line_no_strings = re.sub(r"'(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\"", "", line_no_comments)
        
        for j, char in enumerate(line_no_strings):
            if char == '{':
                stack.append((i + 1, j))
            elif char == '}':
                if stack:
                    stack.pop()
                else:
                    print(f"Extra }} at line {i + 1}, col {j}")

    if stack:
        for line_num, col in stack:
            print(f"Unclosed {{ at line {line_num}, col {col}")

find_unbalanced('src/parser.mjs')
