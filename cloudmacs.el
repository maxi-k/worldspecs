;;; cloudmacs.el --- Description -*- lexical-binding: t; -*-
;;
;; Copyright (C) 2025 Maximilian Kuschewski
;;
;; Author: Maximilian Kuschewski <>
;; Maintainer: Maximilian Kuschewski <>
;; Created: July 07, 2025
;; Modified: July 07, 2025
;; Version: 0.0.1
;; Keywords: abbrev bib c calendar comm convenience data docs emulations extensions faces files frames games hardware help hypermedia i18n internal languages lisp local maint mail matching mouse multimedia news outlines processes terminals tex text tools unix vc wp
;; Homepage: https://github.com/tum-dis/cloudspecs
;; Package-Requires: ((emacs "24.4"))
;;
;; This file is not part of GNU Emacs.
;;
;;; Commentary:
;;
;;  CloudSpecs in emacs:
;;  - sql buffer that connects to duckdb (C-c C-c to eval); results shown in csv buffer.
;;  - can start R buffer (C-c C-p) to generate plots; buffer is automatically re-executed
;;    everytime the csv output changes.
;;
;;; Code:

(defvar-local cloudmacs-db nil
  "The database connection to use for cloudmacs
Use `cloudmacs-set-db' to set this variable")

(defvar cloudmacs-duckdb-binary "duckdb" "The duckdb binary to use.")
(defvar cloudmacs-use-saneql nil "Whether to use saneql instead of sql if available.")
(defvar cloudmacs-default-sql "-- C-c C-c to eval buffer; C-c C-p to start accompanying R session
describe;"
  "The default sql to start with")
(defvar cloudmacs-default-r "library(Cairo)
library(ggplot2)
library(dplyr)
library(sqldf)
df <- read.csv('%s')
theme_set(theme_bw(20))
ggplot(df, aes()) +
  annotate(geom = 'text', x = 0, y = 0, label = 'Plot something!')
" "The default r code to start with")

(defvar cloudmacs-compilation-buffer-name "*cloudmacs-compilation*" "The name of the buffer to use for storing compiled SQL.")
(defvar cloudmacs-csv-buffer-name "*cloudmacs-csv*" "The name of the buffer to use for displaying cloudmacs output.")
(defvar cloudmacs-csv-buffer-modes '((csv-mode) (csv-align-mode) (visual-line-mode -1)) "The modes to use for the output buffer.")
(defvar cloudmacs-output-pop-to-buffer-p nil "Whether to pop to the output buffer after running a query.")

(defclass cloudmacs-db-connection ()
  ((filename :initarg :filename)
   (binary :initarg :binary)
   (tmp-csv-file :initarg :csv)
   (tmp-r-file :initarg :r)
   (tmp-sql-file :initarg :sql)))

(defun cloudmacs--make-db (filename)
  (if prefix-arg
      (make-instance 'cloudmacs-db-connection
                     :filename filename
                     :binary (read-string "DuckDB binary: ")
                     :csv (read-file-name "Tmp csv file: " "/tmp/")
                     :r (read-file-name "Tmp R file: " "/tmp/")
                     :sql (read-file-name "Tmp sql file" "/tmp/"))
    (let* ((prefix (concat (int-to-string (random 1000)) "-" (int-to-string  (random 1000))))
          (dir (concat "/tmp/cloudmacs-" prefix "/")))
      (make-directory dir)
      (make-instance 'cloudmacs-db-connection
                     :filename filename
                     :binary cloudmacs-duckdb-binary
                     :csv (concat dir "table.csv")
                     :r (concat dir "plot.r")
                     :sql (concat dir "table.sql")))))


(defun cloudmacs--query-database (db output-buffer)
  "Execute the current buffer as sql against the given sqlite database and write the result to the output buffer."
  (with-slots (filename binary) db
    (call-process-region (point-min) (point-max) (or binary saneql-duckdb-default-binary)
                         nil output-buffer nil "-header" "-csv" "-cmd" ".separator ,"
                         (if (or (not filename) (eq filename "") (eq filename ":memory:"))
                             nil
                           (expand-file-name (format "%s" filename))))))

(defun cloudmacs--copy-buffer (up-to-point)
  "Copy the current buffer up to the given point to a compilation buffer and return it."
  (let ((inhibit-message t)
        (saved-point (point))
        (start (point-min))
        (end (point-max))
        (buf (current-buffer)))
    (when up-to-point
      (move-end-of-line nil)
      (setq end (point))
      (goto-char saved-point))
    (let ((compilation-buf (get-buffer-create cloudmacs-compilation-buffer-name t)))
      (with-current-buffer compilation-buf
        (erase-buffer)
        (insert-buffer-substring buf start end))
      compilation-buf)))

(defun cloudmacs--get-file-buffer (name)
  (or (get-file-buffer name)
      (find-file-noselect name)))

(defun cloudmacs--exec-sql-buffer (db buffer)
  "Execute the given sql buffer against the given database and return the result buffer."
  (let ((output-buf (cloudmacs--get-file-buffer (slot-value db :csv))))
    (with-current-buffer output-buf (erase-buffer))
    (with-current-buffer buffer
      (cloudmacs--query-database
       db
       output-buf)
      output-buf)))

(defun cloudmacs-setup-r-buffer ()
  (interactive)
  (let* ((db (or cloudmacs-db (call-interactively #'cloudmacs-set-db)))
         (r-file (slot-value db :r))
         (r-buf (cloudmacs--get-file-buffer r-file)))
    (pop-to-buffer r-buf)
    (write-file r-file)
    (with-current-buffer r-buf
      (when (eq (point-min) (point-max))
          (goto-char (point-min))
          (insert  (format cloudmacs-default-r (slot-value db :csv))))
      (setq-local cloudmacs-r-watch (file-notify-add-watch (slot-value db :csv) '(change) #'cloudmacs-reeval-r))
      (add-hook 'kill-buffer-hook #'cloudmacs-cleanup-file-watch)
      (ess-set-working-directory (file-name-directory r-file))
      (ess-eval-buffer))))

(defun cloudmacs-cleanup-file-watch ()
  (if (boundp 'cloudmacs-r-watch)
      (file-notify-rm-watch cloudmacs-r-watch)
      (message "cloudmacs-r-watch not bound")))

(defun cloudmacs-reeval-r (event)
  (let* ((db (or cloudmacs-db (with-current-buffer (get-buffer-create (slot-value db :sql))
                                 (call-interactively #'cloudmacs-set-db))))
         (r-buf (cloudmacs--get-file-buffer (slot-value db :r))))
    (with-current-buffer r-buf
      (ess-eval-buffer))))

(defun cloudmacs-compile-and-run-buffer (up-to-point)
  "Compile the current buffer to SQL and run the resulting SQL against the database.
If UP-TO-POINT is non-nil, only compile up to the current line.
If no database connection is set, prompt for one. Switches to the
output buffer afterwards."
  (interactive "P")
  (message "local vars %s" (buffer-local-variables))
  (message "db is %s" cloudmacs-db)
  (let* ((db (or cloudmacs-db (call-interactively #'cloudmacs-set-db)) )
         (result-buf (cloudmacs--exec-sql-buffer db (cloudmacs--copy-buffer up-to-point))))
    (with-current-buffer result-buf
      (write-file (slot-value db :csv))
      (mapc #'apply cloudmacs-csv-buffer-modes)
      (goto-char (point-min)))
    (unless (get-buffer-window result-buf)
      (display-buffer result-buf))
    (when cloudmacs-output-pop-to-buffer-p
      (pop-to-buffer result-buf))))

(defun cloudmacs-set-db (duckdb-file)
  (interactive (list (read-file-name "DB file: ")))
  (let ((db (cloudmacs--make-db duckdb-file)))
    (write-file (slot-value db :sql))
    (setq-local cloudmacs-db db)))

(defun cloudmacs ()
  "Open a sql buffer for the current buffer."
  (interactive)
  (let ((buf (get-buffer-create "*cloudmacs*")))
    (pop-to-buffer buf)
    (if (and cloudmacs-use-saneql (fboundp 'saneql-mode)) (saneql-mode) (sql-mode))
    (cloudmacs-mode)
    (goto-char (point-min))
    (insert cloudmacs-default-sql)))

(defvar cloudmacs-mode-map
  (let ((map (make-sparse-keymap)))
    (define-key map (kbd "C-c C-c") #'cloudmacs-compile-and-run-buffer)
    (define-key map (kbd "C-c C-p") #'cloudmacs-setup-r-buffer)
    map)
  "Keymap for `cloudmacs-mode'.")

(defun cloudmacs-mode--on ()
  (use-local-map cloudmacs-mode-map))

(defun cloudmacs-mode--off ()
)

(define-minor-mode cloudmacs-mode
  "Cloudmacs minor mode"
  :global nil
  :lighter "org-dashboard"
  (if cloudmacs-mode
      ;; enabled
      (cloudmacs-mode--on)
      ;; disabled
      (cloudmacs-mode--off)))


(provide 'cloudmacs)
;;; cloudmacs.el ends here
