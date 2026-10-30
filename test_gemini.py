
import os
import sys
import time
from dotenv import load_dotenv
from google import genai

# --------------------------------------------------
# 1. Load the project's .env file
# --------------------------------------------------

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(PROJECT_DIR, ".env")

load_dotenv(ENV_FILE, override=False)

API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

if not API_KEY or API_KEY == "your_gemini_api_key_here":
    print("ERROR: Gemini API key is missing.")
    print("Please check GEMINI_API_KEY in your project .env file.")
    sys.exit(1)

# --------------------------------------------------
# 2. Initialize Gemini
# --------------------------------------------------

try:
    client = genai.Client(api_key=API_KEY)
except Exception as error:
    print("Failed to initialize Gemini.")
    print(f"{type(error).__name__}: {error}")
    sys.exit(1)

# --------------------------------------------------
# 3. Test the recommended model
# --------------------------------------------------

MODEL_NAME = "gemini-3.8-flash"
MAX_ATTEMPTS = 3

print("=" * 55)
print("AI MEETING INTELLIGENCE - GEMINI API TEST")
print("=" * 55)
print("API key: Found (hidden for security)")
print(f"Model: {MODEL_NAME}")
print("\nTesting Gemini text generation...\n")

for attempt in range(1, MAX_ATTEMPTS + 1):
    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=(
                "Reply with exactly this sentence: "
                "Gemini API connection successful"
            )
        )

        answer = getattr(response, "text", None)

        if answer:
            print("=" * 55)
            print("SUCCESS: GEMINI API IS WORKING!")
            print("=" * 55)
            print("Model:", MODEL_NAME)
            print("Response:", answer)
            print("\nYour API can generate text successfully.")
            sys.exit(0)

        print("Request completed, but no text was returned.")
        print("Response:", response)
        sys.exit(1)

    except Exception as error:
        error_message = str(error)

        print(f"Attempt {attempt}/{MAX_ATTEMPTS} failed.")
        print("Error type:", type(error).__name__)
        print("Details:", error_message)

        is_temporary = (
            "503" in error_message
            or "UNAVAILABLE" in error_message
            or "429" in error_message
            or "RESOURCE_EXHAUSTED" in error_message
            or "500" in error_message
            or "INTERNAL" in error_message
        )

        if is_temporary and attempt < MAX_ATTEMPTS:
            delay = 5 * (2 ** (attempt - 1))
            print(f"\nRetrying in {delay} seconds...\n")
            time.sleep(delay)
            continue

        print("\n" + "=" * 55)
        print("GEMINI API TEST FAILED")
        print("=" * 55)

        if "503" in error_message or "UNAVAILABLE" in error_message:
            print("The model is temporarily unavailable or overloaded.")
            print("Try again later. This does not prove the API key is invalid.")

        elif "429" in error_message or "RESOURCE_EXHAUSTED" in error_message:
            print("Check API quota, rate limits, and billing status.")

        elif "403" in error_message or "PERMISSION_DENIED" in error_message:
            print("Check API permissions, project eligibility, and billing.")

        elif "401" in error_message or "API_KEY_INVALID" in error_message:
            print("Check whether the API key is valid.")

        elif "404" in error_message or "NOT_FOUND" in error_message:
            print("The selected model or endpoint is unavailable.")
            print("Check the current Gemini API model documentation.")

        else:
            print("Review the error details above.")

        sys.exit(1)
