"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { uploadCopy as copy } from "../config/copy";
import { readImageDimensions, needsSizeWarning } from "../model/image-dimensions";
import { validateSketchFile } from "../model/file-validation";
import { formatFileSize } from "../model/format-file-size";

type ImageSize = { width: number; height: number };
type SketchSelection = { file: File; previewUrl: string };

interface UploadSketchProps {
  onFileNameSuggested: (name: string) => void;
  onSelectionChange?: (file: File | null) => void;
  disabled?: boolean;
  maxFileSizeBytes?: number;
  minImageSide?: number;
}

function fileTitle(file: File): string {
  return file.name.replace(/\.[^.]+$/, "").slice(0, 60);
}

export function UploadSketch({ onFileNameSuggested, onSelectionChange, disabled = false, maxFileSizeBytes, minImageSide }: UploadSketchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<SketchSelection | null>(null);
  const [selection, setSelection] = useState<SketchSelection | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => {
    if (selectionRef.current) URL.revokeObjectURL(selectionRef.current.previewUrl);
  }, []);

  const acceptFile = useCallback((candidate?: File) => {
    if (!candidate || disabled) return;
    const validation = validateSketchFile(candidate, maxFileSizeBytes);
    if (!validation.valid) {
      setError(validation.reason === "type" ? copy.invalidType : copy.tooLarge);
      return;
    }

    setError(null);
    if (selectionRef.current) URL.revokeObjectURL(selectionRef.current.previewUrl);
    const nextSelection = { file: candidate, previewUrl: URL.createObjectURL(candidate) };
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
    onSelectionChange?.(candidate);
    setImageSize(null);
    void readImageDimensions(candidate).then((dimensions) => {
      if (selectionRef.current === nextSelection) setImageSize(dimensions);
    });
    onFileNameSuggested(fileTitle(candidate));
  }, [disabled, maxFileSizeBytes, onFileNameSuggested, onSelectionChange]);

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const pastedFile = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.type.startsWith("image/"))
        ?.getAsFile();
      if (pastedFile) {
        event.preventDefault();
        acceptFile(pastedFile);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [acceptFile]);

  const handleReplace = () => { if (!disabled) inputRef.current?.click(); };
  const handleRemove = () => {
    if (disabled) return;
    if (selectionRef.current) URL.revokeObjectURL(selectionRef.current.previewUrl);
    selectionRef.current = null;
    setSelection(null);
    setImageSize(null);
    setError(null);
    onSelectionChange?.(null);
  };

  return (
    <section className="panel upload-panel" aria-labelledby="upload-heading">
      <div className="section-heading">
        <div className="section-number">01</div>
        <div>
          <h2 id="upload-heading">{copy.uploadTitle}</h2>
          <p>{copy.uploadSectionNote}</p>
        </div>
      </div>

      <div
        className={`drop-zone${dragging ? " drop-zone-active" : ""}${selection ? " drop-zone-filled" : ""}`}
        aria-disabled={disabled}
        onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={handleDrop}
      >
        {selection ? (
          <div className="file-preview">
            <Image src={selection.previewUrl} alt={copy.previewAlt(selection.file.name)} width={68} height={68} unoptimized />
            <div className="file-details">
              <span className="file-name" title={selection.file.name}>{selection.file.name}</span>
              <span className="file-size">{formatFileSize(selection.file.size)}{imageSize ? ` · ${imageSize.width} × ${imageSize.height} px` : ""}</span>
            </div>
            <div className="file-actions">
              <button type="button" className="text-button" onClick={handleReplace} disabled={disabled}>{copy.replaceFile}</button>
              <button type="button" className="text-button text-button-muted" onClick={handleRemove} disabled={disabled}>{copy.removeFile}</button>
            </div>
          </div>
        ) : (
          <div className="drop-content">
            <div className="upload-symbol" aria-hidden="true"><span>↑</span></div>
            <h3>{copy.dropTitle}</h3>
            <p>{copy.dropHelp}</p>
            <button type="button" className="button button-secondary" onClick={handleReplace} disabled={disabled}>{copy.chooseFile}</button>
            <p className="file-limit">{copy.uploadNote}</p>
          </div>
        )}
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          disabled={disabled}
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          aria-label={copy.chooseFile}
          onChange={handleInput}
        />
      </div>
      {error ? <p className="inline-error" role="alert">{error} <button type="button" onClick={handleReplace} disabled={disabled}>{copy.replaceFileAction}</button></p> : null}
      {selection && imageSize && needsSizeWarning(imageSize.width, imageSize.height, minImageSide) ? (
        <p className="inline-warning" role="status">{copy.smallImage}</p>
      ) : null}
      <p className="paste-hint">{copy.pasteHint}</p>

      <aside className="advice-box" aria-labelledby="advice-heading">
        <h3 id="advice-heading">{copy.adviceTitle}</h3>
        <ul>{copy.advice.map((tip) => <li key={tip}>{tip}</li>)}</ul>
      </aside>
    </section>
  );
}
