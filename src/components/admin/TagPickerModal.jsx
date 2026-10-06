import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Modal, Button, Form, InputGroup } from "react-bootstrap";
import TagChip from "../TagChip";

// Pick which tags a favorite has; can also create a tag on the spot.
function TagPickerModal({ show, record, tags, onSave, onCreateTag, onHide }) {
  const [selected, setSelected] = useState([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      setSelected(record?.tags || []);
      setNewName("");
      setError("");
    }
  }, [show, record]);

  const toggle = (name) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const tag = await onCreateTag(newName);
      setSelected((s) => [...s, tag.name]);
      setNewName("");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(record.id, selected);
      onHide();
    } catch (e) {
      setError("Failed to save tags: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h5">Tags</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {record?.text && (
          <p className="text-muted small fst-italic">
            “{record.text.length > 120 ? record.text.slice(0, 120) + "…" : record.text}”
          </p>
        )}

        {tags.length === 0 ? (
          <p className="text-muted">No tags yet. Create the first one below.</p>
        ) : (
          <div className="mb-3">
            {tags.map((tag) => (
              <TagChip
                key={tag.name}
                name={tag.name}
                color={tag.color}
                active={selected.includes(tag.name)}
                onClick={() => toggle(tag.name)}
              />
            ))}
          </div>
        )}

        <InputGroup>
          <Form.Control
            placeholder="New tag"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            aria-label="New tag name"
          />
          <Button variant="outline-primary" onClick={handleCreate} disabled={!newName.trim()}>
            Add
          </Button>
        </InputGroup>
        {error && <div className="text-danger small mt-2">{error}</div>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

TagPickerModal.propTypes = {
  show: PropTypes.bool.isRequired,
  record: PropTypes.object,
  tags: PropTypes.array.isRequired,
  onSave: PropTypes.func.isRequired,
  onCreateTag: PropTypes.func.isRequired,
  onHide: PropTypes.func.isRequired,
};

export default TagPickerModal;
