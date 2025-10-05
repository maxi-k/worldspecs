// FileDropHandler.js
// Handles drag and drop of DuckDB files for custom database loading

import { showToast } from '/util.js';

export default class FileDropHandler {
  #db;
  #onDatabaseLoaded;
  #dropZoneElement;
  #originalDbName;

  constructor(dbInstance, onDatabaseLoaded) {
    this.#db = dbInstance;
    this.#onDatabaseLoaded = onDatabaseLoaded;
    this.#originalDbName = 'default';
    this.#dropZoneElement = document.body; // Use entire body as drop zone
    this.#setupEventListeners();
    this.#createDropIndicator();
  }

  #createDropIndicator() {
    // Create drop indicator overlay
    const dropIndicator = document.createElement('div');
    dropIndicator.id = 'file-drop-indicator';
    dropIndicator.className = 'file-drop-indicator hidden';
    dropIndicator.innerHTML = `
      <div class="drop-content">
        <div class="drop-icon">📁</div>
        <div class="drop-text">Drop DuckDB file here</div>
        <div class="drop-subtext">Supported formats: .duckdb, .db</div>
      </div>
    `;
    document.body.appendChild(dropIndicator);
  }

  #setupEventListeners() {
    // Prevent default drag behaviors on entire document
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, this.#preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
      this.#dropZoneElement.addEventListener(eventName, this.#handleDragEnter.bind(this), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      this.#dropZoneElement.addEventListener(eventName, this.#handleDragLeave.bind(this), false);
    });

    // Handle dropped files
    this.#dropZoneElement.addEventListener('drop', this.#handleDrop.bind(this), false);
  }

  #preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  #handleDragEnter(e) {
    // Only show indicator for file drags
    if (e.dataTransfer.types.includes('Files')) {
      const indicator = document.getElementById('file-drop-indicator');
      indicator.classList.remove('hidden');
    }
  }

  #handleDragLeave(e) {
    // Only hide if we're leaving the drop zone completely
    if (!this.#dropZoneElement.contains(e.relatedTarget)) {
      const indicator = document.getElementById('file-drop-indicator');
      indicator.classList.add('hidden');
    }
  }

  async #handleDrop(e) {
    const indicator = document.getElementById('file-drop-indicator');
    indicator.classList.add('hidden');

    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length !== 1) {
      showToast('Please drop exactly one DuckDB file', 'error');
      return;
    }

    const file = files[0];
    
    // Validate file type
    if (!this.#isValidDuckDBFile(file)) {
      showToast('Invalid file type. Please drop a .duckdb or .db file', 'error');
      return;
    }

    try {
      await this.#loadCustomDatabase(file);
    } catch (error) {
      console.error('Error loading custom database:', error);
      showToast('Failed to load database file: ' + error.message, 'error');
    }
  }

  #isValidDuckDBFile(file) {
    const validExtensions = ['.duckdb', '.db'];
    const fileName = file.name.toLowerCase();
    return validExtensions.some(ext => fileName.endsWith(ext));
  }

  async #loadCustomDatabase(file) {
    showToast('Loading custom database...', 'info');

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await this.#readFileAsArrayBuffer(file);
      const uint8Array = new Uint8Array(arrayBuffer);

      // Register file in DuckDB's virtual filesystem
      const customDbName = `custom_${Date.now()}.duckdb`;
      await this.#db.registerFileBuffer(customDbName, uint8Array);

      // Detach current database and attach the new one
      try {
        const detachResult = await this.#db.query('DETACH specs;');
      } catch (e) {
        // Ignore if no database is currently attached
      }

      const attachResult = await this.#db.query(`ATTACH '${customDbName}' AS custom;`);
      const useResult = await this.#db.query('USE custom;');

      // Verify the database is valid by trying to list tables
      const tables = await this.#db.query('SHOW TABLES;');
      
      if (tables.rows.length === 0) {
        throw new Error('Database appears to be empty or invalid');
      }

      // Store reference to original database name for potential restoration
      this.#originalDbName = customDbName;

      // Notify that a new database has been loaded
      if (this.#onDatabaseLoaded) {
        this.#onDatabaseLoaded(file.name, tables.rows.length);
      }

      showToast(`Custom database "${file.name}" loaded successfully (${tables.rows.length} tables)`, 'success');

    } catch (error) {
      throw new Error(`Failed to load database: ${error.message}`);
    }
  }

  #readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // Method to restore the original database
  async restoreOriginalDatabase() {
    try {
      showToast('Restoring original database...', 'info');
      
      // Detach custom database
      try {
        const detachResult = await this.#db.query('DETACH specs;');
      } catch (e) {
        // Ignore if already detached
      }

      // Reattach original database (assuming it's still available)
      const originalDbUrl = `${window.location.origin}/static/worldspecs.duckdb`;
      const attachResult = await this.#db.query(`ATTACH '${originalDbUrl}' AS specs;`);
      const useResult = await this.#db.query('USE specs;');

      if (this.#onDatabaseLoaded) {
        this.#onDatabaseLoaded('worldspecs.duckdb', null);
      }

      showToast('Original database restored', 'success');
    } catch (error) {
      console.error('Error restoring original database:', error);
      showToast('Failed to restore original database: ' + error.message, 'error');
    }
  }

  // Get current database info
  getCurrentDatabaseInfo() {
    return {
      name: this.#originalDbName,
      isCustom: this.#originalDbName !== 'default'
    };
  }
}
