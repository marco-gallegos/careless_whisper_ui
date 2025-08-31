import { Container, Row, Col, Navbar } from "react-bootstrap";
import AudioRecorder from "./components/AudioRecorder";
import TranslationHistory from "./components/TranslationHistory";
import ExportOptions from "./components/ExportOptions";
import ErrorBoundary from "./components/ErrorBoundary";
import { AudioTranslationProvider } from "./context/AudioTranslationContext";
import "./App.css";

function App() {
  return (
    <ErrorBoundary>
      <AudioTranslationProvider>
        <div className="App">
          <Navbar bg="primary" variant="dark" className="mb-4">
            <Container>
              <Navbar.Brand>🎤 Audio Translator</Navbar.Brand>
            </Container>
          </Navbar>

          <Container>
            <Row>
              <Col lg={6}>
                <AudioRecorder />
              </Col>
              <Col lg={6}>
                <ExportOptions />
              </Col>
            </Row>
            <Row className="mt-4">
              <Col>
                <TranslationHistory />
              </Col>
            </Row>
          </Container>
        </div>
      </AudioTranslationProvider>
    </ErrorBoundary>
  );
}

export default App;
