
def find_unclosed_braces(filename):
    stack = []
    with open(filename, 'r') as f:
        for line_num, line in enumerate(f, 1):
            # This is a very naive parser, it doesn't handle strings or comments
            # but let's see if it helps.
            for i, char in enumerate(line):
                if char == '{':
                    stack.append((line_num, i))
                elif char == '}':
                    if stack:
                        stack.pop()
                    else:
                        print(f"Extra }} at line {line_num}, col {i}")
    
    for line_num, col in stack:
        print(f"Unclosed {{ at line {line_num}, col {col}")

find_unclosed_braces('src/parser.mjs')
