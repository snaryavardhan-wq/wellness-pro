import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../api/client";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register(form.name, form.email, form.password);
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
        <h1>Create your account</h1>
        {error && <p className="error">{error}</p>}
        <label>Name<input required value={form.name} onChange={set("name")} /></label>
        <label>Email<input type="email" required value={form.email} onChange={set("email")} /></label>
        <label>Password
          <input type="password" required minLength={8} value={form.password} onChange={set("password")} />
        </label>
        <button disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        <p className="muted">Already registered? <Link to="/login">Sign in</Link></p>
      </form>
    </main>
  );
}