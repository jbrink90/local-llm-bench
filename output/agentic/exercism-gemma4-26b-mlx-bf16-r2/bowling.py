class BowlingGame:
    def __init__(self):
        self.rolls = []

    def roll(self, pins: int):
        if pins < 0 or pins > 10:
            raise Exception("Invalid pins")
        
        if self._is_finished():
            raise Exception("Game is finished")

        self.rolls.append(pins)
        self._validate_sequence()

    def _is_finished(self) -> bool:
        if not self.rolls:
            return False
        
        roll_idx = 0
        for frame in range(1, 11):
            if roll_idx >= len(self.rolls):
                return False
            
            if frame < 10:
                if self.rolls[roll_idx] == 10:
                    roll_idx += 1
                else:
                    if roll_idx + 1 < len(self.rolls):
                        roll_idx += 2
                    else:
                        return False
            else:
                # 10th frame
                if self.rolls[roll_idx] == 10:
                    # Strike in 10th frame needs 2 more rolls
                    if roll_idx + 2 < len(self.rolls):
                        roll_idx += 3
                    elif roll_idx + 1 < len(self.rolls):
                        return False
                    else:
                        return False
                elif roll_idx + 1 < len(self.rolls) and self.rolls[roll_idx] + self.rolls[roll_idx+1] == 10:
                    # Spare in 10th frame needs 1 more roll
                    if roll_idx + 2 < len(self.rolls):
                        roll_idx += 3
                    else:
                        return False
                elif roll_idx + 1 < len(self.rolls):
                    # Open frame in 10th frame
                    roll_idx += 2
                else:
                    return False
        
        return roll_idx == len(self.rolls)

    def _validate_sequence(self):
        roll_idx = 0
        for frame in range(1, 11):
            if roll_idx >= len(self.rolls):
                return

            if frame < 10:
                if self.rolls[roll_idx] == 10:
                    roll_idx += 1
                else:
                    if roll_idx + 1 < len(self.rolls):
                        if self.rolls[roll_idx] + self.rolls[roll_idx+1] > 10:
                            raise Exception("Frame score > 10")
                        roll_idx += 2
                    else:
                        return
            else:
                # 10th frame
                if self.rolls[roll_idx] == 10:
                    if roll_idx + 2 < len(self.rolls):
                        # We have 3 rolls in 10th frame
                        if self.rolls[roll_idx+1] < 10:
                            if self.rolls[roll_idx+1] + self.rolls[roll_idx+2] > 10:
                                raise Exception("Bonus rolls > 10")
                            if self.rolls[roll_idx+2] == 10:
                                raise Exception("Invalid bonus rolls")
                        if roll_idx + 3 < len(self.rolls):
                            raise Exception("Too many rolls")
                        roll_idx += 3
                    elif roll_idx + 1 < len(self.rolls):
                        if roll_idx + 2 < len(self.rolls):
                            raise Exception("Too many rolls")
                        roll_idx += 2
                    else:
                        roll_idx += 1
                elif roll_idx + 1 < len(self.rolls):
                    if self.rolls[roll_idx] + self.rolls[roll_idx+1] > 10:
                        raise Exception("Frame score > 10")
                    
                    if self.rolls[roll_idx] + self.rolls[roll_idx+1] == 10:
                        # Spare in 10th
                        if roll_idx + 2 < len(self.rolls):
                            if roll_idx + 3 < len(self.rolls):
                                raise Exception("Too many rolls")
                            roll_idx += 3
                        else:
                            roll_idx += 2
                    else:
                        # Open in 10th
                        if roll_idx + 2 < len(self.rolls):
                            raise Exception("Too many rolls")
                        roll_idx += 2
                    break
                else:
                    roll_idx += 1
                    break
        
        if roll_idx < len(self.rolls):
            raise Exception("Too many rolls")

    def score(self) -> int:
        if not self._is_finished():
            raise Exception("Game not finished")
        
        total_score = 0
        roll_idx = 0
        for frame in range(1, 11):
            if self.rolls[roll_idx] == 10:
                total_score += 10 + self.rolls[roll_idx+1] + self.rolls[roll_idx+2]
                roll_idx += 1
            elif self.rolls[roll_idx] + self.rolls[roll_idx+1] == 10:
                total_score += 10 + self.rolls[roll_idx+2]
                roll_idx += 2
            else:
                total_score += self.rolls[roll_idx] + self.rolls[roll_idx+1]
                roll_idx += 2
        return total_score
