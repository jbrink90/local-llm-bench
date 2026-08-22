# Simple test to understand the basic logic

def test_logic():
    # Frame 1: [0, 0] = 0 points
    # Frame 2: [0, 0] = 0 points  
    # etc.
    
    # But what about [10]?
    # Frame 1: [10] = 10 points (strike) - frame ends immediately
    
    # What about [10, 10]?
    # Frame 1: [10] = 10 points (strike) - frame ends
    # Frame 2: [10] = 10 points (strike) - frame ends
    
    # So we should be able to do this!
    
    print("This should work")

if __name__ == "__main__":
    test_logic()