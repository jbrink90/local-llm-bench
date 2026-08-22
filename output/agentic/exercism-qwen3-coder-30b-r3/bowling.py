class BowlingGame:
    def __init__(self):
        self.rolls = []
        
    def roll(self, pins):
        if pins < 0:
            raise Exception("Rolls cannot score negative points")
            
        if pins > 10:
            raise Exception("A roll cannot score more than 10 points")
            
        self.rolls.append(pins)
        
    def score(self):
        if not self.rolls:
            raise Exception("Cannot score an empty game")
            
        # Validate frame structure during scoring
        roll_index = 0
        frame_count = 0
        
        # Process first 9 frames (each with 1-2 rolls)
        while frame_count < 9 and roll_index < len(self.rolls):
            if self.rolls[roll_index] == 10:  # Strike - 1 roll for this frame
                frame_count += 1
                roll_index += 1
            else:  # Not a strike - 2 rolls for this frame  
                if roll_index + 1 >= len(self.rolls):
                    raise Exception("Cannot score an incomplete game")
                    
                frame_total = self.rolls[roll_index] + self.rolls[roll_index + 1]
                if frame_total > 10:
                    raise Exception("Two rolls in a frame cannot score more than 10 points")
                    
                frame_count += 1
                roll_index += 2
                
        # Process the 10th frame
        if roll_index >= len(self.rolls):
            raise Exception("Cannot score an incomplete game")
            
        # Count how many rolls are left for the 10th frame
        remaining_rolls = len(self.rolls) - roll_index
        
        # The 10th frame must have at least 2 rolls (could be 2 or 3)
        if remaining_rolls < 2:
            raise Exception("Cannot score an incomplete game")
            
        # If first roll in 10th frame is a strike, we can have up to 2 bonus rolls
        if self.rolls[roll_index] == 10:
            # Check that we don't have more than 3 rolls for the 10th frame
            if remaining_rolls > 3:
                raise Exception("Cannot score an incomplete game")
                
            # Check if bonus rolls are valid (second and third rolls can be up to 10 each)
            if remaining_rolls >= 2:
                # We have at least 2 rolls for the 10th frame
                pass
                
        else:
            # Not a strike in 10th frame - check that it's valid
            if roll_index + 1 >= len(self.rolls):
                raise Exception("Cannot score an incomplete game")
                
            frame_total = self.rolls[roll_index] + self.rolls[roll_index + 1]
            if frame_total > 10:
                raise Exception("Two rolls in a frame cannot score more than 10 points")
                
            # If it's a spare, we can have one bonus roll
            if frame_total == 10 and remaining_rolls > 3:
                raise Exception("Cannot score an incomplete game")
                
        # Now compute the actual score
        roll_index = 0
        total_score = 0
        
        for frame in range(10):
            if self.rolls[roll_index] == 10:
                # Strike - next two rolls are bonus
                bonus = 0
                if roll_index + 1 < len(self.rolls):
                    bonus += self.rolls[roll_index + 1]
                if roll_index + 2 < len(self.rolls):
                    bonus += self.rolls[roll_index + 2]
                total_score += 10 + bonus
                roll_index += 1
            else:
                # Not a strike - check for spare or open frame
                frame_total = self.rolls[roll_index] + self.rolls[roll_index + 1]
                if frame_total == 10:
                    # Spare - next roll is bonus
                    bonus = 0
                    if roll_index + 2 < len(self.rolls):
                        bonus += self.rolls[roll_index + 2]
                    total_score += 10 + bonus
                else:
                    # Open frame - sum of the two rolls
                    total_score += frame_total
                roll_index += 2
                
        return total_score