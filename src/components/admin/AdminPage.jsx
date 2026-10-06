import PropTypes from "prop-types";
import { Alert, Nav } from "react-bootstrap";
import { useAudioTranslation } from "../../context/AudioTranslationContext";
import TranscriptsAdmin from "./TranscriptsAdmin";
import TagManager from "./TagManager";

// Admin area: #/admin (transcripts: search, favorites, tag filter) and #/admin/tags (tag manager)
function AdminPage({ route }) {
  const { error, clearError } = useAudioTranslation();
  const onTags = route.path.startsWith("/admin/tags");

  return (
    <>
      <h4 className="mb-3">Transcripts admin</h4>

      <Nav variant="tabs" className="mb-3">
        <Nav.Item>
          <Nav.Link href="#/admin" active={!onTags}>
            <i className="bi bi-card-text me-1"></i>
            Transcripts
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link href="#/admin/tags" active={onTags}>
            <i className="bi bi-tags me-1"></i>
            Tag manager
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {error && (
        <Alert variant="danger" dismissible onClose={clearError}>
          {error}
        </Alert>
      )}

      {onTags ? (
        <TagManager />
      ) : (
        // Remount when the query changes so links like #/admin?fav=1&tag=x preselect filters
        <TranscriptsAdmin key={route.query.toString()} initialQuery={route.query} />
      )}
    </>
  );
}

AdminPage.propTypes = {
  route: PropTypes.shape({
    path: PropTypes.string.isRequired,
    query: PropTypes.instanceOf(URLSearchParams).isRequired,
  }).isRequired,
};

export default AdminPage;
