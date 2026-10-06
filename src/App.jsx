import { useState } from "react";
import PropTypes from "prop-types";
import { Container, Row, Col, Navbar, Nav, NavDropdown } from "react-bootstrap";
import AudioRecorder from "./components/AudioRecorder";
import TranslationHistory from "./components/TranslationHistory";
import ExportOptions from "./components/ExportOptions";
import SettingsModal from "./components/SettingsModal";
import AuthModal from "./components/AuthModal";
import ErrorBoundary from "./components/ErrorBoundary";
import AdminPage from "./components/admin/AdminPage";
import { useHashRoute } from "./hooks/useHashRoute";
import { AudioTranslationProvider } from "./context/AudioTranslationContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./App.css";

// Space is the leader key for history shortcuts. A button that keeps focus after a
// mouse click would be "clicked" again by the Space keyup, so drop focus after mouse
// clicks (detail > 0). Keyboard activation (detail === 0) keeps focus.
function blurAfterMouseClick(e) {
  const button = e.target.closest?.(".record-button, .history-action");
  if (button && e.detail > 0) button.blur();
}

// Login/register (or account + log out) entries for the main menu
function AccountMenuItems({ onLogin }) {
  const { isLoggedIn, user, logout } = useAuth();
  return isLoggedIn ? (
    <>
      <NavDropdown.ItemText className="small text-muted">
        <i className="bi bi-person-check me-2"></i>
        {user ? `Signed in as ${user.username}` : "Signed in"}
      </NavDropdown.ItemText>
      <NavDropdown.Item onClick={logout}>
        <i className="bi bi-box-arrow-right me-2"></i>
        Log out
      </NavDropdown.Item>
    </>
  ) : (
    <NavDropdown.Item onClick={onLogin}>
      <i className="bi bi-person me-2"></i>
      Log in / Register
    </NavDropdown.Item>
  );
}

AccountMenuItems.propTypes = { onLogin: PropTypes.func.isRequired };

function App() {
  const [showAuth, setShowAuth] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const route = useHashRoute();
  const isAdmin = route.path.startsWith("/admin");

  return (
    <ErrorBoundary>
      <AuthProvider>
      <AudioTranslationProvider>
        <div className="App" onClick={blurAfterMouseClick}>
          <Navbar bg="primary" variant="dark" className="mb-3">
            <Container fluid>
              <Navbar.Brand href="#/">🎤 Audio Translator</Navbar.Brand>
              <Nav className="ms-auto">
                <NavDropdown
                  align="end"
                  id="main-menu"
                  title={
                    <>
                      <i className="bi bi-list fs-4 align-middle"></i>
                      <span className="visually-hidden">Menu</span>
                    </>
                  }
                >
                  <NavDropdown.Item href="#/">
                    <i className="bi bi-mic me-2"></i>
                    Record
                  </NavDropdown.Item>
                  <NavDropdown.Item href="#/admin">
                    <i className="bi bi-card-text me-2"></i>
                    Transcripts admin
                  </NavDropdown.Item>
                  <NavDropdown.Item href="#/admin/tags">
                    <i className="bi bi-tags me-2"></i>
                    Tag manager
                  </NavDropdown.Item>
                  <NavDropdown.Divider />
                  <AccountMenuItems onLogin={() => setShowAuth(true)} />
                  <NavDropdown.Divider />
                  <NavDropdown.Item onClick={() => setShowSettings(true)}>
                    <i className="bi bi-gear me-2"></i>
                    Settings
                  </NavDropdown.Item>
                  <NavDropdown.Item onClick={() => setShowExport(true)}>
                    <i className="bi bi-download me-2"></i>
                    Export data
                  </NavDropdown.Item>
                </NavDropdown>
              </Nav>
            </Container>
          </Navbar>

          <Container fluid className="px-2 pb-3">
            {isAdmin ? (
              <AdminPage route={route} />
            ) : (
              <>
                <Row>
                  <Col>
                    <AudioRecorder />
                  </Col>
                </Row>
                <Row className="mt-3">
                  <Col>
                    <TranslationHistory />
                  </Col>
                </Row>
              </>
            )}
          </Container>

          <ExportOptions
            show={showExport}
            onHide={() => setShowExport(false)}
          />
          <AuthModal show={showAuth} onHide={() => setShowAuth(false)} />
          <SettingsModal
            show={showSettings}
            onHide={() => setShowSettings(false)}
          />
        </div>
      </AudioTranslationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
