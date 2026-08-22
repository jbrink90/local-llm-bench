class BowlingGame:
    def __init__(self):
        # store all rolls
        self.rolls = []
        # current frame (1-10)
        self.frame = 1
        # roll within current frame (1 or 2), except in 10th where can be 1-3
        self.roll_in_frame = 1
        # to indicate that we are in the 10th frame and we have 3 possible rolls
        self.is_tenth = False
        self.tenth_rolls = []
        self.tenth_bonus = 0

    def _validate_roll_value(self, pins):
        if pins < 0 or pins > 10:
            raise Exception("Pins must be between 0 and 10")

    def roll(self, pins):
        """Record a roll and validate game rules.

        Raises Exception on invalid input according to bowling rules.
        """
        self._validate_roll_value(pins)

        if self.frame < 10:
            # frames 1-9
            if self.roll_in_frame == 1:
                # first roll of frame
                if pins == 10:
                    # strike: frame ends immediately
                    self.rolls.append(pins)
                    self.frame += 1
                    self.roll_in_frame = 1
                else:
                    # record first roll and wait for second
                    self.rolls.append(pins)
                    self.roll_in_frame = 2
            else:  # second roll of frame
                first = self.rolls[-1] if len(self.rolls) > 0 else 0
                if first + pins > 10:
                    raise Exception("Second roll cannot exceed 10 in a frame")
                self.rolls.append(pins)
                self.frame += 1
                self.roll_in_frame = 1
        else:
            # 10th frame handling
            if not self.is_tenth:
                self.is_tenth = True
                self.tenth_rolls = []
            # First roll of tenth
            if len(self.tenth_rolls) == 0:
                self.tenth_rolls.append(pins)
                if pins == 10:
                    # strike, allow two more rolls
                    pass
                else:
                    # open frame first roll; second will be next
                    pass
            elif len(self.tenth_rolls) == 1:
                first = self.tenth_rolls[0]
                if first == 10:
                    # first was strike; second roll any 0-10
                    self.tenth_rolls.append(pins)
                else:
                    if first + pins > 10:
                        raise Exception("Second roll cannot exceed 10 in the tenth frame")
                    self.tenth_rolls.append(pins)
                    if first + pins == 10:
                        # spare, allow one more roll
                        pass
                    else:
                        # open frame finished
                        self.rolls.extend(self.tenth_rolls)
                        return
            elif len(self.tenth_rolls) == 2:
                first, second = self.tenth_rolls[0], self.tenth_rolls[1]
                if first == 10:
                    # first was strike
                    if second == 10:
                        # second also strike; third any 0-10
                        self.tenth_rolls.append(pins)
                    else:
                        # second not strike; third cannot exceed 10 - second
                        if pins > 10 - second:
                            raise Exception("Third roll cannot exceed 10 minus second roll when first was strike and second not strike")
                        self.tenth_rolls.append(pins)
                else:
                    # first not strike
                    if first + second == 10:
                        # spare: third any 0-10
                        self.tenth_rolls.append(pins)
                    else:
                        raise Exception("No third roll allowed when first two rolls are not a spare")
                # after third roll, finalize
                self.rolls.extend(self.tenth_rolls)
                return
            # After any roll in 10th frame, if we haven't returned, the game is not yet finished
            # but for safety, we allow more rolls? The logic should never get here
            # unless third roll is added, we handled. If still not finished, ignore
            # Actually we only return after third roll or open frame finished.

    def score(self):
        """Calculate total score after all rolls have been recorded."""
        total = 0
        idx = 0
        for frame in range(10):
            if self.rolls[idx] == 10:  # strike
                total += 10 + self.rolls[idx+1] + self.rolls[idx+2]
                idx += 1
            else:
                frame_score = self.rolls[idx] + self.rolls[idx+1]
                if frame_score == 10:  # spare
                    total += 10 + self.rolls[idx+2]
                else:
                    total += frame_score
                idx += 2
        return total
