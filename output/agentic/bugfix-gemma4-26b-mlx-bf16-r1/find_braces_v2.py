
import re

def find_unbalanced_braces(filename):
    with open(filename, 'r') as f:
        content = f.read()

    # Remove comments
    # Single line comments
    content = re.sub(r'//.*', '', content)
    # Multi-line comments
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

    # Remove strings
    # This is tricky because of escaped quotes. 
    # A simple regex for strings:
    content = re.sub(r'"(?:\\.|[^"\\])*"', '""', content)
    content = re.sub(r"'(?:\\.|[^'\\])*'", "''", content)

    stack = []
    for i, char in enumerate(content):
        if char == '{':
            stack.append(i)
        elif char == '}':
            if stack:
                stack.pop()
            else:
                # We can't easily get the line number here from index i
                print(f"Extra }} at index {i}")

    if stack:
        print(f"{len(stack)} unclosed {{ found.")
        for pos in stack:
            # To get line number:
            line_num = content.count('\n', 0, pos) + 1
            print(f"Unclosed {{ at line {line_num}")

find_unbalanced_braces('src/parser.mjs')
