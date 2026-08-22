
import sys

def fix_file(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    target_index = -1
    for i, line in enumerate(lines):
        if 'return function () {' in line:
            for j in range(i + 1, len(lines)):
                if '};' in lines[j]:
                    target_index = j
                    break
            break
    
    if target_index != -1:
        print("Found target_index " + str(target_index) + " for '};'")
        lines.insert(target_index + 1, '};' + '\n')
    else:
        print("Could not find target line")

    with open(filename, 'w') as f:
        f.writelines(lines)

fix_file('src/parser.mjs')
