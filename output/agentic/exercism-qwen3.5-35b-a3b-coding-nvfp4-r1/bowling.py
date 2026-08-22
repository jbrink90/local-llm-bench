class BowlingGame:
    def __init__(self):
        self.rolls = []

    def roll(self, pins):
        # Validate pins
        if pins < 0:
            raise ValueError("Negative roll is invalid")
        if pins > 10:
            raise ValueError("Pin count exceeds pins on the lane")

        # Check if game is already complete
        if self._is_game_complete():
            raise ValueError("Cannot roll after game is over")

        self.rolls.append(pins)

        # Validate game state after adding the roll
        self._validate_game_state()

    def _validate_game_state(self):
        """Validate that the game state is valid after a roll."""
        frame_num = 0
        roll_idx = 0

        while roll_idx < len(self.rolls):
            if frame_num < 9:
                # Regular frames 1-9
                first_roll = self.rolls[roll_idx]

                # Strike case - one roll for the frame
                if first_roll == 10:
                    roll_idx += 1
                    frame_num += 1
                else:
                    # Check if we have a second roll for this frame
                    if roll_idx + 1 >= len(self.rolls):
                        return  # Frame not complete yet
                    second_roll = self.rolls[roll_idx + 1]

                    # Check frame constraint (no more than 10 pins unless first was strike)
                    if first_roll + second_roll > 10:
                        raise ValueError("Pin count exceeds pins on the lane")

                    roll_idx += 2
                    frame_num += 1
            else:
                # 10th frame - special case
                if roll_idx >= len(self.rolls):
                    return  # Nothing in 10th frame yet

                # First roll of 10th frame
                first_roll = self.rolls[roll_idx]

                if first_roll == 10:  # Strike in 10th
                    # Need 2 more rolls
                    if roll_idx + 2 >= len(self.rolls):
                        return  # Not enough rolls yet

                    # Check second roll constraint (after strike, second roll can't be > 10)
                    # Actually, second roll can be up to 10, but if it's not a strike,
                    # then second + third must be <= 10
                    second_roll = self.rolls[roll_idx + 1]
                    if second_roll != 10 and second_roll + self.rolls[roll_idx + 2] > 10:
                        raise ValueError("Pin count exceeds pins on the lane")
                    roll_idx += 3
                    frame_num += 1
                elif roll_idx + 1 >= len(self.rolls):
                    # Only one roll so far
                    return  # Not enough rolls yet
                else:
                    # Two rolls so far
                    second_roll = self.rolls[roll_idx + 1]
                    if first_roll + second_roll == 10:  # Spare
                        # Need one more roll
                        if roll_idx + 2 >= len(self.rolls):
                            return  # Not enough rolls yet
                        roll_idx += 3
                        frame_num += 1
                    else:
                        # Open frame, done with 10th
                        roll_idx += 2
                        frame_num += 1

    def score(self):
        # Validate game is complete
        if not self._is_game_complete():
            raise ValueError("Score cannot be taken until the end of the game")

        total_score = 0
        roll_idx = 0

        for frame in range(10):
            if roll_idx >= len(self.rolls):
                break

            if self.rolls[roll_idx] == 10:  # Strike
                total_score += 10
                total_score += self.rolls[roll_idx + 1]
                total_score += self.rolls[roll_idx + 2]
                roll_idx += 1
            elif roll_idx + 1 < len(self.rolls) and self.rolls[roll_idx] + self.rolls[roll_idx + 1] == 10:  # Spare
                total_score += 10
                total_score += self.rolls[roll_idx + 2]
                roll_idx += 2
            else:  # Open frame
                total_score += self.rolls[roll_idx] + self.rolls[roll_idx + 1]
                roll_idx += 2

        return total_score

    def _is_game_complete(self):
        """Check if the game is complete (all 10 frames have been played)."""
        frame_num = 0
        roll_idx = 0

        while roll_idx < len(self.rolls) and frame_num < 10:
            if frame_num < 9:
                # Regular frames 1-9
                if self.rolls[roll_idx] == 10:  # Strike
                    roll_idx += 1
                    frame_num += 1
                else:
                    if roll_idx + 1 >= len(self.rolls):
                        return False
                    roll_idx += 2
                    frame_num += 1
            else:
                # 10th frame
                if roll_idx >= len(self.rolls):
                    return False

                first_roll = self.rolls[roll_idx]

                if first_roll == 10:  # Strike in 10th
                    if roll_idx + 2 >= len(self.rolls):
                        return False
                    roll_idx += 3
                    frame_num += 1
                elif roll_idx + 1 >= len(self.rolls):
                    return False
                else:
                    second_roll = self.rolls[roll_idx + 1]
                    if first_roll + second_roll == 10:  # Spare in 10th
                        if roll_idx + 2 >= len(self.rolls):
                            return False
                        roll_idx += 3
                        frame_num += 1
                    else:
                        roll_idx += 2
                        frame_num += 1

        return frame_num == 10
