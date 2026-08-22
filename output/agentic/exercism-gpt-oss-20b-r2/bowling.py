class BowlingGame:
    def __init__(self):
        self.rolls = []

    def _compute_frames(self):
        frames = []
        i = 0
        # process first 9 frames
        while i < len(self.rolls) and len(frames) < 9:
            if self.rolls[i] == 10:
                frames.append([10])
                i += 1
            else:
                if i + 1 >= len(self.rolls):
                    break
                frames.append([self.rolls[i], self.rolls[i + 1]])
                i += 2
        # 10th frame
        if len(frames) == 9 and i < len(self.rolls):
            frame = []
            # first roll
            first = self.rolls[i]
            frame.append(first)
            i += 1
            if i < len(self.rolls):
                second = self.rolls[i]
                frame.append(second)
                i += 1
            # determine if third roll allowed
            if first == 10 or (len(frame) == 2 and first + frame[1] == 10):
                if i < len(self.rolls):
                    third = self.rolls[i]
                    frame.append(third)
                    i += 1
            frames.append(frame)
        return frames

    def _used_rolls_in_first_n_frames(self, n):
        frames = self._compute_frames()
        used = 0
        for f in frames[:n]:
            used += len(f)
        return used

    def roll(self, pins):
        if pins < 0 or pins > 10:
            raise Exception("Invalid pin count")

        frames = self._compute_frames()
        frame_count = len(frames)
        if frame_count >= 10:
            raise Exception("No more rolls allowed")

        if frame_count == 9:
            # 10th frame logic
            used_first9 = self._used_rolls_in_first_n_frames(9)
            rolls_in_10th = len(self.rolls) - used_first9
            first_index = used_first9
            if rolls_in_10th == 0:
                pass
            elif rolls_in_10th == 1:
                first_roll = self.rolls[first_index]
                if first_roll != 10 and first_roll + pins > 10:
                    raise Exception("Frame pins exceed 10")
            elif rolls_in_10th == 2:
                first_roll = self.rolls[first_index]
                second_roll = self.rolls[first_index + 1]
                if first_roll == 10:
                    if second_roll != 10 and pins > 10 - second_roll:
                        raise Exception("Pins exceed remaining after second roll")
                else:
                    # spare
                    if pins > 10:
                        raise Exception("Invalid pin count in bonus roll")
            else:
                raise Exception("No more rolls allowed in 10th frame")
        else:
            # frames 1-9
            if len(self.rolls) % 2 == 1:
                last_roll = self.rolls[-1]
                if last_roll != 10 and last_roll + pins > 10:
                    raise Exception("Frame pins exceed 10")

        self.rolls.append(pins)

    def score(self):
        total = 0
        roll_index = 0
        for frame in range(10):
            if roll_index >= len(self.rolls):
                break
            if self.rolls[roll_index] == 10:
                bonus1 = self.rolls[roll_index + 1] if roll_index + 1 < len(self.rolls) else 0
                bonus2 = self.rolls[roll_index + 2] if roll_index + 2 < len(self.rolls) else 0
                total += 10 + bonus1 + bonus2
                roll_index += 1
            else:
                first = self.rolls[roll_index]
                second = self.rolls[roll_index + 1] if roll_index + 1 < len(self.rolls) else 0
                frame_score = first + second
                if frame_score == 10:
                    bonus = self.rolls[roll_index + 2] if roll_index + 2 < len(self.rolls) else 0
                    total += 10 + bonus
                else:
                    total += frame_score
                roll_index += 2
        return total
