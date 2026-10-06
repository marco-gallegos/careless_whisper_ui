import PropTypes from "prop-types";
import { Badge } from "react-bootstrap";
import { textColorFor } from "../utils/tags";

const FALLBACK_COLOR = "#6c757d";

// A tag pill. Pass `onClick` to make it a toggle button (e.g. a filter chip);
// `active` then controls filled vs outlined.
function TagChip({ name, color = FALLBACK_COLOR, onClick, active = true }) {
  if (!onClick) {
    return (
      <Badge
        pill
        style={{ backgroundColor: color, color: textColorFor(color) }}
        className="me-1 fw-normal"
      >
        {name}
      </Badge>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="btn btn-sm rounded-pill me-1 mb-1"
      style={
        active
          ? { backgroundColor: color, color: textColorFor(color), borderColor: color }
          : { backgroundColor: "transparent", color, borderColor: color }
      }
    >
      {name}
    </button>
  );
}

TagChip.propTypes = {
  name: PropTypes.string.isRequired,
  color: PropTypes.string,
  onClick: PropTypes.func,
  active: PropTypes.bool,
};

export default TagChip;
