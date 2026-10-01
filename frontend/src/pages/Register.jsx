import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const handleRegister = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      const response = await api.post("/api/auth/register", {
        name,
        email,
        password,
      });

      setMessage(
        response.data.message || "Registration successful"
      );

      setTimeout(() => {
        navigate("/login");
      }, 1000);

    } catch (error) {
      if (error.response) {
        setMessage(
          error.response.data.message ||
          "Registration failed"
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

      <h2>Create Account</h2>

      <form onSubmit={handleRegister}>

        <div>
          <label>Name</label>
          <br />

          <input
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="Enter your name"
            required
          />
        </div>

        <br />

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
          Register
        </button>

      </form>

      {message && <p>{message}</p>}

      <br />

      <button onClick={() => navigate("/login")}>
        Back to Login
      </button>
    </div>
  );
}

export default Register;