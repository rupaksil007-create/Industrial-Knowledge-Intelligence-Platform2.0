import sys
try:
    import chromadb
    print(f"OK: {sys.executable}")
    print(f"Python: {sys.version}")
except ImportError as e:
    print(f"FAIL: {sys.executable} - {e}")
