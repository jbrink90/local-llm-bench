class BowlingGame:
    def __init__(self):
        # List of all rolls
        self.rolls = []
        # Current frame number (1-10)
        self.current_frame = 1
        # Roll index within current frame: 0 for first roll, 1 for second, 2 for third (only in 10th frame)
        self.roll_in_frame = 0
        # Variables for 10th frame rolls to enforce bonus rules
        self.tenth_first = None
        self.tenth_second = None
        self.tenth_third = None
        # Flag if game finished
        self.finished = False

    def _validate_pins(self, pins):
        if pins < 0 or pins > 10:
            raise Exception("Invalid number of pins")

    def roll(self, pins):
        if self.finished:
            raise Exception("Game already finished")
        self._validate_pins(pins)

        if self.current_frame <= 9:
            if self.roll_in_frame == 0:
                # First roll of frame
                if pins == 10:
                    # strike
                    self.rolls.append(pins)
                    self.current_frame += 1
                    self.roll_in_frame = 0
                else:
                    self.rolls.append(pins)
                    self.roll_in_frame = 1
            else:
                # Second roll of frame
                # Ensure sum <= 10
                if self.rolls[-1] + pins > 10:
                    raise Exception("Frame total cannot exceed 10")
                self.rolls.append(pins)
                self.current_frame += 1
                self.roll_in_frame = 0
        else:  # 10th frame
            if self.roll_in_frame == 0:
                # First roll of 10th frame
                self.rolls.append(pins)
                self.tenth_first = pins
                self.roll_in_frame = 1
            elif self.roll_in_frame == 1:
                # Second roll of 10th frame
                if self.tenth_first == 10:
                    # First was strike
                    # pins can be 0-10
                    self.rolls.append(pins)
                    self.tenth_second = pins
                    self.roll_in_frame = 2
                else:
                    # First not strike
                    if self.tenth_first + pins > 10:
                        raise Exception("Frame total cannot exceed 10")
                    self.rolls.append(pins)
                    self.tenth_second = pins
                    if self.tenth_first + pins == 10:
                        # Spare: one bonus roll allowed
                        self.roll_in_frame = 2
                    else:
                        # Open frame, game finished
                        self.current_frame += 1
                        self.roll_in_frame = 0
                        self.finished = True
            elif self.roll_in_frame == 2:
                # Third roll (bonus) in 10th frame
                if self.tenth_first == 10:
                    # First was strike
                    # pins <=10
                    if pins > 10:
                        raise Exception("Bonus roll cannot exceed 10")
                    # If second roll was not a strike, limit remaining pins
                    if self.tenth_second != 10 and pins > (10 - self.tenth_second):
                        raise Exception("Bonus roll exceeds remaining pins")
                    self.rolls.append(pins)
                    self.tenth_third = pins
                else:
                    # This case occurs only if first was not strike and we had a spare
                    if pins > 10:
                        raise Exception("Bonus roll cannot exceed 10")
                    self.rolls.append(pins)
                    self.tenth_third = pins
                self.current_frame += 1
                self.roll_in_frame = 0
                self.finished = True
            else:
                raise Exception("Invalid state in 10th frame")

    def score(self):
        total = 0
        roll_index = 0
        for frame in range(10):
            if roll_index >= len(self.rolls):
                break
            if self.rolls[roll_index] == 10:
                # strike
                total += 10
                if roll_index + 1 < len(self.rolls):
                    total += self.rolls[roll_index + 1]
                if roll_index + 2 < len(self.rolls):
                    total += self.rolls[roll_index + 2]
                roll_index += 1
            else:
                frame_sum = self.rolls[roll_index] + (self.rolls[roll_index + 1] if roll_index + 1 < len(self.rolls) else 0)
                if frame_sum == 10:
                    total += 10
                    if roll_index + 2 < len(self.rolls):
                        total += self.rolls[roll_index + 2]
                else:
                    total += frame_sum
                roll_index += 2
        return total
