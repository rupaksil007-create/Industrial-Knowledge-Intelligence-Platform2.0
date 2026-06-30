import os
import sys

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

# Set environment variables for testing
os.environ["EMBEDDING_PROVIDER"] = "chroma"
os.environ["LLM_PROVIDER"] = "mock"

try:
    from app.services.compliance_engine import compliance_engine
    print("Running Compliance Engine validation tests...")
    compliance_engine.run_validation_scenarios_and_report()
    print("Validation tests completed successfully! Report generated at semantic_validation_report.md.")
except Exception as e:
    import traceback
    print(f"Error during validation: {e}")
    traceback.print_exc()
    sys.exit(1)
