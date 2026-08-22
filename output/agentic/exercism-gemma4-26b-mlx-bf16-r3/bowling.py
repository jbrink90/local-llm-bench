class BowlingGame:
    def __init__(self):
        self.rolls = []

    def _get_frame_info(self):
        """Returns (frame_idx, roll_idx, is_game_over, is_game_complete)"""
        frame_idx = 0
        roll_idx = 0
        while frame_idx < 10:
            if roll_idx >= len(self.rolls):
                return frame_idx, roll_idx, False, False
            
            if frame_idx < 9:
                if self.rolls[roll_idx] == 10:
                    # Strike
                    roll_idx += 1
                    frame_idx += 1
                else:
                    if roll_idx + 1 < len(self.rolls):
                        roll_idx += 2
                        frame_idx += 1
                    else:
                        # Only one roll in this frame
                        return frame_idx, roll_idx, False, False
            else:
                # 10th frame
                n_10th = len(self.rolls) - roll_idx
                if n_10th == 1:
                    return 9, roll_idx, False, False
                elif n_10th == 2:
                    if self.rolls[roll_idx] == 10:
                        return 9, roll_idx, False, False
                    elif self.rolls[roll_idx] + self.rolls[roll_idx+1] == 10:
                        return 9, roll_idx, False, False
                    else:
                        return 9, roll_idx, True, True
                elif n_10th == 3:
                    return 9, roll_idx, True, True
                else:
                    # This should not be reachable if roll() is correct
                    return 9, roll_idx, True, True
        return 10, roll_idx, True, True

    def roll(self, pins):
        if pins < 0 or pins > 10:
            raise Exception("Pins must be between 0 and 10")
        
        frame_idx, roll_idx, is_game_over, is_game_complete = self._get_frame_info()
        if is_game_over:
            raise Exception("Game is over")
        
        # Validate the roll
        if frame_idx < 9:
            if len(self.rolls) == roll_idx + 1:
                if self.rolls[roll_idx] + pins > 10:
                    raise Exception("Too many pins in a frame")
        else:
            # 10th frame
            n_10th = len(self.rolls) - roll_idx
            if n_10th == 1:
                if self.rolls[roll_idx] != 10 and self.rolls[roll_idx] + pins > 10:
                    raise Exception("Too many pins in a frame")
            elif n_10th == 2:
                if self.rolls[roll_idx] == 10:
                    if self.rolls[roll_idx+1] != 10 and self.rolls[roll_idx+1] + pins > 10:
                        raise Exception("Too many pins in a frame")
                else:
                    # It must be a spare for us to be here with n_10th == 2 and 1st roll not 10
                    if self.rolls[roll_idx] + self.rolls[roll_idx+1] < 10:
                        # This should have been an open frame and game finished
                        raise Exception("Invalid roll")
        
        self.rolls.append(pins)

    def score(self):
        frame_idx, roll_idx, is_game_over, is_game_complete = self._get_frame_info()
        if not is_game_complete:
            raise Exception("Game is not complete")
        
        total_score = 0
        i = 0
        for f in range(10):
            if self.rolls[i] == 10:
                # Strike
                total_score += 10 + self.rolls[i+1] + self.rolls[i+2]
                i += 1
            elif self.rolls[i] + self.rolls[i+1] == 10:
                # Spare
                total_score += 10 + self.rolls[i+2]
                i += 2
            else:
                # Open
                total_score += self.rolls[i] + self.rolls[i+1]
                i += 2
        return total_score
