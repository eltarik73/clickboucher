// Records what a photo component asks of next/image and of the browser: the props of every
// next/image element, and every photo an <img> requests (once per src attribute set). Each test
// file declares the mock (vi.mock is hoisted only inside its own file), then records per test:
//   vi.mock("next/image", async (importOriginal) =>
//     (await import("<path>/next-image-recorder")).recordingNextImage(importOriginal)
//   );
//   beforeEach(recordImageRequests); afterEach(() => vi.restoreAllMocks());
import type { ImageProps } from "next/image";
import { createElement, forwardRef } from "react";
import { vi } from "vitest";

/** Props of every next/image element rendered since recordImageRequests(). */
export const imageProps: Record<string, unknown>[] = [];
/** Photos requested by an <img>, in order, since recordImageRequests(). */
export const requested: string[] = [];

const nativeSetAttribute = Element.prototype.setAttribute;

/** The photo an <img> src asks for: the url parameter of /_next/image, otherwise the src itself. */
export function candidateOf(src: string): string {
  const optimizer = "/_next/image?";
  if (!src.startsWith(optimizer)) return src;
  const url = new URLSearchParams(src.slice(optimizer.length)).get("url");
  if (url === null) throw new Error(`URL d'optimisation sans paramètre url : ${src}`);
  return url;
}

/** vi.mock factory of next/image: the real component, the props of each element recorded. */
export async function recordingNextImage(importOriginal: <T>() => Promise<T>) {
  const actual = await importOriginal<typeof import("next/image")>();
  const RealImage = actual.default;
  const RecordingImage = forwardRef<HTMLImageElement, ImageProps>(
    function RecordingImage(props, ref) {
      imageProps.push({ ...props });
      return createElement(RealImage, { ...props, ref });
    }
  );
  return { ...actual, default: RecordingImage };
}

/** Empties both records and spies on the src attribute of every <img> (vi.restoreAllMocks ends it). */
export function recordImageRequests(): void {
  imageProps.length = 0;
  requested.length = 0;
  vi.spyOn(Element.prototype, "setAttribute").mockImplementation(function (
    this: Element,
    name: string,
    value: string
  ) {
    if (this instanceof HTMLImageElement && name === "src") requested.push(candidateOf(value));
    nativeSetAttribute.call(this, name, value);
  });
}
