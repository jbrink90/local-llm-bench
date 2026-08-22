class BowlingGame:
    def __init__(self):
        self.rolls = []
    
    def roll(self, pins):
        if pins < 0 or pins > 10:
            raise ValueError("Pins must be between 0 and 10")
        self.rolls.append(pins)
    
    def score(self):
        total = 0
        index = 0
        for frame in range(10):
            if index >= len(self.rolls):
                break
            if frame < 9:
                if self.rolls[index] == 10:
                    total += 10 + self.rolls[index+1] + self.rolls[index+2]
                    index += 1
                else:
                    if self.rolls[index] + self.rolls[index+1] == 10:
                        total += 10 + self.rolls[index+2]
                        index += 2
                    else:
                        total += self.rolls[index] + self.rolls[index+1]
                        index += 2
            else:
                if self.rolls[index] == 10:
                    total += 10
                    if index + 1 < len(self.rolls):
                        total += self.rolls[index+1]
                    if index + 2 < len(self.rolls):
                        total += self.rolls[index+2]
                    index += 1
                elif index + 1 < len(self.rolls) and self.rolls[index] + self.rolls[index+1] == 10:
                    total += 10
                    if index + 2 < len(self.rolls):
                        total += self.rolls[index+2]
                    index += 2
                else:
                    total += self.rolls[index]
                    if index + 1 < len(self.rolls):
                        total += self.rolls[index+1]
                    index += 2
        return total