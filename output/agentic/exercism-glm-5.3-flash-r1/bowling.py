"""Score a bowling game."""

MAX_FRAMES = 10
MAX_PINS = 10


class BowlingGameError(ValueError):
    """Raised for any illegal operation in a bowling game."""


class BowlingGame:
    """Tracks rolls for a single ten-pin bowling game."""

    def __init__(self):
        self.rolls = []       # every pin count rolled, in order
        self._frame_no = 1    # frame currently being bowled (1-based)
        self._cur = []        # rolls made in the current (possibly last) frame
        self._over = False    # True once the tenth frame is complete

    # ------------------------------------------------------------------ #
    # Rolling                                                            #
    # ------------------------------------------------------------------ #
    def roll(self, pins):
        """Record a roll knocking down ``pins`` pins."""
        if isinstance(pins, bool) or not isinstance(pins, int):
            raise BowlingGameError("A roll must be an integer number of pins.")
        if pins < 0:
            raise BowlingGameError("Negative rolls are invalid.")
        if pins > MAX_PINS:
            raise BowlingGameError("A single roll cannot knock down more than "
                                   f"{MAX_PINS} pins.")
        if self._over:
            raise BowlingGameError("Cannot roll after the game is over.")

        limit = self._max_pins_for_next_roll()
        if pins > limit:
            raise BowlingGameError(
                f"Invalid roll: at most {limit} pins can be knocked down now."
            )

        self.rolls.append(pins)
        self._apply(pins)

    def _max_pins_for_next_roll(self):
        """Number of pins still standing for the upcoming roll."""
        cur = self._cur
        if self._frame_no < MAX_FRAMES:
            # Frames one through nine: at most two rolls totalling ten.
            return MAX_PINS - sum(cur)

        # Tenth frame.
        if len(cur) == 0:
            return MAX_PINS                      # first ball: fresh rack
        if len(cur) == 1:
            # Fill ball after a strike starts on a fresh rack;
            # otherwise the second ball shares the original rack.
            return MAX_PINS if cur[0] == MAX_PINS else MAX_PINS - cur[0]
        # Third ball (earned by a strike or spare).
        if cur[0] == MAX_PINS:
            if cur[1] == MAX_PINS:
                return MAX_PINS                  # fresh rack again
            return MAX_PINS - cur[1]             # continue the same rack
        return MAX_PINS                          # spare earned a fresh rack

    def _apply(self, pins):
        """Advance the internal frame/game state after a legal roll."""
        if self._frame_no < MAX_FRAMES:
            self._cur.append(pins)
            if pins == MAX_PINS or len(self._cur) == 2:
                self._frame_no += 1
                self._cur = []
            return

        # Tenth frame.
        self._cur.append(pins)
        if self._tenth_frame_complete():
            self._over = True

    def _tenth_frame_complete(self):
        cur = self._cur
        if len(cur) >= 3:
            return True
        if len(cur) == 2 and cur[0] != MAX_PINS:
            return sum(cur) < MAX_PINS           # an open frame needs no fill
        return False

    # ------------------------------------------------------------------ #
    # Scoring                                                            #
    # ------------------------------------------------------------------ #
    def score(self):
        """Total score once the game has been fully rolled."""
        if not self._over:
            raise BowlingGameError(
                "The game cannot be scored until it is complete."
            )

        total = 0
        i = 0
        for _frame in range(MAX_FRAMES):
            if self.rolls[i] == MAX_PINS:                        # strike
                total += MAX_PINS + self.rolls[i + 1] + self.rolls[i + 2]
                i += 1
            elif self.rolls[i] + self.rolls[i + 1] == MAX_PINS:  # spare
                total += MAX_PINS + self.rolls[i + 2]
                i += 2
            else:                                                # open frame
                total += self.rolls[i] + self.rolls[i + 1]
                i += 2
        return total


# Backwards-friendly alias used by some callers.
BowlingGameException = BowlingGameError
