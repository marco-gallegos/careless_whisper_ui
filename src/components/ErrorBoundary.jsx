import { Component } from 'react'
import { Alert, Button, Container } from 'react-bootstrap'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container className="mt-5">
          <Alert variant="danger">
            <Alert.Heading>Something went wrong!</Alert.Heading>
            <p>
              The application encountered an unexpected error. Please try refreshing the page.
            </p>
            <hr />
            <div className="d-flex justify-content-end">
              <Button 
                variant="outline-danger"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            </div>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-3">
                <summary>Error Details (Development Mode)</summary>
                <pre className="mt-2 p-2 bg-light border rounded">
                  {this.state.error && this.state.error.toString()}
                  <br />
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </Alert>
        </Container>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary