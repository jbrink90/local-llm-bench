"""Score keeper for a game of ten-pin bowling."""


class BowlingGame:
    """Tracks rolls for a bowling game and computes the final score."""

    def __init__(self):
        self.rolls = []       # every ball thrown, in order
        self.frame = 1        # current frame, 1-10
        self.ball = 1         # ball number within the current frame
        self.standing = 10    # pins available for the upcoming roll
        self.finished = False  # every required ball has been thrown
        self._tenth = []      # balls thrown in the tenth frame

    def roll(self, pins):
        """Record a roll knocking down ``pins`` pins."""
        if pins < 0:
            raise ValueError("Pins knocked down cannot be negative.")
        if self.finished:
            raise ValueError("Cannot roll after the game is over.")
        if pins > self.standing:
            raise ValueError(
                "A roll cannot knock down more pins than are standing."
            )

        self.rolls.append(pins)
        self._advance(pins)

    def score(self):
        """Return the total score of a completed game."""
        if not self.finished:
            raise ValueError("An incomplete game cannot be scored.")

        total = 0
        index = 0
        for _ in range(10):
            if self.rolls[index] == 10:                     # strike
                total += 10 + self.rolls[index + 1] + self.rolls[index + 2]
                index += 1
            elif self.rolls[index] + self.rolls[index + 1] == 10:  # spare
                total += 10 + self.rolls[index + 2]
                index += 2
            else:                                           # open frame
                total += self.rolls[index] + self.rolls[index + 1]
                index += 2
        return total

    def _advance(self, pins):
        """Update the game state after a roll of ``pins``."""
        if self.frame < 10:
            if self.ball == 1 and pins < 10:
                self.ball = 2
                self.standing = 10 - pins
            else:
                self._next_frame()
            return

        # Tenth frame, where strike/spare earn fill balls.
        self._tenth.append(pins)
        count = len(self._tenth)
        if count == 1:
            self.standing = 10 if pins == 10 else 10 - pins
        elif count == 2:
            first, second = self._tenth
            if first == 10:
                self.standing = 10 if second == 10 else 10 - second
            elif first + second == 10:
                self.standing = 10
            else:
                self.finished = True
        else:
            self.finished = True

    def _next_frame(self):
        self.frame += 1
        self.ball = 1
        self.standing = 10
