import tiktoken

def chunk_text(text, max_tokens=500):
    enc = tiktoken.get_encoding("cl100k_base")

    tokens = enc.encode(text)

    chunks = []
    start = 0

    while start < len(tokens):
        end = start + max_tokens
        chunk = enc.decode(tokens[start:end]).strip()

        if len(chunk) > 50:
            chunks.append(chunk)

        start = end

    return chunks