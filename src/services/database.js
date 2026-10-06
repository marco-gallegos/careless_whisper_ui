import Dexie from "dexie";

class AudioTranslationDB extends Dexie {
  constructor() {
    super("AudioTranslationDB");

    this.version(1).stores({
      translations:
        "++id, timestamp, text, audioUrl, duration, audioData, mimeType",
    });

    // v2: favorites + tags. `favorite` (boolean) is unindexed and filtered in JS;
    // `tags` on a record is an array of tag names, indexed per entry (*tags).
    // The `tags` table holds tag metadata (name is the key).
    this.version(2).stores({
      translations:
        "++id, timestamp, text, audioUrl, duration, audioData, mimeType, *tags",
      tags: "name",
    });

    // v3: client-side extras for transcripts stored on the API, keyed by the server id.
    // The API only holds text, so favorite / translation / agent reply live here
    // (this browser only).
    this.version(3).stores({
      remoteMeta: "remoteId",
    });
  }

  // --- Extras for API-stored records ---------------------------------------

  async getAllMeta() {
    const rows = await this.remoteMeta.toArray();
    return Object.fromEntries(rows.map((r) => [r.remoteId, r]));
  }

  async patchMeta(remoteId, fields) {
    const current = (await this.remoteMeta.get(remoteId)) || { remoteId };
    const next = { ...current, ...fields };
    await this.remoteMeta.put(next);
    return next;
  }

  async deleteMeta(remoteId) {
    return await this.remoteMeta.delete(remoteId);
  }

  // --- Favorites & tags -----------------------------------------------------
  // Everything the UI needs for favorites/tags goes through these methods so the
  // storage can be swapped for a backend later (see docs/PRD.md).

  async setFavorite(id, favorite) {
    return await this.translations.update(id, { favorite: !!favorite });
  }

  async setRecordTags(id, tags) {
    return await this.translations.update(id, { tags });
  }

  async getTags() {
    return await this.tags.orderBy("name").toArray();
  }

  async addTag(tag) {
    await this.tags.add(tag);
  }

  async updateTagColor(name, color) {
    return await this.tags.update(name, { color });
  }

  // Renames the tag and every record that uses it (merging if a record ends up with duplicates)
  async renameTag(oldName, newName) {
    await this.transaction("rw", this.translations, this.tags, async () => {
      const existing = await this.tags.get(oldName);
      if (!existing) throw new Error("Tag not found");
      await this.tags.delete(oldName);
      await this.tags.put({ ...existing, name: newName });
      await this.translations
        .where("tags")
        .equals(oldName)
        .modify((record) => {
          record.tags = [
            ...new Set(record.tags.map((t) => (t === oldName ? newName : t))),
          ];
        });
    });
  }

  // Deletes the tag and removes it from every record
  async deleteTag(name) {
    await this.transaction("rw", this.translations, this.tags, async () => {
      await this.tags.delete(name);
      await this.translations
        .where("tags")
        .equals(name)
        .modify((record) => {
          record.tags = record.tags.filter((t) => t !== name);
        });
    });
  }

  async add(translation) {
    // Store the audio blob as ArrayBuffer for persistence
    if (translation.audioBlob) {
      translation.audioData = await translation.audioBlob.arrayBuffer();
      translation.mimeType = translation.audioBlob.type;
      // Remove the blob reference since we're storing the data
      delete translation.audioBlob;
    }
    return await this.translations.add(translation);
  }

  async getAll() {
    const translations = await this.translations
      .orderBy("timestamp")
      .reverse()
      .toArray();

    // Convert stored audio data back to blob URLs for playback
    return translations.map((translation) => {
      if (translation.audioData && translation.mimeType) {
        const blob = new Blob([translation.audioData], {
          type: translation.mimeType,
        });
        translation.audioUrl = URL.createObjectURL(blob);
        translation.audioBlob = blob;
      }
      return translation;
    });
  }

  async getById(id) {
    const translation = await this.translations.get(id);
    if (translation && translation.audioData && translation.mimeType) {
      const blob = new Blob([translation.audioData], {
        type: translation.mimeType,
      });
      translation.audioUrl = URL.createObjectURL(blob);
      translation.audioBlob = blob;
    }
    return translation;
  }

  async get(id) {
    const translation = await this.translations.get(id);
    if (translation && translation.audioData && translation.mimeType) {
      const blob = new Blob([translation.audioData], {
        type: translation.mimeType,
      });
      translation.audioUrl = URL.createObjectURL(blob);
      translation.audioBlob = blob;
    }
    return translation;
  }

  async update(id, updatedTranslation) {
    // If there's an audio blob, convert it to ArrayBuffer for storage
    if (updatedTranslation.audioBlob) {
      updatedTranslation.audioData =
        await updatedTranslation.audioBlob.arrayBuffer();
      updatedTranslation.mimeType = updatedTranslation.audioBlob.type;
      // Remove the blob reference since we're storing the data
      delete updatedTranslation.audioBlob;
    }
    return await this.translations.update(id, updatedTranslation);
  }

  async delete(id) {
    // Clean up any blob URLs before deleting
    const translation = await this.translations.get(id);
    if (translation && translation.audioUrl) {
      URL.revokeObjectURL(translation.audioUrl);
    }
    return await this.translations.delete(id);
  }

  async clear() {
    // Clean up all blob URLs before clearing
    const translations = await this.translations.toArray();
    translations.forEach((t) => {
      if (t.audioUrl) {
        URL.revokeObjectURL(t.audioUrl);
      }
    });
    return await this.translations.clear();
  }

  async exportToJSON() {
    const translations = await this.getAll();
    return JSON.stringify(translations, null, 2);
  }

  async exportToSQLite() {
    // This would require a backend service to handle SQLite export
    // For now, we'll return the data in a format suitable for SQLite
    const translations = await this.getAll();

    let sql = `CREATE TABLE IF NOT EXISTS translations (
      id INTEGER PRIMARY KEY,
      timestamp TEXT,
      text TEXT,
      audio_url TEXT,
      duration REAL
    );\n\n`;

    translations.forEach((t) => {
      sql += `INSERT INTO translations (id, timestamp, text, audio_url, duration) VALUES (
        ${t.id},
        '${t.timestamp}',
        '${(t.text || "").replace(/'/g, "''")}',
        '${t.audioUrl || ""}',
        ${t.duration || 0}
      );\n`;
    });

    return sql;
  }
}

export const audioTranslationDB = new AudioTranslationDB();
