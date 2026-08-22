import re

def find_unclosed(filename):
    with open(filename, 'r') as f:
        content = f.read()

    stack = []
    # State: 0 = normal, 1 = single quote string, 2 = double quote string, 3 = backtick string, 4 = single line comment, 5 = multi-line comment
    state = 0
    i = 0
    while i < len(content):
        char = content[i]
        next_char = content[i+1] if i + 1 < len(content) else ''

        if state == 0:
            if char == "'":
                state = 1
            elif char == '"':
                state = 2
            elif char == '`':
                state = 3
            elif char == '/':
                if next_char == '/':
                    state = 4
                elif next_char == '*':
                    state = 5
                    i += 1
            elif char == '{':
                stack.append(('{', i))
            elif char == '}':
                if stack and stack[-1][0] == '{':
                    stack.pop()
                else:
                    print(f"Unexpected }} at position {i}")
            elif char == '(':
                stack.append(('(', i))
            elif char == ')':
                if stack and stack[-1][0] == '(':
                    stack.pop()
                else:
                    print(f"Unexpected ) at position {i}")
            elif char == '[':
                stack.append(('[', i))
            elif char == ']':
                if stack and stack[-1][0] == '[':
                    stack.pop()
                else:
                    print(f"Unexpected ] at position {i}")
            elif char == '<':
                # Not really used for nesting in JS but let's see
                pass
            elif char == '>':
                pass

        elif state == 1: # Single quote string
            if char == "'" and content[i-1] != '\\':
                state = 0
        elif state == 2: # Double quote string
            if char == '"' and content[i-1] != '\\':
                state = 0
        elif state == 3: # Backtick string
            if char == '`' and content[i-1] != '\\':
                state = 0
        elif state == 4: # Single line comment
            if char == '\n':
                state = 0
        elif state == 5: # Multi-line comment
            if char == '*' and next_char == '/':
                state = 0
                i += 1
        
        i += 1

    if stack:
        for item, pos in stack:
            print(f"Unclosed {item} at position {pos}")
    else:
        print("No unclosed braces found")

find_unclosed('src/parser.mjs')
