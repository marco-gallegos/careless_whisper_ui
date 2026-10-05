import { useState } from "react";
import { Container, Row, Col, Navbar, Nav, NavDropdown } from "react-bootstrap";
import AudioRecorder from "./components/AudioRecorder";
import TranslationHistory from "./components/TranslationHistory";
import ExportOptions from "./components/ExportOptions";
import ErrorBoundary from "./components/ErrorBoundary";
import { AudioTranslationProvider } from "./context/AudioTranslationContext";
import "./App.css";

function App() {
  const [showExport, setShowExport] = useState(false);

  return (
    <ErrorBoundary>
      <AudioTranslationProvider>
        <div className="App">
          <Navbar bg="primary" variant="dark" className="mb-3">
            <Container fluid>
              <Navbar.Brand>🎤 Audio Translator</Navbar.Brand>
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
                  <NavDropdown.Item onClick={() => setShowExport(true)}>
                    <i className="bi bi-download me-2"></i>
                    Export data
                  </NavDropdown.Item>
                </NavDropdown>
              </Nav>
            </Container>
          </Navbar>

          <Container fluid className="px-2 pb-3">
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
          </Container>

          <ExportOptions
            show={showExport}
            onHide={() => setShowExport(false)}
          />
        </div>
      </AudioTranslationProvider>
    </ErrorBoundary>
  );
}

export default App;
