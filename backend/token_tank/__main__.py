"""Single-command launcher: starts proxy + FastAPI in the same process.

Usage::

    python -m token_tank              # start proxy + FastAPI (default)
    python -m token_tank start        # same, explicit
    python -m token_tank stop|status|init
    python -m token_tank --version

All argument handling lives in :mod:`token_tank.cli`; this module just
forwards to it so ``python -m token_tank`` and the ``token-tank`` console
script behave identically.
"""

import sys

from .cli import main

if __name__ == "__main__":
    main(sys.argv[1:])
