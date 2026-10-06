import { useState } from "react";
import PropTypes from "prop-types";
import { Alert, Button, Card, Form, InputGroup, ListGroup } from "react-bootstrap";
import { useAudioTranslation } from "../../context/AudioTranslationContext";
import ConfirmModal from "../ConfirmModal";
import TagChip from "../TagChip";
import { MAX_TAG_LENGTH, TAG_COLORS, nextTagColor } from "../../utils/tags";

function ColorSwatches({ value, onChange }) {
  return (
    <div className="d-flex flex-wrap gap-1" role="radiogroup" aria-label="Tag color">
      {TAG_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className="border-0 rounded-circle"
          style={{
            width: 28,
            height: 28,
            backgroundColor: c,
            outline: value === c ? "3px solid #212529" : "none",
            outlineOffset: 2,
          }}
        />
      ))}
    </div>
  );
}

ColorSwatches.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

function TagManager() {
  const { tags, translations, createTag, updateTag, deleteTag } = useAudioTranslation();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(null);
  const [addError, setAddError] = useState("");

  const [editing, setEditing] = useState(null); // { name, newName, color }
  const [editError, setEditError] = useState("");
  const [deleting, setDeleting] = useState(null); // tag name
  const [rowError, setRowError] = useState("");

  const usage = (name) => {
    const records = translations.filter((t) => t.tags?.includes(name));
    return { total: records.length, favorites: records.filter((t) => t.favorite).length };
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await createTag(newName, newColor || nextTagColor(tags));
      setNewName("");
      setNewColor(null);
      setAddError("");
    } catch (err) {
      setAddError(err.message);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await updateTag(editing.name, { name: editing.newName, color: editing.color });
      setEditing(null);
      setEditError("");
    } catch (err) {
      setEditError(err.message);
    }
  };

  const confirmDelete = async () => {
    const name = deleting;
    setDeleting(null);
    try {
      await deleteTag(name);
      setRowError("");
    } catch (err) {
      setRowError(`Failed to delete "${name}": ${err.message}`);
    }
  };

  const deletingUsage = deleting ? usage(deleting) : null;

  return (
    <>
      <Card className="mb-3">
        <Card.Header>
          <h5 className="mb-0">New tag</h5>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleAdd}>
            <InputGroup className="mb-2">
              <Form.Control
                placeholder="Tag name"
                value={newName}
                maxLength={MAX_TAG_LENGTH + 10}
                onChange={(e) => setNewName(e.target.value)}
                aria-label="Tag name"
              />
              <Button type="submit" variant="primary" disabled={!newName.trim()}>
                Add tag
              </Button>
            </InputGroup>
            <ColorSwatches value={newColor || nextTagColor(tags)} onChange={setNewColor} />
            {addError && <div className="text-danger small mt-2">{addError}</div>}
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Tags</h5>
          <small className="text-muted">{tags.length} total</small>
        </Card.Header>
        {rowError && (
          <Alert variant="danger" className="m-3 mb-0" dismissible onClose={() => setRowError("")}>
            {rowError}
          </Alert>
        )}
        {tags.length === 0 ? (
          <Card.Body className="text-muted">
            No tags yet. Create one above, then assign it to a favorite from the Transcripts tab.
          </Card.Body>
        ) : (
          <ListGroup variant="flush">
            {tags.map((tag) => {
              const u = usage(tag.name);
              const isEditing = editing?.name === tag.name;
              return (
                <ListGroup.Item key={tag.name}>
                  {isEditing ? (
                    <>
                      <InputGroup className="mb-2">
                        <Form.Control
                          value={editing.newName}
                          onChange={(e) => setEditing({ ...editing, newName: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") setEditing(null);
                          }}
                          aria-label="Tag name"
                          autoFocus
                        />
                      </InputGroup>
                      <ColorSwatches
                        value={editing.color}
                        onChange={(color) => setEditing({ ...editing, color })}
                      />
                      {editError && <div className="text-danger small mt-2">{editError}</div>}
                      <div className="d-flex gap-2 mt-2">
                        <Button size="sm" className="history-action" onClick={handleSaveEdit}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          className="history-action"
                          onClick={() => {
                            setEditing(null);
                            setEditError("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
                      <div>
                        <TagChip name={tag.name} color={tag.color} />
                        <small className="text-muted ms-2">
                          {u.total} transcript{u.total === 1 ? "" : "s"} · {u.favorites} favorite
                          {u.favorites === 1 ? "" : "s"}
                        </small>
                      </div>
                      <div className="d-flex gap-1">
                        <Button
                          as="a"
                          href={`#/admin?fav=1&tag=${encodeURIComponent(tag.name)}`}
                          variant="outline-primary"
                          size="sm"
                          className="history-action"
                          title="Show favorites with this tag"
                        >
                          <i className="bi bi-funnel me-1"></i>
                          Favorites
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="history-action"
                          onClick={() => {
                            setEditing({ name: tag.name, newName: tag.name, color: tag.color });
                            setEditError("");
                          }}
                          aria-label={`Edit ${tag.name}`}
                          title="Rename or recolor"
                        >
                          <i className="bi bi-pencil"></i>
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          className="history-action"
                          onClick={() => setDeleting(tag.name)}
                          aria-label={`Delete ${tag.name}`}
                          title="Delete tag"
                        >
                          <i className="bi bi-trash"></i>
                        </Button>
                      </div>
                    </div>
                  )}
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        )}
      </Card>

      <ConfirmModal
        show={deleting !== null}
        title="Delete this tag?"
        confirmLabel="Yes, delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      >
        {deleting && (
          <>
            <p>
              <TagChip name={deleting} color={tags.find((t) => t.name === deleting)?.color} />
            </p>
            <p className="mb-0">
              It will be removed from {deletingUsage.total} transcript
              {deletingUsage.total === 1 ? "" : "s"}. The transcripts themselves are kept. This
              cannot be undone.
            </p>
          </>
        )}
      </ConfirmModal>
    </>
  );
}

export default TagManager;
