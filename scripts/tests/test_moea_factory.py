"""經濟部中部辦公室 函釋彙編: the committed archive is a fresh import of the preserved text, with known filings."""
import subprocess, sys, unittest
from pathlib import Path
SCRIPTS = Path(__file__).resolve().parents[1]


class MoeaFactoryTests(unittest.TestCase):
    def test_archive_matches_import(self):
        subprocess.run([sys.executable, str(SCRIPTS / 'check-moea-factory.py')], check=True, stdout=subprocess.DEVNULL)


if __name__ == '__main__':
    unittest.main()
