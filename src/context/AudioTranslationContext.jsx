import { createContext, useContext, useReducer, useEffect } from "react";
import PropTypes from "prop-types";
import { audioTranslationDB } from "../services/database";
import { translateAudio } from "../services/translationService";
import { translateText, sendToAgent } from "../services/actionService";

const AudioTranslationContext = createContext();

const initialState = {
  translations: [],
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

  useEffect(() => {
    loadTranslations();

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

  // Transcribe a stored recording and persist the outcome on its record.
  // Failure is not an error state for the app: the recording stays saved with
  // status "failed" so the user can retry from the UI.
  const transcribeRecord = async (id, audioBlob) => {
    dispatch({ type: "SET_TRANSLATING", payload: true });
    try {
      const text = await translateAudio(audioBlob);
      await audioTranslationDB.update(id, { text, status: "done", error: null });
      await loadTranslations();
      if (text) await copyToClipboard(text);
    } catch (error) {
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

  const deleteTranslation = async (id) => {
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
      const record = state.translations.find((t) => t.id === id);
      if (!record?.text) throw new Error("There is no transcript to send");
      const meta = { id, timestamp: record.timestamp };

      if (kind === "translate") {
        const { text, language } = await translateText(record.text, meta);
        await audioTranslationDB.update(id, {
          translatedText: text,
          translatedLanguage: language,
          translatedAt: new Date().toISOString(),
        });
      } else {
        const text = await sendToAgent(record.text, meta);
        await audioTranslationDB.update(id, {
          agentResponse: text,
          agentAt: new Date().toISOString(),
        });
      }
      await loadTranslations();
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
