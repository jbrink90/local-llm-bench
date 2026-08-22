class BowlingGame:
    def __init__(self):
        self.rolls = []
        self.frame = 1
        self.rolls_in_current_frame = 0
        self.current_frame_pins = 0
        self.is_strike = False
        self.is_spare = False

    def roll(self, pins):
        if pins < 0:
            raise ValueError("Negative roll is invalid")
        if pins > 10:
            raise ValueError("Roll cannot score more than 10 points")

        if self.is_game_complete():
            raise Exception("Cannot roll after game is complete")

        self._validate_roll(pins)
        self.rolls.append(pins)
        self._update_frame_state(pins)

    def _validate_roll(self, pins):
        if self.rolls_in_current_frame == 0:
            return
        elif self.rolls_in_current_frame == 1:
            if self.is_strike:
                return
            else:
                if self.current_frame_pins + pins > 10:
                    raise Exception("Pin count exceeds pins on the lane")
        elif self.rolls_in_current_frame == 2:
            if self.is_strike:
                if len(self.rolls) < 3:
                    raise Exception("Cannot roll after game is complete")
                first_roll = self.rolls[-3]
                second_roll = self.rolls[-2]
                if first_roll != 10 and first_roll + second_roll != 10:
                    raise Exception("Cannot roll after game is complete")
                if second_roll != 10 and second_roll + pins > 10:
                    raise Exception("Pin count exceeds pins on the lane")
            else:
                raise Exception("Cannot roll after game is complete")

    def _update_frame_state(self, pins):
        if self.frame < 10:
            if self.rolls_in_current_frame == 0:
                self.rolls_in_current_frame = 1
                self.current_frame_pins = pins
                self.is_strike = pins == 10
                self.is_spare = False
            elif self.rolls_in_current_frame == 1:
                self.rolls_in_current_frame = 2
                self.current_frame_pins += pins
                if self.is_strike:
                    self.is_spare = False
                else:
                    self.is_spare = (self.current_frame_pins == 10)
            else:
                self.frame += 1
                self.rolls_in_current_frame = 1
                self.current_frame_pins = pins
                self.is_strike = pins == 10
                self.is_spare = False
        else:
            if self.rolls_in_current_frame == 0:
                self.rolls_in_current_frame = 1
                self.current_frame_pins = pins
                self.is_strike = pins == 10
                self.is_spare = False
            elif self.rolls_in_current_frame == 1:
                self.rolls_in_current_frame = 2
                self.current_frame_pins += pins
                if self.is_strike:
                    self.is_spare = False
                else:
                    self.is_spare = (self.current_frame_pins == 10)
            else:
                self.frame += 1
                self.rolls_in_current_frame = 1
                self.current_frame_pins = pins
                self.is_strike = pins == 10
                self.is_spare = False

    def is_game_complete(self):
        if self.frame < 10:
            return False

        if self.rolls_in_current_frame < 2:
            return False

        if self.is_strike or self.is_spare:
            return self.rolls_in_current_frame >= 3

        return True

    def score(self):
        if not self.is_game_complete():
            raise Exception("Score cannot be taken until the end of the game")

        total_score = 0
        roll_index = 0

        for frame in range(1, 11):
            if roll_index >= len(self.rolls):
                break

            if self.rolls[roll_index] == 10:
                total_score += 10 + self.rolls[roll_index + 1] + self.rolls[roll_index + 2]
                roll_index += 1
            elif roll_index + 1 < len(self.rolls) and self.rolls[roll_index] + self.rolls[roll_index + 1] == 10:
                total_score += 10 + self.rolls[roll_index + 2]
                roll_index += 2
            else:
                total_score += self.rolls[roll_index] + self.rolls[roll_index + 1]
                roll_index += 2

        return total_score
