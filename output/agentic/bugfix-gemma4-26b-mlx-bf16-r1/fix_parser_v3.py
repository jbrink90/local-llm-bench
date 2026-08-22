
import sys
import re

def fix_file(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()

    # 1. Find the 'return function () {' and its closing '  };'
    # We want to insert '};' after that '  };'
    idx1 = -1
    for i in range(len(lines)):
        if 'return function () {' in lines[i]:
            for j in range(i + 1, len(lines)):
                if lines[j].strip() == '};' or lines[j].strip() == '};': # looking for '  };'
                    if '  };' in lines[j]:
                        idx1 = j
                        break
            if idx1 != -1:
                break
    
    # 2. Find the 'TokenStream.prototype.getCoordinates = function () {' 
    # and its closing '  };' (which closes the return object)
    # then we add another '};'
    idx2 = -1
    for i in range(len(lines)):
        if 'TokenStream.prototype.getCoordinates = function () {' in lines[i]:
            for j in range(i + 1, len(lines)):
                if '  };' in lines[j]:
                    idx2 = j
                    break
            if idx2 != -1:
                break

    # Before inserting, let's see if they are already there to avoid duplicates
    # (This is a bit hacky but should work for this task)
    
    # Let's just clean up the file first by removing any extra '};' at those positions.
    # This is hard. Let's instead just build a new list of lines.
    
    new_lines = []
    i = 0
    while i < len(lines):
        new_lines.append(lines[i])
        # If this is the '  };' for the first one, and we haven't added '};' yet
        if idx1 != -1 and i == idx1:
            # But wait, we might have already added it if we ran previous scripts.
            # Let's check the next line.
            if i + 1 < len(lines) and '};' in lines[i+1] and '};' in lines[i+2]:
                # Already added two? Let's just leave it.
                pass
            else:
                new_lines.append('};' + '\n')
        
        # If this is the '  };' for the second one
        if idx2 != -1 and i == idx2:
             if i + 1 < len(lines) and '};' in lines[i+1] and '};' in lines[i+2]:
                pass
             else:
                new_lines.append('};' + '\n')
        i += 1

    with open(filename, 'w') as f:
        f.writelines(new_lines)

# Instead of the complex logic above, let's just do something simpler.
# Let's just find the pattern and replace it.

def simple_fix(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    # Fix 1: return function () { ... }; -> return function () { ... }; };
    # We'll look for the specific block.
    # This is risky if there are multiple similar blocks.
    
    # Let's use the indices we found.
    # Actually, I'll just use a more robust approach:
    # For each unclosed brace found by find_unbalanced_v2.py, 
    # find its corresponding '{' and find the next '}' that belongs to it.
    # But that's hard.
    
    # Let's try a different approach. 
    # The error is because of unclosed braces.
    # Let's just add '};' at the very end of the file? No, that's not right.
    
    # Let's use the fact that we know the lines.
    pass

# Final attempt at a script
def final_fix(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()

    # First, let's find all '  };' that are NOT followed by a '};' or are part of a function
    # This is too hard. 
    
    # Let's just manually correct the file by looking for the patterns.
    
    new_lines = []
    for i in range(len(lines)):
        new_lines.append(lines[i])
        # Pattern 1:
        if 'return function () {' in lines[i]:
            # Find the next '  };'
            for j in range(i + 1, len(lines)):
                if '  };' in lines[j]:
                    # We found it. We need to add '};' after it.
                    # But we'll do it when we reach index j.
                    pass
        
    # Let's just use the lines we know.
    # I'll just search for the unclosed '{' and add a '}' after its matching '}'
    
    # Let's find the index of 'return function () {'
    # and the index of the next '  };'
    # and add '};' after it.
    # Then do the same for the other one.
    
    # To avoid duplicates, we'll check if the next line is already '};'
    
    # Finding idx1
    idx1 = -1
    for i in range(len(lines)):
        if 'return function () {' in lines[i]:
            for j in range(i + 1, len(lines)):
                if '  };' in lines[j]:
                    idx1 = j
                    break
            if idx1 != -1: break
            
    # Finding idx2
    idx2 = -1
    for i in range(len(lines)):
        if 'TokenStream.prototype.getCoordinates = function () {' in lines[i]:
            for j in range(i + 1, len(lines)):
                if '  };' in lines[j]:
                    idx2 = j
                    break
            if idx2 != -1: break
            
    # Now, let's build the new lines carefully.
    res = []
    added1 = False
    added2 = False
    for i in range(len(lines)):
        res.append(lines[i])
        if idx1 != -1 and i == idx1 and not added1:
            # Check if we already added it (by looking at the next line in the ORIGINAL lines)
            # Actually, if we are building a NEW list, we just check if we've already added it.
            # But we need to check if the original file ALREADY had the extra '};'.
            
            # Let's check if the next line in the ORIGINAL file is '};'
            if i + 1 < len(lines) and '};' in lines[i+1]:
                # It's already there!
                pass
            else:
                res.append('};' + '\n')
                added1 = True
        
        if idx2 != -1 and i == idx2 and not added2:
            if i + 1 < len(lines) and '};' in lines[i+1]:
                pass
            else:
                res.append('};' + '\n')
                added2 = True
                
    with open(filename, 'w') as f:
        f.writelines(res)

final_fix('src/parser.mjs')
