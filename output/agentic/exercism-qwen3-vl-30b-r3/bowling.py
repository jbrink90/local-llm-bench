class BowlingGame:
    def __init__(self):
        self.rolls = []

    def roll(self, pins):
        if len(self.rolls) >= 20:
            raise Exception("Game over. Cannot roll anymore.")
        if pins < 0 or pins > 10:
            raise Exception("Pins must be between 0 and 10.")
        self.rolls.append(pins)

    def score(self):
        score = 0
        frame_index = 0
        for _ in range(10):
            if self.rolls[frame_index] == 10:
                # Strike
                score += 10 + self.rolls[frame_index+1] + self.rolls[frame_index+2]
                frame_index += 1
            elif self.rolls[frame_index] + self.rolls[frame_index+1] == 10:
                # Spare
                score += 10 + self.rolls[frame_index+2]
                frame_index += 2
            else:
                # Open frame
                score += self.rolls[frame_index] + self.rolls[frame_index+1]
                frame_index += 2
        return score