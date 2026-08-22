class BowlingGame:
    def __init__(self):
        self.rolls = []
        
    def roll(self, pins):
        if pins < 0:
            raise Exception("Rolls cannot score negative points")
            
        if pins > 10:
            raise Exception("A roll cannot score more than 10 points")
            
        self.rolls.append(pins)
        
        # Validate game state
        if len(self.rolls) > 21:
            raise Exception("Cannot roll after game is over")
            
    def score(self):
        if len(self.rolls) < 10:
            raise Exception("Cannot score an incomplete game")
            
        total_score = 0
        roll_index = 0
        frame_count = 0
        
        while frame_count < 10 and roll_index < len(self.rolls):
            # Check if we have a strike
            if self.rolls[roll_index] == 10:
                # Strike - 1 roll, but count bonus from next two rolls
                total_score += 10
                if roll_index + 1 < len(self.rolls):
                    total_score += self.rolls[roll_index + 1]
                    if roll_index + 2 < len(self.rolls):
                        total_score += self.rolls[roll_index + 2]
                roll_index += 1
            else:
                # Not a strike - two rolls in frame
                frame_pins = self.rolls[roll_index] + self.rolls[roll_index + 1]
                
                # For first 9 frames, check that sum is not more than 10
                if frame_count < 9 and frame_pins > 10:
                    raise Exception("Two rolls in a frame cannot score more than 10 points")
                    
                if frame_pins == 10:
                    # Spare - count bonus from next roll
                    total_score += 10
                    if roll_index + 2 < len(self.rolls):
                        total_score += self.rolls[roll_index + 2]
                else:
                    # Open frame
                    total_score += frame_pins
                roll_index += 2
                
            frame_count += 1
            
        return total_score