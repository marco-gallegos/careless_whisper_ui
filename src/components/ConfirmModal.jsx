import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Modal, Button } from "react-bootstrap";
import { tinykeys, defaultKeybindingsHandlerIgnore } from "tinykeys";

// Yes/No confirmation. Y confirms, N or Esc cancels; "No" has the default focus so a
// stray Enter never confirms.
function ConfirmModal({
  show,
  title,
  children,
  confirmLabel = "Yes",
  onConfirm,
  onCancel,
}) {
  const handlersRef = useRef({});
  useEffect(() => {
    handlersRef.current = { onConfirm, onCancel };
  });

  useEffect(() => {
    if (!show) return;
    return tinykeys(
      window,
      {
        y: (e) => {
          e.preventDefault();
          handlersRef.current.onConfirm?.();
        },
        n: (e) => {
          e.preventDefault();
          handlersRef.current.onCancel?.();
        },
      },
      { ignore: defaultKeybindingsHandlerIgnore }
    );
  }, [show]);

  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h5">{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{children}</Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} autoFocus>
          No <kbd className="kbd-inline ms-1">N</kbd>
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel} <kbd className="kbd-inline ms-1">Y</kbd>
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

ConfirmModal.propTypes = {
  show: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  confirmLabel: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default ConfirmModal;
