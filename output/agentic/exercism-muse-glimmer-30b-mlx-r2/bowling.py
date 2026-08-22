class BowlingGame:
    def __init__(self):
        self.rolls = []
        self.frame = 1
        self.current = []

    def roll(self, pins):
        if not isinstance(pins, int):
            pins = int(pins)
        if pins < 0 or pins > 10:
            raise Exception("Invalid pin count")
        if self.frame > 10:
            raise Exception("Game already over")
        if self.frame < 10:
            if len(self.current) == 0:
                self.current.append(pins)
                self.rolls.append(pins)
                if pins == 10:
                    self.frame += 1
                    self.current = []
            else:
                if self.current[0] + pins > 10:
                    raise Exception("Frame pin total exceeds 10")
                self.current.append(pins)
                self.rolls.append(pins)
                self.frame += 1
                self.current = []
        else:  # frame 10
            if len(self.current) == 0:
                self.current.append(pins)
                self.rolls.append(pins)
            elif len(self.current) == 1:
                first = self.current[0]
                if first == 10:
                    self.current.append(pins)
                    self.rolls.append(pins)
                else:
                    if first + pins > 10:
                        raise Exception("Frame pin total exceeds 10")
                    self.current.append(pins)
                    self.rolls.append(pins)
                    if first + pins == 10:
                        pass
                    else:
                        self.frame += 1
                        self.current = []
            elif len(self.current) == 2:
                first, second = self.current[0], self.current[1]
                if first == 10:
                    if second != 10 and pins > 10 - second:
                        raise Exception("Bonus pin count invalid")
                    self.current.append(pins)
                    self.rolls.append(pins)
                    self.frame += 1
                    self.current = []
                else:
                    self.current.append(pins)
                    self.rolls.append(pins)
                    self.frame += 1
                    self.current = []
            else:
                raise Exception("Too many rolls in frame")

    def score(self):
        if self.frame <= 10:
            raise Exception("Game not complete")
        total = 0
        i = 0
        for _ in range(9):
            if self.rolls[i] == 10:
                total += 10 + self.rolls[i + 1] + self.rolls[i + 2]
                i += 1
            else:
                frame_sum = self.rolls[i] + self.rolls[i + 1]
                total += frame_sum
                if frame_sum == 10:
                    total += self.rolls[i + 2]
                i += 2
        total += sum(self.rolls[i:])
        return total
