class BowlingGame:
    def __init__(self):
        self.rolls = []

    def roll(self, pins):
        if pins < 0:
            raise Exception("Cannot score negative points")
        if pins > 10:
            raise Exception("Cannot score more than 10 points")
        
        # Check if game is complete
        if len(self.rolls) >= 21:
            raise Exception("Cannot roll after game is complete")
        
        # Check if we're trying to roll after the 10th frame is complete
        if len(self.rolls) > 0:
            # Count how many complete frames we have
            frame = 0
            roll_index = 0
            while roll_index < len(self.rolls):
                frame += 1
                if frame == 10:
                    break
                if self.rolls[roll_index] == 10:
                    # Strike
                    roll_index += 1
                else:
                    roll_index += 2
            
            # Now roll_index points to the first roll of the 10th frame
            # or past the end if we're done
            
            if frame < 10:
                # We haven't reached the 10th frame yet, so we're not done
                pass
            else:
                # We're in the 10th frame
                rolls_in_10th = len(self.rolls) - roll_index
                
                # Check if game is complete (3 rolls in 10th frame)
                if rolls_in_10th == 3:
                    raise Exception("Cannot roll after game is complete")
                elif rolls_in_10th == 2:
                    first_of_10th = self.rolls[roll_index]
                    second_of_10th = self.rolls[roll_index + 1]
                    if first_of_10th == 10:
                        # Strike, need a third roll
                        pass
                    elif first_of_10th + second_of_10th == 10:
                        # Spare, need a third roll
                        pass
                    else:
                        # Open frame, game is complete
                        raise Exception("Cannot roll after game is complete")
                
                # Validate the roll
                # Check if two rolls in a frame cannot score more than 10
                # This applies when we have one roll in the 10th frame
                # and the first roll is not a strike
                if rolls_in_10th == 1:
                    first_of_10th = self.rolls[roll_index]
                    if first_of_10th != 10 and pins > 10 - first_of_10th:
                        raise Exception("Cannot score more than 10 points")
                
                # Check if second bonus roll after strike cannot be strike if first is not
                # This applies when we have two rolls in the 10th frame
                # and the first roll is not a strike
                if rolls_in_10th == 2:
                    first_of_10th = self.rolls[roll_index]
                    second_of_10th = self.rolls[roll_index + 1]
                    # If the first was a strike, the second bonus roll can be anything
                    # If the first was not a strike, the second bonus roll cannot be a strike
                    if first_of_10th == 10:
                        # First was a strike, second bonus roll can be anything
                        pass
                    elif first_of_10th + second_of_10th < 10:
                        # First two rolls sum to less than 10, third roll cannot be a strike
                        if pins == 10:
                            raise Exception("Cannot score more than 10 points")
                    else:
                        # First two rolls sum to 10 (spare), third roll can be anything
                        pass
        
        self.rolls.append(pins)

    def score(self):
        if len(self.rolls) == 0:
            raise Exception("Cannot score unstarted game")
        
        # Check if game is complete
        frame = 1
        roll_index = 0
        while roll_index < len(self.rolls) and frame < 10:
            if roll_index >= len(self.rolls):
                raise Exception("Cannot score incomplete game")
            if self.rolls[roll_index] == 10:
                # Strike
                roll_index += 1
            else:
                if roll_index + 1 >= len(self.rolls):
                    raise Exception("Cannot score incomplete game")
                roll_index += 2
            frame += 1
        
        # Now we're at frame 10
        if roll_index >= len(self.rolls):
            raise Exception("Cannot score incomplete game")
        
        # Check if 10th frame is complete
        if self.rolls[roll_index] == 10:
            # Strike, need at least 2 more rolls
            if roll_index + 2 >= len(self.rolls):
                raise Exception("Cannot score incomplete game")
        else:
            if roll_index + 1 >= len(self.rolls):
                raise Exception("Cannot score incomplete game")
            if self.rolls[roll_index] + self.rolls[roll_index + 1] == 10:
                # Spare, need 1 more roll
                if roll_index + 2 >= len(self.rolls):
                    raise Exception("Cannot score incomplete game")
        
        total = 0
        roll_index = 0
        
        for frame in range(10):
            if frame < 9:
                # Frames 1-9
                if self.rolls[roll_index] == 10:
                    # Strike
                    total += 10 + self.rolls[roll_index + 1] + self.rolls[roll_index + 2]
                    roll_index += 1
                elif self.rolls[roll_index] + self.rolls[roll_index + 1] == 10:
                    # Spare
                    total += 10 + self.rolls[roll_index + 2]
                    roll_index += 2
                else:
                    # Open frame
                    total += self.rolls[roll_index] + self.rolls[roll_index + 1]
                    roll_index += 2
            else:
                # Frame 10 - just sum all remaining rolls
                while roll_index < len(self.rolls):
                    total += self.rolls[roll_index]
                    roll_index += 1
        
        return total