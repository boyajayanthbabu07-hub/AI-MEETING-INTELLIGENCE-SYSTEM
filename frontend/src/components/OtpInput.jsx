import { useRef, useEffect } from "react";

export default function OtpInput({ length = 6, value = "", onChange, disabled = false }) {
  const inputRefs = useRef([]);

  // Ensure value array has length elements
  const digits = value.split("").slice(0, length);
  while (digits.length < length) {
    digits.push("");
  }

  useEffect(() => {
    // Focus first input on mount if empty
    if (!value && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (e, index) => {
    const val = e.target.value;
    if (!val) return;

    // Grab only the last entered char
    const char = val.slice(-1);
    if (!/^\d$/.test(char)) return;

    const newDigits = [...digits];
    newDigits[index] = char;
    const combined = newDigits.join("");
    onChange(combined);

    // Auto-advance to next box
    if (index < length - 1 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0 && inputRefs.current[index - 1]) {
        // Current is empty, backspace moves to previous and clears it
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        onChange(newDigits.join(""));
        inputRefs.current[index - 1].focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = "";
        onChange(newDigits.join(""));
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (!pasteData) return;

    const numericOnly = pasteData.replace(/\D/g, "").slice(0, length);
    if (numericOnly) {
      onChange(numericOnly);
      const focusIndex = Math.min(numericOnly.length, length - 1);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  return (
    <div className="otp-container" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{1}"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          className="otp-box font-mono"
        />
      ))}
    </div>
  );
}
