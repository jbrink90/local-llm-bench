
import sys
import re

def fix_file(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    # We want to find the unclosed braces.
    # Instead of a complex parser, let's just use the information from find_unbalanced_v2.py
    # which said: Unclosed { at line 971, col 51 (for the function)
    # AND I also know about the one at 511.
    
    # Let's try to find them by pattern matching for the unclosed ones.
    
    # 1. Fix the toJSFunction one.
    # It's a function that ends with a return function and is missing a };
    # The return function is:
    #   return function () {
    #     return f.apply(expr, arguments);
    #   };
    # We need to add }; after it.
    
    new_lines = []
    for line in lines:
        new_lines.append(line)
        if 'return function () {' in line:
            # Find the next };
            # This is tricky since we are iterating. 
            # Let's just look for the next line that is '  };'
            pass

    # Let's do it more simply.
    # I'll just manually insert them since I know where they are.
    
    # For the first one (around line 516):
    # After '  };' which is part of 'return function () { ... };'
    # We need to add '};'
    
    # For the second one (around line 984):
    # After '  };' which is part of 'return { ... };'
    # We need to add '};'

    # Let's find the indices of the '};' that need a follow-up '};'
    
    indices_to_add = []
    
    # Search for the first one
    for i in range(len(lines)):
        if 'return function () {' in lines[i]:
            for j in range(i + 1, len(lines)):
                if '  };' in lines[j]:
                    indices_to_add.append(j + 1)
                    break
            break
            
    # Search for the second one
    # It's in TokenStream.prototype.getCoordinates
    for i in range(len(lines)):
        if 'TokenStream.prototype.getCoordinates = function () {' in lines[i]:
            for j in range(i + 1, len(lines)):
                if '  };' in lines[j]:
                    # But we must make sure it's not the one we already added
                    if j + 1 not in indices_to_add:
                        indices_to_add.append(j + 1)
                    break
            break
            
    # Sort indices in reverse to not mess up the insertion
    indices_to_add.sort(reverse=True)
    
    for idx in indices_to_add:
        lines.insert(idx, '};' + '\n')
        
    with open(filename, 'w') as f:
        f.writelines(lines)

fix_file('src/parser.mjs')
