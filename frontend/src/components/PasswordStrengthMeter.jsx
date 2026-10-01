export default function PasswordStrengthMeter({ password = "" }) {
  if (!password) return null;

  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

  let label = "Weak";
  let activeClass = "active-weak";
  let labelColor = "var(--accent-rose)";

  if (score === 2) {
    label = "Fair";
    activeClass = "active-fair";
    labelColor = "var(--accent-amber)";
  } else if (score === 3) {
    label = "Good";
    activeClass = "active-good";
    labelColor = "var(--primary)";
  } else if (score >= 4) {
    label = "Strong";
    activeClass = "active-strong";
    labelColor = "var(--accent-emerald)";
  }

  return (
    <div>
      <div className="strength-meter">
        <div className={`strength-bar ${score >= 1 ? activeClass : ""}`} />
        <div className={`strength-bar ${score >= 2 ? activeClass : ""}`} />
        <div className={`strength-bar ${score >= 3 ? activeClass : ""}`} />
        <div className={`strength-bar ${score >= 4 ? activeClass : ""}`} />
      </div>
      <div className="strength-label" style={{ color: labelColor }}>
        {label}
      </div>
    </div>
  );
}
