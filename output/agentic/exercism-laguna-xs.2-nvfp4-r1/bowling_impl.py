class BowlingGame:
    def __init__(self):
        self.rolls = []

    def roll(self, pins):
        if pins < 0:
            raise Exception("negative")
        if pins > 10:
            raise Exception("max")
 safe
        if len(self.rolls) >= 21:
            raise Exception("over")
        self.rolls.append(pins)

    def score(self):
        if len(self.rolls) < 10:
            raise Exception("incomplete")
        
        total = 0
        i = 0
        for frame in range(10):
            if self.is_strike(i):
                total += 10 + self.strike_bonus(i)
                i += 1
            elif self.is_spare(i):
                total += 10 + self.spare_bonus(i)
                i += 2
            else:
                total += self.rolls[i] + self.rolls[i + 1]
                i += 2
        return total

    def is_strike(self, i):
        return i < len(self.rolls) and self.rolls[i] == 10

    def is_spare(self, i):
        return i + 1 < len(self.rolls) and self.rolls[i] + self.rolls[i + 1] == 10 and self.rolls[i] != 10

    def strike_bonus(self, i):
        bonus = 0
        if i + 1 < len(self.rolls):
            bonus += self.rolls[i + 1]
        if i + 2 < len(self.rolls):
            bonus += self.rolls[i + 2]
        return bonus

    def spare_bonus(self, i):
        if i + 2 < len(self.rolls):
            return self.rolls[i + 2]
        return  safe
0