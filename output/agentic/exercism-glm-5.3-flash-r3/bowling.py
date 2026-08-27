"""Score a bowling game."""

TOTAL_FRAMES = 10


class BowlingError(Exception):
    """Raised for invalid rolls or when a game cannot be scored."""


class BowlingGame:
    def __init__(self):
        self.rolls = []  # every roll of the game, in order
        self.frames = [[] for _ in range(TOTAL_FRAMES)]
        self.current_frame = 0  # index (0-based) of the frame being bowled
        self.finished = False  # True once all 10 frames (+ fill balls) are bowled

    # ------------------------------------------------------------------ #
    # Rolling
    # ------------------------------------------------------------------ #
    def roll(self, pins):
        if pins < 0 or pins > 10:
            raise BowlingError(
                "Pins knocked down must be between 0 and 10, got %r." % (pins,)
            )
        if self.finished:
            raise BowlingError("Cannot roll after the game is over.")

        standing = self._standing_pins()
        if pins > standing:
            raise BowlingError(
                "Cannot knock down %d pins when only %d are standing."
                % (pins, standing)
            )

        self.rolls.append(pins)
        self.frames[self.current_frame].append(pins)
        self._advance()

    def _standing_pins(self):
        """Number of pins standing for the upcoming roll."""
        if self.current_frame < TOTAL_FRAMES - 1:
            # Regular frames start with a full rack (cleared after a strike).
            return 10 - sum(self.frames[self.current_frame])

        # Tenth frame: rack resets after a strike or a spare, plus fill balls.
        frame = self.frames[TOTAL_FRAMES - 1]
        if not frame:
            return 10
        if len(frame) == 1:
            return 10 if frame[0] == 10 else 10 - frame[0]
        # Two balls have been thrown.
        if frame[0] == 10:
            return 10 if frame[1] == 10 else 10 - frame[1]
        return 10  # First two balls made a spare: fresh rack for the fill ball.

    def _advance(self):
        """Move to the next frame / mark the game as finished, if applicable."""
        if self.current_frame < TOTAL_FRAMES - 1:
            frame = self.frames[self.current_frame]
            if len(frame) == 2 or frame[0] == 10:
                self.current_frame += 1
            return

        frame = self.frames[TOTAL_FRAMES - 1]
        if len(frame) == 3:
            self.finished = True
        elif (
            len(frame) == 2 and frame[0] != 10 and frame[0] + frame[1] < 10
        ):
            self.finished = True

    # ------------------------------------------------------------------ #
    # Scoring
    # ------------------------------------------------------------------ #
    def score(self):
        if not self.finished:
            raise BowlingError("An incomplete game cannot be scored.")

        total = 0
        i = 0
        rolls = self.rolls

        # Frames 1..9: strikes/spares earn bonuses from subsequent rolls.
        for _ in range(TOTAL_FRAMES - 1):
            if rolls[i] == 10:  # strike
                total += 10 + rolls[i + 1] + rolls[i + 2]
                i += 1
            elif rolls[i] + rolls[i + 1] == 10:  # spare
                total += 10 + rolls[i + 2]
                i += 2
            else:  # open frame
                total += rolls[i] + rolls[i + 1]
                i += 2

        # Tenth frame: simply the pins knocked down (includes fill balls).
        total += sum(self.frames[-1])
        return total
