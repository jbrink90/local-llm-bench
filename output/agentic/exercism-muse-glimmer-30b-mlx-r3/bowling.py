class BowlingGame:
    def __init__(self):
        self.rolls = []

    def roll(self, pins):
        if not isinstance(pins, int):
            raise Exception("Invalid roll")
        if pins < 0 or pins > 10:
            raise Exception("Pin count out of range")
        temp = self.rolls + [pins]
        if not self._valid_prefix(temp):
            raise Exception("Invalid roll sequence")
        self.rolls = temp

    def score(self):
        if not self._is_complete(self.rolls):
            raise Exception("Game not complete")
        return self._calculate_score(self.rolls)

    def _valid_prefix(self, rolls):
        i = 0
        frame = 1
        # frames 1-9
        while frame < 10:
            if i >= len(rolls):
                return True
            first = rolls[i]
            if not 0 <= first <= 10:
                return False
            if first == 10:
                i += 1
                frame += 1
                continue
            # need second ball
            if i + 1 >= len(rolls):
                return True
            second = rolls[i + 1]
            if not 0 <= second <= 10:
                return False
            if first + second > 10:
                return False
            i += 2
            frame += 1
        # frame 10
        if i >= len(rolls):
            return True
        first = rolls[i]
        if not 0 <= first <= 10:
            return False
        i += 1
        if i >= len(rolls):
            return True
        second = rolls[i]
        if not 0 <= second <= 10:
            return False
        i += 1
        if first == 10:
            # strike in 10th
            if i >= len(rolls):
                return True
            third = rolls[i]
            if not 0 <= third <= 10:
                return False
            if second < 10 and third > 10 - second:
                return False
            i += 1
            return i == len(rolls)
        else:
            if first + second > 10:
                return False
            if first + second == 10:
                # spare, need bonus
                if i >= len(rolls):
                    return True
                third = rolls[i]
                if not 0 <= third <= 10:
                    return False
                i += 1
                return i == len(rolls)
            else:
                # open
                return i == len(rolls)

    def _is_complete(self, rolls):
        i = 0
        # frames 1-9
        for _ in range(9):
            if i >= len(rolls):
                return False
            if rolls[i] == 10:
                i += 1
            else:
                if i + 1 >= len(rolls):
                    return False
                if rolls[i] + rolls[i + 1] > 10:
                    return False
                i += 2
        # frame 10
        if i >= len(rolls):
            return False
        first = rolls[i]
        if first == 10:
            # need two more rolls
            if len(rolls) < i + 3:
                return False
            second = rolls[i + 1]
            third = rolls[i + 2]
            if not (0 <= second <= 10 and 0 <= third <= 10):
                return False
            if second < 10 and third > 10 - second:
                return False
            i += 3
        else:
            if i + 1 >= len(rolls):
                return False
            second = rolls[i + 1]
            if first + second > 10:
                return False
            if first + second == 10:
                # spare needs bonus
                if len(rolls) < i + 3:
                    return False
                third = rolls[i + 2]
                if not 0 <= third <= 10:
                    return False
                i += 3
            else:
                i += 2
        return i == len(rolls)

    def _calculate_score(self, rolls):
        score = 0
        i = 0
        # frames 1-9
        for _ in range(9):
            if rolls[i] == 10:
                score += 10 + rolls[i + 1] + rolls[i + 2]
                i += 1
            else:
                frame_sum = rolls[i] + rolls[i + 1]
                if frame_sum == 10:
                    score += 10 + rolls[i + 2]
                else:
                    score += frame_sum
                i += 2
        # 10th frame
        score += sum(rolls[i:])
        return score
