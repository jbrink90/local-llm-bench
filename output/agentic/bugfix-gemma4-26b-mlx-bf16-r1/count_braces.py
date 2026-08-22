import re

with open('src/parser.mjs', 'r') as f:
    content = f.read()

# Remove comments
content = re.sub(r'//.*', '', content)
content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

# Remove strings
# This is a simplified version, but should be enough for this task
content = re.sub(r"'(?:\\.|[^'\\])*'", "''", content)
content = re.sub(r'"(?:\\.|[^"\\])*"', '""', content)
content = re.sub(r'`(?:\\.|[^`\\])*`', '""', content)

stack = []
for i, char in enumerate(content):
    if char == '{':
        stack.append(i)
    elif char == '}':
        if stack:
            stack.pop()
        else:
            print(f"Extra }} at position {i}")

if stack:
    for i in stack:
        print(f"Unclosed {{ at position {i}")
else:
    print("All braces matched")
