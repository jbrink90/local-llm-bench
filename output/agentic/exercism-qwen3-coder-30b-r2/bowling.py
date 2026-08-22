class BowlingGame:
    def __init__(self):
        self.rolls = []
        
    def roll(self, pins):
        if pins < 0:
            raise Exception("Negative roll is invalid")
            
        # Game is over if we have 21 rolls (max possible for 10 frames)
        if len(self.rolls) >= 21:
            raise Exception("Cannot roll after game is over")
            
        # Special handling for last frame (frames 10)
        if len(self.rolls) >= 18:  # We're in the last frame or beyond
            # Check if we're trying to add a 21st roll (game over)
            if len(self.rolls) == 20:  # Already have 20 rolls, this would be 21st
                raise Exception("Cannot roll after game is over")
                
            # If it's the first roll of the 10th frame (index 18)
            if len(self.rolls) == 18:
                self.rolls.append(pins)
                return
                
            # If it's the second roll of the 10th frame (index 19)
            elif len(self.rolls) == 19:
                first_roll = self.rolls[18]
                # If first roll was 10 (strike), second can be anything up to 10
                if first_roll == 10:
                    if pins > 10:
                        raise Exception("Pin count exceeds pins on the lane")
                else:
                    # First roll wasn't a strike, so check total
                    if first_roll + pins > 10:
                        raise Exception("Pin count exceeds pins on the lane")
                self.rolls.append(pins)
                return
                
            # If it's the third roll of the 10th frame (index 20) - bonus roll
            else:  # len(self.rolls) == 20
                # This is a valid 3rd roll in last frame, but only if we're allowed to have one
                # The third roll can be up to 10 pins
                if pins > 10:
                    raise Exception("Pin count exceeds pins on the lane")
                self.rolls.append(pins)
                return
                
        # For frames 1-9
        else:  # len(self.rolls) < 18
            if len(self.rolls) % 2 == 0:  # First roll of a frame
                if pins > 10:
                    raise Exception("Pin count exceeds pins on the lane")
                self.rolls.append(pins)
                return
                
            else:  # Second roll of a frame  
                # Check if previous was a strike (first roll = 10) - in that case this is first roll of next frame
                if self.rolls[-1] == 10:
                    # Previous was a strike, so this is the first roll of the next frame
                    self.rolls.append(pins)
                    return
                else:
                    # Previous wasn't a strike, so check the sum
                    if self.rolls[-1] + pins > 10:
                        raise Exception("Pin count exceeds pins on the lane")
                    self.rolls.append(pins)
                    return
                
    def score(self):
        if len(self.rolls) == 0:
            raise Exception("Cannot score an incomplete game")
            
        total = 0
        roll_index = 0
        
        for frame in range(10):
            if roll_index >= len(self.rolls):
                raise Exception("Cannot score an incomplete game")
                
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