class BowlingGame:
    def __init__(self):
        self.rolls = []

    def roll(self, pins):
        if pins < 0:
            raise Exception("Negative roll is invalid")
        if pins > 10:
            raise Exception("Roll cannot score more than 10 points")
        
        # Check if game is already complete
        if self._is_game_complete():
            raise Exception("Cannot roll after game is complete")
        
        # Validate roll based on game state
        self._validate_roll(pins)
        
        self.rolls.append(pins)

    def _is_game_complete(self):
        """Check if the game is complete (all 10 frames done with proper bonus rolls)."""
        if len(self.rolls) == 0:
            return False
        
        frame = 1
        roll_idx = 0
        while frame <= 10 and roll_idx < len(self.rolls):
            if frame < 10:
                # For frames 1-9
                if self.rolls[roll_idx] == 10:  # Strike
                    roll_idx += 1
                else:
                    # Need second roll
                    if roll_idx + 1 < len(self.rolls):
                        roll_idx += 2
                    else:
                        return False
            else:
                # Frame 10 - special case
                # If first roll is strike, need 2 more rolls
                # If first two rolls are spare (sum to 10), need 1 more roll
                # Otherwise, game is complete after 2 rolls
                if roll_idx < len(self.rolls):
                    if self.rolls[roll_idx] == 10:  # Strike in frame 10
                        # Need 2 more rolls
                        return roll_idx + 3 <= len(self.rolls)
                    else:
                        # Need second roll
                        if roll_idx + 1 < len(self.rolls):
                            if self.rolls[roll_idx] + self.rolls[roll_idx + 1] == 10:  # Spare
                                # Need 1 more roll
                                return roll_idx + 3 <= len(self.rolls)
                            else:
                                # Open frame
                                return roll_idx + 2 <= len(self.rolls)
                        else:
                            return False
            frame += 1
        return frame > 10 and roll_idx >= len(self.rolls)

    def _validate_roll(self, pins):
        """Validate that a roll is legal given the current game state."""
        if len(self.rolls) == 0:
            return
        
        frame = 1
        roll_idx = 0
        while frame <= 10 and roll_idx < len(self.rolls):
            if frame < 10:
                # For frames 1-9
                if self.rolls[roll_idx] == 10:  # Strike
                    roll_idx += 1
                else:
                    # Need second roll
                    if roll_idx + 1 < len(self.rolls):
                        # Frame is complete
                        roll_idx += 2
                    else:
                        # This is the first roll of the current frame
                        # Check if it would exceed 10 pins total
                        if self.rolls[roll_idx] + pins > 10:
                            raise Exception("Pin count exceeds pins on the lane")
                        return
            else:
                # Frame 10 - special case
                # If first roll is strike, need 2 more rolls
                # If first two rolls are spare (sum to 10), need 1 more roll
                # Otherwise, game is complete after 2 rolls
                if roll_idx < len(self.rolls):
                    if self.rolls[roll_idx] == 10:  # Strike in frame 10
                        # Need 2 more rolls
                        if roll_idx + 1 < len(self.rolls):
                            if self.rolls[roll_idx + 1] == 10:  # Second roll is also strike
                                # Need 1 more roll (third)
                                if roll_idx + 2 < len(self.rolls):
                                    # Game is complete, shouldn't be here
                                    return
                                else:
                                    # This is the third roll of frame 10
                                    return
                            else:
                                # Second roll is not strike, need second bonus roll
                                if roll_idx + 2 < len(self.rolls):
                                    # Game is complete, shouldn't be here
                                    return
                                else:
                                    # This is the second roll of frame 10
                                    if self.rolls[roll_idx + 1] + pins > 10:
                                        raise Exception("Pin count exceeds pins on the lane")
                                    return
                        else:
                            # This is the first bonus roll after strike in frame 10
                            return
                    else:
                        # First roll is not strike
                        if roll_idx + 1 < len(self.rolls):
                            if self.rolls[roll_idx] + self.rolls[roll_idx + 1] == 10:  # Spare
                                # Need 1 more roll
                                if roll_idx + 2 < len(self.rolls):
                                    # Game is complete, shouldn't be here
                                    return
                                else:
                                    # This is the third roll of frame 10
                                    return
                            else:
                                # Open frame, shouldn't be here
                                return
                        else:
                            # This is the second roll of frame 10
                            if self.rolls[roll_idx] + pins > 10:
                                raise Exception("Pin count exceeds pins on the lane")
                            return
            frame += 1

    def score(self):
        if not self._is_game_complete():
            raise Exception("Score cannot be taken until the end of the game")
        
        total = 0
        roll_idx = 0
        frame = 1
        
        while frame <= 10:
            if roll_idx >= len(self.rolls):
                break
            
            if self.rolls[roll_idx] == 10:  # Strike
                total += 10
                total += self.rolls[roll_idx + 1]
                total += self.rolls[roll_idx + 2]
                roll_idx += 1
            elif roll_idx + 1 < len(self.rolls) and self.rolls[roll_idx] + self.rolls[roll_idx + 1] == 10:  # Spare
                total += 10
                total += self.rolls[roll_idx + 2]
                roll_idx += 2
            else:  # Open frame
                total += self.rolls[roll_idx] + self.rolls[roll_idx + 1]
                roll_idx += 2
            
            frame += 1
        
        return total
