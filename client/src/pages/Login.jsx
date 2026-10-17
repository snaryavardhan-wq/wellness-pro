import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../api/client";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(form.email, form.password);
      nav("/");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <form onSubmit={submit} className="auth-card">
        <h1>Welcome back</h1>
        {error && <p className="error">{error}</p>}
        <label>Email
          <input type="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>Password
          <input type="password" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="muted">New here? <Link to="/register">Create an account</Link></p>
      </form>
    </main>
  );
}