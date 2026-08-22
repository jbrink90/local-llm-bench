with open('src/parser.mjs', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.strip() == 'function sub(a, b) {':
        new_lines.append('function add(a, b) {\n  return a + b;\n}\n\n')
    new_lines.append(line)

with open('src/parser.mjs', 'w') as f:
    f.writelines(new_lines)
