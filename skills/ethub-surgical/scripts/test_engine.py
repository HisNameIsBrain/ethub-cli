import os
from pathlib import Path
from ethub_action_engine import EthubActionEngine

def test_engine():
    # Setup test file
    test_file = Path("test.txt")
    test_file.write_text("initial content\n")
    
    engine = EthubActionEngine()
    
    # 1. Test Read & Integrity
    print("--- Testing Read & Integrity ---")
    read_output = engine.read_target("test.txt")
    print(read_output)
    
    # 2. Test Apply Patch (with Snapshot)
    print("--- Testing Apply Patch ---")
    patch_output = engine.apply_patch("test.txt", "updated content\n")
    print(patch_output)
    
    # 3. Verify Snapshot
    print("--- Verifying Snapshot ---")
    snapshot_files = list(engine.snapshot_dir.glob("*test.txt*.bak"))
    if snapshot_files:
        print(f"Success: Found {len(snapshot_files)} snapshots.")
    else:
        print("Failure: No snapshots found.")
        
    # Cleanup
    # test_file.unlink()
    # for s in snapshot_files: s.unlink()

if __name__ == "__main__":
    test_engine()
