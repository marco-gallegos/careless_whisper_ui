import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import PropTypes from "prop-types";
import { audioTranslationDB } from "../services/database";
import { resolveConfig, transcribeAudio } from "../services/translationService";
import * as api from "../services/api";
import { useAuth } from "./AuthContext";
import { translateText, sendToAgent } from "../services/actionService";
import {
  normalizeTagName,
  validateTagName,
  nextTagColor,
} from "../utils/tags";

const AudioTranslationContext = createContext();

const initialState = {
  translations: [], // local (IndexedDB) records
  meta: {}, // client-side extras for API records, by remoteId (favorite, translation, ...)
  remote: [], // records stored on the API, shaped like local ones (see api.toRecord)
  savingId: null, // local record being saved to the account
  tags: [], // [{ name, color, createdAt }]
  isRecording: false,
  isTranslating: false,
  lastTranslation: null,
  error: null,
  actionBusy: null, // { id, kind } while a translate/agent call is in flight
};

function audioTranslationReducer(state, action) {
  switch (action.type) {
    case "SET_TRANSLATIONS":
      return { ...state, translations: action.payload };
    case "ADD_TRANSLATION":
      return {
        ...state,
        translations: [action.payload, ...state.translations],
        lastTranslation: action.payload,
      };
    case "SET_REMOTE":
      return { ...state, remote: action.payload };
    case "SET_META":
      return { ...state, meta: { ...state.meta, [action.payload.remoteId]: action.payload } };
    case "SET_ALL_META":
      return { ...state, meta: action.payload };
    case "SET_SAVING":
      return { ...state, savingId: action.payload };
    case "SET_RECORDING":
      return { ...state, isRecording: action.payload };
    case "SET_TRANSLATING":
      return { ...state, isTranslating: action.payload };
    case "UPDATE_TRANSLATION":
      return {
        ...state,
        translations: state.translations.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      };
    case "SET_TAGS":
      return { ...state, tags: action.payload };
    // Merge fields into one record without reloading (and re-blobbing) all audio
    case "PATCH_TRANSLATION":
      return {
        ...state,
        translations: state.translations.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload } : t
        ),
      };
    case "SET_ACTION_BUSY":
      return { ...state, actionBusy: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

export function AudioTranslationProvider({ children }) {
  const [state, dispatch] = useReducer(audioTranslationReducer, initialState);
  const auth = useAuth();
  // Async callbacks (e.g. the recorder's onstop) outlive the render that created them
  const authRef = useRef(auth);
  authRef.current = auth;
  const { token, logout } = auth;

  useEffect(() => {
    loadTranslations();
    loadTags();
    audioTranslationDB
      .getAllMeta()
      .then((meta) => dispatch({ type: "SET_ALL_META", payload: meta }))
      .catch(() => {});

    // Cleanup function to revoke blob URLs when component unmounts
    return () => {
      state.translations.forEach((translation) => {
        if (translation.audioUrl) {
          URL.revokeObjectURL(translation.audioUrl);
        }
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTranslations = async () => {
    try {
      const translations = await audioTranslationDB.getAll();
      dispatch({ type: "SET_TRANSLATIONS", payload: translations });
    } catch {
      dispatch({ type: "SET_ERROR", payload: "Failed to load translations" });
    }
  };

  // A 401 means the saved login expired: drop it and say so
  const handleApiError = useCallback(
    (error, prefix) => {
      if (error.status === 401) {
        logout();
        dispatch({
          type: "SET_ERROR",
          payload: "Your session expired. Log in again to use your account.",
        });
      } else {
        dispatch({ type: "SET_ERROR", payload: `${prefix}: ${error.message}` });
      }
    },
    [logout]
  );

  const loadRemote = useCallback(async () => {
    const current = authRef.current.token;
    if (!current) return dispatch({ type: "SET_REMOTE", payload: [] });
    try {
      const rows = await api.listTranscripts(current);
      dispatch({ type: "SET_REMOTE", payload: rows.map(api.toRecord) });
    } catch (error) {
      handleApiError(error, "Failed to load account transcripts");
    }
  }, [handleApiError]);

  // Fetch on login / app start; clear on logout
  useEffect(() => {
    loadRemote();
  }, [token, loadRemote]);

  // What the history shows: API records plus local ones. A local record that already
  // has a server copy (remoteId) is hidden, so the API version always wins.
  const records = useMemo(() => {
    const onServer = new Set(state.remote.map((r) => r.remoteId));
    const local = state.translations
      .filter((t) => !onServer.has(t.remoteId))
      .map((t) => ({ ...t, source: "local" }));
    const remote = state.remote.map((r) => ({ ...state.meta[r.remoteId], ...r }));
    return [...remote, ...local].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
  }, [state.remote, state.translations, state.meta]);

  // Save fields on a record wherever it lives: IndexedDB for local ones, the
  // client-side overlay for API ones (the API itself only stores text).
  const patchRecord = async (record, fields) => {
    if (record.source === "api") {
      const next = await audioTranslationDB.patchMeta(record.remoteId, fields);
      dispatch({ type: "SET_META", payload: next });
    } else {
      await audioTranslationDB.update(record.id, fields);
      await loadTranslations();
    }
  };

  const loadTags = async () => {
    try {
      dispatch({ type: "SET_TAGS", payload: await audioTranslationDB.getTags() });
    } catch {
      dispatch({ type: "SET_ERROR", payload: "Failed to load tags" });
    }
  };

  // --- Favorites & tags -----------------------------------------------------
  const toggleFavorite = async (id) => {
    const record = records.find((t) => t.id === id);
    if (!record) return;
    const favorite = !record.favorite;
    try {
      if (record.source === "api") await patchRecord(record, { favorite });
      else {
        await audioTranslationDB.setFavorite(id, favorite);
        dispatch({ type: "PATCH_TRANSLATION", payload: { id, favorite } });
      }
    } catch {
      dispatch({ type: "SET_ERROR", payload: "Failed to update favorite" });
    }
  };

  const setRecordTags = async (id, tags) => {
    await audioTranslationDB.setRecordTags(id, tags);
    dispatch({ type: "PATCH_TRANSLATION", payload: { id, tags } });
  };

  // The tag actions below throw on invalid input so forms can show the message inline.
  const createTag = async (name, color) => {
    const problem = validateTagName(name, state.tags);
    if (problem) throw new Error(problem);
    const tag = {
      name: normalizeTagName(name),
      color: color || nextTagColor(state.tags),
      createdAt: new Date().toISOString(),
    };
    await audioTranslationDB.addTag(tag);
    dispatch({
      type: "SET_TAGS",
      payload: [...state.tags, tag].sort((a, b) => a.name.localeCompare(b.name)),
    });
    return tag;
  };

  const updateTag = async (oldName, { name, color }) => {
    const newName = normalizeTagName(name ?? oldName);
    const problem = validateTagName(newName, state.tags, oldName);
    if (problem) throw new Error(problem);

    if (newName !== oldName) {
      await audioTranslationDB.renameTag(oldName, newName);
      dispatch({
        type: "SET_TRANSLATIONS",
        payload: state.translations.map((t) =>
          t.tags?.includes(oldName)
            ? {
                ...t,
                tags: [
                  ...new Set(t.tags.map((x) => (x === oldName ? newName : x))),
                ],
              }
            : t
        ),
      });
    }
    if (color) await audioTranslationDB.updateTagColor(newName, color);

    dispatch({
      type: "SET_TAGS",
      payload: state.tags
        .map((t) =>
          t.name === oldName ? { ...t, name: newName, color: color || t.color } : t
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  };

  const deleteTag = async (name) => {
    await audioTranslationDB.deleteTag(name);
    dispatch({
      type: "SET_TAGS",
      payload: state.tags.filter((t) => t.name !== name),
    });
    dispatch({
      type: "SET_TRANSLATIONS",
      payload: state.translations.map((t) =>
        t.tags?.includes(name)
          ? { ...t, tags: t.tags.filter((x) => x !== name) }
          : t
      ),
    });
  };

  // Transcribe a stored recording and persist the outcome on its record.
  // Failure is not an error state for the app: the recording stays saved with
  // status "failed" so the user can retry from the UI.
  const transcribeRecord = async (id, audioBlob) => {
    dispatch({ type: "SET_TRANSLATING", payload: true });
    try {
      const { token: current, storeOnRecord } = authRef.current;
      const { text, remoteId } = await transcribeAudio(audioBlob, {
        token: storeOnRecord ? current : null,
      });
      await audioTranslationDB.update(id, {
        text,
        status: "done",
        error: null,
        ...(remoteId != null && { remoteId }),
      });
      // Stored on the API: the API copy is the one that is kept
      if (remoteId != null) await audioTranslationDB.delete(id);
      await loadTranslations();
      if (remoteId != null) await loadRemote();
      if (text) await copyToClipboard(text);
    } catch (error) {
      if (error.status === 401 && authRef.current.token) {
        handleApiError(error, "Transcription failed");
      }
      try {
        await audioTranslationDB.update(id, {
          status: "failed",
          error: error.message,
        });
        await loadTranslations();
      } catch {
        dispatch({
          type: "SET_ERROR",
          payload: "Failed to update recording: " + error.message,
        });
      }
    } finally {
      dispatch({ type: "SET_TRANSLATING", payload: false });
    }
  };

  // record -> save locally -> try to transcribe
  const addTranslation = async (audioBlob, recordingDuration = 0) => {
    const id = Date.now();
    try {
      dispatch({ type: "CLEAR_ERROR" });

      // Calculate audio duration if not provided
      const duration = recordingDuration || (await getAudioDuration(audioBlob));

      // 1. Save the recording first so it is never lost
      await audioTranslationDB.add({
        id,
        audioBlob, // This will be converted to ArrayBuffer in the database
        text: "",
        status: "pending",
        error: null,
        timestamp: new Date().toISOString(),
        duration,
      });
      await loadTranslations();
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: "Failed to save recording: " + error.message,
      });
      return;
    }

    // 2. Try to transcribe; on success the transcript is saved on the record
    await transcribeRecord(id, audioBlob);
  };

  const getAudioDuration = async (audioBlob) => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener("loadedmetadata", () => {
        resolve(audio.duration || 0);
      });
      audio.addEventListener("error", () => {
        resolve(0);
      });
      audio.src = URL.createObjectURL(audioBlob);
    });
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      return false;
    }
  };

  // Store a local record's transcript on the account, then drop the local copy
  // (including its audio: the API only keeps text).
  const saveToAccount = async (id) => {
    const record = state.translations.find((t) => t.id === id);
    if (!record?.text || !authRef.current.token) return;
    dispatch({ type: "CLEAR_ERROR" });
    dispatch({ type: "SET_SAVING", payload: id });
    try {
      const created = await api.createTranscript(authRef.current.token, {
        text: record.text,
        model_used: resolveConfig().model,
      });
      // Keep favorite / translation / agent reply: they follow the record to the API
      const extras = Object.fromEntries(
        ["favorite", "translatedText", "translatedLanguage", "translatedAt", "agentResponse", "agentAt"]
          .filter((k) => record[k])
          .map((k) => [k, record[k]])
      );
      if (Object.keys(extras).length) {
        const next = await audioTranslationDB.patchMeta(created.id, extras);
        dispatch({ type: "SET_META", payload: next });
      }
      // Mark first so the API copy wins even if removing the local one fails
      await audioTranslationDB.update(id, { remoteId: created.id });
      await audioTranslationDB.delete(id);
      await loadTranslations();
      await loadRemote();
    } catch (error) {
      handleApiError(error, "Save to account failed");
    } finally {
      dispatch({ type: "SET_SAVING", payload: null });
    }
  };

  // Edit a transcript's text (API records are patched on the server)
  const editText = async (id, text) => {
    const record = records.find((t) => t.id === id);
    if (!record) return;
    try {
      if (record.source === "api") {
        const updated = await api.updateTranscript(authRef.current.token, record.remoteId, { text });
        dispatch({
          type: "SET_REMOTE",
          payload: state.remote.map((r) => (r.id === id ? api.toRecord(updated) : r)),
        });
      } else {
        await audioTranslationDB.update(id, { text });
        await loadTranslations();
      }
    } catch (error) {
      handleApiError(error, "Failed to save edit");
      throw error;
    }
  };

  const deleteTranslation = async (id) => {
    const remote = state.remote.find((r) => r.id === id);
    if (remote) {
      try {
        await api.deleteTranscript(authRef.current.token, remote.remoteId);
        await audioTranslationDB.deleteMeta(remote.remoteId);
        dispatch({
          type: "SET_REMOTE",
          payload: state.remote.filter((r) => r.id !== id),
        });
      } catch (error) {
        handleApiError(error, "Failed to delete transcript");
      }
      return;
    }
    try {
      await audioTranslationDB.delete(id);
      const updatedTranslations = state.translations.filter((t) => t.id !== id);
      dispatch({ type: "SET_TRANSLATIONS", payload: updatedTranslations });
    } catch {
      dispatch({ type: "SET_ERROR", payload: "Failed to delete translation" });
    }
  };

  const reprocessTranslation = async (translationId) => {
    dispatch({ type: "CLEAR_ERROR" });
    try {
      // Get the stored audio from the database
      const translationFromDB = await audioTranslationDB.get(translationId);
      if (!translationFromDB || !translationFromDB.audioBlob) {
        throw new Error("Audio data not found");
      }
      await transcribeRecord(translationId, translationFromDB.audioBlob);
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: "Retranscribe failed: " + error.message,
      });
    }
  };

  // Send a record's transcript to the translate or agent endpoint and keep the
  // reply on the record. kind: "translate" | "agent"
  const runAction = async (id, kind) => {
    const label = kind === "translate" ? "Translation" : "Agent";
    dispatch({ type: "CLEAR_ERROR" });
    dispatch({ type: "SET_ACTION_BUSY", payload: { id, kind } });
    try {
      const record = records.find((t) => t.id === id);
      if (!record?.text) throw new Error("There is no transcript to send");
      const meta = { id: record.remoteId ?? id, timestamp: record.timestamp };

      if (kind === "translate") {
        const { text, language } = await translateText(record.text, meta);
        await patchRecord(record, {
          translatedText: text,
          translatedLanguage: language,
          translatedAt: new Date().toISOString(),
        });
      } else {
        const text = await sendToAgent(record.text, meta);
        await patchRecord(record, {
          agentResponse: text,
          agentAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: `${label} failed: ${error.message}`,
      });
    } finally {
      dispatch({ type: "SET_ACTION_BUSY", payload: null });
    }
  };

  const value = {
    ...state,
    records,
    editText,
    saveToAccount,
    toggleFavorite,
    setRecordTags,
    createTag,
    updateTag,
    deleteTag,
    runAction,
    addTranslation,
    reprocessTranslation,
    copyToClipboard,
    deleteTranslation,
    setRecording: (recording) =>
      dispatch({ type: "SET_RECORDING", payload: recording }),
    clearError: () => dispatch({ type: "CLEAR_ERROR" }),
    setError: (message) => dispatch({ type: "SET_ERROR", payload: message }),
  };

  return (
    <AudioTranslationContext.Provider value={value}>
      {children}
    </AudioTranslationContext.Provider>
  );
}

export function useAudioTranslation() {
  const context = useContext(AudioTranslationContext);
  if (!context) {
    throw new Error(
      "useAudioTranslation must be used within AudioTranslationProvider"
    );
  }
  return context;
}

AudioTranslationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
