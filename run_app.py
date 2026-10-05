"""The program the .exe runs. Double-click opens the window; `--selftest` runs the health check."""
import sys


def main() -> int:
    if any(arg.startswith("--selftest") for arg in sys.argv[1:]):
        from auto_spiffer.gui.selftest import run as selftest
        return selftest(sys.argv[1:])
    from auto_spiffer.gui.app import run
    return run()


if __name__ == "__main__":
    sys.exit(main())
