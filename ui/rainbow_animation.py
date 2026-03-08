import time
import sys
import os

# Visual Constants
HEADER_WIDTH = 70
DIVIDER_CHARS = "=-"
ETHUB_ASCII = [
    "oooooooooooo ooooooooooooo ooooo   ooooo ooooo     ooo oooooooooo.",
    "`888'     `8 8'   888   `8 `888'   `888' `888'     `8' `888'   `Y8b",
    " 888              888       888     888   888       8   888     888",
    " 888oooo8         888       888ooooo888   888       8   888oooo888'",
    " 888              888       888     888   888       8   888    `88b",
    " 888       o      888       888     888   `88.    .8'   888    .88P",
    "o888ooooood8     o888o     o888o   o888o    `YbodP'    o888bood8P'"
]

def hsl_to_rgb(h, s, l):
    h /= 360.0
    a = s * min(l, 1.0 - l)
    def f(n):
        k = (n + h * 12.0) % 12.0
        c = l - a * max(min(k - 3.0, 9.0 - k, 1.0), -1.0)
        return int(round(c * 255.0))
    return f(0), f(8), f(4)

def get_rgb_ansi(r, g, b):
    return f"\x1b[38;2;{r};{g};{b}m"

def rainbow_divider(width, phase):
    out = ""
    for i in range(width):
        ch = DIVIDER_CHARS[i % len(DIVIDER_CHARS)]
        p = (i / float(width) + phase) % 1.0
        r, g, b = hsl_to_rgb(p * 360, 0.6, 0.65)
        out += get_rgb_ansi(r, g, b) + ch
    return out + "\x1b[0m"

def rainbow_ascii_line(line, row, total_rows, frame):
    out = ""
    length = max(len(line), 1)
    for i, ch in enumerate(line):
        if ch == " ":
            out += " "
            continue
        phase = (i / float(length) + row / float(total_rows) + frame * 0.01) % 1.0
        r, g, b = hsl_to_rgb(phase * 360, 0.6, 0.65)
        
        display = ch
        if (ch in ["o", "8"]) and (frame + i + row) % 47 == 0:
            display = "+"
            
        out += get_rgb_ansi(r, g, b) + display
    return out + "\x1b[0m"

def draw_header(frame, initial_dir="."):
    p1 = (frame / 90.0) % 1.0
    p3 = (p1 + 0.66) % 1.0
    
    left_pad = "  "
    print(left_pad + rainbow_divider(HEADER_WIDTH, p1))
    for r, line in enumerate(ETHUB_ASCII):
        print(left_pad + rainbow_ascii_line(line, r, len(ETHUB_ASCII), frame))
    
    # Static info line (gray)
    mode_info = f"Mode: INTERACTIVE | Root: {initial_dir}"
    print(left_pad + f"\x1b[90m{mode_info}\x1b[0m")
    print(left_pad + rainbow_divider(HEADER_WIDTH, p3))

def run_intro(initial_dir=".", frames=40):
    """Run the animated rainbow header as an intro."""
    if not sys.stdout.isatty():
        return

    print("\x1b[2J\x1b[H", end="") # Clear screen
    print("\x1b[?25l", end="")  # Hide cursor
    try:
        # Run a short animation loop for the intro
        for frame in range(frames):
            print("\x1b[H", end="") # Move to top
            draw_header(frame, initial_dir)
            time.sleep(0.03)
    except KeyboardInterrupt:
        pass
    finally:
        print("\x1b[?25h", end="")  # Show cursor
