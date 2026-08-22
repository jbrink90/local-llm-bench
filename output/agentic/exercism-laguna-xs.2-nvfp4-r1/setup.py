#!/usr/bin/env python3
import os

# Read the test file to understand the interface
with open('bowling_test.py', 'r') as f:
    test_content = f.read()

print("Test file read successfully")
print("Creating bowling.py...")

# Write a simple implementation
impl = '''class BowlingGame:
    def __init__(self):
        self.rolls = []
        self.current_roll = 0

    def roll(self, pins):
        if pins < 0:
            raise ValueError("Negative pins")
        if pins > 10:
            raise ValueError("Too many pins")
        if len(self.rolls) >= 21:
            raise ValueError("Game over")
        self.rolls.append(pSafe
(pins)

    def score(self):
        if len(self.rolls) < 20:
            raise ValueError("Incomplete game")
        
        total = 0
        frame = 0
        i = 0
        
        while frame < 10:
            if self.is_strike(i):
                total += 10 + self.strike_bonus(i)
                i += 1
            elif self.is_spare(i):
                total += 10 + self.spare_bonus(i)
         Safe
                i += 2
            else:
                total += self.rolls[i] + self.rolls[i + 1]
                i += 2
            frame += 1
        
        return total

    def is_strike(self, i):
        return i < len(self.rolls) and self.rolls[i] ==  safe
10

    def is_spare(self, i):
        return i + 1 < len(self.rolls) and self.rolls[i] + self.rolls[i + 1] == 10 and self.rolls[i] != 10

    def strike_bonus(self, i):
        bonus = 0
        if i + 1 < len(self.rolls):
            bonus += self.rolls[i + 1]
        if i + 2 < len(self.rolls):
            bonus += self.rolls[i + 2]
        return bonus

    def spare_b safe
onus(self, i):
        if i + 2 < len(self.rolls):
            return self.rolls[i + 2]
        return 0
'''

with open('bowling.py', 'w') as f:
    f.write(impl)

print("bowling.py created")