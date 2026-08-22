class BowlingGame:
    def __init__(self):
        self.rolls = []
        self.frame = 1
        self.roll_in_frame = 1
        self.tenth_frame_rolls = []
        self.game_over = False

    def roll(self, pins):
        if self.game_over:
            raise Exception("Game is over")
        if pins < 0 or pins > 10:
            raise Exception("Invalid pins")

        if self.frame < 10:
            if self.roll_in_frame == 1:
                self.rolls.append(pins)
                if pins == 10:
                    self.frame += 1
                    self.roll_in_frame = 1
                else:
                    self.roll_in_frame = 2
            else:  # roll_in_frame == 2
                if self.rolls[-1] + pins > 10:
                    raise Exception("Too many pins in frame")
                self.rolls.append(pins)
                self.frame += 1
                self.roll_in_frame = 1
        else:
            # 10th frame
            if len(self.tenth_frame_rolls) == 0:
                self.tenth_frame_rolls.append(pins)
                self.rolls.append(pins)
            elif len(self.tenth_frame_rolls) == 1:
                if self.tenth_frame_rolls[0] == 10:
                    # Strike in 10th frame, first fill ball
                    self.tenth_frame_rolls.append(pins)
                    self.rolls.append(pins)
                else:
                    # Not a strike in 10th frame
                    if self.tenth_frame_rolls[0] + pins < 10:
                        # Open frame in 10th frame
                        self.tenth_frame_rolls.append(pins)
                        self.rolls.append(pins)
                        self.game_over = True
                    elif self.tenth_frame_rolls[0] + pins == 10:
                        # Spare in 10th frame
                        self.tenth_frame_rolls.append(pins)
                        self.rolls.append(pins)
                    else:
                        raise Exception("Too many pins in frame")
            elif len(self.tenth_frame_rolls) == 2:
                # Third roll in 10th frame
                if self.tenth_frame_rolls[0] == 10 and self.tenth_frame_rolls[1] < 10:
                    # Strike then non-strike. Sum of bonus rolls cannot exceed 10.
                    if self.tenth_frame_rolls[1] + pins > 10:
                        raise Exception("Too many pins in bonus rolls")
                    self.tenth_frame_rolls.append(pins)
                    self.rolls.append(pins)
                    self.game_over = True
                elif self.tenth_frame_rolls[0] == 10 and self.tenth_frame_rolls[1] == 10:
                    # Strike then strike. Third roll can be anything (0-10).
                    self.tenth_frame_rolls.append(pins)
                    self.rolls.append(pins)
                    self.game_over = True
                else:
                    # Was a spare in 10th frame (tenth_frame_rolls[0] + tenth_frame_rolls[1] == 10)
                    # Third roll is always allowed (0-10).
                    self.tenth_frame_rolls.append(pins)
                    self.rolls.append(pins)
                    self.game_over = True
            else:
                raise Exception("Game is over")

    def score(self):
        if self.frame < 10 or not self.game_over:
            raise Exception("Game is not complete")

        total_score = 0
        roll_idx = 0
        for _ in range(10):
            if self.rolls[roll_idx] == 10:  # Strike
                total_score += 10 + self.rolls[roll_idx + 1] + self.rolls[roll_idx + 2]
                roll_idx += 1
            elif roll_idx + 1 < len(self.rolls) and self.rolls[roll_idx] + self.rolls[roll_idx + 1] == 10:  # Spare
                total_score += 10 + self.rolls[roll_idx + 2]
                roll_idx += 2
            else:  # Open frame
                total_score += self.rolls[roll_idx] + self.rolls[roll_idx + 1]
                roll_idx += 2
        return total_score
