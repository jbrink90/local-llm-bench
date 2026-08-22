class BowlingGame:
    def __init__(self):
        self.rolls = []
        self.frame = 0  # completed frames before 10th
        self.current_frame_rolls = []
        self.tenth_rolls = []
        self.in_tenth = False
        self.game_over = False

    def roll(self, pins):
        if self.game_over:
            raise Exception("Game is over")
        if not isinstance(pins, int):
            raise Exception("Invalid pins")
        if pins < 0 or pins > 10:
            raise Exception("Pins out of range")
        
        if not self.in_tenth:
            # frames 1-9
            if not self.current_frame_rolls:
                # first ball of frame
                self.current_frame_rolls.append(pins)
                self.rolls.append(pins)
                if pins == 10:
                    # strike
                    self.frame += 1
                    self.current_frame_rolls = []
                    if self.frame == 9:
                        self.in_tenth = True
                # else wait for second ball
            else:
                # second ball
                first = self.current_frame_rolls[0]
                if first + pins > 10:
                    raise Exception("Pin sum exceeds 10")
                self.current_frame_rolls.append(pins)
                self.rolls.append(pins)
                self.frame += 1
                self.current_frame_rolls = []
                if self.frame == 9:
                    self.in_tenth = True
        else:
            # 10th frame
            if len(self.tenth_rolls) == 0:
                self.tenth_rolls.append(pins)
                self.rolls.append(pins)
            elif len(self.tenth_rolls) == 1:
                first = self.tenth_rolls[0]
                if first == 10:
                    # second roll after strike
                    self.tenth_rolls.append(pins)
                    self.rolls.append(pins)
                else:
                    if first + pins > 10:
                        raise Exception("Pin sum exceeds 10")
                    self.tenth_rolls.append(pins)
                    self.rolls.append(pins)
                    if first + pins < 10:
                        self.game_over = True
                    # else spare, continue for bonus
            elif len(self.tenth_rolls) == 2:
                first = self.tenth_rolls[0]
                second = self.tenth_rolls[1]
                if first == 10:
                    # strike in 10th
                    if second == 10:
                        # third roll free
                        self.tenth_rolls.append(pins)
                        self.rolls.append(pins)
                        self.game_over = True
                    else:
                        if second + pins > 10:
                            raise Exception("Pin sum exceeds 10")
                        self.tenth_rolls.append(pins)
                        self.rolls.append(pins)
                        self.game_over = True
                else:
                    # bonus roll after spare
                    self.tenth_rolls.append(pins)
                    self.rolls.append(pins)
                    self.game_over = True
            else:
                raise Exception("Too many rolls in 10th frame")

    def score(self):
        if not self.game_over:
            raise Exception("Game not complete")
        rolls = self.rolls
        total = 0
        i = 0
        for frame in range(10):
            if frame == 9:
                total += sum(rolls[i:])
                break
            if rolls[i] == 10:
                total += 10 + rolls[i+1] + rolls[i+2]
                i += 1
            else:
                frame_sum = rolls[i] + rolls[i+1]
                total += frame_sum
                if frame_sum == 10:
                    total += rolls[i+2]
                i += 2
        return total
