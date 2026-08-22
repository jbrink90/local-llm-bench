
def find_unbalanced(filename):
    with open(filename, 'r') as f:
        content = f.read()

    stack = []
    # We need to ignore braces inside strings and comments.
    # This is a bit more complex.
    
    i = 0
    while i < len(content):
        # Check for single line comment
        if content.startswith('//', i):
            i = content.find('\n', i)
            if i == -1: break
            continue
        
        # Check for multi-line comment
        if content.startswith('/*', i):
            i = content.find('*/', i)
            if i == -1: break
            i += 2
            continue
            
        # Check for strings
        if content[i] == '"' or content[i] == "'":
            quote = content[i]
            i += 1
            while i < len(content) and content[i] != quote:
                if content[i] == '\\':
                    i += 2
                else:
                    i += 1
            i += 1
            continue

        if content[i] == '{':
            stack.append((i, '{{'))
        elif content[i] == '}':
            if stack:
                stack.pop()
            else:
                print(f"Extra }} at index {i}")
        i += 1
        
    if stack:
        print(f"{len(stack)} unclosed {{ found.")
        for pos, char in stack:
            line_num = content.count('\n', 0, pos) + 1
            print(f"Unclosed {char} at line {line_num}")

find_unbalanced('src/parser.mjs')
