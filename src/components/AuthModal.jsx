import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Modal, Button, Form, Alert, Nav, Spinner } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";
import { accountsAvailable } from "../services/api";

// Optional account: logging in lets transcripts be stored on the API.
function AuthModal({ show, onHide }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (show) {
      setPassword("");
      setError("");
    }
  }, [show]);

  const isRegister = mode === "register";
  const available = accountsAvailable();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await (isRegister ? register : login)(username.trim(), password);
      setPassword("");
      onHide();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Account</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            Optional. Log in to store transcripts on the API; the app keeps working
            locally without an account.
          </p>
          {!available && (
            <Alert variant="warning">
              Accounts are only available with the local transcription provider.
              Change it in Settings.
            </Alert>
          )}
          <Nav
            variant="tabs"
            activeKey={mode}
            onSelect={(k) => {
              setMode(k);
              setError("");
            }}
            className="mb-3"
          >
            <Nav.Item>
              <Nav.Link eventKey="login">Log in</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="register">Register</Nav.Link>
            </Nav.Item>
          </Nav>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3" controlId="auth-username">
            <Form.Label>Username</Form.Label>
            <Form.Control
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              minLength={3}
              maxLength={64}
              required
              autoFocus
            />
          </Form.Group>
          <Form.Group controlId="auth-password">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={isRegister ? 8 : undefined}
              maxLength={72}
              required
            />
            {isRegister && (
              <Form.Text className="text-muted">8 to 72 characters.</Form.Text>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !available}>
            {busy && <Spinner size="sm" className="me-2" />}
            {isRegister ? "Register" : "Log in"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

AuthModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
};

export default AuthModal;
