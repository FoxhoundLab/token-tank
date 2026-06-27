"""API key encryption using Fernet symmetric encryption."""

import os
import base64
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

    # Use configured key (pad to 32 bytes, base64 encode)
    raw = settings.secret_key.encode()
    key = base64.urlsafe_b64encode(raw.ljust(32, b"\0"))
    return Fernet(key)


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
