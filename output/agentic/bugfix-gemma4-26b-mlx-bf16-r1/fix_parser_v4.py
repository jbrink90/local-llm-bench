
import re

def fix():
    with open('src/parser.mjs', 'r') as f:
        content = f.read()

    # Pattern 1: The one that's broken
    # We are looking for:
    # return function () {
    #   return f.apply(expr, arguments);
    # };
    # };
    # };
    
    # Let's be more general: 
    # find the block and replace the trailing '};'s
    
    pattern1 = r'(Expression\.prototype\.toJSFunction = function \(param, variables\) \{.*?return function \(\) \{\s+return f\.apply\(expr, arguments\);\s+  \}; \s+ }; \s+ };)'
    # This is too specific and might not match because of whitespace.
    
    # Let's use a simpler approach.
    # Find the line 'var TEOF = \'TEOF\';'
    # And look at the lines before it.
    
    lines = content.split('\n')
    new_lines = []
    
    i = 0
    while i < len(lines):
        new_lines.append(lines[i])
        if 'Expression.prototype.toJSFunction' in lines[i]:
            # We are inside the function. Find its closing braces.
            # We want to find the '  };' that closes the 'return function () {'
            # and the '};' that closes the 'toJSFunction'
            # and ensure there isn't an extra '};'
            
            # Let's just find the indices.
            idx_start = i
            idx_return_func = -1
            idx_return_func_end = -1
            idx_tojs_func_end = -1
            
            for j in range(i + 1, len(lines)):
                if 'return function () {' in lines[j]:
                    idx_return_func = j
                if idx_return_func != -1 and '  };' in lines[j]:
                    idx_return_func_end = j
                    break
            
            if idx_return_func != -1 and idx_return_func_end != -1:
                for j in range(idx_return_func_end + 1, len(lines)):
                    if '};' in lines[j]:
                        idx_tojs_func_end = j
                        break
            
            if idx_tojs_func_end != -1:
                # We found the end of the function.
                # Now let's check if there's an extra '};' after it.
                if idx_tojs_func_end + 1 < len(lines) and '};' in lines[idx_tojs_func_end + 1]:
                    # There is an extra '};'. Let's remove it.
                    # We can do this by skipping the next line if it's '};'
                    # But we must be careful not to skip too much.
                    
                    # Let's just mark the extra line to be deleted.
                    # We'll use a set of indices to delete.
                    pass

        i += 1

# Actually, I'll just do this:
# Find all '};' that are preceded by '};' and where the first '};' is preceded by '  };'
# and both are part of the same function.

def final_final_fix():
    with open('src/parser.mjs', 'r') as f:
        lines = f.readlines()
    
    to_delete = set()
    
    for i in range(len(lines) - 2):
        # Check for the pattern:
        # i:   '  };'
        # i+1: '};'
        # i+2: '};'
        if '  };' in lines[i] and '};' in lines[i+1] and '};' in lines[i+2]:
            # This is the pattern we found in the broken file
            # But we only want to delete it if it's the one we added.
            # The one we added is after the 'return function () {'
            # Let's check if there's a 'return function () {' nearby.
            
            found_return = False
            for j in range(i - 1, i - 10, -1):
                if j >= 0 and 'return function () {' in lines[j]:
                    found_return = True
                    break
            
            if found_return:
                to_delete.add(i + 2)
                
    # Also check for the other one if it exists (though it seemed correct)
    # The other one:
    # i:   '  };'
    # i+1: '};'
    # i+2: (something else)
    # This is fine.
    
    # Let's also check for:
    # i:   'return function () {'
    # ...
    # i+k: '  };'
    # i+k+1: '};'
    # i+k+2: '};'
    # We already did that.
    
    new_lines = [lines[i] for i in range(len(lines)) if i not in to_delete]
    with open('src/parser.mjs', 'w') as f:
        f.writelines(new_lines)

final_final_fix()
