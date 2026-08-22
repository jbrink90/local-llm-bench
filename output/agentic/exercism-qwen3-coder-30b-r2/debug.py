class BowlingGame:
    def __init__(self):
        self.rolls = []
        
    def roll(self, pins):
        print(f"Rolling {pins}, current rolls: {self.rolls}")
        if pins < 0:
            raise Exception("Negative roll is invalid")
            
        # Game is over if we have 21 rolls (max possible for 10 frames)
        if len(self.rolls) >= 21:
            raise Exception("Cannot roll after game is over")
            
        # Handle the 10th frame specially
        if len(self.rolls) >= 18:  # We're in the 10th frame (rolls 18, 19, 20)
            if len(self.rolls) == 18:  # First roll of 10th frame
                self.rolls.append(pins)
            elif len(self.rolls) == 19:  # Second roll of 10th frame
                # If first roll was less than 10, second can't exceed 10 total
                if self.rolls[18] < 10 and self.rolls[18] + pins > 10:
                    raise Exception("Pin count exceeds pins on the lane")
                self.rolls.append(pins)
            else:  # Third roll of 10th frame (index = 20)
                # If we already have two rolls in 10th frame, third must be valid
                if self.rolls[19] < 10 and pins > 10:
                    raise Exception("Pin count exceeds pins on the lane")
                self.rolls.append(pins)
        else:  # First 9 frames (rolls 0-17)
            # If even index = first roll of a frame, odd index = second roll of a frame
            if len(self.rolls) % 2 == 0:  # First roll of a frame
                if pins > 10:
                    raise Exception("Pin count exceeds pins on the lane")
                self.rolls.append(pins)
                print(f"First roll of frame, added {pins}")
            else:  # Second roll of a frame
                # Check that first roll + current roll <= 10
                if self.rolls[-1] + pins > 10:
                    raise Exception("Pin count exceeds pins on the lane")
                self.rolls.append(pins)
                print(f"Second roll of frame, added {pins}")
                
    def score(self):
        total = 0
        roll_index = 0
        
        for frame in range(10):
            if roll_index >= len(self.rolls):
                break
                
            # Check if it's a strike (10 pins in first roll)
            if self.rolls[roll_index] == 10:
                total += 10
                # Add next two rolls (if available) 
                if roll_index + 1 < len(self.rolls):
                    total += self.rolls[roll_index + 1]
                    if roll_index + 2 < len(self.rolls):
                        total += self.rolls[roll_index + 2]
                roll_index += 1
            else:
                # It's either an open frame or spare
                frame_total = self.rolls[roll_index] + self.rolls[roll_index + 1]
                total += frame_total
                
                # If it's a spare, add the next roll (bonus)
                if frame_total == 10:
                    if roll_index + 2 < len(self.rolls):
                        total += self.rolls[roll_index + 2]
                        
                roll_index += 2
                
        return total

# Test with [10, 10] - this should work
game = BowlingGame()
try:
    game.roll(10)
    game.roll(10)
    print("Success!")
except Exception as e:
    print(f"Exception: {e}")