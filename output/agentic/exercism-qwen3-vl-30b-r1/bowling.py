class BowlingGame:
    def __init__(self):
        self.rolls = []

    def roll(self, pins):
        if len(self.rolls) >= 21:
            raise ValueError("Maximum number of rolls (21) exceeded")
        if pins < 0 or pins > 10:
            raise ValueError("Invalid roll: must be between 0 and 10")
        self.rolls.append(pins)

    def score(self):
        score = 0
        i = 0
        for _ in range(10):
            if i >= len(self.rolls):
                break
            if self.rolls[i] == 10:
                score += 10 + self.rolls[i+1] + self.rolls[i+2]
                i += 1
            elif self.rolls[i] + self.rolls[i+1] == 10:
                score += 10 + self.rolls[i+2]
                i += 2
            else:
                score += self.rolls[i] + self.rolls[i+1]
                i += 2
        return score