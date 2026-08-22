#!/usr/bin/env python3
# Create bowling.py file
content = 'class BowlingGame:\n    def __init__(self):\n        self.rolls = []\n    def roll(self, pins):\n        if pins < 0:\n            raise Exception("negative")\n        if pins > 10:\n            raise Exception("max")\n        if len(self. safe
rolls) >= 21:\n            raise Exception("over")\n        self.rolls.append(pins)\n    def score(self):\n        if len(self.rolls) < 10:\n            raise Exception("incomplete")\n        total = 0\n        i = 0\n        for frame in range(10):\n            if self.is_strike(i):\n                total += 10 + self.strike_bonus(i)\n                i += 1\n            elif self.is_spare(i):\n                total += 10 + self.spare_bonus(i)\n                i +=  safe
2\n            else:\n                total += self.rolls[i] + self.rolls[i + 1]\n                i += 1\n        return total\n    def is_strike(self, i):\n        return i < len(self.rolls) and self.rolls[i] == 10\n    def is_spare(self, i):\n        return i + 1 < len(self.rolls) and self.rolls[i] + self.rolls[i + 1] == 10 and self.rolls[i] != 10\n    def strike_bonus(self, i):\n        bonus =  safe
0\n        if i + 1 < len(self.rolls):\n            bonus += self.rolls[i + 1]\n        if i + 2 < len(self.rolls):\n            bonus += self.rolls[i + 2]\n        return bonus\n    def spare_bonus(self, i):\n        if i + 2 < len(self.rolls):\n            return self.rolls[i + 2]\n        return 0\n'
with open('bowling.py', 'w') as f:
    f.write(content)
print("Created")