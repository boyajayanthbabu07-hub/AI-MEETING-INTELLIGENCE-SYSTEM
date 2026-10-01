import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      const response = await api.post("/api/auth/login", {
        email,
        password,
      });

      localStorage.setItem(
        "access_token",
        response.data.access_token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(response.data.user)
      );

      setMessage("Login successful");

      navigate("/dashboard");
    } catch (error) {
      if (error.response) {
        setMessage(
          error.response.data.message ||
          "Login failed"
        );
      } else {
        setMessage(
          "Unable to connect to the backend"
        );
      }
    }
  };

  return (
    <div>
      <h1>AI Meeting Intelligence System</h1>

      <h2>Login</h2>

      <form onSubmit={handleLogin}>

        <div>
          <label>Email</label>
          <br />

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="Enter your email"
            required
          />
        </div>

        <br />

        <div>
          <label>Password</label>
          <br />

          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Enter your password"
            required
          />
        </div>

        <br />

        <button type="submit">
          Login
        </button>

      </form>

      {message && (
        <p>{message}</p>
      )}

      <p>
        Don't have an account?{" "}
        <Link to="/register">
          Register
        </Link>
      </p>
    </div>
  );
}

export default Login;