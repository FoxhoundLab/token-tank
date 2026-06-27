"""API key encryption using Fernet symmetric encryption."""

import os
import base64
import hashlib
from cryptography.fernet import Fernet

from .config import get_settings, ensure_data_dir


def get_fernet() -> Fernet:
    """Get or create the Fernet cipher for API key encryption."""
    settings = get_settings()

    if not settings.secret_key:
        # Generate and persist a key on first run
        ensure_data_dir(settings)
        key_file = settings.data_dir / ".secret"
        if key_file.exists():
            key = key_file.read_bytes()
        else:
            key = Fernet.generate_key()
            key_file.write_bytes(key)
            key_file.chmod(0o600)  # Owner read/write only
        return Fernet(key)

    # Use the configured key. Accept a raw Fernet key verbatim; otherwise
    # derive a deterministic 32-byte key via SHA-256 so any-length secret
    # (including the 44-char output of Fernet.generate_key()) is valid.
    raw = settings.secret_key.encode()
    try:
        return Fernet(raw)
    except (ValueError, TypeError):
        derived = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
        return Fernet(derived)


def encrypt(plaintext: str) -> str:
    """Encrypt a string."""
    if not plaintext:
        return ""
    return get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a string."""
    if not ciphertext:
        return ""
    return get_fernet().decrypt(ciphertext.encode()).decode()
