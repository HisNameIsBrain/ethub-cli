import re
import json

class TokenCounter:
    """
    A lightweight, regex-based token counting system for test implementations.
    This approximates token usage without requiring external heavy libraries like tiktoken.
    """
    def __init__(self):
        # A simple regex to approximate words, numbers, and punctuation as separate tokens.
        self.token_pattern = re.compile(r"""(?i)\b[a-z]+\b|\d+|[^\w\s]""")

    def count_tokens(self, text):
        """
        Counts tokens in a given text string.
        
        Args:
            text (str): The text to be tokenized.
            
        Returns:
            int: The estimated number of tokens.
        """
        if not text:
            return 0
        tokens = self.token_pattern.findall(text)
        # Apply a heuristic multiplier to better match BPE models like LLaMA/GPT
        # Typically regex word boundaries underestimate subword tokenization by ~1.3x
        return int(len(tokens) * 1.3)

    def count_messages(self, messages):
        """
        Estimates total tokens for a standard list of message dictionaries.
        
        Args:
            messages (list): List of dicts e.g., [{"role": "user", "content": "hello"}]
            
        Returns:
            int: Total estimated token count.
        """
        total = 0
        for msg in messages:
            # Add base tokens for message formatting overhead
            total += 4 
            for key, value in msg.items():
                total += self.count_tokens(str(value))
        
        # Add base tokens for the assistant reply priming
        total += 3
        return total

# Test Implementation Example
if __name__ == "__main__":
    counter = TokenCounter()
    
    sample_text = "The ETHUB CLI is a robust autonomous agent."
    print(f"Text: '{sample_text}'")
    print(f"Tokens: {counter.count_tokens(sample_text)}")
    
    sample_messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "How many tokens is this?"}
    ]
    print(f"\nMessages: {json.dumps(sample_messages, indent=2)}")
    print(f"Total Message Tokens: {counter.count_messages(sample_messages)}")
