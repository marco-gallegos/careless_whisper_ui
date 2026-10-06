import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Badge, Button, Card, Form, ListGroup } from "react-bootstrap";
import { useAudioTranslation } from "../../context/AudioTranslationContext";
import ConfirmModal from "../ConfirmModal";
import TagChip from "../TagChip";
import TagPickerModal from "./TagPickerModal";

const SNIPPET = 160;

function TranscriptsAdmin({ initialQuery }) {
  const {
    translations,
    tags,
    toggleFavorite,
    setRecordTags,
    createTag,
    deleteTranslation,
    copyToClipboard,
  } = useAudioTranslation();

  // Filters can be preselected from the URL (e.g. the tag manager's "View favorites" link)
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(initialQuery.get("fav") === "1");
  const [selectedTags, setSelectedTags] = useState(() =>
    initialQuery.get("tag") ? [initialQuery.get("tag")] : []
  );
  const [sort, setSort] = useState("newest");
  const [taggingId, setTaggingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const tagByName = useMemo(() => new Map(tags.map((t) => [t.name, t])), [tags]);
  const favoriteCount = translations.filter((t) => t.favorite).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return translations
      .filter((t) => {
        if (favoritesOnly && !t.favorite) return false;
        // Tag filter matches records having ANY of the selected tags
        if (selectedTags.length && !(t.tags || []).some((x) => selectedTags.includes(x))) {
          return false;
        }
        if (!q) return true;
        return [t.text, t.translatedText, t.agentResponse, ...(t.tags || [])]
          .filter(Boolean)
          .some((s) => s.toLowerCase().includes(q));
      })
      .sort((a, b) =>
        sort === "newest"
          ? b.timestamp.localeCompare(a.timestamp)
          : a.timestamp.localeCompare(b.timestamp)
      );
  }, [translations, favoritesOnly, selectedTags, search, sort]);

  const toggleTagFilter = (name) =>
    setSelectedTags((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  const hasFilters = search || favoritesOnly || selectedTags.length > 0;
  const clearFilters = () => {
    setSearch("");
    setFavoritesOnly(false);
    setSelectedTags([]);
  };

  const handleCopy = async (t) => {
    if (await copyToClipboard(t.text)) {
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const taggingRecord = translations.find((t) => t.id === taggingId);
  const deletingRecord = translations.find((t) => t.id === deletingId);

  const confirmDelete = async () => {
    const id = deletingId;
    setDeletingId(null);
    await deleteTranslation(id);
  };

  return (
    <>
      <Card className="mb-3">
        <Card.Body>
          <div className="row g-2 align-items-center">
            <div className="col-12 col-lg">
              <Form.Control
                type="search"
                placeholder="Search transcripts, translations, agent replies, tags…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search"
              />
            </div>
            <div className="col-6 col-lg-auto">
              <Form.Check
                type="switch"
                id="favorites-only"
                label={`Favorites only (${favoriteCount})`}
                checked={favoritesOnly}
                onChange={(e) => setFavoritesOnly(e.target.checked)}
              />
            </div>
            <div className="col-6 col-lg-auto">
              <Form.Select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort order"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </Form.Select>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="mt-3">
              <small className="text-muted d-block mb-1">
                Filter by tag (matches any selected)
              </small>
              {tags.map((tag) => (
                <TagChip
                  key={tag.name}
                  name={tag.name}
                  color={tag.color}
                  active={selectedTags.includes(tag.name)}
                  onClick={() => toggleTagFilter(tag.name)}
                />
              ))}
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center mt-2">
            <small className="text-muted">
              Showing {filtered.length} of {translations.length}
            </small>
            {hasFilters && (
              <Button variant="link" size="sm" className="p-0" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>

      {filtered.length === 0 ? (
        <Alert variant="info" className="text-center">
          {translations.length === 0
            ? "No transcripts yet. Record something on the home page."
            : "No transcripts match these filters."}
        </Alert>
      ) : (
        <ListGroup>
          {filtered.map((t) => (
            <ListGroup.Item key={t.id} className="d-flex gap-2 align-items-start">
              <Button
                variant="link"
                className="history-action p-0 text-warning fs-4 lh-1"
                onClick={() => toggleFavorite(t.id)}
                aria-pressed={!!t.favorite}
                aria-label={t.favorite ? "Remove from favorites" : "Add to favorites"}
                title={t.favorite ? "Remove from favorites" : "Add to favorites"}
              >
                <i className={`bi ${t.favorite ? "bi-star-fill" : "bi-star"}`}></i>
              </Button>

              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <div style={{ overflowWrap: "anywhere" }}>
                  {t.status === "failed" || t.status === "pending" ? (
                    <Badge bg={t.status === "failed" ? "warning" : "secondary"} text="dark">
                      {t.status === "failed" ? "Not transcribed" : "Transcribing..."}
                    </Badge>
                  ) : t.text ? (
                    t.text.length > SNIPPET ? t.text.slice(0, SNIPPET) + "…" : t.text
                  ) : (
                    <em className="text-muted">(no speech detected)</em>
                  )}
                </div>
                <small className="text-muted d-block">
                  {new Date(t.timestamp).toLocaleString()}
                </small>
                <div className="mt-1">
                  {(t.tags || []).map((name) => (
                    <TagChip key={name} name={name} color={tagByName.get(name)?.color} />
                  ))}
                </div>
              </div>

              <div className="d-flex flex-column flex-xl-row gap-1">
                <Button
                  variant="outline-primary"
                  size="sm"
                  className="history-action"
                  disabled={!t.favorite}
                  onClick={() => setTaggingId(t.id)}
                  title={t.favorite ? "Edit tags" : "Favorite this transcript to tag it"}
                  aria-label="Edit tags"
                >
                  <i className="bi bi-tags"></i>
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="history-action"
                  disabled={!t.text}
                  onClick={() => handleCopy(t)}
                  title="Copy transcript"
                  aria-label="Copy transcript"
                >
                  <i className={`bi ${copiedId === t.id ? "bi-check-lg" : "bi-clipboard"}`}></i>
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  className="history-action"
                  onClick={() => setDeletingId(t.id)}
                  title="Delete"
                  aria-label="Delete"
                >
                  <i className="bi bi-trash"></i>
                </Button>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}

      <TagPickerModal
        show={taggingId !== null && !!taggingRecord}
        record={taggingRecord}
        tags={tags}
        onSave={setRecordTags}
        onCreateTag={createTag}
        onHide={() => setTaggingId(null)}
      />

      <ConfirmModal
        show={deletingId !== null && !!deletingRecord}
        title="Delete this recording?"
        confirmLabel="Yes, delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      >
        {deletingRecord && (
          <>
            <p className="mb-2 text-muted small">
              {new Date(deletingRecord.timestamp).toLocaleString()}
              {deletingRecord.favorite && " · ★ favorite"}
            </p>
            <p>
              {(deletingRecord.text || "(no transcript)").slice(0, 140)}
            </p>
            <p className="mb-0">
              This removes the saved audio and its transcript. This cannot be undone.
            </p>
          </>
        )}
      </ConfirmModal>
    </>
  );
}

TranscriptsAdmin.propTypes = {
  initialQuery: PropTypes.instanceOf(URLSearchParams).isRequired,
};

export default TranscriptsAdmin;
