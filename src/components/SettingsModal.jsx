import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Modal, Button, Form, Alert, Badge } from "react-bootstrap";
import {
  blankSettings,
  clearOverrides,
  getEnvDefaults,
  loadOverrides,
  saveOverrides,
} from "../services/settings";
import { providers } from "../services/translationService";

// Settings form. Every input starts empty when there is no override; the placeholder
// shows the value that will be used instead (from .env or the provider default).
function SettingsModal({ show, onHide }) {
  const [form, setForm] = useState(blankSettings);
  const [error, setError] = useState("");
  const defaults = getEnvDefaults();

  useEffect(() => {
    if (show) {
      setForm(loadOverrides());
      setError("");
    }
  }, [show]);

  const set = (section, field) => (e) =>
    setForm((f) => ({ ...f, [section]: { ...f[section], [field]: e.target.value } }));

  const effectiveProvider =
    form.transcription.provider || defaults.transcription.provider || "local";
  const providerDefaults = providers[effectiveProvider] || providers.local;

  const field = (section, name, label, { placeholder = "", type = "text", help } = {}) => (
    <Form.Group className="mb-3" controlId={`settings-${section}-${name}`}>
      <Form.Label className="d-flex justify-content-between">
        <span>{label}</span>
        {form[section][name] && (
          <Badge bg="info" text="dark">
            overridden
          </Badge>
        )}
      </Form.Label>
      <Form.Control
        type={type}
        value={form[section][name]}
        onChange={set(section, name)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {help && <Form.Text className="text-muted">{help}</Form.Text>}
    </Form.Group>
  );

  const handleSave = () => {
    try {
      saveOverrides(form);
      onHide();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleReset = () => {
    clearOverrides();
    setForm(blankSettings());
    setError("");
  };

  return (
    <Modal show={show} onHide={onHide} centered scrollable fullscreen="lg-down">
      <Modal.Header closeButton>
        <Modal.Title as="h5">Settings</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small">
          Leave a field empty to use its default (from <code>.env</code>). Values you
          enter here override the defaults and are stored in this browser only
          (including API keys, in plain text).
        </p>

        <h6>Transcription</h6>
        <Form.Group className="mb-3" controlId="settings-transcription-provider">
          <Form.Label className="d-flex justify-content-between">
            <span>Provider</span>
            {form.transcription.provider && (
              <Badge bg="info" text="dark">
                overridden
              </Badge>
            )}
          </Form.Label>
          <Form.Select
            value={form.transcription.provider}
            onChange={set("transcription", "provider")}
          >
            <option value="">Default ({defaults.transcription.provider || "local"})</option>
            {Object.keys(providers).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        {field("transcription", "url", "Base URL", {
          placeholder: defaults.transcription.url || providerDefaults.defaultUrl,
        })}
        {field("transcription", "model", "Model", {
          placeholder: defaults.transcription.model || providerDefaults.defaultModel,
        })}
        {field("transcription", "apiKey", "API key", {
          type: "password",
          placeholder: defaults.transcription.apiKey ? "•••••• (from .env)" : "none",
        })}

        <hr />
        <h6>Translation endpoint</h6>
        {field("translate", "url", "URL", {
          placeholder: defaults.translate.url || "https://example.com/translate",
          help: "Called with POST and a JSON body (text, target_language).",
        })}
        {field("translate", "targetLanguage", "Target language", {
          placeholder: defaults.translate.targetLanguage,
        })}
        {field("translate", "apiKey", "API key", {
          type: "password",
          placeholder: defaults.translate.apiKey ? "•••••• (from .env)" : "none",
        })}

        <hr />
        <h6>Agent endpoint</h6>
        {field("agent", "url", "URL", {
          placeholder: defaults.agent.url || "https://example.com/agent",
          help: "Called with POST and a JSON body (text = the transcript as an instruction).",
        })}
        {field("agent", "apiKey", "API key", {
          type: "password",
          placeholder: defaults.agent.apiKey ? "•••••• (from .env)" : "none",
        })}

        {error && <Alert variant="danger">{error}</Alert>}
      </Modal.Body>
      <Modal.Footer className="justify-content-between">
        <Button variant="outline-danger" onClick={handleReset}>
          Reset to defaults
        </Button>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}

SettingsModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
};

export default SettingsModal;
